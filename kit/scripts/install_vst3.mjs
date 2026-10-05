// Copy one built VST3 bundle into the user's VST3 folder, replacing the
// previous copy of the same plugin. Used by fx:prod:install and
// cmajplugin:install.

import { cp, mkdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { assertPatchedChocWebViewBinary } from "./check_choc_markers.mjs";
import { runCommand } from "./common.mjs";

export const userVST3Directory = path.join(os.homedir(), "Library/Audio/Plug-Ins/VST3");

/** The bundle's signature must verify and its binary (named like the bundle) must carry the patched CHOC WebView. */
function verifyBundle(bundle, codesign) {
    assertPatchedChocWebViewBinary(path.join(bundle, "Contents/MacOS", path.basename(bundle, ".vst3")));
    runCommand(codesign, ["--verify", "--deep", "--strict", bundle], {
        missingFix: "Install the Xcode Command Line Tools with xcode-select --install.",
    });
}

/**
 * Install `bundle` as <installDirectory>/<bundle name>. `previousBundleName`
 * is the plugin's former file name, removed after the new copy verifies.
 * Returns the installed path.
 */
export async function installVST3Bundle({
    bundle,
    installDirectory = userVST3Directory,
    previousBundleName,
    dryRun = false,
    codesign = "codesign",
    log = console.log,
}) {
    const name = path.basename(bundle);
    const destination = path.join(installDirectory, name);
    const previous = previousBundleName === undefined ? null : path.join(installDirectory, previousBundleName);

    verifyBundle(bundle, codesign);

    if (dryRun) {
        log(`Would install ${name}: ${destination}`);
        return destination;
    }

    // Copy beside the destination first so a failed copy leaves the old plugin in place.
    const staging = path.join(installDirectory, `.${name}.installing`);

    await mkdir(installDirectory, { recursive: true });
    await rm(staging, { recursive: true, force: true });
    await cp(bundle, staging, { recursive: true, verbatimSymlinks: true });
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    verifyBundle(destination, codesign);

    if (previous !== null)
        await rm(previous, { recursive: true, force: true });

    log(`Installed ${name}: ${destination}`);
    return destination;
}
