import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function resolveCmajorRuntimeRoot(workspaceRoot) {
    if (process.env.COSIMO_CMAJOR_RUNTIME_DIR) {
        return path.resolve(process.env.COSIMO_CMAJOR_RUNTIME_DIR);
    }

    const runtimeScript = path.join(workspaceRoot, "scripts", "ensure_cmajor_runtime.py");

    return execFileSync("python3", [runtimeScript, "--path"], {
        cwd: workspaceRoot,
        encoding: "utf8",
    }).trim();
}

export function createViteRepoContext(importMetaUrl) {
    const configDirectory = path.dirname(fileURLToPath(importMetaUrl));
    const repoRoot = path.resolve(configDirectory, "..");
    const cmajorRuntimeRoot = resolveCmajorRuntimeRoot(repoRoot);
    const cmajorWebRoot = path.join(cmajorRuntimeRoot, "javascript");
    const cmajorApiRoot = path.join(cmajorWebRoot, "cmaj_api");

    return {
        configDirectory,
        repoRoot,
        cmajorRuntimeRoot,
        cmajorWebRoot,
        cmajorApiRoot,
    };
}

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

export function createReactRefreshPreamble() {
    return [
        'import RefreshRuntime from "/@react-refresh";',
        "RefreshRuntime.injectIntoGlobalHook(window);",
        "window.$RefreshReg$ = () => {};",
        "window.$RefreshSig$ = () => (type) => type;",
        "window.__vite_plugin_react_preamble_installed__ = true;",
    ].join("\n");
}

export function serveStaticDirectory(urlPrefix, sourceRoot) {
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

export function serveStaticFile({ urlPath, sourceFile, contentType = null }) {
    const normalizedSourceFile = path.resolve(sourceFile);

    return {
        name: `cosimo-static-file-${urlPath.replaceAll("/", "-") || "root"}`,
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== urlPath) {
                    next();
                    return;
                }

                try {
                    const file = await fs.readFile(normalizedSourceFile);
                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", contentType ?? contentTypeFor(normalizedSourceFile));
                    response.end(file);
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

export function serveJsonValue({ urlPath, valueFactory }) {
    return {
        name: `cosimo-json-value-${urlPath.replaceAll("/", "-") || "root"}`,
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const requestPath = (request.url ?? "").split("?")[0];

                if (requestPath !== urlPath) {
                    next();
                    return;
                }

                try {
                    const payload = await valueFactory({ request, server });
                    response.statusCode = 200;
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Content-Type", "application/json; charset=utf-8");
                    response.end(JSON.stringify(payload));
                } catch (error) {
                    next(error);
                }
            });
        },
    };
}

export function servePatchModuleAlias({
    urlPath,
    sourceFile,
    repoRoot,
    moduleBindingName,
    createPatchViewExportName,
    reactRefreshPreamble = "",
    includeViteClient = false,
}) {
    const relativeImportPath = `/${path.relative(repoRoot, sourceFile).split(path.sep).join("/")}`;
    const preamble = reactRefreshPreamble ? `${reactRefreshPreamble}\n` : "";
    const viteClientImport = includeViteClient ? 'import "/@vite/client";\n' : "";

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
                    `${viteClientImport}` +
                    `${preamble}` +
                    `const ${moduleBindingName} = await import(${JSON.stringify(relativeImportPath)});\n` +
                    `export const ${createPatchViewExportName} = ${moduleBindingName}.${createPatchViewExportName};\n` +
                    `export default ${moduleBindingName}.default;\n`,
                );
            });
        },
    };
}

export function serveHtmlEntry({ urlPath, sourceFile, headInjection = "" }) {
    const normalizedSourceFile = path.resolve(sourceFile);
    const injectedHead = headInjection ? `<head>\n${headInjection}` : "<head>";

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
                    const transformed = html.replace("<head>", injectedHead);
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
