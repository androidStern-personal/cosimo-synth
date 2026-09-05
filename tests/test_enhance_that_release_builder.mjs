import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderEnhanceThatPreinstall } from "../scripts/enhance-that-installer.mjs";
import { claimEnhanceThatOutput, enhanceThatSourceErrors, parseEnhanceThatArgs,
    selectEnhanceThatSigningIdentities } from "../scripts/build_enhance_that_release.mjs";
import { deterministicFlatPackageXarArgs, renderPackageInfo } from "../scripts/build_seqfx_beta_release.mjs";

async function fixture(context) {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "enhance-that-package-source-")));
    context.after(() => rm(root, { recursive: true, force: true }));
    const systemRoot = path.join(root, "System/Library/Audio/Plug-Ins/VST3");
    const home = path.join(root, "Customer's home $HOME");
    await mkdir(systemRoot, { recursive: true });
    await mkdir(home);
    const script = path.join(root, "preinstall");
    const options = { systemRoot, homeDirectories: [home] };
    return { root, systemRoot, home, script, options,
        async run({ teamIdentifier = null, transform = text => text, volume = "/" } = {}) {
            await writeFile(script, transform(renderEnhanceThatPreinstall({ teamIdentifier }, options)));
            return spawnSync("/bin/sh", [script, "test.pkg", "/", volume], { encoding: "utf8" });
        } };
}

test("release modes cannot accidentally notarize a repeatability run", () => {
    assert.equal(parseEnhanceThatArgs([]).mode, "plan");
    assert.equal(parseEnhanceThatArgs(["--unsigned", "--use-existing-build"]).useExistingBuild, true);
    assert.throws(() => parseEnhanceThatArgs(["--release", "--unsigned"]), /one packaging mode/u);
    assert.throws(() => parseEnhanceThatArgs(["--release", "--verify-repeatable-packaging"]), /unsigned packaging/u);
    assert.throws(() => parseEnhanceThatArgs(["--unsigned", "--au-deferred"]), /recorded format decision/u);
    assert.throws(() => parseEnhanceThatArgs(["--publish"]), /Unknown/u);
});

test("source contract requires the reviewed presentation and unchanged saved-session identities", () => {
    const patch = { name: "Enhance That", ID: "dev.cosimo.enhancer-lite", manufacturer: "Cosimo", version: "0.1.0",
        plugin: { pluginCode: "CsEL", manufacturerCode: "Cosi" } };
    const plugin = { productName: "EnhanceThat", cmakeTarget: "EnhanceThat", previousProductName: "CosimoEnhancerLite" };
    assert.deepEqual(enhanceThatSourceErrors(plugin, patch), []);
    assert.ok(enhanceThatSourceErrors(plugin, { ...patch, plugin: { ...patch.plugin, pluginCode: "New1" } }).length);
    assert.ok(enhanceThatSourceErrors({ ...plugin, previousProductName: undefined }, patch).length);
    assert.ok(enhanceThatSourceErrors(plugin, { ...patch, name: "Cosimo Enhancer Lite" }).length);
});

test("signing identity selection rejects ambiguous identities and different teams", () => {
    const app = `1) ${"A".repeat(40)} "Developer ID Application: Fixture (ABCDEFGHIJ)"`;
    const installer = `2) ${"B".repeat(40)} "Developer ID Installer: Fixture (ABCDEFGHIJ)"`;
    const selected = selectEnhanceThatSigningIdentities(`${app}\n${installer}`, {});
    assert.equal(selected.application.sha1Fingerprint, "A".repeat(40));
    assert.throws(() => selectEnhanceThatSigningIdentities(`${app}\n${app}\n${installer}`, {}), /one available/u);
    assert.throws(() => selectEnhanceThatSigningIdentities(`${app}\n${installer.replace("ABCDEFGHIJ", "KLMNOPQRST")}`, {}), /same team/u);
    assert.throws(() => selectEnhanceThatSigningIdentities(`${app}\n${installer}`, { COSIMO_DEVELOPER_ID_APPLICATION: "C".repeat(40) }), /one available/u);
});

test("first-install preflight is read-only and handles literal spaces, quotes and dollar signs", async context => {
    const f = await fixture(context);
    const before = await readdir(f.root);
    const result = await f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readdir(f.systemRoot), []);
    assert.deepEqual(await readdir(f.root), [...before, "preinstall"].sort());
});

for (const location of ["user legacy", "user new", "system legacy"]) {
    test(`preflight refuses ${location} without changing its bytes`, async context => {
        const f = await fixture(context);
        const base = location.startsWith("user") ? path.join(f.home, "Library/Audio/Plug-Ins/VST3") : f.systemRoot;
        const bundle = path.join(base, location.endsWith("new") ? "EnhanceThat.vst3" : "CosimoEnhancerLite.vst3");
        await mkdir(bundle, { recursive: true });
        await writeFile(path.join(bundle, "sentinel"), "preserve original");
        const result = await f.run();
        assert.equal(result.status, 1);
        assert.ok(result.stderr.includes(bundle));
        assert.equal(await readFile(path.join(bundle, "sentinel"), "utf8"), "preserve original");
        assert.equal((await readdir(path.dirname(f.systemRoot))).some(name => name.includes("previous")), false);
    });
}

test("a dangling legacy symlink still blocks installation", async context => {
    const f = await fixture(context);
    await symlink(path.join(f.root, "missing"), path.join(f.systemRoot, "CosimoEnhancerLite.vst3"));
    assert.equal((await f.run()).status, 1);
});

test("preflight rejects a linked scan ancestor and an alternate target volume", async context => {
    const f = await fixture(context);
    assert.equal((await f.run({ volume: "/Volumes/Other" })).status, 1);
    const linked = path.join(f.root, "LinkedSystem");
    await symlink(path.join(f.root, "System"), linked);
    await writeFile(f.script, renderEnhanceThatPreinstall({}, { ...f.options,
        systemRoot: path.join(linked, "Library/Audio/Plug-Ins/VST3") }));
    const result = spawnSync("/bin/sh", [f.script], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolic link/u);
});

test("unsigned validation cannot replace an existing system plugin", async context => {
    const f = await fixture(context);
    await mkdir(path.join(f.systemRoot, "EnhanceThat.vst3"));
    const result = await f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsigned validation installer cannot replace/u);
});

test("signed system-update workflow retains an identical backup outside scan, using a scripted signature adapter", { skip: process.platform !== "darwin" }, async context => {
    const f = await fixture(context);
    const bundle = path.join(f.systemRoot, "EnhanceThat.vst3");
    await mkdir(path.join(bundle, "Contents/Resources"), { recursive: true });
    await writeFile(path.join(bundle, "Contents/payload"), "old system payload");
    await writeFile(path.join(bundle, "Contents/Resources/moduleinfo.json"), JSON.stringify({ Classes: [{ CID: "ABCDEF019182FAEB436F73694373454C" }] }));
    // Workflow-only seam: this test makes no real Developer ID/signature claim.
    const result = await f.run({ teamIdentifier: "ABCDEFGHIJ", transform: text => text.replaceAll("/usr/bin/codesign --verify --deep --strict", "/usr/bin/true") });
    assert.equal(result.status, 0, result.stderr);
    const parent = path.dirname(f.systemRoot);
    const backups = (await readdir(parent)).filter(name => name.startsWith(".EnhanceThat.vst3.previous."));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(parent, backups[0], "previous.bundle/Contents/payload"), "utf8"), "old system payload");
    assert.equal(await readFile(path.join(bundle, "Contents/payload"), "utf8"), "old system payload");
    assert.deepEqual(await readdir(f.systemRoot), ["EnhanceThat.vst3"]);
    assert.ok(result.stderr.includes(backups[0]));
});

test("backup-copy failure preserves the original and reports the actual retained recovery path", { skip: process.platform !== "darwin" }, async context => {
    const f = await fixture(context);
    const bundle = path.join(f.systemRoot, "EnhanceThat.vst3");
    await mkdir(path.join(bundle, "Contents/Resources"), { recursive: true });
    await writeFile(path.join(bundle, "payload"), "original");
    await writeFile(path.join(bundle, "Contents/Resources/moduleinfo.json"), JSON.stringify({ Classes: [{ CID: "ABCDEF019182FAEB436F73694373454C" }] }));
    const result = await f.run({ teamIdentifier: "ABCDEFGHIJ", transform: text => text
        .replaceAll("/usr/bin/codesign --verify --deep --strict", "/usr/bin/true")
        .replaceAll("/usr/bin/ditto", "/usr/bin/false") });
    assert.equal(result.status, 1);
    assert.equal(await readFile(path.join(bundle, "payload"), "utf8"), "original");
    const backup = (await readdir(path.dirname(f.systemRoot))).find(name => name.startsWith(".EnhanceThat.vst3.previous."));
    assert.ok(backup && result.stderr.includes(backup));
});

test("sealed processor metadata mismatch stops a system update before creating recovery state", { skip: process.platform !== "darwin" }, async context => {
    const f = await fixture(context);
    const bundle = path.join(f.systemRoot, "EnhanceThat.vst3");
    await mkdir(path.join(bundle, "Contents/Resources"), { recursive: true });
    await writeFile(path.join(bundle, "Contents/Resources/moduleinfo.json"), JSON.stringify({ Classes: [{ CID: "WRONG" }] }));
    const result = await f.run({ teamIdentifier: "ABCDEFGHIJ", transform: text => text.replaceAll("/usr/bin/codesign --verify --deep --strict", "/usr/bin/true") });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /processor identity differs/u);
    assert.deepEqual(await readdir(path.dirname(f.systemRoot)), ["VST3"]);
});

test("preinstall input validation cannot inject shell lines or signing requirements", () => {
    assert.throws(() => renderEnhanceThatPreinstall({ teamIdentifier: 'BAD"TEAMID' }), /team identifier/u);
    assert.throws(() => renderEnhanceThatPreinstall({}, { systemRoot: "/tmp/scan\nother" }), /single-line/u);
});

test("output claiming preserves old candidates and refuses symlinked output ancestors", async context => {
    const f = await fixture(context);
    const output = path.join(f.root, "release/enhance-that/0.1.3/unsigned");
    await claimEnhanceThatOutput(output, { repositoryRoot: f.root });
    await writeFile(path.join(output, "sentinel"), "existing candidate");
    await assert.rejects(claimEnhanceThatOutput(output, { repositoryRoot: f.root }), { code: "EEXIST" });
    assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "existing candidate");
    const second = path.join(f.root, "second");
    await mkdir(second);
    await symlink(path.join(f.root, "System"), path.join(second, "release"));
    await assert.rejects(claimEnhanceThatOutput(path.join(second, "release/enhance-that/0.1.3/unsigned"), { repositoryRoot: second }), /Unsafe release directory/u);
    assert.deepEqual(await readdir(path.join(f.root, "System")), ["Library"]);
});

test("package metadata separates release version from unchanged bundle version and includes the guard", () => {
    const config = { identity: { bundleName: "EnhanceThat", installerIdentifier: "dev.cosimo.enhancer-lite.pkg",
        pluginVersion: "0.1.0", patchId: "dev.cosimo.enhancer-lite" } };
    const xml = renderPackageInfo(config, [], { packageVersion: "0.1.3", preinstall: true });
    assert.match(xml, /postinstall-action="none" version="0\.1\.3"/u);
    assert.match(xml, /CFBundleVersion="0\.1\.0"/u);
    assert.match(xml, /<preinstall file="\.\/preinstall"\/>/u);
    assert.equal(deterministicFlatPackageXarArgs("output.pkg", { scripts: true }).at(-1), "Scripts");
    assert.equal(deterministicFlatPackageXarArgs("output.pkg").includes("Scripts"), false);
});
