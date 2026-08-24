import assert from "node:assert/strict";
import test from "node:test";

import {
    buildGoldenSpeedrunPipeline,
    canonicalRoutes,
    readSpeedrunFixture,
} from "./helpers/speedrun_test_context.mjs";

test("the analyzer follows audible voice state and current lane.v2 display order", async () => {
    const { analysis } = await buildGoldenSpeedrunPipeline();

    assert.deepEqual(analysis.sources.map((source) => source.id), ["env-1", "macro-2"]);
    assert.deepEqual(analysis.oscillators.map((oscillator) => oscillator.id), ["A"]);
    assert.equal(analysis.voiceFilter?.parameterDiffs[0].endpointID, "filterCutoff");
    assert.deepEqual(analysis.effects.map((effect) => effect.deviceId), ["delay#2", "reverb#1"]);
    assert.deepEqual(analysis.effects.map((effect) => effect.label), ["Delay", "Reverb"]);
    assert.deepEqual(analysis.effects[0].routes.map((route) => route.id), ["route-macro-delay-2"]);
    assert.deepEqual(analysis.omitted.inaudibleOscillators, ["B", "C"]);
    assert.deepEqual(analysis.omitted.disabledDeviceIds, ["distortion#1"]);
    assert.deepEqual(analysis.omitted.inertRouteIds, ["route-inert-muted-b"]);
    assert.deepEqual([...analysis.demonstratedRouteIds].sort(), ["route-env-filter", "route-macro-delay-2"]);
});

test("recipe order, instance-aware effect operations, and captions are deterministic", async () => {
    const { recipe } = await buildGoldenSpeedrunPipeline();

    assert.deepEqual(recipe.sections.map((section) => section.id), [
        "source-env-1",
        "source-macro-2",
        "oscillator-A",
        "voice-filter",
        "effect-delay#2",
        "effect-reverb#1",
    ]);
    const delaySection = recipe.sections.find((section) => section.id === "effect-delay#2");
    assert.equal(delaySection.ops[1].kind, "toggleEffect");
    assert.equal(delaySection.ops[1].deviceId, "delay#2");
    assert.ok(delaySection.ops.some((op) => (
        op.kind === "setLaneParam" && op.endpointID === "delayMix" && op.deviceId === "delay#2"
    )));
    assert.ok(delaySection.ops.some((op) => (
        op.kind === "mapRoute" && op.route.targetKind === "lane.delay#2.delayMix"
    )));
    assert.ok(recipe.sections.every((section) => section.captions.length <= 8));
    assert.match(delaySection.allCaptions.join("\n"), /DELAY 2 MIX/);
});

test("the current-contract effects-lane recipe matches its golden snapshot", async () => {
    const [{ recipe }, golden] = await Promise.all([
        buildGoldenSpeedrunPipeline(),
        readSpeedrunFixture("effects-lane-recipe.golden.json"),
    ]);
    assert.deepEqual(recipe, golden);
});

test("applying the recipe to current defaults reproduces the complete normalized patch", async () => {
    const { defaults, document, recipe, partialStates } = await buildGoldenSpeedrunPipeline();
    const rebuilt = partialStates.applyRecipe(defaults, recipe);

    assert.deepEqual(rebuilt.parameters, document.parameters);
    assert.deepEqual(rebuilt.lane, document.lane);
    assert.deepEqual(rebuilt.articulations, document.articulations);
    assert.deepEqual(canonicalRoutes(rebuilt.modulation.routes), canonicalRoutes(document.modulation.routes));
    assert.deepEqual(
        { ...rebuilt.modulation, routes: [] },
        { ...document.modulation, routes: [] },
    );
});

test("cumulative states silence not-yet-built oscillators and effects", async () => {
    const { defaults, recipe, partialStates } = await buildGoldenSpeedrunPipeline();
    const states = partialStates.buildCumulativeStates(defaults, recipe);
    const oscillatorIndex = recipe.sections.findIndex((section) => section.id === "oscillator-A");
    const delayIndex = recipe.sections.findIndex((section) => section.id === "effect-delay#2");
    const reverbIndex = recipe.sections.findIndex((section) => section.id === "effect-reverb#1");

    assert.equal(states[0].parameters.oscAMute, 1);
    assert.equal(states[oscillatorIndex].parameters.oscAMute, 0);
    assert.equal(states[oscillatorIndex].parameters.oscBMute, 1);
    assert.equal(states[delayIndex].lane.chain[1].branches[0][0].enabled, true);
    assert.equal(states[delayIndex].lane.chain[1].branches[1][0].enabled, false);
    assert.equal(states[reverbIndex].lane.chain[1].branches[1][0].enabled, true);
});
