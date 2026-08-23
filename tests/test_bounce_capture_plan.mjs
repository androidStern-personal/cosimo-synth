import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    BOUNCE_DEFAULT_ROOTS,
    createBounceCapturePlan,
    createBounceCaptureSnapshot,
} from "../bounce/capture-plan.mjs";
import {
    bounceOfflineRenderInternals,
    renderBounceRoot,
} from "../bounce/offline-render-core.mjs";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("capture snapshot clones the button-press state and planner pins V1 defaults", () => {
    const samples = new Float32Array([0.25, -0.5]);
    const parameterValues = { filterMode: 0, sourceMode: 0 };
    const snapshot = createBounceCaptureSnapshot({
        sampleRate: 48_000,
        tempoBpm: 123,
        parameters: parameterValues,
        setupEvents: [{
            endpointID: "wavetableMipFrame",
            value: { dspSessionId: -1, samples },
            sessionScoped: true,
        }],
        rootSetupEvents: [{
            endpointID: "articulationNoteMeta",
            rootNoteField: "noteNumber",
            value: { channel: 0, noteNumber: 0, selectorA: 7 },
            advanceFrames: 0,
        }],
    });
    parameterValues.filterMode = 5;
    samples[0] = 1;

    assert.deepEqual(snapshot.parameters, [
        { endpointID: "filterMode", value: 0 },
        { endpointID: "sourceMode", value: 0 },
    ]);
    assert.deepEqual([...snapshot.setupEvents[0].value.samples], [0.25, -0.5]);
    assert.deepEqual(snapshot.rootSetupEvents[0], {
        endpointID: "articulationNoteMeta",
        rootNoteField: "noteNumber",
        value: { channel: 0, noteNumber: 0, selectorA: 7 },
        advanceFrames: 0,
        sessionScoped: false,
    });

    const plan = createBounceCapturePlan(snapshot);
    assert.deepEqual(plan.roots, BOUNCE_DEFAULT_ROOTS);
    assert.equal(plan.holdFrames, 144_000);
    assert.equal(plan.tailCapFrames, 288_000);
    assert.equal(plan.captureVelocity, 100);
    assert.equal(plan.jobs[0].sessionID + 18, plan.jobs[18].sessionID);
});

test("tail segmentation retains the last audible 50 ms window plus deterministic padding", () => {
    const snapshot = createBounceCaptureSnapshot({ sampleRate: 8_000 });
    const plan = createBounceCapturePlan(snapshot, {
        roots: [60],
        holdSeconds: 0.01,
        tailCapSeconds: 0.25,
    });
    const totalFrames = plan.holdFrames + plan.tailCapFrames;
    const samples = new Float32Array(totalFrames * 2);
    // Audible for 60 ms after note-off, then truly silent.
    for (let frame = plan.holdFrames; frame < plan.holdFrames + 480; frame += 1) {
        samples[frame * 2] = 0.001;
        samples[(frame * 2) + 1] = -0.001;
    }
    const end = bounceOfflineRenderInternals.findTailEndFrame(samples, plan.holdFrames, plan);
    assert.equal(end, plan.holdFrames + 800 + 800);
});

test("capture recipes reject ambiguous roots and non-finite wire data", () => {
    assert.throws(
        () => createBounceCaptureSnapshot({ sampleRate: 48_000, parameters: { ampRelease: NaN } }),
        /finite/,
    );
    const snapshot = createBounceCaptureSnapshot({ sampleRate: 48_000 });
    assert.throws(() => createBounceCapturePlan(snapshot, { roots: [60, 60] }), /ascending/);
    assert.throws(() => createBounceCapturePlan(snapshot, { captureVelocity: 127 }), /velocity 100/);
});

test("capture snapshots preserve shared binary payload aliases", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    const snapshot = createBounceCaptureSnapshot({
        sampleRate: 48_000,
        setupEvents: [0, 1, 2].map((oscillatorIndex) => ({
            endpointID: "wavetableMipFrame",
            value: { oscillatorIndex, samples },
        })),
    });
    assert.notStrictEqual(snapshot.setupEvents[0].value.samples, samples);
    assert.strictEqual(
        snapshot.setupEvents[0].value.samples,
        snapshot.setupEvents[1].value.samples,
    );
    assert.strictEqual(
        snapshot.setupEvents[1].value.samples,
        snapshot.setupEvents[2].value.samples,
    );
});

test("root-scoped setup substitutes the worker note immediately before note-on", async () => {
    class ProbePerformer {
        static latest = null;
        log = [];
        constructor() { ProbePerformer.latest = this; }
        async initialise() {}
        sendInputEvent_tempo(value) { this.log.push(["tempo", value]); }
        sendInputEvent_articulationNoteMeta(value) { this.log.push(["meta", value]); }
        sendInputEvent_midiIn(value) { this.log.push(["midi", value]); }
        advance() {}
        getOutputFrames_audioOut(channels, count) {
            channels[0].fill(0.02, 0, count);
            channels[1].fill(-0.02, 0, count);
        }
    }
    const snapshot = createBounceCaptureSnapshot({
        sampleRate: 8_000,
        settleFrames: 1,
        rootSetupEvents: [{
            endpointID: "articulationNoteMeta",
            rootNoteField: "noteNumber",
            advanceFrames: 0,
            value: {
                channel: 0,
                noteNumber: 0,
                selectorA: 7,
                selectorB: 0,
                durationSamples: 0,
                ageSamples: 0,
            },
        }],
    });
    const plan = createBounceCapturePlan(snapshot, {
        roots: [64],
        holdSeconds: 0.001,
        tailCapSeconds: 0.01,
    });
    await renderBounceRoot(ProbePerformer, plan, plan.jobs[0]);

    const metaIndex = ProbePerformer.latest.log.findIndex(([kind]) => kind === "meta");
    const noteOnIndex = ProbePerformer.latest.log.findIndex(([kind, value]) => (
        kind === "midi" && ((value.message >> 16) & 0xf0) === 0x90
    ));
    assert.ok(metaIndex >= 0 && metaIndex < noteOnIndex);
    assert.equal(ProbePerformer.latest.log[metaIndex][1].noteNumber, 64);
});

test("the product recipe articulates velocity-100 roots only in Vel mode", async () => {
    const { bounceCaptureRecipeInternals } = await loadUIModule(
        repoRoot,
        "ui/shared/bounce-capture-recipe.ts",
    );
    const unassigned = Array(128).fill(-1);
    const velocity = [...unassigned];
    velocity[100] = 23;
    const velEvents = bounceCaptureRecipeInternals.articulationRootSetupEvents({
        activeMode: "vel",
        chain: unassigned,
        key: unassigned,
        velocity,
    });
    assert.equal(velEvents.length, 1);
    assert.equal(velEvents[0].value.selectorA, 23);
    assert.equal(velEvents[0].rootNoteField, "noteNumber");
    assert.deepEqual(bounceCaptureRecipeInternals.articulationRootSetupEvents({
        activeMode: "chain",
        chain: unassigned,
        key: unassigned,
        velocity,
    }), []);
});
