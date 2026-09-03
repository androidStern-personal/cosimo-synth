import {
    buildCanonicalPluginStateContract,
    clonePluginStateContract,
    type EffectPluginStateContract,
} from "../../../kit/index";
import type {
    EffectPresetMigration,
    EffectPresetV2,
} from "../../../kit/index";
import type {
    EffectSnapshot,
    EffectSnapshotMigration,
} from "../../../kit/index";
import {
    SEQFX_LEGACY_STATE_KEY,
    SEQFX_LEGACY_STATE_VERSION,
    SEQFX_STATE_KEY,
    SEQFX_STATE_VERSION,
    parseSeqFxStoredState,
    serializeSeqFxState,
} from "./seqfx-state";

const SEQFX_EFFECT_ID = "seqfx";

type SeqFxPresetArtifact = EffectPresetV2 | EffectSnapshot;

function assertCurrentSeqFxContract(currentContract: EffectPluginStateContract) {
    if (currentContract.effectID !== SEQFX_EFFECT_ID) {
        throw new Error(`SeqFX migrations cannot target ${currentContract.effectID}.`);
    }

    const currentStateEntry = currentContract.storedState.find((entry) => entry.key === SEQFX_STATE_KEY);

    if (currentStateEntry?.schemaVersion !== SEQFX_STATE_VERSION) {
        throw new Error(
            `SeqFX current contract must contain ${SEQFX_STATE_KEY} schema ${SEQFX_STATE_VERSION}.`,
        );
    }
}

/** Reconstructs the exact persisted-state contract used by SeqFX v5/v6 artifacts. */
export function buildLegacySeqFxPluginStateContract(
    currentContract: EffectPluginStateContract,
): EffectPluginStateContract {
    assertCurrentSeqFxContract(currentContract);

    return buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: currentContract.parameters,
        storedState: currentContract.storedState.map((entry) => (
            entry.key === SEQFX_STATE_KEY
                ? {
                    key: SEQFX_LEGACY_STATE_KEY,
                    schemaVersion: SEQFX_LEGACY_STATE_VERSION,
                    required: true as const,
                }
                : entry
        )),
    });
}

function migrateLegacySeqFxArtifact<TArtifact extends SeqFxPresetArtifact>(
    artifact: TArtifact,
    currentContract: EffectPluginStateContract,
): TArtifact {
    if (!Object.prototype.hasOwnProperty.call(artifact.storedState, SEQFX_LEGACY_STATE_KEY)) {
        throw new Error(`Legacy SeqFX artifact is missing ${SEQFX_LEGACY_STATE_KEY}.`);
    }

    const migratedState = serializeSeqFxState(
        parseSeqFxStoredState(artifact.storedState[SEQFX_LEGACY_STATE_KEY]).state,
    );
    const nextStoredState = Object.fromEntries(currentContract.storedState.map((entry) => [
        entry.key,
        entry.key === SEQFX_STATE_KEY
            ? migratedState
            : artifact.storedState[entry.key],
    ]));

    return {
        ...artifact,
        contract: clonePluginStateContract(currentContract),
        storedState: nextStoredState,
    };
}

export function createSeqFxPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    const legacyContract = buildLegacySeqFxPluginStateContract(currentContract);

    return [{
        effectID: SEQFX_EFFECT_ID,
        fromHash: legacyContract.hash,
        toHash: currentContract.hash,
        migrate: (preset) => migrateLegacySeqFxArtifact(preset, currentContract),
    }];
}

export function createSeqFxSnapshotMigrations(
    currentContract: EffectPluginStateContract,
): EffectSnapshotMigration[] {
    const legacyContract = buildLegacySeqFxPluginStateContract(currentContract);

    return [{
        effectID: SEQFX_EFFECT_ID,
        fromHash: legacyContract.hash,
        toHash: currentContract.hash,
        migrate: (snapshot) => migrateLegacySeqFxArtifact(snapshot, currentContract),
    }];
}
