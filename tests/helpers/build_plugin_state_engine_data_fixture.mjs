import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { stageCustomerStateFixture, buildCustomerStateFixture } from "./build_customer_state_fixture.mjs";

const repo = path.resolve(import.meta.dirname, "../..");

/** Execute the actual customer builder in this probe's isolated staging tree. */
export async function buildPluginStateEngineDataFixture(variant = "small") {
    if (!["small", "bulk", "invalid"].includes(variant)) throw new Error("Unknown engine-data fixture variant.");
    const wordCapacity = variant === "bulk" ? 12289 : 257;
    const chunkCapacity = variant === "invalid" ? 9000 : variant === "bulk" ? 6144 : 32;
    const buildRoot = path.join(repo, variant === "bulk" ? "build/native_plugin_state_engine_data_bulk"
        : variant === "invalid" ? "build/native_plugin_state_engine_data/invalid" : "build/native_plugin_state_engine_data");
    const staging = await stageCustomerStateFixture(buildRoot, "plugin_state_engine_data", "engine_data_state");
    const fixtureRoot = path.join(staging, "fx/engine_data_state");
    // Values are configuration, never string replacements of authored code.
    await writeFile(path.join(fixtureRoot, "fixture-config.ts"),
        `export const wordCapacity = ${wordCapacity};\nexport const chunkCapacity = ${chunkCapacity};\n`);
    const dspChunkCapacity = variant === "invalid" ? 32 : chunkCapacity;
    await writeFile(path.join(fixtureRoot, "fixture-config.cmajor"),
        `namespace Fixture { let wordCapacity = ${wordCapacity}; let chunkCapacity = ${dspChunkCapacity}; }\n`);
    if (variant === "invalid") {
        // Keep the native import-failure oracle: the automatic declaration path
        // now rejects this configuration during resource generation instead.
        await writeFile(path.join(fixtureRoot, "EngineDataState.plugin.json"), JSON.stringify({
            schemaVersion: 1, workerSource: "fx/engine_data_state/invalid-worker.ts",
        }));
    }
    const { manifestPath, worker } = await buildCustomerStateFixture(staging, "engine-data-state",
        "build/fx/engine_data_state_runtime/EngineDataState.cmajorpatch");
    const identity = { staging, manifestPath, wordCapacity, chunkCapacity, workerSha256: createHash("sha256").update(worker).digest("hex") };
    await writeFile(path.join(buildRoot, "fixture-build.json"), JSON.stringify(identity, null, 2));
    return { buildRoot, manifestPath, identity };
}
