import assert from "node:assert/strict";
import test from "node:test";

import { buildModulationBenchmarkDocument } from "../scripts/generate_modulation_benchmark_profiles.mjs";

function runtimeVoiceRouteContribution(sourceValue, amount, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    const amount32 = Math.fround(amount);
    const scale = polarity === "bipolar" ? Math.fround(amount32 * 2) : amount32;
    const bias = polarity === "bipolar" ? Math.fround(-amount32) : 0;
    return Math.fround(Math.fround(scale * source) + bias);
}

function runtimePolarityValue(sourceValue, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    return polarity === "bipolar"
        ? Math.fround(Math.fround(source * 2) - 1)
        : source;
}

function runtimeRackRouteContribution(sourceValue, amount, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    let reducedSource = source;
    if (polarity === "bipolar") {
        let sourceSum = Math.fround(0);
        for (let voiceIndex = 0; voiceIndex < 16; voiceIndex += 1) {
            sourceSum = Math.fround(sourceSum + source);
        }
        const mean = Math.fround(sourceSum * Math.fround(1 / 16));
        reducedSource = runtimePolarityValue(mean, polarity);
    }
    return Math.fround(Math.fround(reducedSource * Math.fround(1)) * Math.fround(amount));
}

test("the native matrix Amp Envelope pair cancels exactly in float32 for both polarities", () => {
    const document = buildModulationBenchmarkDocument();
    assert.equal(document.sourceContract.expressionMidiValue, 100);
    assert.equal(document.sourceContract.ampEnvelopeSustain, 1);

    const active = document.profiles.find((profile) => profile.name === "active-1372");
    assert.ok(active, "missing full active native benchmark profile");
    const routes = JSON.parse(active.stateJSON).routes;
    const velocity = Math.fround(document.sourceContract.expressionMidiValue / 127);
    const ampEnvelope = Math.fround(document.sourceContract.ampEnvelopeRouteValue);
    assert.equal(ampEnvelope, 1);

    const expectedAmpAmounts = {
        voice: {
            unipolar: 0.012303149327635765,
            bipolar: 0.00898129865527153,
        },
        voiceRack: {
            unipolar: 0.012303149327635765,
            bipolar: 0.008981296792626381,
        },
    };
    for (const path of ["voice", "voiceRack"]) {
        const routeContribution = path === "voice"
            ? runtimeVoiceRouteContribution
            : runtimeRackRouteContribution;
        for (const polarity of ["unipolar", "bipolar"]) {
            const ampRoute = routes.find((route) => (
                route.id.startsWith(`benchmark-${path}-`)
                && route.sourceKind === "env"
                && route.sourceSlot === 4
                && route.polarity === polarity
            ));
            assert.ok(ampRoute, `missing ${path} ${polarity} Amp Envelope route`);

            const routeForSource = (sourceKind) => routes.find((route) => (
                route.id.startsWith(`benchmark-${path}-`)
                && route.sourceKind === sourceKind
                && route.sourceSlot === null
                && route.targetKind === ampRoute.targetKind
                && route.polarity === polarity
            ));
            const velocityRoute = routeForSource("velocity");
            const pressureRoute = routeForSource("pressure");
            const slideRoute = routeForSource("slide");
            assert.ok(velocityRoute && pressureRoute && slideRoute,
                `missing ${path} ${polarity} expression-source compensation routes`);
            assert.equal(
                Math.fround(ampRoute.amount),
                expectedAmpAmounts[path][polarity],
            );

            const runtimeSources = path === "voice"
                ? [
                    [velocity, velocityRoute],
                    [velocity, pressureRoute],
                    [velocity, slideRoute],
                    [ampEnvelope, ampRoute],
                ]
                : [
                    [ampEnvelope, ampRoute],
                    [velocity, velocityRoute],
                    [velocity, pressureRoute],
                    [velocity, slideRoute],
                ];
            const finalOffset = runtimeSources.reduce(
                (sum, [source, route]) => Math.fround(
                    sum + routeContribution(source, route.amount, polarity),
                ),
                0,
            );
            assert.equal(finalOffset, 0,
                `${path} ${polarity} routes left a float32 residual`);
        }
    }
});
