import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultMsegShape,
    renderMsegShape,
} from "../patch_gui/mseg.js";
import {
    MODULATION_CLEAR_ENDPOINT_ID,
    MODULATION_ENABLE_ENDPOINT_ID,
    MODULATION_ENV_ENDPOINT_ID,
    MODULATION_MAX_ROUTES,
    MODULATION_MSEG_BUFFER_ENDPOINT_ID,
    MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
    MODULATION_ROUTE_ENDPOINT_ID,
    MODULATION_STATE_KEY,
    ModulationRuntimeBridge,
    composeModulationAmount,
    createDefaultModulationState,
    formatModulationAmountEditingValue,
    getModulationAmountDepth,
    getModulationAmountSliderPosition,
    parseModulationAmountEditingValue,
    serializeModulationState,
} from "../patch_gui/modulation.js";

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.events = [];
        this.storedWrites = [];
        this.requestedKeys = [];
        this.storedStateListeners = new Set();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
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

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
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

function endpointEvents(connection, endpointID) {
    return connection.events.filter((entry) => entry.endpointID === endpointID);
}

function routeSummary(route) {
    return {
        enabled: route.enabled,
        sourceKind: route.sourceKind,
        sourceSlot: route.sourceSlot,
        polarity: route.polarity,
        targetKind: route.targetKind,
        amount: route.amount,
    };
}

async function flushMicrotasks(turns = 4) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

test("boot_without_saved_modulation_state_uploads_default_slots_envelopes_and_disabled_routes", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    const state = bridge.getState();
    assert.equal(state.msegSlots.length, 3);
    assert.equal(state.envelopeSlots.length, 3);
    assert.equal(state.routes.length, 1);
    assert.deepEqual(routeSummary(state.routes[0]), {
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: 0,
    });

    assert.deepEqual(
        endpointEvents(patchConnection, MODULATION_ENABLE_ENDPOINT_ID).map(({ value }) => value),
        [0, 1],
    );
    assert.equal(endpointEvents(patchConnection, MODULATION_CLEAR_ENDPOINT_ID).length, 1);
    assert.equal(endpointEvents(patchConnection, MODULATION_MSEG_BUFFER_ENDPOINT_ID).length, 3);
    assert.equal(endpointEvents(patchConnection, MODULATION_MSEG_PLAYBACK_ENDPOINT_ID).length, 3);
    assert.equal(endpointEvents(patchConnection, MODULATION_ENV_ENDPOINT_ID).length, 3);
    assert.equal(endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID).length, MODULATION_MAX_ROUTES);
    assert.deepEqual(endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID)[0].value, {
        routeIndex: 0,
        enabled: true,
        sourceKind: 1,
        sourceSlot: 1,
        polarityKind: 0,
        targetKind: 1,
        amount: 0,
    });
    assert.equal(endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID)[1].value.enabled, false);
});

test("boot_with_saved_modulation_state_restores_slots_envelopes_and_routes", () => {
    const customState = createDefaultModulationState();
    customState.msegSlots[1].shape = {
        ...createDefaultMsegShape("MSEG 2"),
        points: [
            { x: 0.0, y: 0.2, curvePower: 0.0 },
            { x: 0.5, y: 0.85, curvePower: 1.5 },
            { x: 1.0, y: 0.1, curvePower: 0.0 },
        ],
    };
    customState.envelopeSlots[2] = {
        name: "Env 3",
        attackSeconds: 0.25,
        decaySeconds: 0.5,
        sustain: 0.75,
        releaseSeconds: 0.9,
    };
    customState.routes = [{
        id: "boot-route-1",
        enabled: true,
        sourceKind: "env",
        sourceSlot: 3,
        polarity: "unipolar",
        targetKind: "filterCutoffOctaves",
        amount: 4.0,
    }];

    const patchConnection = new FakePatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(customState),
    });
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    const state = bridge.getState();
    assert.equal(state.msegSlots[1].shape.points.length, 3);
    assert.equal(state.envelopeSlots[2].attackSeconds, 0.25);
    assert.deepEqual(state.routes, customState.routes);

    const secondBufferUpload = endpointEvents(patchConnection, MODULATION_MSEG_BUFFER_ENDPOINT_ID)[1];
    assert.deepEqual(secondBufferUpload.value.buffer, Array.from(renderMsegShape(customState.msegSlots[1].shape)));

    const firstRouteUpload = endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID)[0];
    assert.deepEqual(firstRouteUpload.value, {
        routeIndex: 0,
        enabled: true,
        sourceKind: 2,
        sourceSlot: 3,
        polarityKind: 0,
        targetKind: 3,
        amount: 4,
    });
});

test("editing_one_mseg_slot_persists_modulation_v1_and_reuploads_only_that_slot_buffer", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    bridge.setMsegSlotShape(0, {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.15, curvePower: 0.0 },
            { x: 0.25, y: 0.8, curvePower: 0.0 },
            { x: 1.0, y: 0.65, curvePower: 0.0 },
        ],
    });

    assert.equal(patchConnection.storedWrites.some(({ key }) => key === MODULATION_STATE_KEY), true);
    assert.equal(endpointEvents(patchConnection, MODULATION_MSEG_BUFFER_ENDPOINT_ID).length, 1);
    assert.equal(endpointEvents(patchConnection, MODULATION_MSEG_PLAYBACK_ENDPOINT_ID).length, 0);
    assert.equal(endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID).length, 0);
});

test("replacing_routes_preserves_signed_amounts_and_disables_the_unused_tail", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];

    bridge.replaceRoutes([
        {
            id: "route-a",
            enabled: true,
            sourceKind: "env",
            sourceSlot: 2,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: -2.5,
        },
        {
            id: "route-b",
            enabled: true,
            sourceKind: "velocity",
            sourceSlot: null,
            polarity: "bipolar",
            targetKind: "pan",
            amount: 0.5,
        },
    ]);

    const uploads = endpointEvents(patchConnection, MODULATION_ROUTE_ENDPOINT_ID);
    assert.equal(uploads.length, MODULATION_MAX_ROUTES);
    assert.deepEqual(uploads[0].value, {
        routeIndex: 0,
        enabled: true,
        sourceKind: 2,
        sourceSlot: 2,
        polarityKind: 0,
        targetKind: 3,
        amount: -2.5,
    });
    assert.deepEqual(uploads[1].value, {
        routeIndex: 1,
        enabled: true,
        sourceKind: 3,
        sourceSlot: 0,
        polarityKind: 1,
        targetKind: 7,
        amount: 0.5,
    });
    assert.equal(uploads.at(-1).value.enabled, false);
});

test("async stored-state echoes do not retrigger modulation uploads", async () => {
    const patchConnection = new AsyncEchoPatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    const uploadCountBeforeEchoes = patchConnection.events.length;
    await flushMicrotasks();
    const uploadCountAfterEchoes = patchConnection.events.length;
    await flushMicrotasks();

    assert.equal(uploadCountAfterEchoes, uploadCountBeforeEchoes);
    assert.equal(patchConnection.events.length, uploadCountBeforeEchoes);
});

test("zero-centered route amount mapping keeps zero at the midpoint and uses side-specific depth", () => {
    assert.equal(composeModulationAmount("warpAmount", 0.5), 0);
    assert.equal(composeModulationAmount("warpAmount", 0), -1);
    assert.equal(composeModulationAmount("warpAmount", 1), 1);
    assert.equal(composeModulationAmount("ampGainDb", 0.5), 0);
    assert.equal(composeModulationAmount("ampGainDb", 0), -48);
    assert.equal(composeModulationAmount("ampGainDb", 1), 6);

    assert.equal(getModulationAmountSliderPosition("warpAmount", 0), 0.5);
    assert.equal(getModulationAmountSliderPosition("warpAmount", -1), 0);
    assert.equal(getModulationAmountSliderPosition("warpAmount", 1), 1);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", -48), 0);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", 0), 0.5);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", 6), 1);

    assert.equal(getModulationAmountDepth("ampGainDb", -24), 0.5);
    assert.equal(getModulationAmountDepth("ampGainDb", 3), 0.5);
});

test("matrix amount text entry uses user-facing units instead of raw route amounts", () => {
    assert.equal(formatModulationAmountEditingValue("warpAmount", 0.12), "12");
    assert.equal(parseModulationAmountEditingValue("warpAmount", "12"), 0.12);
    assert.equal(parseModulationAmountEditingValue("pan", "-40"), -0.4);
    assert.equal(parseModulationAmountEditingValue("pan", "40L"), -0.4);
    assert.equal(parseModulationAmountEditingValue("pitchSemitones", "12"), 12);
});
