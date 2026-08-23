import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneStatePromise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneParamsPromise = loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts");

test("lane.v1 is one complete clean schema owning structure AND parameters", async () => {
    const lane = await laneStatePromise;
    const state = lane.createDefaultLaneState();
    assert.deepEqual(state.order, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
    assert.deepEqual(Object.values(state.enabled), Array(8).fill(false));
    assert.equal(state.params.delay.delayTime, 375);
    assert.equal(state.params.drive.distortionDriveDb, 12);
    assert.deepEqual(
        Object.keys(JSON.parse(lane.serializeLaneState(state))).sort(),
        ["enabled", "format", "order", "params", "version"],
    );

    for (const corrupt of [
        { ...state, chorusEnabled: true },
        { version: 0, order: state.order, enabled: state.enabled, params: state.params },
        { ...state, params: { ...state.params, delay: { ...state.params.delay, delayTime: "fast" } } },
        (() => { const { params, ...withoutParams } = state; return withoutParams; })(),
    ]) {
        assert.equal(lane.parseLaneState(corrupt)._tag, "err");
    }
});

test("a lane document replays as complete records first, then one topology event", async () => {
    const lane = await laneStatePromise;
    const defaultState = lane.createDefaultLaneState();
    const state = {
        ...defaultState,
        order: [...defaultState.order].reverse(),
        enabled: { ...defaultState.enabled, drive: true, reverb: true },
        params: {
            ...defaultState.params,
            delay: { ...defaultState.params.delay, delayTime: 90 },
        },
    };
    const events = lane.buildLaneRuntimeEvents(state);
    assert.equal(events.length, 9);

    // Records first (a device entering the chain snaps onto its record),
    // one per ordinal-0 slot, positional per the wire layout.
    const records = events.slice(0, 8);
    for (const record of records) {
        assert.equal(record.endpointID, "laneSlotParams");
        assert.equal(record.value.values.length, 8);
    }
    const delayRecord = records.find((record) => record.value.slotId === 6);
    assert.equal(delayRecord.value.values[0], 90);      // laneDelayParamTimeMs
    assert.equal(delayRecord.value.values[3], 0);       // laneDelayParamMix
    assert.equal(delayRecord.value.values[5], 8);       // laneDelayParamDivision

    // Then the structure: reversed order, POSITION-indexed enable bits
    // (drive at position 6, reverb at position 0).
    const topology = events[8];
    assert.equal(topology.endpointID, "laneTopology");
    assert.deepEqual(topology.value, {
        chainLength: 8,
        slotIds: [7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        enabledMask: (1 << 6) | (1 << 0),
    });
});

test("live field edits speak the positional wire layout", async () => {
    const lane = await laneStatePromise;
    const events = [];
    const connection = { sendEventOrValue: (endpointID, value) => events.push({ endpointID, value }) };
    lane.sendLaneParamValue(connection, "delay", "delayFilter", 6000, 41);
    assert.deepEqual(events, [{
        endpointID: "laneSlotParamValue",
        value: { slotId: 6, paramIndex: 2, deliverySerial: 41, value: 6000 },
    }]);
    assert.throws(() => lane.sendLaneParamValue(connection, "delay", "nope", 1, 42));
});

test("the slot param layout mirrors the engine's positional constants", async () => {
    const params = await laneParamsPromise;
    assert.equal(params.LANE_SLOT_PARAM_COUNT, 8);
    assert.equal(params.getLaneSlotParamIndex("delay", "delayTime"), 0);
    assert.equal(params.getLaneSlotParamIndex("delay", "delayDivision"), 5);
    assert.equal(params.getLaneSlotParamIndex("chorus", "chorusRingFineSemitones"), 7);
    assert.equal(params.getLaneSlotParamIndex("phaser", "phaserMix"), 7);
    assert.equal(params.getLaneSlotParamIndex("globalFilter", "delayTime"), null);
    assert.equal(params.getLaneSlotId("globalFilter", 0), 0);
    assert.equal(params.getLaneSlotId("delay", 0), 6);
    assert.equal(params.getLaneSlotId("delay", 2), 22);
    assert.throws(() => params.getLaneSlotId("delay", 5));
    assert.throws(() => params.buildLaneSlotParamValues("delay", { delayTime: 90 }));
});

test("effective lane readback decodes committed chain and enable identity", async () => {
    const lane = await laneStatePromise;
    const parsed = lane.parseEffectiveLaneState({
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

test("the pre-commit empty chain is not a lane.v1 structure", async () => {
    const lane = await laneStatePromise;
    // Before the adapter's first commit the engine runs the default EMPTY
    // chain (the deployed pre-lane sound); this eight-device document cannot
    // represent it, so the parse must say "no committed structure" rather
    // than invent one.
    assert.equal(lane.parseEffectiveLaneState({
        laneCommittedChainLength: 0,
        laneCommittedChainCode: 0,
        laneCommittedPositionMask: 0,
        laneCommittedGeneration: 0,
        laneRejectedUploadCount: 0,
        laneParamsAcknowledgedSerial: 0,
    }), null);
});
