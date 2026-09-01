import type { PatchConnectionLike } from "../../../kit/ui/cmajor-react";
import { createStoredStateRuntimeMirror } from "../../../kit/ui/stored-state-runtime-mirror";
import {
    SPECTRAL_PARTIAL_STATE_KEY,
    buildPartialShapeUpload,
    createDefaultSpectralPartialState,
    parseStrictSpectralPartialStateV1,
} from "../view/spectral-partial-state";

export function createSpectralWorkerService(connection: PatchConnectionLike) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: SPECTRAL_PARTIAL_STATE_KEY,
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: (value) => value == null
            ? createDefaultSpectralPartialState()
            : parseStrictSpectralPartialStateV1(value),
        buildRuntimeEvents: ({ state }) => [
            {
                endpointID: "partialShapeUpload",
                value: buildPartialShapeUpload(state),
            },
        ],
    });
}
