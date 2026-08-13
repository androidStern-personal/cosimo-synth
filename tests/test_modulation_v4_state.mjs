import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.listeners = new Set();
        this.storedWrites = [];
        this.requestedKeys = [];
    }

    addStoredStateValueListener(listener) {
        this.listeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.listeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    requestStoredStateValue(key) {
        this.requestedKeys.push(key);
        this.emitStoredStateValue(key, this.storedState[key]);
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }

    emitStoredStateValue(key, value) {
        for (const listener of this.listeners) listener({ key, value });
    }
}

function withOneRoute(modulation) {
    return {
        ...modulation.createDefaultModulationState(),
        routes: [modulation.createDefaultRoute({
            id: "current-route",
            sourceKind: "env",
            sourceSlot: 2,
            targetKind: "oscC.pan",
            amount: -0.5,
        })],
    };
}

test("modulation.v4 accepts only the exact current envelope", async () => {
    const modulation = await modulationModulePromise;
    const current = withOneRoute(modulation);
    assert.equal(modulation.MODULATION_STATE_KEY, "modulation.v4");
    assert.equal(modulation.MODULATION_STATE_VERSION, 4);
    assert.deepEqual(modulation.parseModulationState(current), { _tag: "ok", value: current });

    const withoutRoutes = { ...current };
    delete withoutRoutes.routes;
    const cases = [
        { ...current, version: 3 },
        { ...current, version: 5 },
        { ...current, format: "cosimo.modulation.future" },
        { ...current, unknown: true },
        withoutRoutes,
        { ...current, routes: [{ ...current.routes[0], targetKind: "pan" }] },
        { ...current, routes: [{ ...current.routes[0], targetKind: "futureTarget" }] },
        { ...current, routes: [{ ...current.routes[0], amount: Number.NaN }] },
        { ...current, routes: [{ ...current.routes[0], amount: Number.POSITIVE_INFINITY }] },
        { ...current, routes: [{ ...current.routes[0], amount: -2 }] },
        "{not-json",
        null,
    ];
    for (const candidate of cases) {
        assert.equal(modulation.parseModulationState(candidate)._tag, "err");
    }
});

test("legacy modulation state is ignored on cold boot and never rewritten", async () => {
    const modulation = await modulationModulePromise;
    const legacy = { ...withOneRoute(modulation), version: 2 };
    const connection = new FakePatchConnection({
        "modulation.v2": JSON.stringify(legacy),
    });
    const bridge = new modulation.ModulationRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), modulation.createDefaultModulationState());
    assert.deepEqual(connection.storedWrites, []);
    assert.equal(Object.hasOwn(connection.storedState, "modulation.v4"), false);
});

test("cold invalid v4 uses defaults without installing replacement state", async () => {
    const modulation = await modulationModulePromise;
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: JSON.stringify({
            ...withOneRoute(modulation),
            routes: [{ ...withOneRoute(modulation).routes[0], amount: 4 }],
        }),
    });
    const bridge = new modulation.ModulationRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), modulation.createDefaultModulationState());
    assert.deepEqual(connection.storedWrites, []);
});

test("live invalid v4 retains the last valid state without a repair write", async () => {
    const modulation = await modulationModulePromise;
    const valid = withOneRoute(modulation);
    const connection = new FakePatchConnection({
        [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(valid),
    });
    const bridge = new modulation.ModulationRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    const invalid = { ...valid, routes: [{ ...valid.routes[0], targetKind: "pan" }] };
    connection.emitStoredStateValue(modulation.MODULATION_STATE_KEY, JSON.stringify(invalid));

    assert.deepEqual(bridge.getState(), valid);
    assert.deepEqual(connection.storedWrites, []);
    assert.equal(bridge.setState(invalid), false);
    assert.deepEqual(bridge.getState(), valid);
    assert.deepEqual(connection.storedWrites, []);
});

test("fallback boot requests only the current key", async () => {
    const modulation = await modulationModulePromise;
    const connection = new FakePatchConnection();
    connection.requestFullStoredState = undefined;
    const bridge = new modulation.ModulationRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(connection.requestedKeys, ["modulation.v4"]);
    assert.deepEqual(connection.storedWrites, []);
});
