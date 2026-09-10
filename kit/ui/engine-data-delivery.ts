import type { PluginStateDelivery, PluginStateDeliveryContext, PluginStateDeliveryOutcome } from "./plugin-state-definition";

/** A compiled kit::engine_data receiver and its declared finite capacities. */
export interface EngineDataInput {
    readonly endpoints: {
        readonly begin: string;
        readonly chunk: string;
        readonly commit: string;
        readonly query: string;
        readonly receipt: string;
    };
    readonly wordCapacity: number;
    readonly chunkCapacity: number;
}

type Receipt = {
    readonly operation: number;
    readonly scope: number;
    readonly generation: number;
    readonly status: number;
    readonly receivedWords: number;
    readonly currentScope: number;
    readonly currentGeneration: number;
    readonly request: number;
};
type Reply = { readonly kind: "receipt"; readonly value: Receipt } | { readonly kind: "cancelled" | "unconfirmed" };
const maxInt = 2_147_483_647;
// Keep word data at most 32 KiB within the native performer's 64 KiB event
// queue; its envelope and other queued events still need room. Queue refusal
// remains an ordinary uncertain send and is recovered through receiver queries.
const maxChunkWords = 8192;
const receiptDeadlineMs = 1500;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxInt;

function parseReceipt(input: unknown): Receipt | undefined {
    if (input === null || typeof input !== "object") return undefined;
    if (!("operation" in input) || !integer(input.operation) || input.operation < 1 || input.operation > 5
        || !("scope" in input) || !integer(input.scope)
        || !("generation" in input) || !integer(input.generation)
        || !("status" in input) || !integer(input.status) || input.status > 6
        || !("receivedWords" in input) || !integer(input.receivedWords)
        || !("currentScope" in input) || !integer(input.currentScope)
        || !("currentGeneration" in input) || !integer(input.currentGeneration)
        || !("request" in input) || !integer(input.request)) return undefined;
    return { operation: input.operation, scope: input.scope, generation: input.generation, status: input.status,
        receivedWords: input.receivedWords, currentScope: input.currentScope,
        currentGeneration: input.currentGeneration, request: input.request };
}

const refused = (message: string): PluginStateDeliveryOutcome => ({ kind: "failed", error: { kind: "engine-rejected", message } });

/** Stock transfer for a complete packed value; the framework owns its protocol. */
export function engineData(input: EngineDataInput): PluginStateDelivery<readonly number[] | Int32Array> {
    if (!integer(input.wordCapacity) || input.wordCapacity === 0
        || !integer(input.chunkCapacity) || input.chunkCapacity === 0 || input.chunkCapacity > maxChunkWords)
        throw new Error("Engine data needs a positive word capacity and a packet capacity of at most 8192 words.");
    const endpoints = Object.freeze({ ...input.endpoints });
    if (Object.values(endpoints).some(name => typeof name !== "string" || name.length === 0)
        || new Set(Object.values(endpoints)).size !== 5)
        throw new Error("Engine data requires five distinct endpoint names.");
    const { wordCapacity, chunkCapacity } = input;
    return Object.freeze({
        eventEndpoints: Object.freeze([endpoints.begin, endpoints.chunk, endpoints.commit, endpoints.query]),
        outputEndpoints: Object.freeze([endpoints.receipt]),
        create() {
            let stopped = false;
            let queryRequest = 0;
            const pending = new Set<() => void>();

            // Install correlation before sending: the receiver may answer from
            // inside the synchronous handoff. Native receipt != DSP receipt.
            function exchange(context: PluginStateDeliveryContext, endpoint: string, value: unknown,
                matches: (receipt: Receipt) => boolean): Promise<Reply> {
                if (stopped || context.signal.aborted) return Promise.resolve({ kind: "cancelled" });
                return new Promise((resolve, reject) => {
                    let done = false;
                    let removeListener = () => {};
                    let removeAbort = () => {};
                    let deadline: ReturnType<typeof setTimeout> | undefined;
                    const cleanup = () => {
                        clearTimeout(deadline);
                        pending.delete(cancel);
                        removeListener(); removeAbort();
                    };
                    const finish = (reply: Reply) => {
                        if (done) return;
                        done = true;
                        cleanup();
                        resolve(reply);
                    };
                    const cancel = () => finish({ kind: "cancelled" });
                    pending.add(cancel);
                    try {
                        removeListener = context.listen(endpoints.receipt, message => {
                            const receipt = parseReceipt(message);
                            if (receipt && matches(receipt)) finish({ kind: "receipt", value: receipt });
                        });
                        if (done) { removeListener(); return; }
                        removeAbort = context.signal.onAbort(cancel);
                        if (done) { removeAbort(); return; }
                        deadline = setTimeout(() => finish({ kind: "unconfirmed" }), receiptDeadlineMs);
                        const submission = context.send({ kind: "event", endpoint, value });
                        if (submission.kind === "cancelled") cancel();
                        else if (submission.kind === "failed") finish({ kind: "unconfirmed" });
                        else submission.completion.then(result => {
                            if (result.kind === "cancelled") cancel();
                            else if (result.kind === "failed") finish({ kind: "unconfirmed" });
                        }, () => finish({ kind: "unconfirmed" }));
                    } catch (error) {
                        done = true;
                        cleanup();
                        reject(error);
                    }
                });
            }

            return {
                async apply(payload: readonly number[] | Int32Array, context: PluginStateDeliveryContext): Promise<PluginStateDeliveryOutcome> {
                    if (stopped || context.signal.aborted) return { kind: "cancelled" };
                    if ((!Array.isArray(payload) && !(payload instanceof Int32Array))
                        || payload.length === 0 || payload.length > wordCapacity)
                        return refused("Prepared data exceeds the receiver's declared capacity or is empty.");
                    for (const word of payload)
                        if (!Number.isInteger(word) || word < -2_147_483_648 || word > maxInt)
                            return refused("Prepared data must contain signed 32-bit words.");
                    // Take ownership before the first wait; a caller retaining a
                    // mutable typed array cannot change an in-flight replacement.
                    const words = Int32Array.from(payload);
                    const query = (): Promise<Reply> => {
                        if (queryRequest === maxInt) return Promise.resolve({ kind: "unconfirmed" });
                        const request = ++queryRequest;
                        return exchange(context, endpoints.query, { request },
                            reply => reply.operation === 5 && reply.request === request);
                    };
                    const status = await query();
                    if (status.kind !== "receipt") return status;
                    if (status.value.status !== 0) return refused("The engine could not report its data state.");
                    if (status.value.generation === maxInt) return refused("Engine data generations are exhausted.");
                    const scope = status.value.scope || 1;
                    const generation = status.value.generation + 1;
                    const send = async (operation: number, endpoint: string, value: unknown,
                        installed: (receipt: Receipt) => boolean, missing: (receipt: Receipt) => boolean,
                        receivedWords?: number): Promise<Reply> => {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            const reply = await exchange(context, endpoint, value, reply => reply.operation === operation
                                && reply.scope === scope && reply.generation === generation
                                && (reply.status !== 0 || receivedWords === undefined || reply.receivedWords === receivedWords));
                            const backpressured = reply.kind === "receipt" && operation === 2 && reply.value.status === 5;
                            if (reply.kind !== "unconfirmed" && !backpressured) return reply;
                            // Missing output does not tell us whether the engine
                            // processed the packet. Ask it before changing anything.
                            const recovered = await query();
                            if (recovered.kind !== "receipt") return recovered;
                            if (recovered.value.status !== 0) return { kind: "unconfirmed" };
                            if (recovered.value.scope === scope && recovered.value.generation === generation
                                && installed(recovered.value)) return recovered;
                            // Replay only the identical operation, after the real
                            // receiver proves it has not progressed past that point.
                            if (!missing(recovered.value)) return { kind: "unconfirmed" };
                        }
                        return { kind: "unconfirmed" };
                    };
                    const begun = await send(1, endpoints.begin, { scope, generation, wordCount: words.length },
                        receipt => receipt.receivedWords === 0,
                        receipt => (receipt.scope === scope || receipt.scope === 0) && receipt.generation === generation - 1);
                    if (begun.kind !== "receipt") return begun;
                    if (begun.value.status !== 0) return refused("The engine could not reserve space for this replacement.");
                    for (let offset = 0; offset < words.length; offset += chunkCapacity) {
                        const count = Math.min(chunkCapacity, words.length - offset);
                        const part = Array.from({ length: chunkCapacity }, (_, index) => index < count ? words[offset + index] : 0);
                        const copied = await send(2, endpoints.chunk, { scope, generation, offset, count, words: part },
                            receipt => receipt.receivedWords === offset + count,
                            receipt => receipt.scope === scope && receipt.generation === generation && receipt.receivedWords === offset,
                            offset + count);
                        if (copied.kind !== "receipt") return copied;
                        if (copied.value.status !== 0) return refused("The engine refused a data packet; its previous value remains installed.");
                    }
                    const committed = await send(3, endpoints.commit, { scope, generation },
                        receipt => receipt.currentScope === scope && receipt.currentGeneration === generation,
                        receipt => receipt.scope === scope && receipt.generation === generation && receipt.receivedWords === words.length
                            && (receipt.currentScope !== scope || receipt.currentGeneration < generation));
                    if (committed.kind !== "receipt") return committed;
                    if (committed.value.status !== 0) return refused("The engine refused to activate this replacement.");
                    if (committed.value.currentScope !== scope || committed.value.currentGeneration !== generation)
                        return { kind: "unconfirmed" };
                    return { kind: "acknowledged", engineSession: String(scope), operation: String(generation) };
                },
                stop() { stopped = true; for (const cancel of [...pending]) cancel(); },
            };
        },
    });
}
