// Builder Kit release (plan 5.2, Andrew-side; not exported). Turns the
// current monorepo state into one customer-facing release on the static feed:
//
//   1. export the kit to a staging dir with the feed URL stamped in
//      kit/feed.json, run the export gates, and prove a second copy
//      (proveExport: Enhancer Lite build, kit unit tests, update-flow merge);
//   2. on macOS build the pinned `cmaj` and the JIT dev loader
//      `CmajPlugin.vst3`, archive them, hash them, and record the hashes in
//      the staged kit/toolchain.json;
//   3. commit the staged tree into the lineage clone (builder-kit-releases)
//      as "Builder Kit <version>" and tag it v<version>;
//   4. create bare mirrors of the lineage, the Cmajor fork, and the CHOC fork
//      at the pinned commits, `git update-server-info` them for dumb-HTTP
//      serving, and verify the Cmajor mirror's .gitmodules points at CHOC
//      with a relative URL (so customers never leave the feed);
//   5. rclone-sync mirrors + tools + manifest.json to the R2 prefix.
//
// Usage:
//   node scripts/release_builder_kit.mjs --version <semver> --feed-url <base incl. secret>
//       --lineage <path to builder-kit-releases clone> --r2 <rclone remote:bucket/prefix>
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

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const usage = [
    "Usage: node scripts/release_builder_kit.mjs --version <semver> --feed-url <base incl. secret>",
    "         --lineage <builder-kit-releases clone> --r2 <rclone remote:bucket/prefix>",
    "         [--dry-run] [--skip-tools] [--tools-dir <dir>] [--staging <dir>]",
    "         [--cmajor-source <url|path>] [--choc-source <url|path>]",
    "",
    "  --dry-run       local steps only (no push, no rclone, no tool builds off macOS); prints the staging layout",
    "                  (--r2 none is accepted in a dry run: no sync target)",
    "  --skip-tools    do not build cmaj/CmajPlugin.vst3; a real release then needs --tools-dir with the archives",
    "  --tools-dir     directory holding prebuilt tool archives named as in kit/toolchain.json",
    "  --staging       staging directory (default: a fresh dir under the OS temp dir); must be outside the monorepo",
    "  --cmajor-source / --choc-source",
    "                  override where the cmajor/choc mirrors are cloned from (default: the pinned fork URLs)",
].join("\n");

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const shaPattern = /^[0-9a-f]{40}$/;

// ---------------------------------------------------------------------------
// Arguments

export function parseArgs(argv) {
    const options = {
        version: null,
        feedUrl: null,
        lineage: null,
        r2: null,
        dryRun: false,
        skipTools: false,
        toolsDir: null,
        staging: null,
        cmajorSource: null,
        chocSource: null,
    };
    const valueFlags = {
        "--version": "version",
        "--feed-url": "feedUrl",
        "--lineage": "lineage",
        "--r2": "r2",
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
            throw new Error(`Unknown argument: ${arg}\n${usage}`);
        }
    }

    if (!options.version || !semverPattern.test(options.version)) {
        throw new Error(`--version must be a semver like 1.2.0 (got ${options.version ?? "nothing"}).\n${usage}`);
    }
    if (!options.feedUrl || !/^https?:\/\/[^/]+\/.+/.test(options.feedUrl)) {
        throw new Error(`--feed-url must be an absolute http(s) URL with a path (the cohort secret).\n${usage}`);
    }
    options.feedUrl = options.feedUrl.replace(/\/+$/, "");
    if (options.r2 === "none") options.r2 = null; // explicit "no R2 target" for a dry run
    if (!options.dryRun) {
        if (!options.lineage) throw new Error(`--lineage is required for a real release.\n${usage}`);
        if (!options.r2) throw new Error(`--r2 is required for a real release.\n${usage}`);
        if (options.skipTools && !options.toolsDir) {
            throw new Error("--skip-tools on a real release needs --tools-dir with the prebuilt archives.");
        }
    }
    if (options.r2) {
        options.r2 = options.r2.replace(/\/+$/, "");
        if (!/^[^:/\s]+:[^\s]+$/.test(options.r2)) {
            throw new Error(`--r2 must look like remote:bucket/prefix (got ${options.r2}).`);
        }
    }
    for (const key of ["lineage", "toolsDir", "staging"]) {
        if (options[key]) options[key] = path.resolve(options[key]);
    }
    if (options.staging && (options.staging === repoRoot || options.staging.startsWith(repoRoot + path.sep))) {
        throw new Error("--staging must be outside the monorepo (the export refuses to write inside it).");
    }
    return options;
}

/** The feed URL and the R2 prefix must end in the same cohort segment. */
export function assertFeedMatchesPrefix(feedUrl, r2) {
    const feedTail = feedUrl.replace(/\/+$/, "").split("/").pop();
    const prefixTail = r2.replace(/\/+$/, "").split("/").pop();
    if (feedTail !== prefixTail) {
        throw new Error(
            `--feed-url ends in "${feedTail}" but --r2 ends in "${prefixTail}"; customers read <feed-url>/kit.git, so both must name the same cohort path.`,
        );
    }
}

// ---------------------------------------------------------------------------
// Small helpers

export function runCommand(command, args, { cwd = repoRoot, env = process.env } = {}) {
    try {
        return execFileSync(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    } catch (error) {
        const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
        throw new Error(`${command} ${args.join(" ")} failed in ${cwd}${output ? `:\n${output}` : "."}`);
    }
}

const git = (cwd, ...args) => runCommand("git", args, { cwd }).trim();

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
    const tag = block[1].match(/GIT_TAG\s+"([0-9a-f]{40})"/);
    if (!tag) throw new Error("CosimoDependencies.cmake: cosimo_cmajor GIT_TAG must be a full 40-hex commit.");

    let url = block[1].match(/GIT_REPOSITORY\s+"(https?:\/\/[^"]+)"/)?.[1] ?? null;
    if (!url) {
        const sourcesPath = path.join(kitRoot, "cmake/dependency-sources.cmake");
        if (existsSync(sourcesPath)) {
            const sources = await fs.readFile(sourcesPath, "utf8");
            url = sources.match(/set\(COSIMO_CMAJOR_GIT_URL\s+"([^"]+)"\)/)?.[1] ?? null;
        }
    }
    if (!url) throw new Error("Could not find the Cmajor fork URL (GIT_REPOSITORY or COSIMO_CMAJOR_GIT_URL) under kit/cmake.");
    return { commit: tag[1], url };
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
            if (base.length <= 1) throw new Error(`Cannot resolve ${relativeUrl} against ${superprojectUrl}.`);
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

/** Replace the lineage clone's working tree with the export and commit + tag it. */
export async function commitRelease(lineageDir, exportRoot, version) {
    const tag = `v${version}`;
    if (!existsSync(path.join(lineageDir, ".git"))) throw new Error(`${lineageDir} is not a git clone.`);
    if (git(lineageDir, "status", "--porcelain")) throw new Error(`Lineage clone ${lineageDir} has uncommitted changes.`);
    // symbolic-ref (not rev-parse) so a freshly created lineage repo with no
    // commits yet (unborn HEAD, the first release) still names its branch.
    let branch;
    try {
        branch = git(lineageDir, "symbolic-ref", "--short", "--quiet", "HEAD");
    } catch {
        throw new Error(`Lineage clone ${lineageDir} is on a detached HEAD.`);
    }
    if (git(lineageDir, "tag", "--list", tag)) throw new Error(`Tag ${tag} already exists in ${lineageDir}.`);

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
    return { commit: git(lineageDir, "rev-parse", "HEAD"), tag, branch };
}

// ---------------------------------------------------------------------------
// Tools

export function toolArchiveName(toolchain, key) {
    return path.posix.basename(toolchain[key].artifact);
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

    const pluginBuildDir = path.join(repoRoot, "build/cmajplugin_vst3");
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
            lines.push("  feed/                      (rclone sync source → <r2 prefix>)");
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

async function stampFeed(exportRoot, feedUrl, log) {
    const feedPath = path.join(exportRoot, "kit/feed.json");
    const feed = await readJson(feedPath);
    const previous = feed.baseUrl;
    if (previous !== feedUrl) {
        feed.baseUrl = feedUrl;
        await writeJson(feedPath, feed);
        log(`Stamped ${feedUrl} into kit/feed.json (exportKit left it as "${previous}").`);
    }
}

export async function runRelease(options, {
    platform = process.platform,
    log = console.log,
    exportKit = defaultExportKit,
    proveExport = defaultProveExport,
    now = () => new Date(),
} = {}) {
    const { version, feedUrl, dryRun, skipTools } = options;
    const dry = (message) => log(`[dry-run] ${message}`);

    // Preflight.
    if (options.r2) assertFeedMatchesPrefix(feedUrl, options.r2);
    if (!dryRun && platform !== "darwin" && !skipTools) {
        throw new Error("A real release builds cmaj and CmajPlugin.vst3, which needs macOS. Use --dry-run here, or --skip-tools with --tools-dir.");
    }
    if (!dryRun) runCommand("rclone", ["version"]);
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
    const exported = await exportKit(exportRoot, { force: true, feedUrl });
    await stampFeed(exportRoot, feedUrl, log);
    log(`Exported ${exported.fileCount} files from ${exported.sourceCommit.slice(0, 9)}`);
    await exportKit(proofRoot, { force: true, feedUrl });
    await stampFeed(proofRoot, feedUrl, () => {});
    await proveExport(proofRoot);
    log("Export proof passed (enhancer-lite build, kit unit tests, update-flow merge).");

    // The pin comes from the exported kit (what customers receive is what we
    // mirror). The export points COSIMO_CMAJOR_GIT_URL at the feed's own
    // cmajor.git, so the mirror's source is the upstream fork the monorepo
    // declares.
    const cmajor = await readCmajorPin(path.join(exportRoot, "kit"));
    if (cmajor.url === `${feedUrl}/cmajor.git`) {
        cmajor.url = (await readCmajorPin()).url;
    }
    const toolchain = await readJson(path.join(exportRoot, "kit/toolchain.json"));
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
                await fs.cp(hashes[key].file, path.join(toolsDir, path.basename(hashes[key].file)));
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
    log(`Committed ${lineage.commit.slice(0, 9)} and tagged ${lineage.tag} on ${lineage.branch} in ${lineageDir}`);
    if (dryRun) {
        dry(`Would push ${lineage.branch} and ${lineage.tag} to the lineage origin.`);
    } else {
        git(lineageDir, "push", "--quiet", "origin", lineage.branch, lineage.tag);
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
        dry(`Would mirror cmajor.git from ${cmajorSource} at ${cmajor.commit} and verify its relative CHOC submodule URL.`);
        dry("Would mirror choc.git from the URL that the cmajor .gitmodules resolves to.");
    } else {
        createBareMirror(cmajorSource, cmajorMirror);
        assertCommitPresent(cmajorMirror, cmajor.commit, "cmajor");
        const submodule = verifyRelativeChocSubmodule(cmajorMirror, cmajor.commit);
        log(`Mirrored cmajor.git; .gitmodules CHOC url "${submodule.url}" is relative (choc pin ${submodule.chocCommit.slice(0, 9)})`);

        const chocSource = options.chocSource ?? resolveRelativeGitUrl(cmajorSource, submodule.url);
        const chocMirror = path.join(feedRoot, "choc.git");
        if (dryRun && !isLocalSource(chocSource)) {
            dry(`Would mirror choc.git from ${chocSource} at ${submodule.chocCommit}.`);
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
        createdAt: now().toISOString(),
        sourceCommit: exported.sourceCommit,
        exportFileCount: exported.fileCount,
        lineage,
        cmajor,
        choc,
        toolchain,
        hashes,
    });
    await writeJson(path.join(feedRoot, "manifest.json"), manifest);

    // 6. Sync.
    const rcloneArgs = ["sync", "--transfers", "8", feedRoot, options.r2 ?? "<remote:bucket/prefix>"];
    if (dryRun) {
        dry(`Would run: rclone ${rcloneArgs.join(" ")}`);
        log(await describeLayout(stagingRoot));
        log(`Dry run complete; staging kept at ${stagingRoot}`);
    } else {
        runCommand("rclone", rcloneArgs);
        log(`Synced ${feedRoot} to ${options.r2}`);
        log(`Released Builder Kit ${version} (${lineage.tag}) at ${feedUrl}; staging kept at ${stagingRoot}`);
    }

    return { stagingRoot, exportRoot, feedRoot, lineage, lineageDir, manifest, hashes };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        await runRelease(parseArgs(process.argv.slice(2)));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
