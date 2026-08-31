import type { PatchConnectionLike } from "./cmajor-react";
import {
    allEffectOutputTrimHostEndpointIDs,
    effectOutputTrimEffectiveDb,
    effectOutputTrimHostEndpointID,
    effectOutputTrimLaneEndpointID,
} from "./effect-output-trim";
import {
    listLaneDeviceInstancesV2,
    parseLaneInstanceId,
    synchronizeLaneOutputTrimsFromHostParameters,
    type LaneStateV2,
} from "./lane-state-v2";

type OutputTrimHostConnection = Pick<
    PatchConnectionLike,
    "addParameterListener" | "removeParameterListener" | "requestParameterValue"
>;

/**
 * One connection-lifetime bridge between T78's real host parameters and the
 * lane document's durable mirrors.
 *
 * The host parameter is runtime/automation authority. Capturing a newly
 * committed lane document first lets replacement's 0 dB reset win over any
 * delayed stored-state echo carrying the former instance value.
 */
export class EffectOutputTrimHostMirror {
    readonly #connection: OutputTrimHostConnection;
    readonly #onValue: (endpointID: string, value: number) => void;
    readonly #values: Record<string, number> = {};
    readonly #listeners = new Map<string, (value: unknown) => void>();

    constructor(
        connection: OutputTrimHostConnection,
        onValue: (endpointID: string, value: number) => void,
    ) {
        this.#connection = connection;
        this.#onValue = onValue;

        for (const endpointID of allEffectOutputTrimHostEndpointIDs()) {
            const listener = (rawValue: unknown) => {
                if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
                    return;
                }
                const value = effectOutputTrimEffectiveDb(rawValue, 0);
                this.#values[endpointID] = value;
                this.#onValue(endpointID, value);
            };
            this.#listeners.set(endpointID, listener);
            this.#connection.addParameterListener?.(endpointID, listener);
            this.#connection.requestParameterValue?.(endpointID);
        }
    }

    /** Seed host authority from an intentional lane commit (including reset). */
    captureLaneState(state: LaneStateV2): void {
        for (const device of listLaneDeviceInstancesV2(state)) {
            const parsed = parseLaneInstanceId(device.instanceId);
            if (parsed === null) {
                continue;
            }
            const laneEndpointID = effectOutputTrimLaneEndpointID(parsed.deviceType);
            const rawValue = state.devices[device.instanceId]?.params[laneEndpointID];
            if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
                continue;
            }
            this.#values[effectOutputTrimHostEndpointID(
                parsed.deviceType,
                parsed.instanceNumber,
            )] = effectOutputTrimEffectiveDb(rawValue, 0);
        }
    }

    /** Reconcile a hydrated/stored lane document against observed host values. */
    synchronizeLaneState(state: LaneStateV2): LaneStateV2 {
        return synchronizeLaneOutputTrimsFromHostParameters(state, this.#values);
    }

    /** Optional teardown for connection implementations with shorter lifetimes. */
    dispose(): void {
        for (const [endpointID, listener] of this.#listeners) {
            this.#connection.removeParameterListener?.(endpointID, listener);
        }
        this.#listeners.clear();
    }
}
