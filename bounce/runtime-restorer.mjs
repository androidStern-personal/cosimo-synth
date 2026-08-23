import { decodeBounceBank } from "./bank-format.mjs";
import { BOUNCE_STATE_KEY, parseBounceDocument } from "./document.mjs";
import {
    allocateBounceRuntimeGeneration,
    requestBounceEngineStatus,
    stageBounceBankInstall,
} from "./live-bank-install.mjs";

export class BounceRestoreError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "BounceRestoreError";
        this.code = code;
    }
}

function matchesDocument(bank, document) {
    return bank.sampleRate === document.capture.sampleRate
        && bank.roots.length === document.roots.length
        && bank.roots.every((root, index) => (
            root.note === document.roots[index]
            && root.frameOffset === document.segments[index].frameOffset
            && root.frameCount === document.segments[index].frameCount
        ));
}

function restoreError(cause) {
    if (cause instanceof BounceRestoreError) return cause;
    const detail = cause instanceof Error ? cause.message : String(cause);
    const code = typeof cause?.code === "string" ? cause.code : "restore-failed";
    return new BounceRestoreError(code, `Could not restore bounced source: ${detail}`, { cause });
}

/** Load a referenced bank before exposing sampled mode after boot/preset load. */
export class BounceRuntimeRestorer {
    #connection;
    #store;
    #sendRuntimeSourceMode;
    #statusRequest;
    #stageInstall;
    #listeners = new Set();
    #abortController = null;
    #started = false;
    #state = Object.freeze({ status: "idle", digest: null, error: null });
    #handleStoredStateBound = this.#handleStoredState.bind(this);

    constructor({
        connection,
        store,
        sendRuntimeSourceMode = (value) => connection.sendEventOrValue("sourceMode", value, 0, 0),
        statusRequest = requestBounceEngineStatus,
        stageInstall = stageBounceBankInstall,
    } = {}) {
        if (!connection || typeof connection.sendEventOrValue !== "function") {
            throw new TypeError("Bounce restorer requires a patch connection");
        }
        if (!store || typeof store.get !== "function") {
            throw new TypeError("Bounce restorer requires a bank store");
        }
        this.#connection = connection;
        this.#store = store;
        this.#sendRuntimeSourceMode = sendRuntimeSourceMode;
        this.#statusRequest = statusRequest;
        this.#stageInstall = stageInstall;
    }

    getState() { return this.#state; }

    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #setState(state) {
        this.#state = Object.freeze(state);
        for (const listener of this.#listeners) listener(this.#state);
    }

    start() {
        if (this.#started) return;
        this.#started = true;
        this.#connection.addStoredStateValueListener?.(this.#handleStoredStateBound);
    }

    stop() {
        if (!this.#started) return;
        this.#started = false;
        this.#connection.removeStoredStateValueListener?.(this.#handleStoredStateBound);
        this.#abortController?.abort();
    }

    /**
     * A live Bounce transaction has already persisted, staged, verified, and
     * atomically published this exact bank. Mark it ready before bounce.v1 is
     * broadcast so this reload/preset observer does not race a second upload.
     */
    acceptCommittedDocument(value) {
        const document = parseBounceDocument(value);
        this.#abortController?.abort();
        this.#abortController = null;
        this.#setState({
            status: "ready",
            digest: document.digest,
            error: null,
            sampleRate: document.capture.sampleRate,
            rootCount: document.roots.length,
        });
        return this.#state;
    }

    #handleStoredState(message) {
        const payload = message?.event ?? message;
        if (payload?.key !== BOUNCE_STATE_KEY) return;
        void this.restore(payload.value);
    }

    async restore(value) {
        this.#abortController?.abort();
        const abortController = new AbortController();
        this.#abortController = abortController;
        let staged = null;
        let committed = false;

        if (value === null || value === undefined || value === "") {
            this.#sendRuntimeSourceMode(0);
            this.#setState({ status: "oscillator", digest: null, error: null });
            this.#abortController = null;
            return this.#state;
        }

        let document;
        try {
            document = parseBounceDocument(value);
        } catch (cause) {
            const error = new BounceRestoreError(
                "invalid-document",
                `The saved Bounce reference is invalid: ${cause instanceof Error ? cause.message : cause}`,
                { cause },
            );
            this.#sendRuntimeSourceMode(0);
            this.#setState({ status: "error", digest: null, error });
            this.#abortController = null;
            return this.#state;
        }

        if (this.#state.status === "ready" && this.#state.digest === document.digest) {
            this.#abortController = null;
            return this.#state;
        }

        this.#setState({ status: "loading", digest: document.digest, error: null });
        try {
            const bytes = await this.#store.get(document.digest);
            if (bytes === null) {
                throw new BounceRestoreError(
                    "missing-bank",
                    `Bounce bank ${document.digest} is missing from this browser. Revert or restore the bank file.`,
                );
            }
            if (bytes.byteLength !== document.bankByteLength) {
                throw new BounceRestoreError(
                    "byte-length-mismatch",
                    `Bounce bank ${document.digest} has ${bytes.byteLength} bytes; bounce.v1 requires ${document.bankByteLength}`,
                );
            }
            if (abortController.signal.aborted) throw new DOMException("Restore superseded", "AbortError");
            const bank = decodeBounceBank(bytes);
            if (!matchesDocument(bank, document)) {
                throw new BounceRestoreError(
                    "metadata-mismatch",
                    `Bounce bank ${document.digest} does not match bounce.v1 segment metadata`,
                );
            }
            const engineStatus = await this.#statusRequest(this.#connection, {
                signal: abortController.signal,
            });
            staged = await this.#stageInstall(this.#connection, bank, {
                dspSessionId: engineStatus.dspSessionId,
                generation: allocateBounceRuntimeGeneration(this.#connection, document.generation),
                signal: abortController.signal,
            });
            await staged.commit(() => this.#sendRuntimeSourceMode(1));
            committed = true;
            this.#setState({
                status: "ready",
                digest: document.digest,
                error: null,
                sampleRate: bank.sampleRate,
                rootCount: bank.roots.length,
            });
        } catch (cause) {
            if (cause?.name === "AbortError") {
                return this.#state;
            }
            const error = restoreError(cause);
            // Use the unwrapped runtime sender supplied by browser persistence:
            // this safety fallback must not erase the durable sampled intent.
            this.#sendRuntimeSourceMode(0);
            this.#setState({ status: "error", digest: document.digest, error });
        } finally {
            if (staged !== null && !committed) {
                try { await staged.abort(); } catch { /* inactive candidate */ }
            }
            if (this.#abortController === abortController) this.#abortController = null;
        }
        return this.#state;
    }
}

export function createBounceRuntimeRestorer(options) {
    return new BounceRuntimeRestorer(options);
}
