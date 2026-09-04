import fs from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "../..");
const defaultFxRoot = path.join(repoRoot, "fx");
export const seqFxCanonicalRuntimePrebuiltEnvironmentKey = "SEQFX_CANONICAL_RUNTIME_PREBUILT";
export const seqFxDistributableRuntimeEnvironmentKey = "SEQFX_DISTRIBUTABLE_RUNTIME";

/**
 * Plugin registry, derived by discovery instead of hand-written lists.
 *
 * Every `fx/<dir>/<Name>.cmajorpatch` is a build target (a directory may hold
 * several; all of them are enumerated, sorted by directory then patch file
 * name). Per-patch configuration lives in ONE optional JSON file next to the
 * patch named `<Name>.plugin.json` (the patch file name with `.cmajorpatch`
 * replaced by `.plugin.json`):
 *
 *   {
 *     "schemaVersion": 1,             // required; must not exceed kit/kit.json schemaVersions.plugin
 *     "alias", "cmakeTarget", "productName",
 *     "product": { ...identity... },  // optional; presence makes identity authoritative
 *     "runtimeOut", "juceOut", "workerSource", "workerOut", "includeInAll",
 *     "jitInstallRuntime", "visualReviewAdapter",
 *     "disableMicrophonePermission"
 *   }
 *
 * Every field except schemaVersion is optional and falls back to a derivation:
 *
 * - alias (registry key/CLI name): directory name, lowercased, with runs of
 *   non-alphanumerics collapsed to `-`. A directory holding more than one
 *   patch must disambiguate with explicit aliases; duplicate aliases fail
 *   discovery loudly.
 * - cmakeTarget / productName (the install filename, `<productName>.vst3`):
 *   the patch manifest `name` (falling back to the patch file base name) with
 *   non-alphanumerics removed, e.g. "OTT Lab" -> "OTTLab".
 * - runtimeOut / juceOut: `build/fx/<alias>_runtime` and `build/<alias>_juce`
 *   with `-` mapped to `_` in the alias.
 * - jitInstallRuntime (whether `fx:jit:install` must build and point the
 *   generic VST3 at the built runtime patch instead of the source patch):
 *   true when the target has a worker bundle, else false.
 *
 * Config-only fields: workerSource/workerOut (repo-relative worker entry and
 * its bundled file name), includeInAll (false excludes the target from the
 * `all` build set), visualReviewAdapter, and
 * disableMicrophonePermission. A malformed or unknown-key config fails
 * discovery, and so does an orphan config (a `*.plugin.json` whose name
 * matches no `.cmajorpatch` in its directory — typically a renamed patch or a
 * case typo), so configuration can never be silently ignored. A config whose
 * schemaVersion is newer than this kit supports fails discovery naming the
 * kit update as the fix. A malformed patch manifest does not fail discovery
 * (derivations fall back to the patch file name and the build reports the
 * parse error later), matching the dev server's tolerance for in-progress
 * patches.
 *
 * Manifest source/resources/worker/sourceTransformer entries that escape the
 * patch directory (`../`, e.g. a shared `.cmajor` file) are copied flat into
 * the runtime output directory under their base names, and the runtime
 * manifest is rewritten to match, so nothing is ever written outside the
 * runtime directory. See planRuntimePatchEntries.
 *
 * Product identity lives in the config's optional `product` object
 * (productName = display name, manufacturerName, bundleIdentifier, 4-char
 * pluginCode/manufacturerCode, semantic version, optional supportUrl and
 * wordmark/accent tokens). When the object is present — even empty — it is
 * authoritative: absent identity fields derive from the plugin name and the
 * root `product-owner.json` (manufacturer, manufacturerCode,
 * bundleIdentifierPrefix, optional pluginCodePrefix/supportUrl), with the
 * display name and version taken from the patch manifest when it carries
 * them. Discovery validates the result (fail closed), derives the
 * manifest-facing identity (`plugin.identity`), requires the patch manifest
 * to agree, and the build writes the identity into the runtime patch
 * manifest. Without a `product` object the patch manifest is authoritative
 * for identity, unchanged. Bundle identifiers and plugin codes are
 * collision-checked across ALL discovered plugins (config-driven or
 * manifest-only); duplicates fail discovery naming both claiming patches.
 *
 * Legacy two-file configuration (`<Name>.build.json` build sidecar plus a
 * directory-level `product.json` with `patch`/`outputFileName` keys) is still
 * read for one release so older checkouts keep building; `kit:doctor` warns
 * about it. A patch may not mix the two schemes.
 */
const sidecarKeyValidators = {
    alias: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value) && value !== "all",
    cmakeTarget: isBuildIdentifier,
    productName: isBuildIdentifier,
    runtimeOut: isRepoRelativeBuildPath,
    juceOut: isRepoRelativeBuildPath,
    workerSource: isRepoRelativeSourcePath,
    workerOut: isPlainFileName,
    visualReviewAdapter: isRepoRelativeSourcePath,
    includeInAll: (value) => typeof value === "boolean",
    disableMicrophonePermission: (value) => typeof value === "boolean",
    jitInstallRuntime: (value) => typeof value === "boolean",
};

function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
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

function isSemanticVersion(value) {
    return isNonEmptyString(value) && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

// ---------------------------------------------------------------------------
// kit/kit.json — the kit's own version and the config schema versions it reads.

export const kitManifestFileName = "kit.json";
export const kitManifestPath = path.join(repoRoot, "kit", kitManifestFileName);
const kitSchemaKeys = ["plugin", "toolchain", "feed"];

/** Read and shape-check kit/kit.json (version + schemaVersions.plugin/toolchain/feed). */
export function readKitManifest(filePath = kitManifestPath) {
    let manifest;

    try {
        manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new Error(`Could not read ${filePath}: ${error.message}`);
    }

    const schemaVersions = manifest?.schemaVersions;
    const wellFormed = isPlainObject(manifest)
        && isSemanticVersion(manifest.version)
        && isPlainObject(schemaVersions)
        && kitSchemaKeys.every((key) => Number.isInteger(schemaVersions[key]) && schemaVersions[key] >= 1);

    if (!wellFormed) {
        throw new Error(
            `${filePath} must contain {"version": "<semver>", "schemaVersions": {"plugin": <int>, "toolchain": <int>, "feed": <int>}}.`,
        );
    }

    return { version: manifest.version, schemaVersions: { ...schemaVersions } };
}

export const kitManifest = readKitManifest();
export const supportedPluginSchemaVersion = kitManifest.schemaVersions.plugin;

// ---------------------------------------------------------------------------
// product-owner.json — the identity every plugin in this repository inherits.

export const productOwnerFileName = "product-owner.json";

/** 4-char AU/VST identity codes: alphanumeric with at least one uppercase letter (all-lowercase codes are reserved). */
function isFourCharCode(value) {
    return isNonEmptyString(value) && /^[A-Za-z0-9]{4}$/.test(value) && /[A-Z]/.test(value);
}

/** Reverse-DNS bundle identifier (or prefix), e.g. "dev.cosimo.enhancer-lite" / "dev.cosimo". */
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

function isCssHexColor(value) {
    return isNonEmptyString(value) && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Wordmarks are read relative to the plugin directory and must not escape it. */
function isPluginRelativeFilePath(value) {
    if (!isNonEmptyString(value) || path.isAbsolute(value))
        return false;

    const normalized = path.posix.normalize(value);

    return normalized !== "." && normalized !== ".." && !normalized.startsWith("../");
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

    let owner;

    try {
        owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
    } catch (error) {
        throw new Error(`Could not parse ${ownerPath}: ${error.message}`);
    }

    if (!isPlainObject(owner))
        throw new Error(`${ownerPath} must contain a JSON object.`);

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
    wordmark: isPluginRelativeFilePath,
    accentColor: isCssHexColor,
};

/** Legacy product.json additionally binds a patch and owns the install filename. */
const legacyProductKeyValidators = {
    ...productKeyValidators,
    patch: (value) => isPlainFileName(value) && value.endsWith(".cmajorpatch"),
    outputFileName: isBuildIdentifier,
};

const requiredLegacyProductKeys = [
    "productName",
    "manufacturerName",
    "bundleIdentifier",
    "pluginCode",
    "manufacturerCode",
    "version",
    "outputFileName",
];

function validateProductObject(product, validators, label) {
    if (!isPlainObject(product))
        throw new Error(`${label} must be a JSON object.`);

    for (const [key, value] of Object.entries(product)) {
        const validate = validators[key];

        if (!validate)
            throw new Error(`${label} has unknown key "${key}". Known keys: ${Object.keys(validators).join(", ")}.`);

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

    if (product.wordmark !== undefined)
        identity.wordmark = product.wordmark;

    if (product.accentColor !== undefined)
        identity.accentColor = product.accentColor;

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
// Per-patch configuration: <Name>.plugin.json, or the legacy pair.

export const pluginConfigSuffix = ".plugin.json";
export const legacyBuildSidecarSuffix = ".build.json";
export const legacyProductIdentityFileName = "product.json";

function readJsonObject(filePath) {
    let value;

    try {
        value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new Error(`Could not parse ${filePath}: ${error.message}`);
    }

    if (!isPlainObject(value))
        throw new Error(`${filePath} must contain a JSON object.`);

    return value;
}

function validateBuildFields(fields, filePath, validators) {
    for (const [key, value] of Object.entries(fields)) {
        const validate = validators[key];

        if (!validate)
            throw new Error(`${filePath} has unknown key "${key}". Known keys: ${Object.keys(validators).join(", ")}.`);

        if (!validate(value))
            throw new Error(`${filePath} has an invalid "${key}" value.`);
    }

    if (fields.workerOut !== undefined && fields.workerSource === undefined)
        throw new Error(`${filePath} sets "workerOut" without "workerSource".`);
}

const pluginConfigKeyValidators = {
    schemaVersion: (value) => Number.isInteger(value) && value >= 1,
    ...sidecarKeyValidators,
    product: isPlainObject,
};

/**
 * Read and validate one `<Name>.plugin.json`. The schemaVersion gate runs
 * first so a config written for a newer kit reports the real fix (update the
 * kit) instead of an unknown-key error.
 */
function readPluginConfig(configPath, directoryPath) {
    const config = readJsonObject(configPath);

    if (config.schemaVersion === undefined)
        throw new Error(`${configPath} is missing required key "schemaVersion" (this kit supports ${supportedPluginSchemaVersion}).`);

    if (!pluginConfigKeyValidators.schemaVersion(config.schemaVersion))
        throw new Error(`${configPath} has an invalid "schemaVersion" value.`);

    if (config.schemaVersion > supportedPluginSchemaVersion) {
        throw new Error(
            `${configPath} uses plugin config schema ${config.schemaVersion}, newer than this kit supports (${supportedPluginSchemaVersion}). `
            + "Update the kit (kit-update skill) before building this plugin.",
        );
    }

    const { schemaVersion, product, ...build } = config;

    validateBuildFields(build, configPath, pluginConfigKeyValidators);

    if (product !== undefined) {
        validateProductObject(product, productKeyValidators, `${configPath} "product"`);

        if (product.wordmark !== undefined && !fs.existsSync(path.join(directoryPath, product.wordmark)))
            throw new Error(`${configPath} names a wordmark file that does not exist: ${JSON.stringify(product.wordmark)}.`);
    }

    return { configPath, schemaVersion, legacy: false, build, product: product ?? null, outputFileName: undefined };
}

function readLegacyBuildSidecar(sidecarPath) {
    if (!fs.existsSync(sidecarPath))
        return {};

    const sidecar = readJsonObject(sidecarPath);

    validateBuildFields(sidecar, sidecarPath, sidecarKeyValidators);

    return sidecar;
}

/**
 * Read and validate a directory's legacy `product.json`, resolving which patch
 * it identifies. Returns null when the file is absent.
 */
function readLegacyProductIdentity(directoryPath, patchFileNames) {
    const productPath = path.join(directoryPath, legacyProductIdentityFileName);

    if (!fs.existsSync(productPath))
        return null;

    const product = readJsonObject(productPath);

    validateProductObject(product, legacyProductKeyValidators, productPath);

    for (const key of requiredLegacyProductKeys) {
        if (product[key] === undefined)
            throw new Error(`${productPath} is missing required key "${key}".`);
    }

    if (product.wordmark !== undefined && !fs.existsSync(path.join(directoryPath, product.wordmark)))
        throw new Error(`${productPath} names a wordmark file that does not exist: ${JSON.stringify(product.wordmark)}.`);

    let boundPatchFileName;

    if (product.patch !== undefined) {
        if (!patchFileNames.includes(product.patch)) {
            throw new Error(
                `${productPath} binds to ${JSON.stringify(product.patch)}, which matches no .cmajorpatch in its directory.`,
            );
        }

        boundPatchFileName = product.patch;
    } else if (patchFileNames.length === 1) {
        boundPatchFileName = patchFileNames[0];
    } else {
        throw new Error(
            `${productPath} is ambiguous: its directory holds ${patchFileNames.length} patches. `
            + 'Set its "patch" key to the .cmajorpatch this identity belongs to.',
        );
    }

    const { patch: _boundPatch, outputFileName, ...identityConfig } = product;

    return { productPath, boundPatchFileName, product: identityConfig, outputFileName };
}

/** Resolve one patch's configuration: the single plugin.json, or the legacy sidecar + product.json pair. */
function readPatchConfig({ directoryPath, patchPath, patchFileName, legacyProduct }) {
    const configPath = patchPath.replace(/\.cmajorpatch$/, pluginConfigSuffix);
    const sidecarPath = patchPath.replace(/\.cmajorpatch$/, legacyBuildSidecarSuffix);
    const boundLegacyProduct = legacyProduct?.boundPatchFileName === patchFileName ? legacyProduct : null;

    if (fs.existsSync(configPath)) {
        if (fs.existsSync(sidecarPath)) {
            throw new Error(
                `${patchPath} has both ${path.basename(configPath)} and the legacy ${path.basename(sidecarPath)}; `
                + `fold the sidecar into ${path.basename(configPath)} and delete it.`,
            );
        }

        if (boundLegacyProduct) {
            throw new Error(
                `${patchPath} has both ${path.basename(configPath)} and the legacy ${legacyProductIdentityFileName}; `
                + `move the identity into the "product" object of ${path.basename(configPath)} and delete ${legacyProductIdentityFileName}.`,
            );
        }

        return readPluginConfig(configPath, directoryPath);
    }

    const build = readLegacyBuildSidecar(sidecarPath);

    if (boundLegacyProduct && build.productName !== undefined) {
        throw new Error(
            `${boundLegacyProduct.productPath} owns the install filename for ${patchPath} (its "outputFileName"); `
            + 'remove "productName" from the build sidecar.',
        );
    }

    return {
        configPath: fs.existsSync(sidecarPath) ? sidecarPath : boundLegacyProduct?.productPath ?? null,
        schemaVersion: null,
        legacy: fs.existsSync(sidecarPath) || Boolean(boundLegacyProduct),
        build,
        product: boundLegacyProduct?.product ?? null,
        outputFileName: boundLegacyProduct?.outputFileName,
        legacyProductPath: boundLegacyProduct?.productPath,
    };
}

function createDiscoveredPlugin({ patch, manifest, config, directoryName, patchFileName, owner, root }) {
    const { build } = config;
    const alias = build.alias ?? deriveAlias(directoryName);

    if (!sidecarKeyValidators.alias(alias))
        throw new Error(`Could not derive a usable plugin alias for ${patch}.`);

    const outputStem = alias.replaceAll("-", "_");
    const buildIdentifier = deriveBuildIdentifier(manifest, patchFileName);
    const plugin = {
        patch,
        runtimeOut: build.runtimeOut ?? `build/fx/${outputStem}_runtime`,
        juceOut: build.juceOut ?? `build/${outputStem}_juce`,
        cmakeTarget: build.cmakeTarget ?? buildIdentifier,
        productName: config.outputFileName ?? build.productName ?? buildIdentifier,
    };

    if (!isBuildIdentifier(plugin.cmakeTarget) || !isBuildIdentifier(plugin.productName))
        throw new Error(`Could not derive a build identifier for ${patch}; set cmakeTarget/productName in its ${pluginConfigSuffix} config.`);

    if (config.product !== null) {
        const configLabel = path.basename(config.legacyProductPath ?? config.configPath);
        const label = config.legacyProductPath ?? config.configPath;

        plugin.product = config.legacy
            ? config.product
            : resolveProductIdentity({ product: config.product, manifest, directoryName, alias, owner, root, label });
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

    if (build.visualReviewAdapter !== undefined)
        plugin.visualReviewAdapter = build.visualReviewAdapter;

    if (build.workerSource) {
        plugin.workerSource = build.workerSource;
        plugin.workerOut = build.workerOut ?? "worker.js";
    }

    if (build.includeInAll === false)
        plugin.includeInAll = false;

    if (isNonEmptyString(manifest?.view?.devModule))
        plugin.devModule = manifest.view.devModule;

    plugin.jitInstallRuntime = build.jitInstallRuntime ?? Boolean(plugin.workerSource);

    return { alias, plugin };
}

/** Fail closed on a config file whose name matches no patch — its settings would otherwise be silently ignored. */
function assertNoOrphanConfigs(directoryPath, fileNames, patchFileNames, suffix) {
    const claimedNames = new Set(patchFileNames.map((fileName) => fileName.replace(/\.cmajorpatch$/, suffix)));

    for (const fileName of fileNames) {
        if (fileName.endsWith(suffix) && !claimedNames.has(fileName)) {
            throw new Error(
                `${path.join(directoryPath, fileName)} matches no .cmajorpatch in its directory. `
                + `Name plugin configs <PatchName>${suffix} after the patch they configure.`,
            );
        }
    }
}

export function discoverEffectPlugins({ fxRoot = defaultFxRoot } = {}) {
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
        const fileNames = fs.readdirSync(directoryPath, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name);
        const patchFileNames = fileNames
            .filter((fileName) => fileName.endsWith(".cmajorpatch"))
            .sort();

        assertNoOrphanConfigs(directoryPath, fileNames, patchFileNames, pluginConfigSuffix);
        assertNoOrphanConfigs(directoryPath, fileNames, patchFileNames, legacyBuildSidecarSuffix);

        const legacyProduct = readLegacyProductIdentity(directoryPath, patchFileNames);

        for (const patchFileName of patchFileNames) {
            const patchPath = path.join(directoryPath, patchFileName);
            const patch = path.relative(registryRoot, patchPath).split(path.sep).join("/");
            const manifest = readManifestForDiscovery(patchPath);
            const config = readPatchConfig({ directoryPath, patchPath, patchFileName, legacyProduct });
            const { alias, plugin } = createDiscoveredPlugin({
                patch,
                manifest,
                config,
                directoryName,
                patchFileName,
                owner,
                root: registryRoot,
            });

            if (patchesByAlias.has(alias)) {
                throw new Error(
                    `Effect plugin alias "${alias}" is claimed by both ${patchesByAlias.get(alias)} and ${patch}. `
                    + `Give each patch a unique alias in its <PatchName>${pluginConfigSuffix} config.`,
                );
            }

            const claims = readManifestIdentityClaims(manifest, plugin.identity);

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
 * mapped to the claiming patch. Product.json identities and manifest-only
 * identities both count — this is what scaffolding checks new identity
 * candidates against.
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

/** Everything kit/scripts/install_fx_cmajplugin.sh needs to JIT-install one target. */
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
    const sharedLoaderPath = path.join(repoRoot, "kit/ui/effects/effect-view-loader.js");
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
