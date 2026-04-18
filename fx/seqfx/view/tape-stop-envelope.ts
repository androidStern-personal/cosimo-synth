export const TAPE_STOP_SPEED_FLOOR = 0.005;
export const TAPE_STOP_MODE_STOP = 0;
export const TAPE_STOP_MODE_SPIN_UP = 1;
export const TAPE_STOP_MIN_STOP_POINT_PERCENT = 5;
export const TAPE_STOP_MAX_STOP_POINT_PERCENT = 400;
export const TAPE_STOP_MIN_CURVE = 0.25;
export const TAPE_STOP_MAX_CURVE = 4;
export const TAPE_STOP_MIN_CATCHUP_PERCENT = 0;
export const TAPE_STOP_MAX_CATCHUP_PERCENT = 100;

export type TapeStopEnvelopeInput = {
    blockDurationMs: number;
    mode?: number;
    stopPointPercent: number;
    curve: number;
    catchupPercent: number;
    catchupCurve: number;
};

export type ResolvedTapeStopEnvelope = TapeStopEnvelopeInput & {
    mode: number;
    stopPointMultiplier: number;
    stopPointMs: number;
    requestedCatchupDurationMs: number;
    catchupDurationMs: number;
    catchupStartMs: number;
};

export type TapeStopEnvelopeSample = {
    timeMs: number;
    normalizedTime: number;
    speed: number;
};

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

export function multiplierToStopPointPercent(multiplier: number) {
    return clamp(multiplier * 100, TAPE_STOP_MIN_STOP_POINT_PERCENT, TAPE_STOP_MAX_STOP_POINT_PERCENT);
}

export function stopPointPercentToMultiplier(percent: number) {
    return clamp(percent, TAPE_STOP_MIN_STOP_POINT_PERCENT, TAPE_STOP_MAX_STOP_POINT_PERCENT) / 100;
}

function resolveMode(mode: number | undefined) {
    return Math.round(Number(mode)) === TAPE_STOP_MODE_SPIN_UP
        ? TAPE_STOP_MODE_SPIN_UP
        : TAPE_STOP_MODE_STOP;
}

function stopSpeedAt(timeMs: number, stopPointMs: number, curve: number) {
    const safeStopPointMs = Math.max(1e-9, stopPointMs);
    const progress = clamp(timeMs / safeStopPointMs, 0, 1);

    if (progress >= 1) {
        return TAPE_STOP_SPEED_FLOOR;
    }

    return TAPE_STOP_SPEED_FLOOR
        + ((1 - TAPE_STOP_SPEED_FLOOR) * Math.pow(Math.max(0, 1 - progress), curve));
}

function spinUpSpeedAt(timeMs: number, rampEndMs: number, curve: number) {
    const safeRampEndMs = Math.max(1e-9, rampEndMs);
    const progress = clamp(timeMs / safeRampEndMs, 0, 1);

    if (progress >= 1) {
        return 1;
    }

    return TAPE_STOP_SPEED_FLOOR
        + ((1 - TAPE_STOP_SPEED_FLOOR) * Math.pow(progress, curve));
}

function releaseBaseSpeed(normalizedTime: number, catchupCurve: number) {
    const r = clamp(normalizedTime, 0, 1);
    return TAPE_STOP_SPEED_FLOOR
        + ((1 - TAPE_STOP_SPEED_FLOOR) * Math.pow(r, catchupCurve));
}

function catchupBaseSpeed(mode: number, normalizedTime: number, catchupCurve: number) {
    return mode === TAPE_STOP_MODE_SPIN_UP
        ? 1
        : releaseBaseSpeed(normalizedTime, catchupCurve);
}

function isResolvedTapeStopEnvelope(
    input: TapeStopEnvelopeInput | ResolvedTapeStopEnvelope,
): input is ResolvedTapeStopEnvelope {
    return "catchupStartMs" in input;
}

export function resolveTapeStopEnvelope(input: TapeStopEnvelopeInput): ResolvedTapeStopEnvelope {
    const blockDurationMs = Math.max(1, Number(input.blockDurationMs) || 1);
    const mode = resolveMode(input.mode);
    const stopPointPercent = clamp(
        Number(input.stopPointPercent),
        TAPE_STOP_MIN_STOP_POINT_PERCENT,
        TAPE_STOP_MAX_STOP_POINT_PERCENT,
    );
    const curve = clamp(Number(input.curve), TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupCurve = clamp(Number(input.catchupCurve), TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupPercent = clamp(
        Number(input.catchupPercent),
        TAPE_STOP_MIN_CATCHUP_PERCENT,
        TAPE_STOP_MAX_CATCHUP_PERCENT,
    );
    const stopPointMultiplier = stopPointPercentToMultiplier(stopPointPercent);
    const stopPointMs = blockDurationMs * stopPointMultiplier;
    const requestedCatchupDurationMs = blockDurationMs * (catchupPercent / 100);
    const requestedCatchupStartMs = blockDurationMs - requestedCatchupDurationMs;
    const catchupStartMs = stopPointMs < blockDurationMs
        ? Math.min(blockDurationMs, Math.max(stopPointMs, requestedCatchupStartMs))
        : blockDurationMs;
    const catchupDurationMs = Math.max(0, blockDurationMs - catchupStartMs);

    return {
        blockDurationMs,
        mode,
        stopPointPercent,
        curve,
        catchupPercent,
        catchupCurve,
        stopPointMultiplier,
        stopPointMs,
        requestedCatchupDurationMs,
        catchupDurationMs,
        catchupStartMs,
    };
}

export function evaluateTapeStopSpeed(input: TapeStopEnvelopeInput | ResolvedTapeStopEnvelope, timeMs: number) {
    const resolved = isResolvedTapeStopEnvelope(input) ? input : resolveTapeStopEnvelope(input);
    const safeTimeMs = clamp(timeMs, 0, resolved.blockDurationMs);

    if (resolved.catchupDurationMs > 0 && safeTimeMs >= resolved.catchupStartMs) {
        const releaseTime = safeTimeMs - resolved.catchupStartMs;
        const normalizedReleaseTime = releaseTime / resolved.catchupDurationMs;
        return catchupBaseSpeed(resolved.mode, normalizedReleaseTime, resolved.catchupCurve);
    }

    return resolved.mode === TAPE_STOP_MODE_SPIN_UP
        ? spinUpSpeedAt(safeTimeMs, resolved.stopPointMs, resolved.curve)
        : stopSpeedAt(safeTimeMs, resolved.stopPointMs, resolved.curve);
}

export function evaluateTapeStopDisplaySpeed(input: TapeStopEnvelopeInput | ResolvedTapeStopEnvelope, timeMs: number) {
    const resolved = isResolvedTapeStopEnvelope(input) ? input : resolveTapeStopEnvelope(input);
    const safeTimeMs = clamp(timeMs, 0, resolved.blockDurationMs);

    if (resolved.catchupDurationMs > 0 && safeTimeMs >= resolved.catchupStartMs) {
        const releaseTime = safeTimeMs - resolved.catchupStartMs;
        const normalizedReleaseTime = releaseTime / resolved.catchupDurationMs;

        return catchupBaseSpeed(resolved.mode, normalizedReleaseTime, resolved.catchupCurve);
    }

    return resolved.mode === TAPE_STOP_MODE_SPIN_UP
        ? spinUpSpeedAt(safeTimeMs, resolved.stopPointMs, resolved.curve)
        : stopSpeedAt(safeTimeMs, resolved.stopPointMs, resolved.curve);
}

export function sampleTapeStopEnvelope(
    input: TapeStopEnvelopeInput | ResolvedTapeStopEnvelope,
    sampleCount = 96,
): TapeStopEnvelopeSample[] {
    const resolved = isResolvedTapeStopEnvelope(input) ? input : resolveTapeStopEnvelope(input);
    const count = Math.max(2, Math.trunc(sampleCount));

    return Array.from({ length: count }, (_unused, index) => {
        const normalizedTime = index / (count - 1);
        const timeMs = normalizedTime * resolved.blockDurationMs;

        return {
            timeMs,
            normalizedTime,
            speed: evaluateTapeStopSpeed(resolved, timeMs),
        };
    });
}

export function sampleTapeStopDisplayEnvelope(
    input: TapeStopEnvelopeInput | ResolvedTapeStopEnvelope,
    sampleCount = 96,
): TapeStopEnvelopeSample[] {
    const resolved = isResolvedTapeStopEnvelope(input) ? input : resolveTapeStopEnvelope(input);
    const count = Math.max(2, Math.trunc(sampleCount));

    return Array.from({ length: count }, (_unused, index) => {
        const normalizedTime = index / (count - 1);
        const timeMs = normalizedTime * resolved.blockDurationMs;

        return {
            timeMs,
            normalizedTime,
            speed: evaluateTapeStopDisplaySpeed(resolved, timeMs),
        };
    });
}
