#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { build } from "esbuild";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const fixtureDirectory = path.join(repoRoot, "tests/fixtures/seqfx");
const fixturePath = path.join(fixtureDirectory, "legacy-v5-dense-state.json.gz");
const provenancePath = path.join(fixtureDirectory, "legacy-v5-dense-state.provenance.json");
const sourceCommit = "7fc89fa322764221facdd2714e9b16bc91c41157";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function sourceAtCommit(relativePath) {
    const { stdout } = await execFileAsync(
        "git",
        ["show", `${sourceCommit}:${relativePath}`],
        { cwd: repoRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout;
}

async function loadLegacyStateModule() {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "seqfx-legacy-v5-"));
    const stateSourcePath = path.join(temporaryDirectory, "seqfx-state.ts");
    const stutterSourcePath = path.join(temporaryDirectory, "stutter-envelope.ts");
    const stateSource = await sourceAtCommit("fx/seqfx/view/seqfx-state.ts");
    const stutterSource = await sourceAtCommit("fx/seqfx/view/stutter-envelope.ts");

    try {
        await Promise.all([
            writeFile(stateSourcePath, stateSource, "utf8"),
            writeFile(stutterSourcePath, stutterSource, "utf8"),
        ]);
        const result = await build({
            entryPoints: [stateSourcePath],
            bundle: true,
            format: "esm",
            platform: "browser",
            target: "es2022",
            write: false,
        });
        const bundledSource = result.outputFiles[0]?.text;
        if (!bundledSource) {
            throw new Error("The legacy SeqFX state source did not produce a bundle.");
        }

        return {
            module: await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`),
            sourceHashes: {
                "fx/seqfx/view/seqfx-state.ts": sha256(stateSource),
                "fx/seqfx/view/stutter-envelope.ts": sha256(stutterSource),
            },
        };
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

function captureRepresentativeState(legacy) {
    let state = legacy.createDefaultSeqFxState();
    const patternIndex = 6;

    const createBlock = (lane, startStep, length, effectType) => {
        state = legacy.applySeqFxBlockCreate(state, {
            patternIndex,
            lane,
            startStep,
            length,
            effectType,
        });
    };
    const editParam = (lane, startStep, paramIndex, value) => {
        state = legacy.applySeqFxBlockParamEdit(state, {
            patternIndex,
            lane,
            startStep,
            paramIndex,
            value,
        });
    };

    createBlock(legacy.SEQFX_LANES.filter, 1, 2, legacy.SEQFX_EFFECT_TYPES.filter);
    editParam(legacy.SEQFX_LANES.filter, 1, 1, 1_200);
    editParam(legacy.SEQFX_LANES.filter, 1, 3, 4.5);
    state = legacy.applySeqFxBlockMixEdit(state, {
        patternIndex,
        lane: legacy.SEQFX_LANES.filter,
        startStep: 1,
        value: 0.7,
    });

    createBlock(legacy.SEQFX_LANES.crusher, 5, 3, legacy.SEQFX_EFFECT_TYPES.crusher);
    editParam(legacy.SEQFX_LANES.crusher, 5, 0, 6);
    editParam(legacy.SEQFX_LANES.crusher, 5, 1, 8);
    editParam(legacy.SEQFX_LANES.crusher, 5, 2, 12);
    state = legacy.applySeqFxBlockAuxSourceEdit(state, {
        patternIndex,
        lane: legacy.SEQFX_LANES.crusher,
        startStep: 5,
        source: { shape: 0.25 },
    });
    state = legacy.applySeqFxBlockAuxTargetToggle(state, {
        patternIndex,
        lane: legacy.SEQFX_LANES.crusher,
        startStep: 5,
        paramIndex: 1,
        enabled: true,
    });
    state = legacy.applySeqFxBlockAuxTargetEndEdit(state, {
        patternIndex,
        lane: legacy.SEQFX_LANES.crusher,
        startStep: 5,
        paramIndex: 1,
        value: 16,
    });

    createBlock(legacy.SEQFX_LANES.tapeStop, 11, 4, legacy.SEQFX_EFFECT_TYPES.tapeStop);
    editParam(legacy.SEQFX_LANES.tapeStop, 11, 0, 3.25);
    editParam(legacy.SEQFX_LANES.tapeStop, 11, 1, 2);
    editParam(legacy.SEQFX_LANES.tapeStop, 11, 2, 0.5);
    editParam(legacy.SEQFX_LANES.tapeStop, 11, 3, 40);
    editParam(legacy.SEQFX_LANES.tapeStop, 11, 4, 1);

    createBlock(legacy.SEQFX_LANES.stutter, 20, 5, legacy.SEQFX_EFFECT_TYPES.stutter);
    editParam(legacy.SEQFX_LANES.stutter, 20, 0, 12);
    editParam(legacy.SEQFX_LANES.stutter, 20, 1, 0.75);
    editParam(legacy.SEQFX_LANES.stutter, 20, 2, 0.3);
    editParam(legacy.SEQFX_LANES.stutter, 20, 3, 0.6);

    return legacy.serializeSeqFxState(state);
}

async function main() {
    const { module: legacy, sourceHashes } = await loadLegacyStateModule();
    const storedState = captureRepresentativeState(legacy);
    const envelope = {
        format: "cosimo.seqfxLegacyStoredStateFixture",
        formatVersion: 1,
        storedStateKey: "seqfx.v6",
        schemaVersion: 5,
        storedState,
    };
    const uncompressed = Buffer.from(`${JSON.stringify(envelope)}\n`, "utf8");
    const compressed = gzipSync(uncompressed, { level: 9, mtime: 0 });
    const provenance = {
        fixture: path.basename(fixturePath),
        sourceCommit,
        sourceFiles: sourceHashes,
        captureBoundary: "The predecessor revision's exported SeqFX state edit and serialize functions.",
        captureScenario: "One non-default block for each pre-v7 effect, including Crush aux modulation and a four-cell Tape Stop gesture.",
        storedStateKey: "seqfx.v6",
        schemaVersion: 5,
        storedStateBytes: Buffer.byteLength(storedState),
        storedStateSha256: sha256(storedState),
        uncompressedBytes: uncompressed.byteLength,
        uncompressedSha256: sha256(uncompressed),
        compressedBytes: compressed.byteLength,
        compressedSha256: sha256(compressed),
    };

    await mkdir(fixtureDirectory, { recursive: true });
    await Promise.all([
        writeFile(fixturePath, compressed),
        writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
    ]);

    process.stdout.write(`${JSON.stringify(provenance, null, 2)}\n`);
}

await main();
