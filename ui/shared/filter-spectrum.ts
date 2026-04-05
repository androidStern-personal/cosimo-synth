import { FILTER_CUTOFF_MAX_HZ, FILTER_CUTOFF_MIN_HZ } from "./filter-response";

export const FILTER_SPECTRUM_MIN_DB = -90;
export const FILTER_SPECTRUM_MAX_DB = -18;
export const FILTER_SPECTRUM_BAND_COUNT = 120;
export const FILTER_SPECTRUM_GRAPH_POINT_COUNT = 320;
export const FILTER_SPECTRUM_ATTACK_TIME_MS = 70;
export const FILTER_SPECTRUM_RELEASE_TIME_MS = 180;
export const FILTER_SPECTRUM_PEAK_HOLD_MS = 300;
export const FILTER_SPECTRUM_PEAK_FALL_RATE_DB_PER_SECOND = 24;

const FILTER_SPECTRUM_FREQUENCY_TICK_VALUES = [20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000];
const FILTER_SPECTRUM_DB_TICK_VALUES = [-18, -36, -54, -72, -90];

export const FILTER_SPECTRUM_RENDER_MODE_OPTIONS = [
    { value: "graph", label: "Graph" },
    { value: "bars", label: "Bars" },
    { value: "round-bars", label: "Round Bars" },
] as const;

export type FilterSpectrumRenderMode = (typeof FILTER_SPECTRUM_RENDER_MODE_OPTIONS)[number]["value"];

export type FilterSpectrumFrame = {
    sampleRateHz: number;
    magnitudes: number[];
};

export type FilterSpectrumBand = {
    lowHz: number;
    centerHz: number;
    highHz: number;
    lowNormalizedX: number;
    normalizedX: number;
    highNormalizedX: number;
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
    graphPoints: FilterSpectrumBand[];
    bandMagnitudesDb: number[];
    graphMagnitudesDb: number[];
    peakBandIndex: number;
    peakGraphPointIndex: number;
};

export type FilterSpectrumDisplayState = FilterSpectrumDisplayFrame & {
    hasSpectrum: true;
    smoothedMagnitudesDb: number[];
    peakMagnitudesDb: number[];
    smoothedGraphMagnitudesDb: number[];
    peakGraphMagnitudesDb: number[];
    frequencyTicks: FilterSpectrumTick[];
    dbTicks: FilterSpectrumTick[];
    timestampMs: number;
    peakHoldUntilMs: number[];
    graphPeakHoldUntilMs: number[];
};

export type FilterSpectrumPlotPoint = {
    x: number;
    y: number;
};

export type FilterSpectrumBarRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
};

export type FilterSpectrumRenderGeometry =
    | {
        kind: "graph";
        pointCount: number;
        peakPointCount: number;
        points: FilterSpectrumPlotPoint[];
        peakPoints: FilterSpectrumPlotPoint[];
        plotLeft: number;
        plotRight: number;
        plotTop: number;
        plotBottom: number;
        plotWidth: number;
        plotHeight: number;
    }
    | {
        kind: "bars";
        barCount: number;
        rounded: boolean;
        bars: FilterSpectrumBarRect[];
        peakBars: FilterSpectrumBarRect[];
        plotLeft: number;
        plotRight: number;
        plotTop: number;
        plotBottom: number;
        plotWidth: number;
        plotHeight: number;
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

function buildSpectrumRanges(pointCount: number) {
    const safeCount = Math.max(1, Math.round(pointCount || 1));
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
            lowNormalizedX: frequencyHzToNormalized(lowHz),
            normalizedX: frequencyHzToNormalized(centerHz),
            highNormalizedX: frequencyHzToNormalized(highHz),
        };
    });
}

function blendDb(previousDb: number, targetDb: number, deltaMs: number, timeMs: number) {
    if (deltaMs <= 0 || timeMs <= 0) {
        return targetDb;
    }

    const coefficient = Math.exp(-deltaMs / timeMs);
    return targetDb + ((previousDb - targetDb) * coefficient);
}

function smoothDbArray(
    previousValues: number[] | undefined,
    nextValues: number[],
    deltaMs: number,
) {
    return nextValues.map((targetDb, index) => {
        const previousDb = previousValues?.[index] ?? targetDb;
        const timeMs = targetDb > previousDb ? FILTER_SPECTRUM_ATTACK_TIME_MS : FILTER_SPECTRUM_RELEASE_TIME_MS;
        return blendDb(previousDb, targetDb, deltaMs, timeMs);
    });
}

function updatePeakDbArray(
    previousPeaks: number[] | undefined,
    previousHoldUntilMs: number[] | undefined,
    smoothedValues: number[],
    timestampMs: number,
    deltaMs: number,
) {
    const peakValues = smoothedValues.map((smoothedDb, index) => {
        const previousPeakDb = previousPeaks?.[index] ?? smoothedDb;
        const holdUntilMs = previousHoldUntilMs?.[index] ?? timestampMs;

        if (smoothedDb >= previousPeakDb) {
            return smoothedDb;
        }

        if (timestampMs < holdUntilMs) {
            return previousPeakDb;
        }

        const decayedPeakDb = previousPeakDb - ((deltaMs / 1000) * FILTER_SPECTRUM_PEAK_FALL_RATE_DB_PER_SECOND);
        return Math.max(smoothedDb, decayedPeakDb);
    });

    const peakHoldUntilMs = smoothedValues.map((smoothedDb, index) => {
        const previousPeakDb = previousPeaks?.[index] ?? smoothedDb;
        const previousHoldUntilMsValue = previousHoldUntilMs?.[index] ?? timestampMs;
        return smoothedDb >= previousPeakDb
            ? timestampMs + FILTER_SPECTRUM_PEAK_HOLD_MS
            : previousHoldUntilMsValue;
    });

    return {
        peakValues,
        peakHoldUntilMs,
    };
}

function createPlotMetrics(
    width: number,
    height: number,
    {
        horizontalPadding = 18,
        verticalPadding = 16,
    }: {
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    const plotLeft = horizontalPadding;
    const plotRight = Math.max(horizontalPadding + 1, width - horizontalPadding);
    const plotTop = verticalPadding;
    const plotBottom = Math.max(verticalPadding + 1, height - verticalPadding);
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);

    return {
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        plotWidth,
        plotHeight,
    };
}

function createPlotPoint(
    normalizedX: number,
    magnitudeDb: number,
    plot: ReturnType<typeof createPlotMetrics>,
) {
    const x = plot.plotLeft + (plot.plotWidth * clamp(normalizedX, 0, 1));
    const normalizedY = clamp((clamp(magnitudeDb, FILTER_SPECTRUM_MIN_DB, FILTER_SPECTRUM_MAX_DB) - FILTER_SPECTRUM_MIN_DB)
        / (FILTER_SPECTRUM_MAX_DB - FILTER_SPECTRUM_MIN_DB), 0, 1);
    const y = plot.plotBottom - (plot.plotHeight * normalizedY);

    return { x, y };
}

function buildGraphPoints(
    ranges: FilterSpectrumBand[],
    magnitudesDb: number[],
    plot: ReturnType<typeof createPlotMetrics>,
) {
    return ranges.map((range, index) => createPlotPoint(range.normalizedX, magnitudesDb[index] ?? FILTER_SPECTRUM_MIN_DB, plot));
}

function buildBarRects(
    ranges: FilterSpectrumBand[],
    magnitudesDb: number[],
    plot: ReturnType<typeof createPlotMetrics>,
    rounded: boolean,
) {
    const gapPx = rounded ? 2.5 : 1.5;

    return ranges.map((range, index) => {
        const left = plot.plotLeft + (plot.plotWidth * range.lowNormalizedX);
        const right = plot.plotLeft + (plot.plotWidth * range.highNormalizedX);
        const rawWidth = Math.max(1, right - left);
        const width = Math.max(1, rawWidth - gapPx);
        const x = left + ((rawWidth - width) * 0.5);
        const top = createPlotPoint(range.normalizedX, magnitudesDb[index] ?? FILTER_SPECTRUM_MIN_DB, plot).y;
        const height = Math.max(0, plot.plotBottom - top);
        const radius = rounded ? Math.min(7, width * 0.45, height * 0.45) : 0;

        return {
            x,
            y: top,
            width,
            height,
            radius,
        };
    });
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
    return buildSpectrumRanges(pointCount);
}

export function buildFilterSpectrumGraphPoints(pointCount = FILTER_SPECTRUM_GRAPH_POINT_COUNT) {
    return buildSpectrumRanges(pointCount);
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

export function cycleFilterSpectrumRenderMode(currentMode: FilterSpectrumRenderMode): FilterSpectrumRenderMode {
    const currentIndex = FILTER_SPECTRUM_RENDER_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % FILTER_SPECTRUM_RENDER_MODE_OPTIONS.length
        : 0;
    return FILTER_SPECTRUM_RENDER_MODE_OPTIONS[nextIndex].value;
}

export function createFilterSpectrumDisplayFrame({
    frame,
    bands,
    graphPoints,
}: {
    frame: FilterSpectrumFrame | null | undefined;
    bands: FilterSpectrumBand[];
    graphPoints: FilterSpectrumBand[];
}): FilterSpectrumDisplayFrame | null {
    if (!frame || !Array.isArray(bands) || bands.length === 0 || !Array.isArray(graphPoints) || graphPoints.length === 0) {
        return null;
    }

    const sourceBinCount = frame.magnitudes.length;
    const maxBinIndex = Math.max(0, sourceBinCount - 1);
    const nyquistHz = Math.max(1, frame.sampleRateHz * 0.5);
    const sampleDisplayRange = (range: FilterSpectrumBand) => {
        const startIndex = clamp(Math.floor((clamp(range.lowHz, 0, nyquistHz) / nyquistHz) * maxBinIndex), 0, maxBinIndex);
        const endIndex = clamp(Math.ceil((clamp(range.highHz, 0, nyquistHz) / nyquistHz) * maxBinIndex), startIndex, maxBinIndex);
        return magnitudeToDb(sampleMagnitudeAtIndexRange(frame.magnitudes, startIndex, endIndex));
    };
    const bandMagnitudesDb = bands.map(sampleDisplayRange);
    const graphMagnitudesDb = graphPoints.map(sampleDisplayRange);

    return {
        sampleRateHz: frame.sampleRateHz,
        sourceBinCount,
        bands,
        graphPoints,
        bandMagnitudesDb,
        graphMagnitudesDb,
        peakBandIndex: findPeakIndex(bandMagnitudesDb),
        peakGraphPointIndex: findPeakIndex(graphMagnitudesDb),
    };
}

export function advanceFilterSpectrumDisplayState(
    previousState: FilterSpectrumDisplayState | null,
    nextFrame: FilterSpectrumDisplayFrame | null,
    timestampMs: number,
): FilterSpectrumDisplayState | null {
    if (!nextFrame) {
        return previousState;
    }

    const frequencyTicks = buildFilterSpectrumFrequencyTicks();
    const dbTicks = buildFilterSpectrumDbTicks();

    if (!previousState) {
        return {
            ...nextFrame,
            hasSpectrum: true,
            smoothedMagnitudesDb: [...nextFrame.bandMagnitudesDb],
            peakMagnitudesDb: [...nextFrame.bandMagnitudesDb],
            smoothedGraphMagnitudesDb: [...nextFrame.graphMagnitudesDb],
            peakGraphMagnitudesDb: [...nextFrame.graphMagnitudesDb],
            frequencyTicks,
            dbTicks,
            timestampMs,
            peakHoldUntilMs: new Array(nextFrame.bandMagnitudesDb.length).fill(timestampMs + FILTER_SPECTRUM_PEAK_HOLD_MS),
            graphPeakHoldUntilMs: new Array(nextFrame.graphMagnitudesDb.length).fill(timestampMs + FILTER_SPECTRUM_PEAK_HOLD_MS),
        };
    }

    const deltaMs = Math.max(0, timestampMs - previousState.timestampMs);
    const smoothedMagnitudesDb = smoothDbArray(previousState.smoothedMagnitudesDb, nextFrame.bandMagnitudesDb, deltaMs);
    const smoothedGraphMagnitudesDb = smoothDbArray(previousState.smoothedGraphMagnitudesDb, nextFrame.graphMagnitudesDb, deltaMs);
    const bandPeaks = updatePeakDbArray(
        previousState.peakMagnitudesDb,
        previousState.peakHoldUntilMs,
        smoothedMagnitudesDb,
        timestampMs,
        deltaMs,
    );
    const graphPeaks = updatePeakDbArray(
        previousState.peakGraphMagnitudesDb,
        previousState.graphPeakHoldUntilMs,
        smoothedGraphMagnitudesDb,
        timestampMs,
        deltaMs,
    );

    return {
        ...nextFrame,
        hasSpectrum: true,
        smoothedMagnitudesDb,
        peakMagnitudesDb: bandPeaks.peakValues,
        smoothedGraphMagnitudesDb,
        peakGraphMagnitudesDb: graphPeaks.peakValues,
        frequencyTicks,
        dbTicks,
        timestampMs,
        peakHoldUntilMs: bandPeaks.peakHoldUntilMs,
        graphPeakHoldUntilMs: graphPeaks.peakHoldUntilMs,
        peakBandIndex: findPeakIndex(smoothedMagnitudesDb),
        peakGraphPointIndex: findPeakIndex(smoothedGraphMagnitudesDb),
    };
}

export function buildFilterSpectrumRenderGeometry({
    renderMode,
    width,
    height,
    displayState,
}: {
    renderMode: FilterSpectrumRenderMode;
    width: number;
    height: number;
    displayState: FilterSpectrumDisplayState;
}): FilterSpectrumRenderGeometry {
    const plot = createPlotMetrics(width, height);

    if (renderMode === "graph") {
        const points = buildGraphPoints(displayState.graphPoints, displayState.smoothedGraphMagnitudesDb, plot);
        const peakPoints = buildGraphPoints(displayState.graphPoints, displayState.peakGraphMagnitudesDb, plot);

        return {
            kind: "graph",
            pointCount: points.length,
            peakPointCount: peakPoints.length,
            points,
            peakPoints,
            ...plot,
        };
    }

    const rounded = renderMode === "round-bars";
    const bars = buildBarRects(displayState.bands, displayState.smoothedMagnitudesDb, plot, rounded);
    const peakBars = buildBarRects(displayState.bands, displayState.peakMagnitudesDb, plot, rounded);

    return {
        kind: "bars",
        barCount: bars.length,
        rounded,
        bars,
        peakBars,
        ...plot,
    };
}
