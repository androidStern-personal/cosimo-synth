import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function resolveCorpusPath(corpusDirectory, relativePath) {
    if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath))
        throw new Error(`Invalid Spectre corpus path: ${String(relativePath)}`);

    const root = path.resolve(corpusDirectory);
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))
        throw new Error(`Spectre corpus path escapes its root: ${relativePath}`);
    return resolved;
}

/** Decode the canonical stereo Float32 WAV representation used by the corpus. */
export async function readFloatWave(filePath) {
    const buffer = await fs.readFile(filePath);
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE")
        throw new Error(`Not a RIFF WAVE file: ${filePath}`);

    let format;
    let channels;
    let sampleRate;
    let bitsPerSample;
    let dataOffset;
    let dataBytes;
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const chunkID = buffer.toString("ascii", offset, offset + 4);
        const chunkBytes = buffer.readUInt32LE(offset + 4);
        const payload = offset + 8;
        if (payload + chunkBytes > buffer.length)
            throw new Error(`Truncated WAVE chunk in ${filePath}`);
        if (chunkID === "fmt ") {
            format = buffer.readUInt16LE(payload);
            channels = buffer.readUInt16LE(payload + 2);
            sampleRate = buffer.readUInt32LE(payload + 4);
            bitsPerSample = buffer.readUInt16LE(payload + 14);
        } else if (chunkID === "data") {
            dataOffset = payload;
            dataBytes = chunkBytes;
        }
        offset = payload + chunkBytes + (chunkBytes % 2);
    }
    if (format !== 3 || channels !== 2 || bitsPerSample !== 32 || dataOffset === undefined)
        throw new Error(`Expected stereo Float32 WAVE: ${filePath}`);
    if (dataBytes % 8 !== 0)
        throw new Error(`Invalid stereo Float32 data size in ${filePath}`);

    const frameCount = dataBytes / 8;
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    const leftBytes = Buffer.allocUnsafe(frameCount * 4);
    const rightBytes = Buffer.allocUnsafe(frameCount * 4);
    for (let frame = 0; frame < frameCount; frame += 1) {
        const sourceOffset = dataOffset + frame * 8;
        left[frame] = buffer.readFloatLE(sourceOffset);
        right[frame] = buffer.readFloatLE(sourceOffset + 4);
        buffer.copy(leftBytes, frame * 4, sourceOffset, sourceOffset + 4);
        buffer.copy(rightBytes, frame * 4, sourceOffset + 4, sourceOffset + 8);
    }
    return {
        left,
        right,
        sampleRate,
        sha256FloatAudio: createHash("sha256")
            .update(leftBytes)
            .update(rightBytes)
            .digest("hex"),
    };
}

/** Verify one decoded Float32 render, independent of WAV metadata bytes. */
export async function verifyFloatWaveAudio({
    filePath,
    expectedSampleRate,
    expectedSha256,
    label,
}) {
    const wave = await readFloatWave(filePath);
    if (wave.sampleRate !== expectedSampleRate) {
        throw new Error(
            `Spectre audio sample-rate mismatch for ${label}: `
            + `expected ${expectedSampleRate}, got ${wave.sampleRate}`,
        );
    }
    if (wave.sha256FloatAudio !== expectedSha256) {
        throw new Error(
            `Spectre decoded-Float32 integrity mismatch for ${label}: `
            + `expected ${expectedSha256}, got ${wave.sha256FloatAudio}`,
        );
    }
    return wave;
}

/** Authenticate all 20 inputs and every saved golden output before comparison. */
export async function verifySpectreShelfAudio({
    corpusDirectory,
    measurements,
    inputAudio,
}) {
    if (!Array.isArray(measurements) || measurements.length === 0)
        throw new Error("Spectre shelf measurements must be a non-empty array");
    if (!Array.isArray(inputAudio) || inputAudio.length !== 20)
        throw new Error(`Spectre shelf input manifest must contain 20 rows, got ${inputAudio?.length}`);

    const referencedStimuli = new Set(measurements.map(({ stimulus }) => stimulus));
    const manifestStimuli = new Set(inputAudio.map(({ id }) => id));
    if (manifestStimuli.size !== inputAudio.length
        || referencedStimuli.size !== manifestStimuli.size
        || [...referencedStimuli].some((id) => !manifestStimuli.has(id))) {
        throw new Error("Spectre shelf input manifest does not exactly cover referenced stimuli");
    }

    for (const entry of inputAudio) {
        await verifyFloatWaveAudio({
            filePath: resolveCorpusPath(corpusDirectory, entry.path),
            expectedSampleRate: entry.sampleRate,
            expectedSha256: entry.sha256FloatAudio,
            label: `input ${entry.id}`,
        });
    }

    const seenOutputPaths = new Set();
    for (const row of measurements) {
        if (typeof row.output_path !== "string"
            || typeof row.sha256_float_audio !== "string"
            || typeof row.sample_rate !== "number") {
            throw new Error(`Spectre measurement ${row.id} lacks complete output integrity metadata`);
        }
        if (seenOutputPaths.has(row.output_path))
            throw new Error(`Duplicate Spectre output path: ${row.output_path}`);
        seenOutputPaths.add(row.output_path);
        await verifyFloatWaveAudio({
            filePath: resolveCorpusPath(corpusDirectory, row.output_path),
            expectedSampleRate: row.sample_rate,
            expectedSha256: row.sha256_float_audio,
            label: `output ${row.id}`,
        });
    }

    return {
        inputCount: inputAudio.length,
        outputCount: measurements.length,
    };
}
