// Everything a state definition needs to declare presets. The hooks live in use-presets.ts, so a
// state.ts that spreads presets() keeps React out of the generated state worker.
import {
    definitionCheck, definitionInitial, soundFieldKeys, storedValue,
    type PluginStateCodec, type PluginStateFields, type PluginStateJson, type PluginStateParameter, type PluginStateStored, type PluginStateValueResult,
} from "./plugin-state-definition";
import type { PluginStateEditResult } from "./plugin-state-react";

/** Values keyed by sound field, in each field's saved (encoded) form. */
export type SoundValues = Readonly<Record<string, PluginStateJson>>;

/** One named sound. */
export interface Preset {
    readonly id: string;
    readonly name: string;
    readonly values: SoundValues;
}

/** The user's saved presets, shared by every project. */
export interface PresetLibrary {
    readonly version: 1;
    readonly presets: readonly Preset[];
}

/** A preset shipped with the plugin; values use the same form as `editor.edit`. */
export interface FactoryPreset {
    readonly id: string;
    readonly name: string;
    readonly values: Readonly<Record<string, unknown>>;
}

/** The preset library field, which also carries the plugin's factory presets. */
export type PresetLibraryField = PluginStateStored<PresetLibrary> & { readonly factory: readonly FactoryPreset[] };

/** Every preset and snapshot action settles to one of these; `message` says what to do next. */
export type PresetActionResult = { readonly kind: "done" } | { readonly kind: "failed"; readonly message: string };

/** The file written by Copy JSON and read by Paste JSON. */
export interface PresetFile {
    readonly kind: "builder-kit.preset";
    readonly version: 1;
    readonly plugin: string;
    readonly name: string;
    readonly values: SoundValues;
}

const ok = <Value>(value: Value): PluginStateValueResult<Value> => ({ kind: "ok", value });
const invalid = (message: string): PluginStateValueResult<never> => ({ kind: "error", message });
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** An immutable copy of JSON data, or undefined when the input is not JSON. */
export function frozenJson(input: unknown): PluginStateJson | undefined {
    if (input === null || typeof input === "boolean" || typeof input === "string") return input;
    if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
    if (Array.isArray(input)) {
        const items: PluginStateJson[] = [];
        for (const item of input) {
            const copy = frozenJson(item);
            if (copy === undefined) return undefined;
            items.push(copy);
        }
        return Object.freeze(items);
    }
    if (!isRecord(input)) return undefined;
    const prototype: unknown = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const record: Record<string, PluginStateJson> = {};
    for (const [key, value] of Object.entries(input)) {
        const copy = frozenJson(value);
        if (copy === undefined) return undefined;
        record[key] = copy;
    }
    return Object.freeze(record);
}

/** Structural equality for JSON data, independent of key order. */
export function jsonEqual(left: PluginStateJson, right: PluginStateJson): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right))
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => jsonEqual(item, right[index]));
    if (!isRecord(left) || !isRecord(right)) return false;
    // SAFETY: both sides are JSON objects, so every member is JSON.
    const leftRecord = left as Readonly<Record<string, PluginStateJson>>, rightRecord = right as Readonly<Record<string, PluginStateJson>>;
    const keys = Object.keys(leftRecord);
    return keys.length === Object.keys(rightRecord).length
        && keys.every(key => Object.hasOwn(rightRecord, key) && jsonEqual(leftRecord[key], rightRecord[key]));
}

function parseValues(input: unknown): PluginStateValueResult<SoundValues> {
    const values = isRecord(input) ? frozenJson(input) : undefined;
    return values !== undefined && isRecord(values) ? ok(values as SoundValues) : invalid("Preset values must be an object of JSON values.");
}

function parsePreset(input: unknown): PluginStateValueResult<Preset> {
    if (!isRecord(input) || typeof input.id !== "string" || input.id.length === 0 || typeof input.name !== "string" || input.name.trim().length === 0)
        return invalid("A preset needs a non-empty id and name.");
    const values = parseValues(input.values);
    return values.kind === "ok" ? ok(Object.freeze({ id: input.id, name: input.name, values: values.value })) : values;
}

const presetLibraryCodec: PluginStateCodec<PresetLibrary> = {
    parse(input) {
        if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.presets)) return invalid("Expected a version 1 preset library.");
        const presets: Preset[] = [];
        for (const item of input.presets) {
            const preset = parsePreset(item);
            if (preset.kind === "error") return preset;
            if (presets.some(existing => existing.id === preset.value.id)) return invalid(`Preset id "${preset.value.id}" appears twice.`);
            presets.push(preset.value);
        }
        return ok(Object.freeze({ version: 1, presets: Object.freeze(presets) }));
    },
    encode: library => library as unknown as PluginStateJson,
    equals: (left, right) => jsonEqual(left as unknown as PluginStateJson, right as unknown as PluginStateJson),
};

const activePresetCodec: PluginStateCodec<Preset | null> = {
    parse: input => input === null ? ok(null) : parsePreset(input),
    encode: preset => preset as unknown as PluginStateJson,
    equals: (left, right) => jsonEqual(left as unknown as PluginStateJson, right as unknown as PluginStateJson),
};

/** Check one value for a sound field and return its saved form. */
export function encodeSoundValue(field: PluginStateParameter | PluginStateStored<unknown>, value: unknown): PluginStateValueResult<PluginStateJson> {
    if (field.kind === "parameter")
        return typeof value === "number" && Number.isFinite(value) ? ok(value) : invalid("Expected a finite number.");
    const parsed = field.codec.parse(value);
    return parsed.kind === "ok" ? ok(field.codec.encode(parsed.value)) : parsed;
}

/** Hosts store parameters as 32-bit floats, so a restored project reads back a nearby value. */
export function sameSoundValue(field: PluginStateParameter | PluginStateStored<unknown>, saved: PluginStateJson, current: unknown): boolean {
    if (field.kind === "parameter")
        return typeof saved === "number" && typeof current === "number" && Math.fround(saved) === Math.fround(current);
    const parsed = field.codec.parse(saved);
    return parsed.kind === "ok" && field.codec.equals(parsed.value, current);
}

function checkFactoryPresets(factory: readonly FactoryPreset[], initial: string | undefined, fields: PluginStateFields) {
    if (initial !== undefined && !factory.some(preset => preset.id === initial))
        throw new Error(`The initial preset "${initial}" is not a factory preset. Use the id of one of the factory presets.`);
    const sound = soundFieldKeys(fields);
    const ids = new Set<string>();
    for (const preset of factory) {
        if (typeof preset.id !== "string" || preset.id.length === 0 || typeof preset.name !== "string" || preset.name.trim().length === 0)
            throw new Error("Every factory preset needs a non-empty id and name.");
        if (ids.has(preset.id)) throw new Error(`Factory preset id "${preset.id}" is used twice. Give each factory preset its own id.`);
        ids.add(preset.id);
        for (const key of Object.keys(preset.values)) {
            if (!sound.includes(key))
                throw new Error(`Factory preset "${preset.name}" sets "${key}", which is not a sound field. Remove it or correct the field name.`);
        }
        for (const key of sound) {
            const field = fields[key];
            if (!field) continue;
            if (!Object.hasOwn(preset.values, key))
                throw new Error(`Factory preset "${preset.name}" is missing "${key}". Give it a value, or declare the field with preset: false.`);
            const value = encodeSoundValue(field, preset.values[key]);
            if (value.kind === "error") throw new Error(`Factory preset "${preset.name}" has an invalid value for "${key}": ${value.message}`);
        }
    }
}

/**
 * Declare presets. Spread the result into `definePluginState`: it adds `presetLibrary`, the
 * user's presets shared across projects, and `activePreset`, the project's current preset.
 * `initial` names the factory preset a project starts with; without it no preset is active
 * until the user recalls one.
 */
export function presets(options: { readonly factory?: readonly FactoryPreset[]; readonly initial?: string } = {}) {
    const factory = Object.freeze((options.factory ?? []).map(preset => Object.freeze({ ...preset, values: Object.freeze({ ...preset.values }) })));
    const { initial } = options;
    const library: PresetLibraryField = Object.freeze({
        ...storedValue<PresetLibrary>({ codec: presetLibraryCodec, initial: { version: 1, presets: [] }, lifetime: "user", preset: false }),
        factory,
        [definitionCheck]: (fields: PluginStateFields) => checkFactoryPresets(factory, initial, fields),
    });
    const activePreset = storedValue<Preset | null>({ codec: activePresetCodec, initial: null, preset: false });
    const initialPreset = factory.find(preset => preset.id === initial);
    return {
        presetLibrary: library,
        // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
        activePreset: initialPreset === undefined ? activePreset : Object.freeze({
            ...activePreset,
            [definitionInitial]: (fields: PluginStateFields) =>
                activePresetCodec.parse({ id: initialPreset.id, name: initialPreset.name, values: factoryValues(fields, initialPreset) }),
        }),
    };
}

/** The text of a preset file. */
export function presetFileText(plugin: string, preset: { readonly name: string; readonly values: SoundValues }): string {
    const file: PresetFile = { kind: "builder-kit.preset", version: 1, plugin, name: preset.name, values: preset.values };
    return `${JSON.stringify(file, null, 2)}\n`;
}

/** Read a preset file for this plugin; every value must belong to a sound field. */
export function parsePresetFile(text: string, plugin: string, fields: PluginStateFields): PluginStateValueResult<{ readonly name: string; readonly values: SoundValues }> {
    let input: unknown;
    try { input = JSON.parse(text); }
    catch { return invalid("This is not a preset file: it is not valid JSON."); }
    if (!isRecord(input) || input.kind !== "builder-kit.preset" || input.version !== 1)
        return invalid("This is not a Builder Kit preset file.");
    if (input.plugin !== plugin)
        return invalid(`This preset is for the plugin "${String(input.plugin)}", not "${plugin}".`);
    if (typeof input.name !== "string" || input.name.trim().length === 0) return invalid("The preset file has no name.");
    if (!isRecord(input.values)) return invalid("The preset file has no values.");
    const sound = soundFieldKeys(fields);
    const values: Record<string, PluginStateJson> = {};
    for (const [key, value] of Object.entries(input.values)) {
        const field = fields[key];
        if (!field || !sound.includes(key)) return invalid(`The preset sets "${key}", which this plugin does not keep in presets.`);
        const encoded = encodeSoundValue(field, value);
        if (encoded.kind === "error") return invalid(`The preset has an invalid value for "${key}": ${encoded.message}`);
        values[key] = encoded.value;
    }
    return ok(Object.freeze({ name: input.name.trim(), values: Object.freeze(values) }));
}

/** Only sound fields are recalled; keys from older plugin versions are ignored. */
export function soundChanges(definition: PluginStateFields, values: SoundValues): Record<string, unknown> {
    const sound = soundFieldKeys(definition);
    return Object.fromEntries(Object.entries(values).filter(([key]) => sound.includes(key)));
}

/** Explain a rejected or interrupted state edit in terms of what the user can do. */
export function editOutcome(result: PluginStateEditResult): PresetActionResult {
    if (result.kind === "accepted") return { kind: "done" };
    if (result.kind === "interrupted") return { kind: "failed", message: "The plugin connection was interrupted. Check the sound, then try again." };
    switch (result.reason) {
        case "stale-version": return { kind: "failed", message: "The sound changed at the same moment. Try again." };
        case "busy": return { kind: "failed", message: "Finish the current adjustment, then try again." };
        case "not-ready": return { kind: "failed", message: "The plugin is still loading. Try again in a moment." };
        case "invalid-value": return { kind: "failed", message: "The plugin cannot use these values. The data may be too large or from an incompatible version." };
        default: return { kind: "failed", message: "The plugin closed or reloaded. Try again." };
    }
}

const factoryCache = new WeakMap<FactoryPreset, SoundValues>();
/** Factory values in saved form; definePluginState has already checked them. */
export function factoryValues(definition: PluginStateFields, preset: FactoryPreset): SoundValues {
    let values = factoryCache.get(preset);
    if (!values) {
        const encoded: Record<string, PluginStateJson> = {};
        for (const [key, value] of Object.entries(preset.values)) {
            const field = definition[key], result = field && encodeSoundValue(field, value);
            if (result?.kind === "ok") encoded[key] = result.value;
        }
        values = Object.freeze(encoded);
        factoryCache.set(preset, values);
    }
    return values;
}
