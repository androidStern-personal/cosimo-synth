#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");

function usage() {
    return "Usage: npm run test:host-keyboard-router -- --choc-source-root /absolute/path/to/choc --expected-choc-commit <40-hex-sha>";
}

async function run() {
    const { values } = parseArgs({
        allowPositionals: false,
        options: {
            "choc-source-root": { type: "string" },
            "expected-choc-commit": { type: "string" },
        },
        strict: true,
    });
    const sourceArgument = values["choc-source-root"];
    const expectedCommit = values["expected-choc-commit"];

    assert.equal(typeof sourceArgument === "string" && path.isAbsolute(sourceArgument), true, usage());
    assert.match(expectedCommit ?? "", /^[0-9a-f]{40}$/u, usage());

    const sourceRoot = await realpath(sourceArgument);
    const header = path.join(sourceRoot, "choc/gui/choc_WebView.h");
    assert.equal((await stat(header)).isFile(), true, `${header} is not a regular file.`);

    const [{ stdout: topLevelOutput }, { stdout: headOutput }, { stdout: statusOutput }] = await Promise.all([
        execFileAsync("git", ["-C", sourceRoot, "rev-parse", "--show-toplevel"]),
        execFileAsync("git", ["-C", sourceRoot, "rev-parse", "HEAD"]),
        execFileAsync("git", ["-C", sourceRoot, "status", "--porcelain"]),
    ]);
    const topLevel = await realpath(topLevelOutput.trim());
    const head = headOutput.trim();

    assert.equal(topLevel, sourceRoot, `${sourceRoot} is not the root of its CHOC checkout.`);
    assert.equal(head, expectedCommit, `CHOC source is ${head}; expected ${expectedCommit}.`);
    assert.equal(statusOutput.trim(), "", "CHOC source must be clean for qualification.");

    const child = spawn(process.execPath, ["--test", "tests/test_host_keyboard_router_browser.mjs"], {
        cwd: repoRoot,
        env: {
            ...process.env,
            COSIMO_CHOC_SOURCE_ROOT: sourceRoot,
        },
        stdio: "inherit",
    });
    const exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (signal) {
                reject(new Error(`Keyboard router qualification ended from signal ${signal}.`));
                return;
            }
            resolve(code ?? 1);
        });
    });

    assert.equal(exitCode, 0, `Keyboard router qualification exited with status ${exitCode}.`);
    console.log(`BK-22A router qualification passed against CHOC ${head}.`);
}

run().catch((error) => {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
});
