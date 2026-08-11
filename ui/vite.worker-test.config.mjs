import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");

export default defineConfig(({ command }) => ({
    root: repoRoot,
    clearScreen: false,
    build: {
        outDir: path.join(repoRoot, "patch_gui"),
        emptyOutDir: false,
        sourcemap: false,
        minify: command === "build",
        lib: {
            entry: path.join(repoRoot, "ui", "worker", "wavetable-test-worker.ts"),
            formats: ["es"],
            fileName: () => "wavetable-test-worker.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
}));
