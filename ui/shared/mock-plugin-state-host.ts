import { createCmajorPluginStateService, type CmajorStateBindingFactory, type CmajorStateConnection } from "../../kit/ui/plugin-state-cmajor";
import type { PluginStateNativeParameter, PluginStateScope } from "../../kit/ui/plugin-state-session";
import { synthPluginState } from "./synth-plugin-state";

type Listener = (body: unknown) => void;
type Envelope = { readonly type: "kit_state"; readonly message: unknown };
type Port = CmajorStateConnection & { deliverMessageFromServer(envelope: Envelope): void };
type NativeRequest =
    | { readonly kind: "open"; readonly scope: PluginStateScope; readonly parameters: readonly string[] }
    | { readonly kind: "restore"; readonly scope: PluginStateScope }
    | { readonly kind: "read"; readonly scope: PluginStateScope; readonly endpoint: string }
    | { readonly kind: "effect"; readonly scope: PluginStateScope; readonly operation:
        | { readonly kind: "parameter"; readonly endpoint: string; readonly value: number }
        | { readonly kind: "event"; readonly endpoint: string; readonly value: unknown } }
    | { readonly kind: "close" };
interface Channel {
    receive(source: Port, body: unknown): boolean;
    observeParameter(scope: PluginStateScope, endpoint: string): void;
    replaceStoredValue(key: string, write: () => void): boolean;
    close(): void;
}
export interface MockPluginStateChannelModule {
    readonly PluginStateChannel: new (
        worker: Port, native: (request: NativeRequest) => Promise<unknown>,
        values: (keys: readonly string[]) => Record<string, unknown>,
        writeStored: (key: string, value: unknown) => void, views: () => Set<Port>,
        handleHostEffect?: (name: string, value: unknown) => boolean,
    ) => Channel;
}

/** Simulate only native storage and transport; the real service owns all edit policy. */
export function createMockPluginStateHost(options: {
    readonly readParameter: (endpoint: string, signal: AbortSignal) => Promise<PluginStateNativeParameter>;
    readonly writeParameter: (endpoint: string, value: number) => void;
    /** The same saved values exposed by the development patch connection. */
    readonly storedValues?: { read(key: string): unknown; write(key: string, value: unknown): void };
    readonly engine?: {
        readonly bindings: readonly CmajorStateBindingFactory[];
        sendEvent(endpoint: string, value: unknown): void;
        handleHostEffect(name: string, value: unknown): boolean;
    };
    /** Record outgoing service gesture requests, not proof of DAW delivery. */
    readonly beginGesture: (endpoint: string) => void;
    readonly endGesture: (endpoint: string) => void;
    readonly onDefect: (error: unknown) => void;
    readonly loadChannel?: () => Promise<MockPluginStateChannelModule>;
}) {
    let channel: Channel | undefined;
    let scope: PluginStateScope | undefined;
    let stopped = false;
    let initialized = false;
    let stopping: Promise<void> | undefined;
    const pending: Envelope[] = [];
    const gestures = new Set<string>();
    const stored = new Map<string, unknown>();
    const storedValues = options.storedValues ?? { read: (key: string) => stored.get(key), write: (key: string, value: unknown) => { stored.set(key, value); } };
    let parameterEndpoints: readonly string[] = [];
    const reads = new AbortController();
    const finishGestures = () => {
        for (const endpoint of gestures) { gestures.delete(endpoint); options.endGesture(endpoint); }
    };
    const send = (port: Port, envelope: Envelope) => {
        if (!channel) throw new Error("Mock native state channel is not initialized.");
        // Match AudioWorkletPatchConnection: false means the channel ignored
        // an obsolete/unhandled envelope, not that the physical send threw.
        return channel.receive(port, envelope.message);
    };
    const makePort = (worker: boolean): Port => {
        const listeners = new Set<Listener>();
        const port: Port = {
            addEventListener(_type, listener) { listeners.add(listener); },
            removeEventListener(_type, listener) { listeners.delete(listener); },
            deliverMessageFromServer(envelope) { for (const listener of [...listeners]) listener(envelope.message); },
            sendMessageToServer(envelope) {
                if (!worker && stopped) throw new Error("Mock state host is stopped.");
                if (!worker && !initialized) { pending.push(structuredClone(envelope)); return; }
                send(port, envelope);
                // The browser channel has no DAW gesture callback. This external
                // host records the real service's requests, without accepting edits.
                const body = envelope.message;
                if (worker && typeof body === "object" && body !== null && "kind" in body && body.kind === "publish"
                    && "operations" in body && Array.isArray(body.operations)) {
                    for (const operation of body.operations) {
                        if (operation.kind === "gesture-start") {
                            gestures.add(operation.endpoint);
                            options.beginGesture(operation.endpoint);
                        } else if (operation.kind === "gesture-end") {
                            gestures.delete(operation.endpoint);
                            options.endGesture(operation.endpoint);
                        }
                    }
                }
            },
        };
        return port;
    };
    const worker = makePort(true);
    const view = makePort(false);
    const service = createCmajorPluginStateService(synthPluginState, worker, { onDefect: options.onDefect, bindings: options.engine?.bindings });
    let settleStopped = () => {};
    const stoppedReady = new Promise<void>(resolve => { settleStopped = resolve; });
    const initialization = (async () => {
        const moduleURL = "/cmaj_api/cmaj-plugin-state-channel.js";
        // The module comes from the staged dependency, not an alternate policy implementation.
        const { PluginStateChannel } = await (options.loadChannel?.() ?? import(/* @vite-ignore */ moduleURL));
        if (stopped) return;
        channel = new PluginStateChannel(worker, async (request: NativeRequest) => {
            switch (request.kind) {
                case "open":
                    scope = request.scope;
                    parameterEndpoints = request.parameters;
                    return { parameters: await Promise.all(request.parameters.map(endpoint => options.readParameter(endpoint, reads.signal))) };
                case "restore":
                    scope = request.scope;
                    finishGestures();
                    return { parameters: await Promise.all(parameterEndpoints.map(endpoint => options.readParameter(endpoint, reads.signal))) };
                case "read": return { value: (await options.readParameter(request.endpoint, reads.signal)).value };
                case "effect":
                    if (request.operation.kind === "event") {
                        if (!options.engine) return { error: "Development engine event receiver is missing." };
                        options.engine.sendEvent(request.operation.endpoint, request.operation.value);
                        return {};
                    }
                    options.writeParameter(request.operation.endpoint, request.operation.value);
                    channel?.observeParameter(request.scope, request.operation.endpoint);
                    return {};
                case "close": finishGestures(); return {};
            }
        }, (keys: readonly string[]) => Object.fromEntries(keys.flatMap(key => {
            const value = storedValues.read(key);
            return value === undefined ? [] : [[key, value]];
        })),
        (key: string, value: unknown) => storedValues.write(key, value), () => new Set([view]),
        options.engine?.handleHostEffect);
        await service.start();
        if (stopped) return;
        initialized = true;
        for (const envelope of pending.splice(0)) send(view, envelope);
    })();
    const ready = Promise.race([initialization, stoppedReady]);
    const stop = (reason: "owner-removed" | "service-closed") => {
        if (stopping) return stopping;
        stopped = true;
        pending.length = 0;
        settleStopped();
        reads.abort();
        // Notify a queued client even if the loader never supplied a channel.
        if (!channel) view.deliverMessageFromServer({ type: "kit_state", message: { kind: "closed", reason } });
        stopping = (async () => {
            try { await service.stop(); }
            finally { channel?.close(); finishGestures(); }
        })();
        return stopping;
    };
    void ready.catch(error => {
        if (!stopped) {
            void stop("service-closed");
            options.onDefect(error);
        }
    });
    return {
        addEventListener: view.addEventListener,
        removeEventListener: view.removeEventListener,
        sendMessageToServer: view.sendMessageToServer,
        ready,
        observeParameter(endpoint: string) { if (scope && !stopped) channel?.observeParameter(scope, endpoint); },
        replaceStoredValue(key: string, write: () => void) { return !stopped && (channel?.replaceStoredValue(key, write) ?? false); },
        stop: () => stop("owner-removed"),
    };
}
