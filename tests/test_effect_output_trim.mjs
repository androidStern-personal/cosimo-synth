import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("every editable effect appends the same output-trim law and a new static modulation identity", async () => {
    const [catalog, trim] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
    ]);
    const expected = [
        ["filter", "globalFilterOutputTrimDb", 39],
        ["drive", "distortionOutputTrimDb", 40],
        ["ott", "ottOutputTrimDb", 41],
        ["chorus", "chorusOutputTrimDb", 42],
        ["flanger", "flangerOutputTrimDb", 43],
        ["phaser", "phaserOutputTrimDb", 44],
        ["delay", "delayOutputTrimDb", 45],
        ["reverb", "reverbOutputTrimDb", 46],
    ];

    for (const [effectId, endpointID, modulationTargetIndex] of expected) {
        const effect = catalog.getRackEffectDescriptor(effectId);
        const descriptor = effect.parameters.at(-1);
        assert.deepEqual({
            endpointID: descriptor.endpointID,
            label: descriptor.label,
            min: descriptor.min,
            max: descriptor.max,
            initial: descriptor.initial,
            unit: descriptor.unit,
            modulationTargetIndex: descriptor.modulationTargetIndex,
            modulationApplication: descriptor.modulationApplication,
            valueKind: descriptor.valueKind,
        }, {
            endpointID,
            label: "Output Trim",
            min: trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
            max: 35,
            initial: 0,
            unit: "dB",
            modulationTargetIndex,
            modulationApplication: "linear",
            valueKind: "effect-output-trim-db",
        });
    }

    assert.equal(trim.effectOutputTrimNormalizedValue(trim.EFFECT_OUTPUT_TRIM_SILENCE_DB), 0);
    assert.equal(trim.effectOutputTrimValueFromNormalized(0), trim.EFFECT_OUTPUT_TRIM_SILENCE_DB);
    assert.equal(trim.effectOutputTrimNormalizedValue(35), 1);
    assert.equal(trim.effectOutputTrimValueFromNormalized(1), 35);
    assert.ok(trim.effectOutputTrimNormalizedValue(-60) < 0.1,
        "the low tail must consume little travel so ordinary dB values retain precision");
    assert.ok(Math.abs(trim.effectOutputTrimValueFromNormalized(
        trim.effectOutputTrimNormalizedValue(0),
    )) < 1e-9);
    assert.equal(
        catalog.formatRackParameterValue(
            catalog.getRackParameterDescriptor("delayOutputTrimDb"),
            trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
        ),
        "−∞dB",
    );
});

test("lane state owns trim by effect-instance identity and full replay addresses the matching host parameter", async () => {
    const [trim, slotParams, laneState] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    const endpointByType = {
        globalFilter: "globalFilterOutputTrimDb",
        distortion: "distortionOutputTrimDb",
        ott: "ottOutputTrimDb",
        chorus: "chorusOutputTrimDb",
        flanger: "flangerOutputTrimDb",
        phaser: "phaserOutputTrimDb",
        delay: "delayOutputTrimDb",
        reverb: "reverbOutputTrimDb",
    };

    assert.equal(slotParams.LANE_SLOT_PARAM_COUNT, 13);
    for (const [deviceType, endpointID] of Object.entries(endpointByType)) {
        const endpoints = slotParams.laneDeviceParamEndpoints(deviceType);
        assert.equal(endpoints.at(-1), endpointID);
        assert.equal(slotParams.getLaneSlotParamIndex(deviceType, endpointID), endpoints.length - 1);
        assert.ok(endpoints.length <= slotParams.LANE_SLOT_PARAM_COUNT);
    }

    const hostEndpointIDs = trim.allEffectOutputTrimHostEndpointIDs();
    assert.equal(hostEndpointIDs.length, 40);
    assert.equal(new Set(hostEndpointIDs).size, 40);
    assert.equal(trim.effectOutputTrimHostEndpointID("globalFilter", 1), "laneGlobalFilter1OutputTrimDb");
    assert.equal(trim.effectOutputTrimHostEndpointID("reverb", 5), "laneReverb5OutputTrimDb");
    assert.deepEqual(trim.parseEffectOutputTrimHostEndpointID("laneDelay3OutputTrimDb"), {
        deviceType: "delay",
        instanceNumber: 3,
        laneEndpointID: "delayOutputTrimDb",
    });
    assert.equal(trim.parseEffectOutputTrimHostEndpointID("polishOutputTrimDb"), null);

    const initial = laneState.createDefaultLaneStateV2();
    for (const [deviceId, record] of Object.entries(initial.devices)) {
        const parsed = laneState.parseLaneInstanceId(deviceId);
        assert.equal(record.params[endpointByType[parsed.deviceType]], 0);
    }

    const edited = laneState.setLaneDeviceParam(initial, "delay#1", "delayOutputTrimDb", -12);
    assert.notEqual(edited, null);
    const moved = laneState.moveLaneDevice(edited, "delay#1", { kind: "trunk", index: 0 });
    assert.equal(moved.devices["delay#1"].params.delayOutputTrimDb, -12,
        "reordering must preserve the effect instance's trim");

    const replay = laneState.buildLaneRuntimeEventsV2(moved);
    assert.deepEqual(
        replay.filter(({ endpointID }) => hostEndpointIDs.includes(endpointID)),
        [
            { endpointID: "laneDistortion1OutputTrimDb", value: 0 },
            { endpointID: "laneDelay1OutputTrimDb", value: -12 },
            { endpointID: "laneReverb1OutputTrimDb", value: 0 },
        ],
    );

    const replaced = laneState.replaceLaneDevice(moved, "delay#1", "delay");
    assert.equal(replaced.devices["delay#1"].params.delayOutputTrimDb, 0,
        "same-type replacement is still a full reset");
    assert.deepEqual(
        laneState.parseLaneStateV2(laneState.serializeLaneStateV2(moved)),
        { _tag: "ok", value: moved },
    );

    const preT78 = JSON.parse(laneState.serializeLaneStateV2(initial));
    delete preT78.devices["delay#1"].params.delayOutputTrimDb;
    let preT78Result;
    assert.doesNotThrow(() => {
        preT78Result = laneState.parseLaneStateV2(preT78);
    }, "unsupported pre-T78 state must reject at the schema boundary, not throw mid-materialization");
    assert.equal(preT78Result._tag, "err", "T78 explicitly adds no old-preset compatibility path");
});

test("the sparse modulation program grows to 235 rack cells and executes only mapped trim routes", async () => {
    const [targets, lanes, runtime] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/modulation-targets.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
    ]);

    assert.equal(targets.MODULATION_RACK_TARGET_COUNT, 47);
    assert.equal(targets.MODULATION_LEGAL_PAIR_COUNT, 1484);
    assert.equal(targets.getRackModulationTargetIndex("lane.frequencySplit#1.xoverLowHz"), 37);
    assert.equal(targets.getRackModulationTargetIndex("lane.frequencySplit#1.xoverHighHz"), 38);
    assert.deepEqual(
        targets.RACK_MODULATION_TARGET_IDENTITIES.slice(39).map(({ kind, runtimeIndex }) => ({
            kind,
            runtimeIndex,
        })),
        [
            { kind: "lane.globalFilter#1.globalFilterOutputTrimDb", runtimeIndex: 39 },
            { kind: "lane.distortion#1.distortionOutputTrimDb", runtimeIndex: 40 },
            { kind: "lane.ott#1.ottOutputTrimDb", runtimeIndex: 41 },
            { kind: "lane.chorus#1.chorusOutputTrimDb", runtimeIndex: 42 },
            { kind: "lane.flanger#1.flangerOutputTrimDb", runtimeIndex: 43 },
            { kind: "lane.phaser#1.phaserOutputTrimDb", runtimeIndex: 44 },
            { kind: "lane.delay#1.delayOutputTrimDb", runtimeIndex: 45 },
            { kind: "lane.reverb#1.reverbOutputTrimDb", runtimeIndex: 46 },
        ],
    );

    const fifthReverb = lanes.parseLaneModulationTargetKind(
        "lane.reverb#5.reverbOutputTrimDb",
    );
    assert.notEqual(fifthReverb, null);
    assert.equal(lanes.getLaneModulationTargetIndex(fifthReverb), (4 * 47) + 46);
    assert.equal(runtime.MODULATION_RACK_TARGET_TOTAL, 235);
    assert.equal(
        (runtime.MODULATION_VOICE_SOURCE_COUNT + runtime.MODULATION_MACRO_SOURCE_COUNT)
            * (runtime.MODULATION_RACK_TARGET_TOTAL - 195) * Float32Array.BYTES_PER_ELEMENT,
        2240,
        "the fixed dense amount-table increase is exactly the specified 2.24 KB",
    );

    const empty = runtime.compileModulationRuntimeProgram([]);
    assert.equal(empty.voiceRackRouteCount, 0);
    assert.equal(empty.macroRackRouteCount, 0);
    assert.equal(empty.voiceRackRouteAmounts.length, runtime.MODULATION_VOICE_RACK_ROUTE_CELL_COUNT);
    assert.equal(empty.macroRackRouteAmounts.length, runtime.MODULATION_MACRO_RACK_ROUTE_CELL_COUNT);

    const route = {
        id: "trim-route",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "lane.reverb#5.reverbOutputTrimDb",
        amount: 6,
        reducer: "max",
    };
    const mapped = runtime.compileModulationRuntimeProgram([route]);
    assert.equal(mapped.voiceRackRouteCount, 1);
    assert.equal(mapped.voiceRackRouteTargets[0], 234);
    assert.equal(mapped.voiceRackRouteAmounts[mapped.voiceRackRouteCells[0]], 6);
    assert.equal(runtime.compileModulationRuntimeProgram([{ ...route, amount: 0 }]).voiceRackRouteCount, 0,
        "a zero-depth rack route retains no per-frame instruction");
});

test("host automation is reconciled into lane state and every UI projection preserves hard silence", async () => {
    const [trim, laneState, initState, targetBase, routePresentation, catalog] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-target-base.ts"),
        loadUIModule(repoRoot, "ui/shared/rack-route-presentation.ts"),
        loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
    ]);
    const initial = laneState.createDefaultLaneStateV2();
    const hostParameters = {
        laneDistortion1OutputTrimDb: 4.5,
        laneDelay1OutputTrimDb: -18,
        laneReverb1OutputTrimDb: trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
        polishOutputTrimDb: 7,
    };
    const synchronized = laneState.synchronizeLaneOutputTrimsFromHostParameters(
        initial,
        hostParameters,
    );
    assert.equal(synchronized.devices["distortion#1"].params.distortionOutputTrimDb, 4.5);
    assert.equal(synchronized.devices["delay#1"].params.delayOutputTrimDb, -18);
    assert.equal(
        synchronized.devices["reverb#1"].params.reverbOutputTrimDb,
        trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
    );
    assert.equal(Object.hasOwn(synchronized.devices["reverb#1"].params, "polishOutputTrimDb"), false);

    const transactionEvents = [];
    const transactionStoredWrites = [];
    const adapter = initState.createSynthRackInitStateAdapter({
        sendEventOrValue(endpointID, value) {
            transactionEvents.push({ endpointID, value });
        },
        sendStoredStateValue(key, value) {
            transactionStoredWrites.push({ key, value });
        },
    });
    const transactionContext = {
        parameters: hostParameters,
        storedState: { "lane.v1": laneState.serializeLaneStateV2(initial) },
    };
    assert.deepEqual(
        adapter.normalizeForTransaction(initial, transactionContext),
        synchronized,
        "preset/Init/URL transactions must replay the lane mirror from the host parameter authority",
    );
    assert.deepEqual(
        JSON.parse(adapter.serializeForTransaction(initial, transactionContext)),
        synchronized,
    );
    adapter.apply(initial, transactionContext);
    assert.deepEqual(
        transactionEvents.filter(({ endpointID }) => (
            trim.parseEffectOutputTrimHostEndpointID(endpointID) !== null
        )),
        [
            { endpointID: "laneDistortion1OutputTrimDb", value: 4.5 },
            { endpointID: "laneDelay1OutputTrimDb", value: -18 },
            { endpointID: "laneReverb1OutputTrimDb", value: trim.EFFECT_OUTPUT_TRIM_SILENCE_DB },
        ],
        "loading a preset or shared URL must install the matching real host parameters",
    );
    assert.deepEqual(JSON.parse(transactionStoredWrites[0].value), synchronized);

    assert.equal(
        trim.effectOutputTrimEffectiveDb(trim.EFFECT_OUTPUT_TRIM_SILENCE_DB, 35),
        trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
        "positive modulation cannot lift the hard-silence base endpoint",
    );
    assert.equal(trim.effectOutputTrimEffectiveDb(-99, -1), trim.EFFECT_OUTPUT_TRIM_SILENCE_DB);
    assert.equal(trim.effectOutputTrimEffectiveDb(34, 12), 35);

    const descriptor = catalog.getRackParameterDescriptor("delayOutputTrimDb");
    const travel = routePresentation.projectRackRouteTravel(
        descriptor,
        trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
        { amount: 35, polarity: "unipolar" },
    );
    assert.deepEqual(travel.values, [trim.EFFECT_OUTPUT_TRIM_SILENCE_DB, trim.EFFECT_OUTPUT_TRIM_SILENCE_DB]);
    assert.equal(travel.hasVisibleTravel, false);
    assert.equal(travel.nonzeroRouteFullyClipped, true);

    const base = targetBase.resolveModulationTargetBase("lane.delay#1.delayOutputTrimDb");
    assert.notEqual(base, null);
    assert.equal(
        base.railProjection.normalizeValue(-60),
        trim.effectOutputTrimNormalizedValue(-60),
    );
    assert.equal(
        base.railProjection.denormalizeValue(trim.effectOutputTrimNormalizedValue(-12)),
        -12,
    );
    const hardSilenceBand = base.railProjection.projectBand(
        base.railProjection.normalizeValue(trim.EFFECT_OUTPUT_TRIM_SILENCE_DB),
        { amount: 35, polarity: "unipolar" },
    );
    assert.equal(hardSilenceBand.lowNormalized, 0);
    assert.equal(hardSilenceBand.highNormalized, 0);
    assert.equal(hardSilenceBand.fullyClipped, true);
});

test("same-type replacement suppresses a delayed old host callback until reset acknowledgment", async () => {
    const [mirrorModule, laneState, trim] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effect-output-trim-host-mirror.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
    ]);
    const listeners = new Map();
    const requested = [];
    const sent = [];
    const connection = {
        addParameterListener(endpointID, listener) {
            listeners.set(endpointID, listener);
        },
        requestParameterValue(endpointID) {
            requested.push(endpointID);
        },
        sendEventOrValue(endpointID, value) {
            sent.push({ endpointID, value });
        },
    };
    let current = laneState.createDefaultLaneStateV2();
    const acceptedHostValues = [];
    const mirror = new mirrorModule.EffectOutputTrimHostMirror(connection, (endpointID, value) => {
        acceptedHostValues.push({ endpointID, value });
        current = laneState.synchronizeLaneOutputTrimsFromHostParameters(
            current,
            { [endpointID]: value },
        );
    });

    assert.equal(listeners.size, 40);
    assert.deepEqual(requested, trim.allEffectOutputTrimHostEndpointIDs());
    listeners.get("laneDelay1OutputTrimDb")(-21.5);
    assert.equal(current.devices["delay#1"].params.delayOutputTrimDb, -21.5);

    const reset = laneState.replaceLaneDevice(current, "delay#1", "delay");
    assert.equal(reset.devices["delay#1"].params.delayOutputTrimDb, 0);
    mirror.captureLaneState(reset);
    current = reset;
    laneState.commitLaneStateV2(connection, reset);
    assert.deepEqual(
        sent.filter(({ endpointID }) => endpointID === "laneDelay1OutputTrimDb"),
        [{ endpointID: "laneDelay1OutputTrimDb", value: 0 }],
    );

    acceptedHostValues.length = 0;
    listeners.get("laneDelay1OutputTrimDb")(-21.5);
    assert.equal(current.devices["delay#1"].params.delayOutputTrimDb, 0,
        "the delayed callback from the removed instance must not republish its trim");
    assert.deepEqual(acceptedHostValues, []);

    listeners.get("laneDelay1OutputTrimDb")(0);
    assert.deepEqual(acceptedHostValues, [
        { endpointID: "laneDelay1OutputTrimDb", value: 0 },
    ], "the reset echo acknowledges and closes the pending write");

    listeners.get("laneDelay1OutputTrimDb")(-7.25);
    assert.equal(current.devices["delay#1"].params.delayOutputTrimDb, -7.25,
        "later genuine DAW automation must be accepted after acknowledgment");

    const fractional = laneState.setLaneDeviceParam(
        current,
        "delay#1",
        "delayOutputTrimDb",
        0.135,
    );
    mirror.captureLaneState(fractional);
    current = fractional;
    listeners.get("laneDelay1OutputTrimDb")(Math.fround(0.135));
    listeners.get("laneDelay1OutputTrimDb")(-3.5);
    assert.equal(current.devices["delay#1"].params.delayOutputTrimDb, -3.5,
        "a float32-quantized acknowledgment must reopen genuine automation");

    listeners.get("laneReverb1OutputTrimDb")(0);
    listeners.get("laneReverb1OutputTrimDb")(-500);
    assert.equal(
        current.devices["reverb#1"].params.reverbOutputTrimDb,
        trim.EFFECT_OUTPUT_TRIM_SILENCE_DB,
    );
});

test("cross-type swap suppresses the replacement endpoint's stale callback until reset acknowledgment", async () => {
    const [mirrorModule, laneState] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effect-output-trim-host-mirror.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    const listeners = new Map();
    const sent = [];
    const connection = {
        addParameterListener(endpointID, listener) {
            listeners.set(endpointID, listener);
        },
        requestParameterValue() {},
        sendEventOrValue(endpointID, value) {
            sent.push({ endpointID, value });
        },
    };
    let current = laneState.createDefaultLaneStateV2();
    const acceptedHostValues = [];
    const mirror = new mirrorModule.EffectOutputTrimHostMirror(connection, (endpointID, value) => {
        acceptedHostValues.push({ endpointID, value });
        current = laneState.synchronizeLaneOutputTrimsFromHostParameters(
            current,
            { [endpointID]: value },
        );
    });

    listeners.get("laneFlanger1OutputTrimDb")(-16.5);
    assert.equal(current.devices["flanger#1"], undefined,
        "the resident host bank may retain a value while its effect type is absent");

    const swapped = laneState.replaceLaneDevice(current, "delay#1", "flanger");
    assert.notEqual(swapped, null);
    assert.equal(swapped.devices["flanger#1"].params.flangerOutputTrimDb, 0);
    mirror.captureLaneState(swapped);
    current = swapped;
    laneState.commitLaneStateV2(connection, swapped);
    assert.deepEqual(
        sent.filter(({ endpointID }) => endpointID === "laneFlanger1OutputTrimDb"),
        [{ endpointID: "laneFlanger1OutputTrimDb", value: 0 }],
    );

    acceptedHostValues.length = 0;
    listeners.get("laneFlanger1OutputTrimDb")(-16.5);
    assert.equal(current.devices["flanger#1"].params.flangerOutputTrimDb, 0);
    assert.deepEqual(acceptedHostValues, []);

    listeners.get("laneFlanger1OutputTrimDb")(0);
    assert.deepEqual(acceptedHostValues, [
        { endpointID: "laneFlanger1OutputTrimDb", value: 0 },
    ]);

    listeners.get("laneFlanger1OutputTrimDb")(5.75);
    assert.equal(current.devices["flanger#1"].params.flangerOutputTrimDb, 5.75,
        "genuine post-acknowledgment automation reaches the replacement instance");
});

test("live bindings use type-instance host gestures and the iPhone Distortion editor ends with Output Trim", async () => {
    const [bindingsSource, mirrorSource, synthHooksSource, iosSource] = await Promise.all([
        fs.readFile(path.join(repoRoot, "ui/shared/lane-param-bindings.ts"), "utf8"),
        fs.readFile(path.join(repoRoot, "ui/shared/effect-output-trim-host-mirror.ts"), "utf8"),
        fs.readFile(path.join(repoRoot, "ui/shared/synth-hooks.ts"), "utf8"),
        fs.readFile(path.join(repoRoot, "ui/ios/IOSPatchView.tsx"), "utf8"),
    ]);

    assert.match(bindingsSource, /effectOutputTrimHostEndpointID\([\s\S]*parsedDeviceId\.instanceNumber/);
    assert.match(bindingsSource, /active:\s*isOutputTrim/);
    assert.match(bindingsSource, /hostBinding\.setValue\(coerced\)/);
    assert.match(bindingsSource, /hostBinding\.beginGesture\(\)/);
    assert.match(bindingsSource, /hostBinding\.endGesture\(\)/);
    assert.match(mirrorSource, /allEffectOutputTrimHostEndpointIDs\(\)/);
    assert.match(bindingsSource, /scheduleOutputTrimPersist\(created\)/);

    assert.match(synthHooksSource, /distortionOutputTrim:\s*PatchControlBinding<number>/);
    assert.match(
        synthHooksSource,
        /const distortionOutputTrim = useLaneParameterBinding\(requireLaneParameterDescriptor\("distortionOutputTrimDb"\)\)/,
    );
    assert.match(iosSource, /data-role="distortion-output-trim-slider"/);
    assert.match(iosSource, /effectOutputTrimNormalizedValue\(outputTrimValue\)/);
    assert.match(iosSource, /effectOutputTrimValueFromNormalized\(Number\(event\.target\.value\)\)/);

    const panelStart = iosSource.indexOf("const IOSDistortionPanel");
    const panelEnd = iosSource.indexOf("const IOSMsegModal", panelStart);
    const panel = iosSource.slice(panelStart, panelEnd);
    assert.ok(
        panel.indexOf('data-role="distortion-output-trim-slider"')
            > panel.indexOf('role="distortion-wet-lp-slider"'),
        "Output Trim is the final Distortion control after Mix and wet filters",
    );
});
