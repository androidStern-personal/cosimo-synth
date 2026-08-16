import React from "react";
import { Video } from "@remotion/media";
import { Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import {
  HERO_END,
  HERO_NATIVE_S,
  RAMP_AT_NATIVE_S,
  RAMP_DUR,
  RAMP_NATIVE_DUR_S,
  RAMP_RATE,
  RAMP_START,
  RAMP_END,
  FPS,
} from "../design";

// Hero panel with a speed ramp.
//
// The hero clip is split into three sequenced segments. Each segment uses
// `<Video>` from `@remotion/media`, which supports `playbackRate`. The
// `trimBefore` prop (in frames at composition fps) tells the segment which
// source frame to begin at; continuity across segments is preserved by
// computing the right offset for each.
//
//   Segment A — composite [0, RAMP_START)
//     Plays source 0 → RAMP_AT_NATIVE_S at 1×.
//   Segment B — composite [RAMP_START, RAMP_END)
//     Plays source RAMP_AT_NATIVE_S → +RAMP_NATIVE_DUR_S at RAMP_RATE
//     (slow-mo). Spans `RAMP_DUR` composite frames.
//   Segment C — composite [RAMP_END, HERO_END)
//     Plays source (RAMP_AT_NATIVE_S + RAMP_NATIVE_DUR_S) → HERO_NATIVE_S
//     at 1×. Snap-back to normal speed.
//
// After HERO_END the hero is held as a still image so the OffthreadVideo
// doesn't run past its source duration and so we have a clean still to
// fade out from.

const TRIM_A = 0;
const TRIM_B = Math.round(RAMP_AT_NATIVE_S * FPS); // 540
const TRIM_C = Math.round((RAMP_AT_NATIVE_S + RAMP_NATIVE_DUR_S) * FPS); // 570

const SEG_A_DUR = RAMP_START; // 540
const SEG_B_DUR = RAMP_DUR; // 60 (composite frames covering 30 source frames at 0.5×)
const SEG_C_DUR = HERO_END - RAMP_END; // 180 (covers remaining source 1:1)

const videoStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
};

export const HeroVideo: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame >= HERO_END) {
    return (
      <Img
        src={staticFile("hero_last.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <>
      <Sequence from={0} durationInFrames={SEG_A_DUR}>
        <Video
          src={staticFile("hero.mp4")}
          trimBefore={TRIM_A}
          playbackRate={1}
          style={videoStyle}
          muted
        />
      </Sequence>
      <Sequence from={RAMP_START} durationInFrames={SEG_B_DUR}>
        <Video
          src={staticFile("hero.mp4")}
          trimBefore={TRIM_B}
          playbackRate={RAMP_RATE}
          style={videoStyle}
          muted
        />
      </Sequence>
      <Sequence from={RAMP_END} durationInFrames={SEG_C_DUR}>
        <Video
          src={staticFile("hero.mp4")}
          trimBefore={TRIM_C}
          playbackRate={1}
          style={videoStyle}
          muted
        />
      </Sequence>
    </>
  );
};
