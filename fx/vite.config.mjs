import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..");
const fxRoot = path.join(repoRoot, "fx");
const devServerStartedAt = new Date().toISOString();

function discoverEffectPlugins() {
    if (!fs.existsSync(fxRoot)) {
        return [];
    }

    return fs.readdirSync(fxRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const pluginRoot = path.join(fxRoot, entry.name);
            const patchFile = fs.readdirSync(pluginRoot)
                .find(fileName => fileName.endsWith(".cmajorpatch"));

            if (!patchFile) {
                return undefined;
            }

            const patchPath = path.join(pluginRoot, patchFile);
            let manifest = {};

            try {
                manifest = JSON.parse(fs.readFileSync(patchPath, "utf8"));
            } catch {
                manifest = {};
            }

            return {
                name: entry.name,
                patch: `/fx/${entry.name}/${patchFile}`,
                sourceModule: manifest.view?.devModule,
            };
        })
        .filter(Boolean);
}

function serveEffectDevStatus() {
    return {
        name: "fx-dev-status",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== "/__fx-dev-status") {
                    next();
                    return;
                }

                response.statusCode = 200;
                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Content-Type", "application/json; charset=utf-8");
                response.end(JSON.stringify({
                    kind: "fx-vite-dev-server",
                    repoRoot,
                    pid: process.pid,
                    startedAt: devServerStartedAt,
                    plugins: discoverEffectPlugins(),
                }));
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

                const harnessPath = path.join(repoRoot, requestPath.slice(1));

                if (!fs.existsSync(harnessPath)) {
                    next();
                    return;
                }

                try {
                    const source = fs.readFileSync(harnessPath, "utf8");
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
