// Fetch Builder Kit release tags into an isolated namespace. The feed URL
// carries the delivery's access path, so it is handed to git through the
// environment (never argv or git config) and removed from git's messages.

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { isMainModule, projectRoot } from "./common.mjs";
import { readFeedBaseUrl } from "./toolchain.mjs";

export const releaseRefRoot = "refs/kit/releases";

function runGit(root, args, { execute = spawnSync, env = process.env, label, feedUrl = null } = {}) {
    const result = execute("git", args, {
        cwd: root,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error?.code === "ENOENT")
        throw new Error(`${label} failed: git was not found. Install the Xcode Command Line Tools (xcode-select --install), then retry.`);
    if (result.error || result.status !== 0) {
        let detail = (result.stderr || result.error?.message || "").trim();
        if (feedUrl)
            detail = detail.replaceAll(feedUrl, "<kit feed>");
        throw new Error(`${label} failed${detail ? `: ${detail}` : "."}`);
    }
    return (result.stdout ?? "").trim();
}

function assertSafeStartingState(root, execute) {
    const probe = (args) => execute("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    runGit(root, ["--version"], { execute, label: "Git check" });
    if (probe(["rev-parse", "--is-inside-work-tree"]).stdout?.trim() !== "true")
        throw new Error(`${root} is not a git checkout. Run the kit update from your project folder.`);
    const head = probe(["symbolic-ref", "--short", "--quiet", "HEAD"]);
    const branch = head.status === 0 ? (head.stdout ?? "").trim() : "";
    if (branch === "") throw new Error("Kit update requires an attached branch. Check out your working branch (git switch <branch>), then retry.");

    for (const stateName of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply"]) {
        const statePath = runGit(root, ["rev-parse", "--git-path", stateName], { execute, label: "Repository state check" });
        if (existsSync(path.resolve(root, statePath))) {
            throw new Error("Finish or abandon the in-progress git operation before updating the kit.");
        }
    }

    const dirty = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"], {
        execute,
        label: "Working tree check",
    });
    if (dirty !== "") {
        throw new Error("Kit update requires a clean working tree, including untracked files; commit or remove those changes first.");
    }
    return branch;
}

export function releaseRefForTag(tag) {
    if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(tag)) {
        throw new Error("Builder Kit release tags must be semantic versions beginning with v.");
    }
    return `${releaseRefRoot}/${tag}`;
}

export function fetchKitReleases({
    root = projectRoot,
    feedUrl = null,
    execute = spawnSync,
    log = () => {},
} = {}) {
    const branch = assertSafeStartingState(root, execute);
    const baseUrl = (feedUrl ?? readFeedBaseUrl(path.join(root, "kit/feed.json"))).replace(/\/+$/u, "");
    if (baseUrl === "")
        throw new Error("kit/feed.json has no feed URL, so there is nowhere to fetch releases from. Restore kit/feed.json from your delivery or contact support.");
    const env = {
        ...process.env,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "remote.kit-release.url",
        GIT_CONFIG_VALUE_0: `${baseUrl}/kit.git`,
    };

    runGit(root, [
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        "kit-release",
        `+refs/tags/v*:${releaseRefRoot}/v*`,
    ], { execute, env, label: "Builder Kit release fetch", feedUrl: baseUrl });

    const tags = runGit(root, [
        "for-each-ref",
        "--sort=-version:refname",
        "--format=%(refname:strip=3)",
        releaseRefRoot,
    ], { execute, label: "Builder Kit release listing" }).split(/\r?\n/u).filter(Boolean);
    log(`Fetched ${tags.length} Builder Kit release${tags.length === 1 ? "" : "s"} into the isolated release namespace.`);
    return { branch, tags, refRoot: releaseRefRoot };
}

if (isMainModule(import.meta.url)) {
    try {
        const result = fetchKitReleases({ log: console.log });
        for (const tag of result.tags) console.log(tag);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
