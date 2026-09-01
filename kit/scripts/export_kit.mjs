// Builder Kit export (plan 4.1/4.2). Copies exactly the allowlisted paths
// from this monorepo into an output directory shaped as the customer starter
// monorepo, materializes the root template, then runs the leak gates. The
// export FAILS (non-zero exit) if an allowlisted path is missing, if any
// output file falls outside the allowlist, or if a forbidden string appears
// in any text output. With --prove it also builds Enhancer Lite and runs the
// kit unit tests inside the exported tree (node_modules symlinked from this
// repo), plus a git merge simulation of the customer update flow.
//
// Usage: node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove]

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowlistPath = path.join(repoRoot, "kit/export-allowlist.json");

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
        // The allowlist itself defines the forbidden terms.
        if (path.relative(outputRoot, filePath) === "kit/export-allowlist.json") {
            continue;
        }
        if (binaryExtensions.has(path.extname(filePath))) {
            continue;
        }
        const stat = await fs.lstat(filePath);
        if (stat.isSymbolicLink()) {
            continue;
        }
        const text = await fs.readFile(filePath, "utf8").catch(() => "");
        for (const needle of allowlist.forbiddenStrings) {
            if (text.includes(needle)) {
                violations.push({ file: path.relative(outputRoot, filePath), needle });
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

    // Root skill discovery: committed-style relative symlink into kit/.
    await fs.mkdir(path.join(outputRoot, ".agents/skills"), { recursive: true });
    const linkPath = path.join(outputRoot, ".agents/skills/cosimo-make-plugin");
    await fs.symlink("../../kit/skills/cosimo-make-plugin", linkPath);
    written.push(".agents/skills/cosimo-make-plugin");

    return written;
}

export async function exportKit(outputDir, { force = false } = {}) {
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
        const lines = violations.map(({ file, needle }) => `${file}: ${needle}`);
        throw new Error(`Export gate failed — forbidden strings present:\n  ${lines.join("\n  ")}`);
    }

    const sourceCommit = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const fileCount = (await listFilesRecursive(outputRoot)).length;
    await fs.writeFile(
        path.join(outputRoot, "EXPORT_MANIFEST.json"),
        `${JSON.stringify({ sourceCommit, fileCount, allowlist: "kit/export-allowlist.json" }, null, 2)}\n`,
    );

    return { outputRoot, fileCount, sourceCommit };
}

function run(command, args, cwd) {
    execFileSync(command, args, { cwd, stdio: "pipe", encoding: "utf8" });
}

export async function proveExport(outputRoot) {
    // The container shortcut: reuse the monorepo's installed dependencies. A
    // real customer machine runs `npm install` instead.
    const nodeModules = path.join(outputRoot, "node_modules");
    if (!existsSync(nodeModules)) {
        await fs.symlink(path.join(repoRoot, "node_modules"), nodeModules);
    }

    run("node", ["kit/fx/build-effect.mjs", "enhancer-lite"], outputRoot);
    run("node", [
        "--test",
        "kit/tests/test_effect_state_contract.mjs",
        "kit/tests/test_effect_snapshots.mjs",
        "kit/tests/test_effect_view_loader.mjs",
        "kit/tests/test_effect_factory_preset_contract.mjs",
        "kit/tests/test_standalone_preset_import_graph.mjs",
        "tests/test_enhancer_lite_state.mjs",
    ], outputRoot);

    // Customer update-flow simulation: a starter repo takes a local plugin
    // edit, then merges a kit update; both survive without conflict.
    const git = (...args) => run("git", ["-C", outputRoot, ...args]);
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

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter((arg) => arg.startsWith("--")));
    const positional = args.filter((arg) => !arg.startsWith("--"));
    if (positional.length !== 1) {
        console.error("Usage: node kit/scripts/export_kit.mjs <outputDir> [--force] [--prove]");
        process.exit(1);
    }
    try {
        const { outputRoot, fileCount, sourceCommit } = await exportKit(positional[0], { force: flags.has("--force") });
        console.log(`Exported ${fileCount} files from ${sourceCommit.slice(0, 9)} to ${outputRoot}`);
        if (flags.has("--prove")) {
            await proveExport(outputRoot);
            console.log("Standalone proof passed: enhancer-lite build, kit unit tests, update-flow merge.");
        }
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
