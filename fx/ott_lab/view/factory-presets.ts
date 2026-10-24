import type { FactoryPreset } from "../../../kit/index";

/** The sound OttLab.cmajor starts with: each parameter's init value. Switches are 0 (off) or 1 (on). */
const startingSound = {
    ottMix: 100, ottAmount: 100, ottTimePercent: 100, inputGainDb: 0, outputGainDb: 0,
    ottEnvelopeMatch: 0, envelopeBoostClampDb: 6, envelopeCutClampDb: 6, envelopeAttackMs: 5, envelopeReleaseMs: 120,
    upAmount: 100, downAmount: 100, detectorMode: 0, softKnee: 1, kneeWidthDb: 6, stereoLink: 100, ottBandDrive: 0,
    lowMidHz: 88.2818146, midHighHz: 2499.99951,
    lowAboveDb: -33.75, lowBelowDb: -40.75, lowDownRatio: 66.7, lowUpRatio: 4.17,
    lowAttackMs: 2.8, lowReleaseMs: 40, lowInputGainDb: 5.19999981, lowOutputGainDb: 10.3000002,
    midAboveDb: -30.25, midBelowDb: -41.75, midDownRatio: 66.7, midUpRatio: 4.17,
    midAttackMs: 1.4, midReleaseMs: 28, midInputGainDb: 5.19999981, midOutputGainDb: 5.69999981,
    highAboveDb: -35.5, highBelowDb: -40.75, highDownRatio: 1000, highUpRatio: 4.17,
    highAttackMs: 0.7, highReleaseMs: 15, highInputGainDb: 5.19999981, highOutputGainDb: 10.3000002,
};

/** OTT Lab's factory sounds: the starting sound with each preset's changes. */
export const factoryPresets: readonly FactoryPreset[] = [
    {
        id: "default-smash",
        name: "Default Smash",
        values: { ...startingSound, ottMix: 100, ottAmount: 100, ottTimePercent: 100, ottBandDrive: 0, ottEnvelopeMatch: 0 },
    },
    {
        id: "envelope-tamed",
        name: "Envelope Tamed",
        values: { ...startingSound, ottMix: 86, ottAmount: 92, ottTimePercent: 100, ottBandDrive: 12, ottEnvelopeMatch: 38 },
    },
];
