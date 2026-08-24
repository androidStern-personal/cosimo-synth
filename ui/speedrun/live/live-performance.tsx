import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { DesktopPatchView } from "../../desktop/DesktopPatchView";
import {
    createSpeedrunResourceClient,
    prefetchSpeedrunWavetableResources,
} from "../audio/resources";
import type { SpeedrunTelemetryTrack } from "../audio/telemetry";
import type { DefaultsSnapshot } from "../patch-io";
import type { CumulativePatchState } from "../partial-states";
import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import type { NotePerformance } from "../midi/performance-events";
import { createCapturePianoKeyboardClass } from "../scripted/capture-piano-keyboard";
import {
    ScriptedInteractionDirector,
    type ScriptedMissedOp,
} from "../scripted/interaction-script";
import { LiveScriptedConnection } from "./live-connection";

export type LivePerformanceClock = {
    /** Seconds of performance time elapsed; the audio element when present. */
    seconds(): number;
};

export type LivePerformanceProps = {
    readonly defaults: DefaultsSnapshot;
    readonly recipe: SpeedrunRecipe;
    readonly timeline: SpeedrunTimeline;
    readonly states: ReadonlyArray<CumulativePatchState>;
    readonly performance: NotePerformance;
    readonly telemetry: SpeedrunTelemetryTrack;
    readonly resourceBaseURL: string;
};

export type LivePerformanceReport = {
    readonly missedOps: ReadonlyArray<ScriptedMissedOp>;
    readonly stateOnlyOps: ReadonlyArray<ScriptedMissedOp>;
    /** Timeline frames actually pumped (dropped rAF turns skip frames). */
    readonly pumpedFrames: number;
    readonly skippedFrames: number;
    readonly maxFrameSkip: number;
    readonly durationInFrames: number;
};

export type LivePerformanceHandle = {
    /** Starts pumping the director/connection from the clock. Completion is
        delivered ONLY through the parent-supplied hooks: a promise created in
        this iframe realm would die unsettled the moment the iframe detaches,
        stranding a parent that awaited it. */
    perform(clock: LivePerformanceClock, hooks: {
        onFrame?(frame: number): void;
        onDone(report: LivePerformanceReport): void;
        onError(error: unknown): void;
    }): void;
    dispose(): void;
};

export type LivePerformanceBootHooks = {
    onReady(handle: LivePerformanceHandle): void;
    onError(error: unknown): void;
};

/**
 * Mount the real DesktopPatchView in this (iframe) document and expose the
 * live performance pump. No render scaffold, no time virtualization: real
 * timers, real rAF, real animations — the compositor output IS the video.
 * Callback-style across the realm boundary for the same detachment reason
 * as perform above.
 */
export function runLivePerformanceInCurrentDocument(
    props: LivePerformanceProps,
    hooks: LivePerformanceBootHooks,
): void {
    prepareLivePerformance(props).then(hooks.onReady, hooks.onError);
}

async function prepareLivePerformance(
    props: LivePerformanceProps,
): Promise<LivePerformanceHandle> {
    const [keyboardModule, resourceBundle] = await Promise.all([
        import(/* @vite-ignore */ new URL("cmaj_api/cmaj-piano-keyboard.js", props.resourceBaseURL).href),
        prefetchSpeedrunWavetableResources(props.states, props.resourceBaseURL),
    ]);
    const NativePianoKeyboard = (
        (keyboardModule as { default?: unknown }).default
        ?? (keyboardModule as { PianoKeyboard?: unknown }).PianoKeyboard
    );
    if (typeof NativePianoKeyboard !== "function") {
        throw new Error("The real Cmajor piano keyboard class could not be loaded for the live performance.");
    }

    const connection = new LiveScriptedConnection(
        props.defaults,
        props.recipe,
        props.timeline,
        props.performance,
        props.telemetry,
        createCapturePianoKeyboardClass(NativePianoKeyboard as CustomElementConstructor),
        props.resourceBaseURL,
    );
    const resourceClient = createSpeedrunResourceClient(resourceBundle);

    const host = document.createElement("div");
    host.dataset.role = "live-desktop-patch-view";
    host.style.cssText = "position:relative;width:393px;height:852px;overflow:hidden;background:#0d0e10;color-scheme:dark;";
    const finger = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    finger.setAttribute("viewBox", "0 0 393 852");
    finger.setAttribute("aria-hidden", "true");
    finger.dataset.role = "scripted-finger-overlay";
    finger.style.cssText = "position:absolute;inset:0;width:393px;height:852px;z-index:60;pointer-events:none;overflow:visible;display:none;filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.55));";
    finger.innerHTML = `
        <circle data-role="scripted-finger-ring" r="22" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2"></circle>
        <circle r="13" fill="rgba(0,0,0,0.48)" transform="translate(2 4)"></circle>
        <circle r="12" fill="#f3d4bd" stroke="#fff4ec" stroke-width="2"></circle>
    `;
    document.body.append(host, finger);

    let reactRoot: Root | null = createRoot(host);
    reactRoot.render(
        <DesktopPatchView
            patchConnection={connection}
            resourceClient={resourceClient}
            keyboardInputMode="standalone-preview"
        />,
    );

    // Let the mount, fonts, and first paints settle on the initial patch
    // state so the performance opens on a fully drawn frame 0: wait until the
    // real keyboard and a canvas exist, then prime runtime activation (the
    // wavetable displays need it to show their active tables) and give the
    // compositor a few frames to draw everything.
    connection.publishFrame(0);
    await document.fonts.ready;
    const settleDeadline = performance.now() + 5_000;
    while (performance.now() < settleDeadline) {
        if (host.querySelectorAll(".keyboard .note").length > 0 && host.querySelector("canvas") !== null) {
            break;
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    connection.primeInitialRuntimeState();
    for (let settleFrame = 0; settleFrame < 8; settleFrame += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }

    const director = new ScriptedInteractionDirector(props.timeline, props.defaults.annotations);
    const fps = props.timeline.fps;
    const lastFrame = Math.max(0, props.timeline.durationInFrames - 1);
    let disposed = false;
    let raf = 0;
    let notifyDisposed: ((error: unknown) => void) | null = null;

    return {
        perform(clock, hooks) {
            let settled = false;
            const done = (report: LivePerformanceReport) => {
                if (settled) return;
                settled = true;
                notifyDisposed = null;
                hooks.onDone(report);
            };
            const fail = (error: unknown) => {
                if (settled) return;
                settled = true;
                notifyDisposed = null;
                hooks.onError(error);
            };
            notifyDisposed = fail;
            let pumped = -1;
            let pumpedFrames = 0;
            let skippedFrames = 0;
            let maxFrameSkip = 0;
            const pump = () => {
                if (disposed) {
                    fail(new DOMException("Cancelled", "AbortError"));
                    return;
                }
                try {
                    const frame = Math.min(lastFrame, Math.floor(clock.seconds() * fps));
                    if (frame > pumped) {
                        if (pumped >= 0) {
                            const skip = frame - pumped - 1;
                            skippedFrames += skip;
                            maxFrameSkip = Math.max(maxFrameSkip, skip);
                        }
                        connection.publishFrame(frame);
                        director.advance(host, finger, frame, fps);
                        pumped = frame;
                        pumpedFrames += 1;
                        hooks.onFrame?.(frame);
                    }
                    if (pumped >= lastFrame && clock.seconds() * fps >= props.timeline.durationInFrames) {
                        const finalInspection = director.inspect(host);
                        done({
                            missedOps: finalInspection.missedOps,
                            stateOnlyOps: finalInspection.stateOnlyOps,
                            pumpedFrames,
                            skippedFrames,
                            maxFrameSkip,
                            durationInFrames: props.timeline.durationInFrames,
                        });
                        return;
                    }
                } catch (error) {
                    fail(error);
                    return;
                }
                raf = requestAnimationFrame(pump);
            };
            raf = requestAnimationFrame(pump);
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(raf);
            notifyDisposed?.(new DOMException("Cancelled", "AbortError"));
            notifyDisposed = null;
            reactRoot?.unmount();
            reactRoot = null;
            host.remove();
            finger.remove();
        },
    };
}
