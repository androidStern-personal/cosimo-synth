import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadStandaloneModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/standalone-effect-presets.ts");
}

async function loadContractModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
}

const ottStatus = {
    details: {
        inputs: [
            parameter("hostSlot0Guard", { hidden: true, init: 0, min: 0, max: 1 }),
            parameter("ottMix", { init: 100, min: 0, max: 100 }),
            parameter("ottAmount", { init: 100, min: 0, max: 100 }),
            parameter("ottTimePercent", { init: 100, min: 10, max: 1000 }),
            parameter("ottBandDrive", { init: 0, min: 0, max: 100 }),
            parameter("ottEnvelopeMatch", { init: 0, min: 0, max: 100 }),
            parameter("envelopeBoostClampDb", { init: 6, min: 0, max: 24 }),
        ],
    },
};

function parameter(endpointID, annotation = {}) {
    return {
        endpointID,
        purpose: "parameter",
        annotation,
    };
}

function factoryPresets() {
    return {
        ott: [
            {
                kind: "cosimo.effectPreset",
                version: 1,
                effectID: "ott",
                presetID: "ott.default-smash",
                label: "Default Smash",
                values: {
                    ottMix: 100,
                    ottAmount: 100,
                    ottTimePercent: 100,
                    ottBandDrive: 0,
                    ottEnvelopeMatch: 0,
                },
            },
            {
                kind: "cosimo.effectPreset",
                version: 1,
                effectID: "ott",
                presetID: "ott.envelope-tamed",
                label: "Envelope Tamed",
                values: {
                    ottMix: 86,
                    ottAmount: 92,
                    ottTimePercent: 100,
                    ottBandDrive: 12,
                    ottEnvelopeMatch: 38,
                },
            },
        ],
    };
}

async function createV2Preset({
    presetID = "user.ott.soft-smash",
    label = "Soft Smash",
    status = ottStatus,
    parameters = {},
    storedStateAdapters = [],
    storedState = {},
} = {}) {
    const { buildPluginStateContract } = await loadContractModule();
    const contract = buildPluginStateContract({
        effectID: "ott",
        status,
        storedState: storedStateAdapters,
    });
    const defaults = Object.fromEntries(contract.parameters.map((param) => [param.endpointID, param.defaultValue]));
    const serializedStoredState = {};

    for (const entry of contract.storedState) {
        const adapter = storedStateAdapters.find((candidate) => candidate.key === entry.key);
        const rawValue = Object.prototype.hasOwnProperty.call(storedState, entry.key)
            ? storedState[entry.key]
            : adapter?.capture?.();

        serializedStoredState[entry.key] = adapter
            ? adapter.serializeForPreset(adapter.normalizeForPreset(rawValue))
            : rawValue;
    }

    return {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "ott",
        presetID,
        label,
        contract,
        parameters: {
            ...defaults,
            ...parameters,
        },
        storedState: serializedStoredState,
    };
}

function createStoredMatrixAdapter(initialPattern = "saved") {
    let state = { pattern: initialPattern };
    const listeners = new Set();
    const cloneState = (value) => {
        if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.pattern !== "string") {
            throw new Error("Matrix stored state must contain a string pattern.");
        }

        return { pattern: value.pattern };
    };
    const notify = () => {
        for (const listener of listeners) {
            listener();
        }
    };

    return {
        adapter: {
            key: "matrix.v1",
            schemaVersion: 1,
            getContract() {
                return {
                    key: "matrix.v1",
                    schemaVersion: 1,
                    required: true,
                };
            },
            capture() {
                return cloneState(state);
            },
            normalizeForPreset(value) {
                return cloneState(value);
            },
            serializeForPreset(value) {
                return cloneState(value);
            },
            apply(value) {
                state = cloneState(value);
                notify();
            },
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        setPattern(pattern) {
            state = { pattern };
            notify();
        },
        get pattern() {
            return state.pattern;
        },
    };
}

function storedPresetStateV2(overrides = {}) {
    return JSON.stringify({
        kind: "cosimo.effectPresetState",
        version: 2,
        userPresets: {},
        activePresetByEffect: {},
        ...overrides,
    });
}

function parseStoredWrite(write) {
    assert.equal(typeof write.value, "string");
    return JSON.parse(write.value);
}

function createClipboardHarness(initialText = "") {
    let text = initialText;

    return {
        read: async () => text,
        write: async (nextText) => {
            text = nextText;
        },
        get text() {
            return text;
        },
    };
}

function createChocUserFilesHarness(initialFiles = {}) {
    const files = new Map(Object.entries(initialFiles));
    const calls = [];
    const keyFor = (scope, fileName) => `${scope}/${fileName}`;

    return {
        files,
        calls,
        api: {
            async list(scope) {
                calls.push({ operation: "list", scope });
                const prefix = `${scope}/`;
                return [...files.keys()]
                    .filter((key) => key.startsWith(prefix))
                    .map((key) => key.slice(prefix.length));
            },
            async read(scope, fileName) {
                calls.push({ operation: "read", scope, fileName });
                const key = keyFor(scope, fileName);

                if (!files.has(key)) {
                    throw new Error(`Missing test user file: ${key}`);
                }

                return files.get(key);
            },
            async write(scope, fileName, contents) {
                calls.push({ operation: "write", scope, fileName, contents });
                files.set(keyFor(scope, fileName), contents);
            },
            async delete(scope, fileName) {
                calls.push({ operation: "delete", scope, fileName });
                return files.delete(keyFor(scope, fileName));
            },
        },
    };
}

async function withChocUserFiles(chocUserFiles, run) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "chocUserFiles");

    Object.defineProperty(globalThis, "chocUserFiles", {
        configurable: true,
        value: chocUserFiles.api,
    });

    try {
        return await run();
    } finally {
        if (descriptor) {
            Object.defineProperty(globalThis, "chocUserFiles", descriptor);
        } else {
            delete globalThis.chocUserFiles;
        }
    }
}

async function flushMicrotasks(turns = 8) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

async function createPresetController({
    patchConnection = new FakeStandalonePatchConnection(),
    factoryPresetRegistry = factoryPresets(),
    createPresetID = () => "user.ott.generated",
    clipboard = createClipboardHarness(),
    storedStateAdapters = [],
} = {}) {
    const { StandaloneEffectPresetController } = await loadStandaloneModule();

    return new StandaloneEffectPresetController({
        effectID: "ott",
        patchConnection,
        factoryPresets: factoryPresetRegistry,
        storedStateAdapters,
        createPresetID,
        readClipboardText: clipboard.read,
        writeClipboardText: clipboard.write,
    });
}

class FakeStandalonePatchConnection {
    constructor({
        status = ottStatus,
        storedState = {},
        parameterValues = {},
        canPersistState = true,
    } = {}) {
        this.status = status;
        this.storedState = { ...storedState };
        this.parameterValues = { ...parameterValues };
        this.canPersistState = canPersistState;
        this.events = [];
        this.gestures = [];
        this.storedWrites = [];
        this.requestedParameters = [];
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();
        this.statusListeners = new Set();

        if (!canPersistState) {
            this.sendStoredStateValue = undefined;
        }
    }

    addStatusListener(listener) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        for (const listener of this.statusListeners) {
            listener(this.status);
        }
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

    sendStoredStateValue(key, value) {
        this.storedState[key] = value;
        this.storedWrites.push({ key, value });

        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    addParameterListener(endpointID, listener) {
        if (!this.parameterListeners.has(endpointID)) {
            this.parameterListeners.set(endpointID, new Set());
        }

        this.parameterListeners.get(endpointID).add(listener);
    }

    removeParameterListener(endpointID, listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID) {
        this.requestedParameters.push(endpointID);

        if (Object.prototype.hasOwnProperty.call(this.parameterValues, endpointID)) {
            this.emitParameterValue(endpointID, this.parameterValues[endpointID]);
        }
    }

    sendParameterGestureStart(endpointID) {
        this.gestures.push({ kind: "start", endpointID });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        this.emitParameterValue(endpointID, value);
    }

    sendParameterGestureEnd(endpointID) {
        this.gestures.push({ kind: "end", endpointID });
    }

    emitParameterValue(endpointID, value) {
        this.parameterValues[endpointID] = value;

        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

class ValuesBucketStoredStatePatchConnection extends FakeStandalonePatchConnection {
    constructor({
        valuesBucketState,
        ...options
    } = {}) {
        super(options);
        this.valuesBucketState = valuesBucketState;
        this.requestedStoredStateKeys = [];
    }

    requestFullStoredState(callback) {
        callback({
            parameters: {},
            values: {
                "effects.presets.v2": this.valuesBucketState,
            },
        });
    }

    requestStoredStateValue(key) {
        this.requestedStoredStateKeys.push(key);
    }

    emitRequestedStoredStateValue(key, value) {
        if (!this.requestedStoredStateKeys.includes(key)) {
            return false;
        }

        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }

        return true;
    }
}

class DelayedStoredStateFallbackPatchConnection extends FakeStandalonePatchConnection {
    constructor(options = {}) {
        super(options);
        this.requestedStoredStateKeys = [];
    }

    requestFullStoredState(callback) {
        callback({});
    }

    requestStoredStateValue(key) {
        this.requestedStoredStateKeys.push(key);
    }

    emitRequestedStoredStateValue(key, value) {
        if (!this.requestedStoredStateKeys.includes(key)) {
            return false;
        }

        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }

        return true;
    }
}

class DelayedParameterPatchConnection extends FakeStandalonePatchConnection {
    requestParameterValue(endpointID) {
        this.requestedParameters.push(endpointID);
    }
}

class ThrowingStoredStatePatchConnection extends FakeStandalonePatchConnection {
    sendStoredStateValue() {
        throw new Error("stored state write failed");
    }
}

class ThrowingParameterPatchConnection extends FakeStandalonePatchConnection {
    constructor({
        throwOnEndpointID,
        ...options
    }) {
        super(options);
        this.throwOnEndpointID = throwOnEndpointID;
    }

    sendEventOrValue(endpointID, value) {
        if (endpointID === this.throwOnEndpointID) {
            throw new Error(`parameter write failed for ${endpointID}`);
        }

        super.sendEventOrValue(endpointID, value);
    }
}

test("standalone controller derives preset contract from Cmajor status and fills legacy factory presets with every parameter", async () => {
    const patchConnection = new FakeStandalonePatchConnection();
    const controller = await createPresetController({ patchConnection });

    controller.attach();

    const state = controller.getState();
    assert.equal(state.ready, true);
    assert.deepEqual(state.currentContract.parameters.map((param) => param.endpointID), [
        "envelopeBoostClampDb",
        "ottAmount",
        "ottBandDrive",
        "ottEnvelopeMatch",
        "ottMix",
        "ottTimePercent",
    ]);
    assert.equal(state.currentContract.parameters.some((param) => param.endpointID === "hostSlot0Guard"), false);
    assert.deepEqual(state.presets.map((preset) => ({
        key: preset.presetKey,
        label: preset.label,
        source: preset.source,
        canDelete: preset.canDelete,
        canApply: preset.canApply,
    })), [
        { key: "factory:ott.default-smash", label: "Default Smash", source: "factory", canDelete: false, canApply: true },
        { key: "factory:ott.envelope-tamed", label: "Envelope Tamed", source: "factory", canDelete: false, canApply: true },
    ]);
    assert.deepEqual(state.factoryPresets[0].preset.parameters, {
        envelopeBoostClampDb: 6,
        ottAmount: 100,
        ottBandDrive: 0,
        ottEnvelopeMatch: 0,
        ottMix: 100,
        ottTimePercent: 100,
    });
});

test("standalone controller applies a v2 factory preset and stores active metadata under the v2 state key", async () => {
    const patchConnection = new FakeStandalonePatchConnection();
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.applyPreset("factory:ott.envelope-tamed");

    assert.equal(result.ok, true);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "envelopeBoostClampDb", value: 6 },
        { endpointID: "ottAmount", value: 92 },
        { endpointID: "ottBandDrive", value: 12 },
        { endpointID: "ottEnvelopeMatch", value: 38 },
        { endpointID: "ottMix", value: 86 },
        { endpointID: "ottTimePercent", value: 100 },
    ]);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });
    assert.equal(patchConnection.storedWrites.at(-1).key, "effects.presets.v2");
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect.ott, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });
});

test("standalone controller saves every live parameter and excludes hidden guard parameters", async () => {
    const patchConnection = new FakeStandalonePatchConnection({
        parameterValues: {
            hostSlot0Guard: 1,
            ottMix: 55,
            ottAmount: 70,
            ottTimePercent: 125,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            envelopeBoostClampDb: 11,
        },
    });
    const controller = await createPresetController({
        patchConnection,
        createPresetID: () => "user.ott.captured",
    });

    controller.attach();
    patchConnection.storedWrites = [];
    patchConnection.events = [];

    const result = controller.saveCurrentAsNewPreset("Captured");

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.parameters, {
        envelopeBoostClampDb: 11,
        ottAmount: 70,
        ottBandDrive: 8,
        ottEnvelopeMatch: 44,
        ottMix: 55,
        ottTimePercent: 125,
    });
    assert.equal("hostSlot0Guard" in result.value.parameters, false);
    assert.deepEqual(patchConnection.events, []);

    const persisted = parseStoredWrite(patchConnection.storedWrites.at(-1));
    assert.equal(persisted.version, 2);
    assert.deepEqual(persisted.userPresets.ott[0].parameters, result.value.parameters);
    assert.equal(persisted.userPresets.ott[0].contract.hash, controller.getState().currentContract.hash);
    assert.deepEqual(persisted.activePresetByEffect.ott, {
        presetID: "user.ott.captured",
        label: "Captured",
        dirty: false,
    });
});

test("standalone controller loads user presets from CHOC files instead of Cmajor stored state", async () => {
    const filePreset = await createV2Preset({
        presetID: "user.ott.file-preset",
        label: "File Preset",
        parameters: {
            envelopeBoostClampDb: 10,
            ottAmount: 71,
            ottBandDrive: 9,
            ottEnvelopeMatch: 45,
            ottMix: 56,
            ottTimePercent: 126,
        },
    });
    const staleStoredPreset = await createV2Preset({
        presetID: "user.ott.stale-stored-state",
        label: "Stale Stored State",
    });
    const chocUserFiles = createChocUserFilesHarness({
        "ott/user.ott.file-preset.json": JSON.stringify(filePreset),
    });

    await withChocUserFiles(chocUserFiles, async () => {
        const patchConnection = new FakeStandalonePatchConnection({
            storedState: {
                "effects.presets.v2": storedPresetStateV2({
                    userPresets: {
                        ott: [staleStoredPreset],
                    },
                    activePresetByEffect: {
                        ott: {
                            presetID: "user.ott.file-preset",
                            label: "File Preset",
                            dirty: false,
                        },
                    },
                }),
            },
        });
        const controller = await createPresetController({ patchConnection });

        controller.attach();
        await flushMicrotasks();

        assert.deepEqual(controller.getState().userPresets.map((preset) => ({
            presetID: preset.presetID,
            label: preset.label,
            source: preset.source,
        })), [{
            presetID: "user.ott.file-preset",
            label: "File Preset",
            source: "user",
        }]);
        assert.deepEqual(controller.getState().activePreset, {
            presetID: "user.ott.file-preset",
            label: "File Preset",
            dirty: false,
        });
        assert.deepEqual(chocUserFiles.calls.map((call) => ({
            operation: call.operation,
            scope: call.scope,
            fileName: call.fileName,
        })), [
            { operation: "list", scope: "ott", fileName: undefined },
            { operation: "read", scope: "ott", fileName: "user.ott.file-preset.json" },
        ]);
    });
});

test("standalone controller ignores stale preset metadata fallback after values-bucket boot and local preset apply", async () => {
    const patchConnection = new ValuesBucketStoredStatePatchConnection({
        valuesBucketState: storedPresetStateV2({
            activePresetByEffect: {
                ott: {
                    presetID: "ott.default-smash",
                    label: "Default Smash",
                    dirty: false,
                },
            },
        }),
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.default-smash",
        label: "Default Smash",
        dirty: false,
    });

    const applyResult = controller.applyPreset("factory:ott.envelope-tamed");
    assert.equal(applyResult.ok, true);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });

    const emitted = patchConnection.emitRequestedStoredStateValue("effects.presets.v2", storedPresetStateV2({
        activePresetByEffect: {
            ott: {
                presetID: "ott.default-smash",
                label: "Default Smash",
                dirty: false,
            },
        },
    }));

    assert.equal(emitted, false);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });
    assert.deepEqual(patchConnection.requestedStoredStateKeys, []);
});

test("standalone controller ignores stale preset metadata fallback after local preset apply", async () => {
    const patchConnection = new DelayedStoredStateFallbackPatchConnection();
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    assert.deepEqual(patchConnection.requestedStoredStateKeys, ["effects.presets.v2"]);

    const applyResult = controller.applyPreset("factory:ott.envelope-tamed");
    assert.equal(applyResult.ok, true);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });

    const emitted = patchConnection.emitRequestedStoredStateValue("effects.presets.v2", storedPresetStateV2({
        activePresetByEffect: {
            ott: {
                presetID: "ott.default-smash",
                label: "Default Smash",
                dirty: false,
            },
        },
    }));

    assert.equal(emitted, true);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });
});

test("standalone controller writes user presets to CHOC files and keeps Cmajor stored state metadata-only", async () => {
    const chocUserFiles = createChocUserFilesHarness();

    await withChocUserFiles(chocUserFiles, async () => {
        const patchConnection = new FakeStandalonePatchConnection({
            parameterValues: {
                hostSlot0Guard: 1,
                ottMix: 55,
                ottAmount: 70,
                ottTimePercent: 125,
                ottBandDrive: 8,
                ottEnvelopeMatch: 44,
                envelopeBoostClampDb: 11,
            },
        });
        const controller = await createPresetController({
            patchConnection,
            createPresetID: () => "user.ott.file-write",
        });

        controller.attach();
        patchConnection.storedWrites = [];

        const result = controller.saveCurrentAsNewPreset("File Write");
        await flushMicrotasks();

        assert.equal(result.ok, true);
        assert.deepEqual(JSON.parse(chocUserFiles.files.get("ott/user.ott.file-write.json")).parameters, {
            envelopeBoostClampDb: 11,
            ottAmount: 70,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            ottMix: 55,
            ottTimePercent: 125,
        });

        const persisted = parseStoredWrite(patchConnection.storedWrites.at(-1));
        assert.deepEqual(persisted.userPresets, {});
        assert.deepEqual(persisted.activePresetByEffect.ott, {
            presetID: "user.ott.file-write",
            label: "File Write",
            dirty: false,
        });
        assert.deepEqual(chocUserFiles.calls
            .filter((call) => call.operation === "write")
            .map((call) => ({
                operation: call.operation,
                scope: call.scope,
                fileName: call.fileName,
            })), [{
            operation: "write",
            scope: "ott",
            fileName: "user.ott.file-write.json",
        }]);
    });
});

test("standalone controller deletes removed user presets from CHOC files", async () => {
    const filePreset = await createV2Preset({
        presetID: "user.ott.delete-me",
        label: "Delete Me",
    });
    const chocUserFiles = createChocUserFilesHarness({
        "ott/user.ott.delete-me.json": JSON.stringify(filePreset),
    });

    await withChocUserFiles(chocUserFiles, async () => {
        const patchConnection = new FakeStandalonePatchConnection();
        const controller = await createPresetController({ patchConnection });

        controller.attach();
        await flushMicrotasks();

        const result = controller.deletePreset("user:user.ott.delete-me");
        await flushMicrotasks();

        assert.equal(result.ok, true);
        assert.equal(chocUserFiles.files.has("ott/user.ott.delete-me.json"), false);
        assert.deepEqual(chocUserFiles.calls
            .filter((call) => call.operation === "delete")
            .map((call) => ({
                operation: call.operation,
                scope: call.scope,
                fileName: call.fileName,
            })), [{
            operation: "delete",
            scope: "ott",
            fileName: "user.ott.delete-me.json",
        }]);
        assert.deepEqual(controller.getState().userPresets, []);
    });
});

test("standalone controller refuses to save while any current parameter value is missing", async () => {
    const patchConnection = new FakeStandalonePatchConnection({
        parameterValues: {
            ottMix: 55,
            ottAmount: 70,
        },
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.saveCurrentAsNewPreset("Incomplete");

    assert.equal(result.ok, false);
    assert.match(result.message, /missing.*envelopeBoostClampDb/i);
    assert.match(result.message, /missing.*ottBandDrive/i);
    assert.match(result.message, /missing.*ottEnvelopeMatch/i);
    assert.match(result.message, /missing.*ottTimePercent/i);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("standalone controller does not assume current parameter value requests resolve synchronously", async () => {
    const patchConnection = new DelayedParameterPatchConnection();
    const controller = await createPresetController({
        patchConnection,
        createPresetID: () => "user.ott.async-capture",
    });

    controller.attach();
    patchConnection.storedWrites = [];
    assert.deepEqual(patchConnection.requestedParameters, [
        "envelopeBoostClampDb",
        "ottAmount",
        "ottBandDrive",
        "ottEnvelopeMatch",
        "ottMix",
        "ottTimePercent",
    ]);

    const saveBeforeValuesResult = controller.saveCurrentAsNewPreset("Async Capture");
    assert.equal(saveBeforeValuesResult.ok, false);
    assert.match(saveBeforeValuesResult.message, /missing.*envelopeBoostClampDb.*ottAmount.*ottBandDrive.*ottEnvelopeMatch.*ottMix.*ottTimePercent/i);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);

    patchConnection.emitParameterValue("envelopeBoostClampDb", 10);
    patchConnection.emitParameterValue("ottAmount", 42);
    patchConnection.emitParameterValue("ottBandDrive", 44);
    patchConnection.emitParameterValue("ottEnvelopeMatch", 45);
    patchConnection.emitParameterValue("ottMix", 41);
    patchConnection.emitParameterValue("ottTimePercent", 43);

    const saveAfterValuesResult = controller.saveCurrentAsNewPreset("Async Capture");

    assert.equal(saveAfterValuesResult.ok, true);
    assert.deepEqual(saveAfterValuesResult.value.parameters, {
        envelopeBoostClampDb: 10,
        ottAmount: 42,
        ottBandDrive: 44,
        ottEnvelopeMatch: 45,
        ottMix: 41,
        ottTimePercent: 43,
    });
});

test("standalone controller reports invalid live parameter values instead of silently dropping them", async () => {
    const patchConnection = new FakeStandalonePatchConnection({
        parameterValues: {
            ottMix: 50,
        },
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    assert.equal(controller.getState().currentValues.ottMix, 50);

    patchConnection.emitParameterValue("ottMix", 200);
    const state = controller.getState();

    assert.match(state.lastError, /ottMix value 200 is above maximum 100/i);
    assert.equal(state.currentValues.ottMix, 50);
});

test("standalone import rejects stale or incomplete v2 presets before memory or sound writes", async () => {
    const patchConnection = new FakeStandalonePatchConnection();
    const controller = await createPresetController({ patchConnection });
    const stalePreset = await createV2Preset({
        parameters: {
            obsoleteControl: 1,
        },
    });

    stalePreset.contract = {
        ...stalePreset.contract,
        hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    };

    controller.attach();
    patchConnection.storedWrites = [];
    patchConnection.events = [];

    const result = controller.importPresetText(JSON.stringify(stalePreset), { applyAfterImport: true });

    assert.equal(result.ok, false);
    assert.match(result.message, /unknown saved parameters/i);
    assert.match(result.message, /obsoleteControl/i);
    assert.match(result.message, /no migration/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("standalone controller reports invalid persisted v2 state instead of silently clearing it", async () => {
    const patchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v2": JSON.stringify({
                kind: "cosimo.effectPresetState",
                version: 2,
                userPresets: {
                    ott: [{
                        kind: "cosimo.effectPreset",
                        version: 999,
                        effectID: "ott",
                        presetID: "user.ott.stale",
                        label: "Stale",
                        contract: { hash: "sha256:deadbeef" },
                        parameters: {},
                        storedState: {},
                    }],
                },
                activePresetByEffect: {},
            }),
        },
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();

    assert.match(controller.getState().lastError, /unsupported effect preset version/i);
    assert.deepEqual(controller.getState().userPresets, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("standalone dirty tracking ignores apply writes and persists the first later edit", async () => {
    const patchConnection = new FakeStandalonePatchConnection();
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    patchConnection.storedWrites = [];

    const applyResult = controller.applyPreset("factory:ott.default-smash");
    assert.equal(applyResult.ok, true);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.default-smash",
        label: "Default Smash",
        dirty: false,
    });
    assert.equal(patchConnection.storedWrites.length, 1);

    patchConnection.emitParameterValue("ottMix", 51);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.default-smash",
        label: "Default Smash",
        dirty: true,
    });
    assert.equal(patchConnection.storedWrites.length, 2);

    patchConnection.emitParameterValue("ottAmount", 52);
    assert.equal(patchConnection.storedWrites.length, 2);
    assert.deepEqual(controller.getState().currentValues.ottAmount, 52);
});

test("standalone dirty tracking marks an active user preset dirty when subscribed stored state changes", async () => {
    const matrix = createStoredMatrixAdapter("saved");
    const userPreset = await createV2Preset({
        presetID: "user.ott.matrix",
        label: "Matrix",
        storedStateAdapters: [matrix.adapter],
        storedState: {
            "matrix.v1": { pattern: "saved" },
        },
    });
    const patchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v2": storedPresetStateV2({
                userPresets: {
                    ott: [userPreset],
                },
                activePresetByEffect: {
                    ott: {
                        presetID: "user.ott.matrix",
                        label: "Matrix",
                        dirty: false,
                    },
                },
            }),
        },
    });
    const controller = await createPresetController({
        patchConnection,
        factoryPresetRegistry: { ott: [] },
        storedStateAdapters: [matrix.adapter],
    });

    controller.attach();
    patchConnection.storedWrites = [];

    matrix.setPattern("edited");
    await flushMicrotasks();

    const state = controller.getState();
    const activeItem = state.presets.find((preset) => preset.isActive);

    assert.deepEqual(state.activePreset, {
        presetID: "user.ott.matrix",
        label: "Matrix",
        dirty: true,
    });
    assert.equal(state.dirty, true);
    assert.deepEqual(activeItem && {
        presetID: activeItem.presetID,
        source: activeItem.source,
        canOverwrite: activeItem.canOverwrite,
        dirty: activeItem.dirty,
    }, {
        presetID: "user.ott.matrix",
        source: "user",
        canOverwrite: true,
        dirty: true,
    });
    assert.equal(patchConnection.storedWrites.length, 1);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect.ott, {
        presetID: "user.ott.matrix",
        label: "Matrix",
        dirty: true,
    });
});

test("standalone dirty tracking marks a newly saved user preset dirty after a later stored-state edit", async () => {
    const matrix = createStoredMatrixAdapter("captured");
    const patchConnection = new FakeStandalonePatchConnection({
        parameterValues: {
            envelopeBoostClampDb: 6,
            ottAmount: 100,
            ottBandDrive: 0,
            ottEnvelopeMatch: 0,
            ottMix: 100,
            ottTimePercent: 100,
        },
    });
    const controller = await createPresetController({
        patchConnection,
        factoryPresetRegistry: { ott: [] },
        createPresetID: () => "user.ott.saved-matrix",
        storedStateAdapters: [matrix.adapter],
    });

    controller.attach();
    patchConnection.storedWrites = [];

    const saveResult = controller.saveCurrentAsNewPreset("Saved Matrix");

    assert.equal(saveResult.ok, true);
    assert.deepEqual(saveResult.value.storedState, {
        "matrix.v1": { pattern: "captured" },
    });
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "user.ott.saved-matrix",
        label: "Saved Matrix",
        dirty: false,
    });

    patchConnection.storedWrites = [];
    matrix.setPattern("edited-after-save");
    await flushMicrotasks();

    const state = controller.getState();
    const activeItem = state.presets.find((preset) => preset.isActive);

    assert.deepEqual(state.activePreset, {
        presetID: "user.ott.saved-matrix",
        label: "Saved Matrix",
        dirty: true,
    });
    assert.equal(state.dirty, true);
    assert.deepEqual(activeItem && {
        presetID: activeItem.presetID,
        source: activeItem.source,
        canOverwrite: activeItem.canOverwrite,
        dirty: activeItem.dirty,
    }, {
        presetID: "user.ott.saved-matrix",
        source: "user",
        canOverwrite: true,
        dirty: true,
    });
    assert.equal(patchConnection.storedWrites.length, 1);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect.ott, {
        presetID: "user.ott.saved-matrix",
        label: "Saved Matrix",
        dirty: true,
    });
});

test("standalone persistent mutations fail before sound writes when stored state cannot be saved", async () => {
    const patchConnection = new FakeStandalonePatchConnection({
        canPersistState: false,
        parameterValues: {
            envelopeBoostClampDb: 11,
            ottAmount: 70,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            ottMix: 55,
            ottTimePercent: 125,
        },
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();

    const applyResult = controller.applyPreset("factory:ott.default-smash");
    const saveResult = controller.saveCurrentAsNewPreset("Captured");

    assert.equal(applyResult.ok, false);
    assert.equal(saveResult.ok, false);
    assert.match(applyResult.message, /stored state/i);
    assert.match(saveResult.message, /stored state/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
});

test("standalone persistent mutations do not change sound or memory state when stored state writes throw", async () => {
    const patchConnection = new ThrowingStoredStatePatchConnection({
        parameterValues: {
            envelopeBoostClampDb: 11,
            ottAmount: 70,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
            ottMix: 55,
            ottTimePercent: 125,
        },
    });
    const controller = await createPresetController({ patchConnection });
    const importPreset = await createV2Preset({
        presetID: "user.ott.imported-after-throw",
        parameters: {
            envelopeBoostClampDb: 9,
            ottAmount: 80,
            ottBandDrive: 9,
            ottEnvelopeMatch: 40,
            ottMix: 60,
            ottTimePercent: 110,
        },
    });

    controller.attach();
    patchConnection.events = [];

    const applyResult = controller.applyPreset("factory:ott.envelope-tamed");
    const saveResult = controller.saveCurrentAsNewPreset("Captured");
    const importResult = controller.importPresetText(JSON.stringify(importPreset), { applyAfterImport: true });

    assert.equal(applyResult.ok, false);
    assert.equal(saveResult.ok, false);
    assert.equal(importResult.ok, false);
    assert.match(applyResult.message, /stored state write failed/i);
    assert.match(saveResult.message, /stored state write failed/i);
    assert.match(importResult.message, /stored state write failed/i);
    assert.deepEqual(patchConnection.events, []);
    assert.equal(controller.getState().activePreset, null);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("standalone apply rolls back active metadata when parameter writes fail", async () => {
    const patchConnection = new ThrowingParameterPatchConnection({
        throwOnEndpointID: "ottAmount",
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.applyPreset("factory:ott.envelope-tamed");

    assert.equal(result.ok, false);
    assert.match(result.message, /parameter write failed for ottAmount/i);
    assert.deepEqual(controller.getState().activePreset, null);
    assert.deepEqual(JSON.parse(patchConnection.storedWrites.at(-1).value).activePresetByEffect, {});
});

test("standalone import with apply rolls back imported preset when parameter writes fail", async () => {
    const patchConnection = new ThrowingParameterPatchConnection({
        throwOnEndpointID: "ottAmount",
    });
    const controller = await createPresetController({ patchConnection });
    const importPreset = await createV2Preset({
        presetID: "user.ott.imported-then-failed",
        parameters: {
            envelopeBoostClampDb: 9,
            ottAmount: 80,
            ottBandDrive: 9,
            ottEnvelopeMatch: 40,
            ottMix: 60,
            ottTimePercent: 110,
        },
    });

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.importPresetText(JSON.stringify(importPreset), { applyAfterImport: true });

    assert.equal(result.ok, false);
    assert.match(result.message, /parameter write failed for ottAmount/i);
    assert.deepEqual(controller.getState().activePreset, null);
    assert.deepEqual(controller.getState().userPresets, []);

    const finalStoredState = JSON.parse(patchConnection.storedWrites.at(-1).value);
    assert.deepEqual(finalStoredState.userPresets, {});
    assert.deepEqual(finalStoredState.activePresetByEffect, {});
});

test("standalone direct import rejects an existing user preset ID unless overwrite is requested", async () => {
    const userPreset = await createV2Preset();
    const patchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v2": storedPresetStateV2({
                userPresets: {
                    ott: [userPreset],
                },
            }),
        },
    });
    const controller = await createPresetController({ patchConnection });

    controller.attach();
    patchConnection.storedWrites = [];

    const importResult = controller.importPresetText(JSON.stringify(userPreset), { applyAfterImport: true });

    assert.equal(importResult.ok, false);
    assert.match(importResult.message, /user preset "user\.ott\.soft-smash" already exists/i);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(
        controller.getState().userPresets.map((preset) => preset.presetID),
        ["user.ott.soft-smash"],
    );
});

test("standalone clipboard mutations export and import v2 preset json", async () => {
    const clipboard = createClipboardHarness();
    const userPreset = await createV2Preset({
        parameters: {
            envelopeBoostClampDb: 10,
            ottAmount: 91,
            ottBandDrive: 14,
            ottEnvelopeMatch: 63,
            ottMix: 82,
            ottTimePercent: 100,
        },
    });
    const sourcePatchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v2": storedPresetStateV2({
                userPresets: {
                    ott: [userPreset],
                },
            }),
        },
    });
    const sourceController = await createPresetController({ patchConnection: sourcePatchConnection, clipboard });

    sourceController.attach();

    const copyResult = await sourceController.copyPresetToClipboard("user:user.ott.soft-smash");
    assert.equal(copyResult.ok, true);
    assert.deepEqual(JSON.parse(clipboard.text), userPreset);

    const destinationPatchConnection = new FakeStandalonePatchConnection();
    const destinationController = await createPresetController({ patchConnection: destinationPatchConnection, clipboard });

    destinationController.attach();
    destinationPatchConnection.storedWrites = [];

    const pasteResult = await destinationController.pastePresetFromClipboard({ applyAfterImport: true });

    assert.equal(pasteResult.ok, true);
    assert.deepEqual(pasteResult.value.parameters, userPreset.parameters);
    assert.deepEqual(destinationPatchConnection.events, [
        { endpointID: "envelopeBoostClampDb", value: 10 },
        { endpointID: "ottAmount", value: 91 },
        { endpointID: "ottBandDrive", value: 14 },
        { endpointID: "ottEnvelopeMatch", value: 63 },
        { endpointID: "ottMix", value: 82 },
        { endpointID: "ottTimePercent", value: 100 },
    ]);
    assert.deepEqual(parseStoredWrite(destinationPatchConnection.storedWrites.at(-1)).userPresets.ott[0].parameters, userPreset.parameters);
});

test("standalone clipboard paste creates a new user preset when the copied preset ID already exists", async () => {
    const clipboard = createClipboardHarness();
    const userPreset = await createV2Preset({
        parameters: {
            envelopeBoostClampDb: 10,
            ottAmount: 91,
            ottBandDrive: 14,
            ottEnvelopeMatch: 63,
            ottMix: 82,
            ottTimePercent: 100,
        },
    });
    const patchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v2": storedPresetStateV2({
                userPresets: {
                    ott: [userPreset],
                },
            }),
        },
    });
    const controller = await createPresetController({
        patchConnection,
        clipboard,
        createPresetID: ({ attempt }) => (
            attempt === 0 ? "user.ott.soft-smash" : `user.ott.soft-smash-paste-${attempt}`
        ),
    });

    controller.attach();
    const copyResult = await controller.copyPresetToClipboard("user:user.ott.soft-smash");
    patchConnection.events = [];
    patchConnection.storedWrites = [];

    const pasteResult = await controller.pastePresetFromClipboard({ applyAfterImport: true });

    assert.equal(copyResult.ok, true);
    assert.equal(pasteResult.ok, true);
    assert.equal(pasteResult.value.presetID, "user.ott.soft-smash-paste-1");
    assert.equal(pasteResult.value.label, "Soft Smash");
    assert.equal(pasteResult.value.parameters.ottAmount, 91);
    assert.equal(pasteResult.value.parameters.ottMix, 82);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "envelopeBoostClampDb", value: 10 },
        { endpointID: "ottAmount", value: 91 },
        { endpointID: "ottBandDrive", value: 14 },
        { endpointID: "ottEnvelopeMatch", value: 63 },
        { endpointID: "ottMix", value: 82 },
        { endpointID: "ottTimePercent", value: 100 },
    ]);

    const storedState = parseStoredWrite(patchConnection.storedWrites.at(-1));
    assert.deepEqual(
        storedState.userPresets.ott.map((preset) => preset.presetID),
        ["user.ott.soft-smash", "user.ott.soft-smash-paste-1"],
    );
    assert.deepEqual(storedState.activePresetByEffect.ott, {
        presetID: "user.ott.soft-smash-paste-1",
        label: "Soft Smash",
        dirty: false,
    });
});
