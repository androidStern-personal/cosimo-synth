import assert from "node:assert/strict";
import test from "node:test";

import {
    BOUNCE_DEFAULT_ROOTS,
    createBounceCapturePlan,
    createBounceCaptureSnapshot,
} from "../bounce/capture-plan.mjs";
import { bounceOfflineRenderInternals } from "../bounce/offline-render-core.mjs";

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
    });
    parameterValues.filterMode = 5;
    samples[0] = 1;

    assert.deepEqual(snapshot.parameters, [
        { endpointID: "filterMode", value: 0 },
        { endpointID: "sourceMode", value: 0 },
    ]);
    assert.deepEqual([...snapshot.setupEvents[0].value.samples], [0.25, -0.5]);

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
