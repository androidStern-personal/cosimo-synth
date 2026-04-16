import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
    buildPlugin,
    effectPlugins,
    repoRoot,
} from "./build-effect.mjs";

const cacheRoot = process.env.COSIMO_DEV_CACHE
    ? path.resolve(process.env.COSIMO_DEV_CACHE)
    : path.join(process.env.HOME, "Library/Caches/cosimo-synth-dev");

function availablePluginNames() {
    return Object.keys(effectPlugins).join(", ");
}

function usage() {
    return [
        "Usage:",
        "  npm run fx:prod:build -- <plugin>",
        "  npm run fx:prod:install -- <plugin> [--dry-run]",
        "",
        `Available plugins: ${availablePluginNames()}`,
        "",
        "Notes:",
        "  fx:prod:build creates a dedicated plugin bundle under build/.",
        "  fx:prod:install copies an already-built dedicated VST3 bundle.",
        "  fx:prod:install does not write CmajPlugin.json and does not touch AU plugins.",
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

async function pathExists(nextPath) {
    try {
        await access(nextPath);
        return true;
    } catch {
        return false;
    }
}

function getCmajorVersion() {
    const output = run("cmaj", ["version"], { capture: true });
    const match = output.match(/Cmajor Version:\s*(\S+)/);

    if (!match)
        throw new Error("Could not determine Cmajor version from `cmaj version`.");

    return match[1];
}

async function ensureJucePath() {
    const jucePath = process.env.JUCE_PATH
        ? path.resolve(process.env.JUCE_PATH)
        : path.join(cacheRoot, "JUCE");

    if (!await pathExists(path.join(jucePath, ".git")))
        run("git", ["clone", "--depth", "1", "https://github.com/juce-framework/JUCE.git", jucePath]);

    return jucePath;
}

async function ensureCmajorSourcePath() {
    const cmajorVersion = getCmajorVersion();
    const cmajorSourcePath = process.env.CMAJOR_SOURCE_PATH
        ? path.resolve(process.env.CMAJOR_SOURCE_PATH)
        : path.join(cacheRoot, `cmajor-source-${cmajorVersion}`);

    if (!await pathExists(path.join(cmajorSourcePath, ".git"))) {
        run("git", [
            "clone",
            "--depth",
            "1",
            "--branch",
            cmajorVersion,
            "https://github.com/cmajor-lang/cmajor.git",
            cmajorSourcePath,
        ]);
    }

    const chocJsonPath = path.join(cmajorSourcePath, "include/choc/choc/json/choc_JSON.h");

    if (!await pathExists(chocJsonPath))
        run("git", ["-C", cmajorSourcePath, "submodule", "update", "--init", "--depth", "1", "include/choc"]);

    return cmajorSourcePath;
}

async function generateJuceProject(pluginName, plugin) {
    const jucePath = await ensureJucePath();
    const cmajorSourcePath = await ensureCmajorSourcePath();
    const runtimePatchPath = path.join(repoRoot, plugin.runtimeOut, path.basename(plugin.patch));
    const juceOut = path.join(repoRoot, plugin.juceOut);

    await rm(juceOut, { recursive: true, force: true });

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

async function buildJuceProject(pluginName, plugin) {
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

    run("cmake", [
        "--build",
        cmakeBuildDir,
        "--config",
        "Release",
        "--target",
        `${plugin.cmakeTarget}_VST3`,
    ]);

    console.log(`Built ${pluginName} dedicated plugin project at ${path.relative(repoRoot, cmakeBuildDir)}`);
}

async function prodBuild(pluginName) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

    await buildPlugin(pluginName);
    await generateJuceProject(pluginName, plugin);
    await buildJuceProject(pluginName, plugin);

    return plugin;
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

function signInstalledVST3(vst3Path) {
    run("codesign", ["--force", "--deep", "--sign", "-", vst3Path], { capture: true });
}

function verifyInstalledVST3(vst3Path) {
    run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", vst3Path], { capture: true });
}

async function installVST3(pluginName, plugin, options) {
    const builtVST3 = getBuiltVST3Path(plugin);
    const builtVST3Binary = getBuiltVST3BinaryPath(plugin);
    const installDir = path.join(process.env.HOME, "Library/Audio/Plug-Ins/VST3");
    const installedVST3 = path.join(installDir, `${plugin.productName}.vst3`);

    if (!await pathExists(builtVST3))
        throw new Error(`Built VST3 bundle not found: ${builtVST3}`);

    if (!await pathExists(builtVST3Binary))
        throw new Error(`Built VST3 binary not found: ${builtVST3Binary}`);

    if (options.dryRun) {
        console.log(`Would install ${pluginName} VST3 from: ${builtVST3}`);
        console.log(`Would install ${pluginName} VST3 to: ${installedVST3}`);
        return;
    }

    await mkdir(installDir, { recursive: true });
    await rm(installedVST3, { recursive: true, force: true });
    await cp(builtVST3, installedVST3, { recursive: true });
    signInstalledVST3(installedVST3);
    verifyInstalledVST3(installedVST3);

    console.log(`Installed ${pluginName} VST3: ${installedVST3}`);
}

function parseArgs(argv) {
    const action = argv[2];
    const pluginName = argv[3];
    const flags = new Set(argv.slice(4));

    for (const flag of flags) {
        if (!["--dry-run", "--help", "-h"].includes(flag))
            throw new Error(`Unknown argument: ${flag}\n\n${usage()}`);
    }

    return {
        action,
        pluginName,
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

        if (!effectPlugins[options.pluginName])
            throw new Error(usage());

        if (options.action === "build") {
            await prodBuild(options.pluginName);
            return;
        }

        if (options.action === "install") {
            await installVST3(options.pluginName, effectPlugins[options.pluginName], options);
            return;
        }

        throw new Error(usage());
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

await main();
