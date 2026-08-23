import { bounceBankInstallMessages } from "./bank-install.mjs";

export const BOUNCE_BANK_ACK_ENDPOINT_ID = "bounceBankUploadAck";
export const BOUNCE_BANK_STATE_ENDPOINT_ID = "bounceBankRuntimeState";
export const BOUNCE_ENGINE_STATUS_ENDPOINT_ID = "engineStatus";
export const BOUNCE_ENGINE_STATUS_REQUEST_ENDPOINT_ID = "engineStatusRequest";
export const BOUNCE_INSTALL_SEND_TIMEOUT_MS = 0;
export const BOUNCE_INSTALL_HEALTH_TIMEOUT_MS = 8_000;

const activeConnections = new WeakSet();
const runtimeGenerationByConnection = new WeakMap();

/** Allocate an engine-local generation; persisted document generations are semantic, not FIFO frontiers. */
export function allocateBounceRuntimeGeneration(connection, minimum = 1) {
    const previous = runtimeGenerationByConnection.get(connection)
        ?? ((Date.now() % 1_000_000_000) + 1);
    const next = Math.max(previous + 1, Math.trunc(Number(minimum) || 1));
    if (next > 2_147_483_647) {
        throw new BounceBankInstallError("generation-exhausted", "Bounce runtime generation exhausted");
    }
    runtimeGenerationByConnection.set(connection, next);
    return next;
}

export class BounceBankInstallError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = code === "timeout" ? "TimeoutError" : "BounceBankInstallError";
        this.code = code;
    }
}

function payloadOf(value) {
    let payload = value;
    if (payload && typeof payload === "object" && "event" in payload) payload = payload.event;
    if (payload && typeof payload === "object" && "value" in payload) payload = payload.value;
    return payload && typeof payload === "object" ? payload : null;
}

function integerField(record, key, { min = -2_147_483_648 } = {}) {
    const value = record?.[key];
    return Number.isSafeInteger(value) && value >= min && value <= 2_147_483_647 ? value : null;
}

function normalizeAck(value) {
    const record = payloadOf(value);
    if (!record) return null;
    const fields = [
        "dspSessionId",
        "generation",
        "deliverySerial",
        "frameIndexBase",
        "frameCount",
        "receivedFrameCount",
    ];
    const normalized = Object.fromEntries(fields.map((key) => [key, integerField(record, key, { min: 0 })]));
    return Object.values(normalized).every((field) => field !== null) ? normalized : null;
}

function normalizeState(value) {
    const record = payloadOf(value);
    if (!record) return null;
    const fields = [
        "dspSessionId",
        "hasActive",
        "activeGeneration",
        "activeRootCount",
        "activeFrameCount",
        "hasStaging",
        "stagingGeneration",
        "stagingReceivedFrameCount",
        "stagingExpectedFrameCount",
        "rejectedDeliverySerial",
        "rejectionReason",
    ];
    const normalized = Object.fromEntries(fields.map((key) => [key, integerField(record, key, { min: 0 })]));
    return Object.values(normalized).every((field) => field !== null) ? normalized : null;
}

function normalizeEngineStatus(value) {
    const record = payloadOf(value);
    if (!record) return null;
    const dspSessionId = integerField(record, "dspSessionId", { min: 0 });
    const sampleRateHz = record.sampleRateHz;
    if (dspSessionId === null || typeof sampleRateHz !== "number"
        || !Number.isFinite(sampleRateHz) || sampleRateHz <= 0) return null;
    return { dspSessionId, sampleRateHz };
}

function timeoutError(label) {
    return new BounceBankInstallError("timeout", `${label} timed out`);
}

function waitForEndpoint(connection, endpointID, {
    predicate,
    timeoutMilliseconds,
    signal,
    request,
    label,
}) {
    if (signal?.aborted) return Promise.reject(new DOMException("Bounce install cancelled", "AbortError"));
    return new Promise((resolve, reject) => {
        let timer = null;
        const cleanup = () => {
            if (timer !== null) clearTimeout(timer);
            connection.removeEndpointListener?.(endpointID, listener);
            signal?.removeEventListener("abort", cancel);
        };
        const settle = (callback, value) => {
            cleanup();
            callback(value);
        };
        const listener = (value) => {
            const parsed = predicate(value);
            if (parsed !== null && parsed !== false) settle(resolve, parsed);
        };
        const cancel = () => settle(reject, new DOMException("Bounce install cancelled", "AbortError"));
        connection.addEndpointListener?.(endpointID, listener);
        signal?.addEventListener("abort", cancel, { once: true });
        timer = setTimeout(() => settle(reject, timeoutError(label)), timeoutMilliseconds);
        try {
            request();
        } catch (cause) {
            settle(reject, new BounceBankInstallError("transport", `${label} send failed`, { cause }));
        }
    });
}

export async function requestBounceEngineStatus(connection, {
    timeoutMilliseconds = BOUNCE_INSTALL_HEALTH_TIMEOUT_MS,
    signal,
} = {}) {
    if (typeof connection?.sendEventOrValue !== "function"
        || typeof connection?.addEndpointListener !== "function") {
        throw new BounceBankInstallError("unavailable", "Bounce engine status transport is unavailable");
    }
    return waitForEndpoint(connection, BOUNCE_ENGINE_STATUS_ENDPOINT_ID, {
        timeoutMilliseconds,
        signal,
        label: "Bounce engine status",
        predicate(value) {
            return normalizeEngineStatus(value);
        },
        request() {
            connection.sendEventOrValue(
                BOUNCE_ENGINE_STATUS_REQUEST_ENDPOINT_ID,
                1,
                0,
                BOUNCE_INSTALL_SEND_TIMEOUT_MS,
            );
        },
    });
}

function createEndpointObserver(connection) {
    let latestAck = null;
    let latestState = null;
    const waiters = new Set();
    const notify = () => {
        for (const waiter of [...waiters]) waiter();
    };
    const handleAck = (value) => {
        latestAck = normalizeAck(value) ?? latestAck;
        notify();
    };
    const handleState = (value) => {
        latestState = normalizeState(value) ?? latestState;
        notify();
    };
    connection.addEndpointListener?.(BOUNCE_BANK_ACK_ENDPOINT_ID, handleAck);
    connection.addEndpointListener?.(BOUNCE_BANK_STATE_ENDPOINT_ID, handleState);

    const waitFor = ({ predicate, deliverySerial, timeoutMilliseconds, signal, label }) => {
        if (signal?.aborted) return Promise.reject(new DOMException("Bounce install cancelled", "AbortError"));
        return new Promise((resolve, reject) => {
            let timer = null;
            const cleanup = () => {
                if (timer !== null) clearTimeout(timer);
                waiters.delete(check);
                signal?.removeEventListener("abort", cancel);
            };
            const finish = (callback, value) => {
                cleanup();
                callback(value);
            };
            const check = () => {
                if (latestState?.rejectedDeliverySerial === deliverySerial
                    && latestState.rejectionReason > 0) {
                    finish(reject, new BounceBankInstallError(
                        "rejected",
                        `${label} was rejected by DSP (reason ${latestState.rejectionReason})`,
                    ));
                    return;
                }
                const result = predicate({ ack: latestAck, state: latestState });
                if (result) finish(resolve, result);
            };
            const cancel = () => finish(reject, new DOMException("Bounce install cancelled", "AbortError"));
            waiters.add(check);
            signal?.addEventListener("abort", cancel, { once: true });
            timer = setTimeout(() => finish(reject, timeoutError(label)), timeoutMilliseconds);
            check();
        });
    };

    return {
        waitFor,
        stop() {
            connection.removeEndpointListener?.(BOUNCE_BANK_ACK_ENDPOINT_ID, handleAck);
            connection.removeEndpointListener?.(BOUNCE_BANK_STATE_ENDPOINT_ID, handleState);
            waiters.clear();
        },
    };
}

function send(connection, endpointID, value) {
    connection.sendEventOrValue(
        endpointID,
        value,
        0,
        BOUNCE_INSTALL_SEND_TIMEOUT_MS,
    );
}

/** Upload every frame into the inactive slot but deliberately do not publish it. */
export async function stageBounceBankInstall(connection, bank, {
    dspSessionId,
    generation,
    firstDeliverySerial = 1,
    timeoutMilliseconds = BOUNCE_INSTALL_HEALTH_TIMEOUT_MS,
    signal,
    onProgress = () => {},
} = {}) {
    if (!connection || (typeof connection !== "object" && typeof connection !== "function")) {
        throw new BounceBankInstallError("unavailable", "Bounce patch connection is unavailable");
    }
    if (typeof connection.sendEventOrValue !== "function"
        || typeof connection.addEndpointListener !== "function"
        || typeof connection.removeEndpointListener !== "function") {
        throw new BounceBankInstallError("unavailable", "Bounce bank event transport is unavailable");
    }
    if (activeConnections.has(connection)) {
        throw new BounceBankInstallError("busy", "A Bounce bank install is already active");
    }
    activeConnections.add(connection);
    const observer = createEndpointObserver(connection);
    const messages = bounceBankInstallMessages(bank, {
        dspSessionId,
        generation,
        firstDeliverySerial,
    });
    let finalCommitMessage = null;
    let lastDeliverySerial = firstDeliverySerial;
    let completed = false;

    const cleanup = () => {
        if (completed) return;
        completed = true;
        observer.stop();
        activeConnections.delete(connection);
    };
    const abortStaging = () => {
        try {
            send(connection, "bounceBankAbort", {
                dspSessionId,
                generation,
                deliverySerial: lastDeliverySerial + 1,
                failureReasonCode: 3,
            });
        } catch {
            // A transport that is already gone cannot make the inactive slot
            // audible; session replacement discards its staging identity.
        } finally {
            cleanup();
        }
    };

    try {
        const begin = messages.next().value;
        lastDeliverySerial = begin.deliverySerial;
        send(connection, begin.endpointID, begin.value);
        await observer.waitFor({
            deliverySerial: begin.deliverySerial,
            timeoutMilliseconds,
            signal,
            label: "Bounce bank begin",
            predicate: ({ state }) => state?.dspSessionId === dspSessionId
                && state.hasStaging === 1
                && state.stagingGeneration === generation,
        });

        for (let entry = messages.next(); !entry.done; entry = messages.next()) {
            const message = entry.value;
            if (message.endpointID === "bounceBankCommit") {
                finalCommitMessage = message;
                break;
            }
            lastDeliverySerial = message.deliverySerial;
            send(connection, message.endpointID, message.value);
            await observer.waitFor({
                deliverySerial: message.deliverySerial,
                timeoutMilliseconds,
                signal,
                label: `Bounce bank batch ${message.deliverySerial}`,
                predicate: ({ ack }) => ack?.dspSessionId === dspSessionId
                    && ack.generation === generation
                    && ack.deliverySerial === message.deliverySerial
                    && ack.frameIndexBase === message.value.frameIndexBase
                    && ack.frameCount === message.value.frameCount
                    && ack.receivedFrameCount === message.value.frameIndexBase + message.value.frameCount,
            });
            onProgress(Object.freeze({
                completedFrames: message.value.frameIndexBase + message.value.frameCount,
                totalFrames: bank.totalFrameCount,
            }));
        }
        if (finalCommitMessage === null) {
            throw new BounceBankInstallError("protocol", "Bounce install produced no commit message");
        }
        lastDeliverySerial = finalCommitMessage.deliverySerial;

        let settled = false;
        return Object.freeze({
            generation,
            async commit(applyPatchDocument) {
                if (settled) throw new BounceBankInstallError("settled", "Bounce install is already settled");
                settled = true;
                try {
                    // Queue bank publication first, then the neutral/document
                    // writes in the same JS turn. PatchConnection preserves
                    // message order and the source-mode write sees a ready bank.
                    send(connection, finalCommitMessage.endpointID, finalCommitMessage.value);
                    await applyPatchDocument?.();
                    await observer.waitFor({
                        deliverySerial: finalCommitMessage.deliverySerial,
                        timeoutMilliseconds,
                        signal,
                        label: "Bounce bank commit",
                        predicate: ({ state }) => state?.dspSessionId === dspSessionId
                            && state.hasActive === 1
                            && state.activeGeneration === generation
                            && state.hasStaging === 0,
                    });
                } finally {
                    cleanup();
                }
            },
            async abort() {
                if (settled) return;
                settled = true;
                abortStaging();
            },
        });
    } catch (cause) {
        abortStaging();
        throw cause;
    }
}

export const bounceLiveInstallInternals = Object.freeze({
    normalizeAck,
    normalizeEngineStatus,
    normalizeState,
});
