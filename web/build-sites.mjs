import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { preparePublicWebAssets } from "./public-build.mjs";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDirectory, "..");
const webBuildDirectory = path.join(repoRoot, "build", "web");
const distDirectory = path.join(repoRoot, "dist");
const ordinaryBuildEnvironment = { ...process.env };
delete ordinaryBuildEnvironment.VITE_COSIMO_DEVELOPER_SETTINGS;
const sitesBuildEnvironment = {
    ...ordinaryBuildEnvironment,
    VITE_COSIMO_DEVELOPER_SETTINGS: "1",
};

function run(command, args, environment = process.env) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: environment,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
    }
}

let sitesBuildFailure;
try {
    await fs.rm(distDirectory, { recursive: true, force: true });
    // Andrew explicitly approved public Developer Settings on this Sites
    // deployment. Other production targets do not receive this opt-in.
    run("npm", ["run", "web:build"], sitesBuildEnvironment);
    await fs.mkdir(path.join(distDirectory, "server"), { recursive: true });
    const assetsDirectory = path.join(distDirectory, "assets");
    await preparePublicWebAssets(webBuildDirectory, assetsDirectory);
    // Sites serves matching static assets before the Worker and does not apply
    // Cloudflare _headers files. Keep the document behind the Worker so its
    // isolation headers reach the browser. Store it without an HTML extension:
    // the asset host redirects HTML to clean URLs, bypassing the Worker.
    await fs.rename(path.join(assetsDirectory, "index.html"), path.join(assetsDirectory, "cosimo-document.bin"));
    await fs.rm(path.join(assetsDirectory, "synth.html"));
    await fs.copyFile(
        path.join(webDirectory, "sites-worker.mjs"),
        path.join(distDirectory, "server", "index.js"),
    );
} catch (cause) {
    sitesBuildFailure = cause;
} finally {
    try {
        // web:build writes the generated desktop bundle in place and fills
        // build/web. Rebuild both as the ordinary production build after dist
        // has captured the Sites-specific build, including when the Sites
        // build fails, so no later proof runs with Developer Settings.
        run("npm", ["run", "web:build"], ordinaryBuildEnvironment);
    } catch (restoreCause) {
        if (sitesBuildFailure) {
            throw new AggregateError(
                [sitesBuildFailure, restoreCause],
                "Sites build and ordinary web-build restore both failed.",
            );
        }
        throw restoreCause;
    }
}

if (sitesBuildFailure) {
    throw sitesBuildFailure;
}

console.log(`Cosimo Sites bundle built at ${distDirectory}`);
