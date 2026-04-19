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
    editorPlotGutter,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import { EditorTickSlider } from "../../../ui/shared/editor-tick-slider";
import {
    STUTTER_DEFAULT_GATE,
    STUTTER_DEFAULT_SHAPE,
    STUTTER_DEFAULT_SLICES,
    STUTTER_DEFAULT_SPEED,
    STUTTER_SHAPE_NAMES,
    STUTTER_SLICES_MAX,
    STUTTER_SLICES_MIN,
    STUTTER_SPEED_MAX,
    STUTTER_SPEED_MIN,
    STUTTER_SPEED_STEP,
    clampStutterGate,
    clampStutterShape,
    clampStutterSlices,
    clampStutterSpeed,
    formatStutterShapeLabel,
    sampleStutterEnvelope,
} from "./stutter-envelope";

export type StutterEnvelopeEditorValue = {
    slices: number;
    speed: number;
    shape: number;
    gate: number;
};

export type StutterEnvelopeEditorProps = {
    value: Partial<StutterEnvelopeEditorValue>;
    onSlicesChange: (value: number) => void;
    onSpeedChange: (value: number) => void;
    onShapeChange: (value: number) => void;
    onGateChange: (value: number) => void;
};

const ENVELOPE_POINT_COUNT = 200;
const SHAPE_LABELS = ["Gate", "Eased", "Triangle", "Bell", "Down", "Up"];
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

function pointerToNormalizedX(element: Element, clientX: number) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
        return 0;
    }

    return clamp((clientX - bounds.left) / bounds.width, 0, 1);
}

function pointerToPlotNormalizedX(element: Element, clientX: number, plot: PlotRect, surfaceWidth: number) {
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

type PlotRect = {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
};

/** Extra top padding to make room for the gate chip that caps the gate line. */
const STUTTER_GATE_CHIP_TOP_RESERVE_PX = 14;

function resolvePlotRect(width: number, height: number): PlotRect {
    const horizontalPadding = editorPlotGutter(width);
    const plotLeft = horizontalPadding;
    const plotRight = Math.max(horizontalPadding + 1, width - horizontalPadding);
    const plotTop = EDITOR_PLOT_TOP_PADDING_PX + STUTTER_GATE_CHIP_TOP_RESERVE_PX;
    const plotBottom = Math.max(plotTop + 1, height - EDITOR_PLOT_BOTTOM_PADDING_PX);
    return {
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        plotWidth: plotRight - plotLeft,
        plotHeight: plotBottom - plotTop,
    };
}

function envelopePaths(shape: number, gate: number, plot: PlotRect) {
    const points = sampleStutterEnvelope(shape, gate, ENVELOPE_POINT_COUNT).map((sample) => {
        const x = plot.plotLeft + (plot.plotWidth * sample.phase);
        const y = plot.plotBottom - (plot.plotHeight * sample.value);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return {
        line: `M ${points.join(" L ")}`,
        fill: `M ${plot.plotLeft.toFixed(1)} ${plot.plotBottom.toFixed(1)} L ${points.join(" L ")} L ${plot.plotRight.toFixed(1)} ${plot.plotBottom.toFixed(1)} Z`,
    };
}

function waveSilhouettePath(plot: PlotRect): string {
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
}: StutterEnvelopeEditorProps) {
    const resolved = resolveValue(value);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const morphTrackRef = useRef<HTMLDivElement | null>(null);
    const gatePointerIdRef = useRef<number | null>(null);
    const morphPointerIdRef = useRef<number | null>(null);
    const size = useEditorSurfaceSize(viewportRef);
    const effectiveWidth = size.width;
    const effectiveHeight = size.height;
    const plot = useMemo(
        () => resolvePlotRect(effectiveWidth, effectiveHeight),
        [effectiveHeight, effectiveWidth],
    );
    const paths = useMemo(
        () => envelopePaths(resolved.shape, resolved.gate, plot),
        [plot, resolved.gate, resolved.shape],
    );
    const waveSilhouette = useMemo(() => waveSilhouettePath(plot), [plot]);
    const gateX = plot.plotLeft + (plot.plotWidth * resolved.gate);
    const gridXs = useMemo(() => (
        [0.25, 0.5, 0.75].map((t) => plot.plotLeft + (plot.plotWidth * t))
    ), [plot]);

    const setGateFromClientX = (clientX: number) => {
        const surface = surfaceRef.current;
        if (!surface) {
            return;
        }

        onGateChange(pointerToPlotNormalizedX(surface, clientX, plot, effectiveWidth));
    };

    const handleGatePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gatePointerIdRef.current = event.pointerId;
        setGateFromClientX(event.clientX);
    };

    const handleGatePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (gatePointerIdRef.current !== event.pointerId) {
            return;
        }

        setGateFromClientX(event.clientX);
    };

    const endGateDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (gatePointerIdRef.current !== event.pointerId) {
            return;
        }

        gatePointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const setShapeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        onShapeChange(pointerToNormalizedX(event.currentTarget, event.clientX));
    };

    const handleMorphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        morphPointerIdRef.current = event.pointerId;
        setShapeFromPointer(event);
    };

    const handleMorphPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (morphPointerIdRef.current !== event.pointerId) {
            return;
        }

        setShapeFromPointer(event);
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
            onShapeChange(clampStutterShape(resolved.shape - step));
            event.preventDefault();
        } else if (event.key === "ArrowRight") {
            onShapeChange(clampStutterShape(resolved.shape + step));
            event.preventDefault();
        } else if (event.key === "Home") {
            onShapeChange(0);
            event.preventDefault();
        } else if (event.key === "End") {
            onShapeChange(1);
            event.preventDefault();
        }
    };

    const gateChipLabel = `${Math.round(resolved.gate * 100)}%`;
    const axisLabelY = effectiveHeight - 10;
    const gateHandleY = plot.plotBottom;
    const gateChipY = plot.plotTop - 11;

    return (
        <section className="seqfx-stutter-editor" data-role="seqfx-stutter-editor" aria-label="Stutter cut envelope editor">
            <div className="seqfx-stutter-editor__panel">
                <div ref={viewportRef} className="seqfx-stutter-editor__viewport" data-role="seqfx-stutter-viewport">
                    <svg
                        ref={surfaceRef}
                        className="seqfx-stutter-editor__surface"
                        data-role="seqfx-stutter-graph"
                        viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`}
                        aria-label="Cut envelope"
                        onPointerDown={handleGatePointerDown}
                        onPointerMove={handleGatePointerMove}
                        onPointerUp={endGateDrag}
                        onPointerCancel={endGateDrag}
                    >
                        {gridXs.map((x, index) => (
                            <line
                                key={`g-${index}`}
                                className="seqfx-stutter-editor__grid-line"
                                x1={x}
                                x2={x}
                                y1={plot.plotTop}
                                y2={plot.plotBottom}
                            />
                        ))}
                        <line
                            className="seqfx-stutter-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={plot.plotBottom}
                            y2={plot.plotBottom}
                        />
                        <line
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

                        <rect
                            className="seqfx-stutter-editor__gate-region"
                            x={gateX}
                            y={plot.plotTop}
                            width={Math.max(0, plot.plotRight - gateX)}
                            height={plot.plotHeight}
                            rx="2"
                        />
                        <path className="seqfx-stutter-editor__env-fill" d={paths.fill} />
                        <path className="seqfx-stutter-editor__env-path" d={paths.line} strokeWidth={EDITOR_CURVE_STROKE_WIDTH} />
                        <line
                            className="seqfx-stutter-editor__gate-line"
                            x1={gateX}
                            x2={gateX}
                            y1={plot.plotTop}
                            y2={plot.plotBottom}
                        />
                        <circle
                            className="seqfx-stutter-editor__value-halo"
                            cx={gateX}
                            cy={gateHandleY}
                            r={EDITOR_VALUE_HANDLE_HALO_RADIUS_PX}
                        />
                        <circle
                            className="seqfx-stutter-editor__gate-handle"
                            data-role="seqfx-stutter-gate-handle"
                            cx={gateX}
                            cy={gateHandleY}
                            r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                        />
                        <circle
                            aria-label="Gate position"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(resolved.gate * 100)}
                            className="seqfx-stutter-editor__gate-hit-target"
                            role="slider"
                            cx={gateX}
                            cy={gateHandleY}
                            r={EDITOR_HIT_RADIUS_PX}
                            tabIndex={0}
                        />
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
                            transform={`translate(${computeChipX(gateX, plot).toFixed(2)}, ${gateChipY.toFixed(2)})`}
                            pointerEvents="none"
                        >
                            <rect className="seqfx-stutter-editor__gate-chip-rect" x="-22" y="-9" width="44" height="18" rx="3" />
                            <text className="seqfx-stutter-editor__gate-chip-text" x="0" y="4" textAnchor="middle">
                                {gateChipLabel}
                            </text>
                        </g>
                    </svg>
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
                />

                <div className="seqfx-stutter-editor__morph">
                    <div className="seqfx-stutter-editor__morph-labels">
                        {SHAPE_LABELS.map((label, index) => (
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
                        role="slider"
                        aria-label="Shape morph"
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={resolved.shape}
                        tabIndex={0}
                        onKeyDown={handleMorphKeyDown}
                        onPointerDown={handleMorphPointerDown}
                        onPointerMove={handleMorphPointerMove}
                        onPointerUp={endMorphDrag}
                        onPointerCancel={endMorphDrag}
                    >
                        <span className="seqfx-stutter-editor__morph-rail" />
                        <span className="seqfx-stutter-editor__morph-notch" style={{ left: "16.66%" }} />
                        <span className="seqfx-stutter-editor__morph-notch" style={{ left: "33.33%" }} />
                        <span className="seqfx-stutter-editor__morph-notch" style={{ left: "50%" }} />
                        <span className="seqfx-stutter-editor__morph-notch" style={{ left: "66.66%" }} />
                        <span className="seqfx-stutter-editor__morph-notch" style={{ left: "83.33%" }} />
                        <span className="seqfx-stutter-editor__morph-thumb" style={{ left: `${resolved.shape * 100}%` }} />
                    </div>
                    <div className="seqfx-stutter-editor__morph-footer">
                        <output className="seqfx-stutter-editor__shape-readout">{formatStutterShapeLabel(resolved.shape)}</output>
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
                />
            </div>
        </section>
    );
}

function computeChipX(gateX: number, plot: PlotRect): number {
    const chipHalfWidth = 24;
    return clamp(gateX, plot.plotLeft + chipHalfWidth, plot.plotRight - chipHalfWidth);
}
