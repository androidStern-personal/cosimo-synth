export const DISTORTION_SCOPE_ENDPOINT_ID = "distortionScope";
export const DISTORTION_SCOPE_CLIP_EPSILON = 0.0025;
export const DISTORTION_FIXED_DISPLAY_RANGE = 2.0;
export const DISTORTION_CURVE_POINT_COUNT = 241;
export const DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT = 81;
export const DISTORTION_TRANSFER_OCCUPANCY_ACTIVITY_EPSILON = 0.035;

export type DistortionScopeFrame = {
    sampleRateHz: number;
    dominantChannel: number;
    inputPeak: number;
    outputPeak: number;
    removedPeak: number;
    inputSamples: number[];
    outputSamples: number[];
};

export type DistortionDisplayState = {
    frame: DistortionScopeFrame;
    displayRange: number;
};

export type DistortionSamplePoint = {
    input: number;
    output: number;
    removed: number;
    clipped: boolean;
};

export type DistortionTransferOccupancyPoint = {
    input: number;
    output: number;
    density: number;
    removed: number;
    clipped: number;
};

export type DistortionTransferOccupancy = {
    segments: DistortionTransferOccupancyPoint[][];
    leftOverflowCount: number;
    rightOverflowCount: number;
    peakDensity: number;
    peakRemoved: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function coerceFiniteNumber(value: unknown) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function coerceNumberArray(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }

    return value
        .map((entry) => coerceFiniteNumber(entry))
        .filter((entry): entry is number => entry !== null);
}

function findPeak(samples: number[]) {
    let peak = 0;

    for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
    }

    return peak;
}

export function normalizeDistortionScopeMessage(message: unknown): DistortionScopeFrame | null {
    const payload = (
        message
        && typeof message === "object"
        && "event" in message
        && (message as { event?: unknown }).event
    ) ? (message as { event: unknown }).event : message;

    if (!payload || typeof payload !== "object") {
        return null;
    }

    const record = payload as Record<string, unknown>;
    const inputSamples = coerceNumberArray(record.inputSamples);
    const outputSamples = coerceNumberArray(record.outputSamples);

    if (!inputSamples || !outputSamples) {
        return null;
    }

    const sampleCount = Math.min(inputSamples.length, outputSamples.length);

    if (sampleCount <= 0) {
        return null;
    }

    const normalizedInput = inputSamples.slice(0, sampleCount);
    const normalizedOutput = outputSamples.slice(0, sampleCount);
    const computedInputPeak = findPeak(normalizedInput);
    const computedOutputPeak = findPeak(normalizedOutput);
    const computedRemovedPeak = findPeak(normalizedInput.map((inputSample, index) => (
        inputSample - normalizedOutput[index]
    )));

    return {
        sampleRateHz: Math.max(1, coerceFiniteNumber(record.sampleRateHz) ?? 44_100),
        dominantChannel: clamp(Math.round(coerceFiniteNumber(record.dominantChannel) ?? 0), 0, 1),
        inputPeak: Math.max(0, coerceFiniteNumber(record.inputPeak) ?? computedInputPeak),
        outputPeak: Math.max(0, coerceFiniteNumber(record.outputPeak) ?? computedOutputPeak),
        removedPeak: Math.max(0, coerceFiniteNumber(record.removedPeak) ?? computedRemovedPeak),
        inputSamples: normalizedInput,
        outputSamples: normalizedOutput,
    };
}

export function shapeDistortionSample(inputSample: number, knee: number) {
    const clampedKnee = clamp(Number(knee) || 0, 0, 1);
    const exponent = 2 + (14 * clampedKnee * clampedKnee);
    const magnitude = Math.abs(Number(inputSample) || 0);
    const denominator = Math.pow(1 + Math.pow(magnitude, exponent), 1 / exponent);

    return inputSample / denominator;
}

export function buildDistortionSamplePoints(frame: DistortionScopeFrame) {
    const sampleCount = Math.min(frame.inputSamples.length, frame.outputSamples.length);
    const points: DistortionSamplePoint[] = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const input = frame.inputSamples[index] ?? 0;
        const output = frame.outputSamples[index] ?? 0;
        const removed = input - output;

        points.push({
            input,
            output,
            removed,
            clipped: Math.abs(removed) >= DISTORTION_SCOPE_CLIP_EPSILON,
        });
    }

    return points;
}

function smoothSeries(values: number[]) {
    const kernel = [1, 2, 3, 2, 1];

    return values.map((_, index) => {
        let weightedTotal = 0;
        let weightTotal = 0;

        for (let kernelIndex = 0; kernelIndex < kernel.length; kernelIndex += 1) {
            const offset = kernelIndex - 2;
            const value = values[index + offset];

            if (value === undefined) {
                continue;
            }

            const weight = kernel[kernelIndex] ?? 0;
            weightedTotal += value * weight;
            weightTotal += weight;
        }

        return weightTotal > 0 ? weightedTotal / weightTotal : 0;
    });
}

function normalizeSeries(values: number[]) {
    const peak = values.reduce((currentPeak, value) => Math.max(currentPeak, value), 0);

    if (peak <= 1e-6) {
        return values.map(() => 0);
    }

    return values.map((value) => value / peak);
}

export function buildDistortionTransferOccupancy({
    samplePoints,
    knee,
    inputRange,
    binCount = DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT,
}: {
    samplePoints: DistortionSamplePoint[];
    knee: number;
    inputRange: number;
    binCount?: number;
}): DistortionTransferOccupancy {
    const safeInputRange = Math.max(1, Number(inputRange) || DISTORTION_FIXED_DISPLAY_RANGE);
    const safeBinCount = Math.max(9, Math.round(Number(binCount) || DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT));
    const densityBins = new Array<number>(safeBinCount).fill(0);
    const removedBins = new Array<number>(safeBinCount).fill(0);
    const clippedBins = new Array<number>(safeBinCount).fill(0);
    let leftOverflowCount = 0;
    let rightOverflowCount = 0;

    for (const point of samplePoints) {
        if (point.input < -safeInputRange) {
            leftOverflowCount += 1;
            continue;
        }

        if (point.input > safeInputRange) {
            rightOverflowCount += 1;
            continue;
        }

        const normalized = (point.input + safeInputRange) / (safeInputRange * 2);
        const binIndex = clamp(
            Math.round(normalized * (safeBinCount - 1)),
            0,
            safeBinCount - 1,
        );

        densityBins[binIndex] += 1;
        removedBins[binIndex] += Math.abs(point.removed);
        clippedBins[binIndex] += point.clipped ? 1 : 0;
    }

    const smoothedDensity = normalizeSeries(smoothSeries(densityBins));
    const smoothedRemoved = normalizeSeries(smoothSeries(removedBins));
    const smoothedClipped = smoothSeries(clippedBins).map((value, index) => {
        const density = densityBins[index] ?? 0;
        return density > 0 ? clamp(value / density, 0, 1) : 0;
    });

    const rawPoints = Array.from({ length: safeBinCount }, (_, index) => {
        const normalized = safeBinCount <= 1 ? 0 : index / (safeBinCount - 1);
        const input = (normalized * safeInputRange * 2) - safeInputRange;

        return {
            input,
            output: shapeDistortionSample(input, knee),
            density: smoothedDensity[index] ?? 0,
            removed: smoothedRemoved[index] ?? 0,
            clipped: clamp(smoothedClipped[index] ?? 0, 0, 1),
        };
    });

    const segments: DistortionTransferOccupancyPoint[][] = [];
    let currentSegment: DistortionTransferOccupancyPoint[] = [];

    for (const point of rawPoints) {
        if (point.density >= DISTORTION_TRANSFER_OCCUPANCY_ACTIVITY_EPSILON) {
            currentSegment.push(point);
            continue;
        }

        if (currentSegment.length >= 2) {
            segments.push(currentSegment);
        }

        currentSegment = [];
    }

    if (currentSegment.length >= 2) {
        segments.push(currentSegment);
    }

    return {
        segments,
        leftOverflowCount,
        rightOverflowCount,
        peakDensity: smoothedDensity.reduce((currentPeak, value) => Math.max(currentPeak, value), 0),
        peakRemoved: smoothedRemoved.reduce((currentPeak, value) => Math.max(currentPeak, value), 0),
    };
}

export function sampleDistortionCurve({
    knee,
    inputRange,
    pointCount = DISTORTION_CURVE_POINT_COUNT,
}: {
    knee: number;
    inputRange: number;
    pointCount?: number;
}) {
    const safePointCount = Math.max(3, Math.round(pointCount || DISTORTION_CURVE_POINT_COUNT));
    const safeInputRange = Math.max(1, Number(inputRange) || DISTORTION_FIXED_DISPLAY_RANGE);

    return Array.from({ length: safePointCount }, (_, index) => {
        const normalized = safePointCount <= 1 ? 0 : index / (safePointCount - 1);
        const input = (normalized * safeInputRange * 2) - safeInputRange;

        return {
            input,
            output: shapeDistortionSample(input, knee),
        };
    });
}

export function advanceDistortionDisplayState(
    previousState: DistortionDisplayState | null,
    frame: DistortionScopeFrame,
    timestampMs: number,
): DistortionDisplayState {
    void previousState;
    void timestampMs;
    return {
        frame,
        displayRange: DISTORTION_FIXED_DISPLAY_RANGE,
    };
}
