import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
    access,
    chmod,
    lstat,
    lutimes,
    mkdir,
    readFile,
    readlink,
    readdir,
    rm,
    utimes,
    writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, gzipSync, inflateSync } from "node:zlib";

import { effectPlugins, repoRoot } from "../fx/build-effect.mjs";
import {
    seqFxArtifactBaseName,
    seqFxReleaseConfig,
    unresolvedSeqFxPublicReleaseDecisions,
} from "./seqfx-release-config.mjs";
import {
    assertApprovedSeqFxReleaseToolEvidence,
    resolveSeqFxReleaseToolchain,
    seqFxReleaseSystemCommands,
} from "./seqfx-release-toolchain.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const minimumZipEpoch = 315532800;
let releaseCommandEnvironment = process.env;

export function usage(config = seqFxReleaseConfig) {
    const artifactBaseName = seqFxArtifactBaseName(config);

    return [
        "Usage:",
        "  npm run seqfx:release:plan",
        "  npm run seqfx:release:build -- [--unsigned] [--allow-dirty] [--verify-repeatable-packaging]",
        "  npm run seqfx:release:build -- --release",
        "",
        "Modes:",
        "  --plan       Read-only contract/path/decision report. It never builds or packages.",
        "  --unsigned   Build a local validation package with an ad-hoc-signed VST3 (the default).",
        "  --release    Developer ID sign, notarize, staple, and Gatekeeper-check the package.",
        "",
        "Important:",
        "  Unsigned output is never Patreon-ready.",
        "  --verify-repeatable-packaging compares two assemblies of the same freshly built ad-hoc-signed VST3.",
        "  It does not claim that two independent native builds produce identical binaries.",
        "  Developer ID timestamps and Apple notarization make signed release bytes non-reproducible.",
        "  This command never installs a plugin and never uploads or publishes an artifact.",
        "",
        "Release-only environment:",
        "  COSIMO_NOTARY_PROFILE",
        "  Approved Developer ID common names, SHA-1 fingerprints, and team IDs come from seqfx-release-config.mjs.",
        "",
        "Output:",
        `  ${config.release.outputDirectory}/${artifactBaseName}.pkg`,
        `  ${config.release.outputDirectory}/${artifactBaseName}.zip`,
        `  ${config.release.outputDirectory}/${artifactBaseName}-release-manifest.json`,
        `  ${config.release.outputDirectory}/${artifactBaseName}-checksums.txt`,
    ].join("\n");
}

export function parseReleaseArgs(argv) {
    const flags = new Set(argv.slice(2));
    const allowedFlags = new Set([
        "--allow-dirty",
        "--help",
        "--json",
        "--plan",
        "--release",
        "--unsigned",
        "--verify-repeatable-packaging",
        "-h",
    ]);

    for (const flag of flags) {
        if (!allowedFlags.has(flag))
            throw new Error(`Unknown argument: ${flag}\n\n${usage()}`);
    }

    const explicitModes = ["--plan", "--release", "--unsigned"].filter((flag) => flags.has(flag));

    if (explicitModes.length > 1)
        throw new Error(`Choose exactly one release mode, not ${explicitModes.join(", ")}.`);

    const mode = flags.has("--plan") ? "plan" : flags.has("--release") ? "release" : "unsigned";
    const options = {
        allowDirty: flags.has("--allow-dirty"),
        help: flags.has("--help") || flags.has("-h"),
        json: flags.has("--json"),
        mode,
        verifyRepeatablePackaging: flags.has("--verify-repeatable-packaging"),
    };

    if (options.mode === "release" && options.allowDirty)
        throw new Error("--release cannot be combined with --allow-dirty.");

    if (options.mode === "release" && options.verifyRepeatablePackaging) {
        throw new Error(
            "--verify-repeatable-packaging applies to unsigned packaging only; signing timestamps and notarization are intentionally variable.",
        );
    }

    if (options.mode === "plan" && (options.allowDirty || options.verifyRepeatablePackaging))
        throw new Error("--plan is read-only and cannot be combined with build/package flags.");

    if (options.json && options.mode !== "plan")
        throw new Error("--json is only valid with --plan.");

    if (options.verifyRepeatablePackaging && options.allowDirty)
        throw new Error("Packaging repeatability verification requires a clean worktree, including untracked files.");

    return options;
}

function releaseCommandPath(command) {
    if (path.isAbsolute(command))
        return command;

    const approvedPath = seqFxReleaseSystemCommands[command];

    if (!approvedPath)
        throw new Error(`SeqFX release command is not an approved absolute tool: ${command}`);

    return approvedPath;
}

function commandEnvironment(options) {
    return options.env
        ? { ...releaseCommandEnvironment, ...options.env }
        : releaseCommandEnvironment;
}

function run(command, args, options = {}) {
    const executable = releaseCommandPath(command);
    const result = spawnSync(executable, args, {
        cwd: options.cwd ?? repoRoot,
        encoding: "utf8",
        env: commandEnvironment(options),
        stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `${executable} ${args.join(" ")} failed.`);
    }

    return {
        stderr: result.stderr?.trim() ?? "",
        stdout: result.stdout?.trim() ?? "",
    };
}

function runAllowFailure(command, args, options = {}) {
    return spawnSync(releaseCommandPath(command), args, {
        cwd: options.cwd ?? repoRoot,
        encoding: "utf8",
        env: commandEnvironment(options),
        stdio: ["ignore", "pipe", "pipe"],
    });
}

function gitOutput(args, cwd = repoRoot) {
    return run("git", args, { capture: true, cwd }).stdout;
}

export function getReleaseGitState({ cwd = repoRoot } = {}) {
    const worktreeStatus = gitOutput(["status", "--porcelain", "--untracked-files=all"], cwd);

    return {
        branch: gitOutput(["branch", "--show-current"], cwd) || "(detached)",
        commit: gitOutput(["rev-parse", "HEAD"], cwd),
        dirty: Boolean(worktreeStatus),
        worktreeStatus,
    };
}

export function resolveSourceDateEpoch({ env = process.env, gitTimestamp = null } = {}) {
    const candidate = env.SOURCE_DATE_EPOCH ?? gitTimestamp;
    const parsed = Number(candidate);

    if (!Number.isInteger(parsed) || parsed < minimumZipEpoch) {
        throw new Error(
            `SOURCE_DATE_EPOCH must be an integer at or after 1980-01-01; received ${String(candidate)}.`,
        );
    }

    return parsed;
}

export function resolveSourceDateEpochEvidence({ env = process.env, gitTimestamp = null } = {}) {
    const environmentOverride = env.SOURCE_DATE_EPOCH !== undefined;

    return {
        origin: environmentOverride ? "SOURCE_DATE_EPOCH" : "source-commit-timestamp",
        sourceDateEpoch: resolveSourceDateEpoch({ env, gitTimestamp }),
    };
}

function sourceCommitTimestamp() {
    return gitOutput(["show", "-s", "--format=%ct", "HEAD"]);
}

async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

function requireUniqueCmakeField(block, field, label) {
    const values = [];

    for (const rawLine of block.split(/\r?\n/u)) {
        const line = rawLine.replace(/\s+#.*$/u, "").trim();
        const match = line.match(new RegExp(`^${field}\\s+(?:\"([^\"]+)\"|(\\S+))$`, "u"));

        if (match)
            values.push(match[1] ?? match[2]);
    }

    if (values.length !== 1)
        throw new Error(`${label} must declare exactly one ${field}; found ${values.length}.`);

    return values[0];
}

function cpmPackageBlocks(cmakeSource) {
    return [...cmakeSource.matchAll(/\bCPMAddPackage\s*\(([\s\S]*?)^\s*\)/gmu)]
        .map((match) => match[1]);
}

function declaredCpmPackage(cmakeSource, expected, label) {
    const matches = cpmPackageBlocks(cmakeSource).filter((block) => {
        try {
            return requireUniqueCmakeField(block, "NAME", label) === expected.cpmName;
        } catch {
            return false;
        }
    });

    if (matches.length !== 1) {
        throw new Error(
            `${label} must have exactly one CPMAddPackage declaration named ${expected.cpmName}; found ${matches.length}.`,
        );
    }

    const repository = requireUniqueCmakeField(matches[0], "GIT_REPOSITORY", label);
    const revision = requireUniqueCmakeField(matches[0], "GIT_TAG", label);

    if (repository !== expected.repository) {
        throw new Error(
            `${label} repository drift: expected ${expected.repository}, found ${repository}.`,
        );
    }

    if (revision !== expected.revision) {
        throw new Error(
            `${label} revision drift: expected ${expected.revision}, found ${revision}.`,
        );
    }

    return {
        cpmName: expected.cpmName,
        repository,
        revision,
    };
}

/** Read and fail closed over the production dependency declarations used by CMake. */
export async function readDeclaredNativeDependencyProvenance(
    config = seqFxReleaseConfig,
    { repositoryRoot = repoRoot } = {},
) {
    const declarationPath = config.nativeDependencies.declarationPath;
    const cmakeSource = await readFile(path.join(repositoryRoot, declarationPath), "utf8");

    return {
        schemaVersion: 1,
        declarationPath,
        cmajor: declaredCpmPackage(
            cmakeSource,
            config.nativeDependencies.cmajor,
            "Cmajor production dependency",
        ),
        choc: {
            repository: config.nativeDependencies.choc.repository,
            revision: config.nativeDependencies.choc.revision,
            submodulePath: config.nativeDependencies.choc.submodulePath,
            source: "Cmajor gitlink pinned by the declared Cmajor revision",
        },
        juce: declaredCpmPackage(
            cmakeSource,
            config.nativeDependencies.juce,
            "JUCE production dependency",
        ),
    };
}

function requireUniqueCmakeCacheValue(cacheSource, key) {
    const prefix = `${key}:`;
    const matches = cacheSource.split(/\r?\n/u)
        .filter((line) => line.startsWith(prefix))
        .map((line) => {
            const separatorIndex = line.indexOf("=");
            return separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
        });

    if (matches.length !== 1 || !matches[0])
        throw new Error(`Native CMake cache must contain exactly one non-empty ${key}; found ${matches.length}.`);

    return matches[0];
}

function assertAbsoluteCheckoutPath(checkoutPath, label) {
    if (!path.isAbsolute(checkoutPath))
        throw new Error(`${label} checkout path from CMake cache must be absolute.`);
}

function readCleanGitCheckout(checkoutPath, expectedRepository, expectedRevision, label) {
    const repository = gitOutput(["remote", "get-url", "origin"], checkoutPath);
    const revision = gitOutput(["rev-parse", "HEAD"], checkoutPath);
    const status = gitOutput([
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ], checkoutPath);

    if (repository !== expectedRepository) {
        throw new Error(
            `${label} checkout origin drift: expected ${expectedRepository}, found ${repository}.`,
        );
    }

    if (revision !== expectedRevision)
        throw new Error(`${label} checkout revision drift: expected ${expectedRevision}, found ${revision}.`);

    if (status) {
        throw new Error([
            `${label} checkout is dirty after the native build:`,
            status,
        ].join("\n"));
    }

    return {
        actualRevision: revision,
        clean: true,
        originVerified: true,
    };
}

function parseGitmodulesEntry(source, submodulePath) {
    const entries = [];
    let current = null;

    for (const rawLine of source.split(/\r?\n/u)) {
        const section = rawLine.match(/^\s*\[submodule\s+"([^"]+)"\]\s*$/u);

        if (section) {
            current = { name: section[1] };
            entries.push(current);
            continue;
        }

        const property = rawLine.match(/^\s*(path|url)\s*=\s*(\S.*?)\s*$/u);

        if (current && property)
            current[property[1]] = property[2];
    }

    const matches = entries.filter((entry) => entry.path === submodulePath);

    if (matches.length !== 1 || !matches[0].url) {
        throw new Error(
            `Cmajor must declare exactly one ${submodulePath} submodule with a URL; found ${matches.length}.`,
        );
    }

    return matches[0];
}

/** Verify the exact clean CPM checkouts selected by the completed native configure/build. */
export async function captureActualNativeDependencyProvenance(
    config = seqFxReleaseConfig,
    { repositoryRoot = repoRoot } = {},
) {
    const cachePath = path.join(repositoryRoot, config.paths.nativeBuildCmakeCache);
    const cacheSource = await readFile(cachePath, "utf8");
    const expectedCmakeHome = path.join(repositoryRoot, "tools", "effect_plugin_build");
    const actualCmakeHome = requireUniqueCmakeCacheValue(cacheSource, "CMAKE_HOME_DIRECTORY");

    if (path.resolve(actualCmakeHome) !== path.resolve(expectedCmakeHome)) {
        throw new Error(
            `Native CMake cache belongs to ${actualCmakeHome}, expected ${expectedCmakeHome}.`,
        );
    }

    const cmajorPath = requireUniqueCmakeCacheValue(
        cacheSource,
        config.nativeDependencies.cmajor.sourceDirectoryCacheKey,
    );
    const jucePath = requireUniqueCmakeCacheValue(
        cacheSource,
        config.nativeDependencies.juce.sourceDirectoryCacheKey,
    );
    assertAbsoluteCheckoutPath(cmajorPath, "Cmajor");
    assertAbsoluteCheckoutPath(jucePath, "JUCE");

    const cmajor = readCleanGitCheckout(
        cmajorPath,
        config.nativeDependencies.cmajor.repository,
        config.nativeDependencies.cmajor.revision,
        "Cmajor",
    );
    const juce = readCleanGitCheckout(
        jucePath,
        config.nativeDependencies.juce.repository,
        config.nativeDependencies.juce.revision,
        "JUCE",
    );
    const chocPath = path.resolve(cmajorPath, config.nativeDependencies.choc.submodulePath);
    const relativeChocPath = path.relative(cmajorPath, chocPath);

    if (relativeChocPath.startsWith(`..${path.sep}`) || path.isAbsolute(relativeChocPath))
        throw new Error("CHOC submodule path escapes the Cmajor checkout.");

    const gitlink = gitOutput([
        "ls-tree",
        config.nativeDependencies.cmajor.revision,
        "--",
        config.nativeDependencies.choc.submodulePath,
    ], cmajorPath);
    const gitlinkMatch = gitlink.match(/^160000 commit ([0-9a-f]{40})\t(.+)$/u);

    if (!gitlinkMatch || gitlinkMatch[2] !== config.nativeDependencies.choc.submodulePath) {
        throw new Error(
            `Cmajor revision does not contain the expected ${config.nativeDependencies.choc.submodulePath} gitlink.`,
        );
    }

    if (gitlinkMatch[1] !== config.nativeDependencies.choc.revision) {
        throw new Error(
            `Cmajor CHOC gitlink drift: expected ${config.nativeDependencies.choc.revision}, found ${gitlinkMatch[1]}.`,
        );
    }

    const gitmodulesSource = gitOutput([
        "show",
        `${config.nativeDependencies.cmajor.revision}:.gitmodules`,
    ], cmajorPath);
    const chocDeclaration = parseGitmodulesEntry(
        gitmodulesSource,
        config.nativeDependencies.choc.submodulePath,
    );

    if (chocDeclaration.url !== config.nativeDependencies.choc.repository) {
        throw new Error(
            `Cmajor CHOC repository drift: expected ${config.nativeDependencies.choc.repository}, found ${chocDeclaration.url}.`,
        );
    }

    const choc = readCleanGitCheckout(
        chocPath,
        config.nativeDependencies.choc.repository,
        config.nativeDependencies.choc.revision,
        "CHOC",
    );

    return {
        schemaVersion: 1,
        cmakeCachePath: config.paths.nativeBuildCmakeCache,
        declarationPath: config.nativeDependencies.declarationPath,
        cmajor: {
            repository: config.nativeDependencies.cmajor.repository,
            declaredRevision: config.nativeDependencies.cmajor.revision,
            ...cmajor,
            sourceDirectoryCacheKey: config.nativeDependencies.cmajor.sourceDirectoryCacheKey,
        },
        choc: {
            repository: chocDeclaration.url,
            declaredRevision: config.nativeDependencies.choc.revision,
            ...choc,
            gitlinkRevision: gitlinkMatch[1],
            submodulePath: config.nativeDependencies.choc.submodulePath,
        },
        juce: {
            repository: config.nativeDependencies.juce.repository,
            declaredRevision: config.nativeDependencies.juce.revision,
            ...juce,
            sourceDirectoryCacheKey: config.nativeDependencies.juce.sourceDirectoryCacheKey,
        },
    };
}

/** Prove the completed native configure used the already-attested CMake/cmaj executables. */
export async function assertNativeBuildUsedReleaseToolchain(
    config,
    expectedTools,
    { repositoryRoot = repoRoot } = {},
) {
    const cachePath = path.join(repositoryRoot, config.paths.nativeBuildCmakeCache);
    const cacheSource = await readFile(cachePath, "utf8");
    const observedCmake = requireUniqueCmakeCacheValue(cacheSource, "CMAKE_COMMAND");
    const observedCmaj = requireUniqueCmakeCacheValue(cacheSource, "COSIMO_CMAJ_EXECUTABLE");

    if (observedCmake !== expectedTools.cmake) {
        throw new Error(
            `CMake executable drift: expected ${expectedTools.cmake}, found ${observedCmake}.`,
        );
    }

    if (observedCmaj !== expectedTools.cmaj) {
        throw new Error(
            `cmaj executable drift: expected ${expectedTools.cmaj}, found ${observedCmaj}.`,
        );
    }
}

function expectedBuiltVst3Path(plugin) {
    return path.join(
        plugin.juceOut,
        "_build",
        "plugin",
        `${plugin.cmakeTarget}_artefacts`,
        "Release",
        "VST3",
        `${plugin.productName}.vst3`,
    );
}

export function releaseContractErrors(
    config,
    patchManifest,
    plugin = effectPlugins[config.productKey],
) {
    const errors = [];
    const requiredStrings = [
        ["identity.publicName", config.identity.publicName],
        ["identity.bundleName", config.identity.bundleName],
        ["identity.manufacturer", config.identity.manufacturer],
        ["identity.patchId", config.identity.patchId],
        ["identity.pluginCode", config.identity.pluginCode],
        ["identity.manufacturerCode", config.identity.manufacturerCode],
        ["identity.pluginVersion", config.identity.pluginVersion],
        ["identity.installerIdentifier", config.identity.installerIdentifier],
        ["release.channelVersion", config.release.channelVersion],
        ["release.outputDirectory", config.release.outputDirectory],
        ["paths.patchManifest", config.paths.patchManifest],
        ["paths.thirdPartyNotices", config.paths.thirdPartyNotices],
        ["paths.builtVst3", config.paths.builtVst3],
        ["paths.nativeBuildCmakeCache", config.paths.nativeBuildCmakeCache],
        ["paths.installedVst3", config.paths.installedVst3],
        ["nativeDependencies.declarationPath", config.nativeDependencies.declarationPath],
        ["nativeDependencies.cmajor.repository", config.nativeDependencies.cmajor.repository],
        ["nativeDependencies.cmajor.revision", config.nativeDependencies.cmajor.revision],
        ["nativeDependencies.choc.repository", config.nativeDependencies.choc.repository],
        ["nativeDependencies.choc.revision", config.nativeDependencies.choc.revision],
        ["nativeDependencies.choc.submodulePath", config.nativeDependencies.choc.submodulePath],
        ["nativeDependencies.juce.repository", config.nativeDependencies.juce.repository],
        ["nativeDependencies.juce.revision", config.nativeDependencies.juce.revision],
        ["nativeMetadata.bundlePackageType", config.nativeMetadata.bundlePackageType],
        ["nativeMetadata.vst3Category", config.nativeMetadata.vst3Category],
        ["nativeMetadata.audioClass.category", config.nativeMetadata.audioClass.category],
        ["nativeMetadata.audioClass.cid", config.nativeMetadata.audioClass.cid],
        ["nativeMetadata.controllerClass.category", config.nativeMetadata.controllerClass.category],
        ["nativeMetadata.controllerClass.cid", config.nativeMetadata.controllerClass.cid],
    ];

    for (const [label, value] of requiredStrings) {
        if (typeof value !== "string" || !value.trim())
            errors.push(`${label} must be a non-empty string.`);
    }

    if (!plugin) {
        errors.push(`fx/build-effect.mjs has no ${config.productKey} registry entry.`);
        return errors;
    }

    const comparisons = [
        ["patch ID", patchManifest.ID, config.identity.patchId],
        ["patch version", patchManifest.version, config.identity.pluginVersion],
        ["patch name", patchManifest.name, config.identity.publicName],
        ["patch manufacturer", patchManifest.manufacturer, config.identity.manufacturer],
        ["plugin code", patchManifest.plugin?.pluginCode, config.identity.pluginCode],
        ["manufacturer code", patchManifest.plugin?.manufacturerCode, config.identity.manufacturerCode],
        ["registry patch path", plugin.patch, config.paths.patchManifest],
        ["registry product name", plugin.productName, config.identity.bundleName],
        ["registry microphone permission", plugin.disableMicrophonePermission, true],
        ["native build path", expectedBuiltVst3Path(plugin), config.paths.builtVst3],
    ];

    for (const [label, observed, expected] of comparisons) {
        if (observed !== expected)
            errors.push(`${label} drift: expected ${JSON.stringify(expected)}, found ${JSON.stringify(observed)}.`);
    }

    const expectedArtifactPrefix = `${config.identity.bundleName}-${config.release.channelVersion}`;

    if (!seqFxArtifactBaseName(config).startsWith(expectedArtifactPrefix))
        errors.push(`Artifact name must begin with ${expectedArtifactPrefix}.`);

    if (!config.release.outputDirectory.endsWith(`/${config.release.channelVersion}`)) {
        errors.push(
            `release.outputDirectory must end with /${config.release.channelVersion}.`,
        );
    }

    if (patchManifest.category !== "effect")
        errors.push(`SeqFX patch category must be "effect", found ${JSON.stringify(patchManifest.category)}.`);

    if (patchManifest.isInstrument !== false)
        errors.push("SeqFX patch must declare isInstrument: false.");

    return errors;
}

export function assertReleaseContract(config, patchManifest, plugin) {
    const errors = releaseContractErrors(config, patchManifest, plugin);

    if (errors.length > 0)
        throw new Error(["SeqFX release contract drifted:", ...errors.map((error) => `- ${error}`)].join("\n"));
}

function assertDeclaredNativeDependencyProvenance(config, provenance) {
    const checks = [
        ["schema version", provenance?.schemaVersion, 1],
        ["declaration path", provenance?.declarationPath, config.nativeDependencies.declarationPath],
        ["Cmajor CPM name", provenance?.cmajor?.cpmName, config.nativeDependencies.cmajor.cpmName],
        ["Cmajor repository", provenance?.cmajor?.repository, config.nativeDependencies.cmajor.repository],
        ["Cmajor revision", provenance?.cmajor?.revision, config.nativeDependencies.cmajor.revision],
        ["CHOC repository", provenance?.choc?.repository, config.nativeDependencies.choc.repository],
        ["CHOC revision", provenance?.choc?.revision, config.nativeDependencies.choc.revision],
        ["CHOC submodule path", provenance?.choc?.submodulePath, config.nativeDependencies.choc.submodulePath],
        ["JUCE repository", provenance?.juce?.repository, config.nativeDependencies.juce.repository],
        ["JUCE CPM name", provenance?.juce?.cpmName, config.nativeDependencies.juce.cpmName],
        ["JUCE revision", provenance?.juce?.revision, config.nativeDependencies.juce.revision],
    ];
    const errors = checks
        .filter(([, observed, expected]) => observed !== expected)
        .map(([label, observed, expected]) => (
            `${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(observed)}`
        ));

    if (errors.length > 0) {
        throw new Error([
            "SeqFX declared native dependency provenance is incomplete or drifted:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

function assertActualNativeDependencyProvenance(config, provenance) {
    const checks = [
        ["schema version", provenance?.schemaVersion, 1],
        ["CMake cache path", provenance?.cmakeCachePath, config.paths.nativeBuildCmakeCache],
        ["declaration path", provenance?.declarationPath, config.nativeDependencies.declarationPath],
        ["Cmajor repository", provenance?.cmajor?.repository, config.nativeDependencies.cmajor.repository],
        ["Cmajor declared revision", provenance?.cmajor?.declaredRevision, config.nativeDependencies.cmajor.revision],
        ["Cmajor actual revision", provenance?.cmajor?.actualRevision, config.nativeDependencies.cmajor.revision],
        ["Cmajor cleanliness", provenance?.cmajor?.clean, true],
        ["Cmajor origin verification", provenance?.cmajor?.originVerified, true],
        [
            "Cmajor source-directory cache key",
            provenance?.cmajor?.sourceDirectoryCacheKey,
            config.nativeDependencies.cmajor.sourceDirectoryCacheKey,
        ],
        ["CHOC repository", provenance?.choc?.repository, config.nativeDependencies.choc.repository],
        ["CHOC declared revision", provenance?.choc?.declaredRevision, config.nativeDependencies.choc.revision],
        ["CHOC gitlink revision", provenance?.choc?.gitlinkRevision, config.nativeDependencies.choc.revision],
        ["CHOC actual revision", provenance?.choc?.actualRevision, config.nativeDependencies.choc.revision],
        ["CHOC cleanliness", provenance?.choc?.clean, true],
        ["CHOC origin verification", provenance?.choc?.originVerified, true],
        ["CHOC submodule path", provenance?.choc?.submodulePath, config.nativeDependencies.choc.submodulePath],
        ["JUCE repository", provenance?.juce?.repository, config.nativeDependencies.juce.repository],
        ["JUCE declared revision", provenance?.juce?.declaredRevision, config.nativeDependencies.juce.revision],
        ["JUCE actual revision", provenance?.juce?.actualRevision, config.nativeDependencies.juce.revision],
        ["JUCE cleanliness", provenance?.juce?.clean, true],
        ["JUCE origin verification", provenance?.juce?.originVerified, true],
        [
            "JUCE source-directory cache key",
            provenance?.juce?.sourceDirectoryCacheKey,
            config.nativeDependencies.juce.sourceDirectoryCacheKey,
        ],
    ];
    const errors = checks
        .filter(([, observed, expected]) => observed !== expected)
        .map(([label, observed, expected]) => (
            `${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(observed)}`
        ));

    if (errors.length > 0) {
        throw new Error([
            "SeqFX actual native dependency provenance is incomplete or drifted:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

export function createReleasePlan({
    config = seqFxReleaseConfig,
    declaredNativeDependencies,
    gitState,
    mode = "plan",
    releaseToolchain,
    sourceDateEpoch,
} = {}) {
    const artifactBaseName = seqFxArtifactBaseName(config);
    const decisionGates = unresolvedSeqFxPublicReleaseDecisions(config);
    assertDeclaredNativeDependencyProvenance(config, declaredNativeDependencies);
    assertReleaseToolchainAttestation(releaseToolchain, { requireNativeBuildCache: false });

    return {
        schemaVersion: 3,
        mode,
        product: config.identity.publicName,
        releaseVersion: config.release.channelVersion,
        source: {
            branch: gitState.branch,
            commit: gitState.commit,
            worktreeDirty: gitState.dirty,
            sourceDateEpoch,
        },
        scope: config.scope,
        identity: config.identity,
        releaseToolchain,
        nativeDependencyProvenance: {
            declared: declaredNativeDependencies,
            postBuildVerification: {
                actualCheckoutsRecordedInReleaseManifest: true,
                cmakeCachePath: config.paths.nativeBuildCmakeCache,
                cleanlinessRequired: true,
                requiredBeforePackaging: true,
            },
        },
        paths: {
            builtVst3: config.paths.builtVst3,
            outputDirectory: config.release.outputDirectory,
            pkg: `${config.release.outputDirectory}/${artifactBaseName}.pkg`,
            zip: `${config.release.outputDirectory}/${artifactBaseName}.zip`,
        },
        commands: {
            nativeBuild: `npm run fx:prod:build -- ${config.productKey} --clean`,
            unsignedPackage: "npm run seqfx:release:build -- --unsigned --verify-repeatable-packaging",
            signedRelease: "npm run seqfx:release:build -- --release",
        },
        repeatability: {
            deterministicBoundary: "two packaging assemblies of one freshly built ad-hoc-signed VST3 payload plus package and zip",
            independentNativeBuildsCompared: false,
            signedArtifactBytesReproducible: false,
            reasonSignedBytesDiffer: "Developer ID secure timestamps and Apple notarization tickets are external time-varying attestations.",
        },
        publicReleaseDecisionGates: decisionGates,
        publicReleaseBlocked: decisionGates.length > 0,
        sideEffects: mode === "plan" ? [] : [
            "builds a fresh native VST3 from the recorded clean source commit",
            "replaces the configured release output directory",
            ...(mode === "release" ? ["signs, submits to Apple notarization, staples, and assesses the package"] : []),
        ],
        explicitlyNeverPerformed: [
            "plugin installation",
            "DAW launch or host acceptance",
            "Patreon upload",
            "publication or deployment",
        ],
    };
}

function printPlan(plan, { json = false } = {}) {
    if (json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
    }

    console.log(`${plan.product} ${plan.releaseVersion} release plan`);
    console.log(`Built VST3: ${plan.paths.builtVst3}`);
    console.log(`Unsigned output: ${plan.paths.zip}`);
    console.log(`Worktree: ${plan.source.worktreeDirty ? "dirty" : "clean"}`);
    console.log(`Cmajor: ${plan.nativeDependencyProvenance.declared.cmajor.revision}`);
    console.log(`CHOC: ${plan.nativeDependencyProvenance.declared.choc.revision}`);
    console.log(`JUCE: ${plan.nativeDependencyProvenance.declared.juce.revision}`);
    console.log("Native packaging requires the post-build CMake-selected checkouts to match these revisions and remain clean.");
    console.log("Repeatability: two unsigned packaging assemblies of one fresh native build; independent native-build reproducibility is not claimed.");

    if (plan.publicReleaseDecisionGates.length > 0) {
        console.log("Public release decisions still required:");
        for (const gate of plan.publicReleaseDecisionGates)
            console.log(`- ${gate.id}: ${gate.decision}`);
    }

    console.log("Plan mode made no filesystem, build, signing, install, upload, or deployment changes.");
}

function assertWorktreePolicy(gitState, options) {
    if (gitState.dirty && !options.allowDirty) {
        throw new Error([
            `${options.mode === "release" ? "Release" : "Unsigned repeatability"} packaging requires a clean worktree, including untracked files.`,
            "Use --allow-dirty only for a local unsigned validation artifact.",
            "",
            gitState.worktreeStatus,
        ].join("\n"));
    }
}

export function assertSourceStateUnchanged(beforeBuild, afterBuild, { phase = "native build" } = {}) {
    if (beforeBuild && afterBuild
        && beforeBuild.commit === afterBuild.commit
        && beforeBuild?.worktreeStatus === afterBuild?.worktreeStatus) {
        return;
    }

    throw new Error([
        `SeqFX source state changed before ${phase}; refusing to attach stale provenance to the artifact.`,
        `Before: ${beforeBuild?.commit ?? "(missing)"} ${beforeBuild?.worktreeStatus || "(clean)"}`,
        `After: ${afterBuild?.commit ?? "(missing)"} ${afterBuild?.worktreeStatus || "(clean)"}`,
    ].join("\n"));
}

function combinedProcessOutput(result) {
    return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function parseInstalledSigningIdentities(output) {
    const identities = [];

    for (const line of output.split(/\r?\n/u)) {
        const match = line.match(/^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"([^"]+)"\s*$/u);

        if (!match)
            continue;

        const commonName = match[2];
        const teamMatch = commonName.match(/\(([A-Z0-9]{10})\)$/u);

        identities.push({
            commonName,
            sha1Fingerprint: match[1].toUpperCase(),
            teamIdentifier: teamMatch?.[1] ?? null,
        });
    }

    return identities;
}

export function selectApprovedSigningIdentity(approvedIdentity, output, label) {
    const expected = {
        commonName: approvedIdentity?.commonName ?? null,
        sha1Fingerprint: approvedIdentity?.sha1Fingerprint?.toUpperCase() ?? null,
        teamIdentifier: approvedIdentity?.teamIdentifier ?? null,
    };
    const selected = parseInstalledSigningIdentities(output).find(
        (identity) => identity.commonName === expected.commonName
            && identity.sha1Fingerprint === expected.sha1Fingerprint
            && identity.teamIdentifier === expected.teamIdentifier,
    );

    if (!selected) {
        throw new Error(
            `Could not find the exact approved ${label} signing identity, fingerprint, and team.`,
        );
    }

    return selected;
}

function outputField(output, prefix) {
    return output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => line.startsWith(prefix))
        ?.slice(prefix.length)
        .trim() ?? null;
}

export function parseVst3SigningEvidence(output, approvedIdentity) {
    const identity = outputField(output, "Authority=");
    const teamIdentifier = outputField(output, "TeamIdentifier=");
    const timestamp = outputField(output, "Timestamp=");

    if (!identity?.startsWith("Developer ID Application: ")
        || identity !== approvedIdentity.commonName) {
        throw new Error("VST3 signature does not use the exact approved VST3 signing identity.");
    }

    if (teamIdentifier !== approvedIdentity.teamIdentifier)
        throw new Error("VST3 signature does not use the exact approved VST3 signing team.");

    if (!timestamp || /^none$/iu.test(timestamp))
        throw new Error("VST3 signature does not contain secure timestamp evidence.");

    return {
        identity,
        signedWithDeveloperId: true,
        teamIdentifier,
        timestamp,
    };
}

export function parseInstallerSigningEvidence(output, approvedIdentity) {
    const certificateLine = output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /^1\.\s+/u.test(line));
    const identity = certificateLine?.replace(/^1\.\s+/u, "") ?? null;
    const teamIdentifier = identity?.match(/\(([A-Z0-9]{10})\)$/u)?.[1] ?? null;
    const timestamp = output.match(
        /^\s*Signed with a trusted timestamp on:\s*(.+?)\s*$/imu,
    )?.[1] ?? null;
    const fingerprint = output.match(
        /^\s*SHA1 fingerprint:\s*([A-Fa-f0-9 :]+?)\s*$/imu,
    )?.[1].replace(/[\s:]/gu, "").toUpperCase() ?? null;

    if (!/^\s*Status:\s+signed by (?:a developer certificate issued by Apple for distribution|a certificate trusted by (?:Mac OS X|macOS))\s*$/imu.test(output))
        throw new Error("Installer signature verification did not report a trusted signed package.");

    if (!identity?.startsWith("Developer ID Installer: ")
        || identity !== approvedIdentity.commonName) {
        throw new Error("Installer signature does not use the exact approved installer signing identity.");
    }

    if (teamIdentifier !== approvedIdentity.teamIdentifier)
        throw new Error("Installer signature does not use the exact approved installer signing team.");

    if (fingerprint && fingerprint !== approvedIdentity.sha1Fingerprint.toUpperCase())
        throw new Error("Installer signature fingerprint does not match the approved certificate.");

    if (!timestamp)
        throw new Error("Installer signature does not contain secure timestamp evidence.");

    return {
        identity,
        signedWithDeveloperId: true,
        teamIdentifier,
        timestamp,
    };
}

function assertSignedReleasePrerequisites(config, gitState) {
    const errors = unresolvedSeqFxPublicReleaseDecisions(config).map(
        (gate) => `${gate.id}: ${gate.decision}`,
    );
    const notaryProfile = process.env.COSIMO_NOTARY_PROFILE;

    if (gitState.dirty)
        errors.push("worktree is dirty, including tracked or untracked files");

    for (const [label, identity] of [
        ["application", config.signing?.application],
        ["installer", config.signing?.installer],
    ]) {
        const expectedPrefix = label === "application"
            ? "Developer ID Application: "
            : "Developer ID Installer: ";

        if (!identity?.commonName)
            errors.push(`${label} signing common name is not approved`);
        else if (!identity.commonName.startsWith(expectedPrefix))
            errors.push(`${label} signing common name is not a Developer ID ${label} identity`);

        if (!identity?.sha1Fingerprint)
            errors.push(`${label} signing SHA-1 fingerprint is not approved`);

        if (!identity?.teamIdentifier)
            errors.push(`${label} signing team identifier is not approved`);
    }

    if (!notaryProfile)
        errors.push("COSIMO_NOTARY_PROFILE is not set");

    if (errors.length > 0)
        throw new Error(["Signed SeqFX release cannot continue:", ...errors.map((error) => `- ${error}`)].join("\n"));

    const codeSigningResult = runAllowFailure("security", ["find-identity", "-v", "-p", "codesigning"]);
    const allSigningResult = runAllowFailure("security", ["find-identity", "-v"]);
    const codeSigningOutput = combinedProcessOutput(codeSigningResult);
    const allSigningOutput = combinedProcessOutput(allSigningResult);

    if (codeSigningResult.status !== 0)
        throw new Error(codeSigningOutput || "Could not list macOS code-signing identities.");

    if (allSigningResult.status !== 0)
        throw new Error(allSigningOutput || "Could not list macOS signing identities.");

    const application = selectApprovedSigningIdentity(
        config.signing.application,
        codeSigningOutput,
        "application",
    );
    const installer = selectApprovedSigningIdentity(
        config.signing.installer,
        allSigningOutput,
        "installer",
    );

    run("xcrun", [
        "notarytool",
        "history",
        "--keychain-profile",
        notaryProfile,
        "--output-format",
        "json",
    ], { capture: true });

    return {
        application,
        installer,
        notaryProfile,
    };
}

function binaryContainsString(binaryPath, marker) {
    const result = runAllowFailure("grep", ["-a", "-F", "-q", marker, binaryPath]);

    if (result.status === 0)
        return true;

    if (result.status === 1)
        return false;

    throw new Error(combinedProcessOutput(result) || `grep failed while checking ${binaryPath}`);
}

function verifyPatchedWebView(config, binaryPath) {
    const missing = config.webViewMarkers.required.filter((marker) => !binaryContainsString(binaryPath, marker));
    const forbidden = config.webViewMarkers.forbidden.filter((marker) => binaryContainsString(binaryPath, marker));

    if (missing.length > 0)
        throw new Error(`VST3 binary is missing patched CHOC marker(s): ${missing.join(", ")}`);

    if (forbidden.length > 0)
        throw new Error(`VST3 binary contains retired keyboard marker(s): ${forbidden.join(", ")}`);
}

function verifyCodesign(vst3Path) {
    run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", vst3Path], { capture: true });
}

function binaryArchitectures(config, binaryPath) {
    const { stdout } = run("lipo", ["-archs", binaryPath], { capture: true });
    const observed = stdout.split(/\s+/u).filter(Boolean).sort();

    for (const requiredArchitecture of config.scope.architectures) {
        if (!observed.includes(requiredArchitecture))
            throw new Error(`VST3 binary is missing ${requiredArchitecture}; lipo reported: ${stdout}`);
    }

    return observed;
}

function parseJsonWithTrailingCommas(source, label) {
    let normalized = "";
    let escaped = false;
    let inString = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (inString) {
            normalized += character;

            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }

            continue;
        }

        if (character === '"') {
            inString = true;
            normalized += character;
            continue;
        }

        if (character === ",") {
            let nextIndex = index + 1;

            while (/\s/u.test(source[nextIndex] ?? ""))
                nextIndex += 1;

            if (source[nextIndex] === "}" || source[nextIndex] === "]")
                continue;
        }

        normalized += character;
    }

    try {
        return JSON.parse(normalized);
    } catch (error) {
        throw new Error(`${label} is not parseable JSON metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function microphoneMetadataPaths(value, currentPath = "metadata") {
    if (typeof value === "string")
        return /microphone/iu.test(value) ? [currentPath] : [];

    if (!value || typeof value !== "object")
        return [];

    const paths = [];

    for (const [key, nestedValue] of Object.entries(value)) {
        const nestedPath = `${currentPath}.${key}`;

        if (/microphone/iu.test(key))
            paths.push(nestedPath);

        paths.push(...microphoneMetadataPaths(nestedValue, nestedPath));
    }

    return paths;
}

function exactMetadataValue(errors, label, observed, expected) {
    if (observed !== expected)
        errors.push(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(observed)}`);
}

function expectedVst3MetadataSummary(config) {
    return {
        audioClassId: config.nativeMetadata.audioClass.cid,
        binary: path.posix.join("Contents", "MacOS", config.identity.bundleName),
        bundleIdentifier: config.identity.patchId,
        bundlePackageType: config.nativeMetadata.bundlePackageType,
        category: config.nativeMetadata.vst3Category,
        controllerClassId: config.nativeMetadata.controllerClass.cid,
        microphonePermissionAbsent: true,
        name: config.identity.bundleName,
        vendor: config.identity.manufacturer,
        version: config.identity.pluginVersion,
    };
}

function exactRecordMatches(observed, expected) {
    if (!observed || typeof observed !== "object" || Array.isArray(observed))
        return false;

    const observedKeys = Object.keys(observed).sort();
    const expectedKeys = Object.keys(expected).sort();

    return JSON.stringify(observedKeys) === JSON.stringify(expectedKeys)
        && expectedKeys.every((key) => observed[key] === expected[key]);
}

function assertVst3MetadataAttestation(config, attestation) {
    const expected = expectedVst3MetadataSummary(config);
    const errors = [];

    if (!exactRecordMatches(attestation?.built, expected))
        errors.push(`built metadata does not match the release contract: ${JSON.stringify(attestation?.built)}`);

    if (!exactRecordMatches(attestation?.staged, expected))
        errors.push(`staged metadata does not match the release contract: ${JSON.stringify(attestation?.staged)}`);

    if (attestation?.stagedMatchesBuilt !== true)
        errors.push("staged metadata was not proven identical to built metadata");

    if (errors.length > 0)
        throw new Error(["SeqFX VST3 metadata attestation rejected:", ...errors.map((error) => `- ${error}`)].join("\n"));
}

function validateModuleClass(errors, moduleClass, expected, config, label) {
    if (!moduleClass || typeof moduleClass !== "object" || Array.isArray(moduleClass)) {
        errors.push(`${label} must be an object.`);
        return;
    }

    exactMetadataValue(errors, `${label} CID`, moduleClass.CID, expected.cid);
    exactMetadataValue(errors, `${label} category`, moduleClass.Category, expected.category);
    exactMetadataValue(errors, `${label} name`, moduleClass.Name, config.identity.bundleName);
    exactMetadataValue(errors, `${label} vendor`, moduleClass.Vendor, config.identity.manufacturer);
    exactMetadataValue(errors, `${label} version`, moduleClass.Version, config.identity.pluginVersion);

    if (!Array.isArray(moduleClass["Sub Categories"])
        || moduleClass["Sub Categories"].length !== 1
        || moduleClass["Sub Categories"][0] !== config.nativeMetadata.vst3Category) {
        errors.push(
            `${label} sub-categories: expected [${JSON.stringify(config.nativeMetadata.vst3Category)}], `
            + `found ${JSON.stringify(moduleClass["Sub Categories"])}`,
        );
    }
}

/** Parse and fail closed over one built or staged SeqFX VST3 metadata boundary. */
export async function verifyVst3Metadata(config, vst3Path) {
    const contentsPath = path.join(vst3Path, "Contents");
    const infoPlistPath = path.join(contentsPath, "Info.plist");
    const moduleInfoPath = path.join(contentsPath, "Resources", "moduleinfo.json");
    const binaryRelativePath = path.posix.join("Contents", "MacOS", config.identity.bundleName);
    const binaryPath = path.join(vst3Path, ...binaryRelativePath.split("/"));
    const plistResult = run("plutil", ["-convert", "json", "-o", "-", infoPlistPath], {
        capture: true,
    });
    const infoPlist = JSON.parse(plistResult.stdout);
    const moduleInfo = parseJsonWithTrailingCommas(
        await readFile(moduleInfoPath, "utf8"),
        path.basename(moduleInfoPath),
    );
    const errors = [];

    exactMetadataValue(errors, "CFBundleDisplayName", infoPlist.CFBundleDisplayName, config.identity.bundleName);
    exactMetadataValue(errors, "CFBundleExecutable", infoPlist.CFBundleExecutable, config.identity.bundleName);
    exactMetadataValue(errors, "CFBundleIdentifier", infoPlist.CFBundleIdentifier, config.identity.patchId);
    exactMetadataValue(errors, "CFBundleName", infoPlist.CFBundleName, config.identity.bundleName);
    exactMetadataValue(errors, "CFBundlePackageType", infoPlist.CFBundlePackageType, config.nativeMetadata.bundlePackageType);
    exactMetadataValue(
        errors,
        "CFBundleShortVersionString",
        infoPlist.CFBundleShortVersionString,
        config.identity.pluginVersion,
    );
    exactMetadataValue(errors, "CFBundleVersion", infoPlist.CFBundleVersion, config.identity.pluginVersion);
    exactMetadataValue(errors, "module name", moduleInfo?.Name, config.identity.bundleName);
    exactMetadataValue(errors, "module version", moduleInfo?.Version, config.identity.pluginVersion);
    exactMetadataValue(
        errors,
        "module vendor",
        moduleInfo?.["Factory Info"]?.Vendor,
        config.identity.manufacturer,
    );

    const moduleClasses = moduleInfo?.Classes;

    if (!Array.isArray(moduleClasses) || moduleClasses.length !== 2) {
        errors.push(`module classes: expected exactly 2, found ${Array.isArray(moduleClasses) ? moduleClasses.length : "non-array"}`);
    } else {
        const audioClasses = moduleClasses.filter(
            (moduleClass) => moduleClass?.Category === config.nativeMetadata.audioClass.category,
        );
        const controllerClasses = moduleClasses.filter(
            (moduleClass) => moduleClass?.Category === config.nativeMetadata.controllerClass.category,
        );

        if (audioClasses.length !== 1)
            errors.push(`audio module classes: expected exactly 1, found ${audioClasses.length}`);
        else
            validateModuleClass(errors, audioClasses[0], config.nativeMetadata.audioClass, config, "audio module class");

        if (controllerClasses.length !== 1)
            errors.push(`controller module classes: expected exactly 1, found ${controllerClasses.length}`);
        else
            validateModuleClass(errors, controllerClasses[0], config.nativeMetadata.controllerClass, config, "controller module class");
    }

    const microphonePaths = [
        ...microphoneMetadataPaths(infoPlist, "Info.plist"),
        ...microphoneMetadataPaths(moduleInfo, "moduleinfo.json"),
    ];

    if (microphonePaths.length > 0)
        errors.push(`microphone permission or usage text is forbidden: ${microphonePaths.join(", ")}`);

    try {
        const binaryStat = await lstat(binaryPath);

        if (!binaryStat.isFile())
            errors.push(`VST3 binary is not a regular file: ${binaryRelativePath}`);
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
            errors.push(`VST3 binary is missing: ${binaryRelativePath}`);
        else
            throw error;
    }

    if (errors.length > 0) {
        throw new Error([
            `SeqFX VST3 metadata rejected at ${vst3Path}:`,
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }

    return expectedVst3MetadataSummary(config);
}

export async function attestMatchingVst3Metadata(config, builtVst3Path, stagedVst3Path) {
    const built = await verifyVst3Metadata(config, builtVst3Path);
    const staged = await verifyVst3Metadata(config, stagedVst3Path);
    const stagedMatchesBuilt = JSON.stringify(staged) === JSON.stringify(built);

    if (!stagedMatchesBuilt)
        throw new Error("Staged SeqFX VST3 metadata differs from the source-built bundle.");

    return {
        built,
        staged,
        stagedMatchesBuilt,
    };
}

async function verifyBuiltVst3(config) {
    const vst3Path = path.join(repoRoot, config.paths.builtVst3);
    const binaryPath = path.join(vst3Path, "Contents", "MacOS", config.identity.bundleName);

    if (!await pathExists(vst3Path))
        throw new Error(`Built VST3 bundle not found: ${config.paths.builtVst3}`);

    if (!await pathExists(binaryPath))
        throw new Error(`Built VST3 binary not found: ${path.relative(repoRoot, binaryPath)}`);

    verifyCodesign(vst3Path);
    verifyPatchedWebView(config, binaryPath);
    await verifyVst3Metadata(config, vst3Path);

    return {
        architectures: binaryArchitectures(config, binaryPath),
        artifactEvidence: await captureVst3ArtifactEvidence(config, vst3Path),
        binaryPath,
        vst3Path,
    };
}

function copyPathWithoutMetadata(sourcePath, destinationPath) {
    run("ditto", [
        "--norsrc",
        "--noextattr",
        "--noqtn",
        "--noacl",
        sourcePath,
        destinationPath,
    ], { capture: true, env: { COPYFILE_DISABLE: "1" } });
}

function clearExtendedAttributes(targetPath) {
    run("xattr", ["-cr", targetPath], { capture: true });
}

async function sortedDirectoryEntries(directoryPath) {
    return (await readdir(directoryPath, { withFileTypes: true }))
        .filter((entry) => entry.name !== ".DS_Store" && !entry.name.startsWith("._"))
        .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

async function walkTree(rootPath, visitor, relativePath = "") {
    const absolutePath = path.join(rootPath, relativePath);
    const entryStat = await lstat(absolutePath);

    if (relativePath)
        await visitor({ absolutePath, relativePath: relativePath.split(path.sep).join("/"), stat: entryStat });

    if (!entryStat.isDirectory())
        return;

    for (const entry of await sortedDirectoryEntries(absolutePath))
        await walkTree(rootPath, visitor, path.join(relativePath, entry.name));
}

export async function assertArchiveTreeContainsOnlyFilesAndDirectories(rootPath) {
    const unsupportedEntries = [];

    await walkTree(rootPath, async ({ relativePath, stat: entryStat }) => {
        if (!entryStat.isDirectory() && !entryStat.isFile())
            unsupportedEntries.push(relativePath);
    });

    if (unsupportedEntries.length > 0) {
        throw new Error(
            `Release archive tree contains symlink or special entries: ${unsupportedEntries.join(", ")}`,
        );
    }
}

function expectedPayloadMode(config, relativePath, entryStat) {
    if (entryStat.isDirectory())
        return 0o755;

    const executablePath = path.posix.join(
        "Library",
        "Audio",
        "Plug-Ins",
        "VST3",
        `${config.identity.bundleName}.vst3`,
        "Contents",
        "MacOS",
        config.identity.bundleName,
    );

    return relativePath === executablePath ? 0o755 : 0o644;
}

async function payloadModeEntries(rootPath) {
    const entries = [{
        absolutePath: rootPath,
        relativePath: ".",
        stat: await lstat(rootPath),
    }];

    await walkTree(rootPath, async (entry) => {
        entries.push(entry);
    });

    return entries;
}

export async function assertPayloadModes(config, rootPath) {
    const errors = [];

    for (const entry of await payloadModeEntries(rootPath)) {
        const observed = entry.stat.mode & 0o7777;
        const expected = expectedPayloadMode(config, entry.relativePath, entry.stat);

        if (!entry.stat.isDirectory() && !entry.stat.isFile()) {
            errors.push(`unsupported entry type: ${entry.relativePath}`);
            continue;
        }

        if ((observed & 0o6000) !== 0)
            errors.push(`setuid/setgid mode ${observed.toString(8)}: ${entry.relativePath}`);

        if ((observed & 0o022) !== 0)
            errors.push(`group/world-writable mode ${observed.toString(8)}: ${entry.relativePath}`);

        if (observed !== expected) {
            errors.push(
                `mode drift at ${entry.relativePath}: expected ${expected.toString(8)}, found ${observed.toString(8)}`,
            );
        }
    }

    if (errors.length > 0) {
        throw new Error([
            "SeqFX payload modes rejected:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

export async function normalizePayloadModes(config, rootPath) {
    const entries = await payloadModeEntries(rootPath);
    const unsafe = [];

    for (const entry of entries) {
        const observed = entry.stat.mode & 0o7777;

        if (!entry.stat.isDirectory() && !entry.stat.isFile())
            unsafe.push(`unsupported entry type: ${entry.relativePath}`);

        if ((observed & 0o6000) !== 0)
            unsafe.push(`setuid/setgid mode ${observed.toString(8)}: ${entry.relativePath}`);

        if ((observed & 0o022) !== 0)
            unsafe.push(`group/world-writable mode ${observed.toString(8)}: ${entry.relativePath}`);
    }

    if (unsafe.length > 0) {
        throw new Error([
            "SeqFX payload modes cannot be normalized safely:",
            ...unsafe.map((error) => `- ${error}`),
        ].join("\n"));
    }

    for (const entry of entries) {
        await chmod(
            entry.absolutePath,
            expectedPayloadMode(config, entry.relativePath, entry.stat),
        );
    }

    await assertPayloadModes(config, rootPath);
}

async function normalizeTreeTimestamps(rootPath, sourceDateEpoch) {
    const timestamp = new Date(sourceDateEpoch * 1000);
    const entries = [];

    await walkTree(rootPath, async (entry) => {
        entries.push(entry);
    });

    for (const entry of entries.reverse()) {
        if (entry.stat.isSymbolicLink())
            await lutimes(entry.absolutePath, timestamp, timestamp);
        else
            await utimes(entry.absolutePath, timestamp, timestamp);
    }

    await utimes(rootPath, timestamp, timestamp);
}

export async function canonicalPayloadFingerprint(rootPath) {
    const hash = createHash("sha256");
    let entryCount = 0;

    await walkTree(rootPath, async ({ absolutePath, relativePath, stat: entryStat }) => {
        const kind = entryStat.isDirectory() ? "directory"
            : entryStat.isFile() ? "file"
                : entryStat.isSymbolicLink() ? "symlink"
                    : "other";
        const mode = entryStat.mode & 0o7777;

        hash.update(`${relativePath}\0${kind}\0${mode.toString(8)}\0`);

        if (entryStat.isFile()) {
            const contents = await readFile(absolutePath);
            hash.update(String(contents.length));
            hash.update("\0");
            hash.update(contents);
        } else if (entryStat.isSymbolicLink()) {
            hash.update(await readlink(absolutePath));
        }

        hash.update("\0");
        entryCount += 1;
    });

    return {
        algorithm: "sha256-path-kind-mode-content-v1",
        digest: hash.digest("hex"),
        entryCount,
    };
}

export async function captureVst3ArtifactEvidence(config, vst3Path) {
    const executableRelativePath = path.posix.join(
        "Contents",
        "MacOS",
        config.identity.bundleName,
    );
    const executablePath = path.join(vst3Path, ...executableRelativePath.split("/"));
    const executableStat = await lstat(executablePath);
    let fileCount = 0;
    let sizeBytes = 0;

    if (!executableStat.isFile())
        throw new Error(`SeqFX executable evidence path is not a regular file: ${executableRelativePath}`);

    await walkTree(vst3Path, async ({ stat: entryStat }) => {
        if (!entryStat.isFile())
            return;

        fileCount += 1;
        sizeBytes += entryStat.size;
    });

    const bundleFingerprint = await canonicalPayloadFingerprint(vst3Path);

    return {
        bundle: {
            algorithm: bundleFingerprint.algorithm,
            fileCount,
            sha256: bundleFingerprint.digest,
            sizeBytes,
        },
        executable: {
            path: executableRelativePath,
            sha256: await sha256(executablePath),
            sizeBytes: executableStat.size,
        },
    };
}

async function sha256(filePath) {
    return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function xmlEscape(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

async function collectPayloadEntries(rootPath) {
    const entries = [];

    await walkTree(rootPath, async ({ relativePath, stat: entryStat }) => {
        entries.push({
            isFile: entryStat.isFile(),
            relativePath,
            size: entryStat.isFile() ? entryStat.size : 0,
        });
    });

    return entries;
}

function odcOctal(value, width, label) {
    const encoded = Number(value).toString(8);

    if (!Number.isInteger(Number(value)) || Number(value) < 0 || encoded.length > width)
        throw new Error(`${label} does not fit a ${width}-byte cpio odc field: ${String(value)}`);

    return encoded.padStart(width, "0");
}

function cpioOdcHeader({ dataSize, inode, mode, mtime, nameSize }) {
    return Buffer.from([
        "070707",
        odcOctal(0, 6, "device"),
        odcOctal(inode, 6, "inode"),
        odcOctal(mode, 6, "mode"),
        odcOctal(0, 6, "uid"),
        odcOctal(0, 6, "gid"),
        odcOctal(1, 6, "link count"),
        odcOctal(0, 6, "rdev"),
        odcOctal(mtime, 11, "mtime"),
        odcOctal(nameSize, 6, "name size"),
        odcOctal(dataSize, 11, "file size"),
    ].join(""), "ascii");
}

async function cpioEntryData(absolutePath, entryStat) {
    if (entryStat.isFile())
        return readFile(absolutePath);

    if (entryStat.isSymbolicLink())
        return Buffer.from(await readlink(absolutePath), "utf8");

    if (entryStat.isDirectory())
        return Buffer.alloc(0);

    throw new Error(`Unsupported payload entry type: ${absolutePath}`);
}

export async function deterministicCpioPayload(rootPath, sourceDateEpoch) {
    const entries = [];
    const rootStat = await lstat(rootPath);

    entries.push({
        absolutePath: rootPath,
        archivePath: ".",
        stat: rootStat,
    });
    await walkTree(rootPath, async ({ absolutePath, relativePath, stat: entryStat }) => {
        entries.push({
            absolutePath,
            archivePath: `./${relativePath}`,
            stat: entryStat,
        });
    });

    const chunks = [];
    let inode = 1;

    for (const entry of entries) {
        const name = Buffer.from(`${entry.archivePath}\0`, "utf8");
        const data = await cpioEntryData(entry.absolutePath, entry.stat);
        chunks.push(cpioOdcHeader({
            dataSize: data.length,
            inode,
            mode: entry.stat.mode & 0o177777,
            mtime: sourceDateEpoch,
            nameSize: name.length,
        }));
        chunks.push(name, data);
        inode += 1;
    }

    const trailerName = Buffer.from("TRAILER!!!\0", "ascii");
    chunks.push(cpioOdcHeader({
        dataSize: 0,
        inode,
        mode: 0,
        mtime: sourceDateEpoch,
        nameSize: trailerName.length,
    }));
    chunks.push(trailerName);

    return gzipSync(Buffer.concat(chunks), {
        level: 9,
        mtime: 0,
    });
}

export function renderPackageInfo(config, payloadEntries) {
    const installKBytes = Math.ceil(payloadEntries.reduce((sum, entry) => sum + entry.size, 0) / 1024);
    const numberOfFiles = payloadEntries.length + 1;
    const bundleRelativePath = `./Library/Audio/Plug-Ins/VST3/${config.identity.bundleName}.vst3`;

    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        `<pkg-info overwrite-permissions="true" relocatable="false" identifier="${xmlEscape(config.identity.installerIdentifier)}" postinstall-action="none" version="${xmlEscape(config.identity.pluginVersion)}" format-version="2" generator-version="cosimo-release-builder-v2" install-location="/" auth="root">`,
        `    <payload numberOfFiles="${numberOfFiles}" installKBytes="${installKBytes}"/>`,
        `    <bundle path="${xmlEscape(bundleRelativePath)}" id="${xmlEscape(config.identity.patchId)}" CFBundleShortVersionString="${xmlEscape(config.identity.pluginVersion)}" CFBundleVersion="${xmlEscape(config.identity.pluginVersion)}"/>`,
        "    <bundle-version>",
        `        <bundle id="${xmlEscape(config.identity.patchId)}"/>`,
        "    </bundle-version>",
        "    <upgrade-bundle>",
        `        <bundle id="${xmlEscape(config.identity.patchId)}"/>`,
        "    </upgrade-bundle>",
        "    <update-bundle/>",
        "    <atomic-update-bundle/>",
        "    <strict-identifier/>",
        "    <relocate/>",
        "</pkg-info>",
        "",
    ].join("\n");
}

async function buildUnsignedFlatPackage(config, stagingRoot, packagePath, workRoot, sourceDateEpoch) {
    const packageRoot = path.join(workRoot, "flat-package");
    const payloadPath = path.join(packageRoot, "Payload");
    const bomPath = path.join(packageRoot, "Bom");
    const packageInfoPath = path.join(packageRoot, "PackageInfo");
    const payloadEntries = await collectPayloadEntries(stagingRoot);

    await rm(packageRoot, { recursive: true, force: true });
    await mkdir(packageRoot, { recursive: true });
    await writeFile(packageInfoPath, renderPackageInfo(config, payloadEntries), "utf8");
    await normalizeTreeTimestamps(stagingRoot, sourceDateEpoch);
    await writeFile(payloadPath, await deterministicCpioPayload(stagingRoot, sourceDateEpoch));
    run("mkbom", [stagingRoot, bomPath], {
        capture: true,
        env: { COPYFILE_DISABLE: "1", SOURCE_DATE_EPOCH: String(sourceDateEpoch) },
    });
    await normalizeTreeTimestamps(packageRoot, sourceDateEpoch);
    run("xar", deterministicFlatPackageXarArgs(packagePath), {
        capture: true,
        cwd: packageRoot,
        env: { COPYFILE_DISABLE: "1", SOURCE_DATE_EPOCH: String(sourceDateEpoch) },
    });
    await writeFile(
        packagePath,
        normalizeUnsignedFlatPackageXar(await readFile(packagePath), sourceDateEpoch),
    );
    run("xar", ["-tf", packagePath], { capture: true });
}

export function deterministicFlatPackageXarArgs(packagePath) {
    return [
        "--compression",
        "none",
        "--distribution",
        "-cf",
        packagePath,
        "Bom",
        "Payload",
        "PackageInfo",
    ];
}

export function normalizeUnsignedFlatPackageXar(archive, sourceDateEpoch) {
    const headerSize = 28;

    if (!Buffer.isBuffer(archive) || archive.length < headerSize)
        throw new Error("Unsigned flat package is too small to contain a XAR header.");

    if (archive.subarray(0, 4).toString("ascii") !== "xar!")
        throw new Error("Unsigned flat package does not have the XAR magic header.");

    if (archive.readUInt16BE(4) !== headerSize || archive.readUInt16BE(6) !== 1)
        throw new Error("Unsigned flat package uses an unsupported XAR header shape.");

    if (archive.readUInt32BE(24) !== 1)
        throw new Error("Unsigned flat package must use the XAR SHA-1 TOC checksum contract.");

    const compressedLength = Number(archive.readBigUInt64BE(8));
    const uncompressedLength = Number(archive.readBigUInt64BE(16));
    const compressedStart = headerSize;
    const compressedEnd = compressedStart + compressedLength;
    const checksumSize = 20;

    if (!Number.isSafeInteger(compressedLength) || compressedLength <= 0 || compressedEnd + checksumSize > archive.length)
        throw new Error("Unsigned flat package has invalid XAR TOC bounds.");

    const compressedToc = archive.subarray(compressedStart, compressedEnd);
    const heap = archive.subarray(compressedEnd);
    const expectedTocChecksum = createHash("sha1").update(compressedToc).digest();

    if (!heap.subarray(0, checksumSize).equals(expectedTocChecksum))
        throw new Error("Unsigned flat package XAR TOC checksum does not match its header.");

    const toc = inflateSync(compressedToc);

    if (toc.length !== uncompressedLength)
        throw new Error("Unsigned flat package XAR TOC length does not match its header.");

    const sourceToc = toc.toString("utf8");
    const creationTimePattern = /<creation-time>[^<]+<\/creation-time>/gu;
    const creationTimes = sourceToc.match(creationTimePattern) ?? [];

    if (creationTimes.length !== 1)
        throw new Error(`Unsigned flat package must contain exactly one XAR creation time, found ${creationTimes.length}.`);

    const normalizedCreationTime = new Date(sourceDateEpoch * 1000).toISOString().slice(0, 19);
    const normalizedToc = Buffer.from(
        sourceToc.replace(
            creationTimePattern,
            `<creation-time>${normalizedCreationTime}</creation-time>`,
        ),
        "utf8",
    );
    const normalizedCompressedToc = deflateSync(normalizedToc, { level: 9 });
    const normalizedHeader = Buffer.from(archive.subarray(0, headerSize));
    const normalizedHeap = Buffer.from(heap);

    normalizedHeader.writeBigUInt64BE(BigInt(normalizedCompressedToc.length), 8);
    normalizedHeader.writeBigUInt64BE(BigInt(normalizedToc.length), 16);
    createHash("sha1").update(normalizedCompressedToc).digest().copy(normalizedHeap, 0);

    return Buffer.concat([normalizedHeader, normalizedCompressedToc, normalizedHeap]);
}

export function payloadInventoryErrors(config, payloadFiles, { signed }) {
    const root = `./Library/Audio/Plug-Ins/VST3/${config.identity.bundleName}.vst3`;
    const relativeRoot = root.slice(2);
    const allowedAncestors = new Set([
        ".",
        "Library",
        "Library/Audio",
        "Library/Audio/Plug-Ins",
        "Library/Audio/Plug-Ins/VST3",
    ]);
    const requiredFiles = [
        `${root}/Contents/Info.plist`,
        `${root}/Contents/MacOS/${config.identity.bundleName}`,
        `${root}/Contents/Resources/moduleinfo.json`,
        `${root}/Contents/_CodeSignature/CodeResources`,
    ];
    const metadataFiles = payloadFiles.filter(
        (file) => /(^|\/)\._[^/]*$/u.test(file) || /(^|\/)\.DS_Store$/u.test(file),
    );
    const missingFiles = requiredFiles.filter((file) => !payloadFiles.includes(file));
    const unexpectedFiles = payloadFiles.filter((file) => {
        if (file === ".")
            return false;

        if (!file.startsWith("./"))
            return true;

        const relativePath = file.slice(2);
        const isCanonical = relativePath
            && !relativePath.includes("\\")
            && path.posix.normalize(relativePath) === relativePath;

        if (!isCanonical)
            return true;

        return !allowedAncestors.has(relativePath)
            && relativePath !== relativeRoot
            && !relativePath.startsWith(`${relativeRoot}/`);
    });
    const errors = [];

    if (metadataFiles.length > 0)
        errors.push(`payload contains metadata files: ${metadataFiles.join(", ")}`);

    if (missingFiles.length > 0)
        errors.push(`payload is missing required files: ${missingFiles.join(", ")}`);

    if (unexpectedFiles.length > 0)
        errors.push(`payload contains paths outside the declared VST3 install root: ${unexpectedFiles.join(", ")}`);

    return errors;
}

function verifyPackagePayload(config, packagePath, { signed }) {
    const payloadFiles = run("pkgutil", ["--payload-files", packagePath], { capture: true })
        .stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const errors = payloadInventoryErrors(config, payloadFiles, { signed });

    if (errors.length > 0)
        throw new Error(["SeqFX package payload is invalid:", ...errors.map((error) => `- ${error}`)].join("\n"));

    return payloadFiles;
}

function signStagedVst3(vst3Path, approvedIdentity) {
    run("codesign", [
        "--force",
        "--deep",
        "--options",
        "runtime",
        "--timestamp",
        "--sign",
        approvedIdentity.sha1Fingerprint,
        vst3Path,
    ], { capture: true });
    verifyCodesign(vst3Path);
    const verification = run("codesign", ["--display", "--verbose=4", vst3Path], { capture: true });

    return parseVst3SigningEvidence(combinedProcessOutput(verification), approvedIdentity);
}

export function adHocVst3SigningArgs(vst3Path) {
    return ["--force", "--sign", "-", vst3Path];
}

function signStagedVst3AdHoc(vst3Path) {
    run("codesign", adHocVst3SigningArgs(vst3Path), { capture: true });
    verifyCodesign(vst3Path);
    const verification = run("codesign", ["--display", "--verbose=4", vst3Path], { capture: true });
    const evidence = combinedProcessOutput(verification);

    if (!/^Signature=adhoc$/mu.test(evidence) || /^Authority=/mu.test(evidence))
        throw new Error("Local SeqFX VST3 did not receive the required ad-hoc-only signature.");

    return {
        identity: null,
        loadableLocally: true,
        signatureKind: "ad-hoc",
        signedWithDeveloperId: false,
        teamIdentifier: null,
        timestamp: null,
        note: "The VST3 is ad-hoc signed for local host loading; it is not Developer ID signed or distributable.",
    };
}

function removeLocalBuildSignature(vst3Path) {
    run("codesign", ["--remove-signature", vst3Path], { capture: true });
}

function signInstaller(unsignedPackagePath, signedPackagePath, approvedIdentity) {
    run("productsign", [
        "--sign",
        approvedIdentity.sha1Fingerprint,
        unsignedPackagePath,
        signedPackagePath,
    ], { capture: true });
    const verification = run("pkgutil", ["--check-signature", signedPackagePath], { capture: true });

    return parseInstallerSigningEvidence(combinedProcessOutput(verification), approvedIdentity);
}

function notarizeStapleAndAssess(packagePath) {
    const profile = process.env.COSIMO_NOTARY_PROFILE;
    const { stdout } = run("xcrun", [
        "notarytool",
        "submit",
        packagePath,
        "--keychain-profile",
        profile,
        "--wait",
        "--output-format",
        "json",
    ], { capture: true });
    let submission;

    try {
        submission = JSON.parse(stdout);
    } catch {
        throw new Error("notarytool did not return valid JSON.");
    }

    if (submission.status !== "Accepted")
        throw new Error(`Apple notarization was not accepted (status: ${String(submission.status)}).`);

    if (typeof submission.id !== "string" || !submission.id.trim())
        throw new Error("Apple notarization returned Accepted without a submission ID.");

    run("xcrun", ["stapler", "staple", packagePath], { capture: true });
    const stapler = run("xcrun", ["stapler", "validate", packagePath], { capture: true });
    const gatekeeper = run("spctl", ["-a", "-vv", "-t", "install", packagePath], { capture: true });

    return {
        gatekeeperAccepted: true,
        notaryProfile: profile,
        notarizationId: submission.id,
        notarizationStatus: submission.status,
        stapled: true,
        staplerValidation: [stapler.stdout, stapler.stderr].filter(Boolean).join("\n").trim(),
        gatekeeperAssessment: [gatekeeper.stdout, gatekeeper.stderr].filter(Boolean).join("\n").trim(),
    };
}

export function renderReleaseReadme(config, { signedRelease }) {
    const supportLine = config.support.publicContact
        ? `Support: ${config.support.publicContact}`
        : "Support contact: not yet approved for public distribution.";
    const minimumMacOSLine = config.scope.minimumMacOSVersion
        ? `- macOS ${config.scope.minimumMacOSVersion} or later`
        : "- Minimum macOS version is not yet approved; this local validation package is not for distribution.";

    return [
        `${config.identity.publicName} ${config.release.channelVersion}`,
        "",
        signedRelease
            ? "This installer was produced in signed release mode. Verify its adjacent manifest and checksums before distribution."
            : "LOCAL VALIDATION PACKAGE — NOT FOR DISTRIBUTION OR PATREON UPLOAD.",
        ...(!signedRelease ? [
            "The VST3 payload is ad-hoc signed for local loading; the installer is not Developer ID-signed or notarized.",
        ] : []),
        "",
        "Scope:",
        minimumMacOSLine,
        "- VST3 only",
        `- ${config.scope.distributionGate}`,
        "- No in-plugin Patreon authorization",
        "",
        "Install (only after release qualification):",
        "1. Open the pkg installer.",
        "2. Complete the installer prompts.",
        "3. Restart the DAW or rescan VST3 plugins.",
        `4. Load ${config.identity.bundleName} as a VST3 audio effect.`,
        "",
        "Installed file:",
        config.paths.installedVst3,
        "",
        "Uninstall:",
        `Remove ${config.paths.installedVst3}, then restart the DAW or rescan plugins.`,
        "",
        "Known beta limits:",
        "- macOS VST3 only; AU, Logic Pro, GarageBand, and Windows are outside beta 1 scope.",
        "- Human listening, Ableton project recall, and clean-account Gatekeeper acceptance remain separate release gates.",
        "",
        supportLine,
        "Support reports should include macOS version, Mac model, CPU type, DAW name/version, exact steps, and any crash report.",
        "",
    ].join("\n");
}

function assertSignedReleaseEvidence(config, signing, notarization) {
    const errors = [];

    if (config.approvals.signingAndNotarizationApproved !== true)
        errors.push("signing and notarization are not approved in the release config");

    for (const [label, expected, observed] of [
        ["VST3", config.signing?.application, signing?.vst3],
        ["installer", config.signing?.installer, signing?.installer],
    ]) {
        const expectedPrefix = label === "VST3"
            ? "Developer ID Application: "
            : "Developer ID Installer: ";

        if (typeof expected?.commonName !== "string" || !expected.commonName)
            errors.push(`${label} signing common name is not approved`);
        else if (!expected.commonName.startsWith(expectedPrefix))
            errors.push(`${label} signing common name is not a Developer ID identity`);

        if (typeof expected?.sha1Fingerprint !== "string" || !expected.sha1Fingerprint)
            errors.push(`${label} signing fingerprint is not approved`);

        if (typeof expected?.teamIdentifier !== "string" || !expected.teamIdentifier)
            errors.push(`${label} signing team is not approved`);

        if (observed?.signedWithDeveloperId !== true)
            errors.push(`${label} Developer ID signature was not proven`);

        if (observed?.identity !== expected?.commonName)
            errors.push(`${label} signing identity does not match the exact approved common name`);

        if (observed?.teamIdentifier !== expected?.teamIdentifier)
            errors.push(`${label} signing team does not match the exact approved team`);

        if (typeof observed?.timestamp !== "string" || !observed.timestamp.trim())
            errors.push(`${label} signing timestamp was not proven`);
    }

    if (notarization?.notarized !== true)
        errors.push("notarization was not proven");

    if (notarization?.notarizationStatus !== "Accepted")
        errors.push("notarization status is not Accepted");

    if (typeof notarization?.notarizationId !== "string" || !notarization.notarizationId.trim())
        errors.push("Accepted notarization ID is missing");

    if (notarization?.stapled !== true)
        errors.push("notarization ticket was not stapled");

    if (typeof notarization?.staplerValidation !== "string" || !notarization.staplerValidation.trim())
        errors.push("stapler validation evidence is missing");

    if (notarization?.gatekeeperAccepted !== true)
        errors.push("Gatekeeper acceptance was not proven");

    if (typeof notarization?.gatekeeperAssessment !== "string" || !notarization.gatekeeperAssessment.trim())
        errors.push("Gatekeeper assessment evidence is missing");

    if (errors.length > 0) {
        throw new Error([
            "SeqFX signed release evidence rejected:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

function assertBuiltVst3Evidence(config, evidence) {
    const expectedExecutablePath = path.posix.join(
        "Contents",
        "MacOS",
        config.identity.bundleName,
    );
    const errors = [];

    if (evidence?.bundle?.algorithm !== "sha256-path-kind-mode-content-v1")
        errors.push("built VST3 bundle hash algorithm is missing or unsupported");

    if (!Number.isInteger(evidence?.bundle?.fileCount) || evidence.bundle.fileCount <= 0)
        errors.push("built VST3 bundle file count is missing");

    if (!Number.isInteger(evidence?.bundle?.sizeBytes) || evidence.bundle.sizeBytes <= 0)
        errors.push("built VST3 bundle size is missing");

    if (!/^[a-f0-9]{64}$/u.test(evidence?.bundle?.sha256 ?? ""))
        errors.push("built VST3 bundle SHA-256 is missing");

    if (evidence?.executable?.path !== expectedExecutablePath)
        errors.push(`built VST3 executable path must be ${expectedExecutablePath}`);

    if (!Number.isInteger(evidence?.executable?.sizeBytes) || evidence.executable.sizeBytes <= 0)
        errors.push("built VST3 executable size is missing");

    if (!/^[a-f0-9]{64}$/u.test(evidence?.executable?.sha256 ?? ""))
        errors.push("built VST3 executable SHA-256 is missing");

    if (errors.length > 0) {
        throw new Error([
            "SeqFX built VST3 evidence rejected:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

function assertReleaseToolchainAttestation(attestation, { requireNativeBuildCache }) {
    const errors = [];

    if (attestation?.schemaVersion !== 1)
        errors.push("toolchain schema version must be 1");

    for (const toolName of ["cmaj", "cmake", "node"]) {
        try {
            assertApprovedSeqFxReleaseToolEvidence(toolName, attestation?.externalTools?.[toolName]);
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
    }

    if (attestation?.externalTools?.cmaj?.provenance !== "approved-binary-toolchain")
        errors.push("cmaj binary provenance is missing");

    if (attestation?.externalTools?.cmaj?.runtimeSourceAttestation !== "separate")
        errors.push("cmaj binary and runtime-source attestations must remain separate");

    for (const toolName of ["cmake", "node"]) {
        if (attestation?.externalTools?.[toolName]?.provenance !== "approved-binary-toolchain")
            errors.push(`${toolName} binary provenance is missing`);
    }

    if (attestation?.systemCommands?.policy !== "macos-absolute-system-command-map-v1")
        errors.push("absolute macOS system-command policy is missing");

    const expectedSystemCommandNames = Object.keys(seqFxReleaseSystemCommands);
    if (JSON.stringify(attestation?.systemCommands?.names) !== JSON.stringify(expectedSystemCommandNames))
        errors.push("absolute macOS system-command inventory drifted");

    if (requireNativeBuildCache && attestation?.nativeBuildCacheVerified !== true)
        errors.push("native CMake/cmaj cache verification is missing");

    if (errors.length > 0) {
        throw new Error([
            "SeqFX release toolchain attestation rejected:",
            ...errors.map((error) => `- ${error}`),
        ].join("\n"));
    }
}

export function createReleaseManifest({
    architectures,
    builtVst3Evidence,
    config,
    finalGitState,
    gitState,
    nativeDependencyProvenance,
    notarization,
    options,
    packagePayloadFileCount,
    patchManifest,
    payloadFingerprint,
    releaseToolchain,
    signing,
    sourceDateEpoch,
    sourceDateEpochOrigin,
    vst3Metadata,
}) {
    const artifactBaseName = seqFxArtifactBaseName(config);
    assertActualNativeDependencyProvenance(config, nativeDependencyProvenance);
    assertVst3MetadataAttestation(config, vst3Metadata);
    assertBuiltVst3Evidence(config, builtVst3Evidence);
    assertReleaseToolchainAttestation(releaseToolchain, { requireNativeBuildCache: true });
    assertSourceStateUnchanged(gitState, finalGitState, {
        phase: "final manifest construction",
    });

    if (options.mode === "release")
        assertSignedReleaseEvidence(config, signing, notarization);

    if (!["SOURCE_DATE_EPOCH", "source-commit-timestamp"].includes(sourceDateEpochOrigin))
        throw new Error(`SeqFX SOURCE_DATE_EPOCH origin is invalid: ${String(sourceDateEpochOrigin)}`);

    return {
        schemaVersion: 8,
        artifactClass: options.mode === "release" ? "signed-notarized-release-candidate" : "local-ad-hoc-validation",
        packagingReady: options.mode === "release",
        distributionReady: false,
        distributionReadinessReason: options.mode === "release"
            ? "The builder does not perform packaged pluginval, Ableton/listening acceptance, clean-account Gatekeeper installation, or an authorized Patreon upload."
            : "The VST3 uses only an ad-hoc local signature, and the installer is neither Developer ID-signed nor notarized.",
        product: config.identity.publicName,
        releaseVersion: config.release.channelVersion,
        scope: config.scope,
        source: {
            commit: gitState.commit,
            dirty: gitState.dirty,
            sourceDateEpoch,
            sourceDateEpochOrigin,
            sourceTimestamp: new Date(sourceDateEpoch * 1000).toISOString(),
        },
        identity: config.identity,
        cmajorPatch: {
            path: config.paths.patchManifest,
            id: patchManifest.ID,
            version: patchManifest.version,
            name: patchManifest.name,
            pluginCode: patchManifest.plugin?.pluginCode,
            manufacturerCode: patchManifest.plugin?.manufacturerCode,
        },
        nativeDependencyProvenance,
        build: {
            builtVst3: config.paths.builtVst3,
            builtVst3Evidence,
            releaseToolchain,
            binaryArchitectures: architectures,
            vst3Metadata,
            webViewRequiredMarkers: config.webViewMarkers.required,
            webViewForbiddenMarkersAbsent: config.webViewMarkers.forbidden,
        },
        repeatability: {
            deterministicBoundary: "two packaging assemblies of one freshly built normalized ad-hoc-signed VST3 payload tree, flat package, generated text, and zip",
            payloadFingerprint,
            repeatVerificationRequested: options.verifyRepeatablePackaging,
            independentNativeBuildsCompared: false,
            signedArtifactBytesReproducible: false,
            signedArtifactExplanation: "Developer ID secure timestamps and Apple notarization tickets are external time-varying attestations.",
        },
        signing,
        notarization,
        installer: {
            identifier: config.identity.installerIdentifier,
            installLocation: "/",
            installedVst3Path: config.paths.installedVst3,
            payloadFileCount: packagePayloadFileCount,
        },
        artifacts: {
            pkg: `${artifactBaseName}.pkg`,
            zip: `${artifactBaseName}.zip`,
            readme: "README.txt",
            thirdPartyNotices: "THIRD_PARTY_NOTICES.txt",
            checksums: `${artifactBaseName}-checksums.txt`,
            zipChecksum: `${artifactBaseName}.zip.sha256`,
        },
        operationsNotPerformed: [
            "plugin installation",
            "pluginval on the packaged payload",
            "DAW smoke or listening acceptance",
            "Patreon upload",
            "publication or deployment",
        ],
    };
}

async function writeChecksums(checksumsPath, entries) {
    const lines = [];

    for (const entry of entries)
        lines.push(`${await sha256(entry.filePath)}  ${entry.label}`);

    await writeFile(checksumsPath, `${lines.join("\n")}\n`, "utf8");
}

async function createDeterministicZip(zipRootParent, zipFolderName, zipPath, sourceDateEpoch) {
    const zipFolder = path.join(zipRootParent, zipFolderName);
    const filePaths = [];

    await walkTree(zipFolder, async ({ relativePath, stat: entryStat }) => {
        if (entryStat.isFile() || entryStat.isSymbolicLink())
            filePaths.push(`${zipFolderName}/${relativePath}`);
    });
    await normalizeTreeTimestamps(zipFolder, sourceDateEpoch);
    await rm(zipPath, { force: true });
    run("zip", ["-X", "-q", zipPath, ...filePaths], {
        capture: true,
        cwd: zipRootParent,
        env: { COPYFILE_DISABLE: "1", SOURCE_DATE_EPOCH: String(sourceDateEpoch) },
    });
    run("unzip", ["-t", zipPath], { capture: true });
}

export async function assertSafeOutputRoot(
    config,
    outputRoot,
    { repositoryRoot = repoRoot } = {},
) {
    const resolvedRepositoryRoot = path.resolve(repositoryRoot);
    const expected = path.resolve(resolvedRepositoryRoot, config.release.outputDirectory);
    const releaseParent = path.resolve(resolvedRepositoryRoot, "release", "seqfx");
    const repeatabilityRoot = path.join(
        releaseParent,
        `.${path.basename(expected)}-packaging-repeatability-check`,
    );
    const resolvedOutputRoot = path.resolve(outputRoot);

    if (!expected.startsWith(`${releaseParent}${path.sep}`))
        throw new Error(`Configured release output must be below release/seqfx/: ${expected}`);

    if (resolvedOutputRoot !== expected && resolvedOutputRoot !== repeatabilityRoot)
        throw new Error(`Refusing to replace unexpected release output path: ${outputRoot}`);

    const relativeOutput = path.relative(resolvedRepositoryRoot, resolvedOutputRoot);

    if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput))
        throw new Error(`Release output must remain inside the repository: ${resolvedOutputRoot}`);

    let ancestor = resolvedRepositoryRoot;

    for (const segment of relativeOutput.split(path.sep)) {
        ancestor = path.join(ancestor, segment);

        try {
            const ancestorStat = await lstat(ancestor);

            if (ancestorStat.isSymbolicLink())
                throw new Error(`Release output path traverses a symlink: ${ancestor}`);

            if (ancestor !== resolvedOutputRoot && !ancestorStat.isDirectory())
                throw new Error(`Release output ancestor is not a directory: ${ancestor}`);
        } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
                break;

            throw error;
        }
    }
}

async function assembleArtifactSet({
    builtArtifact,
    config,
    gitState,
    nativeDependencyProvenance,
    options,
    outputRoot,
    patchManifest,
    releaseToolchain,
    signingIdentities,
    sourceDateEpoch,
    sourceDateEpochOrigin,
}) {
    await assertSafeOutputRoot(config, outputRoot);
    const artifactBaseName = seqFxArtifactBaseName(config);
    const workRoot = path.join(outputRoot, "_work");
    const stagingRoot = path.join(workRoot, "staging");
    const stagedVst3 = path.join(
        stagingRoot,
        "Library",
        "Audio",
        "Plug-Ins",
        "VST3",
        `${config.identity.bundleName}.vst3`,
    );
    const unsignedPackagePath = path.join(workRoot, `${artifactBaseName}-unsigned.pkg`);
    const packagePath = path.join(outputRoot, `${artifactBaseName}.pkg`);
    const zipPath = path.join(outputRoot, `${artifactBaseName}.zip`);
    const manifestPath = path.join(outputRoot, `${artifactBaseName}-release-manifest.json`);
    const checksumsPath = path.join(outputRoot, `${artifactBaseName}-checksums.txt`);
    const zipChecksumPath = path.join(outputRoot, `${artifactBaseName}.zip.sha256`);
    const readmePath = path.join(outputRoot, "README.txt");
    const thirdPartyNoticesPath = path.join(outputRoot, "THIRD_PARTY_NOTICES.txt");
    const thirdPartyNoticesSourcePath = path.join(repoRoot, config.paths.thirdPartyNotices);
    const zipRootParent = path.join(workRoot, "zip-root");
    const zipFolder = path.join(zipRootParent, artifactBaseName);

    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(path.dirname(stagedVst3), { recursive: true });
    copyPathWithoutMetadata(builtArtifact.vst3Path, stagedVst3);
    clearExtendedAttributes(stagedVst3);
    removeLocalBuildSignature(stagedVst3);
    const stagedThirdPartyNoticesPath = path.join(stagedVst3, "Contents", "Resources", "THIRD_PARTY_NOTICES.txt");
    await mkdir(path.dirname(stagedThirdPartyNoticesPath), { recursive: true });
    copyPathWithoutMetadata(thirdPartyNoticesSourcePath, stagedThirdPartyNoticesPath);
    const vst3Metadata = await attestMatchingVst3Metadata(
        config,
        builtArtifact.vst3Path,
        stagedVst3,
    );
    await assertArchiveTreeContainsOnlyFilesAndDirectories(stagingRoot);
    await normalizePayloadModes(config, stagingRoot);
    await normalizeTreeTimestamps(stagedVst3, sourceDateEpoch);

    const vst3Signing = options.mode === "release"
        ? signStagedVst3(stagedVst3, signingIdentities.application)
        : signStagedVst3AdHoc(stagedVst3);

    await normalizePayloadModes(config, stagingRoot);
    await normalizeTreeTimestamps(stagingRoot, sourceDateEpoch);
    verifyCodesign(stagedVst3);
    if (options.mode === "release") {
        verifyPatchedWebView(
            config,
            path.join(stagedVst3, "Contents", "MacOS", config.identity.bundleName),
        );
        binaryArchitectures(
            config,
            path.join(stagedVst3, "Contents", "MacOS", config.identity.bundleName),
        );
    }
    await assertPayloadModes(config, stagingRoot);
    const payloadFingerprint = await canonicalPayloadFingerprint(stagingRoot);
    await mkdir(outputRoot, { recursive: true });
    await buildUnsignedFlatPackage(config, stagingRoot, unsignedPackagePath, workRoot, sourceDateEpoch);

    let installerSigning = {
        identity: null,
        signedWithDeveloperId: false,
        note: "The installer is deliberately unsigned and is not distributable.",
    };
    let notarization = {
        gatekeeperAccepted: false,
        notarized: false,
        stapled: false,
        note: "Notarization, stapling, and Gatekeeper assessment run only in --release mode.",
    };

    if (options.mode === "release") {
        installerSigning = signInstaller(
            unsignedPackagePath,
            packagePath,
            signingIdentities.installer,
        );
        notarization = {
            ...notarizeStapleAndAssess(packagePath),
            notarized: true,
        };
    } else {
        copyPathWithoutMetadata(unsignedPackagePath, packagePath);
        await normalizeTreeTimestamps(outputRoot, sourceDateEpoch);
    }

    const payloadFiles = verifyPackagePayload(config, packagePath, { signed: options.mode === "release" });
    const readme = renderReleaseReadme(config, { signedRelease: options.mode === "release" });
    const finalGitState = getReleaseGitState();
    const manifest = createReleaseManifest({
        architectures: builtArtifact.architectures,
        builtVst3Evidence: builtArtifact.artifactEvidence,
        config,
        finalGitState,
        gitState,
        nativeDependencyProvenance,
        notarization,
        options,
        packagePayloadFileCount: payloadFiles.length,
        patchManifest,
        payloadFingerprint,
        releaseToolchain,
        signing: {
            installer: installerSigning,
            vst3: vst3Signing,
        },
        sourceDateEpoch,
        sourceDateEpochOrigin,
        vst3Metadata,
    });

    await writeFile(readmePath, readme, "utf8");
    copyPathWithoutMetadata(thirdPartyNoticesSourcePath, thirdPartyNoticesPath);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeChecksums(checksumsPath, [
        { filePath: packagePath, label: path.basename(packagePath) },
        { filePath: readmePath, label: path.basename(readmePath) },
        { filePath: thirdPartyNoticesPath, label: path.basename(thirdPartyNoticesPath) },
        { filePath: manifestPath, label: path.basename(manifestPath) },
    ]);
    await mkdir(zipFolder, { recursive: true });

    for (const sourcePath of [packagePath, readmePath, thirdPartyNoticesPath, manifestPath, checksumsPath])
        copyPathWithoutMetadata(sourcePath, path.join(zipFolder, path.basename(sourcePath)));

    clearExtendedAttributes(zipFolder);
    await createDeterministicZip(zipRootParent, artifactBaseName, zipPath, sourceDateEpoch);
    await writeChecksums(zipChecksumPath, [
        { filePath: zipPath, label: path.basename(zipPath) },
    ]);
    await rm(workRoot, { recursive: true, force: true });

    return {
        checksumsPath,
        manifestPath,
        packagePath,
        payloadFingerprint,
        readmePath,
        thirdPartyNoticesPath,
        zipChecksumPath,
        zipPath,
    };
}

async function compareArtifactSets(left, right) {
    const comparisons = [
        ["pkg", left.packagePath, right.packagePath],
        ["zip", left.zipPath, right.zipPath],
        ["manifest", left.manifestPath, right.manifestPath],
        ["checksums", left.checksumsPath, right.checksumsPath],
        ["zip checksum", left.zipChecksumPath, right.zipChecksumPath],
        ["README", left.readmePath, right.readmePath],
        ["third-party notices", left.thirdPartyNoticesPath, right.thirdPartyNoticesPath],
    ];
    const results = [];

    for (const [label, leftPath, rightPath] of comparisons) {
        const leftSha256 = await sha256(leftPath);
        const rightSha256 = await sha256(rightPath);
        results.push({ label, leftSha256, rightSha256, identical: leftSha256 === rightSha256 });
    }

    if (left.payloadFingerprint.digest !== right.payloadFingerprint.digest) {
        results.push({
            label: "normalized payload fingerprint",
            leftSha256: left.payloadFingerprint.digest,
            rightSha256: right.payloadFingerprint.digest,
            identical: false,
        });
    }

    const failures = results.filter((result) => !result.identical);

    if (failures.length > 0) {
        throw new Error([
            "Unsigned SeqFX packaging was not byte-repeatable for the same freshly built VST3:",
            ...failures.map((failure) => `- ${failure.label}: ${failure.leftSha256} != ${failure.rightSha256}`),
        ].join("\n"));
    }

    return results;
}

async function buildReleaseArtifacts({
    config,
    gitState,
    options,
    patchManifest,
    sourceDateEpoch,
    sourceDateEpochOrigin,
    toolchain,
}) {
    if (process.platform !== "darwin")
        throw new Error("SeqFX beta packaging targets macOS and must run on macOS.");

    assertWorktreePolicy(gitState, options);

    const signingIdentities = options.mode === "release"
        ? assertSignedReleasePrerequisites(config, gitState)
        : null;

    run(toolchain.privateInvocationPaths.node, [
        "fx/prod-effect.mjs",
        "build",
        config.productKey,
        "--clean",
    ], {
        env: {
            COSIMO_RELEASE_CMAJ: toolchain.privateInvocationPaths.cmaj,
            COSIMO_RELEASE_CMAKE: toolchain.privateInvocationPaths.cmake,
            COSIMO_RELEASE_NODE: toolchain.privateInvocationPaths.node,
        },
    });
    assertSourceStateUnchanged(gitState, getReleaseGitState());

    const nativeDependencyProvenance = await captureActualNativeDependencyProvenance(config);
    await assertNativeBuildUsedReleaseToolchain(config, toolchain.privateInvocationPaths);
    const releaseToolchain = {
        ...toolchain.manifestAttestation,
        nativeBuildCacheVerified: true,
    };
    const builtArtifact = await verifyBuiltVst3(config);
    const outputRoot = path.join(repoRoot, config.release.outputDirectory);
    const primaryArtifacts = await assembleArtifactSet({
        builtArtifact,
        config,
        gitState,
        nativeDependencyProvenance,
        options,
        outputRoot,
        patchManifest,
        releaseToolchain,
        signingIdentities,
        sourceDateEpoch,
        sourceDateEpochOrigin,
    });

    if (options.verifyRepeatablePackaging) {
        const repeatRoot = path.join(
            path.dirname(outputRoot),
            `.${path.basename(outputRoot)}-packaging-repeatability-check`,
        );
        const repeatArtifacts = await assembleArtifactSet({
            builtArtifact,
            config,
            gitState,
            nativeDependencyProvenance,
            options,
            outputRoot: repeatRoot,
            patchManifest,
            releaseToolchain,
            signingIdentities,
            sourceDateEpoch,
            sourceDateEpochOrigin,
        });
        const results = await compareArtifactSets(primaryArtifacts, repeatArtifacts);
        const reportPath = path.join(outputRoot, `${seqFxArtifactBaseName(config)}-packaging-repeatability.json`);

        await writeFile(reportPath, `${JSON.stringify({
            schemaVersion: 2,
            sourceCommit: gitState.commit,
            sourceDateEpoch,
            sourceDateEpochOrigin,
            nativeBuildsCompared: 1,
            independentNativeBuildReproducibilityVerified: false,
            claim: "Two packaging assemblies of the same freshly built ad-hoc-signed VST3 were byte-identical.",
            payloadFingerprint: primaryArtifacts.payloadFingerprint,
            results,
        }, null, 2)}\n`, "utf8");
        await rm(repeatRoot, { recursive: true, force: true });
        console.log(`Verified repeatable unsigned packaging for one fresh native build: ${path.relative(repoRoot, reportPath)}`);
    }

    return primaryArtifacts;
}

async function readPatchManifest(config) {
    return JSON.parse(await readFile(path.join(repoRoot, config.paths.patchManifest), "utf8"));
}

export async function main(argv = process.argv) {
    const options = parseReleaseArgs(argv);

    if (options.help) {
        console.log(usage());
        return;
    }

    const toolchain = await resolveSeqFxReleaseToolchain({ repositoryRoot: repoRoot });
    const previousCommandEnvironment = releaseCommandEnvironment;
    releaseCommandEnvironment = toolchain.childEnvironment;

    try {
        const config = seqFxReleaseConfig;
        const patchManifest = await readPatchManifest(config);
        const plugin = effectPlugins[config.productKey];

        assertReleaseContract(config, patchManifest, plugin);
        const declaredNativeDependencies = await readDeclaredNativeDependencyProvenance(config);
        const gitState = getReleaseGitState();
        const {
            origin: sourceDateEpochOrigin,
            sourceDateEpoch,
        } = resolveSourceDateEpochEvidence({
            gitTimestamp: sourceCommitTimestamp(),
        });
        const plan = createReleasePlan({
            config,
            declaredNativeDependencies,
            gitState,
            mode: options.mode,
            releaseToolchain: {
                ...toolchain.manifestAttestation,
                nativeBuildCacheVerified: false,
            },
            sourceDateEpoch,
        });

        if (options.mode === "plan") {
            printPlan(plan, options);
            return;
        }

        const artifacts = await buildReleaseArtifacts({
            config,
            gitState,
            options,
            patchManifest,
            sourceDateEpoch,
            sourceDateEpochOrigin,
            toolchain,
        });

        console.log(`Created ${path.relative(repoRoot, artifacts.packagePath)}`);
        console.log(`Created ${path.relative(repoRoot, artifacts.zipPath)}`);
        console.log(`Created ${path.relative(repoRoot, artifacts.manifestPath)}`);
        console.log(`Created ${path.relative(repoRoot, artifacts.checksumsPath)}`);

        if (options.mode !== "release") {
            console.log(
                "Local unsigned validation artifact is NOT Patreon-ready. Public identity/support/channel decisions, signing, notarization, host acceptance, and clean-account testing remain open.",
            );
        }
    } finally {
        releaseCommandEnvironment = previousCommandEnvironment;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
