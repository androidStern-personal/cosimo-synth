/** A value representable by the native JSON state channel. */
export type PluginStateJson = null | boolean | number | string
    | readonly PluginStateJson[] | { readonly [key: string]: PluginStateJson };

/** A parsed domain value or an expected field validation failure. */
export type PluginStateValueResult<Value> =
    | { readonly kind: "ok"; readonly value: Value }
    | { readonly kind: "error"; readonly message: string };

/**
 * Owns parsing, persistence, and equality for one stored domain value.
 * Successful parsing must return an immutable value independent of the input.
 */
export interface PluginStateCodec<Value> {
    /** Parse and take ownership of untrusted input. */
    parse(input: unknown): PluginStateValueResult<Value>;
    /** Encode a parsed domain value for native storage. */
    encode(value: Value): PluginStateJson;
    /** Compare domain values without relying on allocation identity. */
    equals(left: Value, right: Value): boolean;
}

/** Refers to one existing host parameter; its metadata is supplied by the host. */
export interface PluginStateParameter {
    readonly kind: "parameter";
    readonly endpoint: string;
}

/** Immutable configuration for a codec-owned stored field. */
export interface PluginStateStored<Value> {
    readonly kind: "stored";
    readonly initial: PluginStateValueResult<Value>;
    readonly codec: PluginStateCodec<Value>;
}

/** The finite field declarations accepted by a state session. */
export type PluginStateFields = Readonly<Record<string, PluginStateParameter | PluginStateStored<unknown>>>;

/** Infer the domain value of one author declaration. */
export type PluginStateFieldValue<Field> = Field extends PluginStateStored<infer Value> ? Value : number;

/** Declare an existing host parameter without supplying a parallel default. */
export function parameter(endpoint: string): PluginStateParameter {
    return Object.freeze({ kind: "parameter", endpoint });
}

/** Capture a stored field's initial value through the same codec as future edits. */
export function storedValue<Value>(options: {
    readonly initial: Value;
    readonly codec: PluginStateCodec<Value>;
}): PluginStateStored<Value> {
    const codec = Object.freeze({ ...options.codec });
    return Object.freeze({ kind: "stored", initial: codec.parse(options.initial), codec });
}

/** Declare the finite plugin state surface while preserving each field's value type. */
export function definePluginState<const Fields extends PluginStateFields>(fields: Fields): Readonly<Fields> {
    return Object.freeze({ ...fields });
}
