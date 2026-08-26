import { useCallback, useMemo } from "react";

import {
    usePatchConnection,
    usePatchParameter,
    type PatchParameterPresentationPriority,
} from "./cmajor-react";

function serializeIdentity<TValue>(value: TValue) {
    return value;
}

export type PatchControlBinding<TValue> = {
    endpointID: string;
    value: TValue;
    /** Whether value belongs to endpointID on the active patch connection. */
    hasCurrentValue?: boolean;
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
        hasCurrentValue: parameter.hasCurrentValue,
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
        parameter.hasCurrentValue,
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
