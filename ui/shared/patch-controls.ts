import { useCallback, useMemo } from "react";

import { usePatchConnection, usePatchParameter } from "./cmajor-react";

export type PatchControlBinding<TValue> = {
    endpointID: string;
    value: TValue;
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
};

export function usePatchParameterBinding<TValue>({
    endpointID,
    initialValue,
    coerce,
    serialize = (value) => value,
}: PatchParameterBindingOptions<TValue>): PatchControlBinding<TValue> {
    const parameter = usePatchParameter(endpointID, serialize(initialValue));
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
        setValue,
        commitValue,
        beginGesture: parameter.beginGesture,
        endGesture: parameter.endGesture,
    }), [endpointID, parameter.beginGesture, parameter.endGesture, value, setValue, commitValue]);
}

export function usePatchEventTrigger<TValue = unknown>(endpointID: string) {
    const patchConnection = usePatchConnection();

    return useCallback((value: TValue) => {
        patchConnection.sendEventOrValue?.(endpointID, value);
    }, [endpointID, patchConnection]);
}
