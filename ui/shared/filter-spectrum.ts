import { clampFilterCutoffHz, normalizedToFilterCutoffHz } from "./filter-response";

export const FILTER_SPECTRUM_MIN_DB = -60;
export const FILTER_SPECTRUM_MAX_DB = 0;
export const FILTER_SPECTRUM_DISPLAY_POINT_COUNT = 192;

export type FilterSpectrumFrame = {
    sampleRateHz: number;
    magnitudes: number[];
};

export type FilterSpectrumDisplay = {
    sampleRateHz: number;
    sourceBinCount: number;
    displayMagnitudesDb: number[];
    peakDisplayIndex: number;
};

export function buildFilterSpectrumDisplayFrequencies(pointCount = FILTER_SPECTRUM_DISPLAY_POINT_COUNT) {
    return Array.from({ length: pointCount }, (_, index) => (
        normalizedToFilterCutoffHz(index / Math.max(1, pointCount - 1))
    ));
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function coerceFiniteNumber(value: unknown) {
    const coerced = Number(value);
    return Number.isFinite(coerced) ? coerced : null;
}

export function normalizeFilterSpectrumMessage(message: unknown): FilterSpectrumFrame | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;

    if (!payload || typeof payload !== "object") {
        return null;
    }

    const sampleRateHz = coerceFiniteNumber((payload as { sampleRateHz?: unknown }).sampleRateHz);
    const magnitudes = (payload as { magnitudes?: unknown }).magnitudes;

    if (!sampleRateHz || sampleRateHz <= 0 || !Array.isArray(magnitudes) || magnitudes.length < 8) {
        return null;
    }

    const normalizedMagnitudes = magnitudes.map((value) => Math.max(0, Number(value) || 0));
    return {
        sampleRateHz,
        magnitudes: normalizedMagnitudes,
    };
}

function sampleMagnitudeAtFrequency({
    magnitudes,
    sampleRateHz,
    frequencyHz,
}: {
    magnitudes: number[];
    sampleRateHz: number;
    frequencyHz: number;
}) {
    const nyquistHz = Math.max(1, sampleRateHz * 0.5);
    const clampedFrequencyHz = clamp(clampFilterCutoffHz(frequencyHz), 0, nyquistHz);
    const maxBinIndex = Math.max(0, magnitudes.length - 1);
    const exactIndex = (clampedFrequencyHz / nyquistHz) * maxBinIndex;
    const leftIndex = Math.max(0, Math.min(maxBinIndex, Math.floor(exactIndex)));
    const rightIndex = Math.max(0, Math.min(maxBinIndex, Math.ceil(exactIndex)));

    if (leftIndex === rightIndex) {
        return magnitudes[leftIndex] ?? 0;
    }

    const mix = exactIndex - leftIndex;
    const leftMagnitude = magnitudes[leftIndex] ?? 0;
    const rightMagnitude = magnitudes[rightIndex] ?? 0;
    return leftMagnitude + ((rightMagnitude - leftMagnitude) * mix);
}

export function createFilterSpectrumDisplay({
    frame,
    frequenciesHz,
}: {
    frame: FilterSpectrumFrame | null | undefined;
    frequenciesHz: number[];
}): FilterSpectrumDisplay | null {
    if (!frame || !Array.isArray(frequenciesHz) || frequenciesHz.length === 0) {
        return null;
    }

    const peakMagnitude = frame.magnitudes.reduce((maxMagnitude, magnitude) => (
        Math.max(maxMagnitude, magnitude)
    ), 0);

    if (peakMagnitude <= 0) {
        return {
            sampleRateHz: frame.sampleRateHz,
            sourceBinCount: frame.magnitudes.length,
            displayMagnitudesDb: frequenciesHz.map(() => FILTER_SPECTRUM_MIN_DB),
            peakDisplayIndex: 0,
        };
    }

    const displayMagnitudesDb = frequenciesHz.map((frequencyHz) => {
        const magnitude = sampleMagnitudeAtFrequency({
            magnitudes: frame.magnitudes,
            sampleRateHz: frame.sampleRateHz,
            frequencyHz,
        });
        const normalizedMagnitude = Math.max(1e-6, magnitude / peakMagnitude);
        return clamp(20 * Math.log10(normalizedMagnitude), FILTER_SPECTRUM_MIN_DB, FILTER_SPECTRUM_MAX_DB);
    });

    let peakDisplayIndex = 0;
    for (let index = 1; index < displayMagnitudesDb.length; index += 1) {
        if (displayMagnitudesDb[index] > displayMagnitudesDb[peakDisplayIndex]) {
            peakDisplayIndex = index;
        }
    }

    return {
        sampleRateHz: frame.sampleRateHz,
        sourceBinCount: frame.magnitudes.length,
        displayMagnitudesDb,
        peakDisplayIndex,
    };
}
