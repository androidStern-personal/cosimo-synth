// Single source of truth for the buildlapse composition.
// Everything timing-related lives here so beats can be retuned in one place.

// ─── Composition ──────────────────────────────────────────────────────────
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Convert seconds (intuitive in conversation) to composite frames.
export const sec = (s: number) => Math.round(s * FPS);

// Composition layout in time:
//   0–18s   hero plays normally
//   18–20s  speed ramp: hero slow-mo at 0.5× (covers 1s of source)
//   20–26s  hero back to 1× (covers source 19s → 25s)
//   26–29s  hold on the hero's last frame   (HOLD_DUR)
//   29–33s  slow fade to black              (FADE_DUR)
export const HERO_NATIVE_S = 25; // source video duration

// Speed-ramp parameters. Slow-mo at the moment the camera commits to its
// push-in (hero source 18s) — emphasizes the climactic move.
export const RAMP_AT_NATIVE_S = 18;
export const RAMP_NATIVE_DUR_S = 1;
export const RAMP_RATE = 0.5;

export const RAMP_START = sec(RAMP_AT_NATIVE_S); // composite frame slow-mo begins
export const RAMP_DUR = sec(RAMP_NATIVE_DUR_S / RAMP_RATE); // 60 — 2s of slow
export const RAMP_END = RAMP_START + RAMP_DUR; // 600

// Total composite hero duration: normal_pre + slow + normal_post
//   = sec(18) + sec(2) + sec(25 - 18 - 1) = 540 + 60 + 180 = 780 frames = 26s
export const HERO_END =
  sec(RAMP_AT_NATIVE_S) +
  RAMP_DUR +
  sec(HERO_NATIVE_S - RAMP_AT_NATIVE_S - RAMP_NATIVE_DUR_S);

export const HOLD_DUR = sec(3);
export const HOLD_END = HERO_END + HOLD_DUR;
export const FADE_DUR = sec(4);
export const DURATION_FRAMES = HOLD_END + FADE_DUR; // 33s · 990 frames

// ─── Source material counts ───────────────────────────────────────────────
export const UI_FRAME_COUNT = 175; // ui_000001…ui_000175 in public/ui_frames
export const UI_FIRST = 1;
export const UI_LAST = 175;
// Note: ui_000002 and ui_000132 are missing in source data — handled by
// clamping to the nearest existing index in UIPanel via a known-bad set.
export const UI_MISSING = new Set<number>([2, 132]);

export const RENDER_FRAME_COUNT = 344; // frame_000001…frame_000344
export const RENDER_FIRST = 1;
// Truncate the playable range: source frames after ~170 show the basically-
// locked-in final scene with imperceptible iteration. Including them creates
// a "stuck" perception just before the hero expands. Hard cutoff here so the
// panel runs out of new content exactly when t2 fires.
export const RENDER_LAST = 170;

// ─── Story beats (transitions) ────────────────────────────────────────────
// Each transition is defined by its START frame and its DURATION. The end is
// `start + dur`. A transition's start overlaps with its source content's
// tail — the panel is in motion *while* its source is still advancing toward
// its last frame, so there's never a moment of static content waiting for
// motion to begin.
//
// t1: UI slides off-left, render grows top-right → top-half.
//     Starts ~6.4s, lasts 1.5s, ends 7.9s.
// t2: render slides off-top, hero grows bottom-half → fullscreen.
//     Starts 14s, lasts 3s, ends 17s. The hero's act-3 push-in begins at hero
//     time 18s, so fullscreen is in place 1s before the push-in begins.
export const T1_START = sec(6.4);
export const T1_DUR = sec(1.5);
export const T1_END = T1_START + T1_DUR;

export const T2_START = sec(14);
export const T2_DUR = sec(3);
export const T2_END = T2_START + T2_DUR;

// Source-content windows: [0, *_VISIBLE_END) maps onto [first, last] source
// frames. End-aligned with the *end* of the transition so the last frame of
// each source lands exactly as the panel finishes sliding off.
export const UI_VISIBLE_END = T1_END;
export const RENDER_VISIBLE_END = T2_END;

// ─── Layout (the four bounding-box keyframes) ────────────────────────────
// Each rect is { x, y, w, h } in pixels at 1920×1080.

export type Rect = { x: number; y: number; w: number; h: number };

const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;

export const RECTS = {
  // On-screen states
  uiSmall: { x: 0, y: 0, w: HALF_W, h: HALF_H }, // top-left quadrant
  renderSmall: { x: HALF_W, y: 0, w: HALF_W, h: HALF_H }, // top-right quadrant
  renderWide: { x: 0, y: 0, w: WIDTH, h: HALF_H }, // full top half
  heroHalf: { x: 0, y: HALF_H, w: WIDTH, h: HALF_H }, // bottom half
  heroFull: { x: 0, y: 0, w: WIDTH, h: HEIGHT }, // entire frame

  // Exit states: full-size panels translated off-screen so they slide cleanly
  // out of frame instead of fading. Edges are locked so neighbouring panels
  // meet at a moving divider — no overlap, no gap.
  uiOffLeft: { x: -HALF_W, y: 0, w: HALF_W, h: HALF_H }, // slides off the left
  renderOffTop: { x: 0, y: -HALF_H, w: WIDTH, h: HALF_H }, // slides off the top
} as const;

// ─── Palette ──────────────────────────────────────────────────────────────
// Warm-shadow workshop. Don't reach for synthwave neons — the hero is doing
// that already with the CRT phosphor green and Prophet rose. Stay neutral.
export const COLORS = {
  bg: "#0d0a08", // deep almost-black with brown undertone
  bgPanel: "#0b0907",
  border: "rgba(225, 215, 195, 0.55)", // warm cream, dim
  borderHi: "rgba(238, 228, 208, 0.85)", // warm cream, hot
  label: "rgba(225, 215, 195, 0.78)",
  labelDim: "rgba(225, 215, 195, 0.42)",
  divider: "rgba(225, 215, 195, 0.18)",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────
export const MONO =
  '"IBM Plex Mono", "JetBrains Mono", "Menlo", "Consolas", monospace';

export const SANS =
  '"Inter", -apple-system, "Helvetica Neue", "Arial", sans-serif';

// ─── Captions ────────────────────────────────────────────────────────────
// Edit text/timing here and they retune throughout the composition. Each
// caption has a "variant" that controls its size and placement; see
// components/Caption.tsx for the visual treatment.
//
// `from` is the composite frame the caption begins entering on.
// `durationInFrames` is the total visible window including entry and exit.
//
// Variant guide:
//   "line"      — small mono text, bottom-center. For data callouts during
//                 the build phase ("11 hours", "344 renders").
//   "title"     — large serif/sans wordmark, bottom-center, with subtitle.
//                 For the brand reveal at the end. Drawn ABOVE the
//                 fade-to-black overlay so it persists into the final frame.
export type Caption = {
  text: string;
  subtitle?: string;
  from: number;
  durationInFrames: number;
  variant: "line" | "title";
};

export const CAPTIONS: readonly Caption[] = [
  {
    // Body callout #1 — sets the scope of the work as the 3-up plays out.
    text: "ELEVEN HOURS · BUILT IN BLENDER",
    from: sec(2),
    durationInFrames: sec(4),
    variant: "line",
  },
  {
    // Body callout #2 — the render-count payoff while the timelapse panel
    // dominates the top half.
    text: "344 RENDERS · ONE SHOT",
    from: sec(9),
    durationInFrames: sec(4),
    variant: "line",
  },
  {
    // End-card — appears as the hero begins its fade-to-black, persists past
    // the fade so the wordmark is the final pixel on screen. Edit the text
    // and subtitle here; everything else is just CSS.
    text: "COSIMO",
    subtitle: "VINTAGE-VOICED VST · COSIMO.AUDIO",
    from: HOLD_END - sec(1), // start emerging late in the hold
    durationInFrames: FADE_DUR + sec(1),
    variant: "title",
  },
];
