import { createRoot } from "react-dom/client";
import { PluginStateProvider } from "../../ui/plugin-state-react";
import { definePluginState, storedValue, usePluginState, usePluginHistory } from "../../index";
import { createPluginStateClient, type PluginStateClientEvent } from "../../ui/plugin-state-client";
import { createPluginStateSession } from "../../ui/plugin-state-session";
import type { EngineApplication, EngineTarget } from "../../ui/plugin-state-engine";

const numberCodec = {
    parse(value: unknown) { return typeof value === "number" && Number.isFinite(value)
        ? { kind: "ok" as const, value } : { kind: "error" as const, message: "Expected a number." }; },
    encode: (value: number) => value, equals: (left: number, right: number) => left === right,
};
const definition = definePluginState({ gain: storedValue({ initial: 1, codec: numberCodec }), other: storedValue({ initial: 0, codec: numberCodec }) });

/** Actual owner/client/history; only engine status is supplied at its external port. */
export async function mount(element: HTMLElement) {
    let scope = { owner: "private-owner", document: 0 };
    const defects: unknown[] = [];
    let receive: ((event: PluginStateClientEvent<typeof definition>) => void) | undefined;
    let target: EngineTarget | undefined;
    let latest: { control: ReturnType<typeof usePluginState<typeof definition.gain>>; history: ReturnType<typeof usePluginHistory> } | undefined;
    const jobs: Promise<unknown>[] = [];
    const held: (() => Promise<unknown>)[] = [];
    let hold = false;
    let otherSequence = 0;
    const owner = createPluginStateSession(definition, {
        bindings: [{ key: "gain", dependencies: [], replace(_input, next) { target = next; }, cancel() {}, async stop() {} }],
        native: { publish() {}, close() {}, update(state, receipt) {
            receive?.({ kind: "update", scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) });
        } }, onDefect: error => defects.push(error),
    });
    await owner.dispatch({ kind: "opened", scope, native: { values: { gain: 2 }, parameters: [] } });
    const client = createPluginStateClient(definition, { channel: {
        subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
        send(message) {
            if (message.kind === "attach") {
                const state = owner.getSnapshot();
                receive?.({ kind: "attached", request: message.request, scope, client: 8, revision: state.revision, state });
            } else {
                const send = () => owner.dispatch({ kind: "command", address: { ...message.scope, client: message.client, sequence: message.sequence }, command: message.command });
                if (hold) held.push(send); else jobs.push(send());
            }
        },
    }, onDefect: error => defects.push(error) });
    function Controls() {
        const control = usePluginState(definition.gain);
        const history = usePluginHistory();
        latest = { control, history };
        return <output data-testid="public-control">{JSON.stringify(control.state)}</output>;
    }
    const root = createRoot(element);
    root.render(<PluginStateProvider definition={definition} client={client}><Controls /></PluginStateProvider>);
    return {
        current() { if (!latest) throw new Error("Control has not mounted."); return latest; },
        holdCommands() { hold = true; },
        async releaseCommands() { hold = false; for (const send of held.splice(0)) await send(); },
        async competingEdit(value: number, key = "gain") {
            return owner.dispatch({ kind: "command", address: { ...scope, client: 9, sequence: ++otherSequence }, command: { kind: "edit", key, value } });
        },
        accepted() { return owner.getSnapshot(); },
        async status(status: EngineApplication) {
            if (!target) throw new Error("The actual owner has not requested an engine target.");
            await owner.dispatch({ kind: "engine", target, status });
        },
        async reset() {
            scope = { ...scope, document: scope.document + 1 };
            await owner.dispatch({ kind: "replaced", scope, native: { values: { gain: 9 }, parameters: [] } });
            receive?.({ kind: "reset", scope });
        },
        defects: () => defects.map(String),
        async dispose() { root.unmount(); client.stop(); await Promise.all(jobs); await owner.stop(); },
    };
}
