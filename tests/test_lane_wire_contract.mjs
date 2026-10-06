import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneStatePromise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
const laneParamsPromise = loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts");

test("a one-field rack edit reaches the engine as one positional field delta; an unknown field is refused", async () => {
    const [{ synthRackDelivery }, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/worker/synth-rack-delivery.ts"),
        laneV2Promise,
    ]);
    const events = [];
    const signal = { aborted: false, onAbort: () => () => {} };
    const send = (effect) => {
        events.push({ endpointID: effect.endpoint, value: effect.value });
        return { kind: "submitted", completion: Promise.resolve({ kind: "sent", proof: "native-publication-processed" }) };
    };
    const listen = () => () => {};
    const binding = synthRackDelivery.create({ signal, send, listen });
    const context = { signal, send, listen };

    const initial = laneV2.createDefaultLaneStateV2();
    assert.equal((await binding.apply(initial, context)).kind, "sent");
    const installedRecords = events.filter((event) => event.endpointID === "laneSlotParams").length;
    assert.ok(installedRecords > 0);
    events.length = 0;

    assert.notEqual(initial.devices["delay#1"].params.delayFilter, 4321);
    const edited = laneV2.setLaneDeviceParam(initial, "delay#1", "delayFilter", 4321);
    assert.equal((await binding.apply(edited, context)).kind, "sent");
    assert.deepEqual(events, [{
        endpointID: "laneSlotParamValue",
        value: { slotId: 6, paramIndex: 2, value: 4321, deliverySerial: installedRecords + 1 },
    }]);

    assert.equal(laneV2.setLaneDeviceParam(edited, "delay#1", "nope", 1), null);
    assert.equal(laneV2.setLaneDeviceParam(edited, "reverb#1", "delayTime", 1), null);
});

test("the slot param layout mirrors the engine's positional constants", async () => {
    const params = await laneParamsPromise;
    assert.equal(params.LANE_SLOT_PARAM_COUNT, 13);
    assert.equal(params.getLaneSlotParamIndex("chorus", "chorusOutputTrimDb"), 12);
    assert.equal(params.getLaneSlotParamIndex("delay", "delayTime"), 0);
    assert.equal(params.getLaneSlotParamIndex("delay", "delayDivision"), 5);
    assert.equal(params.getLaneSlotParamIndex("chorus", "chorusRingFineSemitones"), 7);
    assert.equal(params.getLaneSlotParamIndex("phaser", "phaserMix"), 7);
    assert.equal(params.getLaneSlotParamIndex("distortion", "distortionType"), 6);
    assert.equal(params.getLaneSlotParamIndex("globalFilter", "delayTime"), null);
    assert.equal(params.getLaneSlotId("globalFilter", 0), 0);
    assert.equal(params.getLaneSlotId("delay", 0), 6);
    assert.equal(params.getLaneSlotId("delay", 2), 22);
    assert.throws(() => params.getLaneSlotId("delay", 5));
    assert.throws(() => params.buildLaneSlotParamValues("delay", { delayTime: 90 }));
});

test("branch tags ride the slot id's upper bits and a serial chain replays all-trunk", async () => {
    const [lane, laneV2] = await Promise.all([laneStatePromise, laneV2Promise]);
    // The bit layout is a WIRE CONTRACT with EffectsRack.cmajor's
    // laneEncodeSlotWithBranchTag: slot id in the low byte, three tag bits
    // above it, tag 0 = trunk. LaneParallel.cmajtest pins the same layout on
    // the engine side.
    assert.equal(lane.LANE_BRANCH_TAG_SHIFT, 8);
    assert.equal(lane.LANE_BRANCH_TAG_BITS, 3);
    assert.equal(lane.LANE_MAX_BRANCHES_PER_GROUP, 4);
    assert.equal(lane.encodeLaneSlotWithBranchTag(6, 2), 6 | (2 << 8));
    assert.equal(lane.decodeLaneSlotId(6 | (2 << 8)), 6);
    assert.equal(lane.decodeLaneBranchTag(6 | (2 << 8)), 2);
    assert.equal(lane.decodeLaneBranchTag(38), 0);
    assert.throws(() => lane.encodeLaneSlotWithBranchTag(6, 5), /Invalid lane branch tag/);
    assert.throws(() => lane.encodeLaneSlotWithBranchTag(6, -1), /Invalid lane branch tag/);

    // A chain without groups encodes every placed device as a trunk entry.
    const events = laneV2.buildLaneRuntimeEventsV2(laneV2.createDefaultLaneStateV2());
    const topology = events.find((event) => event.endpointID === "laneTopology");
    assert.ok(topology.value.slotIds.length > 0);
    for (const encoded of topology.value.slotIds) {
        assert.equal(lane.decodeLaneBranchTag(encoded), 0);
    }
});

test("marker slots extend the chain slot domain above the device pool", async () => {
    const lane = await laneStatePromise;
    // Wire contract with EffectsRack.cmajor's laneParallelSlotBase /
    // laneSplitSlotBase: 40 device slots, then four parallel units, then
    // four split units. LaneSplit.cmajtest pins the engine side.
    assert.equal(lane.LANE_DEVICE_SLOT_COUNT, 40);
    assert.equal(lane.LANE_PARALLEL_UNIT_COUNT, 4);
    assert.equal(lane.LANE_SPLIT_UNIT_COUNT, 4);
    assert.equal(lane.LANE_PARALLEL_SLOT_BASE, 40);
    assert.equal(lane.LANE_SPLIT_SLOT_BASE, 44);
    assert.equal(lane.LANE_CHAIN_SLOT_COUNT, 48);
    assert.equal(lane.LANE_MAX_BANDS_PER_SPLIT, 3);
    assert.equal(lane.LANE_SPLIT_PARAM_XOVER_LOW_HZ, 0);
    assert.equal(lane.LANE_SPLIT_PARAM_XOVER_HIGH_HZ, 1);

    // A marker's band count rides the same tag encode as a device tag.
    assert.equal(lane.encodeLaneSlotWithBranchTag(lane.LANE_SPLIT_SLOT_BASE, 2), 44 | (2 << 8));

    assert.equal(lane.isLaneGroupMarkerSlot(39), false);
    assert.equal(lane.isLaneGroupMarkerSlot(40), true);
    assert.equal(lane.isLaneGroupMarkerSlot(47), true);
    assert.equal(lane.isLaneGroupMarkerSlot(48), false);
    assert.equal(lane.isLaneSplitMarkerSlot(43), false);
    assert.equal(lane.isLaneSplitMarkerSlot(44), true);
    assert.equal(lane.isLaneSplitMarkerSlot(48), false);
});
