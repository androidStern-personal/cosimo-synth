import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const moduleCache = new Map();

/**
 * Vite-style string imports: `import text from "./styles.css?inline"` and
 * `import markup from "./icon.svg?raw"` resolve to the file's text contents,
 * matching what the Vite dev server hands the browser.
 */
const stringImportQueryPlugin = {
    name: "cosimo-string-import-query",
    setup(builder) {
        builder.onResolve({ filter: /\?(?:inline|raw)$/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path.replace(/\?(?:inline|raw)$/, "")),
            namespace: "cosimo-string-import",
        }));
        builder.onLoad({ filter: /.*/, namespace: "cosimo-string-import" }, async (args) => ({
            contents: await fs.readFile(args.path, "utf8"),
            loader: "text",
        }));
    },
};

function bundleOptions(sourceFile, define) {
    return {
        entryPoints: [sourceFile],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        write: false,
        jsx: "automatic",
        sourcemap: "inline",
        loader: {
            ".css": "text",
        },
        define,
        plugins: [stringImportQueryPlugin],
    };
}

async function bundleToText(options, sourceLabel) {
    const result = await build(options);
    const bundledSource = result.outputFiles[0]?.text;

    if (!bundledSource) {
        throw new Error(`Could not bundle ${sourceLabel} for tests.`);
    }

    return bundledSource;
}

/**
 * Bundle one TypeScript/TSX module into browser-ready JavaScript text for the
 * static test web server, which serves it at the module's own URL so
 * `import.meta.url`-relative asset references keep resolving. Mirrors the
 * Vite dev environment: `import.meta.env.DEV` is true.
 */
export async function bundleBrowserModuleSource(sourceFile) {
    return bundleToText(bundleOptions(sourceFile, {
        "process.env.NODE_ENV": "\"test\"",
        "import.meta.env": JSON.stringify({ DEV: true, MODE: "development" }),
    }), sourceFile);
}

export async function loadUIModule(repoRoot, sourceRelativePath) {
    const cacheKey = `${repoRoot}\u0000${sourceRelativePath}`;
    let bundledModulePromise = moduleCache.get(cacheKey);

    if (!bundledModulePromise) {
        const sourceFile = path.join(repoRoot, sourceRelativePath);
        bundledModulePromise = bundleToText(bundleOptions(sourceFile, {
            "process.env.NODE_ENV": "\"test\"",
        }), sourceRelativePath).then((bundledSource) => (
            import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`)
        ));
        // A failed bundle must not poison later attempts with a cached rejection.
        bundledModulePromise.catch(() => moduleCache.delete(cacheKey));
        moduleCache.set(cacheKey, bundledModulePromise);
    }

    return bundledModulePromise;
}
