import {
    useCallback,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react";

import { usePatchConnection } from "./cmajor-react";
import {
    acquireModulationRuntimeBridge,
    releaseModulationRuntimeBridge,
    type ModulationRoute,
    type ModulationRuntimeBridge,
} from "./modulation";

/** The live UI amount interface, backed by the canonical modulation bridge. */
export type ModulationRouteAmountBinding = {
    readonly value: number;
    readonly setValue: (nextAmount: number) => boolean;
};

export type OptionalModulationRouteAmountBinding = {
    readonly value: number | null;
    readonly setValue: (nextAmount: number) => boolean;
};

/**
 * Subscribe one amount control directly to its canonical bridge value.
 * Unrelated modulation changes and the deferred full-document React projection
 * cannot rerender the caller through this interface.
 */
export function useModulationRouteAmountBinding(
    route: Readonly<Pick<ModulationRoute, "id" | "amount">>,
): ModulationRouteAmountBinding;
export function useModulationRouteAmountBinding(
    route: Readonly<Pick<ModulationRoute, "id" | "amount">> | null,
): OptionalModulationRouteAmountBinding;
export function useModulationRouteAmountBinding(
    route: Readonly<Pick<ModulationRoute, "id" | "amount">> | null,
): OptionalModulationRouteAmountBinding {
    const patchConnection = usePatchConnection();
    const bridgeRef = useRef<ModulationRuntimeBridge | null>(null);
    const routeId = route?.id ?? null;
    const fallbackAmount = route?.amount ?? null;

    const subscribe = useCallback((notify: () => void) => {
        if (routeId === null) {
            return () => {};
        }
        const bridge = acquireModulationRuntimeBridge(patchConnection);
        bridgeRef.current = bridge;
        const unsubscribe = bridge.subscribeRouteAmount(routeId, notify);

        return () => {
            unsubscribe();
            if (bridgeRef.current === bridge) {
                bridgeRef.current = null;
            }
            releaseModulationRuntimeBridge(patchConnection);
        };
    }, [patchConnection, routeId]);

    const getSnapshot = useCallback(() => {
        const bridge = bridgeRef.current;
        if (bridge === null) {
            return fallbackAmount;
        }

        return routeId === null ? null : bridge.getRouteAmount(routeId) ?? fallbackAmount;
    }, [fallbackAmount, routeId]);
    const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const setValue = useCallback((nextAmount: number) => {
        const bridge = bridgeRef.current;
        if (bridge === null || routeId === null) {
            return false;
        }
        return bridge.setRouteAmountById(routeId, nextAmount);
    }, [routeId]);

    return useMemo(() => ({ value, setValue }), [setValue, value]);
}
