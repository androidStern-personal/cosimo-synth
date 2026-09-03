import {
  EFFECT_PRESET_KIND,
  EFFECT_PRESET_SCHEMA_VERSION,
} from "../../../kit/index.ts";

// Enhancer Lite's factory preset inventory, passed explicitly to
// createStandaloneEffectPresetController. Preset IDs and value keys are wire
// format: they persist in "effects.presets.v2" active-preset metadata and in
// exported preset files.
//
// The eight value keys are the plugin's complete preset-addressable set (the
// static sound controls the host also saves). The hidden analyzer endpoints
// are editor-only and must never appear here.
export const ENHANCER_LITE_FACTORY_PRESETS = {
  "enhancer-lite": [
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "enhancer-lite",
      presetID: "enhancer-lite.sub-weight",
      label: "Sub Weight",
      values: {
        freqHzIn: 90,
        qIn: 0.71,
        modeIn: 0,
        midAmountIn: 0.35,
        sideAmountIn: 0,
        curveIn: 0,
        saturationModeIn: 0,
        shapeIn: 0,
      },
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "enhancer-lite",
      presetID: "enhancer-lite.vocal-presence",
      label: "Vocal Presence",
      values: {
        freqHzIn: 3200,
        qIn: 1.1,
        modeIn: 0,
        midAmountIn: 0.3,
        sideAmountIn: 0,
        curveIn: 1,
        saturationModeIn: 0,
        shapeIn: 1,
      },
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "enhancer-lite",
      presetID: "enhancer-lite.air-lift",
      label: "Air Lift",
      values: {
        freqHzIn: 9000,
        qIn: 0.6,
        modeIn: 0,
        midAmountIn: 0.4,
        sideAmountIn: 0,
        curveIn: 1,
        saturationModeIn: 0,
        shapeIn: 2,
      },
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "enhancer-lite",
      presetID: "enhancer-lite.wide-shimmer",
      label: "Wide Shimmer",
      values: {
        freqHzIn: 7000,
        qIn: 0.71,
        modeIn: 1,
        midAmountIn: 0.12,
        sideAmountIn: 0.5,
        curveIn: 0,
        saturationModeIn: 1,
        shapeIn: 2,
      },
    },
  ],
};
