import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    MODULATION_STATE_KEY,
    buildModulationRuntimeEvents,
    deserializeModulationState,
} from "../shared/modulation";
import { RUNTIME_DSP_SESSION_DEPENDENCY } from "../shared/runtime-dsp-session";
import { createStoredStateRuntimeMirror } from "../shared/stored-state-runtime-mirror";

export function createModulationWorkerService(connection: PatchConnectionLike) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: MODULATION_STATE_KEY,
        runtimeEndpointDependencies: [RUNTIME_DSP_SESSION_DEPENDENCY],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeModulationState,
        buildRuntimeEvents: ({ state }) => buildModulationRuntimeEvents(state),
    });
}
