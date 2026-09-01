import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { bundleBrowserModuleSource } from "./load_ui_module.mjs";

const CONTENT_TYPES = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".map", "application/json; charset=utf-8"],
    [".cmajorpatch", "application/json; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".woff2", "font/woff2"],
    [".svg", "image/svg+xml"],
    [".wav", "audio/wav"],
    [".png", "image/png"],
]);

const BUNDLED_MODULE_EXTENSIONS = new Set([".ts", ".tsx", ".mts"]);

function contentType(filePath) {
    return CONTENT_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
}

export function pathStaysWithinRepoRoot(rootPath, candidatePath) {
    const repoRelativePath = path.relative(rootPath, candidatePath);

    return !(repoRelativePath.startsWith("..") || path.isAbsolute(repoRelativePath));
}

/**
 * The symlink-safe traversal guard shared by every test web server: resolve
 * symlinks before the containment check so a root-local link cannot serve a
 * file outside the served root. Returns the servable path, or null when the
 * candidate escapes the root.
 */
export async function resolveRepoServedPath(rootPath, candidatePath) {
    const realRootPath = await fs.realpath(rootPath);
    let resolvedCandidatePath = candidatePath;

    try {
        resolvedCandidatePath = await fs.realpath(candidatePath);
    } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
            throw error;
        }
    }

    if (!pathStaysWithinRepoRoot(realRootPath, resolvedCandidatePath)) {
        return null;
    }

    return candidatePath;
}

/**
 * The one static server shared by the browser suites.
 *
 * Serves `webRoot`, then each of `fallbackRoots` in order (live-review pages
 * use build/web with the repo root as the fallback). `mounts` maps URL
 * prefixes to a directory outside the roots — or to a function returning one,
 * resolved lazily on the first request so suites that never touch the mount
 * skip its cost (the staged Cmajor runtime under /cmaj_api). With
 * `bundleTypeScript`, requests for .ts/.tsx/.mts files answer with an
 * esbuild-bundled module at the file's own URL, standing in for the Vite dev
 * server the module-shell tests used to spawn.
 */
export async function startStaticWebServer(webRoot, {
    fallbackRoots = [],
    mounts = {},
    bundleTypeScript = false,
} = {}) {
    const roots = [webRoot, ...fallbackRoots];
    const mountRootPromises = new Map();
    const bundlePromises = new Map();
    let baseUrl = "";

    const resolveMountRoot = (prefix) => {
        let rootPromise = mountRootPromises.get(prefix);

        if (!rootPromise) {
            const configured = mounts[prefix];
            rootPromise = Promise.resolve(typeof configured === "function" ? configured() : configured);
            rootPromise.catch(() => mountRootPromises.delete(prefix));
            mountRootPromises.set(prefix, rootPromise);
        }

        return rootPromise;
    };

    const bundleServedModule = (servedPath) => {
        let bundlePromise = bundlePromises.get(servedPath);

        if (!bundlePromise) {
            bundlePromise = bundleBrowserModuleSource(servedPath);
            bundlePromise.catch(() => bundlePromises.delete(servedPath));
            bundlePromises.set(servedPath, bundlePromise);
        }

        return bundlePromise;
    };

    const server = createServer((request, response) => {
        void (async () => {
            try {
                const requestUrl = new URL(request.url ?? "/", baseUrl);
                let pathname = decodeURIComponent(requestUrl.pathname);
                if (pathname.endsWith("/")) pathname += "index.html";

                const mountPrefix = Object.keys(mounts)
                    .find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
                const candidates = mountPrefix
                    ? [{
                        root: await resolveMountRoot(mountPrefix),
                        rootRelativePath: pathname.slice(mountPrefix.length) || "/index.html",
                    }]
                    : roots.map((root) => ({ root, rootRelativePath: pathname }));

                let sawEscapingPath = false;

                for (const { root, rootRelativePath } of candidates) {
                    const filePath = path.resolve(root, `.${rootRelativePath}`);
                    let servedPath;

                    try {
                        servedPath = await resolveRepoServedPath(root, filePath);
                    } catch (error) {
                        // A missing root (an absent build/web) has no files: try the next one.
                        if (error?.code === "ENOENT") continue;
                        throw error;
                    }

                    if (servedPath === null) {
                        sawEscapingPath = true;
                        continue;
                    }

                    if (bundleTypeScript && BUNDLED_MODULE_EXTENSIONS.has(path.extname(servedPath))) {
                        try {
                            await fs.access(servedPath);
                        } catch (error) {
                            if (error?.code === "ENOENT") continue;
                            throw error;
                        }
                        const bundledSource = await bundleServedModule(servedPath);
                        response.writeHead(200, {
                            "cache-control": "no-store",
                            "content-type": "text/javascript; charset=utf-8",
                        });
                        response.end(bundledSource);
                        return;
                    }

                    let bytes;

                    try {
                        bytes = await fs.readFile(servedPath);
                    } catch (error) {
                        if (error?.code === "ENOENT" || error?.code === "EISDIR") continue;
                        throw error;
                    }

                    response.writeHead(200, {
                        "cache-control": "no-store",
                        "content-type": contentType(servedPath),
                    });
                    response.end(bytes);
                    return;
                }

                if (sawEscapingPath) {
                    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
                    response.end("Forbidden");
                    return;
                }

                response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
                response.end("Not found");
            } catch (error) {
                response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
                response.end(String(error));
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

const kitRepoRoot = path.resolve(import.meta.dirname, "../../..");

/**
 * Repo-root static server for plugin browser tests. Unlike the synth
 * harness wrapper it declares no /cmaj_api mount, so it stays runnable in
 * an exported Builder Kit with no Cmajor web-runtime staging.
 */
export async function startStaticRepoServer(options = {}) {
    return startStaticWebServer(kitRepoRoot, options);
}
