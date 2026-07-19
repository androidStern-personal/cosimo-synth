/**
 * White-on-black distortion energy painter for the etched ink treatment.
 * Transfer shaping, occupancy, scope, and history calculations remain owned by
 * distortion-visualization.ts; this module only maps their geometry to canvas.
 */

import {
    DISTORTION_FIXED_DISPLAY_RANGE,
    buildDistortionHistoryBins,
    buildDistortionSamplePoints,
    buildDistortionTransferOccupancy,
    sampleDistortionCurve,
    type DistortionHistoryFrame,
    type DistortionScopeFrame,
} from "./distortion-visualization";

/** Inputs for one transfer-plus-history distortion energy frame. */
export type DistortionEnergyFieldState = {
    readonly knee: number;
    readonly scopeFrame: DistortionScopeFrame;
    readonly historyFrame: DistortionHistoryFrame;
    readonly width: number;
    readonly height: number;
};

/** Energy calibration for occupancy, removed signal, history, and hero curve. */
export type DistortionEnergyParams = {
    readonly occupancyEnergy: number;
    readonly historyEnergy: number;
    readonly removedEnergy: number;
    readonly curveWidthPx: number;
    readonly curveGlowPx: number;
    readonly curveGlowStrength: number;
    readonly curveEnergy: number;
};

type PlotRect = {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

function energyAlpha(value: number): number {
    return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function mapPlotX(value: number, plot: PlotRect): number {
    const normalized = clamp(
        (value + DISTORTION_FIXED_DISPLAY_RANGE) / (DISTORTION_FIXED_DISPLAY_RANGE * 2),
        0,
        1,
    );
    return plot.left + (plot.width * normalized);
}

function mapPlotY(value: number, plot: PlotRect): number {
    const normalized = clamp(
        (DISTORTION_FIXED_DISPLAY_RANGE - value) / (DISTORTION_FIXED_DISPLAY_RANGE * 2),
        0,
        1,
    );
    return plot.top + (plot.height * normalized);
}

function createPlots(width: number, height: number): {
    readonly transfer: PlotRect;
    readonly history: PlotRect;
} {
    const horizontalPadding = 18;
    const outerVerticalPadding = 12;
    const gap = 12;
    const availableHeight = Math.max(2, height - (outerVerticalPadding * 2) - gap);
    const transferHeight = Math.max(1, availableHeight * 0.65);
    const historyHeight = Math.max(1, availableHeight - transferHeight);
    const plotWidth = Math.max(1, width - (horizontalPadding * 2));

    return {
        transfer: {
            left: horizontalPadding,
            top: outerVerticalPadding,
            width: plotWidth,
            height: transferHeight,
        },
        history: {
            left: horizontalPadding,
            top: outerVerticalPadding + transferHeight + gap,
            width: plotWidth,
            height: historyHeight,
        },
    };
}

/** Return the dossier-calibrated distortion energy defaults. */
export function createDefaultDistortionEnergyParams(): DistortionEnergyParams {
    return {
        // Sub-coverage tone for wash legibility (see filter-energy-field note).
        occupancyEnergy: 0.06,
        historyEnergy: 0.045,
        removedEnergy: 0.8,
        curveWidthPx: 2.5,
        curveGlowPx: 9,
        curveGlowStrength: 0.12,
        curveEnergy: 0.95,
    };
}

/**
 * Paint production distortion geometry as a white-on-black etched energy field.
 * The upper 65% is the transfer plot; the lower 35% is the real history-bin view.
 */
export function paintDistortionEnergyField(
    context: CanvasRenderingContext2D,
    state: DistortionEnergyFieldState,
    params: DistortionEnergyParams = createDefaultDistortionEnergyParams(),
): void {
    const plots = createPlots(state.width, state.height);
    const samplePoints = buildDistortionSamplePoints(state.scopeFrame);
    const occupancy = buildDistortionTransferOccupancy({
        samplePoints,
        knee: state.knee,
        inputRange: DISTORTION_FIXED_DISPLAY_RANGE,
    });
    const curve = sampleDistortionCurve({
        knee: state.knee,
        inputRange: DISTORTION_FIXED_DISPLAY_RANGE,
    });
    const historyBins = buildDistortionHistoryBins(state.historyFrame);

    context.save();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, state.width, state.height);
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const segment of occupancy.segments) {
        for (let index = 1; index < segment.length; index += 1) {
            const previous = segment[index - 1];
            const current = segment[index];
            if (previous === undefined || current === undefined) {
                continue;
            }

            const density = clamp((previous.density + current.density) * 0.5, 0, 1);
            context.beginPath();
            context.moveTo(mapPlotX(previous.input, plots.transfer), mapPlotY(previous.output, plots.transfer));
            context.lineTo(mapPlotX(current.input, plots.transfer), mapPlotY(current.output, plots.transfer));
            context.lineWidth = 5 + (density * 16);
            context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.occupancyEnergy * density)})`;
            context.stroke();

            const removed = clamp((previous.removed + current.removed) * 0.5, 0, 1);
            const clipped = clamp((previous.clipped + current.clipped) * 0.5, 0, 1);
            const removedWidth = density * removed * Math.max(0.25, clipped) * 18;
            if (removedWidth <= 0.05) {
                continue;
            }
            context.beginPath();
            context.moveTo(mapPlotX(previous.input, plots.transfer), mapPlotY(previous.output, plots.transfer));
            context.lineTo(mapPlotX(current.input, plots.transfer), mapPlotY(current.output, plots.transfer));
            context.lineWidth = removedWidth;
            context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.removedEnergy * Math.max(0.3, removed, clipped))})`;
            context.stroke();
        }
    }

    const historyColumnWidth = plots.history.width / Math.max(1, historyBins.length);
    const historyGap = Math.min(0.6, historyColumnWidth * 0.25);
    for (let index = 0; index < historyBins.length; index += 1) {
        const bin = historyBins[index];
        if (bin === undefined || !bin.valid) {
            continue;
        }

        const x = plots.history.left + (index * historyColumnWidth) + (historyGap * 0.5);
        const width = Math.max(0.25, historyColumnWidth - historyGap);
        const outputTop = mapPlotY(bin.outputPeak, plots.history);
        const outputBottom = mapPlotY(-bin.outputPeak, plots.history);
        context.fillStyle = `rgba(255,255,255,${energyAlpha(params.historyEnergy)})`;
        context.fillRect(x, outputTop, width, Math.max(0, outputBottom - outputTop));

        if (bin.inputPeak <= bin.outputPeak + 1e-4) {
            continue;
        }
        const inputTop = mapPlotY(bin.inputPeak, plots.history);
        const inputBottom = mapPlotY(-bin.inputPeak, plots.history);
        context.fillStyle = `rgba(255,255,255,${energyAlpha(params.removedEnergy)})`;
        context.fillRect(x, inputTop, width, Math.max(0, outputTop - inputTop));
        context.fillRect(x, outputBottom, width, Math.max(0, inputBottom - outputBottom));
    }

    const firstCurvePoint = curve[0];
    if (firstCurvePoint !== undefined && curve.length >= 2) {
        context.beginPath();
        for (let index = 0; index < curve.length; index += 1) {
            const point = curve[index];
            if (point === undefined) {
                continue;
            }
            const x = mapPlotX(point.input, plots.transfer);
            const y = mapPlotY(point.output, plots.transfer);
            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        context.strokeStyle = `rgba(255,255,255,${energyAlpha(params.curveEnergy)})`;
        context.lineWidth = Math.max(0.5, params.curveWidthPx);
        context.shadowBlur = Math.max(0, params.curveGlowPx);
        context.shadowColor = `rgba(255,255,255,${energyAlpha(params.curveGlowStrength)})`;
        context.stroke();
    }

    context.restore();
}
