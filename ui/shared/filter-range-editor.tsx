import {
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    FILTER_CUTOFF_MAX_HZ,
    FILTER_CUTOFF_MIN_HZ,
    FILTER_MODE_BANDPASS,
    FILTER_MODE_HIGHPASS,
    FILTER_MODE_LOWPASS,
    FILTER_MODE_NOTCH,
    FILTER_MODE_OFF,
    FILTER_MODE_PEAK,
    clampFilterCutoffHz,
    clampFilterQ,
    createFilterResponseModel,
    filterCutoffHzToNormalized,
    filterQToNormalized,
    normalizedToFilterCutoffHz,
    normalizedToFilterQ,
} from "./filter-response";
import {
    createDefaultCurveProfile,
    evaluateCurveProfile,
    invertCurveProfile,
} from "./curve-lab";
import {
    EDITOR_DRAG_START_THRESHOLD_PX,
    EDITOR_HIT_RADIUS_PX,
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    editorPlotGutter,
    useEditorSurfaceSize,
    type EditorSurfaceSize,
} from "./editor-tokens";
import {
    createEditorCurvePlotRect,
    polylineToSvgPath,
} from "./editor-curve-geometry";
import {
    EditorCurveHandle,
    EditorCurveHandleHalo,
    EditorCurveHitTarget,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "./editor-curve-surface";

export type FilterRangeMode = "off" | "lowpass" | "highpass" | "bandpass" | "notch" | "peak";
export type FilterRangePolarity = "bipolar" | "unipolar";

export type FilterRangeValue = {
    mode: FilterRangeMode;
    cutoffHz: number;
    q: number;
};

export type FilterRangeModeOption = {
    label: string;
    value: FilterRangeMode;
};

export type FilterRangeEndpoints = {
    startCutoffHz: number;
    endCutoffHz: number;
};

export type FilterRangePreview = Partial<FilterRangeValue> & {
    active?: boolean;
    label?: string;
};

export type FilterRangeQScale = {
    qToSurface: (qValue: number) => number;
    surfaceToQ: (surfaceValue: number) => number;
};

export type FilterRangeEditTarget = "value" | "range-start" | "range-end";

export type FilterRangeEditorProps = {
    value: FilterRangeValue;
    range?: FilterRangeEndpoints | null;
    rangePolarity?: FilterRangePolarity;
    preview?: FilterRangePreview | null;
    modeOptions?: FilterRangeModeOption[];
    showModeControls?: boolean;
    showHandleChips?: boolean;
    showReadout?: boolean;
    sampleRateHz?: number;
    qScale?: FilterRangeQScale;
    className?: string;
    style?: CSSProperties;
    ariaLabel?: string;
    onValueChange?: (nextValue: FilterRangeValue) => void;
    onRangeChange?: (nextRange: FilterRangeEndpoints) => void;
    onEditStart?: (target: FilterRangeEditTarget) => void;
    onEditEnd?: (target: FilterRangeEditTarget) => void;
};

export const FILTER_RANGE_RESONANCE_CURVE_TARGET_ID = "filter-resonance-handle";
export const FILTER_RANGE_MODE_OPTIONS: FilterRangeModeOption[] = [
    { label: "LP", value: "lowpass" },
    { label: "HP", value: "highpass" },
    { label: "BP", value: "bandpass" },
    { label: "Notch", value: "notch" },
    { label: "Peak", value: "peak" },
];

type Size = EditorSurfaceSize;

type PlotPath = {
    path: string;
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
};

type DragState = {
    pointerId: number;
    target: FilterRangeEditTarget;
    startClientX: number;
    startClientY: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
    hasMoved: boolean;
};

const FILTER_RANGE_RESPONSE_POINT_COUNT = 360;
const DEFAULT_SAMPLE_RATE_HZ = 44_100;
const KEYBOARD_CUTOFF_STEP = 0.01;
const KEYBOARD_Q_STEP = 0.025;
const KEYBOARD_FAST_MULTIPLIER = 5;
const MODULATION_RANGE_OCTAVE_LIMIT = 20;
/**
 * Vertical space reserved below the plot for the range band handles + axis labels
 * when a range is shown.
 */
const FILTER_RANGE_PLOT_BOTTOM_PADDING_WITH_RANGE = 56;
/**
 * Extra top padding when handle chips are shown — they cap the dashed guide
 * lines at the top of the plot, so the plot floor must recede to make room.
 */
const FILTER_RANGE_PLOT_TOP_PADDING_WITH_CHIPS = 34;
const FILTER_RANGE_MIN_HANDLE_PLOT_GAP = 14;
const FILTER_RANGE_FREQUENCY_LABEL_BASELINE_INSET = 6;
const FILTER_RANGE_FREQUENCY_LABEL_HEIGHT = 13;
const FILTER_RANGE_HANDLE_LABEL_CLEARANCE = 4;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function joinClasses(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

export function filterRangeModeToResponseMode(mode: FilterRangeMode) {
    if (mode === "lowpass") return FILTER_MODE_LOWPASS;
    if (mode === "highpass") return FILTER_MODE_HIGHPASS;
    if (mode === "bandpass") return FILTER_MODE_BANDPASS;
    if (mode === "notch") return FILTER_MODE_NOTCH;
    if (mode === "peak") return FILTER_MODE_PEAK;
    return FILTER_MODE_OFF;
}

export function responseModeToFilterRangeMode(mode: number): FilterRangeMode {
    if (mode === FILTER_MODE_LOWPASS) return "lowpass";
    if (mode === FILTER_MODE_HIGHPASS) return "highpass";
    if (mode === FILTER_MODE_BANDPASS) return "bandpass";
    if (mode === FILTER_MODE_NOTCH) return "notch";
    if (mode === FILTER_MODE_PEAK) return "peak";
    return "off";
}

export function clampFilterRangeValue(value: FilterRangeValue): FilterRangeValue {
    return {
        mode: value.mode,
        cutoffHz: clampFilterCutoffHz(value.cutoffHz),
        q: clampFilterQ(value.q),
    };
}

export function clampFilterRangeEndpoints(range: FilterRangeEndpoints): FilterRangeEndpoints {
    return {
        startCutoffHz: clampFilterCutoffHz(range.startCutoffHz),
        endCutoffHz: clampFilterCutoffHz(range.endCutoffHz),
    };
}

export function createDefaultFilterRangeQScale(): FilterRangeQScale {
    const resonanceCurve = createDefaultCurveProfile(FILTER_RANGE_RESONANCE_CURVE_TARGET_ID);

    return {
        qToSurface(qValue) {
            return invertCurveProfile(
                FILTER_RANGE_RESONANCE_CURVE_TARGET_ID,
                resonanceCurve,
                filterQToNormalized(qValue),
            );
        },
        surfaceToQ(surfaceValue) {
            return normalizedToFilterQ(
                evaluateCurveProfile(FILTER_RANGE_RESONANCE_CURVE_TARGET_ID, resonanceCurve, surfaceValue),
            );
        },
    };
}

export const DEFAULT_FILTER_RANGE_Q_SCALE = createDefaultFilterRangeQScale();

export function geometricCenterCutoffHz(startCutoffHz: number, endCutoffHz: number) {
    const start = clampFilterCutoffHz(startCutoffHz);
    const end = clampFilterCutoffHz(endCutoffHz);
    return clampFilterCutoffHz(Math.sqrt(start * end));
}

export function cutoffRangeOctaves(startCutoffHz: number, endCutoffHz: number) {
    const start = clampFilterCutoffHz(startCutoffHz);
    const end = clampFilterCutoffHz(endCutoffHz);
    return Math.abs(Math.log2(end / start));
}

export function cutoffsFromBaseModulationOctaves({
    baseCutoffHz,
    amountOctaves,
    polarity,
}: {
    baseCutoffHz: number;
    amountOctaves: number;
    polarity: FilterRangePolarity;
}): FilterRangeEndpoints {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const amount = clamp(finiteNumber(amountOctaves, 0), -MODULATION_RANGE_OCTAVE_LIMIT, MODULATION_RANGE_OCTAVE_LIMIT);

    if (polarity === "bipolar") {
        const ratio = 2 ** Math.abs(amount);
        return {
            startCutoffHz: clampFilterCutoffHz(base / ratio),
            endCutoffHz: clampFilterCutoffHz(base * ratio),
        };
    }

    return {
        startCutoffHz: base,
        endCutoffHz: clampFilterCutoffHz(base * (2 ** amount)),
    };
}

export function cutoffsFromBipolarRangeHandleCutoff({
    baseCutoffHz,
    handleCutoffHz,
}: {
    baseCutoffHz: number;
    handleCutoffHz: number;
}): FilterRangeEndpoints {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const handle = clampFilterCutoffHz(handleCutoffHz);
    const amountOctaves = Math.abs(Math.log2(handle / base));

    return cutoffsFromBaseModulationOctaves({
        baseCutoffHz: base,
        amountOctaves,
        polarity: "bipolar",
    });
}

export function modulationOctavesFromCutoffRange({
    baseCutoffHz,
    range,
    polarity,
}: {
    baseCutoffHz: number;
    range: FilterRangeEndpoints;
    polarity: FilterRangePolarity;
}) {
    const base = clampFilterCutoffHz(baseCutoffHz);
    const safeRange = clampFilterRangeEndpoints(range);

    if (polarity === "bipolar") {
        return Math.max(
            Math.abs(Math.log2(safeRange.startCutoffHz / base)),
            Math.abs(Math.log2(safeRange.endCutoffHz / base)),
        );
    }

    return Math.log2(safeRange.endCutoffHz / base);
}

export function cutoffsFromCenterRangeOctaves({
    centerCutoffHz,
    rangeOctaves,
    direction,
}: {
    centerCutoffHz: number;
    rangeOctaves: number;
    direction: 1 | -1;
}): FilterRangeEndpoints {
    const center = clampFilterCutoffHz(centerCutoffHz);
    const ratio = 2 ** (clamp(finiteNumber(rangeOctaves, 0), 0, 20) * 0.5);
    const lowCutoffHz = clampFilterCutoffHz(center / ratio);
    const highCutoffHz = clampFilterCutoffHz(center * ratio);

    return direction >= 0
        ? { startCutoffHz: lowCutoffHz, endCutoffHz: highCutoffHz }
        : { startCutoffHz: highCutoffHz, endCutoffHz: lowCutoffHz };
}

function buildMagnitudePath(
    magnitudesDb: number[],
    width: number,
    height: number,
    {
        horizontalPadding = editorPlotGutter(width),
        topPadding = EDITOR_PLOT_TOP_PADDING_PX,
        bottomPadding = EDITOR_PLOT_BOTTOM_PADDING_PX,
        minDb = -24,
        maxDb = 18,
    }: {
        horizontalPadding?: number;
        topPadding?: number;
        bottomPadding?: number;
        minDb?: number;
        maxDb?: number;
    } = {},
): PlotPath {
    const plot = createEditorCurvePlotRect(width, height, {
        horizontalPaddingPx: horizontalPadding,
        topPaddingPx: topPadding,
        bottomPaddingPx: bottomPadding,
    });
    const points = magnitudesDb.map((magnitudeDb, index) => {
        const x = plot.plotLeft + (plot.plotWidth * (index / Math.max(1, magnitudesDb.length - 1)));
        const normalized = clamp((clamp(magnitudeDb, minDb, maxDb) - minDb) / (maxDb - minDb), 0, 1);
        const y = plot.plotBottom - (plot.plotHeight * normalized);
        return { x, y };
    });

    return {
        path: polylineToSvgPath(points),
        ...plot,
    };
}

function createResponsePath({
    value,
    sampleRateHz,
    size,
    topPadding,
    bottomPadding,
}: {
    value: FilterRangeValue;
    sampleRateHz: number;
    size: Size;
    topPadding: number;
    bottomPadding: number;
}) {
    const model = createFilterResponseModel({
        mode: filterRangeModeToResponseMode(value.mode),
        cutoffHz: value.cutoffHz,
        q: value.q,
        sampleRate: sampleRateHz,
        pointCount: FILTER_RANGE_RESPONSE_POINT_COUNT,
    });

    return {
        model,
        path: buildMagnitudePath(model.magnitudesDb, size.width, size.height, { topPadding, bottomPadding }),
    };
}

function pointForCutoffAndQ({
    cutoffHz,
    q,
    plot,
    qScale,
}: {
    cutoffHz: number;
    q: number;
    plot: PlotPath;
    qScale: FilterRangeQScale;
}) {
    const cutoffNormalized = filterCutoffHzToNormalized(cutoffHz);
    const qSurface = clamp(qScale.qToSurface(q), 0, 1);

    return {
        cutoffNormalized,
        qSurface,
        x: plot.plotLeft + (plot.plotWidth * cutoffNormalized),
        y: plot.plotBottom - (plot.plotHeight * qSurface),
    };
}

function cutoffForSurfaceX(plotX: number, plot: PlotPath) {
    return clampFilterCutoffHz(normalizedToFilterCutoffHz(
        (plotX - plot.plotLeft) / Math.max(1, plot.plotWidth),
    ));
}

function qForSurfaceY(plotY: number, plot: PlotPath, qScale: FilterRangeQScale) {
    const nextQSurface = clamp(
        1 - ((plotY - plot.plotTop) / Math.max(1, plot.plotHeight)),
        0,
        1,
    );
    return clampFilterQ(qScale.surfaceToQ(nextQSurface));
}

function cutoffFromKeyboard(currentCutoffHz: number, event: ReactKeyboardEvent<SVGCircleElement>) {
    const step = KEYBOARD_CUTOFF_STEP * (event.shiftKey ? KEYBOARD_FAST_MULTIPLIER : 1);
    const normalized = filterCutoffHzToNormalized(currentCutoffHz);

    if (event.key === "ArrowLeft") {
        return normalizedToFilterCutoffHz(clamp(normalized - step, 0, 1));
    }

    if (event.key === "ArrowRight") {
        return normalizedToFilterCutoffHz(clamp(normalized + step, 0, 1));
    }

    if (event.key === "Home") {
        return normalizedToFilterCutoffHz(0);
    }

    if (event.key === "End") {
        return normalizedToFilterCutoffHz(1);
    }

    return null;
}

function qFromKeyboard(currentQ: number, event: ReactKeyboardEvent<SVGCircleElement>, qScale: FilterRangeQScale) {
    const step = KEYBOARD_Q_STEP * (event.shiftKey ? KEYBOARD_FAST_MULTIPLIER : 1);
    const surface = clamp(qScale.qToSurface(currentQ), 0, 1);

    if (event.key === "ArrowDown") {
        return clampFilterQ(qScale.surfaceToQ(clamp(surface - step, 0, 1)));
    }

    if (event.key === "ArrowUp") {
        return clampFilterQ(qScale.surfaceToQ(clamp(surface + step, 0, 1)));
    }

    return null;
}

function formatHz(value: number) {
    const cutoff = clampFilterCutoffHz(value);
    if (cutoff >= 1000) {
        const khz = cutoff / 1000;
        return `${Number(khz.toFixed(khz >= 10 ? 0 : 1))}k`;
    }
    return String(Math.round(cutoff));
}

function formatHzChip(value: number) {
    const cutoff = clampFilterCutoffHz(value);
    const roundedCutoff = Math.round(cutoff);
    if (roundedCutoff >= 10_000) {
        return `${(roundedCutoff / 1000).toFixed(1)}k`;
    }

    if (roundedCutoff >= 1000) {
        return `${(roundedCutoff / 1000).toFixed(2)}k`;
    }

    return String(roundedCutoff);
}

function formatHzLong(value: number) {
    const cutoff = clampFilterCutoffHz(value);
    if (cutoff >= 1000) {
        const khz = cutoff / 1000;
        return `${khz >= 10 ? khz.toFixed(1) : khz.toFixed(2)} kHz`;
    }
    return `${Math.round(cutoff)} Hz`;
}

function formatOctaves(value: number) {
    return `${value.toFixed(2)} oct`;
}

function filterRangeChipStyle(surfaceX: number) {
    return {
        "--filter-range-chip-x": `${surfaceX.toFixed(2)}px`,
    } as CSSProperties;
}

function isRangeEditable(props: FilterRangeEditorProps) {
    return Boolean(props.range && props.onRangeChange);
}

function isValueEditable(props: FilterRangeEditorProps) {
    return Boolean(props.onValueChange);
}

function getFilterRangeModeLabel(mode: FilterRangeMode, options: FilterRangeModeOption[]) {
    return options.find((option) => option.value === mode)?.label
        ?? (mode === "off" ? "Off" : mode);
}

function getNextFilterRangeMode(currentMode: FilterRangeMode, options: FilterRangeModeOption[]) {
    if (options.length === 0) {
        return currentMode;
    }

    const currentIndex = options.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % options.length
        : 0;

    return options[nextIndex]?.value ?? currentMode;
}

const FILTER_RANGE_CHIP_HEIGHT = 18;
const FILTER_RANGE_CHIP_PADDING_X = 8;
const FILTER_RANGE_CHIP_CHAR_WIDTH = 6.2;
const FILTER_RANGE_CHIP_MIN_WIDTH = 34;
const FILTER_RANGE_CHIP_BASELINE_OFFSET = 4;

function chipRectWidth(label: string) {
    return Math.max(FILTER_RANGE_CHIP_MIN_WIDTH, (label.length * FILTER_RANGE_CHIP_CHAR_WIDTH) + (FILTER_RANGE_CHIP_PADDING_X * 2));
}

function clampChipX(x: number, plot: PlotPath) {
    // Chips stay anchored to handle X but never escape the plot interior, so
    // nothing can drift outside the surface at extreme cutoff values.
    return clamp(x, plot.plotLeft, plot.plotRight);
}

type FilterRangeHandleChipProps = {
    clampX: (x: number) => number;
    "data-role": string;
    label: string;
    plotTop: number;
    variant: "center" | "start" | "end";
    x: number;
};

function FilterRangeHandleChip({
    clampX,
    label,
    plotTop,
    variant,
    x,
    "data-role": dataRole,
}: FilterRangeHandleChipProps) {
    const width = chipRectWidth(label);
    const halfWidth = width / 2;
    const chipCenterY = plotTop - (FILTER_RANGE_CHIP_HEIGHT / 2) - 2;
    const chipX = clampX(x);
    return (
        <g
            className="filter-range-editor__handle-chip-group"
            data-role={dataRole}
            transform={`translate(${chipX.toFixed(2)}, ${chipCenterY.toFixed(2)})`}
        >
            <rect
                className={`filter-range-editor__handle-chip filter-range-editor__handle-chip--${variant}`}
                x={-halfWidth}
                y={-(FILTER_RANGE_CHIP_HEIGHT / 2)}
                width={width}
                height={FILTER_RANGE_CHIP_HEIGHT}
                rx="3"
            />
            <text
                className={`filter-range-editor__handle-chip-text filter-range-editor__handle-chip-text--${variant}`}
                x={0}
                y={FILTER_RANGE_CHIP_BASELINE_OFFSET}
                textAnchor="middle"
            >
                {label}
            </text>
        </g>
    );
}

function FilterRangeModeGlyph({ mode }: { mode: FilterRangeMode }) {
    switch (mode) {
        case "lowpass":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 7.5H9.5C12.5 7.5 15.5 9 16.5 12.5L18.5 19"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case "highpass":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 18.5L5.5 15.5C7.5 12.5 9.5 8.5 13 7.5H21"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case "bandpass":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 18.5C6.5 18.5 8 18 9.5 14.5C11 11 11.5 8 12 8C12.5 8 13 11 14.5 14.5C16 18 17.5 18.5 21 18.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case "notch":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 8.5C8 8.5 9 8.5 10.5 13.5C11.25 16 11.75 17.5 12 17.5C12.25 17.5 12.75 16 13.5 13.5C15 8.5 16 8.5 21 8.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        case "peak":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 18.5C8 18.5 9 18 10.5 12C11.3 8 11.8 5.5 12 5.5C12.2 5.5 12.7 8 13.5 12C15 18 16 18.5 21 18.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M3 12H21"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                    />
                </svg>
            );
    }
}

export function FilterRangeEditor(props: FilterRangeEditorProps) {
    const {
        value,
        range = null,
        rangePolarity = "bipolar",
        preview = null,
        modeOptions = FILTER_RANGE_MODE_OPTIONS,
        showModeControls = false,
        showHandleChips = false,
        showReadout = false,
        sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
        qScale = DEFAULT_FILTER_RANGE_Q_SCALE,
        className,
        style,
        ariaLabel = "Filter range editor",
        onValueChange,
        onRangeChange,
        onEditStart,
        onEditEnd,
    } = props;
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const [activeDragTarget, setActiveDragTarget] = useState<FilterRangeEditTarget | null>(null);
    const size = useEditorSurfaceSize(viewportRef);
    const safeSampleRateHz = Math.max(1, Math.round(finiteNumber(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ)));
    const hasRangeView = Boolean(range);
    const plotBottomPadding = hasRangeView
        ? FILTER_RANGE_PLOT_BOTTOM_PADDING_WITH_RANGE
        : EDITOR_PLOT_BOTTOM_PADDING_PX;
    // Top reserve is only needed when range chips are shown at the top of the
    // plot. The center chip stays anchored to the bottom, so chips-without-range
    // doesn't need extra top room.
    const plotTopPadding = showHandleChips && hasRangeView
        ? FILTER_RANGE_PLOT_TOP_PADDING_WITH_CHIPS
        : EDITOR_PLOT_TOP_PADDING_PX;
    const safeValue = useMemo(() => clampFilterRangeValue(value), [value]);
    const safeRange = useMemo(() => {
        if (!range) {
            return null;
        }

        const clampedRange = clampFilterRangeEndpoints(range);
        if (rangePolarity === "unipolar") {
            return {
                startCutoffHz: safeValue.cutoffHz,
                endCutoffHz: clampedRange.endCutoffHz,
            };
        }

        return clampedRange;
    }, [range, rangePolarity, safeValue.cutoffHz]);
    const previewValue = useMemo<FilterRangeValue | null>(() => {
        if (!preview || preview.active === false) {
            return null;
        }

        return clampFilterRangeValue({
            mode: preview.mode ?? safeValue.mode,
            cutoffHz: preview.cutoffHz ?? safeValue.cutoffHz,
            q: preview.q ?? safeValue.q,
        });
    }, [preview, safeValue]);
    const baseResponse = useMemo(() => (
        createResponsePath({
            value: safeValue,
            sampleRateHz: safeSampleRateHz,
            size,
            topPadding: plotTopPadding,
            bottomPadding: plotBottomPadding,
        })
    ), [plotBottomPadding, plotTopPadding, safeSampleRateHz, safeValue, size]);
    const previewResponse = useMemo(() => (
        previewValue
            ? createResponsePath({
                value: previewValue,
                sampleRateHz: safeSampleRateHz,
                size,
                topPadding: plotTopPadding,
                bottomPadding: plotBottomPadding,
            })
            : null
    ), [plotBottomPadding, plotTopPadding, previewValue, safeSampleRateHz, size]);
    const handlePoint = useMemo(() => (
        pointForCutoffAndQ({
            cutoffHz: safeValue.cutoffHz,
            q: safeValue.q,
            plot: baseResponse.path,
            qScale,
        })
    ), [baseResponse.path, qScale, safeValue]);
    const previewPoint = useMemo(() => (
        previewValue
            ? pointForCutoffAndQ({
                cutoffHz: previewValue.cutoffHz,
                q: previewValue.q,
                plot: baseResponse.path,
                qScale,
            })
            : null
    ), [baseResponse.path, previewValue, qScale]);
    const rangeGeometry = useMemo(() => {
        if (!safeRange) {
            return null;
        }

        const startX = baseResponse.path.plotLeft
            + (baseResponse.path.plotWidth * filterCutoffHzToNormalized(safeRange.startCutoffHz));
        const endX = baseResponse.path.plotLeft
            + (baseResponse.path.plotWidth * filterCutoffHzToNormalized(safeRange.endCutoffHz));
        const bandLeft = Math.min(startX, endX);
        const bandRight = Math.max(startX, endX);
        const frequencyLabelY = size.height - FILTER_RANGE_FREQUENCY_LABEL_BASELINE_INSET;
        const maxBandY = frequencyLabelY
            - FILTER_RANGE_FREQUENCY_LABEL_HEIGHT
            - FILTER_RANGE_HANDLE_LABEL_CLEARANCE
            - EDITOR_HIT_RADIUS_PX;
        const preferredBandY = baseResponse.path.plotBottom
            + Math.max(FILTER_RANGE_MIN_HANDLE_PLOT_GAP, (size.height - baseResponse.path.plotBottom) * 0.42);
        const bandY = Math.min(preferredBandY, maxBandY);

        return {
            startX,
            endX,
            bandLeft,
            bandRight,
            bandY,
            bandWidth: Math.max(1, bandRight - bandLeft),
        };
    }, [baseResponse.path, safeRange, size.height]);
    const rangeWidthOctaves = useMemo(() => {
        if (!safeRange) {
            return 0;
        }

        return rangePolarity === "unipolar"
            ? modulationOctavesFromCutoffRange({
                baseCutoffHz: safeValue.cutoffHz,
                range: safeRange,
                polarity: "unipolar",
            })
            : cutoffRangeOctaves(safeRange.startCutoffHz, safeRange.endCutoffHz);
    }, [rangePolarity, safeRange, safeValue.cutoffHz]);
    const rangeDirection = safeRange && safeRange.endCutoffHz < safeRange.startCutoffHz ? "down" : "up";
    const rangeMidpointCutoffHz = safeRange
        ? geometricCenterCutoffHz(safeRange.startCutoffHz, safeRange.endCutoffHz)
        : safeValue.cutoffHz;
    const rangeMidpointX = baseResponse.path.plotLeft
        + (baseResponse.path.plotWidth * filterCutoffHzToNormalized(rangeMidpointCutoffHz));
    const modeLabel = getFilterRangeModeLabel(safeValue.mode, modeOptions);
    const modeCycleAriaLabel = `Cycle filter mode, currently ${modeLabel}`;

    const applyDragPosition = (clientX: number, clientY: number) => {
        const surface = surfaceRef.current;
        const dragState = dragStateRef.current;

        if (!surface || !dragState) {
            return;
        }

        const bounds = surface.getBoundingClientRect();
        const handleClientX = clientX - dragState.pointerOffsetX;
        const handleClientY = clientY - dragState.pointerOffsetY;
        const plotX = clamp(handleClientX - bounds.left, baseResponse.path.plotLeft, baseResponse.path.plotRight);
        const nextCutoffHz = cutoffForSurfaceX(plotX, baseResponse.path);

        if (dragState.target === "value") {
            const plotY = clamp(handleClientY - bounds.top, baseResponse.path.plotTop, baseResponse.path.plotBottom);
            onValueChange?.({
                ...safeValue,
                cutoffHz: nextCutoffHz,
                q: qForSurfaceY(plotY, baseResponse.path, qScale),
            });
            return;
        }

        if (!safeRange) {
            return;
        }

        onRangeChange?.(
            dragState.target === "range-start"
                ? { ...safeRange, startCutoffHz: nextCutoffHz }
                : { ...safeRange, endCutoffHz: nextCutoffHz },
        );
    };

    const handleValueKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
        if (!isValueEditable(props)) {
            return;
        }

        const nextCutoffHz = cutoffFromKeyboard(safeValue.cutoffHz, event);
        const nextQ = qFromKeyboard(safeValue.q, event, qScale);

        if (nextCutoffHz === null && nextQ === null) {
            return;
        }

        event.preventDefault();
        onValueChange?.({
            ...safeValue,
            cutoffHz: nextCutoffHz ?? safeValue.cutoffHz,
            q: nextQ ?? safeValue.q,
        });
    };

    const handleRangeKeyDown = (
        target: FilterRangeEditTarget,
        event: ReactKeyboardEvent<SVGCircleElement>,
    ) => {
        if (!safeRange || !isRangeEditable(props)) {
            return;
        }

        const currentCutoffHz = target === "range-start"
            ? safeRange.startCutoffHz
            : safeRange.endCutoffHz;
        const nextCutoffHz = cutoffFromKeyboard(currentCutoffHz, event);

        if (nextCutoffHz === null) {
            return;
        }

        event.preventDefault();
        onRangeChange?.(
            target === "range-start"
                ? { ...safeRange, startCutoffHz: nextCutoffHz }
                : { ...safeRange, endCutoffHz: nextCutoffHz },
        );
    };

    const endDrag = (pointerId: number) => {
        const dragState = dragStateRef.current;

        if (!dragState || dragState.pointerId !== pointerId) {
            return;
        }

        const surface = surfaceRef.current;
        if (surface?.hasPointerCapture(pointerId)) {
            surface.releasePointerCapture(pointerId);
        }

        if (dragState.hasMoved) {
            onEditEnd?.(dragState.target);
        }

        dragStateRef.current = null;
        setActiveDragTarget(null);
    };

    const beginDrag = (
        target: FilterRangeEditTarget,
        event: ReactPointerEvent<SVGCircleElement>,
        origin: { x: number; y: number },
    ) => {
        event.preventDefault();
        surfaceRef.current?.setPointerCapture(event.pointerId);
        const bounds = surfaceRef.current?.getBoundingClientRect();
        dragStateRef.current = {
            pointerId: event.pointerId,
            target,
            startClientX: event.clientX,
            startClientY: event.clientY,
            pointerOffsetX: bounds ? event.clientX - (bounds.left + origin.x) : 0,
            pointerOffsetY: bounds ? event.clientY - (bounds.top + origin.y) : 0,
            hasMoved: false,
        };
        setActiveDragTarget(target);
    };

    return (
        <div
            className={joinClasses("filter-range-editor", className)}
            data-active-drag-target={activeDragTarget ?? undefined}
            data-filter-mode={safeValue.mode}
            data-range-polarity={rangePolarity}
            data-role="filter-range-editor"
            data-show-chips={showHandleChips ? "true" : "false"}
            data-has-range={hasRangeView ? "true" : "false"}
            style={style}
        >
            <div ref={viewportRef} className="filter-range-editor__viewport" data-role="filter-range-editor-viewport">
                {showModeControls && modeOptions.length > 0 ? (
                    <button
                        aria-label={modeCycleAriaLabel}
                        className="filter-range-editor__mode-cycle"
                        data-mode-label={modeLabel}
                        data-role="filter-range-mode-cycle-button"
                        title={`Filter mode: ${modeLabel}`}
                        type="button"
                        onClick={() => {
                            onValueChange?.({
                                ...safeValue,
                                mode: getNextFilterRangeMode(safeValue.mode, modeOptions),
                            });
                        }}
                    >
                        <FilterRangeModeGlyph mode={safeValue.mode} />
                    </button>
                ) : null}
                <EditorCurveSurface
                    ref={surfaceRef}
                    ariaLabel={ariaLabel}
                    className="filter-range-editor__surface"
                    dataRole="filter-range-editor-surface"
                    heightPx={size.height}
                    role="group"
                    style={{
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                    }}
                    widthPx={size.width}
                    onPointerMove={(event) => {
                        const dragState = dragStateRef.current;

                        if (!dragState || dragState.pointerId !== event.pointerId) {
                            return;
                        }

                        const deltaX = event.clientX - dragState.startClientX;
                        const deltaY = event.clientY - dragState.startClientY;
                        if (!dragState.hasMoved && Math.abs(deltaX) < EDITOR_DRAG_START_THRESHOLD_PX && Math.abs(deltaY) < EDITOR_DRAG_START_THRESHOLD_PX) {
                            return;
                        }

                        if (!dragState.hasMoved) {
                            dragState.hasMoved = true;
                            onEditStart?.(dragState.target);
                        }

                        applyDragPosition(event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => endDrag(event.pointerId)}
                    onPointerCancel={(event) => endDrag(event.pointerId)}
                >
                    <EditorCurvePlotArea plot={baseResponse.path} />
                    {[0.2, 0.4, 0.6, 0.8].map((tick) => (
                        <line
                            key={`v-${tick}`}
                            className="editor-curve-grid-line filter-range-editor__grid-line"
                            data-role="filter-range-editor-grid-line"
                            x1={baseResponse.path.plotLeft + (baseResponse.path.plotWidth * tick)}
                            x2={baseResponse.path.plotLeft + (baseResponse.path.plotWidth * tick)}
                            y1={baseResponse.path.plotTop}
                            y2={baseResponse.path.plotBottom}
                        />
                    ))}
                    {[0.25, 0.5, 0.75].map((tick) => (
                        <line
                            key={`h-${tick}`}
                            className="editor-curve-grid-line filter-range-editor__grid-line"
                            data-role="filter-range-editor-grid-line"
                            x1={baseResponse.path.plotLeft}
                            x2={baseResponse.path.plotRight}
                            y1={baseResponse.path.plotTop + (baseResponse.path.plotHeight * tick)}
                            y2={baseResponse.path.plotTop + (baseResponse.path.plotHeight * tick)}
                        />
                    ))}
                    <line
                        className="editor-curve-axis filter-range-editor__axis"
                        data-role="filter-range-editor-axis"
                        x1={baseResponse.path.plotLeft}
                        x2={baseResponse.path.plotRight}
                        y1={baseResponse.path.plotBottom}
                        y2={baseResponse.path.plotBottom}
                    />
                    <line
                        className="editor-curve-axis filter-range-editor__axis"
                        data-role="filter-range-editor-axis"
                        x1={baseResponse.path.plotLeft}
                        x2={baseResponse.path.plotLeft}
                        y1={baseResponse.path.plotTop}
                        y2={baseResponse.path.plotBottom}
                    />
                    {safeRange && rangeGeometry ? (
                        <>
                            <rect
                                className="filter-range-editor__range-band"
                                data-role="filter-range-band"
                                height="10"
                                rx="4"
                                width={rangeGeometry.bandWidth}
                                x={rangeGeometry.bandLeft}
                                y={rangeGeometry.bandY - 5}
                            />
                            <line
                                className="filter-range-editor__range-guide"
                                data-role="filter-range-start-guide"
                                x1={rangeGeometry.startX}
                                x2={rangeGeometry.startX}
                                y1={showHandleChips ? baseResponse.path.plotTop - 2 : baseResponse.path.plotTop}
                                y2={rangeGeometry.bandY + 12}
                            />
                            <line
                                className="filter-range-editor__range-guide"
                                data-role="filter-range-end-guide"
                                x1={rangeGeometry.endX}
                                x2={rangeGeometry.endX}
                                y1={showHandleChips ? baseResponse.path.plotTop - 2 : baseResponse.path.plotTop}
                                y2={rangeGeometry.bandY + 12}
                            />
                        </>
                    ) : null}
                    <EditorCurvePath
                        className="filter-range-editor__response-path"
                        data-role="filter-range-value-response"
                        d={baseResponse.path.path}
                    />
                    {previewResponse && previewPoint ? (
                        <>
                            <EditorCurvePath
                                className="filter-range-editor__preview-response-path"
                                data-role="filter-range-preview-response"
                                d={previewResponse.path.path}
                                variant="preview"
                            />
                            <circle
                                className="filter-range-editor__preview-handle"
                                data-role="filter-range-preview-handle"
                                cx={previewPoint.x}
                                cy={previewPoint.y}
                                r={EDITOR_RANGE_HANDLE_RADIUS_PX * 0.75}
                            />
                        </>
                    ) : null}
                    {safeRange && rangeGeometry ? (
                        <>
                            {rangePolarity === "bipolar" ? (
                                <>
                                    <EditorCurveHandle
                                        className="filter-range-editor__range-handle filter-range-editor__range-handle--start"
                                        data-role="filter-range-start-handle"
                                        cx={rangeGeometry.startX}
                                        cy={rangeGeometry.bandY}
                                        variant="range-start"
                                    />
                                    <EditorCurveHitTarget
                                        aria-label="Filter range start cutoff"
                                        aria-valuemax={FILTER_CUTOFF_MAX_HZ}
                                        aria-valuemin={FILTER_CUTOFF_MIN_HZ}
                                        aria-valuenow={Math.round(safeRange.startCutoffHz)}
                                        className="filter-range-editor__range-hit-target"
                                        data-role="filter-range-start-hit-target"
                                        role="slider"
                                        tabIndex={isRangeEditable(props) ? 0 : undefined}
                                        cx={rangeGeometry.startX}
                                        cy={rangeGeometry.bandY}
                                        onKeyDown={(event) => handleRangeKeyDown("range-start", event)}
                                        onPointerDown={(event) => {
                                            if (isRangeEditable(props)) {
                                                beginDrag("range-start", event, { x: rangeGeometry.startX, y: rangeGeometry.bandY });
                                            }
                                        }}
                                    />
                                </>
                            ) : null}
                            <EditorCurveHandle
                                className="filter-range-editor__range-handle filter-range-editor__range-handle--end"
                                data-role="filter-range-end-handle"
                                cx={rangeGeometry.endX}
                                cy={rangeGeometry.bandY}
                                variant="range-end"
                            />
                            <EditorCurveHitTarget
                                aria-label="Filter range end cutoff"
                                aria-valuemax={FILTER_CUTOFF_MAX_HZ}
                                aria-valuemin={FILTER_CUTOFF_MIN_HZ}
                                aria-valuenow={Math.round(safeRange.endCutoffHz)}
                                className="filter-range-editor__range-hit-target"
                                data-role="filter-range-end-hit-target"
                                role="slider"
                                tabIndex={isRangeEditable(props) ? 0 : undefined}
                                cx={rangeGeometry.endX}
                                cy={rangeGeometry.bandY}
                                onKeyDown={(event) => handleRangeKeyDown("range-end", event)}
                                onPointerDown={(event) => {
                                    if (isRangeEditable(props)) {
                                        beginDrag("range-end", event, { x: rangeGeometry.endX, y: rangeGeometry.bandY });
                                    }
                                }}
                            />
                        </>
                    ) : null}
                    <line
                        className="filter-range-editor__value-guide"
                        data-role="filter-range-value-guide"
                        x1={handlePoint.x}
                        x2={handlePoint.x}
                        y1={baseResponse.path.plotBottom}
                        y2={handlePoint.y}
                    />
                    <EditorCurveHandleHalo
                        className="filter-range-editor__value-halo"
                        data-role="filter-range-value-halo"
                        cx={handlePoint.x}
                        cy={handlePoint.y}
                    />
                    <EditorCurveHandle
                        className="filter-range-editor__value-handle"
                        data-role="filter-range-value-handle"
                        cx={handlePoint.x}
                        cy={handlePoint.y}
                    />
                    <EditorCurveHitTarget
                        aria-label="Filter cutoff and resonance"
                        aria-valuemax={FILTER_CUTOFF_MAX_HZ}
                        aria-valuemin={FILTER_CUTOFF_MIN_HZ}
                        aria-valuenow={Math.round(safeValue.cutoffHz)}
                        aria-valuetext={`${formatHz(safeValue.cutoffHz)}, Q ${safeValue.q.toFixed(2)}`}
                        className="filter-range-editor__value-hit-target"
                        data-role="filter-range-value-hit-target"
                        role="slider"
                        tabIndex={isValueEditable(props) ? 0 : undefined}
                        cx={handlePoint.x}
                        cy={handlePoint.y}
                        onKeyDown={handleValueKeyDown}
                        onPointerDown={(event) => {
                            if (isValueEditable(props)) {
                                beginDrag("value", event, { x: handlePoint.x, y: handlePoint.y });
                            }
                        }}
                    />
                    {[20, 100, 1000, 10_000, 20_000].map((frequencyHz) => (
                        <text
                            key={frequencyHz}
                            className="filter-range-editor__frequency-label"
                            data-role="filter-range-frequency-label"
                            x={baseResponse.path.plotLeft + (baseResponse.path.plotWidth * filterCutoffHzToNormalized(frequencyHz))}
                            y={size.height - FILTER_RANGE_FREQUENCY_LABEL_BASELINE_INSET}
                            textAnchor="middle"
                        >
                            {formatHz(frequencyHz)}
                        </text>
                    ))}
                    {showHandleChips && safeRange ? (
                        <g data-role="filter-range-chip-layer" pointerEvents="none">
                            {rangePolarity === "bipolar" ? (
                                <FilterRangeHandleChip
                                    clampX={(x) => clampChipX(x, baseResponse.path)}
                                    data-role="filter-range-chip-start"
                                    label={formatHzChip(safeRange.startCutoffHz)}
                                    plotTop={baseResponse.path.plotTop}
                                    variant="start"
                                    x={rangeGeometry?.startX ?? 0}
                                />
                            ) : null}
                            <FilterRangeHandleChip
                                clampX={(x) => clampChipX(x, baseResponse.path)}
                                data-role="filter-range-chip-end"
                                label={formatHzChip(safeRange.endCutoffHz)}
                                plotTop={baseResponse.path.plotTop}
                                variant="end"
                                x={rangeGeometry?.endX ?? 0}
                            />
                        </g>
                    ) : null}
                </EditorCurveSurface>
                {showHandleChips ? (
                    <div
                        className="filter-range-editor__chips"
                        data-role="filter-range-chip-layer-secondary"
                        aria-hidden="true"
                    >
                        <div
                            className="filter-range-editor__chip filter-range-editor__chip--center"
                            data-role="filter-range-chip-center"
                            style={filterRangeChipStyle(handlePoint.x)}
                        >
                            <span
                                className="filter-range-editor__chip-hz"
                                data-role="filter-range-chip-center-cutoff"
                            >
                                {formatHzChip(safeValue.cutoffHz)}
                            </span>
                            <span
                                className="filter-range-editor__chip-q"
                                data-role="filter-range-chip-center-q"
                            >
                                Q {safeValue.q.toFixed(1)}
                            </span>
                        </div>
                        {safeRange ? (
                            <div
                                className="filter-range-editor__chip filter-range-editor__chip--span"
                                data-direction={rangeDirection}
                                data-role="filter-range-chip-span"
                                style={filterRangeChipStyle(rangeMidpointX)}
                            >
                                <span
                                    className="filter-range-editor__chip-direction"
                                    data-role="filter-range-chip-span-direction"
                                >
                                    {rangeDirection === "down" ? "↙" : "↗"}
                                </span>
                                <span
                                    className="filter-range-editor__chip-octaves"
                                    data-role="filter-range-chip-span-octaves"
                                >
                                    {formatOctaves(Math.abs(rangeWidthOctaves))}
                                </span>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {showReadout ? (
                <div className="filter-range-editor__readout" data-role="filter-range-readout" aria-label="Filter values">
                    <div data-role="filter-range-readout-center">
                        <span>Center</span>
                        <strong>{formatHzLong(safeValue.cutoffHz)}</strong>
                    </div>
                    {safeRange ? (
                        <>
                            <div data-role="filter-range-readout-range">
                                <span>Range</span>
                                <strong>{formatHzLong(safeRange.startCutoffHz)} to {formatHzLong(safeRange.endCutoffHz)}</strong>
                            </div>
                            <div data-role="filter-range-readout-width">
                                <span>Width</span>
                                <strong>{formatOctaves(rangeWidthOctaves)}</strong>
                            </div>
                        </>
                    ) : null}
                    <div data-role="filter-range-readout-q">
                        <span>Q</span>
                        <strong>{safeValue.q.toFixed(2)}</strong>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
