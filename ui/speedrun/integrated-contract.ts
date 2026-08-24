export type VideoBounceContainer = "auto" | "mp4" | "webm";

export type VideoBounceQuality = "very-low" | "low" | "medium" | "high";

export type VideoBouncePrepared = {
    readonly label: string;
    readonly sectionCount: number;
    readonly durationSeconds: number;
};

export type VideoBounceAudioArtifact = {
    readonly url: string;
    readonly bytes: number;
    readonly durationSeconds: number;
};

export type VideoBounceVideoArtifact = {
    readonly url: string;
    readonly bytes: number;
    readonly durationSeconds: number;
    readonly fileName: string;
    readonly extension: "mp4" | "webm";
    readonly formatLabel: string;
};

export type IntegratedVideoBounceSession = {
    readonly prepared: VideoBouncePrepared;
    renderAudio(onProgress: (progress: number) => void): Promise<VideoBounceAudioArtifact>;
    renderVideo(options: {
        readonly container: VideoBounceContainer;
        readonly quality: VideoBounceQuality;
        readonly onProgress: (progress: number) => void;
    }): Promise<VideoBounceVideoArtifact>;
    cancel(): void;
    dispose(): void;
};

export type IntegratedVideoBounceModule = {
    createVideoBounceSession(patchInput: unknown): Promise<IntegratedVideoBounceSession>;
};
