import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

import {
    buildPlugin,
    effectPluginNames,
    effectPluginTargetNames,
    effectPlugins,
    repoRoot,
} from "./build-effect.mjs";

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
    return ["all", ...effectPluginTargetNames()].join(", ");
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

export function replaceGeneratedPluginLatency(source, latencySamples) {
    if (!Number.isInteger(latencySamples) || latencySamples < 0)
        throw new Error("generatedHostLatencySamples must be a non-negative integer.");

    const pattern = /static constexpr double\s+latency\s*=\s*[-+0-9.eE]+;/g;
    const matches = [...source.matchAll(pattern)];

    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one generated Cmajor latency constant, found ${matches.length}.`,
        );
    }

    const correctedConstant = source.replace(
        pattern,
        `static constexpr double   latency            = ${latencySamples.toFixed(6)};`,
    );
    const factoryPattern = /([ \t]*)return new (cmaj::plugin::GeneratedPlugin<[^\n;]+> \(std::make_shared<cmaj::Patch>\(\)\));/g;
    const factoryMatches = [...correctedConstant.matchAll(factoryPattern)];

    if (factoryMatches.length !== 1) {
        throw new Error(
            `Expected exactly one generated Cmajor plugin factory, found ${factoryMatches.length}.`,
        );
    }

    return correctedConstant.replace(
        factoryPattern,
        (_, indent, construction) => [
            `${indent}auto* plugin = new ${construction};`,
            `${indent}plugin->patchChangeCallback = [] (auto& changedPlugin) { changedPlugin.setLatencySamples (${latencySamples}); };`,
            `${indent}plugin->setLatencySamples (${latencySamples});`,
            `${indent}return plugin;`,
        ].join("\n"),
    );
}

async function applyGeneratedHostLatency(pluginName, plugin, juceOut) {
    if (plugin.generatedHostLatencySamples === undefined)
        return;

    const generatedSourcePath = path.join(juceOut, "cmajor_plugin.cpp");
    const generatedSource = await readFile(generatedSourcePath, "utf8");
    const correctedSource = replaceGeneratedPluginLatency(
        generatedSource,
        plugin.generatedHostLatencySamples,
    );
    await writeFile(generatedSourcePath, correctedSource, "utf8");
    console.log(
        `Pinned ${pluginName} generated host latency to `
        + `${plugin.generatedHostLatencySamples} samples for Cmajor 1.0.3066.`,
    );
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
    const runtimePatchPath = path.join(repoRoot, plugin.runtimeOut, path.basename(plugin.patch));
    const juceOut = path.join(repoRoot, plugin.juceOut);
    const cmakeBuildDir = path.join(juceOut, "_build");

    await prepareJuceProjectOutput(juceOut, { clean: options.clean });

    run("cmake", [
        "-S", path.join(repoRoot, "tools", "effect_plugin_build"),
        "-B", cmakeBuildDir,
        "-DCMAKE_BUILD_TYPE=Release",
        `-DCOSIMO_EFFECT_PATCH_PATH=${runtimePatchPath}`,
        `-DCOSIMO_EFFECT_OUTPUT_DIR=${juceOut}`,
    ]);
    await applyGeneratedHostLatency(pluginName, plugin, juceOut);

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

    console.log(`Building ${pluginNames.join(", ")} with ${pluginJobs} plugin job(s), ${cmakeJobs} CMake job(s) per plugin.`);

    await runLimited(pluginNames, pluginJobs, (pluginName) => runChildProcess(
        createProdBuildChildArgs(pluginName, options),
        {
            ...process.env,
            COSIMO_CMAKE_JOBS: String(cmakeJobs),
        },
    ));
}

function getBuiltVST3Path(plugin) {
    return path.join(
        repoRoot,
        plugin.juceOut,
        "_build",
        "plugin",
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
