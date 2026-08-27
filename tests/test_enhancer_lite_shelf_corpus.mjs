import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyFloatWaveAudio } from "../scripts/enhancer_lite_shelf_corpus.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const corpusDirectory = path.join(repoRoot, "build/t26-spectre-shelves");
const fixturePath = path.join(
    repoRoot,
    "tests/fixtures/enhancer_spectre_shelves_v1.json",
);

async function mutateFirstDecodedSample(filePath) {
    const buffer = await fs.readFile(filePath);
    let dataOffset;
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const chunkBytes = buffer.readUInt32LE(offset + 4);
        const payload = offset + 8;
        if (buffer.toString("ascii", offset, offset + 4) === "data") {
            dataOffset = payload;
            break;
        }
        offset = payload + chunkBytes + (chunkBytes % 2);
    }
    assert.notEqual(dataOffset, undefined, `${filePath} has no data chunk`);
    buffer[dataOffset] ^= 0x01;
    await fs.writeFile(filePath, buffer);
}

test("decoded Float32 integrity rejects copied input and output tampering", async (context) => {
    try {
        await fs.access(path.join(corpusDirectory, "measurements.json"));
    } catch {
        context.skip("local ignored Spectre shelf corpus is unavailable");
        return;
    }

    const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const measurements = JSON.parse(await fs.readFile(
        path.join(corpusDirectory, "measurements.json"),
        "utf8",
    ));
    const input = fixture.inputAudio[0];
    const output = measurements[0];
    const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), "cosimo-shelf-integrity-tamper-"),
    );

    try {
        const cases = [
            {
                label: `input ${input.id}`,
                sourcePath: path.join(corpusDirectory, input.path),
                expectedSampleRate: input.sampleRate,
                expectedSha256: input.sha256FloatAudio,
            },
            {
                label: `output ${output.id}`,
                sourcePath: path.join(corpusDirectory, output.output_path),
                expectedSampleRate: output.sample_rate,
                expectedSha256: output.sha256_float_audio,
            },
        ];

        for (const row of cases) {
            const copiedPath = path.join(temporaryDirectory, `${row.label.replaceAll(" ", "-")}.wav`);
            await fs.copyFile(row.sourcePath, copiedPath);
            await verifyFloatWaveAudio({
                filePath: copiedPath,
                expectedSampleRate: row.expectedSampleRate,
                expectedSha256: row.expectedSha256,
                label: row.label,
            });
            await mutateFirstDecodedSample(copiedPath);
            await assert.rejects(
                verifyFloatWaveAudio({
                    filePath: copiedPath,
                    expectedSampleRate: row.expectedSampleRate,
                    expectedSha256: row.expectedSha256,
                    label: row.label,
                }),
                /decoded-Float32 integrity mismatch/,
            );
        }
    } finally {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
});
