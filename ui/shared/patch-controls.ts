import { useCallback, useMemo } from "react";
import { useOptionalSynthPluginParameterBinding } from "./synth-plugin-state-react";

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
    const synthParameter = useOptionalSynthPluginParameterBinding(endpointID, {
        initialValue: Number(serialize(initialValue)),
        coerce: rawValue => Number(serialize(coerce(rawValue))),
        active,
        presentationPriority,
    });
    // Both hooks remain unconditional when controls change endpoints. A declared
    // but unready synth control never falls back to the raw connection.
    const rawParameter = usePatchParameter(endpointID, serialize(initialValue), active && synthParameter === null, presentationPriority);
    const parameter = synthParameter ?? rawParameter;
    const value = useMemo(() => coerce(parameter.value), [coerce, parameter.value]);
    const hostBaseline = useMemo<PatchParameterHostBaseline<TValue>>(() => (
        parameter.hostBaseline?._tag === "host-confirmed"
            ? { _tag: "host-confirmed", value: coerce(parameter.hostBaseline.value) }
            : { _tag: "pending" }
    ), [coerce, parameter.hostBaseline]);

    const setValue = useCallback((nextValue: TValue) => {
        if (synthParameter) synthParameter.setValue(Number(serialize(nextValue)));
        else rawParameter.setValue(serialize(nextValue));
    }, [rawParameter.setValue, serialize, synthParameter]);

    const commitValue = useCallback((nextValue: TValue) => {
        parameter.beginGesture();
        if (synthParameter) synthParameter.setValue(Number(serialize(nextValue)));
        else rawParameter.setValue(serialize(nextValue));
        parameter.endGesture();
    }, [parameter.beginGesture, parameter.endGesture, rawParameter.setValue, serialize, synthParameter]);

    return useMemo(() => ({
        endpointID,
        value,
        isReady: parameter.isReady,
        hostBaseline,
        initialValue: synthParameter ? coerce(synthParameter.initialValue) : initialValue,
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
        synthParameter,
        coerce,
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
