import { renderMediaOnWeb } from "@remotion/web-renderer";

import { analyzePatch, type PatchAnalysis } from "../analyzer";
import {
    assembleSpeedrunMasterTrack,
} from "../audio/master-track";
import {
    renderSpeedrunCheckpoints,
    type SpeedrunAudioProgress,
} from "../audio/render-pool";
import type { NotePerformance } from "../audio/checkpoint-renderer";
import {
    SpeedrunComposition,
    SPEEDRUN_VIDEO_HEIGHT,
    SPEEDRUN_VIDEO_WIDTH,
} from "../composition/composition";
import { buildCumulativeStates, type CumulativePatchState } from "../partial-states";
import { intakePatch, type DefaultsSnapshot, type PatchDocument } from "../patch-io";
import { compileRecipe, type SpeedrunRecipe } from "../recipe";
import { assembleTimeline, type SpeedrunTimeline } from "../timeline";
import { SpeedrunStudioError, studioError } from "./errors";
import {
    createStudioShareLink,
    type StudioShareLinkAvailability,
} from "./patch-input";
import type { SpeedrunStudioRuntime } from "./runtime";
import {
    detectSpeedrunVideoFormat,
    type SpeedrunVideoContainer,
    type SpeedrunVideoFormat,
} from "./video-support";
import { verifySpeedrunVideo, type SpeedrunVideoVerification } from "./verify";

export type SpeedrunPreparedPipeline = {
    readonly document: PatchDocument;
    readonly defaults: DefaultsSnapshot;
    readonly analysis: PatchAnalysis;
    readonly recipe: SpeedrunRecipe;
    readonly timeline: SpeedrunTimeline;
    readonly states: ReadonlyArray<CumulativePatchState>;
    readonly performance: NotePerformance;
    readonly shareLink: StudioShareLinkAvailability;
};

export type SpeedrunAudioArtifact = {
    readonly url: string;
    readonly blob: Blob;
    readonly bytes: number;
    readonly durationSeconds: number;
    readonly elapsedMilliseconds: number;
};

export type SpeedrunVideoArtifact = {
    readonly url: string;
    readonly blob: Blob;
    readonly fileName: string;
    readonly format: SpeedrunVideoFormat;
    readonly verification: SpeedrunVideoVerification;
    readonly elapsedMilliseconds: number;
};

export type SpeedrunVideoProgress = {
    readonly progress: number;
    readonly renderedFrames: number;
    readonly encodedFrames: number;
};

export type SpeedrunStudioSnapshot = {
    readonly prepared: null | {
        readonly label: string;
        readonly sectionIds: ReadonlyArray<string>;
        readonly durationInFrames: number;
        readonly durationSeconds: number;
        readonly compressionLevel: number;
        readonly shareURL: string | null;
        readonly shareError: null | {
            readonly code: string;
            readonly message: string;
        };
    };
    readonly audio: null | {
        readonly bytes: number;
        readonly durationSeconds: number;
        readonly elapsedMilliseconds: number;
    };
    readonly video: null | {
        readonly fileName: string;
        readonly format: SpeedrunVideoFormat;
        readonly verification: SpeedrunVideoVerification;
        readonly elapsedMilliseconds: number;
    };
    readonly activeStage: "audio" | "video" | null;
    readonly ownedObjectURLCount: number;
};

function slug(value: string) {
    const normalized = value.normalize("NFKD")
        .replace(/[\u0300-\u036f]/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "");
    return normalized || "cosimo-sound";
}

function arrayBuffer(bytes: Uint8Array) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export class SpeedrunStudioSession {
    private preparedValue: SpeedrunPreparedPipeline | null = null;
    private audioValue: SpeedrunAudioArtifact | null = null;
    private videoValue: SpeedrunVideoArtifact | null = null;
    private activeController: AbortController | null = null;
    private activeStageValue: "audio" | "video" | null = null;
    private readonly ownedObjectURLs = new Set<string>();

    constructor(readonly runtime: SpeedrunStudioRuntime) {}

    get prepared() { return this.preparedValue; }
    get audio() { return this.audioValue; }
    get video() { return this.videoValue; }
    get activeStage() { return this.activeStageValue; }

    private revoke(url: string | undefined) {
        if (url === undefined || !this.ownedObjectURLs.delete(url)) return;
        URL.revokeObjectURL(url);
    }

    private own(blob: Blob) {
        const url = URL.createObjectURL(blob);
        this.ownedObjectURLs.add(url);
        return url;
    }

    private clearAudioAndVideo() {
        this.revoke(this.videoValue?.url);
        this.revoke(this.audioValue?.url);
        this.videoValue = null;
        this.audioValue = null;
    }

    private beginStage(stage: "audio" | "video") {
        if (this.activeController !== null) {
            throw new SpeedrunStudioError(stage, "AlreadyRendering", `${this.activeStageValue ?? "Speedrun"} rendering is already active.`);
        }
        const controller = new AbortController();
        this.activeController = controller;
        this.activeStageValue = stage;
        return controller;
    }

    private endStage(controller: AbortController) {
        if (this.activeController !== controller) return;
        this.activeController = null;
        this.activeStageValue = null;
    }

    async prepare(
        patchInput: unknown,
        performance: NotePerformance,
        options: { readonly maxDurationInFrames?: number } = {},
    ): Promise<SpeedrunPreparedPipeline> {
        if (this.activeController !== null) {
            throw new SpeedrunStudioError("analysis", "RenderInProgress", "Cancel the active render before analyzing another sound.");
        }
        this.clearAudioAndVideo();
        this.preparedValue = null;
        const intake = intakePatch(patchInput, this.runtime.intakeOptions);
        if (!intake.ok) {
            throw new SpeedrunStudioError("intake", intake.error._tag, intake.error.message, { cause: intake.error });
        }
        try {
            const analysis = analyzePatch(intake.value.document, intake.value.defaults);
            const recipe = compileRecipe(
                analysis,
                intake.value.document,
                intake.value.defaults,
                this.runtime.catalog,
            );
            const timeline = assembleTimeline(recipe, {
                maxDurationInFrames: options.maxDurationInFrames,
            });
            if (timeline.durationInFrames < 1 || timeline.sections.length < 1) {
                throw new Error("This sound has no reconstructable speedrun sections.");
            }
            const shareLink = await createStudioShareLink(intake.value.document, this.runtime);
            const prepared = {
                document: intake.value.document,
                defaults: intake.value.defaults,
                analysis,
                recipe,
                timeline,
                states: buildCumulativeStates(intake.value.defaults, recipe),
                performance,
                shareLink,
            } satisfies SpeedrunPreparedPipeline;
            this.preparedValue = prepared;
            return prepared;
        } catch (error) {
            throw studioError("analysis", "RecipeCompilationFailed", error, "The speedrun recipe could not be compiled.");
        }
    }

    async renderAudio(
        onProgress?: (progress: SpeedrunAudioProgress) => void,
    ): Promise<SpeedrunAudioArtifact> {
        const prepared = this.preparedValue;
        if (prepared === null) throw new SpeedrunStudioError("audio", "NotAnalyzed", "Analyze a sound before rendering audio.");
        const controller = this.beginStage("audio");
        const startedAt = performance.now();
        this.revoke(this.videoValue?.url);
        this.videoValue = null;
        try {
            const checkpoints = await renderSpeedrunCheckpoints(
                prepared.states,
                prepared.timeline,
                prepared.performance,
                {
                    workerURL: this.runtime.workerURL,
                    engineModuleURL: this.runtime.engineModuleURL,
                    resourceBaseURL: this.runtime.webRootURL,
                    signal: controller.signal,
                    onProgress,
                },
            );
            if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
            const master = assembleSpeedrunMasterTrack(prepared.timeline, checkpoints);
            const blob = new Blob([arrayBuffer(master.wav)], { type: "audio/wav" });
            const artifact: SpeedrunAudioArtifact = {
                url: this.own(blob),
                blob,
                bytes: blob.size,
                durationSeconds: prepared.timeline.durationInFrames / prepared.timeline.fps,
                elapsedMilliseconds: performance.now() - startedAt,
            };
            this.revoke(this.audioValue?.url);
            this.audioValue = artifact;
            return artifact;
        } catch (error) {
            throw studioError("audio", "CheckpointRenderFailed", error, "Checkpoint audio could not be rendered.");
        } finally {
            this.endStage(controller);
        }
    }

    async renderVideo(options: {
        readonly preferredContainer?: SpeedrunVideoContainer;
        readonly videoBitrate?: "very-low" | "low" | "medium" | "high";
        readonly onProgress?: (progress: SpeedrunVideoProgress) => void;
    } = {}): Promise<SpeedrunVideoArtifact> {
        const prepared = this.preparedValue;
        const audio = this.audioValue;
        if (prepared === null) throw new SpeedrunStudioError("video", "NotAnalyzed", "Analyze a sound before rendering video.");
        if (audio === null) throw new SpeedrunStudioError("video", "AudioMissing", "Render and audition checkpoint audio before rendering video.");
        const format = await detectSpeedrunVideoFormat(options.preferredContainer);
        if (format === null) {
            throw new SpeedrunStudioError(
                "unsupported",
                "WebCodecsUnavailable",
                options.preferredContainer
                    ? `${options.preferredContainer.toUpperCase()} export is not supported by this browser's WebCodecs encoders.`
                    : "Video export needs a WebCodecs browser with H.264/AAC or VP9/Opus encoding.",
            );
        }
        const controller = this.beginStage("video");
        const startedAt = performance.now();
        try {
            await document.fonts.ready;
            const props = {
                recipe: prepared.recipe,
                timeline: prepared.timeline,
                masterAudioUrl: audio.url,
                patchLabel: prepared.document.label,
            };
            const { getBlob } = await renderMediaOnWeb({
                composition: {
                    id: "cosimo-sound-speedrun",
                    component: SpeedrunComposition,
                    durationInFrames: prepared.timeline.durationInFrames,
                    fps: prepared.timeline.fps,
                    width: SPEEDRUN_VIDEO_WIDTH,
                    height: SPEEDRUN_VIDEO_HEIGHT,
                    defaultProps: props,
                },
                inputProps: props,
                container: format.container,
                videoCodec: format.videoCodec,
                audioCodec: format.audioCodec,
                sampleRate: prepared.timeline.sampleRate,
                videoBitrate: options.videoBitrate ?? "high",
                audioBitrate: "medium",
                logLevel: "warn",
                signal: controller.signal,
                onProgress: ({ progress, renderedFrames, encodedFrames }) => {
                    options.onProgress?.({ progress, renderedFrames, encodedFrames });
                },
            });
            const blob = await getBlob();
            if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
            const verification = await verifySpeedrunVideo(blob, prepared.timeline, format);
            const artifact: SpeedrunVideoArtifact = {
                url: this.own(blob),
                blob,
                fileName: `${slug(prepared.document.label)}-speedrun.${format.extension}`,
                format,
                verification,
                elapsedMilliseconds: performance.now() - startedAt,
            };
            this.revoke(this.videoValue?.url);
            this.videoValue = artifact;
            return artifact;
        } catch (error) {
            throw studioError("video", "VideoRenderFailed", error, "The speedrun video could not be rendered.");
        } finally {
            this.endStage(controller);
        }
    }

    cancel() {
        this.activeController?.abort();
    }

    snapshot(): SpeedrunStudioSnapshot {
        const prepared = this.preparedValue;
        return {
            prepared: prepared === null ? null : {
                label: prepared.document.label,
                sectionIds: prepared.recipe.sections.map((section) => section.id),
                durationInFrames: prepared.timeline.durationInFrames,
                durationSeconds: prepared.timeline.durationInFrames / prepared.timeline.fps,
                compressionLevel: prepared.timeline.compressionLevel,
                shareURL: prepared.shareLink._tag === "available"
                    ? prepared.shareLink.link.url
                    : null,
                shareError: prepared.shareLink._tag === "unavailable"
                    ? { code: prepared.shareLink.code, message: prepared.shareLink.message }
                    : null,
            },
            audio: this.audioValue === null ? null : {
                bytes: this.audioValue.bytes,
                durationSeconds: this.audioValue.durationSeconds,
                elapsedMilliseconds: this.audioValue.elapsedMilliseconds,
            },
            video: this.videoValue === null ? null : {
                fileName: this.videoValue.fileName,
                format: this.videoValue.format,
                verification: this.videoValue.verification,
                elapsedMilliseconds: this.videoValue.elapsedMilliseconds,
            },
            activeStage: this.activeStageValue,
            ownedObjectURLCount: this.ownedObjectURLs.size,
        };
    }

    dispose() {
        this.cancel();
        for (const url of this.ownedObjectURLs) URL.revokeObjectURL(url);
        this.ownedObjectURLs.clear();
        this.preparedValue = null;
        this.audioValue = null;
        this.videoValue = null;
    }
}
