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
    findUnnoticedPackages,
    listShippedPackages,
    proveExport,
    readAllowlist,
    renderCustomerLock,
    renderDependencySources,
    scanForForbiddenStrings,
} from "../scripts/export_kit.mjs";
import { normalizeBaseUrl } from "../kit/scripts/toolchain.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const officialJuceLine = 'set(BUILDER_KIT_JUCE_GIT_URL "https://github.com/juce-framework/JUCE.git")';

test("export payload and templates come only from the asserted commit, never ignored or live bytes", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-provenance-"));
    const sourceRoot = path.join(scratch, "source");
    const output = path.join(scratch, "customer");
    const sentinel = "SYNTHETIC-IGNORED-EXPORT-BYTES";
    const files = {
        ".gitignore": ".DS_Store\n",
        "package.json": JSON.stringify({ devDependencies: { fixture: "1.0.0" } }),
        "package-lock.json": JSON.stringify({
            lockfileVersion: 3,
            packages: { "": { devDependencies: { fixture: "1.0.0" } }, "node_modules/fixture": { version: "1.0.0", dev: true } },
        }),
        "scripts/builder-kit-export-policy.json": JSON.stringify({
            trees: ["kit"], files: [], requiredOutputs: ["package.json", "package-lock.json", "kit/fixture.txt"],
            forbiddenStrings: [], templateExplicitDevDependencies: {}, templateDevDependencyNames: ["fixture"],
        }),
        "kit/fixture.txt": "committed payload\n",
        "kit/ui/view.ts": 'import fixture from "fixture";\n',
        "kit/feed.json": '{"baseUrl":""}',
        "kit/toolchain.json": JSON.stringify({ cmaj: { artifact: "tools/v1.0.0/cmaj.tar.gz", sha256: "" } }),
        "kit/cmake/dependencies.cmake": `set(BUILDER_KIT_CMAJOR_PINNED_COMMIT "${"a".repeat(40)}")\nCPMAddPackage(\n NAME builder_kit_cmajor\n GIT_TAG "\${BUILDER_KIT_CMAJOR_PINNED_COMMIT}"\n)\n`,
        "kit/cmake/dependency-sources.cmake": 'set(BUILDER_KIT_CMAJOR_GIT_URL "https://source.example/cmajor.git")\n',
        "kit/skills/example/SKILL.md": "fixture skill\n",
        "kit/template/root/package.json.template": '{"name":"fixture-customer","devDependencies":"__DEV_DEPENDENCIES__"}',
        "kit/template/root/README.md": "committed template\n",
        "kit/template/root/THIRD_PARTY_NOTICES.md": "- `fixture`: MIT.\n",
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
        for (const script of ["scripts/export_kit.mjs", "kit/scripts/toolchain.mjs", "kit/scripts/common.mjs"])
            await fs.copyFile(path.join(repoRoot, script), path.join(sourceRoot, script));
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
        await fs.writeFile(path.join(sourceRoot, "kit/cmake/dependencies.cmake"), files["kit/cmake/dependencies.cmake"].replaceAll("a".repeat(40), "b".repeat(40)));
        await fs.writeFile(path.join(sourceRoot, "scripts/builder-kit-export-policy.json"), "invalid live policy must not be read");
        const exporter = await import(pathToFileURL(path.join(sourceRoot, "scripts/export_kit.mjs")).href);
        const result = await exporter.exportKit(output, { sourceCommit, feedUrl: "https://feed.example/SYNTHETIC-COHORT" });
        assert.equal(existsSync(path.join(output, "kit/.DS_Store")), false);
        assert.equal(await fs.readFile(path.join(output, "kit/fixture.txt"), "utf8"), "committed payload\n");
        assert.equal(await fs.readFile(path.join(output, "README.md"), "utf8"), "committed template\n");
        assert.equal(JSON.parse(await fs.readFile(path.join(output, "package.json"), "utf8")).devDependencies.fixture, "1.0.0");
        assert.equal(JSON.parse(await fs.readFile(path.join(output, "package-lock.json"), "utf8")).packages["node_modules/fixture"].version, "1.0.0");
        const exportedToolchain = JSON.parse(await fs.readFile(path.join(output, "kit/toolchain.json"), "utf8"));
        assert.equal(exportedToolchain.cmaj.forkCommit, "a".repeat(40), "tool provenance comes from the asserted commit's build pin");
        assert.equal(exportedToolchain.cmaj.sha256, "", "export cannot invent an archive hash");
        assert.equal(result.sourceCommit, sourceCommit);
        assert.equal(result.feedConfigured, true);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});

test("the customer lock is the part of the repository lock its dependencies reach", () => {
    const monorepoLock = {
        lockfileVersion: 3,
        packages: {
            "": { devDependencies: { app: "^1.0.0", "monorepo-only": "1.0.0" } },
            "node_modules/app": { version: "1.2.0", dev: true, dependencies: { shared: "^2.0.0", nested: "1.0.0" }, optionalDependencies: { native: "1.0.0" }, peerDependencies: { peer: "*", "optional-peer": "*" }, peerDependenciesMeta: { "optional-peer": { optional: true } } },
            "node_modules/app/node_modules/nested": { version: "1.0.0", dev: true },
            "node_modules/nested": { version: "9.0.0", dev: true },
            "node_modules/shared": { version: "2.1.0", devOptional: true },
            "node_modules/native": { version: "1.0.0", dev: true, optional: true },
            "node_modules/peer": { version: "3.0.0", dev: true },
            "node_modules/optional-peer": { version: "1.0.0", dev: true },
            "node_modules/monorepo-only": { version: "1.0.0", dev: true },
        },
    };
    const lock = renderCustomerLock(monorepoLock, { name: "customer", devDependencies: { app: "^1.0.0" }, engines: { node: ">=22" } });

    assert.deepEqual(lock.packages[""], { name: "customer", devDependencies: { app: "^1.0.0" }, engines: { node: ">=22" } });
    assert.deepEqual(Object.keys(lock.packages).sort(), [
        "", "node_modules/app", "node_modules/app/node_modules/nested", "node_modules/native", "node_modules/peer", "node_modules/shared",
    ]);
    assert.equal(lock.packages["node_modules/app/node_modules/nested"].version, "1.0.0", "nested resolution wins over the hoisted copy");
    assert.deepEqual(lock.packages["node_modules/shared"], { version: "2.1.0", dev: true, optional: true });
    assert.equal(lock.packages["node_modules/peer"].dev, true);

    delete monorepoLock.packages["node_modules/peer"];
    assert.throws(() => renderCustomerLock(monorepoLock, { name: "customer", devDependencies: { app: "^1.0.0" } }), /no entry for peer \(needed by node_modules\/app\)/u);
});

test("the notices gate names every package kit/ui imports statically", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-notices-"));
    try {
        await fs.mkdir(path.join(scratch, "kit/ui/nested"), { recursive: true });
        await fs.writeFile(path.join(scratch, "kit/ui/view.tsx"), [
            'import { useState } from "react";',
            'import { jsx } from "react/jsx-runtime";',
            'export { atom } from "jotai/vanilla";',
            'import "./local.css";',
            'import fs from "node:fs";',
            'const tools = () => import("dev-only-tool");',
        ].join("\n"));
        await fs.writeFile(path.join(scratch, "kit/ui/nested/slot.ts"), 'import { Slot } from "@radix-ui/react-slot";\n');
        await fs.writeFile(path.join(scratch, "THIRD_PARTY_NOTICES.md"), "- `react`: MIT.\n- `jotai`: MIT.\n");

        assert.deepEqual(await listShippedPackages(scratch), ["@radix-ui/react-slot", "jotai", "react"]);
        assert.deepEqual(await findUnnoticedPackages(scratch), ["@radix-ui/react-slot"]);
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

test("export proof runs the customer package's canonical gates in a sibling copy and leaves the export untouched", async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-proof-contract-"));
    const scratch = path.join(parent, "export");
    const calls = [];
    try {
        await fs.mkdir(path.join(scratch, "kit"), { recursive: true });
        await fs.writeFile(path.join(scratch, "kit/AGENTS.md"), "exported\n");
        const proofRoot = await proveExport(scratch, {
            runCommand: (command, args, cwd) => calls.push({ command, args, cwd }),
            proveUpdateFlow: async (root) => {
                calls.push({ command: "update-flow", args: [], cwd: root });
                await fs.appendFile(path.join(root, "kit/AGENTS.md"), "marker\n");
            },
        });
        assert.equal(path.dirname(proofRoot), parent, "the proof copy is a sibling of the export");
        assert.notEqual(proofRoot, scratch);
        assert.deepEqual(calls, [
            { command: "npm", args: ["run", "typecheck"], cwd: proofRoot },
            { command: "npm", args: ["test"], cwd: proofRoot },
            { command: "node", args: ["kit/fx/build-effect.mjs", "enhancer-lite"], cwd: proofRoot },
            { command: "update-flow", args: [], cwd: proofRoot },
        ]);
        assert.equal(calls.length, canonicalProofCommands.length + 1);
        assert.equal(await fs.readFile(path.join(scratch, "kit/AGENTS.md"), "utf8"), "exported\n", "the export keeps no proof marker");
        assert.deepEqual(await fs.readdir(scratch), ["kit"], "the export gains no node_modules link or build output");
        assert.equal((await fs.lstat(path.join(proofRoot, "node_modules"))).isSymbolicLink(), true);
    } finally {
        await fs.rm(parent, { recursive: true, force: true });
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
    const module = await fs.readFile(path.join(repoRoot, "kit/cmake/dependencies.cmake"), "utf8");
    const feed = JSON.parse(await fs.readFile(path.join(repoRoot, "kit/feed.json"), "utf8"));

    // Monorepo: GitHub origins, empty feed.
    assert.equal(feed.baseUrl, "");
    assert.match(sources, /^set\(BUILDER_KIT_CMAJOR_GIT_URL "https:\/\/github\.com\/[^"]+\/cmajor\.git"\)$/mu);
    assert.equal(sources.includes(officialJuceLine), true);
    const statements = sources.split("\n").filter((line) => line.trim() !== "" && !line.startsWith("#"));
    assert.deepEqual(statements.map((line) => line.split(" ")[0]), ["set(BUILDER_KIT_CMAJOR_GIT_URL", "set(BUILDER_KIT_JUCE_GIT_URL"]);

    // The dependency module consumes the seam and carries no origin of its own.
    assert.match(module, /include\("\$\{CMAKE_CURRENT_LIST_DIR\}\/dependency-sources\.cmake"\)/u);
    assert.match(module, /GIT_REPOSITORY "\$\{BUILDER_KIT_CMAJOR_GIT_URL\}"/u);
    assert.match(module, /GIT_REPOSITORY "\$\{BUILDER_KIT_JUCE_GIT_URL\}"/u);
    assert.doesNotMatch(module, /github\.com/u);

    // Rendering swaps only the Cmajor line.
    const rendered = renderDependencySources(sources, "https://feed.example.invalid/k/abc");
    assert.equal(rendered.includes('set(BUILDER_KIT_CMAJOR_GIT_URL "https://feed.example.invalid/k/abc/cmajor.git")'), true);
    assert.equal(rendered.includes(officialJuceLine), true);
    assert.doesNotMatch(rendered, /github\.com\/[^"]+\/cmajor\.git/u);
    assert.throws(() => renderDependencySources("set(BUILDER_KIT_JUCE_GIT_URL \"x\")\n", "https://f"), /exactly once, found 0/u);

    assert.equal(normalizeBaseUrl("https://feed.example.invalid/k/abc/"), "https://feed.example.invalid/k/abc");
    assert.equal(normalizeBaseUrl(""), "");
    assert.equal(normalizeBaseUrl("http://127.0.0.1:8080/k"), "http://127.0.0.1:8080/k", "plain http only for a local test feed");
    for (const invalid of ["feed.example.invalid/k", "ftp://feed.example.invalid/k", "http://feed.example.invalid/k"])
        assert.throws(() => normalizeBaseUrl(invalid), /absolute https URL/u);
});

test("export_produces_a_gated_starter_tree_with_no_private_material", async () => {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-export-"));
    const outputRoot = path.join(scratch, "starter");
    try {
        const { fileCount, feedConfigured } = await exportKit(outputRoot);
        assert.equal(fileCount > 50, true);
        assert.equal(feedConfigured, false);

        for (const required of ["kit/AGENTS.md", "kit/fx/build-effect.mjs", "fx/enhancer_lite/EnhancerLite.cmajorpatch", "package.json", "package-lock.json", "README.md", "EXPORT_MANIFEST.json"]) {
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
        assert.equal(skillNames.includes("make-plugin"), true);
        assert.deepEqual((await fs.readdir(path.join(outputRoot, ".agents/skills"))).sort(), skillNames);
        for (const skillName of skillNames) {
            const skillLink = await fs.readlink(path.join(outputRoot, ".agents/skills", skillName));
            assert.equal(skillLink, `../../kit/skills/${skillName}`);
            assert.equal(existsSync(path.join(outputRoot, ".agents/skills", skillName, "SKILL.md")), true, `${skillName} link is dangling`);
        }
        const packageManifest = JSON.parse(await fs.readFile(path.join(outputRoot, "package.json"), "utf8"));
        const packageLock = JSON.parse(await fs.readFile(path.join(outputRoot, "package-lock.json"), "utf8"));
        const monorepoLock = JSON.parse(await fs.readFile(path.join(repoRoot, "package-lock.json"), "utf8"));
        assert.deepEqual(packageLock.packages[""].devDependencies, packageManifest.devDependencies);
        for (const name of Object.keys(packageManifest.devDependencies))
            assert.ok(packageLock.packages[`node_modules/${name}`], `the lock resolves ${name}`);
        for (const [location, entry] of Object.entries(packageLock.packages).filter(([location]) => location !== ""))
            assert.equal(entry.version, monorepoLock.packages[location]?.version, `${location} installs the version this repository tests with`);
        assert.deepEqual(await findUnnoticedPackages(outputRoot), []);
        assert.deepEqual(Object.keys(packageManifest.scripts).sort(), [
            "cmajplugin:install", "fx:build", "fx:dev", "fx:jit:install", "fx:prod:build", "fx:prod:install",
            "kit:doctor", "kit:new", "kit:setup", "test", "test:browser", "test:dsp", "test:filters", "test:knobs", "test:mseg",
            "test:sliders", "typecheck", "ui:docs:build", "ui:docs:dev",
        ], "the customer package carries customer commands only");
        assert.equal(packageManifest.name, "builder-kit-project");
        assert.deepEqual(packageManifest.engines, { node: ">=22" });
        assert.deepEqual(packageLock.packages[""].engines, packageManifest.engines);
        const notices = await fs.readFile(path.join(outputRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
        for (const name of Object.keys(packageManifest.devDependencies))
            assert.ok(notices.includes(`\`${name}\``), `THIRD_PARTY_NOTICES.md must name ${name}`);
        const firstUse = await fs.readFile(path.join(outputRoot, "README.md"), "utf8");
        assert.match(firstUse, /^> Read AGENTS\.md, check this existing project without overwriting anything, run$/mu);
        assert.match(firstUse, /the strict doctor from this exact folder, use setup only if a reported problem\n> needs it, then ask what I want to build or modify\./u);
        assert.match(firstUse, /offer to build the included plugin as-is, change its sound or\ninterface, or start a new plugin/u);
        assert.match(firstUse, /## If you choose to build the included plugin as-is/u);
        assert.match(firstUse, /follow this section only\nwhen you choose to build the included plugin as-is/u);
        assert.match(firstUse, /Included Enhance That, Unchanged/u);
        assert.match(firstUse, /authoritative procedure/u);
        assert.doesNotMatch(firstUse, /npm run fx:prod:build -- enhancer-lite/u, "the README does not duplicate the skill procedure");
        assert.match(firstUse, /must not copy or rename the included plug-in, create a new plug-in or\ntest, edit plug-in\/test source/u);
        assert.match(firstUse, /Build\/install success is not a listening or DAW-acceptance result, and\nthe agent does not launch a DAW or begin a tutorial unless you ask for help\./u);
        assert.match(firstUse, /Enhance That is built and installed/u);
        assert.match(firstUse, /http:\/\/127\.0\.0\.1:5175\/fx\/enhancer_lite\/view\/harness\.html/u);

        const pluginSkill = await fs.readFile(path.join(outputRoot, "kit/skills/make-plugin/SKILL.md"), "utf8");
        assert.match(pluginSkill, /## Included Enhance That, Unchanged/u);
        assert.match(pluginSkill, /npm run typecheck\nnpm test\nnpm run fx:prod:build -- enhancer-lite\nnpm run fx:prod:install -- enhancer-lite/u);
        assert.match(pluginSkill, /Enhance That is built and installed\.\nInstalled at: <exact path printed by fx:prod:install>/u);

        // A cold reader gets a short conditional index whose exported links resolve.
        const rootGuidance = await fs.readFile(path.join(outputRoot, "AGENTS.md"), "utf8");
        const kitGuidancePath = path.join(outputRoot, "kit/AGENTS.md");
        const kitGuidance = await fs.readFile(kitGuidancePath, "utf8");
        assert.match(rootGuidance, /follow only the route that\nmatches the task/u);
        assert.doesNotMatch(rootGuidance, /read `kit\/AGENTS\.md` fully/iu);
        for (const requiredRoute of ["PLUGIN_ARCHITECTURE.md", "RELEASE_VERIFICATION.md", "HOST_COMPATIBILITY.md", "TOOLCHAIN.md", "make-plugin/SKILL.md"]) {
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
        assert.equal(sources.includes('set(BUILDER_KIT_CMAJOR_GIT_URL "https://feed.example.invalid/k/abc123/cmajor.git")'), true);
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
        assert.match(invalid.message, /absolute https URL/u);
        assert.equal(invalid.message.includes(invalidSentinel), false);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
});
