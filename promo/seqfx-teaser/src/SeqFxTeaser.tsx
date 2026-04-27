import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AbstractBackground } from "./components/AbstractBackground";
import { CUTS, progress } from "./design";
import { EndCard } from "./scenes/EndCard";
import { RecursiveChainDemo } from "./scenes/RecursiveChainDemo";

export const SeqFxTeaser = () => {
  const frame = useCurrentFrame();
  const intensity =
    0.2 +
    progress(frame, 0, CUTS.stack) * 0.16 +
    progress(frame, CUTS.reorder, CUTS.hero) * 0.18 +
    progress(frame, CUTS.hero, CUTS.push) * 0.34 -
    progress(frame, CUTS.end, CUTS.finish) * 0.42;

  return (
    <AbsoluteFill style={{ backgroundColor: "#080B10", overflow: "hidden" }}>
      <AbstractBackground
        intensity={Math.max(0.1, Math.min(1, intensity))}
        captionOn={frame < CUTS.end}
        variant={frame >= CUTS.end ? "end" : frame >= CUTS.hero ? "hero" : frame >= CUTS.stack ? "stack" : "assembly"}
      />

      <Sequence from={0} durationInFrames={CUTS.end} premountFor={30}>
        <RecursiveChainDemo />
      </Sequence>
      <Sequence from={CUTS.end} durationInFrames={CUTS.finish - CUTS.end} premountFor={30}>
        <EndCard />
      </Sequence>

      <Vignette frame={frame} />
    </AbsoluteFill>
  );
};

const Vignette = ({ frame }: { frame: number }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      boxShadow: "inset 0 0 180px rgba(0,0,0,0.68)",
      background:
        frame > CUTS.end
          ? "radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.42) 72%)"
          : "radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.18) 72%)",
    }}
  />
);
