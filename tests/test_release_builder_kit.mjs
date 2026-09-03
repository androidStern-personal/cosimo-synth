import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
    assertFeedMatchesPrefix,
    assertSourceState,
    assertVersionedToolArtifacts,
    commitRelease,
    createReleaseDestination,
    createBareMirror,
    describeLayout,
    packageToolArtifacts,
    parseArgs,
    parseGitmodules,
    publishReleaseObjects,
    pushReleaseAtomically,
    readCapabilityFromKeychain,
    readDestinationConfig,
    readCmajorPin,
    renderManifest,
    renderToolchain,
    repoRoot,
    resolveRelativeGitUrl,
    runRelease,
    runCommand,
    verifyRelativeChocSubmodule,
} from "../scripts/release_builder_kit.mjs";
import { redact } from "../kit/scripts/redacted.mjs";

// Commits in test repos need an identity even on machines without a global one.
Object.assign(process.env, {
    GIT_AUTHOR_NAME: "Release Test",
    GIT_AUTHOR_EMAIL: "release-test@example.invalid",
    GIT_COMMITTER_NAME: "Release Test",
    GIT_COMMITTER_EMAIL: "release-test@example.invalid",
});

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sourceSha = "a".repeat(40);
const destinationConfigPath = "/tmp/builder-kit-release-destination.json";

function testDestination(capability = "cohort-test") {
    return createReleaseDestination({
        feedOrigin: "https://feed.example.invalid",
        rcloneRoot: "r2:builder-kit",
    }, redact(capability));
}

const cleanSourceState = () => ({ sha: sourceSha, status: "" });

function dryArgs(version, staging, extra = []) {
    return [
        "--version", version,
        "--source-sha", sourceSha,
        "--destination-config", destinationConfigPath,
        "--dry-run",
        ...(staging ? ["--staging", staging] : []),
        ...extra,
    ];
}

async function makeScratch(prefix) {
    return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function initRepo(dir, files) {
    await fs.mkdir(dir, { recursive: true });
    git(dir, "init", "--quiet", "--initial-branch=main");
    for (const [relative, content] of Object.entries(files)) {
        await fs.mkdir(path.dirname(path.join(dir, relative)), { recursive: true });
        await fs.writeFile(path.join(dir, relative), content);
    }
    git(dir, "add", "-A");
    git(dir, "commit", "--quiet", "-m", "init");
    return git(dir, "rev-parse", "HEAD");
}

/** A choc repo plus a cmajor repo whose include/choc gitlink points at choc's HEAD. */
async function makeForkPair(root, chocUrl = "../choc.git") {
    const chocDir = path.join(root, "choc.git");
    const chocCommit = await initRepo(chocDir, { "choc/text/UTF8.h": "// choc\n" });
    const cmajorDir = path.join(root, "cmajor.git");
    await initRepo(cmajorDir, {
        ".gitmodules": `[submodule "include/choc"]\n\tpath = include/choc\n\turl = ${chocUrl}\n`,
        "CMakeLists.txt": "project(cmajor)\n",
    });
    git(cmajorDir, "update-index", "--add", "--cacheinfo", `160000,${chocCommit},include/choc`);
    git(cmajorDir, "commit", "--quiet", "-m", "add choc submodule");
    return { chocDir, chocCommit, cmajorDir, cmajorCommit: git(cmajorDir, "rev-parse", "HEAD") };
}

/**
 * Stand-in for exportKit: a tiny tree carrying the real feed/toolchain
 * contracts, with the Cmajor pin pointed at a test fork.
 */
function fakeExportKit(files = {}, {
    cmajorCommit,
    cmajorUrl,
    toolchainForkCommit = cmajorCommit,
    version = "1.2.3",
    exportedSourceCommit = sourceSha,
} = {}) {
    return async (outputDir, { feedUrl } = {}) => {
        await fs.rm(outputDir, { recursive: true, force: true });
        await fs.mkdir(path.join(outputDir, "kit/cmake"), { recursive: true });
        await fs.cp(path.join(repoRoot, "kit/feed.json"), path.join(outputDir, "kit/feed.json"));
        const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
        toolchain.cmaj.forkCommit = toolchainForkCommit;
        for (const key of ["cmaj", "cmajPlugin"]) {
            toolchain[key].artifact = `tools/v${version}/${path.posix.basename(toolchain[key].artifact)}`;
        }
        await fs.writeFile(path.join(outputDir, "kit/toolchain.json"), `${JSON.stringify(toolchain, null, 2)}\n`);
        await fs.writeFile(path.join(outputDir, "kit/kit.json"), `${JSON.stringify({ version })}\n`);
        await fs.writeFile(
            path.join(outputDir, "kit/cmake/CosimoDependencies.cmake"),
            `include("\${CMAKE_CURRENT_LIST_DIR}/dependency-sources.cmake")\nfunction(x)\n    CPMAddPackage(\n        NAME cosimo_cmajor\n        GIT_REPOSITORY "\${COSIMO_CMAJOR_GIT_URL}"\n        GIT_TAG "${cmajorCommit}"\n    )\nendfunction()\n`,
        );
        await fs.writeFile(path.join(outputDir, "kit/cmake/dependency-sources.cmake"), `set(COSIMO_CMAJOR_GIT_URL "${cmajorUrl}")\n`);
        await fs.writeFile(path.join(outputDir, "package.json"), '{ "name": "starter" }\n');
        await fs.writeFile(path.join(outputDir, "EXPORT_MANIFEST.json"), `{ "feedUrlSeen": ${JSON.stringify(feedUrl ?? null)} }\n`);
        for (const [relative, content] of Object.entries(files)) {
            await fs.mkdir(path.dirname(path.join(outputDir, relative)), { recursive: true });
            await fs.writeFile(path.join(outputDir, relative), content);
        }
        return { outputRoot: outputDir, fileCount: 6 + Object.keys(files).length, sourceCommit: exportedSourceCommit };
    };
}

test("parse_args_validates_the_release_contract", () => {
    const full = parseArgs([
        "--version", "1.2.3", "--source-sha", sourceSha, "--lineage", "/tmp/lineage",
        "--destination-config", destinationConfigPath, "--skip-tools", "--tools-dir", "/tmp/tools",
    ]);
    assert.equal(full.sourceSha, sourceSha);
    assert.equal(full.destinationConfig, destinationConfigPath);
    assert.equal(full.lineage, "/tmp/lineage");
    assert.equal(full.skipTools, true);
    assert.equal(full.dryRun, false);

    const dry = parseArgs(dryArgs("0.1.0-beta.1"));
    assert.equal(dry.dryRun, true);
    assert.equal(dry.lineage, null);

    assert.throws(() => parseArgs(dryArgs("1.2")), /semver/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--source-sha", "abc", "--destination-config", destinationConfigPath, "--dry-run"]), /full 40-hex/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--source-sha", sourceSha, "--dry-run"]), /destination-config/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--source-sha", sourceSha, "--destination-config", destinationConfigPath]), /--lineage is required/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--source-sha", sourceSha, "--destination-config", destinationConfigPath, "--lineage", "/l", "--skip-tools"]), /--tools-dir/);
    assert.throws(() => parseArgs([...dryArgs("1.2.3"), "--bogus"]), /Unknown.*argument/);
    assert.throws(() => parseArgs(dryArgs("1.2.3", path.join(repoRoot, "build/x"))), /outside the monorepo/);
    assert.throws(() => parseArgs([...dryArgs("1.2.3"), "--feed-url", "SECRET"]), /Unknown.*argument/);
    assert.throws(() => parseArgs([...dryArgs("1.2.3"), "--r2", "SECRET"]), /Unknown.*argument/);

    assert.doesNotThrow(() => assertFeedMatchesPrefix("https://feed.example/cohort-1", "r2:bucket/cohort-1"));
    assert.throws(() => assertFeedMatchesPrefix("https://feed.example/cohort-1", "r2:bucket/cohort-2"), /same cohort path/);
});

test("canonical kit CI runs doctor, setup, updater, and release contracts", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    const contracts = packageJson.scripts["test:kit:release-contracts"];
    assert.match(contracts, /test_kit_doctor_setup\.mjs/u);
    assert.match(contracts, /test_release_builder_kit\.mjs/u);
    assert.match(contracts, /test_kit_update_fetch\.mjs/u);
    const workflow = await fs.readFile(path.join(repoRoot, ".github/workflows/kit.yml"), "utf8");
    assert.match(workflow, /run: npm run test:kit:release-contracts/u);
});

test("release capability stays out of argv, JSON, logs, and subprocess failures", async () => {
    const sentinel = "SENTINEL-CAPABILITY-RELEASE-DO-NOT-LOG";
    const capability = readCapabilityFromKeychain({ execute: () => `${sentinel}\n` });
    const destination = testDestination(sentinel);
    assert.equal(String(capability), "[REDACTED]");
    assert.equal(JSON.stringify(destination).includes(sentinel), false);

    const configRoot = await makeScratch("kit-release-destination-");
    try {
        const configPath = path.join(configRoot, "destination.json");
        await fs.writeFile(configPath, JSON.stringify({
            feedOrigin: "https://feed.example.invalid",
            rcloneRoot: `r2:${sentinel}`,
        }));
        const config = await readDestinationConfig(configPath);
        assert.equal(JSON.stringify(config).includes(sentinel), false, "destination values are structurally redacted when read");
    } finally {
        await fs.rm(configRoot, { recursive: true, force: true });
    }

    const calls = [];
    publishReleaseObjects("/tmp/feed", destination, {
        run: (command, args, options) => calls.push({ command, args, env: options.env }),
    });
    assert.equal(JSON.stringify(calls.map(({ command, args }) => ({ command, args }))).includes(sentinel), false);
    assert.equal(calls.every((call) => call.env.RCLONE_CONFIG_BUILDERKITRELEASE_REMOTE.includes(sentinel)), true);
    assert.deepEqual(calls.map((call) => call.args[0]), ["copy", "check"]);
    assert.equal(calls.some((call) => call.args.includes("sync")), false);

    let failure;
    try {
        runCommand(process.execPath, ["-e", "process.stderr.write(process.env.RELEASE_SENTINEL); process.exit(1)"], {
            env: { ...process.env, RELEASE_SENTINEL: sentinel },
            label: "release subprocess",
        });
    } catch (error) {
        failure = error;
    }
    assert.ok(failure instanceof Error);
    assert.equal(failure.message, "release subprocess failed.");
    assert.equal(failure.message.includes(sentinel), false);
});

test("release source must match the requested sha and be clean including untracked files", () => {
    assert.doesNotThrow(() => assertSourceState(sourceSha, cleanSourceState()));
    assert.throws(() => assertSourceState(sourceSha, { sha: "b".repeat(40), status: "" }), /does not match --source-sha/u);
    assert.throws(() => assertSourceState(sourceSha, { sha: sourceSha, status: "?? untracked.txt" }), /including untracked files/u);
});

test("relative_git_urls_and_gitmodules_resolve_like_git", () => {
    assert.equal(resolveRelativeGitUrl("https://github.com/someone/cmajor.git", "../choc.git"), "https://github.com/someone/choc.git");
    assert.equal(resolveRelativeGitUrl("https://feed.example/secret/cmajor.git", "../choc.git"), "https://feed.example/secret/choc.git");
    assert.equal(resolveRelativeGitUrl("https://feed.example/secret/cmajor.git/", "./sub.git"), "https://feed.example/secret/cmajor.git/sub.git");
    assert.equal(resolveRelativeGitUrl("/tmp/forks/cmajor.git", "../choc.git"), "/tmp/forks/choc.git");
    assert.equal(resolveRelativeGitUrl("https://x/y.git", "https://other/choc.git"), "https://other/choc.git");

    const entries = parseGitmodules('[submodule "include/choc"]\n  path = include/choc\n  url = ../choc.git\n[submodule "other"]\n\tpath = other\n\turl = https://example/other.git\n');
    assert.deepEqual(entries, [
        { name: "include/choc", path: "include/choc", url: "../choc.git" },
        { name: "other", path: "other", url: "https://example/other.git" },
    ]);
});

test("cmajor_pin_matches_the_toolchain_contract", async () => {
    const pin = await readCmajorPin();
    const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
    assert.equal(pin.commit, toolchain.cmaj.forkCommit);
    assert.match(pin.url, /^https:\/\/.+cmajor\.git$/);
});

test("tool artifact paths are scoped to the exact kit release version", async () => {
    const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
    const kit = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/kit.json"), "utf8"));
    assert.doesNotThrow(() => assertVersionedToolArtifacts(toolchain, kit.version));
    assert.throws(() => assertVersionedToolArtifacts(toolchain, "99.0.0"), /current release/u);
    toolchain.cmaj.artifact = `tools/v${kit.version}/../older/cmaj.tar.gz`;
    assert.throws(() => assertVersionedToolArtifacts(toolchain, kit.version), /current release/u);
});

test("toolchain_and_manifest_render_release_hashes", async () => {
    const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
    const hashes = {
        cmaj: { file: "/x/cmaj-macos-arm64.tar.gz", sha256: "1".repeat(64), bytes: 10 },
        cmajPlugin: { file: "/x/CmajPlugin-macos-arm64.zip", sha256: "2".repeat(64), bytes: 20 },
    };
    const rendered = renderToolchain(toolchain, hashes);
    assert.equal(rendered.cmaj.sha256, "1".repeat(64));
    assert.equal(rendered.cmajPlugin.sha256, "2".repeat(64));
    assert.equal(rendered.cmaj.artifact, toolchain.cmaj.artifact);
    assert.equal(toolchain.cmaj.sha256, "", "renderToolchain must not mutate its input");

    const partial = renderToolchain(toolchain, {});
    assert.deepEqual(partial, toolchain);

    const manifest = renderManifest({
        version: "1.2.3",
        createdAt: "2026-09-01T00:00:00.000Z",
        sourceCommit: "c".repeat(40),
        exportFileCount: 102,
        lineage: { commit: "d".repeat(40), tag: "v1.2.3", branch: "main" },
        cmajor: { commit: toolchain.cmaj.forkCommit, url: "https://github.com/x/cmajor.git" },
        choc: { commit: "e".repeat(40), submoduleUrl: "../choc.git" },
        toolchain,
        hashes,
    });
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.tag, "v1.2.3");
    assert.equal(manifest.kit.commit, "d".repeat(40));
    assert.equal(manifest.cmajor.commit, toolchain.cmaj.forkCommit);
    assert.equal(manifest.choc.submoduleUrl, "../choc.git");
    assert.equal(manifest.tools.cmaj.artifact, "tools/v0.1.1/cmaj-macos-arm64.tar.gz");
    assert.equal(manifest.tools.cmaj.forkCommit, toolchain.cmaj.forkCommit);
    assert.equal(manifest.tools.cmajPlugin.sha256, "2".repeat(64));
    assert.equal(JSON.stringify(manifest).includes("github.com"), false, "manifest must not carry fork source URLs");

    const noTools = renderManifest({ version: "1.2.3", createdAt: "", sourceCommit: "", exportFileCount: 0, lineage: {}, cmajor: {}, choc: {}, toolchain, hashes: {} });
    assert.equal(noTools.tools.cmaj, null);
    assert.equal(noTools.tools.cmajPlugin, null);
});

test("tool_archives_follow_the_toolchain_names_and_hash", async () => {
    const scratch = await makeScratch("kit-release-tools-");
    try {
        const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
        const cmajBinary = path.join(scratch, "bin/cmaj");
        const vst3Bundle = path.join(scratch, "VST3/CmajPlugin.vst3");
        await fs.mkdir(path.dirname(cmajBinary), { recursive: true });
        await fs.writeFile(cmajBinary, "#!/bin/sh\necho cmaj\n");
        await fs.mkdir(path.join(vst3Bundle, "Contents/MacOS"), { recursive: true });
        await fs.writeFile(path.join(vst3Bundle, "Contents/MacOS/CmajPlugin"), "binary");

        const toolsDir = path.join(scratch, "tools");
        const hashes = await packageToolArtifacts({ cmajBinary, vst3Bundle, toolsDir, toolchain, platform: "linux" });
        assert.match(hashes.cmaj.sha256, /^[0-9a-f]{64}$/);
        assert.match(hashes.cmajPlugin.sha256, /^[0-9a-f]{64}$/);
        assert.equal(path.basename(hashes.cmaj.file), "cmaj-macos-arm64.tar.gz");
        assert.equal(path.basename(hashes.cmajPlugin.file), "CmajPlugin-macos-arm64.zip");
        const listing = execFileSync("tar", ["-tzf", hashes.cmaj.file], { encoding: "utf8" });
        assert.equal(listing.trim(), "cmaj");
        const zipListing = execFileSync("unzip", ["-Z1", hashes.cmajPlugin.file], { encoding: "utf8" });
        assert.equal(zipListing.includes("CmajPlugin.vst3/Contents/MacOS/CmajPlugin"), true);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("choc_submodule_url_must_be_relative", async () => {
    const scratch = await makeScratch("kit-release-forks-");
    try {
        const relative = await makeForkPair(path.join(scratch, "relative"));
        const relativeMirror = path.join(scratch, "relative-mirror.git");
        createBareMirror(relative.cmajorDir, relativeMirror);
        assert.equal(existsSync(path.join(relativeMirror, "info/refs")), true);
        assert.equal(existsSync(path.join(relativeMirror, "objects/info/packs")), true);
        const submodule = verifyRelativeChocSubmodule(relativeMirror, relative.cmajorCommit);
        assert.deepEqual(submodule, { path: "include/choc", url: "../choc.git", chocCommit: relative.chocCommit });

        const absolute = await makeForkPair(path.join(scratch, "absolute"), "https://github.com/Tracktion/choc.git");
        const absoluteMirror = path.join(scratch, "absolute-mirror.git");
        createBareMirror(absolute.cmajorDir, absoluteMirror);
        assert.throws(() => verifyRelativeChocSubmodule(absoluteMirror, absolute.cmajorCommit), /must be relative/);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("commit_release_replaces_the_lineage_tree_and_tags_it", async () => {
    const scratch = await makeScratch("kit-release-lineage-");
    try {
        const lineage = path.join(scratch, "lineage");
        await initRepo(lineage, { "kit/old.txt": "old\n", "fx/customer/plugin.txt": "never in a kit commit\n" });
        const exportRoot = path.join(scratch, "export");
        await fs.mkdir(path.join(exportRoot, "kit"), { recursive: true });
        await fs.writeFile(path.join(exportRoot, "kit/new.txt"), "new\n");
        await fs.symlink("../kit/new.txt", path.join(exportRoot, "link.txt"));

        const result = await commitRelease(lineage, exportRoot, "2.0.0");
        assert.equal(result.tag, "v2.0.0");
        assert.equal(result.branch, "main");
        assert.equal(git(lineage, "log", "-1", "--format=%s"), "Builder Kit 2.0.0");
        assert.deepEqual(git(lineage, "ls-tree", "-r", "--name-only", "HEAD").split("\n").sort(), ["kit/new.txt", "link.txt"]);
        assert.equal(git(lineage, "status", "--porcelain"), "");
        assert.equal(await fs.readlink(path.join(lineage, "link.txt")), "../kit/new.txt");

        const retry = await commitRelease(lineage, exportRoot, "2.0.0");
        assert.equal(retry.reused, true);
        assert.equal(retry.commit, result.commit);
        assert.equal(retry.createdAt, result.createdAt);
        await fs.writeFile(path.join(exportRoot, "kit/new.txt"), "different\n");
        await assert.rejects(commitRelease(lineage, exportRoot, "2.0.0"), /does not identify this exact exported release/);
        await fs.writeFile(path.join(exportRoot, "kit/new.txt"), "new\n");
        await fs.writeFile(path.join(lineage, "dirty.txt"), "x");
        await assert.rejects(commitRelease(lineage, exportRoot, "2.0.1"), /uncommitted/);

        // A freshly created lineage repo with no commits (the first release).
        const unborn = path.join(scratch, "unborn");
        git(scratch, "init", "--quiet", "--initial-branch=main", unborn);
        git(unborn, "config", "user.email", "test@example.invalid");
        git(unborn, "config", "user.name", "Test");
        const first = await commitRelease(unborn, exportRoot, "1.0.0");
        assert.equal(first.branch, "main");
        assert.equal(first.tag, "v1.0.0");
        assert.equal(git(unborn, "log", "-1", "--format=%s"), "Builder Kit 1.0.0");
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("lineage branch and tag publish atomically and identical remote retries are accepted", async () => {
    const scratch = await makeScratch("kit-release-atomic-");
    try {
        const lineage = path.join(scratch, "lineage");
        const oldCommit = await initRepo(lineage, { "kit/old.txt": "old\n" });
        const origin = path.join(scratch, "origin.git");
        git(scratch, "init", "--bare", "--quiet", origin);
        git(lineage, "remote", "add", "origin", origin);
        git(lineage, "push", "--quiet", "-u", "origin", "main");
        const exportRoot = path.join(scratch, "export");
        await fs.mkdir(path.join(exportRoot, "kit"), { recursive: true });
        await fs.writeFile(path.join(exportRoot, "kit/new.txt"), "new\n");
        const release = await commitRelease(lineage, exportRoot, "2.0.0");

        assert.deepEqual(pushReleaseAtomically(lineage, release), { reused: false });
        assert.equal(git(origin, "rev-parse", "refs/heads/main"), release.commit);
        assert.equal(git(origin, "rev-list", "-n", "1", "refs/tags/v2.0.0"), release.commit);
        assert.deepEqual(pushReleaseAtomically(lineage, release), { reused: true });

        git(origin, "update-ref", "refs/tags/v2.0.0", release.commit);
        assert.throws(() => pushReleaseAtomically(lineage, release), /different release state/u, "a lightweight tag at the same commit is not the same release tag");

        git(origin, "update-ref", "refs/tags/v2.0.0", oldCommit);
        assert.throws(() => pushReleaseAtomically(lineage, release), /different release state/u);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("release rejects version drift and source changes before publication", async () => {
    const scratch = await makeScratch("kit-release-preflight-");
    try {
        const forks = await makeForkPair(path.join(scratch, "forks"));
        const common = {
            platform: "linux",
            log: () => {},
            proveExport: async () => {},
            destination: testDestination(),
        };
        await assert.rejects(
            runRelease(parseArgs(dryArgs("1.2.3", path.join(scratch, "version-staging"))), {
                ...common,
                exportKit: fakeExportKit({}, {
                    cmajorCommit: forks.cmajorCommit,
                    cmajorUrl: forks.cmajorDir,
                    version: "1.2.4",
                }),
                getSourceState: cleanSourceState,
            }),
            /does not match exported kit\/kit\.json version/u,
        );

        let sourceChecks = 0;
        await assert.rejects(
            runRelease(parseArgs(dryArgs("1.2.3", path.join(scratch, "source-staging"))), {
                ...common,
                exportKit: fakeExportKit({}, { cmajorCommit: forks.cmajorCommit, cmajorUrl: forks.cmajorDir }),
                getSourceState: () => {
                    sourceChecks += 1;
                    return sourceChecks === 1 ? cleanSourceState() : { sha: sourceSha, status: "?? appeared-during-proof.txt" };
                },
            }),
            /not clean, including untracked files/u,
        );
        assert.equal(sourceChecks, 2, "source is rechecked immediately after proof");
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("release resumes before push, after push, and after a partial additive object copy", async () => {
    const scratch = await makeScratch("kit-release-resume-");
    try {
        const forks = await makeForkPair(path.join(scratch, "forks"));
        const lineage = path.join(scratch, "lineage");
        await initRepo(lineage, { "kit/old.txt": "old\n" });
        const origin = path.join(scratch, "origin.git");
        git(scratch, "init", "--bare", "--quiet", origin);
        git(lineage, "remote", "add", "origin", origin);
        git(lineage, "push", "--quiet", "-u", "origin", "main");

        const toolsDir = path.join(scratch, "tools");
        await fs.mkdir(toolsDir);
        const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
        for (const key of ["cmaj", "cmajPlugin"]) {
            await fs.writeFile(path.join(toolsDir, path.posix.basename(toolchain[key].artifact)), `${key} archive\n`);
        }
        const staging = path.join(scratch, "staging");
        const options = parseArgs([
            "--version", "1.2.3",
            "--source-sha", sourceSha,
            "--destination-config", destinationConfigPath,
            "--lineage", lineage,
            "--skip-tools",
            "--tools-dir", toolsDir,
            "--staging", staging,
            "--cmajor-source", forks.cmajorDir,
            "--choc-source", forks.chocDir,
        ]);
        const objectStore = path.join(scratch, "objects");
        await fs.mkdir(path.join(objectStore, "tools/v0.1.0"), { recursive: true });
        await fs.writeFile(path.join(objectStore, "tools/v0.1.0/old-tool.zip"), "old release\n");
        const dependencies = {
            platform: "linux",
            log: () => {},
            exportKit: fakeExportKit({}, { cmajorCommit: forks.cmajorCommit, cmajorUrl: forks.cmajorDir }),
            proveExport: async () => {},
            destination: testDestination(),
            getSourceState: cleanSourceState,
            checkPublisher: () => {},
        };

        await assert.rejects(
            runRelease(options, { ...dependencies, pushRelease: () => { throw new Error("simulated pre-push interruption"); } }),
            /simulated pre-push interruption/u,
        );
        assert.equal(git(lineage, "tag", "--list", "v1.2.3"), "v1.2.3", "local release is reusable");
        assert.throws(() => git(origin, "rev-parse", "refs/tags/v1.2.3"), "nothing was partially pushed");

        const retryOptions = parseArgs([
            "--version", "1.2.3",
            "--source-sha", sourceSha,
            "--destination-config", destinationConfigPath,
            "--lineage", lineage,
            "--skip-tools",
            "--tools-dir", path.join(staging, "tools"),
            "--staging", staging,
            "--cmajor-source", forks.cmajorDir,
            "--choc-source", forks.chocDir,
        ]);

        await assert.rejects(
            runRelease(retryOptions, {
                ...dependencies,
                publishObjects: async (feedRoot) => {
                    await fs.mkdir(path.join(objectStore, "tools/v1.2.3"), { recursive: true });
                    await fs.cp(
                        path.join(feedRoot, "tools/v1.2.3/cmaj-macos-arm64.tar.gz"),
                        path.join(objectStore, "tools/v1.2.3/cmaj-macos-arm64.tar.gz"),
                    );
                    throw new Error("simulated partial object copy");
                },
            }),
            /simulated partial object copy/u,
        );
        assert.equal(git(origin, "rev-list", "-n", "1", "refs/tags/v1.2.3"), git(lineage, "rev-parse", "HEAD"));
        const interruptedManifest = await fs.readFile(path.join(staging, "feed/manifest.json"), "utf8");

        const completed = await runRelease(retryOptions, {
            ...dependencies,
            publishObjects: async (feedRoot) => fs.cp(feedRoot, objectStore, { recursive: true, force: true }),
        });
        assert.equal(completed.lineage.reused, true);
        assert.equal(await fs.readFile(path.join(staging, "feed/manifest.json"), "utf8"), interruptedManifest);
        assert.equal(await fs.readFile(path.join(objectStore, "tools/v0.1.0/old-tool.zip"), "utf8"), "old release\n");
        assert.equal(existsSync(path.join(objectStore, "tools/v1.2.3/cmaj-macos-arm64.tar.gz")), true);
        assert.equal(existsSync(path.join(objectStore, "tools/v1.2.3/CmajPlugin-macos-arm64.zip")), true);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("dry_run_stages_the_full_feed_layout_without_network", async () => {
    const scratch = await makeScratch("kit-release-dry-");
    try {
        const forks = await makeForkPair(path.join(scratch, "forks"));
        const staging = path.join(scratch, "staging");
        const lines = [];
        let proved = null;
        const feedUrl = "https://feed.example.invalid/cohort-abc";
        const options = parseArgs(dryArgs("1.2.3", staging));
        const result = await runRelease(options, {
            platform: "linux",
            log: (line) => lines.push(line),
            exportKit: fakeExportKit({ "kit/AGENTS.md": "# kit\n" }, { cmajorCommit: forks.cmajorCommit, cmajorUrl: forks.cmajorDir }),
            proveExport: async (root) => { proved = root; },
            destination: testDestination("cohort-abc"),
            getSourceState: cleanSourceState,
        });

        assert.equal(result.stagingRoot, staging);
        assert.equal(proved, path.join(staging, "proof"));
        const feed = JSON.parse(await fs.readFile(path.join(staging, "export/kit/feed.json"), "utf8"));
        assert.equal(feed.baseUrl, feedUrl);
        const exportManifest = JSON.parse(await fs.readFile(path.join(staging, "export/EXPORT_MANIFEST.json"), "utf8"));
        assert.equal(exportManifest.feedUrlSeen, feedUrl, "exportKit receives the feed URL as an option");

        // Mirrors are bare, dumb-HTTP ready, and carry the release tag / pins.
        for (const mirror of ["kit.git", "cmajor.git", "choc.git"]) {
            assert.equal(existsSync(path.join(staging, "feed", mirror, "info/refs")), true, `${mirror} info/refs`);
        }
        const kitRefs = await fs.readFile(path.join(staging, "feed/kit.git/info/refs"), "utf8");
        assert.match(kitRefs, /refs\/tags\/v1\.2\.3/);
        assert.equal(git(path.join(staging, "feed/cmajor.git"), "rev-parse", "HEAD"), forks.cmajorCommit);
        assert.equal(git(path.join(staging, "feed/choc.git"), "rev-parse", "HEAD"), forks.chocCommit);

        // Lineage commit happened on the throwaway clone, tagged and committed.
        assert.equal(result.lineageDir, path.join(staging, "lineage"));
        assert.equal(git(result.lineageDir, "log", "-1", "--format=%s"), "Builder Kit 1.2.3");
        assert.equal(git(result.lineageDir, "tag", "--list", "v1.2.3"), "v1.2.3");
        assert.equal(await fs.readFile(path.join(result.lineageDir, "kit/AGENTS.md"), "utf8"), "# kit\n");

        const manifest = JSON.parse(await fs.readFile(path.join(staging, "feed/manifest.json"), "utf8"));
        assert.equal(manifest.version, "1.2.3");
        assert.equal(manifest.createdAt, result.lineage.createdAt);
        assert.equal(manifest.kit.commit, result.lineage.commit);
        assert.equal(manifest.cmajor.commit, forks.cmajorCommit);
        assert.equal(manifest.choc.commit, forks.chocCommit);
        assert.equal(manifest.choc.submoduleUrl, "../choc.git");
        assert.equal(manifest.tools.cmaj, null, "no tool builds on linux");
        assert.equal(existsSync(path.join(staging, "feed/tools")), false);

        const output = lines.join("\n");
        assert.match(output, /\[dry-run\] Would build cmaj/);
        assert.match(output, /\[dry-run\] Would atomically push main and v1\.2\.3/);
        assert.match(output, /copy the feed additively/u);
        assert.equal(output.includes("cohort-abc"), false, "release diagnostics must omit the capability");
        assert.match(output, /feed\//);
        assert.match(output, /kit\.git\/.*bare mirror/);
        assert.match(await describeLayout(staging), /manifest\.json/);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("dry_run_fails_on_pin_and_submodule_problems", async () => {
    const scratch = await makeScratch("kit-release-dry-fail-");
    try {
        const absolute = await makeForkPair(path.join(scratch, "absolute"), "https://github.com/Tracktion/choc.git");
        const relative = await makeForkPair(path.join(scratch, "relative"));
        const base = dryArgs("1.0.0", path.join(scratch, "staging"));
        const deps = (exportKit) => ({
            platform: "linux",
            log: () => {},
            exportKit,
            proveExport: async () => {},
            destination: testDestination("c"),
            getSourceState: cleanSourceState,
        });

        // The fork's CHOC submodule must use a relative URL.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: absolute.cmajorCommit, cmajorUrl: absolute.cmajorDir, version: "1.0.0" }))),
            /must be relative/,
        );

        // The mirrored fork must contain the pinned commit.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: "f".repeat(40), cmajorUrl: relative.cmajorDir, version: "1.0.0" }))),
            /does not contain the pinned commit/,
        );

        // kit/toolchain.json and the cmake pin must agree.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: relative.cmajorCommit, cmajorUrl: relative.cmajorDir, toolchainForkCommit: "e".repeat(40), version: "1.0.0" }))),
            /forkCommit/,
        );

        // The feed URL and the object prefix must name the same cohort path.
        await assert.rejects(
            runRelease(parseArgs(base), {
                ...deps(fakeExportKit({}, { cmajorCommit: relative.cmajorCommit, cmajorUrl: relative.cmajorDir, version: "1.0.0" })),
                destination: {
                    feedUrl: redact("https://feed.example.invalid/c"),
                    r2Target: redact("r2:bucket/other"),
                },
            }),
            /same cohort path/,
        );
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
