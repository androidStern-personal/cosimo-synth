import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderEnhanceThatPreinstall } from "../scripts/enhance-that-installer.mjs";
import { claimEnhanceThatOutput, enhanceThatSourceErrors, parseEnhanceThatArgs,
    enhanceThatAuIdentityErrors, selectEnhanceThatSigningIdentities,
    verifyFreshEnhanceThatBundles } from "../scripts/build_enhance_that_release.mjs";
import { assertPayloadModes, buildUnsignedFlatPackage, deterministicFlatPackageXarArgs,
    normalizePayloadModes, payloadInventoryErrors, renderPackageInfo } from "../scripts/build_seqfx_beta_release.mjs";

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
        async run({ teamIdentifier = null, includeAU = false, transform = text => text, volume = "/" } = {}) {
            await writeFile(script, transform(renderEnhanceThatPreinstall({ teamIdentifier, includeAU }, options)));
            return spawnSync("/bin/sh", [script, "test.pkg", "/", volume], { encoding: "utf8" });
        } };
}

test("release modes always rebuild and cannot accidentally notarize a repeatability run", () => {
    assert.equal(parseEnhanceThatArgs([]).mode, "plan");
    assert.throws(() => parseEnhanceThatArgs(["--unsigned", "--use-existing-build"]), /Unknown/u);
    assert.throws(() => parseEnhanceThatArgs(["--release", "--unsigned"]), /one packaging mode/u);
    assert.throws(() => parseEnhanceThatArgs(["--release", "--verify-repeatable-packaging"]), /unsigned packaging/u);
    assert.throws(() => parseEnhanceThatArgs(["--unsigned", "--au-deferred"]), /recorded format decision/u);
    assert.throws(() => parseEnhanceThatArgs(["--publish"]), /Unknown/u);
    assert.equal(parseEnhanceThatArgs(["--unsigned", "--include-au"]).includeAU, true);
    assert.throws(() => parseEnhanceThatArgs(["--include-au", "--au-deferred", "decision"]), /not both/u);
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
    const bothFormats = await f.run({ includeAU: true });
    assert.equal(bothFormats.status, 0, bothFormats.stderr);
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

const auInfo = {
    CFBundleIdentifier: "dev.cosimo.enhancer-lite", CFBundleExecutable: "EnhanceThat",
    CFBundleVersion: "0.1.0", CFBundleShortVersionString: "0.1.0",
    AudioComponents: [{ type: "aufx", subtype: "CsEL", manufacturer: "Cosi" }],
};

test("AU verification uses the exact component identity and product version", () => {
    assert.deepEqual(enhanceThatAuIdentityErrors(auInfo, "0.1.0"), []);
    for (const field of ["type", "subtype", "manufacturer"])
        assert.ok(enhanceThatAuIdentityErrors({ ...auInfo,
            AudioComponents: [{ ...auInfo.AudioComponents[0], [field]: "wrong" }] }, "0.1.0").length);
    assert.ok(enhanceThatAuIdentityErrors({ ...auInfo, AudioComponents: [...auInfo.AudioComponents, ...auInfo.AudioComponents] }, "0.1.0").length);
    assert.ok(enhanceThatAuIdentityErrors(auInfo, "0.1.1").length);
    assert.ok(enhanceThatAuIdentityErrors({ ...auInfo, CFBundleIdentifier: "different.plugin" }, "0.1.0").length);
});

test("fresh AU is ad-hoc sealed before strict built verification", async () => {
    const vst3 = "/fixture/EnhanceThat.vst3";
    const au = "/fixture/EnhanceThat.component";
    const calls = [];
    const built = await verifyFreshEnhanceThatBundles({ payloadBundles: [
        { format: "VST3", builtPath: vst3 },
        { format: "AU", builtPath: au },
    ] }, {
        execute: (executable, args) => calls.push({ operation: "sign", executable, args }),
        verify: async (_config, bundle, format) => {
            calls.push({ operation: "verify", bundle, format });
            return { payloadSha256: `${format}-payload` };
        },
    });
    assert.deepEqual(calls, [
        { operation: "verify", bundle: vst3, format: "VST3" },
        { operation: "sign", executable: "/usr/bin/codesign",
            args: ["--force", "--sign", "-", au] },
        { operation: "verify", bundle: au, format: "AU" },
    ]);
    assert.equal(built.VST3.payloadSha256, "VST3-payload");
    assert.equal(built.AU.payloadSha256, "AU-payload");
});

for (const location of ["user legacy", "user new", "system legacy"]) {
    test(`AU inclusion refuses ${location} without changing its bytes`, async context => {
        const f = await fixture(context);
        const base = location.startsWith("user") ? path.join(f.home, "Library/Audio/Plug-Ins/Components")
            : path.join(path.dirname(f.systemRoot), "Components");
        const bundle = path.join(base, location.endsWith("new") ? "EnhanceThat.component" : "CosimoEnhancerLite.component");
        await mkdir(bundle, { recursive: true });
        await writeFile(path.join(bundle, "sentinel"), "preserve original AU");
        const result = await f.run({ includeAU: true });
        assert.equal(result.status, 1);
        assert.ok(result.stderr.includes(bundle));
        assert.equal(await readFile(path.join(bundle, "sentinel"), "utf8"), "preserve original AU");
        assert.equal((await readdir(path.dirname(f.systemRoot))).some(name => name.includes("previous")), false);
    });
}

test("AU system update rejects a mismatched component and preserves matching recovery", { skip: process.platform !== "darwin" }, async context => {
    const f = await fixture(context);
    const vst3 = path.join(f.systemRoot, "EnhanceThat.vst3");
    const bundle = path.join(path.dirname(f.systemRoot), "Components/EnhanceThat.component");
    await mkdir(path.join(bundle, "Contents"), { recursive: true });
    const info = path.join(bundle, "Contents/Info.plist");
    const signedFixture = { includeAU: true, teamIdentifier: "ABCDEFGHIJ",
        transform: text => text.replaceAll("/usr/bin/codesign --verify --deep --strict", "/usr/bin/true") };
    await writeFile(info, JSON.stringify(auInfo));
    assert.match((await f.run({ includeAU: true })).stderr, /unsigned validation installer cannot replace/u);
    await mkdir(path.join(vst3, "Contents/Resources"), { recursive: true });
    await writeFile(path.join(vst3, "Contents/Resources/moduleinfo.json"), JSON.stringify({ Classes: [{ CID: "ABCDEF019182FAEB436F73694373454C" }] }));
    await writeFile(info, JSON.stringify({ ...auInfo, AudioComponents: [...auInfo.AudioComponents, ...auInfo.AudioComponents] }));
    assert.match((await f.run(signedFixture)).stderr, /exactly one component/u);
    await writeFile(info, JSON.stringify({ ...auInfo, AudioComponents: [{ ...auInfo.AudioComponents[0], subtype: "WRNG" }] }));
    assert.match((await f.run(signedFixture)).stderr, /AU identity differs/u);
    assert.equal((await readdir(path.dirname(f.systemRoot))).some(name => name.includes("previous")), false);
    await writeFile(info, JSON.stringify(auInfo));
    const result = await f.run(signedFixture);
    assert.equal(result.status, 0, result.stderr);
    const parent = path.dirname(f.systemRoot);
    const backups = (await readdir(parent)).filter(name => name.startsWith(".EnhanceThat.component.previous."));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(parent, backups[0], "previous.bundle/Contents/Info.plist"), "utf8"), await readFile(info, "utf8"));
    assert.ok((await readFile(path.join(parent, backups[0], "RECOVERY.txt"), "utf8")).includes(bundle));
    const vst3Backup = (await readdir(parent)).find(name => name.startsWith(".EnhanceThat.vst3.previous."));
    assert.ok(vst3Backup);
    assert.ok(result.stderr.includes(backups[0]) && result.stderr.includes(vst3Backup));
    assert.equal(await readFile(path.join(parent, vst3Backup, "previous.bundle/Contents/Resources/moduleinfo.json"), "utf8"),
        await readFile(path.join(vst3, "Contents/Resources/moduleinfo.json"), "utf8"));
});

test("both declared formats retain executable modes and survive existing flat-package extraction", { skip: process.platform !== "darwin" }, async context => {
    const f = await fixture(context);
    const config = { identity: { bundleName: "EnhanceThat", installerIdentifier: "dev.cosimo.enhancer-lite.pkg",
        pluginVersion: "0.1.0", patchId: "dev.cosimo.enhancer-lite" }, payloadBundles: [
        { format: "VST3", relativePath: "Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3" },
        { format: "AU", relativePath: "Library/Audio/Plug-Ins/Components/EnhanceThat.component" },
    ] };
    const staging = path.join(f.root, "payload");
    const files = [];
    for (const bundle of config.payloadBundles) {
        for (const file of ["Contents/Info.plist", "Contents/MacOS/EnhanceThat", "Contents/_CodeSignature/CodeResources",
            ...(bundle.format === "VST3" ? ["Contents/Resources/moduleinfo.json"] : [])]) {
            const relative = `${bundle.relativePath}/${file}`;
            await mkdir(path.dirname(path.join(staging, relative)), { recursive: true });
            await writeFile(path.join(staging, relative), "fixture");
            await chmod(path.join(staging, relative), 0o644);
            files.push(`./${relative}`);
        }
    }
    await normalizePayloadModes(config, staging);
    await assertPayloadModes(config, staging);
    for (const bundle of config.payloadBundles)
        assert.equal((await stat(path.join(staging, bundle.relativePath, "Contents/MacOS/EnhanceThat"))).mode & 0o777, 0o755);
    assert.deepEqual(payloadInventoryErrors(config, files, { signed: false }), []);
    assert.ok(payloadInventoryErrors(config, files.filter(file => !file.includes(".component/Contents/MacOS")), { signed: false }).length);
    assert.ok(payloadInventoryErrors(config, [...files, "./Library/Audio/Plug-Ins/Components/Other.component/payload"], { signed: false }).length);
    assert.ok(payloadInventoryErrors({ identity: config.identity }, files, { signed: false }).length);
    assert.throws(() => renderPackageInfo({ ...config, payloadBundles: [{ format: "AU", relativePath: "../escape" }] }, []), /payload paths/u);
    const pkg = path.join(f.root, "fixture.pkg");
    await buildUnsignedFlatPackage(config, staging, pkg, f.root, 1788566400);
    const expanded = path.join(f.root, "expanded");
    const result = spawnSync("/usr/sbin/pkgutil", ["--expand-full", pkg, expanded], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    await assertPayloadModes(config, path.join(expanded, "Payload"));
    const xml = await readFile(path.join(expanded, "PackageInfo"), "utf8");
    for (const bundle of config.payloadBundles) {
        assert.ok(xml.includes(`path="./${bundle.relativePath}"`));
        assert.equal(await readFile(path.join(expanded, "Payload", bundle.relativePath, "Contents/MacOS/EnhanceThat"), "utf8"), "fixture");
    }
});
