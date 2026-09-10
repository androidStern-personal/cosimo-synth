/** A prepared engine update's identity, independent of GUI lifetime. */
export type EngineTarget = {
    readonly scope: { readonly owner: string; readonly document: number };
    readonly key: string;
    readonly generation: number;
};

/** Transport evidence never equates a completed send call with DSP application. */
export type EngineEvidence =
    | { readonly kind: "sent"; readonly proof: "connection-call-returned" }
    | { readonly kind: "acknowledged"; readonly engineSession: string; readonly operation: string };

/** Expected preparation/delivery failures carry a safe, caller-facing message. */
export type EngineFailure = {
    readonly kind: "resource" | "transport" | "engine-rejected" | "defect";
    readonly message: string;
};

/** Current progress for a requested engine update. */
export type EngineApplication =
    | { readonly kind: "preparing" }
    | EngineEvidence
    | { readonly kind: "failed"; readonly error: EngineFailure };

/** Preparation is independent of React and returns expected failures as values. */
export type Prepared<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "error"; readonly error: EngineFailure };

/** A cancelled job is neither a failed engine install nor an acknowledgement. */
export type EngineOutcome = EngineEvidence
    | { readonly kind: "failed"; readonly error: EngineFailure }
    | { readonly kind: "cancelled" };

/** Portable cancellation for native QuickJS as well as browser preparation. */
export interface EngineCancellation {
    readonly aborted: boolean;
    /** Release a pending read/wait. Returns removal; callbacks must not throw. */
    onAbort(listener: () => void): () => void;
}

/** Guard the final synchronous handoff, after any transport readiness waits. */
export interface SendPermit {
    readonly signal: EngineCancellation;
    send(action: () => EngineOutcome): EngineOutcome;
}

/** A pluggable engine transport owns its protocol and actual application evidence. */
export interface EngineTransport<T> {
    apply(payload: T, permit: SendPermit): Promise<EngineOutcome>;
    /** Release protocol resources; must not throw. */
    stop(): void;
}

/** Dependencies for one preparation/application lifetime. onStatus must not throw. */
export type EngineBindingOptions<I, P> = {
    readonly prepare: (input: I, signal: EngineCancellation) => Prepared<P> | Promise<Prepared<P>>;
    readonly transport: EngineTransport<P>;
    readonly onStatus: (target: EngineTarget, status: EngineApplication) => void;
    /** Retain unexpected diagnostic causes; this callback must not throw. */
    readonly onDefect: (error: unknown) => void;
};

type AwaitedJob<T> = { readonly kind: "value"; readonly value: T } | { readonly kind: "cancelled" };

function cancellationScope() {
    let aborted = false;
    const listeners = new Set<() => void>();
    const signal: EngineCancellation = {
        get aborted() { return aborted; },
        onAbort(listener) {
            if (aborted) listener();
            else listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
    return {
        signal,
        cancel() {
            if (aborted) return;
            aborted = true;
            const pending = [...listeners];
            listeners.clear();
            for (const listener of pending) listener();
        },
    };
}

// Cancelling releases our task even if an external operation ignores the signal.
// The attached rejection handler still consumes that operation's late rejection.
function whileActive<T>(operation: T | Promise<T>, signal: EngineCancellation): Promise<AwaitedJob<T>> {
    return new Promise((resolve, reject) => {
        const remove = signal.onAbort(() => resolve({ kind: "cancelled" }));
        Promise.resolve(operation).then(value => {
            remove();
            resolve(signal.aborted ? { kind: "cancelled" } : { kind: "value", value });
        }, error => {
            remove();
            if (signal.aborted) resolve({ kind: "cancelled" });
            else reject(error);
        });
    });
}

/** Owns preparing and applying the latest requested value; no editable history. */
export function createEngineBinding<I, P>(options: EngineBindingOptions<I, P>) {
    let stopped = false;
    let current: ReturnType<typeof cancellationScope> | undefined;
    const tasks = new Set<Promise<void>>();
    async function apply(input: I, target: EngineTarget, signal: EngineCancellation) {
        options.onStatus(target, { kind: "preparing" });
        if (signal.aborted) return;
        const preparation = await whileActive(options.prepare(input, signal), signal);
        if (preparation.kind === "cancelled" || signal.aborted) return;
        const prepared = preparation.value;
        if (prepared.kind === "error") {
            options.onStatus(target, { kind: "failed", error: prepared.error });
            return;
        }
        let sending = true;
        let delivery: AwaitedJob<EngineOutcome>;
        try {
            delivery = await whileActive(options.transport.apply(prepared.value, {
                signal,
                send: action => signal.aborted || !sending ? { kind: "cancelled" } : action(),
            }), signal);
        } catch (error) {
            if (!signal.aborted) {
                stopped = true;
                current?.cancel();
                options.transport.stop();
                options.onDefect(error);
                options.onStatus(target, {
                    kind: "failed", error: { kind: "defect", message: "Engine transport failed unexpectedly." },
                });
            }
            return;
        } finally { sending = false; }
        if (delivery.kind === "value" && !signal.aborted && delivery.value.kind !== "cancelled") {
            options.onStatus(target, delivery.value);
        }
    }
    return {
        /** Supersede previous work immediately; ignored after stop or a transport defect. */
        replace(input: I, target: EngineTarget): void {
            if (stopped) return;
            const previous = current;
            const scope = cancellationScope();
            current = scope;
            previous?.cancel();
            if (stopped || scope.signal.aborted) return;
            const running = apply(input, target, scope.signal).catch(error => {
                if (scope.signal.aborted) return;
                scope.cancel();
                options.onDefect(error);
                options.onStatus(target, {
                    kind: "failed", error: { kind: "defect", message: "Engine update failed unexpectedly." },
                });
            });
            tasks.add(running);
            void running.then(() => { tasks.delete(running); });
        },
        /** Revoke the current request, retaining the transport for a later replacement. */
        cancel(): void { current?.cancel(); },
        /** Close permanently and settle owned work without waiting for uncooperative external promises. */
        async stop(): Promise<void> {
            if (!stopped) {
                stopped = true;
                current?.cancel();
                options.transport.stop();
            }
            await Promise.all(tasks);
        },
    };
}
