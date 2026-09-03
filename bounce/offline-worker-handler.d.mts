import type { BounceRenderedRoot } from "./capture-plan.mjs";

/** Successful reply emitted by the browser Bounce render worker. */
export type BounceRenderWorkerResponse = {
    readonly type: "render-root-complete";
    readonly requestID: string;
    readonly result: BounceRenderedRoot;
};

/** Structured-clone error projection emitted by a Bounce render worker. */
export type SerializedBounceWorkerError = {
    readonly name: string;
    readonly message: string;
    readonly stack: string | undefined;
};

/** Parse and execute one browser-worker render request. */
export function handleBounceRenderRequest(
    message: unknown,
    baseURL: string | URL,
): Promise<BounceRenderWorkerResponse>;

/** Project an unknown thrown value into a structured-clone error record. */
export function serializeBounceWorkerError(cause: unknown): SerializedBounceWorkerError;
