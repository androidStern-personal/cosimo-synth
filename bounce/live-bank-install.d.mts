import type { PatchConnectionLike } from "../kit/ui/cmajor-react";

/** Current sample-rate, tempo, and engine-session identity. */
export type BounceEngineStatus = {
    readonly dspSessionId: number;
    readonly sampleRateHz: number;
    readonly tempoBpm: number;
};

/** Progress reported while acknowledged PCM batches are uploaded. */
export type BounceBankInstallProgress = {
    readonly completedFrames: number;
    readonly totalFrames: number;
};

/** Acknowledgement emitted after one bank upload message. */
export type BounceBankUploadAcknowledgement = {
    readonly dspSessionId: number;
    readonly generation: number;
    readonly deliverySerial: number;
    readonly frameIndexBase: number;
    readonly frameCount: number;
    readonly receivedFrameCount: number;
};

/** Complete DSP slot state used to verify staging and publication. */
export type BounceBankRuntimeState = {
    readonly dspSessionId: number;
    readonly hasActive: number;
    readonly activeGeneration: number;
    readonly activeRootCount: number;
    readonly activeFrameCount: number;
    readonly hasStaging: number;
    readonly stagingGeneration: number;
    readonly stagingReceivedFrameCount: number;
    readonly stagingExpectedFrameCount: number;
    readonly rejectedDeliverySerial: number;
    readonly rejectionReason: number;
};

/** Staged bank transaction that remains inaudible until commit. */
export type StagedBounceBankInstall = {
    readonly generation: number;
    commit(applyPatchDocument?: () => unknown | Promise<unknown>): Promise<void>;
    abort(): Promise<void>;
};

/** Upload-ack endpoint identifier. */
export const BOUNCE_BANK_ACK_ENDPOINT_ID: "bounceBankUploadAck";
/** Runtime bank-state endpoint identifier. */
export const BOUNCE_BANK_STATE_ENDPOINT_ID: "bounceBankRuntimeState";
/** Engine-status endpoint identifier. */
export const BOUNCE_ENGINE_STATUS_ENDPOINT_ID: "engineStatus";
/** Engine-status request endpoint identifier. */
export const BOUNCE_ENGINE_STATUS_REQUEST_ENDPOINT_ID: "engineStatusRequest";
/** PatchConnection send timeout used for non-blocking event writes. */
export const BOUNCE_INSTALL_SEND_TIMEOUT_MS: 0;
/** Health timeout for each acknowledged install stage. */
export const BOUNCE_INSTALL_HEALTH_TIMEOUT_MS: 8_000;

/** Typed failure raised by live bank installation. */
export class BounceBankInstallError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}

/** Allocate a monotonically increasing generation local to one engine session. */
export function allocateBounceRuntimeGeneration(
    connection: PatchConnectionLike,
    minimum?: number,
): number;

/** Request and parse the live engine's current runtime status. */
export function requestBounceEngineStatus(
    connection: PatchConnectionLike,
    options?: {
        readonly timeoutMilliseconds?: number;
        readonly signal?: AbortSignal;
    },
): Promise<BounceEngineStatus>;

/** Upload a validated bank to the inactive DSP slot without publishing it. */
export function stageBounceBankInstall(
    connection: PatchConnectionLike,
    bank: unknown,
    options: {
        readonly dspSessionId: number;
        readonly generation: number;
        readonly firstDeliverySerial?: number;
        readonly timeoutMilliseconds?: number;
        readonly signal?: AbortSignal;
        readonly onProgress?: (progress: BounceBankInstallProgress) => void;
    },
): Promise<StagedBounceBankInstall>;

/** Focused payload parsers exposed for the plain-Node install tests. */
export const bounceLiveInstallInternals: Readonly<{
    normalizeAck(value: unknown): BounceBankUploadAcknowledgement | null;
    normalizeEngineStatus(value: unknown): BounceEngineStatus | null;
    normalizeState(value: unknown): BounceBankRuntimeState | null;
}>;
