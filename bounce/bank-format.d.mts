/** One root's location inside an interleaved stereo Bounce bank. */
export type BounceBankRoot = {
    readonly note: number;
    readonly frameOffset: number;
    readonly frameCount: number;
    readonly noteOffFrameOffset: number;
};

/** Validated in-memory Bounce bank. */
export type BounceBank = {
    readonly version: 1;
    readonly sampleRate: number;
    readonly roots: ReadonlyArray<BounceBankRoot>;
    readonly totalFrameCount: number;
    readonly pcm: Int16Array;
};

/** Decoded bank with its Cmajor-ready packed frame view. */
export type DecodedBounceBank = BounceBank & {
    readonly packedFrames: Int32Array;
};

/** Binary sources accepted by the bank decoder. */
export type BounceBankBytes = ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

/** Current bank wire-format version. */
export const BOUNCE_BANK_VERSION: 1;
/** Maximum number of roots admitted by one bank. */
export const BOUNCE_BANK_MAX_ROOTS: 19;
/** Maximum stereo-frame capacity of one live DSP slot. */
export const BOUNCE_BANK_FRAME_CAPACITY: 5_472_000;

/** Quantize a floating-point sample into signed 16-bit PCM. */
export function quantizeFloatToInt16(sample: number): number;

/** Build a validated bank from ordered, interleaved root PCM. */
export function buildBounceBank(options: {
    readonly sampleRate: number;
    readonly roots: ReadonlyArray<{
        readonly note: number;
        readonly samples: Int16Array;
        readonly noteOffFrameOffset?: number;
    }>;
}): BounceBank;

/** Encode a validated bank into the CSBNK001 binary format. */
export function encodeBounceBank(bank: BounceBank): Uint8Array<ArrayBuffer>;

/** Parse bank bytes and return validated metadata plus PCM views. */
export function decodeBounceBank(value: BounceBankBytes): DecodedBounceBank;
