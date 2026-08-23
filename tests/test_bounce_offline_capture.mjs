import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { installBounceBankInOfflinePerformer } from "../bounce/bank-install.mjs";
import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { comparePeakNormalizedRms } from "../bounce/quality.mjs";

const sampleRate = 48_000;
const blockFrames = 128;
const fixtureRoots = Object.freeze([48, 60, 72]);
const engineModuleURL = pathToFileURL(path.resolve("build/web/cmaj_Cosimo_Synth.offline.js")).href;
const nodeWorkerURL = new URL("../bounce/node-render-worker.mjs", import.meta.url);

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function syntheticMipSamples(mipIndex) {
    const samplesPerFrame = 2_048;
    const samples = new Float32Array(samplesPerFrame * 3);
    const cycleLength = Math.min(2_048, Math.max(256, (1 << mipIndex) * 32));
    for (let index = 0; index < samplesPerFrame; index += 1) {
        const phase = (index % cycleLength) / cycleLength;
        // A band-limited-ish asymmetric shape exercises stereo/rack dynamics
        // without driving the output limiter into the A/B tolerance budget.
        samples[index] = (Math.sin(2 * Math.PI * phase)
            + (0.18 * Math.sin(4 * Math.PI * phase))) / 1.18;
    }
    return samples;
}

function wavetableSetupEvents() {
    const events = [{
        endpointID: "wavetableLoadBegin",
        sessionScoped: true,
        value: {
            dspSessionId: -1,
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
                dspSessionId: -1,
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

function laneEvents(kind) {
    if (kind === "pluck") return [];
    const slotIds = new Int32Array(16);
    if (kind === "pad") {
        slotIds[0] = 6;
        slotIds[1] = 7;
        return [
            {
                endpointID: "laneSlotParams",
                value: {
                    slotId: 6,
                    deliverySerial: 1,
                    values: Float32Array.of(220, 0.58, 8_000, 0.34, 0, 8, 0, 0),
                },
            },
            {
                endpointID: "laneSlotParams",
                value: {
                    slotId: 7,
                    deliverySerial: 2,
                    values: Float32Array.of(0.82, 0.88, 0.32, 0.42, 0, 0, 0, 0),
                },
            },
            {
                endpointID: "laneTopology",
                value: { chainLength: 2, slotIds, enabledMask: 3 },
                advanceFrames: 1_024,
            },
        ];
    }
    slotIds[0] = 2;
    return [
        {
            endpointID: "laneSlotParams",
            value: {
                slotId: 2,
                deliverySerial: 1,
                values: Float32Array.of(100, 88, 55, 45, 30, 0, 0, 0),
            },
        },
        {
            endpointID: "laneTopology",
            value: { chainLength: 1, slotIds, enabledMask: 1 },
            advanceFrames: 1_024,
        },
    ];
}

function fixtureSnapshot(kind) {
    const release = kind === "pad" ? 3 : (kind === "pluck" ? 0.08 : 0.28);
    return createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 117,
        settleFrames: 256,
        parameters: {
            sourceMode: 0,
            oscAWavetableSelect: 0,
            oscAVolumeDb: -18,
            oscAPhaseRandom: 0,
            oscARetrigger: 1,
            oscBVolumeDb: -48,
            oscBMute: 1,
            oscCVolumeDb: -48,
            oscCMute: 1,
            filterMode: 0,
            filterMix: 1,
            ampRelease: release,
            playMode: 0,
            glideTime: 0,
        },
        setupEvents: [...wavetableSetupEvents(), ...laneEvents(kind)],
    });
}

function nodeWorkerFactory(url) {
    return new Worker(url, { type: "module" });
}

function renderFrames(performer, frameCount) {
    const output = new Float32Array(frameCount * 2);
    const left = new Float32Array(blockFrames);
    const right = new Float32Array(blockFrames);
    let offset = 0;
    while (offset < frameCount) {
        const count = Math.min(blockFrames, frameCount - offset);
        performer.advance(count);
        performer.getOutputFrames_audioOut([left, right], count, 0);
        for (let frame = 0; frame < count; frame += 1) {
            output[(offset + frame) * 2] = left[frame];
            output[((offset + frame) * 2) + 1] = right[frame];
        }
        offset += count;
    }
    return output;
}

function capturedRootAsFloat(bank, rootIndex) {
    const root = bank.roots[rootIndex];
    const output = new Float32Array(root.frameCount * 2);
    const firstSample = root.frameOffset * 2;
    for (let index = 0; index < output.length; index += 1) {
        output[index] = bank.pcm[firstSample + index] / 32_768;
    }
    return output;
}

function stereoRms(samples, firstFrame, frameCount) {
    let sum = 0;
    const end = Math.min(samples.length / 2, firstFrame + frameCount);
    for (let frame = firstFrame; frame < end; frame += 1) {
        const offset = frame * 2;
        sum += ((samples[offset] ** 2) + (samples[offset + 1] ** 2)) * 0.5;
    }
    return Math.sqrt(sum / Math.max(1, end - firstFrame));
}

async function playbackAndCompare(CmajorClass, capture, label) {
    const performer = new CmajorClass();
    await performer.initialise(0x515100, sampleRate);
    performer.setInputValue_sourceMode(1, 0);
    performer.setInputValue_filterMode(0, 0);
    performer.setInputValue_ampRelease(0.2, 0);
    performer.advance(128);
    installBounceBankInOfflinePerformer(performer, capture.bank, {
        dspSessionId: 0x515100,
        generation: 1,
    });

    const comparisons = [];
    for (let index = 0; index < capture.bank.roots.length; index += 1) {
        const root = capture.bank.roots[index];
        performer.sendInputEvent_midiIn({ message: packMidi(0x90, root.note, 100) });
        const playback = renderFrames(performer, root.frameCount);
        const reference = capturedRootAsFloat(capture.bank, index);
        const comparison = comparePeakNormalizedRms(reference, playback, sampleRate);
        assert.ok(
            comparison.passes,
            `${label} root ${root.note}: mean ${comparison.meanDeltaDb.toFixed(3)} dB, max ${comparison.maxDeltaDb.toFixed(3)} dB`,
        );
        comparisons.push({ root: root.note, ...comparison });
        performer.sendInputEvent_midiIn({ message: packMidi(0x80, root.note, 0) });
        renderFrames(performer, Math.round(0.25 * sampleRate));
    }
    return comparisons;
}

test("M3 worker capture is deterministic and composes through sampled playback", async () => {
    const engineModule = await import(engineModuleURL);
    const statusProbe = new engineModule.default();
    await statusProbe.initialise(9, 44_100);
    statusProbe.advance(1);
    assert.equal(statusProbe.getOutputEvent_engineStatus(0).event.sampleRateHz, 44_100);
    assert.equal(statusProbe.getOutputEvent_engineStatus(0).event.tempoBpm, 120);

    const deterministicOptions = {
        snapshot: fixtureSnapshot("pluck"),
        planOptions: { roots: [60] },
        workerURL: nodeWorkerURL,
        engineModuleURL,
        workerFactory: nodeWorkerFactory,
        concurrency: 1,
    };
    const deterministicA = await captureBounceBank(deterministicOptions);
    const deterministicB = await captureBounceBank(deterministicOptions);
    assert.equal(deterministicA.digest, deterministicB.digest);
    assert.deepEqual(deterministicA.bytes, deterministicB.bytes);

    const captures = new Map();
    for (const kind of ["pluck", "pad", "ott"]) {
        const progress = [];
        const capture = await captureBounceBank({
            snapshot: fixtureSnapshot(kind),
            planOptions: { roots: fixtureRoots },
            workerURL: nodeWorkerURL,
            engineModuleURL,
            workerFactory: nodeWorkerFactory,
            concurrency: 1,
            onProgress: (value) => progress.push(value),
        });
        assert.deepEqual(capture.bank.roots.map((root) => root.note), fixtureRoots);
        assert.equal(progress.length, fixtureRoots.length);
        captures.set(kind, capture);
    }

    const pad = captures.get("pad");
    for (let index = 0; index < pad.bank.roots.length; index += 1) {
        const segment = pad.segments[index];
        assert.ok(segment.frameCount >= segment.noteOffFrameOffset + sampleRate,
            `pad root ${segment.rootNote} must retain at least one second after note-off`);
        const root = capturedRootAsFloat(pad.bank, index);
        assert.ok(stereoRms(root, segment.noteOffFrameOffset + sampleRate, 2_400) > 1e-4,
            `pad root ${segment.rootNote} must contain an audible baked FX tail at +1 s`);
    }

    const quality = {};
    for (const [kind, capture] of captures) {
        quality[kind] = await playbackAndCompare(engineModule.default, capture, kind);
    }
    // Keep measured VM evidence in test output without treating absolute speed
    // as a Mac/iOS veto. Relative gates are logged at the milestone boundary.
    console.log(JSON.stringify({
        digests: Object.fromEntries([...captures].map(([kind, capture]) => [kind, capture.digest])),
        realtimeMultipliers: Object.fromEntries([...captures].map(([kind, capture]) => [
            kind,
            capture.metrics.map((entry) => Number(entry.realtimeMultiplier?.toFixed(3))),
        ])),
        quality: Object.fromEntries(Object.entries(quality).map(([kind, entries]) => [
            kind,
            entries.map((entry) => ({
                root: entry.root,
                meanDeltaDb: Number(entry.meanDeltaDb.toFixed(3)),
                maxDeltaDb: Number(entry.maxDeltaDb.toFixed(3)),
            })),
        ])),
    }));
});
