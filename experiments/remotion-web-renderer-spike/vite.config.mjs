import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const experimentRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(experimentRoot, "../..");

export default defineConfig({
    root: experimentRoot,
    plugins: [react()],
    build: {
        emptyOutDir: true,
        outDir: path.join(repoRoot, "build/experiments/remotion-web-renderer-spike"),
    },
});
