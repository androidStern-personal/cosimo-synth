import {
    canonicalJSONStringify,
    clonePluginStateContract,
    type EffectParameterContract,
    type EffectParameterValue,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import { assertNoDuplicateJsonKeys } from "./effect-preset-schema";

export const EFFECT_PRESET_V2_KIND = "cosimo.effectPreset";
export const EFFECT_PRESET_V2_SCHEMA_VERSION = 2;

export type EffectStoredStateAdapter<TValue = unknown> = {
    key: string;
    schemaVersion: number;
    capture?: () => TValue;
    normalizeForPreset: (value: unknown) => TValue;
    serializeForPreset: (value: TValue) => unknown;
    apply?: (value: TValue) => void;
    getContract?: () => { key: string; schemaVersion: number; required: true };
    subscribe?: (listener: () => void) => () => void;
};

export type EffectPresetV2 = {
    kind: typeof EFFECT_PRESET_V2_KIND;
    version: typeof EFFECT_PRESET_V2_SCHEMA_VERSION;
    effectID: string;
    presetID: string;
    label: string;
    contract: EffectPluginStateContract;
    parameters: Record<string, EffectParameterValue>;
    storedState: Record<string, unknown>;
};

export type EffectPresetMigration<TPreset extends EffectPresetV2 = EffectPresetV2> = {
    effectID: string;
    fromHash: string;
    toHash: string;
    migrate: (preset: TPreset) => TPreset;
};

type NormalizeOptions = {
    currentContract: EffectPluginStateContract;
    storedStateAdapters?: Array<EffectStoredStateAdapter>;
    migrations?: Array<EffectPresetMigration>;
};

type ApplyOptions = NormalizeOptions & {
    preset: unknown;
    patchConnection: {
        sendParameterGestureStart?: (endpointID: string) => void;
        sendEventOrValue?: (endpointID: string, value: unknown) => void;
        sendParameterGestureEnd?: (endpointID: string) => void;
        sendStoredStateValue?: (key: string, value: unknown) => void;
    };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Effect preset ${fieldName} must be a non-empty string.`);
    }

    return value.trim();
}

function clonePreset(preset: EffectPresetV2): EffectPresetV2 {
    return {
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID: preset.effectID,
        presetID: preset.presetID,
        label: preset.label,
        contract: clonePluginStateContract(preset.contract),
        parameters: { ...preset.parameters },
        storedState: { ...preset.storedState },
    };
}

function parsePresetShape(payload: unknown): EffectPresetV2 {
    if (!isPlainObject(payload)) {
        throw new Error("Effect preset payload must be an object.");
    }

    if (payload.kind !== EFFECT_PRESET_V2_KIND) {
        throw new Error(`Effect preset kind must be "${EFFECT_PRESET_V2_KIND}".`);
    }

    if (payload.version !== EFFECT_PRESET_V2_SCHEMA_VERSION) {
        throw new Error(`Unsupported effect preset version "${String(payload.version)}".`);
    }

    if (!isPlainObject(payload.contract) || typeof payload.contract.hash !== "string") {
        throw new Error("Effect preset contract with hash is required.");
    }

    if (!isPlainObject(payload.parameters)) {
        throw new Error("Effect preset parameters must be an object.");
    }

    if (!isPlainObject(payload.storedState)) {
        throw new Error("Effect preset storedState must be an object.");
    }

    return {
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID: requireString(payload.effectID, "effectID"),
        presetID: requireString(payload.presetID, "presetID"),
        label: requireString(payload.label, "label"),
        contract: payload.contract as EffectPluginStateContract,
        parameters: { ...payload.parameters } as Record<string, EffectParameterValue>,
        storedState: { ...payload.storedState },
    };
}

function adapterByKey(adapters: Array<EffectStoredStateAdapter> = []) {
    return new Map(adapters.map((adapter) => [adapter.key, adapter]));
}

function sortedKeys(value: Record<string, unknown>) {
    return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function missingKeys(expected: string[], provided: string[]) {
    const providedSet = new Set(provided);
    return expected.filter((key) => !providedSet.has(key));
}

function unknownKeys(expected: string[], provided: string[]) {
    const expectedSet = new Set(expected);
    return provided.filter((key) => !expectedSet.has(key));
}

function formatDiff({
    preset,
    currentContract,
}: {
    preset: EffectPresetV2;
    currentContract: EffectPluginStateContract;
}) {
    const currentParameterIDs = currentContract.parameters.map((param) => param.endpointID);
    const presetParameterIDs = sortedKeys(preset.parameters);
    const currentStoredKeys = currentContract.storedState.map((entry) => entry.key);
    const presetStoredKeys = sortedKeys(preset.storedState);
    const unknownParams = unknownKeys(currentParameterIDs, presetParameterIDs);
    const missingParams = missingKeys(currentParameterIDs, presetParameterIDs);
    const unknownStoredState = unknownKeys(currentStoredKeys, presetStoredKeys);
    const missingStoredState = missingKeys(currentStoredKeys, presetStoredKeys);
    const lines = [
        `Preset was saved for an incompatible ${currentContract.effectID} contract.`,
        "",
    ];

    if (unknownParams.length > 0) {
        lines.push("Unknown saved parameters:");
        lines.push(...unknownParams.map((key) => `- ${key}`));
        lines.push("");
    }

    if (missingParams.length > 0) {
        lines.push("Missing current parameters:");
        lines.push(...missingParams.map((key) => `- ${key}`));
        lines.push("");
    }

    if (unknownStoredState.length > 0) {
        lines.push("Unknown saved stored-state keys:");
        lines.push(...unknownStoredState.map((key) => `- ${key}`));
        lines.push("");
    }

    if (missingStoredState.length > 0) {
        lines.push("Missing current stored-state keys:");
        lines.push(...missingStoredState.map((key) => `- ${key}`));
        lines.push("");
    }

    lines.push(`No migration is registered from ${preset.contract.hash} to ${currentContract.hash}.`);
    return lines.join("\n");
}

function normalizeParameterValue(parameter: EffectParameterContract, value: unknown): EffectParameterValue {
    if (parameter.type === "boolean") {
        if (typeof value !== "boolean") {
            throw new Error(`${parameter.endpointID} must be a boolean.`);
        }

        return value;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${parameter.endpointID} must be a finite number.`);
    }

    if (parameter.type === "integer" && !Number.isInteger(value)) {
        throw new Error(`${parameter.endpointID} must be an integer.`);
    }

    if (typeof parameter.min === "number" && value < parameter.min) {
        throw new Error(`${parameter.endpointID} value ${value} is below minimum ${parameter.min}.`);
    }

    if (typeof parameter.max === "number" && value > parameter.max) {
        throw new Error(`${parameter.endpointID} value ${value} is above maximum ${parameter.max}.`);
    }

    return value;
}

function validateExactPreset(
    preset: EffectPresetV2,
    currentContract: EffectPluginStateContract,
    adapters: Array<EffectStoredStateAdapter> = [],
): EffectPresetV2 {
    if (preset.effectID !== currentContract.effectID) {
        throw new Error(`Cannot load ${preset.effectID} preset into ${currentContract.effectID}.`);
    }

    if (preset.contract.hash !== currentContract.hash) {
        throw new Error(formatDiff({ preset, currentContract }));
    }

    const parameterIDs = currentContract.parameters.map((param) => param.endpointID);
    const providedParameterIDs = sortedKeys(preset.parameters);
    const unknownParams = unknownKeys(parameterIDs, providedParameterIDs);
    const missingParams = missingKeys(parameterIDs, providedParameterIDs);

    if (unknownParams.length > 0) {
        throw new Error(`Unknown parameter: ${unknownParams.join(", ")}.`);
    }

    if (missingParams.length > 0) {
        throw new Error(`Missing parameter: ${missingParams.join(", ")}.`);
    }

    const normalizedParameters: Record<string, EffectParameterValue> = {};

    for (const parameter of currentContract.parameters) {
        normalizedParameters[parameter.endpointID] = normalizeParameterValue(parameter, preset.parameters[parameter.endpointID]);
    }

    const storedKeys = currentContract.storedState.map((entry) => entry.key);
    const providedStoredKeys = sortedKeys(preset.storedState);
    const unknownStoredKeys = unknownKeys(storedKeys, providedStoredKeys);
    const missingStoredKeys = missingKeys(storedKeys, providedStoredKeys);

    if (unknownStoredKeys.length > 0) {
        throw new Error(`Unknown stored-state key: ${unknownStoredKeys.join(", ")}.`);
    }

    if (missingStoredKeys.length > 0) {
        throw new Error(`Missing stored-state key: ${missingStoredKeys.join(", ")}.`);
    }

    const adaptersByKey = adapterByKey(adapters);
    const normalizedStoredState: Record<string, unknown> = {};

    for (const entry of currentContract.storedState) {
        const adapter = adaptersByKey.get(entry.key);
        const rawValue = preset.storedState[entry.key];

        if (!adapter) {
            normalizedStoredState[entry.key] = rawValue;
            continue;
        }

        const normalizedValue = adapter.normalizeForPreset(rawValue);
        normalizedStoredState[entry.key] = adapter.serializeForPreset(normalizedValue);
    }

    return {
        ...preset,
        contract: clonePluginStateContract(currentContract),
        parameters: normalizedParameters,
        storedState: normalizedStoredState,
    };
}

function assertNoAmbiguousMigrations(migrations: Array<EffectPresetMigration>, effectID: string) {
    const seen = new Set<string>();

    for (const migration of migrations.filter((entry) => entry.effectID === effectID)) {
        const key = `${migration.fromHash}->${migration.toHash}`;

        if (seen.has(key)) {
            throw new Error(`Ambiguous migration path for ${effectID} from ${migration.fromHash}.`);
        }

        seen.add(key);
    }
}

function migratePresetToCurrentContract(
    preset: EffectPresetV2,
    currentContract: EffectPluginStateContract,
    migrations: Array<EffectPresetMigration>,
) {
    if (preset.contract.hash === currentContract.hash) {
        return preset;
    }

    assertNoAmbiguousMigrations(migrations, currentContract.effectID);

    const queue: Array<{ preset: EffectPresetV2; path: string[] }> = [{ preset, path: [] }];
    const visited = new Set<string>();
    let found: { preset: EffectPresetV2; path: string[] } | null = null;

    while (queue.length > 0) {
        const next = queue.shift();

        if (!next) {
            break;
        }

        if (next.preset.contract.hash === currentContract.hash) {
            if (found) {
                throw new Error(`Ambiguous migration path for ${currentContract.effectID} to ${currentContract.hash}.`);
            }

            found = next;
            continue;
        }

        if (visited.has(next.preset.contract.hash)) {
            continue;
        }

        visited.add(next.preset.contract.hash);

        const candidates = migrations.filter((migration) => (
            migration.effectID === currentContract.effectID
            && migration.fromHash === next.preset.contract.hash
        ));

        if (candidates.length > 1) {
            throw new Error(`Ambiguous migration path for ${currentContract.effectID} from ${next.preset.contract.hash}.`);
        }

        for (const migration of candidates) {
            queue.push({
                preset: migration.migrate(clonePreset(next.preset)),
                path: [...next.path, `${migration.fromHash}->${migration.toHash}`],
            });
        }
    }

    if (!found) {
        throw new Error(formatDiff({ preset, currentContract }));
    }

    return found.preset;
}

export function normalizeEffectPresetV2(
    payload: unknown,
    {
        currentContract,
        migrations = [],
        storedStateAdapters = [],
    }: NormalizeOptions,
): EffectPresetV2 {
    const parsedPreset = parsePresetShape(payload);
    const migratedPreset = migratePresetToCurrentContract(parsedPreset, currentContract, migrations);
    return validateExactPreset(migratedPreset, currentContract, storedStateAdapters);
}

export function captureEffectPresetV2({
    effectID,
    presetID,
    label,
    currentContract,
    currentParameterValues,
    storedStateAdapters = [],
}: {
    effectID: string;
    presetID: string;
    label: string;
    currentContract: EffectPluginStateContract;
    currentParameterValues: Record<string, unknown>;
    storedStateAdapters?: Array<EffectStoredStateAdapter>;
}): EffectPresetV2 {
    const parameters: Record<string, EffectParameterValue> = {};
    const missingEndpointIDs: string[] = [];

    for (const parameter of currentContract.parameters) {
        if (!Object.prototype.hasOwnProperty.call(currentParameterValues, parameter.endpointID)) {
            missingEndpointIDs.push(parameter.endpointID);
            continue;
        }

        parameters[parameter.endpointID] = normalizeParameterValue(parameter, currentParameterValues[parameter.endpointID]);
    }

    if (missingEndpointIDs.length > 0) {
        throw new Error(`Cannot save preset because current values are missing for ${missingEndpointIDs.join(", ")}.`);
    }

    const adaptersByKey = adapterByKey(storedStateAdapters);
    const storedState: Record<string, unknown> = {};

    for (const entry of currentContract.storedState) {
        const adapter = adaptersByKey.get(entry.key);

        if (!adapter || typeof adapter.capture !== "function") {
            throw new Error(`Cannot save preset because stored-state adapter "${entry.key}" is unavailable.`);
        }

        storedState[entry.key] = adapter.serializeForPreset(adapter.normalizeForPreset(adapter.capture()));
    }

    return normalizeEffectPresetV2({
        kind: EFFECT_PRESET_V2_KIND,
        version: EFFECT_PRESET_V2_SCHEMA_VERSION,
        effectID,
        presetID,
        label,
        contract: clonePluginStateContract(currentContract),
        parameters,
        storedState,
    }, { currentContract, storedStateAdapters });
}

export function applyEffectPresetV2({
    preset,
    currentContract,
    patchConnection,
    migrations = [],
    storedStateAdapters = [],
}: ApplyOptions): EffectPresetV2 {
    if (typeof patchConnection.sendEventOrValue !== "function") {
        throw new Error("Cannot apply effect preset because parameter writes are unavailable.");
    }

    const normalizedPreset = normalizeEffectPresetV2(preset, {
        currentContract,
        migrations,
        storedStateAdapters,
    });
    const adaptersByKey = adapterByKey(storedStateAdapters);

    for (const parameter of currentContract.parameters) {
        const endpointID = parameter.endpointID;
        const value = normalizedPreset.parameters[endpointID];
        patchConnection.sendParameterGestureStart?.(endpointID);

        try {
            patchConnection.sendEventOrValue(endpointID, value);
        } finally {
            patchConnection.sendParameterGestureEnd?.(endpointID);
        }
    }

    for (const entry of currentContract.storedState) {
        const adapter = adaptersByKey.get(entry.key);
        const value = normalizedPreset.storedState[entry.key];

        if (adapter?.apply) {
            adapter.apply(adapter.normalizeForPreset(value));
        } else {
            patchConnection.sendStoredStateValue?.(entry.key, value);
        }
    }

    return normalizedPreset;
}

export function parseEffectPresetV2Text(text: string) {
    assertNoDuplicateJsonKeys(text);
    return JSON.parse(text);
}

export function cloneEffectPresetV2(preset: EffectPresetV2): EffectPresetV2 {
    return {
        ...clonePreset(preset),
        contract: JSON.parse(canonicalJSONStringify(preset.contract)),
    };
}
