import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");

const {
    SEQFX_LANE_COUNT,
    SEQFX_PARAM_COUNT,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    applySeqFxBlockCreate,
    applySeqFxBlockCopy,
    applySeqFxBlockCopyPaint,
    applySeqFxBlockDelete,
    applySeqFxBlockMove,
    applySeqFxBlockAuxCurveEdit,
    applySeqFxBlockAuxTargetEndEdit,
    applySeqFxBlockAuxTargetToggle,
    applySeqFxBlockEffectEdit,
    applySeqFxBlockParamEdit,
    applySeqFxBlockResize,
    applySeqFxBlockSelectionDelete,
    applySeqFxBlockSelectionCopy,
    applySeqFxBlockSelectionAuxTargetEndEdit,
    applySeqFxBlockSelectionMove,
    applySeqFxBlockSelectionParamEdit,
    applySeqFxCellToggle,
    applySeqFxMixEdit,
    applySeqFxParamEdit,
    applySeqFxStepValuePaste,
    assertSeqFxStateValuesInRange,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    getSeqFxStepValueSnapshot,
    parseStrictSeqFxStateV3,
    serializeSeqFxState,
    normalizeSeqFxState,
} = stateModule;

function assertDefaultAuxMatchesParams(step) {
    assert.equal(step.aux.curve, "linear");
    assert.equal(step.aux.targets.length, SEQFX_PARAM_COUNT);
    step.aux.targets.forEach((target, paramIndex) => {
        assert.equal(target.enabled, false);
        assert.equal(target.end, step.params[paramIndex]);
    });
}

test("default_seqfx_v4_storage_key_contains_four_serial_chains_with_empty_effect_steps_and_aux_defaults", () => {
    const state = createDefaultSeqFxState();

    assert.equal(stateModule.SEQFX_STATE_KEY, "seqfx.v4");
    assert.equal(state.version, 3);
    assert.equal(state.patterns.length, SEQFX_PATTERN_COUNT);

    for (const pattern of state.patterns) {
        assert.equal(pattern.lanes.length, SEQFX_LANE_COUNT);

        for (const chain of pattern.lanes) {
            assert.equal(chain.steps.length, SEQFX_STEP_COUNT);

            for (const step of chain.steps) {
                assert.equal(step.active, false);
                assert.equal(step.trigger, false);
                assert.equal(step.effectType, SEQFX_EFFECT_TYPES.empty);
                assert.equal(step.mix, 1);
                assert.equal(step.params.length, SEQFX_PARAM_COUNT);
                assertDefaultAuxMatchesParams(step);
            }
        }
    }

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: true,
    });

    assert.equal(upload.effectTypes.length, SEQFX_LANE_COUNT);
    assert.equal(upload.effectTypes[0].length, SEQFX_STEP_COUNT);
    assert.equal(upload.effectTypes[0][0], SEQFX_EFFECT_TYPES.empty);
    assert.equal(upload.auxEnabled.length, SEQFX_LANE_COUNT);
    assert.equal(upload.auxEnabled[0][0].length, SEQFX_PARAM_COUNT);
    assert.equal(upload.auxEnabled.flat(2).some(Boolean), false);
    assert.equal(upload.auxEnd[SEQFX_LANES.crusher][0][0], 8);
    assert.equal(upload.auxCurve[SEQFX_LANES.crusher][0], 0);
});

test("seqfx_block_aux_edits_write_the_whole_block_and_upload_aux_arrays", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        length: 3,
    });
    state = applySeqFxBlockAuxCurveEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        curve: "bell",
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        paramIndex: 0,
        value: 13,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(
        upload.auxEnabled[SEQFX_LANES.crusher].slice(4, 7).map((targets) => targets[0]),
        [true, true, true],
    );
    assert.deepEqual(
        upload.auxEnd[SEQFX_LANES.crusher].slice(4, 7).map((targets) => targets[0]),
        [13, 13, 13],
    );
    assert.deepEqual(upload.auxCurve[SEQFX_LANES.crusher].slice(4, 7), [4, 4, 4]);
});

test("seqfx_aux_end_values_clamp_and_round_like_effect_parameters", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        length: 1,
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 0,
        value: 99.4,
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 1,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 1,
        value: 7.4,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.equal(upload.auxEnd[SEQFX_LANES.crusher][2][0], 16);
    assert.equal(upload.auxEnd[SEQFX_LANES.crusher][2][1], 7);
});

test("seqfx_strict_v3_parser_rejects_old_shaped_payloads_under_the_new_key", () => {
    const oldShaped = createDefaultSeqFxState();
    oldShaped.version = 3;
    delete oldShaped.patterns[0].lanes[SEQFX_LANES.crusher].steps[0].aux;

    assert.throws(
        () => parseStrictSeqFxStateV3(JSON.stringify(oldShaped)),
        /aux/i,
    );
});

test("chain_steps_clamp_parameters_by_selected_effect_type_not_chain_index", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        paramIndex: 0,
        value: 0.01,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 2,
        startStep: 8,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 2,
        startStep: 8,
        paramIndex: 1,
        value: 4,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.effectTypes[1].slice(4, 6), [
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.tapeStop,
    ]);
    assert.deepEqual(
        upload.params[1].slice(4, 6).map((params) => params[0]),
        [0.05, 0.05],
    );
    assert.equal(upload.effectTypes[2][8], SEQFX_EFFECT_TYPES.filter);
    assert.equal(upload.params[2][8][1], 20);
});

test("changing_a_block_effect_updates_the_whole_block_and_remembers_each_effects_params", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        length: 3,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        paramIndex: 1,
        value: 320,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[1].slice(3, 6), [true, true, true]);
    assert.deepEqual(upload.triggerSteps[1].slice(3, 6), [true, false, false]);
    assert.deepEqual(upload.effectTypes[1].slice(3, 6), [
        SEQFX_EFFECT_TYPES.stutter,
        SEQFX_EFFECT_TYPES.stutter,
        SEQFX_EFFECT_TYPES.stutter,
    ]);
    assert.deepEqual(
        upload.params[1].slice(3, 6).map((params) => params.slice(0, 2)),
        [[8, 1], [8, 1], [8, 1]],
    );

    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });

    const restoredUpload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(restoredUpload.activeSteps[1].slice(3, 6), [true, true, true]);
    assert.deepEqual(restoredUpload.triggerSteps[1].slice(3, 6), [true, false, false]);
    assert.deepEqual(restoredUpload.effectTypes[1].slice(3, 6), [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
    ]);
    assert.deepEqual(
        restoredUpload.params[1].slice(3, 6).map((params) => params[1]),
        [320, 320, 320],
    );
});

test("changing_a_block_effect_remembers_each_effects_aux_settings", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    state = applySeqFxBlockAuxCurveEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        curve: "exp",
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 0,
        value: 13,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });
    state = applySeqFxBlockAuxCurveEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        curve: "bell",
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 2,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        paramIndex: 2,
        value: 0.2,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });

    let restoredStep = state.patterns[0].lanes[SEQFX_LANES.crusher].steps[3];
    assert.equal(restoredStep.aux.curve, "exp");
    assert.deepEqual(restoredStep.aux.targets[0], { enabled: true, end: 13 });

    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 3,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });

    restoredStep = state.patterns[0].lanes[SEQFX_LANES.crusher].steps[3];
    assert.equal(restoredStep.aux.curve, "bell");
    assert.deepEqual(restoredStep.aux.targets[2], { enabled: true, end: 0.2 });
});

test("adjacent_different_effect_steps_are_separate_blocks_even_without_a_second_trigger", () => {
    const rawState = createDefaultSeqFxState();
    rawState.patterns[0].lanes[0].steps[0] = {
        active: true,
        trigger: true,
        effectType: SEQFX_EFFECT_TYPES.filter,
        mix: 1,
        params: [0, 2000, 500, 0.707, 1, 0, 0, 0],
    };
    rawState.patterns[0].lanes[0].steps[1] = {
        active: true,
        trigger: false,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
        mix: 1,
        params: [1, 1, 1, 25, 0, 0, 0, 0],
    };

    const normalized = normalizeSeqFxState(rawState);
    const firstBlock = stateModule.getSeqFxBlockAtStep(normalized.patterns[0], 0, 0);
    const secondBlock = stateModule.getSeqFxBlockAtStep(normalized.patterns[0], 0, 1);

    assert.deepEqual(
        [firstBlock.startStep, firstBlock.length, firstBlock.effectType],
        [0, 1, SEQFX_EFFECT_TYPES.filter],
    );
    assert.deepEqual(
        [secondBlock.startStep, secondBlock.length, secondBlock.effectType],
        [1, 1, SEQFX_EFFECT_TYPES.tapeStop],
    );
    assert.equal(normalized.patterns[0].lanes[0].steps[1].trigger, true);
});

test("default_seqfx_state_contains_twelve_complete_four_lane_patterns", () => {
    const state = createDefaultSeqFxState();

    assert.equal(state.version, 3);
    assert.equal(state.patterns.length, SEQFX_PATTERN_COUNT);

    for (const pattern of state.patterns) {
        assert.equal(pattern.lanes.length, SEQFX_LANE_COUNT);

        for (const lane of pattern.lanes) {
            assert.equal(lane.steps.length, SEQFX_STEP_COUNT);

            for (const step of lane.steps) {
                assert.equal(step.active, false);
                assert.equal(step.trigger, false);
                assert.equal(step.mix, 1);
                assert.equal(step.params.length, SEQFX_PARAM_COUNT);
                assertDefaultAuxMatchesParams(step);
            }
        }
    }

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: true,
    });

    assert.equal(upload.patternIndex, 0);
    assert.equal(upload.authoritative, true);
    assert.equal(upload.activeSteps.length, SEQFX_LANE_COUNT);
    assert.equal(upload.activeSteps[0].length, SEQFX_STEP_COUNT);
    assert.equal(upload.params[0][0].length, SEQFX_PARAM_COUNT);
    assert.equal(upload.params[SEQFX_LANES.stutter][0][0], 8);
    assert.equal(upload.params[SEQFX_LANES.stutter][0][1], 1);
    assert.equal(upload.params[SEQFX_LANES.stutter][0][2], 0.55);
    assert.equal(upload.params[SEQFX_LANES.stutter][0][3], 0.68);
});

test("stutter_shape_and_gate_are_continuous_clamped_parameters", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 4,
        length: 3,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 4,
        paramIndex: 2,
        value: 0.375,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 4,
        paramIndex: 3,
        value: 1.5,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: true,
    });

    assert.deepEqual(
        upload.params[SEQFX_LANES.stutter].slice(4, 7).map((params) => params.slice(0, 4)),
        [
            [8, 1, 0.375, 1],
            [8, 1, 0.375, 1],
            [8, 1, 0.375, 1],
        ],
    );

    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 4,
        paramIndex: 3,
        value: -1,
    });

    assert.equal(
        buildSeqPatternUpload(state, { patternIndex: 0, authoritative: true }).params[SEQFX_LANES.stutter][4][3],
        0,
    );
});

test("serializing_and_normalizing_seqfx_state_preserves_per_step_parameters", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 2,
        lane: SEQFX_LANES.filter,
        step: 5,
        active: true,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 2,
        lane: SEQFX_LANES.filter,
        steps: [5],
        paramIndex: 1,
        value: 240,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 2,
        lane: SEQFX_LANES.filter,
        steps: [5],
        paramIndex: 2,
        value: 7200,
    });

    const restored = normalizeSeqFxState(JSON.parse(serializeSeqFxState(state)));
    const upload = buildSeqPatternUpload(restored, {
        patternIndex: 2,
        authoritative: true,
    });

    assert.equal(restored.patterns[2].lanes[SEQFX_LANES.filter].steps[5].active, true);
    assert.equal(upload.params[SEQFX_LANES.filter][5][1], 240);
    assert.equal(upload.params[SEQFX_LANES.filter][5][2], 7200);
});

test("editing_trigger_latched_tape_and_stutter_parameters_marks_only_that_cell_as_trigger", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        step: 12,
        active: true,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        steps: [12],
        paramIndex: 0,
        value: 1.75,
    });
    state = applySeqFxCellToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        step: 20,
        active: true,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        steps: [20],
        paramIndex: 0,
        value: 2,
    });

    assert.equal(state.patterns[0].lanes[SEQFX_LANES.tapeStop].steps[12].trigger, true);
    assert.equal(state.patterns[0].lanes[SEQFX_LANES.tapeStop].steps[11].trigger, false);
    assert.equal(state.patterns[0].lanes[SEQFX_LANES.tapeStop].steps[13].trigger, false);
    assert.equal(state.patterns[0].lanes[SEQFX_LANES.stutter].steps[20].trigger, true);
});

test("tape_stop_catchup_percent_and_mode_parameters_are_uploaded_to_the_whole_block", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        length: 2,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        paramIndex: 2,
        value: 2.5,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        paramIndex: 3,
        value: 75,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        paramIndex: 4,
        value: 1,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(1, 3).map((params) => params[2]),
        [2.5, 2.5],
    );
    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(1, 3).map((params) => params[3]),
        [75, 75],
    );
    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(1, 3).map((params) => params[4]),
        [1, 1],
    );
});

test("multi_step_edits_allow_step_latched_values_but_reject_trigger_latched_values", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxCellToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        step: 3,
        active: true,
    });
    state = applySeqFxCellToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        step: 4,
        active: true,
    });
    state = applySeqFxMixEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [3, 4],
        value: 0.65,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [3, 4],
        paramIndex: 0,
        value: 5,
    });

    assert.equal(state.patterns[0].lanes[SEQFX_LANES.crusher].steps[3].mix, 0.65);
    assert.equal(state.patterns[0].lanes[SEQFX_LANES.crusher].steps[4].params[0], 5);

    assert.throws(
        () => applySeqFxParamEdit(state, {
            patternIndex: 0,
            lane: SEQFX_LANES.stutter,
            steps: [8, 9],
            paramIndex: 0,
            value: 3,
        }),
        /trigger-latched/i,
    );
});

test("creating_a_seqfx_block_writes_one_trigger_and_continuation_steps", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 2,
        length: 4,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.tapeStop].slice(0, 8), [
        false,
        false,
        true,
        true,
        true,
        true,
        false,
        false,
    ]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.tapeStop].slice(0, 8), [
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
    ]);
});

test("resizing_a_seqfx_block_preserves_one_trigger_and_clears_old_tail_cells", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 4,
        length: 2,
    });
    state = applySeqFxBlockResize(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 4,
        length: 5,
    });
    state = applySeqFxBlockResize(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 4,
        length: 3,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(3, 10), [
        false,
        true,
        true,
        true,
        false,
        false,
        false,
    ]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.filter].slice(3, 10), [
        false,
        true,
        false,
        false,
        false,
        false,
        false,
    ]);
});

test("block_parameter_edits_copy_settings_across_the_block_without_retriggering_continuations", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 10,
        length: 3,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 10,
        paramIndex: 0,
        value: 2.5,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.tapeStop].slice(10, 13), [true, false, false]);
    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(10, 13).map((params) => params[0]),
        [2.5, 2.5, 2.5],
    );
});

test("deleting_a_seqfx_block_clears_all_active_and_trigger_steps_in_that_block", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 6,
        length: 4,
    });
    state = applySeqFxBlockDelete(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 6,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(6, 10), [false, false, false, false]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.filter].slice(6, 10), [false, false, false, false]);
});

test("moving_a_seqfx_block_preserves_per_step_settings_and_clears_the_source", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 2,
        length: 3,
    });
    state = applySeqFxMixEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [2],
        value: 0.2,
    });
    state = applySeqFxMixEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [3],
        value: 0.4,
    });
    state = applySeqFxMixEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [4],
        value: 0.6,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [2],
        paramIndex: 1,
        value: 300,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [3],
        paramIndex: 1,
        value: 600,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [4],
        paramIndex: 1,
        value: 900,
    });
    state = applySeqFxBlockMove(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 2,
        targetStartStep: 8,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(2, 5), [false, false, false]);
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(8, 11), [true, true, true]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.filter].slice(8, 11), [true, false, false]);
    assert.deepEqual(
        upload.mix[SEQFX_LANES.filter].slice(8, 11),
        [0.2, 0.4, 0.6],
    );
    assert.deepEqual(
        upload.params[SEQFX_LANES.filter].slice(8, 11).map((params) => params[1]),
        [300, 600, 900],
    );
});

test("copying_a_seqfx_block_preserves_source_and_rejects_overlaps", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        length: 2,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        paramIndex: 0,
        value: 2.25,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        steps: [2],
        paramIndex: 1,
        value: 1.75,
    });

    assert.throws(
        () => applySeqFxBlockCopy(state, {
            patternIndex: 0,
            lane: SEQFX_LANES.tapeStop,
            startStep: 1,
            targetStartStep: 2,
        }),
        /overlap/i,
    );

    state = applySeqFxBlockCopy(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.tapeStop,
        startStep: 1,
        targetStartStep: 6,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.tapeStop].slice(1, 3), [true, true]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.tapeStop].slice(1, 3), [true, false]);
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.tapeStop].slice(6, 8), [true, true]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.tapeStop].slice(6, 8), [true, false]);
    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(6, 8).map((params) => params[0]),
        [2.25, 2.25],
    );
    assert.deepEqual(
        upload.params[SEQFX_LANES.tapeStop].slice(6, 8).map((params) => params[1]),
        [1, 1.75],
    );
});

test("block_resize_move_copy_copy_paint_and_step_paste_preserve_non_default_aux", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        length: 2,
    });
    state = applySeqFxBlockAuxCurveEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        curve: "log",
    });
    state = applySeqFxBlockAuxTargetToggle(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 0,
        enabled: true,
    });
    state = applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        paramIndex: 0,
        value: 13,
    });

    state = applySeqFxBlockResize(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        length: 3,
    });

    assert.deepEqual(
        state.patterns[0].lanes[SEQFX_LANES.crusher].steps.slice(2, 5).map((step) => step.aux.targets[0]),
        Array.from({ length: 3 }, () => ({ enabled: true, end: 13 })),
    );

    state = applySeqFxBlockMove(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 2,
        targetStartStep: 6,
    });
    state = applySeqFxBlockCopy(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 6,
        targetStartStep: 10,
    });
    const copyPaint = applySeqFxBlockCopyPaint(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 10,
        targetLane: SEQFX_LANES.stutter,
        targetStartStep: 1,
    });
    state = copyPaint.state;

    assert.deepEqual(copyPaint.copiedStartSteps, [1]);
    for (const [lane, startStep] of [
        [SEQFX_LANES.crusher, 6],
        [SEQFX_LANES.crusher, 10],
        [SEQFX_LANES.stutter, 1],
    ]) {
        const step = state.patterns[0].lanes[lane].steps[startStep];
        assert.equal(step.aux.curve, "log");
        assert.deepEqual(step.aux.targets[0], { enabled: true, end: 13 });
    }

    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 20,
        length: 1,
    });
    const copiedValues = getSeqFxStepValueSnapshot(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        step: 6,
    });
    state = applySeqFxStepValuePaste(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [20],
        values: copiedValues,
    });

    const pastedStep = state.patterns[0].lanes[SEQFX_LANES.crusher].steps[20];
    assert.equal(pastedStep.aux.curve, "log");
    assert.deepEqual(pastedStep.aux.targets[0], { enabled: true, end: 13 });
});

test("moving_a_seqfx_block_between_chains_preserves_effect_and_parameter_memory", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        paramIndex: 1,
        value: 320,
    });
    state = applySeqFxBlockEffectEdit(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        paramIndex: 0,
        value: 10,
    });

    state = applySeqFxBlockMove(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 2,
        targetLane: 2,
        targetStartStep: 6,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    const movedStep = state.patterns[0].lanes[2].steps[6];

    assert.deepEqual(upload.activeSteps[0].slice(2, 4), [false, false]);
    assert.deepEqual(upload.activeSteps[2].slice(6, 8), [true, true]);
    assert.deepEqual(upload.triggerSteps[2].slice(6, 8), [true, false]);
    assert.deepEqual(upload.effectTypes[2].slice(6, 8), [
        SEQFX_EFFECT_TYPES.stutter,
        SEQFX_EFFECT_TYPES.stutter,
    ]);
    assert.deepEqual(upload.params[2].slice(6, 8).map((params) => params[0]), [10, 10]);
    assert.equal(movedStep.effectParams?.[SEQFX_EFFECT_TYPES.filter]?.[1], 320);
    assert.doesNotThrow(() => assertSeqFxStateValuesInRange(state));
});

test("copying_a_seqfx_block_between_chains_preserves_source_and_rejects_target_collisions", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 3,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 3,
        paramIndex: 0,
        value: 2,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 8,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });

    const serializedBeforeCollision = serializeSeqFxState(state);
    assert.throws(
        () => applySeqFxBlockCopy(state, {
            patternIndex: 0,
            lane: 0,
            startStep: 3,
            targetLane: 1,
            targetStartStep: 8,
        }),
        /overlap/i,
    );
    assert.equal(serializeSeqFxState(state), serializedBeforeCollision);

    state = applySeqFxBlockCopy(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 3,
        targetLane: 1,
        targetStartStep: 10,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[0].slice(3, 5), [true, true]);
    assert.deepEqual(upload.activeSteps[1].slice(10, 12), [true, true]);
    assert.deepEqual(upload.effectTypes[1].slice(10, 12), [
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.tapeStop,
    ]);
    assert.deepEqual(upload.params[1].slice(10, 12).map((params) => params[0]), [2, 2]);
});

test("copy_paint_across_chains_copies_once_and_reports_the_target_chain", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: 1,
        steps: [4],
        paramIndex: 0,
        value: 6,
    });

    const copyResult = applySeqFxBlockCopyPaint(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        targetLane: 3,
        targetStartStep: 4,
    });

    assert.equal(copyResult.copiedLane, 3);
    assert.deepEqual(copyResult.copiedStartSteps, [4]);
    let upload = buildSeqPatternUpload(copyResult.state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.equal(upload.activeSteps[1][4], true);
    assert.equal(upload.activeSteps[3][4], true);
    assert.equal(upload.effectTypes[3][4], SEQFX_EFFECT_TYPES.crusher);
    assert.equal(upload.params[3][4][0], 6);

    const occupiedState = applySeqFxBlockCreate(copyResult.state, {
        patternIndex: 0,
        lane: 3,
        startStep: 8,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });
    const serializedBeforeInvalidCopy = serializeSeqFxState(occupiedState);
    const invalidResult = applySeqFxBlockCopyPaint(occupiedState, {
        patternIndex: 0,
        lane: 1,
        startStep: 4,
        targetLane: 3,
        targetStartStep: 8,
    });

    assert.equal(invalidResult.copiedLane, 3);
    assert.deepEqual(invalidResult.copiedStartSteps, []);
    assert.equal(serializeSeqFxState(invalidResult.state), serializedBeforeInvalidCopy);
    upload = buildSeqPatternUpload(invalidResult.state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.equal(upload.effectTypes[3][8], SEQFX_EFFECT_TYPES.stutter);
});

test("copy_paint_fills_signed_delta_from_source_block_start", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        length: 1,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [4],
        paramIndex: 0,
        value: 6,
    });

    const paintResult = applySeqFxBlockCopyPaint(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        startStep: 4,
        targetStartStep: 2,
    });
    const upload = buildSeqPatternUpload(paintResult.state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(paintResult.copiedStartSteps, [3, 2]);
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.crusher].slice(0, 6), [false, false, true, true, true, false]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.crusher].slice(0, 6), [false, false, true, true, true, false]);
    assert.deepEqual(
        upload.params[SEQFX_LANES.crusher].slice(2, 5).map((params) => params[0]),
        [6, 6, 6],
    );
});

test("cell_value_snapshots_paste_mix_and_params_without_changing_block_shape", () => {
    let state = createDefaultSeqFxState();
    for (const startStep of [2, 5, 8]) {
        state = applySeqFxBlockCreate(state, {
            patternIndex: 0,
            lane: SEQFX_LANES.crusher,
            startStep,
            length: 1,
        });
    }
    state = applySeqFxMixEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [2],
        value: 0.42,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [2],
        paramIndex: 0,
        value: 5,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [2],
        paramIndex: 1,
        value: 7,
    });
    state = applySeqFxParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [2],
        paramIndex: 2,
        value: 12,
    });

    const copiedValues = getSeqFxStepValueSnapshot(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        step: 2,
    });

    state = applySeqFxStepValuePaste(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        steps: [5, 8],
        values: copiedValues,
    });

    const upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });

    assert.deepEqual(upload.activeSteps[SEQFX_LANES.crusher].slice(0, 10), [
        false, false, true, false, false, true, false, false, true, false,
    ]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.crusher].slice(0, 10), [
        false, false, true, false, false, true, false, false, true, false,
    ]);
    assert.deepEqual(
        [2, 5, 8].map((step) => upload.mix[SEQFX_LANES.crusher][step]),
        [0.42, 0.42, 0.42],
    );
    assert.deepEqual(
        [2, 5, 8].map((step) => upload.params[SEQFX_LANES.crusher][step].slice(0, 3)),
        [[5, 7, 12], [5, 7, 12], [5, 7, 12]],
    );
    let crossChainState = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 1,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    const crossChainPaste = applySeqFxStepValuePaste(crossChainState, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [1],
        values: copiedValues,
    });
    const crossChainUpload = buildSeqPatternUpload(crossChainPaste, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.equal(crossChainUpload.effectTypes[SEQFX_LANES.filter][1], SEQFX_EFFECT_TYPES.crusher);
    assert.deepEqual(crossChainUpload.params[SEQFX_LANES.filter][1].slice(0, 3), [5, 7, 12]);

    const inactivePaste = applySeqFxStepValuePaste(createDefaultSeqFxState(), {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        steps: [3],
        values: copiedValues,
    });
    const inactiveTarget = inactivePaste.patterns[0].lanes[SEQFX_LANES.filter].steps[3];
    assert.equal(inactiveTarget.active, false);
    assert.equal(inactiveTarget.effectType, SEQFX_EFFECT_TYPES.empty);
    assert.doesNotThrow(() => assertSeqFxStateValuesInRange(inactivePaste));
});

test("block_selection_edits_deletes_and_moves_active_blocks_only", () => {
    let state = createDefaultSeqFxState();
    for (const startStep of [1, 3, 6, 10]) {
        state = applySeqFxBlockCreate(state, {
            patternIndex: 0,
            lane: SEQFX_LANES.crusher,
            startStep,
            length: 1,
        });
    }

    state = applySeqFxBlockSelectionParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        blockStartSteps: [1, 3, 6],
        paramIndex: 0,
        value: 5,
    });

    let upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(
        [1, 3, 6, 10].map((step) => upload.params[SEQFX_LANES.crusher][step][0]),
        [5, 5, 5, 8],
    );

    const moveResult = applySeqFxBlockSelectionMove(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        blockStartSteps: [1, 3, 6],
        anchorStartStep: 3,
        targetAnchorStartStep: 5,
    });
    state = moveResult.state;

    assert.deepEqual(moveResult.movedStartSteps, [3, 5, 8]);
    upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.crusher].slice(0, 12), [
        false, false, false, true, false, true, false, false, true, false, true, false,
    ]);
    assert.deepEqual(
        [3, 5, 8, 10].map((step) => upload.params[SEQFX_LANES.crusher][step][0]),
        [5, 5, 5, 8],
    );

    const revisionBeforeNoOpMove = state.patterns[0].revision;
    const noOpMoveResult = applySeqFxBlockSelectionMove(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        blockStartSteps: [3, 5, 8],
        anchorStartStep: 5,
        targetAnchorStartStep: 5,
    });
    assert.deepEqual(noOpMoveResult.movedStartSteps, [3, 5, 8]);
    assert.equal(noOpMoveResult.state.patterns[0].revision, revisionBeforeNoOpMove);

    assert.throws(
        () => applySeqFxBlockSelectionMove(state, {
            patternIndex: 0,
            lane: SEQFX_LANES.crusher,
            blockStartSteps: [3, 5, 8],
            anchorStartStep: 5,
            targetAnchorStartStep: 7,
        }),
        /overlap/i,
    );

    state = applySeqFxBlockSelectionDelete(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.crusher,
        blockStartSteps: [3, 5, 8],
    });

    upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.crusher].slice(0, 12), [
        false, false, false, false, false, false, false, false, false, false, true, false,
    ]);
});

test("block_selection_edits_moves_and_deletes_whole_multi_cell_blocks", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 1,
        length: 2,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 5,
        length: 3,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        startStep: 20,
        length: 2,
    });

    state = applySeqFxBlockSelectionParamEdit(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        blockStartSteps: [1, 5],
        paramIndex: 1,
        value: 2222,
    });

    let upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(
        [1, 2, 5, 6, 7].map((step) => upload.params[SEQFX_LANES.filter][step][1]),
        [2222, 2222, 2222, 2222, 2222],
    );
    assert.deepEqual(
        [20, 21].map((step) => upload.params[SEQFX_LANES.filter][step][1]),
        [2000, 2000],
    );

    const moveResult = applySeqFxBlockSelectionMove(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        blockStartSteps: [1, 5],
        anchorStartStep: 1,
        targetAnchorStartStep: 10,
    });
    state = moveResult.state;
    assert.deepEqual(moveResult.movedStartSteps, [10, 14]);

    upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(1, 8), [
        false, false, false, false, false, false, false,
    ]);
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(10, 17), [
        true, true, false, false, true, true, true,
    ]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.filter].slice(10, 17), [
        true, false, false, false, true, false, false,
    ]);
    assert.deepEqual(
        [10, 11, 14, 15, 16].map((step) => upload.params[SEQFX_LANES.filter][step][1]),
        [2222, 2222, 2222, 2222, 2222],
    );

    state = applySeqFxBlockSelectionDelete(state, {
        patternIndex: 0,
        lane: SEQFX_LANES.filter,
        blockStartSteps: [10, 14],
    });
    upload = buildSeqPatternUpload(state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(10, 17), [
        false, false, false, false, false, false, false,
    ]);
    assert.deepEqual(upload.activeSteps[SEQFX_LANES.filter].slice(20, 22), [true, true]);
    assert.deepEqual(upload.triggerSteps[SEQFX_LANES.filter].slice(20, 22), [true, false]);
});

test("block_selection_move_can_target_another_chain_without_losing_group_shape", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 1,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.filter,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 6,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });
    state = applySeqFxBlockParamEdit(state, {
        patternIndex: 0,
        lane: 0,
        startStep: 6,
        paramIndex: 0,
        value: 12,
    });

    const moveResult = applySeqFxBlockSelectionMove(state, {
        patternIndex: 0,
        lane: 0,
        blockStartSteps: [1, 6],
        anchorStartStep: 1,
        targetLane: 2,
        targetAnchorStartStep: 10,
    });

    assert.equal(moveResult.movedLane, 2);
    assert.deepEqual(moveResult.movedStartSteps, [10, 15]);

    const upload = buildSeqPatternUpload(moveResult.state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[0].slice(1, 8), [false, false, false, false, false, false, false]);
    assert.deepEqual(upload.activeSteps[2].slice(10, 17), [true, true, false, false, false, true, false]);
    assert.deepEqual(upload.triggerSteps[2].slice(10, 17), [true, false, false, false, false, true, false]);
    assert.deepEqual(upload.effectTypes[2].slice(10, 17), [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.empty,
        SEQFX_EFFECT_TYPES.empty,
        SEQFX_EFFECT_TYPES.empty,
        SEQFX_EFFECT_TYPES.stutter,
        SEQFX_EFFECT_TYPES.empty,
    ]);
    assert.equal(upload.params[2][15][0], 12);
});

test("block_selection_copy_can_target_another_chain_and_leaves_invalid_targets_untouched", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 2,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.crusher,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 1,
        startStep: 5,
        length: 2,
        effectType: SEQFX_EFFECT_TYPES.tapeStop,
    });
    state = applySeqFxBlockCreate(state, {
        patternIndex: 0,
        lane: 3,
        startStep: 12,
        length: 1,
        effectType: SEQFX_EFFECT_TYPES.stutter,
    });

    const invalidSerialized = serializeSeqFxState(state);
    const invalidResult = applySeqFxBlockSelectionCopy(state, {
        patternIndex: 0,
        lane: 1,
        blockStartSteps: [2, 5],
        anchorStartStep: 2,
        targetLane: 3,
        targetAnchorStartStep: 9,
    });

    assert.equal(invalidResult.copiedLane, 3);
    assert.deepEqual(invalidResult.copiedStartSteps, []);
    assert.equal(serializeSeqFxState(invalidResult.state), invalidSerialized);

    const copyResult = applySeqFxBlockSelectionCopy(state, {
        patternIndex: 0,
        lane: 1,
        blockStartSteps: [2, 5],
        anchorStartStep: 2,
        targetLane: 3,
        targetAnchorStartStep: 16,
    });

    assert.equal(copyResult.copiedLane, 3);
    assert.deepEqual(copyResult.copiedStartSteps, [16, 19]);

    const upload = buildSeqPatternUpload(copyResult.state, {
        patternIndex: 0,
        authoritative: false,
    });
    assert.deepEqual(upload.activeSteps[1].slice(2, 7), [true, false, false, true, true]);
    assert.deepEqual(upload.activeSteps[3].slice(16, 21), [true, false, false, true, true]);
    assert.equal(upload.effectTypes[3][16], SEQFX_EFFECT_TYPES.crusher);
    assert.deepEqual(upload.effectTypes[3].slice(19, 21), [
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.tapeStop,
    ]);
});
