import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crusherModule = await loadUIModule(repoRoot, "fx/seqfx/view/crusher-preview.ts");

const { sampleCrusherPreview } = crusherModule;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function quantizeLikeSeqFxCrusher(sample, levels) {
    const scaled = sample * levels;
    return scaled >= 0
        ? Math.floor(scaled + 0.5) / levels
        : -Math.floor(-scaled + 0.5) / levels;
}

function expectedOriginalSamples({ bits, rateHz, driveDb, mix, pointCount }) {
    const driveGain = 10 ** (driveDb / 20);
    const levels = (2 ** (bits - 1)) - 1;
    const holdFrames = clamp(Math.round(48_000 / rateHz), 1, 256);
    const samples = [];
    let heldSample = 0;
    let holdCounter = 0;
    let needsRecapture = true;

    for (let index = 0; index < pointCount; index += 1) {
        const phase = index / (pointCount - 1);
        const dry = Math.sin(Math.PI * 2 * phase);
        const legacyDriven = clamp(dry, -1, 1) * driveGain;
        const legacyClipped = clamp(legacyDriven, -1, 1);

        if (needsRecapture || holdCounter <= 0) {
            heldSample = legacyClipped;
            needsRecapture = false;
            holdCounter = holdFrames;
        }

        holdCounter -= 1;
        const crushed = quantizeLikeSeqFxCrusher(heldSample, levels);
        samples.push({ phase, dry, wet: dry + ((crushed - dry) * mix) });
    }

    return samples;
}

function assertClose(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${actual} to be within ${tolerance} of ${expected}`,
    );
}

test("crusher_preview_original_matches_the_shipped_48khz_hold_oracle", () => {
    const input = {
        bits: 4,
        rateHz: 24_000,
        driveDb: 0,
        character: 0,
        adcQuality: 0,
        dacQuality: 0,
        dither: 0,
        mix: 0.25,
        pointCount: 9,
    };
    const preview = sampleCrusherPreview(input);
    const expected = expectedOriginalSamples(input);

    assert.deepEqual(
        preview.captureMarkerPhases.map((phase) => Number(phase.toFixed(3))),
        [0.25, 0.5, 0.75, 1],
    );
    for (const [index, sample] of preview.samples.entries()) {
        assertClose(sample.dry, expected[index].dry, 1e-12, `dry sample ${index}`);
        assertClose(sample.wet, expected[index].wet, 1e-12, `wet sample ${index}`);
    }
});

test("crusher_preview_clamps_to_the_v2_parameter_ranges", () => {
    const preview = sampleCrusherPreview({
        bits: 1,
        rateHz: 100_000,
        driveDb: 40,
        character: 99,
        adcQuality: -1,
        dacQuality: 2,
        dither: -1,
        mix: 2,
        pointCount: 1,
    });

    assert.equal(preview.samples.length, 2);
    assert.ok(preview.samples.every((sample) => Number.isFinite(sample.wet)));
    assert.ok(preview.samples.every((sample) => Math.abs(sample.wet) <= 1.2));
});

test("crusher_preview_character_modes_are_distinct_and_dither_is_deterministic", () => {
    const common = {
        bits: 4,
        rateHz: 2_000,
        driveDb: 9,
        adcQuality: 0.35,
        dacQuality: 0.4,
        dither: 1,
        mix: 1,
        pointCount: 241,
    };
    const renders = [0, 1, 2, 3].map((character) => sampleCrusherPreview({ ...common, character }));
    const signatures = renders.map((render) => render.samples.map((sample) => sample.wet.toFixed(6)).join(","));

    assert.equal(new Set(signatures).size, 4);
    assert.deepEqual(
        sampleCrusherPreview({ ...common, character: 2 }),
        sampleCrusherPreview({ ...common, character: 2 }),
        "the visual preview must not flicker between renders",
    );
    assert.ok(renders[2].samples.every((sample) => Number.isFinite(sample.wet)));
    assert.ok(renders[3].samples.every((sample) => Math.abs(sample.wet) <= 1.2));
});
