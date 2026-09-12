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

/** A diagnostic belongs to this field and never exposes native correlation identities. */
export type PluginStateControlError = {
    readonly kind: "readiness" | "persistence" | "application";
    readonly message: string;
};

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

function useClientValue<Value>(client: Client, selection: Atom<Value>): Value;
function useClientValue<Value>(client: Client | null, selection: Atom<Value> | null, fallback: Value): Value;
function useClientValue<Value>(client: Client | null, selection: Atom<Value> | null, fallback?: Value): Value {
    const store = client?.reactivity.store;
    const subscribe = useCallback((notify: () => void) => store && selection ? store.sub(selection, notify) : () => {}, [store, selection]);
    // SAFETY: a missing client/selection is used only by the overload requiring a fallback.
    const snapshot = useCallback(() => store && selection ? store.get(selection) : fallback as Value, [store, selection, fallback]);
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}
const connectingControl = Object.freeze({ kind: "connecting" as const });
const connectingClient: ReturnType<Client["getSnapshot"]> = Object.freeze({ kind: "connecting" });

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
    readonly error: PluginStateControlError | null;
    /** Retry the captured failure without creating an edit or an Undo entry. */
    readonly retry: (() => Promise<PluginStateEditResult>) | null;
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
    const control = useOptionalPluginState(declaration);
    if (!control) throw new Error("PluginStateProvider is missing.");
    return control;
}

/** Internal adapter seam: absence is explicit; an unready declared field still returns its control. */
export function useOptionalPluginState<Field extends PluginStateParameter | PluginStateStored<unknown>>(declaration: Field | null): PluginStateControl<PluginStateFieldValue<Field>> | null {
    const context = useContext(Context);
    const definition = context?.definition;
    const client = declaration !== null && context ? context.client : null;
    const projection = client ? projectionFor(client) : null;
    const key = definition && declaration !== null ? Object.keys(definition).find(key => definition[key] === declaration) : undefined;
    if (client && key === undefined) throw new Error("The field does not belong to this plugin state definition.");
    const selected = useMemo(() => atom((get): PluginStateControlState<PluginStateFieldValue<Field>> => {
        if (!client || key === undefined) return connectingControl;
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
    const state = useClientValue(client, selected, connectingControl);
    // The private accepted version changes even for ABA edits whose value is
    // equal again. React must renew its edit closure for those observations.
    const source = useClientValue(client, client?.reactivity.snapshot ?? null, connectingClient);
    const renderedScope = source.kind === "ready" ? source.state.scope : null;
    const renderedField = source.kind === "ready" && key !== undefined ? source.state.fields[key] : undefined;
    const renderedVersion = renderedField && "version" in renderedField ? renderedField.version : undefined;
    const actions = useMemo(() => {
        if (!client || !definition || !projection || key === undefined) return null;
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
            edit(value: PluginStateFieldValue<Field>, expectedVersion?: number): Promise<PluginStateEditResult> {
                const gesture = currentGesture()?.gesture;
                const snapshot = client.getSnapshot();
                const field = snapshot.kind === "ready" ? snapshot.state.fields[key] : undefined;
                if (definition[key]?.kind === "stored" && field?.readiness.kind === "failed" && field.readiness.reason === "invalid-state")
                    return client.dispatch({ kind: "recover", key, value, expectedVersion: 0 }).then(projection.result);
                return client.dispatch({ kind: "edit", key, value, expectedVersion, ...(gesture === undefined ? {} : { gesture }) }).then(projection.result);
            },
            /** Finish the current group; safe to call again after pointer cancellation. */
            endGesture(): Promise<PluginStateEditResult> | undefined {
                const gesture = currentGesture()?.gesture;
                active = undefined;
                return gesture === undefined ? undefined : client.dispatch({ kind: "end", key, gesture }).then(projection.result);
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
    const error: PluginStateControlError | null = renderedField?.readiness.kind === "failed"
        ? { kind: "readiness", message: renderedField.readiness.reason }
        : persistence?.kind === "failed" ? { kind: "persistence", message: persistence.reason }
            : application?.kind === "failed" ? { kind: "application", message: application.error.message } : null;
    const canRetry = renderedField?.readiness.kind === "ready" && renderedVersion !== undefined
        && ((persistence?.kind === "failed" && renderedField.persistenceRequest !== undefined)
            || (application?.kind === "failed" && application.error.kind !== "defect" && renderedField.target !== undefined));
    const retry = canRetry ? (): Promise<PluginStateEditResult> => {
        if (!currentScopeMatches()) return Promise.resolve({ kind: "rejected", reason: "stale-scope" });
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
