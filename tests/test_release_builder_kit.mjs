import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
    assertFeedMatchesPrefix,
    commitRelease,
    createBareMirror,
    describeLayout,
    packageToolArtifacts,
    parseArgs,
    parseGitmodules,
    readCmajorPin,
    renderManifest,
    renderToolchain,
    repoRoot,
    resolveRelativeGitUrl,
    runRelease,
    verifyRelativeChocSubmodule,
} from "../scripts/release_builder_kit.mjs";

// Commits in test repos need an identity even on machines without a global one.
Object.assign(process.env, {
    GIT_AUTHOR_NAME: "Release Test",
    GIT_AUTHOR_EMAIL: "release-test@example.invalid",
    GIT_COMMITTER_NAME: "Release Test",
    GIT_COMMITTER_EMAIL: "release-test@example.invalid",
});

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

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
function fakeExportKit(files = {}, { cmajorCommit, cmajorUrl, toolchainForkCommit = cmajorCommit } = {}) {
    return async (outputDir, { feedUrl } = {}) => {
        await fs.rm(outputDir, { recursive: true, force: true });
        await fs.mkdir(path.join(outputDir, "kit/cmake"), { recursive: true });
        await fs.cp(path.join(repoRoot, "kit/feed.json"), path.join(outputDir, "kit/feed.json"));
        const toolchain = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/toolchain.json"), "utf8"));
        toolchain.cmaj.forkCommit = toolchainForkCommit;
        await fs.writeFile(path.join(outputDir, "kit/toolchain.json"), `${JSON.stringify(toolchain, null, 2)}\n`);
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
        return { outputRoot: outputDir, fileCount: 5 + Object.keys(files).length, sourceCommit: "a".repeat(40) };
    };
}

test("parse_args_validates_the_release_contract", () => {
    const full = parseArgs([
        "--version", "1.2.3", "--feed-url", "https://feed.example/s3cr3t/", "--lineage", "/tmp/lineage",
        "--r2", "r2:kit-feed/s3cr3t/", "--skip-tools", "--tools-dir", "/tmp/tools",
    ]);
    assert.equal(full.feedUrl, "https://feed.example/s3cr3t");
    assert.equal(full.r2, "r2:kit-feed/s3cr3t");
    assert.equal(full.lineage, "/tmp/lineage");
    assert.equal(full.skipTools, true);
    assert.equal(full.dryRun, false);

    const dry = parseArgs(["--version", "0.1.0-beta.1", "--feed-url", "https://feed.example/x", "--dry-run"]);
    assert.equal(dry.dryRun, true);
    assert.equal(dry.lineage, null);

    assert.throws(() => parseArgs(["--version", "1.2", "--feed-url", "https://f/x", "--dry-run"]), /semver/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "feed.example/x", "--dry-run"]), /feed-url/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--lineage", "/l"]), /--r2 is required/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--lineage", "/l", "--r2", "none"]), /--r2 is required/);
    assert.equal(parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--r2", "none", "--dry-run"]).r2, null);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--lineage", "/l", "--r2", "r2:b/x", "--skip-tools"]), /--tools-dir/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--dry-run", "--bogus"]), /Unknown argument/);
    assert.throws(() => parseArgs(["--version", "1.2.3", "--feed-url", "https://f/x", "--dry-run", "--staging", path.join(repoRoot, "build/x")]), /outside the monorepo/);

    assert.doesNotThrow(() => assertFeedMatchesPrefix("https://feed.example/cohort-1", "r2:bucket/cohort-1"));
    assert.throws(() => assertFeedMatchesPrefix("https://feed.example/cohort-1", "r2:bucket/cohort-2"), /same cohort path/);
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
    assert.equal(manifest.tools.cmaj.artifact, "tools/cmaj-macos-arm64.tar.gz");
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

        await assert.rejects(commitRelease(lineage, exportRoot, "2.0.0"), /already exists/);
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

test("dry_run_stages_the_full_feed_layout_without_network", async () => {
    const scratch = await makeScratch("kit-release-dry-");
    try {
        const forks = await makeForkPair(path.join(scratch, "forks"));
        const staging = path.join(scratch, "staging");
        const lines = [];
        let proved = null;
        const feedUrl = "https://feed.example/cohort-abc";
        const options = parseArgs([
            "--version", "1.2.3", "--feed-url", `${feedUrl}/`, "--r2", "r2:kit-feed/cohort-abc",
            "--dry-run", "--staging", staging,
        ]);
        const result = await runRelease(options, {
            platform: "linux",
            log: (line) => lines.push(line),
            exportKit: fakeExportKit({ "kit/AGENTS.md": "# kit\n" }, { cmajorCommit: forks.cmajorCommit, cmajorUrl: forks.cmajorDir }),
            proveExport: async (root) => { proved = root; },
            now: () => new Date("2026-09-01T12:00:00Z"),
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
        assert.equal(manifest.createdAt, "2026-09-01T12:00:00.000Z");
        assert.equal(manifest.kit.commit, result.lineage.commit);
        assert.equal(manifest.cmajor.commit, forks.cmajorCommit);
        assert.equal(manifest.choc.commit, forks.chocCommit);
        assert.equal(manifest.choc.submoduleUrl, "../choc.git");
        assert.equal(manifest.tools.cmaj, null, "no tool builds on linux");
        assert.equal(existsSync(path.join(staging, "feed/tools")), false);

        const output = lines.join("\n");
        assert.match(output, /\[dry-run\] Would build cmaj/);
        assert.match(output, /\[dry-run\] Would push main and v1\.2\.3/);
        assert.match(output, /\[dry-run\] Would run: rclone sync .* r2:kit-feed\/cohort-abc/);
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
        const base = ["--version", "1.0.0", "--feed-url", "https://feed.example/c", "--dry-run", "--staging", path.join(scratch, "staging")];
        const deps = (exportKit) => ({ platform: "linux", log: () => {}, exportKit, proveExport: async () => {} });

        // The fork's CHOC submodule must use a relative URL.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: absolute.cmajorCommit, cmajorUrl: absolute.cmajorDir }))),
            /must be relative/,
        );

        // The mirrored fork must contain the pinned commit.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: "f".repeat(40), cmajorUrl: relative.cmajorDir }))),
            /does not contain the pinned commit/,
        );

        // kit/toolchain.json and the cmake pin must agree.
        await assert.rejects(
            runRelease(parseArgs(base), deps(fakeExportKit({}, { cmajorCommit: relative.cmajorCommit, cmajorUrl: relative.cmajorDir, toolchainForkCommit: "e".repeat(40) }))),
            /forkCommit/,
        );

        // The feed URL and the R2 prefix must name the same cohort path.
        await assert.rejects(
            runRelease(parseArgs([...base, "--r2", "r2:bucket/other"]), deps(fakeExportKit({}, { cmajorCommit: relative.cmajorCommit, cmajorUrl: relative.cmajorDir }))),
            /same cohort path/,
        );
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
