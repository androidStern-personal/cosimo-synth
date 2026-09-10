// Packaging-only repair: retain the exact signed plugin payload of a pinned release ZIP.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimEnhanceThatOutput, selectEnhanceThatSigningIdentities } from "./build_enhance_that_release.mjs";
import { renderEnhanceThatPreinstall, renderEnhanceThatPostinstall, renderEnhanceThatReadme } from "./enhance-that-installer.mjs";
import { assertArchiveTreeContainsOnlyFilesAndDirectories, buildUnsignedFlatPackage,
    canonicalPayloadFingerprint, createDeterministicZip, getReleaseGitState,
    assertSourceStateUnchanged, notarizeStapleAndAssess, payloadInventoryErrors, signInstaller,
} from "./build_seqfx_beta_release.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function run(command, args) {
    const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`${command}: ${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
}

export async function main([input, expectedSha256, version]) {
    assert.ok(input && /^[a-f0-9]{64}$/u.test(expectedSha256 ?? "") && /^\d+\.\d+\.\d+$/u.test(version ?? ""),
        "Usage: node scripts/repackage_enhance_that_release.mjs ZIP SHA256 NEW_VERSION");
    assert.equal(hash(await readFile(input)), expectedSha256, "Input release checksum differs");
    const source = getReleaseGitState();
    assert.equal(source.worktreeStatus, "", "Commit the packaging repair before releasing");
    assert.ok(process.env.COSIMO_NOTARY_PROFILE, "Set the existing COSIMO_NOTARY_PROFILE");
    const signing = selectEnhanceThatSigningIdentities(run("/usr/bin/security", ["find-identity", "-v"]));
    const output = path.join(repoRoot, "release/enhance-that", version, "release");
    await claimEnhanceThatOutput(output);
    const work = path.join(output, "_work");
    await mkdir(work);
    const entries = run("/usr/bin/unzip", ["-Z1", input]).split("\n");
    assert.ok(entries.every(entry => /^EnhanceThat-\d+\.\d+\.\d+-macOS\//u.test(entry)
        && !entry.split("/").includes("..") && !entry.includes("\\")), "Unsafe input ZIP path");
    run("/usr/bin/ditto", ["-x", "-k", input, work]);
    const originalRoot = path.join(work, entries[0].split("/")[0]);
    const original = JSON.parse(await readFile(path.join(originalRoot, "release-manifest.json"), "utf8"));
    assert.notEqual(version, original.releaseVersion, "Use a new immutable installer version");
    const oldPackage = path.join(originalRoot, `EnhanceThat-${original.releaseVersion}-macOS.pkg`);
    assert.equal(hash(await readFile(oldPackage)), original.packageSha256);
    run("/usr/sbin/pkgutil", ["--check-signature", oldPackage]);
    run("/usr/sbin/spctl", ["-a", "-t", "install", oldPackage]);
    const expanded = path.join(work, "original");
    run("/usr/sbin/pkgutil", ["--expand-full", oldPackage, expanded]);
    const payload = path.join(expanded, "Payload");
    await assertArchiveTreeContainsOnlyFilesAndDirectories(payload);
    const includeAU = original.formats.AU === "included";
    const config = {
        releaseVersion: version,
        identity: { bundleName: "EnhanceThat", patchId: "dev.cosimo.enhancer-lite",
            installerIdentifier: "dev.cosimo.enhancer-lite.pkg", pluginVersion: original.pluginVersion },
        payloadBundles: [
            { format: "VST3", relativePath: "Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3" },
            ...(includeAU ? [{ format: "AU", relativePath: "Library/Audio/Plug-Ins/Components/EnhanceThat.component" }] : []),
        ],
    };
    for (const bundle of config.payloadBundles) {
        run("/usr/bin/codesign", ["--verify", "--deep", "--strict",
            `-R=anchor apple generic and identifier "dev.cosimo.enhancer-lite" and certificate leaf[subject.OU] = "${signing.application.teamIdentifier}"`,
            path.join(payload, bundle.relativePath)]);
    }
    const fingerprint = await canonicalPayloadFingerprint(payload);
    const scripts = path.join(work, "scripts");
    await mkdir(scripts, { mode: 0o755 });
    const hooks = { preinstall: renderEnhanceThatPreinstall({ includeAU }), postinstall: renderEnhanceThatPostinstall({ includeAU }) };
    for (const [name, script] of Object.entries(hooks)) await writeFile(path.join(scripts, name), script, { mode: 0o755 });
    const epoch = Number(run("/usr/bin/git", ["show", "-s", "--format=%ct", "HEAD"]));
    const name = `EnhanceThat-${version}-macOS`;
    const unsigned = path.join(work, "unsigned.pkg");
    await buildUnsignedFlatPackage(config, payload, unsigned, work, epoch, { scriptsRoot: scripts, packageVersion: version });
    const pkg = path.join(output, `${name}.pkg`);
    const installer = signInstaller(unsigned, pkg, signing.installer);
    console.log("Installer signed; submitting to Apple notarization.");
    const notarization = notarizeStapleAndAssess(pkg);
    const checked = path.join(work, "verified");
    run("/usr/sbin/pkgutil", ["--expand-full", pkg, checked]);
    assert.deepEqual(await canonicalPayloadFingerprint(path.join(checked, "Payload")), fingerprint, "Plugin payload changed");
    assert.deepEqual(payloadInventoryErrors(config, run("/usr/sbin/pkgutil", ["--payload-files", pkg]).split("\n"), { signed: true }), []);
    assert.deepEqual((await readdir(path.join(checked, "Scripts"))).sort(), ["postinstall", "preinstall"]);
    for (const [hook, script] of Object.entries(hooks)) assert.equal(await readFile(path.join(checked, "Scripts", hook), "utf8"), script);
    const manifest = { ...original, releaseVersion: version, packagingSourceCommit: source.commit,
        repackagedFrom: { zipSha256: expectedSha256, releaseVersion: original.releaseVersion, packageSha256: original.packageSha256 },
        pluginPayloadUnchanged: true, packageSha256: hash(await readFile(pkg)),
        preinstallSha256: hash(hooks.preinstall), postinstallSha256: hash(hooks.postinstall),
        signing: { ...original.signing, installer }, notarization, sourceDateEpoch: epoch };
    await writeFile(path.join(output, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(path.join(output, "README.txt"), renderEnhanceThatReadme(config));
    await writeFile(path.join(output, "THIRD_PARTY_NOTICES.txt"), await readFile(path.join(originalRoot, "THIRD_PARTY_NOTICES.txt")));
    const items = [`${name}.pkg`, "README.txt", "THIRD_PARTY_NOTICES.txt", "release-manifest.json"];
    await writeFile(path.join(output, "checksums.txt"), (await Promise.all(items.map(async file => `${hash(await readFile(path.join(output, file)))}  ${file}`))).join("\n") + "\n");
    const zipParent = path.join(work, "zip");
    await mkdir(path.join(zipParent, name), { recursive: true });
    for (const file of [...items, "checksums.txt"]) await writeFile(path.join(zipParent, name, file), await readFile(path.join(output, file)));
    const zip = path.join(output, `${name}.zip`);
    await createDeterministicZip(zipParent, name, zip, epoch);
    run("/usr/bin/unzip", ["-t", zip]);
    assertSourceStateUnchanged(source, getReleaseGitState());
    console.log(JSON.stringify({ zip, sha256: hash(await readFile(zip)), pluginPayloadUnchanged: true, notarization }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
