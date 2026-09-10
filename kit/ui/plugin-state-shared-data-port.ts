import type { EngineCancellation, EngineOutcome, EngineTarget } from "./plugin-state-engine";
import type { CmajorStateConnection } from "./plugin-state-cmajor";
import { isRecord } from "./plugin-state-protocol";

type Reply = { readonly kind: "ready"; readonly transfer: number }
    | { readonly kind: "written" | "applied" }
    | { readonly kind: "failed"; readonly reason: string }
    | { readonly kind: "cancelled" };

const failed = (message: string): EngineOutcome => ({ kind: "failed", error: { kind: "transport", message } });
const sameScope = (value: unknown, scope: EngineTarget["scope"]) => isRecord(value)
    && value.owner === scope.owner && value.document === scope.document;

/** Framework control-side transport. Native writes staging memory; the browser
 * writes shared Wasm storage. Neither sends sample chunks through DSP events.
 */
export function createSharedDataPort(connection: CmajorStateConnection, options: { readonly timeoutMs?: number } = {}) {
    let nextRequest = 0;
    let stopped = false;
    const pending = new Map<number, { readonly scope: EngineTarget["scope"]; readonly matches: (reply: Record<string, unknown>) => boolean; finish(reply: Reply): void }>();
    const timeoutMs = options.timeoutMs ?? 10000;
    function receive(body: unknown) {
        if (!isRecord(body) || typeof body.request !== "number") return;
        const request = pending.get(body.request);
        if (!request || !sameScope(body.scope, request.scope)) return;
        if (body.kind !== "failed" && body.kind !== "cancelled" && !request.matches(body)) {
            request.finish({ kind: "failed", reason: "invalid-reply" }); return;
        }
        if (body.kind === "ready" && typeof body.transfer === "number" && Number.isSafeInteger(body.transfer) && body.transfer > 0)
            request.finish({ kind: "ready", transfer: body.transfer });
        else if (body.kind === "written" || body.kind === "applied" || body.kind === "cancelled") request.finish({ kind: body.kind });
        else request.finish({ kind: "failed", reason: body.kind === "failed" && typeof body.reason === "string" ? body.reason : "invalid-reply" });
    }
    connection.addEventListener("kit_data", receive);
    function send(body: unknown) { connection.sendMessageToServer({ type: "kit_data", message: body }); }
    function ask(request: number, body: object, scope: EngineTarget["scope"], signal: EngineCancellation,
        matches: (reply: Record<string, unknown>) => boolean): Promise<Reply> {
        if (stopped || signal.aborted) return Promise.resolve({ kind: "cancelled" });
        return new Promise(resolve => {
            let removeAbort = () => {};
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (reply: Reply) => {
                if (!pending.delete(request)) return;
                clearTimeout(timer); removeAbort(); resolve(reply);
            };
            pending.set(request, { scope, matches, finish });
            removeAbort = signal.onAbort(() => finish({ kind: "cancelled" }));
            if (!pending.has(request)) return;
            timer = setTimeout(() => finish({ kind: "failed", reason: "reply-timeout" }), timeoutMs);
            try { send({ ...body, scope, request }); }
            catch { finish({ kind: "failed", reason: "connection-failed" }); }
        });
    }
    return {
        /** Takes exclusive read ownership until completion. The caller must not
         * mutate or reuse samples while pending; avoiding a second whole-value
         * copy depends on this same ownership rule as native resource adoption.
         */
        async replace(input: number, samples: Float32Array, target: EngineTarget, signal: EngineCancellation): Promise<EngineOutcome> {
            if (stopped || signal.aborted) return { kind: "cancelled" };
            if (!(samples instanceof Float32Array) || !samples.every(Number.isFinite))
                return { kind: "failed", error: { kind: "engine-rejected", message: "Shared data requires finite Float32 samples." } };
            const scope = Object.freeze({ ...target.scope });
            const beginRequest = ++nextRequest;
            let applied = false;
            const unexpected = (reply: Reply): EngineOutcome => reply.kind === "cancelled" ? reply
                : failed(reply.kind === "failed" ? `Data delivery failed: ${reply.reason}.` : "Unexpected data delivery reply.");
            try {
                const begin = await ask(beginRequest, { kind: "begin", input, generation: target.generation, sampleCount: samples.length }, scope, signal,
                    reply => reply.kind === "ready");
                if (begin.kind !== "ready") return unexpected(begin);
                // Capture only the next bounded control message. The accepted domain
                // state owns preparation; no duplicate of the whole buffer is retained.
                for (let offset = 0; offset < samples.length; offset += 8192) {
                    const reply = await ask(++nextRequest, { kind: "write", transfer: begin.transfer, offset,
                        samples: Array.from(samples.subarray(offset, offset + 8192)) }, scope, signal,
                        reply => reply.kind === "written" && reply.transfer === begin.transfer && reply.offset === Math.min(offset + 8192, samples.length));
                    if (reply.kind !== "written") return unexpected(reply);
                }
                const reply = await ask(++nextRequest, { kind: "commit", transfer: begin.transfer }, scope, signal,
                    reply => reply.kind === "applied" && reply.transfer === begin.transfer && reply.input === input && reply.generation === target.generation);
                if (reply.kind !== "applied") return unexpected(reply);
                applied = true;
                return { kind: "acknowledged", engineSession: `${scope.owner}:${scope.document}`, operation: String(beginRequest) };
            } finally {
                // beginRequest identifies our allocation even if its ready reply was
                // lost. Cleanup can revoke our old scope; it cannot publish new data.
                if (!applied) try { send({ kind: "cancel", request: ++nextRequest, scope, beginRequest }); } catch { /* The host also releases transfers when this owner closes. */ }
            }
        },
        stop() {
            if (stopped) return;
            stopped = true;
            for (const request of [...pending.values()]) request.finish({ kind: "cancelled" });
            connection.removeEventListener("kit_data", receive);
        },
    };
}
