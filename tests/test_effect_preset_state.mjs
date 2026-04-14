import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadStoreModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-store.ts");
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

function ottPreset(overrides = {}) {
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
        },
        ...overrides,
    };
}

function chorusPreset(overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "chorus",
        presetID: "user.chorus.wide",
        label: "Wide",
        values: {
            chorusEnabled: true,
            chorusMix: 0.62,
            chorusMotionMode: 2,
        },
        ...overrides,
    };
}

function storedPresetState(overrides = {}) {
    return JSON.stringify({
        kind: "cosimo.effectPresetState",
        version: 1,
        userPresets: {},
        activePresetByEffect: {},
        ...overrides,
    });
}

function parseStoredWrite(write) {
    assert.equal(typeof write.value, "string");
    return JSON.parse(write.value);
}

function expectedOttApplyGestures() {
    return [
        { kind: "start", endpointID: "ottMix" },
        { kind: "end", endpointID: "ottMix" },
        { kind: "start", endpointID: "ottAmount" },
        { kind: "end", endpointID: "ottAmount" },
        { kind: "start", endpointID: "ottTimePercent" },
        { kind: "end", endpointID: "ottTimePercent" },
        { kind: "start", endpointID: "ottBandDrive" },
        { kind: "end", endpointID: "ottBandDrive" },
        { kind: "start", endpointID: "ottEnvelopeMatch" },
        { kind: "end", endpointID: "ottEnvelopeMatch" },
    ];
}

class FakePatchConnection {
    constructor(storedState = {}, parameterValues = {}) {
        this.storedState = { ...storedState };
        this.parameterValues = { ...parameterValues };
        this.events = [];
        this.gestures = [];
        this.storedWrites = [];
        this.requestedKeys = [];
        this.fullStateRequestCount = 0;
        this.storedStateListeners = new Set();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        this.fullStateRequestCount += 1;
        callback({ ...this.storedState });
    }

    requestStoredStateValue(key) {
        this.requestedKeys.push(key);
        for (const listener of this.storedStateListeners) {
            listener({ key, value: this.storedState[key] });
        }
    }

    sendStoredStateValue(key, value) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    sendParameterGestureStart(endpointID) {
        this.gestures.push({ kind: "start", endpointID });
    }

    sendEventOrValue(endpointID, value) {
        this.parameterValues[endpointID] = value;
        this.events.push({ endpointID, value });
    }

    sendParameterGestureEnd(endpointID) {
        this.gestures.push({ kind: "end", endpointID });
    }
}

class KeyOnlyStoredStatePatchConnection extends FakePatchConnection {
    requestFullStoredState = undefined;
}

class NoParameterWritePatchConnection extends FakePatchConnection {
    sendEventOrValue = undefined;
}

class ThrowingStoredStatePatchConnection extends FakePatchConnection {
    sendStoredStateValue() {
        throw new Error("stored state write failed");
    }
}

class AsyncEchoPatchConnection extends FakePatchConnection {
    sendStoredStateValue(key, value) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });
        queueMicrotask(() => {
            for (const listener of this.storedStateListeners) {
                listener({ key, value });
            }
        });
    }
}

async function flushMicrotasks(turns = 4) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

test("boot_hydrates_preset_metadata_from_request_full_stored_state_without_replaying_values", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                ott: [ottPreset()],
            },
            activePresetByEffect: {
                ott: {
                    presetID: "user.ott.soft-smash",
                    label: "Soft Smash",
                    dirty: false,
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.equal(patchConnection.fullStateRequestCount, 1);
    assert.deepEqual(bridge.getState().activePresetByEffect, {
        ott: {
            presetID: "user.ott.soft-smash",
            label: "Soft Smash",
            dirty: false,
        },
    });
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
});

test("boot_hydrates_active_label_and_dirty_metadata_from_stored_state", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                ott: [ottPreset()],
            },
            activePresetByEffect: {
                ott: {
                    presetID: "user.ott.soft-smash",
                    label: "Soft Smash Edited",
                    dirty: true,
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState().activePresetByEffect, {
        ott: {
            presetID: "user.ott.soft-smash",
            label: "Soft Smash Edited",
            dirty: true,
        },
    });
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
});

test("boot_reads_requested_stored_state_value_when_only_key_state_api_is_available", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new KeyOnlyStoredStatePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                chorus: [chorusPreset()],
            },
            activePresetByEffect: {
                chorus: {
                    presetID: "user.chorus.wide",
                    label: "Wide",
                    dirty: false,
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(patchConnection.requestedKeys, [EFFECT_PRESETS_STATE_KEY]);
    assert.deepEqual(bridge.getState().activePresetByEffect, {
        chorus: {
            presetID: "user.chorus.wide",
            label: "Wide",
            dirty: false,
        },
    });
    assert.deepEqual(patchConnection.events, []);
});

test("saving_user_preset_merges_with_existing_effect_banks_and_persists_once", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                chorus: [chorusPreset()],
            },
            activePresetByEffect: {
                chorus: {
                    presetID: "user.chorus.wide",
                    label: "Wide",
                    dirty: false,
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    bridge.saveUserPreset(ottPreset());

    assert.equal(patchConnection.storedWrites.length, 1);
    assert.equal(patchConnection.storedWrites[0].key, EFFECT_PRESETS_STATE_KEY);

    const persisted = parseStoredWrite(patchConnection.storedWrites[0]);
    assert.deepEqual(persisted, {
        kind: "cosimo.effectPresetState",
        version: 1,
        userPresets: {
            chorus: [chorusPreset()],
            ott: [ottPreset()],
        },
        activePresetByEffect: {
            chorus: {
                presetID: "user.chorus.wide",
                label: "Wide",
                dirty: false,
            },
        },
    });
});

test("stored_state_self_echo_does_not_recurse_or_duplicate_user_presets", async () => {
    const {
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new AsyncEchoPatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    bridge.saveUserPreset(ottPreset());
    await flushMicrotasks();

    assert.equal(patchConnection.storedWrites.length, 1);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(bridge.getState().userPresets.ott.map((preset) => preset.presetID), ["user.ott.soft-smash"]);
});

test("applying_preset_updates_active_metadata_after_successful_parameter_writes", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    bridge.applyPreset(ottPreset());

    assert.deepEqual(patchConnection.events, [
        { endpointID: "ottMix", value: 82 },
        { endpointID: "ottAmount", value: 91 },
        { endpointID: "ottTimePercent", value: 100 },
        { endpointID: "ottBandDrive", value: 14 },
        { endpointID: "ottEnvelopeMatch", value: 63 },
    ]);
    assert.deepEqual(patchConnection.gestures, expectedOttApplyGestures());
    assert.equal(patchConnection.storedWrites.length, 1);
    assert.equal(patchConnection.storedWrites[0].key, EFFECT_PRESETS_STATE_KEY);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites[0]).activePresetByEffect, {
        ott: {
            presetID: "user.ott.soft-smash",
            label: "Soft Smash",
            dirty: false,
        },
    });
});

test("applying_preset_without_parameter_write_api_fails_without_active_metadata_write", async () => {
    const {
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new NoParameterWritePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    assert.throws(() => bridge.applyPreset(ottPreset()), /cannot apply.*parameter/i);
    assert.deepEqual(patchConnection.gestures, []);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
});

test("applying_preset_fails_before_parameter_writes_when_stored_state_persistence_throws", async () => {
    const {
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new ThrowingStoredStatePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.throws(() => bridge.applyPreset(ottPreset()), /stored state write failed/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
});

test("setting_active_metadata_persists_dirty_label_without_parameter_writes", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    bridge.applyPreset(ottPreset());
    patchConnection.events = [];
    patchConnection.gestures = [];
    patchConnection.storedWrites = [];

    bridge.setActivePresetMetadata("ott", {
        presetID: "user.ott.soft-smash",
        label: "Soft Smash Edited",
        dirty: true,
    });

    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
    assert.equal(patchConnection.storedWrites.length, 1);
    assert.equal(patchConnection.storedWrites[0].key, EFFECT_PRESETS_STATE_KEY);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites[0]).activePresetByEffect, {
        ott: {
            presetID: "user.ott.soft-smash",
            label: "Soft Smash Edited",
            dirty: true,
        },
    });
});

test("invalid_active_metadata_shape_fails_without_parameter_or_state_writes", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            activePresetByEffect: {
                ott: {
                    presetID: "user.ott.soft-smash",
                    label: "Soft Smash Edited",
                    dirty: "true",
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("unknown_active_metadata_fields_are_rejected_without_state_derivation", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            activePresetByEffect: {
                ott: {
                    presetID: "user.ott.soft-smash",
                    label: "Soft Smash Edited",
                    dirty: true,
                    obsoleteField: true,
                },
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored_preset_banks_reject_presets_for_a_different_effect", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                ott: [chorusPreset()],
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("string_active_preset_state_is_rejected_without_state_derivation", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        createDefaultEffectPresetState,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: JSON.stringify({
            kind: "cosimo.effectPresetState",
            version: 1,
            userPresets: {
                ott: [ottPreset()],
            },
            activePresetByEffect: {
                ott: "user.ott.soft-smash",
            },
        }),
    });
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), createDefaultEffectPresetState());
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("malformed_json_import_fails_without_parameter_or_state_writes", async () => {
    const { EffectPresetRuntimeBridge } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    assert.throws(() => bridge.importPresetText("{"), /json|parse/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("duplicate_endpoint_import_fails_without_parameter_or_state_writes", async () => {
    const { EffectPresetRuntimeBridge } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    assert.throws(() => bridge.importPresetText(`{
        "kind": "cosimo.effectPreset",
        "version": 1,
        "effectID": "ott",
        "presetID": "user.ott.duplicate",
        "label": "Duplicate",
        "values": {
            "ottMix": 20,
            "ottMix": 80
        }
    }`), /duplicate.*ottMix/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("escaped_duplicate_endpoint_import_fails_without_parameter_or_state_writes", async () => {
    const { EffectPresetRuntimeBridge } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    assert.throws(() => bridge.importPresetText(`{
        "kind": "cosimo.effectPreset",
        "version": 1,
        "effectID": "ott",
        "presetID": "user.ott.escaped-duplicate",
        "label": "Escaped Duplicate",
        "values": {
            "ottMix": 20,
            "ott\\u004dix": 80
        }
    }`), /duplicate.*ottMix/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("unsupported_preset_version_fails_without_parameter_or_state_writes", async () => {
    const { EffectPresetRuntimeBridge } = await loadStoreModule();
    const patchConnection = new FakePatchConnection();
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();
    patchConnection.storedWrites = [];

    assert.throws(() => bridge.importPresetText(JSON.stringify(ottPreset({ version: 999 }))), /version/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("project_reload_uses_host_parameter_values_and_stored_preset_metadata", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const restoredHostParameterValues = {
        ottMix: 37,
        ottAmount: 44,
        ottTimePercent: 225,
        ottBandDrive: 19,
        ottEnvelopeMatch: 12,
    };
    const patchConnection = new FakePatchConnection({
        [EFFECT_PRESETS_STATE_KEY]: storedPresetState({
            userPresets: {
                ott: [ottPreset({
                    values: {
                        ottMix: 100,
                        ottAmount: 100,
                        ottTimePercent: 10,
                        ottBandDrive: 0,
                        ottEnvelopeMatch: 100,
                    },
                })],
            },
            activePresetByEffect: {
                ott: {
                    presetID: "user.ott.soft-smash",
                    label: "Soft Smash",
                    dirty: false,
                },
            },
        }),
    }, restoredHostParameterValues);
    const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState().activePresetByEffect, {
        ott: {
            presetID: "user.ott.soft-smash",
            label: "Soft Smash",
            dirty: false,
        },
    });
    assert.deepEqual(patchConnection.parameterValues, restoredHostParameterValues);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.gestures, []);
});

test("production_preset_controller_does_not_require_local_storage", async () => {
    const {
        EFFECT_PRESETS_STATE_KEY,
        EffectPresetRuntimeBridge,
    } = await loadStoreModule();
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
            getItem() {
                throw new Error("localStorage must not be read by production presets");
            },
            setItem() {
                throw new Error("localStorage must not be written by production presets");
            },
        },
    });

    try {
        const patchConnection = new FakePatchConnection();
        const bridge = new EffectPresetRuntimeBridge(patchConnection, createDescriptorRegistry());

        bridge.attach();
        bridge.requestBootState();
        bridge.saveUserPreset(ottPreset());
        bridge.applyPreset(ottPreset());

        assert.deepEqual(patchConnection.storedWrites.map((write) => write.key), [
            EFFECT_PRESETS_STATE_KEY,
            EFFECT_PRESETS_STATE_KEY,
        ]);
        assert.deepEqual(patchConnection.events, [
            { endpointID: "ottMix", value: 82 },
            { endpointID: "ottAmount", value: 91 },
            { endpointID: "ottTimePercent", value: 100 },
            { endpointID: "ottBandDrive", value: 14 },
            { endpointID: "ottEnvelopeMatch", value: 63 },
        ]);
    } finally {
        if (descriptor) {
            Object.defineProperty(globalThis, "localStorage", descriptor);
        } else {
            delete globalThis.localStorage;
        }
    }
});
