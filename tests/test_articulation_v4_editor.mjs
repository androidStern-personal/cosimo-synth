import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const imageModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.ts");
const editorModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-v4-editor.ts");

async function modules() {
    const [image, editor] = await Promise.all([imageModulePromise, editorModulePromise]);
    return { image, editor };
}

test("capture and replace keep a sparse independent A/B/C layer", async () => {
    const { image, editor } = await modules();
    let state = image.createEmptyArticulationsState();
    state = editor.addCapturedArticulationV4(state, {
        overrides: {
            "oscA.semitone": 12,
            "oscB.semitone": -7,
            "oscC.fineCents": 18,
        },
        routeAmounts: { "oscB.framePosition::mseg-1": 0.5 },
    });

    const captured = state.slots[0];
    assert.deepEqual(captured.overrides, {
        "oscA.semitone": 12,
        "oscB.semitone": -7,
        "oscC.fineCents": 18,
    });
    assert.equal(Object.hasOwn(captured.overrides, "oscA.fineCents"), false);

    state = editor.replaceArticulationLayerV4(state, captured.id, {
        overrides: { "oscC.warpAmount": 0.8 },
        routeAmounts: {},
    });
    const replaced = state.slots[0];
    assert.deepEqual(replaced.overrides, { "oscC.warpAmount": 0.8 });
    assert.deepEqual(replaced.routeAmounts, {});
    assert.equal(replaced.runtimeSlot, captured.runtimeSlot);
    assert.equal(replaced.key, captured.key);
});

test("duplicate owns independent copies and independent trigger positions", async () => {
    const { image, editor } = await modules();
    let state = editor.addCapturedArticulationV4(image.createEmptyArticulationsState(), {
        overrides: {
            "oscA.warpAmount": 0.2,
            "oscB.warpAmount": 0.4,
            "oscC.warpAmount": 0.6,
        },
        routeAmounts: { "oscA.framePosition::mseg-1": 0.25 },
    });
    const original = state.slots[0];
    state = editor.duplicateArticulationV4(state, original.id);
    const copy = state.slots[1];

    assert.notEqual(copy.id, original.id);
    assert.notEqual(copy.runtimeSlot, original.runtimeSlot);
    assert.deepEqual(copy.overrides, original.overrides);
    assert.notEqual(copy.overrides, original.overrides);
    assert.deepEqual(copy.routeAmounts, original.routeAmounts);
    assert.notEqual(copy.routeAmounts, original.routeAmounts);

    state = editor.assignArticulationPositionV4(state, "key", 48, copy.id);
    assert.equal(state.slots.find(({ id }) => id === copy.id).key, 48);
    assert.equal(state.slots.find(({ id }) => id === original.id).key, original.key);
});

test("range edits preserve slot identity and never use velocity zero", async () => {
    const { image, editor } = await modules();
    let state = image.createEmptyArticulationsState();
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    const first = state.slots[0];
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    const second = state.slots[1];

    state = editor.insertArticulationPositionV4(state, "vel", 64, second.id);
    const firstSegment = editor.articulationSegmentsV4(state, "vel")
        .find(({ articulationId }) => articulationId === first.id);
    state = editor.resizeArticulationSegmentV4(state, "vel", firstSegment, "max", 31);

    assert.deepEqual(state.slots.find(({ id }) => id === first.id).velRange, { min: 1, max: 31 });
    assert.equal(state.slots.every(({ velRange }) => velRange.min >= 1), true);
    assert.deepEqual(state.slots.map(({ id }) => id), [first.id, second.id]);
});

test("outward insertion preserves a valid occupied range at either endpoint", async () => {
    const { image, editor } = await modules();
    let state = image.createEmptyArticulationsState();
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    const occupantId = state.slots[0].id;
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    const insertedId = state.slots[1].id;
    state = {
        ...state,
        slots: state.slots.map((slot) => slot.id === occupantId
            ? { ...slot, velRange: { min: 20, max: 30 } }
            : slot),
    };

    const atLower = editor.insertArticulationPositionV4(state, "vel", 20, insertedId, "lower");
    assert.deepEqual(atLower.slots.find(({ id }) => id === occupantId).velRange, { min: 21, max: 30 });
    assert.deepEqual(atLower.slots.find(({ id }) => id === insertedId).velRange, { min: 20, max: 20 });

    const reset = {
        ...state,
        slots: state.slots.map((slot) => slot.id === insertedId
            ? { ...slot, velRange: { min: 1, max: 1 } }
            : slot),
    };
    const atUpper = editor.insertArticulationPositionV4(reset, "vel", 30, insertedId, "upper");
    assert.deepEqual(atUpper.slots.find(({ id }) => id === occupantId).velRange, { min: 20, max: 29 });
    assert.deepEqual(atUpper.slots.find(({ id }) => id === insertedId).velRange, { min: 30, max: 30 });
    assert.equal(atLower.slots.every((slot) => slot.velRange.min <= slot.velRange.max), true);
    assert.equal(atUpper.slots.every((slot) => slot.velRange.min <= slot.velRange.max), true);
});

test("collapse actions keep every mandatory trigger assignment valid", async () => {
    const { image, editor } = await modules();
    let state = image.createEmptyArticulationsState();
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    state = editor.addCapturedArticulationV4(state, { overrides: {}, routeAmounts: {} });
    state = {
        ...state,
        slots: state.slots.map((slot, index) => ({
            ...slot,
            velRange: index === 0 ? { min: 20, max: 30 } : { min: 40, max: 50 },
        })),
    };

    const firstSegment = editor.articulationSegmentsV4(state, "vel")[0];
    const collapsedOne = editor.collapseArticulationSegmentV4(state, "vel", firstSegment);
    assert.deepEqual(collapsedOne.slots[0].velRange, { min: 20, max: 20 });

    const collapsedAll = editor.collapseAllArticulationSegmentsV4(state, "vel");
    assert.deepEqual(collapsedAll.slots.map(({ velRange }) => velRange), [
        { min: 1, max: 1 },
        { min: 2, max: 2 },
    ]);
    assert.equal(collapsedAll.slots.every(({ velRange }) => velRange.min >= 1), true);
});
