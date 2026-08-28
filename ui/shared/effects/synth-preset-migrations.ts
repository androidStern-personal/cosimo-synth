import type { EffectPluginStateContract } from "./effect-state-contract";
import type { EffectPresetMigration } from "./effect-preset-v2";
import {
    POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
    POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
} from "../polish";
import {
    VOICE_ENHANCER_AMOUNT_ENDPOINT_ID,
    VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID,
    VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
    VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    VOICE_ENHANCER_PARAMETER_DESCRIPTORS,
    VOICE_ENHANCER_Q_ENDPOINT_ID,
    VOICE_ENHANCER_RATIO_MAX_SEMITONES,
    VOICE_ENHANCER_RATIO_MIN_SEMITONES,
} from "../voice-enhancer";

const VOICE_ENHANCER_PARAMETER_CONTRACTS = [
    {
        endpointID: VOICE_ENHANCER_FREQUENCY_ENDPOINT_ID,
        type: "number",
        min: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency.min,
        max: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency.max,
        defaultValue: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency.initial,
    },
    {
        endpointID: VOICE_ENHANCER_Q_ENDPOINT_ID,
        type: "number",
        min: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.min,
        max: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.max,
        defaultValue: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q.initial,
    },
    {
        endpointID: VOICE_ENHANCER_AMOUNT_ENDPOINT_ID,
        type: "number",
        min: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.min,
        max: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.max,
        defaultValue: VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount.initial,
    },
    {
        endpointID: VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
        type: "integer",
        min: 0,
        max: 1,
        defaultValue: 0,
        discrete: true,
        step: 1,
        text: "Off|On",
    },
    {
        endpointID: VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
        type: "number",
        min: VOICE_ENHANCER_RATIO_MIN_SEMITONES,
        max: VOICE_ENHANCER_RATIO_MAX_SEMITONES,
        defaultValue: 0,
    },
] as const;

const POLISH_PARAMETER_CONTRACTS = [
    {
        endpointID: POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
        type: "number",
        min: 0,
        max: 1,
        defaultValue: 0,
    },
    {
        endpointID: POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
        type: "number",
        min: 0,
        max: 1,
        defaultValue: 0,
    },
    {
        endpointID: POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
        type: "number",
        min: -24,
        max: 12,
        defaultValue: 0,
    },
] as const;

function assertExactParameterContracts(
    currentContract: EffectPluginStateContract,
    expectedContracts: readonly {
        readonly endpointID: string;
        readonly type: "number" | "integer" | "boolean";
        readonly min: number;
        readonly max: number;
        readonly defaultValue: number;
        readonly discrete?: boolean;
        readonly step?: number;
        readonly text?: string;
    }[],
    description: string,
): void {
    for (const expected of expectedContracts) {
        const matches = currentContract.parameters.filter(
            (parameter) => parameter.endpointID === expected.endpointID,
        );
        const parameter = matches[0];
        if (matches.length !== 1 || parameter === undefined
                || parameter.type !== expected.type
                || parameter.min !== expected.min
                || parameter.max !== expected.max
                || parameter.defaultValue !== expected.defaultValue
                || parameter.discrete !== expected.discrete
                || parameter.step !== expected.step
                || parameter.text !== expected.text) {
            throw new Error(
                `The current synth contract must contain exactly one ${description} ${expected.endpointID} parameter.`,
            );
        }
    }
}

/**
 * T28 intentionally ends the synth's append-and-migrate era. The current
 * exact contract must contain T62's five landed Voice Enhancer parameters and
 * all three neutral Polish parameters. No pre-T62/Polish contract is offered
 * a migration path, so preset-v2 rejects an older sound before any write.
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    assertExactParameterContracts(currentContract, VOICE_ENHANCER_PARAMETER_CONTRACTS, "landed");
    assertExactParameterContracts(currentContract, POLISH_PARAMETER_CONTRACTS, "neutral");

    return [];
}
