import {
    EFFECT_PRESET_KIND,
    EFFECT_PRESET_SCHEMA_VERSION,
    type EffectPreset,
    type EffectPresetDescriptorRegistry,
} from "./effect-preset-schema";

export const EFFECT_PRESET_DESCRIPTORS = {
    chorus: {
        effectID: "chorus",
        label: "Chorus",
        params: {
            chorusEnabled: { type: "integer", min: 0, max: 1, defaultValue: 0 },
            chorusMix: { type: "number", min: 0, max: 1, defaultValue: 0 },
            chorusMotionMode: { type: "integer", min: 0, max: 3, defaultValue: 1 },
            chorusBloomMode: { type: "integer", min: 0, max: 4, defaultValue: 0 },
            chorusTone: { type: "number", min: 0, max: 1, defaultValue: 0.5 },
            chorusFeedback: { type: "number", min: 0, max: 0.95, defaultValue: 0.42 },
            chorusRingAmount: { type: "number", min: 0, max: 1, defaultValue: 0 },
            chorusRingOffsetMode: { type: "integer", min: 0, max: 3, defaultValue: 0 },
            chorusRingFineSemitones: { type: "number", min: -2, max: 2, defaultValue: 0 },
        },
    },
    ott: {
        effectID: "ott",
        label: "OTT",
        params: {
            ottMix: { type: "number", min: 0, max: 100, defaultValue: 100 },
            ottAmount: { type: "number", min: 0, max: 100, defaultValue: 100 },
            ottTimePercent: { type: "number", min: 10, max: 1000, defaultValue: 100, clamp: true },
            ottBandDrive: { type: "number", min: 0, max: 100, defaultValue: 0 },
            ottEnvelopeMatch: { type: "number", min: 0, max: 100, defaultValue: 0 },
        },
    },
} satisfies EffectPresetDescriptorRegistry;

export const EFFECT_FACTORY_PRESETS: Record<string, EffectPreset[]> = {
    chorus: [
        {
            kind: EFFECT_PRESET_KIND,
            version: EFFECT_PRESET_SCHEMA_VERSION,
            effectID: "chorus",
            presetID: "chorus.clean-wide",
            label: "Clean Wide",
            values: {
                chorusEnabled: 1,
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
                chorusEnabled: 1,
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
