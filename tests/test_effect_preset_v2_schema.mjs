import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const presetModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts");
    return { ...contractModule, ...presetModule };
}

function baseContract(overrides = {}) {
    const parameters = overrides.parameters ?? [
        { endpointID: "bypass", type: "boolean", defaultValue: false },
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "ottTimePercent", type: "number", min: 10, max: 1000, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ];
    const storedState = overrides.storedState ?? [];

    return overrides.buildContract({
        effectID: overrides.effectID ?? "ott",
        parameters,
        storedState,
    });
}

function validPreset(contract, overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: contract.effectID,
        presetID: "user.ott.test",
        label: "Test",
        contract,
        parameters: {
            bypass: false,
            ottMix: 82,
            ottTimePercent: 120,
            envelopeBoostClampDb: 8,
        },
        storedState: {},
        ...overrides,
    };
}

class Recorder {
    constructor() {
        this.events = [];
        this.gestures = [];
        this.storedWrites = [];
        this.adapterApplies = [];
    }

    sendParameterGestureStart(endpointID) {
        this.gestures.push({ kind: "start", endpointID });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }

    sendParameterGestureEnd(endpointID) {
        this.gestures.push({ kind: "end", endpointID });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }
}

test("valid_v2_preset_requires_exact_current_contract_hash_and_exact_keys", async () => {
    const { buildCanonicalPluginStateContract, normalizeEffectPresetV2 } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });

    const normalized = normalizeEffectPresetV2(validPreset(contract), {
        currentContract: contract,
    });

    assert.deepEqual(normalized.parameters, {
        bypass: false,
        ottMix: 82,
        ottTimePercent: 120,
        envelopeBoostClampDb: 8,
    });
    assert.deepEqual(normalized.storedState, {});
    assert.equal(normalized.contract.hash, contract.hash);
});

test("v2_preset_rejects_unknown_parameter_without_writes", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });
    const patchConnection = new Recorder();

    assert.throws(() => applyEffectPresetV2({
        preset: validPreset(contract, {
            parameters: {
                bypass: false,
                mix: 82,
                ottMix: 82,
                ottTimePercent: 120,
                envelopeBoostClampDb: 8,
            },
        }),
        currentContract: contract,
        patchConnection,
    }), /unknown.*mix/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
});

test("v2_preset_rejects_missing_parameter_without_writes", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });
    const patchConnection = new Recorder();

    assert.throws(() => applyEffectPresetV2({
        preset: validPreset(contract, {
            parameters: {
                bypass: false,
                ottMix: 82,
                ottTimePercent: 120,
            },
        }),
        currentContract: contract,
        patchConnection,
    }), /missing.*envelopeBoostClampDb/i);
    assert.deepEqual(patchConnection.events, []);
});

test("v2_preset_rejects_unknown_and_missing_stored_state_without_writes", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({
        buildContract: buildCanonicalPluginStateContract,
        effectID: "seqfx",
        parameters: [{ endpointID: "patternSelect", type: "integer", min: 0, max: 11, defaultValue: 0 }],
        storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
    });
    const patchConnection = new Recorder();
    const adapter = {
        key: "seqfx.v1",
        schemaVersion: 1,
        normalizeForPreset(value) {
            if (value !== "matrix") {
                throw new Error("bad matrix");
            }
            return value;
        },
        serializeForPreset(value) {
            return value;
        },
        apply(value) {
            patchConnection.adapterApplies.push(value);
        },
    };

    assert.throws(() => applyEffectPresetV2({
        preset: {
            ...validPreset(contract, {
                effectID: "seqfx",
                parameters: { patternSelect: 3 },
                storedState: { "unknown.v1": "matrix" },
            }),
        },
        currentContract: contract,
        patchConnection,
        storedStateAdapters: [adapter],
    }), /unknown.*unknown\.v1/i);
    assert.throws(() => applyEffectPresetV2({
        preset: {
            ...validPreset(contract, {
                effectID: "seqfx",
                parameters: { patternSelect: 3 },
                storedState: {},
            }),
        },
        currentContract: contract,
        patchConnection,
        storedStateAdapters: [adapter],
    }), /missing.*seqfx\.v1/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.adapterApplies, []);
});

test("v2_preset_rejects_out_of_range_and_wrong_type_values_without_clamping", async () => {
    const { normalizeEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });

    assert.throws(() => normalizeEffectPresetV2(validPreset(contract, {
        parameters: {
            bypass: false,
            ottMix: 82,
            ottTimePercent: 5000,
            envelopeBoostClampDb: 8,
        },
    }), { currentContract: contract }), /ottTimePercent.*above maximum 1000/i);
    assert.throws(() => normalizeEffectPresetV2(validPreset(contract, {
        parameters: {
            bypass: 0,
            ottMix: 82,
            ottTimePercent: 120,
            envelopeBoostClampDb: 8,
        },
    }), { currentContract: contract }), /bypass.*boolean/i);
    assert.throws(() => normalizeEffectPresetV2(validPreset(contract, {
        parameters: {
            bypass: false,
            ottMix: Number.NaN,
            ottTimePercent: 120,
            envelopeBoostClampDb: 8,
        },
    }), { currentContract: contract }), /ottMix.*finite/i);
});

test("v2_capture_fails_when_any_current_parameter_value_is_missing", async () => {
    const { captureEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });

    assert.throws(() => captureEffectPresetV2({
        effectID: "ott",
        presetID: "user.ott.missing",
        label: "Missing",
        currentContract: contract,
        currentParameterValues: {
            bypass: false,
            ottMix: 82,
            ottTimePercent: 120,
        },
    }), /missing.*envelopeBoostClampDb/i);
});

test("v2_capture_includes_every_current_parameter_and_every_adapter_state", async () => {
    const { captureEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({
        buildContract: buildCanonicalPluginStateContract,
        effectID: "seqfx",
        parameters: [{ endpointID: "patternSelect", type: "integer", min: 0, max: 11, defaultValue: 0 }],
        storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
    });

    const preset = captureEffectPresetV2({
        effectID: "seqfx",
        presetID: "user.seqfx.matrix",
        label: "Matrix",
        currentContract: contract,
        currentParameterValues: { patternSelect: 7 },
        storedStateAdapters: [{
            key: "seqfx.v1",
            schemaVersion: 1,
            capture: () => "all-patterns",
            normalizeForPreset: (value) => value,
            serializeForPreset: (value) => value,
        }],
    });

    assert.deepEqual(preset.parameters, { patternSelect: 7 });
    assert.deepEqual(preset.storedState, { "seqfx.v1": "all-patterns" });
    assert.equal(preset.contract.hash, contract.hash);
});

test("v2_apply_validates_full_payload_before_first_write", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contract = baseContract({ buildContract: buildCanonicalPluginStateContract });
    const patchConnection = new Recorder();

    assert.throws(() => applyEffectPresetV2({
        preset: validPreset(contract, {
            parameters: {
                bypass: false,
                ottMix: 101,
                ottTimePercent: 120,
                envelopeBoostClampDb: 8,
            },
        }),
        currentContract: contract,
        patchConnection,
    }), /ottMix.*above maximum 100/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("duplicate_json_keys_fail_before_import", async () => {
    const { parseEffectPresetV2Text } = await loadModules();

    assert.throws(() => parseEffectPresetV2Text(`{
        "kind": "cosimo.effectPreset",
        "kind": "cosimo.effectPreset"
    }`), /duplicate.*kind/i);
    assert.throws(() => parseEffectPresetV2Text(`{
        "parameters": {
            "ottMix": 20,
            "ott\\u004dix": 80
        }
    }`), /duplicate.*ottMix/i);
});
