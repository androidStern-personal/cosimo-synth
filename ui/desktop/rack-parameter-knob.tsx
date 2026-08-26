import {
    useCallback,
    useContext,
    useId,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { maybeLaneBaseKindForRackEndpoint } from "../shared/modulation-targets";
import { createPortal } from "react-dom";

import {
    formatModulationAmountReadout,
    getModulationAmountBounds,
    getModulationAmountSliderPosition,
    type ModulationRoute,
    type RackModulationTargetKind,
} from "../shared/modulation";
import type { ModulationTargetKind } from "../shared/modulation-targets";
import {
    PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
    PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
    useParameterGesture,
    type ParameterGestureChannel,
} from "../shared/parameter-gesture";
import {
    ParameterHudLayerContext,
    ParameterPrecisionHud,
    PARAMETER_HUD_LINGER_MS,
    hexToRgbTriplet,
    type ParameterHudModel,
} from "../shared/parameter-hud";
import { BYPASSED_GREY as KNOB_BYPASSED_GREY, type ParameterKnobModRing } from "../shared/parameter-knob-artwork";
import type { PatchControlBinding } from "../shared/patch-controls";
import { useParameterMenu } from "../shared/parameter-context-menu";
import type { ParameterEntrySpec } from "../shared/parameter-value-entry";
import { findRackModulationSource } from "../shared/rack-modulation-sources";
import {
    formatRackParameterValue,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import {
    projectRackRouteLiveNormalized,
    projectRackRouteTravel,
    type ModulatedParameterProjectionDescriptor,
    type RackRouteEffectiveness,
} from "../shared/rack-route-presentation";
import { useModSourceLight, type ModSourceLightPlacement } from "../shared/mod-source-live";
import { clearUiTimeout, uiTimeout } from "../shared/ui-timers";

const KNOB_CENTER = 50;
const KNOB_SWEEP_START_DEGREES = 225;
const KNOB_SWEEP_DEGREES = 270;
const BASE_RADIUS = 25;
const MOD_INNER_RADIUS = 36;
const MOD_OUTER_RADIUS = 48;

const KNOB_LIGHT_PLACEMENT: ModSourceLightPlacement = {
    kind: "knob-arc",
    radius: (MOD_INNER_RADIUS + MOD_OUTER_RADIUS) / 2,
};

type Point = {
    readonly x: number;
    readonly y: number;
};

export type ParameterKnobDescriptor = Pick<
    RackParameterDescriptor,
    "endpointID" | "label" | "shortLabel" | "min" | "max" | "initial" | "step" | "scale"
>;

export type BaseParameterKnobProps = {
    readonly descriptor: ParameterKnobDescriptor;
    readonly binding: PatchControlBinding<number>;
    readonly dataRole: string;
    readonly trackDataRole: string;
    readonly handleDataRole: string;
    readonly detentStep: number | null;
    readonly formatValue: (value: number) => string;
    readonly modulationTargetKind?: ModulationTargetKind;
    /** Accent the precision HUD frames this control's owner with. */
    readonly ownerAccent?: string;
    /** Exact-entry spec: with a shell menu present, long-press opens the
        ADR-017 parameter menu built from this spec (T20: every control). */
    readonly entrySpec?: ParameterEntrySpec;
};

export type RackParameterKnobProps = {
    readonly descriptor: RackParameterDescriptor;
    readonly binding: PatchControlBinding<number>;
    readonly route: ModulationRoute | null;
    readonly sourceIsSelected: boolean;
    readonly sourceAccent: string;
    readonly effectiveness: RackRouteEffectiveness;
    readonly dataRole: string;
    readonly trackDataRole: string;
    readonly handleDataRole: string;
    readonly onSelect: () => void;
    readonly onModulationAmountChange: (amount: number) => void;
    readonly onRequestContextMenu: (clientX: number, clientY: number) => void;
    /** Overrides the lane base-instance default for voice-endpoint callers. */
    readonly modulationTargetKind?: ModulationTargetKind;
    /** Overrides the rack readout so voice endpoints keep their surface's display language. */
    readonly formatValue?: (value: number) => string;
    /** Accent the precision HUD frames this control's owner with. */
    readonly ownerAccent?: string;
    /**
     * How vertical travel maps onto the modulation amount.
     * "amount-span" (default): travel is linear across the amount domain.
     * "effective-value": travel walks the MODULATED value (base + amount)
     * along the knob's own dial scale — for a parameter whose base rests
     * next to a domain edge (resonance), the default crams all of one
     * direction's effect into a few pixels and leaves the rest dead.
     */
    readonly modulationDragStyle?: "amount-span" | "effective-value";
};

export type ModulatedParameterKnobProps = Omit<
    RackParameterKnobProps,
    "descriptor" | "formatValue"
> & {
    readonly descriptor: ParameterKnobDescriptor;
    readonly modulationApplication: "linear" | "octaves";
    readonly formatValue: (value: number) => string;
};

export type RackParameterHudAnchor = {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
};

export type RackParameterHud = {
    readonly endpointID: string;
    readonly label: string;
    readonly value: string;
    readonly mode: "base" | "modulation";
    readonly anchor: RackParameterHudAnchor;
    readonly pointer: { readonly x: number; readonly y: number };
};

/** Neutral owner frame for knobs whose host declares no accent. */
const DEFAULT_KNOB_OWNER_ACCENT = "#d5dcde";

function triggerParameterControlHaptic() {
    const trigger = (globalThis as typeof globalThis & {
        cmaj_triggerHaptic?: (style?: string) => unknown;
    }).cmaj_triggerHaptic;
    trigger?.("light");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function normalizedValue(descriptor: ParameterKnobDescriptor, value: number) {
    const clamped = clamp(value, descriptor.min, descriptor.max);
    if (descriptor.scale === "log") {
        return Math.log(clamped / descriptor.min) / Math.log(descriptor.max / descriptor.min);
    }
    return (clamped - descriptor.min) / (descriptor.max - descriptor.min);
}

function valueFromNormalized(descriptor: ParameterKnobDescriptor, normalized: number) {
    const clamped = clamp(normalized, 0, 1);
    return descriptor.scale === "log"
        ? descriptor.min * ((descriptor.max / descriptor.min) ** clamped)
        : descriptor.min + (clamped * (descriptor.max - descriptor.min));
}

function snapParameterValue(
    descriptor: ParameterKnobDescriptor,
    value: number,
    detentStep: number | null,
) {
    const clamped = clamp(value, descriptor.min, descriptor.max);
    if (detentStep === null) {
        return clamped;
    }

    const stepIndex = Math.round((clamped - descriptor.min) / detentStep);
    return Number(clamp(
        descriptor.min + (stepIndex * detentStep),
        descriptor.min,
        descriptor.max,
    ).toFixed(10));
}

function pointOnCircle(degrees: number, radius: number): Point {
    const radians = (degrees * Math.PI) / 180;
    return {
        x: KNOB_CENTER + (radius * Math.cos(radians)),
        y: KNOB_CENTER - (radius * Math.sin(radians)),
    };
}

function angleForNormalized(value: number) {
    return KNOB_SWEEP_START_DEGREES - (clamp(value, 0, 1) * KNOB_SWEEP_DEGREES);
}

function formatPoint(point: Point) {
    return `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
}

function pieSectorPath(fromNormalized: number, toNormalized: number, radius: number) {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * KNOB_SWEEP_DEGREES;
    if (extent <= 0.001) {
        return "";
    }
    const start = pointOnCircle(angleForNormalized(low), radius);
    const end = pointOnCircle(angleForNormalized(high), radius);
    return `M ${KNOB_CENTER} ${KNOB_CENTER} L ${formatPoint(start)} A ${radius} ${radius} 0 ${extent > 180 ? 1 : 0} 1 ${formatPoint(end)} Z`;
}

function annularSectorPath(
    fromNormalized: number,
    toNormalized: number,
    innerRadius: number,
    outerRadius: number,
) {
    const low = Math.min(fromNormalized, toNormalized);
    const high = Math.max(fromNormalized, toNormalized);
    const extent = (high - low) * KNOB_SWEEP_DEGREES;
    if (extent <= 0.001) {
        return "";
    }
    const outerStart = pointOnCircle(angleForNormalized(low), outerRadius);
    const outerEnd = pointOnCircle(angleForNormalized(high), outerRadius);
    const innerStart = pointOnCircle(angleForNormalized(low), innerRadius);
    const innerEnd = pointOnCircle(angleForNormalized(high), innerRadius);
    const largeArc = extent > 180 ? 1 : 0;
    return `M ${formatPoint(outerStart)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${formatPoint(outerEnd)} L ${formatPoint(innerEnd)} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${formatPoint(innerStart)} Z`;
}

type ParameterKnobSurfaceProps = {
    readonly descriptor: ParameterKnobDescriptor;
    readonly rackDescriptor: ModulatedParameterProjectionDescriptor | null;
    readonly binding: PatchControlBinding<number>;
    readonly route: ModulationRoute | null;
    readonly sourceIsSelected: boolean;
    readonly sourceAccent: string;
    readonly effectiveness: RackRouteEffectiveness;
    readonly dataRole: string;
    readonly trackDataRole: string;
    readonly handleDataRole: string;
    readonly className: string;
    readonly detentStep: number | null;
    readonly formatValue: (value: number) => string;
    readonly enableModulationGesture: boolean;
    readonly enableContextMenu: boolean;
    readonly onSelect: () => void;
    readonly onModulationAmountChange: (amount: number) => void;
    readonly onRequestContextMenu: (clientX: number, clientY: number) => void;
    readonly modulationTargetKind?: ModulationTargetKind;
    readonly ownerAccent?: string;
    readonly modulationDragStyle?: "amount-span" | "effective-value";
};

function ParameterKnobSurface({
    descriptor,
    rackDescriptor,
    binding,
    route,
    sourceIsSelected,
    sourceAccent,
    effectiveness,
    dataRole,
    trackDataRole,
    handleDataRole,
    className,
    detentStep,
    formatValue,
    enableModulationGesture,
    enableContextMenu,
    onSelect,
    onModulationAmountChange,
    onRequestContextMenu,
    modulationTargetKind,
    ownerAccent,
    modulationDragStyle = "amount-span",
}: ParameterKnobSurfaceProps) {
    const artRef = useRef<SVGSVGElement | null>(null);
    const bindingRef = useRef(binding);
    const detentStepRef = useRef(detentStep);
    const onModulationAmountChangeRef = useRef(onModulationAmountChange);
    const onRequestContextMenuRef = useRef(onRequestContextMenu);
    bindingRef.current = binding;
    detentStepRef.current = detentStep;
    onModulationAmountChangeRef.current = onModulationAmountChange;
    onRequestContextMenuRef.current = onRequestContextMenu;
    const patternStem = useId().replaceAll(":", "");
    const baseTrackPatternID = `rack-knob-base-${patternStem}`;
    const modTrackPatternID = `rack-knob-mod-${patternStem}`;
    const baseNormalized = normalizedValue(descriptor, binding.value);
    // Rack knobs address their own rack destination; voice-endpoint callers
    // (the compact filter row) pass the canonical voice kind instead.
    // A non-effect endpoint has no lane kind; the sentinel misses every
    // route/limit lookup exactly as the untargeted case always has.
    const targetKind = modulationTargetKind
        ?? maybeLaneBaseKindForRackEndpoint(descriptor.endpointID)
        ?? (`lane.none#1.${descriptor.endpointID}` as RackModulationTargetKind);
    const modulationAmount = route?.amount ?? 0;
    const baseOrigin = descriptor.min < 0 && descriptor.max > 0
        ? normalizedValue(descriptor, 0)
        : 0;
    const routeTravel = route === null || rackDescriptor === null
        ? null
        : projectRackRouteTravel(rackDescriptor, binding.value, route);
    // The traveling live light rides the mod fill only while the fill itself
    // is visible: an enabled route on the armed source with real travel.
    const liveLightRoute = route !== null
        && rackDescriptor !== null
        && route.enabled
        && sourceIsSelected
        && routeTravel !== null
        && routeTravel.hasVisibleTravel
        && effectiveness === "active"
        ? route
        : null;
    const liveLightProject = liveLightRoute === null || rackDescriptor === null
        ? null
        : (sourceValue01: number) => projectRackRouteLiveNormalized(
            rackDescriptor,
            binding.value,
            liveLightRoute,
            sourceValue01,
        );
    const attachModLight = useModSourceLight({
        source: liveLightRoute !== null
            ? { sourceKind: liveLightRoute.sourceKind, sourceSlot: liveLightRoute.sourceSlot }
            : null,
        project: liveLightProject ?? ((sourceValue01) => sourceValue01),
        placement: KNOB_LIGHT_PLACEMENT,
    });
    const routePresencePoint = pointOnCircle(angleForNormalized(baseNormalized), (MOD_INNER_RADIUS + MOD_OUTER_RADIUS) / 2);
    const handlePoint = pointOnCircle(angleForNormalized(baseNormalized), BASE_RADIUS * 0.72);
    const defaultPoint = pointOnCircle(
        angleForNormalized(normalizedValue(descriptor, descriptor.initial)),
        BASE_RADIUS * 0.94,
    );
    // ADR-025: the inside describes the parameter's OWNER (Voice/effect
    // identity color); grey may appear only when the control genuinely cannot
    // affect sound. The outside ring's color belongs to the selected source.
    const resolvedOwnerAccent = ownerAccent ?? DEFAULT_KNOB_OWNER_ACCENT;
    const controlIsGrey = effectiveness !== "active";
    const style = {
        "--rack-knob-accent": controlIsGrey ? KNOB_BYPASSED_GREY : resolvedOwnerAccent,
        "--rack-knob-mod-accent": controlIsGrey ? KNOB_BYPASSED_GREY : sourceAccent,
        "--rack-knob-bypassed-ink": KNOB_BYPASSED_GREY,
    } as CSSProperties;

    const gestureController = useParameterGesture();
    const hudLayer = useContext(ParameterHudLayerContext);
    const [draggingMode, setDraggingMode] = useState<"pending" | "base" | "modulation" | null>(null);
    const [hudPresentation, setHudPresentation] = useState<{
        readonly phase: "active" | "lingering";
        readonly axis: "base" | "modulation";
    } | null>(null);
    const hudLingerTimerRef = useRef<number | null>(null);
    const hostGestureActiveRef = useRef(false);
    const lastBaseValueRef = useRef(binding.value);

    const clearHudLinger = useCallback(() => {
        if (hudLingerTimerRef.current !== null) {
            clearUiTimeout(hudLingerTimerRef.current);
            hudLingerTimerRef.current = null;
        }
    }, []);

    const hideHud = useCallback((immediate: boolean) => {
        clearHudLinger();
        if (immediate) {
            setHudPresentation(null);
            return;
        }
        setHudPresentation((current) => (
            current === null ? current : { ...current, phase: "lingering" }
        ));
        hudLingerTimerRef.current = uiTimeout(() => {
            hudLingerTimerRef.current = null;
            setHudPresentation(null);
        }, PARAMETER_HUD_LINGER_MS);
    }, [clearHudLinger]);

    const endHostGesture = useCallback(() => {
        if (hostGestureActiveRef.current) {
            bindingRef.current.endGesture();
            hostGestureActiveRef.current = false;
        }
    }, []);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        if (gestureController.isGestureActive()) {
            return;
        }
        onSelect();

        const gestureDescriptor = descriptor;
        const gestureTargetKind = modulationTargetKind
            ?? maybeLaneBaseKindForRackEndpoint(gestureDescriptor.endpointID)
            ?? (`lane.none#1.${gestureDescriptor.endpointID}` as RackModulationTargetKind);
        const amountBounds = enableModulationGesture && route !== null
            ? getModulationAmountBounds(gestureTargetKind)
            : null;
        lastBaseValueRef.current = bindingRef.current.value;

        const baseChannel: ParameterGestureChannel = {
            startNormalized: normalizedValue(gestureDescriptor, bindingRef.current.value),
            pixelsPerFullSpan: PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
            write: (normalized) => {
                const nextValue = snapParameterValue(
                    gestureDescriptor,
                    valueFromNormalized(gestureDescriptor, normalized),
                    detentStepRef.current,
                );
                const valueChanged = Math.abs(nextValue - lastBaseValueRef.current) > 1e-9;
                if (detentStepRef.current !== null && valueChanged) {
                    triggerParameterControlHaptic();
                }
                if (detentStepRef.current === null || valueChanged) {
                    bindingRef.current.setValue(nextValue);
                    lastBaseValueRef.current = nextValue;
                }
            },
            onActivate: () => {
                if (!hostGestureActiveRef.current) {
                    bindingRef.current.beginGesture();
                    hostGestureActiveRef.current = true;
                }
                setDraggingMode("base");
                clearHudLinger();
                setHudPresentation({ phase: "active", axis: "base" });
            },
        };

        // The vertical axis always classifies; without an editable mapping it
        // stays inert and the HUD keeps the base presentation (ADR-024).
        const modulationEditable = amountBounds !== null;
        const baseValueAtStart = bindingRef.current.value;
        const dialWalk = modulationDragStyle === "effective-value";
        const modulationChannel: ParameterGestureChannel = {
            startNormalized: amountBounds === null
                ? 0
                : dialWalk
                    ? normalizedValue(gestureDescriptor, baseValueAtStart + (route?.amount ?? 0))
                    : clamp(
                        ((route?.amount ?? 0) - amountBounds.min) / (amountBounds.max - amountBounds.min),
                        0,
                        1,
                    ),
            pixelsPerFullSpan: dialWalk
                ? PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE
                : PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
            write: amountBounds === null ? null : (normalized) => {
                if (dialWalk) {
                    // Walk the modulated value along the dial: every pixel of
                    // travel covers the same fraction of the knob's range in
                    // both directions, and the amount is derived storage.
                    onModulationAmountChangeRef.current(
                        valueFromNormalized(gestureDescriptor, normalized) - baseValueAtStart,
                    );
                    return;
                }
                onModulationAmountChangeRef.current(
                    amountBounds.min + (normalized * (amountBounds.max - amountBounds.min)),
                );
            },
            onActivate: () => {
                endHostGesture();
                setDraggingMode(modulationEditable ? "modulation" : "base");
                clearHudLinger();
                setHudPresentation({ phase: "active", axis: modulationEditable ? "modulation" : "base" });
            },
        };

        gestureController.startGesture(event, {
            horizontal: baseChannel,
            vertical: modulationChannel,
            onFinish: (reason, ownedAxis) => {
                endHostGesture();
                setDraggingMode(null);
                if (ownedAxis !== null) {
                    hideHud(reason === "cancel");
                } else {
                    hideHud(true);
                }
            },
            onLongPress: enableContextMenu
                ? (clientX, clientY) => {
                    triggerParameterControlHaptic();
                    onRequestContextMenuRef.current(clientX, clientY);
                }
                : undefined,
        });
        setDraggingMode("pending");
    }, [
        clearHudLinger,
        descriptor,
        enableContextMenu,
        enableModulationGesture,
        endHostGesture,
        gestureController,
        hideHud,
        modulationTargetKind,
        onSelect,
        route,
    ]);

    const hudModel: ParameterHudModel | null = hudPresentation === null ? null : (() => {
        // Routes shown here always come from the armed rail source, whose
        // kinds are the rack set; performance-source routes never present.
        const sourceIdentity = route !== null
            && route.sourceSlot !== null
            && (route.sourceKind === "mseg" || route.sourceKind === "env" || route.sourceKind === "macro")
            ? findRackModulationSource(route.sourceKind, route.sourceSlot)
            : null;
        const sourceLine = route !== null && sourceIdentity !== null
            ? `${sourceIdentity.shortLabel} ${route.sourceSlot ?? ""}`.trim()
                + ` · ${formatModulationAmountReadout(targetKind, modulationAmount, route.polarity)}`
            : "";
        const modRing: ParameterKnobModRing = !enableModulationGesture || !sourceIsSelected
            ? { kind: "hidden" }
            : route === null
                ? { kind: "unmapped" }
                : {
                    kind: "mapped",
                    lowNormalized: routeTravel?.normalized[0] ?? baseNormalized,
                    highNormalized: routeTravel?.normalized[1] ?? baseNormalized,
                    bypassed: !route.enabled,
                };
        return {
            visible: true,
            axis: hudPresentation.axis,
            label: descriptor.label,
            sourceLine,
            ownerAccent: resolvedOwnerAccent,
            ownerAccentRgb: hexToRgbTriplet(resolvedOwnerAccent),
            sourceAccent,
            baseNormalized,
            baseOriginNormalized: baseOrigin,
            baseText: formatValue(binding.value),
            lowText: formatValue(routeTravel?.values[0] ?? binding.value),
            highText: formatValue(routeTravel?.values[1] ?? binding.value),
            limitsVisible: route !== null && Math.abs(modulationAmount) > 1e-9,
            modRing,
            liveLight: liveLightRoute !== null && liveLightProject !== null
                ? {
                    source: {
                        sourceKind: liveLightRoute.sourceKind,
                        sourceSlot: liveLightRoute.sourceSlot,
                    },
                    project: liveLightProject,
                }
                : null,
        };
    })();

    return (
        <>
        <button
            type="button"
            role="slider"
            data-role={dataRole}
            value={String(binding.value)}
            aria-label={descriptor.label}
            aria-valuemin={descriptor.min}
            aria-valuemax={descriptor.max}
            aria-valuenow={binding.value}
            aria-valuetext={formatValue(binding.value)}
            data-detented={detentStep === null ? "false" : "true"}
            data-route-state={!sourceIsSelected ? "no-source" : route === null ? "unmapped" : route.enabled ? "mapped" : "bypassed"}
            data-route-effectiveness={effectiveness}
            data-modulation-target-kind={modulationTargetKind}
            data-dragging={draggingMode ?? undefined}
            className={className}
            style={style}
            onPointerDown={handlePointerDown}
            onContextMenu={(event) => {
                if (!enableContextMenu) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                onSelect();
                onRequestContextMenu(event.clientX, event.clientY);
            }}
            onClick={(event) => {
                if (event.detail === 0) {
                    onSelect();
                }
            }}
            onKeyDown={(event) => {
                if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"].includes(event.key)) {
                    return;
                }
                event.preventDefault();
                if (!enableModulationGesture) {
                    const direction = ["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1;
                    const keyboardStep = event.shiftKey && detentStep === null
                        ? descriptor.step / 10
                        : descriptor.step;
                    const rawValue = event.key === "Home"
                        ? descriptor.min
                        : event.key === "End"
                            ? descriptor.max
                            : binding.value + (direction * keyboardStep);
                    const nextValue = snapParameterValue(descriptor, rawValue, detentStep);
                    if (Math.abs(nextValue - binding.value) > 1e-9) {
                        binding.commitValue(nextValue);
                        if (detentStep !== null) {
                            triggerParameterControlHaptic();
                        }
                    }
                    onSelect();
                    return;
                }
                const step = event.shiftKey ? 0.01 : 0.04;
                const current = normalizedValue(descriptor, binding.value);
                const nextNormalized = event.key === "Home"
                    ? 0
                    : event.key === "End"
                        ? 1
                        : clamp(current + (["ArrowUp", "ArrowRight"].includes(event.key) ? step : -step), 0, 1);
                binding.commitValue(valueFromNormalized(descriptor, nextNormalized));
                onSelect();
            }}
        >
            <span className="rack-knob-label">{descriptor.shortLabel}</span>
            <svg
                ref={artRef}
                className="rack-knob-art"
                data-role={trackDataRole}
                viewBox="-3 -3 106 106"
                aria-hidden="true"
            >
                <defs>
                    <pattern id={baseTrackPatternID} width="4" height="4" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.9" fill="var(--rack-knob-accent)" />
                    </pattern>
                    <pattern id={modTrackPatternID} width="4" height="4" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.9" fill="var(--rack-knob-mod-accent)" />
                    </pattern>
                </defs>
                <path
                    className="rack-knob-base-track"
                    d={pieSectorPath(0, 1, BASE_RADIUS)}
                    fill={`url(#${baseTrackPatternID})`}
                />
                {route ? (
                    <circle
                        className={`rack-knob-route-presence${route.enabled ? "" : " is-bypassed"}`}
                        cx={routePresencePoint.x}
                        cy={routePresencePoint.y}
                        r="2.25"
                    />
                ) : null}
                <path
                    className="rack-knob-base-fill"
                    d={pieSectorPath(baseOrigin, baseNormalized, BASE_RADIUS)}
                />
                <path
                    className={`rack-knob-mod-track${sourceIsSelected ? route ? " is-mapped" : " is-unmapped" : " is-hidden"}${route && !route.enabled ? " is-bypassed" : ""}`}
                    d={annularSectorPath(0, 1, MOD_INNER_RADIUS, MOD_OUTER_RADIUS)}
                    fill={`url(#${modTrackPatternID})`}
                />
                <path
                    className={`rack-knob-mod-fill${route && !route.enabled ? " is-bypassed" : ""}`}
                    d={routeTravel === null
                        ? ""
                        : annularSectorPath(routeTravel.normalized[0], routeTravel.normalized[1], MOD_INNER_RADIUS, MOD_OUTER_RADIUS)}
                />
                {liveLightRoute !== null ? (
                    <circle
                        data-role="rack-knob-mod-light"
                        data-mod-live="0"
                        className="rack-knob-mod-light"
                        ref={attachModLight}
                        cx={routePresencePoint.x}
                        cy={routePresencePoint.y}
                        r="2.4"
                    />
                ) : null}
                <circle
                    className="rack-knob-default-marker"
                    cx={defaultPoint.x}
                    cy={defaultPoint.y}
                    r="1.75"
                />
                <circle
                    data-role={handleDataRole}
                    className="rack-knob-handle"
                    cx={handlePoint.x}
                    cy={handlePoint.y}
                    r="2.5"
                />
            </svg>
            <output className="rack-knob-readout">{formatValue(binding.value)}</output>
        </button>
        {hudModel !== null && hudLayer !== null
            ? createPortal(<ParameterPrecisionHud model={hudModel} />, hudLayer)
            : null}
        </>
    );
}

function ignoreSelection() {}
function ignoreModulationAmountChange(_amount: number) {}
function ignoreContextMenu(_clientX: number, _clientY: number) {}

/** Stippled dual-ring rack control: inner sector is the base value, outer sector is the selected modulation route. */
export function RackParameterKnob(props: RackParameterKnobProps) {
    return (
        <ParameterKnobSurface
            {...props}
            rackDescriptor={props.descriptor}
            className="rack-parameter-knob"
            detentStep={null}
            formatValue={props.formatValue ?? ((value) => formatRackParameterValue(props.descriptor, value))}
            enableModulationGesture
            enableContextMenu
        />
    );
}

/** The production dual-ring knob for a modulatable non-rack parameter. */
export function ModulatedParameterKnob({
    descriptor,
    modulationApplication,
    formatValue,
    ...props
}: ModulatedParameterKnobProps) {
    return (
        <ParameterKnobSurface
            {...props}
            descriptor={descriptor}
            rackDescriptor={{ ...descriptor, modulationApplication }}
            className="rack-parameter-knob"
            detentStep={null}
            formatValue={formatValue}
            enableModulationGesture
            enableContextMenu
        />
    );
}

/** Base-value knob using the mobile FX visual and touch interaction without exposing a fake modulation route. */
export function BaseParameterKnob(props: BaseParameterKnobProps) {
    const openParameterMenu = useParameterMenu();
    const { entrySpec, ...surfaceProps } = props;
    const menuAvailable = openParameterMenu !== null && entrySpec !== undefined;
    return (
        <ParameterKnobSurface
            {...surfaceProps}
            rackDescriptor={null}
            route={null}
            sourceIsSelected={false}
            sourceAccent="transparent"
            effectiveness="active"
            className="rack-parameter-knob oscillator-parameter-knob"
            enableModulationGesture={false}
            enableContextMenu={menuAvailable}
            onSelect={ignoreSelection}
            onModulationAmountChange={ignoreModulationAmountChange}
            onRequestContextMenu={menuAvailable
                ? (clientX: number, clientY: number) => {
                    openParameterMenu({
                        controlKey: props.descriptor.endpointID,
                        label: props.descriptor.label,
                        targetKind: props.modulationTargetKind ?? null,
                        baseSpec: entrySpec,
                        baseValue: props.binding.value,
                        defaultValue: props.descriptor.initial,
                        commitBase: props.binding.commitValue,
                        clientX,
                        clientY,
                    });
                }
                : ignoreContextMenu}
        />
    );
}
