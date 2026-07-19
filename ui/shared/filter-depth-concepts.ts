/**
 * Two 3D filter representations in the depth-stack ink language, for the
 * Phase-4 concept decision (research: the front plane must stay the truthful
 * 2D spectrum+curve overlay on SHARED axes; depth must carry real
 * information — CSD-style time, or the instrument's own parameter).
 *
 * Concept D — "carved mountain": depth = the live spectrum's PAST. The front
 * plane is the REAL desktop analyzer (all three render modes + peak hold)
 * with the response curve as hero; history recedes as contour silhouettes.
 * Concept B — "filter table": depth = the cutoff sweep at the current Q;
 * the hero slice travels the stack; the live analyzer sits as the floor.
 *
 * Structural guarantees learned the hard way:
 * - FIT: layer offsets are clamped against the plot rect and the curve height
 *   shrinks to the remaining headroom, so NO parameter combination can
 *   overflow the frame.
 * - NO TONAL TRAP: distant layers never fade by lowering fill energy (in the
 *   withheld-ink model, low-but-covered energy prints DENSE). Depth fades by
 *   REDUCING COVERAGE — far layers are thin hot-stroke contours with
 *   tapering width; only the nearest few layers carry fills.
 */

import { type FilterEnergyPlotRect } from "./filter-energy-field";
import {
    FILTER_MODE_LOWPASS,
    createFilterResponseModel,
    magnitudeAtFrequency,
    normalizedToFilterCutoffHz,
} from "./filter-response";
import { type FilterSpectrumRenderGeometry } from "./filter-spectrum";

const RESPONSE_DB_MIN = -24;
const RESPONSE_DB_MAX = 18;

/** A response curve in normalized plot coordinates (y down, 0..1 both axes). */
export type NormalizedCurve = ReadonlyArray<{ readonly x: number; readonly y: number }>;

/** Shared depth-stack geometry request (the lab's layer offsets, pre-clamp). */
export type DepthStackParams = {
    readonly layers: number;
    readonly depth: number;
};

/** Hero-line treatment (identical vocabulary to the wavetable's). */
export type HeroParams = {
    readonly widthPx: number;
    readonly glowPx: number;
    readonly glowStrength: number;
    readonly energy: number;
};

/** Energy calibration for the REAL analyzer painted as the front plane/floor. */
export type SpectrumPaintParams = {
    readonly fillEnergy: number;
    readonly lineEnergy: number;
    readonly peakEnergy: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

function energyAlpha(value: number): number {
    return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function dbToNormalizedY(db: number): number {
    return 1 - (clamp(db, RESPONSE_DB_MIN, RESPONSE_DB_MAX) - RESPONSE_DB_MIN)
        / (RESPONSE_DB_MAX - RESPONSE_DB_MIN);
}

/**
 * Compute one response curve in normalized plot coordinates.
 *
 * @param cutoffHz - Filter cutoff.
 * @param q - Filter resonance.
 * @param pointCount - Curve resolution.
 * @returns Points with x = log-frequency position, y = response (down).
 */
export function buildNormalizedResponseCurve(
    cutoffHz: number,
    q: number,
    pointCount = 120,
): NormalizedCurve {
    const model = createFilterResponseModel({
        mode: FILTER_MODE_LOWPASS,
        cutoffHz,
        q,
        sampleRate: 48_000,
    });
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < pointCount; index += 1) {
        const x = index / (pointCount - 1);
        const db = magnitudeAtFrequency(model, normalizedToFilterCutoffHz(x));
        points.push({ x, y: dbToNormalizedY(db) });
    }
    return points;
}

/**
 * Concept B's curve family: the cutoff sweep at the current resonance.
 *
 * @param q - Current resonance (shapes every family member).
 * @param layers - Family size.
 * @param pointCount - Curve resolution.
 * @returns One normalized curve per layer (layer 0 = lowest cutoff = front).
 */
export function buildFilterFamilyCurves(
    q: number,
    layers: number,
    pointCount = 120,
): ReadonlyArray<NormalizedCurve> {
    const family: Array<NormalizedCurve> = [];
    for (let layer = 0; layer < layers; layer += 1) {
        const cutoffNormalized = layers <= 1 ? 0.5 : layer / (layers - 1);
        family.push(buildNormalizedResponseCurve(
            normalizedToFilterCutoffHz(cutoffNormalized),
            q,
            pointCount,
        ));
    }
    return family;
}

/**
 * A stride-gated history ring for spectrum layers (concept D's depth data).
 */
export function createSpectrumHistoryRing(layers: number, strideMs: number): {
    push(heights: ReadonlyArray<number>, nowMs: number): void;
    /** Index 0 = now (live), increasing = further into the past. */
    getLayers(): ReadonlyArray<ReadonlyArray<number>>;
} {
    const ring: Array<ReadonlyArray<number>> = [];
    let lastCaptureMs = Number.NEGATIVE_INFINITY;
    let live: ReadonlyArray<number> = [];

    return {
        push(heights, nowMs) {
            live = heights;
            if (nowMs - lastCaptureMs >= strideMs) {
                lastCaptureMs = nowMs;
                ring.unshift(heights);
                if (ring.length > layers) {
                    ring.length = layers;
                }
            }
        },
        getLayers() {
            return [live, ...ring];
        },
    };
}

/** The clamped, fit-guaranteed stack layout shared by painters and hosts. */
export type StackLayout = {
    readonly originX: number;
    readonly baseY: number;
    readonly spanW: number;
    readonly curveHeightPx: number;
    readonly dx: number;
    readonly dy: number;
    readonly layers: number;
};

/**
 * Resolve the depth stack against a plot rect such that every layer and its
 * full curve height stay inside the rect at ANY layers/depth combination.
 *
 * @param plot - The plot rectangle in CSS px.
 * @param stack - Requested layer count and depth amount.
 * @returns The clamped layout (also used by hosts to place chrome like the
 * drag handle at a layer's depth offset).
 */
export function computeStackLayout(plot: FilterEnergyPlotRect, stack: DepthStackParams): StackLayout {
    const layers = Math.max(2, Math.round(stack.layers));
    const rawDx = clamp(stack.depth, 0, 1) * 7;
    const rawDy = clamp(stack.depth, 0, 1) * 8.5;
    const dx = Math.min(rawDx, (plot.width * 0.5) / (layers - 1));
    const dy = Math.min(rawDy, (plot.height * 0.62) / (layers - 1));
    return {
        originX: plot.left,
        baseY: plot.top + plot.height,
        spanW: Math.max(40, plot.width - dx * (layers - 1)),
        curveHeightPx: Math.max(30, plot.height - dy * (layers - 1) - 6),
        dx,
        dy,
        layers,
    };
}

function traceLayerCurve(
    context: CanvasRenderingContext2D,
    layout: StackLayout,
    depthIndex: number,
    xs: (i: number) => number,
    ys: (i: number) => number,
    pointCount: number,
): void {
    const ox = layout.originX + depthIndex * layout.dx;
    const oy = -depthIndex * layout.dy;
    for (let index = 0; index < pointCount; index += 1) {
        const x = ox + xs(index) * layout.spanW;
        const y = layout.baseY + oy - ys(index) * layout.curveHeightPx;
        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
}

/**
 * Paint the REAL analyzer geometry (any render mode, peak hold included) as
 * front-plane energy, horizontally compressed into the stack's span so it
 * shares axes with the depth layers.
 */
export function paintSpectrumGeometryEnergy(
    context: CanvasRenderingContext2D,
    geometry: FilterSpectrumRenderGeometry,
    layout: StackLayout,
    params: SpectrumPaintParams,
): void {
    const scaleX = layout.spanW / Math.max(1, geometry.plotWidth);
    const mapX = (x: number) => layout.originX + (x - geometry.plotLeft) * scaleX;
    const heightScale = layout.curveHeightPx / Math.max(1, geometry.plotHeight);
    const mapY = (y: number) => layout.baseY - (geometry.plotBottom - y) * heightScale;

    if (geometry.kind === "graph") {
        if (geometry.points.length >= 2) {
            const first = geometry.points[0];
            const last = geometry.points[geometry.points.length - 1];
            if (first !== undefined && last !== undefined) {
                context.beginPath();
                context.moveTo(mapX(first.x), layout.baseY);
                for (const point of geometry.points) {
                    context.lineTo(mapX(point.x), mapY(point.y));
                }
                context.lineTo(mapX(last.x), layout.baseY);
                context.closePath();
                context.fillStyle = `rgba(255,255,255,${energyAlpha(params.fillEnergy)})`;
                context.fill();

                context.beginPath();
                geometry.points.forEach((point, index) => {
                    if (index === 0) context.moveTo(mapX(point.x), mapY(point.y));
                    else context.lineTo(mapX(point.x), mapY(point.y));
                });
                context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.lineEnergy)})`;
                context.lineWidth = 1.25;
                context.stroke();
            }
        }
        if (geometry.peakPoints.length >= 2 && params.peakEnergy > 0) {
            context.beginPath();
            geometry.peakPoints.forEach((point, index) => {
                if (index === 0) context.moveTo(mapX(point.x), mapY(point.y));
                else context.lineTo(mapX(point.x), mapY(point.y));
            });
            context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.peakEnergy)})`;
            context.lineWidth = 1;
            context.stroke();
        }
        return;
    }

    context.fillStyle = `rgba(255,255,255,${energyAlpha(params.fillEnergy)})`;
    for (const bar of geometry.bars) {
        const barWidth = Math.max(1, bar.width * scaleX);
        const barHeight = (bar.height / Math.max(1, geometry.plotHeight)) * layout.curveHeightPx;
        const x = mapX(bar.x);
        const y = layout.baseY - (geometry.plotBottom - bar.y) * heightScale;
        if (geometry.rounded) {
            const radius = Math.min(barWidth / 2, 2.5);
            context.beginPath();
            context.roundRect(x, y, barWidth, barHeight, radius);
            context.fill();
        } else {
            context.fillRect(x, y, barWidth, barHeight);
        }
    }
    if (params.peakEnergy > 0) {
        context.fillStyle = `rgba(255,255,255,${energyAlpha(params.peakEnergy)})`;
        for (const peak of geometry.peakBars) {
            const barWidth = Math.max(1, peak.width * scaleX);
            const y = layout.baseY - (geometry.plotBottom - peak.y) * heightScale;
            context.fillRect(mapX(peak.x), y, barWidth, Math.max(1, peak.height * heightScale));
        }
    }
}

/** Concept D inputs. */
export type CarvedMountainState = {
    readonly width: number;
    readonly height: number;
    readonly plot: FilterEnergyPlotRect;
    /** The REAL analyzer geometry for the live front plane. */
    readonly frontGeometry: FilterSpectrumRenderGeometry;
    /** History silhouettes: index 0 = now, increasing = past. */
    readonly spectrumLayers: ReadonlyArray<ReadonlyArray<number>>;
    readonly responseCurve: NormalizedCurve;
};

/** Concept D energy calibration. */
export type CarvedMountainParams = {
    readonly stack: DepthStackParams;
    readonly spectrum: SpectrumPaintParams;
    /** How many nearest history layers keep gradient fills (rest are contours). */
    readonly fillLayers: number;
    /** Line-width taper exponent for far contour layers. */
    readonly depthFade: number;
    readonly hero: HeroParams;
};

/**
 * Concept D — the carved mountain: the real analyzer lives on the front
 * plane; the signal's past recedes as contour silhouettes.
 */
export function paintFilterCarvedMountain(
    context: CanvasRenderingContext2D,
    state: CarvedMountainState,
    params: CarvedMountainParams,
): void {
    const layout = computeStackLayout(state.plot, params.stack);
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";

    const layerTotal = Math.min(layout.layers, state.spectrumLayers.length);
    for (let depthIndex = layerTotal - 1; depthIndex >= 1; depthIndex -= 1) {
        const heights = state.spectrumLayers[depthIndex];
        if (heights === undefined || heights.length < 2) continue;
        const depthNormalized = depthIndex / Math.max(1, layout.layers - 1);

        if (depthIndex < Math.max(0, params.fillLayers)) {
            // Near past: gradient fills like the front, gently receding.
            const ox = layout.originX + depthIndex * layout.dx;
            const oy = -depthIndex * layout.dy;
            let minY = layout.baseY + oy;
            context.beginPath();
            traceLayerCurve(context, layout, depthIndex,
                (i) => i / (heights.length - 1), (i) => heights[i] ?? 0, heights.length);
            for (const height of heights) {
                const y = layout.baseY + oy - (height ?? 0) * layout.curveHeightPx;
                if (y < minY) minY = y;
            }
            context.lineTo(ox + layout.spanW, layout.baseY + oy);
            context.lineTo(ox, layout.baseY + oy);
            context.closePath();
            const gradient = context.createLinearGradient(0, minY, 0, layout.baseY + oy);
            const fillEnergy = params.spectrum.fillEnergy * (1 - depthNormalized * 0.4);
            gradient.addColorStop(0, `rgba(255,255,255,${energyAlpha(fillEnergy * 1.9)})`);
            gradient.addColorStop(0.55, `rgba(255,255,255,${energyAlpha(fillEnergy * 0.55)})`);
            gradient.addColorStop(1, "rgba(255,255,255,0)");
            context.fillStyle = gradient;
            context.fill();
        }

        // Contour line at every depth: CONSTANT hot energy (prints as a light
        // etched line), fading by WIDTH only — never by energy (tonal trap).
        const lineWidth = Math.max(0.4, 1.5 * Math.pow(1 - depthNormalized, params.depthFade));
        context.beginPath();
        traceLayerCurve(context, layout, depthIndex,
            (i) => i / (heights.length - 1), (i) => heights[i] ?? 0, heights.length);
        context.strokeStyle = "rgba(255,255,255,0.92)";
        context.lineWidth = lineWidth;
        context.stroke();
    }

    paintSpectrumGeometryEnergy(context, state.frontGeometry, layout, params.spectrum);

    if (state.responseCurve.length >= 2 && params.hero.energy > 0) {
        context.beginPath();
        traceLayerCurve(context, layout, 0,
            (i) => state.responseCurve[i]?.x ?? 0,
            (i) => 1 - (state.responseCurve[i]?.y ?? 1),
            state.responseCurve.length);
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.hero.energy)})`;
        context.lineWidth = Math.max(0.5, params.hero.widthPx);
        context.shadowBlur = Math.max(0, params.hero.glowPx);
        context.shadowColor = `rgba(255,255,255,${energyAlpha(params.hero.glowStrength)})`;
        context.stroke();
        context.shadowBlur = 0;
    }
    context.restore();
}

/** Concept B inputs. */
export type FilterTableState = {
    readonly width: number;
    readonly height: number;
    readonly plot: FilterEnergyPlotRect;
    readonly familyCurves: ReadonlyArray<NormalizedCurve>;
    readonly heroCurve: NormalizedCurve;
    /** Where the hero sits in the sweep, 0..1 (its depth position). */
    readonly heroDepth: number;
    /** The REAL analyzer geometry for the front-plane floor. */
    readonly floorGeometry: FilterSpectrumRenderGeometry;
};

/** Concept B energy calibration. */
export type FilterTableParams = {
    readonly stack: DepthStackParams;
    readonly familyEnergy: number;
    readonly spectrum: SpectrumPaintParams;
    readonly hero: HeroParams;
};

/**
 * Concept B — the filter table: the cutoff sweep is the stack, the hero
 * slice travels it, and the REAL analyzer sits as the front-plane floor.
 */
export function paintFilterTable(
    context: CanvasRenderingContext2D,
    state: FilterTableState,
    params: FilterTableParams,
): void {
    const layout = computeStackLayout(state.plot, params.stack);
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";

    paintSpectrumGeometryEnergy(context, state.floorGeometry, layout, params.spectrum);

    const layerTotal = Math.min(layout.layers, state.familyCurves.length);
    for (let depthIndex = layerTotal - 1; depthIndex >= 0; depthIndex -= 1) {
        const curve = state.familyCurves[depthIndex];
        if (curve === undefined || curve.length < 2) continue;
        const depthNormalized = layerTotal <= 1 ? 0 : depthIndex / (layerTotal - 1);
        const distanceFromHero = Math.abs(depthNormalized - clamp(state.heroDepth, 0, 1));
        // Family fades by WIDTH with distance from the hero, energy stays hot.
        const lineWidth = Math.max(0.4, 1.3 * (0.35 + 0.65 * (1 - distanceFromHero)));
        context.beginPath();
        traceLayerCurve(context, layout, depthIndex,
            (i) => curve[i]?.x ?? 0, (i) => 1 - (curve[i]?.y ?? 1), curve.length);
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(0.55 + 0.45 * params.familyEnergy)})`;
        context.lineWidth = lineWidth * Math.max(0.2, params.familyEnergy * 2);
        context.stroke();
    }

    const heroDepthIndex = clamp(state.heroDepth, 0, 1) * (layout.layers - 1);
    if (state.heroCurve.length >= 2 && params.hero.energy > 0) {
        context.beginPath();
        traceLayerCurve(context, layout, heroDepthIndex,
            (i) => state.heroCurve[i]?.x ?? 0,
            (i) => 1 - (state.heroCurve[i]?.y ?? 1),
            state.heroCurve.length);
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.hero.energy)})`;
        context.lineWidth = Math.max(0.5, params.hero.widthPx);
        context.shadowBlur = Math.max(0, params.hero.glowPx);
        context.shadowColor = `rgba(255,255,255,${energyAlpha(params.hero.glowStrength)})`;
        context.stroke();
        context.shadowBlur = 0;
    }
    context.restore();
}
