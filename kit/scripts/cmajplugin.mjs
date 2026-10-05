// The generic CmajPlugin.vst3 loader: install the hash-pinned download from
// npm run kit:setup, or point the installed loader at one plugin.
//
//   node kit/scripts/cmajplugin.mjs install [--dry-run]
//   node kit/scripts/cmajplugin.mjs jit-install <plugin> [--dry-run]
//
// npm scripts: cmajplugin:install, fx:jit:install.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPlugin, createJitInstallPlan, effectPluginTargetNames } from "../fx/build-effect.mjs";
import { assertPatchedChocWebViewBinary } from "./check_choc_markers.mjs";
import { isMainModule, projectRoot, readJsonObject, runCommand } from "./common.mjs";
import { installVST3Bundle, userVST3Directory } from "./install_vst3.mjs";
import { requireCurrentTool, resolveCmajExecutable } from "./toolchain.mjs";

const installedCmajPlugin = path.join(userVST3Directory, "CmajPlugin.vst3");
const jitConfigPath = path.join(userVST3Directory, "CmajPlugin.json");

export function usage() {
    return [
        "Usage:",
        "  npm run cmajplugin:install -- [--dry-run]",
        "  npm run fx:jit:install -- <plugin> [--dry-run]",
        "",
        "cmajplugin:install copies the verified CmajPlugin.vst3 from npm run kit:setup into",
        "~/Library/Audio/Plug-Ins/VST3. It does not write CmajPlugin.json.",
        "fx:jit:install checks one plugin's patch with the pinned cmaj and points the",
        "installed CmajPlugin.vst3 at it through CmajPlugin.json.",
        "",
        `Plugins: ${effectPluginTargetNames().join(", ")}`,
    ].join("\n");
}

/** Each subcommand's flags and how many positional arguments it takes (minimum, maximum). */
const commands = {
    install: { flags: ["--dry-run"], positional: [0, 0] },
    "jit-install": { flags: ["--dry-run"], positional: [1, 1] },
};

function parseArguments(args) {
    const [command, ...rest] = args;
    const spec = commands[command];

    if (spec === undefined)
        throw new Error(usage());

    const positional = rest.filter((argument) => !argument.startsWith("-"));
    const flags = new Set(rest.filter((argument) => argument.startsWith("-")));
    const help = flags.has("--help") || flags.has("-h");

    for (const flag of flags) {
        if (!spec.flags.includes(flag) && flag !== "--help" && flag !== "-h")
            throw new Error(`Unknown argument: ${flag}\n\n${usage()}`);
    }

    if (!help && (positional.length < spec.positional[0] || positional.length > spec.positional[1]))
        throw new Error(usage());

    return { command, positional, flags, help };
}

export async function installCmajPlugin({ dryRun = false, log = console.log } = {}) {
    const bundle = await requireCurrentTool("cmajPlugin");

    await installVST3Bundle({ bundle, dryRun, log });
    log("CmajPlugin.json was not changed.");
}

/** Validate one plugin's patch with the pinned cmaj and point the installed CmajPlugin.vst3 at it. */
export async function jitInstall(pluginName, { dryRun = false, log = console.log } = {}) {
    const plan = createJitInstallPlan(pluginName);
    const sourcePatch = path.join(projectRoot, plan.patch);
    const manifest = readJsonObject(sourcePatch);
    const devModule = manifest.view?.devModule;

    if (manifest.view?.src !== "view/index.js")
        throw new Error(`${plan.patch} must set view.src to "view/index.js" (found ${JSON.stringify(manifest.view?.src ?? null)}).`);

    if (typeof devModule !== "string" || devModule === "")
        throw new Error(`${plan.patch} must declare view.devModule so the loader can reach the dev server.`);

    if (!existsSync(path.join(projectRoot, devModule.replace(/^\/+/u, ""))))
        throw new Error(`${plan.patch} view.devModule points to a missing file: ${devModule}`);

    if (!existsSync(installedCmajPlugin))
        throw new Error(`CmajPlugin.vst3 is not installed at ${installedCmajPlugin}. Run npm run cmajplugin:install first.`);

    assertPatchedChocWebViewBinary(path.join(installedCmajPlugin, "Contents/MacOS/CmajPlugin"));
    runCommand("codesign", ["--verify", "--deep", "--strict", installedCmajPlugin], {
        missingFix: "Install the Xcode Command Line Tools with xcode-select --install.",
    });

    const cmaj = await resolveCmajExecutable();

    if (plan.jitInstallRuntime)
        await buildPlugin(plan.name);

    const patch = path.join(projectRoot, plan.jitInstallRuntime ? plan.runtimePatch : plan.patch);

    runCommand(cmaj, ["play", "--dry-run", "--stop-on-error", patch]);

    if (dryRun) {
        log(`Validated patch: ${patch}`);
        log(`Would point ${installedCmajPlugin} at it through ${jitConfigPath}`);
        return;
    }

    await mkdir(userVST3Directory, { recursive: true });
    await writeFile(jitConfigPath, `${JSON.stringify({ location: patch }, null, 2)}\n`);
    log(`Validated patch: ${patch}`);
    log(`Wrote ${jitConfigPath}; CmajPlugin.vst3 now loads ${plan.name}.`);
    log("Start the shared dev server separately with: npm run fx:dev");
}

async function main(args) {
    const { command, positional, flags, help } = parseArguments(args);

    if (help) {
        console.log(usage());
        return;
    }

    if (command === "install")
        await installCmajPlugin({ dryRun: flags.has("--dry-run") });
    else
        await jitInstall(positional[0], { dryRun: flags.has("--dry-run") });
}

if (isMainModule(import.meta.url)) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
