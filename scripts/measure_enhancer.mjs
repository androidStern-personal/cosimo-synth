import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patchPath = path.join(repoRoot, "tools/enhancer_calibration/EnhancerCalibration.cmajorpatch");
const reviewDirectory = path.join(repoRoot, "build/t26-enhancer-review");
const reportPath = path.join(reviewDirectory, "report.json");
const requestedMode = process.argv[2] ?? "--check";

if (requestedMode !== "--check") {
    throw new Error("usage: measure_enhancer.mjs [--check]");
}

const defaultSettings = Object.freeze({
    b1FreqHzIn: 130,
    b1QIn: 0.71,
    b1MidAmountIn: 0,
    b1SideAmountIn: 0,
    b1CurveIn: 1,
    b2FreqHzIn: 9000,
    b2QIn: 0.71,
    b2MidAmountIn: 0,
    b2SideAmountIn: 0,
    b2CurveIn: 0,
});

function run(command, args) {
    const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} failed (${result.status ?? "unknown"}):\n${result.stderr || result.stdout}`);
    }
}

function fixtureContext(sampleRate) {
    const settleFrames = Math.round(sampleRate * 0.4);
    const measureFrames = Math.round(sampleRate * 2);
    return {
        sampleRate,
        settleFrames,
        measureFrames,
        totalFrames: settleFrames + measureFrames,
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

function stereoPower(stereo, startFrame, frameCount) {
    let power = 0;
    for (let frame = startFrame; frame < startFrame + frameCount; frame += 1) {
        power += stereo.left[frame] ** 2 + stereo.right[frame] ** 2;
    }
    return power / (frameCount * 2);
}

function scaleToRmsDbfs(stereo, context, rmsDbfs) {
    const rms = Math.sqrt(stereoPower(stereo, context.settleFrames, context.measureFrames));
    const scale = 10 ** (rmsDbfs / 20) / Math.max(rms, 1e-15);
    return {
        left: Float32Array.from(stereo.left, (sample) => sample * scale),
        right: Float32Array.from(stereo.right, (sample) => sample * scale),
    };
}

function makePink(context) {
    const commonRandom = mulberry32(0x26e10001);
    const leftRandom = mulberry32(0x26e10002);
    const rightRandom = mulberry32(0x26e10003);
    const left = new Float32Array(context.totalFrames);
    const right = new Float32Array(context.totalFrames);
    const states = Array.from({ length: 3 }, () => new Float64Array(7));

    function nextPink(random, state) {
        const white = random() * 2 - 1;
        state[0] = 0.99886 * state[0] + white * 0.0555179;
        state[1] = 0.99332 * state[1] + white * 0.0750759;
        state[2] = 0.969 * state[2] + white * 0.153852;
        state[3] = 0.8665 * state[3] + white * 0.3104856;
        state[4] = 0.55 * state[4] + white * 0.5329522;
        state[5] = -0.7616 * state[5] - white * 0.016898;
        const pink = state[0] + state[1] + state[2] + state[3]
            + state[4] + state[5] + state[6] + white * 0.5362;
        state[6] = white * 0.115926;
        return pink;
    }

    for (let frame = -context.settleFrames; frame < context.totalFrames; frame += 1) {
        const common = nextPink(commonRandom, states[0]);
        const independentLeft = nextPink(leftRandom, states[1]);
        const independentRight = nextPink(rightRandom, states[2]);
        if (frame >= 0) {
            left[frame] = common * 0.78 + independentLeft * 0.22;
            right[frame] = common * 0.78 + independentRight * 0.22;
        }
    }
    return scaleToRmsDbfs({ left, right }, context, -18);
}

function makeDrums(context) {
    const random = mulberry32(0x26d12f00);
    const left = new Float32Array(context.totalFrames);
    const right = new Float32Array(context.totalFrames);
    let previousNoise = 0;
    for (let frame = 0; frame < context.totalFrames; frame += 1) {
        const time = frame / context.sampleRate;
        const kickAge = time % 0.25;
        const snareAge = (time + 0.25) % 0.5;
        const hatAge = time % 0.125;
        const noise = random() * 2 - 1;
        const kickPhase = 2 * Math.PI * (46 * kickAge + 2.8 * (1 - Math.exp(-28 * kickAge)));
        const kick = Math.sin(kickPhase) * Math.exp(-18 * kickAge);
        const snare = noise * Math.exp(-26 * snareAge) * 0.52;
        const hat = (noise - previousNoise) * Math.exp(-95 * hatAge) * 0.16;
        previousNoise = noise;
        left[frame] = kick + snare * 0.86 + hat * 1.12;
        right[frame] = kick + snare * 1.04 - hat * 0.74;
    }
    return scaleToRmsDbfs({ left, right }, context, -18);
}

function makeBass(context) {
    const left = new Float32Array(context.totalFrames);
    const right = new Float32Array(context.totalFrames);
    const notes = [55, 65.406, 73.416, 82.407];
    for (let frame = 0; frame < context.totalFrames; frame += 1) {
        const time = frame / context.sampleRate;
        const noteAge = time % 0.25;
        const frequency = notes[Math.floor(time / 0.25) % notes.length];
        let sample = 0;
        for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
            sample += Math.sin(2 * Math.PI * frequency * harmonic * time) / harmonic;
        }
        sample *= 0.58 + 0.42 * Math.exp(-8 * noteAge);
        left[frame] = sample;
        right[frame] = sample;
    }
    return scaleToRmsDbfs({ left, right }, context, -18);
}

function makeBrightPoly(context) {
    const left = new Float32Array(context.totalFrames);
    const right = new Float32Array(context.totalFrames);
    const chord = [220, 277.183, 329.628, 415.305];
    const pans = [-0.72, 0.52, -0.26, 0.76];
    for (let frame = 0; frame < context.totalFrames; frame += 1) {
        const time = frame / context.sampleRate;
        for (let voice = 0; voice < chord.length; voice += 1) {
            let sample = 0;
            for (let harmonic = 1; harmonic <= 9; harmonic += 1) {
                sample += Math.sin(
                    2 * Math.PI * chord[voice] * harmonic * time + voice * 0.37,
                ) / harmonic;
            }
            left[frame] += sample * Math.sqrt((1 - pans[voice]) * 0.5);
            right[frame] += sample * Math.sqrt((1 + pans[voice]) * 0.5);
        }
    }
    return scaleToRmsDbfs({ left, right }, context, -18);
}

function measuredSlice(stereo, context) {
    const endFrame = context.settleFrames + context.measureFrames;
    return {
        left: stereo.left.slice(context.settleFrames, endFrame),
        right: stereo.right.slice(context.settleFrames, endFrame),
    };
}

function interleave(stereo) {
    const interleaved = new Float32Array(stereo.left.length * 2);
    for (let frame = 0; frame < stereo.left.length; frame += 1) {
        interleaved[frame * 2] = stereo.left[frame];
        interleaved[frame * 2 + 1] = stereo.right[frame];
    }
    return interleaved;
}

function integratedLufs(stereo, sampleRate) {
    const interleaved = interleave(stereo);
    const result = spawnSync("ffmpeg", [
        "-hide_banner", "-nostats",
        "-f", "f32le", "-ar", String(sampleRate), "-ac", "2", "-i", "pipe:0",
        "-filter_complex", "ebur128", "-f", "null", "-",
    ], {
        cwd: repoRoot,
        input: Buffer.from(interleaved.buffer),
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`ffmpeg ebur128 failed (${result.status ?? "unknown"}):\n${result.stderr}`);
    }
    const matches = [...result.stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?) LUFS/g)];
    const integrated = Number(matches.at(-1)?.[1]);
    if (!Number.isFinite(integrated)) {
        throw new Error("ffmpeg did not report integrated LUFS");
    }
    return integrated;
}

function rmsDifferenceDb(dry, wet) {
    return 10 * Math.log10(
        Math.max(stereoPower(wet, 0, wet.left.length), 1e-30)
        / Math.max(stereoPower(dry, 0, dry.left.length), 1e-30),
    );
}

function residueRmsDbfs(dry, wet) {
    let power = 0;
    for (let frame = 0; frame < dry.left.length; frame += 1) {
        power += (wet.left[frame] - dry.left[frame]) ** 2;
        power += (wet.right[frame] - dry.right[frame]) ** 2;
    }
    const rms = Math.sqrt(power / (dry.left.length * 2));
    return 20 * Math.log10(Math.max(rms, 1e-30));
}

function maximumDcMean(dry, wet) {
    let leftSum = 0;
    let rightSum = 0;
    for (let frame = 0; frame < dry.left.length; frame += 1) {
        leftSum += wet.left[frame] - dry.left[frame];
        rightSum += wet.right[frame] - dry.right[frame];
    }
    return Math.max(Math.abs(leftSum / dry.left.length), Math.abs(rightSum / dry.left.length));
}

function assertLoudnessBudget(row) {
    if (!Number.isFinite(row.lufsDelta) || Math.abs(row.lufsDelta) > 0.5) {
        throw new Error(`${row.name} changed integrated loudness by ${row.lufsDelta.toFixed(3)} LU`);
    }
    if (!Number.isFinite(row.rmsDeltaDb) || Math.abs(row.rmsDeltaDb) > 0.5) {
        throw new Error(`${row.name} changed RMS by ${row.rmsDeltaDb.toFixed(3)} dB`);
    }
    if (!Number.isFinite(row.residueRmsDbfs) || row.residueRmsDbfs <= -120) {
        throw new Error(`${row.name} did not produce measurable harmonic residue`);
    }
    if (!Number.isFinite(row.maximumResidueDcMean) || row.maximumResidueDcMean > 0.0001) {
        throw new Error(`${row.name} left DC in its residue: ${row.maximumResidueDcMean}`);
    }
}

async function writeFloatWave(filePath, stereo, sampleRate) {
    const interleaved = interleave(stereo);
    const dataBytes = interleaved.byteLength;
    const wave = Buffer.alloc(44 + dataBytes);
    wave.write("RIFF", 0, "ascii");
    wave.writeUInt32LE(36 + dataBytes, 4);
    wave.write("WAVE", 8, "ascii");
    wave.write("fmt ", 12, "ascii");
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(3, 20);
    wave.writeUInt16LE(2, 22);
    wave.writeUInt32LE(sampleRate, 24);
    wave.writeUInt32LE(sampleRate * 8, 28);
    wave.writeUInt16LE(8, 32);
    wave.writeUInt16LE(32, 34);
    wave.write("data", 36, "ascii");
    wave.writeUInt32LE(dataBytes, 40);
    Buffer.from(interleaved.buffer).copy(wave, 44);
    await fs.writeFile(filePath, wave);
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-enhancer-"));

try {
    const runtimePath = path.join(temporaryDirectory, "runtime.mjs");
    run("cmaj", ["generate", "--target=javascript", `--output=${runtimePath}`, patchPath]);
    const runtimeSource = await fs.readFile(runtimePath, "utf8");
    const className = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(runtimeSource)?.[1];
    if (!className) throw new Error("Generated Enhancer runtime has no class");
    await fs.writeFile(runtimePath, `${runtimeSource}\nexport default ${className};\n`, "utf8");
    const { default: RuntimeClass } = await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);

    let sessionID = 26_082_600;
    async function render(fixture, context, settings) {
        const performer = new RuntimeClass();
        await performer.initialise(sessionID, context.sampleRate);
        sessionID += 1;
        for (const [endpointID, value] of Object.entries({ ...defaultSettings, ...settings })) {
            performer[`setInputValue_${endpointID}`](value, 0);
        }

        const output = {
            left: new Float32Array(context.totalFrames),
            right: new Float32Array(context.totalFrames),
        };
        for (let offset = 0; offset < context.totalFrames; offset += 512) {
            const frameCount = Math.min(512, context.totalFrames - offset);
            performer.setInputStreamFrames_audioIn([
                fixture.left.subarray(offset, offset + frameCount),
                fixture.right.subarray(offset, offset + frameCount),
            ], frameCount, 0);
            performer.advance(frameCount);
            const leftBlock = new Float32Array(frameCount);
            const rightBlock = new Float32Array(frameCount);
            performer.getOutputFrames_audioOut([leftBlock, rightBlock], frameCount, 0);
            output.left.set(leftBlock, offset);
            output.right.set(rightBlock, offset);
        }

        for (const channel of [output.left, output.right]) {
            for (const sample of channel) {
                if (!Number.isFinite(sample)) throw new Error("Enhancer produced non-finite output");
            }
        }
        return output;
    }

    const baseContext = fixtureContext(48_000);
    const fixtures = new Map([
        ["pink", makePink(baseContext)],
        ["drums", makeDrums(baseContext)],
        ["bass", makeBass(baseContext)],
        ["bright-poly", makeBrightPoly(baseContext)],
    ]);
    const pink = fixtures.get("pink");
    const neutral = await render(pink, baseContext, defaultSettings);
    for (let frame = 0; frame < baseContext.totalFrames; frame += 1) {
        if (neutral.left[frame] !== pink.left[frame] || neutral.right[frame] !== pink.right[frame]) {
            throw new Error(`Neutral Enhancer render differed from dry at frame ${frame}`);
        }
    }

    const pinkProbes = [
        ["band-1-mid-full", { b1MidAmountIn: 1 }],
        ["band-1-side-full", { b1SideAmountIn: 1 }],
        ["band-2-mid-full", { b2MidAmountIn: 1 }],
        ["band-2-side-full", { b2SideAmountIn: 1 }],
    ];
    const musicalSettings = {
        b1MidAmountIn: 0.7,
        b1SideAmountIn: 0.35,
        b2MidAmountIn: 0.35,
        b2SideAmountIn: 0.7,
    };

    async function measure(name, fixture, settings) {
        const rendered = await render(fixture, baseContext, settings);
        const dry = measuredSlice(fixture, baseContext);
        const wet = measuredSlice(rendered, baseContext);
        const dryLufs = integratedLufs(dry, baseContext.sampleRate);
        const wetLufs = integratedLufs(wet, baseContext.sampleRate);
        const row = {
            name,
            dryLufs,
            wetLufs,
            lufsDelta: wetLufs - dryLufs,
            rmsDeltaDb: rmsDifferenceDb(dry, wet),
            residueRmsDbfs: residueRmsDbfs(dry, wet),
            maximumResidueDcMean: maximumDcMean(dry, wet),
        };
        assertLoudnessBudget(row);
        return { row, dry, wet };
    }

    const pinkRows = [];
    for (const [name, settings] of pinkProbes) {
        const { row } = await measure(name, pink, settings);
        pinkRows.push(row);
    }

    await fs.mkdir(reviewDirectory, { recursive: true });
    const musicalRows = [];
    for (const [name, fixture] of fixtures) {
        if (name === "pink") continue;
        const measurement = await measure(name, fixture, musicalSettings);
        musicalRows.push(measurement.row);
        await Promise.all([
            writeFloatWave(path.join(reviewDirectory, `${name}-dry.wav`), measurement.dry, baseContext.sampleRate),
            writeFloatWave(path.join(reviewDirectory, `${name}-enhanced.wav`), measurement.wet, baseContext.sampleRate),
        ]);
    }

    const sampleRateRows = [];
    for (const sampleRate of [44_100, 48_000, 96_000, 192_000]) {
        const context = fixtureContext(sampleRate);
        // The 130 Hz default bell is the path most exposed to DC-blocker
        // cutoff drift, so use the bass holdout for the cross-rate comparison.
        const fixture = makeBass(context);
        const rendered = await render(fixture, context, musicalSettings);
        const dry = measuredSlice(fixture, context);
        const wet = measuredSlice(rendered, context);
        const row = {
            sampleRate,
            rmsDeltaDb: rmsDifferenceDb(dry, wet),
            residueRmsDbfs: residueRmsDbfs(dry, wet),
            maximumResidueDcMean: maximumDcMean(dry, wet),
        };
        if (Math.abs(row.rmsDeltaDb) > 0.5 || row.residueRmsDbfs <= -120
            || row.maximumResidueDcMean > 0.0001) {
            throw new Error(`${sampleRate} Hz sample-rate probe failed: ${JSON.stringify(row)}`);
        }
        sampleRateRows.push(row);
    }
    const crossRateResidueSpreadDb = Math.max(
        ...sampleRateRows.map(({ residueRmsDbfs }) => residueRmsDbfs),
    ) - Math.min(...sampleRateRows.map(({ residueRmsDbfs }) => residueRmsDbfs));
    if (crossRateResidueSpreadDb > 0.25) {
        throw new Error(`Low-band residue drifted ${crossRateResidueSpreadDb.toFixed(3)} dB across sample rates`);
    }

    const allLoudnessRows = [...pinkRows, ...musicalRows];
    const report = {
        format: "cosimo.enhancerEvidence",
        version: 1,
        implementation: "cmajor/Enhancer.cmajor",
        oversamplingFactor: 4,
        measureSeconds: 2,
        neutralBitExact: true,
        settings: { pinkProbes, musical: musicalSettings },
        pinkRows,
        musicalRows,
        sampleRateRows,
        crossRateResidueSpreadDb,
        worstAbsoluteLufsDelta: Math.max(...allLoudnessRows.map(({ lufsDelta }) => Math.abs(lufsDelta))),
        worstAbsoluteRmsDeltaDb: Math.max(
            ...allLoudnessRows.map(({ rmsDeltaDb }) => Math.abs(rmsDeltaDb)),
            ...sampleRateRows.map(({ rmsDeltaDb }) => Math.abs(rmsDeltaDb)),
        ),
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(
        `Enhancer evidence passed; LUFS worst ${report.worstAbsoluteLufsDelta.toFixed(3)} LU, `
        + `RMS worst ${report.worstAbsoluteRmsDeltaDb.toFixed(3)} dB; review bundle ${reviewDirectory}\n`,
    );
} finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
