import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    editorPlotGutter,
} from "./editor-tokens";

export type EditorCurvePoint = {
    x: number;
    y: number;
};

export type EditorCurveSamplePoint = EditorCurvePoint & {
    t?: number;
};

export type EditorCurvePlotRect = {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
};

export type EditorCurvePlotRectOptions = {
    horizontalPaddingPx?: number;
    topPaddingPx?: number;
    bottomPaddingPx?: number;
    topReservePx?: number;
    bottomReservePx?: number;
};

export type AdaptiveEditorCurveOptions = {
    evaluate: (t: number) => EditorCurvePoint;
    plot: EditorCurvePlotRect;
    breakpoints?: number[];
    tolerancePx?: number;
    maxDepth?: number;
};

const DEFAULT_ADAPTIVE_TOLERANCE_PX = 0.5;
const DEFAULT_ADAPTIVE_MAX_DEPTH = 12;

function finiteNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function formatCoordinate(value: number, precision: number): string {
    return value.toFixed(Math.max(0, Math.round(precision)));
}

export function createEditorCurvePlotRect(
    width: number,
    height: number,
    {
        horizontalPaddingPx = editorPlotGutter(width),
        topPaddingPx = EDITOR_PLOT_TOP_PADDING_PX,
        bottomPaddingPx = EDITOR_PLOT_BOTTOM_PADDING_PX,
        topReservePx = 0,
        bottomReservePx = 0,
    }: EditorCurvePlotRectOptions = {},
): EditorCurvePlotRect {
    const safeWidth = Math.max(1, finiteNumber(width, 1));
    const safeHeight = Math.max(1, finiteNumber(height, 1));
    const safeHorizontalPadding = clamp(finiteNumber(horizontalPaddingPx, 0), 0, safeWidth * 0.5);
    const safeTopPadding = Math.max(0, finiteNumber(topPaddingPx, 0));
    const safeBottomPadding = Math.max(0, finiteNumber(bottomPaddingPx, 0));
    const safeTopReserve = Math.max(0, finiteNumber(topReservePx, 0));
    const safeBottomReserve = Math.max(0, finiteNumber(bottomReservePx, 0));
    const plotLeft = safeHorizontalPadding;
    const plotRight = Math.max(plotLeft + 1, safeWidth - safeHorizontalPadding);
    const plotTop = safeTopPadding + safeTopReserve;
    const plotBottom = Math.max(plotTop + 1, safeHeight - safeBottomPadding - safeBottomReserve);

    return {
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        plotWidth: Math.max(1, plotRight - plotLeft),
        plotHeight: Math.max(1, plotBottom - plotTop),
    };
}

export function normalizedCurvePointToPlotPoint(
    point: EditorCurvePoint,
    plot: EditorCurvePlotRect,
): EditorCurvePoint {
    const normalizedX = clamp(finiteNumber(point.x, 0), 0, 1);
    const normalizedY = clamp(finiteNumber(point.y, 0), 0, 1);

    return {
        x: plot.plotLeft + (plot.plotWidth * normalizedX),
        y: plot.plotBottom - (plot.plotHeight * normalizedY),
    };
}

export function plotPointToNormalizedCurvePoint(
    point: EditorCurvePoint,
    plot: EditorCurvePlotRect,
): EditorCurvePoint {
    return {
        x: clamp((finiteNumber(point.x, plot.plotLeft) - plot.plotLeft) / plot.plotWidth, 0, 1),
        y: clamp(1 - ((finiteNumber(point.y, plot.plotBottom) - plot.plotTop) / plot.plotHeight), 0, 1),
    };
}

export function polylineToSvgPath(
    polyline: Array<EditorCurvePoint>,
    precision = 3,
): string {
    if (polyline.length === 0) {
        return "";
    }

    return polyline.map((point, pointIndex) => (
        `${pointIndex === 0 ? "M" : "L"} ${formatCoordinate(point.x, precision)} ${formatCoordinate(point.y, precision)}`
    )).join(" ");
}

export function editorCurveFillPathToBaseline(
    polyline: Array<EditorCurvePoint>,
    plot: EditorCurvePlotRect,
    precision = 3,
    baselineY = plot.plotBottom,
): string {
    if (polyline.length === 0) {
        return "";
    }

    const first = polyline[0];
    const last = polyline[polyline.length - 1];
    return [
        polylineToSvgPath(polyline, precision),
        `L ${formatCoordinate(last.x, precision)} ${formatCoordinate(baselineY, precision)}`,
        `L ${formatCoordinate(first.x, precision)} ${formatCoordinate(baselineY, precision)}`,
        "Z",
    ].join(" ");
}

export function distanceSquaredToLineSegment(
    targetX: number,
    targetY: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): number {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const segmentLengthSquared = (deltaX * deltaX) + (deltaY * deltaY);

    if (segmentLengthSquared <= 1e-12) {
        const pointDeltaX = targetX - fromX;
        const pointDeltaY = targetY - fromY;
        return (pointDeltaX * pointDeltaX) + (pointDeltaY * pointDeltaY);
    }

    const projection = clamp(
        (((targetX - fromX) * deltaX) + ((targetY - fromY) * deltaY)) / segmentLengthSquared,
        0,
        1,
    );
    const closestX = fromX + (deltaX * projection);
    const closestY = fromY + (deltaY * projection);
    const pointDeltaX = targetX - closestX;
    const pointDeltaY = targetY - closestY;
    return (pointDeltaX * pointDeltaX) + (pointDeltaY * pointDeltaY);
}

export function adaptiveSampleEditorCurve({
    breakpoints = [],
    evaluate,
    plot,
    tolerancePx = DEFAULT_ADAPTIVE_TOLERANCE_PX,
    maxDepth = DEFAULT_ADAPTIVE_MAX_DEPTH,
}: AdaptiveEditorCurveOptions): EditorCurveSamplePoint[] {
    const safeToleranceSquared = Math.max(0, finiteNumber(tolerancePx, DEFAULT_ADAPTIVE_TOLERANCE_PX));
    const toleranceSquared = safeToleranceSquared * safeToleranceSquared;
    const safeMaxDepth = Math.max(0, Math.round(finiteNumber(maxDepth, DEFAULT_ADAPTIVE_MAX_DEPTH)));

    const sampleAt = (t: number): EditorCurveSamplePoint => ({
        ...normalizedCurvePointToPlotPoint(evaluate(clamp(t, 0, 1)), plot),
        t: clamp(t, 0, 1),
    });

    const boundaries = [
        0,
        ...breakpoints
            .map((breakpoint) => clamp(finiteNumber(breakpoint, 0), 0, 1))
            .filter((breakpoint) => breakpoint > 0 && breakpoint < 1)
            .sort((left, right) => left - right),
        1,
    ].filter((breakpoint, index, values) => (
        index === 0 || Math.abs(breakpoint - values[index - 1]) > 1e-9
    ));
    const start = sampleAt(boundaries[0]);
    const polyline: EditorCurveSamplePoint[] = [start];

    const appendAdaptiveSamples = (
        startT: number,
        endT: number,
        startPoint: EditorCurveSamplePoint,
        endPoint: EditorCurveSamplePoint,
        depth: number,
    ) => {
        if (depth >= safeMaxDepth) {
            polyline.push(endPoint);
            return;
        }

        const midpointT = startT + ((endT - startT) * 0.5);
        const midpoint = sampleAt(midpointT);
        const errorSquared = distanceSquaredToLineSegment(
            midpoint.x,
            midpoint.y,
            startPoint.x,
            startPoint.y,
            endPoint.x,
            endPoint.y,
        );

        if (errorSquared <= toleranceSquared) {
            polyline.push(endPoint);
            return;
        }

        appendAdaptiveSamples(startT, midpointT, startPoint, midpoint, depth + 1);
        appendAdaptiveSamples(midpointT, endT, midpoint, endPoint, depth + 1);
    };

    for (let index = 0; index + 1 < boundaries.length; index += 1) {
        const startT = boundaries[index];
        const endT = boundaries[index + 1];
        const startPoint = polyline[polyline.length - 1];
        const endPoint = sampleAt(endT);

        appendAdaptiveSamples(startT, endT, startPoint, endPoint, 0);
    }

    return polyline;
}
