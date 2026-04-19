import {
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useMemo,
    useRef,
} from "react";

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
    mix: number;
};

export type StutterEnvelopeEditorProps = {
    value: Partial<StutterEnvelopeEditorValue>;
    blockLabel: string;
    onSlicesChange: (value: number) => void;
    onSpeedChange: (value: number) => void;
    onShapeChange: (value: number) => void;
    onGateChange: (value: number) => void;
    onMixChange: (value: number) => void;
};

const GRAPH_WIDTH = 480;
const GRAPH_HEIGHT = 220;
const PLOT_LEFT = 24;
const PLOT_RIGHT = 456;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 180;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const CHIP_HALF_WIDTH = 34;
const ENVELOPE_POINT_COUNT = 200;
const SHAPE_LABELS = ["Gate", "Eased", "Triangle", "Bell", "Down", "Up"];

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function formatSpeed(value: number) {
    return `${clampStutterSpeed(value).toFixed(2)}x`;
}

function formatMix(value: number) {
    return Number(clamp(value, 0, 1).toFixed(2)).toString();
}

function roundSpeed(value: number) {
    return Math.round(value * 100) / 100;
}

function gateX(gate: number) {
    return PLOT_LEFT + (PLOT_WIDTH * clampStutterGate(gate));
}

function pathFromEnvelope(shape: number, gate: number) {
    const points = sampleStutterEnvelope(shape, gate, ENVELOPE_POINT_COUNT).map((sample) => {
        const x = PLOT_LEFT + (PLOT_WIDTH * sample.phase);
        const y = PLOT_BOTTOM - (PLOT_HEIGHT * sample.value);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return {
        line: `M ${points.join(" L ")}`,
        fill: `M ${PLOT_LEFT} ${PLOT_BOTTOM} L ${points.join(" L ")} L ${PLOT_RIGHT} ${PLOT_BOTTOM} Z`,
    };
}

function pointerToNormalizedX(element: SVGSVGElement | HTMLDivElement, clientX: number) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
        return 0;
    }

    return clamp((clientX - bounds.left) / bounds.width, 0, 1);
}

function pointerToGate(element: SVGSVGElement, clientX: number) {
    const normalizedSvgX = pointerToNormalizedX(element, clientX) * GRAPH_WIDTH;
    const plotX = clamp(normalizedSvgX, PLOT_LEFT, PLOT_RIGHT);
    return (plotX - PLOT_LEFT) / PLOT_WIDTH;
}

function resolveValue(value: Partial<StutterEnvelopeEditorValue>): StutterEnvelopeEditorValue {
    return {
        slices: clampStutterSlices(value.slices ?? STUTTER_DEFAULT_SLICES),
        speed: clampStutterSpeed(value.speed ?? STUTTER_DEFAULT_SPEED),
        shape: clampStutterShape(value.shape ?? STUTTER_DEFAULT_SHAPE),
        gate: clampStutterGate(value.gate ?? STUTTER_DEFAULT_GATE),
        mix: clamp(value.mix ?? 1, 0, 1),
    };
}

export function StutterEnvelopeEditor({
    value,
    blockLabel,
    onSlicesChange,
    onSpeedChange,
    onShapeChange,
    onGateChange,
    onMixChange,
}: StutterEnvelopeEditorProps) {
    const resolved = resolveValue(value);
    const graphRef = useRef<SVGSVGElement | null>(null);
    const morphTrackRef = useRef<HTMLDivElement | null>(null);
    const gatePointerIdRef = useRef<number | null>(null);
    const morphPointerIdRef = useRef<number | null>(null);
    const envelopePaths = useMemo(
        () => pathFromEnvelope(resolved.shape, resolved.gate),
        [resolved.gate, resolved.shape],
    );
    const resolvedGateX = gateX(resolved.gate);
    const chipX = clamp(resolvedGateX, PLOT_LEFT + CHIP_HALF_WIDTH, PLOT_RIGHT - CHIP_HALF_WIDTH);
    const repeatTicks = useMemo(
        () => Array.from({ length: resolved.slices }, (_unused, index) => index),
        [resolved.slices],
    );

    const setGateFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
        onGateChange(pointerToGate(event.currentTarget, event.clientX));
    };

    const handleGatePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gatePointerIdRef.current = event.pointerId;
        setGateFromPointer(event);
    };

    const handleGatePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (gatePointerIdRef.current !== event.pointerId) {
            return;
        }

        setGateFromPointer(event);
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

    return (
        <section className="seqfx-stutter-editor" data-role="seqfx-stutter-editor" aria-label="Stutter cut envelope editor">
            <span className="seqfx-stutter-editor__kicker">Stutter - {blockLabel}</span>
            <div className="seqfx-stutter-editor__title">
                <span>Cut envelope</span>
                <em data-role="seqfx-stutter-slice-count">x{resolved.slices}</em>
            </div>

            <div className="seqfx-stutter-editor__panel">
                <div className="seqfx-stutter-editor__canvas-wrap">
                    <svg
                        ref={graphRef}
                        className="seqfx-stutter-editor__surface"
                        data-role="seqfx-stutter-graph"
                        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                        preserveAspectRatio="none"
                        aria-label="Cut envelope"
                        onPointerDown={handleGatePointerDown}
                        onPointerMove={handleGatePointerMove}
                        onPointerUp={endGateDrag}
                        onPointerCancel={endGateDrag}
                    >
                        <line className="seqfx-stutter-editor__grid-line" x1="24" x2="24" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__grid-line" x1="132" x2="132" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__grid-line" x1="240" x2="240" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__grid-line" x1="348" x2="348" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__grid-line" x1="456" x2="456" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__axis" x1="24" x2="456" y1="100" y2="100" />
                        <line className="seqfx-stutter-editor__axis" x1="24" x2="24" y1="20" y2="180" />
                        <line className="seqfx-stutter-editor__axis" x1="24" x2="456" y1="180" y2="180" />

                        <path
                            className="seqfx-stutter-editor__wave-silhouette"
                            d="M 24 100 L 34 84 L 44 110 L 54 88 L 64 114 L 74 74 L 84 122 L 94 80 L 104 118 L 114 72 L 124 126 L 134 76 L 144 118 L 154 62 L 164 138 L 174 70 L 184 124 L 194 78 L 204 114 L 214 66 L 224 134 L 234 74 L 244 122 L 254 76 L 264 118 L 274 82 L 284 112 L 294 76 L 304 120 L 314 80 L 324 116 L 334 88 L 344 110 L 354 90 L 364 108 L 374 92 L 384 106 L 394 94 L 404 104 L 414 96 L 424 102 L 434 98 L 444 100 L 456 100 L 444 100 L 434 102 L 424 98 L 414 104 L 404 96 L 394 106 L 384 94 L 374 108 L 364 92 L 354 110 L 344 90 L 334 112 L 324 124 L 314 120 L 304 128 L 294 124 L 284 128 L 274 122 L 264 130 L 254 124 L 244 134 L 234 126 L 224 138 L 214 120 L 204 130 L 194 118 L 184 134 L 174 108 L 164 144 L 154 100 L 144 136 L 134 104 L 124 142 L 114 104 L 104 130 L 94 106 L 84 126 L 74 108 L 64 124 L 54 108 L 44 120 L 34 108 L 24 100 Z"
                        />

                        <rect
                            className="seqfx-stutter-editor__gate-region"
                            x={resolvedGateX}
                            y="20"
                            width={Math.max(0, PLOT_RIGHT - resolvedGateX)}
                            height="160"
                            rx="2"
                        />
                        <path className="seqfx-stutter-editor__env-fill" d={envelopePaths.fill} />
                        <path className="seqfx-stutter-editor__env-path" d={envelopePaths.line} />
                        <line
                            className="seqfx-stutter-editor__gate-line"
                            x1={resolvedGateX}
                            x2={resolvedGateX}
                            y1="20"
                            y2="180"
                        />
                        <circle
                            className="seqfx-stutter-editor__gate-handle"
                            data-role="seqfx-stutter-gate-handle"
                            cx={resolvedGateX}
                            cy="180"
                            r="8.5"
                        />
                        <g transform={`translate(${chipX.toFixed(2)}, 158)`}>
                            <rect className="seqfx-stutter-editor__gate-chip-rect" x="-34" y="-9" width="68" height="18" rx="3" />
                            <text className="seqfx-stutter-editor__gate-chip-text" x="0" y="4" textAnchor="middle">
                                GATE {Math.round(resolved.gate * 100)}%
                            </text>
                        </g>
                        <text className="seqfx-stutter-editor__axis-label" x="24" y="200" textAnchor="start">0</text>
                        <text className="seqfx-stutter-editor__axis-label" x="240" y="200" textAnchor="middle">1/2 cut</text>
                        <text className="seqfx-stutter-editor__axis-label" x="456" y="200" textAnchor="end">1 cut</text>
                    </svg>

                    <div className="seqfx-stutter-editor__overlay-pill seqfx-stutter-editor__overlay-pill--slices">
                        <label>Slices</label>
                        <button
                            aria-label="Fewer slices"
                            data-role="seqfx-stutter-slices-decrease"
                            disabled={resolved.slices <= STUTTER_SLICES_MIN}
                            onClick={() => onSlicesChange(clampStutterSlices(resolved.slices - 1))}
                            type="button"
                        >
                            -
                        </button>
                        <span className="seqfx-stutter-editor__overlay-value">{resolved.slices}</span>
                        <button
                            aria-label="More slices"
                            data-role="seqfx-stutter-slices-increase"
                            disabled={resolved.slices >= STUTTER_SLICES_MAX}
                            onClick={() => onSlicesChange(clampStutterSlices(resolved.slices + 1))}
                            type="button"
                        >
                            +
                        </button>
                    </div>

                    <div className="seqfx-stutter-editor__overlay-pill seqfx-stutter-editor__overlay-pill--speed">
                        <label>Speed</label>
                        <button
                            aria-label="Slower"
                            data-role="seqfx-stutter-speed-decrease"
                            disabled={resolved.speed <= STUTTER_SPEED_MIN}
                            onClick={() => onSpeedChange(roundSpeed(clampStutterSpeed(resolved.speed - STUTTER_SPEED_STEP)))}
                            type="button"
                        >
                            -
                        </button>
                        <span className="seqfx-stutter-editor__overlay-value seqfx-stutter-editor__overlay-value--speed">
                            {formatSpeed(resolved.speed)}
                        </span>
                        <button
                            aria-label="Faster"
                            data-role="seqfx-stutter-speed-increase"
                            disabled={resolved.speed >= STUTTER_SPEED_MAX}
                            onClick={() => onSpeedChange(roundSpeed(clampStutterSpeed(resolved.speed + STUTTER_SPEED_STEP)))}
                            type="button"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="seqfx-stutter-editor__repeat-strip" aria-label="Repeats per block">
                    {repeatTicks.map((tick) => (
                        <span
                            className={[
                                "seqfx-stutter-editor__repeat-tick",
                                tick === 0 ? "is-source" : "",
                            ].filter(Boolean).join(" ")}
                            data-role="seqfx-stutter-repeat-tick"
                            key={tick}
                        />
                    ))}
                </div>

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
                    <output className="seqfx-stutter-editor__shape-readout">{formatStutterShapeLabel(resolved.shape)}</output>
                </div>
            </div>

            <label className="seqfx-stutter-editor__mix-row">
                <span>Block mix</span>
                <input
                    data-role="seqfx-mix"
                    max={1}
                    min={0}
                    onChange={(event) => onMixChange(Number(event.currentTarget.value))}
                    step={0.01}
                    type="range"
                    value={resolved.mix}
                />
                <output>{formatMix(resolved.mix)}</output>
            </label>
        </section>
    );
}
