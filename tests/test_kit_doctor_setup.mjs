import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { collectDoctorReport, formatDoctorReport, parseDoctorArguments } from "../kit/scripts/doctor.mjs";
import { downloadVerifiedArtifact, installArtifact, planSetup, runSetup } from "../kit/scripts/setup.mjs";
import {
    inspectTool,
    normalizePin,
    readJuceAcknowledgment,
    readToolchain,
    satisfiesRange,
    writeJuceAcknowledgment,
} from "../kit/scripts/toolchain.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const doctorCli = path.join(repoRoot, "kit/scripts/doctor.mjs");
const setupCli = path.join(repoRoot, "kit/scripts/setup.mjs");

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

/** A throwaway repo root holding only the two contracts; tools land under its build/kit-tools/. */
async function withFixtureRoot(run, { cmajSha256 = "", cmajPluginSha256 = "", baseUrl = "" } = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-doctor-setup-"));

    try {
        await mkdir(path.join(root, "kit"), { recursive: true });
        await writeFile(path.join(root, "kit/feed.json"), JSON.stringify({ schemaVersion: 1, baseUrl }));
        await writeFile(path.join(root, "kit/toolchain.json"), JSON.stringify({
            schemaVersion: 1,
            cmaj: { forkCommit: "abc", artifact: "tools/cmaj-test.tar.gz", sha256: cmajSha256, localPath: "build/kit-tools/cmaj" },
            cmajPlugin: { artifact: "tools/CmajPlugin-test.zip", sha256: cmajPluginSha256, localPath: "build/kit-tools/CmajPlugin.vst3" },
            requirements: { os: "macOS", minMacOS: "15.0", arch: "arm64", node: ">=22", cmake: ">=3.28", xcodeCommandLineTools: true },
        }));
        // node_modules present so runSetup never shells out to npm in tests.
        await mkdir(path.join(root, "node_modules"), { recursive: true });
        return await run(root);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

const silentLog = () => {};

test("doctor_json_report_has_the_documented_shape_for_this_repo", () => {
    const run = spawnSync(process.execPath, [doctorCli, "--json", "--offline"], { encoding: "utf8", cwd: repoRoot });

    assert.equal(run.status, 0, run.stderr);

    const report = JSON.parse(run.stdout);

    assert.equal(report.kitDoctor, 1);
    assert.equal(typeof report.ok, "boolean");
    assert.ok(Array.isArray(report.problems));
    assert.deepEqual(
        Object.keys(report).sort(),
        ["contracts", "feed", "generatedAt", "juceTerms", "kit", "kitDoctor", "nodeModules", "ok", "platform", "problems", "registry", "root", "toolchain", "tools", "warnings"],
    );
    assert.match(report.kit.version, /^\d+\.\d+\.\d+$/u);
    assert.equal(report.kit.schemaVersions.plugin, 1);
    assert.equal(report.kit.productOwner.present, true);
    assert.equal(report.kit.productOwner.placeholder, false, "the monorepo owner file is not the template placeholder");
    assert.ok(report.registry.configs.every((config) => config.kind === "plugin" && config.supported === true), JSON.stringify(report.registry.configs));
    assert.deepEqual(Object.keys(report.tools).sort(), ["cmake", "git", "node", "xcodeCommandLineTools"]);
    assert.equal(report.tools.node.present, true);
    assert.equal(report.tools.node.required, ">=22");
    assert.deepEqual(Object.keys(report.toolchain).sort(), ["cmaj", "cmajPlugin"]);
    assert.ok(["missing", "current", "stale", "unpinned"].includes(report.toolchain.cmaj.status));
    assert.equal(report.toolchain.cmaj.relativePath, "build/kit-tools/cmaj");
    assert.equal(report.feed.checked, false, "the monorepo feed is empty, so nothing is probed");
    assert.equal(report.registry.ok, true, report.registry.error);
    assert.ok(report.registry.targets.some((target) => target.alias === "enhancer-lite"));
    for (const target of report.registry.targets)
        assert.match(target.patch, /^fx\/[^/]+\/[^/]+\.cmajorpatch$/u);
    assert.equal(report.nodeModules.present, true);
    assert.equal(typeof report.juceTerms.acknowledged, "boolean");
    assert.equal(report.platform.requirements.os, "macOS");
});

test("doctor_human_output_ends_with_a_json_block_and_strict_only_changes_the_exit_code", () => {
    const plain = spawnSync(process.execPath, [doctorCli, "--offline"], { encoding: "utf8", cwd: repoRoot });
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /^kit:doctor\n\[/u);
    assert.match(plain.stdout, /\nJSON:\n\{/u);
    const report = JSON.parse(plain.stdout.slice(plain.stdout.indexOf("\nJSON:\n") + "\nJSON:\n".length));
    assert.equal(typeof report.ok, "boolean");

    const strict = spawnSync(process.execPath, [doctorCli, "--json", "--offline", "--strict"], { encoding: "utf8", cwd: repoRoot });
    assert.equal(strict.status, report.ok ? 0 : 1);

    assert.throws(() => parseDoctorArguments(["--bogus"]), /Unknown argument/u);
});

test("doctor_reports_missing_contracts_and_tools_without_throwing", async () => {
    await withFixtureRoot(async (root) => {
        const report = await collectDoctorReport({ root, offline: true, platform: "darwin", arch: "arm64" });

        assert.equal(report.contracts.error, null);
        assert.equal(report.platform.osOk, true);
        assert.equal(report.platform.archOk, true);
        assert.equal(report.toolchain.cmaj.status, "missing");
        assert.equal(report.toolchain.cmajPlugin.status, "missing");
        assert.equal(report.registry.ok, false, "no kit/fx/build-effect.mjs in the fixture");
        assert.ok(report.problems.some((problem) => problem.includes("cmaj at build/kit-tools/cmaj is missing")));
        assert.equal(report.ok, false);

        const text = formatDoctorReport(report);
        assert.match(text, /\[!!\] cmaj at build\/kit-tools\/cmaj: missing/u);
        assert.match(text, /problem\(s\):/u);

        await rm(path.join(root, "kit/toolchain.json"));
        const broken = await collectDoctorReport({ root, offline: true });
        assert.match(broken.contracts.error, /Could not read/u);
        assert.deepEqual(broken.toolchain, {});
        assert.equal(broken.ok, false);
    });
});

test("doctor_feed_check_uses_a_head_request_and_reports_unreachable_feeds", async () => {
    await withFixtureRoot(async (root) => {
        const calls = [];
        const reachable = await collectDoctorReport({
            root,
            fetchImpl: async (url, init) => { calls.push([url, init.method]); return { status: 403 }; },
        });
        assert.deepEqual(calls, [["https://feed.example/kit-abc/", "HEAD"]]);
        assert.equal(reachable.feed.reachable, true);
        assert.equal(reachable.feed.status, 403);

        const down = await collectDoctorReport({ root, fetchImpl: async () => { throw new Error("ENOTFOUND"); } });
        assert.equal(down.feed.reachable, false);
        assert.ok(down.problems.some((problem) => problem.includes("not reachable")));
    }, { baseUrl: "https://feed.example/kit-abc/" });
});

test("setup_refuses_to_download_when_the_hash_pin_is_empty", async () => {
    await withFixtureRoot(async (root) => {
        const plan = await planSetup({ root });
        assert.deepEqual(plan.tools.map((step) => step.action), ["refuse-unpinned", "refuse-unpinned"]);

        let fetched = false;
        await assert.rejects(
            runSetup({ root, acceptJuceTerms: true, log: silentLog, fetchImpl: async () => { fetched = true; } }),
            /carries no sha256 for cmaj/u,
        );
        assert.equal(fetched, false, "no network before the refusal");
        assert.equal(existsSync(path.join(root, "build/kit-tools/cmaj")), false);
        assert.equal(readJuceAcknowledgment(root), null, "a refused run records nothing");
    }, { baseUrl: "https://feed.example/kit" });

    // A pinned toolchain with no feed URL is refused too.
    await withFixtureRoot(async (root) => {
        const plan = await planSetup({ root });
        assert.deepEqual(plan.tools.map((step) => step.action), ["refuse-no-feed", "refuse-no-feed"]);
    }, { cmajSha256: "a".repeat(64), cmajPluginSha256: "b".repeat(64) });

    const setupCliRun = spawnSync(process.execPath, [setupCli, "--dry-run"], { encoding: "utf8", cwd: repoRoot });
    assert.equal(setupCliRun.status, 0, setupCliRun.stderr);
    assert.match(setupCliRun.stdout, /juce\.com\/legal\/juce-9-licence/u);
    assert.match(setupCliRun.stdout, /cmaj: REFUSE - kit\/toolchain\.json carries no sha256/u);
    assert.match(setupCliRun.stdout, /Dry run: nothing was written/u);
});

test("setup_skips_a_local_tool_that_already_matches_its_pin", async () => {
    const cmajBytes = Buffer.from("#!/bin/sh\necho fake cmaj\n");
    const pluginArtifactSha256 = "c".repeat(64);

    await withFixtureRoot(async (root) => {
        const toolchain = readToolchain(path.join(root, "kit/toolchain.json"));
        const cmajPath = path.join(root, "build/kit-tools/cmaj");
        const pluginPath = path.join(root, "build/kit-tools/CmajPlugin.vst3");

        // cmaj: the local file's own sha256 equals the pin.
        await mkdir(path.dirname(cmajPath), { recursive: true });
        await writeFile(cmajPath, cmajBytes);
        // CmajPlugin.vst3: a directory bundle, recognised through its install receipt.
        await mkdir(path.join(pluginPath, "Contents"), { recursive: true });
        await writeFile(`${pluginPath}.receipt.json`, JSON.stringify({ key: "cmajPlugin", artifactSha256: pluginArtifactSha256 }));

        const cmaj = await inspectTool(toolchain, "cmaj", { root });
        assert.equal(cmaj.status, "current");
        assert.equal(cmaj.matchedBy, "file-sha256");
        const plugin = await inspectTool(toolchain, "cmajPlugin", { root });
        assert.equal(plugin.status, "current");
        assert.equal(plugin.matchedBy, "receipt");
        assert.equal(plugin.kind, "directory");

        let fetched = false;
        const result = await runSetup({ root, acceptJuceTerms: true, log: silentLog, fetchImpl: async () => { fetched = true; } });
        assert.equal(fetched, false);
        assert.deepEqual(result.skipped, ["cmaj", "cmajPlugin"]);
        assert.deepEqual(result.installed, []);
        assert.deepEqual(await readFile(cmajPath), cmajBytes, "an already-matching tool is left untouched");

        // A stale receipt (older release) means a re-download, and --force always does.
        await writeFile(`${pluginPath}.receipt.json`, JSON.stringify({ artifactSha256: "d".repeat(64) }));
        const stalePlan = await planSetup({ root });
        assert.deepEqual(stalePlan.tools.map((step) => step.action), ["skip", "download"]);
        assert.equal(stalePlan.tools[1].url, "https://feed.example/kit/tools/CmajPlugin-test.zip");
        const forcedPlan = await planSetup({ root, force: true });
        assert.deepEqual(forcedPlan.tools.map((step) => step.action), ["download", "download"]);
    }, { cmajSha256: sha256(cmajBytes), cmajPluginSha256: pluginArtifactSha256, baseUrl: "https://feed.example/kit/" });
});

test("setup_verifies_the_download_hash_and_installs_from_the_archive", async () => {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "kit-setup-archive-"));

    try {
        const cmajSource = path.join(scratch, "cmaj");
        await writeFile(cmajSource, "#!/bin/sh\necho cmaj from archive\n");
        const tar = spawnSync("tar", ["-czf", path.join(scratch, "cmaj.tar.gz"), "-C", scratch, "cmaj"], { encoding: "utf8" });
        assert.equal(tar.status, 0, tar.stderr);
        const archiveBytes = await readFile(path.join(scratch, "cmaj.tar.gz"));
        const pin = sha256(archiveBytes);
        const pluginPin = "c".repeat(64);

        await assert.rejects(
            downloadVerifiedArtifact("https://feed.example/kit/tools/cmaj-test.tar.gz", "e".repeat(64), {
                fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => archiveBytes }),
            }),
            /sha256 mismatch/u,
        );

        await withFixtureRoot(async (root) => {
            // CmajPlugin.vst3 is already installed and matches its pin (receipt),
            // so only cmaj is downloaded; an unpinned tool would refuse the whole run.
            const pluginPath = path.join(root, "build/kit-tools/CmajPlugin.vst3");
            await mkdir(path.join(pluginPath, "Contents"), { recursive: true });
            await writeFile(`${pluginPath}.receipt.json`, JSON.stringify({ key: "cmajPlugin", artifactSha256: pluginPin }));

            const requested = [];
            const result = await runSetup({
                root,
                acceptJuceTerms: true,
                log: silentLog,
                platform: "linux",
                fetchImpl: async (url) => { requested.push(url); return { ok: true, status: 200, arrayBuffer: async () => archiveBytes }; },
            });

            assert.deepEqual(requested, ["https://feed.example/kit/tools/cmaj-test.tar.gz"]);
            assert.deepEqual(result.installed, ["cmaj"]);
            assert.deepEqual(result.skipped, ["cmajPlugin"]);

            const cmajPath = path.join(root, "build/kit-tools/cmaj");
            assert.equal(await readFile(cmajPath, "utf8"), "#!/bin/sh\necho cmaj from archive\n");
            const receipt = JSON.parse(await readFile(`${cmajPath}.receipt.json`, "utf8"));
            assert.equal(receipt.artifactSha256, pin);
            assert.equal(receipt.artifact, "tools/cmaj-test.tar.gz");
            const executable = spawnSync(cmajPath, [], { encoding: "utf8" });
            assert.equal(executable.stdout, "cmaj from archive\n", "chmod +x applied");
            assert.equal(existsSync(path.join(root, "build/kit-tools/.staging-cmaj")), false);

            const toolchain = readToolchain(path.join(root, "kit/toolchain.json"));
            const inspection = await inspectTool(toolchain, "cmaj", { root });
            assert.equal(inspection.status, "current");
            assert.equal(inspection.matchedBy, "receipt");

            // Second run: idempotent, no network.
            const again = await runSetup({ root, log: silentLog, fetchImpl: async () => { throw new Error("must not fetch"); } });
            assert.deepEqual(again.installed, []);
            assert.deepEqual(again.skipped, ["cmaj", "cmajPlugin"]);
        }, { cmajSha256: pin, cmajPluginSha256: pluginPin, baseUrl: "https://feed.example/kit" });

        // A sole archive entry installs under whatever name localPath uses.
        const renamedTarget = path.join(scratch, "install/other-name");
        await installArtifact({ key: "cmaj", artifact: "tools/other.tar.gz", bytes: archiveBytes, pin, localPath: renamedTarget, platform: "linux" });
        assert.equal(await readFile(renamedTarget, "utf8"), "#!/bin/sh\necho cmaj from archive\n");
        assert.equal(JSON.parse(await readFile(`${renamedTarget}.receipt.json`, "utf8")).artifactSha256, pin);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
});

test("juce_acknowledgment_round_trips_and_gates_setup", async () => {
    const cmajBytes = Buffer.from("#!/bin/sh\necho current cmaj\n");
    const pluginArtifactSha256 = "2".repeat(64);

    await withFixtureRoot(async (root) => {
        // Both tools already current, so an accepting run has nothing to download.
        await mkdir(path.join(root, "build/kit-tools/CmajPlugin.vst3"), { recursive: true });
        await writeFile(path.join(root, "build/kit-tools/cmaj"), cmajBytes);
        await writeFile(path.join(root, "build/kit-tools/CmajPlugin.vst3.receipt.json"), JSON.stringify({ artifactSha256: pluginArtifactSha256 }));

        assert.equal(readJuceAcknowledgment(root), null);

        await assert.rejects(runSetup({ root, log: silentLog }), /--accept-juce-terms/u);
        assert.equal(readJuceAcknowledgment(root), null);

        const dry = await runSetup({ root, dryRun: true, log: silentLog });
        assert.equal(dry.dryRun, true);
        assert.equal(readJuceAcknowledgment(root), null, "dry runs never record acknowledgment");

        const now = new Date("2026-09-01T12:00:00.000Z");
        const written = await writeJuceAcknowledgment(root, { now });
        assert.equal(written.acknowledgedAt, "2026-09-01T12:00:00.000Z");
        const stored = JSON.parse(await readFile(path.join(root, "build/kit-tools/juce-terms-acknowledged.json"), "utf8"));
        assert.equal(stored.acknowledged, true);
        assert.equal(stored.acknowledgedAt, "2026-09-01T12:00:00.000Z");
        assert.match(stored.licenseUrl, /juce\.com\/legal\/juce-9-licence/u);
        assert.deepEqual(readJuceAcknowledgment(root), stored);

        // With the file present the flag is no longer needed, and the plan reports it.
        const plan = await planSetup({ root });
        assert.equal(plan.juce.acknowledged, true);
        assert.equal(plan.juce.acknowledgedAt, "2026-09-01T12:00:00.000Z");
        const report = await collectDoctorReport({ root, offline: true });
        assert.equal(report.juceTerms.acknowledged, true);
        assert.equal(report.juceTerms.acknowledgedAt, "2026-09-01T12:00:00.000Z");

        // A run that accepts via the flag writes the same file with a fresh timestamp.
        await rm(path.join(root, "build/kit-tools/juce-terms-acknowledged.json"));
        const later = new Date("2026-09-02T08:30:00.000Z");
        const accepted = await runSetup({
            root,
            acceptJuceTerms: true,
            log: silentLog,
            now: () => later,
            fetchImpl: async () => { throw new Error("must not fetch"); },
        });
        assert.deepEqual(accepted.skipped, ["cmaj", "cmajPlugin"]);
        assert.equal(readJuceAcknowledgment(root).acknowledgedAt, later.toISOString());
    }, { cmajSha256: sha256(cmajBytes), cmajPluginSha256: pluginArtifactSha256, baseUrl: "https://feed.example/kit" });
});

test("toolchain_helpers_normalize_pins_and_version_ranges", () => {
    assert.equal(normalizePin(""), "");
    assert.equal(normalizePin("  " + "A".repeat(64) + " "), "a".repeat(64));
    assert.throws(() => normalizePin("deadbeef"), /64 hex/u);
    assert.equal(satisfiesRange("22.22.2", ">=22"), true);
    assert.equal(satisfiesRange("20.11.0", ">=22"), false);
    assert.equal(satisfiesRange("3.28.3", ">=3.28"), true);
    assert.equal(satisfiesRange("3.27.9", ">=3.28"), false);
    assert.equal(satisfiesRange("15.1", ">=15.0"), true);
    assert.equal(satisfiesRange("2.43.0", ""), null, "an absent range is not enforced");
    assert.equal(satisfiesRange(null, ">=1"), false);
});
