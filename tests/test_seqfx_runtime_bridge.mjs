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
    SEQFX_LEGACY_STATE_KEY,
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    SEQFX_PARAM_COUNT,
    applySeqFxBlockCreate,
    createDefaultSeqFxState,
    parseStrictSeqFxStateV7,
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
        callback({
            parameters: { ...this.parameters },
            values: { ...this.storedState },
        });
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
        callback({
            parameters: { ...this.parameters },
            values: { ...this.storedState },
        });
    }
}

class MissingFullStatePatchConnection extends FakePatchConnection {
    requestFullStoredState(callback) {
        callback({
            parameters: { ...this.parameters },
            values: {},
        });
    }
}

class CmajorMissingStoredValuePatchConnection extends MissingFullStatePatchConnection {
    requestStoredStateValue(key) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value: null });
        }
    }
}

function endpointEvents(connection, endpointID) {
    return connection.events.filter((entry) => entry.endpointID === endpointID);
}

function latestStoredSeqFxState(connection) {
    const write = connection.storedWrites.at(-1);
    assert.equal(write?.key, SEQFX_STATE_KEY);
    assert.equal(typeof write.value, "string");
    return parseStrictSeqFxStateV7(write.value);
}

test("boot_without_saved_seqfx_state_hydrates_defaults_without_persisting_or_uploading", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.patternSelect), true);
    assert.equal(connection.requestedParameters.includes(SEQFX_ENDPOINTS.rate), true);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.equal(bridge.getState().patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);
});

test("boot_treats_cmajor_null_stored_value_as_missing_current_state", () => {
    const connection = new CmajorMissingStoredValuePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.deepEqual(connection.requestedParameters, [
        SEQFX_ENDPOINTS.patternSelect,
        SEQFX_ENDPOINTS.enabled,
        SEQFX_ENDPOINTS.globalMix,
        SEQFX_ENDPOINTS.clockMode,
        SEQFX_ENDPOINTS.manualBpm,
        SEQFX_ENDPOINTS.rate,
        SEQFX_ENDPOINTS.swing,
        SEQFX_ENDPOINTS.loopStart,
        SEQFX_ENDPOINTS.loopLength,
    ]);
    assert.equal(bridge.getState().patterns.length, 12);
    assert.equal(bridge.getState().patterns[0].lanes[SEQFX_LANES.filter].steps[0].active, false);
});

test("boot_ignores_old_seqfx_v3_state_and_uses_defaults_when_current_key_is_missing", () => {
    const oldKeyState = createDefaultSeqFxState();
    oldKeyState.patterns[0].lanes[SEQFX_LANES.crusher].steps[0].active = true;
    oldKeyState.patterns[0].lanes[SEQFX_LANES.crusher].steps[0].trigger = true;
    const connection = new FakePatchConnection({
        "seqfx.v3": serializeSeqFxState(oldKeyState),
        "seqfx.v5": serializeSeqFxState(oldKeyState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.equal(bridge.getState().patterns[0].lanes[SEQFX_LANES.crusher].steps[0].active, false);
    assert.equal(bridge.getState().patterns[0].lanes[SEQFX_LANES.crusher].steps[0].trigger, false);
});

test("boot_rejects_old_shaped_current_seqfx_state_instead_of_filling_missing_aux", () => {
    const savedState = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
    savedState.patterns[0].chains[SEQFX_LANES.crusher].blocks.push({
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
        aux: { curve: "linear", targets: [] },
    });
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: JSON.stringify(savedState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();

    assert.throws(
        () => bridge.requestBootState(),
        /aux/i,
    );
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("boot_waits_for_async_full_stored_state_before_hydrating_or_requesting_runtime_values", () => {
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
        SEQFX_ENDPOINTS.enabled,
        SEQFX_ENDPOINTS.globalMix,
        SEQFX_ENDPOINTS.clockMode,
        SEQFX_ENDPOINTS.manualBpm,
        SEQFX_ENDPOINTS.rate,
        SEQFX_ENDPOINTS.swing,
        SEQFX_ENDPOINTS.loopStart,
        SEQFX_ENDPOINTS.loopLength,
    ]);

    assert.deepEqual(
        bridge.getState().patterns[0].lanes[SEQFX_LANES.stutter].steps.slice(5, 7).map((step) => step.active),
        [true, true],
    );
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[SEQFX_LANES.stutter].steps.slice(5, 7).map((step) => step.trigger),
        [true, false],
    );
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[SEQFX_LANES.stutter].steps.slice(5, 7).map((step) => step.effectType),
        [SEQFX_EFFECT_TYPES.stutter, SEQFX_EFFECT_TYPES.stutter],
    );
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("boot_falls_back_to_specific_stored_state_request_when_full_values_omit_seqfx_key", () => {
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
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[SEQFX_LANES.tapeStop].steps.slice(12, 15).map((step) => step.active),
        [true, true, true],
    );
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[SEQFX_LANES.tapeStop].steps.slice(12, 15).map((step) => step.trigger),
        [true, false, false],
    );
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("editing_selected_pattern_persists_state_without_direct_runtime_uploads", () => {
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
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    const storedState = latestStoredSeqFxState(connection);
    const editedStep = storedState.patterns[0].lanes[SEQFX_LANES.filter].steps[6];
    assert.equal(editedStep.active, true);
    assert.equal(editedStep.effectType, SEQFX_EFFECT_TYPES.filter);
    assert.equal(editedStep.params[1], 330);
});

test("live_selected_pattern_param_edit_uploads_runtime_pattern_without_persisting_until_commit", () => {
    let initialState = createDefaultSeqFxState();
    initialState = applySeqFxBlockCreate(initialState, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 6,
        length: 1,
    });
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    bridge.beginLiveEdit();
    bridge.setStepParam({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [6],
        paramIndex: 1,
        value: 330,
    });

    assert.equal(connection.storedWrites.length, 0);

    const uploads = endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.patternIndex, 0);
    assert.equal(uploads[0].value.params[SEQFX_LANES.filter][6][1], 330);
    assert.equal(uploads[0].value.revision, bridge.getState().patterns[0].revision);

    bridge.commitLiveEdit();

    assert.equal(connection.storedWrites.length, 1);
    const storedState = latestStoredSeqFxState(connection);
    assert.equal(storedState.patterns[0].lanes[SEQFX_LANES.filter].steps[6].params[1], 330);
    assert.equal(storedState.patterns[0].revision, uploads[0].value.revision);
});

test("changing_selected_pattern_block_effect_persists_effect_types_and_restores_previous_params", () => {
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
    bridge.setBlockParam({
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        paramIndex: 1,
        value: 420,
    });
    bridge.setBlockEffect({
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });

    assert.equal(connection.storedWrites.length, 3);
    let storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps.slice(2, 4).map((step) => step.effectType), [
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.crusher,
    ]);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps[2].params.slice(0, 3), [8, 48_000, 0]);

    bridge.setBlockEffect({
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });

    assert.equal(connection.storedWrites.length, 4);
    storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps.slice(2, 4).map((step) => step.effectType), [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
    ]);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps.slice(2, 4).map((step) => step.params[1]), [420, 420]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("changing_selected_pattern_block_aux_persists_source_enabled_target_and_end_value", () => {
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
        startStep: 3,
        length: 2,
    });
    bridge.setBlockAuxSource({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        source: {
            shape: 0.25,
            sourceCurve: -0.5,
            rateMode: "slice",
            sliceCount: 12,
        },
    });
    bridge.setBlockAuxTargetEnabled({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 0,
        enabled: true,
    });
    bridge.setBlockAuxTargetEnd({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 0,
        value: 13,
    });

    assert.equal(connection.storedWrites.length, 4);
    const storedState = latestStoredSeqFxState(connection);
    const auxStates = storedState.patterns[0].lanes[SEQFX_LANES.crusher].steps.slice(3, 5).map((step) => step.aux);

    assert.deepEqual(auxStates.map((aux) => aux.source.shape), [0.25, 0.25]);
    assert.deepEqual(auxStates.map((aux) => aux.source.sourceCurve), [-0.5, -0.5]);
    assert.deepEqual(auxStates.map((aux) => aux.source.sliceCount), [12, 12]);
    assert.deepEqual(auxStates.map((aux) => aux.targets.length), [SEQFX_PARAM_COUNT, SEQFX_PARAM_COUNT]);
    assert.deepEqual(auxStates.map((aux) => aux.targets[0].enabled), [true, true]);
    assert.deepEqual(auxStates.map((aux) => aux.targets[0].end), [13, 13]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("changing_selected_pattern_block_group_aux_persists_enabled_target_and_end_value", () => {
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
        lane: SEQFX_LANES.filter,
        startStep: 1,
        length: 2,
    });
    bridge.createBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 6,
        length: 3,
    });
    bridge.createBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 20,
        length: 2,
    });
    bridge.setBlockSelectionAuxTargetEnabled({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        blockStartSteps: [1, 6],
        paramIndex: 1,
        enabled: true,
    });
    bridge.setBlockSelectionAuxTargetEnd({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        blockStartSteps: [1, 6],
        paramIndex: 1,
        value: 880,
    });

    assert.equal(connection.storedWrites.length, 5);
    const storedState = latestStoredSeqFxState(connection);
    const editedSteps = [1, 2, 6, 7, 8].map((step) => (
        storedState.patterns[0].lanes[SEQFX_LANES.filter].steps[step].aux.targets[1]
    ));
    assert.deepEqual(
        editedSteps,
        Array.from({ length: 5 }, () => ({ enabled: true, end: 880 })),
    );
    assert.deepEqual(
        [20, 21].map((step) => storedState.patterns[0].lanes[SEQFX_LANES.filter].steps[step].aux.targets[1]),
        [{ enabled: true, end: 500 }, { enabled: true, end: 500 }],
    );
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("resizing_selected_pattern_block_persists_continuation_cells_without_retriggers", () => {
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
    const storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[SEQFX_LANES.tapeStop].steps.slice(4, 8).map((step) => step.active), [true, true, true, true]);
    assert.deepEqual(storedState.patterns[0].lanes[SEQFX_LANES.tapeStop].steps.slice(4, 8).map((step) => step.trigger), [true, false, false, false]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("moving_and_copying_selected_pattern_blocks_persist_complete_patterns", () => {
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
    const storedState = latestStoredSeqFxState(connection);
    const steps = storedState.patterns[0].lanes[SEQFX_LANES.stutter].steps;
    assert.deepEqual(steps.slice(1, 3).map((step) => step.active), [false, false]);
    assert.deepEqual(steps.slice(5, 7).map((step) => step.active), [true, true]);
    assert.deepEqual(steps.slice(5, 7).map((step) => step.trigger), [true, false]);
    assert.deepEqual(steps.slice(9, 11).map((step) => step.active), [true, true]);
    assert.deepEqual(steps.slice(9, 11).map((step) => step.trigger), [true, false]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
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
    const storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[SEQFX_LANES.crusher].steps.slice(0, 5).map((step) => step.active), [true, true, true, true, false]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("bridge_moves_blocks_between_chains_and_persists_the_target_chain", () => {
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
    bridge.moveBlock({
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        targetLane: 2,
        targetStartStep: 6,
    });

    assert.equal(connection.storedWrites.length, 2);
    const storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[0].steps.slice(2, 4).map((step) => step.active), [false, false]);
    assert.deepEqual(storedState.patterns[0].lanes[2].steps.slice(6, 8).map((step) => step.active), [true, true]);
    assert.deepEqual(storedState.patterns[0].lanes[2].steps.slice(6, 8).map((step) => step.trigger), [true, false]);
    assert.deepEqual(storedState.patterns[0].lanes[2].steps.slice(6, 8).map((step) => step.effectType), [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
    ]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("bridge_previews_and_commits_group_copy_between_chains_without_preview_persistence", () => {
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
        lane: 1,
        startStep: 1,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    bridge.createBlock({
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    connection.events = [];
    connection.storedWrites = [];

    const preview = bridge.previewBlockSelectionCopy({
        patternIndex: 0,
        lane: 1,
        blockStartSteps: [1, 4],
        anchorStartStep: 1,
        targetLane: 3,
        targetAnchorStartStep: 8,
    });

    assert.equal(preview.copiedLane, 3);
    assert.deepEqual(preview.copiedStartSteps, [8, 11]);
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
    assert.deepEqual(preview.state.patterns[0].lanes[3].steps.slice(8, 13).map((step) => step.active), [
        true,
        false,
        false,
        true,
        true,
    ]);

    const committed = bridge.copyBlockSelection({
        patternIndex: 0,
        lane: 1,
        blockStartSteps: [1, 4],
        anchorStartStep: 1,
        targetLane: 3,
        targetAnchorStartStep: 8,
    });

    assert.equal(committed.copiedLane, 3);
    assert.deepEqual(committed.copiedStartSteps, [8, 11]);
    assert.equal(connection.storedWrites.length, 1);
    const storedState = latestStoredSeqFxState(connection);
    assert.deepEqual(storedState.patterns[0].lanes[1].steps.slice(1, 6).map((step) => step.active), [true, false, false, true, true]);
    assert.deepEqual(storedState.patterns[0].lanes[3].steps.slice(8, 13).map((step) => step.active), [true, false, false, true, true]);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
});

test("selecting_a_pattern_sends_only_the_pattern_parameter", () => {
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

    assert.deepEqual(patternSelectEvents.map((entry) => entry.value), [4]);
    assert.equal(bridge.getSelectedPatternIndex(), 4);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0);
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

test("global_control_surface_reads_host_truth_and_writes_clamped_automatable_values", () => {
    const connection = new FakePatchConnection({}, {
        enabled: 0,
        globalMix: 0.42,
        clockMode: 1,
        manualBpm: 137.5,
        rate: 2,
        swing: 0.18,
        loopStart: 5,
        loopLength: 12,
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    const observed = [];

    bridge.attach();
    const unsubscribe = bridge.subscribeGlobalControls((controls) => {
        observed.push({ ...controls });
    });
    bridge.requestBootState();

    assert.deepEqual(connection.requestedParameters, [
        SEQFX_ENDPOINTS.patternSelect,
        SEQFX_ENDPOINTS.enabled,
        SEQFX_ENDPOINTS.globalMix,
        SEQFX_ENDPOINTS.clockMode,
        SEQFX_ENDPOINTS.manualBpm,
        SEQFX_ENDPOINTS.rate,
        SEQFX_ENDPOINTS.swing,
        SEQFX_ENDPOINTS.loopStart,
        SEQFX_ENDPOINTS.loopLength,
    ]);
    assert.deepEqual(bridge.getGlobalControls(), {
        enabled: false,
        globalMix: 0.42,
        clockMode: 1,
        manualBpm: 137.5,
        rateIndex: 2,
        swing: 0.18,
        loopStart: 5,
        loopLength: 12,
    });

    connection.events = [];
    bridge.setGlobalControl(SEQFX_ENDPOINTS.enabled, true);
    bridge.setGlobalControl(SEQFX_ENDPOINTS.globalMix, -2);
    bridge.setGlobalControl(SEQFX_ENDPOINTS.clockMode, 8);
    bridge.setGlobalControl(SEQFX_ENDPOINTS.manualBpm, 401);
    bridge.setGlobalControl(SEQFX_ENDPOINTS.rate, -4);
    bridge.setGlobalControl(SEQFX_ENDPOINTS.swing, 2);
    bridge.setLoopRange(29, 32);

    assert.deepEqual(connection.events, [
        { endpointID: SEQFX_ENDPOINTS.enabled, value: 1 },
        { endpointID: SEQFX_ENDPOINTS.globalMix, value: 0 },
        { endpointID: SEQFX_ENDPOINTS.clockMode, value: 2 },
        { endpointID: SEQFX_ENDPOINTS.manualBpm, value: 300 },
        { endpointID: SEQFX_ENDPOINTS.rate, value: 0 },
        { endpointID: SEQFX_ENDPOINTS.swing, value: 0.45 },
        { endpointID: SEQFX_ENDPOINTS.loopStart, value: 29 },
        { endpointID: SEQFX_ENDPOINTS.loopLength, value: 3 },
    ]);
    assert.deepEqual(bridge.getGlobalControls(), {
        enabled: true,
        globalMix: 0,
        clockMode: 2,
        manualBpm: 300,
        rateIndex: 0,
        swing: 0.45,
        loopStart: 29,
        loopLength: 3,
    });
    assert.ok(observed.length >= 2);

    unsubscribe();
});

test("global_parameter_gestures_and_internal_transport_keep_host authority explicit", () => {
    const connection = new FakePatchConnection();
    connection.gestureStarts = [];
    connection.gestureEnds = [];
    connection.sendParameterGestureStart = (endpointID) => connection.gestureStarts.push(endpointID);
    connection.sendParameterGestureEnd = (endpointID) => connection.gestureEnds.push(endpointID);
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.beginGlobalGesture(SEQFX_ENDPOINTS.globalMix);
    bridge.endGlobalGesture(SEQFX_ENDPOINTS.globalMix);
    bridge.commitGlobalControl(SEQFX_ENDPOINTS.enabled, 0);
    bridge.commitLoopRange(8, 16);
    bridge.selectPattern(4);
    bridge.playInternal();
    bridge.stopInternal();
    bridge.resetInternal();

    assert.deepEqual(connection.gestureStarts, [
        SEQFX_ENDPOINTS.globalMix,
        SEQFX_ENDPOINTS.enabled,
        SEQFX_ENDPOINTS.loopStart,
        SEQFX_ENDPOINTS.loopLength,
        SEQFX_ENDPOINTS.patternSelect,
    ]);
    assert.deepEqual(connection.gestureEnds, connection.gestureStarts);
    assert.deepEqual(connection.events, [
        { endpointID: SEQFX_ENDPOINTS.enabled, value: 0 },
        { endpointID: SEQFX_ENDPOINTS.loopStart, value: 8 },
        { endpointID: SEQFX_ENDPOINTS.loopLength, value: 8 },
        { endpointID: SEQFX_ENDPOINTS.patternSelect, value: 4 },
        { endpointID: SEQFX_ENDPOINTS.internalPlay, value: 1 },
        { endpointID: SEQFX_ENDPOINTS.internalPlay, value: 0 },
        { endpointID: SEQFX_ENDPOINTS.internalReset, value: 1 },
    ]);
});

test("loop edit actions are bounded one-step history gestures with an in-memory clipboard", () => {
    let initialState = createDefaultSeqFxState();
    initialState = applySeqFxBlockCreate(initialState, {
        patternIndex: 0,
        lane: 0,
        startStep: 4,
        length: 3,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    initialState = applySeqFxBlockCreate(initialState, {
        patternIndex: 0,
        lane: 1,
        startStep: 10,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    initialState = applySeqFxBlockCreate(initialState, {
        patternIndex: 1,
        lane: 2,
        startStep: 7,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    }, {
        loopStart: 4,
        loopLength: 8,
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();
    connection.storedWrites = [];

    assert.equal(bridge.canPasteLoop(), false);
    assert.equal(bridge.copyLoop(), true);
    assert.equal(bridge.canPasteLoop(), true);
    assert.equal(connection.storedWrites.length, 0, "copy should remain in memory only");

    assert.equal(bridge.clearLoop(), true);
    assert.equal(connection.storedWrites.length, 1, "clear should be one committed gesture");
    assert.equal(bridge.getState().patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);
    assert.equal(bridge.canUndo(), true);

    bridge.undo();
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[4].active, true);
    assert.equal(bridge.getState().patterns[0].lanes[1].steps[10].active, true);

    bridge.setLoopRange(16, 24);
    connection.storedWrites = [];
    assert.equal(bridge.pasteLoop(), true);
    assert.equal(connection.storedWrites.length, 1, "paste should be one committed gesture");
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[0].steps.slice(16, 19).map((step) => step.active),
        [true, true, true],
    );
    assert.deepEqual(
        bridge.getState().patterns[0].lanes[1].steps.slice(22, 24).map((step) => step.active),
        [true, true],
    );

    connection.storedWrites = [];
    assert.equal(bridge.initPattern(), true);
    assert.equal(connection.storedWrites.length, 1, "Init should be one committed gesture");
    assert.equal(bridge.getState().patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);
    assert.equal(bridge.getState().patterns[1].lanes[2].steps[7].active, true, "Init must not erase other patterns");
});

test("boot migrates a valid seqfx.v6 version-5 document once and gives v7 precedence thereafter", () => {
    let legacyState = createDefaultSeqFxState();
    legacyState = applySeqFxBlockCreate(legacyState, {
        patternIndex: 3,
        lane: SEQFX_LANES.tapeStop,
        startStep: 7,
        length: 3,
    });
    for (const step of legacyState.patterns[3].lanes[SEQFX_LANES.tapeStop].steps.slice(7, 10)) {
        step.params = [1, 1, 1, 25, 0, 0, 0, 0];
    }
    legacyState.version = 5;
    const legacyText = JSON.stringify(legacyState);
    const connection = new FakePatchConnection({
        [SEQFX_LEGACY_STATE_KEY]: legacyText,
    });
    const bridge = new SeqFxRuntimeBridge(connection);

    bridge.attach();
    bridge.requestBootState();

    assert.equal(connection.storedWrites.length, 1);
    assert.equal(connection.storedWrites[0].key, SEQFX_STATE_KEY);
    assert.equal(connection.storedState[SEQFX_LEGACY_STATE_KEY], legacyText);
    assert.equal(JSON.parse(connection.storedWrites[0].value).version, 7);
    assert.equal(bridge.getState().patterns[3].lanes[SEQFX_LANES.tapeStop].steps[7].active, true);

    const secondBridge = new SeqFxRuntimeBridge(connection);
    connection.storedWrites = [];
    secondBridge.attach();
    secondBridge.requestBootState();
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(secondBridge.getState().patterns[3].lanes[SEQFX_LANES.tapeStop].steps[7].active, true);
});

test("undo and redo operate on committed edits and clear redo after a divergent edit", () => {
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(createDefaultSeqFxState()),
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    bridge.attach();
    bridge.requestBootState();
    connection.storedWrites = [];

    assert.equal(bridge.canUndo(), false);
    assert.equal(bridge.canRedo(), false);
    bridge.createBlock({ patternIndex: 0, lane: 0, startStep: 2, length: 2 });
    assert.equal(bridge.canUndo(), true);
    assert.equal(bridge.undo(), true);
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[2].active, false);
    assert.equal(bridge.canRedo(), true);
    assert.equal(bridge.redo(), true);
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[2].active, true);

    assert.equal(bridge.undo(), true);
    bridge.createBlock({ patternIndex: 0, lane: 0, startStep: 9, length: 1 });
    assert.equal(bridge.canRedo(), false);
    assert.equal(connection.storedWrites.length, 5);
});

test("a live gesture creates one undo entry and authoritative preset load clears history", () => {
    let initialState = createDefaultSeqFxState();
    initialState = applySeqFxBlockCreate(initialState, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 4,
        length: 2,
    });
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    bridge.attach();
    bridge.requestBootState();
    connection.storedWrites = [];

    bridge.beginLiveEdit();
    bridge.setBlockParam({ patternIndex: 0, lane: 0, startStep: 4, paramIndex: 1, value: 900 });
    bridge.setBlockParam({ patternIndex: 0, lane: 0, startStep: 4, paramIndex: 1, value: 600 });
    bridge.setBlockParam({ patternIndex: 0, lane: 0, startStep: 4, paramIndex: 1, value: 330 });
    bridge.commitLiveEdit();

    assert.equal(connection.storedWrites.length, 1);
    assert.equal(bridge.canUndo(), true);
    assert.equal(bridge.undo(), true);
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[4].params[1], 2_000);
    assert.equal(bridge.canUndo(), false);
    assert.equal(bridge.canRedo(), true);

    bridge.replaceStateFromPreset(serializeSeqFxState(initialState));
    assert.equal(bridge.canUndo(), false);
    assert.equal(bridge.canRedo(), false);
});

test("invalid authoritative state is atomic and preserves current sound plus undo history", () => {
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(createDefaultSeqFxState()),
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    bridge.attach();
    bridge.requestBootState();
    bridge.createBlock({ patternIndex: 0, lane: 0, startStep: 2, length: 2 });
    const writesBeforeFailure = connection.storedWrites.length;

    assert.equal(bridge.canUndo(), true);
    assert.throws(() => bridge.replaceStateFromPreset("{}"), /version.*7.*legacy.*5/i);
    assert.equal(bridge.canUndo(), true);
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[2].active, true);
    assert.equal(connection.storedWrites.length, writesBeforeFailure);

    assert.throws(() => {
        for (const listener of connection.storedStateListeners) {
            listener({ key: SEQFX_STATE_KEY, value: "{}" });
        }
    }, /must be 7/i);
    assert.equal(bridge.canUndo(), true);
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[2].active, true);
    assert.equal(connection.storedWrites.length, writesBeforeFailure);
});

test("factory patterns, effect presets, and safe loop variation each commit as one undoable edit", () => {
    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(createDefaultSeqFxState()),
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    bridge.attach();
    bridge.requestBootState();
    connection.storedWrites = [];
    connection.events = [];

    assert.equal(bridge.loadFactoryPattern("twelve-effect-tour"), true);
    assert.equal(connection.storedWrites.length, 1);
    assert.equal(endpointEvents(connection, SEQFX_ENDPOINTS.patternUpload).length, 0, "committed edits flow through authoritative stored state");
    const loaded = serializeSeqFxState(bridge.getState());
    const loadedEffectTypes = new Set(
        bridge.getState().patterns[0].lanes.flatMap((lane) => lane.steps.filter((step) => step.trigger).map((step) => step.effectType)),
    );
    assert.deepEqual([...loadedEffectTypes].sort((left, right) => left - right), Array.from({ length: 12 }, (_unused, index) => index + 1));
    assert.equal(bridge.undo(), true);
    assert.equal(bridge.getState().patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);
    assert.equal(bridge.redo(), true);
    assert.equal(serializeSeqFxState(bridge.getState()), loaded);

    const beforePreset = serializeSeqFxState(bridge.getState());
    bridge.applyBlockPreset({ patternIndex: 0, lane: 0, startStep: 0, mix: 0.25, params: [2, 1_500, 1_500, 4, 1] });
    assert.equal(bridge.getState().patterns[0].lanes[0].steps[0].mix, 0.25);
    assert.equal(bridge.undo(), true);
    assert.equal(serializeSeqFxState(bridge.getState()), beforePreset);

    const beforeVariation = serializeSeqFxState(bridge.getState());
    assert.equal(bridge.varyLoop(), true);
    assert.notEqual(serializeSeqFxState(bridge.getState()), beforeVariation);
    assert.equal(bridge.undo(), true);
    assert.equal(serializeSeqFxState(bridge.getState()), beforeVariation);
});
