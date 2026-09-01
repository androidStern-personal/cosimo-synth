import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const SEQFX_PROVENANCE_SOURCE_PATHS = Object.freeze([
    "fx/seqfx",
    "kit/fx/build-effect.mjs",
    "kit/ui",
    "package.json",
    "package-lock.json",
    "scripts/capture_seqfx_visual_proof.mjs",
    "scripts/seqfx-proof-provenance.mjs",
    "scripts/seqfx-visual-proof-contract.mjs",
    "ui/shared",
]);

export const SEQFX_PROVENANCE_ARTIFACT_PATHS = Object.freeze([
    "build/fx/seqfx_runtime/view/app.js",
    "build/fx/seqfx_runtime/view/app.js.map",
    "build/fx/seqfx_runtime/worker.js",
    "build/fx/seqfx_runtime/worker.js.map",
]);

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function assertRelativePath(filePath) {
    if (path.isAbsolute(filePath) || filePath.split(/[\\/]/).includes("..")) {
        throw new Error(`SeqFX provenance paths must be repository-relative: ${filePath}`);
    }
}

export function createSeqFxSourceFingerprint(entries) {
    const normalized = entries.map((entry) => {
        assertRelativePath(entry.path);
        const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes);
        return {
            path: entry.path.replaceAll("\\", "/"),
            bytes: bytes.byteLength,
            sha256: sha256(bytes),
        };
    }).sort((left, right) => left.path.localeCompare(right.path));
    const aggregate = createHash("sha256");
    for (const entry of normalized) {
        aggregate.update(entry.path);
        aggregate.update("\0");
        aggregate.update(entry.sha256);
        aggregate.update("\0");
    }
    return {
        aggregateSha256: aggregate.digest("hex"),
        files: normalized,
    };
}

export function compareSeqFxProofProvenance(before, after) {
    const failures = [];
    const fields = ["head", "tree", "branch", "dirtyStatus", "packageLockSha256"];
    for (const field of fields) {
        if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
            failures.push(`${field} changed during capture`);
        }
    }
    if (before.source.aggregateSha256 !== after.source.aggregateSha256) {
        failures.push("source aggregate changed during capture");
    }
    if (JSON.stringify(before.artifacts) !== JSON.stringify(after.artifacts)) {
        failures.push("built artifact hashes changed during capture");
    }
    return failures;
}

async function git(repoRoot, args) {
    const { stdout } = await execFileAsync("git", args, {
        cwd: repoRoot,
        encoding: "buffer",
        maxBuffer: 16 * 1024 * 1024,
    });
    return Buffer.from(stdout);
}

async function listSourcePaths(repoRoot) {
    const output = await git(repoRoot, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ...SEQFX_PROVENANCE_SOURCE_PATHS,
    ]);
    return output.toString("utf8").split("\0").filter(Boolean).sort();
}

async function hashRepoFiles(repoRoot, filePaths) {
    return await Promise.all(filePaths.map(async (filePath) => {
        assertRelativePath(filePath);
        return {
            path: filePath,
            bytes: await readFile(path.join(repoRoot, filePath)),
        };
    }));
}

export async function captureSeqFxProofProvenance(repoRoot, { requireClean = false } = {}) {
    const [head, tree, branch, dirtyStatus, sourcePaths, packageLock] = await Promise.all([
        git(repoRoot, ["rev-parse", "HEAD"]),
        git(repoRoot, ["rev-parse", "HEAD^{tree}"]),
        git(repoRoot, ["branch", "--show-current"]),
        git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]),
        listSourcePaths(repoRoot),
        readFile(path.join(repoRoot, "package-lock.json")),
    ]);
    const normalizedDirtyStatus = dirtyStatus.toString("utf8").trimEnd().split("\n").filter(Boolean);
    if (requireClean && normalizedDirtyStatus.length > 0) {
        throw new Error(`SeqFX final visual proof requires a clean worktree:\n${normalizedDirtyStatus.join("\n")}`);
    }
    const [sourceEntries, artifactEntries] = await Promise.all([
        hashRepoFiles(repoRoot, sourcePaths),
        hashRepoFiles(repoRoot, SEQFX_PROVENANCE_ARTIFACT_PATHS),
    ]);
    const artifacts = createSeqFxSourceFingerprint(artifactEntries).files;
    return {
        head: head.toString("utf8").trim(),
        tree: tree.toString("utf8").trim(),
        branch: branch.toString("utf8").trim(),
        dirtyStatus: normalizedDirtyStatus,
        packageLockSha256: sha256(packageLock),
        source: createSeqFxSourceFingerprint(sourceEntries),
        artifacts,
    };
}
