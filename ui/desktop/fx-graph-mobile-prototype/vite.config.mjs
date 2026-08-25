import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const prototypeRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: prototypeRoot,
    base: "/fx-graph-prototype/",
    cacheDir: path.join(os.tmpdir(), "cosimo-mobile-fx-graph-vite-cache"),
    appType: "spa",
    clearScreen: false,
    server: {
        host: "0.0.0.0",
        allowedHosts: ["primary-mac.tail5ef964.ts.net"],
        port: 5194,
        strictPort: true,
    },
});
