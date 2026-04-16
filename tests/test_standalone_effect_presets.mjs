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
} = {}) {
    const { buildPluginStateContract } = await loadContractModule();
    const contract = buildPluginStateContract({ effectID: "ott", status });
    const defaults = Object.fromEntries(contract.parameters.map((param) => [param.endpointID, param.defaultValue]));

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
        storedState: {},
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

async function createPresetController({
    patchConnection = new FakeStandalonePatchConnection(),
    createPresetID = () => "user.ott.generated",
    clipboard = createClipboardHarness(),
} = {}) {
    const { StandaloneEffectPresetController } = await loadStandaloneModule();

    return new StandaloneEffectPresetController({
        effectID: "ott",
        patchConnection,
        factoryPresets: factoryPresets(),
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
