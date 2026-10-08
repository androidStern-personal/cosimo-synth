// The synth's patch hooks. They share the kit's connection context, so kit
// components and these hooks see one provider, and add what only the synth
// needs: analyzer activity leases and a shared resource client.
import {
    createElement,
    createContext,
    startTransition,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    PatchConnectionProvider as KitPatchConnectionProvider,
    useOptionalPatchConnection as useKitOptionalPatchConnection,
} from "../../kit/ui/cmajor-react";
import {
    usePatchConnection as useKitPatchConnection,
    type PatchConnectionLike as KitPatchConnectionLike,
} from "../../kit/index";
import { acquireAnalyzerActivity } from "./analyzer-activity";
import {
    createPatchConnectionResourceClient,
    type ResourceClient,
} from "../../kit/ui/resource-client";

export type PatchConnectionLike = KitPatchConnectionLike & {
    sendNativeArticulationTriggerConfig?: (serializedConfig: string) => void;
    /** Browser/native restore bridge: the live two-phase transaction already
        committed this reference, so a stored-state echo must not reinstall it. */
    acceptCommittedBounceDocument?: (value: unknown) => unknown;
};

/** Whether the current endpoint's pre-edit host value has been observed authoritatively. */
export type PatchParameterHostBaseline<TValue> =
    | { readonly _tag: "pending" }
    | { readonly _tag: "host-confirmed"; readonly value: TValue };

export type PatchParameterPresentationPriority = "immediate" | "deferred-during-gesture";

const ResourceClientContext = createContext<ResourceClient | null>(null);

export function PatchConnectionProvider({
    patchConnection,
    resourceClient,
    children,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient?: ResourceClient;
    children: ReactNode;
}) {
    const client = useMemo(
        () => resourceClient ?? createPatchConnectionResourceClient(patchConnection),
        [patchConnection, resourceClient],
    );
    return createElement(KitPatchConnectionProvider, {
        patchConnection,
        children: createElement(ResourceClientContext.Provider, { value: client }, children),
    });
}

export function usePatchConnection(): PatchConnectionLike {
    return useKitPatchConnection();
}

/** The connection when a provider is present, or null (bare component tests). */
export function useOptionalPatchConnection(): PatchConnectionLike | null {
    return useKitOptionalPatchConnection();
}

/** The provider's resource client, or one over the connection when only the kit provider is present. */
export function useResourceClient(): ResourceClient {
    const provided = useContext(ResourceClientContext);
    const patchConnection = usePatchConnection();
    return useMemo(
        () => provided ?? createPatchConnectionResourceClient(patchConnection),
        [patchConnection, provided],
    );
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
        const releaseAnalyzerActivity = acquireAnalyzerActivity(patchConnection, endpointID);

        return () => {
            listening = false;
            releaseAnalyzerActivity?.();
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
        // Analyzer endpoints are demand-driven in the DSP; observing one
        // wakes its analyzer for exactly as long as this listener lives.
        const releaseAnalyzerActivity = acquireAnalyzerActivity(patchConnection, endpointID);

        return () => {
            listening = false;
            pendingValueRef.current = null;
            if (animationFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = null;
            releaseAnalyzerActivity?.();
            patchConnection.removeEndpointListener?.(endpointID, listener);
        };
    }, [active, endpointID, patchConnection]);

    return value;
}

/**
 * Subscribes to visual telemetry whose raw endpoint events each carry only
 * part of the retained display state. Every event is folded immediately;
 * only the React presentation is coalesced to one update per animation frame.
 */
export function usePatchFoldedVisualEndpoint<TValue, TMessage = unknown>(
    endpointID: string,
    initialValue: TValue,
    fold: (current: TValue, message: TMessage) => TValue,
    active = true,
) {
    const patchConnection = usePatchConnection();
    const [value, setValue] = useState<TValue>(initialValue);
    const initialValueRef = useRef(initialValue);
    const foldRef = useRef(fold);
    const accumulatedValueRef = useRef(initialValue);
    const committedValueRef = useRef(initialValue);
    const pendingValueRef = useRef<{ value: TValue } | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    initialValueRef.current = initialValue;
    foldRef.current = fold;

    useEffect(() => {
        const resetValue = initialValueRef.current;
        accumulatedValueRef.current = resetValue;
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
            if (!listening || !pending
                    || visualEndpointValuesEqual(committedValueRef.current, pending.value)) {
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
        const listener = (message: unknown) => {
            if (!listening) {
                return;
            }

            const nextValue = foldRef.current(
                accumulatedValueRef.current,
                message as TMessage,
            );
            accumulatedValueRef.current = nextValue;
            pendingValueRef.current = { value: nextValue };
            if (animationFrameRef.current !== null) {
                return;
            }
            if (typeof window.requestAnimationFrame === "function") {
                animationFrameRef.current = window.requestAnimationFrame(presentPendingValue);
            } else {
                presentPendingValue();
            }
        };

        patchConnection.addEndpointListener?.(endpointID, listener);
        const releaseAnalyzerActivity = acquireAnalyzerActivity(patchConnection, endpointID);

        return () => {
            listening = false;
            pendingValueRef.current = null;
            if (animationFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = null;
            releaseAnalyzerActivity?.();
            patchConnection.removeEndpointListener?.(endpointID, listener);
        };
    }, [active, endpointID, patchConnection]);

    return value;
}
