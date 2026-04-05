import {
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";

import { clampDisplayPosition } from "./runtime-table-state";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    MSEG_SELECTED_POINT_RADIUS_PX,
    clampMsegRateSeconds,
    createMsegEditorMetrics,
    pointToMsegEditorCoordinates,
    sampleMsegEditorPolyline,
    sampleMsegSegmentEditorPolyline,
    type MsegSurfaceOrientation,
    type MsegState,
} from "./mseg";
import { CanvasWavetableDisplay } from "./wavetable-display";
import type { SynthFocusBindings } from "./synth-input-router";
import {
    createFilterResponseModel,
    FILTER_CUTOFF_MAX_HZ,
    FILTER_CUTOFF_MIN_HZ,
    FILTER_Q_MAX,
    FILTER_Q_MIN,
    normalizedToFilterCutoffHz,
    normalizedToFilterQ,
} from "./filter-response";
import {
    advanceFilterSpectrumDisplayState,
    buildFilterSpectrumBands,
    buildFilterSpectrumDbTicks,
    buildFilterSpectrumFrequencyTicks,
    createFilterSpectrumDisplayFrame,
    FILTER_SPECTRUM_MAX_DB,
    FILTER_SPECTRUM_MIN_DB,
    type FilterSpectrumDisplayState,
    type FilterSpectrumFrame,
} from "./filter-spectrum";

export type VoiceModeOption = {
    value: number;
    label: string;
};

export const VOICE_MODE_OPTIONS: VoiceModeOption[] = [
    { value: 0, label: "Poly" },
    { value: 1, label: "Mono" },
    { value: 2, label: "Legato" },
];
const MSEG_GRID_STEPS = [0.25, 0.5, 0.75] as const;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
const MSEG_PREVIEW_VERTICAL_PADDING_PX = 22;

export type FactoryTableOption = {
    tableId: string;
    name: string;
    sourceWav: string;
    frameCount: number;
};

export type RangeFieldProps = {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    displayValue: string;
    onChange: (nextValue: number) => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    onPointerCancel?: () => void;
    ariaLabel?: string;
    focusBindings?: SynthFocusBindings;
};

export type WavetableStageSectionProps = {
    stageRef: RefObject<HTMLDivElement | null>;
    frames: Float32Array[] | null;
    position: number;
    warpMode: number;
    warpAmount: number;
    tableName: string;
    frameCount: number;
    desiredTableIndex: number;
    tableOptions: FactoryTableOption[];
    canRetry: boolean;
    onTableChange: (nextValue: number) => void;
    onRetry: () => void;
    tableFocusBindings: SynthFocusBindings;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    className?: string;
};

export type MsegOverviewSectionProps = {
    msegState: MsegState | null;
    onOpenEditor: () => void;
    onDepthChange: (nextValue: number) => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    depthFocusBindings: SynthFocusBindings;
    rateFocusBindings: SynthFocusBindings;
    className?: string;
};

export type VoiceGlideControlSurfaceProps = {
    playModeValue: number;
    onPlayModeChange: (nextValue: number) => void;
    playModeFocusBindings: SynthFocusBindings;
    glideControl: ReactNode;
    className?: string;
};

export type FilterResponseGraphProps = {
    baseMode: number;
    baseCutoffHz: number;
    baseQ: number;
    liveMode: number;
    liveCutoffHz: number;
    liveQ: number;
    liveHasActive: boolean;
    spectrumFrame?: FilterSpectrumFrame | null;
    onCutoffChange: (nextValue: number) => void;
    onQChange: (nextValue: number) => void;
    className?: string;
};

export type KeyboardSectionShellProps = {
    keyboardRootLabel: string;
    canOctaveUp: boolean;
    canOctaveDown: boolean;
    onOctaveUp: () => void;
    onOctaveDown: () => void;
    toolbar: ReactNode;
    keyboard: ReactNode;
    className?: string;
    railClassName?: string;
    contentClassName?: string;
};

function joinClasses(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

function useResizeObserver<TElement extends Element>(ref: RefObject<TElement | null>) {
    const [size, setSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const update = () => {
            const bounds = element.getBoundingClientRect();
            const host = element as unknown as HTMLElement;
            setSize({
                width: Math.max(1, bounds.width || host.clientWidth || 1),
                height: Math.max(1, bounds.height || host.clientHeight || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => observer.disconnect();
    }, [ref]);

    return size;
}

function formatSeconds(seconds: number) {
    return `${seconds.toFixed(3)} s`;
}

function formatFrameIndex(position: number, frameCount: number) {
    const safeFrameCount = Math.max(1, frameCount);
    const frameIndex = Math.round(position * Math.max(0, safeFrameCount - 1)) + 1;
    return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function buildMsegSurfacePaths(
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

function buildMsegSegmentPath(
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

function SelectChevron({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M3 4.5 6 7.5 9 4.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
            />
        </svg>
    );
}

function OctaveShiftGlyph({
    direction,
}: {
    direction: "up" | "down";
}) {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
                d={direction === "up" ? "M4.5 9.75 8 6.25 11.5 9.75" : "M4.5 6.25 8 9.75 11.5 6.25"}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

export function MsegPreview({
    points,
    orientation = "horizontal",
    className,
}: {
    points: Array<{ x: number; y: number; curvePower: number }>;
    orientation?: MsegSurfaceOrientation;
    className?: string;
}) {
    const viewportRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);

    const { curvePath, fillPath, metrics } = useMemo(() => {
        return buildMsegSurfacePaths(points, size.width, size.height, {
            orientation,
            pointRadius: 0,
            horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
            verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
        });
    }, [orientation, points, size.height, size.width]);

    return (
        <svg
            ref={viewportRef}
            className={className ?? "h-32 w-full overflow-hidden rounded-[20px] bg-white/[0.03]"}
            viewBox={`0 0 ${size.width} ${size.height}`}
        >
            <g>
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`h-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft}
                        y1={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                        x2={metrics.plotRight}
                        y2={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                    />
                ))}
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`v-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft + (metrics.plotWidth * step)}
                        y1={metrics.plotTop}
                        x2={metrics.plotLeft + (metrics.plotWidth * step)}
                        y2={metrics.plotBottom}
                    />
                ))}
            </g>
            <path className="cosimo-curve-fill" d={fillPath} />
            <path className="cosimo-curve-line" d={curvePath} />
        </svg>
    );
}

function VoiceModeGlyph({
    mode,
    active,
}: {
    mode: number;
    active: boolean;
}) {
    const stroke = active ? "rgba(214,244,255,0.96)" : "rgba(189,204,223,0.72)";
    const fill = active ? "rgba(143,232,255,0.24)" : "rgba(255,255,255,0.06)";

    if (mode === 0) {
        return (
            <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
                <circle cx="7" cy="11" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
                <circle cx="14" cy="8" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
                <circle cx="21" cy="11" r="3.2" fill={fill} stroke={stroke} strokeWidth="1.3" />
            </svg>
        );
    }

    if (mode === 1) {
        return (
            <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
                <rect x="8.5" y="4.5" width="11" height="9" rx="4.5" fill={fill} stroke={stroke} strokeWidth="1.3" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true">
            <circle cx="8" cy="9" r="3" fill={fill} stroke={stroke} strokeWidth="1.3" />
            <circle cx="20" cy="9" r="3" fill={fill} stroke={stroke} strokeWidth="1.3" />
            <path d="M10.8 9 C12.5 5.5 15.5 5.5 17.2 9" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

export function WavetableCanvas({
    frames,
    position,
    warpMode,
    warpAmount,
}: {
    frames: Float32Array[] | null;
    position: number;
    warpMode: number;
    warpAmount: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const displayRef = useRef<CanvasWavetableDisplay | null>(null);

    useLayoutEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        displayRef.current = new CanvasWavetableDisplay(canvasRef.current);
        return () => {
            displayRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!displayRef.current || !frames) {
            return;
        }

        displayRef.current.setFrames(frames);
    }, [frames]);

    useEffect(() => {
        displayRef.current?.setPosition(position);
    }, [position]);

    useEffect(() => {
        displayRef.current?.setWarp(warpMode, warpAmount);
    }, [warpAmount, warpMode]);

    useEffect(() => {
        displayRef.current?.resize(size.width, size.height, window.devicePixelRatio || 1);
    }, [size]);

    return (
        <div ref={viewportRef} className="absolute inset-0">
            <canvas ref={canvasRef} className="h-full w-full" />
        </div>
    );
}

export function EditableMsegSurface({
    surfaceRef,
    points,
    selectedPointIndex,
    hoveredSegmentIndex = -1,
    activeSegmentIndex = -1,
    orientation = "horizontal",
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    className,
    dataRole,
}: {
    surfaceRef: RefObject<SVGSVGElement | null>;
    points: Array<{ x: number; y: number; curvePower: number }>;
    selectedPointIndex: number;
    hoveredSegmentIndex?: number;
    activeSegmentIndex?: number;
    orientation?: MsegSurfaceOrientation;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerLeave?: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    className?: string;
    dataRole?: string;
}) {
    const size = useResizeObserver(surfaceRef);
    const emphasizedSegmentIndex = activeSegmentIndex >= 0 ? activeSegmentIndex : hoveredSegmentIndex;
    const hasEmphasizedSegment = emphasizedSegmentIndex >= 0;

    const { curvePath, fillPath, highlightedSegmentPath, metrics } = useMemo(() => {
        const basePaths = buildMsegSurfacePaths(points, size.width, size.height, {
            orientation,
        });
        const nextHighlightedSegmentPath = emphasizedSegmentIndex >= 0
            ? buildMsegSegmentPath(points, emphasizedSegmentIndex, size.width, size.height, { orientation })
            : "";

        return {
            ...basePaths,
            highlightedSegmentPath: nextHighlightedSegmentPath,
        };
    }, [emphasizedSegmentIndex, orientation, points, size.height, size.width]);

    return (
        <svg
            ref={surfaceRef}
            data-role={dataRole}
            className={joinClasses(
                "h-full w-full touch-none overflow-hidden rounded-[20px] bg-white/[0.03]",
                className,
            )}
            viewBox={`0 0 ${size.width} ${size.height}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <g>
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`editable-h-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft}
                        y1={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                        x2={metrics.plotRight}
                        y2={metrics.plotTop + (metrics.plotHeight * (1 - step))}
                    />
                ))}
                {MSEG_GRID_STEPS.map((step) => (
                    <line
                        key={`editable-v-${step}`}
                        className="cosimo-grid-line"
                        x1={metrics.plotLeft + (metrics.plotWidth * step)}
                        y1={metrics.plotTop}
                        x2={metrics.plotLeft + (metrics.plotWidth * step)}
                        y2={metrics.plotBottom}
                    />
                ))}
            </g>
            <path
                data-role="mseg-base-fill"
                className={joinClasses("cosimo-curve-fill", hasEmphasizedSegment && "cosimo-curve-fill-muted")}
                d={fillPath}
            />
            <path
                data-role="mseg-base-curve"
                className={joinClasses("cosimo-curve-line", hasEmphasizedSegment && "cosimo-curve-line-muted")}
                d={curvePath}
            />
            {highlightedSegmentPath ? (
                <path
                    data-role="mseg-highlight-segment"
                    data-segment-index={String(emphasizedSegmentIndex)}
                    className="cosimo-curve-line cosimo-curve-line-highlight"
                    d={highlightedSegmentPath}
                />
            ) : null}
            <g>
                {points.map((point, pointIndex) => {
                    const coordinates = pointToMsegEditorCoordinates(point, size.width, size.height, {
                        orientation,
                    });
                    const isSelected = pointIndex === selectedPointIndex;
                    const isEmphasizedSegmentEndpoint =
                        hasEmphasizedSegment &&
                        (pointIndex === emphasizedSegmentIndex || pointIndex === emphasizedSegmentIndex + 1);
                    const pointState = hasEmphasizedSegment
                        ? isEmphasizedSegmentEndpoint
                            ? "highlighted"
                            : "muted"
                        : isSelected
                            ? "selected"
                            : "default";
                    const radius = pointState === "selected"
                        ? MSEG_SELECTED_POINT_RADIUS_PX
                        : MSEG_POINT_RADIUS_PX;
                    const pointClassName = pointState === "selected"
                        ? "cosimo-mseg-point-selected"
                        : pointState === "highlighted"
                            ? "cosimo-mseg-point-highlight"
                            : pointState === "muted"
                                ? "cosimo-mseg-point-muted"
                                : "cosimo-mseg-point-default";

                    return (
                        <circle
                            key={`point-${pointIndex}-${point.x}-${point.y}`}
                            data-role="mseg-point"
                            data-point-index={String(pointIndex)}
                            data-point-state={pointState}
                            cx={coordinates.x}
                            cy={coordinates.y}
                            r={radius}
                            className={pointClassName}
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </g>
        </svg>
    );
}

export function RangeField({
    label,
    min,
    max,
    step,
    value,
    displayValue,
    onChange,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    ariaLabel,
    focusBindings,
}: RangeFieldProps) {
    return (
        <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">{label}</span>
            <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4">
                <input
                    className="cosimo-range"
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value.toFixed(3)}
                    aria-label={ariaLabel ?? label}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onChange={(event) => onChange(Number(event.target.value))}
                    {...focusBindings}
                />
                <div className="text-right font-mono text-sm tracking-[0.18em] text-cyan-200">
                    {displayValue}
                </div>
            </div>
        </label>
    );
}

function buildMagnitudePlotPoints(
    magnitudesDb: number[],
    width: number,
    height: number,
    {
        horizontalPadding = 18,
        verticalPadding = 16,
        minDb = -24,
        maxDb = 18,
    }: {
        horizontalPadding?: number;
        verticalPadding?: number;
        minDb?: number;
        maxDb?: number;
    } = {},
) {
    const plotLeft = horizontalPadding;
    const plotRight = Math.max(horizontalPadding + 1, width - horizontalPadding);
    const plotTop = verticalPadding;
    const plotBottom = Math.max(verticalPadding + 1, height - verticalPadding);
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const points: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < magnitudesDb.length; index += 1) {
        const x = plotLeft + (plotWidth * (index / Math.max(1, magnitudesDb.length - 1)));
        const normalized = clamp((clamp(magnitudesDb[index], minDb, maxDb) - minDb) / (maxDb - minDb), 0, 1);
        const y = plotBottom - (plotHeight * normalized);
        points.push({ x, y });
    }

    return {
        points,
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        plotWidth,
        plotHeight,
    };
}

function buildFilterResponsePath(
    magnitudesDb: number[],
    width: number,
    height: number,
    options: {
        horizontalPadding?: number;
        verticalPadding?: number;
        minDb?: number;
        maxDb?: number;
    } = {},
) {
    const plot = buildMagnitudePlotPoints(magnitudesDb, width, height, options);
    let path = "";

    for (let index = 0; index < plot.points.length; index += 1) {
        const point = plot.points[index];
        path += `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)} `;
    }

    return {
        ...plot,
        path: path.trim(),
    };
}

function drawFilterSpectrumOverlay({
    canvas,
    width,
    height,
    smoothedMagnitudesDb,
    peakMagnitudesDb,
}: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    smoothedMagnitudesDb: number[];
    peakMagnitudesDb?: number[];
}) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const scaledHeight = Math.max(1, Math.round(height * devicePixelRatio));

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
    }

    const context = canvas.getContext("2d");

    if (!context) {
        return;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const plot = buildMagnitudePlotPoints(smoothedMagnitudesDb, width, height, {
        minDb: FILTER_SPECTRUM_MIN_DB,
        maxDb: FILTER_SPECTRUM_MAX_DB,
    });

    if (plot.points.length === 0) {
        return;
    }

    const gradient = context.createLinearGradient(0, plot.plotTop, 0, plot.plotBottom);
    gradient.addColorStop(0, "rgba(94, 215, 255, 0.12)");
    gradient.addColorStop(1, "rgba(94, 215, 255, 0.00)");

    context.beginPath();
    context.moveTo(plot.points[0].x, plot.plotBottom);

    for (const point of plot.points) {
        context.lineTo(point.x, point.y);
    }

    context.lineTo(plot.points[plot.points.length - 1].x, plot.plotBottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    for (let index = 0; index < plot.points.length; index += 1) {
        const point = plot.points[index];
        if (index === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    }
    context.strokeStyle = "rgba(114, 217, 255, 0.58)";
    context.lineWidth = 1.75;
    context.stroke();

    if (Array.isArray(peakMagnitudesDb) && peakMagnitudesDb.length === smoothedMagnitudesDb.length) {
        const peakPlot = buildMagnitudePlotPoints(peakMagnitudesDb, width, height, {
            minDb: FILTER_SPECTRUM_MIN_DB,
            maxDb: FILTER_SPECTRUM_MAX_DB,
        });

        context.beginPath();
        for (let index = 0; index < peakPlot.points.length; index += 1) {
            const point = peakPlot.points[index];
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        }

        context.strokeStyle = "rgba(158, 231, 255, 0.28)";
        context.lineWidth = 1;
        context.stroke();
    }
}

export function FilterResponseGraph({
    baseMode,
    baseCutoffHz,
    baseQ,
    liveMode,
    liveCutoffHz,
    liveQ,
    liveHasActive,
    spectrumFrame = null,
    onCutoffChange,
    onQChange,
    className,
}: FilterResponseGraphProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const [activePointerId, setActivePointerId] = useState<number | null>(null);
    const baseModel = useMemo(() => createFilterResponseModel({
        mode: baseMode,
        cutoffHz: baseCutoffHz,
        q: baseQ,
    }), [baseCutoffHz, baseMode, baseQ]);
    const liveModel = useMemo(() => createFilterResponseModel({
        mode: liveHasActive ? liveMode : baseMode,
        cutoffHz: liveHasActive ? liveCutoffHz : baseCutoffHz,
        q: liveHasActive ? liveQ : baseQ,
    }), [baseCutoffHz, baseMode, baseQ, liveCutoffHz, liveHasActive, liveMode, liveQ]);
    const basePath = useMemo(
        () => buildFilterResponsePath(baseModel.magnitudesDb, size.width, size.height),
        [baseModel.magnitudesDb, size.height, size.width],
    );
    const livePath = useMemo(
        () => buildFilterResponsePath(liveModel.magnitudesDb, size.width, size.height),
        [liveModel.magnitudesDb, size.height, size.width],
    );
    const spectrumBands = useMemo(() => buildFilterSpectrumBands(), []);
    const spectrumFrequencyTicks = useMemo(() => buildFilterSpectrumFrequencyTicks(), []);
    const spectrumDbTicks = useMemo(() => buildFilterSpectrumDbTicks(), []);
    const [spectrumDisplay, setSpectrumDisplay] = useState<FilterSpectrumDisplayState | null>(null);

    useEffect(() => {
        const nextFrame = createFilterSpectrumDisplayFrame({
            frame: spectrumFrame,
            bands: spectrumBands,
        });

        if (!nextFrame) {
            return;
        }

        setSpectrumDisplay((previousState) => (
            advanceFilterSpectrumDisplayState(previousState, nextFrame, performance.now())
        ));
    }, [spectrumBands, spectrumFrame]);

    useEffect(() => {
        const canvas = spectrumCanvasRef.current;

        if (!canvas) {
            return;
        }

        let animationFrameID = window.requestAnimationFrame(() => {
            if (!spectrumDisplay) {
                drawFilterSpectrumOverlay({
                    canvas,
                    width: size.width,
                    height: size.height,
                    smoothedMagnitudesDb: spectrumBands.map(() => FILTER_SPECTRUM_MIN_DB),
                });
                return;
            }

            drawFilterSpectrumOverlay({
                canvas,
                width: size.width,
                height: size.height,
                smoothedMagnitudesDb: spectrumDisplay.smoothedMagnitudesDb,
                peakMagnitudesDb: spectrumDisplay.peakMagnitudesDb,
            });
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [size.height, size.width, spectrumBands, spectrumDisplay]);

    const applyPointerPosition = (clientX: number, clientY: number) => {
        const element = surfaceRef.current;

        if (!element) {
            return;
        }

        const bounds = element.getBoundingClientRect();
        const normalizedX = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
        const normalizedY = clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
        onCutoffChange(clamp(normalizedToFilterCutoffHz(normalizedX), FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ));
        onQChange(clamp(normalizedToFilterQ(1 - normalizedY), FILTER_Q_MIN, FILTER_Q_MAX));
    };

    const debugState = useMemo(() => ({
        base: {
            mode: baseModel.mode,
            cutoffHz: baseModel.cutoffHz,
            q: baseModel.q,
            peakIndex: baseModel.peakIndex,
            minIndex: baseModel.minIndex,
        },
        live: {
            hasActive: liveHasActive,
            mode: liveModel.mode,
            cutoffHz: liveModel.cutoffHz,
            q: liveModel.q,
            peakIndex: liveModel.peakIndex,
            minIndex: liveModel.minIndex,
        },
        spectrum: spectrumDisplay ? {
            hasSpectrum: true,
            sampleRateHz: spectrumDisplay.sampleRateHz,
            sourceBinCount: spectrumDisplay.sourceBinCount,
            bandCount: spectrumDisplay.bands.length,
            peakBandIndex: spectrumDisplay.peakBandIndex,
            bandMagnitudesDb: spectrumDisplay.bandMagnitudesDb,
            smoothedMagnitudesDb: spectrumDisplay.smoothedMagnitudesDb,
            peakMagnitudesDb: spectrumDisplay.peakMagnitudesDb,
            frequencyTicks: spectrumDisplay.frequencyTicks,
            dbTicks: spectrumDisplay.dbTicks,
        } : {
            hasSpectrum: false,
            sampleRateHz: null,
            sourceBinCount: 0,
            bandCount: spectrumBands.length,
            peakBandIndex: -1,
            bandMagnitudesDb: [],
            smoothedMagnitudesDb: [],
            peakMagnitudesDb: [],
            frequencyTicks: spectrumFrequencyTicks,
            dbTicks: spectrumDbTicks,
        },
    }), [baseModel, liveHasActive, liveModel, spectrumBands.length, spectrumDbTicks, spectrumDisplay, spectrumFrequencyTicks]);

    return (
        <div className={joinClasses("grid gap-2", className)}>
            <div
                ref={viewportRef}
                className="relative h-44 w-full overflow-hidden rounded-[20px] border border-white/8 bg-black/25"
            >
                <canvas
                    ref={spectrumCanvasRef}
                    data-role="filter-spectrum-canvas"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                />
                <svg
                    ref={surfaceRef}
                    data-role="filter-response-graph"
                    className="absolute inset-0 h-full w-full touch-none overflow-hidden"
                    viewBox={`0 0 ${size.width} ${size.height}`}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setActivePointerId(event.pointerId);
                        applyPointerPosition(event.clientX, event.clientY);
                    }}
                    onPointerMove={(event) => {
                        if (activePointerId !== event.pointerId) {
                            return;
                        }
                        applyPointerPosition(event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                        if (activePointerId === event.pointerId) {
                            setActivePointerId(null);
                        }
                    }}
                    onPointerCancel={(event) => {
                        if (activePointerId === event.pointerId) {
                            setActivePointerId(null);
                        }
                    }}
                >
                    {spectrumDbTicks.map((tick) => (
                        <line
                            key={`filter-grid-h-${tick.label}`}
                            x1={basePath.plotLeft}
                            x2={basePath.plotRight}
                            y1={basePath.plotTop + (basePath.plotHeight * (tick.normalizedY ?? 0))}
                            y2={basePath.plotTop + (basePath.plotHeight * (tick.normalizedY ?? 0))}
                            stroke="rgba(255,255,255,0.07)"
                            strokeWidth="1"
                        />
                    ))}
                    {spectrumFrequencyTicks.map((tick) => (
                        <line
                            key={`filter-grid-v-${tick.label}`}
                            y1={basePath.plotTop}
                            y2={basePath.plotBottom}
                            x1={basePath.plotLeft + (basePath.plotWidth * (tick.normalizedX ?? 0))}
                            x2={basePath.plotLeft + (basePath.plotWidth * (tick.normalizedX ?? 0))}
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth="1"
                        />
                    ))}
                    {spectrumDbTicks.map((tick) => (
                        <text
                            key={`filter-db-label-${tick.label}`}
                            x={basePath.plotLeft + 2}
                            y={(basePath.plotTop + (basePath.plotHeight * (tick.normalizedY ?? 0))) - 4}
                            fill="rgba(226,232,240,0.44)"
                            fontSize="10"
                        >
                            {tick.label}
                        </text>
                    ))}
                    {spectrumFrequencyTicks.map((tick) => (
                        <text
                            key={`filter-frequency-label-${tick.label}`}
                            x={basePath.plotLeft + (basePath.plotWidth * (tick.normalizedX ?? 0))}
                            y={Math.max(basePath.plotBottom - 6, 16)}
                            fill="rgba(226,232,240,0.42)"
                            fontSize="10"
                            textAnchor="middle"
                        >
                            {tick.label}
                        </text>
                    ))}
                    <path d={basePath.path} fill="none" stroke="rgba(123, 197, 255, 0.46)" strokeWidth="2" />
                    <path
                        d={livePath.path}
                        fill="none"
                        stroke={liveHasActive ? "rgba(94, 215, 255, 0.98)" : "rgba(94, 215, 255, 0.72)"}
                        strokeWidth={liveHasActive ? "3" : "2"}
                    />
                </svg>
            </div>
            <pre data-role="filter-graph-debug" className="hidden">
                {JSON.stringify(debugState)}
            </pre>
        </div>
    );
}

export function VoiceModeToolbar({
    value,
    onChange,
    focusBindings,
    options = VOICE_MODE_OPTIONS,
    className,
    surfaceClassName,
}: {
    value: number;
    onChange: (nextValue: number) => void;
    focusBindings: SynthFocusBindings;
    options?: VoiceModeOption[];
    className?: string;
    surfaceClassName?: string;
}) {
    const columnCount = Math.max(1, options.length);

    return (
        <div className={joinClasses("grid gap-2", className)}>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/60">Voice</span>
            <div
                className={joinClasses(
                    "inline-grid gap-1 rounded-[18px] border border-white/8 bg-black/25 p-1",
                    surfaceClassName,
                )}
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                {...focusBindings}
            >
                {options.map((option) => {
                    const isActive = option.value === value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={`rounded-[14px] px-3 py-2.5 text-left transition ${
                                isActive
                                    ? "bg-white/[0.08] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(143,232,255,0.18)]"
                                    : "text-slate-300/70 hover:bg-white/[0.04] hover:text-slate-100"
                            }`}
                            onClick={() => onChange(option.value)}
                            aria-pressed={isActive}
                        >
                            <div className="flex items-center gap-2">
                                <VoiceModeGlyph mode={option.value} active={isActive} />
                                <span className="text-[11px] uppercase tracking-[0.16em]">{option.label}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function VoiceGlideControlSurface({
    playModeValue,
    onPlayModeChange,
    playModeFocusBindings,
    glideControl,
    className,
}: VoiceGlideControlSurfaceProps) {
    return (
        <div className={joinClasses(
            "grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3",
            className,
        )}>
            <VoiceModeToolbar
                value={playModeValue}
                onChange={onPlayModeChange}
                focusBindings={playModeFocusBindings}
            />
            {glideControl}
        </div>
    );
}

export function KeyboardSectionShell({
    keyboardRootLabel,
    canOctaveUp,
    canOctaveDown,
    onOctaveUp,
    onOctaveDown,
    toolbar,
    keyboard,
    className,
    railClassName,
    contentClassName,
}: KeyboardSectionShellProps) {
    return (
        <section className={joinClasses("grid gap-3", className)}>
            <div className={joinClasses(
                "flex flex-col items-center justify-end gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] px-2 py-3",
                railClassName,
            )}>
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300/55">Oct</span>
                <button
                    type="button"
                    className="cosimo-button flex h-10 w-10 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveUp}
                    disabled={!canOctaveUp}
                    aria-label="Shift keyboard up one octave"
                >
                    <OctaveShiftGlyph direction="up" />
                </button>
                <button
                    type="button"
                    className="cosimo-button flex h-10 w-10 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveDown}
                    disabled={!canOctaveDown}
                    aria-label="Shift keyboard down one octave"
                >
                    <OctaveShiftGlyph direction="down" />
                </button>
                <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-200/70">
                    {keyboardRootLabel}
                </div>
            </div>

            <div className={joinClasses("grid gap-3", contentClassName)}>
                {toolbar}
                {keyboard}
            </div>
        </section>
    );
}

export function WavetableStageSection({
    stageRef,
    frames,
    position,
    warpMode,
    warpAmount,
    tableName,
    frameCount,
    desiredTableIndex,
    tableOptions,
    canRetry,
    onTableChange,
    onRetry,
    tableFocusBindings,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    className,
}: WavetableStageSectionProps) {
    const debugState = useMemo(() => ({
        position: clampDisplayPosition(position),
        warpMode: Math.round(Number(warpMode) || 0),
        warpAmount: clamp(Number(warpAmount) || 0, 0, 1),
    }), [position, warpAmount, warpMode]);

    return (
        <section
            ref={stageRef}
            className={joinClasses(
                "cosimo-stage relative overflow-hidden rounded-[30px] border border-white/8",
                className,
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <WavetableCanvas
                frames={frames}
                position={position}
                warpMode={warpMode}
                warpAmount={warpAmount}
            />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 text-[11px] uppercase tracking-[0.16em] text-slate-300/70">
                <label className="relative inline-flex max-w-[280px] cursor-pointer items-center">
                    <div className="inline-flex min-w-0 items-center rounded-full border border-white/10 bg-black/40 px-4 py-2.5 pr-10 text-left text-[11px] uppercase tracking-[0.18em] text-amber-100 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md">
                        <span className="truncate">{tableName}</span>
                    </div>
                    <SelectChevron className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300/75" />
                    <select
                        className="absolute inset-0 cursor-pointer opacity-0"
                        value={String(desiredTableIndex)}
                        onChange={(event) => onTableChange(Number(event.target.value))}
                        aria-label="Select wavetable"
                        {...tableFocusBindings}
                    >
                        {tableOptions.map((table, tableIndex) => (
                            <option key={`${table.name}-${tableIndex}`} value={tableIndex}>
                                {table.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-cyan-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        Frame {formatFrameIndex(position, frameCount)}
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-slate-200/80 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md">
                        Pos {clampDisplayPosition(position).toFixed(3)}
                    </div>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-start gap-3 p-5">
                {canRetry ? (
                    <button
                        type="button"
                        className="cosimo-button rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40"
                        disabled={!canRetry}
                        onClick={onRetry}
                    >
                        Retry Load
                    </button>
                ) : null}
            </div>

            <pre data-role="wavetable-stage-debug" className="hidden">
                {JSON.stringify(debugState)}
            </pre>
        </section>
    );
}

export function MsegOverviewSection({
    msegState,
    onOpenEditor,
    onDepthChange,
    onRateChange,
    onToggleLoop,
    depthFocusBindings,
    rateFocusBindings,
    className,
}: MsegOverviewSectionProps) {
    return (
        <section className={joinClasses(
            "grid grid-rows-[auto_minmax(0,1fr)_auto] gap-3 rounded-[30px] border border-white/8 bg-white/[0.03] p-4 pb-5",
            className,
        )}>
            <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">MSEG</div>
                <div className="font-mono text-sm tracking-[0.16em] text-cyan-200">
                    {msegState ? formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds)) : "0.000 s"}
                </div>
            </div>

            {msegState ? (
                <>
                    <button
                        type="button"
                        className="group min-h-0 overflow-hidden rounded-[24px] border border-white/6 bg-black/20 p-3 text-left transition hover:border-white/12 hover:bg-black/24"
                        onClick={onOpenEditor}
                        aria-label="Open MSEG editor"
                    >
                        <MsegPreview
                            points={msegState.shape.points}
                            className="h-full min-h-0 w-full overflow-hidden rounded-[18px] bg-white/[0.03]"
                        />
                    </button>
                    <div className="grid gap-3 pt-1">
                        <div className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-4">
                            <div className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Depth</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    min="-1"
                                    max="1"
                                    step="0.001"
                                    value={Number(msegState.depth).toFixed(3)}
                                    onChange={(event) => onDepthChange(Number(event.target.value))}
                                    {...depthFocusBindings}
                                />
                            </div>
                            <div className="text-right font-mono text-sm tracking-[0.16em] text-cyan-200">
                                {Number(msegState.depth).toFixed(3)}
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-4">
                            <div className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Rate</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    min={MSEG_RATE_MIN_SECONDS}
                                    max={MSEG_RATE_MAX_SECONDS}
                                    step="0.001"
                                    value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                                    onChange={(event) => onRateChange(Number(event.target.value))}
                                    {...rateFocusBindings}
                                />
                            </div>
                            <div className="text-right font-mono text-sm tracking-[0.16em] text-cyan-200">
                                {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                            </div>
                            <button
                                type="button"
                                className="cosimo-button h-11 rounded-2xl px-4 text-[11px] uppercase tracking-[0.18em]"
                                onClick={onToggleLoop}
                            >
                                {msegState.playback.loop ? "Looping" : "One Shot"}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-slate-300/70">
                    Loading MSEG state…
                </div>
            )}
        </section>
    );
}
