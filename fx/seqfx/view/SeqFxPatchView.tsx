import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from "react";

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
import { AuxSource, auxSourceMonitorPoint, buildAuxSourcePreviewPath } from "./AuxSource";
import { CrusherEditor, type CrusherModulation } from "./CrusherEditor";
import { StutterEnvelopeEditor, type StutterModulation } from "./StutterEnvelopeEditor";
import {
    SEQFX_EFFECT_TYPES,
    SEQFX_EFFECT_TYPE_NAMES,
    SEQFX_EFFECT_TYPE_SHORT_NAMES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
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
import {
    TAPE_STOP_MAX_CATCHUP_PERCENT,
    TAPE_STOP_MAX_CURVE,
    TAPE_STOP_MAX_STOP_POINT_PERCENT,
    TAPE_STOP_MIN_CATCHUP_PERCENT,
    TAPE_STOP_MIN_CURVE,
    TAPE_STOP_MIN_STOP_POINT_PERCENT,
    TAPE_STOP_MODE_SPIN_UP,
    TAPE_STOP_MODE_STOP,
    TAPE_STOP_SPEED_FLOOR,
    evaluateTapeStopDisplaySpeed,
    multiplierToStopPointPercent,
    resolveTapeStopEnvelope,
    sampleTapeStopDisplayEnvelope,
    stopPointPercentToMultiplier,
} from "./tape-stop-envelope";
import { createSeqFxPresetStateAdapter } from "./seqfx-preset-adapter";
import { SEQFX_ENDPOINTS, SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

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

type ResizeGesture = {
    mode: "resize";
    lane: number;
    startStep: number;
    length: number;
    previewLength: number | null;
};

type MoveGesture = {
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

type BlockSelectionMoveGesture = {
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

type CopyGesture = {
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

type BlockSelectionCopyGesture = {
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

type ParamDefinition = {
    index: number;
    label: string;
    min: number;
    max: number;
    step: number;
    kind?: "select";
    amountKind?: ParamAmountKind;
    options?: string[];
    hint?: string;
};

type ParamAmountKind =
    | "cutoffOctaves"
    | "integer"
    | "linear"
    | "db"
    | "speed"
    | "percentPoints"
    | "percentValue"
    | "tapeStopPointPercent"
    | "stutterShape";

const EFFECT_OPTIONS = [
    SEQFX_EFFECT_TYPES.filter,
    SEQFX_EFFECT_TYPES.crusher,
    SEQFX_EFFECT_TYPES.tapeStop,
    SEQFX_EFFECT_TYPES.stutter,
] as const;

function defaultEffectTypeForChain(chain: number) {
    return EFFECT_OPTIONS[Math.min(EFFECT_OPTIONS.length - 1, Math.max(0, chain))] ?? SEQFX_EFFECT_TYPES.filter;
}

// Effect picker SVGs copied from Iconify API: FontAudio filter-lowpass/repeat (CC BY 4.0, @fefanto),
// Iconoir square-wave (MIT), and Lucide cassette-tape (ISC).
function SeqFxEffectIcon({ effectType }: { effectType: SeqFxEffectType }) {
    switch (effectType) {
        case SEQFX_EFFECT_TYPES.filter:
            return (
                <svg aria-hidden="true" focusable="false" viewBox="0 0 256 256">
                    <path
                        fill="currentColor"
                        fillRule="evenodd"
                        d="M24.22 67.796a3.995 3.995 0 0 1 4.008-3.991h85.498c8.834 0 19.732 6.112 24.345 13.657l53.76 87.936c3.46 5.66 11.628 10.247 18.256 10.247h16.718a3.996 3.996 0 0 1 3.994 4.007v8.985a4.007 4.007 0 0 1-4.007 4.008h-24.7c-8.835 0-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995 3.995 0 0 1-3.993-3.992V67.796z"
                    />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.crusher:
            return (
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                    <path
                        d="M3 12h3V4h6v16h6v-8h3m-6.5 0h1m-7 0h1"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                    />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.tapeStop:
            return (
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <circle cx="8" cy="10" r="2" />
                        <path d="M8 12h8" />
                        <circle cx="16" cy="10" r="2" />
                        <path d="m6 20l.7-2.9A1.4 1.4 0 0 1 8.1 16h7.8a1.4 1.4 0 0 1 1.4 1l.7 3" />
                    </g>
                </svg>
            );
        case SEQFX_EFFECT_TYPES.stutter:
            return (
                <svg aria-hidden="true" focusable="false" viewBox="0 0 256 256">
                    <g fill="currentColor" fillRule="evenodd">
                        <path d="M109.533 197.602a1.887 1.887 0 0 1-.034 2.76l-7.583 7.066a4.095 4.095 0 0 1-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581 4.11-1.658 5.74-.18l7.655 6.94c.82.743.833 1.952.02 2.708l-21.11 19.659s53.036.129 71.708.064c18.672-.064 33.437-16.973 33.437-34.7c0-7.214-5.578-17.64-5.578-17.64c-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794 1.772-.632 2.242.364c0 0 9.212 18.651 9.212 28.562c0 28.035-21.765 50.882-48.533 50.882s-70.921.201-70.921.201z" />
                        <path d="M144.398 58.435a1.887 1.887 0 0 1 .034-2.76l7.583-7.066a4.095 4.095 0 0 1 5.714.152l32.918 34.095c1.537 1.592 1.54 4.162.002 5.746l-33.1 34.092c-1.536 1.581-4.11 1.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437 16.973-33.437 34.7c0 7.214 5.578 17.64 5.578 17.64c.498.99.273 2.444-.483 3.229l-8.61 8.94c-.764.794-1.772.632-2.242-.364c0 0-9.212-18.65-9.212-28.562c0-28.035 21.765-50.882 48.533-50.882s70.921-.201 70.921-.201z" />
                    </g>
                </svg>
            );
        default:
            return null;
    }
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
            <span>Block mix</span>
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
            <output>{formatValue(value)}</output>
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
    if (definition.amountKind === "tapeStopPointPercent") {
        return multiplierToStopPointPercent(rawValue);
    }

    if (definition.amountKind === "percentPoints") {
        return rawValue * 100;
    }

    return rawValue;
}

function rawValueFromModDisplay(definition: ParamDefinition, displayValue: number) {
    if (definition.amountKind === "tapeStopPointPercent") {
        return stopPointPercentToMultiplier(displayValue);
    }

    if (definition.amountKind === "percentPoints") {
        return displayValue / 100;
    }

    return displayValue;
}

function modDisplayBounds(definition: ParamDefinition) {
    if (definition.amountKind === "tapeStopPointPercent") {
        return {
            min: TAPE_STOP_MIN_STOP_POINT_PERCENT,
            max: TAPE_STOP_MAX_STOP_POINT_PERCENT,
        };
    }

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
        : definition.amountKind === "tapeStopPointPercent"
            ? 1
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
    switch (definition.amountKind) {
        case "cutoffOctaves":
            return `${formatSignedFixed(amount, 2)} oct`;
        case "integer":
            return formatSignedFixed(Math.round(amount), 0);
        case "db":
            return `${formatSignedFixed(amount, 1)} dB`;
        case "speed":
            return `${formatSignedFixed(amount, 2)}x`;
        case "percentPoints":
        case "percentValue":
        case "tapeStopPointPercent":
            return `${formatSignedFixed(Math.round(amount), 0)}%`;
        case "stutterShape":
        case "linear":
        default:
            return formatSignedFixed(amount, 2);
    }
}

function formatModDestinationValue(definition: ParamDefinition, value: number) {
    switch (definition.amountKind) {
        case "cutoffOctaves":
            return formatFilterHzChip(value);
        case "integer":
            return String(Math.round(value));
        case "db":
            return `${value.toFixed(1)} dB`;
        case "speed":
            return `${value.toFixed(2)}x`;
        case "percentPoints":
            return `${Math.round(value * 100)}%`;
        case "percentValue":
            return `${Math.round(value)}%`;
        case "tapeStopPointPercent":
            return `${Math.round(multiplierToStopPointPercent(value))}%`;
        case "stutterShape":
            return formatStutterShapeLabel(value);
        case "linear":
        default:
            return formatValue(value);
    }
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
            className={`seqfx-mod-toggle${active ? " is-selected" : ""}${targetCount > 0 ? " has-targets" : ""}`}
            data-role="seqfx-mod-toggle"
            onClick={onClick}
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
                    const amountTrackStyle = {
                        "--mod-amount-fill-start": `${Math.min(50, fillPosition)}%`,
                        "--mod-amount-fill-end": `${Math.max(50, fillPosition)}%`,
                    } as CSSProperties;

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
                            {definition.kind === "select" ? (
                                <select
                                    aria-label={`${definition.label} modulation destination`}
                                    className="seqfx-mod-target-row__select"
                                    data-param={definition.index}
                                    data-role="seqfx-mod-target-destination"
                                    disabled={!enabled}
                                    onChange={(event) => onTargetEndChange(definition.index, Number(event.currentTarget.value))}
                                    value={Math.round(endValue)}
                                >
                                    {definition.options!.map((option, index) => (
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

const PARAM_DEFINITIONS: Record<number, ParamDefinition[]> = {
    [SEQFX_EFFECT_TYPES.filter]: [
        { index: 0, label: "Mode", min: 0, max: 2, step: 1, kind: "select", options: ["Lowpass", "Highpass", "Bandpass"] },
        { index: 1, label: "Cutoff", min: 20, max: 20000, step: 1, amountKind: "cutoffOctaves" },
        { index: 3, label: "Resonance", min: 0.1, max: 20, step: 0.01, amountKind: "linear" },
    ],
    [SEQFX_EFFECT_TYPES.crusher]: [
        { index: 0, label: "Bits", min: 4, max: 16, step: 1, amountKind: "integer" },
        { index: 1, label: "Hold frames", min: 1, max: 64, step: 1, amountKind: "integer" },
        { index: 2, label: "Drive", min: 0, max: 36, step: 0.1, amountKind: "db" },
    ],
    [SEQFX_EFFECT_TYPES.tapeStop]: [
        { index: 0, label: "Start Length", min: 0.05, max: 4, step: 0.01, amountKind: "tapeStopPointPercent" },
        { index: 1, label: "Start Curve", min: 0.25, max: 4, step: 0.01, amountKind: "linear" },
        { index: 2, label: "Catchup Curve", min: 0.25, max: 4, step: 0.01, amountKind: "linear" },
        { index: 3, label: "Catchup Length", min: 0, max: 100, step: 1, amountKind: "percentValue" },
        { index: 4, label: "Mode", min: 0, max: 1, step: 1, kind: "select", options: ["Stop", "Spin-up"] },
    ],
    [SEQFX_EFFECT_TYPES.stutter]: [
        { index: 0, label: "Slices", min: 2, max: 32, step: 1, amountKind: "integer", hint: "Record slice 1; repeat the rest." },
        { index: 1, label: "Speed", min: 0.5, max: 2, step: 0.01, amountKind: "speed", hint: "1.00 keeps the captured pitch." },
        { index: 2, label: "Shape", min: 0, max: 1, step: 0.01, amountKind: "stutterShape", hint: "Morphs the per-cut envelope." },
        { index: 3, label: "Gate", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Audible portion of each cut." },
    ],
};

const FILTER_PARAM_MODE = 0;
const FILTER_PARAM_CUTOFF = 1;
const FILTER_PARAM_RESONANCE = 3;
const CRUSHER_PARAM_BITS = 0;
const CRUSHER_PARAM_HOLD_FRAMES = 1;
const CRUSHER_PARAM_DRIVE_DB = 2;
const TAPE_STOP_PARAM_START_LENGTH = 0;
const TAPE_STOP_PARAM_START_CURVE = 1;
const TAPE_STOP_PARAM_CATCHUP_CURVE = 2;
const TAPE_STOP_PARAM_CATCHUP_LENGTH = 3;
const TAPE_STOP_PARAM_MODE = 4;
const STUTTER_PARAM_SLICES = 0;
const STUTTER_PARAM_SPEED = 1;
const STUTTER_PARAM_SHAPE = 2;
const STUTTER_PARAM_GATE = 3;

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
        holdFrames: step.params[CRUSHER_PARAM_HOLD_FRAMES],
        driveDb: step.params[CRUSHER_PARAM_DRIVE_DB],
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
function cellsPerBeatForRateIndex(rateIndex: number) {
    return SEQFX_RATE_CELLS_PER_BEAT[Math.min(2, Math.max(0, Math.round(rateIndex)))] ?? 4;
}

function gridColumnForStep(step: number) {
    return (Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step)) * 2) + 1;
}

function cellRefKey(lane: number, step: number) {
    return `${lane}:${step}`;
}

function createGridGeometry(cellsPerBeat: number) {
    const cellsPerBar = cellsPerBeat * SEQFX_BEATS_PER_BAR;

    const cellStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: "1",
    });

    const blockStyle = (startStep: number, length: number): CSSProperties => {
        const lastStep = Math.min(SEQFX_STEP_COUNT - 1, startStep + length - 1);

        return {
            gridColumn: `${gridColumnForStep(startStep)} / ${gridColumnForStep(lastStep) + 1}`,
            gridRow: "1",
        };
    };

    const stepNumberStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: "1",
    });

    return {
        cellsPerBar,
        cellStyle,
        blockStyle,
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

function formatTapeStopPercent(value: number) {
    return `${Math.round(value)}%`;
}

function formatTapeStopCurve(value: number) {
    return `${Number(value.toFixed(2))}`;
}

function formatTapeStopSpeed(value: number) {
    return `${Number(value.toFixed(value >= 2 ? 1 : 2))}x`;
}

function estimatedStepDurationMsForRateIndex(rateIndex: number) {
    const quarterNoteMsAt120Bpm = 500;
    const quarterNotesPerStep = rateIndex <= 0 ? 0.5 : rateIndex >= 2 ? 0.125 : 0.25;
    return quarterNoteMsAt120Bpm * quarterNotesPerStep;
}

const TAPE_GRAPH_WIDTH = 260;
const TAPE_GRAPH_HEIGHT = 150;
const TAPE_GRAPH_LEFT = 28;
const TAPE_GRAPH_RIGHT = 10;
const TAPE_GRAPH_TOP = 12;
const TAPE_GRAPH_BOTTOM = 24;
const TAPE_GRAPH_PLOT_WIDTH = TAPE_GRAPH_WIDTH - TAPE_GRAPH_LEFT - TAPE_GRAPH_RIGHT;
const TAPE_GRAPH_PLOT_HEIGHT = TAPE_GRAPH_HEIGHT - TAPE_GRAPH_TOP - TAPE_GRAPH_BOTTOM;

function tapeGraphX(normalizedTime: number) {
    return TAPE_GRAPH_LEFT + (clampNumber(normalizedTime, 0, 1) * TAPE_GRAPH_PLOT_WIDTH);
}

function tapeGraphY(speed: number, maxSpeed: number) {
    const normalizedSpeed = clampNumber(speed / maxSpeed, 0, 1);
    return TAPE_GRAPH_TOP + ((1 - normalizedSpeed) * TAPE_GRAPH_PLOT_HEIGHT);
}

function tapePathFromPoints(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) {
        return "";
    }

    const [first, ...rest] = points;
    return [
        `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
        ...rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    ].join(" ");
}

function curvePowerFromSpeedRatio(speedRatio: number, base: number) {
    const safeRatio = clampNumber(speedRatio, 0.001, 0.999);
    const safeBase = clampNumber(base, 0.001, 0.999);

    return clampNumber(
        Math.log(safeRatio) / Math.log(safeBase),
        TAPE_STOP_MIN_CURVE,
        TAPE_STOP_MAX_CURVE,
    );
}

function TapeStopRangeControl({
    label,
    value,
    valueLabel,
    min,
    max,
    step,
    dataRole,
    hint,
    disabled = false,
    onChange,
    modulation = null,
    onModulationToggle = null,
    formatEndValue = formatValue,
    endDataRole,
}: {
    label: string;
    value: number;
    valueLabel: string;
    min: number;
    max: number;
    step: number;
    dataRole: string;
    hint: string;
    disabled?: boolean;
    onChange: (value: number) => void;
    modulation?: AuxModulatedParam | null;
    onModulationToggle?: (() => void) | null;
    formatEndValue?: (value: number) => string;
    endDataRole?: string;
}) {
    const isModulated = Boolean(modulation);

    return (
        <div className={`seqfx-tape-control${isModulated ? " seqfx-tape-control--modulated" : ""}`}>
            <div className="seqfx-tape-control__head">
                {onModulationToggle ? (
                    <button
                        aria-pressed={isModulated}
                        className="seqfx-tape-control__label seqfx-tape-control__label--toggle"
                        data-role={`${dataRole}-mod-toggle`}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onModulationToggle();
                        }}
                        type="button"
                    >
                        <span>{label}</span>
                        <ModBadge isOn={isModulated} direction={modulation?.direction} />
                    </button>
                ) : (
                    <span className="seqfx-tape-control__label">{label}</span>
                )}
                {isModulated ? (
                    <output className="seqfx-tape-control__values">
                        <span className="seqfx-tape-control__chip seqfx-tape-control__chip--start">{valueLabel}</span>
                        <span className="seqfx-tape-control__arrow">-&gt;</span>
                        <span className="seqfx-tape-control__chip seqfx-tape-control__chip--end">{formatEndValue(modulation!.end)}</span>
                    </output>
                ) : (
                    <output>{valueLabel}</output>
                )}
            </div>
            <input
                data-role={dataRole}
                disabled={disabled}
                max={max}
                min={min}
                onChange={(event) => onChange(Number(event.currentTarget.value))}
                onInput={(event) => onChange(Number(event.currentTarget.value))}
                step={step}
                type="range"
                value={value}
            />
            {isModulated ? (
                <input
                    aria-label={`${label} end`}
                    className="seqfx-tape-control__end"
                    data-role={endDataRole ?? `${dataRole}-end`}
                    disabled={disabled}
                    max={max}
                    min={min}
                    onChange={(event) => modulation!.onEndChange(Number(event.currentTarget.value))}
                    onInput={(event) => modulation!.onEndChange(Number(event.currentTarget.value))}
                    step={step}
                    type="range"
                    value={modulation!.end}
                />
            ) : null}
            <small>{hint}</small>
        </div>
    );
}

type TapeStopModulation = {
    startLength?: AuxModulatedParam | null;
    startCurve?: AuxModulatedParam | null;
    catchupCurve?: AuxModulatedParam | null;
    catchupLength?: AuxModulatedParam | null;
    mode?: AuxModulatedParam | null;
    onToggleStartLength?: () => void;
    onToggleStartCurve?: () => void;
    onToggleCatchupCurve?: () => void;
    onToggleCatchupLength?: () => void;
    onToggleMode?: () => void;
};

function TapeStopEnvelopeEditor({
    step,
    blockLength,
    blockDurationMs,
    onParamChange,
    modulation = null,
}: {
    step: SeqFxStep;
    blockLength: number;
    blockDurationMs: number;
    onParamChange: (paramIndex: number, value: number) => void;
    modulation?: TapeStopModulation | null;
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const dragModeRef = useRef<"startLength" | "startCurve" | "catchupLength" | "catchupCurve" | null>(null);
    const mode = Math.round(step.params[4]) === TAPE_STOP_MODE_SPIN_UP
        ? TAPE_STOP_MODE_SPIN_UP
        : TAPE_STOP_MODE_STOP;
    const stopPointPercent = multiplierToStopPointPercent(step.params[0]);
    const curve = clampNumber(step.params[1], TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupCurve = clampNumber(step.params[2], TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupPercent = clampNumber(step.params[3], TAPE_STOP_MIN_CATCHUP_PERCENT, TAPE_STOP_MAX_CATCHUP_PERCENT);
    const envelope = useMemo(() => resolveTapeStopEnvelope({
        blockDurationMs,
        mode,
        stopPointPercent,
        curve,
        catchupPercent,
        catchupCurve,
    }), [blockDurationMs, catchupCurve, catchupPercent, curve, mode, stopPointPercent]);
    const samples = useMemo(() => sampleTapeStopDisplayEnvelope(envelope, 96), [envelope]);
    const maxGraphSpeed = 1;
    const graphPoints = samples.map((sample) => ({
        x: tapeGraphX(sample.normalizedTime),
        y: tapeGraphY(sample.speed, maxGraphSpeed),
    }));
    const graphPath = tapePathFromPoints(graphPoints);
    const fillPath = `${graphPath} L ${tapeGraphX(1).toFixed(2)} ${tapeGraphY(0, maxGraphSpeed).toFixed(2)} L ${tapeGraphX(0).toFixed(2)} ${tapeGraphY(0, maxGraphSpeed).toFixed(2)} Z`;
    const oneXLineY = tapeGraphY(1, maxGraphSpeed);
    const stopPointVisible = envelope.stopPointPercent <= 100;
    const stopPointX = tapeGraphX(Math.min(1, envelope.stopPointPercent / 100));
    const stopPointY = tapeGraphY(
        evaluateTapeStopDisplaySpeed(envelope, Math.min(envelope.stopPointMs, envelope.blockDurationMs)),
        maxGraphSpeed,
    );
    const catchupStartX = tapeGraphX(envelope.catchupStartMs / envelope.blockDurationMs);
    const catchupStartY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, envelope.catchupStartMs), maxGraphSpeed);
    const catchupWidth = TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH - catchupStartX;
    const curveHandleTimeMs = Math.max(1, Math.min(envelope.stopPointMs, envelope.blockDurationMs) * 0.5);
    const curveHandleX = tapeGraphX(curveHandleTimeMs / envelope.blockDurationMs);
    const curveHandleY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, curveHandleTimeMs), maxGraphSpeed);
    const catchupCurveHandleTimeMs = envelope.catchupDurationMs > 0
        ? envelope.catchupStartMs + (envelope.catchupDurationMs * 0.5)
        : envelope.blockDurationMs;
    const catchupCurveHandleX = tapeGraphX(catchupCurveHandleTimeMs / envelope.blockDurationMs);
    const catchupCurveHandleY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, catchupCurveHandleTimeMs), maxGraphSpeed);
    const requestedCatchupStartPercent = 100 - catchupPercent;
    const realizedCatchupStartPercent = Math.round((envelope.catchupStartMs / envelope.blockDurationMs) * 100);
    const catchupPushed = Math.round((envelope.catchupStartMs / envelope.blockDurationMs) * 100) > Math.round(requestedCatchupStartPercent);
    const modeLabel = mode === TAPE_STOP_MODE_SPIN_UP ? "Spin-up" : "Stop";
    const startLengthHint = mode === TAPE_STOP_MODE_SPIN_UP
        ? "Where the sound reaches normal speed."
        : "Where the slowdown reaches near-zero speed.";

    const graphPointFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const bounds = svgRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return null;
        }

        return {
            x: ((event.clientX - bounds.left) / bounds.width) * TAPE_GRAPH_WIDTH,
            y: ((event.clientY - bounds.top) / bounds.height) * TAPE_GRAPH_HEIGHT,
        };
    };

    const normalizedGraphXFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const point = graphPointFromPointer(event);
        if (!point) {
            return null;
        }

        return clampNumber(
            (point.x - TAPE_GRAPH_LEFT) / TAPE_GRAPH_PLOT_WIDTH,
            0,
            1,
        );
    };

    const speedRatioFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const point = graphPointFromPointer(event);
        if (!point) {
            return null;
        }

        const normalizedY = clampNumber(
            1 - ((point.y - TAPE_GRAPH_TOP) / TAPE_GRAPH_PLOT_HEIGHT),
            TAPE_STOP_SPEED_FLOOR + 0.001,
            0.999,
        );
        const targetSpeed = normalizedY * maxGraphSpeed;

        return clampNumber(
            (targetSpeed - TAPE_STOP_SPEED_FLOOR) / (1 - TAPE_STOP_SPEED_FLOOR),
            0.001,
            0.999,
        );
    };

    const updateStartLengthFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const normalizedX = normalizedGraphXFromPointer(event);
        if (normalizedX === null) {
            return;
        }

        const nextStartPercent = clampNumber(
            normalizedX * 100,
            TAPE_STOP_MIN_STOP_POINT_PERCENT,
            100,
        );
        onParamChange(0, stopPointPercentToMultiplier(nextStartPercent));
    };

    const updateCatchupLengthFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const normalizedX = normalizedGraphXFromPointer(event);
        if (normalizedX === null) {
            return;
        }

        const nextCatchupPercent = clampNumber(
            (1 - normalizedX) * 100,
            TAPE_STOP_MIN_CATCHUP_PERCENT,
            TAPE_STOP_MAX_CATCHUP_PERCENT,
        );
        const nextCatchupStartPercent = 100 - nextCatchupPercent;

        onParamChange(3, nextCatchupPercent);

        if (nextCatchupStartPercent < stopPointPercent && stopPointPercent <= 100) {
            onParamChange(0, stopPointPercentToMultiplier(Math.max(
                TAPE_STOP_MIN_STOP_POINT_PERCENT,
                nextCatchupStartPercent,
            )));
        }
    };

    const updateStartCurveFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        if (envelope.stopPointMs <= 1) {
            return;
        }

        const ratio = speedRatioFromPointer(event);
        if (ratio === null) {
            return;
        }

        const progress = clampNumber(curveHandleTimeMs / envelope.stopPointMs, 0.001, 0.999);
        const base = mode === TAPE_STOP_MODE_SPIN_UP ? progress : 1 - progress;
        onParamChange(1, curvePowerFromSpeedRatio(ratio, base));
    };

    const updateCatchupCurveFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        if (envelope.catchupDurationMs <= 1) {
            return;
        }

        const ratio = speedRatioFromPointer(event);
        if (ratio === null) {
            return;
        }

        const progress = clampNumber(
            (catchupCurveHandleTimeMs - envelope.catchupStartMs) / envelope.catchupDurationMs,
            0.001,
            0.999,
        );
        onParamChange(2, curvePowerFromSpeedRatio(ratio, progress));
    };

    const updateDragFromPointer = (mode: NonNullable<typeof dragModeRef.current>, event: PointerEvent<SVGSVGElement>) => {
        if (mode === "startLength") {
            updateStartLengthFromPointer(event);
        } else if (mode === "startCurve") {
            updateStartCurveFromPointer(event);
        } else if (mode === "catchupLength") {
            updateCatchupLengthFromPointer(event);
        } else if (mode === "catchupCurve") {
            updateCatchupCurveFromPointer(event);
        }
    };

    const handleGraphPointerDown = (mode: NonNullable<typeof dragModeRef.current>) => (event: PointerEvent<SVGCircleElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragModeRef.current = mode;
        svgRef.current?.setPointerCapture(event.pointerId);
        updateDragFromPointer(mode, event as unknown as PointerEvent<SVGSVGElement>);
    };

    const handleGraphPointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (dragModeRef.current) {
            updateDragFromPointer(dragModeRef.current, event);
        }
    };

    const endGraphDrag = (event: PointerEvent<SVGSVGElement>) => {
        if (!dragModeRef.current) {
            return;
        }

        dragModeRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <section className="seqfx-tape-editor" aria-label="Tape stop speed envelope">
            <svg
                ref={svgRef}
                className="seqfx-tape-graph"
                data-role="seqfx-tape-graph"
                viewBox={`0 0 ${TAPE_GRAPH_WIDTH} ${TAPE_GRAPH_HEIGHT}`}
                role="img"
                aria-label="Tape stop speed graph"
                onPointerMove={handleGraphPointerMove}
                onPointerUp={endGraphDrag}
                onPointerCancel={endGraphDrag}
            >
                <rect className="seqfx-tape-graph-bg" x={TAPE_GRAPH_LEFT} y={TAPE_GRAPH_TOP} width={TAPE_GRAPH_PLOT_WIDTH} height={TAPE_GRAPH_PLOT_HEIGHT} rx="5" />
                {envelope.catchupDurationMs > 0 ? (
                    <rect
                        className="seqfx-tape-catchup-region"
                        x={catchupStartX}
                        y={TAPE_GRAPH_TOP}
                        width={Math.max(0, catchupWidth)}
                        height={TAPE_GRAPH_PLOT_HEIGHT}
                    />
                ) : null}
                <line className="seqfx-tape-grid-line" x1={TAPE_GRAPH_LEFT} x2={TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH} y1={oneXLineY} y2={oneXLineY} />
                <line className="seqfx-tape-axis" x1={TAPE_GRAPH_LEFT} x2={TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH} y1={TAPE_GRAPH_TOP + TAPE_GRAPH_PLOT_HEIGHT} y2={TAPE_GRAPH_TOP + TAPE_GRAPH_PLOT_HEIGHT} />
                <path className="seqfx-tape-graph-fill" d={fillPath} />
                <path className="seqfx-tape-graph-line" d={graphPath} />
                <line className="seqfx-tape-marker-line" x1={catchupStartX} x2={catchupStartX} y1={TAPE_GRAPH_TOP} y2={TAPE_GRAPH_TOP + TAPE_GRAPH_PLOT_HEIGHT} />
                {stopPointVisible ? (
                    <circle
                        aria-label="Start length handle"
                        className="seqfx-tape-handle seqfx-tape-length-handle"
                        data-role="seqfx-tape-start-length-handle"
                        cx={stopPointX}
                        cy={stopPointY}
                        r="5"
                        onPointerDown={handleGraphPointerDown("startLength")}
                    />
                ) : (
                    <>
                        <path className="seqfx-tape-offscreen-marker" d={`M ${TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH - 7} ${TAPE_GRAPH_TOP + 8} L ${TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH} ${TAPE_GRAPH_TOP + 14} L ${TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH - 7} ${TAPE_GRAPH_TOP + 20}`} />
                        <text className="seqfx-tape-graph-label" x={TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH - 54} y={TAPE_GRAPH_TOP + 19}>{formatTapeStopPercent(stopPointPercent)}</text>
                    </>
                )}
                <circle
                    className="seqfx-tape-handle seqfx-tape-curve-handle"
                    data-role="seqfx-tape-start-curve-handle"
                    aria-label="Start curve handle"
                    cx={curveHandleX}
                    cy={curveHandleY}
                    r="5"
                    onPointerDown={handleGraphPointerDown("startCurve")}
                />
                <circle
                    aria-label="Catchup length handle"
                    className="seqfx-tape-handle seqfx-tape-length-handle"
                    data-role="seqfx-tape-catchup-length-handle"
                    cx={catchupStartX}
                    cy={catchupStartY}
                    r="5"
                    onPointerDown={handleGraphPointerDown("catchupLength")}
                />
                {envelope.catchupDurationMs > 0 ? (
                    <circle
                        aria-label="Catchup curve handle"
                        className="seqfx-tape-handle seqfx-tape-curve-handle"
                        data-role="seqfx-tape-catchup-curve-handle"
                        cx={catchupCurveHandleX}
                        cy={catchupCurveHandleY}
                        r="5"
                        onPointerDown={handleGraphPointerDown("catchupCurve")}
                    />
                ) : null}
                <text className="seqfx-tape-graph-label" x="4" y={oneXLineY + 4}>1x</text>
                <text className="seqfx-tape-graph-label" x="4" y={TAPE_GRAPH_TOP + TAPE_GRAPH_PLOT_HEIGHT - 2}>0x</text>
                <text className="seqfx-tape-graph-label" x={TAPE_GRAPH_LEFT} y={TAPE_GRAPH_HEIGHT - 5}>0</text>
                <text className="seqfx-tape-graph-label" x={TAPE_GRAPH_LEFT + TAPE_GRAPH_PLOT_WIDTH - 40} y={TAPE_GRAPH_HEIGHT - 5}>{blockLength} cell{blockLength === 1 ? "" : "s"}</text>
            </svg>
            <div className="seqfx-tape-readout">
                <span>Speed floor {formatTapeStopSpeed(TAPE_STOP_SPEED_FLOOR)}</span>
                <span>Start length {formatTapeStopPercent(stopPointPercent)}</span>
                <span>{catchupPushed ? `Catchup starts at ${realizedCatchupStartPercent}%` : `Catchup length ${formatTapeStopPercent(catchupPercent)}`}</span>
            </div>
            <div className={`seqfx-field seqfx-tape-mode-field${modulation?.mode ? " seqfx-tape-mode-field--modulated" : ""}`}>
                <span>
                    {modulation?.onToggleMode ? (
                        <button
                            aria-pressed={Boolean(modulation.mode)}
                            className="seqfx-tape-control__label seqfx-tape-control__label--toggle"
                            data-role="seqfx-tape-mode-mod-toggle"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                modulation.onToggleMode!();
                            }}
                            type="button"
                        >
                            <span>Mode</span>
                            <ModBadge isOn={Boolean(modulation.mode)} direction={modulation.mode?.direction} />
                        </button>
                    ) : (
                        "Mode"
                    )}
                    {modulation?.mode ? (
                        <output className="seqfx-tape-control__values">
                            <span className="seqfx-tape-control__chip seqfx-tape-control__chip--start">{modeLabel}</span>
                            <span className="seqfx-tape-control__arrow">-&gt;</span>
                            <span className="seqfx-tape-control__chip seqfx-tape-control__chip--end">
                                {Math.round(modulation.mode.end) === TAPE_STOP_MODE_SPIN_UP ? "Spin-up" : "Stop"}
                            </span>
                        </output>
                    ) : null}
                </span>
                <select
                    data-role="seqfx-tape-mode"
                    onChange={(event) => onParamChange(4, Number(event.currentTarget.value))}
                    value={mode}
                >
                    <option value={TAPE_STOP_MODE_STOP}>Stop</option>
                    <option value={TAPE_STOP_MODE_SPIN_UP}>Spin-up</option>
                </select>
                {modulation?.mode ? (
                    <select
                        aria-label="Mode end"
                        data-role="seqfx-tape-mode-end"
                        onChange={(event) => modulation.mode!.onEndChange(Number(event.currentTarget.value))}
                        value={Math.round(modulation.mode.end)}
                    >
                        <option value={TAPE_STOP_MODE_STOP}>Stop</option>
                        <option value={TAPE_STOP_MODE_SPIN_UP}>Spin-up</option>
                    </select>
                ) : null}
                <small>{modeLabel === "Spin-up" ? "Starts nearly stopped, then rises." : "Starts normal, then slows down."}</small>
            </div>
            <TapeStopRangeControl
                dataRole="seqfx-tape-stop-point"
                endDataRole="seqfx-tape-stop-point-end"
                label="Start Length"
                min={TAPE_STOP_MIN_STOP_POINT_PERCENT}
                max={TAPE_STOP_MAX_STOP_POINT_PERCENT}
                step={1}
                value={stopPointPercent}
                valueLabel={formatTapeStopPercent(stopPointPercent)}
                hint={startLengthHint}
                modulation={modulation?.startLength ? {
                    ...modulation.startLength,
                    end: multiplierToStopPointPercent(modulation.startLength.end),
                    onEndChange: (value) => modulation.startLength!.onEndChange(stopPointPercentToMultiplier(value)),
                } : null}
                onModulationToggle={modulation?.onToggleStartLength ?? null}
                formatEndValue={formatTapeStopPercent}
                onChange={(value) => onParamChange(0, stopPointPercentToMultiplier(value))}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-curve"
                endDataRole="seqfx-tape-curve-end"
                label="Start Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={curve}
                valueLabel={formatTapeStopCurve(curve)}
                hint="Bends the first part of the curve."
                modulation={modulation?.startCurve ?? null}
                onModulationToggle={modulation?.onToggleStartCurve ?? null}
                formatEndValue={formatTapeStopCurve}
                onChange={(value) => onParamChange(1, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup"
                endDataRole="seqfx-tape-catchup-end"
                label="Catchup Length"
                min={TAPE_STOP_MIN_CATCHUP_PERCENT}
                max={TAPE_STOP_MAX_CATCHUP_PERCENT}
                step={1}
                value={catchupPercent}
                valueLabel={formatTapeStopPercent(catchupPercent)}
                hint="How much of the block end is reserved for syncing back."
                modulation={modulation?.catchupLength ?? null}
                onModulationToggle={modulation?.onToggleCatchupLength ?? null}
                formatEndValue={formatTapeStopPercent}
                onChange={(value) => onParamChange(3, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup-curve"
                endDataRole="seqfx-tape-catchup-curve-end"
                label="Catchup Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={catchupCurve}
                valueLabel={formatTapeStopCurve(catchupCurve)}
                hint="Bends the return ramp."
                modulation={modulation?.catchupCurve ?? null}
                onModulationToggle={modulation?.onToggleCatchupCurve ?? null}
                formatEndValue={formatTapeStopCurve}
                onChange={(value) => onParamChange(2, value)}
            />
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

function getSelectionLabel(selection: Selection | null) {
    if (!selection) {
        return "Select a cell";
    }

    const blockStartSteps = selection.blockStartSteps ?? [];
    if (blockStartSteps.length > 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} blocks ${blockStartSteps.map((step) => step + 1).join(", ")}`;
    }

    if (selection.steps.length === 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} step ${selection.steps[0] + 1}`;
    }

    return `${SEQFX_LANE_NAMES[selection.lane]} steps ${selection.steps[0] + 1}-${selection.steps.at(-1)! + 1}`;
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
    }), [patchConnection, storedStateAdapter]);
    const snapshotController = useMemo(() => new EffectSnapshotBankController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
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

export function SeqFxPatchView({ patchConnection }: { patchConnection: PatchConnectionLike }) {
    const bridge = useMemo(() => new SeqFxRuntimeBridge(patchConnection), [patchConnection]);
    const [state, setState] = useState<SeqFxState>(() => bridge.getState());
    const [selectedPattern, setSelectedPattern] = useState(() => bridge.getSelectedPatternIndex());
    const [rateIndex, setRateIndex] = useState(() => bridge.getRateIndex());
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [playheadStep, setPlayheadStep] = useState<number | null>(null);
    const [observedStepDurationMs, setObservedStepDurationMs] = useState<number | null>(null);
    const [auxMonitor, setAuxMonitor] = useState<AuxMonitorState>(() => ({
        cyclePhase: Array.from({ length: 4 }, () => 0),
        amount: Array.from({ length: 4 }, () => 0),
        durationMs: Array.from({ length: 4 }, () => 0),
    }));
    const [drawEffectType, setDrawEffectType] = useState<SeqFxEffectType | null>(null);
    const [inspectorMode, setInspectorMode] = useState<InspectorMode>("effect");
    const [gestureState, setGestureState] = useState<BlockGesture | null>(null);
    const [patternPreview, setPatternPreview] = useState<PatternPreview | null>(null);
    const [invalidDropTarget, setInvalidDropTarget] = useState<InvalidDropTarget | null>(null);
    const cellsPerBeat = useMemo(() => cellsPerBeatForRateIndex(rateIndex), [rateIndex]);
    const gridGeometry = useMemo(() => createGridGeometry(cellsPerBeat), [cellsPerBeat]);
    const gridShellClassName = `seqfx-grid-shell seqfx-grid--beat-${cellsPerBeat}`;
    const laneTrackRefs = useRef(new Map<number, HTMLDivElement>());
    const cellRefs = useRef(new Map<string, HTMLDivElement>());
    const gestureRef = useRef<BlockGesture | null>(null);
    const optionKeyRef = useRef(false);
    const rateIndexRef = useRef(rateIndex);
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);
    const selectedCellRef = useRef<SelectedCell | null>(selectedCell);
    const activeSelectionRef = useRef<Selection | null>(null);
    const cellClipboardRef = useRef<SeqFxStepValueSnapshot | null>(null);

    rateIndexRef.current = rateIndex;
    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;
    selectedCellRef.current = selectedCell;

    useEffect(() => {
        bridge.attach();
        const unsubscribeState = bridge.subscribe((nextState) => {
            setState(nextState);
            setSelectedPattern(bridge.getSelectedPatternIndex());
        });
        const unsubscribeMonitor = bridge.subscribeMonitor((monitor) => {
            const event = (monitor as { event?: unknown })?.event ?? monitor;
            const stepIndex = Number((event as { stepIndex?: unknown })?.stepIndex);
            const stepDurationMs = Number((event as { stepDurationMs?: unknown })?.stepDurationMs);
            const auxCyclePhase = (event as { auxCyclePhase?: unknown })?.auxCyclePhase;
            const auxAmount = (event as { auxAmount?: unknown })?.auxAmount;
            const auxDurationMs = (event as { auxDurationMs?: unknown })?.auxDurationMs;
            setPlayheadStep(Number.isFinite(stepIndex) ? stepIndex : null);
            if (Number.isFinite(stepDurationMs) && stepDurationMs > 0) {
                setObservedStepDurationMs(stepDurationMs);
            }
            if (Array.isArray(auxCyclePhase) || Array.isArray(auxAmount) || Array.isArray(auxDurationMs)) {
                setAuxMonitor({
                    cyclePhase: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxCyclePhase) ? auxCyclePhase[index] : 0);
                        return Number.isFinite(value) ? clampNumber(value, 0, 1) : 0;
                    }),
                    amount: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxAmount) ? auxAmount[index] : 0);
                        return Number.isFinite(value) ? clampNumber(value, 0, 1) : 0;
                    }),
                    durationMs: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxDurationMs) ? auxDurationMs[index] : 0);
                        return Number.isFinite(value) ? Math.max(0, value) : 0;
                    }),
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
            unsubscribeMonitor();
            unsubscribeRate();
            bridge.detach();
        };
    }, [bridge]);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
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
    }, [bridge]);

    function stepAtClientXForLane(lane: number, clientX: number) {
        const rects = STEP_NUMBERS
            .map((step) => {
                const cell = cellRefs.current.get(cellRefKey(lane, step));
                return cell ? { step, rect: cell.getBoundingClientRect() } : null;
            })
            .filter((entry): entry is { step: number; rect: DOMRect } => Boolean(entry));

        if (rects.length === 0) {
            return null;
        }

        const first = rects[0];
        const last = rects[rects.length - 1];
        if (clientX <= first.rect.left) {
            return first.step;
        }
        if (clientX >= last.rect.right) {
            return last.step;
        }

        for (let index = 0; index < rects.length; index += 1) {
            const current = rects[index];
            if (clientX >= current.rect.left && clientX <= current.rect.right) {
                return current.step;
            }

            const next = rects[index + 1];
            if (next && clientX > current.rect.right && clientX < next.rect.left) {
                const midpoint = current.rect.right + ((next.rect.left - current.rect.right) / 2);
                return clientX < midpoint ? current.step : next.step;
            }
        }

        return last.step;
    }

    useEffect(() => {
        const pointerStepForLane = (lane: number, event: globalThis.PointerEvent) => {
            return stepAtClientXForLane(lane, event.clientX);
        };

        const targetLaneForPointer = (event: globalThis.PointerEvent, fallbackLane: number) => {
            const laneEntries = [...laneTrackRefs.current.entries()]
                .sort(([leftLane], [rightLane]) => leftLane - rightLane);

            if (laneEntries.length === 0) {
                return fallbackLane;
            }

            let closestLane = fallbackLane;
            let closestDistance = Number.POSITIVE_INFINITY;

            for (const [lane, track] of laneEntries) {
                const bounds = track.getBoundingClientRect();
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
            if (!gesture) {
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
            if (!gesture) {
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

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", stopGesture);
        window.addEventListener("pointercancel", cancelGesture);
        window.addEventListener("blur", cancelGesture);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopGesture);
            window.removeEventListener("pointercancel", cancelGesture);
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

    function pointerGrabOffset(lane: number, startStep: number, length: number, clientX: number) {
        const pointerStep = stepAtClientXForLane(lane, clientX);
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
    const inspectedParamDefinitions = PARAM_DEFINITIONS[inspectedEffectType] ?? [];
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
    const inspectedBlockLength = inspectedBlock?.length ?? Math.max(1, activeSelection?.steps.length ?? 1);
    const tapeGraphBlockDurationMs = (observedStepDurationMs ?? estimatedStepDurationMsForRateIndex(rateIndex))
        * inspectedBlockLength;
    const auxEditable = Boolean(
        inspectedBlock
        && inspectedCell?.active
        && inspectedEffectType !== SEQFX_EFFECT_TYPES.empty
        && selectedBlockStartSteps.length <= 1,
    );
    const inspectedAux = auxEditable ? inspectedCell?.aux ?? null : null;
    const inspectedAuxCyclePhase = inspectedLane !== null ? auxMonitor.cyclePhase[inspectedLane] ?? 0 : 0;
    const inspectedAuxAmount = inspectedLane !== null ? auxMonitor.amount[inspectedLane] ?? 0 : 0;
    const showModEditor = inspectorMode === "mod" && Boolean(inspectedAux);

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

    function modulationForTapeStop(): TapeStopModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            startLength: auxTarget(TAPE_STOP_PARAM_START_LENGTH),
            startCurve: auxTarget(TAPE_STOP_PARAM_START_CURVE),
            catchupCurve: auxTarget(TAPE_STOP_PARAM_CATCHUP_CURVE),
            catchupLength: auxTarget(TAPE_STOP_PARAM_CATCHUP_LENGTH),
            mode: auxTarget(TAPE_STOP_PARAM_MODE),
            onToggleStartLength: () => toggleAuxTarget(TAPE_STOP_PARAM_START_LENGTH),
            onToggleStartCurve: () => toggleAuxTarget(TAPE_STOP_PARAM_START_CURVE),
            onToggleCatchupCurve: () => toggleAuxTarget(TAPE_STOP_PARAM_CATCHUP_CURVE),
            onToggleCatchupLength: () => toggleAuxTarget(TAPE_STOP_PARAM_CATCHUP_LENGTH),
            onToggleMode: () => toggleAuxTarget(TAPE_STOP_PARAM_MODE),
        };
    }

    function modulationForCrusher(): CrusherModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            phase: inspectedAuxAmount,
            bits: auxTarget(CRUSHER_PARAM_BITS),
            holdFrames: auxTarget(CRUSHER_PARAM_HOLD_FRAMES),
            driveDb: auxTarget(CRUSHER_PARAM_DRIVE_DB),
            onToggleBits: () => toggleAuxTarget(CRUSHER_PARAM_BITS),
            onToggleHoldFrames: () => toggleAuxTarget(CRUSHER_PARAM_HOLD_FRAMES),
            onToggleDriveDb: () => toggleAuxTarget(CRUSHER_PARAM_DRIVE_DB),
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

    function isKeyboardActivation(event: ReactKeyboardEvent<HTMLDivElement>) {
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
        const grabOffset = pointerGrabOffset(lane, startStep, length, event.clientX);
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

    function handleBlockKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
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
        beginGesture({ mode: "resize", lane, startStep, length, previewLength: null });
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

    function setEffectType(value: number) {
        const nextEffectType = EFFECT_OPTIONS.includes(value as typeof EFFECT_OPTIONS[number])
            ? value as SeqFxEffectType
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
            <SeqFxPresetBarHost bridge={bridge} patchConnection={patchConnection} />

            <section className="seqfx-topbar" aria-label="SeqFX pattern controls">
                <div className="seqfx-title">
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

            <section className="seqfx-workspace">
                <div className={gridShellClassName} aria-label="Effect sequence grid">
                    <div className="seqfx-step-header">
                        <div className="seqfx-lane-spacer" />
                        <div className="seqfx-step-track">
                            {STEP_NUMBERS.map((step) => (
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
                    {SEQFX_LANE_NAMES.map((laneName, lane) => {
                        const laneBlocks = getSeqFxLaneBlocks(renderedPatternState, lane);
                        const invalidBlocks = invalidDropTarget?.patternIndex === selectedPattern && invalidDropTarget.lane === lane
                            ? invalidDropTarget.blocks
                            : [];

                        return (
                            <div className="seqfx-lane-row" key={laneName}>
                                <div className="seqfx-lane-label">{laneName}</div>
                                <div
                                    className="seqfx-lane-track"
                                    ref={(node) => {
                                        if (node) {
                                            laneTrackRefs.current.set(lane, node);
                                        } else {
                                            laneTrackRefs.current.delete(lane);
                                        }
                                    }}
                                >
                                    {STEP_NUMBERS.map((step) => {
                                        const cell = renderedPatternState.lanes[lane].steps[step];
                                        const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                        const className = [
                                            "seqfx-cell",
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
                                    {invalidBlocks.map((block) => (
                                        <div
                                            aria-hidden="true"
                                            className="seqfx-invalid-drop"
                                            data-role="seqfx-invalid-drop"
                                            data-lane={lane}
                                            data-start={block.startStep}
                                            key={`invalid:${lane}:${block.startStep}`}
                                            style={gridGeometry.blockStyle(block.startStep, block.length)}
                                        />
                                    ))}
                                    {laneBlocks.map((block) => {
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
                                        const className = [
                                            "seqfx-block",
                                            blockIsPreview ? "is-copy-preview" : "",
                                            selected ? "is-selected" : "",
                                            playheadStep !== null && playheadStep >= block.startStep && playheadStep <= block.endStep ? "is-playhead" : "",
                                        ].filter(Boolean).join(" ");
                                        const effectName = SEQFX_EFFECT_TYPE_NAMES[block.effectType] ?? "Effect";
                                        const effectShortName = SEQFX_EFFECT_TYPE_SHORT_NAMES[block.effectType] ?? "";
                                        const ariaLabel = block.length === 1
                                            ? `${laneName} ${effectName} block ${block.startStep + 1}`
                                            : `${laneName} ${effectName} block ${block.startStep + 1}-${block.endStep + 1}`;

                                        return (
                                            <div
                                                aria-label={ariaLabel}
                                                className={className}
                                                data-effect={block.effectType}
                                                data-role="seqfx-block"
                                                data-lane={lane}
                                                data-preview={blockIsPreview ? "true" : undefined}
                                                data-start={block.startStep}
                                                key={`${lane}:${block.startStep}`}
                                                onDoubleClick={(event) => handleBlockDoubleClick(event, lane, block.startStep)}
                                                onKeyDown={(event) => handleBlockKeyDown(event, lane, block.startStep, block.length)}
                                                onPointerDown={(event) => handleBlockPointerDown(event, lane, block.startStep, block.length)}
                                                role="button"
                                                style={gridGeometry.blockStyle(block.startStep, block.length)}
                                                tabIndex={0}
                                            >
                                                <span className="seqfx-block-fill">
                                                    <span>{effectShortName}</span>
                                                </span>
                                                <span
                                                    aria-hidden="true"
                                                    className="seqfx-block-resize"
                                                    data-role="seqfx-block-resize"
                                                    data-lane={lane}
                                                    data-start={block.startStep}
                                                    onPointerDown={(event) => handleResizePointerDown(event, lane, block.startStep, block.length)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <aside className="seqfx-inspector" data-role="seqfx-inspector">
                    <div className="seqfx-inspector-heading">
                        <strong>{getSelectionLabel(activeSelection)}</strong>
                    </div>
                    {!inspectedCell || inspectedLane === null ? (
                        <p className="seqfx-empty">Choose a lane cell to edit its mix and effect settings.</p>
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
                                            </button>
                                        );
                                    })}
                                </div>
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
                            {showModEditor && inspectedAux ? (
                                <SeqFxModEditor
                                    aux={inspectedAux}
                                    cyclePhase={inspectedAuxCyclePhase}
                                    amount={inspectedAuxAmount}
                                    params={inspectedCell.params}
                                    definitions={inspectedParamDefinitions}
                                    onSourceChange={setAuxSource}
                                    onTargetToggle={toggleAuxTarget}
                                    onTargetEndChange={setAuxTargetEnd}
                                />
                            ) : (
                                <>
                                    {inspectedEffectType === SEQFX_EFFECT_TYPES.tapeStop ? (
                                        <TapeStopEnvelopeEditor
                                            step={inspectedCell}
                                            blockLength={inspectedBlockLength}
                                            blockDurationMs={tapeGraphBlockDurationMs}
                                            onParamChange={setParam}
                                            modulation={modulationForTapeStop()}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.filter ? (
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
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.crusher ? (
                                        <CrusherEditor
                                            value={crusherValueFromSeqFxStep(inspectedCell)}
                                            onBitsChange={(value) => setParam(CRUSHER_PARAM_BITS, value)}
                                            onHoldFramesChange={(value) => setParam(CRUSHER_PARAM_HOLD_FRAMES, value)}
                                            onDriveDbChange={(value) => setParam(CRUSHER_PARAM_DRIVE_DB, value)}
                                            modulation={modulationForCrusher()}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? (
                                        <StutterEnvelopeEditor
                                            value={stutterValueFromSeqFxStep(inspectedCell)}
                                            onGateChange={(value) => setStutterParam(STUTTER_PARAM_GATE, value)}
                                            onShapeChange={(value) => setStutterParam(STUTTER_PARAM_SHAPE, value)}
                                            onSlicesChange={(value) => setStutterParam(STUTTER_PARAM_SLICES, value)}
                                            onSpeedChange={(value) => setStutterParam(STUTTER_PARAM_SPEED, value)}
                                            modulation={modulationForStutter()}
                                        />
                                    ) : inspectedParamDefinitions.map((definition) => {
                                        const triggerLatched = isSeqFxTriggerLatchedParamForEffect(inspectedEffectType, definition.index);
                                        const disabled = triggerLatched && !selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1;
                                        const value = inspectedCell.params[definition.index];

                                        return (
                                            <label className="seqfx-field" key={definition.index}>
                                                <span>
                                                    {definition.label}
                                                    {triggerLatched ? <em>Trigger</em> : null}
                                                </span>
                                                {definition.kind === "select" ? (
                                                    <select
                                                        data-role="seqfx-param"
                                                        data-param={definition.index}
                                                        disabled={disabled}
                                                        onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                        value={Math.round(value)}
                                                    >
                                                        {definition.options!.map((option, index) => (
                                                            <option key={option} value={index}>{option}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        data-role="seqfx-param"
                                                        data-param={definition.index}
                                                        disabled={disabled}
                                                        max={definition.max}
                                                        min={definition.min}
                                                        onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                        step={definition.step}
                                                        type="number"
                                                        value={formatValue(value)}
                                                    />
                                                )}
                                                <small>
                                                    {disabled
                                                        ? "Select one cell to edit this trigger."
                                                        : definition.hint ?? `${definition.min} to ${definition.max}`}
                                                </small>
                                            </label>
                                        );
                                    })}
                                    <SeqFxMixRow
                                        value={inspectedCell.mix}
                                        onChange={inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? setStutterMix : setMix}
                                    />
                                </>
                            )}
                            {selectedBlockGroup || (selectedWholeBlock && inspectedBlock) ? (
                                <button
                                    className="seqfx-delete-block"
                                    data-role="seqfx-delete-block"
                                    onClick={deleteSelectedBlock}
                                    type="button"
                                >
                                    {selectedBlockStartSteps.length > 1 ? "Delete Selection" : "Delete Block"}
                                </button>
                            ) : null}
                        </>
                    )}
                </aside>
            </section>

            <pre className="seqfx-debug" data-role="seqfx-debug">
                {JSON.stringify({
                    selectedPattern,
                    rateIndex,
                    selectedCell,
                    selection,
                    lastUploadEndpoint: SEQFX_ENDPOINTS.patternUpload,
                })}
            </pre>
        </main>
    );
}
