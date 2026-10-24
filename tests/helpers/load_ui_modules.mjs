import { rmSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

/**
 * Bundles several TypeScript modules into one module graph and returns each
 * one's exports, in order. Modules they share load once, so module-level
 * state such as an event bus is the same instance for every caller, as it is
 * in the product.
 */
export async function loadUIModules(repoRoot, sourceRelativePaths) {
    const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-ui-modules-"));
    // Chunks stay importable for the whole test run; the directory goes with the process.
    process.once("exit", () => rmSync(outdir, { recursive: true, force: true }));
    await build({
        entryPoints: sourceRelativePaths.map((sourcePath) => path.join(repoRoot, sourcePath)),
        outbase: repoRoot,
        outdir,
        outExtension: { ".js": ".mjs" },
        bundle: true,
        splitting: true,
        format: "esm",
        platform: "node",
        target: "es2022",
        loader: { ".css": "text" },
        define: { "process.env.NODE_ENV": "\"test\"" },
        logLevel: "silent",
    });
    return Promise.all(sourceRelativePaths.map((sourcePath) => (
        import(pathToFileURL(path.join(outdir, sourcePath.replace(/\.[^./]+$/, ".mjs"))).href)
    )));
}
