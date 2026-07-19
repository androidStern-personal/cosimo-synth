/**
 * White-on-black filter energy painter for the etched ink treatment.
 * Filter response, analyzer smoothing, and plot geometry remain owned by the
 * production filter modules; this module only turns their output into pixels.
 */

import {
    createDefaultCurveProfile,
    evaluateCurveProfile,
    invertCurveProfile,
} from "./curve-lab";
import {
    FILTER_CUTOFF_MAX_HZ,
    FILTER_CUTOFF_MIN_HZ,
    FILTER_Q_MAX,
    FILTER_Q_MIN,
    filterCutoffHzToNormalized,
    filterQToNormalized,
    normalizedToFilterCutoffHz,
    normalizedToFilterQ,
} from "./filter-response";
import { type FilterSpectrumRenderGeometry } from "./filter-spectrum";

const FILTER_RESONANCE_CURVE_TARGET_ID = "filter-resonance-handle";
const FILTER_RESONANCE_CURVE_PROFILE = createDefaultCurveProfile(FILTER_RESONANCE_CURVE_TARGET_ID);

/** A point normalized to the filter plot, with y increasing toward the bottom. */
export type FilterEnergyResponsePoint = {
    readonly x: number;
    readonly y: number;
};

/** Inputs already resolved by the production filter response and spectrum pipeline. */
export type FilterEnergyFieldState = {
    readonly spectrumGeometry: FilterSpectrumRenderGeometry;
    readonly responsePoints: ReadonlyArray<FilterEnergyResponsePoint>;
    readonly width: number;
    readonly height: number;
};

/** Energy calibration for analyzer tone and the hero response curve. */
export type FilterEnergyParams = {
    readonly spectrumEnergy: number;
    readonly spectrumLineEnergy: number;
    readonly responseWidthPx: number;
    readonly responseGlowPx: number;
    readonly responseGlowStrength: number;
    readonly responseEnergy: number;
};

/** Filter plot rectangle in CSS-pixel coordinates. */
export type FilterEnergyPlotRect = {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
};

/** Filter cutoff and resonance values resolved from a plot drag. */
export type FilterDragValues = {
    readonly cutoffHz: number;
    readonly q: number;
};

/** Filter handle position in CSS-pixel plot coordinates. */
export type FilterHandlePosition = {
    readonly plotX: number;
    readonly plotY: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

function energyAlpha(value: number): number {
    return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function traceSpectrumPolyline(
    context: CanvasRenderingContext2D,
    points: ReadonlyArray<{ readonly x: number; readonly y: number }>,
): void {
    for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        if (point === undefined) {
            continue;
        }

        if (index === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    }
}

/** Return the dossier-calibrated filter energy defaults. */
export function createDefaultFilterEnergyParams(): FilterEnergyParams {
    return {
        // Sub-coverage energies: with the wash treatment the analyzer must
        // print as LIGHT tone — energy above the coverage knee (≈1/inkDensity)
        // lands in the tonal model's densest region and prints near-black.
        spectrumEnergy: 0.03,
        spectrumLineEnergy: 0.08,
        responseWidthPx: 2.5,
        responseGlowPx: 9,
        responseGlowStrength: 0.12,
        responseEnergy: 0.95,
    };
}

/**
 * Paint production filter geometry as a white-on-black etched energy field.
 * Grid lines, labels, and the draggable handle intentionally remain host chrome.
 */
export function paintFilterEnergyField(
    context: CanvasRenderingContext2D,
    state: FilterEnergyFieldState,
    params: FilterEnergyParams = createDefaultFilterEnergyParams(),
): void {
    const geometry = state.spectrumGeometry;
    const spectrumFillEnergy = energyAlpha(params.spectrumEnergy);
    const spectrumStrokeEnergy = energyAlpha(params.spectrumLineEnergy);

    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";
    context.lineJoin = "round";
    context.lineCap = "round";

    if (geometry.kind === "graph") {
        const firstPoint = geometry.points[0];
        const lastPoint = geometry.points[geometry.points.length - 1];

        if (firstPoint !== undefined && lastPoint !== undefined) {
            context.beginPath();
            context.moveTo(firstPoint.x, geometry.plotBottom);
            traceSpectrumPolyline(context, geometry.points);
            context.lineTo(lastPoint.x, geometry.plotBottom);
            context.closePath();
            context.fillStyle = `rgba(255,255,255,${spectrumFillEnergy})`;
            context.fill();

            context.beginPath();
            traceSpectrumPolyline(context, geometry.points);
            context.strokeStyle = `rgba(255,255,255,${spectrumStrokeEnergy})`;
            context.lineWidth = 1.25;
            context.stroke();
        }
    } else {
        context.fillStyle = `rgba(255,255,255,${spectrumFillEnergy})`;
        context.strokeStyle = `rgba(255,255,255,${spectrumStrokeEnergy})`;
        context.lineWidth = 1;
        for (const bar of geometry.bars) {
            if (bar.width <= 0 || bar.height <= 0) {
                continue;
            }
            context.fillRect(bar.x, bar.y, bar.width, bar.height);
            context.strokeRect(bar.x, bar.y, bar.width, bar.height);
        }
    }

    const firstResponsePoint = state.responsePoints[0];
    if (firstResponsePoint !== undefined && state.responsePoints.length >= 2) {
        context.beginPath();
        for (let index = 0; index < state.responsePoints.length; index += 1) {
            const point = state.responsePoints[index];
            if (point === undefined) {
                continue;
            }
            const x = geometry.plotLeft + (geometry.plotWidth * clamp(point.x, 0, 1));
            const y = geometry.plotTop + (geometry.plotHeight * clamp(point.y, 0, 1));
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.responseEnergy)})`;
        context.lineWidth = Math.max(0.5, params.responseWidthPx);
        context.shadowBlur = Math.max(0, params.responseGlowPx);
        context.shadowColor = `rgba(255,255,255,${energyAlpha(params.responseGlowStrength)})`;
        context.stroke();
    }

    context.restore();
}

/**
 * Resolve a filter drag through the tuned resonance sigmoid used by the desktop control.
 */
export function resolveFilterDragValues({
    plotX,
    plotY,
    plotRect,
}: {
    readonly plotX: number;
    readonly plotY: number;
    readonly plotRect: FilterEnergyPlotRect;
}): FilterDragValues {
    const width = Math.max(1, plotRect.width);
    const height = Math.max(1, plotRect.height);
    const cutoffSurface = clamp((plotX - plotRect.left) / width, 0, 1);
    const resonanceSurface = clamp(1 - ((plotY - plotRect.top) / height), 0, 1);
    const resonanceNormalized = evaluateCurveProfile(
        FILTER_RESONANCE_CURVE_TARGET_ID,
        FILTER_RESONANCE_CURVE_PROFILE,
        resonanceSurface,
    );

    return {
        cutoffHz: clamp(
            normalizedToFilterCutoffHz(cutoffSurface),
            FILTER_CUTOFF_MIN_HZ,
            FILTER_CUTOFF_MAX_HZ,
        ),
        q: clamp(normalizedToFilterQ(resonanceNormalized), FILTER_Q_MIN, FILTER_Q_MAX),
    };
}

/**
 * Map filter values back to the tuned drag surface, including the inverse sigmoid.
 */
export function handlePositionForValues({
    cutoffHz,
    q,
    plotRect,
}: {
    readonly cutoffHz: number;
    readonly q: number;
    readonly plotRect: FilterEnergyPlotRect;
}): FilterHandlePosition {
    const cutoffSurface = filterCutoffHzToNormalized(cutoffHz);
    const resonanceSurface = invertCurveProfile(
        FILTER_RESONANCE_CURVE_TARGET_ID,
        FILTER_RESONANCE_CURVE_PROFILE,
        filterQToNormalized(q),
    );

    return {
        plotX: plotRect.left + (Math.max(1, plotRect.width) * cutoffSurface),
        plotY: plotRect.top + (Math.max(1, plotRect.height) * (1 - resonanceSurface)),
    };
}
