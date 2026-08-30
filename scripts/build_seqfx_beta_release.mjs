import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
    access,
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
import { gzipSync } from "node:zlib";

import { effectPlugins, repoRoot } from "../fx/build-effect.mjs";
import {
    seqFxArtifactBaseName,
    seqFxReleaseConfig,
    unresolvedSeqFxPublicReleaseDecisions,
} from "./seqfx-release-config.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const minimumZipEpoch = 315532800;

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
        "  --unsigned   Build a local unsigned validation package (the default).",
        "  --release    Developer ID sign, notarize, staple, and Gatekeeper-check the package.",
        "",
        "Important:",
        "  Unsigned output is never Patreon-ready.",
        "  --verify-repeatable-packaging compares two assemblies of the same freshly built unsigned VST3.",
        "  It does not claim that two independent native builds produce identical binaries.",
        "  Developer ID timestamps and Apple notarization make signed release bytes non-reproducible.",
        "  This command never installs a plugin and never uploads or publishes an artifact.",
        "",
        "Release-only environment:",
        "  COSIMO_DEVELOPER_ID_APPLICATION",
        "  COSIMO_DEVELOPER_ID_INSTALLER",
        "  COSIMO_NOTARY_PROFILE",
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

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        encoding: "utf8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `${command} ${args.join(" ")} failed.`);
    }

    return {
        stderr: result.stderr?.trim() ?? "",
        stdout: result.stdout?.trim() ?? "",
    };
}

function runAllowFailure(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        encoding: "utf8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
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
        ["paths.installedVst3", config.paths.installedVst3],
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

export function createReleasePlan({
    config = seqFxReleaseConfig,
    gitState,
    mode = "plan",
    sourceDateEpoch,
} = {}) {
    const artifactBaseName = seqFxArtifactBaseName(config);
    const decisionGates = unresolvedSeqFxPublicReleaseDecisions(config);

    return {
        schemaVersion: 1,
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
            deterministicBoundary: "two packaging assemblies of one freshly built unsigned VST3 payload plus package and zip",
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

function assertSourceStateUnchanged(beforeBuild, afterBuild) {
    if (beforeBuild.commit === afterBuild.commit
        && beforeBuild.worktreeStatus === afterBuild.worktreeStatus) {
        return;
    }

    throw new Error([
        "SeqFX source state changed during the native build; refusing to attach stale provenance to the artifact.",
        `Before: ${beforeBuild.commit} ${beforeBuild.worktreeStatus || "(clean)"}`,
        `After: ${afterBuild.commit} ${afterBuild.worktreeStatus || "(clean)"}`,
    ].join("\n"));
}

function combinedProcessOutput(result) {
    return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function identityIsInstalled(identity, output) {
    return output.includes(`"${identity}"`) || output.includes(identity);
}

function assertSignedReleasePrerequisites(config, gitState) {
    const errors = unresolvedSeqFxPublicReleaseDecisions(config).map(
        (gate) => `${gate.id}: ${gate.decision}`,
    );
    const applicationIdentity = process.env.COSIMO_DEVELOPER_ID_APPLICATION;
    const installerIdentity = process.env.COSIMO_DEVELOPER_ID_INSTALLER;
    const notaryProfile = process.env.COSIMO_NOTARY_PROFILE;

    if (gitState.dirty)
        errors.push("worktree is dirty, including tracked or untracked files");

    if (!applicationIdentity)
        errors.push("COSIMO_DEVELOPER_ID_APPLICATION is not set");

    if (!installerIdentity)
        errors.push("COSIMO_DEVELOPER_ID_INSTALLER is not set");

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

    if (!identityIsInstalled(applicationIdentity, codeSigningOutput))
        throw new Error(`Developer ID Application identity is not installed: ${applicationIdentity}`);

    if (!identityIsInstalled(installerIdentity, allSigningOutput))
        throw new Error(`Developer ID Installer identity is not installed: ${installerIdentity}`);

    run("xcrun", [
        "notarytool",
        "history",
        "--keychain-profile",
        notaryProfile,
        "--output-format",
        "json",
    ], { capture: true });
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

async function verifyBuiltVst3(config) {
    const vst3Path = path.join(repoRoot, config.paths.builtVst3);
    const binaryPath = path.join(vst3Path, "Contents", "MacOS", config.identity.bundleName);

    if (!await pathExists(vst3Path))
        throw new Error(`Built VST3 bundle not found: ${config.paths.builtVst3}`);

    if (!await pathExists(binaryPath))
        throw new Error(`Built VST3 binary not found: ${path.relative(repoRoot, binaryPath)}`);

    verifyCodesign(vst3Path);
    verifyPatchedWebView(config, binaryPath);

    return {
        architectures: binaryArchitectures(config, binaryPath),
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
    run("xar", ["--compression", "none", "-cf", packagePath, "Bom", "Payload", "PackageInfo"], {
        capture: true,
        cwd: packageRoot,
        env: { COPYFILE_DISABLE: "1", SOURCE_DATE_EPOCH: String(sourceDateEpoch) },
    });
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
        ...(signed ? [`${root}/Contents/_CodeSignature/CodeResources`] : []),
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

function signStagedVst3(vst3Path) {
    const identity = process.env.COSIMO_DEVELOPER_ID_APPLICATION;

    run("codesign", [
        "--force",
        "--deep",
        "--options",
        "runtime",
        "--timestamp",
        "--sign",
        identity,
        vst3Path,
    ], { capture: true });
    verifyCodesign(vst3Path);

    return {
        identity,
        signedWithDeveloperId: true,
        timestamped: true,
    };
}

function removeLocalBuildSignature(vst3Path) {
    run("codesign", ["--remove-signature", vst3Path], { capture: true });
}

function signInstaller(unsignedPackagePath, signedPackagePath) {
    const identity = process.env.COSIMO_DEVELOPER_ID_INSTALLER;

    run("productsign", ["--sign", identity, unsignedPackagePath, signedPackagePath], { capture: true });
    const verification = run("pkgutil", ["--check-signature", signedPackagePath], { capture: true });

    return {
        identity,
        signedWithDeveloperId: true,
        verification: [verification.stdout, verification.stderr].filter(Boolean).join("\n").trim(),
    };
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

    run("xcrun", ["stapler", "staple", packagePath], { capture: true });
    const stapler = run("xcrun", ["stapler", "validate", packagePath], { capture: true });
    const gatekeeper = run("spctl", ["-a", "-vv", "-t", "install", packagePath], { capture: true });

    return {
        gatekeeperAccepted: true,
        notaryProfile: profile,
        notarizationId: submission.id ?? null,
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
            : "LOCAL UNSIGNED VALIDATION PACKAGE — NOT FOR DISTRIBUTION OR PATREON UPLOAD.",
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

export function createReleaseManifest({
    architectures,
    config,
    gitState,
    notarization,
    options,
    packagePayloadFileCount,
    patchManifest,
    payloadFingerprint,
    signing,
    sourceDateEpoch,
}) {
    const artifactBaseName = seqFxArtifactBaseName(config);

    return {
        schemaVersion: 3,
        artifactClass: options.mode === "release" ? "signed-notarized-release-candidate" : "local-unsigned-validation",
        packagingReady: options.mode === "release",
        distributionReady: false,
        distributionReadinessReason: options.mode === "release"
            ? "The builder does not perform packaged pluginval, Ableton/listening acceptance, clean-account Gatekeeper installation, or an authorized Patreon upload."
            : "Unsigned local validation output cannot be distributed.",
        product: config.identity.publicName,
        releaseVersion: config.release.channelVersion,
        scope: config.scope,
        source: {
            commit: gitState.commit,
            dirty: gitState.dirty,
            sourceDateEpoch,
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
        build: {
            builtVst3: config.paths.builtVst3,
            binaryArchitectures: architectures,
            webViewRequiredMarkers: config.webViewMarkers.required,
            webViewForbiddenMarkersAbsent: config.webViewMarkers.forbidden,
        },
        repeatability: {
            deterministicBoundary: "two packaging assemblies of one freshly built normalized unsigned VST3 payload tree, flat package, generated text, and zip",
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
    options,
    outputRoot,
    patchManifest,
    sourceDateEpoch,
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
    await assertArchiveTreeContainsOnlyFilesAndDirectories(stagingRoot);
    await normalizeTreeTimestamps(stagedVst3, sourceDateEpoch);

    const payloadFingerprint = await canonicalPayloadFingerprint(stagingRoot);
    let vst3Signing = {
        identity: null,
        signedWithDeveloperId: false,
        timestamped: false,
        note: "The normalized payload is deliberately unsigned and is not distributable.",
    };

    if (options.mode === "release")
        vst3Signing = signStagedVst3(stagedVst3);

    await normalizeTreeTimestamps(stagingRoot, sourceDateEpoch);
    if (options.mode === "release") {
        verifyCodesign(stagedVst3);
        verifyPatchedWebView(
            config,
            path.join(stagedVst3, "Contents", "MacOS", config.identity.bundleName),
        );
        binaryArchitectures(
            config,
            path.join(stagedVst3, "Contents", "MacOS", config.identity.bundleName),
        );
    }
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
        installerSigning = signInstaller(unsignedPackagePath, packagePath);
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
    const manifest = createReleaseManifest({
        architectures: builtArtifact.architectures,
        config,
        gitState,
        notarization,
        options,
        packagePayloadFileCount: payloadFiles.length,
        patchManifest,
        payloadFingerprint,
        signing: {
            installer: installerSigning,
            vst3: vst3Signing,
        },
        sourceDateEpoch,
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

async function buildReleaseArtifacts({ config, gitState, options, patchManifest, sourceDateEpoch }) {
    if (process.platform !== "darwin")
        throw new Error("SeqFX beta packaging targets macOS and must run on macOS.");

    assertWorktreePolicy(gitState, options);

    if (options.mode === "release")
        assertSignedReleasePrerequisites(config, gitState);

    run(process.execPath, ["fx/prod-effect.mjs", "build", config.productKey, "--clean"]);
    assertSourceStateUnchanged(gitState, getReleaseGitState());

    const builtArtifact = await verifyBuiltVst3(config);
    const outputRoot = path.join(repoRoot, config.release.outputDirectory);
    const primaryArtifacts = await assembleArtifactSet({
        builtArtifact,
        config,
        gitState,
        options,
        outputRoot,
        patchManifest,
        sourceDateEpoch,
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
            options,
            outputRoot: repeatRoot,
            patchManifest,
            sourceDateEpoch,
        });
        const results = await compareArtifactSets(primaryArtifacts, repeatArtifacts);
        const reportPath = path.join(outputRoot, `${seqFxArtifactBaseName(config)}-packaging-repeatability.json`);

        await writeFile(reportPath, `${JSON.stringify({
            schemaVersion: 2,
            sourceCommit: gitState.commit,
            sourceDateEpoch,
            nativeBuildsCompared: 1,
            independentNativeBuildReproducibilityVerified: false,
            claim: "Two packaging assemblies of the same freshly built unsigned VST3 were byte-identical.",
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

    const config = seqFxReleaseConfig;
    const patchManifest = await readPatchManifest(config);
    const plugin = effectPlugins[config.productKey];

    assertReleaseContract(config, patchManifest, plugin);
    const gitState = getReleaseGitState();
    const sourceDateEpoch = resolveSourceDateEpoch({
        gitTimestamp: sourceCommitTimestamp(),
    });
    const plan = createReleasePlan({ config, gitState, mode: options.mode, sourceDateEpoch });

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
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
