import fs from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");
const defaultFxRoot = path.join(repoRoot, "fx");
export const seqFxCanonicalRuntimePrebuiltEnvironmentKey = "SEQFX_CANONICAL_RUNTIME_PREBUILT";
export const seqFxDistributableRuntimeEnvironmentKey = "SEQFX_DISTRIBUTABLE_RUNTIME";

/**
 * Plugin registry, derived by discovery instead of hand-written lists.
 *
 * Every `fx/<dir>/<Name>.cmajorpatch` is a build target (a directory may hold
 * several; all of them are enumerated, sorted by directory then patch file
 * name). Per-patch build settings live in an optional sidecar JSON next to the
 * patch named `<Name>.build.json` (the patch file name with `.cmajorpatch`
 * replaced by `.build.json`). Absent sidecar fields fall back to derivations:
 *
 * - alias (registry key/CLI name): directory name, lowercased, with runs of
 *   non-alphanumerics collapsed to `-`. A directory holding more than one
 *   patch must disambiguate with sidecar aliases; duplicate aliases fail
 *   discovery loudly.
 * - cmakeTarget / productName: the patch manifest `name` (falling back to the
 *   patch file base name) with non-alphanumerics removed, e.g.
 *   "OTT Lab" -> "OTTLab".
 * - runtimeOut / juceOut: `build/fx/<alias>_runtime` and `build/<alias>_juce`
 *   with `-` mapped to `_` in the alias.
 * - jitInstallRuntime (whether `fx:jit:install` must build and point the
 *   generic VST3 at the built runtime patch instead of the source patch):
 *   true when the target has a worker bundle, else false.
 *
 * Sidecar-only fields: workerSource/workerOut (repo-relative worker entry and
 * its bundled file name), includeInAll (false excludes the target from the
 * `all` build set), and disableMicrophonePermission. A malformed or
 * unknown-key sidecar fails discovery, and so does an orphan sidecar (a
 * `*.build.json` whose name matches no `.cmajorpatch` in its directory —
 * typically a renamed patch or a case typo), so configuration can never be
 * silently ignored. A malformed patch manifest does not fail discovery
 * (derivations fall back to the patch file name and the build reports the
 * parse error later), matching the dev server's tolerance for in-progress
 * patches.
 *
 * Manifest source/resources/worker/sourceTransformer entries that escape the
 * patch directory (`../`, e.g. a shared `.cmajor` file) are copied flat into
 * the runtime output directory under their base names, and the runtime
 * manifest is rewritten to match, so nothing is ever written outside the
 * runtime directory. See planRuntimePatchEntries.
 */
const sidecarKeyValidators = {
    alias: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value) && value !== "all",
    cmakeTarget: isBuildIdentifier,
    productName: isBuildIdentifier,
    runtimeOut: isRepoRelativeBuildPath,
    juceOut: isRepoRelativeBuildPath,
    workerSource: isRepoRelativeSourcePath,
    workerOut: isPlainFileName,
    includeInAll: (value) => typeof value === "boolean",
    disableMicrophonePermission: (value) => typeof value === "boolean",
    jitInstallRuntime: (value) => typeof value === "boolean",
};

function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

/**
 * cmakeTarget/productName become cmake arguments and install/remove paths
 * (`<productName>.vst3` is rm -rf'd), so they must stay identifier-shaped —
 * no separators, no `..` — like the derived defaults already are.
 */
function isBuildIdentifier(value) {
    return isNonEmptyString(value) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
}

/** workerOut names a single bundled file inside the runtime directory. */
function isPlainFileName(value) {
    return isNonEmptyString(value) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

/** workerSource is read relative to the repo root and must not escape it. */
function isRepoRelativeSourcePath(value) {
    if (!isNonEmptyString(value) || path.isAbsolute(value))
        return false;

    const normalized = path.posix.normalize(value);

    return normalized !== ".." && !normalized.startsWith("../");
}

/** Output directories are deleted before builds, so they must stay strictly inside build/. */
function isRepoRelativeBuildPath(value) {
    if (!isNonEmptyString(value) || path.isAbsolute(value))
        return false;

    const normalized = path.posix.normalize(value);

    return normalized.startsWith("build/") && normalized.length > "build/".length;
}

/** Resolve a registry-derived output directory, refusing anything outside build/ before it is removed. */
export function resolveBuildOutputRoot(value, label) {
    if (!isRepoRelativeBuildPath(value))
        throw new Error(`${label} must be a non-empty repo-relative path inside build/ (got ${JSON.stringify(value)}).`);

    const buildRoot = path.join(repoRoot, "build");
    const resolved = path.resolve(repoRoot, value);

    if (resolved === buildRoot || !resolved.startsWith(buildRoot + path.sep))
        throw new Error(`${label} must resolve strictly inside ${buildRoot} (got ${resolved}).`);

    return resolved;
}

function deriveAlias(directoryName) {
    return directoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function deriveBuildIdentifier(manifest, patchFileName) {
    const source = isNonEmptyString(manifest?.name)
        ? manifest.name
        : path.basename(patchFileName, ".cmajorpatch");

    return source.replace(/[^A-Za-z0-9]+/g, "");
}

function readManifestForDiscovery(patchPath) {
    try {
        return JSON.parse(fs.readFileSync(patchPath, "utf8"));
    } catch {
        return {};
    }
}

function readBuildSidecar(sidecarPath) {
    if (!fs.existsSync(sidecarPath))
        return {};

    let sidecar;

    try {
        sidecar = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    } catch (error) {
        throw new Error(`Could not parse ${sidecarPath}: ${error.message}`);
    }

    if (sidecar === null || typeof sidecar !== "object" || Array.isArray(sidecar))
        throw new Error(`${sidecarPath} must contain a JSON object.`);

    for (const [key, value] of Object.entries(sidecar)) {
        const validate = sidecarKeyValidators[key];

        if (!validate) {
            throw new Error(
                `${sidecarPath} has unknown key "${key}". Known keys: ${Object.keys(sidecarKeyValidators).join(", ")}.`,
            );
        }

        if (!validate(value))
            throw new Error(`${sidecarPath} has an invalid "${key}" value.`);
    }

    if (sidecar.workerOut !== undefined && sidecar.workerSource === undefined)
        throw new Error(`${sidecarPath} sets "workerOut" without "workerSource".`);

    return sidecar;
}

function createDiscoveredPlugin({ patch, manifest, sidecar, directoryName, patchFileName }) {
    const alias = sidecar.alias ?? deriveAlias(directoryName);

    if (!sidecarKeyValidators.alias(alias))
        throw new Error(`Could not derive a usable plugin alias for ${patch}.`);

    const outputStem = alias.replaceAll("-", "_");
    const buildIdentifier = deriveBuildIdentifier(manifest, patchFileName);
    const plugin = {
        patch,
        runtimeOut: sidecar.runtimeOut ?? `build/fx/${outputStem}_runtime`,
        juceOut: sidecar.juceOut ?? `build/${outputStem}_juce`,
        cmakeTarget: sidecar.cmakeTarget ?? buildIdentifier,
        productName: sidecar.productName ?? buildIdentifier,
    };

    if (!isBuildIdentifier(plugin.cmakeTarget) || !isBuildIdentifier(plugin.productName))
        throw new Error(`Could not derive a build identifier for ${patch}; set cmakeTarget/productName in its sidecar.`);

    if (sidecar.disableMicrophonePermission === true)
        plugin.disableMicrophonePermission = true;

    if (sidecar.workerSource) {
        plugin.workerSource = sidecar.workerSource;
        plugin.workerOut = sidecar.workerOut ?? "worker.js";
    }

    if (sidecar.includeInAll === false)
        plugin.includeInAll = false;

    if (isNonEmptyString(manifest?.view?.devModule))
        plugin.devModule = manifest.view.devModule;

    plugin.jitInstallRuntime = sidecar.jitInstallRuntime ?? Boolean(plugin.workerSource);

    return { alias, plugin };
}

export function discoverEffectPlugins({ fxRoot = defaultFxRoot } = {}) {
    const registryRoot = path.dirname(fxRoot);
    const plugins = {};
    const patchesByAlias = new Map();

    if (!fs.existsSync(fxRoot))
        return plugins;

    const directoryNames = fs.readdirSync(fxRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    for (const directoryName of directoryNames) {
        const directoryPath = path.join(fxRoot, directoryName);
        const fileNames = fs.readdirSync(directoryPath, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name);
        const patchFileNames = fileNames
            .filter((fileName) => fileName.endsWith(".cmajorpatch"))
            .sort();
        const claimedSidecarNames = new Set(
            patchFileNames.map((fileName) => fileName.replace(/\.cmajorpatch$/, ".build.json")),
        );

        // An unclaimed sidecar means its build settings would be silently
        // ignored (patch renamed, or a case typo) — fail closed instead.
        for (const fileName of fileNames) {
            if (fileName.endsWith(".build.json") && !claimedSidecarNames.has(fileName)) {
                throw new Error(
                    `${path.join(directoryPath, fileName)} matches no .cmajorpatch in its directory. `
                    + "Name build sidecars <PatchName>.build.json after the patch they configure.",
                );
            }
        }

        for (const patchFileName of patchFileNames) {
            const patchPath = path.join(directoryPath, patchFileName);
            const sidecarPath = patchPath.replace(/\.cmajorpatch$/, ".build.json");
            const patch = path.relative(registryRoot, patchPath).split(path.sep).join("/");
            const { alias, plugin } = createDiscoveredPlugin({
                patch,
                manifest: readManifestForDiscovery(patchPath),
                sidecar: readBuildSidecar(sidecarPath),
                directoryName,
                patchFileName,
            });

            if (patchesByAlias.has(alias)) {
                throw new Error(
                    `Effect plugin alias "${alias}" is claimed by both ${patchesByAlias.get(alias)} and ${patch}. `
                    + "Give each patch a unique alias in its <PatchName>.build.json sidecar.",
                );
            }

            patchesByAlias.set(alias, patch);
            plugins[alias] = plugin;
        }
    }

    return plugins;
}

export const effectPlugins = discoverEffectPlugins();

export function effectPluginNames() {
    return Object.entries(effectPlugins)
        .filter(([, plugin]) => plugin.includeInAll !== false)
        .map(([pluginName]) => pluginName);
}

export function effectPluginTargetNames() {
    return Object.keys(effectPlugins);
}

export function availableEffectPluginNamesLine() {
    return ["all", ...effectPluginTargetNames()].join(", ");
}

export function usage() {
    return `Usage: npm run fx:build -- <plugin>\n\nAvailable plugins: ${availableEffectPluginNamesLine()}`;
}

export function resolvePluginNames(pluginName, createUsage = usage) {
    if (pluginName === "all")
        return effectPluginNames();

    if (effectPlugins[pluginName])
        return [pluginName];

    throw new Error(createUsage());
}

/** Everything scripts/install_fx_cmajplugin.sh needs to JIT-install one target. */
export function createJitInstallPlan(pluginName, plugins = effectPlugins) {
    const plugin = plugins[pluginName];

    if (!plugin) {
        throw new Error(
            `Unknown effect plugin: ${JSON.stringify(pluginName ?? "")}. `
            + `Available plugins: ${Object.keys(plugins).join(", ")}.`,
        );
    }

    return {
        name: pluginName,
        patch: plugin.patch,
        runtimePatch: `${plugin.runtimeOut}/${path.posix.basename(plugin.patch)}`,
        jitInstallRuntime: plugin.jitInstallRuntime === true,
    };
}

export function shouldReuseSeqFxCanonicalRuntime(
    pluginName,
    environment = process.env,
    { stripDevModule = false } = {},
) {
    // A prebuilt canonical runtime keeps view.devModule, so a build that must
    // strip it (fx:prod:build) can never reuse one — it rebuilds instead.
    return !stripDevModule
        && pluginName === "seqfx"
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

/** The manifest keys whose files are copied into the runtime patch directory. */
const runtimeCopiedManifestKeys = ["source", "resources", "worker", "sourceTransformer"];

function planRuntimeEntry(entry, label) {
    const relativePath = path.posix.normalize(normalizeRepoPath(entry, label));

    if (relativePath === "." || relativePath === "..")
        throw new Error(`${label} entry ${JSON.stringify(entry)} does not name a file.`);

    if (relativePath.startsWith("../")) {
        // The entry escapes the patch directory (a shared repo file). Copy it
        // flat into the runtime directory so nothing is written outside it.
        const flattened = path.posix.basename(relativePath);

        if (flattened === "" || flattened === "." || flattened === "..")
            throw new Error(`${label} entry ${JSON.stringify(entry)} does not name a file.`);

        return { entry, from: relativePath, to: flattened, escaped: true };
    }

    return { entry, from: relativePath, to: relativePath, escaped: false };
}

/**
 * Map every copied manifest entry to a path inside the runtime directory,
 * collision-checking the resulting targets (flattened base names may clash
 * with each other or with in-directory entries).
 */
export function planRuntimePatchEntries(manifest, { reservedTargets = [] } = {}) {
    const plans = {};
    const claimedTargets = new Map(reservedTargets.map((target) => [target, "the runtime patch manifest"]));

    for (const key of runtimeCopiedManifestKeys) {
        const entries = asList(manifest?.[key]).map((entry) => planRuntimeEntry(entry, key));

        for (const { entry, to } of entries) {
            const claimedBy = claimedTargets.get(to);

            if (claimedBy !== undefined) {
                throw new Error(
                    `${key} entry ${JSON.stringify(entry)} maps to runtime path "${to}", which is already used by ${claimedBy}.`,
                );
            }

            claimedTargets.set(to, `${key} entry ${JSON.stringify(entry)}`);
        }

        plans[key] = entries;
    }

    return plans;
}

export function createRuntimePatchManifest(manifest, plugin, { stripDevModule = false } = {}) {
    const runtimeManifest = { ...manifest };
    const entryPlans = planRuntimePatchEntries(manifest);

    for (const key of runtimeCopiedManifestKeys) {
        if (manifest[key] === undefined || manifest[key] === null)
            continue;

        const rewritten = entryPlans[key].map(({ entry, to, escaped }) => (escaped ? to : entry));
        runtimeManifest[key] = Array.isArray(manifest[key]) ? rewritten : rewritten[0];
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

async function copyRuntimeEntries(entries, patchRoot, runtimeRoot) {
    for (const { from, to } of entries) {
        const targetPath = path.join(runtimeRoot, to);

        await mkdir(path.dirname(targetPath), { recursive: true });
        await cp(path.join(patchRoot, from), targetPath, { recursive: true });
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

export async function buildPlugin(pluginName, { environment = process.env, stripDevModule = false } = {}) {
    const plugin = effectPlugins[pluginName];

    if (!plugin)
        throw new Error(usage());

    if (shouldReuseSeqFxCanonicalRuntime(pluginName, environment, { stripDevModule })) {
        console.log("Reusing aggregate-prebuilt SeqFX canonical runtime");
        return;
    }

    const patchPath = path.join(repoRoot, plugin.patch);
    const patchRoot = path.dirname(patchPath);
    const runtimeRoot = resolveBuildOutputRoot(plugin.runtimeOut, `${pluginName} runtimeOut`);
    const runtimeViewRoot = path.join(runtimeRoot, "view");
    const sharedLoaderPath = path.join(repoRoot, "ui/shared/effects/effect-view-loader.js");
    const manifest = await readPatchManifest(patchPath);
    const view = getView(manifest, patchPath);
    const devModule = normalizeRepoPath(view.devModule, `${pluginName} view.devModule`);
    const sourceEntry = path.join(repoRoot, devModule);
    const sourcemap = shouldEmitEffectRuntimeSourceMaps(pluginName, environment);
    const entryPlans = planRuntimePatchEntries(manifest, {
        reservedTargets: [path.basename(patchPath)],
    });

    if (view.src !== "view/index.js")
        throw new Error(`${plugin.patch} must set view.src to "view/index.js".`);

    await rm(runtimeRoot, { recursive: true, force: true });
    await mkdir(runtimeViewRoot, { recursive: true });

    await writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath, {
        stripDevModule,
    });
    for (const key of runtimeCopiedManifestKeys) {
        if (key === "worker" && plugin.workerSource)
            continue;

        await copyRuntimeEntries(entryPlans[key], patchRoot, runtimeRoot);
    }
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
        const [, , firstArgument, secondArgument] = process.argv;

        if (firstArgument === "--targets") {
            console.log(effectPluginTargetNames().join("\n"));
            return;
        }

        if (firstArgument === "--jit-plan") {
            console.log(JSON.stringify(createJitInstallPlan(secondArgument), null, 2));
            return;
        }

        if (!firstArgument)
            throw new Error(usage());

        await buildPlugins(firstArgument);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
