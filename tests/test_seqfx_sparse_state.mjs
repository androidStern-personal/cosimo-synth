import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";
import {
    createLegacyV5StateWithBlock,
    projectCompatibleDenseStateToLegacyV5Fixture,
} from "./helpers/seqfx_legacy_v5_fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANE_COUNT,
    SEQFX_LANES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STATE_KEY,
    SEQFX_STEP_COUNT,
    SeqFxStateParseError,
    applySeqFxBlockAuxSourceEdit,
    applySeqFxBlockAuxTargetEndEdit,
    applySeqFxBlockAuxTargetToggle,
    applySeqFxBlockCreate,
    applySeqFxBlockEffectEdit,
    applySeqFxBlockParamEdit,
    applySeqFxBlockResize,
    applySeqFxParamEdit,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    parseSeqFxStoredState,
    parseStrictSeqFxStateV7,
    projectSeqFxStoredStateV7,
    serializeSeqFxState,
} = stateModule;

function assertActiveUploadEqual(actual, expected) {
    assert.deepEqual(actual.activeSteps, expected.activeSteps);
    assert.deepEqual(actual.triggerSteps, expected.triggerSteps);
    assert.deepEqual(actual.effectTypes, expected.effectTypes);

    actual.activeSteps.forEach((lane, laneIndex) => {
        lane.forEach((active, stepIndex) => {
            if (!active) {
                return;
            }
            assert.equal(actual.mix[laneIndex][stepIndex], expected.mix[laneIndex][stepIndex]);
            assert.deepEqual(actual.params[laneIndex][stepIndex], expected.params[laneIndex][stepIndex]);
            assert.deepEqual(actual.auxEnabled[laneIndex][stepIndex], expected.auxEnabled[laneIndex][stepIndex]);
            assert.deepEqual(actual.auxEnd[laneIndex][stepIndex], expected.auxEnd[laneIndex][stepIndex]);
            assert.equal(actual.auxShape[laneIndex][stepIndex], expected.auxShape[laneIndex][stepIndex]);
            assert.equal(actual.auxSourceCurve[laneIndex][stepIndex], expected.auxSourceCurve[laneIndex][stepIndex]);
            assert.equal(actual.auxRateMode[laneIndex][stepIndex], expected.auxRateMode[laneIndex][stepIndex]);
            assert.equal(actual.auxTempoMultiplier[laneIndex][stepIndex], expected.auxTempoMultiplier[laneIndex][stepIndex]);
            assert.equal(actual.auxTempoTriplet[laneIndex][stepIndex], expected.auxTempoTriplet[laneIndex][stepIndex]);
            assert.equal(actual.auxSliceCount[laneIndex][stepIndex], expected.auxSliceCount[laneIndex][stepIndex]);
        });
    });
}

test("legacy fixture builder keeps Crush holdFrames in predecessor range", () => {
    assert.throws(() => createLegacyV5StateWithBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 0,
        length: 1,
        params: [8, 48_000, 0, 0, 0, 0, 0, 0],
    }), /holdFrames from 1 to 64/);

    const legacy = createLegacyV5StateWithBlock({
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 0,
        length: 1,
        params: [8, 1, 0, 0, 0, 0, 0, 0],
    });
    assert.deepEqual(
        legacy.patterns[0].lanes[SEQFX_LANES.crusher].steps[0].params.slice(0, 2),
        [8, 1],
    );
});

test("sparse v7 Init is compact and names its key and version consistently", () => {
    const serialized = serializeSeqFxState(createDefaultSeqFxState());
    const stored = JSON.parse(serialized);

    assert.equal(SEQFX_STATE_KEY, "seqfx.v7");
    assert.equal(stored.version, 7);
    assert.equal(stored.patterns.length, SEQFX_PATTERN_COUNT);
    assert.equal(stored.patterns[0].chains.length, SEQFX_LANE_COUNT);
    assert.ok(stored.patterns.every((pattern) => pattern.chains.every((chain) => chain.blocks.length === 0)));
    assert.ok(Buffer.byteLength(serialized) < 16 * 1024, `Init state was ${Buffer.byteLength(serialized)} bytes`);
});

test("sparse v7 omits the default one-step block length without changing recall", () => {
    const state = applySeqFxBlockCreate(createDefaultSeqFxState(), {
        patternIndex: 0,
        lane: 0,
        startStep: 7,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.flange,
    });
    const stored = projectSeqFxStoredStateV7(state);
    const block = stored.patterns[0].chains[0].blocks[0];

    assert.equal(block.startStep, 7);
    assert.equal(block.length, undefined);
    assert.equal(block.effectType, SEQFX_EFFECT_TYPES.flange);
    assert.deepEqual(
        buildSeqPatternUpload(parseStrictSeqFxStateV7(stored), { patternIndex: 0, authoritative: true }),
        buildSeqPatternUpload(state, { patternIndex: 0, authoritative: true }),
    );
});

test("sparse v7 round trip preserves blocks, aux, effect memories, and rare per-step overrides", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        length: 4,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        paramIndex: 0,
        value: 10,
    });
    state = applySeqFxBlockAuxSourceEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        source: { shape: -0.35, rateMode: "tempo", tempoMultiplier: 3, tempoTriplet: true },
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        paramIndex: 0,
        value: 14,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        paramIndex: 1,
        value: 777,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 2,
        lane: 1,
        startStep: 4,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 2,
        lane: 1,
        steps: [6],
        paramIndex: 2,
        value: 9,
    });

    const serialized = serializeSeqFxState(state);
    const stored = JSON.parse(serialized);
    const block = stored.patterns[2].chains[1].blocks[0];
    const restored = parseStrictSeqFxStateV7(serialized);

    assert.deepEqual(
        { startStep: block.startStep, length: block.length, effectType: block.effectType },
        { startStep: 4, length: 4, effectType: SEQFX_EFFECT_TYPES.crusher },
    );
    assert.equal(block.params[0], 10);
    assert.equal(block.aux.source.shape, -0.35);
    assert.equal(block.memories.params[String(SEQFX_EFFECT_TYPES.filter)][1], 777);
    assert.deepEqual(block.stepOverrides.map((override) => override.offset), [2]);
    assert.equal(restored.patterns[2].lanes[1].steps[6].params[2], 9);
    assert.deepEqual(buildSeqPatternUpload(restored, { patternIndex: 2, authoritative: true }),
        buildSeqPatternUpload(state, { patternIndex: 2, authoritative: true }));
    assert.equal(serializeSeqFxState(restored), serialized);
});

test("legacy v5 migration is idempotent and keeps the dense runtime upload audible-equivalent", () => {
    let current = createDefaultSeqFxState();
    current = applySeqFxBlockCreate(current, {
        patternIndex: 5,
        lane: 3,
        startStep: 11,
        length: 5,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });
    current = applySeqFxParamEdit(current, {
        patternIndex: 5,
        lane: 3,
        steps: [12, 13],
        paramIndex: 1,
        value: 1.25,
    });
    const legacy = projectCompatibleDenseStateToLegacyV5Fixture(current);
    const migrated = parseSeqFxStoredState(JSON.stringify(legacy));
    const v7 = serializeSeqFxState(migrated.state);
    const reparsed = parseSeqFxStoredState(v7);

    assert.equal(migrated.sourceVersion, 5);
    assert.equal(migrated.migrated, true);
    assert.equal(reparsed.sourceVersion, 7);
    assert.equal(reparsed.migrated, false);
    assert.equal(serializeSeqFxState(reparsed.state), v7);
    assertActiveUploadEqual(
        buildSeqPatternUpload(migrated.state, { patternIndex: 5, authoritative: true }),
        buildSeqPatternUpload(current, { patternIndex: 5, authoritative: true }),
    );
});

test("legacy Tape Stop blocks migrate through the documented canonical free-time mapping", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 2,
        startStep: 4,
        length: 3,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    for (const step of state.patterns[0].lanes[2].steps.slice(4, 7)) {
        step.params = [2, 4, 0.5, 50, 1, 0, 0, 0];
        step.aux.targets = step.params.map((end, index) => ({ enabled: index === 0, end }));
    }

    const migrated = parseSeqFxStoredState(JSON.stringify(
        projectCompatibleDenseStateToLegacyV5Fixture(state),
    )).state;
    for (const step of migrated.patterns[0].lanes[2].steps.slice(4, 7)) {
        assert.deepEqual(step.params, [8, 1, 1, 1, 0, 1, 750, 187.5]);
        assert.ok(step.aux.targets.every((target) => target.enabled === false));
        assert.deepEqual(step.aux.targets.map((target) => target.end), step.params);
    }
});

test("legacy non-Tape blocks discard obsolete remembered Tape aux during migration", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    const legacyTapeParams = [2, 4, 0.5, 50, 1, 0, 0, 0];
    for (const step of state.patterns[0].lanes[1].steps.slice(3, 5)) {
        step.effectParams = {
            ...(step.effectParams ?? {}),
            [SEQFX_EFFECT_TYPES.tapeStop]: [...legacyTapeParams],
        };
        step.effectAux = {
            ...(step.effectAux ?? {}),
            [SEQFX_EFFECT_TYPES.tapeStop]: {
                source: structuredClone(step.aux.source),
                targets: legacyTapeParams.map((end, index) => ({ enabled: index < 3, end })),
            },
        };
    }

    let migrated = parseSeqFxStoredState(JSON.stringify(
        projectCompatibleDenseStateToLegacyV5Fixture(state),
    )).state;
    for (const step of migrated.patterns[0].lanes[1].steps.slice(3, 5)) {
        const rememberedParams = step.effectParams?.[SEQFX_EFFECT_TYPES.tapeStop];
        const rememberedAux = step.effectAux?.[SEQFX_EFFECT_TYPES.tapeStop];
        assert.ok(rememberedParams);
        assert.ok(rememberedAux);
        assert.equal(rememberedAux.targets.some((target) => target.enabled), false);
        assert.deepEqual(rememberedAux.targets.map((target) => target.end), rememberedParams);
    }

    migrated = applySeqFxBlockEffectEdit(migrated, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    const upload = buildSeqPatternUpload(migrated, { patternIndex: 0, authoritative: true });
    assert.equal(upload.auxEnabled[1].slice(3, 5).flat().some(Boolean), false);
});

test("growing and shrinking a block preserves retained sparse per-step overrides", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 4,
        length: 3,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: 0,
        steps: [5],
        paramIndex: 1,
        value: 777,
    });

    state = applySeqFxBlockResize(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 4,
        length: 4,
    });
    assert.deepEqual(
        state.patterns[0].lanes[0].steps.slice(4, 8).map((step) => step.params[1]),
        [2000, 777, 2000, 2000],
        "growing should retain existing cells and template only the appended cell",
    );

    state = applySeqFxBlockResize(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 4,
        length: 2,
    });
    assert.deepEqual(
        state.patterns[0].lanes[0].steps.slice(4, 6).map((step) => step.params[1]),
        [2000, 777],
        "shrinking should retain the surviving override",
    );
    assert.equal(state.patterns[0].lanes[0].steps[6].active, false);
    assert.equal(state.patterns[0].lanes[0].steps[4].trigger, true);
    assert.equal(state.patterns[0].lanes[0].steps[5].trigger, false);
    assert.equal(parseStrictSeqFxStateV7(serializeSeqFxState(state)).patterns[0].lanes[0].steps[5].params[1], 777);
});

test("legacy Crush blocks preserve 48 kHz hold behavior and aux endpoints in Original mode", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 6,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    for (const step of state.patterns[0].lanes[1].steps.slice(6, 8)) {
        step.params = [6, 4, 12, 0, 0, 0, 0, 0];
        step.aux.targets = step.params.map((end, index) => ({
            enabled: index < 3,
            end: index === 0 ? 8 : index === 1 ? 16 : index === 2 ? 24 : end,
        }));
    }

    const migrated = parseSeqFxStoredState(JSON.stringify(
        projectCompatibleDenseStateToLegacyV5Fixture(state),
    )).state;
    for (const step of migrated.patterns[0].lanes[1].steps.slice(6, 8)) {
        assert.deepEqual(step.params, [6, 12_000, 12, 0, 0, 0, 0, 0]);
        assert.deepEqual(step.aux.targets.map((target) => target.enabled), [true, true, true, false, false, false, false, false]);
        assert.deepEqual(step.aux.targets.map((target) => target.end), [8, 3_000, 24, 0, 0, 0, 0, 0]);
    }

    const malformed = projectCompatibleDenseStateToLegacyV5Fixture(state);
    malformed.patterns[0].lanes[1].steps[6].aux.targets[1].end = 0;
    assert.throws(() => parseSeqFxStoredState(JSON.stringify(malformed)), (error) => {
        assert.ok(error instanceof SeqFxStateParseError);
        assert.equal(error.code, "invalid_number");
        assert.equal(error.path, "$.patterns[0].lanes[1].steps[6].aux.targets[1].end");
        assert.match(error.message, /1 to 64/);
        return true;
    });
});

test("strict v5 parsing rejects out-of-range legacy parameters instead of clamping them", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 0,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    const malformed = projectCompatibleDenseStateToLegacyV5Fixture(state);
    malformed.patterns[0].lanes[0].steps[0].params[1] = 999_999;

    assert.throws(() => parseSeqFxStoredState(malformed), (error) => {
        assert.ok(error instanceof SeqFxStateParseError);
        assert.equal(error.code, "invalid_number");
        assert.equal(error.path, "$.patterns[0].lanes[0].steps[0].params[1]");
        assert.match(error.message, /20 to 20000/);
        return true;
    });
});

test("a deliberately dense twelve-pattern v7 document stays below the host-state budget", () => {
    const state = createDefaultSeqFxState();
    const effectTypes = [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.stutter,
        SEQFX_EFFECT_TYPES.pitch,
        SEQFX_EFFECT_TYPES.comb,
        SEQFX_EFFECT_TYPES.ring,
        SEQFX_EFFECT_TYPES.reverse,
        SEQFX_EFFECT_TYPES.talkBox,
        SEQFX_EFFECT_TYPES.vibro,
        SEQFX_EFFECT_TYPES.flange,
        SEQFX_EFFECT_TYPES.dirty,
    ];

    state.patterns.forEach((pattern, patternIndex) => {
        pattern.lanes.forEach((lane, laneIndex) => {
            lane.steps.forEach((step, stepIndex) => {
                const effectType = effectTypes[(patternIndex + laneIndex + stepIndex) % effectTypes.length];
                step.active = true;
                step.trigger = true;
                step.effectType = effectType;
                step.mix = ((stepIndex % 9) + 1) / 10;
                const defaults = stateModule.getSeqFxEffectDefinition(effectType).parameters;
                step.params = Array.from({ length: 8 }, (_unused, paramIndex) => defaults[paramIndex]?.defaultValue ?? 0);
                step.aux = structuredClone(state.patterns[0].lanes[laneIndex].steps[0].aux);
            });
        });
    });

    const serialized = JSON.stringify(projectSeqFxStoredStateV7(state));
    assert.ok(Buffer.byteLength(serialized) < 256 * 1024, `Dense state was ${Buffer.byteLength(serialized)} bytes`);
    assert.doesNotThrow(() => parseStrictSeqFxStateV7(serialized));
});

test("strict v7 parsing rejects overlap, bounds, unknown fields, and malformed aux with typed paths", () => {
    const cases = [
        {
            mutate(stored) {
                stored.patterns[0].chains[0].blocks = [
                    { startStep: 2, length: 4, effectType: 1 },
                    { startStep: 5, length: 1, effectType: 2 },
                ];
            },
            code: "overlapping_blocks",
            path: "$.patterns[0].chains[0].blocks[1]",
        },
        {
            mutate(stored) {
                stored.patterns[0].chains[0].blocks = [{ startStep: 31, length: 2, effectType: 1 }];
            },
            code: "block_out_of_bounds",
            path: "$.patterns[0].chains[0].blocks[0]",
        },
        {
            mutate(stored) {
                stored.patterns[0].chains[0].blocks = [{ startStep: 0, length: 1, effectType: 1, typo: true }];
            },
            code: "unknown_field",
            path: "$.patterns[0].chains[0].blocks[0].typo",
        },
        {
            mutate(stored) {
                stored.patterns[0].chains[0].blocks = [{
                    startStep: 0,
                    length: 1,
                    effectType: 2,
                    aux: { targets: [{ index: 0, end: 9.5 }] },
                }];
            },
            code: "invalid_integer_param",
            path: "$.patterns[0].chains[0].blocks[0].aux.targets[0].end",
        },
        {
            mutate(stored) {
                stored.patterns[0].chains[0].blocks = [{
                    startStep: 0,
                    effectType: SEQFX_EFFECT_TYPES.filter,
                    aux: { targets: [{ index: 0, enabled: true, end: 2 }] },
                }];
            },
            code: "ineligible_aux_target",
            path: "$.patterns[0].chains[0].blocks[0].aux.targets[0].index",
        },
    ];

    for (const fixture of cases) {
        const stored = JSON.parse(serializeSeqFxState(createDefaultSeqFxState()));
        fixture.mutate(stored);
        assert.throws(() => parseStrictSeqFxStateV7(stored), (error) => {
            assert.ok(error instanceof SeqFxStateParseError);
            assert.equal(error.code, fixture.code);
            assert.equal(error.path, fixture.path);
            return true;
        });
    }
});

test("malformed legacy state never produces or rewrites a v7 document", () => {
    const malformed = projectCompatibleDenseStateToLegacyV5Fixture(createDefaultSeqFxState());
    malformed.patterns[0].lanes[0].steps.pop();

    assert.throws(() => parseSeqFxStoredState(malformed), (error) => {
        assert.ok(error instanceof SeqFxStateParseError);
        assert.equal(error.code, "invalid_step_count");
        assert.equal(error.path, "$.patterns[0].lanes[0].steps");
        assert.match(error.message, /32 steps/i);
        return true;
    });
});
