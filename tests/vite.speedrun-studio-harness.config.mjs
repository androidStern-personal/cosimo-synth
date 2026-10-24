import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDirectory, "..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "speedrun");

export default defineConfig({
    root: fixtureRoot,
    base: "./",
    clearScreen: false,
    plugins: [react()],
    build: {
        outDir: path.join(repoRoot, "build", "web", "speedrun-studio-test"),
        emptyOutDir: true,
        sourcemap: true,
        target: "es2022",
        rollupOptions: {
            input: path.join(fixtureRoot, "studio-browser-harness.html"),
        },
    },
});
