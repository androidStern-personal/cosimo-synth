/**
 * Deterministic fast-check generators for the public SeqFX state contract.
 *
 * Each factory accepts the fast-check module because the UI test loader bundles
 * this file into a data URL. Importing fast-check here would create a second
 * bundled copy whose Arbitrary instances are not owned by the test runner.
 */

import {
    SEQFX_PARAM_COUNT,
    SEQFX_SELECTABLE_EFFECT_IDS,
    getSeqFxDefaultParams,
    getSeqFxParamLimits,
    isSeqFxAuxEligibleDefinition,
    isSeqFxIntegerParam,
    type SeqFxEffectType,
} from "./seqfx-effect-definitions";
import {
    SEQFX_AUX_RATE_MODES,
    SEQFX_AUX_SHAPE_MAX,
    SEQFX_AUX_SHAPE_MIN,
    SEQFX_AUX_SLICE_COUNT_MAX,
    SEQFX_AUX_SLICE_COUNT_MIN,
    SEQFX_AUX_SOURCE_CURVE_MAX,
    SEQFX_AUX_SOURCE_CURVE_MIN,
    SEQFX_AUX_TEMPO_MULTIPLIER_MAX,
    SEQFX_AUX_TEMPO_MULTIPLIER_MIN,
    SEQFX_LANE_COUNT,
    SEQFX_PATTERN_COUNT,
    SEQFX_STATE_VERSION,
    SEQFX_STEP_COUNT,
    parseStrictSeqFxStateV7,
    serializeSeqFxState,
    type SeqFxState,
    type SeqFxStoredAux,
    type SeqFxStoredAuxTarget,
    type SeqFxStoredBlock,
    type SeqFxStoredChain,
    type SeqFxStoredMemories,
    type SeqFxStoredPattern,
    type SeqFxStoredStateV7,
} from "./seqfx-state";

type FastCheck = typeof import("fast-check");
type Arbitrary<T> = import("fast-check").Arbitrary<T>;

type BlockTopology = {
    startStep: number;
    length: number;
    effectType: SeqFxEffectType;
};

type SeqFxBlockOperationCase = {
    patternIndex: number;
    lane: number;
    startStep: number;
    length: number;
    resizedLength: number;
    targetLane: number;
    targetStartStep: number;
    moveLane: number;
    moveStartStep: number;
    sameLaneBlockerStart: number;
    collisionResizeLength: number;
    effectType: SeqFxEffectType;
    mix: number;
    paramIndex: number;
    paramValue: number;
    auxSource: {
        shape: number;
        sourceCurve: number;
        rateMode: "tempo" | "slice";
        tempoMultiplier: number;
        tempoTriplet: boolean;
        sliceCount: number;
    };
};

type SeqFxEditCommand =
    | { tag: "create"; patternIndex: number; lane: number; startStep: number; length: number; effectType: number }
    | { tag: "resize"; patternIndex: number; lane: number; startStep: number; length: number }
    | { tag: "move"; patternIndex: number; lane: number; startStep: number; targetLane: number; targetStartStep: number }
    | { tag: "copy"; patternIndex: number; lane: number; startStep: number; targetLane: number; targetStartStep: number }
    | { tag: "delete"; patternIndex: number; lane: number; startStep: number }
    | { tag: "mix"; patternIndex: number; lane: number; startStep: number; value: number }
    | { tag: "param"; patternIndex: number; lane: number; startStep: number; paramIndex: number; value: number };

function finiteDoubleArbitrary(fc: FastCheck, min: number, max: number): Arbitrary<number> {
    if (min === max) {
        return fc.constant(min);
    }

    return fc
        .double({ min, max, noNaN: true, noDefaultInfinity: true })
        .map((value) => (Object.is(value, -0) ? 0 : value));
}

function parameterValueArbitrary(
    fc: FastCheck,
    effectType: SeqFxEffectType,
    paramIndex: number,
): Arbitrary<number> {
    const [min, max] = getSeqFxParamLimits(effectType, paramIndex);
    return isSeqFxIntegerParam(effectType, paramIndex)
        ? fc.integer({ min: Math.ceil(min), max: Math.floor(max) })
        : finiteDoubleArbitrary(fc, min, max);
}

function denseAuxSourceArbitrary(fc: FastCheck): Arbitrary<SeqFxBlockOperationCase["auxSource"]> {
    return fc.record({
        shape: finiteDoubleArbitrary(fc, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX),
        sourceCurve: finiteDoubleArbitrary(fc, SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX),
        rateMode: fc.constantFrom(SEQFX_AUX_RATE_MODES.tempo, SEQFX_AUX_RATE_MODES.slice),
        tempoMultiplier: fc.integer({ min: SEQFX_AUX_TEMPO_MULTIPLIER_MIN, max: SEQFX_AUX_TEMPO_MULTIPLIER_MAX }),
        tempoTriplet: fc.boolean(),
        sliceCount: fc.integer({ min: SEQFX_AUX_SLICE_COUNT_MIN, max: SEQFX_AUX_SLICE_COUNT_MAX }),
    });
}

/**
 * Generates any non-empty effect ID owned by the SeqFX schema.
 *
 * @param fc - The caller's fast-check module.
 * @returns An arbitrary selectable SeqFX effect ID.
 */
export function seqFxEffectTypeArbitrary(fc: FastCheck): Arbitrary<SeqFxEffectType> {
    return fc.constantFrom(...SEQFX_SELECTABLE_EFFECT_IDS);
}

/**
 * Generates a complete eight-value parameter vector inside one effect's limits.
 *
 * @param fc - The caller's fast-check module.
 * @param effectType - The effect whose parameter contract owns the vector.
 * @returns An arbitrary valid parameter vector.
 */
export function seqFxParameterVectorArbitrary(
    fc: FastCheck,
    effectType: SeqFxEffectType,
): Arbitrary<number[]> {
    return fc.tuple(
        ...Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
            parameterValueArbitrary(fc, effectType, paramIndex)
        )),
    );
}

/**
 * Generates the sparse aux document accepted by strict v7 parsing.
 *
 * @param fc - The caller's fast-check module.
 * @param effectType - The effect whose target ranges own aux end values.
 * @param params - The block parameters, used as realistic target endpoints.
 * @returns An arbitrary valid sparse aux document.
 */
export function seqFxStoredAuxArbitrary(
    fc: FastCheck,
    effectType: SeqFxEffectType,
    params: readonly number[],
): Arbitrary<SeqFxStoredAux> {
    const sourceArbitrary = fc.record({
        shape: finiteDoubleArbitrary(fc, SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX),
        sourceCurve: finiteDoubleArbitrary(fc, SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX),
        rateMode: fc.constantFrom(SEQFX_AUX_RATE_MODES.tempo, SEQFX_AUX_RATE_MODES.slice),
        tempoMultiplier: fc.integer({ min: SEQFX_AUX_TEMPO_MULTIPLIER_MIN, max: SEQFX_AUX_TEMPO_MULTIPLIER_MAX }),
        tempoTriplet: fc.boolean(),
        sliceCount: fc.integer({ min: SEQFX_AUX_SLICE_COUNT_MIN, max: SEQFX_AUX_SLICE_COUNT_MAX }),
        includeShape: fc.boolean(),
        includeSourceCurve: fc.boolean(),
        includeRateMode: fc.boolean(),
        includeTempoMultiplier: fc.boolean(),
        includeTempoTriplet: fc.boolean(),
        includeSliceCount: fc.boolean(),
    }).map((source) => ({
        ...(source.includeShape ? { shape: source.shape } : {}),
        ...(source.includeSourceCurve ? { sourceCurve: source.sourceCurve } : {}),
        ...(source.includeRateMode ? { rateMode: source.rateMode } : {}),
        ...(source.includeTempoMultiplier ? { tempoMultiplier: source.tempoMultiplier } : {}),
        ...(source.includeTempoTriplet ? { tempoTriplet: source.tempoTriplet } : {}),
        ...(source.includeSliceCount ? { sliceCount: source.sliceCount } : {}),
    }));

    const eligibleTargetIndices = Array.from(
        { length: SEQFX_PARAM_COUNT },
        (_unused, paramIndex) => paramIndex,
    ).filter((paramIndex) => isSeqFxAuxEligibleDefinition(effectType, paramIndex));
    const targetsArbitrary = fc
        .subarray(eligibleTargetIndices)
        .chain((indices): Arbitrary<SeqFxStoredAuxTarget[]> => {
            const sortedIndices = [...indices].sort((left, right) => left - right);
            if (sortedIndices.length === 0) {
                return fc.constant([] as SeqFxStoredAuxTarget[]);
            }

            return fc.tuple(...sortedIndices.map((index) => (
                fc.record({
                    mode: fc.constantFrom("enabled", "end", "both"),
                    enabled: fc.boolean(),
                    end: fc.oneof(
                        fc.constant(params[index] ?? getSeqFxDefaultParams(effectType)[index]),
                        parameterValueArbitrary(fc, effectType, index),
                    ),
                }).map(({ mode, enabled, end }) => ({
                    index,
                    ...(mode !== "end" ? { enabled } : {}),
                    ...(mode !== "enabled" ? { end } : {}),
                }))
            ))).map((targets) => [...targets]);
        });

    return fc.record({
        source: sourceArbitrary,
        targets: targetsArbitrary,
        includeSource: fc.boolean(),
        includeTargets: fc.boolean(),
    }).map(({ source, targets, includeSource, includeTargets }) => ({
        ...(includeSource ? { source } : {}),
        ...(includeTargets ? { targets } : {}),
    }));
}

function storedMemoriesArbitrary(fc: FastCheck): Arbitrary<SeqFxStoredMemories> {
    return seqFxEffectTypeArbitrary(fc).chain((effectType) => (
        seqFxParameterVectorArbitrary(fc, effectType).chain((params) => (
            seqFxStoredAuxArbitrary(fc, effectType, params).map((aux) => ({
                params: { [String(effectType)]: params },
                aux: { [String(effectType)]: aux },
            }))
        ))
    ));
}

function storedStepFieldsArbitrary(
    fc: FastCheck,
    effectType: SeqFxEffectType,
): Arbitrary<Omit<SeqFxStoredBlock, "startStep" | "length" | "effectType" | "stepOverrides">> {
    return seqFxParameterVectorArbitrary(fc, effectType).chain((params) => (
        fc.record({
            mix: finiteDoubleArbitrary(fc, 0, 1),
            aux: seqFxStoredAuxArbitrary(fc, effectType, params),
            memories: storedMemoriesArbitrary(fc),
            includeMix: fc.boolean(),
            includeParams: fc.boolean(),
            includeAux: fc.boolean(),
            includeMemories: fc.boolean(),
        }).map((fields) => ({
            ...(fields.includeMix ? { mix: fields.mix } : {}),
            ...(fields.includeParams ? { params } : {}),
            ...(fields.includeAux ? { aux: fields.aux } : {}),
            ...(fields.includeMemories ? { memories: fields.memories } : {}),
        }))
    ));
}

function storedBlockArbitrary(fc: FastCheck, topology: BlockTopology): Arbitrary<SeqFxStoredBlock> {
    return storedStepFieldsArbitrary(fc, topology.effectType).chain((fields) => {
        const overrideArbitrary = topology.length === 1
            ? fc.constant(undefined)
            : fc.option(
                storedStepFieldsArbitrary(fc, topology.effectType).chain((overrideFields) => (
                    fc.integer({ min: 1, max: topology.length - 1 }).map((offset) => ({
                        offset,
                        ...overrideFields,
                    }))
                )),
                { nil: undefined },
            );

        return overrideArbitrary.map((override) => ({
            startStep: topology.startStep,
            ...(topology.length !== 1 ? { length: topology.length } : {}),
            effectType: topology.effectType,
            ...fields,
            ...(override ? { stepOverrides: [override] } : {}),
        }));
    });
}

function chainTopologyArbitrary(fc: FastCheck): Arbitrary<BlockTopology[]> {
    return fc.array(
        fc.record({
            gap: fc.integer({ min: 0, max: 5 }),
            length: fc.integer({ min: 1, max: 8 }),
            effectType: seqFxEffectTypeArbitrary(fc),
        }),
        { maxLength: 6 },
    ).map((entries) => {
        const blocks: BlockTopology[] = [];
        let cursor = 0;

        for (const entry of entries) {
            cursor += entry.gap;
            if (cursor >= SEQFX_STEP_COUNT) {
                break;
            }

            const length = Math.min(entry.length, SEQFX_STEP_COUNT - cursor);
            blocks.push({ startStep: cursor, length, effectType: entry.effectType });
            cursor += length;
        }

        return blocks;
    });
}

function storedChainArbitrary(fc: FastCheck): Arbitrary<SeqFxStoredChain> {
    return chainTopologyArbitrary(fc).chain((topology) => {
        if (topology.length === 0) {
            return fc.constant({ blocks: [] });
        }

        return fc.tuple(...topology.map((block) => storedBlockArbitrary(fc, block)))
            .map((blocks) => ({ blocks }));
    });
}

function storedPatternArbitrary(fc: FastCheck): Arbitrary<SeqFxStoredPattern> {
    return fc.record({
        revision: fc.integer({ min: 1, max: 1_000_000 }),
        chains: fc.tuple(...Array.from({ length: SEQFX_LANE_COUNT }, () => storedChainArbitrary(fc))),
    });
}

/**
 * Generates a strict-parser-valid sparse v7 document with one randomized pattern.
 *
 * @param fc - The caller's fast-check module.
 * @returns An arbitrary valid stored SeqFX v7 document.
 */
export function seqFxStoredStateV7Arbitrary(fc: FastCheck): Arbitrary<SeqFxStoredStateV7> {
    return fc.record({
        focusPatternIndex: fc.integer({ min: 0, max: SEQFX_PATTERN_COUNT - 1 }),
        focusPattern: storedPatternArbitrary(fc),
        revisions: fc.array(fc.integer({ min: 1, max: 1_000_000 }), {
            minLength: SEQFX_PATTERN_COUNT,
            maxLength: SEQFX_PATTERN_COUNT,
        }),
    }).map(({ focusPatternIndex, focusPattern, revisions }) => ({
        version: SEQFX_STATE_VERSION,
        patterns: revisions.map((revision, patternIndex) => ({
            revision: patternIndex === focusPatternIndex ? focusPattern.revision : revision,
            chains: patternIndex === focusPatternIndex
                ? focusPattern.chains
                : Array.from({ length: SEQFX_LANE_COUNT }, () => ({ blocks: [] })),
        })),
    }));
}

/**
 * Generates canonical dense state by passing valid stored documents through
 * strict parsing and one canonical serialization pass.
 *
 * @param fc - The caller's fast-check module.
 * @returns An arbitrary normalized dense SeqFX state.
 */
export function seqFxStateArbitrary(fc: FastCheck): Arbitrary<SeqFxState> {
    return seqFxStoredStateV7Arbitrary(fc).map((stored) => {
        const accepted = parseStrictSeqFxStateV7(stored);
        return parseStrictSeqFxStateV7(serializeSeqFxState(accepted));
    });
}

/**
 * Generates unknown values for the permissive normalization boundary.
 *
 * @param fc - The caller's fast-check module.
 * @returns Arbitrary JSON-like and malformed dense candidates.
 */
export function seqFxNormalizationCandidateArbitrary(fc: FastCheck): Arbitrary<unknown> {
    const malformedStepArbitrary = fc.record({
        active: fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        trigger: fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        effectType: fc.oneof(fc.integer({ min: -4, max: 20 }), fc.string()),
        mix: fc.oneof(finiteDoubleArbitrary(fc, -2, 3), fc.constant(Number.NaN), fc.string()),
        params: fc.array(fc.oneof(finiteDoubleArbitrary(fc, -50_000, 50_000), fc.string()), { maxLength: 12 }),
        aux: fc.jsonValue(),
    });
    const malformedDenseArbitrary = fc.record({
        version: fc.oneof(fc.integer({ min: -2, max: 10 }), fc.string()),
        patterns: fc.array(fc.record({
            revision: fc.oneof(fc.integer({ min: -4, max: 20 }), fc.string()),
            lanes: fc.array(fc.record({
                steps: fc.array(malformedStepArbitrary, { maxLength: 10 }),
            }), { maxLength: 6 }),
        }), { maxLength: 4 }),
    });

    return fc.oneof(
        fc.jsonValue(),
        fc.string(),
        malformedDenseArbitrary,
        fc.constant(undefined),
        fc.constant(Number.NaN),
        fc.constant(Number.POSITIVE_INFINITY),
        fc.constant(Number.NEGATIVE_INFINITY),
        fc.constant(-0),
    );
}

/**
 * Generates a constrained case in which create, edit, resize, copy, move, and
 * delete can all succeed, while related collision cases remain constructible.
 *
 * @param fc - The caller's fast-check module.
 * @returns An arbitrary deterministic block-operation scenario.
 */
export function seqFxBlockOperationCaseArbitrary(fc: FastCheck): Arbitrary<SeqFxBlockOperationCase> {
    return fc.record({
        patternIndex: fc.integer({ min: 0, max: SEQFX_PATTERN_COUNT - 1 }),
        lane: fc.integer({ min: 0, max: SEQFX_LANE_COUNT - 1 }),
        startStep: fc.integer({ min: 0, max: 8 }),
        length: fc.integer({ min: 1, max: 5 }),
        resizedLength: fc.integer({ min: 1, max: 8 }),
        effectType: seqFxEffectTypeArbitrary(fc),
        mix: finiteDoubleArbitrary(fc, 0, 1),
        paramIndex: fc.integer({ min: 0, max: SEQFX_PARAM_COUNT - 1 }),
        auxSource: denseAuxSourceArbitrary(fc),
    }).chain((base) => (
        seqFxParameterVectorArbitrary(fc, base.effectType).chain((params) => (
            fc.record({
                targetStartStep: fc.integer({ min: 16, max: SEQFX_STEP_COUNT - Math.max(base.length, base.resizedLength) }),
                moveStartStep: fc.integer({ min: 16, max: SEQFX_STEP_COUNT - Math.max(base.length, base.resizedLength) }),
            }).map(({ targetStartStep, moveStartStep }) => ({
                ...base,
                targetLane: (base.lane + 1) % SEQFX_LANE_COUNT,
                targetStartStep,
                moveLane: (base.lane + 2) % SEQFX_LANE_COUNT,
                moveStartStep,
                sameLaneBlockerStart: base.startStep + base.length + 1,
                collisionResizeLength: base.length + 2,
                paramValue: params[base.paramIndex],
            }))
        ))
    ));
}

function occasionallyInvalidIndex(fc: FastCheck, maxExclusive: number): Arbitrary<number> {
    return fc.oneof(
        fc.integer({ min: 0, max: maxExclusive - 1 }),
        fc.integer({ min: 0, max: maxExclusive - 1 }),
        fc.integer({ min: 0, max: maxExclusive - 1 }),
        fc.constant(-1),
        fc.constant(maxExclusive),
    );
}

/**
 * Generates one public block-edit command, biased toward valid coordinates but
 * retaining invalid boundaries to exercise rejection atomicity in sequences.
 *
 * @param fc - The caller's fast-check module.
 * @returns An arbitrary block edit command.
 */
export function seqFxEditCommandArbitrary(fc: FastCheck): Arbitrary<SeqFxEditCommand> {
    const target = {
        patternIndex: occasionallyInvalidIndex(fc, SEQFX_PATTERN_COUNT),
        lane: occasionallyInvalidIndex(fc, SEQFX_LANE_COUNT),
        startStep: occasionallyInvalidIndex(fc, SEQFX_STEP_COUNT),
    };
    const targetLane = occasionallyInvalidIndex(fc, SEQFX_LANE_COUNT);
    const targetStartStep = occasionallyInvalidIndex(fc, SEQFX_STEP_COUNT);

    return fc.oneof(
        fc.record({
            tag: fc.constant("create"),
            ...target,
            length: fc.integer({ min: -2, max: SEQFX_STEP_COUNT + 4 }),
            effectType: fc.integer({ min: -2, max: Math.max(...SEQFX_SELECTABLE_EFFECT_IDS) + 2 }),
        }),
        fc.record({
            tag: fc.constant("resize"),
            ...target,
            length: fc.integer({ min: -2, max: SEQFX_STEP_COUNT + 4 }),
        }),
        fc.record({ tag: fc.constant("move"), ...target, targetLane, targetStartStep }),
        fc.record({ tag: fc.constant("copy"), ...target, targetLane, targetStartStep }),
        fc.record({ tag: fc.constant("delete"), ...target }),
        fc.record({ tag: fc.constant("mix"), ...target, value: finiteDoubleArbitrary(fc, -2, 3) }),
        fc.record({
            tag: fc.constant("param"),
            ...target,
            paramIndex: occasionallyInvalidIndex(fc, SEQFX_PARAM_COUNT),
            value: finiteDoubleArbitrary(fc, -50_000, 50_000),
        }),
    );
}
