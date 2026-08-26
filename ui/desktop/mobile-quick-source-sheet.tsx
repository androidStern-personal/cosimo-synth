/**
 * T13: the iOS-style quick-editor sheet for the selected modulation source.
 * It floats over the CURRENT Voice/FX workspace (never a navigation), opens at
 * a compact ~quarter-height detent, snaps to ~half on an upward grab-rail
 * drag, transitions into the existing full-screen editor when dragged all the
 * way up, and dismisses on a downward drag past the threshold.
 *
 * The parameter strip is the EXACT shared readout-cell language
 * (ui/shared/parameter-readout-strip.tsx) — the same component the Voice
 * editor's strip uses — never sheet-specific controls. Only the modulation
 * graphic re-orients with its available aspect ratio; the strip never moves.
 * The sheet is non-modal: the workspace beneath and the floating Mod bar
 * (audition included) stay live, and the bar renders above the sheet.
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import type { ReactNode } from "react";

import { useParameterGesture } from "../shared/parameter-gesture";
import {
    ParameterReadoutStrip,
    type ReadoutCellSpec,
    type ReadoutStripSource,
} from "../shared/parameter-readout-strip";
import type { PatchControlBinding } from "../shared/patch-controls";
import type { ModulationRoute } from "../shared/modulation";
import type { ModulationTargetKind } from "../shared/modulation-targets";
import { findRackModulationSource, type RackModulationSourceKind } from "../shared/rack-modulation-sources";
import { hexToRgbTriplet } from "../shared/parameter-hud";
import type { ParameterMenuRequest } from "../shared/parameter-context-menu";
import type { SynthCallbackControlReadiness } from "../shared/synth-hooks";
import {
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
} from "../shared/parameter-value-entry";

const COMPACT_FRACTION = 0.3;
const HALF_FRACTION = 0.5;
/** Below this fraction of the compact height, release dismisses the sheet. */
const DISMISS_FRACTION = 0.72;
/** Above this fraction past half height, release opens the full editor. */
const FULL_EDITOR_FRACTION = 1.28;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function formatSecondsValue(value: number): string {
    return `${value.toFixed(3)} s`;
}

function formatPercentValue(value: number): string {
    return `${Math.round(value * 100)}%`;
}

/** Callback-only controls still project the authoritative endpoint readiness. */
function documentValueBinding(
    endpointID: string,
    value: number,
    isReady: boolean,
    write: (next: number) => void,
): PatchControlBinding<number> {
    const guardedWrite = (next: number) => {
        if (isReady) write(next);
    };
    return {
        endpointID,
        value,
        isReady,
        setValue: guardedWrite,
        commitValue: guardedWrite,
        beginGesture: () => undefined,
        endGesture: () => undefined,
    };
}

/** The macro's editable value bar: horizontal drag writes the base value. */
function MacroValueBar({
    binding,
    accent,
}: {
    binding: PatchControlBinding<number>;
    accent: string;
}) {
    const applyFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!binding.isReady) return;
        const rect = event.currentTarget.getBoundingClientRect();
        binding.setValue(clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1));
    };
    return (
        <div
            data-role="quick-source-sheet-macro"
            data-host-state={binding.isReady ? "ready" : "loading"}
            aria-busy={!binding.isReady}
            className={`quick-source-sheet-macro${binding.isReady ? "" : " is-loading"}`}
            onPointerDown={(event) => {
                if (!binding.isReady) return;
                if (event.pointerType === "mouse" && event.button !== 0) {
                    return;
                }
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                binding.beginGesture();
                applyFromEvent(event);
            }}
            onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    applyFromEvent(event);
                }
            }}
            onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    binding.endGesture();
                }
            }}
            onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    binding.endGesture();
                }
            }}
        >
            <span
                className="quick-source-sheet-macro-fill"
                style={{ width: `${(clamp(binding.value, 0, 1) * 100).toFixed(1)}%`, background: accent }}
            />
        </div>
    );
}

export type QuickSheetEnvelope = {
    readonly attackSeconds: number;
    readonly decaySeconds: number;
    readonly sustain: number;
    readonly releaseSeconds: number;
};

export type MobileQuickSourceSheetProps = {
    readonly source: { readonly sourceKind: RackModulationSourceKind; readonly sourceSlot: number };
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly hudContainer: Element | null;
    readonly resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    readonly onRequestHaptic?: () => void;
    /** The REAL editable MSEG surface, composed by the shell with the same
        handlers the full editor uses (T14 direction: the compact graph is
        directly point-editable; structural precision stays in the full
        editor). null while the slot has no state. */
    readonly msegSurface: ReactNode | null;
    /** The real draggable ADSR editor, composed by the shell. */
    readonly envelopeSurface: ReactNode | null;
    readonly msegRateSeconds: number;
    readonly msegRateReady: boolean;
    readonly onMsegRateChange: (next: number) => void;
    readonly msegMorphBinding: PatchControlBinding<number>;
    readonly envelope: QuickSheetEnvelope | null;
    readonly envelopeReadiness: SynthCallbackControlReadiness["envelope"];
    readonly onEnvelopeChange: (
        field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds",
        next: number,
    ) => void;
    readonly macroBinding: PatchControlBinding<number> | null;
    /** ADR-017 long-press menu, owned by the shell (one menu everywhere). */
    readonly onRequestParameterMenu?: (request: ParameterMenuRequest) => void;
    readonly onClose: () => void;
    readonly onOpenFullEditor: () => void;
};

export function MobileQuickSourceSheet({
    source,
    routes,
    hudContainer,
    resolveScrollLockTargets,
    onRequestHaptic,
    msegSurface,
    envelopeSurface,
    msegRateSeconds,
    msegRateReady,
    onMsegRateChange,
    msegMorphBinding,
    envelope,
    envelopeReadiness,
    onEnvelopeChange,
    macroBinding,
    onRequestParameterMenu,
    onClose,
    onOpenFullEditor,
}: MobileQuickSourceSheetProps) {
    const identity = findRackModulationSource(source.sourceKind, source.sourceSlot);
    const gestureController = useParameterGesture();

    /* ------------------------- Detent geometry ------------------------ */

    const usableHeight = useCallback(() => (
        window.visualViewport?.height ?? window.innerHeight
    ), []);
    const [detent, setDetent] = useState<"compact" | "half">("compact");
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);

    const detentHeight = useCallback((which: "compact" | "half") => (
        Math.round(usableHeight() * (which === "compact" ? COMPACT_FRACTION : HALF_FRACTION))
    ), [usableHeight]);

    const sheetHeight = dragHeight ?? detentHeight(detent);

    const gripPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        event.preventDefault();
        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: sheetHeight,
        };
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Window listeners below still finish uncaptured pointers.
        }
    }, [sheetHeight]);

    useEffect(() => {
        const handleMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (drag === null || event.pointerId !== drag.pointerId) {
                return;
            }
            const next = drag.startHeight + (drag.startY - event.clientY);
            setDragHeight(clamp(next, detentHeight("compact") * 0.5, usableHeight() * 0.92));
        };
        const settle = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (drag === null || event.pointerId !== drag.pointerId) {
                return;
            }
            dragRef.current = null;
            const released = drag.startHeight + (drag.startY - event.clientY);
            setDragHeight(null);
            const compact = detentHeight("compact");
            const half = detentHeight("half");
            if (released < compact * DISMISS_FRACTION) {
                onClose();
                return;
            }
            if (released > half * FULL_EDITOR_FRACTION) {
                // All the way up IS the existing full-screen editor — never a
                // nearly-full sheet that duplicates it.
                onOpenFullEditor();
                return;
            }
            setDetent(Math.abs(released - compact) <= Math.abs(released - half) ? "compact" : "half");
        };
        const cancel = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (drag === null || event.pointerId !== drag.pointerId) {
                return;
            }
            dragRef.current = null;
            setDragHeight(null);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", settle);
        window.addEventListener("pointercancel", cancel);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", settle);
            window.removeEventListener("pointercancel", cancel);
        };
    }, [detentHeight, onClose, onOpenFullEditor, usableHeight]);

    /* --------------------------- Cell specs --------------------------- */

    const slot = source.sourceSlot;
    const cells = useMemo<ReadonlyArray<ReadoutCellSpec>>(() => {
        if (source.sourceKind === "mseg") {
            return [
                {
                    id: "rate",
                    kind: "readout",
                    shortLabel: "Rate",
                    fullLabel: `MSEG ${slot} rate`,
                    display: { min: 0, max: 2, step: 0.001 },
                    formatValue: formatSecondsValue,
                    targetKind: `mseg${slot}Rate` as ModulationTargetKind,
                },
                {
                    id: "morph",
                    kind: "readout",
                    shortLabel: "Morph",
                    fullLabel: `MSEG ${slot} morph`,
                    display: { min: 0, max: 1, step: 0.001 },
                    formatValue: formatPercentValue,
                    targetKind: `mseg${slot}Morph` as ModulationTargetKind,
                },
            ];
        }
        if (source.sourceKind === "env") {
            return [
                { id: "attack", shortLabel: "A", fullLabel: `Envelope ${slot} attack` },
                { id: "decay", shortLabel: "D", fullLabel: `Envelope ${slot} decay` },
                { id: "sustain", shortLabel: "S", fullLabel: `Envelope ${slot} sustain` },
                { id: "release", shortLabel: "R", fullLabel: `Envelope ${slot} release` },
            ].map((cell): ReadoutCellSpec => ({
                id: cell.id,
                kind: "readout",
                shortLabel: cell.shortLabel,
                fullLabel: cell.fullLabel,
                display: cell.id === "sustain"
                    ? { min: 0, max: 1, step: 0.001 }
                    : { min: 0.001, max: 10, step: 0.001 },
                formatValue: cell.id === "sustain" ? formatPercentValue : formatSecondsValue,
                targetKind: `env${slot}${cell.id[0].toUpperCase()}${cell.id.slice(1)}` as ModulationTargetKind,
            }));
        }
        return [{
            id: "value",
            kind: "readout",
            shortLabel: "Value",
            fullLabel: `Macro ${slot} value`,
            display: { min: 0, max: 1, step: 0.001 },
            formatValue: formatPercentValue,
            targetKind: null,
        }];
    }, [slot, source.sourceKind]);

    const bindings = useMemo((): Readonly<Record<string, PatchControlBinding<number>>> => {
        if (source.sourceKind === "mseg") {
            return {
                rate: documentValueBinding(`mseg${slot}Rate`, msegRateSeconds, msegRateReady, onMsegRateChange),
                morph: msegMorphBinding,
            };
        }
        if (source.sourceKind === "env") {
            if (envelope === null) {
                throw new Error(`Envelope ${slot} is not available for the quick sheet.`);
            }
            return {
                attack: documentValueBinding(`env${slot}Attack`, envelope.attackSeconds, envelopeReadiness.attackSeconds, (next) => onEnvelopeChange("attackSeconds", next)),
                decay: documentValueBinding(`env${slot}Decay`, envelope.decaySeconds, envelopeReadiness.decaySeconds, (next) => onEnvelopeChange("decaySeconds", next)),
                sustain: documentValueBinding(`env${slot}Sustain`, envelope.sustain, envelopeReadiness.sustain, (next) => onEnvelopeChange("sustain", next)),
                release: documentValueBinding(`env${slot}Release`, envelope.releaseSeconds, envelopeReadiness.releaseSeconds, (next) => onEnvelopeChange("releaseSeconds", next)),
            };
        }
        if (macroBinding === null) {
            throw new Error(`Macro ${slot} is not available for the quick sheet.`);
        }
        return { value: macroBinding };
    }, [envelope, envelopeReadiness, macroBinding, msegMorphBinding, msegRateReady, msegRateSeconds, onEnvelopeChange, onMsegRateChange, slot, source.sourceKind]);

    const stripSource = useMemo<ReadoutStripSource>(() => ({
        sourceKind: identity.sourceKind,
        sourceSlot: identity.sourceSlot,
        shortLabel: identity.shortLabel,
        accent: identity.accent,
    }), [identity]);

    const graphic = (() => {
        if (source.sourceKind === "mseg") {
            return msegSurface;
        }
        if (source.sourceKind === "env") {
            return envelopeSurface;
        }
        if (macroBinding !== null) {
            return (
                <MacroValueBar binding={macroBinding} accent={identity.accent} />
            );
        }
        return null;
    })();

    return (
        <section
            data-role="quick-source-sheet"
            data-source-kind={source.sourceKind}
            data-source-slot={source.sourceSlot}
            data-detent={dragHeight !== null ? "dragging" : detent}
            className="quick-source-sheet"
            style={{
                height: `${sheetHeight}px`,
                "--quick-sheet-accent": identity.accent,
                transition: dragHeight !== null ? "none" : undefined,
            } as CSSProperties}
            aria-label={`${identity.label} quick editor`}
        >
            <header
                data-role="quick-source-sheet-grip"
                className="quick-source-sheet-top"
                aria-label="Resize or dismiss the quick editor"
                onPointerDown={gripPointerDown}
            >
                <strong>{identity.label}</strong>
                <span className="quick-source-sheet-grip-pill" aria-hidden="true" />
                <button
                    type="button"
                    data-role="quick-source-sheet-full-editor"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={onOpenFullEditor}
                >
                    Full editor
                </button>
                <button
                    type="button"
                    data-role="quick-source-sheet-close"
                    aria-label="Close quick editor"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={onClose}
                >
                    ×
                </button>
            </header>
            <div
                data-role="quick-source-sheet-strip"
                className="quick-source-sheet-strip"
                style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
            >
                <ParameterReadoutStrip
                    cells={cells}
                    bindings={bindings}
                    routes={routes}
                    armedSource={stripSource}
                    hudContainer={hudContainer}
                    gestureController={gestureController}
                    ownerAccent={identity.accent}
                    ownerAccentRgb={hexToRgbTriplet(identity.accent)}
                    rolePrefix="quick-source-sheet"
                    resolveScrollLockTargets={resolveScrollLockTargets}
                    onRequestHaptic={onRequestHaptic}
                    onRequestParameterMenu={onRequestParameterMenu === undefined
                        ? undefined
                        : (cellId, clientX, clientY) => {
                            const cell = cells.find((candidate) => candidate.id === cellId);
                            const binding = bindings[cellId];
                            if (cell === undefined || binding === undefined) {
                                throw new Error(`Quick sheet cell ${cellId} has no spec.`);
                            }
                            const percentSpec = () => parameterEntrySpecForScalar({
                                min: cell.display.min,
                                max: cell.display.max,
                                step: cell.display.step,
                                unit: "%",
                                canonicalPerDisplayedUnit: 0.01,
                                digits: 0,
                            });
                            const secondsSpec = () => parameterEntrySpecForSeconds({
                                minSeconds: cell.display.min,
                                maxSeconds: cell.display.max,
                                stepSeconds: cell.display.step,
                                currentSeconds: binding.value,
                            });
                            const baseSpec = cell.formatValue === formatSecondsValue
                                ? secondsSpec()
                                : percentSpec();
                            onRequestParameterMenu({
                                controlKey: `quick-${source.sourceKind}${source.sourceSlot}-${cellId}`,
                                label: cell.fullLabel,
                                targetKind: cell.targetKind,
                                baseSpec,
                                baseValue: binding.value,
                                defaultValue: binding.initialValue ?? null,
                                commitBase: (value) => binding.commitValue(value),
                                clientX,
                                clientY,
                            });
                        }}
                />
            </div>
            <div
                data-role="quick-source-sheet-graphic"
                className="quick-source-sheet-graphic"
            >
                {graphic}
            </div>
        </section>
    );
}
