import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDirectory, "..");
const cmajorWebRoot = path.join(repoRoot, "ios_auv3", "Vendor", "cmajor", "web");
const cmajorApiRoot = path.join(cmajorWebRoot, "cmaj_api");
const desktopPatchViewSource = path.join(repoRoot, "ui", "desktop", "patch-view-entry.tsx");
const reactRefreshPreamble = [
    'import RefreshRuntime from "/@react-refresh";',
    "RefreshRuntime.injectIntoGlobalHook(window);",
    "window.$RefreshReg$ = () => {};",
    "window.$RefreshSig$ = () => (type) => type;",
    "window.__vite_plugin_react_preamble_installed__ = true;",
].join("\n");

function contentTypeFor(filePath) {
    switch (path.extname(filePath)) {
        case ".js":
        case ".mjs":
        case ".ts":
        case ".tsx":
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

function servePatchModuleAlias(urlPath, sourceFile) {
    const relativeImportPath = `/${path.relative(repoRoot, sourceFile).split(path.sep).join("/")}`;

    return {
        name: `cosimo-module-alias-${urlPath.replaceAll("/", "-")}`,
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== urlPath) {
                    next();
                    return;
                }

                response.statusCode = 200;
                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Content-Type", "text/javascript; charset=utf-8");
                response.end(
                    `${reactRefreshPreamble}\n` +
                    `const desktopPatchViewModule = await import(${JSON.stringify(relativeImportPath)});\n` +
                    `export const createDesktopPatchView = desktopPatchViewModule.createDesktopPatchView;\n` +
                    `export default desktopPatchViewModule.default;\n`,
                );
            });
        },
    };
}

function serveHtmlEntry(urlPath, sourceFile) {
    const normalizedSourceFile = path.resolve(sourceFile);

    return {
        name: `cosimo-html-entry-${urlPath.replaceAll("/", "-") || "root"}`,
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
                        `<head>
  <script type="module" src="/@vite/client"></script>
  <script type="module">
${reactRefreshPreamble}
  </script>`,
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
    plugins: [
        react(),
        tailwindcss(),
        serveHtmlEntry("/", path.join(repoRoot, "ui", "desktop", "index.html")),
        serveHtmlEntry("/ui/desktop/index.html", path.join(repoRoot, "ui", "desktop", "index.html")),
        servePatchModuleAlias("/patch_gui/desktop/index.js", desktopPatchViewSource),
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
    },
    build: {
        outDir: path.join(repoRoot, "patch_gui", "desktop"),
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: desktopPatchViewSource,
            formats: ["es"],
            fileName: () => "index.js",
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
