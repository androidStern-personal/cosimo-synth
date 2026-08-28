import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Polish meter messages accept only finite direct or Cmajor event frames", async () => {
    const meter = await loadUIModule(repoRoot, "ui/shared/polish.ts");
    const frame = { peakDbfs: -2.4, loudnessDbfs: -13.2 };

    assert.deepEqual(meter.normalizePolishMeterMessage(frame), frame);
    assert.deepEqual(meter.normalizePolishMeterMessage({ event: frame }), frame);
    for (const malformed of [
        null,
        {},
        { peakDbfs: -2.4 },
        { peakDbfs: Number.NaN, loudnessDbfs: -13.2 },
        { event: { peakDbfs: -2.4, loudnessDbfs: Number.POSITIVE_INFINITY } },
    ]) {
        assert.equal(meter.normalizePolishMeterMessage(malformed), null);
    }
});

test("the compact peak display writes higher peaks immediately, holds one second, then falls at 24 dB per second", async () => {
    const meter = await loadUIModule(repoRoot, "ui/shared/polish.ts");
    let state = meter.createPolishPeakDisplayState({ peakDbfs: -20, loudnessDbfs: -30 }, 0);

    state = meter.advancePolishPeakDisplay(state, { peakDbfs: -6, loudnessDbfs: -18 }, 100);
    assert.deepEqual(state, { peakDbfs: -6, heldUntilMs: 1_100, updatedAtMs: 100 });

    state = meter.advancePolishPeakDisplay(state, { peakDbfs: -40, loudnessDbfs: -40 }, 1_000);
    assert.equal(state.peakDbfs, -6);

    state = meter.advancePolishPeakDisplay(state, { peakDbfs: -40, loudnessDbfs: -40 }, 1_200);
    assert.ok(Math.abs(state.peakDbfs - (-8.4)) < 1e-9);

    state = meter.advancePolishPeakDisplay(state, { peakDbfs: -2, loudnessDbfs: -14 }, 1_300);
    assert.deepEqual(state, { peakDbfs: -2, heldUntilMs: 2_300, updatedAtMs: 1_300 });

    state = meter.advancePolishPeakDisplay(state, { peakDbfs: -40, loudnessDbfs: -40 }, 2_500);
    assert.ok(Math.abs(state.peakDbfs - (-6.8)) < 1e-9);
});

test("compact Polish P and L readouts remain fixed-width bounded strings", async () => {
    const meter = await loadUIModule(repoRoot, "ui/shared/polish.ts");

    assert.equal(meter.formatPolishPeakDbfs(-120), "-120");
    assert.equal(meter.formatPolishPeakDbfs(-3.24), "-3.2");
    assert.equal(meter.formatPolishPeakDbfs(0.01), "0.0");
    assert.equal(meter.formatPolishPeakDbfs(120), ">99");
    assert.equal(meter.formatPolishLoudnessDbfs(-120), "-120");
    assert.equal(meter.formatPolishLoudnessDbfs(-16.6), "-17");
    assert.equal(meter.formatPolishLoudnessDbfs(120), ">99");
});
