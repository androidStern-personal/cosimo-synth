import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// The routing modules fall back to window timers; give Node a recording stand-in.
const windowCalls = {
    setTimeout: [],
    clearTimeout: [],
    requestAnimationFrame: [],
    cancelAnimationFrame: [],
};
globalThis.window = {
    setTimeout(callback, delay) {
        windowCalls.setTimeout.push({ callback, delay });
        return 1_000 + windowCalls.setTimeout.length;
    },
    clearTimeout(handle) {
        windowCalls.clearTimeout.push(handle);
    },
    requestAnimationFrame(callback) {
        windowCalls.requestAnimationFrame.push(callback);
        return 2_000 + windowCalls.requestAnimationFrame.length;
    },
    cancelAnimationFrame(handle) {
        windowCalls.cancelAnimationFrame.push(handle);
    },
};

const uiTimers = await loadUIModule(repoRoot, "ui/shared/ui-timers.ts");
const uiMediaClock = await loadUIModule(repoRoot, "ui/shared/ui-media-clock.ts");
const captureTime = await loadUIModule(repoRoot, "ui/speedrun/scripted/capture-time.ts");

test("uiTimeout routes to the installed driver; native handles still clear natively", () => {
    const { uiTimeout, clearUiTimeout, installUiTimeoutDriver } = uiTimers;

    const nativeHandle = uiTimeout(() => {}, 40);
    assert.ok(nativeHandle > 0, "no driver installed: uiTimeout must use window.setTimeout");
    assert.equal(windowCalls.setTimeout.at(-1)?.delay, 40);

    const driven = [];
    const cleared = [];
    const restore = installUiTimeoutDriver({
        setTimeout(callback, delay) {
            driven.push({ callback, delay });
            return -driven.length;
        },
        clearTimeout(handle) {
            if (handle >= 0) return false;
            cleared.push(handle);
            return true;
        },
    });

    const drivenHandle = uiTimeout(() => {}, 120);
    assert.ok(drivenHandle < 0);
    assert.equal(driven.at(-1)?.delay, 120);

    clearUiTimeout(drivenHandle);
    assert.deepEqual(cleared, [drivenHandle]);
    assert.ok(!windowCalls.clearTimeout.includes(drivenHandle));

    // The invariant the encoder depends on: a native timeout scheduled before
    // capture install must stay clearable while the driver is active.
    clearUiTimeout(nativeHandle);
    assert.equal(windowCalls.clearTimeout.at(-1), nativeHandle);

    restore();
    restore();
    const afterRestore = uiTimeout(() => {}, 7);
    assert.ok(afterRestore > 0, "restore must return uiTimeout to window timers");
});

test("uiTimeout driver installs nest LIFO", () => {
    const { uiTimeout, installUiTimeoutDriver } = uiTimers;
    const restoreOuter = installUiTimeoutDriver({ setTimeout: () => -101, clearTimeout: () => true });
    const restoreInner = installUiTimeoutDriver({ setTimeout: () => -202, clearTimeout: () => true });
    assert.equal(uiTimeout(() => {}, 1), -202);
    restoreInner();
    assert.equal(uiTimeout(() => {}, 1), -101);
    restoreOuter();
    assert.ok(uiTimeout(() => {}, 1) > 0);
});

test("media clock routes rAF and time, reports installation, and restores", () => {
    const {
        installUiMediaClock,
        hasUiMediaClock,
        uiMediaTimeNow,
        uiMediaRequestAnimationFrame,
        uiMediaCancelAnimationFrame,
    } = uiMediaClock;

    assert.equal(hasUiMediaClock(), false);
    assert.ok(Number.isFinite(uiMediaTimeNow()));

    const requested = [];
    const cancelled = [];
    const restore = installUiMediaClock({
        now: () => 1_234,
        requestAnimationFrame(callback) {
            requested.push(callback);
            return -requested.length;
        },
        cancelAnimationFrame(handle) {
            if (handle >= 0) return false;
            cancelled.push(handle);
            return true;
        },
    });

    assert.equal(hasUiMediaClock(), true);
    assert.equal(uiMediaTimeNow(), 1_234);
    const handle = uiMediaRequestAnimationFrame(() => {});
    assert.ok(handle < 0);

    uiMediaCancelAnimationFrame(handle);
    assert.deepEqual(cancelled, [handle]);
    assert.ok(!windowCalls.cancelAnimationFrame.includes(handle));

    // Native rAF handles cancel natively even while the clock is installed.
    uiMediaCancelAnimationFrame(2_001);
    assert.equal(windowCalls.cancelAnimationFrame.at(-1), 2_001);

    restore();
    assert.equal(hasUiMediaClock(), false);
    assert.ok(uiMediaRequestAnimationFrame(() => {}) > 0);
});

test("capture timeouts flush in due order, FIFO at ties, reentrant in-frame", () => {
    const { ScriptedCaptureTimeController } = captureTime;
    const controller = new ScriptedCaptureTimeController();
    controller.setMediaTime(0, 30);

    const order = [];
    const first = controller.setTimeout(() => order.push("a"), 50);
    const second = controller.setTimeout(() => order.push("b"), 50);
    controller.setTimeout(() => order.push("c"), 10);
    controller.setTimeout(() => order.push("late"), 10_000);
    assert.ok(first < 0 && second < first, "handles must be negative and descending");
    assert.equal(controller.clearTimeout(5), false, "positive handles are never claimed");

    controller.flushDueTimeouts();
    assert.deepEqual(order, [], "nothing due at media time 0");

    controller.setMediaTime(3, 30);
    controller.flushDueTimeouts();
    assert.deepEqual(order, ["c", "a", "b"]);

    // A callback scheduling a zero-delay timeout runs within the same frame.
    order.length = 0;
    controller.setTimeout(() => {
        order.push("outer");
        controller.setTimeout(() => order.push("inner"), 0);
    }, 0);
    controller.flushDueTimeouts();
    assert.deepEqual(order, ["outer", "inner"]);

    // A callback cancelling a due sibling prevents it from running.
    order.length = 0;
    let victim = 0;
    controller.setTimeout(() => {
        order.push("killer");
        controller.clearTimeout(victim);
    }, 0);
    victim = controller.setTimeout(() => order.push("victim"), 0);
    controller.flushDueTimeouts();
    assert.deepEqual(order, ["killer"]);

    // A self-rescheduling callback trips the runaway guard instead of hanging.
    const reschedule = () => controller.setTimeout(reschedule, 0);
    controller.setTimeout(reschedule, 0);
    assert.throws(() => controller.flushDueTimeouts(), /10,000/u);
});

test("capture rAF flushes one frame at a time in scheduling order", () => {
    const { ScriptedCaptureTimeController } = captureTime;
    const controller = new ScriptedCaptureTimeController();
    controller.setMediaTime(6, 30);

    const seen = [];
    controller.requestAnimationFrame((timestamp) => seen.push(["first", timestamp]));
    const doomed = controller.requestAnimationFrame(() => seen.push(["doomed"]));
    controller.requestAnimationFrame((timestamp) => {
        seen.push(["second", timestamp]);
        controller.requestAnimationFrame(() => seen.push(["next-flush"]));
    });
    assert.equal(controller.cancelAnimationFrame(doomed), true);
    assert.equal(controller.cancelAnimationFrame(2), false);

    controller.flushAnimationFrames();
    assert.deepEqual(seen, [["first", 200], ["second", 200]]);

    // The rAF requested mid-flush belongs to the next frame, like a browser.
    controller.flushAnimationFrames();
    assert.deepEqual(seen.at(-1), ["next-flush"]);
});

test("media time maps frames to milliseconds and clamps negatives", () => {
    const { ScriptedCaptureTimeController } = captureTime;
    const controller = new ScriptedCaptureTimeController();
    controller.setMediaTime(30, 30);
    assert.equal(controller.now(), 1_000);
    controller.setMediaTime(-5, 30);
    assert.equal(controller.now(), 0);
});

test("the active controller is required, installed, and restored LIFO", () => {
    const { ScriptedCaptureTimeController, requireScriptedCaptureTimeController } = captureTime;
    assert.throws(() => requireScriptedCaptureTimeController(), /not installed/u);

    const outer = new ScriptedCaptureTimeController();
    const inner = new ScriptedCaptureTimeController();
    const restoreOuter = outer.install();
    assert.equal(requireScriptedCaptureTimeController(), outer);
    const restoreInner = inner.install();
    assert.equal(requireScriptedCaptureTimeController(), inner);
    restoreInner();
    assert.equal(requireScriptedCaptureTimeController(), outer);
    restoreOuter();
    restoreOuter();
    assert.throws(() => requireScriptedCaptureTimeController(), /not installed/u);
});
