import {
    forwardRef,
    type CSSProperties,
    type HTMLAttributes,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import css from "./filter-editor.css?inline";
import { isStepKey, stepForKey, type KeyboardStep } from "./keyboard-steps";
import { useFilterSpectrum, type FilterSpectrum } from "./filter-spectrum-view";
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
    EDITOR_DRAG_START_THRESHOLD_PX,
    EDITOR_HIT_RADIUS_PX,
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    createEditorCurvePlotRect,
    editorPlotGutter,
    polylineToSvgPath,
} from "./editor-curve-geometry";
import {
    EditorCurveAxis,
    EditorCurveHandle,
    EditorCurveHandleHalo,
    EditorCurveHitTarget,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "./editor-curve-surface";
import { retainStyles } from "./styles";
import { useElementSize, type ElementSize } from "./use-element-size";

export type FilterMode = "off" | "lowpass" | "highpass" | "bandpass" | "notch" | "peak";
export type FilterRangePolarity = "bipolar" | "unipolar";

export type FilterValue = {
    mode: FilterMode;
    cutoffHz: number;
    q: number;
};

export type FilterModeOption = {
    label: string;
    value: FilterMode;
};

export type FilterRange = {
    startCutoffHz: number;
    endCutoffHz: number;
};

export type FilterPreview = Partial<FilterValue> & {
    active?: boolean;
    label?: string;
};

export type FilterQScale = {
    qToSurface: (qValue: number) => number;
    surfaceToQ: (surfaceValue: number) => number;
};

/** The grip a gesture edits. */
export type FilterEditTarget = "value" | "range-start" | "range-end"
    | "modulation-start" | "modulation-end" | "modulation-base" | "modulation-center";
export type FilterEndpoint = Pick<FilterValue, "cutoffHz" | "q">;
export type FilterModulationEndpoints = { start: FilterEndpoint; end: FilterEndpoint };
export type FilterModulation = FilterModulationEndpoints & {
    /** Axes the endpoint/center grips may edit. */
    axes?: "cutoff" | "q" | "both";
    showStartHandle?: boolean;
    showCenterHandle?: boolean;
    /** Use the value grip as the start endpoint for a unipolar range. */
    baseHandleMode?: "value" | "start";
    color?: string;
};
export type FilterModulationTarget = "start" | "end" | "base" | "center";
export type { FilterSpectrum } from "./filter-spectrum-view";

type FilterEditorCommonProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "children"> & {
    value: FilterValue;
    onModulationChange?: (next: FilterModulationEndpoints, target: FilterModulationTarget) => void;
    spectrum?: FilterSpectrum | null;
    disabled?: boolean;
    readOnly?: boolean;
    /** Geometry spacing, in CSS pixels. Defaults reserve space for the axis and cutoff band. */
    plotPadding?: { horizontal?: number; top?: number; bottom?: number };
    rangePolarity?: FilterRangePolarity;
    preview?: FilterPreview | null;
    modeOptions?: FilterModeOption[];
    showModeControls?: boolean;
    showHandleChips?: boolean;
    showReadout?: boolean;
    sampleRateHz?: number;
    qScale?: FilterQScale;
    onValueChange?: (nextValue: FilterValue) => void;
    onRangeChange?: (nextRange: FilterRange) => void;
    /** Like every kit control; `target` names the grip, for hosts that route grips to different parameters. */
    onGestureStart?: (target: FilterEditTarget) => void;
    onGestureEnd?: (cancelled: boolean, target: FilterEditTarget) => void;
};

/** Use either the cutoff band or the two-dimensional endpoint presentation. */
export type FilterEditorProps = FilterEditorCommonProps & (
    | { range?: FilterRange | null; modulation?: null }
    | { range?: null; modulation?: FilterModulation | null }
);
export const FILTER_MODE_OPTIONS: FilterModeOption[] = [
    { label: "LP", value: "lowpass" },
    { label: "HP", value: "highpass" },
    { label: "BP", value: "bandpass" },
    { label: "Notch", value: "notch" },
    { label: "Peak", value: "peak" },
];

type Size = ElementSize;

type PlotPath = {
    path: string;
    points: Array<{ x: number; y: number }>;
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
};

type DragState = {
    pointerId: number;
    target: FilterEditTarget;
    startClientX: number;
    startClientY: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
    hasMoved: boolean;
    travelAnchor?: { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } };
};

const FILTER_RANGE_RESPONSE_POINT_COUNT = 360;
const DEFAULT_SAMPLE_RATE_HZ = 44_100;
/** Keyboard step as a fraction of the cutoff travel (horizontal) and the Q surface (vertical). */
const KEYBOARD_CUTOFF_STEP = 0.01;
const KEYBOARD_Q_STEP = 0.025;
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

export function filterModeToResponseMode(mode: FilterMode) {
    if (mode === "lowpass") return FILTER_MODE_LOWPASS;
    if (mode === "highpass") return FILTER_MODE_HIGHPASS;
    if (mode === "bandpass") return FILTER_MODE_BANDPASS;
    if (mode === "notch") return FILTER_MODE_NOTCH;
    if (mode === "peak") return FILTER_MODE_PEAK;
    return FILTER_MODE_OFF;
}

export function responseModeToFilterMode(mode: number): FilterMode {
    if (mode === FILTER_MODE_LOWPASS) return "lowpass";
    if (mode === FILTER_MODE_HIGHPASS) return "highpass";
    if (mode === FILTER_MODE_BANDPASS) return "bandpass";
    if (mode === FILTER_MODE_NOTCH) return "notch";
    if (mode === FILTER_MODE_PEAK) return "peak";
    return "off";
}

export function clampFilterValue(value: FilterValue): FilterValue {
    return {
        mode: value.mode,
        cutoffHz: clampFilterCutoffHz(value.cutoffHz),
        q: clampFilterQ(value.q),
    };
}

export function clampFilterRange(range: FilterRange): FilterRange {
    return {
        startCutoffHz: clampFilterCutoffHz(range.startCutoffHz),
        endCutoffHz: clampFilterCutoffHz(range.endCutoffHz),
    };
}

// The default Q response is a logistic curve that spends most of the drag
// surface on low and moderate resonance, where small changes are audible.
const Q_CURVE_SLOPE = 11.1;
const Q_CURVE_CENTER = 0.84;
const logistic = (x: number) => 1 / (1 + Math.exp(-Q_CURVE_SLOPE * (x - Q_CURVE_CENTER)));
const LOGISTIC_LOW = logistic(0);
const LOGISTIC_SPAN = logistic(1) - LOGISTIC_LOW;

export const DEFAULT_FILTER_Q_SCALE: FilterQScale = {
    surfaceToQ: surface => normalizedToFilterQ((logistic(clamp(surface, 0, 1)) - LOGISTIC_LOW) / LOGISTIC_SPAN),
    qToSurface: q => {
        const level = LOGISTIC_LOW + (filterQToNormalized(q) * LOGISTIC_SPAN);
        return clamp(Q_CURVE_CENTER - (Math.log((1 / level) - 1) / Q_CURVE_SLOPE), 0, 1);
    },
};

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
        points,
        ...plot,
    };
}

function createResponsePath({
    value,
    sampleRateHz,
    size,
    topPadding,
    bottomPadding,
    horizontalPadding,
}: {
    value: FilterValue;
    sampleRateHz: number;
    size: Size;
    topPadding: number;
    bottomPadding: number;
    horizontalPadding?: number;
}) {
    const model = createFilterResponseModel({
        mode: filterModeToResponseMode(value.mode),
        cutoffHz: value.cutoffHz,
        q: value.q,
        sampleRate: sampleRateHz,
        pointCount: FILTER_RANGE_RESPONSE_POINT_COUNT,
    });

    return {
        model,
        path: buildMagnitudePath(model.magnitudesDb, size.width, size.height, { topPadding, bottomPadding, horizontalPadding }),
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
    qScale: FilterQScale;
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

function qForSurfaceY(plotY: number, plot: PlotPath, qScale: FilterQScale) {
    const nextQSurface = clamp(
        1 - ((plotY - plot.plotTop) / Math.max(1, plot.plotHeight)),
        0,
        1,
    );
    return clampFilterQ(qScale.surfaceToQ(nextQSurface));
}

/** One keyboard step of a cutoff, in normalized cutoff travel; Home and End reach its ends. */
function cutoffAfterKey(cutoffHz: number, edit: KeyboardStep) {
    if (edit.kind !== "step") return normalizedToFilterCutoffHz(edit.kind === "min" ? 0 : 1);
    return normalizedToFilterCutoffHz(clamp(filterCutoffHzToNormalized(cutoffHz) + (edit.steps * KEYBOARD_CUTOFF_STEP), 0, 1));
}

/** A keyboard edit of a two-dimensional grip: horizontal steps move cutoff, vertical steps move Q. */
function endpointAfterKey(endpoint: FilterEndpoint, edit: KeyboardStep, qScale: FilterQScale): FilterEndpoint {
    if (edit.kind !== "step" || edit.axis === "horizontal") return { ...endpoint, cutoffHz: cutoffAfterKey(endpoint.cutoffHz, edit) };
    const surface = clamp(qScale.qToSurface(endpoint.q), 0, 1);
    return { ...endpoint, q: clampFilterQ(qScale.surfaceToQ(clamp(surface + (edit.steps * KEYBOARD_Q_STEP), 0, 1))) };
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

function isRangeEditable(props: FilterEditorProps) {
    return !props.disabled && !props.readOnly && Boolean(props.range && props.onRangeChange);
}

function isValueEditable(props: FilterEditorProps) {
    return !props.disabled && !props.readOnly && Boolean(props.onValueChange);
}

function getFilterRangeModeLabel(mode: FilterMode, options: FilterModeOption[]) {
    return options.find((option) => option.value === mode)?.label
        ?? (mode === "off" ? "Off" : mode);
}

function getNextFilterRangeMode(currentMode: FilterMode, options: FilterModeOption[]) {
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

function FilterRangeModeGlyph({ mode }: { mode: FilterMode }) {
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

type OpenGesture = { readonly target: FilterEditTarget; readonly keyboard: boolean };

export const FilterEditor = forwardRef<HTMLDivElement, FilterEditorProps>(function FilterEditor(props, ref) {
    const {
        value,
        range = null,
        modulation = null,
        onModulationChange,
        spectrum = null,
        disabled = false,
        readOnly = false,
        plotPadding,
        rangePolarity = "bipolar",
        preview = null,
        modeOptions = FILTER_MODE_OPTIONS,
        showModeControls = false,
        showHandleChips = false,
        showReadout = false,
        sampleRateHz = DEFAULT_SAMPLE_RATE_HZ,
        qScale = DEFAULT_FILTER_Q_SCALE,
        className,
        "aria-label": ariaLabel = "Filter editor",
        onValueChange,
        onRangeChange,
        onGestureStart,
        onGestureEnd,
        ...rootProps
    } = props;
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const applyDragPositionRef = useRef<(clientX: number, clientY: number) => void>(() => undefined);
    const callbacks = useRef({ onGestureStart, onGestureEnd });
    callbacks.current = { onGestureStart, onGestureEnd };
    // One gesture is open at a time. A held key or a drag keeps it open; switching
    // grips closes the previous one first.
    const openGestureRef = useRef<OpenGesture | null>(null);
    const endGesture = useCallback((cancelled: boolean) => {
        const open = openGestureRef.current;
        if (!open) return;
        openGestureRef.current = null;
        callbacks.current.onGestureEnd?.(cancelled, open.target);
    }, []);
    const beginGesture = useCallback((target: FilterEditTarget, keyboard: boolean) => {
        if (openGestureRef.current?.target === target) return;
        endGesture(false);
        openGestureRef.current = { target, keyboard };
        callbacks.current.onGestureStart?.(target);
    }, [endGesture]);
    const [activeDragTarget, setActiveDragTarget] = useState<FilterEditTarget | null>(null);
    const size = useElementSize(viewportRef);
    useLayoutEffect(() => viewportRef.current ? retainStyles(viewportRef.current, "filter", css) : undefined, []);
    const modulationEditable = !disabled && !readOnly && Boolean(onModulationChange);
    // Keyed on fields rather than the object: callers usually pass `modulation`
    // inline, and a fresh object would recompute both travel curves every render.
    const modulationTravel = useMemo(() => modulation ? {
        ...modulation,
        start: { cutoffHz: clampFilterCutoffHz(modulation.start.cutoffHz), q: clampFilterQ(modulation.start.q) },
        end: { cutoffHz: clampFilterCutoffHz(modulation.end.cutoffHz), q: clampFilterQ(modulation.end.q) },
        showStartHandle: modulation.showStartHandle ?? true,
        centerHandle: modulation.showCenterHandle ?? true,
        accent: modulation.color ?? "var(--filter-modulation-color, var(--editor-accent-start, #00b4d8))",
    } : null, [modulation === null, modulation?.start.cutoffHz, modulation?.start.q,
        modulation?.end.cutoffHz, modulation?.end.q, modulation?.axes, modulation?.showStartHandle,
        modulation?.showCenterHandle, modulation?.baseHandleMode, modulation?.color]);
    const safeSampleRateHz = Math.max(1, Math.round(finiteNumber(sampleRateHz, DEFAULT_SAMPLE_RATE_HZ)));
    const hasRangeView = Boolean(range);
    const plotBottomPadding = plotPadding?.bottom ?? (hasRangeView
        ? FILTER_RANGE_PLOT_BOTTOM_PADDING_WITH_RANGE
        : EDITOR_PLOT_BOTTOM_PADDING_PX);
    // Top reserve is only needed when range chips are shown at the top of the
    // plot. The center chip stays anchored to the bottom, so chips-without-range
    // doesn't need extra top room.
    const plotTopPadding = plotPadding?.top ?? (showHandleChips && hasRangeView
        ? FILTER_RANGE_PLOT_TOP_PADDING_WITH_CHIPS
        : EDITOR_PLOT_TOP_PADDING_PX);
    // Keyed on fields for the same reason as modulationTravel.
    const safeValue = useMemo(() => clampFilterValue(value), [value.mode, value.cutoffHz, value.q]);
    const safeRange = useMemo(() => {
        if (!range) {
            return null;
        }

        const clampedRange = clampFilterRange(range);
        if (rangePolarity === "unipolar") {
            return {
                startCutoffHz: safeValue.cutoffHz,
                endCutoffHz: clampedRange.endCutoffHz,
            };
        }

        return clampedRange;
    }, [range, rangePolarity, safeValue.cutoffHz]);
    const previewValue = useMemo<FilterValue | null>(() => {
        if (!preview || preview.active === false) {
            return null;
        }

        return clampFilterValue({
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
            horizontalPadding: plotPadding?.horizontal,
        })
    ), [plotPadding?.horizontal, plotBottomPadding, plotTopPadding, safeSampleRateHz, safeValue, size]);
    const { spectrumCanvasRef } = useFilterSpectrum(spectrum, size, baseResponse.path);
    const previewResponse = useMemo(() => (
        previewValue
            ? createResponsePath({
                value: previewValue,
                sampleRateHz: safeSampleRateHz,
                size,
                topPadding: plotTopPadding,
                bottomPadding: plotBottomPadding,
            horizontalPadding: plotPadding?.horizontal,
            })
            : null
    ), [plotPadding?.horizontal, plotBottomPadding, plotTopPadding, previewValue, safeSampleRateHz, size]);
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
    const travelGeometry = useMemo(() => {
        if (!modulationTravel) {
            return null;
        }

        const pointFor = (state: FilterEndpoint) => ({
            x: baseResponse.path.plotLeft + (baseResponse.path.plotWidth * clamp(
                filterCutoffHzToNormalized(clamp(state.cutoffHz, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ)),
                0,
                1,
            )),
            y: baseResponse.path.plotBottom - (baseResponse.path.plotHeight * clamp(qScale.qToSurface(state.q), 0, 1)),
        });
        const toPolyline = (points: ReadonlyArray<{ x: number; y: number }>) => (
            points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")
        );

        const startResponse = createResponsePath({
            value: { ...safeValue, ...modulationTravel.start }, sampleRateHz: safeSampleRateHz, size,
            topPadding: plotTopPadding, bottomPadding: plotBottomPadding, horizontalPadding: plotPadding?.horizontal,
        }).path;
        const endResponse = createResponsePath({
            value: { ...safeValue, ...modulationTravel.end }, sampleRateHz: safeSampleRateHz, size,
            topPadding: plotTopPadding, bottomPadding: plotBottomPadding, horizontalPadding: plotPadding?.horizontal,
        }).path;
        const shadePath = startResponse.points.length > 0 && endResponse.points.length > 0
            ? `M ${toPolyline(startResponse.points)} L ${toPolyline([...endResponse.points].reverse())} Z`
            : "";

        const startPoint = pointFor(modulationTravel.start);
        const endPoint = pointFor(modulationTravel.end);
        const basePoint = { x: handlePoint.x, y: handlePoint.y };
        // Separate coincident grips so a zero-width range can still be edited.
        const endParked = Math.hypot(endPoint.x - basePoint.x, endPoint.y - basePoint.y) < 3;
        const startParked = modulationTravel.showStartHandle
            && Math.hypot(startPoint.x - basePoint.x, startPoint.y - basePoint.y) < 3;
        const presentedEnd = endParked ? { x: basePoint.x + 18, y: basePoint.y } : endPoint;
        const presentedStart = startParked ? { x: basePoint.x - 18, y: basePoint.y } : startPoint;
        const travelStart = modulationTravel.showStartHandle ? presentedStart : basePoint;
        const trueCenterPoint = {
            x: (travelStart.x + presentedEnd.x) / 2,
            y: (travelStart.y + presentedEnd.y) / 2,
        };
        const centerParked = [basePoint, presentedStart, presentedEnd].some(point =>
            Math.hypot(trueCenterPoint.x - point.x, trueCenterPoint.y - point.y) < 24);
        const centerPoint = centerParked ? {
            x: trueCenterPoint.x,
            y: trueCenterPoint.y - 40 >= baseResponse.path.plotTop + 14
                ? trueCenterPoint.y - 40 : trueCenterPoint.y + 40,
        } : trueCenterPoint;

        return {
            startCurvePath: startResponse.path,
            endCurvePath: endResponse.path,
            shadePath,
            startPoint: presentedStart,
            endPoint: presentedEnd,
            /** Unparked endpoint points: the rigid-translate anchor. */
            trueStartPoint: modulationTravel.showStartHandle ? startPoint : basePoint,
            trueEndPoint: endPoint,
            centerPoint,
            trueCenterPoint,
            centerParked,
            startParked,
            endParked,
        };
    }, [handlePoint, safeValue, safeSampleRateHz, plotTopPadding, plotBottomPadding, plotPadding?.horizontal, baseResponse.path, modulationTravel, qScale.qToSurface, size.height, size.width]);


    const rangeWidthOctaves = useMemo(() => {
        if (!safeRange) {
            return 0;
        }

        // A unipolar band is signed: it shows which way the cutoff moves from the base.
        return rangePolarity === "unipolar"
            ? Math.log2(safeRange.endCutoffHz / safeValue.cutoffHz)
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

    const stateAtPlotPoint = (x: number, y: number): FilterEndpoint => ({
        cutoffHz: cutoffForSurfaceX(clamp(x, baseResponse.path.plotLeft, baseResponse.path.plotRight), baseResponse.path),
        q: qForSurfaceY(clamp(y, baseResponse.path.plotTop, baseResponse.path.plotBottom), baseResponse.path, qScale),
    });
    const constrainEndpoint = (next: FilterEndpoint, current: FilterEndpoint): FilterEndpoint => ({
        cutoffHz: modulation?.axes === "q" ? current.cutoffHz : next.cutoffHz,
        q: modulation?.axes === "cutoff" ? current.q : next.q,
    });
    const setTravelEndpoint = (side: "start" | "end" | "base", next: FilterEndpoint) => {
        if (!modulationTravel || !modulationEditable) return;
        const key = side === "base" ? "start" : side;
        onModulationChange?.({ start: modulationTravel.start, end: modulationTravel.end,
            [key]: constrainEndpoint(next, side === "base" ? safeValue : modulationTravel[key]) }, side);
    };
    const translateTravel = (start: FilterEndpoint, end: FilterEndpoint) => {
        if (!modulationTravel || !modulationEditable) return;
        onModulationChange?.({ start: constrainEndpoint(start, modulationTravel.start),
            end: constrainEndpoint(end, modulationTravel.end) }, "center");
    };
    const applyDragPosition = (clientX: number, clientY: number) => {
        const surface = surfaceRef.current;
        const dragState = dragStateRef.current;

        if (!surface || !dragState) {
            return;
        }

        if (dragState.target === "modulation-center" && dragState.travelAnchor) {
            const { startPoint, endPoint } = dragState.travelAnchor;
            const plot = baseResponse.path;
            const dx = clamp(clientX - dragState.startClientX, plot.plotLeft - Math.min(startPoint.x, endPoint.x), plot.plotRight - Math.max(startPoint.x, endPoint.x));
            const dy = clamp(clientY - dragState.startClientY, plot.plotTop - Math.min(startPoint.y, endPoint.y), plot.plotBottom - Math.max(startPoint.y, endPoint.y));
            translateTravel(stateAtPlotPoint(startPoint.x + dx, startPoint.y + dy), stateAtPlotPoint(endPoint.x + dx, endPoint.y + dy));
            return;
        }
        const bounds = surface.getBoundingClientRect();
        const handleClientX = clientX - dragState.pointerOffsetX;
        const handleClientY = clientY - dragState.pointerOffsetY;
        const plotX = clamp(handleClientX - bounds.left, baseResponse.path.plotLeft, baseResponse.path.plotRight);
        const nextCutoffHz = cutoffForSurfaceX(plotX, baseResponse.path);

        if (dragState.target.startsWith("modulation-")) {
            setTravelEndpoint(dragState.target.slice(11) as "start" | "end" | "base", stateAtPlotPoint(plotX, handleClientY - bounds.top));
            return;
        }
        if (dragState.target === "value") {
            if (!isValueEditable(props)) return;
            const plotY = clamp(handleClientY - bounds.top, baseResponse.path.plotTop, baseResponse.path.plotBottom);
            onValueChange?.({
                ...safeValue,
                cutoffHz: nextCutoffHz,
                q: qForSurfaceY(plotY, baseResponse.path, qScale),
            });
            return;
        }

        if (!safeRange || !isRangeEditable(props)) {
            return;
        }

        onRangeChange?.(
            dragState.target === "range-start"
                ? { ...safeRange, startCutoffHz: nextCutoffHz }
                : { ...safeRange, endCutoffHz: nextCutoffHz },
        );
    };
    applyDragPositionRef.current = applyDragPosition;

    const handleValueKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
        const target = modulationTravel?.baseHandleMode === "start" ? "modulation-base" : "value";
        if (target === "value" ? !isValueEditable(props) : !modulationEditable) return;
        const edit = stepForKey(event);
        if (!edit) return;
        event.preventDefault();
        beginGesture(target, true);
        const next = { ...safeValue, ...endpointAfterKey(safeValue, edit, qScale) };
        if (target === "modulation-base") setTravelEndpoint("base", next);
        else onValueChange?.(next);
    };

    // A cutoff band grip edits one quantity, so every step key moves its cutoff.
    const handleRangeKeyDown = (
        target: "range-start" | "range-end",
        event: ReactKeyboardEvent<SVGCircleElement>,
    ) => {
        if (!safeRange || !isRangeEditable(props)) return;
        const edit = stepForKey(event);
        if (!edit) return;
        event.preventDefault();
        beginGesture(target, true);
        onRangeChange?.(target === "range-start"
            ? { ...safeRange, startCutoffHz: cutoffAfterKey(safeRange.startCutoffHz, edit) }
            : { ...safeRange, endCutoffHz: cutoffAfterKey(safeRange.endCutoffHz, edit) });
    };

    const handleKeyUp = (event: ReactKeyboardEvent<SVGSVGElement>) => {
        if (isStepKey(event.key) && openGestureRef.current?.keyboard) endGesture(false);
    };

    const endDrag = useCallback((cancelled: boolean, pointerId?: number) => {
        const dragState = dragStateRef.current;

        if (!dragState || (pointerId !== undefined && dragState.pointerId !== pointerId)) {
            return;
        }

        dragStateRef.current = null;
        const surface = surfaceRef.current;
        try {
            if (surface?.hasPointerCapture(dragState.pointerId)) {
                surface.releasePointerCapture(dragState.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }

        if (dragState.hasMoved || dragState.target.startsWith("modulation-")) endGesture(cancelled);

        setActiveDragTarget(null);
    }, [endGesture]);

    const updateDragFromPointer = useCallback((event: Pick<
        PointerEvent,
        "pointerId" | "pointerType" | "buttons" | "clientX" | "clientY"
    >) => {
        const dragState = dragStateRef.current;

        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (event.pointerType === "mouse" && event.buttons === 0) {
            endDrag(false, event.pointerId);
            return;
        }

        const deltaX = event.clientX - dragState.startClientX;
        const deltaY = event.clientY - dragState.startClientY;
        if (!dragState.hasMoved && Math.abs(deltaX) < EDITOR_DRAG_START_THRESHOLD_PX && Math.abs(deltaY) < EDITOR_DRAG_START_THRESHOLD_PX) {
            return;
        }

        if (!dragState.hasMoved) {
            dragState.hasMoved = true;
            if (!dragState.target.startsWith("modulation-")) beginGesture(dragState.target, false);
        }

        applyDragPositionRef.current(event.clientX, event.clientY);
    }, [beginGesture, endDrag]);

    useEffect(() => {
        const handleFallbackPointerMove = (event: PointerEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }
            const surface = surfaceRef.current;
            if (event.target instanceof Node && surface?.contains(event.target)) {
                return;
            }
            updateDragFromPointer(event);
        };
        const handlePointerEnd = (event: PointerEvent) => endDrag(event.type === "pointercancel", event.pointerId);
        const handleBlur = () => endDrag(true);
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                endDrag(true);
            }
        };

        window.addEventListener("pointermove", handleFallbackPointerMove, true);
        window.addEventListener("pointerup", handlePointerEnd, true);
        window.addEventListener("pointercancel", handlePointerEnd, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointermove", handleFallbackPointerMove, true);
            window.removeEventListener("pointerup", handlePointerEnd, true);
            window.removeEventListener("pointercancel", handlePointerEnd, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            endDrag(true);
            endGesture(true);
        };
    }, [endDrag, endGesture, updateDragFromPointer]);

    const beginDrag = (
        target: FilterEditTarget,
        event: ReactPointerEvent<SVGCircleElement>,
        origin: { x: number; y: number },
    ) => {
        event.preventDefault();
        endDrag(true);
        try {
            surfaceRef.current?.setPointerCapture(event.pointerId);
        } catch {
            // Window-level termination still owns unsupported or synthetic pointers.
        }
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
        if (target === "modulation-center" && travelGeometry) {
            dragStateRef.current.travelAnchor = { startPoint: travelGeometry.trueStartPoint, endPoint: travelGeometry.trueEndPoint };
        }
        // Endpoint consumers snapshot the fixed endpoint before any write.
        if (target.startsWith("modulation-")) beginGesture(target, false);
        setActiveDragTarget(target);
    };
    const valueEditable = isValueEditable(props);
    const rangeEditable = isRangeEditable(props);
    useEffect(() => {
        const target = dragStateRef.current?.target ?? openGestureRef.current?.target;
        if (!target) return;
        const editable = target === "value" ? valueEditable
            : target.startsWith("modulation-") ? modulationEditable && Boolean(modulation)
            : rangeEditable;
        if (editable) return;
        endDrag(true);
        endGesture(true);
    }, [valueEditable, rangeEditable, modulationEditable, Boolean(modulation), endDrag, endGesture]);
    const beginTravelEndpointDrag = (side: "start" | "end", x: number, y: number) =>
        (event: ReactPointerEvent<SVGCircleElement>) => {
            if (modulationEditable) beginDrag(`modulation-${side}`, event, { x, y });
        };
    const handleTravelKeyDown = (side: "start" | "end", event: ReactKeyboardEvent<SVGCircleElement>) => {
        if (!modulationTravel || !modulationEditable) return;
        const edit = stepForKey(event);
        if (!edit) return;
        event.preventDefault();
        beginGesture(`modulation-${side}`, true);
        setTravelEndpoint(side, endpointAfterKey(modulationTravel[side], edit, qScale));
    };
    // The center grip moves both endpoints by the same screen distance as a drag would.
    const handleCenterKeyDown = (event: ReactKeyboardEvent<SVGCircleElement>) => {
        if (!modulationEditable || !travelGeometry) return;
        const edit = stepForKey(event);
        if (!edit) return;
        event.preventDefault();
        const plot = baseResponse.path;
        const dx = edit.kind === "min" ? -Infinity : edit.kind === "max" ? Infinity
            : edit.axis === "horizontal" ? edit.steps * KEYBOARD_CUTOFF_STEP * plot.plotWidth : 0;
        const dy = edit.kind === "step" && edit.axis === "vertical" ? -edit.steps * KEYBOARD_Q_STEP * plot.plotHeight : 0;
        const a = travelGeometry.trueStartPoint, b = travelGeometry.trueEndPoint;
        const x = clamp(dx, plot.plotLeft - Math.min(a.x, b.x), plot.plotRight - Math.max(a.x, b.x));
        const y = clamp(dy, plot.plotTop - Math.min(a.y, b.y), plot.plotBottom - Math.max(a.y, b.y));
        beginGesture("modulation-center", true);
        translateTravel(stateAtPlotPoint(a.x + x, a.y + y), stateAtPlotPoint(b.x + x, b.y + y));
    };
    const valueTabIndex = disabled ? -1 : 0;

    return (
        <div
            {...rootProps}
            ref={ref}
            className={joinClasses("filter-range-editor", className)}
            data-active-drag-target={activeDragTarget ?? undefined}
            data-filter-mode={safeValue.mode}
            data-range-polarity={rangePolarity}
            data-role="filter-range-editor"
            data-show-chips={showHandleChips ? "true" : "false"}
            data-has-range={hasRangeView ? "true" : "false"}
            data-disabled={disabled || undefined}
            data-readonly={readOnly || undefined}
            data-slot="filter-editor"
        >
            <div ref={viewportRef} className="filter-range-editor__viewport" data-role="filter-range-editor-viewport">
                <canvas ref={spectrumCanvasRef} data-role="filter-spectrum-canvas" className="filter-editor__spectrum" />
                {showModeControls && modeOptions.length > 0 ? (
                    <button
                        aria-label={modeCycleAriaLabel}
                        className="filter-range-editor__mode-cycle"
                        data-mode-label={modeLabel}
                        data-role="filter-range-mode-cycle-button"
                        title={`Filter mode: ${modeLabel}`}
                        type="button"
                        disabled={!isValueEditable(props)}
                        onClick={() => {
                            beginGesture("value", false);
                            onValueChange?.({ ...safeValue, mode: getNextFilterRangeMode(safeValue.mode, modeOptions) });
                            endGesture(false);
                        }}
                    >
                        <FilterRangeModeGlyph mode={safeValue.mode} />
                    </button>
                ) : null}
                <EditorCurveSurface
                    ref={surfaceRef}
                    aria-label={ariaLabel}
                    className="filter-range-editor__surface"
                    data-role="filter-range-editor-surface"
                    heightPx={size.height}
                    role="group"
                    style={{
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                    }}
                    widthPx={size.width}
                    onPointerMove={(event) => updateDragFromPointer(event.nativeEvent)}
                    onPointerUp={(event) => endDrag(false, event.pointerId)}
                    onPointerCancel={(event) => endDrag(true, event.pointerId)}
                    onLostPointerCapture={(event) => endDrag(true, event.pointerId)}
                    onKeyUp={handleKeyUp}
                    onBlur={() => { if (openGestureRef.current?.keyboard) endGesture(true); }}
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
                    <EditorCurveAxis
                        className="filter-range-editor__axis"
                        data-role="filter-range-editor-axis"
                        x1={baseResponse.path.plotLeft}
                        x2={baseResponse.path.plotRight}
                        y1={baseResponse.path.plotBottom}
                        y2={baseResponse.path.plotBottom}
                    />
                    <EditorCurveAxis
                        className="filter-range-editor__axis"
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
                                        tabIndex={valueTabIndex}
                                        aria-disabled={disabled || undefined}
                                        aria-readonly={!isRangeEditable(props) && !disabled || undefined}
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
                                tabIndex={valueTabIndex}
                                aria-disabled={disabled || undefined}
                                aria-readonly={!isRangeEditable(props) && !disabled || undefined}
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
                        tabIndex={valueTabIndex}
                        aria-disabled={disabled || undefined}
                        aria-readonly={readOnly || !onValueChange || undefined}
                        cx={handlePoint.x}
                        cy={handlePoint.y}
                        onKeyDown={handleValueKeyDown}
                        onPointerDown={(event) => {
                            const target = modulationTravel?.baseHandleMode === "start" ? "modulation-base" : "value";
                            if (target === "value" ? isValueEditable(props) : modulationEditable) beginDrag(target, event, handlePoint);
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
                    {modulationTravel && travelGeometry ? (
                        <g
                            data-role="filter-travel-overlay"
                        >
                            {travelGeometry.shadePath ? (
                                <path
                                    data-role="filter-travel-shade"
                                    d={travelGeometry.shadePath}
                                    fill={modulationTravel.accent}
                                    fillOpacity="0.14"
                                    stroke="none"
                                    pointerEvents="none"
                                />
                            ) : null}
                            <path
                                data-role="filter-travel-start-curve"
                                d={travelGeometry.startCurvePath}
                                fill="none"
                                stroke={modulationTravel.accent}
                                strokeOpacity="0.5"
                                strokeWidth="1.6"
                                pointerEvents="none"
                            />
                            <path
                                data-role="filter-travel-end-curve"
                                d={travelGeometry.endCurvePath}
                                fill="none"
                                stroke={modulationTravel.accent}
                                strokeOpacity="0.9"
                                strokeWidth="2"
                                pointerEvents="none"
                            />
                            {modulationTravel.centerHandle && !travelGeometry.endParked ? (
                                <g data-role="filter-travel-center">
                                    {travelGeometry.centerParked ? <line
                                        x1={travelGeometry.trueCenterPoint.x} y1={travelGeometry.trueCenterPoint.y}
                                        x2={travelGeometry.centerPoint.x} y2={travelGeometry.centerPoint.y}
                                        stroke={modulationTravel.accent} strokeOpacity=".5" strokeDasharray="2 3" pointerEvents="none" /> : null}
                                    <rect
                                        data-role="filter-travel-handle-center"
                                        x={travelGeometry.centerPoint.x - 5}
                                        y={travelGeometry.centerPoint.y - 5}
                                        width="10"
                                        height="10"
                                        rx="2"
                                        transform={`rotate(45 ${travelGeometry.centerPoint.x} ${travelGeometry.centerPoint.y})`}
                                        fill="var(--filter-modulation-handle-fill, var(--editor-surface-bg, #e4ded3))"
                                        stroke={modulationTravel.accent}
                                        strokeWidth="1.6"
                                        pointerEvents="none"
                                    />
                                    <circle
                                        data-role="filter-travel-hit-target-center"
                                        role="slider"
                                        aria-label="Translate filter modulation travel"
                                        aria-valuemin={FILTER_CUTOFF_MIN_HZ}
                                        aria-valuemax={FILTER_CUTOFF_MAX_HZ}
                                        aria-valuenow={Math.round(safeValue.cutoffHz)}
                                        tabIndex={valueTabIndex}
                                        aria-disabled={disabled || undefined}
                                        aria-readonly={readOnly || !onModulationChange || undefined}
                                        cx={travelGeometry.centerPoint.x}
                                        cy={travelGeometry.centerPoint.y}
                                        r="14"
                                        fill="transparent"
                                        className="filter-range-editor__range-hit-target"
                                        onPointerDown={(event) => {
                                            if (modulationEditable) beginDrag("modulation-center", event, travelGeometry.centerPoint);
                                        }}
                                        onKeyDown={handleCenterKeyDown}
                                    />
                                </g>
                            ) : null}
                            {(travelGeometry.endParked || travelGeometry.startParked) ? (
                                <g data-role="filter-travel-parked-leaders" pointerEvents="none">
                                    {travelGeometry.endParked ? (
                                        <line
                                            x1={handlePoint.x}
                                            y1={handlePoint.y}
                                            x2={travelGeometry.endPoint.x}
                                            y2={travelGeometry.endPoint.y}
                                            stroke={modulationTravel.accent}
                                            strokeOpacity="0.5"
                                            strokeWidth="1.2"
                                            strokeDasharray="2 3"
                                        />
                                    ) : null}
                                    {travelGeometry.startParked ? (
                                        <line
                                            x1={handlePoint.x}
                                            y1={handlePoint.y}
                                            x2={travelGeometry.startPoint.x}
                                            y2={travelGeometry.startPoint.y}
                                            stroke={modulationTravel.accent}
                                            strokeOpacity="0.5"
                                            strokeWidth="1.2"
                                            strokeDasharray="2 3"
                                        />
                                    ) : null}
                                </g>
                            ) : null}
                            {([
                                ...(modulationTravel.showStartHandle
                                    ? [["start", travelGeometry.startPoint, modulationTravel.start, travelGeometry.startParked] as const]
                                    : []),
                                ["end", travelGeometry.endPoint, modulationTravel.end, travelGeometry.endParked] as const,
                            ]).map(([side, point, state, parked]) => (
                                <g key={`filter-travel-${side}`} data-parked={parked}>
                                    <circle
                                        data-role={`filter-travel-handle-${side}`}
                                        data-parked={parked}
                                        cx={point.x}
                                        cy={point.y}
                                        r="6.5"
                                        fill={side === "end" ? modulationTravel.accent : "var(--filter-modulation-handle-fill, var(--editor-surface-bg, #e4ded3))"}
                                        fillOpacity={parked ? 0.35 : side === "end" ? 1 : 0.9}
                                        stroke={side === "end" ? "rgb(255 255 255 / 0.5)" : modulationTravel.accent}
                                        strokeWidth={side === "end" ? 1.4 : 2}
                                        strokeDasharray={parked ? "2 3" : undefined}
                                        pointerEvents="none"
                                    />
                                    <circle
                                        data-role={`filter-travel-hit-target-${side}`}
                                        role="slider"
                                        aria-label={`Filter modulation travel ${side}`}
                                        aria-valuemin={FILTER_CUTOFF_MIN_HZ}
                                        aria-valuemax={FILTER_CUTOFF_MAX_HZ}
                                        aria-valuenow={Math.round(state.cutoffHz)}
                                        tabIndex={valueTabIndex}
                                        aria-disabled={disabled || undefined}
                                        aria-readonly={readOnly || !onModulationChange || undefined}
                                        cx={point.x}
                                        cy={point.y}
                                        r={parked ? 12 : 16}
                                        fill="transparent"
                                        className="filter-range-editor__range-hit-target"
                                        onPointerDown={beginTravelEndpointDrag(side, point.x, point.y)}
                                        onKeyDown={(event) => handleTravelKeyDown(side, event)}
                                    />
                                </g>
                            ))}
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
});
