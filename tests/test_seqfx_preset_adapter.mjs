import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";
import { createLegacyV5StateWithBlock } from "./helpers/seqfx_legacy_v5_fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-runtime-bridge.ts");
const adapterModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-preset-adapter.ts");
const workerModule = await loadUIModule(repoRoot, "fx/seqfx/worker/seqfx-worker-service.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    applySeqFxBlockAuxSourceEdit,
    applySeqFxBlockAuxTargetEndEdit,
    applySeqFxBlockAuxTargetToggle,
    applySeqFxBlockCreate,
    applySeqFxCellToggle,
    applySeqFxParamEdit,
    createDefaultSeqFxState,
    parseStrictSeqFxStateV7,
    serializeSeqFxState,
} = stateModule;

const {
    SEQFX_ENDPOINTS,
    SeqFxRuntimeBridge,
} = bridgeModule;

const {
    createSeqFxPresetStateAdapter,
} = adapterModule;
const {
    createSeqFxWorkerService,
} = workerModule;

class FakePatchConnection {
    constructor(storedState = {}, parameters = {}) {
        this.storedState = { ...storedState };
        this.parameters = { patternSelect: 0, rate: 1, ...parameters };
        this.events = [];
        this.storedWrites = [];
        this.allStoredWrites = [];
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
        this.emitStoredState(key, this.storedState[key]);
    }

    requestParameterValue(endpointID) {
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(this.parameters[endpointID]);
        }
    }

    sendStoredStateValue(key, value) {
        this.allStoredWrites.push({ key, value });
        if (key === SEQFX_STATE_KEY) {
            this.storedWrites.push({ key, value });
        }
        this.storedState[key] = value;
        this.emitStoredState(key, value);
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID, listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    emitStoredState(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }
}

function patternUploads(connection) {
    return connection.events.filter((event) => event.endpointID === SEQFX_ENDPOINTS.patternUpload);
}

test("seqfx_adapter_contract_registers_required_seqfx_v7_state", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    assert.deepEqual(adapter.getContract(), {
        key: "seqfx.v7",
        schemaVersion: 7,
        required: true,
    });
});

test("seqfx_adapter_capture_reads_bridge_state_not_dom_and_serializes_all_patterns", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 7,
        lane: SEQFX_LANES.filter,
        step: 5,
        active: true,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 7,
        lane: SEQFX_LANES.filter,
        steps: [5],
        paramIndex: 1,
        value: 440,
    });

    const connection = new FakePatchConnection({
        [SEQFX_STATE_KEY]: serializeSeqFxState(state),
    });
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    bridge.attach();
    bridge.requestBootState();

    const serialized = adapter.capture();
    const restored = parseStrictSeqFxStateV7(serialized);

    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].active, true);
    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].effectType, SEQFX_EFFECT_TYPES.filter);
    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].params[1], 440);
});

test("seqfx_adapter_apply_writes_seqfx_v7_and_authoritatively_replaces_the_selected_runtime_pattern", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.stutter,
        step: 8,
        active: true,
    });

    const connection = new FakePatchConnection({}, { patternSelect: 4 });
    const workerService = createSeqFxWorkerService(connection);
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    workerService.start();
    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];
    connection.allStoredWrites = [];

    adapter.apply(serializeSeqFxState(state));

    assert.equal(
        connection.storedWrites.filter(({ key }) => key === SEQFX_STATE_KEY).at(-1).key,
        SEQFX_STATE_KEY,
    );
    const intentWrites = connection.allStoredWrites.filter(({ key }) => key === "seqfx.runtimeUpdateIntent.v1");
    assert.equal(JSON.parse(intentWrites[0].value).authoritative, true);
    assert.equal(intentWrites.at(-1).value, null);
    const uploads = patternUploads(connection);
    const upload = uploads.at(-1);
    assert.equal(uploads.length >= 2, true, "worker and runtime bridge both apply the replacement");
    assert.equal(
        uploads.every((event) => event.value.authoritative === true),
        true,
        "a one-pattern preset with a forward revision must not be mistaken for a sparse edit",
    );
    assert.equal(upload.value.patternIndex, 4);
    assert.equal(upload.value.authoritative, true);
    assert.equal(upload.value.activeSteps[SEQFX_LANES.stutter][8], true);
    assert.equal(upload.value.effectTypes[SEQFX_LANES.stutter][8], SEQFX_EFFECT_TYPES.stutter);
});

test("an ordinary bridge edit stays non-authoritative through the real worker path", () => {
    const connection = new FakePatchConnection();
    const workerService = createSeqFxWorkerService(connection);
    const bridge = new SeqFxRuntimeBridge(connection);

    workerService.start();
    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];
    connection.allStoredWrites = [];

    bridge.createBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 6,
        length: 2,
    });

    const uploads = patternUploads(connection);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].value.authoritative, false);
    assert.deepEqual(uploads[0].value.activeSteps[SEQFX_LANES.filter].slice(6, 8), [true, true]);
    const intentWrites = connection.allStoredWrites.filter(({ key }) => key === "seqfx.runtimeUpdateIntent.v1");
    assert.equal(JSON.parse(intentWrites[0].value).authoritative, false);
    assert.equal(intentWrites.at(-1).value, null);

    bridge.detach();
    workerService.stop();
});

test("seqfx_adapter_apply_preserves_aux_state_and_worker_uploads_aux_arrays", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.crusher,
        startStep: 8,
        length: 1,
    });
    state = applySeqFxBlockAuxSourceEdit(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.crusher,
        startStep: 8,
        source: {
            shape: -0.25,
            sourceCurve: 0.5,
            rateMode: "tempo",
            tempoMultiplier: 3,
            tempoTriplet: true,
            sliceCount: 7,
        },
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.crusher,
        startStep: 8,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.crusher,
        startStep: 8,
        paramIndex: 0,
        value: 14,
    });

    const connection = new FakePatchConnection({}, { patternSelect: 4 });
    const workerService = createSeqFxWorkerService(connection);
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    workerService.start();
    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    adapter.apply(serializeSeqFxState(state));

    const upload = patternUploads(connection)[0].value;
    assert.equal(upload.auxEnabled[SEQFX_LANES.crusher][8][0], true);
    assert.equal(upload.auxEnd[SEQFX_LANES.crusher][8][0], 14);
    assert.equal(upload.auxShape[SEQFX_LANES.crusher][8], -0.25);
    assert.equal(upload.auxSourceCurve[SEQFX_LANES.crusher][8], 0.5);
    assert.equal(upload.auxRateMode[SEQFX_LANES.crusher][8], 0);
    assert.equal(upload.auxTempoMultiplier[SEQFX_LANES.crusher][8], 3);
    assert.equal(upload.auxTempoTriplet[SEQFX_LANES.crusher][8], true);
    assert.equal(upload.auxSliceCount[SEQFX_LANES.crusher][8], 7);
});

test("seqfx_adapter_rejects_legacy_v1_state_instead_of_migrating", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 2,
        lane: SEQFX_LANES.crusher,
        step: 9,
        active: true,
    });
    const legacyState = JSON.parse(serializeSeqFxState(state));
    legacyState.version = 1;

    const connection = new FakePatchConnection({}, { patternSelect: 2 });
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    assert.throws(
        () => adapter.apply(JSON.stringify(legacyState)),
        /version.*7.*legacy.*5/i,
    );
    assert.deepEqual(connection.storedWrites, []);
    assert.deepEqual(connection.events, []);
});

test("seqfx_adapter_migrates_supported_version-5 preset state to sparse v7", () => {
    const state = createLegacyV5StateWithBlock({
        patternIndex: 9,
        lane: SEQFX_LANES.crusher,
        startStep: 13,
        length: 1,
        params: [8, 1, 0, 0, 0, 0, 0, 0],
    });
    const connection = new FakePatchConnection({}, { patternSelect: 9 });
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    const normalized = adapter.normalizeForPreset(JSON.stringify(state));
    assert.equal(JSON.parse(normalized).version, 7);
    assert.equal(parseStrictSeqFxStateV7(normalized).patterns[9].lanes[SEQFX_LANES.crusher].steps[13].active, true);
});

test("seqfx_adapter_rejects_invalid_matrix_shape_in_presets_instead_of_normalizing_to_default", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    assert.throws(() => adapter.normalizeForPreset({
        version: 7,
        patterns: [],
    }), /patterns.*12/i);
});

test("seqfx_adapter_rejects_old_shaped_state_without_aux_source", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
    presetState.patterns[0].chains[SEQFX_LANES.crusher].blocks.push({
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
        aux: { curve: "linear" },
    });

    assert.throws(
        () => adapter.normalizeForPreset(JSON.stringify(presetState)),
        /aux\.curve/i,
    );
});

test("seqfx_adapter_rejects_out_of_range_mix_values_instead_of_clamping_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
    presetState.patterns[0].chains[SEQFX_LANES.filter].blocks.push({
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
        mix: 1.5,
    });

    assert.throws(
        () => adapter.normalizeForPreset(JSON.stringify(presetState)),
        /blocks\[0\]\.mix.*0 to 1/i,
    );
});

test("seqfx_adapter_rejects_out_of_range_parameter_values_instead_of_clamping_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
    presetState.patterns[0].chains[SEQFX_LANES.filter].blocks.push({
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
        params: [0, 20_001, 500, 0.707, 1, 0, 0, 0],
    });

    assert.throws(
        () => adapter.apply(JSON.stringify(presetState)),
        /blocks\[0\]\.params\[1\].*20 to 20000/i,
    );
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(connection.events.length, 0);
});

test("seqfx_adapter_rejects_fractional_integer_parameter_values_in_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
    presetState.patterns[0].chains[SEQFX_LANES.filter].blocks.push({
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
        params: [1.5, 2_000, 500, 0.707, 1, 0, 0, 0],
    });

    assert.throws(
        () => adapter.serializeForPreset(JSON.stringify(presetState)),
        /blocks\[0\]\.params\[0\].*integer/i,
    );
});
