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

test("rack structure commits exactly one complete lane topology event", async () => {
    const rack = await rackStatePromise;
    const defaultState = rack.createDefaultRackState();
    const state = {
        ...defaultState,
        order: [...defaultState.order].reverse(),
        enabled: { ...defaultState.enabled, drive: true, reverb: true },
    };
    // rack.v1's full permutation rides as an 8-position chain of the
    // ordinal-0 devices; the enable bits are POSITION-indexed, so drive
    // (position 6 in the reversed order) and reverb (position 0) set bits
    // 6 and 0, not their wire ids.
    assert.deepEqual(rack.buildRackRuntimeEvents(state), [
        {
            endpointID: "laneTopology",
            value: {
                chainLength: 8,
                slotIds: [7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                enabledMask: (1 << 6) | (1 << 0),
            },
        },
    ]);
});

test("effective rack readback decodes committed chain and enable identity", async () => {
    const rack = await rackStatePromise;
    const parsed = rack.parseEffectiveRackState({
        laneCommittedChainLength: 8,
        laneCommittedChainCode: 0b000_001_010_011_100_101_110_111,
        laneCommittedPositionMask: (1 << 6) | (1 << 0),
        laneCommittedGeneration: 7,
        laneRejectedUploadCount: 5,
        laneParamsAcknowledgedSerial: 42,
    });
    assert.deepEqual(parsed.order, ["reverb", "delay", "phaser", "flanger", "chorus", "ott", "drive", "filter"]);
    assert.equal(parsed.enabled.drive, true);
    assert.equal(parsed.enabled.reverb, true);
    assert.equal(parsed.enabled.chorus, false);
    assert.equal(parsed.generation, 7);
    assert.equal(parsed.rejectedUploadCount, 5);
    assert.equal(parsed.paramsAcknowledgedSerial, 42);
});

test("the pre-commit empty chain is not a rack.v1 structure", async () => {
    const rack = await rackStatePromise;
    // Before the adapter's first commit the engine runs the default EMPTY
    // chain (the deployed pre-rack sound); rack.v1 cannot represent it, so
    // the parse must say "no committed structure" rather than invent one.
    assert.equal(rack.parseEffectiveRackState({
        laneCommittedChainLength: 0,
        laneCommittedChainCode: 0,
        laneCommittedPositionMask: 0,
        laneCommittedGeneration: 0,
        laneRejectedUploadCount: 0,
        laneParamsAcknowledgedSerial: 0,
    }), null);
});
