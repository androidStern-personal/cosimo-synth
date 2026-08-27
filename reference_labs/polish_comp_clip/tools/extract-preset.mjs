#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPresetEvidence, sha256 } from "../lib/source-extractor.mjs";

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(labRoot, "fixtures", "decoded-settings.json");
const artifactPath = path.join(labRoot, "fixtures", "source-artifact.json");
const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));

function usage() {
    return "usage: node extract-preset.mjs (--fetch | --source PATH) [--check | --write]";
}

const args = process.argv.slice(2);
const fetchSource = args.includes("--fetch");
const sourceFlag = args.indexOf("--source");
const write = args.includes("--write");
const check = args.includes("--check") || !write;

if (fetchSource === (sourceFlag >= 0) || (sourceFlag >= 0 && !args[sourceFlag + 1])) {
    throw new Error(usage());
}

let source;
if (fetchSource) {
    const response = await fetch(artifact.rawUrl);
    if (!response.ok) throw new Error(`Source fetch failed: HTTP ${response.status}`);
    source = Buffer.from(await response.arrayBuffer());
} else {
    source = await fs.readFile(path.resolve(args[sourceFlag + 1]));
}

assert.equal(sha256(source), artifact.sha256, "Pinned source SHA-256 changed");
assert.equal(source.length, artifact.byteLength, "Pinned source byte length changed");

const extracted = extractPresetEvidence(source);
assert.equal(extracted.source.containerHeaderAscii, artifact.containerHeaderAscii);
assert.equal(extracted.source.embeddedZipOffset, artifact.embeddedZipOffset);

if (write) {
    await fs.writeFile(fixturePath, `${JSON.stringify(extracted, null, 2)}\n`, "utf8");
}

if (check) {
    const expected = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    assert.deepEqual(extracted, expected, "Decoded preset evidence differs from the retained fixture");
}

process.stdout.write(
    `Pinned preset evidence ${write ? "written" : "verified"}: ${extracted.source.sha256}; `
    + `${extracted.decodedPresetFacts.curve.points.length} transfer points; `
    + `${extracted.decodedPresetFacts.macro.mappings.length} source macro targets\n`,
);
