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

test("lane targets resolve STATICALLY: instance #n is slot ordinal n-1", async () => {
    const lanes = await loadUIModule(repoRoot, "ui/shared/lane-modulation-targets.ts");
    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    // Identity IS the assignment (the lane.v2 document allocates the same
    // way): bus index = (n-1) * static count + the mirror target's static
    // index — derived on both sides, so the engine and UI cannot drift, and
    // resolution needs no document.
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#1.delayTime")),
        targets.getRackModulationTargetIndex("lane.delay#1.delayTime"),
    );
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#2.delayTime")),
        targets.MODULATION_RACK_TARGET_COUNT + targets.getRackModulationTargetIndex("lane.delay#1.delayTime"));
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#2.delayMix")),
        targets.MODULATION_RACK_TARGET_COUNT + targets.getRackModulationTargetIndex("lane.delay#1.delayMix"));

    // The last pool set resolves; instance numbers beyond the pool resolve
    // to nothing (the route stays stored, compiles to nothing).
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#5.delayMix")),
        targets.MODULATION_RACK_TARGET_COUNT * lanes.MODULATION_LANE_POOL_SET_COUNT
            + targets.getRackModulationTargetIndex("lane.delay#1.delayMix"),
    );
    assert.equal(
        lanes.getLaneModulationTargetIndex(
            lanes.parseLaneModulationTargetKind("lane.delay#6.delayMix")),
        null,
    );
    assert.equal(lanes.getLaneModulationTargetIndex(null), null);
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
        for (const endpointID of endpoints) {
            const kind = `lane.${instanceId}.${endpointID}`;
            const parsed = lanes.parseLaneModulationTargetKind(kind);
            assert.notEqual(parsed, null, kind);
            const index = lanes.getLaneModulationTargetIndex(parsed);
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

test("the compiler places lane routes in the pool block statically and drops out-of-pool ones", async () => {
    const program = await loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
    const route = {
        id: "lane-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1,
        polarity: "unipolar", targetKind: "lane.delay#2.delayMix", amount: 0.5, reducer: "max",
    };

    const targets = await loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
    const compiled = program.compileModulationRuntimeProgram([route]);
    assert.equal(compiled.voiceRackRouteCount, 1);
    const laneTargetIndex = targets.MODULATION_RACK_TARGET_COUNT
        + targets.getRackModulationTargetIndex("lane.delay#1.delayMix");
    assert.equal(compiled.voiceRackRouteTargets[0], laneTargetIndex);
    // Cell math runs at the TOTAL width on both sides of the wire.
    assert.equal(compiled.voiceRackRouteCells[0] % program.MODULATION_RACK_TARGET_TOTAL, laneTargetIndex);

    // An instance number beyond the pool never reaches the program.
    const dropped = program.compileModulationRuntimeProgram([
        { ...route, targetKind: "lane.delay#6.delayMix" },
    ]);
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

// The dynamic target domain (M2b): every display and editing authority is
// TOTAL over the lane grammar. A pool instance speaks its device type's
// canonical language and is labeled by its instance number; instance #1
// keeps today's resident labels exactly.

test("pool instances are display-labeled by instance number; instance #1 keeps its resident label", async () => {
    const descriptors = await loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

    assert.equal(descriptors.getModulationTargetDisplayLabel("lane.delay#1.delayFeedback"), "DELAY FEEDBACK");
    assert.equal(descriptors.getModulationTargetDisplayLabel("lane.delay#2.delayFeedback"), "DELAY 2 FEEDBACK");
    assert.equal(descriptors.getModulationTargetDisplayLabel("lane.globalFilter#3.globalFilterCutoff"), "FILTER 3 CUTOFF");
    // The lane grammar speaks the DEVICE type ("distortion"); the display
    // authority is the catalog module ("drive") — same split as instance #1.
    assert.equal(descriptors.getModulationTargetDisplayLabel("lane.distortion#2.distortionWet"), "DRIVE 2 MIX");

    // The table/list presentation splits the same authority into category and
    // parameter; pool instances gain the number on the category side.
    assert.deepEqual(
        descriptors.getModulationTargetPresentation("lane.delay#1.delayFeedback"),
        { category: "Delay", parameter: "Feedback" },
    );
    assert.deepEqual(
        descriptors.getModulationTargetPresentation("lane.delay#2.delayFeedback"),
        { category: "Delay 2", parameter: "Feedback" },
    );
    assert.deepEqual(
        descriptors.getModulationTargetPresentation("lane.globalFilter#1.globalFilterCutoff"),
        { category: "Global Filter", parameter: "Cutoff" },
    );
    assert.deepEqual(
        descriptors.getModulationTargetPresentation("lane.globalFilter#4.globalFilterCutoff"),
        { category: "Global Filter 4", parameter: "Cutoff" },
    );
    assert.deepEqual(
        descriptors.getModulationTargetPresentation("oscA.pan"),
        { category: "Voice", parameter: "A PAN" },
    );
});

test("amount editing authorities defer to the type's #1 language for pool instances", async () => {
    const entry = await loadUIModule(repoRoot, "ui/shared/parameter-value-entry.ts");
    const modulation = await loadUIModule(repoRoot, "ui/shared/modulation.ts");

    // Exact-entry amount specs: identical for #2 and #1, log and linear alike.
    assert.deepEqual(
        entry.parameterEntrySpecForModulationAmount("lane.delay#2.delayTime", 375),
        entry.parameterEntrySpecForModulationAmount("lane.delay#1.delayTime", 375),
    );
    assert.deepEqual(
        entry.parameterEntrySpecForModulationAmount("lane.reverb#4.reverbMix", 0),
        entry.parameterEntrySpecForModulationAmount("lane.reverb#1.reverbMix", 0),
    );

    // The log-anchor base binding spec resolves through the mirror: an octave
    // target needs one, a linear target deliberately has none.
    const poolBaseSpec = entry.modulationAmountBaseBindingSpec("lane.delay#2.delayTime");
    const residentBaseSpec = entry.modulationAmountBaseBindingSpec("lane.delay#1.delayTime");
    assert.notEqual(residentBaseSpec, null);
    assert.deepEqual(poolBaseSpec, residentBaseSpec);
    assert.equal(entry.modulationAmountBaseBindingSpec("lane.reverb#2.reverbMix"), null);

    const poolHint = modulation.getModulationTargetClampHint("lane.delay#2.delayTime");
    assert.equal(poolHint, modulation.getModulationTargetClampHint("lane.delay#1.delayTime"));
    assert.ok(poolHint.length > 0);
});

test("no lane route carries a per-note articulation cell — pool routes included, without slot resolution", async () => {
    // Regression pin: a stored pool route used to CRASH the whole patch view
    // through this call — currentArticulationRouteIds asked for the route's
    // articulation cell, cell resolution needed a slot the patch could not
    // provide, and the throw took down DesktopPatchViewBody at mount.
    const program = await loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
    const laneRoute = (targetKind) => ({
        id: "articulation-probe", enabled: true, sourceKind: "mseg", sourceSlot: 1,
        polarity: "unipolar", targetKind, amount: 0.4, reducer: "max",
    });
    assert.equal(program.getModulationArticulationCellIndex(laneRoute("lane.delay#2.delayMix")), null);
    assert.equal(program.getModulationArticulationCellIndex(laneRoute("lane.delay#1.delayMix")), null);
    assert.notEqual(program.getModulationArticulationCellIndex(laneRoute("oscA.pan")), null);
});

test("every pool instance's base resolves the type's editing contract", async () => {
    const resolver = await loadUIModule(repoRoot, "ui/shared/modulation-target-base.ts");
    // T6: the lane.v2 document has a real slot for every instance, so the
    // base contract (endpoint, spec, labels) is the TYPE's; WHICH document
    // slot a binding edits comes from the deviceId its caller threads.
    const second = resolver.resolveModulationTargetBase("lane.delay#2.delayMix");
    const first = resolver.resolveModulationTargetBase("lane.delay#1.delayMix");
    assert.notEqual(first, null);
    assert.notEqual(second, null);
    assert.equal(second.endpointID, first.endpointID);
    assert.equal(second.label, first.label);
    assert.deepEqual(second.entrySpec, first.entrySpec);
});

test("the per-patch target domain is the static core plus one entry per live lane device parameter", async () => {
    const laneState = await loadUIModule(repoRoot, "ui/shared/lane-state.ts");
    const modulation = await loadUIModule(repoRoot, "ui/shared/modulation.ts");

    // The resident device set: one instance-#1 device per type, in the stable
    // identity order (never the chain order — reordering the chain must not
    // reshuffle pickers).
    const resident = laneState.listLaneDeviceInstances(laneState.createDefaultLaneState());
    assert.deepEqual(resident, [
        { instanceId: "globalFilter#1", deviceType: "globalFilter" },
        { instanceId: "distortion#1", deviceType: "distortion" },
        { instanceId: "ott#1", deviceType: "ott" },
        { instanceId: "chorus#1", deviceType: "chorus" },
        { instanceId: "flanger#1", deviceType: "flanger" },
        { instanceId: "phaser#1", deviceType: "phaser" },
        { instanceId: "delay#1", deviceType: "delay" },
        { instanceId: "reverb#1", deviceType: "reverb" },
    ]);

    // The resident set reproduces the static option list EXACTLY — the
    // default patch's pickers cannot change under the dynamic domain.
    assert.deepEqual(
        modulation.buildPatchModulationTargetOptions(resident),
        modulation.MODULATION_TARGET_OPTIONS,
    );

    // A live pool device appends its parameters, instance-labeled, in the
    // catalog's endpoint order.
    const withPoolDelay = modulation.buildPatchModulationTargetOptions([
        ...resident,
        { instanceId: "delay#2", deviceType: "delay" },
    ]);
    assert.equal(withPoolDelay.length, modulation.MODULATION_TARGET_OPTIONS.length + 4);
    assert.deepEqual(withPoolDelay.slice(0, modulation.MODULATION_TARGET_OPTIONS.length), modulation.MODULATION_TARGET_OPTIONS);
    assert.deepEqual(withPoolDelay.slice(-4), [
        { value: "lane.delay#2.delayTime", label: "DELAY 2 TIME" },
        { value: "lane.delay#2.delayFeedback", label: "DELAY 2 FEEDBACK" },
        { value: "lane.delay#2.delayFilter", label: "DELAY 2 FILTER" },
        { value: "lane.delay#2.delayMix", label: "DELAY 2 MIX" },
    ]);
});
