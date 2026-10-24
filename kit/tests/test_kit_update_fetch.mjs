import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { fetchKitReleases, releaseRefForTag } from "../scripts/fetch_kit_releases.mjs";

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
        const first = fetchKitReleases({ root: product, feedUrl: feedRoot, execute, log: (line) => logs.push(line) });
        const second = fetchKitReleases({ root: product, feedUrl: feedRoot, execute, log: (line) => logs.push(line) });
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
            () => fetchKitReleases({ root: product, feedUrl: feedRoot }),
            /requires a clean working tree, including untracked files/u,
        );
        assert.equal(git(product, "status", "--porcelain=v1", "--untracked-files=all"), "?? untracked.txt");
        assert.throws(() => git(product, "rev-parse", releaseRefForTag("v0.1.1")));
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("kit update failure diagnostics show git's reason without the feed URL", async () => {
    const { scratch, product, sentinel } = await makeRepos();
    try {
        let failure;
        try {
            fetchKitReleases({ root: product, feedUrl: path.join(scratch, sentinel, "missing") });
        } catch (error) {
            failure = error;
        }
        assert.ok(failure instanceof Error);
        assert.match(failure.message, /release fetch failed: .*<kit feed>/su);
        assert.equal(failure.message.includes(sentinel), false);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("kit update outside a git checkout names the fix", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-update-outside-"));
    try {
        assert.throws(() => fetchKitReleases({ root: scratch, feedUrl: scratch }), /is not a git checkout\. Run the kit update from your project folder/u);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
