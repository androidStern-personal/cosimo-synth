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

import { Mseg, FilterEditor, type FilterSpectrumFrame, type FilterSpectrumRenderMode } from "../../kit/index";
import { responseModeToFilterMode } from "../../kit/ui/filter-editor";
import { buildMsegSurfacePaths } from "../../kit/ui/mseg-editor-geometry";

import type { PatchControlBinding } from "./patch-controls";
import { useSliderDrag } from "./use-slider-drag";
import { clampDisplayPosition } from "./runtime-table-state";
import {
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    clampMsegRateSeconds,
    sampleRenderedMsegBuffer,
    type MsegState,
} from "./mseg";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    createMsegEditorMetrics,
    pointToMsegEditorCoordinates,
    renderMsegShape,
    resolveMsegSurfaceOrientation,
    type MsegSurfaceOrientation,
    type MsegTimeAxisScale,
} from "../../kit/ui/mseg";
import { CanvasWavetableDisplay, type WavetableModulationRangeOverlay } from "./wavetable-display";
import type { SynthFocusBindings } from "./synth-input-router";
import { filterQToNormalized, normalizedToFilterQ } from "../../kit/ui/filter-response";
import { uiMediaTimeNow } from "./ui-media-clock";
import {
    composeModulationAmount,
    formatModulationAmountReadout,
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
export const SYNTH_GRID_CARD_SIZE_CLASS = "aspect-[50/27]";
export const SYNTH_GRID_CARD_SHELL_CLASS = "synth-grid-card-shell relative min-h-0 overflow-hidden rounded-[14px]";
export const SYNTH_GRID_CARD_INSET_SHADOW_CLASS = "synth-grid-card-inset";
export const SYNTH_COMPACT_CONTROL_CHROME_CLASS = "cosimo-control rounded-[5px]";
export const SYNTH_COMPACT_CONTROL_TEXT_CLASS = "cosimo-control-text";
const WAVETABLE_DRAWABLE_CONTROL_GAP_PX = 0;
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
    pendingTableName: string | null;
    frameCount: number;
    desiredTableIndex: number;
    tableOptions: FactoryTableOption[];
    tableSelectionReady: boolean;
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
    modulationTargetKind?: ModulationTargetKind;
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
    playModeReady?: boolean;
    onPlayModeChange: (nextValue: number) => void;
    playModeFocusBindings: SynthFocusBindings;
    glideControl: ReactNode;
    className?: string;
};

export type FilterTravelEndpointSide = "start" | "end" | "base";

/** Every travel grip, for drag lifecycle purposes. */
export type FilterTravelGestureSide = FilterTravelEndpointSide | "center";

export type FilterEndpointState = {
    readonly cutoffHz: number;
    readonly q: number;
};

/**
 * T04A: the armed source's modulation travel — the filter at source = 0
 * (start) and at full deflection (end) — drawn as the two response curves
 * with the swept region shaded in the source color. Renders only while the
 * armed source has at least one filter mapping (T07: color never implies a
 * mapping that does not exist). The start of a fully unipolar travel is the
 * base handle itself; only bipolar travel gets its own start handle.
 */
export type FilterModulationTravel = {
    readonly start: FilterEndpointState;
    readonly end: FilterEndpointState;
    readonly accent: string;
    readonly cutoffEditable: boolean;
    readonly qEditable: boolean;
    readonly showStartHandle: boolean;
    /**
     * "start": the base handle IS the travel start (a unipolar axis is
     * routed), so its drags pin the end and the dedicated center grip owns
     * translation. "translate": base is the travel center (bipolar-only
     * travel) and keeps its plain translate behavior.
     */
    readonly baseHandleMode: "translate" | "start";
    /** Render the dedicated center translate grip at the travel midpoint. */
    readonly centerHandle: boolean;
    /** Optional tracked Cutoff route language. The graph still needs Hz to
        draw, while this label exposes the actual semitone-offset contract. */
    readonly cutoffAmountLabel?: string;
    readonly cutoffRouteStorageAmount?: number;
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
    modulationTravel?: FilterModulationTravel | null;
    onTravelEndpointSet?: (side: FilterTravelEndpointSide, state: FilterEndpointState) => void;
    /**
     * Rigid screen-space translation from the center grip: both endpoints
     * moved by one pixel delta and re-read through the axis transfers. The
     * consumer re-derives base + amounts from the pair.
     */
    onTravelTranslate?: (start: FilterEndpointState, end: FilterEndpointState) => void;
    /** Bracket a travel drag: snapshot the fixed endpoint, open host gestures. */
    onTravelGestureStart?: (side: FilterTravelGestureSide) => void;
    onTravelGestureEnd?: () => void;
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

function useElementBottomInset<TContainer extends Element, TElement extends Element>(
    containerRef: RefObject<TContainer | null>,
    elementRef: RefObject<TElement | null>,
    extraGapPx = 0,
) {
    const [inset, setInset] = useState(0);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const element = elementRef.current;

        if (!container || !element) {
            return;
        }

        const update = () => {
            const containerBounds = container.getBoundingClientRect();
            const elementBounds = element.getBoundingClientRect();
            setInset(Math.ceil(Math.max(0, elementBounds.bottom - containerBounds.top + extraGapPx)));
        };

        const observer = new ResizeObserver(update);
        observer.observe(container);
        observer.observe(element);
        window.addEventListener("resize", update);
        update();

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [containerRef, elementRef, extraGapPx]);

    return inset;
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

function polylineToSvgPath(polyline: Array<{ x: number; y: number }>) {
    if (polyline.length === 0) {
        return "";
    }

    return polyline.map((point, pointIndex) => (
        `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`
    )).join(" ");
}


function buildMsegMorphSurfacePaths(
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
        return null;
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
        const curvePath = polylineToSvgPath(polyline);
        const fillPath = options.orientation === "vertical"
            ? `${curvePath} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
                `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotTop.toFixed(3)} Z`
            : `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
                `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`;

        return { curvePath, fillPath, metrics };
    } catch {
        return null;
    }
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
    editShapeIndex = 0,
    orientation = "horizontal",
    className,
    progressFillEnd = null,
}: {
    points: Array<{ x: number; y: number; curvePower: number }>;
    referencePoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeAPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeBPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphValue?: number | null;
    /** Shape identity controls color only; selection never swaps A/B colors. */
    editShapeIndex?: 0 | 1;
    orientation?: MsegSurfaceOrientation;
    className?: string;
    progressFillEnd?: number | null;
}) {
    const viewportRef = useRef<SVGSVGElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const clipPathId = useId().replace(/:/g, "_");

    const {
        curvePath,
        fillPath,
        referenceCurvePath,
        referenceFillPath,
        morphShapeACurvePath,
        morphShapeAFillPath,
        morphShapeBCurvePath,
        morphShapeBFillPath,
        metrics,
    } = useMemo(() => {
        const basePaths = buildMsegSurfacePaths(points, size.width, size.height, {
            orientation,
            pointRadius: 0,
            horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
            verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
        });
        const hasMorphReferenceShapes = Boolean(morphShapeAPoints && morphShapeBPoints);
        const referencePaths = referencePoints && !hasMorphReferenceShapes
            ? buildMsegSurfacePaths(referencePoints, size.width, size.height, {
                orientation,
                pointRadius: 0,
                horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
                verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
            })
            : null;
        const sharedPreviewPathOptions = {
            orientation,
            pointRadius: 0,
            horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
            verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
        };
        const shapeAReferencePaths = morphShapeAPoints
            ? buildMsegSurfacePaths(morphShapeAPoints, size.width, size.height, sharedPreviewPathOptions)
            : null;
        const shapeBReferencePaths = morphShapeBPoints
            ? buildMsegSurfacePaths(morphShapeBPoints, size.width, size.height, sharedPreviewPathOptions)
            : null;
        const effectiveMorphPaths = buildMsegMorphSurfacePaths(
            morphShapeAPoints,
            morphShapeBPoints,
            morphValue,
            size.width,
            size.height,
            {
                orientation,
                pointRadius: 0,
                horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
                verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX,
            },
        );

        return {
            ...(effectiveMorphPaths ?? basePaths),
            referenceCurvePath: referencePaths?.curvePath ?? "",
            referenceFillPath: referencePaths?.fillPath ?? "",
            morphShapeACurvePath: shapeAReferencePaths?.curvePath ?? "",
            morphShapeAFillPath: shapeAReferencePaths?.fillPath ?? "",
            morphShapeBCurvePath: shapeBReferencePaths?.curvePath ?? "",
            morphShapeBFillPath: shapeBReferencePaths?.fillPath ?? "",
        };
    }, [morphShapeAPoints, morphShapeBPoints, morphValue, orientation, points, referencePoints, size.height, size.width]);
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
    const editedShapeFillClass = editShapeIndex === 0
        ? "cosimo-mseg-shape-a-fill"
        : "cosimo-mseg-shape-b-fill";
    const editedShapeCurveClass = editShapeIndex === 0
        ? "cosimo-mseg-shape-a-curve-line"
        : "cosimo-mseg-shape-b-curve-line";
    const referenceShapeFillClass = editShapeIndex === 0
        ? "cosimo-mseg-shape-b-fill"
        : "cosimo-mseg-shape-a-fill";
    const referenceShapeCurveClass = editShapeIndex === 0
        ? "cosimo-mseg-shape-b-curve-line"
        : "cosimo-mseg-shape-a-curve-line";

    return (
        <svg
            ref={viewportRef}
            data-role="mseg-preview-surface"
            data-edit-shape={editShapeIndex === 0 ? "a" : "b"}
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
                <path
                    className={`cosimo-reference-curve-fill ${referenceShapeFillClass}`}
                    d={referenceFillPath}
                />
            ) : null}
            {referenceCurvePath ? (
                <path
                    className={`cosimo-reference-curve-line ${referenceShapeCurveClass}`}
                    d={referenceCurvePath}
                />
            ) : null}
            {morphShapeAFillPath ? (
                <path
                    data-role="mseg-preview-shape-a-fill"
                    className="cosimo-reference-curve-fill cosimo-mseg-shape-a-fill"
                    d={morphShapeAFillPath}
                />
            ) : null}
            {morphShapeBFillPath ? (
                <path
                    data-role="mseg-preview-shape-b-fill"
                    className="cosimo-reference-curve-fill cosimo-mseg-shape-b-fill"
                    d={morphShapeBFillPath}
                />
            ) : null}
            {morphShapeACurvePath ? (
                <path
                    data-role="mseg-preview-shape-a-curve"
                    className="cosimo-reference-curve-line cosimo-mseg-shape-a-curve-line"
                    d={morphShapeACurvePath}
                />
            ) : null}
            {morphShapeBCurvePath ? (
                <path
                    data-role="mseg-preview-shape-b-curve"
                    className="cosimo-reference-curve-line cosimo-mseg-shape-b-curve-line"
                    d={morphShapeBCurvePath}
                />
            ) : null}
            <path
                className={morphShapeAFillPath
                    ? "cosimo-curve-fill cosimo-mseg-realized-fill"
                    : `cosimo-curve-fill ${editedShapeFillClass}`}
                d={fillPath}
            />
            {progressClipRect ? (
                <g clipPath={`url(#${clipPathId})`}>
                    <path
                        className="cosimo-curve-fill cosimo-curve-fill-progress cosimo-mseg-realized-fill"
                        d={fillPath}
                        data-role="mseg-preview-progress-fill"
                    />
                </g>
            ) : null}
            <path
                data-role="mseg-preview-effective-curve"
                className={morphShapeACurvePath
                    ? "cosimo-curve-line cosimo-mseg-realized-curve-line"
                    : `cosimo-curve-line ${editedShapeCurveClass}`}
                d={curvePath}
            />
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
    drawableTopInset = 0,
    paintBackground = true,
    showSliceCaption = true,
    modulationRange = null,
}: {
    frames: Float32Array[] | null;
    position: number;
    warpMode: number;
    warpAmount: number;
    drawableTopInset?: number;
    /** ADR-024 compact seams; defaults preserve the established drawing. */
    paintBackground?: boolean;
    showSliceCaption?: boolean;
    /** T02C: the selected source's Index travel, shaded onto the graphic. */
    modulationRange?: WavetableModulationRangeOverlay | null;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const size = useResizeObserver(viewportRef);
    const displayRef = useRef<CanvasWavetableDisplay | null>(null);

    useLayoutEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        displayRef.current = new CanvasWavetableDisplay(canvasRef.current, {
            paintBackground,
            showSliceCaption,
        });
        return () => {
            displayRef.current = null;
        };
        // The render seams are a mount-time product decision per surface, not
        // live state; remounting for a changed seam is deliberate.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        displayRef.current?.setModulationRange(modulationRange);
    }, [modulationRange]);

    useEffect(() => {
        displayRef.current?.setDrawableInsets({ top: drawableTopInset });
    }, [drawableTopInset]);

    useEffect(() => {
        displayRef.current?.resize(size.width, size.height, window.devicePixelRatio || 1);
    }, [size]);

    return (
        <div ref={viewportRef} className="absolute inset-0">
            <canvas ref={canvasRef} className="h-full w-full" />
        </div>
    );
}

export type MsegCompositionBindings = { readonly editorKey: number } & Pick<Mseg.RootProps, "onValueChange" | "onGestureEnd"> &
    Pick<Mseg.SurfaceProps, "curveEditActivationMode" | "curveEditHoldDelayMs" | "onCurveEditHoldActivated">;
export function EditableMsegSurface({
    surfaceRef,
    value,
    composition,
    referencePoints = null,
    morphShapeAPoints = null,
    morphShapeBPoints = null,
    morphValue = null,
    realizedMorphEmphasis = "resting",
    playheadPosition = null,
    editShapeIndex = 0,
    orientation = "horizontal",
    timeAxisScale,
    onOrientationChange,
    className,
    dataRole,
}: {
    surfaceRef: RefObject<SVGSVGElement | null>;
    composition: MsegCompositionBindings;
    value: MsegState["shape"];
    referencePoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeAPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphShapeBPoints?: Array<{ x: number; y: number; curvePower: number }> | null;
    morphValue?: number | null;
    /** The realized A/B result is always present; active only changes its visual prominence. */
    realizedMorphEmphasis?: "resting" | "active";
    playheadPosition?: number | null;
    /** Shape identity controls color only; selection never swaps A/B colors. */
    editShapeIndex?: 0 | 1;
    orientation?: MsegSurfaceOrientation;
    timeAxisScale?: MsegTimeAxisScale;
    onOrientationChange?: (orientation: MsegSurfaceOrientation) => void;
    className?: string;
    dataRole?: string;
}) {
    const curve = useMemo<Mseg.Curve>(() => ({...value, format: "mseg.shape"}), [value]);
    const size = useResizeObserver(surfaceRef);
    useLayoutEffect(() => {
        const next = resolveMsegSurfaceOrientation(size.width, size.height, orientation);
        if (next !== orientation) onOrientationChange?.(next);
    }, [onOrientationChange, orientation, size.height, size.width]);
    const reference = useMemo(() => referencePoints ? {...curve, points: referencePoints} : null, [curve, referencePoints]);
    const morph = useMemo(() => {
        if (!morphShapeAPoints || !morphShapeBPoints || morphValue === null) return null;
        const a = new Float32Array(Mseg.sampleCount), b = new Float32Array(Mseg.sampleCount);
        Mseg.renderInto({...curve, points: morphShapeAPoints}, a); Mseg.renderInto({...curve, points: morphShapeBPoints}, b);
        return a.slice(1, -2).map((sample, index) => sample * (1 - morphValue) + b[index + 1] * morphValue);
    }, [curve, morphShapeAPoints, morphShapeBPoints, morphValue]);
    const shape = editShapeIndex === 0 ? "a" : "b";
    const other = editShapeIndex === 0 ? "b" : "a";
    return <Mseg.Root key={`${editShapeIndex}:${composition.editorKey}`} defaultSelection={{kind: "point", index: 0}} value={curve} onValueChange={composition.onValueChange} onGestureEnd={composition.onGestureEnd} style={{display: "contents"}}>
        <Mseg.Surface ref={surfaceRef} orientation={orientation} curveEditActivationMode={composition.curveEditActivationMode}
            curveEditHoldDelayMs={composition.curveEditHoldDelayMs} onCurveEditHoldActivated={composition.onCurveEditHoldActivated}
            className={joinClasses("h-full w-full touch-none overflow-hidden rounded-[20px] bg-white/[0.03]", className)}
            data-role={dataRole} data-morph-presentation={realizedMorphEmphasis === "active" ? "morph-active" : "edit-shape"} data-edit-shape={shape}
            aria-label="MSEG curve">
            <Mseg.Grid className="cosimo-grid-line" opacity={1}/>
            {reference && <><Mseg.Fill value={reference} data-role="mseg-reference-fill" data-shape-identity={other} className={`cosimo-reference-curve-fill cosimo-mseg-shape-${other}-fill`} fillOpacity={1}/>
                <Mseg.Line value={reference} data-role="mseg-reference-curve" data-shape-identity={other} className={`cosimo-reference-curve-line cosimo-mseg-shape-${other}-curve-line`}/></>}
            <Mseg.Fill data-role="mseg-base-fill" data-shape-identity={shape} className={`cosimo-curve-fill cosimo-mseg-shape-${shape}-fill`} fillOpacity={1}/>
            <Mseg.Line data-role="mseg-base-curve" data-shape-identity={shape} className={`cosimo-curve-line cosimo-mseg-shape-${shape}-curve-line`}/>
            {morph && <Mseg.Plot samples={morph} data-role="mseg-effective-curve" className={joinClasses("cosimo-mseg-effective-curve-line", realizedMorphEmphasis === "active" && "is-active")}/>}
            <Mseg.SegmentHighlight data-role="mseg-highlight-segment" className={`cosimo-curve-line cosimo-curve-line-highlight cosimo-mseg-shape-${shape}-curve-line`}/>
            <Mseg.Points data-role="mseg-edit-points" data-shape-identity={shape} renderPoint={({index, state, position, handleProps}) => <g {...handleProps} transform={undefined}>
                <circle data-role="mseg-point" data-point-index={index} data-point-state={state} cx={position.x} cy={position.y} r={state === "selected" ? 10 : 8}
                    className={state === "selected" ? "cosimo-mseg-point-selected" : state === "highlighted" ? "cosimo-mseg-point-highlight" : state === "muted" ? "cosimo-mseg-point-muted" : "cosimo-mseg-point-default"}/>
            </g>}/>
            <Mseg.Playhead position={playheadPosition} data-role="mod-source-mseg-playhead" data-progress={playheadPosition?.toFixed(3)} className="cosimo-mseg-playhead"/>
            {timeAxisScale && <Mseg.TimeAxis scale={timeAxisScale} data-role="mseg-time-axis" className="cosimo-mseg-time-axis"/>}
        </Mseg.Surface>
    </Mseg.Root>;
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
                <div className="cosimo-readout is-caps is-title text-right">
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

export function FilterResponseGraph(props: FilterResponseGraphProps) {
    const { modulationTravel: travel } = props;
    const base = { mode: props.baseMode, cutoffHz: props.baseCutoffHz, q: props.baseQ };
    // The desktop harness reads the base and live filter state the graph was given.
    const graphState = {
        base,
        live: props.liveHasActive
            ? { hasActive: true, mode: props.liveMode, cutoffHz: props.liveCutoffHz, q: props.liveQ }
            : { hasActive: false, ...base },
    };
    return <div className={joinClasses("cosimo-filter-editor relative h-full w-full", props.className)}
        data-role="cosimo-filter-editor"
        data-filter-graph={JSON.stringify(graphState)}
        data-resonance-curve={JSON.stringify(props.resonanceCurveDebugState ?? { familyId: "linear", coefficients: {} })}
        data-cutoff-route-storage={travel?.cutoffRouteStorageAmount}>
        <FilterEditor
            className="cosimo-filter-editor__control"
            value={{ mode: responseModeToFilterMode(props.baseMode), cutoffHz: props.baseCutoffHz, q: props.baseQ }}
            preview={props.liveHasActive ? { mode: responseModeToFilterMode(props.liveMode), cutoffHz: props.liveCutoffHz, q: props.liveQ } : null}
            plotPadding={{ horizontal: 18, top: 16, bottom: 16 }}
            qScale={{ qToSurface: props.resonanceNormalizedFromQ ?? filterQToNormalized,
                surfaceToQ: props.resonanceQFromSurface ?? normalizedToFilterQ }}
            spectrum={props.spectrumFrame ? { frame: props.spectrumFrame, renderMode: props.spectrumRenderMode,
                timestampMs: uiMediaTimeNow() } : null}
            onValueChange={(next) => { props.onCutoffSet(next.cutoffHz); props.onQSet(next.q); }}
            modulation={travel ? { start: travel.start, end: travel.end, color: travel.accent,
                axes: travel.cutoffEditable && travel.qEditable ? "both" : travel.qEditable ? "q" : "cutoff",
                showStartHandle: travel.showStartHandle, showCenterHandle: travel.centerHandle,
                baseHandleMode: travel.baseHandleMode === "start" ? "start" : "value" } : null}
            onModulationChange={travel ? (next, target) => {
                if (target === "center") props.onTravelTranslate?.(next.start, next.end);
                else props.onTravelEndpointSet?.(target, target === "end" ? next.end : next.start);
            } : undefined}
            onGestureStart={(target) => {
                if (target === "value") props.onGestureStart?.();
                else if (target.startsWith("modulation-")) props.onTravelGestureStart?.(target.slice(11) as FilterTravelGestureSide);
            }}
            onGestureEnd={(_cancelled, target) => {
                if (target === "value") props.onGestureEnd?.();
                else if (target.startsWith("modulation-")) props.onTravelGestureEnd?.();
            }}
        />
        {travel?.cutoffAmountLabel !== undefined ? <div className="cosimo-filter-editor__amount"
            data-role="filter-travel-cutoff-amount-label" style={{ color: travel.accent }}>{travel.cutoffAmountLabel}</div> : null}
    </div>;
}

export function VoiceModeToolbar({
    value,
    onChange,
    focusBindings,
    ready = true,
    options = VOICE_MODE_OPTIONS,
    className,
    surfaceClassName,
}: {
    value: number;
    onChange: (nextValue: number) => void;
    focusBindings: SynthFocusBindings;
    ready?: boolean;
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
                data-host-state={ready ? "ready" : "loading"}
                aria-busy={!ready}
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
                            disabled={!ready}
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
    playModeReady = true,
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
                ready={playModeReady}
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
                    className="cosimo-button flex h-10 w-9 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveUp}
                    disabled={!canOctaveUp}
                    aria-label="Shift keyboard up one octave"
                >
                    <OctaveShiftGlyph direction="up" />
                </button>
                <button
                    type="button"
                    className="cosimo-button flex h-10 w-9 items-center justify-center rounded-2xl p-0 disabled:opacity-35"
                    onClick={onOctaveDown}
                    disabled={!canOctaveDown}
                    aria-label="Shift keyboard down one octave"
                >
                    <OctaveShiftGlyph direction="down" />
                </button>
                <div className="cosimo-readout is-caps opacity-70">
                    {keyboardRootLabel}
                </div>
            </div>

            <div className={joinClasses("grid min-w-0 gap-3", contentClassName)}>
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
    pendingTableName,
    frameCount,
    desiredTableIndex,
    tableOptions,
    tableSelectionReady,
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
    modulationTargetKind,
}: WavetableStageSectionProps) {
    const topControlsRef = useRef<HTMLDivElement | null>(null);
    const drawableTopInset = useElementBottomInset(stageRef, topControlsRef, WAVETABLE_DRAWABLE_CONTROL_GAP_PX);
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
            data-modulation-target-kind={modulationTargetKind}
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
                drawableTopInset={drawableTopInset}
            />

            <div
                ref={topControlsRef}
                data-role="wavetable-stage-top-controls"
                className="synth-display-lip-controls text-[8px] uppercase tracking-[0.10em]"
            >
                <label
                    className={`relative inline-flex max-w-[128px] items-center ${tableSelectionReady ? "cursor-pointer" : "cursor-wait opacity-45"}`}
                    data-host-state={tableSelectionReady ? "ready" : "loading"}
                    aria-busy={!tableSelectionReady}
                    onFocus={onTablePrewarm}
                    onPointerEnter={onTablePrewarm}
                >
                    <div data-role="wavetable-select-chip" className={`relative inline-flex h-5 min-w-0 items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1.5 pr-5 text-left ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} cosimo-control-value`}>
                        <span
                            data-role="wavetable-stage-title"
                            className={`truncate${pendingTableName === null ? "" : " opacity-0"}`}
                        >
                            {tableName}
                        </span>
                        {pendingTableName === null ? null : (
                            <span
                                data-role="wavetable-load-status"
                                className="absolute inset-y-0 left-1.5 right-5 flex items-center truncate text-[var(--section-accent)]"
                                aria-live="polite"
                            >
                                Loading {pendingTableName}…
                            </span>
                        )}
                    </div>
                    <SelectChevron className="pointer-events-none absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[var(--section-accent)] opacity-70" />
                    <select
                        className="cosimo-wavetable-native-select absolute inset-0 cursor-pointer opacity-0"
                        value={String(desiredTableIndex)}
                        disabled={!tableSelectionReady}
                        data-host-state={tableSelectionReady ? "ready" : "loading"}
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
                    <div data-role="wavetable-frame-chip" className={`flex h-5 items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1.5 ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} cosimo-control-value`}>
                        Frame {formatFrameIndex(position, frameCount)}
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
    normalizedFromValue?: (value: number) => number;
    valueFromNormalized?: (normalized: number) => number;
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
    normalizedFromValue,
    valueFromNormalized,
    className,
}: VerticalSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
    } = useSliderDrag();

    const normalized = clamp(
        normalizedFromValue
            ? normalizedFromValue(binding.value)
            : (binding.value - min) / (max - min),
        0,
        1,
    );
    const displayValue = formatValue ? formatValue(binding.value) : defaultFormatValue(binding.value, min, max);
    const handleNormalizedChange = onChange ?? (valueFromNormalized
        ? (nextNormalized: number) => binding.setValue(valueFromNormalized(nextNormalized))
        : undefined);

    const fillStyle = bipolar
        ? normalized >= 0.5
            ? { bottom: "50%", height: `${(normalized - 0.5) * 100}%` }
            : { bottom: `${normalized * 100}%`, height: `${(0.5 - normalized) * 100}%` }
        : { height: `${normalized * 100}%` };

    return (
        <div
            data-host-state={binding.isReady ? "ready" : "loading"}
            aria-busy={!binding.isReady}
            className={`flex shrink-0 flex-col items-center gap-1 py-2 ${binding.isReady ? "" : "opacity-45"} ${className ?? ""}`}
        >
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400/45">{label}</span>
            <div
                ref={trackRef}
                data-role={trackDataRole}
                className={`relative w-1.5 flex-1 rounded-full bg-white/[0.04] ${binding.isReady ? "cursor-ns-resize" : "cursor-wait"}`}
                onPointerDown={(e) => handlePointerDown(
                    e,
                    trackRef.current,
                    binding,
                    normalized,
                    min,
                    max,
                    "vertical",
                    handleNormalizedChange,
                )}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={() => handleLostPointerCapture()}
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
                disabled={!binding.isReady}
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
                <div className="cosimo-section-title">MSEG</div>
                <div className="cosimo-readout is-caps is-title">
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
                            <div className="cosimo-readout is-caps is-title text-right">
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
                            <div className="cosimo-readout is-caps is-title text-right">
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
