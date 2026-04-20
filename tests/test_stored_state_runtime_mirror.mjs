import test from "node:test";
import assert from "node:assert/strict";

import {
    createStoredStateRuntimeMirror,
} from "../patch_gui/stored-state-runtime-mirror.js";
import {
    createPatchWorkerServiceHost,
} from "../patch_gui/patch-worker-services.js";

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.events = [];
        this.storedWrites = [];
        this.requestedStoredKeys = [];
        this.requestedParameters = [];
        this.fullStoredStateRequests = 0;
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();
        this.endpointListeners = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        this.fullStoredStateRequests += 1;
        callback({ ...this.storedState });
    }

    requestStoredStateValue(key) {
        this.requestedStoredKeys.push(key);
        this.emitStoredState(key, this.storedState[key]);
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
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
        this.requestedParameters.push(endpointID);
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    emitStoredState(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    emitParameter(endpointID, value) {
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    emitEndpoint(endpointID, value) {
        for (const listener of this.endpointListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

class OneTimeThrowingPatchConnection extends FakePatchConnection {
    throwOnLabelLength = true;

    sendEventOrValue(endpointID, value) {
        if (endpointID === "labelLength" && this.throwOnLabelLength) {
            this.throwOnLabelLength = false;
            throw new Error("Transient runtime send failure");
        }

        super.sendEventOrValue(endpointID, value);
    }
}

function deserializeLabel(value) {
    return typeof value === "string" && value.trim()
        ? { label: value.trim() }
        : { label: "default-label" };
}

function buildLabelRuntimeEvents({ state }) {
    return [
        { endpointID: "labelName", value: state.label },
        { endpointID: "labelLength", value: state.label.length },
    ];
}

test("stored-state runtime mirror uploads saved state without writing stored state", () => {
    const patchConnection = new FakePatchConnection({ "label.v1": "saved label" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();

    assert.equal(patchConnection.fullStoredStateRequests, 1);
    assert.deepEqual(patchConnection.requestedStoredKeys, []);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "saved label" },
        { endpointID: "labelLength", value: 11 },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror reads saved state from the Cmajor values bucket", () => {
    const patchConnection = new FakePatchConnection({ "label.v1": "bucket label" });
    patchConnection.requestFullStoredState = (callback) => {
        patchConnection.fullStoredStateRequests += 1;
        callback({
            parameters: {
                globalMix: 0.5,
            },
            values: {
                "label.v1": "bucket label",
            },
        });
    };
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();

    assert.equal(patchConnection.fullStoredStateRequests, 1);
    assert.deepEqual(patchConnection.requestedStoredKeys, []);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "bucket label" },
        { endpointID: "labelLength", value: 12 },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror can intentionally apply runtime defaults when state is missing", () => {
    const patchConnection = new FakePatchConnection();
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();

    assert.deepEqual(patchConnection.requestedStoredKeys, ["label.v1"]);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "default-label" },
        { endpointID: "labelLength", value: 13 },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror stays passive when missing state is not defaulted", () => {
    const patchConnection = new FakePatchConnection();
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();

    assert.deepEqual(patchConnection.requestedStoredKeys, ["label.v1"]);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror waits for requested parameters before uploading runtime state", () => {
    const patchConnection = new FakePatchConnection({ "pattern.v1": "pattern-a" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "pattern.v1",
        parameterEndpointIDs: ["patternSelect"],
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: ({ state, parameters }) => [
            {
                endpointID: "patternUpload",
                value: {
                    label: state.label,
                    selectedPattern: Number(parameters.patternSelect),
                },
            },
        ],
    });

    mirror.start();

    assert.deepEqual(patchConnection.requestedParameters, ["patternSelect"]);
    assert.deepEqual(patchConnection.events, []);

    patchConnection.emitParameter("patternSelect", 2);

    assert.deepEqual(patchConnection.events, [
        {
            endpointID: "patternUpload",
            value: {
                label: "pattern-a",
                selectedPattern: 2,
            },
        },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror can wait for a runtime endpoint epoch and reapplies when it changes", () => {
    const patchConnection = new FakePatchConnection({ "label.v1": "saved label" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        runtimeEndpointDependencies: [{
            endpointID: "runtimeState",
            required: true,
            mapValue: (value) => Number(value?.dspSessionId) || 0,
        }],
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();
    assert.deepEqual(patchConnection.events, []);

    patchConnection.emitEndpoint("runtimeState", { dspSessionId: 7 });
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "saved label" },
        { endpointID: "labelLength", value: 11 },
    ]);

    patchConnection.events = [];
    patchConnection.emitEndpoint("runtimeState", { dspSessionId: 7 });
    assert.deepEqual(patchConnection.events, []);

    patchConnection.emitEndpoint("runtimeState", { dspSessionId: 8 });
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "saved label" },
        { endpointID: "labelLength", value: 11 },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror retries the same snapshot after a runtime send failure", () => {
    const patchConnection = new OneTimeThrowingPatchConnection({ "label.v1": "saved label" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    assert.throws(() => mirror.start(), /Transient runtime send failure/);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "saved label" },
    ]);

    patchConnection.events = [];
    patchConnection.emitStoredState("label.v1", "saved label");

    assert.deepEqual(patchConnection.events, [
        { endpointID: "labelName", value: "saved label" },
        { endpointID: "labelLength", value: 11 },
    ]);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror stops listening after stop", () => {
    const patchConnection = new FakePatchConnection({ "label.v1": "first" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();
    patchConnection.events = [];

    mirror.stop();
    patchConnection.emitStoredState("label.v1", "second");

    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("stored-state runtime mirror removes parameter listeners after stop", () => {
    const patchConnection = new FakePatchConnection({ "pattern.v1": "pattern-a" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "pattern.v1",
        parameterEndpointIDs: ["patternSelect"],
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: ({ state, parameters }) => [
            {
                endpointID: "patternUpload",
                value: {
                    label: state.label,
                    selectedPattern: Number(parameters.patternSelect),
                },
            },
        ],
    });

    mirror.start();
    patchConnection.emitParameter("patternSelect", 1);
    assert.equal(patchConnection.events.length, 1);

    patchConnection.events = [];
    mirror.stop();
    patchConnection.emitStoredState("pattern.v1", "pattern-b");
    patchConnection.emitParameter("patternSelect", 2);

    assert.equal(patchConnection.parameterListeners.get("patternSelect")?.size, 0);
    assert.deepEqual(patchConnection.events, []);
});

test("stored-state runtime mirror removes runtime endpoint listeners after stop", () => {
    const patchConnection = new FakePatchConnection({ "label.v1": "saved label" });
    const mirror = createStoredStateRuntimeMirror(patchConnection, {
        stateKey: "label.v1",
        runtimeEndpointDependencies: [{
            endpointID: "runtimeState",
            required: true,
            mapValue: (value) => Number(value?.dspSessionId) || 0,
        }],
        deserializeStoredState: deserializeLabel,
        buildRuntimeEvents: buildLabelRuntimeEvents,
    });

    mirror.start();
    mirror.stop();
    patchConnection.emitEndpoint("runtimeState", { dspSessionId: 7 });

    assert.equal(patchConnection.endpointListeners.get("runtimeState")?.size, 0);
    assert.deepEqual(patchConnection.events, []);
});

test("patch worker service host starts services in order and stops them in reverse order", async () => {
    const calls = [];
    const patchConnection = new FakePatchConnection();
    const host = createPatchWorkerServiceHost(patchConnection, [
        () => ({
            start() {
                calls.push("start-a");
            },
            stop() {
                calls.push("stop-a");
            },
        }),
        {
            start() {
                calls.push("start-b");
            },
            stop() {
                calls.push("stop-b");
            },
        },
    ]);

    await host.start();
    assert.deepEqual(calls, ["start-a", "start-b"]);
    assert.equal(host.getServices().length, 2);

    await host.stop();
    assert.deepEqual(calls, ["start-a", "start-b", "stop-b", "stop-a"]);
    assert.deepEqual(host.getServices(), []);
});

test("patch worker service host stops already-created services when a later service fails to start", async () => {
    const calls = [];
    const patchConnection = new FakePatchConnection();
    const host = createPatchWorkerServiceHost(patchConnection, [
        {
            start() {
                calls.push("start-a");
            },
            stop() {
                calls.push("stop-a");
            },
        },
        {
            start() {
                calls.push("start-b");
                throw new Error("start-b failed");
            },
            stop() {
                calls.push("stop-b");
            },
        },
    ]);

    await assert.rejects(() => host.start(), /start-b failed/);

    assert.deepEqual(calls, ["start-a", "start-b", "stop-b", "stop-a"]);
    assert.deepEqual(host.getServices(), []);
});
