// kit:doctor — read-only environment and registry report.
//
//   node kit/scripts/doctor.mjs [--json] [--strict] [--offline]
//
// Reports the kit version (kit/kit.json) and the config schema versions it
// supports, the machine against kit/toolchain.json (OS/arch/tool ranges), the
// pinned cmaj / CmajPlugin.vst3 at their local paths, feed reachability, the
// plugin registry (fx/ discovery, every <Name>.plugin.json's schemaVersion,
// legacy two-file configs), product-owner.json, node_modules, and the JUCE
// acknowledgment. Prints plain-English lines followed by a JSON block; --json
// prints only the JSON. Problems flip `ok`; warnings (legacy plugin configs,
// placeholder owner identity) do not. Exits 0 always, unless --strict and a
// problem was found. Never writes.

import { existsSync, readdirSync, readFileSync } from "node:fs";
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

function commandVersion(command, args = ["--version"]) {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 10000 });

    if (result.error || result.status !== 0)
        return { present: false, version: null, output: null };

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    const match = output.match(/\d+\.\d+(?:\.\d+)?/);

    return { present: true, version: match ? match[0] : null, output: output.split("\n")[0] };
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
        required: requirementLabel(range),
        ok: probe.present && satisfied !== false,
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
    report.tools.cmake = checkTool("cmake", commandVersion("cmake"), requirements.cmake);
    report.tools.git = checkTool("git", commandVersion("git"), requirements.git);
    report.tools.xcodeCommandLineTools = xcodeCommandLineTools(platform, requirements.xcodeCommandLineTools);

    for (const tool of [report.tools.node, report.tools.cmake, report.tools.git]) {
        if (!tool.present)
            problems.push(`${tool.name} was not found on PATH (required ${tool.required}).`);
        else if (!tool.ok)
            problems.push(`${tool.name} ${tool.version} does not satisfy ${tool.required}.`);
    }

    if (!report.tools.xcodeCommandLineTools.ok)
        problems.push("Xcode Command Line Tools are required but not installed (xcode-select --install).");

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
        problems.push("node_modules is missing (run npm install or npm run kit:setup).");

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

function toolLine(tool) {
    if (!tool.present)
        return statusLine(false, `${tool.name}: not found (requires ${tool.required})`);

    return statusLine(tool.ok, `${tool.name} ${tool.version ?? "unknown version"} (requires ${tool.required})`);
}

function toolchainLine(inspection) {
    const label = `${inspection.key} at ${inspection.relativePath}`;

    switch (inspection.status) {
        case "current":
            return statusLine(true, `${label}: present, matches the pin (${inspection.matchedBy})`);
        case "missing":
            return statusLine(false, `${label}: missing`);
        case "stale":
            return statusLine(false, `${label}: present but does not match pin ${inspection.pin.slice(0, 12)}…`);
        default:
            return statusLine(null, `${label}: present, no sha256 pin in kit/toolchain.json to verify against`);
    }
}

export function formatDoctorReport(report) {
    const lines = ["kit:doctor"];
    const platform = report.platform;
    const kit = report.kit;

    if (kit.error)
        lines.push(statusLine(false, `kit: ${kit.error}`));
    else
        lines.push(statusLine(true, `kit ${kit.version} (schemas: plugin ${kit.schemaVersions.plugin}, toolchain ${kit.schemaVersions.toolchain}, feed ${kit.schemaVersions.feed})`));

    const owner = kit.productOwner;

    if (owner.error)
        lines.push(statusLine(false, `product-owner.json: ${owner.error}`));
    else if (!owner.present)
        lines.push(statusLine(null, "product-owner.json: missing (kit:new needs it)"));
    else if (owner.placeholder)
        lines.push(statusLine(null, `product-owner.json: template placeholder still in place (${owner.placeholderKeys.join(", ")})`));
    else
        lines.push(statusLine(true, `product-owner.json: ${owner.manufacturer}`));

    const platformOk = platform.osOk === false || platform.archOk === false || platform.macOSOk === false ? false : platform.osOk === null ? null : true;
    const platformTarget = platform.requirements.os
        ? ` (kit targets ${platform.requirements.os}${platform.requirements.minMacOS ? ` ${platform.requirements.minMacOS}+` : ""}/${platform.requirements.arch ?? "any"})`
        : "";

    lines.push(statusLine(platformOk, `platform: ${platform.os}${platform.macOSVersion ? ` ${platform.macOSVersion}` : ""}/${platform.arch}${platformTarget}`));

    if (report.contracts.error)
        lines.push(statusLine(false, `contracts: ${report.contracts.error}`));

    for (const key of ["node", "cmake", "git"])
        lines.push(toolLine(report.tools[key]));

    const xcode = report.tools.xcodeCommandLineTools;

    if (xcode.applicable)
        lines.push(statusLine(xcode.ok, `Xcode Command Line Tools: ${xcode.present ? xcode.path : "not installed"}`));
    else
        lines.push(statusLine(null, `Xcode Command Line Tools: not applicable on ${platform.os}`));

    for (const inspection of Object.values(report.toolchain))
        lines.push(toolchainLine(inspection));

    const feed = report.feed;

    if (!feed.checked)
        lines.push(statusLine(null, `feed: not checked (${feed.reason})`));
    else if (feed.reachable)
        lines.push(statusLine(true, `feed: required object reachable (HTTP ${feed.status})`));
    else
        lines.push(statusLine(false, `feed: required object unavailable (${feed.error})`));

    if (report.registry.ok) {
        lines.push(statusLine(true, `plugin registry: ${report.registry.targets.length} target(s)`));

        for (const target of report.registry.targets)
            lines.push(`     ${target.alias} -> ${target.patch} (cmake ${target.cmakeTarget}, product ${target.productName})`);
    } else {
        lines.push(statusLine(false, `plugin registry: ${report.registry.error}`));
    }

    for (const config of report.registry.configs) {
        if (config.kind === "plugin") {
            const ok = config.error || config.schemaVersion === null || config.supported === false ? false : true;
            const detail = config.error ?? (config.schemaVersion === null ? "no schemaVersion" : `schema ${config.schemaVersion}${config.supported === false ? " (newer than this kit)" : ""}`);
            lines.push(statusLine(ok, `${config.path}: ${detail}`));
        } else {
            lines.push(statusLine(null, `${config.path}: legacy config (fold into <Name>.plugin.json)`));
        }
    }

    lines.push(statusLine(report.nodeModules.present, `node_modules: ${report.nodeModules.present ? "present" : "missing"}`));
    lines.push(statusLine(report.juceTerms.acknowledged ? true : null, `JUCE terms: ${report.juceTerms.acknowledged ? `acknowledged ${report.juceTerms.acknowledgedAt}` : "not yet acknowledged (npm run kit:setup -- --accept-juce-terms)"}`));

    lines.push("");
    lines.push(report.ok ? "No problems found." : `${report.problems.length} problem(s):`);

    for (const problem of report.problems)
        lines.push(`  - ${problem}`);

    if (report.warnings.length > 0) {
        lines.push(`${report.warnings.length} warning(s):`);

        for (const warning of report.warnings)
            lines.push(`  - ${warning}`);
    }

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
    const json = JSON.stringify(report, null, 2);

    if (options.json) {
        console.log(json);
    } else {
        console.log(formatDoctorReport(report));
        console.log("");
        console.log("JSON:");
        console.log(json);
    }

    if (options.strict && !report.ok)
        process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
