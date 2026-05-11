import {
    type ReactNode,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";

import type { PatchControlBinding } from "./patch-controls";
import { useSliderDrag } from "./use-slider-drag";
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
    renderMsegShape,
    sampleRenderedMsegBuffer,
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
    filterCutoffHzToNormalized,
    filterQToNormalized,
    normalizedToFilterCutoffHz,
    normalizedToFilterQ,
} from "./filter-response";
import {
    advanceFilterSpectrumDisplayState,
    buildFilterSpectrumBands,
    buildFilterSpectrumDbTicks,
    buildFilterSpectrumFrequencyTicks,
    buildFilterSpectrumGraphPoints,
    buildFilterSpectrumRenderGeometry,
    createFilterSpectrumDisplayFrame,
    type FilterSpectrumRenderGeometry,
    type FilterSpectrumRenderMode,
    type FilterSpectrumDisplayState,
    type FilterSpectrumFrame,
} from "./filter-spectrum";
import {
    composeModulationAmount,
    formatModulationAmountReadout,
    getModulationAmountDepth,
    getModulationAmountPercentLabel,
    getModulationAmountSliderPosition,
    getModulationTargetClampHint,
    type ModulationPolarity,
    type ModulationTargetKind,
} from "./modulation";

export type VoiceModeOption = {
    value: number;
    label: string;
};

export const VOICE_MODE_OPTIONS: VoiceModeOption[] = [
    { value: 0, label: "Poly" },
    { value: 1, label: "Mono" },
    { value: 2, label: "Legato" },
];
export const SYNTH_GRID_CARD_SIZE_CLASS = "aspect-[50/27] min-h-[240px]";
export const SYNTH_GRID_CARD_SHELL_CLASS = "synth-grid-card-shell relative min-h-0 overflow-hidden rounded-[14px]";
export const SYNTH_GRID_CARD_INSET_SHADOW_CLASS = "synth-grid-card-inset";
export const SYNTH_COMPACT_CONTROL_CHROME_CLASS = "synth-compact-control rounded-[5px]";
export const SYNTH_COMPACT_CONTROL_TEXT_CLASS = "synth-compact-control-text";
const MSEG_GRID_STEPS = [0.25, 0.5, 0.75] as const;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
const MSEG_PREVIEW_VERTICAL_PADDING_PX = 22;
const MOD_KNOB_VIEWBOX_SIZE = 72;
const MOD_KNOB_CENTER = MOD_KNOB_VIEWBOX_SIZE / 2;
const MOD_KNOB_RADIUS = 30;
const MOD_KNOB_SIDE_SWEEP_DEGREES = 132;

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
    dataRole?: string;
};

export type ModulationAmountFieldProps = {
    targetKind: ModulationTargetKind;
    polarity: ModulationPolarity;
    amount: number;
    onChange: (nextAmount: number) => void;
    onPolarityChange: (nextPolarity: ModulationPolarity) => void;
    knobAriaLabel: string;
    polarityAriaLabel: string;
    className?: string;
};

function polarPointFromTop(center: number, radius: number, degreesFromTop: number) {
    const radians = ((degreesFromTop - 90) * Math.PI) / 180;

    return {
        x: center + (radius * Math.cos(radians)),
        y: center + (radius * Math.sin(radians)),
    };
}

function describeArcPath(
    center: number,
    radius: number,
    startDegreesFromTop: number,
    endDegreesFromTop: number,
) {
    const start = polarPointFromTop(center, radius, startDegreesFromTop);
    const end = polarPointFromTop(center, radius, endDegreesFromTop);
    const largeArcFlag = Math.abs(endDegreesFromTop - startDegreesFromTop) > 180 ? 1 : 0;
    const sweepFlag = endDegreesFromTop >= startDegreesFromTop ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

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
    onTablePrewarm: () => void;
    onRetry: () => void;
    tableFocusBindings: SynthFocusBindings;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    bottomLeftAccessory?: ReactNode;
    bottomRightAccessory?: ReactNode;
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
    spectrumRenderMode?: FilterSpectrumRenderMode;
    resonanceNormalizedFromQ?: (qValue: number) => number;
    resonanceQFromSurface?: (surfaceValue: number) => number;
    resonanceCurveDebugState?: {
        familyId: string;
        coefficients: Record<string, number>;
    };
    onGestureStart?: () => void;
    onGestureEnd?: () => void;
    onCutoffSet: (nextValue: number) => void;
    onQSet: (nextValue: number) => void;
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

function buildMsegMorphCurvePath(
    shapeAPoints: Array<{ x: number; y: number; curvePower: number }> | null | undefined,
    shapeBPoints: Array<{ x: number; y: number; curvePower: number }> | null | undefined,
    morphValue: number | null | undefined,
    width: number,
    height: number,
    options: {
        orientation?: MsegSurfaceOrientation;
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    if (!shapeAPoints || !shapeBPoints || width <= 1 || height <= 1) {
        return "";
    }

    try {
        const bufferA = renderMsegShape({ points: shapeAPoints });
        const bufferB = renderMsegShape({ points: shapeBPoints });
        const morph = clamp(Number(morphValue) || 0, 0, 1);
        const metrics = createMsegEditorMetrics(width, height, {
            pointRadius: options.pointRadius,
            horizontalPadding: options.horizontalPadding ?? MSEG_EDITOR_HORIZONTAL_PADDING_PX,
            verticalPadding: options.verticalPadding ?? MSEG_EDITOR_VERTICAL_PADDING_PX,
        });
        const sampleCount = Math.max(48, Math.min(192, Math.round(metrics.plotWidth / 3)));
        const polyline = Array.from({ length: sampleCount }, (_, sampleIndex) => {
            const x = sampleIndex / Math.max(1, sampleCount - 1);
            const valueA = sampleRenderedMsegBuffer(bufferA, x);
            const valueB = sampleRenderedMsegBuffer(bufferB, x);
            const y = clamp(valueA + ((valueB - valueA) * morph), 0, 1);
            return pointToMsegEditorCoordinates({ x, y }, width, height, options);
        });

        return polylineToSvgPath(polyline);
    } catch {
        return "";
    }
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
    referencePoints = null,
    morphShapeAPoints = null,
    morphShapeBPoints = null,
    morphValue = null,
    showMorphCurve = false,
    orientation = "horizontal",
    className,
    progressFillEnd = null,
}: {
    points: Array<{ x: number; y: number; curvePower: number }>;
    referencePoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeAPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeBPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphValue?: number | null;
    showMorphCurve?: boolean;
    orientation?: MsegSurfaceOrientation;
    className?: string;
    progressFillEnd?: number | null;
}) {
    const viewportRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const clipPathId = useId().replace(/:/g, "_");

    const { curvePath, fillPath, referenceCurvePath, referenceFillPath, morphCurvePath, metrics } = useMemo(() => {
        const basePaths = buildMsegSurfacePaths(points, size.width, size.height, {
            orientation,
            pointRadius: 0,
            horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
            verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
        });
        const referencePaths = referencePoints
            ? buildMsegSurfacePaths(referencePoints, size.width, size.height, {
                orientation,
                pointRadius: 0,
                horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
                verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
            })
            : null;
        const nextMorphCurvePath = showMorphCurve
            ? buildMsegMorphCurvePath(morphShapeAPoints, morphShapeBPoints, morphValue, size.width, size.height, {
                orientation,
                pointRadius: 0,
                horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
                verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
            })
            : "";

        return {
            ...basePaths,
            referenceCurvePath: referencePaths?.curvePath ?? "",
            referenceFillPath: referencePaths?.fillPath ?? "",
            morphCurvePath: nextMorphCurvePath,
        };
    }, [morphShapeAPoints, morphShapeBPoints, morphValue, orientation, points, referencePoints, showMorphCurve, size.height, size.width]);
    const clampedProgressFillEnd = progressFillEnd !== null
        && progressFillEnd !== undefined
        && Number.isFinite(Number(progressFillEnd))
        ? clamp(Number(progressFillEnd), 0, 1)
        : null;
    const progressClipRect = useMemo(() => {
        if (clampedProgressFillEnd === null) {
            return null;
        }

        if (orientation === "vertical") {
            return {
                x: metrics.plotLeft,
                y: metrics.plotTop,
                width: metrics.plotWidth,
                height: metrics.plotHeight * clampedProgressFillEnd,
            };
        }

        return {
            x: metrics.plotLeft,
            y: metrics.plotTop,
            width: metrics.plotWidth * clampedProgressFillEnd,
            height: metrics.plotHeight,
        };
    }, [clampedProgressFillEnd, metrics.plotHeight, metrics.plotLeft, metrics.plotTop, metrics.plotWidth, orientation]);

    return (
        <svg
            ref={viewportRef}
            data-role="mseg-preview-surface"
            className={className ?? "h-32 w-full overflow-hidden rounded-[20px] bg-white/[0.03]"}
            viewBox={`0 0 ${size.width} ${size.height}`}
        >
            <defs>
                {progressClipRect ? (
                    <clipPath id={clipPathId}>
                        <rect
                            data-role="mseg-preview-progress-clip"
                            x={progressClipRect.x}
                            y={progressClipRect.y}
                            width={progressClipRect.width}
                            height={progressClipRect.height}
                        />
                    </clipPath>
                ) : null}
            </defs>
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
            {referenceFillPath ? (
                <path className="cosimo-reference-curve-fill" d={referenceFillPath} />
            ) : null}
            {referenceCurvePath ? (
                <path className="cosimo-reference-curve-line" d={referenceCurvePath} />
            ) : null}
            <path className="cosimo-curve-fill" d={fillPath} />
            {progressClipRect ? (
                <g clipPath={`url(#${clipPathId})`}>
                    <path
                        className="cosimo-curve-fill cosimo-curve-fill-progress"
                        d={fillPath}
                        data-role="mseg-preview-progress-fill"
                    />
                </g>
            ) : null}
            <path className="cosimo-curve-line" d={curvePath} />
            {morphCurvePath ? (
                <path
                    data-role="mseg-preview-morph-curve"
                    className="cosimo-mseg-effective-curve-line"
                    d={morphCurvePath}
                />
            ) : null}
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
    referencePoints = null,
    morphShapeAPoints = null,
    morphShapeBPoints = null,
    morphValue = null,
    showMorphCurve = false,
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
    referencePoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeAPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeBPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphValue?: number | null;
    showMorphCurve?: boolean;
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

    const { curvePath, fillPath, referenceCurvePath, referenceFillPath, morphCurvePath, highlightedSegmentPath, metrics } = useMemo(() => {
        const basePaths = buildMsegSurfacePaths(points, size.width, size.height, {
            orientation,
        });
        const referencePaths = referencePoints
            ? buildMsegSurfacePaths(referencePoints, size.width, size.height, { orientation })
            : null;
        const nextMorphCurvePath = showMorphCurve
            ? buildMsegMorphCurvePath(morphShapeAPoints, morphShapeBPoints, morphValue, size.width, size.height, { orientation })
            : "";
        const nextHighlightedSegmentPath = emphasizedSegmentIndex >= 0
            ? buildMsegSegmentPath(points, emphasizedSegmentIndex, size.width, size.height, { orientation })
            : "";

        return {
            ...basePaths,
            referenceCurvePath: referencePaths?.curvePath ?? "",
            referenceFillPath: referencePaths?.fillPath ?? "",
            morphCurvePath: nextMorphCurvePath,
            highlightedSegmentPath: nextHighlightedSegmentPath,
        };
    }, [emphasizedSegmentIndex, morphShapeAPoints, morphShapeBPoints, morphValue, orientation, points, referencePoints, showMorphCurve, size.height, size.width]);

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
            {referenceFillPath ? (
                <path
                    data-role="mseg-reference-fill"
                    className="cosimo-reference-curve-fill"
                    d={referenceFillPath}
                />
            ) : null}
            {referenceCurvePath ? (
                <path
                    data-role="mseg-reference-curve"
                    className="cosimo-reference-curve-line"
                    d={referenceCurvePath}
                />
            ) : null}
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
            {morphCurvePath ? (
                <path
                    data-role="mseg-effective-curve"
                    className="cosimo-mseg-effective-curve-line"
                    d={morphCurvePath}
                />
            ) : null}
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
    dataRole,
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
                    data-role={dataRole}
                    aria-label={ariaLabel ?? label}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onChange={(event) => onChange(Number(event.target.value))}
                    {...focusBindings}
                />
                <div className="synth-readout-text text-right text-sm">
                    {displayValue}
                </div>
            </div>
        </label>
    );
}

export function ModulationAmountField({
    targetKind,
    polarity,
    amount,
    onChange,
    onPolarityChange,
    knobAriaLabel,
    polarityAriaLabel,
    className,
}: ModulationAmountFieldProps) {
    const depth = getModulationAmountDepth(targetKind, amount);
    const knobPosition = getModulationAmountSliderPosition(targetKind, amount);
    const depthLabel = getModulationAmountPercentLabel(targetKind, amount);
    const unitReadout = formatModulationAmountReadout(targetKind, amount, polarity);
    const clampHint = getModulationTargetClampHint(targetKind);
    const knobIndicatorDegrees = (knobPosition - 0.5) * (MOD_KNOB_SIDE_SWEEP_DEGREES * 2);
    const knobFillExtentDegrees = Math.abs(knobIndicatorDegrees);
    const knobTrackPath = useMemo(
        () => describeArcPath(MOD_KNOB_CENTER, MOD_KNOB_RADIUS, -MOD_KNOB_SIDE_SWEEP_DEGREES, MOD_KNOB_SIDE_SWEEP_DEGREES),
        [],
    );
    const knobFillPath = useMemo(() => {
        if (knobFillExtentDegrees <= 0.0001) {
            return null;
        }

        if (polarity === "bipolar") {
            return describeArcPath(
                MOD_KNOB_CENTER,
                MOD_KNOB_RADIUS,
                -knobFillExtentDegrees,
                knobFillExtentDegrees,
            );
        }

        if (knobIndicatorDegrees < 0) {
            return describeArcPath(
                MOD_KNOB_CENTER,
                MOD_KNOB_RADIUS,
                knobIndicatorDegrees,
                0,
            );
        }

        return describeArcPath(
            MOD_KNOB_CENTER,
            MOD_KNOB_RADIUS,
            0,
            knobIndicatorDegrees,
        );
    }, [knobFillExtentDegrees, knobIndicatorDegrees, polarity]);
    const shellClassName = className ? `cosimo-mod-amount-field ${className}` : "cosimo-mod-amount-field";

    return (
        <div className={shellClassName}>
            <div className="cosimo-mod-direction-toggle" role="group" aria-label={polarityAriaLabel}>
                <button
                    type="button"
                    aria-label={`${polarityAriaLabel} unipolar`}
                    aria-pressed={polarity === "unipolar" ? "true" : "false"}
                    className="cosimo-mod-direction-button"
                    data-active={polarity === "unipolar" ? "true" : "false"}
                    onClick={() => onPolarityChange("unipolar")}
                >
                    +
                </button>
                <button
                    type="button"
                    aria-label={`${polarityAriaLabel} bipolar`}
                    aria-pressed={polarity === "bipolar" ? "true" : "false"}
                    className="cosimo-mod-direction-button"
                    data-active={polarity === "bipolar" ? "true" : "false"}
                    onClick={() => onPolarityChange("bipolar")}
                >
                    ±
                </button>
            </div>

            <div className="cosimo-mod-knob-stack">
                <div className="cosimo-mod-knob" title={clampHint} data-polarity={polarity}>
                    <div className="cosimo-mod-knob-track">
                        <svg className="cosimo-mod-knob-arc" viewBox={`0 0 ${MOD_KNOB_VIEWBOX_SIZE} ${MOD_KNOB_VIEWBOX_SIZE}`} aria-hidden="true">
                            <path
                                d={knobTrackPath}
                                className="cosimo-mod-knob-arc-track"
                                pathLength="1"
                            />
                            {knobFillPath ? (
                                <path
                                    d={knobFillPath}
                                    className="cosimo-mod-knob-arc-fill"
                                    pathLength="1"
                                />
                            ) : null}
                        </svg>
                        <div className="cosimo-mod-knob-core">
                            <div className="cosimo-mod-knob-percent">{depthLabel}</div>
                        </div>
                        <div className="cosimo-mod-knob-center-marker" />
                        <div
                            className="cosimo-mod-knob-indicator"
                            style={{ transform: `translateX(-50%) rotate(${knobIndicatorDegrees}deg)` }}
                        />
                    </div>
                    <input
                        className="cosimo-mod-knob-input"
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        aria-label={knobAriaLabel}
                        value={knobPosition.toFixed(3)}
                        onChange={(event) => onChange(composeModulationAmount(targetKind, Number(event.target.value)))}
                    />
                </div>

                <div className="cosimo-mod-amount-copy" title={clampHint}>
                    <span className="cosimo-mod-amount-readout">{unitReadout}</span>
                    <span className="cosimo-mod-amount-caption">Requested</span>
                </div>
            </div>
        </div>
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
    geometry,
}: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    geometry: FilterSpectrumRenderGeometry;
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

    const accentRgb = window.getComputedStyle(canvas).getPropertyValue("--section-accent-rgb")
        .trim()
        .split(/\s+/)
        .map((component) => Number.parseInt(component, 10));
    const [accentR, accentG, accentB] = accentRgb.length === 3 && accentRgb.every(Number.isFinite)
        ? accentRgb
        : [169, 140, 255];
    const accentColor = (alpha: number) => `rgba(${accentR}, ${accentG}, ${accentB}, ${alpha})`;
    const gradient = context.createLinearGradient(0, geometry.plotTop, 0, geometry.plotBottom);
    gradient.addColorStop(0, accentColor(0.14));
    gradient.addColorStop(1, accentColor(0.00));

    if (geometry.kind === "graph") {
        if (geometry.points.length === 0) {
            return;
        }

        context.beginPath();
        context.moveTo(geometry.points[0].x, geometry.plotBottom);

        for (const point of geometry.points) {
            context.lineTo(point.x, point.y);
        }

        context.lineTo(geometry.points[geometry.points.length - 1].x, geometry.plotBottom);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        for (let index = 0; index < geometry.points.length; index += 1) {
            const point = geometry.points[index];
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        }
        context.strokeStyle = accentColor(0.64);
        context.lineWidth = 1.9;
        context.stroke();

        context.beginPath();
        for (let index = 0; index < geometry.peakPoints.length; index += 1) {
            const point = geometry.peakPoints[index];
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        }

        context.strokeStyle = accentColor(0.30);
        context.lineWidth = 1;
        context.stroke();
        return;
    }

    const drawBarPath = (x: number, y: number, barWidth: number, barHeight: number, radius: number) => {
        const right = x + barWidth;
        const bottom = y + barHeight;
        const safeRadius = Math.max(0, Math.min(radius, barWidth * 0.5, barHeight * 0.5));
        context.beginPath();
        context.moveTo(x, bottom);
        context.lineTo(x, y + safeRadius);
        if (safeRadius > 0) {
            context.quadraticCurveTo(x, y, x + safeRadius, y);
            context.lineTo(right - safeRadius, y);
            context.quadraticCurveTo(right, y, right, y + safeRadius);
        } else {
            context.lineTo(x, y);
            context.lineTo(right, y);
        }
        context.lineTo(right, bottom);
        context.closePath();
    };

    for (const bar of geometry.bars) {
        if (bar.height <= 0 || bar.width <= 0) {
            continue;
        }

        drawBarPath(bar.x, bar.y, bar.width, bar.height, bar.radius);
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = accentColor(0.56);
        context.lineWidth = geometry.rounded ? 1.45 : 1.1;
        context.stroke();
    }

    context.beginPath();
    for (const peakBar of geometry.peakBars) {
        if (peakBar.width <= 0) {
            continue;
        }

        const centerX = peakBar.x + (peakBar.width * 0.5);
        const halfWidth = Math.min(5, peakBar.width * 0.45);
        context.moveTo(centerX - halfWidth, peakBar.y);
        context.lineTo(centerX + halfWidth, peakBar.y);
    }
    context.strokeStyle = accentColor(0.32);
    context.lineWidth = 1;
    context.stroke();
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
    spectrumRenderMode = "graph",
    resonanceNormalizedFromQ = filterQToNormalized,
    resonanceQFromSurface = normalizedToFilterQ,
    resonanceCurveDebugState = {
        familyId: "linear",
        coefficients: {},
    },
    onGestureStart,
    onGestureEnd,
    onCutoffSet,
    onQSet,
    className,
}: FilterResponseGraphProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const [activePointerId, setActivePointerId] = useState<number | null>(null);
    const dragStateRef = useRef<{
        pointerId: number;
        startClientX: number;
        startClientY: number;
        pointerOffsetX: number;
        pointerOffsetY: number;
        hasMoved: boolean;
    } | null>(null);
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
    const spectrumGraphPoints = useMemo(() => buildFilterSpectrumGraphPoints(), []);
    const spectrumFrequencyTicks = useMemo(() => buildFilterSpectrumFrequencyTicks(), []);
    const spectrumDbTicks = useMemo(() => buildFilterSpectrumDbTicks(), []);
    const [spectrumDisplay, setSpectrumDisplay] = useState<FilterSpectrumDisplayState | null>(null);

    useEffect(() => {
        const nextFrame = createFilterSpectrumDisplayFrame({
            frame: spectrumFrame,
            bands: spectrumBands,
            graphPoints: spectrumGraphPoints,
        });

        if (!nextFrame) {
            return;
        }

        setSpectrumDisplay((previousState) => (
            advanceFilterSpectrumDisplayState(previousState, nextFrame, performance.now())
        ));
    }, [spectrumBands, spectrumFrame, spectrumGraphPoints]);

    const spectrumGeometry = useMemo(() => (
        spectrumDisplay
            ? buildFilterSpectrumRenderGeometry({
                renderMode: spectrumRenderMode,
                width: size.width,
                height: size.height,
                displayState: spectrumDisplay,
            })
            : null
    ), [size.height, size.width, spectrumDisplay, spectrumRenderMode]);

    useEffect(() => {
        const canvas = spectrumCanvasRef.current;

        if (!canvas) {
            return;
        }

        let animationFrameID = window.requestAnimationFrame(() => {
            if (!spectrumGeometry) {
                const context = canvas.getContext("2d");
                if (context) {
                    const devicePixelRatio = window.devicePixelRatio || 1;
                    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
                    context.clearRect(0, 0, size.width, size.height);
                }
                return;
            }

            drawFilterSpectrumOverlay({
                canvas,
                width: size.width,
                height: size.height,
                geometry: spectrumGeometry,
            });
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [size.height, size.width, spectrumGeometry]);

    const baseHandle = useMemo(() => {
        const cutoffNormalized = filterCutoffHzToNormalized(baseModel.cutoffHz);
        const qNormalized = clamp(resonanceNormalizedFromQ(baseModel.q), 0, 1);

        return {
            cutoffNormalized,
            qNormalized,
            x: basePath.plotLeft + (basePath.plotWidth * cutoffNormalized),
            y: basePath.plotBottom - (basePath.plotHeight * qNormalized),
        };
    }, [baseModel, basePath, resonanceNormalizedFromQ]);

    const applyHandlePointerPosition = (clientX: number, clientY: number) => {
        const surface = surfaceRef.current;
        const dragState = dragStateRef.current;

        if (!surface || !dragState) {
            return;
        }

        const bounds = surface.getBoundingClientRect();
        const handleClientX = clientX - dragState.pointerOffsetX;
        const handleClientY = clientY - dragState.pointerOffsetY;
        const plotX = clamp(handleClientX - bounds.left, basePath.plotLeft, basePath.plotRight);
        const plotY = clamp(handleClientY - bounds.top, basePath.plotTop, basePath.plotBottom);
        const nextCutoffNormalized = clamp(
            (plotX - basePath.plotLeft) / Math.max(1, basePath.plotWidth),
            0,
            1,
        );
        const nextQNormalized = clamp(
            1 - ((plotY - basePath.plotTop) / Math.max(1, basePath.plotHeight)),
            0,
            1,
        );

        onCutoffSet(clamp(normalizedToFilterCutoffHz(nextCutoffNormalized), FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ));
        onQSet(clamp(resonanceQFromSurface(nextQNormalized), FILTER_Q_MIN, FILTER_Q_MAX));
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

        if (dragState?.hasMoved) {
            onGestureEnd?.();
        }

        dragStateRef.current = null;
        setActivePointerId(null);
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
        handle: {
            x: baseHandle.x,
            y: baseHandle.y,
            cutoffNormalized: baseHandle.cutoffNormalized,
            qNormalized: baseHandle.qNormalized,
            isDragging: activePointerId !== null,
        },
        resonanceCurve: resonanceCurveDebugState,
        plot: {
            left: basePath.plotLeft,
            right: basePath.plotRight,
            top: basePath.plotTop,
            bottom: basePath.plotBottom,
            width: basePath.plotWidth,
            height: basePath.plotHeight,
        },
        spectrum: spectrumDisplay ? {
            hasSpectrum: true,
            renderMode: spectrumRenderMode,
            sampleRateHz: spectrumDisplay.sampleRateHz,
            sourceBinCount: spectrumDisplay.sourceBinCount,
            bandCount: spectrumDisplay.bands.length,
            graphPointCount: spectrumDisplay.graphPoints.length,
            peakBandIndex: spectrumDisplay.peakBandIndex,
            peakGraphPointIndex: spectrumDisplay.peakGraphPointIndex,
            bandMagnitudesDb: spectrumDisplay.bandMagnitudesDb,
            smoothedMagnitudesDb: spectrumDisplay.smoothedMagnitudesDb,
            peakMagnitudesDb: spectrumDisplay.peakMagnitudesDb,
            renderGeometry: spectrumGeometry ? (
                spectrumGeometry.kind === "graph"
                    ? {
                        kind: "graph",
                        pointCount: spectrumGeometry.pointCount,
                        peakPointCount: spectrumGeometry.peakPointCount,
                    }
                    : {
                        kind: "bars",
                        barCount: spectrumGeometry.barCount,
                        rounded: spectrumGeometry.rounded,
                    }
            ) : null,
            frequencyTicks: spectrumDisplay.frequencyTicks,
            dbTicks: spectrumDisplay.dbTicks,
        } : {
            hasSpectrum: false,
            renderMode: spectrumRenderMode,
            sampleRateHz: null,
            sourceBinCount: 0,
            bandCount: spectrumBands.length,
            graphPointCount: spectrumGraphPoints.length,
            peakBandIndex: -1,
            peakGraphPointIndex: -1,
            bandMagnitudesDb: [],
            smoothedMagnitudesDb: [],
            peakMagnitudesDb: [],
            renderGeometry: null,
            frequencyTicks: spectrumFrequencyTicks,
            dbTicks: spectrumDbTicks,
        },
    }), [
        baseModel,
        baseHandle,
        liveHasActive,
        liveModel,
        activePointerId,
        spectrumBands.length,
        spectrumDbTicks,
        spectrumDisplay,
        spectrumFrequencyTicks,
        spectrumGeometry,
        spectrumGraphPoints.length,
        spectrumRenderMode,
        resonanceCurveDebugState,
    ]);

    const visibleFrequencyTicks = useMemo(() => {
        if (size.width <= 360) {
            return spectrumFrequencyTicks.filter((_, index) => [0, 2, 4, 6, 9].includes(index));
        }

        if (size.width <= 480) {
            return spectrumFrequencyTicks.filter((_, index) => [0, 1, 2, 4, 6, 8, 9].includes(index));
        }

        return spectrumFrequencyTicks;
    }, [size.width, spectrumFrequencyTicks]);

    const visibleDbTicks = useMemo(() => {
        if (size.width <= 360) {
            return spectrumDbTicks.filter((_, index) => [0, 2, 4].includes(index));
        }

        if (size.width <= 480) {
            return spectrumDbTicks.filter((_, index) => [0, 1, 2, 4].includes(index));
        }

        return spectrumDbTicks;
    }, [size.width, spectrumDbTicks]);

    return (
        <div className={joinClasses("relative h-full w-full", className)}>
            <div
                ref={viewportRef}
                className="synth-display-recess relative h-full w-full overflow-hidden rounded-[24px]"
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
                    onPointerMove={(event) => {
                        const dragState = dragStateRef.current;

                        if (!dragState || dragState.pointerId !== event.pointerId) {
                            return;
                        }

                        const deltaX = event.clientX - dragState.startClientX;
                        const deltaY = event.clientY - dragState.startClientY;

                        if (!dragState.hasMoved && Math.abs(deltaX) < 1.5 && Math.abs(deltaY) < 1.5) {
                            return;
                        }

                        if (!dragState.hasMoved) {
                            dragState.hasMoved = true;
                            onGestureStart?.();
                        }
                        applyHandlePointerPosition(event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                        endDrag(event.pointerId);
                    }}
                    onPointerCancel={(event) => {
                        endDrag(event.pointerId);
                    }}
                >
                    {visibleDbTicks.map((tick) => (
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
                    {visibleFrequencyTicks.map((tick) => (
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
                    {visibleDbTicks.map((tick) => (
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
                    {visibleFrequencyTicks.map((tick) => (
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
                    <path d={basePath.path} fill="none" stroke="rgb(var(--section-accent-rgb) / 0.36)" strokeWidth="2" />
                    <path
                        d={livePath.path}
                        fill="none"
                        stroke={liveHasActive ? "rgb(var(--section-accent-rgb) / 0.98)" : "rgb(var(--section-accent-rgb) / 0.72)"}
                        strokeWidth={liveHasActive ? "3" : "2"}
                    />
                    <line
                        x1={baseHandle.x}
                        x2={baseHandle.x}
                        y1={basePath.plotBottom}
                        y2={baseHandle.y}
                        stroke="rgb(var(--section-accent-rgb) / 0.20)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        pointerEvents="none"
                    />
                    <circle
                        data-role="filter-response-handle-hit-target"
                        cx={baseHandle.x}
                        cy={baseHandle.y}
                        r="18"
                        fill="transparent"
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            surfaceRef.current?.setPointerCapture(event.pointerId);
                            const bounds = surfaceRef.current?.getBoundingClientRect();
                            dragStateRef.current = {
                                pointerId: event.pointerId,
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                pointerOffsetX: bounds ? event.clientX - (bounds.left + baseHandle.x) : 0,
                                pointerOffsetY: bounds ? event.clientY - (bounds.top + baseHandle.y) : 0,
                                hasMoved: false,
                            };
                            setActivePointerId(event.pointerId);
                        }}
                    />
                    <circle
                        cx={baseHandle.x}
                        cy={baseHandle.y}
                        r="15"
                        fill="rgb(var(--section-accent-rgb) / 0.16)"
                        stroke="rgb(var(--section-accent-rgb) / 0.24)"
                        strokeWidth="1"
                        pointerEvents="none"
                    />
                    <circle
                        data-role="filter-response-handle"
                        cx={baseHandle.x}
                        cy={baseHandle.y}
                        r="10.5"
                        fill="var(--section-accent)"
                        stroke="rgb(255 255 255 / 0.42)"
                        strokeWidth="1.6"
                        pointerEvents="none"
                    />
                    <path
                        d={`M ${baseHandle.x.toFixed(2)} ${(baseHandle.y - 4).toFixed(2)} L ${baseHandle.x.toFixed(2)} ${(baseHandle.y + 4).toFixed(2)} M ${(baseHandle.x - 4).toFixed(2)} ${baseHandle.y.toFixed(2)} L ${(baseHandle.x + 4).toFixed(2)} ${baseHandle.y.toFixed(2)}`}
                        stroke="rgba(5, 9, 19, 0.72)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        pointerEvents="none"
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
                    "synth-control-rail inline-grid gap-1 rounded-[18px] p-1",
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
                                    ? "bg-[rgb(var(--section-accent-rgb)/0.12)] text-[var(--section-accent)]"
                                    : "text-slate-300/70 hover:bg-[rgb(var(--section-accent-rgb)/0.05)] hover:text-slate-100"
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
            "grid gap-3 rounded-[22px] border border-white/[0.05] bg-white/[0.025] px-4 py-3",
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
        <section
            data-section-accent="lime"
            data-liquid-detail="edge-rail"
            className={joinClasses("relative grid gap-3", className)}
        >
            <div className={joinClasses(
                "synth-control-rail flex flex-col items-center justify-end gap-2 rounded-[22px] px-2 py-3",
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
                <div className="synth-readout-text text-[10px] opacity-70">
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
    onTablePrewarm,
    onRetry,
    tableFocusBindings,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    bottomLeftAccessory,
    bottomRightAccessory,
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
            data-role="wavetable-card"
            data-layout-card="desktop-grid-card"
            data-section-accent="cyan"
            data-liquid-detail="display-lip"
            className={joinClasses(
                "cosimo-stage border",
                SYNTH_GRID_CARD_SHELL_CLASS,
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

            <div
                data-role="wavetable-stage-top-controls"
                className="synth-display-lip-controls text-[8px] uppercase tracking-[0.10em]"
            >
                <label
                    className="relative inline-flex max-w-[128px] cursor-pointer items-center"
                    onFocus={onTablePrewarm}
                    onPointerEnter={onTablePrewarm}
                >
                    <div data-role="wavetable-select-chip" className={`inline-flex h-5 min-w-0 items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1.5 pr-5 text-left ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} synth-compact-control-value`}>
                        <span data-role="wavetable-stage-title" className="truncate">{tableName}</span>
                    </div>
                    <SelectChevron className="pointer-events-none absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[var(--section-accent)] opacity-70" />
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

                <div className="flex min-w-0 items-center gap-1">
                    <div data-role="wavetable-frame-chip" className={`flex h-5 items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1.5 ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} synth-compact-control-value`}>
                        Frame {formatFrameIndex(position, frameCount)}
                    </div>
                    <div data-role="wavetable-position-chip" className={`flex h-5 items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1.5 ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} synth-compact-control-value`}>
                        Pos {clampDisplayPosition(position).toFixed(3)}
                    </div>
                </div>
            </div>

            <div
                data-role="wavetable-stage-bottom-controls"
                className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 p-1"
            >
                <div className="flex min-w-0 items-end gap-1">
                    {bottomLeftAccessory}
                    {canRetry ? (
                        <button
                            type="button"
                            className="cosimo-button h-5 rounded-[5px] px-1.5 text-[8px] uppercase tracking-[0.10em] disabled:opacity-40"
                            disabled={!canRetry}
                            onClick={onRetry}
                        >
                            Retry Load
                        </button>
                    ) : null}
                </div>
                {bottomRightAccessory ? (
                    <div className="flex min-w-0 items-end justify-end gap-1">
                        {bottomRightAccessory}
                    </div>
                ) : null}
            </div>

            <pre data-role="wavetable-stage-debug" className="hidden">
                {JSON.stringify(debugState)}
            </pre>
        </section>
    );
}

export type VerticalSliderProps = {
    label: string;
    binding: PatchControlBinding<number>;
    min: number;
    max: number;
    bipolar?: boolean;
    fillClassName: string;
    handleClassName: string;
    fillDataRole?: string;
    handleDataRole?: string;
    inputDataRole?: string;
    trackDataRole?: string;
    formatValue?: (value: number) => string;
    onChange?: (normalized: number) => void;
    className?: string;
};

function defaultFormatValue(value: number, min: number, max: number): string {
    if (max <= 1 && min >= -1) {
        return `${Math.round(clamp(value, min, max) * 100)}`;
    }
    return value.toFixed(1);
}

export function VerticalSlider({
    label,
    binding,
    min,
    max,
    bipolar = false,
    fillClassName,
    handleClassName,
    fillDataRole,
    handleDataRole,
    inputDataRole,
    trackDataRole,
    formatValue,
    onChange,
    className,
}: VerticalSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const { handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useSliderDrag();

    const normalized = clamp((binding.value - min) / (max - min), 0, 1);
    const displayValue = formatValue ? formatValue(binding.value) : defaultFormatValue(binding.value, min, max);

    const fillStyle = bipolar
        ? normalized >= 0.5
            ? { bottom: "50%", height: `${(normalized - 0.5) * 100}%` }
            : { bottom: `${normalized * 100}%`, height: `${(0.5 - normalized) * 100}%` }
        : { height: `${normalized * 100}%` };

    return (
        <div className={`flex shrink-0 flex-col items-center gap-1 py-2 ${className ?? ""}`}>
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400/45">{label}</span>
            <div
                ref={trackRef}
                data-role={trackDataRole}
                className="relative w-1.5 flex-1 cursor-ns-resize rounded-full bg-white/[0.04]"
                onPointerDown={(e) => handlePointerDown(e, trackRef.current, binding, normalized, min, max, "vertical", onChange)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                {bipolar && (
                    <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-px bg-white/[0.12]" />
                )}
                <div
                    data-role={fillDataRole}
                    className={`${fillClassName} absolute bottom-0 left-0 right-0 rounded-full`}
                    style={fillStyle}
                />
                <div
                    data-role={handleDataRole}
                    className={`${handleClassName} absolute left-1/2 size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[rgba(3,5,12,0.7)]`}
                    style={{ bottom: `${normalized * 100}%` }}
                />
            </div>
            <span className="font-mono text-[8px] tracking-[0.04em] text-slate-200/55">{displayValue}</span>
            <input
                data-role={inputDataRole}
                type="range"
                min={min}
                max={max}
                step={0.001}
                value={binding.value}
                className="sr-only"
                tabIndex={-1}
                onInput={(event) => binding.setValue(Number(event.currentTarget.value))}
                onChange={(event) => binding.setValue(Number(event.currentTarget.value))}
            />
        </div>
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
                <div className="synth-section-title text-[11px]">MSEG</div>
                <div className="synth-readout-text text-sm">
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
                                    aria-label="MSEG depth"
                                    min="-1"
                                    max="1"
                                    step="0.001"
                                    value={Number(msegState.depth).toFixed(3)}
                                    onChange={(event) => onDepthChange(Number(event.target.value))}
                                    {...depthFocusBindings}
                                />
                            </div>
                            <div className="synth-readout-text text-right text-sm">
                                {Number(msegState.depth).toFixed(3)}
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-4">
                            <div className="grid gap-2">
                                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Rate</span>
                                <input
                                    className="cosimo-range"
                                    type="range"
                                    aria-label="MSEG rate"
                                    min={MSEG_RATE_MIN_SECONDS}
                                    max={MSEG_RATE_MAX_SECONDS}
                                    step="0.001"
                                    value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                                    onChange={(event) => onRateChange(Number(event.target.value))}
                                    {...rateFocusBindings}
                                />
                            </div>
                            <div className="synth-readout-text text-right text-sm">
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
