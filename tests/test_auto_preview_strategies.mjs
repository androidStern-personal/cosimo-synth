import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const DEFAULT_PARAMS = {
    settleMs: 150,
    minGapMs: 250,
    holdMs: 4000,
    loopSync: false,
};

/**
 * Deterministic harness mirroring the engine tests: manual clock, captured
 * timers, recorded strike/release calls, stubbable quantize and boundary.
 */
async function makeStrategyEngine(algorithm, overrides = {}) {
    const { createPreviewStrategyEngine } = await loadUIModule(
        repoRoot,
        "ui/shared/auto-preview-strategies.ts",
    );

    let currentTime = 0;
    let nextTimerId = 0;
    const pendingTimers = new Map();
    const calls = [];
    let params = { ...DEFAULT_PARAMS, ...(overrides.params ?? {}) };

    const engine = createPreviewStrategyEngine({
        algorithm,
        params: () => params,
        now: () => currentTime,
        scheduleAt: (atMs, callback) => {
            const timerId = nextTimerId += 1;
            pendingTimers.set(timerId, { atMs, callback });
            return () => pendingTimers.delete(timerId);
        },
        strike: () => calls.push({ call: "strike", at: currentTime }),
        release: () => calls.push({ call: "release", at: currentTime }),
        quantizeStrike: overrides.quantizeStrike ?? ((nowMs) => nowMs),
        nextLoopBoundary: overrides.nextLoopBoundary ?? (() => null),
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
    const setParams = (next) => {
        params = { ...params, ...next };
    };

    return { engine, calls, at, advanceTo, setParams };
}

test("morph strikes once per burst and releases after the hold window", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("morph");
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    at(200, () => engine.parameterEdited(true));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "release", at: 4200 },
    ]);
});

test("settle restrikes once at rest and never behind resumed movement", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("settle");
    engine.setEnabled(true);

    for (let t = 0; t <= 200; t += 50) {
        at(t, () => engine.parameterEdited(true));
    }
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "strike", at: 350 },
        { call: "release", at: 4350 },
    ]);
});

test("a loop-synced settle restrike defers to the grid and movement cancels it", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("settle", {
        params: { loopSync: true },
        quantizeStrike: (nowMs, kind) => (kind === "leading" ? nowMs : nowMs + 120),
    });
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(200, () => engine.parameterEdited(true));
    // Settle due at 350 defers to 470; movement at 400 must cancel it.
    at(400, () => engine.parameterEdited(true));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        // New rest: due at 550, deferred to 670.
        { call: "strike", at: 670 },
        { call: "release", at: 4670 },
    ]);
});

test("paced restrikes on the gap while moving plus one settle restrike, then holds", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("paced");
    engine.setEnabled(true);

    for (let t = 0; t <= 600; t += 50) {
        at(t, () => engine.parameterEdited(true));
    }
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "strike", at: 250 },
        { call: "strike", at: 500 },
        { call: "strike", at: 750 },
        { call: "release", at: 4750 },
    ]);
});

test("wrap restrikes at the loop boundary and ignores extra motion meanwhile", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("wrap", {
        nextLoopBoundary: (nowMs) => Math.max(1, Math.ceil(nowMs / 400)) * 400,
    });
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    at(200, () => engine.parameterEdited(true));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "strike", at: 400 },
        { call: "release", at: 4400 },
    ]);
});

test("wrap without an eligible loop falls back to the settle restrike", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("wrap");
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => engine.parameterEdited(true));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "strike", at: 250 },
        { call: "release", at: 4250 },
    ]);
});

test("a manual hold silences the strategy and edits after release start fresh", async () => {
    const { engine, calls, at, advanceTo } = await makeStrategyEngine("settle");
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(50, () => engine.manualHoldStarted());
    at(100, () => engine.parameterEdited(true));
    at(200, () => engine.manualHoldEnded());
    at(300, () => engine.parameterEdited(true));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "release", at: 50 },
        { call: "strike", at: 300 },
        { call: "release", at: 4300 },
    ]);
});

test("disabling mid-hold releases immediately and live param edits apply", async () => {
    const { engine, calls, at, setParams, advanceTo } = await makeStrategyEngine("settle");
    engine.setEnabled(true);

    at(0, () => engine.parameterEdited(true));
    at(100, () => setParams({ holdMs: 1000 }));
    advanceTo(900);
    at(900, () => engine.setEnabled(false));
    advanceTo(10000);

    assert.deepEqual(calls, [
        { call: "strike", at: 0 },
        { call: "release", at: 900 },
    ]);
});

test("the drag tuning setter overrides the outrun feel and resets cleanly", async () => {
    const geometry = await loadUIModule(repoRoot, "ui/shared/mod-source-touch-geometry.ts");
    const {
        MOD_SOURCE_TOUCH_TUNING_DEFAULTS,
        getModSourceTouchTuning,
        setModSourceTouchTuning,
        resolveModSourceTouchPoint,
    } = geometry;

    const viewport = { left: 0, right: 400, top: 0, bottom: 800, width: 400 };
    const start = { x: 200, y: 400 };
    const resolveAtTravel = (travel) => resolveModSourceTouchPoint({
        pointerType: "touch",
        start,
        previousPointer: start,
        previousPreview: start,
        pointer: { x: start.x + travel, y: start.y },
        viewport,
    });

    try {
        setModSourceTouchTuning({
            activationPx: 0,
            rampPx: 10,
            gainMin: 3,
            gainMax: 3,
            referenceTravelPx: 100,
        });
        assert.deepEqual(getModSourceTouchTuning(), {
            activationPx: 0,
            rampPx: 10,
            gainMin: 3,
            gainMax: 3,
            referenceTravelPx: 100,
        });
        // 30px of travel is fully past the 10px ramp: the preview moves 3x.
        assert.equal(resolveAtTravel(30).x, 200 + 90);
    } finally {
        setModSourceTouchTuning(MOD_SOURCE_TOUCH_TUNING_DEFAULTS);
    }

    assert.deepEqual(getModSourceTouchTuning(), MOD_SOURCE_TOUCH_TUNING_DEFAULTS);
});
