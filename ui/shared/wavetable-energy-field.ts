/**
 * Paint a wavetable render model as a grayscale ENERGY field — the native
 * input of the etched ink-on-paper pass (ui/shared/etched-ink.ts).
 *
 * This is "Path B" of the wavetable porting dossier: the pure builders
 * (buildWavetableStaticScene / buildWavetableRenderModel in
 * patch_gui/wavetable-display.js) own ALL projection, warp, and scan math;
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
};

/** Dossier-calibrated defaults. */
export function createDefaultWavetableEnergyParams(): WavetableEnergyParams {
    return {
        bandEnergy: 0.2,
        meshEnergy: 1.35,
        contourEnergy: 0.5,
        heroWidthPx: 5,
        heroGlowPx: 10,
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
export function paintWavetableEnergyField(
    context: CanvasRenderingContext2D,
    model: WavetableModelLike,
    params: WavetableEnergyParams = createDefaultWavetableEnergyParams(),
): void {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, model.width, model.height);
    context.globalCompositeOperation = "lighter";
    context.shadowBlur = 0;

    // Depth-stacked ghost fills: front bands hot, back bands cold — the
    // model's depthNormalized IS the lab's layer-count depth variable.
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
    for (const slice of model.surfaceSlices) {
        const energy = Math.min(1, slice.alpha * params.meshEnergy);
        if (energy <= 0.01) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        strokeSegments(context, slice.segments);
    }

    context.lineWidth = 1.1;
    for (const rib of model.surfaceRibs) {
        const energy = Math.min(1, rib.alpha * params.meshEnergy);
        if (energy <= 0.01 || rib.points.length < 2) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        context.beginPath();
        tracePolyline(context, rib.points);
        context.stroke();
    }

    for (const contour of model.contours) {
        const energy = Math.min(1, contour.alpha * params.contourEnergy * 6);
        if (energy <= 0.01) continue;
        context.strokeStyle = `rgba(255,255,255,${energy})`;
        context.lineWidth = contour.lineWidth;
        strokeSegments(context, contour.segments);
    }

    // Hero scan slice: extra-wide white with glow — prints as the reserved
    // clean-paper channel edged by shading (the lab's front-curve rule).
    context.strokeStyle = "rgba(255,255,255,1)";
    context.lineWidth = params.heroWidthPx;
    context.shadowBlur = params.heroGlowPx;
    context.shadowColor = "rgba(255,255,255,0.85)";
    strokeSegments(context, model.currentSlice.segments);

    context.restore();
}
