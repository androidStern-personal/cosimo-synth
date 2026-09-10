import { atom, createStore } from "jotai/vanilla";
import type { EngineApplication, EngineTarget } from "./plugin-state-engine";
import type { PluginStateFields, PluginStateFieldValue, PluginStateJson } from "./plugin-state-definition";

/** Native-assigned service lifetime and full-document identity. */
export interface PluginStateScope {
    readonly owner: string;
    readonly document: number;
}

/** Opaque identity for one Undo entry, valid only in its original document. */
export interface PluginStateHistoryEntry {
    readonly scope: PluginStateScope;
    readonly id: number;
}

/** A command address already authenticated and ordered by the channel adapter. */
export interface PluginStateAddress extends PluginStateScope {
    readonly client: number;
    readonly sequence: number;
}

/** Host-owned scalar metadata and its current observation. */
export interface PluginStateNativeParameter {
    readonly endpoint: string;
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly defaultValue: number;
}

/** Native adapter snapshot; stored values remain untrusted until their field codec parses them. */
export interface PluginStateNativeSnapshot {
    readonly parameters: readonly PluginStateNativeParameter[];
    readonly values: Readonly<Record<string, unknown>>;
}

/** Native persistence evidence, separate from edit acceptance and DSP application. */
export type PluginStatePersistence =
    | { readonly kind: "host-managed" | "not-written" | "pending" | "observed-in-native-state" }
    | { readonly kind: "failed"; readonly reason: string };

/** The exact client gesture currently protecting a field. */
export interface PluginStateGestureOwner {
    readonly client: number;
    readonly gesture: number;
}

/** A field has no substitute value before successful initialization. */
export type PluginStateFieldSnapshot<Value> = (
    | { readonly readiness: { readonly kind: "pending" } }
    | { readonly readiness: { readonly kind: "failed"; readonly reason: "missing-parameter" | "invalid-state" | "service-closed" } }
    | {
        readonly readiness: { readonly kind: "ready" } | { readonly kind: "failed"; readonly reason: "service-closed" };
        readonly value: Value;
        readonly version: number;
        readonly persistence: PluginStatePersistence;
        readonly metadata?: Omit<PluginStateNativeParameter, "endpoint" | "value">;
        readonly gesture?: PluginStateGestureOwner;
    }) & {
        readonly application?: PluginStateApplication;
        readonly target?: EngineTarget;
    };

/** Requested application progress remains distinct from native persistence. */
export type PluginStateApplication = EngineApplication
    | { readonly kind: "pending" | "waiting-for-inputs" | "unconfirmed" };

/** Immutable accepted value and explicitly declared scalar inputs for one engine target. */
export interface PluginStateEngineInput {
    readonly value: unknown;
    readonly parameters: Readonly<Record<string, number>>;
}

/** A composed engine binding; dependency names are declared parameter field keys. */
export interface PluginStateEnginePort {
    readonly key: string;
    readonly dependencies: readonly string[];
    /** Replace the requested target; preparation and transport belong to the binding. */
    replace(input: PluginStateEngineInput, target: EngineTarget): void;
    /** Cancel obsolete document work synchronously. Must not throw. */
    cancel(): void;
    /** Release binding work and transport resources; unexpected failures are diagnosed by the session. */
    stop(): Promise<void>;
}

/** One immutable projection of values, readiness, versions, and shared history availability. */
export interface PluginStateSnapshot<Fields extends PluginStateFields = PluginStateFields> {
    readonly scope: PluginStateScope | null;
    readonly revision: number;
    readonly fields: { readonly [Key in keyof Fields]: PluginStateFieldSnapshot<PluginStateFieldValue<Fields[Key]>> };
    readonly history: {
        readonly canUndo: boolean;
        readonly canRedo: boolean;
        readonly undoEntry?: PluginStateHistoryEntry;
        readonly redoEntry?: PluginStateHistoryEntry;
    };
}

/** Shared edit command; agent adapters require expectedVersion before entering this seam. */
export type PluginStateCommand = {
    readonly kind: "edit";
    readonly key: string;
    readonly value: unknown;
    readonly expectedVersion?: number;
    readonly gesture?: number;
} | { readonly kind: "begin"; readonly key: string; readonly gesture: number; readonly label?: string }
  | { readonly kind: "end"; readonly key: string; readonly gesture: number }
  | { readonly kind: "undo"; readonly expectedEntry?: PluginStateHistoryEntry }
  | { readonly kind: "redo"; readonly expectedEntry?: PluginStateHistoryEntry };

/** Known acceptance is independent of subsequent native publication success. */
export type PluginStateResult =
    | {
        readonly kind: "accepted";
        readonly revision: number;
        readonly version?: number;
        /** Edit commands report actual domain value change, independently of engine delivery. */
        readonly changed?: boolean;
        /** Present only when this command creates or seals a nonempty Undo entry. */
        readonly historyEntry?: PluginStateHistoryEntry;
    }
    | { readonly kind: "rejected"; readonly reason: "not-ready" | "invalid-command" | "invalid-value" | "stale-version" | "stale-history" | "stale-scope" | "busy" | "service-closed" | "sequence" };

/** Exact addressed result routed back to the originating client. */
export interface PluginStateReceipt {
    readonly address: PluginStateAddress;
    readonly result: PluginStateResult;
}

/** Ordered native operations; scalar values never enter a second stored parameter bank. */
export type PluginStateOperation =
    | { readonly kind: "stored"; readonly key: string; readonly value: PluginStateJson }
    | { readonly kind: "parameter"; readonly endpoint: string; readonly value: number }
    | { readonly kind: "gesture-start" | "gesture-end"; readonly endpoint: string };

/** One scope-guarded request for native effects. */
export interface PluginStatePublication {
    readonly request: number;
    readonly scope: PluginStateScope;
    readonly operations: readonly PluginStateOperation[];
}

/** Native adapter methods enqueue effects synchronously; replies arrive through dispatch. */
export interface PluginStateNativePort<Fields extends PluginStateFields> {
    /** Enqueue an ordered publication; report expected I/O failures with a published event. */
    publish(publication: PluginStatePublication): void;
    /** Send a coherent projection and, when present, its addressed command receipt. */
    update(snapshot: PluginStateSnapshot<Fields>, receipt?: PluginStateReceipt): void;
    /** Notify terminal service closure once. This cleanup method must not throw. */
    close(reason: { readonly reason: "service-closed" }): void;
}

/** Parsed adapter events; only domain field values are parsed again by their codecs. */
export type PluginStateEvent =
    | { readonly kind: "opened"; readonly scope: PluginStateScope; readonly native: PluginStateNativeSnapshot }
    | { readonly kind: "replaced"; readonly scope: PluginStateScope; readonly native: PluginStateNativeSnapshot }
    | { readonly kind: "engine"; readonly target: EngineTarget; readonly status: EngineApplication }
    | { readonly kind: "detached"; readonly scope: PluginStateScope; readonly client: number }
    | { readonly kind: "parameter"; readonly scope: PluginStateScope; readonly endpoint: string; readonly value: number }
    | { readonly kind: "command"; readonly address: PluginStateAddress; readonly command: PluginStateCommand }
    | {
        readonly kind: "published";
        readonly scope: PluginStateScope;
        readonly request: number;
        readonly result: { readonly kind: "observed" } | { readonly kind: "failed"; readonly reason: string };
    };

/** The sole mutable owner for one patch lifetime. */
export interface PluginStateSession<Fields extends PluginStateFields> {
    /** Enqueue an event and settle its known result after its immediate effects are dispatched. */
    dispatch(event: PluginStateEvent): Promise<PluginStateResult>;
    /** Read one immutable coherent projection with inferred domain field values. */
    getSnapshot(): PluginStateSnapshot<Fields>;
    /** Subscribe via Jotai; callbacks may enqueue later commands. */
    subscribe(listener: (snapshot: PluginStateSnapshot<Fields>) => void): () => void;
    /** Stop accepting work for this patch lifetime. */
    stop(): Promise<void>;
}

type RuntimeField = PluginStateFieldSnapshot<unknown>;
type RuntimeSnapshot = PluginStateSnapshot<PluginStateFields>;
type HistoryEntry = { readonly key: string; readonly before: unknown; readonly after: unknown; readonly order: number };
type Gesture = PluginStateGestureOwner & { readonly before: unknown; readonly after: unknown; readonly order: number };
type Model = {
    readonly snapshot: RuntimeSnapshot;
    readonly past: readonly HistoryEntry[];
    readonly future: readonly HistoryEntry[];
    readonly gestures: ReadonlyMap<string, Gesture>;
    readonly editOrder: number;
    readonly detached: ReadonlySet<number>;
    readonly parameters: ReadonlyMap<string, PluginStateNativeParameter>;
    readonly publications: ReadonlyMap<number, { readonly key: string; readonly version: number }>;
};

function sameScope(left: PluginStateScope, right: PluginStateScope): boolean {
    return left.owner === right.owner && left.document === right.document;
}

function historyReference(scope: PluginStateScope, entry: HistoryEntry): PluginStateHistoryEntry {
    return Object.freeze({ scope, id: entry.order });
}

function validParameter(parameter: PluginStateNativeParameter): boolean {
    return [parameter.value, parameter.min, parameter.max, parameter.step, parameter.defaultValue].every(Number.isFinite)
        && parameter.min <= parameter.max && parameter.step >= 0
        && parameter.value >= parameter.min && parameter.value <= parameter.max
        && parameter.defaultValue >= parameter.min && parameter.defaultValue <= parameter.max;
}

function readyField(value: unknown, persistence: PluginStatePersistence, version = 0, metadata?: Omit<PluginStateNativeParameter, "endpoint" | "value">, gesture?: PluginStateGestureOwner, application?: PluginStateApplication): RuntimeField {
    return Object.freeze({ readiness: Object.freeze({ kind: "ready" as const }), value, version, persistence: Object.freeze(persistence), ...(metadata ? { metadata } : {}), ...(gesture ? { gesture } : {}), ...(application ? { application: Object.freeze(application) } : {}) });
}

/** Create a patch-lifetime state owner with explicit native effects and Jotai reactivity. */
export function createPluginStateSession<const Fields extends PluginStateFields>(
    definition: Fields,
    ports: {
        readonly native: PluginStateNativePort<Fields>;
        readonly bindings?: readonly PluginStateEnginePort[];
        /** Retain an unexpected cause for diagnostics. Must not throw. */
        readonly onDefect: (error: unknown) => void;
    },
): PluginStateSession<Fields> {
    const store = createStore();
    const initialFields: Record<string, RuntimeField> = {};
    for (const key of Object.keys(definition)) initialFields[key] = Object.freeze({ readiness: Object.freeze({ kind: "pending" }) });
    const state = atom<Model>({
        snapshot: Object.freeze({ scope: null, revision: 0, fields: Object.freeze(initialFields), history: Object.freeze({ canUndo: false, canRedo: false }) }),
        past: [], future: [], gestures: new Map(), editOrder: 0, detached: new Set<number>(), parameters: new Map(), publications: new Map(),
    });
    const snapshotAtom = atom((get) => get(state).snapshot);
    let stopped = false;
    let stopping: Promise<void> | undefined;
    let nextPublication = 0;
    let draining = false;
    let accepted: PluginStateResult | undefined;
    let engineEffects: (() => void)[] = [];
    const queue: { readonly event: PluginStateEvent; readonly finish: (result: PluginStateResult) => void }[] = [];

    const getSnapshot = (): PluginStateSnapshot<Fields> => {
        // SAFETY: fields are created only from definition keys. Each stored value
        // comes from that exact field's typed codec; parameter fields hold numbers.
        return store.get(snapshotAtom) as PluginStateSnapshot<Fields>;
    };
    const publishSnapshot = (model: Model, fields: Readonly<Record<string, RuntimeField>>, past = model.past, future = model.future): Model => ({
        ...model,
        past: past.slice(-100), future,
        snapshot: Object.freeze({
            ...model.snapshot, revision: model.snapshot.revision + 1, fields: Object.freeze(fields),
            history: Object.freeze({
                canUndo: !stopped && model.gestures.size === 0 && past.length > 0 && fields[past[past.length - 1]?.key ?? ""]?.readiness.kind === "ready",
                canRedo: !stopped && model.gestures.size === 0 && future.length > 0 && fields[future[future.length - 1]?.key ?? ""]?.readiness.kind === "ready",
                ...(model.snapshot.scope && past.length > 0 ? { undoEntry: historyReference(model.snapshot.scope, past[past.length - 1]!) } : {}),
                ...(model.snapshot.scope && future.length > 0 ? { redoEntry: historyReference(model.snapshot.scope, future[future.length - 1]!) } : {}),
            }),
        }),
    });
    const commit = (next: Model) => {
        const previous = store.get(state);
        if (next.snapshot === previous.snapshot) { store.set(state, next); return; }
        const scope = next.snapshot.scope;
        if (!scope || !ports.bindings?.length) { store.set(state, next); return; }
        const fields = { ...next.snapshot.fields };
        for (const binding of ports.bindings) {
            const field = fields[binding.key];
            if (!field) continue;
            const old = previous.snapshot.fields[binding.key];
            const reset = !previous.snapshot.scope || !sameScope(scope, previous.snapshot.scope);
            const changed = reset || !old || ("value" in field && (!('value' in old) || !Object.is(field.value, old.value)))
                || binding.dependencies.some(key => {
                    const before = previous.snapshot.fields[key];
                    const after = fields[key];
                    return before !== after && (!before || !after || !("value" in before) || !("value" in after)
                        || !Object.is(before.value, after.value));
                });
            if (!changed) {
                const application = field.application ?? old?.application;
                const target = old?.target ?? field.target;
                fields[binding.key] = field.application === application && field.target === target ? field
                    : Object.freeze({ ...field, ...(application ? { application } : {}), ...(target ? { target } : {}) });
                continue;
            }
            const target = Object.freeze({ scope, key: binding.key, generation: reset ? 0 : (old?.target?.generation ?? -1) + 1 });
            const parameters: Record<string, number> = {};
            let ready = "value" in field && field.readiness.kind === "ready";
            for (const key of binding.dependencies) {
                const dependency = fields[key];
                if (definition[key]?.kind !== "parameter" || !dependency || !("value" in dependency)
                    || dependency.readiness.kind !== "ready" || typeof dependency.value !== "number") ready = false;
                else parameters[key] = dependency.value;
            }
            fields[binding.key] = Object.freeze({ ...field, target, application: Object.freeze({ kind: ready ? "pending" as const : "waiting-for-inputs" as const }) });
            if (ready && "value" in field) {
                const input = Object.freeze({ value: field.value, parameters: Object.freeze(parameters) });
                engineEffects.push(() => binding.replace(input, target));
            } else engineEffects.push(() => binding.cancel());
        }
        store.set(state, { ...next, snapshot: Object.freeze({ ...next.snapshot, fields: Object.freeze(fields) }) });
    };
    const sealGesture = (past: readonly HistoryEntry[], key: string, gesture: Gesture): readonly HistoryEntry[] => {
        const field = definition[key];
        const equal = field?.kind === "stored" ? field.codec.equals(gesture.before, gesture.after)
            : Object.is(gesture.before, gesture.after);
        return equal ? past : [...past, { key, before: gesture.before, after: gesture.after, order: gesture.order }]
            .sort((left, right) => left.order - right.order);
    };
    const applyValue = (model: Model, key: string, value: unknown, past: readonly HistoryEntry[], future: readonly HistoryEntry[], cause: "edit" | "history"): PluginStateResult => {
        const field = definition[key];
        const previous = model.snapshot.fields[key];
        if (!field || !previous || !("value" in previous) || !model.snapshot.scope) {
            return { kind: "rejected", reason: "not-ready" };
        }
        let operations: readonly PluginStateOperation[];
        if (field.kind === "parameter") {
            if (typeof value !== "number") return { kind: "rejected", reason: "invalid-value" };
            operations = model.gestures.has(key)
                ? [{ kind: "parameter", endpoint: field.endpoint, value }]
                : [{ kind: "gesture-start", endpoint: field.endpoint },
                    { kind: "parameter", endpoint: field.endpoint, value },
                    { kind: "gesture-end", endpoint: field.endpoint }];
        } else operations = [{ kind: "stored", key, value: field.codec.encode(value) }];
        const version = previous.version + 1;
        const request = ++nextPublication;
        const publications = new Map(model.publications).set(request, { key, version });
        const next = publishSnapshot(model, { ...model.snapshot.fields, [key]: readyField(value, { kind: field.kind === "parameter" ? "host-managed" : "pending" }, version, previous.metadata, previous.gesture, field.kind === "parameter" ? { kind: "pending" } : undefined) }, past, future);
        const result: PluginStateResult = { kind: "accepted", revision: next.snapshot.revision, version,
            ...(cause === "edit" ? { changed: true } : {}),
            ...(cause === "edit" && !model.gestures.has(key) && past.length > 0
                ? { historyEntry: historyReference(model.snapshot.scope, past[past.length - 1]!) } : {}),
        };
        accepted = result;
        commit({ ...next, publications });
        if (stopped) return result;
        ports.native.publish({ request, scope: model.snapshot.scope, operations });
        return result;
    };
    const apply = (event: PluginStateEvent): PluginStateResult => {
        const model = store.get(state);
        if (event.kind === "opened" || event.kind === "replaced") {
            if (model.snapshot.scope && (event.kind === "opened" || event.scope.owner !== model.snapshot.scope.owner
                || event.scope.document <= model.snapshot.scope.document)) return { kind: "rejected", reason: "stale-scope" };
            const fields: Record<string, RuntimeField> = {};
            const parameters = new Map<string, PluginStateNativeParameter>();
            for (const [key, field] of Object.entries(definition)) {
                if (field.kind === "parameter") {
                    const parameter = event.native.parameters.find((candidate) => candidate.endpoint === field.endpoint);
                    if (parameter && validParameter(parameter)) {
                        parameters.set(key, Object.freeze({ ...parameter }));
                        const { min, max, step, defaultValue } = parameter;
                        fields[key] = readyField(parameter.value, { kind: "host-managed" }, 0, Object.freeze({ min, max, step, defaultValue }), undefined, { kind: "unconfirmed" });
                    } else fields[key] = Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: parameter ? "invalid-state" : "missing-parameter" }) });
                } else {
                    const present = Object.hasOwn(event.native.values, key);
                    const parsed = present ? field.codec.parse(event.native.values[key]) : field.initial;
                    fields[key] = parsed.kind === "ok"
                        ? readyField(parsed.value, { kind: present ? "observed-in-native-state" : "not-written" })
                        : Object.freeze({ readiness: Object.freeze({ kind: "failed", reason: "invalid-state" }) });
                }
            }
            const next = publishSnapshot(model, fields, [], []);
            commit({ ...next, gestures: new Map(), publications: new Map(), editOrder: 0, parameters, snapshot: Object.freeze({ ...next.snapshot, scope: Object.freeze({ ...event.scope }) }) });
        } else if (event.kind === "command") {
            if (!model.snapshot.scope) return { kind: "rejected", reason: "not-ready" };
            if (!sameScope(event.address, model.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
            if (model.detached.has(event.address.client)) return { kind: "rejected", reason: "service-closed" };
            if (event.command.kind === "undo" || event.command.kind === "redo") {
                if (model.gestures.size > 0) return { kind: "rejected", reason: "busy" };
                const undo = event.command.kind === "undo";
                const source = undo ? model.past : model.future;
                const entry = source[source.length - 1];
                const expected = event.command.expectedEntry;
                if (expected && (!entry || !sameScope(expected.scope, model.snapshot.scope) || expected.id !== entry.order))
                    return { kind: "rejected", reason: "stale-history" };
                if (!entry) return { kind: "accepted", revision: model.snapshot.revision };
                return applyValue(model, entry.key, undo ? entry.before : entry.after,
                    undo ? model.past.slice(0, -1) : [...model.past, entry],
                    undo ? [...model.future, entry] : model.future.slice(0, -1), "history");
            }
            const { key } = event.command;
            if (!Object.hasOwn(definition, key)) return { kind: "rejected", reason: "invalid-command" };
            const field = definition[key];
            const previous = model.snapshot.fields[key];
            if (!field || !previous) return { kind: "rejected", reason: "invalid-command" };
            if (!("value" in previous)) return { kind: "rejected", reason: "not-ready" };
            const activeGesture = model.gestures.get(key);
            if (activeGesture && activeGesture.client !== event.address.client) return { kind: "rejected", reason: "busy" };
            if (event.command.kind === "begin" || event.command.kind === "end") {
                const { gesture } = event.command;
                if (!Number.isSafeInteger(gesture) || gesture <= 0) return { kind: "rejected", reason: "invalid-command" };
                if (activeGesture && activeGesture.gesture !== gesture) return { kind: "rejected", reason: "invalid-command" };
                const begin = event.command.kind === "begin";
                if (begin === Boolean(activeGesture)) return { kind: "accepted", revision: model.snapshot.revision, version: previous.version };
                const gestures = new Map(model.gestures);
                let past = model.past;
                let gestureOwner: PluginStateGestureOwner | undefined;
                let historyEntry: PluginStateHistoryEntry | undefined;
                if (begin) {
                    gestureOwner = Object.freeze({ client: event.address.client, gesture });
                    const baseline = previous.value;
                    gestures.set(key, { ...gestureOwner, before: baseline, after: baseline, order: 0 });
                } else if (activeGesture) {
                    gestures.delete(key);
                    past = sealGesture(past, key, activeGesture);
                    if (past !== model.past) historyEntry = historyReference(model.snapshot.scope, { key, ...activeGesture });
                }
                const next = publishSnapshot({ ...model, gestures }, { ...model.snapshot.fields,
                    [key]: readyField(previous.value, previous.persistence, previous.version, previous.metadata, gestureOwner, previous.application),
                }, past);
                const result: PluginStateResult = { kind: "accepted", revision: next.snapshot.revision, version: previous.version,
                    ...(historyEntry ? { historyEntry } : {}),
                };
                accepted = result;
                commit({ ...next, gestures });
                if (stopped) return result;
                if (field.kind === "parameter") ports.native.publish({ request: ++nextPublication, scope: model.snapshot.scope,
                    operations: [{ kind: begin ? "gesture-start" : "gesture-end", endpoint: field.endpoint }],
                });
                return result;
            }
            const { value, expectedVersion } = event.command;
            if (event.command.gesture !== undefined && (!activeGesture || activeGesture.gesture !== event.command.gesture)) {
                return { kind: "rejected", reason: "invalid-command" };
            }
            if (activeGesture && event.command.gesture === undefined) return { kind: "rejected", reason: "invalid-command" };
            if (expectedVersion !== undefined && expectedVersion !== previous.version) return { kind: "rejected", reason: "stale-version" };
            let nextValue: unknown;
            if (field.kind === "parameter") {
                const metadata = model.parameters.get(key);
                if (!metadata) return { kind: "rejected", reason: "not-ready" };
                if (typeof value !== "number" || !Number.isFinite(value)) return { kind: "rejected", reason: "invalid-value" };
                const clamped = Math.min(metadata.max, Math.max(metadata.min, value));
                nextValue = metadata.step > 0
                    ? Math.min(metadata.max, Math.max(metadata.min, metadata.min + Math.round((clamped - metadata.min) / metadata.step) * metadata.step))
                    : clamped;
                if (Object.is(previous.value, nextValue)) return { kind: "accepted", revision: model.snapshot.revision, version: previous.version, changed: false };
            } else {
                const parsed = field.codec.parse(value);
                if (parsed.kind === "error") return { kind: "rejected", reason: "invalid-value" };
                nextValue = parsed.value;
                if (field.codec.equals(previous.value, nextValue)) return { kind: "accepted", revision: model.snapshot.revision, version: previous.version, changed: false };
            }
            const editOrder = model.editOrder + 1;
            if (activeGesture) {
                const gestures = new Map(model.gestures).set(key, { ...activeGesture, after: nextValue, order: editOrder });
                return applyValue({ ...model, gestures, editOrder }, key, nextValue, model.past, [], "edit");
            }
            return applyValue({ ...model, editOrder }, key, nextValue, [
                ...model.past, { key, before: previous.value, after: nextValue, order: editOrder },
            ], [], "edit");
        } else if (event.kind === "engine") {
            const field = model.snapshot.fields[event.target.key];
            if (!field?.target || !sameScope(field.target.scope, event.target.scope)
                || field.target.generation !== event.target.generation) return { kind: "accepted", revision: model.snapshot.revision };
            commit(publishSnapshot(model, { ...model.snapshot.fields,
                [event.target.key]: Object.freeze({ ...field, application: Object.freeze({ ...event.status }) }),
            }));
        } else if (event.kind === "detached") {
            if (!model.snapshot.scope || !sameScope(event.scope, model.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
            if (model.detached.has(event.client)) return { kind: "accepted", revision: model.snapshot.revision };
            const gestures = new Map(model.gestures);
            const fields = { ...model.snapshot.fields };
            const operations: PluginStateOperation[] = [];
            let past = model.past;
            for (const [key, gesture] of model.gestures) {
                if (gesture.client !== event.client) continue;
                gestures.delete(key);
                past = sealGesture(past, key, gesture);
                const current = fields[key];
                if (current && "value" in current) fields[key] = readyField(current.value, current.persistence, current.version, current.metadata, undefined, current.application);
                const field = definition[key];
                if (field?.kind === "parameter") operations.push({ kind: "gesture-end", endpoint: field.endpoint });
            }
            const next = gestures.size === model.gestures.size ? model : publishSnapshot({ ...model, gestures }, fields, past);
            accepted = { kind: "accepted", revision: next.snapshot.revision };
            commit({ ...next, gestures, detached: new Set(model.detached).add(event.client) });
            if (!stopped && operations.length > 0) ports.native.publish({ request: ++nextPublication, scope: model.snapshot.scope, operations });
            return accepted;
        } else if (event.kind === "parameter") {
            if (!model.snapshot.scope || !sameScope(event.scope, model.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
            for (const [key, metadata] of model.parameters) {
                if (metadata.endpoint !== event.endpoint) continue;
                if (!validParameter({ ...metadata, value: event.value })) return { kind: "rejected", reason: "invalid-value" };
                const field = model.snapshot.fields[key];
                if (!field || !("value" in field)) continue;
                const next = Object.is(field.value, event.value) ? model : publishSnapshot(model, {
                    ...model.snapshot.fields, [key]: readyField(event.value, { kind: "host-managed" }, field.version + 1, field.metadata, field.gesture, { kind: "unconfirmed" }),
                });
                commit(next);
            }
        } else {
            if (!model.snapshot.scope || !sameScope(event.scope, model.snapshot.scope)) return { kind: "rejected", reason: "stale-scope" };
            const publication = model.publications.get(event.request);
            if (publication) {
                const publications = new Map(model.publications);
                publications.delete(event.request);
                const field = model.snapshot.fields[publication.key];
                if (field && "value" in field && field.version === publication.version) {
                    const persistence: PluginStatePersistence = event.result.kind === "observed"
                        ? { kind: definition[publication.key]?.kind === "parameter" ? "host-managed" : "observed-in-native-state" }
                        : { kind: "failed", reason: event.result.reason };
                    const application = definition[publication.key]?.kind === "parameter"
                        ? event.result.kind === "observed" ? { kind: "sent" as const, proof: "native-publication-processed" as const }
                            : { kind: "failed" as const, error: Object.freeze({ kind: "transport" as const, message: event.result.reason }) }
                        : field.application;
                    const next = publishSnapshot(model, { ...model.snapshot.fields, [publication.key]: readyField(field.value, persistence, field.version, field.metadata, field.gesture, application) });
                    commit({ ...next, publications });
                } else commit({ ...model, publications });
            }
        }
        return { kind: "accepted", revision: store.get(state).snapshot.revision };
    };
    const close = (receipt?: PluginStateReceipt) => {
        if (stopped) return;
        stopped = true;
        let finishStop = () => {};
        stopping = new Promise<void>(resolve => { finishStop = resolve; });
        const cleanups: Promise<void>[] = [];
        for (const binding of ports.bindings ?? []) {
            try { cleanups.push(binding.stop()); }
            catch (error) { cleanups.push(Promise.reject(error)); }
        }
        void Promise.allSettled(cleanups).then(results => {
            for (const result of results) if (result.status === "rejected") ports.onDefect(result.reason);
            finishStop();
        });
        const model = store.get(state);
        const fields: Record<string, RuntimeField> = {};
        for (const [key, field] of Object.entries(model.snapshot.fields)) {
            const { gesture: _gesture, ...retained } = "value" in field ? field : { ...field, gesture: undefined };
            fields[key] = Object.freeze({ ...retained, readiness: Object.freeze({ kind: "failed", reason: "service-closed" }) });
        }
        try {
            store.set(state, { ...publishSnapshot(model, fields), gestures: new Map(), publications: new Map() });
        } catch (error) { ports.onDefect(error); }
        if (receipt) {
            try { ports.native.update(getSnapshot(), receipt); }
            catch (error) { ports.onDefect(error); }
        }
        ports.native.close({ reason: "service-closed" });
    };
    const drain = () => {
        if (draining) return;
        draining = true;
        try {
            for (let item = queue.shift(); item; item = queue.shift()) {
                accepted = undefined;
                engineEffects = [];
                let result: PluginStateResult;
                let updating = false;
                try {
                    result = stopped ? { kind: "rejected", reason: "service-closed" } : apply(item.event);
                    accepted = result;
                    for (const effect of engineEffects) { if (!stopped) effect(); }
                    if (!stopped) {
                        updating = true;
                        ports.native.update(getSnapshot(), item.event.kind === "command" ? { address: item.event.address, result } : undefined);
                    }
                } catch (error) {
                    result = accepted ?? { kind: "rejected", reason: "service-closed" };
                    ports.onDefect(error);
                    close(!updating && item.event.kind === "command" ? { address: item.event.address, result } : undefined);
                }
                item.finish(result);
            }
        } finally { draining = false; }
    };
    return {
        getSnapshot,
        subscribe: (listener) => store.sub(snapshotAtom, () => listener(getSnapshot())),
        dispatch: (event) => new Promise((finish) => { queue.push({ event, finish }); drain(); }),
        stop: () => { close(); return stopping ?? Promise.resolve(); },
    };
}
