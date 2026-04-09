import { useEffect, useMemo, useState } from "react";

import {
    advanceDistortionDisplayState,
    buildDistortionHistoryBins,
    buildDistortionSamplePoints,
    buildDistortionTransferOccupancy,
    sampleDistortionCurve,
    type DistortionDisplayState,
    type DistortionHistoryFrame,
    type DistortionScopeFrame,
    summarizeDistortionHistoryFrame,
} from "./distortion-visualization";

const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 532;
const TRANSFER_PLOT = {
    left: 34,
    top: 30,
    width: 572,
    height: 248,
};
const HISTORY_PLOT = {
    left: 34,
    top: 322,
    width: 572,
    height: 164,
};
const HISTORY_BAR_GAP = 0.6;

type PlotRect = typeof TRANSFER_PLOT;

const COMPACT_VIEWBOX_WIDTH = 600;
const COMPACT_VIEWBOX_HEIGHT = 340;
const COMPACT_PLOT = {
    left: 12,
    top: 8,
    width: 576,
    height: 300,
};

export type DistortionVisualizerProps = {
    compact?: boolean;
    knee: number;
    transferFrame: DistortionScopeFrame | null;
    historyFrame: DistortionHistoryFrame | null;
    className?: string;
};

function joinClasses(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function mapPlotX(sampleValue: number, plot: PlotRect, range: number) {
    const normalized = clamp((sampleValue + range) / (Math.max(range, 1e-6) * 2), 0, 1);
    return plot.left + (plot.width * normalized);
}

function mapPlotY(sampleValue: number, plot: PlotRect, range: number) {
    const normalized = clamp((range - sampleValue) / (Math.max(range, 1e-6) * 2), 0, 1);
    return plot.top + (plot.height * normalized);
}

function mapHistoryX(sampleIndex: number, sampleCount: number) {
    const normalized = sampleCount <= 1 ? 0 : sampleIndex / (sampleCount - 1);
    return HISTORY_PLOT.left + (HISTORY_PLOT.width * normalized);
}

function buildPolylinePath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) {
        return "";
    }

    return points.map((point, index) => (
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )).join(" ");
}

function buildFilledBridgePath(
    upper: Array<{ x: number; y: number }>,
    lower: Array<{ x: number; y: number }>,
) {
    if (upper.length === 0 || lower.length === 0 || upper.length !== lower.length) {
        return "";
    }

    const head = buildPolylinePath(upper);
    const tail = lower
        .slice()
        .reverse()
        .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");

    return `${head} ${tail} Z`;
}

function normalizeVector(dx: number, dy: number) {
    const magnitude = Math.hypot(dx, dy);

    if (magnitude <= 1e-6) {
        return {
            x: 0,
            y: -1,
        };
    }

    return {
        x: dx / magnitude,
        y: dy / magnitude,
    };
}

function buildRibbonPath(points: Array<{ x: number; y: number; width: number }>) {
    if (points.length < 2) {
        return "";
    }

    const upper: Array<{ x: number; y: number }> = [];
    const lower: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < points.length; index += 1) {
        const currentPoint = points[index];

        if (!currentPoint) {
            continue;
        }

        const previousPoint = points[Math.max(0, index - 1)] ?? currentPoint;
        const nextPoint = points[Math.min(points.length - 1, index + 1)] ?? currentPoint;
        const tangent = normalizeVector(
            nextPoint.x - previousPoint.x,
            nextPoint.y - previousPoint.y,
        );
        const normal = {
            x: -tangent.y,
            y: tangent.x,
        };
        const halfWidth = Math.max(0, currentPoint.width) * 0.5;

        upper.push({
            x: currentPoint.x + (normal.x * halfWidth),
            y: currentPoint.y + (normal.y * halfWidth),
        });
        lower.push({
            x: currentPoint.x - (normal.x * halfWidth),
            y: currentPoint.y - (normal.y * halfWidth),
        });
    }

    return buildFilledBridgePath(upper, lower);
}

function buildAxisLabelX(sampleValue: number, plot: PlotRect, range: number) {
    return mapPlotX(sampleValue, plot, range);
}

function buildAxisLabelY(sampleValue: number, plot: PlotRect, range: number) {
    return mapPlotY(sampleValue, plot, range);
}

export function DistortionVisualizer({
    compact,
    knee,
    transferFrame,
    historyFrame,
    className,
}: DistortionVisualizerProps) {
    const [displayState, setDisplayState] = useState<DistortionDisplayState | null>(null);

    useEffect(() => {
        if (!transferFrame) {
            return;
        }

        setDisplayState((previousState) => (
            advanceDistortionDisplayState(previousState, transferFrame, performance.now())
        ));
    }, [transferFrame]);

    const activeTransferFrame = displayState?.frame ?? transferFrame;
    const displayRange = displayState?.displayRange ?? 2.0;
    const samplePoints = useMemo(
        () => activeTransferFrame ? buildDistortionSamplePoints(activeTransferFrame) : [],
        [activeTransferFrame],
    );
    const historyBins = useMemo(
        () => historyFrame ? buildDistortionHistoryBins(historyFrame) : [],
        [historyFrame],
    );
    const historySummary = useMemo(
        () => historyFrame ? summarizeDistortionHistoryFrame(historyFrame) : { inputPeak: 0, outputPeak: 0, removedPeak: 0 },
        [historyFrame],
    );
    const transferCurve = useMemo(
        () => sampleDistortionCurve({ knee, inputRange: displayRange }),
        [displayRange, knee],
    );
    const transferOccupancy = useMemo(() => buildDistortionTransferOccupancy({
        samplePoints,
        knee,
        inputRange: displayRange,
    }), [displayRange, knee, samplePoints]);

    const transferPlotRect = compact ? COMPACT_PLOT : TRANSFER_PLOT;
    const historyPlotRect = compact ? COMPACT_PLOT : HISTORY_PLOT;

    const transferCurvePath = useMemo(() => buildPolylinePath(
        transferCurve.map((point) => ({
            x: mapPlotX(point.input, transferPlotRect, displayRange),
            y: mapPlotY(point.output, transferPlotRect, displayRange),
        })),
    ), [displayRange, transferCurve, transferPlotRect]);

    const transferOccupancyPaths = useMemo(() => transferOccupancy.segments
        .map((segment) => {
            const mappedPoints = segment.map((point) => ({
                x: mapPlotX(point.input, transferPlotRect, displayRange),
                y: mapPlotY(point.output, transferPlotRect, displayRange),
                density: point.density,
                removed: point.removed,
                clipped: point.clipped,
            }));

            const occupancyPath = buildRibbonPath(mappedPoints.map((point) => ({
                x: point.x,
                y: point.y,
                width: 8 + (point.density * 18),
            })));
            const clippedPath = buildRibbonPath(mappedPoints.map((point) => ({
                x: point.x,
                y: point.y,
                width: Math.max(0, (point.density * point.removed * Math.max(0.25, point.clipped)) * 28),
            })));
            const peakDensity = mappedPoints.reduce((peak, point) => Math.max(peak, point.density), 0);
            const peakRemoved = mappedPoints.reduce((peak, point) => Math.max(peak, point.removed), 0);
            const peakClipped = mappedPoints.reduce((peak, point) => Math.max(peak, point.clipped), 0);

            return {
                occupancyPath,
                clippedPath,
                occupancyOpacity: clamp(0.14 + (peakDensity * 0.34), 0.14, 0.48),
                clippedOpacity: clamp((peakRemoved * 0.62) + (peakClipped * 0.24), 0, 0.72),
            };
        })
        .filter((segment) => segment.occupancyPath), [displayRange, transferOccupancy, transferPlotRect]);

    const historyColumns = useMemo(() => {
        const plotBinCount = Math.max(1, historyBins.length);
        const columnWidth = historyPlotRect.width / plotBinCount;

        return historyBins.map((bin, index) => {
            const left = historyPlotRect.left + (index * columnWidth) + (HISTORY_BAR_GAP * 0.5);
            const width = Math.max(1, columnWidth - HISTORY_BAR_GAP);
            const outputTop = mapPlotY(bin.outputPeak, historyPlotRect, displayRange);
            const outputBottom = mapPlotY(-bin.outputPeak, historyPlotRect, displayRange);
            const inputTop = mapPlotY(bin.inputPeak, historyPlotRect, displayRange);
            const inputBottom = mapPlotY(-bin.inputPeak, historyPlotRect, displayRange);
            const hasRemoval = bin.valid && (bin.inputPeak > (bin.outputPeak + 1e-4));
            const outputHeight = Math.max(0, outputBottom - outputTop);
            const removedTopHeight = Math.max(0, outputTop - inputTop);
            const removedBottomHeight = Math.max(0, inputBottom - outputBottom);

            return {
                valid: bin.valid,
                clipped: bin.clipped,
                output: {
                    x: left,
                    y: outputTop,
                    width,
                    height: outputHeight,
                },
                removedTop: hasRemoval
                    ? {
                        x: left,
                        y: inputTop,
                        width,
                        height: removedTopHeight,
                    }
                    : null,
                removedBottom: hasRemoval
                    ? {
                        x: left,
                        y: outputBottom,
                        width,
                        height: removedBottomHeight,
                    }
                    : null,
            };
        });
    }, [displayRange, historyBins, historyPlotRect]);

    const overshoot = Math.max(0, (activeTransferFrame?.inputPeak ?? 0) - 1);
    const headroom = Math.max(0, 1 - (activeTransferFrame?.inputPeak ?? 0));
    const clippedSampleCount = samplePoints.reduce((count, point) => count + (point.clipped ? 1 : 0), 0);
    const clippedHistoryBinCount = historyBins.reduce((count, bin) => count + (bin.clipped ? 1 : 0), 0);
    const debugState = useMemo(() => ({
        hasTransferScope: Boolean(activeTransferFrame),
        hasHistory: Boolean(historyFrame),
        displayRange,
        sampleCount: samplePoints.length,
        clippedSampleCount,
        inputPeak: activeTransferFrame?.inputPeak ?? 0,
        outputPeak: activeTransferFrame?.outputPeak ?? 0,
        removedPeak: activeTransferFrame?.removedPeak ?? 0,
        overshoot,
        headroom,
        transfer: {
            samplePointCount: samplePoints.length,
            occupancySegmentCount: transferOccupancyPaths.length,
            clippedOccupancySegmentCount: transferOccupancyPaths.filter((segment) => segment.clippedPath).length,
            peakDensity: transferOccupancy.peakDensity,
            peakRemoved: transferOccupancy.peakRemoved,
            leftOverflowCount: transferOccupancy.leftOverflowCount,
            rightOverflowCount: transferOccupancy.rightOverflowCount,
            plot: TRANSFER_PLOT,
        },
        history: {
            binCount: historyBins.length,
            validBinCount: historyFrame?.validBinCount ?? 0,
            clippedBinCount: clippedHistoryBinCount,
            horizonMs: historyFrame?.horizonMs ?? 0,
            binDurationMs: historyFrame?.binDurationMs ?? 0,
            inputPeak: historySummary.inputPeak,
            outputPeak: historySummary.outputPeak,
            removedPeak: historySummary.removedPeak,
            plot: HISTORY_PLOT,
        },
    }), [
        activeTransferFrame,
        clippedHistoryBinCount,
        clippedSampleCount,
        displayRange,
        headroom,
        historyBins.length,
        historyFrame,
        historySummary.inputPeak,
        historySummary.outputPeak,
        historySummary.removedPeak,
        overshoot,
        samplePoints.length,
        transferOccupancy.leftOverflowCount,
        transferOccupancy.peakDensity,
        transferOccupancy.peakRemoved,
        transferOccupancy.rightOverflowCount,
        transferOccupancyPaths,
    ]);

    const ceilingYTransferTop = buildAxisLabelY(1, transferPlotRect, displayRange);
    const ceilingYTransferBottom = buildAxisLabelY(-1, transferPlotRect, displayRange);
    const ceilingXTransferLeft = buildAxisLabelX(-1, transferPlotRect, displayRange);
    const ceilingXTransferRight = buildAxisLabelX(1, transferPlotRect, displayRange);
    const ceilingYHistoryTop = buildAxisLabelY(1, historyPlotRect, displayRange);
    const ceilingYHistoryBottom = buildAxisLabelY(-1, historyPlotRect, displayRange);
    const zeroYTransfer = buildAxisLabelY(0, transferPlotRect, displayRange);
    const zeroXTransfer = buildAxisLabelX(0, transferPlotRect, displayRange);
    const zeroYHistory = buildAxisLabelY(0, historyPlotRect, displayRange);

    if (compact) {
        return (
            <svg
                data-role="distortion-visualizer"
                viewBox={`0 0 ${COMPACT_VIEWBOX_WIDTH} ${COMPACT_VIEWBOX_HEIGHT}`}
                className={joinClasses("block h-full w-full", className)}
                aria-label="Distortion visualization"
            >
                <defs>
                    <linearGradient id="distortionRemovedFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(251,113,133,0.42)" />
                        <stop offset="100%" stopColor="rgba(239,68,68,0.04)" />
                    </linearGradient>
                    <filter id="distortionTransferOccupancyGlow" x="-18%" y="-18%" width="136%" height="136%">
                        <feGaussianBlur stdDeviation="5.6" />
                    </filter>
                </defs>

                <rect x="0" y="0" width={COMPACT_VIEWBOX_WIDTH} height={COMPACT_VIEWBOX_HEIGHT} fill="#020611" />
                <rect
                    x={COMPACT_PLOT.left}
                    y={COMPACT_PLOT.top}
                    width={COMPACT_PLOT.width}
                    height={COMPACT_PLOT.height}
                    rx="10"
                    fill="rgba(255,255,255,0.025)"
                />

                {/* Grid lines: 3 horizontal (+1, 0, -1), 3 vertical (-1, 0, +1) */}
                {[ceilingYTransferTop, zeroYTransfer, ceilingYTransferBottom].map((yValue, index) => (
                    <line
                        key={`compact-h-${index}`}
                        x1={COMPACT_PLOT.left}
                        x2={COMPACT_PLOT.left + COMPACT_PLOT.width}
                        y1={yValue}
                        y2={yValue}
                        stroke={index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.22)"}
                        strokeDasharray={index === 1 ? "0" : "6 6"}
                        strokeWidth={index === 1 ? "1.2" : "1"}
                    />
                ))}
                {[ceilingXTransferLeft, zeroXTransfer, ceilingXTransferRight].map((xValue, index) => (
                    <line
                        key={`compact-v-${index}`}
                        y1={COMPACT_PLOT.top}
                        y2={COMPACT_PLOT.top + COMPACT_PLOT.height}
                        x1={xValue}
                        x2={xValue}
                        stroke={index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.18)"}
                        strokeDasharray={index === 1 ? "0" : "6 6"}
                        strokeWidth={index === 1 ? "1.2" : "1"}
                    />
                ))}

                {/* History columns as subtle background */}
                {historyColumns.map((column, index) => (
                    <g key={`compact-hist-${index}`}>
                        {column.valid ? (
                            <rect
                                x={column.output.x}
                                y={column.output.y}
                                width={column.output.width}
                                height={column.output.height}
                                rx={Math.min(2.2, column.output.width * 0.45)}
                                fill="rgba(255,255,255,0.92)"
                                opacity={0.18}
                            />
                        ) : null}
                        {column.removedTop ? (
                            <rect
                                x={column.removedTop.x}
                                y={column.removedTop.y}
                                width={column.removedTop.width}
                                height={column.removedTop.height}
                                rx={Math.min(2.2, column.removedTop.width * 0.45)}
                                fill="rgba(251,113,133,0.88)"
                                opacity={0.30}
                            />
                        ) : null}
                        {column.removedBottom ? (
                            <rect
                                x={column.removedBottom.x}
                                y={column.removedBottom.y}
                                width={column.removedBottom.width}
                                height={column.removedBottom.height}
                                rx={Math.min(2.2, column.removedBottom.width * 0.45)}
                                fill="rgba(251,113,133,0.88)"
                                opacity={0.30}
                            />
                        ) : null}
                    </g>
                ))}

                {/* Occupancy ribbons */}
                {transferOccupancyPaths.map((segment, index) => (
                    <g key={`compact-occ-${index}`}>
                        <path
                            d={segment.occupancyPath}
                            fill="rgba(255,255,255,0.14)"
                            opacity={segment.occupancyOpacity}
                            filter="url(#distortionTransferOccupancyGlow)"
                        />
                        <path
                            d={segment.occupancyPath}
                            fill="rgba(255,255,255,0.26)"
                            opacity={Math.min(1, segment.occupancyOpacity + 0.1)}
                        />
                        {segment.clippedPath ? (
                            <path
                                d={segment.clippedPath}
                                fill="rgba(251,113,133,0.36)"
                                opacity={segment.clippedOpacity}
                            />
                        ) : null}
                    </g>
                ))}

                {/* Transfer curve */}
                {transferCurvePath ? (
                    <path
                        d={transferCurvePath}
                        fill="none"
                        stroke="rgba(103,232,249,0.98)"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : null}

                {/* Y-axis labels */}
                <text x={COMPACT_PLOT.left + 8} y={ceilingYTransferTop - 4} fill="rgba(248,113,113,0.74)" fontSize="10">+1</text>
                <text x={COMPACT_PLOT.left + 8} y={zeroYTransfer - 4} fill="rgba(226,232,240,0.54)" fontSize="10">0</text>
                <text x={COMPACT_PLOT.left + 8} y={ceilingYTransferBottom - 4} fill="rgba(248,113,113,0.74)" fontSize="10">-1</text>
            </svg>
        );
    }

    return (
        <div className={joinClasses("grid gap-3", className)}>
            <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-300/62">
                <div>Driven Transfer</div>
                <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-100/75">
                    {overshoot > 0 ? `Overshoot +${overshoot.toFixed(2)}` : `Headroom ${(headroom * 100).toFixed(0)}%`}
                </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(2,6,18,0.95),rgba(1,3,9,1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <svg
                    data-role="distortion-visualizer"
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    className="block h-auto w-full"
                    aria-label="Distortion visualization"
                >
                    <defs>
                        <linearGradient id="distortionRemovedFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="rgba(251,113,133,0.42)" />
                            <stop offset="100%" stopColor="rgba(239,68,68,0.04)" />
                        </linearGradient>
                        <filter id="distortionTransferOccupancyGlow" x="-18%" y="-18%" width="136%" height="136%">
                            <feGaussianBlur stdDeviation="5.6" />
                        </filter>
                    </defs>

                    <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#020611" />

                    <rect
                        x={TRANSFER_PLOT.left}
                        y={TRANSFER_PLOT.top}
                        width={TRANSFER_PLOT.width}
                        height={TRANSFER_PLOT.height}
                        rx="22"
                        fill="rgba(255,255,255,0.025)"
                        stroke="rgba(255,255,255,0.06)"
                    />
                    <rect
                        x={HISTORY_PLOT.left}
                        y={HISTORY_PLOT.top}
                        width={HISTORY_PLOT.width}
                        height={HISTORY_PLOT.height}
                        rx="22"
                        fill="rgba(255,255,255,0.025)"
                        stroke="rgba(255,255,255,0.06)"
                    />

                    <text x={TRANSFER_PLOT.left + 14} y={TRANSFER_PLOT.top + 22} fill="rgba(226,232,240,0.58)" fontSize="11" letterSpacing="0.2em">
                        CURVE DOMAIN
                    </text>
                    <text x={HISTORY_PLOT.left + 14} y={HISTORY_PLOT.top + 22} fill="rgba(226,232,240,0.58)" fontSize="11" letterSpacing="0.2em">
                        OUTPUT + DELTA
                    </text>

                    {[ceilingYTransferTop, zeroYTransfer, ceilingYTransferBottom].map((yValue, index) => (
                        <line
                            key={`transfer-horizontal-${index}`}
                            x1={TRANSFER_PLOT.left}
                            x2={TRANSFER_PLOT.left + TRANSFER_PLOT.width}
                            y1={yValue}
                            y2={yValue}
                            stroke={index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.22)"}
                            strokeDasharray={index === 1 ? "0" : "6 6"}
                            strokeWidth={index === 1 ? "1.2" : "1"}
                        />
                    ))}
                    {[ceilingXTransferLeft, zeroXTransfer, ceilingXTransferRight].map((xValue, index) => (
                        <line
                            key={`transfer-vertical-${index}`}
                            y1={TRANSFER_PLOT.top}
                            y2={TRANSFER_PLOT.top + TRANSFER_PLOT.height}
                            x1={xValue}
                            x2={xValue}
                            stroke={index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.18)"}
                            strokeDasharray={index === 1 ? "0" : "6 6"}
                            strokeWidth={index === 1 ? "1.2" : "1"}
                        />
                    ))}
                    {[ceilingYHistoryTop, zeroYHistory, ceilingYHistoryBottom].map((yValue, index) => (
                        <line
                            key={`history-horizontal-${index}`}
                            x1={HISTORY_PLOT.left}
                            x2={HISTORY_PLOT.left + HISTORY_PLOT.width}
                            y1={yValue}
                            y2={yValue}
                            stroke={index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.22)"}
                            strokeDasharray={index === 1 ? "0" : "6 6"}
                            strokeWidth={index === 1 ? "1.2" : "1"}
                        />
                    ))}

                    {transferOccupancyPaths.map((segment, index) => (
                        <g key={`transfer-occupancy-${index}`}>
                            <path
                                data-role="distortion-transfer-occupancy"
                                d={segment.occupancyPath}
                                fill="rgba(255,255,255,0.14)"
                                opacity={segment.occupancyOpacity}
                                filter="url(#distortionTransferOccupancyGlow)"
                            />
                            <path
                                data-role="distortion-transfer-occupancy"
                                d={segment.occupancyPath}
                                fill="rgba(255,255,255,0.26)"
                                opacity={Math.min(1, segment.occupancyOpacity + 0.1)}
                            />
                            {segment.clippedPath ? (
                                <path
                                    data-role="distortion-transfer-clipped-occupancy"
                                    d={segment.clippedPath}
                                    fill="rgba(251,113,133,0.36)"
                                    opacity={segment.clippedOpacity}
                                />
                            ) : null}
                        </g>
                    ))}
                    {transferCurvePath ? (
                        <path
                            d={transferCurvePath}
                            fill="none"
                            stroke="rgba(103,232,249,0.98)"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}
                    {historyColumns.map((column, index) => (
                        <g key={`history-column-${index}`}>
                            {column.valid ? (
                                <rect
                                    data-role="distortion-history-output-column"
                                    x={column.output.x}
                                    y={column.output.y}
                                    width={column.output.width}
                                    height={column.output.height}
                                    rx={Math.min(2.2, column.output.width * 0.45)}
                                    fill="rgba(255,255,255,0.92)"
                                />
                            ) : null}
                            {column.removedTop ? (
                                <rect
                                    data-role="distortion-history-removed-column"
                                    x={column.removedTop.x}
                                    y={column.removedTop.y}
                                    width={column.removedTop.width}
                                    height={column.removedTop.height}
                                    rx={Math.min(2.2, column.removedTop.width * 0.45)}
                                    fill="rgba(251,113,133,0.88)"
                                />
                            ) : null}
                            {column.removedBottom ? (
                                <rect
                                    data-role="distortion-history-removed-column"
                                    x={column.removedBottom.x}
                                    y={column.removedBottom.y}
                                    width={column.removedBottom.width}
                                    height={column.removedBottom.height}
                                    rx={Math.min(2.2, column.removedBottom.width * 0.45)}
                                    fill="rgba(251,113,133,0.88)"
                                />
                            ) : null}
                        </g>
                    ))}

                    <text x={TRANSFER_PLOT.left + 8} y={ceilingYTransferTop - 6} fill="rgba(248,113,113,0.74)" fontSize="11">+1</text>
                    <text x={TRANSFER_PLOT.left + 8} y={zeroYTransfer - 6} fill="rgba(226,232,240,0.54)" fontSize="11">0</text>
                    <text x={TRANSFER_PLOT.left + 8} y={ceilingYTransferBottom - 6} fill="rgba(248,113,113,0.74)" fontSize="11">-1</text>
                    <text x={ceilingXTransferLeft - 9} y={TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10} fill="rgba(248,113,113,0.74)" fontSize="11" textAnchor="end">-1</text>
                    <text x={zeroXTransfer} y={TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10} fill="rgba(226,232,240,0.54)" fontSize="11" textAnchor="middle">0</text>
                    <text x={ceilingXTransferRight + 9} y={TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10} fill="rgba(248,113,113,0.74)" fontSize="11">+1</text>
                    <text x={HISTORY_PLOT.left + 8} y={ceilingYHistoryTop - 6} fill="rgba(248,113,113,0.74)" fontSize="11">+1</text>
                    <text x={HISTORY_PLOT.left + 8} y={zeroYHistory - 6} fill="rgba(226,232,240,0.54)" fontSize="11">0</text>
                    <text x={HISTORY_PLOT.left + 8} y={ceilingYHistoryBottom - 6} fill="rgba(248,113,113,0.74)" fontSize="11">-1</text>
                    <text x={TRANSFER_PLOT.left + TRANSFER_PLOT.width - 10} y={TRANSFER_PLOT.top + 24} fill="rgba(226,232,240,0.54)" fontSize="11" textAnchor="end">
                        fixed ±{displayRange.toFixed(2)}
                    </text>
                    <text x={HISTORY_PLOT.left + HISTORY_PLOT.width - 10} y={HISTORY_PLOT.top + 24} fill="rgba(226,232,240,0.54)" fontSize="11" textAnchor="end">
                        {historyFrame ? `${(historyFrame.horizonMs / 1000).toFixed(1)}s overview` : "waiting"}
                    </text>
                </svg>
            </div>

            <pre data-role="distortion-graph-debug" className="hidden">
                {JSON.stringify(debugState)}
            </pre>
        </div>
    );
}
