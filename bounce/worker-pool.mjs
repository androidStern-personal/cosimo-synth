function abortError() {
    return new DOMException("Bounce capture was cancelled", "AbortError");
}

function workerError(payload) {
    const error = new Error(payload?.message ?? "Bounce render worker failed");
    error.name = payload?.name ?? "BounceWorkerError";
    if (payload?.stack) error.stack = payload.stack;
    return error;
}

function addWorkerListener(worker, type, listener) {
    if (typeof worker.addEventListener === "function") {
        const wrapped = type === "message" ? (event) => listener(event.data) : listener;
        worker.addEventListener(type, wrapped);
        return () => worker.removeEventListener(type, wrapped);
    }
    if (typeof worker.on === "function") {
        worker.on(type, listener);
        return () => worker.off?.(type, listener);
    }
    throw new Error("Bounce worker does not support event listeners");
}

function terminateWorker(worker) {
    try {
        void worker.terminate();
    } catch {
        // A worker that already failed may reject termination; it owns no live state.
    }
}

function renderOneJob({ workerFactory, workerURL, engineModuleURL, plan, job, signal }) {
    if (signal?.aborted) return Promise.reject(abortError());
    const worker = workerFactory(workerURL, job);
    const requestID = `root-${job.rootIndex}`;
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanupCallbacks = [];
        const settle = (callback, value) => {
            if (settled) return;
            settled = true;
            cleanupCallbacks.forEach((cleanup) => cleanup());
            terminateWorker(worker);
            callback(value);
        };
        cleanupCallbacks.push(addWorkerListener(worker, "message", (message) => {
            if (message?.requestID !== requestID) return;
            if (message.type === "render-root-complete") {
                settle(resolve, message.result);
            } else if (message.type === "render-root-failed") {
                settle(reject, workerError(message.error));
            }
        }));
        cleanupCallbacks.push(addWorkerListener(worker, "error", (event) => {
            settle(reject, event instanceof Error ? event : new Error(event?.message ?? "Worker error"));
        }));
        const cancel = () => settle(reject, abortError());
        signal?.addEventListener("abort", cancel, { once: true });
        cleanupCallbacks.push(() => signal?.removeEventListener("abort", cancel));
        worker.postMessage({
            type: "render-root",
            requestID,
            engineModuleURL: String(engineModuleURL),
            plan,
            job,
        });
    });
}

export function defaultBounceWorkerConcurrency() {
    const hardwareConcurrency = Number(globalThis.navigator?.hardwareConcurrency ?? 2);
    // Each performer currently owns ~140 MiB of wasm memory. Four workers is
    // the product ceiling; small VMs and low-core phones naturally stay lower.
    return Math.max(1, Math.min(4, Math.floor(hardwareConcurrency) - 1 || 1));
}

/**
 * Run one short-lived worker per root, with a bounded number alive at once.
 * Termination after every job guarantees both a fresh engine and prompt wasm
 * memory reclamation without relying on GC between roots.
 */
export async function renderBouncePlanInWorkers({
    plan,
    workerURL,
    engineModuleURL,
    workerFactory = (url, job) => new Worker(url, {
        type: "module",
        name: `cosimo-bounce-root-${job.rootNote}`,
    }),
    concurrency = defaultBounceWorkerConcurrency(),
    signal,
    onProgress = () => {},
}) {
    if (signal?.aborted) throw abortError();
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
        throw new Error("Bounce worker concurrency must be from 1 to 4");
    }
    const results = new Array(plan.jobs.length);
    const poolAbortController = new AbortController();
    const forwardAbort = () => poolAbortController.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const poolSignal = poolAbortController.signal;
    let nextJobIndex = 0;
    let completed = 0;

    async function lane() {
        while (true) {
            if (poolSignal.aborted) throw abortError();
            const index = nextJobIndex;
            nextJobIndex += 1;
            if (index >= plan.jobs.length) return;
            const result = await renderOneJob({
                workerFactory,
                workerURL,
                engineModuleURL,
                plan,
                job: plan.jobs[index],
                signal: poolSignal,
            });
            results[index] = result;
            completed += 1;
            onProgress(Object.freeze({
                completedRoots: completed,
                totalRoots: plan.jobs.length,
                rootNote: result.rootNote,
            }));
        }
    }

    try {
        await Promise.all(Array.from(
            { length: Math.min(concurrency, plan.jobs.length) },
            () => lane(),
        ));
        return results;
    } catch (cause) {
        // Any failed root invalidates the entire immutable capture. Stop peers
        // immediately so their 140 MiB performers do not linger or report
        // misleading progress after the failure is known.
        poolAbortController.abort();
        throw cause;
    } finally {
        signal?.removeEventListener("abort", forwardAbort);
    }
}
