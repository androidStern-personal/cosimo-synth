// Response-graph geometry and analyser display for Enhance That.

/** The logical SVG and plot rectangle every layer of the response graph shares. */
export const SPECTRUM_PLOT = Object.freeze({
    width: 760,
    height: 272,
    left: 42,
    right: 42,
    top: 18,
    bottom: 28,
    minimumHz: 20,
    maximumHz: 20_000,
    minimumGainDb: 0,
    maximumGainDb: 12,
    minimumLevelDbfs: -72,
    maximumLevelDbfs: 0,
});

/** Frequency ticks on the shared 20 Hz to 20 kHz logarithmic axis. */
export const FREQUENCY_TICKS = Object.freeze([
    20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000,
]);

/** Row-aligned relative-gain and absolute-level labels. */
export const DB_ROWS = Object.freeze([
    { gainDb: 12, levelDbfs: 0 },
    { gainDb: 9, levelDbfs: -18 },
    { gainDb: 6, levelDbfs: -36 },
    { gainDb: 3, levelDbfs: -54 },
    { gainDb: 0, levelDbfs: -72 },
]);

/** Browser-space rectangle needed to translate pointer coordinates into the SVG view box. */
type RenderedRect = {
    readonly left: number;
    readonly width: number;
};

/** One responsive label whose position remains owned by the shared log transform. */
type FrequencyTick = {
    readonly frequencyHz: number;
    readonly x: number;
    readonly label: string;
};

/** Smoothed spectrum data projected into the shared plot. */
export type SpectrumDisplay = {
    readonly path: string;
    readonly peakDbfs: number;
    readonly magnitudesDbfs: ReadonlyArray<number>;
    readonly timestampMs: number;
};

type SpectrumFrame = {
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
const responseModelSampleRate = 48_000 * 4;

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSpectrumMessage(message: unknown): SpectrumFrame | null {
    const payload = isRecord(message) && Object.hasOwn(message, "event")
        ? message.event
        : message;
    if (!isRecord(payload)) {
        return null;
    }

    const sampleRateHz = payload.sampleRateHz;
    const magnitudes = payload.magnitudes;
    if (typeof sampleRateHz !== "number"
            || !Number.isFinite(sampleRateHz)
            || sampleRateHz <= 0
            || !Array.isArray(magnitudes)
            || magnitudes.length < 8) {
        return null;
    }

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
    return SPECTRUM_PLOT.minimumHz * Math.pow(
        SPECTRUM_PLOT.maximumHz / SPECTRUM_PLOT.minimumHz,
        clamp(normalized, 0, 1),
    );
}

const spectrumRanges: ReadonlyArray<SpectrumRange> = Object.freeze(
    Array.from({ length: spectrumPointCount }, (_, index) => {
        const normalized = index / (spectrumPointCount - 1);
        const centerHz = interpolateLogFrequency(normalized);
        const previousHz = interpolateLogFrequency(
            Math.max(0, index - 0.5) / (spectrumPointCount - 1),
        );
        const nextHz = interpolateLogFrequency(
            Math.min(spectrumPointCount - 1, index + 0.5) / (spectrumPointCount - 1),
        );
        return {
            centerHz,
            lowHz: index === 0 ? SPECTRUM_PLOT.minimumHz : previousHz,
            highHz: index === spectrumPointCount - 1
                ? SPECTRUM_PLOT.maximumHz
                : nextHz,
        };
    }),
);

function magnitudeToDbfs(magnitude: number): number {
    return 20 * Math.log10(Math.max(1e-9, magnitude));
}

function sampleFrame(frame: SpectrumFrame): ReadonlyArray<number> {
    const binHz = frame.sampleRateHz / (frame.magnitudes.length * 2);
    const maximumBin = frame.magnitudes.length - 1;

    return spectrumRanges.map(({ lowHz, highHz }) => {
        const firstBin = clamp(Math.floor(lowHz / binHz), 0, maximumBin);
        const lastBin = clamp(Math.ceil(highHz / binHz), firstBin, maximumBin);
        let maximumMagnitude = 0;
        for (let bin = firstBin; bin <= lastBin; bin += 1) {
            maximumMagnitude = Math.max(maximumMagnitude, frame.magnitudes[bin] ?? 0);
        }

        return magnitudeToDbfs(maximumMagnitude);
    });
}

function smoothSpectrum(
    previous: SpectrumDisplay | null,
    targetDbfs: ReadonlyArray<number>,
    timestampMs: number,
): ReadonlyArray<number> {
    if (previous === null || previous.magnitudesDbfs.length !== targetDbfs.length) {
        return targetDbfs;
    }

    const deltaMs = clamp(timestampMs - previous.timestampMs, 0, 1_000);
    return targetDbfs.map((target, index) => {
        const prior = previous.magnitudesDbfs[index] ?? target;
        const timeMs = target > prior ? spectrumAttackMs : spectrumReleaseMs;
        const coefficient = Math.exp(-deltaMs / timeMs);
        return target + (prior - target) * coefficient;
    });
}

function findPeakDbfs(magnitudesDbfs: ReadonlyArray<number>): number {
    let peak: number = SPECTRUM_PLOT.minimumLevelDbfs;
    for (const magnitudeDbfs of magnitudesDbfs) {
        peak = Math.max(peak, magnitudeDbfs);
    }

    return peak;
}

/** Project a frequency onto the one logarithmic X-axis shared by every graph layer. */
export function frequencyToX(frequencyHz: number): number {
    const normalized = Math.log(
        clamp(
            frequencyHz,
            SPECTRUM_PLOT.minimumHz,
            SPECTRUM_PLOT.maximumHz,
        ) / SPECTRUM_PLOT.minimumHz,
    ) / Math.log(
        SPECTRUM_PLOT.maximumHz / SPECTRUM_PLOT.minimumHz,
    );
    return SPECTRUM_PLOT.left
        + normalized * (
            SPECTRUM_PLOT.width
            - SPECTRUM_PLOT.left
            - SPECTRUM_PLOT.right
        );
}

/** Invert a logical SVG X coordinate through the shared logarithmic frequency transform. */
function frequencyFromX(plotX: number): number {
    const plotWidth = SPECTRUM_PLOT.width
        - SPECTRUM_PLOT.left
        - SPECTRUM_PLOT.right;
    const normalized = clamp(
        (plotX - SPECTRUM_PLOT.left) / plotWidth,
        0,
        1,
    );
    return interpolateLogFrequency(normalized);
}

/** Translate one frequency to the rendered browser X coordinate of a responsive SVG. */
function frequencyToClientX(
    frequencyHz: number,
    renderedRect: RenderedRect,
): number {
    return renderedRect.left
        + frequencyToX(frequencyHz) / SPECTRUM_PLOT.width * renderedRect.width;
}

/** Translate a browser pointer X coordinate back through the exact rendered SVG plot. */
function frequencyFromClientX(
    clientX: number,
    renderedRect: RenderedRect,
): number {
    if (!Number.isFinite(renderedRect.width) || renderedRect.width <= 0) {
        return SPECTRUM_PLOT.minimumHz;
    }

    const plotX = (clientX - renderedRect.left)
        / renderedRect.width
        * SPECTRUM_PLOT.width;
    return frequencyFromX(plotX);
}

/**
 * Apply a relative browser drag through the rendered shared plot, preserving
 * the picked-up frequency even when a user grabs the response curve off-center.
 */
export function frequencyAfterDrag(
    originFrequencyHz: number,
    originClientX: number,
    currentClientX: number,
    renderedRect: RenderedRect,
): number {
    const renderedOriginX = frequencyToClientX(originFrequencyHz, renderedRect);
    return frequencyFromClientX(
        renderedOriginX + currentClientX - originClientX,
        renderedRect,
    );
}

/** Format a real frequency tick with explicit Hz or kHz units. */
export function formatFrequencyTick(frequencyHz: number): string {
    if (frequencyHz < 1_000) {
        return `${Math.round(frequencyHz)} Hz`;
    }

    const kilohertz = frequencyHz / 1_000;
    return `${Number.isInteger(kilohertz) ? kilohertz : kilohertz.toFixed(1)} kHz`;
}

/**
 * Select readable label density for the rendered width while retaining the
 * exact frequency values and X transform of the detailed axis.
 */
export function frequencyTicksForWidth(
    renderedWidth: number,
): ReadonlyArray<FrequencyTick> {
    const frequencies = renderedWidth < 320
        ? [20, 200, 2_000, 20_000]
        : (renderedWidth < 480
            ? [20, 200, 1_000, 10_000, 20_000]
            : (renderedWidth < 720
                ? [20, 100, 200, 1_000, 5_000, 10_000, 20_000]
                : FREQUENCY_TICKS));
    return Object.freeze(frequencies.map((frequencyHz) => ({
        frequencyHz,
        x: frequencyToX(frequencyHz),
        label: formatFrequencyTick(frequencyHz),
    })));
}

/** Project gain onto the shared left-hand gain axis. */
export function gainToY(gainDb: number): number {
    const normalized = (
        clamp(
            gainDb,
            SPECTRUM_PLOT.minimumGainDb,
            SPECTRUM_PLOT.maximumGainDb,
        ) - SPECTRUM_PLOT.minimumGainDb
    ) / (
        SPECTRUM_PLOT.maximumGainDb
        - SPECTRUM_PLOT.minimumGainDb
    );
    return SPECTRUM_PLOT.height - SPECTRUM_PLOT.bottom
        - normalized * (
            SPECTRUM_PLOT.height
            - SPECTRUM_PLOT.top
            - SPECTRUM_PLOT.bottom
        );
}

/**
 * Evaluate the bell model the curve renderer draws at one frequency.
 * Amount is normalized and maps to the 0 to +12 dB range.
 */
export function bellResponseDb(
    frequencyHz: number,
    centerHz: number,
    q: number,
    amount: number,
): number {
    const gainDb = 12 * clamp(amount, 0, 1);
    const amplitude = Math.pow(10, gainDb / 40);
    const centerOmega = 2 * Math.PI * clamp(centerHz, 20, 20_000)
        / responseModelSampleRate;
    const alpha = Math.sin(centerOmega) / (2 * clamp(q, 0.1, 10));
    const centerCosine = Math.cos(centerOmega);
    const omega = 2 * Math.PI * clamp(frequencyHz, 20, 20_000)
        / responseModelSampleRate;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = 1 + alpha * amplitude
        - 2 * centerCosine * z1Real
        + (1 - alpha * amplitude) * z2Real;
    const numeratorImaginary = -2 * centerCosine * z1Imaginary
        + (1 - alpha * amplitude) * z2Imaginary;
    const denominatorReal = 1 + alpha / amplitude
        - 2 * centerCosine * z1Real
        + (1 - alpha / amplitude) * z2Real;
    const denominatorImaginary = -2 * centerCosine * z1Imaginary
        + (1 - alpha / amplitude) * z2Imaginary;
    const numeratorPower = numeratorReal * numeratorReal
        + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal
        + denominatorImaginary * denominatorImaginary;
    return clamp(
        10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30)),
        0,
        12,
    );
}

/** Project absolute signal level onto the shared right-hand dBFS axis. */
function levelToY(levelDbfs: number): number {
    const normalized = (
        clamp(
            levelDbfs,
            SPECTRUM_PLOT.minimumLevelDbfs,
            SPECTRUM_PLOT.maximumLevelDbfs,
        ) - SPECTRUM_PLOT.minimumLevelDbfs
    ) / (
        SPECTRUM_PLOT.maximumLevelDbfs
        - SPECTRUM_PLOT.minimumLevelDbfs
    );
    return SPECTRUM_PLOT.height - SPECTRUM_PLOT.bottom
        - normalized * (
            SPECTRUM_PLOT.height
            - SPECTRUM_PLOT.top
            - SPECTRUM_PLOT.bottom
        );
}

/**
 * Build a response path whose sampling and X coordinates are owned by the
 * shared frequency geometry; callers supply only the stage-specific Y law.
 */
export function frequencyPath(
    yAtFrequency: (frequencyHz: number) => number,
): string {
    return spectrumRanges.map(({ centerHz }, index) => (
        `${index === 0 ? "M" : "L"} ${frequencyToX(centerHz).toFixed(2)} `
        + yAtFrequency(centerHz).toFixed(2)
    )).join(" ");
}

/** Parse, smooth, and project one analyser event into the shared plot. */
export function advanceSpectrum(
    message: unknown,
    previous: SpectrumDisplay | null,
    timestampMs: number,
): SpectrumDisplay | null {
    const frame = normalizeSpectrumMessage(message);
    if (frame === null) {
        return previous;
    }

    const magnitudesDbfs = smoothSpectrum(previous, sampleFrame(frame), timestampMs);
    const path = frequencyPath((frequencyHz) => {
        const index = Math.round(
            Math.log(frequencyHz / SPECTRUM_PLOT.minimumHz)
            / Math.log(
                SPECTRUM_PLOT.maximumHz / SPECTRUM_PLOT.minimumHz,
            )
            * (spectrumPointCount - 1),
        );
        return levelToY(
            magnitudesDbfs[index] ?? SPECTRUM_PLOT.minimumLevelDbfs,
        );
    });

    return {
        path,
        peakDbfs: findPeakDbfs(magnitudesDbfs),
        magnitudesDbfs,
        timestampMs,
    };
}

/** Endpoint IDs for the editor-only analyser. */
export const ANALYZER_ENDPOINTS = Object.freeze({
    enabled: "analyzerEnabledIn",
    input: "inputSpectrum",
    output: "outputSpectrum",
});

const shelfMinimumDisplayDb = -18;
const shelfMaximumDisplayDb = 30;

/**
 * Project the measured shelf response without changing shared graph geometry.
 * Genuine high-Q overflow is compressed into the otherwise unused margins.
 */
export function shelfGainToY(gainDb: number): number {
    if (gainDb > SPECTRUM_PLOT.maximumGainDb) {
        const normalized = (
            clamp(gainDb, SPECTRUM_PLOT.maximumGainDb, shelfMaximumDisplayDb) - SPECTRUM_PLOT.maximumGainDb
        ) / (shelfMaximumDisplayDb - SPECTRUM_PLOT.maximumGainDb);
        return SPECTRUM_PLOT.top * (1 - normalized);
    }

    if (gainDb < SPECTRUM_PLOT.minimumGainDb) {
        const normalized = (
            SPECTRUM_PLOT.minimumGainDb - clamp(gainDb, shelfMinimumDisplayDb, SPECTRUM_PLOT.minimumGainDb)
        ) / (SPECTRUM_PLOT.minimumGainDb - shelfMinimumDisplayDb);
        return SPECTRUM_PLOT.height - SPECTRUM_PLOT.bottom + normalized * SPECTRUM_PLOT.bottom;
    }

    return gainToY(gainDb);
}

/** The band's selection shapes, in the order of the DSP's shape values. */
export const SHAPES = Object.freeze(["low", "bell", "high"] as const);
export type Shape = typeof SHAPES[number];

/** Evaluate the RBJ shelf the DSP runs, at the response model's sample rate. */
function shelfResponseDb(
    shape: Exclude<Shape, "bell">,
    frequencyHz: number,
    centreHz: number,
    q: number,
    amount: number,
): number {
    const amplitude = Math.pow(10, 12 * clamp(amount, 0, 1) / 40);
    const centreOmega = 2 * Math.PI * clamp(centreHz, 20, 20_000) / responseModelSampleRate;
    const centreCosine = Math.cos(centreOmega);
    const beta = Math.sin(centreOmega) * Math.sqrt(amplitude) / clamp(q, 0.1, 10);
    const plus = amplitude + 1;
    const minus = amplitude - 1;
    const [b0, b1, b2, a0, a1, a2] = shape === "low"
        ? [
            amplitude * (plus - minus * centreCosine + beta),
            2 * amplitude * (minus - plus * centreCosine),
            amplitude * (plus - minus * centreCosine - beta),
            plus + minus * centreCosine + beta,
            -2 * (minus + plus * centreCosine),
            plus + minus * centreCosine - beta,
        ]
        : [
            amplitude * (plus + minus * centreCosine + beta),
            -2 * amplitude * (minus + plus * centreCosine),
            amplitude * (plus + minus * centreCosine - beta),
            plus - minus * centreCosine + beta,
            2 * (minus - plus * centreCosine),
            plus - minus * centreCosine - beta,
        ];

    const omega = 2 * Math.PI * clamp(frequencyHz, 20, 20_000) / responseModelSampleRate;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = b0 + b1 * z1Real + b2 * z2Real;
    const numeratorImaginary = b1 * z1Imaginary + b2 * z2Imaginary;
    const denominatorReal = a0 + a1 * z1Real + a2 * z2Real;
    const denominatorImaginary = a1 * z1Imaginary + a2 * z2Imaginary;
    const numeratorPower = numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;
    return 10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30));
}

/** The plot Y of the band's response at one frequency. */
export function responseY(shape: Shape, frequencyHz: number, centreHz: number, q: number, amount: number): number {
    return shape === "bell"
        ? gainToY(bellResponseDb(frequencyHz, centreHz, q, amount))
        : shelfGainToY(shelfResponseDb(shape, frequencyHz, centreHz, q, amount));
}

/** The band's response curve, or with `closeArea` the area between it and 0 dB. */
export function responsePath(shape: Shape, centreHz: number, q: number, amount: number, closeArea = false): string {
    const path = frequencyPath((frequencyHz) => responseY(shape, frequencyHz, centreHz, q, amount));
    if (!closeArea)
        return path;

    const baseline = gainToY(0).toFixed(2);
    const right = (SPECTRUM_PLOT.width - SPECTRUM_PLOT.right).toFixed(2);
    return `${path} L ${right} ${baseline} L ${SPECTRUM_PLOT.left.toFixed(2)} ${baseline} Z`;
}
