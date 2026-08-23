import {
    useCallback,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react";

import { usePatchConnection } from "./cmajor-react";
import {
    modulationAmountBaseBindingSpec,
    parameterEntrySpecForModulationAmount,
    type ParameterEntrySpec,
} from "./parameter-value-entry";
import { useLaneOrHostParameterBinding } from "./lane-param-bindings";
import {
    acquireModulationRuntimeBridge,
    releaseModulationRuntimeBridge,
    type ModulationRoute,
    type ModulationRuntimeBridge,
    type ModulationTargetKind,
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

/** Keep exact-entry logarithmic intervals anchored to the target's live base value. */
export function useModulationAmountParameterEntrySpec(
    targetKind: ModulationTargetKind,
): ParameterEntrySpec {
    const baseSpec = modulationAmountBaseBindingSpec(targetKind);
    const endpointID = baseSpec?.endpointID ?? "filterCutoff";
    const initialValue = baseSpec?.initialValue ?? 1;
    const coerceBaseValue = useCallback((rawValue: unknown) => {
        const numericValue = Number(rawValue);
        return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : initialValue;
    }, [initialValue]);
    const baseBinding = useLaneOrHostParameterBinding({
        endpointID,
        initialValue,
        coerce: coerceBaseValue,
        active: baseSpec !== null,
    });

    return useMemo(
        () => parameterEntrySpecForModulationAmount(targetKind, baseBinding.value),
        [baseBinding.value, targetKind],
    );
}

/**
 * ADR-023: a route presented on a live control must carry its CANONICAL
 * amount, not the deferred document's copy — during a drag the document lags
 * until the gesture settles, freezing every derived visual (rings, HUD
 * limits, readouts). Compose the bridge value in before handing the route to
 * a control.
 */
export function presentRouteWithCanonicalAmount<TRoute extends Pick<ModulationRoute, "amount">>(
    route: TRoute | null,
    binding: OptionalModulationRouteAmountBinding,
): TRoute | null {
    return route === null || binding.value === null
        ? route
        : { ...route, amount: binding.value };
}

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
