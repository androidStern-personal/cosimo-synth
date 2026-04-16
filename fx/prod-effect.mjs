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
