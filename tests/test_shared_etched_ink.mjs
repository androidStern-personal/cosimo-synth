import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const etchedPromise = loadUIModule(repoRoot, "ui/shared/etched-ink.ts");

test("the tonal model: empty prints nothing, cold coverage prints dense, hot cores burn through", async () => {
    const etched = await etchedPromise;
    const params = etched.createDefaultEtchedInkParams();

    assert.equal(etched.computeInkDensity(0, params), 0, "no energy → clean paper");
    assert.equal(etched.computeInkDensity(params.energyFloor * 0.9, params), 0, "sub-floor residue → clean paper");

    const cold = etched.computeInkDensity(0.06, params);
    assert.equal(cold > 0.6, true, `cold-but-covered must print dense ink (got ${cold})`);

    const hot = etched.computeInkDensity(0.62, params);
    assert.equal(hot < 0.05, true, `hot cores must withhold ink (got ${hot})`);

    assert.equal(etched.computeInkDensity(1, params) <= hot, true, "full energy is at least as clean");
});

test("density is continuous in [0,1] and brightness is earned monotonically past the coverage knee", async () => {
    const etched = await etchedPromise;
    const params = etched.createDefaultEtchedInkParams();
    fc.assert(
        fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (energy) => {
            const density = etched.computeInkDensity(energy, params);
            assert.equal(density >= 0 && density <= 1, true);
        }),
    );
    // Past full coverage (energy >= 1/inkDensity), more energy can only reduce ink.
    const knee = Math.max(params.energyFloor, 1 / (params.inkDensity * params.energyGain));
    let previous = etched.computeInkDensity(knee, params);
    for (let step = 1; step <= 40; step += 1) {
        const energy = knee + ((1 - knee) * step) / 40;
        const density = etched.computeInkDensity(energy, params);
        assert.equal(density <= previous + 1e-12, true, `monotone at ${energy}`);
        previous = density;
    }
});

test("dither thresholds tile correctly for both styles", async () => {
    const etched = await etchedPromise;
    const stipple = { ...etched.createDefaultEtchedInkParams(), dither: "stipple" };
    const seen = new Set();
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        const threshold = etched.ditherThreshold(x, y, stipple);
        assert.equal(threshold >= 0 && threshold < 1, true);
        seen.add(threshold);
        assert.equal(etched.ditherThreshold(x + 8, y + 16, stipple), threshold, "8×8 tiling");
    }
    assert.equal(seen.size, 64, "Bayer 8×8 uses 64 distinct levels");

    const hatch = { ...etched.createDefaultEtchedInkParams(), dither: "hatch" };
    fc.assert(
        fc.property(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 }), (x, y) => {
            const threshold = etched.ditherThreshold(x, y, hatch);
            assert.equal(threshold >= 0 && threshold <= 1, true);
        }),
    );
});

test("error diffusion preserves mean tone and emits pure 1-bit marks", async () => {
    const etched = await etchedPromise;
    const width = 64, height = 64;
    const density = new Float32Array(width * height).fill(0.5);
    etched.diffuseDensityBuffer(density, width, height);
    let sum = 0;
    for (const value of density) {
        assert.equal(value === 0 || value === 1, true, "marks are 1-bit");
        sum += value;
    }
    const mean = sum / density.length;
    assert.equal(Math.abs(mean - 0.5) < 0.05, true, `mean tone preserved (got ${mean})`);

    // A hard edge stays a hard edge: left half empty, right half full.
    const edge = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) for (let x = width / 2; x < width; x += 1) edge[y * width + x] = 1;
    etched.diffuseDensityBuffer(edge, width, height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width / 2 - 1; x += 1) assert.equal(edge[y * width + x], 0, "clean side stays clean");
        for (let x = width / 2 + 1; x < width; x += 1) assert.equal(edge[y * width + x], 1, "full side stays full");
    }
});
