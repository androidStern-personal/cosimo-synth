import {
    useCallback,
    useEffect,
    useId,
    useRef,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import {
    composeModulationAmount,
    formatModulationAmountReadout,
    getModulationAmountSliderPosition,
    type ModulationRoute,
    type RackModulationTargetKind,
} from "../shared/modulation";
import type { PatchControlBinding } from "../shared/patch-controls";
import {
    formatRackParameterValue,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";

const KNOB_CENTER = 50;
const KNOB_SWEEP_START_DEGREES = 225;
const KNOB_SWEEP_DEGREES = 270;
const BASE_RADIUS = 25;
const MOD_INNER_RADIUS = 36;
const MOD_OUTER_RADIUS = 48;

type Point = {
    readonly x: number;
    readonly y: number;
};

export type RackParameterKnobProps = {
    readonly descriptor: RackParameterDescriptor;
    readonly binding: PatchControlBinding<number>;
    readonly route: ModulationRoute | null;
    readonly sourceIsSelected: boolean;
    readonly sourceAccent: string;
    readonly dataRole: string;
    readonly trackDataRole: string;
    readonly handleDataRole: string;
    readonly onSelect: () => void;
    readonly onHudChange: (hud: RackParameterHud | null) => void;
    readonly onModulationAmountChange: (amount: number) => void;
    readonly onRequestContextMenu: (clientX: number, clientY: number) => void;
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

type KnobGesture = {
    readonly pointerId: number;
    readonly element: HTMLButtonElement;
    readonly startClientX: number;
    readonly startClientY: number;
    readonly startBaseNormalized: number;
    readonly startModulationNormalized: number;
    mode: "pending" | "base" | "modulation";
    moved: boolean;
    baseGestureStarted: boolean;
    holdActivated: boolean;
};

const LONG_PRESS_DELAY_MS = 500;
const GESTURE_MOVE_THRESHOLD_PX = 6;

function triggerRackControlHaptic() {
    const trigger = (globalThis as typeof globalThis & {
        cmaj_triggerHaptic?: (style?: string) => unknown;
    }).cmaj_triggerHaptic;
    trigger?.("light");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function normalizedValue(descriptor: RackParameterDescriptor, value: number) {
    const clamped = clamp(value, descriptor.min, descriptor.max);
    if (descriptor.scale === "log") {
        return Math.log(clamped / descriptor.min) / Math.log(descriptor.max / descriptor.min);
    }
    return (clamped - descriptor.min) / (descriptor.max - descriptor.min);
}

function valueFromNormalized(descriptor: RackParameterDescriptor, normalized: number) {
    const clamped = clamp(normalized, 0, 1);
    return descriptor.scale === "log"
        ? descriptor.min * ((descriptor.max / descriptor.min) ** clamped)
        : descriptor.min + (clamped * (descriptor.max - descriptor.min));
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

function modulationRange(
    descriptor: RackParameterDescriptor,
    baseValue: number,
    route: ModulationRoute | null,
) {
    if (!route || Math.abs(route.amount) <= 1e-9) {
        return null;
    }

    const magnitude = Math.abs(route.amount);
    let lowValue: number;
    let highValue: number;

    if (descriptor.scale === "log") {
        if (route.polarity === "bipolar") {
            lowValue = baseValue * (2 ** -magnitude);
            highValue = baseValue * (2 ** magnitude);
        } else {
            const modulated = baseValue * (2 ** route.amount);
            lowValue = Math.min(baseValue, modulated);
            highValue = Math.max(baseValue, modulated);
        }
    } else if (route.polarity === "bipolar") {
        lowValue = baseValue - magnitude;
        highValue = baseValue + magnitude;
    } else {
        const modulated = baseValue + route.amount;
        lowValue = Math.min(baseValue, modulated);
        highValue = Math.max(baseValue, modulated);
    }

    return {
        low: normalizedValue(descriptor, lowValue),
        high: normalizedValue(descriptor, highValue),
    };
}

/** Stippled dual-ring rack control: inner sector is the base value, outer sector is the selected modulation route. */
export function RackParameterKnob({
    descriptor,
    binding,
    route,
    sourceIsSelected,
    sourceAccent,
    dataRole,
    trackDataRole,
    handleDataRole,
    onSelect,
    onHudChange,
    onModulationAmountChange,
    onRequestContextMenu,
}: RackParameterKnobProps) {
    const artRef = useRef<SVGSVGElement | null>(null);
    const gestureRef = useRef<KnobGesture | null>(null);
    const suppressClickRef = useRef(false);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bindingRef = useRef(binding);
    const descriptorRef = useRef(descriptor);
    const routePolarityRef = useRef(route?.polarity);
    const routeRef = useRef(route);
    const sourceIsSelectedRef = useRef(sourceIsSelected);
    const onHudChangeRef = useRef(onHudChange);
    const onModulationAmountChangeRef = useRef(onModulationAmountChange);
    const onRequestContextMenuRef = useRef(onRequestContextMenu);
    bindingRef.current = binding;
    descriptorRef.current = descriptor;
    routePolarityRef.current = route?.polarity;
    routeRef.current = route;
    sourceIsSelectedRef.current = sourceIsSelected;
    onHudChangeRef.current = onHudChange;
    onModulationAmountChangeRef.current = onModulationAmountChange;
    onRequestContextMenuRef.current = onRequestContextMenu;
    const patternStem = useId().replaceAll(":", "");
    const baseTrackPatternID = `rack-knob-base-${patternStem}`;
    const modTrackPatternID = `rack-knob-mod-${patternStem}`;
    const baseNormalized = normalizedValue(descriptor, binding.value);
    const targetKind = `rack.${descriptor.endpointID}` as RackModulationTargetKind;
    const modulationAmount = route?.amount ?? 0;
    const modulationNormalized = getModulationAmountSliderPosition(targetKind, modulationAmount);
    const baseOrigin = descriptor.min < 0 && descriptor.max > 0
        ? normalizedValue(descriptor, 0)
        : 0;
    const routeRange = modulationRange(descriptor, binding.value, route);
    const routePresencePoint = pointOnCircle(angleForNormalized(baseNormalized), (MOD_INNER_RADIUS + MOD_OUTER_RADIUS) / 2);
    const handlePoint = pointOnCircle(angleForNormalized(baseNormalized), BASE_RADIUS * 0.72);
    const defaultPoint = pointOnCircle(
        angleForNormalized(normalizedValue(descriptor, descriptor.initial)),
        BASE_RADIUS * 0.94,
    );
    const style = {
        "--rack-knob-accent": "var(--editor-accent)",
        "--rack-knob-mod-accent": sourceAccent,
    } as CSSProperties;

    const finishGesture = useCallback((pointerId?: number) => {
        const gesture = gestureRef.current;
        if (!gesture || (pointerId !== undefined && gesture.pointerId !== pointerId)) {
            return;
        }

        gestureRef.current = null;
        if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        suppressClickRef.current = gesture.moved || gesture.holdActivated;
        delete gesture.element.dataset.dragging;
        try {
            if (gesture.element.hasPointerCapture(gesture.pointerId)) {
                gesture.element.releasePointerCapture(gesture.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation or window deactivation.
        }
        if (gesture.baseGestureStarted) {
            bindingRef.current.endGesture();
        }
        onHudChangeRef.current(null);
    }, []);

    const updateGestureFromPointer = useCallback((event: Pick<
        PointerEvent,
        "pointerId" | "pointerType" | "buttons" | "clientX" | "clientY" | "shiftKey" | "preventDefault" | "stopPropagation"
    >) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            finishGesture(event.pointerId);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const deltaX = event.clientX - gesture.startClientX;
        const deltaY = gesture.startClientY - event.clientY;
        const distance = Math.hypot(
            event.clientX - gesture.startClientX,
            event.clientY - gesture.startClientY,
        );
        if (!gesture.moved && distance >= GESTURE_MOVE_THRESHOLD_PX) {
            gesture.moved = true;
            gesture.mode = Math.abs(deltaX) > Math.abs(deltaY) ? "modulation" : "base";
            gesture.element.dataset.dragging = gesture.mode;
            if (holdTimerRef.current !== null) {
                clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
            }
            if (gesture.mode === "base") {
                bindingRef.current.beginGesture();
                gesture.baseGestureStarted = true;
            } else if (!sourceIsSelectedRef.current || routeRef.current === null) {
                triggerRackControlHaptic();
            }
        }
        if (!gesture.moved || gesture.holdActivated) {
            return;
        }
        const currentDescriptor = descriptorRef.current;
        const currentTargetKind = `rack.${currentDescriptor.endpointID}` as RackModulationTargetKind;
        const anchorBounds = gesture.element.getBoundingClientRect();
        const hudAnchor = {
            left: anchorBounds.left,
            top: anchorBounds.top,
            right: anchorBounds.right,
            bottom: anchorBounds.bottom,
        };
        const hudPointer = { x: event.clientX, y: event.clientY };
        const sensitivity = event.shiftKey ? 720 : 180;
        const nextNormalized = clamp(
            gesture.mode === "base"
                ? gesture.startBaseNormalized + (deltaY / sensitivity)
                : gesture.startModulationNormalized + (deltaX / sensitivity),
            0,
            1,
        );
        if (gesture.mode === "modulation") {
            if (!sourceIsSelectedRef.current || routeRef.current === null) {
                onHudChangeRef.current({
                    endpointID: currentDescriptor.endpointID,
                    label: "MOD",
                    value: sourceIsSelectedRef.current
                        ? "NOT MAPPED · CREATE MAPPING +"
                        : "SELECT A SOURCE",
                    mode: "modulation",
                    anchor: hudAnchor,
                    pointer: hudPointer,
                });
                return;
            }
            const nextAmount = composeModulationAmount(currentTargetKind, nextNormalized);
            onModulationAmountChangeRef.current(nextAmount);
            onHudChangeRef.current({
                endpointID: currentDescriptor.endpointID,
                label: `MOD · ${currentDescriptor.label}`,
                value: formatModulationAmountReadout(currentTargetKind, nextAmount, routePolarityRef.current),
                mode: "modulation",
                anchor: hudAnchor,
                pointer: hudPointer,
            });
            return;
        }

        const nextValue = valueFromNormalized(currentDescriptor, nextNormalized);
        bindingRef.current.setValue(nextValue);
        onHudChangeRef.current({
            endpointID: currentDescriptor.endpointID,
            label: `BASE · ${currentDescriptor.label}`,
            value: formatRackParameterValue(currentDescriptor, nextValue),
            mode: "base",
            anchor: hudAnchor,
            pointer: hudPointer,
        });
    }, [finishGesture]);

    useEffect(() => {
        const handleFallbackPointerMove = (event: PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture || gesture.pointerId !== event.pointerId) {
                return;
            }
            if (event.target instanceof Node && gesture.element.contains(event.target)) {
                return;
            }
            updateGestureFromPointer(event);
        };
        const handlePointerEnd = (event: PointerEvent) => finishGesture(event.pointerId);
        const handleBlur = () => finishGesture();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                finishGesture();
            }
        };

        window.addEventListener("pointermove", handleFallbackPointerMove, true);
        window.addEventListener("pointerup", handlePointerEnd, true);
        window.addEventListener("pointercancel", handlePointerEnd, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointermove", handleFallbackPointerMove, true);
            window.removeEventListener("pointerup", handlePointerEnd, true);
            window.removeEventListener("pointercancel", handlePointerEnd, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            finishGesture();
        };
    }, [finishGesture, updateGestureFromPointer]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        const art = artRef.current;
        if (!art) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        finishGesture();
        onSelect();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events may not own a platform pointer.
        }
        event.currentTarget.dataset.dragging = "pending";
        gestureRef.current = {
            pointerId: event.pointerId,
            element: event.currentTarget,
            mode: "pending",
            startClientX: event.clientX,
            startClientY: event.clientY,
            startBaseNormalized: baseNormalized,
            startModulationNormalized: modulationNormalized,
            moved: false,
            baseGestureStarted: false,
            holdActivated: false,
        };
        holdTimerRef.current = setTimeout(() => {
            const gesture = gestureRef.current;
            if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) {
                return;
            }
            holdTimerRef.current = null;
            gesture.holdActivated = true;
            suppressClickRef.current = true;
            onHudChangeRef.current(null);
            triggerRackControlHaptic();
            onRequestContextMenuRef.current(event.clientX, event.clientY);
        }, LONG_PRESS_DELAY_MS);
    }, [
        baseNormalized,
        descriptor,
        finishGesture,
        modulationNormalized,
        onSelect,
    ]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        updateGestureFromPointer(event.nativeEvent);
    }, [updateGestureFromPointer]);

    return (
        <button
            type="button"
            role="slider"
            data-role={dataRole}
            value={String(binding.value)}
            aria-label={descriptor.label}
            aria-valuemin={descriptor.min}
            aria-valuemax={descriptor.max}
            aria-valuenow={binding.value}
            data-route-state={!sourceIsSelected ? "no-source" : route === null ? "unmapped" : route.enabled ? "mapped" : "bypassed"}
            className="rack-parameter-knob"
            style={style}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => finishGesture(event.pointerId)}
            onPointerCancel={(event) => finishGesture(event.pointerId)}
            onLostPointerCapture={(event) => finishGesture(event.pointerId)}
            onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect();
                onRequestContextMenu(event.clientX, event.clientY);
            }}
            onClick={(event) => {
                if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                if (event.detail === 0) {
                    onSelect();
                }
            }}
            onKeyDown={(event) => {
                if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"].includes(event.key)) {
                    return;
                }
                event.preventDefault();
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
                    d={routeRange === null
                        ? ""
                        : annularSectorPath(routeRange.low, routeRange.high, MOD_INNER_RADIUS, MOD_OUTER_RADIUS)}
                />
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
            <output className="rack-knob-readout">{formatRackParameterValue(descriptor, binding.value)}</output>
        </button>
    );
}
