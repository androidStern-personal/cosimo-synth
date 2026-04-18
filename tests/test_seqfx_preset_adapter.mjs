import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-runtime-bridge.ts");
const adapterModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-preset-adapter.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    applySeqFxCellToggle,
    applySeqFxParamEdit,
    createDefaultSeqFxState,
    serializeSeqFxState,
} = stateModule;

const {
    SEQFX_ENDPOINTS,
    SeqFxRuntimeBridge,
} = bridgeModule;

const {
    createSeqFxPresetStateAdapter,
} = adapterModule;

class FakePatchConnection {
    constructor(storedState = {}, parameters = {}) {
        this.storedState = { ...storedState };
        this.parameters = { patternSelect: 0, rate: 1, ...parameters };
        this.events = [];
        this.storedWrites = [];
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();
        this.endpointListeners = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    requestParameterValue(endpointID) {
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(this.parameters[endpointID]);
        }
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

test("seqfx_adapter_contract_registers_required_seqfx_v2_state", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    assert.deepEqual(adapter.getContract(), {
        key: "seqfx.v2",
        schemaVersion: 2,
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
    const restored = JSON.parse(serialized);

    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].active, true);
    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].effectType, SEQFX_EFFECT_TYPES.filter);
    assert.equal(restored.patterns[7].lanes[SEQFX_LANES.filter].steps[5].params[1], 440);
});

test("seqfx_adapter_apply_writes_seqfx_v2_and_uploads_selected_pattern_authoritative", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 4,
        lane: SEQFX_LANES.stutter,
        step: 8,
        active: true,
    });

    const connection = new FakePatchConnection({}, { patternSelect: 4 });
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    adapter.apply(serializeSeqFxState(state));

    assert.equal(connection.storedWrites.at(-1).key, "seqfx.v2");
    const upload = connection.events.find((event) => event.endpointID === SEQFX_ENDPOINTS.patternUpload);
    assert.equal(upload.value.patternIndex, 4);
    assert.equal(upload.value.authoritative, true);
    assert.equal(upload.value.activeSteps[SEQFX_LANES.stutter][8], true);
    assert.equal(upload.value.effectTypes[SEQFX_LANES.stutter][8], SEQFX_EFFECT_TYPES.stutter);
});

test("seqfx_adapter_apply_accepts_legacy_v1_state_and_migrates_effect_type_from_old_lane", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 2,
        lane: SEQFX_LANES.crusher,
        step: 9,
        active: true,
    });
    const legacyState = JSON.parse(serializeSeqFxState(state));
    legacyState.version = 1;
    delete legacyState.patterns[2].lanes[SEQFX_LANES.crusher].steps[9].effectType;

    const connection = new FakePatchConnection({}, { patternSelect: 2 });
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    bridge.attach();
    bridge.requestBootState();
    connection.events = [];
    connection.storedWrites = [];

    adapter.apply(JSON.stringify(legacyState));

    assert.equal(connection.storedWrites.at(-1).key, SEQFX_STATE_KEY);
    const written = JSON.parse(connection.storedWrites.at(-1).value);
    assert.equal(written.version, 2);
    assert.equal(
        written.patterns[2].lanes[SEQFX_LANES.crusher].steps[9].effectType,
        SEQFX_EFFECT_TYPES.crusher,
    );
});

test("seqfx_adapter_rejects_invalid_matrix_shape_in_presets_instead_of_normalizing_to_default", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

    assert.throws(() => adapter.normalizeForPreset({
        version: 2,
        patterns: [],
    }), /seqfx.*patterns/i);
});

test("seqfx_adapter_rejects_out_of_range_mix_values_instead_of_clamping_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = createDefaultSeqFxState();

    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].mix = 1.5;

    assert.throws(
        () => adapter.normalizeForPreset(JSON.stringify(presetState)),
        /pattern 0 lane 0 step 0 mix value 1\.5 is outside 0 to 1/i,
    );
});

test("seqfx_adapter_rejects_out_of_range_parameter_values_instead_of_clamping_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = createDefaultSeqFxState();

    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].active = true;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].trigger = true;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].effectType = SEQFX_EFFECT_TYPES.filter;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].params[1] = 20001;

    assert.throws(
        () => adapter.apply(JSON.stringify(presetState)),
        /pattern 0 lane 0 step 0 param 1 value 20001 is outside 20 to 20000/i,
    );
    assert.equal(connection.storedWrites.length, 0);
    assert.equal(connection.events.length, 0);
});

test("seqfx_adapter_rejects_fractional_integer_parameter_values_in_presets", () => {
    const connection = new FakePatchConnection();
    const bridge = new SeqFxRuntimeBridge(connection);
    const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });
    const presetState = createDefaultSeqFxState();

    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].active = true;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].trigger = true;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].effectType = SEQFX_EFFECT_TYPES.filter;
    presetState.patterns[0].lanes[SEQFX_LANES.filter].steps[0].params[0] = 1.5;

    assert.throws(
        () => adapter.serializeForPreset(JSON.stringify(presetState)),
        /pattern 0 lane 0 step 0 param 0 must be an integer/i,
    );
});
