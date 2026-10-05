import type { EngineApplication, EngineCancellation } from "./plugin-state-engine";
import type { EngineOutcome } from "./plugin-state-engine";
import type { CmajorStateEffect, CmajorStateSubmission } from "./plugin-state-cmajor";
import { isNativeIdentifier } from "./native-identifiers";
import type { SharedDataDefinition, SharedDataFormat, SharedDataView } from "./shared-data-delivery";

/** Expected resource failures leave other fields and Undo available. */
export interface PluginStatePreparationFailure {
    readonly kind: "preparation-error";
    readonly error: { readonly kind: "resource"; readonly message: string };
}

export function preparationFailure(message: string): PluginStatePreparationFailure {
    return Object.freeze({ kind: "preparation-error", error: Object.freeze({ kind: "resource", message }) });
}

export function isPreparationFailure(value: unknown): value is PluginStatePreparationFailure {
    return typeof value === "object" && value !== null && "kind" in value && value.kind === "preparation-error"
        && "error" in value && typeof value.error === "object" && value.error !== null
        && "kind" in value.error && value.error.kind === "resource"
        && "message" in value.error && typeof value.error.message === "string";
}

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

/** Capabilities retained by one field delivery until its project document closes. */
export interface PluginStateDocumentContext {
    readonly signal: EngineCancellation;
    send(effect: PluginStateEffect): PluginStateSubmission;
    listen(endpoint: string, listener: (value: unknown) => void): () => void;
    readStored(key: string): Promise<unknown>;
    subscribeStored(key: string, listener: (value: unknown) => void): () => void;
    /** Fill the actual DSP allocation; completion proves audio adoption. */
    prepareData(input: number, byteLength: number,
        writer: (destination: import("./plugin-state-direct-data").SharedDataDestination) => void | PluginStatePreparationFailure,
        signal?: EngineCancellation): Promise<PluginStateDeliveryOutcome>;
    report(status: EngineApplication): void;
    /** Retain an unexpected programming failure and close the owning service. */
    fail(error: unknown): void;
}

/** A reusable engine implementation instantiated by the generated worker. */
export interface PluginStateDelivery<Payload> {
    readonly eventEndpoints: readonly string[];
    readonly outputEndpoints?: readonly string[];
    readonly storedKeys?: readonly string[];
    readonly hostEffects?: readonly string[];
    readonly dataInputs?: readonly number[];
    /** Finish permits an in-flight same-document delivery before the newest queued value. */
    readonly replacement?: "supersede" | "finish";
    create(document: PluginStateDocumentContext): {
        apply(payload: Payload, context: PluginStateDeliveryContext): Promise<PluginStateDeliveryOutcome>;
        stop(): void | Promise<void>;
    };
}

/** The defect message for an author codec that throws while handling one edit, which is then rejected. */
export function codecThrewMessage(key: string): string {
    return `The codec for "${key}" threw instead of returning { kind: "error" }; the edit was rejected.`;
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
    readonly history?: boolean;
    /** `false` keeps the field out of presets and snapshots. */
    readonly preset?: false;
}

/**
 * Why a value is being prepared: `load` when the plugin opens or the host loads a project,
 * `recall` when a preset or snapshot replaces the sound, `history` for Undo and Redo,
 * and `edit` for every other change, including host automation of a dependency.
 */
export type PluginStateChangeReason = "load" | "recall" | "history" | "edit";

/** Captured scalar inputs and portable cancellation for pure event preparation. */
export interface PluginStatePrepareContext {
    readonly resources: import("./resource-client").ResourceClient;
    readonly parameters: Readonly<Record<string, number>>;
    readonly reason: PluginStateChangeReason;
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
    prepare(value: Value, context: PluginStatePrepareContext): Payload | PluginStatePreparationFailure | Promise<Payload | PluginStatePreparationFailure>;
    readonly delivery: PluginStateDelivery<Payload>;
}

/** Per-operation loaded source stays captured by a synchronous final-allocation writer. */
export interface PluginStateSharedPlan<Format extends SharedDataFormat = SharedDataFormat> {
    readonly length: number;
    readonly write: (destination: SharedDataView<Format>) => void | PluginStatePreparationFailure;
}

/** The writer owns the supplied view only until its synchronous return. */
export interface PluginStateSharedValue<Value> {
    readonly kind: "shared-prepared";
    readonly dependencies: readonly string[];
    readonly storage: { readonly type: SharedDataFormat; readonly fixedLength: number | null };
    readonly native?: { readonly layout: import("./native-value").NativeLayout; readonly initial: PluginStateJson };
    prepare(value: Value, context: PluginStatePrepareContext): PluginStateSharedPlan | PluginStatePreparationFailure | Promise<PluginStateSharedPlan | PluginStatePreparationFailure>;
}

/** Declare an event endpoint and the parameter field keys captured by preparation. */
export function eventValue<Value>(endpoint: string, prepare: PluginStateEventValue<Value>["prepare"], options: {
    readonly dependencies?: readonly string[];
} = {}): PluginStateEventValue<Value> {
    return Object.freeze({ kind: "event-value", endpoint, prepare, dependencies: Object.freeze([...(options.dependencies ?? [])]) });
}

/**
 * Where a stored value lives: `project` is saved with the host project, `instance`
 * survives GUI closure but is never saved, and `user` is shared by every instance
 * of the plugin through the user's files.
 */
export type PluginStateLifetime = "project" | "instance" | "user";

/** Lets a kit-provided field reject a definition it cannot work in. */
export const definitionCheck: unique symbol = Symbol.for("builder-kit.plugin-state.definition-check");

/** Immutable configuration for a codec-owned stored field. */
export interface PluginStateStored<Value, Payload = unknown> {
    readonly kind: "stored";
    readonly initial: PluginStateValueResult<Value>;
    readonly codec: PluginStateCodec<Value>;
    readonly engine?: PluginStateEventValue<Value> | PluginStatePreparedValue<Value, Payload> | PluginStateSharedValue<Value>;
    readonly lifetime?: PluginStateLifetime;
    readonly history?: boolean;
    /** `false` keeps the field out of presets and snapshots. */
    readonly preset?: false;
    readonly [definitionCheck]?: (fields: PluginStateFields) => void;
}

/** The finite field declarations accepted by a state session. */
export type PluginStateFields = Readonly<Record<string, PluginStateParameter | PluginStateStored<unknown>>>;

/** Infer the domain value of one author declaration. */
export type PluginStateFieldValue<Field> = Field extends PluginStateStored<infer Value> ? Value : number;

/** Declare an existing host parameter without supplying a parallel default. */
export function parameter(endpoint: string, options: { readonly history?: boolean; readonly preset?: false } = {}): PluginStateParameter {
    return Object.freeze({ kind: "parameter", endpoint, ...options });
}

/** Capture a stored field's initial value through the same codec as future edits. */
export function storedValue<Value>(options: {
    readonly initial: Value;
    readonly codec: PluginStateCodec<Value>;
    readonly engine?: PluginStateEventValue<Value>;
    readonly lifetime?: PluginStateLifetime;
    readonly history?: boolean;
    readonly preset?: false;
}): PluginStateStored<Value> {
    // Undoing a value shared by every project would silently change other projects.
    if (options.lifetime === "user" && options.history === true)
        throw new Error("A user-lifetime value is shared across projects and cannot take part in Undo. Remove history: true.");
    const codec = Object.freeze({ ...options.codec });
    const history = options.lifetime === "user" ? false : options.history;
    return Object.freeze({ kind: "stored", initial: codec.parse(options.initial), codec,
        ...(options.lifetime ? { lifetime: options.lifetime } : {}),
        ...(history !== undefined ? { history } : {}),
        ...(options.preset === false ? { preset: false as const } : {}),
        ...(options.engine ? { engine: options.engine } : {}) });
}

interface PreparedStateOptions<Value> {
    readonly codec: PluginStateCodec<Value>;
    readonly initial: Value;
    readonly dependencies?: readonly string[];
    readonly lifetime?: "project" | "instance";
    readonly history?: boolean;
    readonly preset?: false;
}

/** Write the final shared allocation; the framework supplies named DSP wiring. */
export function preparedState<Value, Format extends SharedDataFormat>(options: PreparedStateOptions<Value> & {
    readonly engine: SharedDataDefinition<Format, number>;
    readonly prepare: (value: Value, destination: SharedDataView<Format>, context: PluginStatePrepareContext) => void | PluginStatePreparationFailure;
}): PluginStateStored<Value>;
/** Load outside audio processing, then describe one final-allocation write. */
export function preparedState<Value, Format extends SharedDataFormat>(options: PreparedStateOptions<Value> & {
    readonly engine: SharedDataDefinition<Format, undefined>;
    readonly prepare: (value: Value, context: PluginStatePrepareContext) => PluginStateSharedPlan<Format> | PluginStatePreparationFailure | Promise<PluginStateSharedPlan<Format> | PluginStatePreparationFailure>;
}): PluginStateStored<Value>;
/** Custom delivery stays available beneath the same editing and history API. */
export function preparedState<Value, Payload>(options: PreparedStateOptions<Value> & {
    readonly engine: PluginStateDelivery<Payload>;
    readonly prepare: (value: Value, context: PluginStatePrepareContext) => Payload | PluginStatePreparationFailure | Promise<Payload | PluginStatePreparationFailure>;
}): PluginStateStored<Value, Payload>;
export function preparedState<Value, Payload>(options: PreparedStateOptions<Value> & {
    readonly engine: PluginStateDelivery<Payload> | SharedDataDefinition<SharedDataFormat>;
    readonly prepare: ((value: Value, context: PluginStatePrepareContext) => Payload | PluginStateSharedPlan | PluginStatePreparationFailure | Promise<Payload | PluginStateSharedPlan | PluginStatePreparationFailure>)
        | ((value: Value, destination: Float32Array | Uint8Array, context: PluginStatePrepareContext) => void | PluginStatePreparationFailure);
}): PluginStateStored<Value, Payload> {
    const stored = storedValue({ codec: options.codec, initial: options.initial, lifetime: options.lifetime, history: options.history, preset: options.preset });
    const dependencies = Object.freeze([...(options.dependencies ?? [])]);
    if ("kind" in options.engine && options.engine.kind === "shared-data") {
        const declaration = options.engine;
        // SAFETY: the overload uses a synchronous writer exactly when the declaration has a fixed length.
        const write = options.prepare as (value: Value, destination: Float32Array | Uint8Array, context: PluginStatePrepareContext) => void | PluginStatePreparationFailure;
        const plan = options.prepare as PluginStateSharedValue<Value>["prepare"];
        const length = declaration.length;
        return Object.freeze({ ...stored, engine: Object.freeze({ kind: "shared-prepared", dependencies,
            storage: Object.freeze({ type: declaration.type, fixedLength: length ?? null }),
            prepare: length === undefined ? plan : (value: Value, context: PluginStatePrepareContext): PluginStateSharedPlan => ({
                length, write: destination => write(value, destination, context),
            }),
        }) });
    }
    // SAFETY: the other overload pairs preparation with this delivery's payload.
    const prepare = options.prepare as PluginStatePreparedValue<Value, Payload>["prepare"];
    const delivery = options.engine as PluginStateDelivery<Payload>;
    return Object.freeze({ ...stored, engine: Object.freeze({ kind: "prepared" as const,
        dependencies, prepare, delivery,
    }) });
}

export interface PluginStateOptions {
    readonly historyLimit?: number;
    /** Total shared storage, including active, pending and still-read versions. */
    readonly memoryBudgetBytes?: number;
}
const optionsKey = Symbol.for("builder-kit.plugin-state.options");
type ConfiguredFields = PluginStateFields & { readonly [optionsKey]?: PluginStateOptions };

/** Internal build/runtime lookup; configuration is not another editable field. */
export function getDefinitionOptions(fields: PluginStateFields): PluginStateOptions {
    return (fields as ConfiguredFields)[optionsKey] ?? {};
}

/** Stable for a declaration regardless of JavaScript property insertion order. */
export function sharedStateResources(fields: PluginStateFields) {
    return Object.keys(fields).filter(key => fields[key]?.kind === "stored" && fields[key].engine?.kind === "shared-prepared")
        .sort().map((key, input) => ({ key, input }));
}

/** Whether a field's accepted value is written into the host project. */
export function savedInProject(field: PluginStateParameter | PluginStateStored<unknown>): boolean {
    return field.kind === "stored" && (field.lifetime ?? "project") === "project";
}

/** The fields a preset or snapshot captures and recalls, in declaration order. */
export function soundFieldKeys(fields: PluginStateFields): readonly string[] {
    return Object.keys(fields).filter(key => fields[key]?.preset !== false);
}

/** Declare the finite plugin state surface while preserving each field's value type. */
export function definePluginState<const Fields extends PluginStateFields>(fields: Fields, options: PluginStateOptions = {}): Readonly<Fields> {
    if (options.historyLimit !== undefined && (!Number.isSafeInteger(options.historyLimit) || options.historyLimit < 0))
        throw new Error("historyLimit must be a non-negative integer.");
    const resources = sharedStateResources(fields);
    if (resources.length && (!Number.isSafeInteger(options.memoryBudgetBytes) || (options.memoryBudgetBytes ?? 0) < 4))
        throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
    if (resources.some(({ key }) => !isNativeIdentifier(key) || key === "Data"))
        throw new Error("Shared state names must be valid Cmajor identifiers.");
    const endpoints = new Map<string, string>();
    for (const [key, field] of Object.entries(fields)) {
        if (field.kind !== "parameter") continue;
        const claimed = endpoints.get(field.endpoint);
        if (claimed !== undefined)
            throw new Error(`Fields "${claimed}" and "${key}" both declare parameter "${field.endpoint}". Declare each host parameter once.`);
        endpoints.set(field.endpoint, key);
    }
    for (const field of Object.values(fields)) if (field.kind === "stored") field[definitionCheck]?.(fields);
    return Object.freeze(Object.defineProperty({ ...fields }, optionsKey, { value: Object.freeze({ ...options }) }));
}
