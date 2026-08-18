/**
 * Paint a wavetable render model as a grayscale ENERGY field — the native
 * input of the etched ink-on-paper pass (ui/shared/etched-ink.ts).
 *
 * This is "Path B" of the wavetable porting dossier: the pure builders
 * (buildWavetableStaticScene / buildWavetableRenderModel in
 * ui/shared/wavetable-display.ts) own ALL projection, warp, and scan math;
 * this module owns only pixels. White additive strokes/fills on black; the
 * model's own alpha/depth/glow weights become energy so the depth stack
 * fades naturally and the scan slice burns the reserved clean-paper channel
 * (drawn extra-wide, the lab's front-curve treatment).
 *
 * Grid hairlines and labels are deliberately NOT painted here — per the lab,
 * chrome is solid vector ink drawn by the host on the paper, never energy.
 */

/** Energy calibration for the model's primitive classes. */
export type WavetableEnergyParams = {
    /** Fill energy of surface bands at the front of the stack. */
    readonly bandEnergy: number;
    /** Stroke energy multiplier for mesh slices/ribs (model alphas apply too). */
    readonly meshEnergy: number;
    /** Stroke energy for sparse frame contours. */
    readonly contourEnergy: number;
    /** Width of the hero scan slice's reserved channel, px. */
    readonly heroWidthPx: number;
    /** Soft glow radius around the hero slice, px (energy halo). */
    readonly heroGlowPx: number;
    /** Glow intensity 0..1 (shadow alpha) — how far the halo carves. */
    readonly heroGlowStrength: number;
    /**
     * The hero stroke's own energy 0..1. At 1 the slice burns a fully clean
     * channel; lower values let the dither partially reclaim it, making the
     * scan line progressively quieter.
     */
    readonly heroEnergy: number;
};

/** Dossier-calibrated defaults. */
export function createDefaultWavetableEnergyParams(): WavetableEnergyParams {
    return {
        bandEnergy: 0.2,
        meshEnergy: 1.35,
        contourEnergy: 0.5,
        heroWidthPx: 2,
        heroGlowPx: 5,
        heroGlowStrength: 0.6,
        heroEnergy: 1,
    };
}

type ScreenPoint = { readonly x: number; readonly y: number };

type WavetableModelLike = {
    readonly width: number;
    readonly height: number;
    readonly surfaceBands: ReadonlyArray<{
        readonly points: ReadonlyArray<ScreenPoint>;
        readonly depthNormalized: number;
        readonly slopeLight: number;
    }>;
    readonly surfaceSlices: ReadonlyArray<{
        readonly segments: ReadonlyArray<ReadonlyArray<ScreenPoint>>;
        readonly alpha: number;
    }>;
    readonly surfaceRibs: ReadonlyArray<{
        readonly points: ReadonlyArray<ScreenPoint>;
        readonly alpha: number;
    }>;
    readonly contours: ReadonlyArray<{
        readonly segments: ReadonlyArray<ReadonlyArray<ScreenPoint>>;
        readonly alpha: number;
        readonly lineWidth: number;
    }>;
    readonly currentSlice: {
        readonly segments: ReadonlyArray<ReadonlyArray<ScreenPoint>>;
        readonly lineWidth: number;
    };
};

function tracePolyline(context: CanvasRenderingContext2D, points: ReadonlyArray<ScreenPoint>): void {
    points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    });
}

function strokeSegments(
    context: CanvasRenderingContext2D,
    segments: ReadonlyArray<ReadonlyArray<ScreenPoint>>,
): void {
    context.beginPath();
    for (const segment of segments) {
        if (segment.length < 2) continue;
        tracePolyline(context, segment);
    }
    context.stroke();
}

/**
 * Paint the model into `context` as white-on-black energy.
 *
 * @param context - Target 2D context (the etched pass's source canvas).
 * @param model - A buildWavetableRenderModel result (CSS-px screen space).
 * @param params - Energy calibration.
 */
/**
 * Which primitive classes to paint. The hybrid engraving treatment stipples
 * the "tone" field (surface bands) at chunky grain while rendering the
 * "lines" field (mesh, contours, scan slice — where the ripple detail lives)
 * as crisp continuous ink.
 */
export type WavetableEnergyLayers = "all" | "tone" | "lines";

export function paintWavetableEnergyField(
    context: CanvasRenderingContext2D,
    model: WavetableModelLike,
    params: WavetableEnergyParams = createDefaultWavetableEnergyParams(),
    layers: WavetableEnergyLayers = "all",
): void {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, model.width, model.height);
    context.globalCompositeOperation = "lighter";
    context.shadowBlur = 0;

    const paintTone = layers !== "lines";
    const paintLines = layers !== "tone";

    // Depth-stacked ghost fills: front bands hot, back bands cold — the
    // model's depthNormalized IS the lab's layer-count depth variable.
    if (paintTone)
    for (const band of model.surfaceBands) {
        if (band.points.length < 3) continue;
        const energy = Math.max(
            0,
            params.bandEnergy * (1 - band.depthNormalized * 0.85) * (0.35 + band.slopeLight * 1.3),
        );
        if (energy <= 0.003) continue;
        context.fillStyle = `rgba(255,255,255,${Math.min(1, energy)})`;
        context.beginPath();
        tracePolyline(context, band.points);
        context.closePath();
        context.fill();
    }

    context.lineWidth = 1.15;
    if (paintLines)
    for (const slice of model.surfaceSlices) {
        const energy = Math.min(1, slice.alpha * params.meshEnergy);
        if (energy <= 0.01) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        strokeSegments(context, slice.segments);
    }

    context.lineWidth = 1.1;
    if (paintLines)
    for (const rib of model.surfaceRibs) {
        const energy = Math.min(1, rib.alpha * params.meshEnergy);
        if (energy <= 0.01 || rib.points.length < 2) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        context.beginPath();
        tracePolyline(context, rib.points);
        context.stroke();
    }

    if (paintLines)
    for (const contour of model.contours) {
        const energy = Math.min(1, contour.alpha * params.contourEnergy * 6);
        if (energy <= 0.01) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        context.lineWidth = contour.lineWidth;
        strokeSegments(context, contour.segments);
    }

    // Hero scan slice: extra-wide white with glow — prints as the reserved
    // clean-paper channel edged by shading (the lab's front-curve rule).
    // It belongs to the TONE field: in the hybrid split its role is carving
    // the stipple, never printing continuous ink of its own (a glow rendered
    // as wash ink reads as a gray smudge).
    if (paintTone && params.heroEnergy > 0) {
    context.strokeStyle = `rgba(255,255,255,${Math.min(1, Math.max(0, params.heroEnergy))})`;
    context.lineWidth = Math.max(0.5, params.heroWidthPx);
    context.shadowBlur = Math.max(0, params.heroGlowPx);
    context.shadowColor = `rgba(255,255,255,${Math.min(1, Math.max(0, params.heroGlowStrength))})`;
    strokeSegments(context, model.currentSlice.segments);
    }

    context.restore();
}
