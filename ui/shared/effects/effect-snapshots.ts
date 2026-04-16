import type { EffectPluginStateContract } from "./effect-state-contract";
import {
    applyEffectPresetV2,
    captureEffectPresetV2,
    EFFECT_PRESET_V2_KIND,
    EFFECT_PRESET_V2_SCHEMA_VERSION,
    normalizeEffectPresetV2,
    type EffectPresetMigration,
    type EffectStoredStateAdapter,
} from "./effect-preset-v2";
import { assertNoDuplicateJsonKeys } from "./effect-preset-schema";

export const EFFECT_SNAPSHOT_KIND = "cosimo.effectSnapshot";
export const EFFECT_SNAPSHOT_SCHEMA_VERSION = 2;

export type EffectSnapshot = {
    kind: typeof EFFECT_SNAPSHOT_KIND;
    version: typeof EFFECT_SNAPSHOT_SCHEMA_VERSION;
    effectID: string;
    slotID: string;
    label: string;
    contract: EffectPluginStateContract;
    parameters: Record<string, number | boolean>;
    storedState: Record<string, unknown>;
};

function snapshotToPreset(snapshot: EffectSnapshot) {
    return {
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID: snapshot.effectID,
        presetID: `snapshot.${snapshot.slotID}`,
        label: snapshot.label || snapshot.slotID,
        contract: snapshot.contract,
        parameters: snapshot.parameters,
        storedState: snapshot.storedState,
    };
}

function presetToSnapshot(preset: ReturnType<typeof snapshotToPreset>, slotID: string): EffectSnapshot {
    return {
        kind: EFFECT_SNAPSHOT_KIND,
        version: EFFECT_SNAPSHOT_SCHEMA_VERSION,
        effectID: preset.effectID,
        slotID,
        label: preset.label === slotID ? "" : preset.label,
        contract: preset.contract,
        parameters: preset.parameters,
        storedState: preset.storedState,
    };
}

export function captureEffectSnapshot({
    slotID,
    currentContract,
    currentParameterValues,
    storedStateAdapters = [],
    label = "",
}: {
    slotID: string;
    currentContract: EffectPluginStateContract;
    currentParameterValues: Record<string, unknown>;
    storedStateAdapters?: Array<EffectStoredStateAdapter>;
    label?: string;
}): EffectSnapshot {
    const preset = captureEffectPresetV2({
        effectID: currentContract.effectID,
        presetID: `snapshot.${slotID}`,
        label: label || slotID,
        currentContract,
        currentParameterValues,
        storedStateAdapters,
    });

    return presetToSnapshot(preset, slotID);
}

function wrapSnapshotMigrations(
    migrations: Array<EffectPresetMigration<EffectSnapshot>>,
    slotID: string,
) {
    return migrations.map((migration) => ({
        effectID: migration.effectID,
        fromHash: migration.fromHash,
        toHash: migration.toHash,
        migrate(preset: ReturnType<typeof snapshotToPreset>) {
            const snapshot = presetToSnapshot(preset, slotID);
            return snapshotToPreset(migration.migrate(snapshot));
        },
    }));
}

export function applyEffectSnapshot({
    snapshot,
    currentContract,
    patchConnection,
    migrations = [],
    storedStateAdapters = [],
}: {
    snapshot: EffectSnapshot;
    currentContract: EffectPluginStateContract;
    patchConnection: Parameters<typeof applyEffectPresetV2>[0]["patchConnection"];
    migrations?: Array<EffectPresetMigration<EffectSnapshot>>;
    storedStateAdapters?: Array<EffectStoredStateAdapter>;
}) {
    const preset = snapshotToPreset(snapshot);
    const normalizedPreset = applyEffectPresetV2({
        preset,
        currentContract,
        patchConnection,
        migrations: wrapSnapshotMigrations(migrations, snapshot.slotID),
        storedStateAdapters,
    });

    return presetToSnapshot(normalizedPreset, snapshot.slotID);
}

export function normalizeEffectSnapshotStore(
    payload: unknown,
    _options: { currentContract: EffectPluginStateContract },
) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Snapshot store must be an object.");
    }

    if ((payload as { schema?: unknown }).schema === 1) {
        throw new Error("Legacy snapshot store version 1 is incompatible until explicitly migrated or deleted.");
    }

    return payload;
}

export function normalizeEffectSnapshot(
    snapshot: EffectSnapshot,
    {
        currentContract,
        storedStateAdapters = [],
        migrations = [],
    }: {
        currentContract: EffectPluginStateContract;
        storedStateAdapters?: Array<EffectStoredStateAdapter>;
        migrations?: Array<EffectPresetMigration<EffectSnapshot>>;
    },
) {
    const normalizedPreset = normalizeEffectPresetV2(snapshotToPreset(snapshot), {
        currentContract,
        storedStateAdapters,
        migrations: wrapSnapshotMigrations(migrations, snapshot.slotID),
    });

    return presetToSnapshot(normalizedPreset, snapshot.slotID);
}

export function parseEffectSnapshotText(text: string) {
    assertNoDuplicateJsonKeys(text);
    return JSON.parse(text);
}
