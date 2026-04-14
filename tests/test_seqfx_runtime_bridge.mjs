import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "ui/seqfx/seqfx-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "ui/seqfx/seqfx-runtime-bridge.ts");

const {
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    createDefaultSeqFxState,
    serializeSeqFxState,
} = stateModule;

const {
    SEQFX_ENDPOINTS,
    SeqFxRuntimeBridge,
} = bridgeModule;

class FakePatchConnection {
    constructor(storedState = {}, parameters = {}) {
        this.storedState = { ...storedState };
        this.parameters = { patternSelect: 0, ...parameters };
        this.events = [];
        this.storedWrites = [];
        this.requestedParameters = [];
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
        callback({ ...this.storedState });
    }

    requestStoredStateValue(key) {
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
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(this.parameters[endpointID]);
        }
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        if (endpointID === SEQFX_ENDPOINTS.patternSelect) {
            this.parameters.patternSelect = value;
            for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                listener(value);
            }
        }
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }
}

function endpointEvents(connection, endpointID) {
    return connection.events.filter((entry) => entry.endpointID === endpointID);
}

test("boot_without_saved_seqfx_state_persists_normalized_default_and_uploads_authoritative_pattern", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 1);
    assert.equal(connection.storedWrites[0].key, SEQFX_STATE_KEY);
    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.patternSelect), true);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.equal(uploads.at(-1).value.patternIndex, 0);
    assert.equal(uploads.at(-1).value.authoritative, true);
});

test("editing_selected_pattern_persists_state_and_uploads_one_complete_non_authoritative_pattern", () => {
    const initialState = createDefaultSeqFxState();
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    bridge.toggleCell({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        step: 6,
        active: true,
    });
    bridge.setStepParam({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [6],
        paramIndex: 1,
        value: 330,
    });

    assert.equal(connection.storedWrites.length, 2);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 2);
    assert.equal(uploads.at(-1).value.authoritative, false);
    assert.equal(uploads.at(-1).value.activeSteps[SEQFX_LANES.filter][6], true);
    assert.equal(uploads.at(-1).value.params[SEQFX_LANES.filter][6][1], 330);
});

test("resizing_selected_pattern_block_persists_and_uploads_continuation_cells_without_retriggers", () => {
    const initialState = createDefaultSeqFxState();
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    bridge.createBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 4,
        length: 1,
    });
    bridge.resizeBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 4,
        length: 4,
    });

    assert.equal(connection.storedWrites.length, 2);
    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.deepEqual(uploads.at(-1).value.activeSteps[SEQFX_LANES.tapeStop].slice(4, 8), [true, true, true, true]);
    assert.deepEqual(uploads.at(-1).value.triggerSteps[SEQFX_LANES.tapeStop].slice(4, 8), [true, false, false, false]);
});

test("moving_and_copying_selected_pattern_blocks_persist_and_upload_complete_patterns", () => {
    const initialState = createDefaultSeqFxState();
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    bridge.createBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 1,
        length: 2,
    });
    bridge.moveBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 1,
        targetStartStep: 5,
    });
    bridge.copyBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 5,
        targetStartStep: 9,
    });

    assert.equal(connection.storedWrites.length, 3);
    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.deepEqual(uploads.at(-1).value.activeSteps[SEQFX_LANES.stutter].slice(1, 3), [false, false]);
    assert.deepEqual(uploads.at(-1).value.activeSteps[SEQFX_LANES.stutter].slice(5, 7), [true, true]);
    assert.deepEqual(uploads.at(-1).value.triggerSteps[SEQFX_LANES.stutter].slice(5, 7), [true, false]);
    assert.deepEqual(uploads.at(-1).value.activeSteps[SEQFX_LANES.stutter].slice(9, 11), [true, true]);
    assert.deepEqual(uploads.at(-1).value.triggerSteps[SEQFX_LANES.stutter].slice(9, 11), [true, false]);
});

test("selecting_a_pattern_sends_pattern_parameter_and_authoritative_upload_for_that_pattern", () => {
    const state = createDefaultSeqFxState();
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(state),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];

    bridge.selectPattern(4);

    const patternSelectEvents = endpointEvents(connection, SEQFX_ENDPOINTS.patternSelect);
    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);

    assert.deepEqual(patternSelectEvents.map((entry) => entry.value), [4]);
    assert.equal(uploads.at(-1).value.patternIndex, 4);
    assert.equal(uploads.at(-1).value.authoritative, true);
});
