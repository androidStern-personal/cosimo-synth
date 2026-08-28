import { useCallback, useMemo, type CSSProperties } from "react";

import { hexToRgbTriplet } from "../shared/parameter-hud";
import { useParameterGesture } from "../shared/parameter-gesture";
import {
    ParameterReadoutStrip,
    type ReadoutCellSpec,
    type ReadoutStripSource,
} from "../shared/parameter-readout-strip";
import type { PatchControlBinding } from "../shared/patch-controls";
import type { ModulationRoute } from "../shared/modulation";
import type { ModulationTargetKind } from "../shared/modulation-targets";
import type { ParameterMenuRequest } from "../shared/parameter-context-menu";
import {
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
} from "../shared/parameter-value-entry";
import type { SynthFocusBindings } from "../shared/synth-input-router";
import {
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    type MsegShape,
} from "../shared/mseg";
import { findRackModulationSource } from "../shared/rack-modulation-sources";

/** Leaves 12px for the shared >8px touch activation so total travel fits in 100px. */
const MSEG_COMPACT_KNOB_ACTIVE_TRAVEL_PX = 88;
const MSEG_SHAPE_INDICES = [0, 1] as const;

function formatSecondsValue(value: number): string {
    return `${value.toFixed(3)} s`;
}

function formatCompactSecondsValue(value: number): string {
    return `${value.toFixed(1)}s`;
}

function formatPercentValue(value: number): string {
    return `${Math.round(value * 100)}%`;
}

/** Shared compact MSEG toolbar used by the quick drawer and full editor. */
export type MsegEditorControlStripProps = {
    readonly slotIndex: number;
    readonly rateBinding: PatchControlBinding<number>;
    readonly morphBinding: PatchControlBinding<number>;
    readonly morphShapeAPoints: MsegShape["points"] | null;
    readonly morphShapeBPoints: MsegShape["points"] | null;
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly armedSource: ReadoutStripSource | null;
    readonly hudContainer: Element | null;
    readonly rolePrefix: string;
    readonly dataRole: string;
    readonly variant: "drawer" | "full";
    readonly className?: string;
    readonly editShapeIndex: 0 | 1;
    readonly onSelectShape: (shapeIndex: 0 | 1) => void;
    readonly resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
    readonly onRequestHaptic?: () => void;
    readonly onRequestParameterMenu?: (request: ParameterMenuRequest) => void;
    readonly rateFocusBindings?: SynthFocusBindings;
    readonly onMorphAdjustingChange?: (isAdjusting: boolean) => void;
    readonly loopEnabled: boolean;
    readonly onToggleLoop: () => void;
};

/** Render one shared A/B, Rate, Morph, Loop toolbar without owning MSEG document state. */
export function MsegEditorControlStrip({
    slotIndex,
    rateBinding,
    morphBinding,
    morphShapeAPoints,
    morphShapeBPoints,
    routes,
    armedSource,
    hudContainer,
    rolePrefix,
    dataRole,
    variant,
    className,
    editShapeIndex,
    onSelectShape,
    resolveScrollLockTargets,
    onRequestHaptic,
    onRequestParameterMenu,
    rateFocusBindings,
    onMorphAdjustingChange,
    loopEnabled,
    onToggleLoop,
}: MsegEditorControlStripProps) {
    const slot = slotIndex + 1;
    const identity = findRackModulationSource("mseg", slot);
    const gestureController = useParameterGesture();
    const cells = useMemo<ReadonlyArray<ReadoutCellSpec>>(() => [
        {
            id: "rate",
            kind: "readout",
            shortLabel: "Rate",
            fullLabel: variant === "full" ? "MSEG rate" : `MSEG ${slot} rate`,
            display: { min: MSEG_RATE_MIN_SECONDS, max: MSEG_RATE_MAX_SECONDS, step: 0.001 },
            formatValue: formatSecondsValue,
            formatCellValue: formatCompactSecondsValue,
            targetKind: `mseg${slot}Rate` as ModulationTargetKind,
            presentation: "compact-knob",
            basePixelsPerFullRange: MSEG_COMPACT_KNOB_ACTIVE_TRAVEL_PX,
            ...(variant === "full" ? { readoutDataRole: "mseg-rate-readout" } : {}),
        },
        {
            id: "morph",
            kind: "readout",
            shortLabel: "Morph",
            fullLabel: "MSEG morph",
            display: { min: 0, max: 1, step: 0.001 },
            formatValue: formatPercentValue,
            targetKind: `mseg${slot}Morph` as ModulationTargetKind,
            presentation: "compact-knob",
            presentHudVisualization: morphShapeAPoints !== null && morphShapeBPoints !== null
                ? (value: number) => ({
                    kind: "mseg-morph" as const,
                    shapeAPoints: morphShapeAPoints,
                    shapeBPoints: morphShapeBPoints,
                    morph: value,
                })
                : undefined,
        },
    ], [morphShapeAPoints, morphShapeBPoints, slot, variant]);
    const bindings = useMemo<Readonly<Record<string, PatchControlBinding<number>>>>(() => ({
        morph: morphBinding,
        rate: rateBinding,
    }), [morphBinding, rateBinding]);
    const requestParameterMenu = useCallback((cellId: string, clientX: number, clientY: number) => {
        if (onRequestParameterMenu === undefined) {
            return;
        }
        const binding = bindings[cellId];
        if (binding === undefined) {
            throw new Error(`MSEG control ${cellId} has no binding.`);
        }
        const isRate = cellId === "rate";
        onRequestParameterMenu({
            controlKey: isRate ? `mseg${slot}Rate` : `mseg${slot}Morph`,
            label: isRate ? "MSEG rate" : "MSEG morph",
            targetKind: isRate
                ? `mseg${slot}Rate` as ModulationTargetKind
                : `mseg${slot}Morph` as ModulationTargetKind,
            baseSpec: isRate
                ? parameterEntrySpecForSeconds({
                    minSeconds: MSEG_RATE_MIN_SECONDS,
                    maxSeconds: MSEG_RATE_MAX_SECONDS,
                    stepSeconds: 0.001,
                    currentSeconds: binding.value,
                })
                : parameterEntrySpecForScalar({
                    min: 0,
                    max: 1,
                    step: 0.001,
                    unit: "%",
                    canonicalPerDisplayedUnit: 0.01,
                    digits: 0,
                }),
            baseValue: binding.value,
            defaultValue: isRate ? null : morphBinding.initialValue ?? null,
            commitBase: binding.commitValue,
            clientX,
            clientY,
        });
    }, [bindings, morphBinding.initialValue, onRequestParameterMenu, slot]);
    const focusBindingsByCell = useMemo(() => (
        rateFocusBindings === undefined ? undefined : { rate: rateFocusBindings }
    ), [rateFocusBindings]);
    const handleDraggingCellChange = useCallback((draggingCell: {
        readonly cellId: string;
        readonly mode: "pending" | "base" | "modulation";
    } | null) => {
        onMorphAdjustingChange?.(
            draggingCell?.cellId === "morph" && draggingCell.mode === "base",
        );
    }, [onMorphAdjustingChange]);

    return (
        <div
            data-role={dataRole}
            data-variant={variant}
            className={`mseg-control-strip${className === undefined ? "" : ` ${className}`}`}
            style={{
                "--mobile-voice-owner-accent": identity.accent,
                "--mobile-voice-owner-accent-rgb": hexToRgbTriplet(identity.accent),
            } as CSSProperties}
        >
            <div className="mseg-editor-shapes" role="group" aria-label="MSEG shape">
                {MSEG_SHAPE_INDICES.map((shapeIndex) => (
                    <button
                        key={`mseg-editor-shape-${shapeIndex}`}
                        type="button"
                        aria-label={`Edit shape ${shapeIndex === 0 ? "A" : "B"}`}
                        aria-pressed={editShapeIndex === shapeIndex}
                        data-role={shapeIndex === 0 ? "mseg-shape-a" : "mseg-shape-b"}
                        className={`mseg-editor-action ${
                            editShapeIndex === shapeIndex
                                ? "synth-accent-active-button"
                                : "text-slate-300/55 hover:bg-white/[0.05] hover:text-slate-100"
                        }`}
                        onClick={() => onSelectShape(shapeIndex)}
                    >
                        {shapeIndex === 0 ? "A" : "B"}
                    </button>
                ))}
            </div>
            <ParameterReadoutStrip
                cells={cells}
                bindings={bindings}
                routes={routes}
                armedSource={armedSource}
                hudContainer={hudContainer}
                gestureController={gestureController}
                ownerAccent={identity.accent}
                ownerAccentRgb={hexToRgbTriplet(identity.accent)}
                rolePrefix={rolePrefix}
                focusBindingsByCell={focusBindingsByCell}
                onDraggingCellChange={handleDraggingCellChange}
                {...(resolveScrollLockTargets === undefined ? {} : { resolveScrollLockTargets })}
                {...(onRequestHaptic === undefined ? {} : { onRequestHaptic })}
                {...(onRequestParameterMenu === undefined ? {} : { onRequestParameterMenu: requestParameterMenu })}
            />
            <button
                type="button"
                data-role="mseg-loop-toggle"
                className="cosimo-button mseg-control-strip-loop"
                aria-pressed={loopEnabled}
                onClick={onToggleLoop}
            >
                {loopEnabled ? "Loop" : "1 Shot"}
            </button>
        </div>
    );
}
