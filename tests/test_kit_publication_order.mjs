import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createBareMirror, publishReleaseObjects } from "../scripts/release_builder_kit.mjs";
import { redact } from "../kit/scripts/redacted.mjs";

const env = { ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid", GIT_TERMINAL_PROMPT: "0" };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gitAsync = async (cwd, ...args) => (await promisify(execFile)("git", args, { cwd, env })).stdout.trim();

function files(root, prefix = "") {
    const result = [];
    for (const entry of readdirSync(path.join(root, prefix), { withFileTypes: true })) {
        const relative = path.posix.join(prefix, entry.name);
        if (entry.isDirectory()) result.push(...files(root, relative));
        else result.push(relative);
    }
    return result.sort();
}

async function init(root, content) {
    await fs.mkdir(root);
    git(root, "init", "--quiet", "--initial-branch=main");
    await fs.writeFile(path.join(root, "payload.txt"), content);
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", content);
    return git(root, "rev-parse", "HEAD");
}

// A recording object store with actual byte verification and partial-write failures.
function objectStoreRun(remote, failAt = null) {
    let objectsVerified = false;
    let packsVerified = false;
    let refsVerified = false;
    return (command, args, options) => {
        assert.equal(command, "rclone");
        if (args[0] === "lsf") return files(remote).filter((file) => file.endsWith("/objects/info/packs")).join("\n");
        if (args[0] === "cat") return readFileSync(path.join(remote, args[1].split(":")[1]), "utf8");
        const source = args.at(-2);
        const entries = files(source);
        // Deliberately schedule refs first if a publisher mixes them with objects.
        entries.sort((a, b) => Number(b.endsWith("info/refs")) - Number(a.endsWith("info/refs")));
        const label = options.label;
        if (args[0] === "check" && label === failAt) throw new Error(`injected ${label}`);
        for (const file of entries) {
            const bytes = readFileSync(path.join(source, file));
            if (file.endsWith("info/refs")) {
                assert.equal(objectsVerified, true, "refs must never precede verified immutable objects and tools");
                assert.equal(packsVerified, true, "refs must never precede verified pack discovery");
            }
            if (file === "manifest.json") assert.equal(refsVerified, true, "manifest is the final publication step");
            const target = path.join(remote, file);
            if (args[0] === "copy") {
                if (args.includes("--immutable")) {
                    const prior = existsSync(target) ? readFileSync(target) : null;
                    if (prior !== null) assert.deepEqual(prior, bytes, "immutable paths cannot be overwritten");
                }
                mkdirSync(path.dirname(target), { recursive: true });
                writeFileSync(target, bytes);
                if (label === failAt) throw new Error(`injected ${label}`);
            } else {
                assert.equal(args[0], "check");
                assert.equal(args.includes("--download"), true, "verify bytes even if the remote has no compatible checksum");
                assert.deepEqual(readFileSync(target), bytes);
            }
        }
        if (args[0] === "check") {
            if (label === "immutable objects verification") objectsVerified = true;
            if (label === "pack discovery verification") packsVerified = true;
            if (label === "Git refs verification") refsVerified = true;
        }
        return "";
    };
}

test("interrupted publication and repacking preserve cold old-tag clients and advertise new releases only after verified payloads", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-publish-order-"));
    let server;
    try {
        const lineage = path.join(scratch, "lineage");
        await init(lineage, "old kit");
        git(lineage, "tag", "v0.1.0");
        const oldSource = path.join(scratch, "old-source");
        const oldSourceCommit = await init(oldSource, "old source pin");
        const newSource = path.join(scratch, "new-source");
        await init(newSource, "unrelated new source");
        const oldFeed = path.join(scratch, "old-feed");
        const newFeed = path.join(scratch, "new-feed");
        for (const root of [oldFeed, newFeed]) await fs.mkdir(root);
        createBareMirror(lineage, path.join(oldFeed, "kit.git"));
        createBareMirror(oldSource, path.join(oldFeed, "cmajor.git"));
        assert.equal(files(oldFeed).some((file) => /^cmajor\.git\/objects\/[0-9a-f]{2}\//u.test(file)), false, "old source retrieval must require pack discovery, not loose objects");
        await fs.writeFile(path.join(lineage, "payload.txt"), "new kit");
        git(lineage, "commit", "--quiet", "-am", "new");
        git(lineage, "tag", "v0.1.1");
        createBareMirror(lineage, path.join(newFeed, "kit.git"));
        createBareMirror(newSource, path.join(newFeed, "cmajor.git"));
        for (const [root, version] of [[oldFeed, "0.1.0"], [newFeed, "0.1.1"]]) {
            await fs.mkdir(path.join(root, `tools/v${version}`), { recursive: true });
            await fs.writeFile(path.join(root, `tools/v${version}/cmaj.tar.gz`), `tool ${version}`);
            await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify({ version }));
        }
        let servedRoot;
        server = http.createServer(async (request, response) => {
            try {
                const relative = new URL(request.url, "http://localhost").pathname;
                const file = path.resolve(servedRoot, `.${relative}`);
                if (!file.startsWith(`${servedRoot}${path.sep}`)) throw new Error("outside fixture");
                response.end(await fs.readFile(file));
            } catch { response.statusCode = 404; response.end(); }
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const origin = `http://127.0.0.1:${server.address().port}`;
        const coldFetch = async (repo, ref, expected) => {
            const client = await fs.mkdtemp(path.join(scratch, "cold-client-"));
            await gitAsync(client, "init", "--quiet");
            await gitAsync(client, "-c", "http.proxy=", "fetch", "--quiet", `${origin}/${repo}`, ref);
            assert.equal(await gitAsync(client, "show", "FETCH_HEAD:payload.txt"), expected);
        };
        const failurePoints = ["immutable objects copy", "immutable objects verification", "pack discovery copy", "pack discovery verification", "Git refs copy", "Git refs verification", "manifest copy", "manifest verification"];
        for (const [index, failAt] of failurePoints.entries()) {
            servedRoot = path.join(scratch, `remote-${index}`);
            await fs.cp(oldFeed, servedRoot, { recursive: true });
            const destination = { r2Target: redact(servedRoot) };
            await assert.rejects(async () => publishReleaseObjects(newFeed, destination, { run: objectStoreRun(servedRoot, failAt) }), /injected/u);
            await coldFetch("kit.git", "refs/tags/v0.1.0", "old kit");
            await coldFetch("cmajor.git", oldSourceCommit, "old source pin");
            assert.equal(await (await fetch(`${origin}/tools/v0.1.0/cmaj.tar.gz`)).text(), "tool 0.1.0");
            const refs = await fs.readFile(path.join(servedRoot, "kit.git/info/refs"), "utf8");
            if (failAt.startsWith("immutable") || failAt.startsWith("pack")) {
                assert.equal(refs.includes("v0.1.1"), false);
                assert.equal(JSON.parse(await fs.readFile(path.join(servedRoot, "manifest.json"))).version, "0.1.0");
            }
            if (refs.includes("v0.1.1")) {
                await coldFetch("kit.git", "refs/tags/v0.1.1", "new kit");
                assert.equal(await (await fetch(`${origin}/tools/v0.1.1/cmaj.tar.gz`)).text(), "tool 0.1.1");
            }
            await publishReleaseObjects(newFeed, destination, { run: objectStoreRun(servedRoot) });
            await publishReleaseObjects(newFeed, destination, { run: objectStoreRun(servedRoot) });
            await coldFetch("kit.git", "refs/tags/v0.1.0", "old kit");
            await coldFetch("kit.git", "refs/tags/v0.1.1", "new kit");
            await coldFetch("cmajor.git", oldSourceCommit, "old source pin");
            const packs = await fs.readFile(path.join(servedRoot, "cmajor.git/objects/info/packs"), "utf8");
            for (const root of [oldFeed, newFeed])
                assert.equal(packs.includes((await fs.readFile(path.join(root, "cmajor.git/objects/info/packs"), "utf8")).trim()), true);
        }
    } finally {
        if (server) await new Promise((resolve) => server.close(resolve));
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
