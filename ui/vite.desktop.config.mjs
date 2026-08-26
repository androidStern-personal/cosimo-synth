import path from "node:path";

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

/**
 * T17B: test-harness servers are spawned per suite file and never use HMR,
 * so they skip file watching entirely — the dev default below polls the
 * whole repo every 120ms (Andrew's 88d0b198 pin so twin rebuilds always
 * surface), which costs ~4 CPU cores PER SERVER and was the dominant cost
 * of the browser gates. Harness servers also self-exit when their spawning
 * test process dies, because a SIGKILLed run cannot clean up its children
 * and orphaned pollers burned the machine for hours.
 */
const isTestHarnessServer = process.env.COSIMO_TEST_HARNESS === "1";

function harnessOrphanSuicide() {
    return {
        name: "cosimo-harness-orphan-suicide",
        configureServer() {
            if (!isTestHarnessServer) {
                return;
            }
            // The direct parent can be an npm/shell intermediate that
            // outlives a SIGKILLed test run — watch the TEST process itself.
            const spawnerPid = Number(process.env.COSIMO_HARNESS_SPAWNER_PID) || process.ppid;
            setInterval(() => {
                try {
                    process.kill(spawnerPid, 0);
                } catch {
                    process.exit(0);
                }
            }, 2000).unref();
        },
    };
}
const desktopPatchViewSource = path.join(repoRoot, "ui", "desktop", "patch-view-entry.tsx");
const reactRefreshPreamble = createReactRefreshPreamble();
const desktopDevServerStartedAt = new Date().toISOString();

export default defineConfig(({ command }) => ({
    appType: "custom",
    root: repoRoot,
    clearScreen: false,
    resolve: {
        preserveSymlinks: command === "build",
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
    },
    plugins: [
        harnessOrphanSuicide(),
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
        watch: isTestHarnessServer ? null : {
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
        minify: command === "build",
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
