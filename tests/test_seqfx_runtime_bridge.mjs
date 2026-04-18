import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-runtime-bridge.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    SEQFX_LEGACY_STATE_KEY,
    SEQFX_STATE_KEY,
    applySeqFxBlockCreate,
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
        this.parameters = { patternSelect: 0, rate: 1, ...parameters };
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
        this.emitParameter(endpointID, value);
    }

    emitParameter(endpointID, value) {
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
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

class AsyncFullStatePatchConnection extends FakePatchConnection {
    fullStateCallback = null;

    requestFullStoredState(callback) {
        this.fullStateCallback = callback;
    }

    flushFullStoredState() {
        assert.equal(typeof this.fullStateCallback, "function");
        const callback = this.fullStateCallback;
        this.fullStateCallback = null;
        callback({ ...this.storedState });
    }
}

class MissingFullStatePatchConnection extends FakePatchConnection {
    requestFullStoredState(callback) {
        callback({});
    }
}

function endpointEvents(connection, endpointID) {
    return connection.events.filter((entry) => entry.endpointID === endpointID);
}

function legacyV1StateFrom(state) {
    return {
        version: 1,
        patterns: state.patterns.map((pattern) => ({
            revision: pattern.revision,
            lanes: pattern.lanes.map((lane) => ({
                steps: lane.steps.map((step) => {
                    const { effectType: _effectType, ...legacyStep } = step;
                    return legacyStep;
                }),
            })),
        })),
    };
}

test("boot_without_saved_seqfx_state_persists_normalized_default_and_uploads_authoritative_pattern", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 1);
    assert.equal(connection.storedWrites[0].key, SEQFX_STATE_KEY);
    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.patternSelect), true);
    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.rate), true);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.equal(uploads.at(-1).value.patternIndex, 0);
    assert.equal(uploads.at(-1).value.authoritative, true);
});

test("boot_waits_for_async_full_stored_state_before_uploading_or_persisting", () => {
    let savedState = createDefaultSeqFxState();
    savedState = applySeqFxBlockCreate(savedState, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 5,
        length: 2,
    });
    const connection = new AsyncFullStatePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(savedState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.deepEqual(connection.requestedParameters, []);

    connection.flushFullStoredState();

    assert.equal(connection.storedWrites.length, 0);
    assert.deepEqual(connection.requestedParameters, [
        SEQFX_ENDPOINTS.patternSelect,
        SEQFX_ENDPOINTS.rate,
    ]);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.authoritative, true);
    assert.deepEqual(
        uploads[0].value.activeSteps[SEQFX_LANES.stutter].slice(5, 7),
        [true, true],
    );
    assert.deepEqual(
        uploads[0].value.triggerSteps[SEQFX_LANES.stutter].slice(5, 7),
        [true, false],
    );
    assert.deepEqual(
        uploads[0].value.effectTypes[SEQFX_LANES.stutter].slice(5, 7),
        [SEQFX_EFFECT_TYPES.stutter, SEQFX_EFFECT_TYPES.stutter],
    );
});

test("boot_migrates_legacy_seqfx_v1_state_to_seqfx_v2_and_preserves_old_lane_effects", () => {
    let savedState = createDefaultSeqFxState();
    savedState = applySeqFxBlockCreate(savedState, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 10,
        length: 2,
    });
    const connection = new FakePatchConnection({
        [SEQFX_LEGACY_STATE_KEY]: JSON.stringify(legacyV1StateFrom(savedState)),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 1);
    assert.equal(connection.storedWrites[0].key, SEQFX_STATE_KEY);
    assert.equal(JSON.parse(connection.storedWrites[0].value).version, 2);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.deepEqual(
        uploads[0].value.effectTypes[SEQFX_LANES.tapeStop].slice(10, 12),
        [SEQFX_EFFECT_TYPES.tapeStop, SEQFX_EFFECT_TYPES.tapeStop],
    );
});

test("boot_falls_back_to_specific_stored_state_request_when_full_state_omits_seqfx_key", () => {
    let savedState = createDefaultSeqFxState();
    savedState = applySeqFxBlockCreate(savedState, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 12,
        length: 3,
    });
    const connection = new MissingFullStatePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(savedState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.deepEqual(
        uploads[0].value.activeSteps[SEQFX_LANES.tapeStop].slice(12, 15),
        [true, true, true],
    );
    assert.deepEqual(
        uploads[0].value.triggerSteps[SEQFX_LANES.tapeStop].slice(12, 15),
        [true, false, false],
    );
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
    assert.equal(uploads.at(-1).value.effectTypes[SEQFX_LANES.filter][6], SEQFX_EFFECT_TYPES.filter);
    assert.equal(uploads.at(-1).value.params[SEQFX_LANES.filter][6][1], 330);
});

test("changing_selected_pattern_block_effect_persists_resets_effect_params_and_uploads_effect_types", () => {
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
        lane: 0,
        startStep: 2,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    bridge.setBlockEffect({
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });

    assert.equal(connection.storedWrites.length, 2);
    const upload = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).at(-1).value;
    assert.deepEqual(upload.effectTypes[0].slice(2, 4), [
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.crusher,
    ]);
    assert.deepEqual(upload.params[0][2].slice(0, 3), [8, 1, 0]);
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

test("previewing_copy_paint_does_not_persist_or_upload_until_commit", () => {
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
        lane: SEQFX_LANES.crusher,
        startStep: 0,
        length: 1,
    });
    connection.events = [];
    connection.storedWrites = [];

    const preview = bridge.previewBlockCopyPaint({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 0,
        targetStartStep: 3,
    });

    assert.deepEqual(preview.copiedStartSteps, [1, 2, 3]);
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.deepEqual(
        preview.state.patterns[0].lanes[SEQFX_LANES.crusher].steps.slice(0, 5).map((step) => step.active),
        [true, true, true, true, false],
    );

    const committed = bridge.copyBlockPaint({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 0,
        targetStartStep: 3,
    });

    assert.deepEqual(committed.copiedStartSteps, [1, 2, 3]);
    assert.equal(connection.storedWrites.length, 1);
    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.deepEqual(uploads.at(-1).value.activeSteps[SEQFX_LANES.crusher].slice(0, 5), [true, true, true, true, false]);
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

test("rate_parameter_defaults_to_sixteenth_note_grid_and_notifies_snapped_subscribers", () => {
    const connection = new FakePatchConnection({}, { rate: 1 });
    const bridge = new SeqFxRuntimeBridge(connection);
    const observedRates = [];

    assert.equal(bridge.getRateIndex(), 1);

    bridge.attach();
    const unsubscribe = bridge.subscribeRate((rateIndex) => {
        observedRates.push(rateIndex);
    });
    bridge.requestBootState();

    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.rate), true);
    assert.deepEqual(observedRates, [1]);

    for (const [rawValue, expected] of [
        [-1, 0],
        [0.49, 0],
        [1.5, 2],
        [2.01, 2],
        [Number.NaN, 1],
        [Number.POSITIVE_INFINITY, 2],
    ]) {
        connection.emitParameter(SEQFX_ENDPOINTS.rate, rawValue);
        assert.equal(bridge.getRateIndex(), expected, `rate ${rawValue} should snap to ${expected}`);
        assert.equal(observedRates.at(-1), expected);
    }

    unsubscribe();
    connection.emitParameter(SEQFX_ENDPOINTS.rate, 0);
    assert.equal(observedRates.at(-1), 2);
});
