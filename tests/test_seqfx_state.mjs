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
