import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadStandaloneModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/standalone-effect-presets.ts");
}

function createDescriptorRegistry() {
    return {
        ott: {
            effectID: "ott",
            label: "OTT",
            params: {
                ottMix: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottAmount: { type: "number", min: 0, max: 100, defaultValue: 100 },
                ottTimePercent: { type: "number", min: 10, max: 1000, defaultValue: 100, clamp: true },
                ottBandDrive: { type: "number", min: 0, max: 100, defaultValue: 0 },
                ottEnvelopeMatch: { type: "number", min: 0, max: 100, defaultValue: 0 },
            },
        },
        chorus: {
            effectID: "chorus",
            label: "Chorus",
            params: {
                chorusEnabled: { type: "integer", min: 0, max: 1, defaultValue: 0 },
                chorusMix: { type: "number", min: 0, max: 1, defaultValue: 0 },
                chorusMotionMode: { type: "integer", min: 0, max: 3, defaultValue: 1 },
            },
        },
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
        chorus: [
            {
                kind: "cosimo.effectPreset",
                version: 1,
                effectID: "chorus",
                presetID: "chorus.wide",
                label: "Wide Chorus",
                values: {
                    chorusEnabled: 1,
                    chorusMix: 0.62,
                    chorusMotionMode: 2,
                },
            },
        ],
    };
}

function ottUserPreset(overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.soft-smash",
        label: "Soft Smash",
        values: {
            ottMix: 82,
            ottAmount: 91,
            ottTimePercent: 100,
            ottBandDrive: 14,
            ottEnvelopeMatch: 63,
        },
        ...overrides,
    };
}

function chorusUserPreset(overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "chorus",
        presetID: "user.chorus.wide",
        label: "Wide",
        values: {
            chorusEnabled: 1,
            chorusMix: 0.62,
            chorusMotionMode: 2,
        },
        ...overrides,
    };
}

function storedPresetState(overrides = {}) {
    return JSON.stringify({
        kind: "cosimo.effectPresetState",
        version: 1,
        userPresets: {},
        activePresetByEffect: {},
        ...overrides,
    });
}

function parseStoredWrite(write) {
    assert.equal(typeof write.value, "string");
    return JSON.parse(write.value);
}

function createPresetController({
    patchConnection = new FakeStandalonePatchConnection(),
    createPresetID = () => "user.ott.generated",
    clipboard = createClipboardHarness(),
} = {}) {
    return {
        patchConnection,
        clipboard,
        async create(effectID = "ott") {
            const { StandaloneEffectPresetController } = await loadStandaloneModule();

            return new StandaloneEffectPresetController({
                effectID,
                patchConnection,
                descriptorRegistry: createDescriptorRegistry(),
                factoryPresets: factoryPresets(),
                createPresetID,
                readClipboardText: clipboard.read,
                writeClipboardText: clipboard.write,
            });
        },
    };
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

class FakeStandalonePatchConnection {
    constructor({ storedState = {}, parameterValues = {}, canPersistState = true } = {}) {
        this.storedState = { ...storedState };
        this.parameterValues = { ...parameterValues };
        this.canPersistState = canPersistState;
        this.events = [];
        this.gestures = [];
        this.storedWrites = [];
        this.requestedParameters = [];
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();

        if (!canPersistState) {
            this.sendStoredStateValue = undefined;
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

test("standalone controller lists a flat preset set and filters by query and source", async () => {
    const { patchConnection, create } = createPresetController({
        patchConnection: new FakeStandalonePatchConnection({
            storedState: {
                "effects.presets.v1": storedPresetState({
                    userPresets: {
                        ott: [ottUserPreset()],
                        chorus: [chorusUserPreset()],
                    },
                }),
            },
        }),
    });
    const controller = await create();

    controller.attach();

    assert.deepEqual(controller.getState().presets.map((preset) => ({
        key: preset.presetKey,
        label: preset.label,
        source: preset.source,
        canDelete: preset.canDelete,
    })), [
        { key: "factory:ott.default-smash", label: "Default Smash", source: "factory", canDelete: false },
        { key: "factory:ott.envelope-tamed", label: "Envelope Tamed", source: "factory", canDelete: false },
        { key: "user:user.ott.soft-smash", label: "Soft Smash", source: "user", canDelete: true },
    ]);

    controller.setFilter({ query: "env" });
    assert.deepEqual(controller.getState().visiblePresets.map((preset) => preset.label), ["Envelope Tamed"]);

    controller.setFilter({ source: "user", query: "" });
    assert.deepEqual(controller.getState().visiblePresets.map((preset) => preset.label), ["Soft Smash"]);
    assert.deepEqual(patchConnection.events, []);
});

test("standalone controller applies a preset key through real parameters and stores active metadata", async () => {
    const { patchConnection, create } = createPresetController();
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.applyPreset("factory:ott.envelope-tamed");

    assert.equal(result.ok, true);
    assert.deepEqual(patchConnection.events, [
        { endpointID: "ottMix", value: 86 },
        { endpointID: "ottAmount", value: 92 },
        { endpointID: "ottTimePercent", value: 100 },
        { endpointID: "ottBandDrive", value: 12 },
        { endpointID: "ottEnvelopeMatch", value: 38 },
    ]);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "ott.envelope-tamed",
        label: "Envelope Tamed",
        dirty: false,
    });
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect, {
        ott: {
            presetID: "ott.envelope-tamed",
            label: "Envelope Tamed",
            dirty: false,
        },
    });
});

test("standalone controller saves current descriptor values as an active clean user preset", async () => {
    const { patchConnection, create } = createPresetController({
        patchConnection: new FakeStandalonePatchConnection({
            parameterValues: {
                ottMix: 55,
                ottAmount: 70,
                ottTimePercent: 125,
                ottBandDrive: 8,
                ottEnvelopeMatch: 44,
                hostSlot0Guard: 1,
            },
        }),
        createPresetID: () => "user.ott.captured",
    });
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];
    patchConnection.events = [];

    const result = controller.saveCurrentAsNewPreset("Captured");

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.values, {
        ottMix: 55,
        ottAmount: 70,
        ottTimePercent: 125,
        ottBandDrive: 8,
        ottEnvelopeMatch: 44,
    });
    assert.deepEqual(patchConnection.events, []);

    const persisted = parseStoredWrite(patchConnection.storedWrites.at(-1));
    assert.deepEqual(persisted.userPresets.ott, [{
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.captured",
        label: "Captured",
        values: {
            ottMix: 55,
            ottAmount: 70,
            ottTimePercent: 125,
            ottBandDrive: 8,
            ottEnvelopeMatch: 44,
        },
    }]);
    assert.deepEqual(persisted.activePresetByEffect.ott, {
        presetID: "user.ott.captured",
        label: "Captured",
        dirty: false,
    });
});

test("standalone controller refuses to save partial current values", async () => {
    const { patchConnection, create } = createPresetController({
        patchConnection: new FakeStandalonePatchConnection({
            parameterValues: {
                ottMix: 55,
                ottAmount: 70,
            },
        }),
    });
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];

    const result = controller.saveCurrentAsNewPreset("Incomplete");

    assert.equal(result.ok, false);
    assert.match(result.message, /missing.*ottTimePercent.*ottBandDrive.*ottEnvelopeMatch/i);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("standalone controller does not assume current parameter value requests resolve synchronously", async () => {
    const { patchConnection, create } = createPresetController({
        patchConnection: new DelayedParameterPatchConnection(),
        createPresetID: () => "user.ott.async-capture",
    });
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];
    const initialRequests = [
        "ottMix",
        "ottAmount",
        "ottTimePercent",
        "ottBandDrive",
        "ottEnvelopeMatch",
    ];
    assert.deepEqual(patchConnection.requestedParameters, initialRequests);

    const saveBeforeValuesResult = controller.saveCurrentAsNewPreset("Async Capture");
    assert.equal(saveBeforeValuesResult.ok, false);
    assert.match(saveBeforeValuesResult.message, /missing.*ottMix.*ottAmount.*ottTimePercent.*ottBandDrive.*ottEnvelopeMatch/i);
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);
    assert.deepEqual(patchConnection.requestedParameters, initialRequests);

    patchConnection.emitParameterValue("ottMix", 41);
    patchConnection.emitParameterValue("ottAmount", 42);
    patchConnection.emitParameterValue("ottTimePercent", 43);
    patchConnection.emitParameterValue("ottBandDrive", 44);
    patchConnection.emitParameterValue("ottEnvelopeMatch", 45);

    const saveAfterValuesResult = controller.saveCurrentAsNewPreset("Async Capture");

    assert.equal(saveAfterValuesResult.ok, true);
    assert.deepEqual(saveAfterValuesResult.value.values, {
        ottMix: 41,
        ottAmount: 42,
        ottTimePercent: 43,
        ottBandDrive: 44,
        ottEnvelopeMatch: 45,
    });
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).userPresets.ott[0], {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.async-capture",
        label: "Async Capture",
        values: {
            ottMix: 41,
            ottAmount: 42,
            ottTimePercent: 43,
            ottBandDrive: 44,
            ottEnvelopeMatch: 45,
        },
    });
    assert.deepEqual(patchConnection.requestedParameters, initialRequests);
});

test("standalone controller renames overwrites and deletes user presets without allowing factory mutation", async () => {
    const { patchConnection, create } = createPresetController({
        patchConnection: new FakeStandalonePatchConnection({
            storedState: {
                "effects.presets.v1": storedPresetState({
                    userPresets: {
                        ott: [ottUserPreset()],
                    },
                    activePresetByEffect: {
                        ott: {
                            presetID: "user.ott.soft-smash",
                            label: "Soft Smash",
                            dirty: true,
                        },
                    },
                }),
            },
            parameterValues: {
                ottMix: 12,
                ottAmount: 34,
                ottTimePercent: 56,
                ottBandDrive: 7,
                ottEnvelopeMatch: 89,
            },
        }),
    });
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];

    const renameResult = controller.renamePreset("user:user.ott.soft-smash", "Renamed Smash");
    assert.equal(renameResult.ok, true);
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "user.ott.soft-smash",
        label: "Renamed Smash",
        dirty: true,
    });
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect.ott, {
        presetID: "user.ott.soft-smash",
        label: "Renamed Smash",
        dirty: true,
    });

    const overwriteResult = controller.overwriteUserPreset("user:user.ott.soft-smash");
    assert.equal(overwriteResult.ok, true);
    assert.deepEqual(overwriteResult.value.values, {
        ottMix: 12,
        ottAmount: 34,
        ottTimePercent: 56,
        ottBandDrive: 7,
        ottEnvelopeMatch: 89,
    });
    assert.deepEqual(controller.getState().activePreset, {
        presetID: "user.ott.soft-smash",
        label: "Renamed Smash",
        dirty: false,
    });
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).userPresets.ott[0], {
        kind: "cosimo.effectPreset",
        version: 1,
        effectID: "ott",
        presetID: "user.ott.soft-smash",
        label: "Renamed Smash",
        values: {
            ottMix: 12,
            ottAmount: 34,
            ottTimePercent: 56,
            ottBandDrive: 7,
            ottEnvelopeMatch: 89,
        },
    });

    const storedWriteCountBeforeFactoryDelete = patchConnection.storedWrites.length;
    const factoryDeleteResult = controller.deletePreset("factory:ott.default-smash");
    assert.equal(factoryDeleteResult.ok, false);
    assert.match(factoryDeleteResult.message, /factory.*delete/i);
    assert.equal(patchConnection.storedWrites.length, storedWriteCountBeforeFactoryDelete);

    const deleteResult = controller.deletePreset("user:user.ott.soft-smash");
    assert.equal(deleteResult.ok, true);
    assert.deepEqual(controller.getState().userPresets, []);
    assert.equal(controller.getState().activePreset, null);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).userPresets.ott, []);
    assert.deepEqual(parseStoredWrite(patchConnection.storedWrites.at(-1)).activePresetByEffect, {});
});

test("standalone import is effect scoped and invalid imports leave state untouched", async () => {
    const { patchConnection, create } = createPresetController();
    const controller = await create();

    controller.attach();
    patchConnection.storedWrites = [];

    const wrongEffectResult = controller.importPresetText(JSON.stringify(chorusUserPreset()));
    assert.equal(wrongEffectResult.ok, false);
    assert.match(wrongEffectResult.message, /chorus.*ott|ott.*chorus/i);

    const unknownEndpointResult = controller.importPresetText(JSON.stringify(ottUserPreset({
        presetID: "user.ott.bad-endpoint",
        values: {
            ottMix: 50,
            ottNotReal: 1,
        },
    })));
    assert.equal(unknownEndpointResult.ok, false);
    assert.match(unknownEndpointResult.message, /unknown.*ottNotReal/i);

    assert.deepEqual(patchConnection.storedWrites, []);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("standalone dirty tracking ignores apply writes and persists the first later edit", async () => {
    const { patchConnection, create } = createPresetController();
    const controller = await create();

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
    const { patchConnection, create } = createPresetController({
        patchConnection: new FakeStandalonePatchConnection({
            canPersistState: false,
            parameterValues: {
                ottMix: 55,
                ottAmount: 70,
                ottTimePercent: 125,
                ottBandDrive: 8,
                ottEnvelopeMatch: 44,
            },
        }),
    });
    const controller = await create();

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
    const { patchConnection, create } = createPresetController({
        patchConnection: new ThrowingStoredStatePatchConnection({
            parameterValues: {
                ottMix: 55,
                ottAmount: 70,
                ottTimePercent: 125,
                ottBandDrive: 8,
                ottEnvelopeMatch: 44,
            },
        }),
    });
    const controller = await create();

    controller.attach();
    patchConnection.events = [];

    const applyResult = controller.applyPreset("factory:ott.envelope-tamed");
    const saveResult = controller.saveCurrentAsNewPreset("Captured");
    const importResult = controller.importPresetText(JSON.stringify(ottUserPreset({
        presetID: "user.ott.imported-after-throw",
    })), { applyAfterImport: true });

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

test("standalone clipboard mutations export and import preset json", async () => {
    const clipboard = createClipboardHarness();
    const sourcePatchConnection = new FakeStandalonePatchConnection({
        storedState: {
            "effects.presets.v1": storedPresetState({
                userPresets: {
                    ott: [ottUserPreset()],
                },
            }),
        },
    });
    const sourceHarness = createPresetController({ patchConnection: sourcePatchConnection, clipboard });
    const sourceController = await sourceHarness.create();

    sourceController.attach();

    const copyResult = await sourceController.copyPresetToClipboard("user:user.ott.soft-smash");
    assert.equal(copyResult.ok, true);
    assert.deepEqual(JSON.parse(clipboard.text), ottUserPreset());

    const destinationPatchConnection = new FakeStandalonePatchConnection();
    const destinationHarness = createPresetController({ patchConnection: destinationPatchConnection, clipboard });
    const destinationController = await destinationHarness.create();

    destinationController.attach();
    destinationPatchConnection.storedWrites = [];

    const pasteResult = await destinationController.pastePresetFromClipboard({ applyAfterImport: true });

    assert.equal(pasteResult.ok, true);
    assert.deepEqual(pasteResult.value, ottUserPreset());
    assert.deepEqual(destinationPatchConnection.events, [
        { endpointID: "ottMix", value: 82 },
        { endpointID: "ottAmount", value: 91 },
        { endpointID: "ottTimePercent", value: 100 },
        { endpointID: "ottBandDrive", value: 14 },
        { endpointID: "ottEnvelopeMatch", value: 63 },
    ]);
    assert.deepEqual(parseStoredWrite(destinationPatchConnection.storedWrites.at(-1)).userPresets.ott, [ottUserPreset()]);
});
