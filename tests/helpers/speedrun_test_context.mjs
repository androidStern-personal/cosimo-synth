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
