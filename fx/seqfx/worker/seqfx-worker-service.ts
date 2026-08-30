import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { createStoredStateRuntimeMirror } from "../../../ui/shared/stored-state-runtime-mirror";
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
    return createStoredStateRuntimeMirror(connection, {
        stateKey: SEQFX_STATE_KEY,
        fallbackStateKeys: [SEQFX_LEGACY_STATE_KEY],
        parameterEndpointIDs: [patternSelectEndpointID],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeSeqFxWorkerState,
        buildRuntimeEvents: ({ state, parameters }) => [
            {
                endpointID: patternUploadEndpointID,
                value: buildSeqPatternUpload(state, {
                    patternIndex: resolvePatternIndex(parameters[patternSelectEndpointID]),
                    authoritative: false,
                }),
            },
        ],
    });
}
