import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decodeFloat32Wav, encodeFloat32Wav, sha256 } from "../reference_labs/polish_comp_clip/lib/audio.mjs";
import { generateCorpus } from "../reference_labs/polish_comp_clip/lib/corpus.mjs";
import { decodedSettings, mappingBySuffix } from "../reference_labs/polish_comp_clip/lib/fixture-settings.mjs";
import {
    effectiveSettingsAtMacro,
    evaluateTransferCurve,
    processReference,
} from "../reference_labs/polish_comp_clip/lib/reference-dsp.mjs";
import { decodeEvidenceDouble } from "../reference_labs/polish_comp_clip/lib/source-extractor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const labRoot = path.join(repoRoot, "reference_labs", "polish_comp_clip");

async function readJson(relativePath) {
    return JSON.parse(await fs.readFile(path.join(labRoot, relativePath), "utf8"));
}

function collectDoubleEvidence(value, output = []) {
    if (!value || typeof value !== "object") return output;
    if (typeof value.ieee754Hex === "string") output.push(value);
    for (const child of Object.values(value)) collectDoubleEvidence(child, output);
    return output;
}

test("the pinned source and every decoded IEEE-754 fixture retain extraction evidence", async () => {
    const source = await readJson("fixtures/source-artifact.json");
    assert.equal(source.commit, "3852ef80ec3f97d93c6a7880c167b64a454ae961");
    assert.equal(source.sha256, "603fb6d28b1664cf352b5bb7eef288c3093c17a230ac5d63cea70916cfe2749b");
    assert.equal(source.byteLength, 24_551);
    assert.equal(source.containerHeaderAscii, "BtWg0003000200");
    assert.equal(source.embeddedZipOffset, 18_625);

    const evidence = collectDoubleEvidence(decodedSettings.decodedPresetFacts);
    assert.equal(evidence.length, 41);
    for (const item of evidence) {
        assert.equal(decodeEvidenceDouble(item.ieee754Hex), item.value);
        assert.ok(item.recordHex.endsWith(item.ieee754Hex));
        assert.ok(Number.isInteger(item.recordOffset));
        assert.ok(Number.isInteger(item.valueOffset));
        assert.ok(item.recordOffset < item.valueOffset);
    }
});

test("decoded compressor, trims, curve knots, and source macro records stay exact", () => {
    const facts = decodedSettings.decodedPresetFacts;
    const derived = decodedSettings.cosimoDerivedValues;
    assert.equal(facts.inputToolVolume.ieee754Hex, "3feef78d442146be");
    assert.equal(facts.inputToolVolume.value, 0.967718728128794);
    assert.equal(derived.inputToolGainDb, -0.2850170805322976);
    assert.equal(facts.outputToolVolume.ieee754Hex, "3ff04f5a92884587");
    assert.equal(facts.outputToolVolume.value, 1.0193734859388728);
    assert.equal(derived.outputToolGainDb, 0.16666666666666702);

    assert.equal(facts.compressor.HIGH_THRESHOLD.value, 0);
    assert.equal(facts.compressor.HIGH_KNEE.value, 0);
    assert.equal(facts.compressor.HIGH_RATIO.value, 0.9124000000000048);
    assert.equal(facts.compressor.ATTACK.value, -3.6879999999999997);
    assert.equal(facts.compressor.RELEASE.value, -1.5720000000000016);
    assert.equal(facts.compressor.OUTPUT_GAIN.value, -0.04000000000000409);
    assert.equal(derived.compressorAttackSeconds, 0.00020511621788255668);
    assert.equal(derived.compressorReleaseSeconds, 0.02679168324819022);
    assert.equal(derived.compressorRatioFromStoredSlope, 11.415525114155871);

    assert.deepEqual(
        facts.curve.points.map((point) => [point.input.value, point.output.value, point.tension.value]),
        [
            [0, 0, 0],
            [0.799438202247191, 0.7176422093981863, 0.42000000000000004],
            [0.9272997032640949, 0.8935926773455377, 0],
            [0.9362017804154302, 1, -0.7200000000000001],
        ],
    );
    assert.equal(facts.curve.drive.value, -0.01920000000000002);

    const input = mappingBySuffix("/AMPLITUDE");
    const makeup = mappingBySuffix("/OUTPUT_GAIN");
    const ratio = mappingBySuffix("/HIGH_RATIO");
    assert.deepEqual(
        [input.parameterMinimum.value, input.parameterMaximum.value, input.mappedAmount.value],
        [-36, 36, 35.971200000000394],
    );
    assert.deepEqual(
        [makeup.parameterMinimum.value, makeup.parameterMaximum.value, makeup.rawControlQuantum.value, makeup.mappedAmount.value],
        [-36, 36, 0.1, 4.120000000000003],
    );
    assert.deepEqual(
        [ratio.parameterMinimum.value, ratio.parameterMaximum.value, ratio.rawControlQuantum.value, ratio.mappedAmount.value],
        [-1, 1, 0.005, -0.025200000000000014],
    );
});

test("the transparent transfer evaluator stays pinned at knots, plateau, and sampled points", async () => {
    const fixture = await readJson("fixtures/transfer-samples.json");
    for (const sample of fixture.samples) {
        assert.equal(evaluateTransferCurve(sample.input), sample.output);
        if (sample.input !== 0) assert.equal(evaluateTransferCurve(-sample.input), -sample.output);
    }

    for (const point of decodedSettings.decodedPresetFacts.curve.points) {
        assert.equal(evaluateTransferCurve(point.input.value), point.output.value);
    }
    assert.equal(evaluateTransferCurve(1_000), 1);
    assert.equal(evaluateTransferCurve(-1_000), -1);

    let previous = evaluateTransferCurve(0);
    for (let step = 1; step <= 10_000; step += 1) {
        const current = evaluateTransferCurve(step / 10_000);
        assert.ok(current >= previous, `transfer curve fell at ${step / 10_000}`);
        previous = current;
    }
});

test("the source macro drives the retained gain amounts and the documented limiting direction", () => {
    const zero = effectiveSettingsAtMacro(0);
    const half = effectiveSettingsAtMacro(0.5);
    const full = effectiveSettingsAtMacro(1);
    assert.equal(zero.inputGainDb, -0.2850170805322976);
    assert.equal(zero.compressorMakeupDb, -0.04000000000000409);
    assert.equal(zero.compressorRatio, 11.415525114155871);
    assert.deepEqual(zero.decodedMacroDeltas, {
        inputAmplitudeDb: 0,
        compressorOutputGainDb: 0,
        highRatioNormalized: -0,
    });
    assert.equal(half.inputGainDb, 17.700582919467898);
    assert.equal(half.compressorMakeupDb, 2.0199999999999974);
    assert.equal(half.compressorRatio, 22.831050228311742);
    assert.deepEqual(half.decodedMacroDeltas, {
        inputAmplitudeDb: 17.985600000000197,
        compressorOutputGainDb: 2.0600000000000014,
        highRatioNormalized: -0.012600000000000007,
    });
    assert.equal(full.inputGainDb, 35.686182919468095);
    assert.equal(full.compressorMakeupDb, 4.079999999999998);
    assert.equal(full.compressorRatio, Number.POSITIVE_INFINITY);
    assert.equal(full.decodedRatioMappingAmount, -0.025200000000000014);
    assert.deepEqual(full.decodedMacroDeltas, {
        inputAmplitudeDb: 35.971200000000394,
        compressorOutputGainDb: 4.120000000000003,
        highRatioNormalized: -0.025200000000000014,
    });
});

test("the inferred renderer is sample-deterministic and stereo linked", () => {
    const corpus = generateCorpus().find(({ id }) => id === "drum-bus");
    const first = processReference(corpus.channels, 48_000, 0.5);
    const second = processReference(corpus.channels, 48_000, 0.5);
    const firstWav = encodeFloat32Wav(first.channels, 48_000);
    const secondWav = encodeFloat32Wav(second.channels, 48_000);
    assert.ok(firstWav.equals(secondWav));
    assert.equal(first.telemetry.nonFiniteSamples, 0);
    assert.ok(first.telemetry.maximumGainReductionDb > 10);
    assert.equal(first.telemetry.attackCoefficient, second.telemetry.attackCoefficient);
    assert.equal(first.telemetry.releaseCoefficient, second.telemetry.releaseCoefficient);

    const quiet = Float32Array.from({ length: 4_096 }, (_, frame) => 0.01 * Math.sin(2 * Math.PI * frame / 97));
    const loudLeft = Float32Array.from(quiet);
    loudLeft[1_000] = 0.9;
    const linked = processReference([loudLeft, quiet], 48_000, 0.5).channels[1];
    const quietOnly = processReference([quiet, quiet], 48_000, 0.5).channels[1];
    assert.ok(Math.abs(linked[1_001]) < Math.abs(quietOnly[1_001]));
});

test("the retained corpus, renders, hashes, and level matches form a complete comparison bundle", async () => {
    const manifest = await readJson("bundle-manifest.json");
    const measurements = await readJson("measurements.json");
    assert.equal(manifest.artifacts.length, 21);
    assert.deepEqual([...new Set(measurements.rows.map(({ corpusId }) => corpusId))].sort(), [
        "bass-sequence",
        "bright-poly",
        "drum-bus",
    ]);
    assert.deepEqual([...new Set(measurements.rows.map(({ macro }) => macro))].sort(), [0, 0.5, 1]);
    assert.equal(measurements.rows.length, 9);

    for (const artifact of manifest.artifacts) {
        const bytes = await fs.readFile(path.join(labRoot, artifact.path));
        assert.equal(bytes.length, artifact.byteLength);
        assert.equal(sha256(bytes), artifact.sha256);
        const wav = decodeFloat32Wav(bytes);
        assert.equal(wav.sampleRate, 48_000);
        assert.equal(wav.frameCount, 72_000);
        assert.equal(wav.channels.length, 2);
    }

    for (const row of measurements.rows) {
        assert.ok(Math.abs(row.levelMatch.rmsDeltaDb) < 2e-7);
        assert.equal(row.telemetry.nonFiniteSamples, 0);
        if (row.macro >= 0.5) {
            assert.ok(row.telemetry.maximumGainReductionDb > 0);
            assert.ok(row.telemetry.curvePlateauSampleFraction > 0);
        }
    }
});

async function walk(root) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) files.push(...await walk(absolute));
        else files.push(absolute);
    }
    return files;
}

test("the reference lab has no production import path in either direction", async () => {
    const productionRoots = ["ui", "fx", "patch_gui", "web", "ios_auv3"];
    for (const productionRoot of productionRoots) {
        const files = await walk(path.join(repoRoot, productionRoot));
        for (const file of files.filter((candidate) => /\.(?:cmajor|cmajorpatch|js|mjs|ts|tsx)$/.test(candidate))) {
            const source = await fs.readFile(file, "utf8");
            assert.ok(!source.includes("reference_labs/polish_comp_clip"), `${file} imports the T27 lab`);
        }
    }

    const labSources = (await walk(labRoot)).filter((candidate) => /\.mjs$/.test(candidate));
    for (const file of labSources) {
        const source = await fs.readFile(file, "utf8");
        assert.ok(!source.includes("../../ui/"));
        assert.ok(!source.includes("../../fx/"));
        assert.ok(!source.includes("../../patch_gui/"));
        assert.ok(!source.includes("../../web/"));
        assert.ok(!source.includes("WavetableSynth.cmajorpatch"));
    }
});
