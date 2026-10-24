import { definePluginState, parameter, presets, snapshots } from "../../kit/index";
import { factoryPresets } from "./view/factory-presets";

/**
 * Every visible OttLab.cmajor parameter, keyed by its endpoint name. Bypass is
 * not part of a sound: recalling a preset or snapshot leaves it where it is.
 * The hidden hostSlot0Guard keeps host parameter slot 0 a no-op and is not
 * plugin state.
 */
export default definePluginState({
    bypass: parameter("bypass", { preset: false }),
    ottMix: parameter("ottMix"),
    ottAmount: parameter("ottAmount"),
    ottTimePercent: parameter("ottTimePercent"),
    inputGainDb: parameter("inputGainDb"),
    outputGainDb: parameter("outputGainDb"),
    ottEnvelopeMatch: parameter("ottEnvelopeMatch"),
    envelopeBoostClampDb: parameter("envelopeBoostClampDb"),
    envelopeCutClampDb: parameter("envelopeCutClampDb"),
    envelopeAttackMs: parameter("envelopeAttackMs"),
    envelopeReleaseMs: parameter("envelopeReleaseMs"),
    upAmount: parameter("upAmount"),
    downAmount: parameter("downAmount"),
    detectorMode: parameter("detectorMode"),
    softKnee: parameter("softKnee"),
    kneeWidthDb: parameter("kneeWidthDb"),
    stereoLink: parameter("stereoLink"),
    ottBandDrive: parameter("ottBandDrive"),
    lowMidHz: parameter("lowMidHz"),
    midHighHz: parameter("midHighHz"),
    lowAboveDb: parameter("lowAboveDb"),
    lowBelowDb: parameter("lowBelowDb"),
    lowDownRatio: parameter("lowDownRatio"),
    lowUpRatio: parameter("lowUpRatio"),
    lowAttackMs: parameter("lowAttackMs"),
    lowReleaseMs: parameter("lowReleaseMs"),
    lowInputGainDb: parameter("lowInputGainDb"),
    lowOutputGainDb: parameter("lowOutputGainDb"),
    midAboveDb: parameter("midAboveDb"),
    midBelowDb: parameter("midBelowDb"),
    midDownRatio: parameter("midDownRatio"),
    midUpRatio: parameter("midUpRatio"),
    midAttackMs: parameter("midAttackMs"),
    midReleaseMs: parameter("midReleaseMs"),
    midInputGainDb: parameter("midInputGainDb"),
    midOutputGainDb: parameter("midOutputGainDb"),
    highAboveDb: parameter("highAboveDb"),
    highBelowDb: parameter("highBelowDb"),
    highDownRatio: parameter("highDownRatio"),
    highUpRatio: parameter("highUpRatio"),
    highAttackMs: parameter("highAttackMs"),
    highReleaseMs: parameter("highReleaseMs"),
    highInputGainDb: parameter("highInputGainDb"),
    highOutputGainDb: parameter("highOutputGainDb"),
    ...presets({ factory: factoryPresets }),
    ...snapshots(),
});
