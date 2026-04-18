import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
    appType: "mpa",
    root: repoRoot,
    clearScreen: false,
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        port: 5184,
        strictPort: true,
        fs: {
            allow: [repoRoot],
        },
    },
});
