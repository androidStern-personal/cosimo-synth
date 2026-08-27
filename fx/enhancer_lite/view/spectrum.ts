/** Endpoint IDs for the editor-only Enhancer Lite analyser. */
export const ENHANCER_LITE_ANALYZER_ENDPOINTS = Object.freeze({
    enabled: "analyzerEnabledIn",
    input: "inputSpectrum",
    output: "outputSpectrum",
});

/** Shared plot geometry used by all three shapes and both spectrum traces. */
export const ENHANCER_LITE_PLOT = Object.freeze({
    width: 760,
    height: 272,
    left: 42,
    right: 42,
    top: 18,
    bottom: 28,
    minimumHz: 20,
    maximumHz: 20_000,
    // Q=10 shelves can overshoot the nominal 12 dB plateau. This fixed range
    // keeps their measured extrema visible without changing the spectrum scale.
    minimumGainDb: -18,
    maximumGainDb: 30,
    minimumLevelDbfs: -72,
    maximumLevelDbfs: 0,
});

/** Frequency ticks shared by the response curve and analyser. */
export const ENHANCER_LITE_FREQUENCY_TICKS = Object.freeze([
    20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000,
]);

/** Row-aligned relative-gain and absolute-level labels. */
export const ENHANCER_LITE_DB_ROWS = Object.freeze([
    { gainDb: 30, levelDbfs: 0 },
    { gainDb: 18, levelDbfs: -18 },
    { gainDb: 6, levelDbfs: -36 },
    { gainDb: -6, levelDbfs: -54 },
    { gainDb: -18, levelDbfs: -72 },
]);

/** Smoothed spectrum data ready to render in the shared plot. */
export type EnhancerLiteSpectrumDisplay = {
    readonly path: string;
    readonly peakDbfs: number;
    readonly magnitudesDbfs: ReadonlyArray<number>;
    readonly timestampMs: number;
};

type EnhancerLiteSpectrumFrame = {
    readonly sampleRateHz: number;
    readonly magnitudes: ReadonlyArray<number>;
};

type SpectrumRange = {
    readonly centerHz: number;
    readonly lowHz: number;
    readonly highHz: number;
};

const spectrumPointCount = 241;
const spectrumAttackMs = 55;
const spectrumReleaseMs = 190;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSpectrumMessage(message: unknown): EnhancerLiteSpectrumFrame | null {
    const payload = isRecord(message) && Object.hasOwn(message, "event")
        ? message.event
        : message;
    if (!isRecord(payload))
        return null;

    const sampleRateHz = payload.sampleRateHz;
    const magnitudes = payload.magnitudes;
    if (typeof sampleRateHz !== "number"
        || !Number.isFinite(sampleRateHz)
        || sampleRateHz <= 0
        || !Array.isArray(magnitudes)
        || magnitudes.length < 8)
        return null;

    return {
        sampleRateHz,
        magnitudes: magnitudes.map((value) => (
            typeof value === "number" && Number.isFinite(value)
                ? Math.max(0, value)
                : 0
        )),
    };
}

function interpolateLogFrequency(normalized: number): number {
    return ENHANCER_LITE_PLOT.minimumHz * Math.pow(
        ENHANCER_LITE_PLOT.maximumHz / ENHANCER_LITE_PLOT.minimumHz,
        clamp(normalized, 0, 1),
    );
}

const spectrumRanges: ReadonlyArray<SpectrumRange> = Object.freeze(
    Array.from({ length: spectrumPointCount }, (_, index) => {
        const normalized = index / (spectrumPointCount - 1);
        const centerHz = interpolateLogFrequency(normalized);
        const previousHz = interpolateLogFrequency(Math.max(0, index - 0.5) / (spectrumPointCount - 1));
        const nextHz = interpolateLogFrequency(Math.min(spectrumPointCount - 1, index + 0.5) / (spectrumPointCount - 1));
        return {
            centerHz,
            lowHz: index === 0 ? ENHANCER_LITE_PLOT.minimumHz : previousHz,
            highHz: index === spectrumPointCount - 1 ? ENHANCER_LITE_PLOT.maximumHz : nextHz,
        };
    }),
);

function magnitudeToDbfs(magnitude: number): number {
    return 20 * Math.log10(Math.max(1e-9, magnitude));
}

function sampleFrame(frame: EnhancerLiteSpectrumFrame): ReadonlyArray<number> {
    const binHz = frame.sampleRateHz / (frame.magnitudes.length * 2);
    const maximumBin = frame.magnitudes.length - 1;

    return spectrumRanges.map(({ lowHz, highHz }) => {
        const firstBin = clamp(Math.floor(lowHz / binHz), 0, maximumBin);
        const lastBin = clamp(Math.ceil(highHz / binHz), firstBin, maximumBin);
        let maximumMagnitude = 0;
        for (let bin = firstBin; bin <= lastBin; bin += 1)
            maximumMagnitude = Math.max(maximumMagnitude, frame.magnitudes[bin] ?? 0);

        return magnitudeToDbfs(maximumMagnitude);
    });
}

function smoothSpectrum(
    previous: EnhancerLiteSpectrumDisplay | null,
    targetDbfs: ReadonlyArray<number>,
    timestampMs: number,
): ReadonlyArray<number> {
    if (!previous || previous.magnitudesDbfs.length !== targetDbfs.length)
        return targetDbfs;

    const deltaMs = clamp(timestampMs - previous.timestampMs, 0, 1000);
    return targetDbfs.map((target, index) => {
        const prior = previous.magnitudesDbfs[index] ?? target;
        const timeMs = target > prior ? spectrumAttackMs : spectrumReleaseMs;
        const coefficient = Math.exp(-deltaMs / timeMs);
        return target + (prior - target) * coefficient;
    });
}

function findPeakDbfs(magnitudesDbfs: ReadonlyArray<number>): number {
    let peak: number = ENHANCER_LITE_PLOT.minimumLevelDbfs;
    for (const magnitudeDbfs of magnitudesDbfs)
        peak = Math.max(peak, magnitudeDbfs);

    return peak;
}

/** Project a frequency onto the exact x-axis shared by the bell and analyser. */
export function enhancerLiteFrequencyX(frequencyHz: number): number {
    const normalized = Math.log(
        clamp(frequencyHz, ENHANCER_LITE_PLOT.minimumHz, ENHANCER_LITE_PLOT.maximumHz)
            / ENHANCER_LITE_PLOT.minimumHz,
    ) / Math.log(ENHANCER_LITE_PLOT.maximumHz / ENHANCER_LITE_PLOT.minimumHz);
    return ENHANCER_LITE_PLOT.left
        + normalized * (
            ENHANCER_LITE_PLOT.width
            - ENHANCER_LITE_PLOT.left
            - ENHANCER_LITE_PLOT.right
        );
}

/** Project relative response gain onto the left-hand gain axis. */
export function enhancerLiteGainY(gainDb: number): number {
    const normalized = (
        clamp(gainDb, ENHANCER_LITE_PLOT.minimumGainDb, ENHANCER_LITE_PLOT.maximumGainDb)
        - ENHANCER_LITE_PLOT.minimumGainDb
    ) / (ENHANCER_LITE_PLOT.maximumGainDb - ENHANCER_LITE_PLOT.minimumGainDb);
    return ENHANCER_LITE_PLOT.height - ENHANCER_LITE_PLOT.bottom
        - normalized * (
            ENHANCER_LITE_PLOT.height
            - ENHANCER_LITE_PLOT.top
            - ENHANCER_LITE_PLOT.bottom
        );
}

/** Project absolute signal level onto the row-aligned right-hand dBFS axis. */
export function enhancerLiteLevelY(levelDbfs: number): number {
    const normalized = (
        clamp(
            levelDbfs,
            ENHANCER_LITE_PLOT.minimumLevelDbfs,
            ENHANCER_LITE_PLOT.maximumLevelDbfs,
        ) - ENHANCER_LITE_PLOT.minimumLevelDbfs
    ) / (ENHANCER_LITE_PLOT.maximumLevelDbfs - ENHANCER_LITE_PLOT.minimumLevelDbfs);
    return ENHANCER_LITE_PLOT.height - ENHANCER_LITE_PLOT.bottom
        - normalized * (
            ENHANCER_LITE_PLOT.height
            - ENHANCER_LITE_PLOT.top
            - ENHANCER_LITE_PLOT.bottom
        );
}

/** Parse, smooth, and project one analyser event into a renderable trace. */
export function advanceEnhancerLiteSpectrum(
    message: unknown,
    previous: EnhancerLiteSpectrumDisplay | null,
    timestampMs: number,
): EnhancerLiteSpectrumDisplay | null {
    const frame = normalizeSpectrumMessage(message);
    if (!frame)
        return previous;

    const magnitudesDbfs = smoothSpectrum(previous, sampleFrame(frame), timestampMs);
    const path = spectrumRanges.map(({ centerHz }, index) => (
        `${index === 0 ? "M" : "L"} ${enhancerLiteFrequencyX(centerHz).toFixed(2)} `
        + enhancerLiteLevelY(
            magnitudesDbfs[index] ?? ENHANCER_LITE_PLOT.minimumLevelDbfs,
        ).toFixed(2)
    )).join(" ");

    return {
        path,
        peakDbfs: findPeakDbfs(magnitudesDbfs),
        magnitudesDbfs,
        timestampMs,
    };
}
