import { polylineToSvgPath, type EditorCurvePlotRect, type EditorCurvePoint } from "../../kit/ui/editor-curve-geometry";

export * from "../../kit/ui/editor-curve-geometry";

export type EditorCurveSamplePoint = EditorCurvePoint & {
    t?: number;
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
