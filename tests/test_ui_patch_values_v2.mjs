import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const stateModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-runtime-base.ts");
const adapterModulePromise = loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts");

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.storedWrites = [];
        this.sentEvents = [];
        this.storedListeners = new Set();
        this.endpointListeners = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedListeners.delete(listener);
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });
    }

    emitStoredStateValue(key, value) {
        for (const listener of this.storedListeners) listener({ key, value });
    }
}

test("uiPatchValues.v2 accepts only a complete flat normalized-value record", async () => {
    const state = await stateModulePromise;
    const valid = state.createDefaultUiPatchValues();
    assert.equal(state.UI_PATCH_VALUES_STATE_KEY, "uiPatchValues.v2");
    assert.deepEqual(state.deserializeUiPatchValues(valid), valid);
    assert.deepEqual(state.deserializeUiPatchValues(JSON.stringify(valid)), valid);

    const missing = { ...valid };
    delete missing[Object.keys(missing)[0]];
    const unknown = { ...valid, "future.parameter": 0.5 };
    const targetId = Object.keys(valid)[0];
    const invalidDocuments = [
        undefined,
        "{not-json",
        null,
        [],
        { ...valid, [targetId]: "0.5" },
        { ...valid, [targetId]: { nested: 0.5 } },
        { ...valid, [targetId]: Number.NaN },
        { ...valid, [targetId]: Number.POSITIVE_INFINITY },
        { ...valid, [targetId]: -0.001 },
        { ...valid, [targetId]: 1.001 },
        missing,
        unknown,
    ];
    for (const document of invalidDocuments) {
        assert.throws(() => state.deserializeUiPatchValues(document));
    }
});

test("legacy uiPatchValues.v1 is ignored on cold boot without a rewrite", async () => {
    const [state, adapterModule] = await Promise.all([stateModulePromise, adapterModulePromise]);
    const legacy = { ...state.createDefaultUiPatchValues(), "wavetable.index": 0.17 };
    const connection = new FakePatchConnection({
        "uiPatchValues.v1": JSON.stringify(legacy),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });

    assert.equal(adapter.getSnapshot().connection._tag, "ready");
    assert.equal(
        adapter.getSnapshot().patch.parameterValues["wavetable.index"],
        state.createDefaultUiPatchValues()["wavetable.index"],
    );
    assert.deepEqual(connection.storedWrites, []);
    assert.equal(Object.hasOwn(connection.storedState, "uiPatchValues.v2"), false);
    adapter.dispose();
});

test("cold invalid v2 leaves defaults installed only in memory", async () => {
    const [state, adapterModule] = await Promise.all([stateModulePromise, adapterModulePromise]);
    const invalid = { ...state.createDefaultUiPatchValues(), unknown: 0.5 };
    const connection = new FakePatchConnection({
        [state.UI_PATCH_VALUES_STATE_KEY]: JSON.stringify(invalid),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });

    assert.equal(adapter.getSnapshot().connection._tag, "detached");
    assert.deepEqual(adapter.getSnapshot().patch.parameterValues, state.createDefaultUiPatchValues());
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});

test("live invalid v2 retains the prior complete record atomically", async () => {
    const [state, adapterModule] = await Promise.all([stateModulePromise, adapterModulePromise]);
    const valid = { ...state.createDefaultUiPatchValues(), "wavetable.index": 0.21 };
    const connection = new FakePatchConnection({
        [state.UI_PATCH_VALUES_STATE_KEY]: JSON.stringify(valid),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });
    assert.equal(adapter.getSnapshot().patch.parameterValues["wavetable.index"], 0.21);

    const invalid = { ...valid, "wavetable.index": 0.84, unknown: 0.5 };
    connection.emitStoredStateValue(state.UI_PATCH_VALUES_STATE_KEY, JSON.stringify(invalid));

    assert.equal(adapter.getSnapshot().connection._tag, "detached");
    assert.equal(adapter.getSnapshot().patch.parameterValues["wavetable.index"], 0.21);
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});
