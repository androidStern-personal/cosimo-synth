import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-runtime-bridge.ts");

const {
    SPECTRAL_PARTIAL_STATE_KEY,
    applySpectralPartialPreset,
    createDefaultSpectralPartialState,
    serializeSpectralPartialState,
    setSpectralPartialValue,
} = stateModule;

const {
    SPECTRAL_PARTIAL_ENDPOINTS,
    SpectralPartialShapeRuntimeBridge,
} = bridgeModule;

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
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
        callback({
            values: { ...this.storedState },
        });
    }

    requestStoredStateValue(key) {
        this.emitStoredState(key, this.storedState[key]);
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }

    emitStoredState(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }
}

class MissingFullStatePatchConnection extends FakePatchConnection {
    requestFullStoredState(callback) {
        callback({ values: {} });
    }
}

function partialUploads(connection) {
    return connection.events.filter((event) => event.endpointID === SPECTRAL_PARTIAL_ENDPOINTS.partialShapeUpload);
}

test("boot_with_saved_partial_shape_uploads_once_without_writing_stored_state", () => {
    const saved = applySpectralPartialPreset(createDefaultSpectralPartialState(), "square");
    const connection = new FakePatchConnection({
        [SPECTRAL_PARTIAL_STATE_KEY]: serializeSpectralPartialState(saved),
    });
    const bridge = new SpectralPartialShapeRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(partialUploads(connection).length, 1);
    assert.equal(partialUploads(connection)[0].value.count, saved.count);
    assert.equal(partialUploads(connection)[0].value.strengths[1], 0);
    assert.equal(bridge.getState().preset, "square");
});

test("boot_without_saved_state_uploads_default_shape_without_persisting", () => {
    const connection = new MissingFullStatePatchConnection();
    const bridge = new SpectralPartialShapeRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(partialUploads(connection).length, 1);
    assert.equal(partialUploads(connection)[0].value.count, 32);
    assert.equal(partialUploads(connection)[0].value.strengths[1], 0.5);
});

test("live_edit_batches_uploads_and_writes_once_on_commit", () => {
    const callbacks = [];
    const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
    const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
        callbacks.push(callback);
        return callbacks.length;
    };
    globalThis.cancelAnimationFrame = () => {};

    try {
        const connection = new FakePatchConnection();
        const bridge = new SpectralPartialShapeRuntimeBridge(connection);
        bridge.attach();
        bridge.requestBootState();
        connection.events = [];

        bridge.beginLiveEdit();
        bridge.setState(setSpectralPartialValue(bridge.getState(), 0, 0.2));
        bridge.setState(setSpectralPartialValue(bridge.getState(), 1, 0.8));

        assert.equal(connection.storedWrites.length, 0);
        assert.equal(partialUploads(connection).length, 0);
        assert.equal(callbacks.length, 1);

        callbacks.shift()();

        assert.equal(partialUploads(connection).length, 1);
        assert.equal(partialUploads(connection)[0].value.strengths[0], 0.2);
        assert.equal(partialUploads(connection)[0].value.strengths[1], 0.8);
        assert.equal(connection.storedWrites.length, 0);

        bridge.setState(setSpectralPartialValue(bridge.getState(), 2, 0.6));
        bridge.commitLiveEdit();

        assert.equal(partialUploads(connection).length, 2);
        assert.equal(partialUploads(connection)[1].value.strengths[2], 0.6);
        assert.equal(connection.storedWrites.length, 1);
    } finally {
        globalThis.requestAnimationFrame = previousRequestAnimationFrame;
        globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    }
});

test("stale_stored_echo_does_not_clobber_newer_local_state", () => {
    const connection = new FakePatchConnection();
    const bridge = new SpectralPartialShapeRuntimeBridge(connection);
    bridge.attach();
    bridge.requestBootState();

    const first = setSpectralPartialValue(bridge.getState(), 0, 0.25);
    bridge.setState(first);
    const firstSerialized = connection.storedWrites.at(-1).value;

    const second = setSpectralPartialValue(bridge.getState(), 0, 0.75);
    bridge.setState(second);

    connection.emitStoredState(SPECTRAL_PARTIAL_STATE_KEY, firstSerialized);

    assert.equal(bridge.getState().values[0], 0.75);
    assert.equal(connection.storedWrites.length, 2);
});

test("preset_apply_cancels_pending_live_edit_before_replacing_state", () => {
    const callbacks = [];
    const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
    const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
        callbacks.push(callback);
        return callbacks.length;
    };
    globalThis.cancelAnimationFrame = () => {};

    try {
        const connection = new FakePatchConnection();
        const bridge = new SpectralPartialShapeRuntimeBridge(connection);
        bridge.attach();
        bridge.requestBootState();
        connection.events = [];

        bridge.beginLiveEdit();
        bridge.setState(setSpectralPartialValue(bridge.getState(), 0, 0.12));
        bridge.replaceStateFromPreset(applySpectralPartialPreset(bridge.getState(), "flat"));
        callbacks.splice(0).forEach((callback) => callback());

        assert.equal(bridge.getState().preset, "flat");
        assert.equal(bridge.getState().values[0], 1);
        assert.equal(partialUploads(connection).at(-1).value.strengths[0], 1);
        assert.equal(connection.storedWrites.length, 1);
    } finally {
        globalThis.requestAnimationFrame = previousRequestAnimationFrame;
        globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    }
});
