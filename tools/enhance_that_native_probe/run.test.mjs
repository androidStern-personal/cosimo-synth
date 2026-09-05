import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const runner = fileURLToPath(new URL("./run.mjs", import.meta.url));

test("launcher refuses missing and relative arguments before any host launch", () => {
    for (const args of [[], ["relative-probe", "/unused.vst3", "/unused-evidence"]]) {
        const result = spawnSync(process.execPath, [runner, ...args], { encoding: "utf8", timeout: 10_000 });
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Usage:/u);
    }
});

test("launcher refuses a mismatched bundle without creating run evidence", { skip: process.platform !== "darwin" }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "enhance-that-probe-refusal-"));
    try {
        const bundle = path.join(root, "EnhanceThat.vst3");
        const binaryDirectory = path.join(bundle, "Contents/MacOS");
        await mkdir(binaryDirectory, { recursive: true });
        await writeFile(path.join(binaryDirectory, "EnhanceThat"), "Not a native plug-in\n");
        const evidence = path.join(root, "evidence");
        // /usr/bin/false cannot load a plug-in even if the refusal regresses.
        const result = spawnSync(process.execPath, [runner, "/usr/bin/false", bundle, evidence], { encoding: "utf8", timeout: 10_000 });
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Candidate hash differs/u);
        assert.equal(existsSync(evidence), false);

        const nested = path.join(bundle, "evidence");
        const inside = spawnSync(process.execPath, [runner, "/usr/bin/false", bundle, nested], { encoding: "utf8", timeout: 10_000 });
        assert.equal(inside.status, 2);
        assert.match(inside.stderr, /Evidence must be outside/u);
        assert.equal(existsSync(nested), false);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
