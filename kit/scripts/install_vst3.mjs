/** Identity-safe, recoverable installation of one already-built macOS VST3. */
import { execFile } from "node:child_process";
import { cp, lstat, mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { findChocMarkerViolations } from "./check_choc_markers.mjs";
import { hashInstalledPayload } from "./toolchain.mjs";

const executeFile = promisify(execFile);

/** @typedef {{bundleIdentifier: string, processorClassId: string, displayName: string}} VST3Identity */
/** @typedef {"platform" | "unsafe-path" | "unreadable-identity" | "signature" | "markers" | "identity-conflict" | "candidate-changed" | "installed-changed" | "pending-install" | "recovery-required" | "filesystem" | "tool-failed" | "unexpected-capture" | "move-failed"} InstallFailureCode */
/** @typedef {{code: InstallFailureCode, message: string, recoveryDirectory?: string}} InstallFailure */
/** @typedef {{status: "failed", error: InstallFailure}} FailedInstall */
/** @typedef {{status: "verified", identity: VST3Identity, digest: string, entry: {dev: number, ino: number}}} VerifiedBundle */
/** @typedef {{identityProbe: string, codesign?: string, probeTimeoutMs?: number}} BundleTools */
/** @typedef {FailedInstall | {status: "installed", destination: string, identity: VST3Identity, recoveryDirectory?: string} | {status: "dry-run", destination: string, identity: VST3Identity}} InstallResult */

/**
 * Render an install failure for the CLI, including any retained recovery path.
 * @param {InstallFailure} failure
 */
export function formatVST3InstallFailure(failure) {
    return failure.recoveryDirectory
        ? `${failure.message}\nRetained recovery directory: ${failure.recoveryDirectory}`
        : failure.message;
}

/** @param {InstallFailureCode} code @param {string} message @param {string} [recoveryDirectory] @returns {FailedInstall} */
function failed(code, message, recoveryDirectory) {
    return { status: "failed", error: { code, message, ...(recoveryDirectory ? { recoveryDirectory } : {}) } };
}

function describe(error) {
    return error instanceof Error ? error.message : String(error);
}

async function maybeEntry(filePath) {
    try {
        return await lstat(filePath);
    } catch (error) {
        if (error !== null && typeof error === "object" && error.code === "ENOENT") return null;
        throw error;
    }
}

function contained(root, target) {
    const relative = path.relative(root, target);
    return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function checkBundleTree(bundle, executable) {
    const root = await realpath(bundle);
    const identityPaths = new Set(["Contents", "Contents/Info.plist", "Contents/MacOS", `Contents/MacOS/${executable}`]);
    async function visit(filePath, relative) {
        const entry = await lstat(filePath);
        if (entry.isSymbolicLink()) {
            if (identityPaths.has(relative) || !contained(root, await realpath(filePath)))
                return `Linked identity path or escaping symbolic link: ${filePath}`;
            return null;
        }
        if (!entry.isFile() && !entry.isDirectory()) return `Unsupported bundle entry: ${filePath}`;
        if (entry.isDirectory()) {
            for (const name of await readdir(filePath)) {
                const problem = await visit(path.join(filePath, name), relative ? `${relative}/${name}` : name);
                if (problem !== null) return problem;
            }
        }
        return null;
    }
    return visit(bundle, "");
}

async function runTool(executable, args, timeout) {
    try {
        const { stdout } = await executeFile(executable, args, {
            encoding: "utf8", timeout, killSignal: "SIGKILL", maxBuffer: 1024 * 1024,
        });
        return { status: "ok", stdout };
    } catch (error) {
        return failed("tool-failed", `${path.basename(executable)} failed or timed out: ${describe(error)}`);
    }
}

function parseBundleInfo(text) {
    let info;
    try { info = JSON.parse(text); } catch { return failed("unreadable-identity", "Info.plist is not readable."); }
    if (info === null || typeof info !== "object" || Array.isArray(info)
        || typeof info.CFBundleIdentifier !== "string" || !/^[A-Za-z0-9][A-Za-z0-9.-]+$/u.test(info.CFBundleIdentifier)
        || typeof info.CFBundleExecutable !== "string" || info.CFBundleExecutable === ""
        || info.CFBundleExecutable === "." || info.CFBundleExecutable === ".."
        || /[/\\\u0000-\u001f]/u.test(info.CFBundleExecutable)) {
        return failed("unreadable-identity", "Info.plist must contain a readable bundle identifier and a contained executable name.");
    }
    return { status: "ok", bundleIdentifier: info.CFBundleIdentifier, executable: info.CFBundleExecutable };
}

function parseProbe(text) {
    let value;
    try { value = JSON.parse(text); } catch { return failed("unreadable-identity", "The binary identity probe did not return readable identity."); }
    if (value === null || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1
        || typeof value.bundleIdentifier !== "string" || value.bundleIdentifier === ""
        || typeof value.processorClassId !== "string" || !/^[0-9A-F]{32}$/u.test(value.processorClassId)
        || /^0+$/u.test(value.processorClassId)
        || typeof value.displayName !== "string" || value.displayName === ""
        || typeof value.binaryPath !== "string" || !path.isAbsolute(value.binaryPath)) {
        return failed("unreadable-identity", "The binary identity probe returned an invalid bundle or processor identity.");
    }
    return {
        status: "ok", binaryPath: value.binaryPath,
        identity: { bundleIdentifier: value.bundleIdentifier, processorClassId: value.processorClassId, displayName: value.displayName },
    };
}

/**
 * Verify and inspect the actual factory in a bounded child process. Existing
 * plugins need readable identity/signatures, but need not have today's markers.
 * @param {string} bundle
 * @param {BundleTools & {purpose?: "existing" | "replacement"}} options
 * @returns {Promise<VerifiedBundle | FailedInstall>}
 */
export async function inspectVST3Bundle(bundle, {
    identityProbe, codesign = "/usr/bin/codesign", probeTimeoutMs = 15000, purpose = "replacement",
}) {
    try {
        const entry = await lstat(bundle);
        if (!entry.isDirectory() || entry.isSymbolicLink())
            return failed("unsafe-path", `The VST3 bundle must be a directory, not a symbolic link: ${bundle}`);
        for (const part of ["Contents", "Contents/Info.plist", "Contents/MacOS"]) {
            if ((await lstat(path.join(bundle, part))).isSymbolicLink())
                return failed("unsafe-path", `Linked bundle identity path: ${path.join(bundle, part)}`);
        }
        const plist = await runTool("/usr/bin/plutil", ["-convert", "json", "-o", "-", path.join(bundle, "Contents/Info.plist")], 15000);
        if (plist.status === "failed") return failed("unreadable-identity", `Cannot read bundle metadata for ${bundle}: ${plist.error.message}`);
        const info = parseBundleInfo(plist.stdout);
        if (info.status === "failed") return info;
        const treeProblem = await checkBundleTree(bundle, info.executable);
        if (treeProblem !== null) return failed("unsafe-path", treeProblem);
        const binaryPath = path.join(bundle, "Contents/MacOS", info.executable);
        if (!(await lstat(binaryPath)).isFile()) return failed("unreadable-identity", `Missing bundle executable: ${binaryPath}`);
        if (purpose === "replacement") {
            const markers = findChocMarkerViolations(await readFile(binaryPath));
            if (markers.missing.length > 0 || markers.forbidden.length > 0)
                return failed("markers", `Replacement is missing required patched WebView features or contains obsolete probe markers: ${binaryPath}`);
        }
        const digest = await hashInstalledPayload(bundle);
        const signature = await runTool(codesign, ["--verify", "--deep", "--strict", bundle], 15000);
        if (signature.status === "failed") return failed("signature", `Invalid bundle signature for ${bundle}: ${signature.error.message}`);
        const probe = await runTool(identityProbe, [bundle], probeTimeoutMs);
        if (probe.status === "failed") return failed("unreadable-identity", `Cannot read the actual VST3 factory in ${bundle}: ${probe.error.message}`);
        const parsed = parseProbe(probe.stdout);
        if (parsed.status === "failed") return parsed;
        if (parsed.identity.bundleIdentifier !== info.bundleIdentifier || await realpath(parsed.binaryPath) !== await realpath(binaryPath))
            return failed("unreadable-identity", `The loaded factory does not match the bundle metadata in ${bundle}.`);
        return { status: "verified", identity: parsed.identity, digest, entry: { dev: entry.dev, ino: entry.ino } };
    } catch (error) {
        return failed("unreadable-identity", `Cannot inspect ${bundle}: ${describe(error)}`);
    }
}

function sameIdentity(left, right) {
    return left.bundleIdentifier === right.bundleIdentifier && left.processorClassId === right.processorClassId;
}

async function sameEntry(filePath, expected) {
    const entry = await maybeEntry(filePath);
    return entry !== null && !entry.isSymbolicLink() && entry.dev === expected.dev && entry.ino === expected.ino;
}

async function samePayload(filePath, expected) {
    return await sameEntry(filePath, expected.entry) && await hashInstalledPayload(filePath) === expected.digest;
}

async function captureMove(source, destination, expected, identityProbe) {
    const moved = await runTool(identityProbe, ["--move-exclusive", source, destination], 15000);
    // A process can fail after the syscall succeeded. Reconcile the actual
    // captured path before deciding whether compensation/cleanup is safe.
    try {
        if (await maybeEntry(destination) !== null) {
            if (await samePayload(destination, expected)) return { status: "captured" };
            return failed("unexpected-capture", `An unexpected bundle was captured or appeared at ${destination}. It was retained, not deleted.`);
        }
        if (moved.status === "failed" && await samePayload(source, expected))
            return failed("move-failed", moved.error.message);
        return failed("unexpected-capture", `The bundle move from ${source} to ${destination} could not be reconciled. Retained files must be inspected.`);
    } catch (error) {
        return failed("unexpected-capture", `Could not verify the bundle captured at ${destination}: ${describe(error)}. Retained files were not deleted.`);
    }
}

/**
 * Install one already-signed native build. A non-scan transaction directory
 * retains the old bundle through post-promotion verification and doubles as an
 * exclusive lock. An interrupted/failed rollback is never silently discarded.
 * @param {BundleTools & {candidate: string, destination: string, dryRun?: boolean}} options
 * @returns {Promise<InstallResult>} Includes a recovery directory when needed.
 */
export async function installVST3Bundle({ candidate, destination, identityProbe, dryRun = false,
    codesign = "/usr/bin/codesign", probeTimeoutMs = 15000 }) {
    const tools = { identityProbe, codesign, probeTimeoutMs };
    let transactionDirectory;
    let previous;
    let previousInspection;
    let promotedInspection;
    let phase = "preflight";
    try {
        if (process.platform !== "darwin") return failed("platform", "Dedicated VST3 installation currently requires macOS.");
        if (!path.isAbsolute(candidate) || !path.isAbsolute(destination) || !path.isAbsolute(identityProbe)
            || !/^[A-Za-z0-9_][A-Za-z0-9_ .-]*\.vst3$/u.test(path.basename(destination)))
            return failed("unsafe-path", "Install paths and the build-produced identity probe must be absolute, with a VST3 bundle destination.");
        const installDirectory = path.dirname(destination);
        const directoryEntry = await maybeEntry(installDirectory);
        if (directoryEntry !== null && (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink()))
            return failed("unsafe-path", `Install directory must not be a symbolic link: ${installDirectory}`);
        const replacement = await inspectVST3Bundle(candidate, tools);
        if (replacement.status === "failed") return replacement;
        const existingEntry = await maybeEntry(destination);
        let existing = null;
        if (existingEntry !== null) {
            if (await realpath(candidate) === await realpath(destination))
                return failed("unsafe-path", "The candidate and installed bundle must be different directories.");
            existing = await inspectVST3Bundle(destination, { ...tools, purpose: "existing" });
            if (existing.status === "failed") return existing;
            if (!sameIdentity(existing.identity, replacement.identity)) {
                return failed("identity-conflict", `Refusing to replace ${destination}: existing identity `
                    + `${existing.identity.bundleIdentifier} / ${existing.identity.processorClassId} differs from candidate `
                    + `${replacement.identity.bundleIdentifier} / ${replacement.identity.processorClassId}. The installed plugin was not changed.`);
            }
        }
        if (dryRun) return { status: "dry-run", destination, identity: replacement.identity };

        await mkdir(installDirectory, { recursive: true });
        if ((await lstat(installDirectory)).isSymbolicLink()) return failed("unsafe-path", "Install directory changed into a symbolic link.");
        const transactionPath = path.join(path.dirname(installDirectory), `.${path.basename(destination)}.install`);
        try { await mkdir(transactionPath, { mode: 0o700 }); }
        catch (error) {
            if (error !== null && typeof error === "object" && error.code === "EEXIST")
                return failed("pending-install", `An installation or recovery is already present at ${transactionPath}. Inspect it before retrying; it was not changed.`, transactionPath);
            throw error;
        }
        transactionDirectory = transactionPath;
        phase = "staging";
        const staged = path.join(transactionDirectory, "candidate.vst3");
        const backup = path.join(transactionDirectory, "previous.bundle");
        await cp(candidate, staged, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true });
        const stagedInspection = await inspectVST3Bundle(staged, tools);
        if (stagedInspection.status === "failed") return await abandon(stagedInspection);
        if (!sameIdentity(stagedInspection.identity, replacement.identity) || stagedInspection.digest !== replacement.digest)
            return await abandon(failed("candidate-changed", "The staged replacement does not match the preflighted build. The installed plugin was not changed."));

        if (existing !== null) {
            if (!await samePayload(destination, existing))
                return await abandon(failed("installed-changed", "The installed plugin changed during preflight. No replacement was performed."));
            const captured = await captureMove(destination, backup, existing, identityProbe);
            if (captured.status === "failed") {
                if (captured.error.code === "unexpected-capture") return retained(captured.error.message);
                return await abandon(captured);
            }
            previous = backup;
            previousInspection = existing;
            phase = "previous-retained";
        } else if (await maybeEntry(destination) !== null) {
            return await abandon(failed("installed-changed", "A plugin appeared at the destination during preflight. No replacement was performed."));
        }

        const promoted = await captureMove(staged, destination, stagedInspection, identityProbe);
        if (promoted.status === "failed") {
            if (promoted.error.code === "unexpected-capture") return retained(promoted.error.message);
            return await abandon(promoted);
        }
        promotedInspection = stagedInspection;
        phase = "promoted";
        const installed = await inspectVST3Bundle(destination, tools);
        if (installed.status === "failed") return await abandon(installed);
        if (!sameIdentity(installed.identity, replacement.identity) || installed.digest !== replacement.digest
            || await hashInstalledPayload(destination) !== replacement.digest)
            return await abandon(failed("installed-changed", "The promoted bundle did not preserve the validated replacement."));
        if (previous !== undefined && !await samePayload(previous, previousInspection))
            return retained("The retained prior bundle changed after capture. It was not deleted.");

        // All install gates passed. Cleanup failure does not undo a successful
        // install or risk a partially removed backup during rollback.
        try { await rm(transactionDirectory, { recursive: true }); }
        catch {
            return { status: "installed", destination, identity: installed.identity, recoveryDirectory: transactionDirectory };
        }
        return { status: "installed", destination, identity: installed.identity };
    } catch (error) {
        return await abandon(failed("filesystem", `VST3 installation failed during ${phase}: ${describe(error)}`));
    }

    function retained(message) {
        return failed("recovery-required", message, transactionDirectory);
    }

    async function abandon(failure) {
        if (transactionDirectory === undefined) return failure;
        try {
            if (phase === "promoted") {
                if (!await samePayload(destination, promotedInspection))
                    return retained(`${failure.error.message} The destination changed; automatic rollback stopped. Retained files were not deleted.`);
                const captured = await captureMove(destination, path.join(transactionDirectory, "failed.bundle"), promotedInspection, identityProbe);
                if (captured.status === "failed")
                    return retained(`${failure.error.message} ${captured.error.message}`);
                phase = "previous-retained";
            }
            if (previous !== undefined) {
                const restored = await captureMove(previous, destination, previousInspection, identityProbe);
                if (restored.status === "failed")
                    return retained(`${failure.error.message} Rollback did not complete: ${restored.error.message}`);
                previous = undefined;
            }
            await rm(transactionDirectory, { recursive: true });
            transactionDirectory = undefined;
            return failure;
        } catch (error) {
            return retained(`${failure.error.message} Recovery could not finish: ${describe(error)}. Inspect the retained installation directory.`);
        }
    }
}
