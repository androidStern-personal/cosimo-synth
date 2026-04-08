import path from "node:path";
import fs from "node:fs/promises";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import {
    createReactRefreshPreamble,
    createViteRepoContext,
    serveJsonValue,
    serveHtmlEntry,
    servePatchModuleAlias,
    serveStaticDirectory,
} from "./vite.shared.mjs";

const { repoRoot, cmajorApiRoot } = createViteRepoContext(import.meta.url);
const desktopPatchViewSource = path.join(repoRoot, "ui", "desktop", "patch-view-entry.tsx");
const desktopStandaloneLoaderSource = path.join(repoRoot, "ui", "desktop", "standalone-loader.js");
const desktopStandaloneLoaderOutput = path.join(repoRoot, "patch_gui", "desktop", "index.js");
const reactRefreshPreamble = createReactRefreshPreamble();
const desktopDevServerStartedAt = new Date().toISOString();

function emitDesktopStandaloneLoader() {
    return {
        name: "cosimo-emit-desktop-standalone-loader",
        apply: "build",
        async closeBundle() {
            const loaderSource = await fs.readFile(desktopStandaloneLoaderSource, "utf8");
            await fs.mkdir(path.dirname(desktopStandaloneLoaderOutput), { recursive: true });
            await fs.writeFile(desktopStandaloneLoaderOutput, loaderSource, "utf8");
        },
    };
}

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
            urlPath: "/",
            sourceFile: path.join(repoRoot, "ui", "desktop", "index.html"),
            headInjection: `<script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
        }),
        serveHtmlEntry({
            urlPath: "/ui/desktop/index.html",
            sourceFile: path.join(repoRoot, "ui", "desktop", "index.html"),
            headInjection: `<script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
        }),
        serveHtmlEntry({
            urlPath: "/tests/helpers/module_test_shell.html",
            sourceFile: path.join(repoRoot, "tests", "helpers", "module_test_shell.html"),
            headInjection: `<script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
        }),
        servePatchModuleAlias({
            urlPath: "/patch_gui/desktop/index.js",
            sourceFile: desktopPatchViewSource,
            repoRoot,
            moduleBindingName: "desktopPatchViewModule",
            createPatchViewExportName: "createDesktopPatchView",
            reactRefreshPreamble,
            includeViteClient: true,
        }),
        serveJsonValue({
            urlPath: "/__cosimo-dev-status",
            valueFactory: () => ({
                kind: "cosimo-desktop-vite",
                repoRoot,
                pid: process.pid,
                startedAt: desktopDevServerStartedAt,
                entry: "/patch_gui/desktop/index.js",
                sourceEntry: "/ui/desktop/patch-view-entry.tsx",
                usesViteClient: true,
                watchMode: "polling",
            }),
        }),
        emitDesktopStandaloneLoader(),
        serveStaticDirectory("/cmaj_api", cmajorApiRoot),
    ],
    server: {
        host: "0.0.0.0",
        port: 5174,
        strictPort: true,
        cors: true,
        fs: {
            allow: [repoRoot],
        },
        watch: {
            usePolling: true,
            interval: 120,
            awaitWriteFinish: {
                stabilityThreshold: 150,
                pollInterval: 50,
            },
        },
    },
    build: {
        outDir: path.join(repoRoot, "patch_gui", "desktop"),
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: desktopPatchViewSource,
            formats: ["es"],
            fileName: () => "app.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
}));
