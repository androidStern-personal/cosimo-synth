import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadUIModule } from "./load_ui_module.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function loadSpeedrunModules() {
    const [
        patchIO,
        analyzer,
        recipe,
        partialStates,
        timeline,
        contractModule,
        modulationModule,
        articulationModule,
    ] = await Promise.all([
        loadUIModule(repoRoot, "ui/speedrun/patch-io.ts"),
        loadUIModule(repoRoot, "ui/speedrun/analyzer.ts"),
        loadUIModule(repoRoot, "ui/speedrun/recipe.ts"),
        loadUIModule(repoRoot, "ui/speedrun/partial-states.ts"),
        loadUIModule(repoRoot, "ui/speedrun/timeline.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
    ]);
    return {
        patchIO,
        analyzer,
        recipe,
        partialStates,
        timeline,
        contractModule,
        modulationModule,
        articulationModule,
    };
}

export async function createCurrentSpeedrunContext() {
    const performerURL = pathToFileURL(path.join(repoRoot, "build/web/cmaj_Cosimo_Synth.offline.js"));
    performerURL.searchParams.set("test", String(Date.now()));
    const { default: Synth } = await import(performerURL.href);
    const inputEndpoints = Synth.prototype.getInputEndpoints();
    const visibleParameters = inputEndpoints.filter((endpoint) => (
        endpoint.purpose === "parameter" && endpoint.annotation?.hidden !== true
    ));
    const { contractModule, patchIO } = await loadSpeedrunModules();
    const currentContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: visibleParameters,
        storedState: [
            { key: "modulation.v6", schemaVersion: 6, required: true },
            { key: "articulations.v4", schemaVersion: 4, required: true },
            { key: "bounce.v1", schemaVersion: 1, required: true },
        ],
    });
    const options = { currentContract, inputEndpoints };
    return {
        options,
        defaults: patchIO.createDefaultsSnapshot(options),
        inputEndpoints,
    };
}

export async function readSpeedrunFixture(name) {
    return JSON.parse(await fs.readFile(
        path.join(repoRoot, "tests/fixtures/speedrun", name),
        "utf8",
    ));
}

export async function readFactoryCatalog() {
    return JSON.parse(await fs.readFile(
        path.join(repoRoot, "assets/factory-bank-catalog.json"),
        "utf8",
    ));
}

export function barePatchFromDefaults(defaults, overrides = {}) {
    return {
        label: overrides.label ?? "Speedrun Fixture",
        parameters: { ...defaults.parameters, ...overrides.parameters },
        storedState: {
            "modulation.v6": overrides.modulation ?? defaults.modulation,
            "articulations.v4": overrides.articulations ?? defaults.articulations,
            "bounce.v1": overrides.bounce ?? null,
            "lane.v1": overrides.lane ?? defaults.lane,
        },
    };
}

/** The largest current-contract sound: every public control moved, every
    legal modulation pair stored and active, and one enabled instance of all
    eight lane device types. This is generated from the live contract so it
    drifts loudly instead of becoming a stale fixture. */
export async function buildMaximalCurrentSpeedrunPatch() {
    const [context, lane, laneV1, modulationTargets, rack] = await Promise.all([
        createCurrentSpeedrunContext(),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-targets.ts"),
        loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
    ]);

    let laneState = lane.createDefaultLaneStateV2();
    laneState = {
        ...laneState,
        chain: laneState.chain.map((node) => ({ ...node, enabled: true })),
    };
    for (const deviceType of lane.LANE_DEVICE_TYPE_ORDER) {
        if (Object.keys(laneState.devices).some((deviceId) => deviceId.startsWith(`${deviceType}#`))) {
            continue;
        }
        const next = lane.addLaneDevice(laneState, deviceType, {
            kind: "trunk",
            index: laneState.chain.length,
        });
        if (next === null) throw new Error(`Could not add maximal-patch device ${deviceType}.`);
        laneState = next;
    }
    laneState = {
        ...laneState,
        devices: Object.fromEntries(Object.entries(laneState.devices).map(([deviceId, record]) => {
            const parsed = lane.parseLaneInstanceId(deviceId);
            if (parsed === null) throw new Error(`Invalid maximal-patch device ${deviceId}.`);
            const effectId = laneV1.LANE_TYPE_TO_EFFECT_ID.get(parsed.deviceType);
            if (effectId === undefined) throw new Error(`No effect identity for ${parsed.deviceType}.`);
            const descriptors = rack.getRackEffectDescriptor(effectId).parameters;
            return [deviceId, {
                params: Object.fromEntries(Object.entries(record.params).map(([endpointID, initial]) => {
                    const descriptor = descriptors.find((candidate) => candidate.endpointID === endpointID);
                    if (descriptor === undefined) throw new Error(`No descriptor for ${deviceId}.${endpointID}.`);
                    const value = Math.abs(descriptor.max - initial) >= Math.abs(initial - descriptor.min)
                        ? descriptor.max
                        : descriptor.min;
                    return [endpointID, value];
                })),
            }];
        })),
    };

    const parameters = { ...context.defaults.parameters };
    for (const annotation of Object.values(context.defaults.annotations)) {
        if (annotation.endpointID === "sourceMode" || /(?:Mute|Solo)$/u.test(annotation.endpointID)) continue;
        const endpoints = [annotation.min, annotation.max]
            .filter((value) => typeof value === "number");
        if (endpoints.length === 0) continue;
        parameters[annotation.endpointID] = endpoints.sort((left, right) => (
            Math.abs(right - annotation.defaultValue) - Math.abs(left - annotation.defaultValue)
        ))[0];
    }
    for (const oscillatorId of ["A", "B", "C"]) {
        parameters[`osc${oscillatorId}Mute`] = 0;
        parameters[`osc${oscillatorId}Solo`] = 0;
        parameters[`osc${oscillatorId}VolumeDb`] = context.defaults.annotations[`osc${oscillatorId}VolumeDb`].max;
    }
    for (const endpointID of ["ampGainDb", "filterCutoff", "filterMix"]) {
        const maximum = context.defaults.annotations[endpointID]?.max;
        if (maximum !== null && maximum !== undefined) parameters[endpointID] = maximum;
    }

    const routes = modulationTargets.MODULATION_SOURCE_IDENTITIES.flatMap((source) => (
        modulationTargets.MODULATION_TARGET_IDENTITIES.map((target, targetIndex) => ({
            id: `max-${source.id}-${targetIndex}`,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: "bipolar",
            targetKind: target.kind,
            amount: 0.5,
            reducer: "max",
        }))
    ));

    return {
        patch: barePatchFromDefaults(context.defaults, {
            label: "Maximum Current Contract",
            parameters,
            lane: laneState,
            modulation: { ...context.defaults.modulation, routes },
        }),
        expected: {
            parameterCount: Object.keys(parameters).length,
            routeCount: modulationTargets.MODULATION_LEGAL_PAIR_COUNT,
            effectCount: lane.LANE_DEVICE_TYPE_ORDER.length,
            oscillatorCount: 3,
            sourceCount: modulationTargets.MODULATION_SOURCE_COUNT,
        },
    };
}

export function canonicalRoutes(routes) {
    return [...routes]
        .map((route) => ({ ...route }))
        .sort((left, right) => left.id.localeCompare(right.id));
}

/** Stable, current-contract fixture used by analyzer, golden, and timeline tests. */
export async function buildGoldenSpeedrunPipeline() {
    const [modules, context, lane, catalog] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
        readFactoryCatalog(),
    ]);
    const modulation = {
        ...context.defaults.modulation,
        envelopeSlots: context.defaults.modulation.envelopeSlots.map((slot, index) => (
            index === 0 ? { name: "Pluck" } : slot
        )),
        macroNames: context.defaults.modulation.macroNames.map((name, index) => (
            index === 1 ? "Space" : name
        )),
        routes: [
            {
                id: "route-env-filter",
                enabled: true,
                sourceKind: "env",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "filterCutoffOctaves",
                amount: 2.25,
                reducer: "max",
            },
            {
                id: "route-macro-delay-2",
                enabled: true,
                sourceKind: "macro",
                sourceSlot: 2,
                polarity: "bipolar",
                targetKind: "lane.delay#2.delayMix",
                amount: 0.24,
                reducer: "mean",
            },
            {
                id: "route-inert-muted-b",
                enabled: false,
                sourceKind: "mseg",
                sourceSlot: 3,
                polarity: "unipolar",
                targetKind: "oscB.warpAmount",
                amount: 0.5,
                reducer: "max",
            },
        ],
    };
    const bare = barePatchFromDefaults(context.defaults, {
        label: "Split Space Lead",
        lane,
        modulation,
        parameters: {
            oscAWavetableSelect: 12,
            oscAWavetablePosition: 0.43,
            oscAWarpMode: 2,
            oscAWarpAmount: 0.38,
            oscBMute: 1,
            oscCMute: 1,
            filterCutoff: 720,
            env1Attack: 0.035,
            env1Decay: 0.18,
            macro2: 0.72,
            ampRelease: 0.44,
        },
    });
    const intake = modules.patchIO.intakePatch(bare, context.options);
    if (!intake.ok) throw intake.error;
    const analysis = modules.analyzer.analyzePatch(intake.value.document, intake.value.defaults);
    const recipe = modules.recipe.compileRecipe(
        analysis,
        intake.value.document,
        intake.value.defaults,
        catalog,
    );
    return {
        ...modules,
        ...context,
        document: intake.value.document,
        analysis,
        recipe,
    };
}
