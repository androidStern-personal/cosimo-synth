/**
 * Two 3D filter representations in the depth-stack ink language, for the
 * Phase-4 concept decision (research: the front plane must stay the truthful
 * 2D spectrum+curve overlay on SHARED axes; depth must carry real
 * information — CSD-style time, or the instrument's own parameter).
 *
 * Concept D — "carved mountain": depth = the live spectrum's PAST (the
 * signal's history recedes as etched ghost layers; the response curve is the
 * front-plane hero). Concept B — "filter table": depth = the cutoff sweep
 * (the family of response curves at the current Q; the hero slice travels
 * through the stack with the cutoff, like the wavetable's scan slice).
 *
 * Both painters emit white-on-black ENERGY for the etched pass. Grid, labels,
 * and the drag handle stay host vector ink.
 */

import {
    FILTER_MODE_LOWPASS,
    createFilterResponseModel,
    magnitudeAtFrequency,
    normalizedToFilterCutoffHz,
} from "./filter-response";
import { type FilterEnergyPlotRect } from "./filter-energy-field";

const RESPONSE_DB_MIN = -24;
const RESPONSE_DB_MAX = 18;

/** A response curve in normalized plot coordinates (y down, 0..1 both axes). */
export type NormalizedCurve = ReadonlyArray<{ readonly x: number; readonly y: number }>;

/** Shared depth-stack geometry (the lab's layer offsets). */
export type DepthStackParams = {
    /** Ghost layer count including the front plane. */
    readonly layers: number;
    /** Depth amount 0..1 → per-layer offset (lab: dx = 7·depth, dy = 8.5·depth). */
    readonly depth: number;
};

/** Hero-line treatment (identical vocabulary to the wavetable's). */
export type HeroParams = {
    readonly widthPx: number;
    readonly glowPx: number;
    readonly glowStrength: number;
    readonly energy: number;
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
 * Layer 0 is the LOWEST cutoff (front of the stack); the last layer is the
 * highest. Pure and cacheable — it changes only with q or layer count.
 *
 * @param q - Current resonance (shapes every family member).
 * @param layers - Family size.
 * @param pointCount - Curve resolution.
 * @returns One normalized curve per layer.
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
 * Push the live frame every call; a new layer is captured only when
 * `strideMs` has elapsed, so depth spacing is time-true like a CSD.
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

type StackGeometry = {
    readonly originX: number;
    readonly baseY: number;
    readonly spanW: number;
    readonly plotH: number;
    readonly dx: number;
    readonly dy: number;
};

function stackGeometry(plot: FilterEnergyPlotRect, stack: DepthStackParams): StackGeometry {
    const dx = stack.depth * 7;
    const dy = stack.depth * 8.5;
    const spanW = Math.max(40, plot.width - dx * (stack.layers - 1));
    return {
        originX: plot.left,
        baseY: plot.top + plot.height,
        spanW,
        plotH: plot.height,
        dx,
        dy,
    };
}

function traceLayerCurve(
    context: CanvasRenderingContext2D,
    geometry: StackGeometry,
    depthIndex: number,
    xs: (i: number) => number,
    ys: (i: number) => number,
    pointCount: number,
): void {
    const ox = geometry.originX + depthIndex * geometry.dx;
    const oy = -depthIndex * geometry.dy;
    for (let index = 0; index < pointCount; index += 1) {
        const x = ox + xs(index) * geometry.spanW;
        const y = geometry.baseY + oy - ys(index) * geometry.plotH * 0.82;
        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
}

function fillLayer(
    context: CanvasRenderingContext2D,
    geometry: StackGeometry,
    depthIndex: number,
    heights: ReadonlyArray<number>,
    energy: number,
): void {
    if (heights.length < 2 || energy <= 0.003) {
        return;
    }
    const ox = geometry.originX + depthIndex * geometry.dx;
    const oy = -depthIndex * geometry.dy;
    let minY = geometry.baseY + oy;
    context.beginPath();
    traceLayerCurve(
        context,
        geometry,
        depthIndex,
        (i) => i / (heights.length - 1),
        (i) => heights[i] ?? 0,
        heights.length,
    );
    for (const height of heights) {
        const y = geometry.baseY + oy - (height ?? 0) * geometry.plotH * 0.82;
        if (y < minY) minY = y;
    }
    context.lineTo(ox + geometry.spanW, geometry.baseY + oy);
    context.lineTo(ox, geometry.baseY + oy);
    context.closePath();
    const gradient = context.createLinearGradient(0, minY, 0, geometry.baseY + oy);
    gradient.addColorStop(0, `rgba(255,255,255,${energyAlpha(energy * 1.9)})`);
    gradient.addColorStop(0.5, `rgba(255,255,255,${energyAlpha(energy * 0.55)})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = `rgba(255,255,255,${energyAlpha(Math.min(0.45, energy * 2))})`;
    context.lineWidth = 1;
    context.stroke();
}

function strokeHero(
    context: CanvasRenderingContext2D,
    geometry: StackGeometry,
    depthIndex: number,
    curve: NormalizedCurve,
    hero: HeroParams,
): void {
    if (curve.length < 2 || hero.energy <= 0) {
        return;
    }
    context.beginPath();
    traceLayerCurve(
        context,
        geometry,
        depthIndex,
        (i) => curve[i]?.x ?? 0,
        (i) => 1 - (curve[i]?.y ?? 1),
        curve.length,
    );
    context.strokeStyle = `rgba(255,255,255,${energyAlpha(hero.energy)})`;
    context.lineWidth = Math.max(0.5, hero.widthPx);
    context.shadowBlur = Math.max(0, hero.glowPx);
    context.shadowColor = `rgba(255,255,255,${energyAlpha(hero.glowStrength)})`;
    context.stroke();
    context.shadowBlur = 0;
}

/** Concept D inputs. */
export type CarvedMountainState = {
    readonly width: number;
    readonly height: number;
    readonly plot: FilterEnergyPlotRect;
    /** Spectrum layers: index 0 = now, increasing = past. Normalized heights. */
    readonly spectrumLayers: ReadonlyArray<ReadonlyArray<number>>;
    /** The response curve for the front plane. */
    readonly responseCurve: NormalizedCurve;
};

/** Concept D energy calibration. */
export type CarvedMountainParams = {
    readonly stack: DepthStackParams;
    /** Front-plane spectrum energy (sub-coverage for wash legibility). */
    readonly frontEnergy: number;
    /** How fast past layers cool with depth. */
    readonly depthFade: number;
    readonly hero: HeroParams;
};

/**
 * Concept D — the carved mountain: spectrum history recedes into depth; the
 * response curve is the front-plane hero on the SAME log-frequency axis.
 */
export function paintFilterCarvedMountain(
    context: CanvasRenderingContext2D,
    state: CarvedMountainState,
    params: CarvedMountainParams,
): void {
    const geometry = stackGeometry(state.plot, params.stack);
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";

    const layerTotal = Math.min(params.stack.layers, state.spectrumLayers.length);
    for (let depthIndex = layerTotal - 1; depthIndex >= 0; depthIndex -= 1) {
        const heights = state.spectrumLayers[depthIndex];
        if (heights === undefined) continue;
        const fade = Math.pow(1 - depthIndex / Math.max(1, params.stack.layers), params.depthFade);
        fillLayer(context, geometry, depthIndex, heights, params.frontEnergy * fade);
    }

    strokeHero(context, geometry, 0, state.responseCurve, params.hero);
    context.restore();
}

/** Concept B inputs. */
export type FilterTableState = {
    readonly width: number;
    readonly height: number;
    readonly plot: FilterEnergyPlotRect;
    /** The cutoff-sweep family (layer 0 = lowest cutoff = front). */
    readonly familyCurves: ReadonlyArray<NormalizedCurve>;
    /** The live curve at the CURRENT cutoff. */
    readonly heroCurve: NormalizedCurve;
    /** Where the hero sits in the sweep, 0..1 (its depth position). */
    readonly heroDepth: number;
    /** Live spectrum for the front-plane floor (normalized heights). */
    readonly spectrumHeights: ReadonlyArray<number>;
};

/** Concept B energy calibration. */
export type FilterTableParams = {
    readonly stack: DepthStackParams;
    /** Family member stroke energy (fades with distance from the hero). */
    readonly familyEnergy: number;
    /** Front-plane live-spectrum floor energy (sub-coverage). */
    readonly floorEnergy: number;
    readonly hero: HeroParams;
};

/**
 * Concept B — the filter table: the cutoff sweep is the stack, the current
 * position is the traveling hero slice (the wavetable's scan grammar), and
 * the live spectrum sits as a quiet front-plane floor.
 */
export function paintFilterTable(
    context: CanvasRenderingContext2D,
    state: FilterTableState,
    params: FilterTableParams,
): void {
    const geometry = stackGeometry(state.plot, params.stack);
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";

    if (state.spectrumHeights.length >= 2) {
        fillLayer(context, geometry, 0, state.spectrumHeights, params.floorEnergy);
    }

    const layerTotal = Math.min(params.stack.layers, state.familyCurves.length);
    for (let depthIndex = layerTotal - 1; depthIndex >= 0; depthIndex -= 1) {
        const curve = state.familyCurves[depthIndex];
        if (curve === undefined || curve.length < 2) continue;
        const depthNormalized = layerTotal <= 1 ? 0 : depthIndex / (layerTotal - 1);
        const distanceFromHero = Math.abs(depthNormalized - clamp(state.heroDepth, 0, 1));
        const energy = params.familyEnergy * (0.35 + 0.65 * (1 - distanceFromHero));
        context.beginPath();
        traceLayerCurve(
            context,
            geometry,
            depthIndex,
            (i) => curve[i]?.x ?? 0,
            (i) => 1 - (curve[i]?.y ?? 1),
            curve.length,
        );
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(energy)})`;
        context.lineWidth = 1.1;
        context.stroke();
    }

    const heroDepthIndex = clamp(state.heroDepth, 0, 1) * (params.stack.layers - 1);
    strokeHero(context, geometry, heroDepthIndex, state.heroCurve, params.hero);
    context.restore();
}
