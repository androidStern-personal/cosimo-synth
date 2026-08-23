import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Effects Lane target kinds (M1 slice 3): `lane.<instanceId>.<endpointID>`
// names one pool device's parameter. Lane kinds are per-patch dynamic — they
// never join the static 1,131-pair domain — and they speak their device
// type's canonical modulation language (the base module's units and limits).

test("lane kind grammar accepts real device params and rejects everything else", async () => {
    const lanes = await loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts");
    const parsed = lanes.parseLaneModulationTargetKind("lane.delay#2.delayTime");
    assert.deepEqual(parsed, { instanceId: "delay#2", deviceType: "delay", endpointID: "delayTime" });
    // Instance #1 is the resident base device — the SAME grammar (the rack.*
    // namespace is deleted; there is one namespace for every device).
    assert.deepEqual(
        lanes.parseLaneModulationTargetKind("lane.delay#1.delayTime"),
        { instanceId: "delay#1", deviceType: "delay", endpointID: "delayTime" },
    );
    assert.equal(lanes.parseLaneModulationTargetKind("lane.delay#2.nope"), null);
    assert.equal(lanes.parseLaneModulationTargetKind("lane.chorus#1.delayTime"), null);
    assert.equal(lanes.parseLaneModulationTargetKind("lane.delay#0.delayTime"), null);
    assert.equal(lanes.parseLaneModulationTargetKind("lane.delay.delayTime"), null);
    assert.equal(lanes.parseLaneModulationTargetKind("rack.delayTime"), null);
});

test("assigned lane targets resolve by slot ordinal; unassigned resolve null", async () => {
    const lanes = await loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts");
    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    // Slot ordinals: 0 is the base block, 1.. are the pool sets. Bus index =
    // ordinal * static count + the mirror target's static index — derived on
    // both sides, so the engine and UI cannot drift.
    const assignments = new Map([["delay#1", 0], ["delay#2", 1]]);
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#1.delayTime"), assignments),
        targets.getRackModulationTargetIndex("lane.delay#1.delayTime"),
    );
    const timeIndex = lanes.getLaneModulationTargetIndex(
        lanes.parseLaneModulationTargetKind("lane.delay#2.delayTime"), assignments);
    const mixIndex = lanes.getLaneModulationTargetIndex(
        lanes.parseLaneModulationTargetKind("lane.delay#2.delayMix"), assignments);
    assert.equal(timeIndex,
        targets.MODULATION_RACK_TARGET_COUNT + targets.getRackModulationTargetIndex("lane.delay#1.delayTime"));
    assert.equal(mixIndex,
        targets.MODULATION_RACK_TARGET_COUNT + targets.getRackModulationTargetIndex("lane.delay#1.delayMix"));
    assert.equal(lanes.getLaneModulationTargetIndex(
        lanes.parseLaneModulationTargetKind("lane.delay#7.delayMix"), assignments), null);

    // The last pool set resolves; ordinals beyond the pool resolve to nothing.
    const lastSet = new Map([
        ["delay#9", lanes.MODULATION_LANE_POOL_SET_COUNT],
        ["delay#10", lanes.MODULATION_LANE_POOL_SET_COUNT + 1],
    ]);
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#9.delayMix"), lastSet),
        targets.MODULATION_RACK_TARGET_COUNT * lanes.MODULATION_LANE_POOL_SET_COUNT
            + targets.getRackModulationTargetIndex("lane.delay#1.delayMix"),
    );
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#10.delayMix"), lastSet),
        null,
    );
});

test("every device type's every pool endpoint parses, mirrors a real rack target, and resolves", async () => {
    const lanes = await loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts");
    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    const deviceEndpoints = {
        globalFilter: ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
        distortion: ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"],
        ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
        chorus: ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"],
        flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
        phaser: ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
        delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix"],
        reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"],
    };
    const seenIndices = new Set();
    for (const [deviceType, endpoints] of Object.entries(deviceEndpoints)) {
        const instanceId = `${deviceType}#3`;
        const assignments = new Map([[instanceId, 1]]);
        for (const endpointID of endpoints) {
            const kind = `lane.${instanceId}.${endpointID}`;
            const parsed = lanes.parseLaneModulationTargetKind(kind);
            assert.notEqual(parsed, null, kind);
            const index = lanes.getLaneModulationTargetIndex(parsed, assignments);
            assert.ok(
                index >= targets.MODULATION_RACK_TARGET_COUNT
                    && index < targets.MODULATION_RACK_TARGET_COUNT + lanes.MODULATION_LANE_POOL_TARGET_COUNT,
                `${kind} -> ${index}`,
            );
            assert.ok(!seenIndices.has(index), `duplicate pool index for ${kind}`);
            seenIndices.add(index);
        }
    }
    assert.equal(
        lanes.MODULATION_LANE_POOL_TARGET_COUNT,
        lanes.MODULATION_LANE_POOL_SET_COUNT * targets.MODULATION_RACK_TARGET_COUNT,
    );
});

test("lane params speak their device type's canonical modulation language", async () => {
    const modulation = await loadUIModule(repoRoot, "ui/shared/modulation.ts");
    // Limits, clamping, and readout formatting mirror the base delay exactly.
    assert.deepEqual(
        modulation.getModulationAmountBounds("lane.delay#2.delayTime"),
        modulation.getModulationAmountBounds("lane.delay#1.delayTime"),
    );
    assert.equal(
        modulation.clampModulationRouteAmount("lane.delay#2.delayFeedback", 99),
        modulation.clampModulationRouteAmount("lane.delay#1.delayFeedback", 99),
    );
    assert.equal(
        modulation.formatModulationAmountReadout("lane.delay#2.delayTime", 1.5, "unipolar"),
        modulation.formatModulationAmountReadout("lane.delay#1.delayTime", 1.5, "unipolar"),
    );
});

test("stored lane routes survive normalization with their kind intact", async () => {
    const modulation = await loadUIModule(repoRoot, "ui/shared/modulation.ts");
    const state = modulation.normalizeModulationState({
        routes: [{
            id: "lane-route-1",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "lane.delay#2.delayMix",
            amount: 0.4,
            reducer: "max",
        }],
    });
    assert.equal(state.routes.length, 1);
    assert.equal(state.routes[0].targetKind, "lane.delay#2.delayMix");
    // Garbage lane kinds fall back exactly like other unknown kinds do.
    const garbage = modulation.normalizeModulationState({
        routes: [{
            id: "bad", enabled: true, sourceKind: "mseg", sourceSlot: 1,
            polarity: "unipolar", targetKind: "lane.delay#2.zzz", amount: 0, reducer: "max",
        }],
    });
    assert.notEqual(garbage.routes[0].targetKind, "lane.delay#2.zzz");
});

test("the compiler places assigned lane routes in the pool block and drops unassigned ones", async () => {
    const program = await loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
    const route = {
        id: "lane-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1,
        polarity: "unipolar", targetKind: "lane.delay#2.delayMix", amount: 0.5, reducer: "max",
    };
    const assignments = new Map([["delay#2", 1]]);

    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    const compiled = program.compileModulationRuntimeProgram([route], assignments);
    assert.equal(compiled.voiceRackRouteCount, 1);
    const laneTargetIndex = targets.MODULATION_RACK_TARGET_COUNT
        + targets.getRackModulationTargetIndex("lane.delay#1.delayMix");
    assert.equal(compiled.voiceRackRouteTargets[0], laneTargetIndex);
    // Cell math runs at the TOTAL width on both sides of the wire.
    assert.equal(compiled.voiceRackRouteCells[0] % program.MODULATION_RACK_TARGET_TOTAL, laneTargetIndex);

    const dropped = program.compileModulationRuntimeProgram([route]);
    assert.equal(dropped.voiceRackRouteCount, 0);

    // The wire shape: the per-CELL tables are sources x TOTAL (the engine's
    // rackModTargetCount = 180: static vocabulary + its full pool mirror).
    assert.equal(program.MODULATION_RACK_TARGET_TOTAL, 180);
    assert.equal(
        program.MODULATION_VOICE_RACK_ROUTE_CELL_COUNT,
        program.MODULATION_VOICE_SOURCE_COUNT * program.MODULATION_RACK_TARGET_TOTAL,
    );
});

test("base rack routes are untouched by the widening", async () => {
    const program = await loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
    const route = {
        id: "rack-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1,
        polarity: "unipolar", targetKind: "lane.delay#1.delayMix", amount: 0.5, reducer: "max",
    };
    const compiled = program.compileModulationRuntimeProgram([route]);
    assert.equal(compiled.voiceRackRouteCount, 1);
    const targetIndex = compiled.voiceRackRouteTargets[0];
    assert.ok(targetIndex < 36, `base target leaked into the pool block: ${targetIndex}`);
    assert.equal(compiled.voiceRackRouteCells[0] % program.MODULATION_RACK_TARGET_TOTAL, targetIndex);
});
