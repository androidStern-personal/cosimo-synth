import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDirectory, "..");
const outputDirectory = path.join(repoRoot, "build", "web");

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
    }
}

async function copyWebHost() {
    await Promise.all([
        fs.copyFile(path.join(webDirectory, "index.html"), path.join(outputDirectory, "index.html")),
        fs.copyFile(path.join(webDirectory, "cosimo-web-host.js"), path.join(outputDirectory, "cosimo-web-host.js")),
    ]);
}

async function buildWebProof() {
    await fs.rm(outputDirectory, { recursive: true, force: true });

    run("npm", ["run", "ui:desktop:build"]);
    run("npm", ["run", "ui:worker:build"]);
    run("cmaj", [
        "generate",
        "--target=webaudio-html",
        `--output=${outputDirectory}`,
        "WavetableSynth.cmajorpatch",
    ]);

    await copyWebHost();
    await fs.cp(path.join(repoRoot, "assets"), path.join(outputDirectory, "assets"), {
        recursive: true,
    });

    console.log(`Cosimo browser proof built at ${outputDirectory}`);
}

await buildWebProof();
