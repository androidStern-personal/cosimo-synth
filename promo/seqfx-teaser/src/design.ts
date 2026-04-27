import { Easing, interpolate } from "remotion";

export const FPS = 30;
export const BASE_BPM = 120;
export const BPM = 100;
export const BEAT = (FPS * 60) / BPM;
export const BAR = BEAT * 4;
export const beat = (count: number) => Math.round(count * BEAT);
export const bar = (count: number) => Math.round(count * BAR);
export const tempoFrames = (framesAt120Bpm: number) =>
  Math.round(framesAt120Bpm * (BASE_BPM / BPM));
export const DURATION_FRAMES = bar(12);

export const CUTS = {
  start: 0,
  assembly: bar(2),
  stack: bar(3),
  reorder: bar(7),
  variety: bar(8),
  inspector: bar(8),
  hero: bar(8),
  push: beat(34),
  end: bar(10),
  title: bar(10) + beat(1),
  tagline: bar(10) + beat(3),
  finish: DURATION_FRAMES,
} as const;

export const COLORS = {
  bg0: "#080B10",
  bg1: "#101923",
  cream: "#EFEAE0",
  creamDim: "#DED8CC",
  ink: "#151515",
  muted: "rgba(239,234,224,0.62)",
  panel: "rgba(239,234,224,0.94)",
  panelSoft: "rgba(239,234,224,0.12)",
  line: "rgba(239,234,224,0.22)",
  cyan: "#00B3CC",
  gold: "#F2D16B",
  magenta: "#FF4FD8",
  blue: "#2B6CFF",
  acid: "#B7FF55",
  filter: "#F4D35E",
  crusher: "#EE6C4D",
  tape: "#98C1D9",
  stutter: "#B5D99C",
} as const;

export type EffectKey = "filter" | "crusher" | "tape" | "stutter";

export const EFFECTS: Record<
  EffectKey,
  { label: string; short: string; color: string; dark: string }
> = {
  filter: { label: "Filter", short: "FLT", color: COLORS.filter, dark: "#7D6824" },
  crusher: { label: "Crusher", short: "CRSH", color: COLORS.crusher, dark: "#8D3322" },
  tape: { label: "Tape Stop", short: "TAPE", color: COLORS.tape, dark: "#3C647A" },
  stutter: { label: "Stutter", short: "STUT", color: COLORS.stutter, dark: "#587A42" },
};

export const LANE_NAMES = ["Chain 1", "Chain 2", "Chain 3", "Chain 4"] as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
export const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const progress = (
  frame: number,
  from: number,
  to: number,
  easing = easeOut,
) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const pulse = (frame: number, center: number, width: number) =>
  clamp(1 - Math.abs(frame - center) / width);

export const beatPulse = (frame: number, every = BEAT, softness = tempoFrames(8)) => {
  const phase = ((frame % every) + every) % every;
  return Math.exp(-phase / softness);
};

export const fmt = (n: number) => `${Math.round(n * 1000) / 1000}`;

export const sceneOpacity = (frame: number, from: number, to: number) => {
  const fade = tempoFrames(8);
  const fadeIn = progress(frame, from, from + fade, easeOut);
  const fadeOut = 1 - progress(frame, to - fade, to, easeInOut);
  return Math.min(fadeIn, fadeOut);
};

export type StepEffect = EffectKey | "empty";

const basePattern: StepEffect[][] = [
  [
    "filter",
    "empty",
    "crusher",
    "filter",
    "tape",
    "empty",
    "filter",
    "filter",
    "stutter",
    "filter",
    "empty",
    "crusher",
    "filter",
    "tape",
    "empty",
    "filter",
    "crusher",
    "empty",
    "filter",
    "stutter",
    "filter",
    "crusher",
    "empty",
    "tape",
    "filter",
    "empty",
    "crusher",
    "filter",
    "stutter",
    "tape",
    "filter",
    "crusher",
  ],
  [
    "empty",
    "tape",
    "filter",
    "crusher",
    "empty",
    "stutter",
    "tape",
    "tape",
    "crusher",
    "empty",
    "filter",
    "tape",
    "stutter",
    "empty",
    "crusher",
    "tape",
    "empty",
    "filter",
    "tape",
    "crusher",
    "empty",
    "stutter",
    "tape",
    "filter",
    "empty",
    "crusher",
    "tape",
    "stutter",
    "filter",
    "empty",
    "crusher",
    "tape",
  ],
  [
    "empty",
    "crusher",
    "empty",
    "stutter",
    "crusher",
    "filter",
    "crusher",
    "crusher",
    "tape",
    "crusher",
    "stutter",
    "empty",
    "tape",
    "crusher",
    "filter",
    "stutter",
    "crusher",
    "tape",
    "empty",
    "filter",
    "crusher",
    "tape",
    "stutter",
    "empty",
    "crusher",
    "filter",
    "stutter",
    "tape",
    "empty",
    "crusher",
    "stutter",
    "filter",
  ],
  [
    "stutter",
    "empty",
    "tape",
    "empty",
    "stutter",
    "crusher",
    "stutter",
    "stutter",
    "filter",
    "tape",
    "crusher",
    "stutter",
    "empty",
    "filter",
    "tape",
    "crusher",
    "stutter",
    "crusher",
    "filter",
    "tape",
    "stutter",
    "empty",
    "crusher",
    "filter",
    "tape",
    "stutter",
    "filter",
    "empty",
    "crusher",
    "stutter",
    "tape",
    "filter",
  ],
];

basePattern[0][6] = "filter";
basePattern[1][6] = "tape";
basePattern[2][6] = "crusher";
basePattern[3][6] = "stutter";
basePattern[0][7] = "stutter";
basePattern[1][7] = "crusher";
basePattern[2][7] = "tape";
basePattern[3][7] = "filter";

export const pattern = basePattern;

export const effectAt = (lane: number, step: number): StepEffect =>
  pattern[lane]?.[step % 32] ?? "empty";

export const orderForStep = (step: number): EffectKey[] =>
  [0, 1, 2, 3]
    .map((lane) => effectAt(lane, step))
    .filter((effect): effect is EffectKey => effect !== "empty");
