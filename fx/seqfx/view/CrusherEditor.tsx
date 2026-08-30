import {
    useMemo,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

import { EditorTickSlider, ModBadge, type ModulationDirection } from "../../../ui/shared/editor-tick-slider";
import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import {
    createEditorCurvePlotRect,
    editorCurveFillPathToBaseline,
    polylineToSvgPath,
    type EditorCurvePlotRect,
} from "../../../ui/shared/editor-curve-geometry";
import {
    EditorCurveAxis,
    EditorCurveFill,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "../../../ui/shared/editor-curve-surface";
import {
    CRUSHER_BITS_MAX,
    CRUSHER_BITS_MIN,
    CRUSHER_DRIVE_DB_MAX,
    CRUSHER_DRIVE_DB_MIN,
    CRUSHER_QUALITY_MAX,
    CRUSHER_QUALITY_MIN,
    clampCrusherBits,
    clampCrusherCharacter,
    clampCrusherDriveDb,
    clampCrusherQuality,
    clampCrusherRateHz,
    crusherRateFromNormalized,
    crusherRateToNormalized,
    sampleCrusherPreview,
    type CrusherPreviewSample,
} from "./crusher-preview";

export type CrusherEditorValue = {
    bits: number;
    rateHz: number;
    driveDb: number;
    character: number;
    adcQuality: number;
    dacQuality: number;
    dither: number;
    mix: number;
};

type CrusherModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

export type CrusherModulation = {
    bits?: CrusherModulatedParam | null;
    rateHz?: CrusherModulatedParam | null;
    driveDb?: CrusherModulatedParam | null;
    adcQuality?: CrusherModulatedParam | null;
    dacQuality?: CrusherModulatedParam | null;
    dither?: CrusherModulatedParam | null;
    phase?: number;
    onToggleBits?: () => void;
    onToggleRateHz?: () => void;
    onToggleDriveDb?: () => void;
    onToggleAdcQuality?: () => void;
    onToggleDacQuality?: () => void;
    onToggleDither?: () => void;
};

export type CrusherEditorProps = {
    value: Partial<CrusherEditorValue>;
    onBitsChange: (value: number) => void;
    onRateHzChange: (value: number) => void;
    onDriveDbChange: (value: number) => void;
    onCharacterChange: (value: number) => void;
    onAdcQualityChange: (value: number) => void;
    onDacQualityChange: (value: number) => void;
    onDitherChange: (value: number) => void;
    modulation?: CrusherModulation | null;
};

const CRUSHER_POINT_COUNT = 240;
const CRUSHER_TOP_RESERVE_PX = 14;
const CRUSHER_CHARACTER_NAMES = ["Original", "Classic", "Smooth", "Progressive"] as const;

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function resolveValue(value: Partial<CrusherEditorValue>): CrusherEditorValue {
    return {
        bits: clampCrusherBits(value.bits ?? 8),
        rateHz: clampCrusherRateHz(value.rateHz ?? 48_000),
        driveDb: clampCrusherDriveDb(value.driveDb ?? 0),
        character: clampCrusherCharacter(value.character ?? 1),
        adcQuality: clampCrusherQuality(value.adcQuality ?? 0),
        dacQuality: clampCrusherQuality(value.dacQuality ?? 0),
        dither: clampCrusherQuality(value.dither ?? 0),
        mix: clamp(value.mix ?? 1, 0, 1),
    };
}

function resolvePlotRect(width: number, height: number): EditorCurvePlotRect {
    return createEditorCurvePlotRect(width, height, {
        topPaddingPx: EDITOR_PLOT_TOP_PADDING_PX,
        topReservePx: CRUSHER_TOP_RESERVE_PX,
        bottomPaddingPx: EDITOR_PLOT_BOTTOM_PADDING_PX,
    });
}

function sampleToPoint(sample: CrusherPreviewSample, plot: EditorCurvePlotRect, value: number) {
    const x = plot.plotLeft + (plot.plotWidth * sample.phase);
    const y = plot.plotTop + (plot.plotHeight * 0.5) - (value * plot.plotHeight * 0.43);
    return { x, y };
}

function samplePath(samples: CrusherPreviewSample[], plot: EditorCurvePlotRect, key: "dry" | "wet") {
    return polylineToSvgPath(samples.map((sample) => sampleToPoint(sample, plot, sample[key])), 1);
}

function wetFillPath(samples: CrusherPreviewSample[], plot: EditorCurvePlotRect) {
    if (samples.length === 0) {
        return "";
    }

    const midY = plot.plotTop + (plot.plotHeight * 0.5);
    return editorCurveFillPathToBaseline(
        samples.map((sample) => sampleToPoint(sample, plot, sample.wet)),
        plot,
        1,
        midY,
    );
}

function formatDriveDb(value: number) {
    return `${clampCrusherDriveDb(value).toFixed(1)} dB`;
}

function formatRateHz(value: number) {
    const rateHz = clampCrusherRateHz(value);
    return rateHz >= 1_000 ? `${(rateHz / 1_000).toFixed(rateHz >= 10_000 ? 0 : 1)} kHz` : `${Math.round(rateHz)} Hz`;
}

function formatPercent(value: number) {
    return `${Math.round(clampCrusherQuality(value) * 100)}%`;
}

function lerp(start: number, end: number, phase: number) {
    return start + ((end - start) * Math.max(0, Math.min(1, phase)));
}

function optionalDirection(direction: ModulationDirection | undefined): { direction?: ModulationDirection } {
    return direction === undefined ? {} : { direction };
}

export function CrusherEditor({
    value,
    onBitsChange,
    onRateHzChange,
    onDriveDbChange,
    onCharacterChange,
    onAdcQualityChange,
    onDacQualityChange,
    onDitherChange,
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
    const bitsModulation = modulation?.bits ?? null;
    const rateModulation = modulation?.rateHz ?? null;
    const driveModulation = modulation?.driveDb ?? null;
    const adcModulation = modulation?.adcQuality ?? null;
    const dacModulation = modulation?.dacQuality ?? null;
    const ditherModulation = modulation?.dither ?? null;
    const toggleDriveModulation = modulation?.onToggleDriveDb;
    const previewValues = useMemo(() => ({
        bits: modulation?.bits
            ? clampCrusherBits(lerp(resolved.bits, modulation.bits.end, phase))
            : resolved.bits,
        rateHz: modulation?.rateHz
            ? clampCrusherRateHz(lerp(resolved.rateHz, modulation.rateHz.end, phase))
            : resolved.rateHz,
        driveDb: modulation?.driveDb
            ? clampCrusherDriveDb(lerp(resolved.driveDb, modulation.driveDb.end, phase))
            : resolved.driveDb,
        adcQuality: modulation?.adcQuality
            ? clampCrusherQuality(lerp(resolved.adcQuality, modulation.adcQuality.end, phase))
            : resolved.adcQuality,
        dacQuality: modulation?.dacQuality
            ? clampCrusherQuality(lerp(resolved.dacQuality, modulation.dacQuality.end, phase))
            : resolved.dacQuality,
        dither: modulation?.dither
            ? clampCrusherQuality(lerp(resolved.dither, modulation.dither.end, phase))
            : resolved.dither,
    }), [modulation, phase, resolved.adcQuality, resolved.bits, resolved.dacQuality, resolved.dither, resolved.driveDb, resolved.rateHz]);
    const preview = useMemo(
        () => sampleCrusherPreview({
            bits: previewValues.bits,
            rateHz: previewValues.rateHz,
            driveDb: previewValues.driveDb,
            character: resolved.character,
            adcQuality: previewValues.adcQuality,
            dacQuality: previewValues.dacQuality,
            dither: previewValues.dither,
            mix: resolved.mix,
            pointCount: CRUSHER_POINT_COUNT,
        }),
        [previewValues.adcQuality, previewValues.bits, previewValues.dacQuality, previewValues.dither, previewValues.driveDb, previewValues.rateHz, resolved.character, resolved.mix],
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
    const driveStartPercent = (resolved.driveDb / CRUSHER_DRIVE_DB_MAX) * 100;
    const driveEndPercent = driveModulation
        ? (clampCrusherDriveDb(driveModulation.end) / CRUSHER_DRIVE_DB_MAX) * 100
        : driveStartPercent;
    const driveSweepLeft = Math.min(driveStartPercent, driveEndPercent);
    const driveSweepRight = 100 - Math.max(driveStartPercent, driveEndPercent);
    const isDriveModulated = driveModulation !== null;

    return (
        <section className="seqfx-crusher-editor" data-role="seqfx-crusher-editor" aria-label="Crusher editor">
            <div className="seqfx-crusher-editor__panel">
                <div ref={viewportRef} className="seqfx-crusher-editor__viewport">
                    <EditorCurveSurface
                        className="seqfx-crusher-editor__surface"
                        dataRole="seqfx-crusher-graph"
                        heightPx={effectiveHeight}
                        widthPx={effectiveWidth}
                        ariaLabel="Crusher waveform preview"
                    >
                        <EditorCurvePlotArea plot={plot} />
                        {gridXs.map((x, index) => (
                            <line
                                key={`grid-${index}`}
                                className="editor-curve-grid-line seqfx-crusher-editor__grid-line"
                                x1={x}
                                x2={x}
                                y1={plot.plotTop}
                                y2={plot.plotBottom}
                            />
                        ))}
                        <EditorCurveAxis
                            className="seqfx-crusher-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={plot.plotBottom}
                            y2={plot.plotBottom}
                        />
                        <EditorCurveAxis
                            className="seqfx-crusher-editor__axis"
                            x1={plot.plotLeft}
                            x2={plot.plotLeft}
                            y1={plot.plotTop}
                            y2={plot.plotBottom}
                        />
                        <EditorCurveAxis
                            className="seqfx-crusher-editor__axis seqfx-crusher-editor__axis--center"
                            x1={plot.plotLeft}
                            x2={plot.plotRight}
                            y1={midY}
                            y2={midY}
                        />
                        <EditorCurveFill className="seqfx-crusher-editor__wet-fill" data-role="seqfx-crusher-wet-fill" d={wetFill} />
                        <EditorCurvePath className="seqfx-crusher-editor__dry-path" d={dryPath} variant="muted" />
                        <EditorCurvePath className="seqfx-crusher-editor__wet-path" data-role="seqfx-crusher-wet-path" d={wetPath} />
                        {preview.captureMarkerPhases.map((phase) => {
                            const x = plot.plotLeft + (plot.plotWidth * phase);
                            return (
                                <line
                                    className="seqfx-crusher-editor__capture-marker"
                                    key={`capture-${phase.toFixed(4)}`}
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
                    </EditorCurveSurface>
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
                    modulation={bitsModulation ? {
                        end: bitsModulation.end,
                        onEndChange: (nextValue) => bitsModulation.onEndChange(clampCrusherBits(nextValue)),
                        phase,
                        ...optionalDirection(bitsModulation.direction),
                    } : null}
                    onModulationToggle={modulation?.onToggleBits ?? null}
                />
                <EditorTickSlider
                    accent="end"
                    dataRole="seqfx-crusher-rate-slider"
                    formatValue={(nextValue) => formatRateHz(crusherRateFromNormalized(nextValue))}
                    inputDataRole="seqfx-crusher-rate"
                    label="Rate"
                    max={1}
                    min={0}
                    onChange={(nextValue) => onRateHzChange(Math.round(crusherRateFromNormalized(nextValue)))}
                    step={0.001}
                    tickCount={16}
                    value={crusherRateToNormalized(resolved.rateHz)}
                    valueDataRole="seqfx-crusher-rate-value"
                    modulation={rateModulation ? {
                        end: crusherRateToNormalized(rateModulation.end),
                        onEndChange: (nextValue) => rateModulation.onEndChange(Math.round(crusherRateFromNormalized(nextValue))),
                        phase,
                        ...optionalDirection(rateModulation.direction),
                    } : null}
                    onModulationToggle={modulation?.onToggleRateHz ?? null}
                />
                <div className="seqfx-crusher-editor__character" data-role="seqfx-crusher-character">
                    <span className="seqfx-crusher-editor__character-label">Character</span>
                    <div className="seqfx-crusher-editor__character-options" role="group" aria-label="Crusher character">
                        {CRUSHER_CHARACTER_NAMES.map((name, index) => (
                            <button
                                aria-pressed={resolved.character === index}
                                className={resolved.character === index ? "is-active" : ""}
                                data-character={index}
                                data-role="seqfx-crusher-character-option"
                                key={name}
                                onClick={() => onCharacterChange(clampCrusherCharacter(index))}
                                type="button"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={`seqfx-crusher-editor__drive${isDriveModulated ? " seqfx-crusher-editor__drive--modulated" : ""}`}>
                    <div className="seqfx-crusher-editor__drive-head">
                        {toggleDriveModulation ? (
                            <button
                                aria-pressed={isDriveModulated}
                                className="seqfx-crusher-editor__drive-label seqfx-crusher-editor__drive-label--toggle"
                                data-role="seqfx-crusher-drive-db-mod-toggle"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    toggleDriveModulation();
                                }}
                                type="button"
                            >
                                <span>Drive</span>
                                <ModBadge isOn={isDriveModulated} {...optionalDirection(driveModulation?.direction)} />
                            </button>
                        ) : (
                            <span className="seqfx-crusher-editor__drive-label">Drive</span>
                        )}
                        {driveModulation ? (
                            <output className="seqfx-crusher-editor__drive-value seqfx-crusher-editor__drive-value--modulated" data-role="seqfx-crusher-drive-db-value">
                                <span className="seqfx-crusher-editor__drive-chip seqfx-crusher-editor__drive-chip--start">
                                    {formatDriveDb(resolved.driveDb)}
                                </span>
                                <span className="seqfx-crusher-editor__drive-arrow">-&gt;</span>
                                <span className="seqfx-crusher-editor__drive-chip seqfx-crusher-editor__drive-chip--end">
                                    {formatDriveDb(driveModulation.end)}
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
                            {driveModulation ? (
                                <span
                                    className="seqfx-crusher-editor__drive-range"
                                    style={{ left: `${driveSweepLeft}%`, right: `${driveSweepRight}%` }}
                                />
                            ) : null}
                            <span
                                className="seqfx-crusher-editor__drive-thumb"
                                style={{ left: `${driveStartPercent}%` }}
                            />
                            {driveModulation ? (
                                <span
                                    className="seqfx-crusher-editor__drive-thumb seqfx-crusher-editor__drive-thumb--end"
                                    style={{ left: `${driveEndPercent}%` }}
                                />
                            ) : null}
                            {driveModulation ? (
                                <DriveModulationDragSurface
                                    direction={driveModulation.direction ?? "both"}
                                    endValue={driveModulation.end}
                                    onEndChange={(nextValue) => driveModulation.onEndChange(clampCrusherDriveDb(nextValue))}
                                    onStartChange={(nextValue) => onDriveDbChange(clampCrusherDriveDb(nextValue))}
                                    startValue={resolved.driveDb}
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
                <div className="seqfx-crusher-editor__converter" data-role="seqfx-crusher-converter">
                    <EditorTickSlider
                        accent="start"
                        dataRole="seqfx-crusher-adc-quality-slider"
                        formatValue={formatPercent}
                        inputDataRole="seqfx-crusher-adc-quality"
                        label="ADC Q"
                        max={CRUSHER_QUALITY_MAX}
                        min={CRUSHER_QUALITY_MIN}
                        onChange={(nextValue) => onAdcQualityChange(clampCrusherQuality(nextValue))}
                        step={0.01}
                        tickCount={11}
                        value={resolved.adcQuality}
                        valueDataRole="seqfx-crusher-adc-quality-value"
                        modulation={adcModulation ? {
                            end: adcModulation.end,
                            onEndChange: (nextValue) => adcModulation.onEndChange(clampCrusherQuality(nextValue)),
                            phase,
                            ...optionalDirection(adcModulation.direction),
                        } : null}
                        onModulationToggle={modulation?.onToggleAdcQuality ?? null}
                    />
                    <EditorTickSlider
                        accent="end"
                        dataRole="seqfx-crusher-dac-quality-slider"
                        formatValue={formatPercent}
                        inputDataRole="seqfx-crusher-dac-quality"
                        label="DAC Q"
                        max={CRUSHER_QUALITY_MAX}
                        min={CRUSHER_QUALITY_MIN}
                        onChange={(nextValue) => onDacQualityChange(clampCrusherQuality(nextValue))}
                        step={0.01}
                        tickCount={11}
                        value={resolved.dacQuality}
                        valueDataRole="seqfx-crusher-dac-quality-value"
                        modulation={dacModulation ? {
                            end: dacModulation.end,
                            onEndChange: (nextValue) => dacModulation.onEndChange(clampCrusherQuality(nextValue)),
                            phase,
                            ...optionalDirection(dacModulation.direction),
                        } : null}
                        onModulationToggle={modulation?.onToggleDacQuality ?? null}
                    />
                    <EditorTickSlider
                        accent="start"
                        dataRole="seqfx-crusher-dither-slider"
                        formatValue={formatPercent}
                        inputDataRole="seqfx-crusher-dither"
                        label="Dither"
                        max={CRUSHER_QUALITY_MAX}
                        min={CRUSHER_QUALITY_MIN}
                        onChange={(nextValue) => onDitherChange(clampCrusherQuality(nextValue))}
                        step={0.01}
                        tickCount={11}
                        value={resolved.dither}
                        valueDataRole="seqfx-crusher-dither-value"
                        modulation={ditherModulation ? {
                            end: ditherModulation.end,
                            onEndChange: (nextValue) => ditherModulation.onEndChange(clampCrusherQuality(nextValue)),
                            phase,
                            ...optionalDirection(ditherModulation.direction),
                        } : null}
                        onModulationToggle={modulation?.onToggleDither ?? null}
                    />
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

function DriveModulationDragSurface({
    startValue,
    endValue,
    direction,
    onStartChange,
    onEndChange,
}: DriveModulationDragSurfaceProps) {
    const activeRef = useRef<"start" | "end">("start");
    const pointerIdRef = useRef<number | null>(null);

    const valueToPx = (value: number, width: number) => (value / CRUSHER_DRIVE_DB_MAX) * width;

    const pickTarget = (pointerX: number, width: number) => {
        const startPx = valueToPx(startValue, width);
        const endPx = valueToPx(endValue, width);
        return Math.abs(pointerX - startPx) <= Math.abs(pointerX - endPx) ? "start" : "end";
    };

    const applyValue = (target: "start" | "end", value: number) => {
        const raw = clampCrusherDriveDb(value);

        if (target === "start") {
            onStartChange(raw);
            if (direction === "up" && raw > endValue) {
                onEndChange(raw);
            } else if (direction === "down" && raw < endValue) {
                onEndChange(raw);
            }
            return;
        }

        if (direction === "up") {
            onEndChange(Math.max(raw, startValue));
        } else if (direction === "down") {
            onEndChange(Math.min(raw, startValue));
        } else {
            onEndChange(raw);
        }
    };

    const applyFromPointer = (target: "start" | "end", pointerX: number, width: number) => {
        if (width <= 0) {
            return;
        }

        applyValue(target, clamp(pointerX / width, 0, 1) * CRUSHER_DRIVE_DB_MAX);
    };

    const handleHandleKeyDown = (target: "start" | "end") => (event: ReactKeyboardEvent<HTMLSpanElement>) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            return;
        }

        const step = event.shiftKey ? 1.0 : 0.1;
        const directionSign = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
        const baseValue = target === "start" ? startValue : endValue;
        const nextValue = event.key === "Home"
            ? CRUSHER_DRIVE_DB_MIN
            : event.key === "End"
                ? CRUSHER_DRIVE_DB_MAX
                : baseValue + (step * directionSign);

        applyValue(target, nextValue);
        event.preventDefault();
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const pointerX = event.clientX - bounds.left;
        activeRef.current = pickTarget(pointerX, bounds.width);
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyFromPointer(activeRef.current, pointerX, bounds.width);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        applyFromPointer(activeRef.current, event.clientX - bounds.left, bounds.width);
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) {
            return;
        }

        pointerIdRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <>
            <div
                className="seqfx-crusher-editor__drive-drag-surface"
                data-role="seqfx-crusher-drive-db"
                onPointerCancel={handlePointerUp}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                role="presentation"
            />
            <span
                aria-label="Drive start"
                aria-valuemax={CRUSHER_DRIVE_DB_MAX}
                aria-valuemin={CRUSHER_DRIVE_DB_MIN}
                aria-valuenow={clampCrusherDriveDb(startValue)}
                className="editor-tick-slider__sr-handle"
                onKeyDown={handleHandleKeyDown("start")}
                role="slider"
                tabIndex={0}
            />
            <span
                aria-label="Drive end"
                aria-valuemax={CRUSHER_DRIVE_DB_MAX}
                aria-valuemin={CRUSHER_DRIVE_DB_MIN}
                aria-valuenow={clampCrusherDriveDb(endValue)}
                className="editor-tick-slider__sr-handle"
                onKeyDown={handleHandleKeyDown("end")}
                role="slider"
                tabIndex={0}
            />
        </>
    );
}
