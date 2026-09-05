import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { hashInstalledPayload, sha256File } from "../../kit/scripts/toolchain.mjs";

const expectedBinary = "2675c6bb73a1d293b069fc592f96329d80d5c047c313b1b9b73452361a6a6c86";
const expectedPayload = "1abaa6e6558f2c407a7f52dd827fce3a9e9f16c27dd4a56bb2dacd550b2049a5";
const wallTimeoutMs = 120_000;

async function inspectCandidate(bundle) {
    return {
        binarySha256: await sha256File(path.join(bundle, "Contents/MacOS/EnhanceThat")),
        payloadSha256: await hashInstalledPayload(bundle),
    };
}

function matchesCandidate(observed) {
    return observed.binarySha256 === expectedBinary && observed.payloadSha256 === expectedPayload;
}

async function stopOwnedGroup(pid) {
    const signal = (value) => {
        try { process.kill(-pid, value); }
        catch (error) { if (error?.code !== "ESRCH") throw error; }
    };
    const exists = () => {
        try { process.kill(-pid, 0); return true; }
        catch (error) { if (error?.code === "ESRCH") return false; throw error; }
    };
    const waitForExit = async () => {
        const deadline = performance.now() + 2_000;
        while (exists()) {
            if (performance.now() >= deadline) return false;
            await delay(20);
        }
        return true;
    };

    signal("SIGTERM");
    if (await waitForExit()) return;
    signal("SIGKILL");
    if (!await waitForExit())
        throw new Error(`Timed-out process group ${pid} remains after SIGKILL; cleanup could not be confirmed.`);
}

export async function runChild(probe, bundle, evidence, timeoutMs = wallTimeoutMs) {
    const output = await open(path.join(evidence, "process.log"), "wx", 0o600);
    let wallTimer;
    try {
        const child = spawn(probe, [bundle, evidence], {
            cwd: evidence,
            detached: true,
            stdio: ["ignore", output.fd, output.fd],
        });
        const closed = new Promise((resolve, reject) => {
            child.once("error", reject);
            child.once("close", (code, signal) => resolve({ code, signal }));
        });
        const expired = Symbol("wall-timeout");
        const timeout = new Promise((resolve) => {
            wallTimer = setTimeout(() => resolve(expired), timeoutMs);
        });
        const first = await Promise.race([closed, timeout]);
        if (first !== expired) return { ...first, timedOut: false };

        // Once timeout wins, cleanup owns completion. Leader close can no longer
        // cancel escalation or release the output handle while descendants live.
        await stopOwnedGroup(child.pid);
        return { ...await closed, timedOut: true, processGroupCleaned: true };
    } finally {
        clearTimeout(wallTimer);
        await output.close();
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 3 || args.some((argument) => !path.isAbsolute(argument)))
        throw new Error("Usage: node tools/enhance_that_native_probe/run.mjs <absolute probe executable> <absolute EnhanceThat.vst3> <new absolute evidence directory>");
    if (process.platform !== "darwin")
        throw new Error("This candidate proof is scoped to macOS.");

    const [probe, bundle] = await Promise.all([realpath(args[0]), realpath(args[1])]);
    const parent = await realpath(path.dirname(args[2]));
    const evidence = path.join(parent, path.basename(args[2]));
    const relative = path.relative(bundle, evidence);
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)))
        throw new Error("Evidence must be outside the candidate bundle.");
    if (!(await stat(probe)).isFile() || !(await stat(bundle)).isDirectory())
        throw new Error("Expected a probe executable and a VST3 bundle directory.");
    await access(probe, constants.X_OK);
    const before = await inspectCandidate(bundle);
    if (!matchesCandidate(before))
        throw new Error("Candidate hash differs from reviewed source 954207e4. No native process was started.");

    // mkdir is deliberately exclusive: a rerun needs a new evidence directory.
    await mkdir(evidence, { mode: 0o700 });
    await writeFile(path.join(evidence, "candidate-before.json"), JSON.stringify({
        source: "954207e4b19c6896e6a9ab1cd4b18a8bd566af06", probe,
        probeSha256: await sha256File(probe), bundle, ...before, wallTimeoutMs,
    }, null, 2) + "\n", { flag: "wx", mode: 0o600 });

    let outcome;
    let launchError;
    try { outcome = await runChild(probe, bundle, evidence); }
    catch (error) { launchError = error instanceof Error ? error.message : String(error); }

    let after;
    let readbackError;
    let summary;
    try {
        after = await inspectCandidate(bundle);
        const events = (await readFile(path.join(evidence, "probe/events.jsonl"), "utf8"))
            .trim().split("\n").map((line) => JSON.parse(line));
        summary = events.findLast((event) => event.kind === "summary");
    } catch (error) { readbackError = error instanceof Error ? error.message : String(error); }
    const passed = launchError === undefined && readbackError === undefined
        && outcome?.code === 0 && outcome.timedOut === false && matchesCandidate(after)
        && summary?.failures === 0 && Number.isInteger(summary.assertions) && summary.assertions > 0;
    const result = { status: passed ? "passed" : "failed", outcome, launchError, readbackError,
        candidateAfter: after, summary, evidence };
    await writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = passed ? 0 : 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 2;
    });
}
