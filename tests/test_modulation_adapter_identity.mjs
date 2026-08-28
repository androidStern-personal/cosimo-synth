import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const adapterModulePromise = loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const targetsModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
const runtimeModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
const descriptorsModulePromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

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
        id: `osc${oscillator}.framePosition::mseg-1`,
        sourceKind: "mseg",
        sourceSlot: 1,
        targetKind: `osc${oscillator}.wavetablePosition`,
        amount: 0.25 + index * 0.1,
    }));
}

function mismatchState(modulation) {
    return {
        ...modulation.createDefaultModulationState(),
        routes: [modulation.createDefaultRoute({
            id: "oscB.framePosition::mseg-1",
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

function bridgeSourceId(source) {
    if (source.id === "amp-envelope") return source.id;
    return source.sourceKind === "env" ? `envelope-${source.sourceSlot}` : source.id;
}

test("bridge hydration preserves distinct canonical A/B/C cells from the same source", async () => {
    const [adapterModule, modulation, targets, runtime, descriptors] = await Promise.all([
        adapterModulePromise,
        modulationModulePromise,
        targetsModulePromise,
        runtimeModulePromise,
        descriptorsModulePromise,
    ]);
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
        { id: "oscA.framePosition::mseg-1", targetId: "oscA.framePosition", sourceId: "mseg-1" },
        { id: "oscB.framePosition::mseg-1", targetId: "oscB.framePosition", sourceId: "mseg-1" },
        { id: "oscC.framePosition::mseg-1", targetId: "oscC.framePosition", sourceId: "mseg-1" },
    ]);
    assert.deepEqual(adapter.getSnapshot().patch.mappings.map((mapping) => {
        const parsedTarget = descriptors.parseTargetId(String(mapping.targetId));
        assert.equal(parsedTarget._tag, "ok");
        const targetKind = descriptors.getTargetDescriptor(parsedTarget.value).modulationTargetKind;
        assert.notEqual(targetKind, null);
        const source = targets.parseModulationSourceIdentity(String(mapping.sourceId));
        assert.notEqual(source, null);
        const cell = runtime.getModulationRuntimeCell(modulation.createDefaultRoute({
            id: String(mapping.id),
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            targetKind,
        }));
        return {
            id: String(mapping.id),
            targetKind,
            targetIndex: cell.targetIndex,
            sourceIndex: cell.sourceIndex,
        };
    }), [
        { id: "oscA.framePosition::mseg-1", targetKind: "oscA.wavetablePosition", targetIndex: 0, sourceIndex: 0 },
        { id: "oscB.framePosition::mseg-1", targetKind: "oscB.wavetablePosition", targetIndex: 10, sourceIndex: 0 },
        { id: "oscC.framePosition::mseg-1", targetKind: "oscC.wavetablePosition", targetIndex: 20, sourceIndex: 0 },
    ]);
    assert.deepEqual(connection.storedWrites, []);
    adapter.dispose();
});

test("bridge hydration accepts all 1372 canonical cells without identity collisions", async () => {
    const [adapterModule, modulation, targets, descriptors] = await Promise.all([
        adapterModulePromise,
        modulationModulePromise,
        targetsModulePromise,
        descriptorsModulePromise,
    ]);
    const descriptorByKind = new Map(descriptors.allTargetDescriptors().flatMap((descriptor) => (
        descriptor.modulationTargetKind === null ? [] : [[descriptor.modulationTargetKind, descriptor]]
    )));
    const routes = targets.MODULATION_SOURCE_IDENTITIES.flatMap((source) => (
        targets.MODULATION_TARGET_IDENTITIES.map((target) => {
            const descriptor = descriptorByKind.get(target.kind);
            assert.notEqual(descriptor, undefined, target.kind);
            return modulation.createDefaultRoute({
                id: `${descriptor.targetId}::${bridgeSourceId(source)}`,
                sourceKind: source.sourceKind,
                sourceSlot: source.sourceSlot,
                targetKind: target.kind,
            });
        })
    ));
    assert.equal(routes.length, 1372);
    assert.equal(new Set(routes.map((route) => route.id)).size, 1372);
    const current = { ...modulation.createDefaultModulationState(), routes };
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(current),
    });
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });
    const mappings = mappingSummary(adapter.getSnapshot());

    assert.equal(adapter.getSnapshot().connection._tag, "ready");
    assert.equal(mappings.length, 1372);
    assert.equal(new Set(mappings.map((mapping) => mapping.id)).size, 1372);
    assert.equal(new Set(mappings.map((mapping) => `${mapping.targetId}->${mapping.sourceId}`)).size, 1372);
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
        reason: "modulation.v6 contains a mapping without its canonical current identity",
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
