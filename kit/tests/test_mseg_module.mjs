import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const { addMsegPoint, createDefaultMsegShape } = await loadUIModule(repoRoot, "kit/ui/mseg.ts");
const { msegCurveCodec } = await loadUIModule(repoRoot, "kit/ui/mseg-state.ts");

test("curve codec rejects poisoned coordinates and out-of-order points, and owns its points", () => {
    // The default shape's two end points with one point added between them.
    const input = addMsegPoint(createDefaultMsegShape(), 0.4, 0.7);
    const [start, , end] = input.points;

    const result = msegCurveCodec.parse(input);
    assert.equal(result.kind, "ok");
    assert.ok(Object.isFrozen(result.value));
    assert.ok(Object.isFrozen(result.value.points[1]));

    // The parsed curve is a copy: editing the input afterwards does not reach it.
    input.points[1].y = 0.1;
    assert.equal(result.value.points[1].y, 0.7);

    const poisoned = { ...input, points: [start, { x: 0.4, y: Infinity, curvePower: 0 }, end] };
    assert.equal(msegCurveCodec.parse(poisoned).kind, "error");

    const reversed = {
        ...input,
        points: [start, { x: 0.8, y: 0.3, curvePower: 0 }, { x: 0.2, y: 0.5, curvePower: 0 }, end],
    };
    assert.equal(msegCurveCodec.parse(reversed).kind, "error");
});
