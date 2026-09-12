import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exportKit } from "../../kit/scripts/export_kit.mjs";

const repo = path.resolve(import.meta.dirname, "../..");

// Use the actual committed export and its locked dependency installation. Keep
// it outside the monorepo so missing dependencies cannot resolve from ancestors.
export async function stageCustomerStateFixture(buildRoot, fixture, destination) {
    if (!path.resolve(buildRoot).startsWith(path.join(repo, "build") + path.sep))
        throw new Error("Customer fixture evidence must stay inside this checkout's build directory.");
    await mkdir(buildRoot, { recursive: true });
    const scratch = await mkdtemp(path.join(os.tmpdir(), "cosimo-customer-state-"));
    const staging = path.join(scratch, "fixture-customer");
    try {
        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
        await exportKit(staging, { sourceCommit });
        execFileSync("npm", ["ci", "--no-audit", "--no-fund"], {
            cwd: staging, stdio: "pipe", timeout: 180000,
        });
        // Adding the authored test plugin is the same operation a customer makes
        // after installation; exported framework/package files remain untouched.
        await cp(path.join(repo, "tests/native/fixtures", fixture), path.join(staging, "fx", destination), { recursive: true });
        return staging;
    } catch (error) {
        await rm(scratch, { recursive: true, force: true });
        throw error;
    }
}

export async function buildCustomerStateFixture(staging, plugin, manifestRelative) {
    execFileSync(process.execPath, ["kit/fx/build-effect.mjs", plugin], { cwd: staging, stdio: "pipe", timeout: 30000 });
    const manifestPath = path.join(staging, manifestRelative);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.worker !== "worker.js") throw new Error("stateSource did not generate the framework worker declaration.");
    return { manifestPath, worker: await readFile(path.join(path.dirname(manifestPath), manifest.worker)) };
}
