import {
    createElement,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

/** The parts of Cmajor's PatchConnection a view can call. Every member is optional because hosts differ. */
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
    sendMIDIInputEvent?: (endpointID: string, shortMIDICode: number) => void;
};

/** One host parameter as a view sees it. Writes before the host reports a value are ignored. */
export type PatchParameter = {
    readonly value: unknown;
    /** True once the host has reported the parameter's current value. */
    readonly isReady: boolean;
    readonly setValue: (nextValue: unknown) => void;
    readonly beginGesture: () => void;
    readonly endGesture: () => void;
};

const PatchConnectionContext = createContext<PatchConnectionLike | null>(null);

export function PatchConnectionProvider({ patchConnection, children }: {
    patchConnection: PatchConnectionLike;
    children: ReactNode;
}) {
    return createElement(PatchConnectionContext.Provider, { value: patchConnection }, children);
}

export function usePatchConnection(): PatchConnectionLike {
    const patchConnection = useContext(PatchConnectionContext);
    if (!patchConnection) {
        throw new Error("usePatchConnection needs a PatchConnectionProvider above it; createStatefulPatchView provides one.");
    }
    return patchConnection;
}

/** The connection when a provider is present, or null (a component rendered on its own). */
export function useOptionalPatchConnection(): PatchConnectionLike | null {
    return useContext(PatchConnectionContext);
}

/**
 * Read and write one host parameter directly. These writes go to the host
 * like automation does, so they are not Undo entries; controls declared with
 * `definePluginState` and `usePluginState` are.
 */
export function usePatchParameter(endpointID: string, initialValue: unknown = 0, active = true): PatchParameter {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<unknown>(initialValue);
    // The connection and endpoint whose current value the host has reported.
    const [reportedSource, setReportedSource] = useState<{
        readonly patchConnection: PatchConnectionLike;
        readonly endpointID: string;
    } | null>(null);
    const initialValueRef = useRef(initialValue);
    const gestureRef = useRef<{ readonly patchConnection: PatchConnectionLike; readonly endpointID: string } | null>(null);
    initialValueRef.current = initialValue;
    const isReady = active && reportedSource?.patchConnection === patchConnection && reportedSource.endpointID === endpointID;

    const closeGesture = useCallback(() => {
        const gesture = gestureRef.current;
        // Clear ownership first so unmount cleanup and a later pointer-up cannot close it twice.
        gestureRef.current = null;
        gesture?.patchConnection.sendParameterGestureEnd?.(gesture.endpointID);
    }, []);

    useEffect(() => {
        setValue(initialValueRef.current);
        if (!active) {
            return undefined;
        }

        let listening = true;
        const listener = (nextValue: unknown) => {
            if (!listening) {
                return;
            }
            setValue(nextValue);
            setReportedSource((source) => (
                source?.patchConnection === patchConnection && source.endpointID === endpointID
                    ? source
                    : { patchConnection, endpointID }
            ));
        };

        patchConnection.addParameterListener?.(endpointID, listener);
        patchConnection.requestParameterValue?.(endpointID);

        return () => {
            listening = false;
            closeGesture();
            patchConnection.removeParameterListener?.(endpointID, listener);
        };
    }, [active, closeGesture, endpointID, patchConnection]);

    const setParameterValue = useCallback((nextValue: unknown) => {
        if (!isReady) {
            return;
        }
        patchConnection.sendEventOrValue?.(endpointID, nextValue);
        setValue(nextValue);
    }, [endpointID, isReady, patchConnection]);

    const beginGesture = useCallback(() => {
        if (!isReady || gestureRef.current !== null) {
            return;
        }
        gestureRef.current = { patchConnection, endpointID };
        patchConnection.sendParameterGestureStart?.(endpointID);
    }, [endpointID, isReady, patchConnection]);

    return useMemo(() => ({
        value,
        isReady,
        setValue: setParameterValue,
        beginGesture,
        endGesture: closeGesture,
    }), [beginGesture, closeGesture, isReady, setParameterValue, value]);
}
