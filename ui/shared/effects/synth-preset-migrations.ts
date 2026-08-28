import {
    buildCanonicalPluginStateContract,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import type { EffectPresetMigration } from "./effect-preset-v2";
import { BOUNCE_STATE_KEY } from "../../../bounce/document.mjs";
import {
    GLOBAL_TUNE_ENDPOINT_ID,
    GLOBAL_TUNE_INITIAL_SEMITONES,
} from "../global-tune";
import {
    VOICE_ENHANCER_AMOUNT_ENDPOINT_ID,
    VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID,
    VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
    VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    VOICE_ENHANCER_PARAMETER_DESCRIPTORS,
    VOICE_ENHANCER_Q_ENDPOINT_ID,
} from "../voice-enhancer";

const FILTER_MIX_ENDPOINT_ID = "filterMix";
const AMP_ATTACK_ENDPOINT_ID = "ampAttack";
const AMP_DECAY_ENDPOINT_ID = "ampDecay";
const AMP_SUSTAIN_ENDPOINT_ID = "ampSustain";
const AMP_LEGACY_ATTACK_SECONDS = 0.01;
// The public minimum is the exact no-dip decay representation when Sustain=1.
const AMP_LEGACY_DECAY_SECONDS = 0.001;
const AMP_LEGACY_SUSTAIN = 1;
const FILTER_KEY_TRACK_ENABLED_ENDPOINT_ID = "filterCutoffKeyTrackEnabled";
const FILTER_KEY_TRACK_OFFSET_ENDPOINT_ID = "filterCutoffKeyTrackOffsetSemitones";

/**
 * Append-only synth migrations are derived from the live contract. Each
 * historical step fills the neutral value introduced at that step: fully-wet
 * filter Mix, oscillator-mode Bounce, zero-semitone Global Tune, the
 * bit-compatible ADSR representation of the legacy Amp Release contour,
 * neutral Filter Key Track state, then the neutral per-voice Enhancer.
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    const enhancerEndpointIDs = new Set([
        VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID,
        VOICE_ENHANCER_Q_ENDPOINT_ID,
        VOICE_ENHANCER_AMOUNT_ENDPOINT_ID,
        VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
        VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    ]);
    const preVoiceEnhancerParameters = currentContract.parameters.filter(
        (parameter) => !enhancerEndpointIDs.has(parameter.endpointID),
    );

    if (preVoiceEnhancerParameters.length !== currentContract.parameters.length - 5) {
        throw new Error("The synth contract must include all five Voice Enhancer parameters.");
    }

    const preKeyTrackParameters = preVoiceEnhancerParameters.filter(
        (parameter) => parameter.endpointID !== FILTER_KEY_TRACK_ENABLED_ENDPOINT_ID
            && parameter.endpointID !== FILTER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    );

    if (preKeyTrackParameters.length !== preVoiceEnhancerParameters.length - 2) {
        throw new Error("The synth contract must include both Voice Filter Key Track parameters.");
    }

    const preAmpParameters = preKeyTrackParameters.filter(
        (parameter) => parameter.endpointID !== AMP_ATTACK_ENDPOINT_ID
            && parameter.endpointID !== AMP_DECAY_ENDPOINT_ID
            && parameter.endpointID !== AMP_SUSTAIN_ENDPOINT_ID,
    );

    if (preAmpParameters.length !== preKeyTrackParameters.length - 3) {
        throw new Error("The synth contract must include all three appended Amp Envelope parameters.");
    }

    const preTuneParameters = preAmpParameters.filter(
        (parameter) => parameter.endpointID !== GLOBAL_TUNE_ENDPOINT_ID,
    );

    if (preTuneParameters.length === preAmpParameters.length) {
        throw new Error(`The synth contract must include the ${GLOBAL_TUNE_ENDPOINT_ID} parameter.`);
    }

    const preMixParameters = preTuneParameters.filter(
        (parameter) => parameter.endpointID !== FILTER_MIX_ENDPOINT_ID,
    );

    if (preMixParameters.length === preTuneParameters.length) {
        throw new Error("The synth contract must include the filterMix parameter.");
    }

    const preBounceStoredState = currentContract.storedState.filter(
        (entry) => entry.key !== BOUNCE_STATE_KEY,
    );

    if (preBounceStoredState.length === currentContract.storedState.length) {
        throw new Error(`The synth contract must include ${BOUNCE_STATE_KEY}.`);
    }

    const preBounceContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preTuneParameters,
        storedState: preBounceStoredState,
    });
    const preTuneContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preTuneParameters,
        storedState: currentContract.storedState,
    });
    const preMixContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preMixParameters,
        storedState: currentContract.storedState,
    });
    const preMixAndBounceContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preMixParameters,
        storedState: preBounceStoredState,
    });
    const preAmpContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preAmpParameters,
        storedState: currentContract.storedState,
    });
    const preKeyTrackContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preKeyTrackParameters,
        storedState: currentContract.storedState,
    });
    const preVoiceEnhancerContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: preVoiceEnhancerParameters,
        storedState: currentContract.storedState,
    });

    return [
        {
            effectID: currentContract.effectID,
            fromHash: preMixAndBounceContract.hash,
            toHash: preBounceContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preBounceContract,
                parameters: { ...preset.parameters, [FILTER_MIX_ENDPOINT_ID]: 1 },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preBounceContract.hash,
            toHash: preTuneContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preTuneContract,
                storedState: { ...preset.storedState, [BOUNCE_STATE_KEY]: null },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preMixContract.hash,
            toHash: preTuneContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preTuneContract,
                parameters: { ...preset.parameters, [FILTER_MIX_ENDPOINT_ID]: 1 },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preTuneContract.hash,
            toHash: preAmpContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preAmpContract,
                parameters: {
                    ...preset.parameters,
                    [GLOBAL_TUNE_ENDPOINT_ID]: GLOBAL_TUNE_INITIAL_SEMITONES,
                },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preAmpContract.hash,
            toHash: preKeyTrackContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preKeyTrackContract,
                parameters: {
                    ...preset.parameters,
                    [AMP_ATTACK_ENDPOINT_ID]: AMP_LEGACY_ATTACK_SECONDS,
                    [AMP_DECAY_ENDPOINT_ID]: AMP_LEGACY_DECAY_SECONDS,
                    [AMP_SUSTAIN_ENDPOINT_ID]: AMP_LEGACY_SUSTAIN,
                },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preKeyTrackContract.hash,
            toHash: preVoiceEnhancerContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: preVoiceEnhancerContract,
                parameters: {
                    ...preset.parameters,
                    [FILTER_KEY_TRACK_ENABLED_ENDPOINT_ID]: 0,
                    [FILTER_KEY_TRACK_OFFSET_ENDPOINT_ID]: 0,
                },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preVoiceEnhancerContract.hash,
            toHash: currentContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: currentContract,
                parameters: {
                    ...preset.parameters,
                    [VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID]:
                        VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency.initial,
                    [VOICE_ENHANCER_Q_ENDPOINT_ID]:
                        VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.initial,
                    [VOICE_ENHANCER_AMOUNT_ENDPOINT_ID]:
                        VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.initial,
                    [VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID]: 0,
                    [VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID]: 0,
                },
            }),
        },
    ];
}
