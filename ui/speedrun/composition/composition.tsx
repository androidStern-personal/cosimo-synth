import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import type { SpeedrunRecipe } from "../recipe";
import type { SpeedrunTimeline } from "../timeline";
import { CaptionPanel } from "../stage-captions";
import {
    EndCard,
    SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES,
    SPEEDRUN_END_CARD_FRAMES,
    SPEEDRUN_TITLE_CARD_FRAMES,
    TitleCard,
} from "../stage";
import { gestureAtFrame } from "./gestures";
import { SpeedrunPhoneUI, type SpeedrunWavetableFrames } from "./phone-ui";
import { speedrunVisualStateAtFrame } from "./state";
import "./styles.css";
import "../stage.css";
import "../../shared/editor-tokens.css";
import "../../shared/synth-style-guide.css";

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
            {boundedFrame < SPEEDRUN_TITLE_CARD_FRAMES ? <TitleCard label={patchLabel} frame={boundedFrame} /> : null}
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
