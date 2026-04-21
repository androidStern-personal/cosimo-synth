import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envelopeModule = await loadUIModule(repoRoot, "fx/seqfx/view/stutter-envelope.ts");

const {
    STUTTER_DEFAULT_SHAPE,
    STUTTER_SHAPE_NAMES,
    clampStutterGate,
    clampStutterShape,
    evaluateStutterEnvelope,
    formatStutterShapeLabel,
    sampleStutterEnvelope,
} = envelopeModule;

function assertClose(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${actual} to be within ${tolerance} of ${expected}`,
    );
}

test("stutter_envelope_gate_controls_the_audible_portion_of_a_cut", () => {
    assert.equal(evaluateStutterEnvelope(0.1, 0, 0), 0);
    assert.equal(evaluateStutterEnvelope(0.1, 0, 0.5), 1);
    assert.equal(evaluateStutterEnvelope(0.49, 0, 0.5), 1);
    assert.equal(evaluateStutterEnvelope(0.5, 0, 0.5), 0);
    assert.equal(evaluateStutterEnvelope(0.9, 0, 0.5), 0);
});

test("stutter_envelope_shape_stops_have_expected_anchor_values", () => {
    const gate = 1;
    assert.deepEqual([...STUTTER_SHAPE_NAMES], ["Gate", "Triangle", "Bell", "Ramp Down", "Ramp Up"]);

    const gateShape = 0 / (STUTTER_SHAPE_NAMES.length - 1);
    const triangleShape = 1 / (STUTTER_SHAPE_NAMES.length - 1);
    const bellShape = 2 / (STUTTER_SHAPE_NAMES.length - 1);
    const rampDownShape = 3 / (STUTTER_SHAPE_NAMES.length - 1);
    const rampUpShape = 4 / (STUTTER_SHAPE_NAMES.length - 1);

    assert.equal(evaluateStutterEnvelope(0.25, gateShape, gate), 1);
    assertClose(evaluateStutterEnvelope(0.25, triangleShape, gate), 0.5, 0.001, "triangle attack");
    assertClose(evaluateStutterEnvelope(0.5, triangleShape, gate), 1, 0.001, "triangle peak");
    assertClose(evaluateStutterEnvelope(0.5, bellShape, gate), 1, 0.001, "bell peak");
    assertClose(evaluateStutterEnvelope(0.25, rampDownShape, gate), 0.75, 0.001, "ramp down");
    assertClose(evaluateStutterEnvelope(0.25, rampUpShape, gate), 0.25, 0.001, "ramp up");
});

test("stutter_envelope_gate_to_triangle_segment_forms_a_trapezoid_before_collapse", () => {
    const midpointShape = 0.5 / (STUTTER_SHAPE_NAMES.length - 1);

    assertClose(evaluateStutterEnvelope(0.1, midpointShape, 1), 0.4, 0.001, "left wall should lean inward");
    assertClose(evaluateStutterEnvelope(0.3, midpointShape, 1), 1, 0.001, "mid-segment should keep a flat top");
    assertClose(evaluateStutterEnvelope(0.7, midpointShape, 1), 1, 0.001, "flat top should remain until the right wall");
    assertClose(evaluateStutterEnvelope(0.8, midpointShape, 1), 0.8, 0.001, "right wall should lean inward");
});

test("stutter_envelope_sampling_and_labels_match_the_editor_model", () => {
    assert.equal(clampStutterShape(-1), 0);
    assert.equal(clampStutterShape(2), 1);
    assert.equal(clampStutterGate(-1), 0);
    assert.equal(clampStutterGate(2), 1);

    assert.equal(formatStutterShapeLabel(0), "Gate (0.00)");
    assert.equal(formatStutterShapeLabel(STUTTER_DEFAULT_SHAPE), "Triangle -> Bell (0.44)");
    assert.equal(formatStutterShapeLabel(1), "Ramp Up (1.00)");

    const gateSamples = sampleStutterEnvelope(0, 0.5, 5);
    assert.deepEqual(
        gateSamples.map((sample) => sample.phase),
        [0, 0.25, 0.5, 0.75, 1],
    );
    assert.deepEqual(
        gateSamples.map((sample) => sample.value),
        [1, 1, 0, 0, 0],
    );

    const triangleShape = 1 / (STUTTER_SHAPE_NAMES.length - 1);
    const triangleSamples = sampleStutterEnvelope(triangleShape, 1, 5);
    assert.deepEqual(
        triangleSamples.map((sample) => sample.phase),
        [0, 0.25, 0.5, 0.75, 1],
    );
    assert.deepEqual(
        triangleSamples.map((sample) => sample.value),
        [0, 0.5, 1, 0.5, 0],
    );
});
