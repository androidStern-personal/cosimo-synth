const parameter = (
  id,
  label,
  initial,
  defaultValue,
  format = "percent",
  compound = null,
) => ({ id, label, initial, defaultValue, format, compound });

export const SOURCE_COLORS = Object.freeze({
  "macro-1": "var(--cosimo-color-source-macro-1)",
  "macro-2": "var(--cosimo-color-source-macro-2)",
  "macro-3": "var(--cosimo-color-source-macro-3)",
  "macro-4": "var(--cosimo-color-source-macro-4)",
  "envelope-1": "var(--cosimo-color-source-envelope-1)",
  "envelope-2": "var(--cosimo-color-source-envelope-2)",
  "envelope-3": "var(--cosimo-color-source-envelope-3)",
  "mseg-1": "var(--cosimo-color-source-mseg-1)",
  "mseg-2": "var(--cosimo-color-source-mseg-2)",
  "mseg-3": "var(--cosimo-color-source-mseg-3)",
  velocity: "var(--cosimo-color-source-velocity)",
  pressure: "var(--cosimo-color-source-pressure)",
  slide: "var(--cosimo-color-source-slide)",
});

// Icon names deliberately remain presentation-neutral. The React layer maps
// these stable identities to the icon set used by the current platform.
export const ARTICULATIONS = Object.freeze({
  Default: { id: "Default", color: "var(--cosimo-color-articulation-default)", icon: "circle" },
  Pluck: { id: "Pluck", color: "var(--cosimo-color-articulation-pluck)", icon: "cursor-click" },
  Bowed: { id: "Bowed", color: "var(--cosimo-color-articulation-bowed)", icon: "feather" },
  Accent: { id: "Accent", color: "var(--cosimo-color-articulation-accent)", icon: "lightning" },
});

export const EFFECTS = Object.freeze([
  {
    id: "filter",
    label: "Filter",
    workspace: "effects",
    quick: "cutoff",
    graphicLabel: "Filter response graphic",
    graphicAxes: ["cutoff", "resonance"],
    params: [
      parameter("cutoff", "Cutoff", 62, 70, "frequency"),
      parameter("resonance", "Resonance", 30, 0),
      parameter("drive", "Drive", 22, 0),
    ],
  },
  {
    id: "drive",
    label: "Drive",
    workspace: "effects",
    quick: "amount",
    graphicLabel: "Drive transfer graphic",
    graphicAxes: ["amount", "tone"],
    params: [
      parameter("amount", "Amount", 45, 0),
      parameter("tone", "Tone", 55, 50),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "ott",
    label: "OTT",
    workspace: "effects",
    quick: "depth",
    graphicLabel: "OTT compression graphic",
    graphicAxes: ["depth", "time"],
    params: [
      parameter("depth", "Depth", 64, 0),
      parameter("time", "Time", 48, 50),
      parameter("mix", "Mix", 50, 0),
    ],
  },
  {
    id: "chorus",
    label: "Chorus",
    workspace: "effects",
    quick: "depth",
    graphicLabel: "Chorus motion graphic",
    graphicAxes: ["rate", "depth"],
    params: [
      parameter("rate", "Rate", 28, 20, "rate", "sync"),
      parameter("depth", "Depth", 55, 0),
      parameter("delay", "Delay", 36, 25),
      parameter("mix", "Mix", 35, 0),
    ],
  },
  {
    id: "flanger",
    label: "Flanger",
    workspace: "effects",
    quick: "rate",
    graphicLabel: "Flanger motion graphic",
    graphicAxes: ["rate", "depth"],
    params: [
      parameter("rate", "Rate", 26, 20, "rate", "sync"),
      parameter("depth", "Depth", 68, 0),
      parameter("feedback", "Feedback", 42, 50, "signed"),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "phaser",
    label: "Phaser",
    workspace: "effects",
    quick: "frequency",
    graphicLabel: "Response / motion graphic",
    graphicAxes: ["frequency", "depth"],
    params: [
      parameter("rate", "Rate", 26, 20, "rate", "sync"),
      parameter("depth", "Depth", 68, 50),
      parameter("frequency", "Frequency", 54, 45, "frequency"),
      parameter("feedback", "Feedback", 42, 50, "signed"),
      parameter("phase", "Phase", 50, 50, "phase"),
      parameter("mix", "Mix", 38, 0),
    ],
  },
  {
    id: "delay",
    label: "Delay",
    workspace: "effects",
    quick: "time",
    graphicLabel: "Delay timing graphic",
    graphicAxes: ["time", "feedback"],
    params: [
      parameter("time", "Time", 48, 40, "percent", "sync"),
      parameter("feedback", "Feedback", 36, 0, "signed"),
      parameter("filter", "Filter", 58, 70, "frequency"),
      parameter("mix", "Mix", 30, 0),
    ],
  },
  {
    id: "reverb",
    label: "Reverb",
    workspace: "effects",
    quick: "size",
    graphicLabel: "Reverb space graphic",
    graphicAxes: ["size", "decay"],
    params: [
      parameter("size", "Size", 72, 50),
      parameter("decay", "Decay", 64, 40),
      parameter("damping", "Damping", 43, 50),
      parameter("mix", "Mix", 28, 0),
    ],
  },
]);

export const VOICE_MODULES = Object.freeze([
  {
    id: "wavetable",
    label: "Wavetable",
    workspace: "voice",
    quick: "index",
    graphicLabel: "Wavetable display",
    graphicAxes: ["warp", "index"],
    params: [
      parameter("index", "Index", 44, 0),
      parameter("warp", "Warp", 58, 50),
      parameter("unison", "Unison", 35, 0),
      parameter("tune", "Tune", 50, 50, "semitone"),
    ],
  },
  {
    id: "voice-filter",
    label: "Voice Filter",
    workspace: "voice",
    quick: "cutoff",
    graphicLabel: "Per-voice filter response",
    graphicAxes: ["cutoff", "resonance"],
    params: [
      parameter("cutoff", "Cutoff", 67, 70, "frequency"),
      parameter("resonance", "Resonance", 25, 0),
      parameter("drive", "Drive", 15, 0),
    ],
  },
  {
    id: "amp-pan",
    label: "Amp / Pan",
    workspace: "voice",
    quick: "level",
    graphicLabel: "Amplitude and pan graphic",
    graphicAxes: ["pan", "level"],
    params: [
      parameter("level", "Level", 80, 80),
      parameter("pan", "Pan", 50, 50, "signed"),
      parameter("attack", "Attack", 10, 0),
      parameter("release", "Release", 35, 25),
    ],
  },
]);

export const ALL_MODULES = Object.freeze([...EFFECTS, ...VOICE_MODULES]);

export const MODULES_BY_ID = Object.freeze(
  Object.fromEntries(ALL_MODULES.map((module) => [module.id, module])),
);

export const TARGETS = Object.freeze(
  Object.fromEntries(
    ALL_MODULES.flatMap((module) =>
      module.params.map((param) => {
        const key = `${module.id}.${param.id}`;
        return [
          key,
          {
            ...param,
            key,
            moduleId: module.id,
            moduleLabel: module.label,
            workspace: module.workspace,
          },
        ];
      }),
    ),
  ),
);

export const FIXED_SOURCES = Object.freeze([
  { id: "velocity", type: "fixed", slot: null, label: "Velocity" },
  { id: "pressure", type: "fixed", slot: null, label: "Pressure" },
  { id: "slide", type: "fixed", slot: null, label: "Slide" },
]);
