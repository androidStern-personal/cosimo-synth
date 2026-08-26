import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { quantizeFloatToInt16 } from "../bounce/bank-format.mjs";

const generatedPath = path.resolve(
    process.env.COSIMO_BOUNCE_GENERATED_PATH ?? "build/web/cmaj_Cosimo_Synth.js",
);
const sampleRate = 48_000;
const blockFrames = 128;
const bankRootCapacity = 19;
const bankBatchFrames = 6_000;
const captureVelocity = 100;

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function packStereoFrame(left, right) {
    return ((right & 0xffff) << 16) | (left & 0xffff);
}

async function loadGeneratedClass() {
    const source = await fs.readFile(generatedPath, "utf8");
    const classMatch = /^class\s+(\w+)/m.exec(source);
    assert.ok(classMatch?.index !== undefined, `${generatedPath} must contain a Cmajor class`);
    const classSource = source.slice(classMatch.index);
    return Function(`${classSource}\nreturn ${classMatch[1]};`)();
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

function channel(rendered, channelIndex) {
    const samples = new Float32Array(rendered.length / 2);
    for (let frame = 0; frame < samples.length; frame += 1) {
        samples[frame] = rendered[(frame * 2) + channelIndex];
    }
    return samples;
}

function rms(samples) {
    let sumSquares = 0;
    for (const sample of samples) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / samples.length);
}

function meanAbsolute(samples) {
    let sum = 0;
    for (const sample of samples) sum += Math.abs(sample);
    return sum / samples.length;
}

function maxInterSampleStep(...renderedBlocks) {
    let maximum = 0;
    let previousLeft = 0;
    let previousRight = 0;
    let hasPrevious = false;
    for (const rendered of renderedBlocks) {
        for (let offset = 0; offset < rendered.length; offset += 2) {
            const left = rendered[offset];
            const right = rendered[offset + 1];
            if (hasPrevious) {
                maximum = Math.max(
                    maximum,
                    Math.abs(left - previousLeft),
                    Math.abs(right - previousRight),
                );
            }
            previousLeft = left;
            previousRight = right;
            hasPrevious = true;
        }
    }
    return maximum;
}

function estimateFrequency(samples, firstFrame, lastFrame) {
    const crossings = [];
    for (let frame = firstFrame + 1; frame < lastFrame; frame += 1) {
        const previous = samples[frame - 1];
        const current = samples[frame];
        if (previous <= 0 && current > 0) {
            crossings.push((frame - 1) + (-previous / (current - previous)));
        }
    }
    assert.ok(crossings.length >= 2, "frequency window must contain two upward crossings");
    return (crossings.length - 1) * sampleRate / (crossings.at(-1) - crossings[0]);
}

function makeConstantStereo(frameCount, left, right) {
    const samples = new Int16Array(frameCount * 2);
    const leftI16 = quantizeFloatToInt16(left);
    const rightI16 = quantizeFloatToInt16(right);
    for (let frame = 0; frame < frameCount; frame += 1) {
        samples[frame * 2] = leftI16;
        samples[(frame * 2) + 1] = rightI16;
    }
    return samples;
}

function makeSineStereo(frameCount, frequency, amplitude = 0.02) {
    const samples = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
        const value = quantizeFloatToInt16(
            Math.sin((2 * Math.PI * frequency * frame) / sampleRate) * amplitude,
        );
        samples[frame * 2] = value;
        samples[(frame * 2) + 1] = value;
    }
    return samples;
}

function buildUpload(roots) {
    const rootNotes = new Int32Array(bankRootCapacity);
    const rootFrameOffsets = new Int32Array(bankRootCapacity);
    const rootFrameCounts = new Int32Array(bankRootCapacity);
    const rootNoteOffFrameOffsets = new Int32Array(bankRootCapacity);
    let totalFrameCount = 0;
    for (let index = 0; index < roots.length; index += 1) {
        const root = roots[index];
        assert.ok(root.samples instanceof Int16Array && root.samples.length % 2 === 0);
        rootNotes[index] = root.note;
        rootFrameOffsets[index] = totalFrameCount;
        rootFrameCounts[index] = root.samples.length / 2;
        rootNoteOffFrameOffsets[index] = root.noteOffFrameOffset ?? 0;
        totalFrameCount += rootFrameCounts[index];
    }
    const packedFrames = new Int32Array(totalFrameCount);
    let frameOffset = 0;
    for (const root of roots) {
        for (let frame = 0; frame < root.samples.length / 2; frame += 1) {
            packedFrames[frameOffset] = packStereoFrame(
                root.samples[frame * 2],
                root.samples[(frame * 2) + 1],
            );
            frameOffset += 1;
        }
    }
    return {
        rootCount: roots.length,
        rootNotes,
        rootFrameOffsets,
        rootFrameCounts,
        rootNoteOffFrameOffsets,
        totalFrameCount,
        packedFrames,
    };
}

function sendBankBegin(performer, sessionID, generation, serial, upload) {
    performer.sendInputEvent_bounceBankLoadBegin({
        dspSessionId: sessionID,
        generation,
        deliverySerial: serial,
        sampleRate,
        rootCount: upload.rootCount,
        totalFrameCount: upload.totalFrameCount,
        rootNotes: upload.rootNotes,
        rootFrameOffsets: upload.rootFrameOffsets,
        rootFrameCounts: upload.rootFrameCounts,
        rootNoteOffFrameOffsets: upload.rootNoteOffFrameOffsets,
    });
    performer.advance(2);
}

function sendBankBatch(performer, sessionID, generation, serial, frameIndexBase, frames) {
    const packedFrames = new Int32Array(bankBatchFrames);
    packedFrames.set(frames);
    performer.sendInputEvent_bounceBankFrameBatch({
        dspSessionId: sessionID,
        generation,
        deliverySerial: serial,
        frameIndexBase,
        frameCount: frames.length,
        packedFrames,
    });
    performer.advance(2);
}

function installBank(performer, sessionID, generation, upload, firstSerial = 1) {
    let serial = firstSerial;
    sendBankBegin(performer, sessionID, generation, serial, upload);
    serial += 1;
    for (let offset = 0; offset < upload.totalFrameCount; offset += bankBatchFrames) {
        const count = Math.min(bankBatchFrames, upload.totalFrameCount - offset);
        sendBankBatch(
            performer,
            sessionID,
            generation,
            serial,
            offset,
            upload.packedFrames.subarray(offset, offset + count),
        );
        serial += 1;
    }
    performer.sendInputEvent_bounceBankCommit({
        dspSessionId: sessionID,
        generation,
        deliverySerial: serial,
    });
    performer.advance(2);
    return serial + 1;
}

function latestRuntimeState(performer) {
    const count = performer.getOutputEventCount_bounceBankRuntimeState();
    assert.ok(count > 0, "the engine must publish Bounce bank readiness");
    return performer.getOutputEvent_bounceBankRuntimeState(count - 1).event;
}

async function createSamplerPerformer(CmajorClass, sessionID) {
    const performer = new CmajorClass();
    await performer.initialise(sessionID, sampleRate);
    performer.setInputValue_sourceMode(1, 0);
    performer.setInputValue_filterMode(0, 0);
    performer.setInputValue_ampRelease(0.2, 0);
    performer.advance(8);
    return performer;
}

function noteOn(performer, note, velocity = captureVelocity, channelIndex = 0) {
    performer.sendInputEvent_midiIn({
        message: packMidi(0x90 | channelIndex, note, velocity),
    });
}

function noteOff(performer, note, channelIndex = 0) {
    performer.sendInputEvent_midiIn({
        message: packMidi(0x80 | channelIndex, note, 0),
    });
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

function installSyntheticWavetable(performer, sessionID, oscillatorIndex) {
    performer.sendInputEvent_wavetableLoadBegin({
        dspSessionId: sessionID,
        oscillatorIndex,
        generation: 1,
        tableIndex: oscillatorIndex,
        frameCount: 1,
    });
    performer.advance(1);
    for (let mipIndex = 0; mipIndex < 11; mipIndex += 1) {
        performer.sendInputEvent_wavetableMipFrame({
            dspSessionId: sessionID,
            oscillatorIndex,
            generation: 1,
            tableIndex: oscillatorIndex,
            mipIndex,
            frameIndexBase: 0,
            frameCount: 1,
            samples: syntheticMipSamples(mipIndex),
        });
        performer.advance(1);
    }
}

function renderOscillatorRegression(performer, sessionID) {
    installSyntheticWavetable(performer, sessionID, 0);
    performer.setInputValue_oscAVolumeDb(0, 0);
    performer.setInputValue_oscBVolumeDb(-48, 0);
    performer.setInputValue_oscCVolumeDb(-48, 0);
    performer.setInputValue_filterMode(0, 0);
    performer.setInputValue_ampRelease(0.2, 0);
    noteOn(performer, 60, 100);
    const held = renderFrames(performer, 12_000);
    noteOff(performer, 60);
    const released = renderFrames(performer, 14_400);
    const all = new Float32Array(held.length + released.length);
    all.set(held);
    all.set(released, held.length);
    return crypto.createHash("sha256")
        .update(new Uint8Array(all.buffer, all.byteOffset, all.byteLength))
        .digest("hex");
}

async function measureOscillatorGlobalTune(CmajorClass, oscillatorIndex, sessionID) {
    const oscillatorID = ["A", "B", "C"][oscillatorIndex];
    const neighbourID = ["B", "C", "A"][oscillatorIndex];
    const performer = new CmajorClass();
    await performer.initialise(sessionID, sampleRate);
    performer.setInputValue_sourceMode(0, 0);
    performer.setInputValue_filterMode(0, 0);
    performer.setInputValue_ampRelease(0.005, 0);
    performer[`setInputValue_osc${oscillatorID}Solo`](1, 0);
    performer[`setInputValue_osc${oscillatorID}VolumeDb`](0, 0);
    installSyntheticWavetable(performer, sessionID, oscillatorIndex);
    performer.advance(128);

    const measureHeldFrequency = () => {
        noteOn(performer, 60, 100);
        const audio = channel(renderFrames(performer, 12_000), 0);
        noteOff(performer, 60);
        renderFrames(performer, 2_000);
        return estimateFrequency(audio, 3_000, 11_000);
    };

    const neutralHz = measureHeldFrequency();
    performer[`setInputValue_osc${neighbourID}Octave`](1, 0);
    performer[`setInputValue_osc${neighbourID}Semitone`](7, 0);
    performer[`setInputValue_osc${neighbourID}FineCents`](50, 0);
    performer.advance(128);
    const afterPrivateNeighbourTuneHz = measureHeldFrequency();
    performer.setInputValue_globalTune(12, 0);
    performer.advance(128);
    const globalOctaveHz = measureHeldFrequency();

    return { oscillatorID, neutralHz, afterPrivateNeighbourTuneHz, globalOctaveHz };
}

test("Source Mode and Global Tune are append-only and neutral tune retains the M1 render bit-for-bit", async () => {
    const CmajorClass = await loadGeneratedClass();
    const parameterEndpoints = CmajorClass.prototype.getInputEndpoints()
        .filter(({ purpose }) => purpose === "parameter");
    assert.deepEqual(
        parameterEndpoints.slice(-4).map(({ endpointID }) => endpointID),
        ["filterMix", "ampRelease", "sourceMode", "globalTune"],
    );
    const endpoint = parameterEndpoints.find(({ endpointID }) => endpointID === "sourceMode");
    assert.ok(endpoint);
    assert.equal(endpoint.annotation?.text, "Oscillator|Bounce");
    assert.equal(endpoint.annotation?.init, 0);
    const globalTuneEndpoint = parameterEndpoints.find(({ endpointID }) => endpointID === "globalTune");
    assert.ok(globalTuneEndpoint);
    assert.equal(globalTuneEndpoint.annotation?.min, -24);
    assert.equal(globalTuneEndpoint.annotation?.max, 24);
    assert.equal(globalTuneEndpoint.annotation?.init, 0);
    assert.notEqual(globalTuneEndpoint.annotation?.discrete, true);

    const sessionID = 42_201;
    const performer = new CmajorClass();
    await performer.initialise(sessionID, sampleRate);
    performer.setInputValue_sourceMode(0, 0);
    performer.setInputValue_globalTune(0, 0);
    assert.equal(
        renderOscillatorRegression(performer, sessionID),
        "8d930510bc1f7e522b999a94cb36159bc2787a99844295838ae581f36a935561",
        "sourceMode=oscillator must match the committed pre-M2 performer",
    );
});

test("Global Tune +12 doubles every oscillator while neighbouring private tune remains private", async () => {
    const CmajorClass = await loadGeneratedClass();
    for (const oscillatorIndex of [0, 1, 2]) {
        const result = await measureOscillatorGlobalTune(
            CmajorClass,
            oscillatorIndex,
            42_220 + oscillatorIndex,
        );
        assert.ok(result.neutralHz > 20, `${result.oscillatorID} must produce a measurable pitch`);
        assert.ok(
            Math.abs((result.afterPrivateNeighbourTuneHz / result.neutralHz) - 1) < 0.02,
            `${result.oscillatorID} moved when another oscillator's private tune changed`,
        );
        assert.ok(
            Math.abs((result.globalOctaveHz / result.neutralHz) - 2) < 0.03,
            `${result.oscillatorID} Global Tune ratio was ${result.globalOctaveHz / result.neutralHz}`,
        );
    }
});

test("staging is silent until commit and an aborted replacement preserves the active bank", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_202;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    const upload = buildUpload([{ note: 60, samples: makeConstantStereo(12_000, 0.02, -0.01) }]);

    sendBankBegin(performer, sessionID, 1, 1, upload);
    sendBankBatch(performer, sessionID, 1, 2, 0, upload.packedFrames.subarray(0, 6_000));
    assert.deepEqual(
        Object.fromEntries(Object.entries(latestRuntimeState(performer)).filter(([key]) => [
            "hasActive", "hasStaging", "stagingReceivedFrameCount", "stagingExpectedFrameCount",
        ].includes(key))),
        { hasActive: 0, hasStaging: 1, stagingReceivedFrameCount: 0, stagingExpectedFrameCount: 12_000 },
    );
    // Runtime state is emitted at begin; progress is ack-driven.
    const ack = performer.getOutputEvent_bounceBankUploadAck(0).event;
    assert.equal(ack.receivedFrameCount, 6_000);
    noteOn(performer, 60);
    assert.equal(rms(renderFrames(performer, 1_500)), 0, "a partial bank must not be audible");
    noteOff(performer, 60);

    sendBankBatch(performer, sessionID, 1, 3, 6_000, upload.packedFrames.subarray(6_000));
    performer.sendInputEvent_bounceBankCommit({
        dspSessionId: sessionID,
        generation: 1,
        deliverySerial: 4,
    });
    performer.advance(2);
    assert.equal(latestRuntimeState(performer).activeGeneration, 1);
    noteOn(performer, 60, captureVelocity, 1);
    assert.ok(rms(renderFrames(performer, 1_500)) > 0.005, "the committed bank must be audible");
    noteOff(performer, 60, 1);

    sendBankBegin(performer, sessionID, 2, 5, upload);
    performer.sendInputEvent_bounceBankAbort({
        dspSessionId: sessionID,
        generation: 2,
        deliverySerial: 6,
        failureReasonCode: 3,
    });
    performer.advance(2);
    const stateAfterAbort = latestRuntimeState(performer);
    assert.equal(stateAfterAbort.activeGeneration, 1);
    assert.equal(stateAfterAbort.hasStaging, 0);
});

test("root playback matches captured PCM within one i16 step and restores the 0.18 trim", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_203;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    const frameCount = 4_000;
    const source = new Int16Array(frameCount * 2);
    let random = 0x12345678;
    for (let frame = 700; frame < frameCount; frame += 1) {
        random = ((random * 1_664_525) + 1_013_904_223) >>> 0;
        source[frame * 2] = ((random >>> 16) % 1_801) - 900;
        random = ((random * 1_664_525) + 1_013_904_223) >>> 0;
        source[(frame * 2) + 1] = ((random >>> 16) % 1_401) - 700;
    }
    installBank(performer, sessionID, 1, buildUpload([{ note: 60, samples: source }]));
    noteOn(performer, 60, captureVelocity);
    const rendered = renderFrames(performer, frameCount);
    const tolerance = (1 / 32_768) + 1e-7;
    let maximumDifference = 0;
    for (let frame = 800; frame < frameCount - 2; frame += 1) {
        for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
            const expected = source[(frame * 2) + channelIndex] / 32_768;
            maximumDifference = Math.max(
                maximumDifference,
                Math.abs(rendered[(frame * 2) + channelIndex] - expected),
            );
        }
    }
    assert.ok(maximumDifference <= tolerance, `root A/B max error ${maximumDifference}`);

    const expectedRms = rms(Float32Array.from(source.subarray(1_000 * 2, 3_000 * 2), (x) => x / 32_768));
    const actualRms = rms(rendered.subarray(1_000 * 2, 3_000 * 2));
    assert.ok(Math.abs(actualRms / expectedRms - 1) < 0.001, "makeup must cancel the 0.18 trim");
    assert.ok(Math.abs(actualRms / expectedRms - 0.18) > 0.5, "the unmade-up level must be impossible");
});

test("nearest-root selection, rate repitch, and polyphony are voice-correct", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_204;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    const leftRoot = makeConstantStereo(12_000, 0.012, 0);
    const rightRoot = makeConstantStereo(12_000, 0, 0.018);
    installBank(performer, sessionID, 1, buildUpload([
        { note: 60, samples: leftRoot },
        { note: 64, samples: rightRoot },
    ]));

    noteOn(performer, 62, captureVelocity);
    let rendered = renderFrames(performer, 1_600);
    assert.ok(meanAbsolute(channel(rendered, 0).subarray(900)) > 0.01, "ties choose lower root");
    assert.ok(meanAbsolute(channel(rendered, 1).subarray(900)) < 1e-7);
    noteOff(performer, 62);
    renderFrames(performer, 3_000);

    noteOn(performer, 60, captureVelocity, 0);
    noteOn(performer, 64, captureVelocity, 1);
    rendered = renderFrames(performer, 1_600);
    assert.ok(meanAbsolute(channel(rendered, 0).subarray(900)) > 0.01);
    assert.ok(meanAbsolute(channel(rendered, 1).subarray(900)) > 0.015);

    const rateSessionID = 42_205;
    const ratePerformer = await createSamplerPerformer(CmajorClass, rateSessionID);
    installBank(ratePerformer, rateSessionID, 1, buildUpload([
        { note: 60, samples: makeSineStereo(24_000, 440) },
    ]));
    noteOn(ratePerformer, 62, captureVelocity);
    const pitched = channel(renderFrames(ratePerformer, 8_000), 0);
    const measuredHz = estimateFrequency(pitched, 1_500, 7_500);
    const expectedHz = 440 * (2 ** (2 / 12));
    assert.ok(Math.abs(measuredHz - expectedHz) < 5, `${measuredHz} Hz should be ${expectedHz} Hz`);

    const tunedSessionID = 42_215;
    const tunedPerformer = await createSamplerPerformer(CmajorClass, tunedSessionID);
    installBank(tunedPerformer, tunedSessionID, 1, buildUpload([
        { note: 60, samples: makeSineStereo(24_000, 440) },
    ]));
    tunedPerformer.setInputValue_globalTune(12, 0);
    tunedPerformer.advance(128);
    noteOn(tunedPerformer, 62, captureVelocity);
    const octavePitched = channel(renderFrames(tunedPerformer, 8_000), 0);
    const octaveMeasuredHz = estimateFrequency(octavePitched, 1_500, 7_500);
    assert.ok(
        Math.abs(octaveMeasuredHz - (expectedHz * 2)) < 10,
        `Global Tune +12 measured ${octaveMeasuredHz} Hz instead of ${expectedHz * 2} Hz`,
    );
});

test("live velocity scales loudness and early note-off follows Amp Release", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_206;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    installBank(performer, sessionID, 1, buildUpload([
        { note: 60, samples: makeConstantStereo(24_000, 0.02, 0.02) },
    ]));

    noteOn(performer, 60, 50);
    const quiet = meanAbsolute(channel(renderFrames(performer, 1_600), 0).subarray(900));
    noteOff(performer, 60);
    renderFrames(performer, 5_000);
    noteOn(performer, 60, 100);
    const loud = meanAbsolute(channel(renderFrames(performer, 1_600), 0).subarray(900));
    assert.ok(Math.abs((quiet / loud) - 0.5) < 0.01, `velocity ratio was ${quiet / loud}`);

    performer.setInputValue_ampRelease(0.05, 0);
    performer.advance(4);
    noteOff(performer, 60);
    const released = channel(renderFrames(performer, 6_000), 0);
    assert.ok(rms(released.subarray(0, 500)) > 1e-5, "release begins audibly");
    assert.equal(rms(released.subarray(5_000)), 0, "the early release must reach silence");
});

test("a release at the bank's baked note-off is not applied a second time", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_207;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    installBank(performer, sessionID, 1, buildUpload([{
        note: 60,
        noteOffFrameOffset: 3_000,
        samples: makeConstantStereo(12_000, 0.02, 0.02),
    }]));
    performer.setInputValue_ampRelease(0.005, 0);
    performer.advance(4);
    noteOn(performer, 60, captureVelocity);
    renderFrames(performer, 3_000);
    noteOff(performer, 60);
    const afterBakedNoteOff = channel(renderFrames(performer, 2_000), 0);
    assert.ok(rms(afterBakedNoteOff.subarray(1_000)) > 0.015,
        "already-baked release audio must survive the fresh gate");
});

test("source swaps and note boundaries stay below the committed click ceiling", async (t) => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_208;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    performer.setInputValue_ampRelease(0.05, 0);
    performer.advance(4);
    installBank(performer, sessionID, 1, buildUpload([{
        note: 60,
        samples: makeSineStereo(24_000, 440, 0.12),
    }]));

    const preNote = renderFrames(performer, 32);
    noteOn(performer, 60, captureVelocity);
    // End near a sine peak so an unfaded swap would make a ~0.12 FS step.
    const held = renderFrames(performer, 2_973);
    performer.setInputValue_sourceMode(0, 0);
    const toOscillator = renderFrames(performer, 512);
    performer.setInputValue_sourceMode(1, 0);
    const toBounce = renderFrames(performer, 512);
    noteOff(performer, 60);
    const released = renderFrames(performer, 6_000);

    // 0.01 FS is -40 dBFS: a conservative ceiling for an isolated
    // one-sample discontinuity. The deliberate 440 Hz / 0.12 FS signal has
    // legitimate adjacent steps around 0.0069 FS, leaving meaningful margin.
    const clickCeiling = 0.01;
    const maximumStep = maxInterSampleStep(
        preNote,
        held,
        toOscillator,
        toBounce,
        released,
    );
    t.diagnostic(`G4 maximum inter-sample step: ${maximumStep.toFixed(8)} FS (${(
        20 * Math.log10(Math.max(maximumStep, Number.EPSILON))
    ).toFixed(2)} dBFS); ceiling ${clickCeiling.toFixed(5)} FS (-40.00 dBFS)`);
    assert.ok(
        maximumStep < clickCeiling,
        `maximum inter-sample step ${maximumStep} exceeded ${clickCeiling}`,
    );
});

test("legato glide continuously repitches the in-flight sample", async () => {
    const CmajorClass = await loadGeneratedClass();
    const sessionID = 42_207;
    const performer = await createSamplerPerformer(CmajorClass, sessionID);
    performer.setInputValue_playMode(2, 0);
    performer.setInputValue_glideTime(0.08, 0);
    performer.advance(8);
    installBank(performer, sessionID, 1, buildUpload([
        { note: 60, samples: makeSineStereo(40_000, 220) },
    ]));

    noteOn(performer, 60, captureVelocity);
    const before = channel(renderFrames(performer, 4_000), 0);
    noteOn(performer, 72, captureVelocity);
    const duringAndAfter = channel(renderFrames(performer, 8_000), 0);
    const beforeHz = estimateFrequency(before, 1_500, 3_800);
    const afterHz = estimateFrequency(duringAndAfter, 5_500, 7_800);
    assert.ok(Math.abs(beforeHz - 220) < 7, `pre-glide frequency was ${beforeHz}`);
    assert.ok(Math.abs(afterHz - 440) < 10, `post-glide frequency was ${afterHz}`);
});
