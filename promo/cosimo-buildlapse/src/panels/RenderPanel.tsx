import React from "react";
import { Img, staticFile } from "remotion";
import {
  RENDER_FIRST,
  RENDER_LAST,
  RENDER_VISIBLE_END,
} from "../design";
import { linearSourceFrame } from "../components/sourceFrame";

// Render-timelapse panel. Source span maps over [0, RENDER_VISIBLE_END),
// which equals the *end* of the t2 transition — so the panel keeps showing
// fresh content right up to the moment it finishes sliding off-screen.
export const ResolvedRenderFrame = ({ frame }: { frame: number }) => {
  const clamped = Math.min(frame, RENDER_VISIBLE_END - 1);
  const idx = linearSourceFrame(
    clamped,
    0,
    RENDER_VISIBLE_END,
    RENDER_FIRST,
    RENDER_LAST
  );

  const src = staticFile(
    `render_frames/frame_${idx.toString().padStart(6, "0")}.png`
  );

  return (
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "#0b0907",
      }}
    />
  );
};
