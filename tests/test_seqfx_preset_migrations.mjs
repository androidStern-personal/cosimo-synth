import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
    const migrationModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-preset-migrations.ts");
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const presetModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts");
    const snapshotModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-snapshots.ts");

    return {
        ...stateModule,
        ...migrationModule,
        ...contractModule,
        ...presetModule,
        ...snapshotModule,
    };
}

function createLegacyDenseState(modules) {
    const state = modules.createDefaultSeqFxState();
    const legacyDefaultsByLane = [
        [0, 2_000, 500, 0.707, 1, 0, 0, 0],
        [8, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 25, 0, 0, 0, 0],
        [8, 1, 0.4375, 0.68, 0, 0, 0, 0],
    ];
    for (const pattern of state.patterns) {
        pattern.lanes.forEach((lane, laneIndex) => {
            for (const step of lane.steps) {
                step.params = [...legacyDefaultsByLane[laneIndex]];
                step.aux.targets = step.params.map((end) => ({ enabled: false, end }));
                delete step.effectParams;
                delete step.effectAux;
            }
        });
    }
    const legacyTapeStep = state.patterns[6].lanes[modules.SEQFX_LANES.tapeStop].steps[11];
    legacyTapeStep.active = true;
    legacyTapeStep.trigger = true;
    legacyTapeStep.effectType = modules.SEQFX_EFFECT_TYPES.tapeStop;
    legacyTapeStep.params[0] = 3.25;
    legacyTapeStep.aux.targets[0].end = 3.25;
    state.version = modules.SEQFX_LEGACY_STATE_VERSION;
    return JSON.stringify(state);
}

function createCurrentContract(modules) {
    return modules.buildCanonicalPluginStateContract({
        effectID: "seqfx",
        parameters: [
            { endpointID: "patternSelect", type: "integer", min: 0, max: 11, defaultValue: 0 },
            { endpointID: "rate", type: "number", min: 0.25, max: 4, defaultValue: 1 },
        ],
        storedState: [{
            key: modules.SEQFX_STATE_KEY,
            schemaVersion: modules.SEQFX_STATE_VERSION,
            required: true,
        }],
    });
}

function createStoredStateAdapter(modules) {
    return {
        key: modules.SEQFX_STATE_KEY,
        schemaVersion: modules.SEQFX_STATE_VERSION,
        normalizeForPreset(value) {
            return modules.serializeSeqFxState(modules.parseSeqFxStoredState(value).state);
        },
        serializeForPreset(value) {
            return modules.serializeSeqFxState(modules.parseSeqFxStoredState(value).state);
        },
    };
}

test("legacy_seqfx_preset_contract_and_dense_v5_state_migrate_to_sparse_v7", async () => {
    const modules = await loadModules();
    const currentContract = createCurrentContract(modules);
    const legacyContract = modules.buildLegacySeqFxPluginStateContract(currentContract);
    const normalized = modules.normalizeEffectPresetV2({
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "seqfx",
        presetID: "user.seqfx.legacy",
        label: "Legacy SeqFX",
        contract: legacyContract,
        parameters: { patternSelect: 6, rate: 1 },
        storedState: {
            [modules.SEQFX_LEGACY_STATE_KEY]: createLegacyDenseState(modules),
        },
    }, {
        currentContract,
        storedStateAdapters: [createStoredStateAdapter(modules)],
        migrations: modules.createSeqFxPresetMigrations(currentContract),
    });

    assert.equal(normalized.contract.hash, currentContract.hash);
    assert.deepEqual(Object.keys(normalized.storedState), [modules.SEQFX_STATE_KEY]);
    assert.equal(JSON.parse(normalized.storedState[modules.SEQFX_STATE_KEY]).version, 7);
    const restored = modules.parseStrictSeqFxStateV7(normalized.storedState[modules.SEQFX_STATE_KEY]);
    const step = restored.patterns[6].lanes[modules.SEQFX_LANES.tapeStop].steps[11];
    assert.equal(step.active, true);
    assert.equal(step.params[5], 1);
    assert.equal(step.params[6], 406.25);
});

test("legacy_seqfx_snapshot_contract_and_dense_v5_state_migrate_to_sparse_v7", async () => {
    const modules = await loadModules();
    const currentContract = createCurrentContract(modules);
    const legacyContract = modules.buildLegacySeqFxPluginStateContract(currentContract);
    const normalized = modules.normalizeEffectSnapshot({
        kind: "cosimo.effectSnapshot",
        version: 2,
        effectID: "seqfx",
        slotID: "C",
        label: "Legacy C",
        contract: legacyContract,
        parameters: { patternSelect: 6, rate: 1 },
        storedState: {
            [modules.SEQFX_LEGACY_STATE_KEY]: createLegacyDenseState(modules),
        },
    }, {
        currentContract,
        storedStateAdapters: [createStoredStateAdapter(modules)],
        migrations: modules.createSeqFxSnapshotMigrations(currentContract),
    });

    assert.equal(normalized.slotID, "C");
    assert.equal(normalized.contract.hash, currentContract.hash);
    assert.deepEqual(Object.keys(normalized.storedState), [modules.SEQFX_STATE_KEY]);
    assert.equal(JSON.parse(normalized.storedState[modules.SEQFX_STATE_KEY]).version, 7);
});

test("seqfx_artifact_migration_rejects_a_missing_or_invalid_legacy_state", async () => {
    const modules = await loadModules();
    const currentContract = createCurrentContract(modules);
    const legacyContract = modules.buildLegacySeqFxPluginStateContract(currentContract);
    const basePreset = {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "seqfx",
        presetID: "user.seqfx.bad",
        label: "Bad legacy",
        contract: legacyContract,
        parameters: { patternSelect: 0, rate: 1 },
        storedState: {},
    };
    const options = {
        currentContract,
        storedStateAdapters: [createStoredStateAdapter(modules)],
        migrations: modules.createSeqFxPresetMigrations(currentContract),
    };

    assert.throws(
        () => modules.normalizeEffectPresetV2(basePreset, options),
        /missing seqfx\.v6/i,
    );
    assert.throws(
        () => modules.normalizeEffectPresetV2({
            ...basePreset,
            storedState: { [modules.SEQFX_LEGACY_STATE_KEY]: "{}" },
        }, options),
        /version.*7.*legacy.*5/i,
    );
});
