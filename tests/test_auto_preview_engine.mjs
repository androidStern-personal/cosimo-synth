import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const SCHEDULER_CONFIG = {
    minRetriggerIntervalMs: 250,
    movementStoppedMs: 150,
    releaseNoteCapMs: 600,
};

/**
 * A deterministic harness: manual clock, captured timers, recorded preview
 * calls. fire(t) advances the clock and runs every timer due at or before t in
 * scheduling order.
 */
async function makeEngine() {
    const [{ createAutoPreviewEngine }, { createAutoPreviewScheduler }] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/auto-preview-engine.ts"),
        loadUIModule(repoRoot, "ui/shared/auto-preview-scheduler.ts"),
    ]);

    let currentTime = 0;
    let nextTimerId = 0;
    const pendingTimers = new Map();
    const calls = [];

    const engine = createAutoPreviewEngine({
        scheduler: createAutoPreviewScheduler(SCHEDULER_CONFIG),
        movementStoppedMs: SCHEDULER_CONFIG.movementStoppedMs,
        now: () => currentTime,
        scheduleAt: (atMs, callback) => {
            const timerId = nextTimerId += 1;
            pendingTimers.set(timerId, { atMs, callback });
            return () => pendingTimers.delete(timerId);
        },
        playPreview: (capMs) => calls.push({ call: "play", at: currentTime, capMs }),
        endPreview: () => calls.push({ call: "end", at: currentTime }),
    });

    const advanceTo = (t) => {
        for (;;) {
            const due = [...pendingTimers.entries()]
                .filter(([, timer]) => timer.atMs <= t)
                .sort(([a, timerA], [b, timerB]) => (timerA.atMs - timerB.atMs) || (a - b))[0];
            if (!due) {
                break;
            }
            const [timerId, timer] = due;
            pendingTimers.delete(timerId);
            currentTime = Math.max(currentTime, timer.atMs);
            timer.callback();
        }
        currentTime = Math.max(currentTime, t);
    };
    const at = (t, action) => {
        advanceTo(t);
        action();
    };

    return { engine, calls, at, advanceTo, pendingTimers };
}

test("edits while disabled and unchanged edits produce nothing", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();

    at(0, () => engine.parameterEdited(true));
    at(10, () => engine.gestureStarted());
    at(20, () => engine.parameterEdited(true));
    at(30, () => engine.gestureEnded());

    engine.setEnabled(true);
    at(100, () => engine.gestureStarted());
    at(110, () => engine.parameterEdited(false));
    at(120, () => engine.gestureEnded());
    advanceTo(1000);

    assert.deepEqual(calls, []);
});

test("a bracketed drag strikes on the first change and releases on gesture end", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.gestureStarted());
    at(10, () => engine.parameterEdited(true));
    at(500, () => engine.gestureEnded());
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 10, capMs: null },
        { call: "end", at: 500 },
    ]);
});

test("in-window changes coalesce and the trailing value is heard through the timer", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.gestureStarted());
    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    at(120, () => engine.gestureEnded());
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "play", at: 250, capMs: 600 },
    ]);
});

test("an unbracketed edit synthesizes its own gesture end after the stillness window", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "end", at: 150 },
    ]);
});

test("continued unbracketed edits keep pushing the synthesized end out", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    at(200, () => engine.parameterEdited(true));
    advanceTo(2000);

    // Strikes at 0 (leading) and 250 (coalesced pending, still in motion, so
    // it holds); the synthesized end lands 150ms after the LAST edit.
    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "play", at: 250, capMs: null },
        { call: "end", at: 350 },
    ]);
});

test("stillness landing exactly at window-open yields one capped final strike", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    // Last edit at t=100: stillness deadline (250) coincides with the rate
    // window opening (250). Stillness resolves first, so the pending strike
    // becomes the self-releasing capped note — never a held note ended in the
    // same instant.
    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "play", at: 250, capMs: 600 },
    ]);
});

test("a real gesture start cancels the pending synthesized end", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.gestureStarted());
    at(400, () => engine.parameterEdited(true));
    at(600, () => engine.gestureEnded());
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "play", at: 400, capMs: null },
        { call: "end", at: 600 },
    ]);
});

test("nested gestures release only when the last pointer lifts", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.gestureStarted());
    at(5, () => engine.gestureStarted());
    at(10, () => engine.parameterEdited(true));
    at(300, () => engine.gestureEnded());
    at(320, () => engine.parameterEdited(true));
    at(700, () => engine.gestureEnded());
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 10, capMs: null },
        { call: "play", at: 320, capMs: null },
        { call: "end", at: 700 },
    ]);
});

test("disabling mid-hold ends the preview and cancels every pending timer", async () => {
    const { engine, calls, at, advanceTo, pendingTimers } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.gestureStarted());
    at(0, () => engine.parameterEdited(true));
    at(60, () => engine.parameterEdited(true));
    at(80, () => engine.setEnabled(false));
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "end", at: 80 },
    ]);
    assert.equal(pendingTimers.size, 0);

    // Edits after disabling stay silent even inside the still-open gesture.
    at(2000, () => engine.parameterEdited(true));
    advanceTo(3000);
    assert.deepEqual(calls.length, 2);
});

test("re-enabling starts clean and respects the rate window of the previous preview", async () => {
    const { engine, calls, at, advanceTo } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(20, () => engine.setEnabled(false));
    at(40, () => engine.setEnabled(true));
    at(60, () => engine.parameterEdited(true));
    advanceTo(2000);

    const plays = calls.filter((entry) => entry.call === "play");
    assert.deepEqual(plays.map((entry) => entry.at), [0, 250]);
});

test("dispose ends any active preview and detaches the engine", async () => {
    const { engine, calls, at, advanceTo, pendingTimers } = await makeEngine();
    engine.setEnabled(true);

    at(0, () => engine.gestureStarted());
    at(0, () => engine.parameterEdited(true));
    at(50, () => engine.dispose());
    advanceTo(2000);

    assert.deepEqual(calls, [
        { call: "play", at: 0, capMs: null },
        { call: "end", at: 50 },
    ]);
    assert.equal(pendingTimers.size, 0);

    at(2000, () => engine.parameterEdited(true));
    at(2010, () => engine.gestureEnded());
    advanceTo(3000);
    assert.equal(calls.length, 2);
});

test("the user-edit bus delivers edits and suppresses programmatic write batches", async () => {
    const {
        subscribeToUserEdits,
        reportUserParameterEdit,
        reportUserGestureStart,
        reportUserGestureEnd,
        runProgrammaticWrites,
    } = await loadUIModule(repoRoot, "ui/shared/user-edit-bus.ts");

    const received = [];
    const unsubscribe = subscribeToUserEdits({
        onParameterEdit: (edit) => received.push({ kind: "edit", ...edit }),
        onGestureStart: () => received.push({ kind: "start" }),
        onGestureEnd: () => received.push({ kind: "end" }),
    });

    reportUserGestureStart();
    reportUserParameterEdit({ endpointID: "filterCutoff", changed: true });
    const result = runProgrammaticWrites(() => {
        reportUserParameterEdit({ endpointID: "oscA.pan", changed: true });
        reportUserGestureEnd();
        return "applied";
    });
    reportUserGestureEnd();

    assert.equal(result, "applied");
    assert.deepEqual(received, [
        { kind: "start" },
        { kind: "edit", endpointID: "filterCutoff", changed: true },
        { kind: "end" },
    ]);

    unsubscribe();
    reportUserParameterEdit({ endpointID: "filterCutoff", changed: true });
    assert.equal(received.length, 3);
});
