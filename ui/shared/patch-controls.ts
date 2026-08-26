import { useCallback, useMemo } from "react";

import {
    usePatchConnection,
    usePatchParameter,
    type PatchParameterHostBaseline,
    type PatchParameterPresentationPriority,
} from "./cmajor-react";

function serializeIdentity<TValue>(value: TValue) {
    return value;
}

export type PatchControlBinding<TValue> = {
    endpointID: string;
    value: TValue;
    /** Whether the current endpoint's first authoritative value has arrived. */
    isReady: boolean;
    /** The authoritative pre-edit host value for the current endpoint, when observed. */
    hostBaseline?: PatchParameterHostBaseline<TValue>;
    /** The canonical default this parameter boots with (ADR-017 base reset). */
    initialValue?: TValue;
    setValue: (nextValue: TValue) => void;
    commitValue: (nextValue: TValue) => void;
    beginGesture: () => void;
    endGesture: () => void;
};

type PatchParameterBindingOptions<TValue> = {
    endpointID: string;
    initialValue: TValue;
    coerce: (rawValue: unknown) => TValue;
    serialize?: (value: TValue) => unknown;
    active?: boolean;
    presentationPriority?: PatchParameterPresentationPriority;
};

export function usePatchParameterBinding<TValue>({
    endpointID,
    initialValue,
    coerce,
    serialize = serializeIdentity,
    active = true,
    presentationPriority = "immediate",
}: PatchParameterBindingOptions<TValue>): PatchControlBinding<TValue> {
    const parameter = usePatchParameter(endpointID, serialize(initialValue), active, presentationPriority);
    const value = useMemo(() => coerce(parameter.value), [coerce, parameter.value]);
    const hostBaseline = useMemo<PatchParameterHostBaseline<TValue>>(() => (
        parameter.hostBaseline._tag === "host-confirmed"
            ? { _tag: "host-confirmed", value: coerce(parameter.hostBaseline.value) }
            : { _tag: "pending" }
    ), [coerce, parameter.hostBaseline]);

    const setValue = useCallback((nextValue: TValue) => {
        parameter.setValue(serialize(nextValue));
    }, [parameter.setValue, serialize]);

    const commitValue = useCallback((nextValue: TValue) => {
        parameter.beginGesture();
        parameter.setValue(serialize(nextValue));
        parameter.endGesture();
    }, [parameter.beginGesture, parameter.endGesture, parameter.setValue, serialize]);

    return useMemo(() => ({
        endpointID,
        value,
        isReady: parameter.isReady,
        hostBaseline,
        initialValue,
        setValue,
        commitValue,
        beginGesture: parameter.beginGesture,
        endGesture: parameter.endGesture,
    }), [
        endpointID,
        initialValue,
        parameter.beginGesture,
        parameter.endGesture,
        parameter.isReady,
        hostBaseline,
        value,
        setValue,
        commitValue,
    ]);
}

export function usePatchEventTrigger<TValue = unknown>(endpointID: string) {
    const patchConnection = usePatchConnection();

    return useCallback((value: TValue) => {
        patchConnection.sendEventOrValue?.(endpointID, value);
    }, [endpointID, patchConnection]);
}
