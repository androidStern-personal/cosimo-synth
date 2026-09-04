import type { PatchConnectionLike } from "../cmajor-react";
import { buildCanonicalPluginStateContract } from "./effect-state-contract";
import { isPlainObject } from "./effect-utils";

type Listener = (value: unknown) => void;
type PreviewConnection = Required<Pick<PatchConnectionLike,
    | "manifest"
    | "addParameterListener" | "removeParameterListener" | "requestParameterValue"
    | "sendEventOrValue" | "sendParameterGestureStart" | "sendParameterGestureEnd"
    | "addEndpointListener" | "removeEndpointListener"
    | "addStatusListener" | "removeStatusListener" | "requestStatusUpdate"
    | "addStoredStateValueListener" | "removeStoredStateValueListener"
    | "requestStoredStateValue" | "sendStoredStateValue" | "requestFullStoredState"
>>;

type PreviewConnectionResult =
    | { readonly _tag: "ok"; readonly value: PreviewConnection }
    | { readonly _tag: "err"; readonly message: string };

/**
 * Connect the real view to page-local parameter/stored state using its existing
 * state-contract descriptors. No audio, worker output, disk persistence, or
 * native bridge is simulated; every new connection owns an independent state.
 */
export function createBrowserPreviewConnection(manifest: unknown, parameters: unknown): PreviewConnectionResult {
    if (!isPlainObject(manifest) || typeof manifest.ID !== "string" || manifest.ID.trim() === "") {
        return { _tag: "err", message: "Browser preview needs a patch manifest with a permanent ID." };
    }
    if (!Array.isArray(parameters) || parameters.length === 0) {
        return { _tag: "err", message: "This view must export browserPreviewParameters from its parameter definitions to use the shared UI preview." };
    }

    let contract;
    try {
        contract = buildCanonicalPluginStateContract({ effectID: manifest.ID, parameters });
    } catch (error: unknown) {
        return { _tag: "err", message: error instanceof Error ? error.message : "Invalid browser preview parameter definitions." };
    }

    const values = new Map<string, unknown>(contract.parameters.map((parameter) => [parameter.endpointID, parameter.defaultValue]));
    const storedState = new Map<string, unknown>();
    const parameterListeners = new Map<string, Set<Listener>>();
    const endpointListeners = new Map<string, Set<Listener>>();
    const statusListeners = new Set<Listener>();
    const storedStateListeners = new Set<Listener>();
    const status = {
        manifest,
        details: {
            inputs: contract.parameters.map((parameter) => ({ ...parameter, purpose: "parameter" })),
            outputs: [],
        },
    };

    function subscribe(listeners: Map<string, Set<Listener>>, key: string, listener: Listener) {
        const subscribers = listeners.get(key) ?? new Set<Listener>();
        subscribers.add(listener);
        listeners.set(key, subscribers);
    }

    function emitStoredState(key: string) {
        for (const listener of storedStateListeners) listener({ key, value: storedState.get(key) });
    }

    return {
        _tag: "ok",
        value: {
            manifest,
            addParameterListener(endpointID, listener) { subscribe(parameterListeners, endpointID, listener); },
            removeParameterListener(endpointID, listener) { parameterListeners.get(endpointID)?.delete(listener); },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    if (values.has(endpointID)) {
                        for (const listener of parameterListeners.get(endpointID) ?? []) listener(values.get(endpointID));
                    }
                });
            },
            sendEventOrValue(endpointID, value) {
                values.set(endpointID, value);
                for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
            },
            // A silent page has neither host automation nor DSP output. Keep
            // these normal binding hooks without inventing either behavior.
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            addEndpointListener(endpointID, listener) { subscribe(endpointListeners, endpointID, listener); },
            removeEndpointListener(endpointID, listener) { endpointListeners.get(endpointID)?.delete(listener); },
            addStatusListener(listener) { statusListeners.add(listener); },
            removeStatusListener(listener) { statusListeners.delete(listener); },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    for (const listener of statusListeners) listener(status);
                });
            },
            addStoredStateValueListener(listener) { storedStateListeners.add(listener); },
            removeStoredStateValueListener(listener) { storedStateListeners.delete(listener); },
            requestStoredStateValue(key) { queueMicrotask(() => emitStoredState(key)); },
            sendStoredStateValue(key, value) {
                storedState.set(key, value);
                emitStoredState(key);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({ parameters: Object.fromEntries(values), values: Object.fromEntries(storedState) }));
            },
        },
    };
}
