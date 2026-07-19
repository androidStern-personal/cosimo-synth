import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const dataPromise = loadUIModule(
    repoRoot,
    "prototypes/mobile-sound-design-wireframe/src/etchGalleryData.js",
);
const spectrumPromise = loadUIModule(repoRoot, "ui/shared/filter-spectrum.ts");
const distortionPromise = loadUIModule(repoRoot, "ui/shared/distortion-visualization.ts");
const filterEnergyPromise = loadUIModule(repoRoot, "ui/shared/filter-energy-field.ts");

test("synthetic filter frames satisfy the real normalizer and follow the response", async () => {
    const data = await dataPromise;
    const spectrum = await spectrumPromise;

    const frame = data.makeFilterSpectrumFrame(1.25, 2000, 0.7);
    const normalized = spectrum.normalizeFilterSpectrumMessage(frame);
    assert.notEqual(normalized, null, "must pass normalizeFilterSpectrumMessage");
    assert.equal(normalized.magnitudes.length >= 8, true);

    // A 500 Hz lowpass must attenuate the top octaves versus an 8 kHz one.
    const low = data.makeFilterSpectrumFrame(1.25, 500, 0.7).magnitudes;
    const high = data.makeFilterSpectrumFrame(1.25, 8000, 0.7).magnitudes;
    const topBandSum = (magnitudes) => {
        let sum = 0;
        for (let index = Math.floor(magnitudes.length * 0.6); index < magnitudes.length; index += 1) {
            sum += magnitudes[index];
        }
        return sum;
    };
    assert.equal(topBandSum(low) < topBandSum(high) * 0.25, true, "cutoff audibly moves the synthetic analyzer");
});

test("synthetic distortion frames satisfy the real normalizers and the engine shaper", async () => {
    const data = await dataPromise;
    const distortion = await distortionPromise;

    const scope = data.makeDistortionScopeFrame(0.8, 18, 0.5);
    const normalizedScope = distortion.normalizeDistortionScopeMessage(scope);
    assert.notEqual(normalizedScope, null, "scope frame passes the real normalizer");

    for (let index = 0; index < scope.inputSamples.length; index += 17) {
        assert.equal(
            scope.outputSamples[index],
            distortion.shapeDistortionSample(scope.inputSamples[index], 0.5),
            `output[${index}] must be the engine shaper of input`,
        );
    }

    const history = data.makeDistortionHistoryFrame(0.8, 18, 0.5);
    const normalizedHistory = distortion.normalizeDistortionHistoryMessage(history);
    assert.notEqual(normalizedHistory, null, "history frame passes the real normalizer");

    // Engine shaper truth: a HARD knee (higher exponent) clips late — hot
    // input rides closer to the unity ceiling; a soft knee compresses early.
    const soft = data.makeDistortionScopeFrame(0.8, 30, 0.1);
    const hard = data.makeDistortionScopeFrame(0.8, 30, 1.0);
    assert.equal(hard.outputPeak >= soft.outputPeak - 1e-9, true, "hard knee clips later than soft");
    assert.equal(hard.outputPeak <= 1.02, true, "hard knee saturates at the unity ceiling");
});

test("the filter drag wires the hand-tuned sigmoid, not the linear trap", async () => {
    const filterEnergy = await filterEnergyPromise;
    const plotRect = { left: 18, top: 16, width: 336, height: 204 };

    // Sigmoid center 0.84: at half drag height Q must stay FAR below the
    // linear midpoint (~10) — the fine-control lower travel Andrew tuned.
    const midDrag = filterEnergy.resolveFilterDragValues({
        plotX: plotRect.left + plotRect.width / 2,
        plotY: plotRect.top + plotRect.height / 2,
        plotRect,
    });
    assert.equal(midDrag.q < 2, true, `mid travel must be gentle (got Q ${midDrag.q})`);

    // Roundtrip: values → handle position → values, within a pixel of drag.
    fc.assert(
        fc.property(
            fc.double({ min: 0.02, max: 0.98, noNaN: true }),
            fc.double({ min: 0.02, max: 0.98, noNaN: true }),
            (x, y) => {
                const dragged = filterEnergy.resolveFilterDragValues({
                    plotX: plotRect.left + plotRect.width * x,
                    plotY: plotRect.top + plotRect.height * y,
                    plotRect,
                });
                const handle = filterEnergy.handlePositionForValues({ ...dragged, plotRect });
                assert.ok(Math.abs(handle.plotX - (plotRect.left + plotRect.width * x)) < 1, "x roundtrip");
                assert.ok(Math.abs(handle.plotY - (plotRect.top + plotRect.height * y)) < 1, "y roundtrip");
            },
        ),
    );
});
