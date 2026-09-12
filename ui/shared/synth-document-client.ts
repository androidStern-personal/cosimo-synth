import type { PatchConnectionLike } from "./cmajor-react";
import { acquireSynthViewState } from "./synth-state-client";
import type { PluginStateFieldSnapshot } from "../../kit/ui/plugin-state-session";
import type { PluginStateClientResult } from "../../kit/ui/plugin-state-client";

let nextGesture = 0;

/** The existing shared view client owns every command, draft and history entry.
 * This adapter only gives imperative domain stores a field-level interface. */
export function createSynthDocumentClient<Value>(connection: PatchConnectionLike, key: string) {
    const lease = acquireSynthViewState(connection);
    let gesture: number | undefined;
    let gestureScope: string | undefined;
    const snapshot = () => lease.client.getSnapshot();
    function field() {
        const state = snapshot();
        if (state.kind !== "ready") return undefined;
        const fields: Readonly<Record<string, PluginStateFieldSnapshot<unknown>>> = state.state.fields;
        return fields[key];
    }
    function currentScope() {
        const state = snapshot();
        return state.kind === "ready" && state.state.scope ? JSON.stringify(state.state.scope) : undefined;
    }
    function activeGesture() {
        if (gestureScope !== currentScope()) { gesture = undefined; gestureScope = undefined; }
        return gesture;
    }
    const unavailable = (): Promise<PluginStateClientResult> => Promise.resolve({ kind: "rejected", reason: "not-ready" });
    return {
        read(): Value | undefined {
            const current = field();
            // SAFETY: callers pair this adapter with the declared domain key;
            // the state service parsed and owns this exact immutable field.
            return current?.readiness.kind === "ready" && "value" in current ? current.value as Value : undefined;
        },
        subscribe(listener: () => void) { return lease.client.subscribe(listener); },
        setWithParameters(value: Value, parameters: Readonly<Record<string, number>>) {
            const current = snapshot();
            if (current.kind !== "ready") return unavailable();
            const fields: Readonly<Record<string, PluginStateFieldSnapshot<unknown>>> = current.state.fields;
            const values: { key: string; value: unknown }[] = [{ key, value }, ...Object.entries(parameters).map(([key, value]) => ({ key, value }))];
            const edits = [];
            for (const edit of values) {
                const field = fields[edit.key];
                if (!field || field.readiness.kind !== "ready" || !("version" in field)) return unavailable();
                edits.push({ ...edit, expectedVersion: field.version });
            }
            return lease.client.dispatch({ kind: "edit-many", edits });
        },
        set(value: Value) {
            const current = field();
            if (current?.readiness.kind === "failed" && current.readiness.reason === "invalid-state")
                return lease.client.dispatch({ kind: "recover", key, value, expectedVersion: 0 });
            if (current?.readiness.kind !== "ready" || !("version" in current)) return unavailable();
            const active = activeGesture();
            return lease.client.dispatch({ kind: "edit", key, value, expectedVersion: current.version,
                ...(active === undefined ? {} : { gesture: active }) });
        },
        begin() {
            if (activeGesture() !== undefined) return;
            const scope = currentScope();
            if (!scope) return;
            const id = ++nextGesture;
            gesture = id; gestureScope = scope;
            void lease.client.dispatch({ kind: "begin", key, gesture: id }).then(result => {
                if (result.kind !== "accepted" && gesture === id) gesture = undefined;
            });
        },
        end() {
            const active = activeGesture();
            gesture = undefined; gestureScope = undefined;
            return active === undefined ? undefined : lease.client.dispatch({ kind: "end", key, gesture: active });
        },
        stop() {
            const active = activeGesture(); gesture = undefined;
            if (active !== undefined) void lease.client.dispatch({ kind: "end", key, gesture: active });
            lease.release();
        },
    };
}
