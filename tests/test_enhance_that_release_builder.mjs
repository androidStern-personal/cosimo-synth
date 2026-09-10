import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderEnhanceThatPreinstall, renderEnhanceThatPostinstall, renderEnhanceThatReadme } from "../scripts/enhance-that-installer.mjs";
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


async function bundleFixture(bundle, id = "dev.cosimo.enhancer-lite") {
    await mkdir(path.join(bundle, "Contents"), { recursive: true });
    await writeFile(path.join(bundle, "Contents/Info.plist"),
        `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string></dict></plist>`);
    await writeFile(path.join(bundle, "sentinel"), "original bytes");
}

async function postinstall(f, includeAU = false) {
    await writeFile(f.script, renderEnhanceThatPostinstall({ includeAU }, f.options));
    return spawnSync("/bin/sh", [f.script, "test.pkg", "/", "/"], { encoding: "utf8" });
}

for (const includeAU of [false, true]) {
    test(`normal upgrade accepts current and legacy copies; removes only matching duplicates after payload (AU=${includeAU})`, async context => {
        const f = await fixture(context);
        const formats = [["VST3", "vst3", f.systemRoot],
            ...(includeAU ? [["Components", "component", path.join(path.dirname(f.systemRoot), "Components")]] : [])];
        const duplicates = [];
        for (const [scan, ext, system] of formats) {
            await bundleFixture(path.join(system, `EnhanceThat.${ext}`));
            for (const name of ["EnhanceThat", "CosimoEnhancerLite"]) {
                const user = path.join(f.home, "Library/Audio/Plug-Ins", scan, `${name}.${ext}`);
                await bundleFixture(user); duplicates.push(user);
            }
            const legacy = path.join(system, `CosimoEnhancerLite.${ext}`);
            await bundleFixture(legacy); duplicates.push(legacy);
            await bundleFixture(path.join(system, `OtherPlugin.${ext}`), "other.product");
        }
        const before = await f.run({ includeAU });
        assert.equal(before.status, 0, before.stderr);
        for (const bundle of duplicates)
            assert.equal(await readFile(path.join(bundle, "sentinel"), "utf8"), "original bytes");
        const result = await postinstall(f, includeAU);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout + result.stderr, "");
        for (const bundle of duplicates) await assert.rejects(stat(bundle), { code: "ENOENT" });
        for (const [, ext, system] of formats) {
            assert.equal(await readFile(path.join(system, `EnhanceThat.${ext}/sentinel`), "utf8"), "original bytes");
            assert.equal(await readFile(path.join(system, `OtherPlugin.${ext}/sentinel`), "utf8"), "original bytes");
            assert.deepEqual((await readdir(system)).sort(), [`EnhanceThat.${ext}`, `OtherPlugin.${ext}`]);
        }
        assert.equal((await readdir(path.dirname(f.systemRoot))).some(name => name.includes("previous")), false);
        assert.equal((await postinstall(f, includeAU)).status, 0, "repeat install is idempotent");
    });
}

test("failed/missing system payload never removes the old user copy", async context => {
    const f = await fixture(context);
    const user = path.join(f.home, "Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3");
    await bundleFixture(user);
    assert.notEqual((await postinstall(f)).status, 0);
    assert.equal(await readFile(path.join(user, "sentinel"), "utf8"), "original bytes");
});

test("duplicate cleanup preserves different product IDs and never follows symlinked homes or bundles", async context => {
    const f = await fixture(context);
    await bundleFixture(path.join(f.systemRoot, "EnhanceThat.vst3"));
    const userRoot = path.join(f.home, "Library/Audio/Plug-Ins/VST3");
    await bundleFixture(path.join(userRoot, "EnhanceThat.vst3"), "customer.different-plugin");
    const outside = path.join(f.root, "outside.vst3");
    await bundleFixture(outside);
    await symlink(outside, path.join(userRoot, "CosimoEnhancerLite.vst3"));
    assert.equal((await postinstall(f)).status, 0);
    assert.equal(await readFile(path.join(outside, "sentinel"), "utf8"), "original bytes");
    assert.equal(await readFile(path.join(userRoot, "EnhanceThat.vst3/sentinel"), "utf8"), "original bytes");
    const linkedHome = path.join(f.root, "linked-home");
    await symlink(f.home, linkedHome);
    await writeFile(f.script, renderEnhanceThatPostinstall({}, { ...f.options, homeDirectories: [linkedHome] }));
    assert.equal(spawnSync("/bin/sh", [f.script]).status, 0);
    assert.equal(await readFile(path.join(outside, "sentinel"), "utf8"), "original bytes");
});

test("preflight rejects a linked system scan ancestor and alternate target volume", async context => {
    const f = await fixture(context);
    assert.equal((await f.run({ volume: "/Volumes/Other" })).status, 1);
    const linked = path.join(f.root, "LinkedSystem");
    await symlink(path.join(f.root, "System"), linked);
    await writeFile(f.script, renderEnhanceThatPreinstall({}, { ...f.options,
        systemRoot: path.join(linked, "Library/Audio/Plug-Ins/VST3") }));
    assert.equal(spawnSync("/bin/sh", [f.script]).status, 1);
});

test("installer roots reject shell injection, traversal, and broad roots", () => {
    for (const systemRoot of ["/tmp/scan\nother", "/", "/tmp/../Users"])
        assert.throws(() => renderEnhanceThatPreinstall({}, { systemRoot }), /normalized absolute single-line/u);
});

test("customer README contains installation steps, not internal release or recovery notes", () => {
    const text = renderEnhanceThatReadme({ releaseVersion: "0.1.5", payloadBundles: [
        { relativePath: "Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3" },
    ] });
    assert.match(text, /Quit your DAW/u);
    assert.match(text, /Open the installer package/u);
    assert.doesNotMatch(text, /candidate|qualification|retained|RECOVERY|unpublished|signing identity/iu);
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
    const xml = renderPackageInfo(config, [], { packageVersion: "0.1.3", preinstall: true, postinstall: true });
    assert.match(xml, /postinstall-action="none" version="0\.1\.3"/u);
    assert.match(xml, /CFBundleVersion="0\.1\.0"/u);
    assert.match(xml, /<preinstall file="\.\/preinstall"\/>/u);
    assert.match(xml, /<postinstall file="\.\/postinstall"\/>/u);
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
    test(`AU preflight accepts ${location} without changing bytes before payload replacement`, async context => {
        const f = await fixture(context);
        const base = location.startsWith("user") ? path.join(f.home, "Library/Audio/Plug-Ins/Components")
            : path.join(path.dirname(f.systemRoot), "Components");
        const bundle = path.join(base, location.endsWith("new") ? "EnhanceThat.component" : "CosimoEnhancerLite.component");
        await mkdir(bundle, { recursive: true });
        await writeFile(path.join(bundle, "sentinel"), "preserve original AU");
        const result = await f.run({ includeAU: true });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, "");
        assert.equal(await readFile(path.join(bundle, "sentinel"), "utf8"), "preserve original AU");
        assert.equal((await readdir(path.dirname(f.systemRoot))).some(name => name.includes("previous")), false);
    });
}

test("VST3-only installer never removes an existing AU", async context => {
    const f = await fixture(context);
    await bundleFixture(path.join(f.systemRoot, "EnhanceThat.vst3"));
    const au = path.join(f.home, "Library/Audio/Plug-Ins/Components/EnhanceThat.component");
    await bundleFixture(au);
    assert.equal((await postinstall(f)).status, 0);
    assert.equal(await readFile(path.join(au, "sentinel"), "utf8"), "original bytes");
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
    const scriptsRoot = path.join(f.root, "scripts");
    await mkdir(scriptsRoot, { mode: 0o755 });
    const hooks = { preinstall: renderEnhanceThatPreinstall({ includeAU: true }), postinstall: renderEnhanceThatPostinstall({ includeAU: true }) };
    for (const [name, script] of Object.entries(hooks))
        await writeFile(path.join(scriptsRoot, name), script, { mode: 0o755 });
    await buildUnsignedFlatPackage(config, staging, pkg, f.root, 1788566400, { scriptsRoot });
    const expanded = path.join(f.root, "expanded");
    const result = spawnSync("/usr/sbin/pkgutil", ["--expand-full", pkg, expanded], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    await assertPayloadModes(config, path.join(expanded, "Payload"));
    const xml = await readFile(path.join(expanded, "PackageInfo"), "utf8");
    for (const [name, script] of Object.entries(hooks)) {
        assert.ok(xml.includes(`<${name} file="./${name}"/>`));
        assert.equal(await readFile(path.join(expanded, "Scripts", name), "utf8"), script);
        assert.equal((await stat(path.join(expanded, "Scripts", name))).mode & 0o777, 0o755);
    }
    for (const bundle of config.payloadBundles) {
        assert.ok(xml.includes(`path="./${bundle.relativePath}"`));
        assert.equal(await readFile(path.join(expanded, "Payload", bundle.relativePath, "Contents/MacOS/EnhanceThat"), "utf8"), "fixture");
    }
});
