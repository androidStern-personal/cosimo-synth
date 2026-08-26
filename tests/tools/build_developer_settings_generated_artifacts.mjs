import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const generatedDirectory = path.join(repoRoot, "build", "developer-settings-generated");
const ordinaryBundlePath = path.join(repoRoot, "patch_gui", "desktop", "app.js");
const ordinaryBundleMapPath = `${ordinaryBundlePath}.map`;
const sitesBundlePath = path.join(repoRoot, "dist", "assets", "patch_gui", "desktop", "app.js");
const buildEnvironment = { ...process.env };
delete buildEnvironment.VITE_COSIMO_DEVELOPER_SETTINGS;

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: buildEnvironment,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
    }
}

await fs.rm(generatedDirectory, { recursive: true, force: true });
await fs.mkdir(generatedDirectory, { recursive: true });

let buildFailure;
try {
    run("npm", ["run", "ui:desktop:build"]);
    const [ordinaryBundle, ordinaryBundleMap] = await Promise.all([
        fs.readFile(ordinaryBundlePath),
        fs.readFile(ordinaryBundleMapPath),
    ]);
    await fs.copyFile(ordinaryBundlePath, path.join(generatedDirectory, "ordinary-app.js"));

    run("npm", ["run", "sites:build"]);
    const [restoredBundle, restoredBundleMap] = await Promise.all([
        fs.readFile(ordinaryBundlePath),
        fs.readFile(ordinaryBundleMapPath),
    ]);
    assert.deepEqual(restoredBundle, ordinaryBundle, "sites:build changed the ordinary desktop bundle");
    assert.deepEqual(restoredBundleMap, ordinaryBundleMap, "sites:build changed the ordinary desktop source map");
    await fs.copyFile(sitesBundlePath, path.join(generatedDirectory, "sites-app.js"));
} catch (cause) {
    buildFailure = cause;
    try {
        // Keep a failed test from leaving generated source dirty even if the
        // production build's own restore path regresses.
        run("npm", ["run", "ui:desktop:build"]);
    } catch (restoreCause) {
        throw new AggregateError(
            [buildFailure, restoreCause],
            "Developer-settings artifact build and ordinary-bundle restore both failed.",
        );
    }
}

if (buildFailure) {
    throw buildFailure;
}
