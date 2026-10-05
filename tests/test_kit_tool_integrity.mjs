import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { exportKit } from "../scripts/export_kit.mjs";
import { runSetup, planSetup } from "../kit/scripts/setup.mjs";
import { inspectTool, readToolchain, requireCurrentTool, resolveCmajExecutable, sha256Bytes } from "../kit/scripts/toolchain.mjs";
import { collectDoctorReport } from "../kit/scripts/doctor.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const markers = "chocHostKeyboard\n__chocHostKeyboardBridgeInstalled\n__chocUserFiles\nchocUserFiles\n";

async function withCustomer(run) {
    const scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "kit-integrity-")));
    const root = path.join(scratch, "customer");
    try {
        await exportKit(root);
        // This is a current-code consumer fixture, not an export provenance proof.
        for (const directory of ["kit/scripts", "kit/fx"])
            await fs.cp(path.join(repoRoot, directory), path.join(root, directory), { recursive: true, force: true });
        await fs.symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
        const source = path.join(scratch, "source");
        await fs.mkdir(path.join(source, "CmajPlugin.vst3/Contents/MacOS"), { recursive: true });
        await fs.mkdir(path.join(source, "CmajPlugin.vst3/Contents/Resources"));
        await fs.writeFile(path.join(source, "CmajPlugin.vst3/Contents/MacOS/CmajPlugin"), markers);
        await fs.writeFile(path.join(source, "CmajPlugin.vst3/Contents/Resources/data.txt"), "verified resource\n");
        await fs.symlink("data.txt", path.join(source, "CmajPlugin.vst3/Contents/Resources/alias"));
        await fs.writeFile(path.join(source, "cmaj"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$KIT_TEST_CMAJ_CALLS"\n');
        const toolchain = readToolchain(path.join(root, "kit/toolchain.json"));
        const archives = new Map();
        for (const [key, command, args] of [
            ["cmaj", "tar", ["-czf", path.join(scratch, "cmaj.tar.gz"), "-C", source, "cmaj"]],
            ["cmajPlugin", "zip", ["-r", "-y", "-q", path.join(scratch, "plugin.zip"), "CmajPlugin.vst3"]],
        ]) {
            const result = spawnSync(command, args, { cwd: source, encoding: "utf8" });
            assert.equal(result.status, 0, result.stderr);
            const bytes = await fs.readFile(path.join(scratch, key === "cmaj" ? "cmaj.tar.gz" : "plugin.zip"));
            toolchain[key].sha256 = sha256Bytes(bytes);
            archives.set(toolchain[key].artifact, bytes);
        }
        await fs.writeFile(path.join(root, "kit/toolchain.json"), JSON.stringify(toolchain));
        await fs.writeFile(path.join(root, "kit/feed.json"), '{"baseUrl":"https://feed.example/SYNTHETIC-TOOL-COHORT"}');
        const setup = () => runSetup({
            root, acceptJuceTerms: true, machine: { os: "macOS", arch: "arm64", macOSVersion: "15.0" }, log: () => {},
            fetchImpl: async (url) => ({ ok: true, arrayBuffer: async () => archives.get(url.split("/SYNTHETIC-TOOL-COHORT/")[1]) }),
        });
        await setup();
        const cmaj = path.join(root, toolchain.cmaj.localPath);
        const plugin = path.join(root, toolchain.cmajPlugin.localPath);
        // codesign is macOS-only; a stand-in that accepts every bundle lets the
        // installers run here while the hash checks stay real.
        const fakeBin = path.join(scratch, "bin");
        await fs.mkdir(fakeBin);
        await fs.symlink(process.execPath, path.join(fakeBin, "node"));
        await fs.writeFile(path.join(fakeBin, "codesign"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
        const env = { ...process.env, HOME: path.join(scratch, "home"), PATH: `${fakeBin}:/usr/bin:/bin`, BUILDER_KIT_CMAJ: "" };
        const production = () => resolveCmajExecutable({ root, environment: {} });
        const cmajplugin = (...args) => spawnSync(process.execPath, [path.join(root, "kit/scripts/cmajplugin.mjs"), ...args], { cwd: root, env, encoding: "utf8" });
        const install = () => cmajplugin("install", "--dry-run");
        await run({ root, scratch, toolchain, cmaj, plugin, setup, production, install, cmajplugin, env });
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
}

test("verified setup archives work through production, doctor, setup, and installer consumers", async () => {
    await withCustomer(async ({ root, toolchain, cmaj, production, install }) => {
        assert.notEqual(sha256Bytes(await fs.readFile(cmaj)), toolchain.cmaj.sha256, "archive and executable hashes are different identities");
        assert.equal(await production(), cmaj);
        const doctor = await collectDoctorReport({ root, offline: true });
        for (const key of ["cmaj", "cmajPlugin"]) {
            assert.equal(doctor.toolchain[key].status, "current");
            assert.equal(await requireCurrentTool(key, { root }), path.join(root, toolchain[key].localPath));
        }
        assert.deepEqual((await planSetup({ root })).tools.map((step) => step.action), ["skip", "skip"]);
        const result = install();
        assert.equal(result.status, 0, result.stderr);
    });
});

test("customer setup then generic install then JIT validation needs no global cmaj", async () => {
    await withCustomer(async ({ root, scratch, cmaj, setup, cmajplugin, env }) => {
        const calls = path.join(scratch, "cmaj-calls.txt");
        env.KIT_TEST_CMAJ_CALLS = calls;
        assert.equal(spawnSync("cmaj", ["--version"], { env }).error?.code, "ENOENT");
        const install = cmajplugin("install");
        assert.equal(install.status, 0, install.stderr);
        assert.match(install.stdout, /Installed CmajPlugin\.vst3: .*Library\/Audio\/Plug-Ins\/VST3\/CmajPlugin\.vst3/u);
        const jit = (extraEnv = {}) => spawnSync(process.execPath, [path.join(root, "kit/scripts/cmajplugin.mjs"), "jit-install", "enhancer-lite", "--dry-run"], {
            cwd: root, env: { ...env, ...extraEnv }, encoding: "utf8",
        });
        const first = jit();
        assert.equal(first.status, 0, first.stderr);
        assert.match(await fs.readFile(calls, "utf8"), /^play --dry-run --stop-on-error .*\.cmajorpatch\n$/u);
        await fs.appendFile(cmaj, "# altered\n");
        const rejected = jit();
        assert.notEqual(rejected.status, 0);
        assert.match(rejected.stderr, /kit:setup/u);
        assert.notEqual(jit({ BUILDER_KIT_CMAJ: cmaj }).status, 0, "naming the downloaded cmaj explicitly keeps its hash check");
        await setup();
        assert.equal(jit().status, 0);
        assert.equal((await fs.readFile(calls, "utf8")).trim().split("\n").length, 2, "tampered command was never executed");
        assert.match(jit({ BUILDER_KIT_CMAJ: "relative/cmaj" }).stderr, /BUILDER_KIT_CMAJ must be an absolute path/u);
        const maintainerCmaj = path.join(scratch, "maintainer-cmaj");
        await fs.copyFile(cmaj, maintainerCmaj);
        await fs.chmod(maintainerCmaj, 0o755);
        assert.equal(jit({ BUILDER_KIT_CMAJ: maintainerCmaj }).status, 0, "BUILDER_KIT_CMAJ selects a maintainer's own cmaj");
        assert.equal(await fs.stat(path.join(env.HOME, "Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3")).then(() => true), true);
    });
});

test("BUILDER_KIT_CMAJ naming a tampered download cannot bypass its verification", async () => {
    await withCustomer(async ({ root, scratch, cmaj }) => {
        await fs.appendFile(cmaj, "# altered\n");
        const cmake = path.join(scratch, "cmake");
        const calls = path.join(scratch, "must-not-run-cmaj");
        await fs.writeFile(cmake, "#!/bin/sh\nexit 87\n", { mode: 0o755 });
        const result = spawnSync(process.execPath, [path.join(root, "kit/fx/prod-effect.mjs"), "build", "enhancer-lite"], {
            cwd: root, encoding: "utf8", env: { ...process.env, BUILDER_KIT_CMAJ: cmaj, BUILDER_KIT_CMAKE: cmake, KIT_TEST_CMAJ_CALLS: calls },
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /kit:setup/u);
        assert.equal(await fs.stat(calls).then(() => true, () => false), false);
    });
});

for (const [label, key, alter] of [
    ["executable bytes", "cmaj", ({ cmaj }) => fs.appendFile(cmaj, "# tampered\n")],
    ["executable permissions", "cmaj", ({ cmaj }) => fs.chmod(cmaj, 0o644)],
    ["bundle binary", "cmajPlugin", ({ plugin }) => fs.appendFile(path.join(plugin, "Contents/MacOS/CmajPlugin"), "tampered")],
    ["bundle resource", "cmajPlugin", ({ plugin }) => fs.appendFile(path.join(plugin, "Contents/Resources/data.txt"), "tampered")],
    ["bundle added file", "cmajPlugin", ({ plugin }) => fs.writeFile(path.join(plugin, "Contents/extra"), "tampered")],
    ["bundle removed file", "cmajPlugin", ({ plugin }) => fs.rm(path.join(plugin, "Contents/Resources/data.txt"))],
    ["bundle link target", "cmajPlugin", async ({ plugin }) => {
        const link = path.join(plugin, "Contents/Resources/alias");
        await fs.rm(link);
        await fs.symlink("../MacOS/CmajPlugin", link);
    }],
    ["legacy hash-only receipt", "cmaj", ({ cmaj, toolchain }) => fs.writeFile(`${cmaj}.receipt.json`, JSON.stringify({ artifactSha256: toolchain.cmaj.sha256 }))],
]) {
    test(`${label} changes are rejected consistently and repaired by setup`, async () => {
        await withCustomer(async (fixture) => {
            const { root, toolchain, setup, production, install } = fixture;
            await alter(fixture);
            assert.equal((await inspectTool(toolchain, key, { root })).status, "stale");
            assert.equal((await collectDoctorReport({ root, offline: true })).toolchain[key].status, "stale");
            await assert.rejects(requireCurrentTool(key, { root }), /kit:setup/u);
            if (key === "cmaj") await assert.rejects(production(), /kit:setup/u);
            else assert.notEqual(install().status, 0);
            assert.equal((await planSetup({ root })).tools.find((step) => step.key === key).action, "download");
            assert.deepEqual((await setup()).installed, [key]);
            assert.equal((await inspectTool(toolchain, key, { root })).status, "current");
            assert.equal(await production(), fixture.cmaj);
            assert.equal(install().status, 0);
        });
    });
}
