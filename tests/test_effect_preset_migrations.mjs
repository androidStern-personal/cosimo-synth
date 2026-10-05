import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const presetModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts");
    return { ...contractModule, ...presetModule };
}

function contractFor(buildContract, effectID, parameters, storedState = []) {
    return buildContract({ effectID, parameters, storedState });
}

function oldOttPreset(oldContract, overrides = {}) {
    return {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "ott",
        presetID: "user.ott.old",
        label: "Old",
        contract: oldContract,
        parameters: {
            mix: 64,
            amount: 72,
        },
        storedState: {},
        ...overrides,
    };
}

class Recorder {
    constructor() {
        this.events = [];
        this.storedWrites = [];
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }
}

test("hash_mismatch_without_registered_migration_fails_with_concrete_diff", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const oldContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "amount", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const currentContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "ottAmount", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ]);
    const recorder = new Recorder();

    assert.throws(() => applyEffectPresetV2({
        preset: oldOttPreset(oldContract),
        currentContract,
        patchConnection: recorder,
    }), (error) => {
        const message = String(error?.message ?? error);

        assert.match(message, /unknown saved parameters/i);
        assert.match(message, /- mix\b/i);
        assert.match(message, /- amount\b/i);
        assert.match(message, /missing current parameters/i);
        assert.match(message, /- ottMix\b/i);
        assert.match(message, /- ottAmount\b/i);
        assert.match(message, /- envelopeBoostClampDb\b/i);
        assert.match(message, /no migration/i);

        return true;
    });
    assert.deepEqual(recorder.events, []);
});

test("registered_migration_renames_parameters_adds_new_values_and_revalidates", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const oldContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "amount", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const currentContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "ottAmount", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ]);
    const recorder = new Recorder();

    const normalized = applyEffectPresetV2({
        preset: oldOttPreset(oldContract),
        currentContract,
        patchConnection: recorder,
        migrations: [{
            effectID: "ott",
            fromHash: oldContract.hash,
            toHash: currentContract.hash,
            migrate(preset) {
                return {
                    ...preset,
                    contract: currentContract,
                    parameters: {
                        ottMix: preset.parameters.mix,
                        ottAmount: preset.parameters.amount,
                        envelopeBoostClampDb: 6,
                    },
                };
            },
        }],
    });

    assert.deepEqual(normalized.parameters, {
        ottMix: 64,
        ottAmount: 72,
        envelopeBoostClampDb: 6,
    });
    assert.deepEqual(recorder.events, [
        { endpointID: "envelopeBoostClampDb", value: 6 },
        { endpointID: "ottAmount", value: 72 },
        { endpointID: "ottMix", value: 64 },
    ]);
});

test("migration_output_must_pass_exact_current_contract_validation", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const oldContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const currentContract = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ]);
    const recorder = new Recorder();
    const baseMigration = {
        effectID: "ott",
        fromHash: oldContract.hash,
        toHash: currentContract.hash,
    };

    assert.throws(() => applyEffectPresetV2({
        preset: {
            ...oldOttPreset(oldContract),
            parameters: { mix: 64 },
        },
        currentContract,
        patchConnection: recorder,
        migrations: [{
            ...baseMigration,
            migrate(preset) {
                return {
                    ...preset,
                    contract: currentContract,
                    parameters: {
                        mix: preset.parameters.mix,
                        envelopeBoostClampDb: 6,
                    },
                };
            },
        }],
    }), /unknown.*mix/i);
    assert.throws(() => applyEffectPresetV2({
        preset: {
            ...oldOttPreset(oldContract),
            parameters: { mix: 64 },
        },
        currentContract,
        patchConnection: recorder,
        migrations: [{
            ...baseMigration,
            migrate(preset) {
                return {
                    ...preset,
                    contract: currentContract,
                    parameters: {
                        ottMix: preset.parameters.mix,
                    },
                };
            },
        }],
    }), /missing.*envelopeBoostClampDb/i);
    assert.deepEqual(recorder.events, []);
});

test("migration_path_chains_hash_a_to_b_to_c_in_order", async () => {
    const { normalizeEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contractA = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const contractB = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const contractC = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ]);
    const trace = [];

    const normalized = normalizeEffectPresetV2({
        ...oldOttPreset(contractA),
        parameters: { mix: 50 },
    }, {
        currentContract: contractC,
        migrations: [
            {
                effectID: "ott",
                fromHash: contractA.hash,
                toHash: contractB.hash,
                migrate(preset) {
                    trace.push("A>B");
                    return {
                        ...preset,
                        contract: contractB,
                        parameters: { ottMix: preset.parameters.mix },
                    };
                },
            },
            {
                effectID: "ott",
                fromHash: contractB.hash,
                toHash: contractC.hash,
                migrate(preset) {
                    trace.push("B>C");
                    return {
                        ...preset,
                        contract: contractC,
                        parameters: { ...preset.parameters, envelopeBoostClampDb: 6 },
                    };
                },
            },
        ],
    });

    assert.deepEqual(trace, ["A>B", "B>C"]);
    assert.deepEqual(normalized.parameters, {
        ottMix: 50,
        envelopeBoostClampDb: 6,
    });
});

test("migration_cycle_or_ambiguous_path_fails_before_apply", async () => {
    const { applyEffectPresetV2, buildCanonicalPluginStateContract } = await loadModules();
    const contractA = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const contractB = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
    ]);
    const contractC = contractFor(buildCanonicalPluginStateContract, "ott", [
        { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
        { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
    ]);
    const recorder = new Recorder();
    const migrate = (preset) => ({
        ...preset,
        contract: contractB,
        parameters: { ottMix: preset.parameters.mix },
    });

    assert.throws(() => applyEffectPresetV2({
        preset: {
            ...oldOttPreset(contractA),
            parameters: { mix: 50 },
        },
        currentContract: contractC,
        patchConnection: recorder,
        migrations: [
            { effectID: "ott", fromHash: contractA.hash, toHash: contractB.hash, migrate },
            { effectID: "ott", fromHash: contractA.hash, toHash: contractB.hash, migrate },
        ],
    }), /ambiguous/i);
    assert.deepEqual(recorder.events, []);
});
