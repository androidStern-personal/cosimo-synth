export const MSEG_BODY_SAMPLES = 2048;
export const MSEG_PADDED_SAMPLES = MSEG_BODY_SAMPLES + 3;
export const MSEG_CURVE_POWER_LIMIT = 20;
export const MSEG_DEFAULT_NAME = "MSEG 1";
export const MSEG_DEFAULT_DEPTH = 1.0;
export const MSEG_RATE_MIN_SECONDS = 0.0;
export const MSEG_RATE_MAX_SECONDS = 2.0;
export const MSEG_RATE_KIND_SECONDS = 0;
export const MSEG_RATE_KIND_TEMPO = 1;
export const MSEG_NOTE_OFF_POLICY_FINISH_LOOP = 0;
export const MSEG_NOTE_OFF_POLICY_IMMEDIATE = 1;
export const MSEG_NOTE_OFF_POLICY_IGNORE = 2;
export const MSEG_POINT_HIT_RADIUS_PX = 16;
export const MSEG_SEGMENT_HIT_RADIUS_PX = 10;
export const MSEG_POINT_RADIUS_PX = 8;
export const MSEG_SELECTED_POINT_RADIUS_PX = 10;
export const MSEG_EDITOR_HORIZONTAL_PADDING_PX = 14;
export const MSEG_EDITOR_VERTICAL_PADDING_PX = 14;
export const MSEG_EDITOR_CURVE_TOLERANCE_PX = 0.5;
const MSEG_EDITOR_MAX_SUBDIVISION_DEPTH = 12;

export type MsegSurfaceOrientation = "horizontal" | "vertical";

type MsegEditorCoordinateOptions = {
    orientation?: MsegSurfaceOrientation;
    pointRadius?: number;
    horizontalPadding?: number;
    verticalPadding?: number;
};

const MSEG_NOTE_OFF_POLICY_VALUES = new Set([
    "finish_loop",
    "immediate",
    "ignore",
] as const);

export type MsegPoint = {
    x: number;
    y: number;
    curvePower: number;
};

export type MsegShape = {
    format: "cosimo.mseg.shape";
    version: 1;
    name: string;
    globalSmooth: boolean;
    points: MsegPoint[];
};

export type MsegPlaybackLoop = {
    startX: number;
    endX: number;
};

export type MsegPlayback = {
    format: "cosimo.mseg.playback";
    version: 1;
    rate: {
        kind: "seconds";
        seconds: number;
    };
    loop: MsegPlaybackLoop | null;
    noteOffPolicy: "finish_loop" | "immediate" | "ignore";
    legatoRestarts: boolean;
    holdFinalValue: boolean;
};

export type MsegState = {
    shape: MsegShape;
    playback: MsegPlayback;
    depth: number;
};

export type MsegPlaybackConfigEvent = {
    seconds: number;
    holdFinalValue: boolean;
    rateKind: number;
    loopEnabled: boolean;
    loopStart: number;
    loopEnd: number;
    noteOffPolicy: number;
    legatoRestarts: boolean;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function almostEqual(left: number, right: number, epsilon = 1e-12) {
    return Math.abs(left - right) <= epsilon;
}

function clampCurvePower(value: number) {
    return clamp(Number.isFinite(value) ? value : 0.0, -MSEG_CURVE_POWER_LIMIT, MSEG_CURVE_POWER_LIMIT);
}

export function clamp01(value: number) {
    return clamp(Number.isFinite(value) ? value : 0.0, 0.0, 1.0);
}

export function createDefaultMsegShape(name = MSEG_DEFAULT_NAME): MsegShape {
    return {
        format: "cosimo.mseg.shape",
        version: 1,
        name,
        globalSmooth: false,
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    };
}

export function createDefaultMsegPlayback(): MsegPlayback {
    return {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: {
            kind: "seconds",
            seconds: 1.0,
        },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    };
}

export function clampMsegDepth(value: number) {
    return clamp(Number.isFinite(value) ? value : 0.0, -1.0, 1.0);
}

export function clampMsegRateSeconds(value: number) {
    const numericValue = Number(value);
    return clamp(
        Number.isFinite(numericValue) ? numericValue : 1.0,
        MSEG_RATE_MIN_SECONDS,
        MSEG_RATE_MAX_SECONDS,
    );
}

export function createMsegEditorMetrics(
    width: number,
    height: number,
    {
        pointRadius = MSEG_POINT_RADIUS_PX,
        horizontalPadding = MSEG_EDITOR_HORIZONTAL_PADDING_PX,
        verticalPadding = MSEG_EDITOR_VERTICAL_PADDING_PX,
    }: {
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    const safeWidth = Math.max(1, Number(width) || 0);
    const safeHeight = Math.max(1, Number(height) || 0);
    const safePointRadius = Math.max(0, Number(pointRadius) || 0);
    const safeHorizontalPadding = Math.max(0, Number(horizontalPadding) || 0);
    const safeVerticalPadding = Math.max(0, Number(verticalPadding) || 0);
    const maxInsetX = Math.max(0, (safeWidth - 1) * 0.5);
    const maxInsetY = Math.max(0, (safeHeight - 1) * 0.5);
    const insetX = Math.min(maxInsetX, safePointRadius + safeHorizontalPadding);
    const insetY = Math.min(maxInsetY, safePointRadius + safeVerticalPadding);
    const plotLeft = insetX;
    const plotTop = insetY;
    const plotRight = Math.max(plotLeft + 1, safeWidth - insetX);
    const plotBottom = Math.max(plotTop + 1, safeHeight - insetY);

    return {
        width: safeWidth,
        height: safeHeight,
        pointRadius: safePointRadius,
        plotLeft,
        plotTop,
        plotRight,
        plotBottom,
        plotWidth: Math.max(1, plotRight - plotLeft),
        plotHeight: Math.max(1, plotBottom - plotTop),
    };
}

export function pointToMsegEditorCoordinates(
    point: Pick<MsegPoint, "x" | "y">,
    width: number,
    height: number,
    options: MsegEditorCoordinateOptions = {},
) {
    const metrics = createMsegEditorMetrics(width, height, options);
    const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
    const normalizedX = clamp01(Number(point?.x));
    const normalizedY = clamp01(Number(point?.y));

    if (orientation === "vertical") {
        return {
            x: metrics.plotLeft + (normalizedY * metrics.plotWidth),
            y: metrics.plotTop + (normalizedX * metrics.plotHeight),
        };
    }

    return {
        x: metrics.plotLeft + (normalizedX * metrics.plotWidth),
        y: metrics.plotTop + ((1.0 - normalizedY) * metrics.plotHeight),
    };
}

export function msegEditorCoordinatesToPoint(
    editorX: number,
    editorY: number,
    width: number,
    height: number,
    options: MsegEditorCoordinateOptions = {},
) {
    const metrics = createMsegEditorMetrics(width, height, options);
    const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";

    if (orientation === "vertical") {
        return {
            x: clamp01((Number(editorY) - metrics.plotTop) / metrics.plotHeight),
            y: clamp01((Number(editorX) - metrics.plotLeft) / metrics.plotWidth),
        };
    }

    return {
        x: clamp01((Number(editorX) - metrics.plotLeft) / metrics.plotWidth),
        y: clamp01(1.0 - ((Number(editorY) - metrics.plotTop) / metrics.plotHeight)),
    };
}

function normalizeMsegLoop(loop: unknown): MsegPlaybackLoop | null {
    if (!loop || typeof loop !== "object") {
        return null;
    }

    const nextLoop = loop as Partial<MsegPlaybackLoop>;
    const startX = clamp01(Number(nextLoop.startX));
    const endX = clamp01(Number(nextLoop.endX));

    if (almostEqual(startX, endX)) {
        return null;
    }

    if (endX < startX) {
        return {
            startX: endX,
            endX: startX,
        };
    }

    return { startX, endX };
}

export function normalizeMsegPlayback(playback: unknown = createDefaultMsegPlayback()): MsegPlayback {
    const next = playback && typeof playback === "object" ? playback as Partial<MsegPlayback> : {};
    const rate = next.rate && typeof next.rate === "object" ? next.rate : {};
    const seconds = Number((rate as { seconds?: unknown }).seconds);
    const noteOffPolicyCandidate = next.noteOffPolicy;
    const noteOffPolicy = MSEG_NOTE_OFF_POLICY_VALUES.has(noteOffPolicyCandidate as MsegPlayback["noteOffPolicy"])
        ? noteOffPolicyCandidate as MsegPlayback["noteOffPolicy"]
        : "finish_loop";

    return {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: {
            kind: "seconds",
            seconds: clampMsegRateSeconds(Number.isFinite(seconds) ? seconds : 1.0),
        },
        loop: normalizeMsegLoop(next.loop),
        noteOffPolicy,
        legatoRestarts: Boolean(next.legatoRestarts),
        holdFinalValue: next.holdFinalValue !== false,
    };
}

function normalizePoint(point: unknown, pointIndex: number, pointCount: number): MsegPoint {
    const nextPoint = point && typeof point === "object" ? point as Partial<MsegPoint> : {};
    let x = Number(nextPoint.x);

    if (!Number.isFinite(x)) {
        x = pointIndex === 0 ? 0.0 : pointIndex === pointCount - 1 ? 1.0 : 0.0;
    }

    if (pointIndex !== 0 && pointIndex !== pointCount - 1) {
        x = clamp01(x);
    }

    return {
        x,
        y: clamp01(Number(nextPoint.y)),
        curvePower: clampCurvePower(Number(nextPoint.curvePower)),
    };
}

export function normalizeMsegShape(shape: unknown = createDefaultMsegShape()): MsegShape {
    const next = shape && typeof shape === "object" ? shape as Partial<MsegShape> : {};
    const inputPoints = Array.isArray(next.points) ? next.points : [];

    if (inputPoints.length < 2) {
        throw new Error("MSEG shapes require at least two points");
    }

    const points = inputPoints.map((point, index) => normalizePoint(point, index, inputPoints.length));

    if (!almostEqual(points[0].x, 0.0) || !almostEqual(points[points.length - 1].x, 1.0)) {
        throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
    }

    for (let index = 1; index < points.length; index += 1) {
        if (points[index].x < points[index - 1].x) {
            throw new Error("MSEG shape points must stay in non-decreasing x order");
        }
    }

    return {
        format: "cosimo.mseg.shape",
        version: 1,
        name: typeof next.name === "string" && next.name.trim() ? next.name : MSEG_DEFAULT_NAME,
        globalSmooth: Boolean(next.globalSmooth),
        points,
    };
}

export function serializeMsegShape(shape: unknown) {
    return JSON.stringify(normalizeMsegShape(shape));
}

export function deserializeMsegShape(value: unknown): MsegShape {
    if (typeof value !== "string" || !value.trim()) {
        return createDefaultMsegShape();
    }

    try {
        return normalizeMsegShape(JSON.parse(value));
    } catch {
        return createDefaultMsegShape();
    }
}

export function serializeMsegPlayback(playback: unknown) {
    return JSON.stringify(normalizeMsegPlayback(playback));
}

export function deserializeMsegPlayback(value: unknown): MsegPlayback {
    if (typeof value !== "string" || !value.trim()) {
        return createDefaultMsegPlayback();
    }

    try {
        return normalizeMsegPlayback(JSON.parse(value));
    } catch {
        return createDefaultMsegPlayback();
    }
}

export function deserializeMsegDepth(value: unknown) {
    const numericValue = Number(value);
    return clampMsegDepth(Number.isFinite(numericValue) ? numericValue : MSEG_DEFAULT_DEPTH);
}

function powerScale(value: number, power: number) {
    if (Math.abs(power) < 0.01) {
        return value;
    }

    const numerator = Math.exp(power * value) - 1.0;
    const denominator = Math.exp(power) - 1.0;
    return numerator / denominator;
}

function evaluateMsegSegmentPoint(
    from: MsegPoint,
    to: MsegPoint,
    t: number,
): MsegPoint {
    const clampedT = clamp01(t);
    const curvedT = clamp01(powerScale(clampedT, from.curvePower));

    return {
        x: from.x + ((to.x - from.x) * clampedT),
        y: from.y + ((to.y - from.y) * curvedT),
        curvePower: from.curvePower,
    };
}

function distanceSquaredToLineSegment(
    targetX: number,
    targetY: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
) {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const segmentLengthSquared = (deltaX * deltaX) + (deltaY * deltaY);

    if (segmentLengthSquared <= 1e-12) {
        const pointDeltaX = targetX - fromX;
        const pointDeltaY = targetY - fromY;
        return (pointDeltaX * pointDeltaX) + (pointDeltaY * pointDeltaY);
    }

    const projection = clamp(
        (((targetX - fromX) * deltaX) + ((targetY - fromY) * deltaY)) / segmentLengthSquared,
        0,
        1,
    );
    const closestX = fromX + (deltaX * projection);
    const closestY = fromY + (deltaY * projection);
    const pointDeltaX = targetX - closestX;
    const pointDeltaY = targetY - closestY;
    return (pointDeltaX * pointDeltaX) + (pointDeltaY * pointDeltaY);
}

export function sampleMsegSegmentEditorPolyline(
    shape: unknown,
    segmentIndex: number,
    width: number,
    height: number,
    editorOptions: MsegEditorCoordinateOptions = {},
) {
    const normalizedShape = normalizeMsegShape(shape);

    if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
        return [];
    }

    const from = normalizedShape.points[segmentIndex];
    const to = normalizedShape.points[segmentIndex + 1];
    const startCoordinates = pointToMsegEditorCoordinates(from, width, height, editorOptions);
    const endCoordinates = pointToMsegEditorCoordinates(to, width, height, editorOptions);

    if (almostEqual(from.x, to.x)) {
        return [startCoordinates, endCoordinates];
    }

    const polyline: Array<{ x: number; y: number }> = [startCoordinates];
    const errorToleranceSquared = MSEG_EDITOR_CURVE_TOLERANCE_PX * MSEG_EDITOR_CURVE_TOLERANCE_PX;

    const appendAdaptiveSamples = (
        startT: number,
        endT: number,
        startPointCoordinates: { x: number; y: number },
        endPointCoordinates: { x: number; y: number },
        depth: number,
    ) => {
        if (depth >= MSEG_EDITOR_MAX_SUBDIVISION_DEPTH) {
            polyline.push(endPointCoordinates);
            return;
        }

        const midpointT = startT + ((endT - startT) * 0.5);
        const midpoint = evaluateMsegSegmentPoint(from, to, midpointT);
        const midpointCoordinates = pointToMsegEditorCoordinates(midpoint, width, height, editorOptions);
        const errorSquared = distanceSquaredToLineSegment(
            midpointCoordinates.x,
            midpointCoordinates.y,
            startPointCoordinates.x,
            startPointCoordinates.y,
            endPointCoordinates.x,
            endPointCoordinates.y,
        );

        if (errorSquared <= errorToleranceSquared) {
            polyline.push(endPointCoordinates);
            return;
        }

        appendAdaptiveSamples(startT, midpointT, startPointCoordinates, midpointCoordinates, depth + 1);
        appendAdaptiveSamples(midpointT, endT, midpointCoordinates, endPointCoordinates, depth + 1);
    };

    appendAdaptiveSamples(0.0, 1.0, startCoordinates, endCoordinates, 0);

    return polyline;
}

export function sampleMsegEditorPolyline(
    shape: unknown,
    width: number,
    height: number,
    editorOptions: MsegEditorCoordinateOptions = {},
) {
    const normalizedShape = normalizeMsegShape(shape);
    const polyline: Array<{ x: number; y: number }> = [];

    for (let segmentIndex = 0; segmentIndex < normalizedShape.points.length - 1; segmentIndex += 1) {
        const segmentPolyline = sampleMsegSegmentEditorPolyline(
            normalizedShape,
            segmentIndex,
            width,
            height,
            editorOptions,
        );

        if (segmentPolyline.length === 0) {
            continue;
        }

        if (polyline.length === 0) {
            polyline.push(...segmentPolyline);
            continue;
        }

        polyline.push(...segmentPolyline.slice(1));
    }

    return polyline;
}

function findEvaluationSegment(points: MsegPoint[], x: number) {
    if (x <= points[0].x) {
        return { from: points[0], to: points[0], laterPointWins: false };
    }

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];

        if (x < to.x) {
            return { from, to, laterPointWins: false };
        }

        if (almostEqual(x, to.x)) {
            let latestIndex = index + 1;
            while (latestIndex + 1 < points.length && almostEqual(points[latestIndex + 1].x, x)) {
                latestIndex += 1;
            }

            return {
                from: points[latestIndex],
                to: points[latestIndex],
                laterPointWins: true,
            };
        }
    }

    return {
        from: points[points.length - 1],
        to: points[points.length - 1],
        laterPointWins: false,
    };
}

function evaluateNormalizedMsegShape(points: MsegPoint[], x: number) {
    const clampedX = clamp01(Number(x));
    const segment = findEvaluationSegment(points, clampedX);

    if (segment.laterPointWins || almostEqual(segment.from.x, segment.to.x)) {
        return segment.to.y;
    }

    const width = segment.to.x - segment.from.x;
    const t = width <= 0.0 ? 1.0 : (clampedX - segment.from.x) / width;
    const curvedT = clamp01(powerScale(t, segment.from.curvePower));
    return segment.from.y + ((segment.to.y - segment.from.y) * curvedT);
}

export function evaluateMsegShape(shape: unknown, x: number) {
    return evaluateNormalizedMsegShape(normalizeMsegShape(shape).points, x);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
    return p1 + (0.5 * t * (
        (p2 - p0) + (t * (
            ((2.0 * p0) - (5.0 * p1) + (4.0 * p2) - p3) + (t * (-p0 + (3.0 * p1) - (3.0 * p2) + p3))
        ))
    ));
}

export function renderMsegShape(shape: unknown) {
    const normalizedShape = normalizeMsegShape(shape);
    const body = new Float32Array(MSEG_BODY_SAMPLES);

    for (let sampleIndex = 0; sampleIndex < MSEG_BODY_SAMPLES; sampleIndex += 1) {
        const x = sampleIndex / (MSEG_BODY_SAMPLES - 1);
        body[sampleIndex] = evaluateMsegShape(normalizedShape, x);
    }

    const padded = new Float32Array(MSEG_PADDED_SAMPLES);
    padded[0] = body[0];
    padded.set(body, 1);
    padded[MSEG_BODY_SAMPLES + 1] = body[MSEG_BODY_SAMPLES - 1];
    padded[MSEG_BODY_SAMPLES + 2] = body[MSEG_BODY_SAMPLES - 1];
    return padded;
}

export function sampleRenderedMsegBuffer(paddedBuffer: Float32Array, x: number) {
    if (!(paddedBuffer instanceof Float32Array) || paddedBuffer.length !== MSEG_PADDED_SAMPLES) {
        throw new Error(`Rendered MSEG buffers must be a Float32Array with ${MSEG_PADDED_SAMPLES} samples`);
    }

    const clampedX = clamp01(Number(x));
    const scaled = clampedX * (MSEG_BODY_SAMPLES - 1);
    const sampleIndex = Math.floor(scaled);
    const fractional = scaled - sampleIndex;
    return catmullRom(
        paddedBuffer[sampleIndex],
        paddedBuffer[sampleIndex + 1],
        paddedBuffer[sampleIndex + 2],
        paddedBuffer[sampleIndex + 3],
        fractional,
    );
}

export function findMsegPointHitIndex(
    shape: unknown,
    editorX: number,
    editorY: number,
    width: number,
    height: number,
    hitRadius = MSEG_POINT_HIT_RADIUS_PX,
    editorOptions: {
        orientation?: MsegSurfaceOrientation;
        pointRadius?: number;
        horizontalPadding?: number;
        verticalPadding?: number;
    } = {},
) {
    const points = normalizeMsegShape(shape).points;
    const targetX = Number(editorX);
    const targetY = Number(editorY);

    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return -1;
    }

    const safeHitRadius = Math.max(0, Number(hitRadius) || 0);
    let closestPointIndex = -1;
    let closestDistanceSquared = safeHitRadius * safeHitRadius;

    points.forEach((point, pointIndex) => {
        const coordinates = pointToMsegEditorCoordinates(point, width, height, editorOptions);
        const deltaX = targetX - coordinates.x;
        const deltaY = targetY - coordinates.y;
        const distanceSquared = (deltaX * deltaX) + (deltaY * deltaY);

        if (distanceSquared <= closestDistanceSquared) {
            closestPointIndex = pointIndex;
            closestDistanceSquared = distanceSquared;
        }
    });

    return closestPointIndex;
}

export function findMsegSegmentHitIndex(
    shape: unknown,
    editorX: number,
    editorY: number,
    width: number,
    height: number,
    hitRadius = MSEG_SEGMENT_HIT_RADIUS_PX,
    editorOptions: MsegEditorCoordinateOptions = {},
) {
    const normalizedShape = normalizeMsegShape(shape);
    const targetX = Number(editorX);
    const targetY = Number(editorY);

    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        return -1;
    }

    const safeHitRadius = Math.max(0, Number(hitRadius) || 0);
    let closestSegmentIndex = -1;
    let closestDistanceSquared = safeHitRadius * safeHitRadius;

    for (let segmentIndex = 0; segmentIndex < normalizedShape.points.length - 1; segmentIndex += 1) {
        const polyline = sampleMsegSegmentEditorPolyline(
            normalizedShape,
            segmentIndex,
            width,
            height,
            editorOptions,
        );

        for (let pointIndex = 0; pointIndex < polyline.length - 1; pointIndex += 1) {
            const from = polyline[pointIndex];
            const to = polyline[pointIndex + 1];
            const distanceSquared = distanceSquaredToLineSegment(
                targetX,
                targetY,
                from.x,
                from.y,
                to.x,
                to.y,
            );

            if (distanceSquared <= closestDistanceSquared) {
                closestSegmentIndex = segmentIndex;
                closestDistanceSquared = distanceSquared;
            }
        }
    }

    return closestSegmentIndex;
}

export function deriveMsegSegmentCurvePower(
    shape: unknown,
    segmentIndex: number,
    x: number,
    y: number,
) {
    const normalizedShape = normalizeMsegShape(shape);
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
        throw new Error("segmentIndex must address a segment inside the shape");
    }

    const from = normalizedShape.points[segmentIndex];
    const to = normalizedShape.points[segmentIndex + 1];
    const width = to.x - from.x;
    const deltaY = to.y - from.y;

    if (width <= 1e-12 || Math.abs(deltaY) <= 1e-12) {
        return 0;
    }

    const localX = clamp(clamp01(Number(x)), from.x, to.x);
    const t = clamp((localX - from.x) / width, 1e-4, 1 - 1e-4);
    const targetCurvedT = clamp((Number(y) - from.y) / deltaY, 1e-4, 1 - 1e-4);

    if (!Number.isFinite(targetCurvedT) || almostEqual(targetCurvedT, t, 1e-4)) {
        return 0;
    }

    let low = -MSEG_CURVE_POWER_LIMIT;
    let high = MSEG_CURVE_POWER_LIMIT;
    let lowValue = powerScale(t, low);
    let highValue = powerScale(t, high);
    const target = clamp(targetCurvedT, Math.min(lowValue, highValue), Math.max(lowValue, highValue));
    const ascending = lowValue <= highValue;

    for (let iteration = 0; iteration < 32; iteration += 1) {
        const middle = (low + high) * 0.5;
        const middleValue = powerScale(t, middle);

        if (almostEqual(middleValue, target, 1e-5)) {
            return clampCurvePower(middle);
        }

        if ((ascending && middleValue < target) || (!ascending && middleValue > target)) {
            low = middle;
            lowValue = middleValue;
        } else {
            high = middle;
            highValue = middleValue;
        }
    }

    return clampCurvePower((low + high) * 0.5);
}

export function toMsegPlaybackConfigEvent(playback: unknown): MsegPlaybackConfigEvent {
    const normalizedPlayback = normalizeMsegPlayback(playback);

    return {
        seconds: normalizedPlayback.rate.seconds,
        holdFinalValue: normalizedPlayback.holdFinalValue,
        rateKind: MSEG_RATE_KIND_SECONDS,
        loopEnabled: normalizedPlayback.loop !== null,
        loopStart: normalizedPlayback.loop?.startX ?? 0.0,
        loopEnd: normalizedPlayback.loop?.endX ?? 0.0,
        noteOffPolicy:
            normalizedPlayback.noteOffPolicy === "immediate"
                ? MSEG_NOTE_OFF_POLICY_IMMEDIATE
                : normalizedPlayback.noteOffPolicy === "ignore"
                    ? MSEG_NOTE_OFF_POLICY_IGNORE
                    : MSEG_NOTE_OFF_POLICY_FINISH_LOOP,
        legatoRestarts: normalizedPlayback.legatoRestarts,
    };
}

export function msegShapesEqual(left: unknown, right: unknown) {
    return serializeMsegShape(left) === serializeMsegShape(right);
}

export function msegPlaybacksEqual(left: unknown, right: unknown) {
    return serializeMsegPlayback(left) === serializeMsegPlayback(right);
}

export function addMsegPoint(shape: unknown, x: number, y: number) {
    const normalizedShape = normalizeMsegShape(shape);
    const points = normalizedShape.points.map((point) => ({ ...point }));
    const nextPoint: MsegPoint = {
        x: clamp01(Number(x)),
        y: clamp01(Number(y)),
        curvePower: 0.0,
    };

    let insertIndex = points.length - 1;
    while (insertIndex > 0 && points[insertIndex - 1].x > nextPoint.x) {
        insertIndex -= 1;
    }

    points.splice(insertIndex, 0, nextPoint);
    return normalizeMsegShape({
        ...normalizedShape,
        points,
    });
}

export function moveMsegPoint(shape: unknown, pointIndex: number, x: number, y: number) {
    const normalizedShape = normalizeMsegShape(shape);
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= normalizedShape.points.length) {
        throw new Error("pointIndex must address a point inside the shape");
    }

    const points = normalizedShape.points.map((point) => ({ ...point }));
    const previousX = pointIndex > 0 ? points[pointIndex - 1].x : 0.0;
    const nextX = pointIndex < points.length - 1 ? points[pointIndex + 1].x : 1.0;
    const moved = { ...points[pointIndex] };
    moved.y = clamp01(Number(y));

    if (pointIndex === 0) {
        moved.x = 0.0;
    } else if (pointIndex === points.length - 1) {
        moved.x = 1.0;
    } else {
        moved.x = clamp(clamp01(Number(x)), previousX, nextX);
    }

    points[pointIndex] = moved;
    return normalizeMsegShape({
        ...normalizedShape,
        points,
    });
}

export function deleteMsegPoint(shape: unknown, pointIndex: number) {
    const normalizedShape = normalizeMsegShape(shape);
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= normalizedShape.points.length) {
        throw new Error("pointIndex must address a point inside the shape");
    }

    if (pointIndex === 0 || pointIndex === normalizedShape.points.length - 1) {
        return normalizedShape;
    }

    const points = normalizedShape.points.filter((_, index) => index !== pointIndex);
    return normalizeMsegShape({
        ...normalizedShape,
        points,
    });
}

export function setMsegSegmentCurvePower(shape: unknown, segmentIndex: number, curvePower: number) {
    const normalizedShape = normalizeMsegShape(shape);
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
        throw new Error("segmentIndex must address a segment inside the shape");
    }

    const points = normalizedShape.points.map((point) => ({ ...point }));
    points[segmentIndex].curvePower = clampCurvePower(Number(curvePower));

    return normalizeMsegShape({
        ...normalizedShape,
        points,
    });
}
