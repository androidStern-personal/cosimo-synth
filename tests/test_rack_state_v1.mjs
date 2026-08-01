import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const rackStatePromise = loadUIModule(repoRoot, "ui/shared/rack-state.ts");

test("rack.v1 is one complete clean schema with no legacy Chorus representation", async () => {
    const rack = await rackStatePromise;
    const state = rack.createDefaultRackState();
    assert.deepEqual(state.order, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
    assert.deepEqual(Object.values(state.enabled), Array(8).fill(false));
    assert.deepEqual(Object.keys(JSON.parse(rack.serializeRackState(state))).sort(), ["enabled", "format", "order", "version"]);

    for (const legacy of [
        { ...state, chorusEnabled: true },
        { ...state, compound: {} },
        { version: 0, order: state.order, enabled: state.enabled },
    ]) {
        assert.equal(rack.parseRackState(legacy)._tag, "err");
    }
});

test("rack structure commits exactly one complete order and enable event", async () => {
    const rack = await rackStatePromise;
    const defaultState = rack.createDefaultRackState();
    const state = {
        ...defaultState,
        order: [...defaultState.order].reverse(),
        enabled: { ...defaultState.enabled, drive: true, reverb: true },
    };
    assert.deepEqual(rack.buildRackRuntimeEvents(state), [
        { endpointID: "rackOrder", value: { moduleIds: [7, 6, 5, 4, 3, 2, 1, 0] } },
        { endpointID: "rackEnable", value: { enabledFlags: [0, 1, 0, 0, 0, 0, 0, 1] } },
    ]);
});

test("effective rack readback decodes committed order and enable identity", async () => {
    const rack = await rackStatePromise;
    const parsed = rack.parseEffectiveRackState({
        committedStructureGeneration: 7,
        committedOrderCode: 0b000_001_010_011_100_101_110_111,
        committedEnableMask: (1 << 1) | (1 << 7),
        rejectedOrderCount: 2,
        rejectedEnableCount: 3,
    });
    assert.deepEqual(parsed.order, ["reverb", "delay", "phaser", "flanger", "chorus", "ott", "drive", "filter"]);
    assert.equal(parsed.enabled.drive, true);
    assert.equal(parsed.enabled.reverb, true);
    assert.equal(parsed.enabled.chorus, false);
    assert.equal(parsed.generation, 7);
});
