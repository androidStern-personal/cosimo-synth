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
import { MsegEditorControlStrip } from "./mseg-editor-controls";
import { MsegEditorShell } from "./mseg-editor-shell";
import {
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
} from "../shared/parameter-value-entry";
import { getModulationTargetDescriptor } from "../shared/target-descriptor";

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

const QUICK_ENVELOPE_STAGES = [
    { id: "attack", field: "attackSeconds", targetSuffix: "Attack", shortLabel: "A" },
    { id: "decay", field: "decaySeconds", targetSuffix: "Decay", shortLabel: "D" },
    { id: "sustain", field: "sustain", targetSuffix: "Sustain", shortLabel: "S" },
    { id: "release", field: "releaseSeconds", targetSuffix: "Release", shortLabel: "R" },
] as const;

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
    readonly msegRateBinding: PatchControlBinding<number>;
    readonly msegEditShapeIndex: 0 | 1;
    readonly onSelectMsegShape: (shapeIndex: 0 | 1) => void;
    readonly msegMorphBinding: PatchControlBinding<number>;
    readonly onMsegMorphAdjustingChange: (isAdjusting: boolean) => void;
    readonly msegLoopEnabled: boolean;
    readonly onToggleMsegLoop: () => void;
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
    msegRateBinding,
    msegEditShapeIndex,
    onSelectMsegShape,
    msegMorphBinding,
    onMsegMorphAdjustingChange,
    msegLoopEnabled,
    onToggleMsegLoop,
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
    const envelopeParameters = useMemo(() => {
        if (source.sourceKind !== "env") {
            return [];
        }
        const targetPrefix = slot === 4 ? "amp" : `env${slot}`;
        const envelopeLabel = slot === 4 ? "Amp Envelope" : `Envelope ${slot}`;
        return QUICK_ENVELOPE_STAGES.map((stage) => {
            const targetKind = `${targetPrefix}${stage.targetSuffix}` as ModulationTargetKind;
            const descriptor = getModulationTargetDescriptor(targetKind);
            if (descriptor.binding._tag !== "endpoint") {
                throw new Error(`${descriptor.label} has no quick-sheet endpoint.`);
            }
            const display = stage.field === "sustain"
                ? { min: 0, max: 1, step: 0.001 }
                : (() => {
                    if (descriptor.format.kind !== "time") {
                        throw new Error(`${descriptor.label} has no envelope-time range.`);
                    }
                    return {
                        min: descriptor.format.minSeconds,
                        max: descriptor.format.maxSeconds,
                        step: 0.001,
                    };
                })();
            return {
                ...stage,
                targetKind,
                endpointID: descriptor.binding.endpointId,
                fullLabel: `${envelopeLabel} ${stage.id}`,
                display,
            };
        });
    }, [slot, source.sourceKind]);
    const cells = useMemo<ReadonlyArray<ReadoutCellSpec>>(() => {
        if (source.sourceKind === "mseg") {
            return [];
        }
        if (source.sourceKind === "env") {
            return envelopeParameters.map((cell): ReadoutCellSpec => ({
                id: cell.id,
                kind: "readout",
                shortLabel: cell.shortLabel,
                fullLabel: cell.fullLabel,
                display: cell.display,
                formatValue: cell.id === "sustain" ? formatPercentValue : formatSecondsValue,
                targetKind: cell.targetKind,
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
    }, [envelopeParameters, slot, source.sourceKind]);

    const bindings = useMemo((): Readonly<Record<string, PatchControlBinding<number>>> => {
        if (source.sourceKind === "mseg") {
            return {};
        }
        if (source.sourceKind === "env") {
            if (envelope === null) {
                throw new Error(`${identity.label} is not available for the quick sheet.`);
            }
            const nextBindings: Record<string, PatchControlBinding<number>> = {};
            for (const parameter of envelopeParameters) {
                nextBindings[parameter.id] = documentValueBinding(
                    parameter.endpointID,
                    envelope[parameter.field],
                    envelopeReadiness[parameter.field],
                    (next) => onEnvelopeChange(parameter.field, next),
                );
            }
            return nextBindings;
        }
        if (macroBinding === null) {
            throw new Error(`Macro ${slot} is not available for the quick sheet.`);
        }
        return { value: macroBinding };
    }, [envelope, envelopeParameters, envelopeReadiness, identity.label, macroBinding, onEnvelopeChange, slot, source.sourceKind]);

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

    const headerActions = (
        <>
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
        </>
    );
    const controls = source.sourceKind === "mseg" ? (
        <MsegEditorControlStrip
            slotIndex={slot - 1}
            rateBinding={msegRateBinding}
            morphBinding={msegMorphBinding}
            routes={routes}
            armedSource={stripSource}
            hudContainer={hudContainer}
            rolePrefix="quick-source-sheet"
            dataRole="quick-source-sheet-strip"
            variant="drawer"
            className="quick-source-sheet-strip"
            editShapeIndex={msegEditShapeIndex}
            onSelectShape={onSelectMsegShape}
            resolveScrollLockTargets={resolveScrollLockTargets}
            onRequestHaptic={onRequestHaptic}
            onRequestParameterMenu={onRequestParameterMenu}
            onMorphAdjustingChange={onMsegMorphAdjustingChange}
            loopEnabled={msegLoopEnabled}
            onToggleLoop={onToggleMsegLoop}
        />
    ) : (
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
                            controlKey: binding.endpointID,
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
    );

    return (
        <MsegEditorShell
            variant="drawer"
            useMsegVisualLanguage={source.sourceKind === "mseg"}
            label={identity.label}
            accent={identity.accent}
            dataRole="quick-source-sheet"
            dataSourceKind={source.sourceKind}
            dataSourceSlot={source.sourceSlot}
            dataDetent={dragHeight !== null ? "dragging" : detent}
            rootClassName={dragHeight !== null ? "is-resizing" : undefined}
            style={{
                height: `${sheetHeight}px`,
                transition: dragHeight !== null ? "none" : undefined,
            }}
            ariaLabel={`${identity.label} quick editor`}
            headerAriaLabel="Resize or dismiss the quick editor"
            showGrip
            onHeaderPointerDown={gripPointerDown}
            headerActions={headerActions}
            controls={controls}
            graphic={graphic}
            graphicDataRole="quick-source-sheet-graphic"
        />
    );
}
