import assert from "node:assert/strict";
import test from "node:test";

import {
    barePatchFromDefaults,
    createCurrentSpeedrunContext,
    loadSpeedrunModules,
    readSpeedrunFixture,
} from "./helpers/speedrun_test_context.mjs";

test("speedrun defaults are derived from the current generated synth contract", async () => {
    const [{ patchIO }, context] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
    ]);
    const defaults = patchIO.createDefaultsSnapshot(context.options);

    assert.equal(Object.keys(defaults.parameters).length, 110);
    assert.equal(defaults.parameters.oscAWavetableSelect, 35);
    assert.ok(Math.abs(defaults.parameters.ampAttack - 0.01) < 1e-6);
    assert.ok(Math.abs(defaults.parameters.ampDecay - 0.001) < 1e-6);
    assert.equal(defaults.parameters.ampSustain, 1);
    assert.ok(Math.abs(defaults.parameters.ampRelease - 0.2) < 1e-6);
    assert.equal(defaults.parameters.sourceMode, 0);
    assert.equal(defaults.parameters.polishEnhancerAmount, 0);
    assert.equal(defaults.parameters.polishCompressionClipAmount, 0);
    assert.equal(defaults.parameters.polishOutputTrimDb, 0);
    assert.equal(defaults.parameters.polishSafeBassAmount, 0);
    assert.equal(defaults.parameters.polishSafeBassBypass, 0);
    assert.equal(defaults.parameters.polishEnhancerBypass, 0);
    assert.equal(defaults.parameters.polishCompressionClipBypass, 0);
    assert.equal(defaults.parameters.polishOutputTrimBypass, 0);
    assert.equal(defaults.annotations.oscAFineCents.unit, "cents");
    assert.equal(defaults.annotations.oscAOctave.discrete, true);
    assert.deepEqual(Object.keys(defaults.lane.devices), ["distortion#1", "delay#1", "reverb#1"]);
});

test("bare and browser-state patches complete, clamp, and snap public parameters", async () => {
    const [{ patchIO }, context, lane] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
    ]);
    const result = patchIO.intakePatch({
        format: "cosimo.browserPatchState",
        version: 5,
        sound: {
            parameters: {
                oscAWavetablePosition: 2,
                oscAOctave: 2.6,
            },
            storedState: { "lane.v1": lane },
        },
        auxiliary: {},
    }, context.options);

    assert.equal(result.ok, true, result.error?.message);
    assert.equal(result.value.document.parameters.oscAWavetablePosition, 1);
    assert.equal(result.value.document.parameters.oscAOctave, 3);
    assert.equal(result.value.document.parameters.filterCutoff, 1_000);
    assert.deepEqual(result.value.document.lane, lane);
    assert.deepEqual(result.value.document.modulation, context.defaults.modulation);
});

test("current shared-sound envelopes enter through exact contract and strict document parsing", async () => {
    const [{ patchIO }, context, lane] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
    ]);
    const envelope = {
        format: "cosimo.soundShare",
        version: 2,
        preset: {
            kind: "cosimo.effectPreset",
            version: 2,
            effectID: context.options.currentContract.effectID,
            presetID: "speedrun.share",
            label: "Shared Split",
            contract: context.options.currentContract,
            parameters: { ...context.defaults.parameters, filterCutoff: 720 },
            storedState: {
                "modulation.v6": context.defaults.modulation,
                "articulations.v4": context.defaults.articulations,
                "bounce.v1": null,
            },
        },
        supplementalStoredState: { "lane.v1": lane },
    };
    const result = patchIO.intakePatch(envelope, context.options);

    assert.equal(result.ok, true, result.error?.message);
    assert.equal(result.value.document.label, "Shared Split");
    assert.equal(result.value.document.parameters.filterCutoff, 720);
    assert.deepEqual(result.value.document.lane, lane);
});

test("speedrun rejects pre-T74 browser state and unsupported shared-sound versions whole", async () => {
    const [{ patchIO }, context] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
    ]);
    const legacyBrowser = patchIO.intakePatch({
        format: "cosimo.browserPatchState",
        version: 4,
        sound: { parameters: {}, storedState: {} },
        auxiliary: {},
    }, context.options);
    const legacyShare = patchIO.intakePatch({
        format: "cosimo.soundShare",
        version: 1,
        preset: {},
        supplementalStoredState: {},
    }, context.options);

    assert.equal(legacyBrowser.ok, false);
    assert.equal(legacyBrowser.error._tag, "UnknownShape");
    assert.equal(legacyShare.ok, false);
    assert.equal(legacyShare.error._tag, "MigrationFailed");
});

test("intake refuses bounced sounds with the locked studio message", async () => {
    const [{ patchIO }, context] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
    ]);
    for (const patch of [
        barePatchFromDefaults(context.defaults, { parameters: { sourceMode: 1 } }),
        barePatchFromDefaults(context.defaults, { bounce: { format: "cosimo.bounce", version: 1 } }),
    ]) {
        const result = patchIO.intakePatch(patch, context.options);
        assert.equal(result.ok, false);
        assert.equal(result.error._tag, "BouncedSoundUnsupported");
        assert.equal(result.error.message, "Speedrun videos for bounced sounds come later");
    }
});

test("corrupt structured state is rejected without partial patch acceptance", async () => {
    const [{ patchIO }, context] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
    ]);
    const patch = barePatchFromDefaults(context.defaults, {
        modulation: { format: "cosimo.modulation", version: 5 },
    });
    const result = patchIO.intakePatch(patch, context.options);

    assert.equal(result.ok, false);
    assert.equal(result.error._tag, "InvalidModulation");
});

test("current-patch capture reads every parameter and full stored state without writes", async () => {
    const [{ patchIO }, context] = await Promise.all([
        loadSpeedrunModules(),
        createCurrentSpeedrunContext(),
    ]);
    const listeners = new Map();
    const writes = [];
    const connection = {
        addParameterListener(endpointID, listener) {
            listeners.set(endpointID, listener);
        },
        removeParameterListener(endpointID) {
            listeners.delete(endpointID);
        },
        requestParameterValue(endpointID) {
            listeners.get(endpointID)?.(context.defaults.parameters[endpointID]);
        },
        requestFullStoredState(callback) {
            callback({
                values: {
                    ...barePatchFromDefaults(context.defaults).storedState,
                    "effects.presets.v2": { userPresets: {} },
                },
            });
        },
        sendEventOrValue(...args) {
            writes.push(args);
        },
    };
    const result = await patchIO.captureCurrentPatch(connection, {
        ...context.options,
        label: "Captured Live",
    });

    assert.equal(result.ok, true, result.error?.message);
    assert.equal(result.value.document.label, "Captured Live");
    assert.deepEqual(result.value.document.parameters, context.defaults.parameters);
    assert.deepEqual(writes, []);
});
