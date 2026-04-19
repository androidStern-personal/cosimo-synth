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
import { StutterEnvelopeEditor } from "./StutterEnvelopeEditor";
import {
    SEQFX_LANES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    getSeqFxBlockAtStep,
    getSeqFxLaneBlocks,
    isSeqFxTriggerLatchedParam,
    type SeqFxPattern,
    type SeqFxStep,
    type SeqFxStepValueSnapshot,
    type SeqFxState,
} from "./seqfx-state";
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

type ResizeGesture = {
    mode: "resize";
    lane: number;
    startStep: number;
};

type MoveGesture = {
    mode: "move";
    lane: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    lastStartStep: number;
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
    previewTargetStartStep: number | null;
};

type BlockGesture = ResizeGesture | MoveGesture | BlockSelectionMoveGesture | CopyGesture;

type CopyPreview = {
    patternIndex: number;
    lane: number;
    sourceStartStep: number;
    targetStartStep: number;
    copiedStartSteps: number[];
    state: SeqFxState;
};

type ParamDefinition = {
    index: number;
    label: string;
    min: number;
    max: number;
    step: number;
    kind?: "select";
    options?: string[];
    hint?: string;
};

const PARAM_DEFINITIONS: Record<number, ParamDefinition[]> = {
    [SEQFX_LANES.filter]: [
        { index: 0, label: "Mode", min: 0, max: 2, step: 1, kind: "select", options: ["Lowpass", "Highpass", "Bandpass"] },
        { index: 1, label: "Start cutoff", min: 20, max: 20000, step: 1 },
        { index: 2, label: "End cutoff", min: 20, max: 20000, step: 1 },
        { index: 3, label: "Resonance", min: 0.1, max: 20, step: 0.01 },
        { index: 4, label: "Curve", min: 0.25, max: 4, step: 0.01 },
    ],
    [SEQFX_LANES.crusher]: [
        { index: 0, label: "Bits", min: 4, max: 16, step: 1 },
        { index: 1, label: "Hold frames", min: 1, max: 64, step: 1 },
        { index: 2, label: "Drive", min: 0, max: 36, step: 0.1 },
    ],
    [SEQFX_LANES.tapeStop]: [
        { index: 0, label: "Start Length", min: 0.05, max: 4, step: 0.01 },
        { index: 1, label: "Start Curve", min: 0.25, max: 4, step: 0.01 },
        { index: 2, label: "Catchup Curve", min: 0.25, max: 4, step: 0.01 },
        { index: 3, label: "Catchup Length", min: 0, max: 100, step: 1 },
        { index: 4, label: "Mode", min: 0, max: 1, step: 1, kind: "select", options: ["Stop", "Spin-up"] },
    ],
    [SEQFX_LANES.stutter]: [
        { index: 0, label: "Slices", min: 2, max: 32, step: 1, hint: "Record slice 1; repeat the rest." },
        { index: 1, label: "Speed", min: 0.5, max: 2, step: 0.01, hint: "1.00 keeps the captured pitch." },
        { index: 2, label: "Shape", min: 0, max: 1, step: 0.01, hint: "Morphs the per-cut envelope." },
        { index: 3, label: "Gate", min: 0, max: 1, step: 0.01, hint: "Audible portion of each cut." },
    ],
};

const FILTER_PARAM_MODE = 0;
const FILTER_PARAM_START_CUTOFF = 1;
const FILTER_PARAM_END_CUTOFF = 2;
const FILTER_PARAM_RESONANCE = 3;
const FILTER_PARAM_CURVE = 4;
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
    const startCutoffHz = step.params[FILTER_PARAM_START_CUTOFF] ?? 2_000;
    const endCutoffHz = step.params[FILTER_PARAM_END_CUTOFF] ?? 500;

    return {
        mode: seqFxFilterModeToRangeMode(step.params[FILTER_PARAM_MODE] ?? 0),
        cutoffHz: geometricCenterCutoffHz(startCutoffHz, endCutoffHz),
        q: step.params[FILTER_PARAM_RESONANCE] ?? 0.707,
    };
}

function filterRangeEndpointsFromSeqFxStep(step: SeqFxStep): FilterRangeEndpoints {
    return {
        startCutoffHz: step.params[FILTER_PARAM_START_CUTOFF] ?? 2_000,
        endCutoffHz: step.params[FILTER_PARAM_END_CUTOFF] ?? 500,
    };
}

function stutterValueFromSeqFxStep(step: SeqFxStep) {
    return {
        slices: step.params[STUTTER_PARAM_SLICES],
        speed: step.params[STUTTER_PARAM_SPEED],
        shape: step.params[STUTTER_PARAM_SHAPE],
        gate: step.params[STUTTER_PARAM_GATE],
        mix: step.mix,
    };
}

function buildStepNumbers() {
    return Array.from({ length: SEQFX_STEP_COUNT }, (_unused, index) => index);
}

const STEP_NUMBERS = buildStepNumbers();
const SEQFX_NORMAL_GAP_PX = 5;
const SEQFX_BEAT_GAP_PX = 9;
const SEQFX_MIN_CELL_SIZE_PX = 22;
const SEQFX_RATE_CELLS_PER_BEAT = [2, 4, 8] as const;
const SEQFX_BEATS_PER_BAR = 4;
function cellsPerBeatForRateIndex(rateIndex: number) {
    return SEQFX_RATE_CELLS_PER_BEAT[Math.min(2, Math.max(0, Math.round(rateIndex)))] ?? 4;
}

function gapAfterStep(step: number, cellsPerBeat: number, stepCount = SEQFX_STEP_COUNT) {
    if (step >= stepCount - 1) {
        return 0;
    }

    return (step + 1) % cellsPerBeat === 0 ? SEQFX_BEAT_GAP_PX : SEQFX_NORMAL_GAP_PX;
}

function totalGapWidthFor(cellsPerBeat: number, stepCount = SEQFX_STEP_COUNT) {
    let total = 0;
    for (let step = 0; step < stepCount - 1; step += 1) {
        total += gapAfterStep(step, cellsPerBeat, stepCount);
    }
    return total;
}

function cellSizeFromTrackWidth(width: number, cellsPerBeat: number) {
    if (!Number.isFinite(width) || width <= 0) {
        return SEQFX_MIN_CELL_SIZE_PX;
    }

    const availableCellWidth = width - totalGapWidthFor(cellsPerBeat);
    const cellSize = availableCellWidth / SEQFX_STEP_COUNT;

    return Math.max(SEQFX_MIN_CELL_SIZE_PX, Number(cellSize.toFixed(4)));
}

function createGridGeometry(cellSize: number, cellsPerBeat: number) {
    const cellsPerBar = cellsPerBeat * SEQFX_BEATS_PER_BAR;
    const stepLefts: number[] = [];
    let cursor = 0;

    for (let step = 0; step < SEQFX_STEP_COUNT; step += 1) {
        stepLefts.push(Number(cursor.toFixed(4)));
        cursor += cellSize + gapAfterStep(step, cellsPerBeat);
    }

    const trackWidth = (cellSize * SEQFX_STEP_COUNT) + totalGapWidthFor(cellsPerBeat);

    const leftForStep = (step: number) => stepLefts[Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step))] ?? 0;

    const stepAtClientX = (bounds: DOMRect, clientX: number) => {
        const localX = clientX - bounds.left;
        if (localX <= 0) {
            return 0;
        }

        for (let step = 0; step < SEQFX_STEP_COUNT; step += 1) {
            const left = leftForStep(step);
            const right = left + cellSize;

            if (localX >= left && localX <= right) {
                return step;
            }

            if (step < SEQFX_STEP_COUNT - 1) {
                const nextLeft = leftForStep(step + 1);
                if (localX > right && localX < nextLeft) {
                    const midpoint = right + ((nextLeft - right) / 2);
                    return localX < midpoint ? step : step + 1;
                }
            }
        }

        return SEQFX_STEP_COUNT - 1;
    };

    const cellStyle = (step: number): CSSProperties => ({
        left: `${leftForStep(step)}px`,
        width: `${cellSize}px`,
        height: `${cellSize}px`,
    });

    const blockStyle = (startStep: number, length: number): CSSProperties => {
        const lastStep = Math.min(SEQFX_STEP_COUNT - 1, startStep + length - 1);
        const left = leftForStep(startStep);
        const right = leftForStep(lastStep) + cellSize;

        return {
            left: `${left}px`,
            width: `${right - left}px`,
            height: `${cellSize}px`,
        };
    };

    const stepNumberStyle = (step: number): CSSProperties => ({
        left: `${leftForStep(step)}px`,
        width: `${cellSize}px`,
    });

    return {
        cellSize,
        cellsPerBar,
        trackWidth: Number(trackWidth.toFixed(4)),
        stepLefts,
        leftForStep,
        stepAtClientX,
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
}) {
    return (
        <label className="seqfx-tape-control">
            <span>
                {label}
                <output>{valueLabel}</output>
            </span>
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
            <small>{hint}</small>
        </label>
    );
}

function TapeStopEnvelopeEditor({
    step,
    blockLength,
    blockDurationMs,
    onParamChange,
}: {
    step: SeqFxStep;
    blockLength: number;
    blockDurationMs: number;
    onParamChange: (paramIndex: number, value: number) => void;
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
            <label className="seqfx-field">
                <span>Mode</span>
                <select
                    data-role="seqfx-tape-mode"
                    onChange={(event) => onParamChange(4, Number(event.currentTarget.value))}
                    value={mode}
                >
                    <option value={TAPE_STOP_MODE_STOP}>Stop</option>
                    <option value={TAPE_STOP_MODE_SPIN_UP}>Spin-up</option>
                </select>
                <small>{modeLabel === "Spin-up" ? "Starts nearly stopped, then rises." : "Starts normal, then slows down."}</small>
            </label>
            <TapeStopRangeControl
                dataRole="seqfx-tape-stop-point"
                label="Start Length"
                min={TAPE_STOP_MIN_STOP_POINT_PERCENT}
                max={TAPE_STOP_MAX_STOP_POINT_PERCENT}
                step={1}
                value={stopPointPercent}
                valueLabel={formatTapeStopPercent(stopPointPercent)}
                hint={startLengthHint}
                onChange={(value) => onParamChange(0, stopPointPercentToMultiplier(value))}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-curve"
                label="Start Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={curve}
                valueLabel={formatTapeStopCurve(curve)}
                hint="Bends the first part of the curve."
                onChange={(value) => onParamChange(1, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup"
                label="Catchup Length"
                min={TAPE_STOP_MIN_CATCHUP_PERCENT}
                max={TAPE_STOP_MAX_CATCHUP_PERCENT}
                step={1}
                value={catchupPercent}
                valueLabel={formatTapeStopPercent(catchupPercent)}
                hint="How much of the block end is reserved for syncing back."
                onChange={(value) => onParamChange(3, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup-curve"
                label="Catchup Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={catchupCurve}
                valueLabel={formatTapeStopCurve(catchupCurve)}
                hint="Bends the return ramp."
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
    const [gestureState, setGestureState] = useState<BlockGesture | null>(null);
    const [copyPreview, setCopyPreview] = useState<CopyPreview | null>(null);
    const [cellSize, setCellSize] = useState(SEQFX_MIN_CELL_SIZE_PX);
    const cellsPerBeat = useMemo(() => cellsPerBeatForRateIndex(rateIndex), [rateIndex]);
    const gridGeometry = useMemo(() => createGridGeometry(cellSize, cellsPerBeat), [cellSize, cellsPerBeat]);
    const measureTrackRef = useRef<HTMLDivElement | null>(null);
    const laneTrackRefs = useRef(new Map<number, HTMLDivElement>());
    const gestureRef = useRef<BlockGesture | null>(null);
    const optionKeyRef = useRef(false);
    const gridGeometryRef = useRef(gridGeometry);
    const rateIndexRef = useRef(rateIndex);
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);
    const selectedCellRef = useRef<SelectedCell | null>(selectedCell);
    const activeSelectionRef = useRef<Selection | null>(null);
    const cellClipboardRef = useRef<SeqFxStepValueSnapshot | null>(null);

    gridGeometryRef.current = gridGeometry;
    rateIndexRef.current = rateIndex;
    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;
    selectedCellRef.current = selectedCell;

    const trackWidth = gridGeometry.trackWidth;
    const stepTrackStyle = useMemo<CSSProperties>(() => ({
        minWidth: `${trackWidth}px`,
        height: "12px",
    }), [trackWidth]);
    const laneTrackStyle = useMemo<CSSProperties>(() => ({
        minWidth: `${trackWidth}px`,
        height: `${cellSize}px`,
    }), [cellSize, trackWidth]);

    useEffect(() => {
        bridge.attach();
        const unsubscribeState = bridge.subscribe((nextState) => {
            setState(nextState);
            setSelectedPattern(bridge.getSelectedPatternIndex());
        });
        const unsubscribeMonitor = bridge.subscribeMonitor((monitor) => {
            const stepIndex = Number((monitor as { stepIndex?: unknown })?.stepIndex);
            const stepDurationMs = Number((monitor as { stepDurationMs?: unknown })?.stepDurationMs);
            setPlayheadStep(Number.isFinite(stepIndex) ? stepIndex : null);
            if (Number.isFinite(stepDurationMs) && stepDurationMs > 0) {
                setObservedStepDurationMs(stepDurationMs);
            }
        });
        const unsubscribeRate = bridge.subscribeRate((nextRateIndex) => {
            if (rateIndexRef.current !== nextRateIndex) {
                gestureRef.current = null;
                setGestureState(null);
                setCopyPreview(null);
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
        let animationFrame: number | null = null;
        let observer: ResizeObserver | null = null;

        const updateCellSize = () => {
            const track = measureTrackRef.current;
            if (!track) {
                return;
            }

            const nextCellSize = cellSizeFromTrackWidth(track.getBoundingClientRect().width, cellsPerBeat);
            setCellSize((currentCellSize) => (
                Math.abs(currentCellSize - nextCellSize) < 0.01 ? currentCellSize : nextCellSize
            ));
        };

        const scheduleCellSizeUpdate = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame = window.requestAnimationFrame(updateCellSize);
        };

        scheduleCellSizeUpdate();

        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(scheduleCellSizeUpdate);
            if (measureTrackRef.current) {
                observer.observe(measureTrackRef.current);
            }
        }

        window.addEventListener("resize", scheduleCellSizeUpdate);

        return () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }
            observer?.disconnect();
            window.removeEventListener("resize", scheduleCellSizeUpdate);
        };
    }, [cellsPerBeat]);

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
                || copiedValues.lane !== activeSelection.lane
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

    useEffect(() => {
        const pointerStepForLane = (lane: number, event: globalThis.PointerEvent) => {
            const track = laneTrackRefs.current.get(lane);
            if (!track) {
                return null;
            }

            const bounds = track.getBoundingClientRect();
            return gridGeometryRef.current.stepAtClientX(bounds, event.clientX);
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
            const pointerStep = pointerStepForLane(gesture.lane, event);
            if (pointerStep === null) {
                return null;
            }

            return clampBlockStart(pointerStep - gesture.grabOffset, gesture.length);
        };

        const targetAnchorStartFromPointer = (gesture: BlockSelectionMoveGesture, event: globalThis.PointerEvent) => {
            const pointerStep = pointerStepForLane(gesture.lane, event);
            if (pointerStep === null) {
                return null;
            }

            return Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, pointerStep - gesture.grabOffset));
        };

        const gestureMovedEnough = (gesture: MoveGesture | CopyGesture | BlockSelectionMoveGesture, event: globalThis.PointerEvent) => {
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

                try {
                    bridge.resizeBlock({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.startStep,
                        length,
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
                const targetAnchorStartStep = targetAnchorStartFromPointer(gesture, event);
                if (targetAnchorStartStep === null || targetAnchorStartStep === gesture.anchorStartStep) {
                    return;
                }

                try {
                    const result = bridge.moveBlockSelection({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetAnchorStartStep,
                    });
                    gesture.blockStartSteps = result.movedStartSteps;
                    gesture.anchorStartStep = targetAnchorStartStep;
                    selectBlockStartsFromPattern(
                        result.state.patterns[selectedPatternRef.current],
                        gesture.lane,
                        result.movedStartSteps,
                        targetAnchorStartStep,
                    );
                } catch {
                    // Invalid group targets, such as collisions, keep the selection at its last valid position.
                }
                return;
            }

            const targetStartStep = targetStartFromPointer(gesture, event);
            if (targetStartStep === null) {
                return;
            }

            if (gesture.mode === "move") {
                if (targetStartStep === gesture.lastStartStep) {
                    return;
                }

                try {
                    bridge.moveBlock({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.lastStartStep,
                        targetStartStep,
                    });
                    gesture.lastStartStep = targetStartStep;
                    selectBlockRange(gesture.lane, targetStartStep, gesture.length);
                } catch {
                    // Invalid targets, such as overlaps, keep the block at its last valid start.
                }
                return;
            }

            try {
                const preview = bridge.previewBlockCopyPaint({
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    startStep: gesture.sourceStartStep,
                    targetStartStep,
                });
                gesture.previewTargetStartStep = targetStartStep;
                setCopyPreview(preview.copiedStartSteps.length > 0 ? {
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    sourceStartStep: gesture.sourceStartStep,
                    targetStartStep,
                    copiedStartSteps: preview.copiedStartSteps,
                    state: preview.state,
                } : null);
            } catch {
                setCopyPreview(null);
            }
        };

        const stopGesture = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.mode === "move" && gesture.hasMoved) {
                selectBlockRange(gesture.lane, gesture.lastStartStep, gesture.length);
            } else if (gesture.mode === "selectionMove" && gesture.hasMoved) {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            } else if (gesture.mode === "copy" && gesture.hasMoved) {
                const targetStartStep = targetStartFromPointer(gesture, event) ?? gesture.previewTargetStartStep;
                if (targetStartStep !== null && targetStartStep !== gesture.sourceStartStep) {
                    try {
                        const result = bridge.copyBlockPaint({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetStartStep,
                        });
                        const selectedStartStep = result.copiedStartSteps.at(-1);
                        if (selectedStartStep !== undefined) {
                            selectBlockRange(gesture.lane, selectedStartStep, gesture.length);
                        }
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            }

            gestureRef.current = null;
            setGestureState(null);
            setCopyPreview(null);
        };

        const cancelGesture = () => {
            if (!gestureRef.current) {
                return;
            }

            gestureRef.current = null;
            setGestureState(null);
            setCopyPreview(null);
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
        const track = laneTrackRefs.current.get(lane);
        if (!track) {
            return 0;
        }

        const bounds = track.getBoundingClientRect();
        const pointerStep = gridGeometryRef.current.stepAtClientX(bounds, clientX);

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
            setCopyPreview(null);
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
        setCopyPreview(null);
    }

    const selectedPatternState = state.patterns[selectedPattern];
    const renderedPatternState = copyPreview?.patternIndex === selectedPattern
        ? copyPreview.state.patterns[selectedPattern]
        : selectedPatternState;
    const copyPreviewStartSteps = useMemo(() => (
        copyPreview?.patternIndex === selectedPattern
            ? new Set(copyPreview.copiedStartSteps)
            : new Set<number>()
    ), [copyPreview, selectedPattern]);
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    activeSelectionRef.current = activeSelection;
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? selectedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;
    const inspectedBlock = inspectedLane !== null && inspectedStep !== null
        ? getSeqFxBlockAtStep(selectedPatternState, inspectedLane, inspectedStep)
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

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setCopyPreview(null);
        setSelectedCell(null);
        setSelection(null);
    }

    function activateCell(lane: number, step: number, shiftKey: boolean) {
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
                previewTargetStartStep: null,
            });
            return;
        }

        if (clickedSelectedBlock && activeBlockStarts.length > 1) {
            beginGesture({
                mode: "selectionMove",
                lane,
                blockStartSteps: [...activeBlockStarts],
                anchorStartStep: startStep,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
            });
            return;
        }

        selectBlockRange(lane, startStep, length);
        beginGesture({
            mode: "move",
            lane,
            length,
            grabOffset,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            hasMoved: false,
            lastStartStep: startStep,
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

    function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        beginGesture({ mode: "resize", lane, startStep });
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

        setParam(FILTER_PARAM_START_CUTOFF, nextRange.startCutoffHz);
        setParam(FILTER_PARAM_END_CUTOFF, nextRange.endCutoffHz);
    }

    function setFilterRange(nextRange: FilterRangeEndpoints) {
        setParam(FILTER_PARAM_START_CUTOFF, nextRange.startCutoffHz);
        setParam(FILTER_PARAM_END_CUTOFF, nextRange.endCutoffHz);
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

    function getStutterBlockLabel() {
        if (selectedBlockStartSteps.length > 1) {
            return `${selectedBlockStartSteps.length} blocks`;
        }

        if (!inspectedBlock) {
            return getSelectionLabel(activeSelection).toLowerCase();
        }

        return inspectedBlock.length === 1
            ? `block ${inspectedBlock.startStep + 1}`
            : `block ${inspectedBlock.startStep + 1} - ${inspectedBlock.endStep + 1}`;
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
        setCopyPreview(null);
    }

    return (
        <main className={gestureState ? "seqfx-root is-dragging" : "seqfx-root"} data-role="seqfx-root">
            <SeqFxPresetBarHost bridge={bridge} patchConnection={patchConnection} />

            <section className="seqfx-topbar" aria-label="SeqFX transport and pattern controls">
                <div className="seqfx-title">
                    <span className="seqfx-kicker">Cosimo</span>
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
                <div className="seqfx-transport" role="group" aria-label="Internal clock">
                    <button type="button" onClick={() => bridge.playInternal()}>Play</button>
                    <button type="button" onClick={() => bridge.stopInternal()}>Stop</button>
                    <button type="button" onClick={() => bridge.resetInternal()}>Reset</button>
                </div>
            </section>

            <section className="seqfx-workspace">
                <div className="seqfx-grid-shell" aria-label="Effect sequence grid">
                    <div className="seqfx-step-header">
                        <div className="seqfx-lane-spacer" />
                        <div className="seqfx-step-track" ref={measureTrackRef} style={stepTrackStyle}>
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
                                    style={laneTrackStyle}
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
                                                role="button"
                                                style={gridGeometry.cellStyle(step)}
                                                tabIndex={0}
                                            >
                                                <span />
                                            </div>
                                        );
                                    })}
                                    {laneBlocks.map((block) => {
                                        const blockIsPreview = copyPreview?.patternIndex === selectedPattern
                                            && copyPreview.lane === lane
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
                                        const ariaLabel = block.length === 1
                                            ? `${laneName} block ${block.startStep + 1}`
                                            : `${laneName} block ${block.startStep + 1}-${block.endStep + 1}`;

                                        return (
                                            <div
                                                aria-label={ariaLabel}
                                                className={className}
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
                                                <span className="seqfx-block-fill" />
                                                <span
                                                    aria-hidden="true"
                                                    className="seqfx-block-resize"
                                                    data-role="seqfx-block-resize"
                                                    data-lane={lane}
                                                    data-start={block.startStep}
                                                    onPointerDown={(event) => handleResizePointerDown(event, lane, block.startStep)}
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
                        <span>Inspector</span>
                        <strong>{getSelectionLabel(activeSelection)}</strong>
                    </div>
                    {!inspectedCell || inspectedLane === null ? (
                        <p className="seqfx-empty">Choose a lane cell to edit its mix and effect settings.</p>
                    ) : (
                        <>
                            {inspectedLane === SEQFX_LANES.stutter ? null : (
                                <label className="seqfx-field">
                                    <span>Mix</span>
                                    <input
                                        data-role="seqfx-mix"
                                        max={1}
                                        min={0}
                                        onChange={(event) => setMix(Number(event.currentTarget.value))}
                                        step={0.01}
                                        type="range"
                                        value={inspectedCell.mix}
                                    />
                                    <output>{formatValue(inspectedCell.mix)}</output>
                                </label>
                            )}
                            {inspectedLane === SEQFX_LANES.tapeStop ? (
                                <TapeStopEnvelopeEditor
                                    step={inspectedCell}
                                    blockLength={inspectedBlockLength}
                                    blockDurationMs={tapeGraphBlockDurationMs}
                                    onParamChange={setParam}
                                />
                            ) : inspectedLane === SEQFX_LANES.filter ? (
                                <>
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
                                    {PARAM_DEFINITIONS[inspectedLane]
                                        .filter((definition) => definition.index === FILTER_PARAM_CURVE)
                                        .map((definition) => {
                                            const value = inspectedCell.params[definition.index];

                                            return (
                                                <label className="seqfx-field" key={definition.index}>
                                                    <span>{definition.label}</span>
                                                    <input
                                                        data-role="seqfx-param"
                                                        data-param={definition.index}
                                                        max={definition.max}
                                                        min={definition.min}
                                                        onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                        step={definition.step}
                                                        type="number"
                                                        value={formatValue(value)}
                                                    />
                                                    <small>{definition.hint ?? `${definition.min} to ${definition.max}`}</small>
                                                </label>
                                            );
                                        })}
                                </>
                            ) : inspectedLane === SEQFX_LANES.stutter ? (
                                <StutterEnvelopeEditor
                                    blockLabel={getStutterBlockLabel()}
                                    value={stutterValueFromSeqFxStep(inspectedCell)}
                                    onGateChange={(value) => setStutterParam(STUTTER_PARAM_GATE, value)}
                                    onMixChange={setStutterMix}
                                    onShapeChange={(value) => setStutterParam(STUTTER_PARAM_SHAPE, value)}
                                    onSlicesChange={(value) => setStutterParam(STUTTER_PARAM_SLICES, value)}
                                    onSpeedChange={(value) => setStutterParam(STUTTER_PARAM_SPEED, value)}
                                />
                            ) : PARAM_DEFINITIONS[inspectedLane].map((definition) => {
                                const triggerLatched = isSeqFxTriggerLatchedParam(inspectedLane, definition.index);
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
                    <div className="seqfx-chain" aria-label="Fixed signal path">
                        <span>Filter</span>
                        <span>Crusher</span>
                        <span>Tape</span>
                        <span>Stutter</span>
                        <span>Mix</span>
                    </div>
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
