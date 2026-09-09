// kit:doctor — read-only environment and registry report.
//
//   node kit/scripts/doctor.mjs [--json] [--strict] [--offline]
//
// Reports the kit version (kit/kit.json) and the config schema versions it
// supports, the machine against kit/toolchain.json (OS/arch/tool ranges), the
// selected compiler/Git and installer-owned Node/npm/CMake paths, the pinned
// cmaj / CmajPlugin.vst3 at their local paths, feed reachability, the
// plugin registry (fx/ discovery, every <Name>.plugin.json's schemaVersion,
// legacy two-file configs), product-owner.json, node_modules, and the JUCE
// acknowledgment. The default is a concise human readiness report; --json
// prints the full machine-readable report instead. Problems flip `ok`; warnings
// (legacy plugin configs, placeholder owner identity) do not. Exits 0 always,
// unless --strict and a problem was found. Never writes.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
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
import { redact, reveal } from "./redacted.mjs";

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

function platformName(platform = process.platform) {
    return { darwin: "macOS", linux: "Linux", win32: "Windows" }[platform] ?? platform;
}

function macOSVersion(platform = process.platform) {
    if (platform !== "darwin")
        return null;

    const probe = commandVersion("sw_vers", ["-productVersion"]);
    return probe.present ? probe.version : null;
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

function insideDirectory(directory, candidate) {
    if (typeof candidate !== "string" || !path.isAbsolute(candidate))
        return false;

    try {
        const relative = path.relative(realpathSync(directory), realpathSync(candidate));
        return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    } catch {
        return false;
    }
}

async function checkFeed(baseUrl, { offline, fetchImpl = globalThis.fetch }) {
    if (reveal(baseUrl) === "")
        return { configured: false, checked: false, reachable: null, status: null, error: null, reason: "kit/feed.json baseUrl is empty" };

    if (offline)
        return { configured: true, checked: false, reachable: null, status: null, error: null, reason: "--offline" };

    try {
        const response = await fetchImpl(`${reveal(baseUrl)}/kit.git/HEAD`, {
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
    } catch {
        return { configured: true, checked: true, reachable: false, status: null, error: "request failed", reason: null };
    }
}

function readJsonObjectOrNull(filePath) {
    if (!existsSync(filePath))
        return { present: false, value: null, error: null };

    try {
        const value = JSON.parse(readFileSync(filePath, "utf8"));

        if (value === null || typeof value !== "object" || Array.isArray(value))
            return { present: true, value: null, error: `${filePath} must contain a JSON object.` };

        return { present: true, value, error: null };
    } catch (error) {
        return { present: true, value: null, error: `Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}` };
    }
}

const kitSchemaKeys = ["plugin", "toolchain", "feed"];

/** kit/kit.json: the kit version and the config schema versions this kit reads. */
function checkKitManifest(root) {
    const kitPath = path.join(root, "kit", "kit.json");
    const { present, value, error } = readJsonObjectOrNull(kitPath);
    const result = { path: kitPath, version: null, schemaVersions: null, error };

    if (!present)
        result.error = `${kitPath} is missing; this checkout does not carry a complete kit.`;
    else if (value) {
        const schemaVersions = value.schemaVersions;
        const wellFormed = typeof value.version === "string" && /^\d+\.\d+\.\d+/.test(value.version)
            && schemaVersions && typeof schemaVersions === "object"
            && kitSchemaKeys.every((key) => Number.isInteger(schemaVersions[key]));

        if (wellFormed) {
            result.version = value.version;
            result.schemaVersions = Object.fromEntries(kitSchemaKeys.map((key) => [key, schemaVersions[key]]));
        } else {
            result.error = `${kitPath} must carry "version" and integer "schemaVersions" for ${kitSchemaKeys.join("/")}.`;
        }
    }

    return result;
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
    const placeholderKeys = [];

    if (owner.value && template.value) {
        for (const [key, placeholder] of Object.entries(template.value)) {
            if (owner.value[key] === placeholder)
                placeholderKeys.push(key);
        }
    }

    return {
        path: ownerPath,
        present: owner.present,
        error: owner.error,
        manufacturer: typeof owner.value?.manufacturer === "string" ? owner.value.manufacturer : null,
        placeholderKeys,
        placeholder: placeholderKeys.length > 0,
    };
}

/**
 * Every plugin config file under fx/*, read directly (not through discovery)
 * so schema and legacy findings survive a registry that fails to load.
 */
function inspectPluginConfigs(root, supportedSchemaVersion) {
    const fxRoot = path.join(root, "fx");
    const configs = [];

    if (!existsSync(fxRoot))
        return configs;

    const relative = (filePath) => path.relative(root, filePath).split(path.sep).join("/");
    const directoryNames = readdirSync(fxRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    for (const directoryName of directoryNames) {
        const directoryPath = path.join(fxRoot, directoryName);
        const fileNames = readdirSync(directoryPath, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort();

        for (const fileName of fileNames) {
            const filePath = path.join(directoryPath, fileName);

            if (fileName.endsWith(".plugin.json")) {
                const { value, error } = readJsonObjectOrNull(filePath);
                const schemaVersion = Number.isInteger(value?.schemaVersion) ? value.schemaVersion : null;
                const supported = schemaVersion !== null && supportedSchemaVersion !== null
                    ? schemaVersion <= supportedSchemaVersion
                    : null;

                configs.push({
                    path: relative(filePath),
                    patch: relative(filePath.replace(/\.plugin\.json$/, ".cmajorpatch")),
                    kind: "plugin",
                    schemaVersion,
                    supported,
                    error,
                });
            } else if (fileName.endsWith(".build.json")) {
                configs.push({
                    path: relative(filePath),
                    patch: relative(filePath.replace(/\.build\.json$/, ".cmajorpatch")),
                    kind: "legacy-build-sidecar",
                    schemaVersion: null,
                    supported: true,
                    error: null,
                });
            } else if (fileName === "product.json") {
                configs.push({
                    path: relative(filePath),
                    patch: null,
                    kind: "legacy-product-identity",
                    schemaVersion: null,
                    supported: true,
                    error: null,
                });
            }
        }
    }

    return configs;
}

/** Validate the plugin registry through the same discovery fx:build uses; any thrown error is the report. */
async function checkRegistry(root, supportedSchemaVersion) {
    const modulePath = path.join(root, "kit", "fx", "build-effect.mjs");
    const configs = inspectPluginConfigs(root, supportedSchemaVersion);

    try {
        const module = await import(pathToFileURL(modulePath).href);
        const targets = Object.entries(module.effectPlugins).map(([alias, plugin]) => ({
            alias,
            patch: plugin.patch,
            cmakeTarget: plugin.cmakeTarget,
            productName: plugin.productName,
            includeInAll: plugin.includeInAll !== false,
        }));

        return { ok: true, error: null, targets, configs };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error), targets: [], configs };
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
            return `${label} is present but kit/toolchain.json carries no sha256 to verify it against.`;
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
    let baseUrl = redact("");

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
    const osName = platformName(platform);
    const macOS = macOSVersion(platform);
    const macOSOk = requirements.minMacOS && macOS ? satisfiesRange(macOS, `>=${requirements.minMacOS}`) !== false : null;

    report.platform = {
        os: osName,
        arch,
        release: os.release(),
        macOSVersion: macOS,
        requirements: {
            os: requirements.os ?? null,
            minMacOS: requirements.minMacOS ?? null,
            arch: requirements.arch ?? null,
        },
        osOk: requirements.os ? requirements.os === osName : null,
        archOk: requirements.arch ? requirements.arch === arch : null,
        macOSOk,
    };

    if (report.platform.osOk === false)
        problems.push(`This machine runs ${osName}/${arch}; the kit targets ${requirements.os}/${requirements.arch ?? "any arch"}.`);
    else if (report.platform.archOk === false)
        problems.push(`This machine is ${arch}; the kit targets ${requirements.arch}.`);

    if (macOSOk === false)
        problems.push(`macOS ${macOS} is older than the required ${requirements.minMacOS}.`);

    report.tools.node = checkTool("node", { present: true, version: process.versions.node }, requirements.node);
    report.tools.node.path = commandPath("node") ?? process.execPath;
    report.tools.npm = checkTool("npm", commandVersion("npm"), requirements.npm);
    report.tools.cmake = checkTool("cmake", commandVersion("cmake"), requirements.cmake);
    report.tools.git = checkTool("git", commandVersion("git"), requirements.git);
    report.tools.compiler = checkTool("Apple Clang", appleCompiler(platform), requirements.compiler);
    report.tools.xcodeCommandLineTools = xcodeCommandLineTools(platform, requirements.xcodeCommandLineTools);

    for (const tool of [report.tools.node, report.tools.npm, report.tools.cmake, report.tools.git, report.tools.compiler]) {
        if (!tool.present)
            problems.push(`${tool.name} was not found (required ${tool.required}). ${["node", "npm", "cmake"].includes(tool.name) ? "From the project root, source .builder-kit-install/env.sh and rerun the supplied installation command." : "Install or repair Apple Command Line Tools, then rerun kit:doctor."}`);
        else if (!tool.ok)
            problems.push(`${tool.name} ${tool.version} does not satisfy ${tool.required}.`);
    }

    if (!report.tools.xcodeCommandLineTools.ok)
        problems.push("Xcode Command Line Tools are required. Run xcode-select --install, finish the installation and agreement prompts yourself, then rerun kit:doctor.");

    const installerManaged = existsSync(path.join(root, ".builder-kit-install", "receipt"));
    const runtimeRoot = path.join(root, ".builder-kit-install", "runtime");

    for (const key of ["node", "npm", "cmake"]) {
        const tool = report.tools[key];
        tool.projectLocal = installerManaged ? insideDirectory(runtimeRoot, tool.path) : null;

        if (tool.present && tool.projectLocal === false)
            problems.push(`${tool.name} resolves outside this project's verified runtime (${tool.path ?? "unknown path"}). From the project root, source .builder-kit-install/env.sh, then rerun kit:doctor.`);
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

    if (report.feed.checked && !report.feed.reachable)
        problems.push(`Feed is not reachable: ${report.feed.error}.`);

    report.registry = await checkRegistry(root, report.kit.schemaVersions?.plugin ?? null);

    if (!report.registry.ok)
        problems.push(`Plugin registry discovery failed: ${report.registry.error}`);

    for (const config of report.registry.configs) {
        if (config.kind === "plugin") {
            if (config.error)
                problems.push(config.error);
            else if (config.schemaVersion === null)
                problems.push(`${config.path} has no integer "schemaVersion" (this kit supports ${report.kit.schemaVersions?.plugin ?? "?"}).`);
            else if (config.supported === false)
                problems.push(`${config.path} uses plugin config schema ${config.schemaVersion}, newer than this kit supports (${report.kit.schemaVersions.plugin}); update the kit (kit-update skill).`);
        } else if (config.kind === "legacy-build-sidecar") {
            warnings.push(`${config.path} is a legacy build sidecar; fold it into ${config.patch.replace(/\.cmajorpatch$/, ".plugin.json")} (still accepted this release, removed in the next).`);
        } else {
            warnings.push(`${config.path} is a legacy product identity file; move it into the "product" object of the patch's <Name>.plugin.json (still accepted this release, removed in the next).`);
        }
    }

    if (!report.nodeModules.present)
        problems.push("node_modules is missing. From the project root, source .builder-kit-install/env.sh and run npm run kit:setup.");

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
