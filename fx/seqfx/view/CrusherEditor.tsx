import { useMemo, useRef } from "react";

import { EditorTickSlider } from "../../../ui/shared/editor-tick-slider";
import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    editorPlotGutter,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import {
    CRUSHER_BITS_MAX,
    CRUSHER_BITS_MIN,
    CRUSHER_DRIVE_DB_MAX,
    CRUSHER_DRIVE_DB_MIN,
    CRUSHER_HOLD_FRAMES_MAX,
    CRUSHER_HOLD_FRAMES_MIN,
    clampCrusherBits,
    clampCrusherDriveDb,
    clampCrusherHoldFrames,
    sampleCrusherPreview,
    type CrusherPreviewSample,
} from "./crusher-preview";

export type CrusherEditorValue = {
    bits: number;
    holdFrames: number;
    driveDb: number;
    mix: number;
};

export type CrusherEditorProps = {
    value: Partial<CrusherEditorValue>;
    onBitsChange: (value: number) => void;
    onHoldFramesChange: (value: number) => void;
    onDriveDbChange: (value: number) => void;
};

type PlotRect = {
    plotLeft: number;
    plotRight: number;
    plotTop: number;
    plotBottom: number;
    plotWidth: number;
    plotHeight: number;
};

const CRUSHER_POINT_COUNT = 240;
const CRUSHER_TOP_RESERVE_PX = 14;

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function resolveValue(value: Partial<CrusherEditorValue>): CrusherEditorValue {
    return {
        bits: clampCrusherBits(value.bits ?? 8),
        holdFrames: clampCrusherHoldFrames(value.holdFrames ?? 1),
        driveDb: clampCrusherDriveDb(value.driveDb ?? 0),
        mix: clamp(value.mix ?? 1, 0, 1),
    };
}

function resolvePlotRect(width: number, height: number): PlotRect {
    const horizontalPadding = editorPlotGutter(width);
    const plotLeft = horizontalPadding;
    const plotRight = Math.max(horizontalPadding + 1, width - horizontalPadding);
    const plotTop = EDITOR_PLOT_TOP_PADDING_PX + CRUSHER_TOP_RESERVE_PX;
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

function sampleToPoint(sample: CrusherPreviewSample, plot: PlotRect, value: number) {
    const x = plot.plotLeft + (plot.plotWidth * sample.phase);
    const y = plot.plotTop + (plot.plotHeight * 0.5) - (value * plot.plotHeight * 0.43);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

function samplePath(samples: CrusherPreviewSample[], plot: PlotRect, key: "dry" | "wet") {
    return samples.map((sample, index) => (
        `${index === 0 ? "M" : "L"} ${sampleToPoint(sample, plot, sample[key])}`
    )).join(" ");
}

function wetFillPath(samples: CrusherPreviewSample[], plot: PlotRect) {
    if (samples.length === 0) {
        return "";
    }

    const midY = plot.plotTop + (plot.plotHeight * 0.5);
    const firstX = plot.plotLeft + (plot.plotWidth * samples[0].phase);
    const lastX = plot.plotLeft + (plot.plotWidth * samples[samples.length - 1].phase);
    return `M ${firstX.toFixed(1)} ${midY.toFixed(1)} ${samplePath(samples, plot, "wet")} L ${lastX.toFixed(1)} ${midY.toFixed(1)} Z`;
}

function formatDriveDb(value: number) {
    return `${clampCrusherDriveDb(value).toFixed(1)} dB`;
}

export function CrusherEditor({
    value,
    onBitsChange,
    onHoldFramesChange,
    onDriveDbChange,
}: CrusherEditorProps) {
    const resolved = resolveValue(value);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const size = useEditorSurfaceSize(viewportRef);
    const effectiveWidth = size.width;
    const effectiveHeight = size.height;
    const plot = useMemo(
        () => resolvePlotRect(effectiveWidth, effectiveHeight),
        [effectiveHeight, effectiveWidth],
    );
    const preview = useMemo(
        () => sampleCrusherPreview({
            bits: resolved.bits,
            holdFrames: resolved.holdFrames,
            driveDb: resolved.driveDb,
            mix: resolved.mix,
            pointCount: CRUSHER_POINT_COUNT,
        }),
        [resolved.bits, resolved.driveDb, resolved.holdFrames, resolved.mix],
    );
    const dryPath = useMemo(() => samplePath(preview.samples, plot, "dry"), [plot, preview.samples]);
    const wetPath = useMemo(() => samplePath(preview.samples, plot, "wet"), [plot, preview.samples]);
    const wetFill = useMemo(() => wetFillPath(preview.samples, plot), [plot, preview.samples]);
    const gridXs = useMemo(() => (
        [0.25, 0.5, 0.75].map((position) => plot.plotLeft + (plot.plotWidth * position))
    ), [plot]);
    const midY = plot.plotTop + (plot.plotHeight * 0.5);
    const axisLabelY = effectiveHeight - 10;
    const markerTop = Math.max(2, plot.plotTop - 18);
    const markerBottom = Math.max(markerTop + 1, plot.plotTop - 7);

    return (
        <section className="seqfx-crusher-editor" data-role="seqfx-crusher-editor" aria-label="Crusher editor">
            <div className="seqfx-crusher-editor__panel">
                <div ref={viewportRef} className="seqfx-crusher-editor__viewport">
                    <svg
                        className="seqfx-crusher-editor__surface"
                        data-role="seqfx-crusher-graph"
                        viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`}
                        aria-label="Crusher waveform preview"
                    >
                        {gridXs.map((x, index) => (
                            <line
                                key={`grid-${index}`}
                                className="seqfx-crusher-editor__grid-line"
                                x1={x}
                                x2={x}
                                y1={plot.plotTop}
                                y2={plot.plotBottom}
                            />
                        ))}
                        <line
                            className="seqfx-crusher-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={plot.plotBottom}
                            y2={plot.plotBottom}
                        />
                        <line
                            className="seqfx-crusher-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotLeft}
                            y1={plot.plotTop}
                            y2={plot.plotBottom}
                        />
                        <line
                            className="seqfx-crusher-editor__axis seqfx-crusher-editor__axis--center"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={midY}
                            y2={midY}
                        />
                        <path className="seqfx-crusher-editor__wet-fill" d={wetFill} />
                        <path className="seqfx-crusher-editor__dry-path" d={dryPath} />
                        <path className="seqfx-crusher-editor__wet-path" data-role="seqfx-crusher-wet-path" d={wetPath} />
                        {preview.holdMarkerPhases.map((phase) => {
                            const x = plot.plotLeft + (plot.plotWidth * phase);
                            return (
                                <line
                                    className="seqfx-crusher-editor__hold-marker"
                                    key={`hold-${phase.toFixed(4)}`}
                                    x1={x}
                                    x2={x}
                                    y1={markerTop}
                                    y2={markerBottom}
                                />
                            );
                        })}
                        <text className="seqfx-crusher-editor__axis-label" x={plot.plotLeft} y={axisLabelY} textAnchor="start">0</text>
                        <text
                            className="seqfx-crusher-editor__axis-label"
                            x={plot.plotLeft + (plot.plotWidth * 0.5)}
                            y={axisLabelY}
                            textAnchor="middle"
                        >
                            1/2
                        </text>
                        <text className="seqfx-crusher-editor__axis-label" x={plot.plotRight} y={axisLabelY} textAnchor="end">1 cycle</text>
                    </svg>
                </div>
                <EditorTickSlider
                    accent="start"
                    dataRole="seqfx-crusher-bits-slider"
                    formatValue={(nextValue) => String(Math.round(nextValue))}
                    inputDataRole="seqfx-crusher-bits"
                    label="Bits"
                    max={CRUSHER_BITS_MAX}
                    min={CRUSHER_BITS_MIN}
                    onChange={(nextValue) => onBitsChange(clampCrusherBits(nextValue))}
                    step={1}
                    tickCount={(CRUSHER_BITS_MAX - CRUSHER_BITS_MIN) + 1}
                    value={resolved.bits}
                    valueDataRole="seqfx-crusher-bits-value"
                />
                <EditorTickSlider
                    accent="end"
                    dataRole="seqfx-crusher-hold-frames-slider"
                    formatValue={(nextValue) => String(Math.round(nextValue))}
                    inputDataRole="seqfx-crusher-hold-frames"
                    label="Hold"
                    max={CRUSHER_HOLD_FRAMES_MAX}
                    min={CRUSHER_HOLD_FRAMES_MIN}
                    onChange={(nextValue) => onHoldFramesChange(clampCrusherHoldFrames(nextValue))}
                    step={1}
                    tickCount={16}
                    value={resolved.holdFrames}
                    valueDataRole="seqfx-crusher-hold-frames-value"
                />
                <div className="seqfx-crusher-editor__drive">
                    <label className="seqfx-crusher-editor__drive-head">
                        <span className="seqfx-crusher-editor__drive-label">Drive</span>
                        <output className="seqfx-crusher-editor__drive-value" data-role="seqfx-crusher-drive-db-value">
                            {formatDriveDb(resolved.driveDb)}
                        </output>
                        <span className="seqfx-crusher-editor__drive-track">
                            <span className="seqfx-crusher-editor__drive-rail" />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "25%" }} />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "50%" }} />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "75%" }} />
                            <span
                                className="seqfx-crusher-editor__drive-thumb"
                                style={{ left: `${(resolved.driveDb / CRUSHER_DRIVE_DB_MAX) * 100}%` }}
                            />
                            <input
                                aria-label="Drive"
                                data-role="seqfx-crusher-drive-db"
                                max={CRUSHER_DRIVE_DB_MAX}
                                min={CRUSHER_DRIVE_DB_MIN}
                                onChange={(event) => onDriveDbChange(clampCrusherDriveDb(Number(event.currentTarget.value)))}
                                step={0.1}
                                type="range"
                                value={resolved.driveDb}
                            />
                        </span>
                    </label>
                </div>
            </div>
        </section>
    );
}
