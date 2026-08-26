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

const FILTER_MIX_ENDPOINT_ID = "filterMix";

/**
 * Append-only synth migrations are derived from the live contract. Each
 * historical step fills the neutral value introduced at that step: fully-wet
 * filter Mix, oscillator-mode Bounce, then zero-semitone Global Tune.
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    const preTuneParameters = currentContract.parameters.filter(
        (parameter) => parameter.endpointID !== GLOBAL_TUNE_ENDPOINT_ID,
    );

    if (preTuneParameters.length === currentContract.parameters.length) {
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
            toHash: currentContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: currentContract,
                parameters: {
                    ...preset.parameters,
                    [GLOBAL_TUNE_ENDPOINT_ID]: GLOBAL_TUNE_INITIAL_SEMITONES,
                },
            }),
        },
    ];
}
