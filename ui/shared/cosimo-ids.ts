/**
 * Branded identifiers and the canonical value scale for the Cosimo adapter
 * port (docs/COSIMO_IOS_MERGE_ROADMAP.md § API contracts).
 *
 * Brands prevent mixing identifier kinds and raw numbers at compile time.
 * Values may only be branded by their owning parser modules (the descriptor
 * catalog for targets, adapters for sources/articulations) via a
 * SAFETY-commented cast next to the validation that justifies it — nothing
 * here constructs a branded value from thin air.
 */

import { err, ok, type Result } from "./result";

/** Nominal typing helper: a T distinguishable from other T's by tag B. */
export type Brand<T, B extends string> = T & { readonly __cosimoBrand: B };

/** A parameter identity ("module.param"), validated by the descriptor catalog. */
export type TargetId = Brand<string, "TargetId">;

/** A modulation source identity ("envelope-1", "velocity"), validated by the adapter. */
export type SourceId = Brand<string, "SourceId">;

/** One source→target mapping's identity, derived — never minted independently. */
export type MappingId = Brand<string, "MappingId">;

/** An articulation slot identity, validated against the bank. */
export type ArticulationId = Brand<string, "ArticulationId">;

/**
 * The UI-canonical parameter scale: the unit interval 0..1 (matches host
 * automation and the engine's normalized endpoints). Engine units exist only
 * inside descriptors and the bridge.
 */
export type NormalizedValue = Brand<number, "NormalizedValue">;

/** A finite number was outside its required range. */
export class ValueOutOfRange extends Error {
    readonly _tag = "ValueOutOfRange" as const;

    /**
     * @param input The offending input.
     * @param bounds The inclusive bounds that were violated.
     */
    constructor(readonly input: number, readonly bounds: { readonly min: number; readonly max: number }) {
        super(`Value ${input} outside [${bounds.min}, ${bounds.max}]`);
    }
}

const MAPPING_ID_SEPARATOR = "::";

/**
 * Compose the canonical mapping identity for a source attached to a target.
 *
 * @param targetId - The mapping's parameter.
 * @param sourceId - The mapping's source.
 * @returns The derived mapping id (`target::source`).
 */
export function makeMappingId(targetId: TargetId, sourceId: SourceId): MappingId {
    // SAFETY: MappingId is definitionally the composition of two already-branded
    // ids; this constructor is its only mint.
    return `${targetId}${MAPPING_ID_SEPARATOR}${sourceId}` as MappingId;
}

/**
 * Split a mapping id back into its raw target and source strings.
 *
 * The pieces come back UNBRANDED: a mapping id read from storage proves
 * nothing about whether its target or source still exists — re-validate with
 * the owning parsers.
 *
 * @param mappingId - The mapping id to split.
 * @returns The raw target and source strings, or null when the shape is wrong.
 */
export function splitMappingId(
    mappingId: string,
): { readonly targetIdRaw: string; readonly sourceIdRaw: string } | null {
    const separatorIndex = mappingId.indexOf(MAPPING_ID_SEPARATOR);
    if (separatorIndex <= 0 || separatorIndex + MAPPING_ID_SEPARATOR.length >= mappingId.length) {
        return null;
    }

    return {
        targetIdRaw: mappingId.slice(0, separatorIndex),
        sourceIdRaw: mappingId.slice(separatorIndex + MAPPING_ID_SEPARATOR.length),
    };
}

/**
 * Parse an untrusted number as a normalized value — strict, for storage and
 * protocol boundaries.
 *
 * @param input - The number to parse.
 * @returns The branded value, or ValueOutOfRange for non-finite or out-of-interval input.
 */
export function parseNormalizedValue(input: number): Result<NormalizedValue, ValueOutOfRange> {
    if (!Number.isFinite(input) || input < 0 || input > 1) {
        return err(new ValueOutOfRange(input, { min: 0, max: 1 }));
    }

    // SAFETY: bounds checked immediately above; this parser is the strict mint
    // for NormalizedValue.
    return ok(input as NormalizedValue);
}

/**
 * Clamp gesture input onto the normalized scale — total, for interactive
 * drags whose overshoot is expected and meaningless.
 *
 * @param input - The raw gesture-derived number.
 * @returns The nearest normalized value (non-finite input clamps to 0).
 */
export function clampNormalizedValue(input: number): NormalizedValue {
    const finite = Number.isFinite(input) ? input : 0;
    // SAFETY: Math.min/max pins the finite number into [0, 1]; clamping is the
    // documented domain rule for gesture input.
    return Math.min(1, Math.max(0, finite)) as NormalizedValue;
}
