import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hosting = JSON.parse(await readFile(new URL("./vercel.json", import.meta.url), "utf8"));
const headers = Object.fromEntries(hosting.headers.find(rule => rule.source === "/(.*)").headers
    .map(({ key, value }) => [key, value]));
const contentTypes = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".css": "text/css", ".wasm": "application/wasm", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".ttf": "font/ttf", ".wav": "audio/wav",
};

/** Local use and browser qualification serve the same files and isolation
 * headers as the deployed static site. The caller owns listen/close. */
export function createWebServer(directory) {
    const root = path.resolve(directory);
    return createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://localhost");
            const name = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
            const file = path.resolve(root, name);
            if (!file.startsWith(`${root}${path.sep}`)) {
                response.writeHead(403, headers).end("Forbidden");
                return;
            }
            const contents = await readFile(file);
            response.writeHead(200, { ...headers, "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream" });
            response.end(contents);
        } catch (error) {
            const status = error?.code === "ENOENT" ? 404 : error instanceof URIError ? 400 : 500;
            response.writeHead(status, { ...headers, "content-type": "text/plain" }).end(status === 404 ? "Not found" : "Cannot serve request");
        }
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const directory = fileURLToPath(new URL("../build/web", import.meta.url));
    createWebServer(directory).listen(8123, "127.0.0.1", () => console.log("http://127.0.0.1:8123"));
}
