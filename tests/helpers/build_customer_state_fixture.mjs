import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "../..");

// Only staging/build mechanics are shared. Each caller keeps its own fixture,
// configuration and assertions against the generated worker and actual DSP.
export async function stageCustomerStateFixture(buildRoot, fixture, destination, kitEntries = ["fx", "ui", "native", "cmajor"]) {
    if (!path.resolve(buildRoot).startsWith(path.join(repo, "build") + path.sep))
        throw new Error("Customer fixtures must stay inside this checkout's build directory.");
    await mkdir(buildRoot, { recursive: true });
    const staging = await mkdtemp(path.join(buildRoot, "fixture-"));
    await mkdir(path.join(staging, "kit"));
    await Promise.all([
        ...[...kitEntries, "index.ts", "package.json", "kit.json"].map(entry =>
            cp(path.join(repo, "kit", entry), path.join(staging, "kit", entry), { recursive: true })),
        cp(path.join(repo, "tests/native/fixtures", fixture), path.join(staging, "fx", destination), { recursive: true }),
        symlink(path.join(repo, "node_modules"), path.join(staging, "node_modules")),
        writeFile(path.join(staging, "package.json"), JSON.stringify({ private: true, type: "module" })),
    ]);
    return staging;
}

export async function buildCustomerStateFixture(staging, plugin, manifestRelative) {
    execFileSync(process.execPath, ["kit/fx/build-effect.mjs", plugin], { cwd: staging, stdio: "pipe", timeout: 30000 });
    const manifestPath = path.join(staging, manifestRelative);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.worker !== "worker.js") throw new Error("stateSource did not generate the framework worker declaration.");
    return { manifestPath, worker: await readFile(path.join(path.dirname(manifestPath), manifest.worker)) };
}
