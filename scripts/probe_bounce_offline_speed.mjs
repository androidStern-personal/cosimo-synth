import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

const generatedPath = path.resolve(process.argv[2] ?? "build/web/cmaj_Cosimo_Synth.js");
const sampleRate = 48_000;
const blockFrames = 128;
const captureSecondsPerRoot = 9;
const defaultRootCount = 19;
const projectedWorkerCount = 4;
const sessionID = 31_337;
const mipLevelCount = 11;
const samplesPerFrame = 2_048;
const uploadBatchSamples = samplesPerFrame * 3;

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) * 0.5
        : sorted[middle];
}

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function syntheticMipSamples(mipIndex) {
    const cycleLength = Math.min(2_048, Math.max(256, (1 << mipIndex) * 32));
    const samples = new Float32Array(uploadBatchSamples);
    for (let index = 0; index < samplesPerFrame; index += 1) {
        samples[index] = Math.sin((2 * Math.PI * (index % cycleLength)) / cycleLength);
    }
    return samples;
}

function advanceFrames(performer, frameCount) {
    let remaining = frameCount;
    while (remaining > 0) {
        const currentBlock = Math.min(blockFrames, remaining);
        performer.advance(currentBlock);
        remaining -= currentBlock;
    }
}

async function loadGeneratedClass(filePath) {
    const source = await fs.readFile(filePath, "utf8");
    const classMatch = /^class\s+(\w+)/m.exec(source);
    if (!classMatch || classMatch.index === undefined) {
        throw new Error(`${filePath} does not contain a generated Cmajor class.`);
    }

    // The product artifact has a small ES-module wrapper before the generated
    // class. Evaluating only the class tail keeps this probe useful for both the
    // class-only M3 artifact and today's complete WebAudio module.
    const classSource = source.slice(classMatch.index);
    return Function(`${classSource}\nreturn ${classMatch[1]};`)();
}

function installSyntheticOscillatorA(performer) {
    performer.sendInputEvent_wavetableLoadBegin({
        dspSessionId: sessionID,
        oscillatorIndex: 0,
        generation: 1,
        tableIndex: 0,
        frameCount: 1,
    });
    performer.advance(1);

    for (let mipIndex = 0; mipIndex < mipLevelCount; mipIndex += 1) {
        performer.sendInputEvent_wavetableMipFrame({
            dspSessionId: sessionID,
            oscillatorIndex: 0,
            generation: 1,
            tableIndex: 0,
            mipIndex,
            frameIndexBase: 0,
            frameCount: 1,
            samples: syntheticMipSamples(mipIndex),
        });
        performer.advance(1);
    }
}

function readCurrentOutput(performer) {
    const channels = [new Float32Array(blockFrames), new Float32Array(blockFrames)];
    performer.getOutputFrames_audioOut(channels, blockFrames, 0);
    let sumSquares = 0;
    let peak = 0;
    for (const channel of channels) {
        for (const sample of channel) {
            sumSquares += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
        }
    }
    return {
        peak,
        rms: Math.sqrt(sumSquares / (channels.length * blockFrames)),
    };
}

const CmajorClass = await loadGeneratedClass(generatedPath);
const performer = new CmajorClass();
const initialiseStartedAt = performance.now();
await performer.initialise(sessionID, sampleRate);
const initialisationMs = performance.now() - initialiseStartedAt;

const installStartedAt = performance.now();
installSyntheticOscillatorA(performer);
const installMs = performance.now() - installStartedAt;

performer.setInputValue_oscAVolumeDb(0, 0);
performer.setInputValue_oscBVolumeDb(-48, 0);
performer.setInputValue_oscCVolumeDb(-48, 0);
performer.setInputValue_filterMode(0, 0);
performer.sendInputEvent_midiIn({ message: packMidi(0x90, 60, 100) });
advanceFrames(performer, Math.round(sampleRate * 0.1));

const renderedFrames = sampleRate * 3;
const runs = [];
for (let run = 0; run < 3; run += 1) {
    const startedAt = performance.now();
    advanceFrames(performer, renderedFrames);
    const wallMs = performance.now() - startedAt;
    const output = readCurrentOutput(performer);
    runs.push({
        run: run + 1,
        wallMs,
        speedX: (renderedFrames / sampleRate) / (wallMs / 1_000),
        ...output,
    });
}
performer.sendInputEvent_midiIn({ message: packMidi(0x80, 60, 0) });

if (runs.some(({ peak, rms }) => !Number.isFinite(rms) || peak < 1e-5 || rms < 1e-6)) {
    throw new Error(`Offline speed probe rendered invalid or silent audio: ${JSON.stringify(runs)}`);
}

const medianSpeedX = median(runs.map(({ speedX }) => speedX));
const projectedRenderSeconds = (defaultRootCount * captureSecondsPerRoot) / medianSpeedX;
const projectedInitialisationSeconds = (defaultRootCount * initialisationMs) / 1_000;
const result = {
    format: "cosimo.bounceOfflineSpeed",
    version: 1,
    generatedPath,
    sampleRate,
    renderedFramesPerRun: renderedFrames,
    initialisationMs,
    syntheticInstallMs: installMs,
    runs,
    medianSpeedX,
    projection: {
        rootCount: defaultRootCount,
        captureSecondsPerRoot,
        singleWorkerSeconds: projectedRenderSeconds + projectedInitialisationSeconds,
        fourWorkerSeconds: (projectedRenderSeconds + projectedInitialisationSeconds) / projectedWorkerCount,
    },
};

console.log(JSON.stringify(result, null, 2));
