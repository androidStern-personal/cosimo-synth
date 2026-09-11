import type { SharedDataDestination } from "../../kit/ui/prepared-shared-data";
import { buildMipFrameFromSpectrum, DEFAULT_MIP_LEVEL_COUNT } from "./wavetable-mip";

// Cosimo's renderer layout, shared with RendererBridge.h. This packing belongs
// to the instrument; allocation, publication and retirement belong to the kit.
const frameCapacity = 256;
const samplesPerFrame = 2048;
const headerWords = 8;
const packedWordsPerFrameSet = 12811;
export const PACKED_WAVETABLE_BYTES = (headerWords + frameCapacity * packedWordsPerFrameSet) * 4;

type Spectrum = Parameters<typeof buildMipFrameFromSpectrum>[0];

function quantise(value: number, inverseScale: number, maximum: number): number {
    // Preserve the old Cmajor float32 arithmetic and truncation, including
    // negative rounding. JS bitwise operations preserve all 32 packed bits.
    const scaled = Math.fround(value * inverseScale);
    return Math.max(-maximum, Math.min(maximum,
        Math.trunc(Math.fround(scaled + (scaled >= 0 ? 0.5 : -0.5)))));
}

/** Writes Cosimo's final packed mips directly into an unpublished allocation. */
export function preparePackedWavetable(
    destination: SharedDataDestination,
    table: {
        readonly dspSessionId: number;
        readonly generation: number;
        readonly tableIndex: number;
        readonly frameCount: number;
    },
    spectrumForFrame: (frameIndex: number) => Spectrum,
): void {
    if (destination.byteLength !== PACKED_WAVETABLE_BYTES
        || !Number.isInteger(table.frameCount) || table.frameCount < 1 || table.frameCount > frameCapacity) {
        throw new Error("Invalid packed wavetable destination or frame count.");
    }
    const words = new Int32Array(destination.buffer, destination.byteOffset, destination.byteLength / 4);
    words.set([0x5754424c, 1, table.dspSessionId, table.generation, table.tableIndex,
        table.frameCount, DEFAULT_MIP_LEVEL_COUNT, frameCapacity]);

    let mipOffset = headerWords;
    const valueMaximum = 131071;
    const slopeMaximum = 8191;
    const valueScale = Math.fround(valueMaximum / 1.5);
    const slopeScale = Math.fround(slopeMaximum / 0.5);
    for (let mip = 0; mip < DEFAULT_MIP_LEVEL_COUNT; ++mip) {
        const length = Math.min(samplesPerFrame, Math.max(256, (1 << mip) * 32));
        const step = samplesPerFrame / length;
        for (let frame = 0; frame < table.frameCount; ++frame) {
            // One 2048-sample FFT result is scratch, not a second prepared table.
            const samples = buildMipFrameFromSpectrum(spectrumForFrame(frame), mip);
            const base = mipOffset + frame * (length + 1);
            for (let point = 0; point <= length; ++point) {
                const index = (point === length ? 0 : point) * step;
                const previous = (index + samplesPerFrame - step) % samplesPerFrame;
                const next = (index + step) % samplesPerFrame;
                const value = samples[index];
                const before = samples[previous];
                const after = samples[next];
                if (value === undefined || before === undefined || after === undefined
                    || !Number.isFinite(value) || !Number.isFinite(before) || !Number.isFinite(after)) {
                    throw new Error("Wavetable preparation produced invalid samples.");
                }
                const slope = Math.fround(0.5 * Math.fround(after - before));
                words[base + point] = (quantise(value, valueScale, valueMaximum) & 0x3ffff)
                    | (quantise(slope, slopeScale, slopeMaximum) << 18);
            }
        }
        mipOffset += (length + 1) * frameCapacity;
    }
}
