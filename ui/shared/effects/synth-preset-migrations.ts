import type { EffectPluginStateContract } from "./effect-state-contract";
import type { EffectPresetMigration } from "./effect-preset-v2";
import {
    POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
    POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
} from "../polish";

const POLISH_PARAMETER_CONTRACTS = [
    {
        endpointID: POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
        min: 0,
        max: 1,
        defaultValue: 0,
    },
    {
        endpointID: POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
        min: 0,
        max: 1,
        defaultValue: 0,
    },
    {
        endpointID: POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
        min: -24,
        max: 12,
        defaultValue: 0,
    },
] as const;

/**
 * T28 intentionally ends the synth's append-and-migrate era. The current
 * exact contract must contain all three neutral Polish parameters, and no
 * pre-Polish contract is offered a migration path. Preset-v2 therefore
 * rejects an older sound before writing any parameter or stored-state value.
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    for (const expected of POLISH_PARAMETER_CONTRACTS) {
        const matches = currentContract.parameters.filter(
            (parameter) => parameter.endpointID === expected.endpointID,
        );
        const parameter = matches[0];
        if (matches.length !== 1 || parameter === undefined
                || parameter.type !== "number"
                || parameter.min !== expected.min
                || parameter.max !== expected.max
                || parameter.defaultValue !== expected.defaultValue) {
            throw new Error(
                `The current synth contract must contain exactly one neutral ${expected.endpointID} parameter.`,
            );
        }
    }

    return [];
}
