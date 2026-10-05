import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const snapshotModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-snapshots.ts");
    return { ...contractModule, ...snapshotModule };
}

function createContract(buildContract) {
    return buildContract({
        effectID: "ott",
        parameters: [
            { endpointID: "ottMix", type: "number", min: 0, max: 100, defaultValue: 100 },
            { endpointID: "envelopeBoostClampDb", type: "number", min: 0, max: 24, defaultValue: 6 },
        ],
    });
}

test("snapshot_capture_uses_same_contract_and_payload_shape_as_preset_capture", async () => {
    const { captureEffectSnapshot, buildCanonicalPluginStateContract } = await loadModules();
    const contract = createContract(buildCanonicalPluginStateContract);

    const snapshot = captureEffectSnapshot({
        slotID: "A",
        currentContract: contract,
        currentParameterValues: {
            ottMix: 51,
            envelopeBoostClampDb: 8,
        },
    });

    assert.equal(snapshot.kind, "cosimo.effectSnapshot");
    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.slotID, "A");
    assert.equal(snapshot.contract.hash, contract.hash);
    assert.deepEqual(snapshot.parameters, {
        ottMix: 51,
        envelopeBoostClampDb: 8,
    });
    assert.deepEqual(snapshot.storedState, {});
});

test("snapshot_recall_rejects_stale_hash_without_writes", async () => {
    const { applyEffectSnapshot, buildCanonicalPluginStateContract } = await loadModules();
    const oldContract = buildCanonicalPluginStateContract({
        effectID: "ott",
        parameters: [{ endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 }],
    });
    const currentContract = createContract(buildCanonicalPluginStateContract);
    const writes = [];

    assert.throws(() => applyEffectSnapshot({
        snapshot: {
            kind: "cosimo.effectSnapshot",
            version: 2,
            effectID: "ott",
            slotID: "A",
            label: "",
            contract: oldContract,
            parameters: { mix: 51 },
            storedState: {},
        },
        currentContract,
        patchConnection: {
            sendEventOrValue(endpointID, value) {
                writes.push({ endpointID, value });
            },
        },
    }), /unknown saved parameters:[\s\S]*mix[\s\S]*missing current parameters:[\s\S]*ottMix/i);
    assert.deepEqual(writes, []);
});

test("snapshot_recall_runs_registered_migration_then_applies_exact_payload", async () => {
    const { applyEffectSnapshot, buildCanonicalPluginStateContract } = await loadModules();
    const oldContract = buildCanonicalPluginStateContract({
        effectID: "ott",
        parameters: [{ endpointID: "mix", type: "number", min: 0, max: 100, defaultValue: 100 }],
    });
    const currentContract = createContract(buildCanonicalPluginStateContract);
    const writes = [];

    applyEffectSnapshot({
        snapshot: {
            kind: "cosimo.effectSnapshot",
            version: 2,
            effectID: "ott",
            slotID: "A",
            label: "",
            contract: oldContract,
            parameters: { mix: 51 },
            storedState: {},
        },
        currentContract,
        patchConnection: {
            sendEventOrValue(endpointID, value) {
                writes.push({ endpointID, value });
            },
        },
        migrations: [{
            effectID: "ott",
            fromHash: oldContract.hash,
            toHash: currentContract.hash,
            migrate(snapshot) {
                return {
                    ...snapshot,
                    contract: currentContract,
                    parameters: {
                        ottMix: snapshot.parameters.mix,
                        envelopeBoostClampDb: 6,
                    },
                };
            },
        }],
    });

    assert.deepEqual(writes, [
        { endpointID: "envelopeBoostClampDb", value: 6 },
        { endpointID: "ottMix", value: 51 },
    ]);
});

test("legacy_v1_localstorage_snapshot_is_incompatible_until_explicitly_migrated_or_deleted", async () => {
    const { normalizeEffectSnapshotStore, buildCanonicalPluginStateContract } = await loadModules();
    const currentContract = createContract(buildCanonicalPluginStateContract);

    assert.throws(() => normalizeEffectSnapshotStore({
        schema: 1,
        patchID: "dev.cosimo.ott-lab",
        slots: {
            A: { label: "", values: { mix: 50 } },
        },
    }, { currentContract }), /legacy.*snapshot.*version 1/i);
});

test("snapshot_text_import_rejects_duplicate_keys_before_json_parse_collapses_them", async () => {
    const { parseEffectSnapshotText } = await loadModules();

    assert.throws(() => parseEffectSnapshotText(`{
        "kind": "cosimo.effectSnapshot",
        "version": 2,
        "parameters": {
            "ottMix": 20,
            "ott\\u004dix": 80
        }
    }`), /duplicate.*ottMix/i);
});
