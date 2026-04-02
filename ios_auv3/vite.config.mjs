import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");
const cmajorRuntimeRoot = resolveCmajorRuntimeRoot(repoRoot);
const cmajorWebRoot = path.join(cmajorRuntimeRoot, "javascript");
const cmajorApiRoot = path.join(cmajorWebRoot, "cmaj_api");

function resolveCmajorRuntimeRoot(workspaceRoot) {
    if (process.env.COSIMO_CMAJOR_RUNTIME_DIR) {
        return path.resolve(process.env.COSIMO_CMAJOR_RUNTIME_DIR);
    }

    const runtimeScript = path.join(workspaceRoot, "scripts", "ensure_cmajor_runtime.py");

    return execFileSync("python3", [runtimeScript, "--path"], {
        cwd: workspaceRoot,
        encoding: "utf8",
    }).trim();
}

function contentTypeFor(filePath) {
    switch (path.extname(filePath)) {
        case ".js":
        case ".mjs":
            return "text/javascript";
        case ".json":
            return "application/json";
        case ".svg":
            return "image/svg+xml";
        case ".html":
            return "text/html";
        default:
            return "application/octet-stream";
    }
}

function serveStaticDirectory(urlPrefix, sourceRoot) {
    const normalizedSourceRoot = path.resolve(sourceRoot);

    return {
        name: `cosimo-static-${urlPrefix.replaceAll("/", "-")}`,
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== urlPrefix && !requestPath.startsWith(`${urlPrefix}/`)) {
                    next();
                    return;
                }

                const relativePath = decodeURIComponent(requestPath.slice(urlPrefix.length)).replace(/^\/+/, "");
                const candidatePath = path.resolve(normalizedSourceRoot, relativePath);

                if (candidatePath !== normalizedSourceRoot && !candidatePath.startsWith(`${normalizedSourceRoot}${path.sep}`)) {
                    response.statusCode = 403;
                    response.end("Forbidden");
                    return;
                }

                try {
                    const stats = await fs.stat(candidatePath);

                    if (stats.isDirectory()) {
                        next();
                        return;
                    }

                    const file = await fs.readFile(candidatePath);
                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", contentTypeFor(candidatePath));
                    response.end(file);
                } catch {
                    next();
                }
            });
        },
    };
}

function servePatchHtmlEntry(urlPath, sourceFile) {
    const normalizedSourceFile = path.resolve(sourceFile);

    return {
        name: `cosimo-html-entry-${urlPath.replaceAll("/", "-")}`,
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== urlPath) {
                    next();
                    return;
                }

                try {
                    const html = await fs.readFile(normalizedSourceFile, "utf8");
                    const transformed = html.replace(
                        "<head>",
                        '<head>\n  <script type="module" src="/@vite/client"></script>',
                    );
                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", "text/html; charset=utf-8");
                    response.end(transformed);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

export default defineConfig({
    appType: "custom",
    root: repoRoot,
    clearScreen: false,
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        cors: true,
        fs: {
            allow: [repoRoot],
        },
    },
    plugins: [
        servePatchHtmlEntry("/patch_gui/index.ios.html", path.join(repoRoot, "patch_gui", "index.ios.html")),
        serveStaticDirectory("/cmaj_api", cmajorApiRoot),
    ],
});
