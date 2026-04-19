import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crusherModule = await loadUIModule(repoRoot, "fx/seqfx/view/crusher-preview.ts");

const {
    sampleCrusherPreview,
} = crusherModule;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function quantizeLikeSeqFxCrusher(sample, levels) {
    const scaled = sample * levels;
    if (scaled >= 0) {
        return Math.floor(scaled + 0.5) / levels;
    }

    return -Math.floor(-scaled + 0.5) / levels;
}

function expectedCmajorCrusherSamples({ bits, holdFrames, driveDb, mix, pointCount }) {
    const driveGain = 10 ** (driveDb / 20);
    const levels = (2 ** (bits - 1)) - 1;
    const samples = [];
    let heldSample = 0;
    let holdCounter = 0;
    let needsRecapture = true;

    for (let index = 0; index < pointCount; index += 1) {
        const phase = index / (pointCount - 1);
        const dry = Math.sin(Math.PI * 2 * phase);
        const clipped = clamp(clamp(dry, -1, 1) * driveGain, -1, 1);

        if (needsRecapture || holdCounter <= 0) {
            heldSample = clipped;
            needsRecapture = false;
            holdCounter = holdFrames;
        }

        holdCounter -= 1;

        const crushed = quantizeLikeSeqFxCrusher(heldSample, levels);
        const wet = dry + ((crushed - dry) * mix);
        samples.push({ phase, dry, wet });
    }

    return samples;
}

function assertClose(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${actual} to be within ${tolerance} of ${expected}`,
    );
}

test("crusher_preview_matches_cmajor_hold_clip_quantize_and_mix_math", () => {
    const input = {
        bits: 4,
        holdFrames: 2,
        driveDb: 0,
        mix: 0.25,
        pointCount: 9,
    };
    const preview = sampleCrusherPreview(input);
    const expected = expectedCmajorCrusherSamples(input);

    assert.deepEqual(
        preview.samples.map((sample) => Number(sample.phase.toFixed(3))),
        expected.map((sample) => Number(sample.phase.toFixed(3))),
    );
    assert.deepEqual(
        preview.holdMarkerPhases.map((phase) => Number(phase.toFixed(3))),
        [0.25, 0.5, 0.75, 1],
    );

    for (const [index, sample] of preview.samples.entries()) {
        assertClose(sample.dry, expected[index].dry, 1e-12, `dry sample ${index}`);
        assertClose(sample.wet, expected[index].wet, 1e-12, `wet sample ${index}`);
    }
});

test("crusher_preview_clamps_to_cmajor_parameter_ranges", () => {
    const preview = sampleCrusherPreview({
        bits: 3,
        holdFrames: 0,
        driveDb: 40,
        mix: 2,
        pointCount: 1,
    });
    const expected = expectedCmajorCrusherSamples({
        bits: 4,
        holdFrames: 1,
        driveDb: 36,
        mix: 1,
        pointCount: 2,
    });

    assert.equal(preview.samples.length, 2);
    for (const [index, sample] of preview.samples.entries()) {
        assertClose(sample.wet, expected[index].wet, 1e-12, `clamped wet sample ${index}`);
    }
});
