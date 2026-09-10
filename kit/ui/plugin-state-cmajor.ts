import { createEngineBinding, type EngineOutcome, type EngineTarget } from "./plugin-state-engine";
import { createPluginStateClient } from "./plugin-state-client";
import type { PluginStateFields, PluginStateJson } from "./plugin-state-definition";
import { createPluginStateSession, type PluginStateScope, type PluginStateEnginePort, type PluginStateEngineInput, type PluginStateSession } from "./plugin-state-session";
import { encodeEventPayload, encodeStateSnapshot, isBoundedStateJson, isRecord, parseClientMessage, parseClientReceipt, parseServiceMessage } from "./plugin-state-protocol";

/** Existing Cmajor message transport, supplied by a native or browser connection. */
export interface CmajorStateConnection {
    /** Listen to raw state-channel bodies delivered by the connection. */
    addEventListener(type: "kit_state", listener: (body: unknown) => void): void;
    /** Release a previously installed state-channel listener. */
    removeEventListener(type: "kit_state", listener: (body: unknown) => void): void;
    /** Send through Cmajor's ordinary scoped native/browser envelope path. */
    sendMessageToServer(message: { readonly type: "kit_state"; readonly message: unknown }): void;
}

const handshakeDeadlineMs = 5000;

function sameScope(left: PluginStateScope | null, right: PluginStateScope): boolean {
    return left !== null && left.owner === right.owner && left.document === right.document;
}

/** Compose a patch-lifetime edit service using Cmajor's raw connection seam. */
export function createCmajorPluginStateService<const Fields extends PluginStateFields>(
    definition: Fields,
    connection: CmajorStateConnection,
    options: { readonly onDefect: (error: unknown) => void },
) {
    let started = false;
    let stopped = false;
    let nextRequest = 0;
    let openRequest = 0;
    let starting: Promise<void> | undefined;
    let openDeadline: ReturnType<typeof setTimeout> | undefined;
    let stopping: Promise<void> | undefined;
    let finishStart = () => {};
    let failStart: (reason: unknown) => void = () => {};
    const publications = new Map<number, { readonly request: number; readonly scope: PluginStateScope }>();
    const send = (body: unknown) => {
        if (!isBoundedStateJson(body)) throw new Error("State-channel message exceeds the native JSON contract.");
        connection.sendMessageToServer({ type: "kit_state", message: body });
    };
    const enginePublications = new Map<number, { readonly key: string; readonly target: EngineTarget; readonly finish: (outcome: EngineOutcome) => void }>();
    const bindings: PluginStateEnginePort[] = [];
    for (const [key, field] of Object.entries(definition)) {
        if (field.kind !== "stored" || !field.engine) continue;
        const declaration = field.engine;
        const binding = createEngineBinding<PluginStateEngineInput & { readonly target: EngineTarget }, { readonly target: EngineTarget; readonly value: PluginStateJson }>({
            async prepare(input, signal) {
                const payload = await declaration.prepare(input.value, { parameters: input.parameters, signal });
                const parsed = encodeEventPayload(payload);
                return parsed.kind === "ok" ? { kind: "ok", value: { target: input.target, value: parsed.value } }
                    : { kind: "error", error: { kind: "engine-rejected", message: parsed.message } };
            },
            transport: {
                apply(payload, permit) {
                    return new Promise<EngineOutcome>(resolve => {
                        let request = 0;
                        let remove = () => {};
                        const finish = (outcome: EngineOutcome) => { remove(); enginePublications.delete(request); resolve(outcome); };
                        remove = permit.signal.onAbort(() => finish({ kind: "cancelled" }));
                        try {
                            const handoff = permit.send(() => {
                                if (!sameScope(session.getSnapshot().scope, payload.target.scope)) return { kind: "cancelled" };
                                request = ++nextRequest;
                                enginePublications.set(request, { key, target: payload.target, finish });
                                send({ kind: "publish", request, scope: payload.target.scope,
                                    operations: [{ kind: "event", endpoint: declaration.endpoint, value: payload.value }],
                                });
                                return { kind: "sent", proof: "connection-call-returned" };
                            });
                            if (handoff.kind !== "sent") finish(handoff);
                        } catch (error) {
                            remove();
                            enginePublications.delete(request);
                            options.onDefect(error);
                            void stop();
                            resolve({ kind: "cancelled" });
                        }
                    });
                },
                stop() {
                    for (const pending of enginePublications.values()) if (pending.key === key) pending.finish({ kind: "cancelled" });
                },
            },
            onStatus(target, status) { void session.dispatch({ kind: "engine", target, status }); },
            onDefect: options.onDefect,
        });
        bindings.push({ key, dependencies: declaration.dependencies,
            replace(input, target) { binding.replace({ ...input, target }, target); }, cancel: binding.cancel, stop: binding.stop,
        });
    }
    const session: PluginStateSession<Fields> = createPluginStateSession(definition, {
        bindings,
        onDefect: options.onDefect,
        native: {
            publish(publication) {
                const request = ++nextRequest;
                publications.set(request, { request: publication.request, scope: publication.scope });
                send({ kind: "publish", ...publication, request });
            },
            update(snapshot, receipt) {
                if (snapshot.scope) send({ kind: "update", scope: snapshot.scope, revision: snapshot.revision,
                    state: encodeStateSnapshot(definition, snapshot), ...(receipt ? { receipt } : {}),
                });
            },
            close(reason) {
                stopped = true;
                failStart(new Error("State service closed before native initialization completed."));
                try { if (started && session.getSnapshot().scope) send({ kind: "close", ...reason }); }
                catch (error) { options.onDefect(error); }
                if (started) connection.removeEventListener("kit_state", receive);
                started = false;
                publications.clear();
            },
        },
    });
    const process = (body: unknown) => {
        if (stopped) return;
        const parsed = parseServiceMessage(body);
        if (parsed.kind === "invalid") {
            const problem = new Error(parsed.message);
            options.onDefect(problem);
            failStart(problem);
            void stop();
            return;
        }
        const message = parsed.value;
        if (message.kind === "closed") {
            failStart(new Error(`Native state service closed: ${message.reason}`));
            void stop();
        } else if (message.kind === "open-failed") {
            if (message.request !== openRequest || session.getSnapshot().scope) return;
            failStart(new Error(`Native state open failed: ${message.reason}`));
            void stop();
        } else if (message.kind === "opened") {
            if (message.request !== openRequest || session.getSnapshot().scope) return;
            void session.dispatch(message).then(result => {
                if (result.kind === "accepted") finishStart();
                else failStart(new Error("Native state could not initialize the service."));
            });
        } else if (message.kind === "attached-client") {
            const snapshot = session.getSnapshot();
            if (sameScope(snapshot.scope, message.scope)) send({ kind: "snapshot", scope: message.scope,
                to: message.client, attachRequest: message.request, revision: snapshot.revision,
                state: encodeStateSnapshot(definition, snapshot),
            });
        } else if (message.kind === "detach") {
            void session.dispatch({ kind: "detached", scope: message.scope, client: message.client });
        } else if (message.kind === "parameter") {
            if (sameScope(session.getSnapshot().scope, message.scope)) void session.dispatch(message);
        } else if (message.kind === "replaced") {
            void session.dispatch(message).then(result => {
                if (result.kind === "accepted") for (const [request, pending] of publications)
                    if (!sameScope(session.getSnapshot().scope, pending.scope)) publications.delete(request);
            });
        } else if (message.kind === "command") {
            void session.dispatch(message);
        } else if (message.kind === "invalid-command") {
            if (sameScope(session.getSnapshot().scope, message.address)) send({ kind: "receipt", address: message.address,
                result: { kind: "rejected", reason: "invalid-command" },
            });
        } else {
            const prepared = enginePublications.get(message.request);
            if (prepared) {
                if (!sameScope(prepared.target.scope, message.scope) || !sameScope(session.getSnapshot().scope, message.scope)) return;
                prepared.finish(message.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" }
                    : { kind: "failed", error: { kind: "transport", message: message.result.reason } });
                return;
            }
            const pending = publications.get(message.request);
            if (!pending || !sameScope(pending.scope, message.scope) || !sameScope(session.getSnapshot().scope, message.scope)) return;
            publications.delete(message.request);
            void session.dispatch({ ...message, request: pending.request });
        }
    };
    const receive = (body: unknown) => {
        if (stopped) return;
        try { process(body); }
        catch (error) {
            options.onDefect(error);
            failStart(error);
            void stop();
        }
    };
    const stop = (): Promise<void> => {
        if (stopping) return stopping;
        stopped = true;
        failStart(new Error("State service stopped before native initialization completed."));
        stopping = session.stop();
        return stopping;
    };
    return {
        /** Open declared native state before making the worker service ready. */
        start(): Promise<void> {
            if (stopped) return Promise.reject(new Error("State service is closed."));
            if (starting) return starting;
            if (typeof connection.addEventListener !== "function" || typeof connection.removeEventListener !== "function"
                || typeof connection.sendMessageToServer !== "function") {
                void stop();
                return Promise.reject(new Error("Cmajor state-channel capabilities are unavailable."));
            }
            starting = new Promise((resolve, reject) => {
                finishStart = () => { clearTimeout(openDeadline); resolve(); };
                failStart = reason => { clearTimeout(openDeadline); reject(reason); };
            });
            try {
                started = true;
                connection.addEventListener("kit_state", receive);
                openRequest = ++nextRequest;
                openDeadline = setTimeout(() => {
                    failStart(new Error("Cmajor state-channel is unavailable: native open timed out."));
                    void stop();
                }, handshakeDeadlineMs);
                send({ kind: "open", request: openRequest,
                    parameters: Object.values(definition).filter(field => field.kind === "parameter").map(field => field.endpoint),
                    storedKeys: Object.keys(definition).filter(key => definition[key]?.kind === "stored"),
                    eventEndpoints: Object.values(definition).flatMap(field => field.kind === "stored" && field.engine ? [field.engine.endpoint] : []),
                });
            } catch (error) {
                options.onDefect(error);
                failStart(error);
                void stop();
            }
            return starting;
        },
        /** Release this owner and its channel resources. */
        stop,
    };
}

// A connection can outlive both a mount and its bundled adapter module. Share
// only its weak attachment counter across module copies in the same JS realm.
const attachRegistryKey = Symbol.for("builder-kit.plugin-state.attach-requests.v1");
const existingAttachRegistry: unknown = Reflect.get(globalThis, attachRegistryKey);
const attachRequests: WeakMap<object, unknown> = existingAttachRegistry instanceof WeakMap
    ? existingAttachRegistry : new WeakMap<object, unknown>();
if (existingAttachRegistry !== attachRequests) Object.defineProperty(globalThis, attachRegistryKey, { value: attachRequests });

/** Compose one GUI binding over a raw Cmajor connection. */
export function createCmajorPluginStateClient<const Fields extends PluginStateFields>(
    definition: Fields, connection: CmajorStateConnection, options: { readonly onDefect: (error: unknown) => void },
) {
    const requests = new Map<number, { readonly local: number; readonly deadline: ReturnType<typeof setTimeout> }>();
    const clearRequests = () => {
        for (const request of requests.values()) clearTimeout(request.deadline);
        requests.clear();
    };
    let timeout: (request: number) => void = () => {};
    return createPluginStateClient(definition, { onDefect: options.onDefect,
        channel: {
            subscribe(listener) {
                let active = true;
                const process = (body: unknown) => {
                    // Reject old mount correlations before codec work or projection.
                    if (isRecord(body) && (body.kind === "attached" || body.kind === "attach-failed")
                        && (typeof body.request !== "number" || !requests.has(body.request))) return;
                    const parsed = parseClientMessage(definition, body);
                    if (parsed.kind === "invalid") throw new Error(parsed.message);
                    const message = parsed.value;
                    if (message.kind === "attached" || message.kind === "attach-failed") {
                        const request = requests.get(message.request);
                        if (request === undefined) return;
                        requests.delete(message.request);
                        clearTimeout(request.deadline);
                        listener({ ...message, request: request.local });
                    } else listener(message);
                };
                const receive = (body: unknown) => {
                    if (!active) return;
                    try { process(body); }
                    catch (error) {
                        const receipt = parseClientReceipt(body);
                        if (receipt) listener({ kind: "receipt", ...receipt });
                        options.onDefect(error);
                        listener({ kind: "closed", reason: "service-closed" });
                    }
                };
                const release = () => {
                    if (!active) return;
                    active = false;
                    clearRequests();
                    connection.removeEventListener("kit_state", receive);
                };
                timeout = request => {
                    if (!active) return;
                    listener({ kind: "attach-failed", request, reason: "state-channel-unavailable" });
                    release();
                };
                try { connection.addEventListener("kit_state", receive); }
                catch (error) { release(); throw error; }
                return release;
            },
            send(message) {
                if (message.kind !== "attach") {
                    connection.sendMessageToServer({ type: "kit_state", message });
                    return;
                }
                const previous = attachRequests.get(connection);
                const request = typeof previous === "number" && Number.isSafeInteger(previous) && previous > 0 ? previous + 1 : 1;
                if (!Number.isSafeInteger(request)) throw new Error("State attachment request sequence is exhausted.");
                attachRequests.set(connection, request);
                clearRequests();
                requests.set(request, { local: message.request,
                    deadline: setTimeout(() => timeout(message.request), handshakeDeadlineMs),
                });
                connection.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request } });
            },
        },
    });
}
