import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
    canonicalProofCommands,
    exportKit,
    normalizeFeedBaseUrl,
    proveExport,
    readAllowlist,
    renderDependencySources,
    scanForForbiddenStrings,
} from "../kit/scripts/export_kit.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const officialJuceLine = 'set(COSIMO_JUCE_GIT_URL "https://github.com/juce-framework/JUCE.git")';

test("export payload and templates come only from the asserted commit, never ignored or live bytes", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-provenance-"));
    const sourceRoot = path.join(scratch, "source");
    const output = path.join(scratch, "customer");
    const sentinel = "SYNTHETIC-IGNORED-EXPORT-BYTES";
    const files = {
        ".gitignore": ".DS_Store\n",
        "package.json": JSON.stringify({ devDependencies: { fixture: "1.0.0" } }),
        "scripts/builder-kit-export-policy.json": JSON.stringify({
            trees: ["kit"], files: [], requiredOutputs: ["package.json", "kit/fixture.txt"],
            forbiddenStrings: [], templateExplicitDevDependencies: {}, templateDevDependencyNames: ["fixture"],
        }),
        "kit/fixture.txt": "committed payload\n",
        "kit/feed.json": '{"baseUrl":""}',
        "kit/cmake/dependency-sources.cmake": 'set(COSIMO_CMAJOR_GIT_URL "https://source.example/cmajor.git")\n',
        "kit/skills/example/SKILL.md": "fixture skill\n",
        "kit/template/root/package.json.template": '{"devDependencies":"__DEV_DEPENDENCIES__"}',
        "kit/template/root/README.md": "committed template\n",
    };
    const git = (...args) => execFileSync("git", ["-C", sourceRoot, ...args], {
        encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" },
    }).trim();
    try {
        for (const [relative, bytes] of Object.entries(files)) {
            await fs.mkdir(path.dirname(path.join(sourceRoot, relative)), { recursive: true });
            await fs.writeFile(path.join(sourceRoot, relative), bytes);
        }
        await fs.mkdir(path.join(sourceRoot, "kit/scripts"));
        await fs.copyFile(path.join(repoRoot, "kit/scripts/export_kit.mjs"), path.join(sourceRoot, "kit/scripts/export_kit.mjs"));
        git("init", "--quiet");
        git("add", ".");
        git("commit", "--quiet", "-m", "source fixture");
        const sourceCommit = git("rev-parse", "HEAD");
        await fs.writeFile(path.join(sourceRoot, "kit/fixture.txt"), "newer committed payload\n");
        git("commit", "--quiet", "-am", "advance HEAD beyond asserted export source");
        assert.notEqual(git("rev-parse", "HEAD"), sourceCommit);
        await fs.writeFile(path.join(sourceRoot, "kit/.DS_Store"), sentinel);
        assert.equal(git("status", "--porcelain=v1", "--untracked-files=all"), "", "ignored content is invisible to the release clean-tree check");
        await fs.writeFile(path.join(sourceRoot, "kit/fixture.txt"), sentinel);
        await fs.writeFile(path.join(sourceRoot, "kit/template/root/README.md"), sentinel);
        await fs.writeFile(path.join(sourceRoot, "package.json"), JSON.stringify({ devDependencies: { fixture: "9.9.9" } }));
        await fs.writeFile(path.join(sourceRoot, "scripts/builder-kit-export-policy.json"), "invalid live policy must not be read");
        const exporter = await import(pathToFileURL(path.join(sourceRoot, "kit/scripts/export_kit.mjs")).href);
        const result = await exporter.exportKit(output, { sourceCommit, feedUrl: "https://feed.example/SYNTHETIC-COHORT" });
        assert.equal(existsSync(path.join(output, "kit/.DS_Store")), false);
        assert.equal(await fs.readFile(path.join(output, "kit/fixture.txt"), "utf8"), "committed payload\n");
        assert.equal(await fs.readFile(path.join(output, "README.md"), "utf8"), "committed template\n");
        assert.equal(JSON.parse(await fs.readFile(path.join(output, "package.json"), "utf8")).devDependencies.fixture, "1.0.0");
        assert.equal(result.sourceCommit, sourceCommit);
        assert.equal(result.feedConfigured, true);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

async function monorepoSkillNames() {
    const entries = await fs.readdir(path.join(repoRoot, "kit/skills"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listSourceFiles(root) {
    const files = [];
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        const target = path.join(root, entry.name);
        if (entry.isDirectory()) files.push(...await listSourceFiles(target));
        else if (/\.(?:d\.ts|js|mjs|ts|tsx)$/u.test(entry.name)) files.push(target);
    }
    return files;
}

test("plugin modules use the Builder Kit public entrypoint", async () => {
    const violations = [];
    for (const filePath of await listSourceFiles(path.join(repoRoot, "fx"))) {
        const source = await fs.readFile(filePath, "utf8");
        const imports = source.matchAll(/\b(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/gu);
        for (const match of imports) {
            const specifier = match[1];
            if (!specifier.includes("/kit/")) continue;
            const publicModule = /\/kit\/index(?:\.ts)?$/u.test(specifier);
            const inlineAsset = /\/kit\/ui\/[^?]+\.(?:css|svg)\?(?:inline|raw)$/u.test(specifier);
            if (!publicModule && !inlineAsset) {
                violations.push(`${path.relative(repoRoot, filePath)} -> ${specifier}`);
            }
        }
    }
    assert.deepEqual(violations, []);
});

test("export proof invokes the customer package's canonical gates", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-proof-contract-"));
    const calls = [];
    try {
        await fs.mkdir(path.join(scratch, "node_modules"));
        await proveExport(scratch, {
            runCommand: (command, args, cwd) => calls.push({ command, args, cwd }),
            proveUpdateFlow: async () => calls.push({ command: "update-flow", args: [], cwd: scratch }),
        });
        assert.deepEqual(calls.slice(0, canonicalProofCommands.length), [
            { command: "npm", args: ["run", "typecheck"], cwd: scratch },
            { command: "npm", args: ["test"], cwd: scratch },
            { command: "node", args: ["kit/fx/build-effect.mjs", "enhancer-lite"], cwd: scratch },
        ]);
        assert.equal(calls.at(-1).command, "update-flow");
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("forbidden_string_scan_catches_a_planted_identifier", async () => {
    const allowlist = await readAllowlist();
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-scan-"));
    try {
        await fs.writeFile(path.join(scratch, "leak.txt"), `built on ${allowlist.forbiddenStrings[0]}'s machine`);
        const violations = await scanForForbiddenStrings(scratch, allowlist);
        assert.equal(violations.length, 1);
        assert.equal(violations[0].file, "leak.txt");
        assert.equal(violations[0].ruleId, "forbidden-string-1");
        assert.equal("needle" in violations[0], false, "private match material must not enter diagnostics");
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("dependency_sources_is_the_data_only_seam_between_github_and_the_feed", async () => {
    const sources = await fs.readFile(path.join(repoRoot, "kit/cmake/dependency-sources.cmake"), "utf8");
    const module = await fs.readFile(path.join(repoRoot, "kit/cmake/CosimoDependencies.cmake"), "utf8");
    const feed = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/feed.json"), "utf8"));

    // Monorepo: GitHub origins, empty feed.
    assert.equal(feed.baseUrl, "");
    assert.match(sources, /^set\(COSIMO_CMAJOR_GIT_URL "https:\/\/github\.com\/[^"]+\/cmajor\.git"\)$/mu);
    assert.equal(sources.includes(officialJuceLine), true);
    const statements = sources.split("\n").filter((line) => line.trim() !== "" && !line.startsWith("#"));
    assert.deepEqual(statements.map((line) => line.split(" ")[0]), ["set(COSIMO_CMAJOR_GIT_URL", "set(COSIMO_JUCE_GIT_URL"]);

    // The dependency module consumes the seam and carries no origin of its own.
    assert.match(module, /include\("\$\{CMAKE_CURRENT_LIST_DIR\}\/dependency-sources\.cmake"\)/u);
    assert.match(module, /GIT_REPOSITORY "\$\{COSIMO_CMAJOR_GIT_URL\}"/u);
    assert.match(module, /GIT_REPOSITORY "\$\{COSIMO_JUCE_GIT_URL\}"/u);
    assert.doesNotMatch(module, /github\.com/u);

    // Rendering swaps only the Cmajor line.
    const rendered = renderDependencySources(sources, "https://feed.example.invalid/k/abc");
    assert.equal(rendered.includes('set(COSIMO_CMAJOR_GIT_URL "https://feed.example.invalid/k/abc/cmajor.git")'), true);
    assert.equal(rendered.includes(officialJuceLine), true);
    assert.doesNotMatch(rendered, /github\.com\/[^"]+\/cmajor\.git/u);
    assert.throws(() => renderDependencySources("set(COSIMO_JUCE_GIT_URL \"x\")\n", "https://f"), /exactly once, found 0/u);

    assert.equal(normalizeFeedBaseUrl("https://feed.example.invalid/k/abc/"), "https://feed.example.invalid/k/abc");
    assert.equal(normalizeFeedBaseUrl(""), "");
    assert.throws(() => normalizeFeedBaseUrl("feed.example.invalid/k"), /absolute http\(s\) URL/u);
    assert.throws(() => normalizeFeedBaseUrl("ftp://feed.example.invalid/k"), /absolute http\(s\) URL/u);
});

test("export_produces_a_gated_starter_tree_with_no_private_material", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-"));
    const outputRoot = path.join(scratch, "starter");
    try {
        const { fileCount, feedConfigured } = await exportKit(outputRoot);
        assert.equal(fileCount > 50, true);
        assert.equal(feedConfigured, false);

        for (const required of ["kit/AGENTS.md", "kit/fx/build-effect.mjs", "fx/enhancer_lite/EnhancerLite.cmajorpatch", "package.json", "README.md", "EXPORT_MANIFEST.json"]) {
            assert.equal(existsSync(path.join(outputRoot, required)), true, `missing ${required}`);
        }
        for (const forbidden of ["TODOS.txt", "PROGRESS.txt", "reference_labs", "experiments", "cmajor/WavetableSynth.cmajor", "ui/desktop", "fx/seqfx", "AGENTS.md.orig", "kit/export-allowlist.json", "scripts/builder-kit-export-policy.json"]) {
            assert.equal(existsSync(path.join(outputRoot, forbidden)), false, `must not export ${forbidden}`);
        }

        const allowlist = await readAllowlist();
        assert.deepEqual(await scanForForbiddenStrings(outputRoot, allowlist), []);
        const exportManifest = await fs.readFile(path.join(outputRoot, "EXPORT_MANIFEST.json"), "utf8");
        assert.equal(exportManifest.includes("export-allowlist"), false);
        assert.equal(exportManifest.includes("builder-kit-export-policy"), false);

        // Every kit skill is discoverable from the root, by relative symlink.
        const skillNames = await monorepoSkillNames();
        assert.equal(skillNames.includes("cosimo-make-plugin"), true);
        assert.deepEqual((await fs.readdir(path.join(outputRoot, ".agents/skills"))).sort(), skillNames);
        for (const skillName of skillNames) {
            const skillLink = await fs.readlink(path.join(outputRoot, ".agents/skills", skillName));
            assert.equal(skillLink, `../../kit/skills/${skillName}`);
            assert.equal(existsSync(path.join(outputRoot, ".agents/skills", skillName, "SKILL.md")), true, `${skillName} link is dangling`);
        }
        JSON.parse(await fs.readFile(path.join(outputRoot, "package.json"), "utf8"));
        const firstUse = await fs.readFile(path.join(outputRoot, "README.md"), "utf8");
        assert.match(firstUse, /^> Build and install the included plugin so I can try it in my DAW\.$/mu);
        assert.match(firstUse, /If you already have another request, start with that instead\./u);
        assert.match(firstUse, /npm run fx:prod:build -- enhancer-lite\nnpm run fx:prod:install -- enhancer-lite/u);
        assert.match(firstUse, /Do not copy or rename it, create a new plugin or test,/u);
        assert.match(firstUse, /Build\/install success is not a listening or DAW-acceptance result\./u);
        assert.match(firstUse, /actual plugin name to find in the\nDAW and the exact installed location/u);
        assert.match(firstUse, /http:\/\/127\.0\.0\.1:5175\/fx\/enhancer_lite\/view\/harness\.html/u);

        // A cold reader gets a short conditional index whose exported links resolve.
        const rootGuidance = await fs.readFile(path.join(outputRoot, "AGENTS.md"), "utf8");
        const kitGuidancePath = path.join(outputRoot, "kit/AGENTS.md");
        const kitGuidance = await fs.readFile(kitGuidancePath, "utf8");
        assert.match(rootGuidance, /follow only the references\nthat match the task/u);
        assert.doesNotMatch(rootGuidance, /read `kit\/AGENTS\.md` fully/iu);
        for (const requiredRoute of ["PLUGIN_ARCHITECTURE.md", "RELEASE_VERIFICATION.md", "HOST_COMPATIBILITY.md", "EXPORT.md", "cosimo-make-plugin/SKILL.md"]) {
            assert.equal(kitGuidance.includes(requiredRoute), true, `missing guidance route ${requiredRoute}`);
        }
        for (const match of kitGuidance.matchAll(/\]\(([^)]+)\)/gu)) {
            const target = match[1];
            if (/^(?:https?:|#)/u.test(target)) continue;
            assert.equal(existsSync(path.resolve(path.dirname(kitGuidancePath), target)), true, `dangling kit guidance link ${target}`);
        }

        // No feed: the dependency seam and feed.json are byte-identical to the monorepo's.
        for (const relative of ["kit/cmake/dependency-sources.cmake", "kit/feed.json"]) {
            assert.equal(
                await fs.readFile(path.join(outputRoot, relative), "utf8"),
                await fs.readFile(path.join(repoRoot, relative), "utf8"),
                relative,
            );
        }
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("export_with_a_feed_url_stamps_feed_json_and_points_cmajor_at_the_feed_mirror", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-feed-"));
    const outputRoot = path.join(scratch, "starter");
    const feedUrl = "https://feed.example.invalid/k/abc123/";
    try {
        const result = await exportKit(outputRoot, { feedUrl });
        assert.equal(result.feedConfigured, true);
        assert.equal(JSON.stringify(result).includes("abc123"), false);

        const feed = JSON.parse(await fs.readFile(path.join(outputRoot, "kit/feed.json"), "utf8"));
        assert.equal(feed.baseUrl, "https://feed.example.invalid/k/abc123");
        assert.equal(feed.schemaVersion, 1);

        const sources = await fs.readFile(path.join(outputRoot, "kit/cmake/dependency-sources.cmake"), "utf8");
        assert.equal(sources.includes('set(COSIMO_CMAJOR_GIT_URL "https://feed.example.invalid/k/abc123/cmajor.git")'), true);
        assert.equal(sources.includes(officialJuceLine), true);
        assert.doesNotMatch(sources, /github\.com\/[^"]+\/cmajor\.git/u);

        const manifest = JSON.parse(await fs.readFile(path.join(outputRoot, "EXPORT_MANIFEST.json"), "utf8"));
        assert.equal(manifest.feedConfigured, true);
        assert.equal(JSON.stringify(manifest).includes("abc123"), false);

        // The monorepo's own seam is untouched by the export.
        const monorepoFeed = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/feed.json"), "utf8"));
        assert.equal(monorepoFeed.baseUrl, "");

        const invalidSentinel = "SENTINEL-CAPABILITY-EXPORT-DO-NOT-LOG";
        let invalid;
        try {
            await exportKit(outputRoot, { force: true, feedUrl: `not-a-url-${invalidSentinel}` });
        } catch (error) {
            invalid = error;
        }
        assert.ok(invalid instanceof Error);
        assert.match(invalid.message, /absolute http\(s\) URL/u);
        assert.equal(invalid.message.includes(invalidSentinel), false);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
