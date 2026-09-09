import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import {
    dependencyFingerprint,
    preserveLegacyPackageLock,
} from "../scripts/preserve_legacy_package_lock.mjs";
import { fetchKitReleases, releaseRefForTag } from "../scripts/fetch_kit_releases.mjs";
import { redact } from "../scripts/redacted.mjs";

const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_NAME: "Builder Kit Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Builder Kit Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

const git = (root, ...args) => execFileSync("git", args, {
    cwd: root,
    env: gitEnvironment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
}).trim();

const status = (root) => git(root, "status", "--porcelain=v1", "--untracked-files=all");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function writeTree(root, files) {
    for (const [relative, bytes] of Object.entries(files)) {
        const target = path.join(root, relative);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, bytes);
    }
}

async function makeLegacyFixture() {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-legacy-lock-"));
    const lineage = path.join(scratch, "lineage");
    const feed = path.join(scratch, "feed");
    const customer = path.join(scratch, "customer");
    const packageManifest = `${JSON.stringify({ name: "builder-kit-fixture", private: true, type: "module", devDependencies: {} }, null, 2)}\n`;
    const lock = `${JSON.stringify({
        name: "builder-kit-fixture",
        lockfileVersion: 3,
        requires: true,
        packages: { "": { name: "builder-kit-fixture", devDependencies: {} } },
    }, null, 2)}\n`;

    await fs.mkdir(lineage);
    git(lineage, "init", "--quiet", "--initial-branch=main");
    await writeTree(lineage, {
        "package.json": packageManifest,
        "kit/version.txt": "0.1.4\n",
        "fx/example/source.txt": "upstream example\n",
    });
    git(lineage, "add", ".");
    git(lineage, "commit", "--quiet", "-m", "Builder Kit 0.1.4");
    const oldCommit = git(lineage, "rev-parse", "HEAD");
    git(lineage, "tag", "-a", "v0.1.4", "-m", "Builder Kit 0.1.4");
    await fs.writeFile(path.join(lineage, "kit/version.txt"), "0.1.5\n");
    await fs.writeFile(path.join(lineage, "package-lock.json"), lock);
    git(lineage, "add", ".");
    git(lineage, "commit", "--quiet", "-m", "Builder Kit 0.1.5");
    git(lineage, "tag", "-a", "v0.1.5", "-m", "Builder Kit 0.1.5");

    await fs.mkdir(feed);
    git(feed, "clone", "--quiet", "--bare", lineage, "kit.git");
    git(scratch, "clone", "--quiet", lineage, customer);
    git(customer, "switch", "--quiet", "--create", "customer", "v0.1.4");
    await fs.appendFile(path.join(customer, "fx/example/source.txt"), "customer committed edit\n");
    git(customer, "commit", "--quiet", "-am", "Customer plugin edit");

    const state = path.join(customer, ".builder-kit-install");
    await fs.mkdir(state);
    await fs.appendFile(path.join(customer, ".git/info/exclude"), "/.builder-kit-install/\n");
    await fs.writeFile(path.join(state, "receipt"), `builder-kit-install-v1 ${oldCommit}\n`);
    await fs.writeFile(path.join(customer, "package-lock.json"), lock);
    await fs.writeFile(path.join(state, "npm-ready"), `${await dependencyFingerprint(customer)}\n`);
    assert.equal(status(customer), "?? package-lock.json");

    return {
        scratch,
        feed,
        customer,
        lock: Buffer.from(lock),
    };
}

test("receipt-matched 0.1.4 lock bridges the unchanged old fetch helper and preserves a customer commit", async () => {
    const fixture = await makeLegacyFixture();
    try {
        assert.throws(
            () => fetchKitReleases({ root: fixture.customer, feedUrl: redact(fixture.feed) }),
            /requires a clean working tree/u,
            "the actual shipped fetch guard is unreachable before preservation",
        );
        const result = await preserveLegacyPackageLock({ root: fixture.customer, log: () => {} });
        assert.equal(result.digest, sha256(fixture.lock));
        assert.equal(status(fixture.customer), "");
        assert.equal(existsSync(path.join(fixture.customer, "package-lock.json")), false);
        assert.deepEqual(await fs.readFile(path.join(fixture.customer, result.preservedRelative)), fixture.lock);

        const fetched = fetchKitReleases({ root: fixture.customer, feedUrl: redact(fixture.feed) });
        assert.deepEqual(fetched.tags, ["v0.1.5", "v0.1.4"]);
        git(fixture.customer, "merge", "--quiet", "--no-ff", "-m", "Update Builder Kit to v0.1.5", releaseRefForTag("v0.1.5"));
        assert.equal(status(fixture.customer), "");
        assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
        assert.match(await fs.readFile(path.join(fixture.customer, "fx/example/source.txt"), "utf8"), /customer committed edit/u);
    } finally {
        await fs.rm(fixture.scratch, { recursive: true, force: true });
    }
});

test("extra or altered customer work refuses before the generated lock moves", async (t) => {
    await t.test("untracked customer file", async () => {
        const fixture = await makeLegacyFixture();
        try {
            await fs.writeFile(path.join(fixture.customer, "customer-note.txt"), "keep me\n");
            await assert.rejects(preserveLegacyPackageLock({ root: fixture.customer, log: () => {} }), /only uncommitted path/u);
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
            assert.equal(await fs.readFile(path.join(fixture.customer, "customer-note.txt"), "utf8"), "keep me\n");
            assert.equal(existsSync(path.join(fixture.customer, ".builder-kit-install/update-preserved")), false);
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });

    await t.test("tracked customer edit", async () => {
        const fixture = await makeLegacyFixture();
        try {
            const source = path.join(fixture.customer, "fx/example/source.txt");
            await fs.appendFile(source, "uncommitted customer edit\n");
            const before = await fs.readFile(source);
            await assert.rejects(preserveLegacyPackageLock({ root: fixture.customer, log: () => {} }), /only uncommitted path/u);
            assert.deepEqual(await fs.readFile(source), before);
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });

    await t.test("lock changed after installer receipt", async () => {
        const fixture = await makeLegacyFixture();
        try {
            await fs.appendFile(path.join(fixture.customer, "package-lock.json"), "\n");
            const changed = await fs.readFile(path.join(fixture.customer, "package-lock.json"));
            await assert.rejects(preserveLegacyPackageLock({ root: fixture.customer, log: () => {} }), /does not match/u);
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), changed);
            assert.equal(existsSync(path.join(fixture.customer, ".builder-kit-install/update-preserved")), false);
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });

    await t.test("linked lock", async () => {
        const fixture = await makeLegacyFixture();
        try {
            const outside = path.join(fixture.scratch, "outside-lock.json");
            await fs.writeFile(outside, fixture.lock);
            await fs.rm(path.join(fixture.customer, "package-lock.json"));
            await fs.symlink(outside, path.join(fixture.customer, "package-lock.json"));
            await assert.rejects(preserveLegacyPackageLock({ root: fixture.customer, log: () => {} }), /linked or has an unexpected type/u);
            assert.deepEqual(await fs.readFile(outside), fixture.lock);
            assert.equal(await fs.readlink(path.join(fixture.customer, "package-lock.json")), outside);
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });
});

test("preservation is no-overwrite and a late dirty path restores a retryable source", async (t) => {
    await t.test("different existing backup", async () => {
        const fixture = await makeLegacyFixture();
        try {
            const preserved = path.join(
                fixture.customer,
                `.builder-kit-install/update-preserved/package-lock.${sha256(fixture.lock)}.json`,
            );
            await fs.mkdir(path.dirname(preserved));
            await fs.writeFile(preserved, "unrelated preserved bytes\n");
            await assert.rejects(preserveLegacyPackageLock({ root: fixture.customer, log: () => {} }), /no-overwrite/u);
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
            assert.equal(await fs.readFile(preserved, "utf8"), "unrelated preserved bytes\n");
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });

    await t.test("late customer path", async () => {
        const fixture = await makeLegacyFixture();
        try {
            let statusCalls = 0;
            const execute = (command, args, options) => {
                if (command === "git" && args[0] === "status" && ++statusCalls === 3)
                    writeFileSync(path.join(fixture.customer, "late-customer.txt"), "keep late work\n");
                return spawnSync(command, args, options);
            };
            await assert.rejects(
                preserveLegacyPackageLock({ root: fixture.customer, execute, log: () => {} }),
                /package-lock\.json was restored/u,
            );
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
            assert.equal(await fs.readFile(path.join(fixture.customer, "late-customer.txt"), "utf8"), "keep late work\n");

            await fs.rm(path.join(fixture.customer, "late-customer.txt"));
            const retry = await preserveLegacyPackageLock({ root: fixture.customer, log: () => {} });
            assert.equal(status(fixture.customer), "");
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, retry.preservedRelative)), fixture.lock);
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });

    await t.test("final Git status failure", async () => {
        const fixture = await makeLegacyFixture();
        try {
            let statusCalls = 0;
            const execute = (command, args, options) => {
                if (command === "git" && args[0] === "status" && ++statusCalls === 3)
                    return { status: 41, stdout: "", stderr: "untrusted Git failure detail" };
                return spawnSync(command, args, options);
            };
            await assert.rejects(
                preserveLegacyPackageLock({ root: fixture.customer, execute, log: () => {} }),
                /final working tree check failed; package-lock\.json was restored/u,
            );
            assert.deepEqual(await fs.readFile(path.join(fixture.customer, "package-lock.json")), fixture.lock);
            const preserved = path.join(
                fixture.customer,
                `.builder-kit-install/update-preserved/package-lock.${sha256(fixture.lock)}.json`,
            );
            assert.deepEqual(await fs.readFile(preserved), fixture.lock);
            assert.equal(status(fixture.customer), "?? package-lock.json");
        } finally {
            await fs.rm(fixture.scratch, { recursive: true, force: true });
        }
    });
});
