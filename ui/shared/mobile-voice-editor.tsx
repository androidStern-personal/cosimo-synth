/**
 * The ADR-024 mobile Voice focused oscillator editor.
 *
 * One shared composition consumed by the compact responsive shell and the
 * native iPhone shell: letter-only A/B/C tabs with per-tab Solo badges and
 * active-tap Mute, the full-frame wavetable graph with corner overlays and
 * rolling-axis Warp/Index editing, and the attached five-page parameter
 * toolbar whose readout cells edit base horizontally and the selected
 * route's amount vertically, with the fixed top-center precision HUD.
 *
 * Behavior authorities:
 * - placement/labels/pages: `mobile-voice-parameter-manifest`
 * - movement semantics: `rolling-axis-classifier` (shared with the graph)
 * - graph axis ownership: `wavetable-graph-axis-projection` (X provisional)
 * - rail/HUD range truth: `mobile-voice-rail-projection`
 * - live route amounts: `useModulationRouteAmountBinding` (ADR-023)
 * - colors: ADR-025 (Voice owner accent inside, source accent outside)
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
    getOscillatorControlAddress,
    type OscillatorControlID,
    type OscillatorID,
    type OscillatorSelectionViewModel,
} from "./oscillator-binding";
import type { OscillatorModulationParameterKind } from "./modulation-targets";
import {
    formatModulationAmountReadout,
    getModulationAmountBounds,
    type ModulationRoute,
} from "./modulation";
import { useModulationRouteAmountBinding } from "./modulation-route-amount";
import { findRackModulationSource, type RackModulationSourceKind } from "./rack-modulation-sources";
import { usePatchParameterBinding, type PatchControlBinding } from "./patch-controls";
import {
    MOBILE_VOICE_PAGES,
    getMobileVoiceControlSpec,
    type MobileVoiceFormatKind,
    type MobileVoicePageName,
} from "./mobile-voice-parameter-manifest";
import {
    applyRollingAxisSample,
    createRollingAxisState,
    type RollingAxis,
    type RollingAxisPointerType,
    type RollingAxisState,
} from "./rolling-axis-classifier";
import {
    PROVISIONAL_WAVETABLE_GRAPH_AXES,
    projectGraphAxisWrite,
} from "./wavetable-graph-axis-projection";
import {
    aggregateTuneBaseSemitones,
    projectAggregateTuneTravel,
    projectMobileVoiceRailBand,
    projectTuneComponentBand,
    resolveMobileVoiceRailState,
    type AggregateTuneComponentID,
    type MobileVoiceRailBand,
    type MobileVoiceRailState,
} from "./mobile-voice-rail-projection";
import { ParameterKnobArtwork, type ParameterKnobModRing } from "./parameter-knob-artwork";
import { WavetableCanvas, type FactoryTableOption } from "./synth-components";

/* ------------------------------------------------------------------ */
/* Calibration (ADR-024: tunable with device evidence only)            */
/* ------------------------------------------------------------------ */

const BASE_PIXELS_PER_FULL_RANGE = 220;
const MODULATION_PIXELS_PER_FULL_SPAN = 360;
const HUD_LINGER_MS = 420;
/** Semitone capture window for sticky modulation detents on Tune. */
const MOD_DETENT_CAPTURE_ST = 0.2;
const LONG_PRESS_MS = 500;

export const MOBILE_VOICE_OWNER_ACCENT = "#69d5c5";

/* ------------------------------------------------------------------ */
/* Display descriptors                                                  */
/* ------------------------------------------------------------------ */

/**
 * Display range/step per control. These mirror the canonical coercion in
 * `synth-hooks` exactly (the live bindings clamp with the same numbers);
 * the toolbar never invents a second range for writes — every write passes
 * back through the binding's own coercion.
 */
type MobileVoiceBindableControlID = Exclude<OscillatorControlID, "wavetableSelect">;

type DisplayDescriptor = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly choices?: ReadonlyArray<string>;
};

const WARP_MODE_LABELS = ["Off", "Bend +/-", "PWM", "Asym +/-", "Mirror"] as const;
const PHASE_MODE_LABELS = ["Free", "Reset"] as const;
const DETUNE_MODE_LABELS = ["Linear", "Super", "Exp", "Inv", "Random"] as const;
const STACK_MODE_LABELS = ["Off", "12", "12+7", "Center-12", "Center-24"] as const;

const DISPLAY_DESCRIPTORS: Readonly<Record<MobileVoiceBindableControlID, DisplayDescriptor>> = Object.freeze({
    framePosition: { min: 0, max: 1, step: 0.001 },
    warpAmount: { min: 0, max: 1, step: 0.001 },
    warpMode: { min: 0, max: 4, step: 1, choices: WARP_MODE_LABELS },
    pan: { min: -1, max: 1, step: 0.01 },
    octave: { min: -4, max: 4, step: 1 },
    semitone: { min: -12, max: 12, step: 1 },
    fineCents: { min: -100, max: 100, step: 1 },
    volumeDb: { min: -48, max: 6, step: 0.1 },
    mute: { min: 0, max: 1, step: 1 },
    solo: { min: 0, max: 1, step: 1 },
    unisonVoices: { min: 1, max: 8, step: 1 },
    unisonDetune: { min: 0, max: 1, step: 0.001 },
    unisonBlend: { min: 0, max: 1, step: 0.001 },
    unisonWidth: { min: 0, max: 1, step: 0.001 },
    phase: { min: 0, max: 1, step: 0.001 },
    phaseRandom: { min: 0, max: 1, step: 0.001 },
    retrigger: { min: 0, max: 1, step: 1, choices: PHASE_MODE_LABELS },
    unisonDetuneMode: { min: 0, max: 4, step: 1, choices: DETUNE_MODE_LABELS },
    unisonStackMode: { min: 0, max: 4, step: 1, choices: STACK_MODE_LABELS },
    unisonWavetablePositionSpread: { min: 0, max: 1, step: 0.001 },
    unisonWarpSpread: { min: 0, max: 1, step: 0.001 },
});

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

function signedInteger(value: number): string {
    const rounded = Math.round(value);
    return `${rounded > 0 ? "+" : ""}${rounded}`;
}

/** Full formatting: HUD, accessibility text, and exact readouts. */
export function formatMobileVoiceValue(kind: MobileVoiceFormatKind, value: number): string {
    switch (kind) {
        case "percent": return `${Math.round(value * 100)}%`;
        case "decibels": return `${value.toFixed(1)} dB`;
        case "octave": return `${signedInteger(value)} oct`;
        case "semitone": return `${signedInteger(value)} st`;
        case "cents": return `${signedInteger(value)} ct`;
        case "detuneCents": return `${Math.round(value * 50)} ct`;
        case "pan": {
            const percent = Math.round(value * 100);
            if (percent === 0) {
                return "C";
            }
            return percent < 0 ? `${-percent} L` : `${percent} R`;
        }
        case "voices": return `${Math.round(value)}x`;
    }
}

/** Compact cell formatting: units keep no space so dense cells never collide. */
export function formatMobileVoiceCellValue(kind: MobileVoiceFormatKind, value: number): string {
    switch (kind) {
        case "decibels": return `${value.toFixed(1)}dB`;
        case "octave": return `${signedInteger(value)}oct`;
        case "semitone": return `${signedInteger(value)}st`;
        case "cents": return `${signedInteger(value)}ct`;
        case "detuneCents": return `${Math.round(value * 50)}ct`;
        default: return formatMobileVoiceValue(kind, value);
    }
}

const TUNE_COMPONENTS: ReadonlyArray<AggregateTuneComponentID> = ["octave", "semitone", "fineCents"];

function isTuneComponent(controlID: OscillatorControlID): controlID is AggregateTuneComponentID {
    return (TUNE_COMPONENTS as ReadonlyArray<OscillatorControlID>).includes(controlID);
}

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */

export type MobileVoiceArmedSource = {
    readonly sourceKind: RackModulationSourceKind;
    readonly sourceSlot: number;
};

export type MobileVoiceStageProps = {
    readonly frames: Float32Array[] | null;
    /** Observed drawing state (live values including modulation). */
    readonly position: number;
    readonly warpMode: number;
    readonly warpAmount: number;
    readonly tableName: string;
    readonly pendingTableName: string | null;
    readonly desiredTableIndex: number;
    readonly tableOptions: ReadonlyArray<FactoryTableOption>;
    readonly onTableChange: (nextValue: number) => void;
    readonly onTablePrewarm: () => void;
    readonly canRetry: boolean;
    readonly onRetry: () => void;
};

export type MobileVoiceEditorBindings = Readonly<
    Record<MobileVoiceBindableControlID, PatchControlBinding<number>>
>;

export type MobileVoiceFocusedEditorProps = {
    readonly selection: OscillatorSelectionViewModel;
    readonly bindings: MobileVoiceEditorBindings;
    readonly stage: MobileVoiceStageProps;
    /** Broad route topology (ADR-023: never used for live gesture amounts). */
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly armedSource: MobileVoiceArmedSource | null;
    /** Shell overlay element that hosts the fixed top-center HUD. */
    readonly hudContainer: Element | null;
    /** Scrollers to hold still while a readout gesture owns the pointer. */
    readonly resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    readonly onRequestHaptic?: () => void;
    /** The accepted long-press parameter menu, supplied by the shell. */
    readonly onRequestParameterMenu?: (
        controlID: OscillatorControlID,
        clientX: number,
        clientY: number,
    ) => void;
    /** Rendered between the tabs and the graph (e.g. nothing today). */
    readonly children?: ReactNode;
};

/* ------------------------------------------------------------------ */
/* Gesture controller                                                   */
/* ------------------------------------------------------------------ */

type GestureAxisOwner =
    | { readonly kind: "cell-base"; readonly controlID: MobileVoiceBindableControlID }
    | { readonly kind: "cell-modulation"; readonly controlID: MobileVoiceBindableControlID }
    | { readonly kind: "graph"; readonly axis: RollingAxis };

type ActiveGesture = {
    readonly surface: "cell" | "graph";
    readonly controlID: MobileVoiceBindableControlID | null;
    readonly pointerId: number;
    readonly pointerType: RollingAxisPointerType;
    readonly element: HTMLElement;
    classifier: RollingAxisState;
    owner: GestureAxisOwner | null;
    hostGestureControlID: MobileVoiceBindableControlID | null;
    baseNormalized: number;
    graphHorizontalNormalized: number;
    graphVerticalNormalized: number;
    amount: number;
    amountBounds: { readonly min: number; readonly max: number } | null;
    lastDetentValue: number | null;
    lastModulationDetent: number | null;
    pendingCommit: boolean;
    rafHandle: number | null;
    longPressTimer: number | null;
    scrollLocks: ReadonlyArray<{ readonly element: HTMLElement; readonly top: number; readonly left: number }>;
    windowScroll: { readonly x: number; readonly y: number };
    removeListeners: () => void;
};

type HudPhase = "hidden" | "active" | "lingering";

type HudState = {
    readonly phase: HudPhase;
    readonly axis: "base" | "modulation";
    readonly controlID: MobileVoiceBindableControlID | null;
};

const HIDDEN_HUD: HudState = { phase: "hidden", axis: "base", controlID: null };

function pointerTypeOf(event: PointerEvent | ReactPointerEvent<HTMLElement>): RollingAxisPointerType {
    return event.pointerType === "touch" ? "touch" : event.pointerType === "pen" ? "pen" : "mouse";
}

/* ------------------------------------------------------------------ */
/* Per-oscillator toggle bindings (tabs need all three at once)         */
/* ------------------------------------------------------------------ */

function useOscillatorToggleBinding(
    oscillatorID: OscillatorID,
    controlID: "mute" | "solo",
): PatchControlBinding<number> {
    return usePatchParameterBinding<number>({
        endpointID: getOscillatorControlAddress(oscillatorID, controlID).endpointID,
        initialValue: 0,
        coerce: useCallback((value: unknown) => clamp(Math.round(Number(value) || 0), 0, 1), []),
    });
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

export function MobileVoiceFocusedEditor({
    selection,
    bindings,
    stage,
    routes,
    armedSource,
    hudContainer,
    resolveScrollLockTargets,
    onRequestHaptic,
    onRequestParameterMenu,
    children,
}: MobileVoiceFocusedEditorProps) {
    const oscillatorID = selection.selectedOscillatorID;
    const contract = selection.selectedOscillator;

    const muteA = useOscillatorToggleBinding("A", "mute");
    const muteB = useOscillatorToggleBinding("B", "mute");
    const muteC = useOscillatorToggleBinding("C", "mute");
    const soloA = useOscillatorToggleBinding("A", "solo");
    const soloB = useOscillatorToggleBinding("B", "solo");
    const soloC = useOscillatorToggleBinding("C", "solo");
    const toggleBindings = useMemo(() => ({
        A: { mute: muteA, solo: soloA },
        B: { mute: muteB, solo: soloB },
        C: { mute: muteC, solo: soloC },
    }), [muteA, muteB, muteC, soloA, soloB, soloC]);

    /** Session-only page memory per oscillator (presentation state). */
    const [pageByOscillator, setPageByOscillator] = useState<Record<OscillatorID, number>>({
        A: 0,
        B: 0,
        C: 0,
    });
    const pageIndex = pageByOscillator[oscillatorID];
    const page = MOBILE_VOICE_PAGES[pageIndex];

    const [hudState, setHudState] = useState<HudState>(HIDDEN_HUD);
    const [graphAxis, setGraphAxis] = useState<RollingAxis | null>(null);
    const [draggingCell, setDraggingCell] = useState<{
        readonly controlID: MobileVoiceBindableControlID;
        readonly mode: "pending" | "base" | "modulation";
    } | null>(null);

    const targetKindFor = useCallback((parameterKind: OscillatorModulationParameterKind) => {
        const address = contract.modulationTargets.find(
            (candidate) => candidate.parameterKind === parameterKind,
        );
        if (address === undefined) {
            throw new Error(`Oscillator ${contract.id} has no MOD target ${parameterKind}`);
        }
        return address.targetKind;
    }, [contract]);

    const routeFor = useCallback((parameterKind: OscillatorModulationParameterKind | null) => {
        if (parameterKind === null || armedSource === null) {
            return null;
        }
        const targetKind = targetKindFor(parameterKind);
        return routes.find((route) => (
            route.targetKind === targetKind
            && route.sourceKind === armedSource.sourceKind
            && route.sourceSlot === armedSource.sourceSlot
        )) ?? null;
    }, [armedSource, routes, targetKindFor]);

    const armedSourceIdentity = useMemo(() => (
        armedSource === null
            ? null
            : findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot)
    ), [armedSource]);
    const sourceAccent = armedSourceIdentity?.accent ?? "#cc59d2";

    /**
     * ADR-023: the one route a gesture (or the HUD) is presenting reads and
     * writes through the canonical route-specific binding. All other rails
     * render from the broad topology projection.
     */
    const [activeRoute, setActiveRoute] = useState<ModulationRoute | null>(null);
    const activeAmountBinding = useModulationRouteAmountBinding(activeRoute);
    const activeAmountBindingRef = useRef(activeAmountBinding);
    activeAmountBindingRef.current = activeAmountBinding;

    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;

    const gestureRef = useRef<ActiveGesture | null>(null);
    const hudLingerTimerRef = useRef<number | null>(null);

    const clearHudLinger = useCallback(() => {
        if (hudLingerTimerRef.current !== null) {
            window.clearTimeout(hudLingerTimerRef.current);
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
        hudLingerTimerRef.current = window.setTimeout(() => {
            hudLingerTimerRef.current = null;
            setHudState(HIDDEN_HUD);
        }, HUD_LINGER_MS);
    }, [clearHudLinger]);

    const commitGestureFrame = useCallback(() => {
        const gesture = gestureRef.current;
        if (gesture === null || !gesture.pendingCommit) {
            return;
        }
        gesture.pendingCommit = false;
        const owner = gesture.owner;
        if (owner === null) {
            return;
        }

        if (owner.kind === "graph") {
            const descriptor = PROVISIONAL_WAVETABLE_GRAPH_AXES;
            const binding = owner.axis === "horizontal" ? descriptor.horizontal : descriptor.vertical;
            const controlID = binding.controlID as MobileVoiceBindableControlID;
            const display = DISPLAY_DESCRIPTORS[controlID];
            const normalized = owner.axis === "horizontal"
                ? gesture.graphHorizontalNormalized
                : gesture.graphVerticalNormalized;
            const value = display.min + (normalized * (display.max - display.min));
            bindingsRef.current[controlID].setValue(value);
            return;
        }

        const controlID = owner.controlID;
        const display = DISPLAY_DESCRIPTORS[controlID];
        if (owner.kind === "cell-base") {
            const raw = display.min + (gesture.baseNormalized * (display.max - display.min));
            const snapped = display.min
                + (Math.round((raw - display.min) / display.step) * display.step);
            const value = clamp(snapped, display.min, display.max);
            const spec = getMobileVoiceControlSpec(controlID);
            if (spec.detented) {
                if (gesture.lastDetentValue !== value) {
                    if (gesture.lastDetentValue !== null) {
                        onRequestHaptic?.();
                    }
                    gesture.lastDetentValue = value;
                }
            }
            bindingsRef.current[controlID].setValue(value);
            return;
        }

        const amountBinding = activeAmountBindingRef.current;
        if (amountBinding.value !== null) {
            let amountToWrite = gesture.amount;
            const spec = getMobileVoiceControlSpec(controlID);
            if (spec.modulationParameterKind === "pitchSemitones") {
                // Sticky semitone detents: the amount moves freely, but locks
                // to a whole semitone inside a small capture window with one
                // haptic bump per newly locked integer.
                const nearest = Math.round(gesture.amount);
                if (Math.abs(gesture.amount - nearest) <= MOD_DETENT_CAPTURE_ST) {
                    amountToWrite = nearest;
                    if (gesture.lastModulationDetent !== nearest) {
                        onRequestHaptic?.();
                        gesture.lastModulationDetent = nearest;
                    }
                } else {
                    gesture.lastModulationDetent = null;
                }
            }
            amountBinding.setValue(amountToWrite);
        }
    }, [onRequestHaptic]);

    const scheduleGestureCommit = useCallback(() => {
        const gesture = gestureRef.current;
        if (gesture === null) {
            return;
        }
        gesture.pendingCommit = true;
        if (gesture.rafHandle !== null) {
            return;
        }
        gesture.rafHandle = window.requestAnimationFrame(() => {
            const current = gestureRef.current;
            if (current !== null) {
                current.rafHandle = null;
            }
            commitGestureFrame();
        });
    }, [commitGestureFrame]);

    const endHostGesture = useCallback((gesture: ActiveGesture) => {
        if (gesture.hostGestureControlID !== null) {
            bindingsRef.current[gesture.hostGestureControlID].endGesture();
            gesture.hostGestureControlID = null;
        }
    }, []);

    const beginHostGesture = useCallback((gesture: ActiveGesture, controlID: MobileVoiceBindableControlID) => {
        endHostGesture(gesture);
        bindingsRef.current[controlID].beginGesture();
        gesture.hostGestureControlID = controlID;
    }, [endHostGesture]);

    const restoreScrollLocks = useCallback((gesture: ActiveGesture) => {
        for (const lock of gesture.scrollLocks) {
            if (lock.element.scrollTop !== lock.top) {
                lock.element.scrollTop = lock.top;
            }
            if (lock.element.scrollLeft !== lock.left) {
                lock.element.scrollLeft = lock.left;
            }
        }
        if (window.scrollX !== gesture.windowScroll.x || window.scrollY !== gesture.windowScroll.y) {
            window.scrollTo(gesture.windowScroll.x, gesture.windowScroll.y);
        }
    }, []);

    /** Idempotent single finish path for release AND every cancellation. */
    const finishGesture = useCallback((reason: "release" | "cancel") => {
        const gesture = gestureRef.current;
        if (gesture === null) {
            return;
        }
        gestureRef.current = null;

        if (gesture.longPressTimer !== null) {
            window.clearTimeout(gesture.longPressTimer);
        }
        if (gesture.rafHandle !== null) {
            window.cancelAnimationFrame(gesture.rafHandle);
            gesture.rafHandle = null;
        }
        // Flush the final integrated delta before the host gesture closes.
        if (reason === "release" && gesture.pendingCommit) {
            gestureRef.current = gesture;
            commitGestureFrame();
            gestureRef.current = null;
        }
        endHostGesture(gesture);
        gesture.removeListeners();
        try {
            if (gesture.element.hasPointerCapture(gesture.pointerId)) {
                gesture.element.releasePointerCapture(gesture.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation; not terminal.
        }
        restoreScrollLocks(gesture);
        setDraggingCell(null);
        setGraphAxis(null);
        setActiveRoute(null);
        if (gesture.surface === "cell" && gesture.owner !== null) {
            hideHud(reason === "cancel");
        } else {
            hideHud(true);
        }
    }, [commitGestureFrame, endHostGesture, hideHud, restoreScrollLocks]);

    const finishGestureRef = useRef(finishGesture);
    finishGestureRef.current = finishGesture;

    /** Cancel on oscillator/page rebinds, unmount, and session teardown. */
    useEffect(() => () => {
        finishGestureRef.current("cancel");
    }, []);
    useEffect(() => {
        finishGestureRef.current("cancel");
    }, [oscillatorID]);
    useEffect(() => {
        // A page change mid-drag (e.g. a second finger on a paddle) cancels
        // exactly once before the presentation rebinds (ADR-024 §17).
        finishGestureRef.current("cancel");
    }, [pageIndex]);
    useEffect(() => {
        if (armedSource !== null) {
            return;
        }
        finishGestureRef.current("cancel");
    }, [armedSource]);

    const applyGestureSample = useCallback((event: PointerEvent) => {
        const gesture = gestureRef.current;
        if (gesture === null || event.pointerId !== gesture.pointerId) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            // Only mouse treats zero buttons as an implicit release; Safari
            // touch moves legitimately report buttons === 0.
            finishGestureRef.current("release");
            return;
        }
        event.preventDefault();

        const coalesced = typeof event.getCoalescedEvents === "function"
            ? event.getCoalescedEvents()
            : [];
        const samples = coalesced.length > 0 ? coalesced : [event];

        for (const sample of samples) {
            const result = applyRollingAxisSample(gesture.classifier, {
                x: sample.clientX,
                y: sample.clientY,
                time: Number(sample.timeStamp) || performance.now(),
                pointerType: gesture.pointerType,
            });
            gesture.classifier = result.state;

            if (result.transition === "activate" || result.transition === "switch") {
                if (gesture.longPressTimer !== null) {
                    window.clearTimeout(gesture.longPressTimer);
                    gesture.longPressTimer = null;
                }
                const axis = result.state.mode as RollingAxis;
                if (gesture.surface === "graph") {
                    const binding = axis === "horizontal"
                        ? PROVISIONAL_WAVETABLE_GRAPH_AXES.horizontal
                        : PROVISIONAL_WAVETABLE_GRAPH_AXES.vertical;
                    const controlID = binding.controlID as MobileVoiceBindableControlID;
                    gesture.owner = { kind: "graph", axis };
                    beginHostGesture(gesture, controlID);
                    setGraphAxis(axis);
                    continue;
                }
                const controlID = gesture.controlID;
                if (controlID === null) {
                    continue;
                }
                if (axis === "horizontal") {
                    gesture.owner = { kind: "cell-base", controlID };
                    beginHostGesture(gesture, controlID);
                    setDraggingCell({ controlID, mode: "base" });
                    clearHudLinger();
                    setHudState({ phase: "active", axis: "base", controlID });
                } else {
                    gesture.owner = { kind: "cell-modulation", controlID };
                    endHostGesture(gesture);
                    // Without an editable selected route the vertical axis is
                    // inert, so the HUD keeps the base presentation instead
                    // of advertising a modulation edit that cannot happen.
                    const editable = gesture.amountBounds !== null;
                    setDraggingCell({ controlID, mode: editable ? "modulation" : "base" });
                    clearHudLinger();
                    setHudState({
                        phase: "active",
                        axis: editable ? "modulation" : "base",
                        controlID,
                    });
                }
                continue;
            }

            const application = result.application;
            if (application === null || gesture.owner === null) {
                continue;
            }

            if (gesture.owner.kind === "graph") {
                const write = projectGraphAxisWrite(
                    PROVISIONAL_WAVETABLE_GRAPH_AXES,
                    application.axis,
                    application.axis === "horizontal"
                        ? gesture.graphHorizontalNormalized
                        : gesture.graphVerticalNormalized,
                    application.dx,
                    application.dy,
                );
                if (application.axis === "horizontal") {
                    gesture.graphHorizontalNormalized = write.nextNormalized;
                } else {
                    gesture.graphVerticalNormalized = write.nextNormalized;
                }
                gesture.pendingCommit = true;
                continue;
            }

            if (gesture.owner.kind === "cell-base") {
                gesture.baseNormalized = clamp01(
                    gesture.baseNormalized + (application.dx / BASE_PIXELS_PER_FULL_RANGE),
                );
                gesture.pendingCommit = true;
                continue;
            }

            const bounds = gesture.amountBounds;
            if (bounds === null) {
                // No armed source, unmapped pair, or non-modulatable target:
                // vertical motion is inert (the HUD explains why).
                continue;
            }
            const span = bounds.max - bounds.min;
            gesture.amount = clamp(
                gesture.amount + ((application.dy / MODULATION_PIXELS_PER_FULL_SPAN) * span),
                bounds.min,
                bounds.max,
            );
            gesture.pendingCommit = true;
        }

        if (gesture.pendingCommit) {
            scheduleGestureCommit();
        }
    }, [beginHostGesture, clearHudLinger, endHostGesture, scheduleGestureCommit]);

    const startGesture = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        surface: "cell" | "graph",
        controlID: MobileVoiceBindableControlID | null,
    ) => {
        if (gestureRef.current !== null) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const element = event.currentTarget;
        try {
            element.setPointerCapture(event.pointerId);
        } catch {
            // Window fallbacks continue the gesture when capture is rejected.
        }

        const pointerType = pointerTypeOf(event);
        const display = controlID !== null ? DISPLAY_DESCRIPTORS[controlID] : null;
        const spec = controlID !== null ? getMobileVoiceControlSpec(controlID) : null;
        const route = spec !== null ? routeFor(spec.modulationParameterKind) : null;
        const modulationTargetKind = spec?.modulationParameterKind ?? null;
        const amountBounds = route !== null && modulationTargetKind !== null
            ? getModulationAmountBounds(targetKindFor(modulationTargetKind))
            : null;
        setActiveRoute(route);

        const baseValue = controlID !== null && display !== null
            ? clamp(bindingsRef.current[controlID].value, display.min, display.max)
            : 0;
        // Graph axes integrate from the BASE bindings, never the observed
        // (modulation-inclusive) drawing values: the gesture edits base.
        const graphHorizontal = clamp01(bindingsRef.current.warpAmount.value);
        const graphVertical = clamp01(bindingsRef.current.framePosition.value);

        const scrollLocks = (resolveScrollLockTargets?.() ?? []).map((lockElement) => ({
            element: lockElement,
            top: lockElement.scrollTop,
            left: lockElement.scrollLeft,
        }));

        const handleMove = (moveEvent: PointerEvent) => applyGestureSample(moveEvent);
        const handleUp = (upEvent: PointerEvent) => {
            if (gestureRef.current !== null && upEvent.pointerId === gestureRef.current.pointerId) {
                finishGestureRef.current("release");
            }
        };
        const handleCancel = (cancelEvent: PointerEvent) => {
            if (gestureRef.current !== null && cancelEvent.pointerId === gestureRef.current.pointerId) {
                finishGestureRef.current("cancel");
            }
        };
        const handleBlur = () => finishGestureRef.current("cancel");
        const handleVisibility = () => {
            if (document.visibilityState !== "visible") {
                finishGestureRef.current("cancel");
            }
        };
        const handleViewportInvalidation = () => finishGestureRef.current("cancel");
        const handleNativeTouchMove = (touchEvent: TouchEvent) => {
            // Non-passive Safari fallback: an owned readout gesture must
            // never be promoted into page scroll midway through the drag.
            if (gestureRef.current === null) {
                return;
            }
            if (touchEvent.cancelable) {
                touchEvent.preventDefault();
            }
            restoreScrollLocks(gestureRef.current);
        };
        const handleNativeTouchEnd = (touchEvent: TouchEvent) => {
            if (gestureRef.current !== null && touchEvent.touches.length === 0) {
                finishGestureRef.current("release");
            }
        };
        const handleNativeTouchCancel = (touchEvent: TouchEvent) => {
            if (gestureRef.current !== null && touchEvent.touches.length === 0) {
                finishGestureRef.current("cancel");
            }
        };

        window.addEventListener("pointermove", handleMove, { passive: false });
        window.addEventListener("pointerup", handleUp, true);
        window.addEventListener("pointercancel", handleCancel, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("orientationchange", handleViewportInvalidation);
        window.addEventListener("resize", handleViewportInvalidation);
        document.addEventListener("touchmove", handleNativeTouchMove, { capture: true, passive: false });
        document.addEventListener("touchend", handleNativeTouchEnd, true);
        document.addEventListener("touchcancel", handleNativeTouchCancel, true);

        const removeListeners = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp, true);
            window.removeEventListener("pointercancel", handleCancel, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("orientationchange", handleViewportInvalidation);
            window.removeEventListener("resize", handleViewportInvalidation);
            document.removeEventListener("touchmove", handleNativeTouchMove, true);
            document.removeEventListener("touchend", handleNativeTouchEnd, true);
            document.removeEventListener("touchcancel", handleNativeTouchCancel, true);
        };

        const longPressTimer = surface === "cell" && controlID !== null && onRequestParameterMenu
            ? window.setTimeout(() => {
                const gesture = gestureRef.current;
                if (gesture === null || gesture.owner !== null) {
                    return;
                }
                const { clientX, clientY } = event;
                finishGestureRef.current("cancel");
                onRequestParameterMenu(controlID, clientX, clientY);
            }, LONG_PRESS_MS)
            : null;

        gestureRef.current = {
            surface,
            controlID,
            pointerId: event.pointerId,
            pointerType,
            element,
            classifier: createRollingAxisState(event.clientX, event.clientY),
            owner: null,
            hostGestureControlID: null,
            baseNormalized: display !== null
                ? clamp01((baseValue - display.min) / (display.max - display.min))
                : 0,
            graphHorizontalNormalized: graphHorizontal,
            graphVerticalNormalized: graphVertical,
            amount: route?.amount ?? 0,
            amountBounds,
            lastDetentValue: null,
            lastModulationDetent: route !== null
                && Math.abs(route.amount - Math.round(route.amount)) <= MOD_DETENT_CAPTURE_ST
                ? Math.round(route.amount)
                : null,
            pendingCommit: false,
            rafHandle: null,
            longPressTimer,
            scrollLocks,
            windowScroll: { x: window.scrollX, y: window.scrollY },
            removeListeners,
        };

        if (surface === "cell" && controlID !== null) {
            setDraggingCell({ controlID, mode: "pending" });
        }
    }, [applyGestureSample, onRequestParameterMenu, resolveScrollLockTargets, restoreScrollLocks, routeFor, targetKindFor]);

    /* -------------------------------------------------------------- */
    /* Cell + page models                                               */
    /* -------------------------------------------------------------- */

    const cellPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>, controlID: MobileVoiceBindableControlID) => {
        startGesture(event, "cell", controlID);
    }, [startGesture]);

    const graphPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        startGesture(event, "graph", null);
    }, [startGesture]);

    const stopOverlayPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        // Overlay controls must not initiate either graph axis.
        event.stopPropagation();
    }, []);

    const cycleChoice = useCallback((controlID: MobileVoiceBindableControlID) => {
        const display = DISPLAY_DESCRIPTORS[controlID];
        const binding = bindingsRef.current[controlID];
        const count = (display.choices?.length ?? 0) || (display.max - display.min + 1);
        const next = display.min + (((Math.round(binding.value) - display.min) + 1) % count);
        binding.commitValue(next);
    }, []);

    const adjustBaseByStep = useCallback((controlID: MobileVoiceBindableControlID, direction: 1 | -1, coarse: boolean) => {
        const display = DISPLAY_DESCRIPTORS[controlID];
        const binding = bindingsRef.current[controlID];
        const step = display.step * (coarse ? 10 : 1);
        binding.commitValue(clamp(binding.value + (direction * step), display.min, display.max));
    }, []);

    const setPage = useCallback((direction: 1 | -1) => {
        setPageByOscillator((current) => ({
            ...current,
            [oscillatorID]: (current[oscillatorID] + direction + MOBILE_VOICE_PAGES.length)
                % MOBILE_VOICE_PAGES.length,
        }));
    }, [oscillatorID]);

    type CellPresentation = {
        readonly controlID: MobileVoiceBindableControlID;
        readonly railState: MobileVoiceRailState;
        readonly band: MobileVoiceRailBand | null;
        readonly route: ModulationRoute | null;
        readonly baseNormalized: number;
    };

    const presentCell = useCallback((controlID: MobileVoiceBindableControlID): CellPresentation => {
        const spec = getMobileVoiceControlSpec(controlID);
        const display = DISPLAY_DESCRIPTORS[controlID];
        const binding = bindings[controlID];
        const value = clamp(binding.value, display.min, display.max);
        const baseNormalized = (value - display.min) / (display.max - display.min);
        const topologyRoute = routeFor(spec.modulationParameterKind);
        // ADR-023: the actively edited route presents its canonical amount.
        const liveAmount = topologyRoute !== null
            && activeRoute !== null
            && topologyRoute.id === activeRoute.id
            && activeAmountBinding.value !== null
            ? activeAmountBinding.value
            : topologyRoute?.amount ?? 0;
        const route = topologyRoute === null ? null : { ...topologyRoute, amount: liveAmount };
        const railState = resolveMobileVoiceRailState({
            modulatable: spec.modulationParameterKind !== null,
            armed: armedSource !== null,
            route,
        });
        let band: MobileVoiceRailBand | null = null;
        if (route !== null && (railState === "mapped" || railState === "mapped-zero" || railState === "bypassed")) {
            band = isTuneComponent(controlID)
                ? projectTuneComponentBand(controlID, baseNormalized, route)
                : projectMobileVoiceRailBand({ min: display.min, max: display.max }, value, route);
        }
        return { controlID, railState, band, route, baseNormalized };
    }, [activeAmountBinding.value, activeRoute, armedSource, bindings, routeFor]);

    /* -------------------------------------------------------------- */
    /* HUD presentation                                                 */
    /* -------------------------------------------------------------- */

    const hud = useMemo(() => {
        if (hudState.controlID === null || hudContainer === null) {
            return null;
        }
        const controlID = hudState.controlID;
        const spec = getMobileVoiceControlSpec(controlID);
        const display = DISPLAY_DESCRIPTORS[controlID];
        const presentation = presentCell(controlID);
        const isModulation = hudState.axis === "modulation";
        const isTune = spec.modulationParameterKind === "pitchSemitones";
        const format = spec.format ?? "percent";
        // Zero-anchored fill reads correctly only when zero is the center of
        // a symmetric range (Pan, Octave, Semitone, Fine). Asymmetric signed
        // ranges like Level fill from their minimum like any amount control.
        const symmetricBipolar = display.min < 0 && display.max > 0
            && Math.abs(display.min) === display.max;
        const baseOrigin = symmetricBipolar
            ? (0 - display.min) / (display.max - display.min)
            : 0;

        // The source slot carries only a real source and amount. Unmapped,
        // unarmed, and non-modulatable states show nothing here: their
        // vertical axis is inert and the HUD stays in base presentation.
        let sourceLine = "";
        if (presentation.route !== null && armedSource !== null && spec.modulationParameterKind !== null) {
            const label = `${armedSourceIdentity?.shortLabel ?? ""} ${armedSource.sourceSlot}`.trim();
            // The canonical per-kind readout carries the amount's real units
            // (st, dB, %, s) — a flat percentage misreads dB offsets.
            const amountText = formatModulationAmountReadout(
                targetKindFor(spec.modulationParameterKind),
                presentation.route.amount,
                presentation.route.polarity,
            );
            sourceLine = `${label} · ${amountText}`;
        }

        let lowText: string;
        let highText: string;
        if (isTune) {
            const tuneBase = aggregateTuneBaseSemitones(
                bindings.octave.value,
                bindings.semitone.value,
                bindings.fineCents.value,
            );
            const travel = presentation.route !== null
                ? projectAggregateTuneTravel(tuneBase, presentation.route)
                : { lowSemitones: tuneBase, highSemitones: tuneBase };
            lowText = `${travel.lowSemitones >= 0 ? "+" : ""}${travel.lowSemitones.toFixed(1)} st`;
            highText = `${travel.highSemitones >= 0 ? "+" : ""}${travel.highSemitones.toFixed(1)} st`;
        } else {
            const band = presentation.band;
            const lowValue = display.min
                + ((band?.lowNormalized ?? presentation.baseNormalized) * (display.max - display.min));
            const highValue = display.min
                + ((band?.highNormalized ?? presentation.baseNormalized) * (display.max - display.min));
            lowText = formatMobileVoiceValue(format, lowValue);
            highText = formatMobileVoiceValue(format, highValue);
        }

        const limitsVisible = presentation.route !== null
            && Math.abs(presentation.route.amount) > 1e-9;
        const modRing: ParameterKnobModRing = spec.modulationParameterKind === null || armedSource === null
            ? { kind: "hidden" }
            : presentation.route === null
                ? { kind: "unmapped" }
                : {
                    kind: "mapped",
                    lowNormalized: presentation.band?.lowNormalized ?? presentation.baseNormalized,
                    highNormalized: presentation.band?.highNormalized ?? presentation.baseNormalized,
                    bypassed: presentation.railState === "bypassed",
                };

        return createPortal(
            <div
                data-role="mobile-voice-hud"
                data-hud-axis={hudState.axis}
                className={`mobile-voice-hud${hudState.phase !== "hidden" ? " is-visible" : ""}${isModulation ? " is-modulation" : ""}`}
                style={{ "--mobile-voice-source-accent": sourceAccent } as React.CSSProperties}
                aria-hidden="true"
            >
                <header className="mobile-voice-hud-header">
                    <span
                        className="mobile-voice-hud-micro"
                        style={{ color: isModulation ? sourceAccent : MOBILE_VOICE_OWNER_ACCENT }}
                    >
                        {isModulation ? "MOD ↕" : "BASE ↔"}
                    </span>
                    <strong className="mobile-voice-hud-label">
                        {isModulation && isTune ? "Tune" : spec.fullLabel}
                    </strong>
                    <span
                        className="mobile-voice-hud-micro mobile-voice-hud-source"
                        style={{ color: isModulation ? sourceAccent : "rgba(232, 236, 239, 0.6)" }}
                    >
                        {sourceLine}
                    </span>
                </header>
                <div className="mobile-voice-hud-knob">
                    <ParameterKnobArtwork
                        baseNormalized={presentation.baseNormalized}
                        baseOriginNormalized={baseOrigin}
                        ownerAccent={MOBILE_VOICE_OWNER_ACCENT}
                        sourceAccent={sourceAccent}
                        modRing={modRing}
                        emphasis={hudState.axis === "base" ? "base" : "modulation"}
                    />
                    <div className="mobile-voice-hud-center">
                        <span>Base</span>
                        <strong data-role="mobile-voice-hud-base">
                            {formatMobileVoiceValue(format, clamp(bindings[controlID].value, display.min, display.max))}
                        </strong>
                    </div>
                    <div
                        className="mobile-voice-hud-limit is-low"
                        style={{ visibility: limitsVisible ? "visible" : "hidden" }}
                    >
                        <span>Low</span>
                        <strong data-role="mobile-voice-hud-low">{lowText}</strong>
                    </div>
                    <div
                        className="mobile-voice-hud-limit is-high"
                        style={{ visibility: limitsVisible ? "visible" : "hidden" }}
                    >
                        <span>High</span>
                        <strong data-role="mobile-voice-hud-high">{highText}</strong>
                    </div>
                </div>
                <footer className="mobile-voice-hud-footer">
                    <span
                        className="mobile-voice-hud-micro"
                        style={{ color: !isModulation ? MOBILE_VOICE_OWNER_ACCENT : "rgba(232, 236, 239, 0.35)" }}
                    >
                        ↔ Base
                    </span>
                    <span
                        className="mobile-voice-hud-micro"
                        style={{ color: isModulation ? sourceAccent : "rgba(232, 236, 239, 0.35)" }}
                    >
                        ↕ Mod amount
                    </span>
                </footer>
            </div>,
            hudContainer,
        );
    }, [armedSource, armedSourceIdentity, bindings, hudContainer, hudState, presentCell, sourceAccent, targetKindFor]);

    /* -------------------------------------------------------------- */
    /* Render                                                           */
    /* -------------------------------------------------------------- */

    const isMuted = bindings.mute.value >= 0.5;

    const renderRail = (presentation: CellPresentation) => {
        const { railState, band } = presentation;
        const tickLeft = `${(presentation.baseNormalized * 100).toFixed(2)}%`;
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
                <span className="mobile-voice-rail-tick" style={{ left: tickLeft }} />
            </span>
        );
    };

    const renderReadoutCell = (
        controlID: MobileVoiceBindableControlID,
        options?: { readonly chip?: boolean },
    ) => {
        const spec = getMobileVoiceControlSpec(controlID);
        const display = DISPLAY_DESCRIPTORS[controlID];
        const presentation = presentCell(controlID);
        const value = clamp(bindings[controlID].value, display.min, display.max);
        const format = spec.format ?? "percent";
        const dragging = draggingCell !== null && draggingCell.controlID === controlID
            ? draggingCell.mode
            : undefined;
        const modulationTargetKind = spec.modulationParameterKind !== null
            ? targetKindFor(spec.modulationParameterKind)
            : undefined;

        if (options?.chip === true) {
            return (
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label={spec.fullLabel}
                    aria-valuemin={display.min}
                    aria-valuemax={display.max}
                    aria-valuenow={value}
                    aria-valuetext={formatMobileVoiceValue(format, value)}
                    data-role={`mobile-voice-chip-${controlID}`}
                    data-modulation-target-kind={modulationTargetKind}
                    className="mobile-voice-chip is-readout"
                    style={spec.placements.includes("graph-overlay-bottom-left")
                        ? { bottom: 8, left: 8 }
                        : { bottom: 8, right: 8 }}
                    onPointerDown={(event) => cellPointerDown(event, controlID)}
                    onKeyDown={(event) => handleReadoutKeyDown(event, controlID)}
                >
                    <span className="mobile-voice-chip-label">{spec.shortLabel}</span>
                    <strong className="mobile-voice-chip-value">
                        {formatMobileVoiceCellValue(format, value)}
                    </strong>
                    {presentation.railState === "mapped"
                        || presentation.railState === "mapped-zero"
                        || presentation.railState === "bypassed" ? (
                        <span
                            data-role={`mobile-voice-chip-route-dot-${controlID}`}
                            className="mobile-voice-chip-dot"
                            style={presentation.railState === "bypassed"
                                ? { border: `1px solid ${sourceAccent}`, background: "transparent", boxShadow: "none", opacity: 0.6 }
                                : { background: sourceAccent, boxShadow: `0 0 4px ${sourceAccent}` }}
                            aria-hidden="true"
                        />
                    ) : null}
                </div>
            );
        }

        return (
            <div
                key={controlID}
                role="slider"
                tabIndex={0}
                aria-label={spec.fullLabel}
                aria-valuemin={display.min}
                aria-valuemax={display.max}
                aria-valuenow={value}
                aria-valuetext={formatMobileVoiceValue(format, value)}
                data-role={`mobile-voice-cell-${controlID}`}
                data-modulation-target-kind={modulationTargetKind}
                data-dragging={dragging}
                className="mobile-voice-cell is-readout"
                style={{ "--mobile-voice-source-accent": sourceAccent } as React.CSSProperties}
                onPointerDown={(event) => cellPointerDown(event, controlID)}
                onKeyDown={(event) => handleReadoutKeyDown(event, controlID)}
            >
                <span className="mobile-voice-cell-label">{spec.shortLabel}</span>
                <strong className="mobile-voice-cell-value">
                    {formatMobileVoiceCellValue(format, value)}
                </strong>
                {renderRail(presentation)}
            </div>
        );
    };

    const handleReadoutKeyDown = (
        event: ReactKeyboardEvent<HTMLElement>,
        controlID: MobileVoiceBindableControlID,
    ) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight"
            && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
        adjustBaseByStep(controlID, direction, event.shiftKey);
    };

    const renderChoiceCell = (controlID: MobileVoiceBindableControlID) => {
        const spec = getMobileVoiceControlSpec(controlID);
        const display = DISPLAY_DESCRIPTORS[controlID];
        const choices = display.choices ?? [];
        const index = clamp(Math.round(bindings[controlID].value), display.min, display.max);
        const label = choices[index - display.min] ?? String(index);
        return (
            <button
                key={controlID}
                type="button"
                data-role={`mobile-voice-cell-${controlID}`}
                className="mobile-voice-cell is-choice"
                aria-label={`${spec.fullLabel}: ${label}`}
                onClick={() => cycleChoice(controlID)}
            >
                <span className="mobile-voice-cell-label">{spec.shortLabel}</span>
                <strong className="mobile-voice-cell-value">{label}</strong>
            </button>
        );
    };

    const warpModeIndex = clamp(Math.round(bindings.warpMode.value), 0, WARP_MODE_LABELS.length - 1);
    // The transient top-left readout tracks the BASE value being edited.
    const graphValueText = graphAxis === "horizontal"
        ? formatMobileVoiceValue("percent", clamp01(bindings.warpAmount.value))
        : formatMobileVoiceValue("percent", clamp01(bindings.framePosition.value));

    return (
        <div
            data-role="mobile-voice-editor"
            data-selected-oscillator-id={oscillatorID}
            className="mobile-voice-editor"
        >
            <nav
                role="tablist"
                aria-label="Oscillator editor"
                data-role="mobile-voice-tabs"
                className="mobile-voice-tabs"
            >
                {selection.options.map((oscillator) => {
                    const isActive = oscillator.id === oscillatorID;
                    const toggles = toggleBindings[oscillator.id];
                    const oscillatorMuted = toggles.mute.value >= 0.5;
                    const oscillatorSoloed = toggles.solo.value >= 0.5;
                    return (
                        <div
                            key={oscillator.id}
                            role="tab"
                            tabIndex={isActive ? 0 : -1}
                            aria-selected={isActive}
                            aria-label={isActive
                                ? `Turn oscillator ${oscillator.id} ${oscillatorMuted ? "on" : "off"}`
                                : `Select oscillator ${oscillator.id}`}
                            data-role={`mobile-voice-tab-${oscillator.id.toLowerCase()}`}
                            data-oscillator-id={oscillator.id}
                            className={`mobile-voice-tab${isActive ? " is-active" : ""}${oscillatorMuted ? " is-muted" : ""}`}
                            onClick={() => {
                                if (isActive) {
                                    toggles.mute.commitValue(oscillatorMuted ? 0 : 1);
                                } else {
                                    selection.selectOscillator(oscillator.id);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    if (isActive) {
                                        toggles.mute.commitValue(oscillatorMuted ? 0 : 1);
                                    } else {
                                        selection.selectOscillator(oscillator.id);
                                    }
                                    return;
                                }
                                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                                    event.preventDefault();
                                    const ids = selection.options.map((option) => option.id);
                                    const currentIndex = ids.indexOf(oscillator.id);
                                    const nextIndex = event.key === "ArrowLeft"
                                        ? (currentIndex + ids.length - 1) % ids.length
                                        : (currentIndex + 1) % ids.length;
                                    selection.selectOscillator(ids[nextIndex]);
                                }
                            }}
                        >
                            <span>{oscillator.id}</span>
                            <button
                                type="button"
                                aria-label={`Solo oscillator ${oscillator.id}`}
                                aria-pressed={oscillatorSoloed}
                                data-role={`mobile-voice-solo-${oscillator.id.toLowerCase()}`}
                                className={`mobile-voice-tab-solo${oscillatorSoloed ? " is-active" : ""}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggles.solo.commitValue(oscillatorSoloed ? 0 : 1);
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                            >
                                S
                            </button>
                        </div>
                    );
                })}
            </nav>

            {children}

            <div className="mobile-voice-unit">
                <div
                    data-role="mobile-voice-graph"
                    className={`mobile-voice-graph${isMuted ? " is-muted" : ""}`}
                    data-modulation-target-kind={targetKindFor("wavetablePosition")}
                    onPointerDown={graphPointerDown}
                >
                    <WavetableCanvas
                        frames={stage.frames}
                        position={stage.position}
                        warpMode={stage.warpMode}
                        warpAmount={stage.warpAmount}
                        paintBackground={false}
                        showSliceCaption={false}
                    />

                    <div
                        data-role="mobile-voice-wavetable-overlay"
                        className="mobile-voice-chip"
                        style={{ top: 8, left: 8, minWidth: 118 }}
                        onPointerDown={stopOverlayPointer}
                    >
                        <span
                            className={`mobile-voice-chip-layer${graphAxis !== null ? " is-hidden" : ""}`}
                            data-role="mobile-voice-wavetable-idle"
                        >
                            <span className="mobile-voice-chip-label">WT</span>
                            <strong className="mobile-voice-chip-value" data-role="mobile-voice-table-name">
                                {stage.pendingTableName === null ? stage.tableName : `Loading ${stage.pendingTableName}…`}
                            </strong>
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden="true">
                                <path
                                    d="M1 1.5 L4 4.5 L7 1.5"
                                    stroke={MOBILE_VOICE_OWNER_ACCENT}
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.7"
                                />
                            </svg>
                            <select
                                className="mobile-voice-table-select"
                                value={String(stage.desiredTableIndex)}
                                aria-label="Select wavetable"
                                onChange={(event) => stage.onTableChange(Number(event.target.value))}
                                onFocus={stage.onTablePrewarm}
                                onPointerEnter={stage.onTablePrewarm}
                            >
                                {stage.tableOptions.map((table, tableIndex) => (
                                    <option key={`${table.name}-${tableIndex}`} value={tableIndex}>
                                        {table.name}
                                    </option>
                                ))}
                            </select>
                        </span>
                        <span
                            className={`mobile-voice-chip-layer is-overlaid${graphAxis === null ? " is-hidden" : ""}`}
                            data-role="mobile-voice-graph-readout"
                        >
                            <span className="mobile-voice-chip-label">
                                {graphAxis === "horizontal" ? "Warp" : "Index"}
                            </span>
                            <strong className="mobile-voice-chip-value">{graphValueText}</strong>
                        </span>
                    </div>

                    {stage.canRetry ? (
                        <button
                            type="button"
                            data-role="mobile-voice-retry-load"
                            className="mobile-voice-chip"
                            style={{ top: 42, left: 8 }}
                            onPointerDown={stopOverlayPointer}
                            onClick={stage.onRetry}
                        >
                            <strong className="mobile-voice-chip-value">Retry Load</strong>
                        </button>
                    ) : null}

                    <button
                        type="button"
                        data-role="mobile-voice-warp-mode"
                        className="mobile-voice-chip"
                        style={{ top: 8, right: 8 }}
                        aria-label={`Warp mode: ${WARP_MODE_LABELS[warpModeIndex]}. Cycle warp mode`}
                        onPointerDown={stopOverlayPointer}
                        onClick={() => cycleChoice("warpMode")}
                    >
                        <span className="mobile-voice-chip-label">Warp</span>
                        <strong className="mobile-voice-chip-value">{WARP_MODE_LABELS[warpModeIndex]}</strong>
                    </button>

                    {renderReadoutCell("unisonVoices", { chip: true })}
                    {renderReadoutCell("semitone", { chip: true })}
                </div>

                <div
                    data-role="mobile-voice-toolbar"
                    className={`mobile-voice-toolbar${isMuted ? " is-muted" : ""}`}
                >
                    <button
                        type="button"
                        className="mobile-voice-paddle is-previous"
                        data-role="mobile-voice-page-previous"
                        aria-label="Previous control page"
                        onClick={() => setPage(-1)}
                    >
                        <svg width="7" height="10" viewBox="0 0 7 10" fill="none" aria-hidden="true">
                            <path d="M5.5 1 L1.5 5 L5.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="mobile-voice-paddle-caption">{page.name}</span>
                    </button>
                    <div
                        data-role="mobile-voice-page"
                        data-page-name={page.name}
                        className="mobile-voice-page"
                        style={{ gridTemplateColumns: `repeat(${page.cells.length}, minmax(0, 1fr))` }}
                    >
                        {page.cells.map((controlID) => {
                            const spec = getMobileVoiceControlSpec(controlID);
                            return spec.interaction === "choice"
                                ? renderChoiceCell(controlID as MobileVoiceBindableControlID)
                                : renderReadoutCell(controlID as MobileVoiceBindableControlID);
                        })}
                    </div>
                    <button
                        type="button"
                        className="mobile-voice-paddle is-next"
                        data-role="mobile-voice-page-next"
                        aria-label="Next control page"
                        onClick={() => setPage(1)}
                    >
                        <span className="mobile-voice-paddle-caption">
                            {pageIndex + 1}/{MOBILE_VOICE_PAGES.length}
                        </span>
                        <svg width="7" height="10" viewBox="0 0 7 10" fill="none" aria-hidden="true">
                            <path d="M1.5 1 L5.5 5 L1.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>

            {hud}
        </div>
    );
}

export type { MobileVoicePageName };
