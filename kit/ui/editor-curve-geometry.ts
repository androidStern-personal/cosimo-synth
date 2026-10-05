// Layout for SVG curve editors such as the filter editor, in CSS pixels. Geometry
// code positions plots and hit targets with these, so they live here rather than in CSS.

export const EDITOR_PLOT_TOP_PADDING_PX = 20;
export const EDITOR_PLOT_BOTTOM_PADDING_PX = 40;
/** Visible radius of the primary value handle. */
export const EDITOR_VALUE_HANDLE_RADIUS_PX = 9.5;
/** Visible radius of the halo behind the primary handle. */
export const EDITOR_VALUE_HANDLE_HALO_RADIUS_PX = 14;
/** Visible radius of range endpoint handles. */
export const EDITOR_RANGE_HANDLE_RADIUS_PX = 8.5;
/** Invisible hit-target radius, sized for a comfortable touch target. */
export const EDITOR_HIT_RADIUS_PX = 22;
/** Pointer travel before a press on a handle becomes a drag. */
export const EDITOR_DRAG_START_THRESHOLD_PX = 1.5;

const PLOT_GUTTER_RATIO = 0.05;
const PLOT_GUTTER_MIN_PX = 10;

/** Left and right plot gutter for a surface width; wide enough that axis labels never collide. */
export function editorPlotGutter(surfaceWidthPx: number): number {
    return Math.max(PLOT_GUTTER_MIN_PX, surfaceWidthPx * PLOT_GUTTER_RATIO);
}

export type EditorCurvePoint = {
    x: number;
    y: number;
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

function finiteNumber(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
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

export function polylineToSvgPath(
    polyline: ReadonlyArray<EditorCurvePoint>,
    precision = 3,
): string {
    const digits = Math.max(0, Math.round(precision));
    return polyline.map((point, pointIndex) => (
        `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(digits)} ${point.y.toFixed(digits)}`
    )).join(" ");
}
