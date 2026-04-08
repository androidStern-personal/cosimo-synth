import { clamp01, type MsegPlayback } from "./mseg";

export const EFFECTIVE_MSEG_STATE_ENDPOINT_ID = "effectiveMsegState";
const EFFECTIVE_MSEG_SLOT_COUNT = 3;
const FULL_SPAN_LOOP_EPSILON = 0.000001;

export type EffectiveMsegState = {
    voiceGeneration: number;
    hasActive: boolean;
    positions: [number, number, number];
};

export type MsegPreviewPlayheadState = {
    voiceGeneration: number;
    hasActive: boolean;
    progress: number | null;
    progressFillEnd: number | null;
};

function clampSlotIndex(slotIndex: unknown) {
    return Math.min(
        Math.max(Math.trunc(Number(slotIndex) || 0), 0),
        EFFECTIVE_MSEG_SLOT_COUNT - 1,
    );
}

function coercePositions(value: unknown): [number, number, number] | null {
    if (!Array.isArray(value) || value.length < EFFECTIVE_MSEG_SLOT_COUNT) {
        return null;
    }

    return [
        clamp01(value[0]),
        clamp01(value[1]),
        clamp01(value[2]),
    ];
}

export function normalizeEffectiveMsegStateMessage(message: unknown): EffectiveMsegState | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;

    if (!payload || typeof payload !== "object") {
        return null;
    }

    const positions = coercePositions((payload as { positions?: unknown }).positions);
    if (!positions) {
        return null;
    }

    const rawGeneration = Number((payload as { voiceGeneration?: unknown }).voiceGeneration);
    return {
        voiceGeneration: Number.isFinite(rawGeneration)
            ? Math.max(0, Math.trunc(rawGeneration))
            : 0,
        hasActive: Boolean((payload as { hasActive?: unknown }).hasActive),
        positions,
    };
}

export function selectObservedEffectiveMsegState(
    currentState: EffectiveMsegState | null | undefined,
    message: unknown,
) {
    const previousState = currentState && typeof currentState === "object"
        ? {
            voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration))
                ? Math.trunc(Number(currentState.voiceGeneration))
                : -1,
            hasActive: Boolean(currentState.hasActive),
            positions: coercePositions(currentState.positions) ?? [0, 0, 0] as [number, number, number],
        }
        : {
            voiceGeneration: -1,
            hasActive: false,
            positions: [0, 0, 0] as [number, number, number],
        };
    const nextState = normalizeEffectiveMsegStateMessage(message);

    if (!nextState) {
        return previousState;
    }

    if (nextState.voiceGeneration < previousState.voiceGeneration) {
        return previousState;
    }

    return nextState;
}

function hasFullSpanLoop(playback: MsegPlayback | null | undefined) {
    const loop = playback?.loop;

    if (!loop) {
        return false;
    }

    return loop.startX <= FULL_SPAN_LOOP_EPSILON
        && loop.endX >= (1.0 - FULL_SPAN_LOOP_EPSILON);
}

export function resolveMsegPreviewPlayheadState({
    observedState,
    playback,
    slotIndex,
}: {
    observedState: EffectiveMsegState | null | undefined;
    playback: MsegPlayback | null | undefined;
    slotIndex: number;
}): MsegPreviewPlayheadState {
    const clampedSlotIndex = clampSlotIndex(slotIndex);
    const voiceGeneration = Number.isFinite(Number(observedState?.voiceGeneration))
        ? Math.trunc(Number(observedState?.voiceGeneration))
        : -1;

    if (!observedState?.hasActive) {
        return {
            voiceGeneration,
            hasActive: false,
            progress: null,
            progressFillEnd: null,
        };
    }

    const progress = clamp01(observedState.positions[clampedSlotIndex]);
    const shouldFillProgress = playback
        ? (!playback.loop || hasFullSpanLoop(playback))
        : false;

    return {
        voiceGeneration,
        hasActive: true,
        progress,
        progressFillEnd: shouldFillProgress ? progress : null,
    };
}
