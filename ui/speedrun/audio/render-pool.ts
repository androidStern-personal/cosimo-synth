import { renderBouncePlanInWorkers } from "../../../bounce/worker-pool.mjs";
import type { CumulativePatchState } from "../partial-states";
import { SPEEDRUN_SAMPLES_PER_FRAME, type SpeedrunTimeline } from "../timeline";
import {
    SPEEDRUN_CROSSFADE_SAMPLES,
} from "./master-track";
import type {
    NotePerformance,
    SpeedrunCheckpointRenderJob,
    SpeedrunCheckpointRenderResult,
} from "./checkpoint-renderer";
import {
    prefetchSpeedrunWavetableResources,
    type SpeedrunWavetableResourceBundle,
} from "./resources";
import { emptySpeedrunCheckpointTelemetryTrack } from "./telemetry";

export type SpeedrunAudioProgress = {
    readonly completedCheckpoints: number;
    readonly totalCheckpoints: number;
    readonly completedFrames: number;
    readonly totalFrames: number;
    readonly checkpointIndex: number;
};

export type SpeedrunRenderPoolOptions = {
    readonly workerURL?: string | URL;
    readonly engineModuleURL?: string | URL;
    readonly resourceBaseURL?: string | URL;
    readonly concurrency?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: SpeedrunAudioProgress) => void;
    readonly workerFactory?: (url: string | URL, job: SpeedrunCheckpointRenderJob) => Worker;
    readonly maxInstallFrames?: number;
    readonly prefetchResources?: boolean;
    /** Record per-frame engine telemetry (scripted video renders only). */
    readonly recordTelemetry?: boolean;
};

type SpeedrunWorkerPlan = {
    readonly jobs: ReadonlyArray<SpeedrunCheckpointRenderJob>;
};

function defaultRootURL() {
    const locationHref = globalThis.location?.href;
    if (typeof locationHref !== "string" || locationHref.length === 0) {
        throw new Error("Speedrun audio URLs must be supplied outside a browser document.");
    }
    return new URL("/", locationHref);
}

function defaultConcurrency(checkpointCount: number) {
    const hardwareConcurrency = Math.floor(Number(globalThis.navigator?.hardwareConcurrency) || 2);
    return Math.max(1, Math.min(4, hardwareConcurrency - 2 || 1, checkpointCount));
}

function buildSpeedrunCheckpointPlan(
    states: ReadonlyArray<CumulativePatchState>,
    timeline: SpeedrunTimeline,
    performance: NotePerformance,
    {
        resourceBaseURL,
        resourceBundle,
        maxInstallFrames,
        recordTelemetry,
    }: Pick<SpeedrunRenderPoolOptions, "resourceBaseURL" | "maxInstallFrames" | "recordTelemetry"> & {
        readonly resourceBundle?: SpeedrunWavetableResourceBundle;
    } = {},
): SpeedrunWorkerPlan {
    const root = resourceBaseURL ?? defaultRootURL();
    const jobs = timeline.sections.flatMap((timedSection) => {
        if (timedSection.checkpointIndex < 0) return [];
        const state = states[timedSection.checkpointIndex];
        if (!state) {
            throw new Error(`Timeline checkpoint ${timedSection.checkpointIndex} has no cumulative state.`);
        }
        const sectionFrames = timedSection.endSample - timedSection.startSample;
        const rootIndex = timedSection.checkpointIndex;
        return [{
            rootIndex,
            rootNote: timedSection.checkpointIndex,
            sessionID: 0x535000 + timedSection.checkpointIndex,
            checkpointIndex: timedSection.checkpointIndex,
            state,
            frameCount: sectionFrames + SPEEDRUN_CROSSFADE_SAMPLES,
            sampleRate: 48_000 as const,
            performance,
            resourceBaseURL: String(root),
            ...(resourceBundle === undefined ? {} : { resourceBundle }),
            ...(maxInstallFrames === undefined ? {} : { maxInstallFrames }),
            ...(recordTelemetry === true ? { recordTelemetry: true } : {}),
        } satisfies SpeedrunCheckpointRenderJob];
    });
    return { jobs };
}

/** Render every audible cumulative state through Bounce's short-lived worker pool. */
export async function renderSpeedrunCheckpoints(
    states: ReadonlyArray<CumulativePatchState>,
    timeline: SpeedrunTimeline,
    performance: NotePerformance,
    options: SpeedrunRenderPoolOptions = {},
): Promise<SpeedrunCheckpointRenderResult[]> {
    const root = defaultRootURL();
    const workerURL = options.workerURL ?? new URL(
        "patch_gui/speedrun-checkpoint-worker.js",
        root,
    );
    const engineModuleURL = options.engineModuleURL ?? new URL(
        "cmaj_Cosimo_Synth.offline.js",
        root,
    );
    const resourceBaseURL = options.resourceBaseURL ?? new URL("./", engineModuleURL);
    const resourceBundle = options.prefetchResources === false
        ? undefined
        : await prefetchSpeedrunWavetableResources(states, resourceBaseURL);
    const plan = buildSpeedrunCheckpointPlan(states, timeline, performance, {
        resourceBaseURL,
        resourceBundle,
        maxInstallFrames: options.maxInstallFrames,
        recordTelemetry: options.recordTelemetry,
    });
    if (plan.jobs.length === 0) return [];

    const totalFrames = plan.jobs.reduce((sum, job) => sum + job.frameCount, 0);
    let completedFrames = 0;
    let completedCheckpoints = 0;
    const frameCountByCheckpoint = new Map(plan.jobs.map((job) => (
        [job.checkpointIndex, job.frameCount]
    )));
    const results = await renderBouncePlanInWorkers({
        plan,
        workerURL,
        engineModuleURL,
        workerFactory: options.workerFactory,
        concurrency: options.concurrency ?? defaultConcurrency(plan.jobs.length),
        signal: options.signal,
        onProgress: ({ rootNote: checkpointIndex }: { rootNote: number }) => {
            completedCheckpoints += 1;
            completedFrames += frameCountByCheckpoint.get(checkpointIndex) ?? 0;
            options.onProgress?.({
                completedCheckpoints,
                totalCheckpoints: plan.jobs.length,
                completedFrames,
                totalFrames,
                checkpointIndex,
            });
        },
    }) as SpeedrunCheckpointRenderResult[];

    return results.map((result, index) => {
        const expected = plan.jobs[index];
        if (result.rootIndex !== expected.rootIndex
            || result.checkpointIndex !== expected.checkpointIndex
            || result.frameCount !== expected.frameCount
            || !(result.samples instanceof Float32Array)) {
            throw new Error(`Speedrun checkpoint ${expected.checkpointIndex} returned invalid audio.`);
        }
        if (expected.recordTelemetry && !result.telemetry) {
            // A silently empty track would ship a video with frozen playback
            // graphics; a missing field means the prebuilt checkpoint worker
            // bundle is stale relative to this renderer.
            throw new Error(
                `Speedrun checkpoint ${expected.checkpointIndex} returned no telemetry — rebuild patch_gui/speedrun-checkpoint-worker.js.`,
            );
        }
        return {
            ...result,
            telemetry: result.telemetry
                ?? emptySpeedrunCheckpointTelemetryTrack(
                    Math.ceil(result.frameCount / SPEEDRUN_SAMPLES_PER_FRAME),
                ),
        };
    });
}
