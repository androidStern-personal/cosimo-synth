import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
    buildBounceBank,
    decodeBounceBank,
    encodeBounceBank,
} from "../bounce/bank-format.mjs";
import { convertWaveFileToBounceBank } from "../scripts/wav_to_bounce_bank.mjs";

function makeStereoPcm16Wave(frames, sampleRate = 48_000) {
    const dataBytes = frames.length * 4;
    const bytes = new Uint8Array(44 + dataBytes);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, value) => {
        for (let index = 0; index < value.length; index += 1) {
            view.setUint8(offset + index, value.charCodeAt(index));
        }
    };
    ascii(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, dataBytes, true);
    for (let index = 0; index < frames.length; index += 1) {
        view.setInt16(44 + (index * 4), frames[index][0], true);
        view.setInt16(46 + (index * 4), frames[index][1], true);
    }
    return bytes;
}

test("bounce bank binary round-trips ordered stereo roots deterministically", () => {
    const bank = buildBounceBank({
        sampleRate: 48_000,
        roots: [
            { note: 48, samples: Int16Array.of(-32_768, 32_767, -1, 1) },
            { note: 52, samples: Int16Array.of(1234, -5678) },
        ],
    });
    const first = encodeBounceBank(bank);
    const second = encodeBounceBank(bank);
    assert.deepEqual(first, second);

    const decoded = decodeBounceBank(first);
    assert.equal(decoded.sampleRate, 48_000);
    assert.deepEqual(decoded.roots, [
        { note: 48, frameOffset: 0, frameCount: 2 },
        { note: 52, frameOffset: 2, frameCount: 1 },
    ]);
    assert.deepEqual([...decoded.pcm], [-32_768, 32_767, -1, 1, 1234, -5678]);
    assert.equal(decoded.packedFrames[0] >>> 0, 0x7fff8000);
});

test("the WAV converter accepts arbitrary stereo PCM16 and preserves it exactly", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-bounce-bank-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const inputPath = path.join(directory, "source.wav");
    const outputPath = path.join(directory, "fixture.csbk");
    const frames = [[-32_768, 32_767], [-12_345, 23_456], [0, -1], [1, 2]];
    await fs.writeFile(inputPath, makeStereoPcm16Wave(frames));

    await convertWaveFileToBounceBank({ inputPath, outputPath, rootNote: 57 });
    const decoded = decodeBounceBank(await fs.readFile(outputPath));
    assert.equal(decoded.sampleRate, 48_000);
    assert.deepEqual(decoded.roots, [{ note: 57, frameOffset: 0, frameCount: frames.length }]);
    assert.deepEqual([...decoded.pcm], frames.flat());
});

test("malformed banks are rejected before their PCM becomes visible", () => {
    const encoded = encodeBounceBank(buildBounceBank({
        sampleRate: 44_100,
        roots: [{ note: 60, samples: Int16Array.of(0, 0) }],
    }));
    const corrupted = encoded.slice();
    new DataView(corrupted.buffer).setUint32(24, 2, true);
    assert.throws(() => decodeBounceBank(corrupted), /PCM length/);
});

