import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trajectoryModule = await loadUIModule(
    repoRoot,
    "fx/seqfx/view/tape-stop-v2-trajectory.ts",
);

const {
    TAPE_STOP_RETURN_CROSSFADE_TO_LIVE,
    TAPE_STOP_RETURN_SPIN_UP,
    evaluateTapeStopV2Trajectory,
    resolveTapeStopV2Trajectory,
} = trajectoryModule;

test("spin-up trajectory uses the authored stop/start durations instead of hardcoded proportions", () => {
    const trajectory = resolveTapeStopV2Trajectory({
        curve: 0,
        returnMode: TAPE_STOP_RETURN_SPIN_UP,
        startDurationMs: 250,
        stopDurationMs: 2_000,
    });

    assert.equal(trajectory.totalDurationMs, 2_250);
    assert.equal(trajectory.stopEndNormalized, 2_000 / 2_250);
    assert.equal(trajectory.handoffDurationMs, 10);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 0).motorSpeed, 1);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 2_000).motorSpeed, 0.005);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 2_250).motorSpeed, 1);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 2_239).liveBlend, 0);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 2_250).liveBlend, 1);
});

test("crossfade-to-live trajectory never presents its handoff as motor acceleration", () => {
    const trajectory = resolveTapeStopV2Trajectory({
        curve: 0.25,
        returnMode: TAPE_STOP_RETURN_CROSSFADE_TO_LIVE,
        startDurationMs: 8_000,
        stopDurationMs: 500,
    });
    const handoffStart = trajectory.stopDurationMs;

    assert.equal(trajectory.totalDurationMs, 510);
    assert.equal(trajectory.handoffDurationMs, 10);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, handoffStart + 5).motorSpeed, 0.005);
    assert.ok(evaluateTapeStopV2Trajectory(trajectory, handoffStart + 5).liveBlend > 0);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, trajectory.totalDurationMs).liveBlend, 1);
});

test("short spin-up durations keep bounded symmetric motor and live transitions", () => {
    const trajectory = resolveTapeStopV2Trajectory({
        curve: -1,
        returnMode: TAPE_STOP_RETURN_SPIN_UP,
        startDurationMs: 12,
        stopDurationMs: 20,
    });

    assert.equal(trajectory.handoffDurationMs, 6);
    assert.equal(trajectory.startFadeDurationMs, 6);
    assert.ok(evaluateTapeStopV2Trajectory(trajectory, 26).motorSpeed > 0.005);
    assert.equal(evaluateTapeStopV2Trajectory(trajectory, 32).liveBlend, 1);
});
