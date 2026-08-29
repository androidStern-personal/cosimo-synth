import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stageCmajorWebRuntime } from "../../ui/vite.shared.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CONTENT_TYPES = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".map", "application/json; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".woff2", "font/woff2"],
    [".svg", "image/svg+xml"],
    [".wav", "audio/wav"],
    [".png", "image/png"],
]);

async function findCmajorApiRoot() {
    return stageCmajorWebRuntime(repoRoot, {
        buildDirectory: path.join(repoRoot, "build", "cmajor_web_runtime-live-review"),
        outputDirectory: path.join(repoRoot, "build", "cmajor_web_runtime-live-review", "cmaj_api"),
    });
}

/**
 * Static server for live-performance pages in environments without a full
 * web build: build/web first, repo root as a fallback (factory catalogs and
 * wavetable sources live in assets/), and /cmaj_api/ mapped to the Cmajor
 * runtime under build/deps.
 */
export async function startLiveReviewServer() {
    const cmajorApiRoot = await findCmajorApiRoot();
    const roots = [path.join(repoRoot, "build", "web"), repoRoot];
    const server = createServer((request, response) => {
        void (async () => {
            try {
                const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
                const relative = pathname.replace(/^\/+/u, "") || "index.html";
                const candidates = relative.startsWith("cmaj_api/")
                    ? [path.join(cmajorApiRoot, relative.slice("cmaj_api/".length))]
                    : roots.map((root) => path.resolve(root, relative));
                for (const candidate of candidates) {
                    if (!candidate.startsWith(repoRoot) && !candidate.startsWith(cmajorApiRoot)) continue;
                    try {
                        const bytes = await fs.readFile(candidate);
                        response.writeHead(200, {
                            "cache-control": "no-store",
                            "content-type": CONTENT_TYPES.get(path.extname(candidate)) ?? "application/octet-stream",
                        });
                        response.end(bytes);
                        return;
                    } catch {
                        // try the next root
                    }
                }
                response.writeHead(404).end("Not found");
            } catch (error) {
                response.writeHead(500).end(String(error));
            }
        })();
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    return {
        baseUrl: `http://127.0.0.1:${server.address().port}/`,
        stop: () => new Promise((resolve) => server.close(resolve)),
    };
}
