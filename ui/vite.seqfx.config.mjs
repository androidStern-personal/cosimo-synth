import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import {
    createReactRefreshPreamble,
    createViteRepoContext,
    serveHtmlEntry,
    serveJsonValue,
    servePatchModuleAlias,
    serveStaticDirectory,
} from "./vite.shared.mjs";

const { repoRoot, cmajorApiRoot } = createViteRepoContext(import.meta.url);
const seqFxPatchViewSource = path.join(repoRoot, "ui", "seqfx", "patch-view-entry.tsx");
const reactRefreshPreamble = createReactRefreshPreamble();
const seqFxDevServerStartedAt = new Date().toISOString();

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
            sourceFile: path.join(repoRoot, "ui", "seqfx", "index.html"),
            headInjection: `<script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
        }),
        serveHtmlEntry({
            urlPath: "/ui/seqfx/index.html",
            sourceFile: path.join(repoRoot, "ui", "seqfx", "index.html"),
            headInjection: `<script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
        }),
        servePatchModuleAlias({
            urlPath: "/fx/seqfx/view/index.js",
            sourceFile: seqFxPatchViewSource,
            repoRoot,
            moduleBindingName: "seqFxPatchViewModule",
            createPatchViewExportName: "createSeqFxPatchView",
            reactRefreshPreamble,
            includeViteClient: true,
        }),
        serveJsonValue({
            urlPath: "/__seqfx-dev-status",
            valueFactory: () => ({
                kind: "cosimo-seqfx-vite",
                repoRoot,
                pid: process.pid,
                startedAt: seqFxDevServerStartedAt,
                entry: "/fx/seqfx/view/index.js",
                sourceEntry: "/ui/seqfx/patch-view-entry.tsx",
                usesViteClient: true,
            }),
        }),
        serveStaticDirectory("/cmaj_api", cmajorApiRoot),
    ],
    server: {
        host: "0.0.0.0",
        port: 5175,
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
        outDir: path.join(repoRoot, "fx", "seqfx", "view"),
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: seqFxPatchViewSource,
            formats: ["es"],
            fileName: () => "index.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
}));
