// The distortion's classic dry/wet blend must mix time-aligned signals.
//
// The wet path crosses the 4x oversampling boundary, whose resampler pair
// carries a ~6-sample round trip at 48 kHz. Blending that against an
// un-delayed dry copy cancels wherever the two are opposite - a -25 dB notch
// at 4 kHz and another at 12 kHz at 50% wet, audible as a lowpass the moment
// the device is enabled, even with no shaping happening at all. The bus now
// routes the untouched input across the same boundary (dryThru) and blends
// against that aligned copy, so these probes pin the blend flat.
//
// Drives the production wt::DistortionBus through the T25 calibration patch,
// generated with the repo's own codegen.

import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_RATE = 48_000;
const BLOCK_FRAMES = 128;
const SETTLE_FRAMES = Math.round(SAMPLE_RATE * 0.3);
const MEASURE_FRAMES = Math.round(SAMPLE_RATE * 0.5);
const TOTAL_FRAMES = SETTLE_FRAMES + MEASURE_FRAMES;

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-distortion-alignment-"));
const runtimePath = path.join(temporaryDirectory, "distortion-runtime.mjs");

const generated = spawnSync(
    path.join(repoRoot, "scripts/generate_cmajor_javascript_with_externals.sh"),
    [
        path.join(repoRoot, "tools/distortion_calibration/DistortionCalibration.cmajorpatch"),
        runtimePath,
        "DistortionCalibration",
    ],
    { cwd: repoRoot, encoding: "utf8" },
);
if (generated.error) throw generated.error;
if (generated.status !== 0) {
    throw new Error(`codegen failed (${generated.status}):\n${generated.stderr || generated.stdout}`);
}
const runtimeSource = await fs.readFile(runtimePath, "utf8");
const className = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(runtimeSource)?.[1];
assert.ok(className, "generated distortion runtime has no class");
await fs.writeFile(runtimePath, `${runtimeSource}\nexport default ${className};\n`, "utf8");
const { default: RuntimeClass } = await import(pathToFileURL(runtimePath).href);

let nextSessionID = 26_083_000;

async function render(fixture, {
    type = 1,
    driveDb = 12,
    knee = 0.35,
    wet = 0.5,
    mode = 0,
    wetHPHz = 40,
    wetLPHz = 18_000,
    sampleRate = SAMPLE_RATE,
} = {}) {
    const performer = new RuntimeClass();
    await performer.initialise(nextSessionID, sampleRate);
    nextSessionID += 1;
    performer.setInputValue_type(type, 0);
    performer.setInputValue_driveDb(driveDb, 0);
    performer.setInputValue_knee(knee, 0);
    performer.setInputValue_wet(wet, 0);
    performer.setInputValue_mode(mode, 0);
    performer.setInputValue_wetHPHz(wetHPHz, 0);
    performer.setInputValue_wetLPHz(wetLPHz, 0);
    performer.setInputValue_calibrationBypass(0, 0);

    const output = new Float32Array(fixture.length);
    for (let offset = 0; offset < fixture.length; offset += BLOCK_FRAMES) {
        const frameCount = Math.min(BLOCK_FRAMES, fixture.length - offset);
        const block = fixture.subarray(offset, offset + frameCount);
        performer.setInputStreamFrames_audioIn([block, block], frameCount, 0);
        performer.advance(frameCount);
        const outputBlock = new Float32Array(frameCount);
        performer.getOutputFrames_wetOut([outputBlock], frameCount, 0);
        output.set(outputBlock, offset);
    }
    for (const sample of output) {
        assert.ok(Number.isFinite(sample), "distortion produced non-finite output");
    }
    return output;
}

function makeSine(frequencyHz, peak) {
    return Float32Array.from({ length: TOTAL_FRAMES }, (_, frame) => (
        peak * Math.sin((2 * Math.PI * frequencyHz * frame) / SAMPLE_RATE)
    ));
}

function makePink(rmsDbfs) {
    let state = 0x260830;
    const random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    };
    const samples = new Float32Array(TOTAL_FRAMES);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let frame = -SETTLE_FRAMES; frame < samples.length; frame += 1) {
        const white = random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        if (frame >= 0) samples[frame] = pink;
    }
    let power = 0;
    for (let frame = SETTLE_FRAMES; frame < samples.length; frame += 1) power += samples[frame] ** 2;
    const rms = Math.sqrt(power / MEASURE_FRAMES);
    const target = 10 ** (rmsDbfs / 20);
    return Float32Array.from(samples, (sample) => (sample * target) / Math.max(rms, 1e-15));
}

function measuredRms(samples) {
    let power = 0;
    for (let frame = SETTLE_FRAMES; frame < SETTLE_FRAMES + MEASURE_FRAMES; frame += 1) {
        power += samples[frame] ** 2;
    }
    return Math.sqrt(power / MEASURE_FRAMES);
}

function levelChangeDb(fixture, output) {
    return 20 * Math.log10(measuredRms(output) / Math.max(measuredRms(fixture), 1e-15));
}

test("50% wet does not carve the oversampler comb into the blend", async () => {
    // The probes sit on the un-aligned blend's cancellation nulls
    // (fs / (2 * ~5.9 samples) and three times that); an aligned blend
    // keeps both near unity, an un-aligned one fails them by many dB.
    for (const frequencyHz of [4_075, 12_225]) {
        const fixture = makeSine(frequencyHz, 0.1);
        const change = levelChangeDb(fixture, await render(fixture, { wet: 0.5, driveDb: 12 }));
        assert.ok(
            Math.abs(change) <= 2,
            `${frequencyHz} Hz at 50% wet changed by ${change.toFixed(2)} dB (limit 2 dB)`,
        );
    }
});

test("zero drive plus blend is transparent - no shaping means no coloration", async () => {
    const fixture = makeSine(4_075, 0.1);
    const change = levelChangeDb(fixture, await render(fixture, {
        driveDb: 0, wet: 0.5, wetHPHz: 20, wetLPHz: 20_000,
    }));
    assert.ok(
        Math.abs(change) <= 1,
        `4075 Hz at drive 0, 50% wet changed by ${change.toFixed(2)} dB (limit 1 dB)`,
    );
});

test("the ends of the wet knob hold their level promise", async () => {
    const fixture = makeSine(4_000, 0.1);
    for (const wet of [0.01, 1.0]) {
        const change = levelChangeDb(fixture, await render(fixture, { wet, driveDb: 12 }));
        assert.ok(
            Math.abs(change) <= 1.5,
            `4 kHz at wet ${wet} changed by ${change.toFixed(2)} dB (limit 1.5 dB)`,
        );
    }
});

test("wet 0 stays a bit-exact, latency-free bypass", async () => {
    const fixture = makePink(-18);
    const output = await render(fixture, { wet: 0, driveDb: 36 });
    for (let frame = 0; frame < fixture.length; frame += 1) {
        if (output[frame] !== fixture[frame]) {
            assert.fail(`wet 0 output diverged from input at frame ${frame}`);
        }
    }
});

test("broadband level match still holds at the default blend", async () => {
    const fixture = makePink(-18);
    for (const [settings, limitDb] of [
        [{ wet: 0.5, driveDb: 12 }, 1.5],
        [{ wet: 1.0, driveDb: 12 }, 1.0],
        // Same budget the 44.1 kHz cmajtest mix grid enforces.
        [{ wet: 0.5, driveDb: 12, sampleRate: 44_100 }, 1.0],
        [{ wet: 0.75, driveDb: 24, sampleRate: 44_100 }, 1.0],
    ]) {
        const change = levelChangeDb(fixture, await render(fixture, settings));
        assert.ok(
            Math.abs(change) <= limitDb,
            `pink noise at wet ${settings.wet} changed by ${change.toFixed(2)} dB (limit ${limitDb} dB)`,
        );
    }
});
