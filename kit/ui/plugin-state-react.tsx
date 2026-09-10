import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { atom, type Atom } from "jotai/vanilla";
import type { PluginStateFields, PluginStateParameter, PluginStateStored, PluginStateFieldValue } from "./plugin-state-definition";
import type { createPluginStateClient, PluginStateClientResult } from "./plugin-state-client";
import type { PluginStateApplication, PluginStateNativeParameter, PluginStateScope, PluginStateHistoryEntry as NativeHistoryEntry } from "./plugin-state-session";

type Client = ReturnType<typeof createPluginStateClient<PluginStateFields>>;
const Context = createContext<{ definition: PluginStateFields; client: Client } | null>(null);
const gestureCounters = new WeakMap<Client, number>();

declare const historyReference: unique symbol;
/** Retain and pass back to guarded Undo/Redo; object equality is not an eligibility test. */
export interface PluginStateHistoryEntry { readonly [historyReference]: true }
export type PluginStateRejectionReason = Extract<PluginStateClientResult, { kind: "rejected" }>["reason"];
/** Known edit acceptance is distinct from subsequent engine delivery. */
export type PluginStateEditResult =
    | { readonly kind: "accepted"; readonly changed?: boolean; readonly historyEntry?: PluginStateHistoryEntry }
    | { readonly kind: "rejected"; readonly reason: PluginStateRejectionReason }
    | { readonly kind: "interrupted"; readonly reason: "reset" | "closed"; readonly acceptance: "unknown" };
/** Application evidence without backend correlation identities. */
export type PluginStateApplicationState = Exclude<PluginStateApplication, { kind: "acknowledged" }>
    | { readonly kind: "acknowledged" };

function projectApplication(application: PluginStateApplication): PluginStateApplicationState {
    switch (application.kind) {
        case "failed": return { kind: "failed", error: { kind: application.error.kind, message: application.error.message } };
        case "sent": return { kind: "sent", proof: application.proof };
        default: return { kind: application.kind };
    }
}

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

function useClientValue<Value>(client: Client, selection: Atom<Value>): Value {
    const store = client.reactivity.store;
    const subscribe = useCallback((notify: () => void) => store.sub(selection, notify), [store, selection]);
    const snapshot = useCallback(() => store.get(selection), [store, selection]);
    // React rechecks after subscribing, covering a native update between render
    // and subscription. Jotai still owns the values, dependency graph and listeners.
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Display readiness is separate from an edit awaiting acceptance or sound delivery. */
export type PluginStateControlState<Value> =
    | { readonly kind: "connecting" | "closed" }
    | { readonly kind: "failed"; readonly reason: string }
    | {
        readonly kind: "ready";
        readonly value: Value;
        readonly pending: boolean;
        readonly application?: PluginStateApplicationState;
        readonly metadata?: Omit<PluginStateNativeParameter, "endpoint" | "value">;
    };

/** One editable control with framework-owned gestures and asynchronous results. */
export interface PluginStateControl<Value> {
    readonly state: PluginStateControlState<Value>;
    beginGesture(): Promise<PluginStateEditResult>;
    setValue(value: Value): Promise<PluginStateEditResult>;
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

/** Read and edit one declared field; control code never sends worker messages. */
export function usePluginState<Field extends PluginStateParameter | PluginStateStored<unknown>>(declaration: Field): PluginStateControl<PluginStateFieldValue<Field>> {
    const { definition, client } = useClient();
    const projection = projectionFor(client);
    const key = Object.keys(definition).find(key => definition[key] === declaration);
    if (key === undefined) throw new Error("The field does not belong to this plugin state definition.");
    const selected = useMemo(() => atom((get): PluginStateControlState<PluginStateFieldValue<Field>> => {
        const snapshot = get(client.reactivity.snapshot);
        if (snapshot.kind !== "ready") return snapshot;
        const field = snapshot.state.fields[key];
        if (!field || field.readiness.kind === "pending") return { kind: "connecting" };
        if (field.readiness.kind === "failed") return { kind: "failed", reason: field.readiness.reason };
        if (!("value" in field)) return { kind: "connecting" };
        return {
            kind: "ready",
            // SAFETY: identity lookup above selected this exact field declaration.
            value: field.value as PluginStateFieldValue<Field>,
            pending: snapshot.pendingFields.includes(key),
            ...(field.application ? { application: projectApplication(field.application) } : {}),
            ...(field.metadata ? { metadata: field.metadata } : {}),
        };
    }), [client, key]);
    const state = useClientValue(client, selected);
    const actions = useMemo(() => {
        let active: { readonly scope: PluginStateScope; readonly gesture: number } | undefined;
        const currentGesture = () => {
            const snapshot = client.getSnapshot();
            const scope = snapshot.kind === "ready" ? snapshot.state.scope : null;
            if (active && (!scope || scope.owner !== active.scope.owner || scope.document !== active.scope.document)) active = undefined;
            return active;
        };
        return {
            /** Group subsequent edits into one Undo entry. */
            beginGesture(): Promise<PluginStateEditResult> {
                if (currentGesture()) return Promise.resolve({ kind: "rejected", reason: "busy" });
                const snapshot = client.getSnapshot();
                if (snapshot.kind !== "ready" || !snapshot.state.scope) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
                const gesture = (gestureCounters.get(client) ?? 0) + 1;
                gestureCounters.set(client, gesture);
                active = { scope: snapshot.state.scope, gesture };
                return client.dispatch({ kind: "begin", key, gesture }).then(result => {
                    if (result.kind !== "accepted" && active?.gesture === gesture) active = undefined;
                    return projection.result(result);
                });
            },
            /** Show a draft immediately and request the edit through the state client. */
            setValue(value: PluginStateFieldValue<Field>): Promise<PluginStateEditResult> {
                const gesture = currentGesture()?.gesture;
                const snapshot = client.getSnapshot();
                const field = snapshot.kind === "ready" ? snapshot.state.fields[key] : undefined;
                if (definition[key]?.kind === "stored" && field?.readiness.kind === "failed" && field.readiness.reason === "invalid-state")
                    return client.dispatch({ kind: "recover", key, value, expectedVersion: 0 }).then(projection.result);
                return client.dispatch({ kind: "edit", key, value, ...(gesture === undefined ? {} : { gesture }) }).then(projection.result);
            },
            /** Finish the current group; safe to call again after pointer cancellation. */
            endGesture(): Promise<PluginStateEditResult> | undefined {
                const gesture = currentGesture()?.gesture;
                active = undefined;
                return gesture === undefined ? undefined : client.dispatch({ kind: "end", key, gesture }).then(projection.result);
            },
        };
    }, [client, key, definition, projection]);
    useEffect(() => () => { void actions.endGesture(); }, [actions]);
    return { state, ...actions };
}

/** Read and invoke the plugin's shared Undo history. */
export function usePluginHistory(): PluginStateHistory {
    const { client } = useClient();
    const projection = projectionFor(client);
    const snapshot = useClientValue(client, client.reactivity.snapshot);
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
    const history = snapshot.kind === "ready" ? snapshot.state.history : { canUndo: false, canRedo: false };
    return { canUndo: history.canUndo, canRedo: history.canRedo,
        ...(history.undoEntry ? { undoEntry: projection.reference(history.undoEntry) } : {}),
        ...(history.redoEntry ? { redoEntry: projection.reference(history.redoEntry) } : {}), ...actions };
}
