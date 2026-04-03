import path from "node:path";

import { build } from "esbuild";

const moduleCache = new Map();

export async function loadUIModule(repoRoot, sourceRelativePath) {
    if (!moduleCache.has(sourceRelativePath)) {
        const sourceFile = path.join(repoRoot, sourceRelativePath);
        const bundledModulePromise = build({
            entryPoints: [sourceFile],
            bundle: true,
            format: "esm",
            platform: "browser",
            target: "es2022",
            write: false,
            jsx: "automatic",
            loader: {
                ".css": "text",
            },
            define: {
                "process.env.NODE_ENV": "\"test\"",
            },
        }).then(async (result) => {
            const bundledSource = result.outputFiles[0]?.text;

            if (!bundledSource) {
                throw new Error(`Could not bundle ${sourceRelativePath} for tests.`);
            }

            return import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`);
        });

        moduleCache.set(sourceRelativePath, bundledModulePromise);
    }

    return moduleCache.get(sourceRelativePath);
}
