import React, { CSSProperties } from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption as CaptionDef, COLORS, MONO, SANS } from "../design";

const ENTRY_DUR = 14; // frames the caption takes to slide+fade in
const EXIT_DUR = 14; // frames it takes to slide+fade out

// A single caption. Spring-eased entry and exit, no jerk. The caption
// renders nothing outside its visible window so it can be unconditionally
// listed in the parent — Remotion only invokes the component when its
// `from`/`durationInFrames` window is active anyway via Sequence, but this
// belt-and-suspenders check keeps the JSX simple in Buildlapse.
export const Caption: React.FC<{ caption: CaptionDef }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const local = frame - caption.from;
  if (local < 0 || local >= caption.durationInFrames) return null;

  const enter = spring({
    frame: local,
    fps,
    durationInFrames: ENTRY_DUR,
    config: { damping: 200 },
  });

  // Exit ramps from 0→1 over EXIT_DUR frames at the tail of the visible
  // window. We use 1 - exit as the visible factor.
  const exit = spring({
    frame: local - (caption.durationInFrames - EXIT_DUR),
    fps,
    durationInFrames: EXIT_DUR,
    config: { damping: 200 },
  });

  const opacity = enter * (1 - exit);
  const slideIn = interpolate(enter, [0, 1], [18, 0]); // px from below
  const slideOut = interpolate(exit, [0, 1], [0, -10]); // continue drifting up
  const ty = slideIn + slideOut;

  if (caption.variant === "title") {
    return <TitleCaption opacity={opacity} ty={ty} caption={caption} />;
  }
  return <LineCaption opacity={opacity} ty={ty} text={caption.text} />;
};

const LineCaption: React.FC<{
  opacity: number;
  ty: number;
  text: string;
}> = ({ opacity, ty, text }) => {
  const wrap: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 64, // sits above the safe area on most platforms
    textAlign: "center",
    opacity,
    transform: `translateY(${ty}px)`,
    pointerEvents: "none",
  };
  const text_: CSSProperties = {
    display: "inline-block",
    fontFamily: MONO,
    fontSize: 28,
    letterSpacing: 6,
    color: COLORS.label,
    textTransform: "uppercase",
    padding: "10px 22px",
    background: "rgba(0,0,0,0.35)",
    border: `1px solid ${COLORS.divider}`,
    backdropFilter: "blur(2px)",
  };
  return (
    <div style={wrap}>
      <span style={text_}>{text}</span>
    </div>
  );
};

const TitleCaption: React.FC<{
  opacity: number;
  ty: number;
  caption: CaptionDef;
}> = ({ opacity, ty, caption }) => {
  const wrap: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    transform: `translateY(calc(-50% + ${ty}px))`,
    textAlign: "center",
    opacity,
    pointerEvents: "none",
  };
  const word: CSSProperties = {
    fontFamily: SANS,
    fontSize: 168,
    fontWeight: 200,
    letterSpacing: 22,
    color: "#f3ecdb",
    lineHeight: 1,
    textTransform: "uppercase",
  };
  const sub: CSSProperties = {
    marginTop: 30,
    fontFamily: MONO,
    fontSize: 18,
    letterSpacing: 5,
    color: COLORS.labelDim,
    textTransform: "uppercase",
  };
  return (
    <div style={wrap}>
      <div style={word}>{caption.text}</div>
      {caption.subtitle && <div style={sub}>{caption.subtitle}</div>}
    </div>
  );
};
