import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";
import { loadChannel, waitForModulation } from "./helpers/modulation_state_fixture.mjs";
import { createSynthParameterFixture } from "./helpers/synth_parameter_fixture.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulesPromise = Promise.all([
    loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts"),
    loadUIModule(repoRoot, "ui/shared/target-descriptor.ts"),
    loadUIModule(repoRoot, "ui/shared/mock-plugin-state-host.ts"),
]);

class FakePatchConnection {
    constructor(parameterValues = {}, storedState = {}) {
        this.parameterValues = new Map(Object.entries(parameterValues));
        this.storedState = { ...storedState };
        this.parameterListeners = new Map();
        this.storedListeners = new Set();
        this.sentEvents = [];
        this.storedWrites = [];
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID, listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID) {
        const value = this.parameterValues.get(endpointID);
        if (value !== undefined) {
            this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
        }
    }

    addStoredStateValueListener(listener) {
        this.storedListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });
        this.parameterValues.set(endpointID, value);
        this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    emitParameter(endpointID, value) {
        this.parameterValues.set(endpointID, value);
        this.observeParameter?.(endpointID);
        this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
    }
}

test("Cmajor parameters are the sole ordinary knob-value authority", async (t) => {
    const [adapterModule, descriptors, { createMockPluginStateHost }] = await modulesPromise;
    const targetID = "voice-filter.cutoff";
    const descriptor = descriptors.getTargetDescriptor(targetID);
    assert.equal(descriptor.binding._tag, "endpoint");
    const endpointID = descriptor.binding.endpointId;
    const { values, readParameter } = createSynthParameterFixture({ [endpointID]: descriptor.binding.toEngine(0.21) });
    const connection = new FakePatchConnection({
        ...Object.fromEntries(values),
    }, {
        "uiPatchValues.v1": JSON.stringify({ [targetID]: 0.91 }),
        "uiPatchValues.v2": JSON.stringify({ [targetID]: 0.84 }),
    });
    connection.parameterValues = values;
    const defects = [];
    // The actual shared owner accepts cutoff edits and observes native changes;
    // the fake connection substitutes only native parameter storage/publication.
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter,
        writeParameter: (endpoint, value) => connection.sendEventOrValue(endpoint, value),
        storedValues: { read: key => connection.storedState[key], write: (key, value) => connection.sendStoredStateValue(key, value) },
        beginGesture() {}, endGesture() {}, onDefect: error => defects.push(String(error)),
    });
    connection.addEventListener = host.addEventListener;
    connection.removeEventListener = host.removeEventListener;
    connection.sendMessageToServer = host.sendMessageToServer;
    connection.observeParameter = host.observeParameter;
    const adapter = adapterModule.createCosimoBridgeAdapter({ connection });
    t.after(async () => { adapter.dispose(); await host.stop(); assert.deepEqual(defects, []); });
    await host.ready;
    await waitForModulation(() => adapter.getSnapshot().connection._tag === "ready");
    assert.equal(adapter.getSnapshot().connection._tag, "ready");
    assert.equal(adapter.getSnapshot().patch.parameterValues[targetID], 0.21);
    assert.equal(connection.sentEvents.some((event) => event.endpointID === endpointID), false);
    assert.deepEqual(connection.storedWrites, []);

    adapter.commands.setParameter({
        targetId: targetID,
        value: 0.74,
        layer: { _tag: "patchBase" },
    });
    assert.equal(adapter.getSnapshot().patch.parameterValues[targetID], 0.74);
    await waitForModulation(() => connection.sentEvents.some(event => event.endpointID === endpointID));
    assert.deepEqual(connection.sentEvents.filter((event) => event.endpointID === endpointID), [{
        endpointID,
        value: descriptor.binding.toEngine(0.74),
    }]);
    assert.deepEqual(connection.storedWrites, []);

    connection.emitParameter(endpointID, descriptor.binding.toEngine(0.33));
    await waitForModulation(() => Math.abs(adapter.getSnapshot().patch.parameterValues[targetID] - 0.33) < 1e-12);
    assert.ok(Math.abs(adapter.getSnapshot().patch.parameterValues[targetID] - 0.33) < 1e-12);
    adapter.dispose();
});
