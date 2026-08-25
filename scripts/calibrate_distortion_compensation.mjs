import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patchPath = path.join(repoRoot, "tools/distortion_calibration/DistortionCalibration.cmajorpatch");
const reportPath = path.join(repoRoot, "build/distortion-level-match-report.json");
const mode = process.argv[2] ?? "--check";

if (mode !== "--check" && mode !== "--experiment-filtered-saw") {
    throw new Error("usage: calibrate_distortion_compensation.mjs [--check|--experiment-filtered-saw]");
}

function run(command, args) {
    const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} failed (${result.status ?? "unknown"}):\n${result.stderr || result.stdout}`);
    }
}

function context(sampleRate = 48_000) {
    const settleFrames = Math.round(sampleRate * 0.1);
    const measureFrames = Math.round(sampleRate * 0.5);
    return { sampleRate, settleFrames, measureFrames, totalFrames: settleFrames + measureFrames };
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

function scaleToRmsDbfs(samples, fixtureContext, rmsDbfs) {
    let power = 0;
    for (let frame = fixtureContext.settleFrames; frame < samples.length; frame += 1) {
        power += samples[frame] ** 2;
    }
    const rms = Math.sqrt(power / fixtureContext.measureFrames);
    const targetRms = 10 ** (rmsDbfs / 20);
    return Float32Array.from(samples, (sample) => sample * targetRms / Math.max(rms, 1e-15));
}

function atRmsDbfs(baseFixture, fixtureContext, rmsDbfs) {
    return scaleToRmsDbfs(baseFixture, fixtureContext, rmsDbfs);
}

function makePink(fixtureContext) {
    const random = mulberry32(0x250825);
    const samples = new Float32Array(fixtureContext.totalFrames);
    let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;

    for (let frame = -fixtureContext.settleFrames; frame < samples.length; frame += 1) {
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

    return scaleToRmsDbfs(samples, fixtureContext, -18);
}

function makeFilteredSaw(fixtureContext) {
    const samples = new Float32Array(fixtureContext.totalFrames);
    const sawFrequencyHz = 110;
    const cutoffHz = 350;
    const q = Math.SQRT1_2;
    const omega = 2 * Math.PI * cutoffHz / fixtureContext.sampleRate;
    const alpha = Math.sin(omega) / (2 * q);
    const cosine = Math.cos(omega);
    const a0 = 1 + alpha;
    const b0 = ((1 - cosine) * 0.5) / a0;
    const b1 = (1 - cosine) / a0;
    const b2 = b0;
    const a1 = (-2 * cosine) / a0;
    const a2 = (1 - alpha) / a0;
    let phase = 0;
    let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;

    for (let frame = -fixtureContext.settleFrames; frame < samples.length; frame += 1) {
        const saw = 2 * phase - 1;
        phase += sawFrequencyHz / fixtureContext.sampleRate;
        if (phase >= 1) phase -= 1;
        const filtered = b0 * saw + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = saw;
        y2 = y1;
        y1 = filtered;
        if (frame >= 0) samples[frame] = filtered;
    }

    return scaleToRmsDbfs(samples, fixtureContext, -18);
}

function makeSine(fixtureContext, frequencyHz, peak) {
    return Float32Array.from({ length: fixtureContext.totalFrames }, (_, frame) => (
        peak * Math.sin(2 * Math.PI * frequencyHz * frame / fixtureContext.sampleRate)
    ));
}

function makeDrums(fixtureContext) {
    const random = mulberry32(0xd12f00d);
    const samples = new Float32Array(fixtureContext.totalFrames);
    let previousNoise = 0;
    for (let frame = 0; frame < samples.length; frame += 1) {
        const time = frame / fixtureContext.sampleRate;
        const kickAge = time % 0.25;
        const snareAge = (time + 0.25) % 0.5;
        const hatAge = time % 0.125;
        const noise = random() * 2 - 1;
        const kickPhase = 2 * Math.PI * (46 * kickAge + 2.8 * (1 - Math.exp(-28 * kickAge)));
        const kick = Math.sin(kickPhase) * Math.exp(-18 * kickAge);
        const snare = noise * Math.exp(-26 * snareAge) * 0.52;
        const hat = (noise - previousNoise) * Math.exp(-95 * hatAge) * 0.16;
        previousNoise = noise;
        samples[frame] = kick + snare + hat;
    }
    return scaleToRmsDbfs(samples, fixtureContext, -18);
}

function makeBass(fixtureContext) {
    const samples = new Float32Array(fixtureContext.totalFrames);
    const notes = [55, 65.406, 73.416, 82.407];
    for (let frame = 0; frame < samples.length; frame += 1) {
        const time = frame / fixtureContext.sampleRate;
        const noteAge = time % 0.25;
        const frequency = notes[Math.floor(time / 0.25) % notes.length];
        let value = 0;
        for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
            value += Math.sin(2 * Math.PI * frequency * harmonic * time) / harmonic;
        }
        samples[frame] = value * (0.58 + 0.42 * Math.exp(-8 * noteAge));
    }
    return scaleToRmsDbfs(samples, fixtureContext, -18);
}

function makeBrightPoly(fixtureContext) {
    const samples = new Float32Array(fixtureContext.totalFrames);
    const chord = [220, 277.183, 329.628, 415.305];
    for (let frame = 0; frame < samples.length; frame += 1) {
        const time = frame / fixtureContext.sampleRate;
        let value = 0;
        for (let voice = 0; voice < chord.length; voice += 1) {
            for (let harmonic = 1; harmonic <= 9; harmonic += 1) {
                value += Math.sin(2 * Math.PI * chord[voice] * harmonic * time + voice * 0.37) / harmonic;
            }
        }
        samples[frame] = value;
    }
    return scaleToRmsDbfs(samples, fixtureContext, -18);
}

function measuredPower(samples, startFrame, frameCount) {
    let power = 0;
    for (let frame = startFrame; frame < startFrame + frameCount; frame += 1) {
        power += samples[frame] ** 2;
    }
    return power / frameCount;
}

function levelDifferenceDb(reference, output, fixtureContext) {
    const referencePower = measuredPower(reference, fixtureContext.settleFrames, fixtureContext.measureFrames);
    const outputPower = measuredPower(output, fixtureContext.settleFrames, fixtureContext.measureFrames);
    return 10 * Math.log10(Math.max(outputPower / Math.max(referencePower, 1e-30), 1e-30));
}

function nullRms(left, right, fixtureContext) {
    let power = 0;
    const endFrame = fixtureContext.settleFrames + fixtureContext.measureFrames;
    for (let frame = fixtureContext.settleFrames; frame < endFrame; frame += 1) {
        power += (left[frame] - right[frame]) ** 2;
    }
    return Math.sqrt(power / fixtureContext.measureFrames);
}

function assertWithin(value, tolerance, message) {
    if (!Number.isFinite(value) || Math.abs(value) > tolerance) {
        throw new Error(`${message}: ${value.toFixed(3)} dB (limit ${tolerance.toFixed(3)} dB)`);
    }
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-distortion-level-match-"));

try {
    const runtimePath = path.join(temporaryDirectory, "runtime.mjs");
    run("cmaj", ["generate", "--target=javascript", `--output=${runtimePath}`, patchPath]);
    const runtimeSource = await fs.readFile(runtimePath, "utf8");
    const className = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(runtimeSource)?.[1];
    if (!className) throw new Error("Generated distortion runtime has no class");
    await fs.writeFile(runtimePath, `${runtimeSource}\nexport default ${className};\n`, "utf8");
    const { default: RuntimeClass } = await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);

    let sessionID = 25_082_600;
    async function render(fixture, fixtureContext, {
        type = 1,
        driveDb = 36,
        knee = 0.35,
        wet = 1,
        mode: distortionMode = 0,
        calibrationBypass = 0,
    } = {}) {
        const performer = new RuntimeClass();
        await performer.initialise(sessionID, fixtureContext.sampleRate);
        sessionID += 1;
        performer.setInputValue_type(type, 0);
        performer.setInputValue_driveDb(driveDb, 0);
        performer.setInputValue_knee(knee, 0);
        performer.setInputValue_wet(wet, 0);
        performer.setInputValue_mode(distortionMode, 0);
        performer.setInputValue_wetHPHz(40, 0);
        performer.setInputValue_wetLPHz(18_000, 0);
        performer.setInputValue_calibrationBypass(calibrationBypass, 0);

        const output = new Float32Array(fixture.length);
        for (let offset = 0; offset < fixture.length; offset += 512) {
            const frameCount = Math.min(512, fixture.length - offset);
            const inputBlock = fixture.subarray(offset, offset + frameCount);
            performer.setInputStreamFrames_audioIn([inputBlock, inputBlock], frameCount, 0);
            performer.advance(frameCount);
            const outputBlock = new Float32Array(frameCount);
            performer.getOutputFrames_wetOut([outputBlock], frameCount, 0);
            output.set(outputBlock, offset);
        }

        for (const sample of output) {
            if (!Number.isFinite(sample)) throw new Error("Distortion produced non-finite output");
        }
        return output;
    }

    const baseContext = context();
    const basePink = makePink(baseContext);
    const baseSaw = makeFilteredSaw(baseContext);
    const inputLevelsDbfs = [-36, -30, -24, -18];
    const rows = [];

    for (const [fixtureName, baseFixture] of [["pink", basePink], ["filteredSaw110HzLp350Hz12dBPerOct", baseSaw]]) {
        for (const inputRmsDbfs of inputLevelsDbfs) {
            const fixture = atRmsDbfs(baseFixture, baseContext, inputRmsDbfs);
            const rawWet = await render(fixture, baseContext, { calibrationBypass: 1 });
            const compensatedWet = await render(fixture, baseContext, { wet: 1 });
            const mixOnePercent = await render(fixture, baseContext, { wet: 0.01 });
            const mixHalf = await render(fixture, baseContext, { wet: 0.5 });
            const rawWetDb = levelDifferenceDb(fixture, rawWet, baseContext);
            const compensatedWetDb = levelDifferenceDb(fixture, compensatedWet, baseContext);
            const onePercentDb = levelDifferenceDb(fixture, mixOnePercent, baseContext);
            const halfMixDb = levelDifferenceDb(fixture, mixHalf, baseContext);
            const halfVsOnePercentDb = halfMixDb - onePercentDb;
            assertWithin(compensatedWetDb, 1, `${fixtureName} ${inputRmsDbfs} dBFS 100% Wet`);
            assertWithin(halfVsOnePercentDb, 1, `${fixtureName} ${inputRmsDbfs} dBFS Mix 50%-vs-1%`);
            rows.push({ fixtureName, inputRmsDbfs, idealMakeupDb: -rawWetDb, compensatedWetDb, onePercentDb, halfMixDb, halfVsOnePercentDb });
        }
    }

    const reviewProbes = {};
    const continuitySine = makeSine(baseContext, 997, 1);
    const driveZero = await render(continuitySine, baseContext, { driveDb: 0, calibrationBypass: 1 });
    const driveEpsilon = await render(continuitySine, baseContext, { driveDb: 0.0001, calibrationBypass: 1 });
    reviewProbes.driveZeroStepDb = levelDifferenceDb(driveZero, driveEpsilon, baseContext);
    reviewProbes.driveZeroNullRms = nullRms(driveZero, driveEpsilon, baseContext);
    assertWithin(reviewProbes.driveZeroStepDb, 0.01, "Drive 0-to-0.0001 dB level step");
    if (reviewProbes.driveZeroNullRms > 0.0001) throw new Error(`Drive-zero null is discontinuous: ${reviewProbes.driveZeroNullRms}`);

    const startupSine = makeSine(baseContext, 750, 0.5);
    const startupRaw = await render(startupSine, baseContext, { driveDb: 12, calibrationBypass: 1 });
    const startupCompensated = await render(startupSine, baseContext, { driveDb: 12 });
    const settledStart = startupSine.length - 64;
    reviewProbes.startupRawDb = 10 * Math.log10(measuredPower(startupRaw, 0, 64) / measuredPower(startupRaw, settledStart, 64));
    reviewProbes.startupCompensatedDb = 10 * Math.log10(measuredPower(startupCompensated, 0, 64) / measuredPower(startupCompensated, settledStart, 64));
    assertWithin(reviewProbes.startupCompensatedDb, 1, "Fresh 100%-Wet first-64-vs-settled");

    reviewProbes.offGrid = [];
    for (const [type, driveDb, knee] of [[0, 21, 0.5], [1, 21, 0.5], [2, 15, 0.875]]) {
        const output = await render(basePink, baseContext, { type, driveDb, knee });
        const differenceDb = levelDifferenceDb(basePink, output, baseContext);
        assertWithin(differenceDb, 1, `Off-grid Type ${type} Drive ${driveDb} Knee ${knee}`);
        reviewProbes.offGrid.push({ type, driveDb, knee, differenceDb });
    }

    reviewProbes.sampleRates = [];
    for (const sampleRate of [44_100, 96_000, 192_000]) {
        const fixtureContext = context(sampleRate);
        const fixture = makeFilteredSaw(fixtureContext);
        const output = await render(fixture, fixtureContext);
        const differenceDb = levelDifferenceDb(fixture, output, fixtureContext);
        assertWithin(differenceDb, 1, `${sampleRate} Hz filtered saw 100% Wet`);
        reviewProbes.sampleRates.push({ sampleRate, differenceDb });
    }

    let gridWorstDb = 0;
    for (const type of [0, 1, 2]) {
        for (const driveDb of [0, 12, 24, 36]) {
            for (const knee of [0, 0.5, 1]) {
                for (const inputRmsDbfs of [-36, -18]) {
                    const fixture = atRmsDbfs(baseSaw, baseContext, inputRmsDbfs);
                    for (const wet of [0.25, 0.5, 0.75, 1]) {
                        const output = await render(fixture, baseContext, { type, driveDb, knee, wet });
                        const differenceDb = levelDifferenceDb(fixture, output, baseContext);
                        gridWorstDb = Math.max(gridWorstDb, Math.abs(differenceDb));
                        assertWithin(differenceDb, 1, `Filtered-saw grid Type ${type} Drive ${driveDb} Knee ${knee} Wet ${wet}`);
                    }
                }
            }
        }
    }

    let holdoutWorstDb = 0;
    const holdouts = [
        ["drums", makeDrums(baseContext)],
        ["bass", makeBass(baseContext)],
        ["brightPoly", makeBrightPoly(baseContext)],
    ];
    for (const [fixtureName, baseFixture] of holdouts) {
        for (const inputRmsDbfs of [-36, -18]) {
            const fixture = atRmsDbfs(baseFixture, baseContext, inputRmsDbfs);
            for (const settings of [
                { type: 1, driveDb: 36, knee: 0.35 },
                { type: 2, driveDb: 36, knee: 1 },
            ]) {
                for (const wet of [0.25, 0.5, 0.75, 1]) {
                    const output = await render(fixture, baseContext, { ...settings, wet });
                    const differenceDb = levelDifferenceDb(fixture, output, baseContext);
                    holdoutWorstDb = Math.max(holdoutWorstDb, Math.abs(differenceDb));
                    assertWithin(differenceDb, 1, `${fixtureName} ${inputRmsDbfs} dBFS Wet ${wet}`);
                }
            }
        }
    }

    const report = {
        format: "cosimo.distortionLevelMatch",
        version: 2,
        method: "live-stereo-linked-running-power-and-correlation",
        filteredSaw: { frequencyHz: 110, lowPassHz: 350, slopeDbPerOctave: 12 },
        rows,
        reviewProbes,
        gridWorstDb,
        holdoutWorstDb,
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    if (mode === "--experiment-filtered-saw") {
        for (const row of rows) {
            process.stdout.write(
                `${row.fixtureName} input ${row.inputRmsDbfs} dBFS: ideal makeup ${row.idealMakeupDb.toFixed(3)} dB; `
                + `matched Wet ${row.compensatedWetDb.toFixed(3)} dB; Mix 1% ${row.onePercentDb.toFixed(3)} dB; `
                + `Mix 50% ${row.halfMixDb.toFixed(3)} dB; 50%-vs-1% ${row.halfVsOnePercentDb.toFixed(3)} dB\n`,
            );
        }
        for (const inputRmsDbfs of inputLevelsDbfs) {
            const pink = rows.find((row) => row.fixtureName === "pink" && row.inputRmsDbfs === inputRmsDbfs);
            const saw = rows.find((row) => row.fixtureName !== "pink" && row.inputRmsDbfs === inputRmsDbfs);
            process.stdout.write(`ideal-makeup difference saw-minus-pink at ${inputRmsDbfs} dBFS: ${(saw.idealMakeupDb - pink.idealMakeupDb).toFixed(3)} dB\n`);
        }
        process.stdout.write(`Drive 0-to-0.0001 dB: ${reviewProbes.driveZeroStepDb.toFixed(4)} dB; null ${reviewProbes.driveZeroNullRms.toFixed(7)}\n`);
        process.stdout.write(`Fresh 100%-Wet first-64-vs-settled: raw ${reviewProbes.startupRawDb.toFixed(3)} dB; matched ${reviewProbes.startupCompensatedDb.toFixed(3)} dB\n`);
    }

    process.stdout.write(
        `Distortion live level match passed; filtered-saw grid worst ${gridWorstDb.toFixed(3)} dB; `
        + `musical holdout worst ${holdoutWorstDb.toFixed(3)} dB\n`,
    );
} finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
