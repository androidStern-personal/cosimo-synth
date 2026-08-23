#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
    buildBounceBank,
    encodeBounceBank,
    quantizeFloatToInt16,
} from "../bounce/bank-format.mjs";
import { decodeWaveToStereoFloat } from "../bounce/wav-decode.mjs";

function usage() {
    return "Usage: node scripts/wav_to_bounce_bank.mjs <input.wav> <output.csbk> [--root <0..127>]";
}

function parseArguments(argv) {
    const positional = [];
    let rootNote = 60;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--root") {
            rootNote = Number(argv[index + 1]);
            index += 1;
        } else {
            positional.push(argv[index]);
        }
    }
    if (positional.length !== 2 || !Number.isInteger(rootNote) || rootNote < 0 || rootNote > 127) {
        throw new Error(usage());
    }
    return { inputPath: positional[0], outputPath: positional[1], rootNote };
}

export async function convertWaveFileToBounceBank({ inputPath, outputPath, rootNote = 60 }) {
    const waveBytes = await fs.readFile(inputPath);
    const decoded = decodeWaveToStereoFloat(waveBytes);
    const pcm = new Int16Array(decoded.samples.length);
    for (let index = 0; index < decoded.samples.length; index += 1) {
        pcm[index] = quantizeFloatToInt16(decoded.samples[index]);
    }
    const bank = buildBounceBank({
        sampleRate: decoded.sampleRate,
        roots: [{ note: rootNote, samples: pcm }],
    });
    const encoded = encodeBounceBank(bank);
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, encoded);
    return { ...bank, byteLength: encoded.byteLength };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(new URL(import.meta.url).pathname)) {
    try {
        const options = parseArguments(process.argv.slice(2));
        const bank = await convertWaveFileToBounceBank(options);
        process.stdout.write(
            `Wrote ${options.outputPath}: root ${options.rootNote}, ${bank.totalFrameCount} stereo frames, `
            + `${bank.sampleRate} Hz, ${bank.byteLength} bytes\n`,
        );
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}

