import assert from "node:assert/strict";
import test from "node:test";
import { quantizeFloatToInt16 } from "../bounce/bank-format.mjs";
import { createHostedPerformer, loadOfflineEngine, outputLatencyFrames } from "./helpers/bounce_offline_engine.mjs";

const sampleRate = 48_000;
const blockFrames = 128;
const bankRootCapacity = 19;
const bankBatchFrames = 6_000;
const captureVelocity = 100;
// A bounced voice released before its recorded note-off fades out over 5 ms.
const releaseFadeFrames = Math.round(sampleRate * 0.005);
// The output path's oversampler settles to exact silence within this many frames.
const outputSettleFrames = 64;

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function packStereoFrame(left, right) {
    return ((right & 0xffff) << 16) | (left & 0xffff);
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

/** A constant recording that rises from silence over its first frames, as a captured attack does. */
function makeRampedConstantStereo(frameCount, left, right, rampFrames = 480) {
    const samples = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
        const level = Math.min(1, (frame + 1) / rampFrames);
        samples[frame * 2] = quantizeFloatToInt16(left * level);
        samples[(frame * 2) + 1] = quantizeFloatToInt16(right * level);
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

/** The synth playing a Bounce bank, as a bounced sound leaves it: Source Mode Bounce, Voice Filter off. */
async function createSamplerPerformer(t, CmajorClass, sessionID) {
    const { performer } = await createHostedPerformer(t, CmajorClass, sessionID, sampleRate, {
        sourceMode: 1,
        filterMode: 0,
    });
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

/** One sine cycle: a dry oscillator table whose pitch is easy to measure. */
function sineFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => Math.sin((2 * Math.PI * index) / 2_048));
}

async function measureOscillatorGlobalTune(t, CmajorClass, oscillatorIndex, sessionID) {
    const oscillatorID = ["A", "B", "C"][oscillatorIndex];
    const neighbourID = ["B", "C", "A"][oscillatorIndex];
    const { performer, prepareWavetables } = await createHostedPerformer(t, CmajorClass, sessionID, sampleRate, {
        filterMode: 0,
        ampRelease: 0.005,
        [`osc${oscillatorID}WavetableSelect`]: oscillatorIndex,
        [`osc${oscillatorID}Mute`]: 0,
        [`osc${oscillatorID}Solo`]: 1,
        [`osc${oscillatorID}VolumeDb`]: 0,
    });
    await prepareWavetables([{
        input: oscillatorIndex,
        generation: 1,
        tableIndex: oscillatorIndex,
        frames: [sineFrame()],
    }]);
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

test("Source Mode and Global Tune are host parameters with their declared choices and range", async () => {
    const CmajorClass = await loadOfflineEngine();
    const parameterEndpoints = CmajorClass.prototype.getInputEndpoints()
        .filter(({ purpose }) => purpose === "parameter");
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
});

test("Global Tune +12 doubles every oscillator while neighbouring private tune remains private", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    for (const oscillatorIndex of [0, 1, 2]) {
        const result = await measureOscillatorGlobalTune(
            t,
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

test("staging is silent until commit and an aborted replacement preserves the active bank", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_202;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
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

test("root playback reproduces the captured PCM level", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_203;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
    const frameCount = 4_000;
    const onsetFrame = 700;
    // Tones well inside the output path's flat band, entering after a silent lead-in.
    const tones = [[0.012, 233, 0.4], [0.009, 587, 1.9], [0.006, 1_301, 4.1]];
    const tone = (frame, channelIndex) => tones.reduce((sum, [amplitude, hz, phase]) => (
        sum + (amplitude * Math.sin((2 * Math.PI * hz * frame / sampleRate) + phase + channelIndex))
    ), 0);
    const source = new Int16Array(frameCount * 2);
    for (let frame = onsetFrame; frame < frameCount; frame += 1) {
        source[frame * 2] = quantizeFloatToInt16(tone(frame, 0));
        source[(frame * 2) + 1] = quantizeFloatToInt16(tone(frame, 1));
    }
    installBank(performer, sessionID, 1, buildUpload([{ note: 60, samples: source }]));
    noteOn(performer, 60, captureVelocity);
    const rendered = renderFrames(performer, frameCount + outputLatencyFrames);

    // The output path's linear-phase oversampler centres its response half a
    // frame before the declared latency; the comparison keeps clear of the
    // sample's onset and end, where that response straddles silence.
    const tolerance = (3 / 32_768) + 1e-7;
    let maximumDifference = 0;
    for (let frame = onsetFrame + 100; frame < frameCount - 64; frame += 1) {
        for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
            const output = rendered[((frame + outputLatencyFrames) * 2) + channelIndex];
            maximumDifference = Math.max(maximumDifference, Math.abs(output - tone(frame + 0.5, channelIndex)));
        }
    }
    assert.ok(maximumDifference <= tolerance, `root A/B max error ${maximumDifference}`);

    const expectedRms = rms(Float32Array.from(source.subarray(1_000 * 2, 3_000 * 2), (x) => x / 32_768));
    const actualRms = rms(rendered.subarray((1_000 + outputLatencyFrames) * 2, (3_000 + outputLatencyFrames) * 2));
    assert.ok(
        Math.abs(actualRms / expectedRms - 1) < 0.005,
        "playback must keep the captured root level",
    );
    assert.ok(Math.abs(actualRms / expectedRms - 0.18) > 0.5, "the unmade-up level must be impossible");
});

test("nearest-root selection, rate repitch, and polyphony are voice-correct", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_204;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
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
    const ratePerformer = await createSamplerPerformer(t, CmajorClass, rateSessionID);
    installBank(ratePerformer, rateSessionID, 1, buildUpload([
        { note: 60, samples: makeSineStereo(24_000, 440) },
    ]));
    noteOn(ratePerformer, 62, captureVelocity);
    const pitched = channel(renderFrames(ratePerformer, 8_000), 0);
    const measuredHz = estimateFrequency(pitched, 1_500, 7_500);
    const expectedHz = 440 * (2 ** (2 / 12));
    assert.ok(Math.abs(measuredHz - expectedHz) < 5, `${measuredHz} Hz should be ${expectedHz} Hz`);

    const tunedSessionID = 42_215;
    const tunedPerformer = await createSamplerPerformer(t, CmajorClass, tunedSessionID);
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

test("live velocity scales loudness and an early key release fades out in 5 ms whatever the Amp Release", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_206;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
    installBank(performer, sessionID, 1, buildUpload([
        { note: 60, samples: makeRampedConstantStereo(24_000, 0.02, 0.02) },
    ]));

    noteOn(performer, 60, 50);
    const quiet = meanAbsolute(channel(renderFrames(performer, 1_600), 0).subarray(900));
    noteOff(performer, 60);
    renderFrames(performer, 5_000);
    noteOn(performer, 60, 100);
    const loud = meanAbsolute(channel(renderFrames(performer, 1_600), 0).subarray(900));
    assert.ok(Math.abs((quiet / loud) - 0.5) < 0.01, `velocity ratio was ${quiet / loud}`);

    performer.setInputValue_ampRelease(3, 0);
    performer.advance(4);
    noteOff(performer, 60);
    const released = channel(renderFrames(performer, 6_000), 0);
    assert.ok(meanAbsolute(released.subarray(0, outputLatencyFrames)) > 0.015,
        "the recording sounds until the release reaches the output");
    assert.equal(rms(released.subarray(outputLatencyFrames + releaseFadeFrames + outputSettleFrames)), 0,
        "the early release must reach silence after its fade, not after the 3 second Amp Release");
});

test("a held key plays the recording to its end with no live Amp Envelope over it", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_216;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
    installBank(performer, sessionID, 1, buildUpload([{
        note: 60,
        samples: makeConstantStereo(12_000, 0.02, 0.02),
    }]));
    performer.setInputValue_ampAttack(0.5, 0);
    performer.setInputValue_ampDecay(0.02, 0);
    performer.setInputValue_ampSustain(0.25, 0);
    performer.setInputValue_ampRelease(0.02, 0);
    performer.advance(4);

    noteOn(performer, 60, captureVelocity);
    const held = channel(renderFrames(performer, 14_000), 0).subarray(outputLatencyFrames);
    const onset = meanAbsolute(held.subarray(outputSettleFrames, 600));
    const late = meanAbsolute(held.subarray(9_000, 11_000));
    assert.ok(Math.abs(onset - 0.02) < 0.0005, `the recording began at ${onset}, not its own level`);
    assert.ok(Math.abs(late - 0.02) < 0.0005, `the recording held at ${late}, not its own level`);
    assert.equal(rms(held.subarray(12_000 + outputSettleFrames)), 0, "the voice falls silent where its recording ends");
});

test("Mono restarts the recording while connected Legato notes continue it", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    // A silent lead-in before the recording's level, as a captured attack starts.
    const leadInFrames = 2_000;
    const recording = makeConstantStereo(16_000, 0.02, 0.02).fill(0, 0, leadInFrames * 2);

    async function renderConnectedNote(mode, sessionID) {
        const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
        performer.setInputValue_playMode(mode, 0);
        performer.advance(8);
        installBank(performer, sessionID, 1, buildUpload([{ note: 60, samples: recording }]));
        noteOn(performer, 60, captureVelocity);
        renderFrames(performer, 6_000);
        noteOn(performer, 64, captureVelocity);
        const stealFadeFrames = Math.round(sampleRate * 0.0015);
        return meanAbsolute(channel(renderFrames(performer, outputLatencyFrames + 600), 0)
            .subarray(outputLatencyFrames + stealFadeFrames + outputSettleFrames));
    }

    const monoConnectedLevel = await renderConnectedNote(1, 42_217);
    const legatoConnectedLevel = await renderConnectedNote(2, 42_218);
    assert.ok(legatoConnectedLevel > 0.015, `Legato level was ${legatoConnectedLevel}`);
    assert.equal(monoConnectedLevel, 0, "Mono must restart the recording at its silent lead-in");
});

test("polyphonic voice stealing fades the oldest tail before the stealing note starts its recording", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_219;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);

    const roots = [];
    for (let note = 48; note <= 64; note += 1) {
        const isOldest = note === 48;
        const isStealingNote = note === 64;
        roots.push({
            note,
            samples: makeRampedConstantStereo(
                8_000,
                isOldest ? 0.02 : 0,
                isStealingNote ? 0.02 : 0,
            ),
        });
    }
    installBank(performer, sessionID, 1, buildUpload(roots));

    for (let note = 48; note < 64; note += 1) noteOn(performer, note, captureVelocity);
    const beforeSteal = renderFrames(performer, 3_000);
    assert.ok(meanAbsolute(channel(beforeSteal, 0).subarray(2_500)) > 0.015,
        "the oldest voice must be audible before stealing");
    assert.equal(meanAbsolute(channel(beforeSteal, 1).subarray(2_500)), 0);

    noteOn(performer, 64, captureVelocity);
    const stealStart = renderFrames(performer, 512);
    const stealFadeFrames = Math.round(sampleRate * 0.0015);
    const dyingLeft = channel(stealStart, 0);
    const incomingRight = channel(stealStart, 1);
    assert.ok(Math.abs(dyingLeft[0]) > 0.015,
        "the stolen voice must enter the bounded fade instead of being hard-cut");
    const fadeStartFrame = dyingLeft.findIndex(
        (sample) => Math.abs(sample) < Math.abs(dyingLeft[0]) * 0.99,
    );
    // The incoming recording's first frame is 1/480 of its level; half of that
    // marks its arrival above the output oversampler's pre-ringing.
    const incomingStartFrame = incomingRight.findIndex((sample) => Math.abs(sample) > 0.02 / 480 / 2);
    assert.ok(fadeStartFrame >= 0, "the stolen voice must begin fading");
    assert.equal(incomingStartFrame - fadeStartFrame, stealFadeFrames,
        "the replacement note must wait for the complete 1.5 ms fade");
    assert.equal(
        meanAbsolute(dyingLeft.subarray(fadeStartFrame + stealFadeFrames + 64)),
        0,
        "the stolen voice and the fixed downstream impulse must settle to exact silence",
    );

    const boundary = beforeSteal.subarray(beforeSteal.length - 16);
    const maximumStealStep = maxInterSampleStep(boundary, stealStart);
    assert.ok(maximumStealStep < 0.002,
        `voice stealing introduced a ${maximumStealStep} FS one-sample discontinuity`);

    const stealSettled = renderFrames(performer, 3_000);
    const settledRight = meanAbsolute(channel(stealSettled, 1).subarray(2_500));
    assert.ok(settledRight > 0.015, `stolen voice settled at ${settledRight}`);
});

test("a release before the recorded note-off fades the recording; a later one lets its recorded tail play out", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_207;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
    installBank(performer, sessionID, 1, buildUpload([{
        note: 60,
        noteOffFrameOffset: 3_000,
        samples: makeRampedConstantStereo(12_000, 0.02, 0.02),
    }]));
    performer.setInputValue_ampRelease(0.005, 0);
    performer.advance(4);

    noteOn(performer, 60, captureVelocity);
    renderFrames(performer, 2_000);
    noteOff(performer, 60);
    const earlyRelease = channel(renderFrames(performer, 2_000), 0);
    assert.equal(rms(earlyRelease.subarray(outputLatencyFrames + releaseFadeFrames + outputSettleFrames)), 0,
        "a release inside the held recording must fade it out");

    noteOn(performer, 60, captureVelocity);
    renderFrames(performer, 4_000);
    noteOff(performer, 60);
    const tail = channel(renderFrames(performer, 10_000), 0);
    const recordedTailLevel = meanAbsolute(tail.subarray(outputLatencyFrames + outputSettleFrames, 8_000));
    assert.ok(Math.abs(recordedTailLevel - 0.02) < 0.0005,
        `the recorded tail played at ${recordedTailLevel} after a release past its recorded note-off`);
    assert.equal(rms(tail.subarray(8_000 + outputLatencyFrames + outputSettleFrames)), 0,
        "the recorded tail ends where the recording ends");
});

test("source swaps and note boundaries stay below the committed click ceiling", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_208;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
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

test("legato glide continuously repitches the in-flight sample", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const sessionID = 42_207;
    const performer = await createSamplerPerformer(t, CmajorClass, sessionID);
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
