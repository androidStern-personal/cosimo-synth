import type { EngineCancellation } from "./plugin-state-engine";
import type { EngineOutcome } from "./plugin-state-engine";
import type { CmajorStateEffect, CmajorStateSubmission } from "./plugin-state-cmajor";

/** A declared engine effect, without access to editable state or client identities. */
export type PluginStateEffect = CmajorStateEffect;
/** Synchronous handoff and its separately correlated native processing receipt. */
export type PluginStateSubmission = CmajorStateSubmission;
/** Delivery evidence must distinguish native processing from engine acknowledgement. */
export type PluginStateDeliveryOutcome = EngineOutcome;

/** Resources limited to one prepared delivery's lifetime. */
export interface PluginStateDeliveryContext {
    readonly signal: EngineCancellation;
    send(effect: PluginStateEffect): PluginStateSubmission;
    /** Listen only to a declared output; automatically removed when delivery ends. */
    listen(endpoint: string, listener: (value: unknown) => void): () => void;
}

/** A reusable engine implementation instantiated by the generated worker. */
export interface PluginStateDelivery<Payload> {
    readonly eventEndpoints: readonly string[];
    readonly outputEndpoints?: readonly string[];
    readonly hostEffects?: readonly string[];
    /** Finish permits an in-flight same-document delivery before the newest queued value. */
    readonly replacement?: "supersede" | "finish";
    create(): {
        apply(payload: Payload, context: PluginStateDeliveryContext): Promise<PluginStateDeliveryOutcome>;
        stop(): void;
    };
}

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

/** Captured scalar inputs and portable cancellation for pure event preparation. */
export interface PluginStatePrepareContext {
    readonly parameters: Readonly<Record<string, number>>;
    readonly signal: EngineCancellation;
}

/** Prepare an event payload from one accepted field value, without messaging APIs. */
export interface PluginStateEventValue<Value> {
    readonly kind: "event-value";
    readonly endpoint: string;
    readonly dependencies: readonly string[];
    /** Return a pure payload; the platform adapter owns JSON conversion and delivery. */
    prepare(value: Value, context: PluginStatePrepareContext): unknown | Promise<unknown>;
}

/** Preparation and its matching delivery remain paired inside the stored declaration. */
export interface PluginStatePreparedValue<Value, Payload = unknown> {
    readonly kind: "prepared";
    readonly dependencies: readonly string[];
    prepare(value: Value, context: PluginStatePrepareContext): Payload | Promise<Payload>;
    readonly delivery: PluginStateDelivery<Payload>;
}

/** Declare an event endpoint and the parameter field keys captured by preparation. */
export function eventValue<Value>(endpoint: string, prepare: PluginStateEventValue<Value>["prepare"], options: {
    readonly dependencies?: readonly string[];
} = {}): PluginStateEventValue<Value> {
    return Object.freeze({ kind: "event-value", endpoint, prepare, dependencies: Object.freeze([...(options.dependencies ?? [])]) });
}

/** Immutable configuration for a codec-owned stored field. */
export interface PluginStateStored<Value, Payload = unknown> {
    readonly kind: "stored";
    readonly initial: PluginStateValueResult<Value>;
    readonly codec: PluginStateCodec<Value>;
    readonly engine?: PluginStateEventValue<Value> | PluginStatePreparedValue<Value, Payload>;
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
    readonly engine?: PluginStateEventValue<Value>;
}): PluginStateStored<Value> {
    const codec = Object.freeze({ ...options.codec });
    return Object.freeze({ kind: "stored", initial: codec.parse(options.initial), codec, ...(options.engine ? { engine: options.engine } : {}) });
}

/** Store editable values through a full codec and prepare a separate engine representation. */
export function preparedState<Value, Payload>(options: {
    readonly schema: PluginStateCodec<Value>;
    readonly initial: Value;
    readonly prepare: (value: Value, context: PluginStatePrepareContext) => Payload | Promise<Payload>;
    readonly engine: PluginStateDelivery<Payload>;
    readonly dependencies?: readonly string[];
}): PluginStateStored<Value, Payload> {
    const stored = storedValue({ initial: options.initial, codec: options.schema });
    return Object.freeze({ ...stored, engine: Object.freeze({ kind: "prepared" as const,
        dependencies: Object.freeze([...(options.dependencies ?? [])]),
        prepare: options.prepare, delivery: options.engine,
    }) });
}

/** Declare the finite plugin state surface while preserving each field's value type. */
export function definePluginState<const Fields extends PluginStateFields>(fields: Fields): Readonly<Fields> {
    return Object.freeze({ ...fields });
}
