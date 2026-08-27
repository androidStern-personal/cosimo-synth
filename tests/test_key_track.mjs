import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const keyTrackPromise = loadUIModule(repoRoot, "ui/shared/key-track.ts");

test("Key Track adds continuous semitone offsets before one frequency conversion", async () => {
    const keyTrack = await keyTrackPromise;
    const routeOffsets = [0.37, -0.12, 7.25];
    const summedOffset = 4.125 + routeOffsets.reduce((sum, value) => sum + value, 0);
    const expected = 440 * (2 ** (summedOffset / 12));

    assert.ok(Math.abs(keyTrack.trackedFrequencyHz(440, 4.125, routeOffsets) - expected) < 1e-9);
    assert.ok(Math.abs(keyTrack.trackedFrequencyHz(440, 0.5, []) - (440 * (2 ** (0.5 / 12)))) < 1e-9);
});

test("tracked delay and comb periods use the reciprocal pitch sign", async () => {
    const keyTrack = await keyTrackPromise;
    assert.ok(Math.abs(keyTrack.trackedPeriodMilliseconds(440, 12, []) - (1000 / 880)) < 1e-9);
    assert.ok(Math.abs(keyTrack.trackedPeriodMilliseconds(440, -12, []) - (1000 / 220)) < 1e-9);
    assert.ok(Math.abs(keyTrack.trackedPeriodMilliseconds(440, 0.25, [0.25])
        - ((1000 / 440) * (2 ** (-0.5 / 12)))) < 1e-9);
});

test("conversion clamps only after pitch conversion", async () => {
    const keyTrack = await keyTrackPromise;
    assert.equal(keyTrack.trackedFrequencyHz(20_000, 12, [], { min: 20, max: 20_000 }), 20_000);
    assert.equal(keyTrack.trackedPeriodMilliseconds(20, -48, [], { min: 0.2, max: 2_000 }), 800);
});

test("enabling centers the offset without touching the ordinary value", async () => {
    const keyTrack = await keyTrackPromise;
    const ordinary = 7_321.25;
    const enabled = keyTrack.enableKeyTrack({ enabled: false, ordinaryValue: ordinary, offsetSemitones: -7.5 });
    assert.deepEqual(enabled, { enabled: true, ordinaryValue: ordinary, offsetSemitones: 0 });

    const edited = { ...enabled, offsetSemitones: 3.375 };
    const disabled = keyTrack.disableKeyTrack(edited);
    assert.deepEqual(disabled, { enabled: false, ordinaryValue: ordinary, offsetSemitones: 3.375 });
    assert.equal(keyTrack.visibleKeyTrackValue(disabled), ordinary);

    const reenabled = keyTrack.enableKeyTrack(disabled);
    assert.deepEqual(reenabled, { enabled: true, ordinaryValue: ordinary, offsetSemitones: 0 });
    assert.equal(keyTrack.visibleKeyTrackValue(reenabled), 0);
});

test("each musical parameter family owns a documented continuous range", async () => {
    const keyTrack = await keyTrackPromise;
    const families = [
        "filter-frequency",
        "crossover-frequency",
        "ring-frequency",
        "phaser-frequency",
        "delay-period",
        "flanger-period",
        "resonator-frequency",
        "comb-period",
    ];
    const ranges = families.map((family) => keyTrack.requireKeyTrackRange(family));

    for (const range of ranges) {
        assert.equal(range.unit, "st");
        assert.equal(range.center, 0);
        assert.ok(range.knobMin < 0 && range.knobMax > 0);
        assert.ok(range.routeMin < 0 && range.routeMax > 0);
        assert.ok(range.step > 0 && range.step < 1, "offsets must remain continuous");
        assert.ok(range.reason.length > 20, "the musical limit needs an explicit rationale");
    }
    assert.ok(new Set(ranges.map(({ knobMin, knobMax }) => `${knobMin}:${knobMax}`)).size > 3);
});

test("the inventory contains every approved current control and no explicit exclusion", async () => {
    const keyTrack = await keyTrackPromise;
    const eligible = [
        "voice.filterCutoff",
        "lane.globalFilterCutoff",
        "lane.distortionWetHPHz",
        "lane.distortionWetLPHz",
        "lane.delayFilter",
        "lane.delayTime",
        "lane.phaserFrequency",
        "lane.chorusRingFrequencyHz",
        "lane.flangerBaseDelayMs",
        "lane.frequencySplitLowHz",
        "lane.frequencySplitHighHz",
    ];
    const excluded = [
        "lane.flangerRate",
        "lane.flangerFeedback",
        "lane.phaserRate",
        "voice.env1Attack",
        "voice.env1Decay",
        "voice.env1Release",
        "voice.mseg1Rate",
        "voice.glideTime",
        "lane.reverbSize",
        "lane.reverbDecay",
        "lane.ottTimePercent",
        "lane.delayFeedback",
    ];

    for (const id of eligible) {
        const definition = keyTrack.getKeyTrackDefinition(id);
        assert.notEqual(definition, null, `${id} must be eligible`);
        assert.equal(definition.buttonLabel, "Key Track");
        assert.equal(definition.initialEnabled, false);
    }
    for (const id of excluded) {
        assert.equal(keyTrack.getKeyTrackDefinition(id), null, `${id} must remain excluded`);
    }
    assert.deepEqual(keyTrack.KEY_TRACK_CURRENT_CONTROL_IDS, eligible);
});

test("Key Track exact entry is continuous semitones and cents", async () => {
    const keyTrack = await keyTrackPromise;
    const entry = await loadUIModule(repoRoot, "ui/shared/parameter-value-entry.ts");
    const spec = keyTrack.keyTrackOffsetEntrySpec("filter-frequency", entry.parameterEntrySpecForScalar);

    const semitones = entry.parseParameterEntry(spec, "3.125 st");
    assert.equal(semitones._tag, "accepted");
    assert.equal(semitones.commit.value, 3.125);

    const cents = entry.parseParameterEntry(spec, "37.5 ct");
    assert.equal(cents._tag, "accepted");
    assert.equal(cents.commit.value, 0.375);

    assert.equal(entry.parseParameterEntry(spec, "60 st")._tag, "accepted");
    const clamped = entry.parseParameterEntry(spec, "60.01 st");
    assert.equal(clamped._tag, "accepted");
    assert.equal(clamped.commit.value, 60);
    assert.equal(entry.parseParameterEntry(spec, "440 Hz")._tag, "rejected");
    assert.equal(entry.parseParameterEntry(spec, "25 ms")._tag, "rejected");
});

test("Key Track route entry presents legacy octave storage as continuous semitones", async () => {
    const entry = await loadUIModule(repoRoot, "ui/shared/parameter-value-entry.ts");
    const octaveBacked = entry.parameterEntrySpecForKeyTrackModulationAmount(
        "filter-frequency", "octaves");
    const semitoneBacked = entry.parameterEntrySpecForKeyTrackModulationAmount(
        "ring-frequency", "semitones");

    const octaveCents = entry.parseParameterEntry(octaveBacked, "37.5 ct");
    assert.equal(octaveCents._tag, "accepted");
    assert.equal(octaveCents.commit.value, 0.375 / 12);
    assert.equal(entry.formatParameterEntry(octaveBacked, 0.5).display, "6 st");

    const ringCents = entry.parseParameterEntry(semitoneBacked, "37.5 ct");
    assert.equal(ringCents._tag, "accepted");
    assert.equal(ringCents.commit.value, 0.375);
    assert.equal(entry.formatParameterEntry(semitoneBacked, 6).display, "6 st");
});

test("Key Track route presentation converts without changing canonical storage", async () => {
    const keyTrack = await keyTrackPromise;
    assert.equal(keyTrack.keyTrackRouteAmountToSemitones(0.5, "octaves"), 6);
    assert.equal(keyTrack.keyTrackRouteAmountFromSemitones(6, "octaves"), 0.5);
    assert.equal(keyTrack.keyTrackRouteAmountToSemitones(6, "semitones"), 6);
    assert.equal(keyTrack.keyTrackRouteAmountFromSemitones(6, "semitones"), 6);
});

test("lane records append Key Track fields without moving deployed parameter indexes", async () => {
    const slots = await loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts");

    assert.equal(slots.getLaneSlotParamIndex("globalFilter", "globalFilterCutoff"), 1);
    assert.equal(slots.getLaneSlotParamIndex("distortion", "distortionWetHPHz"), 4);
    assert.equal(slots.getLaneSlotParamIndex("distortion", "distortionWetLPHz"), 5);
    assert.equal(slots.getLaneSlotParamIndex("chorus", "chorusRingFineSemitones"), 7);
    assert.equal(slots.getLaneSlotParamIndex("flanger", "flangerRate"), 0);
    assert.equal(slots.getLaneSlotParamIndex("phaser", "phaserFrequency"), 4);
    assert.equal(slots.getLaneSlotParamIndex("delay", "delayTime"), 0);
    assert.equal(slots.getLaneSlotParamIndex("delay", "delayFilter"), 2);

    assert.equal(slots.getLaneSlotParamIndex("globalFilter", "globalFilterCutoffKeyTrackEnabled"), 4);
    assert.equal(slots.getLaneSlotParamIndex("chorus", "chorusRingFrequencyHz"), 8);
    assert.equal(slots.getLaneSlotParamIndex("flanger", "flangerBaseDelayMs"), 4);
    assert.equal(slots.getLaneSlotParamIndex("delay", "delayFilterKeyTrackOffsetSemitones"), 9);
    assert.equal(slots.LANE_SLOT_PARAM_COUNT, 11);
});

test("legacy lane records migrate Key Track off while preserving every ordinary value", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    const legacy = {
        format: "cosimo.lane",
        version: 2,
        devices: {
            "globalFilter#1": { params: {
                globalFilterMode: 1,
                globalFilterCutoff: 7_321.25,
                globalFilterResonance: 0.707107,
                globalFilterDrive: 0,
            } },
            "delay#1": { params: {
                delayTime: 123.456,
                delayFeedback: 0.35,
                delayFilter: 4_567.89,
                delayMix: 0.5,
                delayTimeMode: 1,
                delayDivision: 8,
            } },
        },
        chain: [
            { kind: "device", deviceId: "globalFilter#1", enabled: true },
            { kind: "device", deviceId: "delay#1", enabled: true },
        ],
    };

    const parsed = lane.parseLaneStateV2(legacy);
    assert.equal(parsed._tag, "ok");
    assert.equal(parsed.value.devices["globalFilter#1"].params.globalFilterCutoff, 7_321.25);
    assert.equal(parsed.value.devices["globalFilter#1"].params.globalFilterCutoffKeyTrackEnabled, 0);
    assert.equal(parsed.value.devices["globalFilter#1"].params.globalFilterCutoffKeyTrackOffsetSemitones, 0);
    assert.equal(parsed.value.devices["delay#1"].params.delayTime, 123.456);
    assert.equal(parsed.value.devices["delay#1"].params.delayFilter, 4_567.89);
    assert.equal(parsed.value.devices["delay#1"].params.delayTimeMode, 1);
    assert.equal(parsed.value.devices["delay#1"].params.delayTimeKeyTrackEnabled, 0);
    assert.equal(parsed.value.devices["delay#1"].params.delayFilterKeyTrackEnabled, 0);

    const reparsed = lane.parseLaneStateV2(lane.serializeLaneStateV2(parsed.value));
    assert.equal(reparsed._tag, "ok");
    assert.deepEqual(reparsed.value, parsed.value);
});

test("legacy Chorus Ring migrates to the same tracked pitch without changing route identity", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    const legacy = {
        format: "cosimo.lane",
        version: 2,
        devices: {
            "chorus#1": { params: {
                chorusMix: 0.5,
                chorusMotionMode: 1,
                chorusBloomMode: 0,
                chorusTone: 0.5,
                chorusFeedback: 0.42,
                chorusRingAmount: 0.8,
                chorusRingOffsetMode: 1,
                chorusRingFineSemitones: 0.75,
            } },
        },
        chain: [{ kind: "device", deviceId: "chorus#1", enabled: true }],
    };

    const parsed = lane.parseLaneStateV2(legacy);
    assert.equal(parsed._tag, "ok");
    const params = parsed.value.devices["chorus#1"].params;
    assert.equal(params.chorusRingFrequencyHz, 28);
    assert.equal(params.chorusRingKeyTrackEnabled, 1);
    assert.equal(params.chorusRingKeyTrackOffsetSemitones, -4.25);
    assert.equal(params.chorusRingFineSemitones, 0.75, "the deployed route/slot identity remains stored");
});

test("fresh lane devices start Key Track off and Flanger gets its new ordinary base delay", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    const flanger = lane.laneDefaultParamsForType("flanger");
    const chorus = lane.laneDefaultParamsForType("chorus");

    assert.equal(flanger.flangerBaseDelayMs, 0.6);
    assert.equal(flanger.flangerBaseDelayKeyTrackEnabled, 0);
    assert.equal(flanger.flangerBaseDelayKeyTrackOffsetSemitones, 0);
    assert.equal(chorus.chorusRingFrequencyHz, 28);
    assert.equal(chorus.chorusRingKeyTrackEnabled, 0);
    assert.equal(chorus.chorusRingKeyTrackOffsetSemitones, 0);
});

test("lane Key Track transitions preserve ordinary values and make Delay modes exclusive", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    let state = lane.upgradeLaneStateV1((await loadUIModule(repoRoot, "ui/shared/lane-state.ts")).createDefaultLaneState());
    state = lane.setLaneDeviceParam(state, "delay#1", "delayTime", 777);
    state = lane.setLaneDeviceParam(state, "delay#1", "delayTimeKeyTrackOffsetSemitones", 9.25);
    state = lane.setLaneKeyTrackEnabled(state, "delay#1", "delayTime", true);

    assert.equal(state.devices["delay#1"].params.delayTime, 777);
    assert.equal(state.devices["delay#1"].params.delayTimeKeyTrackEnabled, 1);
    assert.equal(state.devices["delay#1"].params.delayTimeKeyTrackOffsetSemitones, 0);
    assert.equal(state.devices["delay#1"].params.delayTimeMode, 0);

    state = lane.setLaneDeviceParam(state, "delay#1", "delayTimeKeyTrackOffsetSemitones", 3.125);
    state = lane.setLaneKeyTrackEnabled(state, "delay#1", "delayTime", false);
    assert.equal(state.devices["delay#1"].params.delayTime, 777);
    assert.equal(state.devices["delay#1"].params.delayTimeKeyTrackEnabled, 0);

    state = lane.setLaneKeyTrackEnabled(state, "delay#1", "delayTime", true);
    assert.equal(state.devices["delay#1"].params.delayTimeKeyTrackOffsetSemitones, 0);
    state = lane.setLaneDeviceParam(state, "delay#1", "delayTimeMode", 1);
    assert.equal(state.devices["delay#1"].params.delayTimeMode, 1);
    assert.equal(state.devices["delay#1"].params.delayTimeKeyTrackEnabled, 0);
});

test("frequency-split Key Track state migrates off and rides the marker record", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    const legacy = {
        format: "cosimo.lane",
        version: 2,
        devices: {
            "delay#1": { params: {
                delayTime: 375, delayFeedback: 0.35, delayFilter: 6_000,
                delayMix: 0.5, delayTimeMode: 0, delayDivision: 8,
            } },
        },
        chain: [{
            kind: "split",
            groupId: "split#1",
            enabled: true,
            xoverLowHz: 333,
            xoverHighHz: 3_333,
            branches: [[{ kind: "device", deviceId: "delay#1", enabled: true }], []],
        }],
    };
    const parsed = lane.parseLaneStateV2(legacy);
    assert.equal(parsed._tag, "ok");
    const split = parsed.value.chain[0];
    assert.equal(split.xoverLowHz, 333);
    assert.equal(split.xoverHighHz, 3_333);
    assert.equal(split.xoverLowKeyTrackEnabled, false);
    assert.equal(split.xoverLowKeyTrackOffsetSemitones, 0);
    assert.equal(split.xoverHighKeyTrackEnabled, false);
    assert.equal(split.xoverHighKeyTrackOffsetSemitones, 0);

    const runtime = lane.buildLaneRuntimeEventsV2(parsed.value);
    const marker = runtime.find((event) => event.value?.slotId === 44);
    assert.notEqual(marker, undefined);
    assert.deepEqual(marker.value.values.slice(0, 6), [333, 3_333, 0, 0, 0, 0]);
});

test("frequency-split Key Track transitions preserve ordinary crossovers", async () => {
    const lane = await loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
    const base = lane.createDefaultLaneStateV2();
    const splitState = lane.wrapLaneDeviceInGroup(base, "distortion#1", "split");
    assert.notEqual(splitState, null);
    const group = splitState.chain.find((node) => node.kind === "split");
    assert.notEqual(group, undefined);

    let state = lane.setLaneSplitCrossoverHz(splitState, group.groupId, "low", 321);
    state = lane.setLaneSplitKeyTrackOffset(state, group.groupId, "low", 8.75);
    state = lane.setLaneSplitKeyTrackEnabled(state, group.groupId, "low", true);
    let changed = state.chain.find((node) => node.kind === "split");
    assert.equal(changed.xoverLowHz, 321);
    assert.equal(changed.xoverLowKeyTrackEnabled, true);
    assert.equal(changed.xoverLowKeyTrackOffsetSemitones, 0);

    state = lane.setLaneSplitKeyTrackOffset(state, group.groupId, "low", 3.125);
    state = lane.setLaneSplitKeyTrackEnabled(state, group.groupId, "low", false);
    changed = state.chain.find((node) => node.kind === "split");
    assert.equal(changed.xoverLowHz, 321);
    assert.equal(changed.xoverLowKeyTrackEnabled, false);
    assert.equal(changed.xoverLowKeyTrackOffsetSemitones, 3.125);
});

test("both frequency-split crossovers have append-only modulation identities", async () => {
    const lanes = await loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts");
    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    const runtime = await loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
    const modulation = await loadUIModule(repoRoot, "ui/shared/modulation.ts");

    assert.equal(targets.getRackModulationTargetIndex(
        "lane.frequencySplit#1.xoverLowHz"), 37);
    assert.equal(targets.getRackModulationTargetIndex(
        "lane.frequencySplit#1.xoverHighHz"), 38);
    assert.equal(targets.MODULATION_RACK_TARGET_COUNT, 39);
    assert.equal(runtime.MODULATION_RACK_TARGET_TOTAL, 195);

    const fourthHigh = lanes.parseLaneModulationTargetKind(
        "lane.frequencySplit#4.xoverHighHz");
    assert.notEqual(fourthHigh, null);
    assert.equal(lanes.getLaneModulationTargetIndex(fourthHigh), (3 * 39) + 38);
    assert.deepEqual(
        modulation.getModulationAmountBounds("lane.frequencySplit#4.xoverHighHz"),
        { min: -4, max: 4, step: 0.01 },
    );

    const route = {
        id: "split-high", enabled: true, sourceKind: "mseg", sourceSlot: 1,
        polarity: "unipolar", targetKind: "lane.frequencySplit#4.xoverHighHz",
        amount: 0.5, reducer: "max",
    };
    assert.equal(runtime.getModulationRuntimeCell(route).targetIndex, (3 * 39) + 38);
});

test("the compiled source wires every current eligible control and no named exclusion", async () => {
    const [engine, chorus, flanger, desktop, ios] = await Promise.all([
        readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8"),
        readFile(path.join(repoRoot, "cmajor/Chorus.cmajor"), "utf8"),
        readFile(path.join(repoRoot, "cmajor/Flanger.cmajor"), "utf8"),
        readFile(path.join(repoRoot, "ui/desktop/effects-rack-workspace.tsx"), "utf8"),
        readFile(path.join(repoRoot, "ui/ios/IOSPatchView.tsx"), "utf8"),
    ]);

    for (const fragment of [
        "laneGlobalFilterParamCutoffKeyTrackEnabled",
        "laneDistortionParamWetHPKeyTrackEnabled",
        "laneDistortionParamWetLPKeyTrackEnabled",
        "laneDelayParamFilterKeyTrackEnabled",
        "laneDelayParamTimeKeyTrackEnabled",
        "lanePhaserParamFrequencyKeyTrackEnabled",
        "laneChorusParamRingKeyTrackEnabled",
        "laneFlangerParamBaseDelayKeyTrackEnabled",
        "laneSplitParamXoverLowKeyTrackEnabled",
        "laneSplitParamXoverHighKeyTrackEnabled",
    ]) {
        assert.match(engine, new RegExp(fragment));
    }
    assert.match(chorus, /resolveKeyTrackedFrequencyHz/);
    assert.match(flanger, /baseDelayMsIn/);
    assert.match(desktop, /data-role={`key-track-\$\{descriptor\.endpointID\}`}/);
    assert.match(desktop, /data-role={`key-track-frequencySplit-\$\{which\}-\$\{groupId\}`}/);
    assert.match(ios, /IOSDistortionTrackedFrequencyField/);
    assert.match(ios, />Key Track<\/button>/);

    for (const excludedFragment of [
        "laneFlangerParamRateKeyTrack",
        "laneFlangerParamFeedbackKeyTrack",
        "lanePhaserParamRateKeyTrack",
        "laneDelayParamFeedbackKeyTrack",
        "laneReverbParamSizeKeyTrack",
        "laneReverbParamDecayKeyTrack",
        "laneOttParamTimeKeyTrack",
    ]) {
        assert.doesNotMatch(engine, new RegExp(excludedFragment));
    }
});
