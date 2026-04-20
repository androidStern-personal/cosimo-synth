import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: configDir,
    base: "./",
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        port: 5180,
        strictPort: true,
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: "esnext",
        sourcemap: true,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
