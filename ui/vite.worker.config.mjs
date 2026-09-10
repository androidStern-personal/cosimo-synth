import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");
const workerSource = path.join(repoRoot, "ui", "worker", "wavetable-worker.ts");

export default defineConfig(({ command }) => ({
    root: repoRoot,
    clearScreen: false,
    // Vite's library mode preserves dependency NODE_ENV branches. This worker
    // also runs in native QuickJS, where the Node process global does not exist.
    define: { "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development") },
    build: {
        outDir: path.join(repoRoot, "patch_gui"),
        emptyOutDir: false,
        sourcemap: false,
        minify: command === "build",
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
}));
