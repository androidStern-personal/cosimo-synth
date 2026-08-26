import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const generatedDirectory = path.join(repoRoot, "build", "developer-settings-generated");
const ordinaryBundlePath = path.join(repoRoot, "patch_gui", "desktop", "app.js");
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
    await fs.copyFile(ordinaryBundlePath, path.join(generatedDirectory, "ordinary-app.js"));

    run("npm", ["run", "sites:build"]);
    await fs.copyFile(sitesBundlePath, path.join(generatedDirectory, "sites-app.js"));
} catch (cause) {
    buildFailure = cause;
} finally {
    try {
        // Leave checked-in generated UI in its ordinary production form.
        run("npm", ["run", "ui:desktop:build"]);
    } catch (restoreCause) {
        if (buildFailure) {
            throw new AggregateError(
                [buildFailure, restoreCause],
                "Developer-settings artifact build and ordinary-bundle restore both failed.",
            );
        }
        throw restoreCause;
    }
}

if (buildFailure) {
    throw buildFailure;
}
