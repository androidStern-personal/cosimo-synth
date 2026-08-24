/**
 * The ONE compact numeric-readout cell language (ADR-024): rolling-axis drags
 * (horizontal = base, vertical = the armed source's route amount), truth-table
 * rails, the fixed top-center precision HUD, long-press menu seam, keyboard
 * nudges, and choice cells — extracted from the mobile Voice editor so the T13
 * quick-editor sheet reuses the EXACT interaction contract instead of
 * inventing drawer-specific controls.
 *
 * `useReadoutCells` owns ALL cell behavior and the HUD; hosts render their own
 * shells with its handlers (the Voice editor keeps its strip rows AND its
 * graph-overlay chips on the one hook), or use the standard `ReadoutCell` /
 * `ParameterReadoutStrip` shells. The host owns the gesture controller
 * (ui/shared/parameter-gesture.ts) and passes it in, so host-owned gestures
 * (the Voice wavetable graph) share the single-active-gesture invariant.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
    PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
    PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
    type ParameterGestureChannel,
    type useParameterGesture,
} from "./parameter-gesture";
import { ParameterPrecisionHud, type ParameterHudModel } from "./parameter-hud";
import type { ParameterKnobModRing } from "./parameter-knob-artwork";
import type { PatchControlBinding } from "./patch-controls";
import {
    projectMobileVoiceRailBand,
    projectRailLiveNormalized,
    resolveMobileVoiceRailState,
    type MobileVoiceRailBand,
    type MobileVoiceRailState,
} from "./mobile-voice-rail-projection";
import { useModSourceLight, type ModSourceLightPlacement } from "./mod-source-live";
import { clearUiTimeout, uiTimeout } from "./ui-timers";
import {
    formatModulationAmountReadout,
    getModulationAmountBounds,
    type ModulationRoute,
} from "./modulation";
import { useModulationRouteAmountBinding } from "./modulation-route-amount";
import type { ModulationTargetKind } from "./modulation-targets";

/** HUD linger after a completed cell drag (matches the established feel). */
const HUD_LINGER_MS = 420;
/** Sticky integer-amount capture window (semitone detents on Tune cells). */
const STICKY_AMOUNT_CAPTURE = 0.2;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

export type ReadoutCellDisplay = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly choices?: ReadonlyArray<string>;
};

export type ReadoutCellHudTravel = {
    /** HUD label override while editing the amount (voice Tune shows "Tune"). */
    readonly label?: string;
    readonly lowText: string;
    readonly highText: string;
};

export type ReadoutCellSpec = {
    readonly id: string;
    readonly kind: "readout" | "choice";
    readonly shortLabel: string;
    readonly fullLabel: string;
    readonly display: ReadoutCellDisplay;
    /** Full-precision text (aria, HUD base line). */
    readonly formatValue: (value: number) => string;
    /** Compact in-cell text; defaults to formatValue. */
    readonly formatCellValue?: (value: number) => ReactNode;
    readonly targetKind: ModulationTargetKind | null;
    /** Base drags snap with one haptic per newly reached step. */
    readonly detented?: boolean;
    /** Amount drags lock to whole integers inside a capture window. */
    readonly stickyIntegerAmounts?: boolean;
    /** "effective-value": vertical travel walks the MODULATED value along
        the cell's own dial at base-drag speed (the knobs' settled resonance
        rule); the amount is derived storage. Requires the normalize/
        denormalize pair. Defaults to the linear amount-domain walk. */
    readonly amountDragStyle?: "amount-span" | "effective-value";
    /** Tick-position override for cells whose display scale is not linear
        (e.g. a log Hz track). Defaults to linear normalization. Supply
        denormalizeValue with it: the base drag walks the display scale
        through the pair, so equal finger travel is equal display travel. */
    readonly normalizeValue?: (value: number) => number;
    readonly denormalizeValue?: (normalized: number) => number;
    /** Band override for cells whose rail is not the plain display domain. */
    readonly projectBand?: (
        baseNormalized: number,
        route: Pick<ModulationRoute, "amount" | "polarity">,
    ) => MobileVoiceRailBand;
    /**
     * Route-amount units spanned by the full rail, for the live light's
     * projection; defaults to the display domain width. Cells with a
     * `projectBand` override (aggregate Tune) must supply their own span.
     */
    readonly railAmountSpan?: number;
    /** HUD Low/High override (voice Tune aggregates three cells). */
    readonly presentHudTravel?: (
        route: Pick<ModulationRoute, "amount" | "polarity"> | null,
    ) => ReadoutCellHudTravel;
};

export type ReadoutCellPresentation = {
    readonly cell: ReadoutCellSpec;
    readonly railState: MobileVoiceRailState;
    readonly band: MobileVoiceRailBand | null;
    readonly route: ModulationRoute | null;
    readonly baseNormalized: number;
};

export type ReadoutStripSource = {
    readonly sourceKind: ModulationRoute["sourceKind"];
    /** Performance sources (velocity, pressure, track) carry no slot. */
    readonly sourceSlot: number | null;
    readonly shortLabel: string;
    readonly accent: string;
};

type HudPhase = "hidden" | "active" | "lingering";

type HudState = {
    readonly phase: HudPhase;
    readonly axis: "base" | "modulation";
    readonly cellId: string | null;
};

const HIDDEN_HUD: HudState = { phase: "hidden", axis: "base", cellId: null };

export type ParameterReadoutStripProps = {
    readonly cells: ReadonlyArray<ReadoutCellSpec>;
    readonly bindings: Readonly<Record<string, PatchControlBinding<number>>>;
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly armedSource: ReadoutStripSource | null;
    readonly hudContainer: Element | null;
    readonly gestureController: ReturnType<typeof useParameterGesture>;
    readonly ownerAccent: string;
    readonly ownerAccentRgb: string;
    /** data-role prefix; the Voice editor passes "mobile-voice" so its roles stay stable. */
    readonly rolePrefix: string;
    readonly resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    readonly onRequestHaptic?: () => void;
    readonly onRequestParameterMenu?: (cellId: string, clientX: number, clientY: number) => void;
    /** Mirrors the gesture's canonical active route out (graph shading liveness). */
    readonly onActiveRouteChange?: (route: ModulationRoute | null) => void;
};

/** The strip's per-cell presentation, shared with hosts that render adjacent visuals. */
export function presentReadoutCell(
    cell: ReadoutCellSpec,
    binding: PatchControlBinding<number>,
    routes: ReadonlyArray<ModulationRoute>,
    armedSource: ReadoutStripSource | null,
    liveRoute: ModulationRoute | null,
    liveAmount: number | null,
): ReadoutCellPresentation {
    const display = cell.display;
    const value = clamp(binding.value, display.min, display.max);
    const baseNormalized = cell.normalizeValue !== undefined
        ? clamp(cell.normalizeValue(value), 0, 1)
        : (value - display.min) / (display.max - display.min);
    const topologyRoute = cell.targetKind === null || armedSource === null
        ? null
        : routes.find((route) => (
            route.targetKind === cell.targetKind
            && route.sourceKind === armedSource.sourceKind
            && route.sourceSlot === armedSource.sourceSlot
        )) ?? null;
    // ADR-023: the actively edited route presents its canonical amount.
    const amount = topologyRoute !== null
        && liveRoute !== null
        && topologyRoute.id === liveRoute.id
        && liveAmount !== null
        ? liveAmount
        : topologyRoute?.amount ?? 0;
    const route = topologyRoute === null ? null : { ...topologyRoute, amount };
    const railState = resolveMobileVoiceRailState({
        modulatable: cell.targetKind !== null,
        armed: armedSource !== null,
        route,
    });
    let band: MobileVoiceRailBand | null = null;
    if (route !== null && (railState === "mapped" || railState === "mapped-zero" || railState === "bypassed")) {
        band = cell.projectBand !== undefined
            ? cell.projectBand(baseNormalized, route)
            : projectMobileVoiceRailBand({ min: display.min, max: display.max }, value, route);
    }
    return { cell, railState, band, route, baseNormalized };
}

export function useReadoutCells({
    cells,
    bindings,
    routes,
    armedSource,
    hudContainer,
    gestureController,
    ownerAccent,
    ownerAccentRgb,
    resolveScrollLockTargets,
    onRequestHaptic,
    onRequestParameterMenu,
    onActiveRouteChange,
}: Omit<ParameterReadoutStripProps, "rolePrefix">) {
    const [hudState, setHudState] = useState<HudState>(HIDDEN_HUD);
    const [draggingCell, setDraggingCell] = useState<{
        readonly cellId: string;
        readonly mode: "pending" | "base" | "modulation";
    } | null>(null);

    const [activeRoute, setActiveRoute] = useState<ModulationRoute | null>(null);
    const activeAmountBinding = useModulationRouteAmountBinding(activeRoute);
    const activeAmountBindingRef = useRef(activeAmountBinding);
    activeAmountBindingRef.current = activeAmountBinding;
    const onActiveRouteChangeRef = useRef(onActiveRouteChange);
    onActiveRouteChangeRef.current = onActiveRouteChange;
    const setActiveRouteMirrored = useCallback((route: ModulationRoute | null) => {
        setActiveRoute(route);
        onActiveRouteChangeRef.current?.(route);
    }, []);

    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;
    const cellById = useMemo(() => new Map(cells.map((cell) => [cell.id, cell])), [cells]);
    const cellByIdRef = useRef(cellById);
    cellByIdRef.current = cellById;

    const hostGestureCellIdRef = useRef<string | null>(null);
    const gestureScratchRef = useRef<{ lastDetentValue: number | null; lastStickyAmount: number | null }>({
        lastDetentValue: null,
        lastStickyAmount: null,
    });
    const hudLingerTimerRef = useRef<number | null>(null);

    const clearHudLinger = useCallback(() => {
        if (hudLingerTimerRef.current !== null) {
            clearUiTimeout(hudLingerTimerRef.current);
            hudLingerTimerRef.current = null;
        }
    }, []);

    const hideHud = useCallback((immediate: boolean) => {
        clearHudLinger();
        if (immediate) {
            setHudState(HIDDEN_HUD);
            return;
        }
        setHudState((current) => (
            current.phase === "hidden" ? current : { ...current, phase: "lingering" }
        ));
        hudLingerTimerRef.current = uiTimeout(() => {
            hudLingerTimerRef.current = null;
            setHudState(HIDDEN_HUD);
        }, HUD_LINGER_MS);
    }, [clearHudLinger]);

    useEffect(() => () => clearHudLinger(), [clearHudLinger]);

    const endHostGesture = useCallback(() => {
        const cellId = hostGestureCellIdRef.current;
        if (cellId !== null) {
            bindingsRef.current[cellId].endGesture();
            hostGestureCellIdRef.current = null;
        }
    }, []);

    const beginHostGesture = useCallback((cellId: string) => {
        endHostGesture();
        bindingsRef.current[cellId].beginGesture();
        hostGestureCellIdRef.current = cellId;
    }, [endHostGesture]);

    const presentCell = useCallback((cellId: string): ReadoutCellPresentation => {
        const cell = cellByIdRef.current.get(cellId);
        if (cell === undefined) {
            throw new Error(`Unknown readout cell ${cellId}`);
        }
        return presentReadoutCell(
            cell,
            bindings[cellId],
            routes,
            armedSource,
            activeRoute,
            activeAmountBinding.value,
        );
    }, [activeAmountBinding.value, activeRoute, armedSource, bindings, routes]);

    const cellPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>, cellId: string) => {
        if (gestureController.isGestureActive()) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        const cell = cellByIdRef.current.get(cellId);
        if (cell === undefined) {
            throw new Error(`Unknown readout cell ${cellId}`);
        }

        const display = cell.display;
        const topologyRoute = cell.targetKind === null || armedSource === null
            ? null
            : routes.find((route) => (
                route.targetKind === cell.targetKind
                && route.sourceKind === armedSource.sourceKind
                && route.sourceSlot === armedSource.sourceSlot
            )) ?? null;
        const amountBounds = topologyRoute !== null && cell.targetKind !== null
            ? getModulationAmountBounds(cell.targetKind)
            : null;
        setActiveRouteMirrored(topologyRoute);
        gestureScratchRef.current = {
            lastDetentValue: null,
            lastStickyAmount: topologyRoute !== null
                && Math.abs(topologyRoute.amount - Math.round(topologyRoute.amount)) <= STICKY_AMOUNT_CAPTURE
                ? Math.round(topologyRoute.amount)
                : null,
        };

        const startValue = clamp(bindingsRef.current[cellId].value, display.min, display.max);
        const baseChannel: ParameterGestureChannel = {
            // The drag walks the cell's DISPLAY scale: gesture-normalized and
            // tick position are the same number, so the tick tracks the
            // finger and a log track moves in octaves, not raw units.
            startNormalized: clamp01(cell.normalizeValue !== undefined
                ? cell.normalizeValue(startValue)
                : (startValue - display.min) / (display.max - display.min)),
            pixelsPerFullSpan: PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE,
            write: (normalized) => {
                const raw = cell.denormalizeValue !== undefined
                    ? cell.denormalizeValue(normalized)
                    : display.min + (normalized * (display.max - display.min));
                // step <= 0 means a continuous parameter (entry specs record
                // "no quantization" as 0): write unsnapped — never divide by
                // the zero step.
                const snapped = display.step > 0
                    ? display.min + (Math.round((raw - display.min) / display.step) * display.step)
                    : raw;
                const value = clamp(snapped, display.min, display.max);
                if (cell.detented) {
                    if (gestureScratchRef.current.lastDetentValue !== value) {
                        if (gestureScratchRef.current.lastDetentValue !== null) {
                            onRequestHaptic?.();
                        }
                        gestureScratchRef.current.lastDetentValue = value;
                    }
                }
                bindingsRef.current[cellId].setValue(value);
            },
            onActivate: () => {
                beginHostGesture(cellId);
                setDraggingCell({ cellId, mode: "base" });
                clearHudLinger();
                setHudState({ phase: "active", axis: "base", cellId });
            },
        };

        const dialWalk = cell.amountDragStyle === "effective-value"
            && cell.normalizeValue !== undefined
            && cell.denormalizeValue !== undefined;
        const baseValueAtStart = clamp(bindingsRef.current[cellId].value, display.min, display.max);
        const modulationChannel: ParameterGestureChannel = {
            startNormalized: amountBounds === null
                ? 0
                : dialWalk
                    ? clamp01(cell.normalizeValue!(baseValueAtStart + (topologyRoute?.amount ?? 0)))
                    : clamp01(((topologyRoute?.amount ?? 0) - amountBounds.min) / (amountBounds.max - amountBounds.min)),
            pixelsPerFullSpan: dialWalk
                ? PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE
                : PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN,
            // No armed source, unmapped pair, or non-modulatable target:
            // vertical motion is inert (the HUD explains why).
            write: amountBounds === null ? null : (normalized) => {
                if (dialWalk) {
                    // Walk the modulated value along the dial: every pixel
                    // covers the same fraction of the range in both
                    // directions, and the amount is derived storage.
                    const amountBinding = activeAmountBindingRef.current;
                    if (amountBinding.value !== null) {
                        amountBinding.setValue(clamp(
                            cell.denormalizeValue!(normalized) - baseValueAtStart,
                            amountBounds.min,
                            amountBounds.max,
                        ));
                    }
                    return;
                }
                const span = amountBounds.max - amountBounds.min;
                const freeAmount = amountBounds.min + (normalized * span);
                let amountToWrite = freeAmount;
                if (cell.stickyIntegerAmounts) {
                    const nearest = Math.round(freeAmount);
                    if (Math.abs(freeAmount - nearest) <= STICKY_AMOUNT_CAPTURE) {
                        amountToWrite = nearest;
                        if (gestureScratchRef.current.lastStickyAmount !== nearest) {
                            onRequestHaptic?.();
                            gestureScratchRef.current.lastStickyAmount = nearest;
                        }
                    } else {
                        gestureScratchRef.current.lastStickyAmount = null;
                    }
                }
                const amountBinding = activeAmountBindingRef.current;
                if (amountBinding.value !== null) {
                    amountBinding.setValue(amountToWrite);
                }
            },
            onActivate: () => {
                endHostGesture();
                const editable = amountBounds !== null;
                setDraggingCell({ cellId, mode: editable ? "modulation" : "base" });
                clearHudLinger();
                setHudState({
                    phase: "active",
                    axis: editable ? "modulation" : "base",
                    cellId,
                });
            },
        };

        gestureController.startGesture(event, {
            horizontal: baseChannel,
            vertical: modulationChannel,
            onFinish: (reason, ownedAxis) => {
                endHostGesture();
                setDraggingCell(null);
                setActiveRouteMirrored(null);
                if (ownedAxis !== null) {
                    hideHud(reason === "cancel");
                } else {
                    hideHud(true);
                }
            },
            onLongPress: onRequestParameterMenu
                ? (clientX, clientY) => onRequestParameterMenu(cellId, clientX, clientY)
                : undefined,
            resolveScrollLockTargets,
        });
        setDraggingCell({ cellId, mode: "pending" });
    }, [
        armedSource,
        beginHostGesture,
        clearHudLinger,
        endHostGesture,
        gestureController,
        hideHud,
        onRequestHaptic,
        onRequestParameterMenu,
        resolveScrollLockTargets,
        routes,
        setActiveRouteMirrored,
    ]);

    const adjustBaseByStep = useCallback((cellId: string, direction: 1 | -1, coarse: boolean) => {
        const cell = cellByIdRef.current.get(cellId);
        if (cell === undefined) {
            throw new Error(`Unknown readout cell ${cellId}`);
        }
        const binding = bindingsRef.current[cellId];
        if (cell.normalizeValue !== undefined && cell.denormalizeValue !== undefined) {
            // Display-scale cells nudge 1% of the TRACK, matching the drag.
            const travel = 0.01 * (coarse ? 10 : 1) * direction;
            const next = cell.denormalizeValue(clamp(cell.normalizeValue(binding.value) + travel, 0, 1));
            binding.commitValue(clamp(next, cell.display.min, cell.display.max));
            return;
        }
        // Continuous cells (display step 0) nudge by 1% of their span so the
        // keyboard contract still moves the value.
        const baseStep = cell.display.step > 0
            ? cell.display.step
            : (cell.display.max - cell.display.min) / 100;
        const step = baseStep * (coarse ? 10 : 1);
        binding.commitValue(clamp(binding.value + (direction * step), cell.display.min, cell.display.max));
    }, []);

    const handleReadoutKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>, cellId: string) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight"
            && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
        adjustBaseByStep(cellId, direction, event.shiftKey);
    }, [adjustBaseByStep]);

    const cycleChoice = useCallback((cellId: string) => {
        const cell = cellByIdRef.current.get(cellId);
        if (cell === undefined) {
            throw new Error(`Unknown readout cell ${cellId}`);
        }
        const display = cell.display;
        const binding = bindingsRef.current[cellId];
        const count = (display.choices?.length ?? 0) || (display.max - display.min + 1);
        const next = display.min + (((Math.round(binding.value) - display.min) + 1) % count);
        binding.commitValue(next);
    }, []);

    const sourceAccent = armedSource?.accent ?? "#cc59d2";

    /* ---------------------------- HUD ------------------------------- */

    const hud = useMemo(() => {
        if (hudState.cellId === null || hudContainer === null) {
            return null;
        }
        const presentation = presentCell(hudState.cellId);
        const cell = presentation.cell;
        const display = cell.display;
        const isModulation = hudState.axis === "modulation";
        // Zero-anchored fill reads correctly only when zero is the center of
        // a symmetric range; asymmetric signed ranges fill from their minimum.
        const symmetricBipolar = display.min < 0 && display.max > 0
            && Math.abs(display.min) === display.max;
        const baseOrigin = symmetricBipolar
            ? (0 - display.min) / (display.max - display.min)
            : 0;

        let sourceLine = "";
        if (presentation.route !== null && armedSource !== null && cell.targetKind !== null) {
            const label = `${armedSource.shortLabel} ${armedSource.sourceSlot}`.trim();
            const amountText = formatModulationAmountReadout(
                cell.targetKind,
                presentation.route.amount,
                presentation.route.polarity,
            );
            sourceLine = `${label} · ${amountText}`;
        }

        const travel = cell.presentHudTravel !== undefined
            ? cell.presentHudTravel(presentation.route)
            : null;
        let lowText: string;
        let highText: string;
        if (travel !== null) {
            lowText = travel.lowText;
            highText = travel.highText;
        } else {
            const band = presentation.band;
            const lowValue = display.min
                + ((band?.lowNormalized ?? presentation.baseNormalized) * (display.max - display.min));
            const highValue = display.min
                + ((band?.highNormalized ?? presentation.baseNormalized) * (display.max - display.min));
            lowText = cell.formatValue(lowValue);
            highText = cell.formatValue(highValue);
        }

        const limitsVisible = presentation.route !== null
            && Math.abs(presentation.route.amount) > 1e-9;
        const modRing: ParameterKnobModRing = cell.targetKind === null || armedSource === null
            ? { kind: "hidden" }
            : presentation.route === null
                ? { kind: "unmapped" }
                : {
                    kind: "mapped",
                    lowNormalized: presentation.band?.lowNormalized ?? presentation.baseNormalized,
                    highNormalized: presentation.band?.highNormalized ?? presentation.baseNormalized,
                    bypassed: presentation.railState === "bypassed",
                };

        const liveLightProjection = presentation.railState === "mapped"
            ? readoutCellLiveLightProjection(presentation)
            : null;
        const model: ParameterHudModel = {
            visible: hudState.phase !== "hidden",
            axis: hudState.axis,
            label: isModulation && travel?.label !== undefined ? travel.label : cell.fullLabel,
            sourceLine,
            ownerAccent,
            ownerAccentRgb,
            sourceAccent,
            baseNormalized: presentation.baseNormalized,
            baseOriginNormalized: baseOrigin,
            baseText: cell.formatValue(clamp(bindings[cell.id].value, display.min, display.max)),
            lowText,
            highText,
            limitsVisible,
            modRing,
            liveLight: liveLightProjection !== null && presentation.route !== null
                ? {
                    source: {
                        sourceKind: presentation.route.sourceKind,
                        sourceSlot: presentation.route.sourceSlot,
                    },
                    project: liveLightProjection,
                }
                : null,
        };

        return createPortal(<ParameterPrecisionHud model={model} />, hudContainer);
    }, [armedSource, bindings, hudContainer, hudState, ownerAccent, ownerAccentRgb, presentCell, sourceAccent]);

    /* ------------------------- Host API ------------------------------ */

    return {
        cellPointerDown,
        handleReadoutKeyDown,
        cycleChoice,
        adjustBaseByStep,
        presentCell,
        draggingCell,
        sourceAccent,
        hud,
    };
}

export type ReadoutCellsApi = ReturnType<typeof useReadoutCells>;

const RAIL_LIGHT_PLACEMENT: ModSourceLightPlacement = { kind: "rail" };

/** The traveling live-modulation light on a mapped rail's band. */
function readoutCellLiveLightProjection(presentation: ReadoutCellPresentation) {
    const route = presentation.route;
    if (route === null) {
        return null;
    }
    const { cell, baseNormalized } = presentation;
    const span = cell.railAmountSpan ?? (cell.display.max - cell.display.min);
    return (sourceValue01: number) => (
        projectRailLiveNormalized(baseNormalized, route, sourceValue01, span)
    );
}

/** The truth-table rail under a readout cell (shared markup + classes). */
export function ReadoutCellRail({ presentation }: { presentation: ReadoutCellPresentation }) {
    const { railState, band } = presentation;
    const tickLeft = `${(presentation.baseNormalized * 100).toFixed(2)}%`;
    const lightProjection = railState === "mapped"
        ? readoutCellLiveLightProjection(presentation)
        : null;
    const attachLight = useModSourceLight({
        source: lightProjection !== null && presentation.route !== null
            ? { sourceKind: presentation.route.sourceKind, sourceSlot: presentation.route.sourceSlot }
            : null,
        project: lightProjection ?? ((sourceValue01) => sourceValue01),
        placement: RAIL_LIGHT_PLACEMENT,
    });
    return (
        <span className="mobile-voice-rail" data-rail-state={railState} aria-hidden="true">
            {railState !== "not-modulatable" ? (
                <span
                    className={`mobile-voice-rail-track${railState === "unmapped" ? " is-unmapped" : ""}`}
                />
            ) : null}
            {band !== null && railState !== "mapped-zero" ? (
                <span
                    className={`mobile-voice-rail-band${railState === "bypassed" ? " is-bypassed" : ""}`}
                    style={{
                        left: `${(band.lowNormalized * 100).toFixed(2)}%`,
                        width: `${((band.highNormalized - band.lowNormalized) * 100).toFixed(2)}%`,
                    }}
                />
            ) : null}
            {railState === "mapped-zero" ? (
                <span
                    className="mobile-voice-rail-zero"
                    style={{ left: `calc(${tickLeft} + 2px)` }}
                />
            ) : null}
            {band !== null && (band.clippedLow || band.clippedHigh) ? (
                <span
                    className="mobile-voice-rail-clip"
                    style={band.clippedHigh ? { right: 0 } : { left: 0 }}
                />
            ) : null}
            {lightProjection !== null ? (
                <span
                    data-role="mobile-voice-rail-mod-light"
                    data-mod-live="0"
                    className="mobile-voice-rail-light"
                    ref={attachLight}
                />
            ) : null}
            <span className="mobile-voice-rail-tick" style={{ left: tickLeft }} />
        </span>
    );
}

/** The standard row-cell shell (the Voice strip's exact markup and classes). */
export function ReadoutCell({
    cell,
    api,
    bindings,
    rolePrefix,
}: {
    cell: ReadoutCellSpec;
    api: ReadoutCellsApi;
    bindings: Readonly<Record<string, PatchControlBinding<number>>>;
    rolePrefix: string;
}) {
    if (cell.kind === "choice") {
        const display = cell.display;
        const choices = display.choices ?? [];
        const index = clamp(Math.round(bindings[cell.id].value), display.min, display.max);
        const label = choices[index - display.min] ?? String(index);
        return (
            <button
                type="button"
                data-role={`${rolePrefix}-cell-${cell.id}`}
                className="mobile-voice-cell is-choice"
                aria-label={`${cell.fullLabel}: ${label}`}
                onClick={() => api.cycleChoice(cell.id)}
            >
                <span className="cosimo-label">{cell.shortLabel}</span>
                <strong className="cosimo-readout is-end">{label}</strong>
            </button>
        );
    }

    const display = cell.display;
    const presentation = api.presentCell(cell.id);
    const value = clamp(bindings[cell.id].value, display.min, display.max);
    const dragging = api.draggingCell !== null && api.draggingCell.cellId === cell.id
        ? api.draggingCell.mode
        : undefined;
    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label={cell.fullLabel}
            aria-valuemin={display.min}
            aria-valuemax={display.max}
            aria-valuenow={value}
            aria-valuetext={cell.formatValue(value)}
            data-role={`${rolePrefix}-cell-${cell.id}`}
            data-modulation-target-kind={cell.targetKind ?? undefined}
            data-dragging={dragging}
            className="mobile-voice-cell is-readout"
            style={{ "--mobile-voice-source-accent": api.sourceAccent } as CSSProperties}
            onPointerDown={(event) => api.cellPointerDown(event, cell.id)}
            onKeyDown={(event) => api.handleReadoutKeyDown(event, cell.id)}
        >
            <span className="cosimo-label">{cell.shortLabel}</span>
            <strong className="cosimo-readout is-end">
                {(cell.formatCellValue ?? cell.formatValue)(value)}
            </strong>
            <ReadoutCellRail presentation={presentation} />
        </div>
    );
}

/** Thin composition for hosts without their own shells (the quick sheet). */
export function ParameterReadoutStrip(props: ParameterReadoutStripProps) {
    const { rolePrefix, ...hookProps } = props;
    const api = useReadoutCells(hookProps);
    return (
        <>
            {props.cells.map((cell) => (
                <ReadoutCell
                    key={cell.id}
                    cell={cell}
                    api={api}
                    bindings={props.bindings}
                    rolePrefix={rolePrefix}
                />
            ))}
            {api.hud}
        </>
    );
}
