import type { PatchConnectionLike } from "./cmajor-react";

export const RUNTIME_INSTALL_ACK_ENDPOINT_ID = "runtimeInstallAck";
export const RUNTIME_SYNC_REQUEST_ENDPOINT_ID = "runtimeSyncRequest";
export const RUNTIME_INSTALL_SEND_TIMEOUT_MS = 0;
export const RUNTIME_INSTALL_HEALTH_TIMEOUT_MS = 8_000;

export type RuntimeInstallLaneKind = "modulation" | "articulation";

export type RuntimeInstallCommand = {
    readonly endpointID: string;
    readonly value: unknown;
};

export type RuntimeInstallAck = {
    readonly dspSessionId: number;
    readonly acceptedModulationSerial: number;
    readonly acceptedArticulationSerial: number;
    readonly rejectedSerial: number;
    readonly rejectionReason: number;
    readonly syncSerial: number;
};

export type RuntimeInstallLaneOptions = {
    readonly laneKind: RuntimeInstallLaneKind;
    readonly probeDelaysMilliseconds?: readonly number[];
    readonly healthTimeoutMilliseconds?: number;
};

export type RuntimeInstallOutcome =
    | { readonly _tag: "accepted" }
    | { readonly _tag: "superseded" }
    | { readonly _tag: "stopped" }
    | {
        readonly _tag: "unavailable";
        readonly reason: "not-started" | "batch-in-progress" | "no-runtime-session";
    }
    | { readonly _tag: "transport-timeout" }
    | { readonly _tag: "rejected"; readonly acknowledgement: RuntimeInstallAck };

type StateWaiter = {
    finish: (changed: boolean) => void;
    timeoutHandle: ReturnType<typeof setTimeout> | null;
};

type RejectionRecord = {
    readonly acknowledgement: RuntimeInstallAck;
    readonly version: number;
};

const activeLaneKindsByConnection = new WeakMap<object, Set<RuntimeInstallLaneKind>>();

const baselineSyncRangeSize = 1_000_000_000;
let nextBaselineSyncSequence = (
    (Date.now() & 0x3fff_ffff)
    ^ Math.floor(Math.random() * 0x3fff_ffff)
) % baselineSyncRangeSize;

function createBaselineSyncSerial(laneKind: RuntimeInstallLaneKind) {
    nextBaselineSyncSequence = (nextBaselineSyncSequence % baselineSyncRangeSize) + 1;
    return laneKind === "modulation"
        ? -1_000_000_000 - nextBaselineSyncSequence
        : 1_000_000_000 + nextBaselineSyncSequence;
}

function acquireLaneOwnership(connection: PatchConnectionLike, laneKind: RuntimeInstallLaneKind) {
    const connectionKey = connection as object;
    const activeKinds = activeLaneKindsByConnection.get(connectionKey) ?? new Set<RuntimeInstallLaneKind>();
    if (activeKinds.has(laneKind)) {
        throw new Error(`A ${laneKind} runtime install lane is already active for this connection.`);
    }
    activeKinds.add(laneKind);
    activeLaneKindsByConnection.set(connectionKey, activeKinds);
}

function releaseLaneOwnership(connection: PatchConnectionLike, laneKind: RuntimeInstallLaneKind) {
    const connectionKey = connection as object;
    const activeKinds = activeLaneKindsByConnection.get(connectionKey);
    activeKinds?.delete(laneKind);
    if (activeKinds?.size === 0) {
        activeLaneKindsByConnection.delete(connectionKey);
    }
}

const defaultProbeDelaysMilliseconds = [100, 250, 500, 1_000] as const;
const acceptedOutcome: RuntimeInstallOutcome = { _tag: "accepted" };
const supersededOutcome: RuntimeInstallOutcome = { _tag: "superseded" };
const stoppedOutcome: RuntimeInstallOutcome = { _tag: "stopped" };
const transportTimeoutOutcome: RuntimeInstallOutcome = { _tag: "transport-timeout" };

function normalizeAck(value: unknown): RuntimeInstallAck | null {
    const eventValue = value && typeof value === "object" && "event" in value
        ? (value as { event?: unknown }).event
        : value;
    const payload = eventValue && typeof eventValue === "object" && "value" in eventValue
        ? (eventValue as { value?: unknown }).value
        : eventValue;
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const record = payload as Record<string, unknown>;
    const dspSessionId = record.dspSessionId;
    const acceptedModulationSerial = record.acceptedModulationSerial;
    const acceptedArticulationSerial = record.acceptedArticulationSerial;
    const rejectedSerial = record.rejectedSerial;
    const rejectionReason = record.rejectionReason;
    const syncSerial = record.syncSerial;
    const fields = [
        dspSessionId,
        acceptedModulationSerial,
        acceptedArticulationSerial,
        rejectedSerial,
        rejectionReason,
        syncSerial,
    ];
    if (!fields.every((field): field is number => (
        typeof field === "number"
        && Number.isSafeInteger(field)
        && field >= -2_147_483_648
        && field <= 2_147_483_647
    ))) {
        return null;
    }
    if (
        typeof dspSessionId !== "number"
        || typeof acceptedModulationSerial !== "number"
        || typeof acceptedArticulationSerial !== "number"
        || typeof rejectedSerial !== "number"
        || typeof rejectionReason !== "number"
        || typeof syncSerial !== "number"
        || dspSessionId < 0
        || acceptedModulationSerial < 0
        || acceptedArticulationSerial > 0
        || rejectionReason < 0
    ) {
        return null;
    }

    return {
        dspSessionId,
        acceptedModulationSerial,
        acceptedArticulationSerial,
        rejectedSerial,
        rejectionReason,
        syncSerial,
    };
}

function withDeliveryAddress(value: unknown, dspSessionId: number, deliverySerial: number) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Runtime install commands require an object payload.");
    }

    return {
        ...(value as Record<string, unknown>),
        dspSessionId,
        deliverySerial,
    };
}

/**
 * A session-scoped, one-command-at-a-time restore lane. Missing output acks are
 * resolved with tiny correlated sync probes; a large payload is replayed only
 * when the DSP frontier proves that its input was dropped.
 */
export class RuntimeInstallLane {
    readonly #connection: PatchConnectionLike;
    readonly #laneKind: RuntimeInstallLaneKind;
    readonly #probeDelaysMilliseconds: number[];
    readonly #healthTimeoutMilliseconds: number;
    #activeBatch = false;
    #currentDspSessionId: number | null = null;
    #baselineDspSessionId: number | null = null;
    readonly #pendingBaselineSyncSerials = new Set<number>();
    #latestAck: RuntimeInstallAck | null = null;
    #latestAckVersion = 0;
    readonly #rejectionsBySerial = new Map<number, RejectionRecord>();
    #lifecycleEpoch = 0;
    #started = false;
    #stateVersion = 0;
    readonly #stateWaiters = new Set<StateWaiter>();

    readonly #handleAckBound = this.#handleAck.bind(this);

    constructor(connection: PatchConnectionLike, options: RuntimeInstallLaneOptions) {
        this.#connection = connection;
        this.#laneKind = options.laneKind;
        const configuredDelays = options.probeDelaysMilliseconds
            ?.map((delay) => Math.max(0, Math.trunc(delay)))
            .filter((delay) => Number.isFinite(delay));
        this.#probeDelaysMilliseconds = configuredDelays && configuredDelays.length > 0
            ? configuredDelays
            : [...defaultProbeDelaysMilliseconds];
        this.#healthTimeoutMilliseconds = Math.max(
            1,
            Math.trunc(options.healthTimeoutMilliseconds ?? RUNTIME_INSTALL_HEALTH_TIMEOUT_MS),
        );
    }

    start() {
        if (this.#started) {
            return;
        }

        acquireLaneOwnership(this.#connection, this.#laneKind);
        try {
            this.#lifecycleEpoch += 1;
            this.#started = true;
            this.#baselineDspSessionId = null;
            this.#pendingBaselineSyncSerials.clear();
            this.#connection.addEndpointListener?.(RUNTIME_INSTALL_ACK_ENDPOINT_ID, this.#handleAckBound);
        } catch (error) {
            this.#started = false;
            releaseLaneOwnership(this.#connection, this.#laneKind);
            throw error;
        }
    }

    stop() {
        if (!this.#started) {
            return;
        }

        this.#started = false;
        this.#connection.removeEndpointListener?.(RUNTIME_INSTALL_ACK_ENDPOINT_ID, this.#handleAckBound);
        releaseLaneOwnership(this.#connection, this.#laneKind);
        this.#rejectionsBySerial.clear();
        this.#baselineDspSessionId = null;
        this.#pendingBaselineSyncSerials.clear();
        this.#wakeStateWaiters();
    }

    observeRuntime(dspSessionId: number) {
        const nextSessionId = Math.trunc(Number(dspSessionId) || 0);
        if (nextSessionId === this.#currentDspSessionId) {
            return;
        }

        this.#currentDspSessionId = nextSessionId;
        this.#baselineDspSessionId = null;
        this.#pendingBaselineSyncSerials.clear();
        if (this.#latestAck?.dspSessionId !== nextSessionId) {
            this.#latestAck = null;
        }
        this.#rejectionsBySerial.clear();
        this.#stateVersion += 1;
        this.#wakeStateWaiters();
    }

    getAcceptedFrontier() {
        if (this.#latestAck?.dspSessionId !== this.#currentDspSessionId) {
            return 0;
        }
        return this.#laneKind === "modulation"
            ? this.#latestAck.acceptedModulationSerial
            : this.#latestAck.acceptedArticulationSerial;
    }

    getLatestAck() {
        return this.#latestAck ? { ...this.#latestAck } : null;
    }

    hasSessionBaseline() {
        return this.#currentDspSessionId !== null
            && this.#baselineDspSessionId === this.#currentDspSessionId;
    }

    async waitForSessionBaseline() {
        const dspSessionId = this.#currentDspSessionId;
        const lifecycleEpoch = this.#lifecycleEpoch;
        if (!this.#started) {
            return {
                _tag: "unavailable",
                reason: "not-started",
            } satisfies RuntimeInstallOutcome;
        }
        if (dspSessionId === null) {
            return {
                _tag: "unavailable",
                reason: "no-runtime-session",
            } satisfies RuntimeInstallOutcome;
        }
        return this.#ensureSessionBaseline(dspSessionId, lifecycleEpoch);
    }

    async sendBatch(commands: RuntimeInstallCommand[]) {
        if (!this.#started) {
            return {
                _tag: "unavailable",
                reason: "not-started",
            } satisfies RuntimeInstallOutcome;
        }
        if (this.#activeBatch) {
            return {
                _tag: "unavailable",
                reason: "batch-in-progress",
            } satisfies RuntimeInstallOutcome;
        }
        if (this.#currentDspSessionId === null) {
            return {
                _tag: "unavailable",
                reason: "no-runtime-session",
            } satisfies RuntimeInstallOutcome;
        }

        this.#activeBatch = true;
        const batchSessionId = this.#currentDspSessionId;
        const batchLifecycleEpoch = this.#lifecycleEpoch;
        try {
            const baselineOutcome = await this.#ensureSessionBaseline(
                batchSessionId,
                batchLifecycleEpoch,
            );
            if (baselineOutcome._tag !== "accepted") {
                return baselineOutcome;
            }

            let firstRejection: RuntimeInstallOutcome | null = null;
            for (const command of commands) {
                const commandOutcome = await this.#sendCommand(
                    command,
                    batchSessionId,
                    batchLifecycleEpoch,
                );
                if (commandOutcome._tag === "rejected" && this.#laneKind === "articulation") {
                    firstRejection ??= commandOutcome;
                    continue;
                }
                if (commandOutcome._tag !== "accepted") {
                    return commandOutcome;
                }
            }
            return firstRejection ?? acceptedOutcome;
        } finally {
            this.#activeBatch = false;
        }
    }

    #getFrontier(ack: RuntimeInstallAck) {
        return this.#laneKind === "modulation"
            ? ack.acceptedModulationSerial
            : ack.acceptedArticulationSerial;
    }

    #frontierReached(ack: RuntimeInstallAck, deliverySerial: number) {
        const frontier = this.#getFrontier(ack);
        return this.#laneKind === "modulation"
            ? frontier >= deliverySerial
            : frontier <= deliverySerial;
    }

    #createNextSerial() {
        const frontier = this.getAcceptedFrontier();
        return this.#laneKind === "modulation" ? frontier + 1 : frontier - 1;
    }

    async #ensureSessionBaseline(dspSessionId: number, lifecycleEpoch: number) {
        if (this.#baselineDspSessionId === dspSessionId) {
            return acceptedOutcome;
        }

        const baselineSyncSerial = createBaselineSyncSerial(this.#laneKind);
        this.#pendingBaselineSyncSerials.add(baselineSyncSerial);
        const deadlineMilliseconds = Date.now() + this.#healthTimeoutMilliseconds;
        let probeIndex = 0;
        try {
            while (true) {
                const interruption = this.#readInterruption(dspSessionId, lifecycleEpoch);
                if (interruption) {
                    return interruption;
                }
                if (this.#baselineDspSessionId === dspSessionId) {
                    return acceptedOutcome;
                }
                const remainingMilliseconds = deadlineMilliseconds - Date.now();
                if (remainingMilliseconds <= 0) {
                    return transportTimeoutOutcome;
                }

                const version = this.#stateVersion;
                this.#requestSync(baselineSyncSerial);
                await this.#waitForStateChange(
                    version,
                    Math.min(this.#probeDelay(probeIndex), remainingMilliseconds),
                );
                probeIndex += 1;
            }
        } finally {
            this.#pendingBaselineSyncSerials.delete(baselineSyncSerial);
        }
    }

    async #sendCommand(
        command: RuntimeInstallCommand,
        dspSessionId: number,
        lifecycleEpoch: number,
    ) {
        const deliverySerial = this.#createNextSerial();
        const payload = withDeliveryAddress(command.value, dspSessionId, deliverySerial);
        let probeIndex = 0;
        let payloadReplayCount = 0;
        let commandAckFloor = this.#latestAckVersion;

        this.#sendPayload(command.endpointID, payload);

        while (true) {
            const interruption = this.#readInterruption(dspSessionId, lifecycleEpoch);
            if (interruption) {
                return interruption;
            }
            const terminal = this.#readTerminalState(dspSessionId, deliverySerial, commandAckFloor);
            if (terminal !== null) {
                return terminal;
            }
            const directAckVersion = this.#stateVersion;
            await this.#waitForStateChange(
                directAckVersion,
                this.#probeDelay(probeIndex),
            );
            const afterDirectWait = this.#readTerminalState(
                dspSessionId,
                deliverySerial,
                commandAckFloor,
            );
            if (afterDirectWait !== null) {
                return afterDirectWait;
            }

            let syncVersion = this.#stateVersion;
            this.#requestSync(deliverySerial);
            while (true) {
                const syncInterruption = this.#readInterruption(dspSessionId, lifecycleEpoch);
                if (syncInterruption) {
                    return syncInterruption;
                }
                const changed = await this.#waitForStateChange(
                    syncVersion,
                    this.#probeDelay(probeIndex),
                );
                const afterSync = this.#readTerminalState(
                    dspSessionId,
                    deliverySerial,
                    commandAckFloor,
                );
                if (afterSync !== null) {
                    return afterSync;
                }

                if (changed
                    && this.#latestAck?.dspSessionId === dspSessionId
                    && this.#latestAck.syncSerial === deliverySerial) {
                    if (payloadReplayCount >= 1) {
                        return transportTimeoutOutcome;
                    }
                    commandAckFloor = this.#latestAckVersion;
                    this.#sendPayload(command.endpointID, payload);
                    payloadReplayCount += 1;
                    probeIndex += 1;
                    break;
                }

                if (changed) {
                    syncVersion = this.#stateVersion;
                    continue;
                }

                if (!changed) {
                    probeIndex += 1;
                    syncVersion = this.#stateVersion;
                    this.#requestSync(deliverySerial);
                }
            }
        }
    }

    #readTerminalState(
        dspSessionId: number,
        deliverySerial: number,
        commandAckFloor: number,
    ) {
        const ack = this.#latestAck;
        if (!ack || ack.dspSessionId !== dspSessionId) {
            return null;
        }
        const rejection = this.#rejectionsBySerial.get(deliverySerial);
        if (rejection !== undefined
            && rejection.version > commandAckFloor
            && rejection.acknowledgement.dspSessionId === dspSessionId) {
            this.#rejectionsBySerial.delete(deliverySerial);
            return {
                _tag: "rejected",
                acknowledgement: { ...rejection.acknowledgement },
            } satisfies RuntimeInstallOutcome;
        }
        if (this.#frontierReached(ack, deliverySerial)) {
            this.#rejectionsBySerial.delete(deliverySerial);
            return acceptedOutcome;
        }
        return null;
    }

    #readInterruption(
        dspSessionId: number,
        lifecycleEpoch: number,
    ): RuntimeInstallOutcome | null {
        if (!this.#started || this.#lifecycleEpoch !== lifecycleEpoch) {
            return stoppedOutcome;
        }
        if (this.#currentDspSessionId !== dspSessionId) {
            return supersededOutcome;
        }
        return null;
    }

    #probeDelay(probeIndex: number) {
        return this.#probeDelaysMilliseconds[Math.min(
            probeIndex,
            this.#probeDelaysMilliseconds.length - 1,
        )];
    }

    #sendPayload(endpointID: string, payload: Record<string, unknown>) {
        try {
            this.#connection.sendEventOrValue?.(
                endpointID,
                payload,
                undefined,
                RUNTIME_INSTALL_SEND_TIMEOUT_MS,
            );
        } catch {
            // A synchronous transport failure is indistinguishable from a
            // dropped FIFO write. The correlated frontier probe below decides
            // whether this exact payload needs to be replayed.
        }
    }

    #requestSync(syncSerial: number) {
        if (!this.#started) {
            return;
        }
        try {
            this.#connection.sendEventOrValue?.(
                RUNTIME_SYNC_REQUEST_ENDPOINT_ID,
                syncSerial,
                undefined,
                RUNTIME_INSTALL_SEND_TIMEOUT_MS,
            );
        } catch {
            // Retry the tiny probe on the next bounded wait.
        }
    }

    #handleAck(value: unknown) {
        const ack = normalizeAck(value);
        if (!ack) {
            return;
        }
        if (this.#currentDspSessionId !== null && ack.dspSessionId !== this.#currentDspSessionId) {
            return;
        }

        if (this.#pendingBaselineSyncSerials.has(ack.syncSerial)) {
            this.#baselineDspSessionId = ack.dspSessionId;
        }
        this.#latestAck = ack;
        this.#latestAckVersion += 1;
        const rejectionBelongsToLane = this.#laneKind === "modulation"
            ? ack.rejectedSerial > 0
            : ack.rejectedSerial < 0;
        if (rejectionBelongsToLane) {
            this.#rejectionsBySerial.set(ack.rejectedSerial, {
                acknowledgement: { ...ack },
                version: this.#latestAckVersion,
            });
            while (this.#rejectionsBySerial.size > 16) {
                const oldestSerial = this.#rejectionsBySerial.keys().next().value;
                if (oldestSerial === undefined) break;
                this.#rejectionsBySerial.delete(oldestSerial);
            }
        }
        this.#stateVersion += 1;
        this.#wakeStateWaiters();
    }

    #waitForStateChange(version: number, timeoutMilliseconds: number) {
        if (!this.#started || this.#stateVersion !== version) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            let finished = false;
            const waiter: StateWaiter = {
                finish: (changed) => {
                    if (finished) {
                        return;
                    }
                    finished = true;
                    if (waiter.timeoutHandle !== null) {
                        clearTimeout(waiter.timeoutHandle);
                    }
                    this.#stateWaiters.delete(waiter);
                    resolve(changed);
                },
                timeoutHandle: null,
            };
            waiter.timeoutHandle = setTimeout(() => waiter.finish(false), timeoutMilliseconds);
            this.#stateWaiters.add(waiter);
        });
    }

    #wakeStateWaiters() {
        for (const waiter of [...this.#stateWaiters]) {
            waiter.finish(true);
        }
    }
}
