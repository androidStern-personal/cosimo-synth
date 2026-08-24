import {
    ALL_FORMATS,
    AudioBufferSink,
    BlobSource,
    Input,
    MP4,
    WEBM,
} from "mediabunny";

import type { SpeedrunTimeline } from "../timeline";
import { SpeedrunStudioError, studioError } from "./errors";
import type { SpeedrunVideoFormat } from "./video-support";

export type SpeedrunAudioWindowVerification = {
    readonly sectionId: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly rms: number;
    readonly sampleCount: number;
};

export type SpeedrunVideoVerification = {
    readonly container: "mp4" | "webm";
    readonly durationSeconds: number;
    readonly expectedDurationSeconds: number;
    readonly videoTrackCount: number;
    readonly audioTrackCount: number;
    readonly videoCodec: string;
    readonly audioCodec: string;
    readonly audioWindows: ReadonlyArray<SpeedrunAudioWindowVerification>;
    readonly minimumWindowRms: number;
    readonly blobBytes: number;
    readonly blobType: string;
};

function requireVerification(condition: unknown, message: string): asserts condition {
    if (!condition) throw new SpeedrunStudioError("verification", "InvalidVideo", message);
}

/** Verify the exact downloadable blob before the studio exposes it. */
export async function verifySpeedrunVideo(
    blob: Blob,
    timeline: SpeedrunTimeline,
    format: SpeedrunVideoFormat,
    {
        durationToleranceSeconds,
    }: {
        /** Live recordings carry real start latency and a settle tail, so
            they verify with a wider duration window than exact renders. */
        readonly durationToleranceSeconds?: number;
    } = {},
): Promise<SpeedrunVideoVerification> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        const [detectedFormat, durationSeconds, videoTracks, audioTracks] = await Promise.all([
            input.getFormat(),
            input.computeDuration(),
            input.getVideoTracks(),
            input.getAudioTracks(),
        ]);
        requireVerification(
            format.container === "mp4" ? detectedFormat === MP4 : detectedFormat === WEBM,
            `Expected a ${format.container.toUpperCase()} container.`,
        );
        requireVerification(videoTracks.length === 1,
            `Expected exactly one video track, received ${videoTracks.length}.`);
        requireVerification(audioTracks.length === 1,
            `Expected exactly one audio track, received ${audioTracks.length}.`);
        const [videoCodec, audioCodec] = await Promise.all([
            videoTracks[0].getCodec(),
            audioTracks[0].getCodec(),
        ]);
        const expectedVideoCodec = format.container === "mp4" ? "avc" : "vp9";
        requireVerification(videoCodec === expectedVideoCodec,
            `Expected ${expectedVideoCodec} video, received ${String(videoCodec)}.`);
        requireVerification(audioCodec === format.audioCodec,
            `Expected ${format.audioCodec} audio, received ${String(audioCodec)}.`);

        const expectedDurationSeconds = timeline.durationInFrames / timeline.fps;
        const durationTolerance = durationToleranceSeconds ?? Math.max(0.15, 2 / timeline.fps);
        requireVerification(Math.abs(durationSeconds - expectedDurationSeconds) <= durationTolerance,
            `Expected ${expectedDurationSeconds.toFixed(3)} seconds, received ${durationSeconds.toFixed(3)}.`);

        const windows = timeline.sections.flatMap((section): Array<{
            readonly sectionId: string;
            readonly startSeconds: number;
            readonly endSeconds: number;
            squareSum: number;
            sampleCount: number;
        }> => {
            if (section.checkpointIndex < 0) return [];
            const sectionStart = section.startFrame / timeline.fps;
            const sectionEnd = section.endFrame / timeline.fps;
            const startSeconds = Math.min(sectionEnd, sectionStart + 0.04);
            const endSeconds = Math.min(sectionEnd, startSeconds + 0.5);
            return endSeconds > startSeconds
                ? [{ sectionId: section.section.id, startSeconds, endSeconds, squareSum: 0, sampleCount: 0 }]
                : [];
        });
        requireVerification(windows.length > 0, "The speedrun timeline has no audible verification window.");

        const sink = new AudioBufferSink(audioTracks[0]);
        for await (const wrapped of sink.buffers()) {
            const bufferStart = wrapped.timestamp;
            const bufferEnd = bufferStart + wrapped.buffer.duration;
            for (const window of windows) {
                if (bufferEnd <= window.startSeconds || bufferStart >= window.endSeconds) continue;
                const sampleRate = wrapped.buffer.sampleRate;
                const first = Math.max(0, Math.floor((window.startSeconds - bufferStart) * sampleRate));
                const last = Math.min(wrapped.buffer.length, Math.ceil((window.endSeconds - bufferStart) * sampleRate));
                for (let channel = 0; channel < wrapped.buffer.numberOfChannels; channel += 1) {
                    const samples = wrapped.buffer.getChannelData(channel);
                    for (let index = first; index < last; index += 1) {
                        window.squareSum += samples[index] * samples[index];
                        window.sampleCount += 1;
                    }
                }
            }
        }
        const audioWindows = windows.map((window): SpeedrunAudioWindowVerification => ({
            sectionId: window.sectionId,
            startSeconds: window.startSeconds,
            endSeconds: window.endSeconds,
            rms: window.sampleCount === 0 ? 0 : Math.sqrt(window.squareSum / window.sampleCount),
            sampleCount: window.sampleCount,
        }));
        for (const window of audioWindows) {
            requireVerification(window.sampleCount > 0,
                `The AAC/Opus track decoded no samples for ${window.sectionId}.`);
            requireVerification(window.rms > 0.00001,
                `The decoded audio window for ${window.sectionId} is silent (RMS ${window.rms}).`);
        }

        return {
            container: format.container,
            durationSeconds,
            expectedDurationSeconds,
            videoTrackCount: videoTracks.length,
            audioTrackCount: audioTracks.length,
            videoCodec,
            audioCodec,
            audioWindows,
            minimumWindowRms: Math.min(...audioWindows.map((window) => window.rms)),
            blobBytes: blob.size,
            blobType: blob.type,
        };
    } catch (error) {
        throw studioError("verification", "VideoVerificationFailed", error, "The rendered video failed verification.");
    } finally {
        input.dispose();
    }
}
