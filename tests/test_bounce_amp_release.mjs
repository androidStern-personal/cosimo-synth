import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const generatedPath = path.resolve(
    process.env.COSIMO_BOUNCE_GENERATED_PATH ?? "build/web/cmaj_Cosimo_Synth.js",
);
const sampleRate = 48_000;
const blockFrames = 128;
const mipLevelCount = 11;
const samplesPerFrame = 2_048;
const uploadBatchSamples = samplesPerFrame * 3;
const sessionID = 41_201;

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

async function loadGeneratedClass() {
    const source = await fs.readFile(generatedPath, "utf8");
    const classMatch = /^class\s+(\w+)/m.exec(source);
    assert.ok(classMatch?.index !== undefined, `${generatedPath} must contain a Cmajor class`);
    const classSource = source.slice(classMatch.index);
    return Function(`${classSource}\nreturn ${classMatch[1]};`)();
}

function installDryTestTable(performer) {
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

function renderFrames(performer, frameCount) {
    const rendered = new Float32Array(frameCount * 2);
    let frameOffset = 0;

    while (frameOffset < frameCount) {
        const currentBlock = Math.min(blockFrames, frameCount - frameOffset);
        performer.advance(currentBlock);
        const channels = [new Float32Array(currentBlock), new Float32Array(currentBlock)];
        performer.getOutputFrames_audioOut(channels, currentBlock, 0);

        for (let frame = 0; frame < currentBlock; frame += 1) {
            rendered[(frameOffset + frame) * 2] = channels[0][frame];
            rendered[((frameOffset + frame) * 2) + 1] = channels[1][frame];
        }
        frameOffset += currentBlock;
    }

    return rendered;
}

function rms(samples) {
    let sumSquares = 0;
    for (const sample of samples) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / samples.length);
}

function assertFloatArraysExactlyEqual(actual, expected, label) {
    assert.equal(actual.length, expected.length, `${label} length`);
    for (let index = 0; index < actual.length; index += 1) {
        if (!Object.is(actual[index], expected[index])) {
            assert.fail(
                `${label} first differs at sample ${index}: ${actual[index]} !== ${expected[index]}`,
            );
        }
    }
}

async function renderRelease(CmajorClass, releaseSeconds) {
    const performer = new CmajorClass();
    await performer.initialise(sessionID, sampleRate);
    installDryTestTable(performer);
    performer.setInputValue_oscAVolumeDb(0, 0);
    performer.setInputValue_oscBVolumeDb(-48, 0);
    performer.setInputValue_oscCVolumeDb(-48, 0);
    performer.setInputValue_filterMode(0, 0);
    performer.setInputValue_ampAttack(0.01, 0);
    performer.setInputValue_ampDecay(0.001, 0);
    performer.setInputValue_ampSustain(1, 0);
    if (releaseSeconds !== undefined) performer.setInputValue_ampRelease(releaseSeconds, 0);

    performer.sendInputEvent_midiIn({ message: packMidi(0x90, 60, 100) });
    const held = renderFrames(performer, Math.round(sampleRate * 0.25));
    performer.sendInputEvent_midiIn({ message: packMidi(0x80, 60, 0) });
    const released = renderFrames(performer, Math.round(sampleRate * 2.5));
    return { held, released };
}

test("the complete Amp Envelope is exposed without moving the established Release slot", async () => {
    const CmajorClass = await loadGeneratedClass();
    const endpoints = CmajorClass.prototype.getInputEndpoints();
    const endpointByID = new Map(endpoints.map((endpoint) => [endpoint.endpointID, endpoint]));
    const expectedStages = [
        ["ampAttack", 0.001, 10, 0.01],
        ["ampDecay", 0.001, 10, 0.001],
        ["ampSustain", 0, 1, 1],
        ["ampRelease", 0.005, 10, 0.2],
    ];

    for (const [endpointID, min, max, initial] of expectedStages) {
        const endpoint = endpointByID.get(endpointID);
        assert.ok(endpoint, `generated patch must expose ${endpointID}`);
        assert.ok(Math.abs(Number(endpoint.annotation?.init) - initial) < 1e-6, endpointID);
        assert.ok(Math.abs(Number(endpoint.annotation?.min) - min) < 1e-6, endpointID);
        assert.equal(endpoint.annotation?.max, max, endpointID);
    }

    const parameterEndpoints = endpoints
        .filter(({ purpose }) => purpose === "parameter");
    assert.deepEqual(
        parameterEndpoints.slice(-6).map(({ endpointID }) => endpointID),
        ["ampRelease", "sourceMode", "globalTune", "ampAttack", "ampDecay", "ampSustain"],
    );
});

test("a dry voice with a 3 second Amp Release remains audible 2 seconds after note-off", async () => {
    const CmajorClass = await loadGeneratedClass();
    const { held, released } = await renderRelease(CmajorClass, 3);
    const windowStart = Math.round(sampleRate * 2) * 2;
    const windowEnd = windowStart + (Math.round(sampleRate * 0.05) * 2);
    assert.ok(rms(held) > 1e-3, "the dry held voice must be audible");
    assert.ok(
        rms(released.subarray(windowStart, windowEnd)) > 1e-5,
        "the release tail must still contain audio two seconds after note-off",
    );
});

test("the default Amp Release is bit-identical to an explicit 0.2 second release", async () => {
    const CmajorClass = await loadGeneratedClass();
    const implicit = await renderRelease(CmajorClass, undefined);
    const explicit = await renderRelease(CmajorClass, 0.2);
    assertFloatArraysExactlyEqual(implicit.held, explicit.held, "held audio");
    assertFloatArraysExactlyEqual(implicit.released, explicit.released, "released audio");

    const postReleaseStart = Math.round(sampleRate * 0.3) * 2;
    assert.equal(rms(implicit.released.subarray(postReleaseStart)), 0);
});
