import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { serveJsonValue } from "./vite.shared.mjs";
import { discoverEffectPlugins } from "./build-effect.mjs";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const fxRoot = path.join(repoRoot, "fx");
const sharedHarnessPath = path.join(configDir, "browser-preview.html");
const devServerStartedAt = new Date().toISOString();
const pluginDiscoveryTtlMs = 2000;

let cachedPluginDescriptions = null;
let cachedPluginDescriptionsAt = 0;

// Discovery reads every fx/*/ directory; a short TTL keeps status requests
// cheap while still picking up newly added plugins within a couple of seconds.
function describeEffectPlugins(now = Date.now()) {
    if (cachedPluginDescriptions === null || now - cachedPluginDescriptionsAt >= pluginDiscoveryTtlMs) {
        cachedPluginDescriptions = Object.entries(discoverEffectPlugins()).map(([name, plugin]) => ({
            name,
            patch: `/${plugin.patch}`,
            sourceModule: plugin.devModule,
        }));
        cachedPluginDescriptionsAt = now;
    }

    return cachedPluginDescriptions;
}

function isLoopbackRequest(request) {
    const remoteAddress = request.socket?.remoteAddress ?? "";

    return remoteAddress === "127.0.0.1"
        || remoteAddress === "::1"
        || remoteAddress === "::ffff:127.0.0.1";
}

function serveEffectDevStatus() {
    return serveJsonValue({
        urlPath: "/__fx-dev-status",
        valueFactory: ({ request }) => ({
            kind: "fx-vite-dev-server",
            startedAt: devServerStartedAt,
            plugins: describeEffectPlugins(),
            // The loader's probe needs only kind + plugins. The checkout path
            // and pid identify this server to same-machine tooling (worktree
            // disambiguation) and stay off the wire for other hosts, since the
            // dev server listens on all interfaces.
            ...(isLoopbackRequest(request) ? { repoRoot, pid: process.pid } : {}),
        }),
    });
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
                if (harnessPath === null || !harnessPath.startsWith(fxRoot + path.sep)) {
                    response.statusCode = 403;
                    response.end("Forbidden");
                    return;
                }

                try {
                    let source;
                    if (fs.existsSync(harnessPath)) {
                        if (!fs.realpathSync(harnessPath).startsWith(fs.realpathSync(fxRoot) + path.sep)) {
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
    define: {
        "process.env.NODE_ENV": JSON.stringify(command === "build" ? "production" : "development"),
    },
    plugins: [
        react(),
        serveEffectHarnessHtml(),
        serveEffectDevStatus(),
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
}));
