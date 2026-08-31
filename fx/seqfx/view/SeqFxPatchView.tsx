import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { createEffectHeader } from "../../../ui/shared/effects/effect-header";
import { EffectSnapshotBankController } from "../../../ui/shared/effects/effect-snapshot-bank";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets";
import {
    FilterRangeEditor,
    type FilterRangeEndpoints,
    type FilterRangeMode,
    type FilterRangeModeOption,
    type FilterRangeValue,
    cutoffRangeOctaves,
    cutoffsFromCenterRangeOctaves,
    geometricCenterCutoffHz,
} from "../../../ui/shared/filter-range-editor";
import { ModBadge, type ModulationDirection } from "../../../ui/shared/editor-tick-slider";
import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import {
    adaptiveSampleEditorCurve,
    createEditorCurvePlotRect,
    editorCurveFillPathToBaseline,
    normalizedCurvePointToPlotPoint,
    polylineToSvgPath,
    type EditorCurvePlotRect,
} from "../../../ui/shared/editor-curve-geometry";
import {
    EditorCurveAxis,
    EditorCurveFill,
    EditorCurveHandle,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "../../../ui/shared/editor-curve-surface";
import { AuxSource, auxSourceMonitorPoint, buildAuxSourcePreviewPath } from "./AuxSource";
import { CrusherEditor, type CrusherModulation } from "./CrusherEditor";
import { SeqFxGlobalControlSurface } from "./SeqFxGlobalControls";
import { StutterEnvelopeEditor, type StutterModulation } from "./StutterEnvelopeEditor";
import {
    formatSeqFxParameterRange,
    formatSeqFxParameterValue,
    type SeqFxParameterDefinition,
} from "./seqfx-effect-definitions";
import {
    SEQFX_EFFECT_TYPES,
    SEQFX_EFFECT_TYPE_NAMES,
    SEQFX_EFFECT_TYPE_SHORT_NAMES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    getSeqFxEffectDefinition,
    getSeqFxBlockAtStep,
    getSeqFxLaneBlocks,
    isSeqFxTriggerLatchedParamForEffect,
    type SeqFxAuxSource,
    type SeqFxAuxState,
    type SeqFxBlock,
    type SeqFxEffectType,
    type SeqFxPattern,
    type SeqFxStep,
    type SeqFxStepValueSnapshot,
    type SeqFxState,
} from "./seqfx-state";
import { formatStutterShapeLabel } from "./stutter-envelope";
import { formatTalkBoxVowelPair, resolveTalkBoxFormants } from "./talk-box-contract";
import {
    TAPE_STOP_RETURN_CROSSFADE_TO_LIVE,
    TAPE_STOP_RETURN_SPIN_UP,
    resolveTapeStopV2Trajectory,
    sampleTapeStopV2Trajectory,
} from "./tape-stop-v2-trajectory";
import { createSeqFxPresetStateAdapter } from "./seqfx-preset-adapter";
import {
    createSeqFxPresetMigrations,
    createSeqFxSnapshotMigrations,
} from "./seqfx-preset-migrations";
import {
    SEQFX_ENDPOINTS,
    SeqFxRuntimeBridge,
    type SeqFxGlobalControls,
} from "./seqfx-runtime-bridge";

type SelectedCell = {
    lane: number;
    step: number;
};

type Selection = {
    lane: number;
    steps: number[];
    blockStartSteps?: number[];
};

type InspectorMode = "effect" | "mod";

type PointerOwnedGesture = {
    readonly pointerId: number;
};

type ResizeGesture = PointerOwnedGesture & {
    mode: "resize";
    lane: number;
    startStep: number;
    length: number;
    previewLength: number | null;
};

type MoveGesture = PointerOwnedGesture & {
    mode: "move";
    lane: number;
    sourceStartStep: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    previewTargetLane: number | null;
    previewTargetStartStep: number | null;
};

type BlockSelectionMoveGesture = PointerOwnedGesture & {
    mode: "selectionMove";
    lane: number;
    blockStartSteps: number[];
    anchorStartStep: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    anchorMinStartStep: number;
    anchorMaxStartStep: number;
    previewTargetLane: number | null;
    previewTargetAnchorStartStep: number | null;
    previewMovedStartSteps: number[] | null;
};

type CopyGesture = PointerOwnedGesture & {
    mode: "copy";
    lane: number;
    sourceStartStep: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    previewTargetLane: number | null;
    previewTargetStartStep: number | null;
};

type BlockSelectionCopyGesture = PointerOwnedGesture & {
    mode: "selectionCopy";
    lane: number;
    blockStartSteps: number[];
    anchorStartStep: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    anchorMinStartStep: number;
    anchorMaxStartStep: number;
    previewTargetLane: number | null;
    previewTargetAnchorStartStep: number | null;
    previewCopiedStartSteps: number[] | null;
};

type BlockGesture = ResizeGesture | MoveGesture | BlockSelectionMoveGesture | CopyGesture | BlockSelectionCopyGesture;

type PatternPreview = {
    patternIndex: number;
    lane: number;
    copiedStartSteps?: number[];
    state: SeqFxState;
};

type AuxMonitorState = {
    cyclePhase: number[];
    amount: number[];
    durationMs: number[];
};

type AuxModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

type InvalidDropTarget = {
    patternIndex: number;
    lane: number;
    blocks: Array<{
        startStep: number;
        length: number;
    }>;
};

type ParamDefinition = SeqFxParameterDefinition & {
    index: number;
    kind?: "select";
    amountKind: ParamAmountKind;
};

type ParamAmountKind =
    | "cutoffOctaves"
    | "integer"
    | "linear"
    | "db"
    | "speed"
    | "percentPoints"
    | "stutterShape";

type SeqFxCSSProperties = CSSProperties & {
    [customProperty: `--${string}`]: string | number;
};

const EFFECT_OPTIONS = [
    SEQFX_EFFECT_TYPES.filter,
    SEQFX_EFFECT_TYPES.crusher,
    SEQFX_EFFECT_TYPES.tapeStop,
    SEQFX_EFFECT_TYPES.stutter,
    SEQFX_EFFECT_TYPES.pitch,
    SEQFX_EFFECT_TYPES.comb,
    SEQFX_EFFECT_TYPES.ring,
    SEQFX_EFFECT_TYPES.reverse,
    SEQFX_EFFECT_TYPES.talkBox,
    SEQFX_EFFECT_TYPES.vibro,
    SEQFX_EFFECT_TYPES.flange,
    SEQFX_EFFECT_TYPES.dirty,
] as const;

function isEffectOption(value: number): value is typeof EFFECT_OPTIONS[number] {
    return EFFECT_OPTIONS.some((effectType) => effectType === value);
}

function defaultEffectTypeForChain(chain: number) {
    return EFFECT_OPTIONS[Math.min(EFFECT_OPTIONS.length - 1, Math.max(0, chain))] ?? SEQFX_EFFECT_TYPES.filter;
}

function SeqFxTitleSigil() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-title__sigil"
            data-role="seqfx-title-sigil"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
                <path d="M3.5 18 L3.5 14" />
                <path d="M9 18 L9 9" />
                <path d="M14.5 18 L14.5 6" />
                <path d="M20 18 L20 11" />
            </g>
            <g fill="currentColor">
                <circle cx="3.5" cy="14" r="1.5" />
                <circle cx="9" cy="9" r="1.5" />
                <circle cx="14.5" cy="6" r="1.5" />
                <circle cx="20" cy="11" r="1.5" />
            </g>
        </svg>
    );
}

function SeqFxEmptyStateIcon() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-empty__icon"
            data-role="seqfx-empty-icon"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <path
                d="M5 3.6 L5 18 L9.2 14.1 L11.7 19.4 L13.7 18.4 L11.2 13.2 L17 13 Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function SeqFxMixGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-mix-row__glyph"
            data-role="seqfx-mix-glyph"
            focusable="false"
            viewBox="0 0 16 16"
        >
            <line
                x1="2.4"
                y1="8"
                x2="13.6"
                y2="8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.4"
            />
            <circle cx="10" cy="8" r="2.4" fill="currentColor" />
        </svg>
    );
}

function SeqFxDeleteGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-delete-block__glyph"
            data-role="seqfx-delete-glyph"
            focusable="false"
            viewBox="0 0 12 12"
        >
            <path
                d="M3.2 3.2 L8.8 8.8 M8.8 3.2 L3.2 8.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function SeqFxEffectIcon({ effectType }: { effectType: SeqFxEffectType }) {
    const fontaudioIcon = getSeqFxEffectDefinition(effectType).fontaudioIcon;
    const iconUrl = new URL(`../../../ui/assets/fontaudio/${fontaudioIcon}.svg`, import.meta.url).href;
    const iconStyle: CSSProperties & { "--seqfx-effect-icon-mask": string } = {
        "--seqfx-effect-icon-mask": `url("${iconUrl}")`,
    };

    return (
        <span
            aria-hidden="true"
            className="seqfx-effect-icon"
            data-fontaudio-icon={fontaudioIcon}
            data-role="seqfx-effect-icon"
            style={iconStyle}
        />
    );
}

function SeqFxMixRow({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="seqfx-mix-row" data-role="seqfx-mix-row">
            <span className="seqfx-mix-row__label">
                <SeqFxMixGlyph />
                Block mix
            </span>
            <input
                aria-label="Block mix"
                data-role="seqfx-mix"
                max={1}
                min={0}
                onChange={(event) => onChange(Number(event.currentTarget.value))}
                step={0.01}
                type="range"
                value={value}
            />
            <output data-role="seqfx-mix-value">{Math.round(clampNumber(value, 0, 1) * 100)}%</output>
        </label>
    );
}

function enabledAuxTargetCount(aux: SeqFxAuxState) {
    return aux.targets.reduce((count, target) => count + (target.enabled ? 1 : 0), 0);
}

function modulationDirectionForValues(start: number, end: number): ModulationDirection {
    if (end > start) {
        return "up";
    }

    if (end < start) {
        return "down";
    }

    return "both";
}

function formatFilterHzChip(value: number) {
    const cutoff = clampNumber(value, 20, 20_000);
    const roundedCutoff = Math.round(cutoff);
    if (roundedCutoff >= 10_000) {
        return `${(roundedCutoff / 1000).toFixed(1)}k`;
    }

    if (roundedCutoff >= 1000) {
        return `${(roundedCutoff / 1000).toFixed(2)}k`;
    }

    return String(roundedCutoff);
}

function formatSignedFixed(value: number, decimals: number) {
    const zeroThreshold = 1 / (10 ** (decimals + 1));
    if (Math.abs(value) < zeroThreshold) {
        return Number(0).toFixed(decimals);
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function quantizeToStep(value: number, min: number, step: number) {
    if (!Number.isFinite(step) || step <= 0) {
        return value;
    }

    return min + (Math.round((value - min) / step) * step);
}

function modDisplayValue(definition: ParamDefinition, rawValue: number) {
    if (definition.amountKind === "percentPoints") {
        return rawValue * 100;
    }

    return rawValue;
}

function rawValueFromModDisplay(definition: ParamDefinition, displayValue: number) {
    if (definition.amountKind === "percentPoints") {
        return displayValue / 100;
    }

    return displayValue;
}

function modDisplayBounds(definition: ParamDefinition) {
    if (definition.amountKind === "percentPoints") {
        return {
            min: definition.min * 100,
            max: definition.max * 100,
        };
    }

    return {
        min: definition.min,
        max: definition.max,
    };
}

function modAmountBounds(definition: ParamDefinition, baseValue: number) {
    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        return {
            min: Math.log2(definition.min / safeBase),
            max: Math.log2(definition.max / safeBase),
        };
    }

    const baseDisplayValue = modDisplayValue(definition, baseValue);
    const bounds = modDisplayBounds(definition);
    return {
        min: bounds.min - baseDisplayValue,
        max: bounds.max - baseDisplayValue,
    };
}

function modAmountFromTarget(definition: ParamDefinition, baseValue: number, targetValue: number) {
    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        const safeTarget = clampNumber(targetValue, definition.min, definition.max);
        return Math.log2(safeTarget / safeBase);
    }

    return modDisplayValue(definition, targetValue) - modDisplayValue(definition, baseValue);
}

function targetFromModAmount(definition: ParamDefinition, baseValue: number, amount: number) {
    if (Math.abs(amount) < 0.0000001) {
        return clampNumber(baseValue, definition.min, definition.max);
    }

    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        return clampNumber(safeBase * (2 ** amount), definition.min, definition.max);
    }

    const baseDisplayValue = modDisplayValue(definition, baseValue);
    const displayBounds = modDisplayBounds(definition);
    const displayStep = definition.amountKind === "percentPoints"
        ? definition.step * 100
        : definition.step;
    const nextDisplayValue = quantizeToStep(
        clampNumber(baseDisplayValue + amount, displayBounds.min, displayBounds.max),
        displayBounds.min,
        displayStep,
    );
    return clampNumber(rawValueFromModDisplay(definition, nextDisplayValue), definition.min, definition.max);
}

function normalizedAmountFromPhysical(amount: number, minAmount: number, maxAmount: number) {
    if (Math.abs(amount) < 0.0000001) {
        return 0;
    }

    if (amount > 0) {
        return maxAmount > 0 ? clampNumber(amount / maxAmount, 0, 1) : 0;
    }

    return minAmount < 0 ? -clampNumber(Math.abs(amount) / Math.abs(minAmount), 0, 1) : 0;
}

function physicalAmountFromNormalized(normalized: number, minAmount: number, maxAmount: number) {
    const clampedNormalized = clampNumber(normalized, -1, 1);
    if (clampedNormalized >= 0) {
        return clampedNormalized * Math.max(0, maxAmount);
    }

    return clampedNormalized * Math.max(0, Math.abs(minAmount));
}

function formatModAmountValue(definition: ParamDefinition, amount: number) {
    const signed = (decimals: number) => formatSignedFixed(amount, decimals);
    switch (definition.amountKind) {
        case "cutoffOctaves":
            return `${formatSignedFixed(amount, 2)} oct`;
        case "integer": {
            const unit = definition.unit === "" ? "" : ` ${definition.unit}`;
            return `${formatSignedFixed(Math.round(amount), 0)}${unit}`;
        }
        case "db":
            return `${formatSignedFixed(amount, 1)} dB`;
        case "speed":
            return `${formatSignedFixed(amount, 2)}\u00d7`;
        case "percentPoints":
            return `${formatSignedFixed(Math.round(amount), 0)}%`;
        case "stutterShape":
            return formatSignedFixed(amount, 2);
        case "linear":
        default:
            switch (definition.unit) {
                case "cents": return `${signed(1)} cents`;
                case "degrees": return `${signed(0)}\u00b0`;
                case "Hz": return `${signed(2)} Hz`;
                case "ms": return `${signed(2)} ms`;
                case "Q": return `Q ${signed(2)}`;
                case "s": return `${signed(2)} s`;
                case "semitones": return `${signed(0)} semitones`;
                default: return signed(2);
            }
    }
}

function formatModDestinationValue(definition: ParamDefinition, value: number) {
    if (definition.amountKind === "stutterShape") {
        return formatStutterShapeLabel(value);
    }

    return formatSeqFxParameterValue(definition, value);
}

function SeqFxModToggleButton({
    aux,
    cyclePhase,
    amount,
    active,
    onClick,
}: {
    aux: SeqFxAuxState;
    cyclePhase: number;
    amount: number;
    active: boolean;
    onClick: () => void;
}) {
    const targetCount = enabledAuxTargetCount(aux);
    const path = useMemo(() => buildAuxSourcePreviewPath(aux.source), [aux.source.shape, aux.source.sourceCurve]);
    const phasePoint = auxSourceMonitorPoint(cyclePhase, amount);
    const targetWord = targetCount === 1 ? "target" : "targets";

    return (
        <button
            aria-label={`Edit modulation, shape ${aux.source.shape.toFixed(2)}, curve ${aux.source.sourceCurve.toFixed(2)}, ${targetCount} ${targetWord}`}
            aria-pressed={active}
            aria-selected={active}
            className={`seqfx-mod-toggle${active ? " is-selected" : ""}${targetCount > 0 ? " has-targets" : ""}`}
            data-role="seqfx-mod-toggle"
            onClick={onClick}
            role="tab"
            type="button"
        >
            <span className="seqfx-mod-toggle__label">Mod</span>
            <svg className="seqfx-mod-toggle__thumb" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true">
                <path data-role="seqfx-mod-thumbnail-path" d={path} />
                <circle
                    data-role="seqfx-mod-thumbnail-dot"
                    cx={phasePoint.x.toFixed(1)}
                    cy={phasePoint.y.toFixed(1)}
                    r="2.3"
                />
            </svg>
            <span className="seqfx-mod-toggle__badge" data-role="seqfx-mod-target-badge">{targetCount}</span>
        </button>
    );
}

function SeqFxModEditor({
    aux,
    cyclePhase,
    amount,
    params,
    definitions,
    onSourceChange,
    onTargetToggle,
    onTargetEndChange,
}: {
    aux: SeqFxAuxState;
    cyclePhase: number;
    amount: number;
    params: number[];
    definitions: ParamDefinition[];
    onSourceChange: (source: Partial<SeqFxAuxSource>) => void;
    onTargetToggle: (paramIndex: number) => void;
    onTargetEndChange: (paramIndex: number, value: number) => void;
}) {
    return (
        <div className="seqfx-mod-editor" data-role="seqfx-mod-editor">
            <AuxSource
                source={aux.source}
                cyclePhase={cyclePhase}
                amount={amount}
                onSourceChange={onSourceChange}
            />
            <div className="seqfx-mod-targets" data-role="seqfx-mod-targets">
                {definitions.map((definition) => {
                    const currentValue = clampNumber(Number(params[definition.index] ?? definition.min), definition.min, definition.max);
                    const target = aux.targets[definition.index];
                    const endValue = clampNumber(Number(target?.end ?? currentValue), definition.min, definition.max);
                    const enabled = target?.enabled === true;
                    const direction = enabled ? modulationDirectionForValues(currentValue, endValue) : "both";
                    const amountBounds = modAmountBounds(definition, currentValue);
                    const physicalAmount = modAmountFromTarget(definition, currentValue, endValue);
                    const normalizedAmount = normalizedAmountFromPhysical(physicalAmount, amountBounds.min, amountBounds.max);
                    const fillPosition = 50 + (normalizedAmount * 50);
                    const amountTrackStyle: SeqFxCSSProperties = {
                        "--mod-amount-fill-start": `${Math.min(50, fillPosition)}%`,
                        "--mod-amount-fill-end": `${Math.max(50, fillPosition)}%`,
                    };

                    return (
                        <div
                            className={`seqfx-mod-target-row${enabled ? " is-enabled" : ""}`}
                            data-param={definition.index}
                            data-role="seqfx-mod-target-row"
                            key={definition.index}
                        >
                            <span className="seqfx-mod-target-row__name">{definition.label}</span>
                            <button
                                aria-label={`Modulate ${definition.label}`}
                                aria-pressed={enabled}
                                className="seqfx-mod-target-row__toggle"
                                data-param={definition.index}
                                data-role="seqfx-mod-target-toggle"
                                onClick={() => onTargetToggle(definition.index)}
                                type="button"
                            >
                                <ModBadge isOn={enabled} direction={direction} />
                            </button>
                            {definition.kind === "select" && definition.options !== undefined ? (
                                <select
                                    aria-label={`${definition.label} modulation destination`}
                                    className="seqfx-mod-target-row__select"
                                    data-param={definition.index}
                                    data-role="seqfx-mod-target-destination"
                                    disabled={!enabled}
                                    onChange={(event) => onTargetEndChange(definition.index, Number(event.currentTarget.value))}
                                    value={Math.round(endValue)}
                                >
                                    {definition.options.map((option, index) => (
                                        <option key={option} value={index}>{option}</option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <span className="seqfx-mod-target-row__amount-control">
                                        <span className="seqfx-mod-target-row__zero" aria-hidden="true" />
                                        <input
                                            aria-label={`${definition.label} modulation amount`}
                                            aria-valuetext={`${formatModAmountValue(definition, physicalAmount)} to ${formatModDestinationValue(definition, endValue)}`}
                                            data-amount-current={physicalAmount}
                                            data-amount-max={amountBounds.max}
                                            data-amount-min={amountBounds.min}
                                            data-param={definition.index}
                                            data-role="seqfx-mod-target-amount"
                                            disabled={!enabled}
                                            max={1}
                                            min={-1}
                                            onChange={(event) => {
                                                const nextAmount = physicalAmountFromNormalized(Number(event.currentTarget.value), amountBounds.min, amountBounds.max);
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, nextAmount));
                                            }}
                                            onDoubleClick={(event) => {
                                                event.preventDefault();
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, 0));
                                            }}
                                            onInput={(event) => {
                                                const nextAmount = physicalAmountFromNormalized(Number(event.currentTarget.value), amountBounds.min, amountBounds.max);
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, nextAmount));
                                            }}
                                            step={0.000001}
                                            style={amountTrackStyle}
                                            type="range"
                                            value={normalizedAmount}
                                        />
                                    </span>
                                    <output
                                        className="seqfx-mod-target-row__amount-value"
                                        data-param={definition.index}
                                        data-role="seqfx-mod-target-amount-value"
                                    >
                                        {formatModAmountValue(definition, physicalAmount)}
                                    </output>
                                    <output
                                        className="seqfx-mod-target-row__destination"
                                        data-param={definition.index}
                                        data-role="seqfx-mod-target-destination"
                                    >
                                        {formatModDestinationValue(definition, endValue)}
                                    </output>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function paramAmountKind(effectType: SeqFxEffectType, definition: SeqFxParameterDefinition): ParamAmountKind {
    if (effectType === SEQFX_EFFECT_TYPES.stutter && definition.id === "shape") {
        return "stutterShape";
    }

    if (definition.unit === "Hz" && definition.scale === "log") {
        return "cutoffOctaves";
    }

    if (definition.unit === "dB") {
        return "db";
    }

    if (definition.unit === "%") {
        return "percentPoints";
    }

    if (definition.unit === "x") {
        return "speed";
    }

    if (definition.integer) {
        return "integer";
    }

    return "linear";
}

function paramDefinitionsForEffect(effectType: SeqFxEffectType): ParamDefinition[] {
    return getSeqFxEffectDefinition(effectType).parameters.map((definition, index) => ({
        ...definition,
        index,
        ...(definition.options ? { kind: "select" as const } : {}),
        amountKind: paramAmountKind(effectType, definition),
    }));
}

function SeqFxParameterField({
    definition,
    disabled,
    triggerLatched,
    value,
    onChange,
}: {
    definition: ParamDefinition;
    disabled: boolean;
    triggerLatched: boolean;
    value: number;
    onChange: (value: number) => void;
}) {
    const formattedValue = formatSeqFxParameterValue(definition, value);

    return (
        <label className="seqfx-field" data-section={definition.section}>
            <span className="seqfx-field__heading">
                {definition.label}
                {triggerLatched ? <em>Trigger</em> : null}
            </span>
            {definition.kind === "select" && definition.options !== undefined ? (
                <select
                    aria-label={definition.label}
                    data-role="seqfx-param"
                    data-param={definition.index}
                    disabled={disabled}
                    onChange={(event) => onChange(Number(event.currentTarget.value))}
                    value={Math.round(value)}
                >
                    {definition.options.map((option, index) => (
                        <option key={option} value={index}>{option}</option>
                    ))}
                </select>
            ) : (
                <span className="seqfx-field__number">
                    <input
                        aria-label={definition.label}
                        aria-valuetext={formattedValue}
                        data-role="seqfx-param"
                        data-param={definition.index}
                        disabled={disabled}
                        max={definition.max}
                        min={definition.min}
                        onChange={(event) => onChange(Number(event.currentTarget.value))}
                        step={definition.step}
                        type="number"
                        value={formatValue(value)}
                    />
                    <output data-param={definition.index} data-role="seqfx-param-value">
                        {formattedValue}
                    </output>
                </span>
            )}
            <small>
                {disabled
                    ? "Select one cell to edit this trigger."
                    : definition.hint ?? formatSeqFxParameterRange(definition)}
            </small>
        </label>
    );
}

function SeqFxBespokeEditor({
    children,
    parameterId,
    parameterLabel,
}: {
    children: ReactNode;
    parameterId: string;
    parameterLabel: string;
}) {
    return (
        <div className="seqfx-bespoke-editor" data-role="seqfx-bespoke-editor">
            <div
                aria-label={`${parameterLabel}: captured when the block triggers`}
                className="seqfx-bespoke-editor__trigger"
                data-param={parameterId}
                data-role="seqfx-bespoke-trigger"
                title={`${parameterLabel} is captured when the block triggers`}
            >
                <span>{parameterLabel}</span>
                {" "}
                <em>Trigger</em>
            </div>
            {children}
        </div>
    );
}

const FILTER_PARAM_MODE = 0;
const FILTER_PARAM_CUTOFF = 1;
const FILTER_PARAM_RESONANCE = 3;
const CRUSHER_PARAM_BITS = 0;
const CRUSHER_PARAM_RATE_HZ = 1;
const CRUSHER_PARAM_DRIVE_DB = 2;
const CRUSHER_PARAM_CHARACTER = 3;
const CRUSHER_PARAM_ADC_QUALITY = 4;
const CRUSHER_PARAM_DAC_QUALITY = 5;
const CRUSHER_PARAM_DITHER = 6;
const TAPE_STOP_PARAM_STOP_DIVISION = 0;
const TAPE_STOP_PARAM_CURVE = 1;
const TAPE_STOP_PARAM_RETURN = 2;
const TAPE_STOP_PARAM_START_DIVISION = 3;
const TAPE_STOP_PARAM_CHARACTER = 4;
const TAPE_STOP_PARAM_TIMING = 5;
const TAPE_STOP_PARAM_FREE_STOP_MS = 6;
const TAPE_STOP_PARAM_FREE_START_MS = 7;
const TAPE_STOP_TIMING_SYNC = 0;
const TAPE_STOP_TIMING_FREE = 1;
const STUTTER_PARAM_SLICES = 0;
const STUTTER_PARAM_SPEED = 1;
const STUTTER_PARAM_SHAPE = 2;
const STUTTER_PARAM_GATE = 3;
const PITCH_PARAM_SEMITONES = 0;
const PITCH_PARAM_FINE_CENTS = 1;
const PITCH_PARAM_GRAIN_MS = 2;
const COMB_PARAM_TUNE_HZ = 0;
const COMB_PARAM_DECAY_SECONDS = 1;
const COMB_PARAM_DISPERSION = 3;
const COMB_PARAM_DAMPING_HZ = 4;
const RING_PARAM_FREQUENCY = 0;
const RING_PARAM_WAVEFORM = 1;
const REVERSE_PARAM_DIVISION = 0;
const REVERSE_PARAM_CROSSFADE = 1;
const REVERSE_PARAM_TIMING_MODE = 2;
const REVERSE_PARAM_FREE_MS = 3;
const REVERSE_PARAM_DECAY = 4;
const TALK_BOX_PARAM_FROM_VOWEL = 0;
const TALK_BOX_PARAM_TO_VOWEL = 1;
const TALK_BOX_PARAM_MORPH = 2;
const VIBRO_PARAM_RATE_HZ = 0;
const VIBRO_PARAM_DEPTH_CENTS = 1;
const VIBRO_PARAM_WAVEFORM = 2;
const VIBRO_PARAM_SPREAD_DEGREES = 3;
const VIBRO_PARAM_TIMING_MODE = 4;
const VIBRO_PARAM_DIVISION = 5;
const FLANGE_PARAM_DELAY_MS = 0;
const FLANGE_PARAM_DEPTH_MS = 1;
const FLANGE_PARAM_RATE_HZ = 2;
const FLANGE_PARAM_TIMING_MODE = 6;
const FLANGE_PARAM_DIVISION = 7;
const DIRTY_PARAM_DRIVE_DB = 0;
const DIRTY_PARAM_CHARACTER = 1;
const DIRTY_PARAM_BIAS = 2;

type SeqFxBlockVisualSize = "single" | "medium" | "wide";

const RISO_BLOCK_CELL_VIEWBOX = 28;
const RISO_BLOCK_GAP_VIEWBOX = 3;

function risoBlockViewBoxWidth(segmentLength: number) {
    const cellCount = Math.max(1, Math.trunc(segmentLength));
    return (cellCount * RISO_BLOCK_CELL_VIEWBOX) + ((cellCount - 1) * RISO_BLOCK_GAP_VIEWBOX);
}

function risoBlockVisualSize(segmentLength: number): SeqFxBlockVisualSize {
    if (segmentLength <= 1) {
        return "single";
    }

    if (segmentLength <= 3) {
        return "medium";
    }

    return "wide";
}

function clampUnit(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}

function finiteOrFallback(value: number, fallback: number) {
    return Number.isFinite(value) ? value : fallback;
}

function cutoffToRisoX(cutoffHz: number, width: number) {
    const safeCutoff = Math.min(20_000, Math.max(20, finiteOrFallback(cutoffHz, 2_000)));
    const normalized = (Math.log10(safeCutoff) - Math.log10(20)) / (Math.log10(20_000) - Math.log10(20));
    const margin = width <= 28 ? 7 : Math.min(18, Math.max(9, width * 0.12));
    return margin + (clampUnit(normalized) * Math.max(1, width - (margin * 2)));
}

function roundedPathValue(value: number) {
    return Number(value.toFixed(2));
}

function filterGlyphLabel(mode: number) {
    const roundedMode = Math.round(Number(mode));
    if (roundedMode === 1) return "HP";
    if (roundedMode === 2) return "BP";
    return "LP";
}

function filterRisoPath(mode: number, cutoffHz: number, resonance: number, width: number) {
    const x = cutoffToRisoX(cutoffHz, width);
    const qNormalized = clampUnit((Number(resonance) - 0.1) / 5.5);
    const peakY = 2 + ((1 - qNormalized) * 4);
    const passY = width <= 28 ? 12 : 10;
    const shoulder = Math.min(Math.max(width * 0.12, 4), width <= 28 ? 7 : 18);
    const modeLabel = filterGlyphLabel(mode);

    if (modeLabel === "BP") {
        const halfWidth = Math.min(Math.max(width * (0.22 - (qNormalized * 0.11)), 5), width * 0.28);
        const left = Math.max(0, x - halfWidth);
        const right = Math.min(width, x + halfWidth);
        return `M${roundedPathValue(left)} 28 Q${roundedPathValue(x - halfWidth * 0.55)} 27 ${roundedPathValue(x - halfWidth * 0.35)} 22 Q${roundedPathValue(x - halfWidth * 0.16)} 14 ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + halfWidth * 0.16)} 14 ${roundedPathValue(x + halfWidth * 0.35)} 22 Q${roundedPathValue(x + halfWidth * 0.55)} 27 ${roundedPathValue(right)} 28 Z`;
    }

    if (modeLabel === "HP") {
        return `M0 28 Q${roundedPathValue(Math.max(1, x - shoulder * 2.2))} 27 ${roundedPathValue(Math.max(2, x - shoulder))} 22 Q${roundedPathValue(x - shoulder * 0.45)} 12 ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + shoulder * 0.38)} ${roundedPathValue(passY + 2)} ${roundedPathValue(x + shoulder)} ${roundedPathValue(passY)} Q${roundedPathValue(width - 6)} ${roundedPathValue(passY)} ${roundedPathValue(width)} ${roundedPathValue(passY)} L${roundedPathValue(width)} 28 Z`;
    }

    return `M0 28 L0 ${roundedPathValue(passY)} Q${roundedPathValue(Math.max(1, x - shoulder * 2.2))} ${roundedPathValue(passY)} ${roundedPathValue(Math.max(2, x - shoulder))} ${roundedPathValue(passY - 1)} Q${roundedPathValue(x - shoulder * 0.38)} ${roundedPathValue(passY - 2)} ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + shoulder * 0.45)} 12 ${roundedPathValue(x + shoulder)} 22 Q${roundedPathValue(width - 2)} 27 ${roundedPathValue(width)} 28 Z`;
}

function formatRisoCutoff(cutoffHz: number) {
    const cutoff = Math.min(20_000, Math.max(20, Math.round(finiteOrFallback(cutoffHz, 2_000))));
    if (cutoff >= 1000) {
        return `${Number((cutoff / 1000).toFixed(cutoff >= 10_000 ? 1 : 2))}k`;
    }

    return String(cutoff);
}

function formatRisoResonance(resonance: number) {
    return `q${Number(finiteOrFallback(resonance, 0).toFixed(2))}`;
}

function SeqFxFilterBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const mode = params[FILTER_PARAM_MODE] ?? 0;
    const cutoffHz = params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const resonance = params[FILTER_PARAM_RESONANCE] ?? 0.707;
    const modeLabel = filterGlyphLabel(mode);
    const markerX = roundedPathValue(cutoffToRisoX(cutoffHz, width));

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="filter"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={filterRisoPath(mode, cutoffHz, resonance, width)}
                    data-role="seqfx-block-glyph-ink"
                />
                <path
                    className="seqfx-block-glyph__marker"
                    d={`M${markerX} 0 V28`}
                    data-role="seqfx-block-glyph-marker"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {modeLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {formatRisoCutoff(cutoffHz)} · {formatRisoResonance(resonance)}
                </span>
            ) : null}
        </>
    );
}

function crusherStepCount(bits: number, rateHz: number) {
    const safeBits = Math.min(16, Math.max(2, Math.round(finiteOrFallback(bits, 8))));
    const safeRateHz = Math.min(48_000, Math.max(200, finiteOrFallback(rateHz, 48_000)));
    const rateNormalized = Math.log(safeRateHz / 200) / Math.log(48_000 / 200);
    return Math.max(2, Math.min(12, Math.round((safeBits * 0.5) + (rateNormalized * 6))));
}

function crusherRisoPath(bits: number, rateHz: number, driveDb: number, width: number) {
    const stepCount = crusherStepCount(bits, rateHz);
    const levelCount = Math.max(2, Math.round(finiteOrFallback(bits, 8)));
    const driveLift = clampUnit(finiteOrFallback(driveDb, 0) / 36) * 5;
    const stepWidth = width / stepCount;
    const tops = Array.from({ length: stepCount }, (_unused, index) => {
        const position = stepCount <= 1 ? 0 : index / (stepCount - 1);
        const wave = Math.sin(Math.PI * position);
        const quantized = Math.round(wave * (levelCount - 1)) / Math.max(1, levelCount - 1);
        return Math.max(3, 24 - (quantized * 18) - driveLift);
    });
    const commands = [`M0 28`, `L0 ${roundedPathValue(tops[0] ?? 22)}`];

    tops.forEach((top, index) => {
        const nextX = index === tops.length - 1 ? width : (index + 1) * stepWidth;
        commands.push(`L${roundedPathValue(nextX)} ${roundedPathValue(top)}`);
        if (index < tops.length - 1) {
            commands.push(`L${roundedPathValue(nextX)} ${roundedPathValue(tops[index + 1] ?? top)}`);
        }
    });

    commands.push(`L${roundedPathValue(width)} 28 Z`);
    return commands.join(" ");
}

function SeqFxCrusherBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const bits = Math.round(Number(params[CRUSHER_PARAM_BITS] ?? 8));
    const rateHz = Math.max(200, Number(params[CRUSHER_PARAM_RATE_HZ] ?? 48_000));
    const driveDb = Number(params[CRUSHER_PARAM_DRIVE_DB] ?? 0);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="crusher"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={crusherRisoPath(bits, rateHz, driveDb, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {bits} BIT
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {rateHz >= 1_000 ? `${(rateHz / 1_000).toFixed(rateHz >= 10_000 ? 0 : 1)}k` : Math.round(rateHz)} Hz · {formatSignedFixed(driveDb, 0)} dB
                </span>
            ) : null}
        </>
    );
}

function tapeStopRisoPath(returnMode: number, curve: number, width: number) {
    const curveControl = clampNumber(Number(curve), -1, 1);
    const controlX = roundedPathValue(width * (0.5 + (curveControl * 0.24)));
    if (Math.round(Number(returnMode)) === TAPE_STOP_RETURN_SPIN_UP) {
        return `M0 4 Q${controlX} 4 ${roundedPathValue(width * 0.62)} 24 Q${roundedPathValue(width * 0.84)} 24 ${roundedPathValue(width)} 4 L${roundedPathValue(width)} 28 L0 28 Z`;
    }

    return `M0 4 Q${controlX} 4 ${roundedPathValue(width)} 27 L${roundedPathValue(width)} 28 L0 28 Z`;
}

function tapeStopRisoLabel(returnMode: number) {
    return Math.round(Number(returnMode)) === TAPE_STOP_RETURN_SPIN_UP ? "SPIN" : "STOP";
}

function SeqFxTapeStopBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const returnMode = params[TAPE_STOP_PARAM_RETURN] ?? TAPE_STOP_RETURN_CROSSFADE_TO_LIVE;
    const curve = params[TAPE_STOP_PARAM_CURVE] ?? 0;
    const label = tapeStopRisoLabel(returnMode);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="tape"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={tapeStopRisoPath(returnMode, curve, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {label}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    C{Number(curve).toFixed(1)}
                </span>
            ) : null}
        </>
    );
}

function stutterEnvelopeHeight(shape: number, index: number, count: number) {
    const position = count <= 1 ? 0 : index / (count - 1);
    const normalizedShape = clampUnit(Number(shape));
    if (normalizedShape < 0.25) {
        return 0.86;
    }

    if (normalizedShape < 0.5) {
        return 1 - (Math.abs(position - 0.5) * 1.4);
    }

    if (normalizedShape < 0.75) {
        return Math.sin(Math.PI * position);
    }

    return 1 - (position * 0.8);
}

function shortStutterShapeLabel(shape: number) {
    const label = formatStutterShapeLabel(shape).split(" -> ")[0]?.split(" (")[0] ?? "Gate";
    if (label === "Ramp Down") return "DECAY";
    if (label === "Ramp Up") return "SWELL";
    return label.toUpperCase();
}

function SeqFxStutterBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const slices = Math.min(32, Math.max(2, Math.round(Number(params[STUTTER_PARAM_SLICES] ?? 8))));
    const shape = Number(params[STUTTER_PARAM_SHAPE] ?? 0);
    const gap = slices > 20 ? 0.8 : slices > 12 ? 1.2 : 2;
    const barWidth = Math.max(0.7, (width - ((slices + 1) * gap)) / slices);
    const bars = Array.from({ length: slices }, (_unused, index) => {
        const height = Math.max(3, stutterEnvelopeHeight(shape, index, slices) * 22);
        return {
            height,
            x: gap + (index * (barWidth + gap)),
            y: 26 - height,
        };
    });
    const shapeLabel = shortStutterShapeLabel(shape);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="stutter"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <g className="seqfx-block-glyph__ink">
                    {bars.map((bar, index) => (
                        <rect
                            data-role="seqfx-block-glyph-rect"
                            height={roundedPathValue(bar.height)}
                            key={index}
                            width={roundedPathValue(barWidth)}
                            x={roundedPathValue(bar.x)}
                            y={roundedPathValue(bar.y)}
                        />
                    ))}
                </g>
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    x{slices}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    x{slices} {shapeLabel}
                </span>
            ) : null}
        </>
    );
}

function pitchGrainRisoPath(width: number, phaseOffset: number, semitones: number) {
    const pitchTilt = clampNumber(semitones, -24, 24) / 24;
    return Array.from({ length: 65 }, (_unused, index) => {
        const normalized = index / 64;
        const phase = (normalized + phaseOffset) % 1;
        const envelope = Math.sin(Math.PI * phase) ** 2;
        const tilt = pitchTilt * (normalized - 0.5) * 5;
        const y = clampNumber(24 - (envelope * 18) - tilt, 2, 26);
        return `${index === 0 ? "M" : "L"}${roundedPathValue(normalized * width)} ${roundedPathValue(y)}`;
    }).join(" ");
}

function SeqFxPitchBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const semitones = Number(params[PITCH_PARAM_SEMITONES] ?? 0);
    const fineCents = Number(params[PITCH_PARAM_FINE_CENTS] ?? 0);
    const grainMs = Number(params[PITCH_PARAM_GRAIN_MS] ?? 48);
    const pitchLabel = `${semitones >= 0 ? "+" : ""}${Math.round(semitones)} ST`;

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="pitch"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={pitchGrainRisoPath(width, 0, semitones)}
                    data-role="seqfx-block-glyph-line"
                />
                <path
                    className="seqfx-block-glyph__line seqfx-block-glyph__line--secondary"
                    d={pitchGrainRisoPath(width, 0.5, semitones)}
                    data-role="seqfx-block-glyph-secondary-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {pitchLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {Number(grainMs.toFixed(1))} MS · {formatSignedFixed(fineCents, 0)}¢
                </span>
            ) : null}
        </>
    );
}

function combRisoPath(tuneHz: number, dispersion: number, dampingHz: number, width: number) {
    const safeTune = clampNumber(Number(tuneHz), 30, 8_000);
    const safeDispersion = clampUnit(Number(dispersion));
    const safeDamping = clampNumber(Number(dampingHz), 500, 20_000);
    const tunePosition = Math.log(safeTune / 30) / Math.log(8_000 / 30);
    const toothCount = Math.max(3, Math.min(12, Math.round(3 + (tunePosition * 9))));
    const commands = [`M0 8`];
    for (let tooth = 0; tooth < toothCount; tooth += 1) {
        const center = ((tooth + 0.5) / toothCount) * width;
        const spacing = width / toothCount;
        const bend = Math.sin((tooth + 1) * 2.17) * spacing * 0.16 * safeDispersion;
        const x = clampNumber(center + bend, 0, width);
        const highLoss = tooth / Math.max(1, toothCount - 1);
        const dampingAmount = 1 - (Math.log(safeDamping / 500) / Math.log(20_000 / 500));
        const depth = Math.max(5, 19 - (highLoss * dampingAmount * 10));
        const halfWidth = Math.max(0.8, spacing * (0.1 + (safeDispersion * 0.08)));
        commands.push(
            `L${roundedPathValue(Math.max(0, x - halfWidth))} 8`,
            `L${roundedPathValue(x)} ${roundedPathValue(8 + depth)}`,
            `L${roundedPathValue(Math.min(width, x + halfWidth))} 8`,
        );
    }
    commands.push(`L${roundedPathValue(width)} 8`);
    return commands.join(" ");
}

function SeqFxCombBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const tuneHz = Number(params[COMB_PARAM_TUNE_HZ] ?? 220);
    const decaySeconds = Number(params[COMB_PARAM_DECAY_SECONDS] ?? 1.4);
    const dispersion = Number(params[COMB_PARAM_DISPERSION] ?? 0.55);
    const dampingHz = Number(params[COMB_PARAM_DAMPING_HZ] ?? 20_000);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="comb"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={combRisoPath(tuneHz, dispersion, dampingHz, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {formatRisoCutoff(tuneHz)} HZ
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {Number(decaySeconds.toFixed(2))} s · {Math.round(clampUnit(dispersion) * 100)}%
                </span>
            ) : null}
        </>
    );
}

function ringRisoPath(waveform: number, frequencyHz: number, width: number) {
    const safeFrequency = clampNumber(Number(frequencyHz), 0.1, 12_000);
    const cycles = Math.max(1, Math.min(8, Math.round(1 + (Math.log10(safeFrequency / 0.1) / Math.log10(120_000)) * 7)));
    const points = Array.from({ length: 65 }, (_unused, index) => {
        const phase = (index / 64) * cycles;
        const wrapped = phase - Math.floor(phase);
        let carrier = Math.sin(phase * Math.PI * 2);
        if (waveform === 1) carrier = 1 - (4 * Math.abs(wrapped - 0.5));
        if (waveform === 2) carrier = wrapped < 0.5 ? 1 : -1;
        if (waveform === 3) carrier = Math.sin((index * 12.9898) + 78.233) * 0.82;
        return `${index === 0 ? "M" : "L"}${roundedPathValue((index / 64) * width)} ${roundedPathValue(14 - (carrier * 10))}`;
    });
    return points.join(" ");
}

function SeqFxRingBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const frequencyHz = Number(params[RING_PARAM_FREQUENCY] ?? 180);
    const waveform = Math.round(Number(params[RING_PARAM_WAVEFORM] ?? 0));
    const waveformLabel = ["SIN", "TRI", "SQR", "NOISE"][waveform] ?? "SIN";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="ring"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={ringRisoPath(waveform, frequencyHz, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {waveformLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {frequencyHz >= 1_000 ? `${(frequencyHz / 1_000).toFixed(1)}k` : Number(frequencyHz.toFixed(1))} Hz
                </span>
            ) : null}
        </>
    );
}

function reverseRisoPath(width: number, decay: number) {
    const decayPoint = clampNumber(Number(decay), 0, 1);
    return Array.from({ length: 65 }, (_unused, index) => {
        const normalized = index / 64;
        const reversePhase = (1 - normalized) * Math.PI * 6;
        const decayEnvelope = decayPoint >= 0.999
            ? 1
            : clampNumber((decayPoint - normalized) / 0.12, 0, 1);
        const wave = Math.sin(reversePhase) * decayEnvelope;
        return `${index === 0 ? "M" : "L"}${roundedPathValue(normalized * width)} ${roundedPathValue(13 - (wave * 8))}`;
    }).join(" ");
}

function SeqFxReverseBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const division = Math.round(Number(params[REVERSE_PARAM_DIVISION] ?? 4));
    const crossfade = clampNumber(Number(params[REVERSE_PARAM_CROSSFADE] ?? 0.08), 0, 0.25);
    const timingMode = Math.round(Number(params[REVERSE_PARAM_TIMING_MODE] ?? 0));
    const freeMs = clampNumber(Number(params[REVERSE_PARAM_FREE_MS] ?? 250), 20, 4_000);
    const decay = clampNumber(Number(params[REVERSE_PARAM_DECAY] ?? 1), 0, 1);
    const syncLabels = ["1/32", "1/16", "1/8", "1/4", "1 CELL"];
    const lengthLabel = timingMode === 1
        ? `${Math.round(freeMs)} ms`
        : (syncLabels[division] ?? "1 CELL");
    const arrowY = 25;

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="reverse"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={reverseRisoPath(width, decay)}
                    data-role="seqfx-block-glyph-line"
                />
                <path
                    className="seqfx-block-glyph__secondary-line"
                    d={`M${roundedPathValue(width - 2)} ${arrowY} L2 ${arrowY} M2 ${arrowY} L${roundedPathValue(5 + (crossfade * 10))} 22 M2 ${arrowY} L${roundedPathValue(5 + (crossfade * 10))} 28`}
                    data-role="seqfx-block-glyph-secondary-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    REV
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {lengthLabel}
                </span>
            ) : null}
        </>
    );
}

function talkBoxRisoPath(firstHz: number, secondHz: number, resonance: number, width: number) {
    const firstX = cutoffToRisoX(firstHz, width);
    const secondX = cutoffToRisoX(secondHz, width);
    const q = clampNumber(Number(resonance), 1, 20);
    const peakWidth = Math.max(1.25, width * (0.12 - (0.075 * ((q - 1) / 19))));
    const points = Array.from({ length: 65 }, (_unused, index) => {
        const x = (index / 64) * width;
        const firstPeak = 1 / (1 + (((x - firstX) / peakWidth) ** 2));
        const secondPeak = 1 / (1 + (((x - secondX) / peakWidth) ** 2));
        const response = Math.min(1, (firstPeak * 0.88) + secondPeak);
        return `${index === 0 ? "M" : "L"}${roundedPathValue(x)} ${roundedPathValue(25 - (response * 21))}`;
    });
    return `${points.join(" ")} L${roundedPathValue(width)} 28 L0 28 Z`;
}

function SeqFxTalkBoxBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const fromVowel = Number(params[TALK_BOX_PARAM_FROM_VOWEL] ?? 0);
    const toVowel = Number(params[TALK_BOX_PARAM_TO_VOWEL] ?? 3);
    const morph = Number(params[TALK_BOX_PARAM_MORPH] ?? 0);
    const resonance = Number(params[3] ?? 6);
    const formants = resolveTalkBoxFormants(fromVowel, toVowel, morph);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="talk-box"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={talkBoxRisoPath(formants.firstHz, formants.secondHz, resonance, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {formatTalkBoxVowelPair(fromVowel, toVowel)}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {Math.round(formants.firstHz)} / {Math.round(formants.secondHz)} Hz
                </span>
            ) : null}
        </>
    );
}

function vibroRisoPath(waveform: number, phaseOffset: number, width: number) {
    const cycles = width <= 28 ? 1.5 : Math.min(5, Math.max(2, width / 42));
    return Array.from({ length: 65 }, (_unused, index) => {
        const phase = ((index / 64) * cycles) + phaseOffset;
        const wrapped = phase - Math.floor(phase);
        const wave = waveform === 1
            ? 1 - (4 * Math.abs(wrapped - 0.5))
            : Math.sin(phase * Math.PI * 2);
        return `${index === 0 ? "M" : "L"}${roundedPathValue((index / 64) * width)} ${roundedPathValue(14 - (wave * 8))}`;
    }).join(" ");
}

function SeqFxVibroBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const rateHz = Number(params[VIBRO_PARAM_RATE_HZ] ?? 4.5);
    const depthCents = Number(params[VIBRO_PARAM_DEPTH_CENTS] ?? 28);
    const waveform = Math.round(Number(params[VIBRO_PARAM_WAVEFORM] ?? 0));
    const spreadDegrees = Number(params[VIBRO_PARAM_SPREAD_DEGREES] ?? 90);
    const timingMode = Math.round(Number(params[VIBRO_PARAM_TIMING_MODE] ?? 0));
    const division = Math.round(Number(params[VIBRO_PARAM_DIVISION] ?? 2));
    const divisionLabel = ["1/32", "1/16", "1/8", "1/4", "1/2", "1 BAR"][division] ?? "1/8";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="vibro"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={vibroRisoPath(waveform, 0, width)}
                    data-role="seqfx-block-glyph-line"
                />
                <path
                    className="seqfx-block-glyph__line seqfx-block-glyph__line--secondary"
                    d={vibroRisoPath(waveform, clampNumber(spreadDegrees, 0, 180) / 360, width)}
                    data-role="seqfx-block-glyph-secondary-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {Number(depthCents.toFixed(1))}¢
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {timingMode === 0 ? `${divisionLabel} SYNC` : `${Number(rateHz.toFixed(2))} Hz`}
                </span>
            ) : null}
        </>
    );
}

function flangeRisoPath(delayMs: number, width: number) {
    const safeDelaySeconds = clampNumber(delayMs, 0.2, 20) * 0.001;
    return Array.from({ length: 65 }, (_unused, index) => {
        const normalized = index / 64;
        const frequencyHz = 20 * (1_000 ** normalized);
        const response = Math.abs(Math.cos(Math.PI * frequencyHz * safeDelaySeconds));
        return `${index === 0 ? "M" : "L"}${roundedPathValue(normalized * width)} ${roundedPathValue(24 - (response * 18))}`;
    }).join(" ");
}

function SeqFxFlangeBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const delayMs = Number(params[FLANGE_PARAM_DELAY_MS] ?? 1.2);
    const depthMs = Number(params[FLANGE_PARAM_DEPTH_MS] ?? 3.5);
    const rateHz = Number(params[FLANGE_PARAM_RATE_HZ] ?? 0.28);
    const timingMode = Math.round(Number(params[FLANGE_PARAM_TIMING_MODE] ?? 1));
    const division = Math.round(Number(params[FLANGE_PARAM_DIVISION] ?? 5));
    const divisionLabel = ["1/16", "1/8", "1/4", "1/2", "1 BAR", "2 BARS", "4 BARS"][division] ?? "2 BARS";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="flange"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={flangeRisoPath(delayMs, width)}
                    data-role="seqfx-block-glyph-line"
                />
                <path
                    className="seqfx-block-glyph__line seqfx-block-glyph__line--secondary"
                    d={flangeRisoPath(delayMs + depthMs, width)}
                    data-role="seqfx-block-glyph-secondary-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {Number(delayMs.toFixed(1))}+{Number(depthMs.toFixed(1))} MS
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {timingMode === 0 ? `${divisionLabel} SYNC` : `${Number(rateHz.toFixed(2))} Hz`}
                </span>
            ) : null}
        </>
    );
}

function dirtyTransferSample(input: number, character: number, bias: number, driveDb: number) {
    const soft = (value: number) => value / Math.sqrt(1 + (value * value));
    const fold = (value: number) => {
        const wrapped = value - (4 * Math.floor((value + 2) / 4));
        if (wrapped > 1) return 2 - wrapped;
        if (wrapped < -1) return -2 - wrapped;
        return wrapped;
    };
    const shape = (value: number) => {
        if (character === 1) return clampNumber(value, -1, 1);
        if (character === 2) return fold(value);
        if (character === 3) return soft(value + 0.22) - soft(0.22);
        return soft(value);
    };
    const offset = clampNumber(bias, -1, 1) * 0.5;
    const driven = input * (10 ** (clampNumber(driveDb, 0, 36) / 20));
    return clampNumber(shape(driven + offset) - shape(offset), -1.25, 1.25);
}

function dirtyRisoPath(character: number, bias: number, driveDb: number, width: number) {
    return Array.from({ length: 65 }, (_unused, index) => {
        const input = ((index / 64) * 2) - 1;
        const output = dirtyTransferSample(input, character, bias, driveDb);
        const x = (index / 64) * width;
        const y = 14 - ((output / 1.25) * 11);
        return `${index === 0 ? "M" : "L"}${roundedPathValue(x)} ${roundedPathValue(y)}`;
    }).join(" ");
}

function SeqFxDirtyBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const driveDb = Number(params[DIRTY_PARAM_DRIVE_DB] ?? 12);
    const character = Math.round(Number(params[DIRTY_PARAM_CHARACTER] ?? 0));
    const bias = Number(params[DIRTY_PARAM_BIAS] ?? 0);
    const characterLabel = ["SOFT", "HARD", "FOLD", "BIAS"][character] ?? "SOFT";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="dirty"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={dirtyRisoPath(character, bias, driveDb, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {characterLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {formatSignedFixed(driveDb, 0)} dB
                </span>
            ) : null}
        </>
    );
}

export function SeqFxBlockGlyph({
    effectType,
    params,
    segmentLength,
}: {
    effectType: SeqFxEffectType;
    params: number[];
    segmentLength: number;
}) {
    const size = risoBlockVisualSize(segmentLength);
    const width = risoBlockViewBoxWidth(segmentLength);

    switch (effectType) {
        case SEQFX_EFFECT_TYPES.filter:
            return <SeqFxFilterBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.crusher:
            return <SeqFxCrusherBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.tapeStop:
            return <SeqFxTapeStopBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.stutter:
            return <SeqFxStutterBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.pitch:
            return <SeqFxPitchBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.comb:
            return <SeqFxCombBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.ring:
            return <SeqFxRingBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.reverse:
            return <SeqFxReverseBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.talkBox:
            return <SeqFxTalkBoxBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.vibro:
            return <SeqFxVibroBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.flange:
            return <SeqFxFlangeBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.dirty:
            return <SeqFxDirtyBlockGlyph params={params} size={size} width={width} />;
        default:
            return null;
    }
}

const SEQFX_FILTER_MODE_OPTIONS: FilterRangeModeOption[] = [
    { label: "LP", value: "lowpass" },
    { label: "HP", value: "highpass" },
    { label: "BP", value: "bandpass" },
];

function seqFxFilterModeToRangeMode(mode: number): FilterRangeMode {
    const roundedMode = Math.round(mode);
    if (roundedMode === 1) return "highpass";
    if (roundedMode === 2) return "bandpass";
    return "lowpass";
}

function filterRangeModeToSeqFxMode(mode: FilterRangeMode) {
    if (mode === "highpass") return 1;
    if (mode === "bandpass") return 2;
    return 0;
}

function filterRangeValueFromSeqFxStep(step: SeqFxStep): FilterRangeValue {
    const startCutoffHz = step.params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const cutoffTarget = step.aux.targets[FILTER_PARAM_CUTOFF];
    const endCutoffHz = cutoffTarget?.enabled ? cutoffTarget.end : startCutoffHz;

    return {
        mode: seqFxFilterModeToRangeMode(step.params[FILTER_PARAM_MODE] ?? 0),
        cutoffHz: geometricCenterCutoffHz(startCutoffHz, endCutoffHz),
        q: step.params[FILTER_PARAM_RESONANCE] ?? 0.707,
    };
}

function filterRangeEndpointsFromSeqFxStep(step: SeqFxStep): FilterRangeEndpoints {
    const startCutoffHz = step.params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const cutoffTarget = step.aux.targets[FILTER_PARAM_CUTOFF];
    return {
        startCutoffHz,
        endCutoffHz: cutoffTarget?.enabled ? cutoffTarget.end : startCutoffHz,
    };
}

function crusherValueFromSeqFxStep(step: SeqFxStep) {
    return {
        bits: step.params[CRUSHER_PARAM_BITS],
        rateHz: step.params[CRUSHER_PARAM_RATE_HZ],
        driveDb: step.params[CRUSHER_PARAM_DRIVE_DB],
        character: step.params[CRUSHER_PARAM_CHARACTER],
        adcQuality: step.params[CRUSHER_PARAM_ADC_QUALITY],
        dacQuality: step.params[CRUSHER_PARAM_DAC_QUALITY],
        dither: step.params[CRUSHER_PARAM_DITHER],
        mix: step.mix,
    };
}

function stutterValueFromSeqFxStep(step: SeqFxStep) {
    return {
        slices: step.params[STUTTER_PARAM_SLICES],
        speed: step.params[STUTTER_PARAM_SPEED],
        shape: step.params[STUTTER_PARAM_SHAPE],
        gate: step.params[STUTTER_PARAM_GATE],
    };
}

function buildStepNumbers() {
    return Array.from({ length: SEQFX_STEP_COUNT }, (_unused, index) => index);
}

const STEP_NUMBERS = buildStepNumbers();
const SEQFX_RATE_CELLS_PER_BEAT = [2, 4, 8] as const;
const SEQFX_BEATS_PER_BAR = 4;
const SEQFX_GRID_STEPS_PER_ROW = 16;
const SEQFX_GRID_BAR_COUNT = Math.ceil(SEQFX_STEP_COUNT / SEQFX_GRID_STEPS_PER_ROW);
const STEP_BARS = Array.from({ length: SEQFX_GRID_BAR_COUNT }, (_unused, barIndex) => (
    STEP_NUMBERS.slice(barIndex * SEQFX_GRID_STEPS_PER_ROW, (barIndex + 1) * SEQFX_GRID_STEPS_PER_ROW)
));
const SEQFX_BAR_FRAME_INNER_GAP_PX = 8;
const SEQFX_BAR_FRAME_GAP_PX = 8;
const SEQFX_BAR_FRAME_NUMBER_BAND_PX = 20;
const SEQFX_BAR_FRAME_ARROW_HEIGHT_PX = 25;
const SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX = 12;
const SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX = 4;
const SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX = 4;
const SEQFX_BAR_FRAME_BEVEL_PX = 12;
const SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX = SEQFX_BAR_FRAME_BEVEL_PX
    + (SEQFX_BAR_FRAME_GAP_PX * (2 - Math.SQRT2));
const SEQFX_BAR_FRAME_STROKE_INSET_PX = 1;
const SEQFX_GRID_SHELL_PADDING_TOP_PX = 24;
const SEQFX_STEP_NUMBER_HEIGHT_PX = 9;
const SEQFX_STEP_HEADER_GAP_PX = 12;
const SEQFX_INSPECTOR_TOP_ALIGN_OFFSET_PX = SEQFX_GRID_SHELL_PADDING_TOP_PX
    + SEQFX_STEP_NUMBER_HEIGHT_PX
    + SEQFX_STEP_HEADER_GAP_PX
    - (SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX + SEQFX_BAR_FRAME_INNER_GAP_PX)
    + SEQFX_BAR_FRAME_STROKE_INSET_PX;
const SEQFX_WORKSPACE_STYLE: SeqFxCSSProperties = {
    "--seqfx-grid-shell-padding-top": `${SEQFX_GRID_SHELL_PADDING_TOP_PX}px`,
    "--seqfx-inspector-top-align-offset": `${SEQFX_INSPECTOR_TOP_ALIGN_OFFSET_PX}px`,
    "--seqfx-step-header-gap": `${SEQFX_STEP_HEADER_GAP_PX}px`,
    "--seqfx-step-number-height": `${SEQFX_STEP_NUMBER_HEIGHT_PX}px`,
};

function cellsPerBeatForRateIndex(rateIndex: number) {
    return SEQFX_RATE_CELLS_PER_BEAT[Math.min(2, Math.max(0, Math.round(rateIndex)))] ?? 4;
}

function gridColumnForStep(step: number) {
    const clampedStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step));
    return ((clampedStep % SEQFX_GRID_STEPS_PER_ROW) * 2) + 1;
}

function gridRowForStep(step: number) {
    return 1;
}

function barIndexForStep(step: number) {
    const clampedStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step));
    return Math.floor(clampedStep / SEQFX_GRID_STEPS_PER_ROW);
}

function laneTrackRefKey(lane: number, barIndex: number) {
    return `${lane}:${barIndex}`;
}

function cellRefKey(lane: number, step: number) {
    return `${lane}:${step}`;
}

function frameCornerClassNames(lane: number, barIndex: number, startStep: number, endStep: number) {
    if (barIndex < 0 || barIndex >= SEQFX_GRID_BAR_COUNT) {
        return [];
    }

    const classNames: string[] = [];
    const lastLane = SEQFX_LANE_NAMES.length - 1;
    const firstStepInFrame = barIndex * SEQFX_GRID_STEPS_PER_ROW;
    const lastStepInFrame = SEQFX_GRID_STEPS_PER_ROW - 1;
    const localStartStep = startStep - firstStepInFrame;
    const localEndStep = endStep - firstStepInFrame;

    if (lane === 0 && localStartStep === 0) {
        classNames.push("has-frame-corner-tl");
    }

    if (lane === 0 && localEndStep === lastStepInFrame) {
        classNames.push("has-frame-corner-tr");
    }

    if (lane === lastLane && localStartStep === 0) {
        classNames.push("has-frame-corner-bl");
    }

    if (lane === lastLane && localEndStep === lastStepInFrame) {
        classNames.push("has-frame-corner-br");
    }

    return classNames;
}

function buildBeveledRectPath(left: number, top: number, right: number, bottom: number, bevel: number) {
    return [
        `M ${left + bevel} ${top}`,
        `L ${right - bevel} ${top}`,
        `L ${right} ${top + bevel}`,
        `L ${right} ${bottom - bevel}`,
        `L ${right - bevel} ${bottom}`,
        `L ${left + bevel} ${bottom}`,
        `L ${left} ${bottom - bevel}`,
        `L ${left} ${top + bevel}`,
        "Z",
    ].join(" ");
}

function buildOuterFrameBodyPath(
    left: number,
    top: number,
    right: number,
    bottom: number,
    topBevel: number,
    bottomBevel: number,
    centerX: number,
) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;

    return [
        `M ${shaftRight} ${bottom}`,
        `L ${right - bottomBevel} ${bottom}`,
        `L ${right} ${bottom - bottomBevel}`,
        `L ${right} ${top + topBevel}`,
        `L ${right - topBevel} ${top}`,
        `L ${left + topBevel} ${top}`,
        `L ${left} ${top + topBevel}`,
        `L ${left} ${bottom - bottomBevel}`,
        `L ${left + bottomBevel} ${bottom}`,
        `L ${shaftLeft} ${bottom}`,
    ].join(" ");
}

function buildOuterFrameClosedPath(
    left: number,
    top: number,
    right: number,
    bottom: number,
    topBevel: number,
    bottomBevel: number,
) {
    return [
        `M ${left + topBevel} ${top}`,
        `L ${right - topBevel} ${top}`,
        `L ${right} ${top + topBevel}`,
        `L ${right} ${bottom - bottomBevel}`,
        `L ${right - bottomBevel} ${bottom}`,
        `L ${left + bottomBevel} ${bottom}`,
        `L ${left} ${bottom - bottomBevel}`,
        `L ${left} ${top + topBevel}`,
        "Z",
    ].join(" ");
}

function buildOuterFrameArrowPath(bottom: number, centerX: number) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const arrowLeft = centerX - SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const arrowRight = centerX + SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const shaftBottom = bottom + SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX;
    const arrowTipY = bottom + SEQFX_BAR_FRAME_ARROW_HEIGHT_PX;

    return [
        `M ${shaftLeft} ${bottom}`,
        `L ${shaftLeft} ${shaftBottom}`,
        `L ${arrowLeft} ${shaftBottom}`,
        `L ${centerX} ${arrowTipY}`,
        `L ${arrowRight} ${shaftBottom}`,
        `L ${shaftRight} ${shaftBottom}`,
        `L ${shaftRight} ${bottom}`,
    ].join(" ");
}

function buildFramePlatePath(
    outerLeft: number,
    outerTop: number,
    outerRight: number,
    outerBottom: number,
    outerTopBevel: number,
    outerBottomBevel: number,
    centerX: number,
    innerLeft: number,
    innerTop: number,
    innerRight: number,
    innerBottom: number,
    innerBevel: number,
    hasArrow: boolean,
) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const arrowLeft = centerX - SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const arrowRight = centerX + SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const shaftBottom = outerBottom + SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX;
    const arrowTipY = outerBottom + SEQFX_BAR_FRAME_ARROW_HEIGHT_PX;

    const outerSilhouette = hasArrow
        ? [
            `M ${shaftRight} ${outerBottom}`,
            `L ${outerRight - outerBottomBevel} ${outerBottom}`,
            `L ${outerRight} ${outerBottom - outerBottomBevel}`,
            `L ${outerRight} ${outerTop + outerTopBevel}`,
            `L ${outerRight - outerTopBevel} ${outerTop}`,
            `L ${outerLeft + outerTopBevel} ${outerTop}`,
            `L ${outerLeft} ${outerTop + outerTopBevel}`,
            `L ${outerLeft} ${outerBottom - outerBottomBevel}`,
            `L ${outerLeft + outerBottomBevel} ${outerBottom}`,
            `L ${shaftLeft} ${outerBottom}`,
            `L ${shaftLeft} ${shaftBottom}`,
            `L ${arrowLeft} ${shaftBottom}`,
            `L ${centerX} ${arrowTipY}`,
            `L ${arrowRight} ${shaftBottom}`,
            `L ${shaftRight} ${shaftBottom}`,
            "Z",
        ].join(" ")
        : buildOuterFrameClosedPath(
            outerLeft,
            outerTop,
            outerRight,
            outerBottom,
            outerTopBevel,
            outerBottomBevel,
        );

    return `${outerSilhouette} ${buildBeveledRectPath(innerLeft, innerTop, innerRight, innerBottom, innerBevel)}`;
}

function SeqFxBarFrame({ barIndex, hasArrow }: { barIndex: number; hasArrow: boolean }) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const [cellStackSize, setCellStackSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const cellStack = frameRef.current?.parentElement;
        if (!cellStack) {
            return;
        }

        const update = () => {
            const bounds = cellStack.getBoundingClientRect();
            setCellStackSize({
                width: Math.max(1, finiteOrFallback(bounds.width, 1)),
                height: Math.max(1, finiteOrFallback(bounds.height, 1)),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(cellStack);
        const updateOnResize = () => {
            update();
            requestAnimationFrame(update);
        };
        window.addEventListener("resize", updateOnResize);
        update();

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateOnResize);
        };
    }, []);

    const frameLeft = -(SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX);
    const frameTop = -(SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX + SEQFX_BAR_FRAME_INNER_GAP_PX);
    const frameWidth = cellStackSize.width + (2 * (SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX));
    const outerBottom = SEQFX_BAR_FRAME_NUMBER_BAND_PX
        + SEQFX_BAR_FRAME_GAP_PX
        + SEQFX_BAR_FRAME_INNER_GAP_PX
        + cellStackSize.height
        + SEQFX_BAR_FRAME_INNER_GAP_PX
        + SEQFX_BAR_FRAME_GAP_PX;
    const frameHeight = outerBottom + (hasArrow ? SEQFX_BAR_FRAME_ARROW_HEIGHT_PX : 0) + SEQFX_BAR_FRAME_STROKE_INSET_PX;
    const innerLeft = SEQFX_BAR_FRAME_GAP_PX;
    const innerTop = SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX;
    const innerRight = innerLeft + (2 * SEQFX_BAR_FRAME_INNER_GAP_PX) + cellStackSize.width;
    const innerBottom = innerTop + (2 * SEQFX_BAR_FRAME_INNER_GAP_PX) + cellStackSize.height;
    const outerLeft = innerLeft - SEQFX_BAR_FRAME_GAP_PX;
    const outerTop = SEQFX_BAR_FRAME_STROKE_INSET_PX;
    const outerRight = innerRight + SEQFX_BAR_FRAME_GAP_PX;
    const visibleOuterBottom = innerBottom + SEQFX_BAR_FRAME_GAP_PX;
    const centerX = frameWidth * 0.5;
    const cornerGlyphs = [
        {
            key: "tl",
            x: outerLeft + 14,
            y: outerTop + 14,
            rotate: -45,
            paths: ["M -5 -2.5 L 0 -2.5 L 0 2.5 L 5 2.5", "M -5 2.5 L -2.5 2.5", "M 2.5 -2.5 L 5 -2.5"],
        },
        {
            key: "tr",
            accent: true,
            x: outerRight - 14,
            y: outerTop + 14,
            rotate: 45,
            paths: ["M -5 0 L -1.5 0 L 0 -2.5 L 1.5 0 L 5 0", "M -3 3 L 3 3"],
        },
        {
            key: "br",
            x: outerRight - 14,
            y: visibleOuterBottom - 14,
            rotate: 135,
            paths: ["M -5 -3 L 5 -3", "M -5 0 L 5 0", "M -5 3 L 5 3"],
        },
        {
            key: "bl",
            x: outerLeft + 14,
            y: visibleOuterBottom - 14,
            rotate: -135,
            paths: ["M -5 -2.5 L -1.5 -2.5 L 1.5 2.5 L 5 2.5", "M -5 2.5 L -2.5 2.5", "M 2.5 -2.5 L 5 -2.5"],
        },
    ];
    const platePath = buildFramePlatePath(
        outerLeft,
        outerTop,
        outerRight,
        visibleOuterBottom,
        SEQFX_BAR_FRAME_BEVEL_PX,
        SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
        centerX,
        innerLeft,
        innerTop,
        innerRight,
        innerBottom,
        SEQFX_BAR_FRAME_BEVEL_PX,
        hasArrow,
    );
    const plateFilterId = `seqfx-bar-frame-plate-material-${barIndex}`;

    return (
        <div
            className="seqfx-bar-frame"
            data-bar={barIndex}
            data-has-arrow={hasArrow ? "true" : "false"}
            data-role="seqfx-bar-frame"
            ref={frameRef}
            style={{
                height: frameHeight,
                left: frameLeft,
                top: frameTop,
                width: `calc(100% + ${2 * (SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX)}px)`,
            }}
        >
            <svg
                aria-hidden="true"
                className="seqfx-bar-frame__svg"
                focusable="false"
                viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            >
                <defs>
                    <filter
                        id={plateFilterId}
                        colorInterpolationFilters="sRGB"
                        filterUnits="userSpaceOnUse"
                        height={frameHeight + 64}
                        width={frameWidth + 64}
                        x={-32}
                        y={-32}
                    >
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" result="darkBlur" />
                        <feOffset in="darkBlur" dx="2.4" dy="3" result="darkOffset" />
                        <feFlood floodColor="#8f8577" floodOpacity="0.3" result="darkColor" />
                        <feComposite in="darkColor" in2="darkOffset" operator="in" result="darkShadow" />

                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="lightBlur" />
                        <feOffset in="lightBlur" dx="-2" dy="-2" result="lightOffset" />
                        <feFlood floodColor="#fff7e8" floodOpacity="0.64" result="lightColor" />
                        <feComposite in="lightColor" in2="lightOffset" operator="in" result="lightShadow" />

                        <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="edgeBlur" />
                        <feOffset in="edgeBlur" dx="0" dy="1.1" result="edgeOffset" />
                        <feFlood floodColor="#756c60" floodOpacity="0.18" result="edgeColor" />
                        <feComposite in="edgeColor" in2="edgeOffset" operator="in" result="edgeShadow" />

                        <feMerge>
                            <feMergeNode in="darkShadow" />
                            <feMergeNode in="lightShadow" />
                            <feMergeNode in="edgeShadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <path
                    className="seqfx-bar-frame__plate"
                    data-role="seqfx-bar-frame-plate"
                    d={platePath}
                    filter={`url(#${plateFilterId})`}
                    fillRule="evenodd"
                />
                <g className="seqfx-bar-frame__corner-glyphs" data-role="seqfx-bar-frame-corner-glyphs">
                    {cornerGlyphs.map((glyph) => (
                        <g
                            className={glyph.accent ? "seqfx-bar-frame__corner-glyph is-accent" : "seqfx-bar-frame__corner-glyph"}
                            data-role="seqfx-bar-frame-corner-glyph"
                            data-corner={glyph.key}
                            key={glyph.key}
                            transform={`translate(${glyph.x} ${glyph.y}) rotate(${glyph.rotate})`}
                        >
                            {glyph.paths.map((pathData) => (
                                <path d={pathData} key={pathData} />
                            ))}
                        </g>
                    ))}
                </g>
                <path
                    className="seqfx-bar-frame__outer seqfx-bar-frame__outer-body"
                    data-role="seqfx-bar-frame-outer-body"
                    d={hasArrow
                        ? buildOuterFrameBodyPath(
                            outerLeft,
                            outerTop,
                            outerRight,
                            visibleOuterBottom,
                            SEQFX_BAR_FRAME_BEVEL_PX,
                            SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
                            centerX,
                        )
                        : buildOuterFrameClosedPath(
                            outerLeft,
                            outerTop,
                            outerRight,
                            visibleOuterBottom,
                            SEQFX_BAR_FRAME_BEVEL_PX,
                            SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
                        )}
                />
                {hasArrow ? (
                    <path
                        className="seqfx-bar-frame__outer seqfx-bar-frame__outer-arrow"
                        data-role="seqfx-bar-frame-outer-arrow"
                        d={buildOuterFrameArrowPath(visibleOuterBottom, centerX)}
                    />
                ) : null}
                <path
                    className="seqfx-bar-frame__inner"
                    data-role="seqfx-bar-frame-inner"
                    d={buildBeveledRectPath(
                        innerLeft,
                        innerTop,
                        innerRight,
                        innerBottom,
                        SEQFX_BAR_FRAME_BEVEL_PX,
                    )}
                />
            </svg>
        </div>
    );
}

function createGridGeometry(cellsPerBeat: number) {
    const cellsPerBar = cellsPerBeat * SEQFX_BEATS_PER_BAR;

    const cellStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: `${gridRowForStep(step)}`,
    });

    const blockSegments = (startStep: number, length: number) => {
        const lastStep = Math.min(SEQFX_STEP_COUNT - 1, startStep + length - 1);
        const segments: Array<{
            barIndex: number;
            endStep: number;
            isEndSegment: boolean;
            startStep: number;
            style: CSSProperties;
        }> = [];
        let segmentStart = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, startStep));

        while (segmentStart <= lastStep) {
            const barIndex = barIndexForStep(segmentStart);
            const rowEndStep = Math.min(lastStep, ((barIndex + 1) * SEQFX_GRID_STEPS_PER_ROW) - 1);
            segments.push({
                barIndex,
                endStep: rowEndStep,
                isEndSegment: rowEndStep === lastStep,
                startStep: segmentStart,
                style: {
                    gridColumn: `${gridColumnForStep(segmentStart)} / ${gridColumnForStep(rowEndStep) + 1}`,
                    gridRow: "1",
                },
            });
            segmentStart = rowEndStep + 1;
        }

        return segments;
    };

    const stepNumberStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: `${gridRowForStep(step)}`,
    });

    return {
        blockSegments,
        cellsPerBar,
        cellStyle,
        stepNumberStyle,
        isAltBar: (step: number) => Math.floor(step / cellsPerBar) % 2 === 1,
    };
}

function formatValue(value: number) {
    if (Math.abs(value) >= 100) {
        return String(Math.round(value));
    }

    return Number(value.toFixed(3)).toString();
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function estimatedStepDurationMsForRateIndex(rateIndex: number) {
    const quarterNoteMsAt120Bpm = 500;
    const quarterNotesPerStep = rateIndex <= 0 ? 0.5 : rateIndex >= 2 ? 0.125 : 0.25;
    return quarterNoteMsAt120Bpm * quarterNotesPerStep;
}

const TAPE_STOP_SYNC_LABELS = ["1/32", "1/16", "1/8", "1/4", "1/2", "4 Beats", "8 Beats", "16 Beats", "1 Cell"] as const;

function tapeStopCurveLabel(value: number) {
    if (value < -0.08) {
        return `Early brake ${Math.round(Math.abs(value) * 100)}%`;
    }
    if (value > 0.08) {
        return `Late brake ${Math.round(value * 100)}%`;
    }
    return "Linear";
}

function tapeStopTrajectoryPaths(
    curve: number,
    returnMode: number,
    startDurationMs: number,
    stopDurationMs: number,
) {
    const trajectory = resolveTapeStopV2Trajectory({
        curve,
        returnMode,
        startDurationMs,
        stopDurationMs,
    });
    const samples = sampleTapeStopV2Trajectory(trajectory);
    const pathFor = (valueForSample: (sample: (typeof samples)[number]) => number) => samples
        .map((sample, index) => {
            const x = 12 + (sample.normalizedTime * 336);
            const y = 78 - (clampNumber(valueForSample(sample), 0, 1) * 62);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");

    return {
        handoffPath: pathFor((sample) => sample.liveBlend),
        motorPath: pathFor((sample) => sample.motorSpeed),
        stopEndX: 12 + (trajectory.stopEndNormalized * 336),
        trajectory,
    };
}

function TapeStopV2Editor({
    cellDurationMs,
    cellsPerBeat,
    step,
    disabled,
    onParamChange,
}: {
    cellDurationMs: number;
    cellsPerBeat: number;
    step: SeqFxStep;
    disabled: boolean;
    onParamChange: (paramIndex: number, value: number) => void;
}) {
    const stopDivision = Math.round(step.params[TAPE_STOP_PARAM_STOP_DIVISION] ?? 8);
    const curve = clampNumber(step.params[TAPE_STOP_PARAM_CURVE] ?? 0, -1, 1);
    const returnMode = Math.round(step.params[TAPE_STOP_PARAM_RETURN] ?? TAPE_STOP_RETURN_CROSSFADE_TO_LIVE);
    const startDivision = Math.round(step.params[TAPE_STOP_PARAM_START_DIVISION] ?? 1);
    const character = clampNumber(step.params[TAPE_STOP_PARAM_CHARACTER] ?? 0, 0, 1);
    const timing = Math.round(step.params[TAPE_STOP_PARAM_TIMING] ?? TAPE_STOP_TIMING_SYNC);
    const freeStopMs = clampNumber(step.params[TAPE_STOP_PARAM_FREE_STOP_MS] ?? 500, 20, 8_000);
    const freeStartMs = clampNumber(step.params[TAPE_STOP_PARAM_FREE_START_MS] ?? 125, 20, 8_000);
    const spinUp = returnMode === TAPE_STOP_RETURN_SPIN_UP;
    const freeTiming = timing === TAPE_STOP_TIMING_FREE;
    const stopLabel = freeTiming ? `${Math.round(freeStopMs)} ms` : TAPE_STOP_SYNC_LABELS[stopDivision] ?? "1 Cell";
    const startLabel = freeTiming ? `${Math.round(freeStartMs)} ms` : TAPE_STOP_SYNC_LABELS[startDivision] ?? "1/16";
    const quarterDurationMs = Math.max(1, cellDurationMs) * Math.max(1, cellsPerBeat);
    const divisionQuarterNotes = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16] as const;
    const durationForDivision = (division: number) => division === 8
        ? Math.max(1, cellDurationMs)
        : quarterDurationMs * (divisionQuarterNotes[division] ?? 1);
    const stopDurationMs = freeTiming ? freeStopMs : durationForDivision(stopDivision);
    const startDurationMs = freeTiming ? freeStartMs : durationForDivision(startDivision);
    const trajectoryPaths = tapeStopTrajectoryPaths(
        curve,
        returnMode,
        startDurationMs,
        stopDurationMs,
    );
    const handoffLabel = `${Math.round(trajectoryPaths.trajectory.handoffDurationMs)} ms handoff`;

    return (
        <section className="seqfx-tape-v2" data-role="seqfx-tape-v2-editor" aria-label="Tape Stop controls">
            <div className="seqfx-tape-v2__trajectory">
                <div className="seqfx-tape-v2__trajectory-head">
                    <span>Motor + live handoff</span>
                    <strong>{stopLabel} · {spinUp ? `Spin Up ${startLabel}` : "Crossfade to Live"}</strong>
                </div>
                <svg
                    aria-label={`Tape slows over ${stopLabel}, then ${spinUp ? `restarts its motor over ${startLabel} and crossfades to live` : "crossfades directly to live input"}`}
                    data-role="seqfx-tape-v2-trajectory"
                    role="img"
                    viewBox="0 0 360 92"
                >
                    <line className="seqfx-tape-v2__axis" x1="12" x2="348" y1="78" y2="78" />
                    <line className="seqfx-tape-v2__guide" x1="12" x2="348" y1="16" y2="16" />
                    <path
                        className="seqfx-tape-v2__curve"
                        data-role="seqfx-tape-v2-curve"
                        d={trajectoryPaths.motorPath}
                    />
                    <path
                        className="seqfx-tape-v2__handoff"
                        data-role="seqfx-tape-v2-live-handoff"
                        d={trajectoryPaths.handoffPath}
                    />
                    <line className="seqfx-tape-v2__marker" x1={trajectoryPaths.stopEndX} x2={trajectoryPaths.stopEndX} y1="16" y2="78" />
                    <text className="seqfx-tape-v2__axis-label" x="12" y="12">1x</text>
                    <text className="seqfx-tape-v2__axis-label" x="12" y="90">0x</text>
                </svg>
                <p>{spinUp
                    ? `The captured motor restarts to 1x, then ${handoffLabel} crosses to the current live timeline; it does not chase forward.`
                    : `${handoffLabel} crosses directly from the stopped capture to current live input.`}</p>
            </div>

            <div className="seqfx-tape-v2__controls">
                <label className="seqfx-tape-v2-control">
                    <span>Timing <em>Trigger</em></span>
                    <select
                        aria-label="Tape Stop timing"
                        data-control="seqfx-tape-timing"
                        data-param={TAPE_STOP_PARAM_TIMING}
                        data-role="seqfx-param"
                        disabled={disabled}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_TIMING, Number(event.currentTarget.value))}
                        value={timing}
                    >
                        <option value={TAPE_STOP_TIMING_SYNC}>Sync</option>
                        <option value={TAPE_STOP_TIMING_FREE}>Free</option>
                    </select>
                    <small>{freeTiming ? "Milliseconds stay fixed when tempo changes." : "The duration is latched from tempo at the trigger."}</small>
                </label>

                <label className="seqfx-tape-v2-control">
                    <span>Stop Time <em>Trigger</em></span>
                    {freeTiming ? (
                        <input
                            aria-label="Tape Stop free stop time in milliseconds"
                            data-control="seqfx-tape-stop-time"
                            data-param={TAPE_STOP_PARAM_FREE_STOP_MS}
                            data-role="seqfx-param"
                            disabled={disabled}
                            max={8_000}
                            min={20}
                            onChange={(event) => onParamChange(TAPE_STOP_PARAM_FREE_STOP_MS, Number(event.currentTarget.value))}
                            step={1}
                            type="number"
                            value={Math.round(freeStopMs)}
                        />
                    ) : (
                        <select
                            aria-label="Tape Stop synced stop time"
                            data-control="seqfx-tape-stop-time"
                            data-param={TAPE_STOP_PARAM_STOP_DIVISION}
                            data-role="seqfx-param"
                            disabled={disabled}
                            onChange={(event) => onParamChange(TAPE_STOP_PARAM_STOP_DIVISION, Number(event.currentTarget.value))}
                            value={stopDivision}
                        >
                            {TAPE_STOP_SYNC_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                        </select>
                    )}
                    <small>How long the captured audio takes to reach a stop.</small>
                </label>

                <label className="seqfx-tape-v2-control seqfx-tape-v2-control--wide">
                    <span>Curve <em>Trigger</em><output>{tapeStopCurveLabel(curve)}</output></span>
                    <input
                        aria-label="Tape Stop brake curve"
                        data-control="seqfx-tape-curve"
                        data-param={TAPE_STOP_PARAM_CURVE}
                        data-role="seqfx-param"
                        disabled={disabled}
                        max={1}
                        min={-1}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_CURVE, Number(event.currentTarget.value))}
                        step={0.01}
                        type="range"
                        value={curve}
                    />
                    <small>Move the braking weight earlier or later without changing Stop Time.</small>
                </label>

                <label className="seqfx-tape-v2-control">
                    <span>Return <em>Trigger</em></span>
                    <select
                        aria-label="Tape Stop return behavior"
                        data-control="seqfx-tape-return"
                        data-param={TAPE_STOP_PARAM_RETURN}
                        data-role="seqfx-param"
                        disabled={disabled}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_RETURN, Number(event.currentTarget.value))}
                        value={returnMode}
                    >
                        <option value={TAPE_STOP_RETURN_CROSSFADE_TO_LIVE}>Crossfade to Live</option>
                        <option value={TAPE_STOP_RETURN_SPIN_UP}>Spin Up</option>
                    </select>
                    <small>{spinUp ? "Restarts the captured motor from 0x to 1x, then hands off to live; it does not catch up in time." : "Returns directly to current live input with a short click-safe crossfade."}</small>
                </label>

                {spinUp ? (
                    <label className="seqfx-tape-v2-control">
                        <span>Start Time <em>Trigger</em></span>
                        {freeTiming ? (
                            <input
                                aria-label="Tape Stop free start time in milliseconds"
                                data-control="seqfx-tape-start-time"
                                data-param={TAPE_STOP_PARAM_FREE_START_MS}
                                data-role="seqfx-param"
                                disabled={disabled}
                                max={8_000}
                                min={20}
                                onChange={(event) => onParamChange(TAPE_STOP_PARAM_FREE_START_MS, Number(event.currentTarget.value))}
                                step={1}
                                type="number"
                                value={Math.round(freeStartMs)}
                            />
                        ) : (
                            <select
                                aria-label="Tape Stop synced start time"
                                data-control="seqfx-tape-start-time"
                                data-param={TAPE_STOP_PARAM_START_DIVISION}
                                data-role="seqfx-param"
                                disabled={disabled}
                                onChange={(event) => onParamChange(TAPE_STOP_PARAM_START_DIVISION, Number(event.currentTarget.value))}
                                value={startDivision}
                            >
                                {TAPE_STOP_SYNC_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                            </select>
                        )}
                        <small>How long the motor takes to return to normal speed.</small>
                    </label>
                ) : null}

                <label className="seqfx-tape-v2-control seqfx-tape-v2-control--wide">
                    <span>Character <em>Trigger</em><output>{Math.round(character * 100)}%</output></span>
                    <input
                        aria-label="Tape Stop character"
                        data-control="seqfx-tape-character"
                        data-param={TAPE_STOP_PARAM_CHARACTER}
                        data-role="seqfx-param"
                        disabled={disabled}
                        max={1}
                        min={0}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_CHARACTER, Number(event.currentTarget.value))}
                        step={0.01}
                        type="range"
                        value={character}
                    />
                    <small>Adds speed-linked high-frequency loss and bounded saturation.</small>
                </label>
            </div>
            {disabled ? <p className="seqfx-tape-v2__disabled">Select one trigger or a complete block to edit this gesture.</p> : null}
        </section>
    );
}

function selectionFromCell(cell: SelectedCell | null): Selection | null {
    return cell ? { lane: cell.lane, steps: [cell.step] } : null;
}

function mergeRangeSelection(anchor: SelectedCell, target: SelectedCell): Selection {
    const start = Math.min(anchor.step, target.step);
    const end = Math.max(anchor.step, target.step);

    return {
        lane: anchor.lane,
        steps: Array.from({ length: end - start + 1 }, (_unused, index) => start + index),
    };
}

function selectionFromBlockStarts(pattern: SeqFxPattern, lane: number, blockStartSteps: number[]): Selection | null {
    const starts = [...new Set(blockStartSteps)].sort((left, right) => left - right);
    const steps = new Set<number>();
    const resolvedStarts: number[] = [];

    for (const startStep of starts) {
        const block = getSeqFxBlockAtStep(pattern, lane, startStep);
        if (!block || block.startStep !== startStep) {
            continue;
        }

        resolvedStarts.push(block.startStep);
        for (let step = block.startStep; step <= block.endStep; step += 1) {
            steps.add(step);
        }
    }

    if (resolvedStarts.length === 0) {
        return null;
    }

    return {
        lane,
        steps: [...steps].sort((left, right) => left - right),
        blockStartSteps: resolvedStarts,
    };
}

function blockStartsBetween(pattern: SeqFxPattern, lane: number, startStep: number, endStep: number): number[] {
    const rangeStart = Math.min(startStep, endStep);
    const rangeEnd = Math.max(startStep, endStep);

    return getSeqFxLaneBlocks(pattern, lane)
        .filter((block) => block.startStep >= rangeStart && block.startStep <= rangeEnd)
        .map((block) => block.startStep);
}

function selectionAnchorDragBounds(pattern: SeqFxPattern, lane: number, blockStartSteps: number[], anchorStartStep: number) {
    const blocks = blockStartSteps
        .map((startStep) => getSeqFxBlockAtStep(pattern, lane, startStep))
        .filter((block): block is SeqFxBlock => Boolean(block));

    if (blocks.length === 0) {
        return {
            minStartStep: 0,
            maxStartStep: SEQFX_STEP_COUNT - 1,
        };
    }

    const minDelta = Math.min(...blocks.map((block) => block.startStep - anchorStartStep));
    const maxEndDelta = Math.max(...blocks.map((block) => block.endStep - anchorStartStep));

    return {
        minStartStep: Math.max(0, -minDelta),
        maxStartStep: Math.min(SEQFX_STEP_COUNT - 1, SEQFX_STEP_COUNT - 1 - maxEndDelta),
    };
}

function getSelectionLabel(selection: Selection | null, effectType: SeqFxEffectType | null = null) {
    if (!selection) {
        return "Select a cell";
    }

    const effectLabel = effectType === null ? "" : ` · ${SEQFX_EFFECT_TYPE_NAMES[effectType]}`;
    const blockStartSteps = selection.blockStartSteps ?? [];
    if (blockStartSteps.length > 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]}${effectLabel} · blocks ${blockStartSteps.map((step) => step + 1).join(", ")}`;
    }

    if (selection.steps.length === 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]}${effectLabel} · step ${selection.steps[0] + 1}`;
    }

    return `${SEQFX_LANE_NAMES[selection.lane]}${effectLabel} · steps ${selection.steps[0] + 1}-${selection.steps.at(-1)! + 1}`;
}

function clampBlockStart(startStep: number, length: number) {
    return Math.min(SEQFX_STEP_COUNT - length, Math.max(0, startStep));
}

function isEditableElement(element: Element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return true;
    }

    if (element instanceof HTMLInputElement) {
        const inputType = element.type.toLowerCase();
        return inputType !== "button"
            && inputType !== "checkbox"
            && inputType !== "radio"
            && inputType !== "range"
            && inputType !== "reset"
            && inputType !== "submit";
    }

    return (element instanceof HTMLElement && element.isContentEditable)
        || Boolean(element.closest('[contenteditable="true"], [role="textbox"]'));
}

function isEditableKeyboardEvent(event: globalThis.KeyboardEvent) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.some((target) => target instanceof Element && isEditableElement(target));
}

function isEditableClipboardEvent(event: ClipboardEvent) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.some((target) => target instanceof Element && isEditableElement(target));
}

function describeEventTarget(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) {
        return "non-element";
    }

    const tagName = target.tagName.toLowerCase();
    const role = target.getAttribute("data-role") ?? target.getAttribute("role") ?? "";
    const slot = target.getAttribute("data-slot") ?? "";
    const suffix = [role ? `role=${role}` : "", slot ? `slot=${slot}` : ""].filter(Boolean).join(" ");
    return suffix ? `${tagName} ${suffix}` : tagName;
}

function SeqFxPresetBarHost({
    bridge,
    patchConnection,
}: {
    bridge: SeqFxRuntimeBridge;
    patchConnection: PatchConnectionLike;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const storedStateAdapter = useMemo(() => createSeqFxPresetStateAdapter({
        bridge,
        patchConnection,
    }), [bridge, patchConnection]);
    const presetController = useMemo(() => createStandaloneEffectPresetController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
        presetMigrations: createSeqFxPresetMigrations,
    }), [patchConnection, storedStateAdapter]);
    const snapshotController = useMemo(() => new EffectSnapshotBankController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
        snapshotMigrations: createSeqFxSnapshotMigrations,
    }), [patchConnection, storedStateAdapter]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const effectHeader = createEffectHeader();
        effectHeader.presetController = presetController;
        effectHeader.snapshotController = snapshotController;
        host.replaceChildren(effectHeader);
        snapshotController.attach();
        presetController.attach();

        return () => {
            presetController.detach();
            snapshotController.detach();
            effectHeader.presetController = null;
            effectHeader.snapshotController = null;
            effectHeader.remove();
        };
    }, [presetController, snapshotController]);

    return <div className="seqfx-preset-row" ref={hostRef} />;
}

export type SeqFxPromoControls = {
    state?: SeqFxState;
    selectedPattern?: number;
    rateIndex?: number;
    globalControls?: SeqFxGlobalControls;
    internalRunning?: boolean;
    selectedCell?: SelectedCell | null;
    selection?: Selection | null;
    playheadStep?: number | null;
    inspectorMode?: InspectorMode;
    auxMonitor?: AuxMonitorState;
    hidePresetBar?: boolean;
};

export function SeqFxPatchView({
    patchConnection,
    promoControls,
}: {
    patchConnection: PatchConnectionLike;
    promoControls?: SeqFxPromoControls;
}) {
    const bridge = useMemo(() => new SeqFxRuntimeBridge(patchConnection), [patchConnection]);
    const [runtimeState, setState] = useState<SeqFxState>(() => bridge.getState());
    const [runtimeSelectedPattern, setSelectedPattern] = useState(() => bridge.getSelectedPatternIndex());
    const [runtimeRateIndex, setRateIndex] = useState(() => bridge.getRateIndex());
    const [runtimeGlobalControls, setGlobalControls] = useState(() => bridge.getGlobalControls());
    const [runtimeInternalRunning, setInternalRunning] = useState(false);
    const internalRunningRef = useRef(runtimeInternalRunning);
    const [runtimeHasLoopClipboard, setHasLoopClipboard] = useState(() => bridge.canPasteLoop());
    const [runtimeSelectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [runtimeSelection, setSelection] = useState<Selection | null>(null);
    const [runtimePlayheadStep, setPlayheadStep] = useState<number | null>(null);
    const [observedStepDurationMs, setObservedStepDurationMs] = useState<number | null>(null);
    const [runtimeAuxMonitor, setAuxMonitor] = useState<AuxMonitorState>(() => ({
        cyclePhase: Array.from({ length: 4 }, () => 0),
        amount: Array.from({ length: 4 }, () => 0),
        durationMs: Array.from({ length: 4 }, () => 0),
    }));
    const [drawEffectType, setDrawEffectType] = useState<SeqFxEffectType | null>(null);
    const [runtimeInspectorMode, setInspectorMode] = useState<InspectorMode>("effect");
    const [gestureState, setGestureState] = useState<BlockGesture | null>(null);
    const [patternPreview, setPatternPreview] = useState<PatternPreview | null>(null);
    const [invalidDropTarget, setInvalidDropTarget] = useState<InvalidDropTarget | null>(null);
    const [showFirstUseHint, setShowFirstUseHint] = useState(true);
    const [focusedDurationBlock, setFocusedDurationBlock] = useState<{ lane: number; startStep: number } | null>(null);
    const isPromoControlled = Boolean(promoControls);
    const state = isPromoControlled ? promoControls?.state ?? runtimeState : runtimeState;
    const selectedPattern = isPromoControlled ? promoControls?.selectedPattern ?? runtimeSelectedPattern : runtimeSelectedPattern;
    const rateIndex = isPromoControlled ? promoControls?.rateIndex ?? runtimeRateIndex : runtimeRateIndex;
    const globalControls = isPromoControlled
        ? promoControls?.globalControls ?? runtimeGlobalControls
        : runtimeGlobalControls;
    const internalRunning = isPromoControlled
        ? promoControls?.internalRunning ?? runtimeInternalRunning
        : runtimeInternalRunning;
    const selectedCell = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "selectedCell")
        ? promoControls.selectedCell ?? null
        : runtimeSelectedCell;
    const selection = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "selection")
        ? promoControls.selection ?? null
        : runtimeSelection;
    const playheadStep = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "playheadStep")
        ? promoControls.playheadStep ?? null
        : runtimePlayheadStep;
    const auxMonitor = isPromoControlled ? promoControls?.auxMonitor ?? runtimeAuxMonitor : runtimeAuxMonitor;
    const inspectorMode = isPromoControlled ? promoControls?.inspectorMode ?? runtimeInspectorMode : runtimeInspectorMode;
    const cellsPerBeat = useMemo(() => cellsPerBeatForRateIndex(rateIndex), [rateIndex]);
    const gridGeometry = useMemo(() => createGridGeometry(cellsPerBeat), [cellsPerBeat]);
    const gridShellClassName = `seqfx-grid-shell seqfx-grid--beat-${cellsPerBeat}`;
    const laneTrackRefs = useRef(new Map<string, { lane: number; node: HTMLDivElement }>());
    const cellRefs = useRef(new Map<string, HTMLDivElement>());
    const gestureRef = useRef<BlockGesture | null>(null);
    const optionKeyRef = useRef(false);
    const rateIndexRef = useRef(rateIndex);
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);
    const selectedCellRef = useRef<SelectedCell | null>(selectedCell);
    const activeSelectionRef = useRef<Selection | null>(null);
    const selectionPatternRef = useRef(selectedPattern);
    const cellClipboardRef = useRef<SeqFxStepValueSnapshot | null>(null);
    const liveEditPointerIdRef = useRef<number | null>(null);

    rateIndexRef.current = rateIndex;
    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;
    selectedCellRef.current = selectedCell;
    internalRunningRef.current = runtimeInternalRunning;

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        bridge.attach();
        const unsubscribeState = bridge.subscribe((nextState) => {
            setState(nextState);
            setSelectedPattern(bridge.getSelectedPatternIndex());
        });
        const unsubscribeGlobalControls = bridge.subscribeGlobalControls((nextControls) => {
            setGlobalControls(nextControls);
            if (nextControls.clockMode !== 1) {
                if (internalRunningRef.current) {
                    internalRunningRef.current = false;
                    bridge.stopInternal();
                }
                setInternalRunning(false);
            }
        });
        const unsubscribeMonitor = bridge.subscribeMonitor((monitor) => {
            setPlayheadStep(monitor.stepIndex);
            if (bridge.getGlobalControls().clockMode === 1) {
                setInternalRunning(monitor.transportRunning);
            }
            if (monitor.stepDurationMs !== null && monitor.stepDurationMs > 0) {
                setObservedStepDurationMs(monitor.stepDurationMs);
            }
            if (
                monitor.auxCyclePhase !== null
                || monitor.auxAmount !== null
                || monitor.auxDurationMs !== null
            ) {
                setAuxMonitor({
                    cyclePhase: monitor.auxCyclePhase === null ? [0, 0, 0, 0] : [...monitor.auxCyclePhase],
                    amount: monitor.auxAmount === null ? [0, 0, 0, 0] : [...monitor.auxAmount],
                    durationMs: monitor.auxDurationMs === null ? [0, 0, 0, 0] : [...monitor.auxDurationMs],
                });
            }
        });
        const unsubscribeRate = bridge.subscribeRate((nextRateIndex) => {
            if (rateIndexRef.current !== nextRateIndex) {
                gestureRef.current = null;
                setGestureState(null);
                setPatternPreview(null);
                setInvalidDropTarget(null);
            }
            rateIndexRef.current = nextRateIndex;
            setRateIndex(nextRateIndex);
        });
        bridge.requestBootState();

        return () => {
            unsubscribeState();
            unsubscribeGlobalControls();
            unsubscribeMonitor();
            unsubscribeRate();
            bridge.detach();
        };
    }, [bridge, isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const patternChanged = selectionPatternRef.current !== runtimeSelectedPattern;
        selectionPatternRef.current = runtimeSelectedPattern;
        if (!runtimeSelectedCell) {
            return;
        }

        const pattern = runtimeState.patterns[runtimeSelectedPattern];
        const selectedStep = pattern?.lanes[runtimeSelectedCell.lane]?.steps[runtimeSelectedCell.step];
        const selectedBlockStarts = runtimeSelection?.blockStartSteps ?? [];
        const blockSelectionStillExists = selectedBlockStarts.every((startStep) => {
            const block = pattern ? getSeqFxBlockAtStep(pattern, runtimeSelection?.lane ?? runtimeSelectedCell.lane, startStep) : null;
            return block?.startStep === startStep;
        });

        if (!patternChanged && selectedStep?.active && blockSelectionStillExists) {
            return;
        }

        setSelectedCell(null);
        setSelection(null);
        setInspectorMode("effect");
    }, [isPromoControlled, runtimeSelectedCell, runtimeSelectedPattern, runtimeSelection, runtimeState]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = true;
            }
        };
        const handleKeyUp = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = false;
            }
        };
        const clearOptionKey = () => {
            optionKeyRef.current = false;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", clearOptionKey);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", clearOptionKey);
        };
    }, [isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const commitLiveEditForPointer = (event: globalThis.PointerEvent) => {
            if (liveEditPointerIdRef.current !== event.pointerId) {
                return;
            }

            liveEditPointerIdRef.current = null;
            bridge.commitLiveEdit();
        };
        const commitLiveEditForWindow = () => {
            if (liveEditPointerIdRef.current === null) {
                return;
            }

            liveEditPointerIdRef.current = null;
            bridge.commitLiveEdit();
        };

        window.addEventListener("pointerup", commitLiveEditForPointer);
        window.addEventListener("pointercancel", commitLiveEditForPointer);
        window.addEventListener("blur", commitLiveEditForWindow);

        return () => {
            window.removeEventListener("pointerup", commitLiveEditForPointer);
            window.removeEventListener("pointercancel", commitLiveEditForPointer);
            window.removeEventListener("blur", commitLiveEditForWindow);
            commitLiveEditForWindow();
        };
    }, [bridge, isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const copySelectedCellValues = () => {
            const activeSelection = activeSelectionRef.current;
            if (!activeSelection || activeSelection.steps.length === 0) {
                return null;
            }

            const selectedCell = selectedCellRef.current;
            const sourceStep = selectedCell?.lane === activeSelection.lane
                && activeSelection.steps.includes(selectedCell.step)
                ? selectedCell.step
                : activeSelection.steps[0];

            const copiedValues = bridge.copyStepValues({
                patternIndex: selectedPatternRef.current,
                lane: activeSelection.lane,
                step: sourceStep,
            });
            cellClipboardRef.current = copiedValues;
            return copiedValues;
        };

        const pasteSelectedCellValues = () => {
            const activeSelection = activeSelectionRef.current;
            const copiedValues = cellClipboardRef.current;
            if (
                !activeSelection
                || activeSelection.steps.length === 0
                || !copiedValues
            ) {
                return false;
            }

            bridge.pasteStepValues({
                patternIndex: selectedPatternRef.current,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                values: copiedValues,
            });
            return true;
        };

        const handleClipboardKeyDown = (event: globalThis.KeyboardEvent) => {
            if (!event.metaKey || event.altKey || event.ctrlKey) {
                return;
            }

            const key = event.key.toLowerCase();
            if (key !== "c" && key !== "v") {
                return;
            }

            if (isEditableKeyboardEvent(event)) {
                return;
            }

            if (key === "c") {
                if (copySelectedCellValues()) {
                    event.preventDefault();
                }
                return;
            }

            if (pasteSelectedCellValues()) {
                event.preventDefault();
            }
        };

        const handleCopyEvent = (event: ClipboardEvent) => {
            if (isEditableClipboardEvent(event)) {
                return;
            }

            if (copySelectedCellValues()) {
                event.preventDefault();
            }
        };

        const handlePasteEvent = (event: ClipboardEvent) => {
            if (isEditableClipboardEvent(event)) {
                return;
            }

            if (pasteSelectedCellValues()) {
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", handleClipboardKeyDown);
        window.addEventListener("copy", handleCopyEvent);
        window.addEventListener("paste", handlePasteEvent);

        return () => {
            window.removeEventListener("keydown", handleClipboardKeyDown);
            window.removeEventListener("copy", handleCopyEvent);
            window.removeEventListener("paste", handlePasteEvent);
        };
    }, [bridge, isPromoControlled]);

    function stepAtClientPointForLane(lane: number, clientX: number, clientY: number) {
        const rects = STEP_NUMBERS
            .map((step) => {
                const cell = cellRefs.current.get(cellRefKey(lane, step));
                return cell ? { step, rect: cell.getBoundingClientRect() } : null;
            })
            .filter((entry): entry is { step: number; rect: DOMRect } => Boolean(entry));

        if (rects.length === 0) {
            return null;
        }

        const containingCell = rects.find(({ rect }) => (
            clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom
        ));
        if (containingCell) {
            return containingCell.step;
        }

        const closestToPointer = rects.reduce((closest, current) => {
            const currentCenterY = current.rect.top + (current.rect.height / 2);
            const closestCenterY = closest.rect.top + (closest.rect.height / 2);
            return Math.abs(clientY - currentCenterY) < Math.abs(clientY - closestCenterY)
                ? current
                : closest;
        }, rects[0]);
        const targetCenterY = closestToPointer.rect.top + (closestToPointer.rect.height / 2);
        const rowRects = rects
            .filter(({ rect }) => Math.abs((rect.top + (rect.height / 2)) - targetCenterY) <= 1)
            .sort((left, right) => left.rect.left - right.rect.left);

        const first = rowRects[0];
        const last = rowRects[rowRects.length - 1];
        if (clientX <= first.rect.left) {
            return first.step;
        }
        if (clientX >= last.rect.right) {
            return last.step;
        }

        for (let index = 0; index < rowRects.length; index += 1) {
            const current = rowRects[index];
            if (clientX >= current.rect.left && clientX <= current.rect.right) {
                return current.step;
            }

            const next = rowRects[index + 1];
            if (next && clientX > current.rect.right && clientX < next.rect.left) {
                const midpoint = current.rect.right + ((next.rect.left - current.rect.right) / 2);
                return clientX < midpoint ? current.step : next.step;
            }
        }

        return last.step;
    }

    useEffect(() => {
        const pointerStepForLane = (lane: number, event: globalThis.PointerEvent) => {
            return stepAtClientPointForLane(lane, event.clientX, event.clientY);
        };

        const targetLaneForPointer = (event: globalThis.PointerEvent, fallbackLane: number) => {
            const laneEntries = [...laneTrackRefs.current.values()]
                .sort((left, right) => {
                    const leftBounds = left.node.getBoundingClientRect();
                    const rightBounds = right.node.getBoundingClientRect();
                    return leftBounds.top - rightBounds.top || left.lane - right.lane;
                });

            if (laneEntries.length === 0) {
                return fallbackLane;
            }

            let closestLane = fallbackLane;
            let closestDistance = Number.POSITIVE_INFINITY;

            for (const { lane, node } of laneEntries) {
                const bounds = node.getBoundingClientRect();
                if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                    return lane;
                }

                const centerY = bounds.top + (bounds.height / 2);
                const distance = Math.abs(event.clientY - centerY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestLane = lane;
                }
            }

            return closestLane;
        };

        const selectBlockRange = (lane: number, startStep: number, length: number) => {
            setSelectedCell({ lane, step: startStep });
            setSelection({
                lane,
                steps: Array.from({ length }, (_unused, index) => startStep + index),
                blockStartSteps: [startStep],
            });
        };

        const targetStartFromPointer = (gesture: MoveGesture | CopyGesture, event: globalThis.PointerEvent) => {
            const targetLane = targetLaneForPointer(event, gesture.previewTargetLane ?? gesture.lane);
            const pointerStep = pointerStepForLane(targetLane, event);
            if (pointerStep === null) {
                return null;
            }

            return {
                lane: targetLane,
                startStep: clampBlockStart(pointerStep - gesture.grabOffset, gesture.length),
            };
        };

        const targetAnchorStartFromPointer = (gesture: BlockSelectionMoveGesture | BlockSelectionCopyGesture, event: globalThis.PointerEvent) => {
            const targetLane = targetLaneForPointer(event, gesture.previewTargetLane ?? gesture.lane);
            const pointerStep = pointerStepForLane(targetLane, event);
            if (pointerStep === null) {
                return null;
            }

            return {
                lane: targetLane,
                startStep: Math.min(
                    gesture.anchorMaxStartStep,
                    Math.max(gesture.anchorMinStartStep, pointerStep - gesture.grabOffset),
                ),
            };
        };

        const setInvalidSingleDrop = (lane: number, startStep: number, length: number) => {
            setInvalidDropTarget({
                patternIndex: selectedPatternRef.current,
                lane,
                blocks: [{ startStep, length }],
            });
        };

        const setInvalidSelectionDrop = (sourceLane: number, targetLane: number, blockStartSteps: number[], anchorStartStep: number, targetAnchorStartStep: number) => {
            const pattern = stateRef.current.patterns[selectedPatternRef.current];
            const delta = targetAnchorStartStep - anchorStartStep;
            setInvalidDropTarget({
                patternIndex: selectedPatternRef.current,
                lane: targetLane,
                blocks: blockStartSteps
                    .map((sourceStartStep) => getSeqFxBlockAtStep(pattern, sourceLane, sourceStartStep))
                    .filter((block): block is SeqFxBlock => Boolean(block))
                    .map((block) => ({
                        startStep: clampBlockStart(block.startStep + delta, block.length),
                        length: block.length,
                    })),
            });
        };

        const gestureMovedEnough = (gesture: MoveGesture | CopyGesture | BlockSelectionMoveGesture | BlockSelectionCopyGesture, event: globalThis.PointerEvent) => {
            const deltaX = event.clientX - gesture.pointerStartX;
            const deltaY = event.clientY - gesture.pointerStartY;
            return (deltaX * deltaX) + (deltaY * deltaY) >= 16;
        };

        const handlePointerMove = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture || event.pointerId !== gesture.pointerId) {
                return;
            }

            event.preventDefault();

            if (gesture.mode === "resize") {
                const rawStep = pointerStepForLane(gesture.lane, event);
                if (rawStep === null) {
                    return;
                }

                const endStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(gesture.startStep, rawStep));
                const length = endStep - gesture.startStep + 1;
                if (gesture.previewLength === length) {
                    return;
                }

                try {
                    const previewState = bridge.previewBlockResize({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.startStep,
                        length,
                    });
                    gesture.previewLength = length;
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        state: previewState,
                    });
                    selectBlockRange(gesture.lane, gesture.startStep, length);
                } catch {
                    // Overlap attempts are ignored so the gesture stops at the last valid length.
                }
                return;
            }

            if (!gesture.hasMoved && !gestureMovedEnough(gesture, event)) {
                return;
            }

            gesture.hasMoved = true;

            if (gesture.mode === "selectionMove") {
                const targetAnchor = targetAnchorStartFromPointer(gesture, event);
                if (
                    targetAnchor === null
                    || (
                        targetAnchor.lane === gesture.previewTargetLane
                        && targetAnchor.startStep === gesture.previewTargetAnchorStartStep
                    )
                    || (
                        targetAnchor.lane === gesture.lane
                        && targetAnchor.startStep === gesture.anchorStartStep
                        && gesture.previewTargetAnchorStartStep === null
                    )
                ) {
                    return;
                }

                try {
                    const result = bridge.previewBlockSelectionMove({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetLane: targetAnchor.lane,
                        targetAnchorStartStep: targetAnchor.startStep,
                    });
                    gesture.previewTargetLane = result.movedLane;
                    gesture.previewTargetAnchorStartStep = targetAnchor.startStep;
                    gesture.previewMovedStartSteps = result.movedStartSteps;
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: result.movedLane,
                        state: result.state,
                    });
                    selectBlockStartsFromPattern(
                        result.state.patterns[selectedPatternRef.current],
                        result.movedLane,
                        result.movedStartSteps,
                        targetAnchor.startStep,
                    );
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetAnchorStartStep = null;
                    gesture.previewMovedStartSteps = null;
                    setPatternPreview(null);
                    selectBlockStartsFromPattern(
                        bridge.getState().patterns[selectedPatternRef.current],
                        gesture.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                    );
                    setInvalidSelectionDrop(
                        gesture.lane,
                        targetAnchor.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                        targetAnchor.startStep,
                    );
                    // Invalid group targets, such as collisions, keep the selection at its last valid position.
                }
                return;
            }

            if (gesture.mode === "selectionCopy") {
                const targetAnchor = targetAnchorStartFromPointer(gesture, event);
                if (
                    targetAnchor === null
                    || (
                        targetAnchor.lane === gesture.previewTargetLane
                        && targetAnchor.startStep === gesture.previewTargetAnchorStartStep
                    )
                ) {
                    return;
                }

                try {
                    const result = bridge.previewBlockSelectionCopy({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetLane: targetAnchor.lane,
                        targetAnchorStartStep: targetAnchor.startStep,
                    });
                    gesture.previewTargetLane = result.copiedLane;
                    gesture.previewTargetAnchorStartStep = targetAnchor.startStep;
                    gesture.previewCopiedStartSteps = result.copiedStartSteps.length > 0
                        ? result.copiedStartSteps
                        : null;
                    if (result.copiedStartSteps.length > 0) {
                        setInvalidDropTarget(null);
                        setPatternPreview({
                            patternIndex: selectedPatternRef.current,
                            lane: result.copiedLane,
                            copiedStartSteps: result.copiedStartSteps,
                            state: result.state,
                        });
                    } else {
                        gesture.previewTargetLane = null;
                        gesture.previewTargetAnchorStartStep = null;
                        gesture.previewCopiedStartSteps = null;
                        setPatternPreview(null);
                        setInvalidSelectionDrop(
                            gesture.lane,
                            targetAnchor.lane,
                            gesture.blockStartSteps,
                            gesture.anchorStartStep,
                            targetAnchor.startStep,
                        );
                    }
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetAnchorStartStep = null;
                    gesture.previewCopiedStartSteps = null;
                    setPatternPreview(null);
                    setInvalidSelectionDrop(
                        gesture.lane,
                        targetAnchor.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                        targetAnchor.startStep,
                    );
                }
                return;
            }

            const target = targetStartFromPointer(gesture, event);
            if (target === null) {
                return;
            }

            if (gesture.mode === "move") {
                if (
                    (
                        target.lane === gesture.previewTargetLane
                        && target.startStep === gesture.previewTargetStartStep
                    )
                    || (
                        target.lane === gesture.lane
                        && target.startStep === gesture.sourceStartStep
                        && gesture.previewTargetStartStep === null
                    )
                ) {
                    return;
                }

                try {
                    const previewState = bridge.previewBlockMove({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.sourceStartStep,
                        targetLane: target.lane,
                        targetStartStep: target.startStep,
                    });
                    gesture.previewTargetLane = target.lane;
                    gesture.previewTargetStartStep = target.startStep;
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: target.lane,
                        state: previewState,
                    });
                    selectBlockRange(target.lane, target.startStep, gesture.length);
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetStartStep = null;
                    setPatternPreview(null);
                    selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
                    setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
                    // Invalid targets, such as overlaps, keep the block at its last valid start.
                }
                return;
            }

            try {
                const preview = bridge.previewBlockCopyPaint({
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    startStep: gesture.sourceStartStep,
                    targetLane: target.lane,
                    targetStartStep: target.startStep,
                });
                gesture.previewTargetLane = preview.copiedLane;
                gesture.previewTargetStartStep = target.startStep;
                if (preview.copiedStartSteps.length > 0) {
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: preview.copiedLane,
                        copiedStartSteps: preview.copiedStartSteps,
                        state: preview.state,
                    });
                } else {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetStartStep = null;
                    setPatternPreview(null);
                    setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
                }
            } catch {
                gesture.previewTargetLane = null;
                gesture.previewTargetStartStep = null;
                setPatternPreview(null);
                setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
            }
        };

        const stopGesture = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture || event.pointerId !== gesture.pointerId) {
                return;
            }

            if (gesture.mode === "resize") {
                if (gesture.previewLength !== null) {
                    try {
                        bridge.resizeBlock({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.startStep,
                            length: gesture.previewLength,
                        });
                        selectBlockRange(gesture.lane, gesture.startStep, gesture.previewLength);
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            } else if (gesture.mode === "move" && gesture.hasMoved) {
                if (
                    gesture.previewTargetStartStep !== null
                    && gesture.previewTargetLane !== null
                    && (
                        gesture.previewTargetLane !== gesture.lane
                        || gesture.previewTargetStartStep !== gesture.sourceStartStep
                    )
                ) {
                    try {
                        bridge.moveBlock({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetStartStep: gesture.previewTargetStartStep,
                        });
                        selectBlockRange(gesture.previewTargetLane, gesture.previewTargetStartStep, gesture.length);
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                } else {
                    selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
                }
            } else if (gesture.mode === "selectionMove" && gesture.hasMoved) {
                if (
                    gesture.previewTargetAnchorStartStep !== null
                    && gesture.previewTargetLane !== null
                    && gesture.previewMovedStartSteps !== null
                ) {
                    try {
                        const result = bridge.moveBlockSelection({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            blockStartSteps: gesture.blockStartSteps,
                            anchorStartStep: gesture.anchorStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetAnchorStartStep: gesture.previewTargetAnchorStartStep,
                        });
                        selectBlockStartsFromPattern(
                            result.state.patterns[selectedPatternRef.current],
                            result.movedLane,
                            result.movedStartSteps,
                            gesture.previewTargetAnchorStartStep,
                        );
                    } catch {
                        // Invalid release targets leave the selected blocks untouched.
                    }
                } else {
                    selectBlockStartsFromPattern(
                        bridge.getState().patterns[selectedPatternRef.current],
                        gesture.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                    );
                }
            } else if (gesture.mode === "copy" && gesture.hasMoved) {
                if (
                    gesture.previewTargetLane !== null
                    && gesture.previewTargetStartStep !== null
                    && (
                        gesture.previewTargetLane !== gesture.lane
                        || gesture.previewTargetStartStep !== gesture.sourceStartStep
                    )
                ) {
                    try {
                        const result = bridge.copyBlockPaint({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetStartStep: gesture.previewTargetStartStep,
                        });
                        const selectedStartStep = result.copiedStartSteps.at(-1);
                        if (selectedStartStep !== undefined) {
                            selectBlockRange(result.copiedLane, selectedStartStep, gesture.length);
                        }
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            } else if (gesture.mode === "selectionCopy" && gesture.hasMoved) {
                if (
                    gesture.previewTargetLane !== null
                    && gesture.previewTargetAnchorStartStep !== null
                    && gesture.previewCopiedStartSteps !== null
                ) {
                    try {
                        const result = bridge.copyBlockSelection({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            blockStartSteps: gesture.blockStartSteps,
                            anchorStartStep: gesture.anchorStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetAnchorStartStep: gesture.previewTargetAnchorStartStep,
                        });
                        if (result.copiedStartSteps.length > 0) {
                            selectBlockStartsFromPattern(
                                result.state.patterns[selectedPatternRef.current],
                                result.copiedLane,
                                result.copiedStartSteps,
                                gesture.previewTargetAnchorStartStep,
                            );
                        }
                    } catch {
                        // Invalid release targets leave the selected blocks untouched.
                    }
                }
            }

            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
        };

        const cancelGesture = () => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.mode === "resize") {
                selectBlockRange(gesture.lane, gesture.startStep, gesture.length);
            } else if (gesture.mode === "move") {
                selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
            } else if (gesture.mode === "selectionMove") {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            } else if (gesture.mode === "selectionCopy") {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            }

            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
        };

        const cancelOwnedGesture = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture || event.pointerId !== gesture.pointerId) {
                return;
            }

            cancelGesture();
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", stopGesture);
        window.addEventListener("pointercancel", cancelOwnedGesture);
        window.addEventListener("blur", cancelGesture);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopGesture);
            window.removeEventListener("pointercancel", cancelOwnedGesture);
            window.removeEventListener("blur", cancelGesture);
        };
    }, [bridge]);

    function beginGesture(gesture: BlockGesture) {
        gestureRef.current = gesture;
        setGestureState(gesture);
        setInvalidDropTarget(null);
    }

    function selectBlockRange(lane: number, startStep: number, length: number) {
        setSelectedCell({ lane, step: startStep });
        setSelection({
            lane,
            steps: Array.from({ length }, (_unused, index) => startStep + index),
            blockStartSteps: [startStep],
        });
    }

    function selectBlockStartsFromPattern(
        pattern: SeqFxPattern,
        lane: number,
        blockStartSteps: number[],
        anchorStartStep = blockStartSteps[0],
    ) {
        const nextSelection = selectionFromBlockStarts(pattern, lane, blockStartSteps);
        if (!nextSelection) {
            return;
        }

        setSelectedCell({ lane, step: anchorStartStep });
        setSelection(nextSelection);
    }

    function pointerGrabOffset(lane: number, startStep: number, length: number, clientX: number, clientY: number) {
        const pointerStep = stepAtClientPointForLane(lane, clientX, clientY);
        if (pointerStep === null) {
            return 0;
        }

        return Math.min(length - 1, Math.max(0, pointerStep - startStep));
    }

    function deleteBlockAt(lane: number, step: number) {
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const block = getSeqFxBlockAtStep(pattern, lane, step);
        if (!block) {
            return;
        }

        const selectedStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        if (selectedStarts.includes(block.startStep)) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPatternRef.current,
                lane,
                blockStartSteps: selectedStarts,
            });
            setSelectedCell(null);
            setSelection(null);
            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
            return;
        }

        bridge.deleteBlock({
            patternIndex: selectedPatternRef.current,
            lane: block.lane,
            startStep: block.startStep,
        });
        setSelectedCell(null);
        setSelection(null);
        gestureRef.current = null;
        setGestureState(null);
        setPatternPreview(null);
        setInvalidDropTarget(null);
    }

    const selectedPatternState = state.patterns[selectedPattern];
    const renderedPatternState = patternPreview?.patternIndex === selectedPattern
        ? patternPreview.state.patterns[selectedPattern]
        : selectedPatternState;
    const copyPreviewStartSteps = useMemo(() => (
        patternPreview?.patternIndex === selectedPattern
            ? new Set(patternPreview.copiedStartSteps ?? [])
            : new Set<number>()
    ), [patternPreview, selectedPattern]);
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    activeSelectionRef.current = activeSelection;
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? renderedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;
    const inspectedEffectType = inspectedCell?.active
        ? inspectedCell.effectType
        : drawEffectType ?? defaultEffectTypeForChain(inspectedLane ?? 0);
    const inspectedEffectDefinition = getSeqFxEffectDefinition(inspectedEffectType);
    const inspectedParamDefinitions = paramDefinitionsForEffect(inspectedEffectType);
    const inspectedPrimaryParamDefinitions = inspectedParamDefinitions.filter((definition) => definition.section === "primary");
    const inspectedAdvancedParamDefinitions = inspectedParamDefinitions.filter((definition) => definition.section === "advanced");
    const inspectedAuxParamDefinitions = inspectedParamDefinitions.filter((definition) => (
        inspectedEffectDefinition.parameters[definition.index]?.auxEligible === true
    ));
    const inspectedBlock = inspectedLane !== null && inspectedStep !== null
        ? getSeqFxBlockAtStep(renderedPatternState, inspectedLane, inspectedStep)
        : null;
    const selectedBlockStartSteps = activeSelection?.blockStartSteps ?? [];
    const selectedBlockGroup = selectedBlockStartSteps.length > 0;
    const selectedWholeBlock = Boolean(
        activeSelection
        && inspectedBlock
        && selectedBlockStartSteps.length <= 1
        && activeSelection.lane === inspectedBlock.lane
        && activeSelection.steps.length === inspectedBlock.length
        && activeSelection.steps[0] === inspectedBlock.startStep,
    );
    const auxEditable = Boolean(
        inspectedBlock
        && inspectedCell?.active
        && inspectedEffectType !== SEQFX_EFFECT_TYPES.empty
        && inspectedEffectDefinition.parameters.some((parameter) => parameter.auxEligible)
        && selectedBlockStartSteps.length <= 1,
    );
    const inspectedAux = auxEditable ? inspectedCell?.aux ?? null : null;
    const inspectedAuxCyclePhase = inspectedLane !== null ? auxMonitor.cyclePhase[inspectedLane] ?? 0 : 0;
    const inspectedAuxAmount = inspectedLane !== null ? auxMonitor.amount[inspectedLane] ?? 0 : 0;
    const showModEditor = inspectorMode === "mod" && Boolean(inspectedAux);
    const matchingFactoryPreset = inspectedCell?.active
        ? inspectedEffectDefinition.factoryPresets.find((preset) => (
            Math.abs(inspectedCell.mix - preset.mix) < 0.000001
            && preset.params.every((value, paramIndex) => Math.abs(inspectedCell.params[paramIndex] - value) < 0.000001)
        )) ?? null
        : null;

    useEffect(() => {
        if (!auxEditable && inspectorMode !== "effect") {
            setInspectorMode("effect");
        }
    }, [auxEditable, inspectorMode]);

    function setAuxTargetEnd(paramIndex: number, value: number) {
        if (!inspectedBlock) {
            return;
        }

        if (activeSelection && selectedBlockGroup) {
            bridge.setBlockSelectionAuxTargetEnd({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
            return;
        }

        bridge.setBlockAuxTargetEnd({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            value,
        });
    }

    function setSelectedAuxTargetEnabled(paramIndex: number, enabled: boolean) {
        if (!inspectedBlock) {
            return;
        }

        if (activeSelection && selectedBlockGroup) {
            bridge.setBlockSelectionAuxTargetEnabled({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                enabled,
            });
            return;
        }

        bridge.setBlockAuxTargetEnabled({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            enabled,
        });
    }

    function auxTarget(paramIndex: number, direction: ModulationDirection = "both"): AuxModulatedParam | null {
        if (!inspectedAux || !inspectedBlock) {
            return null;
        }

        const target = inspectedAux.targets[paramIndex];
        if (!target?.enabled) {
            return null;
        }

        return {
            end: target.end,
            direction,
            onEndChange: (value) => setAuxTargetEnd(paramIndex, value),
        };
    }

    function toggleAuxTarget(paramIndex: number) {
        if (!inspectedAux || !inspectedBlock) {
            return;
        }

        bridge.setBlockAuxTargetEnabled({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            enabled: !inspectedAux.targets[paramIndex]?.enabled,
        });
    }

    function setAuxSource(source: Partial<SeqFxAuxSource>) {
        if (!inspectedBlock) {
            return;
        }

        bridge.setBlockAuxSource({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            source,
        });
    }

    function modulationForCrusher(): CrusherModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            phase: inspectedAuxAmount,
            bits: auxTarget(CRUSHER_PARAM_BITS),
            rateHz: auxTarget(CRUSHER_PARAM_RATE_HZ),
            driveDb: auxTarget(CRUSHER_PARAM_DRIVE_DB),
            adcQuality: auxTarget(CRUSHER_PARAM_ADC_QUALITY),
            dacQuality: auxTarget(CRUSHER_PARAM_DAC_QUALITY),
            dither: auxTarget(CRUSHER_PARAM_DITHER),
            onToggleBits: () => toggleAuxTarget(CRUSHER_PARAM_BITS),
            onToggleRateHz: () => toggleAuxTarget(CRUSHER_PARAM_RATE_HZ),
            onToggleDriveDb: () => toggleAuxTarget(CRUSHER_PARAM_DRIVE_DB),
            onToggleAdcQuality: () => toggleAuxTarget(CRUSHER_PARAM_ADC_QUALITY),
            onToggleDacQuality: () => toggleAuxTarget(CRUSHER_PARAM_DAC_QUALITY),
            onToggleDither: () => toggleAuxTarget(CRUSHER_PARAM_DITHER),
        };
    }

    function modulationForStutter(): StutterModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            phase: inspectedAuxAmount,
            slices: auxTarget(STUTTER_PARAM_SLICES),
            speed: auxTarget(STUTTER_PARAM_SPEED),
            shape: auxTarget(STUTTER_PARAM_SHAPE),
            gate: auxTarget(STUTTER_PARAM_GATE),
            onToggleSlices: () => toggleAuxTarget(STUTTER_PARAM_SLICES),
            onToggleSpeed: () => toggleAuxTarget(STUTTER_PARAM_SPEED),
            onToggleShape: () => toggleAuxTarget(STUTTER_PARAM_SHAPE),
            onToggleGate: () => toggleAuxTarget(STUTTER_PARAM_GATE),
        };
    }

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setPatternPreview(null);
        setInvalidDropTarget(null);
        setSelectedCell(null);
        setSelection(null);
    }

    function activateCell(lane: number, step: number, shiftKey: boolean) {
        setInvalidDropTarget(null);

        if (shiftKey && selectedCell && selectedCell.lane === lane) {
            const nextSelection = mergeRangeSelection(selectedCell, { lane, step });
            setSelection(nextSelection);
            return;
        }

        bridge.createBlock({
            patternIndex: selectedPattern,
            lane,
            startStep: step,
            length: 1,
            effectType: drawEffectType ?? defaultEffectTypeForChain(lane),
        });
        setSelectedCell({ lane, step });
        setSelection({ lane, steps: [step], blockStartSteps: [step] });
    }

    function handleCellPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, step: number) {
        if (event.button !== 0) {
            return;
        }

        activateCell(lane, step, event.shiftKey);
    }

    function isKeyboardActivation(event: ReactKeyboardEvent<HTMLElement>) {
        return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
    }

    function handleCellKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, step: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        activateCell(lane, step, event.shiftKey);
    }

    function handleBlockPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
        if (event.button !== 0) {
            return;
        }

        event.stopPropagation();
        if (gestureRef.current) {
            event.preventDefault();
            return;
        }
        const grabOffset = pointerGrabOffset(lane, startStep, length, event.clientX, event.clientY);
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const activeBlockStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        const clickedSelectedBlock = activeBlockStarts.includes(startStep);

        if (event.shiftKey) {
            const anchorBlock = selectedCell?.lane === lane
                ? getSeqFxBlockAtStep(pattern, lane, selectedCell.step)
                : null;
            const blockStartSteps = anchorBlock
                ? blockStartsBetween(pattern, lane, anchorBlock.startStep, startStep)
                : [startStep];

            selectBlockStartsFromPattern(pattern, lane, blockStartSteps, anchorBlock?.startStep ?? startStep);
            return;
        }

        if (event.altKey || event.getModifierState("Alt") || optionKeyRef.current) {
            if (clickedSelectedBlock && activeBlockStarts.length > 1) {
                const bounds = selectionAnchorDragBounds(pattern, lane, activeBlockStarts, startStep);
                beginGesture({
                    mode: "selectionCopy",
                    pointerId: event.pointerId,
                    lane,
                    blockStartSteps: [...activeBlockStarts],
                    anchorStartStep: startStep,
                    grabOffset,
                    pointerStartX: event.clientX,
                    pointerStartY: event.clientY,
                    hasMoved: false,
                    anchorMinStartStep: bounds.minStartStep,
                    anchorMaxStartStep: bounds.maxStartStep,
                    previewTargetLane: null,
                    previewTargetAnchorStartStep: null,
                    previewCopiedStartSteps: null,
                });
                return;
            }

            selectBlockRange(lane, startStep, length);
            beginGesture({
                mode: "copy",
                pointerId: event.pointerId,
                lane,
                sourceStartStep: startStep,
                length,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
                previewTargetLane: null,
                previewTargetStartStep: null,
            });
            return;
        }

        if (clickedSelectedBlock && activeBlockStarts.length > 1) {
            const bounds = selectionAnchorDragBounds(pattern, lane, activeBlockStarts, startStep);
            beginGesture({
                mode: "selectionMove",
                pointerId: event.pointerId,
                lane,
                blockStartSteps: [...activeBlockStarts],
                anchorStartStep: startStep,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
                anchorMinStartStep: bounds.minStartStep,
                anchorMaxStartStep: bounds.maxStartStep,
                previewTargetLane: null,
                previewTargetAnchorStartStep: null,
                previewMovedStartSteps: null,
            });
            return;
        }

        selectBlockRange(lane, startStep, length);
        beginGesture({
            mode: "move",
            pointerId: event.pointerId,
            lane,
            sourceStartStep: startStep,
            length,
            grabOffset,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            hasMoved: false,
            previewTargetLane: null,
            previewTargetStartStep: null,
        });
    }

    function handleBlockKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, lane: number, startStep: number, length: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        selectBlockRange(lane, startStep, length);
    }

    function handleBlockDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, startStep);
    }

    function handleCellDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, step: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, step);
    }

    function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>, lane: number, startStep: number, length: number) {
        event.preventDefault();
        event.stopPropagation();
        if (gestureRef.current) {
            return;
        }
        beginGesture({
            mode: "resize",
            pointerId: event.pointerId,
            lane,
            startStep,
            length,
            previewLength: null,
        });
    }

    function handleResizeKeyDown(
        event: ReactKeyboardEvent<HTMLSpanElement>,
        lane: number,
        startStep: number,
        length: number,
        maximumLength: number,
    ) {
        let requestedLength: number;

        switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown":
                requestedLength = length - 1;
                break;
            case "ArrowRight":
            case "ArrowUp":
                requestedLength = length + 1;
                break;
            case "Home":
                requestedLength = 1;
                break;
            case "End":
                requestedLength = maximumLength;
                break;
            default:
                return;
        }

        event.preventDefault();
        event.stopPropagation();
        const nextLength = Math.min(maximumLength, Math.max(1, requestedLength));
        if (nextLength === length) {
            return;
        }

        bridge.resizeBlock({
            patternIndex: selectedPatternRef.current,
            lane,
            startStep,
            length: nextLength,
        });
        selectBlockRange(lane, startStep, nextLength);
        setPatternPreview(null);
        setInvalidDropTarget(null);
    }

    function handleInspectorPointerDownCapture(event: PointerEvent<HTMLElement>) {
        if (isPromoControlled || (event.pointerType === "mouse" && event.button !== 0)) {
            return;
        }

        if (liveEditPointerIdRef.current !== null) {
            return;
        }

        liveEditPointerIdRef.current = event.pointerId;
        bridge.beginLiveEdit();
    }

    function setMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockMix({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                value,
            });
        } else {
            bridge.setStepMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                value,
            });
        }
    }

    function setParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockParam({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                paramIndex,
                value,
            });
        } else {
            bridge.setStepParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                paramIndex,
                value,
            });
        }
    }

    function renderInspectedParam(definition: ParamDefinition) {
        const triggerLatched = isSeqFxTriggerLatchedParamForEffect(inspectedEffectType, definition.index);
        const disabled = triggerLatched && !selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1;
        const value = inspectedCell?.params[definition.index] ?? definition.defaultValue;

        return (
            <SeqFxParameterField
                definition={definition}
                disabled={disabled}
                key={definition.index}
                onChange={(nextValue) => setParam(definition.index, nextValue)}
                triggerLatched={triggerLatched}
                value={value}
            />
        );
    }

    function setEffectType(value: number) {
        const nextEffectType = isEffectOption(value)
            ? value
            : SEQFX_EFFECT_TYPES.filter;
        setDrawEffectType(nextEffectType);

        if (!inspectedBlock || !activeSelection || activeSelection.blockStartSteps?.length !== 1) {
            return;
        }

        bridge.setBlockEffect({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            effectType: nextEffectType,
        });
    }

    function applyFactoryPreset(presetId: string) {
        if (!inspectedBlock || selectedBlockStartSteps.length > 1) {
            return;
        }

        const preset = inspectedEffectDefinition.factoryPresets.find((candidate) => candidate.id === presetId);
        if (!preset) {
            return;
        }

        bridge.applyBlockPreset({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            mix: preset.mix,
            params: preset.params,
        });
    }

    function setFilterValue(nextValue: FilterRangeValue) {
        if (!inspectedCell) {
            return;
        }

        const currentValue = filterRangeValueFromSeqFxStep(inspectedCell);
        const currentRange = filterRangeEndpointsFromSeqFxStep(inspectedCell);
        const currentMode = filterRangeModeToSeqFxMode(currentValue.mode);
        const nextMode = filterRangeModeToSeqFxMode(nextValue.mode);

        if (nextMode !== currentMode) {
            setParam(FILTER_PARAM_MODE, nextMode);
        }

        if (Math.abs(nextValue.q - currentValue.q) > 0.000001) {
            setParam(FILTER_PARAM_RESONANCE, nextValue.q);
        }

        if (Math.abs(nextValue.cutoffHz - currentValue.cutoffHz) <= 0.000001) {
            return;
        }

        const direction = currentRange.endCutoffHz >= currentRange.startCutoffHz ? 1 : -1;
        const nextRange = cutoffsFromCenterRangeOctaves({
            centerCutoffHz: nextValue.cutoffHz,
            rangeOctaves: cutoffRangeOctaves(currentRange.startCutoffHz, currentRange.endCutoffHz),
            direction,
        });

        setFilterRange(nextRange);
    }

    function setFilterRange(nextRange: FilterRangeEndpoints) {
        setParam(FILTER_PARAM_CUTOFF, nextRange.startCutoffHz);

        if (!inspectedBlock) {
            return;
        }

        const shouldModulateCutoff = Math.abs(nextRange.endCutoffHz - nextRange.startCutoffHz) > 0.000001;
        setAuxTargetEnd(FILTER_PARAM_CUTOFF, nextRange.endCutoffHz);

        if (selectedBlockGroup || (inspectedCell?.aux.targets[FILTER_PARAM_CUTOFF]?.enabled === true) !== shouldModulateCutoff) {
            setSelectedAuxTargetEnabled(FILTER_PARAM_CUTOFF, shouldModulateCutoff);
        }
    }

    function setStutterParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
        } else if (inspectedBlock) {
            bridge.setBlockParam({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                paramIndex,
                value,
            });
        } else {
            setParam(paramIndex, value);
        }
    }

    function setStutterMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                value,
            });
        } else if (inspectedBlock) {
            bridge.setBlockMix({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                value,
            });
        } else {
            setMix(value);
        }
    }

    function deleteSelectedBlock() {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
            });
        } else if (inspectedBlock) {
            bridge.deleteBlock({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
            });
        }
        setSelectedCell(null);
        setSelection(null);
        setPatternPreview(null);
        setInvalidDropTarget(null);
    }

    return (
        <main className={gestureState ? "seqfx-root is-dragging" : "seqfx-root"} data-role="seqfx-root">
            {promoControls?.hidePresetBar ? null : (
                <SeqFxPresetBarHost bridge={bridge} patchConnection={patchConnection} />
            )}

            <section className="seqfx-topbar" aria-label="SeqFX pattern controls">
                <div className="seqfx-title">
                    <SeqFxTitleSigil />
                    <h1>SeqFX</h1>
                </div>
                <div className="seqfx-patterns" role="group" aria-label="Patterns">
                    {Array.from({ length: SEQFX_PATTERN_COUNT }, (_unused, index) => (
                        <button
                            className={index === selectedPattern ? "seqfx-pattern is-selected" : "seqfx-pattern"}
                            key={index}
                            type="button"
                            aria-pressed={index === selectedPattern}
                            onClick={() => selectPattern(index)}
                            data-role="seqfx-pattern"
                            data-pattern={index}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </section>

            <SeqFxGlobalControlSurface
                controls={globalControls}
                internalRunning={internalRunning}
                playheadStep={playheadStep}
                canUndo={bridge.canUndo()}
                canRedo={bridge.canRedo()}
                hasLoopClipboard={runtimeHasLoopClipboard}
                onGlobalControl={(endpointID, value) => {
                    if (!isPromoControlled) {
                        bridge.setGlobalControl(endpointID, value);
                    }
                }}
                onGlobalControlCommit={(endpointID, value) => {
                    if (!isPromoControlled) {
                        bridge.commitGlobalControl(endpointID, value);
                    }
                }}
                onGlobalGestureStart={(endpointID) => {
                    if (!isPromoControlled) {
                        bridge.beginGlobalGesture(endpointID);
                    }
                }}
                onGlobalGestureEnd={(endpointID) => {
                    if (!isPromoControlled) {
                        bridge.endGlobalGesture(endpointID);
                    }
                }}
                onLoopRangeChange={(startStep, endStepExclusive) => {
                    if (!isPromoControlled) {
                        bridge.setLoopRange(startStep, endStepExclusive);
                    }
                }}
                onInternalTransport={(running) => {
                    if (isPromoControlled) {
                        return;
                    }
                    internalRunningRef.current = running;
                    setInternalRunning(running);
                    if (running) {
                        bridge.playInternal();
                    } else {
                        bridge.stopInternal();
                    }
                }}
                onReset={() => {
                    if (!isPromoControlled) {
                        bridge.resetInternal();
                    }
                }}
                onUndo={() => {
                    if (!isPromoControlled) {
                        bridge.undo();
                    }
                }}
                onRedo={() => {
                    if (!isPromoControlled) {
                        bridge.redo();
                    }
                }}
                onInitPattern={() => {
                    if (!isPromoControlled) {
                        bridge.initPattern();
                    }
                }}
                onClearLoop={() => {
                    if (!isPromoControlled) {
                        bridge.clearLoop();
                    }
                }}
                onCopyLoop={() => {
                    if (!isPromoControlled) {
                        bridge.copyLoop();
                        setHasLoopClipboard(bridge.canPasteLoop());
                    }
                }}
                onPasteLoop={() => {
                    if (!isPromoControlled) {
                        bridge.pasteLoop();
                    }
                }}
                onLoadFactoryPattern={(patternId) => {
                    if (!isPromoControlled) {
                        bridge.loadFactoryPattern(patternId);
                    }
                }}
                onVaryLoop={() => {
                    if (!isPromoControlled) {
                        bridge.varyLoop();
                    }
                }}
            />

            {showFirstUseHint ? (
                <aside className="seqfx-first-use" data-role="seqfx-first-use" role="status">
                    <strong>First pattern?</strong>
                    <span>Click a cell, drag a block edge to resize, choose a named effect, then open Mod. Dismissal lasts while this editor stays open.</span>
                    <button
                        aria-label="Dismiss first-use hint"
                        data-role="seqfx-first-use-dismiss"
                        onClick={() => setShowFirstUseHint(false)}
                        type="button"
                    >
                        Got it
                    </button>
                </aside>
            ) : null}

            <section className="seqfx-workspace" style={SEQFX_WORKSPACE_STYLE}>
                <div className={gridShellClassName} aria-label="Effect sequence grid">
                    {STEP_BARS.map((barSteps, barIndex) => (
                        <div className="seqfx-bar-section" data-role="seqfx-bar-section" data-bar={barIndex} key={barIndex}>
                            <div className="seqfx-step-header">
                                <div className="seqfx-lane-spacer" />
                                <div className="seqfx-step-track">
                                    {barSteps.map((step) => (
                                        <div
                                            className={playheadStep === step ? "seqfx-step-number is-playhead" : "seqfx-step-number"}
                                            key={step}
                                            style={gridGeometry.stepNumberStyle(step)}
                                        >
                                            {step + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="seqfx-bar-lanes" data-role="seqfx-bar-lanes" data-bar={barIndex}>
                                <SeqFxBarFrame barIndex={barIndex} hasArrow={barIndex === 0} />
                                {SEQFX_LANE_NAMES.map((laneName, lane) => {
                                    const laneBlocks = getSeqFxLaneBlocks(renderedPatternState, lane);
                                    const invalidBlocks = invalidDropTarget?.patternIndex === selectedPattern && invalidDropTarget.lane === lane
                                        ? invalidDropTarget.blocks
                                        : [];

                                    return (
                                        <div className="seqfx-lane-row" key={`${barIndex}:${laneName}`}>
                                            <div className="seqfx-lane-label">{laneName}</div>
                                            <div
                                                className="seqfx-lane-track"
                                                data-role="seqfx-lane-track"
                                                data-bar={barIndex}
                                                data-lane={lane}
                                                ref={(node) => {
                                                    const key = laneTrackRefKey(lane, barIndex);
                                                    if (node) {
                                                        laneTrackRefs.current.set(key, { lane, node });
                                                    } else {
                                                        laneTrackRefs.current.delete(key);
                                                    }
                                                }}
                                            >
                                                {barSteps.map((step) => {
                                                    const cell = renderedPatternState.lanes[lane].steps[step];
                                                    const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                                    const className = [
                                                        "seqfx-cell",
                                                        ...frameCornerClassNames(lane, barIndex, step, step),
                                                        gridGeometry.isAltBar(step) ? "is-alt-bar" : "",
                                                        cell.active ? "is-covered" : "",
                                                        selected ? "is-selected" : "",
                                                        playheadStep === step ? "is-playhead" : "",
                                                    ].filter(Boolean).join(" ");

                                                    return (
                                                        <div
                                                            aria-label={`${laneName} step ${step + 1}`}
                                                            aria-pressed={cell.active}
                                                            className={className}
                                                            data-role="seqfx-cell"
                                                            data-lane={lane}
                                                            data-step={step}
                                                            key={step}
                                                            onDoubleClick={(event) => handleCellDoubleClick(event, lane, step)}
                                                            onKeyDown={(event) => handleCellKeyDown(event, lane, step)}
                                                            onPointerDown={(event) => handleCellPointerDown(event, lane, step)}
                                                            ref={(node) => {
                                                                const key = cellRefKey(lane, step);
                                                                if (node) {
                                                                    cellRefs.current.set(key, node);
                                                                } else {
                                                                    cellRefs.current.delete(key);
                                                                }
                                                            }}
                                                            role="button"
                                                            style={gridGeometry.cellStyle(step)}
                                                            tabIndex={0}
                                                        >
                                                            <span />
                                                        </div>
                                                    );
                                                })}
                                                {invalidBlocks.flatMap((block) => (
                                                    gridGeometry.blockSegments(block.startStep, block.length)
                                                        .filter((segment) => segment.barIndex === barIndex)
                                                        .map((segment) => (
                                                            <div
                                                                aria-hidden="true"
                                                                className={[
                                                                    "seqfx-invalid-drop",
                                                                    ...frameCornerClassNames(lane, barIndex, segment.startStep, segment.endStep),
                                                                ].join(" ")}
                                                                data-role="seqfx-invalid-drop"
                                                                data-lane={lane}
                                                                data-start={block.startStep}
                                                                data-segment-start={segment.startStep}
                                                                key={`invalid:${lane}:${block.startStep}:${segment.startStep}`}
                                                                style={segment.style}
                                                            />
                                                        ))
                                                ))}
                                                {laneBlocks.map((block, blockIndex) => {
                                                    const blockIsPreview = patternPreview?.patternIndex === selectedPattern
                                                        && patternPreview.lane === lane
                                                        && copyPreviewStartSteps.has(block.startStep);
                                                    const selected = activeSelection?.lane === lane
                                                        && (
                                                            activeSelection.blockStartSteps?.includes(block.startStep)
                                                            || (
                                                                activeSelection.steps[0] === block.startStep
                                                                && activeSelection.steps.length === block.length
                                                            )
                                                        );
                                                    const baseClassName = [
                                                        "seqfx-block",
                                                        blockIsPreview ? "is-copy-preview" : "",
                                                        selected ? "is-selected" : "",
                                                        focusedDurationBlock?.lane === lane
                                                            && focusedDurationBlock.startStep === block.startStep
                                                            ? "is-duration-focused"
                                                            : "",
                                                        playheadStep !== null && playheadStep >= block.startStep && playheadStep <= block.endStep ? "is-playhead" : "",
                                                    ].filter(Boolean).join(" ");
                                                    const effectName = SEQFX_EFFECT_TYPE_NAMES[block.effectType] ?? "Effect";
                                                    const ariaLabel = block.length === 1
                                                        ? `${laneName} ${effectName} block ${block.startStep + 1}`
                                                        : `${laneName} ${effectName} block ${block.startStep + 1}-${block.endStep + 1}`;
                                                    const maximumLength = (
                                                        laneBlocks[blockIndex + 1]?.startStep ?? SEQFX_STEP_COUNT
                                                    ) - block.startStep;

                                                    return gridGeometry.blockSegments(block.startStep, block.length)
                                                        .filter((segment) => segment.barIndex === barIndex)
                                                        .map((segment) => {
                                                            const primarySegment = segment.startStep === block.startStep;
                                                            const segmentLength = segment.endStep - segment.startStep + 1;
                                                            const stepParams = renderedPatternState.lanes[lane].steps[block.startStep]?.params ?? [];
                                                            return (
                                                                        <div
                                                                            className={[
                                                                                baseClassName,
                                                                                ...frameCornerClassNames(lane, barIndex, segment.startStep, segment.endStep),
                                                                            ].join(" ")}
                                                                    data-effect={block.effectType}
                                                                    data-role={primarySegment ? "seqfx-block" : "seqfx-block-segment"}
                                                                    data-lane={lane}
                                                                    data-preview={blockIsPreview ? "true" : undefined}
                                                                    data-start={block.startStep}
                                                                    data-segment-start={segment.startStep}
                                                                    key={`${lane}:${block.startStep}:${segment.startStep}`}
                                                                    onDoubleClick={(event) => handleBlockDoubleClick(event, lane, block.startStep)}
                                                                    onPointerDown={(event) => handleBlockPointerDown(event, lane, block.startStep, block.length)}
                                                                    style={segment.style}
                                                                >
                                                                    {primarySegment ? (
                                                                        <>
                                                                            <button
                                                                                aria-label={ariaLabel}
                                                                                className="seqfx-block-select-control"
                                                                                data-role="seqfx-block-select-control"
                                                                                onKeyDown={(event) => handleBlockKeyDown(event, lane, block.startStep, block.length)}
                                                                                type="button"
                                                                            />
                                                                            <span
                                                                                aria-label={`${laneName} ${effectName} block at step ${block.startStep + 1} duration`}
                                                                                aria-orientation="horizontal"
                                                                                aria-valuemax={maximumLength}
                                                                                aria-valuemin={1}
                                                                                aria-valuenow={block.length}
                                                                                aria-valuetext={`${block.length} ${block.length === 1 ? "step" : "steps"}`}
                                                                                className="seqfx-block-duration-control"
                                                                                data-role="seqfx-block-duration-control"
                                                                                onBlur={() => setFocusedDurationBlock((current) => (
                                                                                    current?.lane === lane && current.startStep === block.startStep
                                                                                        ? null
                                                                                        : current
                                                                                ))}
                                                                                onFocus={() => setFocusedDurationBlock({ lane, startStep: block.startStep })}
                                                                                onKeyDown={(event) => handleResizeKeyDown(
                                                                                    event,
                                                                                    lane,
                                                                                    block.startStep,
                                                                                    block.length,
                                                                                    maximumLength,
                                                                                )}
                                                                                role="slider"
                                                                                tabIndex={0}
                                                                            />
                                                                        </>
                                                                    ) : null}
                                                                    <span className="seqfx-block-fill">
                                                                        <SeqFxBlockGlyph
                                                                            effectType={block.effectType}
                                                                            params={stepParams}
                                                                            segmentLength={segmentLength}
                                                                        />
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className="seqfx-block-effect-label"
                                                                            data-effect={block.effectType}
                                                                            data-role="seqfx-block-effect-label"
                                                                        >
                                                                            {segmentLength > 1
                                                                                ? SEQFX_EFFECT_TYPE_SHORT_NAMES[block.effectType]
                                                                                : SEQFX_EFFECT_TYPE_SHORT_NAMES[block.effectType].slice(0, 1)}
                                                                        </span>
                                                                    </span>
                                                                    {segment.isEndSegment ? (
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className="seqfx-block-resize"
                                                                            data-pointer-target="true"
                                                                            data-role="seqfx-block-resize"
                                                                            data-lane={lane}
                                                                            data-start={block.startStep}
                                                                            onPointerDown={(event) => handleResizePointerDown(event, lane, block.startStep, block.length)}
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        });
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <aside
                    className="seqfx-inspector"
                    data-role="seqfx-inspector"
                    onPointerDownCapture={handleInspectorPointerDownCapture}
                >
                    <div className="seqfx-inspector-heading">
                        <span aria-hidden="true" className="seqfx-inspector-heading__bullet" data-role="seqfx-inspector-bullet" />
                        <strong>{getSelectionLabel(activeSelection, inspectedCell?.active ? inspectedEffectType : null)}</strong>
                        <span aria-hidden="true" className="seqfx-inspector-heading__rule" data-role="seqfx-inspector-rule" />
                    </div>
                    {!inspectedCell?.active || inspectedLane === null ? (
                        <p className="seqfx-empty" data-role="seqfx-empty">
                            <SeqFxEmptyStateIcon />
                            <span>Choose a lane cell to edit its mix and effect settings.</span>
                        </p>
                    ) : (
                        <>
                            <div className="seqfx-effect-picker" data-role="seqfx-effect-type" role="group" aria-label="Effect">
                                <div className="seqfx-effect-picker__options">
                                    {EFFECT_OPTIONS.map((effectType) => {
                                        const selected = inspectedEffectType === effectType;
                                        return (
                                            <button
                                                key={effectType}
                                                type="button"
                                                className={selected ? "is-selected" : undefined}
                                                data-effect-type={effectType}
                                                data-role="seqfx-effect-type-option"
                                                disabled={selectedBlockStartSteps.length > 1}
                                                aria-label={SEQFX_EFFECT_TYPE_NAMES[effectType]}
                                                aria-pressed={selected}
                                                onClick={() => setEffectType(effectType)}
                                            >
                                                <SeqFxEffectIcon effectType={effectType} />
                                                <span className="seqfx-effect-picker__name">
                                                    {SEQFX_EFFECT_TYPE_NAMES[effectType]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="seqfx-inspector-tabs" role="tablist" aria-label="Inspector view">
                                <button
                                    aria-selected={!showModEditor}
                                    className={!showModEditor ? "is-selected" : undefined}
                                    data-role="seqfx-effect-tab"
                                    onClick={() => setInspectorMode("effect")}
                                    role="tab"
                                    type="button"
                                >
                                    Effect
                                </button>
                                {inspectedAux ? (
                                    <SeqFxModToggleButton
                                        aux={inspectedAux}
                                        cyclePhase={inspectedAuxCyclePhase}
                                        amount={inspectedAuxAmount}
                                        active={showModEditor}
                                        onClick={() => setInspectorMode(showModEditor ? "effect" : "mod")}
                                    />
                                ) : null}
                            </div>
                            <label className="seqfx-factory-preset">
                                <span>Effect preset</span>
                                <select
                                    aria-label={`${SEQFX_EFFECT_TYPE_NAMES[inspectedEffectType]} factory preset`}
                                    data-role="seqfx-factory-effect-preset"
                                    disabled={!inspectedBlock || selectedBlockStartSteps.length > 1}
                                    onChange={(event) => applyFactoryPreset(event.currentTarget.value)}
                                    value={matchingFactoryPreset?.id ?? ""}
                                >
                                    <option value="">Custom</option>
                                    {inspectedEffectDefinition.factoryPresets.map((preset) => (
                                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                                    ))}
                                </select>
                                <small data-role="seqfx-factory-effect-preset-description">
                                    {matchingFactoryPreset?.description ?? `Three level-conscious ${SEQFX_EFFECT_TYPE_NAMES[inspectedEffectType]} starting points.`}
                                </small>
                            </label>
                            <SeqFxMixRow
                                value={inspectedCell.mix}
                                onChange={inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? setStutterMix : setMix}
                            />
                            {showModEditor && inspectedAux ? (
                                <SeqFxModEditor
                                    aux={inspectedAux}
                                    cyclePhase={inspectedAuxCyclePhase}
                                    amount={inspectedAuxAmount}
                                    params={inspectedCell.params}
                                    definitions={inspectedAuxParamDefinitions}
                                    onSourceChange={setAuxSource}
                                    onTargetToggle={toggleAuxTarget}
                                    onTargetEndChange={setAuxTargetEnd}
                                />
                            ) : (
                                <>
                                    {inspectedEffectType === SEQFX_EFFECT_TYPES.filter ? (
                                        <SeqFxBespokeEditor parameterId="mode" parameterLabel="Mode">
                                            <FilterRangeEditor
                                                ariaLabel="SeqFX filter range editor"
                                                modeOptions={SEQFX_FILTER_MODE_OPTIONS}
                                                range={filterRangeEndpointsFromSeqFxStep(inspectedCell)}
                                                rangePolarity="bipolar"
                                                showHandleChips
                                                showModeControls
                                                value={filterRangeValueFromSeqFxStep(inspectedCell)}
                                                onRangeChange={setFilterRange}
                                                onValueChange={setFilterValue}
                                            />
                                        </SeqFxBespokeEditor>
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.crusher ? (
                                        <SeqFxBespokeEditor parameterId="character" parameterLabel="Character">
                                            <CrusherEditor
                                                value={crusherValueFromSeqFxStep(inspectedCell)}
                                                onBitsChange={(value) => setParam(CRUSHER_PARAM_BITS, value)}
                                                onRateHzChange={(value) => setParam(CRUSHER_PARAM_RATE_HZ, value)}
                                                onDriveDbChange={(value) => setParam(CRUSHER_PARAM_DRIVE_DB, value)}
                                                onCharacterChange={(value) => setParam(CRUSHER_PARAM_CHARACTER, value)}
                                                onAdcQualityChange={(value) => setParam(CRUSHER_PARAM_ADC_QUALITY, value)}
                                                onDacQualityChange={(value) => setParam(CRUSHER_PARAM_DAC_QUALITY, value)}
                                                onDitherChange={(value) => setParam(CRUSHER_PARAM_DITHER, value)}
                                                modulation={modulationForCrusher()}
                                            />
                                        </SeqFxBespokeEditor>
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.tapeStop ? (
                                        <TapeStopV2Editor
                                            cellDurationMs={observedStepDurationMs ?? estimatedStepDurationMsForRateIndex(rateIndex)}
                                            cellsPerBeat={cellsPerBeat}
                                            step={inspectedCell}
                                            disabled={!selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1}
                                            onParamChange={setParam}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? (
                                        <SeqFxBespokeEditor parameterId="slices" parameterLabel="Slices">
                                            <StutterEnvelopeEditor
                                                value={stutterValueFromSeqFxStep(inspectedCell)}
                                                onGateChange={(value) => setStutterParam(STUTTER_PARAM_GATE, value)}
                                                onShapeChange={(value) => setStutterParam(STUTTER_PARAM_SHAPE, value)}
                                                onSlicesChange={(value) => setStutterParam(STUTTER_PARAM_SLICES, value)}
                                                onSpeedChange={(value) => setStutterParam(STUTTER_PARAM_SPEED, value)}
                                                modulation={modulationForStutter()}
                                            />
                                        </SeqFxBespokeEditor>
                                    ) : (
                                        <>
                                            {inspectedEffectType === SEQFX_EFFECT_TYPES.reverse ? (
                                                <p className="seqfx-reverse-source-note" data-role="seqfx-reverse-source-note">
                                                    Reverses audio already heard before the block, so it adds no lookahead latency. On a cold start, dry audio continues until one complete source window exists.
                                                </p>
                                            ) : null}
                                            <div className="seqfx-parameter-section" data-role="seqfx-primary-parameters">
                                                {inspectedPrimaryParamDefinitions.map(renderInspectedParam)}
                                            </div>
                                            {inspectedAdvancedParamDefinitions.length > 0 ? (
                                                <details
                                                    className="seqfx-advanced-parameters"
                                                    data-role="seqfx-advanced-parameters"
                                                    key={inspectedEffectType}
                                                >
                                                    <summary>
                                                        Advanced
                                                        <span>{inspectedAdvancedParamDefinitions.length}</span>
                                                    </summary>
                                                    <div className="seqfx-parameter-section">
                                                        {inspectedAdvancedParamDefinitions.map(renderInspectedParam)}
                                                    </div>
                                                </details>
                                            ) : null}
                                        </>
                                    )}
                                </>
                            )}
                            {selectedBlockGroup || (selectedWholeBlock && inspectedBlock) ? (
                                <button
                                    className="seqfx-delete-block"
                                    data-role="seqfx-delete-block"
                                    onClick={deleteSelectedBlock}
                                    type="button"
                                >
                                    <SeqFxDeleteGlyph />
                                    <span>{selectedBlockStartSteps.length > 1 ? "Delete Selection" : "Delete Block"}</span>
                                </button>
                            ) : null}
                        </>
                    )}
                </aside>
            </section>

        </main>
    );
}
