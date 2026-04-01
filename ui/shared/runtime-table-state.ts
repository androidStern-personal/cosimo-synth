const DISPLAY_POSITION_EPSILON = 0.000001;
const runtimeFailurePhaseLoadSource = 1;
const runtimeFailurePhaseBuildMip = 2;
const runtimeFailurePhaseTransferMip = 3;
const runtimeFailureReasonTimeout = 2;
const runtimeFailureScopeService = 1;

export type EffectiveWavetablePositionState = {
    voiceGeneration: number;
    position: number;
};

export type NormalizedRuntimeTableState = {
    desiredTableIndex: number;
    desiredIntentSerial: number;
    serviceState: number;
    hasActive: boolean;
    activeTableIndex: number;
    activeGeneration: number;
    hasLoading: boolean;
    loadingTableIndex: number;
    loadingGeneration: number;
    hasFailure: boolean;
    failedTableIndex: number;
    failedGeneration: number;
    failureScope: number;
    failurePhase: number;
    failureReasonCode: number;
};

export type RuntimeTablePresentation = {
    desiredTableIndex: number;
    presentedTableIndex: number;
    activeTableIndex: number | null;
    activeGeneration: number | null;
    loadingTableIndex: number | null;
    loadingGeneration: number | null;
    isPendingSelection: boolean;
    isRetryableFailure: boolean;
    failureMessage: string | null;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function clampDisplayPosition(value: unknown) {
    return clamp(Number(value) || 0, 0, 1);
}

export function displayPositionsMatch(left: unknown, right: unknown, epsilon = DISPLAY_POSITION_EPSILON) {
    return Math.abs(clampDisplayPosition(left) - clampDisplayPosition(right)) <= epsilon;
}

export function mapDisplayDragToPosition(
    startValue: unknown,
    startClientY: unknown,
    nextClientY: unknown,
    dragSpan: unknown,
) {
    const safeSpan = Math.max(1, Number(dragSpan) || 0);
    const delta = (Number(startClientY) || 0) - (Number(nextClientY) || 0);

    return clampDisplayPosition((Number(startValue) || 0) + (delta / safeSpan));
}

export function normalizeEffectiveWavetablePositionMessage(message: unknown): EffectiveWavetablePositionState | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;

    if (payload === null || payload === undefined) {
        return null;
    }

    if (typeof payload === "number") {
        return {
            voiceGeneration: 0,
            position: clampDisplayPosition(payload),
        };
    }

    const rawPosition = Number((payload as { position?: unknown }).position);
    if (!Number.isFinite(rawPosition)) {
        return null;
    }

    const rawGeneration = Number((payload as { voiceGeneration?: unknown }).voiceGeneration);
    return {
        voiceGeneration: Number.isFinite(rawGeneration)
            ? Math.max(0, Math.trunc(rawGeneration))
            : 0,
        position: clampDisplayPosition(rawPosition),
    };
}

export function selectObservedWavetablePositionState(
    currentState: EffectiveWavetablePositionState | null | undefined,
    message: unknown,
) {
    const previousState = currentState && typeof currentState === "object"
        ? {
            voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration))
                ? Math.trunc(Number(currentState.voiceGeneration))
                : -1,
            position: clampDisplayPosition(currentState.position),
        }
        : {
            voiceGeneration: -1,
            position: 0,
        };
    const nextState = normalizeEffectiveWavetablePositionMessage(message);

    if (!nextState) {
        return previousState;
    }

    if (nextState.voiceGeneration < previousState.voiceGeneration) {
        return previousState;
    }

    return nextState;
}

export function normalizeRuntimeTableState(message: unknown): NormalizedRuntimeTableState | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;

    if (!payload || typeof payload !== "object") {
        return null;
    }

    const value = payload as Record<string, unknown>;

    return {
        desiredTableIndex: Math.max(0, Math.trunc(Number(value.desiredTableIndex) || 0)),
        desiredIntentSerial: Math.max(0, Math.trunc(Number(value.desiredIntentSerial) || 0)),
        serviceState: Math.max(0, Math.trunc(Number(value.serviceState) || 0)),
        hasActive: Boolean(value.hasActive),
        activeTableIndex: Math.max(0, Math.trunc(Number(value.activeTableIndex) || 0)),
        activeGeneration: Math.max(0, Math.trunc(Number(value.activeGeneration) || 0)),
        hasLoading: Boolean(value.hasLoading),
        loadingTableIndex: Math.max(0, Math.trunc(Number(value.loadingTableIndex) || 0)),
        loadingGeneration: Math.max(0, Math.trunc(Number(value.loadingGeneration) || 0)),
        hasFailure: Boolean(value.hasFailure),
        failedTableIndex: Math.max(0, Math.trunc(Number(value.failedTableIndex) || 0)),
        failedGeneration: Math.max(0, Math.trunc(Number(value.failedGeneration) || 0)),
        failureScope: Math.max(0, Math.trunc(Number(value.failureScope) || 0)),
        failurePhase: Math.max(0, Math.trunc(Number(value.failurePhase) || 0)),
        failureReasonCode: Math.max(0, Math.trunc(Number(value.failureReasonCode) || 0)),
    };
}

export function describeRuntimeTableFailure(normalized: NormalizedRuntimeTableState | null) {
    if (!normalized?.hasFailure) {
        return null;
    }

    if (
        normalized.failurePhase === runtimeFailurePhaseTransferMip &&
        normalized.failureReasonCode === runtimeFailureReasonTimeout
    ) {
        return "Wavetable load timed out.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseLoadSource) {
        return "Could not read wavetable source.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseBuildMip) {
        return "Could not build wavetable mip data.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseTransferMip) {
        return "Could not transfer wavetable mip data.";
    }

    return "Wavetable load failed.";
}

export function describeRuntimeTableFailureDetails(
    normalized: NormalizedRuntimeTableState | null,
    tableName = "Requested wavetable",
) {
    if (!normalized?.hasFailure) {
        return null;
    }

    const phaseLabel = normalized.failurePhase === runtimeFailurePhaseLoadSource
        ? "source read"
        : normalized.failurePhase === runtimeFailurePhaseBuildMip
            ? "mip build"
            : normalized.failurePhase === runtimeFailurePhaseTransferMip
                ? "mip transfer"
                : "unknown phase";
    const scopeLabel = normalized.failureScope === runtimeFailureScopeService
        ? "committed load"
        : "candidate load";
    const generationLabel = normalized.failedGeneration > 0
        ? `generation ${normalized.failedGeneration}`
        : "candidate generation";
    const reasonLabel = normalized.failureReasonCode === runtimeFailureReasonTimeout
        ? "timeout"
        : "generic failure";

    return `${tableName} failed during ${phaseLabel} (${scopeLabel}, ${generationLabel}, ${reasonLabel}).`;
}

export function resolveRuntimeTablePresentation(message: unknown, fallbackTableIndex = 0): RuntimeTablePresentation {
    const normalized = normalizeRuntimeTableState(message);
    const safeFallbackTableIndex = Math.max(0, Math.trunc(Number(fallbackTableIndex) || 0));

    if (!normalized) {
        return {
            desiredTableIndex: safeFallbackTableIndex,
            presentedTableIndex: safeFallbackTableIndex,
            activeTableIndex: null,
            activeGeneration: null,
            loadingTableIndex: null,
            loadingGeneration: null,
            isPendingSelection: false,
            isRetryableFailure: false,
            failureMessage: null,
        };
    }

    const activeTableIndex = normalized.hasActive ? normalized.activeTableIndex : null;
    const activeGeneration = normalized.hasActive ? normalized.activeGeneration : null;
    const loadingTableIndex = normalized.hasLoading ? normalized.loadingTableIndex : null;
    const loadingGeneration = normalized.hasLoading ? normalized.loadingGeneration : null;
    const presentedTableIndex = activeTableIndex ?? loadingTableIndex ?? normalized.desiredTableIndex;

    return {
        desiredTableIndex: normalized.desiredTableIndex,
        presentedTableIndex,
        activeTableIndex,
        activeGeneration,
        loadingTableIndex,
        loadingGeneration,
        isPendingSelection: loadingTableIndex !== null || (
            activeTableIndex !== null && normalized.desiredTableIndex !== activeTableIndex
        ),
        isRetryableFailure: normalized.hasFailure && normalized.failedTableIndex === normalized.desiredTableIndex,
        failureMessage: describeRuntimeTableFailure(normalized),
    };
}
