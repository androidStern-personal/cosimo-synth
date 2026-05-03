import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-state.ts");

const {
    SPECTRAL_PARTIAL_COUNT,
    SPECTRAL_PARTIAL_STATE_KEY,
    applySpectralPartialPreset,
    buildPartialShapeUpload,
    createDefaultSpectralPartialState,
    normalizeSpectralPartialState,
    parseStrictSpectralPartialStateV1,
    serializeSpectralPartialState,
    setSpectralPartialValue,
    smoothSpectralPartialState,
} = stateModule;

test("default spectral partial state is saw shaped and serializes under the v1 key", () => {
    const state = createDefaultSpectralPartialState();
    const serialized = serializeSpectralPartialState(state);
    const parsed = JSON.parse(serialized);

    assert.equal(SPECTRAL_PARTIAL_STATE_KEY, "spectral.partialShape.v1");
    assert.equal(state.version, 1);
    assert.equal(state.count, 32);
    assert.equal(state.values.length, SPECTRAL_PARTIAL_COUNT);
    assert.equal(state.preset, "saw");
    assert.equal(state.values[0], 1);
    assert.equal(state.values[1], 0.5);
    assert.equal(state.values[3], 0.25);
    assert.equal(parsed.values.length, 64);
});

test("normalization clamps count and values while preserving inactive tail values", () => {
    const rawValues = Array.from({ length: 80 }, (_unused, index) => index === 70 ? 0.37 : index / 10);
    const state = normalizeSpectralPartialState({
        version: 1,
        count: 99,
        values: rawValues,
        preset: "square",
    });

    assert.equal(state.count, 64);
    assert.equal(state.values.length, 64);
    assert.equal(state.values[0], 0);
    assert.equal(state.values[10], 1);
    assert.equal(state.values[63], 1);

    const reduced = normalizeSpectralPartialState({ ...state, count: 8 });
    assert.equal(reduced.count, 8);
    assert.equal(reduced.values.length, 64);
    assert.equal(reduced.values[10], 1);
});

test("presets produce distinct independently checkable shapes", () => {
    const square = applySpectralPartialPreset(createDefaultSpectralPartialState(), "square");
    const triangle = applySpectralPartialPreset(createDefaultSpectralPartialState(), "triangle");
    const air = applySpectralPartialPreset(createDefaultSpectralPartialState(), "air");

    assert.equal(square.values[0], 1);
    assert.equal(square.values[1], 0);
    assert.ok(square.values[2] > 0.3 && square.values[2] < 0.34);
    assert.equal(square.preset, "square");

    assert.equal(triangle.values[0], 1);
    assert.equal(triangle.values[1], 0);
    assert.ok(triangle.values[2] > 0.1 && triangle.values[2] < 0.12);
    assert.ok(triangle.values[4] < triangle.values[2]);

    assert.ok(air.values[17] > air.values[0]);
    assert.ok(air.values[17] > air.values[31]);
});

test("manual edits and transforms mark state custom", () => {
    const edited = setSpectralPartialValue(createDefaultSpectralPartialState(), 3, 0.73);
    const smoothed = smoothSpectralPartialState(edited);

    assert.equal(edited.preset, "custom");
    assert.equal(edited.values[3], 0.73);
    assert.equal(smoothed.preset, "custom");
    assert.notEqual(smoothed.values[3], edited.values[3]);
});

test("strict parser rejects malformed current state instead of inventing data", () => {
    assert.throws(
        () => parseStrictSpectralPartialStateV1({ version: 1, count: 8, values: [1], preset: "saw" }),
        /64/,
    );
    assert.throws(
        () => parseStrictSpectralPartialStateV1({ version: 2, count: 8, values: Array.from({ length: 64 }, () => 1), preset: "saw" }),
        /version/i,
    );
});

test("upload payload contains count and all sixty four strengths", () => {
    const state = normalizeSpectralPartialState({
        version: 1,
        count: 12,
        values: Array.from({ length: 64 }, (_unused, index) => index / 63),
        preset: "custom",
    });
    const upload = buildPartialShapeUpload(state);

    assert.equal(upload.count, 12);
    assert.equal(upload.strengths.length, 64);
    assert.equal(upload.strengths[0], 0);
    assert.equal(upload.strengths[63], 1);
});
