// Maintainer command: build the generic CmajPlugin.vst3 from the pinned Cmajor
// fork, or install that build. The fork's tool build needs its upstream
// submodules over GitHub SSH, which customers do not have; they install the
// hash-pinned download from npm run kit:setup instead.
//
//   node scripts/build_cmajplugin.mjs build [<build directory>]
//   node scripts/build_cmajplugin.mjs install [--dry-run]

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertPatchedChocWebViewBinary } from "../kit/scripts/check_choc_markers.mjs";
import { isMainModule, projectRoot, runCommand } from "../kit/scripts/common.mjs";
import { installVST3Bundle } from "../kit/scripts/install_vst3.mjs";

const defaultBuildDirectory = path.join(projectRoot, "build", "cmajplugin-source");

const usage = [
    "Usage:",
    "  node scripts/build_cmajplugin.mjs build [<build directory>]",
    "  node scripts/build_cmajplugin.mjs install [--dry-run]",
    "",
    "build compiles CmajPlugin.vst3 from the pinned fork and checks its CHOC markers.",
    "install copies that build into ~/Library/Audio/Plug-Ins/VST3. It does not write CmajPlugin.json.",
].join("\n");

/** Where `build` leaves the bundle for a given build directory. */
export function sourceBuiltCmajPlugin(buildDirectory = defaultBuildDirectory) {
    return path.join(buildDirectory, "cmajplugin", "CmajPlugin_artefacts", "Release", "VST3", "CmajPlugin.vst3");
}

/** Build CmajPlugin.vst3 from the pinned fork and check its CHOC markers. */
export function buildCmajPlugin(buildDirectory = defaultBuildDirectory, { log = console.log } = {}) {
    runCommand("cmake", [
        "-S", path.join(projectRoot, "tools/cmajplugin_build"),
        "-B", buildDirectory,
        "-DCMAKE_OSX_ARCHITECTURES=arm64;x86_64",
        "-DCMAKE_OSX_DEPLOYMENT_TARGET=10.15",
        "-DCMAKE_BUILD_TYPE=Release",
    ], { capture: false });
    runCommand("cmake", [
        "--build", buildDirectory,
        "--config", "Release",
        "--target", "CmajPlugin_VST3",
        "--parallel", process.env.BUILDER_KIT_CMAKE_JOBS ?? String(os.availableParallelism()),
    ], { capture: false });

    const bundle = sourceBuiltCmajPlugin(buildDirectory);

    assertPatchedChocWebViewBinary(path.join(bundle, "Contents/MacOS/CmajPlugin"));
    log(`Built patched CmajPlugin VST3: ${bundle}`);
    return bundle;
}

/** Install the source-built CmajPlugin.vst3. */
export async function installSourceBuiltCmajPlugin({ dryRun = false, log = console.log } = {}) {
    const bundle = sourceBuiltCmajPlugin();

    if (!existsSync(bundle))
        throw new Error(`No CmajPlugin.vst3 at ${bundle}. Run node scripts/build_cmajplugin.mjs build first.`);

    assertPatchedChocWebViewBinary(path.join(bundle, "Contents/MacOS/CmajPlugin"));
    await installVST3Bundle({ bundle, dryRun, log });
    log("CmajPlugin.json was not changed.");
}

async function main([command = "build", ...rest]) {
    const flags = rest.filter((argument) => argument.startsWith("-"));
    const positional = rest.filter((argument) => !argument.startsWith("-"));

    if (flags.includes("--help") || flags.includes("-h")) {
        console.log(usage);
        return;
    }

    if (command === "build" && flags.length === 0 && positional.length <= 1)
        buildCmajPlugin(positional[0] ? path.resolve(positional[0]) : undefined);
    else if (command === "install" && flags.every((flag) => flag === "--dry-run") && positional.length === 0)
        await installSourceBuiltCmajPlugin({ dryRun: flags.includes("--dry-run") });
    else
        throw new Error(usage);
}

if (isMainModule(import.meta.url)) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
