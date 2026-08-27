import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    readFloatWave,
    verifySpectreShelfAudio,
} from "./enhancer_lite_shelf_corpus.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkpoint = "2a652a4035519be1fbe12de9a8c6487ed736e3c5";
const spectreDirectory = path.join(repoRoot, "build/t26-spectre-shelves");
const spectreMeasurementsPath = path.join(spectreDirectory, "measurements.json");
const spectreReportPath = path.join(spectreDirectory, "report.json");
const spectreFixturePath = path.join(
    repoRoot,
    "tests/fixtures/enhancer_spectre_shelves_v1.json",
);
const reviewDirectory = path.join(repoRoot, "build/enhancer-lite-shelf-review");
const reportPath = path.join(reviewDirectory, "report.json");
const requestedMode = process.argv[2] ?? "--check";
const expectedSpectreHashes = Object.freeze({
    report: "17e56c3b5fcb0ab1eb300c4934f6aae593982dafb531c740e9055685e7663c83",
    measurements: "fe9e29bfc7f0f937447ba959aea30305471f061970577f813a49e4ef774661aa",
});

if (!["--check", "--report", "--verify-corpus"].includes(requestedMode)) {
    throw new Error(
        "usage: measure_enhancer_lite_shelves.mjs [--check|--report|--verify-corpus]",
    );
}

const currentPatchPath = path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajorpatch");
const acceptedPatchPath = path.join(repoRoot, "tools/enhancer_calibration/EnhancerCalibration.cmajorpatch");

const currentDefaults = Object.freeze({
    freqHzIn: 130,
    qIn: 0.71,
    modeIn: 0,
    midAmountIn: 0,
    sideAmountIn: 0,
    curveIn: 1,
    saturationModeIn: 0,
    shapeIn: 1,
});

const checkpointDefaults = Object.freeze(
    Object.fromEntries(Object.entries(currentDefaults).filter(([id]) => id !== "shapeIn")),
);

const acceptedDefaults = Object.freeze({
    b1FreqHzIn: 130,
    b1QIn: 0.71,
    b1ModeIn: 0,
    b1MidAmountIn: 0,
    b1SideAmountIn: 0,
    b1CurveIn: 1,
    b2FreqHzIn: 9000,
    b2QIn: 0.71,
    b2ModeIn: 0,
    b2MidAmountIn: 0,
    b2SideAmountIn: 0,
    b2CurveIn: 0,
    saturationModeIn: 0,
    deEmphasisIn: 0,
});

const latencySamples = Object.freeze({
    checkpointLite: 3,
    shelfLite: 3,
    acceptedEnhancer: 60,
    spectreGood: 60,
});

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        throw new Error(`${command} failed (${result.status}):\n${result.stderr || result.stdout}`);
    return result.stdout;
}

function gitShow(repoPath) {
    return run("git", ["show", `${checkpoint}:${repoPath}`]);
}

function parsePythonJson(text) {
    return JSON.parse(
        text
            .replace(/\bNaN\b/g, "null")
            .replace(/\b-Infinity\b/g, "-1e999")
            .replace(/\bInfinity\b/g, "1e999"),
    );
}

function sha256(contents) {
    return createHash("sha256").update(contents).digest("hex");
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function dbRatio(value, reference) {
    return 20 * Math.log10(Math.max(value, 1e-30) / Math.max(reference, 1e-30));
}

function rms(stereo, startFrame = 0, frameCount = stereo.left.length - startFrame) {
    let power = 0;
    const endFrame = Math.min(stereo.left.length, startFrame + frameCount);
    for (let frame = startFrame; frame < endFrame; frame += 1)
        power += stereo.left[frame] ** 2 + stereo.right[frame] ** 2;
    return Math.sqrt(power / Math.max(1, (endFrame - startFrame) * 2));
}

function channelRms(channel, startFrame = 0, frameCount = channel.length - startFrame) {
    let power = 0;
    const endFrame = Math.min(channel.length, startFrame + frameCount);
    for (let frame = startFrame; frame < endFrame; frame += 1)
        power += channel[frame] ** 2;
    return Math.sqrt(power / Math.max(1, endFrame - startFrame));
}

function differenceRms(left, right, startFrame, frameCount, rightGain = 1) {
    let power = 0;
    const endFrame = Math.min(left.left.length, right.left.length, startFrame + frameCount);
    for (let frame = startFrame; frame < endFrame; frame += 1) {
        power += (left.left[frame] - right.left[frame] * rightGain) ** 2;
        power += (left.right[frame] - right.right[frame] * rightGain) ** 2;
    }
    return Math.sqrt(power / Math.max(1, (endFrame - startFrame) * 2));
}

function scaleStereo(stereo, gain) {
    return {
        left: Float32Array.from(stereo.left, (sample) => sample * gain),
        right: Float32Array.from(stereo.right, (sample) => sample * gain),
    };
}

function subtractStereo(wet, dry) {
    return {
        left: Float32Array.from(wet.left, (sample, index) => sample - dry.left[index]),
        right: Float32Array.from(wet.right, (sample, index) => sample - dry.right[index]),
    };
}

function latencyAligned(stereo, latency, length) {
    const frameCount = Math.max(0, Math.min(length, stereo.left.length - latency));
    return {
        left: stereo.left.slice(latency, latency + frameCount),
        right: stereo.right.slice(latency, latency + frameCount),
    };
}

function monoComponents(stereo) {
    return {
        mid: Float32Array.from(stereo.left, (sample, index) => 0.5 * (sample + stereo.right[index])),
        side: Float32Array.from(stereo.left, (sample, index) => 0.5 * (sample - stereo.right[index])),
    };
}

function correlation(left, right, startFrame, frameCount) {
    const endFrame = Math.min(left.left.length, right.left.length, startFrame + frameCount);
    let dot = 0;
    let leftPower = 0;
    let rightPower = 0;
    for (let frame = startFrame; frame < endFrame; frame += 1) {
        for (const channel of ["left", "right"]) {
            const a = left[channel][frame];
            const b = right[channel][frame];
            dot += a * b;
            leftPower += a * a;
            rightPower += b * b;
        }
    }
    return dot / Math.max(1e-30, Math.sqrt(leftPower * rightPower));
}

function complexTone(channel, sampleRate, frequencyHz, startFrame = 0, frameCount = channel.length - startFrame) {
    let real = 0;
    let imaginary = 0;
    const endFrame = Math.min(channel.length, startFrame + frameCount);
    for (let frame = startFrame; frame < endFrame; frame += 1) {
        const phase = 2 * Math.PI * frequencyHz * frame / sampleRate;
        real += channel[frame] * Math.cos(phase);
        imaginary -= channel[frame] * Math.sin(phase);
    }
    return { real, imaginary };
}

function complexRatio(left, right) {
    const denominator = right.real ** 2 + right.imaginary ** 2;
    if (denominator <= 1e-30)
        return { real: 0, imaginary: 0 };
    return {
        real: (left.real * right.real + left.imaginary * right.imaginary) / denominator,
        imaginary: (left.imaginary * right.real - left.real * right.imaginary) / denominator,
    };
}

function complexMagnitude(value) {
    return Math.hypot(value.real, value.imaginary);
}

function phaseDegrees(value) {
    return Math.atan2(value.imaginary, value.real) * 180 / Math.PI;
}

function percentile(values, fraction) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

async function writeFloatWave(filePath, stereo, sampleRate) {
    const frameCount = Math.min(stereo.left.length, stereo.right.length);
    const dataBytes = frameCount * 8;
    const buffer = Buffer.alloc(44 + dataBytes);
    buffer.write("RIFF", 0, "ascii");
    buffer.writeUInt32LE(36 + dataBytes, 4);
    buffer.write("WAVE", 8, "ascii");
    buffer.write("fmt ", 12, "ascii");
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(3, 20);
    buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 8, 28);
    buffer.writeUInt16LE(8, 32);
    buffer.writeUInt16LE(32, 34);
    buffer.write("data", 36, "ascii");
    buffer.writeUInt32LE(dataBytes, 40);
    for (let frame = 0; frame < frameCount; frame += 1) {
        buffer.writeFloatLE(stereo.left[frame], 44 + frame * 8);
        buffer.writeFloatLE(stereo.right[frame], 44 + frame * 8 + 4);
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
}

async function generateRuntime(patchPath, outputPath) {
    run("cmaj", ["generate", "--target=javascript", `--output=${outputPath}`, patchPath]);
    const source = await fs.readFile(outputPath, "utf8");
    const className = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(source)?.[1];
    if (!className)
        throw new Error(`Generated runtime for ${patchPath} has no class`);
    await fs.writeFile(outputPath, `${source}\nexport default ${className};\n`, "utf8");
    return (await import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`)).default;
}

async function createCheckpointPatch(temporaryDirectory) {
    const root = path.join(temporaryDirectory, "checkpoint");
    await fs.mkdir(path.join(root, "cmajor"), { recursive: true });
    await fs.mkdir(path.join(root, "fx/enhancer_lite"), { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(root, "cmajor/EnhancerLite.cmajor"), gitShow("cmajor/EnhancerLite.cmajor")),
        fs.writeFile(
            path.join(root, "cmajor/EnhancerLiteSpectrumAnalyzer.cmajor"),
            gitShow("cmajor/EnhancerLiteSpectrumAnalyzer.cmajor"),
        ),
        fs.writeFile(
            path.join(root, "fx/enhancer_lite/EnhancerLitePlugin.cmajor"),
            gitShow("fx/enhancer_lite/EnhancerLitePlugin.cmajor"),
        ),
    ]);
    const manifest = JSON.parse(gitShow("fx/enhancer_lite/EnhancerLite.cmajorpatch"));
    delete manifest.view;
    delete manifest.resources;
    const patchPath = path.join(root, "fx/enhancer_lite/EnhancerLite.cmajorpatch");
    await fs.writeFile(patchPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return patchPath;
}

let nextSessionID = 26_827_000;

async function render(RuntimeClass, defaults, fixture, sampleRate, settings = {}) {
    const performer = new RuntimeClass();
    await performer.initialise(nextSessionID, sampleRate);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({ ...defaults, ...settings }))
        performer[`setInputValue_${endpointID}`](value, 0);

    const frameCount = fixture.left.length;
    const output = { left: new Float32Array(frameCount), right: new Float32Array(frameCount) };
    // Generated Cmajor JavaScript performers expose a 512-frame stream block.
    for (let offset = 0; offset < frameCount; offset += 512) {
        const blockFrames = Math.min(512, frameCount - offset);
        performer.setInputStreamFrames_audioIn([
            fixture.left.subarray(offset, offset + blockFrames),
            fixture.right.subarray(offset, offset + blockFrames),
        ], blockFrames, 0);
        performer.advance(blockFrames);
        const left = new Float32Array(blockFrames);
        const right = new Float32Array(blockFrames);
        performer.getOutputFrames_audioOut([left, right], blockFrames, 0);
        output.left.set(left, offset);
        output.right.set(right, offset);
    }
    for (const channel of [output.left, output.right]) {
        for (const sample of channel) {
            if (!Number.isFinite(sample))
                throw new Error("Enhancer Lite produced non-finite output");
        }
    }
    return output;
}

function mapSpectreSettings(row) {
    const shape = row.settings.lowshelf_switch ? "low" : "high";
    const prefix = shape === "low" ? "lowshelf" : "highshelf";
    const processing = row.settings[`${prefix}_processing`];
    const displayValue = (name) => Number.parseFloat(
        row.effective_parameters[`${prefix}_${name}`].display,
    );
    const amount = displayValue("gain") / 12;
    return {
        freqHzIn: displayValue("frequency"),
        qIn: displayValue("q"),
        modeIn: processing === "Stereo" ? 0 : 1,
        midAmountIn: processing === "Side" ? 0 : amount,
        sideAmountIn: processing === "Side" ? amount : 0,
        curveIn: row.settings[`${prefix}_color`] === "Tube" ? 0 : 1,
        saturationModeIn: row.settings.mode === "Medium" ? 1 : 0,
        shapeIn: shape === "low" ? 0 : 2,
    };
}

function acceptedSettings(settings) {
    return {
        b1FreqHzIn: settings.freqHzIn,
        b1QIn: settings.qIn,
        b1ModeIn: settings.modeIn,
        b1MidAmountIn: settings.midAmountIn,
        b1SideAmountIn: settings.sideAmountIn,
        b1CurveIn: settings.curveIn,
        b2MidAmountIn: 0,
        b2SideAmountIn: 0,
        saturationModeIn: settings.saturationModeIn,
        deEmphasisIn: 0,
    };
}

function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    };
}

async function benchmark(RuntimeClass, defaults, settings) {
    const performer = new RuntimeClass();
    await performer.initialise(nextSessionID, 48_000);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({ ...defaults, ...settings }))
        performer[`setInputValue_${endpointID}`](value, 0);

    const random = mulberry32(0x5e1f5a11);
    const left = Float32Array.from({ length: 512 }, () => (random() * 2 - 1) * 0.1);
    const right = Float32Array.from({ length: 512 }, () => (random() * 2 - 1) * 0.1);
    const outputLeft = new Float32Array(512);
    const outputRight = new Float32Array(512);
    const processBlock = () => {
        performer.setInputStreamFrames_audioIn([left, right], 512, 0);
        performer.advance(512);
        performer.getOutputFrames_audioOut([outputLeft, outputRight], 512, 0);
    };
    for (let index = 0; index < 30; index += 1)
        processBlock();

    const samples = [];
    const blocksPerRun = 160;
    for (let runIndex = 0; runIndex < 7; runIndex += 1) {
        const started = process.hrtime.bigint();
        for (let block = 0; block < blocksPerRun; block += 1)
            processBlock();
        samples.push(Number(process.hrtime.bigint() - started) / (blocksPerRun * 512));
    }
    samples.sort((leftValue, rightValue) => leftValue - rightValue);
    return samples[Math.floor(samples.length / 2)];
}

function deterministicFixture(frameCount, sampleRate) {
    const random = mulberry32(0x2648a71f);
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame += 1) {
        left[frame] = 0.12 * Math.sin(2 * Math.PI * 173 * frame / sampleRate)
            + 0.04 * (random() * 2 - 1);
        right[frame] = 0.1 * Math.sin(2 * Math.PI * 337 * frame / sampleRate + 0.3)
            + 0.04 * (random() * 2 - 1);
    }
    return { left, right };
}

async function measureBellLock(CheckpointRuntime, CurrentRuntime) {
    const fixture = deterministicFixture(48_000, 48_000);
    const rows = [];
    let maximumAbsoluteDifference = 0;
    for (const modeIn of [0, 1]) {
        for (const curveIn of [0, 1]) {
            for (const saturationModeIn of [0, 1]) {
                const settings = {
                    freqHzIn: modeIn === 0 ? 713 : 6143,
                    qIn: curveIn === 0 ? 0.37 : 7.3,
                    modeIn,
                    midAmountIn: 0.73,
                    sideAmountIn: modeIn === 0 ? 0 : 0.41,
                    curveIn,
                    saturationModeIn,
                };
                const [baseline, current] = await Promise.all([
                    render(CheckpointRuntime, checkpointDefaults, fixture, 48_000, settings),
                    render(CurrentRuntime, currentDefaults, fixture, 48_000, {
                        ...settings,
                        shapeIn: 1,
                    }),
                ]);
                let rowMaximum = 0;
                for (let frame = 0; frame < fixture.left.length; frame += 1) {
                    rowMaximum = Math.max(
                        rowMaximum,
                        Math.abs(baseline.left[frame] - current.left[frame]),
                        Math.abs(baseline.right[frame] - current.right[frame]),
                    );
                }
                maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, rowMaximum);
                rows.push({ modeIn, curveIn, saturationModeIn, maximumAbsoluteDifference: rowMaximum });
            }
        }
    }
    return { checkpoint, maximumAbsoluteDifference, bitIdentical: maximumAbsoluteDifference === 0, rows };
}

async function measureZeroAmount(CurrentRuntime) {
    const fixture = deterministicFixture(32_768, 48_000);
    const neutral = await render(CurrentRuntime, currentDefaults, fixture, 48_000, {});
    const rows = [];
    let maximumAbsoluteDifference = 0;
    for (const shapeIn of [0, 1, 2]) {
        const output = await render(CurrentRuntime, currentDefaults, fixture, 48_000, {
            freqHzIn: shapeIn === 0 ? 20 : (shapeIn === 1 ? 743 : 20_000),
            qIn: shapeIn === 2 ? 10 : 0.1,
            shapeIn,
            midAmountIn: 0,
            sideAmountIn: 0,
        });
        let rowMaximum = 0;
        for (let frame = 0; frame < fixture.left.length; frame += 1) {
            rowMaximum = Math.max(
                rowMaximum,
                Math.abs(output.left[frame] - neutral.left[frame]),
                Math.abs(output.right[frame] - neutral.right[frame]),
            );
        }
        maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, rowMaximum);
        rows.push({ shapeIn, maximumAbsoluteDifference: rowMaximum });
    }
    return { maximumAbsoluteDifference, bitIdentical: maximumAbsoluteDifference === 0, rows };
}

async function measureShapeSwitching(CurrentRuntime) {
    const sampleRate = 48_000;
    const frameCount = 32_768;
    const performer = new CurrentRuntime();
    await performer.initialise(nextSessionID, sampleRate);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({
        ...currentDefaults,
        freqHzIn: 1000,
        qIn: 4,
        midAmountIn: 1,
        curveIn: 0,
        saturationModeIn: 1,
        shapeIn: 1,
    })) {
        performer[`setInputValue_${endpointID}`](value, 0);
    }

    const switches = new Map([[8192, 0], [16_384, 2], [24_576, 1]]);
    let previous = 0;
    let maximumStep = 0;
    let stableMaximumStep = 0;
    let transitionMaximumStep = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
        if (switches.has(frame))
            performer.setInputValue_shapeIn(switches.get(frame), 0);
        const sample = 0.2 * Math.sin(2 * Math.PI * 100 * frame / sampleRate);
        performer.setInputStreamFrames_audioIn([
            Float32Array.of(sample),
            Float32Array.of(sample),
        ], 1, 0);
        performer.advance(1);
        const left = new Float32Array(1);
        const right = new Float32Array(1);
        performer.getOutputFrames_audioOut([left, right], 1, 0);
        if (frame > 4096) {
            const step = Math.abs(left[0] - previous);
            maximumStep = Math.max(maximumStep, step);
            const inTransition = [...switches.keys()].some((switchFrame) => (
                frame >= switchFrame && frame < switchFrame + 4096
            ));
            if (inTransition)
                transitionMaximumStep = Math.max(transitionMaximumStep, step);
            else
                stableMaximumStep = Math.max(stableMaximumStep, step);
        }
        previous = left[0];
    }
    return {
        smoothingMilliseconds: 15,
        maximumStep,
        stableMaximumStep,
        transitionMaximumStep,
        transitionToStableStepRatio: transitionMaximumStep / Math.max(stableMaximumStep, 1e-30),
    };
}

function analysisWindow(stereo, sampleRate) {
    const startFrame = Math.min(stereo.left.length - 1, Math.round(sampleRate * 0.25));
    return {
        startFrame,
        frameCount: Math.max(1, stereo.left.length - startFrame - Math.round(sampleRate * 0.05)),
    };
}

function compareStereo(golden, candidate, sampleRate) {
    const { startFrame, frameCount } = analysisWindow(golden, sampleRate);
    const goldenRms = rms(golden, startFrame, frameCount);
    const candidateRms = rms(candidate, startFrame, frameCount);
    const matchGain = goldenRms / Math.max(candidateRms, 1e-30);
    const errorRms = differenceRms(golden, candidate, startFrame, frameCount, matchGain);
    return {
        goldenRms,
        candidateRms,
        levelDeltaDb: dbRatio(candidateRms, goldenRms),
        staticMatchGainDb: dbRatio(matchGain, 1),
        matchedErrorRelativeDb: dbRatio(errorRms, goldenRms),
        matchedCorrelation: correlation(golden, candidate, startFrame, frameCount),
    };
}

function harmonicComparison(golden, candidate, sampleRate, fundamentalHz) {
    const available = analysisWindow(golden, sampleRate);
    const periodFrames = Math.round(sampleRate / fundamentalHz);
    const frameCount = Math.floor(available.frameCount / periodFrames) * periodFrames;
    const startFrame = golden.left.length - frameCount;
    const rows = [];
    for (let harmonic = 1; harmonic <= 12; harmonic += 1) {
        const frequencyHz = fundamentalHz * harmonic;
        if (frequencyHz >= sampleRate * 0.49)
            break;
        const goldenPeak = 2 * complexMagnitude(
            complexTone(golden.left, sampleRate, frequencyHz, startFrame, frameCount),
        ) / frameCount;
        const candidatePeak = 2 * complexMagnitude(
            complexTone(candidate.left, sampleRate, frequencyHz, startFrame, frameCount),
        ) / frameCount;
        rows.push({
            harmonic,
            frequencyHz,
            goldenPeak,
            candidatePeak,
            errorDb: goldenPeak >= 1e-7 ? dbRatio(candidatePeak, goldenPeak) : null,
        });
    }
    const maximumGoldenPeak = Math.max(...rows.map(({ goldenPeak }) => goldenPeak));
    const comparable = rows.filter(({ goldenPeak, errorDb }) => (
        errorDb !== null && goldenPeak >= maximumGoldenPeak * 1e-4
    ));
    const rmsErrorDb = Math.sqrt(
        comparable.reduce((sum, { errorDb }) => sum + errorDb ** 2, 0)
        / Math.max(1, comparable.length),
    );
    const goldenEnergy = rows.reduce((sum, { goldenPeak }) => sum + goldenPeak ** 2, 0);
    const errorEnergy = rows.reduce((sum, { goldenPeak, candidatePeak }) => (
        sum + (candidatePeak - goldenPeak) ** 2
    ), 0);
    return {
        rmsErrorDb,
        magnitudeErrorRelativeDb: dbRatio(Math.sqrt(errorEnergy), Math.sqrt(goldenEnergy)),
        rows,
    };
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-enhancer-lite-shelves-"));

try {
    await fs.access(spectreMeasurementsPath);
    const [measurementsBuffer, spectreReportBuffer, spectreFixtureBuffer] = await Promise.all([
        fs.readFile(spectreMeasurementsPath),
        fs.readFile(spectreReportPath),
        fs.readFile(spectreFixturePath),
    ]);
    const spectreHashes = {
        report: sha256(spectreReportBuffer),
        measurements: sha256(measurementsBuffer),
    };
    for (const [name, expected] of Object.entries(expectedSpectreHashes)) {
        if (spectreHashes[name] !== expected) {
            throw new Error(
                `Spectre ${name} corpus hash mismatch: expected ${expected}, got ${spectreHashes[name]}`,
            );
        }
    }
    const measurements = parsePythonJson(measurementsBuffer.toString("utf8"));
    const spectreReport = parsePythonJson(spectreReportBuffer.toString("utf8"));
    const spectreFixture = JSON.parse(spectreFixtureBuffer.toString("utf8"));
    if (spectreFixture.source.reportSha256 !== spectreHashes.report
        || spectreFixture.source.measurementsSha256 !== spectreHashes.measurements) {
        throw new Error("Committed Spectre fixture does not name the authenticated JSON corpus");
    }
    const audioIntegrity = await verifySpectreShelfAudio({
        corpusDirectory: spectreDirectory,
        measurements,
        inputAudio: spectreFixture.inputAudio,
    });

    if (requestedMode === "--verify-corpus") {
        process.stdout.write(
            `Spectre shelf corpus integrity: ${audioIntegrity.inputCount} inputs and `
            + `${audioIntegrity.outputCount} outputs authenticated as decoded Float32 audio.\n`,
        );
    } else {
    const checkpointPatchPath = await createCheckpointPatch(temporaryDirectory);
    const [CheckpointRuntime, CurrentRuntime, AcceptedRuntime] = await Promise.all([
        generateRuntime(checkpointPatchPath, path.join(temporaryDirectory, "checkpoint.mjs")),
        generateRuntime(currentPatchPath, path.join(temporaryDirectory, "current.mjs")),
        generateRuntime(acceptedPatchPath, path.join(temporaryDirectory, "accepted.mjs")),
    ]);
    const measurementsByID = new Map(measurements.map((row) => [row.id, row]));
    const inputCache = new Map();
    const neutralCache = new Map();
    const loadInput = async (stimulus) => {
        if (!inputCache.has(stimulus)) {
            inputCache.set(
                stimulus,
                readFloatWave(path.join(spectreDirectory, "inputs", `${stimulus}.wav`)),
            );
        }
        return inputCache.get(stimulus);
    };
    const renderNeutral = async (stimulus) => {
        if (!neutralCache.has(stimulus)) {
            neutralCache.set(stimulus, (async () => {
                const fixture = await loadInput(stimulus);
                return render(CurrentRuntime, currentDefaults, fixture, fixture.sampleRate, {});
            })());
        }
        return neutralCache.get(stimulus);
    };

    await fs.mkdir(reviewDirectory, { recursive: true });
    const [bellLock, zeroAmount, shapeSwitching] = await Promise.all([
        measureBellLock(CheckpointRuntime, CurrentRuntime),
        measureZeroAmount(CurrentRuntime),
        measureShapeSwitching(CurrentRuntime),
    ]);

    // Time the isolated runtimes before the large audio corpus is retained in
    // memory, otherwise host garbage collection overwhelms these small kernels.
    const benchmarkSettings = {
        freqHzIn: 1000,
        qIn: 0.71,
        modeIn: 1,
        midAmountIn: 0.75,
        sideAmountIn: 0.5,
        curveIn: 0,
        saturationModeIn: 1,
    };
    const checkpointNanosecondsPerFrame = await benchmark(
        CheckpointRuntime,
        checkpointDefaults,
        benchmarkSettings,
    );
    const currentBellNanosecondsPerFrame = await benchmark(
        CurrentRuntime,
        currentDefaults,
        { ...benchmarkSettings, shapeIn: 1 },
    );
    const currentLowNanosecondsPerFrame = await benchmark(
        CurrentRuntime,
        currentDefaults,
        { ...benchmarkSettings, shapeIn: 0 },
    );
    const currentHighNanosecondsPerFrame = await benchmark(
        CurrentRuntime,
        currentDefaults,
        { ...benchmarkSettings, shapeIn: 2 },
    );
    const acceptedNanosecondsPerFrame = await benchmark(
        AcceptedRuntime,
        acceptedDefaults,
        acceptedSettings(benchmarkSettings),
    );
    const performance = {
        checkpointNanosecondsPerFrame,
        currentBellNanosecondsPerFrame,
        currentLowNanosecondsPerFrame,
        currentHighNanosecondsPerFrame,
        acceptedNanosecondsPerFrame,
        currentBellSlowdownVsCheckpoint: currentBellNanosecondsPerFrame / checkpointNanosecondsPerFrame,
        currentLowSlowdownVsCheckpoint: currentLowNanosecondsPerFrame / checkpointNanosecondsPerFrame,
        currentHighSlowdownVsCheckpoint: currentHighNanosecondsPerFrame / checkpointNanosecondsPerFrame,
        currentBellSpeedupVsAccepted: acceptedNanosecondsPerFrame / currentBellNanosecondsPerFrame,
        currentLowSpeedupVsAccepted: acceptedNanosecondsPerFrame / currentLowNanosecondsPerFrame,
        currentHighSpeedupVsAccepted: acceptedNanosecondsPerFrame / currentHighNanosecondsPerFrame,
    };

    const linearRows = [];
    const linearInputScale = 0.001;
    const subtleSolidSmallSignalSlope = 3 / Math.SQRT2;
    for (const modelRow of spectreReport.linear_selection.rows) {
        const row = measurementsByID.get(modelRow.case.id);
        if (!row)
            throw new Error(`Missing Spectre linear row ${modelRow.case.id}`);
        const originalInput = await loadInput(row.stimulus);
        const scaledInput = {
            left: Float32Array.from(originalInput.left, (sample) => sample * linearInputScale),
            right: Float32Array.from(originalInput.right, (sample) => sample * linearInputScale),
        };
        const settings = mapSpectreSettings(row);
        const [wet, neutral, goldenWave] = await Promise.all([
            render(CurrentRuntime, currentDefaults, scaledInput, row.sample_rate, settings),
            render(CurrentRuntime, currentDefaults, scaledInput, row.sample_rate, {}),
            readFloatWave(path.join(spectreDirectory, row.output_path)),
        ]);
        const contribution = scaleStereo(
            subtractStereo(wet, neutral),
            1 / (linearInputScale * subtleSolidSmallSignalSlope),
        );
        const alignedLength = Math.min(
            contribution.left.length - latencySamples.shelfLite,
            goldenWave.left.length,
        );
        const currentAligned = latencyAligned(
            contribution,
            latencySamples.shelfLite,
            alignedLength,
        );
        const goldenAligned = latencyAligned(
            goldenWave,
            0,
            alignedLength,
        );
        const peakGoldenMagnitudeDb = Math.max(
            ...modelRow.response_anchors.map(({ measured_magnitude_db: value }) => value),
        );
        const anchors = modelRow.response_anchors.map(({
            frequency_hz: frequencyHz,
            measured_magnitude_db: goldenMagnitudeDb,
        }) => {
            const currentTone = complexTone(currentAligned.left, row.sample_rate, frequencyHz);
            const goldenTone = complexTone(goldenAligned.left, row.sample_rate, frequencyHz);
            const ratio = complexRatio(currentTone, goldenTone);
            return {
                frequencyHz,
                goldenMagnitudeDb,
                // Below -30 dB relative to the selected contribution's own
                // peak, separate-instance wet-minus-dry float cancellation
                // dominates the production-runtime impulse comparison. Keep
                // the anchor in the report, but exclude it from the fit score.
                comparable: goldenMagnitudeDb >= peakGoldenMagnitudeDb - 30,
                magnitudeErrorDb: dbRatio(complexMagnitude(currentTone), complexMagnitude(goldenTone)),
                phaseErrorDegrees: phaseDegrees(ratio),
            };
        });
        const comparableAnchors = anchors.filter(({ comparable }) => comparable);
        linearRows.push({
            id: row.id,
            shape: settings.shapeIn === 0 ? "low" : "high",
            sampleRate: row.sample_rate,
            frequencyHz: settings.freqHzIn,
            q: settings.qIn,
            gainDb: settings.midAmountIn * 12,
            anchors,
            magnitudeRmsErrorDb: Math.sqrt(
                comparableAnchors.reduce((sum, anchor) => sum + anchor.magnitudeErrorDb ** 2, 0)
                / comparableAnchors.length,
            ),
            phaseRmsErrorDegrees: Math.sqrt(
                comparableAnchors.reduce((sum, anchor) => sum + anchor.phaseErrorDegrees ** 2, 0)
                / comparableAnchors.length,
            ),
        });
    }

    const transferRows = [];
    for (const row of measurements.filter(({ group }) => group === "transfer-shaped")) {
        const fixture = await loadInput(row.stimulus);
        const settings = mapSpectreSettings(row);
        const [wet, neutral, goldenWave] = await Promise.all([
            render(CurrentRuntime, currentDefaults, fixture, row.sample_rate, settings),
            renderNeutral(row.stimulus),
            readFloatWave(path.join(spectreDirectory, row.output_path)),
        ]);
        const contribution = subtractStereo(wet, neutral);
        const alignedLength = Math.min(
            contribution.left.length - latencySamples.shelfLite,
            goldenWave.left.length,
        );
        const currentAligned = latencyAligned(contribution, latencySamples.shelfLite, alignedLength);
        const goldenAligned = latencyAligned(goldenWave, 0, alignedLength);
        transferRows.push({
            id: row.id,
            shape: settings.shapeIn === 0 ? "low" : "high",
            ...compareStereo(goldenAligned, currentAligned, row.sample_rate),
            harmonics: harmonicComparison(goldenAligned, currentAligned, row.sample_rate, 100),
        });
    }

    const routingRows = [];
    for (const row of measurements.filter(({ group }) => group === "routing")) {
        const fixture = await loadInput(row.stimulus);
        const settings = mapSpectreSettings(row);
        const [wet, goldenWave] = await Promise.all([
            render(CurrentRuntime, currentDefaults, fixture, row.sample_rate, settings),
            readFloatWave(path.join(spectreDirectory, row.output_path)),
        ]);
        const alignedLength = Math.min(
            wet.left.length - latencySamples.shelfLite,
            goldenWave.left.length,
        );
        const currentAligned = latencyAligned(wet, latencySamples.shelfLite, alignedLength);
        const goldenAligned = latencyAligned(goldenWave, 0, alignedLength);
        const currentComponents = monoComponents(currentAligned);
        const goldenComponents = monoComponents(goldenAligned);
        routingRows.push({
            id: row.id,
            shape: settings.shapeIn === 0 ? "low" : "high",
            processing: settings.modeIn === 0 ? "stereo" : (settings.sideAmountIn > 0 ? "side" : "mid"),
            ...compareStereo(goldenAligned, currentAligned, row.sample_rate),
            midLevelDeltaDb: dbRatio(channelRms(currentComponents.mid), channelRms(goldenComponents.mid)),
            sideLevelDeltaDb: dbRatio(channelRms(currentComponents.side), channelRms(goldenComponents.side)),
        });
    }

    const musicalRows = [];
    const listeningDirectory = path.join(reviewDirectory, "listening");
    for (const row of measurements.filter(({ group }) => group === "music-shaped")) {
        const fixture = await loadInput(row.stimulus);
        const settings = mapSpectreSettings(row);
        const [wet, goldenWave] = await Promise.all([
            render(CurrentRuntime, currentDefaults, fixture, row.sample_rate, settings),
            readFloatWave(path.join(spectreDirectory, row.output_path)),
        ]);
        const alignedLength = Math.min(
            wet.left.length - latencySamples.shelfLite,
            goldenWave.left.length,
        );
        const currentAligned = latencyAligned(wet, latencySamples.shelfLite, alignedLength);
        const goldenAligned = latencyAligned(goldenWave, 0, alignedLength);
        const comparison = compareStereo(goldenAligned, currentAligned, row.sample_rate);
        const matchGain = 10 ** (comparison.staticMatchGainDb / 20);
        const stem = row.id.replace(/^shelf-music-/, "");
        await Promise.all([
            writeFloatWave(path.join(listeningDirectory, `${stem}-spectre.wav`), goldenAligned, row.sample_rate),
            writeFloatWave(path.join(listeningDirectory, `${stem}-lite-raw.wav`), currentAligned, row.sample_rate),
            writeFloatWave(
                path.join(listeningDirectory, `${stem}-lite-matched.wav`),
                scaleStereo(currentAligned, matchGain),
                row.sample_rate,
            ),
        ]);
        musicalRows.push({
            id: row.id,
            stimulus: row.stimulus,
            shape: settings.shapeIn === 0 ? "low" : "high",
            character: settings.curveIn === 0 ? "tube" : "solid",
            intensity: settings.saturationModeIn === 0 ? "subtle" : "medium",
            ...comparison,
            spectrePath: `listening/${stem}-spectre.wav`,
            liteRawPath: `listening/${stem}-lite-raw.wav`,
            liteMatchedPath: `listening/${stem}-lite-matched.wav`,
        });
    }

    const aliasRows = [];
    for (const row of measurements.filter(({ group }) => group === "alias")) {
        const fixture = await loadInput(row.stimulus);
        const settings = mapSpectreSettings(row);
        const [wet, neutral, goldenWave] = await Promise.all([
            render(CurrentRuntime, currentDefaults, fixture, row.sample_rate, settings),
            renderNeutral(row.stimulus),
            readFloatWave(path.join(spectreDirectory, row.output_path)),
        ]);
        const contribution = subtractStereo(wet, neutral);
        const alignedLength = Math.min(
            contribution.left.length - latencySamples.shelfLite,
            goldenWave.left.length,
        );
        const currentAligned = latencyAligned(contribution, latencySamples.shelfLite, alignedLength);
        const goldenAligned = latencyAligned(goldenWave, 0, alignedLength);
        const availableWindow = analysisWindow(goldenAligned, row.sample_rate);
        const aliasPeriodFrames = 16;
        const window = {
            frameCount: Math.floor(availableWindow.frameCount / aliasPeriodFrames)
                * aliasPeriodFrames,
        };
        window.startFrame = goldenAligned.left.length - window.frameCount;
        const peak = (stereo, frequencyHz) => 2 * complexMagnitude(complexTone(
            stereo.left,
            row.sample_rate,
            frequencyHz,
            window.startFrame,
            window.frameCount,
        )) / window.frameCount;
        const currentFundamental = peak(currentAligned, 9000);
        const goldenFundamental = peak(goldenAligned, 9000);
        const aliases = [];
        for (const [harmonic, foldedHz] of [[3, 21_000], [5, 3000]]) {
            aliases.push({
                harmonic,
                foldedHz,
                spectreDbc: dbRatio(peak(goldenAligned, foldedHz), goldenFundamental),
                liteDbc: dbRatio(peak(currentAligned, foldedHz), currentFundamental),
            });
        }
        aliasRows.push({
            id: row.id,
            shape: settings.shapeIn === 0 ? "low" : "high",
            character: settings.curveIn === 0 ? "tube" : "solid",
            aliases,
        });
    }

    const worstLinearMagnitudeRmsErrorDb = Math.max(
        ...linearRows.map(({ magnitudeRmsErrorDb }) => magnitudeRmsErrorDb),
    );
    const worstLinearPhaseRmsErrorDegrees = Math.max(
        ...linearRows.map(({ phaseRmsErrorDegrees }) => phaseRmsErrorDegrees),
    );
    const linearMagnitudeP95ErrorDb = percentile(
        linearRows.map(({ magnitudeRmsErrorDb }) => magnitudeRmsErrorDb),
        0.95,
    );
    const worstTransferHarmonicRmsErrorDb = Math.max(
        ...transferRows.map(({ harmonics }) => harmonics.rmsErrorDb),
    );
    const worstTransferLevelDeltaDb = Math.max(
        ...transferRows.map(({ levelDeltaDb }) => Math.abs(levelDeltaDb)),
    );
    const worstTransferMagnitudeErrorRelativeDb = Math.max(
        ...transferRows.map(({ harmonics }) => harmonics.magnitudeErrorRelativeDb),
    );
    const worstRoutingLevelDeltaDb = Math.max(
        ...routingRows.map(({ levelDeltaDb }) => Math.abs(levelDeltaDb)),
    );
    const worstMusicalLevelDeltaDb = Math.max(
        ...musicalRows.map(({ levelDeltaDb }) => Math.abs(levelDeltaDb)),
    );
    const minimumMusicalMatchedCorrelation = Math.min(
        ...musicalRows.map(({ matchedCorrelation }) => matchedCorrelation),
    );
    const worstLiteAliasDbc = Math.max(
        ...aliasRows.flatMap(({ aliases }) => aliases.map(({ liteDbc }) => liteDbc)),
    );
    const worstAliasRegressionDb = Math.max(
        ...aliasRows.flatMap(({ aliases }) => aliases.map(({ liteDbc, spectreDbc }) => (
            liteDbc - spectreDbc
        ))),
    );
    let acceptedBellEvidence = null;
    try {
        acceptedBellEvidence = JSON.parse(await fs.readFile(
            path.join(repoRoot, "build/enhancer-lite-review/report.json"),
            "utf8",
        )).summary;
    } catch {
        // The shelf report remains self-contained if the separate Bell evidence
        // command has not been run in this checkout.
    }

    const report = {
        format: "cosimo.enhancerLiteShelfEvidence",
        version: 1,
        checkpoint,
        corpus: {
            path: path.relative(repoRoot, spectreDirectory),
            caseCount: spectreReport.corpus.case_count,
            stimulusCount: spectreReport.corpus.stimulus_count,
            sessionCount: spectreReport.corpus.session_count,
            reportSha256: spectreHashes.report,
            measurementsSha256: spectreHashes.measurements,
            decodedFloat32InputCount: audioIntegrity.inputCount,
            decodedFloat32OutputCount: audioIntegrity.outputCount,
        },
        architecture: {
            selection: "measured RBJ/JUCE Q-form Low/Bell/High at 4x",
            wrapper: "4x two-stage polyphase IIR",
            shaper: "odd rational tanh approximation",
            programDependentGainCompensation: false,
            latencySamples,
        },
        thresholds: {
            maximumBellLockDifference: 0,
            maximumZeroAmountDifference: 0,
            maximumSwitchStep: 0.1,
            maximumLinearMagnitudeRmsErrorDb: 0.5,
            maximumLinearMagnitudeP95ErrorDb: 0.25,
            // Spectre's latency-compensated FIR wrapper and Lite's accepted
            // three-sample IIR wrapper do not share phase above the shelf
            // corner. This bounds the measured residual without changing
            // Bell's accepted timing contract.
            maximumLinearPhaseRmsErrorDegrees: 75,
            maximumTransferHarmonicRmsErrorDb: 3,
            maximumTransferMagnitudeErrorRelativeDb: -24,
            maximumTransferLevelDeltaDb: 1,
            maximumRoutingLevelDeltaDb: 1,
            maximumMusicalLevelDeltaDb: 1,
            minimumMusicalMatchedCorrelation: 0.1,
            maximumLiteAliasDbc: -40,
            maximumAliasRegressionDb: 16,
            // The shelf path adds two double-precision biquads so its measured
            // 20 Hz conditioner remains stable through 192 kHz host rates.
            maximumSlowdownVsCheckpoint: 2.5,
            minimumSpeedupVsAccepted: 1.5,
        },
        summary: {
            bellLockMaximumAbsoluteDifference: bellLock.maximumAbsoluteDifference,
            zeroAmountMaximumAbsoluteDifference: zeroAmount.maximumAbsoluteDifference,
            maximumSwitchStep: shapeSwitching.maximumStep,
            worstLinearMagnitudeRmsErrorDb,
            linearMagnitudeP95ErrorDb,
            worstLinearPhaseRmsErrorDegrees,
            worstTransferHarmonicRmsErrorDb,
            worstTransferMagnitudeErrorRelativeDb,
            worstTransferLevelDeltaDb,
            worstRoutingLevelDeltaDb,
            worstMusicalLevelDeltaDb,
            minimumMusicalMatchedCorrelation,
            worstLiteAliasDbc,
            worstAliasRegressionDb,
        },
        bellLock,
        zeroAmount,
        shapeSwitching,
        performance,
        acceptedBellEvidence,
        linearRows,
        transferRows,
        routingRows,
        musicalRows,
        aliasRows,
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    const failures = [];
    const { thresholds, summary } = report;
    if (summary.bellLockMaximumAbsoluteDifference > thresholds.maximumBellLockDifference)
        failures.push(`Bell drift ${summary.bellLockMaximumAbsoluteDifference}`);
    if (summary.zeroAmountMaximumAbsoluteDifference > thresholds.maximumZeroAmountDifference)
        failures.push(`zero-Amount drift ${summary.zeroAmountMaximumAbsoluteDifference}`);
    if (summary.maximumSwitchStep > thresholds.maximumSwitchStep)
        failures.push(`Shape switch step ${summary.maximumSwitchStep.toFixed(6)}`);
    if (summary.worstLinearMagnitudeRmsErrorDb > thresholds.maximumLinearMagnitudeRmsErrorDb)
        failures.push(`linear magnitude ${summary.worstLinearMagnitudeRmsErrorDb.toFixed(3)} dB`);
    if (summary.linearMagnitudeP95ErrorDb > thresholds.maximumLinearMagnitudeP95ErrorDb)
        failures.push(`linear magnitude p95 ${summary.linearMagnitudeP95ErrorDb.toFixed(3)} dB`);
    if (summary.worstLinearPhaseRmsErrorDegrees > thresholds.maximumLinearPhaseRmsErrorDegrees)
        failures.push(`linear phase ${summary.worstLinearPhaseRmsErrorDegrees.toFixed(3)} deg`);
    if (summary.worstTransferHarmonicRmsErrorDb > thresholds.maximumTransferHarmonicRmsErrorDb)
        failures.push(`harmonic RMS ${summary.worstTransferHarmonicRmsErrorDb.toFixed(3)} dB`);
    if (summary.worstTransferMagnitudeErrorRelativeDb
        > thresholds.maximumTransferMagnitudeErrorRelativeDb) {
        failures.push(
            `harmonic energy error ${summary.worstTransferMagnitudeErrorRelativeDb.toFixed(2)} dB`,
        );
    }
    if (summary.worstTransferLevelDeltaDb > thresholds.maximumTransferLevelDeltaDb)
        failures.push(`transfer level ${summary.worstTransferLevelDeltaDb.toFixed(3)} dB`);
    if (summary.worstRoutingLevelDeltaDb > thresholds.maximumRoutingLevelDeltaDb)
        failures.push(`routing level ${summary.worstRoutingLevelDeltaDb.toFixed(3)} dB`);
    if (summary.worstMusicalLevelDeltaDb > thresholds.maximumMusicalLevelDeltaDb)
        failures.push(`musical level ${summary.worstMusicalLevelDeltaDb.toFixed(3)} dB`);
    if (summary.minimumMusicalMatchedCorrelation < thresholds.minimumMusicalMatchedCorrelation)
        failures.push(`musical correlation ${summary.minimumMusicalMatchedCorrelation.toFixed(4)}`);
    if (summary.worstLiteAliasDbc > thresholds.maximumLiteAliasDbc)
        failures.push(`alias floor ${summary.worstLiteAliasDbc.toFixed(2)} dBc`);
    if (summary.worstAliasRegressionDb > thresholds.maximumAliasRegressionDb)
        failures.push(`alias regression ${summary.worstAliasRegressionDb.toFixed(2)} dB`);
    if (Math.max(
        performance.currentBellSlowdownVsCheckpoint,
        performance.currentLowSlowdownVsCheckpoint,
        performance.currentHighSlowdownVsCheckpoint,
    ) > thresholds.maximumSlowdownVsCheckpoint) {
        failures.push("CPU slowdown exceeded checkpoint budget");
    }
    if (Math.min(
        performance.currentBellSpeedupVsAccepted,
        performance.currentLowSpeedupVsAccepted,
        performance.currentHighSpeedupVsAccepted,
    ) < thresholds.minimumSpeedupVsAccepted) {
        failures.push("CPU speedup over accepted Enhancer missed budget");
    }

    process.stdout.write(
        `Enhancer Lite shelf evidence: Bell ${bellLock.bitIdentical ? "bit-identical" : "DRIFTED"}, `
        + `${worstLinearMagnitudeRmsErrorDb.toFixed(3)} dB linear RMS, `
        + `${worstTransferHarmonicRmsErrorDb.toFixed(3)} dB harmonic RMS, `
        + `${worstMusicalLevelDeltaDb.toFixed(3)} dB musical level, `
        + `${performance.currentLowSpeedupVsAccepted.toFixed(2)}x accepted speed. `
        + `Report: ${reportPath}\n`,
    );
    if (requestedMode === "--check" && failures.length > 0)
        throw new Error(`Enhancer Lite shelf evidence failed: ${failures.join("; ")}`);
    }
} finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
