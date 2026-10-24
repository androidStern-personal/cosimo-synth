// Builder Kit export. Copies exactly the allowlisted paths of one commit into
// an output directory shaped as a customer project, materializes the root
// template (package.json, and a package-lock.json cut from this repository's
// own lock so customers install the versions tested here), then runs the
// gates. The export fails if an allowlisted path is missing, if any output
// file falls outside the allowlist, if a forbidden string appears in any text
// output, or if a package the kit's UI code imports is missing from
// THIRD_PARTY_NOTICES.md. With --prove it also copies the export to a sibling
// directory and, in that copy, runs the package's typecheck and tests, builds
// Enhance That and simulates a customer update merge, so the named export
// stays exactly as exported. The proof reuses the export's node_modules when
// it has one (CI runs npm ci there first), otherwise this repository's.
//
// Feed stamping: when kit/feed.json carries a non-empty baseUrl, or the
// release command supplies one, the exported kit/cmake/dependency-sources.cmake
// points the Cmajor fork at <baseUrl>/cmajor.git. JUCE keeps its official URL.
//
// Usage: node scripts/export_kit.mjs <outputDir> [--force] [--prove]

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { isMainModule } from "../kit/scripts/common.mjs";
import { normalizeBaseUrl } from "../kit/scripts/toolchain.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowlistRelativePath = "scripts/builder-kit-export-policy.json";

/** The Cmajor fork pin (commit + URL) as declared under kit/cmake. */
export function readCmajorPin(kitRoot = path.join(repoRoot, "kit")) {
    const dependencies = readFileSync(path.join(kitRoot, "cmake/dependencies.cmake"), "utf8");
    const block = dependencies.match(/NAME\s+builder_kit_cmajor\b([\s\S]*?)\)/);
    if (!block) throw new Error("dependencies.cmake: no CPMAddPackage block named builder_kit_cmajor.");
    // The tag is either a literal commit or the shared BUILDER_KIT_CMAJOR_PINNED_COMMIT
    // variable (one pin for the plugin and toolchain packages).
    let commit = block[1].match(/GIT_TAG\s+"([0-9a-f]{40})"/)?.[1] ?? null;
    if (!commit && /GIT_TAG\s+"\$\{BUILDER_KIT_CMAJOR_PINNED_COMMIT\}"/.test(block[1])) {
        commit = dependencies.match(/set\(BUILDER_KIT_CMAJOR_PINNED_COMMIT\s+"([0-9a-f]{40})"\)/)?.[1] ?? null;
    }
    if (!commit) throw new Error("dependencies.cmake: builder_kit_cmajor GIT_TAG must be a full 40-hex commit (literal or BUILDER_KIT_CMAJOR_PINNED_COMMIT).");

    let url = block[1].match(/GIT_REPOSITORY\s+"(https?:\/\/[^"]+)"/)?.[1] ?? null;
    if (!url) {
        const sourcesPath = path.join(kitRoot, "cmake/dependency-sources.cmake");
        if (existsSync(sourcesPath)) {
            const sources = readFileSync(sourcesPath, "utf8");
            url = sources.match(/set\(BUILDER_KIT_CMAJOR_GIT_URL\s+"([^"]+)"\)/)?.[1] ?? null;
        }
    }
    if (!url) throw new Error("Could not find the Cmajor fork URL (GIT_REPOSITORY or BUILDER_KIT_CMAJOR_GIT_URL) under kit/cmake.");
    return { commit, url };
}

export async function readAllowlist({ sourceCommit = "HEAD" } = {}) {
    return JSON.parse(execFileSync("git", ["-C", repoRoot, "show", `${sourceCommit}:${allowlistRelativePath}`], { encoding: "utf8" }));
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

/** The package that owns an import specifier ("react/jsx-runtime" -> "react", "@a/b/c" -> "@a/b"). */
function packageName(specifier) {
    const parts = specifier.split("/");
    return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * The npm packages kit/ui imports statically. Those are bundled into every
 * plugin UI, so they ship to the customer's users and need a notice. Dynamic
 * imports are left out: they load development tools in the dev server only.
 */
export async function listShippedPackages(outputRoot) {
    const packages = new Set();

    for (const filePath of await listFilesRecursive(path.join(outputRoot, "kit/ui"))) {
        if (!/\.(?:js|mjs|ts|tsx)$/u.test(filePath))
            continue;

        const source = await fs.readFile(filePath, "utf8");

        for (const match of source.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']/gmu)) {
            const specifier = match[1] ?? match[2];

            if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:"))
                packages.add(packageName(specifier));
        }
    }

    return [...packages].sort();
}

/** R1: every shipped package is named (in backticks) by THIRD_PARTY_NOTICES.md. */
export async function findUnnoticedPackages(outputRoot) {
    const notices = await fs.readFile(path.join(outputRoot, "THIRD_PARTY_NOTICES.md"), "utf8");

    return (await listShippedPackages(outputRoot)).filter((name) => !notices.includes(`\`${name}\``));
}

/**
 * The customer's package-lock.json: the part of this repository's lock that
 * the customer's devDependencies reach, so `npm ci` in an exported tree
 * installs exactly the versions this repository tests with. Every customer
 * dependency is a devDependency, so every entry is marked dev.
 */
export function renderCustomerLock(monorepoLock, customerPackage) {
    const packages = monorepoLock?.packages;

    if (monorepoLock?.lockfileVersion !== 3 || packages === undefined)
        throw new Error("package-lock.json must be a lockfileVersion 3 lock. Run npm install with npm 9 or newer.");

    const included = new Map();
    const resolve = (fromPath, name) => {
        let base = fromPath;
        for (;;) {
            const candidate = base === "" ? `node_modules/${name}` : `${base}/node_modules/${name}`;
            if (packages[candidate]) return candidate;
            if (base === "") return null;
            const parent = base.lastIndexOf("/node_modules/");
            base = parent === -1 ? "" : base.slice(0, parent);
        }
    };
    const visit = (fromPath, name, optional) => {
        const location = resolve(fromPath, name);
        if (location === null) {
            if (optional) return;
            throw new Error(`package-lock.json has no entry for ${name} (needed by ${fromPath || "the customer package"}). Run npm install, then export again.`);
        }
        if (included.has(location)) return;
        const entry = packages[location];
        included.set(location, entry);
        for (const dependency of Object.keys(entry.dependencies ?? {})) visit(location, dependency, false);
        for (const dependency of Object.keys(entry.optionalDependencies ?? {})) visit(location, dependency, true);
        for (const dependency of Object.keys(entry.peerDependencies ?? {})) {
            if (entry.peerDependenciesMeta?.[dependency]?.optional !== true) visit(location, dependency, false);
        }
    };

    for (const name of Object.keys(customerPackage.devDependencies ?? {})) visit("", name, false);

    const lock = {
        name: customerPackage.name,
        lockfileVersion: 3,
        requires: true,
        packages: {
            "": {
                name: customerPackage.name,
                devDependencies: customerPackage.devDependencies,
                ...(customerPackage.engines ? { engines: customerPackage.engines } : {}),
            },
        },
    };

    for (const location of [...included.keys()].sort()) {
        const { dev: _dev, devOptional, optional, ...entry } = included.get(location);
        lock.packages[location] = { ...entry, dev: true, ...(optional || devOptional ? { optional: true } : {}) };
    }

    return lock;
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

async function materializeRootTemplate(outputRoot, allowlist, sourceRoot) {
    const templateRoot = path.join(sourceRoot, "kit/template/root");
    const written = [];

    const rootPackage = JSON.parse(await fs.readFile(path.join(sourceRoot, "package.json"), "utf8"));
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
                JSON.stringify(devDependencies, null, 2).replace(/\n/g, "\n  "),
            );
            const customerPackage = JSON.parse(rendered);
            const monorepoLock = JSON.parse(await fs.readFile(path.join(sourceRoot, "package-lock.json"), "utf8"));
            await fs.writeFile(path.join(outputRoot, "package.json"), rendered);
            await fs.writeFile(path.join(outputRoot, "package-lock.json"), `${JSON.stringify(renderCustomerLock(monorepoLock, customerPackage), null, 2)}\n`);
            written.push("package.json", "package-lock.json");
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

const cmajorGitUrlLine = /^set\(BUILDER_KIT_CMAJOR_GIT_URL "[^"\n]*"\)$/mu;

/** Rewrites the Cmajor fork URL in dependency-sources.cmake to the feed mirror; JUCE stays official. */
export function renderDependencySources(source, feedBaseUrl) {
    const matches = source.match(new RegExp(cmajorGitUrlLine.source, "gmu")) ?? [];
    if (matches.length !== 1) {
        throw new Error(`dependency-sources.cmake must set BUILDER_KIT_CMAJOR_GIT_URL exactly once, found ${matches.length}.`);
    }
    return source.replace(cmajorGitUrlLine, `set(BUILDER_KIT_CMAJOR_GIT_URL "${feedBaseUrl}/cmajor.git")`);
}

async function stampFeed(outputRoot, feedUrl) {
    const feedPath = path.join(outputRoot, "kit/feed.json");
    const feed = JSON.parse(await fs.readFile(feedPath, "utf8"));
    const feedBaseUrl = normalizeBaseUrl(feedUrl ?? feed.baseUrl, "Feed URL");

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

async function copyCommittedSource(outputRoot, allowlist, sourceCommit) {
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "kit-committed-source-"));
    const sourceRoot = path.join(scratch, "tree");
    try {
        await fs.mkdir(sourceRoot);
        const archive = path.join(scratch, "source.tar");
        const paths = [...new Set([...allowlist.trees, ...allowlist.files, "kit/template/root", "package.json", "package-lock.json"])];
        execFileSync("git", ["-C", repoRoot, "archive", "--format=tar", `--output=${archive}`, sourceCommit, "--", ...paths], { stdio: "pipe" });
        execFileSync("tar", ["-xf", archive, "-C", sourceRoot], { stdio: "pipe" });
        for (const tree of allowlist.trees) {
            await copyTree(path.join(sourceRoot, tree), path.join(outputRoot, tree));
        }
        for (const file of allowlist.files) {
            await fs.mkdir(path.dirname(path.join(outputRoot, file)), { recursive: true });
            await fs.cp(path.join(sourceRoot, file), path.join(outputRoot, file));
        }
        return await materializeRootTemplate(outputRoot, allowlist, sourceRoot);
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
}

/** Export committed source only; feed stamping and root templating are explicit derived output. */
export async function exportKit(outputDir, { force = false, feedUrl = null, sourceCommit: requestedCommit = null } = {}) {
    if (requestedCommit !== null && !/^[0-9a-f]{40}$/u.test(requestedCommit)) {
        throw new Error("Export sourceCommit must be a full commit SHA.");
    }
    const sourceCommit = execFileSync("git", ["-C", repoRoot, "rev-parse", "--verify", `${requestedCommit ?? "HEAD"}^{commit}`], { encoding: "utf8" }).trim();
    const allowlist = await readAllowlist({ sourceCommit });
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

    const templateFiles = await copyCommittedSource(outputRoot, allowlist, sourceCommit);
    // Customer provenance is derived from the same committed declaration used
    // by both the native SDK and tool producer, never a second authored pin.
    const toolchainPath = path.join(outputRoot, "kit/toolchain.json");
    const toolchain = JSON.parse(await fs.readFile(toolchainPath, "utf8"));
    toolchain.cmaj.forkCommit = readCmajorPin(path.join(outputRoot, "kit")).commit;
    await fs.writeFile(toolchainPath, `${JSON.stringify(toolchain, null, 2)}\n`);
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
    const unnoticed = await findUnnoticedPackages(outputRoot);
    if (unnoticed.length) {
        throw new Error(`Export gate failed — kit/ui bundles packages that THIRD_PARTY_NOTICES.md does not name: ${unnoticed.join(", ")}. `
            + "Add each one with its license to kit/template/root/THIRD_PARTY_NOTICES.md.");
    }

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
    await fs.appendFile(path.join(outputRoot, "fx/enhancer_lite/view/source.tsx"), "\n// customer change marker\n");
    git("commit", "--quiet", "-am", "Customer plugin change");
    git("merge", "--quiet", "--no-edit", "kit-update");
    const merged = await fs.readFile(path.join(outputRoot, "kit/AGENTS.md"), "utf8");
    const customer = await fs.readFile(path.join(outputRoot, "fx/enhancer_lite/view/source.tsx"), "utf8");
    if (!merged.includes("kit update marker") || !customer.includes("customer change marker")) {
        throw new Error("Update-flow simulation failed: merge lost a change.");
    }
}

/**
 * Prove a copy of the export: the gates build into it and the update-flow
 * simulation commits into it, so the export itself is left untouched. Returns
 * the copy's path, a fresh sibling of the export unless proofRoot names one.
 */
export async function proveExport(outputRoot, {
    proofRoot = null,
    runCommand = run,
    proveUpdateFlow = proveUpdateMerge,
} = {}) {
    const exportRoot = path.resolve(outputRoot);
    let proof;
    if (proofRoot) {
        proof = path.resolve(proofRoot);
        await fs.rm(proof, { recursive: true, force: true });
    } else {
        proof = await fs.mkdtemp(`${exportRoot}-proof-`);
    }
    const exportNodeModules = path.join(exportRoot, "node_modules");
    await fs.cp(exportRoot, proof, { recursive: true, filter: (source) => source !== exportNodeModules });
    // Reuse installed dependencies rather than installing again: the export's
    // own when CI has run npm ci there, otherwise this repository's.
    await fs.symlink(existsSync(exportNodeModules) ? exportNodeModules : path.join(repoRoot, "node_modules"),
        path.join(proof, "node_modules"));

    for (const [command, args] of canonicalProofCommands) {
        runCommand(command, [...args], proof);
    }
    await proveUpdateFlow(proof, runCommand);
    return proof;
}

if (isMainModule(import.meta.url)) {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter((arg) => arg.startsWith("--")));
    const positional = args.filter((arg) => !arg.startsWith("--"));
    const unknownFlags = [...flags].filter((flag) => !["--force", "--prove"].includes(flag));
    if (positional.length !== 1 || unknownFlags.length) {
        console.error("Usage: node scripts/export_kit.mjs <outputDir> [--force] [--prove]");
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
            const proofRoot = await proveExport(outputRoot);
            console.log(`Standalone proof passed in ${proofRoot}: canonical typecheck/test, enhancer-lite build, update-flow merge.`);
            console.log(`The export in ${outputRoot} is unchanged.`);
        }
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
