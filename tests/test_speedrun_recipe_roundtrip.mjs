import assert from "node:assert/strict";
import test from "node:test";

import fc from "fast-check";

import {
    barePatchFromDefaults,
    canonicalRoutes,
    createCurrentSpeedrunContext,
    loadSpeedrunModules,
    readFactoryCatalog,
    readSpeedrunFixture,
} from "./helpers/speedrun_test_context.mjs";

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

test("fast-check: recipe(defaults) round-trips random current-contract audible patches", async () => {
    const [modules, context, laneFixture, catalog] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
        readFactoryCatalog(),
    ]);
    const sampleArbitrary = fc.record({
        table: fc.integer({ min: 0, max: catalog.tables.length - 1 }),
        position: fc.double({ min: 0.1, max: 0.95, noNaN: true }),
        warpMode: fc.integer({ min: 0, max: 5 }),
        warp: fc.double({ min: 0.1, max: 0.95, noNaN: true }),
        volume: fc.double({ min: -36, max: -1, noNaN: true }),
        muteB: fc.boolean(),
        muteC: fc.boolean(),
        cutoff: fc.double({ min: 120, max: 800, noNaN: true }),
        envAttack: fc.double({ min: 0.05, max: 0.8, noNaN: true }),
        macro: fc.double({ min: 0.1, max: 1, noNaN: true }),
        release: fc.double({ min: 0.3, max: 3, noNaN: true }),
        filterRoute: fc.double({ min: 0.1, max: 5, noNaN: true }),
        laneRoute: fc.double({ min: 0.1, max: 0.9, noNaN: true }),
        delayTime: fc.double({ min: 60, max: 300, noNaN: true }),
        delayMix: fc.double({ min: 0.2, max: 0.9, noNaN: true }),
        reverbMix: fc.double({ min: 0.2, max: 0.9, noNaN: true }),
    });

    fc.assert(fc.property(sampleArbitrary, (sample) => {
        const lane = clone(laneFixture);
        lane.devices["delay#2"].params.delayTime = sample.delayTime;
        lane.devices["delay#2"].params.delayMix = sample.delayMix;
        lane.devices["reverb#1"].params.reverbMix = sample.reverbMix;
        const modulation = {
            ...clone(context.defaults.modulation),
            envelopeSlots: context.defaults.modulation.envelopeSlots.map((slot, index) => (
                index === 0 ? { name: "Property Env" } : slot
            )),
            macroNames: context.defaults.modulation.macroNames.map((name, index) => (
                index === 1 ? "Property Macro" : name
            )),
            routes: [
                {
                    id: "property-filter",
                    enabled: true,
                    sourceKind: "env",
                    sourceSlot: 1,
                    polarity: "unipolar",
                    targetKind: "filterCutoffOctaves",
                    amount: sample.filterRoute,
                    reducer: "max",
                },
                {
                    id: "property-delay",
                    enabled: true,
                    sourceKind: "macro",
                    sourceSlot: 2,
                    polarity: "bipolar",
                    targetKind: "lane.delay#2.delayMix",
                    amount: sample.laneRoute,
                    reducer: "mean",
                },
            ],
        };
        const intake = modules.patchIO.intakePatch(barePatchFromDefaults(context.defaults, {
            lane,
            modulation,
            parameters: {
                oscAWavetableSelect: sample.table,
                oscAWavetablePosition: sample.position,
                oscAWarpMode: sample.warpMode,
                oscAWarpAmount: sample.warp,
                oscAVolumeDb: sample.volume,
                oscBMute: sample.muteB ? 1 : 0,
                oscCMute: sample.muteC ? 1 : 0,
                filterCutoff: sample.cutoff,
                env1Attack: sample.envAttack,
                macro2: sample.macro,
                ampRelease: sample.release,
            },
        }), context.options);
        assert.equal(intake.ok, true, intake.error?.message);
        const analysis = modules.analyzer.analyzePatch(intake.value.document, intake.value.defaults);
        const recipe = modules.recipe.compileRecipe(
            analysis,
            intake.value.document,
            intake.value.defaults,
            catalog,
        );
        const rebuilt = modules.partialStates.applyRecipe(intake.value.defaults, recipe);

        for (const [endpointID, target] of Object.entries(intake.value.document.parameters)) {
            const annotation = intake.value.defaults.annotations[endpointID];
            assert.equal(
                modules.analyzer.parameterValuesDiffer(rebuilt.parameters[endpointID], target, annotation),
                false,
                endpointID,
            );
        }
        assert.deepEqual(rebuilt.lane, intake.value.document.lane);
        assert.deepEqual(rebuilt.articulations, intake.value.document.articulations);
        assert.deepEqual(
            canonicalRoutes(rebuilt.modulation.routes),
            canonicalRoutes(intake.value.document.modulation.routes),
        );
        assert.deepEqual(
            { ...rebuilt.modulation, routes: [] },
            { ...intake.value.document.modulation, routes: [] },
        );
        assert.equal(
            JSON.stringify(modules.recipe.compileRecipe(
                analysis,
                intake.value.document,
                intake.value.defaults,
                catalog,
            )),
            JSON.stringify(recipe),
        );
    }), { numRuns: 75 });
});
