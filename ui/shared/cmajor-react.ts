import {
    createElement,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

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
    sendEventOrValue?: (endpointID: string, value: unknown) => void;
    sendParameterGestureStart?: (endpointID: string) => void;
    sendParameterGestureEnd?: (endpointID: string) => void;
    addEndpointListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    removeEndpointListener?: (endpointID: string, listener: (value: unknown) => void) => void;
    addStatusListener?: (listener: (status: unknown) => void) => void;
    removeStatusListener?: (listener: (status: unknown) => void) => void;
    requestStatusUpdate?: () => void;
    getResourceAddress?: (path: string) => string;
    readResource?: (path: string) => Promise<unknown>;
    readResourceAsAudioData?: (path: string, annotation?: unknown) => Promise<unknown>;
    addStoredStateValueListener?: (listener: (message: unknown) => void) => void;
    removeStoredStateValueListener?: (listener: (message: unknown) => void) => void;
    requestFullStoredState?: (callback: (state: Record<string, unknown>) => void) => void;
    requestStoredStateValue?: (key: string) => void;
    sendStoredStateValue?: (key: string, value: unknown) => void;
    sendMIDIInputEvent?: (endpointID: string, shortMIDICode: number) => void;
};

type ParameterBinding = {
    value: unknown;
    setValue: (nextValue: unknown) => void;
    beginGesture: () => void;
    endGesture: () => void;
};

const PatchConnectionContext = createContext<PatchConnectionLike | null>(null);

export function PatchConnectionProvider({
    patchConnection,
    children,
}: {
    patchConnection: PatchConnectionLike;
    children: ReactNode;
}) {
    return createElement(PatchConnectionContext.Provider, { value: patchConnection }, children);
}

export function usePatchConnection() {
    const patchConnection = useContext(PatchConnectionContext);

    if (!patchConnection) {
        throw new Error("PatchConnectionProvider is missing.");
    }

    return patchConnection;
}

export function usePatchParameter(endpointID: string, initialValue: unknown = 0): ParameterBinding {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<unknown>(initialValue);

    useEffect(() => {
        const listener = (nextValue: unknown) => setValue(nextValue);

        patchConnection.addParameterListener?.(endpointID, listener);
        patchConnection.requestParameterValue?.(endpointID);

        return () => {
            patchConnection.removeParameterListener?.(endpointID, listener);
        };
    }, [endpointID, patchConnection]);

    const setParameterValue = useCallback((nextValue: unknown) => {
        patchConnection.sendEventOrValue?.(endpointID, nextValue);
        setValue(nextValue);
    }, [endpointID, patchConnection]);

    const beginGesture = useCallback(() => {
        patchConnection.sendParameterGestureStart?.(endpointID);
    }, [endpointID, patchConnection]);

    const endGesture = useCallback(() => {
        patchConnection.sendParameterGestureEnd?.(endpointID);
    }, [endpointID, patchConnection]);

    return useMemo(() => ({
        value,
        setValue: setParameterValue,
        beginGesture,
        endGesture,
    }), [beginGesture, endGesture, setParameterValue, value]);
}

export function usePatchEndpoint<TValue = unknown>(endpointID: string, initialValue: TValue) {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<TValue>(initialValue);

    useEffect(() => {
        const listener = (nextValue: unknown) => setValue(nextValue as TValue);

        patchConnection.addEndpointListener?.(endpointID, listener);

        return () => {
            patchConnection.removeEndpointListener?.(endpointID, listener);
        };
    }, [endpointID, patchConnection]);

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
