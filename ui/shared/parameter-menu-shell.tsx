/**
 * The shell side of the ADR-017 long-press parameter menu: one state
 * machine per shell (desktop and iOS), fed by ParameterMenuRequests from any
 * control, resolving route actions against the armed source and writing
 * amounts through the canonical ADR-023 amount binding.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
    ParameterContextMenu,
    ParameterValueSheet,
    RemoveTargetRoutesConfirmation,
    type ParameterMenuAction,
    type ParameterMenuRequest,
} from "./parameter-context-menu";
import {
    MODULATION_SOURCE_OPTIONS,
    isVoiceModulationSource,
    type ModulationRoute,
    type ModulationRouteUpdate,
} from "./modulation";
import type { ModulationTargetKind } from "./modulation-targets";
import { findRackModulationSource, type RackModulationSourceKind } from "./rack-modulation-sources";
import { useModulationRouteAmountBinding } from "./modulation-route-amount";
import { parameterEntrySpecForModulationAmount } from "./parameter-value-entry";

export function useParameterMenuShell({
    routes,
    armedSourceKind,
    armedSourceSlot,
    onRouteChange,
    onRemoveRoute,
}: {
    routes: ReadonlyArray<ModulationRoute>;
    armedSourceKind: RackModulationSourceKind;
    armedSourceSlot: number;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    onRemoveRoute: (routeIndex: number) => void;
}): {
    openParameterMenu: (request: ParameterMenuRequest) => void;
    parameterMenuOverlays: ReactNode;
} {
    const [request, setRequest] = useState<ParameterMenuRequest | null>(null);
    const [stage, setStage] = useState<"menu" | "edit" | "remove-all">("menu");
    const openParameterMenu = useCallback((nextRequest: ParameterMenuRequest) => {
        setRequest(nextRequest);
        setStage("menu");
    }, []);
    const close = useCallback(() => {
        setRequest(null);
        setStage("menu");
    }, []);

    const targetKind = (request?.targetKind ?? null) as ModulationTargetKind | null;
    const routeIndex = useMemo(() => {
        if (request?.routeIndex !== undefined) {
            return request.routeIndex;
        }
        return targetKind === null
            ? -1
            : routes.findIndex((route) => (
                route.targetKind === targetKind
                && route.sourceKind === armedSourceKind
                && route.sourceSlot === armedSourceSlot
            ));
    }, [armedSourceKind, armedSourceSlot, request?.routeIndex, routes, targetKind]);
    const routeRaw = routeIndex >= 0 ? routes[routeIndex] : null;
    const amountBinding = useModulationRouteAmountBinding(routeRaw);
    const route = routeRaw === null || amountBinding.value === null
        ? routeRaw
        : { ...routeRaw, amount: amountBinding.value };
    const targetRouteIndices = useMemo(() => (
        targetKind === null
            ? []
            : routes
                .map((candidate, index) => (candidate.targetKind === targetKind ? index : -1))
                .filter((index) => index >= 0)
    ), [routes, targetKind]);

    const handleAction = useCallback((action: ParameterMenuAction) => {
        if (request === null) {
            throw new Error("A parameter-menu action fired without an open menu.");
        }
        if (action === "toggle-key-track") {
            if (request.keyTrack === undefined) {
                throw new Error(`${request.controlKey} is not Key Track eligible.`);
            }
            request.keyTrack.toggle();
            close();
            return;
        }
        if (action === "edit-values") {
            setStage("edit");
            return;
        }
        if (action === "reset-base") {
            if (request.defaultValue === null || request.commitBase === null) {
                throw new Error(`${request.controlKey} has no canonical default.`);
            }
            request.commitBase(request.defaultValue);
            close();
            return;
        }
        if (action === "remove-all-target-routes") {
            setStage("remove-all");
            return;
        }
        if (routeIndex >= 0 && route !== null) {
            if (action === "toggle-route") {
                onRouteChange(routeIndex, { enabled: !route.enabled });
            } else if (action === "polarity") {
                onRouteChange(routeIndex, {
                    polarity: route.polarity === "unipolar" ? "bipolar" : "unipolar",
                });
            } else if (action === "reducer" && isVoiceModulationSource(route.sourceKind)) {
                onRouteChange(routeIndex, {
                    reducer: route.reducer === "max" ? "mean" : "max",
                });
            } else if (action === "remove-route") {
                onRemoveRoute(routeIndex);
            }
        }
        close();
    }, [close, onRemoveRoute, onRouteChange, request, route, routeIndex]);

    const sourceLabel = route === null
        ? findRackModulationSource(armedSourceKind, armedSourceSlot).label
        : MODULATION_SOURCE_OPTIONS.find((source) => (
            source.sourceKind === route.sourceKind && source.sourceSlot === route.sourceSlot
        ))?.label ?? "Selected source";

    const parameterMenuOverlays = (
        <>
            {request !== null && stage === "menu" ? (
                <ParameterContextMenu
                    position={request}
                    controlId={request.controlKey}
                    route={route}
                    targetRouteCount={targetRouteIndices.length}
                    keyTrackEnabled={request.keyTrack?.enabled ?? null}
                    canResetBase={request.defaultValue !== null && request.commitBase !== null}
                    onClose={close}
                    onSelectAction={handleAction}
                />
            ) : null}
            {request !== null && stage === "edit" ? (
                <ParameterValueSheet
                    heading={request.label}
                    label={request.label}
                    base={request.baseSpec === null ? null : {
                        spec: request.baseSpec,
                        value: request.baseValue,
                        defaultValue: request.defaultValue,
                    }}
                    baseFieldLabel={request.baseFieldLabel}
                    routeFieldLabel={request.routeDestinationLabel === undefined
                        ? undefined
                        : `${sourceLabel} -> ${request.routeDestinationLabel}`}
                    route={route}
                    amountSpec={request.amountSpec !== undefined
                        ? request.amountSpec
                        : targetKind === null
                            ? null
                            : parameterEntrySpecForModulationAmount(targetKind, request.baseValue ?? 1)}
                    sourceLabel={sourceLabel}
                    onApply={(baseCommit, modulationAmount) => {
                        if (baseCommit !== null) {
                            if (baseCommit._tag !== "value" || request.commitBase === null) {
                                throw new Error("This parameter cannot commit a tempo division.");
                            }
                            request.commitBase(baseCommit.value);
                        }
                        if (modulationAmount !== null && route !== null) {
                            amountBinding.setValue(modulationAmount);
                        }
                        close();
                    }}
                    onClose={close}
                />
            ) : null}
            {request !== null && stage === "remove-all" ? (
                <RemoveTargetRoutesConfirmation
                    targetLabel={request.label}
                    routeCount={targetRouteIndices.length}
                    onCancel={close}
                    onConfirm={() => {
                        [...targetRouteIndices]
                            .sort((left, right) => right - left)
                            .forEach(onRemoveRoute);
                        close();
                    }}
                />
            ) : null}
        </>
    );

    return { openParameterMenu, parameterMenuOverlays };
}
