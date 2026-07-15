import {
  ALL_MODULES,
  ARTICULATIONS,
  EFFECTS,
  FIXED_SOURCES,
  TARGETS,
} from "./catalog.js";
import { createMapping, defaultSourceSettings } from "./policies.js";

export const INITIAL_BASE_VALUES = Object.freeze(
  Object.fromEntries(
    Object.values(TARGETS).map((target) => [target.key, target.initial]),
  ),
);

export const INITIAL_SOURCES = Object.freeze([
  { id: "macro-1", type: "macro", slot: 1, label: "Macro 1" },
  { id: "envelope-1", type: "envelope", slot: 1, label: "Envelope 1" },
  { id: "mseg-1", type: "mseg", slot: 1, label: "MSEG 1" },
]);

export const INITIAL_MAPPINGS = Object.freeze([
  createMapping("phaser.frequency", "mseg-1", 62, "Bipolar", "Max"),
  createMapping("phaser.frequency", "pressure", 18, "Bipolar", "Mean"),
  createMapping("phaser.depth", "macro-1", 22, "Unipolar", "Max"),
  createMapping("drive.amount", "macro-1", 28, "Unipolar", "Max"),
  createMapping("wavetable.index", "mseg-1", 34, "Unipolar", "Max"),
  createMapping("wavetable.warp", "envelope-1", 40, "Bipolar", "Max"),
  createMapping("voice-filter.cutoff", "envelope-1", 55, "Unipolar", "Max"),
]);

// This remains a UI-session fixture, not patch state. It is exported so the
// navigation/controller layer can preserve the prototype's initial focus.
export const INITIAL_ACTIVE_SOURCES = Object.freeze({
  "phaser.frequency": "mseg-1",
  "phaser.depth": "macro-1",
  "drive.amount": "macro-1",
  "wavetable.index": "mseg-1",
  "wavetable.warp": "envelope-1",
  "voice-filter.cutoff": "envelope-1",
});

export const INITIAL_LAST_TWEAKED = Object.freeze(
  Object.fromEntries(ALL_MODULES.map((module) => [module.id, module.quick])),
);

export const INITIAL_SOURCE_SETTINGS = Object.freeze(
  Object.fromEntries(
    [...INITIAL_SOURCES, ...FIXED_SOURCES].map((source) => [
      source.id,
      defaultSourceSettings(source),
    ]),
  ),
);

export const INITIAL_PATCH = Object.freeze({
  effectOrder: EFFECTS.map((effect) => effect.id),
  effectEnabled: Object.fromEntries(EFFECTS.map((effect) => [effect.id, true])),
  parameterValues: INITIAL_BASE_VALUES,
  compoundSettings: {},
  articulationOverrides: Object.fromEntries(
    Object.keys(ARTICULATIONS)
      .filter((id) => id !== "Default")
      .map((id) => [id, {}]),
  ),
  sources: INITIAL_SOURCES,
  sourceSettings: INITIAL_SOURCE_SETTINGS,
  mappings: INITIAL_MAPPINGS,
});

export const INITIAL_AUDITION = Object.freeze({
  articulation: "Pluck",
  note: "C3",
  repeat: false,
  latch: false,
  triggerActive: false,
  captureCandidate: null,
  status: "Waiting for note",
});

export function createInitialMockCosimoState() {
  return {
    patch: {
      ...INITIAL_PATCH,
      effectOrder: [...INITIAL_PATCH.effectOrder],
      effectEnabled: { ...INITIAL_PATCH.effectEnabled },
      parameterValues: { ...INITIAL_PATCH.parameterValues },
      compoundSettings: {},
      articulationOverrides: Object.fromEntries(
        Object.entries(INITIAL_PATCH.articulationOverrides)
          .map(([id, values]) => [id, { ...values }]),
      ),
      sources: INITIAL_PATCH.sources.map((source) => ({ ...source })),
      sourceSettings: Object.fromEntries(
        Object.entries(INITIAL_PATCH.sourceSettings)
          .map(([id, settings]) => [id, { ...settings }]),
      ),
      mappings: INITIAL_PATCH.mappings.map((item) => ({ ...item })),
    },
    audition: { ...INITIAL_AUDITION },
    undo: null,
  };
}

/**
 * Deterministic visual-QA fixture. It deliberately combines the longest
 * formatted parameter values, an articulation override, an orphan source, a
 * bypassed effect, and active audition/capture state. It remains behind the
 * mock adapter and is never part of the production component contract.
 */
export function createStressMockCosimoState() {
  const state = createInitialMockCosimoState();
  const orphanSource = {
    id: "envelope-2",
    type: "envelope",
    slot: 2,
    label: "Envelope 2",
  };

  state.patch.parameterValues = {
    ...state.patch.parameterValues,
    "phaser.rate": 100,
    "phaser.depth": 0,
    "phaser.frequency": 100,
    "phaser.feedback": 100,
    "phaser.phase": 100,
    "phaser.mix": 0,
    "wavetable.warp": 0,
  };
  state.patch.effectEnabled = {
    ...state.patch.effectEnabled,
    delay: false,
  };
  state.patch.articulationOverrides = {
    ...state.patch.articulationOverrides,
    Pluck: {
      ...state.patch.articulationOverrides.Pluck,
      "wavetable.warp": 100,
    },
  };
  state.patch.sources = [...state.patch.sources, orphanSource];
  state.patch.sourceSettings = {
    ...state.patch.sourceSettings,
    [orphanSource.id]: defaultSourceSettings(orphanSource),
  };
  state.patch.mappings = state.patch.mappings.map((mapping) => {
    if (mapping.id === "phaser.frequency::mseg-1") {
      return { ...mapping, amount: 100 };
    }
    if (mapping.id === "phaser.frequency::pressure") {
      return { ...mapping, amount: -100 };
    }
    return mapping;
  });
  state.audition = {
    ...state.audition,
    repeat: true,
    latch: true,
    triggerActive: true,
    captureCandidate: {
      targetKey: "wavetable.warp",
      layer: "Pluck override",
      articulation: "Pluck",
    },
    status: "Recording · Pluck override · Wavetable Warp",
  };

  return state;
}
