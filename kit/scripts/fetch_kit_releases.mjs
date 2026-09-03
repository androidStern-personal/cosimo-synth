// Fetch Builder Kit release tags into an isolated namespace without storing
// the capability-bearing feed URL in git config or exposing it in argv.

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { readFeedBaseUrl } from "./toolchain.mjs";
import { ensureRedacted, redact, reveal } from "./redacted.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const releaseRefRoot = "refs/kit/releases";

function runGit(root, args, { execute = spawnSync, env = process.env, label = "git operation" } = {}) {
    const result = execute("git", args, {
        cwd: root,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0) throw new Error(`${label} failed.`);
    return (result.stdout ?? "").trim();
}

function assertSafeStartingState(root, execute) {
    const branch = runGit(root, ["symbolic-ref", "--short", "--quiet", "HEAD"], {
        execute,
        label: "current branch check",
    });
    if (branch === "") throw new Error("Kit update requires an attached branch.");

    for (const stateName of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "rebase-merge", "rebase-apply"]) {
        const statePath = runGit(root, ["rev-parse", "--git-path", stateName], { execute, label: "repository state check" });
        if (existsSync(path.resolve(root, statePath))) {
            throw new Error("Finish or abandon the in-progress git operation before updating the kit.");
        }
    }

    const dirty = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"], {
        execute,
        label: "working tree check",
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
    root = defaultRoot,
    feedUrl: feedUrlInput = null,
    execute = spawnSync,
    log = () => {},
} = {}) {
    const branch = assertSafeStartingState(root, execute);
    const feedUrl = ensureRedacted(feedUrlInput ?? readFeedBaseUrl(path.join(root, "kit/feed.json")));
    if (reveal(feedUrl) === "") throw new Error("This checkout has no configured Builder Kit feed.");
    const remoteUrl = redact(`${reveal(feedUrl).replace(/\/+$/u, "")}/kit.git`);
    const env = {
        ...process.env,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "remote.kit-release.url",
        GIT_CONFIG_VALUE_0: reveal(remoteUrl),
    };

    runGit(root, [
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        "kit-release",
        `+refs/tags/v*:${releaseRefRoot}/v*`,
    ], { execute, env, label: "Builder Kit release fetch" });

    const tags = runGit(root, [
        "for-each-ref",
        "--sort=-version:refname",
        "--format=%(refname:strip=3)",
        releaseRefRoot,
    ], { execute, label: "Builder Kit release listing" }).split(/\r?\n/u).filter(Boolean);
    log(`Fetched ${tags.length} Builder Kit release${tags.length === 1 ? "" : "s"} into the isolated release namespace.`);
    return { branch, tags, refRoot: releaseRefRoot };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        const result = fetchKitReleases({ log: console.log });
        for (const tag of result.tags) console.log(tag);
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Builder Kit release fetch failed.");
        process.exitCode = 1;
    }
}
