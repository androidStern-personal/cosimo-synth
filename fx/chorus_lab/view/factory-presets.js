import {
  EFFECT_PRESET_KIND,
  EFFECT_PRESET_SCHEMA_VERSION,
} from "../../../ui/shared/effects/effect-preset-shared.ts";

// Chorus Lab's factory preset inventory, passed explicitly to
// createStandaloneEffectPresetController. Preset IDs and value keys are wire
// format: they persist in "effects.presets.v2" active-preset metadata and in
// exported preset files.
export const CHORUS_FACTORY_PRESETS = {
  chorus: [
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "chorus",
      presetID: "chorus.clean-wide",
      label: "Clean Wide",
      values: {
        chorusMix: 0.62,
        chorusMotionMode: 1,
        chorusBloomMode: 0,
        chorusTone: 0.58,
        chorusFeedback: 0.28,
        chorusRingAmount: 0,
        chorusRingOffsetMode: 0,
        chorusRingFineSemitones: 0,
      },
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "chorus",
      presetID: "chorus.bloom-ring",
      label: "Bloom Ring",
      values: {
        chorusMix: 0.76,
        chorusMotionMode: 0,
        chorusBloomMode: 2,
        chorusTone: 0.72,
        chorusFeedback: 0.42,
        chorusRingAmount: 0.26,
        chorusRingOffsetMode: 0,
        chorusRingFineSemitones: 0.07,
      },
    },
  ],
};
