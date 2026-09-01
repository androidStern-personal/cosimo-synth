import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const stagingModule = path.join(repoRoot, "kit", "fx", "vite.shared.mjs");

const childSource = String.raw`
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const [barrierPath, workspaceRoot, stagingModule, buildDirectory, instanceId] = process.argv.slice(1);
while (!existsSync(barrierPath)) await delay(5);

const { stageCmajorWebRuntime } = await import(pathToFileURL(stagingModule));
const outputDirectory = stageCmajorWebRuntime(workspaceRoot, {
    buildDirectory,
    instanceId,
});
process.stdout.write(outputDirectory);
`;

function runStagingProcess({ barrierPath, buildDirectory, instanceId }) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
            "--input-type=module",
            "--eval",
            childSource,
            barrierPath,
            repoRoot,
            stagingModule,
            buildDirectory,
            instanceId,
        ], {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => { stdout += String(chunk); });
        child.stderr.on("data", (chunk) => { stderr += String(chunk); });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolve(stdout.trim().split(/\r?\n/u).at(-1));
                return;
            }

            reject(new Error(
                `staging process ${instanceId} exited ${signal ?? code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
            ));
        });
    });
}

test("parallel Cmajor web staging processes use independent CMake trees", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-cmajor-web-staging-"));
    const barrierPath = path.join(tempRoot, "start");
    const buildDirectory = path.join(tempRoot, "shared-staging-base");

    try {
        const processes = Array.from({ length: 4 }, (_, index) => runStagingProcess({
            barrierPath,
            buildDirectory,
            instanceId: `runner-${index + 1}`,
        }));

        await writeFile(barrierPath, "start\n");
        const outputDirectories = await Promise.all(processes);

        assert.equal(new Set(outputDirectories).size, 4);
        for (const outputDirectory of outputDirectories) {
            assert.equal(
                path.relative(buildDirectory, outputDirectory).startsWith(".."),
                false,
            );
        }
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("desktop harness processes assign their own Cmajor staging identities", async () => {
    const sharedViteSource = await readFile(stagingModule, "utf8");
    const harnessSource = await readFile(
        path.join(repoRoot, "tests", "helpers", "desktop_harness_browser.mjs"),
        "utf8",
    );

    assert.match(
        sharedViteSource,
        /instanceId: process\.env\.COSIMO_CMAJOR_WEB_RUNTIME_INSTANCE \|\| null/u,
    );
    assert.match(harnessSource, /instanceId: `static-\$\{process\.pid\}`/u);
    assert.match(
        harnessSource,
        /COSIMO_CMAJOR_WEB_RUNTIME_INSTANCE: `harness-\$\{process\.pid\}-\$\{port\}`/u,
    );
});
