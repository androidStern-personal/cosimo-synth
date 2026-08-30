import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");

const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANE_COUNT,
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
    applySeqFxParamEdit,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    parseSeqFxStoredState,
    parseStrictSeqFxStateV7,
    projectSeqFxStoredStateV7,
    serializeSeqFxState,
} = stateModule;

function legacyV5(state) {
    return {
        ...structuredClone(state),
        version: 5,
    };
}

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
    const legacy = legacyV5(current);
    const migrated = parseSeqFxStoredState(JSON.stringify(legacy));
    const v7 = serializeSeqFxState(migrated.state);
    const reparsed = parseSeqFxStoredState(v7);

    assert.equal(migrated.sourceVersion, 5);
    assert.equal(migrated.migrated, true);
    assert.equal(reparsed.sourceVersion, 7);
    assert.equal(reparsed.migrated, false);
    assert.equal(serializeSeqFxState(reparsed.state), v7);
    assert.deepEqual(
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

    const migrated = parseSeqFxStoredState(JSON.stringify(legacyV5(state))).state;
    for (const step of migrated.patterns[0].lanes[2].steps.slice(4, 7)) {
        assert.deepEqual(step.params, [8, 1, 1, 1, 0, 1, 750, 187.5]);
        assert.ok(step.aux.targets.every((target) => target.enabled === false));
        assert.deepEqual(step.aux.targets.map((target) => target.end), step.params);
    }
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

    const migrated = parseSeqFxStoredState(JSON.stringify(legacyV5(state))).state;
    for (const step of migrated.patterns[0].lanes[1].steps.slice(6, 8)) {
        assert.deepEqual(step.params, [6, 12_000, 12, 0, 0, 0, 0, 0]);
        assert.deepEqual(step.aux.targets.map((target) => target.enabled), [true, true, true, false, false, false, false, false]);
        assert.deepEqual(step.aux.targets.map((target) => target.end), [8, 3_000, 24, 0, 0, 0, 0, 0]);
    }

    const malformed = legacyV5(state);
    malformed.patterns[0].lanes[1].steps[6].aux.targets[1].end = 0;
    assert.throws(
        () => parseSeqFxStoredState(JSON.stringify(malformed)),
        /Legacy Crush aux hold frames must be between 1 and 64/,
    );
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
    const malformed = legacyV5(createDefaultSeqFxState());
    malformed.patterns[0].lanes[0].steps.pop();

    assert.throws(() => parseSeqFxStoredState(malformed), (error) => {
        assert.ok(error instanceof SeqFxStateParseError);
        assert.equal(error.code, "invalid_legacy_state");
        assert.match(error.message, /32 steps/i);
        return true;
    });
});
