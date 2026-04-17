import { access, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

import {
    buildPlugin,
    effectPluginNames,
    effectPlugins,
    repoRoot,
} from "./build-effect.mjs";

const cacheRoot = process.env.COSIMO_DEV_CACHE
    ? path.resolve(process.env.COSIMO_DEV_CACHE)
    : path.join(process.env.HOME, "Library/Caches/cosimo-synth-dev");
const scriptPath = fileURLToPath(import.meta.url);
const patchedWebViewRequiredStrings = [
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
    "__chocUserFiles",
    "chocUserFiles",
];
const keyboardBridgeForbiddenStrings = [
    "cosimoKeyboard",
    "cosimoKeyboardProbe",
    "cosimo-keyboard-probe-panel",
    "forwarded-buffered-flags-changed",
];

function availablePluginNames() {
    return ["all", ...effectPluginNames()].join(", ");
}

function usage() {
    return [
        "Usage:",
        "  npm run fx:prod:build -- <plugin> [--clean]",
        "  npm run fx:prod:install -- <plugin> [--dry-run]",
        "",
        `Available plugins: ${availablePluginNames()}`,
        "",
        "Notes:",
        "  fx:prod:build creates a dedicated plugin bundle under build/.",
        "  fx:prod:install copies an already-built dedicated VST3 bundle.",
        "  fx:prod:install does not write CmajPlugin.json and does not touch AU plugins.",
        "  COSIMO_PLUGIN_JOBS controls parallel plugin builds for 'all' (default: 3).",
        "  COSIMO_CMAKE_JOBS controls CMake --parallel jobs per plugin (default: CPU budget / plugin jobs).",
    ].join("\n");
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
        encoding: "utf8",
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `${command} ${args.join(" ")} failed.`);
    }

    return result.stdout?.trim() ?? "";
}

function availableParallelism() {
    return typeof os.availableParallelism === "function"
        ? os.availableParallelism()
        : Math.max(1, os.cpus().length);
}

function parsePositiveInteger(value, label) {
    if (value === undefined || value === null || value === "")
        return null;

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1)
        throw new Error(`${label} must be a positive integer.`);

    return parsed;
}

export function resolveProdBuildParallelism(pluginCount, env = process.env, availableJobs = availableParallelism()) {
    const safeAvailableJobs = Math.max(1, Math.floor(availableJobs));
    const requestedPluginJobs = parsePositiveInteger(env.COSIMO_PLUGIN_JOBS, "COSIMO_PLUGIN_JOBS");
    const requestedCmakeJobs = parsePositiveInteger(env.COSIMO_CMAKE_JOBS, "COSIMO_CMAKE_JOBS");
    const defaultPluginJobs = pluginCount > 1 ? Math.min(pluginCount, 3, safeAvailableJobs) : 1;
    const pluginJobs = Math.max(1, Math.min(pluginCount, requestedPluginJobs ?? defaultPluginJobs));
    const cmakeJobs = requestedCmakeJobs ?? Math.max(1, Math.floor(safeAvailableJobs / pluginJobs));

    return {
        pluginJobs,
        cmakeJobs,
    };
}

async function pathExists(nextPath) {
    try {
        await access(nextPath);
        return true;
    } catch {
        return false;
    }
}

async function ensureJucePath() {
    const jucePath = process.env.JUCE_PATH
        ? path.resolve(process.env.JUCE_PATH)
        : path.join(cacheRoot, "JUCE");

    if (!await pathExists(path.join(jucePath, ".git")))
        run("git", ["clone", "--depth", "1", "https://github.com/juce-framework/JUCE.git", jucePath]);

    return jucePath;
}

async function verifyPatchedCmajorRuntime(cmajorSourcePath) {
    const webViewHeaderPath = path.join(cmajorSourcePath, "include/choc/choc/gui/choc_WebView.h");
    let webViewHeader = "";

    try {
        webViewHeader = await readFile(webViewHeaderPath, "utf8");
    } catch {
        throw new Error(`Cmajor runtime is missing CHOC WebView header: ${webViewHeaderPath}`);
    }

    const missingMarkers = patchedWebViewRequiredStrings.filter((marker) => !webViewHeader.includes(marker));

    if (missingMarkers.length > 0) {
        throw new Error(
            [
                `Cmajor runtime does not include the required patched CHOC WebView features: ${cmajorSourcePath}`,
                `Missing marker(s): ${missingMarkers.join(", ")}`,
                "Use scripts/ensure_cmajor_runtime.py --path or set CMAJOR_SOURCE_PATH to a patched Cmajor checkout.",
            ].join("\n"),
        );
    }
}

async function ensureCmajorSourcePath() {
    const cmajorSourcePath = process.env.CMAJOR_SOURCE_PATH
        ? path.resolve(process.env.CMAJOR_SOURCE_PATH)
        : run("python3", [path.join(repoRoot, "scripts/ensure_cmajor_runtime.py"), "--path"], { capture: true });

    await verifyPatchedCmajorRuntime(cmajorSourcePath);

    return cmajorSourcePath;
}

export async function prepareJuceProjectOutput(juceOut, { clean = false } = {}) {
    if (clean) {
        await rm(juceOut, { recursive: true, force: true });
        await mkdir(juceOut, { recursive: true });
        return;
    }

    await mkdir(juceOut, { recursive: true });

    for (const entry of await readdir(juceOut, { withFileTypes: true })) {
        if (entry.name === "_build")
            continue;

        await rm(path.join(juceOut, entry.name), { recursive: true, force: true });
    }
}

async function generateJuceProject(pluginName, plugin, options = {}) {
    const jucePath = await ensureJucePath();
    const cmajorSourcePath = await ensureCmajorSourcePath();
    const runtimePatchPath = path.join(repoRoot, plugin.runtimeOut, path.basename(plugin.patch));
    const juceOut = path.join(repoRoot, plugin.juceOut);

    await prepareJuceProjectOutput(juceOut, { clean: options.clean });

    run("cmaj", [
        "generate",
        "--target=juce",
        runtimePatchPath,
        `--output=${juceOut}`,
        `--jucePath=${jucePath}`,
        `--cmajorIncludePath=${path.join(cmajorSourcePath, "include")}`,
    ]);

    console.log(`Generated ${pluginName} JUCE plugin project at ${path.relative(repoRoot, juceOut)}`);
}

export function createCmakeBuildArgs(cmakeBuildDir, target, cmakeJobs) {
    const args = [
        "--build",
        cmakeBuildDir,
        "--config",
        "Release",
        "--target",
        target,
    ];

    if (cmakeJobs) {
        args.push("--parallel", String(cmakeJobs));
    }

    return args;
}

async function buildJuceProject(pluginName, plugin, options = {}) {
    const juceOut = path.join(repoRoot, plugin.juceOut);
    const cmakeBuildDir = path.join(juceOut, "_build");
    const cmakeListsPath = path.join(juceOut, "CMakeLists.txt");

    if (!await pathExists(cmakeListsPath))
        throw new Error(`Generated CMake project not found: ${cmakeListsPath}`);

    run("cmake", [
        "-S",
        juceOut,
        "-B",
        cmakeBuildDir,
        "-DCMAKE_BUILD_TYPE=Release",
    ]);

    run("cmake", createCmakeBuildArgs(cmakeBuildDir, `${plugin.cmakeTarget}_VST3`, options.cmakeJobs));

    const builtVST3 = getBuiltVST3Path(plugin);

    if (!await pathExists(builtVST3))
        throw new Error(`Built VST3 bundle not found: ${builtVST3}`);

    if (process.platform === "darwin") {
        signVST3Bundle(builtVST3);
        verifyVST3Bundle(builtVST3);
    }

    verifyPatchedWebView(getBuiltVST3BinaryPath(plugin));

    console.log(`Built ${pluginName} dedicated plugin project at ${path.relative(repoRoot, cmakeBuildDir)}`);
}

async function prodBuild(pluginName, options = {}) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

    await buildPlugin(pluginName);
    await generateJuceProject(pluginName, plugin, options);
    await buildJuceProject(pluginName, plugin, options);

    return plugin;
}

export function resolveProdPluginNames(pluginName) {
    if (pluginName === "all")
        return effectPluginNames();

    if (effectPlugins[pluginName])
        return [pluginName];

    throw new Error(usage());
}

export function createProdBuildChildArgs(pluginName, options = {}) {
    const args = [scriptPath, "build", pluginName];

    if (options.clean)
        args.push("--clean");

    return args;
}

function runChildProcess(args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd: repoRoot,
            env,
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(signal
                ? `${process.execPath} ${args.join(" ")} exited via ${signal}.`
                : `${process.execPath} ${args.join(" ")} exited with code ${code}.`));
        });
    });
}

async function runLimited(items, limit, task) {
    const failures = [];
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const item = items[nextIndex];
            nextIndex += 1;

            try {
                await task(item);
            } catch (error) {
                failures.push({
                    item,
                    error,
                });
            }
        }
    }

    const workerCount = Math.min(items.length, limit);
    await Promise.all(Array.from({ length: workerCount }, worker));

    if (failures.length > 0) {
        throw new Error(failures.map(({ item, error }) => (
            `${item}: ${error instanceof Error ? error.message : String(error)}`
        )).join("\n"));
    }
}

async function prodBuildAll(pluginNames, options) {
    const { pluginJobs, cmakeJobs } = resolveProdBuildParallelism(pluginNames.length);

    if (pluginNames.length === 1) {
        await prodBuild(pluginNames[0], { ...options, cmakeJobs });
        return;
    }

    const jucePath = await ensureJucePath();
    const cmajorSourcePath = await ensureCmajorSourcePath();

    console.log(`Building ${pluginNames.join(", ")} with ${pluginJobs} plugin job(s), ${cmakeJobs} CMake job(s) per plugin.`);

    await runLimited(pluginNames, pluginJobs, (pluginName) => runChildProcess(
        createProdBuildChildArgs(pluginName, options),
        {
            ...process.env,
            JUCE_PATH: jucePath,
            CMAJOR_SOURCE_PATH: cmajorSourcePath,
            COSIMO_CMAKE_JOBS: String(cmakeJobs),
        },
    ));
}

function getBuiltVST3Path(plugin) {
    return path.join(
        repoRoot,
        plugin.juceOut,
        "_build",
        `${plugin.cmakeTarget}_artefacts`,
        "Release",
        "VST3",
        `${plugin.productName}.vst3`,
    );
}

function getBuiltVST3BinaryPath(plugin) {
    return path.join(getBuiltVST3Path(plugin), "Contents", "MacOS", plugin.productName);
}

function signVST3Bundle(vst3Path) {
    run("codesign", ["--force", "--deep", "--sign", "-", vst3Path], { capture: true });
}

function verifyVST3Bundle(vst3Path) {
    run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", vst3Path], { capture: true });
}

function verifyPatchedWebView(binaryPath) {
    const missingStrings = patchedWebViewRequiredStrings.filter((marker) => !binaryContainsString(binaryPath, marker));
    const presentForbiddenStrings = keyboardBridgeForbiddenStrings.filter((marker) => binaryContainsString(binaryPath, marker));

    if (missingStrings.length > 0) {
        throw new Error(
            [
                `VST3 binary was not built with the required patched CHOC WebView features: ${binaryPath}`,
                `Missing marker(s): ${missingStrings.join(", ")}`,
            ].join("\n"),
        );
    }

    if (presentForbiddenStrings.length > 0) {
        throw new Error(
            [
                `VST3 binary still contains old keyboard probe marker(s): ${binaryPath}`,
                `Forbidden marker(s): ${presentForbiddenStrings.join(", ")}`,
            ].join("\n"),
        );
    }
}

function binaryContainsString(binaryPath, marker) {
    const result = spawnSync("grep", ["-a", "-F", "-q", marker, binaryPath], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "pipe"],
        encoding: "utf8",
    });

    if (result.status === 0)
        return true;

    if (result.status === 1)
        return false;

    throw new Error(result.stderr?.trim() || `grep failed while checking ${binaryPath}`);
}

async function installVST3(pluginName, plugin, options) {
    const builtVST3 = getBuiltVST3Path(plugin);
    const builtVST3Binary = getBuiltVST3BinaryPath(plugin);
    const installDir = path.join(process.env.HOME, "Library/Audio/Plug-Ins/VST3");
    const installedVST3 = path.join(installDir, `${plugin.productName}.vst3`);
    const installedVST3Binary = path.join(installedVST3, "Contents", "MacOS", plugin.productName);

    if (!await pathExists(builtVST3))
        throw new Error(`Built VST3 bundle not found: ${builtVST3}`);

    if (!await pathExists(builtVST3Binary))
        throw new Error(`Built VST3 binary not found: ${builtVST3Binary}`);

    verifyPatchedWebView(builtVST3Binary);

    if (options.dryRun) {
        console.log(`Would install ${pluginName} VST3 from: ${builtVST3}`);
        console.log(`Would install ${pluginName} VST3 to: ${installedVST3}`);
        return;
    }

    await mkdir(installDir, { recursive: true });
    await rm(installedVST3, { recursive: true, force: true });
    await cp(builtVST3, installedVST3, { recursive: true });
    signVST3Bundle(installedVST3);
    verifyVST3Bundle(installedVST3);
    verifyPatchedWebView(installedVST3Binary);

    console.log(`Installed ${pluginName} VST3: ${installedVST3}`);
}

export function parseArgs(argv) {
    const action = argv[2];
    const pluginName = argv[3];
    const flags = new Set(argv.slice(4));

    for (const flag of flags) {
        if (!["--clean", "--dry-run", "--help", "-h"].includes(flag))
            throw new Error(`Unknown argument: ${flag}\n\n${usage()}`);
    }

    return {
        action,
        pluginName,
        clean: flags.has("--clean"),
        dryRun: flags.has("--dry-run"),
        help: flags.has("--help") || flags.has("-h"),
    };
}

async function main() {
    try {
        const options = parseArgs(process.argv);

        if (options.help || !options.action || !options.pluginName) {
            console.log(usage());
            process.exitCode = options.help ? 0 : 1;
            return;
        }

        const pluginNames = resolveProdPluginNames(options.pluginName);

        if (options.action === "build") {
            await prodBuildAll(pluginNames, options);
            return;
        }

        if (options.action === "install") {
            if (options.clean)
                throw new Error("--clean is only valid with fx:prod:build.");

            for (const pluginName of pluginNames) {
                await installVST3(pluginName, effectPlugins[pluginName], options);
            }
            return;
        }

        throw new Error(usage());
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath)
    await main();
