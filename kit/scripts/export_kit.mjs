// Builder Kit export (plan 4.1/4.2). Copies exactly the allowlisted paths
// from this monorepo into an output directory shaped as the customer starter
// monorepo, materializes the root template, then runs the leak gates. The
// export FAILS (non-zero exit) if an allowlisted path is missing, if any
// output file falls outside the allowlist, or if a forbidden string appears
// in any text output. With --prove it also builds Enhancer Lite and runs the
// kit unit tests inside the exported tree (node_modules symlinked from this
// repo), plus a git merge simulation of the customer update flow. The proof
// deliberately invokes the exported package's canonical typecheck and test
// scripts rather than maintaining a second, narrower test list here.
//
// Feed stamping: when kit/feed.json carries a non-empty baseUrl, or
// a redacted feed value is supplied programmatically by the maintainer-only
// release command, the exported kit/cmake/dependency-sources.cmake points the
// Cmajor fork at <baseUrl>/cmajor.git. JUCE keeps its official URL.
//
// Usage: node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove]

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowlistPath = path.join(repoRoot, "scripts/builder-kit-export-policy.json");

export async function readAllowlist() {
    return JSON.parse(await fs.readFile(allowlistPath, "utf8"));
}

async function copyTree(fromRoot, toRoot) {
    await fs.cp(fromRoot, toRoot, { recursive: true, verbatimSymlinks: true });
}

async function listFilesRecursive(root) {
    const results = [];
    const walk = async (dir) => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else {
                results.push(full);
            }
        }
    };
    await walk(root);
    return results;
}

export async function scanForForbiddenStrings(outputRoot, allowlist) {
    const binaryExtensions = new Set(allowlist.forbiddenStringBinaryExtensions ?? []);
    const violations = [];

    for (const filePath of await listFilesRecursive(outputRoot)) {
        if (binaryExtensions.has(path.extname(filePath))) {
            continue;
        }
        const stat = await fs.lstat(filePath);
        if (stat.isSymbolicLink()) {
            continue;
        }
        const text = await fs.readFile(filePath, "utf8").catch(() => "");
        for (const [index, needle] of allowlist.forbiddenStrings.entries()) {
            if (text.includes(needle)) {
                violations.push({ file: path.relative(outputRoot, filePath), ruleId: `forbidden-string-${index + 1}` });
            }
        }
    }

    return violations;
}

export async function verifyOutputWithinAllowlist(outputRoot, allowlist, templateFiles) {
    const allowedPrefixes = allowlist.trees.map((tree) => `${tree}${path.sep}`);
    const allowedFiles = new Set([...allowlist.files, ...templateFiles, "EXPORT_MANIFEST.json"]);
    const strays = [];

    for (const filePath of await listFilesRecursive(outputRoot)) {
        const relative = path.relative(outputRoot, filePath);
        const inTree = allowedPrefixes.some((prefix) => relative.startsWith(prefix));
        if (!inTree && !allowedFiles.has(relative)) {
            strays.push(relative);
        }
    }

    return strays;
}

async function materializeRootTemplate(outputRoot, allowlist) {
    const templateRoot = path.join(repoRoot, "kit/template/root");
    const written = [];

    const rootPackage = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    const devDependencies = { ...allowlist.templateExplicitDevDependencies };
    for (const name of allowlist.templateDevDependencyNames) {
        const version = rootPackage.devDependencies?.[name] ?? rootPackage.dependencies?.[name];
        if (!version) {
            throw new Error(`Template dev dependency "${name}" is missing from the monorepo package.json.`);
        }
        devDependencies[name] = version;
    }

    for (const entry of await fs.readdir(templateRoot)) {
        const sourcePath = path.join(templateRoot, entry);
        if (entry === "package.json.template") {
            const template = await fs.readFile(sourcePath, "utf8");
            const rendered = template.replace(
                '"__DEV_DEPENDENCIES__"',
                JSON.stringify(devDependencies, null, 4).replace(/\n/g, "\n  "),
            );
            JSON.parse(rendered); // must stay valid JSON
            await fs.writeFile(path.join(outputRoot, "package.json"), rendered);
            written.push("package.json");
        } else {
            await fs.cp(sourcePath, path.join(outputRoot, entry));
            written.push(entry);
        }
    }

    // Root skill discovery: one committed-style relative symlink into kit/ for
    // every skill directory the export carries.
    await fs.mkdir(path.join(outputRoot, ".agents/skills"), { recursive: true });
    for (const skillName of await listExportedSkillNames(outputRoot)) {
        const linkPath = path.join(outputRoot, ".agents/skills", skillName);
        await fs.symlink(`../../kit/skills/${skillName}`, linkPath);
        written.push(`.agents/skills/${skillName}`);
    }

    return written;
}

export async function listExportedSkillNames(outputRoot) {
    const entries = await fs.readdir(path.join(outputRoot, "kit/skills"), { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

const cmajorGitUrlLine = /^set\(COSIMO_CMAJOR_GIT_URL "[^"\n]*"\)$/mu;

export function normalizeFeedBaseUrl(feedUrl) {
    if (typeof feedUrl !== "string" || feedUrl.trim() === "") {
        return "";
    }
    let parsed;
    try {
        parsed = new URL(feedUrl.trim());
    } catch {
        throw new Error("Feed URL must be an absolute http(s) URL.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Feed URL must be an absolute http(s) URL.");
    }
    return parsed.toString().replace(/\/+$/u, "");
}

/** Rewrites the Cmajor fork URL in dependency-sources.cmake to the feed mirror; JUCE stays official. */
export function renderDependencySources(source, feedBaseUrl) {
    const matches = source.match(new RegExp(cmajorGitUrlLine.source, "gmu")) ?? [];
    if (matches.length !== 1) {
        throw new Error(`dependency-sources.cmake must set COSIMO_CMAJOR_GIT_URL exactly once, found ${matches.length}.`);
    }
    return source.replace(cmajorGitUrlLine, `set(COSIMO_CMAJOR_GIT_URL "${feedBaseUrl}/cmajor.git")`);
}

async function stampFeed(outputRoot, feedUrl) {
    const feedPath = path.join(outputRoot, "kit/feed.json");
    const feed = JSON.parse(await fs.readFile(feedPath, "utf8"));
    const feedBaseUrl = feedUrl === null ? normalizeFeedBaseUrl(feed.baseUrl) : normalizeFeedBaseUrl(feedUrl);

    if (feedUrl !== null) {
        if (feedBaseUrl === "") {
            throw new Error("The programmatic release feed value must not be empty.");
        }
        feed.baseUrl = feedBaseUrl;
        await fs.writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`);
    }
    if (feedBaseUrl === "") {
        return "";
    }

    const sourcesPath = path.join(outputRoot, "kit/cmake/dependency-sources.cmake");
    const rendered = renderDependencySources(await fs.readFile(sourcesPath, "utf8"), feedBaseUrl);
    await fs.writeFile(sourcesPath, rendered);
    return feedBaseUrl;
}

export async function exportKit(outputDir, { force = false, feedUrl = null } = {}) {
    const allowlist = await readAllowlist();
    const outputRoot = path.resolve(outputDir);

    if (!outputRoot.startsWith(path.sep) || outputRoot === repoRoot || outputRoot.startsWith(repoRoot + path.sep)) {
        throw new Error("Refusing to export inside the monorepo. Pick an outside output directory.");
    }
    if (existsSync(outputRoot)) {
        if (!force) {
            throw new Error(`${outputRoot} already exists. Pass --force to replace it.`);
        }
        await fs.rm(outputRoot, { recursive: true, force: true });
    }
    await fs.mkdir(outputRoot, { recursive: true });

    for (const tree of allowlist.trees) {
        const from = path.join(repoRoot, tree);
        if (!existsSync(from)) {
            throw new Error(`Allowlisted tree is missing from the monorepo: ${tree}`);
        }
        await copyTree(from, path.join(outputRoot, tree));
    }
    for (const file of allowlist.files) {
        const from = path.join(repoRoot, file);
        if (!existsSync(from)) {
            throw new Error(`Allowlisted file is missing from the monorepo: ${file}`);
        }
        await fs.mkdir(path.dirname(path.join(outputRoot, file)), { recursive: true });
        await fs.cp(from, path.join(outputRoot, file));
    }

    const templateFiles = await materializeRootTemplate(outputRoot, allowlist);
    const feedBaseUrl = await stampFeed(outputRoot, feedUrl);

    // Gates.
    const missing = allowlist.requiredOutputs.filter((relative) => !existsSync(path.join(outputRoot, relative)));
    if (missing.length) {
        throw new Error(`Export gate failed — required outputs missing:\n  ${missing.join("\n  ")}`);
    }
    const strays = await verifyOutputWithinAllowlist(outputRoot, allowlist, templateFiles);
    if (strays.length) {
        throw new Error(`Export gate failed — files outside the allowlist:\n  ${strays.join("\n  ")}`);
    }
    const violations = await scanForForbiddenStrings(outputRoot, allowlist);
    if (violations.length) {
        const lines = violations.map(({ file, ruleId }) => `${file}: ${ruleId}`);
        throw new Error(`Export gate failed — forbidden strings present:\n  ${lines.join("\n  ")}`);
    }

    const sourceCommit = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const fileCount = (await listFilesRecursive(outputRoot)).length;
    await fs.writeFile(
        path.join(outputRoot, "EXPORT_MANIFEST.json"),
        `${JSON.stringify({ sourceCommit, fileCount, feedConfigured: feedBaseUrl !== "" }, null, 2)}\n`,
    );

    return { outputRoot, fileCount, sourceCommit, feedConfigured: feedBaseUrl !== "" };
}

function run(command, args, cwd) {
    execFileSync(command, args, { cwd, stdio: "pipe", encoding: "utf8" });
}

export const canonicalProofCommands = Object.freeze([
    Object.freeze(["npm", Object.freeze(["run", "typecheck"])]),
    Object.freeze(["npm", Object.freeze(["test"])]),
    Object.freeze(["node", Object.freeze(["kit/fx/build-effect.mjs", "enhancer-lite"])]),
]);

async function proveUpdateMerge(outputRoot, runCommand) {
    const git = (...args) => runCommand("git", ["-C", outputRoot, ...args], outputRoot);
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.email", "proof@example.invalid");
    git("config", "user.name", "Export Proof");
    git("add", "-A");
    git("commit", "--quiet", "-m", "Builder Kit starter");
    git("checkout", "--quiet", "-b", "kit-update");
    await fs.appendFile(path.join(outputRoot, "kit/AGENTS.md"), "\n<!-- kit update marker -->\n");
    git("commit", "--quiet", "-am", "Kit update");
    git("checkout", "--quiet", "main");
    await fs.appendFile(path.join(outputRoot, "fx/enhancer_lite/view/source.ts"), "\n// customer change marker\n");
    git("commit", "--quiet", "-am", "Customer plugin change");
    git("merge", "--quiet", "--no-edit", "kit-update");
    const merged = await fs.readFile(path.join(outputRoot, "kit/AGENTS.md"), "utf8");
    const customer = await fs.readFile(path.join(outputRoot, "fx/enhancer_lite/view/source.ts"), "utf8");
    if (!merged.includes("kit update marker") || !customer.includes("customer change marker")) {
        throw new Error("Update-flow simulation failed: merge lost a change.");
    }
}

export async function proveExport(outputRoot, {
    runCommand = run,
    proveUpdateFlow = proveUpdateMerge,
} = {}) {
    // The container shortcut: reuse the monorepo's installed dependencies. A
    // real customer machine runs `npm install` instead.
    const nodeModules = path.join(outputRoot, "node_modules");
    if (!existsSync(nodeModules)) {
        await fs.symlink(path.join(repoRoot, "node_modules"), nodeModules);
    }

    for (const [command, args] of canonicalProofCommands) {
        runCommand(command, [...args], outputRoot);
    }
    await proveUpdateFlow(outputRoot, runCommand);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter((arg) => arg.startsWith("--")));
    const positional = args.filter((arg) => !arg.startsWith("--"));
    const unknownFlags = [...flags].filter((flag) => !["--force", "--prove"].includes(flag));
    if (positional.length !== 1 || unknownFlags.length) {
        console.error("Usage: node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove]");
        process.exit(1);
    }
    try {
        const { outputRoot, fileCount, sourceCommit, feedConfigured } = await exportKit(positional[0], {
            force: flags.has("--force"),
        });
        console.log(`Exported ${fileCount} files from ${sourceCommit.slice(0, 9)} to ${outputRoot}`);
        if (feedConfigured) {
            console.log("Feed configuration is present in the exported customer contracts.");
        }
        if (flags.has("--prove")) {
            await proveExport(outputRoot);
            console.log("Standalone proof passed: canonical typecheck/test, enhancer-lite build, update-flow merge.");
        }
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
