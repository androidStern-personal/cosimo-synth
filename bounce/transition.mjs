import { digestBounceBank } from "./digest.mjs";
import {
    attachBounceDocument,
    createBounceDocument,
    createNeutralBouncePatchDocument,
    parseBouncePatchDocument,
    readBounceDocumentFromPatch,
} from "./document.mjs";

export class BounceTransitionError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "BounceTransitionError";
        this.code = code;
    }
}

function isAbort(cause) {
    return cause?.name === "AbortError" || cause?.code === "cancelled";
}

function stageError(stage, cause) {
    if (cause instanceof BounceTransitionError) return cause;
    if (isAbort(cause)) {
        return new BounceTransitionError("cancelled", "Bounce was cancelled", { cause });
    }
    const timeout = cause?.code === "timeout" || cause?.name === "TimeoutError";
    const code = stage === "install" && timeout ? "install-timeout" : `${stage}-failed`;
    const detail = cause instanceof Error ? cause.message : String(cause);
    return new BounceTransitionError(code, `Bounce ${stage} failed: ${detail}`, { cause });
}

function requireFunction(value, name) {
    if (typeof value !== "function") throw new TypeError(`Bounce coordinator requires ${name}()`);
    return value;
}

function throwIfAborted(signal) {
    if (signal.aborted) throw new DOMException("Bounce was cancelled", "AbortError");
}

/**
 * Two-phase Bounce transaction. Rendering, digest validation, persistence,
 * staged live upload, and verification all happen before the single publish
 * callback. Until that callback, neither sourceMode nor bounce.v1 can change.
 */
export class BounceTransitionCoordinator {
    #capture;
    #persistBank;
    #stageBankInstall;
    #verifyCapture;
    #applyPatchDocument;
    #readBankByDigest;
    #activeAbortController = null;
    #phase = "idle";
    #listeners = new Set();

    constructor({
        capture,
        persistBank,
        stageBankInstall,
        verifyCapture,
        applyPatchDocument,
        readBankByDigest = null,
    } = {}) {
        this.#capture = requireFunction(capture, "capture");
        this.#persistBank = requireFunction(persistBank, "persistBank");
        this.#stageBankInstall = requireFunction(stageBankInstall, "stageBankInstall");
        this.#verifyCapture = requireFunction(verifyCapture, "verifyCapture");
        this.#applyPatchDocument = requireFunction(applyPatchDocument, "applyPatchDocument");
        this.#readBankByDigest = readBankByDigest;
    }

    getState() {
        return Object.freeze({
            phase: this.#phase,
            busy: this.#activeAbortController !== null,
            cancellable: this.#phase !== "idle" && this.#phase !== "flipping" && this.#phase !== "reverting",
        });
    }

    subscribe(listener) {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }

    #setPhase(phase, detail = {}) {
        this.#phase = phase;
        const state = Object.freeze({ ...this.getState(), ...detail });
        for (const listener of this.#listeners) listener(state);
    }

    cancel() {
        this.#activeAbortController?.abort();
    }

    async bounce({ preBouncePatchDocument, captureRequest = {} } = {}) {
        if (this.#activeAbortController !== null) {
            throw new BounceTransitionError("busy", "A Bounce transaction is already active");
        }
        const previousDocument = parseBouncePatchDocument(preBouncePatchDocument);
        const abortController = new AbortController();
        const externalSignal = captureRequest.signal;
        const forwardAbort = () => abortController.abort();
        externalSignal?.addEventListener("abort", forwardAbort, { once: true });
        this.#activeAbortController = abortController;
        let stagedInstall = null;
        let flipped = false;

        try {
            this.#setPhase("capturing", { completedRoots: 0 });
            let capture;
            try {
                capture = await this.#capture({
                    ...captureRequest,
                    signal: abortController.signal,
                    onProgress: (progress) => {
                        this.#setPhase("capturing", progress);
                        captureRequest.onProgress?.(progress);
                    },
                });
            } catch (cause) {
                throw stageError("capture", cause);
            }
            throwIfAborted(abortController.signal);

            this.#setPhase("validating");
            if (!(capture?.bytes instanceof Uint8Array) || typeof capture.digest !== "string") {
                throw new BounceTransitionError("bad-digest", "Bounce capture did not return bank bytes and a digest");
            }
            const actualDigest = await digestBounceBank(capture.bytes);
            if (actualDigest !== capture.digest) {
                throw new BounceTransitionError(
                    "bad-digest",
                    `Bounce digest mismatch: expected ${capture.digest}, received ${actualDigest}`,
                );
            }
            const bounceDocument = createBounceDocument(capture, previousDocument);

            throwIfAborted(abortController.signal);
            this.#setPhase("persisting");
            try {
                await this.#persistBank(capture, { signal: abortController.signal });
            } catch (cause) {
                throw stageError("persist", cause);
            }

            throwIfAborted(abortController.signal);
            this.#setPhase("installing", { completedFrames: 0, totalFrames: capture.bank.totalFrameCount });
            try {
                stagedInstall = await this.#stageBankInstall(capture.bank, {
                    digest: capture.digest,
                    generation: bounceDocument.generation,
                    signal: abortController.signal,
                    onProgress: (progress) => this.#setPhase("installing", progress),
                });
            } catch (cause) {
                throw stageError("install", cause);
            }
            if (!stagedInstall || typeof stagedInstall.commit !== "function"
                || typeof stagedInstall.abort !== "function") {
                throw new BounceTransitionError("install-failed", "Bank installer returned no staged transaction");
            }

            throwIfAborted(abortController.signal);
            this.#setPhase("verifying");
            try {
                await this.#verifyCapture(capture, { signal: abortController.signal });
            } catch (cause) {
                throw stageError("verify", cause);
            }
            throwIfAborted(abortController.signal);

            const neutralDocument = createNeutralBouncePatchDocument(previousDocument);
            const nextDocument = attachBounceDocument(neutralDocument, bounceDocument);
            this.#setPhase("flipping");
            let documentApplied = false;
            try {
                await stagedInstall.commit(() => {
                    const result = this.#applyPatchDocument(nextDocument);
                    documentApplied = true;
                    return result;
                });
                flipped = true;
            } catch (cause) {
                if (documentApplied) {
                    try {
                        await this.#applyPatchDocument(previousDocument);
                    } catch {
                        // Preserve the primary failure. The caller receives a
                        // flip failure and can surface the recovery action.
                    }
                }
                throw stageError("flip", cause);
            }

            this.#setPhase("complete");
            return Object.freeze({ capture, bounceDocument, patchDocument: nextDocument });
        } finally {
            if (stagedInstall !== null && !flipped) {
                try {
                    await stagedInstall.abort();
                } catch {
                    // The inactive candidate is already inaudible. Timeout
                    // recovery on a new session will discard its identity.
                }
            }
            externalSignal?.removeEventListener("abort", forwardAbort);
            this.#activeAbortController = null;
            // Publish the settled busy=false state even after success. The
            // earlier complete notification occurs while the transaction's
            // abort controller still owns cleanup.
            this.#setPhase(this.#phase === "complete" ? "complete" : "idle");
        }
    }

    async revert(currentPatchDocumentInput) {
        if (this.#activeAbortController !== null) {
            throw new BounceTransitionError("busy", "A Bounce transaction is already active");
        }
        const currentPatchDocument = parseBouncePatchDocument(currentPatchDocumentInput);
        const bounceDocument = readBounceDocumentFromPatch(currentPatchDocument);
        if (bounceDocument === null) {
            throw new BounceTransitionError("no-revert", "The current patch has no Bounce revert reference");
        }
        const previousDocument = bounceDocument.revertRef.patchDocument;
        const previousBankDigest = bounceDocument.revertRef.bankDigest;
        const abortController = new AbortController();
        this.#activeAbortController = abortController;
        let stagedInstall = null;
        let committed = false;
        this.#setPhase("reverting");
        try {
            if (previousBankDigest !== null) {
                if (typeof this.#readBankByDigest !== "function") {
                    throw new BounceTransitionError(
                        "missing-revert-bank",
                        `Cannot restore previous Bounce bank ${previousBankDigest}`,
                    );
                }
                const bank = await this.#readBankByDigest(previousBankDigest);
                if (!bank) {
                    throw new BounceTransitionError(
                        "missing-revert-bank",
                        `Previous Bounce bank ${previousBankDigest} is unavailable`,
                    );
                }
                stagedInstall = await this.#stageBankInstall(bank, {
                    digest: previousBankDigest,
                    generation: bounceDocument.generation + 1,
                    signal: abortController.signal,
                });
                await stagedInstall.commit(() => this.#applyPatchDocument(previousDocument));
                committed = true;
            } else {
                await this.#applyPatchDocument(previousDocument);
            }
            this.#setPhase("complete");
            return previousDocument;
        } catch (cause) {
            throw stageError("revert", cause);
        } finally {
            if (stagedInstall !== null && !committed) {
                try { await stagedInstall.abort(); } catch { /* inactive candidate only */ }
            }
            this.#activeAbortController = null;
            this.#setPhase(this.#phase === "complete" ? "complete" : "idle");
        }
    }
}
