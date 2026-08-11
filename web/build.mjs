import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { instrumentCosimoAudioWorkletSource } from "./audio-worklet-instrumentation.mjs";
import { copyWebHostAssets } from "./web-host-assets.mjs";

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

async function instrumentAudioWorklet() {
    const helperPath = path.join(outputDirectory, "cmaj_api", "cmaj-audio-worklet-helper.js");
    const source = await fs.readFile(helperPath, "utf8");
    await fs.writeFile(helperPath, instrumentCosimoAudioWorkletSource(source));
}

async function buildWebProof() {
    await fs.rm(outputDirectory, { recursive: true, force: true });

    run("npm", ["run", "ui:desktop:build"]);
    run("npm", ["run", "ui:worker:build"]);
    run("npm", ["run", "ui:worker:test:build"]);
    run("cmaj", [
        "generate",
        "--target=webaudio-html",
        `--output=${outputDirectory}`,
        "WavetableSynth.cmajorpatch",
    ]);

    await instrumentAudioWorklet();
    await fs.copyFile(
        path.join(repoRoot, "patch_gui", "wavetable-test-worker.js"),
        path.join(outputDirectory, "patch_gui", "wavetable-test-worker.js"),
    );
    await copyWebHostAssets({
        sourceDirectory: webDirectory,
        outputDirectory,
    });
    await fs.cp(path.join(repoRoot, "assets"), path.join(outputDirectory, "assets"), {
        recursive: true,
    });

    console.log(`Cosimo browser proof built at ${outputDirectory}`);
}

await buildWebProof();
