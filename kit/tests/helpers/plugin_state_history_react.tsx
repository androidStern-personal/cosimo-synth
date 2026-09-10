import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PluginStateProvider, usePluginHistory, usePluginState } from "../../ui/plugin-state-react";
import { definePluginState, parameter } from "../../ui/plugin-state-definition";
import { createPluginStateClient, type PluginStateClientEvent } from "../../ui/plugin-state-client";
import { createPluginStateSession } from "../../ui/plugin-state-session";
import type { PluginStateEditResult, PluginStateHistoryEntry } from "../../index";

const definition = definePluginState({ gain: parameter("gain") });

function Controls() {
    const gain = usePluginState(definition.gain);
    const history = usePluginHistory();
    const [remembered, remember] = useState<PluginStateHistoryEntry>();
    const [result, finish] = useState<PluginStateEditResult>();
    return <>
        <output data-testid="guarded-gain">{JSON.stringify(gain.state)}</output>
        <output data-testid="guarded-result">{JSON.stringify(result ?? null)}</output>
        <button onClick={() => { void gain.setValue(4); }}>Edit four</button>
        <button onClick={() => remember(history.undoEntry)}>Remember Undo</button>
        <button onClick={() => remember(history.redoEntry)}>Remember Redo</button>
        <button onClick={() => { void history.undo(remembered).then(finish); }}>Guarded Undo</button>
        <button onClick={() => { void history.redo(remembered).then(finish); }}>Guarded Redo</button>
    </>;
}

/** React and two actual clients share an actual owner; only transport addresses are supplied here. */
export async function mount(element: HTMLElement) {
    const scope = { owner: "react-history", document: 0 };
    const receivers = new Set<(event: PluginStateClientEvent<typeof definition>) => void>();
    const publications: unknown[] = [];
    const jobs: Promise<unknown>[] = [];
    const defects: string[] = [];
    const owner = createPluginStateSession(definition, { native: {
        publish(publication) { publications.push(publication); },
        update(state, receipt) {
            for (const receive of receivers) receive({ kind: "update", scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) });
        },
        close() {},
    }, onDefect: error => defects.push(String(error)) });
    await owner.dispatch({ kind: "opened", scope, native: { values: {}, parameters: [
        { endpoint: "gain", value: 2, min: 0, max: 10, step: 1, defaultValue: 1 },
    ] } });
    const makeClient = (identity: number) => {
        let receive: ((event: PluginStateClientEvent<typeof definition>) => void) | undefined;
        return createPluginStateClient(definition, { channel: {
            subscribe(listener) { receive = listener; receivers.add(listener); return () => { receivers.delete(listener); }; },
            send(message) {
                if (message.kind === "attach") {
                    const state = owner.getSnapshot();
                    receive?.({ kind: "attached", request: message.request, client: identity, scope, revision: state.revision, state });
                } else jobs.push(owner.dispatch({ kind: "command", address: { ...message.scope, client: identity, sequence: message.sequence }, command: message.command }));
            },
        }, onDefect: error => defects.push(String(error)) });
    };
    const client = makeClient(1), other = makeClient(2);
    const root = createRoot(element);
    root.render(<PluginStateProvider definition={definition} client={client}><Controls /></PluginStateProvider>);
    return {
        otherEdit: (value: number) => other.dispatch({ kind: "edit", key: "gain", value }),
        snapshot: owner.getSnapshot,
        publicationCount: () => publications.length,
        defects: () => defects,
        async dispose() { root.unmount(); client.stop(); other.stop(); await Promise.all(jobs); await owner.stop(); },
    };
}
