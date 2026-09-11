import { createMsegEditorMetrics, sampleMsegEditorPolyline, sampleMsegSegmentEditorPolyline, MSEG_EDITOR_HORIZONTAL_PADDING_PX, MSEG_EDITOR_VERTICAL_PADDING_PX, type MsegSurfaceOrientation } from "./mseg";

/** Build the curve and baseline fill in the same coordinates used by hit testing. */
export function buildMsegSurfacePaths(
    points: Array<{ x: number; y: number; curvePower: number }>,
    width: number,
    height: number,
    options: {
        orientation?: MsegSurfaceOrientation;
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    const metrics = createMsegEditorMetrics(width, height, {
        pointRadius: options.pointRadius,
        horizontalPadding: options.horizontalPadding ?? MSEG_EDITOR_HORIZONTAL_PADDING_PX,
        verticalPadding: options.verticalPadding ?? MSEG_EDITOR_VERTICAL_PADDING_PX,
    });
    const curvePath = polylineToSvgPath(sampleMsegEditorPolyline(
        { points },
        width,
        height,
        {
            orientation: options.orientation,
            pointRadius: options.pointRadius,
            horizontalPadding: options.horizontalPadding,
            verticalPadding: options.verticalPadding,
        },
    ));
    const fillPath = options.orientation === "vertical"
        ? `${curvePath} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
            `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotTop.toFixed(3)} Z`
        : `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
            `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`;

    return { curvePath, fillPath, metrics };
}

function polylineToSvgPath(polyline: Array<{ x: number; y: number }>) {
    if (polyline.length === 0) {
        return "";
    }

    return polyline.map((point, pointIndex) => (
        `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`
    )).join(" ");
}

/** Trace an emphasized editable segment with the curve renderer tolerance. */
export function buildMsegSegmentPath(
    points: Array<{ x: number; y: number; curvePower: number }>,
    segmentIndex: number,
    width: number,
    height: number,
    options: {
        orientation?: MsegSurfaceOrientation;
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    return polylineToSvgPath(sampleMsegSegmentEditorPolyline(
        { points },
        segmentIndex,
        width,
        height,
        options,
    ));
}

