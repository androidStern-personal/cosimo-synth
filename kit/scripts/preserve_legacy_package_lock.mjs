// One-time bridge for an installed Builder Kit release whose installer created
// an untracked package-lock.json. The reviewed target release must supply this
// standalone file outside the old checkout; it has no private-feed dependency.

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const legacyStatus = "?? package-lock.json";

function executeGit(root, args, execute) {
    return execute("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}

function gitOutput(root, args, execute, label) {
    const result = executeGit(root, args, execute);
    if (result.error || result.status !== 0) throw new Error(`${label} failed; no source file was changed.`);
    return (result.stdout ?? "").trim();
}

function gitSucceeds(root, args, execute) {
    const result = executeGit(root, args, execute);
    if (result.error) throw new Error("Git inspection failed; no source file was changed.");
    return result.status === 0;
}

async function requireLocalFile(file, label) {
    let metadata;
    try {
        metadata = await lstat(file);
    } catch (error) {
        if (error.code === "ENOENT") throw new Error(`${label} is missing; no source file was changed.`);
        throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
        throw new Error(`${label} is linked or has an unexpected type; it was preserved.`);
    return metadata;
}

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

export async function dependencyFingerprint(root) {
    const hash = createHash("sha256");
    for (const name of ["package.json", "package-lock.json"]) {
        hash.update(name);
        try { hash.update(await readFile(path.join(root, name))); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return hash.digest("hex");
}

function sameFile(before, after) {
    return before.dev === after.dev && before.ino === after.ino
        && before.size === after.size && before.mode === after.mode;
}

async function restoreOriginal(packageLockPath, bytes, mode) {
    try {
        await writeFile(packageLockPath, bytes, { flag: "wx", mode });
        if (!bytes.equals(await readFile(packageLockPath)))
            throw new Error("Restored package-lock.json did not verify; its original bytes remain in installer preservation state.");
        return true;
    } catch (error) {
        if (error.code === "EEXIST") return false;
        throw error;
    }
}

/**
 * Preserve only the exact installer-produced lock named by npm-ready. Any
 * other dirty path, altered lock, link, or unexpected receipt is untouched.
 */
export async function preserveLegacyPackageLock({
    root: requestedRoot,
    execute = spawnSync,
    log = console.log,
} = {}) {
    if (typeof requestedRoot !== "string" || !path.isAbsolute(requestedRoot))
        throw new Error("Pass the absolute Builder Kit project folder with --root.");

    const root = await realpath(requestedRoot);
    const repositoryRoot = await realpath(gitOutput(root, ["rev-parse", "--show-toplevel"], execute, "Repository check"));
    if (repositoryRoot !== root)
        throw new Error("The selected folder is not the root of this Builder Kit repository; no source file was changed.");

    const initialStatus = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"], execute, "Working tree check");
    if (initialStatus !== legacyStatus)
        throw new Error("The bridge requires package-lock.json to be the only uncommitted path; every existing file was preserved.");
    if (!gitSucceeds(root, ["ls-files", "--error-unmatch", "--", "package.json"], execute)
        || gitSucceeds(root, ["ls-files", "--error-unmatch", "--", "package-lock.json"], execute))
        throw new Error("The checkout does not have the expected legacy package baseline; every existing file was preserved.");

    const packagePath = path.join(root, "package.json");
    const packageLockPath = path.join(root, "package-lock.json");
    const statePath = path.join(root, ".builder-kit-install");
    const npmReceiptPath = path.join(statePath, "npm-ready");
    const installReceiptPath = path.join(statePath, "receipt");
    await requireLocalFile(packagePath, "package.json");
    const packageLockMetadata = await requireLocalFile(packageLockPath, "package-lock.json");
    const stateMetadata = await lstat(statePath);
    if (!stateMetadata.isDirectory() || stateMetadata.isSymbolicLink())
        throw new Error("The installer state directory is linked or has an unexpected type; every existing file was preserved.");
    await requireLocalFile(npmReceiptPath, "The dependency receipt");
    await requireLocalFile(installReceiptPath, "The installation receipt");

    const installReceipt = (await readFile(installReceiptPath, "utf8")).trim();
    const releaseCommit = /^builder-kit-install-v1 ([0-9a-f]{40})$/u.exec(installReceipt)?.[1];
    if (!releaseCommit || !gitSucceeds(root, ["merge-base", "--is-ancestor", releaseCommit, "HEAD"], execute))
        throw new Error("The installation receipt does not identify this checkout's history; every existing file was preserved.");

    const expectedFingerprint = (await readFile(npmReceiptPath, "utf8")).trim();
    if (!/^[0-9a-f]{64}$/u.test(expectedFingerprint)
        || expectedFingerprint !== await dependencyFingerprint(root))
        throw new Error("package-lock.json does not match the completed installer receipt; every existing file was preserved.");

    const bytes = await readFile(packageLockPath);
    const digest = sha256(bytes);
    const preservedDirectory = path.join(statePath, "update-preserved");
    const preservedRelative = `.builder-kit-install/update-preserved/package-lock.${digest}.json`;
    const preservedPath = path.join(root, preservedRelative);
    if (!gitSucceeds(root, ["check-ignore", "--quiet", "--no-index", "--", preservedRelative], execute))
        throw new Error("The installer preservation path is not excluded from source status; every existing file was preserved.");

    try { await mkdir(preservedDirectory, { mode: 0o700 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const preservedDirectoryMetadata = await lstat(preservedDirectory);
    if (!preservedDirectoryMetadata.isDirectory() || preservedDirectoryMetadata.isSymbolicLink())
        throw new Error("The installer preservation directory is linked or has an unexpected type; package-lock.json was preserved.");

    try {
        await writeFile(preservedPath, bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        await requireLocalFile(preservedPath, "The existing preserved lock");
        if (!bytes.equals(await readFile(preservedPath)))
            throw new Error("The no-overwrite preservation path contains different bytes; package-lock.json was preserved.");
    }

    const beforeRemovalStatus = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"], execute, "Pre-move working tree check");
    const currentMetadata = await requireLocalFile(packageLockPath, "package-lock.json");
    const currentBytes = await readFile(packageLockPath);
    if (beforeRemovalStatus !== legacyStatus || !sameFile(packageLockMetadata, currentMetadata) || !bytes.equals(currentBytes))
        throw new Error(`The checkout changed during inspection; package-lock.json remains in place and its verified copy is at ${preservedRelative}.`);

    await unlink(packageLockPath);
    let finalStatus;
    try {
        finalStatus = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all"], execute, "Final working tree check");
    } catch {
        const restored = await restoreOriginal(packageLockPath, bytes, packageLockMetadata.mode & 0o777);
        const location = restored ? "package-lock.json was restored" : `its original bytes remain at ${preservedRelative}`;
        throw new Error(`The final working tree check failed; ${location}, and every other existing path was preserved.`);
    }
    if (finalStatus !== "") {
        const restored = await restoreOriginal(packageLockPath, bytes, packageLockMetadata.mode & 0o777);
        const location = restored ? "package-lock.json was restored" : `its original bytes remain at ${preservedRelative}`;
        throw new Error(`The checkout changed before the bridge completed; ${location}, and every other existing path was preserved.`);
    }

    log(`Preserved the receipt-matched installer lock at ${preservedRelative}.`);
    return { digest, preservedRelative };
}

function parseRoot(argv) {
    if (argv.length !== 2 || argv[0] !== "--root" || !path.isAbsolute(argv[1]))
        throw new Error("Usage: node preserve_legacy_package_lock.mjs --root <absolute Builder Kit project folder>");
    return argv[1];
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        await preserveLegacyPackageLock({ root: parseRoot(process.argv.slice(2)) });
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Legacy package-lock preservation failed.");
        process.exitCode = 1;
    }
}
