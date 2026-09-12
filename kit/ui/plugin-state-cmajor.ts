import { createPatchConnectionResourceClient, type PatchConnectionResourceSource } from "./resource-client";
import { createEngineBinding, type EngineApplication, type EngineFailure, type EngineOutcome, type EngineTarget } from "./plugin-state-engine";
import { createPluginStateClient } from "./plugin-state-client";
import { createStateLifetime } from "./plugin-state-lifetime";
import { getDefinitionOptions, isPreparationFailure, sharedStateResources, type PluginStateDocumentContext, type PluginStateFields, type PluginStateJson, type PluginStatePreparedValue } from "./plugin-state-definition";
import type { SharedDataConnection } from "./prepared-shared-data";
import { createDirectDataPort } from "./plugin-state-direct-data";
import { createPluginStateSession, type PluginStateScope, type PluginStateEnginePort, type PluginStateEngineInput, type PluginStateSession } from "./plugin-state-session";
import { encodeEventPayload, encodeStateSnapshot, isBoundedStateJson, isRecord, parseClientMessage, parseClientReceipt, parseServiceMessage } from "./plugin-state-protocol";

/** Existing Cmajor message transport, supplied by a native or browser connection. */
export interface CmajorStateConnection extends SharedDataConnection, PatchConnectionResourceSource {
    /** Listen to raw state-channel bodies delivered by the connection. */
    addEventListener(type: "kit_state" | "kit_data", listener: (body: unknown) => void): void;
    /** Release a previously installed state-channel listener. */
    removeEventListener(type: "kit_state" | "kit_data", listener: (body: unknown) => void): void;
    /** Send through Cmajor's ordinary scoped native/browser envelope path. */
    sendMessageToServer(message: { readonly type: "kit_state" | "kit_data"; readonly message: unknown }): void;
    /** Needed only by deliveries that declare output endpoint subscriptions. */
    addEndpointListener?(endpoint: string, listener: (value: unknown) => void): void;
    removeEndpointListener?(endpoint: string, listener: (value: unknown) => void): void;
    addStoredStateValueListener?(listener: (message: unknown) => void): void;
    removeStoredStateValueListener?(listener: (message: unknown) => void): void;
    requestFullStoredState?(callback: (state: unknown) => void): void;
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

const handshakeDeadlineMs = 5000;

function sameScope(left: PluginStateScope | null, right: PluginStateScope): boolean {
    return left !== null && left.owner === right.owner && left.document === right.document;
}

type PreparedField = { readonly key: string; readonly declaration: PluginStatePreparedValue<unknown> };

/** Validate all declarations before any field acquires external resources. */
function preparedFields(definition: PluginStateFields): readonly PreparedField[] {
    const validNames = (names: readonly string[]) => Array.isArray(names) && names.every(value => {
        if (typeof value !== "string" || value.length === 0) return false;
        try { return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length <= 256; }
        catch { return false; }
    });
    return Object.entries(definition).flatMap(([key, field]) => {
        if (field.kind !== "stored" || field.engine?.kind !== "prepared") return [];
        const declaration = field.engine, delivery = declaration.delivery;
        if (!validNames([key]) || !delivery || typeof delivery.create !== "function"
            || (delivery.replacement !== undefined && delivery.replacement !== "supersede" && delivery.replacement !== "finish")
            || !validNames(declaration.dependencies) || declaration.dependencies.some(name => definition[name]?.kind !== "parameter")
            || !validNames(delivery.eventEndpoints) || !validNames(delivery.hostEffects ?? [])
            || !validNames(delivery.outputEndpoints ?? []) || !validNames(delivery.storedKeys ?? [])
            || !Array.isArray(delivery.dataInputs ?? [])
            || delivery.dataInputs?.some(input => !Number.isSafeInteger(input) || input < 0 || input > 0x7fffffff))
            throw new Error("Invalid prepared delivery declaration.");
        return [{ key, declaration: { ...declaration, delivery: Object.freeze({ ...delivery,
            create: delivery.create.bind(delivery),
            eventEndpoints: Object.freeze([...delivery.eventEndpoints]),
            outputEndpoints: Object.freeze([...(delivery.outputEndpoints ?? [])]),
            storedKeys: Object.freeze([...(delivery.storedKeys ?? [])]),
            hostEffects: Object.freeze([...(delivery.hostEffects ?? [])]),
            dataInputs: Object.freeze([...(delivery.dataInputs ?? [])]),
        }) } }];
    });
}

/** Compose a patch-lifetime edit service using Cmajor's raw connection seam. */
export function createCmajorPluginStateService<const Fields extends PluginStateFields>(
    definition: Fields,
    connection: CmajorStateConnection,
    options: { readonly onDefect: (error: unknown) => void },
) {
    let started = false;
    let stopped = false;
    let directData: ReturnType<typeof createDirectDataPort> | undefined;
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
    const bindings: PluginStateEnginePort[] = [];
    const resources = createPatchConnectionResourceClient(connection);
    function authorWrite(write: () => void | import("./plugin-state-definition").PluginStatePreparationFailure) {
        try { return write(); }
        catch (error) {
            options.onDefect(error);
            return { kind: "failed" as const, error: { kind: "defect" as const, message: "Data preparation failed unexpectedly." } };
        }
    }
    async function authorPreparation<Value>(prepare: () => Value | Promise<Value>): Promise<import("./plugin-state-engine").Prepared<Value>> {
        try { return { kind: "ok", value: await prepare() }; }
        catch (error) {
            options.onDefect(error);
            return { kind: "error", error: { kind: "defect", message: "Preparation failed unexpectedly." } };
        }
    }
    for (const { key, input: resourceInput } of sharedStateResources(definition)) {
        const field = definition[key];
        if (field?.kind !== "stored" || field.engine?.kind !== "shared-prepared") continue;
        const declaration = field.engine;
        const binding = createEngineBinding<PluginStateEngineInput & { readonly target: EngineTarget }, {
            readonly plan: import("./plugin-state-definition").PluginStateSharedPlan; readonly target: EngineTarget;
        }>({
            async prepare(input, signal) {
                const prepared = await authorPreparation(() => declaration.prepare(input.value, { resources, parameters: input.parameters, signal }));
                if (prepared.kind === "error") return prepared;
                const plan = prepared.value;
                if (isPreparationFailure(plan)) return { kind: "error", error: plan.error };
                if (!plan || !Number.isSafeInteger(plan.length) || plan.length <= 0 || typeof plan.write !== "function")
                    return { kind: "error", error: { kind: "resource", message: "Prepared data has an invalid size or writer." } };
                return { kind: "ok", value: { plan, target: input.target } };
            },
            transport: {
                apply(payload, permit) {
                    if (permit.signal.aborted || !sameScope(session.getSnapshot().scope, payload.target.scope))
                        return Promise.resolve({ kind: "cancelled" });
                    directData ??= createDirectDataPort(connection);
                    const bytes = declaration.storage.type === "float32" ? payload.plan.length * 4 : payload.plan.length;
                    return directData.prepare({ input: resourceInput, byteLength: bytes }, payload.target, permit.signal, destination => {
                        const view = declaration.storage.type === "float32"
                            ? new Float32Array(destination.buffer, destination.byteOffset, payload.plan.length)
                            : new Uint8Array(destination.buffer, destination.byteOffset, payload.plan.length);
                        const result = authorWrite(() => payload.plan.write(view));
                        if (result) return result;
                        if (view instanceof Float32Array && !view.every(Number.isFinite))
                            return { kind: "preparation-error", error: { kind: "resource", message: "Prepared samples must be finite." } };
                    });
                },
                stop() {},
            },
            onStatus(target, status) { void session.dispatch({ kind: "engine", target, status }); },
            onDefect(error) { options.onDefect(error); void stop(); },
        });
        bindings.push({ key, dependencies: declaration.dependencies,
            replace(input, target) { binding.replace({ ...input, target }, target); }, cancel: binding.cancel, stop: binding.stop,
        });
    }
    for (const [key, field] of Object.entries(definition)) {
        if (field.kind !== "stored" || field.engine?.kind !== "event-value") continue;
        const declaration = field.engine;
        const binding = createEngineBinding<PluginStateEngineInput & { readonly target: EngineTarget }, { readonly target: EngineTarget; readonly value: PluginStateJson }>({
            async prepare(input, signal) {
                const prepared = await authorPreparation(() => declaration.prepare(input.value, { resources, parameters: input.parameters, signal }));
                if (prepared.kind === "error") return prepared;
                const payload = prepared.value;
                if (isPreparationFailure(payload)) return { kind: "error", error: payload.error };
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
        historyLimit: getDefinitionOptions(definition).historyLimit,
        bindings,
        onDefect: options.onDefect,
        native: {
            publish(publication) {
                const request = ++nextRequest;
                publications.set(request, { request: publication.request, scope: publication.scope });
                send({ kind: "publish", ...publication, request, operations: publication.operations.map(operation =>
                    operation.kind === "parameter" ? { ...operation, intent: publication.request } : operation) });
            },
            update(snapshot, receipt) {
                if (snapshot.scope) send({ kind: "update", scope: snapshot.scope, revision: snapshot.revision,
                    state: encodeStateSnapshot(definition, snapshot), ...(receipt ? { receipt } : {}),
                });
            },
            close(reason) {
                stopped = true;
                directData?.stop();
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
    function fail(error: unknown) { options.onDefect(error); void stop(); }
    function preparedPort({ key, declaration }: PreparedField): PluginStateEnginePort {
        const delivery = declaration.delivery;
        let document: ReturnType<typeof openDocument> | undefined;
        let closed = false;
        const closing = new Set<Promise<void>>();
        function closeDocument() {
            const old = document; document = undefined;
            if (!old) return;
            const work = old.close(); closing.add(work);
            void work.then(() => closing.delete(work), error => { closing.delete(work); fail(error); });
        }
        function openDocument(target: EngineTarget) {
            const scope = Object.freeze({ ...target.scope });
            const lifetime = createStateLifetime();
            const signal = lifetime.signal;
            let currentTarget = target;
            function publish(owner: ReturnType<typeof createStateLifetime>, effect: CmajorStateEffect): CmajorStateSubmission {
                if (owner.signal.aborted || stopped || !sameScope(session.getSnapshot().scope, scope)) return { kind: "cancelled" };
                if (!effect || typeof effect !== "object" || (effect.kind !== "event" && effect.kind !== "host-effect"))
                    return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid engine effect." } };
                const allowed = effect.kind === "event" ? delivery.eventEndpoints.includes(effect.endpoint) : delivery.hostEffects?.includes(effect.name);
                if (!allowed) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared engine effect." } };
                const payload = encodeEventPayload(effect.value);
                if (payload.kind !== "ok") return { kind: "failed", error: { kind: "engine-rejected", message: payload.message } };
                const operation = effect.kind === "event" ? { kind: "event", endpoint: effect.endpoint, value: payload.value }
                    : { kind: "host-effect", name: effect.name, value: payload.value };
                const body = { kind: "publish", request: nextRequest + 1, scope, operations: [operation] };
                if (!isBoundedStateJson(body)) return { kind: "failed", error: { kind: "engine-rejected", message: "Engine effect exceeds the native JSON contract." } };
                const request = ++nextRequest;
                let finish = (_outcome: CmajorStatePublicationOutcome) => {};
                const completion = new Promise<CmajorStatePublicationOutcome>(resolve => {
                    let remove = () => {};
                    finish = outcome => { if (!enginePublications.delete(request)) return; remove(); resolve(outcome); };
                    enginePublications.set(request, { kind: "custom", key, scope, finish });
                    remove = owner.signal.onAbort(() => finish({ kind: "cancelled" }));
                });
                try { connection.sendMessageToServer({ type: "kit_state", message: body }); }
                catch (error) {
                    const failure = { kind: "failed" as const, error: { kind: "transport" as const, message: "Engine effect handoff is uncertain." } };
                    finish(failure); options.onDefect(error); return failure;
                }
                return { kind: "submitted", completion };
            }
            function listen(owner: ReturnType<typeof createStateLifetime>, endpoint: string, listener: (value: unknown) => void) {
                if (!delivery.outputEndpoints?.includes(endpoint)) throw new Error("Undeclared engine output endpoint.");
                if (owner.signal.aborted) return () => {};
                let listening = true, detach = () => {};
                const receive = (value: unknown) => {
                    if (!listening || owner.signal.aborted) return;
                    try { listener(value); } catch (error) { fail(error); }
                };
                const remove = () => {
                    if (!listening) return;
                    listening = false; detach(); connection.removeEndpointListener?.(endpoint, receive);
                };
                detach = owner.signal.onAbort(remove);
                connection.addEndpointListener?.(endpoint, receive);
                return remove;
            }
            const preparationResources = resources;
            const documentResources: PluginStateDocumentContext = {
                signal, send: effect => publish(lifetime, effect), listen: (endpoint, listener) => listen(lifetime, endpoint, listener),
                readStored(name) {
                    if (!delivery.storedKeys?.includes(name)) throw new Error("Undeclared stored-state input.");
                    if (signal.aborted) return Promise.resolve(undefined);
                    return new Promise(resolve => {
                        const remove = signal.onAbort(() => resolve(undefined));
                        connection.requestFullStoredState?.(state => {
                            remove();
                            const values = isRecord(state) && isRecord(state.values) ? state.values : state;
                            resolve(!signal.aborted && isRecord(values) ? values[name] : undefined);
                        });
                    });
                },
                subscribeStored(name, listener) {
                    if (!delivery.storedKeys?.includes(name)) throw new Error("Undeclared stored-state input.");
                    if (signal.aborted) return () => {};
                    let listening = true, detach = () => {};
                    const receive = (message: unknown) => {
                        if (!listening || signal.aborted || !isRecord(message) || message.key !== name) return;
                        try { listener(message.value); } catch (error) { fail(error); }
                    };
                    const remove = () => {
                        if (!listening) return;
                        listening = false; detach(); connection.removeStoredStateValueListener?.(receive);
                    };
                    detach = signal.onAbort(remove); connection.addStoredStateValueListener?.(receive);
                    return remove;
                },
                async prepareData(input, byteLength, writer, requestSignal) {
                    if (!delivery.dataInputs?.includes(input)) return { kind: "failed", error: { kind: "engine-rejected", message: "Undeclared shared-data input." } };
                    const operation = requestSignal ? createStateLifetime(signal, requestSignal) : createStateLifetime(signal);
                    try {
                        directData ??= createDirectDataPort(connection);
                        return await directData.prepare({ input, byteLength }, { ...currentTarget, scope }, operation.signal, destination => authorWrite(() => writer(destination)));
                    } finally { operation.cancel(); }
                },
                report(status) { if (!signal.aborted) void session.dispatch({ kind: "engine", target: currentTarget, status }); },
                fail(error) { if (!signal.aborted) fail(error); },
            };
            let transport: ReturnType<typeof delivery.create>;
            try { transport = delivery.create(documentResources); }
            catch (error) { lifetime.cancel(); throw error; }
            const binding = createEngineBinding<PluginStateEngineInput & { readonly target: EngineTarget }, { readonly value: unknown; readonly target: EngineTarget }>({
                replacement: delivery.replacement,
                async prepare(input, cancellation) {
                    const prepared = await authorPreparation(() => declaration.prepare(input.value, { resources: preparationResources, parameters: input.parameters, signal: cancellation }));
                    if (prepared.kind === "error") return prepared;
                    const value = prepared.value;
                    return isPreparationFailure(value) ? { kind: "error", error: value.error } : { kind: "ok", value: { value, target: input.target } };
                },
                transport: {
                    async apply(payload, permit) {
                        currentTarget = payload.target;
                        const application = createStateLifetime(signal, permit.signal);
                        try {
                            return await transport.apply(payload.value, {
                                signal: application.signal, send: effect => publish(application, effect),
                                listen: (endpoint, listener) => listen(application, endpoint, listener),
                            });
                        } finally { application.cancel(); }
                    },
                    stop() { return transport.stop(); },
                },
                onStatus(next, status) { void session.dispatch({ kind: "engine", target: next, status }); }, onDefect: fail,
            });
            return { scope, binding, close() { lifetime.cancel(); return binding.stop(); } };
        }
        return {
            key, dependencies: declaration.dependencies,
            replace(input, target) {
                if (closed) return;
                if (!document || !sameScope(document.scope, target.scope)) { closeDocument(); document = openDocument(target); }
                if (closed) { closeDocument(); return; }
                document.binding.replace({ ...input, target }, target);
            },
            cancel: closeDocument,
            async stop() { closed = true; closeDocument(); await Promise.all(closing); },
        };
    }
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
                if ("bindings" in options) throw new Error("Declare engine delivery with preparedState instead of service bindings.");
                const fields = preparedFields(definition);
                if (fields.some(({ declaration }) => declaration.delivery.outputEndpoints?.length)
                    && (typeof connection.addEndpointListener !== "function" || typeof connection.removeEndpointListener !== "function"))
                    throw new Error("Declared engine output listeners are unavailable.");
                if (fields.some(({ declaration }) => declaration.delivery.storedKeys?.length)
                    && (typeof connection.addStoredStateValueListener !== "function" || typeof connection.removeStoredStateValueListener !== "function"
                        || typeof connection.requestFullStoredState !== "function"))
                    throw new Error("Declared stored-state inputs are unavailable.");
                for (const field of fields) bindings.push(preparedPort(field));
                started = true;
                connection.addEventListener("kit_state", receive);
                openRequest = ++nextRequest;
                openDeadline = setTimeout(() => {
                    failStart(new Error("Cmajor state-channel is unavailable: native open timed out."));
                    void stop();
                }, handshakeDeadlineMs);
                send({ kind: "open", request: openRequest,
                    parameters: Object.values(definition).filter(field => field.kind === "parameter").map(field => field.endpoint),
                    storedKeys: Object.keys(definition).filter(key => definition[key]?.kind === "stored" && definition[key].lifetime !== "instance"),
                    eventEndpoints: [...new Set([
                        ...Object.values(definition).flatMap(field => field.kind === "stored" && field.engine?.kind === "event-value" ? [field.engine.endpoint] : []),
                        ...fields.flatMap(field => field.declaration.delivery.eventEndpoints),
                    ])],
                    ...(fields.some(field => field.declaration.delivery.hostEffects?.length) ? {
                        hostEffects: [...new Set(fields.flatMap(field => field.declaration.delivery.hostEffects ?? []))],
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
