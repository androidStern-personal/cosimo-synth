import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const {
    PARTIAL_COUNT, defaultPartialShape, partialShapeCodec, partialShapeUpload, templateStrengths,
    withTemplate, withStrength, withCount, smoothed, normalized, inverted, cleared,
} = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/partial-shape.ts");

test("a new instance resonates the first 32 harmonics of a saw", () => {
    assert.equal(PARTIAL_COUNT, 64);
    assert.equal(defaultPartialShape.count, 32);
    assert.equal(defaultPartialShape.template, "saw");
    assert.equal(defaultPartialShape.strengths.length, 64);
    assert.equal(defaultPartialShape.strengths[0], 1);
    assert.equal(defaultPartialShape.strengths[1], 0.5);
    assert.equal(defaultPartialShape.strengths[3], 0.25);
    assert.ok(Object.isFrozen(defaultPartialShape) && Object.isFrozen(defaultPartialShape.strengths));
});

test("templates produce distinct, independently checkable shapes and keep the active count", () => {
    const square = withTemplate(withCount(defaultPartialShape, 16), "square");
    const triangle = withTemplate(defaultPartialShape, "triangle");
    const air = withTemplate(defaultPartialShape, "air");

    assert.equal(square.count, 16);
    assert.equal(square.template, "square");
    assert.equal(square.strengths[0], 1);
    assert.equal(square.strengths[1], 0);
    assert.ok(square.strengths[2] > 0.3 && square.strengths[2] < 0.34);

    assert.equal(triangle.strengths[0], 1);
    assert.equal(triangle.strengths[1], 0);
    assert.ok(triangle.strengths[2] > 0.1 && triangle.strengths[2] < 0.12);
    assert.ok(triangle.strengths[4] < triangle.strengths[2]);

    assert.ok(air.strengths[17] > air.strengths[0]);
    assert.ok(air.strengths[17] > air.strengths[31]);
    assert.deepEqual(templateStrengths("flat"), Array.from({ length: 64 }, () => 1));
});

test("drawing a strength clamps it and its harmonic, and marks the shape custom", () => {
    const edited = withStrength(defaultPartialShape, 3, 0.73);
    assert.equal(edited.template, "custom");
    assert.equal(edited.strengths[3], 0.73);
    assert.equal(defaultPartialShape.strengths[3], 0.25, "edits never change the shape they started from");
    assert.equal(withStrength(defaultPartialShape, 99, 2).strengths[63], 1);
    assert.equal(withStrength(defaultPartialShape, -4, -1).strengths[0], 0);
});

test("the count is a whole number of harmonics from 1 to 64, and inactive strengths survive a change", () => {
    const loud = withStrength(defaultPartialShape, 40, 0.9);
    assert.equal(withCount(loud, 99).count, 64);
    assert.equal(withCount(loud, 0).count, 1);
    assert.equal(withCount(loud, 7.6).count, 8);
    assert.equal(withCount(withCount(loud, 8), 64).strengths[40], 0.9);
});

test("transforms act on the active harmonics only", () => {
    const shape = withCount(withStrength(withStrength(defaultPartialShape, 40, 0.6), 2, 0.2), 8);

    const blurred = smoothed(shape);
    assert.equal(blurred.strengths[2], (shape.strengths[1] + shape.strengths[2] * 2 + shape.strengths[3]) / 4);
    assert.equal(blurred.strengths[7], (shape.strengths[6] + shape.strengths[7] * 3) / 4, "the last active harmonic is its own right neighbour");
    assert.equal(blurred.strengths[40], 0.6);

    const halved = [0.5, 0.25, 0.1, 0].reduce((current, strength, index) => withStrength(current, index, strength), withCount(defaultPartialShape, 4));
    assert.deepEqual(normalized(halved).strengths.slice(0, 4), [1, 0.5, 0.2, 0]);

    assert.equal(inverted(shape).strengths[2], 0.8);
    assert.equal(inverted(shape).strengths[40], 0.6);
    assert.deepEqual(cleared(shape).strengths.slice(0, 8), Array.from({ length: 8 }, () => 0));
    assert.equal(cleared(shape).strengths[40], 0.6);
    for (const transform of [smoothed, normalized, inverted, cleared]) assert.equal(transform(shape).template, "custom");
});

test("the codec saves count, strengths and template, and refuses malformed shapes instead of inventing data", () => {
    const shape = withStrength(defaultPartialShape, 5, 0.42);
    const saved = JSON.parse(JSON.stringify(partialShapeCodec.encode(shape)));
    assert.deepEqual(Object.keys(saved), ["count", "strengths", "template"]);
    const parsed = partialShapeCodec.parse(saved);
    assert.equal(parsed.kind, "ok");
    assert.ok(partialShapeCodec.equals(parsed.value, shape));
    assert.ok(Object.isFrozen(parsed.value.strengths), "parsed shapes are immutable");
    saved.strengths[0] = 0.5;
    assert.equal(parsed.value.strengths[0], 1, "a parsed shape does not share the input's arrays");
    assert.equal(partialShapeCodec.equals(withStrength(shape, 5, 0.43), shape), false);

    const valid = partialShapeCodec.encode(defaultPartialShape);
    for (const [change, message] of [
        [{ strengths: [1] }, /64 strengths/],
        [{ strengths: [...valid.strengths.slice(1), 1.5] }, /from 0 to 1/],
        [{ strengths: [...valid.strengths.slice(1), Number.NaN] }, /from 0 to 1/],
        [{ count: 0 }, /1 to 64/],
        [{ count: 8.5 }, /whole number/],
        [{ template: "sine" }, /"sine" is not a partial template/],
    ]) {
        const result = partialShapeCodec.parse({ ...valid, ...change });
        assert.equal(result.kind, "error", JSON.stringify(change));
        assert.match(result.message, message);
    }
    assert.equal(partialShapeCodec.parse(JSON.stringify(valid)).kind, "error", "a JSON string is not a shape");
});

test("the DSP upload carries the count and all sixty-four strengths", () => {
    const shape = withCount(withStrength(withStrength(defaultPartialShape, 0, 0), 63, 1), 12);
    const upload = partialShapeUpload(shape);
    assert.deepEqual(Object.keys(upload), ["count", "strengths"]);
    assert.equal(upload.count, 12);
    assert.equal(upload.strengths.length, 64);
    assert.equal(upload.strengths[0], 0);
    assert.equal(upload.strengths[63], 1);
});
