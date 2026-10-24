import { useCallback, useMemo } from "react";

import {
    usePatchConnection,
    type PatchParameterHostBaseline,
    type PatchParameterPresentationPriority,
} from "./cmajor-react";
import { synthParameterByEndpoint } from "./synth-plugin-state";
import { useOptionalSynthPluginParameterBinding } from "./synth-plugin-state-react";

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
    active?: boolean;
    presentationPriority?: PatchParameterPresentationPriority;
};

function ignore() {}

/**
 * Binds a control to one synth host parameter. Every edit goes through the synth's plugin
 * state, so it is saved, undoable and shared with every other view. An active binding needs
 * the endpoint declared in synthParameterByEndpoint and a SynthStateProvider above it, and
 * throws at render without either. An inactive binding reads and writes nothing, so a caller
 * that keeps its hooks unconditional may give it a placeholder endpoint.
 */
export function usePatchParameterBinding<TValue extends number>({
    endpointID,
    initialValue,
    coerce,
    active = true,
    presentationPriority = "immediate",
}: PatchParameterBindingOptions<TValue>): PatchControlBinding<number> {
    if (active && !Object.hasOwn(synthParameterByEndpoint, endpointID)) {
        throw new Error(`The "${endpointID}" control is not a synth parameter: declare it in synthParameterByEndpoint.`);
    }
    const parameter = useOptionalSynthPluginParameterBinding(endpointID, { initialValue, coerce, active, presentationPriority });
    const inactive = useMemo((): PatchControlBinding<number> => ({
        endpointID,
        value: initialValue,
        isReady: false,
        hostBaseline: { _tag: "pending" },
        initialValue,
        setValue: ignore,
        commitValue: ignore,
        beginGesture: ignore,
        endGesture: ignore,
    }), [endpointID, initialValue]);
    if (parameter !== null) return parameter;
    if (active) throw new Error(`The "${endpointID}" control must render inside SynthStateProvider.`);
    return inactive;
}

export function usePatchEventTrigger<TValue = unknown>(endpointID: string) {
    const patchConnection = usePatchConnection();

    return useCallback((value: TValue) => {
        patchConnection.sendEventOrValue?.(endpointID, value);
    }, [endpointID, patchConnection]);
}
