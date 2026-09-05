import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { runChild } from "./run.mjs";

const runner = fileURLToPath(new URL("./run.mjs", import.meta.url));

test("launcher refuses missing and relative arguments before any host launch", () => {
    for (const args of [[], ["relative-probe", "/unused.vst3", "/unused-evidence"]]) {
        const result = spawnSync(process.execPath, [runner, ...args], { encoding: "utf8", timeout: 10_000 });
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Usage:/u);
    }
});

function alive(pid) {
    try { process.kill(pid, 0); return true; }
    catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

async function waitFor(predicate, timeoutMs = 5_000) {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
        assert.ok(performance.now() < deadline, "Inert process fixture did not reach its expected state");
        await delay(20);
    }
}

test("timeout waits for group cleanup when leader exits and descendant ignores SIGTERM", { skip: process.platform === "win32" }, async (context) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "enhance-that-watchdog-"));
    const evidence = path.join(root, "evidence");
    await mkdir(evidence);
    const descendantScript = path.join(root, "descendant.cjs");
    const leaderScript = path.join(root, "leader.cjs");
    const leaderFile = path.join(evidence, "leader.pid");
    const descendantFile = path.join(evidence, "descendant.pid");
    const leaderTermFile = path.join(evidence, "leader-term");
    const descendantTermFile = path.join(evidence, "descendant-term");
    await writeFile(descendantScript, `
const fs = require('node:fs');
const path = require('node:path');
process.on('SIGTERM', () => fs.writeFileSync(path.join(process.argv[2], 'descendant-term'), 'ignored'));
fs.writeFileSync(path.join(process.argv[2], 'descendant.pid'), String(process.pid));
setInterval(() => {}, 1000);
`);
    await writeFile(leaderScript, `
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const evidence = process.argv[2];
process.on('SIGTERM', () => { fs.writeFileSync(path.join(evidence, 'leader-term'), 'exiting'); process.exit(0); });
fs.writeFileSync(path.join(evidence, 'leader.pid'), String(process.pid));
spawn(process.execPath, [path.join(__dirname, 'descendant.cjs'), evidence], { stdio: 'ignore' });
setInterval(() => {}, 1000);
`);
    let leader;
    let descendant;
    let returned = false;
    const run = runChild(process.execPath, leaderScript, evidence, 400).then((result) => {
        returned = true;
        return result;
    });
    // Own rejection even if fixture setup fails before the awaited result below.
    const observedRun = run.then((value) => ({ value }), (error) => ({ error }));
    try {
        await waitFor(() => existsSync(leaderTermFile) && existsSync(descendantTermFile));
        leader = Number(await readFile(leaderFile, "utf8"));
        descendant = Number(await readFile(descendantFile, "utf8"));
        await waitFor(() => !alive(leader));
        const returnedWhileDescendantAlive = returned && alive(descendant);
        const observed = await observedRun;
        assert.equal(observed.error, undefined);
        const outcome = observed.value;
        const descendantAliveAtReturn = alive(descendant);
        context.diagnostic(JSON.stringify({ outcome, returnedWhileDescendantAlive, descendantAliveAtReturn }));
        assert.equal(outcome.timedOut, true);
        assert.equal(outcome.code, 0, "Leader exits normally in its SIGTERM handler");
        assert.equal(returnedWhileDescendantAlive, false, "Leader exit must not complete timed-out group cleanup");
        assert.equal(descendantAliveAtReturn, false, "SIGTERM-resistant descendant must be gone when runChild returns");
        assert.equal(alive(-leader), false, "Owned process group must be gone at completion");
    } finally {
        if (leader === undefined && existsSync(leaderFile)) leader = Number(await readFile(leaderFile, "utf8"));
        if (leader !== undefined && alive(-leader)) process.kill(-leader, "SIGKILL");
        await observedRun;
        if (leader !== undefined) await waitFor(() => !alive(-leader));
        await rm(root, { recursive: true, force: true });
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
