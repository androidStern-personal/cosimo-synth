import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { discoverEffectPlugins } from "./build-effect.mjs";
import { isInsideDirectory } from "../scripts/common.mjs";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const fxRoot = path.join(repoRoot, "fx");
const sharedHarnessPath = path.join(repoRoot, "kit/ui/preview/index.html");
const devServerStartedAt = new Date().toISOString();
const pluginDiscoveryTtlMs = 2000;

let cachedPluginDescriptions = null;
let cachedPluginDescriptionsAt = 0;
const reportedFailures = new Set();

// Discovery reads every fx/*/ directory; a short TTL keeps status requests
// cheap while still picking up newly added plugins within a couple of seconds.
// A plugin folder that fails to load is reported once and left out, so the
// other plugins keep working while it is being edited.
function describeEffectPlugins(now = Date.now()) {
    if (cachedPluginDescriptions === null || now - cachedPluginDescriptionsAt >= pluginDiscoveryTtlMs) {
        const plugins = discoverEffectPlugins({
            onPluginError: (_directory, error) => {
                if (!reportedFailures.has(error.message)) {
                    reportedFailures.add(error.message);
                    console.error(error.message);
                }
            },
        });

        cachedPluginDescriptions = Object.entries(plugins).map(([name, plugin]) => ({
            name,
            patch: `/${plugin.patch}`,
            sourceModule: plugin.devModule,
        }));
        cachedPluginDescriptionsAt = now;
    }

    return cachedPluginDescriptions;
}

function serveEffectDevStatus() {
    return {
        name: "fx-dev-status",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if ((request.url ?? "").split("?")[0] !== "/__fx-dev-status") {
                    next();
                    return;
                }

                try {
                    const status = {
                        kind: "fx-vite-dev-server",
                        startedAt: devServerStartedAt,
                        plugins: describeEffectPlugins(),
                        // The loader's probe needs only kind + plugins. The checkout path
                        // and pid let tooling tell which worktree owns the shared port.
                        repoRoot,
                        pid: process.pid,
                    };

                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", "application/json; charset=utf-8");
                    response.end(JSON.stringify(status));
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

function serveEffectHarnessHtml() {
    return {
        name: "fx-effect-harness-html",
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (!/^\/fx\/[^/]+\/view\/harness\.html$/.test(requestPath)) {
                    next();
                    return;
                }

                let harnessPath;

                try {
                    harnessPath = path.resolve(repoRoot, decodeURIComponent(requestPath).slice(1));
                } catch {
                    harnessPath = null;
                }

                // The URL shape promises a file under fx/, so contain the
                // decoded path there too (an encoded ../ segment decodes after
                // the shape check above).
                if (harnessPath === null || !isInsideDirectory(fxRoot, harnessPath)) {
                    response.statusCode = 403;
                    response.end("Forbidden");
                    return;
                }

                try {
                    let source;
                    if (fs.existsSync(harnessPath)) {
                        if (!isInsideDirectory(fs.realpathSync(fxRoot), fs.realpathSync(harnessPath))) {
                            response.statusCode = 403;
                            response.end("Forbidden");
                            return;
                        }
                        source = fs.readFileSync(harnessPath, "utf8");
                    } else {
                        const pluginDirectory = path.dirname(path.dirname(harnessPath));
                        const plugins = describeEffectPlugins().filter((plugin) => (
                            path.dirname(path.resolve(repoRoot, plugin.patch.slice(1))) === pluginDirectory
                        ));
                        if (plugins.length === 0) {
                            next();
                            return;
                        }
                        if (plugins.length !== 1) {
                            response.statusCode = 409;
                            response.end("This folder has multiple patches. Provide a custom view/harness.html to choose one.");
                            return;
                        }
                        source = fs.readFileSync(sharedHarnessPath, "utf8").replace(
                            "__FX_PREVIEW_PATCH__",
                            () => JSON.stringify(plugins[0].patch).replaceAll("<", "\\u003c"),
                        );
                    }
                    const html = await server.transformIndexHtml(request.url ?? requestPath, source);

                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", "text/html; charset=utf-8");
                    response.end(html);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    appType: "custom",
    root: repoRoot,
    clearScreen: false,
    // Views are discovered through a dynamic manifest import. Prebundle their
    // shared React runtime before the first view loads to avoid optimizer reloads.
    optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "jotai", "jotai/utils"] },
    resolve: { dedupe: ["react", "react-dom"] },
    define: {
        "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
    },
    plugins: [
        react(),
        serveEffectHarnessHtml(),
        serveEffectDevStatus(),
    ],
    server: {
        host: "127.0.0.1",
        port: 5175,
        strictPort: true,
        cors: true,
        fs: {
            allow: [repoRoot],
            // Vite's defaults plus kit/feed.json, whose URL is a private
            // capability that no plugin UI needs to read.
            deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/kit/feed.json"],
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
}));
