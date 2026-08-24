/**
 * DEPRECATED (frame-stepped rasterizer render): superseded by the live-performance render path in
 * ui/speedrun/live/ (see VIDEO_BOUNCE_LIVE_RENDER_PLAN.md). Kept only as the
 * VITE_COSIMO_VIDEO_BOUNCE_SCRIPTED=1 escape hatch until the live render is
 * accepted; scheduled for deletion with its suites afterwards.
 */
import { renderMediaOnWeb } from "@remotion/web-renderer";

import { WORKSPACE_SHELL_STORAGE_KEY } from "../../shared/workspace-shell";
import {
    SPEEDRUN_VIDEO_HEIGHT,
    SPEEDRUN_VIDEO_WIDTH,
} from "../stage";
import type { SpeedrunVideoFormat } from "../studio/video-support";
import { ScriptedCaptureTimeController } from "./capture-time";
import {
    prepareScriptedCaptureEnvironment,
    ScriptedSessionComposition,
    type ScriptedCompositionProps,
    type ScriptedFrameInspection,
} from "./scripted-composition";

const VIDEO_BOUNCE_BUNDLE_FILE = "index.js";
const VIDEO_BOUNCE_STYLE_FILE = "style.css";

export type ScriptedPreencodeDigest = {
    readonly frame: number;
    readonly sha256: string;
};

export type ScriptedRegionPixelStats = {
    readonly pixels: number;
    readonly meanLuma: number;
    readonly lumaRange: number;
    readonly maxSaturation: number;
};

export type ScriptedPixelProbe = {
    readonly frame: number;
    readonly regions: Readonly<Record<string, ScriptedRegionPixelStats>>;
};

export type ScriptedContactSheetFrame = {
    readonly frame: number;
    readonly dataUrl: string;
};

export type ScriptedRenderRequest = Omit<
    ScriptedCompositionProps,
    "onFrameSettled"
> & {
    readonly format: SpeedrunVideoFormat;
    readonly videoBitrate?: "very-low" | "low" | "medium" | "high";
    readonly frameRange?: number | [number, number];
    readonly digestFrames?: ReadonlyArray<number>;
    /**
     * Frames whose captured pixels are sampled inside the inspection rects —
     * the paint-level gate that keeps "the DOM node exists" from standing in
     * for "the pixels are on screen".
     */
    readonly pixelProbeFrames?: ReadonlyArray<number>;
    /** Frames exported as PNG data URLs for a human-reviewable contact sheet. */
    readonly contactSheetFrames?: ReadonlyArray<number>;
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
    readonly pixelProbes: ReadonlyArray<ScriptedPixelProbe>;
    readonly contactSheet: ReadonlyArray<ScriptedContactSheetFrame>;
    readonly iframeRafMode: "current-document" | "visibility-hidden" | "opacity-fallback";
};

function hex(bytes: Uint8Array) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function drawVideoFrame(frame: VideoFrame) {
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("A 2D canvas is required for pre-encode frame verification.");
    context.drawImage(frame, 0, 0);
    return { canvas, context };
}

async function digestCanvas(context: OffscreenCanvasRenderingContext2D, width: number, height: number) {
    const pixels = context.getImageData(0, 0, width, height).data;
    return {
        sha256: hex(new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))),
    };
}

function sampleRegion(
    context: OffscreenCanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
): ScriptedRegionPixelStats | null {
    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    const right = Math.min(canvasWidth, Math.ceil(rect.left + rect.width));
    const bottom = Math.min(canvasHeight, Math.ceil(rect.top + rect.height));
    if (right - left < 1 || bottom - top < 1) return null;
    const pixels = context.getImageData(left, top, right - left, bottom - top).data;
    let lumaTotal = 0;
    let lumaMin = 255;
    let lumaMax = 0;
    let maxSaturation = 0;
    const pixelCount = pixels.length / 4;
    for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const luma = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        lumaTotal += luma;
        if (luma < lumaMin) lumaMin = luma;
        if (luma > lumaMax) lumaMax = luma;
        const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (saturation > maxSaturation) maxSaturation = saturation;
    }
    return {
        pixels: pixelCount,
        meanLuma: lumaTotal / pixelCount,
        lumaRange: lumaMax - lumaMin,
        maxSaturation,
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
    // The iframe path shadows web storage entirely (see the srcdoc bootstrap);
    // this remains for the direct-document path the test fixtures use, so a
    // stale shell state can never leak into a capture.
    sessionStorage.removeItem(WORKSPACE_SHELL_STORAGE_KEY);
    await awaitDocumentStyles();
    await prepareScriptedCaptureEnvironment(request.states, request.resourceBaseURL);
    const inspections: ScriptedFrameInspection[] = [];
    const preencodeDigests: ScriptedPreencodeDigest[] = [];
    const pixelProbes: ScriptedPixelProbe[] = [];
    const contactSheet: ScriptedContactSheetFrame[] = [];
    const digestFrames = new Set(request.digestFrames ?? []);
    const pixelProbeFrames = new Set(request.pixelProbeFrames ?? []);
    const contactSheetFrames = new Set(request.contactSheetFrames ?? []);
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
                const wantsDigest = digestFrames.has(frame);
                const wantsProbe = pixelProbeFrames.has(frame);
                const wantsContact = contactSheetFrames.has(frame);
                if (wantsDigest || wantsProbe || wantsContact) {
                    const { canvas, context } = drawVideoFrame(videoFrame);
                    if (wantsDigest) {
                        preencodeDigests.push({
                            frame,
                            ...(await digestCanvas(context, canvas.width, canvas.height)),
                        });
                    }
                    if (wantsProbe) {
                        // The settled inspection for this frame was pushed just
                        // before capture, so it is always the latest entry.
                        const inspection = inspections.at(-1);
                        const regions: Record<string, ScriptedRegionPixelStats> = {};
                        for (const [name, rect] of Object.entries(inspection?.rects ?? {})) {
                            if (!rect) continue;
                            const stats = sampleRegion(context, canvas.width, canvas.height, rect);
                            if (stats) regions[name] = stats;
                        }
                        pixelProbes.push({ frame, regions });
                    }
                    if (wantsContact) {
                        const blob = await canvas.convertToBlob({ type: "image/png" });
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(String(reader.result));
                            reader.onerror = () => reject(new Error("Contact-sheet PNG encoding failed."));
                            reader.readAsDataURL(blob);
                        });
                        contactSheet.push({ frame, dataUrl });
                    }
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
            pixelProbes,
            contactSheet,
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

function waitForIframeRuntime(iframe: HTMLIFrameElement, signal: AbortSignal | undefined) {
    return new Promise<IframeRuntime>((resolve, reject) => {
        const startedAt = performance.now();
        const poll = () => {
            if (signal?.aborted) {
                reject(new DOMException("Cancelled", "AbortError"));
                return;
            }
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

/**
 * Rejections from the srcdoc realm carry that realm's Error/DOMException
 * constructors, so the parent's instanceof-based classification (cancel
 * detection, message preservation in studioError) silently fails on them.
 * Rebuild the error with parent-realm identity — the same treatment the
 * result Blob gets.
 */
function rehomeCrossRealmError(raw: unknown): Error {
    if (raw instanceof Error) return raw;
    const record = raw as { message?: unknown; name?: unknown } | null;
    const message = typeof record?.message === "string" ? record.message : String(raw);
    const name = typeof record?.name === "string" ? record.name : "Error";
    if (name === "AbortError") {
        return new DOMException(message || "Cancelled", "AbortError") as unknown as Error;
    }
    const rehomed = new Error(message, { cause: raw });
    rehomed.name = name;
    return rehomed;
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
    // These two names are the contract with ui/vite.video-bounce.config.mjs
    // (lib fileName "index.js", assetFileNames "style.css"): from the built
    // bundle the extracted stylesheet must be linked here; from a dev-server
    // module URL vite injects CSS itself and the link would 404.
    const bundledStyle = new RegExp(`/${VIDEO_BOUNCE_BUNDLE_FILE.replace(".", "\\.")}(?:[?#]|$)`, "u").test(moduleURL)
        ? `<link rel="stylesheet" href=${JSON.stringify(new URL(`./${VIDEO_BOUNCE_STYLE_FILE}`, moduleURL).href)}>`
        : "";
    iframe.srcdoc = `<!doctype html>
<html><head><meta charset="utf-8">${bundledStyle}
<style>html,body{margin:0;width:393px;height:852px;overflow:visible;background:#07080c}</style></head>
<body><script type="module">
// A same-origin srcdoc iframe shares the parent's web storage. Shadow both
// stores with in-memory stubs BEFORE product code loads, so a stale shell or
// rail-dock state cannot leak into the capture and the scripted navigation
// cannot pollute the user's real session.
for (const storageName of ["sessionStorage", "localStorage"]) {
    const entries = new Map();
    Object.defineProperty(window, storageName, {
        configurable: true,
        value: {
            get length() { return entries.size; },
            key: (index) => [...entries.keys()][index] ?? null,
            getItem: (key) => (entries.has(String(key)) ? entries.get(String(key)) : null),
            setItem: (key, value) => { entries.set(String(key), String(value)); },
            removeItem: (key) => { entries.delete(String(key)); },
            clear: () => { entries.clear(); },
        },
    });
}
import(${JSON.stringify(moduleURL)}).then(({ renderScriptedVideoInCurrentDocument }) => {
    window.__COSIMO_SCRIPTED_IFRAME__ = { render: renderScriptedVideoInCurrentDocument };
}).catch((error) => {
    window.__COSIMO_SCRIPTED_IFRAME_ERROR__ = error?.stack || error?.message || String(error);
});
</script></body></html>`;
    document.body.append(iframe);

    try {
        const runtime = await waitForIframeRuntime(iframe, request.signal);
        const hiddenRafRuns = await hiddenIframeRafRuns(iframe);
        if (request.signal?.aborted) {
            throw new DOMException("Cancelled", "AbortError");
        }
        if (!hiddenRafRuns) {
            // Documented plan fallback: keep it in layout and transparent if
            // this browser throttles a visibility-hidden child realm.
            iframe.style.visibility = "visible";
            iframe.style.opacity = "0";
            iframe.style.transform = "scale(0.001)";
            iframe.style.transformOrigin = "top left";
        }
        const result = await runtime.render(request).catch((error: unknown) => {
            throw rehomeCrossRealmError(error);
        });
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
