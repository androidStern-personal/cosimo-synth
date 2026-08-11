import test from "node:test";
import assert from "node:assert/strict";

import { getRackParameterDescriptor } from "../patch_gui/rack-parameter-descriptors.js";
import {
    projectRackRoutePresentation,
    projectRackRouteTravel,
} from "../patch_gui/rack-route-presentation.js";

const SOURCE = { sourceKind: "env", sourceSlot: 1 };
const TARGET_KIND = "rack.distortionWet";

function route(overrides = {}) {
    return {
        id: "route-1",
        enabled: true,
        sourceKind: "env",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: TARGET_KIND,
        amount: 0,
        reducer: "max",
        ...overrides,
    };
}

test("rack route presentation separates the armed pair from target-wide topology", () => {
    const otherSourceRoute = route({ id: "other", sourceKind: "mseg", amount: 0.4 });
    const cases = [
        {
            label: "no armed source",
            input: { routes: [otherSourceRoute], armedSource: null },
            expected: ["no-source", "no-source", 1, "solid"],
        },
        {
            label: "armed and unmapped",
            input: { routes: [otherSourceRoute], armedSource: SOURCE },
            expected: ["unmapped", "creatable", 1, "solid"],
        },
        {
            label: "armed and mapped at zero",
            input: { routes: [otherSourceRoute, route()], armedSource: SOURCE },
            expected: ["mapped", "existing", 2, "solid"],
        },
        {
            label: "current route bypassed while another route is active",
            input: { routes: [otherSourceRoute, route({ enabled: false })], armedSource: SOURCE },
            expected: ["route-bypassed", "existing", 2, "solid"],
        },
        {
            label: "all target routes bypassed",
            input: { routes: [route({ enabled: false })], armedSource: SOURCE },
            expected: ["route-bypassed", "existing", 1, "hollow"],
        },
        {
            label: "a large mapping set does not impose an arbitrary public cap",
            input: {
                routes: Array.from({ length: 100 }, (_, index) => route({
                    id: `existing-${index}`,
                    sourceKind: "mseg",
                    sourceSlot: (index % 3) + 1,
                    targetKind: `rack.existing-${index}`,
                })),
                armedSource: SOURCE,
            },
            expected: ["unmapped", "creatable", 0, "hidden"],
        },
        {
            label: "pending creation remains visibly unmapped",
            input: { routes: [], armedSource: SOURCE, pending: true },
            expected: ["unmapped", "pending", 0, "hidden"],
        },
        {
            label: "choice targets are ineligible",
            input: { routes: [], armedSource: SOURCE, targetKind: null },
            expected: ["ineligible", "ineligible", 0, "hidden"],
        },
    ];

    for (const { label, input, expected } of cases) {
        const presentation = projectRackRoutePresentation({
            targetKind: TARGET_KIND,
            effectEnabled: true,
            targetEffective: true,
            pending: false,
            ...input,
        });
        assert.deepEqual([
            presentation.relationship,
            presentation.creation,
            presentation.targetRouteCount,
            presentation.badge,
        ], expected, label);
    }
});

test("rack route presentation distinguishes effect bypass from route bypass and mode suspension", () => {
    const currentRoute = route({ amount: 0.4 });
    const effectBypassed = projectRackRoutePresentation({
        routes: [currentRoute],
        armedSource: SOURCE,
        targetKind: TARGET_KIND,
        effectEnabled: false,
        targetEffective: true,
        pending: false,
    });
    const modeSuspended = projectRackRoutePresentation({
        routes: [currentRoute],
        armedSource: SOURCE,
        targetKind: TARGET_KIND,
        effectEnabled: true,
        targetEffective: false,
        pending: false,
    });

    assert.equal(effectBypassed.relationship, "mapped");
    assert.equal(effectBypassed.effectiveness, "effect-bypassed");
    assert.equal(modeSuspended.relationship, "mapped");
    assert.equal(modeSuspended.effectiveness, "target-suspended");
});

test("rack route travel matches the DSP's linear and octave application before display normalization", () => {
    const cases = [
        {
            label: "positive unipolar linear",
            endpointID: "globalFilterResonance",
            base: 4,
            route: route({ targetKind: "rack.globalFilterResonance", amount: 3 }),
            expectedValues: [4, 7],
        },
        {
            label: "negative unipolar linear",
            endpointID: "ottTimePercent",
            base: 100,
            route: route({ targetKind: "rack.ottTimePercent", amount: -40 }),
            expectedValues: [60, 100],
        },
        {
            label: "bipolar linear",
            endpointID: "flangerRate",
            base: 2,
            route: route({ targetKind: "rack.flangerRate", amount: 1.5, polarity: "bipolar" }),
            expectedValues: [0.5, 3.5],
        },
        {
            label: "phaser rate stays linear despite log display",
            endpointID: "phaserRate",
            base: 1,
            route: route({ targetKind: "rack.phaserRate", amount: 2 }),
            expectedValues: [1, 3],
        },
        {
            label: "frequency target applies octaves",
            endpointID: "phaserFrequency",
            base: 500,
            route: route({ targetKind: "rack.phaserFrequency", amount: 2 }),
            expectedValues: [500, 2_000],
        },
        {
            label: "lower clipping",
            endpointID: "distortionDriveDb",
            base: 4,
            route: route({ targetKind: "rack.distortionDriveDb", amount: -10 }),
            expectedValues: [0, 4],
        },
        {
            label: "upper clipping",
            endpointID: "distortionWet",
            base: 0.8,
            route: route({ targetKind: "rack.distortionWet", amount: 0.7 }),
            expectedValues: [0.8, 1],
        },
    ];

    for (const entry of cases) {
        const descriptor = getRackParameterDescriptor(entry.endpointID);
        assert.ok(descriptor, entry.label);
        const travel = projectRackRouteTravel(descriptor, entry.base, entry.route);
        assert.deepEqual(
            travel.values.map((value) => Number(value.toFixed(6))),
            entry.expectedValues,
            entry.label,
        );
        assert.equal(travel.hasVisibleTravel, true, entry.label);
    }
});

test("a nonzero route clipped completely at a rail remains explicitly routed", () => {
    const descriptor = getRackParameterDescriptor("distortionWet");
    assert.ok(descriptor);
    const travel = projectRackRouteTravel(
        descriptor,
        1,
        route({ targetKind: "rack.distortionWet", amount: 0.5 }),
    );

    assert.deepEqual(travel.values, [1, 1]);
    assert.equal(travel.hasVisibleTravel, false);
    assert.equal(travel.nonzeroRouteFullyClipped, true);
});

test("base host echo re-anchors route travel without changing route amount", () => {
    const descriptor = getRackParameterDescriptor("delayFilter");
    assert.ok(descriptor);
    const selectedRoute = route({ targetKind: "rack.delayFilter", amount: 1 });
    const before = projectRackRouteTravel(descriptor, 1_000, selectedRoute);
    const after = projectRackRouteTravel(descriptor, 2_000, selectedRoute);

    assert.deepEqual(before.values, [1_000, 2_000]);
    assert.deepEqual(after.values, [2_000, 4_000]);
    assert.equal(selectedRoute.amount, 1);
});
