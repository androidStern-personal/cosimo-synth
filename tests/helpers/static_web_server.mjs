import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const CONTENT_TYPES = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".woff2", "font/woff2"],
    [".svg", "image/svg+xml"],
    [".wav", "audio/wav"],
    [".png", "image/png"],
]);

function contentType(filePath) {
    return CONTENT_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
}

/** One static server over a prebuilt directory, shared by the browser suites. */
export async function startStaticWebServer(webRoot) {
    let baseUrl = "";
    const server = createServer((request, response) => {
        void (async () => {
            try {
                const requestUrl = new URL(request.url ?? "/", baseUrl);
                let relative = decodeURIComponent(requestUrl.pathname.slice(1));
                if (relative.length === 0 || relative.endsWith("/")) relative += "index.html";
                const filePath = path.resolve(webRoot, relative);
                if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
                    response.writeHead(403).end("Forbidden");
                    return;
                }
                const bytes = await fs.readFile(filePath);
                response.writeHead(200, {
                    "cache-control": "no-store",
                    "content-type": contentType(filePath),
                });
                response.end(bytes);
            } catch (error) {
                response.writeHead(error?.code === "ENOENT" ? 404 : 500).end(String(error));
            }
        })();
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
    return {
        baseUrl,
        stop: () => new Promise((resolve) => server.close(resolve)),
    };
}
