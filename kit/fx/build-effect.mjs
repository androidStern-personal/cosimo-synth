import fs from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isInsideDirectory, isMainModule, isPlainObject, readJsonObject, readKitManifest } from "../scripts/common.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "../..");
const defaultFxRoot = path.join(repoRoot, "fx");
/** Set to "1" to build a runtime without UI and worker source maps (for distribution). */
export const effectDistributableRuntimeEnvironmentKey = "FX_DISTRIBUTABLE_RUNTIME";

/**
 * Plugin registry, derived by discovery instead of hand-written lists.
 *
 * Every `fx/<dir>/<Name>.cmajorpatch` is a build target (a directory may hold
 * several; all of them are enumerated, sorted by directory then patch file
 * name). Per-patch configuration lives in one optional JSON file next to the
 * patch, `<Name>.plugin.json`:
 *
 *   {
 *     "schemaVersion": 1,             // required; must not exceed kit/kit.json schemaVersions.plugin
 *     "alias", "cmakeTarget", "productName",
 *     "product": { ...identity... },  // optional; presence makes identity authoritative
 *     "runtimeOut", "juceOut", "stateSource", "workerSource", "workerOut",
 *     "includeInAll", "jitInstallRuntime", "disableMicrophonePermission"
 *   }
 *
 * Every field except schemaVersion is optional and falls back to a derivation:
 *
 * - alias (registry key/CLI name): directory name, lowercased, with runs of
 *   non-alphanumerics collapsed to `-`. A directory holding more than one
 *   patch must disambiguate with explicit aliases.
 *   Commands also accept the directory name of a folder holding one plugin.
 * - cmakeTarget / productName (the install filename, `<productName>.vst3`):
 *   the patch manifest `name` (falling back to the patch file base name) with
 *   non-alphanumerics removed, e.g. "Enhance That" -> "EnhanceThat".
 * - runtimeOut / juceOut: `build/fx/<alias>_runtime` and `build/<alias>_juce`
 *   with `-` mapped to `_` in the alias.
 * - jitInstallRuntime (whether `fx:jit:install` points the generic VST3 at
 *   the built runtime patch instead of the source patch): true when the
 *   target has a state module or worker bundle.
 *
 * A malformed or unknown-key config, a config newer than this kit, and a
 * `*.plugin.json` whose name matches no patch all fail, naming the file. One
 * broken plugin directory fails only the commands that need it (its own
 * alias and `all`); the dev server and other plugins keep working. A
 * malformed patch manifest does not fail discovery: derivations fall back to
 * the patch file name and the build reports the parse error.
 *
 * Manifest source/resources/worker/sourceTransformer entries that escape the
 * patch directory (`../`, e.g. a shared `.cmajor` file) are copied flat into
 * the runtime output directory under their base names, and the runtime
 * manifest is rewritten to match. See planRuntimePatchEntries.
 *
 * Product identity lives in the config's optional `product` object
 * (productName = display name, manufacturerName, bundleIdentifier, 4-char
 * pluginCode/manufacturerCode, semantic version, optional supportUrl). When
 * the object is present, even empty, it is authoritative: absent fields
 * derive from the plugin name and the root `product-owner.json`, with the
 * display name and version taken from the patch manifest when it carries
 * them. Discovery validates the result, requires the patch manifest to agree,
 * and the build writes the identity into the runtime patch manifest. Without
 * a `product` object the patch manifest is authoritative for identity. Bundle
 * identifiers and plugin codes are collision-checked across all discovered
 * plugins.
 */
const buildKeyValidators = {
    alias: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value) && value !== "all",
    cmakeTarget: isBuildIdentifier,
    productName: isBuildIdentifier,
    runtimeOut: isRepoRelativeBuildPath,
    juceOut: isRepoRelativeBuildPath,
    workerSource: isRepoRelativeSourcePath,
    stateSource: isRepoRelativeSourcePath,
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

    if (!isInsideDirectory(buildRoot, resolved))
        throw new Error(`${label} must resolve strictly inside ${buildRoot} (got ${resolved}).`);

    return resolved;
}

function isSemanticVersion(value) {
    return isNonEmptyString(value) && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

/** The plugin config schema this kit reads: its own kit/kit.json schemaVersions.plugin. */
function supportedPluginSchemaVersion() {
    return readKitManifest(repoRoot).schemaVersions.plugin;
}

// ---------------------------------------------------------------------------
// product-owner.json — the identity every plugin in this repository inherits.

export const productOwnerFileName = "product-owner.json";

/** 4-char AU/VST identity codes: alphanumeric with at least one uppercase letter (all-lowercase codes are reserved). */
function isFourCharCode(value) {
    return isNonEmptyString(value) && /^[A-Za-z0-9]{4}$/.test(value) && /[A-Z]/.test(value);
}

/** Reverse-DNS bundle identifier (or prefix), e.g. "com.example.demo-verb" / "com.example". */
function isBundleIdentifier(value) {
    return isNonEmptyString(value) && /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/.test(value);
}

function isHttpUrl(value) {
    if (!isNonEmptyString(value))
        return false;

    let parsed;

    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    return parsed.protocol === "https:" || parsed.protocol === "http:";
}

const productOwnerKeyValidators = {
    manufacturer: isNonEmptyString,
    manufacturerCode: isFourCharCode,
    bundleIdentifierPrefix: isBundleIdentifier,
    supportUrl: isHttpUrl,
    pluginCodePrefix: (value) => isNonEmptyString(value) && /^[A-Za-z0-9]{2}$/.test(value),
};

const requiredProductOwnerKeys = ["manufacturer", "manufacturerCode", "bundleIdentifierPrefix"];

export function productOwnerPath(root = repoRoot) {
    return path.join(root, productOwnerFileName);
}

/**
 * Read and validate the repository's `product-owner.json`. Returns null when
 * the file is absent (plugins must then spell out their identity); every
 * defect fails closed like the plugin configs.
 */
export function readProductOwner(root = repoRoot) {
    const ownerPath = productOwnerPath(root);

    if (!fs.existsSync(ownerPath))
        return null;

    const owner = readJsonObject(ownerPath);

    for (const [key, value] of Object.entries(owner)) {
        const validate = productOwnerKeyValidators[key];

        if (!validate) {
            throw new Error(
                `${ownerPath} has unknown key "${key}". Known keys: ${Object.keys(productOwnerKeyValidators).join(", ")}.`,
            );
        }

        if (!validate(value))
            throw new Error(`${ownerPath} has an invalid "${key}" value.`);
    }

    for (const key of requiredProductOwnerKeys) {
        if (owner[key] === undefined)
            throw new Error(`${ownerPath} is missing required key "${key}".`);
    }

    return { path: ownerPath, owner };
}

// ---------------------------------------------------------------------------
// Name-derived identity, shared by discovery and the kit:new scaffold.

function capitalize(segment) {
    return segment[0].toUpperCase() + segment.slice(1);
}

/** Lowercase word segments of a plugin directory name ("demo_verb" -> ["demo", "verb"]). */
export function pluginNameSegments(directoryName) {
    return directoryName.toLowerCase().split(/[^a-z0-9]+/).filter((segment) => segment.length > 0);
}

/** "demo_verb" -> "Demo Verb". */
export function derivePluginDisplayName(directoryName) {
    return pluginNameSegments(directoryName).map(capitalize).join(" ");
}

/** "demo_verb" -> "DemoVerb" (patch base name / cmake target / install filename shape). */
export function derivePluginBaseName(directoryName) {
    return pluginNameSegments(directoryName).map(capitalize).join("");
}

/**
 * 4-char pluginCode: the owner's two-character prefix plus the initials of the
 * first two name segments ("Cs" + "demo_verb" -> "CsDV"), or the first two
 * characters of a single segment ("Cs" + "chorus" -> "CsCh"). Returns null
 * when the name is too short to fill four characters.
 */
export function derivePluginCode(directoryName, prefix) {
    const segments = pluginNameSegments(directoryName);

    if (segments.length === 0 || typeof prefix !== "string" || prefix.length !== 2)
        return null;

    const letters = segments.length >= 2
        ? [segments[0][0].toUpperCase(), segments[1][0].toUpperCase()]
        : [segments[0][0].toUpperCase(), segments[0][1]];

    if (letters.some((letter) => letter === undefined))
        return null;

    const code = `${prefix}${letters.join("")}`;

    return isFourCharCode(code) ? code : null;
}

/** The owner-derived pluginCode prefix: an explicit pluginCodePrefix, else the first two characters of the manufacturer code. */
export function ownerPluginCodePrefix(owner) {
    return owner.pluginCodePrefix ?? owner.manufacturerCode.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Product identity (the config's `product` object).

const productKeyValidators = {
    productName: isNonEmptyString,
    manufacturerName: isNonEmptyString,
    bundleIdentifier: isBundleIdentifier,
    pluginCode: isFourCharCode,
    manufacturerCode: isFourCharCode,
    version: isSemanticVersion,
    supportUrl: isHttpUrl,
};


function validateProductObject(product, label) {
    if (!isPlainObject(product))
        throw new Error(`${label} must be a JSON object.`);

    for (const [key, value] of Object.entries(product)) {
        const validate = productKeyValidators[key];

        if (!validate)
            throw new Error(`${label} has unknown key "${key}". Known keys: ${Object.keys(productKeyValidators).join(", ")}.`);

        if (!validate(value))
            throw new Error(`${label} has an invalid "${key}" value.`);
    }
}

/**
 * Fill the identity fields a config omitted from the plugin name, the patch
 * manifest (display name and version), and product-owner.json. Every field
 * of the result is validated so a derivation can never produce a shape the
 * explicit path would have refused.
 */
function resolveProductIdentity({ product, manifest, directoryName, alias, owner, root, label }) {
    const ownerFile = productOwnerPath(root);
    const fromOwner = (key, ownerKey, derive = (value) => value) => {
        if (product[key] !== undefined)
            return product[key];

        if (!owner) {
            throw new Error(
                `${label} omits "product.${key}" and there is no ${ownerFile} to derive it from. `
                + `Add ${productOwnerFileName} at the repository root or set the key explicitly.`,
            );
        }

        return derive(owner.owner[ownerKey] ?? undefined);
    };

    const identity = {
        productName: product.productName ?? (isNonEmptyString(manifest?.name) ? manifest.name : derivePluginDisplayName(directoryName)),
        manufacturerName: fromOwner("manufacturerName", "manufacturer"),
        bundleIdentifier: fromOwner("bundleIdentifier", "bundleIdentifierPrefix", (prefix) => `${prefix}.${alias}`),
        pluginCode: fromOwner("pluginCode", "manufacturerCode", () => derivePluginCode(directoryName, ownerPluginCodePrefix(owner.owner))),
        manufacturerCode: fromOwner("manufacturerCode", "manufacturerCode"),
        version: product.version ?? (isSemanticVersion(manifest?.version) ? manifest.version : "0.1.0"),
    };

    if (identity.pluginCode === null) {
        throw new Error(
            `${label} omits "product.pluginCode" and none can be derived from the plugin name ${JSON.stringify(directoryName)}; set it explicitly.`,
        );
    }

    const supportUrl = product.supportUrl ?? owner?.owner.supportUrl;

    if (supportUrl !== undefined)
        identity.supportUrl = supportUrl;

    for (const [key, value] of Object.entries(identity)) {
        if (!productKeyValidators[key](value))
            throw new Error(`${label} derived an invalid "product.${key}" value (${JSON.stringify(value)}); set it explicitly.`);
    }

    return identity;
}

/** The manifest-facing identity a resolved product identity drives. */
export function deriveProductIdentity(product) {
    return {
        ID: product.bundleIdentifier,
        name: product.productName,
        manufacturer: product.manufacturerName,
        version: product.version,
        plugin: {
            pluginCode: product.pluginCode,
            manufacturerCode: product.manufacturerCode,
        },
    };
}

function collectProductIdentityMismatches(manifest, identity, configLabel) {
    const facets = [
        ["ID", manifest?.ID, identity.ID],
        ["name", manifest?.name, identity.name],
        ["manufacturer", manifest?.manufacturer, identity.manufacturer],
        ["version", manifest?.version, identity.version],
        ["plugin.pluginCode", manifest?.plugin?.pluginCode, identity.plugin.pluginCode],
        ["plugin.manufacturerCode", manifest?.plugin?.manufacturerCode, identity.plugin.manufacturerCode],
    ];

    return facets
        .filter(([, manifestValue, productValue]) => manifestValue !== productValue)
        .map(([facet, manifestValue, productValue]) =>
            `${facet} (manifest ${JSON.stringify(manifestValue)}, ${configLabel} ${JSON.stringify(productValue)})`);
}

/** The identity values one discovered patch claims for cross-plugin collision checks. */
function readManifestIdentityClaims(manifest, identity) {
    if (identity)
        return { bundleIdentifier: identity.ID, pluginCode: identity.plugin.pluginCode };

    return {
        bundleIdentifier: isNonEmptyString(manifest?.ID) ? manifest.ID : undefined,
        pluginCode: isNonEmptyString(manifest?.plugin?.pluginCode) ? manifest.plugin.pluginCode : undefined,
    };
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

/** Null means the manifest did not parse; derivations then fall back to the patch file name. */
function readManifestForDiscovery(patchPath) {
    try {
        return JSON.parse(fs.readFileSync(patchPath, "utf8"));
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Per-patch configuration: <Name>.plugin.json.

export const pluginConfigSuffix = ".plugin.json";

function validateBuildFields(fields, filePath) {
    for (const [key, value] of Object.entries(fields)) {
        const validate = buildKeyValidators[key];

        if (!validate)
            throw new Error(`${filePath} has unknown key "${key}". Known keys: schemaVersion, product, ${Object.keys(buildKeyValidators).join(", ")}.`);

        if (!validate(value))
            throw new Error(`${filePath} has an invalid "${key}" value.`);
    }

    if (fields.workerOut !== undefined && fields.workerSource === undefined)
        throw new Error(`${filePath} sets "workerOut" without "workerSource".`);

    if (fields.stateSource !== undefined && fields.workerSource !== undefined)
        throw new Error(`${filePath} cannot combine "stateSource" and "workerSource". The framework builds the worker for the declared state module.`);
}

/**
 * Read and validate one `<Name>.plugin.json`, or the empty configuration when
 * the patch has none. The schemaVersion gate runs first so a config written
 * for a newer kit reports the real fix (update the kit) instead of an
 * unknown-key error.
 */
function readPluginConfig(patchPath) {
    const configPath = patchPath.replace(/\.cmajorpatch$/, pluginConfigSuffix);

    if (!fs.existsSync(configPath))
        return { configPath: null, build: {}, product: null };

    const config = readJsonObject(configPath);
    const supported = supportedPluginSchemaVersion();

    if (config.schemaVersion === undefined)
        throw new Error(`${configPath} is missing required key "schemaVersion" (this kit supports ${supported}).`);

    if (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1)
        throw new Error(`${configPath} has an invalid "schemaVersion" value.`);

    if (config.schemaVersion > supported) {
        throw new Error(
            `${configPath} uses plugin config schema ${config.schemaVersion}, newer than this kit supports (${supported}). `
            + "Update the kit (kit-update skill) before building this plugin.",
        );
    }

    const { schemaVersion: _schemaVersion, product, ...build } = config;

    validateBuildFields(build, configPath);

    if (product !== undefined)
        validateProductObject(product, `${configPath} "product"`);

    return { configPath, build, product: product ?? null };
}

function createDiscoveredPlugin({ patch, manifest, config, directoryName, patchFileName, owner, root }) {
    const { build } = config;
    const alias = build.alias ?? deriveAlias(directoryName);

    if (!buildKeyValidators.alias(alias))
        throw new Error(`Could not derive a usable plugin alias for ${patch}.`);

    const outputStem = alias.replaceAll("-", "_");
    const buildIdentifier = deriveBuildIdentifier(manifest, patchFileName);
    const plugin = {
        patch,
        runtimeOut: build.runtimeOut ?? `build/fx/${outputStem}_runtime`,
        juceOut: build.juceOut ?? `build/${outputStem}_juce`,
        cmakeTarget: build.cmakeTarget ?? buildIdentifier,
        productName: build.productName ?? buildIdentifier,
    };

    if (!isBuildIdentifier(plugin.cmakeTarget) || !isBuildIdentifier(plugin.productName))
        throw new Error(`Could not derive a build identifier for ${patch}; set cmakeTarget/productName in its ${pluginConfigSuffix} config.`);

    if (config.product !== null) {
        const configLabel = path.basename(config.configPath);
        const label = config.configPath;

        plugin.product = resolveProductIdentity({ product: config.product, manifest, directoryName, alias, owner, root, label });
        plugin.identity = deriveProductIdentity(plugin.product);

        // The source patch is what dev servers and JIT installs load, so a
        // manifest that disagrees with the authoritative config would ship
        // one identity in development and another in production. Fail closed
        // instead (a manifest that does not parse is reported by the build
        // itself later).
        if (manifest !== null) {
            const mismatches = collectProductIdentityMismatches(manifest, plugin.identity, configLabel);

            if (mismatches.length > 0) {
                throw new Error(
                    `${label} is authoritative for ${patch} but disagrees with its manifest: `
                    + `${mismatches.join("; ")}. Update the patch manifest to match ${configLabel}.`,
                );
            }
        }
    }

    if (build.disableMicrophonePermission === true)
        plugin.disableMicrophonePermission = true;

    if (build.workerSource) {
        plugin.workerSource = build.workerSource;
        plugin.workerOut = build.workerOut ?? "worker.js";
    }

    if (build.stateSource) {
        plugin.stateSource = build.stateSource;
    }

    if (build.includeInAll === false)
        plugin.includeInAll = false;

    if (isNonEmptyString(manifest?.view?.devModule))
        plugin.devModule = manifest.view.devModule;

    plugin.jitInstallRuntime = build.jitInstallRuntime ?? Boolean(plugin.workerSource || plugin.stateSource);

    return { alias, plugin };
}

/** Fail closed on a config file whose name matches no patch: its settings would otherwise be silently ignored. */
function assertNoOrphanConfigs(directoryPath, fileNames, patchFileNames) {
    const claimedNames = new Set(patchFileNames.map((fileName) => fileName.replace(/\.cmajorpatch$/, pluginConfigSuffix)));

    for (const fileName of fileNames) {
        if (fileName.endsWith(pluginConfigSuffix) && !claimedNames.has(fileName)) {
            throw new Error(
                `${path.join(directoryPath, fileName)} matches no .cmajorpatch in its directory. `
                + `Name plugin configs <PatchName>${pluginConfigSuffix} after the patch they configure.`,
            );
        }
    }
}

/** Every plugin one fx/ directory declares; throws on the first defect. */
function discoverDirectory({ directoryPath, directoryName, registryRoot, owner }) {
    const fileNames = fs.readdirSync(directoryPath, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    const patchFileNames = fileNames
        .filter((fileName) => fileName.endsWith(".cmajorpatch"))
        .sort();

    assertNoOrphanConfigs(directoryPath, fileNames, patchFileNames);

    return patchFileNames.map((patchFileName) => {
        const patchPath = path.join(directoryPath, patchFileName);
        const patch = path.relative(registryRoot, patchPath).split(path.sep).join("/");
        const manifest = readManifestForDiscovery(patchPath);
        const config = readPluginConfig(patchPath);
        const { alias, plugin } = createDiscoveredPlugin({
            patch,
            manifest,
            config,
            directoryName,
            patchFileName,
            owner,
            root: registryRoot,
        });

        return { alias, plugin, patch, claims: readManifestIdentityClaims(manifest, plugin.identity) };
    });
}

/**
 * Discover every plugin under fxRoot. A defect in one directory throws, unless
 * `onPluginError(directoryPath, error)` is given: then that directory is
 * skipped and discovery continues. Alias and identity collisions always throw.
 */
export function discoverEffectPlugins({ fxRoot = defaultFxRoot, onPluginError } = {}) {
    const registryRoot = path.dirname(fxRoot);
    const plugins = {};
    const patchesByAlias = new Map();
    const patchesByBundleIdentifier = new Map();
    const patchesByPluginCode = new Map();

    if (!fs.existsSync(fxRoot))
        return plugins;

    const owner = readProductOwner(registryRoot);
    const directoryNames = fs.readdirSync(fxRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

    for (const directoryName of directoryNames) {
        const directoryPath = path.join(fxRoot, directoryName);
        let discovered;

        try {
            discovered = discoverDirectory({ directoryPath, directoryName, registryRoot, owner });
        } catch (error) {
            if (!onPluginError)
                throw error;

            onPluginError(directoryPath, error);
            continue;
        }

        for (const { alias, plugin, patch, claims } of discovered) {
            if (patchesByAlias.has(alias)) {
                throw new Error(
                    `Effect plugin alias "${alias}" is claimed by both ${patchesByAlias.get(alias)} and ${patch}. `
                    + `Give each patch a unique alias in its <PatchName>${pluginConfigSuffix} config.`,
                );
            }

            for (const [claimKey, claimedPatches, description] of [
                ["bundleIdentifier", patchesByBundleIdentifier, "bundle identifier"],
                ["pluginCode", patchesByPluginCode, "pluginCode"],
            ]) {
                const claim = claims[claimKey];

                if (claim === undefined)
                    continue;

                if (claimedPatches.has(claim)) {
                    throw new Error(
                        `Effect plugin ${description} ${JSON.stringify(claim)} is claimed by both `
                        + `${claimedPatches.get(claim)} and ${patch}. `
                        + `Give each plugin a unique identity (the "product" object of its ${pluginConfigSuffix} config, or the patch manifest when there is none).`,
                    );
                }

                claimedPatches.set(claim, patch);
            }

            patchesByAlias.set(alias, patch);
            plugins[alias] = plugin;
        }
    }

    return plugins;
}

/**
 * The bundle identifiers and plugin codes every discovered plugin claims,
 * mapped to the claiming patch. Config-driven and manifest-only identities
 * both count; this is what scaffolding checks new identity candidates
 * against.
 */
export function collectEffectIdentityClaims({ fxRoot = defaultFxRoot } = {}) {
    const registryRoot = path.dirname(fxRoot);
    const bundleIdentifiers = new Map();
    const pluginCodes = new Map();

    for (const plugin of Object.values(discoverEffectPlugins({ fxRoot }))) {
        const manifest = readManifestForDiscovery(path.join(registryRoot, plugin.patch));
        const claims = readManifestIdentityClaims(manifest, plugin.identity);

        if (claims.bundleIdentifier !== undefined)
            bundleIdentifiers.set(claims.bundleIdentifier, plugin.patch);

        if (claims.pluginCode !== undefined)
            pluginCodes.set(claims.pluginCode, plugin.patch);
    }

    return { bundleIdentifiers, pluginCodes };
}

let registry = null;

/**
 * This checkout's plugins, discovered on first use. Directories that fail to
 * load are kept as failures so only the commands that need them fail.
 */
function loadRegistry() {
    if (registry === null) {
        const failures = [];
        const plugins = discoverEffectPlugins({
            onPluginError: (directoryPath, error) => failures.push({
                alias: deriveAlias(path.basename(directoryPath)),
                directoryName: path.basename(directoryPath),
                error,
            }),
        });

        registry = { plugins, failures };
    }

    return registry;
}

export function getEffectPlugins() {
    return loadRegistry().plugins;
}

/** Plugin folders whose configuration could not be read, one message each (they name the file). */
export function effectPluginLoadFailures() {
    return loadRegistry().failures.map(({ error }) => error.message);
}

export function effectPluginNames() {
    return Object.entries(getEffectPlugins())
        .filter(([, plugin]) => plugin.includeInAll !== false)
        .map(([pluginName]) => pluginName);
}

export function effectPluginTargetNames() {
    return Object.keys(getEffectPlugins());
}

export function availableEffectPluginNamesLine() {
    return ["all", ...effectPluginTargetNames()].join(", ");
}

function failuresNote() {
    const failures = effectPluginLoadFailures();

    return failures.length === 0 ? "" : `\n\nThese plugin folders could not be loaded:\n${failures.map((message) => `  ${message}`).join("\n")}`;
}

export function usage() {
    return `Usage: npm run fx:build -- <plugin>\n\nAvailable plugins: ${availableEffectPluginNamesLine()}${failuresNote()}`;
}

/**
 * The alias a command-line name refers to: the alias itself, or the fx/
 * directory name of a folder holding exactly one plugin. Returns null when
 * nothing matches; a folder holding several plugins asks for one of them.
 */
export function findPluginAlias(plugins, pluginName) {
    if (typeof pluginName !== "string")
        return null;

    if (Object.hasOwn(plugins, pluginName))
        return pluginName;

    const inDirectory = Object.entries(plugins)
        .filter(([, plugin]) => plugin.patch.split("/").at(-2) === pluginName)
        .map(([alias]) => alias);

    if (inDirectory.length > 1)
        throw new Error(`The folder ${pluginName} holds several plugins; name one of them: ${inDirectory.join(", ")}.`);

    return inDirectory[0] ?? null;
}

/** The alias for a plugin alias or folder name; a plugin whose folder failed to load throws that failure. */
export function resolvePluginAlias(pluginName, createUsage = usage) {
    const { plugins, failures } = loadRegistry();
    const alias = findPluginAlias(plugins, pluginName);

    if (alias !== null)
        return alias;

    const failure = failures.find((entry) => entry.alias === pluginName || entry.directoryName === pluginName);

    throw failure ? failure.error : new Error(`Unknown plugin ${JSON.stringify(pluginName ?? "")}.\n\n${createUsage()}`);
}

/** One discovered plugin, named by its alias or its folder name. */
export function getEffectPlugin(pluginName, createUsage = usage) {
    return loadRegistry().plugins[resolvePluginAlias(pluginName, createUsage)];
}

export function resolvePluginNames(pluginName, createUsage = usage) {
    if (pluginName === "all") {
        const failures = effectPluginLoadFailures();

        if (failures.length > 0)
            throw new Error(`Cannot build all plugins until these plugin folders load:\n${failures.map((message) => `  ${message}`).join("\n")}`);

        return effectPluginNames();
    }

    return [resolvePluginAlias(pluginName, createUsage)];
}

/** Everything `npm run fx:jit:install` needs to point the generic VST3 at one target. */
export function createJitInstallPlan(pluginName, plugins = null) {
    const alias = plugins === null ? resolvePluginAlias(pluginName) : findPluginAlias(plugins, pluginName);

    if (alias === null) {
        throw new Error(
            `Unknown effect plugin: ${JSON.stringify(pluginName ?? "")}. `
            + `Available plugins: ${Object.keys(plugins).join(", ")}.`,
        );
    }

    const plugin = (plugins ?? getEffectPlugins())[alias];

    return {
        name: alias,
        patch: plugin.patch,
        runtimePatch: `${plugin.runtimeOut}/${path.posix.basename(plugin.patch)}`,
        jitInstallRuntime: plugin.jitInstallRuntime === true,
    };
}

/** Keep local source maps unless the caller explicitly builds a distributable runtime. */
export function shouldEmitEffectRuntimeSourceMaps(environment = process.env) {
    return environment[effectDistributableRuntimeEnvironmentKey] !== "1";
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

    if (plugin.identity) {
        // The plugin config's "product" object is authoritative for identity;
        // discovery already requires the source manifest to agree, so this is
        // a no-op rewrite that keeps the authority direction explicit.
        runtimeManifest.ID = plugin.identity.ID;
        runtimeManifest.name = plugin.identity.name;
        runtimeManifest.manufacturer = plugin.identity.manufacturer;
        runtimeManifest.version = plugin.identity.version;
        runtimeManifest.plugin = { ...runtimeManifest.plugin, ...plugin.identity.plugin };
    }

    if (plugin.workerSource || plugin.stateSource) {
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
    const { build } = await import("vite");

    if (!plugin.workerSource && !plugin.stateSource) {
        return;
    }

    const generatedEntry = path.join(repoRoot, "kit/.plugin-state-worker.virtual.js");
    const plugins = plugin.stateSource ? [{
        name: "plugin-state-worker",
        resolveId(id) { return id === generatedEntry ? `\0${generatedEntry}` : undefined; },
        load(id) {
            if (id !== `\0${generatedEntry}`) return undefined;
            const source = JSON.stringify(path.join(repoRoot, plugin.stateSource));
            const adapter = JSON.stringify(path.join(repoRoot, "kit/ui/plugin-state-cmajor.ts"));
            return `import definition from ${source};
import { createCmajorPluginStateService } from ${adapter};
export default async connection => {
    const service = createCmajorPluginStateService(definition, connection, {
        onDefect: error => console.error(error instanceof Error ? error.stack ?? error.message : String(error)),
    });
    await service.start();
    return service;
};`;
        },
    }] : [];
    const workerEntry = plugin.stateSource ? generatedEntry : path.join(repoRoot, plugin.workerSource);
    const workerOut = plugin.workerOut ?? "worker.js";

    await build(createProductionBundleConfig({
        entry: workerEntry,
        fileName: workerOut,
        outDir: runtimeRoot,
        sourcemap,
        plugins,
    }));
}


function getView(manifest, patchPath) {
    if (!manifest?.view || typeof manifest.view !== "object" || Array.isArray(manifest.view))
        throw new Error(`${patchPath} must contain a view object.`);

    return manifest.view;
}

export async function buildPlugin(name, { environment = process.env, stripDevModule = false } = {}) {
    const pluginName = resolvePluginAlias(name);
    const plugin = getEffectPlugin(pluginName);
    // Vite, React and esbuild load here so discovery-only commands (kit:doctor,
    // kit:new, --targets) work before npm dependencies are installed.
    const [{ build }, { default: react }, { buildPluginState }] = await Promise.all([
        import("vite"),
        import("@vitejs/plugin-react"),
        import("./build-plugin-state.mjs"),
    ]);

    const patchPath = path.join(repoRoot, plugin.patch);
    const patchRoot = path.dirname(patchPath);
    const runtimeRoot = resolveBuildOutputRoot(plugin.runtimeOut, `${pluginName} runtimeOut`);
    const runtimeViewRoot = path.join(runtimeRoot, "view");
    const sharedLoaderPath = path.join(repoRoot, "kit/ui/view-loader.js");
    const manifest = readJsonObject(patchPath);
    const view = getView(manifest, patchPath);
    const devModule = normalizeRepoPath(view.devModule, `${pluginName} view.devModule`);
    const sourceEntry = path.join(repoRoot, devModule);
    const sourcemap = shouldEmitEffectRuntimeSourceMaps(environment);
    const entryPlans = planRuntimePatchEntries(manifest, {
        reservedTargets: [path.basename(patchPath)],
    });

    if (view.src !== "view/index.js")
        throw new Error(`${plugin.patch} must set view.src to "view/index.js".`);

    await rm(runtimeRoot, { recursive: true, force: true });
    await mkdir(runtimeViewRoot, { recursive: true });

    if (plugin.stateSource) {
        const state = await buildPluginState({ source: plugin.stateSource, runtimeRoot, repoRoot });
        if (state.source.length) {
            if (manifest.sharedData) throw new Error("State declarations own sharedData configuration; remove the manual manifest setting.");
            manifest.source = [...(Array.isArray(manifest.source) ? manifest.source : [manifest.source]), ...state.source];
            manifest.sharedData = state.sharedData;
        }
    }
    await writeRuntimePatchManifest(manifest, plugin, runtimeRoot, patchPath, {
        stripDevModule,
    });
    for (const key of runtimeCopiedManifestKeys) {
        if (key === "worker" && (plugin.workerSource || plugin.stateSource))
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
            for (const message of effectPluginLoadFailures())
                console.error(message);
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

if (isMainModule(import.meta.url))
    await main();
