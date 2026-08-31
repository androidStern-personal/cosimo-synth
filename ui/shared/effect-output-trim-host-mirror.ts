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

type PendingOutputTrimHostWrite = {
    readonly generation: number;
    readonly expectedValue: number;
};

function hostValuesMatch(left: number, right: number): boolean {
    // Every resident trim endpoint is Cmajor float32. Compare in that actual
    // transport domain so a normal decimal UI value can acknowledge after
    // host quantization without broadening the stale-echo window.
    return Math.fround(left) === Math.fround(right);
}

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
    readonly #pendingWrites = new Map<string, PendingOutputTrimHostWrite>();
    #captureGeneration = 0;

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
                const pending = this.#pendingWrites.get(endpointID);
                if (pending !== undefined) {
                    if (!hostValuesMatch(value, pending.expectedValue)) {
                        return;
                    }
                    if (this.#pendingWrites.get(endpointID)?.generation !== pending.generation) {
                        return;
                    }
                    this.#pendingWrites.delete(endpointID);
                }
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
        this.#captureGeneration += 1;
        const generation = this.#captureGeneration;

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
            const hostEndpointID = effectOutputTrimHostEndpointID(
                parsed.deviceType,
                parsed.instanceNumber,
            );
            const value = effectOutputTrimEffectiveDb(rawValue, 0);
            const pending = this.#pendingWrites.get(hostEndpointID);
            const observed = this.#values[hostEndpointID];
            this.#values[hostEndpointID] = value;

            // A repeated capture keeps the endpoint pending until one echo of
            // the latest intentional value arrives. Otherwise an optimistic
            // cache write could make a second generation look acknowledged
            // before the host has acknowledged either write.
            if (pending !== undefined
                    || observed === undefined
                    || !hostValuesMatch(observed, value)) {
                this.#pendingWrites.set(hostEndpointID, {
                    generation,
                    expectedValue: value,
                });
            }
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
        this.#pendingWrites.clear();
    }
}
