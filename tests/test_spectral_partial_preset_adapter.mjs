import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-runtime-bridge.ts");
const adapterModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-preset-adapter.ts");

const {
    SPECTRAL_PARTIAL_STATE_KEY,
    applySpectralPartialPreset,
    createDefaultSpectralPartialState,
    serializeSpectralPartialState,
} = stateModule;

const {
    SpectralPartialShapeRuntimeBridge,
} = bridgeModule;

const {
    createSpectralPartialPresetStateAdapter,
} = adapterModule;

class FakePatchConnection {
    constructor() {
        this.events = [];
        this.storedWrites = [];
        this.storedStateListeners = new Set();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ values: {} });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }
}

test("spectral_partial_adapter_contract_registers_required_v1_state", () => {
    const connection = new FakePatchConnection();
    const bridge = new SpectralPartialShapeRuntimeBridge(connection);
    const adapter = createSpectralPartialPresetStateAdapter({ bridge, patchConnection: connection });

    assert.deepEqual(adapter.getContract(), {
        key: SPECTRAL_PARTIAL_STATE_KEY,
        schemaVersion: 1,
        required: true,
    });
});

test("spectral_partial_adapter_captures_and_applies_through_bridge", () => {
    const connection = new FakePatchConnection();
    const bridge = new SpectralPartialShapeRuntimeBridge(connection);
    const adapter = createSpectralPartialPresetStateAdapter({ bridge, patchConnection: connection });
    const square = applySpectralPartialPreset(createDefaultSpectralPartialState(), "square");

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];

    adapter.apply(serializeSpectralPartialState(square));

    const captured = JSON.parse(adapter.capture());

    assert.equal(captured.preset, "square");
    assert.equal(captured.values[1], 0);
    assert.equal(connection.storedWrites.length, 1);
    assert.equal(connection.storedWrites[0].key, SPECTRAL_PARTIAL_STATE_KEY);
    assert.equal(connection.events.length, 1);
    assert.equal(connection.events[0].endpointID, "partialShapeUpload");
});
