import { access, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

import {
    availableEffectPluginNamesLine,
    buildPlugin,
    effectPlugins,
    repoRoot,
    resolveBuildOutputRoot,
    resolvePluginNames,
} from "./build-effect.mjs";
import { assertPatchedChocWebViewBinary } from "../scripts/check_choc_markers.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const cmajCommandBuildSourceDirectory = path.join(repoRoot, "tools", "cmajor_command_build");
const cmajCommandBuildDirectory = path.join(repoRoot, "build", "cmajor_command");
const pinnedCmajExecutablePath = path.join(
    cmajCommandBuildDirectory,
    "bin",
    process.platform === "win32" ? "cmaj.exe" : "cmaj",
);

function absoluteReleaseToolOverride(environment, name, fallback) {
    const value = environment[name];

    if (value === undefined || value === "")
        return fallback;

    if (!path.isAbsolute(value))
        throw new Error(`${name} must be an absolute executable path.`);

    return value;
}

/** Release callers may provide already-attested CMake and Node paths. */
export function resolveProdBuildToolPaths(environment = process.env, platform = process.platform) {
    return {
        cmake: absoluteReleaseToolOverride(environment, "COSIMO_RELEASE_CMAKE", "cmake"),
        codesign: platform === "darwin" ? "/usr/bin/codesign" : "codesign",
        node: absoluteReleaseToolOverride(environment, "COSIMO_RELEASE_NODE", process.execPath),
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

export function getPinnedCmajExecutablePath() {
    return pinnedCmajExecutablePath;
}

export function validatePinnedCmajExecutable(candidate) {
    if (typeof candidate !== "string" || path.resolve(candidate) !== pinnedCmajExecutablePath) {
        throw new Error(
            `COSIMO_CMAJ_EXECUTABLE must be the Cmajor command built from the pinned source: ${pinnedCmajExecutablePath}`,
        );
    }

    return pinnedCmajExecutablePath;
}

export function createPinnedCmajConfigureArgs() {
    return [
        "-S", cmajCommandBuildSourceDirectory,
        "-B", cmajCommandBuildDirectory,
        "-DCMAKE_BUILD_TYPE=Release",
    ];
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
    const pinnedExecutable = validatePinnedCmajExecutable(cmajExecutable);

    return [
        "-S", cmakeSourceDirectory,
        "-B", cmakeBuildDirectory,
        "-DCMAKE_BUILD_TYPE=Release",
        `-DCOSIMO_EFFECT_PATCH_PATH=${runtimePatchPath}`,
        `-DCOSIMO_EFFECT_OUTPUT_DIR=${juceOutputDirectory}`,
        `-DCOSIMO_EFFECT_PLUGIN_TARGET=${pluginTarget}`,
        `-DCOSIMO_CMAJ_EXECUTABLE=${pinnedExecutable}`,
        ...(disableMicrophonePermission ? ["-DCOSIMO_DISABLE_MICROPHONE_PERMISSION=ON"] : []),
    ];
}

async function preparePinnedCmajExecutable(toolPaths, cmakeJobs, preparedExecutable = null) {
    if (preparedExecutable !== null) {
        const executable = validatePinnedCmajExecutable(preparedExecutable);

        if (!await pathExists(executable))
            throw new Error(`Pinned Cmajor command not found: ${executable}`);

        return executable;
    }

    run(toolPaths.cmake, createPinnedCmajConfigureArgs());
    run(toolPaths.cmake, createCmakeBuildArgs(cmajCommandBuildDirectory, "cmaj", cmakeJobs));

    if (!await pathExists(pinnedCmajExecutablePath))
        throw new Error(`Pinned Cmajor command was not built: ${pinnedCmajExecutablePath}`);

    return pinnedCmajExecutablePath;
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

    for (const entry of await readdir(juceOut, { withFileTypes: true })) {
        if (entry.name === "_build")
            continue;

        await rm(path.join(juceOut, entry.name), { recursive: true, force: true });
    }
}

async function generateJuceProject(pluginName, plugin, options = {}) {
    const runtimePatchPath = path.join(repoRoot, plugin.runtimeOut, path.basename(plugin.patch));
    const juceOut = resolveBuildOutputRoot(plugin.juceOut, `${pluginName} juceOut`);
    const cmakeBuildDir = path.join(juceOut, "_build");
    const cmakeSourceDirectory = path.join(repoRoot, "tools", "effect_plugin_build");

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

    verifyPatchedWebView(getBuiltVST3BinaryPath(plugin));

    console.log(`Built ${pluginName} dedicated plugin project at ${path.relative(repoRoot, cmakeBuildDir)}`);
}

async function prodBuild(pluginName, options = {}) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

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
    const args = [scriptPath, "build", pluginName];

    if (options.clean)
        args.push("--clean");

    if (options.cmajExecutable)
        args.push(`--prepared-cmaj-executable=${validatePinnedCmajExecutable(options.cmajExecutable)}`);

    return args;
}

function runChildProcess(args, env, nodeExecutable) {
    return new Promise((resolve, reject) => {
        const child = spawn(nodeExecutable, args, {
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
                ? `${nodeExecutable} ${args.join(" ")} exited via ${signal}.`
                : `${nodeExecutable} ${args.join(" ")} exited with code ${code}.`));
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
    const cmajExecutable = await preparePinnedCmajExecutable(
        toolPaths,
        cmakeJobs,
        options.cmajExecutable ?? null,
    );
    const buildOptions = { ...options, toolPaths, cmajExecutable };

    if (pluginNames.length === 1) {
        await prodBuild(pluginNames[0], { ...buildOptions, cmakeJobs });
        return;
    }

    console.log(`Building ${pluginNames.join(", ")} with ${pluginJobs} plugin job(s), ${cmakeJobs} CMake job(s) per plugin.`);

    await runLimited(pluginNames, pluginJobs, (pluginName) => runChildProcess(
        createProdBuildChildArgs(pluginName, buildOptions),
        {
            ...process.env,
            COSIMO_CMAKE_JOBS: String(cmakeJobs),
            ...(path.isAbsolute(toolPaths.cmake) ? { COSIMO_RELEASE_CMAKE: toolPaths.cmake } : {}),
            COSIMO_RELEASE_NODE: toolPaths.node,
        },
        toolPaths.node,
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

function verifyPatchedWebView(binaryPath) {
    assertPatchedChocWebViewBinary(binaryPath);
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
    signVST3Bundle(installedVST3, options.toolPaths);
    verifyVST3Bundle(installedVST3, options.toolPaths);
    verifyPatchedWebView(installedVST3Binary);

    console.log(`Installed ${pluginName} VST3: ${installedVST3}`);
}

export function parseArgs(argv) {
    const action = argv[2];
    const pluginName = argv[3];
    const flags = new Set();
    let cmajExecutable = null;

    for (const argument of argv.slice(4)) {
        if (argument.startsWith("--prepared-cmaj-executable=")) {
            if (cmajExecutable !== null)
                throw new Error("The prepared Cmajor executable may only be provided once.");

            cmajExecutable = validatePinnedCmajExecutable(argument.slice(argument.indexOf("=") + 1));
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
        cmajExecutable,
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
                await installVST3(pluginName, effectPlugins[pluginName], { ...options, toolPaths });
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
