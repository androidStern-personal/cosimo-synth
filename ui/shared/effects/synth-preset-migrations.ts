import {
    buildCanonicalPluginStateContract,
    type EffectPluginStateContract,
} from "./effect-state-contract";
import type { EffectPresetMigration } from "./effect-preset-v2";

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

    const legacyContract = buildCanonicalPluginStateContract({
        effectID: currentContract.effectID,
        parameters: legacyParameters,
        storedState: currentContract.storedState,
    });

    return [{
        effectID: currentContract.effectID,
        fromHash: legacyContract.hash,
        toHash: currentContract.hash,
        migrate: (preset) => ({
            ...preset,
            contract: currentContract,
            parameters: { ...preset.parameters, [FILTER_MIX_ENDPOINT_ID]: 1 },
        }),
    }];
}
