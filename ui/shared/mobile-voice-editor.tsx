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

import {
    getOscillatorControlAddress,
    type OscillatorControlID,
    type OscillatorID,
    type OscillatorSelectionViewModel,
} from "./oscillator-binding";
import type { OscillatorModulationParameterKind } from "./modulation-targets";
import { parameterEntrySpecForMobileVoiceControl } from "./parameter-value-entry";
import type { ParameterMenuRequest } from "./parameter-context-menu";
import {
    type ModulationRoute,
} from "./modulation";
import { findRackModulationSource, type RackModulationSourceKind } from "./rack-modulation-sources";
import { usePatchParameterBinding, type PatchControlBinding } from "./patch-controls";
import {
    MOBILE_VOICE_PAGES,
    getMobileVoiceControlSpec,
    type MobileVoiceFormatKind,
    type MobileVoicePageName,
} from "./mobile-voice-parameter-manifest";
import {
    MOBILE_VOICE_DISPLAY_DESCRIPTORS as DISPLAY_DESCRIPTORS,
    WARP_MODE_LABELS,
    type MobileVoiceBindableControlID,
} from "./mobile-voice-display-descriptors";
import type { RollingAxis } from "./rolling-axis-classifier";
import {
    useParameterGesture,
    type ParameterGestureChannel,
} from "./parameter-gesture";
import {
    ReadoutCell,
    useReadoutCells,
    type ReadoutCellSpec,
} from "./parameter-readout-strip";
import { hexToRGBColor } from "./theme";
import { PROVISIONAL_WAVETABLE_GRAPH_AXES } from "./wavetable-graph-axis-projection";
import {
    aggregateTuneBaseSemitones,
    projectAggregateTuneTravel,
    projectTuneComponentBand,
    TUNE_COMPONENT_SEMITONE_SPANS,
    wavetableModulationShadingRange,
    type AggregateTuneComponentID,
} from "./mobile-voice-rail-projection";
import { WavetableCanvas, type FactoryTableOption } from "./synth-components";

/* ------------------------------------------------------------------ */
/* Calibration (ADR-024: tunable with device evidence only)            */
/* ------------------------------------------------------------------ */


export const MOBILE_VOICE_OWNER_ACCENT = "#69d5c5";
export const MOBILE_VOICE_OWNER_ACCENT_RGB = "105 213 197";

/* ------------------------------------------------------------------ */
/* Display descriptors                                                  */
/* ------------------------------------------------------------------ */

/**
 * Display range/step per control. These mirror the canonical coercion in
 * `synth-hooks` exactly (the live bindings clamp with the same numbers);
 * the toolbar never invents a second range for writes — every write passes
 * back through the binding's own coercion.
 */
function isBindableControlID(candidate: string): candidate is MobileVoiceBindableControlID {
    return Object.hasOwn(DISPLAY_DESCRIPTORS, candidate);
}

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
    /** The accepted long-press parameter menu (ADR-017), supplied by the
        shell. The editor resolves the pressed cell to its oscillator-aware
        modulation target and full editing context, so the shell never
        re-derives contract internals. */
    readonly onRequestParameterMenu?: (request: ParameterMenuRequest) => void;
    /** Rendered between the tabs and the graph (e.g. nothing today). */
    readonly children?: ReactNode;
};

/* ------------------------------------------------------------------ */
/* Gesture controller (shared: ui/shared/parameter-gesture.ts)          */
/* ------------------------------------------------------------------ */


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

    const [graphAxis, setGraphAxis] = useState<RollingAxis | null>(null);

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

    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;

    const gestureController = useParameterGesture();
    /** Graph-axis host-gesture bracket (cells bracket inside the shared hook). */
    const graphHostGestureControlIDRef = useRef<MobileVoiceBindableControlID | null>(null);

    const endGraphHostGesture = useCallback(() => {
        const controlID = graphHostGestureControlIDRef.current;
        if (controlID !== null) {
            bindingsRef.current[controlID].endGesture();
            graphHostGestureControlIDRef.current = null;
        }
    }, []);

    const beginGraphHostGesture = useCallback((controlID: MobileVoiceBindableControlID) => {
        endGraphHostGesture();
        bindingsRef.current[controlID].beginGesture();
        graphHostGestureControlIDRef.current = controlID;
    }, [endGraphHostGesture]);

    /** ADR-024 cell specs derived from the one Voice parameter manifest. */
    const cellSpecs = useMemo<ReadonlyArray<ReadoutCellSpec>>(() => (
        (Object.keys(DISPLAY_DESCRIPTORS) as ReadonlyArray<MobileVoiceBindableControlID>).map((controlID) => {
            const spec = getMobileVoiceControlSpec(controlID);
            const display = DISPLAY_DESCRIPTORS[controlID];
            const format = spec.format ?? "percent";
            const tuneComponent = isTuneComponent(controlID);
            return {
                id: controlID,
                kind: spec.interaction === "choice" ? "choice" as const : "readout" as const,
                shortLabel: spec.shortLabel,
                fullLabel: spec.fullLabel,
                display,
                formatValue: (value: number) => formatMobileVoiceValue(format, value),
                formatCellValue: (value: number) => formatMobileVoiceCellValue(format, value),
                targetKind: spec.modulationParameterKind !== null
                    ? targetKindFor(spec.modulationParameterKind)
                    : null,
                detented: spec.detented,
                stickyIntegerAmounts: spec.modulationParameterKind === "pitchSemitones",
                projectBand: tuneComponent
                    ? (baseNormalized, route) => projectTuneComponentBand(controlID, baseNormalized, route)
                    : undefined,
                railAmountSpan: tuneComponent
                    ? TUNE_COMPONENT_SEMITONE_SPANS[controlID]
                    : undefined,
                presentHudTravel: tuneComponent
                    ? (route) => {
                        const tuneBase = aggregateTuneBaseSemitones(
                            bindingsRef.current.octave.value,
                            bindingsRef.current.semitone.value,
                            bindingsRef.current.fineCents.value,
                        );
                        const travel = route !== null
                            ? projectAggregateTuneTravel(tuneBase, route)
                            : { lowSemitones: tuneBase, highSemitones: tuneBase };
                        return {
                            label: "Tune",
                            lowText: `${travel.lowSemitones >= 0 ? "+" : ""}${travel.lowSemitones.toFixed(1)} st`,
                            highText: `${travel.highSemitones >= 0 ? "+" : ""}${travel.highSemitones.toFixed(1)} st`,
                        };
                    }
                    : undefined,
            };
        })
    ), [targetKindFor]);

    const cellApi = useReadoutCells({
        cells: cellSpecs,
        bindings,
        routes,
        armedSource: armedSourceIdentity !== null && armedSource !== null
            ? {
                sourceKind: armedSource.sourceKind,
                sourceSlot: armedSource.sourceSlot,
                shortLabel: armedSourceIdentity.shortLabel,
                accent: armedSourceIdentity.accent,
            }
            : null,
        hudContainer,
        gestureController,
        ownerAccent: MOBILE_VOICE_OWNER_ACCENT,
        ownerAccentRgb: MOBILE_VOICE_OWNER_ACCENT_RGB,
        resolveScrollLockTargets,
        onRequestHaptic,
        onRequestParameterMenu: onRequestParameterMenu === undefined
            ? undefined
            : (cellId, clientX, clientY) => {
                if (!isBindableControlID(cellId)) {
                    throw new Error(`Unknown Voice cell ${cellId}`);
                }
                const spec = cellSpecs.find((candidate) => candidate.id === cellId);
                if (spec === undefined) {
                    throw new Error(`Voice cell ${cellId} has no cell spec.`);
                }
                const binding = bindingsRef.current[cellId];
                onRequestParameterMenu({
                    controlKey: cellId,
                    label: spec.fullLabel,
                    targetKind: spec.targetKind,
                    baseSpec: parameterEntrySpecForMobileVoiceControl(cellId),
                    baseValue: binding.value,
                    defaultValue: binding.initialValue ?? null,
                    commitBase: (value) => bindingsRef.current[cellId].commitValue(value),
                    clientX,
                    clientY,
                });
            },
    });

    /** Cancel on oscillator/page rebinds, unmount, and session teardown. */
    useEffect(() => () => {
        gestureController.cancelGesture();
    }, [gestureController]);
    useEffect(() => {
        gestureController.cancelGesture();
    }, [gestureController, oscillatorID]);
    useEffect(() => {
        // A page change mid-drag (e.g. a second finger on a paddle) cancels
        // exactly once before the presentation rebinds (ADR-024 §17).
        gestureController.cancelGesture();
    }, [gestureController, pageIndex]);
    useEffect(() => {
        if (armedSource !== null) {
            return;
        }
        gestureController.cancelGesture();
    }, [armedSource, gestureController]);

    const graphPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (gestureController.isGestureActive()) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const graphChannelFor = (axis: RollingAxis): ParameterGestureChannel => {
            const axisBinding = axis === "horizontal"
                ? PROVISIONAL_WAVETABLE_GRAPH_AXES.horizontal
                : PROVISIONAL_WAVETABLE_GRAPH_AXES.vertical;
            const axisControlID = axisBinding.controlID as MobileVoiceBindableControlID;
            const axisDisplay = DISPLAY_DESCRIPTORS[axisControlID];
            return {
                // Graph axes integrate from the BASE bindings, never the
                // observed (modulation-inclusive) drawing values.
                startNormalized: axis === "horizontal"
                    ? clamp01(bindingsRef.current.warpAmount.value)
                    : clamp01(bindingsRef.current.framePosition.value),
                pixelsPerFullSpan: axisBinding.pixelsPerFullRange,
                direction: axisBinding.direction,
                write: (normalized) => {
                    bindingsRef.current[axisControlID].setValue(
                        axisDisplay.min + (normalized * (axisDisplay.max - axisDisplay.min)),
                    );
                },
                onActivate: () => {
                    beginGraphHostGesture(axisControlID);
                    setGraphAxis(axis);
                },
            };
        };

        gestureController.startGesture(event, {
            horizontal: graphChannelFor("horizontal"),
            vertical: graphChannelFor("vertical"),
            onFinish: () => {
                endGraphHostGesture();
                setGraphAxis(null);
            },
            resolveScrollLockTargets,
        });
    }, [
        beginGraphHostGesture,
        endGraphHostGesture,
        gestureController,
        resolveScrollLockTargets,
    ]);

    const stopOverlayPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        // Overlay controls must not initiate either graph axis.
        event.stopPropagation();
    }, []);

    const setPage = useCallback((direction: 1 | -1) => {
        setPageByOscillator((current) => ({
            ...current,
            [oscillatorID]: (current[oscillatorID] + direction + MOBILE_VOICE_PAGES.length)
                % MOBILE_VOICE_PAGES.length,
        }));
    }, [oscillatorID]);

    /* -------------------------------------------------------------- */
    /* Render                                                           */
    /* -------------------------------------------------------------- */

    const isMuted = bindings.mute.value >= 0.5;

    const cellSpecById = useMemo(() => new Map(cellSpecs.map((cell) => [cell.id, cell])), [cellSpecs]);

    const renderReadoutChip = (controlID: MobileVoiceBindableControlID) => {
        const spec = getMobileVoiceControlSpec(controlID);
        const display = DISPLAY_DESCRIPTORS[controlID];
        const presentation = cellApi.presentCell(controlID);
        const value = clamp(bindings[controlID].value, display.min, display.max);
        const format = spec.format ?? "percent";
        const modulationTargetKind = spec.modulationParameterKind !== null
            ? targetKindFor(spec.modulationParameterKind)
            : undefined;

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
                onPointerDown={(event) => cellApi.cellPointerDown(event, controlID)}
                onKeyDown={(event) => cellApi.handleReadoutKeyDown(event, controlID)}
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
    };

    const renderStripCell = (controlID: MobileVoiceBindableControlID) => {
        const cell = cellSpecById.get(controlID);
        if (cell === undefined) {
            throw new Error(`Unknown Voice cell ${controlID}`);
        }
        return (
            <ReadoutCell
                key={controlID}
                cell={cell}
                api={cellApi}
                bindings={bindings}
                rolePrefix="mobile-voice"
            />
        );
    };

    const warpModeIndex = clamp(Math.round(bindings.warpMode.value), 0, WARP_MODE_LABELS.length - 1);
    // The transient top-left readout tracks the BASE value being edited.
    const graphValueText = graphAxis === "horizontal"
        ? formatMobileVoiceValue("percent", clamp01(bindings.warpAmount.value))
        : formatMobileVoiceValue("percent", clamp01(bindings.framePosition.value));

    // T02C: the graphic shades the selected source's possible Index travel,
    // derived from the SAME presentation the Index cell rail draws (canonical
    // amount, polarity, clamping — never a second projection).
    const indexPresentation = cellApi.presentCell("framePosition");
    const indexShading = wavetableModulationShadingRange(indexPresentation.railState, indexPresentation.band);
    const graphModulationRange = indexShading === null
        ? null
        : { ...indexShading, color: hexToRGBColor(sourceAccent) };

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
                            data-drag-dwell={`oscillator-tab:${oscillator.id}`}
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
                        modulationRange={graphModulationRange}
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
                        onClick={() => cellApi.cycleChoice("warpMode")}
                    >
                        <span className="mobile-voice-chip-label">Warp</span>
                        <strong className="mobile-voice-chip-value">{WARP_MODE_LABELS[warpModeIndex]}</strong>
                    </button>

                    {renderReadoutChip("unisonVoices")}
                    {renderReadoutChip("semitone")}
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
                            if (!isBindableControlID(controlID)) {
                                throw new Error(`Unknown Voice cell ${controlID}`);
                            }
                            return renderStripCell(controlID);
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

            {cellApi.hud}
        </div>
    );
}

export type { MobileVoicePageName };
