import type { PatchConnectionLike } from "../../shared/cmajor-react";

type EndpointDescription = {
    readonly endpointID: string;
    readonly endpointType: "event" | "value" | "stream";
    readonly purpose?: string;
};

type OutputEvent = {
    readonly event?: unknown;
};

export type OfflinePerformer = {
    initialise(sessionID: number, sampleRate: number): Promise<void> | void;
    advance(frameCount: number): void;
    getInputEndpoints(): ReadonlyArray<EndpointDescription>;
    getOutputEndpoints(): ReadonlyArray<EndpointDescription>;
    getOutputFrames_audioOut(channels: [Float32Array, Float32Array], frameCount: number, frameOffset: number): void;
    [method: string]: unknown;
};

export type OfflinePerformerClass = new () => OfflinePerformer;

export type OfflineEngineStoredState = {
    readonly modulation: unknown;
    readonly lane: unknown;
    readonly articulations: unknown;
};

const DIAGNOSTIC_ENDPOINTS = new Set([
    "runtimeState",
    "runtimeInstallAck",
    "effectiveRackState",
]);

function endpointMethod<TArguments extends unknown[], TResult>(
    performer: OfflinePerformer,
    prefix: string,
    endpointID: string,
): (...args: TArguments) => TResult {
    const methodName = `${prefix}_${endpointID}`;
    const method = performer[methodName];
    if (typeof method !== "function") {
        throw new Error(`Offline performer is missing ${methodName}().`);
    }
    return (method as (...args: TArguments) => TResult).bind(performer);
}

function eventPayload(value: unknown) {
    return value && typeof value === "object" && "event" in value
        ? (value as OutputEvent).event
        : value;
}

function cloneStoredState(state: OfflineEngineStoredState) {
    return {
        values: {
            "modulation.v6": state.modulation,
            "lane.v1": state.lane,
            "articulations.v4": state.articulations,
        },
    };
}

/**
 * PatchConnectionLike over a generated class-only performer.
 *
 * Runtime services use their production connection contract while `pump()`
 * advances the engine in the same <=128-frame slices as Bounce.
 */
export class OfflineEngineHost implements PatchConnectionLike {
    readonly performer: OfflinePerformer;
    readonly #inputEndpoints: ReadonlyMap<string, EndpointDescription>;
    readonly #outputEndpoints: ReadonlyMap<string, EndpointDescription>;
    readonly #endpointListeners = new Map<string, Set<(value: unknown) => void>>();
    readonly #parameterListeners = new Map<string, Set<(value: unknown) => void>>();
    readonly #parameterValues = new Map<string, number>();
    readonly #runtimeStates = new Map<number, Record<string, unknown>>();
    readonly #inputEventCounts = new Map<string, number>();
    readonly #outputEventCounts = new Map<string, number>();
    readonly #storedState: OfflineEngineStoredState;
    readonly #resourceBaseURL: URL;
    #latestRuntimeInstallAck: Record<string, unknown> | null = null;
    #latestEffectiveRackState: Record<string, unknown> | null = null;
    #articulationTriggerConfig: string | null = null;
    #advancedFrames = 0;

    constructor(
        PerformerClass: OfflinePerformerClass,
        storedState: OfflineEngineStoredState,
        resourceBaseURL: string | URL,
    ) {
        this.performer = new PerformerClass();
        this.#storedState = storedState;
        this.#resourceBaseURL = new URL("./", resourceBaseURL);
        this.#inputEndpoints = new Map(
            this.performer.getInputEndpoints().map((endpoint) => [endpoint.endpointID, endpoint]),
        );
        this.#outputEndpoints = new Map(
            this.performer.getOutputEndpoints().map((endpoint) => [endpoint.endpointID, endpoint]),
        );
    }

    async initialise(sessionID: number, sampleRate: number) {
        await this.performer.initialise(sessionID, sampleRate);
    }

    setInitialParameters(parameters: Readonly<Record<string, number>>) {
        for (const [endpointID, value] of Object.entries(parameters)) {
            this.writeValue(endpointID, value);
        }
    }

    sendEventOrValue(endpointID: string, value: unknown) {
        const endpoint = this.#inputEndpoints.get(endpointID);
        if (!endpoint) throw new Error(`Offline performer has no input endpoint ${endpointID}.`);
        if (endpoint.endpointType === "event") {
            endpointMethod<[unknown], void>(this.performer, "sendInputEvent", endpointID)(value);
            this.#inputEventCounts.set(endpointID, (this.#inputEventCounts.get(endpointID) ?? 0) + 1);
            return;
        }
        if (endpoint.endpointType === "value") {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error(`Offline value endpoint ${endpointID} requires a finite number.`);
            }
            this.writeValue(endpointID, value);
            return;
        }
        throw new Error(`Offline input ${endpointID} has unsupported type ${endpoint.endpointType}.`);
    }

    sendMIDIInputEvent(endpointID: string, shortMIDICode: number) {
        this.sendEventOrValue(endpointID, { message: shortMIDICode });
    }

    addEndpointListener(endpointID: string, listener: (value: unknown) => void) {
        const listeners = this.#endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.#endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID: string, listener: (value: unknown) => void) {
        this.#endpointListeners.get(endpointID)?.delete(listener);
    }

    addParameterListener(endpointID: string, listener: (value: unknown) => void) {
        const listeners = this.#parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.#parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID: string, listener: (value: unknown) => void) {
        this.#parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID: string) {
        const value = this.#parameterValues.get(endpointID);
        if (value === undefined) return;
        for (const listener of this.#parameterListeners.get(endpointID) ?? []) listener(value);
    }

    requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
        callback(cloneStoredState(this.#storedState));
    }

    getResourceAddress(path: string) {
        return new URL(path, this.#resourceBaseURL);
    }

    sendNativeArticulationTriggerConfig(serializedConfig: string) {
        this.#articulationTriggerConfig = serializedConfig;
    }

    getInstallationState() {
        return {
            runtimeStates: new Map(this.#runtimeStates),
            runtimeInstallAck: this.#latestRuntimeInstallAck,
            effectiveRackState: this.#latestEffectiveRackState,
            articulationTriggerConfig: this.#articulationTriggerConfig,
            inputEventCounts: new Map(this.#inputEventCounts),
            outputEventCounts: new Map(this.#outputEventCounts),
            advancedFrames: this.#advancedFrames,
        };
    }

    async pump(frameCount: number) {
        let remaining = frameCount;
        while (remaining > 0) {
            const count = Math.min(128, remaining);
            this.advance(count);
            remaining -= count;
            await Promise.resolve();
        }
    }

    render(frameCount: number, destination: Float32Array, destinationFrameOffset: number) {
        const left = new Float32Array(frameCount);
        const right = new Float32Array(frameCount);
        this.advance(frameCount);
        this.performer.getOutputFrames_audioOut([left, right], frameCount, 0);
        for (let frame = 0; frame < frameCount; frame += 1) {
            const target = (destinationFrameOffset + frame) * 2;
            destination[target] = left[frame];
            destination[target + 1] = right[frame];
        }
    }

    private writeValue(endpointID: string, value: number) {
        const endpoint = this.#inputEndpoints.get(endpointID);
        if (!endpoint || endpoint.endpointType !== "value") {
            throw new Error(`Offline performer has no value endpoint ${endpointID}.`);
        }
        endpointMethod<[number, number], void>(
            this.performer,
            "setInputValue",
            endpointID,
        )(value, 0);
        this.#parameterValues.set(endpointID, value);
        for (const listener of this.#parameterListeners.get(endpointID) ?? []) listener(value);
    }

    private advance(frameCount: number) {
        if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 128) {
            throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
        }
        this.performer.advance(frameCount);
        this.#advancedFrames += frameCount;
        this.drainOutputEvents();
    }

    private drainOutputEvents() {
        const endpointIDs = new Set([
            ...DIAGNOSTIC_ENDPOINTS,
            ...this.#endpointListeners.keys(),
        ]);
        for (const endpointID of endpointIDs) {
            const endpoint = this.#outputEndpoints.get(endpointID);
            if (!endpoint || endpoint.endpointType !== "event") continue;
            const count = endpointMethod<[], number>(
                this.performer,
                "getOutputEventCount",
                endpointID,
            )();
            if (count < 1) continue;
            const read = endpointMethod<[number], unknown>(
                this.performer,
                "getOutputEvent",
                endpointID,
            );
            const values = Array.from({ length: count }, (_, index) => eventPayload(read(index)));
            // Clear the generated output FIFO before listeners can synchronously
            // send their next input command through the same performer.
            endpointMethod<[], void>(
                this.performer,
                "resetOutputEventCount",
                endpointID,
            )();
            for (const value of values) {
                this.#outputEventCounts.set(
                    endpointID,
                    (this.#outputEventCounts.get(endpointID) ?? 0) + 1,
                );
                this.recordDiagnostic(endpointID, value);
                for (const listener of this.#endpointListeners.get(endpointID) ?? []) listener(value);
            }
        }
    }

    private recordDiagnostic(endpointID: string, value: unknown) {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (endpointID === "runtimeState") {
            const oscillatorIndex = Math.trunc(Number(record.oscillatorIndex));
            if (oscillatorIndex >= 0 && oscillatorIndex < 3) {
                this.#runtimeStates.set(oscillatorIndex, record);
            }
        } else if (endpointID === "runtimeInstallAck") {
            this.#latestRuntimeInstallAck = record;
        } else if (endpointID === "effectiveRackState") {
            this.#latestEffectiveRackState = record;
        }
    }
}
