#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFloat32Wav, levelMatch, measureAudio, sha256 } from "../lib/audio.mjs";
import { CORPUS_SPEC, generateCorpus } from "../lib/corpus.mjs";
import { decodedSettings } from "../lib/fixture-settings.mjs";
import {
    MODEL_ID,
    effectiveSettingsAtMacro,
    evaluateTransferCurve,
    processReference,
} from "../lib/reference-dsp.mjs";

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "--check";
if (mode !== "--check" && mode !== "--write") {
    throw new Error("usage: node render-reference.mjs [--check|--write]");
}

const measurementStartFrame = Math.round(CORPUS_SPEC.sampleRate * 0.1);
const macroLevels = [
    { id: "000", value: 0 },
    { id: "050", value: 0.5 },
    { id: "100", value: 1 },
];
const curveProbeInputs = [
    -1.2,
    -1,
    -0.9362017804154302,
    -0.93,
    -0.8,
    -0.5,
    0,
    0.25,
    0.5,
    0.75,
    0.799438202247191,
    0.85,
    0.9,
    0.9272997032640949,
    0.932,
    0.9362017804154302,
    0.94,
    1,
    1.2,
];

function relative(...segments) {
    return path.join(...segments);
}

function asSerializableSettings(settings) {
    return {
        ...settings,
        compressorRatio: Number.isFinite(settings.compressorRatio) ? settings.compressorRatio : "Infinity",
    };
}

function textArtifact(relativePath, value) {
    return { relativePath, data: Buffer.from(value, "utf8") };
}

function jsonArtifact(relativePath, value) {
    return textArtifact(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function csvNumber(value) {
    return Number.isFinite(value) ? value.toFixed(9) : String(value);
}

const binaryArtifacts = [];
const artifactRows = [];
const measurements = [];

for (const corpus of generateCorpus()) {
    const inputRelativePath = relative("corpus", `${corpus.id}.wav`);
    const inputWav = encodeFloat32Wav(corpus.channels, CORPUS_SPEC.sampleRate);
    const inputMeasurement = measureAudio(corpus.channels, measurementStartFrame);
    binaryArtifacts.push({ relativePath: inputRelativePath, data: inputWav });
    artifactRows.push({
        kind: "corpus-input",
        corpusId: corpus.id,
        macro: null,
        path: inputRelativePath,
        sha256: sha256(inputWav),
        byteLength: inputWav.length,
    });

    for (const macro of macroLevels) {
        const rendered = processReference(corpus.channels, CORPUS_SPEC.sampleRate, macro.value);
        assert.equal(rendered.telemetry.nonFiniteSamples, 0, `${corpus.id} macro ${macro.value} produced non-finite audio`);
        const matched = levelMatch(corpus.channels, rendered.channels, measurementStartFrame);
        const rawMeasurement = measureAudio(rendered.channels, measurementStartFrame);
        const matchedMeasurement = measureAudio(matched.channels, measurementStartFrame);
        const rawRelativePath = relative("renders", "raw", `${corpus.id}--macro-${macro.id}.wav`);
        const matchedRelativePath = relative(
            "renders",
            "level-matched",
            `${corpus.id}--macro-${macro.id}.wav`,
        );
        const rawWav = encodeFloat32Wav(rendered.channels, CORPUS_SPEC.sampleRate);
        const matchedWav = encodeFloat32Wav(matched.channels, CORPUS_SPEC.sampleRate);
        binaryArtifacts.push(
            { relativePath: rawRelativePath, data: rawWav },
            { relativePath: matchedRelativePath, data: matchedWav },
        );
        artifactRows.push(
            {
                kind: "raw-render",
                corpusId: corpus.id,
                macro: macro.value,
                path: rawRelativePath,
                sha256: sha256(rawWav),
                byteLength: rawWav.length,
            },
            {
                kind: "level-matched-render",
                corpusId: corpus.id,
                macro: macro.value,
                path: matchedRelativePath,
                sha256: sha256(matchedWav),
                byteLength: matchedWav.length,
            },
        );
        measurements.push({
            corpusId: corpus.id,
            corpusDescription: corpus.description,
            macro: macro.value,
            effectiveSettings: asSerializableSettings(rendered.effectiveSettings),
            input: inputMeasurement,
            raw: rawMeasurement,
            levelMatch: {
                gain: matched.gain,
                gainDb: matched.gainDb,
                rmsDeltaDb: matched.rmsDeltaDb,
            },
            matched: matchedMeasurement,
            telemetry: rendered.telemetry,
            files: {
                input: inputRelativePath,
                raw: rawRelativePath,
                matched: matchedRelativePath,
            },
        });
    }
}

const curveFixture = {
    schema: "cosimo.polishCompClip.transferSamples.v1",
    evaluator: MODEL_ID,
    interpolationProvenance: "cosimo-inference-monotonic-cubic-perturbation",
    samples: curveProbeInputs.map((input) => ({ input, output: evaluateTransferCurve(input) })),
};

const bundleManifest = {
    schema: "cosimo.polishCompClip.referenceBundle.v1",
    model: MODEL_ID,
    sourcePreset: decodedSettings.source,
    corpus: CORPUS_SPEC,
    measurementWindow: {
        startFrame: measurementStartFrame,
        startSeconds: measurementStartFrame / CORPUS_SPEC.sampleRate,
        endFrame: CORPUS_SPEC.frameCount,
    },
    macroLevels: macroLevels.map(({ value }) => ({
        value,
        effectiveSettings: asSerializableSettings(effectiveSettingsAtMacro(value)),
    })),
    levelMatching: "one constant stereo-linked gain matching unweighted integrated RMS over the measurement window",
    artifacts: artifactRows,
};

const measurementReport = {
    schema: "cosimo.polishCompClip.measurements.v1",
    model: MODEL_ID,
    sourcePreset: decodedSettings.source,
    provenanceBoundary: {
        decoded: "Stored values, target paths, ranges, map amounts, and transfer knots come from the pinned third-party preset.",
        inferred: "Detector/envelope law, ratio interpolation, odd symmetry, and inter-knot tension interpolation are transparent Cosimo lab choices.",
        notEstablished: "These renders are not a null, behavioral clone, or measurement of the closed-source original or Bitwig's proprietary DSP.",
    },
    definitions: {
        levelMatch: bundleManifest.levelMatching,
        peak: "maximum absolute sample; no true-peak oversampling",
        crest: "20 log10(sample peak / unweighted RMS)",
        curveFractions: "fraction of channel samples entering the decoded knee or plateau domains before output gain",
    },
    rows: measurements,
};

const csvHeader = [
    "corpus",
    "macro",
    "input_rms_dbfs",
    "raw_rms_dbfs",
    "raw_peak_dbfs",
    "raw_crest_db",
    "match_gain_db",
    "matched_rms_delta_db",
    "matched_peak_dbfs",
    "max_gain_reduction_db",
    "p95_gain_reduction_db",
    "curve_knee_fraction",
    "curve_plateau_fraction",
    "raw_over_full_scale_fraction",
].join(",");
const csvRows = measurements.map((row) => [
    row.corpusId,
    row.macro.toFixed(2),
    csvNumber(row.input.rmsDbfs),
    csvNumber(row.raw.rmsDbfs),
    csvNumber(row.raw.samplePeakDbfs),
    csvNumber(row.raw.crestDb),
    csvNumber(row.levelMatch.gainDb),
    csvNumber(row.levelMatch.rmsDeltaDb),
    csvNumber(row.matched.samplePeakDbfs),
    csvNumber(row.telemetry.maximumGainReductionDb),
    csvNumber(row.telemetry.p95GainReductionDb),
    csvNumber(row.telemetry.curveKneeSampleFraction),
    csvNumber(row.telemetry.curvePlateauSampleFraction),
    csvNumber(row.telemetry.overFullScaleSampleFraction),
].join(","));

const allArtifacts = [
    ...binaryArtifacts,
    jsonArtifact(relative("fixtures", "transfer-samples.json"), curveFixture),
    jsonArtifact("bundle-manifest.json", bundleManifest),
    jsonArtifact("measurements.json", measurementReport),
    textArtifact("measurements.csv", `${csvHeader}\n${csvRows.join("\n")}\n`),
];

for (const artifact of allArtifacts) {
    const absolutePath = path.join(labRoot, artifact.relativePath);
    if (mode === "--write") {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, artifact.data);
    } else {
        const retained = await fs.readFile(absolutePath);
        assert.ok(
            retained.equals(artifact.data),
            `${artifact.relativePath} differs from a deterministic regeneration`,
        );
    }
}

const worstMatch = Math.max(...measurements.map((row) => Math.abs(row.levelMatch.rmsDeltaDb)));
process.stdout.write(
    `T27 reference bundle ${mode === "--write" ? "written" : "verified"}: `
    + `${artifactRows.length} WAV files, ${measurements.length} comparisons, `
    + `worst RMS match ${worstMatch.toExponential(3)} dB\n`,
);
