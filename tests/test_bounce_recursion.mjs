import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { bounceBankInstallMessages } from "../bounce/bank-install.mjs";
import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { comparePeakNormalizedRms } from "../bounce/quality.mjs";

const sampleRate = 48_000;
const roots = Object.freeze([48, 60, 72]);
const engineModuleURL = pathToFileURL(path.resolve("build/web/cmaj_Cosimo_Synth.offline.js")).href;
const nodeWorkerURL = new URL("../bounce/node-render-worker.mjs", import.meta.url);

function nodeWorkerFactory(url) {
    return new Worker(url, { type: "module" });
}

function syntheticMipSamples(mipIndex) {
    const samplesPerFrame = 2_048;
    const samples = new Float32Array(samplesPerFrame * 3);
    const cycleLength = Math.min(2_048, Math.max(256, (1 << mipIndex) * 32));
    for (let index = 0; index < samplesPerFrame; index += 1) {
        const phase = (index % cycleLength) / cycleLength;
        samples[index] = (Math.sin(2 * Math.PI * phase)
            + (0.12 * Math.sin(6 * Math.PI * phase))) / 1.12;
    }
    return samples;
}

function wavetableSetupEvents() {
    const events = [{
        endpointID: "wavetableLoadBegin",
        sessionScoped: true,
        value: {
            dspSessionId: 0,
            oscillatorIndex: 0,
            generation: 1,
            tableIndex: 0,
            frameCount: 1,
        },
    }];
    for (let mipIndex = 0; mipIndex < 11; mipIndex += 1) {
        events.push({
            endpointID: "wavetableMipFrame",
            sessionScoped: true,
            value: {
                dspSessionId: 0,
                oscillatorIndex: 0,
                generation: 1,
                tableIndex: 0,
                mipIndex,
                frameIndexBase: 0,
                frameCount: 1,
                samples: syntheticMipSamples(mipIndex),
            },
        });
    }
    return events;
}

function generationOneSnapshot() {
    return createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        parameters: {
            sourceMode: 0,
            oscAWavetableSelect: 0,
            oscAVolumeDb: -20,
            oscAPhaseRandom: 0,
            oscARetrigger: 1,
            oscBVolumeDb: -48,
            oscBMute: 1,
            oscCVolumeDb: -48,
            oscCMute: 1,
            filterMode: 0,
            filterMix: 1,
            ampRelease: 0.2,
            playMode: 0,
            glideTime: 0,
        },
        setupEvents: wavetableSetupEvents(),
    });
}

function recursiveSnapshot(generationOne) {
    const setupEvents = [...bounceBankInstallMessages(generationOne.bank, {
        dspSessionId: 0,
        generation: 1,
    })].map((message) => ({
        endpointID: message.endpointID,
        sessionScoped: true,
        advanceFrames: 2,
        value: message.value,
    }));
    return createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        sourceGeneration: 1,
        sourceBankDigest: generationOne.digest,
        parameters: {
            sourceMode: 1,
            filterMode: 0,
            filterMix: 1,
            ampRelease: 0.2,
            playMode: 0,
            glideTime: 0,
        },
        setupEvents,
    });
}

function rootFloat(bank, index, frameCount) {
    const root = bank.roots[index];
    const samples = new Float32Array(frameCount * 2);
    const first = root.frameOffset * 2;
    for (let sample = 0; sample < samples.length; sample += 1) {
        samples[sample] = bank.pcm[first + sample] / 32_768;
    }
    return samples;
}

test("M7 recursive capture installs generation 1 in every fresh worker and stays within tolerance x2", async () => {
    const sharedOptions = {
        planOptions: {
            roots,
            holdSeconds: 0.20,
            tailCapSeconds: 0.45,
        },
        workerURL: nodeWorkerURL,
        engineModuleURL,
        workerFactory: nodeWorkerFactory,
        concurrency: 1,
    };
    const generationOne = await captureBounceBank({
        ...sharedOptions,
        snapshot: generationOneSnapshot(),
    });
    const generationTwo = await captureBounceBank({
        ...sharedOptions,
        snapshot: recursiveSnapshot(generationOne),
    });

    assert.deepEqual(generationOne.plan.roots, roots);
    assert.deepEqual(generationTwo.plan.roots, roots);
    assert.equal(generationTwo.plan.snapshot.sourceGeneration, 1);
    assert.equal(generationTwo.plan.snapshot.sourceBankDigest, generationOne.digest);
    assert.match(generationTwo.digest, /^[0-9a-f]{64}$/);

    const quality = [];
    for (let index = 0; index < roots.length; index += 1) {
        const frameCount = Math.min(
            generationOne.bank.roots[index].frameCount,
            generationTwo.bank.roots[index].frameCount,
        );
        const comparison = comparePeakNormalizedRms(
            rootFloat(generationOne.bank, index, frameCount),
            rootFloat(generationTwo.bank, index, frameCount),
            sampleRate,
        );
        assert.ok(
            comparison.meanDeltaDb < 2 && comparison.maxDeltaDb < 6,
            `root ${roots[index]} recursive A/B: mean ${comparison.meanDeltaDb.toFixed(3)} dB, max ${comparison.maxDeltaDb.toFixed(3)} dB`,
        );
        quality.push({
            root: roots[index],
            meanDeltaDb: Number(comparison.meanDeltaDb.toFixed(3)),
            maxDeltaDb: Number(comparison.maxDeltaDb.toFixed(3)),
        });
    }

    const wasmPages = [generationOne, generationTwo].flatMap((capture) => (
        capture.metrics.map((entry) => entry.wasmMemoryPages)
    ));
    assert.equal(wasmPages.every(Number.isInteger), true);
    assert.equal(new Set(wasmPages).size, 1, "fresh recursive workers must use fixed wasm pages");
    console.log(JSON.stringify({
        generationOneDigest: generationOne.digest,
        generationTwoDigest: generationTwo.digest,
        quality,
        wasmMemoryPages: wasmPages[0],
        absoluteVmTimingAdvisory: true,
        realtimeMultipliers: {
            generationOne: generationOne.metrics.map((entry) => Number(entry.realtimeMultiplier?.toFixed(3))),
            generationTwo: generationTwo.metrics.map((entry) => Number(entry.realtimeMultiplier?.toFixed(3))),
        },
    }));
});
