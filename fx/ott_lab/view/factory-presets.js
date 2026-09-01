import {
  EFFECT_PRESET_KIND,
  EFFECT_PRESET_SCHEMA_VERSION,
} from "../../../ui/shared/effects/effect-preset-shared.ts";

// OTT Lab's factory preset inventory, passed explicitly to
// createStandaloneEffectPresetController. Preset IDs and value keys are wire
// format: they persist in "effects.presets.v2" active-preset metadata and in
// exported preset files.
export const OTT_FACTORY_PRESETS = {
  ott: [
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "ott",
      presetID: "ott.default-smash",
      label: "Default Smash",
      values: {
        ottMix: 100,
        ottAmount: 100,
        ottTimePercent: 100,
        ottBandDrive: 0,
        ottEnvelopeMatch: 0,
      },
    },
    {
      kind: EFFECT_PRESET_KIND,
      version: EFFECT_PRESET_SCHEMA_VERSION,
      effectID: "ott",
      presetID: "ott.envelope-tamed",
      label: "Envelope Tamed",
      values: {
        ottMix: 86,
        ottAmount: 92,
        ottTimePercent: 100,
        ottBandDrive: 12,
        ottEnvelopeMatch: 38,
      },
    },
  ],
};
