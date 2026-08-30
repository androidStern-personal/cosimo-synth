import {
    ENHANCER_DB_ROWS,
    ENHANCER_FREQUENCY_TICKS,
    ENHANCER_SPECTRUM_PLOT,
    advanceEnhancerSpectrum,
    enhancerFrequencyX,
    enhancerGainY,
    enhancerLevelY,
    type EnhancerSpectrumDisplay,
} from "../../../ui/shared/enhancer-spectrum";

/** Endpoint IDs for the editor-only Enhancer Lite analyser. */
export const ENHANCER_LITE_ANALYZER_ENDPOINTS = Object.freeze({
    enabled: "analyzerEnabledIn",
    input: "inputSpectrum",
    output: "outputSpectrum",
});

/** Compatibility name for the one shared Enhancer plot geometry. */
export const ENHANCER_LITE_PLOT = ENHANCER_SPECTRUM_PLOT;

/** Compatibility name for the one shared Enhancer frequency tick set. */
export const ENHANCER_LITE_FREQUENCY_TICKS = ENHANCER_FREQUENCY_TICKS;

/** Row-aligned relative-gain and absolute-level labels. */
export const ENHANCER_LITE_DB_ROWS = ENHANCER_DB_ROWS;

/** Compatibility type for shared Enhancer spectrum display state. */
export type EnhancerLiteSpectrumDisplay = EnhancerSpectrumDisplay;

const shelfMinimumDisplayDb = -18;
const shelfMaximumDisplayDb = 30;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

/** Compatibility projection onto the one shared Enhancer frequency axis. */
export const enhancerLiteFrequencyX = enhancerFrequencyX;

/** Compatibility projection onto the one shared Enhancer gain axis. */
export const enhancerLiteGainY = enhancerGainY;

/** Compatibility projection onto the one shared Enhancer level axis. */
export const enhancerLiteLevelY = enhancerLevelY;

/**
 * Project the measured shelf response without changing shared graph geometry.
 * Genuine high-Q overflow is compressed into the otherwise unused margins.
 */
export function enhancerLiteShelfGainY(gainDb: number): number {
    if (gainDb > ENHANCER_LITE_PLOT.maximumGainDb) {
        const normalized = (
            clamp(
                gainDb,
                ENHANCER_LITE_PLOT.maximumGainDb,
                shelfMaximumDisplayDb,
            ) - ENHANCER_LITE_PLOT.maximumGainDb
        ) / (shelfMaximumDisplayDb - ENHANCER_LITE_PLOT.maximumGainDb);
        return ENHANCER_LITE_PLOT.top * (1 - normalized);
    }

    if (gainDb < ENHANCER_LITE_PLOT.minimumGainDb) {
        const normalized = (
            ENHANCER_LITE_PLOT.minimumGainDb
            - clamp(gainDb, shelfMinimumDisplayDb, ENHANCER_LITE_PLOT.minimumGainDb)
        ) / (ENHANCER_LITE_PLOT.minimumGainDb - shelfMinimumDisplayDb);
        return ENHANCER_LITE_PLOT.height - ENHANCER_LITE_PLOT.bottom
            + normalized * ENHANCER_LITE_PLOT.bottom;
    }

    return enhancerLiteGainY(gainDb);
}

/** Compatibility entry point for the shared Enhancer spectrum analyser. */
export const advanceEnhancerLiteSpectrum = advanceEnhancerSpectrum;
