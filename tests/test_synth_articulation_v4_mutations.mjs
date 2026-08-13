import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulesPromise = Promise.all([
    loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
    loadUIModule(repoRoot, "ui/shared/articulation-v4-editor.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
    loadUIModule(repoRoot, "ui/shared/synth-hooks.ts"),
]);

function makeSlot(overrides, routeAmounts) {
    return {
        id: "layer-1",
        runtimeSlot: 1,
        name: "Layer 1",
        color: "#abcdef",
        key: 36,
        velRange: { min: 1, max: 64 },
        chainRange: { min: 0, max: 64 },
        overrides,
        routeAmounts,
    };
}

test("production A/shared update stays sparse and preserves unrepresented v4 state", async () => {
    const [image, editor, modulation, synthHooks] = await modulesPromise;
    const routeId = "oscA.pan::env-1";
    const retainedRouteId = "oscB.pan::env-1";
    const slot = makeSlot({
        "oscA.pan": 0.4,
        "oscA.octave": 2,
        "oscB.pan": -0.5,
        "oscC.fineCents": 17,
    }, {
        [routeId]: 0.4,
        [retainedRouteId]: -0.25,
    });
    const state = {
        ...image.createEmptyArticulationsState(),
        selectedSlotId: slot.id,
        slots: [slot],
    };
    const route = modulation.createDefaultRoute({
        id: routeId,
        sourceKind: "env",
        sourceSlot: 1,
        targetKind: "oscA.pan",
        amount: 0,
    });
    const base = {
        parameters: { pan: 0, filterQ: 0.7 },
        modRouteAmounts: [{ routeId, amount: 0.5 }],
    };
    const current = {
        parameters: { pan: 0, filterQ: 0.7 },
        modRouteAmounts: [{ routeId, amount: 0 }],
    };
    const next = synthHooks.replaceVisibleArticulationSnapshotV4(
        state,
        slot.id,
        current,
        base,
        [route],
    );
    const updated = next.slots[0];

    assert.equal(Object.hasOwn(updated.overrides, "oscA.pan"), false, "base-valued A scalar inherits");
    assert.equal(Object.hasOwn(updated.overrides, "filterQ"), false, "base-valued shared scalar inherits");
    assert.equal(updated.overrides["oscA.octave"], 2, "newer unrepresented A state survives");
    assert.equal(updated.overrides["oscB.pan"], -0.5, "B state survives");
    assert.equal(updated.overrides["oscC.fineCents"], 17, "C state survives");
    assert.equal(Object.hasOwn(updated.routeAmounts, routeId), true);
    assert.equal(updated.routeAmounts[routeId], 0, "explicit zero route override survives");
    assert.equal(updated.routeAmounts[retainedRouteId], -0.25, "unrepresented route survives");

    const renamed = editor.renameArticulationV4(next, slot.id, "Renamed");
    assert.deepEqual(renamed.slots[0].overrides, updated.overrides);
    assert.deepEqual(renamed.slots[0].routeAmounts, updated.routeAmounts);
});

test("full-state hydration validates articulation routes against modulation from the same snapshot", async () => {
    const [, , modulation, synthHooks] = await modulesPromise;
    const route = modulation.createDefaultRoute({
        id: "oscA.pan::env-1",
        sourceKind: "env",
        sourceSlot: 1,
        targetKind: "oscA.pan",
        amount: 0.5,
    });
    const modulationState = {
        ...modulation.createDefaultModulationState(),
        routes: [route],
    };
    const slot = makeSlot({}, { [route.id]: 0 });
    const articulationState = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: slot.id,
        activeTriggerMode: "key",
        slots: [slot],
    };

    const parsed = synthHooks.parseArticulationStateFromFullStoredState({
        values: {
            [modulation.MODULATION_STATE_KEY]: JSON.stringify(modulationState),
            "articulations.v4": JSON.stringify(articulationState),
        },
    }, []);

    assert.deepEqual([...parsed.acceptedRouteIds], [route.id]);
    assert.equal(parsed.parsedState?._tag, "ok");
    assert.equal(parsed.parsedState?.value.slots[0].routeAmounts[route.id], 0);
});

test("legacy A phase controls project to their canonical v4 oscillator keys", async () => {
    const [, , , synthHooks] = await modulesPromise;
    const layer = synthHooks.projectArticulationSnapshotToVisibleV4Layer({
        parameters: {
            unisonPhase: 0.25,
            unisonRandom: 0.75,
            unisonPhaseMode: 1,
        },
        modRouteAmounts: [{ routeId: "zero-route", amount: 0 }],
    });

    assert.equal(layer.overrides["oscA.phase"], 0.25);
    assert.equal(layer.overrides["oscA.phaseRandom"], 0.75);
    assert.equal(layer.overrides["oscA.retrigger"], 1);
    assert.equal(Object.hasOwn(layer.routeAmounts, "zero-route"), true);
    assert.equal(layer.routeAmounts["zero-route"], 0);
});

test("preset transaction rotates the sparse comparison base with parameters and modulation", async () => {
    const [image, , modulation, synthHooks] = await modulesPromise;
    const route = modulation.createDefaultRoute({
        id: "oscA.pan::env-1",
        sourceKind: "env",
        sourceSlot: 1,
        targetKind: "oscA.pan",
        amount: 0.25,
    });
    const modulationState = {
        ...modulation.createDefaultModulationState(),
        routes: [route],
    };
    const nextBase = synthHooks.buildPresetArticulationBaseSnapshot({
        parameters: {
            pan: 0.75,
            filterQ: 2,
            mseg1Morph: 0.4,
        },
        storedState: {},
    }, modulationState);
    const slot = makeSlot({
        "oscA.pan": 0.5,
        "oscB.pan": -0.5,
    }, {
        [route.id]: 0,
    });
    const state = {
        ...image.createEmptyArticulationsState(),
        selectedSlotId: slot.id,
        slots: [slot],
    };

    assert.equal(nextBase.parameters.pan, 0.75);
    assert.equal(nextBase.parameters.filterQ, 2);
    assert.equal(nextBase.parameters.msegMorphs[0], 0.4);
    assert.equal(nextBase.modRouteAmounts[0].amount, 0.25);

    const next = synthHooks.replaceVisibleArticulationSnapshotV4(
        state,
        slot.id,
        nextBase,
        nextBase,
        [route],
    );
    assert.equal(Object.hasOwn(next.slots[0].overrides, "oscA.pan"), false);
    assert.equal(Object.hasOwn(next.slots[0].routeAmounts, route.id), false);
    assert.equal(next.slots[0].overrides["oscB.pan"], -0.5);
});

test("production synth hook imports direct v4 transitions and has no reverse compiler", async () => {
    const source = await readFile(new URL("../ui/shared/synth-hooks.ts", import.meta.url), "utf8");
    assert.match(source, /from "\.\/articulation-v4-editor"/);
    assert.match(source, /replaceVisibleArticulationLayerV4/);
    assert.match(source, /setAndPersistState/);
    assert.match(source, /collapseArticulationSegmentV4\(previousState, mode, segment\)/);
    assert.match(source, /collapseAllArticulationSegmentsV4\(previousState, mode\)/);
    assert.match(source, /setArticulationPatchBase\(buildPresetArticulationBaseSnapshot/);
    assert.match(source, /setAndPersistState\(parseStrictArticulationPresetState\(value, routeIds\), routeIds, true\)/);
    assert.doesNotMatch(source, /compileEditorBankToCurrentArticulations/);
    assert.doesNotMatch(source, /setAndPersistBank/);
});
