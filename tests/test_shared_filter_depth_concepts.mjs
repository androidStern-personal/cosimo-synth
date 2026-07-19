import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const conceptsPromise = loadUIModule(repoRoot, "ui/shared/filter-depth-concepts.ts");

test("the cutoff-sweep family respects layer count and shows resonance growth", async () => {
    const concepts = await conceptsPromise;
    const family = concepts.buildFilterFamilyCurves(0.707, 9);
    assert.equal(family.length, 9);
    for (const curve of family) assert.equal(curve.length >= 2, true);

    const peakHeight = (curve) => Math.max(...curve.map((point) => 1 - point.y));
    const gentle = concepts.buildFilterFamilyCurves(0.707, 9).map(peakHeight);
    const resonant = concepts.buildFilterFamilyCurves(12, 9).map(peakHeight);
    for (let index = 1; index < 8; index += 1) {
        assert.equal(resonant[index] > gentle[index] + 0.05, true, `layer ${index}: resonance must raise the ridge`);
    }
});

test("the spectrum history ring is stride-gated and live-fronted", async () => {
    const concepts = await conceptsPromise;
    const ring = concepts.createSpectrumHistoryRing(4, 100);
    ring.push([0.1], 0);
    ring.push([0.2], 30);   // within stride: live updates, no capture
    ring.push([0.3], 120);  // captured
    ring.push([0.4], 150);  // live only
    const layers = ring.getLayers();
    assert.deepEqual(layers[0], [0.4], "index 0 is always the live frame");
    assert.deepEqual(layers[1], [0.3], "most recent capture behind it");
    assert.deepEqual(layers[2], [0.1], "first capture at the back");
    // Capacity: many captures never exceed layer count + live.
    for (let step = 0; step < 20; step += 1) ring.push([step], 1000 + step * 200);
    assert.equal(ring.getLayers().length <= 5, true);
});
