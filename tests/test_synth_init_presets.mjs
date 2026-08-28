import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const {
    OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
    OSCILLATOR_DEFAULT_VOLUME_DB,
    OSCILLATOR_WAVETABLE_MAX_INDEX,
    OSCILLATOR_WAVETABLE_MIN_INDEX,
    OSCILLATOR_VOLUME_MAX_DB,
    OSCILLATOR_VOLUME_MIN_DB,
} = await loadUIModule(repoRoot, "ui/shared/oscillator-defaults.ts");

function parameter(endpointID, annotation = {}) {
    return {
        endpointID,
        purpose: "parameter",
        annotation,
    };
}

const synthStatus = {
    details: {
        inputs: [
            parameter("hostSlot0Guard", { hidden: true, init: 0, min: 0, max: 1 }),
            parameter("oscAWavetableSelect", {
                init: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
                min: OSCILLATOR_WAVETABLE_MIN_INDEX,
                max: OSCILLATOR_WAVETABLE_MAX_INDEX,
                integer: true,
            }),
            parameter("oscBWavetableSelect", {
                init: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
                min: OSCILLATOR_WAVETABLE_MIN_INDEX,
                max: OSCILLATOR_WAVETABLE_MAX_INDEX,
                integer: true,
            }),
            parameter("oscCWavetableSelect", {
                init: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
                min: OSCILLATOR_WAVETABLE_MIN_INDEX,
                max: OSCILLATOR_WAVETABLE_MAX_INDEX,
                integer: true,
            }),
            parameter("oscAFramePosition", { init: 0.25, min: 0, max: 1 }),
            parameter("oscAVolumeDb", {
                init: OSCILLATOR_DEFAULT_VOLUME_DB,
                min: OSCILLATOR_VOLUME_MIN_DB,
                max: OSCILLATOR_VOLUME_MAX_DB,
            }),
            parameter("oscBVolumeDb", {
                init: OSCILLATOR_DEFAULT_VOLUME_DB,
                min: OSCILLATOR_VOLUME_MIN_DB,
                max: OSCILLATOR_VOLUME_MAX_DB,
            }),
            parameter("oscCVolumeDb", {
                init: OSCILLATOR_DEFAULT_VOLUME_DB,
                min: OSCILLATOR_VOLUME_MIN_DB,
                max: OSCILLATOR_VOLUME_MAX_DB,
            }),
            parameter("oscAMute", { init: 0, min: 0, max: 1, discrete: true }),
            parameter("oscBMute", { init: 1, min: 0, max: 1, discrete: true }),
            parameter("oscCMute", { init: 1, min: 0, max: 1, discrete: true }),
            parameter("filterMix", { init: 1, min: 0, max: 1 }),
            parameter("voiceEnhancerFrequency", { init: 130, min: 20, max: 20_000 }),
            parameter("voiceEnhancerQ", { init: 0.71, min: 0.1, max: 10 }),
            parameter("voiceEnhancerAmount", { init: 0, min: 0, max: 1 }),
            parameter("voiceEnhancerKeyTrackEnabled", {
                init: 0,
                min: 0,
                max: 1,
                discrete: true,
                step: 1,
                text: "Off|On",
            }),
            parameter("voiceEnhancerKeyTrackOffsetSemitones", {
                init: 0,
                min: -12,
                max: 60,
                unit: "st",
            }),
            parameter("delayMix", { init: 0.5, min: 0, max: 1 }),
            parameter("reverbMix", { init: 0.5, min: 0, max: 1 }),
            parameter("globalTune", { init: 0, min: -24, max: 24 }),
            parameter("ampAttack", { init: 0.01, min: 0.001, max: 10 }),
            parameter("ampDecay", { init: 0.001, min: 0.001, max: 10 }),
            parameter("ampSustain", { init: 1, min: 0, max: 1 }),
            parameter("ampRelease", { init: 0.2, min: 0.005, max: 10 }),
        ],
    },
};

async function productionSynthStatus() {
    const source = await fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8");
    const graphStart = source.indexOf("graph WavetableSynth");
    const rackStructureStart = source.indexOf("    input rack.laneTopology;", graphStart);
    if (graphStart < 0 || rackStructureStart < 0) {
        throw new Error("Production synth parameter block is missing.");
    }
    const parameterText = source.slice(graphStart, rackStructureStart);
    const pattern = /^\s*input (?:(?:value\s+[^\s]+\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[([^\]]*)\]\])|(?:rack\.([A-Za-z_][A-Za-z0-9_]*)))\s*;/gm;
    const declarations = Array.from(parameterText.matchAll(pattern), ([, directID, annotationText, rackID]) => ({
        endpointID: directID ?? rackID,
        annotationText: annotationText ?? "",
    }));
    const endpointIDs = declarations.map(({ endpointID }) => endpointID);
    const annotationNumber = (annotationText, field, fallback) => {
        const match = annotationText.match(new RegExp(`(?:^|,)\\s*${field}:\\s*(-?[0-9]+(?:\\.[0-9]+)?)(?:f)?(?:\\s*,|$)`));
        return match ? Number(match[1]) : fallback;
    };

    return {
        endpointIDs,
        status: {
            details: {
                inputs: declarations.map(({ endpointID, annotationText }, index) => parameter(endpointID, {
                    hidden: /(?:^|,)\s*hidden:\s*true(?:\s*,|$)/.test(annotationText)
                        || endpointID === "hostSlot0Guard",
                    init: annotationNumber(annotationText, "init", index / 100),
                    min: annotationNumber(annotationText, "min", -1_000),
                    max: annotationNumber(annotationText, "max", 1_000),
                    step: annotationNumber(annotationText, "step", undefined),
                    discrete: /(?:^|,)\s*discrete:\s*true(?:\s*,|$)/.test(annotationText),
                })),
            },
        },
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function synthMutations(controller) {
    const mutations = controller.getSynthMutations();
    if (!mutations) throw new Error("Synth mutations are unavailable.");
    return mutations;
}

function createStoredDocumentAdapter(key, schemaVersion, initialValue) {
    let value = clone(initialValue);
    let deferNotifications = false;
    let pendingNotifications = 0;
    let failNextApply = false;
    const listeners = new Set();

    return {
        adapter: {
            key,
            schemaVersion,
            getContract() {
                return { key, schemaVersion, required: true };
            },
            capture() {
                return clone(value);
            },
            normalizeForPreset(nextValue) {
                return clone(nextValue);
            },
            serializeForPreset(nextValue) {
                return clone(nextValue);
            },
            apply(nextValue) {
                if (failNextApply) {
                    failNextApply = false;
                    throw new Error(`${key} apply failed`);
                }
                value = clone(nextValue);
                if (deferNotifications) {
                    pendingNotifications += 1;
                    return;
                }
                for (const listener of listeners) {
                    listener();
                }
            },
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        get value() {
            return clone(value);
        },
        setDeferredNotifications(deferred) {
            deferNotifications = deferred;
        },
        flushNotifications() {
            while (pendingNotifications > 0) {
                pendingNotifications -= 1;
                for (const listener of listeners) {
                    listener();
                }
            }
        },
        failNextApply() {
            failNextApply = true;
        },
    };
}

function createInitOnlyDocumentAdapter(key, initialValue, defaultValue) {
    let value = clone(initialValue);
    let failNextApply = false;
    let deferNotifications = false;
    let pendingNotifications = 0;
    const listeners = new Set();

    return {
        adapter: {
            key,
            capture() {
                return clone(value);
            },
            createDefaultValue() {
                return clone(defaultValue);
            },
            normalizeForTransaction(nextValue) {
                return clone(nextValue);
            },
            serializeForTransaction(nextValue) {
                return clone(nextValue);
            },
            apply(nextValue) {
                if (failNextApply) {
                    failNextApply = false;
                    throw new Error(`${key} apply failed`);
                }

                value = clone(nextValue);
                if (deferNotifications) {
                    pendingNotifications += 1;
                    return;
                }
                for (const listener of listeners) {
                    listener();
                }
            },
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        get value() {
            return clone(value);
        },
        get listenerCount() {
            return listeners.size;
        },
        setDeferredNotifications(deferred) {
            deferNotifications = deferred;
        },
        flushNotifications() {
            while (pendingNotifications > 0) {
                pendingNotifications -= 1;
                for (const listener of listeners) {
                    listener();
                }
            }
        },
        failNextApply() {
            failNextApply = true;
        },
    };
}

class FakeSynthPatchConnection {
    constructor(parameterValues, status = synthStatus) {
        this.parameterValues = { ...parameterValues };
        this.status = status;
        this.storedState = {};
        this.parameterListeners = new Map();
        this.storedStateListeners = new Set();
        this.statusListeners = new Set();
        this.events = [];
        this.failStoredStateWrites = false;
        this.deferParameterEchoes = false;
        this.pendingParameterEchoes = [];
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
        if (this.failStoredStateWrites) {
            throw new Error(`stored state write failed for ${key}`);
        }

        this.storedState[key] = value;
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
        if (Object.hasOwn(this.parameterValues, endpointID)) {
            this.emitParameterValue(endpointID, this.parameterValues[endpointID]);
        }
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        this.parameterValues[endpointID] = value;
        if (this.deferParameterEchoes) {
            this.pendingParameterEchoes.push({ endpointID, value });
            return;
        }
        this.emitParameterCallback(endpointID, value);
    }

    emitParameterValue(endpointID, value) {
        this.parameterValues[endpointID] = value;
        this.emitParameterCallback(endpointID, value);
    }

    emitParameterCallback(endpointID, value) {
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

async function createSynthFixture({
    includeFactoryPreset = false,
    synthEnabled = true,
    status = synthStatus,
    onSoundReplacementApplied,
} = {}) {
    const [presets, contractModule, modulation, articulations, rack] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/standalone-effect-presets.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
    ]);
    const defaultModulation = modulation.createDefaultModulationState();
    const defaultArticulations = articulations.createEmptyArticulationsState();
    const defaultRack = rack.createDefaultLaneState();
    const modulationHarness = createStoredDocumentAdapter("modulation.v6", 6, {
        ...defaultModulation,
        routes: [{ id: "route-before-init" }],
    });
    const articulationHarness = createStoredDocumentAdapter("articulations.v4", 4, {
        ...defaultArticulations,
        selectedSlotId: "art-before-init",
        slots: [{ id: "art-before-init" }],
    });
    const rackHarness = createInitOnlyDocumentAdapter("lane.v1", {
        ...defaultRack,
        order: [...defaultRack.order].reverse(),
        enabled: { ...defaultRack.enabled, delay: true, reverb: true },
    }, defaultRack);
    const currentContract = contractModule.buildPluginStateContract({
        effectID: "cosimo-synth",
        status,
        storedState: [modulationHarness.adapter, articulationHarness.adapter],
    });
    const defaults = Object.fromEntries(currentContract.parameters.map((entry) => [entry.endpointID, entry.defaultValue]));
    const factoryPresets = includeFactoryPreset ? {
        "cosimo-synth": [{
            kind: "cosimo.effectPreset",
            version: 2,
            effectID: "cosimo-synth",
            presetID: "factory.cosimo.bright",
            label: "Factory Bright",
            contract: currentContract,
            parameters: { ...defaults, oscAFramePosition: 0.61, delayMix: 0.42 },
            storedState: {
                "modulation.v6": defaultModulation,
                "articulations.v4": defaultArticulations,
            },
        }],
    } : {};
    const initialValues = { ...defaults };
    const representativeEdits = {
        oscAWavetableSelect: 17,
        oscBWavetableSelect: 81,
        oscCWavetableSelect: 203,
        oscAFramePosition: 0.75,
        filterMix: 0.4,
        delayMix: 0.6,
        reverbMix: 0.8,
        globalTune: 7.25,
        ampAttack: 0.37,
        ampDecay: 0.81,
        ampSustain: 0.46,
        ampRelease: 1.72,
    };
    for (const [endpointID, value] of Object.entries(representativeEdits)) {
        if (Object.hasOwn(initialValues, endpointID)) {
            initialValues[endpointID] = value;
        }
    }
    const patchConnection = new FakeSynthPatchConnection(initialValues, status);
    const controllerOptions = {
        effectID: "cosimo-synth",
        patchConnection,
        factoryPresets,
        storedStateAdapters: [modulationHarness.adapter, articulationHarness.adapter],
        createPresetID: ({ label, attempt }) => `user.cosimo.${label.toLowerCase().replaceAll(" ", "-")}-${attempt}`,
        onSoundReplacementApplied,
    };
    if (synthEnabled) {
        controllerOptions.synth = {
            createCanonicalStoredState() {
                return {
                    "modulation.v6": defaultModulation,
                    "articulations.v4": defaultArticulations,
                };
            },
            initOnlyStateAdapters: [rackHarness.adapter],
        };
    }
    const controller = new presets.StandaloneEffectPresetController(controllerOptions);

    controller.attach();
    return {
        articulationHarness,
        controller,
        currentContract,
        defaultArticulations,
        defaultModulation,
        defaultRack,
        defaults,
        modulationHarness,
        patchConnection,
        rackHarness,
    };
}

test("successful Init and preset loading announce the completed sound replacement", async () => {
    const applied = [];
    const fixture = await createSynthFixture({
        includeFactoryPreset: true,
        onSoundReplacementApplied: (replacement) => applied.push(replacement),
    });

    assert.equal(synthMutations(fixture.controller).initSound().ok, true);
    assert.deepEqual(applied, [{ kind: "init" }]);

    assert.equal(
        fixture.controller.getMutations().applyPreset("factory:factory.cosimo.bright").ok,
        true,
    );
    assert.deepEqual(applied, [
        { kind: "init" },
        { kind: "preset", presetKey: "factory:factory.cosimo.bright" },
    ]);

    assert.equal(fixture.controller.getMutations().reapplyActivePreset().ok, true);
    assert.deepEqual(applied, [
        { kind: "init" },
        { kind: "preset", presetKey: "factory:factory.cosimo.bright" },
        { kind: "preset", presetKey: "factory.cosimo.bright" },
    ]);
});

test("the synth controller owns the Init-only adapter subscription lifecycle", async () => {
    const { controller, rackHarness } = await createSynthFixture();

    assert.equal(rackHarness.listenerCount, 1);
    controller.detach();
    assert.equal(rackHarness.listenerCount, 0);
});

test("clean synth Init applies every canonical sound default and clears only the working identity", async () => {
    const {
        articulationHarness,
        controller,
        defaultArticulations,
        defaultModulation,
        defaultRack,
        defaults,
        modulationHarness,
        patchConnection,
        rackHarness,
    } = await createSynthFixture();
    const preservedNonSoundState = {
        "library.imported-wavetables": "asset-library-bytes",
        "presentation.workspace": "voice:scroll=317",
        "presentation.keyboard": "hidden",
        "preference.auto-preview": "off",
        "audition.remembered-notes": "48,55,60",
    };
    Object.assign(patchConnection.storedState, preservedNonSoundState);
    const saveResult = controller.getMutations().saveCurrentAsNewPreset("Before Init");
    assert.equal(saveResult.ok, true, saveResult.message);
    const savedBytes = JSON.stringify(saveResult.value);

    const initResult = synthMutations(controller).initSound();
    assert.equal(initResult.ok, true, initResult.message);

    const state = controller.getState();
    assert.equal(state.supportsInit, true);
    assert.equal(state.activePreset, null);
    assert.equal(state.activePresetID, null);
    assert.equal(state.activeLabel, "INIT");
    assert.equal(state.dirty, false);
    assert.deepEqual(patchConnection.parameterValues, defaults);
    assert.equal(patchConnection.parameterValues.globalTune, 0);
    assert.deepEqual(
        Object.fromEntries(["ampAttack", "ampDecay", "ampSustain", "ampRelease"]
            .map((endpointID) => [endpointID, patchConnection.parameterValues[endpointID]])),
        { ampAttack: 0.01, ampDecay: 0.001, ampSustain: 1, ampRelease: 0.2 },
    );
    assert.deepEqual(modulationHarness.value, defaultModulation);
    assert.deepEqual(articulationHarness.value, defaultArticulations);
    assert.deepEqual(rackHarness.value, defaultRack);
    assert.equal(JSON.stringify(state.userPresets[0].preset), savedBytes);
    assert.equal(state.presets.some((preset) => preset.label === "INIT"), false);
    assert.deepEqual(
        Object.fromEntries(Object.keys(preservedNonSoundState).map((key) => [key, patchConnection.storedState[key]])),
        preservedNonSoundState,
    );

    patchConnection.emitParameterValue("oscAFramePosition", 0.9);
    const editedState = controller.getState();
    assert.equal(editedState.activePreset, null);
    assert.equal(editedState.activeLabel, "INIT");
    assert.equal(editedState.dirty, true);
    assert.equal(editedState.userPresets[0].dirty, false);
    assert.equal(JSON.stringify(editedState.userPresets[0].preset), savedBytes);

    const soundBeforeCancel = JSON.stringify({
        parameters: patchConnection.parameterValues,
        modulation: modulationHarness.value,
        articulations: articulationHarness.value,
        rack: rackHarness.value,
    });
    const guardedInitResult = synthMutations(controller).initSound();
    assert.equal(guardedInitResult.ok, false);
    assert.equal(guardedInitResult.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(controller.getState().pendingSoundReplacement, { kind: "init" });
    assert.equal(JSON.stringify({
        parameters: patchConnection.parameterValues,
        modulation: modulationHarness.value,
        articulations: articulationHarness.value,
        rack: rackHarness.value,
    }), soundBeforeCancel);
    assert.equal(controller.getState().dirty, true);

    const cancelResult = synthMutations(controller).cancelSoundReplacement();
    assert.equal(cancelResult.ok, true, cancelResult.message);
    assert.equal(controller.getState().pendingSoundReplacement, null);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().dirty, true);
    assert.equal(JSON.stringify({
        parameters: patchConnection.parameterValues,
        modulation: modulationHarness.value,
        articulations: articulationHarness.value,
        rack: rackHarness.value,
    }), soundBeforeCancel);

    const revertResult = controller.getMutations().reapplyActivePreset();
    assert.equal(revertResult.ok, true, revertResult.message);
    assert.equal(patchConnection.parameterValues.oscAFramePosition, defaults.oscAFramePosition);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().activeLabel, "INIT");
    assert.equal(controller.getState().dirty, false);
});

test("Init selects Core Shapes for A/B/C while a saved sound restores its explicit tables", async () => {
    const fixture = await createSynthFixture();
    const explicitSelections = {
        oscAWavetableSelect: 17,
        oscBWavetableSelect: 81,
        oscCWavetableSelect: 203,
    };

    assert.deepEqual(
        Object.fromEntries(Object.keys(explicitSelections).map((endpointID) => [
            endpointID,
            fixture.patchConnection.parameterValues[endpointID],
        ])),
        explicitSelections,
    );
    const saved = fixture.controller.getMutations().saveCurrentAsNewPreset("Explicit Tables");
    assert.equal(saved.ok, true, saved.message);

    const initialized = synthMutations(fixture.controller).initSound();
    assert.equal(initialized.ok, true, initialized.message);
    assert.deepEqual(
        Object.fromEntries(Object.keys(explicitSelections).map((endpointID) => [
            endpointID,
            fixture.patchConnection.parameterValues[endpointID],
        ])),
        {
            oscAWavetableSelect: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
            oscBWavetableSelect: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
            oscCWavetableSelect: OSCILLATOR_DEFAULT_WAVETABLE_INDEX,
        },
    );

    const restored = fixture.controller.getMutations().applyPreset(`user:${saved.value.presetID}`);
    assert.equal(restored.ok, true, restored.message);
    assert.deepEqual(
        Object.fromEntries(Object.keys(explicitSelections).map((endpointID) => [
            endpointID,
            fixture.patchConnection.parameterValues[endpointID],
        ])),
        explicitSelections,
    );
});

test("Init writes the default for every current production public parameter, including all selectors and FX", async () => {
    const production = await productionSynthStatus();
    const fixture = await createSynthFixture({ status: production.status });
    const publicEndpointIDs = production.endpointIDs.filter((endpointID) => endpointID !== "hostSlot0Guard");

    assert.equal(fixture.currentContract.parameters.length, publicEndpointIDs.length);
    assert.deepEqual(
        fixture.currentContract.parameters.map((entry) => entry.endpointID).sort(),
        [...publicEndpointIDs].sort(),
    );
    for (const requiredEndpointID of [
        "oscAWavetableSelect",
        "oscBWavetableSelect",
        "oscCWavetableSelect",
        "filterMix",
        "voiceEnhancerFrequency",
        "voiceEnhancerQ",
        "voiceEnhancerAmount",
        "voiceEnhancerKeyTrackEnabled",
        "voiceEnhancerKeyTrackOffsetSemitones",
        "globalTune",
        "ampAttack",
        "ampDecay",
        "ampSustain",
        "ampRelease",
    ]) {
        assert.equal(publicEndpointIDs.includes(requiredEndpointID), true, requiredEndpointID);
    }

    // Effect parameters left the host surface with the B3 parameter cut:
    // every device value rides the lane.v1 document and its record uploads.
    for (const removedEndpointID of [
        "distortionWet",
        "chorusMix",
        "ottMix",
        "globalFilterMode",
        "flangerMix",
        "phaserMix",
        "delayMix",
        "reverbMix",
    ]) {
        assert.equal(publicEndpointIDs.includes(removedEndpointID), false, removedEndpointID);
    }

    const initResult = synthMutations(fixture.controller).initSound();
    assert.equal(initResult.ok, true, initResult.message);
    assert.deepEqual(fixture.patchConnection.parameterValues, fixture.defaults);
    assert.deepEqual(
        Object.fromEntries([
            "voiceEnhancerFrequency",
            "voiceEnhancerQ",
            "voiceEnhancerAmount",
            "voiceEnhancerKeyTrackEnabled",
            "voiceEnhancerKeyTrackOffsetSemitones",
        ].map((endpointID) => [endpointID, fixture.patchConnection.parameterValues[endpointID]])),
        {
            voiceEnhancerFrequency: 130,
            voiceEnhancerQ: 0.71,
            voiceEnhancerAmount: 0,
            voiceEnhancerKeyTrackEnabled: 0,
            voiceEnhancerKeyTrackOffsetSemitones: 0,
        },
    );
    assert.deepEqual(
        Object.fromEntries([
            "oscAVolumeDb", "oscBVolumeDb", "oscCVolumeDb",
            "oscAMute", "oscBMute", "oscCMute",
        ].map((endpointID) => [endpointID, fixture.patchConnection.parameterValues[endpointID]])),
        {
            oscAVolumeDb: 0,
            oscBVolumeDb: 0,
            oscCVolumeDb: 0,
            oscAMute: 0,
            oscBMute: 1,
            oscCMute: 1,
        },
    );
    assert.equal(fixture.controller.getState().dirty, false);
});

test("structured and rack edits dirty unnamed INIT and Revert restores every canonical document", async () => {
    const fixture = await createSynthFixture();
    assert.equal(synthMutations(fixture.controller).initSound().ok, true);

    fixture.modulationHarness.adapter.apply({
        ...fixture.defaultModulation,
        routes: [{ id: "post-init-route" }],
    });
    fixture.articulationHarness.adapter.apply({
        ...fixture.defaultArticulations,
        selectedSlotId: "post-init-articulation",
        slots: [{ id: "post-init-articulation" }],
    });
    fixture.rackHarness.adapter.apply({
        ...fixture.defaultRack,
        enabled: { ...fixture.defaultRack.enabled, chorus: true },
    });
    assert.equal(fixture.controller.getState().activePreset, null);
    assert.equal(fixture.controller.getState().activeLabel, "INIT");
    assert.equal(fixture.controller.getState().dirty, true);

    const revertResult = fixture.controller.getMutations().reapplyActivePreset();
    assert.equal(revertResult.ok, true, revertResult.message);
    assert.deepEqual(fixture.modulationHarness.value, fixture.defaultModulation);
    assert.deepEqual(fixture.articulationHarness.value, fixture.defaultArticulations);
    assert.deepEqual(fixture.rackHarness.value, fixture.defaultRack);
    assert.equal(fixture.controller.getState().activePreset, null);
    assert.equal(fixture.controller.getState().activeLabel, "INIT");
    assert.equal(fixture.controller.getState().dirty, false);
});

test("Discard and Init replaces a dirty unnamed sound without saving it", async () => {
    const appliedSoundReplacements = [];
    const {
        controller,
        defaultArticulations,
        defaultModulation,
        defaultRack,
        defaults,
        articulationHarness,
        modulationHarness,
        patchConnection,
        rackHarness,
    } = await createSynthFixture({
        onSoundReplacementApplied: (replacement) => appliedSoundReplacements.push(replacement),
    });

    const cleanInit = synthMutations(controller).initSound();
    assert.equal(cleanInit.ok, true, cleanInit.message);
    assert.deepEqual(appliedSoundReplacements, [{ kind: "init" }]);
    patchConnection.emitParameterValue("oscAFramePosition", 0.91);
    assert.equal(controller.getState().dirty, true);

    const guardedInit = synthMutations(controller).initSound();
    assert.equal(guardedInit.ok, false);
    assert.equal(guardedInit.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(appliedSoundReplacements, [{ kind: "init" }]);

    const discardResult = synthMutations(controller).discardAndContinueSoundReplacement();
    assert.equal(discardResult.ok, true, discardResult.message);
    assert.deepEqual(appliedSoundReplacements, [{ kind: "init" }, { kind: "init" }]);
    assert.deepEqual(patchConnection.parameterValues, defaults);
    assert.deepEqual(modulationHarness.value, defaultModulation);
    assert.deepEqual(articulationHarness.value, defaultArticulations);
    assert.deepEqual(rackHarness.value, defaultRack);
    assert.equal(controller.getState().pendingSoundReplacement, null);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().activeLabel, "INIT");
    assert.equal(controller.getState().dirty, false);
    assert.deepEqual(controller.getState().userPresets, []);
});

test("Bounce uses the synth dirty guard and runs only the confirmed press-time continuation", async () => {
    const { controller, patchConnection } = await createSynthFixture();
    assert.equal(synthMutations(controller).initSound().ok, true);
    patchConnection.emitParameterValue("oscAFramePosition", 0.91);
    assert.equal(controller.getState().dirty, true);

    const calls = [];
    const guarded = synthMutations(controller).bounceSound(() => calls.push("first"));
    assert.equal(guarded.ok, false);
    assert.equal(guarded.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(controller.getState().pendingSoundReplacement, { kind: "bounce" });
    assert.deepEqual(calls, []);

    assert.equal(synthMutations(controller).cancelSoundReplacement().ok, true);
    assert.deepEqual(calls, []);

    const second = synthMutations(controller).bounceSound(() => calls.push("second"));
    assert.equal(second.ok, false);
    assert.deepEqual(controller.getState().pendingSoundReplacement, { kind: "bounce" });
    const discarded = synthMutations(controller).discardAndContinueSoundReplacement();
    assert.equal(discarded.ok, true, discarded.message);
    assert.deepEqual(calls, ["second"]);
    assert.equal(controller.getState().pendingSoundReplacement, null);
});

test("Save and Init overwrites a writable user preset before initializing", async () => {
    const { controller, defaults, patchConnection } = await createSynthFixture();
    const saveResult = controller.getMutations().saveCurrentAsNewPreset("Writable Sound");
    assert.equal(saveResult.ok, true, saveResult.message);

    patchConnection.emitParameterValue("oscAFramePosition", 0.93);
    assert.equal(controller.getState().dirty, true);
    const guardedInit = synthMutations(controller).initSound();
    assert.equal(guardedInit.ok, false);
    assert.equal(guardedInit.actionRequired, "confirm-sound-replacement");

    const saveAndInit = synthMutations(controller).saveAndContinueSoundReplacement();
    assert.equal(saveAndInit.ok, true, saveAndInit.message);
    const savedPreset = controller.getState().userPresets.find((item) => item.label === "Writable Sound");
    assert.equal(savedPreset.preset.parameters.oscAFramePosition, 0.93);
    const savedBytesAfterOverwrite = JSON.stringify(savedPreset.preset);

    assert.deepEqual(patchConnection.parameterValues, defaults);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().activeLabel, "INIT");
    assert.equal(controller.getState().dirty, false);
    assert.equal(
        JSON.stringify(controller.getState().userPresets.find((item) => item.label === "Writable Sound").preset),
        savedBytesAfterOverwrite,
    );
});

test("Save and Init routes factory sounds through Save As and cancellation changes nothing", async () => {
    const { controller, defaults, patchConnection } = await createSynthFixture({ includeFactoryPreset: true });
    const factoryApply = controller.getMutations().applyPreset("factory:factory.cosimo.bright");
    assert.equal(factoryApply.ok, true, factoryApply.message);
    patchConnection.emitParameterValue("oscAFramePosition", 0.94);
    assert.equal(controller.getState().activePresetID, "factory.cosimo.bright");
    assert.equal(controller.getState().dirty, true);

    const soundBeforeCancel = JSON.stringify(patchConnection.parameterValues);
    const guardedInit = synthMutations(controller).initSound();
    assert.equal(guardedInit.ok, false);
    const saveChoice = synthMutations(controller).saveAndContinueSoundReplacement();
    assert.equal(saveChoice.ok, false);
    assert.equal(saveChoice.actionRequired, "save-as-for-sound-replacement");

    const cancelResult = synthMutations(controller).cancelSoundReplacement();
    assert.equal(cancelResult.ok, true, cancelResult.message);
    assert.equal(JSON.stringify(patchConnection.parameterValues), soundBeforeCancel);
    assert.equal(controller.getState().activePresetID, "factory.cosimo.bright");
    assert.equal(controller.getState().dirty, true);
    assert.deepEqual(controller.getState().userPresets, []);

    assert.equal(synthMutations(controller).initSound().ok, false);
    assert.equal(synthMutations(controller).saveAndContinueSoundReplacement().actionRequired, "save-as-for-sound-replacement");
    const saveAsAndInit = synthMutations(controller).saveCurrentAsNewPresetAndContinueSoundReplacement("Factory Rescue");
    assert.equal(saveAsAndInit.ok, true, saveAsAndInit.message);
    const rescuedPreset = controller.getState().userPresets.find((item) => item.label === "Factory Rescue");
    assert.equal(rescuedPreset.preset.parameters.oscAFramePosition, 0.94);
    assert.deepEqual(patchConnection.parameterValues, defaults);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().dirty, false);
});

test("writable, factory, and unnamed identities each support the remaining Cancel, Discard, and Save paths", async () => {
    const writableCancel = await createSynthFixture();
    const writableCancelSave = writableCancel.controller.getMutations().saveCurrentAsNewPreset("Cancel Writable");
    assert.equal(writableCancelSave.ok, true, writableCancelSave.message);
    writableCancel.patchConnection.emitParameterValue("oscAFramePosition", 0.71);
    const writableCancelBytes = JSON.stringify(writableCancel.patchConnection.parameterValues);
    assert.equal(synthMutations(writableCancel.controller).initSound().ok, false);
    assert.equal(synthMutations(writableCancel.controller).cancelSoundReplacement().ok, true);
    assert.equal(JSON.stringify(writableCancel.patchConnection.parameterValues), writableCancelBytes);
    assert.equal(writableCancel.controller.getState().activePresetID, writableCancelSave.value.presetID);
    assert.equal(writableCancel.controller.getState().dirty, true);

    const writableDiscard = await createSynthFixture();
    const writableDiscardSave = writableDiscard.controller.getMutations().saveCurrentAsNewPreset("Discard Writable");
    assert.equal(writableDiscardSave.ok, true, writableDiscardSave.message);
    const writableStoredBytes = JSON.stringify(writableDiscardSave.value);
    writableDiscard.patchConnection.emitParameterValue("oscAFramePosition", 0.72);
    assert.equal(synthMutations(writableDiscard.controller).initSound().ok, false);
    assert.equal(synthMutations(writableDiscard.controller).discardAndContinueSoundReplacement().ok, true);
    assert.deepEqual(writableDiscard.patchConnection.parameterValues, writableDiscard.defaults);
    assert.equal(JSON.stringify(writableDiscard.controller.getState().userPresets[0].preset), writableStoredBytes);

    const factoryDiscard = await createSynthFixture({ includeFactoryPreset: true });
    const factoryBytes = JSON.stringify(factoryDiscard.controller.getState().factoryPresets[0].preset);
    assert.equal(factoryDiscard.controller.getMutations().applyPreset("factory:factory.cosimo.bright").ok, true);
    factoryDiscard.patchConnection.emitParameterValue("oscAFramePosition", 0.73);
    assert.equal(synthMutations(factoryDiscard.controller).initSound().ok, false);
    assert.equal(synthMutations(factoryDiscard.controller).discardAndContinueSoundReplacement().ok, true);
    assert.deepEqual(factoryDiscard.patchConnection.parameterValues, factoryDiscard.defaults);
    assert.equal(JSON.stringify(factoryDiscard.controller.getState().factoryPresets[0].preset), factoryBytes);

    const unnamedSave = await createSynthFixture();
    assert.equal(synthMutations(unnamedSave.controller).initSound().ok, true);
    unnamedSave.patchConnection.emitParameterValue("oscAFramePosition", 0.74);
    assert.equal(synthMutations(unnamedSave.controller).initSound().ok, false);
    assert.equal(
        synthMutations(unnamedSave.controller).saveAndContinueSoundReplacement().actionRequired,
        "save-as-for-sound-replacement",
    );
    const unnamedSaveAndInit = synthMutations(unnamedSave.controller)
        .saveCurrentAsNewPresetAndContinueSoundReplacement("Saved INIT");
    assert.equal(unnamedSaveAndInit.ok, true, unnamedSaveAndInit.message);
    const savedInit = unnamedSave.controller.getState().userPresets.find((item) => item.label === "Saved INIT");
    assert.equal(savedInit.preset.parameters.oscAFramePosition, 0.74);
    assert.deepEqual(unnamedSave.patchConnection.parameterValues, unnamedSave.defaults);
    assert.equal(unnamedSave.controller.getState().activePreset, null);
    assert.equal(unnamedSave.controller.getState().dirty, false);
});

test("a failed Save As from dirty INIT performs no Init and preserves identity and sound", async () => {
    const { controller, patchConnection } = await createSynthFixture();
    assert.equal(synthMutations(controller).initSound().ok, true);
    patchConnection.emitParameterValue("oscAFramePosition", 0.92);
    assert.equal(controller.getState().dirty, true);

    assert.equal(synthMutations(controller).initSound().ok, false);
    const saveChoice = synthMutations(controller).saveAndContinueSoundReplacement();
    assert.equal(saveChoice.ok, false);
    assert.equal(saveChoice.actionRequired, "save-as-for-sound-replacement");
    const soundBeforeFailure = JSON.stringify(patchConnection.parameterValues);

    patchConnection.failStoredStateWrites = true;
    const failedSave = synthMutations(controller).saveCurrentAsNewPresetAndContinueSoundReplacement("Should Fail");
    assert.equal(failedSave.ok, false);
    assert.match(failedSave.message, /stored state write failed/i);
    assert.equal(JSON.stringify(patchConnection.parameterValues), soundBeforeFailure);
    assert.equal(controller.getState().activePreset, null);
    assert.equal(controller.getState().activeLabel, "INIT");
    assert.equal(controller.getState().dirty, true);
    assert.deepEqual(controller.getState().userPresets, []);
    assert.deepEqual(controller.getState().pendingSoundReplacement, { kind: "init" });
});

test("the synth guard is the one choke point for preset selection and importing while standalone stays unguarded", async () => {
    const synth = await createSynthFixture({ includeFactoryPreset: true });
    const firstSave = synth.controller.getMutations().saveCurrentAsNewPreset("Guarded User");
    assert.equal(firstSave.ok, true, firstSave.message);
    synth.patchConnection.emitParameterValue("oscAFramePosition", 0.96);

    const guardedFactory = synth.controller.getMutations().applyPreset("factory:factory.cosimo.bright");
    assert.equal(guardedFactory.ok, false);
    assert.equal(guardedFactory.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(synth.controller.getState().pendingSoundReplacement, {
        kind: "preset",
        presetKey: "factory:factory.cosimo.bright",
    });
    assert.equal(synth.patchConnection.parameterValues.oscAFramePosition, 0.96);

    const factoryApply = synthMutations(synth.controller).discardAndContinueSoundReplacement();
    assert.equal(factoryApply.ok, true, factoryApply.message);
    assert.equal(synth.controller.getState().activePresetID, "factory.cosimo.bright");
    assert.equal(synth.controller.getState().dirty, false);

    synth.patchConnection.emitParameterValue("oscAFramePosition", 0.97);
    const importPreset = {
        ...synth.controller.getState().factoryPresets[0].preset,
        presetID: "user.cosimo.imported",
        label: "Imported Sound",
        parameters: {
            ...synth.controller.getState().factoryPresets[0].preset.parameters,
            oscAFramePosition: 0.33,
        },
    };
    const guardedImport = synth.controller.getMutations().importPresetText(JSON.stringify(importPreset), {
        applyAfterImport: true,
    });
    assert.equal(guardedImport.ok, false);
    assert.equal(guardedImport.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(synth.controller.getState().pendingSoundReplacement, {
        kind: "import",
        presetID: "user.cosimo.imported",
    });
    assert.equal(synth.controller.getState().userPresets.some((item) => item.presetID === "user.cosimo.imported"), false);

    const importApply = synthMutations(synth.controller).discardAndContinueSoundReplacement();
    assert.equal(importApply.ok, true, importApply.message);
    assert.equal(synth.controller.getState().activePresetID, "user.cosimo.imported");
    assert.equal(synth.patchConnection.parameterValues.oscAFramePosition, 0.33);
    assert.equal(synth.controller.getState().dirty, false);

    const standalone = await createSynthFixture({ includeFactoryPreset: true, synthEnabled: false });
    assert.equal(standalone.controller.getMutations().saveCurrentAsNewPreset("Standalone User").ok, true);
    standalone.patchConnection.emitParameterValue("oscAFramePosition", 0.98);
    assert.equal(standalone.controller.getState().dirty, true);
    const unguardedApply = standalone.controller.getMutations().applyPreset("factory:factory.cosimo.bright");
    assert.equal(unguardedApply.ok, true, unguardedApply.message);
    assert.equal(standalone.controller.getState().pendingSoundReplacement, null);
    assert.equal(standalone.controller.getState().activePresetID, "factory.cosimo.bright");
});

test("a late rack-domain Init failure rolls back the complete dirty sound and never exposes INIT", async () => {
    const fixture = await createSynthFixture();
    const saveResult = fixture.controller.getMutations().saveCurrentAsNewPreset("Rollback Source");
    assert.equal(saveResult.ok, true, saveResult.message);
    fixture.patchConnection.emitParameterValue("oscAFramePosition", 0.99);
    fixture.modulationHarness.adapter.apply({
        ...fixture.defaultModulation,
        routes: [{ id: "dirty-route" }],
    });
    const before = JSON.stringify({
        parameters: fixture.patchConnection.parameterValues,
        modulation: fixture.modulationHarness.value,
        articulations: fixture.articulationHarness.value,
        rack: fixture.rackHarness.value,
    });
    const observedLabels = [];
    const unsubscribe = fixture.controller.subscribe((state) => {
        observedLabels.push(state.activeLabel);
    });

    assert.equal(synthMutations(fixture.controller).initSound().ok, false);
    fixture.rackHarness.failNextApply();
    const failedInit = synthMutations(fixture.controller).discardAndContinueSoundReplacement();
    unsubscribe();

    assert.equal(failedInit.ok, false);
    assert.match(failedInit.message, /lane\.v1 apply failed/i);
    assert.equal(JSON.stringify({
        parameters: fixture.patchConnection.parameterValues,
        modulation: fixture.modulationHarness.value,
        articulations: fixture.articulationHarness.value,
        rack: fixture.rackHarness.value,
    }), before);
    assert.equal(fixture.controller.getState().activePresetID, saveResult.value.presetID);
    assert.equal(fixture.controller.getState().activeLabel, "Rollback Source");
    assert.equal(fixture.controller.getState().dirty, true);
    assert.equal(observedLabels.includes("INIT"), false);
});

test("an ordinary synth preset apply failure rolls back sound and identity before exposing the target label", async () => {
    const fixture = await createSynthFixture({ includeFactoryPreset: true });
    const sourceSave = fixture.controller.getMutations().saveCurrentAsNewPreset("Ordinary Rollback Source");
    assert.equal(sourceSave.ok, true, sourceSave.message);
    const before = JSON.stringify({
        parameters: fixture.patchConnection.parameterValues,
        modulation: fixture.modulationHarness.value,
        articulations: fixture.articulationHarness.value,
        rack: fixture.rackHarness.value,
    });
    const observedLabels = [];
    const unsubscribe = fixture.controller.subscribe((state) => observedLabels.push(state.activeLabel));
    fixture.articulationHarness.failNextApply();

    const failedApply = fixture.controller.getMutations().applyPreset("factory:factory.cosimo.bright");
    unsubscribe();

    assert.equal(failedApply.ok, false);
    assert.match(failedApply.message, /articulations\.v4 apply failed/i);
    assert.equal(JSON.stringify({
        parameters: fixture.patchConnection.parameterValues,
        modulation: fixture.modulationHarness.value,
        articulations: fixture.articulationHarness.value,
        rack: fixture.rackHarness.value,
    }), before);
    assert.equal(fixture.controller.getState().activePresetID, sourceSave.value.presetID);
    assert.equal(fixture.controller.getState().activeLabel, "Ordinary Rollback Source");
    assert.equal(fixture.controller.getState().dirty, false);
    assert.equal(observedLabels.includes("Factory Bright"), false);
});

test("delayed out-of-order load echoes stay clean while a real edit after Init wins and dirties", async () => {
    const fixture = await createSynthFixture();
    const firstSave = fixture.controller.getMutations().saveCurrentAsNewPreset("Echo A");
    assert.equal(firstSave.ok, true, firstSave.message);
    fixture.patchConnection.emitParameterValue("oscAFramePosition", 0.31);
    fixture.modulationHarness.adapter.apply({
        ...fixture.defaultModulation,
        routes: [{ id: "echo-b-route" }],
    });
    const secondSave = fixture.controller.getMutations().saveCurrentAsNewPreset("Echo B");
    assert.equal(secondSave.ok, true, secondSave.message);

    fixture.patchConnection.deferParameterEchoes = true;
    fixture.modulationHarness.setDeferredNotifications(true);
    fixture.articulationHarness.setDeferredNotifications(true);
    fixture.rackHarness.setDeferredNotifications(true);

    const applyA = fixture.controller.getMutations().applyPreset(`user:${firstSave.value.presetID}`);
    assert.equal(applyA.ok, true, applyA.message);
    const applyB = fixture.controller.getMutations().applyPreset(`user:${secondSave.value.presetID}`);
    assert.equal(applyB.ok, true, applyB.message);
    assert.equal(fixture.controller.getState().activePresetID, secondSave.value.presetID);
    assert.equal(fixture.controller.getState().dirty, false);

    const ordinaryEchoes = fixture.patchConnection.pendingParameterEchoes.splice(0).reverse();
    for (const echo of ordinaryEchoes) {
        fixture.patchConnection.emitParameterCallback(echo.endpointID, echo.value);
    }
    fixture.modulationHarness.flushNotifications();
    fixture.articulationHarness.flushNotifications();
    assert.equal(fixture.controller.getState().dirty, false);
    assert.equal(fixture.controller.getState().currentValues.oscAFramePosition, 0.31);

    const initResult = synthMutations(fixture.controller).initSound();
    assert.equal(initResult.ok, true, initResult.message);
    assert.equal(fixture.controller.getState().dirty, false);
    fixture.patchConnection.emitParameterValue("oscAFramePosition", 0.88);
    assert.equal(fixture.controller.getState().dirty, true);

    const initEchoes = fixture.patchConnection.pendingParameterEchoes.splice(0).reverse();
    for (const echo of initEchoes) {
        fixture.patchConnection.emitParameterCallback(echo.endpointID, echo.value);
    }
    fixture.modulationHarness.flushNotifications();
    fixture.articulationHarness.flushNotifications();
    fixture.rackHarness.flushNotifications();
    assert.equal(fixture.controller.getState().dirty, true);
    assert.equal(fixture.controller.getState().currentValues.oscAFramePosition, 0.88);
    assert.equal(fixture.patchConnection.parameterValues.oscAFramePosition, 0.88);
});

test("a stored-document edit with no active preset never raises an error (fresh boot and post-Init)", async () => {
    const fixture = await createSynthFixture();

    // Fresh boot: no active preset has ever been set. Editing the modulation
    // document (any route drag on the phone) must not surface an error.
    fixture.modulationHarness.adapter.apply({
        ...fixture.defaultModulation,
        routes: [{ id: "fresh-boot-edit" }],
    });
    let state = fixture.controller.getState();
    assert.equal(state.lastError, null, `Fresh-boot structured edit raised: ${state.lastError}`);

    // Post-Init (identity cleared to null): same contract, and the edit must
    // dirty the unnamed INIT sound.
    const initResult = synthMutations(fixture.controller).initSound();
    assert.equal(initResult.ok, true);
    fixture.modulationHarness.adapter.apply({
        ...fixture.defaultModulation,
        routes: [{ id: "post-init-edit" }],
    });
    state = fixture.controller.getState();
    assert.equal(state.lastError, null, `Post-Init structured edit raised: ${state.lastError}`);
    assert.equal(state.dirty, true, "A structured edit after Init must dirty the unnamed INIT sound.");
});

test("a shared sound captures and restores parameters, modulation, articulation, and lane state exactly", async () => {
    const source = await createSynthFixture();
    source.patchConnection.emitParameterValue("oscAFramePosition", 0.37);
    source.patchConnection.emitParameterValue("filterMix", 0.28);
    source.patchConnection.emitParameterValue("voiceEnhancerFrequency", 2_400);
    source.patchConnection.emitParameterValue("voiceEnhancerQ", 4.2);
    source.patchConnection.emitParameterValue("voiceEnhancerAmount", 0.63);
    source.patchConnection.emitParameterValue("voiceEnhancerKeyTrackEnabled", 1);
    source.patchConnection.emitParameterValue("voiceEnhancerKeyTrackOffsetSemitones", 19.37);
    source.patchConnection.emitParameterValue("globalTune", 12.37);
    source.patchConnection.emitParameterValue("ampAttack", 0.43);
    source.patchConnection.emitParameterValue("ampDecay", 0.67);
    source.patchConnection.emitParameterValue("ampSustain", 0.38);
    source.patchConnection.emitParameterValue("ampRelease", 2.4);
    source.patchConnection.emitParameterValue("oscAVolumeDb", -3.25);
    source.patchConnection.emitParameterValue("oscBVolumeDb", -12.5);
    source.patchConnection.emitParameterValue("oscCVolumeDb", 2.75);
    source.patchConnection.emitParameterValue("oscAMute", 1);
    source.patchConnection.emitParameterValue("oscBMute", 0);
    source.patchConnection.emitParameterValue("oscCMute", 0);
    source.modulationHarness.adapter.apply({
        ...source.defaultModulation,
        routes: [{
            id: "shared-global-tune-route",
            sourceId: "macro-2",
            sourceKind: "macro",
            sourceSlot: 2,
            polarity: "bipolar",
            targetId: "voice.globalTune",
            targetKind: "globalTuneSemitones",
            amount: 31.25,
            enabled: true,
        }],
    });
    source.articulationHarness.adapter.apply({
        ...source.defaultArticulations,
        selectedSlotId: "shared-articulation",
        slots: [{ id: "shared-articulation", title: "Shared Sweep" }],
    });
    source.rackHarness.adapter.apply({
        ...source.defaultRack,
        output: { mix: 0.37, bypassed: true },
        order: [...source.defaultRack.order].reverse(),
        enabled: { ...source.defaultRack.enabled, chorus: true, delay: true },
    });
    const saved = source.controller.getMutations().saveCurrentAsNewPreset("Shared Lead");
    assert.equal(saved.ok, true, saved.message);

    const captured = synthMutations(source.controller).captureSharedSound();
    assert.equal(captured.ok, true, captured.message);
    assert.deepEqual(captured.value.preset.parameters, source.patchConnection.parameterValues);
    assert.equal(captured.value.preset.parameters.globalTune, 12.37);
    assert.deepEqual(
        Object.fromEntries([
            "voiceEnhancerFrequency",
            "voiceEnhancerQ",
            "voiceEnhancerAmount",
            "voiceEnhancerKeyTrackEnabled",
            "voiceEnhancerKeyTrackOffsetSemitones",
        ].map((endpointID) => [endpointID, captured.value.preset.parameters[endpointID]])),
        {
            voiceEnhancerFrequency: 2_400,
            voiceEnhancerQ: 4.2,
            voiceEnhancerAmount: 0.63,
            voiceEnhancerKeyTrackEnabled: 1,
            voiceEnhancerKeyTrackOffsetSemitones: 19.37,
        },
    );
    assert.deepEqual(
        Object.fromEntries(["ampAttack", "ampDecay", "ampSustain", "ampRelease"]
            .map((endpointID) => [endpointID, captured.value.preset.parameters[endpointID]])),
        { ampAttack: 0.43, ampDecay: 0.67, ampSustain: 0.38, ampRelease: 2.4 },
    );
    assert.deepEqual(captured.value.preset.storedState["modulation.v6"], source.modulationHarness.value);
    assert.deepEqual(captured.value.preset.storedState["articulations.v4"], source.articulationHarness.value);
    assert.deepEqual(captured.value.supplementalStoredState["lane.v1"], source.rackHarness.value);
    assert.deepEqual(captured.value.supplementalStoredState["lane.v1"].output,
                     { mix: 0.37, bypassed: true });

    const target = await createSynthFixture();
    const initialized = synthMutations(target.controller).initSound();
    assert.equal(initialized.ok, true, initialized.message);
    const loaded = synthMutations(target.controller).loadSharedSound(captured.value);
    assert.equal(loaded.ok, true, loaded.message);
    assert.deepEqual(target.patchConnection.parameterValues, source.patchConnection.parameterValues);
    assert.equal(target.patchConnection.parameterValues.globalTune, 12.37);
    assert.deepEqual(
        Object.fromEntries([
            "voiceEnhancerFrequency",
            "voiceEnhancerQ",
            "voiceEnhancerAmount",
            "voiceEnhancerKeyTrackEnabled",
            "voiceEnhancerKeyTrackOffsetSemitones",
        ].map((endpointID) => [endpointID, target.patchConnection.parameterValues[endpointID]])),
        {
            voiceEnhancerFrequency: 2_400,
            voiceEnhancerQ: 4.2,
            voiceEnhancerAmount: 0.63,
            voiceEnhancerKeyTrackEnabled: 1,
            voiceEnhancerKeyTrackOffsetSemitones: 19.37,
        },
    );
    assert.deepEqual(
        Object.fromEntries(["ampAttack", "ampDecay", "ampSustain", "ampRelease"]
            .map((endpointID) => [endpointID, target.patchConnection.parameterValues[endpointID]])),
        { ampAttack: 0.43, ampDecay: 0.67, ampSustain: 0.38, ampRelease: 2.4 },
    );
    assert.deepEqual(
        Object.fromEntries([
            "oscAVolumeDb", "oscBVolumeDb", "oscCVolumeDb",
            "oscAMute", "oscBMute", "oscCMute",
        ].map((endpointID) => [endpointID, target.patchConnection.parameterValues[endpointID]])),
        {
            oscAVolumeDb: -3.25,
            oscBVolumeDb: -12.5,
            oscCVolumeDb: 2.75,
            oscAMute: 1,
            oscBMute: 0,
            oscCMute: 0,
        },
    );
    assert.deepEqual(target.modulationHarness.value, source.modulationHarness.value);
    assert.deepEqual(target.articulationHarness.value, source.articulationHarness.value);
    assert.deepEqual(target.rackHarness.value, source.rackHarness.value);
    assert.deepEqual(target.rackHarness.value.output, { mix: 0.37, bypassed: true });
    assert.equal(target.controller.getState().activePreset, null);
    assert.equal(target.controller.getState().activeLabel, "Shared Lead");
    assert.equal(target.controller.getState().dirty, false);

    target.patchConnection.emitParameterValue("oscAFramePosition", 0.99);
    target.rackHarness.adapter.apply({ ...target.rackHarness.value, order: target.defaultRack.order });
    assert.equal(target.controller.getState().dirty, true);
    const reverted = target.controller.getMutations().reapplyActivePreset();
    assert.equal(reverted.ok, true, reverted.message);
    assert.deepEqual(target.patchConnection.parameterValues, source.patchConnection.parameterValues);
    assert.deepEqual(target.rackHarness.value, source.rackHarness.value);
    assert.equal(target.controller.getState().activeLabel, "Shared Lead");
    assert.equal(target.controller.getState().dirty, false);
});

test("a dirty sound is never replaced by a shared link until discard or save is confirmed", async () => {
    const source = await createSynthFixture();
    source.patchConnection.emitParameterValue("oscAFramePosition", 0.41);
    const saved = source.controller.getMutations().saveCurrentAsNewPreset("Guarded Share");
    assert.equal(saved.ok, true, saved.message);
    const captured = synthMutations(source.controller).captureSharedSound();
    assert.equal(captured.ok, true, captured.message);

    const target = await createSynthFixture();
    assert.equal(synthMutations(target.controller).initSound().ok, true);
    target.patchConnection.emitParameterValue("oscAFramePosition", 0.91);
    const before = clone({
        parameters: target.patchConnection.parameterValues,
        modulation: target.modulationHarness.value,
        articulations: target.articulationHarness.value,
        lane: target.rackHarness.value,
    });

    const guarded = synthMutations(target.controller).loadSharedSound(captured.value);
    assert.equal(guarded.ok, false);
    assert.equal(guarded.actionRequired, "confirm-sound-replacement");
    assert.deepEqual(target.controller.getState().pendingSoundReplacement, {
        kind: "share",
        label: "Guarded Share",
    });
    assert.deepEqual({
        parameters: target.patchConnection.parameterValues,
        modulation: target.modulationHarness.value,
        articulations: target.articulationHarness.value,
        lane: target.rackHarness.value,
    }, before);

    assert.equal(synthMutations(target.controller).cancelSoundReplacement().ok, true);
    assert.deepEqual(target.patchConnection.parameterValues, before.parameters);
    assert.equal(synthMutations(target.controller).loadSharedSound(captured.value).ok, false);
    const discarded = synthMutations(target.controller).discardAndContinueSoundReplacement();
    assert.equal(discarded.ok, true, discarded.message);
    assert.deepEqual(target.patchConnection.parameterValues, source.patchConnection.parameterValues);
    assert.equal(target.controller.getState().activeLabel, "Guarded Share");
    assert.equal(target.controller.getState().dirty, false);
});

test("shared sound supplemental documents are exact and invalid links perform no writes", async () => {
    const source = await createSynthFixture();
    const captured = synthMutations(source.controller).captureSharedSound();
    assert.equal(captured.ok, true, captured.message);
    const target = await createSynthFixture();
    assert.equal(synthMutations(target.controller).initSound().ok, true);
    const baseline = clone({
        eventCount: target.patchConnection.events.length,
        parameters: target.patchConnection.parameterValues,
        modulation: target.modulationHarness.value,
        articulations: target.articulationHarness.value,
        lane: target.rackHarness.value,
    });

    for (const supplementalStoredState of [
        {},
        { ...captured.value.supplementalStoredState, "unknown.sound-state": {} },
    ]) {
        const result = synthMutations(target.controller).loadSharedSound({
            ...captured.value,
            supplementalStoredState,
        });
        assert.equal(result.ok, false);
        assert.match(result.message, /sound state/i);
        assert.equal(target.patchConnection.events.length, baseline.eventCount);
        assert.deepEqual(target.patchConnection.parameterValues, baseline.parameters);
        assert.deepEqual(target.modulationHarness.value, baseline.modulation);
        assert.deepEqual(target.articulationHarness.value, baseline.articulations);
        assert.deepEqual(target.rackHarness.value, baseline.lane);
    }
});

test("sampled-mode sounds are refused with the locked share-link message", async () => {
    const status = clone(synthStatus);
    status.details.inputs.push(parameter("sourceMode", { init: 0, min: 0, max: 1, integer: true }));
    const fixture = await createSynthFixture({ status });
    const shareable = synthMutations(fixture.controller).captureSharedSound();
    assert.equal(shareable.ok, true, shareable.message);
    const writesBefore = fixture.patchConnection.events.length;

    const refusedLoad = synthMutations(fixture.controller).loadSharedSound({
        ...shareable.value,
        preset: {
            ...shareable.value.preset,
            parameters: { ...shareable.value.preset.parameters, sourceMode: 1 },
        },
    });
    assert.equal(refusedLoad.ok, false);
    assert.equal(refusedLoad.message, "Bounced sounds can't be shared by link yet");
    assert.equal(fixture.patchConnection.events.length, writesBefore);

    fixture.patchConnection.emitParameterValue("sourceMode", 1);
    const currentCapture = synthMutations(fixture.controller).captureCurrentSound();
    assert.equal(currentCapture.ok, true, currentCapture.message);
    assert.equal(currentCapture.value.preset.parameters.sourceMode, 1);

    const refusedCapture = synthMutations(fixture.controller).captureSharedSound();
    assert.equal(refusedCapture.ok, false);
    assert.equal(refusedCapture.message, "Bounced sounds can't be shared by link yet");
});
