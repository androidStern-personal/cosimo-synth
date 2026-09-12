import { createPluginStateClient, type PluginStateClientEvent } from "../plugin-state-client";
import { createPluginStateSession, type PluginStateNativeSnapshot, type PluginStateEvent } from "../plugin-state-session";
import { getDefinitionOptions, type PluginStateFields } from "../plugin-state-definition";
import { pluginStateViewHost, type PluginStateViewHost } from "../plugin-state-view-host";

/** Page-local storage adapter; state, gesture ownership and history stay in the real session. */
export function createBrowserPreviewState(storage: {
    snapshot(): PluginStateNativeSnapshot;
    parameter(endpoint: string, value: number): void;
    stored(key: string, value: unknown): void;
    gesture(endpoint: string, kind: "gesture-start" | "gesture-end"): void;
}) {
    let active: {
        definition: PluginStateFields;
        observe(endpoint: string, value: number): void;
        replace(key: string): void;
        connect(onDefect: (error: unknown) => void): ReturnType<typeof createPluginStateClient<PluginStateFields>>;
        stop(): Promise<void>;
    } | undefined;
    let stopped = false;

    const host: PluginStateViewHost = {
        [pluginStateViewHost](definition, onDefect) {
            if (stopped) throw new Error("The browser preview is closed.");
            if (active && active.definition !== definition) throw new Error("A browser preview connection already owns another state definition.");
            if (!active) {
                let scope = { owner: "browser-preview", document: 0 };
                let nextClient = 0;
                let observation = 0;
                const intents = new Map<string, number>();
                const clients = new Map<number, (event: PluginStateClientEvent<PluginStateFields>) => void>();
                const pending = new Set<Promise<unknown>>();
                const run = (event: PluginStateEvent) => {
                    const job = owner.dispatch(event).catch(onDefect);
                    pending.add(job);
                    void job.finally(() => pending.delete(job));
                };
                const owner = createPluginStateSession(definition, {
                    bindings: [], onDefect, historyLimit: getDefinitionOptions(definition).historyLimit,
                    native: {
                        publish(publication) {
                            for (const operation of publication.operations) {
                                if (operation.kind === "parameter") {
                                    intents.set(operation.endpoint, publication.request);
                                    storage.parameter(operation.endpoint, operation.value);
                                }
                                else if (operation.kind === "stored") storage.stored(operation.key, operation.value);
                                else storage.gesture(operation.endpoint, operation.kind);
                            }
                            run({ kind: "published", scope, request: publication.request, result: { kind: "observed" } });
                        },
                        update(state, receipt) {
                            for (const [client, receive] of clients) receive({ kind: "update", scope, revision: state.revision, state,
                                ...(receipt?.address.client === client ? { receipt } : {}) });
                        },
                        close() { for (const receive of clients.values()) receive({ kind: "closed", reason: "closed" }); },
                    },
                });
                run({ kind: "opened", scope, native: storage.snapshot() });
                active = {
                    definition,
                    observe(endpoint, value) { run({ kind: "parameter", scope, endpoint, value, intent: intents.get(endpoint) ?? 0, origin: "external", observation: ++observation }); },
                    replace(key) {
                        if (definition[key]?.kind !== "stored") return;
                        scope = { ...scope, document: scope.document + 1 };
                        intents.clear();
                        run({ kind: "replaced", scope, native: storage.snapshot(), changedStoredKey: key });
                        for (const receive of clients.values()) receive({ kind: "reset", scope });
                    },
                    connect(clientDefect) {
                        const client = ++nextClient;
                        let receive: ((event: PluginStateClientEvent<PluginStateFields>) => void) | undefined;
                        return createPluginStateClient(definition, { onDefect: clientDefect, channel: {
                            subscribe(listener) {
                                receive = listener; clients.set(client, listener);
                                return () => { clients.delete(client); run({ kind: "detached", scope, client }); };
                            },
                            send(message) {
                                if (message.kind === "attach") {
                                    const state = owner.getSnapshot();
                                    receive?.({ kind: "attached", request: message.request, scope, client, revision: state.revision, state });
                                } else run({ kind: "command", address: { ...message.scope, client, sequence: message.sequence }, command: message.command });
                            },
                        } });
                    },
                    async stop() { await Promise.all(pending); await owner.stop(); clients.clear(); },
                };
            }
            return active.connect(onDefect);
        },
    };
    return {
        host,
        observe(endpoint: string, value: number) { active?.observe(endpoint, value); },
        replace(key: string) { active?.replace(key); },
        async stop() { stopped = true; await active?.stop(); },
    };
}
