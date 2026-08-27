import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const acceptedPatchPath = path.join(repoRoot, "tools/enhancer_calibration/EnhancerCalibration.cmajorpatch");
const litePatchPath = path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajorpatch");
const reviewDirectory = path.join(repoRoot, "build/enhancer-lite-review");
const reportPath = path.join(reviewDirectory, "report.json");
const requestedMode = process.argv[2] ?? "--check";

if (requestedMode !== "--check")
    throw new Error("usage: measure_enhancer_lite.mjs [--check]");

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

const liteDefaults = Object.freeze({
    freqHzIn: 130,
    qIn: 0.71,
    modeIn: 0,
    midAmountIn: 0,
    sideAmountIn: 0,
    curveIn: 1,
    saturationModeIn: 0,
    shapeIn: 1,
});

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error)
        throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `${command} failed (${result.status ?? "unknown"}):\n${result.stderr || result.stdout}`,
        );
    }
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

function context(sampleRate, settleSeconds, measureSeconds, extraFrames = 64) {
    const settleFrames = Math.round(sampleRate * settleSeconds);
    const measureFrames = Math.round(sampleRate * measureSeconds);
    return {
        sampleRate,
        settleFrames,
        measureFrames,
        totalFrames: settleFrames + measureFrames + extraFrames,
    };
}

function makeSine(renderContext, frequencyHz, peak) {
    const left = new Float32Array(renderContext.totalFrames);
    const right = new Float32Array(renderContext.totalFrames);
    for (let frame = 0; frame < renderContext.totalFrames; frame += 1) {
        const sample = peak * Math.sin(2 * Math.PI * frequencyHz * frame / renderContext.sampleRate);
        left[frame] = sample;
        right[frame] = sample;
    }
    return { left, right };
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

function stereoRms(stereo, startFrame = 0, frameCount = stereo.left.length - startFrame) {
    let power = 0;
    for (let frame = startFrame; frame < startFrame + frameCount; frame += 1)
        power += stereo.left[frame] ** 2 + stereo.right[frame] ** 2;
    return Math.sqrt(power / (frameCount * 2));
}

function stereoPeak(stereo, startFrame = 0, frameCount = stereo.left.length - startFrame) {
    let peak = 0;
    for (let frame = startFrame; frame < startFrame + frameCount; frame += 1) {
        peak = Math.max(peak, Math.abs(stereo.left[frame]), Math.abs(stereo.right[frame]));
    }
    return peak;
}

function scaleToRmsDbfs(stereo, renderContext, rmsDbfs) {
    const rms = stereoRms(stereo, renderContext.settleFrames, renderContext.measureFrames);
    const scale = 10 ** (rmsDbfs / 20) / Math.max(rms, 1e-15);
    return {
        left: Float32Array.from(stereo.left, (sample) => sample * scale),
        right: Float32Array.from(stereo.right, (sample) => sample * scale),
    };
}

function makeDrums(renderContext) {
    const random = mulberry32(0x1e17d2a1);
    const left = new Float32Array(renderContext.totalFrames);
    const right = new Float32Array(renderContext.totalFrames);
    let previousNoise = 0;
    for (let frame = 0; frame < renderContext.totalFrames; frame += 1) {
        const time = frame / renderContext.sampleRate;
        const kickAge = time % 0.25;
        const snareAge = (time + 0.25) % 0.5;
        const hatAge = time % 0.125;
        const noise = random() * 2 - 1;
        const kickPhase = 2 * Math.PI * (47 * kickAge + 3.1 * (1 - Math.exp(-27 * kickAge)));
        const kick = Math.sin(kickPhase) * Math.exp(-18 * kickAge);
        const snare = noise * Math.exp(-25 * snareAge) * 0.5;
        const hat = (noise - previousNoise) * Math.exp(-96 * hatAge) * 0.16;
        previousNoise = noise;
        left[frame] = kick + snare * 0.84 + hat * 1.1;
        right[frame] = kick + snare * 1.03 - hat * 0.72;
    }
    return scaleToRmsDbfs({ left, right }, renderContext, -18);
}

function makeBass(renderContext) {
    const left = new Float32Array(renderContext.totalFrames);
    const right = new Float32Array(renderContext.totalFrames);
    const notes = [55, 65.406, 73.416, 82.407];
    for (let frame = 0; frame < renderContext.totalFrames; frame += 1) {
        const time = frame / renderContext.sampleRate;
        const noteAge = time % 0.25;
        const frequency = notes[Math.floor(time / 0.25) % notes.length];
        let sample = 0;
        for (let harmonic = 1; harmonic <= 7; harmonic += 1)
            sample += Math.sin(2 * Math.PI * frequency * harmonic * time) / harmonic;
        sample *= 0.58 + 0.42 * Math.exp(-8 * noteAge);
        left[frame] = sample;
        right[frame] = sample;
    }
    return scaleToRmsDbfs({ left, right }, renderContext, -18);
}

function makeBrightPoly(renderContext) {
    const left = new Float32Array(renderContext.totalFrames);
    const right = new Float32Array(renderContext.totalFrames);
    const chord = [220, 277.183, 329.628, 415.305];
    const pans = [-0.72, 0.52, -0.26, 0.76];
    for (let frame = 0; frame < renderContext.totalFrames; frame += 1) {
        const time = frame / renderContext.sampleRate;
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
    return scaleToRmsDbfs({ left, right }, renderContext, -18);
}

function differenceRms(wet, neutral, startFrame, frameCount) {
    let power = 0;
    for (let frame = startFrame; frame < startFrame + frameCount; frame += 1) {
        power += (wet.left[frame] - neutral.left[frame]) ** 2;
        power += (wet.right[frame] - neutral.right[frame]) ** 2;
    }
    return Math.sqrt(power / (frameCount * 2));
}

function contributionTonePeak(wet, neutral, renderContext, frequencyHz) {
    let real = 0;
    let imaginary = 0;
    for (let offset = 0; offset < renderContext.measureFrames; offset += 1) {
        const frame = renderContext.settleFrames + offset;
        const contribution = 0.5 * (
            wet.left[frame] - neutral.left[frame]
            + wet.right[frame] - neutral.right[frame]
        );
        const phase = 2 * Math.PI * frequencyHz * offset / renderContext.sampleRate;
        real += contribution * Math.cos(phase);
        imaginary -= contribution * Math.sin(phase);
    }
    return 2 * Math.hypot(real, imaginary) / renderContext.measureFrames;
}

function dbRatio(value, reference) {
    return 20 * Math.log10(Math.max(value, 1e-30) / Math.max(reference, 1e-30));
}

function sliceStereo(stereo, startFrame, frameCount) {
    return {
        left: stereo.left.slice(startFrame, startFrame + frameCount),
        right: stereo.right.slice(startFrame, startFrame + frameCount),
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
    Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength).copy(wave, 44);
    await fs.writeFile(filePath, wave);
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

let nextSessionID = 26_083_000;

async function render(RuntimeClass, defaults, fixture, renderContext, settings) {
    const performer = new RuntimeClass();
    await performer.initialise(nextSessionID, renderContext.sampleRate);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({ ...defaults, ...settings }))
        performer[`setInputValue_${endpointID}`](value, 0);

    const output = {
        left: new Float32Array(renderContext.totalFrames),
        right: new Float32Array(renderContext.totalFrames),
    };
    for (let offset = 0; offset < renderContext.totalFrames; offset += 512) {
        const frameCount = Math.min(512, renderContext.totalFrames - offset);
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
            if (!Number.isFinite(sample))
                throw new Error("Enhancer runtime produced non-finite output");
        }
    }
    return output;
}

async function renderPair(runtime, fixture, renderContext, settings) {
    const [neutral, wet] = await Promise.all([
        render(runtime.RuntimeClass, runtime.defaults, fixture, renderContext, {}),
        render(runtime.RuntimeClass, runtime.defaults, fixture, renderContext, runtime.mapSettings(settings)),
    ]);
    return { neutral, wet };
}

async function benchmark(runtime, settings) {
    const performer = new runtime.RuntimeClass();
    await performer.initialise(nextSessionID, 48_000);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({
        ...runtime.defaults,
        ...runtime.mapSettings(settings),
    })) {
        performer[`setInputValue_${endpointID}`](value, 0);
    }

    const random = mulberry32(0x51e71a7e);
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
        const elapsedNanoseconds = Number(process.hrtime.bigint() - started);
        samples.push(elapsedNanoseconds / (blocksPerRun * 512));
    }
    samples.sort((leftValue, rightValue) => leftValue - rightValue);
    return samples[Math.floor(samples.length / 2)];
}

async function measureLiteAnalyzer(RuntimeClass, sampleRate) {
    const performer = new RuntimeClass();
    await performer.initialise(nextSessionID, sampleRate);
    nextSessionID += 1;
    for (const [endpointID, value] of Object.entries({
        ...liteDefaults,
        freqHzIn: 1000,
        qIn: 0.71,
        modeIn: 1,
        midAmountIn: 0,
        sideAmountIn: 1,
        curveIn: 1,
        saturationModeIn: 1,
    })) {
        performer[`setInputValue_${endpointID}`](value, 0);
    }

    let renderedFrames = 0;
    const processFrames = (frameCount) => {
        for (let blockStart = 0; blockStart < frameCount; blockStart += 512) {
            const blockFrames = Math.min(512, frameCount - blockStart);
            const left = new Float32Array(blockFrames);
            const right = new Float32Array(blockFrames);
            for (let frame = 0; frame < blockFrames; frame += 1) {
                const sample = 0.5 * Math.sin(
                    2 * Math.PI * 1000 * (renderedFrames + frame) / sampleRate,
                );
                left[frame] = sample;
                right[frame] = -sample;
            }
            performer.setInputStreamFrames_audioIn([left, right], blockFrames, 0);
            performer.advance(blockFrames);
            performer.getOutputFrames_audioOut([
                new Float32Array(blockFrames),
                new Float32Array(blockFrames),
            ], blockFrames, 0);
            renderedFrames += blockFrames;
        }
    };

    processFrames(Math.ceil(sampleRate * 0.05 / 512) * 512);
    const disabledInputEvents = performer.getOutputEventCount_inputSpectrum();
    const disabledOutputEvents = performer.getOutputEventCount_outputSpectrum();
    performer.resetOutputEventCount_inputSpectrum();
    performer.resetOutputEventCount_outputSpectrum();

    performer.sendInputEvent_analyzerEnabledIn(1);
    processFrames(1536);
    const inputEventCount = performer.getOutputEventCount_inputSpectrum();
    const outputEventCount = performer.getOutputEventCount_outputSpectrum();
    const inputFrame = inputEventCount > 0
        ? performer.getOutputEvent_inputSpectrum(inputEventCount - 1).event
        : null;
    const outputFrame = outputEventCount > 0
        ? performer.getOutputEvent_outputSpectrum(outputEventCount - 1).event
        : null;

    if (!inputFrame || !outputFrame)
        throw new Error(`Enhancer Lite analyser did not emit at ${sampleRate} Hz`);
    if (inputFrame.magnitudes.length !== 2048 || outputFrame.magnitudes.length !== 2048)
        throw new Error(`Enhancer Lite analyser returned the wrong bin count at ${sampleRate} Hz`);

    let inputPeakIndex = 0;
    let maximumBeforeAfterDifference = 0;
    for (let bin = 0; bin < inputFrame.magnitudes.length; bin += 1) {
        const inputMagnitude = inputFrame.magnitudes[bin];
        const outputMagnitude = outputFrame.magnitudes[bin];
        if (!Number.isFinite(inputMagnitude) || !Number.isFinite(outputMagnitude))
            throw new Error(`Enhancer Lite analyser returned non-finite data at ${sampleRate} Hz`);
        if (inputMagnitude > inputFrame.magnitudes[inputPeakIndex])
            inputPeakIndex = bin;
        maximumBeforeAfterDifference = Math.max(
            maximumBeforeAfterDifference,
            Math.abs(outputMagnitude - inputMagnitude),
        );
    }

    const peakFrequencyHz = inputPeakIndex * sampleRate / 4096;
    const targetBin = Math.round(1000 * 4096 / sampleRate);
    return {
        sampleRate,
        disabledInputEvents,
        disabledOutputEvents,
        inputEventCount,
        outputEventCount,
        peakFrequencyHz,
        inputFundamentalMagnitude: inputFrame.magnitudes[targetBin],
        outputFundamentalMagnitude: outputFrame.magnitudes[targetBin],
        maximumBeforeAfterDifference,
    };
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-enhancer-lite-"));

try {
    const [AcceptedRuntime, LiteRuntime] = await Promise.all([
        generateRuntime(acceptedPatchPath, path.join(temporaryDirectory, "accepted.mjs")),
        generateRuntime(litePatchPath, path.join(temporaryDirectory, "lite.mjs")),
    ]);
    const accepted = {
        RuntimeClass: AcceptedRuntime,
        defaults: acceptedDefaults,
        mapSettings: acceptedSettings,
        latencySamples: 60,
    };
    const lite = {
        RuntimeClass: LiteRuntime,
        defaults: liteDefaults,
        mapSettings: (settings) => settings,
        latencySamples: 3,
    };

    const harmonicContext = context(48_000, 0.3, 0.5);
    const harmonicFixture = makeSine(harmonicContext, 1000, 10 ** (-12 / 20));
    const [acceptedHarmonicNeutral, liteHarmonicNeutral] = await Promise.all([
        render(AcceptedRuntime, acceptedDefaults, harmonicFixture, harmonicContext, {}),
        render(LiteRuntime, liteDefaults, harmonicFixture, harmonicContext, {}),
    ]);
    const harmonicRows = [];
    for (const curveIn of [0, 1]) {
        for (const saturationModeIn of [0, 1]) {
            for (const midAmountIn of [0.25, 0.5, 0.75, 1]) {
                const settings = {
                    freqHzIn: 1000,
                    qIn: 0.71,
                    modeIn: 0,
                    midAmountIn,
                    sideAmountIn: 0,
                    curveIn,
                    saturationModeIn,
                };
                const [acceptedWet, liteWet] = await Promise.all([
                    render(AcceptedRuntime, acceptedDefaults, harmonicFixture, harmonicContext, acceptedSettings(settings)),
                    render(LiteRuntime, liteDefaults, harmonicFixture, harmonicContext, settings),
                ]);
                const harmonics = [];
                let acceptedEnergy = 0;
                let liteEnergy = 0;
                let errorEnergy = 0;
                for (let harmonic = 1; harmonic <= 9; harmonic += 1) {
                    const acceptedPeak = contributionTonePeak(
                        acceptedWet,
                        acceptedHarmonicNeutral,
                        harmonicContext,
                        1000 * harmonic,
                    );
                    const litePeak = contributionTonePeak(
                        liteWet,
                        liteHarmonicNeutral,
                        harmonicContext,
                        1000 * harmonic,
                    );
                    acceptedEnergy += acceptedPeak ** 2;
                    liteEnergy += litePeak ** 2;
                    errorEnergy += (litePeak - acceptedPeak) ** 2;
                    harmonics.push({
                        harmonic,
                        acceptedPeak,
                        litePeak,
                        errorDb: acceptedPeak >= 1e-7 ? dbRatio(litePeak, acceptedPeak) : null,
                    });
                }
                harmonicRows.push({
                    character: curveIn === 0 ? "tube" : "solid",
                    intensity: saturationModeIn === 0 ? "subtle" : "medium",
                    amount: midAmountIn,
                    contributionLevelDeltaDb: dbRatio(Math.sqrt(liteEnergy), Math.sqrt(acceptedEnergy)),
                    magnitudeErrorRelativeDb: dbRatio(Math.sqrt(errorEnergy), Math.sqrt(acceptedEnergy)),
                    harmonics,
                });
            }
        }
    }

    const responseContext = context(48_000, 0.15, 0.2);
    const responseRows = [];
    for (const centreHz of [100, 1000, 10_000, 18_000]) {
        for (const qIn of [0.3, 0.71, 4, 10]) {
            for (const ratio of [Math.SQRT1_2, 1, Math.SQRT2]) {
                const probeHz = centreHz * ratio;
                if (probeHz < 20 || probeHz > 20_000)
                    continue;
                const fixture = makeSine(responseContext, probeHz, 0.001);
                const settings = {
                    freqHzIn: centreHz,
                    qIn,
                    modeIn: 0,
                    midAmountIn: 0.75,
                    sideAmountIn: 0,
                    curveIn: 1,
                    saturationModeIn: 0,
                };
                const [acceptedPair, litePair] = await Promise.all([
                    renderPair(accepted, fixture, responseContext, settings),
                    renderPair(lite, fixture, responseContext, settings),
                ]);
                const acceptedPeak = contributionTonePeak(
                    acceptedPair.wet,
                    acceptedPair.neutral,
                    responseContext,
                    probeHz,
                );
                const litePeak = contributionTonePeak(
                    litePair.wet,
                    litePair.neutral,
                    responseContext,
                    probeHz,
                );
                responseRows.push({
                    centreHz,
                    q: qIn,
                    probeHz,
                    acceptedPeak,
                    litePeak,
                    errorDb: dbRatio(litePeak, acceptedPeak),
                });
            }
        }
    }

    const aliasContext = context(48_000, 0.3, 0.5);
    const aliasRows = [];
    for (const frequencyHz of [9000, 11_000, 15_000]) {
        const fixture = makeSine(aliasContext, frequencyHz, 10 ** (-12 / 20));
        const settings = {
            freqHzIn: frequencyHz,
            qIn: 0.71,
            modeIn: 0,
            midAmountIn: 1,
            sideAmountIn: 0,
            curveIn: 1,
            saturationModeIn: 1,
        };
        const [acceptedPair, litePair] = await Promise.all([
            renderPair(accepted, fixture, aliasContext, settings),
            renderPair(lite, fixture, aliasContext, settings),
        ]);
        const acceptedFundamental = contributionTonePeak(
            acceptedPair.wet,
            acceptedPair.neutral,
            aliasContext,
            frequencyHz,
        );
        const liteFundamental = contributionTonePeak(
            litePair.wet,
            litePair.neutral,
            aliasContext,
            frequencyHz,
        );
        for (const harmonic of [3, 5]) {
            const remainder = (frequencyHz * harmonic) % aliasContext.sampleRate;
            const foldedHz = remainder > aliasContext.sampleRate * 0.5
                ? aliasContext.sampleRate - remainder
                : remainder;
            if (foldedHz === frequencyHz)
                continue;
            const acceptedAlias = contributionTonePeak(
                acceptedPair.wet,
                acceptedPair.neutral,
                aliasContext,
                foldedHz,
            );
            const liteAlias = contributionTonePeak(
                litePair.wet,
                litePair.neutral,
                aliasContext,
                foldedHz,
            );
            aliasRows.push({
                frequencyHz,
                harmonic,
                foldedHz,
                acceptedDbc: dbRatio(acceptedAlias, acceptedFundamental),
                liteDbc: dbRatio(liteAlias, liteFundamental),
            });
        }
    }

    const sampleRateRows = [];
    for (const sampleRate of [44_100, 48_000, 96_000, 192_000]) {
        const renderContext = context(sampleRate, 0.25, 0.5);
        const fixture = makeSine(renderContext, 1000, 0.1);
        const settings = {
            freqHzIn: 1000,
            qIn: 0.71,
            modeIn: 0,
            midAmountIn: 0.75,
            sideAmountIn: 0,
            curveIn: 1,
            saturationModeIn: 1,
        };
        const [acceptedPair, litePair] = await Promise.all([
            renderPair(accepted, fixture, renderContext, settings),
            renderPair(lite, fixture, renderContext, settings),
        ]);
        sampleRateRows.push({
            sampleRate,
            acceptedPeak: contributionTonePeak(
                acceptedPair.wet,
                acceptedPair.neutral,
                renderContext,
                1000,
            ),
            litePeak: contributionTonePeak(
                litePair.wet,
                litePair.neutral,
                renderContext,
                1000,
            ),
        });
    }
    const lite48Peak = sampleRateRows.find(({ sampleRate }) => sampleRate === 48_000).litePeak;
    for (const row of sampleRateRows)
        row.liteDeltaFrom48Db = dbRatio(row.litePeak, lite48Peak);

    const analyzerRows = await Promise.all(
        [44_100, 48_000, 96_000, 192_000].map((sampleRate) => (
            measureLiteAnalyzer(LiteRuntime, sampleRate)
        )),
    );

    await fs.mkdir(reviewDirectory, { recursive: true });
    const musicalContext = context(48_000, 0.3, 1.5);
    const musicalFixtures = [
        ["bass", makeBass(musicalContext), {
            freqHzIn: 130, qIn: 0.71, modeIn: 0, midAmountIn: 0.8,
            sideAmountIn: 0, curveIn: 1, saturationModeIn: 0,
        }],
        ["drums", makeDrums(musicalContext), {
            freqHzIn: 4000, qIn: 0.71, modeIn: 0, midAmountIn: 0.7,
            sideAmountIn: 0, curveIn: 1, saturationModeIn: 1,
        }],
        ["bright-poly", makeBrightPoly(musicalContext), {
            freqHzIn: 9000, qIn: 0.71, modeIn: 1, midAmountIn: 0.4,
            sideAmountIn: 0.8, curveIn: 0, saturationModeIn: 1,
        }],
    ];
    const musicalRows = [];
    for (const [name, fixture, settings] of musicalFixtures) {
        const [acceptedPair, litePair] = await Promise.all([
            renderPair(accepted, fixture, musicalContext, settings),
            renderPair(lite, fixture, musicalContext, settings),
        ]);
        const acceptedContributionRms = differenceRms(
            acceptedPair.wet,
            acceptedPair.neutral,
            musicalContext.settleFrames,
            musicalContext.measureFrames,
        );
        const liteContributionRms = differenceRms(
            litePair.wet,
            litePair.neutral,
            musicalContext.settleFrames,
            musicalContext.measureFrames,
        );
        const acceptedNeutralRms = stereoRms(
            acceptedPair.neutral,
            musicalContext.settleFrames,
            musicalContext.measureFrames,
        );
        const liteNeutralRms = stereoRms(
            litePair.neutral,
            musicalContext.settleFrames,
            musicalContext.measureFrames,
        );
        musicalRows.push({
            name,
            settings,
            acceptedContributionRelativeDb: dbRatio(acceptedContributionRms, acceptedNeutralRms),
            liteContributionRelativeDb: dbRatio(liteContributionRms, liteNeutralRms),
            contributionLevelDeltaDb: dbRatio(liteContributionRms, acceptedContributionRms),
            acceptedWetRmsDeltaDb: dbRatio(
                stereoRms(acceptedPair.wet, musicalContext.settleFrames, musicalContext.measureFrames),
                acceptedNeutralRms,
            ),
            liteWetRmsDeltaDb: dbRatio(
                stereoRms(litePair.wet, musicalContext.settleFrames, musicalContext.measureFrames),
                liteNeutralRms,
            ),
            acceptedPeak: stereoPeak(
                acceptedPair.wet,
                musicalContext.settleFrames,
                musicalContext.measureFrames,
            ),
            litePeak: stereoPeak(
                litePair.wet,
                musicalContext.settleFrames,
                musicalContext.measureFrames,
            ),
        });
        await Promise.all([
            writeFloatWave(
                path.join(reviewDirectory, `${name}-dry.wav`),
                sliceStereo(fixture, musicalContext.settleFrames, musicalContext.measureFrames),
                musicalContext.sampleRate,
            ),
            writeFloatWave(
                path.join(reviewDirectory, `${name}-accepted.wav`),
                sliceStereo(
                    acceptedPair.wet,
                    musicalContext.settleFrames + accepted.latencySamples,
                    musicalContext.measureFrames,
                ),
                musicalContext.sampleRate,
            ),
            writeFloatWave(
                path.join(reviewDirectory, `${name}-lite.wav`),
                sliceStereo(
                    litePair.wet,
                    musicalContext.settleFrames + lite.latencySamples,
                    musicalContext.measureFrames,
                ),
                musicalContext.sampleRate,
            ),
        ]);
    }

    const benchmarkSettings = {
        freqHzIn: 1000,
        qIn: 0.71,
        modeIn: 1,
        midAmountIn: 0.75,
        sideAmountIn: 0.5,
        curveIn: 0,
        saturationModeIn: 1,
    };
    const [acceptedNanosecondsPerFrame, liteNanosecondsPerFrame] = await Promise.all([
        benchmark(accepted, benchmarkSettings),
        benchmark(lite, benchmarkSettings),
    ]);
    const speedup = acceptedNanosecondsPerFrame / liteNanosecondsPerFrame;

    const worstResponseErrorDb = Math.max(...responseRows.map(({ errorDb }) => Math.abs(errorDb)));
    const worstMagnitudeErrorRelativeDb = Math.max(
        ...harmonicRows.map(({ magnitudeErrorRelativeDb }) => magnitudeErrorRelativeDb),
    );
    const worstMusicalContributionDeltaDb = Math.max(
        ...musicalRows.map(({ contributionLevelDeltaDb }) => Math.abs(contributionLevelDeltaDb)),
    );
    const sampleRateSpreadDb = Math.max(...sampleRateRows.map(({ liteDeltaFrom48Db }) => (
        liteDeltaFrom48Db
    ))) - Math.min(...sampleRateRows.map(({ liteDeltaFrom48Db }) => liteDeltaFrom48Db));
    const worstLiteAliasDbc = Math.max(...aliasRows.map(({ liteDbc }) => liteDbc));
    const relevantAliasRows = aliasRows.filter(({ acceptedDbc }) => acceptedDbc >= -80);
    const deepAliasRows = aliasRows.filter(({ acceptedDbc }) => acceptedDbc < -80);
    const worstRelevantAliasRegressionDb = Math.max(
        ...relevantAliasRows.map(({ acceptedDbc, liteDbc }) => liteDbc - acceptedDbc),
    );
    const worstDeepLiteAliasDbc = Math.max(...deepAliasRows.map(({ liteDbc }) => liteDbc));

    const report = {
        format: "cosimo.enhancerLiteEvidence",
        version: 1,
        comparison: {
            accepted: "cmajor/Enhancer.cmajor, band 1 only, de-emphasis 0%",
            lite: "cmajor/EnhancerLite.cmajor",
            note: "The benchmark compares the accepted complete two-band bus against the one-band Lite bus.",
        },
        fixedArchitecture: {
            oversampling: "4x two-stage polyphase IIR",
            shaper: "odd rational tanh approximation",
            deEmphasis: "absent",
            programDependentGainCompensation: false,
            declaredLatencySamples: 3,
            analyzer: "editor-gated stereo-power input/output FFT",
        },
        thresholds: {
            maximumResponseErrorDb: 0.5,
            maximumMagnitudeErrorRelativeDb: -18,
            maximumMusicalContributionDeltaDb: 1,
            maximumSampleRateSpreadDb: 0.35,
            maximumLiteAliasDbc: -40,
            maximumRelevantAliasRegressionDb: 12,
            maximumDeepLiteAliasDbc: -75,
            minimumBenchmarkSpeedup: 1.5,
            maximumAnalyzerPeakFrequencyErrorHz: 50,
            minimumAnalyzerFundamentalMagnitude: 0.3,
            minimumAnalyzerBeforeAfterDifference: 0.0001,
        },
        summary: {
            worstResponseErrorDb,
            worstMagnitudeErrorRelativeDb,
            worstMusicalContributionDeltaDb,
            sampleRateSpreadDb,
            worstLiteAliasDbc,
            worstRelevantAliasRegressionDb,
            worstDeepLiteAliasDbc,
            acceptedNanosecondsPerFrame,
            liteNanosecondsPerFrame,
            speedup,
        },
        harmonicRows,
        responseRows,
        aliasRows,
        sampleRateRows,
        analyzerRows,
        musicalRows,
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const failures = [];
    if (worstResponseErrorDb > report.thresholds.maximumResponseErrorDb)
        failures.push(`response error ${worstResponseErrorDb.toFixed(3)} dB`);
    if (worstMagnitudeErrorRelativeDb > report.thresholds.maximumMagnitudeErrorRelativeDb)
        failures.push(`harmonic magnitude error ${worstMagnitudeErrorRelativeDb.toFixed(2)} dB relative`);
    if (worstMusicalContributionDeltaDb > report.thresholds.maximumMusicalContributionDeltaDb)
        failures.push(`musical contribution delta ${worstMusicalContributionDeltaDb.toFixed(3)} dB`);
    if (sampleRateSpreadDb > report.thresholds.maximumSampleRateSpreadDb)
        failures.push(`sample-rate spread ${sampleRateSpreadDb.toFixed(3)} dB`);
    if (worstLiteAliasDbc > report.thresholds.maximumLiteAliasDbc)
        failures.push(`alias floor ${worstLiteAliasDbc.toFixed(2)} dBc`);
    if (worstRelevantAliasRegressionDb > report.thresholds.maximumRelevantAliasRegressionDb) {
        failures.push(
            `relevant alias regression ${worstRelevantAliasRegressionDb.toFixed(2)} dB`,
        );
    }
    if (worstDeepLiteAliasDbc > report.thresholds.maximumDeepLiteAliasDbc)
        failures.push(`deep alias floor ${worstDeepLiteAliasDbc.toFixed(2)} dBc`);
    if (speedup < report.thresholds.minimumBenchmarkSpeedup)
        failures.push(`benchmark speedup ${speedup.toFixed(2)}x`);
    for (const row of analyzerRows) {
        if (row.disabledInputEvents !== 0 || row.disabledOutputEvents !== 0)
            failures.push(`analyser emitted while disabled at ${row.sampleRate} Hz`);
        if (row.inputEventCount === 0 || row.outputEventCount === 0)
            failures.push(`analyser endpoint missing at ${row.sampleRate} Hz`);
        if (Math.abs(row.peakFrequencyHz - 1000)
            > report.thresholds.maximumAnalyzerPeakFrequencyErrorHz)
            failures.push(`analyser peak frequency ${row.peakFrequencyHz.toFixed(1)} Hz at ${row.sampleRate} Hz`);
        if (row.inputFundamentalMagnitude
            < report.thresholds.minimumAnalyzerFundamentalMagnitude)
            failures.push(`analyser lost Side signal at ${row.sampleRate} Hz`);
        if (row.maximumBeforeAfterDifference
            < report.thresholds.minimumAnalyzerBeforeAfterDifference)
            failures.push(`analyser input/output traces matched at ${row.sampleRate} Hz`);
    }
    if (failures.length > 0) {
        throw new Error(
            `Enhancer Lite evidence failed: ${failures.join("; ")}. Report: ${reportPath}`,
        );
    }

    process.stdout.write(
        `Enhancer Lite evidence passed: ${speedup.toFixed(2)}x benchmark speedup, `
        + `${worstResponseErrorDb.toFixed(3)} dB worst response error, `
        + `${worstMusicalContributionDeltaDb.toFixed(3)} dB worst musical contribution delta. `
        + `Review bundle: ${reviewDirectory}\n`,
    );
} finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
