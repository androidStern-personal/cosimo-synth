import { renderMediaOnWeb } from "@remotion/web-renderer";

import { WORKSPACE_SHELL_STORAGE_KEY } from "../../shared/workspace-shell";
import {
    SPEEDRUN_VIDEO_HEIGHT,
    SPEEDRUN_VIDEO_WIDTH,
} from "../composition/composition";
import type { SpeedrunVideoFormat } from "../studio/video-support";
import { ScriptedCaptureTimeController } from "./capture-time";
import {
    prepareScriptedCaptureEnvironment,
    ScriptedSessionComposition,
    type ScriptedCompositionProps,
    type ScriptedFrameInspection,
} from "./scripted-composition";

export type ScriptedPreencodeDigest = {
    readonly frame: number;
    readonly sha256: string;
};

export type ScriptedRenderRequest = Omit<
    ScriptedCompositionProps,
    "onFrameSettled"
> & {
    readonly format: SpeedrunVideoFormat;
    readonly videoBitrate?: "very-low" | "low" | "medium" | "high";
    readonly frameRange?: number | [number, number];
    readonly digestFrames?: ReadonlyArray<number>;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: {
        readonly progress: number;
        readonly renderedFrames: number;
        readonly encodedFrames: number;
    }) => void;
};

export type ScriptedRenderResult = {
    readonly blob: Blob;
    readonly preencodeDigests: ReadonlyArray<ScriptedPreencodeDigest>;
    readonly inspections: ReadonlyArray<ScriptedFrameInspection>;
    readonly iframeRafMode: "current-document" | "visibility-hidden" | "opacity-fallback";
};

function hex(bytes: Uint8Array) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestVideoFrame(frame: VideoFrame) {
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("A 2D canvas is required for pre-encode frame verification.");
    context.drawImage(frame, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return {
        sha256: hex(new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))),
    };
}

function frameRangeStart(frameRange: ScriptedRenderRequest["frameRange"]) {
    if (typeof frameRange === "number") return frameRange;
    return frameRange?.[0] ?? 0;
}

async function awaitDocumentStyles() {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    await Promise.all(links.map((link) => {
        if (link.sheet) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener("error", () => reject(new Error(`Capture stylesheet failed: ${link.href}`)), { once: true });
        });
    }));
    await document.fonts.ready;
}

/** Runs in the phone-width iframe realm; all renderer globals bind here. */
export async function renderScriptedVideoInCurrentDocument(
    request: ScriptedRenderRequest,
): Promise<ScriptedRenderResult> {
    sessionStorage.removeItem(WORKSPACE_SHELL_STORAGE_KEY);
    await awaitDocumentStyles();
    await prepareScriptedCaptureEnvironment(request.states, request.resourceBaseURL);
    const inspections: ScriptedFrameInspection[] = [];
    const preencodeDigests: ScriptedPreencodeDigest[] = [];
    const digestFrames = new Set(request.digestFrames ?? []);
    const rangeStart = frameRangeStart(request.frameRange);
    let renderedFrameOffset = 0;
    const props: ScriptedCompositionProps = {
        defaults: request.defaults,
        recipe: request.recipe,
        timeline: request.timeline,
        states: request.states,
        performance: request.performance,
        telemetry: request.telemetry,
        masterAudioUrl: request.masterAudioUrl,
        patchLabel: request.patchLabel,
        resourceBaseURL: request.resourceBaseURL,
        onFrameSettled: (inspection) => inspections.push(inspection),
    };
    const captureTime = new ScriptedCaptureTimeController();
    const restoreCaptureTime = captureTime.install();
    try {
        const result = await renderMediaOnWeb({
            composition: {
                id: "cosimo-scripted-sound-speedrun",
                component: ScriptedSessionComposition,
                durationInFrames: request.timeline.durationInFrames,
                fps: request.timeline.fps,
                width: SPEEDRUN_VIDEO_WIDTH,
                height: SPEEDRUN_VIDEO_HEIGHT,
                defaultProps: props,
            },
            inputProps: props,
            container: request.format.container,
            videoCodec: request.format.videoCodec,
            audioCodec: request.masterAudioUrl ? request.format.audioCodec : null,
            sampleRate: request.timeline.sampleRate,
            videoBitrate: request.videoBitrate ?? "high",
            audioBitrate: "medium",
            frameRange: request.frameRange,
            muted: request.masterAudioUrl === null,
            delayRenderTimeoutInMilliseconds: 90_000,
            logLevel: "warn",
            signal: request.signal,
            onFrame: async (videoFrame) => {
                const frame = rangeStart + renderedFrameOffset;
                renderedFrameOffset += 1;
                if (digestFrames.has(frame)) {
                    preencodeDigests.push({ frame, ...(await digestVideoFrame(videoFrame)) });
                }
                return videoFrame;
            },
            onProgress: ({ progress, renderedFrames, encodedFrames }) => {
                request.onProgress?.({ progress, renderedFrames, encodedFrames });
            },
        });
        return {
            blob: await result.getBlob(),
            preencodeDigests,
            inspections,
            iframeRafMode: "current-document",
        };
    } finally {
        restoreCaptureTime();
    }
}

type IframeRuntime = {
    render(request: ScriptedRenderRequest): Promise<ScriptedRenderResult>;
};

declare global {
    interface Window {
        __COSIMO_SCRIPTED_IFRAME__?: IframeRuntime;
        __COSIMO_SCRIPTED_IFRAME_ERROR__?: string;
    }
}

function waitForIframeRuntime(iframe: HTMLIFrameElement) {
    return new Promise<IframeRuntime>((resolve, reject) => {
        const startedAt = performance.now();
        const poll = () => {
            const child = iframe.contentWindow;
            if (child?.__COSIMO_SCRIPTED_IFRAME__) {
                resolve(child.__COSIMO_SCRIPTED_IFRAME__);
                return;
            }
            if (child?.__COSIMO_SCRIPTED_IFRAME_ERROR__) {
                reject(new Error(child.__COSIMO_SCRIPTED_IFRAME_ERROR__));
                return;
            }
            if (performance.now() - startedAt > 90_000) {
                reject(new Error("The scripted render iframe did not load within 90 seconds."));
                return;
            }
            window.setTimeout(poll, 10);
        };
        poll();
    });
}

async function hiddenIframeRafRuns(iframe: HTMLIFrameElement) {
    const child = iframe.contentWindow;
    if (!child) return false;
    return Promise.race([
        new Promise<boolean>((resolve) => {
            child.requestAnimationFrame(() => child.requestAnimationFrame(() => resolve(true)));
        }),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 500)),
    ]);
}

/**
 * Establish the 393x852 viewport seam and import this renderer again inside
 * that same-origin realm so media queries, fixed overlays, and rAF are local.
 */
export async function renderScriptedVideoInIframe(
    request: ScriptedRenderRequest,
    { moduleURL = import.meta.url }: { readonly moduleURL?: string } = {},
): Promise<ScriptedRenderResult> {
    const iframe = document.createElement("iframe");
    iframe.title = "Cosimo scripted video renderer";
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
        border: "0",
        height: "852px",
        left: "0",
        pointerEvents: "none",
        position: "fixed",
        top: "0",
        visibility: "hidden",
        width: "393px",
    });
    const bundledStyle = /\/index\.js(?:[?#]|$)/u.test(moduleURL)
        ? `<link rel="stylesheet" href=${JSON.stringify(new URL("./style.css", moduleURL).href)}>`
        : "";
    iframe.srcdoc = `<!doctype html>
<html><head><meta charset="utf-8">${bundledStyle}
<style>html,body{margin:0;width:393px;height:852px;overflow:visible;background:#07080c}</style></head>
<body><script type="module">
import(${JSON.stringify(moduleURL)}).then(({ renderScriptedVideoInCurrentDocument }) => {
    window.__COSIMO_SCRIPTED_IFRAME__ = { render: renderScriptedVideoInCurrentDocument };
}).catch((error) => {
    window.__COSIMO_SCRIPTED_IFRAME_ERROR__ = error?.stack || error?.message || String(error);
});
</script></body></html>`;
    document.body.append(iframe);

    try {
        const runtime = await waitForIframeRuntime(iframe);
        const hiddenRafRuns = await hiddenIframeRafRuns(iframe);
        if (!hiddenRafRuns) {
            // Documented plan fallback: keep it in layout and transparent if
            // this browser throttles a visibility-hidden child realm.
            iframe.style.visibility = "visible";
            iframe.style.opacity = "0";
            iframe.style.transform = "scale(0.001)";
            iframe.style.transformOrigin = "top left";
        }
        const result = await runtime.render(request);
        // Blob identity is realm-specific. Re-home the completed bytes before
        // removing the iframe so parent-realm verifiers (Mediabunny included)
        // accept the result as a native Blob.
        const blob = new Blob(
            [new Uint8Array(await result.blob.arrayBuffer())],
            { type: result.blob.type },
        );
        return {
            ...result,
            blob,
            iframeRafMode: hiddenRafRuns ? "visibility-hidden" : "opacity-fallback",
        };
    } finally {
        iframe.remove();
    }
}
