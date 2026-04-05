import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import {
    createReactRefreshPreamble,
    createViteRepoContext,
    serveHtmlEntry,
    servePatchModuleAlias,
    serveStaticDirectory,
} from "../ui/vite.shared.mjs";

const { repoRoot, cmajorApiRoot } = createViteRepoContext(import.meta.url);
const iosPatchViewSource = path.join(repoRoot, "ui", "ios", "patch-view-entry.tsx");
const reactRefreshPreamble = createReactRefreshPreamble();

export default defineConfig(({ command }) => ({
    appType: "custom",
    root: repoRoot,
    clearScreen: false,
    define: {
        "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
    },
    plugins: [
        react(),
        tailwindcss(),
        serveHtmlEntry({
            urlPath: "/patch_gui/index.ios.html",
            sourceFile: path.join(repoRoot, "patch_gui", "index.ios.html"),
            headInjection: '<script type="module" src="/@vite/client"></script>',
        }),
        servePatchModuleAlias({
            urlPath: "/patch_gui/index.ios.js",
            sourceFile: iosPatchViewSource,
            repoRoot,
            moduleBindingName: "iosPatchViewModule",
            createPatchViewExportName: "createIOSPatchView",
            reactRefreshPreamble,
        }),
        serveStaticDirectory("/patch_gui", path.join(repoRoot, "patch_gui")),
        serveStaticDirectory("/cmaj_api", cmajorApiRoot),
    ],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        cors: true,
        fs: {
            allow: [repoRoot],
        },
    },
    build: {
        outDir: path.join(repoRoot, "patch_gui"),
        emptyOutDir: false,
        sourcemap: true,
        minify: false,
        lib: {
            entry: iosPatchViewSource,
            formats: ["es"],
            fileName: () => "index.ios.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
}));
