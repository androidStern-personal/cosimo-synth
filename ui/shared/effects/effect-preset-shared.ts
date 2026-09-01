// The pieces of the retired v1 effect-preset system that are still live:
// the "cosimo.effectPreset" v1 wire-format envelope (factory preset data and
// the legacy-to-v2 upgrade path still consume it), the descriptor types the
// test doubles build against, and the duplicate-JSON-key guard shared by the
// v2 preset, snapshot, and sound-share parsers.

export const EFFECT_PRESET_KIND = "cosimo.effectPreset";
export const EFFECT_PRESET_SCHEMA_VERSION = 1;

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
