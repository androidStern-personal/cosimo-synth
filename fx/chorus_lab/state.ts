import { definePluginState, parameter, presets, snapshots } from "../../kit/index";
import { factoryPresets } from "./view/factory-presets";

/**
 * Every visible ChorusLab.cmajor parameter, keyed by its endpoint name. The
 * Chorus On switch is not part of a sound: recalling a preset or snapshot
 * leaves it where it is.
 */
export default definePluginState({
    chorusEnabled: parameter("chorusEnabled", { preset: false }),
    chorusMix: parameter("chorusMix"),
    chorusMotionMode: parameter("chorusMotionMode"),
    chorusBloomMode: parameter("chorusBloomMode"),
    chorusTone: parameter("chorusTone"),
    chorusFeedback: parameter("chorusFeedback"),
    chorusRingAmount: parameter("chorusRingAmount"),
    chorusRingOffsetMode: parameter("chorusRingOffsetMode"),
    chorusRingFineSemitones: parameter("chorusRingFineSemitones"),
    voices: parameter("voices"),
    rateHz: parameter("rateHz"),
    modDepthMs: parameter("modDepthMs"),
    driftMs: parameter("driftMs"),
    feedback: parameter("feedback"),
    loopHighpassHz: parameter("loopHighpassHz"),
    loopLowpassHz: parameter("loopLowpassHz"),
    drive: parameter("drive"),
    ringModMix: parameter("ringModMix"),
    ringModDepth: parameter("ringModDepth"),
    ringModOffset: parameter("ringModOffset"),
    diffuse: parameter("diffuse"),
    diffuseDelayMs: parameter("diffuseDelayMs"),
    diffuseMod: parameter("diffuseMod"),
    diffuseCoeff: parameter("diffuseCoeff"),
    diffuseReturnGain: parameter("diffuseReturnGain"),
    shimmer: parameter("shimmer"),
    shimmerReturnGain: parameter("shimmerReturnGain"),
    shimmerGrainMs: parameter("shimmerGrainMs"),
    shimmerTone: parameter("shimmerTone"),
    alternatePitchRoles: parameter("alternatePitchRoles"),
    shimmerSolo: parameter("shimmerSolo"),
    ...presets({ factory: factoryPresets }),
    ...snapshots(),
});
