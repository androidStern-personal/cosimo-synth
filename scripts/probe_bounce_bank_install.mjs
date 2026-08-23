import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

const generatedPath = path.resolve(process.argv[2] ?? "build/web/cmaj_Cosimo_Synth.js");
const sampleRate = 48_000;
const blockFrames = 128;
const sessionID = 33_701;
const rootCount = 19;
const framesPerRoot = sampleRate * 6;
const totalFrameCount = rootCount * framesPerRoot;
const batchCapacity = 6_000;

function percentile(values, amount) {
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * amount) - 1);
    return sorted[index];
}

function summarize(values, includeAudioDeadline = true) {
    const summary = {
        count: values.length,
        p50Ms: percentile(values, 0.5),
        p95Ms: percentile(values, 0.95),
        p99Ms: percentile(values, 0.99),
        maxMs: Math.max(...values),
    };
    if (includeAudioDeadline) {
        summary.deadlineMisses = values
            .filter((value) => value > (blockFrames / sampleRate) * 1_000).length;
    }
    return summary;
}

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function syntheticMipSamples(mipIndex) {
    const samplesPerFrame = 2_048;
    const samples = new Float32Array(samplesPerFrame * 3);
    const cycleLength = Math.min(2_048, Math.max(256, (1 << mipIndex) * 32));
    for (let index = 0; index < samplesPerFrame; index += 1) {
        samples[index] = Math.sin((2 * Math.PI * (index % cycleLength)) / cycleLength);
    }
    return samples;
}

async function loadGeneratedClass(filePath) {
    const source = await fs.readFile(filePath, "utf8");
    const match = /^class\s+(\w+)/m.exec(source);
    assert.ok(match?.index !== undefined, `${filePath} does not contain a generated Cmajor class`);
    return Function(`${source.slice(match.index)}\nreturn ${match[1]};`)();
}

function installSyntheticOscillator(performer) {
    performer.sendInputEvent_wavetableLoadBegin({
        dspSessionId: sessionID,
        oscillatorIndex: 0,
        generation: 1,
        tableIndex: 0,
        frameCount: 1,
    });
    performer.advance(1);
    for (let mipIndex = 0; mipIndex < 11; mipIndex += 1) {
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

function timedAdvance(performer) {
    const startedAt = performance.now();
    performer.advance(blockFrames);
    return performance.now() - startedAt;
}

const CmajorClass = await loadGeneratedClass(generatedPath);
const performer = new CmajorClass();
await performer.initialise(sessionID, sampleRate);
installSyntheticOscillator(performer);
performer.setInputValue_sourceMode(0, 0);
performer.setInputValue_filterMode(0, 0);
performer.setInputValue_oscAVolumeDb(0, 0);
performer.setInputValue_oscBVolumeDb(-48, 0);
performer.setInputValue_oscCVolumeDb(-48, 0);
performer.sendInputEvent_midiIn({ message: packMidi(0x90, 60, 100) });
for (let index = 0; index < 64; index += 1) performer.advance(blockFrames);

const rootNotes = new Int32Array(rootCount);
const rootFrameOffsets = new Int32Array(rootCount);
const rootFrameCounts = new Int32Array(rootCount);
for (let rootIndex = 0; rootIndex < rootCount; rootIndex += 1) {
    rootNotes[rootIndex] = 24 + (rootIndex * 4);
    rootFrameOffsets[rootIndex] = rootIndex * framesPerRoot;
    rootFrameCounts[rootIndex] = framesPerRoot;
}

let deliverySerial = 1;
performer.sendInputEvent_bounceBankLoadBegin({
    dspSessionId: sessionID,
    generation: 1,
    deliverySerial,
    sampleRate,
    rootCount,
    totalFrameCount,
    rootNotes,
    rootFrameOffsets,
    rootFrameCounts,
});
performer.advance(blockFrames);
deliverySerial += 1;

const packedFrames = new Int32Array(batchCapacity);
for (let index = 0; index < packedFrames.length; index += 1) {
    const left = ((index * 97) % 4_001) - 2_000;
    const right = ((index * 193) % 3_001) - 1_500;
    packedFrames[index] = ((right & 0xffff) << 16) | (left & 0xffff);
}

const controlBlockMs = [];
const uploadBlockMs = [];
const hostSendMs = [];
const installStartedAt = performance.now();
for (let frameOffset = 0; frameOffset < totalFrameCount; frameOffset += batchCapacity) {
    controlBlockMs.push(timedAdvance(performer));
    const frameCount = Math.min(batchCapacity, totalFrameCount - frameOffset);
    const sendStartedAt = performance.now();
    performer.sendInputEvent_bounceBankFrameBatch({
        dspSessionId: sessionID,
        generation: 1,
        deliverySerial,
        frameIndexBase: frameOffset,
        frameCount,
        packedFrames,
    });
    hostSendMs.push(performance.now() - sendStartedAt);
    uploadBlockMs.push(timedAdvance(performer));

    const ackCount = performer.getOutputEventCount_bounceBankUploadAck();
    assert.equal(ackCount, 1, `batch ${deliverySerial} must receive exactly one ack`);
    const ack = performer.getOutputEvent_bounceBankUploadAck(0).event;
    assert.equal(ack.receivedFrameCount, frameOffset + frameCount);
    performer.resetOutputEventCount_bounceBankUploadAck();
    deliverySerial += 1;
}
const installWallMs = performance.now() - installStartedAt;

performer.sendInputEvent_bounceBankCommit({
    dspSessionId: sessionID,
    generation: 1,
    deliverySerial,
});
performer.advance(blockFrames);
const runtimeCount = performer.getOutputEventCount_bounceBankRuntimeState();
assert.ok(runtimeCount > 0);
const runtimeState = performer.getOutputEvent_bounceBankRuntimeState(runtimeCount - 1).event;
assert.equal(runtimeState.activeGeneration, 1);
assert.equal(runtimeState.activeFrameCount, totalFrameCount);

const control = summarize(controlBlockMs);
const upload = summarize(uploadBlockMs);
const result = {
    format: "cosimo.bounceBankInstallProbe",
    version: 1,
    generatedPath,
    sampleRate,
    blockFrames,
    blockDeadlineMs: (blockFrames / sampleRate) * 1_000,
    rootCount,
    framesPerRoot,
    totalFrameCount,
    bankBytes: totalFrameCount * 4,
    batchCapacity,
    batchCount: uploadBlockMs.length,
    generatedMemoryBytes: performer.byteMemory.byteLength,
    installWallMs,
    control,
    upload,
    hostSend: summarize(hostSendMs, false),
    uploadP95RegressionPercent: ((upload.p95Ms / control.p95Ms) - 1) * 100,
};

console.log(JSON.stringify(result, null, 2));
