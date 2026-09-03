// Builder Kit release (plan 5.2, Andrew-side; not exported). Turns the
// current monorepo state into one customer-facing release on the static feed:
//
//   1. export the kit to a staging dir with the feed URL stamped in
//      kit/feed.json, run the export gates, and prove a second copy
//      (proveExport: canonical typecheck/test, Enhancer Lite build, update-flow merge);
//   2. on macOS build the pinned `cmaj` and the JIT dev loader
//      `CmajPlugin.vst3`, archive them, hash them, and record the hashes in
//      the staged kit/toolchain.json;
//   3. commit the staged tree into the lineage clone (builder-kit-releases)
//      as "Builder Kit <version>" and tag it v<version>;
//   4. create bare mirrors of the lineage, the Cmajor fork, and the CHOC fork
//      at the pinned commits, `git update-server-info` them for dumb-HTTP
//      serving, and verify the Cmajor mirror's .gitmodules points at CHOC
//      with a relative URL (so customers never leave the feed);
//   5. upload and verify immutable objects/tools, then cumulative pack discovery,
//      then refs, then manifest.json. Never delete older release objects.
//
// Usage:
//   node scripts/release_builder_kit.mjs --version <semver> --source-sha <40-hex>
//       --lineage <path to builder-kit-releases clone> --destination-config <json>
//       [--dry-run] [--skip-tools] [--tools-dir <dir>] [--staging <dir>]
//       [--cmajor-source <url|path>] [--choc-source <url|path>]
//
// --dry-run does everything local that this platform allows (export, proof,
// lineage commit + tag on a throwaway clone, mirrors from local sources,
// manifest), skips every network step and the tool builds on non-macOS, and
// prints the staging layout. The staging dir is kept in every mode.

import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { exportKit as defaultExportKit, proveExport as defaultProveExport } from "../kit/scripts/export_kit.mjs";
import { ensureRedacted, redact, reveal } from "../kit/scripts/redacted.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const usage = [
    "Usage: node scripts/release_builder_kit.mjs --version <semver> --source-sha <40-hex>",
    "         --lineage <builder-kit-releases clone> --destination-config <json>",
    "         [--dry-run] [--skip-tools] [--tools-dir <dir>] [--staging <dir>]",
    "         [--cmajor-source <url|path>] [--choc-source <url|path>]",
    "",
    "  --dry-run       local steps only (no push, no rclone, no tool builds off macOS); prints the staging layout",
    "                  (destination capability is still read from macOS Keychain)",
    "  --skip-tools    do not build cmaj/CmajPlugin.vst3; a real release then needs --tools-dir with the archives",
    "  --tools-dir     directory holding prebuilt tool archives named as in kit/toolchain.json",
    "  --staging       staging directory (default: a fresh dir under the OS temp dir); must be outside the monorepo",
    "  --cmajor-source / --choc-source",
    "                  override where the cmajor/choc mirrors are cloned from (default: the pinned fork URLs)",
    "  --destination-config",
    "                  JSON containing non-secret feedOrigin and rcloneRoot; the cohort capability comes from Keychain",
].join("\n");

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const shaPattern = /^[0-9a-f]{40}$/;

// ---------------------------------------------------------------------------
// Arguments

export function parseArgs(argv) {
    const options = {
        version: null,
        sourceSha: null,
        lineage: null,
        destinationConfig: null,
        dryRun: false,
        skipTools: false,
        toolsDir: null,
        staging: null,
        cmajorSource: null,
        chocSource: null,
    };
    const valueFlags = {
        "--version": "version",
        "--source-sha": "sourceSha",
        "--lineage": "lineage",
        "--destination-config": "destinationConfig",
        "--tools-dir": "toolsDir",
        "--staging": "staging",
        "--cmajor-source": "cmajorSource",
        "--choc-source": "chocSource",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--dry-run") {
            options.dryRun = true;
        } else if (arg === "--skip-tools") {
            options.skipTools = true;
        } else if (arg in valueFlags) {
            const value = argv[index + 1];
            if (value === undefined || value.startsWith("--")) {
                throw new Error(`${arg} needs a value.\n${usage}`);
            }
            options[valueFlags[arg]] = value;
            index += 1;
        } else {
            throw new Error(`Unknown release argument.\n${usage}`);
        }
    }

    if (!options.version || !semverPattern.test(options.version)) {
        throw new Error(`--version must be a semver like 1.2.0.\n${usage}`);
    }
    if (!options.sourceSha || !shaPattern.test(options.sourceSha)) {
        throw new Error(`--source-sha must be a full 40-hex commit.\n${usage}`);
    }
    if (!options.destinationConfig) {
        throw new Error(`--destination-config is required.\n${usage}`);
    }
    if (!options.dryRun) {
        if (!options.lineage) throw new Error(`--lineage is required for a real release.\n${usage}`);
        if (options.skipTools && !options.toolsDir) {
            throw new Error("--skip-tools on a real release needs --tools-dir with the prebuilt archives.");
        }
    }
    for (const key of ["lineage", "toolsDir", "staging", "destinationConfig"]) {
        if (options[key]) options[key] = path.resolve(options[key]);
    }
    if (options.staging && (options.staging === repoRoot || options.staging.startsWith(repoRoot + path.sep))) {
        throw new Error("--staging must be outside the monorepo (the export refuses to write inside it).");
    }
    return options;
}

/** The feed URL and the R2 prefix must end in the same cohort segment. */
export function assertFeedMatchesPrefix(feedUrl, r2) {
    const feedTail = reveal(ensureRedacted(feedUrl)).replace(/\/+$/, "").split("/").pop();
    const prefixTail = reveal(ensureRedacted(r2)).replace(/\/+$/, "").split("/").pop();
    if (feedTail !== prefixTail) {
        throw new Error("Release feed and object destination do not name the same cohort path.");
    }
}

export const defaultKeychainService = "builder-kit-feed-cohort";

export function readCapabilityFromKeychain({
    service = defaultKeychainService,
    execute = execFileSync,
} = {}) {
    try {
        const value = redact(execute("security", ["find-generic-password", "-s", service, "-w"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim());
        if (!/^[A-Za-z0-9._~-]+$/u.test(reveal(value))) throw new Error("invalid capability");
        return value;
    } catch {
        throw new Error("Could not read the Builder Kit release capability from macOS Keychain.");
    }
}

export async function readDestinationConfig(filePath) {
    let config;
    try {
        config = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
        throw new Error("Could not read the Builder Kit release destination configuration.");
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("Release destination configuration must be a JSON object.");
    }
    let origin;
    try {
        origin = new URL(config.feedOrigin);
    } catch {
        throw new Error("Release destination feedOrigin must be an absolute HTTPS URL.");
    }
    if (origin.protocol !== "https:") {
        throw new Error("Release destination feedOrigin must be an absolute HTTPS URL.");
    }
    if (typeof config.rcloneRoot !== "string" || !/^[^:/\s]+:[^\s]+$/u.test(config.rcloneRoot)) {
        throw new Error("Release destination rcloneRoot must name a configured rclone path.");
    }
    return {
        feedOrigin: redact(origin.toString().replace(/\/+$/u, "")),
        rcloneRoot: redact(config.rcloneRoot.replace(/\/+$/u, "")),
        keychainService: typeof config.keychainService === "string" && config.keychainService !== ""
            ? config.keychainService
            : defaultKeychainService,
    };
}

export function createReleaseDestination(config, capabilityInput) {
    const capability = reveal(ensureRedacted(capabilityInput));
    if (!/^[A-Za-z0-9._~-]+$/u.test(capability)) {
        throw new Error("The Keychain release capability is malformed.");
    }
    const feedOrigin = reveal(ensureRedacted(config.feedOrigin));
    const rcloneRoot = reveal(ensureRedacted(config.rcloneRoot));
    const feedUrl = redact(`${feedOrigin}/${capability}`);
    const r2Target = redact(`${rcloneRoot}/${capability}`);
    assertFeedMatchesPrefix(feedUrl, r2Target);
    return Object.freeze({ feedUrl, r2Target });
}

// ---------------------------------------------------------------------------
// Small helpers

export function runCommand(command, args, { cwd = repoRoot, env = process.env, label = command } = {}) {
    try {
        return execFileSync(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    } catch {
        throw new Error(`${label} failed.`);
    }
}

const git = (cwd, ...args) => runCommand("git", args, { cwd }).trim();

export function readSourceState(root = repoRoot) {
    return {
        sha: git(root, "rev-parse", "HEAD"),
        status: git(root, "status", "--porcelain=v1", "--untracked-files=all"),
    };
}

export function assertSourceState(expectedSha, state) {
    if (state.sha !== expectedSha) {
        throw new Error(`Release source HEAD ${state.sha} does not match --source-sha ${expectedSha}.`);
    }
    if (state.status !== "") {
        throw new Error("Release source is not clean, including untracked files.");
    }
}

export function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash("sha256");
        createReadStream(filePath)
            .on("error", reject)
            .on("data", (chunk) => hash.update(chunk))
            .on("end", () => resolve(hash.digest("hex")));
    });
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isLocalSource(source) {
    return !/^[a-z][a-z0-9+.-]*:\/\//i.test(source) && !/^[^/@:]+@[^:]+:/.test(source);
}

// ---------------------------------------------------------------------------
// Pins

/** The Cmajor fork pin (commit + URL) as declared under kit/cmake. */
export async function readCmajorPin(kitRoot = path.join(repoRoot, "kit")) {
    const dependencies = await fs.readFile(path.join(kitRoot, "cmake/CosimoDependencies.cmake"), "utf8");
    const block = dependencies.match(/NAME\s+cosimo_cmajor\b([\s\S]*?)\)/);
    if (!block) throw new Error("CosimoDependencies.cmake: no CPMAddPackage block named cosimo_cmajor.");
    // The tag is either a literal commit or the shared COSIMO_CMAJOR_PINNED_COMMIT
    // variable (one pin for the plugin and toolchain packages).
    let commit = block[1].match(/GIT_TAG\s+"([0-9a-f]{40})"/)?.[1] ?? null;
    if (!commit && /GIT_TAG\s+"\$\{COSIMO_CMAJOR_PINNED_COMMIT\}"/.test(block[1])) {
        commit = dependencies.match(/set\(COSIMO_CMAJOR_PINNED_COMMIT\s+"([0-9a-f]{40})"\)/)?.[1] ?? null;
    }
    if (!commit) throw new Error("CosimoDependencies.cmake: cosimo_cmajor GIT_TAG must be a full 40-hex commit (literal or COSIMO_CMAJOR_PINNED_COMMIT).");

    let url = block[1].match(/GIT_REPOSITORY\s+"(https?:\/\/[^"]+)"/)?.[1] ?? null;
    if (!url) {
        const sourcesPath = path.join(kitRoot, "cmake/dependency-sources.cmake");
        if (existsSync(sourcesPath)) {
            const sources = await fs.readFile(sourcesPath, "utf8");
            url = sources.match(/set\(COSIMO_CMAJOR_GIT_URL\s+"([^"]+)"\)/)?.[1] ?? null;
        }
    }
    if (!url) throw new Error("Could not find the Cmajor fork URL (GIT_REPOSITORY or COSIMO_CMAJOR_GIT_URL) under kit/cmake.");
    return { commit, url };
}

// ---------------------------------------------------------------------------
// Git URL / .gitmodules handling

/** Resolve a submodule URL the way git does: relative to the superproject URL. */
export function resolveRelativeGitUrl(superprojectUrl, relativeUrl) {
    if (!/^\.\.?\//.test(relativeUrl)) return relativeUrl;
    const base = superprojectUrl.replace(/\/+$/, "").split("/");
    const parts = relativeUrl.split("/");
    for (const part of parts) {
        if (part === "..") {
            if (base.length <= 1) throw new Error("Could not resolve the relative repository URL.");
            base.pop();
        } else if (part !== "." && part !== "") {
            base.push(part);
        }
    }
    return base.join("/");
}

/** Parse .gitmodules into [{ name, path, url }]. */
export function parseGitmodules(text) {
    const entries = [];
    let current = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        const header = line.match(/^\[submodule\s+"([^"]+)"\]$/);
        if (header) {
            current = { name: header[1], path: null, url: null };
            entries.push(current);
            continue;
        }
        const pair = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (pair && current) {
            if (pair[1] === "path") current.path = pair[2].trim();
            if (pair[1] === "url") current.url = pair[2].trim();
        }
    }
    return entries;
}

export const chocSubmodulePath = "include/choc";

/**
 * The CHOC submodule entry of the cmajor mirror at `commit`. Fails unless the
 * URL is relative (../choc.git), which is what keeps customers on the feed.
 */
export function verifyRelativeChocSubmodule(cmajorMirror, commit) {
    let text;
    try {
        text = git(cmajorMirror, "show", `${commit}:.gitmodules`);
    } catch (error) {
        throw new Error(`Cmajor mirror has no .gitmodules at ${commit}: ${error.message}`);
    }
    const entry = parseGitmodules(text).find((candidate) => candidate.path === chocSubmodulePath);
    if (!entry) throw new Error(`Cmajor .gitmodules at ${commit} has no submodule at ${chocSubmodulePath}.`);
    if (!entry.url || !/^\.\.?\//.test(entry.url)) {
        throw new Error(
            `Cmajor .gitmodules CHOC url must be relative (e.g. ../choc.git) so customers stay on the feed; found "${entry.url}". Fix the fork at ${commit} first.`,
        );
    }
    const gitlink = git(cmajorMirror, "ls-tree", commit, "--", chocSubmodulePath);
    const gitlinkMatch = gitlink.match(/^160000\s+commit\s+([0-9a-f]{40})\s/);
    if (!gitlinkMatch) throw new Error(`Cmajor tree at ${commit} has no gitlink at ${chocSubmodulePath}.`);
    return { path: entry.path, url: entry.url, chocCommit: gitlinkMatch[1] };
}

// ---------------------------------------------------------------------------
// Bare mirrors

/** Bare-clone `source` into `destination` and prepare it for dumb-HTTP serving. */
export function createBareMirror(source, destination) {
    if (existsSync(destination)) throw new Error(`Mirror destination already exists: ${destination}`);
    runCommand("git", ["clone", "--bare", "--quiet", source, destination]);
    git(destination, "repack", "-a", "-d", "-q");
    git(destination, "update-server-info");
    for (const required of ["info/refs", "objects/info/packs"]) {
        if (!existsSync(path.join(destination, required))) {
            throw new Error(`update-server-info did not produce ${required} in ${destination}.`);
        }
    }
    return { head: git(destination, "rev-parse", "HEAD") };
}

export function assertCommitPresent(mirror, commit, label) {
    try {
        git(mirror, "cat-file", "-e", `${commit}^{commit}`);
    } catch {
        throw new Error(`${label} mirror ${mirror} does not contain the pinned commit ${commit}.`);
    }
}

// ---------------------------------------------------------------------------
// Lineage commit

async function treeDigest(root, { skipGit = false } = {}) {
    const hash = createHash("sha256");
    const visit = async (directory, relativeRoot = "") => {
        const entries = (await fs.readdir(directory, { withFileTypes: true }))
            .filter((entry) => !(skipGit && relativeRoot === "" && entry.name === ".git"))
            .sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const relative = path.posix.join(relativeRoot, entry.name);
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(target, relative);
            } else if (entry.isSymbolicLink()) {
                hash.update(`symlink\0${relative}\0${await fs.readlink(target)}\0`);
            } else {
                const executable = ((await fs.stat(target)).mode & 0o111) === 0 ? "plain" : "executable";
                hash.update(`file\0${relative}\0${executable}\0`);
                hash.update(await fs.readFile(target));
                hash.update("\0");
            }
        }
    };
    await visit(root);
    return hash.digest("hex");
}

function readReleaseTagCreatedAt(lineageDir, tag) {
    const tagRef = `refs/tags/${tag}`;
    if (git(lineageDir, "cat-file", "-t", tagRef) !== "tag") {
        throw new Error(`Release tag ${tag} must be an annotated tag.`);
    }
    const taggerDate = git(lineageDir, "for-each-ref", "--format=%(taggerdate:iso-strict)", tagRef);
    const createdAt = new Date(taggerDate);
    if (Number.isNaN(createdAt.getTime())) {
        throw new Error(`Release tag ${tag} has no valid tagger date.`);
    }
    return createdAt.toISOString();
}

/** Replace the lineage clone's working tree with the export and commit + tag it. */
export async function commitRelease(lineageDir, exportRoot, version) {
    const tag = `v${version}`;
    if (!existsSync(path.join(lineageDir, ".git"))) throw new Error(`${lineageDir} is not a git clone.`);
    if (git(lineageDir, "status", "--porcelain=v1", "--untracked-files=all")) throw new Error(`Lineage clone ${lineageDir} has uncommitted changes.`);
    // symbolic-ref (not rev-parse) so a freshly created lineage repo with no
    // commits yet (unborn HEAD, the first release) still names its branch.
    let branch;
    try {
        branch = git(lineageDir, "symbolic-ref", "--short", "--quiet", "HEAD");
    } catch {
        throw new Error(`Lineage clone ${lineageDir} is on a detached HEAD.`);
    }
    const existingTag = git(lineageDir, "tag", "--list", tag);
    if (existingTag) {
        const taggedCommit = git(lineageDir, "rev-list", "-n", "1", tag);
        const headCommit = git(lineageDir, "rev-parse", "HEAD");
        const [lineageDigest, exportDigest] = await Promise.all([
            treeDigest(lineageDir, { skipGit: true }),
            treeDigest(exportRoot),
        ]);
        if (taggedCommit !== headCommit || lineageDigest !== exportDigest) {
            throw new Error(`Tag ${tag} already exists but does not identify this exact exported release.`);
        }
        return {
            commit: taggedCommit,
            tag,
            branch,
            createdAt: readReleaseTagCreatedAt(lineageDir, tag),
            reused: true,
        };
    }

    for (const entry of await fs.readdir(lineageDir)) {
        if (entry !== ".git") await fs.rm(path.join(lineageDir, entry), { recursive: true, force: true });
    }
    await fs.cp(exportRoot, lineageDir, { recursive: true, verbatimSymlinks: true });
    git(lineageDir, "add", "-A");
    if (!git(lineageDir, "status", "--porcelain")) {
        throw new Error(`Export is identical to the lineage tip; nothing to release as ${tag}.`);
    }
    git(lineageDir, "commit", "--quiet", "-m", `Builder Kit ${version}`);
    git(lineageDir, "tag", "-a", tag, "-m", `Builder Kit ${version}`);
    return {
        commit: git(lineageDir, "rev-parse", "HEAD"),
        tag,
        branch,
        createdAt: readReleaseTagCreatedAt(lineageDir, tag),
        reused: false,
    };
}

function parseRemoteRefs(output) {
    const refs = new Map();
    for (const line of output.split(/\r?\n/u)) {
        const match = line.match(/^([0-9a-f]{40})\s+(.+)$/u);
        if (match) refs.set(match[2], match[1]);
    }
    return refs;
}

export function inspectRemoteRelease(lineageDir, lineage) {
    const branchRef = `refs/heads/${lineage.branch}`;
    const tagRef = `refs/tags/${lineage.tag}`;
    const refs = parseRemoteRefs(git(lineageDir, "ls-remote", "origin", branchRef, tagRef, `${tagRef}^{}`));
    const tagObject = refs.get(tagRef) ?? null;
    const tagCommit = refs.get(`${tagRef}^{}`) ?? tagObject;
    return { branchCommit: refs.get(branchRef) ?? null, tagObject, tagCommit };
}

export function pushReleaseAtomically(lineageDir, lineage) {
    const localTagObject = git(lineageDir, "rev-parse", `refs/tags/${lineage.tag}`);
    const before = inspectRemoteRelease(lineageDir, lineage);
    if (before.tagObject !== null) {
        if (before.tagObject !== localTagObject || before.tagCommit !== lineage.commit || before.branchCommit !== lineage.commit) {
            throw new Error(`Remote tag ${lineage.tag} already exists with different release state.`);
        }
        return { reused: true };
    }
    git(
        lineageDir,
        "push",
        "--atomic",
        "--quiet",
        "origin",
        `${lineage.commit}:refs/heads/${lineage.branch}`,
        `refs/tags/${lineage.tag}:refs/tags/${lineage.tag}`,
    );
    const after = inspectRemoteRelease(lineageDir, lineage);
    if (after.branchCommit !== lineage.commit || after.tagObject !== localTagObject || after.tagCommit !== lineage.commit) {
        throw new Error("Atomic lineage push did not publish the exact branch and tag commit.");
    }
    return { reused: false };
}

// ---------------------------------------------------------------------------
// Tools

export function toolArchiveName(toolchain, key) {
    return path.posix.basename(toolchain[key].artifact);
}

export function assertVersionedToolArtifacts(toolchain, version) {
    const prefix = `tools/v${version}/`;
    for (const key of ["cmaj", "cmajPlugin"]) {
        const artifact = toolchain[key]?.artifact;
        if (typeof artifact !== "string" || !artifact.startsWith(prefix)
            || path.posix.normalize(artifact) !== artifact || artifact === prefix) {
            throw new Error(`${key} artifact must stay inside the current release's ${prefix} directory.`);
        }
    }
}

/** Archive the built cmaj binary and CmajPlugin.vst3 bundle as the toolchain names them. */
export async function packageToolArtifacts({ cmajBinary, vst3Bundle, toolsDir, toolchain, platform = process.platform }) {
    await fs.mkdir(toolsDir, { recursive: true });
    const cmajArchive = path.join(toolsDir, toolArchiveName(toolchain, "cmaj"));
    const pluginArchive = path.join(toolsDir, toolArchiveName(toolchain, "cmajPlugin"));
    await fs.rm(cmajArchive, { force: true });
    await fs.rm(pluginArchive, { force: true });

    if (!existsSync(cmajBinary)) throw new Error(`cmaj binary not found: ${cmajBinary}`);
    if (!existsSync(vst3Bundle)) throw new Error(`CmajPlugin.vst3 bundle not found: ${vst3Bundle}`);
    if (!cmajArchive.endsWith(".tar.gz")) throw new Error(`Expected a .tar.gz artifact for cmaj, got ${cmajArchive}.`);
    if (!pluginArchive.endsWith(".zip")) throw new Error(`Expected a .zip artifact for CmajPlugin, got ${pluginArchive}.`);

    runCommand("tar", ["-czf", cmajArchive, "-C", path.dirname(cmajBinary), path.basename(cmajBinary)]);
    if (platform === "darwin") {
        runCommand("/usr/bin/ditto", ["-c", "-k", "--keepParent", vst3Bundle, pluginArchive]);
    } else {
        runCommand("zip", ["-r", "-y", "-q", pluginArchive, path.basename(vst3Bundle)], { cwd: path.dirname(vst3Bundle) });
    }
    return hashToolArchives(toolsDir, toolchain);
}

/** Hash the archives named by the toolchain that exist in toolsDir. */
export async function hashToolArchives(toolsDir, toolchain) {
    const hashes = {};
    for (const key of ["cmaj", "cmajPlugin"]) {
        const archive = path.join(toolsDir, toolArchiveName(toolchain, key));
        if (!existsSync(archive)) continue;
        const stat = await fs.stat(archive);
        hashes[key] = { file: archive, sha256: await sha256File(archive), bytes: stat.size };
    }
    return hashes;
}

/** Build the pinned cmaj and CmajPlugin.vst3 on macOS and archive them. */
export async function buildToolArtifacts({ toolsDir, toolchain, log }) {
    const cmajBuildDir = path.join(repoRoot, "build/cmajor_command");
    const jobs = String(process.env.COSIMO_CMAKE_JOBS ?? Math.max(1, os.availableParallelism()));
    log(`Building pinned cmaj (${toolchain.cmaj.forkCommit.slice(0, 9)}) in ${cmajBuildDir}`);
    runCommand("cmake", ["-S", path.join(repoRoot, "tools/cmajor_command_build"), "-B", cmajBuildDir, "-DCMAKE_BUILD_TYPE=Release"]);
    runCommand("cmake", ["--build", cmajBuildDir, "--config", "Release", "--target", "cmaj", "--parallel", jobs]);
    const cmajBinary = path.join(cmajBuildDir, "bin/cmaj");

    const pluginBuildDir = path.join(repoRoot, "build/cmajplugin-source");
    log(`Building CmajPlugin.vst3 in ${pluginBuildDir}`);
    runCommand("bash", [path.join(repoRoot, "kit/scripts/build_cmajplugin_vst3.sh"), pluginBuildDir]);
    const vst3Bundle = path.join(pluginBuildDir, "cmajplugin/CmajPlugin_artefacts/Release/VST3/CmajPlugin.vst3");

    return packageToolArtifacts({ cmajBinary, vst3Bundle, toolsDir, toolchain });
}

/** A copy of kit/toolchain.json with the release hashes written in. */
export function renderToolchain(toolchain, hashes) {
    const rendered = structuredClone(toolchain);
    for (const key of ["cmaj", "cmajPlugin"]) {
        if (hashes[key]) rendered[key].sha256 = hashes[key].sha256;
    }
    return rendered;
}

// ---------------------------------------------------------------------------
// Manifest + staging layout

export function renderManifest({ version, createdAt, sourceCommit, exportFileCount, lineage, cmajor, choc, toolchain, hashes }) {
    const tool = (key) => (hashes[key]
        ? { artifact: toolchain[key].artifact, sha256: hashes[key].sha256, bytes: hashes[key].bytes }
        : null);
    return {
        schemaVersion: 1,
        version,
        tag: `v${version}`,
        createdAt,
        source: { commit: sourceCommit, exportFileCount },
        kit: { repo: "kit.git", branch: lineage.branch, commit: lineage.commit, tag: lineage.tag },
        cmajor: { repo: "cmajor.git", commit: cmajor.commit },
        choc: { repo: "choc.git", commit: choc.commit, submodulePath: chocSubmodulePath, submoduleUrl: choc.submoduleUrl },
        tools: {
            cmaj: tool("cmaj") && { ...tool("cmaj"), forkCommit: toolchain.cmaj.forkCommit },
            cmajPlugin: tool("cmajPlugin"),
        },
    };
}

async function countFiles(root) {
    if (!existsSync(root)) return 0;
    let count = 0;
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        count += entry.isDirectory() ? await countFiles(path.join(root, entry.name)) : 1;
    }
    return count;
}

/** Human-readable listing of the staging dir (what --dry-run prints). */
export async function describeLayout(stagingRoot) {
    const lines = [`${stagingRoot}/`];
    const feedRoot = path.join(stagingRoot, "feed");
    for (const entry of (await fs.readdir(stagingRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(stagingRoot, entry.name);
        if (entry.name === "feed" && entry.isDirectory()) {
            lines.push("  feed/                      (additive object-copy source)");
            for (const item of (await fs.readdir(feedRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
                const itemPath = path.join(feedRoot, item.name);
                if (item.name.endsWith(".git")) {
                    const refs = git(itemPath, "for-each-ref", "--format=%(refname:short)").split("\n").filter(Boolean);
                    lines.push(`    ${item.name}/`.padEnd(30) + `bare mirror, HEAD ${git(itemPath, "rev-parse", "--short", "HEAD")}, refs: ${refs.join(", ")}`);
                } else if (item.isDirectory()) {
                    lines.push(`    ${item.name}/`);
                    for (const file of (await fs.readdir(itemPath)).sort()) {
                        const stat = await fs.stat(path.join(itemPath, file));
                        lines.push(`      ${file}`.padEnd(30) + `${stat.size} bytes`);
                    }
                } else {
                    lines.push(`    ${item.name}`);
                }
            }
        } else if (entry.isDirectory()) {
            lines.push(`  ${entry.name}/`.padEnd(30) + `${await countFiles(full)} files`);
        } else {
            lines.push(`  ${entry.name}`);
        }
    }
    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Orchestration

async function stampFeed(exportRoot, feedUrlInput, log) {
    const feedUrl = reveal(ensureRedacted(feedUrlInput));
    const feedPath = path.join(exportRoot, "kit/feed.json");
    const feed = await readJson(feedPath);
    if (feed.baseUrl !== feedUrl) {
        feed.baseUrl = feedUrl;
        await writeJson(feedPath, feed);
        log("Stamped the configured feed into kit/feed.json.");
    }
}

function parsePackList(text) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.some((line) => !/^P pack-[0-9a-f]{40}\.pack$/u.test(line)))
        throw new Error("Invalid Git pack discovery metadata; publication refused.");
    return lines;
}

/** Serialized per feed: immutable payloads first; discovery, refs, manifest last. */
export async function publishReleaseObjects(feedRoot, destination, { run = runCommand } = {}) {
    const alias = "builderkitrelease:";
    const env = {
        ...process.env,
        RCLONE_CONFIG_BUILDERKITRELEASE_TYPE: "alias",
        RCLONE_CONFIG_BUILDERKITRELEASE_REMOTE: reveal(destination.r2Target),
    };
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), "kit-publication-"));
    const phases = { objects: "immutable objects", packs: "pack discovery", refs: "Git refs", manifest: "manifest" };
    const packLists = [];
    try {
        for (const phase of Object.keys(phases)) await fs.mkdir(path.join(staging, phase));
        async function stage(directory = "") {
            for (const entry of await fs.readdir(path.join(feedRoot, directory), { withFileTypes: true })) {
                const relative = path.posix.join(directory, entry.name);
                if (entry.isDirectory()) { await stage(relative); continue; }
                let phase;
                if (/^(?:kit|cmajor|choc)\.git\/objects\/(?:[0-9a-f]{2}\/[0-9a-f]{38}|pack\/pack-[0-9a-f]{40}\.(?:pack|idx|rev|bitmap))$/u.test(relative)
                    || /^tools\/v[^/]+\/[^/]+$/u.test(relative)) phase = "objects";
                else if (/^(?:kit|cmajor|choc)\.git\/objects\/info\/packs$/u.test(relative)) {
                    phase = "packs";
                    packLists.push(relative);
                } else if (/^(?:kit|cmajor|choc)\.git\/(?:HEAD|packed-refs|info\/refs|refs\/.+)$/u.test(relative)) phase = "refs";
                else if (relative === "manifest.json") phase = "manifest";
                else continue; // Bare-repo config, hooks and logs are not HTTP client objects.
                if (!entry.isFile()) throw new Error("Publication payload must contain regular files.");
                const target = path.join(staging, phase, relative);
                await fs.mkdir(path.dirname(target), { recursive: true });
                await fs.copyFile(path.join(feedRoot, relative), target);
            }
        }
        await stage();
        if (!existsSync(path.join(staging, "manifest/manifest.json")) || !packLists.includes("kit.git/objects/info/packs"))
            throw new Error("Publication needs a release manifest and kit Git mirror.");

        const previousLists = new Set((await run("rclone", ["lsf", alias, "--recursive", "--files-only", "--include", "*.git/objects/info/packs"], { env, label: "pack discovery listing" })).split("\n").filter(Boolean));
        for (const relative of packLists) {
            const next = parsePackList(await fs.readFile(path.join(staging, "packs", relative), "utf8"));
            for (const line of next) {
                for (const extension of ["pack", "idx"]) {
                    const pack = line.slice(2).replace(/\.pack$/u, `.${extension}`);
                    if (!existsSync(path.join(staging, "objects", path.dirname(path.dirname(relative)), "pack", pack)))
                        throw new Error("Git pack discovery names a missing payload; publication refused.");
                }
            }
            const previous = previousLists.has(relative)
                ? parsePackList(await run("rclone", ["cat", `${alias}${relative}`], { env, label: "previous pack discovery read" }))
                : [];
            // Old pins may be unreachable from today's fork refs. Keep their
            // pack discovery as well as the bytes, including across repacking.
            const combined = [...new Set([...previous, ...next])].sort();
            await fs.writeFile(path.join(staging, "packs", relative), `${combined.join("\n")}\n\n`);
        }
        for (const [phase, label] of Object.entries(phases)) {
            const source = path.join(staging, phase);
            const copyFlags = phase === "objects" ? ["--immutable", "--checksum"] : ["--ignore-times"];
            await run("rclone", ["copy", ...copyFlags, "--transfers", "8", source, alias], { env, label: `${label} copy` });
            await run("rclone", ["check", "--download", "--one-way", source, alias], { env, label: `${label} verification` });
        }
    } finally {
        await fs.rm(staging, { recursive: true, force: true });
    }
}

export async function runRelease(options, {
    platform = process.platform,
    log = console.log,
    exportKit = defaultExportKit,
    proveExport = defaultProveExport,
    destination,
    getSourceState = () => readSourceState(),
    checkPublisher = () => runCommand("rclone", ["version"]),
    pushRelease = pushReleaseAtomically,
    publishObjects = publishReleaseObjects,
} = {}) {
    const { version, sourceSha, dryRun, skipTools } = options;
    const dry = (message) => log(`[dry-run] ${message}`);
    if (!destination?.feedUrl || !destination?.r2Target) {
        throw new Error("A redacted release destination is required.");
    }
    const feedUrl = ensureRedacted(destination.feedUrl);

    // Preflight.
    assertFeedMatchesPrefix(feedUrl, destination.r2Target);
    assertSourceState(sourceSha, await getSourceState());
    if (!dryRun && platform !== "darwin" && !skipTools) {
        throw new Error("A real release builds cmaj and CmajPlugin.vst3, which needs macOS. Use --dry-run here, or --skip-tools with --tools-dir.");
    }
    if (!dryRun) checkPublisher();
    if (options.lineage && !existsSync(path.join(options.lineage, ".git"))) {
        throw new Error(`--lineage ${options.lineage} is not a git clone.`);
    }
    // Staging.
    const stagingRoot = options.staging ?? await fs.mkdtemp(path.join(os.tmpdir(), `builder-kit-release-${version}-`));
    await fs.mkdir(stagingRoot, { recursive: true });
    const exportRoot = path.join(stagingRoot, "export");
    const proofRoot = path.join(stagingRoot, "proof");
    const toolsDir = path.join(stagingRoot, "tools");
    const feedRoot = path.join(stagingRoot, "feed");
    for (const stale of [exportRoot, proofRoot, feedRoot, path.join(stagingRoot, "lineage")]) {
        await fs.rm(stale, { recursive: true, force: true });
    }
    await fs.mkdir(feedRoot, { recursive: true });
    log(`Staging in ${stagingRoot}`);

    // 1. Export + gates, then prove a separate copy (the proof dirties its tree).
    const exported = await exportKit(exportRoot, { force: true, feedUrl: reveal(feedUrl), sourceCommit: sourceSha });
    await stampFeed(exportRoot, feedUrl, log);
    if (exported.sourceCommit !== sourceSha) {
        throw new Error(`Export source commit ${exported.sourceCommit} does not match --source-sha ${sourceSha}.`);
    }
    const kitManifest = await readJson(path.join(exportRoot, "kit/kit.json"));
    if (kitManifest.version !== version) {
        throw new Error(`Requested release version ${version} does not match exported kit/kit.json version ${kitManifest.version}.`);
    }
    log(`Exported ${exported.fileCount} files from ${exported.sourceCommit.slice(0, 9)}`);
    await exportKit(proofRoot, { force: true, feedUrl: reveal(feedUrl), sourceCommit: sourceSha });
    await stampFeed(proofRoot, feedUrl, () => {});
    await proveExport(proofRoot);
    log("Export proof passed (canonical typecheck/test, enhancer-lite build, update-flow merge).");
    assertSourceState(sourceSha, await getSourceState());

    // The pin comes from the exported kit (what customers receive is what we
    // mirror). The export points COSIMO_CMAJOR_GIT_URL at the feed's own
    // cmajor.git, so the mirror's source is the upstream fork the monorepo
    // declares.
    const cmajor = await readCmajorPin(path.join(exportRoot, "kit"));
    if (cmajor.url === `${reveal(feedUrl)}/cmajor.git`) {
        cmajor.url = (await readCmajorPin()).url;
    }
    const toolchain = await readJson(path.join(exportRoot, "kit/toolchain.json"));
    assertVersionedToolArtifacts(toolchain, version);
    if (toolchain.cmaj.forkCommit !== cmajor.commit) {
        throw new Error(`kit/toolchain.json cmaj.forkCommit ${toolchain.cmaj.forkCommit} != CosimoDependencies.cmake pin ${cmajor.commit}.`);
    }

    // 2. Tools.
    let hashes = {};
    if (skipTools) {
        if (options.toolsDir) {
            hashes = await hashToolArchives(options.toolsDir, toolchain);
            await fs.mkdir(toolsDir, { recursive: true });
            for (const key of Object.keys(hashes)) {
                const target = path.join(toolsDir, path.basename(hashes[key].file));
                if (path.resolve(hashes[key].file) !== path.resolve(target)) {
                    await fs.cp(hashes[key].file, target);
                }
            }
            log(`Reusing prebuilt tool archives from ${options.toolsDir}: ${Object.keys(hashes).join(", ") || "none"}`);
        } else {
            log("Skipping tool builds (--skip-tools).");
        }
    } else if (platform === "darwin") {
        hashes = await buildToolArtifacts({ toolsDir, toolchain, log });
    } else if (dryRun) {
        dry(`Would build cmaj + CmajPlugin.vst3 on macOS and archive them into ${toolsDir}`);
    }
    const missingTools = ["cmaj", "cmajPlugin"].filter((key) => !hashes[key]);
    if (missingTools.length && !dryRun) {
        throw new Error(`Release is missing tool archives for: ${missingTools.join(", ")}.`);
    }
    await writeJson(path.join(exportRoot, "kit/toolchain.json"), renderToolchain(toolchain, hashes));
    for (const key of Object.keys(hashes)) log(`${key}: sha256 ${hashes[key].sha256} (${hashes[key].bytes} bytes)`);

    // 3. Lineage commit + tag (on a throwaway clone in dry-run).
    let lineageDir = options.lineage;
    if (dryRun) {
        lineageDir = path.join(stagingRoot, "lineage");
        if (options.lineage) {
            runCommand("git", ["clone", "--quiet", options.lineage, lineageDir]);
        } else {
            runCommand("git", ["init", "--quiet", "--initial-branch=main", lineageDir]);
            git(lineageDir, "config", "user.email", "release@example.invalid");
            git(lineageDir, "config", "user.name", "Builder Kit release (dry run)");
            git(lineageDir, "commit", "--quiet", "--allow-empty", "-m", "Empty lineage (dry run)");
            dry("No --lineage given; committing into a throwaway empty repo.");
        }
    }
    const lineage = await commitRelease(lineageDir, exportRoot, version);
    log(`${lineage.reused ? "Reused" : "Committed"} ${lineage.commit.slice(0, 9)} and tag ${lineage.tag} on ${lineage.branch}.`);
    if (dryRun) {
        dry(`Would atomically push ${lineage.branch} and ${lineage.tag} to the lineage origin.`);
    } else {
        assertSourceState(sourceSha, await getSourceState());
        const pushed = pushRelease(lineageDir, lineage);
        log(`${pushed.reused ? "Verified existing" : "Published"} lineage branch and tag atomically.`);
    }

    // 4. Bare mirrors.
    const kitMirror = path.join(feedRoot, "kit.git");
    createBareMirror(lineageDir, kitMirror);
    if (!git(kitMirror, "tag", "--list", lineage.tag)) throw new Error(`kit.git mirror is missing tag ${lineage.tag}.`);
    log(`Mirrored kit.git (${lineage.tag})`);

    const cmajorSource = options.cmajorSource ?? cmajor.url;
    const cmajorMirror = path.join(feedRoot, "cmajor.git");
    let choc = { commit: null, submoduleUrl: null };
    if (dryRun && !isLocalSource(cmajorSource)) {
        dry(`Would mirror cmajor.git at ${cmajor.commit} and verify its relative CHOC submodule URL.`);
        dry("Would mirror choc.git from the URL that the cmajor .gitmodules resolves to.");
    } else {
        createBareMirror(cmajorSource, cmajorMirror);
        assertCommitPresent(cmajorMirror, cmajor.commit, "cmajor");
        const submodule = verifyRelativeChocSubmodule(cmajorMirror, cmajor.commit);
        log(`Mirrored cmajor.git; .gitmodules CHOC url "${submodule.url}" is relative (choc pin ${submodule.chocCommit.slice(0, 9)})`);

        const chocSource = options.chocSource ?? resolveRelativeGitUrl(cmajorSource, submodule.url);
        const chocMirror = path.join(feedRoot, "choc.git");
        if (dryRun && !isLocalSource(chocSource)) {
            dry(`Would mirror choc.git at ${submodule.chocCommit}.`);
        } else {
            createBareMirror(chocSource, chocMirror);
            assertCommitPresent(chocMirror, submodule.chocCommit, "choc");
            log("Mirrored choc.git");
        }
        choc = { commit: submodule.chocCommit, submoduleUrl: submodule.url };
    }

    // 5. Tools + manifest into the feed tree.
    for (const key of Object.keys(hashes)) {
        const target = path.join(feedRoot, toolchain[key].artifact);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.cp(hashes[key].file, target);
    }
    const manifest = renderManifest({
        version,
        createdAt: lineage.createdAt,
        sourceCommit: sourceSha,
        exportFileCount: exported.fileCount,
        lineage,
        cmajor,
        choc,
        toolchain,
        hashes,
    });
    await writeJson(path.join(feedRoot, "manifest.json"), manifest);

    // 6. Publish additively, preserving every older versioned object.
    if (dryRun) {
        dry("Would copy the feed additively and verify every staged object (older objects are never deleted).");
        log(await describeLayout(stagingRoot));
        log(`Dry run complete; staging kept at ${stagingRoot}`);
    } else {
        assertSourceState(sourceSha, await getSourceState());
        await publishObjects(feedRoot, destination);
        log("Copied and verified the release objects without deleting older versions.");
        log(`Released Builder Kit ${version} (${lineage.tag}); staging kept at ${stagingRoot}`);
    }

    return { stagingRoot, exportRoot, feedRoot, lineage, lineageDir, manifest, hashes };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const config = await readDestinationConfig(options.destinationConfig);
        const capability = readCapabilityFromKeychain({ service: config.keychainService });
        const destination = createReleaseDestination(config, capability);
        await runRelease(options, { destination });
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
