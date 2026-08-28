import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    adaptCosimoAudioWorkletModuleLoading,
    fixCosimoAudioWorkletListenerRemoval,
    instrumentCosimoAudioWorkletSource,
} from "./audio-worklet-instrumentation.mjs";
import { copyWebHostAssets } from "./web-host-assets.mjs";

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

function runAndRead(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf8",
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.\n${result.stderr}`);
    }
    return result.stdout.trim();
}

async function makeBuildTreeWritable(root) {
    let stats;
    try {
        stats = await fs.lstat(root);
    } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
    }

    if (stats.isSymbolicLink()) return;
    if (!stats.isDirectory()) {
        await fs.chmod(root, stats.mode | 0o600);
        return;
    }

    await fs.chmod(root, stats.mode | 0o700);
    const children = await fs.readdir(root);
    await Promise.all(children.map((child) => makeBuildTreeWritable(path.join(root, child))));
}

async function buildRendererAwarePatchModule() {
    const generatedClassPath = path.join(outputDirectory, "cmaj_WavetableSynth.class.js");
    const offlineClassPath = path.join(outputDirectory, "cmaj_Cosimo_Synth.offline.js");
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
        + `import * as helpers from "./cmaj_api/cmaj-audio-worklet-helper.js";\n\n`
        + `export const manifest = ${JSON.stringify(manifest, null, 2)};\n\n`
        + `export function getOutputEndpoints() { return WavetableSynth.prototype.getOutputEndpoints(); }\n`
        + `export function getInputEndpoints() { return WavetableSynth.prototype.getInputEndpoints(); }\n\n`
        + `export async function createAudioWorkletNodePatchConnection(audioContext, workletName) {\n`
        + `  const connection = new helpers.AudioWorkletPatchConnection(manifest);\n`
        + `  await connection.initialise({ CmajorClass: WavetableSynth, audioContext, workletName, hostDescription: "WebAudio" });\n`
        + `  return connection;\n`
        + `}\n\n`
        + generatedClass;

    const offlineModule = `// Generated class-only Cosimo performer for offline Bounce workers.\n`
        + `// It deliberately has no AudioWorklet helper import.\n\n`
        + generatedClass
        + `\nexport { WavetableSynth };\nexport default WavetableSynth;\n`;

    await Promise.all([
        fs.writeFile(path.join(outputDirectory, "cmaj_Cosimo_Synth.js"), patchModule),
        fs.writeFile(offlineClassPath, offlineModule),
    ]);
    await fs.rm(generatedClassPath);
}

async function copyCmajorWebRuntime() {
    const resolution = JSON.parse(runAndRead("python3", ["scripts/resolve_build_dependencies.py"]));
    const { cmajor, choc, juce } = resolution.dependencies;
    const runtimeRoot = cmajor.path;
    const runtimeOutputRoot = path.join(outputDirectory, "cmaj_api");
    await fs.writeFile(
        path.join(outputDirectory, "cosimo-dependency-resolution.json"),
        `${JSON.stringify(resolution, null, 2)}\n`,
    );
    console.log(
        `Cosimo CPM dependencies: Cmajor@${cmajor.commit}, CHOC@${choc.commit}, JUCE@${juce.commit} (${resolution.cacheRoot})`,
    );
    await fs.cp(
        path.join(runtimeRoot, "javascript", "cmaj_api"),
        runtimeOutputRoot,
        { recursive: true },
    );
    await makeBuildTreeWritable(runtimeOutputRoot);
}

async function instrumentAudioWorklet() {
    const helperPath = path.join(outputDirectory, "cmaj_api", "cmaj-audio-worklet-helper.js");
    const source = await fs.readFile(helperPath, "utf8");
    await fs.writeFile(
        helperPath,
        fixCosimoAudioWorkletListenerRemoval(
            adaptCosimoAudioWorkletModuleLoading(instrumentCosimoAudioWorkletSource(source)),
        ),
    );
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
    await makeBuildTreeWritable(outputDirectory);
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

    await instrumentAudioWorklet();
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
