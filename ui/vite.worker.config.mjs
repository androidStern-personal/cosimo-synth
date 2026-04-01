import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");
const workerSource = path.join(repoRoot, "ui", "worker", "wavetable-worker.ts");

export default defineConfig({
    root: repoRoot,
    clearScreen: false,
    build: {
        outDir: path.join(repoRoot, "patch_gui"),
        emptyOutDir: false,
        sourcemap: false,
        minify: false,
        lib: {
            entry: workerSource,
            formats: ["es"],
            fileName: () => "wavetable-worker.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
