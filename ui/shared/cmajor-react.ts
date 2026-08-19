import {
    createElement,
    createContext,
    startTransition,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    createPatchConnectionResourceClient,
    type ResourceClient,
} from "./resource-client";
import {
    reportUserGestureEnd,
    reportUserGestureStart,
    reportUserParameterEdit,
} from "./user-edit-bus";

export type PatchConnectionLike = {
    manifest?: unknown;
    utilities?: {
        PianoKeyboard?: CustomElementConstructor;
        ParameterControls?: {
            Knob?: CustomElementConstructor;
        };
    };
    addParameterListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    removeParameterListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    requestParameterValue?: (endpointID: string) => void;
    sendEventOrValue?: (
        endpointID: string,
        value: unknown,
        rampFrames?: number,
        timeoutMilliseconds?: number,
    ) => void;
    sendParameterGestureStart?: (endpointID: string) => void;
    sendParameterGestureEnd?: (endpointID: string) => void;
    addEndpointListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    removeEndpointListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    addStatusListener?: (listener: (status: unknown) => void) => void;
    removeStatusListener?: (listener: (status: unknown) => void) => void;
    requestStatusUpdate?: () => void;
    getResourceAddress?: (path: string) => string | URL;
    readResource?: (path: string) => Promise<unknown>;
    readResourceAsAudioData?: (path: string, annotation?: unknown) => Promise<unknown>;
    addStoredStateValueListener?: (listener: (message: unknown) => void) => void;
    removeStoredStateValueListener?: (listener: (message: unknown) => void) => void;
    requestFullStoredState?: (callback: (state: Record<string, unknown>) => void) => void;
    requestStoredStateValue?: (key: string) => void;
    sendStoredStateValue?: (key: string, value: unknown) => void;
    sendNativeArticulationTriggerConfig?: (serializedConfig: string) => void;
    sendMIDIInputEvent?: (endpointID: string, shortMIDICode: number) => void;
};

type ParameterBinding = {
    value: unknown;
    setValue: (nextValue: unknown) => void;
    beginGesture: () => void;
    endGesture: () => void;
};

export type PatchParameterPresentationPriority = "immediate" | "deferred-during-gesture";

type PatchHostLike = {
    patchConnection: PatchConnectionLike;
    resourceClient: ResourceClient;
};

const PatchHostContext = createContext<PatchHostLike | null>(null);

export function PatchConnectionProvider({
    patchConnection,
    resourceClient,
    children,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient?: ResourceClient;
    children: ReactNode;
}) {
    const host = useMemo<PatchHostLike>(() => ({
        patchConnection,
        resourceClient: resourceClient ?? createPatchConnectionResourceClient(patchConnection),
    }), [patchConnection, resourceClient]);

    return createElement(PatchHostContext.Provider, { value: host }, children);
}

function usePatchHost() {
    const patchHost = useContext(PatchHostContext);

    if (!patchHost) {
        throw new Error("PatchConnectionProvider is missing.");
    }

    return patchHost;
}

export function usePatchConnection() {
    return usePatchHost().patchConnection;
}

export function useResourceClient() {
    return usePatchHost().resourceClient;
}

export function usePatchParameter(
    endpointID: string,
    initialValue: unknown = 0,
    active = true,
    presentationPriority: PatchParameterPresentationPriority = "immediate",
): ParameterBinding {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<unknown>(initialValue);
    const initialValueRef = useRef(initialValue);
    const valueRef = useRef<unknown>(initialValue);
    const gestureActiveRef = useRef(false);
    initialValueRef.current = initialValue;
    const presentValue = useCallback((nextValue: unknown) => {
        valueRef.current = nextValue;
        if (presentationPriority === "deferred-during-gesture" && gestureActiveRef.current) {
            startTransition(() => setValue(nextValue));
            return;
        }

        setValue(nextValue);
    }, [presentationPriority]);

    useEffect(() => {
        valueRef.current = initialValueRef.current;
        setValue(initialValueRef.current);
        if (!active) {
            return undefined;
        }

        let listening = true;
        const listener = (nextValue: unknown) => {
            if (listening) {
                presentValue(nextValue);
            }
        };

        patchConnection.addParameterListener?.(endpointID, listener);
        patchConnection.requestParameterValue?.(endpointID);

        return () => {
            listening = false;
            patchConnection.removeParameterListener?.(endpointID, listener);
        };
    }, [active, endpointID, patchConnection, presentValue]);

    const setParameterValue = useCallback((nextValue: unknown) => {
        // Every write through this hook is a direct user edit — programmatic
        // bulk writes (preset load, host restore) take the connection directly
        // and never construct bindings (T12 seam A).
        const changed = !Object.is(nextValue, valueRef.current);
        patchConnection.sendEventOrValue?.(endpointID, nextValue);
        presentValue(nextValue);
        reportUserParameterEdit({ endpointID, changed });
    }, [endpointID, patchConnection, presentValue]);

    const beginGesture = useCallback(() => {
        gestureActiveRef.current = true;
        patchConnection.sendParameterGestureStart?.(endpointID);
        reportUserGestureStart();
    }, [endpointID, patchConnection]);

    const endGesture = useCallback(() => {
        gestureActiveRef.current = false;
        patchConnection.sendParameterGestureEnd?.(endpointID);
        reportUserGestureEnd();
    }, [endpointID, patchConnection]);

    return useMemo(() => ({
        value,
        setValue: setParameterValue,
        beginGesture,
        endGesture,
    }), [beginGesture, endGesture, setParameterValue, value]);
}

export function usePatchEndpoint<TValue = unknown>(
    endpointID: string,
    initialValue: TValue,
    active = true,
) {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<TValue>(initialValue);
    const initialValueRef = useRef(initialValue);
    initialValueRef.current = initialValue;

    useEffect(() => {
        setValue(initialValueRef.current);
        if (!active) {
            return undefined;
        }

        let listening = true;
        const listener = (nextValue: unknown) => {
            if (listening) {
                setValue(nextValue as TValue);
            }
        };

        patchConnection.addEndpointListener?.(endpointID, listener);

        return () => {
            listening = false;
            patchConnection.removeEndpointListener?.(endpointID, listener);
        };
    }, [active, endpointID, patchConnection]);

    return value;
}

function visualEndpointValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true;
    }
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
        return false;
    }
    if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
        if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right) || left.byteLength !== right.byteLength) {
            return false;
        }
        const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
        const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
        return leftBytes.every((value, index) => value === rightBytes[index]);
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((value, index) => visualEndpointValuesEqual(value, right[index]));
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
            && visualEndpointValuesEqual(leftRecord[key], rightRecord[key]));
}

/**
 * Subscribes to latest-state visual telemetry. Bursts collapse to the newest
 * animation-frame value, structurally repeated frames do not render, and the
 * resulting React work is interruptible by user input.
 */
export function usePatchVisualEndpoint<TValue = unknown>(
    endpointID: string,
    initialValue: TValue,
    active = true,
) {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<TValue>(initialValue);
    const initialValueRef = useRef(initialValue);
    const committedValueRef = useRef(initialValue);
    const pendingValueRef = useRef<{ value: TValue } | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    initialValueRef.current = initialValue;

    useEffect(() => {
        const resetValue = initialValueRef.current;
        committedValueRef.current = resetValue;
        pendingValueRef.current = null;
        setValue(resetValue);
        if (!active) {
            return undefined;
        }

        let listening = true;
        const presentPendingValue = () => {
            animationFrameRef.current = null;
            const pending = pendingValueRef.current;
            pendingValueRef.current = null;
            if (!listening || !pending || visualEndpointValuesEqual(committedValueRef.current, pending.value)) {
                return;
            }

            committedValueRef.current = pending.value;
            startTransition(() => {
                setValue((previousValue) => (
                    !listening || visualEndpointValuesEqual(previousValue, pending.value)
                        ? previousValue
                        : pending.value
                ));
            });
        };
        const listener = (nextValue: unknown) => {
            if (!listening) {
                return;
            }
            const typedValue = nextValue as TValue;
            if (animationFrameRef.current !== null) {
                pendingValueRef.current = { value: typedValue };
                return;
            }
            if (visualEndpointValuesEqual(committedValueRef.current, typedValue)) {
                return;
            }

            pendingValueRef.current = { value: typedValue };
            if (typeof window.requestAnimationFrame === "function") {
                animationFrameRef.current = window.requestAnimationFrame(presentPendingValue);
            } else {
                presentPendingValue();
            }
        };

        patchConnection.addEndpointListener?.(endpointID, listener);

        return () => {
            listening = false;
            pendingValueRef.current = null;
            if (animationFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = null;
            patchConnection.removeEndpointListener?.(endpointID, listener);
        };
    }, [active, endpointID, patchConnection]);

    return value;
}

export function usePatchStatus<TStatus = unknown>(initialValue: TStatus | null = null) {
    const patchConnection = usePatchConnection();
    const [status, setStatus] = useState<TStatus | null>(initialValue);

    useEffect(() => {
        const listener = (nextStatus: unknown) => setStatus(nextStatus as TStatus);

        patchConnection.addStatusListener?.(listener);
        patchConnection.requestStatusUpdate?.();

        return () => {
            patchConnection.removeStatusListener?.(listener);
        };
    }, [patchConnection]);

    return status;
}
