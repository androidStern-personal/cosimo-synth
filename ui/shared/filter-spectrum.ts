import { FILTER_CUTOFF_MAX_HZ, FILTER_CUTOFF_MIN_HZ } from "./filter-response";

export const FILTER_SPECTRUM_MIN_DB = -90;
export const FILTER_SPECTRUM_MAX_DB = -18;
export const FILTER_SPECTRUM_BAND_COUNT = 120;
export const FILTER_SPECTRUM_ATTACK_TIME_MS = 70;
export const FILTER_SPECTRUM_RELEASE_TIME_MS = 180;
export const FILTER_SPECTRUM_PEAK_HOLD_MS = 300;
export const FILTER_SPECTRUM_PEAK_FALL_RATE_DB_PER_SECOND = 24;

const FILTER_SPECTRUM_FREQUENCY_TICK_VALUES = [20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000];
const FILTER_SPECTRUM_DB_TICK_VALUES = [-18, -36, -54, -72, -90];

export type FilterSpectrumFrame = {
    sampleRateHz: number;
    magnitudes: number[];
};

export type FilterSpectrumBand = {
    lowHz: number;
    centerHz: number;
    highHz: number;
    normalizedX: number;
};

export type FilterSpectrumTick = {
    label: string;
    normalizedX?: number;
    normalizedY?: number;
    frequencyHz?: number;
    db?: number;
};

export type FilterSpectrumDisplayFrame = {
    sampleRateHz: number;
    sourceBinCount: number;
    bands: FilterSpectrumBand[];
    bandMagnitudesDb: number[];
    peakBandIndex: number;
};

export type FilterSpectrumDisplayState = FilterSpectrumDisplayFrame & {
    hasSpectrum: true;
    smoothedMagnitudesDb: number[];
    peakMagnitudesDb: number[];
    frequencyTicks: FilterSpectrumTick[];
    dbTicks: FilterSpectrumTick[];
    timestampMs: number;
    peakHoldUntilMs: number[];
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function coerceFiniteNumber(value: unknown) {
    const coerced = Number(value);
    return Number.isFinite(coerced) ? coerced : null;
}

function frequencyHzToNormalized(value: number) {
    const clampedHz = clamp(value, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ);
    const minLog = Math.log(FILTER_CUTOFF_MIN_HZ);
    const maxLog = Math.log(FILTER_CUTOFF_MAX_HZ);
    return clamp((Math.log(clampedHz) - minLog) / (maxLog - minLog), 0, 1);
}

function dbToNormalizedY(value: number) {
    return clamp((value - FILTER_SPECTRUM_MAX_DB) / (FILTER_SPECTRUM_MIN_DB - FILTER_SPECTRUM_MAX_DB), 0, 1);
}

function formatFrequencyLabel(frequencyHz: number) {
    if (frequencyHz >= 1000) {
        const kilohertz = frequencyHz / 1000;
        return Number.isInteger(kilohertz) ? `${kilohertz}k` : `${kilohertz.toFixed(1)}k`;
    }

    return String(Math.round(frequencyHz));
}

function magnitudeToDb(magnitude: number) {
    return clamp(20 * Math.log10(Math.max(1e-9, magnitude)), FILTER_SPECTRUM_MIN_DB, FILTER_SPECTRUM_MAX_DB);
}

function findPeakIndex(values: number[]) {
    let peakIndex = 0;

    for (let index = 1; index < values.length; index += 1) {
        if (values[index] > values[peakIndex]) {
            peakIndex = index;
        }
    }

    return peakIndex;
}

function interpolateFrequency(minHz: number, maxHz: number, normalized: number) {
    const minLog = Math.log(minHz);
    const maxLog = Math.log(maxHz);
    return Math.exp(minLog + ((maxLog - minLog) * normalized));
}

function sampleMagnitudeAtIndexRange(magnitudes: number[], startIndex: number, endIndex: number) {
    let maxMagnitude = 0;

    for (let index = startIndex; index <= endIndex; index += 1) {
        maxMagnitude = Math.max(maxMagnitude, magnitudes[index] ?? 0);
    }

    return maxMagnitude;
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

    return {
        sampleRateHz,
        magnitudes: magnitudes.map((value) => Math.max(0, Number(value) || 0)),
    };
}

export function buildFilterSpectrumBands(pointCount = FILTER_SPECTRUM_BAND_COUNT) {
    const safeCount = Math.max(1, Math.round(pointCount || FILTER_SPECTRUM_BAND_COUNT));
    const centers = Array.from({ length: safeCount }, (_, index) => (
        interpolateFrequency(
            FILTER_CUTOFF_MIN_HZ,
            FILTER_CUTOFF_MAX_HZ,
            index / Math.max(1, safeCount - 1),
        )
    ));

    return centers.map((centerHz, index) => {
        const previousCenterHz = centers[Math.max(0, index - 1)] ?? centerHz;
        const nextCenterHz = centers[Math.min(safeCount - 1, index + 1)] ?? centerHz;
        const lowHz = index === 0
            ? FILTER_CUTOFF_MIN_HZ
            : Math.sqrt(previousCenterHz * centerHz);
        const highHz = index === safeCount - 1
            ? FILTER_CUTOFF_MAX_HZ
            : Math.sqrt(centerHz * nextCenterHz);

        return {
            lowHz,
            centerHz,
            highHz,
            normalizedX: frequencyHzToNormalized(centerHz),
        };
    });
}

export function buildFilterSpectrumFrequencyTicks() {
    return FILTER_SPECTRUM_FREQUENCY_TICK_VALUES.map((frequencyHz) => ({
        label: formatFrequencyLabel(frequencyHz),
        frequencyHz,
        normalizedX: frequencyHzToNormalized(frequencyHz),
    }));
}

export function buildFilterSpectrumDbTicks() {
    return FILTER_SPECTRUM_DB_TICK_VALUES.map((db) => ({
        label: String(db),
        db,
        normalizedY: dbToNormalizedY(db),
    }));
}

export function createFilterSpectrumDisplayFrame({
    frame,
    bands,
}: {
    frame: FilterSpectrumFrame | null | undefined;
    bands: FilterSpectrumBand[];
}): FilterSpectrumDisplayFrame | null {
    if (!frame || !Array.isArray(bands) || bands.length === 0) {
        return null;
    }

    const sourceBinCount = frame.magnitudes.length;
    const maxBinIndex = Math.max(0, sourceBinCount - 1);
    const nyquistHz = Math.max(1, frame.sampleRateHz * 0.5);
    const bandMagnitudesDb = bands.map((band) => {
        const startIndex = clamp(Math.floor((clamp(band.lowHz, 0, nyquistHz) / nyquistHz) * maxBinIndex), 0, maxBinIndex);
        const endIndex = clamp(Math.ceil((clamp(band.highHz, 0, nyquistHz) / nyquistHz) * maxBinIndex), startIndex, maxBinIndex);
        return magnitudeToDb(sampleMagnitudeAtIndexRange(frame.magnitudes, startIndex, endIndex));
    });

    return {
        sampleRateHz: frame.sampleRateHz,
        sourceBinCount,
        bands,
        bandMagnitudesDb,
        peakBandIndex: findPeakIndex(bandMagnitudesDb),
    };
}

function blendDb(previousDb: number, targetDb: number, deltaMs: number, timeMs: number) {
    if (deltaMs <= 0 || timeMs <= 0) {
        return targetDb;
    }

    const coefficient = Math.exp(-deltaMs / timeMs);
    return targetDb + ((previousDb - targetDb) * coefficient);
}

export function advanceFilterSpectrumDisplayState(
    previousState: FilterSpectrumDisplayState | null,
    nextFrame: FilterSpectrumDisplayFrame | null,
    timestampMs: number,
): FilterSpectrumDisplayState | null {
    if (!nextFrame) {
        return previousState;
    }

    const bandCount = nextFrame.bandMagnitudesDb.length;
    const frequencyTicks = buildFilterSpectrumFrequencyTicks();
    const dbTicks = buildFilterSpectrumDbTicks();

    if (!previousState) {
        const peakBandIndex = findPeakIndex(nextFrame.bandMagnitudesDb);
        return {
            ...nextFrame,
            hasSpectrum: true,
            smoothedMagnitudesDb: [...nextFrame.bandMagnitudesDb],
            peakMagnitudesDb: [...nextFrame.bandMagnitudesDb],
            frequencyTicks,
            dbTicks,
            timestampMs,
            peakHoldUntilMs: new Array(bandCount).fill(timestampMs + FILTER_SPECTRUM_PEAK_HOLD_MS),
            peakBandIndex,
        };
    }

    const deltaMs = Math.max(0, timestampMs - previousState.timestampMs);
    const smoothedMagnitudesDb = nextFrame.bandMagnitudesDb.map((targetDb, index) => {
        const previousDb = previousState.smoothedMagnitudesDb[index] ?? targetDb;
        const timeMs = targetDb > previousDb ? FILTER_SPECTRUM_ATTACK_TIME_MS : FILTER_SPECTRUM_RELEASE_TIME_MS;
        return blendDb(previousDb, targetDb, deltaMs, timeMs);
    });

    const peakMagnitudesDb = smoothedMagnitudesDb.map((smoothedDb, index) => {
        const previousPeakDb = previousState.peakMagnitudesDb[index] ?? smoothedDb;
        const holdUntilMs = previousState.peakHoldUntilMs[index] ?? timestampMs;

        if (smoothedDb >= previousPeakDb) {
            return smoothedDb;
        }

        if (timestampMs < holdUntilMs) {
            return previousPeakDb;
        }

        const decayedPeakDb = previousPeakDb - ((deltaMs / 1000) * FILTER_SPECTRUM_PEAK_FALL_RATE_DB_PER_SECOND);
        return Math.max(smoothedDb, decayedPeakDb);
    });

    const peakHoldUntilMs = smoothedMagnitudesDb.map((smoothedDb, index) => {
        const previousPeakDb = previousState.peakMagnitudesDb[index] ?? smoothedDb;
        const previousHoldUntilMs = previousState.peakHoldUntilMs[index] ?? timestampMs;
        return smoothedDb >= previousPeakDb
            ? timestampMs + FILTER_SPECTRUM_PEAK_HOLD_MS
            : previousHoldUntilMs;
    });

    return {
        ...nextFrame,
        hasSpectrum: true,
        smoothedMagnitudesDb,
        peakMagnitudesDb,
        frequencyTicks,
        dbTicks,
        timestampMs,
        peakHoldUntilMs,
        peakBandIndex: findPeakIndex(smoothedMagnitudesDb),
    };
}
