import { SPEEDRUN_SAMPLES_PER_FRAME, type SpeedrunTimeline } from "../timeline";
import type { SpeedrunCheckpointRenderResult } from "./checkpoint-renderer";

/** 90 ms at the 48 kHz timeline rate. */
export const SPEEDRUN_CROSSFADE_SAMPLES = 4_320 as const;
const SPEEDRUN_END_FADE_FRAMES = 15;

export type SpeedrunMasterTrack = {
    readonly sampleRate: 48_000;
    readonly frameCount: number;
    readonly samples: Float32Array;
    readonly wav: Uint8Array;
};

function assertCheckpoint(
    checkpoint: SpeedrunCheckpointRenderResult | undefined,
    checkpointIndex: number,
    minimumFrames: number,
) {
    if (!checkpoint || checkpoint.checkpointIndex !== checkpointIndex) {
        throw new Error(`Master track is missing checkpoint ${checkpointIndex}.`);
    }
    if (checkpoint.frameCount < minimumFrames
        || checkpoint.samples.length !== checkpoint.frameCount * 2) {
        throw new Error(`Checkpoint ${checkpointIndex} is shorter than its timeline section.`);
    }
    return checkpoint;
}

function copyFrames(
    source: Float32Array,
    sourceFrame: number,
    destination: Float32Array,
    destinationFrame: number,
    frameCount: number,
) {
    destination.set(
        source.subarray(sourceFrame * 2, (sourceFrame + frameCount) * 2),
        destinationFrame * 2,
    );
}

function applyBoundaryCrossfade(
    previous: SpeedrunCheckpointRenderResult,
    previousSectionFrames: number,
    current: SpeedrunCheckpointRenderResult,
    destination: Float32Array,
    destinationFrame: number,
    frameCount: number,
) {
    if (frameCount <= 0) return;
    const denominator = Math.max(1, frameCount - 1);
    for (let frame = 0; frame < frameCount; frame += 1) {
        const phase = frame / denominator;
        const fadeOut = Math.cos(phase * Math.PI * 0.5);
        const fadeIn = Math.sin(phase * Math.PI * 0.5);
        for (let channel = 0; channel < 2; channel += 1) {
            const previousSample = previous.samples[((previousSectionFrames + frame) * 2) + channel];
            const currentSample = current.samples[(frame * 2) + channel];
            destination[((destinationFrame + frame) * 2) + channel]
                = previousSample * fadeOut + currentSample * fadeIn;
        }
    }
}

function applyEndFade(samples: Float32Array, frameCount: number) {
    const fadeFrames = Math.min(frameCount, SPEEDRUN_END_FADE_FRAMES * SPEEDRUN_SAMPLES_PER_FRAME);
    const startFrame = frameCount - fadeFrames;
    const denominator = Math.max(1, fadeFrames - 1);
    for (let frame = 0; frame < fadeFrames; frame += 1) {
        const gain = 1 - (frame / denominator);
        samples[(startFrame + frame) * 2] *= gain;
        samples[((startFrame + frame) * 2) + 1] *= gain;
    }
}

function pcm16(value: number) {
    const clipped = Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
    return clipped < 0 ? Math.round(clipped * 32_768) : Math.round(clipped * 32_767);
}

export function encodeSpeedrunWav(samples: Float32Array, sampleRate = 48_000) {
    if (samples.length % 2 !== 0) throw new Error("Speedrun WAV samples must be stereo interleaved.");
    const dataByteLength = samples.length * 2;
    const bytes = new Uint8Array(44 + dataByteLength);
    const view = new DataView(bytes.buffer);
    const writeAscii = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) {
            view.setUint8(offset + index, value.charCodeAt(index));
        }
    };
    writeAscii(0, "RIFF");
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(8, "WAVE");
    writeAscii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeAscii(36, "data");
    view.setUint32(40, dataByteLength, true);
    for (let index = 0; index < samples.length; index += 1) {
        view.setInt16(44 + index * 2, pcm16(samples[index]), true);
    }
    return bytes;
}

/** Splice checkpoint renders into the exact frame/sample authority. */
export function assembleSpeedrunMasterTrack(
    timeline: SpeedrunTimeline,
    checkpoints: ReadonlyArray<SpeedrunCheckpointRenderResult>,
): SpeedrunMasterTrack {
    const frameCount = timeline.durationInFrames * timeline.samplesPerFrame;
    const samples = new Float32Array(frameCount * 2);
    const byCheckpoint = new Map(checkpoints.map((checkpoint) => (
        [checkpoint.checkpointIndex, checkpoint]
    )));
    let previousAudible: {
        checkpoint: SpeedrunCheckpointRenderResult;
        sectionFrames: number;
    } | null = null;

    for (const timedSection of timeline.sections) {
        const sectionFrames = timedSection.endSample - timedSection.startSample;
        if (timedSection.checkpointIndex < 0) {
            previousAudible = null;
            continue;
        }
        const checkpoint = assertCheckpoint(
            byCheckpoint.get(timedSection.checkpointIndex),
            timedSection.checkpointIndex,
            sectionFrames + SPEEDRUN_CROSSFADE_SAMPLES,
        );
        copyFrames(checkpoint.samples, 0, samples, timedSection.startSample, sectionFrames);
        if (previousAudible !== null) {
            const crossfadeFrames = Math.min(SPEEDRUN_CROSSFADE_SAMPLES, sectionFrames);
            applyBoundaryCrossfade(
                previousAudible.checkpoint,
                previousAudible.sectionFrames,
                checkpoint,
                samples,
                timedSection.startSample,
                crossfadeFrames,
            );
        }
        previousAudible = { checkpoint, sectionFrames };
    }

    applyEndFade(samples, frameCount);
    return {
        sampleRate: 48_000,
        frameCount,
        samples,
        wav: encodeSpeedrunWav(samples),
    };
}

export async function digestSpeedrunPCM(samples: Float32Array) {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is required for speedrun PCM digests.");
    const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
    const digestInput = bytes.buffer instanceof ArrayBuffer
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        : Uint8Array.from(bytes).buffer;
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", digestInput));
    return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}
