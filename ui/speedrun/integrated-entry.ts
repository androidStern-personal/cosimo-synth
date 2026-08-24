import { DEFAULT_SPEEDRUN_PERFORMANCE } from "./midi/default-performance";
import type {
    IntegratedVideoBounceSession,
    VideoBounceContainer,
} from "./integrated-contract";
import { SpeedrunStudioSession } from "./studio/pipeline";
import { loadSpeedrunStudioRuntime } from "./studio/runtime";

export { renderScriptedVideoInCurrentDocument } from "./scripted/iframe-renderer";

const MAX_DURATION_IN_FRAMES = 2_700;
const STYLE_LINK_MARKER = "cosimo-video-bounce-runtime";

function loadCompositionStyles() {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-runtime="${STYLE_LINK_MARKER}"]`);
    if (existing?.sheet) {
        return Promise.resolve();
    }

    existing?.remove();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(/* @vite-ignore */ "./style.css", import.meta.url).href;
    link.dataset.runtime = STYLE_LINK_MARKER;

    return new Promise<void>((resolve, reject) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => reject(new Error("Video Bounce styles could not be loaded.")), { once: true });
        document.head.append(link);
    });
}

function preferredContainer(container: VideoBounceContainer) {
    return container === "auto" ? undefined : container;
}

/** Browser-only renderer boundary, loaded only after Bounce Video is selected. */
export async function createVideoBounceSession(
    patchInput: unknown,
): Promise<IntegratedVideoBounceSession> {
    const [runtime] = await Promise.all([
        loadSpeedrunStudioRuntime(),
        loadCompositionStyles(),
    ]);
    const session = new SpeedrunStudioSession(runtime);

    try {
        const prepared = await session.prepare(patchInput, DEFAULT_SPEEDRUN_PERFORMANCE, {
            maxDurationInFrames: MAX_DURATION_IN_FRAMES,
            createShareLink: false,
        });

        return {
            prepared: {
                label: prepared.document.label,
                sectionCount: prepared.recipe.sections.length,
                durationSeconds: prepared.timeline.durationInFrames / prepared.timeline.fps,
            },
            async renderAudio(onProgress) {
                const artifact = await session.renderAudio((progress) => {
                    onProgress(progress.totalFrames === 0
                        ? 1
                        : progress.completedFrames / progress.totalFrames);
                });
                return {
                    url: artifact.url,
                    bytes: artifact.bytes,
                    durationSeconds: artifact.durationSeconds,
                };
            },
            async renderVideo(options) {
                const artifact = await session.renderVideo({
                    preferredContainer: preferredContainer(options.container),
                    videoBitrate: options.quality,
                    onProgress: (progress) => options.onProgress(progress.progress),
                });
                return {
                    url: artifact.url,
                    bytes: artifact.blob.size,
                    durationSeconds: artifact.verification.durationSeconds,
                    fileName: artifact.fileName,
                    extension: artifact.format.extension,
                    formatLabel: artifact.format.label,
                };
            },
            cancel: () => session.cancel(),
            dispose: () => session.dispose(),
        };
    } catch (error) {
        session.dispose();
        throw error;
    }
}
