import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { renderBootstrap, renderInstallation, installationRuntimes, publicInstallationUrl } from "../scripts/builder-kit-install.mjs";
import { prepareInstallation } from "../scripts/prepare_builder_kit_install.mjs";
import { createBareMirror } from "../scripts/release_builder_kit.mjs";
import { redact, reveal } from "../kit/scripts/redacted.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const fixtureAccess = "fixture-access-not-a-customer-secret";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`;
async function shellProfileHashes() {
    const result = {};
    for (const name of [".zprofile", ".bash_profile"]) {
        try { result[name] = sha256(await fs.readFile(path.join(os.homedir(), name))); }
        catch (error) { if (error.code !== "ENOENT") throw error; result[name] = null; }
    }
    return result;
}
const gitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid", GIT_TERMINAL_PROMPT: "0" };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const manifestFor = (commit = "a".repeat(40)) => ({ schemaVersion: 1, version: "1.0.0", tag: "v1.0.0", kit: { repo: "kit.git", tag: "v1.0.0", commit }, tools: { cmaj: { sha256: "b".repeat(64) }, cmajPlugin: { sha256: "c".repeat(64) } } });

test("public entry preserves the existing v0.1.2 private installer render", async () => {
    const manifest = manifestFor();
    manifest.version = "0.1.2"; manifest.tag = "v0.1.2"; manifest.kit.tag = "v0.1.2";
    const result = await renderBootstrap({ manifest, feedOrigin: "https://downloads.example.invalid" });
    assert.equal(result.ok, true);
    // Captured by rendering these synthetic pins with the unchanged template
    // and original renderer at 4793cee50c9574239412a722e204473f7c59b717.
    assert.equal(result.value.sha256, "fc7fa69992c85fa0c46ad2755da85ec166267f8ef56ca57fded20d9813fa8f33");
});

test("delivery parsing enforces the approved short shape and rejects unpinned or unsafe inputs without revealing credentials", async () => {
    const options = { manifest: manifestFor(), feedOrigin: "https://downloads.example.invalid", capability: redact(fixtureAccess) };
    const bootstrap = await renderBootstrap(options);
    assert.equal(bootstrap.ok, true);
    options.manifest.installation = { artifact: bootstrap.value.artifact, sha256: bootstrap.value.sha256 };
    for (const changes of [
        { manifest: { ...manifestFor(), kit: { repo: "kit.git", tag: "v1.0.0", commit: "latest" } } },
        { manifest: { ...manifestFor(), tools: {} } },
        { manifest: manifestFor() },
        { manifest: { ...options.manifest, installation: { artifact: "installers/wrong.sh", sha256: "e".repeat(64) } } },
        { feedOrigin: "http://downloads.example.invalid" },
        { installerOrigin: "http://192.168.1.2:8000" },
        { installerOrigin: "https://user:password@example.invalid" },
        { publicBootstrapUrl: "http://192.168.1.2:8000/install.sh" },
        { publicBootstrapUrl: "https://user:password@example.invalid/install.sh" },
        { publicBootstrapUrl: "https://other.example.invalid/install.sh" },
        { publicBootstrapUrl: "http://127.0.0.1:8000/install.sh?inline=commands" },
        { kitOrigin: "file:///tmp/feed" }, { projectDir: "/" }, { projectDir: "relative" }, { projectDir: "/tmp/line\nbreak" },
        { capability: redact("bad\ncredential") },
    ]) {
        const result = await renderInstallation({ ...options, ...changes });
        assert.equal(result.ok, false);
        assert.equal(JSON.stringify(result).includes(fixtureAccess), false);
    }
    const result = await renderInstallation(options);
    assert.equal(result.ok, true);
    assert.equal(result.value.script.includes(fixtureAccess), false);
    assert.equal(result.value.publicBootstrap.script.includes(fixtureAccess), false);
    assert.equal(JSON.stringify(result).includes(fixtureAccess), false);
    assert.equal(reveal(result.value.command), `export BUILDER_KIT_ACCESS='${fixtureAccess}'; curl -fsSL ${publicInstallationUrl} | bash`);
    assert.doesNotMatch(reveal(result.value.command), /bash -c|mktemp|printf|mkdir|sha256|accept-juce|BUILDER_KIT_PROJECT_DIR/u);
    assert.match(result.value.publicBootstrap.script, /--accept-juce-terms/u);
    assert.ok(result.value.publicBootstrap.script.includes('${BUILDER_KIT_PROJECT_DIR-${HOME}/src/builder-kit-1.0.0}'));
    assert.equal(sha256(result.value.publicBootstrap.script), result.value.publicBootstrap.sha256);
    assert.equal(result.value.publicBootstrap.url, publicInstallationUrl);
    assert.equal(execFileSync("/bin/bash", ["-n"], { input: result.value.publicBootstrap.script, encoding: "utf8" }), "");
    assert.match(reveal(result.value.delivery), /JUCE licensing notice/u);
    assert.match(reveal(result.value.delivery), /does not grant a JUCE license/u);
    assert.equal(sha256(result.value.script), result.value.sha256);
    const syntax = execFileSync("/bin/bash", ["-n"], { input: result.value.script, encoding: "utf8" });
    assert.equal(syntax, "");
    const secretOrigin = { ...options, feedOrigin: `${options.feedOrigin}/${fixtureAccess}` };
    const secretBootstrap = await renderBootstrap(secretOrigin);
    secretOrigin.manifest = { ...options.manifest, installation: { artifact: secretBootstrap.value.artifact, sha256: secretBootstrap.value.sha256 } };
    const refused = await renderInstallation(secretOrigin);
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "bootstrap-must-not-contain-capability");
    assert.equal(JSON.stringify(refused).includes(fixtureAccess), false);
});

async function archive(directory, name, files) {
    const tree = path.join(directory, `${name}-tree`);
    await fs.mkdir(tree);
    for (const [file, content, executable = false] of files) {
        const target = path.join(tree, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content, { mode: executable ? 0o755 : 0o644 });
    }
    const target = path.join(directory, `${name}.tar.gz`);
    execFileSync("tar", ["-czf", target, "-C", tree, ...await fs.readdir(tree)]);
    return fs.readFile(target);
}

// Real HTTP, Git fetch/checkout, archive verification, npm lifecycle, setup
// and doctor. Tiny runtime archives forward to the test runner's Node/npm;
// they test bootstrap ordering, not cold official-runtime qualification.
async function fixture() {
    const scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "kit-install-command-")));
    const feed = path.join(scratch, "feed");
    await fs.mkdir(feed);
    const requests = [];
    const faults = { installer: "none", public: "none", denyPath: "" };
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, "http://localhost");
        requests.push(url.pathname);
        if (url.pathname !== "/install.sh" && !url.pathname.startsWith(`/${fixtureAccess}/`) && !url.pathname.startsWith("/runtimes/")) {
            response.writeHead(403); response.end(); return;
        }
        if (faults.denyPath && url.pathname.includes(faults.denyPath)) { response.writeHead(503); response.end(); return; }
        try {
            const relative = url.pathname.replace(`/${fixtureAccess}/`, "/");
            const file = path.resolve(feed, `.${relative}`);
            if (!file.startsWith(`${feed}/`)) throw new Error();
            let body = await fs.readFile(file);
            if (relative === "/install.sh") {
                if (faults.public === "http") { response.writeHead(503); response.end(); return; }
                if (faults.public === "truncated") body = body.subarray(0, body.length / 2);
            }
            if (relative.startsWith("/installers/")) {
                if (faults.installer === "http") { response.writeHead(401); response.end(); return; }
                if (faults.installer === "truncated") body = body.subarray(0, body.length / 2);
                if (faults.installer === "complete-body-failed-transfer") response.setHeader("Content-Length", body.length + 1);
            }
            response.setHeader("Connection", "close");
            response.end(body);
        } catch { response.writeHead(404); response.end(); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const npmPath = execFileSync("/usr/bin/which", ["npm"], { encoding: "utf8" }).trim();
    const runtimeBytes = {
        node: await archive(scratch, "node", [
            ["node-fixture/bin/node", `#!/bin/sh\nexec ${quoted(process.execPath)} "$@"\n`, true],
            ["node-fixture/bin/npm", `#!/bin/sh\nexec ${quoted(npmPath)} "$@"\n`, true],
        ]),
        cmake: await archive(scratch, "cmake", [["cmake-fixture/bin/cmake", "#!/bin/sh\nprintf 'cmake version 4.3.4\\n'\n", true]]),
    };
    await fs.mkdir(path.join(feed, "runtimes"));
    const runtimes = {};
    for (const name of ["node", "cmake"]) {
        await fs.writeFile(path.join(feed, `runtimes/${name}.tar.gz`), runtimeBytes[name]);
        runtimes[name] = { ...installationRuntimes[name], directory: `${name}-fixture`, bin: "bin", version: name === "node" ? process.version : "cmake version 4.3.4", url: `${origin}/runtimes/${name}.tar.gz`, sha256: sha256(runtimeBytes[name]) };
    }
    const cmaj = await archive(scratch, "cmaj", [["cmaj", "#!/bin/sh\nexit 0\n", true]]);
    const plugin = await archive(scratch, "plugin", [["CmajPlugin.vst3/Contents/plugin.txt", "fixture-payload"]]);
    await fs.mkdir(path.join(feed, "tools"));
    await fs.writeFile(path.join(feed, "tools/cmaj.tar.gz"), cmaj);
    await fs.writeFile(path.join(feed, "tools/plugin.tar.gz"), plugin);

    const lineage = path.join(scratch, "lineage");
    await fs.mkdir(lineage);
    await fs.cp(path.join(sourceRoot, "kit"), path.join(lineage, "kit"), { recursive: true });
    for (const name of ["AGENTS.md", ".gitignore", "product-owner.json"]) {
        await fs.copyFile(path.join(sourceRoot, "kit/template/root", name), path.join(lineage, name));
    }
    await fs.mkdir(path.join(lineage, "fx/example"), { recursive: true });
    await fs.writeFile(path.join(lineage, "fx/example/Example.cmajorpatch"), JSON.stringify({ name: "Included Example", ID: "com.example.included", version: "1.0", source: "Example.cmajor" }));
    await fs.writeFile(path.join(lineage, "fx/example/Example.cmajor"), "// Author-owned fixture source must remain unchanged.\n");
    const lock = JSON.parse(await fs.readFile(path.join(sourceRoot, "package-lock.json"), "utf8"));
    await fs.writeFile(path.join(lineage, "package.json"), JSON.stringify({
        name: "builder-kit-install-fixture", version: "1.0.0", private: true, type: "module",
        dependencies: { vite: lock.packages["node_modules/vite"].version, "@vitejs/plugin-react": lock.packages["node_modules/@vitejs/plugin-react"].version },
        scripts: { postinstall: "node fixture-postinstall.mjs" },
    }));
    await fs.writeFile(path.join(lineage, "fixture-postinstall.mjs"), [
        "import fs from 'node:fs';",
        "import { execFileSync } from 'node:child_process';",
        "const state = '.builder-kit-install';",
        "fs.appendFileSync(state + '/npm-attempts', 'attempt\\n');",
        "fs.appendFileSync(state + '/npm-cache-observed', execFileSync('npm', ['config', 'get', 'cache'], { encoding: 'utf8' }));",
        "if (process.env.BUILDER_KIT_FIXTURE_FAIL_NPM === '1' && !fs.existsSync(state + '/npm-failed-once')) { fs.writeFileSync(state + '/npm-failed-once', 'failed'); process.exit(23); }",
    ].join("\n"));
    const toolchain = JSON.parse(await fs.readFile(path.join(lineage, "kit/toolchain.json"), "utf8"));
    toolchain.cmaj = { ...toolchain.cmaj, artifact: "tools/cmaj.tar.gz", sha256: sha256(cmaj) };
    toolchain.cmajPlugin = { ...toolchain.cmajPlugin, artifact: "tools/plugin.tar.gz", sha256: sha256(plugin) };
    await fs.writeFile(path.join(lineage, "kit/toolchain.json"), JSON.stringify(toolchain));
    await fs.writeFile(path.join(lineage, "kit/feed.json"), JSON.stringify({ schemaVersion: 1, baseUrl: `${origin}/${fixtureAccess}` }));
    git(lineage, "init", "--quiet", "--initial-branch=main");
    git(lineage, "add", ".");
    git(lineage, "commit", "--quiet", "-m", "Customer release fixture");
    git(lineage, "tag", "v1.0.0");
    const manifest = manifestFor(git(lineage, "rev-parse", "HEAD"));
    manifest.tools = { cmaj: { sha256: sha256(cmaj) }, cmajPlugin: { sha256: sha256(plugin) } };
    createBareMirror(lineage, path.join(feed, "kit.git"));
    const bootstrap = await renderBootstrap({ manifest, feedOrigin: origin, runtimes });
    assert.equal(bootstrap.ok, true);
    manifest.installation = { artifact: bootstrap.value.artifact, sha256: bootstrap.value.sha256 };
    await fs.mkdir(path.join(feed, "installers"));
    await fs.writeFile(path.join(feed, bootstrap.value.artifact), bootstrap.value.script);
    const publicBootstrapUrl = `${origin}/install.sh`;
    const rendered = await renderInstallation({ manifest, feedOrigin: origin, capability: redact(fixtureAccess), runtimes, publicBootstrapUrl });
    assert.equal(rendered.ok, true);
    assert.equal(rendered.value.publicBootstrap.script.includes(fixtureAccess), false);
    await fs.writeFile(path.join(feed, "install.sh"), rendered.value.publicBootstrap.script);
    const arbitraryStart = path.join(scratch, "not-a-repository");
    const fixtureProfile = path.join(scratch, "curl-profile");
    const externalCache = path.join(scratch, "external-npm-cache");
    const profileHashes = await shellProfileHashes();
    await fs.mkdir(arbitraryStart); await fs.mkdir(fixtureProfile);
    await fs.mkdir(externalCache); await fs.writeFile(path.join(externalCache, "sentinel.txt"), "preserve external cache");
    const environment = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: process.env.HOME, CURL_HOME: fixtureProfile, TMPDIR: os.tmpdir(), npm_config_userconfig: "/dev/null", npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false", NPM_CONFIG_CACHE: externalCache, NpM_cOnFiG_cAcHe: externalCache, npm_config_cache: externalCache };
    const command = async (projectDir, changes = {}) => {
        assert.equal(typeof projectDir, "string", "the real-shell fixture must explicitly select its owned destination");
        const result = await renderInstallation({ manifest, feedOrigin: origin, capability: redact(fixtureAccess), publicBootstrapUrl, runtimes, ...changes });
        assert.equal(result.ok, true);
        return { line: reveal(result.value.command), projectDir };
    };
    const run = (command, extraEnv = {}) => new Promise((resolve) => {
        const line = typeof command === "string" ? command : command.line;
        const destination = typeof command === "string" ? {} : { BUILDER_KIT_PROJECT_DIR: command.projectDir };
        execFile("/bin/bash", ["-c", line], { cwd: arbitraryStart, env: { ...environment, ...destination, ...extraEnv }, timeout: 180000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            const output = `${stdout}${stderr}`;
            assert.equal(output.includes(fixtureAccess), false, "credentials cannot enter subprocess diagnostics");
            resolve({ status: error ? error.code : 0, output });
        });
    });
    return { scratch, feed, fixtureProfile, externalCache, profileHashes, origin, publicBootstrapUrl, manifest, runtimes, requests, faults, command, run, close: async () => {
        server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
        await fs.rm(scratch, { recursive: true, force: true });
    } };
}

test("exact emitted line owns download failure, occupied-folder refusal, fresh install and safe resumable setup", {
    skip: process.platform !== "darwin" || process.arch !== "arm64" ? "macOS arm64 installer seam; cold OS/runtime qualification is separate" : false,
}, async (t) => {
    const f = await fixture();
    try {
        await t.test("public bootstrap is fetchable without a key and the exact short command has no destination program", async () => {
            const response = await fetch(f.publicBootstrapUrl);
            assert.equal(response.status, 200);
            assert.equal((await response.text()).includes(fixtureAccess), false);
            const first = await f.command(path.join(f.scratch, "first"));
            const other = await f.command(path.join(f.scratch, "different"));
            assert.equal(first.line, other.line);
            assert.equal(first.line, `export BUILDER_KIT_ACCESS='${fixtureAccess}'; curl -fsSL ${f.publicBootstrapUrl} | bash`);
        });
        await t.test("public HTTP failure is visible under ordinary pipeline status and a truncated body cannot start installation", async () => {
            for (const fault of ["http", "truncated"]) {
                f.faults.public = fault;
                const root = path.join(f.scratch, `public-${fault}`);
                const before = f.requests.filter(url => url.includes("/installers/")).length;
                const result = await f.run(await f.command(root));
                assert.doesNotMatch(result.output, /is ready/u);
                assert.equal(existsSync(root), false);
                assert.equal(f.requests.filter(url => url.includes("/installers/")).length, before);
                if (fault === "http") { assert.equal(result.status, 0); assert.match(result.output, /curl: \(22\)/u); }
                else assert.notEqual(result.status, 0);
            }
            f.faults.public = "none";
        });
        await t.test("linked and non-normalized destination paths are refused before any customer write", async () => {
            const outside = path.join(f.scratch, "outside-destination");
            await fs.mkdir(outside); await fs.writeFile(path.join(outside, "sentinel.txt"), "preserve");
            const linked = path.join(f.scratch, "linked-destination");
            await fs.symlink(outside, linked);
            for (const destination of [linked, `${linked}/child`, "relative", "/", process.env.HOME, `${outside}/../other`, `${outside}//child`, `${outside}/child/`, `${outside}/line\nbreak`]) {
                const result = await f.run(await f.command(destination));
                assert.notEqual(result.status, 0, result.output);
                assert.doesNotMatch(result.output, /is ready/u);
            }
            assert.deepEqual(await fs.readdir(outside), ["sentinel.txt"]);
            assert.equal(await fs.readFile(path.join(outside, "sentinel.txt"), "utf8"), "preserve");
            assert.equal(await fs.readlink(linked), outside);
        });
        for (const fault of ["http", "truncated", "complete-body-failed-transfer"]) {
            await t.test(`installer ${fault} never executes even a complete expected payload`, async () => {
                f.faults.installer = fault;
                const root = path.join(f.scratch, fault);
                const result = await f.run(await f.command(root));
                assert.notEqual(result.status, 0, result.output);
                assert.doesNotMatch(result.output, /is ready/u);
                assert.equal(existsSync(root), false);
            });
        }
        f.faults.installer = "none";
        await t.test("invalid access and unrelated occupied directory do not mutate customer files", async () => {
            const invalid = path.join(f.scratch, "invalid-access");
            const denied = await f.run(await f.command(invalid, { capability: redact("invalid-access") }));
            assert.notEqual(denied.status, 0);
            assert.equal(existsSync(invalid), false);
            const occupied = path.join(f.scratch, "occupied");
            await fs.mkdir(occupied); await fs.writeFile(path.join(occupied, "precious.txt"), "preserve me");
            const result = await f.run(await f.command(occupied));
            assert.notEqual(result.status, 0);
            assert.match(result.output, /occupied by unrelated files/u);
            assert.deepEqual(await fs.readdir(occupied), ["precious.txt"]);
            assert.equal(await fs.readFile(path.join(occupied, "precious.txt"), "utf8"), "preserve me");
        });
        const project = path.join(f.scratch, "Customer's Kit ; $(do-not-execute)");
        const line = await f.command(project);
        await t.test("missing Apple tools refuses before claiming a destination", async () => {
            const probes = path.join(f.scratch, "missing-apple-tools");
            await fs.mkdir(probes);
            await fs.writeFile(path.join(probes, "xcode-select"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
            const root = path.join(f.scratch, "missing-prerequisite");
            const result = await f.run(await f.command(root), { PATH: `${probes}:/usr/bin:/bin:/usr/sbin:/sbin` });
            assert.notEqual(result.status, 0);
            assert.match(result.output, /Apple Command Line Tools must be installed and their agreements accepted by you/u);
            assert.deepEqual(await fs.readdir(root), []);
        });
        await t.test("release and runtime failures propagate; retry resumes the owned destination", async () => {
            f.faults.denyPath = "/kit.git/";
            let result = await f.run(line);
            assert.notEqual(result.status, 0);
            assert.match(result.output, /Release download failed/u);
            f.faults.denyPath = "/runtimes/node";
            result = await f.run(line);
            assert.notEqual(result.status, 0, result.output);
            assert.match(result.output, /Runtime download failed/u);
            assert.doesNotMatch(result.output, /is ready/u);
            assert.equal(existsSync(path.join(project, "build/kit-tools")), false);
            f.faults.denyPath = "";
            const archive = path.join(f.feed, "runtimes/node.tar.gz");
            const original = await fs.readFile(archive);
            await fs.appendFile(archive, "corruption");
            result = await f.run(line);
            assert.notEqual(result.status, 0);
            assert.match(result.output, /Runtime archive verification failed/u);
            await fs.writeFile(archive, original);
            f.faults.denyPath = "/tools/cmaj";
            result = await f.run(line);
            assert.notEqual(result.status, 0);
            assert.doesNotMatch(result.output, /is ready/u);
            f.faults.denyPath = "";
        });
        await t.test("actual npm lifecycle failure leaves a partial install, then retry completes it", async () => {
            let result = await f.run(line, { BUILDER_KIT_FIXTURE_FAIL_NPM: "1" });
            assert.notEqual(result.status, 0, result.output);
            assert.doesNotMatch(result.output, /is ready/u);
            assert.equal(existsSync(path.join(project, "node_modules")), true);
            assert.equal(existsSync(path.join(project, ".builder-kit-install/npm-ready")), false);
            result = await f.run(line, { BUILDER_KIT_FIXTURE_FAIL_NPM: "1" });
            assert.equal(result.status, 0, result.output);
            assert.match(result.output, /setup and strict environment checks passed/u);
            assert.ok(result.output.endsWith(`${project}\n`));
            assert.equal((await fs.readFile(path.join(project, ".builder-kit-install/npm-attempts"), "utf8")).split("\n").filter(Boolean).length, 2);
            assert.equal(git(project, "rev-parse", "HEAD"), f.manifest.kit.commit);
            assert.equal(git(project, "remote"), "");
            assert.equal((await fs.readFile(path.join(project, ".git/config"), "utf8")).includes(fixtureAccess), false);
        });
        await t.test("rerun preserves dirty source, untracked files, index, HEAD and completed downloads", async () => {
            const source = path.join(project, "fx/example/Example.cmajor");
            await fs.appendFile(source, "// customer edit\n");
            await fs.writeFile(path.join(project, "customer-notes.txt"), "untracked customer work");
            const index = await fs.readFile(path.join(project, ".git/index"));
            const head = git(project, "rev-parse", "HEAD");
            const before = await fs.readFile(source);
            const count = f.requests.filter((url) => url.startsWith("/runtimes/") || url.includes("/tools/")).length;
            const result = await f.run(line);
            assert.equal(result.status, 0, result.output);
            assert.deepEqual(await fs.readFile(source), before);
            assert.equal(await fs.readFile(path.join(project, "customer-notes.txt"), "utf8"), "untracked customer work");
            assert.deepEqual(await fs.readFile(path.join(project, ".git/index")), index);
            assert.equal(git(project, "rev-parse", "HEAD"), head);
            assert.equal(f.requests.filter((url) => url.startsWith("/runtimes/") || url.includes("/tools/")).length, count);
            assert.equal((await fs.readFile(path.join(project, ".builder-kit-install/npm-attempts"), "utf8")).split("\n").filter(Boolean).length, 2);
        });
        await t.test("fresh shell activates project-local Node/npm/CMake without shell profile edits", async () => {
            const result = await f.run(`cd -- ${quoted(project)} && ! command -v node && ! command -v cmake && . .builder-kit-install/env.sh && node --version && npm --version && cmake --version && command -v node && command -v cmake && npm config get cache`);
            assert.equal(result.status, 0, result.output);
            assert.match(result.output, /\.builder-kit-install\/runtime\/node-fixture\/bin\/node/u);
            assert.match(result.output, /\.builder-kit-install\/runtime\/cmake-fixture\/bin\/cmake/u);
            assert.ok(result.output.endsWith(`${project}/.builder-kit-install/npm-cache\n`), result.output);
            assert.deepEqual(await shellProfileHashes(), f.profileHashes);
            assert.equal(existsSync(path.join(project, ".builder-kit-install/npm-cache/_cacache")), true);
            assert.match(await fs.readFile(path.join(project, "AGENTS.md"), "utf8"), /builder-kit-install-runtime-v1/u);
        });
        await t.test("inherited cache case variants cannot redirect installer npm or its lifecycle children", async () => {
            const expected = await fs.realpath(path.join(project, ".builder-kit-install/npm-cache"));
            const observed = () => fs.readFile(path.join(project, ".builder-kit-install/npm-cache-observed"), "utf8");
            assert.deepEqual((await observed()).trim().split("\n"), [expected, expected]);
            assert.deepEqual(await fs.readdir(f.externalCache), ["sentinel.txt"]);
            // Reintroduce conflicting overrides after shell activation to
            // independently exercise complete_install's npm process boundary.
            await fs.unlink(path.join(project, ".builder-kit-install/npm-ready"));
            const result = await f.run(`cd -- ${quoted(project)} && . .builder-kit-install/env.sh && NPM_CONFIG_CACHE=${quoted(f.externalCache)} NpM_cOnFiG_cAcHe=${quoted(f.externalCache)} npm_config_cache=${quoted(f.externalCache)} node kit/scripts/complete_install.mjs --accept-juce-terms`, {
                BUILDER_KIT_EXPECTED_FEED: `${f.origin}/${fixtureAccess}`,
                BUILDER_KIT_EXPECTED_CMAJ_SHA256: f.manifest.tools.cmaj.sha256,
                BUILDER_KIT_EXPECTED_PLUGIN_SHA256: f.manifest.tools.cmajPlugin.sha256,
            });
            assert.equal(result.status, 0, result.output);
            assert.deepEqual((await observed()).trim().split("\n"), [expected, expected, expected]);
            assert.deepEqual(await fs.readdir(f.externalCache), ["sentinel.txt"]);
            assert.equal(await fs.readFile(path.join(f.externalCache, "sentinel.txt"), "utf8"), "preserve external cache");
        });
        await t.test("inherited Git tracing and curl config cannot log delivery credentials", async () => {
            const traceFile = path.join(f.scratch, "git-credential-trace");
            const curlTrace = path.join(f.scratch, "curl-credential-trace");
            await fs.writeFile(path.join(f.fixtureProfile, ".curlrc"), `trace-ascii = "${curlTrace}"\n`);
            const root = path.join(f.scratch, "fresh-traced-fetch");
            const before = f.requests.filter((url) => url.includes("/kit.git/")).length;
            f.faults.denyPath = "/kit.git/";
            let result;
            try { result = await f.run(await f.command(root), { GIT_TRACE: traceFile, GIT_TRACE_CURL: traceFile, GIT_TRACE2_EVENT: traceFile, GIT_CURL_VERBOSE: "1" }); }
            finally { f.faults.denyPath = ""; }
            assert.notEqual(result.status, 0, result.output);
            assert.match(result.output, /Release download failed/u);
            assert.ok(f.requests.filter((url) => url.includes("/kit.git/")).length > before, "credential-bearing Git HTTP fetch must actually be exercised");
            assert.equal(existsSync(traceFile), false);
            assert.equal((await fs.readFile(curlTrace, "utf8")).includes(fixtureAccess), false, "ordinary public curl may honor curlrc, but its trace must contain no private credential");
            assert.equal((await fs.readFile(path.join(root, ".git/config"), "utf8")).includes(fixtureAccess), false);
            assert.equal(existsSync(path.join(root, ".git/FETCH_HEAD")), false);
        });
        await t.test("final doctor failure returns a safe actionable status, never ready", async () => {
            f.faults.denyPath = "/kit.git/HEAD";
            try {
                const result = await f.run(line);
                assert.notEqual(result.status, 0);
                assert.match(result.output, /kit feed returned HTTP 503/u);
                assert.doesNotMatch(result.output, /is ready/u);
            } finally { f.faults.denyPath = ""; }
        });
        await t.test("linked installer state never writes outside the project", async () => {
            const state = path.join(project, ".builder-kit-install");
            for (const name of ["env.sh", "npm-ready", "runtime", "npm-cache"]) {
                const control = path.join(state, name);
                const backup = path.join(state, `${name}.test-backup`);
                const outside = path.join(f.scratch, `outside-${name}`);
                const directory = (await fs.stat(control)).isDirectory();
                if (directory) { await fs.mkdir(outside); await fs.writeFile(path.join(outside, "precious.txt"), "unchanged"); }
                else await fs.writeFile(outside, "unchanged");
                await fs.rename(control, backup);
                await fs.symlink(outside, control);
                try {
                    const result = await f.run(line);
                    assert.notEqual(result.status, 0, result.output);
                    assert.doesNotMatch(result.output, /is ready/u);
                    assert.match(result.output, /linked/u);
                    assert.equal(await fs.readFile(directory ? path.join(outside, "precious.txt") : outside, "utf8"), "unchanged");
                    if (directory) assert.deepEqual(await fs.readdir(outside), ["precious.txt"]);
                    assert.equal(await fs.readlink(control), outside);
                } finally { await fs.unlink(control); await fs.rename(backup, control); }
            }
        });
        await t.test("runtime bytes, executable modes and symlink changes fail before execution", async () => {
            const runtime = path.join(project, ".builder-kit-install/runtime/node-fixture/bin/node");
            const bytes = await fs.readFile(runtime);
            const mode = (await fs.stat(runtime)).mode & 0o777;
            const invoked = path.join(f.scratch, "tampered-runtime-was-executed");
            const stub = `#!/bin/sh\ntouch ${quoted(invoked)}\nprintf '%s\\n' ${quoted(process.version)}\nexit 0\n`;
            for (const change of ["bytes", "mode", "link"]) {
                if (change === "bytes") await fs.writeFile(runtime, stub);
                if (change === "mode") await fs.chmod(runtime, 0o644);
                if (change === "link") {
                    const outside = path.join(f.scratch, "outside-node");
                    await fs.writeFile(outside, stub, { mode: 0o755 });
                    await fs.unlink(runtime); await fs.symlink(outside, runtime);
                }
                try {
                    const result = await f.run(line);
                    assert.notEqual(result.status, 0, result.output);
                    assert.match(result.output, /runtime is incomplete or modified/u);
                    assert.doesNotMatch(result.output, /is ready/u);
                    assert.equal(existsSync(invoked), false);
                } finally {
                    if (change === "link") await fs.unlink(runtime);
                    await fs.writeFile(runtime, bytes, { mode }); await fs.chmod(runtime, mode);
                }
            }
        });
        await t.test("setup and npm writable roots and lockfiles cannot redirect a rerun", async () => {
            const targets = ["build", "build/kit-tools", "build/kit-tools/juce-terms-acknowledged.json", "build/kit-tools/.download-cmaj.tar.gz", "node_modules", "node_modules/.package-lock.json", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock"];
            for (const [number, relative] of targets.entries()) {
                const control = path.join(project, relative);
                const backup = path.join(f.scratch, `writable-backup-${number}`);
                const outside = path.join(f.scratch, `outside-setup-${number}`);
                const existed = existsSync(control);
                const directory = existed && (await fs.stat(control)).isDirectory();
                if (directory) { await fs.mkdir(outside); await fs.writeFile(path.join(outside, "precious.txt"), "unchanged"); }
                else await fs.writeFile(outside, "unchanged");
                if (existed) await fs.rename(control, backup);
                await fs.symlink(outside, control);
                try {
                    const result = await f.run(line);
                    assert.notEqual(result.status, 0, result.output);
                    assert.match(result.output, /unsafe-setup-path/u);
                    assert.doesNotMatch(result.output, /is ready/u);
                    assert.equal(await fs.readFile(directory ? path.join(outside, "precious.txt") : outside, "utf8"), "unchanged");
                    if (directory) assert.deepEqual(await fs.readdir(outside), ["precious.txt"]);
                    assert.equal(await fs.readlink(control), outside);
                } finally {
                    await fs.unlink(control);
                    if (existed) await fs.rename(backup, control);
                }
            }
        });
        await t.test("delivery files are private, exact and not overwritten", async () => {
            const outputDir = path.join(f.scratch, "private-delivery");
            const options = { manifest: f.manifest, destinationConfig: { feedOrigin: redact(f.origin) }, capability: redact(fixtureAccess), outputDir, runtimes: f.runtimes, publicBootstrapUrl: f.publicBootstrapUrl };
            for (const obsolete of [{ projectDir: project }, { installerOrigin: f.origin }]) {
                const refused = await prepareInstallation({ ...options, ...obsolete });
                assert.equal(refused.ok, false);
                assert.equal(refused.error.code, "obsolete-inline-delivery-option");
                assert.equal(existsSync(outputDir), false);
            }
            const result = await prepareInstallation(options);
            assert.equal(result.ok, true);
            assert.equal(await fs.readFile(path.join(outputDir, "command.sh"), "utf8"), `${line.line}\n`);
            assert.equal(await fs.readFile(path.join(outputDir, "public/install.sh"), "utf8"), result.value.publicBootstrap.script);
            assert.equal(result.value.publicBootstrap.script.includes(fixtureAccess), false);
            assert.equal((await fs.stat(outputDir)).mode & 0o777, 0o700);
            for (const name of ["command.sh", "delivery.txt"]) assert.equal((await fs.stat(path.join(outputDir, name))).mode & 0o777, 0o600);
            assert.equal((await prepareInstallation(options)).ok, false);
            const insideProject = path.join(project, "private-command");
            const refused = await prepareInstallation({ ...options, outputDir: insideProject });
            assert.equal(refused.ok, false);
            assert.equal(refused.error.code, "private-delivery-must-be-outside-git");
            assert.equal(existsSync(insideProject), false);
        });
        await t.test("a customer's orphan branch cannot be mistaken for interrupted initial acquisition", async () => {
            git(project, "add", "fx/example/Example.cmajor", "customer-notes.txt");
            git(project, "commit", "--quiet", "-m", "Customer work");
            git(project, "switch", "--orphan", "customer-experiment");
            await fs.writeFile(path.join(project, "orphan-work.txt"), "customer scratch work");
            const refs = git(project, "show-ref");
            const status = git(project, "status", "--porcelain=v1");
            const index = await fs.readFile(path.join(project, ".git/index"));
            const result = await f.run(line);
            assert.notEqual(result.status, 0);
            assert.match(result.output, /Git history is unborn or unexpected/u);
            assert.equal(git(project, "show-ref"), refs);
            assert.equal(git(project, "status", "--porcelain=v1"), status);
            assert.deepEqual(await fs.readFile(path.join(project, ".git/index")), index);
            assert.equal(await fs.readFile(path.join(project, "orphan-work.txt"), "utf8"), "customer scratch work");
        });
    } finally { await f.close(); }
});
