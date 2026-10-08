import { createBrowserPreviewState } from "./state";
import type { PatchConnectionLike } from "../cmajor-react";

/**
 * One parameter the silent browser preview simulates. The fields mirror the
 * Cmajor endpoint annotation, so a view can derive the list from the same
 * definitions its controls use and export it as `browserPreviewParameters`.
 */
export type BrowserPreviewParameter = {
    readonly endpointID: string;
    readonly type: "number" | "integer" | "boolean";
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly defaultValue: number | boolean;
    readonly discrete?: boolean;
    readonly text?: string;
};

type Listener = (value: unknown) => void;
type PreviewConnection = ReturnType<typeof createBrowserPreviewState>["host"] & { dispose(): Promise<void> } & Required<Pick<PatchConnectionLike,
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

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

const endpointIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const optionalFinite = (value: unknown) => value === undefined || (typeof value === "number" && Number.isFinite(value));

/** Returns the first problem with the view's parameter list, or undefined when every entry is usable. */
function parameterProblem(parameters: unknown): string | undefined {
    if (!Array.isArray(parameters) || parameters.length === 0)
        return "This view must export browserPreviewParameters from its parameter definitions to use the shared UI preview.";
    const seen = new Set<string>();
    for (const parameter of parameters) {
        if (!isPlainObject(parameter) || typeof parameter.endpointID !== "string" || !endpointIdentifier.test(parameter.endpointID))
            return `browserPreviewParameters has an entry without a valid Cmajor endpointID: ${JSON.stringify(parameter)}.`;
        const { endpointID } = parameter;
        if (seen.has(endpointID)) return `Duplicate browserPreviewParameters endpointID "${endpointID}".`;
        seen.add(endpointID);
        if (parameter.type !== "number" && parameter.type !== "integer" && parameter.type !== "boolean")
            return `Preview parameter "${endpointID}" needs type "number", "integer" or "boolean".`;
        const defaultIsValid = parameter.type === "boolean"
            ? typeof parameter.defaultValue === "boolean"
            : typeof parameter.defaultValue === "number" && Number.isFinite(parameter.defaultValue);
        if (!defaultIsValid) return `Preview parameter "${endpointID}" needs a defaultValue of its declared type.`;
        if (![parameter.min, parameter.max, parameter.step].every(optionalFinite))
            return `Preview parameter "${endpointID}" has a min, max or step that is not a finite number.`;
    }
    return undefined;
}

/**
 * Connect the real view to page-local parameter and stored state. No audio,
 * worker output, disk persistence or native bridge is simulated; every new
 * connection owns an independent state.
 */
export function createBrowserPreviewConnection(manifest: unknown, input: unknown): PreviewConnectionResult {
    if (!isPlainObject(manifest) || typeof manifest.ID !== "string" || manifest.ID.trim() === "") {
        return { _tag: "err", message: "Browser preview needs a patch manifest with a permanent ID." };
    }
    const problem = parameterProblem(input);
    if (problem !== undefined) return { _tag: "err", message: problem };
    // SAFETY: parameterProblem checked every entry against BrowserPreviewParameter above.
    const parameters = input as readonly BrowserPreviewParameter[];

    const values = new Map<string, unknown>(parameters.map((parameter) => [parameter.endpointID, parameter.defaultValue]));
    const storedState = new Map<string, unknown>();
    const parameterListeners = new Map<string, Set<Listener>>();
    const endpointListeners = new Map<string, Set<Listener>>();
    const statusListeners = new Set<Listener>();
    const storedStateListeners = new Set<Listener>();
    const status = {
        manifest,
        details: {
            inputs: parameters.map((parameter) => ({ ...parameter, purpose: "parameter" })),
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

    const writeParameter = (endpointID: string, value: unknown) => {
        values.set(endpointID, value);
        for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
    };
    const state = createBrowserPreviewState({
        snapshot: () => ({ values: Object.fromEntries(storedState), parameters: parameters.map(parameter => ({
            endpoint: parameter.endpointID, value: Number(values.get(parameter.endpointID)),
            min: parameter.min ?? 0, max: parameter.max ?? 1, step: parameter.step ?? (parameter.type === "number" ? 0 : 1),
            defaultValue: Number(parameter.defaultValue),
        })) }),
        parameter: writeParameter,
        // A silent page has no host automation recorder.
        gesture() {},
        stored(key, value) { storedState.set(key, value); emitStoredState(key); },
    });
    return {
        _tag: "ok",
        value: {
            ...state.host,
            dispose: () => state.stop(),
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
                writeParameter(endpointID, value);
                state.observe(endpointID, Number(value));
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
                state.replace(key);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({ parameters: Object.fromEntries(values), values: Object.fromEntries(storedState) }));
            },
        },
    };
}
