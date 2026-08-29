import type { CumulativePatchState } from "../../../ui/speedrun/partial-states";
import type { SpeedrunTimeline } from "../../../ui/speedrun/timeline";
import type { NotePerformance } from "../../../ui/speedrun/audio/checkpoint-renderer";
import {
    assembleSpeedrunMasterTrack,
    digestSpeedrunPCM,
} from "../../../ui/speedrun/audio/master-track";
import { renderSpeedrunCheckpoints } from "../../../ui/speedrun/audio/render-pool";
import { createSoundShareURL } from "../../../ui/shared/sound-share-link";
import type { SoundShareEnvelopeV2 } from "../../../ui/shared/sound-share-envelope";

type HarnessRequest = {
    readonly states: ReadonlyArray<CumulativePatchState>;
    readonly timeline: SpeedrunTimeline;
    readonly performance: NotePerformance;
    readonly concurrency?: number;
    readonly poisonResources?: boolean;
    readonly maxInstallFrames?: number;
};

function stereoRms(samples: Float32Array, firstFrame = 0, frameCount = samples.length / 2) {
    const lastFrame = Math.min(samples.length / 2, firstFrame + frameCount);
    let sumSquares = 0;
    for (let frame = firstFrame; frame < lastFrame; frame += 1) {
        const offset = frame * 2;
        sumSquares += ((samples[offset] ** 2) + (samples[offset + 1] ** 2)) * 0.5;
    }
    return Math.sqrt(sumSquares / Math.max(1, lastFrame - firstFrame));
}

function peak(samples: Float32Array) {
    let maximum = 0;
    for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
    return maximum;
}

function spectralCentroid(samples: Float32Array, firstFrame: number, sampleRate: number) {
    const size = 1_024;
    let weighted = 0;
    let magnitudeSum = 0;
    for (let bin = 1; bin < size / 2; bin += 1) {
        let real = 0;
        let imaginary = 0;
        for (let index = 0; index < size; index += 1) {
            const frame = Math.min(samples.length / 2 - 1, firstFrame + index);
            const mono = (samples[frame * 2] + samples[(frame * 2) + 1]) * 0.5;
            const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
            const phase = (2 * Math.PI * bin * index) / size;
            real += mono * window * Math.cos(phase);
            imaginary -= mono * window * Math.sin(phase);
        }
        const magnitude = Math.hypot(real, imaginary);
        const frequency = (bin * sampleRate) / size;
        weighted += frequency * magnitude;
        magnitudeSum += magnitude;
    }
    return magnitudeSum > 0 ? weighted / magnitudeSum : 0;
}

async function render(request: HarnessRequest) {
    const startedAt = globalThis.performance.now();
    const webRoot = new URL("/build/web/", globalThis.location.href);
    const checkpoints = await renderSpeedrunCheckpoints(
        request.states,
        request.timeline,
        request.performance,
        {
            workerURL: new URL("patch_gui/speedrun-checkpoint-worker.js", webRoot),
            engineModuleURL: new URL("cmaj_Cosimo_Synth.offline.js", webRoot),
            resourceBaseURL: request.poisonResources
                ? new URL("missing-speedrun-assets/", webRoot)
                : webRoot,
            concurrency: request.concurrency ?? 2,
            prefetchResources: !request.poisonResources,
            maxInstallFrames: request.maxInstallFrames,
            recordTelemetry: true,
        },
    );
    const master = assembleSpeedrunMasterTrack(request.timeline, checkpoints);
    const wallElapsedMilliseconds = globalThis.performance.now() - startedAt;
    const renderedAudioSeconds = checkpoints.reduce(
        (sum, checkpoint) => sum + checkpoint.frameCount / 48_000,
        0,
    );
    return {
        wallElapsedMilliseconds,
        renderedAudioSeconds,
        wallRealtimeMultiplier: wallElapsedMilliseconds > 0
            ? renderedAudioSeconds / (wallElapsedMilliseconds / 1_000)
            : null,
        checkpoints: await Promise.all(checkpoints.map(async (checkpoint) => ({
            checkpointIndex: checkpoint.checkpointIndex,
            digest: await digestSpeedrunPCM(checkpoint.samples),
            rms: stereoRms(checkpoint.samples),
            peak: peak(checkpoint.samples),
            tailRms: stereoRms(checkpoint.samples, Math.round(0.42 * 48_000), Math.round(0.48 * 48_000)),
            spectralCentroid: spectralCentroid(checkpoint.samples, Math.round(0.12 * 48_000), 48_000),
            metrics: checkpoint.metrics,
            telemetry: {
                frameCount: checkpoint.telemetry.frameCount,
                populatedFrameCount: checkpoint.telemetry.frames.length,
                endpointIDs: [...new Set(checkpoint.telemetry.frames.flatMap((frame) => (
                    Object.keys(frame.events)
                )))].sort(),
            },
        }))),
        master: {
            digest: await digestSpeedrunPCM(master.samples),
            rms: stereoRms(master.samples),
            frameCount: master.frameCount,
            wavByteLength: master.wav.byteLength,
        },
    };
}

async function measureSoundShareURL(envelope: SoundShareEnvelopeV2) {
    const result = await createSoundShareURL(envelope, "https://cosimo.test/");
    return result.ok
        ? {
            ok: true as const,
            length: result.value.length,
            lengthClass: result.value.lengthClass,
        }
        : {
            ok: false as const,
            tag: result.error._tag,
            message: result.error.message,
        };
}

declare global {
    interface Window {
        __COSIMO_SPEEDRUN_AUDIO_HARNESS__?: {
            render: typeof render;
            measureSoundShareURL: typeof measureSoundShareURL;
        };
    }
}

globalThis.window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__ = { render, measureSoundShareURL };
const status = document.querySelector("#status");
if (status) status.textContent = "Speedrun audio harness ready";
