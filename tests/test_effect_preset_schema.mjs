import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadSchemaModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-schema.ts");
}

function createDescriptorRegistry() {
    return {
        ott: {
            effectID: "ott",
            label: "OTT",
            params: {
                ottMix: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottAmount: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottTimePercent: { type: "number", min: 10, max: 1000, defaultValue: 100, clamp: true },
                ottBandDrive: { type: "number", min: 0, max: 100, defaultValue: 0 },
                ottEnvelopeMatch: { type: "number", min: 0, max: 100, defaultValue: 0 },
                ottDetectorMode: { type: "integer", min: 0, max: 1, defaultValue: 0 },
                ottBypass: { type: "boolean", defaultValue: false },
            },
        },
        chorus: {
            effectID: "chorus",
            label: "Chorus",
            params: {
                chorusEnabled: { type: "boolean", defaultValue: false },
                chorusMix: { type: "number", min: 0, max: 1, defaultValue: 0 },
                chorusMotionMode: { type: "integer", min: 0, max: 3, defaultValue: 1 },
            },
        },
    };
}

function validOttPreset(overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.soft-smash",
        label: "Soft Smash",
        values: {
            ottMix: 82,
            ottAmount: 91,
            ottTimePercent: 100,
            ottBandDrive: 14,
            ottEnvelopeMatch: 63,
            ottDetectorMode: 1,
            ottBypass: false,
        },
        ...overrides,
    };
}

class FakePatchConnection {
    constructor() {
        this.calls = [];
    }

    sendParameterGestureStart(endpointID) {
        this.calls.push({ kind: "gestureStart", endpointID });
    }

    sendEventOrValue(endpointID, value) {
        this.calls.push({ kind: "value", endpointID, value });
    }

    sendParameterGestureEnd(endpointID) {
        this.calls.push({ kind: "gestureEnd", endpointID });
    }
}

test("valid_v1_preset_normalizes_to_exact_endpoint_value_payload", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();

    const normalized = normalizeEffectPreset({
        ...validOttPreset({
            label: "  Soft Smash  ",
            values: {
                ottBandDrive: 14,
                ottBypass: false,
                ottDetectorMode: 1,
                ottTimePercent: 5000,
                ottAmount: 91,
                ottMix: 82,
                ottEnvelopeMatch: 63,
            },
        }),
        scratchUiState: {
            selectedTab: "C",
        },
    }, createDescriptorRegistry());

    assert.deepEqual(normalized, {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.soft-smash",
        label: "Soft Smash",
        values: {
            ottMix: 82,
            ottAmount: 91,
            ottTimePercent: 1000,
            ottBandDrive: 14,
            ottEnvelopeMatch: 63,
            ottDetectorMode: 1,
            ottBypass: false,
        },
    });
});

test("preset_values_reject_dotted_endpoint_ids", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();

    assert.throws(() => normalizeEffectPreset(validOttPreset({
        values: {
            "ott.mix": 82,
        },
    }), createDescriptorRegistry()), /dotted|identifier|endpoint/i);
});

test("preset_values_reject_unknown_endpoint_ids_atomically", async () => {
    const { applyEffectPreset } = await loadSchemaModule();
    const patchConnection = new FakePatchConnection();

    assert.throws(() => applyEffectPreset({
        patchConnection,
        preset: validOttPreset({
            values: {
                ottMix: 82,
                ottNotARealParameter: 1,
            },
        }),
        descriptorRegistry: createDescriptorRegistry(),
    }), /unknown.*ottNotARealParameter/i);

    assert.deepEqual(patchConnection.calls, []);
});

test("preset_values_reject_wrong_kind_version_effect_and_label_type", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();
    const descriptorRegistry = createDescriptorRegistry();

    assert.throws(() => normalizeEffectPreset(validOttPreset({ kind: "cosimo.snapshot" }), descriptorRegistry), /kind/i);
    assert.throws(() => normalizeEffectPreset(validOttPreset({ version: 999 }), descriptorRegistry), /version/i);
    assert.throws(() => normalizeEffectPreset(validOttPreset({ effectID: "delay" }), descriptorRegistry), /effect/i);
    assert.throws(() => normalizeEffectPreset(validOttPreset({ label: 123 }), descriptorRegistry), /label/i);
});

test("preset_values_reject_missing_required_fields_and_empty_values", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();
    const descriptorRegistry = createDescriptorRegistry();

    assert.throws(() => normalizeEffectPreset(null, descriptorRegistry), /object|preset/i);
    assert.throws(() => normalizeEffectPreset({}, descriptorRegistry), /kind/i);
    assert.throws(() => normalizeEffectPreset(validOttPreset({ values: undefined }), descriptorRegistry), /values/i);
    assert.throws(() => normalizeEffectPreset(validOttPreset({ values: {} }), descriptorRegistry), /values|empty/i);
});

test("preset_values_validate_boundaries_independently", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();
    const descriptorRegistry = createDescriptorRegistry();

    assert.equal(normalizeEffectPreset(validOttPreset({
        values: {
            ...validOttPreset().values,
            ottTimePercent: 5000,
        },
    }), descriptorRegistry).values.ottTimePercent, 1000);

    assert.throws(() => normalizeEffectPreset(validOttPreset({
        values: {
            ...validOttPreset().values,
            ottMix: 101,
        },
    }), descriptorRegistry), /ottMix.*range|ottMix.*max|range.*ottMix/i);

    assert.throws(() => normalizeEffectPreset(validOttPreset({
        values: {
            ...validOttPreset().values,
            ottDetectorMode: 0.5,
        },
    }), descriptorRegistry), /ottDetectorMode.*integer|integer.*ottDetectorMode/i);

    assert.throws(() => normalizeEffectPreset(validOttPreset({
        values: {
            ...validOttPreset().values,
            ottBypass: 1,
        },
    }), descriptorRegistry), /ottBypass.*boolean|boolean.*ottBypass/i);
});

test("capture_preset_exports_only_descriptor_allowlisted_values", async () => {
    const { captureEffectPreset } = await loadSchemaModule();

    const captured = captureEffectPreset({
        effectID: "ott",
        presetID: "user.ott.captured",
        label: "Captured",
        currentValues: {
            ottMix: 55,
            ottAmount: 70,
            ottTimePercent: 125,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            ottDetectorMode: 0,
            ottBypass: false,
            hostSlot0Guard: 1,
            randomUiOnlyField: 999,
        },
        descriptorRegistry: createDescriptorRegistry(),
    });

    assert.deepEqual(captured, {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.captured",
        label: "Captured",
        values: {
            ottMix: 55,
            ottAmount: 70,
            ottTimePercent: 125,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            ottDetectorMode: 0,
            ottBypass: false,
        },
    });
});

test("apply_preset_writes_exact_values_inside_host_gesture", async () => {
    const { applyEffectPreset } = await loadSchemaModule();
    const patchConnection = new FakePatchConnection();

    applyEffectPreset({
        patchConnection,
        preset: validOttPreset(),
        descriptorRegistry: createDescriptorRegistry(),
    });

    assert.deepEqual(patchConnection.calls, [
        { kind: "gestureStart", endpointID: "ottMix" },
        { kind: "value", endpointID: "ottMix", value: 82 },
        { kind: "gestureEnd", endpointID: "ottMix" },
        { kind: "gestureStart", endpointID: "ottAmount" },
        { kind: "value", endpointID: "ottAmount", value: 91 },
        { kind: "gestureEnd", endpointID: "ottAmount" },
        { kind: "gestureStart", endpointID: "ottTimePercent" },
        { kind: "value", endpointID: "ottTimePercent", value: 100 },
        { kind: "gestureEnd", endpointID: "ottTimePercent" },
        { kind: "gestureStart", endpointID: "ottBandDrive" },
        { kind: "value", endpointID: "ottBandDrive", value: 14 },
        { kind: "gestureEnd", endpointID: "ottBandDrive" },
        { kind: "gestureStart", endpointID: "ottEnvelopeMatch" },
        { kind: "value", endpointID: "ottEnvelopeMatch", value: 63 },
        { kind: "gestureEnd", endpointID: "ottEnvelopeMatch" },
        { kind: "gestureStart", endpointID: "ottDetectorMode" },
        { kind: "value", endpointID: "ottDetectorMode", value: 1 },
        { kind: "gestureEnd", endpointID: "ottDetectorMode" },
        { kind: "gestureStart", endpointID: "ottBypass" },
        { kind: "value", endpointID: "ottBypass", value: false },
        { kind: "gestureEnd", endpointID: "ottBypass" },
    ]);
});

test("invalid_apply_is_atomic_and_does_not_touch_patch_connection", async () => {
    const { applyEffectPreset } = await loadSchemaModule();
    const patchConnection = new FakePatchConnection();

    assert.throws(() => applyEffectPreset({
        patchConnection,
        preset: validOttPreset({
            values: {
                ...validOttPreset().values,
                ottMix: "100",
            },
        }),
        descriptorRegistry: createDescriptorRegistry(),
    }), /ottMix.*number|number.*ottMix/i);

    assert.deepEqual(patchConnection.calls, []);
});
