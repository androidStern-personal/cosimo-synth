import type { BounceBank } from "./bank-format.mjs";
import type {
    BounceCapturePlan,
    BounceCapturePlanOptions,
    BounceCaptureSnapshot,
    BounceRenderedRoot,
    BounceRootRenderMetrics,
} from "./capture-plan.mjs";
import type { OfflineWorkerLike } from "./worker-pool.mjs";

/** Persisted root range plus renderer-only tail evidence. */
export type BounceCaptureSegment = {
    readonly rootNote: number;
    readonly frameOffset: number;
    readonly frameCount: number;
    readonly noteOffFrameOffset: number;
    readonly tailFrameCount: number;
};

/** Metrics retained for one root after capture assembly. */
export type BounceCaptureMetrics = BounceRootRenderMetrics & {
    readonly rootNote: number;
};

/** Complete verified result of a Bounce worker capture. */
export type BounceCaptureResult = {
    readonly plan: BounceCapturePlan;
    readonly bank: BounceBank;
    readonly bytes: Uint8Array<ArrayBuffer>;
    readonly digest: string;
    readonly segments: ReadonlyArray<BounceCaptureSegment>;
    readonly metrics: ReadonlyArray<BounceCaptureMetrics>;
};

/** Caller-supplied capture options before browser-specific worker URLs are added. */
export type BounceCaptureRequest = {
    readonly snapshot: BounceCaptureSnapshot;
    readonly planOptions?: BounceCapturePlanOptions;
    readonly workerFactory?: (
        url: string | URL,
        job: BounceCapturePlan["jobs"][number],
    ) => OfflineWorkerLike;
    readonly concurrency?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: {
        readonly completedRoots: number;
        readonly totalRoots: number;
        readonly rootNote: number;
    }) => void;
};

/** Full capture options at the browser/worker boundary. */
export type CaptureBounceBankOptions = BounceCaptureRequest & {
    readonly workerURL: string | URL;
    readonly engineModuleURL: string | URL;
    readonly renderPlan?: (options: {
        readonly plan: BounceCapturePlan;
        readonly workerURL: string | URL;
        readonly engineModuleURL: string | URL;
        readonly workerFactory?: BounceCaptureRequest["workerFactory"];
        readonly concurrency?: number;
        readonly signal?: AbortSignal;
        readonly onProgress?: BounceCaptureRequest["onProgress"];
    }) => Promise<ReadonlyArray<BounceRenderedRoot>>;
};

/** Snapshot, render, assemble, encode, and digest one Bounce bank. */
export function captureBounceBank(options: CaptureBounceBankOptions): Promise<BounceCaptureResult>;

/** Digest bank bytes using the platform SHA-256 implementation. */
export function digestBounceBank(bytes: Uint8Array): Promise<string>;
