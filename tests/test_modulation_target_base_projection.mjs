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

test("every MSEG Rate resolves its live seconds endpoint for MAPPINGS base editing", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    for (const slot of [1, 2, 3]) {
        const base = resolveModulationTargetBase(`mseg${slot}Rate`);
        assert.ok(base);
        assert.equal(base.endpointID, `mseg${slot}Rate`);
        assert.equal(base.entrySpec._tag, "seconds");
        assert.equal(base.entrySpec.min, 0);
        assert.equal(base.entrySpec.max, 2);
        assert.equal(base.initialValue, 1);
    }
});

test("every endpoint-backed MSEG and ENV generator target resolves its live MAPPINGS base", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const percentTargets = [
        ["mseg1Morph", 0],
        ["mseg2Morph", 0],
        ["mseg3Morph", 0],
        ["env1Sustain", 0.5],
        ["env2Sustain", 0.5],
        ["env3Sustain", 0.5],
    ];
    for (const [targetKind, initialValue] of percentTargets) {
        const base = resolveModulationTargetBase(targetKind);
        assert.ok(base, `${targetKind} must expose its endpoint-backed base.`);
        assert.equal(base.endpointID, targetKind);
        assert.equal(base.entrySpec._tag, "scalar");
        assert.equal(base.entrySpec.defaultUnit, "%");
        assert.equal(base.entrySpec.min, 0);
        assert.equal(base.entrySpec.max, 1);
        assert.ok(Math.abs(base.initialValue - initialValue) < 1e-9);
        assert.equal(base.railProjection.normalizeValue(0), 0);
        assert.equal(base.railProjection.normalizeValue(1), 1);
    }

    const timeTargets = [
        ["mseg1Rate", 0, 2, 1],
        ["mseg2Rate", 0, 2, 1],
        ["mseg3Rate", 0, 2, 1],
        ["env1Attack", 0.001, 10, 0.01],
        ["env1Decay", 0.001, 10, 0.25],
        ["env1Release", 0.001, 10, 0.2],
        ["env2Attack", 0.001, 10, 0.01],
        ["env2Decay", 0.001, 10, 0.25],
        ["env2Release", 0.001, 10, 0.2],
        ["env3Attack", 0.001, 10, 0.01],
        ["env3Decay", 0.001, 10, 0.25],
        ["env3Release", 0.001, 10, 0.2],
    ];
    for (const [targetKind, min, max, initialValue] of timeTargets) {
        const base = resolveModulationTargetBase(targetKind);
        assert.ok(base, `${targetKind} must expose its endpoint-backed base.`);
        assert.equal(base.endpointID, targetKind);
        assert.equal(base.entrySpec._tag, "seconds");
        assert.equal(base.entrySpec.min, min);
        assert.equal(base.entrySpec.max, max);
        assert.ok(Math.abs(base.initialValue - initialValue) < 1e-9);
        assert.equal(base.railProjection.normalizeValue(min), 0);
        assert.equal(base.railProjection.normalizeValue(max), 1);
    }
});

test("every oscillator Level target resolves its live presented base endpoint", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    for (const oscillatorID of ["A", "B", "C"]) {
        const base = resolveModulationTargetBase(`osc${oscillatorID}.ampGainDb`);
        assert.ok(base, `Oscillator ${oscillatorID} Level must expose its live base.`);
        assert.equal(base.endpointID, `osc${oscillatorID}VolumeDb`);
        assert.equal(base.label, "Level");
        assert.equal(base.entrySpec.defaultUnit, "dB");
    }
});

test("every currently visible production modulation target has a live base contract", async () => {
    const { resolveModulationTargetBase } = await loadResolver();
    const { MODULATION_TARGET_OPTIONS } = await loadUIModule(repoRoot, "ui/shared/modulation.ts");
    for (const option of MODULATION_TARGET_OPTIONS) {
        assert.ok(
            resolveModulationTargetBase(option.value),
            `${option.label} (${option.value}) must not fall into amount-only rendering.`,
        );
    }
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
