import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    MODULATION_STATE_KEY,
    buildModulationRuntimeEvents,
    deserializeModulationState,
} from "../shared/modulation";
import { createStoredStateRuntimeMirror } from "../shared/stored-state-runtime-mirror";

const runtimeStateEndpointID = "runtimeState";

function getRuntimeDspSessionId(value: unknown) {
    if (!value || typeof value !== "object") {
        return 0;
    }

    return Math.trunc(Number((value as { dspSessionId?: unknown }).dspSessionId) || 0);
}

export function createModulationWorkerService(connection: PatchConnectionLike) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: MODULATION_STATE_KEY,
        runtimeEndpointDependencies: [{
            endpointID: runtimeStateEndpointID,
            required: true,
            mapValue: getRuntimeDspSessionId,
        }],
        applyDefaultRuntimeStateWhenMissing: true,
        deserializeStoredState: deserializeModulationState,
        buildRuntimeEvents: ({ state }) => buildModulationRuntimeEvents(state),
    });
}
