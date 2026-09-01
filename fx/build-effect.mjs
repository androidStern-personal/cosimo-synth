import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");
export const seqFxCanonicalRuntimePrebuiltEnvironmentKey = "SEQFX_CANONICAL_RUNTIME_PREBUILT";
export const seqFxDistributableRuntimeEnvironmentKey = "SEQFX_DISTRIBUTABLE_RUNTIME";

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
    polish: {
        patch: "fx/polish_lab/PolishVoicingLab.cmajorpatch",
        runtimeOut: "build/fx/polish_lab_runtime",
        juceOut: "build/polish_lab_juce",
        cmakeTarget: "PolishVoicingLab",
        productName: "PolishVoicingLab",
    },
    seqfx: {
        patch: "fx/seqfx/SeqFx.cmajorpatch",
        runtimeOut: "build/fx/seqfx_runtime",
        juceOut: "build/seqfx_juce",
        cmakeTarget: "CosimoSeqFX",
        disableMicrophonePermission: true,
        productName: "CosimoSeqFX",
        visualReviewAdapter: "scripts/visual-review/seqfx.mjs",
        workerSource: "fx/seqfx/worker/source.ts",
        workerOut: "worker.js",
    },
    spectral: {
        patch: "fx/spectral_chord_resonator/SpectralChordResonator.cmajorpatch",
        runtimeOut: "build/fx/spectral_chord_resonator_runtime",
        juceOut: "build/spectral_chord_resonator_juce",
        cmakeTarget: "SpectralChordResonator",
        productName: "SpectralChordResonator",
        workerSource: "fx/spectral_chord_resonator/worker/source.ts",
        workerOut: "worker.js",
    },
    enhancer: {
        patch: "fx/enhancer/Enhancer.cmajorpatch",
        runtimeOut: "build/fx/enhancer_runtime",
        juceOut: "build/enhancer_juce",
        cmakeTarget: "CosimoEnhancer",
        productName: "CosimoEnhancer",
        runtimeSources: [
            { repoPath: "cmajor/Enhancer.cmajor", runtimePath: "Enhancer.cmajor" },
            { repoPath: "fx/enhancer/EnhancerPlugin.cmajor", runtimePath: "EnhancerPlugin.cmajor" },
        ],
    },
    "enhancer-lite": {
        patch: "fx/enhancer_lite/EnhancerLite.cmajorpatch",
        runtimeOut: "build/fx/enhancer_lite_runtime",
        juceOut: "build/enhancer_lite_juce",
        cmakeTarget: "CosimoEnhancerLite",
        productName: "CosimoEnhancerLite",
        runtimeSources: [
            { repoPath: "cmajor/EnhancerLite.cmajor", runtimePath: "EnhancerLite.cmajor" },
            { repoPath: "cmajor/EnhancerLiteSpectrumAnalyzer.cmajor", runtimePath: "EnhancerLiteSpectrumAnalyzer.cmajor" },
            { repoPath: "fx/enhancer_lite/EnhancerLitePlugin.cmajor", runtimePath: "EnhancerLitePlugin.cmajor" },
        ],
    },
    "enhancer-lite-shelves-audition": {
        patch: "fx/enhancer_lite/EnhancerLiteShelvesAudition.cmajorpatch",
        runtimeOut: "build/fx/enhancer_lite_shelves_audition_runtime",
        juceOut: "build/enhancer_lite_shelves_audition_juce",
        cmakeTarget: "CosimoEnhancerLiteShelvesAudition",
        productName: "CosimoEnhancerLiteShelvesAudition",
        includeInAll: false,
        runtimeSources: [
            { repoPath: "cmajor/EnhancerLite.cmajor", runtimePath: "EnhancerLite.cmajor" },
            { repoPath: "cmajor/EnhancerLiteSpectrumAnalyzer.cmajor", runtimePath: "EnhancerLiteSpectrumAnalyzer.cmajor" },
            { repoPath: "fx/enhancer_lite/EnhancerLitePlugin.cmajor", runtimePath: "EnhancerLitePlugin.cmajor" },
        ],
    },
};

export function effectPluginNames() {
    return Object.entries(effectPlugins)
        .filter(([, plugin]) => plugin.includeInAll !== false)
        .map(([pluginName]) => pluginName);
}

export function effectPluginTargetNames() {
    return Object.keys(effectPlugins);
}

export function usage() {
    const names = ["all", ...effectPluginTargetNames()].join(", ");
    return `Usage: npm run fx:build -- <plugin>\n\nAvailable plugins: ${names}`;
}

export function resolvePluginNames(pluginName) {
    if (pluginName === "all")
        return effectPluginNames();

    if (effectPlugins[pluginName])
        return [pluginName];

    throw new Error(usage());
}

export function shouldReuseSeqFxCanonicalRuntime(pluginName, environment = process.env) {
    return pluginName === "seqfx"
        && environment[seqFxCanonicalRuntimePrebuiltEnvironmentKey] === "1";
}

/** Keep qualification provenance local while removing source maps from SeqFX distribution builds. */
export function shouldEmitEffectRuntimeSourceMaps(pluginName, environment = process.env) {
    return pluginName !== "seqfx"
        || environment[seqFxDistributableRuntimeEnvironmentKey] !== "1";
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

export function createRuntimePatchManifest(manifest, plugin, { stripDevModule = false } = {}) {
    const runtimeManifest = { ...manifest };

    if (plugin.runtimeSources) {
        runtimeManifest.source = plugin.runtimeSources.map(({ runtimePath }) => runtimePath);
    }

    if (plugin.workerSource) {
        runtimeManifest.worker = plugin.workerOut ?? "worker.js";
    }

    if (stripDevModule && runtimeManifest.view && typeof runtimeManifest.view === "object") {
        const { devModule: _devModule, ...runtimeView } = runtimeManifest.view;
        runtimeManifest.view = runtimeView;
    }

    return runtimeManifest;
}

async function writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath, options = {}) {
    const runtimeManifest = createRuntimePatchManifest(manifest, plugin, options);

    await writeFile(
        path.join(runtimeRoot, path.basename(patchPath)),
        `${JSON.stringify(runtimeManifest, null, 2)}\n`,
        "utf8",
    );
}

async function copyRuntimeSources(runtimeSources, runtimeRoot) {
    for (const { repoPath, runtimePath } of runtimeSources) {
        const sourcePath = path.join(repoRoot, normalizeRepoPath(repoPath, "runtime source repoPath"));
        const targetPath = path.join(runtimeRoot, normalizeRepoPath(runtimePath, "runtime source runtimePath"));
        await mkdir(path.dirname(targetPath), { recursive: true });
        await cp(sourcePath, targetPath, { recursive: true });
    }
}

function createProductionBundleConfig({ entry, fileName, outDir, plugins = [], sourcemap = true }) {
    return {
        configFile: false,
        root: repoRoot,
        resolve: {
            preserveSymlinks: true,
        },
        define: {
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        plugins,
        build: {
            target: "esnext",
            minify: false,
            sourcemap,
            emptyOutDir: false,
            lib: {
                entry,
                formats: ["es"],
                fileName: () => fileName,
            },
            outDir,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            },
        },
    };
}

async function buildWorker(plugin, runtimeRoot, { sourcemap }) {
    if (!plugin.workerSource) {
        return;
    }

    const workerEntry = path.join(repoRoot, plugin.workerSource);
    const workerOut = plugin.workerOut ?? "worker.js";

    await build(createProductionBundleConfig({
        entry: workerEntry,
        fileName: workerOut,
        outDir: runtimeRoot,
        sourcemap,
    }));
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

export async function buildPlugin(pluginName, { environment = process.env } = {}) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

    if (shouldReuseSeqFxCanonicalRuntime(pluginName, environment)) {
        console.log("Reusing aggregate-prebuilt SeqFX canonical runtime");
        return;
    }

    const patchPath = path.join(repoRoot, plugin.patch);
    const patchRoot = path.dirname(patchPath);
    const runtimeRoot = path.join(repoRoot, plugin.runtimeOut);
    const runtimeViewRoot = path.join(runtimeRoot, "view");
    const sharedLoaderPath = path.join(repoRoot, "ui/shared/effects/effect-view-loader.js");
    const manifest = await readPatchManifest(patchPath);
    const view = getView(manifest, patchPath);
    const devModule = normalizeRepoPath(view.devModule, `${pluginName} view.devModule`);
    const sourceEntry = path.join(repoRoot, devModule);
    const sourcemap = shouldEmitEffectRuntimeSourceMaps(pluginName, environment);
    const stripDevModule = pluginName === "seqfx"
        && environment[seqFxDistributableRuntimeEnvironmentKey] === "1";

    if (view.src !== "view/index.js")
        throw new Error(`${plugin.patch} must set view.src to "view/index.js".`);

    await rm(runtimeRoot, { recursive: true, force: true });
    await mkdir(runtimeViewRoot, { recursive: true });

    await writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath, {
        stripDevModule,
    });
    if (plugin.runtimeSources) {
        await copyRuntimeSources(plugin.runtimeSources, runtimeRoot);
    } else {
        await copyRelativeEntries(manifest.source, patchRoot, runtimeRoot, "source");
    }
    await copyRelativeEntries(manifest.resources, patchRoot, runtimeRoot, "resources");
    if (!plugin.workerSource) {
        await copyRelativeEntries(manifest.worker, patchRoot, runtimeRoot, "worker");
    }
    await copyRelativeEntries(manifest.sourceTransformer, patchRoot, runtimeRoot, "sourceTransformer");
    await cp(sharedLoaderPath, path.join(runtimeViewRoot, "index.js"));

    await build(createProductionBundleConfig({
        entry: sourceEntry,
        fileName: "app.js",
        outDir: runtimeViewRoot,
        plugins: [
            react(),
        ],
        sourcemap,
    }));

    await buildWorker(plugin, runtimeRoot, { sourcemap });

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
