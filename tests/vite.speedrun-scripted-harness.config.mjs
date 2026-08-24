import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDirectory, "..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "speedrun");

export default defineConfig({
    root: fixtureRoot,
    base: "./",
    clearScreen: false,
    plugins: [react(), tailwindcss()],
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
        outDir: path.join(repoRoot, "build", "web", "scripted-test"),
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: path.join(fixtureRoot, "scripted-browser-harness.html"),
        },
    },
});
