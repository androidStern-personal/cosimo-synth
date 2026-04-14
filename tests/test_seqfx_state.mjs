import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const stateModule = await loadUIModule(repoRoot, "ui/seqfx/seqfx-state.ts");

const {
    SEQFX_LANE_COUNT,
    SEQFX_PARAM_COUNT,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    SEQFX_LANES,
    applySeqFxBlockCreate,
    applySeqFxBlockCopy,
    applySeqFxBlockDelete,
    applySeqFxBlockMove,
    applySeqFxBlockParamEdit,
    applySeqFxBlockResize,
    applySeqFxCellToggle,
    applySeqFxMixEdit,
    applySeqFxParamEdit,
    buildSeqPatternUpload,
    createDefaultSeqFxState,
    serializeSeqFxState,
    normalizeSeqFxState,
} = stateModule;

test("default_seqfx_state_contains_twelve_complete_four_lane_patterns", () => {
    const state = createDefaultSeqFxState();

    assert.equal(state.version, 1);
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
