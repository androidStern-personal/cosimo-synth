import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    canonicalRendererWasmLayout,
    cmajorInitialMemoryPages,
    connectCanonicalRendererWasm,
} from "../web/canonical-renderer-wasm.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patchPath = process.argv[2];
const outputPath = process.argv[3];
const className = process.argv[4] ?? "WavetableSynth";
if (!patchPath || !outputPath) {
    throw new Error(
        "usage: generate_cmajor_javascript_with_renderer.mjs <patch> <output.js> [class-name]",
    );
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `${command} failed (${result.status ?? "unknown"}):\n${result.stderr || result.stdout}`,
        );
    }
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-web-renderer-"));
try {
    const rawJavascript = path.join(temporaryDirectory, "cmajor.js");
    const rendererWasm = path.join(temporaryDirectory, "renderer.wasm");

    run(path.join(repoRoot, "scripts/generate_cmajor_javascript_with_externals.sh"), [
        path.resolve(patchPath),
        rawJavascript,
        className,
    ]);

    const cmajorSource = await fs.readFile(rawJavascript, "utf8");
    const cmajorPages = cmajorInitialMemoryPages(cmajorSource);
    const rendererMemoryBase = cmajorPages * canonicalRendererWasmLayout.pageBytes;
    run(path.join(repoRoot, "scripts/build_three_oscillator_renderer_wasm.sh"), [
        rendererWasm,
        "--memory-base",
        String(rendererMemoryBase),
    ]);

    const rendererBytes = await fs.readFile(rendererWasm);
    const connectedSource = connectCanonicalRendererWasm(cmajorSource, rendererBytes);
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(path.resolve(outputPath), connectedSource);
} finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
}
