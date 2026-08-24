import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import { CaptionPanel } from "./captions";
import { gestureAtFrame } from "./gestures";
import { SpeedrunPhoneUI, type SpeedrunWavetableFrames } from "./phone-ui";
import { speedrunVisualStateAtFrame } from "./state";
import "./styles.css";
import "../../shared/editor-tokens.css";
import "../../shared/synth-style-guide.css";

export const SPEEDRUN_VIDEO_WIDTH = 1_080 as const;
export const SPEEDRUN_VIDEO_HEIGHT = 1_920 as const;
export const SPEEDRUN_END_CARD_FRAMES = 45 as const;
/** Compensates the measured one-frame AAC priming offset; timeline lead-in is silent. */
export const SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES = 1 as const;

export type SpeedrunCompositionProps = {
    readonly recipe: SpeedrunRecipe;
    readonly timeline: SpeedrunTimeline;
    readonly masterAudioUrl: string;
    readonly patchLabel: string;
    readonly wavetableFrames?: SpeedrunWavetableFrames;
};

export type SpeedrunFrameProps = Omit<SpeedrunCompositionProps, "masterAudioUrl"> & {
    readonly frame: number;
};

function TitleCard({ label, frame }: { readonly label: string; readonly frame: number }) {
    const opacity = interpolate(frame, [0, 8, 30, 42], [1, 1, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
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

/** Explicit-frame scene used by both Remotion and the frame-purity browser harness. */
export function SpeedrunFrame({ recipe, timeline, patchLabel, wavetableFrames, frame }: SpeedrunFrameProps) {
    const boundedFrame = Math.min(Math.max(0, Math.floor(frame)), Math.max(0, timeline.durationInFrames - 1));
    const state = speedrunVisualStateAtFrame(recipe, timeline, boundedFrame);
    const gesture = gestureAtFrame(timeline, boundedFrame);
    const endCardStart = Math.max(0, timeline.durationInFrames - SPEEDRUN_END_CARD_FRAMES);
    const showEndCard = boundedFrame >= endCardStart;
    return (
        <div className="speedrun-video-frame" data-frame={boundedFrame}>
            <div className="speedrun-ambient speedrun-ambient-one" />
            <div className="speedrun-ambient speedrun-ambient-two" />
            <div className="speedrun-phone-stage">
                <SpeedrunPhoneUI state={state} gesture={gesture} frameSets={wavetableFrames} />
            </div>
            <CaptionPanel section={state.section} frame={boundedFrame} />
            {boundedFrame < 43 ? <TitleCard label={patchLabel} frame={boundedFrame} /> : null}
            {showEndCard ? <EndCard label={patchLabel} /> : null}
            <footer><span>COSIMO / SOUND SPEEDRUN</span><b>{String(boundedFrame + 1).padStart(4, "0")}</b></footer>
        </div>
    );
}

export function SpeedrunComposition(props: SpeedrunCompositionProps): React.JSX.Element {
    const frame = useCurrentFrame();
    return (
        <AbsoluteFill style={{ backgroundColor: "#07080c" }}>
            <Audio src={props.masterAudioUrl} trimBefore={SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES} />
            <SpeedrunFrame {...props} frame={frame} />
        </AbsoluteFill>
    );
}
