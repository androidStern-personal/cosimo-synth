import { preparedState, type PluginStateCodec, type PluginStateJson, type PluginStateStored, type PluginStateValueResult } from "./plugin-state-definition";
import { sharedData } from "./shared-data-delivery";
import { isNativeIdentifier } from "./native-identifiers";

export type NativeLayout =
    | { readonly kind: "float32"; readonly min: number; readonly max: number }
    | { readonly kind: "bool" }
    | { readonly kind: "enum"; readonly choices: readonly string[] }
    | { readonly kind: "record"; readonly fields: Readonly<Record<string, NativeLayout>> };

/** Finite declarative codecs can generate matching C++ types and validation. */
export interface NativeCodec<Value> extends PluginStateCodec<Value> {
    readonly layout: NativeLayout;
    readonly words: number;
    write(value: Value, destination: DataView, wordOffset: number): void;
}

function scalar<Value>(layout: NativeLayout, parse: PluginStateCodec<Value>["parse"],
    encode: (value: Value) => PluginStateJson, write: NativeCodec<Value>["write"]): NativeCodec<Value> {
    return Object.freeze({ layout: Object.freeze(layout), words: 1, parse, encode, equals: Object.is, write });
}

/** A finite float32, with the same representable bounds in JavaScript and C++. */
export function number(options: { readonly min?: number; readonly max?: number } = {}): NativeCodec<number> {
    const min = Math.fround(options.min ?? -3.4028234663852886e38), max = Math.fround(options.max ?? 3.4028234663852886e38);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error("Invalid native number bounds.");
    return scalar({ kind: "float32", min, max }, value => {
        const parsed = typeof value === "number" ? Math.fround(value) : NaN;
        return Number.isFinite(parsed) && parsed >= min && parsed <= max ? { kind: "ok", value: parsed }
            : { kind: "error", message: "Native number is outside its finite range." };
    }, value => value, (value, destination, offset) => destination.setFloat32(offset * 4, value, true));
}

export function boolean(): NativeCodec<boolean> {
    return scalar({ kind: "bool" }, value => typeof value === "boolean" ? { kind: "ok", value }
        : { kind: "error", message: "Expected a boolean." }, value => value,
    (value, destination, offset) => destination.setInt32(offset * 4, value ? 1 : 0, true));
}

export function choice<const Choices extends readonly string[]>(choices: Choices): NativeCodec<Choices[number]> {
    const captured = Object.freeze([...choices]);
    if (!captured.length || new Set(captured).size !== captured.length || captured.some(value => !isNativeIdentifier(value)))
        throw new Error("Native choices require distinct C++ identifiers.");
    return scalar({ kind: "enum", choices: captured }, value => {
        const match = captured.find(candidate => candidate === value);
        return match === undefined ? { kind: "error", message: "Unknown native choice." } : { kind: "ok", value: match };
    }, value => value, (value, destination, offset) => destination.setInt32(offset * 4, captured.indexOf(value), true));
}

type RecordValue<Fields> = { readonly [Key in keyof Fields]: Fields[Key] extends NativeCodec<infer Value> ? Value : never };

export function record<const Fields extends Readonly<Record<string, NativeCodec<unknown>>>>(fields: Fields): NativeCodec<RecordValue<Fields>> {
    const entries = Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    if (!entries.length || entries.some(([key]) => !isNativeIdentifier(key))) throw new Error("Native record fields require non-reserved C++ identifiers.");
    const words = entries.reduce((total, [, field]) => total + field.words, 0);
    if (words > 256) throw new Error("Native settings records are limited to 256 words; use preparedState for larger data.");
    return Object.freeze({
        layout: Object.freeze({ kind: "record", fields: Object.freeze(Object.fromEntries(entries.map(([key, field]) => [key, field.layout]))) }),
        words,
        parse(input: unknown): PluginStateValueResult<RecordValue<Fields>> {
            if (input === null || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== entries.length)
                return { kind: "error", message: "Native record fields do not match the declaration." };
            const value: Record<string, unknown> = {};
            for (const [key, field] of entries) {
                if (!Object.prototype.hasOwnProperty.call(input, key))
                    return { kind: "error", message: "Native record fields do not match the declaration." };
                const parsed = field.parse(Reflect.get(input, key));
                if (parsed.kind !== "ok") return parsed;
                value[key] = parsed.value;
            }
            // SAFETY: each declared member was independently parsed by its own
            // codec above; no raw serialized member enters this mapped value.
            return { kind: "ok", value: Object.freeze(value) as RecordValue<Fields> };
        },
        encode(value: RecordValue<Fields>) { return Object.fromEntries(entries.map(([key, field]) => [key, field.encode(value[key])])); },
        equals(a: RecordValue<Fields>, b: RecordValue<Fields>) { return entries.every(([key, field]) => field.equals(a[key], b[key])); },
        write(value: RecordValue<Fields>, destination: DataView, offset: number) {
            for (const [key, field] of entries) { field.write(value[key], destination, offset); offset += field.words; }
        },
    });
}

/** A small typed native setting with the same values, Undo and error API. */
export function nativeValue<Value>(options: {
    readonly codec: NativeCodec<Value>; readonly initial: Value;
    readonly lifetime?: "project" | "instance"; readonly history?: boolean;
}): PluginStateStored<Value> {
    const field = preparedState({ ...options,
        engine: sharedData({ type: "bytes", length: options.codec.words * 4 }),
        prepare(value, destination) { options.codec.write(value, new DataView(destination.buffer, destination.byteOffset, destination.byteLength), 0); },
    });
    if (field.initial.kind !== "ok") throw new Error(field.initial.message);
    if (field.engine?.kind !== "shared-prepared") throw new Error("Native settings require shared preparation.");
    return Object.freeze({ ...field, engine: Object.freeze({ ...field.engine, native: Object.freeze({ layout: options.codec.layout, initial: options.codec.encode(field.initial.value) }) }) });
}
