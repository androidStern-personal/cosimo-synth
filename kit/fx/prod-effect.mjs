import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

import {
    availableEffectPluginNamesLine,
    buildPlugin,
    getEffectPlugin,
    repoRoot,
    resolveBuildOutputRoot,
    resolvePluginNames,
} from "./build-effect.mjs";
import { assertPatchedChocWebViewBinary } from "../scripts/check_choc_markers.mjs";
import { isInsideDirectory, isMainModule, runCommand } from "../scripts/common.mjs";
import { installVST3Bundle } from "../scripts/install_vst3.mjs";
import { cmajOverrideVariable, resolveCmajExecutable } from "../scripts/toolchain.mjs";

const scriptPath = fileURLToPath(import.meta.url);

/** BUILDER_KIT_CMAKE optionally names the exact CMake executable (absolute path) a build must use. */
export function resolveProdBuildToolPaths(environment = process.env, platform = process.platform) {
    const cmake = environment.BUILDER_KIT_CMAKE;

    if (cmake !== undefined && cmake !== "" && !path.isAbsolute(cmake))
        throw new Error(`BUILDER_KIT_CMAKE must be an absolute path to a cmake executable (got ${JSON.stringify(cmake)}).`);

    return {
        cmake: cmake || "cmake",
        codesign: platform === "darwin" ? "/usr/bin/codesign" : "codesign",
    };
}

function usage() {
    return [
        "Usage:",
        "  npm run fx:prod:build -- <plugin> [--clean]",
        "  npm run fx:prod:install -- <plugin> [--dry-run]",
        "",
        `Available plugins: ${availableEffectPluginNamesLine()}`,
        "",
        "Notes:",
        "  fx:prod:build creates a dedicated plugin bundle under build/.",
        "  fx:prod:install copies an already-built VST3 into ~/Library/Audio/Plug-Ins/VST3.",
        "  fx:prod:install does not write CmajPlugin.json and does not touch AU plugins.",
        "  cmaj is the hash-verified download from npm run kit:setup (build/kit-tools/cmaj);",
        "  BUILDER_KIT_CMAJ=<absolute path> uses another cmaj, BUILDER_KIT_CMAKE=<absolute path> another cmake.",
        "  BUILDER_KIT_PLUGIN_JOBS sets how many plugins 'all' builds in parallel (default: 3).",
        "  BUILDER_KIT_CMAKE_JOBS sets CMake --parallel jobs per plugin (default: CPU count / plugin jobs).",
    ].join("\n");
}

const missingToolFixes = {
    cmake: "Install CMake 3.28 or newer, or source .builder-kit-install/env.sh from the project folder if the kit installer set this project up.",
    codesign: "Install the Xcode Command Line Tools with xcode-select --install.",
};

function run(command, args, { capture = false } = {}) {
    return runCommand(command, args, { capture, missingFix: missingToolFixes[path.basename(command)] });
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
    const requestedPluginJobs = parsePositiveInteger(env.BUILDER_KIT_PLUGIN_JOBS, "BUILDER_KIT_PLUGIN_JOBS");
    const requestedCmakeJobs = parsePositiveInteger(env.BUILDER_KIT_CMAKE_JOBS, "BUILDER_KIT_CMAKE_JOBS");
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

export function createJuceGenerationConfigureArgs({
    cmakeSourceDirectory,
    cmakeBuildDirectory,
    runtimePatchPath,
    juceOutputDirectory,
    pluginTarget,
    cmajExecutable,
    disableMicrophonePermission = false,
}) {
    return [
        "-S", cmakeSourceDirectory,
        "-B", cmakeBuildDirectory,
        "-DCMAKE_BUILD_TYPE=Release",
        `-DBUILDER_KIT_EFFECT_PATCH_PATH=${runtimePatchPath}`,
        `-DBUILDER_KIT_EFFECT_OUTPUT_DIR=${juceOutputDirectory}`,
        `-DBUILDER_KIT_EFFECT_PLUGIN_TARGET=${pluginTarget}`,
        `-DBUILDER_KIT_CMAJ_EXECUTABLE=${cmajExecutable}`,
        `-DBUILDER_KIT_DISABLE_MICROPHONE_PERMISSION=${disableMicrophonePermission ? "ON" : "OFF"}`,
    ];
}

export async function prepareJuceProjectOutput(juceOut, {
    clean = false,
    cmakeSourceDirectory = null,
} = {}) {
    if (clean) {
        await rm(juceOut, { recursive: true, force: true });
        await mkdir(juceOut, { recursive: true });
        return;
    }

    await mkdir(juceOut, { recursive: true });

    if (cmakeSourceDirectory) {
        const cmakeBuildDir = path.join(juceOut, "_build");
        const cmakeCachePath = path.join(cmakeBuildDir, "CMakeCache.txt");

        try {
            const cmakeCache = await readFile(cmakeCachePath, "utf8");
            const cachedHome = cmakeCache.match(/^CMAKE_HOME_DIRECTORY:INTERNAL=(.*)$/mu)?.[1];

            if (cachedHome && path.resolve(cachedHome) !== path.resolve(cmakeSourceDirectory)) {
                await rm(cmakeBuildDir, { recursive: true, force: true });
            }
        } catch (error) {
            if (!error || typeof error !== "object" || error.code !== "ENOENT")
                throw error;
        }
    }
}

async function generateJuceProject(pluginName, plugin, options = {}) {
    const runtimePatchPath = path.join(repoRoot, plugin.runtimeOut, path.basename(plugin.patch));
    const juceOut = resolveBuildOutputRoot(plugin.juceOut, `${pluginName} juceOut`);
    const cmakeBuildDir = path.join(juceOut, "_build");
    const cmakeSourceDirectory = path.join(repoRoot, "kit", "tools", "effect_plugin_build");

    await prepareJuceProjectOutput(juceOut, {
        clean: options.clean,
        cmakeSourceDirectory,
    });

    run(options.toolPaths.cmake, createJuceGenerationConfigureArgs({
        cmajExecutable: options.cmajExecutable,
        cmakeBuildDirectory: cmakeBuildDir,
        cmakeSourceDirectory,
        disableMicrophonePermission: plugin.disableMicrophonePermission,
        juceOutputDirectory: juceOut,
        pluginTarget: plugin.cmakeTarget,
        runtimePatchPath,
    }));

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

    run(
        options.toolPaths.cmake,
        createCmakeBuildArgs(cmakeBuildDir, `${plugin.cmakeTarget}_VST3`, options.cmakeJobs),
    );

    const builtVST3 = getBuiltVST3Path(plugin);

    if (!await pathExists(builtVST3))
        throw new Error(`Built VST3 bundle not found: ${builtVST3}`);

    if (process.platform === "darwin") {
        signVST3Bundle(builtVST3, options.toolPaths);
        verifyVST3Bundle(builtVST3, options.toolPaths);
    }

    assertPatchedChocWebViewBinary(getBuiltVST3BinaryPath(plugin));

    console.log(`Built ${pluginName} dedicated plugin project at ${path.relative(repoRoot, cmakeBuildDir)}`);
}

async function prodBuild(pluginName, options = {}) {
    const plugin = getEffectPlugin(pluginName, usage);

    // Production bundles must ship no dev-server module path; plain fx:build
    // keeps view.devModule for the JIT-install/dev-server loop.
    await buildPlugin(pluginName, { stripDevModule: true });
    await generateJuceProject(pluginName, plugin, options);
    await buildJuceProject(pluginName, plugin, options);

    return plugin;
}

export function resolveProdPluginNames(pluginName) {
    return resolvePluginNames(pluginName, usage);
}

export function createProdBuildChildArgs(pluginName, options = {}) {
    return [scriptPath, "build", pluginName, ...(options.clean ? ["--clean"] : [])];
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
                ? `${args.join(" ")} was stopped by ${signal}.`
                : `${args.join(" ")} exited with code ${code}.`));
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
    const toolPaths = options.toolPaths ?? resolveProdBuildToolPaths();
    const { pluginJobs, cmakeJobs } = resolveProdBuildParallelism(pluginNames.length);
    const cmajExecutable = await resolveCmajExecutable();
    const buildOptions = { ...options, toolPaths, cmajExecutable };

    console.log(`Using cmaj at ${isInsideDirectory(repoRoot, cmajExecutable) ? path.relative(repoRoot, cmajExecutable) : cmajExecutable}`);

    if (pluginNames.length === 1) {
        await prodBuild(pluginNames[0], { ...buildOptions, cmakeJobs });
        return;
    }

    console.log(`Building ${pluginNames.join(", ")} with ${pluginJobs} plugin job(s), ${cmakeJobs} CMake job(s) per plugin.`);

    await runLimited(pluginNames, pluginJobs, (pluginName) => runChildProcess(
        createProdBuildChildArgs(pluginName, buildOptions),
        {
            ...process.env,
            BUILDER_KIT_CMAKE_JOBS: String(cmakeJobs),
            [cmajOverrideVariable]: cmajExecutable,
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

function signVST3Bundle(vst3Path, toolPaths) {
    run(toolPaths.codesign, ["--force", "--deep", "--sign", "-", vst3Path], { capture: true });
}

function verifyVST3Bundle(vst3Path, toolPaths) {
    run(toolPaths.codesign, ["--verify", "--deep", "--strict", "--verbose=4", vst3Path], { capture: true });
}

async function installVST3(pluginName, plugin, options) {
    const builtVST3 = getBuiltVST3Path(plugin);

    if (!await pathExists(builtVST3))
        throw new Error(`${pluginName} has no built VST3 at ${path.relative(repoRoot, builtVST3)}. Run npm run fx:prod:build -- ${pluginName} first.`);

    await installVST3Bundle({
        bundle: builtVST3,
        dryRun: options.dryRun,
        codesign: options.toolPaths.codesign,
        log: console.log,
    });
}

export function parseArgs(argv) {
    const [action, ...rest] = argv.slice(2);
    const flags = new Set();
    let pluginName;

    for (const argument of rest) {
        if (!argument.startsWith("-") && pluginName === undefined) {
            pluginName = argument;
            continue;
        }

        flags.add(argument);
    }

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

        if (options.help) {
            console.log(usage());
            return;
        }

        if (!options.action || !options.pluginName) {
            console.error(usage());
            process.exitCode = 1;
            return;
        }

        const toolPaths = resolveProdBuildToolPaths();
        const pluginNames = resolveProdPluginNames(options.pluginName);

        if (options.action === "build") {
            await prodBuildAll(pluginNames, { ...options, toolPaths });
            return;
        }

        if (options.action === "install") {
            if (options.clean)
                throw new Error("--clean is only valid with fx:prod:build.");

            for (const pluginName of pluginNames) {
                await installVST3(pluginName, getEffectPlugin(pluginName, usage), { ...options, toolPaths });
            }
            return;
        }

        throw new Error(usage());
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (isMainModule(import.meta.url))
    await main();
