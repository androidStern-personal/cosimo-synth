import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const workerModule = await loadUIModule(repoRoot, "fx/seqfx/worker/seqfx-worker-service.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    applySeqFxBlockCreate,
    createDefaultSeqFxState,
    serializeSeqFxState,
} = stateModule;

const {
    createSeqFxWorkerService,
} = workerModule;

class FakePatchConnection {
    constructor({ values = {}, parameters = {} } = {}) {
        this.values = { ...values };
        this.parameters = {
            patternSelect: 0,
            ...parameters,
        };
        this.events = [];
        this.storedWrites = [];
        this.requestedParameters = [];
        this.requestedStoredKeys = [];
        this.fullStoredStateRequests = 0;
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        this.fullStoredStateRequests += 1;
        callback({
            parameters: { ...this.parameters },
            values: { ...this.values },
        });
    }

    requestStoredStateValue(key) {
        this.requestedStoredKeys.push(key);
        this.emitStoredState(key, this.values[key]);
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.values[key] = value;
        this.emitStoredState(key, value);
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        if (endpointID === "patternSelect") {
            this.emitParameter(endpointID, value);
        }
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
        this.emitParameter(endpointID, this.parameters[endpointID]);
    }

    emitStoredState(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    emitParameter(endpointID, value) {
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

function patternUploads(connection) {
    return connection.events.filter((event) => event.endpointID === "patternUpload");
}

function createStateWithBlock({ patternIndex, lane, startStep, length }) {
    return applySeqFxBlockCreate(createDefaultSeqFxState(), {
        patternIndex,
        lane,
        startStep,
        length,
    });
}

test("seqfx worker uploads the selected saved pattern from Cmajor stored-state values", () => {
    const savedState = createStateWithBlock({
        patternIndex: 3,
        lane: SEQFX_LANES.stutter,
        startStep: 6,
        length: 2,
    });
    const connection = new FakePatchConnection({
        values: {
            [SEQFX_STATE_KEY]: serializeSeqFxState(savedState),
        },
        parameters: {
            patternSelect: 3,
        },
    });
    const service = createSeqFxWorkerService(connection);

    service.start();

    const uploads = patternUploads(connection);
    assert.equal(connection.fullStoredStateRequests, 1);
    assert.deepEqual(connection.requestedStoredKeys, []);
    assert.deepEqual(connection.requestedParameters, ["patternSelect"]);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.patternIndex, 3);
    assert.equal(uploads[0].value.authoritative, false);
    assert.deepEqual(
        uploads[0].value.activeSteps[SEQFX_LANES.stutter].slice(6, 8),
        [true, true],
    );
    assert.deepEqual(
        uploads[0].value.triggerSteps[SEQFX_LANES.stutter].slice(6, 8),
        [true, false],
    );
    assert.deepEqual(
        uploads[0].value.effectTypes[SEQFX_LANES.stutter].slice(6, 8),
        [SEQFX_EFFECT_TYPES.stutter, SEQFX_EFFECT_TYPES.stutter],
    );
    assert.deepEqual(connection.storedWrites, []);
});

test("seqfx worker ignores old state keys and applies a default empty pattern when seqfx.v4 is missing", () => {
    const oldKeyState = createStateWithBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 10,
        length: 2,
    });
    const connection = new FakePatchConnection({
        values: {
            "seqfx.v1": serializeSeqFxState(oldKeyState),
            "seqfx.v2": serializeSeqFxState(oldKeyState),
            "seqfx.v3": serializeSeqFxState(oldKeyState),
        },
        parameters: {
            patternSelect: 0,
        },
    });
    const service = createSeqFxWorkerService(connection);

    service.start();

    const upload = patternUploads(connection).at(-1).value;
    assert.equal(upload.patternIndex, 0);
    assert.equal(upload.authoritative, false);
    assert.equal(upload.activeSteps.flat().some(Boolean), false);
    assert.deepEqual(connection.requestedStoredKeys, [SEQFX_STATE_KEY]);
    assert.deepEqual(connection.storedWrites, []);
});

test("seqfx worker rejects old-shaped current seqfx state instead of normalizing missing aux", () => {
    const savedState = createDefaultSeqFxState();
    delete savedState.patterns[0].lanes[SEQFX_LANES.crusher].steps[0].aux;
    const connection = new FakePatchConnection({
        values: {
            [SEQFX_STATE_KEY]: JSON.stringify(savedState),
        },
        parameters: {
            patternSelect: 0,
        },
    });
    const service = createSeqFxWorkerService(connection);

    assert.throws(
        () => service.start(),
        /aux/i,
    );
    assert.deepEqual(patternUploads(connection), []);
    assert.deepEqual(connection.storedWrites, []);
});

test("seqfx worker reuploads when patternSelect changes", () => {
    let savedState = createStateWithBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 2,
        length: 1,
    });
    savedState = applySeqFxBlockCreate(savedState, {
        patternIndex: 4,
        lane: SEQFX_LANES.crusher,
        startStep: 9,
        length: 3,
    });
    const connection = new FakePatchConnection({
        values: {
            [SEQFX_STATE_KEY]: serializeSeqFxState(savedState),
        },
        parameters: {
            patternSelect: 0,
        },
    });
    const service = createSeqFxWorkerService(connection);

    service.start();
    connection.events = [];
    connection.emitParameter("patternSelect", 4);

    const uploads = patternUploads(connection);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.patternIndex, 4);
    assert.deepEqual(
        uploads[0].value.activeSteps[SEQFX_LANES.crusher].slice(9, 12),
        [true, true, true],
    );
    assert.deepEqual(
        uploads[0].value.triggerSteps[SEQFX_LANES.crusher].slice(9, 12),
        [true, false, false],
    );
});

test("seqfx worker reuploads the selected pattern when seqfx.v4 changes", () => {
    const connection = new FakePatchConnection({
        values: {
            [SEQFX_STATE_KEY]: serializeSeqFxState(createDefaultSeqFxState()),
        },
        parameters: {
            patternSelect: 0,
        },
    });
    const service = createSeqFxWorkerService(connection);
    const nextState = createStateWithBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 4,
        length: 2,
    });

    service.start();
    connection.events = [];
    connection.emitStoredState(SEQFX_STATE_KEY, serializeSeqFxState(nextState));

    const uploads = patternUploads(connection);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.patternIndex, 0);
    assert.deepEqual(
        uploads[0].value.activeSteps[SEQFX_LANES.filter].slice(4, 6),
        [true, true],
    );
    assert.deepEqual(
        uploads[0].value.effectTypes[SEQFX_LANES.filter].slice(4, 6),
        [SEQFX_EFFECT_TYPES.filter, SEQFX_EFFECT_TYPES.filter],
    );
});
