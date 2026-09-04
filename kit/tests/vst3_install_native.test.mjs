// Explicit native gate; the customer unit-test discovery rule excludes this filename.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { formatVST3InstallFailure, installVST3Bundle } from "../scripts/install_vst3.mjs";
import { hashInstalledPayload } from "../scripts/toolchain.mjs";

const exec = promisify(execFile);
const native = process.platform === "darwin";
let fixtures;
let identityProbe;

before(async () => {
    if (!native) return;
    fixtures = await mkdtemp(path.join(os.tmpdir(), "kit-vst3-factories-"));
    const source = path.join(import.meta.dirname, "native/vst3_install");
    await exec("cmake", ["-S", source, "-B", fixtures, "-DCMAKE_BUILD_TYPE=Release"], { timeout: 60000 });
    await exec("cmake", ["--build", fixtures, "--target", "native_install_fixtures", "--parallel", "2"], { timeout: 60000 });
    identityProbe = path.join(fixtures, "identity_probe/kit_vst3_identity_probe");
});

after(async () => {
    if (fixtures) await rm(fixtures, { recursive: true, force: true });
});

async function withInstallFixture(run) {
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-vst3-install-"));
    try {
        const installDirectory = path.join(root, "Plug-Ins/VST3");
        const destination = path.join(installDirectory, "FixtureTone.vst3");
        const candidate = path.join(root, "build/FixtureTone.vst3");
        await createBundle(candidate);
        return await run({ root, candidate, destination, installDirectory });
    } finally {
        // Some recovery tests exercise real macOS immutable-file failures.
        await exec("/usr/bin/chflags", ["-R", "nouchg", root]);
        await rm(root, { recursive: true, force: true });
    }
}

async function createBundle(bundle, { variant = 0, bundleIdentifier = "com.example.fixture-tone", payload = "new" } = {}) {
    await mkdir(path.join(bundle, "Contents/MacOS"), { recursive: true });
    await mkdir(path.join(bundle, "Contents/Resources"), { recursive: true });
    await cp(path.join(fixtures, `factories/factory_${variant}.so`), path.join(bundle, "Contents/MacOS/FixtureTone"));
    await writeFile(path.join(bundle, "Contents/Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>FixtureTone</string>
<key>CFBundleIdentifier</key><string>${bundleIdentifier}</string>
<key>CFBundlePackageType</key><string>BNDL</string>
</dict></plist>`);
    await writeFile(path.join(bundle, "Contents/Resources/payload.txt"), payload);
    // Deliberately stale and not strict JSON. The actual factory must win.
    await writeFile(path.join(bundle, "Contents/Resources/moduleinfo.json"), '{"Classes":[{"CID":"WRONG",}],}');
    await sign(bundle);
}

async function sign(bundle) {
    await exec("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", bundle]);
}

async function payload(bundle) {
    return readFile(path.join(bundle, "Contents/Resources/payload.txt"), "utf8");
}

test("the CLI failure rendering retains the exact manual recovery path", () => {
    assert.equal(formatVST3InstallFailure({ code: "recovery-required", message: "Rollback stopped.", recoveryDirectory: "/fixture/.Tone.vst3.install" }),
        "Rollback stopped.\nRetained recovery directory: /fixture/.Tone.vst3.install");
});

test("first install reads the actual factory, validates and installs the signed candidate", { skip: !native }, async () => {
    await withInstallFixture(async ({ candidate, destination, installDirectory }) => {
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "installed", JSON.stringify(result));
        assert.equal(result.identity.bundleIdentifier, "com.example.fixture-tone");
        assert.equal(result.identity.processorClassId, "01000000000000000000000000000001");
        assert.equal(result.identity.displayName, "Fixture Tone");
        assert.equal(await payload(destination), "new");
        assert.deepEqual(await readdir(installDirectory), ["FixtureTone.vst3"]);
        await exec("/usr/bin/codesign", ["--verify", "--deep", "--strict", destination]);
    });
});

test("same-identity updates replace the payload and retire the prior copy only after verification", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "installed", JSON.stringify(result));
        assert.equal(await payload(destination), "new");
        assert.equal(await payload(candidate), "new");
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

for (const collision of [
    { label: "different bundle identifier", options: { bundleIdentifier: "com.other.fixture-tone" } },
    { label: "different binary processor class identifier", options: { variant: 1 } },
]) {
    test(`same filename with ${collision.label} stops before any install mutation`, { skip: !native }, async () => {
        await withInstallFixture(async ({ root, candidate, destination }) => {
            await createBundle(destination, { payload: "old", ...collision.options });
            const original = await hashInstalledPayload(destination);
            const result = await installVST3Bundle({ candidate, destination, identityProbe });
            assert.equal(result.status, "failed");
            assert.equal(result.error.code, "identity-conflict");
            assert.equal(await hashInstalledPayload(destination), original);
            assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
        });
    });
}

for (const unreadable of [
    { label: "ambiguous processors", variant: 2 },
    { label: "unreadable factory class", variant: 3 },
    { label: "factory timeout", variant: 4 },
    { label: "factory process failure", variant: 5 },
    { label: "factory process death by signal", variant: 7 },
    { label: "no processor class", variant: 6 },
]) {
    test(`existing ${unreadable.label} is not replaced`, { skip: !native }, async () => {
        await withInstallFixture(async ({ root, candidate, destination }) => {
            await createBundle(destination, { payload: "old", variant: unreadable.variant });
            const original = await hashInstalledPayload(destination);
            const result = await installVST3Bundle({ candidate, destination, identityProbe, probeTimeoutMs: 500 });
            assert.equal(result.status, "failed");
            assert.equal(result.error.code, "unreadable-identity");
            assert.equal(await hashInstalledPayload(destination), original);
            assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
        });
    });
}

test("unreadable existing bundle metadata stops before a transaction is created", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        await writeFile(path.join(destination, "Contents/Info.plist"), "not a plist");
        const original = await hashInstalledPayload(destination);
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "unreadable-identity");
        assert.equal(await hashInstalledPayload(destination), original);
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

for (const side of ["candidate", "existing"]) {
    test(`invalid ${side} signature stops before replacement`, { skip: !native }, async () => {
        await withInstallFixture(async ({ root, candidate, destination }) => {
            await createBundle(destination, { payload: "old" });
            const bundle = side === "candidate" ? candidate : destination;
            await writeFile(path.join(bundle, "Contents/Resources/payload.txt"), "unsigned change");
            const original = await hashInstalledPayload(destination);
            const result = await installVST3Bundle({ candidate, destination, identityProbe });
            assert.equal(result.status, "failed");
            assert.equal(result.error.code, "signature");
            assert.equal(await hashInstalledPayload(destination), original);
            assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
        });
    });
}

test("a signed candidate without required markers stops before replacement", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, destination }) => {
        const candidate = path.join(root, "unpatched/FixtureTone.vst3");
        await createBundle(candidate, { variant: 8 });
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "markers");
        assert.equal(await hashInstalledPayload(destination), original);
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

test("a same-identity older build need not contain the replacement's current markers", { skip: !native }, async () => {
    await withInstallFixture(async ({ candidate, destination }) => {
        await createBundle(destination, { variant: 8, payload: "old" });
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "installed", JSON.stringify(result));
        assert.equal(await payload(destination), "new");
    });
});

test("a staged signature failure leaves the installed version unchanged", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const candidateDigest = await hashInstalledPayload(candidate);
        const codesign = path.join(root, "fixture-codesign.mjs");
        await writeFile(codesign, `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const bundle = args.at(-1);
if (bundle.endsWith('/candidate.vst3')) writeFileSync(bundle + '/Contents/Resources/payload.txt', 'damaged during staging');
const result = spawnSync('/usr/bin/codesign', args, { encoding: 'utf8' });
process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
`);
        await chmod(codesign, 0o755);
        const result = await installVST3Bundle({ candidate, destination, identityProbe, codesign });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "signature");
        assert.equal(await hashInstalledPayload(destination), original);
        assert.equal(await hashInstalledPayload(candidate), candidateDigest);
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

async function probeWithFailure(root, afterRealProbe, beforeRealProbe = "") {
    const wrapper = path.join(root, "fixture-probe.mjs");
    await writeFile(wrapper, `#!${process.execPath}
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, renameSync } from 'node:fs';
const args = process.argv.slice(2);
const bundle = args[0];
${beforeRealProbe}
const result = spawnSync(${JSON.stringify(identityProbe)}, args, { encoding: 'utf8' });
if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(result.status ?? 1); }
${afterRealProbe}
process.stdout.write(result.stdout);
`);
    await chmod(wrapper, 0o755);
    return wrapper;
}

test("a partial stage-copy failure leaves the prior version unchanged and removes the partial copy", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const protectedResource = path.join(candidate, "Contents/Resources/z-protected.txt");
        await writeFile(protectedResource, "copy cannot read this after preflight");
        await sign(candidate);
        const original = await hashInstalledPayload(destination);
        const faultingProbe = await probeWithFailure(root,
            `if (bundle === ${JSON.stringify(candidate)}) chmodSync(${JSON.stringify(protectedResource)}, 0);`);
        const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "filesystem");
        assert.match(result.error.message, /staging.*EACCES/su);
        assert.equal(await hashInstalledPayload(destination), original);
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

for (const existing of [true, false]) {
    test(`post-promotion factory failure ${existing ? "restores the old version" : "clears a failed first install"}`, { skip: !native }, async () => {
        await withInstallFixture(async ({ root, candidate, destination }) => {
            if (existing) await createBundle(destination, { payload: "old" });
            const original = existing ? await hashInstalledPayload(destination) : null;
            const faultingProbe = await probeWithFailure(root,
                `if (bundle === ${JSON.stringify(destination)} && readFileSync(bundle + '/Contents/Resources/payload.txt', 'utf8') === 'new') process.exit(42);`);
            const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingProbe });
            assert.equal(result.status, "failed");
            assert.equal(result.error.code, "unreadable-identity");
            if (existing) assert.equal(await hashInstalledPayload(destination), original);
            else await assert.rejects(access(destination), { code: "ENOENT" });
            assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
        });
    });
}

test("a failed promotion restores the old version and reports any unremovable staged remainder", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const candidateDigest = await hashInstalledPayload(candidate);
        const faultingProbe = await probeWithFailure(root,
            "if (bundle.endsWith('/candidate.vst3')) { const flag = spawnSync('/usr/bin/chflags', ['uchg', bundle]); if (flag.status !== 0) process.exit(43); }");
        const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "recovery-required");
        assert.match(result.error.message, /Exclusive bundle move failed: Operation not permitted/su);
        assert.equal(await hashInstalledPayload(destination), original);
        assert.equal(await hashInstalledPayload(candidate), candidateDigest);
        assert.equal(result.error.recoveryDirectory, path.join(root, "Plug-Ins/.FixtureTone.vst3.install"));
        // An immutable directory can lose removable children during cleanup.
        // Only the restored prior bundle and the original build are guaranteed.
        assert.equal((await lstat(path.join(result.error.recoveryDirectory, "candidate.vst3"))).isDirectory(), true);
        await assert.rejects(access(path.join(result.error.recoveryDirectory, "previous.bundle")), { code: "ENOENT" });
    });
});

test("failed rollback keeps the old version recoverable and a later install does not discard it", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const recovery = path.join(root, "Plug-Ins/.FixtureTone.vst3.install");
        const backup = path.join(recovery, "previous.bundle");
        const faultingProbe = await probeWithFailure(root,
            `if (bundle === ${JSON.stringify(destination)} && readFileSync(bundle + '/Contents/Resources/payload.txt', 'utf8') === 'new') {
                spawnSync('/usr/bin/chflags', ['uchg', ${JSON.stringify(backup)}]); process.exit(42);
            }`);
        const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "recovery-required");
        assert.equal(result.error.recoveryDirectory, recovery);
        assert.equal(await hashInstalledPayload(backup), original);
        assert.equal(await payload(path.join(recovery, "failed.bundle")), "new");
        await assert.rejects(access(destination), { code: "ENOENT" });
        const retained = await hashInstalledPayload(recovery);
        const retry = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(retry.status, "failed");
        assert.equal(retry.error.code, "pending-install");
        assert.equal(await hashInstalledPayload(recovery), retained);
    });
});

test("an existing install lock is preserved without touching the installed plugin", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const recovery = path.join(root, "Plug-Ins/.FixtureTone.vst3.install");
        await mkdir(recovery);
        await writeFile(path.join(recovery, "retain.txt"), "interrupted installation");
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "pending-install");
        assert.equal(await payload(destination), "old");
        assert.equal(await readFile(path.join(recovery, "retain.txt"), "utf8"), "interrupted installation");
    });
});

test("a linked installed bundle is not replaced and its referent is untouched", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination, installDirectory }) => {
        const actual = path.join(root, "another/FixtureTone.vst3");
        await createBundle(actual, { payload: "old" });
        const original = await hashInstalledPayload(actual);
        await mkdir(installDirectory, { recursive: true });
        await symlink(actual, destination);
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "unsafe-path");
        assert.equal((await lstat(destination)).isSymbolicLink(), true);
        assert.equal(await hashInstalledPayload(actual), original);
    });
});

test("a linked install directory cannot redirect installation elsewhere", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination, installDirectory }) => {
        const actual = path.join(root, "another");
        await mkdir(actual);
        await mkdir(path.dirname(installDirectory), { recursive: true });
        await symlink(actual, installDirectory);
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "unsafe-path");
        assert.deepEqual(await readdir(actual), []);
    });
});

test("an escaping resource symlink stops before install", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        const outside = path.join(root, "outside.txt");
        await writeFile(outside, "do not copy me");
        await symlink(outside, path.join(candidate, "Contents/Resources/escape.txt"));
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "unsafe-path");
        await assert.rejects(access(destination), { code: "ENOENT" });
        assert.equal(await readFile(outside, "utf8"), "do not copy me");
    });
});

test("contained relative resource links remain valid after staging and promotion", { skip: !native }, async () => {
    await withInstallFixture(async ({ candidate, destination }) => {
        await symlink("payload.txt", path.join(candidate, "Contents/Resources/alias.txt"));
        await sign(candidate);
        const result = await installVST3Bundle({ candidate, destination, identityProbe });
        assert.equal(result.status, "installed", JSON.stringify(result));
        assert.equal(await readlink(path.join(destination, "Contents/Resources/alias.txt")), "payload.txt");
        assert.equal(await readFile(path.join(destination, "Contents/Resources/alias.txt"), "utf8"), "new");
    });
});

test("dry run verifies identity without creating install directories", { skip: !native }, async () => {
    await withInstallFixture(async ({ candidate, destination, installDirectory }) => {
        const result = await installVST3Bundle({ candidate, destination, identityProbe, dryRun: true });
        assert.equal(result.status, "dry-run", JSON.stringify(result));
        assert.equal(result.identity.displayName, "Fixture Tone");
        await assert.rejects(access(installDirectory), { code: "ENOENT" });
    });
});

for (const capture of ["previous.bundle", "failed.bundle"]) {
    test(`a competing bundle captured during ${capture} is retained, never deleted`, { skip: !native }, async () => {
        await withInstallFixture(async ({ root, candidate, destination }) => {
            await createBundle(destination, { payload: "old" });
            const original = await hashInstalledPayload(destination);
            const contender = path.join(root, "contender/FixtureTone.vst3");
            await createBundle(contender, { variant: 1, payload: "competing plugin" });
            const competing = await hashInstalledPayload(contender);
            const displaced = path.join(root, "displaced-by-other-installer.bundle");
            const afterProbe = capture === "failed.bundle"
                ? `if (bundle === ${JSON.stringify(destination)} && readFileSync(bundle + '/Contents/Resources/payload.txt', 'utf8') === 'new') process.exit(42);`
                : "";
            const beforeMove = `if (args[0] === '--move-exclusive' && args[1] === ${JSON.stringify(destination)} && args[2].endsWith('/${capture}')) {
                renameSync(${JSON.stringify(destination)}, ${JSON.stringify(displaced)});
                renameSync(${JSON.stringify(contender)}, ${JSON.stringify(destination)});
            }`;
            const interleaved = await probeWithFailure(root, afterProbe, beforeMove);
            const result = await installVST3Bundle({ candidate, destination, identityProbe: interleaved });
            assert.equal(result.status, "failed");
            assert.equal(result.error.code, "recovery-required");
            assert.match(result.error.message, /unexpected bundle.*retained, not deleted/su);
            const recovery = result.error.recoveryDirectory;
            assert.equal(await hashInstalledPayload(path.join(recovery, capture)), competing);
            if (capture === "previous.bundle") {
                assert.equal(await hashInstalledPayload(displaced), original);
                assert.equal(await payload(path.join(recovery, "candidate.vst3")), "new");
            } else {
                assert.equal(await hashInstalledPayload(path.join(recovery, "previous.bundle")), original);
                assert.equal(await payload(displaced), "new");
            }
            await assert.rejects(access(destination), { code: "ENOENT" });
        });
    });
}

test("exclusive promotion does not overwrite a plugin that appears after backup", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const contender = path.join(root, "contender/FixtureTone.vst3");
        await createBundle(contender, { variant: 1, payload: "competing plugin" });
        const competing = await hashInstalledPayload(contender);
        const interleaved = await probeWithFailure(root, "",
            `if (args[0] === '--move-exclusive' && args[1].endsWith('/candidate.vst3')) renameSync(${JSON.stringify(contender)}, ${JSON.stringify(destination)});`);
        const result = await installVST3Bundle({ candidate, destination, identityProbe: interleaved });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "recovery-required");
        assert.equal(await hashInstalledPayload(destination), competing);
        assert.equal(await hashInstalledPayload(path.join(result.error.recoveryDirectory, "previous.bundle")), original);
    });
});

test("a lost native-move response is reconciled against the exact captured bundle", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const faultingTool = await probeWithFailure(root, "if (args[0] === '--move-exclusive') process.exit(47);");
        const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingTool });
        assert.equal(result.status, "installed", JSON.stringify(result));
        assert.equal(await payload(destination), "new");
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

test("rollback reconciles lost native-move responses without discarding the prior version", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const faultingTool = await probeWithFailure(root,
            `if (args[0] === '--move-exclusive') process.exit(47);
             if (bundle === ${JSON.stringify(destination)} && readFileSync(bundle + '/Contents/Resources/payload.txt', 'utf8') === 'new') process.exit(42);`);
        const result = await installVST3Bundle({ candidate, destination, identityProbe: faultingTool });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "unreadable-identity");
        assert.equal(await hashInstalledPayload(destination), original);
        assert.deepEqual(await readdir(path.join(root, "Plug-Ins")), ["VST3"]);
    });
});

test("exclusive rollback does not overwrite a plugin that appears before restoration", { skip: !native }, async () => {
    await withInstallFixture(async ({ root, candidate, destination }) => {
        await createBundle(destination, { payload: "old" });
        const original = await hashInstalledPayload(destination);
        const contender = path.join(root, "contender/FixtureTone.vst3");
        await createBundle(contender, { variant: 1, payload: "competing plugin" });
        const competing = await hashInstalledPayload(contender);
        const interleaved = await probeWithFailure(root,
            `if (bundle === ${JSON.stringify(destination)} && readFileSync(bundle + '/Contents/Resources/payload.txt', 'utf8') === 'new') process.exit(42);`,
            `if (args[0] === '--move-exclusive' && args[1].endsWith('/previous.bundle')) renameSync(${JSON.stringify(contender)}, ${JSON.stringify(destination)});`);
        const result = await installVST3Bundle({ candidate, destination, identityProbe: interleaved });
        assert.equal(result.status, "failed");
        assert.equal(result.error.code, "recovery-required");
        assert.equal(await hashInstalledPayload(destination), competing);
        assert.equal(await hashInstalledPayload(path.join(result.error.recoveryDirectory, "previous.bundle")), original);
        assert.equal(await payload(path.join(result.error.recoveryDirectory, "failed.bundle")), "new");
    });
});
