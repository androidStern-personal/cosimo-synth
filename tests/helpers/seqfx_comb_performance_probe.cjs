"use strict";

const fs = require("node:fs");

const RuntimeClass = require(process.argv[2]);
const config = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

const blockFrames = config.blockFrames;
const zeroLeft = new Float32Array(blockFrames);
const zeroRight = new Float32Array(blockFrames);
const noiseLeft = new Float32Array(blockFrames);
const noiseRight = new Float32Array(blockFrames);
const tailNoiseLeft = new Float32Array(blockFrames);
const tailNoiseRight = new Float32Array(blockFrames);
const outLeft = new Float32Array(blockFrames);
const outRight = new Float32Array(blockFrames);

let randomState = config.seed >>> 0;
function randomBipolar() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return ((randomState / 4294967296) * 2 - 1) * 0.2;
}

for (let index = 0; index < blockFrames; index += 1) {
    noiseLeft[index] = randomBipolar();
    noiseRight[index] = randomBipolar();
    tailNoiseLeft[index] = noiseLeft[index] * 16;
    tailNoiseRight[index] = noiseRight[index] * 16;
}

function applySetup(patch, entries) {
    for (const [kind, endpointID, payload, rampFrames] of entries) {
        if (kind === "value") {
            patch[`setInputValue_${endpointID}`](payload, rampFrames ?? 0);
        } else {
            patch[`sendInputEvent_${endpointID}`](payload);
        }
    }
}

async function createPatch(entries) {
    const patch = new RuntimeClass();
    await patch.initialise(2, config.sampleRate);
    applySetup(patch, entries);
    return patch;
}

function advanceBlocks(patch, count, inputLeft = noiseLeft, inputRight = noiseRight) {
    for (let block = 0; block < count; block += 1) {
        patch.setInputStreamFrames_audioIn([inputLeft, inputRight], blockFrames, 0);
        patch.advance(blockFrames);
        patch.getOutputFrames_audioOut([outLeft, outRight], blockFrames, 0);
        patch.resetOutputEventCount_monitorOut();
    }
}

function advanceFramesAndPeak(patch, totalFrames, inputLeft = zeroLeft, inputRight = zeroRight) {
    let remaining = totalFrames;
    let peak = 0;
    while (remaining > 0) {
        const frames = Math.min(blockFrames, remaining);
        patch.setInputStreamFrames_audioIn([inputLeft, inputRight], frames, 0);
        patch.advance(frames);
        patch.getOutputFrames_audioOut([outLeft, outRight], frames, 0);
        patch.resetOutputEventCount_monitorOut();
        for (let index = 0; index < frames; index += 1) {
            peak = Math.max(peak, Math.abs(outLeft[index]), Math.abs(outRight[index]));
        }
        remaining -= frames;
    }
    return peak;
}

function measureBlocks(patch, count, inputLeft = noiseLeft, inputRight = noiseRight) {
    const started = process.hrtime.bigint();
    advanceBlocks(patch, count, inputLeft, inputRight);
    return Number(process.hrtime.bigint() - started) / 1_000_000;
}

async function measurePostTail() {
    const expired = await createPatch(config.tailSetup);
    const empty = await createPatch(config.emptySetup);

    advanceFramesAndPeak(expired, config.tailStepFrames, tailNoiseLeft, tailNoiseRight);
    advanceFramesAndPeak(empty, config.tailStepFrames);

    const earlyTailPeak = advanceFramesAndPeak(expired, config.expiryProbeFrames);
    advanceFramesAndPeak(empty, config.expiryProbeFrames);
    const preExpiryFrames = config.preExpiryBlocks * blockFrames;
    const preExpiryStart = config.tailIdleStart - preExpiryFrames;
    const framesToPreExpiry = preExpiryStart - config.tailStepFrames - config.expiryProbeFrames;
    advanceFramesAndPeak(expired, framesToPreExpiry);
    advanceFramesAndPeak(empty, framesToPreExpiry);
    const preExpiryMs = measureBlocks(expired, config.preExpiryBlocks, zeroLeft, zeroRight);
    measureBlocks(empty, config.preExpiryBlocks, zeroLeft, zeroRight);
    const postExpiryPeak = advanceFramesAndPeak(expired, config.expiryProbeFrames);
    advanceFramesAndPeak(empty, config.expiryProbeFrames);

    const expiredMs = [];
    const emptyMs = [];
    for (let trial = 0; trial < config.trials; trial += 1) {
        if (trial % 2 === 0) {
            expiredMs.push(measureBlocks(expired, config.trialBlocks, zeroLeft, zeroRight));
            emptyMs.push(measureBlocks(empty, config.trialBlocks, zeroLeft, zeroRight));
        } else {
            emptyMs.push(measureBlocks(empty, config.trialBlocks, zeroLeft, zeroRight));
            expiredMs.push(measureBlocks(expired, config.trialBlocks, zeroLeft, zeroRight));
        }
    }

    return { earlyTailPeak, preExpiryMs, postExpiryPeak, expiredMs, emptyMs };
}

async function measureFastPath() {
    const neutral = await createPatch(config.neutralSetup);
    const advanced = await createPatch(config.advancedSetup);
    advanceBlocks(neutral, config.warmupBlocks);
    advanceBlocks(advanced, config.warmupBlocks);

    const neutralMs = [];
    const advancedMs = [];
    for (let trial = 0; trial < config.trials; trial += 1) {
        if (trial % 2 === 0) {
            neutralMs.push(measureBlocks(neutral, config.trialBlocks));
            advancedMs.push(measureBlocks(advanced, config.trialBlocks));
        } else {
            advancedMs.push(measureBlocks(advanced, config.trialBlocks));
            neutralMs.push(measureBlocks(neutral, config.trialBlocks));
        }
    }

    return { neutralMs, advancedMs };
}

(async () => {
    const fastPath = await measureFastPath();
    const postTail = await measurePostTail();
    process.stdout.write(JSON.stringify({ fastPath, postTail }));
})().catch((error) => {
    process.stderr.write(`${error?.stack || String(error)}\n`);
    process.exitCode = 1;
});
