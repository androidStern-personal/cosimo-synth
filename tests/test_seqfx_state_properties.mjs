import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const stateModulePromise = loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const arbitraryModulePromise = loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.arbitrary.ts");

function deepFreeze(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object" || seen.has(value)) {
        return value;
    }

    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        deepFreeze(value[key], seen);
    }
    return Object.freeze(value);
}

function assertCanonicalNumber(value, label) {
    assert.equal(typeof value, "number", `${label} must be numeric`);
    assert.equal(Number.isFinite(value), true, `${label} must be finite`);
    assert.equal(Object.is(value, -0), false, `${label} must canonicalize negative zero`);
}

function collectLaneBlocks(lane, selectableEffectTypes, label) {
    const blocks = [];
    let currentBlock = null;

    lane.steps.forEach((step, stepIndex) => {
        assert.equal(typeof step.active, "boolean", `${label} step ${stepIndex} active`);
        assert.equal(typeof step.trigger, "boolean", `${label} step ${stepIndex} trigger`);
        assertCanonicalNumber(step.mix, `${label} step ${stepIndex} mix`);
        assert.equal(Array.isArray(step.params), true, `${label} step ${stepIndex} params`);
        assert.equal(step.params.length, 8, `${label} step ${stepIndex} param count`);
        step.params.forEach((param, paramIndex) => {
            assertCanonicalNumber(param, `${label} step ${stepIndex} param ${paramIndex}`);
        });
        assert.equal(typeof step.aux, "object", `${label} step ${stepIndex} aux`);
        assert.equal(typeof step.aux.source, "object", `${label} step ${stepIndex} aux source`);
        assertCanonicalNumber(step.aux.source.shape, `${label} step ${stepIndex} aux shape`);
        assertCanonicalNumber(step.aux.source.sourceCurve, `${label} step ${stepIndex} aux source curve`);
        assertCanonicalNumber(step.aux.source.tempoMultiplier, `${label} step ${stepIndex} aux tempo multiplier`);
        assertCanonicalNumber(step.aux.source.sliceCount, `${label} step ${stepIndex} aux slice count`);
        assert.equal(Array.isArray(step.aux.targets), true, `${label} step ${stepIndex} aux targets`);
        assert.equal(step.aux.targets.length, 8, `${label} step ${stepIndex} aux target count`);
        step.aux.targets.forEach((target, paramIndex) => {
            assert.equal(typeof target.enabled, "boolean", `${label} step ${stepIndex} aux target ${paramIndex} enabled`);
            assertCanonicalNumber(target.end, `${label} step ${stepIndex} aux target ${paramIndex} end`);
        });

        if (!step.active) {
            assert.equal(step.trigger, false, `${label} inactive step ${stepIndex} cannot trigger`);
            assert.equal(step.effectType, 0, `${label} inactive step ${stepIndex} must be empty`);
            if (currentBlock) {
                blocks.push(currentBlock);
                currentBlock = null;
            }
            return;
        }

        assert.equal(selectableEffectTypes.has(step.effectType), true, `${label} active step ${stepIndex} effect`);
        if (step.trigger) {
            if (currentBlock) {
                blocks.push(currentBlock);
            }
            currentBlock = { startStep: stepIndex, length: 1, effectType: step.effectType };
            return;
        }

        assert.notEqual(currentBlock, null, `${label} active step ${stepIndex} must follow a trigger`);
        assert.equal(step.effectType, currentBlock.effectType, `${label} continuation ${stepIndex} effect`);
        currentBlock.length += 1;
    });

    if (currentBlock) {
        blocks.push(currentBlock);
    }

    return blocks;
}

function assertIndependentTopology(state, stateModule) {
    const selectableEffectTypes = new Set(stateModule.SEQFX_SELECTABLE_EFFECT_IDS);
    assert.equal(state.version, stateModule.SEQFX_STATE_VERSION);
    assert.equal(Array.isArray(state.patterns), true);
    assert.equal(state.patterns.length, stateModule.SEQFX_PATTERN_COUNT);

    const oracleBlocks = state.patterns.map((pattern, patternIndex) => {
        assert.equal(Number.isInteger(pattern.revision), true, `pattern ${patternIndex} revision integer`);
        assert.equal(pattern.revision >= 1, true, `pattern ${patternIndex} revision positive`);
        assert.equal(Array.isArray(pattern.lanes), true, `pattern ${patternIndex} lanes`);
        assert.equal(pattern.lanes.length, stateModule.SEQFX_LANE_COUNT, `pattern ${patternIndex} lane count`);
        return pattern.lanes.map((lane, laneIndex) => {
            assert.equal(Array.isArray(lane.steps), true, `pattern ${patternIndex} lane ${laneIndex} steps`);
            assert.equal(lane.steps.length, stateModule.SEQFX_STEP_COUNT, `pattern ${patternIndex} lane ${laneIndex} step count`);
            return collectLaneBlocks(lane, selectableEffectTypes, `pattern ${patternIndex} lane ${laneIndex}`);
        });
    });

    stateModule.assertSeqFxStateValuesInRange(state);
    const projected = stateModule.projectSeqFxStoredStateV7(state);
    assert.equal(projected.patterns.length, stateModule.SEQFX_PATTERN_COUNT);
    projected.patterns.forEach((pattern, patternIndex) => {
        assert.equal(pattern.chains.length, stateModule.SEQFX_LANE_COUNT);
        pattern.chains.forEach((chain, laneIndex) => {
            let previousEnd = -1;
            const topology = chain.blocks.map((block, blockIndex) => {
                const length = block.length ?? 1;
                assert.equal(Number.isInteger(block.startStep), true, `stored block ${blockIndex} start`);
                assert.equal(Number.isInteger(length), true, `stored block ${blockIndex} length`);
                assert.equal(block.startStep > previousEnd, true, `stored block ${blockIndex} sorted and non-overlapping`);
                assert.equal(block.startStep + length <= stateModule.SEQFX_STEP_COUNT, true, `stored block ${blockIndex} bounds`);
                previousEnd = block.startStep + length - 1;
                return { startStep: block.startStep, length, effectType: block.effectType };
            });
            assert.deepEqual(topology, oracleBlocks[patternIndex][laneIndex]);
        });
    });
}

function defaultParamsForEffect(stateModule, effectType) {
    const definition = stateModule.getSeqFxEffectDefinition(effectType);
    return Array.from({ length: stateModule.SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
        definition.parameters[paramIndex]?.defaultValue ?? 0
    ));
}

function defaultAuxForMemory(stateModule, effectType, params) {
    const filterEffect = effectType === stateModule.SEQFX_EFFECT_TYPES.filter;
    return {
        source: {
            shape: filterEffect ? 1 : 0,
            sourceCurve: 0,
            rateMode: "slice",
            tempoMultiplier: 4,
            tempoTriplet: false,
            sliceCount: 1,
        },
        targets: Array.from({ length: stateModule.SEQFX_PARAM_COUNT }, (_unused, paramIndex) => ({
            enabled: filterEffect && paramIndex === 1,
            end: filterEffect && paramIndex === 1
                ? params[2]
                : params[paramIndex],
        })),
    };
}

function assertStepMemoriesSemanticallyEqual(left, right, stateModule, label) {
    const effectTypes = new Set([
        ...Object.keys(left.effectParams ?? {}),
        ...Object.keys(left.effectAux ?? {}),
        ...Object.keys(right.effectParams ?? {}),
        ...Object.keys(right.effectAux ?? {}),
    ]);

    for (const rawEffectType of effectTypes) {
        const effectType = Number(rawEffectType);
        const defaults = defaultParamsForEffect(stateModule, effectType);
        const leftParams = left.effectParams?.[effectType] ?? defaults;
        const rightParams = right.effectParams?.[effectType] ?? defaults;
        assert.deepEqual(leftParams, rightParams, `${label} remembered params ${effectType}`);

        const leftAux = left.effectAux?.[effectType] ?? defaultAuxForMemory(stateModule, effectType, leftParams);
        const rightAux = right.effectAux?.[effectType] ?? defaultAuxForMemory(stateModule, effectType, rightParams);
        assert.deepEqual(leftAux, rightAux, `${label} remembered aux ${effectType}`);
    }
}

function assertSemanticallyEquivalent(left, right, stateModule) {
    assert.equal(left.version, right.version);
    assert.equal(left.patterns.length, right.patterns.length);
    left.patterns.forEach((leftPattern, patternIndex) => {
        const rightPattern = right.patterns[patternIndex];
        assert.equal(leftPattern.revision, rightPattern.revision, `pattern ${patternIndex} revision`);
        assert.equal(leftPattern.lanes.length, rightPattern.lanes.length, `pattern ${patternIndex} lane count`);
        leftPattern.lanes.forEach((leftLane, laneIndex) => {
            const rightLane = rightPattern.lanes[laneIndex];
            assert.equal(leftLane.steps.length, rightLane.steps.length, `pattern ${patternIndex} lane ${laneIndex} steps`);
            leftLane.steps.forEach((leftStep, stepIndex) => {
                const rightStep = rightLane.steps[stepIndex];
                const label = `pattern ${patternIndex} lane ${laneIndex} step ${stepIndex}`;
                assert.deepEqual({
                    active: leftStep.active,
                    trigger: leftStep.trigger,
                    effectType: leftStep.effectType,
                    mix: leftStep.mix,
                    params: leftStep.params,
                    aux: leftStep.aux,
                }, {
                    active: rightStep.active,
                    trigger: rightStep.trigger,
                    effectType: rightStep.effectType,
                    mix: rightStep.mix,
                    params: rightStep.params,
                    aux: rightStep.aux,
                }, `${label} runtime values`);
                assertStepMemoriesSemanticallyEqual(leftStep, rightStep, stateModule, label);
            });
        });
    });
}

test("SeqFX normalization is structurally idempotent for arbitrary candidates", async () => {
    const [stateModule, arbitraryModule] = await Promise.all([stateModulePromise, arbitraryModulePromise]);

    fc.assert(
        fc.property(arbitraryModule.seqFxNormalizationCandidateArbitrary(fc), (candidate) => {
            deepFreeze(candidate);
            const normalized = stateModule.normalizeSeqFxState(candidate);
            assertIndependentTopology(normalized, stateModule);
            deepFreeze(normalized);
            assert.deepEqual(stateModule.normalizeSeqFxState(normalized), normalized);
        }),
        { seed: 0x53e9f701, numRuns: 1_000 },
    );
});

test("SeqFX strict v7 canonicalizes inherited ineligible Aux endpoints after a step parameter override", async () => {
    const stateModule = await stateModulePromise;
    const storedState = stateModule.projectSeqFxStoredStateV7(stateModule.createDefaultSeqFxState());
    const filterType = stateModule.SEQFX_EFFECT_TYPES.filter;
    const overrideParams = [0, 20, 20, 0.1, 0.25, 0, 0, 0];
    storedState.patterns[0].chains[3].blocks = [{
        startStep: 0,
        length: 2,
        effectType: filterType,
        stepOverrides: [{ offset: 1, params: overrideParams }],
    }];

    const accepted = stateModule.parseStrictSeqFxStateV7(storedState);
    const overrideStep = accepted.patterns[0].lanes[3].steps[1];
    assert.deepEqual(overrideStep.params, overrideParams);
    assert.deepEqual(overrideStep.aux.targets[2], { enabled: false, end: overrideParams[2] });
    assert.deepEqual(overrideStep.aux.targets[4], { enabled: false, end: overrideParams[4] });

    const serialized = stateModule.serializeSeqFxState(accepted);
    const canonical = stateModule.parseStrictSeqFxStateV7(serialized);
    assert.deepEqual(canonical, accepted);
    assert.equal(stateModule.serializeSeqFxState(canonical), serialized);
});

test("SeqFX accepted v7 states preserve semantics and reach an exact canonical fixed point", async () => {
    const [stateModule, arbitraryModule] = await Promise.all([stateModulePromise, arbitraryModulePromise]);

    fc.assert(
        fc.property(arbitraryModule.seqFxStoredStateV7Arbitrary(fc), (storedState) => {
            deepFreeze(storedState);
            const accepted = stateModule.parseStrictSeqFxStateV7(storedState);
            assertIndependentTopology(accepted, stateModule);
            deepFreeze(accepted);

            const canonicalSerialized = stateModule.serializeSeqFxState(accepted);
            const canonicalState = stateModule.parseStrictSeqFxStateV7(canonicalSerialized);
            assertIndependentTopology(canonicalState, stateModule);
            assertSemanticallyEquivalent(canonicalState, accepted, stateModule);
            deepFreeze(canonicalState);

            const fixedPointSerialized = stateModule.serializeSeqFxState(canonicalState);
            const fixedPointState = stateModule.parseStrictSeqFxStateV7(fixedPointSerialized);
            assert.equal(fixedPointSerialized, canonicalSerialized);
            assert.deepEqual(fixedPointState, canonicalState);
        }),
        { seed: 0x53e9f702, numRuns: 400 },
    );
});

test("SeqFX canonicalizes an explicit default remembered aux state to absence without semantic loss", async () => {
    const stateModule = await stateModulePromise;
    const storedState = stateModule.projectSeqFxStoredStateV7(stateModule.createDefaultSeqFxState());
    const dirtyEffect = stateModule.SEQFX_EFFECT_TYPES.dirty;
    storedState.patterns[0].chains[0].blocks = [{
        startStep: 0,
        effectType: stateModule.SEQFX_EFFECT_TYPES.ring,
        memories: {
            params: { [dirtyEffect]: defaultParamsForEffect(stateModule, dirtyEffect) },
            aux: { [dirtyEffect]: {} },
        },
    }];
    deepFreeze(storedState);

    const accepted = stateModule.parseStrictSeqFxStateV7(storedState);
    const acceptedStep = accepted.patterns[0].lanes[0].steps[0];
    assert.equal(Object.hasOwn(acceptedStep.effectAux, dirtyEffect), true);

    const canonicalSerialized = stateModule.serializeSeqFxState(accepted);
    const canonicalState = stateModule.parseStrictSeqFxStateV7(canonicalSerialized);
    const canonicalStep = canonicalState.patterns[0].lanes[0].steps[0];
    assert.equal(Object.hasOwn(canonicalStep.effectAux ?? {}, dirtyEffect), false);
    assertSemanticallyEquivalent(canonicalState, accepted, stateModule);
    assert.equal(stateModule.serializeSeqFxState(canonicalState), canonicalSerialized);
    assert.deepEqual(stateModule.parseStrictSeqFxStateV7(canonicalSerialized), canonicalState);
});
