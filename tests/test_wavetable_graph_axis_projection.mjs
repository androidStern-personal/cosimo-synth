import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectionModulePromise = loadUIModule(repoRoot, "ui/shared/wavetable-graph-axis-projection.ts");

test("the provisional descriptor binds X to Warp Amount and Y to Index", async () => {
    const { PROVISIONAL_WAVETABLE_GRAPH_AXES } = await projectionModulePromise;

    assert.equal(PROVISIONAL_WAVETABLE_GRAPH_AXES.horizontal.controlID, "warpAmount");
    assert.equal(PROVISIONAL_WAVETABLE_GRAPH_AXES.vertical.controlID, "framePosition");
});

test("a horizontal application writes only Warp Amount", async () => {
    const { PROVISIONAL_WAVETABLE_GRAPH_AXES, projectGraphAxisWrite } = await projectionModulePromise;

    const write = projectGraphAxisWrite(PROVISIONAL_WAVETABLE_GRAPH_AXES, "horizontal", 0.2, 110, 0);
    assert.equal(write.controlID, "warpAmount");
    assert.ok(Math.abs(write.nextNormalized - 0.7) < 1e-9, "220 px crosses the full range");
});

test("a vertical application writes only Index, up-positive", async () => {
    const { PROVISIONAL_WAVETABLE_GRAPH_AXES, projectGraphAxisWrite } = await projectionModulePromise;

    const write = projectGraphAxisWrite(PROVISIONAL_WAVETABLE_GRAPH_AXES, "vertical", 0.5, 0, 55);
    assert.equal(write.controlID, "framePosition");
    assert.ok(Math.abs(write.nextNormalized - 0.75) < 1e-9);
});

test("writes clamp to the normalized range", async () => {
    const { PROVISIONAL_WAVETABLE_GRAPH_AXES, projectGraphAxisWrite } = await projectionModulePromise;

    assert.equal(projectGraphAxisWrite(PROVISIONAL_WAVETABLE_GRAPH_AXES, "horizontal", 0.9, 500, 0).nextNormalized, 1);
    assert.equal(projectGraphAxisWrite(PROVISIONAL_WAVETABLE_GRAPH_AXES, "vertical", 0.1, 0, -500).nextNormalized, 0);
});

test("replacing the provisional horizontal binding leaves the vertical Index binding untouched", async () => {
    const { PROVISIONAL_WAVETABLE_GRAPH_AXES, projectGraphAxisWrite } = await projectionModulePromise;

    const experimental = {
        horizontal: { controlID: "wavetableSelect", direction: 1, pixelsPerFullRange: 440 },
        vertical: PROVISIONAL_WAVETABLE_GRAPH_AXES.vertical,
    };

    const horizontal = projectGraphAxisWrite(experimental, "horizontal", 0, 44, 0);
    assert.equal(horizontal.controlID, "wavetableSelect", "the seam swaps X without new plumbing");
    assert.ok(Math.abs(horizontal.nextNormalized - 0.1) < 1e-9);

    const vertical = projectGraphAxisWrite(experimental, "vertical", 0.5, 0, 55);
    const provisionalVertical = projectGraphAxisWrite(PROVISIONAL_WAVETABLE_GRAPH_AXES, "vertical", 0.5, 0, 55);
    assert.deepEqual(vertical, provisionalVertical, "Y behavior is identical under either X binding");
});
