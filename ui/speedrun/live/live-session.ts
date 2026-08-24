import React from "react";
import { createRoot } from "react-dom/client";

import type { SpeedrunTelemetryTrack } from "../audio/telemetry";
import type { DefaultsSnapshot } from "../patch-io";
import type { CumulativePatchState } from "../partial-states";
import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import type { NotePerformance } from "../midi/performance-events";
import { LiveStage } from "./live-stage";
import { acquireLiveStageRecorder } from "./live-recorder";
import type {
    LivePerformanceClock,
    LivePerformanceHandle,
    LivePerformanceProps,
    LivePerformanceReport,
} from "./live-performance";

export type LiveSessionRequest = {
    readonly defaults: DefaultsSnapshot;
    readonly recipe: SpeedrunRecipe;
    readonly timeline: SpeedrunTimeline;
    readonly states: ReadonlyArray<CumulativePatchState>;
    readonly performance: NotePerformance;
    readonly telemetry: SpeedrunTelemetryTrack;
    readonly patchLabel: string;
    readonly resourceBaseURL: string;
    /** Master audio object URL; null runs a silent wall-clock performance. */
    readonly masterAudioUrl: string | null;
    /** Record the stage via Region Capture; off for preview/review runs. */
    readonly record: boolean;
    readonly preferredContainer?: "mp4" | "webm";
    /** Review-only fast-forward for unrecorded wall-clock runs: the
        performance opens already advanced to this time. */
    readonly startAtSeconds?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: { readonly frame: number; readonly durationInFrames: number }) => void;
};

export type LiveSessionResult = {
    /** The finished recording; null for unrecorded preview performances. */
    readonly blob: Blob | null;
    readonly mimeType: string | null;
    readonly report: LivePerformanceReport;
};

type LiveIframeRuntime = {
    run(props: LivePerformanceProps, hooks: {
        onReady(handle: LivePerformanceHandle): void;
        onError(error: unknown): void;
    }): void;
};

/** Copy a cross-realm failure into this realm before its realm can die. */
function rehomeLiveError(error: unknown): Error {
    if (error && typeof error === "object") {
        const name = String(Reflect.get(error, "name") ?? "");
        const message = String(Reflect.get(error, "message") ?? error);
        if (name === "AbortError") return new DOMException(message || "Cancelled", "AbortError");
        const rehomed = new Error(message);
        const stack = Reflect.get(error, "stack");
        if (typeof stack === "string") rehomed.stack = stack;
        return rehomed;
    }
    return new Error(String(error));
}

const RUNTIME_POLL_MILLISECONDS = 40;
const RUNTIME_TIMEOUT_MILLISECONDS = 30_000;
/** Real settle after the final frame before the recording stops. */
const RECORDING_TAIL_MILLISECONDS = 400;

function createPhoneIframe(moduleURL: string): HTMLIFrameElement {
    const iframe = document.createElement("iframe");
    iframe.title = "Cosimo live performance";
    iframe.width = "393";
    iframe.height = "852";
    const bundledStyle = /\/index\.js(?:[?#]|$)/u.test(moduleURL)
        ? `<link rel="stylesheet" href=${JSON.stringify(new URL("./style.css", moduleURL).href)}>`
        : "";
    iframe.srcdoc = `<!doctype html>
<html><head><meta charset="utf-8">${bundledStyle}
<style>html,body{margin:0;width:393px;height:852px;overflow:hidden;background:#0d0e10}</style></head>
<body><script type="module">
// A same-origin srcdoc iframe shares the parent's web storage. Shadow both
// stores with in-memory stubs BEFORE product code loads, so a stale shell or
// rail-dock state cannot leak into the performance and the scripted
// navigation cannot pollute the user's real session.
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
import(${JSON.stringify(moduleURL)}).then((module) => {
    window.__COSIMO_LIVE_IFRAME__ = { run: module.runLivePerformanceInCurrentDocument };
}).catch((error) => {
    window.__COSIMO_LIVE_IFRAME_ERROR__ = error?.stack || error?.message || String(error);
});
</script></body></html>`;
    return iframe;
}

async function waitForLiveRuntime(iframe: HTMLIFrameElement, signal?: AbortSignal): Promise<LiveIframeRuntime> {
    const startedAt = performance.now();
    while (performance.now() - startedAt < RUNTIME_TIMEOUT_MILLISECONDS) {
        if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        const view = iframe.contentWindow as (Window & {
            __COSIMO_LIVE_IFRAME__?: LiveIframeRuntime;
            __COSIMO_LIVE_IFRAME_ERROR__?: string;
        }) | null;
        if (view?.__COSIMO_LIVE_IFRAME_ERROR__) {
            throw new Error(`The live performance bundle failed to load: ${view.__COSIMO_LIVE_IFRAME_ERROR__}`);
        }
        if (view?.__COSIMO_LIVE_IFRAME__) return view.__COSIMO_LIVE_IFRAME__;
        await new Promise((resolve) => setTimeout(resolve, RUNTIME_POLL_MILLISECONDS));
    }
    throw new Error("The live performance iframe did not become ready.");
}

function createAudioClock(url: string): { clock: LivePerformanceClock; element: HTMLAudioElement } {
    const element = new Audio();
    element.src = url;
    element.preload = "auto";
    element.crossOrigin = "anonymous";
    return {
        element,
        clock: { seconds: () => element.currentTime },
    };
}

function createWallClock(startAtSeconds = 0): { start(): void; clock: LivePerformanceClock } {
    let startedAt: number | null = null;
    return {
        start() {
            startedAt = performance.now();
        },
        clock: {
            seconds: () => (startedAt === null ? 0 : startAtSeconds + ((performance.now() - startedAt) / 1_000)),
        },
    };
}

/**
 * Run one live render end to end: mount the stage, boot the product iframe,
 * (optionally) start Region Capture, play the master audio, perform the
 * script in real time, and hand back the recording plus the performance
 * report (missed ops, frame drops).
 */
export async function runLiveVideoSession(
    request: LiveSessionRequest,
    { moduleURL }: { readonly moduleURL: string },
): Promise<LiveSessionResult> {
    if (request.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const stageHost = document.createElement("div");
    document.body.append(stageHost);
    const stageRoot = createRoot(stageHost);
    const phone = createPhoneIframe(moduleURL);

    let frame = 0;
    const renderStage = () => {
        stageRoot.render(React.createElement(LiveStage, {
            label: request.patchLabel,
            timeline: request.timeline,
            frame,
            phone,
        }));
    };
    renderStage();

    const audio = request.masterAudioUrl !== null ? createAudioClock(request.masterAudioUrl) : null;
    const wall = audio === null ? createWallClock(request.startAtSeconds ?? 0) : null;
    const clock: LivePerformanceClock = audio?.clock ?? wall!.clock;

    let handle: LivePerformanceHandle | null = null;
    let recorder: Awaited<ReturnType<typeof acquireLiveStageRecorder>> | null = null;
    let chromePump = 0;
    let torndown = false;
    const teardown = () => {
        if (torndown) return;
        torndown = true;
        cancelAnimationFrame(chromePump);
        handle?.dispose();
        recorder?.cancel();
        audio?.element.pause();
        stageRoot.unmount();
        stageHost.remove();
    };
    const onAbort = () => teardown();
    request.signal?.addEventListener("abort", onAbort, { once: true });

    try {
        // Capture acquisition must run while the user's click activation is
        // fresh — before the seconds-long iframe boot consumes it.
        if (request.record) {
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
            const stageElement = stageHost.querySelector<HTMLElement>('[data-role="live-stage"]');
            if (!stageElement) throw new Error("The live stage did not mount.");
            recorder = await acquireLiveStageRecorder({
                stage: stageElement,
                preferredContainer: request.preferredContainer,
            });
        }
        const runtime = await waitForLiveRuntime(phone, request.signal);
        // Completion crosses the realm boundary through parent callbacks that
        // settle THIS realm's promises: an iframe-realm promise dies unsettled
        // the moment teardown detaches the iframe.
        handle = await new Promise<LivePerformanceHandle>((resolve, reject) => {
            runtime.run({
                defaults: request.defaults,
                recipe: request.recipe,
                timeline: request.timeline,
                states: request.states,
                performance: request.performance,
                telemetry: request.telemetry,
                resourceBaseURL: request.resourceBaseURL,
            }, {
                onReady: resolve,
                onError: (error) => reject(rehomeLiveError(error)),
            });
        });
        if (request.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

        recorder?.begin(audio?.element ?? null);

        // Keep the stage chrome (captions, cards) on the same clock. The
        // progress callback may abort the session synchronously, so re-check
        // teardown after every step that hands control out.
        const pumpChrome = () => {
            if (torndown) return;
            const next = Math.min(
                Math.max(0, request.timeline.durationInFrames - 1),
                Math.floor(clock.seconds() * request.timeline.fps),
            );
            if (next !== frame) {
                frame = next;
                renderStage();
                request.onProgress?.({ frame, durationInFrames: request.timeline.durationInFrames });
            }
            if (torndown) return;
            chromePump = requestAnimationFrame(pumpChrome);
        };
        chromePump = requestAnimationFrame(pumpChrome);

        if (audio !== null) {
            await audio.element.play();
        } else {
            wall!.start();
        }
        const activeHandle = handle;
        const report = await new Promise<LivePerformanceReport>((resolve, reject) => {
            activeHandle.perform(clock, {
                onDone: resolve,
                onError: (error) => reject(rehomeLiveError(error)),
            });
        });
        await new Promise((resolve) => setTimeout(resolve, RECORDING_TAIL_MILLISECONDS));
        if (request.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

        let blob: Blob | null = null;
        let mimeType: string | null = null;
        if (recorder !== null) {
            mimeType = recorder.mimeType.split(";")[0];
            blob = await recorder.stop();
            recorder = null;
        }
        return { blob, mimeType, report };
    } finally {
        request.signal?.removeEventListener("abort", onAbort);
        teardown();
    }
}
