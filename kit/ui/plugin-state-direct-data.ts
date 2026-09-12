import type { CmajorStateConnection } from "./plugin-state-cmajor";
import type { EngineCancellation, EngineOutcome, EngineTarget } from "./plugin-state-engine";
import { isPreparationFailure, type PluginStatePreparationFailure } from "./plugin-state-definition";
import { isRecord } from "./plugin-state-protocol";
import type { SharedDataDestination } from "./prepared-shared-data";

type Request = { readonly input: number; readonly byteLength: number };
type Writer = (destination: SharedDataDestination) => void | PluginStatePreparationFailure | Extract<EngineOutcome, { readonly kind: "failed" }>;
type Pending = {
    readonly input: number;
    readonly target: EngineTarget;
    finish(outcome: EngineOutcome): void;
    submitted: { readonly generation: number; readonly serial: number } | null;
    early: Record<string, unknown> | null;
};

const failure = (message: string): EngineOutcome => ({ kind: "failed", error: { kind: "resource", message } });

/** Direct allocation, synchronous filling, and a separately observed audio adoption.
 * Only small receipts cross the connection. Cancellation stays attached after
 * commit returns, until audio adopts this allocation or the request ends.
 */
export function createDirectDataPort(connection: CmajorStateConnection, options: { readonly timeoutMs?: number } = {}) {
    const pending = new Map<number, Pending>();
    let stopped = false;
    function receive(body: unknown) {
        if (!isRecord(body) || typeof body.id !== "number" || !isRecord(body.scope)) return;
        const job = pending.get(body.id);
        if (!job || body.input !== job.input || body.scope.owner !== job.target.scope.owner || body.scope.document !== job.target.scope.document) return;
        if (body.kind === "applied") {
            if (body.generation !== body.id || typeof body.serial !== "number" || !Number.isSafeInteger(body.serial) || body.serial <= 0) return;
            if (!job.submitted) { job.early = body; return; }
            if (body.serial !== job.submitted.serial || body.generation !== job.submitted.generation) return;
            job.finish({ kind: "acknowledged", engineSession: `${job.target.scope.owner}:${job.target.scope.document}`, operation: String(body.id) });
        } else if (body.kind === "failed") {
            job.finish(body.reason === "cancelled" || body.reason === "superseded" || body.reason === "stale-scope"
                ? { kind: "cancelled" } : failure("The shared resource could not be applied."));
        }
    }
    connection.addEventListener("kit_data", receive);
    return {
        async prepare(request: Request, target: EngineTarget, signal: EngineCancellation, write: Writer): Promise<EngineOutcome> {
            if (stopped || signal.aborted) return { kind: "cancelled" };
            if (!Number.isSafeInteger(request.byteLength) || request.byteLength <= 0 || request.byteLength % 4 !== 0 || request.byteLength > 0x7fffffff)
                return failure("Shared data requires a positive, four-byte-aligned size within the runtime limit.");
            const storage = connection.sharedData;
            if (!storage) return failure("This host does not support shared-data preparation.");
            let destination: SharedDataDestination & { readonly id: number };
            try { destination = storage.reserve(request.input, request.byteLength); }
            catch { return failure("Shared storage is unavailable or its memory budget is exhausted."); }
            let committed = false;
            try {
                if (destination.byteLength !== request.byteLength) return failure("The host supplied a differently sized shared allocation.");
                const result = write(destination);
                if (result?.kind === "failed") return result;
                if (isPreparationFailure(result)) return { kind: "failed", error: result.error };
                if (signal.aborted || stopped) return { kind: "cancelled" };
                const completion = new Promise<EngineOutcome>(resolve => {
                    let removeAbort = () => {};
                    let timer: ReturnType<typeof setTimeout> | undefined;
                    const finish = (outcome: EngineOutcome) => {
                        if (!pending.delete(destination.id)) return;
                        clearTimeout(timer); removeAbort();
                        if (outcome.kind !== "acknowledged") {
                            try { storage.cancel(destination.id); }
                            catch { outcome = failure("Cancellation of the shared resource could not be confirmed."); }
                        }
                        resolve(outcome);
                    };
                    pending.set(destination.id, { input: request.input, target, submitted: null, early: null, finish });
                    removeAbort = signal.onAbort(() => finish({ kind: "cancelled" }));
                    if (pending.has(destination.id)) timer = setTimeout(() => finish(failure("The audio engine did not confirm this resource.")), options.timeoutMs ?? 10000);
                });
                if (!pending.has(destination.id)) return completion;
                try {
                    // Native is synchronous; the browser's control handoff is async.
                    // Both return before audio adoption. The receipt resolves completion.
                    const submission = await Promise.race([
                        Promise.resolve(storage.commit(destination.id)).then(receipt => ({ kind: "submitted" as const, receipt })),
                        completion.then(outcome => ({ kind: "finished" as const, outcome })),
                    ]);
                    if (submission.kind === "finished") return submission.outcome;
                    const receipt = submission.receipt;
                    committed = true;
                    const job = pending.get(destination.id);
                    if (job) {
                        if (!isRecord(receipt) || receipt.kind !== "submitted" || receipt.id !== destination.id || receipt.input !== request.input || receipt.generation !== destination.id
                            || typeof receipt.serial !== "number" || !Number.isSafeInteger(receipt.serial) || receipt.serial <= 0)
                            job.finish(failure("The host returned an invalid shared-resource submission receipt."));
                        else {
                            job.submitted = { generation: receipt.generation, serial: receipt.serial };
                            if (job.early) receive(job.early);
                        }
                    }
                } catch {
                    pending.get(destination.id)?.finish(signal.aborted ? { kind: "cancelled" } : failure("The shared resource could not be submitted."));
                }
                return completion;
            } finally {
                if (!committed) { try { storage.cancel(destination.id); } catch { /* The original failure is retained; host teardown also releases reservations. */ } }
            }
        },
        stop() {
            if (stopped) return;
            stopped = true;
            for (const job of [...pending.values()]) job.finish({ kind: "cancelled" });
            connection.removeEventListener("kit_data", receive);
        },
    };
}
