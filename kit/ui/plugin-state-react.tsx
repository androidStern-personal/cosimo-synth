import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Atom } from "jotai/vanilla";
import { selectAtom } from "jotai/vanilla/utils";
import type { PluginStateFields, PluginStateParameter, PluginStateStored, PluginStateFieldValue } from "./plugin-state-definition";
import type { createPluginStateClient, PluginStateClientResult } from "./plugin-state-client";
import type { PluginStateNativeParameter, PluginStateScope, PluginStateFieldSnapshot, PluginStateSnapshot, PluginStateHistoryEntry as NativeHistoryEntry } from "./plugin-state-session";

type Client = ReturnType<typeof createPluginStateClient<PluginStateFields>>;
const Context = createContext<{ definition: PluginStateFields; client: Client } | null>(null);
const gestureCounters = new WeakMap<Client, number>();

/** A gesture this view opened, over one or more fields, and the control or editor that opened it. */
type OpenGesture = { readonly scope: PluginStateScope; readonly gesture: number; readonly keys: readonly string[]; readonly owner: object };
const openGestures = new WeakMap<Client, Map<string, OpenGesture>>();

function gesturesOf(client: Client): Map<string, OpenGesture> {
    let gestures = openGestures.get(client);
    if (!gestures) { gestures = new Map(); openGestures.set(client, gestures); }
    return gestures;
}

function releaseGesture(client: Client, open: OpenGesture): void {
    const gestures = gesturesOf(client);
    for (const key of open.keys) if (gestures.get(key) === open) gestures.delete(key);
}

/** The open gesture covering a field; a gesture from a replaced document is forgotten. */
function openGestureFor(client: Client, key: string): OpenGesture | undefined {
    const open = gesturesOf(client).get(key);
    if (!open) return undefined;
    const snapshot = client.getSnapshot();
    const scope = snapshot.kind === "ready" ? snapshot.state.scope : null;
    if (scope && scope.owner === open.scope.owner && scope.document === open.scope.document) return open;
    releaseGesture(client, open);
    return undefined;
}

function ownedGesture(client: Client, owner: object): OpenGesture | undefined {
    for (const [key, open] of gesturesOf(client)) if (open.owner === owner) return openGestureFor(client, key);
    return undefined;
}

function beginOpenGesture(client: Client, owner: object, keys: readonly string[], projection: ReturnType<typeof projectionFor>): Promise<PluginStateEditResult> {
    if (ownedGesture(client, owner) || keys.some(key => openGestureFor(client, key))) return Promise.resolve({ kind: "rejected", reason: "busy" });
    const snapshot = client.getSnapshot();
    if (snapshot.kind !== "ready" || !snapshot.state.scope) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
    const gesture = (gestureCounters.get(client) ?? 0) + 1;
    gestureCounters.set(client, gesture);
    const open: OpenGesture = Object.freeze({ scope: snapshot.state.scope, gesture, keys: Object.freeze([...keys]), owner });
    for (const key of keys) gesturesOf(client).set(key, open);
    return client.dispatch({ kind: "begin", keys: open.keys, gesture }).then(result => {
        if (result.kind !== "accepted") releaseGesture(client, open);
        return projection.result(result);
    });
}

function endOpenGesture(client: Client, open: OpenGesture | undefined, projection: ReturnType<typeof projectionFor>): Promise<PluginStateEditResult> | undefined {
    if (!open) return undefined;
    releaseGesture(client, open);
    return client.dispatch({ kind: "end", keys: open.keys, gesture: open.gesture }).then(projection.result);
}

declare const historyReference: unique symbol;
/** Retain and pass back to guarded Undo/Redo; object equality is not an eligibility test. */
export interface PluginStateHistoryEntry { readonly [historyReference]: true }
export type PluginStateRejectionReason = Extract<PluginStateClientResult, { kind: "rejected" }>["reason"];
/** Known edit acceptance is distinct from subsequent engine delivery. */
export type PluginStateEditResult =
    | { readonly kind: "accepted"; readonly changed?: boolean; readonly historyEntry?: PluginStateHistoryEntry }
    | { readonly kind: "rejected"; readonly reason: PluginStateRejectionReason }
    | { readonly kind: "interrupted"; readonly reason: "reset" | "closed"; readonly acceptance: "unknown" };
/** The current field's displayable problem; the matching retry action owns recovery policy. */
export type PluginStateControlError = {
    readonly message: string;
};

function createPublicProjection() {
    const entries = new WeakMap<PluginStateHistoryEntry, NativeHistoryEntry>();
    const reference = (entry: NativeHistoryEntry): PluginStateHistoryEntry => {
        // SAFETY: only this module constructs branded tokens; native identities
        // live exclusively in the private weak map, not on the public object.
        const token = Object.freeze({}) as PluginStateHistoryEntry;
        entries.set(token, entry);
        return token;
    };
    return {
        reference,
        entry: (token: PluginStateHistoryEntry) => entries.get(token),
        result(result: PluginStateClientResult): PluginStateEditResult {
            if (result.kind === "accepted") return {
                kind: "accepted",
                ...(result.changed === undefined ? {} : { changed: result.changed }),
                ...(result.historyEntry ? { historyEntry: reference(result.historyEntry) } : {}),
            };
            if (result.kind === "rejected") return { kind: "rejected", reason: result.reason };
            return { kind: "interrupted", reason: result.reason, acceptance: "unknown" };
        },
    };
}
const publicProjections = new WeakMap<Client, ReturnType<typeof createPublicProjection>>();
function projectionFor(client: Client) {
    let projection = publicProjections.get(client);
    if (!projection) { projection = createPublicProjection(); publicProjections.set(client, projection); }
    return projection;
}

function useClientValue<Value>(client: Client, selection: Atom<Value>): Value;
function useClientValue<Value>(client: Client | null, selection: Atom<Value> | null, fallback: Value): Value;
function useClientValue<Value>(client: Client | null, selection: Atom<Value> | null, fallback?: Value): Value {
    const store = client?.reactivity.store;
    const subscribe = useCallback((notify: () => void) => store && selection ? store.sub(selection, notify) : () => {}, [store, selection]);
    // SAFETY: a missing client/selection is used only by the overload requiring a fallback.
    const snapshot = useCallback(() => store && selection ? store.get(selection) : fallback as Value, [store, selection, fallback]);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}
const loadingControl = Object.freeze({ status: "loading" as const });
const connectingClient = Object.freeze({ kind: "connecting" as const });

/**
 * One UI lifecycle for the displayed value. Both idle and updating remain editable.
 * Idle means no tracked work remains; unresolved errors are reported separately.
 * Invalid saved data can be replaced through setValue; unavailable fields cannot.
 */
export type PluginStateControlState<Value> =
    | { readonly status: "loading" | "invalid" | "unavailable" }
    | {
        readonly status: "idle" | "updating";
        readonly value: Value;
        readonly metadata?: Omit<PluginStateNativeParameter, "endpoint" | "value">;
    };

/** One editable control with framework-owned gestures and asynchronous results. */
export interface PluginStateControl<Value> {
    readonly state: PluginStateControlState<Value>;
    readonly error: PluginStateControlError | null;
    /** Retry the captured failure without creating an edit or an Undo entry. */
    readonly retry: (() => Promise<PluginStateEditResult>) | null;
    beginGesture(): Promise<PluginStateEditResult>;
    setValue(value: Value): Promise<PluginStateEditResult>;
    endGesture(): Promise<PluginStateEditResult> | undefined;
}

/** Declared values to accept together as one edit and one Undo entry. */
export type PluginStateChanges<Fields extends PluginStateFields> = {
    readonly [Key in keyof Fields]?: PluginStateFieldValue<Fields[Key]>;
};

/** Edit several fields together, guarded by the values observed in this render. */
export interface PluginStateEditor<Fields extends PluginStateFields> {
    /** `history: false` applies the change without an Undo entry, for example to a library of saved items. */
    edit<Changes extends PluginStateChanges<Fields>>(
        changes: Changes & { readonly [Key in Exclude<keyof Changes, keyof Fields>]: never },
        options?: { readonly history?: boolean },
    ): Promise<PluginStateEditResult>;
    /**
     * Open one gesture over these fields, for a drag that moves several at once. Until endGesture,
     * edit() and each field control's setValue on these fields write into it.
     */
    beginGesture(keys: readonly (keyof Fields & string)[]): Promise<PluginStateEditResult>;
    /** Seal the gesture as one Undo entry listing every field that moved. Returns undefined when none is open. */
    endGesture(): Promise<PluginStateEditResult> | undefined;
}

/** Shared history with optional opaque guards for an editor's remembered entry. */
export interface PluginStateHistory {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undoEntry?: PluginStateHistoryEntry;
    readonly redoEntry?: PluginStateHistoryEntry;
    /** Whether a remembered entry is currently eligible; execution still uses the guard. */
    canUndoEntry(entry?: PluginStateHistoryEntry): boolean;
    canRedoEntry(entry?: PluginStateHistoryEntry): boolean;
    undo(entry?: PluginStateHistoryEntry): Promise<PluginStateEditResult>;
    redo(entry?: PluginStateHistoryEntry): Promise<PluginStateEditResult>;
}

function useClient() {
    const context = useContext(Context);
    if (!context) throw new Error("PluginStateProvider is missing.");
    return context;
}

/** Connect a React view to its framework-owned state client. */
export function PluginStateProvider(props: { definition: PluginStateFields; client: Client; children: ReactNode }) {
    const value = useMemo(() => ({ definition: props.definition, client: props.client }), [props.definition, props.client]);
    return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

/** Read one field, or edit several fields together through their definition. */
export function usePluginState<Field extends PluginStateParameter | PluginStateStored<unknown>>(declaration: Field): PluginStateControl<PluginStateFieldValue<Field>>;
export function usePluginState<Fields extends PluginStateFields>(definition: Fields): PluginStateEditor<Fields>;
export function usePluginState(declaration: PluginStateParameter | PluginStateStored<unknown> | PluginStateFields): PluginStateControl<unknown> | PluginStateEditor<PluginStateFields> {
    const control = useOptionalPluginState(isStateField(declaration) ? declaration : null);
    const editor = useDefinitionEditor(isStateField(declaration) ? null : declaration);
    if (control) return control;
    if (editor) return editor;
    throw new Error("PluginStateProvider is missing.");
}

function isStateField(declaration: PluginStateParameter | PluginStateStored<unknown> | PluginStateFields): declaration is PluginStateParameter | PluginStateStored<unknown> {
    return declaration.kind === "parameter" || declaration.kind === "stored";
}

function useDefinitionEditor(definition: PluginStateFields | null): PluginStateEditor<PluginStateFields> | null {
    const context = useContext(Context);
    const client = definition && context ? context.client : null;
    const source = useClientValue(client, client?.reactivity.snapshot ?? null, connectingClient);
    // Identifies the gesture this editor opened across renders; unmounting ends it.
    const [owner] = useState(() => ({}));
    useEffect(() => () => { if (client) void endOpenGesture(client, ownedGesture(client, owner), projectionFor(client)); }, [client, owner]);
    if (!client || !definition) return null;
    if (definition !== context?.definition) throw new Error("The definition does not belong to this plugin state provider.");
    const projection = projectionFor(client);
    return {
        beginGesture(keys) {
            if (keys.length === 0 || new Set(keys).size !== keys.length || !keys.every(key => Object.hasOwn(definition, key)))
                return Promise.resolve({ kind: "rejected", reason: "invalid-command" });
            return beginOpenGesture(client, owner, keys, projection);
        },
        endGesture: () => endOpenGesture(client, ownedGesture(client, owner), projection),
        edit(changes, options = {}) {
            const current = client.getSnapshot();
            if (source.kind !== "ready" || !source.state.scope) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
            if (current.kind !== "ready" || current.state.scope?.owner !== source.state.scope.owner
                || current.state.scope.document !== source.state.scope.document)
                return Promise.resolve({ kind: "rejected", reason: "stale-scope" });
            const edits = [];
            for (const [key, value] of Object.entries(changes)) {
                if (!Object.hasOwn(definition, key)) return Promise.resolve({ kind: "rejected", reason: "invalid-command" });
                const field = source.state.fields[key];
                if (!field || field.readiness.kind !== "ready" || !("version" in field)) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
                edits.push({ key, value, expectedVersion: field.version });
            }
            const open = ownedGesture(client, owner);
            const inGesture = open !== undefined && options.history !== false && edits.every(edit => open.keys.includes(edit.key));
            return client.dispatch({ kind: "edit-many", edits, ...(options.history === false ? { history: false as const } : {}),
                ...(inGesture ? { gesture: open.gesture } : {}) }).then(projection.result);
        },
    };
}

type ControlSource = Exclude<ReturnType<Client["getSnapshot"]>, { kind: "ready" }> | {
    readonly kind: "ready";
    readonly client: number;
    readonly scope: PluginStateScope | null;
    readonly field: PluginStateFieldSnapshot<unknown> | undefined;
    readonly pending: boolean;
    readonly hasDraft: boolean;
};

// These are parsed, shallow protocol records (readiness, metadata, application,
// target). Domain values are compared separately by their retained identity.
function sameControlDetails(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key)
        && sameControlDetails(Reflect.get(left, key), Reflect.get(right, key)));
}

function sameControlSource(left: ControlSource, right: ControlSource): boolean {
    if (left.kind !== "ready" || right.kind !== "ready") return sameControlDetails(left, right);
    if (left.client !== right.client || left.pending !== right.pending || left.hasDraft !== right.hasDraft
        || !sameControlDetails(left.scope, right.scope)) return false;
    const before = left.field, after = right.field;
    if (before === after) return true;
    if (!before || !after) return false;
    const keys = Object.keys(before);
    return keys.length === Object.keys(after).length && keys.every(key => Object.hasOwn(after, key)
        && (key === "value" ? Object.is(Reflect.get(before, key), Reflect.get(after, key))
            : sameControlDetails(Reflect.get(before, key), Reflect.get(after, key))));
}

/** Internal adapter seam: absence is explicit; an unready declared field still returns its control. */
export function useOptionalPluginState<Field extends PluginStateParameter | PluginStateStored<unknown>>(declaration: Field | null): PluginStateControl<PluginStateFieldValue<Field>> | null {
    const context = useContext(Context);
    const definition = context?.definition;
    const client = declaration !== null && context ? context.client : null;
    const projection = client ? projectionFor(client) : null;
    const key = definition && declaration !== null ? Object.keys(definition).find(key => definition[key] === declaration) : undefined;
    if (client && key === undefined) throw new Error("The field does not belong to this plugin state definition.");
    // Select the complete field contract, including private version/retry guards.
    // Unrelated revisions must neither render this control nor renew its closure.
    const selected = useMemo(() => client && key !== undefined ? selectAtom(
        client.reactivity.snapshot,
        (snapshot): ControlSource => snapshot.kind === "ready" ? {
            kind: "ready", client: snapshot.client, scope: snapshot.state.scope,
            field: snapshot.state.fields[key], pending: snapshot.pendingFields.includes(key),
            hasDraft: snapshot.draftFields.includes(key),
        } : snapshot,
        sameControlSource,
    ) : null, [client, key]);
    const source = useClientValue(client, selected, connectingClient);
    const state: PluginStateControlState<PluginStateFieldValue<Field>> = (() => {
        if (source.kind === "connecting") return loadingControl;
        if (source.kind !== "ready") return { status: "unavailable" };
        const field = source.field;
        if (!field || field.readiness.kind === "pending") return loadingControl;
        if (field.readiness.kind === "failed") return {
            status: field.readiness.reason === "invalid-state" ? source.hasDraft ? "loading" : "invalid" : "unavailable",
        };
        if (!("value" in field)) return loadingControl;
        const updating = source.pending || field.persistence.kind === "pending"
            || field.application?.kind === "pending" || field.application?.kind === "preparing";
        return {
            status: updating ? "updating" : "idle",
            // SAFETY: identity lookup above selected this exact field declaration.
            value: field.value as PluginStateFieldValue<Field>,
            ...(field.metadata ? { metadata: field.metadata } : {}),
        };
    })();
    const renderedScope = source.kind === "ready" ? source.scope : null;
    const renderedField = source.kind === "ready" ? source.field : undefined;
    const renderedVersion = renderedField && "version" in renderedField ? renderedField.version : undefined;
    const actions = useMemo(() => {
        if (!client || !definition || !projection || key === undefined) return null;
        const owner = {};
        return {
            /** Group subsequent edits into one Undo entry. */
            beginGesture: (): Promise<PluginStateEditResult> => beginOpenGesture(client, owner, [key], projection),
            /** Show a draft immediately and request the edit through the state client, inside any gesture covering this field. */
            edit(value: PluginStateFieldValue<Field>, expectedVersion?: number): Promise<PluginStateEditResult> {
                const gesture = openGestureFor(client, key)?.gesture;
                const snapshot = client.getSnapshot();
                const field = snapshot.kind === "ready" ? snapshot.state.fields[key] : undefined;
                if (definition[key]?.kind === "stored" && field?.readiness.kind === "failed" && field.readiness.reason === "invalid-state")
                    return client.dispatch({ kind: "recover", key, value, expectedVersion: 0 }).then(projection.result);
                return client.dispatch({ kind: "edit", key, value, expectedVersion, ...(gesture === undefined ? {} : { gesture }) }).then(projection.result);
            },
            /** Finish this control's own gesture; safe to call again after pointer cancellation. */
            endGesture: (): Promise<PluginStateEditResult> | undefined => {
                const open = openGestureFor(client, key);
                return endOpenGesture(client, open?.owner === owner ? open : undefined, projection);
            },
        };
    }, [client, key, definition, projection]);
    useEffect(() => () => { void actions?.endGesture(); }, [actions]);
    if (!client || !actions || !projection || key === undefined) return null;
    const currentScopeMatches = () => {
        const current = client.getSnapshot();
        return renderedScope !== null && current.kind === "ready" && current.state.scope?.owner === renderedScope.owner
            && current.state.scope.document === renderedScope.document;
    };
    const setValue = (value: PluginStateFieldValue<Field>): Promise<PluginStateEditResult> => {
        if (!currentScopeMatches()) return Promise.resolve({ kind: "rejected", reason: "stale-scope" });
        return actions.edit(value, renderedVersion);
    };
    const persistence = renderedField && "persistence" in renderedField ? renderedField.persistence : undefined;
    const application = renderedField?.application;
    const hasDraft = source.kind === "ready" && source.hasDraft;
    const error: PluginStateControlError | null = (() => {
        if (source.kind === "closed") return { message: "Plugin connection is closed." };
        if (source.kind === "failed") return { message: source.reason };
        if (hasDraft) return null;
        if (renderedField?.readiness.kind === "failed") {
            switch (renderedField.readiness.reason) {
                case "invalid-state": return { message: "Saved state is invalid. Supply a valid replacement or restore the default." };
                case "missing-parameter": return { message: "The required parameter is unavailable." };
                case "service-closed": return { message: "Plugin connection is closed." };
            }
        }
        if (persistence?.kind === "failed") return { message: persistence.reason };
        if (application?.kind === "failed") return { message: application.error.message };
        // The session hydrates all fields together. Waiting with an otherwise
        // usable value means a required parameter is unavailable, not a live job.
        if (application?.kind === "waiting-for-inputs") return { message: "A required parameter is unavailable. This value cannot be applied yet." };
        return null;
    })();
    const canRetry = !hasDraft && renderedField?.readiness.kind === "ready" && renderedVersion !== undefined
        && (persistence?.kind === "failed" ? renderedField.persistenceRequest !== undefined
            : application?.kind === "failed" && application.error.kind !== "defect" && renderedField.target !== undefined);
    const retry = canRetry ? (): Promise<PluginStateEditResult> => {
        if (!currentScopeMatches()) return Promise.resolve({ kind: "rejected", reason: "stale-scope" });
        const current = client.getSnapshot();
        if (current.kind === "ready" && current.draftFields.includes(key))
            return Promise.resolve({ kind: "rejected", reason: "stale-version" });
        return client.dispatch({ kind: "retry", key, expectedVersion: renderedVersion,
            expectedGeneration: renderedField.target?.generation ?? null,
            expectedPersistenceRequest: persistence?.kind === "failed" ? renderedField.persistenceRequest ?? null : null,
        }).then(projection.result);
    } : null;
    return { state, error, retry, setValue, beginGesture: actions.beginGesture, endGesture: actions.endGesture };
}

/** Read and invoke the plugin's shared Undo history. */
export function usePluginHistory(): PluginStateHistory {
    const { client } = useClient();
    const projection = projectionFor(client);
    const selected = useMemo(() => selectAtom(client.reactivity.snapshot, snapshot => snapshot.kind === "ready"
        ? snapshot.state.history : { canUndo: false, canRedo: false }, sameControlDetails), [client]);
    const history = useClientValue(client, selected);
    const actions = useMemo(() => {
        const eligible = (kind: "undo" | "redo", token?: PluginStateHistoryEntry): boolean => {
            const current = client.getSnapshot();
            const entry = token === undefined ? undefined : projection.entry(token);
            if (!entry || current.kind !== "ready") return false;
            const history = current.state.history;
            const head = kind === "undo" ? history.undoEntry : history.redoEntry;
            return (kind === "undo" ? history.canUndo : history.canRedo) && head !== undefined
                && head.id === entry.id && head.scope.owner === entry.scope.owner && head.scope.document === entry.scope.document;
        };
        const dispatch = (kind: "undo" | "redo", token?: PluginStateHistoryEntry): Promise<PluginStateEditResult> => {
            const expectedEntry = token === undefined ? undefined : projection.entry(token);
            if (token !== undefined && !expectedEntry) return Promise.resolve({ kind: "rejected", reason: "stale-history" });
            return client.dispatch({ kind, ...(expectedEntry ? { expectedEntry } : {}) }).then(projection.result);
        };
        return {
            undo: (entry?: PluginStateHistoryEntry) => dispatch("undo", entry), redo: (entry?: PluginStateHistoryEntry) => dispatch("redo", entry),
            canUndoEntry: (entry?: PluginStateHistoryEntry) => eligible("undo", entry), canRedoEntry: (entry?: PluginStateHistoryEntry) => eligible("redo", entry),
        };
    }, [client, projection]);
    const undoEntry = useEntryReference(projection, history.undoEntry);
    const redoEntry = useEntryReference(projection, history.redoEntry);
    return { canUndo: history.canUndo, canRedo: history.canRedo,
        ...(undoEntry ? { undoEntry } : {}), ...(redoEntry ? { redoEntry } : {}), ...actions };
}

/** One token per history entry, so memoized consumers see a stable identity across renders. */
function useEntryReference(projection: ReturnType<typeof projectionFor>, entry: NativeHistoryEntry | undefined) {
    // The entry object is recreated with every snapshot; these three values identify it.
    const owner = entry?.scope.owner, document = entry?.scope.document, id = entry?.id;
    return useMemo(() => entry && projection.reference(entry), [projection, owner, document, id]);
}

/**
 * The accepted state this view last rendered, for kit hooks that read many fields
 * at once. Null until the GUI is attached.
 */
export function usePluginStateSnapshot(): PluginStateSnapshot<PluginStateFields> | null {
    const { client } = useClient();
    const source = useClientValue(client, client.reactivity.snapshot);
    return source.kind === "ready" ? source.state : null;
}
