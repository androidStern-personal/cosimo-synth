/** Minimum bank projection needed to render a waveform. */
export type BounceWaveformBank = {
    readonly roots: ReadonlyArray<{
        readonly note: number;
        readonly frameOffset: number;
        readonly frameCount: number;
    }>;
    readonly pcm: Int16Array;
};

/** One min/max column in a peak-preserving waveform envelope. */
export type BounceWaveformColumn = {
    readonly minimum: number;
    readonly maximum: number;
};

/** Compact waveform projection for one nearest bank root. */
export type BounceWaveformEnvelope = {
    readonly rootIndex: number;
    readonly rootNote: number;
    readonly frameCount: number;
    readonly columns: ReadonlyArray<BounceWaveformColumn>;
};

/** Find the bank root nearest a requested MIDI note. */
export function nearestBounceRootIndex(bank: BounceWaveformBank, note?: number): number;

/** Build a peak-preserving stereo envelope for a compact PCM scope. */
export function createBounceWaveformEnvelope(
    bank: BounceWaveformBank,
    options?: {
        readonly note?: number;
        readonly columnCount?: number;
    },
): BounceWaveformEnvelope;
