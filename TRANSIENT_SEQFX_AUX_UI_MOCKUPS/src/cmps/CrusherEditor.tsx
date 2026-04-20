import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { EditorTickSlider, ModBadge, type ModulationDirection } from "./EditorTickSlider";
import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    editorPlotGutter,
    useEditorSurfaceSize,
} from "./editor-tokens";
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

type CrusherModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

export type CrusherModulation = {
    bits?: CrusherModulatedParam | null;
    holdFrames?: CrusherModulatedParam | null;
    driveDb?: CrusherModulatedParam | null;
    phase?: number;
    onToggleBits?: () => void;
    onToggleHoldFrames?: () => void;
    onToggleDriveDb?: () => void;
};

export type CrusherEditorProps = {
    value: Partial<CrusherEditorValue>;
    onBitsChange: (value: number) => void;
    onHoldFramesChange: (value: number) => void;
    onDriveDbChange: (value: number) => void;
    modulation?: CrusherModulation | null;
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

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function CrusherEditor({
    value,
    onBitsChange,
    onHoldFramesChange,
    onDriveDbChange,
    modulation = null,
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
    const phase = modulation?.phase ?? 0;
    const previewValues = useMemo(() => ({
        bits: modulation?.bits
            ? clampCrusherBits(lerp(resolved.bits, modulation.bits.end, phase))
            : resolved.bits,
        holdFrames: modulation?.holdFrames
            ? clampCrusherHoldFrames(lerp(resolved.holdFrames, modulation.holdFrames.end, phase))
            : resolved.holdFrames,
        driveDb: modulation?.driveDb
            ? clampCrusherDriveDb(lerp(resolved.driveDb, modulation.driveDb.end, phase))
            : resolved.driveDb,
    }), [resolved.bits, resolved.holdFrames, resolved.driveDb, modulation, phase]);
    const preview = useMemo(
        () => sampleCrusherPreview({
            bits: previewValues.bits,
            holdFrames: previewValues.holdFrames,
            driveDb: previewValues.driveDb,
            mix: resolved.mix,
            pointCount: CRUSHER_POINT_COUNT,
        }),
        [previewValues.bits, previewValues.driveDb, previewValues.holdFrames, resolved.mix],
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

    const driveStartPct = (resolved.driveDb / CRUSHER_DRIVE_DB_MAX) * 100;
    const driveEndPct = modulation?.driveDb
        ? (clampCrusherDriveDb(modulation.driveDb.end) / CRUSHER_DRIVE_DB_MAX) * 100
        : driveStartPct;
    const driveLivePct = (previewValues.driveDb / CRUSHER_DRIVE_DB_MAX) * 100;
    const driveSweepLeft = Math.min(driveStartPct, driveEndPct);
    const driveSweepRight = 100 - Math.max(driveStartPct, driveEndPct);
    const isDriveModulated = Boolean(modulation?.driveDb);

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
                        {preview.holdMarkerPhases.map((markerPhase) => {
                            const x = plot.plotLeft + (plot.plotWidth * markerPhase);
                            return (
                                <line
                                    className="seqfx-crusher-editor__hold-marker"
                                    key={`hold-${markerPhase.toFixed(4)}`}
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
                    modulation={modulation?.bits ? {
                        end: modulation.bits.end,
                        onEndChange: (nextValue) => modulation.bits!.onEndChange(clampCrusherBits(nextValue)),
                        phase,
                        direction: modulation.bits.direction,
                    } : null}
                    onModulationToggle={modulation?.onToggleBits ?? null}
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
                    modulation={modulation?.holdFrames ? {
                        end: modulation.holdFrames.end,
                        onEndChange: (nextValue) => modulation.holdFrames!.onEndChange(clampCrusherHoldFrames(nextValue)),
                        phase,
                        direction: modulation.holdFrames.direction,
                    } : null}
                    onModulationToggle={modulation?.onToggleHoldFrames ?? null}
                />
                <div className={`seqfx-crusher-editor__drive${isDriveModulated ? " seqfx-crusher-editor__drive--modulated" : ""}`}>
                    <div className="seqfx-crusher-editor__drive-head">
                        {modulation?.onToggleDriveDb ? (
                            <button
                                type="button"
                                className="seqfx-crusher-editor__drive-label seqfx-crusher-editor__drive-label--toggle"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    modulation.onToggleDriveDb!();
                                }}
                                aria-pressed={isDriveModulated}
                                title={`Drive: click to ${isDriveModulated ? "disable" : "enable"} aux modulation${
                                    modulation?.driveDb?.direction && modulation.driveDb.direction !== "both"
                                        ? ` (${modulation.driveDb.direction}-only)`
                                        : ""
                                }`}
                            >
                                <span>Drive</span>
                                <ModBadge isOn={isDriveModulated} direction={modulation?.driveDb?.direction} />
                            </button>
                        ) : (
                            <span className="seqfx-crusher-editor__drive-label">Drive</span>
                        )}
                        {isDriveModulated ? (
                            <output className="seqfx-crusher-editor__drive-value seqfx-crusher-editor__drive-value--modulated" data-role="seqfx-crusher-drive-db-value">
                                <span className="seqfx-crusher-editor__drive-chip seqfx-crusher-editor__drive-chip--start">
                                    {formatDriveDb(resolved.driveDb)}
                                </span>
                                <span className="seqfx-crusher-editor__drive-arrow">→</span>
                                <span className="seqfx-crusher-editor__drive-chip seqfx-crusher-editor__drive-chip--end">
                                    {formatDriveDb(modulation!.driveDb!.end)}
                                </span>
                            </output>
                        ) : (
                            <output className="seqfx-crusher-editor__drive-value" data-role="seqfx-crusher-drive-db-value">
                                {formatDriveDb(resolved.driveDb)}
                            </output>
                        )}
                        <span className="seqfx-crusher-editor__drive-track">
                            <span className="seqfx-crusher-editor__drive-rail" />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "25%" }} />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "50%" }} />
                            <span className="seqfx-crusher-editor__drive-notch" style={{ left: "75%" }} />
                            {isDriveModulated ? (
                                <span
                                    className="seqfx-crusher-editor__drive-range"
                                    style={{ left: `${driveSweepLeft}%`, right: `${driveSweepRight}%` }}
                                />
                            ) : null}
                            <span
                                className="seqfx-crusher-editor__drive-thumb"
                                style={{ left: `${driveStartPct}%` }}
                            />
                            {isDriveModulated ? (
                                <span
                                    className="seqfx-crusher-editor__drive-thumb seqfx-crusher-editor__drive-thumb--end"
                                    style={{ left: `${driveEndPct}%` }}
                                />
                            ) : null}
                            {isDriveModulated ? (
                                <DriveModulationDragSurface
                                    startValue={resolved.driveDb}
                                    endValue={modulation!.driveDb!.end}
                                    direction={modulation!.driveDb!.direction ?? "both"}
                                    onStartChange={(v) => onDriveDbChange(clampCrusherDriveDb(v))}
                                    onEndChange={(v) => modulation!.driveDb!.onEndChange(clampCrusherDriveDb(v))}
                                />
                            ) : (
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
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}

type DriveModulationDragSurfaceProps = {
    startValue: number;
    endValue: number;
    direction: ModulationDirection;
    onStartChange: (value: number) => void;
    onEndChange: (value: number) => void;
};

function DriveModulationDragSurface({ startValue, endValue, direction, onStartChange, onEndChange }: DriveModulationDragSurfaceProps) {
    const activeRef = useRef<"start" | "end">("start");
    const pointerIdRef = useRef<number | null>(null);

    const valueToPx = (value: number, width: number) => (value / CRUSHER_DRIVE_DB_MAX) * width;

    const pickTarget = (pointerX: number, width: number) => {
        const startPx = valueToPx(startValue, width);
        const endPx = valueToPx(endValue, width);
        return Math.abs(pointerX - startPx) <= Math.abs(pointerX - endPx) ? "start" : "end";
    };

    const applyFromPointer = (target: "start" | "end", pointerX: number, width: number) => {
        if (width <= 0) {
            return;
        }

        const ratio = clamp(pointerX / width, 0, 1);
        const raw = ratio * CRUSHER_DRIVE_DB_MAX;

        if (target === "start") {
            onStartChange(raw);
            if (direction === "up" && raw > endValue) {
                onEndChange(raw);
            } else if (direction === "down" && raw < endValue) {
                onEndChange(raw);
            }
        } else {
            let next = raw;
            if (direction === "up") {
                next = Math.max(raw, startValue);
            } else if (direction === "down") {
                next = Math.min(raw, startValue);
            }
            onEndChange(next);
        }
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const target = pickTarget(pointerX, rect.width);
        activeRef.current = target;
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyFromPointer(target, pointerX, rect.width);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        applyFromPointer(activeRef.current, event.clientX - rect.left, rect.width);
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        pointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <div
            className="seqfx-crusher-editor__drive-drag-surface"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="presentation"
        />
    );
}
