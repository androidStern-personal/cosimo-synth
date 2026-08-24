import React, { useEffect, useRef } from "react";

import { CaptionPanel } from "../stage-captions";
import {
    EndCard,
    SPEEDRUN_END_CARD_FRAMES,
    SPEEDRUN_TITLE_CARD_FRAMES,
    TitleCard,
} from "../stage";
import type { SpeedrunTimeline } from "../timeline";
import "./live-stage.css";

export type LiveStageProps = {
    readonly label: string;
    readonly timeline: SpeedrunTimeline;
    readonly frame: number;
    /** The product iframe, created once by the session and adopted here. */
    readonly phone: HTMLIFrameElement;
};

/**
 * The 1x live stage: chrome around the untransformed product iframe. The
 * whole element is the capture region; everything inside it is real
 * compositor output.
 */
export function LiveStage({ label, timeline, frame, phone }: LiveStageProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const phoneSlot = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const slot = phoneSlot.current;
        if (!slot) return;
        slot.append(phone);
    }, [phone]);

    const section = timeline.sections.find((candidate) => (
        frame >= candidate.startFrame && frame < candidate.endFrame
    )) ?? timeline.sections.at(-1) ?? null;
    const endCardStart = Math.max(0, timeline.durationInFrames - SPEEDRUN_END_CARD_FRAMES);

    return (
        <div className="speedrun-live-backdrop" data-role="live-stage-backdrop">
            <div ref={stageRef} className="speedrun-live-stage" data-role="live-stage" data-frame={frame}>
                <div className="speedrun-ambient speedrun-ambient-one" />
                <div className="speedrun-ambient speedrun-ambient-two" />
                <div ref={phoneSlot} className="speedrun-live-phone" data-role="live-stage-phone" />
                <CaptionPanel section={section} frame={frame} />
                {frame < SPEEDRUN_TITLE_CARD_FRAMES ? <TitleCard label={label} frame={frame} /> : null}
                {frame >= endCardStart ? <EndCard label={label} /> : null}
                <footer><span>COSIMO / SOUND SPEEDRUN</span></footer>
            </div>
        </div>
    );
}
