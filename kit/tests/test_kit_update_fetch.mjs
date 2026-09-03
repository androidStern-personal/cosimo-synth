import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { fetchKitReleases, releaseRefForTag } from "../scripts/fetch_kit_releases.mjs";
import { redact } from "../scripts/redacted.mjs";

const kitRoot = path.resolve(import.meta.dirname, "..");

const git = (cwd, ...args) => execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
}).trim();

function commitFile(root, file, contents, message) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
    git(root, "add", file);
    git(root, "commit", "--quiet", "-m", message);
}

async function makeRepos() {
    const sentinel = "SENTINEL-CAPABILITY-KIT-UPDATE-DO-NOT-LOG";
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-update-fetch-"));
    const feedRoot = path.join(scratch, sentinel);
    const lineage = path.join(scratch, "lineage");
    const product = path.join(scratch, "product");
    await fs.mkdir(feedRoot, { recursive: true });
    await fs.mkdir(lineage);
    git(lineage, "init", "--quiet", "--initial-branch=main");
    git(lineage, "config", "user.email", "kit-test@example.invalid");
    git(lineage, "config", "user.name", "Kit Test");
    commitFile(lineage, "kit/version.txt", "0.1.0\n", "kit 0.1.0");
    git(lineage, "tag", "-a", "v0.1.0", "-m", "Builder Kit 0.1.0");
    commitFile(lineage, "kit/version.txt", "0.1.1\n", "kit 0.1.1");
    git(lineage, "tag", "-a", "v0.1.1", "-m", "Builder Kit 0.1.1");
    git(scratch, "clone", "--bare", "--quiet", lineage, path.join(feedRoot, "kit.git"));

    await fs.mkdir(product);
    git(product, "init", "--quiet", "--initial-branch=main");
    git(product, "config", "user.email", "product-test@example.invalid");
    git(product, "config", "user.name", "Product Test");
    commitFile(product, "product.txt", "customer\n", "customer product");
    git(product, "tag", "v0.1.1");
    return { scratch, feedRoot, product, sentinel };
}

test("kit update fetch is retryable, isolated from product tags, and keeps the feed out of argv", async () => {
    const { scratch, feedRoot, product, sentinel } = await makeRepos();
    const logs = [];
    const calls = [];
    const execute = (command, args, options) => {
        calls.push({ command, args });
        return spawnSync(command, args, options);
    };
    try {
        const first = fetchKitReleases({ root: product, feedUrl: redact(feedRoot), execute, log: (line) => logs.push(line) });
        const second = fetchKitReleases({ root: product, feedUrl: redact(feedRoot), execute, log: (line) => logs.push(line) });
        assert.deepEqual(first.tags, ["v0.1.1", "v0.1.0"]);
        assert.deepEqual(second.tags, first.tags);
        assert.equal(git(product, "rev-parse", "refs/tags/v0.1.1"), git(product, "rev-parse", "HEAD"), "customer tag is untouched");
        assert.notEqual(git(product, "rev-parse", releaseRefForTag("v0.1.1")), git(product, "rev-parse", "refs/tags/v0.1.1"));
        assert.throws(() => git(product, "config", "--get", "remote.kit-release.url"), "temporary remote must not persist");
        assert.equal(await fs.stat(path.join(product, ".git/FETCH_HEAD")).then(() => true, () => false), false, "feed URL must not persist in FETCH_HEAD");
        assert.equal(JSON.stringify(calls).includes(sentinel), false, "capability-bearing feed must not enter argv");
        assert.equal(JSON.stringify(first).includes(sentinel), false);
        assert.equal(logs.join("\n").includes(sentinel), false);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("kit update refuses tracked and untracked dirt before fetching", async () => {
    const { scratch, feedRoot, product } = await makeRepos();
    try {
        await fs.writeFile(path.join(product, "untracked.txt"), "do not stage me\n");
        assert.throws(
            () => fetchKitReleases({ root: product, feedUrl: redact(feedRoot) }),
            /requires a clean working tree, including untracked files/u,
        );
        assert.equal(git(product, "status", "--porcelain=v1", "--untracked-files=all"), "?? untracked.txt");
        assert.throws(() => git(product, "rev-parse", releaseRefForTag("v0.1.1")));
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("kit update failure diagnostics redact the feed capability", async () => {
    const { scratch, product, sentinel } = await makeRepos();
    try {
        let failure;
        try {
            fetchKitReleases({ root: product, feedUrl: redact(path.join(scratch, sentinel, "missing")) });
        } catch (error) {
            failure = error;
        }
        assert.ok(failure instanceof Error);
        assert.match(failure.message, /release fetch failed/u);
        assert.equal(failure.message.includes(sentinel), false);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("kit update guidance preserves dirty work and names only isolated release refs", async () => {
    const skill = await fs.readFile(path.join(kitRoot, "skills/kit-update/SKILL.md"), "utf8");
    const fetcher = await fs.readFile(path.join(kitRoot, "scripts/fetch_kit_releases.mjs"), "utf8");
    assert.doesNotMatch(skill, /git add -A/u);
    assert.doesNotMatch(skill, /git fetch .*--tags/u);
    assert.match(skill, /refs\/kit\/releases/u);
    assert.doesNotMatch(fetcher, /remote",\s*"(?:add|set-url)/u);
    assert.match(fetcher, /--no-tags/u);
    assert.match(fetcher, /--no-write-fetch-head/u);
});
