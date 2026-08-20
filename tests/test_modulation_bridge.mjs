import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

import {
    createDefaultMsegShape,
    renderMsegShape,
} from "../patch_gui/mseg.js";
import {
    MODULATION_MSEG_BUFFER_ENDPOINT_ID,
    MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
    MODULATION_STATE_KEY,
    ModulationRuntimeBridge,
    buildModulationRuntimeEvents,
    composeModulationAmount,
    createDefaultModulationState,
    deserializeModulationState,
    getModulationAmountDepth,
    getModulationAmountSliderPosition,
    normalizeModulationState,
    parseModulationState,
    serializeModulationState,
} from "../patch_gui/modulation.js";
import { MODULATION_PROGRAM_ENDPOINT_ID, getModulationRuntimeCell } from "../patch_gui/modulation-runtime-program.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const parameterEntriesPromise = loadUIModule(repoRoot, "ui/shared/parameter-value-entry.ts");

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
    assert.equal(Object.hasOwn(state.msegSlots[0], "morph"), false);
    assert.deepEqual(state.msegSlots[0].shapeA, state.msegSlots[0].shapeB);
    assert.equal(state.envelopeSlots.length, 3);
    assert.deepEqual(state.routes, []);

    assert.deepEqual(patchConnection.events, []);
});

test("normalization never repairs duplicate pairs and the strict parser rejects the document", () => {
    const normalized = normalizeModulationState({
        ...createDefaultModulationState(),
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
        "duplicate-pair-route",
        "different-source-route",
    ]);
    assert.equal(parseModulationState(normalized)._tag, "err");
});

test("modulation runtime event builder converts defaults into a complete Cmajor upload batch", () => {
    const events = buildModulationRuntimeEvents(createDefaultModulationState());

    assert.equal(endpointEvents({ events }, MODULATION_MSEG_BUFFER_ENDPOINT_ID).length, 6);
    assert.equal(endpointEvents({ events }, MODULATION_MSEG_PLAYBACK_ENDPOINT_ID).length, 3);
    const program = endpointEvents({ events }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    assert.equal(program.voiceRouteCount, 0);
    assert.equal(program.macroVoiceRouteCount, 0);
    assert.equal(program.voiceRackRouteCount, 0);
    assert.equal(program.macroRackRouteCount, 0);
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
    customState.envelopeSlots[2] = { name: "Custom Env 3" };
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
    assert.equal(Object.hasOwn(state.msegSlots[1], "morph"), false);
    assert.equal(state.envelopeSlots[2].name, "Custom Env 3");
    assert.deepEqual(state.routes, customState.routes);
    assert.deepEqual(patchConnection.events, []);
});

test("boot rejects a duplicate mapping document as a whole", () => {
    const invalidState = createDefaultModulationState();
    const firstRoute = {
        id: "first",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.pan",
        amount: -0.25,
        reducer: "max",
    };
    invalidState.routes = [
        firstRoute,
        {
            ...firstRoute,
            id: "duplicate",
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
        id: "valid-route",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.pan",
        amount: -0.25,
        reducer: "max",
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

test("modulation runtime event builder converts saved state into MSEG and route uploads", () => {
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
    customState.envelopeSlots[2] = { name: "Env 3" };
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
    // The expectations come from the canonical cell mapper so a future
    // destination append can never silently strand this file again.
    const bootCell = getModulationRuntimeCell(customState.routes[0]);
    assert.equal(bootCell.path, "voice");
    assert.equal(program.voiceRouteCount, 1);
    assert.equal(program.voiceRouteCells[0], bootCell.cellIndex);
    assert.equal(program.voiceRouteSources[0], bootCell.sourceIndex);
    assert.equal(program.voiceRouteTargets[0], bootCell.targetIndex);
    assert.equal(program.voiceRouteAmounts[bootCell.cellIndex], 4);
});

test("editing one MSEG slot persists modulation.v6 without runtime uploading", () => {
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
    assert.equal(savedState.version, 6);
    assert.equal(savedState.msegSlots[0].shapeA.points.length, 3);
    assert.equal(savedState.msegSlots[0].shapeB.points.length, 2);
    assert.deepEqual(patchConnection.events, []);
});

test("editing shape B only changes shape B and edit focus does not persist a morph", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    const controller = bridge.getMsegSlotController(0);
    controller.setEditShapeIndex(1);
    assert.equal(controller.getState().editShapeIndex, 1);
    assert.equal(Object.hasOwn(bridge.getState().msegSlots[0], "morph"), false);
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
    assert.equal(Object.hasOwn(savedState.msegSlots[0], "morph"), false);
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
            targetKind: "oscA.pan",
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
            targetKind: "oscA.pan",
            amount: 0.5,
        },
    ]);

    const program = endpointEvents({ events: buildModulationRuntimeEvents(savedState) }, MODULATION_PROGRAM_ENDPOINT_ID)[0].value;
    const replacedCells = savedState.routes.map((route) => getModulationRuntimeCell(route));
    assert.deepEqual(replacedCells.map((cell) => cell.path), ["voice", "voice"]);
    assert.equal(program.voiceRouteCount, 2);
    assert.deepEqual(
        program.voiceRouteCells.slice(0, 2),
        replacedCells.map((cell) => cell.cellIndex),
    );
    assert.deepEqual(program.voiceRoutePolarities.slice(0, 2), [0, 1]);
    assert.equal(program.voiceRouteAmounts[replacedCells[0].cellIndex], -2.5);
    assert.equal(program.voiceRouteAmounts[replacedCells[1].cellIndex], 0.5);
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

test("route amount subscriptions notify only the changed stable route identity", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);
    const routeA = {
        id: "fine-grained-route-a",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "rack.distortionDriveDb",
        amount: 0,
        reducer: "max",
    };
    const routeB = {
        id: "fine-grained-route-b",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 2,
        polarity: "unipolar",
        targetKind: "rack.reverbMix",
        amount: 0.2,
        reducer: "max",
    };
    const notifications = { routeA: [], routeB: [] };

    bridge.replaceRoutes([routeA, routeB]);
    const unsubscribeRouteA = bridge.subscribeRouteAmount(routeA.id, (amount) => notifications.routeA.push(amount));
    const unsubscribeRouteB = bridge.subscribeRouteAmount(routeB.id, (amount) => notifications.routeB.push(amount));

    assert.equal(bridge.setRouteAmountById(routeA.id, 0.75), true);
    assert.deepEqual(notifications, { routeA: [0.75], routeB: [] });
    assert.equal(bridge.getRouteAmount(routeA.id), 0.75);
    assert.equal(bridge.getRouteAmount(routeB.id), 0.2);
    assert.equal(bridge.setRouteAmountById(routeA.id, 0.75), true);
    assert.deepEqual(notifications, { routeA: [0.75], routeB: [] });

    bridge.replaceRoutes([{ ...routeB, amount: 0.6 }]);
    assert.deepEqual(notifications, { routeA: [0.75, null], routeB: [0.6] });
    assert.equal(bridge.getRouteAmount(routeA.id), null);
    assert.equal(bridge.getRouteAmount(routeB.id), 0.6);
    assert.equal(bridge.setRouteAmountById(routeA.id, 0.1), false);

    unsubscribeRouteA();
    unsubscribeRouteB();
});

test("synchronous stored-state echoes consume their suppression tokens", () => {
    const patchConnection = new FakePatchConnection();
    const bridge = new ModulationRuntimeBridge(patchConnection);

    bridge.attach();
    bridge.requestBootState();
    bridge.replaceRoutes([{
        id: "editable-route",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.warpAmount",
        amount: 0,
        reducer: "max",
    }]);
    for (let editIndex = 0; editIndex < 120; editIndex += 1) {
        assert.equal(bridge.setRouteAmount(0, (editIndex % 100) / 100), true);
    }

    assert.equal(bridge.pendingStoredStateEchoes.size, 0);
});

test("zero-centered route amount mapping keeps zero at the midpoint and uses side-specific depth", () => {
    assert.equal(composeModulationAmount("warpAmount", 0.5), 0);
    assert.equal(composeModulationAmount("warpAmount", 0), -1);
    assert.equal(composeModulationAmount("warpAmount", 1), 1);
    // The amp amount is an additive dB offset over the full 54 dB parameter
    // span in BOTH directions; the engine clamps base + offset to -48..+6.
    // (An earlier revision of this test pinned the parameter range -48..+6
    // as the OFFSET range, which froze upward modulation at base + 6 dB.)
    assert.equal(composeModulationAmount("ampGainDb", 0.5), 0);
    assert.equal(composeModulationAmount("ampGainDb", 0), -54);
    assert.equal(composeModulationAmount("ampGainDb", 1), 54);

    assert.equal(getModulationAmountSliderPosition("warpAmount", 0), 0.5);
    assert.equal(getModulationAmountSliderPosition("warpAmount", -1), 0);
    assert.equal(getModulationAmountSliderPosition("warpAmount", 1), 1);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", -54), 0);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", 0), 0.5);
    assert.equal(getModulationAmountSliderPosition("ampGainDb", 54), 1);

    assert.equal(getModulationAmountDepth("ampGainDb", -27), 0.5);
    assert.equal(getModulationAmountDepth("ampGainDb", 27), 0.5);
});

test("matrix amount text entry uses the shared target-owned unit contract", async () => {
    const entries = await parameterEntriesPromise;
    const warpSpec = entries.parameterEntrySpecForModulationAmount("oscA.warpAmount", 0);
    const panSpec = entries.parameterEntrySpecForModulationAmount("oscA.pan", 0);
    const pitchSpec = entries.parameterEntrySpecForModulationAmount("oscA.pitchSemitones", 0);

    assert.equal(entries.formatParameterEntry(warpSpec, 0.12).draft, "12");
    assert.equal(entries.parseParameterEntry(warpSpec, "12").commit.value, 0.12);
    assert.equal(entries.parseParameterEntry(panSpec, "-40").commit.value, -0.4);
    assert.equal(entries.parseParameterEntry(panSpec, "40L").commit.value, -0.4);
    assert.equal(entries.parseParameterEntry(pitchSpec, "12").commit.value, 12);
});
