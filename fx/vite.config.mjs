import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
            const sourceModule = path.join(pluginRoot, "view", "source.js");

            if (!patchFile) {
                return undefined;
            }

            return {
                name: entry.name,
                patch: `/fx/${entry.name}/${patchFile}`,
                sourceModule: fs.existsSync(sourceModule)
                    ? `/fx/${entry.name}/view/source.js`
                    : undefined,
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

export default defineConfig({
    appType: "custom",
    root: repoRoot,
    clearScreen: false,
    plugins: [
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
});
