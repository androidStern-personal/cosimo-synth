import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { createStoredStateRuntimeMirror } from "../../../ui/shared/stored-state-runtime-mirror";
import {
    SEQFX_STATE_UPDATE_INTENT_KEY,
    parseSeqFxStateUpdateIntent,
    seqFxStoredStateToken,
} from "../seqfx-state-update-intent";
import {
    SEQFX_PATTERN_COUNT,
    SEQFX_LEGACY_STATE_KEY,
    SEQFX_STATE_KEY,
    SeqFxStateParseError,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    parseSeqFxStoredState,
} from "../view/seqfx-state";

const patternSelectEndpointID = "patternSelect";
const patternUploadEndpointID = "patternUpload";

function resolvePatternIndex(value: unknown) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.min(SEQFX_PATTERN_COUNT - 1, Math.max(0, Math.round(numeric)));
}

function deserializeSeqFxWorkerState(value: unknown) {
    if (value == null) {
        return createDefaultSeqFxState();
    }

    try {
        return parseSeqFxStoredState(value).state;
    } catch (error) {
        if (error instanceof SeqFxStateParseError) {
            return null;
        }
        throw error;
    }
}

export function createSeqFxWorkerService(connection: PatchConnectionLike) {
    // Cmajor's stored-state notification does not identify its source. Only a
    // matching transient bridge intent may classify an update as sparse; once
    // runtime state exists, every absent or mismatched intent fails closed to
    // an authoritative host replacement.
    let pendingIntent: ReturnType<typeof parseSeqFxStateUpdateIntent> = null;
    let pendingStoredStateAuthoritative: boolean | null = null;
    let started = false;

    const handleStoredStateIntent = (message: unknown) => {
        if (message === null || typeof message !== "object" || Array.isArray(message)) {
            return;
        }

        const record = message as Record<string, unknown>;
        if (record["key"] !== SEQFX_STATE_UPDATE_INTENT_KEY) {
            return;
        }

        pendingIntent = parseSeqFxStateUpdateIntent(record["value"]);
    };

    const consumeStoredStateAuthority = (hasPreviousSnapshot: boolean) => {
        const authoritative = hasPreviousSnapshot
            && (pendingStoredStateAuthoritative ?? false);
        pendingStoredStateAuthoritative = null;
        return authoritative;
    };

    const mirror = createStoredStateRuntimeMirror(connection, {
        stateKey: SEQFX_STATE_KEY,
        fallbackStateKeys: [SEQFX_LEGACY_STATE_KEY],
        parameterEndpointIDs: [patternSelectEndpointID],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: (value) => {
            const state = deserializeSeqFxWorkerState(value);
            pendingStoredStateAuthoritative = pendingIntent?.stateToken === seqFxStoredStateToken(value)
                ? pendingIntent.authoritative
                : true;
            pendingIntent = null;
            if (state === null) {
                pendingStoredStateAuthoritative = null;
            }
            return state;
        },
        buildRuntimeEvents: ({ state, parameters }, previousAppliedSnapshot) => [
            {
                endpointID: patternUploadEndpointID,
                value: buildSeqPatternUpload(state, {
                    patternIndex: resolvePatternIndex(parameters[patternSelectEndpointID]),
                    authoritative: consumeStoredStateAuthority(previousAppliedSnapshot !== null),
                }),
            },
        ],
    });

    return {
        start() {
            if (started) {
                return;
            }

            started = true;
            connection.addStoredStateValueListener?.(handleStoredStateIntent);
            try {
                mirror.start();
            } catch (error) {
                connection.removeStoredStateValueListener?.(handleStoredStateIntent);
                started = false;
                throw error;
            }
        },
        stop() {
            if (!started) {
                return;
            }

            mirror.stop();
            connection.removeStoredStateValueListener?.(handleStoredStateIntent);
            pendingIntent = null;
            pendingStoredStateAuthoritative = null;
            started = false;
        },
        replayFullRuntimeState() {
            mirror.replayFullRuntimeState();
        },
    };
}
