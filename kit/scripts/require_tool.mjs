import path from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { inspectTool, readToolchain, toolchainPath, toolKeys } from "./toolchain.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function requireCurrentTool(key, { root = defaultRoot } = {}) {
    if (!toolKeys.includes(key)) throw new Error("Unknown Builder Kit tool.");
    const toolchain = readToolchain(toolchainPath(root));
    const inspection = await inspectTool(toolchain, key, { root });
    if (inspection.status !== "current") {
        throw new Error(`${key} is not the pinned setup artifact; run npm run kit:setup first.`);
    }
    return inspection.localPath;
}

const invokedDirectly = process.argv[1]
    && existsSync(process.argv[1])
    && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        const key = process.argv[2];
        const root = process.argv[3] ? path.resolve(process.argv[3]) : defaultRoot;
        console.log(await requireCurrentTool(key, { root }));
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Builder Kit tool verification failed.");
        process.exitCode = 1;
    }
}
