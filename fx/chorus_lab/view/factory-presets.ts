import type { FactoryPreset } from "../../../kit/index";

/** The sound ChorusLab.cmajor starts with: each parameter's init value. Switches are 0 (off) or 1 (on). */
const startingSound = {
    chorusMix: 0, chorusMotionMode: 1, chorusBloomMode: 0, chorusTone: 0.5, chorusFeedback: 0.42,
    chorusRingAmount: 0, chorusRingOffsetMode: 0, chorusRingFineSemitones: 0,
    voices: 3, rateHz: 0.33, modDepthMs: 7, driftMs: 0.4,
    feedback: 40, loopHighpassHz: 90, loopLowpassHz: 6400, drive: 1.35, ringModMix: 0, ringModDepth: 100, ringModOffset: 0,
    diffuse: 24, diffuseDelayMs: 7, diffuseMod: 22, diffuseCoeff: 0.48, diffuseReturnGain: 100,
    shimmer: 16, shimmerReturnGain: 100, shimmerGrainMs: 42, shimmerTone: 58, alternatePitchRoles: 0, shimmerSolo: 0,
};

/** Chorus Lab's factory sounds: the starting sound with each preset's changes. */
export const factoryPresets: readonly FactoryPreset[] = [
    {
        id: "clean-wide",
        name: "Clean Wide",
        values: {
            ...startingSound,
            chorusMix: 0.62, chorusMotionMode: 1, chorusBloomMode: 0, chorusTone: 0.58, chorusFeedback: 0.28,
            chorusRingAmount: 0, chorusRingOffsetMode: 0, chorusRingFineSemitones: 0,
        },
    },
    {
        id: "bloom-ring",
        name: "Bloom Ring",
        values: {
            ...startingSound,
            chorusMix: 0.76, chorusMotionMode: 0, chorusBloomMode: 2, chorusTone: 0.72, chorusFeedback: 0.42,
            chorusRingAmount: 0.26, chorusRingOffsetMode: 0, chorusRingFineSemitones: 0.07,
        },
    },
];
