import {
    buildCanonicalPluginStateContract,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import type { EffectPresetMigration } from "./effect-preset-v2";
import { BOUNCE_STATE_KEY } from "../../../bounce/document.mjs";

const FILTER_MIX_ENDPOINT_ID = "filterMix";

/**
 * T05: synth presets saved before the Voice filter Mix append have no
 * "filterMix" value. That legacy contract is exactly the current one without
 * the appended parameter, so its hash is rebuilt from the live contract and
 * the migration fills the engine's back-compat value (fully wet).
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    const legacyParameters = currentContract.parameters.filter(
        (parameter) => parameter.endpointID !== FILTER_MIX_ENDPOINT_ID,
    );

    if (legacyParameters.length === currentContract.parameters.length) {
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
        parameters: currentContract.parameters,
        storedState: preBounceStoredState,
    });
    const preMixContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: legacyParameters,
        storedState: currentContract.storedState,
    });
    const preMixAndBounceContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: legacyParameters,
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
            toHash: currentContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: currentContract,
                storedState: { ...preset.storedState, [BOUNCE_STATE_KEY]: null },
            }),
        },
        {
            effectID: currentContract.effectID,
            fromHash: preMixContract.hash,
            toHash: currentContract.hash,
            migrate: (preset) => ({
                ...preset,
                contract: currentContract,
                parameters: { ...preset.parameters, [FILTER_MIX_ENDPOINT_ID]: 1 },
            }),
        },
    ];
}
