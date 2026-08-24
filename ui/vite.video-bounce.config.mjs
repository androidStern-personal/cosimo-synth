import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");
const entry = path.join(repoRoot, "ui", "speedrun", "integrated-entry.ts");

export default defineConfig(({ command }) => ({
    root: repoRoot,
    clearScreen: false,
    plugins: [react()],
    define: {
        "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
    },
    build: {
        outDir: path.join(repoRoot, "build", "web", "video-bounce"),
        emptyOutDir: true,
        sourcemap: false,
        minify: command === "build",
        target: "es2022",
        cssCodeSplit: false,
        lib: {
            entry,
            formats: ["es"],
            fileName: () => "index.js",
        },
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css") ? "style.css" : "[name][extname]",
                inlineDynamicImports: true,
            },
        },
    },
}));
