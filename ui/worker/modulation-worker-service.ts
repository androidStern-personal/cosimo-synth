import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    MODULATION_STATE_KEY,
    buildModulationRuntimeEvents,
    createDefaultModulationState,
    parseModulationState,
} from "../shared/modulation";
import {
    RUNTIME_STATE_ENDPOINT_ID,
    getRuntimeDspSessionId,
} from "../shared/runtime-dsp-session";
import {
    RuntimeInstallLane,
    type RuntimeInstallOutcome,
} from "../shared/runtime-install-channel";
import { createStoredStateRuntimeMirror } from "../shared/stored-state-runtime-mirror";

const runtimeRecoveryDelayMilliseconds = 1_000;

/** Creates the sole acknowledged publisher for the modulation runtime lane. */
export function createModulationWorkerService(connection: PatchConnectionLike) {
    const installLane = new RuntimeInstallLane(connection, { laneKind: "modulation" });
    let started = false;
    let dspSessionId: number | null = null;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRejectedReplayToken: string | null = null;

    const mirror = createStoredStateRuntimeMirror(connection, {
        stateKey: MODULATION_STATE_KEY,
        applyDefaultRuntimeStateWhenMissing: true,
        runtimeEndpointDependencies: [{
            endpointID: RUNTIME_STATE_ENDPOINT_ID,
            required: true,
            mapValue: getRuntimeDspSessionId,
        }],
        deserializeStoredState: (value) => {
            if (value === undefined) {
                return createDefaultModulationState();
            }
            const parsedState = parseModulationState(value);
            return parsedState._tag === "ok" ? parsedState.value : null;
        },
        buildRuntimeEvents: ({ state }, previousAppliedSnapshot) => buildModulationRuntimeEvents(
            state,
            previousAppliedSnapshot?.state ?? null,
        ),
        sendRuntimeEvents: async (events, desiredSnapshot) => handleInstallOutcome(
            await installLane.sendBatch(events),
            desiredSnapshot,
        ),
    });

    function clearRecoveryTimer() {
        if (recoveryTimer === null) {
            return;
        }
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
    }

    function scheduleRecovery() {
        if (!started || recoveryTimer !== null) {
            return;
        }
        recoveryTimer = setTimeout(() => {
            recoveryTimer = null;
            if (started) {
                mirror.replayFullRuntimeState();
            }
        }, runtimeRecoveryDelayMilliseconds);
    }

    function handleInstallOutcome(outcome: RuntimeInstallOutcome, rejectedSnapshot: unknown) {
        switch (outcome._tag) {
            case "accepted":
                clearRecoveryTimer();
                lastRejectedReplayToken = null;
                return true;
            case "superseded":
            case "stopped":
                return false;
            case "transport-timeout":
                console.error("[modulation-worker] Runtime acknowledgement timed out; retry is scheduled.", {
                    dspSessionId,
                });
                scheduleRecovery();
                return false;
            case "rejected":
                const rejectedReplayToken = JSON.stringify(rejectedSnapshot) ?? String(rejectedSnapshot);
                const fullReplayScheduled = rejectedReplayToken !== lastRejectedReplayToken;
                console.error("[modulation-worker] DSP rejected the acknowledged runtime batch.", {
                    dspSessionId,
                    rejectedSerial: outcome.acknowledgement.rejectedSerial,
                    rejectionReason: outcome.acknowledgement.rejectionReason,
                    fullReplayScheduled,
                });
                if (fullReplayScheduled) {
                    lastRejectedReplayToken = rejectedReplayToken;
                    scheduleRecovery();
                }
                return false;
            case "unavailable":
                if (started) {
                    console.error("[modulation-worker] Runtime install lane was unavailable; retry is scheduled.", {
                        dspSessionId,
                        reason: outcome.reason,
                    });
                    scheduleRecovery();
                }
                return false;
        }
    }

    const handleRuntimeState = (value: unknown) => {
        const nextDspSessionId = getRuntimeDspSessionId(value);
        installLane.observeRuntime(nextDspSessionId);
        if (dspSessionId === null) {
            dspSessionId = nextDspSessionId;
            return;
        }
        if (nextDspSessionId === dspSessionId) {
            return;
        }

        dspSessionId = nextDspSessionId;
        clearRecoveryTimer();
        lastRejectedReplayToken = null;
    };

    return {
        start() {
            if (started) {
                return;
            }
            started = true;
            installLane.start();
            connection.addEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, handleRuntimeState);
            mirror.start();
        },
        stop() {
            if (!started) {
                return;
            }
            started = false;
            clearRecoveryTimer();
            lastRejectedReplayToken = null;
            mirror.stop();
            connection.removeEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, handleRuntimeState);
            installLane.stop();
        },
    };
}
