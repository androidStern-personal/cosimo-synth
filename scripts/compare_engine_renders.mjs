// Bit-identity comparison between two independently built offline engines.
// Integration mode refuses two paths that resolve to the same file or bytes;
// deterministic self-checks are an explicit, separately reported mode.
//
//   node scripts/compare_engine_renders.mjs <baseline.js> <candidate.js> [--report report.json]
//   node scripts/compare_engine_renders.mjs --self-check <engine.js> [--report report.json]

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import {
    createInstalledPerformer,
    firstSampleDifference,
    loadOfflineEngineClass,
    peakAbsolute,
    renderScore,
} from "../tests/tools/offline-engine-driver.mjs";
import { buildRenderScenarios } from "../tests/tools/engine-render-scenarios.mjs";

const execFileAsync = promisify(execFile);
const USAGE = "usage: node scripts/compare_engine_renders.mjs <baseline.js> <candidate.js> [--report report.json]\n"
    + "   or: node scripts/compare_engine_renders.mjs --self-check <engine.js> [--report report.json]";

function parseArguments(argv) {
    const positional = [];
    let reportPath = null;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--report") {
            const value = argv[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error("--report requires a file path.");
            }
            reportPath = path.resolve(value);
            index += 1;
            continue;
        }
        positional.push(argument);
    }

    if (positional[0] === "--self-check") {
        if (positional.length !== 2) {
            throw new Error(USAGE);
        }
        const enginePath = path.resolve(positional[1]);
        return {
            mode: "self-check",
            reportPath,
            requestedEngines: [enginePath, enginePath],
        };
    }

    if (positional.length !== 2 || positional.some((argument) => argument.startsWith("--"))) {
        throw new Error(USAGE);
    }
    return {
        mode: "integration-compare",
        reportPath,
        requestedEngines: positional.map((filePath) => path.resolve(filePath)),
    };
}

async function readGitValue(directory, arguments_) {
    try {
        const { stdout } = await execFileAsync("git", ["-C", directory, ...arguments_], {
            encoding: "utf8",
            maxBuffer: 1024 * 1024,
        });
        return stdout.trim() || null;
    } catch {
        return null;
    }
}

function readPinnedGitTag(source, packageName) {
    const packageBlock = new RegExp(`NAME\\s+${packageName}\\b[\\s\\S]*?GIT_TAG\\s+"([^"]+)"`, "u").exec(source);
    return packageBlock?.[1] ?? null;
}

async function readSourceProvenance(engineRealPath) {
    const engineDirectory = path.dirname(engineRealPath);
    const gitRoot = await readGitValue(engineDirectory, ["rev-parse", "--show-toplevel"]);
    if (gitRoot === null) {
        return {
            gitRoot: null,
            commit: null,
            branch: null,
            dirty: null,
            toolchain: { cmajorGitTag: null, juceGitTag: null },
        };
    }

    const [commit, branch, status] = await Promise.all([
        readGitValue(gitRoot, ["rev-parse", "HEAD"]),
        readGitValue(gitRoot, ["branch", "--show-current"]),
        readGitValue(gitRoot, ["status", "--porcelain=v1"]),
    ]);
    let dependencySource = "";
    try {
        dependencySource = await readFile(path.join(gitRoot, "cmake", "CosimoDependencies.cmake"), "utf8");
    } catch {
        // A comparator can inspect an artifact from outside a Cosimo checkout.
    }

    return {
        gitRoot,
        commit,
        branch,
        dirty: status !== null && status.length > 0,
        toolchain: {
            cmajorGitTag: readPinnedGitTag(dependencySource, "cosimo_cmajor"),
            juceGitTag: readPinnedGitTag(dependencySource, "cosimo_juce"),
        },
    };
}

async function inspectEngine(label, requestedPath) {
    const resolvedRealPath = await realpath(requestedPath);
    const bytes = await readFile(resolvedRealPath);
    return {
        label,
        requestedPath,
        realPath: resolvedRealPath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        source: await readSourceProvenance(resolvedRealPath),
    };
}

function runtimeProvenance() {
    return {
        node: process.version,
        v8: process.versions.v8,
        platform: process.platform,
        architecture: process.arch,
    };
}

async function writeReport(reportPath, report) {
    if (reportPath === null) {
        return;
    }
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function reportProvenance(report) {
    console.log(JSON.stringify({
        mode: report.mode,
        runtime: report.runtime,
        engines: report.engines,
    }, null, 2));
}

async function main() {
    let options;
    try {
        options = parseArguments(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 2;
        return;
    }

    const labels = options.mode === "self-check"
        ? ["self-check-a", "self-check-b"]
        : ["baseline", "candidate"];
    const engines = await Promise.all(options.requestedEngines.map((requestedPath, index) => (
        inspectEngine(labels[index], requestedPath)
    )));
    const report = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        mode: options.mode,
        status: "prepared",
        runtime: runtimeProvenance(),
        engines,
        scenarios: [],
    };
    reportProvenance(report);

    if (options.mode === "integration-compare") {
        let rejection = null;
        if (engines[0].realPath === engines[1].realPath) {
            rejection = "Integration comparison requires distinct engine realpaths; use --self-check for determinism.";
        } else if (engines[0].sha256 === engines[1].sha256) {
            rejection = "Integration comparison requires distinct engine bytes; baseline and candidate SHA-256 hashes match.";
        }
        if (rejection !== null) {
            report.status = "rejected";
            report.failure = rejection;
            await writeReport(options.reportPath, report);
            console.error(rejection);
            process.exitCode = 2;
            return;
        }
    }

    try {
        const [EngineA, EngineB] = await Promise.all(engines.map(({ realPath: enginePath }) => (
            loadOfflineEngineClass(enginePath)
        )));
        const scenarios = await buildRenderScenarios();
        let failed = false;

        for (const scenario of scenarios) {
            const performerA = await createInstalledPerformer({ EngineClass: EngineA, ...scenario.spec });
            const renderedA = renderScore(performerA, scenario.score, scenario.totalFrames);
            const performerB = await createInstalledPerformer({ EngineClass: EngineB, ...scenario.spec });
            const renderedB = renderScore(performerB, scenario.score, scenario.totalFrames);
            const difference = firstSampleDifference(renderedA.samples, renderedB.samples);
            const peak = peakAbsolute(renderedA.samples);
            const renderedSilence = scenario.expectSound && peak <= 1e-6;
            report.scenarios.push({
                name: scenario.name,
                sampleCount: renderedA.samples.length,
                peak,
                bitIdentical: difference === null,
                renderedSilence,
                difference,
            });

            if (renderedSilence) {
                console.error(`✗ ${scenario.name}: rendered silence — scenario install is broken.`);
                failed = true;
            } else if (difference === null) {
                console.log(`✓ ${scenario.name}: bit-identical (${renderedA.samples.length} samples, peak ${peak.toFixed(3)})`);
            } else {
                failed = true;
                console.error(`✗ ${scenario.name}: first difference at frame ${difference.frame}`
                    + ` (${difference.channel}): ${difference.left} vs ${difference.right}`
                    + (difference.reason ? ` [${difference.reason}]` : ""));
            }
        }

        report.status = failed ? "failed" : "passed";
        await writeReport(options.reportPath, report);
        process.exitCode = failed ? 1 : 0;
    } catch (error) {
        report.status = "error";
        report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
        await writeReport(options.reportPath, report);
        throw error;
    }
}

await main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
