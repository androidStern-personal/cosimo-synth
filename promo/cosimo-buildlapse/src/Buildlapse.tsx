import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "./components/Caption";
import { Panel } from "./components/Panel";
import {
  CAPTIONS,
  COLORS,
  FADE_DUR,
  HOLD_END,
  RECTS,
  Rect,
  T1_DUR,
  T1_START,
  T2_DUR,
  T2_START,
} from "./design";
import { HeroVideo } from "./panels/HeroPanel";
import { ResolvedRenderFrame } from "./panels/RenderPanel";
import { ResolvedUIFrame } from "./panels/UIPanel";

// Linear interpolation between two rects on a single t∈[0,1] scalar.
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

export const Buildlapse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Transition scalars ────────────────────────────────────────────────
  // Spring with damping: 200 — Remotion's documented "smooth, no bounce"
  // configuration for subtle reveals. Produces a clean S-curve from 0→1
  // over the requested duration with no overshoot, no snap.
  const t1 = spring({
    frame: frame - T1_START,
    fps,
    durationInFrames: T1_DUR,
    config: { damping: 200 },
  });

  const t2 = spring({
    frame: frame - T2_START,
    fps,
    durationInFrames: T2_DUR,
    config: { damping: 200 },
  });

  // ─── Panel rects ───────────────────────────────────────────────────────
  // UI: small (top-left) → off-left during t1.
  const uiRect = lerpRect(RECTS.uiSmall, RECTS.uiOffLeft, t1);

  // Render: small (top-right quadrant) → wide (full top half) during t1, then
  // wide → off-top during t2. Two consecutive lerps, each driven by its own
  // spring scalar.
  const renderRectAfterT1 = lerpRect(RECTS.renderSmall, RECTS.renderWide, t1);
  const renderRect = lerpRect(renderRectAfterT1, RECTS.renderOffTop, t2);

  // Hero: bottom-half → fullscreen during t2.
  const heroRect = lerpRect(RECTS.heroHalf, RECTS.heroFull, t2);

  // Hero chrome fades smoothly with t2 so the border doesn't snap on/off.
  const heroChromeOpacity = 1 - t2;

  // ─── End-card fade ─────────────────────────────────────────────────────
  // Slow fade-to-black over FADE_DUR, beginning when the hold ends. Sin-eased
  // so the transition into black is gentle at both ends instead of starting
  // with a hard ramp.
  const fadeOpacity = interpolate(
    frame,
    [HOLD_END, HOLD_END + FADE_DUR],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.sin),
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Hero is rendered first / lowest in the stack so the render panel
          slides over it on entry and slides off above it during t2. */}
      <Panel
        rect={heroRect}
        opacity={1}
        chromeOpacity={heroChromeOpacity}
        label="OUTPUT"
        index="HERO · 25S"
      >
        <HeroVideo />
      </Panel>

      <Panel
        rect={renderRect}
        opacity={1}
        label="SCENE RENDERS"
        index="170F · 11.5H"
      >
        <ResolvedRenderFrame frame={frame} />
      </Panel>

      <Panel
        rect={uiRect}
        opacity={1}
        label="BLENDER UI"
        index="0:00 → 2:55"
      >
        <ResolvedUIFrame frame={frame} />
      </Panel>

      {/* Body captions — drawn before the fade overlay so they're affected
          by the fade-to-black like everything else. (Their visible windows
          end well before the fade begins, so this is just hygiene.) */}
      {CAPTIONS.filter((c) => c.variant === "line").map((c, i) => (
        <Caption key={`line-${i}`} caption={c} />
      ))}

      {/* Fade-to-black overlay for the end card. Drawn before the title
          captions so the title can render *over* the black at the very end. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#000",
          opacity: fadeOpacity,
          pointerEvents: "none",
        }}
      />

      {/* End-card title captions — rendered ABOVE the fade overlay so they
          stay legible as the rest of the frame goes to black. */}
      {CAPTIONS.filter((c) => c.variant === "title").map((c, i) => (
        <Caption key={`title-${i}`} caption={c} />
      ))}
    </AbsoluteFill>
  );
};
