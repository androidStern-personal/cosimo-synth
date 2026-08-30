export const TAPE_STOP_RETURN_CROSSFADE_TO_LIVE = 0;
export const TAPE_STOP_RETURN_SPIN_UP = 1;
export const TAPE_STOP_V2_SPEED_FLOOR = 0.005;
export const TAPE_STOP_V2_HANDOFF_MS = 10;

export type TapeStopV2TrajectoryInput = {
    curve: number;
    returnMode: number;
    startDurationMs: number;
    stopDurationMs: number;
};

export type ResolvedTapeStopV2Trajectory = {
    curvePower: number;
    handoffDurationMs: number;
    returnMode: number;
    startDurationMs: number;
    startFadeDurationMs: number;
    stopDurationMs: number;
    stopEndNormalized: number;
    totalDurationMs: number;
};

export type TapeStopV2TrajectoryPoint = {
    liveBlend: number;
    motorSpeed: number;
    normalizedTime: number;
    timeMs: number;
};

function clamp(value: number, minimum: number, maximum: number) {
    const finiteValue = Number.isFinite(value) ? value : minimum;
    return Math.min(maximum, Math.max(minimum, finiteValue));
}

function smoothStep(value: number) {
    const clamped = clamp(value, 0, 1);
    return clamped * clamped * (3 - (2 * clamped));
}

function boundedTransitionMs(durationMs: number) {
    return Math.min(durationMs / 2, TAPE_STOP_V2_HANDOFF_MS);
}

function positiveDurationMs(value: number) {
    const durationMs = Number(value);
    return Number.isFinite(durationMs) && durationMs >= 1 ? durationMs : 1;
}

export function resolveTapeStopV2Trajectory(
    input: TapeStopV2TrajectoryInput,
): ResolvedTapeStopV2Trajectory {
    const stopDurationMs = positiveDurationMs(input.stopDurationMs);
    const startDurationMs = positiveDurationMs(input.startDurationMs);
    const returnMode = Math.round(Number(input.returnMode)) === TAPE_STOP_RETURN_SPIN_UP
        ? TAPE_STOP_RETURN_SPIN_UP
        : TAPE_STOP_RETURN_CROSSFADE_TO_LIVE;
    const returnDurationMs = returnMode === TAPE_STOP_RETURN_SPIN_UP
        ? startDurationMs
        : TAPE_STOP_V2_HANDOFF_MS;
    const totalDurationMs = stopDurationMs + returnDurationMs;
    const transitionDurationMs = returnMode === TAPE_STOP_RETURN_SPIN_UP
        ? boundedTransitionMs(returnDurationMs)
        : returnDurationMs;

    return {
        curvePower: Math.pow(4, clamp(Number(input.curve), -1, 1)),
        handoffDurationMs: transitionDurationMs,
        returnMode,
        startDurationMs,
        startFadeDurationMs: transitionDurationMs,
        stopDurationMs,
        stopEndNormalized: stopDurationMs / totalDurationMs,
        totalDurationMs,
    };
}

export function evaluateTapeStopV2Trajectory(
    trajectory: ResolvedTapeStopV2Trajectory,
    timeMs: number,
): TapeStopV2TrajectoryPoint {
    const safeTimeMs = clamp(Number(timeMs), 0, trajectory.totalDurationMs);

    if (safeTimeMs < trajectory.stopDurationMs) {
        const progress = safeTimeMs / trajectory.stopDurationMs;
        return {
            liveBlend: 0,
            motorSpeed: TAPE_STOP_V2_SPEED_FLOOR
                + ((1 - TAPE_STOP_V2_SPEED_FLOOR)
                    * Math.pow(Math.max(0, 1 - progress), trajectory.curvePower)),
            normalizedTime: safeTimeMs / trajectory.totalDurationMs,
            timeMs: safeTimeMs,
        };
    }

    const returnAgeMs = safeTimeMs - trajectory.stopDurationMs;

    if (trajectory.returnMode === TAPE_STOP_RETURN_CROSSFADE_TO_LIVE) {
        return {
            liveBlend: smoothStep(returnAgeMs / trajectory.handoffDurationMs),
            motorSpeed: TAPE_STOP_V2_SPEED_FLOOR,
            normalizedTime: safeTimeMs / trajectory.totalDurationMs,
            timeMs: safeTimeMs,
        };
    }

    const motorProgress = clamp(returnAgeMs / trajectory.startDurationMs, 0, 1);
    const handoffStartMs = trajectory.startDurationMs - trajectory.handoffDurationMs;
    const liveBlend = smoothStep(
        (returnAgeMs - handoffStartMs) / trajectory.handoffDurationMs,
    );

    return {
        liveBlend,
        motorSpeed: TAPE_STOP_V2_SPEED_FLOOR
            + ((1 - TAPE_STOP_V2_SPEED_FLOOR)
                * Math.pow(motorProgress, trajectory.curvePower)),
        normalizedTime: safeTimeMs / trajectory.totalDurationMs,
        timeMs: safeTimeMs,
    };
}

export function sampleTapeStopV2Trajectory(
    input: TapeStopV2TrajectoryInput | ResolvedTapeStopV2Trajectory,
    sampleCount = 97,
) {
    const trajectory = "totalDurationMs" in input
        ? input
        : resolveTapeStopV2Trajectory(input);
    const count = Math.max(2, Math.trunc(sampleCount));

    return Array.from({ length: count }, (_unused, index) => (
        evaluateTapeStopV2Trajectory(
            trajectory,
            (index / (count - 1)) * trajectory.totalDurationMs,
        )
    ));
}
