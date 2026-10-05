// kit:doctor — read-only environment and registry report.
//
//   node kit/scripts/doctor.mjs [--json] [--strict] [--offline]
//
// Reports the kit version (kit/kit.json) and the config schema versions it
// supports, the machine against kit/toolchain.json (OS/arch/tool ranges), the
// selected compiler/Git and installer-owned Node/npm/CMake paths, the pinned
// cmaj / CmajPlugin.vst3 at their local paths, feed reachability, the
// plugin registry (fx/ discovery: every plugin folder that fails to load is a
// problem naming its file), product-owner.json, node_modules, and the JUCE
// acknowledgment. The default is a concise human readiness report; --json
// prints the full machine-readable report instead. Problems flip `ok`;
// warnings (an unreachable feed while every tool is current, placeholder
// owner identity) do not. Exits 0 always, unless --strict and a problem was
// found. Never writes.

import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { discoverEffectPlugins } from "../fx/build-effect.mjs";
import { isInsideDirectory, isMainModule, placeholderOwnerKeys, readJsonObject, readKitManifest } from "./common.mjs";

import {
    checkPlatform,
    describeMachine,
    feedPath,
    inspectTool,
    juceAcknowledgmentPath,
    readFeedBaseUrl,
    readJuceAcknowledgment,
    readToolchain,
    repoRoot,
    satisfiesRange,
    toolchainPath,
    toolKeys,
} from "./toolchain.mjs";

const feedTimeoutMs = 8000;

export function parseDoctorArguments(argv) {
    const options = { json: false, strict: false, offline: false };

    for (const argument of argv) {
        if (argument === "--json") options.json = true;
        else if (argument === "--strict") options.strict = true;
        else if (argument === "--offline") options.offline = true;
        else throw new Error("Unknown kit:doctor argument. Usage: kit:doctor [--json] [--strict] [--offline]");
    }

    return options;
}

function commandPath(command) {
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [command], { encoding: "utf8", timeout: 10000 });

    if (result.error || result.status !== 0)
        return null;

    return result.stdout.trim().split("\n")[0] || null;
}

function commandVersion(command, args = ["--version"], executable = command) {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 10000 });

    if (result.error || result.status !== 0)
        return { present: false, version: null, output: null, path: null };

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    const match = output.match(/\d+\.\d+(?:\.\d+)?/);

    return { present: true, version: match ? match[0] : null, output: output.split("\n")[0], path: commandPath(executable) };
}

function requirementLabel(range) {
    return typeof range === "string" && range.trim() !== "" ? range.trim() : "any";
}

function checkTool(name, probe, range) {
    const satisfied = probe.present ? satisfiesRange(probe.version, range) : false;

    return {
        name,
        present: probe.present,
        version: probe.version,
        path: probe.path ?? null,
        required: requirementLabel(range),
        ok: probe.present && satisfied !== false,
        projectLocal: null,
    };
}

function xcodeCommandLineTools(platform = process.platform, required) {
    if (platform !== "darwin")
        return { required: required === true, applicable: false, present: null, path: null, ok: true };

    const result = spawnSync("xcode-select", ["-p"], { encoding: "utf8", timeout: 10000 });
    const present = !result.error && result.status === 0;

    return {
        required: required === true,
        applicable: true,
        present,
        path: present ? result.stdout.trim() : null,
        ok: required !== true || present,
    };
}

function appleCompiler(platform = process.platform) {
    if (platform !== "darwin")
        return { present: false, version: null, output: null, path: null };

    const probe = commandVersion("xcrun", ["clang", "--version"]);
    const location = spawnSync("xcrun", ["--find", "clang"], { encoding: "utf8", timeout: 10000 });

    if (probe.present && !location.error && location.status === 0)
        probe.path = location.stdout.trim() || null;

    return probe;
}

function resolvesInside(directory, candidate) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate))
        return false;

    try {
        return isInsideDirectory(realpathSync(directory), realpathSync(candidate));
    } catch {
        return false;
    }
}

async function checkFeed(baseUrl, { offline, fetchImpl = globalThis.fetch }) {
    if (baseUrl === "")
        return { configured: false, checked: false, reachable: null, status: null, error: null, reason: "kit/feed.json baseUrl is empty" };

    if (offline)
        return { configured: true, checked: false, reachable: null, status: null, error: null, reason: "--offline" };

    try {
        const response = await fetchImpl(`${baseUrl}/kit.git/HEAD`, {
            method: "HEAD",
            signal: AbortSignal.timeout(feedTimeoutMs),
            redirect: "follow",
        });
        const status = Number.isInteger(response.status) ? response.status : null;
        const reachable = response.ok === true || (response.ok === undefined && status !== null && status >= 200 && status < 300);
        return {
            configured: true,
            checked: true,
            reachable,
            status,
            error: reachable ? null : status === null ? "unexpected response" : `HTTP ${status}`,
            reason: null,
        };
    } catch (error) {
        // The cause code (ENOTFOUND, ECONNREFUSED) says why without echoing the URL.
        const reason = error?.cause?.code ?? (error?.name === "TimeoutError" ? "timed out" : "network error");
        return { configured: true, checked: true, reachable: false, status: null, error: `request failed (${reason})`, reason: null };
    }
}

function readJsonObjectOrNull(filePath) {
    if (!existsSync(filePath))
        return { present: false, value: null, error: null };

    try {
        return { present: true, value: readJsonObject(filePath), error: null };
    } catch (error) {
        return { present: true, value: null, error: error.message };
    }
}

/** kit/kit.json: the kit version and the config schema versions this kit reads. */
function checkKitManifest(root) {
    const kitPath = path.join(root, "kit", "kit.json");

    if (!existsSync(kitPath))
        return { path: kitPath, version: null, schemaVersions: null, error: `${kitPath} is missing; this checkout does not carry a complete kit. Restore it from the kit release (kit-update skill).` };

    try {
        return { path: kitPath, ...readKitManifest(root), error: null };
    } catch (error) {
        return { path: kitPath, version: null, schemaVersions: null, error: error.message };
    }
}

/**
 * product-owner.json against the template placeholder the kit ships
 * (kit/template/root/product-owner.json): a customer who has not edited it
 * would scaffold plugins under "Your Company".
 */
function checkProductOwner(root) {
    const ownerPath = path.join(root, "product-owner.json");
    const templatePath = path.join(root, "kit", "template", "root", "product-owner.json");
    const owner = readJsonObjectOrNull(ownerPath);
    const template = readJsonObjectOrNull(templatePath);
    const placeholderKeys = owner.value && template.value ? placeholderOwnerKeys(owner.value, template.value) : [];

    return {
        path: ownerPath,
        present: owner.present,
        error: owner.error,
        manufacturer: typeof owner.value?.manufacturer === "string" ? owner.value.manufacturer : null,
        placeholderKeys,
        placeholder: placeholderKeys.length > 0,
    };
}

/** Discover plugins as fx:build does; each plugin folder that fails to load is reported separately. */
function checkRegistry(root) {
    const failures = [];

    try {
        const plugins = discoverEffectPlugins({
            fxRoot: path.join(root, "fx"),
            onPluginError: (_directory, error) => failures.push(error.message),
        });
        const targets = Object.entries(plugins).map(([alias, plugin]) => ({
            alias,
            patch: plugin.patch,
            cmakeTarget: plugin.cmakeTarget,
            productName: plugin.productName,
            includeInAll: plugin.includeInAll !== false,
        }));

        return { ok: failures.length === 0, errors: failures, targets };
    } catch (error) {
        return { ok: false, errors: [...failures, error.message], targets: [] };
    }
}

function toolProblem(inspection) {
    const label = `${inspection.key} at ${inspection.relativePath}`;

    switch (inspection.status) {
        case "missing":
            return `${label} is missing (run npm run kit:setup).`;
        case "stale":
            return `${label} does not match the kit/toolchain.json pin (run npm run kit:setup).`;
        case "unpinned":
            return `${label} is present but kit/toolchain.json carries no sha256 to verify it against. Install the kit from a release delivery (kit-update skill).`;
        default:
            return null;
    }
}

export async function collectDoctorReport({ root = repoRoot, offline = false, fetchImpl, platform = process.platform, arch = process.arch } = {}) {
    const problems = [];
    const warnings = [];
    const report = {
        kitDoctor: 1,
        generatedAt: new Date().toISOString(),
        root,
        ok: true,
        problems,
        warnings,
        kit: null,
        platform: null,
        tools: {},
        toolchain: {},
        feed: null,
        registry: null,
        nodeModules: { present: existsSync(path.join(root, "node_modules")), path: path.join(root, "node_modules") },
        juceTerms: null,
        contracts: { toolchain: toolchainPath(root), feed: feedPath(root), error: null },
    };

    let toolchain = null;
    let baseUrl = "";

    report.kit = { ...checkKitManifest(root), productOwner: checkProductOwner(root) };

    if (report.kit.error)
        problems.push(report.kit.error);

    const owner = report.kit.productOwner;

    if (owner.error)
        problems.push(owner.error);
    else if (!owner.present)
        warnings.push(`${owner.path} is missing; npm run kit:new needs it to derive plugin identity (copy kit/template/root/product-owner.json and edit it).`);
    else if (owner.placeholder)
        warnings.push(`${owner.path} still carries the template placeholder value(s) for ${owner.placeholderKeys.join(", ")}; edit it before scaffolding or shipping plugins.`);

    try {
        toolchain = readToolchain(toolchainPath(root));
        baseUrl = readFeedBaseUrl(feedPath(root));
    } catch (error) {
        report.contracts.error = error instanceof Error ? error.message : String(error);
        problems.push(report.contracts.error);
    }

    const requirements = toolchain?.requirements ?? {};
    const machine = describeMachine({ platform, arch });
    const platformCheck = checkPlatform(requirements, machine);

    report.platform = {
        os: machine.os,
        arch,
        release: os.release(),
        macOSVersion: machine.macOSVersion,
        requirements: {
            os: requirements.os ?? null,
            minMacOS: requirements.minMacOS ?? null,
            arch: requirements.arch ?? null,
        },
        osOk: platformCheck.osOk,
        archOk: platformCheck.archOk,
        macOSOk: platformCheck.macOSOk,
    };
    problems.push(...platformCheck.problems);

    report.tools.node = checkTool("node", { present: true, version: process.versions.node }, requirements.node);
    report.tools.node.path = commandPath("node") ?? process.execPath;
    report.tools.npm = checkTool("npm", commandVersion("npm"), requirements.npm);
    report.tools.cmake = checkTool("cmake", commandVersion("cmake"), requirements.cmake);
    report.tools.git = checkTool("git", commandVersion("git"), requirements.git);
    report.tools.compiler = checkTool("Apple Clang", appleCompiler(platform), requirements.compiler);
    report.tools.xcodeCommandLineTools = xcodeCommandLineTools(platform, requirements.xcodeCommandLineTools);

    // The kit installer provisions Node, npm and CMake inside the project; a
    // source checkout uses the machine's own, so the fix differs.
    const installerManaged = existsSync(path.join(root, ".builder-kit-install", "receipt"));
    const runtimeRoot = path.join(root, ".builder-kit-install", "runtime");
    const useProjectRuntime = "From the project root, source .builder-kit-install/env.sh, then rerun kit:doctor.";
    const runtimeFix = (tool) => installerManaged
        ? useProjectRuntime
        : `Install ${tool.name} ${tool.required} (${tool.name === "cmake" ? "https://cmake.org/download/" : "https://nodejs.org"}), then rerun kit:doctor.`;
    const appleToolsFix = "Install or repair the Xcode Command Line Tools (xcode-select --install), then rerun kit:doctor.";

    for (const tool of [report.tools.node, report.tools.npm, report.tools.cmake, report.tools.git, report.tools.compiler]) {
        const fix = ["node", "npm", "cmake"].includes(tool.name) ? runtimeFix(tool) : appleToolsFix;

        if (!tool.present)
            problems.push(`${tool.name} was not found (required ${tool.required}). ${fix}`);
        else if (!tool.ok)
            problems.push(`${tool.name} ${tool.version} does not satisfy ${tool.required}. ${fix}`);
    }

    if (!report.tools.xcodeCommandLineTools.ok)
        problems.push("Xcode Command Line Tools are required. Run xcode-select --install, finish the installation and agreement prompts yourself, then rerun kit:doctor.");

    for (const key of ["node", "npm", "cmake"]) {
        const tool = report.tools[key];
        tool.projectLocal = installerManaged ? resolvesInside(runtimeRoot, tool.path) : null;

        if (tool.present && tool.projectLocal === false)
            problems.push(`${tool.name} resolves outside this project's verified runtime (${tool.path ?? "unknown path"}). ${useProjectRuntime}`);
    }

    if (toolchain) {
        for (const key of toolKeys) {
            const inspection = await inspectTool(toolchain, key, { root });
            const problem = toolProblem(inspection);

            report.toolchain[key] = inspection;

            if (problem)
                problems.push(problem);
        }
    }

    report.feed = await checkFeed(baseUrl, { offline, fetchImpl });

    // The feed matters only for repairs: with every tool current, an offline
    // machine is ready to build, so an unreachable feed is a warning.
    if (report.feed.checked && !report.feed.reachable) {
        const toolsCurrent = toolKeys.every((key) => report.toolchain[key]?.status === "current");
        const message = `The kit feed is not reachable: ${report.feed.error}. Check the internet connection; if it persists, contact support.`;

        (toolsCurrent ? warnings : problems).push(message);
    }

    report.registry = checkRegistry(root);
    problems.push(...report.registry.errors);

    if (!report.nodeModules.present)
        problems.push(`node_modules is missing. ${installerManaged ? "From the project root, source .builder-kit-install/env.sh and run npm run kit:setup." : "Run npm ci from the project root."}`);

    const acknowledgment = readJuceAcknowledgment(root);

    report.juceTerms = {
        acknowledged: acknowledgment !== null,
        acknowledgedAt: acknowledgment?.acknowledgedAt ?? null,
        path: juceAcknowledgmentPath(root),
    };

    report.ok = problems.length === 0;

    return report;
}

function statusLine(ok, text) {
    return `${ok === false ? "[!!]" : ok === null ? "[--]" : "[ok]"} ${text}`;
}

function toolReady(tool) {
    return tool?.present === true && tool.ok === true && tool.projectLocal !== false;
}

function toolVersion(tool, label = tool?.name ?? "tool") {
    return `${label} ${tool?.version ?? "unknown"}`;
}

function visibleWarnings(report) {
    const ownerPath = report.kit?.productOwner?.path;
    return report.warnings.filter((warning) => !ownerPath || !warning.startsWith(`${ownerPath} `));
}

export function formatDoctorReport(report) {
    const lines = ["Builder Kit doctor"];
    const platform = report.platform;
    const kit = report.kit;
    const platformReady = ![platform.osOk, platform.archOk, platform.macOSOk].includes(false)
        && toolReady(report.tools.git) && toolReady(report.tools.compiler)
        && report.tools.xcodeCommandLineTools.ok === true;
    const platformNameAndVersion = `${platform.os}${platform.macOSVersion ? ` ${platform.macOSVersion}` : ""}/${platform.arch}`;
    lines.push(statusLine(platformReady, `Mac: ${platformNameAndVersion}; Apple Clang, Git, and Command Line Tools ${platformReady ? "ready" : "need attention"}.`));

    const runtimeKeys = ["node", "npm", "cmake"];
    const runtimeReady = runtimeKeys.every((key) => toolReady(report.tools[key]));
    const runtimeIsLocal = runtimeKeys.every((key) => report.tools[key]?.projectLocal === true);
    const runtimeOutsideProject = runtimeKeys.some((key) => report.tools[key]?.projectLocal === false);
    const runtimeLocation = runtimeIsLocal ? "; project-local" : runtimeOutsideProject ? "; outside project runtime" : "";
    lines.push(statusLine(runtimeReady, `Runtime: ${toolVersion(report.tools.node, "Node")}, ${toolVersion(report.tools.npm, "npm")}, ${toolVersion(report.tools.cmake, "CMake")}${runtimeLocation}.`));

    const inspections = Object.values(report.toolchain);
    const pinnedToolsReady = inspections.length === toolKeys.length && inspections.every((inspection) => inspection.status === "current");
    const pluginProjectReady = kit.error === null && report.contracts.error === null && report.registry.ok
        && report.nodeModules.present && pinnedToolsReady;
    const targetCount = report.registry.targets.length;
    lines.push(statusLine(pluginProjectReady, `Plug-in project: Builder Kit ${kit.version ?? "unknown"}; ${targetCount} target(s); npm dependencies ${report.nodeModules.present ? "ready" : "missing"}; pinned tools ${pinnedToolsReady ? "ready" : "need attention"}.`));

    if (report.feed.checked)
        lines.push(statusLine(report.feed.reachable, `Delivery feed: ${report.feed.reachable ? "reachable" : `unavailable (${report.feed.error})`}.`));

    lines.push(statusLine(report.juceTerms.acknowledged ? true : null, `JUCE notice: ${report.juceTerms.acknowledged ? `acknowledged ${report.juceTerms.acknowledgedAt}` : "not yet acknowledged; ask once before running an accepting setup or native build"}.`));

    if (!report.ok) {
        lines.push("");
        lines.push(`${report.problems.length} problem(s):`);
    }

    for (const problem of report.problems)
        lines.push(`  - ${problem}`);

    const warnings = visibleWarnings(report);

    if (warnings.length > 0) {
        lines.push("");
        lines.push(`${warnings.length} warning(s):`);

        for (const warning of warnings)
            lines.push(`  - ${warning}`);
    }

    lines.push("");

    if (report.ok && report.juceTerms.acknowledged)
        lines.push("Ready to build and install plug-ins.");
    else if (report.ok)
        lines.push("Environment checks passed. JUCE acknowledgment is still required before an accepting setup or native build.");
    else
        lines.push("Resolve the problems above, then rerun npm run kit:doctor -- --strict. Run setup only when a problem names it.");

    lines.push("Full machine report: npm run kit:doctor -- --json");

    return lines.join("\n");
}

async function main() {
    let options;

    try {
        options = parseDoctorArguments(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 2;
        return;
    }

    const report = await collectDoctorReport({ offline: options.offline });
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(formatDoctorReport(report));
    }

    if (options.strict && !report.ok)
        process.exitCode = 1;
}

if (isMainModule(import.meta.url))
    await main();
