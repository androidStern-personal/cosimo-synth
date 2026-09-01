export const FILTER_CUTOFF_MIN_HZ = 20;
export const FILTER_CUTOFF_MAX_HZ = 20_000;
export const FILTER_Q_MIN = 0.1;
export const FILTER_Q_MAX = 20;
const FILTER_RESPONSE_POINT_COUNT = 240;

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

type Complex = {
    real: number;
    imaginary: number;
};

function complexAdd(left: Complex, right: Complex): Complex {
    return {
        real: left.real + right.real,
        imaginary: left.imaginary + right.imaginary,
    };
}

function complexSubtract(left: Complex, right: Complex): Complex {
    return {
        real: left.real - right.real,
        imaginary: left.imaginary - right.imaginary,
    };
}

function complexScale(value: Complex, scalar: number): Complex {
    return {
        real: value.real * scalar,
        imaginary: value.imaginary * scalar,
    };
}

function complexMultiply(left: Complex, right: Complex): Complex {
    return {
        real: (left.real * right.real) - (left.imaginary * right.imaginary),
        imaginary: (left.real * right.imaginary) + (left.imaginary * right.real),
    };
}

function complexDivide(numerator: Complex, denominator: Complex): Complex {
    const denominatorMagnitude = (denominator.real * denominator.real) + (denominator.imaginary * denominator.imaginary);

    if (denominatorMagnitude <= 1e-18) {
        return { real: 0, imaginary: 0 };
    }

    return {
        real: ((numerator.real * denominator.real) + (numerator.imaginary * denominator.imaginary)) / denominatorMagnitude,
        imaginary: ((numerator.imaginary * denominator.real) - (numerator.real * denominator.imaginary)) / denominatorMagnitude,
    };
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

    const resolvedMode = clampFilterMode(mode);
    const safeSampleRate = Math.max(1, Number(sampleRate) || 44_100);
    const clampedCutoff = clampFilterCutoffHz(Math.min(Number(cutoffHz) || 0, safeSampleRate * 0.48));
    const clampedQ = clampFilterQ(q);
    const safeFrequency = clamp(frequencyHz, 10, (safeSampleRate * 0.49));
    const g = Math.tan(Math.PI * clampedCutoff / safeSampleRate);
    const k = 1 / clampedQ;
    let f0 = 1;
    let f1 = 0;
    let f2 = 0;

    if (resolvedMode === FILTER_MODE_LOWPASS) {
        f0 = 0;
        f1 = 0;
        f2 = 1;
    } else if (resolvedMode === FILTER_MODE_HIGHPASS) {
        f0 = 1;
        f1 = -k;
        f2 = -1;
    } else if (resolvedMode === FILTER_MODE_BANDPASS) {
        f0 = 0;
        f1 = 1;
        f2 = 0;
    } else if (resolvedMode === FILTER_MODE_NOTCH) {
        f0 = 1;
        f1 = -k;
        f2 = 0;
    } else if (resolvedMode === FILTER_MODE_PEAK) {
        f0 = 1;
        f1 = -k;
        f2 = -2;
    }

    const a1 = 1 / (1 + (g * (g + k)));
    const a2 = g * a1;
    const a3 = g * a2;

    const z = {
        real: Math.cos((2 * Math.PI * safeFrequency) / safeSampleRate),
        imaginary: Math.sin((2 * Math.PI * safeFrequency) / safeSampleRate),
    };
    const m00 = complexSubtract(z, { real: (2 * a1) - 1, imaginary: 0 });
    const m01 = { real: 2 * a2, imaginary: 0 };
    const m10 = { real: -2 * a2, imaginary: 0 };
    const m11 = complexSubtract(z, { real: 1 - (2 * a3), imaginary: 0 });
    const det = complexSubtract(complexMultiply(m00, m11), complexMultiply(m01, m10));
    const b0 = { real: 2 * a2, imaginary: 0 };
    const b1 = { real: 2 * a3, imaginary: 0 };
    const state1 = complexDivide(complexSubtract(complexMultiply(b0, m11), complexMultiply(m01, b1)), det);
    const state2 = complexDivide(complexSubtract(complexMultiply(m00, b1), complexMultiply(b0, m10)), det);
    const c0 = (f1 * a1) + (f2 * a2);
    const c1 = (-f1 * a2) + (f2 * (1 - a3));
    const d = f0 + (f1 * a2) + (f2 * a3);
    const transfer = complexAdd(
        { real: d, imaginary: 0 },
        complexAdd(complexScale(state1, c0), complexScale(state2, c1)),
    );

    return Math.hypot(transfer.real, transfer.imaginary);
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
