import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const prototypeRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: prototypeRoot,
    appType: "spa",
    clearScreen: false,
    server: {
        host: "0.0.0.0",
        allowedHosts: ["primary-mac.tail5ef964.ts.net"],
        port: 5191,
        strictPort: true,
    },
});
