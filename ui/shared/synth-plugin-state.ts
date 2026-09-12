import { definePluginState, parameter, preparedState, storedValue } from "../../kit/index";
import type { PluginStateParameter } from "../../kit/ui/plugin-state-definition";
import { createDefaultModulationState, MODULATION_STATE_KEY } from "./modulation";
import { modulationStateCodec } from "./synth-modulation-state";
import { OSCILLATOR_BINDING_CONTRACTS } from "./oscillator-binding";
import { allEffectOutputTrimHostEndpointIDs } from "./effect-output-trim";
import { synthModulationDelivery } from "../worker/synth-modulation-binding";
import { rackStateCodec, articulationStateCodec } from "./synth-document-state";
import { createDefaultLaneStateV2, synchronizeLaneOutputTrimsFromHostParameters } from "./lane-state-v2";
import { LANE_STATE_KEY } from "./lane-state";
import { ARTICULATIONS_V4_STATE_KEY, createEmptyArticulationsState } from "./articulation-image";
import { synthRackDelivery } from "../worker/synth-rack-delivery";

// Reuse the oscillator and resident-effect identities. Ranges/defaults still
// come from the actual host parameter; this declares user editing and history.
export const synthParameterByEndpoint: Readonly<Record<string, PluginStateParameter>> = Object.freeze({
    ...Object.fromEntries(OSCILLATOR_BINDING_CONTRACTS.flatMap(({ controls }) =>
        controls.map(({ endpointID }) => [endpointID, parameter(endpointID)]))),
    ...Object.fromEntries(allEffectOutputTrimHostEndpointIDs().map(endpoint => [endpoint, parameter(endpoint)])),
    playMode: parameter("playMode"),
    glideTime: parameter("glideTime"),
    macro1: parameter("macro1"),
    macro2: parameter("macro2"),
    macro3: parameter("macro3"),
    macro4: parameter("macro4"),
    filterMode: parameter("filterMode"),
    filterCutoff: parameter("filterCutoff"),
    filterQ: parameter("filterQ"),
    mseg1Morph: parameter("mseg1Morph"),
    mseg2Morph: parameter("mseg2Morph"),
    mseg3Morph: parameter("mseg3Morph"),
    mseg1Rate: parameter("mseg1Rate"),
    mseg2Rate: parameter("mseg2Rate"),
    mseg3Rate: parameter("mseg3Rate"),
    env1Attack: parameter("env1Attack"),
    env1Decay: parameter("env1Decay"),
    env1Sustain: parameter("env1Sustain"),
    env1Release: parameter("env1Release"),
    env2Attack: parameter("env2Attack"),
    env2Decay: parameter("env2Decay"),
    env2Sustain: parameter("env2Sustain"),
    env2Release: parameter("env2Release"),
    env3Attack: parameter("env3Attack"),
    env3Decay: parameter("env3Decay"),
    env3Sustain: parameter("env3Sustain"),
    env3Release: parameter("env3Release"),
    filterMix: parameter("filterMix"),
    ampRelease: parameter("ampRelease"),
    sourceMode: parameter("sourceMode"),
    globalTune: parameter("globalTune"),
    ampAttack: parameter("ampAttack"),
    ampDecay: parameter("ampDecay"),
    ampSustain: parameter("ampSustain"),
    filterCutoffKeyTrackEnabled: parameter("filterCutoffKeyTrackEnabled"),
    filterCutoffKeyTrackOffsetSemitones: parameter("filterCutoffKeyTrackOffsetSemitones"),
    voiceEnhancerFrequency: parameter("voiceEnhancerFrequency"),
    voiceEnhancerQ: parameter("voiceEnhancerQ"),
    voiceEnhancerAmount: parameter("voiceEnhancerAmount"),
    voiceEnhancerKeyTrackEnabled: parameter("voiceEnhancerKeyTrackEnabled"),
    voiceEnhancerKeyTrackOffsetSemitones: parameter("voiceEnhancerKeyTrackOffsetSemitones"),
    polishEnhancerAmount: parameter("polishEnhancerAmount"),
    polishCompressionClipAmount: parameter("polishCompressionClipAmount"),
    polishOutputTrimDb: parameter("polishOutputTrimDb"),
    polishSafeBassAmount: parameter("polishSafeBassAmount"),
    polishSafeBassBypass: parameter("polishSafeBassBypass"),
    polishEnhancerBypass: parameter("polishEnhancerBypass"),
    polishCompressionClipBypass: parameter("polishCompressionClipBypass"),
    polishOutputTrimBypass: parameter("polishOutputTrimBypass"),
});

/** All audible host controls and editable modulation share one plugin history. */
export const synthPluginState = definePluginState({
    ...synthParameterByEndpoint,
    [MODULATION_STATE_KEY]: preparedState({ initial: createDefaultModulationState(), codec: modulationStateCodec, prepare: value => value, engine: synthModulationDelivery }),
    [LANE_STATE_KEY]: preparedState({
        initial: createDefaultLaneStateV2(), codec: rackStateCodec,
        dependencies: allEffectOutputTrimHostEndpointIDs(),
        prepare: (value, { parameters }) => synchronizeLaneOutputTrimsFromHostParameters(value, parameters),
        engine: synthRackDelivery,
    }),
    [ARTICULATIONS_V4_STATE_KEY]: storedValue({ initial: createEmptyArticulationsState(), codec: articulationStateCodec }),
});
