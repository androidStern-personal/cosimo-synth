import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDirectory, "..");
const studioRoot = path.join(repoRoot, "ui", "speedrun", "studio");
const webRoot = path.join(repoRoot, "build", "web");

const developmentAssetPrefixes = ["/assets/", "/cmaj_api/", "/patch_gui/", "/bounce/"];
const developmentAssetFiles = new Set([
    "/cmaj_Cosimo_Synth.offline.js",
    "/cmaj_Cosimo_Synth.js",
]);

function contentType(filePath) {
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".wasm")) return "application/wasm";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".woff2")) return "font/woff2";
    return "application/octet-stream";
}

function serveBuiltWebRuntime() {
    return {
        name: "cosimo-speedrun-built-web-runtime",
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                try {
                    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
                    if (!developmentAssetFiles.has(pathname)
                        && !developmentAssetPrefixes.some((prefix) => pathname.startsWith(prefix))) {
                        next();
                        return;
                    }
                    const filePath = path.resolve(webRoot, pathname.slice(1));
                    if (!filePath.startsWith(`${webRoot}${path.sep}`)) {
                        response.writeHead(403).end("Forbidden");
                        return;
                    }
                    const bytes = await fs.readFile(filePath);
                    response.writeHead(200, { "cache-control": "no-store", "content-type": contentType(filePath) });
                    response.end(bytes);
                } catch (error) {
                    if (error?.code === "ENOENT") next();
                    else response.writeHead(500).end(String(error));
                }
            });
        },
    };
}

export default defineConfig({
    root: studioRoot,
    base: "./",
    clearScreen: false,
    plugins: [react(), serveBuiltWebRuntime()],
    server: {
        host: "0.0.0.0",
        port: 5175,
        strictPort: true,
        allowedHosts: ["primary-mac.tail5ef964.ts.net"],
        fs: { allow: [repoRoot] },
    },
    build: {
        outDir: path.join(webRoot, "speedrun"),
        emptyOutDir: true,
        sourcemap: false,
        target: "es2022",
    },
});
