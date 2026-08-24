import { Audio } from "@remotion/media";
import React, {
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { flushSync } from "react-dom";
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
    useDelayRender,
    useVideoConfig,
} from "remotion";

import { DesktopPatchView } from "../../desktop/DesktopPatchView";
import { createSpeedrunResourceClient, prefetchSpeedrunWavetableResources } from "../audio/resources";
import type { SpeedrunTelemetryTrack } from "../audio/telemetry";
import type { NotePerformance } from "../audio/checkpoint-renderer";
import type { DefaultsSnapshot } from "../patch-io";
import type { CumulativePatchState } from "../partial-states";
import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import { CaptionPanel } from "../composition/captions";
import {
    SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES,
    SPEEDRUN_END_CARD_FRAMES,
} from "../composition/composition";
import { settleCaptureSubtree } from "./capture-fidelity";
import { requireScriptedCaptureTimeController } from "./capture-time";
import { createCapturePianoKeyboardClass } from "./capture-piano-keyboard";
import {
    ScriptedPatchConnection,
    type ScriptedConnectionFrameSnapshot,
} from "./scripted-patch-connection";
import {
    ScriptedInteractionDirector,
    type ScriptedInteractionSnapshot,
} from "./interaction-script";

import "../composition/styles.css";
import "../../desktop/styles.css";
import "./scripted-styles.css";

export type ScriptedFrameInspection = {
    readonly frame: number;
    readonly workspace: string | null;
    readonly canvasCount: number;
    readonly svgCount: number;
    readonly keyboardNoteCount: number;
    readonly keyboardActiveNoteCount: number;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly scaffoldHitTestable: boolean;
    readonly connection: ScriptedConnectionFrameSnapshot;
    readonly interaction: ScriptedInteractionSnapshot;
};

export type ScriptedCompositionProps = {
    readonly defaults: DefaultsSnapshot;
    readonly recipe: SpeedrunRecipe;
    readonly timeline: SpeedrunTimeline;
    readonly states: ReadonlyArray<CumulativePatchState>;
    readonly performance: NotePerformance;
    readonly telemetry: SpeedrunTelemetryTrack;
    readonly masterAudioUrl: string | null;
    readonly patchLabel: string;
    readonly resourceBaseURL: string;
    readonly onFrameSettled?: (inspection: ScriptedFrameInspection) => void;
};

type ScriptedCaptureEnvironment = {
    readonly keyboardClass: CustomElementConstructor;
    readonly resourceClient: ReturnType<typeof createSpeedrunResourceClient>;
};

let captureEnvironment: ScriptedCaptureEnvironment | null = null;

export async function prepareScriptedCaptureEnvironment(
    states: ReadonlyArray<CumulativePatchState>,
    resourceBaseURL: string,
) {
    const [keyboardModule, resourceBundle] = await Promise.all([
        import(/* @vite-ignore */ new URL("cmaj_api/cmaj-piano-keyboard.js", resourceBaseURL).href),
        prefetchSpeedrunWavetableResources(states, resourceBaseURL),
    ]);
    const NativePianoKeyboard = (
        (keyboardModule as { default?: unknown }).default
        ?? (keyboardModule as { PianoKeyboard?: unknown }).PianoKeyboard
    );
    if (typeof NativePianoKeyboard !== "function") {
        throw new Error("The real Cmajor piano keyboard class could not be loaded for capture.");
    }
    captureEnvironment = {
        keyboardClass: createCapturePianoKeyboardClass(
            NativePianoKeyboard as CustomElementConstructor,
        ),
        resourceClient: createSpeedrunResourceClient(resourceBundle),
    };
    await document.fonts.ready;
}

function requireCaptureEnvironment() {
    if (captureEnvironment === null) {
        throw new Error("The scripted capture environment was not prepared before render.");
    }
    return captureEnvironment;
}

function revealRemotionScaffold(root: HTMLElement) {
    let ancestor: HTMLElement | null = root.parentElement;
    while (ancestor && ancestor !== document.body) {
        if (ancestor.style.visibility === "hidden") {
            ancestor.style.visibility = "visible";
            ancestor.style.pointerEvents = "auto";
            ancestor.dataset.scriptedCaptureScaffold = "true";
            return;
        }
        ancestor = ancestor.parentElement;
    }
}

function inspectFrame(
    root: HTMLElement,
    frame: number,
    connection: ScriptedPatchConnection,
    interaction: ScriptedInteractionDirector,
): ScriptedFrameInspection {
    return {
        frame,
        workspace: root.querySelector('[data-role^="mobile-workspace-tab-"][aria-selected="true"]')
            ?.getAttribute("data-role") ?? null,
        canvasCount: root.querySelectorAll("canvas").length,
        svgCount: root.querySelectorAll("svg").length,
        keyboardNoteCount: root.querySelectorAll(".keyboard .note").length,
        keyboardActiveNoteCount: root.querySelectorAll(".keyboard .note.active").length,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scaffoldHitTestable: root.closest('[data-scripted-capture-scaffold="true"]') !== null,
        connection: connection.getFrameSnapshot(),
        interaction: interaction.inspect(root),
    };
}

function FrameDirector({
    connection,
    interaction,
    captureRoot,
    fingerOverlay,
    onFrameSettled,
}: {
    readonly connection: ScriptedPatchConnection;
    readonly interaction: ScriptedInteractionDirector;
    readonly captureRoot: React.RefObject<HTMLDivElement | null>;
    readonly fingerOverlay: React.RefObject<SVGSVGElement | null>;
    readonly onFrameSettled?: (inspection: ScriptedFrameInspection) => void;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const { delayRender, continueRender, cancelRender } = useDelayRender();
    const captureTime = requireScriptedCaptureTimeController();

    useLayoutEffect(() => {
        const handle = delayRender(`Scripted DesktopPatchView frame ${frame}`);
        let cancelled = false;
        void (async () => {
            const root = captureRoot.current;
            if (!root) throw new Error("The scripted DesktopPatchView capture root is missing.");
            revealRemotionScaffold(root);
            captureTime.setMediaTime(frame, fps);
            await Promise.resolve();
            flushSync(() => {
                connection.advanceToFrame(frame);
                interaction.advance(root, fingerOverlay.current, frame, fps);
            });
            await Promise.resolve();
            await interaction.scrubAnimations(root, frame, fps);
            flushSync(() => captureTime.flushDueTimeouts());
            captureTime.flushAnimationFrames();
            await settleCaptureSubtree(root, {
                scrubAnimations: () => interaction.scrubAnimations(root, frame, fps),
            });
            if (!cancelled) {
                onFrameSettled?.(inspectFrame(root, frame, connection, interaction));
                continueRender(handle);
            }
        })().catch((error) => {
            if (!cancelled) {
                cancelRender(error instanceof Error ? error : new Error(String(error)));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [cancelRender, captureRoot, captureTime, connection, continueRender, delayRender, fingerOverlay, fps, frame, interaction, onFrameSettled]);

    return null;
}

function TitleCard({ label, frame }: { readonly label: string; readonly frame: number }) {
    const opacity = interpolate(frame, [0, 8, 30, 42], [1, 1, 0.9, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    return (
        <div className="speedrun-title-card" style={{ opacity }}>
            <small>SOUND SPEEDRUN</small><strong>{label}</strong><span>FROM INIT TO FINISH</span>
        </div>
    );
}

function EndCard({ label }: { readonly label: string }) {
    return (
        <div className="speedrun-end-card">
            <small>YOU JUST HEARD</small>
            <strong>{label}</strong>
            <span>Made with Cosimo</span>
        </div>
    );
}

export function ScriptedSessionComposition(props: ScriptedCompositionProps) {
    const frame = useCurrentFrame();
    const captureRoot = useRef<HTMLDivElement>(null);
    const fingerOverlay = useRef<SVGSVGElement>(null);
    const environment = requireCaptureEnvironment();
    const [connection] = useState(() => new ScriptedPatchConnection(
        props.defaults,
        props.recipe,
        props.timeline,
        props.performance,
        props.telemetry,
        environment.keyboardClass,
        props.resourceBaseURL,
    ));
    const [interaction] = useState(() => new ScriptedInteractionDirector(props.timeline));
    const boundedFrame = Math.min(
        Math.max(0, Math.floor(frame)),
        Math.max(0, props.timeline.durationInFrames - 1),
    );
    const section = props.timeline.sections.find((candidate) => (
        boundedFrame >= candidate.startFrame && boundedFrame < candidate.endFrame
    )) ?? props.timeline.sections.at(-1) ?? null;
    const endCardStart = Math.max(0, props.timeline.durationInFrames - SPEEDRUN_END_CARD_FRAMES);

    return (
        <AbsoluteFill style={{ backgroundColor: "#07080c" }}>
            {props.masterAudioUrl ? (
                <Audio src={props.masterAudioUrl} trimBefore={SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES} />
            ) : null}
            <div className="speedrun-video-frame speedrun-scripted-frame" data-frame={boundedFrame}>
                <div className="speedrun-ambient speedrun-ambient-one" />
                <div className="speedrun-ambient speedrun-ambient-two" />
                <div className="speedrun-phone-stage">
                    <div
                        ref={captureRoot}
                        className="speedrun-scripted-phone"
                        data-role="scripted-desktop-patch-view"
                    >
                        <DesktopPatchView
                            patchConnection={connection}
                            resourceClient={environment.resourceClient}
                            keyboardInputMode="standalone-preview"
                        />
                    </div>
                    <svg
                        ref={fingerOverlay}
                        className="speedrun-finger-layer speedrun-scripted-finger"
                        data-role="scripted-finger-overlay"
                        viewBox="0 0 393 852"
                        aria-hidden="true"
                        style={{ display: "none" }}
                    >
                        <circle
                            data-role="scripted-finger-ring"
                            r="22"
                            fill="none"
                            stroke="rgba(255,255,255,0.9)"
                            strokeWidth="2"
                        />
                        <circle r="13" fill="rgba(0,0,0,0.48)" transform="translate(2 4)" />
                        <circle r="12" fill="#f3d4bd" stroke="#fff4ec" strokeWidth="2" />
                    </svg>
                </div>
                <CaptionPanel section={section} frame={boundedFrame} />
                {boundedFrame < 43 ? <TitleCard label={props.patchLabel} frame={boundedFrame} /> : null}
                {boundedFrame >= endCardStart ? <EndCard label={props.patchLabel} /> : null}
                <footer>
                    <span>COSIMO / SOUND SPEEDRUN</span>
                    <b>{String(boundedFrame + 1).padStart(4, "0")}</b>
                </footer>
                <FrameDirector
                    connection={connection}
                    interaction={interaction}
                    captureRoot={captureRoot}
                    fingerOverlay={fingerOverlay}
                    onFrameSettled={props.onFrameSettled}
                />
            </div>
        </AbsoluteFill>
    );
}
