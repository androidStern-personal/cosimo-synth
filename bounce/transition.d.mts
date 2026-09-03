import type { BounceBank } from "./bank-format.mjs";
import type {
    BounceCaptureRequest,
    BounceCaptureResult,
} from "./capture.mjs";
import type {
    BounceDocument,
    BouncePatchDocument,
} from "./document.mjs";
import type {
    BounceBankInstallProgress,
    StagedBounceBankInstall,
} from "./live-bank-install.mjs";

/** Observable phases of the two-stage Bounce transaction. */
export type BounceTransitionPhase =
    | "idle"
    | "capturing"
    | "validating"
    | "persisting"
    | "installing"
    | "verifying"
    | "flipping"
    | "reverting"
    | "complete";

/** Public coordinator state emitted at transition boundaries. */
export type BounceTransitionState = {
    readonly phase: BounceTransitionPhase;
    readonly busy: boolean;
    readonly cancellable: boolean;
    readonly completedRoots?: number;
    readonly totalRoots?: number;
    readonly rootNote?: number;
    readonly completedFrames?: number;
    readonly totalFrames?: number;
};

/** Dependencies supplied by the browser controller to the transaction core. */
export type BounceTransitionDependencies = {
    readonly capture: (request: BounceCaptureRequest) => Promise<BounceCaptureResult>;
    readonly persistBank: (
        capture: BounceCaptureResult,
        options: { readonly signal: AbortSignal },
    ) => Promise<unknown>;
    readonly stageBankInstall: (
        bank: BounceBank,
        options: {
            readonly digest: string;
            readonly generation: number;
            readonly signal: AbortSignal;
            readonly onProgress?: (progress: BounceBankInstallProgress) => void;
        },
    ) => Promise<StagedBounceBankInstall>;
    readonly verifyCapture: (
        capture: BounceCaptureResult,
        options: { readonly signal: AbortSignal },
    ) => void | Promise<void>;
    readonly applyPatchDocument: (
        document: BouncePatchDocument,
    ) => unknown | Promise<unknown>;
    readonly readBankByDigest?: ((digest: string) => Promise<BounceBank | null>) | null;
};

/** Successful Bounce transaction output. */
export type BounceTransitionResult = {
    readonly capture: BounceCaptureResult;
    readonly bounceDocument: BounceDocument;
    readonly patchDocument: BouncePatchDocument;
};

/** Typed failure raised by a Bounce transaction stage. */
export class BounceTransitionError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}

/** Two-stage coordinator that publishes only after capture and install verify. */
export class BounceTransitionCoordinator {
    constructor(dependencies: BounceTransitionDependencies);
    getState(): BounceTransitionState;
    subscribe(listener: (state: BounceTransitionState) => void): () => void;
    cancel(): void;
    bounce(input: {
        readonly preBouncePatchDocument: unknown;
        readonly captureRequest: BounceCaptureRequest;
    }): Promise<BounceTransitionResult>;
    revert(currentPatchDocument: unknown): Promise<BouncePatchDocument>;
}
