import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import { bounceBankInstallMessages } from "../bounce/bank-install.mjs";
import { captureBounceBank } from "../bounce/capture.mjs";
import { createBounceCaptureSnapshot } from "../bounce/capture-plan.mjs";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { comparePeakNormalizedRms } from "./helpers/bounce_quality.mjs";
import {
    createHostedPerformer,
    hostParameters,
    loadOfflineEngine,
    offlineEngineModuleURL,
    outputLatencyFrames,
} from "./helpers/bounce_offline_engine.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sampleRate = 48_000;
const blockFrames = 128;
const fixtureRoots = Object.freeze([48, 60, 72]);
const nodeWorkerURL = new URL("../bounce/node-render-worker.mjs", import.meta.url);

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

/**
 * One cycle of an asymmetric, nearly band-limited shape: it exercises stereo
 * and rack dynamics without driving the output limiter past the A/B budget.
 */
function sourceFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => {
        const phase = index / 2_048;
        return (Math.sin(2 * Math.PI * phase) + (0.18 * Math.sin(4 * Math.PI * phase))) / 1.18;
    });
}

/** The fixture sound's effects lane, edited from the synth's starter lane. */
function fixtureLane(lane, kind) {
    let state = lane.createDefaultLaneStateV2();
    const edit = (next) => {
        assert.ok(next, `the ${kind} lane edit must apply`);
        state = next;
    };
    const setParams = (deviceId, params) => {
        for (const [endpointID, value] of Object.entries(params)) {
            edit(lane.setLaneDeviceParam(state, deviceId, endpointID, value));
        }
    };
    if (kind === "pad") {
        edit(lane.setLaneDeviceEnabled(state, "delay#1", true));
        setParams("delay#1", { delayTime: 220, delayFeedback: 0.58, delayFilter: 8_000, delayMix: 0.34 });
        edit(lane.setLaneDeviceEnabled(state, "reverb#1", true));
        setParams("reverb#1", { reverbSize: 0.82, reverbDecay: 0.88, reverbDamping: 0.32, reverbMix: 0.42 });
    } else if (kind === "ott") {
        edit(lane.addLaneDevice(state, "ott", { kind: "trunk", index: 0 }));
        setParams("ott#1", { ottMix: 100, ottAmount: 88, ottTimePercent: 55, ottBandDrive: 45, ottEnvelopeMatch: 30 });
    }
    return state;
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
    const firstSample = root.frameOffset * 2;
    return Float32Array.from(
        bank.pcm.subarray(firstSample, firstSample + (root.frameCount * 2)),
        (value) => value / 32_768,
    );
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

/**
 * Play every captured root as a bounced sound does, key held to its end:
 * Source Mode Bounce, Voice Filter off, a dry lane. The playback reaches the
 * output after the synth's fixed output latency, which the comparison skips.
 */
async function playbackAndCompare(t, CmajorClass, capture, label) {
    const sessionID = 0x515100;
    const { performer } = await createHostedPerformer(t, CmajorClass, sessionID, sampleRate, {
        sourceMode: 1,
        filterMode: 0,
    });
    performer.advance(128);
    for (const message of bounceBankInstallMessages(capture.bank, { dspSessionId: sessionID, generation: 1 })) {
        performer[`sendInputEvent_${message.endpointID}`](message.value);
        performer.advance(2);
    }

    for (let index = 0; index < capture.bank.roots.length; index += 1) {
        const root = capture.bank.roots[index];
        performer.sendInputEvent_midiIn({ message: packMidi(0x90, root.note, 100) });
        const playback = renderFrames(performer, outputLatencyFrames + root.frameCount).subarray(outputLatencyFrames * 2);
        const comparison = comparePeakNormalizedRms(capturedRootAsFloat(capture.bank, index), playback, sampleRate);
        assert.ok(
            comparison.passes,
            `${label} root ${root.note}: mean ${comparison.meanDeltaDb.toFixed(3)} dB, max ${comparison.maxDeltaDb.toFixed(3)} dB`,
        );
        performer.sendInputEvent_midiIn({ message: packMidi(0x80, root.note, 0) });
        renderFrames(performer, Math.round(0.25 * sampleRate));
    }
}

test("worker capture is deterministic and composes through sampled playback", async (t) => {
    const [CmajorClass, { bounceCaptureRecipeInternals }, lane, { synthPluginState }] = await Promise.all([
        loadOfflineEngine(),
        loadUIModule(repoRoot, "ui/shared/bounce-capture-recipe.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/synth-plugin-state.ts"),
    ]);
    const saved = (key, value = synthPluginState[key].initial.value) => synthPluginState[key].codec.encode(value);
    const fixtureSnapshot = (kind) => createBounceCaptureSnapshot({
        sampleRate,
        tempoBpm: 117,
        settleFrames: 256,
        parameters: hostParameters(CmajorClass, {
            oscAWavetableSelect: 0,
            oscAVolumeDb: -18,
            filterMode: 0,
            ampRelease: kind === "pad" ? 3 : (kind === "pluck" ? 0.08 : 0.28),
        }),
        wavetableSources: [{ input: 0, generation: 1, tableIndex: 0, frames: [sourceFrame()] }],
        setupEvents: bounceCaptureRecipeInternals.structuredRuntimeSetupEvents({
            parameters: {},
            storedState: {
                "modulation.v6": saved("modulation.v6"),
                "articulations.v4": saved("articulations.v4"),
                "lane.v1": saved("lane.v1", fixtureLane(lane, kind)),
            },
        }).events,
    });
    const capture = (kind, roots, onProgress) => captureBounceBank({
        snapshot: fixtureSnapshot(kind),
        planOptions: { roots },
        workerURL: nodeWorkerURL,
        engineModuleURL: offlineEngineModuleURL,
        workerFactory: nodeWorkerFactory,
        concurrency: 1,
        onProgress,
    });

    const deterministicA = await capture("pluck", [60]);
    const deterministicB = await capture("pluck", [60]);
    assert.equal(deterministicA.digest, deterministicB.digest);
    assert.deepEqual(deterministicA.bytes, deterministicB.bytes);

    const captures = new Map();
    for (const kind of ["pluck", "pad", "ott"]) {
        const progress = [];
        const result = await capture(kind, fixtureRoots, (value) => progress.push(value));
        assert.deepEqual(result.bank.roots.map((root) => root.note), fixtureRoots);
        assert.equal(progress.length, fixtureRoots.length);
        captures.set(kind, result);
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

    for (const [kind, result] of captures) {
        await playbackAndCompare(t, CmajorClass, result, kind);
    }
});
