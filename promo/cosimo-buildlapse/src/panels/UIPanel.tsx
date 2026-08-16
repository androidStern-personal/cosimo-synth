import React from "react";
import { Img, staticFile } from "remotion";
import { UI_FIRST, UI_LAST, UI_MISSING, UI_VISIBLE_END } from "../design";
import { linearSourceFrame } from "../components/sourceFrame";

// Returns the path to a UI screenshot for a given composite frame.
// Source span is mapped over [0, UI_VISIBLE_END), which equals the *end* of
// the t1 transition — so the UI panel's last source frame lands exactly as
// it finishes sliding off-screen. After UI_VISIBLE_END the panel is gone.
export const ResolvedUIFrame = ({ frame }: { frame: number }) => {
  const clamped = Math.min(frame, UI_VISIBLE_END - 1);
  let idx = linearSourceFrame(
    clamped,
    0,
    UI_VISIBLE_END,
    UI_FIRST,
    UI_LAST
  );
  // Step over missing source files.
  while (UI_MISSING.has(idx) && idx < UI_LAST) idx += 1;
  while (UI_MISSING.has(idx) && idx > UI_FIRST) idx -= 1;

  const src = staticFile(
    `ui_frames/ui_${idx.toString().padStart(6, "0")}.png`
  );

  return (
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover", // crop, don't letterbox — UI shots are wider than 16:9
        objectPosition: "center 30%", // bias toward the top (menu + viewport)
      }}
    />
  );
};
