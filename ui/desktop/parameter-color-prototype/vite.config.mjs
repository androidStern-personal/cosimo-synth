import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const prototypeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(prototypeRoot, "../../..");

export default defineConfig({
    root: prototypeRoot,
    appType: "spa",
    clearScreen: false,
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        allowedHosts: ["primary-mac.tail5ef964.ts.net"],
        port: 5192,
        strictPort: true,
        fs: {
            allow: [repoRoot],
        },
    },
});
