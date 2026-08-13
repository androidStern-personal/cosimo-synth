import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const adapterModulePromise = loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.storedWrites = [];
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

    sendEventOrValue() {}

    emitStoredStateValue(key, value) {
        for (const listener of this.storedListeners) listener({ key, value });
    }
}

function abcWavetableRoutes(modulation) {
    return ["A", "B", "C"].map((oscillator, index) => modulation.createDefaultRoute({
        id: `wavetable.index::mseg-${index + 1}`,
        sourceKind: "mseg",
        sourceSlot: index + 1,
        targetKind: `osc${oscillator}.wavetablePosition`,
        amount: 0.25 + index * 0.1,
    }));
}

function mismatchState(modulation) {
    return {
        ...modulation.createDefaultModulationState(),
        routes: [modulation.createDefaultRoute({
            id: "wavetable.index::mseg-1",
            sourceKind: "mseg",
            sourceSlot: 1,
            targetKind: "oscB.warpAmount",
            amount: 0.25,
        })],
    };
}

function mappingSummary(snapshot) {
    return snapshot.patch.mappings.map((mapping) => ({
        id: String(mapping.id),
        targetId: String(mapping.targetId),
        sourceId: String(mapping.sourceId),
    }));
}

test("bridge hydration accepts canonical A/B/C routes sharing one display descriptor policy", async () => {
    const [adapterModule, modulation] = await Promise.all([adapterModulePromise, modulationModulePromise]);
    const current = {
        ...modulation.createDefaultModulationState(),
        routes: abcWavetableRoutes(modulation),
    };
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(current),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });

    assert.equal(adapter.getSnapshot().connection._tag, "ready");
    assert.deepEqual(mappingSummary(adapter.getSnapshot()), [
        { id: "wavetable.index::mseg-1", targetId: "wavetable.index", sourceId: "mseg-1" },
        { id: "wavetable.index::mseg-2", targetId: "wavetable.index", sourceId: "mseg-2" },
        { id: "wavetable.index::mseg-3", targetId: "wavetable.index", sourceId: "mseg-3" },
    ]);
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});

test("bridge hydration rejects a route whose target kind conflicts with its display descriptor", async () => {
    const [adapterModule, modulation] = await Promise.all([adapterModulePromise, modulationModulePromise]);
    const mismatch = mismatchState(modulation);
    assert.equal(modulation.parseModulationState(mismatch)._tag, "ok");
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(mismatch),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });

    assert.deepEqual(adapter.getSnapshot().connection, {
        _tag: "detached",
        reason: "modulation.v4 contains a mapping without its canonical current identity",
    });
    assert.deepEqual(mappingSummary(adapter.getSnapshot()), []);
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});

test("a live descriptor mismatch detaches while retaining the last accepted A/B/C mappings", async () => {
    const [adapterModule, modulation] = await Promise.all([adapterModulePromise, modulationModulePromise]);
    const current = {
        ...modulation.createDefaultModulationState(),
        routes: abcWavetableRoutes(modulation),
    };
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(current),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });
    const acceptedMappings = mappingSummary(adapter.getSnapshot());

    connection.emitStoredStateValue(
        modulation.MODULATION_STATE_KEY,
        modulation.serializeModulationState(mismatchState(modulation)),
    );

    assert.equal(adapter.getSnapshot().connection._tag, "detached");
    assert.deepEqual(mappingSummary(adapter.getSnapshot()), acceptedMappings);
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});
