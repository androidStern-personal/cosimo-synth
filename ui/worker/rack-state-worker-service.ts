import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    RACK_STATE_KEY,
    buildRackRuntimeEvents,
    deserializeRackState,
} from "../shared/rack-state";
import { RUNTIME_DSP_SESSION_DEPENDENCY } from "../shared/runtime-dsp-session";
import { createStoredStateRuntimeMirror } from "../shared/stored-state-runtime-mirror";

/** Restore canonical rack order/enabled state even when no editor view is open. */
export function createRackStateWorkerService(connection: PatchConnectionLike) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: RACK_STATE_KEY,
        runtimeEndpointDependencies: [RUNTIME_DSP_SESSION_DEPENDENCY],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeRackState,
        buildRuntimeEvents: ({ state }) => [...buildRackRuntimeEvents(state)],
    });
}
