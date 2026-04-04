export const FILTER_CUTOFF_MIN_HZ = 20;
export const FILTER_CUTOFF_MAX_HZ = 20_000;
export const FILTER_Q_MIN = 0.1;
export const FILTER_Q_MAX = 20;
const FILTER_RESPONSE_POINT_COUNT = 80;
const FILTER_RESPONSE_FFT_WARMUP_CYCLES = 10;
const FILTER_RESPONSE_FFT_MEASURE_CYCLES = 6;

export const FILTER_MODE_OFF = 0;
export const FILTER_MODE_LOWPASS = 1;
export const FILTER_MODE_HIGHPASS = 2;
export const FILTER_MODE_BANDPASS = 3;
export const FILTER_MODE_NOTCH = 4;
export const FILTER_MODE_PEAK = 5;

export type FilterResponseModel = {
    mode: number;
    cutoffHz: number;
    q: number;
    sampleRate: number;
    frequenciesHz: number[];
    magnitudesDb: number[];
    peakIndex: number;
    minIndex: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function clampFilterMode(value: unknown) {
    return clamp(Math.round(Number(value) || 0), FILTER_MODE_OFF, FILTER_MODE_PEAK);
}

export function clampFilterCutoffHz(value: unknown) {
    return clamp(Number(value) || FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ);
}

export function clampFilterQ(value: unknown) {
    return clamp(Number(value) || 0, FILTER_Q_MIN, FILTER_Q_MAX);
}

export function filterCutoffHzToNormalized(value: unknown) {
    const clampedHz = clampFilterCutoffHz(value);
    const minLog = Math.log(FILTER_CUTOFF_MIN_HZ);
    const maxLog = Math.log(FILTER_CUTOFF_MAX_HZ);
    return clamp((Math.log(clampedHz) - minLog) / (maxLog - minLog), 0, 1);
}

export function normalizedToFilterCutoffHz(value: unknown) {
    const normalized = clamp(Number(value) || 0, 0, 1);
    const minLog = Math.log(FILTER_CUTOFF_MIN_HZ);
    const maxLog = Math.log(FILTER_CUTOFF_MAX_HZ);
    return Math.exp(minLog + ((maxLog - minLog) * normalized));
}

export function filterQToNormalized(value: unknown) {
    const clampedQ = clampFilterQ(value);
    return (clampedQ - FILTER_Q_MIN) / (FILTER_Q_MAX - FILTER_Q_MIN);
}

export function normalizedToFilterQ(value: unknown) {
    const normalized = clamp(Number(value) || 0, 0, 1);
    return FILTER_Q_MIN + ((FILTER_Q_MAX - FILTER_Q_MIN) * normalized);
}

class SimperFilter {
    ic1eq = 0;
    ic2eq = 0;
    a1 = 0;
    a2 = 0;
    a3 = 0;
    f0 = 0;
    f1 = 0;
    f2 = 1;
    mode = FILTER_MODE_LOWPASS;

    reset() {
        this.ic1eq = 0;
        this.ic2eq = 0;
    }

    setMode(nextMode: number) {
        this.mode = clampFilterMode(nextMode);
    }

    setFrequency(sampleRate: number, cutoffHz: number, q: number) {
        const safeSampleRate = Math.max(1, Number(sampleRate) || 44_100);
        const clampedCutoff = clampFilterCutoffHz(Math.min(Number(cutoffHz) || 0, safeSampleRate * 0.48));
        const clampedQ = clampFilterQ(q);
        const g = Math.tan(Math.PI * clampedCutoff / safeSampleRate);
        const k = 1 / clampedQ;

        if (this.mode === FILTER_MODE_LOWPASS) {
            this.f0 = 0;
            this.f1 = 0;
            this.f2 = 1;
        } else if (this.mode === FILTER_MODE_HIGHPASS) {
            this.f0 = 1;
            this.f1 = -k;
            this.f2 = -1;
        } else if (this.mode === FILTER_MODE_BANDPASS) {
            this.f0 = 0;
            this.f1 = 1;
            this.f2 = 0;
        } else if (this.mode === FILTER_MODE_NOTCH) {
            this.f0 = 1;
            this.f1 = -k;
            this.f2 = 0;
        } else if (this.mode === FILTER_MODE_PEAK) {
            this.f0 = 1;
            this.f1 = -k;
            this.f2 = -2;
        } else {
            this.f0 = 1;
            this.f1 = 0;
            this.f2 = 0;
        }

        this.a1 = 1 / (1 + (g * (g + k)));
        this.a2 = g * this.a1;
        this.a3 = g * this.a2;
    }

    process(input: number) {
        const v3 = input - this.ic2eq;
        const v1 = (this.a1 * this.ic1eq) + (this.a2 * v3);
        const v2 = this.ic2eq + (this.a2 * this.ic1eq) + (this.a3 * v3);
        this.ic1eq = (2 * v1) - this.ic1eq;
        this.ic2eq = (2 * v2) - this.ic2eq;
        return (this.f0 * input) + (this.f1 * v1) + (this.f2 * v2);
    }
}

function responseGainForFrequency({
    mode,
    cutoffHz,
    q,
    sampleRate,
    frequencyHz,
}: {
    mode: number;
    cutoffHz: number;
    q: number;
    sampleRate: number;
    frequencyHz: number;
}) {
    if (mode === FILTER_MODE_OFF) {
        return 1;
    }

    const filter = new SimperFilter();
    filter.setMode(mode);
    filter.setFrequency(sampleRate, cutoffHz, q);
    const safeFrequency = clamp(frequencyHz, 10, (sampleRate * 0.49));
    const cycleLength = Math.max(8, Math.round(sampleRate / safeFrequency));
    const warmupSamples = cycleLength * FILTER_RESPONSE_FFT_WARMUP_CYCLES;
    const measureSamples = cycleLength * FILTER_RESPONSE_FFT_MEASURE_CYCLES;
    let inCos = 0;
    let inSin = 0;
    let outCos = 0;
    let outSin = 0;

    for (let sampleIndex = 0; sampleIndex < warmupSamples + measureSamples; sampleIndex += 1) {
        const phase = (2 * Math.PI * safeFrequency * sampleIndex) / sampleRate;
        const input = Math.sin(phase);
        const output = filter.process(input);

        if (sampleIndex < warmupSamples) {
            continue;
        }

        inCos += input * Math.cos(phase);
        inSin += input * Math.sin(phase);
        outCos += output * Math.cos(phase);
        outSin += output * Math.sin(phase);
    }

    const inputMagnitude = Math.hypot(inCos, inSin);
    const outputMagnitude = Math.hypot(outCos, outSin);
    if (inputMagnitude <= 1e-12) {
        return 0;
    }
    return outputMagnitude / inputMagnitude;
}

function buildFrequencies(pointCount: number) {
    return Array.from({ length: pointCount }, (_, index) => (
        normalizedToFilterCutoffHz(index / Math.max(1, pointCount - 1))
    ));
}

export function createFilterResponseModel({
    mode,
    cutoffHz,
    q,
    sampleRate = 44_100,
    pointCount = FILTER_RESPONSE_POINT_COUNT,
}: {
    mode: number;
    cutoffHz: number;
    q: number;
    sampleRate?: number;
    pointCount?: number;
}): FilterResponseModel {
    const resolvedMode = clampFilterMode(mode);
    const resolvedCutoff = clampFilterCutoffHz(cutoffHz);
    const resolvedQ = clampFilterQ(q);
    const resolvedSampleRate = Math.max(1, Math.round(sampleRate || 44_100));
    const frequenciesHz = buildFrequencies(pointCount);
    const magnitudesDb = frequenciesHz.map((frequencyHz) => {
        const gain = responseGainForFrequency({
            mode: resolvedMode,
            cutoffHz: resolvedCutoff,
            q: resolvedQ,
            sampleRate: resolvedSampleRate,
            frequencyHz,
        });
        return 20 * Math.log10(Math.max(gain, 1e-6));
    });

    let peakIndex = 0;
    let minIndex = 0;
    for (let index = 1; index < magnitudesDb.length; index += 1) {
        if (magnitudesDb[index] > magnitudesDb[peakIndex]) {
            peakIndex = index;
        }
        if (magnitudesDb[index] < magnitudesDb[minIndex]) {
            minIndex = index;
        }
    }

    return {
        mode: resolvedMode,
        cutoffHz: resolvedCutoff,
        q: resolvedQ,
        sampleRate: resolvedSampleRate,
        frequenciesHz,
        magnitudesDb,
        peakIndex,
        minIndex,
    };
}

export function magnitudeAtFrequency(model: FilterResponseModel, targetHz: number) {
    const frequencies = model.frequenciesHz;
    const magnitudes = model.magnitudesDb;
    const clampedTarget = clampFilterCutoffHz(targetHz);

    if (clampedTarget <= frequencies[0]) {
        return magnitudes[0];
    }

    if (clampedTarget >= frequencies[frequencies.length - 1]) {
        return magnitudes[magnitudes.length - 1];
    }

    for (let index = 1; index < frequencies.length; index += 1) {
        if (frequencies[index] < clampedTarget) {
            continue;
        }

        const leftHz = frequencies[index - 1];
        const rightHz = frequencies[index];
        const t = (clampedTarget - leftHz) / Math.max(1e-9, rightHz - leftHz);
        return magnitudes[index - 1] + ((magnitudes[index] - magnitudes[index - 1]) * t);
    }

    return magnitudes[magnitudes.length - 1];
}
