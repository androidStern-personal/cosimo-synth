import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultMsegShape,
    renderMsegShape,
} from "../patch_gui/mseg.js";
import {
    MODULATION_ENV_ENDPOINT_ID,
    MODULATION_MSEG_BUFFER_ENDPOINT_ID,
    MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
    MODULATION_STATE_KEY,
    ModulationRuntimeBridge,
    buildModulationRuntimeEvents,
    composeModulationAmount,
    createDefaultModulationState,
    deserializeModulationState,
    formatModulationAmountEditingValue,
    getModulationAmountDepth,
    getModulationAmountSliderPosition,
    normalizeModulationState,
    parseModulationAmountEditingValue,
    serializeModulationState,
} from "../patch_gui/modulation.js";
import { MODULATION_PROGRAM_ENDPOINT_ID } from "../patch_gui/modulation-runtime-program.js";

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

test("boot_without_saved_modulation_state_reads_defaults_without_runtime_uploading", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    const state = bridge.getState();
    assert.equal(state.msegSlots.length, 3);
    assert.equal(state.msegSlots[0].morph, 0);
    assert.deepEqual(state.msegSlots[0].shapeA, state.msegSlots[0].shapeB);
    assert.equal(state.envelopeSlots.length, 3);
    assert.equal(state.routes.length, 2);
    assert.deepEqual(routeSummary(state.routes[0]), {
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: 1,
    });
    assert.deepEqual(routeSummary(state.routes[1]), {
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "filterCutoffOctaves",
        amount: 4,
    });

    assert.deepEqual(patchConnection.events, []);
});

test("modulation state keeps one deterministic route per source-target pair", () => {
    const normalized = normalizeModulationState({
        routes: [
            {
                id: "first-pair-route",
                enabled: false,
                sourceKind: "env",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "rack.distortionWet",
                amount: -0.25,
                reducer: "mean",
            },
            {
                id: "duplicate-pair-route",
                enabled: true,
                sourceKind: "env",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "rack.distortionWet",
                amount: 0.8,
                reducer: "max",
            },
            {
                id: "different-source-route",
                enabled: true,
                sourceKind: "macro",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "rack.distortionWet",
                amount: 0.4,
                reducer: "max",
            },
        ],
    });

    assert.deepEqual(normalized.routes.map(({ id }) => id), [
        "first-pair-route",
        "different-source-route",
    ]);
    assert.equal(normalized.routes[0].enabled, false);
    assert.equal(normalized.routes[0].amount, -0.25);
});

test("modulation runtime event builder converts defaults into a complete Cmajor upload batch", () => {
    const events = buildModulationRuntimeEvents(createDefaultModulationState());

    assert.equal(endpointEvents({ events }, MODULATION_MSEG_BUFFER_ENDPOINT_ID).length, 6);
    assert.equal(endpointEvents({ events }, MODULATION_MSEG_PLAYBACK_ENDPOINT_ID).length, 3);
    assert.equal(endpointEvents({ events }, MODULATION_ENV_ENDPOINT_ID).length, 3);
    const program = endpointEvents({ events }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    assert.equal(program.voiceRouteCount, 2);
    assert.deepEqual(program.voiceRouteCells.slice(0, 2), [0, 2]);
    assert.deepEqual(program.voiceRouteSources.slice(0, 2), [0, 0]);
    assert.deepEqual(program.voiceRouteTargets.slice(0, 2), [0, 2]);
    assert.equal(program.voiceRouteAmounts[0], 1);
    assert.equal(program.voiceRouteAmounts[2], 4);
});

test("rack modulation compiles into the sparse voice-rack path with its reducer", () => {
    const state = createDefaultModulationState();
    state.routes = [{
        id: "rack-route",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "bipolar",
        targetKind: "rack.reverbDecay",
        amount: 0.35,
        reducer: "mean",
    }];
    const events = buildModulationRuntimeEvents(state);
    const program = endpointEvents({ events }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    assert.equal(program.voiceRackRouteCount, 1);
    assert.equal(program.voiceRackRouteCells[0], 33);
    assert.equal(program.voiceRackRouteSources[0], 0);
    assert.equal(program.voiceRackRouteTargets[0], 33);
    assert.equal(program.voiceRackRoutePolarities[0], 1);
    assert.equal(program.voiceRackRouteReducers[0], 2);
    assert.equal(program.voiceRackRouteAmounts[33], 0.35);
});

test("boot_with_saved_modulation_state_restores_ui_state_without_runtime_uploading", () => {
    const customState = createDefaultModulationState();
    customState.msegSlots[1].shapeA = {
        ...createDefaultMsegShape("MSEG 2"),
        points: [
            { x: 0.0, y: 0.2, curvePower: 0.0 },
            { x: 0.5, y: 0.85, curvePower: 1.5 },
            { x: 1.0, y: 0.1, curvePower: 0.0 },
        ],
    };
    customState.msegSlots[1].shapeB = {
        ...createDefaultMsegShape("MSEG 2 B"),
        points: [
            { x: 0.0, y: 0.8, curvePower: 0.0 },
            { x: 1.0, y: 0.2, curvePower: 0.0 },
        ],
    };
    customState.msegSlots[1].morph = 0.375;
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
        reducer: "max",
    }];

    const patchConnection = new FakePatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(customState),
    });
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    const state = bridge.getState();
    assert.equal(state.msegSlots[1].shapeA.points.length, 3);
    assert.equal(state.msegSlots[1].shapeB.points.length, 2);
    assert.equal(state.msegSlots[1].morph, 0.375);
    assert.equal(state.envelopeSlots[2].attackSeconds, 0.25);
    assert.deepEqual(state.routes, customState.routes);
    assert.deepEqual(patchConnection.events, []);
});

test("boot rejects a duplicate mapping document as a whole", () => {
    const invalidState = createDefaultModulationState();
    invalidState.routes = [
        {
            ...invalidState.routes[0],
            id: "first",
            targetKind: "pan",
            amount: -0.25,
        },
        {
            ...invalidState.routes[0],
            id: "duplicate",
            targetKind: "pan",
            amount: 0.75,
        },
    ];
    const patchConnection = new FakePatchConnection({
        [MODULATION_STATE_KEY]: JSON.stringify(invalidState),
    });
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();

    assert.deepEqual(bridge.getState(), createDefaultModulationState());
    assert.equal(patchConnection.storedWrites.length, 0);
});

test("live writes use the boot parser and retain the last valid state after whole-document rejection", () => {
    const validState = createDefaultModulationState();
    validState.routes = [{
        ...validState.routes[0],
        id: "valid-route",
        targetKind: "pan",
        amount: -0.25,
    }];
    const patchConnection = new FakePatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(validState),
    });
    const bridge = new ModulationRuntimeBridge(patchConnection);
    bridge.attach();
    bridge.requestBootState();

    const invalidState = {
        ...validState,
        routes: [
            validState.routes[0],
            {
                ...validState.routes[0],
                id: "duplicate-route",
                amount: 0.75,
            },
        ],
    };
    patchConnection.sendStoredStateValue(MODULATION_STATE_KEY, JSON.stringify(invalidState));

    assert.deepEqual(bridge.getState(), validState);
});

test("direct live state replacement rejects malformed documents without wiping or persisting", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);
    const validState = createDefaultModulationState();

    bridge.setState(validState);
    const writesBeforeRejection = patchConnection.storedWrites.length;

    assert.equal(bridge.setState({ format: "legacy", routes: "broken" }), false);
    assert.deepEqual(bridge.getState(), validState);
    assert.equal(patchConnection.storedWrites.length, writesBeforeRejection);
});

test("modulation runtime event builder converts saved state into slot_envelope_and_route_uploads", () => {
    const customState = createDefaultModulationState();
    customState.msegSlots[1].shapeA = {
        ...createDefaultMsegShape("MSEG 2"),
        points: [
            { x: 0.0, y: 0.2, curvePower: 0.0 },
            { x: 0.5, y: 0.85, curvePower: 1.5 },
            { x: 1.0, y: 0.1, curvePower: 0.0 },
        ],
    };
    customState.msegSlots[1].shapeB = {
        ...createDefaultMsegShape("MSEG 2 B"),
        points: [
            { x: 0.0, y: 0.9, curvePower: 0.0 },
            { x: 1.0, y: 0.4, curvePower: 0.0 },
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
        reducer: "max",
    }];

    const events = buildModulationRuntimeEvents(customState);

    const bufferUploads = endpointEvents({ events }, MODULATION_MSEG_BUFFER_ENDPOINT_ID);
    const secondSlotShapeAUpload = bufferUploads.find(({ value }) => value.slot === 2 && value.shapeIndex === 0);
    const secondSlotShapeBUpload = bufferUploads.find(({ value }) => value.slot === 2 && value.shapeIndex === 1);
    assert.deepEqual(secondSlotShapeAUpload.value.buffer, Array.from(renderMsegShape(customState.msegSlots[1].shapeA)));
    assert.deepEqual(secondSlotShapeBUpload.value.buffer, Array.from(renderMsegShape(customState.msegSlots[1].shapeB)));

    const program = endpointEvents({ events }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    assert.equal(program.voiceRouteCount, 1);
    assert.equal(program.voiceRouteCells[0], 62);
    assert.equal(program.voiceRouteSources[0], 5);
    assert.equal(program.voiceRouteTargets[0], 2);
    assert.equal(program.voiceRouteAmounts[62], 4);
});

test("editing_one_mseg_slot_persists_modulation_v2_without_runtime_uploading", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    bridge.setMsegSlotShape(0, 0, {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.15, curvePower: 0.0 },
            { x: 0.25, y: 0.8, curvePower: 0.0 },
            { x: 1.0, y: 0.65, curvePower: 0.0 },
        ],
    });

    assert.equal(patchConnection.storedWrites.some(({ key }) => key === MODULATION_STATE_KEY), true);
    const savedState = deserializeModulationState(patchConnection.storedWrites.at(-1).value);
    assert.equal(savedState.version, 2);
    assert.equal(savedState.msegSlots[0].shapeA.points.length, 3);
    assert.equal(savedState.msegSlots[0].shapeB.points.length, 2);
    assert.deepEqual(patchConnection.events, []);
});

test("editing_shape_b_only_changes_shape_b_and_edit_focus_does_not_change_morph", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    const controller = bridge.getMsegSlotController(0);
    controller.setEditShapeIndex(1);
    assert.equal(controller.getState().editShapeIndex, 1);
    assert.equal(bridge.getState().msegSlots[0].morph, 0);
    assert.equal(patchConnection.storedWrites.length, 0);

    controller.setShape({
        ...createDefaultMsegShape("MSEG 1 B"),
        points: [
            { x: 0.0, y: 0.95, curvePower: 0.0 },
            { x: 1.0, y: 0.05, curvePower: 0.0 },
        ],
    });

    const savedState = deserializeModulationState(patchConnection.storedWrites.at(-1).value);
    assert.equal(savedState.msegSlots[0].shapeA.points[0].y, 0);
    assert.equal(savedState.msegSlots[0].shapeB.points[0].y, 0.95);
    assert.equal(savedState.msegSlots[0].morph, 0);
    assert.deepEqual(patchConnection.events, []);
});

test("editing_morph_persists_without_uploading_mseg_buffers_or_retriggering", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    bridge.setMsegSlotMorph(0, 0.625);

    assert.equal(patchConnection.storedWrites.length, 1);
    const savedState = deserializeModulationState(patchConnection.storedWrites[0].value);
    assert.equal(savedState.msegSlots[0].morph, 0.625);
    assert.deepEqual(patchConnection.events, []);
});

test("replacing routes preserves signed amounts and compiles only active mappings", () => {
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
            reducer: "max",
        },
        {
            id: "route-b",
            enabled: true,
            sourceKind: "velocity",
            sourceSlot: null,
            polarity: "bipolar",
            targetKind: "pan",
            amount: 0.5,
            reducer: "max",
        },
    ]);

    assert.equal(patchConnection.storedWrites.length, 1);
    const savedState = deserializeModulationState(patchConnection.storedWrites[0].value);
    assert.deepEqual(savedState.routes.map(routeSummary), [
        {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 2,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: -2.5,
        },
        {
            enabled: true,
            sourceKind: "velocity",
            sourceSlot: null,
            polarity: "bipolar",
            targetKind: "pan",
            amount: 0.5,
        },
    ]);

    const program = endpointEvents({ events: buildModulationRuntimeEvents(savedState) }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    assert.equal(program.voiceRouteCount, 2);
    assert.deepEqual(program.voiceRouteCells.slice(0, 2), [50, 78]);
    assert.deepEqual(program.voiceRoutePolarities.slice(0, 2), [0, 1]);
    assert.equal(program.voiceRouteAmounts[50], -2.5);
    assert.equal(program.voiceRouteAmounts[78], 0.5);
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

test("synchronous stored-state echoes consume their suppression tokens", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    for (let editIndex = 0; editIndex < 120; editIndex += 1) {
        assert.equal(bridge.setRouteAmount(0, (editIndex % 100) / 100), true);
    }

    assert.equal(bridge.pendingStoredStateEchoes.size, 0);
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
