import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { comparePeakNormalizedRms } from "./helpers/bounce_quality.mjs";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import {
    hostParameters,
    loadOfflineEngine,
    offlineEngineModuleURL,
    outputLatencyFrames,
} from "./helpers/bounce_offline_engine.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sampleRate = 48_000;
const roots = Object.freeze([48, 60, 72]);
const holdSeconds = 0.2;
const nodeWorkerURL = new URL("../bounce/node-render-worker.mjs", import.meta.url);

function nodeWorkerFactory(url) {
    return new Worker(url, { type: "module" });
}

/** One cycle of a sine with a quiet third harmonic. */
function sourceFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => {
        const phase = index / 2_048;
        return (Math.sin(2 * Math.PI * phase) + (0.12 * Math.sin(6 * Math.PI * phase))) / 1.12;
    });
}

function rootFloat(bank, index, firstFrame, frameCount) {
    const first = (bank.roots[index].frameOffset + firstFrame) * 2;
    return Float32Array.from(bank.pcm.subarray(first, first + (frameCount * 2)), (value) => value / 32_768);
}

function stereoRms(samples) {
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
}

/** How many dB a root's level falls from 10 ms to 50 ms after its note-off, in 5 ms windows. */
function releaseDropDb(bank, index, noteOffFrame) {
    const windowFrames = Math.round(0.005 * sampleRate);
    const level = (seconds) => stereoRms(rootFloat(
        bank, index, noteOffFrame + Math.round(seconds * sampleRate), windowFrames,
    ));
    return 20 * Math.log10(level(0.01) / level(0.05));
}

test("a recursive capture installs generation 1 in every fresh worker and reproduces its held sound", async () => {
    const [CmajorClass, { bounceCaptureRecipeInternals }] = await Promise.all([
        loadOfflineEngine(),
        loadUIModule(repoRoot, "ui/shared/bounce-capture-recipe.ts"),
    ]);
    const capture = (snapshot) => captureBounceBank({
        snapshot,
        planOptions: { roots, holdSeconds, tailCapSeconds: 0.45 },
        workerURL: nodeWorkerURL,
        engineModuleURL: offlineEngineModuleURL,
        workerFactory: nodeWorkerFactory,
        concurrency: 1,
    });
    const parameters = hostParameters(CmajorClass, {
        oscAWavetableSelect: 0,
        oscAVolumeDb: -20,
        filterMode: 0,
    });
    const generationOne = await capture(createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        parameters,
        wavetableSources: [{ input: 0, generation: 1, tableIndex: 0, frames: [sourceFrame()] }],
    }));
    // A bounced sound keeps every parameter and plays its bank as Source Mode Bounce.
    const generationTwo = await capture(createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 123,
        settleFrames: 256,
        sourceGeneration: 1,
        sourceBankDigest: generationOne.digest,
        parameters: { ...parameters, sourceMode: 1 },
        setupEvents: bounceCaptureRecipeInternals.recursiveBankSetupEvents(generationOne.bank, 1),
    }));

    assert.deepEqual(generationOne.plan.roots, roots);
    assert.deepEqual(generationTwo.plan.roots, roots);
    assert.equal(generationTwo.plan.snapshot.sourceGeneration, 1);
    assert.equal(generationTwo.plan.snapshot.sourceBankDigest, generationOne.digest);
    assert.match(generationTwo.digest, /^[0-9a-f]{64}$/);

    // A capture records the synth's output, which the Polish bus delays by its
    // fixed latency, so generation 2 hears generation 1 that much later. The
    // held sound must survive recursion unchanged.
    const holdFrames = Math.round(holdSeconds * sampleRate);
    for (let index = 0; index < roots.length; index += 1) {
        const held = comparePeakNormalizedRms(
            rootFloat(generationOne.bank, index, 0, holdFrames),
            rootFloat(generationTwo.bank, index, outputLatencyFrames, holdFrames),
            sampleRate,
        );
        assert.ok(held.passes,
            `root ${roots[index]} held A/B: mean ${held.meanDeltaDb.toFixed(3)} dB, max ${held.maxDeltaDb.toFixed(3)} dB`);
        // The live Amp Envelope owns a bounced sound's loudness, so after
        // note-off its exponential Amp Release fades the baked release once
        // more: the recursive tail falls twice as many decibels in the same time.
        const sourceDrop = releaseDropDb(generationOne.bank, index, holdFrames + outputLatencyFrames);
        const recursiveDrop = releaseDropDb(generationTwo.bank, index, holdFrames + (2 * outputLatencyFrames));
        assert.ok(Math.abs((recursiveDrop / sourceDrop) - 2) < 0.2,
            `root ${roots[index]} release falls ${recursiveDrop.toFixed(2)} dB recursively against ${sourceDrop.toFixed(2)} dB in its source`);
    }

    const wasmPages = [generationOne, generationTwo].flatMap((result) => (
        result.metrics.map((entry) => entry.wasmMemoryPages)
    ));
    assert.equal(wasmPages.every(Number.isInteger), true);
    assert.equal(new Set(wasmPages).size, 1, "fresh recursive workers must use fixed wasm pages");
});
