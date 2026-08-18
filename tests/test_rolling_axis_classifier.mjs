import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const classifierModulePromise = loadUIModule(repoRoot, "ui/shared/rolling-axis-classifier.ts");

function drag(module, samples, pointerType = "touch") {
    const { createRollingAxisState, applyRollingAxisSample } = module;
    let state = createRollingAxisState(samples[0].x, samples[0].y);
    const results = [];
    for (const sample of samples.slice(1)) {
        const result = applyRollingAxisSample(state, { pointerType, ...sample });
        state = result.state;
        results.push(result);
    }
    return { state, results };
}

test("movement inside the activation radius changes nothing", async () => {
    const module = await classifierModulePromise;
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 104, y: 102, time: 8 },
        { x: 106, y: 103, time: 16 },
    ], "touch");

    for (const result of results) {
        assert.equal(result.transition, "none");
        assert.equal(result.application, null);
        assert.equal(result.state.mode, "pending");
    }
});

test("mouse pointers activate at the tighter 4px radius", async () => {
    const module = await classifierModulePromise;
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 105, y: 100, time: 8 },
    ], "mouse");

    assert.equal(results[0].transition, "activate");
    assert.equal(results[0].state.mode, "horizontal");
    assert.equal(results[0].application, null, "the classifying sample is consumed");
});

test("ambiguous diagonal movement stays pending and edits neither axis", async () => {
    const module = await classifierModulePromise;
    const { results, state } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 108, y: 92, time: 10 },
        { x: 115, y: 85, time: 20 },
    ], "touch");

    assert.equal(state.mode, "pending");
    for (const result of results) {
        assert.equal(result.application, null);
    }
});

test("a dominant horizontal start classifies horizontal and discards vertical motion", async () => {
    const module = await classifierModulePromise;
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 98, time: 10 },
        { x: 118, y: 96, time: 20 },
        { x: 125, y: 95, time: 30 },
    ], "touch");

    assert.equal(results[0].transition, "activate");
    assert.equal(results[0].state.mode, "horizontal");

    for (const result of results.slice(1)) {
        assert.ok(result.application, "post-activation samples apply");
        assert.equal(result.application.axis, "horizontal");
        assert.equal(result.application.dy, 0, "the vertical component is discarded, not stored");
        assert.ok(result.application.dx > 0);
    }
});

test("vertical applications report up-positive deltas", async () => {
    const module = await classifierModulePromise;
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 100, y: 88, time: 10 },
        { x: 100, y: 80, time: 20 },
    ], "touch");

    assert.equal(results[0].state.mode, "vertical");
    assert.equal(results[1].application.axis, "vertical");
    assert.equal(results[1].application.dy, 8, "moving up by 8 screen px applies +8");
});

test("an L-shaped drag switches axes in place, consumes the switch sample, and accrues no debt", async () => {
    const module = await classifierModulePromise;
    // A deliberate turn: horizontal travel, a pause long enough for the 36ms
    // direction window to drain, then clearly vertical movement.
    const samples = [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 100, time: 10 },
        { x: 124, y: 100, time: 20 },
        { x: 124, y: 90, time: 60 },
        { x: 124, y: 80, time: 70 },
    ];
    const { results } = drag(module, samples, "touch");

    assert.equal(results[0].state.mode, "horizontal");
    assert.equal(results[1].application.axis, "horizontal");

    const switchResult = results[2];
    assert.equal(switchResult.transition, "switch");
    assert.equal(switchResult.state.mode, "vertical");
    assert.equal(switchResult.application, null, "the switching sample is consumed");
    assert.equal(switchResult.state.history.length, 0, "direction history clears on switch");

    const afterSwitch = results[3];
    assert.equal(afterSwitch.application.axis, "vertical");
    assert.equal(afterSwitch.application.dy, 10, "only the post-switch sample applies: no jump");
});

test("contrary motion must dominate the rolling window before an axis switch fires", async () => {
    const module = await classifierModulePromise;
    // Dense samples: the first vertical sample still shares the window with
    // recent horizontal travel, so hysteresis holds the axis; sustained
    // vertical motion switches on the next sample.
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 100, time: 10 },
        { x: 124, y: 100, time: 20 },
        { x: 124, y: 90, time: 30 },
        { x: 124, y: 80, time: 40 },
        { x: 124, y: 70, time: 50 },
    ], "touch");

    assert.equal(results[2].transition, "none", "one contrary sample inside the window is jitter");
    assert.equal(results[2].state.mode, "horizontal");
    assert.equal(results[3].transition, "switch", "sustained contrary motion switches promptly");
    assert.equal(results[4].application.axis, "vertical");
});

test("a switch can reverse again within the same gesture", async () => {
    const module = await classifierModulePromise;
    const { results, state } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 100, time: 10 },
        { x: 112, y: 88, time: 60 },
        { x: 112, y: 80, time: 70 },
        { x: 124, y: 80, time: 120 },
        { x: 136, y: 80, time: 130 },
    ], "touch");

    assert.equal(results[0].state.mode, "horizontal");
    assert.equal(results[1].transition, "switch");
    assert.equal(results[2].application.axis, "vertical");
    assert.equal(results[3].transition, "switch");
    assert.equal(results[4].application.axis, "horizontal");
    assert.equal(state.mode, "horizontal");
});

test("old direction history falls out of the rolling window", async () => {
    const module = await classifierModulePromise;
    const { results } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 100, time: 10 },
        { x: 113, y: 98, time: 100 },
        { x: 114, y: 96, time: 110 },
    ], "touch");

    const lastState = results[results.length - 1].state;
    assert.ok(
        lastState.history.every((sample) => sample.time >= 110 - 36),
        "history holds only the 36ms window",
    );
});

test("hand jitter while horizontal does not switch axes", async () => {
    const module = await classifierModulePromise;
    const { results, state } = drag(module, [
        { x: 100, y: 100, time: 0 },
        { x: 112, y: 100, time: 10 },
        { x: 118, y: 99, time: 20 },
        { x: 124, y: 101, time: 30 },
        { x: 130, y: 100, time: 40 },
    ], "touch");

    assert.equal(state.mode, "horizontal");
    for (const result of results.slice(1)) {
        assert.equal(result.transition, "none");
        assert.equal(result.application.axis, "horizontal");
    }
});
