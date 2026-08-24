import React from "react";
import { interpolate } from "remotion";

import "./stage.css";

/**
 * The shared video-stage authority: output dimensions, card timing, and the
 * frame chrome used by both the shipped scripted composition and the retained
 * replica. Nothing here may import from composition/ — that directory must
 * stay deletable as a unit once the replica's disposal is decided.
 */
export const SPEEDRUN_VIDEO_WIDTH = 1_080 as const;
export const SPEEDRUN_VIDEO_HEIGHT = 1_920 as const;
export const SPEEDRUN_END_CARD_FRAMES = 45 as const;
export const SPEEDRUN_TITLE_CARD_FRAMES = 43 as const;
/** Compensates the measured one-frame AAC priming offset; timeline lead-in is silent. */
export const SPEEDRUN_AUDIO_TRIM_BEFORE_FRAMES = 1 as const;

export function TitleCard({ label, frame }: { readonly label: string; readonly frame: number }) {
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

export function EndCard({ label }: { readonly label: string }) {
    return (
        <div className="speedrun-end-card">
            <small>YOU JUST HEARD</small>
            <strong>{label}</strong>
            <span>Made with Cosimo</span>
        </div>
    );
}
