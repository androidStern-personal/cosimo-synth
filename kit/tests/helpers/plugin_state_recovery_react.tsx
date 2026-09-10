import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PluginStateProvider, usePluginHistory, usePluginState } from "../../ui/plugin-state-react";
import { definePluginState, storedValue } from "../../ui/plugin-state-definition";
import { createPluginStateClient, type PluginStateClientEvent, type PluginStateClientMessage, type PluginStateClientResult } from "../../ui/plugin-state-client";
import { createPluginStateSession } from "../../ui/plugin-state-session";

const definition = definePluginState({ curve: storedValue({ initial: [0, 1] as readonly number[], codec: {
    parse(value: unknown) {
        if (!Array.isArray(value) || value.length < 2) return { kind: "error" as const, message: "Expected finite curve points." };
        const points: number[] = [];
        for (const point of value) {
            if (typeof point !== "number" || !Number.isFinite(point)) return { kind: "error" as const, message: "Expected finite curve points." };
            points.push(point);
        }
        return { kind: "ok" as const, value: Object.freeze(points) };
    },
    encode: (value: readonly number[]) => [...value],
    equals: (left: readonly number[], right: readonly number[]) => left.length === right.length && left.every((value, index) => value === right[index]),
} }) });

function Controls() {
    const curve = usePluginState(definition.curve);
    const history = usePluginHistory();
    const [result, finish] = useState<PluginStateClientResult>();
    return <>
        <output data-testid="recovery-state">{JSON.stringify(curve.state)}</output>
        <output data-testid="recovery-result">{JSON.stringify(result ?? null)}</output>
        <output data-testid="recovery-history">{JSON.stringify({ canUndo: history.canUndo, canRedo: history.canRedo })}</output>
        <button onClick={() => { void curve.setValue([0, 0.4, 1]).then(finish); }}>Recover curve</button>
        <button onClick={() => { void curve.setValue([1, 0]).then(finish); }}>Edit curve</button>
        <button onClick={() => { void history.undo().then(finish); }}>Undo curve</button>
    </>;
}

/** The fixture holds only transport delivery; the real owner and client produce every state and result. */
export async function mount(element: HTMLElement) {
    let scope = { owner: "react-recovery", document: 0 };
    let receive: ((event: PluginStateClientEvent<typeof definition>) => void) | undefined;
    const held: PluginStateClientMessage[] = [];
    const publications: unknown[] = [];
    const defects: string[] = [];
    const owner = createPluginStateSession(definition, { native: {
        publish(value) { publications.push(value); },
        update(state, receipt) {
            if (!state.scope) throw new Error("An opened owner must have a scope.");
            receive?.({ kind: "update", scope: state.scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) });
        },
        close() {},
    }, onDefect: error => defects.push(String(error)) });
    await owner.dispatch({ kind: "opened", scope, native: { values: { curve: "corrupt" }, parameters: [] } });
    const client = createPluginStateClient(definition, { channel: {
        subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
        send(message) {
            if (message.kind === "attach") {
                const state = owner.getSnapshot();
                receive?.({ kind: "attached", request: message.request, client: 1, scope, revision: state.revision, state });
            } else held.push(message);
        },
    }, onDefect: error => defects.push(String(error)) });
    const root = createRoot(element);
    root.render(<PluginStateProvider definition={definition} client={client}><Controls /></PluginStateProvider>);
    return {
        snapshot: owner.getSnapshot,
        clientSnapshot: client.getSnapshot,
        held: () => held,
        publications: () => publications,
        defects: () => defects,
        async release() {
            for (const message of held.splice(0)) {
                if (message.kind === "command") await owner.dispatch({ kind: "command", address: { ...message.scope, client: message.client, sequence: message.sequence }, command: message.command });
            }
        },
        async resetInvalid() {
            scope = { ...scope, document: scope.document + 1 };
            await owner.dispatch({ kind: "replaced", scope, native: { values: { curve: "corrupt again" }, parameters: [] } });
            receive?.({ kind: "reset", scope });
        },
        async dispose() { root.unmount(); client.stop(); await owner.stop(); },
    };
}
