import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModSourceTouchGeometryModule() {
    return await loadUIModule(repoRoot, "ui/shared/mod-source-touch-geometry.ts");
}

test("touch modulation drags sustain amplified movement after pickup", async () => {
    const { resolveModSourceTouchPoint } = await loadModSourceTouchGeometryModule();
    const viewport = { left: 23, right: 370, top: 23, bottom: 829, width: 393 };
    const start = { x: 350, y: 420 };
    const resolveAtTravel = (travel, previousTravel, previousPreview) => resolveModSourceTouchPoint({
        pointerType: "touch",
        start,
        previousPointer: { x: start.x - previousTravel, y: start.y },
        previousPreview,
        pointer: { x: start.x - travel, y: start.y },
        viewport,
    });

    const atActivation = resolveAtTravel(7, 0, start);
    const justAfterActivation = resolveAtTravel(8, 0, start);
    assert.deepEqual(atActivation, { x: 343, y: 420 });
    assert.equal(
        Math.abs(justAfterActivation.x - 342) < 1,
        true,
        "The preview must not jump when drag ownership activates.",
    );

    const atEighty = resolveAtTravel(80, 0, start);
    const atOneTwenty = resolveAtTravel(120, 80, atEighty);
    const steadyStateGain = (atEighty.x - atOneTwenty.x) / 40;
    assert.equal(
        steadyStateGain >= 2.2 && steadyStateGain <= 2.5,
        true,
        `Expected a sustained game-like drag gain, received ${steadyStateGain}`,
    );
});

test("amplified touch drags reach an edge early and reverse without a dead strip", async () => {
    const { resolveModSourceTouchPoint } = await loadModSourceTouchGeometryModule();
    const viewport = { left: 23, right: 370, top: 23, bottom: 829, width: 393 };
    const start = { x: 350, y: 420 };
    const resolveStep = (travel, previousTravel, previousPreview) => resolveModSourceTouchPoint({
        pointerType: "touch",
        start,
        previousPointer: { x: start.x - previousTravel, y: start.y },
        previousPreview,
        pointer: { x: start.x - travel, y: start.y },
        viewport,
    });

    const atLeftEdge = resolveStep(150, 0, start);
    assert.deepEqual(atLeftEdge, { x: viewport.left, y: start.y });

    const reversingFivePixels = resolveStep(145, 150, atLeftEdge);
    assert.equal(
        reversingFivePixels.x > viewport.left + 10,
        true,
        "Discarded edge overshoot must not create sticky reverse travel.",
    );
});

test("amplified touch mapping is independent of pointer-event cadence", async () => {
    const { resolveModSourceTouchPoint } = await loadModSourceTouchGeometryModule();
    const viewport = { left: 23, right: 370, top: 23, bottom: 829, width: 393 };
    const start = { x: 350, y: 420 };
    const pointAt = (travel) => ({ x: start.x - travel, y: start.y });
    const resolveStep = (travel, previousTravel, previousPreview) => resolveModSourceTouchPoint({
        pointerType: "touch",
        start,
        previousPointer: pointAt(previousTravel),
        previousPreview,
        pointer: pointAt(travel),
        viewport,
    });

    const oneEvent = resolveStep(120, 0, start);
    const atEighty = resolveStep(80, 0, start);
    const twoEvents = resolveStep(120, 80, atEighty);

    assert.equal(Math.abs(oneEvent.x - twoEvents.x) < 0.001, true);
    assert.equal(Math.abs(oneEvent.y - twoEvents.y) < 0.001, true);
});

test("mouse and pen modulation drags remain direct", async () => {
    const { resolveModSourceTouchPoint } = await loadModSourceTouchGeometryModule();
    const viewport = { left: 23, right: 370, top: 23, bottom: 829, width: 393 };
    const input = {
        start: { x: 350, y: 420 },
        previousPointer: { x: 350, y: 420 },
        previousPreview: { x: 350, y: 420 },
        pointer: { x: 180, y: 260 },
        viewport,
    };

    assert.deepEqual(resolveModSourceTouchPoint({ ...input, pointerType: "mouse" }), input.pointer);
    assert.deepEqual(resolveModSourceTouchPoint({ ...input, pointerType: "pen" }), input.pointer);
});
