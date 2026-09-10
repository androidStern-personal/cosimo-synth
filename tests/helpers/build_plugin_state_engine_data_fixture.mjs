import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "../..");

/** Execute the actual customer builder in this probe's isolated staging tree. */
export async function buildPluginStateEngineDataFixture(variant = "small") {
    if (!["small", "bulk", "invalid"].includes(variant)) throw new Error("Unknown engine-data fixture variant.");
    const wordCapacity = variant === "bulk" ? 12289 : 257;
    const chunkCapacity = variant === "invalid" ? 9000 : variant === "bulk" ? 6144 : 32;
    const buildRoot = path.join(repo, variant === "bulk" ? "build/native_plugin_state_engine_data_bulk"
        : variant === "invalid" ? "build/native_plugin_state_engine_data/invalid" : "build/native_plugin_state_engine_data");
    await mkdir(buildRoot, { recursive: true });
    const staging = await mkdtemp(path.join(buildRoot, "fixture-"));
    await mkdir(path.join(staging, "kit"));
    await Promise.all([
        ...["fx", "ui", "cmajor", "index.ts", "package.json", "kit.json"].map(entry =>
            cp(path.join(repo, "kit", entry), path.join(staging, "kit", entry), { recursive: true })),
        cp(path.join(repo, "tests/native/fixtures/plugin_state_engine_data"), path.join(staging, "fx/engine_data_state"), { recursive: true }),
        symlink(path.join(repo, "node_modules"), path.join(staging, "node_modules")),
        writeFile(path.join(staging, "package.json"), JSON.stringify({ name: "engine-data-state-fixture", type: "module", private: true })),
    ]);
    if (variant === "bulk") {
        const fixtureRoot = path.join(staging, "fx/engine_data_state");
        const statePath = path.join(fixtureRoot, "state.ts");
        const dspPath = path.join(fixtureRoot, "EngineDataState.cmajor");
        const state = await readFile(statePath, "utf8");
        const dsp = await readFile(dspPath, "utf8");
        if (!state.includes("length: 257") || !state.includes("wordCapacity: 257, chunkCapacity: 32")
            || !dsp.includes("kit::engine_data (257, 3, 2, 32)") || !dsp.includes("kit::engine_data_budget (32, 64)"))
            throw new Error("The bulk variant no longer matches its authored fixture configuration.");
        await writeFile(statePath, state.replace("length: 257", `length: ${wordCapacity}`)
            .replace("wordCapacity: 257, chunkCapacity: 32", `wordCapacity: ${wordCapacity}, chunkCapacity: ${chunkCapacity}`));
        await writeFile(dspPath, dsp.replace("kit::engine_data (257, 3, 2, 32)", `kit::engine_data (${wordCapacity}, 3, 2, ${chunkCapacity})`)
            .replace("kit::engine_data_budget (32, 64)", `kit::engine_data_budget (${chunkCapacity}, 64)`));
    }
    if (variant === "invalid") {
        const statePath = path.join(staging, "fx/engine_data_state/state.ts");
        const state = await readFile(statePath, "utf8");
        if (!state.includes("wordCapacity: 257, chunkCapacity: 32")) throw new Error("Invalid configuration fixture no longer matches its declaration.");
        await writeFile(statePath, state.replace("wordCapacity: 257, chunkCapacity: 32", "wordCapacity: 257, chunkCapacity: 9000"));
    }
    const built = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "engine-data-state"], { cwd: staging, encoding: "utf8", timeout: 30000 });
    if (built.status !== 0) throw new Error(`Generated worker build failed:\n${built.stdout}\n${built.stderr}`);
    const runtimeRoot = path.join(staging, "build/fx/engine_data_state_runtime");
    const manifestPath = path.join(runtimeRoot, "EngineDataState.cmajorpatch");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.worker !== "worker.js") throw new Error("Declaration-only fixture did not generate its worker.");
    const worker = await readFile(path.join(runtimeRoot, manifest.worker));
    const identity = { staging, manifestPath, wordCapacity, chunkCapacity, workerSha256: createHash("sha256").update(worker).digest("hex") };
    await writeFile(path.join(buildRoot, "fixture-build.json"), JSON.stringify(identity, null, 2));
    return { buildRoot, manifestPath, identity };
}
