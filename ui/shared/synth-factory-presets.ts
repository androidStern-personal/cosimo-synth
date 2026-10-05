import type { FactoryPreset } from "../../kit/ui/presets";
import { allEffectOutputTrimHostEndpointIDs } from "./effect-output-trim";
import { createDefaultModulationState, MODULATION_STATE_KEY } from "./modulation";
import { createDefaultLaneStateV2 } from "./lane-state-v2";
import { LANE_STATE_KEY } from "./lane-state";
import { ARTICULATIONS_V4_STATE_KEY, createEmptyArticulationsState } from "./articulation-image";

/** One oscillator's init values from WavetableSynth.cmajor. Only Oscillator A starts unmuted. */
function oscillatorInit(id: "A" | "B" | "C", mute: 0 | 1) {
    return {
        [`osc${id}WavetableSelect`]: 35, [`osc${id}WavetablePosition`]: 0, [`osc${id}Pan`]: 0,
        [`osc${id}Octave`]: 0, [`osc${id}Semitone`]: 0, [`osc${id}FineCents`]: 0,
        [`osc${id}Phase`]: 0, [`osc${id}PhaseRandom`]: 0, [`osc${id}Retrigger`]: 1,
        [`osc${id}VolumeDb`]: 0, [`osc${id}Mute`]: mute, [`osc${id}Solo`]: 0,
        [`osc${id}WarpMode`]: 0, [`osc${id}WarpAmount`]: 0,
        [`osc${id}UnisonVoices`]: 1, [`osc${id}UnisonDetune`]: 0.1, [`osc${id}UnisonBlend`]: 0.75, [`osc${id}UnisonWidth`]: 1,
        [`osc${id}UnisonDetuneMode`]: 0, [`osc${id}UnisonStackMode`]: 0,
        [`osc${id}UnisonPositionSpread`]: 0, [`osc${id}UnisonWarpSpread`]: 0,
    };
}

/** The sound a new synth instance starts with: every parameter's init value and the default documents. */
const initSound = {
    ...oscillatorInit("A", 0),
    ...oscillatorInit("B", 1),
    ...oscillatorInit("C", 1),
    ...Object.fromEntries(allEffectOutputTrimHostEndpointIDs().map(endpoint => [endpoint, 0])),
    playMode: 0, glideTime: 0, globalTune: 0,
    macro1: 0, macro2: 0, macro3: 0, macro4: 0,
    filterMode: 1, filterCutoff: 1000, filterQ: 0.707107, filterMix: 1,
    filterCutoffKeyTrackEnabled: 0, filterCutoffKeyTrackOffsetSemitones: 0,
    mseg1Morph: 0, mseg2Morph: 0, mseg3Morph: 0,
    mseg1Rate: 1, mseg2Rate: 1, mseg3Rate: 1,
    env1Attack: 0.01, env1Decay: 0.25, env1Sustain: 0.5, env1Release: 0.2,
    env2Attack: 0.01, env2Decay: 0.25, env2Sustain: 0.5, env2Release: 0.2,
    env3Attack: 0.01, env3Decay: 0.25, env3Sustain: 0.5, env3Release: 0.2,
    ampAttack: 0.01, ampDecay: 0.001, ampSustain: 1, ampRelease: 0.2,
    voiceEnhancerFrequency: 130, voiceEnhancerQ: 0.71, voiceEnhancerAmount: 0,
    voiceEnhancerKeyTrackEnabled: 0, voiceEnhancerKeyTrackOffsetSemitones: 0,
    polishEnhancerAmount: 0, polishCompressionClipAmount: 0, polishOutputTrimDb: 0, polishSafeBassAmount: 0,
    polishSafeBassBypass: 0, polishEnhancerBypass: 0, polishCompressionClipBypass: 0, polishOutputTrimBypass: 0,
    [MODULATION_STATE_KEY]: createDefaultModulationState(),
    [LANE_STATE_KEY]: createDefaultLaneStateV2(),
    [ARTICULATIONS_V4_STATE_KEY]: createEmptyArticulationsState(),
};

/** The synth's factory sounds. Init is the starting sound, so recalling it is the synth's Init command. */
export const synthFactoryPresets: readonly FactoryPreset[] = [
    { id: "init", name: "Init", values: initSound },
];
