import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");

export const effectPlugins = {
    ott: {
        patch: "fx/ott_lab/OttLab.cmajorpatch",
        runtimeOut: "build/fx/ott_lab_runtime",
        juceOut: "build/ott_lab_juce",
        cmakeTarget: "OTTLab",
        productName: "OTTLab",
    },
    chorus: {
        patch: "fx/chorus_lab/ChorusLab.cmajorpatch",
        runtimeOut: "build/fx/chorus_lab_runtime",
        juceOut: "build/chorus_lab_juce",
        cmakeTarget: "ChorusLab",
        productName: "ChorusLab",
    },
    seqfx: {
        patch: "fx/seqfx/SeqFx.cmajorpatch",
        runtimeOut: "build/fx/seqfx_runtime",
        juceOut: "build/seqfx_juce",
        cmakeTarget: "CosimoSeqFX",
        productName: "CosimoSeqFX",
        workerSource: "fx/seqfx/worker/source.ts",
        workerOut: "worker.js",
    },
};

export function effectPluginNames() {
    return Object.keys(effectPlugins);
}

export function usage() {
    const names = ["all", ...effectPluginNames()].join(", ");
    return `Usage: npm run fx:build -- <plugin>\n\nAvailable plugins: ${names}`;
}

export function resolvePluginNames(pluginName) {
    if (pluginName === "all")
        return effectPluginNames();

    if (effectPlugins[pluginName])
        return [pluginName];

    throw new Error(usage());
}

function asList(value) {
    if (value === undefined || value === null)
        return [];

    return Array.isArray(value) ? value : [value];
}

function normalizeRepoPath(value, label) {
    if (typeof value !== "string" || value.length === 0)
        throw new Error(`${label} must be a non-empty string.`);

    if (path.isAbsolute(value))
        return value.slice(1);

    return value;
}

async function copyRelativeEntries(entries, fromRoot, toRoot, label) {
    for (const entry of asList(entries)) {
        const relativePath = normalizeRepoPath(entry, label);
        const sourcePath = path.join(fromRoot, relativePath);
        const targetPath = path.join(toRoot, relativePath);

        await mkdir(path.dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath, { recursive: true });
    }
}

async function writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath) {
    const runtimeManifest = { ...manifest };

    if (plugin.workerSource) {
        runtimeManifest.worker = plugin.workerOut ?? "worker.js";
    }

    await writeFile(
        path.join(runtimeRoot, path.basename(patchPath)),
        `${JSON.stringify(runtimeManifest, null, 2)}\n`,
        "utf8",
    );
}

async function buildWorker(plugin, runtimeRoot) {
    if (!plugin.workerSource) {
        return;
    }

    const workerEntry = path.join(repoRoot, plugin.workerSource);
    const workerOut = plugin.workerOut ?? "worker.js";

    await build({
        configFile: false,
        root: repoRoot,
        define: {
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        build: {
            target: "esnext",
            minify: false,
            emptyOutDir: false,
            lib: {
                entry: workerEntry,
                formats: ["es"],
                fileName: () => workerOut,
            },
            outDir: runtimeRoot,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    });
}

export async function readPatchManifest(patchPath) {
    const manifestText = await readFile(patchPath, "utf8");

    try {
        return JSON.parse(manifestText);
    } catch (error) {
        throw new Error(`Could not parse ${patchPath}: ${error.message}`);
    }
}

function getView(manifest, patchPath) {
    if (!manifest?.view || typeof manifest.view !== "object" || Array.isArray(manifest.view))
        throw new Error(`${patchPath} must contain a view object.`);

    return manifest.view;
}

export async function buildPlugin(pluginName) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

    const patchPath = path.join(repoRoot, plugin.patch);
    const patchRoot = path.dirname(patchPath);
    const runtimeRoot = path.join(repoRoot, plugin.runtimeOut);
    const runtimeViewRoot = path.join(runtimeRoot, "view");
    const sharedLoaderPath = path.join(repoRoot, "ui/shared/effects/effect-view-loader.js");
    const manifest = await readPatchManifest(patchPath);
    const view = getView(manifest, patchPath);
    const devModule = normalizeRepoPath(view.devModule, `${pluginName} view.devModule`);
    const sourceEntry = path.join(repoRoot, devModule);

    if (view.src !== "view/index.js")
        throw new Error(`${plugin.patch} must set view.src to "view/index.js".`);

    await rm(runtimeRoot, { recursive: true, force: true });
    await mkdir(runtimeViewRoot, { recursive: true });

    await writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath);
    await copyRelativeEntries(manifest.source, patchRoot, runtimeRoot, "source");
    await copyRelativeEntries(manifest.resources, patchRoot, runtimeRoot, "resources");
    if (!plugin.workerSource) {
        await copyRelativeEntries(manifest.worker, patchRoot, runtimeRoot, "worker");
    }
    await copyRelativeEntries(manifest.sourceTransformer, patchRoot, runtimeRoot, "sourceTransformer");
    await cp(sharedLoaderPath, path.join(runtimeViewRoot, "index.js"));

    await build({
        configFile: false,
        root: repoRoot,
        define: {
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        plugins: [
            react(),
        ],
        build: {
            target: "esnext",
            minify: false,
            emptyOutDir: false,
            lib: {
                entry: sourceEntry,
                formats: ["es"],
                fileName: () => "app.js",
            },
            outDir: runtimeViewRoot,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    });

    await buildWorker(plugin, runtimeRoot);

    console.log(`Built ${pluginName} effect runtime at ${path.relative(repoRoot, runtimeRoot)}`);
}

export async function buildPlugins(pluginName) {
    for (const nextPluginName of resolvePluginNames(pluginName)) {
        await buildPlugin(nextPluginName);
    }
}

async function main() {
    try {
        const pluginName = process.argv[2];

        if (!pluginName)
            throw new Error(usage());

        await buildPlugins(pluginName);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
