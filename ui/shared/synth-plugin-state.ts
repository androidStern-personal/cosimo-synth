import { definePluginState, parameter, preparedState, storedValue, type PluginStateCodec, type PluginStateParameter } from "../../kit/ui/plugin-state-definition";
import { presets } from "../../kit/ui/presets";
import { snapshots } from "../../kit/ui/snapshots";
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
import { synthFactoryPresets } from "./synth-factory-presets";
import { BOUNCE_STATE_KEY, parseBounceDocument, serializeBounceDocument, type BounceDocument } from "../../bounce/document.mjs";

/**
 * Oscillators or the bounced bank. Not in presets or snapshots: a bounced source is the bank
 * that bounce.v1 names, which a preset cannot hold, so recalling the mode alone would select a
 * bank the preset never saved.
 */
export const synthSourceMode = parameter("sourceMode", { preset: false });

function freezeDeep<Value>(value: Value): Value {
    if (value !== null && typeof value === "object") {
        for (const child of Object.values(value)) freezeDeep(child);
        Object.freeze(value);
    }
    return value;
}

// A reference embeds the whole sound it replaced, so its saved text is computed once per accepted value.
const bounceReferenceText = new WeakMap<BounceDocument, string>();
function savedBounceReference(value: BounceDocument): string {
    let text = bounceReferenceText.get(value);
    if (text === undefined) bounceReferenceText.set(value, text = serializeBounceDocument(value));
    return text;
}

const bounceReferenceCodec: PluginStateCodec<BounceDocument | null> = {
    parse(input) {
        if (input === null) return { kind: "ok", value: null };
        try { return { kind: "ok", value: freezeDeep(parseBounceDocument(input)) }; }
        catch (error) { return { kind: "error", message: error instanceof Error ? error.message : String(error) }; }
    },
    encode: value => value === null ? null : savedBounceReference(value),
    equals: (a, b) => a === b || (a !== null && b !== null && savedBounceReference(a) === savedBounceReference(b)),
};

/**
 * The bounced bank this sound plays, or null. Bounce, Revert, Undo and Redo change it together
 * with the source mode and the neutralized sound. Not in presets or snapshots: the bank is stored
 * outside the project and retired once later bounces supersede it, so a preset could name a bank
 * that no longer exists.
 */
export const synthBounceReference = storedValue({ initial: null, codec: bounceReferenceCodec, preset: false });

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
    sourceMode: synthSourceMode,
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

/**
 * All audible host controls and editable modulation share one plugin history.
 * Presets and snapshots recall every field except the source mode and the bounce reference.
 */
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
    [BOUNCE_STATE_KEY]: synthBounceReference,
    ...presets({ factory: synthFactoryPresets }),
    ...snapshots(),
});
