import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auxSourceModule = await loadUIModule(repoRoot, "fx/seqfx/view/AuxSource.tsx");

const {
    sampleAuxSource,
    buildAuxSourcePreviewPath,
    auxSourcePreviewPoint,
} = auxSourceModule;

function assertClose(actual, expected, message) {
    assert.ok(
        Math.abs(actual - expected) <= 0.000001,
        `${message}: expected ${expected}, got ${actual}`,
    );
}

test("sampleAuxSource maps the shape control to falling bell and rising anchors", () => {
    assertClose(sampleAuxSource({ phase: 0, shape: -1, sourceCurve: 0 }), 1, "falling starts high");
    assertClose(sampleAuxSource({ phase: 1, shape: -1, sourceCurve: 0 }), 0, "falling ends low");
    assertClose(sampleAuxSource({ phase: 0, shape: 1, sourceCurve: 0 }), 0, "rising starts low");
    assertClose(sampleAuxSource({ phase: 1, shape: 1, sourceCurve: 0 }), 1, "rising ends high");
    assertClose(sampleAuxSource({ phase: 0, shape: 0, sourceCurve: 0 }), 0, "bell starts low");
    assertClose(sampleAuxSource({ phase: 0.5, shape: 0, sourceCurve: 0 }), 1, "bell peaks at center");
    assertClose(sampleAuxSource({ phase: 1, shape: 0, sourceCurve: 0 }), 0, "bell ends low");

    const quarterBell = sampleAuxSource({ phase: 0.25, shape: 0, sourceCurve: 0 });
    assert.ok(quarterBell > 0.7, `neutral shape should be rounded, got ${quarterBell}`);
    assert.ok(quarterBell < 0.72, `neutral shape should not become flat-topped without curve, got ${quarterBell}`);
});

test("sampleAuxSource curve control deflates or aggressively inflates the rounded shoulder", () => {
    const neutralShoulder = sampleAuxSource({ phase: 0.25, shape: 0, sourceCurve: 0 });
    const deflatedShoulder = sampleAuxSource({ phase: 0.25, shape: 0, sourceCurve: -1 });
    const inflatedShoulder = sampleAuxSource({ phase: 0.25, shape: 0, sourceCurve: 1 });

    assert.ok(deflatedShoulder < neutralShoulder * 0.2, `deflated shoulder should drop far below neutral, got ${deflatedShoulder}`);
    assert.ok(inflatedShoulder > 0.999, `inflated shoulder should push close to a square top, got ${inflatedShoulder}`);
    assertClose(sampleAuxSource({ phase: 0, shape: 0, sourceCurve: 1 }), 0, "inflation preserves the low endpoint");
    assertClose(sampleAuxSource({ phase: 1, shape: 0, sourceCurve: 1 }), 0, "inflation preserves the final low endpoint");
});

test("aux source preview point uses raw phase for x and shaped amount for y", () => {
    const point = auxSourcePreviewPoint({ phase: 0.25, shape: -1, sourceCurve: 0 }, 200, 100);

    assertClose(point.x, 51, "x should follow raw phase with two-pixel padding");
    assertClose(point.y, 26, "falling ramp y should follow shaped amount");
});

test("aux source thumbnail path changes when shape or source curve changes", () => {
    const neutral = buildAuxSourcePreviewPath({ shape: 0, sourceCurve: 0 });
    const falling = buildAuxSourcePreviewPath({ shape: -1, sourceCurve: 0 });
    const inflated = buildAuxSourcePreviewPath({ shape: 0, sourceCurve: 0.75 });

    assert.notEqual(falling, neutral);
    assert.notEqual(inflated, neutral);
});
