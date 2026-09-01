import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const legacyFixturePath = path.join(repoRoot, "tests/fixtures/seqfx/legacy-v5-dense-state.json.gz");
const legacyProvenancePath = path.join(repoRoot, "tests/fixtures/seqfx/legacy-v5-dense-state.provenance.json");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function loadLegacyFixture() {
    const [compressed, rawProvenance] = await Promise.all([
        readFile(legacyFixturePath),
        readFile(legacyProvenancePath, "utf8"),
    ]);
    const provenance = JSON.parse(rawProvenance);
    const uncompressed = gunzipSync(compressed);
    const fixture = JSON.parse(uncompressed.toString("utf8"));

    assert.equal(sha256(compressed), provenance.compressedSha256);
    assert.equal(compressed.byteLength, provenance.compressedBytes);
    assert.equal(sha256(uncompressed), provenance.uncompressedSha256);
    assert.equal(uncompressed.byteLength, provenance.uncompressedBytes);
    assert.equal(sha256(fixture.storedState), provenance.storedStateSha256);
    assert.equal(Buffer.byteLength(fixture.storedState), provenance.storedStateBytes);

    return { fixture, provenance };
}

async function loadModules() {
    const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
    const migrationModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-preset-migrations.ts");
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const presetModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts");
    const snapshotModule = await loadUIModule(repoRoot, "kit/ui/effects/effect-snapshots.ts");

    return {
        ...stateModule,
        ...migrationModule,
        ...contractModule,
        ...presetModule,
        ...snapshotModule,
    };
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

test("the frozen v5 fixture is byte-qualified output from the predecessor serializer", async () => {
    const { fixture, provenance } = await loadLegacyFixture();
    assert.equal(fixture.format, "cosimo.seqfxLegacyStoredStateFixture");
    assert.equal(fixture.formatVersion, 1);
    assert.equal(fixture.storedStateKey, "seqfx.v6");
    assert.equal(fixture.schemaVersion, 5);
    assert.equal(provenance.sourceCommit, "7fc89fa322764221facdd2714e9b16bc91c41157");
    assert.equal(provenance.captureBoundary, "The predecessor revision's exported SeqFX state edit and serialize functions.");
    assert.equal(provenance.storedStateSha256, "daf1354662c1e252050e52698f11e8b1d68ba8aa9560ac8bac59a38527e74060");
    assert.equal(provenance.compressedSha256, "97c810de880aecf6502ac9fd6cc0f49575c015303b49a12a29730aa63dd4254c");
    assert.deepEqual(provenance.sourceFiles, {
        "fx/seqfx/view/seqfx-state.ts": "aa0b297a08f3474d30365d554ec8d852070d5db2aee712affb1167ff5b2a7abf",
        "fx/seqfx/view/stutter-envelope.ts": "3e5572d468e72da1764f74997c9efe43f77e07d0ec2938fb474d4ff36e195c38",
    });

    const storedState = JSON.parse(fixture.storedState);
    assert.equal(storedState.version, 5);
    assert.equal(storedState.patterns.length, 12);
    assert.equal(storedState.patterns[0].lanes.length, 4);
    assert.equal(storedState.patterns[0].lanes[0].steps.length, 32);

    const crusher = storedState.patterns[6].lanes[1].steps[5];
    assert.deepEqual(crusher.params, [6, 8, 12, 0, 0, 0, 0, 0]);
    assert.equal(crusher.aux.source.shape, 0.25);
    assert.deepEqual(crusher.aux.targets[1], { enabled: true, end: 16 });

    const tape = storedState.patterns[6].lanes[2].steps[11];
    assert.equal(tape.trigger, true);
    assert.deepEqual(tape.params, [3.25, 2, 0.5, 40, 1, 0, 0, 0]);
    assert.equal(storedState.patterns[6].lanes[2].steps[14].trigger, false);
});

test("legacy_seqfx_preset_contract_and_dense_v5_state_migrate_to_sparse_v7", async () => {
    const modules = await loadModules();
    const { fixture } = await loadLegacyFixture();
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
            [modules.SEQFX_LEGACY_STATE_KEY]: fixture.storedState,
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
    const tape = restored.patterns[6].lanes[modules.SEQFX_LANES.tapeStop].steps[11];
    assert.equal(tape.active, true);
    assert.deepEqual(tape.params, [8, 0.5, 1, 1, 0, 1, 1_625, 200]);

    const crusher = restored.patterns[6].lanes[modules.SEQFX_LANES.crusher].steps[5];
    assert.deepEqual(crusher.params, [6, 6_000, 12, 0, 0, 0, 0, 0]);
    assert.equal(crusher.aux.source.shape, 0.25);
    assert.deepEqual(crusher.aux.targets[1], { enabled: true, end: 3_000 });

    const filter = restored.patterns[6].lanes[modules.SEQFX_LANES.filter].steps[1];
    assert.equal(filter.mix, 0.7);
    assert.deepEqual(filter.params, [0, 1_200, 500, 4.5, 1, 0, 0, 0]);

    const stutter = restored.patterns[6].lanes[modules.SEQFX_LANES.stutter].steps[20];
    assert.deepEqual(stutter.params, [12, 0.75, 0.3, 0.6, 0, 0, 0, 0]);
    assert.deepEqual(
        restored.patterns[6].lanes.map((_lane, laneIndex) => (
            modules.getSeqFxLaneBlocks(restored.patterns[6], laneIndex)[0]?.length
        )),
        [2, 3, 4, 5],
    );
});

test("legacy_seqfx_snapshot_contract_and_dense_v5_state_migrate_to_sparse_v7", async () => {
    const modules = await loadModules();
    const { fixture } = await loadLegacyFixture();
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
            [modules.SEQFX_LEGACY_STATE_KEY]: fixture.storedState,
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
