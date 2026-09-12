import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildOfflineRendererModule } from "./offline-renderer-module.mjs";
import { copyWebHostAssets } from "./web-host-assets.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDirectory, "..");
const outputDirectory = path.join(repoRoot, "build", "web");
const bounceBrowserRuntimeFiles = Object.freeze([
    "bank-format.mjs",
    "bank-install.mjs",
    "browser-bank-store.mjs",
    "digest.mjs",
    "document.mjs",
    "live-bank-install.mjs",
    "runtime-restorer.mjs",
]);

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

async function buildRendererAwarePatchModule() {
    const generatedClassPath = path.join(outputDirectory, "cmaj_WavetableSynth.class.js");
    run("node", [
        "scripts/generate_cmajor_javascript_with_renderer.mjs",
        "WavetableSynth.cmajorpatch",
        generatedClassPath,
        "WavetableSynth",
    ]);

    const [generatedClass, manifestSource] = await Promise.all([
        fs.readFile(generatedClassPath, "utf8"),
        fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource);
    const patchModule = `// Generated product WebAudio module with the canonical renderer.\n\n`
        + `import * as helpers from "./cmaj_api/cmaj-audio-worklet-helper.js";\n`
        + `import { createCosimoMidiHandler } from "./cosimo-midi.mjs";\n\n`
        + `export const manifest = ${JSON.stringify(manifest, null, 2)};\n\n`
        + `export function getOutputEndpoints() { return WavetableSynth.prototype.getOutputEndpoints(); }\n`
        + `export function getInputEndpoints() { return WavetableSynth.prototype.getInputEndpoints(); }\n\n`
        + `export async function createAudioWorkletNodePatchConnection(audioContext, workletName) {\n`
        + `  const connection = new helpers.AudioWorkletPatchConnection(manifest);\n`
        + `  const midi = createCosimoMidiHandler(connection);\n`
        + `  connection.sendMessageToServer = midi.sendMessageToServer;\n`
        + `  await connection.initialise({ CmajorClass: WavetableSynth, audioContext, workletName, hostDescription: "WebAudio", handleStateHostEffect: midi.handleStateHostEffect, performanceMessagePrefix: "cosimo-perf", performanceMarkedEndpoints: ["modulationProgram", "modulationAmount"] });\n`
        + `  return connection;\n`
        + `}\n\n`
        + generatedClass;

    await Promise.all([
        fs.writeFile(path.join(outputDirectory, "cmaj_Cosimo_Synth.js"), patchModule),
        buildOfflineRendererModule({outputDirectory,generatedClass,sharedData:manifest.sharedData}),
    ]);
    await fs.rm(generatedClassPath);
}

async function copyCmajorWebRuntime() {
    if (process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE) {
        await fs.cp(path.join(process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE, "javascript", "cmaj_api"),
            path.join(outputDirectory, "cmaj_api"), {recursive:true});
        return;
    }
    stageCmajorWebRuntime(repoRoot, {
        buildDirectory: path.join(repoRoot, "build", "cmajor_web_runtime-web"),
        outputDirectory: path.join(outputDirectory, "cmaj_api"),
    });
}

async function copyBounceBrowserRuntime() {
    const targetDirectory = path.join(outputDirectory, "bounce");
    await fs.mkdir(targetDirectory, { recursive: true });
    await Promise.all(bounceBrowserRuntimeFiles.map((fileName) => fs.copyFile(
        path.join(repoRoot, "bounce", fileName),
        path.join(targetDirectory, fileName),
    )));
}

async function buildWebProof() {
    await fs.rm(outputDirectory, { recursive: true, force: true });

    run("npm", ["run", "ui:desktop:build"]);
    run("npm", ["run", "ui:worker:build"]);
    run("npm", ["run", "ui:bounce-worker:build"]);
    run("npm", ["run", "ui:speedrun-worker:build"]);
    run("npm", ["run", "ui:video-bounce:build"]);
    run("npm", ["run", "ui:worker:test:build"]);
    await fs.mkdir(path.join(outputDirectory, "patch_gui", "desktop"), { recursive: true });
    await Promise.all([
        fs.copyFile(
            path.join(repoRoot, "patch_gui", "desktop", "app.js"),
            path.join(outputDirectory, "patch_gui", "desktop", "app.js"),
        ),
        fs.copyFile(
            path.join(repoRoot, "patch_gui", "wavetable-worker.js"),
            path.join(outputDirectory, "patch_gui", "wavetable-worker.js"),
        ),
        fs.copyFile(
            path.join(repoRoot, "patch_gui", "bounce-render-worker.js"),
            path.join(outputDirectory, "patch_gui", "bounce-render-worker.js"),
        ),
        fs.copyFile(
            path.join(repoRoot, "patch_gui", "speedrun-checkpoint-worker.js"),
            path.join(outputDirectory, "patch_gui", "speedrun-checkpoint-worker.js"),
        ),
        copyCmajorWebRuntime(),
        buildRendererAwarePatchModule(),
    ]);

    await fs.copyFile(
        path.join(repoRoot, "patch_gui", "wavetable-test-worker.js"),
        path.join(outputDirectory, "patch_gui", "wavetable-test-worker.js"),
    );
    await copyWebHostAssets({
        sourceDirectory: webDirectory,
        outputDirectory,
    });
    await copyBounceBrowserRuntime();
    await fs.cp(path.join(repoRoot, "assets"), path.join(outputDirectory, "assets"), {
        recursive: true,
    });

    console.log(`Cosimo browser proof built at ${outputDirectory}`);
}

await buildWebProof();
