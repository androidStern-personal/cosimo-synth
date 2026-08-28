import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneV1Promise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
const laneSlotParamsPromise = loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts");
const rackDescriptorsPromise = loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts");

const MIX_DEFAULT_CASES = [
    { effectId: "drive", deviceType: "distortion", endpointID: "distortionWet", expected: 0.5 },
    { effectId: "ott", deviceType: "ott", endpointID: "ottMix", expected: 50 },
    { effectId: "chorus", deviceType: "chorus", endpointID: "chorusMix", expected: 0.5 },
    { effectId: "flanger", deviceType: "flanger", endpointID: "flangerMix", expected: 0.5 },
    { effectId: "phaser", deviceType: "phaser", endpointID: "phaserMix", expected: 0.5 },
    { effectId: "delay", deviceType: "delay", endpointID: "delayMix", expected: 0.5 },
    { effectId: "reverb", deviceType: "reverb", endpointID: "reverbMix", expected: 0.5 },
];

// The document under test throughout: two delays chained in one parallel
// branch (the other branch EMPTY), then a trunk reverb — every structural
// concept v2 adds in one small tree.
async function makeParallelDoc() {
    const laneV1 = await laneV1Promise;
    const params = laneV1.createDefaultLaneState().params;
    return {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {
            "delay#1": { params: { ...params.delay } },
            "delay#2": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
        },
        chain: [
            {
                kind: "parallel",
                groupId: "parallel#1",
                enabled: true,
                branches: [
                    [
                        { kind: "device", deviceId: "delay#1", enabled: true },
                        { kind: "device", deviceId: "delay#2", enabled: false },
                    ],
                    [],
                ],
            },
            { kind: "device", deviceId: "reverb#1", enabled: true },
        ],
    };
}

async function makeSplitDoc() {
    const laneV1 = await laneV1Promise;
    const params = laneV1.createDefaultLaneState().params;
    return {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {
            "ott#1": { params: { ...params.ott } },
            "reverb#1": { params: { ...params.reverb } },
        },
        chain: [
            {
                kind: "split",
                groupId: "split#2",
                enabled: true,
                xoverLowHz: 250,
                xoverHighHz: 2500,
                branches: [
                    [{ kind: "device", deviceId: "ott#1", enabled: true }],
                    [],
                    [{ kind: "device", deviceId: "reverb#1", enabled: true }],
                ],
            },
        ],
    };
}

test("every Effects Lane mix creates and resets at 50% in state and audio-engine messages", async () => {
    const laneV2 = await laneV2Promise;
    const laneSlotParams = await laneSlotParamsPromise;
    const rackDescriptors = await rackDescriptorsPromise;

    const testedMixEndpoints = MIX_DEFAULT_CASES.map(({ endpointID }) => endpointID).sort();
    const actualMixEndpoints = rackDescriptors.allRackParameterDescriptors()
        .filter(({ label }) => label === "Mix")
        .map(({ endpointID }) => endpointID)
        .sort();
    assert.deepEqual(
        actualMixEndpoints,
        testedMixEndpoints,
        "Every main-synth Mix control must be included in this create/reset/audio test.",
    );

    let created = {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {},
        chain: [],
    };
    for (const testCase of MIX_DEFAULT_CASES) {
        created = laneV2.addLaneDevice(
            created,
            testCase.deviceType,
            { kind: "trunk", index: created.chain.length },
        );
        assert.notEqual(created, null, `${testCase.effectId} should fit in the lane`);

        const descriptor = rackDescriptors.getRackParameterDescriptor(testCase.endpointID);
        const deviceId = `${testCase.deviceType}#1`;
        assert.equal(descriptor.initial, testCase.expected);
        assert.equal(created.devices[deviceId].params[testCase.endpointID], testCase.expected);
        assert.equal(rackDescriptors.formatRackParameterValue(descriptor, testCase.expected), "50%");
    }

    const assertAudioEngineMixValues = (state, phase) => {
        const records = laneV2.buildLaneRuntimeEventsV2(state)
            .filter(({ endpointID }) => endpointID === "laneSlotParams");
        for (const testCase of MIX_DEFAULT_CASES) {
            const record = records.find(({ value }) => (
                value.slotId === laneSlotParams.getLaneSlotId(testCase.deviceType, 0)
            ));
            const paramIndex = laneSlotParams.getLaneSlotParamIndex(
                testCase.deviceType,
                testCase.endpointID,
            );
            assert.notEqual(record, undefined, `${phase}: ${testCase.effectId} record`);
            assert.notEqual(paramIndex, null, `${phase}: ${testCase.endpointID} wire index`);
            assert.equal(record.value.values[paramIndex], testCase.expected, `${phase}: ${testCase.endpointID}`);
        }
    };
    assertAudioEngineMixValues(created, "create");

    let reset = created;
    for (const testCase of MIX_DEFAULT_CASES) {
        const descriptor = rackDescriptors.getRackParameterDescriptor(testCase.endpointID);
        const deviceId = `${testCase.deviceType}#1`;
        reset = laneV2.setLaneDeviceParam(reset, deviceId, testCase.endpointID, descriptor.max);
        reset = laneV2.setLaneDeviceParam(reset, deviceId, testCase.endpointID, descriptor.initial);
        assert.equal(reset.devices[deviceId].params[testCase.endpointID], testCase.expected);
        assert.equal(
            rackDescriptors.formatRackParameterValue(
                descriptor,
                reset.devices[deviceId].params[testCase.endpointID],
            ),
            "50%",
        );
    }
    assertAudioEngineMixValues(reset, "reset");

    const explicitValues = Object.fromEntries(MIX_DEFAULT_CASES.map((testCase, index) => [
        testCase.endpointID,
        testCase.expected + ((index + 1) / 100),
    ]));
    const stored = {
        ...created,
        devices: Object.fromEntries(Object.entries(created.devices).map(([deviceId, record]) => {
            const testCase = MIX_DEFAULT_CASES.find(({ deviceType }) => deviceId === `${deviceType}#1`);
            assert.notEqual(testCase, undefined);
            return [deviceId, {
                params: {
                    ...record.params,
                    [testCase.endpointID]: explicitValues[testCase.endpointID],
                },
            }];
        })),
    };
    const restored = laneV2.deserializeLaneStateV2(JSON.stringify(stored));
    for (const testCase of MIX_DEFAULT_CASES) {
        assert.equal(
            restored.devices[`${testCase.deviceType}#1`].params[testCase.endpointID],
            explicitValues[testCase.endpointID],
            `stored ${testCase.endpointID} must not be replaced by its new default`,
        );
    }
});

test("lane.v2 default document is the compact starter trio and round-trips", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;

    const state = laneV2.createDefaultLaneStateV2();
    assert.equal(state.version, 2);
    // The starter set (M4): drive → delay → reverb, serial, ALL BYPASSED —
    // the out-of-box sound stays the deployed dry voice; the other five
    // types arrive through the map's add affordances. Stored v1 documents
    // still upgrade to their own full eight.
    assert.deepEqual(
        state.chain.map((node) => ({ kind: node.kind, deviceId: node.deviceId, enabled: node.enabled })),
        [
            { kind: "device", deviceId: "distortion#1", enabled: false },
            { kind: "device", deviceId: "delay#1", enabled: false },
            { kind: "device", deviceId: "reverb#1", enabled: false },
        ],
    );
    assert.deepEqual(
        Object.keys(state.devices).sort(),
        ["delay#1", "distortion#1", "reverb#1"],
    );
    // Params carry over from the v1 defaults verbatim, in wire order (the
    // byte-stability rule: the records match the legacy upgrade's exactly).
    assert.equal(state.devices["delay#1"].params.delayTime,
                 laneV1.createDefaultLaneState().params.delay.delayTime);
    const legacy = laneV2.upgradeLaneStateV1(laneV1.createDefaultLaneState());
    assert.deepEqual(state.devices["distortion#1"], legacy.devices["distortion#1"]);
    assert.deepEqual(state.devices["reverb#1"], legacy.devices["reverb#1"]);

    const reparsed = laneV2.parseLaneStateV2(laneV2.serializeLaneStateV2(state));
    assert.equal(reparsed._tag, "ok");
    assert.deepEqual(reparsed.value, state);
});

test("lane output defaults, strict parsing, editing, and runtime replay keep Mix independent from Bypass", async () => {
    const laneV2 = await laneV2Promise;
    const state = laneV2.createDefaultLaneStateV2();

    assert.deepEqual(state.output, { mix: 1, bypassed: false });

    const incompleteV2 = JSON.parse(laneV2.serializeLaneStateV2(state));
    delete incompleteV2.output;
    assert.equal(laneV2.parseLaneStateV2(incompleteV2)._tag, "err");

    const mixed = laneV2.setLaneOutputMix(state, 0.37);
    const bypassed = laneV2.setLaneOutputBypassed(mixed, true);
    assert.deepEqual(bypassed.output, { mix: 0.37, bypassed: true });
    assert.deepEqual(laneV2.setLaneOutputBypassed(bypassed, false).output,
                     { mix: 0.37, bypassed: false });
    assert.equal(laneV2.setLaneOutputMix(state, -0.01), null);
    assert.equal(laneV2.setLaneOutputMix(state, Number.NaN), null);

    const reparsed = laneV2.parseLaneStateV2(laneV2.serializeLaneStateV2(bypassed));
    assert.equal(reparsed._tag, "ok");
    assert.deepEqual(reparsed.value.output, { mix: 0.37, bypassed: true });
    assert.equal(laneV2.parseLaneStateV2({ ...reparsed.value, output: { mix: 1 } })._tag, "err");
    assert.equal(laneV2.parseLaneStateV2({ ...reparsed.value, output: { mix: 2, bypassed: false } })._tag, "err");
    assert.equal(laneV2.parseLaneStateV2({
        ...reparsed.value,
        output: { mix: 1, bypassed: false, unknown: true },
    })._tag, "err");

    const [outputEvent] = laneV2.buildLaneRuntimeEventsV2(bypassed);
    assert.deepEqual(outputEvent, {
        endpointID: "laneOutputControl",
        value: { mix: 0.37, bypassed: true },
    });
});

test("lane.v2 upgrades any v1 document, preserving order, enables, and params", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;

    const v1 = laneV1.createDefaultLaneState();
    const edited = {
        ...v1,
        order: [...v1.order].reverse(),
        enabled: { ...v1.enabled, drive: true, delay: true },
        params: { ...v1.params, delay: { ...v1.params.delay, delayTime: 125 } },
    };

    const upgraded = laneV2.upgradeLaneStateV1(edited);
    assert.equal(upgraded.version, 2);
    assert.deepEqual(
        upgraded.chain.map((node) => node.deviceId),
        ["reverb#1", "delay#1", "phaser#1", "flanger#1",
         "chorus#1", "ott#1", "distortion#1", "globalFilter#1"],
    );
    assert.equal(upgraded.chain.find((node) => node.deviceId === "delay#1").enabled, true);
    assert.equal(upgraded.chain.find((node) => node.deviceId === "reverb#1").enabled, false);
    assert.equal(upgraded.devices["delay#1"].params.delayTime, 125);

    // The deserializer takes v2, upgrades v1, and defaults for corrupt data.
    const fromV1Json = laneV2.deserializeLaneStateV2(laneV1.serializeLaneState(edited));
    assert.deepEqual(fromV1Json, upgraded);
    const fromV2Json = laneV2.deserializeLaneStateV2(laneV2.serializeLaneStateV2(upgraded));
    assert.deepEqual(fromV2Json, upgraded);
    assert.deepEqual(laneV2.deserializeLaneStateV2("{"), laneV2.createDefaultLaneStateV2());
    assert.deepEqual(laneV2.deserializeLaneStateV2(undefined), laneV2.createDefaultLaneStateV2());
});

test("lane.v2 validates and never coerces", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;
    const doc = await makeParallelDoc();
    const chorusParams = laneV1.createDefaultLaneState().params.chorus;

    const ok = laneV2.parseLaneStateV2(doc);
    assert.equal(ok._tag, "ok");

    const rejects = [
        // Unknown top-level field.
        { ...doc, extra: 1 },
        // Wrong version.
        { ...doc, version: 3 },
        // Device id grammar: unknown type, zero ordinal, beyond the pool.
        { ...doc, devices: { ...doc.devices, "wobble#1": { params: {} } } },
        { ...doc, devices: { ...doc.devices, "delay#0": doc.devices["delay#1"] } },
        { ...doc, devices: { ...doc.devices, "delay#6": doc.devices["delay#1"] } },
        // Params must be the type's complete vocabulary of finite numbers.
        { ...doc, devices: { ...doc.devices, "delay#1": { params: {} } } },
        { ...doc,
          devices: { ...doc.devices,
                     "delay#1": { params: { ...doc.devices["delay#1"].params, delayTime: "fast" } } } },
        { ...doc,
          devices: { ...doc.devices,
                     "delay#1": { params: { ...doc.devices["delay#1"].params, bonus: 1 } } } },
        // Placement referencing a device the table does not hold.
        { ...doc, chain: [...doc.chain, { kind: "device", deviceId: "chorus#1", enabled: true }] },
        // A device placed twice.
        { ...doc, chain: [...doc.chain, { kind: "device", deviceId: "reverb#1", enabled: true }] },
        // A device in the table but never placed.
        { ...doc, devices: { ...doc.devices, "chorus#1": { params: { ...chorusParams } } } },
        // Group fan-out bounds.
        { ...doc, chain: [{ ...doc.chain[0], branches: [doc.chain[0].branches[0]] }, doc.chain[1]] },
        { ...doc, chain: [{ ...doc.chain[0], branches: [[], [], [], [], []] }, doc.chain[1],
                          { kind: "device", deviceId: "delay#1", enabled: true },
                          { kind: "device", deviceId: "delay#2", enabled: false }] },
        // Nested groups are not representable on the wire.
        { ...doc, chain: [{ ...doc.chain[0],
                            branches: [[{ kind: "parallel", groupId: "parallel#2", enabled: true,
                                          branches: [[], []] }], []] },
                          doc.chain[1],
                          { kind: "device", deviceId: "delay#1", enabled: true },
                          { kind: "device", deviceId: "delay#2", enabled: false }] },
        // Group id grammar: unit range and kind mismatch.
        { ...doc, chain: [{ ...doc.chain[0], groupId: "parallel#5" }, doc.chain[1]] },
        { ...doc, chain: [{ ...doc.chain[0], groupId: "split#1" }, doc.chain[1]] },
    ];

    for (const [index, corrupt] of rejects.entries()) {
        assert.equal(laneV2.parseLaneStateV2(corrupt)._tag, "err", `reject case ${index}`);
    }
});

test("lane.v2 split groups validate band count and crossover range", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSplitDoc();

    assert.equal(laneV2.parseLaneStateV2(doc)._tag, "ok");

    const twoBand = {
        ...doc,
        devices: { "ott#1": doc.devices["ott#1"] },
        chain: [{ ...doc.chain[0],
                  branches: [doc.chain[0].branches[0], []] }],
    };
    assert.equal(laneV2.parseLaneStateV2(twoBand)._tag, "ok");

    const rejects = [
        // Four bands.
        { ...doc, chain: [{ ...doc.chain[0], branches: [...doc.chain[0].branches, []] }] },
        // One band.
        { ...twoBand, chain: [{ ...twoBand.chain[0], branches: [twoBand.chain[0].branches[0]] }] },
        // Crossovers outside the engine's 40..18000 clamp range, or not finite.
        { ...doc, chain: [{ ...doc.chain[0], xoverLowHz: 25000 }] },
        { ...doc, chain: [{ ...doc.chain[0], xoverHighHz: 10 }] },
        { ...doc, chain: [{ ...doc.chain[0], xoverLowHz: Number.NaN }] },
        // Split unit range.
        { ...doc, chain: [{ ...doc.chain[0], groupId: "split#5" }] },
    ];
    for (const [index, corrupt] of rejects.entries()) {
        assert.equal(laneV2.parseLaneStateV2(corrupt)._tag, "err", `split reject case ${index}`);
    }
});

test("lane.v2 caps the WIRE length: placements plus markers fit one topology upload", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;
    const params = laneV1.createDefaultLaneState().params;

    const devices = {};
    const trunk = [];
    const deviceIds = [
        "delay#1", "delay#2", "delay#3", "delay#4", "delay#5",
        "reverb#1", "reverb#2", "reverb#3", "reverb#4", "reverb#5",
        "chorus#1", "chorus#2", "chorus#3",
    ];
    for (const deviceId of deviceIds) {
        // These three types share their name between effect ids and lane types.
        const type = deviceId.slice(0, deviceId.indexOf("#"));
        devices[deviceId] = { params: { ...params[type] } };
        trunk.push({ kind: "device", deviceId, enabled: false });
    }
    const groups = [1, 2, 3, 4].map((n) => (
        { kind: "parallel", groupId: `parallel#${n}`, enabled: true, branches: [[], []] }
    ));

    // 13 placements + 4 markers = 17 wire entries: one too many.
    const overflowing = {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices,
        chain: [...trunk, ...groups],
    };
    assert.equal(laneV2.parseLaneStateV2(overflowing)._tag, "err");

    // Drop one device: 12 + 4 = 16 fits exactly.
    const fitting = {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: Object.fromEntries(Object.entries(devices).filter(([id]) => id !== "chorus#3")),
        chain: [...trunk.filter((node) => node.deviceId !== "chorus#3"), ...groups],
    };
    assert.equal(laneV2.parseLaneStateV2(fitting)._tag, "ok");
});

test("instances list in identity order and hold their slot ordinals by number", async () => {
    const laneV2 = await laneV2Promise;
    const parsed = laneV2.parseLaneStateV2(await makeParallelDoc());
    assert.equal(parsed._tag, "ok");

    // Identity order is type order then instance number — never chain order.
    assert.deepEqual(
        laneV2.listLaneDeviceInstancesV2(parsed.value),
        [
            { instanceId: "delay#1", deviceType: "delay" },
            { instanceId: "delay#2", deviceType: "delay" },
            { instanceId: "reverb#1", deviceType: "reverb" },
        ],
    );

    // Instance #n sits at ordinal n-1, statically — resolution needs no
    // document (pinned in test_modulation_lane_targets).
    assert.deepEqual(laneV2.parseLaneInstanceId("delay#2"),
                     { deviceType: "delay", instanceNumber: 2 });
});

test("the compiled wire matches lane.v1 exactly for an upgraded serial document", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;

    const v1 = laneV1.createDefaultLaneState();
    const edited = { ...v1, order: [...v1.order].reverse(), enabled: { ...v1.enabled, ott: true } };

    const v1Events = laneV1.buildLaneRuntimeEvents(edited);
    const v2Events = laneV2.buildLaneRuntimeEventsV2(laneV2.upgradeLaneStateV1(edited));

    // v2 adds the whole-lane output-control event; the legacy device records
    // and topology remain identical bit for bit.
    assert.deepEqual(v2Events[0], {
        endpointID: "laneOutputControl",
        value: { mix: 1, bypassed: false },
    });
    assert.equal(v2Events.length, v1Events.length + 1);
    assert.deepEqual(v2Events[v2Events.length - 1], v1Events[v1Events.length - 1]);
    for (const event of v2Events.slice(1, -1)) {
        assert.equal(event.endpointID, "laneSlotParams");
    }
    // Records cover the same slots with the same values (order may differ).
    const recordBySlot = (events) => new Map(
        events.filter((event) => event.endpointID === "laneSlotParams")
            .map((event) => [event.value.slotId, event.value.values]));
    assert.deepEqual(recordBySlot(v2Events), recordBySlot(v1Events));
});

test("groups compile to marker slots with branch tags, and the mirror validates them", async () => {
    const laneV2 = await laneV2Promise;

    const parallel = laneV2.parseLaneStateV2(await makeParallelDoc());
    assert.equal(parallel._tag, "ok");
    const topology = laneV2.compileLaneTopologyUpload(parallel.value);

    // marker(unit 0, N=2), delay#1@1, delay#2@1, reverb#1@trunk.
    assert.equal(topology.chainLength, 4);
    assert.deepEqual(topology.slotIds.slice(0, 4), [
        40 | (2 << 8),
        6 | (1 << 8),
        14 | (1 << 8),
        7,
    ]);
    // Marker enabled, delay#1 on, delay#2 off, reverb on.
    assert.equal(topology.enabledMask, 0b1011);
    assert.equal(laneV2.validateCompiledLaneTopology(topology), true);

    const split = laneV2.parseLaneStateV2(await makeSplitDoc());
    assert.equal(split._tag, "ok");
    const splitTopology = laneV2.compileLaneTopologyUpload(split.value);

    // split#2 -> unit 1 -> slot 45; ott in LO (tag 1), reverb in HI (tag 3),
    // the MID band empty — a representable skip.
    assert.equal(splitTopology.chainLength, 3);
    assert.deepEqual(splitTopology.slotIds.slice(0, 3), [
        45 | (3 << 8),
        2 | (1 << 8),
        7 | (3 << 8),
    ]);
    assert.equal(splitTopology.enabledMask, 0b111);
    assert.equal(laneV2.validateCompiledLaneTopology(splitTopology), true);

    // The runtime replay carries the split marker's crossover RECORD before
    // the topology, on the same record machinery as devices.
    const events = laneV2.buildLaneRuntimeEventsV2(split.value);
    assert.equal(events[events.length - 1].endpointID, "laneTopology");
    assert.deepEqual(events[events.length - 1].value, splitTopology);
    const markerRecord = events.find((event) => event.value.slotId === 45);
    assert.equal(markerRecord.endpointID, "laneSlotParams");
    assert.equal(markerRecord.value.values[0], 250);
    assert.equal(markerRecord.value.values[1], 2500);
    // Device records exist for pool ordinals beyond the base set.
    const parallelEvents = laneV2.buildLaneRuntimeEventsV2(parallel.value);
    assert.ok(parallelEvents.some((event) =>
        event.endpointID === "laneSlotParams" && event.value.slotId === 14));
});

test("the wire mirror rejects what the engine rejects", async () => {
    const laneV2 = await laneV2Promise;
    const good = laneV2.compileLaneTopologyUpload(
        laneV2.parseLaneStateV2(await makeParallelDoc()).value);

    const junkBit = { ...good, slotIds: [...good.slotIds] };
    junkBit.slotIds[1] |= 1 << 12;
    const memberWithoutGroup = { ...good, slotIds: [6 | (1 << 8), ...good.slotIds.slice(1)] };
    const oversizedMask = { ...good, enabledMask: good.enabledMask | (1 << good.chainLength) };
    const duplicateSlot = { ...good, slotIds: [...good.slotIds] };
    duplicateSlot.slotIds[3] = duplicateSlot.slotIds[2];

    for (const [index, broken] of [junkBit, memberWithoutGroup, oversizedMask, duplicateSlot].entries()) {
        assert.equal(laneV2.validateCompiledLaneTopology(broken), false, `mirror case ${index}`);
    }
});
