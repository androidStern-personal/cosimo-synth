import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { atom, type Atom } from "jotai/vanilla";
import type { PluginStateFields, PluginStateParameter, PluginStateStored, PluginStateFieldValue } from "./plugin-state-definition";
import type { createPluginStateClient, PluginStateClientResult } from "./plugin-state-client";
import type { PluginStateApplication, PluginStateNativeParameter, PluginStateScope, PluginStateHistoryEntry } from "./plugin-state-session";

type Client = ReturnType<typeof createPluginStateClient<PluginStateFields>>;
const Context = createContext<{ definition: PluginStateFields; client: Client } | null>(null);
const gestureCounters = new WeakMap<Client, number>();

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
        readonly application?: PluginStateApplication;
        readonly metadata?: Omit<PluginStateNativeParameter, "endpoint" | "value">;
    };

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
export function usePluginState<Field extends PluginStateParameter | PluginStateStored<unknown>>(declaration: Field) {
    const { definition, client } = useClient();
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
            ...(field.application ? { application: field.application } : {}),
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
            beginGesture(): Promise<PluginStateClientResult> {
                if (currentGesture()) return Promise.resolve({ kind: "rejected", reason: "busy" });
                const snapshot = client.getSnapshot();
                if (snapshot.kind !== "ready" || !snapshot.state.scope) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
                const gesture = (gestureCounters.get(client) ?? 0) + 1;
                gestureCounters.set(client, gesture);
                active = { scope: snapshot.state.scope, gesture };
                return client.dispatch({ kind: "begin", key, gesture }).then(result => {
                    if (result.kind !== "accepted" && active?.gesture === gesture) active = undefined;
                    return result;
                });
            },
            /** Show a draft immediately and request the edit through the state client. */
            setValue(value: PluginStateFieldValue<Field>): Promise<PluginStateClientResult> {
                const gesture = currentGesture()?.gesture;
                const snapshot = client.getSnapshot();
                const field = snapshot.kind === "ready" ? snapshot.state.fields[key] : undefined;
                if (definition[key]?.kind === "stored" && field?.readiness.kind === "failed" && field.readiness.reason === "invalid-state")
                    return client.dispatch({ kind: "recover", key, value, expectedVersion: 0 });
                return client.dispatch({ kind: "edit", key, value, ...(gesture === undefined ? {} : { gesture }) });
            },
            /** Finish the current group; safe to call again after pointer cancellation. */
            endGesture(): Promise<PluginStateClientResult> | undefined {
                const gesture = currentGesture()?.gesture;
                active = undefined;
                return gesture === undefined ? undefined : client.dispatch({ kind: "end", key, gesture });
            },
        };
    }, [client, key, definition]);
    useEffect(() => () => { void actions.endGesture(); }, [actions]);
    return { state, ...actions };
}

/** Read and invoke the plugin's shared Undo history. */
export function usePluginHistory() {
    const { client } = useClient();
    const snapshot = useClientValue(client, client.reactivity.snapshot);
    const actions = useMemo(() => ({
        undo: (expectedEntry?: PluginStateHistoryEntry) => client.dispatch({ kind: "undo", ...(expectedEntry === undefined ? {} : { expectedEntry }) }),
        redo: (expectedEntry?: PluginStateHistoryEntry) => client.dispatch({ kind: "redo", ...(expectedEntry === undefined ? {} : { expectedEntry }) }),
    }), [client]);
    return { ...(snapshot.kind === "ready" ? snapshot.state.history : { canUndo: false, canRedo: false }), ...actions };
}
