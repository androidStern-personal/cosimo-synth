export const EFFECT_PRESET_KIND = "cosimo.effectPreset";
export const EFFECT_PRESET_SCHEMA_VERSION = 1;
export const EFFECT_PRESET_STATE_KIND = "cosimo.effectPresetState";
export const EFFECT_PRESET_STATE_SCHEMA_VERSION = 1;

const cmajorEndpointIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type EffectPresetParamDescriptor = {
    type?: "number" | "integer" | "boolean";
    min?: number;
    max?: number;
    defaultValue: number | boolean;
    clamp?: boolean;
};

export type EffectPresetDescriptor = {
    effectID: string;
    label?: string;
    params: Record<string, EffectPresetParamDescriptor>;
};

export type EffectPresetDescriptorRegistry = Record<string, EffectPresetDescriptor>;

export type EffectPresetValue = number | boolean;

export type EffectPreset = {
    kind: typeof EFFECT_PRESET_KIND;
    version: typeof EFFECT_PRESET_SCHEMA_VERSION;
    effectID: string;
    presetID: string;
    label: string;
    values: Record<string, EffectPresetValue>;
};

export type EffectPresetActiveMetadata = {
    presetID: string;
    label: string;
    dirty: boolean;
};

export type EffectPresetState = {
    kind: typeof EFFECT_PRESET_STATE_KIND;
    version: typeof EFFECT_PRESET_STATE_SCHEMA_VERSION;
    userPresets: Record<string, EffectPreset[]>;
    activePresetByEffect: Record<string, EffectPresetActiveMetadata>;
};

export type PatchConnectionLikeForPresetApply = {
    sendParameterGestureStart?: (endpointID: string) => void;
    sendEventOrValue: (endpointID: string, value: unknown) => void;
    sendParameterGestureEnd?: (endpointID: string) => void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object"
        && value !== null
        && !Array.isArray(value);
}

function requireString(value: unknown, fieldName: string) {
    if (typeof value !== "string") {
        throw new Error(`Effect preset ${fieldName} must be a string.`);
    }

    const trimmed = value.trim();

    if (!trimmed) {
        throw new Error(`Effect preset ${fieldName} must not be empty.`);
    }

    return trimmed;
}

function descriptorForEffect(effectID: string, descriptorRegistry: EffectPresetDescriptorRegistry) {
    const descriptor = descriptorRegistry[effectID];

    if (!descriptor) {
        throw new Error(`Unknown effectID "${effectID}".`);
    }

    return descriptor;
}

function normalizeEndpointID(endpointID: string) {
    if (endpointID.includes(".")) {
        throw new Error(`Preset endpoint "${endpointID}" must be a Cmajor identifier, not a dotted path.`);
    }

    if (!cmajorEndpointIdentifierPattern.test(endpointID)) {
        throw new Error(`Preset endpoint "${endpointID}" is not a valid Cmajor identifier.`);
    }

    return endpointID;
}

function normalizeNumberValue(endpointID: string, value: unknown, descriptor: EffectPresetParamDescriptor) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${endpointID} must be a finite number.`);
    }

    let normalized = value;
    const min = descriptor.min;
    const max = descriptor.max;

    if (typeof min === "number" && normalized < min) {
        if (descriptor.clamp) {
            normalized = min;
        } else {
            throw new Error(`${endpointID} value ${normalized} is below minimum ${min}.`);
        }
    }

    if (typeof max === "number" && normalized > max) {
        if (descriptor.clamp) {
            normalized = max;
        } else {
            throw new Error(`${endpointID} value ${normalized} is above maximum ${max}.`);
        }
    }

    return normalized;
}

function normalizeParamValue(endpointID: string, value: unknown, descriptor: EffectPresetParamDescriptor) {
    const type = descriptor.type ?? (typeof descriptor.defaultValue === "boolean" ? "boolean" : "number");

    if (type === "boolean") {
        if (typeof value !== "boolean") {
            throw new Error(`${endpointID} must be a boolean.`);
        }

        return value;
    }

    const normalized = normalizeNumberValue(endpointID, value, descriptor);

    if (type === "integer" && !Number.isInteger(normalized)) {
        throw new Error(`${endpointID} must be an integer.`);
    }

    return normalized;
}

function normalizePresetValues(
    rawValues: unknown,
    descriptor: EffectPresetDescriptor,
) {
    if (!isPlainObject(rawValues)) {
        throw new Error("Effect preset values must be an object.");
    }

    const providedEndpointIDs = Object.keys(rawValues);

    if (providedEndpointIDs.length === 0) {
        throw new Error("Effect preset values must not be empty.");
    }

    const normalizedValues: Record<string, EffectPresetValue> = {};

    for (const endpointID of providedEndpointIDs) {
        const normalizedEndpointID = normalizeEndpointID(endpointID);
        const paramDescriptor = descriptor.params[normalizedEndpointID];

        if (!paramDescriptor) {
            throw new Error(`Unknown endpoint "${normalizedEndpointID}" for effect "${descriptor.effectID}".`);
        }
    }

    for (const endpointID of Object.keys(descriptor.params)) {
        if (Object.prototype.hasOwnProperty.call(rawValues, endpointID)) {
            normalizedValues[endpointID] = normalizeParamValue(endpointID, rawValues[endpointID], descriptor.params[endpointID]);
        }
    }

    return normalizedValues;
}

export function normalizeEffectPreset(
    payload: unknown,
    descriptorRegistry: EffectPresetDescriptorRegistry,
): EffectPreset {
    if (!isPlainObject(payload)) {
        throw new Error("Effect preset payload must be an object.");
    }

    if (payload.kind !== EFFECT_PRESET_KIND) {
        throw new Error(`Effect preset kind must be "${EFFECT_PRESET_KIND}".`);
    }

    if (payload.version !== EFFECT_PRESET_SCHEMA_VERSION) {
        throw new Error(`Unsupported effect preset version "${String(payload.version)}".`);
    }

    const effectID = requireString(payload.effectID, "effectID");
    const presetID = requireString(payload.presetID, "presetID");
    const label = requireString(payload.label, "label");
    const descriptor = descriptorForEffect(effectID, descriptorRegistry);

    return {
        kind: EFFECT_PRESET_KIND,
        version: EFFECT_PRESET_SCHEMA_VERSION,
        effectID,
        presetID,
        label,
        values: normalizePresetValues(payload.values, descriptor),
    };
}

export function validateEffectPreset(
    payload: unknown,
    descriptorRegistry: EffectPresetDescriptorRegistry,
) {
    try {
        return {
            ok: true as const,
            preset: normalizeEffectPreset(payload, descriptorRegistry),
            error: null,
        };
    } catch (error) {
        return {
            ok: false as const,
            preset: null,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

export function captureEffectPreset({
    effectID,
    presetID,
    label,
    currentValues,
    descriptorRegistry,
}: {
    effectID: string;
    presetID: string;
    label: string;
    currentValues: Record<string, unknown>;
    descriptorRegistry: EffectPresetDescriptorRegistry;
}) {
    const descriptor = descriptorForEffect(effectID, descriptorRegistry);
    const values: Record<string, EffectPresetValue> = {};

    for (const endpointID of Object.keys(descriptor.params)) {
        if (Object.prototype.hasOwnProperty.call(currentValues, endpointID)) {
            values[endpointID] = currentValues[endpointID] as EffectPresetValue;
        }
    }

    return normalizeEffectPreset({
        kind: EFFECT_PRESET_KIND,
        version: EFFECT_PRESET_SCHEMA_VERSION,
        effectID,
        presetID,
        label,
        values,
    }, descriptorRegistry);
}

export function applyEffectPreset({
    patchConnection,
    preset,
    descriptorRegistry,
}: {
    patchConnection: PatchConnectionLikeForPresetApply;
    preset: unknown;
    descriptorRegistry: EffectPresetDescriptorRegistry;
}) {
    const normalizedPreset = normalizeEffectPreset(preset, descriptorRegistry);

    for (const [endpointID, value] of Object.entries(normalizedPreset.values)) {
        patchConnection.sendParameterGestureStart?.(endpointID);

        try {
            patchConnection.sendEventOrValue(endpointID, value);
        } finally {
            patchConnection.sendParameterGestureEnd?.(endpointID);
        }
    }

    return normalizedPreset;
}

export function createDefaultEffectPresetState(): EffectPresetState {
    return {
        kind: EFFECT_PRESET_STATE_KIND,
        version: EFFECT_PRESET_STATE_SCHEMA_VERSION,
        userPresets: {},
        activePresetByEffect: {},
    };
}

function requireBoolean(value: unknown, fieldName: string) {
    if (typeof value !== "boolean") {
        throw new Error(`Effect preset ${fieldName} must be a boolean.`);
    }

    return value;
}

export function createActivePresetMetadataFromPreset(preset: EffectPreset): EffectPresetActiveMetadata {
    return {
        presetID: preset.presetID,
        label: preset.label,
        dirty: false,
    };
}

function normalizeActivePresetMetadata(
    effectID: string,
    rawMetadata: unknown,
): EffectPresetActiveMetadata {
    if (!isPlainObject(rawMetadata)) {
        throw new Error(`Active preset metadata for "${effectID}" must be an object.`);
    }

    const allowedKeys = new Set(["presetID", "label", "dirty"]);

    for (const key of Object.keys(rawMetadata)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`Active preset metadata for "${effectID}" contains unknown field "${key}".`);
        }
    }

    return {
        presetID: requireString(rawMetadata.presetID, `activePresetByEffect.${effectID}.presetID`),
        label: requireString(rawMetadata.label, `activePresetByEffect.${effectID}.label`),
        dirty: requireBoolean(rawMetadata.dirty, `activePresetByEffect.${effectID}.dirty`),
    };
}

export function normalizeEffectPresetState(
    payload: unknown,
    descriptorRegistry: EffectPresetDescriptorRegistry,
): EffectPresetState {
    if (!isPlainObject(payload)) {
        throw new Error("Effect preset state payload must be an object.");
    }

    if (payload.kind !== EFFECT_PRESET_STATE_KIND) {
        throw new Error(`Effect preset state kind must be "${EFFECT_PRESET_STATE_KIND}".`);
    }

    if (payload.version !== EFFECT_PRESET_STATE_SCHEMA_VERSION) {
        throw new Error(`Unsupported effect preset state version "${String(payload.version)}".`);
    }

    const rawUserPresets = payload.userPresets;
    const rawActivePresetByEffect = payload.activePresetByEffect;
    const userPresets: Record<string, EffectPreset[]> = {};
    const activePresetByEffect: Record<string, EffectPresetActiveMetadata> = {};

    if (!isPlainObject(rawUserPresets)) {
        throw new Error("Effect preset state userPresets must be an object.");
    }

    for (const [effectID, presets] of Object.entries(rawUserPresets)) {
        descriptorForEffect(effectID, descriptorRegistry);

        if (!Array.isArray(presets)) {
            throw new Error(`Effect preset bank "${effectID}" must be an array.`);
        }

        userPresets[effectID] = presets.map((preset) => {
            const normalizedPreset = normalizeEffectPreset(preset, descriptorRegistry);

            if (normalizedPreset.effectID !== effectID) {
                throw new Error(`Effect preset bank "${effectID}" contains preset "${normalizedPreset.presetID}" for effect "${normalizedPreset.effectID}".`);
            }

            return normalizedPreset;
        });
    }

    if (!isPlainObject(rawActivePresetByEffect)) {
        throw new Error("Effect preset state activePresetByEffect must be an object.");
    }

    for (const [effectID, activePreset] of Object.entries(rawActivePresetByEffect)) {
        descriptorForEffect(effectID, descriptorRegistry);
        activePresetByEffect[effectID] = normalizeActivePresetMetadata(effectID, activePreset);
    }

    return {
        kind: EFFECT_PRESET_STATE_KIND,
        version: EFFECT_PRESET_STATE_SCHEMA_VERSION,
        userPresets,
        activePresetByEffect,
    };
}

export function serializeEffectPresetState(
    state: EffectPresetState,
    descriptorRegistry: EffectPresetDescriptorRegistry,
) {
    return JSON.stringify(normalizeEffectPresetState(state, descriptorRegistry));
}

export function deserializeEffectPresetState(
    rawValue: unknown,
    descriptorRegistry: EffectPresetDescriptorRegistry,
) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return createDefaultEffectPresetState();
    }

    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    return normalizeEffectPresetState(parsed, descriptorRegistry);
}

export function assertNoDuplicateJsonKeys(jsonText: string) {
    const stack: Array<{
        keys: Set<string>;
        expectingKey: boolean;
    }> = [];
    let index = 0;

    const skipWhitespace = () => {
        while (index < jsonText.length && /\s/.test(jsonText[index])) {
            index += 1;
        }
    };

    const readString = () => {
        const start = index;
        index += 1;

        while (index < jsonText.length) {
            const char = jsonText[index];

            if (char === "\"") {
                index += 1;
                return JSON.parse(jsonText.slice(start, index)) as string;
            }

            if (char === "\\") {
                index += 1;

                if (index < jsonText.length) {
                    index += 1;
                }

                continue;
            }

            index += 1;
        }

        throw new Error("Invalid JSON string.");
    };

    while (index < jsonText.length) {
        skipWhitespace();

        const char = jsonText[index];

        if (char === "{") {
            stack.push({ keys: new Set(), expectingKey: true });
            index += 1;
            continue;
        }

        if (char === "}") {
            stack.pop();
            index += 1;
            continue;
        }

        if (char === ",") {
            const current = stack[stack.length - 1];
            if (current) {
                current.expectingKey = true;
            }
            index += 1;
            continue;
        }

        if (char === ":") {
            const current = stack[stack.length - 1];
            if (current) {
                current.expectingKey = false;
            }
            index += 1;
            continue;
        }

        if (char === "\"") {
            const value = readString();
            const current = stack[stack.length - 1];
            skipWhitespace();

            if (current?.expectingKey && jsonText[index] === ":") {
                if (current.keys.has(value)) {
                    throw new Error(`Duplicate JSON key "${value}".`);
                }

                current.keys.add(value);
            }

            continue;
        }

        index += 1;
    }
}
