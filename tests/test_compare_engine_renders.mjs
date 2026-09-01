import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const comparatorPath = path.join(repoRoot, "scripts", "compare_engine_renders.mjs");

async function runComparator(arguments_) {
    try {
        const result = await execFileAsync(process.execPath, [comparatorPath, ...arguments_], {
            cwd: repoRoot,
            encoding: "utf8",
            maxBuffer: 4 * 1024 * 1024,
        });
        return { exitCode: 0, ...result };
    } catch (error) {
        return {
            exitCode: Number(error.code),
            stdout: String(error.stdout ?? ""),
            stderr: String(error.stderr ?? ""),
        };
    }
}

test("engine integration comparison rejects identical artifacts and records provenance", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-engine-comparator-"));
    const engineA = path.join(fixtureRoot, "baseline.js");
    const engineB = path.join(fixtureRoot, "candidate.js");
    const samePathReport = path.join(fixtureRoot, "same-path-report.json");

    try {
        await writeFile(engineA, "export default class OfflineEngine {}\n", "utf8");
        await writeFile(engineB, "export default class OfflineEngine {}\n", "utf8");

        const samePath = await runComparator([engineA, engineA, "--report", samePathReport]);
        assert.equal(samePath.exitCode, 2);
        assert.match(samePath.stderr, /requires distinct engine realpaths/u);
        const rejectedReport = JSON.parse(await readFile(samePathReport, "utf8"));
        assert.equal(rejectedReport.mode, "integration-compare");
        assert.equal(rejectedReport.status, "rejected");
        assert.equal(rejectedReport.engines[0].realPath, rejectedReport.engines[1].realPath);
        assert.equal(rejectedReport.engines[0].sha256, rejectedReport.engines[1].sha256);
        assert.equal(typeof rejectedReport.runtime.node, "string");

        const sameHash = await runComparator([engineA, engineB]);
        assert.equal(sameHash.exitCode, 2);
        assert.match(sameHash.stderr, /SHA-256 hashes match/u);
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});

test("determinism self-check is explicit and captures current source and toolchain identity", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-engine-self-check-"));
    const reportPath = path.join(fixtureRoot, "self-check-report.json");

    try {
        const result = await runComparator(["--self-check", path.join(repoRoot, "package.json"), "--report", reportPath]);
        assert.equal(result.exitCode, 1, "The non-engine fixture should fail only after passing self-check identity validation.");
        assert.doesNotMatch(result.stderr, /requires distinct engine/u);

        const report = JSON.parse(await readFile(reportPath, "utf8"));
        const { stdout: expectedCommitOutput } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
        const [packageSource, dependencySource] = await Promise.all([
            readFile(path.join(repoRoot, "package.json"), "utf8"),
            readFile(path.join(repoRoot, "kit", "cmake", "CosimoDependencies.cmake"), "utf8"),
        ]);
        const packageJson = JSON.parse(packageSource);
        const expectedCmajorPin = /NAME\s+cosimo_cmajor\b[\s\S]*?GIT_TAG\s+"([^"]+)"/u.exec(dependencySource)?.[1];
        const expectedJucePin = /NAME\s+cosimo_juce\b[\s\S]*?GIT_TAG\s+"([^"]+)"/u.exec(dependencySource)?.[1];
        assert.equal(report.mode, "self-check");
        assert.equal(report.status, "error");
        assert.equal(report.engines[0].realPath, report.engines[1].realPath);
        assert.equal(report.engines[0].source.commit, expectedCommitOutput.trim());
        assert.equal(report.engines[0].source.toolchain.cmajorGitTag, expectedCmajorPin);
        assert.equal(report.engines[0].source.toolchain.juceGitTag, expectedJucePin);
        assert.match(packageJson.scripts["test:engine:determinism"], /compare_engine_renders\.mjs --self-check/u);
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
});
