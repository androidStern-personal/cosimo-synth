/** Structured-clone values accepted by the Bounce worker recipe. */
export type BounceWireValue =
    | null
    | boolean
    | string
    | number
    | ArrayBuffer
    | Exclude<ArrayBufferView<ArrayBufferLike>, DataView<ArrayBufferLike>>
    | ReadonlyArray<BounceWireValue>
    | { readonly [key: string]: BounceWireValue };

/** One value endpoint captured for offline rendering. */
export type BounceCaptureParameter = {
    readonly endpointID: string;
    readonly value: BounceWireValue;
};

/** One runtime event captured for offline rendering. */
export type BounceSetupEvent = {
    readonly endpointID: string;
    readonly value: BounceWireValue;
    readonly advanceFrames: number;
    readonly sessionScoped: boolean;
};

/** A setup event whose note field is filled from the current root job. */
export type BounceRootSetupEvent = BounceSetupEvent & {
    readonly rootNoteField: string;
};

/** Immutable state captured at the instant Bounce begins. */
export type BounceCaptureSnapshot = {
    readonly format: "cosimo.bounce-capture-snapshot";
    readonly version: 1;
    readonly sampleRate: number;
    readonly tempoBpm: number;
    readonly parameters: ReadonlyArray<BounceCaptureParameter>;
    readonly setupEvents: ReadonlyArray<BounceSetupEvent>;
    readonly rootSetupEvents: ReadonlyArray<BounceRootSetupEvent>;
    readonly settleFrames: number;
    readonly sourceGeneration: number;
    readonly sourceBankDigest: string | null;
};

/** One independently rendered root in a Bounce capture plan. */
export type BounceCaptureJob = {
    readonly rootIndex: number;
    readonly rootNote: number;
    readonly sessionID: number;
};

/** Deterministic work plan shared by browser and Node render drivers. */
export type BounceCapturePlan = {
    readonly format: "cosimo.bounce-capture-plan";
    readonly version: 1;
    readonly snapshot: BounceCaptureSnapshot;
    readonly roots: ReadonlyArray<number>;
    readonly captureVelocity: number;
    readonly holdFrames: number;
    readonly tailCapFrames: number;
    readonly silenceThresholdLinear: number;
    readonly silenceWindowFrames: number;
    readonly tailPaddingFrames: number;
    readonly blockFrames: number;
    readonly jobs: ReadonlyArray<BounceCaptureJob>;
};

/** Timing and performer-memory evidence for one rendered root. */
export type BounceRootRenderMetrics = {
    readonly renderedFrameCount: number;
    readonly elapsedMilliseconds: number;
    readonly realtimeMultiplier: number | null;
    readonly wasmMemoryPages: number | null;
};

/** PCM and metrics returned by one short-lived Bounce worker. */
export type BounceRenderedRoot = {
    readonly rootIndex: number;
    readonly rootNote: number;
    readonly noteOffFrameOffset: number;
    readonly frameCount: number;
    readonly tailFrameCount: number;
    readonly peak: number;
    readonly samples: Int16Array<ArrayBuffer>;
    readonly metrics: BounceRootRenderMetrics;
};

/** Input shape accepted for an ordinary setup event. */
export type BounceSetupEventInput = {
    readonly endpointID: string;
    /** Parsed into BounceWireValue by createBounceCaptureSnapshot. */
    readonly value: unknown;
    readonly advanceFrames?: number;
    readonly sessionScoped?: boolean;
};

/** Input shape accepted for a root-scoped setup event. */
export type BounceRootSetupEventInput = BounceSetupEventInput & {
    readonly rootNoteField: string;
};

/** Options controlling deterministic capture-plan construction. */
export type BounceCapturePlanOptions = {
    readonly roots?: ReadonlyArray<number>;
    readonly holdSeconds?: number;
    readonly tailCapSeconds?: number;
    readonly captureVelocity?: number;
    readonly blockFrames?: number;
};

/** Capture-snapshot wire-format identifier. */
export const BOUNCE_CAPTURE_SNAPSHOT_FORMAT: "cosimo.bounce-capture-snapshot";
/** Capture-snapshot wire-format version. */
export const BOUNCE_CAPTURE_SNAPSHOT_VERSION: 1;
/** Capture-plan wire-format identifier. */
export const BOUNCE_CAPTURE_PLAN_FORMAT: "cosimo.bounce-capture-plan";
/** Capture-plan wire-format version. */
export const BOUNCE_CAPTURE_PLAN_VERSION: 1;
/** Default MIDI roots sampled by Bounce. */
export const BOUNCE_DEFAULT_ROOTS: ReadonlyArray<number>;
/** Fixed MIDI velocity used by the V1 capture contract. */
export const BOUNCE_CAPTURE_VELOCITY: 100;
/** Default note hold duration in seconds. */
export const BOUNCE_DEFAULT_HOLD_SECONDS: 3;
/** Maximum default tail duration in seconds. */
export const BOUNCE_DEFAULT_TAIL_CAP_SECONDS: 6;
/** Silence threshold in decibels relative to full scale. */
export const BOUNCE_SILENCE_THRESHOLD_DBFS: -80;
/** Linear silence threshold derived from the dBFS contract. */
export const BOUNCE_SILENCE_THRESHOLD_LINEAR: number;
/** Silence-analysis window in seconds. */
export const BOUNCE_SILENCE_WINDOW_SECONDS: 0.05;
/** Padding retained after the last active tail frame. */
export const BOUNCE_TAIL_PADDING_SECONDS: 0.1;
/** Maximum offline render block size. */
export const BOUNCE_OFFLINE_BLOCK_FRAMES: 128;

/** Clone and normalize a press-time capture recipe. */
export function createBounceCaptureSnapshot(options: {
    readonly sampleRate: number;
    readonly tempoBpm?: number;
    readonly parameters?: Readonly<Record<string, BounceWireValue>>
        | ReadonlyArray<BounceCaptureParameter>;
    readonly setupEvents?: ReadonlyArray<BounceSetupEventInput>;
    readonly rootSetupEvents?: ReadonlyArray<BounceRootSetupEventInput>;
    readonly settleFrames?: number;
    readonly sourceGeneration?: number;
    readonly sourceBankDigest?: string | null;
}): BounceCaptureSnapshot;

/** Parse an unknown structured-clone payload into a capture snapshot. */
export function validateBounceCaptureSnapshot(snapshot: unknown): BounceCaptureSnapshot;

/** Build the deterministic work list consumed by all Bounce render drivers. */
export function createBounceCapturePlan(
    snapshot: unknown,
    options?: BounceCapturePlanOptions,
): BounceCapturePlan;

/** Parse an unknown structured-clone payload into a capture plan. */
export function validateBounceCapturePlan(plan: unknown): BounceCapturePlan;
