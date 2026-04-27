import {
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useMemo,
    useRef,
} from "react";

import {
    EDITOR_CURVE_STROKE_WIDTH,
    EDITOR_HIT_RADIUS_PX,
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_VALUE_HANDLE_HALO_RADIUS_PX,
    EDITOR_VALUE_HANDLE_RADIUS_PX,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import {
    adaptiveSampleEditorCurve,
    createEditorCurvePlotRect,
    editorCurveFillPathToBaseline,
    polylineToSvgPath,
    type EditorCurvePlotRect,
} from "../../../ui/shared/editor-curve-geometry";
import {
    EditorCurveAxis,
    EditorCurveFill,
    EditorCurveHandle,
    EditorCurveHandleHalo,
    EditorCurveHitTarget,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "../../../ui/shared/editor-curve-surface";
import { EditorTickSlider, ModBadge, type ModulationDirection } from "../../../ui/shared/editor-tick-slider";
import {
    STUTTER_DEFAULT_GATE,
    STUTTER_DEFAULT_SHAPE,
    STUTTER_DEFAULT_SLICES,
    STUTTER_DEFAULT_SPEED,
    STUTTER_SHAPE_CHIP_LABELS,
    STUTTER_SHAPE_NAMES,
    STUTTER_SHAPE_STOP_LABELS,
    STUTTER_SLICES_MAX,
    STUTTER_SLICES_MIN,
    STUTTER_SPEED_MAX,
    STUTTER_SPEED_MIN,
    STUTTER_SPEED_STEP,
    clampStutterGate,
    clampStutterShape,
    clampStutterSlices,
    clampStutterSpeed,
    evaluateStutterEnvelope,
    formatStutterShapeLabel,
} from "./stutter-envelope";

export type StutterEnvelopeEditorValue = {
    slices: number;
    speed: number;
    shape: number;
    gate: number;
};

type StutterModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

export type StutterModulation = {
    slices?: StutterModulatedParam | null;
    speed?: StutterModulatedParam | null;
    shape?: StutterModulatedParam | null;
    gate?: StutterModulatedParam | null;
    phase?: number;
    onToggleSlices?: () => void;
    onToggleSpeed?: () => void;
    onToggleShape?: () => void;
    onToggleGate?: () => void;
};

export type StutterEnvelopeEditorProps = {
    value: Partial<StutterEnvelopeEditorValue>;
    onSlicesChange: (value: number) => void;
    onSpeedChange: (value: number) => void;
    onShapeChange: (value: number) => void;
    onGateChange: (value: number) => void;
    modulation?: StutterModulation | null;
};

/**
 * A stylized audio-wave silhouette rendered at unit scale (0..1 on each axis).
 * The component remaps these points into its live plot rectangle, so the
 * silhouette always fills the canvas regardless of surface size.
 */
const WAVE_SILHOUETTE_UNIT = buildUnitWaveSilhouette();

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function formatSpeed(value: number) {
    return `${clampStutterSpeed(value).toFixed(2)}x`;
}

function roundSpeed(value: number) {
    return Math.round(value * 100) / 100;
}

function formatCompactStutterShapeLabel(shape: number) {
    const clampedShape = clampStutterShape(shape);
    const shapePosition = clampedShape * (STUTTER_SHAPE_CHIP_LABELS.length - 1);
    const index = Math.min(STUTTER_SHAPE_CHIP_LABELS.length - 1, Math.max(0, Math.floor(shapePosition)));
    const amount = shapePosition - index;

    if (amount < 0.04 || index >= STUTTER_SHAPE_CHIP_LABELS.length - 1) {
        return STUTTER_SHAPE_CHIP_LABELS[index];
    }

    if (amount > 0.96) {
        return STUTTER_SHAPE_CHIP_LABELS[index + 1];
    }

    return `${STUTTER_SHAPE_CHIP_LABELS[index]}→${STUTTER_SHAPE_CHIP_LABELS[index + 1]}`;
}

function lerp(start: number, end: number, phase: number) {
    const t = clamp(phase, 0, 1);
    return start + ((end - start) * t);
}

function pointerToNormalizedX(element: Element, clientX: number) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
        return 0;
    }

    return clamp((clientX - bounds.left) / bounds.width, 0, 1);
}

function pointerToPlotNormalizedX(element: Element, clientX: number, plot: EditorCurvePlotRect, surfaceWidth: number) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || surfaceWidth <= 0) {
        return 0;
    }

    const surfaceX = ((clientX - bounds.left) / bounds.width) * surfaceWidth;
    const plotX = clamp(surfaceX, plot.plotLeft, plot.plotRight);
    return (plotX - plot.plotLeft) / Math.max(1, plot.plotWidth);
}

function resolveValue(value: Partial<StutterEnvelopeEditorValue>): StutterEnvelopeEditorValue {
    return {
        slices: clampStutterSlices(value.slices ?? STUTTER_DEFAULT_SLICES),
        speed: clampStutterSpeed(value.speed ?? STUTTER_DEFAULT_SPEED),
        shape: clampStutterShape(value.shape ?? STUTTER_DEFAULT_SHAPE),
        gate: clampStutterGate(value.gate ?? STUTTER_DEFAULT_GATE),
    };
}

/** Extra top padding to make room for the gate chip that caps the gate line. */
const STUTTER_GATE_CHIP_TOP_RESERVE_PX = 14;

function resolvePlotRect(width: number, height: number): EditorCurvePlotRect {
    return createEditorCurvePlotRect(width, height, {
        topPaddingPx: EDITOR_PLOT_TOP_PADDING_PX,
        topReservePx: STUTTER_GATE_CHIP_TOP_RESERVE_PX,
        bottomPaddingPx: EDITOR_PLOT_BOTTOM_PADDING_PX,
    });
}

function envelopePaths(shape: number, gate: number, plot: EditorCurvePlotRect) {
    const points = adaptiveSampleEditorCurve({
        breakpoints: gate > 0 && gate < 1 ? [gate] : [],
        evaluate: (phase) => ({
            x: phase,
            y: evaluateStutterEnvelope(phase, shape, gate),
        }),
        plot,
        tolerancePx: 0.5,
        maxDepth: 12,
    });

    return {
        line: polylineToSvgPath(points, 1),
        fill: editorCurveFillPathToBaseline(points, plot, 1),
    };
}

function waveSilhouettePath(plot: EditorCurvePlotRect): string {
    return WAVE_SILHOUETTE_UNIT.map((point, index) => {
        const x = plot.plotLeft + (plot.plotWidth * point.x);
        const y = plot.plotTop + (plot.plotHeight * point.y);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z";
}

function buildUnitWaveSilhouette(): Array<{ x: number; y: number }> {
    // Forward envelope (peaks increasing then decaying) and its mirror
    // below — encoded at unit scale so we can map into any plot rect.
    const top = [
        [0, 0.5], [0.02, 0.3], [0.04, 0.62], [0.06, 0.35], [0.08, 0.675],
        [0.10, 0.175], [0.12, 0.775], [0.14, 0.25], [0.16, 0.725], [0.18, 0.15],
        [0.20, 0.825], [0.22, 0.2], [0.24, 0.725], [0.26, 0.05], [0.28, 0.975],
        [0.30, 0.125], [0.32, 0.8], [0.34, 0.225], [0.36, 0.675], [0.38, 0.075],
        [0.40, 0.925], [0.42, 0.175], [0.44, 0.775], [0.46, 0.2], [0.48, 0.725],
        [0.50, 0.275], [0.52, 0.65], [0.54, 0.2], [0.56, 0.75], [0.58, 0.25],
        [0.60, 0.7], [0.62, 0.35], [0.64, 0.625], [0.66, 0.375], [0.68, 0.6],
        [0.70, 0.4], [0.72, 0.575], [0.74, 0.425], [0.76, 0.55], [0.78, 0.45],
        [0.80, 0.525], [0.82, 0.475], [0.84, 0.5], [1.0, 0.5],
    ];
    const bottom = [
        [1.0, 0.5], [0.84, 0.5], [0.82, 0.525], [0.80, 0.475], [0.78, 0.55],
        [0.76, 0.45], [0.74, 0.575], [0.72, 0.425], [0.70, 0.6], [0.68, 0.4],
        [0.66, 0.625], [0.64, 0.375], [0.62, 0.65], [0.60, 0.775], [0.58, 0.725],
        [0.56, 0.825], [0.54, 0.775], [0.52, 0.825], [0.50, 0.75], [0.48, 0.85],
        [0.46, 0.775], [0.44, 0.9], [0.42, 0.825], [0.40, 0.95], [0.38, 0.75],
        [0.36, 1.0], [0.34, 0.5], [0.32, 0.925], [0.30, 0.525], [0.28, 0.95],
        [0.26, 0.525], [0.24, 0.825], [0.22, 0.55], [0.20, 0.775], [0.18, 0.6],
        [0.16, 0.725], [0.14, 0.625], [0.12, 0.675], [0.10, 0.65], [0.08, 0.65],
        [0.06, 0.55], [0.04, 0.6], [0.02, 0.55], [0, 0.5],
    ];
    return top.concat(bottom).map(([x, y]) => ({ x, y }));
}

export function StutterEnvelopeEditor({
    value,
    onSlicesChange,
    onSpeedChange,
    onShapeChange,
    onGateChange,
    modulation = null,
}: StutterEnvelopeEditorProps) {
    const resolved = resolveValue(value);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const morphTrackRef = useRef<HTMLDivElement | null>(null);
    const gatePointerIdRef = useRef<number | null>(null);
    const gateDragTargetRef = useRef<"start" | "end">("start");
    const morphPointerIdRef = useRef<number | null>(null);
    const morphDragTargetRef = useRef<"start" | "end">("start");
    const size = useEditorSurfaceSize(viewportRef);
    const effectiveWidth = size.width;
    const effectiveHeight = size.height;
    const plot = useMemo(
        () => resolvePlotRect(effectiveWidth, effectiveHeight),
        [effectiveHeight, effectiveWidth],
    );
    const phase = modulation?.phase ?? 0;
    const shapeEnd = modulation?.shape
        ? clampStutterShape(modulation.shape.end)
        : resolved.shape;
    const effectiveShape = modulation?.shape
        ? clampStutterShape(lerp(resolved.shape, shapeEnd, phase))
        : resolved.shape;
    const effectiveGate = modulation?.gate
        ? clampStutterGate(lerp(resolved.gate, modulation.gate.end, phase))
        : resolved.gate;
    const paths = useMemo(
        () => envelopePaths(effectiveShape, effectiveGate, plot),
        [effectiveGate, effectiveShape, plot],
    );
    const waveSilhouette = useMemo(() => waveSilhouettePath(plot), [plot]);
    const gateStartX = plot.plotLeft + (plot.plotWidth * resolved.gate);
    const gateEndX = modulation?.gate
        ? plot.plotLeft + (plot.plotWidth * clampStutterGate(modulation.gate.end))
        : gateStartX;
    const liveGateX = plot.plotLeft + (plot.plotWidth * effectiveGate);
    const gridXs = useMemo(() => (
        [0.25, 0.5, 0.75].map((t) => plot.plotLeft + (plot.plotWidth * t))
    ), [plot]);
    const isGateModulated = Boolean(modulation?.gate);
    const isShapeModulated = Boolean(modulation?.shape);

    const pickGateTarget = (clientX: number): "start" | "end" => {
        if (!isGateModulated || !surfaceRef.current) {
            return "start";
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        if (bounds.width <= 0) {
            return "start";
        }

        const surfaceX = ((clientX - bounds.left) / bounds.width) * effectiveWidth;
        return Math.abs(surfaceX - gateStartX) <= Math.abs(surfaceX - gateEndX) ? "start" : "end";
    };

    const setGateValue = (target: "start" | "end", value: number) => {
        const nextNormalized = clampStutterGate(value);
        const direction = modulation?.gate?.direction ?? "both";

        if (target === "end" && modulation?.gate) {
            let nextEnd = nextNormalized;
            if (direction === "up") {
                nextEnd = Math.max(nextEnd, resolved.gate);
            } else if (direction === "down") {
                nextEnd = Math.min(nextEnd, resolved.gate);
            }
            modulation.gate.onEndChange(clampStutterGate(nextEnd));
            return;
        }

        const nextStart = nextNormalized;
        onGateChange(nextStart);
        if (modulation?.gate) {
            if (direction === "up" && modulation.gate.end < nextStart) {
                modulation.gate.onEndChange(nextStart);
            } else if (direction === "down" && modulation.gate.end > nextStart) {
                modulation.gate.onEndChange(nextStart);
            }
        }
    };

    const setGateFromClientX = (clientX: number, target: "start" | "end") => {
        const surface = surfaceRef.current;
        if (!surface) {
            return;
        }

        setGateValue(target, pointerToPlotNormalizedX(surface, clientX, plot, effectiveWidth));
    };

    const handleGateKeyDown = (target: "start" | "end") => (event: ReactKeyboardEvent<SVGCircleElement>) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            return;
        }

        const step = event.shiftKey ? 0.1 : 0.02;
        const directionSign = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
        const baseValue = target === "end" ? modulation?.gate?.end ?? resolved.gate : resolved.gate;
        const nextValue = event.key === "Home"
            ? 0
            : event.key === "End"
                ? 1
                : baseValue + (step * directionSign);

        setGateValue(target, nextValue);
        event.preventDefault();
    };

    const handleGatePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gatePointerIdRef.current = event.pointerId;
        const target = pickGateTarget(event.clientX);
        gateDragTargetRef.current = target;
        setGateFromClientX(event.clientX, target);
    };

    const handleGatePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (gatePointerIdRef.current !== event.pointerId) {
            return;
        }

        setGateFromClientX(event.clientX, gateDragTargetRef.current);
    };

    const endGateDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (gatePointerIdRef.current !== event.pointerId) {
            return;
        }

        gatePointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const setShapeValue = (target: "start" | "end", value: number) => {
        const nextNormalized = clampStutterShape(value);
        const direction = modulation?.shape?.direction ?? "both";

        if (target === "end" && modulation?.shape) {
            let nextEnd = nextNormalized;
            if (direction === "up") {
                nextEnd = Math.max(nextEnd, resolved.shape);
            } else if (direction === "down") {
                nextEnd = Math.min(nextEnd, resolved.shape);
            }
            modulation.shape.onEndChange(clampStutterShape(nextEnd));
            return;
        }

        onShapeChange(nextNormalized);
        if (modulation?.shape) {
            if (direction === "up" && modulation.shape.end < nextNormalized) {
                modulation.shape.onEndChange(nextNormalized);
            } else if (direction === "down" && modulation.shape.end > nextNormalized) {
                modulation.shape.onEndChange(nextNormalized);
            }
        }
    };

    const pickShapeTarget = (clientX: number): "start" | "end" => {
        if (!isShapeModulated || !morphTrackRef.current) {
            return "start";
        }

        const normalizedX = pointerToNormalizedX(morphTrackRef.current, clientX);
        return Math.abs(normalizedX - resolved.shape) <= Math.abs(normalizedX - shapeEnd) ? "start" : "end";
    };

    const setShapeFromClientX = (element: HTMLDivElement, clientX: number, target: "start" | "end") => {
        setShapeValue(target, pointerToNormalizedX(element, clientX));
    };

    const handleMorphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        morphPointerIdRef.current = event.pointerId;
        morphDragTargetRef.current = pickShapeTarget(event.clientX);
        setShapeFromClientX(event.currentTarget, event.clientX, morphDragTargetRef.current);
    };

    const handleMorphPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (morphPointerIdRef.current !== event.pointerId) {
            return;
        }

        setShapeFromClientX(event.currentTarget, event.clientX, morphDragTargetRef.current);
    };

    const endMorphDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (morphPointerIdRef.current !== event.pointerId) {
            return;
        }

        morphPointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const handleMorphKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 0.1 : 0.02;

        if (event.key === "ArrowLeft") {
            setShapeValue("start", resolved.shape - step);
            event.preventDefault();
        } else if (event.key === "ArrowRight") {
            setShapeValue("start", resolved.shape + step);
            event.preventDefault();
        } else if (event.key === "Home") {
            setShapeValue("start", 0);
            event.preventDefault();
        } else if (event.key === "End") {
            setShapeValue("start", 1);
            event.preventDefault();
        }
    };

    const handleShapeHandleKeyDown = (target: "start" | "end") => (event: ReactKeyboardEvent<HTMLSpanElement>) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            return;
        }

        const step = event.shiftKey ? 0.1 : 0.02;
        const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
        const baseValue = target === "end" ? shapeEnd : resolved.shape;
        const nextValue = event.key === "Home"
            ? 0
            : event.key === "End"
                ? 1
                : baseValue + (step * direction);

        setShapeValue(target, nextValue);
        event.preventDefault();
    };

    const shapeFooterReadout = isShapeModulated ? (
        <output
            className="seqfx-stutter-editor__shape-readout seqfx-stutter-editor__shape-readout--modulated"
            data-role="seqfx-stutter-shape-value"
        >
            <span
                className="seqfx-stutter-editor__shape-chip seqfx-stutter-editor__shape-chip--start"
                title={formatStutterShapeLabel(resolved.shape)}
            >
                {formatCompactStutterShapeLabel(resolved.shape)}
            </span>
            <span className="seqfx-stutter-editor__shape-arrow">-&gt;</span>
            <span
                className="seqfx-stutter-editor__shape-chip seqfx-stutter-editor__shape-chip--end"
                title={formatStutterShapeLabel(shapeEnd)}
            >
                {formatCompactStutterShapeLabel(shapeEnd)}
            </span>
        </output>
    ) : (
        <output className="seqfx-stutter-editor__shape-readout" data-role="seqfx-stutter-shape-value">
            {formatStutterShapeLabel(resolved.shape)}
        </output>
    );

    const shapeStartPercent = resolved.shape * 100;
    const shapeEndPercent = shapeEnd * 100;

    const shapeA11yProps = isShapeModulated ? {} : {
        role: "slider" as const,
        "aria-label": "Shape morph",
        "aria-valuemin": 0,
        "aria-valuemax": 1,
        "aria-valuenow": resolved.shape,
        tabIndex: 0,
        onKeyDown: handleMorphKeyDown,
    };

    const gateChipLabel = isGateModulated
        ? `${resolved.gate.toFixed(2)} -> ${clampStutterGate(modulation!.gate!.end).toFixed(2)}`
        : `${Math.round(resolved.gate * 100)}%`;
    const axisLabelY = effectiveHeight - 10;
    const gateHandleY = plot.plotBottom;
    const gateChipY = plot.plotTop - 11;
    const gateChipX = computeChipX((gateStartX + gateEndX) / 2, plot, isGateModulated ? 52 : 24);

    return (
        <section className="seqfx-stutter-editor" data-role="seqfx-stutter-editor" aria-label="Stutter cut envelope editor">
            <div className="seqfx-stutter-editor__panel">
                <div ref={viewportRef} className="seqfx-stutter-editor__viewport" data-role="seqfx-stutter-viewport">
                    <EditorCurveSurface
                        ref={surfaceRef}
                        className="seqfx-stutter-editor__surface"
                        dataRole="seqfx-stutter-graph"
                        heightPx={effectiveHeight}
                        widthPx={effectiveWidth}
                        ariaLabel="Cut envelope"
                        onPointerDown={handleGatePointerDown}
                        onPointerMove={handleGatePointerMove}
                        onPointerUp={endGateDrag}
                        onPointerCancel={endGateDrag}
                    >
                        <EditorCurvePlotArea plot={plot} />
                        {gridXs.map((x, index) => (
                            <line
                                key={`g-${index}`}
                                className="editor-curve-grid-line seqfx-stutter-editor__grid-line"
                                x1={x}
                                x2={x}
                                y1={plot.plotTop}
                                y2={plot.plotBottom}
                            />
                        ))}
                        <EditorCurveAxis
                            className="seqfx-stutter-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={plot.plotBottom}
                            y2={plot.plotBottom}
                        />
                        <EditorCurveAxis
                            className="seqfx-stutter-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotLeft}
                            y1={plot.plotTop}
                            y2={plot.plotBottom}
                        />

                        <path
                            className="seqfx-stutter-editor__wave-silhouette"
                            d={waveSilhouette}
                        />

                        {isGateModulated ? (
                            <rect
                                className="seqfx-stutter-editor__gate-mod-region"
                                x={Math.min(gateStartX, gateEndX)}
                                y={plot.plotTop}
                                width={Math.max(1, Math.abs(gateEndX - gateStartX))}
                                height={plot.plotHeight}
                                rx="2"
                            />
                        ) : null}
                        <rect
                            className="seqfx-stutter-editor__gate-region"
                            x={liveGateX}
                            y={plot.plotTop}
                            width={Math.max(0, plot.plotRight - liveGateX)}
                            height={plot.plotHeight}
                            rx="2"
                        />
                        <EditorCurveFill className="seqfx-stutter-editor__env-fill" data-role="seqfx-stutter-env-fill" d={paths.fill} />
                        <EditorCurvePath
                            className="seqfx-stutter-editor__env-path"
                            data-role="seqfx-stutter-env-path"
                            d={paths.line}
                            strokeWidth={EDITOR_CURVE_STROKE_WIDTH}
                        />
                        {isGateModulated ? (
                            <>
                                <line
                                    className="seqfx-stutter-editor__gate-line seqfx-stutter-editor__gate-line--start"
                                    x1={gateStartX}
                                    x2={gateStartX}
                                    y1={plot.plotTop}
                                    y2={plot.plotBottom}
                                />
                                <line
                                    className="seqfx-stutter-editor__gate-line seqfx-stutter-editor__gate-line--end"
                                    x1={gateEndX}
                                    x2={gateEndX}
                                    y1={plot.plotTop}
                                    y2={plot.plotBottom}
                                />
                                <EditorCurveHandleHalo
                                    className="seqfx-stutter-editor__value-halo"
                                    cx={gateStartX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_HALO_RADIUS_PX}
                                />
                                <EditorCurveHandle
                                    className="seqfx-stutter-editor__gate-handle seqfx-stutter-editor__gate-handle--start"
                                    data-role="seqfx-stutter-gate-handle"
                                    cx={gateStartX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                                    variant="range-start"
                                />
                                <EditorCurveHandleHalo
                                    className="seqfx-stutter-editor__value-halo"
                                    cx={gateEndX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_HALO_RADIUS_PX}
                                />
                                <EditorCurveHandle
                                    className="seqfx-stutter-editor__gate-handle seqfx-stutter-editor__gate-handle--end"
                                    cx={gateEndX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                                    variant="range-end"
                                />
                            </>
                        ) : (
                            <>
                                <line
                                    className="seqfx-stutter-editor__gate-line"
                                    x1={liveGateX}
                                    x2={liveGateX}
                                    y1={plot.plotTop}
                                    y2={plot.plotBottom}
                                />
                                <EditorCurveHandleHalo
                                    className="seqfx-stutter-editor__value-halo"
                                    cx={liveGateX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_HALO_RADIUS_PX}
                                />
                                <EditorCurveHandle
                                    className="seqfx-stutter-editor__gate-handle"
                                    data-role="seqfx-stutter-gate-handle"
                                    cx={liveGateX}
                                    cy={gateHandleY}
                                    r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                                />
                            </>
                        )}
                        <EditorCurveHitTarget
                            aria-label="Gate position"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(resolved.gate * 100)}
                            className="seqfx-stutter-editor__gate-hit-target"
                            role="slider"
                            cx={gateStartX}
                            cy={gateHandleY}
                            r={EDITOR_HIT_RADIUS_PX}
                            tabIndex={0}
                            onKeyDown={handleGateKeyDown("start")}
                        />
                        {isGateModulated ? (
                            <EditorCurveHitTarget
                                aria-label="Gate end"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(clampStutterGate(modulation!.gate!.end) * 100)}
                                className="seqfx-stutter-editor__gate-hit-target seqfx-stutter-editor__gate-hit-target--end"
                                role="slider"
                                cx={gateEndX}
                                cy={gateHandleY}
                                r={EDITOR_HIT_RADIUS_PX}
                                tabIndex={0}
                                onKeyDown={handleGateKeyDown("end")}
                            />
                        ) : null}
                        <text className="seqfx-stutter-editor__axis-label" x={plot.plotLeft} y={axisLabelY} textAnchor="start">0</text>
                        <text
                            className="seqfx-stutter-editor__axis-label"
                            x={plot.plotLeft + (plot.plotWidth * 0.5)}
                            y={axisLabelY}
                            textAnchor="middle"
                        >
                            1/2 cut
                        </text>
                        <text
                            className="seqfx-stutter-editor__axis-label"
                            x={plot.plotRight}
                            y={axisLabelY}
                            textAnchor="end"
                        >
                            1 cut
                        </text>
                        <g
                            transform={`translate(${gateChipX.toFixed(2)}, ${gateChipY.toFixed(2)})`}
                            pointerEvents="none"
                        >
                            <rect
                                className={`seqfx-stutter-editor__gate-chip-rect${isGateModulated ? " seqfx-stutter-editor__gate-chip-rect--modulated" : ""}`}
                                x={isGateModulated ? -52 : -22}
                                y="-9"
                                width={isGateModulated ? 104 : 44}
                                height="18"
                                rx="3"
                            />
                            <text
                                className={`seqfx-stutter-editor__gate-chip-text${isGateModulated ? " seqfx-stutter-editor__gate-chip-text--modulated" : ""}`}
                                x="0"
                                y="4"
                                textAnchor="middle"
                            >
                                {gateChipLabel}
                            </text>
                        </g>
                    </EditorCurveSurface>
                    {modulation?.onToggleGate ? (
                        <button
                            aria-pressed={isGateModulated}
                            className="seqfx-stutter-editor__gate-toggle"
                            data-role="seqfx-stutter-gate-mod-toggle"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                modulation.onToggleGate!();
                            }}
                            type="button"
                        >
                            <span>Gate</span>
                            <ModBadge isOn={isGateModulated} direction={modulation.gate?.direction} />
                        </button>
                    ) : null}
                </div>

                <EditorTickSlider
                    accent="start"
                    dataRole="seqfx-stutter-slices-slider"
                    formatValue={(value) => String(Math.round(value))}
                    inputDataRole="seqfx-stutter-slices"
                    label="Slices"
                    max={STUTTER_SLICES_MAX}
                    min={STUTTER_SLICES_MIN}
                    onChange={(value) => onSlicesChange(clampStutterSlices(value))}
                    step={1}
                    tickCount={(STUTTER_SLICES_MAX - STUTTER_SLICES_MIN) + 1}
                    value={resolved.slices}
                    valueDataRole="seqfx-stutter-slices-value"
                    modulation={modulation?.slices ? {
                        end: modulation.slices.end,
                        onEndChange: (nextValue) => modulation.slices!.onEndChange(clampStutterSlices(nextValue)),
                        phase,
                        direction: modulation.slices.direction,
                    } : null}
                    onModulationToggle={modulation?.onToggleSlices ?? null}
                />

                <div className="seqfx-stutter-editor__morph">
                    <div className="seqfx-stutter-editor__morph-labels">
                        {STUTTER_SHAPE_STOP_LABELS.map((label, index) => (
                            <button
                                data-role="seqfx-stutter-shape-stop"
                                data-stop={index}
                                key={STUTTER_SHAPE_NAMES[index]}
                                onClick={() => onShapeChange(index / (STUTTER_SHAPE_NAMES.length - 1))}
                                type="button"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div
                        ref={morphTrackRef}
                        className="seqfx-stutter-editor__morph-track"
                        data-role="seqfx-stutter-morph-track"
                        {...shapeA11yProps}
                        onPointerDown={handleMorphPointerDown}
                        onPointerMove={handleMorphPointerMove}
                        onPointerUp={endMorphDrag}
                        onPointerCancel={endMorphDrag}
                    >
                        <span className="seqfx-stutter-editor__morph-rail" />
                        {Array.from({ length: STUTTER_SHAPE_STOP_LABELS.length - 2 }, (_unused, index) => (
                            <span
                                className="seqfx-stutter-editor__morph-notch"
                                key={index + 1}
                                style={{ left: `${(((index + 1) / (STUTTER_SHAPE_STOP_LABELS.length - 1)) * 100).toFixed(2)}%` }}
                            />
                        ))}
                        {isShapeModulated ? (
                            <>
                                <span
                                    className="seqfx-stutter-editor__morph-range"
                                    style={{
                                        left: `${Math.min(shapeStartPercent, shapeEndPercent)}%`,
                                        right: `${100 - Math.max(shapeStartPercent, shapeEndPercent)}%`,
                                    }}
                                />
                                <span className="seqfx-stutter-editor__morph-thumb" style={{ left: `${shapeStartPercent}%` }} />
                                <span
                                    className="seqfx-stutter-editor__morph-thumb seqfx-stutter-editor__morph-thumb--end"
                                    style={{ left: `${shapeEndPercent}%` }}
                                />
                                <span
                                    aria-label="Shape start"
                                    aria-valuemin={0}
                                    aria-valuemax={1}
                                    aria-valuenow={resolved.shape}
                                    className="seqfx-stutter-editor__morph-sr-handle"
                                    onKeyDown={handleShapeHandleKeyDown("start")}
                                    role="slider"
                                    tabIndex={0}
                                />
                                <span
                                    aria-label="Shape end"
                                    aria-valuemin={0}
                                    aria-valuemax={1}
                                    aria-valuenow={shapeEnd}
                                    className="seqfx-stutter-editor__morph-sr-handle"
                                    onKeyDown={handleShapeHandleKeyDown("end")}
                                    role="slider"
                                    tabIndex={0}
                                />
                            </>
                        ) : (
                            <span className="seqfx-stutter-editor__morph-thumb" style={{ left: `${shapeStartPercent}%` }} />
                        )}
                    </div>
                    <div className="seqfx-stutter-editor__morph-footer">
                        {modulation?.onToggleShape ? (
                            <button
                                aria-pressed={isShapeModulated}
                                className="seqfx-stutter-editor__shape-toggle"
                                data-role="seqfx-stutter-shape-mod-toggle"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    modulation.onToggleShape!();
                                }}
                                type="button"
                            >
                                <span>Shape</span>
                                <ModBadge isOn={isShapeModulated} direction={modulation.shape?.direction} />
                            </button>
                        ) : null}
                        {shapeFooterReadout}
                    </div>
                </div>
                <EditorTickSlider
                    accent="start"
                    dataRole="seqfx-stutter-speed-slider"
                    formatValue={formatSpeed}
                    inputDataRole="seqfx-stutter-speed"
                    label="Speed"
                    max={STUTTER_SPEED_MAX}
                    min={STUTTER_SPEED_MIN}
                    onChange={(value) => onSpeedChange(roundSpeed(clampStutterSpeed(value)))}
                    step={STUTTER_SPEED_STEP}
                    tickCount={16}
                    value={resolved.speed}
                    valueDataRole="seqfx-stutter-speed-value"
                    modulation={modulation?.speed ? {
                        end: modulation.speed.end,
                        onEndChange: (nextValue) => modulation.speed!.onEndChange(roundSpeed(clampStutterSpeed(nextValue))),
                        phase,
                        direction: modulation.speed.direction,
                    } : null}
                    onModulationToggle={modulation?.onToggleSpeed ?? null}
                />
            </div>
        </section>
    );
}

function computeChipX(centerX: number, plot: EditorCurvePlotRect, halfWidth: number): number {
    return clamp(centerX, plot.plotLeft + halfWidth, plot.plotRight - halfWidth);
}
