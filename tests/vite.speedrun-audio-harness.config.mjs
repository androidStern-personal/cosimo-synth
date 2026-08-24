import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDirectory, "..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "speedrun");

export default defineConfig({
    root: fixtureRoot,
    base: "./",
    clearScreen: false,
    build: {
        outDir: path.join(repoRoot, "build", "speedrun-audio-test"),
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: path.join(fixtureRoot, "audio-browser-harness.html"),
        },
    },
});
