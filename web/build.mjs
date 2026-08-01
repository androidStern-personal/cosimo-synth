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
        fs.copyFile(path.join(webDirectory, "favicon.svg"), path.join(outputDirectory, "favicon.svg")),
        fs.copyFile(path.join(webDirectory, "cosimo-web-host.js"), path.join(outputDirectory, "cosimo-web-host.js")),
        fs.copyFile(
            path.join(webDirectory, "desktop-production-loader.js"),
            path.join(outputDirectory, "patch_gui", "desktop", "index.js"),
        ),
    ]);
}

async function instrumentAudioWorklet() {
    const helperPath = path.join(outputDirectory, "cmaj_api", "cmaj-audio-worklet-helper.js");
    const source = await fs.readFile(helperPath, "utf8");
    const original = `        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            return true;
        }`;
    const instrumented = `        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];
            const now = globalThis.performance?.now?.bind (globalThis.performance) || Date.now;
            const startedAt = now();

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            const elapsedMs = Math.max (0, now() - startedAt);
            const blockFrames = output?.[0]?.length || 128;
            const budgetMs = (blockFrames / sampleRate) * 1000;
            this.cosimoPerfBlockCount = (this.cosimoPerfBlockCount || 0) + 1;
            this.cosimoPerfLoadSum = (this.cosimoPerfLoadSum || 0) + (elapsedMs / budgetMs);
            this.cosimoPerfMaxLoad = Math.max (this.cosimoPerfMaxLoad || 0, elapsedMs / budgetMs);
            this.cosimoPerfOverBudgetBlocks = (this.cosimoPerfOverBudgetBlocks || 0) + (elapsedMs > budgetMs ? 1 : 0);
            if (this.cosimoPerfBlockCount >= 256)
            {
                this.port.postMessage ({
                    type: "cosimo-perf",
                    averageLoad: this.cosimoPerfLoadSum / this.cosimoPerfBlockCount,
                    maxLoad: this.cosimoPerfMaxLoad,
                    overBudgetBlocks: this.cosimoPerfOverBudgetBlocks,
                    blockCount: this.cosimoPerfBlockCount,
                });
                this.cosimoPerfBlockCount = 0;
                this.cosimoPerfLoadSum = 0;
                this.cosimoPerfMaxLoad = 0;
                this.cosimoPerfOverBudgetBlocks = 0;
            }

            return true;
        }`;
    if (!source.includes(original)) {
        throw new Error("Could not instrument the generated Cmajor AudioWorklet process block.");
    }
    await fs.writeFile(helperPath, source.replace(original, instrumented));
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

    await instrumentAudioWorklet();
    await copyWebHost();
    await fs.cp(path.join(repoRoot, "assets"), path.join(outputDirectory, "assets"), {
        recursive: true,
    });

    console.log(`Cosimo browser proof built at ${outputDirectory}`);
}

await buildWebProof();
