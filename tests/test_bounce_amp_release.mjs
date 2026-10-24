import assert from "node:assert/strict";
import test from "node:test";

import { createHostedPerformer, loadOfflineEngine } from "./helpers/bounce_offline_engine.mjs";

const sampleRate = 48_000;
const blockFrames = 128;
const sessionID = 41_201;

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

/** One sine cycle: a dry oscillator table with nothing for the voice to filter. */
function sineFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => Math.sin((2 * Math.PI * index) / 2_048));
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

async function renderRelease(t, CmajorClass, overrides) {
    const { performer, prepareWavetables } = await createHostedPerformer(t, CmajorClass, sessionID, sampleRate, {
        oscAWavetableSelect: 0,
        oscAVolumeDb: 0,
        filterMode: 0,
        ...overrides,
    });
    await prepareWavetables([{ input: 0, generation: 1, tableIndex: 0, frames: [sineFrame()] }]);

    performer.sendInputEvent_midiIn({ message: packMidi(0x90, 60, 100) });
    const held = renderFrames(performer, Math.round(sampleRate * 0.25));
    performer.sendInputEvent_midiIn({ message: packMidi(0x80, 60, 0) });
    const released = renderFrames(performer, Math.round(sampleRate * 2.5));
    return { held, released };
}

test("the complete Amp Envelope is exposed with its ranges and defaults", async () => {
    const CmajorClass = await loadOfflineEngine();
    const endpointByID = new Map(CmajorClass.prototype.getInputEndpoints()
        .filter(({ purpose }) => purpose === "parameter")
        .map((endpoint) => [endpoint.endpointID, endpoint]));
    const expectedStages = [
        ["ampAttack", 0.001, 10, 0.01],
        ["ampDecay", 0.001, 10, 0.001],
        ["ampSustain", 0, 1, 1],
        ["ampRelease", 0.005, 10, 0.2],
    ];
    for (const [endpointID, min, max, initial] of expectedStages) {
        const endpoint = endpointByID.get(endpointID);
        assert.ok(endpoint, `the synth must expose ${endpointID} as a host parameter`);
        assert.ok(Math.abs(Number(endpoint.annotation?.init) - initial) < 1e-6, endpointID);
        assert.ok(Math.abs(Number(endpoint.annotation?.min) - min) < 1e-6, endpointID);
        assert.equal(endpoint.annotation?.max, max, endpointID);
    }
});

test("a dry voice with a 3 second Amp Release remains audible 2 seconds after note-off", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const { held, released } = await renderRelease(t, CmajorClass, { ampRelease: 3 });
    const windowStart = Math.round(sampleRate * 2) * 2;
    const windowEnd = windowStart + (Math.round(sampleRate * 0.05) * 2);
    assert.ok(rms(held) > 1e-3, "the dry held voice must be audible");
    assert.ok(
        rms(released.subarray(windowStart, windowEnd)) > 1e-5,
        "the release tail must still contain audio two seconds after note-off",
    );
});

test("the default 0.2 second Amp Release reaches exact silence within 0.3 seconds of note-off", async (t) => {
    const CmajorClass = await loadOfflineEngine();
    const { held, released } = await renderRelease(t, CmajorClass, {});
    assert.ok(rms(held) > 1e-3, "the dry held voice must be audible");
    assert.ok(rms(released.subarray(0, Math.round(sampleRate * 0.05) * 2)) > 1e-4,
        "the release must begin audibly");
    assert.equal(rms(released.subarray(Math.round(sampleRate * 0.3) * 2)), 0);
});
