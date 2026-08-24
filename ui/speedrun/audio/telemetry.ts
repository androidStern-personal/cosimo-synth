import type { SpeedrunCheckpointRenderResult } from "./checkpoint-renderer";
import type { SpeedrunTimeline } from "../timeline";

export const SPEEDRUN_TELEMETRY_ENDPOINT_IDS = [
    "runtimeState",
    "effectiveWavetablePosition",
    "effectiveWarpState",
    "effectiveUnisonState",
    "effectiveFilterState",
    "effectiveMsegState",
    "effectiveModSourceState",
    "filterSpectrum",
    "distortionHistory",
    "distortionScope",
] as const;

export type SpeedrunTelemetryEndpointID = typeof SPEEDRUN_TELEMETRY_ENDPOINT_IDS[number];

export type SpeedrunTelemetryFrame = {
    readonly frame: number;
    readonly events: Readonly<Partial<Record<SpeedrunTelemetryEndpointID, unknown>>>;
};

export type SpeedrunCheckpointTelemetryTrack = {
    readonly frameCount: number;
    readonly frames: ReadonlyArray<SpeedrunTelemetryFrame>;
};

export type SpeedrunTelemetryTrack = {
    readonly fps: number;
    readonly durationInFrames: number;
    readonly frames: ReadonlyArray<SpeedrunTelemetryFrame>;
};

export function emptySpeedrunCheckpointTelemetryTrack(
    frameCount: number,
): SpeedrunCheckpointTelemetryTrack {
    return { frameCount, frames: [] };
}

/** Splice checkpoint-local telemetry at the identical authority used by audio. */
export function assembleSpeedrunTelemetryTrack(
    timeline: SpeedrunTimeline,
    checkpoints: ReadonlyArray<Pick<SpeedrunCheckpointRenderResult, "checkpointIndex" | "telemetry">>,
): SpeedrunTelemetryTrack {
    const byCheckpoint = new Map(checkpoints.map((checkpoint) => [
        checkpoint.checkpointIndex,
        checkpoint.telemetry,
    ]));
    const globalFrames = new Map<number, Partial<Record<SpeedrunTelemetryEndpointID, unknown>>>();

    for (const section of timeline.sections) {
        if (section.checkpointIndex < 0) continue;
        const telemetry = byCheckpoint.get(section.checkpointIndex);
        if (!telemetry) {
            throw new Error(`Telemetry is missing checkpoint ${section.checkpointIndex}.`);
        }
        const sectionFrameCount = section.endFrame - section.startFrame;
        for (const local of telemetry.frames) {
            if (local.frame < 0 || local.frame >= sectionFrameCount) continue;
            const frame = section.startFrame + local.frame;
            globalFrames.set(frame, {
                ...(globalFrames.get(frame) ?? {}),
                ...local.events,
            });
        }
    }

    return {
        fps: timeline.fps,
        durationInFrames: timeline.durationInFrames,
        frames: [...globalFrames.entries()]
            .sort(([left], [right]) => left - right)
            .map(([frame, events]) => ({ frame, events })),
    };
}
