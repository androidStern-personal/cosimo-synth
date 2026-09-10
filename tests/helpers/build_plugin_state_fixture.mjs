import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Build the authored fixture through the customer stateSource runtime builder. */
export async function buildPluginStateFixture(buildDirectory) {
    const buildRoot = path.resolve(buildDirectory);
    const allowedRoots = ["native_plugin_state_system", "browser_plugin_state_system"]
        .map(directory => path.join(repoRoot, "build", directory));
    if (!allowedRoots.some(root => buildRoot === root || buildRoot.startsWith(`${root}${path.sep}`))) {
        throw new Error("The plugin-state fixture must remain inside its dedicated build directory.");
    }
    await mkdir(buildRoot, { recursive: true });
    const stagingRoot = await mkdtemp(path.join(buildRoot, "fixture-"));
    await mkdir(path.join(stagingRoot, "kit"));
    await Promise.all([
        cp(path.join(repoRoot, "kit/fx"), path.join(stagingRoot, "kit/fx"), { recursive: true }),
        cp(path.join(repoRoot, "kit/ui"), path.join(stagingRoot, "kit/ui"), { recursive: true }),
        ...["index.ts", "package.json", "kit.json"].map(file =>
            cp(path.join(repoRoot, "kit", file), path.join(stagingRoot, "kit", file))),
        cp(path.join(repoRoot, "tests/native/fixtures/plugin_state_system"), path.join(stagingRoot, "fx/state_lab"), { recursive: true }),
        symlink(path.join(repoRoot, "node_modules"), path.join(stagingRoot, "node_modules")),
        writeFile(path.join(stagingRoot, "package.json"), JSON.stringify({ name: "plugin-state-system-fixture", private: true, type: "module" })),
    ]);
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "state-lab"], {
        cwd: stagingRoot, encoding: "utf8", timeout: 30000,
    });
    if (build.status !== 0) throw new Error(`Production fixture build failed:\n${build.stdout}\n${build.stderr}`);
    const runtimeRoot = path.join(stagingRoot, "build/fx/state_lab_runtime");
    const manifestPath = path.join(runtimeRoot, "PluginStateSystem.cmajorpatch");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.worker !== "worker.js") throw new Error("stateSource did not generate the framework worker declaration.");
    const worker = await readFile(path.join(runtimeRoot, manifest.worker));
    const workerSha256 = createHash("sha256").update(worker).digest("hex");
    await writeFile(path.join(buildRoot, "fixture-path.txt"), `${manifestPath}\n`);
    await writeFile(path.join(buildRoot, "fixture-build.json"), JSON.stringify({
        stagingRoot, manifestPath, workerSha256, workerBytes: worker.length,
        builder: "kit/fx/build-effect.mjs", publicImport: "kit/index",
    }, null, 2) + "\n");
    process.stdout.write(build.stdout);
    console.log(`Production worker SHA-256: ${workerSha256} (${worker.length} bytes)`);
    return manifestPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (process.argv.length !== 3) throw new Error("Usage: node build_plugin_state_fixture.mjs <dedicated-build-directory>");
    console.log(await buildPluginStateFixture(process.argv[2]));
}
