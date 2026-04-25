import { useMemo } from "react";

import {
    SEQFX_AUX_RATE_MODES,
    SEQFX_AUX_SLICE_COUNT_MAX,
    SEQFX_AUX_SLICE_COUNT_MIN,
    SEQFX_AUX_SOURCE_CURVE_MAX,
    SEQFX_AUX_SOURCE_CURVE_MIN,
    SEQFX_AUX_TEMPO_MULTIPLIER_MAX,
    SEQFX_AUX_TEMPO_MULTIPLIER_MIN,
    SEQFX_AUX_SHAPE_MAX,
    SEQFX_AUX_SHAPE_MIN,
    type SeqFxAuxRateMode,
    type SeqFxAuxSource,
} from "./seqfx-state";

export type AuxSourceSample = {
    phase: number;
    shape: number;
    sourceCurve: number;
};

export type AuxSourceProps = {
    source: SeqFxAuxSource;
    cyclePhase: number;
    amount: number;
    onSourceChange: (source: Partial<SeqFxAuxSource>) => void;
};

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function roundInt(value: number, min: number, max: number) {
    return Math.round(clamp(value, min, max));
}

function peakFromShape(shape: number) {
    return 0.5 + (clamp(shape, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX) * 0.5);
}

function rawSkewedBump(phase: number, shape: number) {
    const x = clamp(phase, 0, 1);
    const peak = peakFromShape(shape);

    if (peak <= 0.000001) {
        return 1 - x;
    }

    if (peak >= 0.999999) {
        return x;
    }

    if (x <= peak) {
        return x / peak;
    }

    return (1 - x) / (1 - peak);
}

export function sampleAuxSource({ phase, shape, sourceCurve }: AuxSourceSample) {
    const raw = rawSkewedBump(phase, shape);
    const safeShape = clamp(shape, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX);
    const safeCurve = clamp(sourceCurve, SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX);
    const roundAmount = 1 - Math.abs(safeShape);
    const rounded = raw + ((Math.sin(raw * Math.PI * 0.5) - raw) * roundAmount);

    if (safeCurve > 0) {
        const power = 1 + (safeCurve * 14);
        return clamp(1 - Math.pow(1 - rounded, power), 0, 1);
    }

    if (safeCurve < 0) {
        const power = 1 + (Math.abs(safeCurve) * 5);
        return clamp(Math.pow(rounded, power), 0, 1);
    }

    return clamp(rounded, 0, 1);
}

export function auxSourcePreviewPoint(
    sample: AuxSourceSample,
    width = 200,
    height = 22,
) {
    const clampedPhase = clamp(sample.phase, 0, 1);
    const paddingX = 2;
    const paddingY = 2;
    const plotWidth = width - (paddingX * 2);
    const plotHeight = height - (paddingY * 2);
    const value = sampleAuxSource({
        phase: clampedPhase,
        shape: sample.shape,
        sourceCurve: sample.sourceCurve,
    });

    return {
        x: paddingX + (clampedPhase * plotWidth),
        y: paddingY + ((1 - value) * plotHeight),
    };
}

export function auxSourceMonitorPoint(
    phase: number,
    amount: number,
    width = 200,
    height = 22,
) {
    const paddingX = 2;
    const paddingY = 2;
    const plotWidth = width - (paddingX * 2);
    const plotHeight = height - (paddingY * 2);

    return {
        x: paddingX + (clamp(phase, 0, 1) * plotWidth),
        y: paddingY + ((1 - clamp(amount, 0, 1)) * plotHeight),
    };
}

export function buildAuxSourcePreviewPath(
    source: Pick<SeqFxAuxSource, "shape" | "sourceCurve">,
    width = 200,
    height = 22,
) {
    const points: string[] = [];
    const steps = 64;

    for (let index = 0; index <= steps; index += 1) {
        const phase = index / steps;
        const point = auxSourcePreviewPoint({
            phase,
            shape: source.shape,
            sourceCurve: source.sourceCurve,
        }, width, height);
        points.push(`${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
    }

    return points.join(" ");
}

function formatShape(value: number) {
    return clamp(value, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX).toFixed(2);
}

function formatCurve(value: number) {
    return clamp(value, SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX).toFixed(2);
}

function rateModeLabel(mode: SeqFxAuxRateMode) {
    return mode === SEQFX_AUX_RATE_MODES.tempo ? "Tempo" : "Slices";
}

export function AuxSource({ source, cyclePhase, amount, onSourceChange }: AuxSourceProps) {
    const safePhase = clamp(cyclePhase, 0, 1);
    const safeAmount = clamp(amount, 0, 1);
    const path = useMemo(() => buildAuxSourcePreviewPath(source, 200, 48), [source.shape, source.sourceCurve]);
    const dotPoint = auxSourceMonitorPoint(safePhase, safeAmount, 200, 48);
    const dotX = dotPoint.x.toFixed(1);
    const dotY = dotPoint.y.toFixed(1);
    const tempoMultiplier = roundInt(source.tempoMultiplier, SEQFX_AUX_TEMPO_MULTIPLIER_MIN, SEQFX_AUX_TEMPO_MULTIPLIER_MAX);
    const sliceCount = roundInt(source.sliceCount, SEQFX_AUX_SLICE_COUNT_MIN, SEQFX_AUX_SLICE_COUNT_MAX);
    const isTempo = source.rateMode === SEQFX_AUX_RATE_MODES.tempo;

    return (
        <div className="aux-source" data-role="seqfx-aux-source">
            <div className="aux-source__head">
                <span className="aux-source__title">Mod Source</span>
                <span className="aux-source__sub">Shared</span>
            </div>
            <div className="aux-source__preview">
                <svg viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
                    <path className="aux-source__line" data-role="seqfx-aux-source-preview-path" d={path} />
                    <circle
                        className="aux-source__dot"
                        data-role="seqfx-aux-source-preview-dot"
                        cx={dotX}
                        cy={dotY}
                        r="2.2"
                    />
                </svg>
            </div>
            <label className="aux-source__slider">
                <span>Shape</span>
                <input
                    aria-label="Mod source shape"
                    data-role="seqfx-aux-source-shape"
                    max={SEQFX_AUX_SHAPE_MAX}
                    min={SEQFX_AUX_SHAPE_MIN}
                    onChange={(event) => onSourceChange({ shape: Number(event.currentTarget.value) })}
                    step={0.01}
                    type="range"
                    value={clamp(source.shape, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX)}
                />
                <output>{formatShape(source.shape)}</output>
            </label>
            <label className="aux-source__slider">
                <span>Curve</span>
                <input
                    aria-label="Mod source curve"
                    data-role="seqfx-aux-source-curve"
                    max={SEQFX_AUX_SOURCE_CURVE_MAX}
                    min={SEQFX_AUX_SOURCE_CURVE_MIN}
                    onChange={(event) => onSourceChange({ sourceCurve: Number(event.currentTarget.value) })}
                    step={0.01}
                    type="range"
                    value={clamp(source.sourceCurve, SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX)}
                />
                <output>{formatCurve(source.sourceCurve)}</output>
            </label>
            <div className="aux-source__rate-head" role="group" aria-label="Mod source rate mode">
                {[SEQFX_AUX_RATE_MODES.tempo, SEQFX_AUX_RATE_MODES.slice].map((mode) => (
                    <button
                        aria-pressed={source.rateMode === mode}
                        className={source.rateMode === mode ? "is-selected" : undefined}
                        data-mode={mode}
                        data-role="seqfx-aux-rate-mode"
                        key={mode}
                        onClick={() => onSourceChange({ rateMode: mode })}
                        type="button"
                    >
                        {rateModeLabel(mode)}
                    </button>
                ))}
            </div>
            <label className="aux-source__slider">
                <span>{isTempo ? "Rate" : "Slices"}</span>
                <input
                    aria-label={isTempo ? "Mod source tempo multiplier" : "Mod source slice count"}
                    data-role="seqfx-aux-rate-value"
                    max={isTempo ? SEQFX_AUX_TEMPO_MULTIPLIER_MAX : SEQFX_AUX_SLICE_COUNT_MAX}
                    min={isTempo ? SEQFX_AUX_TEMPO_MULTIPLIER_MIN : SEQFX_AUX_SLICE_COUNT_MIN}
                    onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        onSourceChange(isTempo
                            ? { tempoMultiplier: value }
                            : { sliceCount: value });
                    }}
                    step={1}
                    type="range"
                    value={isTempo ? tempoMultiplier : sliceCount}
                />
                <output>{isTempo ? `1/16 x ${tempoMultiplier}` : String(sliceCount)}</output>
            </label>
            {isTempo ? (
                <label className="aux-source__triplet">
                    <input
                        checked={source.tempoTriplet}
                        data-role="seqfx-aux-tempo-triplet"
                        onChange={(event) => onSourceChange({ tempoTriplet: event.currentTarget.checked })}
                        type="checkbox"
                    />
                    <span>Triplet</span>
                </label>
            ) : null}
            <output className="aux-source__phase" data-role="seqfx-aux-source-phase-readout">
                {safePhase.toFixed(2)} / {safeAmount.toFixed(2)}
            </output>
        </div>
    );
}
