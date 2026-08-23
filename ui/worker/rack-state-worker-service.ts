import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    LANE_STATE_KEY,
    buildLaneRuntimeEvents,
    deserializeLaneState,
} from "../shared/lane-state";
import { RUNTIME_DSP_SESSION_DEPENDENCY } from "../shared/runtime-dsp-session";
import { createStoredStateRuntimeMirror } from "../shared/stored-state-runtime-mirror";

/** Restore the canonical lane document (structure AND params) even when no editor view is open. */
export function createRackStateWorkerService(connection: PatchConnectionLike) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: LANE_STATE_KEY,
        runtimeEndpointDependencies: [RUNTIME_DSP_SESSION_DEPENDENCY],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeLaneState,
        buildRuntimeEvents: ({ state }) => [...buildLaneRuntimeEvents(state)],
    });
}
