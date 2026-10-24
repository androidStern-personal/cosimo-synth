import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { stageCustomerStateFixture, buildCustomerStateFixture } from "./build_customer_state_fixture.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Build the authored fixture through the customer stateSource runtime builder. */
export async function buildPluginStateFixture(buildDirectory) {
    const buildRoot = path.resolve(buildDirectory);
    const allowedRoots = ["native_plugin_state_system", "browser_plugin_state_system"]
        .map(directory => path.join(repoRoot, "build", directory));
    if (!allowedRoots.some(root => buildRoot === root || buildRoot.startsWith(`${root}${path.sep}`))) {
        throw new Error("The plugin-state fixture must remain inside its dedicated build directory.");
    }
    const stagingRoot = await stageCustomerStateFixture(buildRoot, "plugin_state_system", "state_lab");
    const { manifestPath, worker } = await buildCustomerStateFixture(stagingRoot, "state-lab",
        "build/fx/state_lab_runtime/PluginStateSystem.cmajorpatch");
    const workerSha256 = createHash("sha256").update(worker).digest("hex");
    await writeFile(path.join(buildRoot, "fixture-path.txt"), `${manifestPath}\n`);
    await writeFile(path.join(buildRoot, "fixture-build.json"), JSON.stringify({
        stagingRoot, manifestPath, workerSha256, workerBytes: worker.length,
        builder: "kit/fx/build-effect.mjs", publicImport: "kit/index",
    }, null, 2) + "\n");
    console.log(`Production worker SHA-256: ${workerSha256} (${worker.length} bytes)`);
    return manifestPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv.length !== 3) throw new Error("Usage: node build_plugin_state_fixture.mjs <dedicated-build-directory>");
    console.log(await buildPluginStateFixture(process.argv[2]));
}
