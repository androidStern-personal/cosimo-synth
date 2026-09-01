import type { EffectPluginStateContract } from "../../../kit/ui/effects/effect-state-contract";
import type { EffectPresetMigration } from "../../../kit/ui/effects/effect-preset-v2";
import {
    POLISH_COMPRESSION_CLIP_BYPASS_ENDPOINT_ID,
    POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID,
    POLISH_ENHANCER_BYPASS_ENDPOINT_ID,
    POLISH_ENHANCER_AMOUNT_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_BYPASS_ENDPOINT_ID,
    POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID,
    POLISH_SAFE_BASS_AMOUNT_ENDPOINT_ID,
    POLISH_SAFE_BASS_BYPASS_ENDPOINT_ID,
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
    {
        endpointID: POLISH_SAFE_BASS_AMOUNT_ENDPOINT_ID,
        type: "number",
        min: 0,
        max: 1,
        defaultValue: 0,
    },
    ...[
        POLISH_SAFE_BASS_BYPASS_ENDPOINT_ID,
        POLISH_ENHANCER_BYPASS_ENDPOINT_ID,
        POLISH_COMPRESSION_CLIP_BYPASS_ENDPOINT_ID,
        POLISH_OUTPUT_TRIM_BYPASS_ENDPOINT_ID,
    ].map((endpointID) => ({
        endpointID,
        type: "integer" as const,
        min: 0,
        max: 1,
        defaultValue: 0,
        discrete: true,
        step: 1,
        text: "Active|Bypassed",
    })),
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
    const matchesAuthoredNumber = (
        actual: number | undefined,
        expected: number | undefined,
        allowFloat32: boolean,
    ) => actual === expected || (
        allowFloat32
        && typeof actual === "number"
        && typeof expected === "number"
        && Number.isFinite(actual)
        && Number.isFinite(expected)
        && actual === Math.fround(expected)
    );

    for (const expected of expectedContracts) {
        const matches = currentContract.parameters.filter(
            (parameter) => parameter.endpointID === expected.endpointID,
        );
        const parameter = matches[0];
        const allowFloat32 = expected.type === "number";
        if (matches.length !== 1 || parameter === undefined
                || parameter.type !== expected.type
                || !matchesAuthoredNumber(parameter.min, expected.min, allowFloat32)
                || !matchesAuthoredNumber(parameter.max, expected.max, allowFloat32)
                || !matchesAuthoredNumber(
                    typeof parameter.defaultValue === "number" ? parameter.defaultValue : undefined,
                    expected.defaultValue,
                    allowFloat32,
                )
                || parameter.discrete !== expected.discrete
                || !matchesAuthoredNumber(parameter.step, expected.step, allowFloat32)
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
 * all eight neutral Polish parameters. No pre-T62/T74 contract is offered
 * a migration path, so preset-v2 rejects an older sound before any write.
 */
export function buildSynthPresetMigrations(
    currentContract: EffectPluginStateContract,
): EffectPresetMigration[] {
    assertExactParameterContracts(currentContract, VOICE_ENHANCER_PARAMETER_CONTRACTS, "landed");
    assertExactParameterContracts(currentContract, POLISH_PARAMETER_CONTRACTS, "neutral");

    return [];
}
