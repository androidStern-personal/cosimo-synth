import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadResolver() {
    return await loadUIModule(repoRoot, "ui/shared/modulation-target-base.ts");
}

// The mapping rows draw their rails from the target's own display scale:
// log-scaled parameters place the base tick logarithmically, and
// octave-application amounts travel in octaves — never as raw units added
// to a Hz value (the bug that made a ±2.3 oct band invisibly thin).

const CLOSE = 0.0005;

test("a log rack target normalizes its base tick logarithmically", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const base = resolveModulationTargetBase("lane.globalFilter#1.globalFilterCutoff");
    assert.ok(base);
    const projection = base.railProjection;
    assert.ok(projection, "Backed targets must carry a rail projection.");
    // 1000 Hz on a log 20..20000 track: ln(50)/ln(1000).
    assert.ok(Math.abs(projection.normalizeValue(1000) - 0.56632) < CLOSE);
    assert.equal(projection.normalizeValue(20), 0);
    assert.equal(projection.normalizeValue(20000), 1);
});

test("octave amounts on a log track travel linearly in octaves", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const projection = resolveModulationTargetBase("lane.globalFilter#1.globalFilterCutoff").railProjection;
    const baseNormalized = projection.normalizeValue(1000);
    const band = projection.projectBand(baseNormalized, { amount: 2.3, polarity: "bipolar" });
    // ±2.3 oct of a log2(1000)-octave track: ±2.3/9.9658 of the width.
    const octaveSpan = Math.log2(1000);
    assert.ok(Math.abs(band.lowNormalized - (0.56632 - (2.3 / octaveSpan))) < CLOSE);
    assert.ok(Math.abs(band.highNormalized - (0.56632 + (2.3 / octaveSpan))) < CLOSE);
    assert.ok(Math.abs(band.baseNormalized - 0.56632) < CLOSE);
    assert.equal(band.clippedLow, false);
    assert.equal(band.clippedHigh, false);
    assert.equal(band.fullyClipped, false);
});

test("octave travel past the track end clamps and reports the clip", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const projection = resolveModulationTargetBase("lane.globalFilter#1.globalFilterCutoff").railProjection;
    const baseNormalized = projection.normalizeValue(1000);
    const band = projection.projectBand(baseNormalized, { amount: 6, polarity: "unipolar" });
    // 1000 Hz + 6 oct = 64 kHz, far past 20 kHz.
    assert.equal(band.highNormalized, 1);
    assert.ok(Math.abs(band.lowNormalized - baseNormalized) < CLOSE);
    assert.equal(band.clippedHigh, true);
    assert.equal(band.clippedLow, false);
});

test("the voice filter's octave target projects the same octave language", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const base = resolveModulationTargetBase("filterCutoffOctaves");
    assert.ok(base);
    const projection = base.railProjection;
    assert.ok(projection);
    const baseNormalized = projection.normalizeValue(1000);
    assert.ok(Math.abs(baseNormalized - 0.56632) < CLOSE);
    const band = projection.projectBand(baseNormalized, { amount: -2, polarity: "unipolar" });
    const octaveSpan = Math.log2(1000);
    assert.ok(Math.abs(band.lowNormalized - (baseNormalized - (2 / octaveSpan))) < CLOSE);
    assert.ok(Math.abs(band.highNormalized - baseNormalized) < CLOSE);
});

test("linear targets keep the plain additive band", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const projection = resolveModulationTargetBase("lane.flanger#1.flangerDepth").railProjection;
    assert.ok(projection);
    assert.ok(Math.abs(projection.normalizeValue(0.6) - 0.6) < CLOSE);
    const band = projection.projectBand(0.6, { amount: -0.25, polarity: "unipolar" });
    assert.ok(Math.abs(band.lowNormalized - 0.35) < CLOSE);
    assert.ok(Math.abs(band.highNormalized - 0.6) < CLOSE);
});

test("oscillator targets project linearly through the same contract", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const base = resolveModulationTargetBase("oscA.wavetablePosition");
    assert.ok(base);
    const projection = base.railProjection;
    assert.ok(projection);
    assert.ok(Math.abs(projection.normalizeValue(0.25) - 0.25) < CLOSE);
    const band = projection.projectBand(0.25, { amount: 0.5, polarity: "unipolar" });
    assert.ok(Math.abs(band.lowNormalized - 0.25) < CLOSE);
    assert.ok(Math.abs(band.highNormalized - 0.75) < CLOSE);
});

test("the projection inverts: denormalize is the exact inverse of normalize", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const logProjection = resolveModulationTargetBase("lane.globalFilter#1.globalFilterCutoff").railProjection;
    // The base drag walks the DISPLAY scale (the knobs' settled rule), so the
    // projection must run both directions.
    assert.ok(Math.abs(logProjection.denormalizeValue(logProjection.normalizeValue(1000)) - 1000) < 0.001);
    // Halfway along a log 20..20000 track is the geometric middle.
    assert.ok(Math.abs(logProjection.denormalizeValue(0.5) - Math.sqrt(20 * 20000)) < 0.01);
    const linearProjection = resolveModulationTargetBase("lane.flanger#1.flangerDepth").railProjection;
    assert.ok(Math.abs(linearProjection.denormalizeValue(0.25) - 0.25) < 0.000001);
});

test("resonance targets carry the knobs' effective-value amount drag style", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    // The knob saga's settled rule, ONCE, at the resolver: a parameter whose
    // base rests by a domain edge (resonance) walks the MODULATED value
    // along its own dial for amount drags. Every surface reads it from here.
    assert.equal(resolveModulationTargetBase("lane.globalFilter#1.globalFilterResonance").amountDragStyle, "effective-value");
    assert.equal(resolveModulationTargetBase("filterQ").amountDragStyle, "effective-value");
    assert.equal(resolveModulationTargetBase("lane.globalFilter#1.globalFilterCutoff").amountDragStyle, "amount-span");
    assert.equal(resolveModulationTargetBase("filterCutoffOctaves").amountDragStyle, "amount-span");
    assert.equal(resolveModulationTargetBase("lane.flanger#1.flangerDepth").amountDragStyle, "amount-span");
    assert.equal(resolveModulationTargetBase("oscA.wavetablePosition").amountDragStyle, "amount-span");
});
