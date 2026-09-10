import { createEngineBinding, type EngineApplication, type EngineFailure, type EngineOutcome, type EngineTarget } from "./plugin-state-engine";
import { createPluginStateClient } from "./plugin-state-client";
import { createSharedDataPort } from "./plugin-state-shared-data-port";
import type { PluginStateFields, PluginStateJson } from "./plugin-state-definition";
import { createPluginStateSession, type PluginStateScope, type PluginStateEnginePort, type PluginStateEngineInput, type PluginStateSession } from "./plugin-state-session";
import { encodeEventPayload, encodeStateSnapshot, isBoundedStateJson, isRecord, parseClientMessage, parseClientReceipt, parseServiceMessage } from "./plugin-state-protocol";

/** Existing Cmajor message transport, supplied by a native or browser connection. */
export interface CmajorStateConnection {
    /** Listen to raw state-channel bodies delivered by the connection. */
    addEventListener(type: "kit_state" | "kit_data", listener: (body: unknown) => void): void;
    /** Release a previously installed state-channel listener. */
    removeEventListener(type: "kit_state" | "kit_data", listener: (body: unknown) => void): void;
    /** Send through Cmajor's ordinary scoped native/browser envelope path. */
    sendMessageToServer(message: { readonly type: "kit_state" | "kit_data"; readonly message: unknown }): void;
    /** Needed only by deliveries that declare output endpoint subscriptions. */
    addEndpointListener?(endpoint: string, listener: (value: unknown) => void): void;
    removeEndpointListener?(endpoint: string, listener: (value: unknown) => void): void;
}

/** Native processing evidence, without claiming that the audio engine applied it. */
export type CmajorStatePublicationOutcome =
    | { readonly kind: "sent"; readonly proof: "native-publication-processed" }
    | { readonly kind: "failed"; readonly error: EngineFailure }
    | { readonly kind: "cancelled" };

/** A synchronous connection handoff with a separately owned native receipt. */
export type CmajorStateSubmission =
    | { readonly kind: "submitted"; readonly completion: Promise<CmajorStatePublicationOutcome> }
    | { readonly kind: "failed"; readonly error: EngineFailure }
    | { readonly kind: "cancelled" };

/** Custom engine delivery may publish only its declared event or host effect. */
export type CmajorStateEffect =
    | { readonly kind: "event"; readonly endpoint: string; readonly value: unknown }
    | { readonly kind: "host-effect"; readonly name: string; readonly value: unknown };

/** Advanced worker composition; ordinary plugin authors use eventValue. */
export interface CmajorStateBindingFactory {
    readonly key: string;
    readonly dependencies?: readonly string[];
    readonly eventEndpoints: readonly string[];
    readonly hostEffects?: readonly string[];
    /** Construct an inert port; external resources begin with the first replace. */
    create(context: {
        /** Submit using the immutable document captured by replace, never a mutable latest scope. */
        publish(scope: PluginStateScope, effect: CmajorStateEffect): CmajorStateSubmission;
        /** Report evidence for the exact target that produced it. */
        onStatus(target: EngineTarget, status: EngineApplication): void;
        /** Diagnose a programming defect and close the owning service. */
        onDefect(error: unknown): void;
    }): Pick<PluginStateEnginePort, "replace" | "cancel" | "stop">;
}

const handshakeDeadlineMs = 5000;

type StateBindingDeclaration = CmajorStateBindingFactory & { readonly outputEndpoints?: readonly string[] };

function sameScope(left: PluginStateScope | null, right: PluginStateScope): boolean {
    return left !== null && left.owner === right.owner && left.document === right.document;
}

function captureBindingDeclarations(definition: PluginStateFields, declarations: readonly StateBindingDeclaration[]): readonly StateBindingDeclaration[] {
    const validNames = (names: readonly string[]) => Array.isArray(names) && names.every(value => {
        if (typeof value !== "string" || value.length === 0) return false;
        // encodeURIComponent counts valid UTF-8 here without requiring TextEncoder
        // in native QuickJS. It rejects unmatched surrogate halves.
        try { return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length <= 256; }
        catch { return false; }
    });
    if (!Array.isArray(declarations)) throw new Error("Invalid custom engine binding declarations.");
    const keys = new Set<string>();
    for (const descriptor of declarations) {
        if (!descriptor || typeof descriptor !== "object" || typeof descriptor.create !== "function"
            || !validNames([descriptor.key]) || !Object.hasOwn(definition, descriptor.key))
            throw new Error("Invalid custom engine binding key or factory.");
        const field = definition[descriptor.key];
        if (field?.kind !== "stored" || field.engine?.kind === "event-value" || keys.has(descriptor.key))
            throw new Error("A stored field must have exactly one engine binding.");
        keys.add(descriptor.key);
        const dependencies: readonly string[] = descriptor.dependencies ?? [];
        if (!validNames(dependencies) || dependencies.some(key => !Object.hasOwn(definition, key) || definition[key]?.kind !== "parameter")
            || !validNames(descriptor.eventEndpoints) || !validNames(descriptor.hostEffects ?? []) || !validNames(descriptor.outputEndpoints ?? []))
            throw new Error("Invalid custom engine binding dependency or effect declaration.");
    }
    return Object.freeze(declarations.map(descriptor => Object.freeze({
        key: descriptor.key,
        dependencies: Object.freeze([...(descriptor.dependencies ?? [])]),
        eventEndpoints: Object.freeze([...descriptor.eventEndpoints]),
        hostEffects: Object.freeze([...(descriptor.hostEffects ?? [])]),
        outputEndpoints: Object.freeze([...(descriptor.outputEndpoints ?? [])]),
        create: (context: Parameters<CmajorStateBindingFactory["create"]>[0]) => descriptor.create(context),
    })));
}

/** Compose a patch-lifetime edit service using Cmajor's raw connection seam. */
export function createCmajorPluginStateService<const Fields extends PluginStateFields>(
    definition: Fields,
    connection: CmajorStateConnection,
    options: { readonly onDefect: (error: unknown) => void; readonly bindings?: readonly CmajorStateBindingFactory[] },
) {
    let started = false;
    let stopped = false;
    let dataPort: ReturnType<typeof createSharedDataPort> | undefined;
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
    const enginePublications = new Map<number, { readonly kind: "event-value" | "custom"; readonly key: string; readonly scope: PluginStateScope; readonly finish: (outcome: CmajorStatePublicationOutcome) => void }>();
    const releasePublications = new WeakMap<Promise<CmajorStatePublicationOutcome>, () => void>();
    const bindings: PluginStateEnginePort[] = [];
    for (const [key, field] of Object.entries(definition)) {
        if (field.kind !== "stored" || field.engine?.kind !== "event-value") continue;
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
                                enginePublications.set(request, { kind: "event-value", key, scope: payload.target.scope, finish });
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
                dataPort?.stop();
                for (const pending of enginePublications.values()) pending.finish({ kind: "cancelled" });
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
                if (result.kind !== "accepted") return;
                const current = session.getSnapshot().scope;
                for (const pending of enginePublications.values())
                    if (!sameScope(current, pending.scope)) pending.finish({ kind: "cancelled" });
                for (const [request, pending] of publications)
                    if (!sameScope(current, pending.scope)) publications.delete(request);
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
                if (!sameScope(prepared.scope, message.scope) || !sameScope(session.getSnapshot().scope, message.scope)) return;
                if (prepared.kind === "custom" && message.result.kind === "failed"
                    && (message.result.reason === "stale-scope" || message.result.reason === "closed")) {
                    prepared.finish({ kind: "cancelled" });
                    return;
                }
                prepared.finish(message.result.kind === "observed" ? { kind: "sent", proof: "native-publication-processed" }
                    : { kind: "failed", error: { kind: message.result.reason === "unsupported-host-effect" ? "resource" : "transport", message: message.result.reason } });
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
    const preparedDeclarations = (): StateBindingDeclaration[] => Object.entries(definition).flatMap(([key, field]) => {
        if (field.kind !== "stored" || field.engine?.kind !== "prepared") return [];
        const declaration = field.engine;
        const delivery = declaration.delivery;
        if (!delivery || typeof delivery.create !== "function"
            || (delivery.replacement !== undefined && delivery.replacement !== "supersede" && delivery.replacement !== "finish"))
            throw new Error("Invalid prepared delivery factory or replacement policy.");
        const create = delivery.create.bind(delivery);
        const replacement = delivery.replacement;
        const dataInputs = Object.freeze([...(delivery.dataInputs ?? [])]);
        if (dataInputs.some(input => !Number.isSafeInteger(input) || input < 0 || input > 0x7fffffff))
            throw new Error("Invalid shared-data input declaration.");
        const outputEndpoints = Array.isArray(delivery.outputEndpoints) ? Object.freeze([...delivery.outputEndpoints]) : delivery.outputEndpoints;
        return [{ key, dependencies: declaration.dependencies, eventEndpoints: delivery.eventEndpoints,
            hostEffects: delivery.hostEffects, outputEndpoints,
            create(context) {
                const transport = create();
                const binding = createEngineBinding<PluginStateEngineInput & { readonly target: EngineTarget }, { readonly value: unknown; readonly target: EngineTarget }>({
                    replacement,
                    async prepare(input, signal) {
                        const value = await declaration.prepare(input.value, { parameters: input.parameters, signal });
                        return { kind: "ok", value: { value, target: input.target } };
                    },
                    transport: {
                        async apply(payload, permit) {
                            let delivering = true;
                            const removals = new Set<() => void>();
                            const cleanup = () => { for (const remove of removals) remove(); };
                            const removeAbort = permit.signal.onAbort(cleanup);
                            const deliverySignal = {
                                get aborted() { return !delivering || permit.signal.aborted; },
                                onAbort(listener: () => void) {
                                    if (!delivering || permit.signal.aborted) listener();
                                    else removals.add(listener);
                                    return () => { removals.delete(listener); };
                                },
                            };
                            try {
                                return await transport.apply(payload.value, {
                                    signal: permit.signal,
                                    replaceData(input, samples) {
                                        if (!dataInputs.includes(input)) return Promise.resolve({ kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } });
                                        if (!delivering || permit.signal.aborted || !sameScope(session.getSnapshot().scope, payload.target.scope))
                                            return Promise.resolve({ kind: "cancelled" });
                                        dataPort ??= createSharedDataPort(connection);
                                        return dataPort.replace(input, samples, payload.target, deliverySignal);
                                    },
                                    send(effect) {
                                        if (!delivering || permit.signal.aborted) return { kind: "cancelled" };
                                        const submission = context.publish(payload.target.scope, effect);
                                        if (submission.kind === "submitted") {
                                            const release = releasePublications.get(submission.completion);
                                            if (release) {
                                                removals.add(release);
                                                void submission.completion.then(() => removals.delete(release));
                                            }
                                        }
                                        return submission;
                                    },
                                    listen(endpoint, listener) {
                                        if (!outputEndpoints?.includes(endpoint)) throw new Error("Undeclared engine output endpoint.");
                                        if (!delivering || permit.signal.aborted) return () => {};
                                        let active = true;
                                        const receive = (value: unknown) => {
                                            if (!active || permit.signal.aborted) return;
                                            try { listener(value); }
                                            catch (error) { context.onDefect(error); }
                                        };
                                        const remove = () => {
                                            if (!active) return;
                                            active = false;
                                            removals.delete(remove);
                                            connection.removeEndpointListener?.(endpoint, receive);
                                        };
                                        removals.add(remove);
                                        connection.addEndpointListener?.(endpoint, receive);
                                        return remove;
                                    },
                                });
                            } finally { delivering = false; removeAbort(); cleanup(); }
                        },
                        stop() { transport.stop(); },
                    },
                    onStatus: context.onStatus, onDefect: context.onDefect,
                });
                return {
                    replace(input, target) { binding.replace({ ...input, target }, target); },
                    cancel: binding.cancel, stop: binding.stop,
                };
            },
        }];
    });
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
                const descriptors = captureBindingDeclarations(definition, [...preparedDeclarations(), ...(options.bindings ?? [])]);
                if (descriptors.some(descriptor => descriptor.outputEndpoints?.length)
                    && (typeof connection.addEndpointListener !== "function" || typeof connection.removeEndpointListener !== "function"))
                    throw new Error("Declared engine output listeners are unavailable.");
                for (const descriptor of descriptors) {
                    const port = descriptor.create({
                        publish(requestedScope, effect) {
                            if (stopped || !sameScope(session.getSnapshot().scope, requestedScope)) return { kind: "cancelled" };
                            const scope = Object.freeze({ owner: requestedScope.owner, document: requestedScope.document });
                            if (!effect || typeof effect !== "object" || (effect.kind !== "event" && effect.kind !== "host-effect"))
                                return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
                            const allowed = effect.kind === "event" ? descriptor.eventEndpoints.includes(effect.endpoint)
                                : descriptor.hostEffects?.includes(effect.name);
                            if (!allowed) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
                            const payload = encodeEventPayload(effect.value);
                            if (payload.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: payload.message } };
                            const operation = effect.kind === "event"
                                ? { kind: "event", endpoint: effect.endpoint, value: payload.value }
                                : { kind: "host-effect", name: effect.name, value: payload.value };
                            const body = { kind: "publish", request: nextRequest + 1, scope, operations: [operation] };
                            if (!isBoundedStateJson(body)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
                            const request = ++nextRequest;
                            let finish = (_outcome: CmajorStatePublicationOutcome) => {};
                            const completion = new Promise<CmajorStatePublicationOutcome>(resolve => {
                                finish = outcome => { enginePublications.delete(request); releasePublications.delete(completion); resolve(outcome); };
                            });
                            releasePublications.set(completion, () => finish({ kind: "cancelled" }));
                            enginePublications.set(request, { kind: "custom", key: descriptor.key, scope, finish });
                            try { connection.sendMessageToServer({ type: "kit_state", message: body }); }
                            catch (error: unknown) {
                                const failure = { kind: "failed" as const, error: { kind: "transport" as const, message: "Engine effect handoff is uncertain." } };
                                finish(failure);
                                options.onDefect(error);
                                return failure;
                            }
                            return { kind: "submitted", completion };
                        },
                        onStatus(target, status) { void session.dispatch({ kind: "engine", target, status }); },
                        onDefect(error) { options.onDefect(error); void stop(); },
                    });
                    if (stopped) {
                        // A factory may report a synchronous defect before returning
                        // its port. The already-closed session never acquired it.
                        const cleanup = Promise.resolve().then(() => port.stop()).catch(options.onDefect);
                        stopping = Promise.all([stopping, cleanup]).then(() => {});
                        return starting;
                    }
                    bindings.push({ key: descriptor.key, dependencies: descriptor.dependencies ?? [],
                        replace: (input, target) => port.replace(input, target),
                        cancel: () => port.cancel(), stop: () => port.stop(),
                    });
                }
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
                    eventEndpoints: [...new Set([
                        ...Object.values(definition).flatMap(field => field.kind === "stored" && field.engine?.kind === "event-value" ? [field.engine.endpoint] : []),
                        ...descriptors.flatMap(binding => binding.eventEndpoints),
                    ])],
                    ...(descriptors.some(binding => binding.hostEffects?.length) ? {
                        hostEffects: [...new Set(descriptors.flatMap(binding => binding.hostEffects ?? []))],
                    } : {}),
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
                let attachment: { readonly scope: PluginStateScope; readonly client: number } | undefined;
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
                        if (message.kind === "attached") attachment = { scope: message.scope, client: message.client };
                        listener({ ...message, request: request.local });
                    } else {
                        if (message.kind === "closed"
                            || (message.kind === "reset" && attachment && message.scope.owner === attachment.scope.owner
                                && message.scope.document > attachment.scope.document)
                            || (message.kind === "owner-changed" && attachment && !sameScope(attachment.scope, message.scope))) attachment = undefined;
                        listener(message);
                    }
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
                    const owned = attachment;
                    attachment = undefined;
                    try {
                        if (owned) connection.sendMessageToServer({ type: "kit_state", message: { kind: "detach", ...owned } });
                    } catch (error) { options.onDefect(error); }
                    try { connection.removeEventListener("kit_state", receive); }
                    catch (error) { options.onDefect(error); }
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
