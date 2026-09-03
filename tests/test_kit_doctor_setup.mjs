import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exportKit } from "../kit/scripts/export_kit.mjs";
import { collectDoctorReport, formatDoctorReport, parseDoctorArguments } from "../kit/scripts/doctor.mjs";
import {
    downloadVerifiedArtifact,
    formatSetupPlan,
    installArtifact,
    planSetup,
    runSetup,
} from "../kit/scripts/setup.mjs";
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

    assert.throws(() => parseDoctorArguments(["--bogus"]), /Unknown.*argument/u);
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

test("doctor probes a required feed object, rejects denied access, and redacts diagnostics", async () => {
    const capability = "SENTINEL-CAPABILITY-DOCTOR-DO-NOT-LOG";
    await withFixtureRoot(async (root) => {
        const calls = [];
        const healthy = await collectDoctorReport({
            root,
            fetchImpl: async (url, init) => { calls.push([url, init.method]); return { ok: true, status: 200 }; },
        });
        assert.deepEqual(calls, [[`https://feed.example/${capability}/kit.git/HEAD`, "HEAD"]]);
        assert.equal(healthy.feed.reachable, true);
        assert.equal(healthy.feed.status, 200);
        assert.equal(JSON.stringify(healthy).includes(capability), false);
        assert.equal(formatDoctorReport(healthy).includes(capability), false);

        const denied = await collectDoctorReport({
            root,
            fetchImpl: async () => ({ ok: false, status: 403 }),
        });
        assert.equal(denied.feed.reachable, false);
        assert.equal(denied.feed.status, 403);
        assert.equal(denied.ok, false);
        assert.ok(denied.problems.some((problem) => problem.includes("HTTP 403")));
        assert.equal(JSON.stringify(denied).includes(capability), false);
        assert.equal(formatDoctorReport(denied).includes(capability), false);

        const down = await collectDoctorReport({
            root,
            fetchImpl: async () => { throw new Error(`request failed for ${capability}`); },
        });
        assert.equal(down.feed.reachable, false);
        assert.ok(down.problems.some((problem) => problem.includes("not reachable")));
        assert.equal(JSON.stringify(down).includes(capability), false);
        assert.equal(formatDoctorReport(down).includes(capability), false);
    }, { baseUrl: `https://feed.example/${capability}/` });
});

test("malformed feed JSON cannot disclose its source text through parser diagnostics", async () => {
    const capability = "SENTINEL-CAPABILITY-MALFORMED-FEED-DO-NOT-LOG";
    await withFixtureRoot(async (root) => {
        await writeFile(path.join(root, "kit/feed.json"), `{"baseUrl":"https://feed.example/${capability}" trailing}`);
        const report = await collectDoctorReport({ root, offline: true });
        assert.equal(report.ok, false);
        assert.match(report.contracts.error, /Could not read or parse/u);
        assert.equal(JSON.stringify(report).includes(capability), false);
        await assert.rejects(planSetup({ root }), (error) => {
            assert.equal(error.message.includes(capability), false);
            return true;
        });
    });
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

test("setup diagnostics never disclose the feed capability", async () => {
    const capability = "SENTINEL-CAPABILITY-SETUP-DO-NOT-LOG";
    const cmajBytes = Buffer.from("#!/bin/sh\necho current cmaj\n");
    const pluginPin = "c".repeat(64);

    await withFixtureRoot(async (root) => {
        const cmajPath = path.join(root, "build/kit-tools/cmaj");
        const pluginPath = path.join(root, "build/kit-tools/CmajPlugin.vst3");
        await mkdir(path.dirname(cmajPath), { recursive: true });
        await writeFile(cmajPath, cmajBytes);
        await mkdir(path.join(pluginPath, "Contents"), { recursive: true });
        await writeFile(`${pluginPath}.receipt.json`, JSON.stringify({ artifactSha256: pluginPin }));

        const plan = await planSetup({ root, force: true, acceptJuceTerms: true });
        assert.equal(formatSetupPlan(plan).includes(capability), false);
        assert.equal(JSON.stringify(plan).includes(capability), false);

        const dryRunLog = [];
        const dryRun = await runSetup({
            root,
            dryRun: true,
            force: true,
            acceptJuceTerms: true,
            log: (line) => dryRunLog.push(line),
        });
        assert.equal(dryRunLog.join("\n").includes(capability), false);
        assert.equal(JSON.stringify(dryRun).includes(capability), false);

        const successLog = [];
        const success = await runSetup({
            root,
            acceptJuceTerms: true,
            log: (line) => successLog.push(line),
        });
        assert.equal(successLog.join("\n").includes(capability), false);
        assert.equal(JSON.stringify(success).includes(capability), false);

        const downloadLog = [];
        const downloadUrl = `https://feed.example/${capability}/tools/cmaj.tar.gz`;
        let failure;
        try {
            await downloadVerifiedArtifact(downloadUrl, "f".repeat(64), {
                log: (line) => downloadLog.push(line),
                fetchImpl: async () => ({ ok: false, status: 403 }),
            });
        } catch (error) {
            failure = error;
        }
        assert.ok(failure instanceof Error);
        assert.equal(failure.message.includes(capability), false);
        assert.equal(downloadLog.join("\n").includes(capability), false);

        let mismatch;
        try {
            await downloadVerifiedArtifact(downloadUrl, "e".repeat(64), {
                fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => cmajBytes }),
            });
        } catch (error) {
            mismatch = error;
        }
        assert.ok(mismatch instanceof Error);
        assert.equal(mismatch.message.includes(capability), false);
    }, {
        baseUrl: `https://feed.example/${capability}`,
        cmajSha256: sha256(cmajBytes),
        cmajPluginSha256: pluginPin,
    });
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
        assert.equal(String(stalePlan.tools[1].request), "[REDACTED]");
        assert.equal(JSON.stringify(stalePlan).includes("https://feed.example/kit"), false);
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

test("fresh exported customers can setup and default-install the prebuilt plugin while old-tag tools remain usable", async () => {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "kit-setup-exported-"));
    const objectStore = path.join(scratch, "objects");
    const capability = "SENTINEL-CAPABILITY-EXPORTED-SETUP-DO-NOT-LOG";
    try {
        const archiveSource = path.join(scratch, "archive-source");
        const pluginBundle = path.join(archiveSource, "CmajPlugin.vst3");
        await mkdir(path.join(pluginBundle, "Contents/MacOS"), { recursive: true });
        await writeFile(path.join(pluginBundle, "Contents/MacOS/CmajPlugin"), [
            "chocHostKeyboard",
            "__chocHostKeyboardBridgeInstalled",
            "__chocUserFiles",
            "chocUserFiles",
        ].join("\n"));
        await writeFile(path.join(archiveSource, "cmaj"), "#!/bin/sh\necho cmaj\n");
        const cmajArchive = path.join(scratch, "cmaj-macos-arm64.tar.gz");
        const pluginArchive = path.join(scratch, "CmajPlugin-macos-arm64.zip");
        assert.equal(spawnSync("tar", ["-czf", cmajArchive, "-C", archiveSource, "cmaj"]).status, 0);
        assert.equal(spawnSync("zip", ["-r", "-q", pluginArchive, "CmajPlugin.vst3"], { cwd: archiveSource }).status, 0);
        const cmajBytes = await readFile(cmajArchive);
        const pluginBytes = await readFile(pluginArchive);

        for (const version of ["v0.1.0", "v0.1.1"]) {
            const versionRoot = path.join(objectStore, "tools", version);
            await mkdir(versionRoot, { recursive: true });
            await writeFile(path.join(versionRoot, path.basename(cmajArchive)), cmajBytes);
            await writeFile(path.join(versionRoot, path.basename(pluginArchive)), pluginBytes);
        }

        const setupCustomer = async (version) => {
            const root = path.join(scratch, `customer-${version}`);
            await exportKit(root);
            await mkdir(path.join(root, "node_modules"));
            await writeFile(path.join(root, "kit/feed.json"), JSON.stringify({
                schemaVersion: 1,
                baseUrl: `https://feed.example.invalid/${capability}`,
            }));
            const toolchainPath = path.join(root, "kit/toolchain.json");
            const toolchain = JSON.parse(await readFile(toolchainPath, "utf8"));
            toolchain.cmaj.artifact = `tools/${version}/${path.basename(cmajArchive)}`;
            toolchain.cmaj.sha256 = sha256(cmajBytes);
            toolchain.cmajPlugin.artifact = `tools/${version}/${path.basename(pluginArchive)}`;
            toolchain.cmajPlugin.sha256 = sha256(pluginBytes);
            await writeFile(toolchainPath, `${JSON.stringify(toolchain, null, 2)}\n`);

            const requests = [];
            const logs = [];
            await runSetup({
                root,
                acceptJuceTerms: true,
                platform: "linux",
                log: (line) => logs.push(line),
                fetchImpl: async (url) => {
                    requests.push(url);
                    const marker = url.indexOf("/tools/");
                    const bytes = await readFile(path.join(objectStore, url.slice(marker + 1)));
                    return { ok: true, status: 200, arrayBuffer: async () => bytes };
                },
            });
            assert.equal(logs.join("\n").includes(capability), false);
            return { root, requests };
        };

        const current = await setupCustomer("v0.1.1");
        const installHome = path.join(scratch, "install-home");
        const fakeBin = path.join(scratch, "fake-bin");
        await mkdir(installHome);
        await mkdir(fakeBin);
        const fakeCodesign = path.join(fakeBin, "codesign");
        await writeFile(fakeCodesign, "#!/bin/sh\nexit 0\n");
        await chmod(fakeCodesign, 0o755);
        const install = spawnSync(
            path.join(current.root, "kit/scripts/install_cmajplugin_vst3.sh"),
            [],
            {
                cwd: current.root,
                env: { ...process.env, HOME: installHome, PATH: `${fakeBin}:${process.env.PATH}` },
                encoding: "utf8",
            },
        );
        assert.equal(install.status, 0, install.stderr);
        assert.match(install.stdout, /Installed patched CmajPlugin VST3:/u);
        const installedBinary = path.join(installHome, "Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3/Contents/MacOS/CmajPlugin");
        assert.deepEqual(
            await readFile(installedBinary),
            await readFile(path.join(current.root, "build/kit-tools/CmajPlugin.vst3/Contents/MacOS/CmajPlugin")),
            "installer copied the verified setup artifact into the isolated fake HOME",
        );
        assert.equal(`${install.stdout}${install.stderr}`.includes(capability), false);

        const old = await setupCustomer("v0.1.0");
        assert.equal(old.requests.every((url) => url.includes("/tools/v0.1.0/")), true);
        assert.equal(existsSync(path.join(objectStore, "tools/v0.1.1/CmajPlugin-macos-arm64.zip")), true, "new release objects coexist");
        assert.equal(existsSync(path.join(old.root, "build/kit-tools/CmajPlugin.vst3")), true, "old tag still sets up");
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
