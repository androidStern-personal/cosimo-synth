import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const carpetPromise = loadUIModule(repoRoot, "ui/shared/carpet-field.ts");
const responsePromise = loadUIModule(repoRoot, "ui/shared/filter-response.ts");

test("column map shares the tuned 20–20k log axis and yields valid FFT bins", async () => {
    const carpet = await carpetPromise;
    const response = await responsePromise;
    const columns = carpet.buildCarpetColumnMap({
        fftSize: 8192,
        sampleRate: 48000,
        columnCount: 44,
        minHz: 20,
        maxHz: 20000,
    });

    assert.equal(columns.length, 44);
    const nyquistBins = 8192 / 2;
    for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        assert.equal(column.binStart <= column.binEnd, true, `column ${index}: bin range must be ordered`);
        assert.equal(column.binStart >= 0 && column.binEnd < nyquistBins, true, `column ${index}: bins in range`);
        assert.equal(column.xNorm >= 0 && column.xNorm <= 1, true, `column ${index}: xNorm normalized`);
        if (index > 0) {
            assert.equal(column.centerHz > columns[index - 1].centerHz, true, `column ${index}: centers ascend`);
            assert.equal(column.xNorm > columns[index - 1].xNorm, true, `column ${index}: xNorm ascends`);
            assert.equal(
                column.binStart >= columns[index - 1].binStart,
                true,
                `column ${index}: bin windows never move backwards`,
            );
        }
        // The carpet MUST sit on the same axis as the tuned cutoff drag surface,
        // otherwise the hero curve and the lattice disagree about where a
        // frequency lives — the exact failure the earlier 2D spectrum had.
        const tunedNorm = response.filterCutoffHzToNormalized(column.centerHz);
        assert.equal(Math.abs(column.xNorm - tunedNorm) < 1e-6, true, `column ${index}: axis matches drag surface`);
    }
});

test("layout keeps every dot inside the frame at full excursion", async () => {
    const carpet = await carpetPromise;
    const width = 412;
    const height = 300;
    const padPx = 10;
    const layout = carpet.computeCarpetLayout({
        width,
        height,
        padPx,
        rows: 30,
        depthSpanRatio: 0.5,
        depthInsetRatio: 0.09,
        frontBaseRatio: 0.99,
        heightRatio: 1.0,
        frontDotRadiusPx: 3.4,
        backScale: 0.62,
    });

    assert.equal(layout.length, 30);
    for (let index = 0; index < layout.length; index += 1) {
        const row = layout[index];
        const crestY = row.baseY - row.heightPx - row.dotRadius;
        assert.equal(crestY >= padPx, true, `row ${index}: full-excursion crest stays under the top edge`);
        assert.equal(row.baseY + row.dotRadius <= height - padPx, true, `row ${index}: rest plane above bottom edge`);
        assert.equal(row.xLeft >= padPx, true, `row ${index}: left edge inside frame`);
        assert.equal(row.xLeft + row.xSpan <= width - padPx + 1e-9, true, `row ${index}: right edge inside frame`);
        if (index > 0) {
            assert.equal(row.baseY < layout[index - 1].baseY, true, `row ${index}: recedes upward`);
            assert.equal(row.dotRadius <= layout[index - 1].dotRadius, true, `row ${index}: dots shrink with depth`);
            assert.equal(row.xSpan <= layout[index - 1].xSpan, true, `row ${index}: rows narrow with depth`);
        }
    }
    assert.equal(layout[0].depthT, 0);
    assert.equal(layout[layout.length - 1].depthT, 1);
});

test("tone quantization is a monotone three-state map", async () => {
    const carpet = await carpetPromise;
    assert.equal(carpet.quantizeCarpetTone(0, 0.25, 0.62), "rest");
    assert.equal(carpet.quantizeCarpetTone(0.24, 0.25, 0.62), "rest");
    assert.equal(carpet.quantizeCarpetTone(0.25, 0.25, 0.62), "mid");
    assert.equal(carpet.quantizeCarpetTone(0.61, 0.25, 0.62), "mid");
    assert.equal(carpet.quantizeCarpetTone(0.62, 0.25, 0.62), "crest");
    assert.equal(carpet.quantizeCarpetTone(1, 0.25, 0.62), "crest");
    // Degenerate thresholds must not invert the ordering.
    assert.equal(carpet.quantizeCarpetTone(0.5, 0.7, 0.3), "crest");
});

test("mesh smoothing spreads energy without creating or losing it", async () => {
    const carpet = await carpetPromise;
    const impulse = [0, 0, 1, 0, 0];
    assert.deepEqual(carpet.smoothColumns(impulse, 0), impulse, "zero passes is identity");
    const once = carpet.smoothColumns(impulse, 1);
    assert.deepEqual(once, [0, 0.25, 0.5, 0.25, 0]);
    const sum = once.reduce((total, value) => total + value, 0);
    assert.equal(Math.abs(sum - 1) < 1e-9, true, "interior impulse energy is conserved");
    const flat = [0.4, 0.4, 0.4, 0.4];
    assert.deepEqual(carpet.smoothColumns(flat, 3), flat, "constant surface is a fixed point");
    const twice = carpet.smoothColumns(impulse, 2);
    assert.equal(twice[2] < once[2], true, "more passes keep flattening the peak");
});

test("glide rises fast and falls slow, per column", async () => {
    const carpet = await carpetPromise;
    const rose = carpet.glideColumns([0.2], [0.8], 0.75, 0.25);
    assert.equal(Math.abs(rose[0] - (0.2 + 0.6 * 0.75)) < 1e-9, true, "rising uses the rise fraction");
    const fell = carpet.glideColumns([0.8], [0.2], 0.75, 0.25);
    assert.equal(Math.abs(fell[0] - (0.8 - 0.6 * 0.25)) < 1e-9, true, "falling uses the fall fraction");
    assert.deepEqual(
        carpet.glideColumns([0.5, 0.5], [0.1, 0.9, 0.3], 0.75, 0.25),
        [0.1, 0.9, 0.3],
        "shape change adopts the new frame outright",
    );
});

test("analyzer dB values clamp into normalized magnitude", async () => {
    const carpet = await carpetPromise;
    assert.equal(carpet.magnitudeFromDb(-80, -80, -22), 0);
    assert.equal(carpet.magnitudeFromDb(-22, -80, -22), 1);
    const mid = carpet.magnitudeFromDb(-51, -80, -22);
    assert.equal(mid > 0.49 && mid < 0.51, true);
    assert.equal(carpet.magnitudeFromDb(-200, -80, -22), 0);
    assert.equal(carpet.magnitudeFromDb(0, -80, -22), 1);
    assert.equal(carpet.magnitudeFromDb(Number.NEGATIVE_INFINITY, -80, -22), 0);
    assert.equal(carpet.magnitudeFromDb(Number.NaN, -80, -22), 0);
});
