import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync, gunzipSync, inflateSync } from "node:zlib";

import {
    adHocVst3SigningArgs,
    attestMatchingVst3Metadata,
    assertArchiveTreeContainsOnlyFilesAndDirectories,
    assertNativeBuildUsedReleaseToolchain,
    assertSafeOutputRoot,
    assertSeqFxDistributableExecutableIsSourceFree,
    canonicalPayloadFingerprint,
    captureVst3ArtifactEvidence,
    captureActualNativeDependencyProvenance,
    createReleaseManifest,
    createReleasePlan,
    deterministicFlatPackageXarArgs,
    deterministicCpioPayload,
    getReleaseGitState,
    normalizePayloadModes,
    normalizeUnsignedFlatPackageXar,
    parseInstallerSigningEvidence,
    parseReleaseArgs,
    parseVst3SigningEvidence,
    payloadInventoryErrors,
    readDeclaredNativeDependencyProvenance,
    releaseContractErrors,
    renderPackageInfo,
    renderReleaseReadme,
    resolveSourceDateEpoch,
    resolveSourceDateEpochEvidence,
    selectApprovedSigningIdentity,
    verifyVst3Metadata,
} from "../scripts/build_seqfx_beta_release.mjs";
import {
    seqFxArtifactBaseName,
    seqFxReleaseConfig,
    unresolvedSeqFxPublicReleaseDecisions,
} from "../scripts/seqfx-release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "build_seqfx_beta_release.mjs");

test("release staging rejects embedded source maps, source content, and TypeScript filenames", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-source-leak-"));
    const executablePath = path.join(fixtureRoot, "CosimoSeqFX");
    context.after(() => rm(fixtureRoot, { recursive: true, force: true }));

    await writeFile(executablePath, Buffer.from([
        "Mach-O fixture",
        "//# sourceMappingURL=app.js.map",
        '\"sourcesContent\":[\"export const leaked = true;\"]',
        "../../../../fx/seqfx/view/SeqFxPatchView.tsx",
        "../../../../fx/seqfx/worker/seqfx-worker-service.ts",
    ].join("\0")));

    await assert.rejects(
        assertSeqFxDistributableExecutableIsSourceFree(executablePath),
        /sourceMappingURL.*sourcesContent.*SeqFxPatchView\.tsx.*seqfx-worker-service\.ts/su,
    );

    await writeFile(executablePath, Buffer.from("Mach-O fixture without private UI provenance"));
    await assert.doesNotReject(assertSeqFxDistributableExecutableIsSourceFree(executablePath));
});

function syntheticUnsignedFlatPackage(creationTime) {
    const toc = Buffer.from([
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<xar>",
        " <toc>",
        '  <checksum style="sha1"><size>20</size><offset>0</offset></checksum>',
        `  <creation-time>${creationTime}</creation-time>`,
        " </toc>",
        "</xar>",
        "",
    ].join("\n"), "utf8");
    const compressedToc = deflateSync(toc);
    const header = Buffer.alloc(28);
    const checksum = createHash("sha1").update(compressedToc).digest();

    header.write("xar!", 0, "ascii");
    header.writeUInt16BE(28, 4);
    header.writeUInt16BE(1, 6);
    header.writeBigUInt64BE(BigInt(compressedToc.length), 8);
    header.writeBigUInt64BE(BigInt(toc.length), 16);
    header.writeUInt32BE(1, 24);

    return Buffer.concat([header, compressedToc, checksum, Buffer.from("payload", "utf8")]);
}

function currentManifest() {
    return readFile(path.join(repoRoot, seqFxReleaseConfig.paths.patchManifest), "utf8")
        .then((source) => JSON.parse(source));
}

function declaredNativeDependencyFixture(config = seqFxReleaseConfig) {
    return {
        schemaVersion: 1,
        declarationPath: config.nativeDependencies.declarationPath,
        cmajor: {
            cpmName: config.nativeDependencies.cmajor.cpmName,
            repository: config.nativeDependencies.cmajor.repository,
            revision: config.nativeDependencies.cmajor.revision,
        },
        choc: {
            repository: config.nativeDependencies.choc.repository,
            revision: config.nativeDependencies.choc.revision,
            submodulePath: config.nativeDependencies.choc.submodulePath,
            source: "Cmajor gitlink pinned by the declared Cmajor revision",
        },
        juce: {
            cpmName: config.nativeDependencies.juce.cpmName,
            repository: config.nativeDependencies.juce.repository,
            revision: config.nativeDependencies.juce.revision,
        },
    };
}

function actualNativeDependencyFixture(config = seqFxReleaseConfig) {
    return {
        schemaVersion: 1,
        cmakeCachePath: config.paths.nativeBuildCmakeCache,
        declarationPath: config.nativeDependencies.declarationPath,
        cmajor: {
            repository: config.nativeDependencies.cmajor.repository,
            declaredRevision: config.nativeDependencies.cmajor.revision,
            actualRevision: config.nativeDependencies.cmajor.revision,
            clean: true,
            originVerified: true,
            sourceDirectoryCacheKey: config.nativeDependencies.cmajor.sourceDirectoryCacheKey,
        },
        choc: {
            repository: config.nativeDependencies.choc.repository,
            declaredRevision: config.nativeDependencies.choc.revision,
            actualRevision: config.nativeDependencies.choc.revision,
            clean: true,
            originVerified: true,
            gitlinkRevision: config.nativeDependencies.choc.revision,
            submodulePath: config.nativeDependencies.choc.submodulePath,
        },
        juce: {
            repository: config.nativeDependencies.juce.repository,
            declaredRevision: config.nativeDependencies.juce.revision,
            actualRevision: config.nativeDependencies.juce.revision,
            clean: true,
            originVerified: true,
            sourceDirectoryCacheKey: config.nativeDependencies.juce.sourceDirectoryCacheKey,
        },
    };
}

function releaseToolchainFixture({ nativeBuildCacheVerified = true } = {}) {
    return {
        schemaVersion: 1,
        externalTools: {
            cmake: {
                provenance: "approved-binary-toolchain",
                sha256: "2fb3d19ecda5c45dd35f826af5f241a81c699dccf010f877948b37ca2addb290",
                version: "4.2.3",
            },
            node: {
                provenance: "approved-binary-toolchain",
                sha256: "5d9d3872911e2340a43b707962e68143de8a4e8d54628845c0c4f2de1fb7cd5c",
                version: "v22.22.3",
            },
        },
        sourceBuiltTools: {
            cmaj: {
                cmajorCommit: "cb616bf1d0931ff92da3826d15a01eadfd8e35b1",
                chocCommit: "98b52fb54c3b9fec03c0c13218f6557aef33eabe",
                executablePolicy: "absolute-repository-build-output-no-path-fallback",
                provenance: "repository-pinned-source-build",
            },
        },
        nativeBuildCacheVerified,
        systemCommands: {
            names: [
                "codesign",
                "ditto",
                "git",
                "lipo",
                "mkbom",
                "pkgutil",
                "plutil",
                "productsign",
                "security",
                "spctl",
                "unzip",
                "xar",
                "xattr",
                "xcrun",
                "zip",
            ],
            policy: "macos-absolute-system-command-map-v1",
        },
    };
}

function vst3MetadataSummaryFixture() {
    return {
        audioClassId: "ABCDEF019182FAEB436F736943734678",
        binary: "Contents/MacOS/CosimoSeqFX",
        bundleIdentifier: "dev.cosimo.seqfx",
        bundlePackageType: "BNDL",
        category: "Fx",
        controllerClassId: "ABCDEF011234ABCD436F736943734678",
        microphonePermissionAbsent: true,
        name: "CosimoSeqFX",
        vendor: "Cosimo",
        version: "0.1.0",
    };
}

function approvedSigningConfigFixture() {
    const config = structuredClone(seqFxReleaseConfig);

    config.approvals.signingAndNotarizationApproved = true;
    config.signing.application = {
        commonName: "Developer ID Application: Cosimo Labs (TEAM123456)",
        sha1Fingerprint: "A".repeat(40),
        teamIdentifier: "TEAM123456",
    };
    config.signing.installer = {
        commonName: "Developer ID Installer: Cosimo Labs (TEAM123456)",
        sha1Fingerprint: "B".repeat(40),
        teamIdentifier: "TEAM123456",
    };

    return config;
}

function signedReleaseEvidenceFixture(config = approvedSigningConfigFixture()) {
    return {
        notarization: {
            gatekeeperAccepted: true,
            gatekeeperAssessment: "accepted",
            notarizationId: "11111111-2222-3333-4444-555555555555",
            notarizationStatus: "Accepted",
            notarized: true,
            stapled: true,
            staplerValidation: "The validate action worked!",
        },
        signing: {
            installer: {
                identity: config.signing.installer.commonName,
                signedWithDeveloperId: true,
                teamIdentifier: config.signing.installer.teamIdentifier,
                timestamp: "2026-08-30T12:00:00Z",
            },
            vst3: {
                identity: config.signing.application.commonName,
                signedWithDeveloperId: true,
                teamIdentifier: config.signing.application.teamIdentifier,
                timestamp: "2026-08-30T12:00:00Z",
            },
        },
    };
}

function git(repoPath, args) {
    return execFileSync("git", args, {
        cwd: repoPath,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
}

function commitFixture(repoPath, message) {
    git(repoPath, ["add", "."]);
    git(repoPath, [
        "-c", "user.name=SeqFX Release Test",
        "-c", "user.email=seqfx-release-test@example.invalid",
        "commit", "-m", message,
    ]);
    return git(repoPath, ["rev-parse", "HEAD"]);
}

async function createNativeDependencyCheckoutFixture(context) {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-native-provenance-"));
    context.after(() => rm(repositoryRoot, { recursive: true, force: true }));
    const cmajorPath = path.join(repositoryRoot, "checkouts", "cmajor");
    const chocSourcePath = path.join(repositoryRoot, "sources", "choc");
    const jucePath = path.join(repositoryRoot, "checkouts", "juce");
    const cmakeHome = path.join(repositoryRoot, "tools", "effect_plugin_build");
    const cmakeCachePath = path.join(repositoryRoot, "build", "seqfx", "CMakeCache.txt");

    for (const checkoutPath of [cmajorPath, chocSourcePath, jucePath]) {
        await mkdir(checkoutPath, { recursive: true });
        git(checkoutPath, ["init", "--initial-branch=fixture"]);
    }

    await writeFile(path.join(chocSourcePath, "choc.h"), "// fixture CHOC\n", "utf8");
    const chocRevision = commitFixture(chocSourcePath, "fixture CHOC");
    await writeFile(path.join(cmajorPath, "cmajor.txt"), "fixture Cmajor\n", "utf8");
    git(cmajorPath, [
        "-c", "protocol.file.allow=always",
        "submodule", "add", chocSourcePath, "include/choc",
    ]);
    const cmajorRevision = commitFixture(cmajorPath, "fixture Cmajor");
    git(cmajorPath, ["remote", "add", "origin", cmajorPath]);
    await writeFile(path.join(jucePath, "juce.txt"), "fixture JUCE\n", "utf8");
    const juceRevision = commitFixture(jucePath, "fixture JUCE");
    git(jucePath, ["remote", "add", "origin", jucePath]);
    await mkdir(cmakeHome, { recursive: true });
    await mkdir(path.dirname(cmakeCachePath), { recursive: true });
    await writeFile(cmakeCachePath, [
        `CMAKE_HOME_DIRECTORY:INTERNAL=${cmakeHome}`,
        "CMAKE_COMMAND:INTERNAL=/approved/cmake",
        `COSIMO_CMAJ_EXECUTABLE:FILEPATH=${path.join(repositoryRoot, "build", "cmajor_command", "bin", "cmaj")}`,
        `CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR:INTERNAL=${cmajorPath}`,
        `CPM_PACKAGE_cosimo_juce_SOURCE_DIR:INTERNAL=${jucePath}`,
        "",
    ].join("\n"), "utf8");

    const config = structuredClone(seqFxReleaseConfig);
    config.paths.nativeBuildCmakeCache = path.relative(repositoryRoot, cmakeCachePath);
    config.nativeDependencies.cmajor.repository = cmajorPath;
    config.nativeDependencies.cmajor.revision = cmajorRevision;
    config.nativeDependencies.choc.repository = chocSourcePath;
    config.nativeDependencies.choc.revision = chocRevision;
    config.nativeDependencies.juce.repository = jucePath;
    config.nativeDependencies.juce.revision = juceRevision;

    return {
        cmajorPath,
        chocPath: path.join(cmajorPath, "include", "choc"),
        config,
        jucePath,
        repositoryRoot,
    };
}

async function createVst3MetadataFixture(context) {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-vst3-metadata-"));
    context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
    const vst3Path = path.join(fixtureRoot, "CosimoSeqFX.vst3");
    const contentsPath = path.join(vst3Path, "Contents");
    const resourcesPath = path.join(contentsPath, "Resources");
    const binaryPath = path.join(contentsPath, "MacOS", "CosimoSeqFX");

    await mkdir(resourcesPath, { recursive: true });
    await mkdir(path.dirname(binaryPath), { recursive: true });
    await writeFile(binaryPath, "fixture binary\n", "utf8");
    await writeFile(path.join(contentsPath, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key><string>CosimoSeqFX</string>
    <key>CFBundleExecutable</key><string>CosimoSeqFX</string>
    <key>CFBundleIdentifier</key><string>dev.cosimo.seqfx</string>
    <key>CFBundleName</key><string>CosimoSeqFX</string>
    <key>CFBundlePackageType</key><string>BNDL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>0.1.0</string>
</dict>
</plist>
`, "utf8");
    await writeFile(path.join(resourcesPath, "moduleinfo.json"), `{
  "Name": "CosimoSeqFX",
  "Version": "0.1.0",
  "Factory Info": {
    "Vendor": "Cosimo",
    "URL": "",
    "E-Mail": "",
    "Flags": { "Unicode": true, },
  },
  "Classes": [
    {
      "CID": "ABCDEF019182FAEB436F736943734678",
      "Category": "Audio Module Class",
      "Name": "CosimoSeqFX",
      "Vendor": "Cosimo",
      "Version": "0.1.0",
      "Sub Categories": [ "Fx", ],
    },
    {
      "CID": "ABCDEF011234ABCD436F736943734678",
      "Category": "Component Controller Class",
      "Name": "CosimoSeqFX",
      "Vendor": "Cosimo",
      "Version": "0.1.0",
      "Sub Categories": [ "Fx", ],
    },
  ],
}
`, "utf8");

    return vst3Path;
}

test("release config freezes the existing beta identity and current native output path", () => {
    assert.equal(seqFxReleaseConfig.schemaVersion, 4);
    assert.deepEqual(seqFxReleaseConfig.identity, {
        publicName: "Cosimo SeqFX",
        bundleName: "CosimoSeqFX",
        manufacturer: "Cosimo",
        patchId: "dev.cosimo.seqfx",
        pluginCode: "CsFx",
        manufacturerCode: "Cosi",
        pluginVersion: "0.1.0",
        installerIdentifier: "dev.cosimo.seqfx.pkg",
    });
    assert.equal(seqFxReleaseConfig.release.channelVersion, "0.1.0-beta.1");
    assert.equal(
        seqFxReleaseConfig.paths.builtVst3,
        "build/seqfx_juce/_build/plugin/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3",
    );
    assert.deepEqual(seqFxReleaseConfig.nativeDependencies, {
        declarationPath: "cmake/CosimoDependencies.cmake",
        cmajor: {
            cpmName: "cosimo_cmajor",
            sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR",
            repository: "https://github.com/androidStern-personal/cmajor.git",
            revision: "cb616bf1d0931ff92da3826d15a01eadfd8e35b1",
        },
        choc: {
            repository: "https://github.com/androidStern-personal/choc.git",
            revision: "98b52fb54c3b9fec03c0c13218f6557aef33eabe",
            submodulePath: "include/choc",
        },
        juce: {
            cpmName: "cosimo_juce",
            sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_juce_SOURCE_DIR",
            repository: "https://github.com/juce-framework/JUCE.git",
            revision: "501c07674e1ad693085a7e7c398f205c2677f5da",
        },
    });
    assert.deepEqual(seqFxReleaseConfig.nativeMetadata, {
        bundlePackageType: "BNDL",
        vst3Category: "Fx",
        audioClass: {
            category: "Audio Module Class",
            cid: "ABCDEF019182FAEB436F736943734678",
        },
        controllerClass: {
            category: "Component Controller Class",
            cid: "ABCDEF011234ABCD436F736943734678",
        },
    });
    assert.deepEqual(seqFxReleaseConfig.signing, {
        application: {
            commonName: null,
            sha1Fingerprint: null,
            teamIdentifier: null,
        },
        installer: {
            commonName: null,
            sha1Fingerprint: null,
            teamIdentifier: null,
        },
    });
    assert.equal(seqFxArtifactBaseName(), "CosimoSeqFX-0.1.0-beta.1-macOS");
});

test("unresolved public decisions are explicit release gates, not guessed values", () => {
    assert.deepEqual(
        unresolvedSeqFxPublicReleaseDecisions().map((gate) => gate.id),
        [
            "public-identity-approval",
            "beta-version-approval",
            "cmajor-distribution-rights",
            "juce-distribution-rights",
            "signing-notarization-authorization",
            "minimum-macos-version",
            "support-contact",
            "patreon-delivery-surface",
        ],
    );
});

test("release argument parsing defaults to unsigned and separates plan from release", () => {
    assert.deepEqual(parseReleaseArgs(["node", "script"]), {
        allowDirty: false,
        help: false,
        json: false,
        mode: "unsigned",
        verifyRepeatablePackaging: false,
    });
    assert.equal(parseReleaseArgs(["node", "script", "--plan", "--json"]).mode, "plan");
    assert.equal(parseReleaseArgs(["node", "script", "--release"]).mode, "release");
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--release", "--allow-dirty"]),
        /cannot be combined/u,
    );
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--release", "--verify-repeatable-packaging"]),
        /unsigned packaging only/u,
    );
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--release", "--skip-build"]),
        /Unknown argument/u,
    );
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--verify-reproducible"]),
        /Unknown argument/u,
    );
});

test("installed signing identity selection requires exact common name, fingerprint, and team", () => {
    const exactIdentity = {
        commonName: "Developer ID Application: Cosimo Labs (TEAM123456)",
        sha1Fingerprint: "B".repeat(40),
        teamIdentifier: "TEAM123456",
    };
    const securityOutput = `
  1) ${"A".repeat(40)} "Developer ID Application: Cosimo Labs Evil (TEAM123456)"
  2) ${"B".repeat(40)} "Developer ID Application: Cosimo Labs (TEAM123456)"
     2 valid identities found
`;

    assert.deepEqual(
        selectApprovedSigningIdentity(exactIdentity, securityOutput, "application"),
        exactIdentity,
    );
    assert.throws(
        () => selectApprovedSigningIdentity({
            ...exactIdentity,
            sha1Fingerprint: "A".repeat(40),
        }, securityOutput, "application"),
        /exact approved application signing identity/u,
    );
});

test("artifact signing evidence is parsed from exact identity, team, and timestamp output", () => {
    const config = approvedSigningConfigFixture();
    const vst3Output = `
Authority=${config.signing.application.commonName}
Authority=Developer ID Certification Authority
Timestamp=2026-08-30T12:00:00Z
TeamIdentifier=${config.signing.application.teamIdentifier}
`;
    const installerOutput = `
Package "CosimoSeqFX.pkg":
   Status: signed by a developer certificate issued by Apple for distribution
   Signed with a trusted timestamp on: 2026-08-30 12:01:00 +0000
   Certificate Chain:
    1. ${config.signing.installer.commonName}
       SHA1 fingerprint: ${config.signing.installer.sha1Fingerprint.match(/.{2}/gu).join(" ")}
`;

    assert.deepEqual(
        parseVst3SigningEvidence(vst3Output, config.signing.application),
        signedReleaseEvidenceFixture(config).signing.vst3,
    );
    assert.deepEqual(
        parseInstallerSigningEvidence(installerOutput, config.signing.installer),
        {
            ...signedReleaseEvidenceFixture(config).signing.installer,
            timestamp: "2026-08-30 12:01:00 +0000",
        },
    );
    assert.equal(
        "sha1Fingerprint" in parseInstallerSigningEvidence(
            installerOutput.replace(/^\s*SHA1 fingerprint:.*$/mu, ""),
            config.signing.installer,
        ),
        false,
    );
    assert.throws(
        () => parseInstallerSigningEvidence(
            installerOutput.replace(
                config.signing.installer.sha1Fingerprint.match(/.{2}/gu).join(" "),
                "C0 ".repeat(19) + "C0",
            ),
            config.signing.installer,
        ),
        /fingerprint does not match/u,
    );
    assert.throws(
        () => parseVst3SigningEvidence(
            vst3Output.replace(config.signing.application.commonName, `${config.signing.application.commonName} Evil`),
            config.signing.application,
        ),
        /exact approved VST3 signing identity/u,
    );
});

test("release git state treats untracked source as dirty", async () => {
    const isolatedRepo = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-git-state-"));

    try {
        execFileSync("git", ["init", "--initial-branch=test"], { cwd: isolatedRepo });
        await writeFile(path.join(isolatedRepo, "tracked.txt"), "tracked\n", "utf8");
        execFileSync("git", ["add", "tracked.txt"], { cwd: isolatedRepo });
        execFileSync("git", [
            "-c", "user.name=SeqFX Release Test",
            "-c", "user.email=seqfx-release-test@example.invalid",
            "commit", "-m", "fixture",
        ], { cwd: isolatedRepo });
        await writeFile(path.join(isolatedRepo, "untracked.txt"), "untracked\n", "utf8");

        const gitState = getReleaseGitState({ cwd: isolatedRepo });
        assert.equal(gitState.dirty, true);
        assert.match(gitState.worktreeStatus, /untracked\.txt/u);
    } finally {
        await rm(isolatedRepo, { recursive: true, force: true });
    }
});

test("release config matches the current patch manifest and effect build registry", async () => {
    assert.deepEqual(releaseContractErrors(seqFxReleaseConfig, await currentManifest()), []);
});

test("native metadata validation accepts the exact approved VST3 identity and no microphone permission", async (context) => {
    const vst3Path = await createVst3MetadataFixture(context);
    const metadata = await verifyVst3Metadata(seqFxReleaseConfig, vst3Path);

    assert.deepEqual(metadata, vst3MetadataSummaryFixture());
});

test("built VST3 evidence records exact bundle and executable sizes and SHA-256", async (context) => {
    const vst3Path = await createVst3MetadataFixture(context);
    const evidence = await captureVst3ArtifactEvidence(seqFxReleaseConfig, vst3Path);
    const executableContents = Buffer.from("fixture binary\n", "utf8");

    assert.deepEqual(evidence.executable, {
        path: "Contents/MacOS/CosimoSeqFX",
        sha256: createHash("sha256").update(executableContents).digest("hex"),
        sizeBytes: executableContents.length,
    });
    assert.equal(evidence.bundle.algorithm, "sha256-path-kind-mode-content-v1");
    assert.match(evidence.bundle.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(evidence.bundle.sizeBytes > evidence.executable.sizeBytes);
    assert.equal(evidence.bundle.fileCount, 3);

    await writeFile(
        path.join(vst3Path, evidence.executable.path),
        "changed binary\n",
        "utf8",
    );
    assert.notEqual(
        (await captureVst3ArtifactEvidence(seqFxReleaseConfig, vst3Path)).bundle.sha256,
        evidence.bundle.sha256,
    );
});

test("native metadata validation rejects identity, category, and binary drift together", async (context) => {
    const vst3Path = await createVst3MetadataFixture(context);
    const infoPlistPath = path.join(vst3Path, "Contents", "Info.plist");
    const moduleInfoPath = path.join(vst3Path, "Contents", "Resources", "moduleinfo.json");
    const binaryPath = path.join(vst3Path, "Contents", "MacOS", "CosimoSeqFX");
    execFileSync("plutil", [
        "-replace", "CFBundleIdentifier", "-string", "com.example.wrong", infoPlistPath,
    ]);
    await writeFile(
        moduleInfoPath,
        (await readFile(moduleInfoPath, "utf8")).replaceAll('"Fx"', '"Instrument"'),
        "utf8",
    );
    await rm(binaryPath);

    await assert.rejects(
        verifyVst3Metadata(seqFxReleaseConfig, vst3Path),
        (error) => {
            assert.match(error.message, /CFBundleIdentifier/u);
            assert.match(error.message, /sub-categories/u);
            assert.match(error.message, /VST3 binary is missing/u);
            return true;
        },
    );
});

test("native metadata validation rejects microphone permission keys and usage text", async (context) => {
    const vst3Path = await createVst3MetadataFixture(context);
    const infoPlistPath = path.join(vst3Path, "Contents", "Info.plist");
    execFileSync("plutil", [
        "-insert",
        "NSMicrophoneUsageDescription",
        "-string",
        "This app requires the built-in microphone.",
        infoPlistPath,
    ]);

    await assert.rejects(
        verifyVst3Metadata(seqFxReleaseConfig, vst3Path),
        /microphone permission or usage text is forbidden.*NSMicrophoneUsageDescription/isu,
    );
});

test("release metadata attestation independently validates matching built and staged bundles", async (context) => {
    const builtVst3 = await createVst3MetadataFixture(context);
    const stagedVst3 = await createVst3MetadataFixture(context);

    assert.deepEqual(
        await attestMatchingVst3Metadata(seqFxReleaseConfig, builtVst3, stagedVst3),
        {
            built: vst3MetadataSummaryFixture(),
            staged: vst3MetadataSummaryFixture(),
            stagedMatchesBuilt: true,
        },
    );
});

test("release metadata attestation rejects staged metadata drift", async (context) => {
    const builtVst3 = await createVst3MetadataFixture(context);
    const stagedVst3 = await createVst3MetadataFixture(context);
    const stagedInfoPlist = path.join(stagedVst3, "Contents", "Info.plist");
    execFileSync("plutil", [
        "-replace", "CFBundleExecutable", "-string", "WrongBinary", stagedInfoPlist,
    ]);

    await assert.rejects(
        attestMatchingVst3Metadata(seqFxReleaseConfig, builtVst3, stagedVst3),
        /CFBundleExecutable/u,
    );
});

test("release planning fails closed over the exact production CMake dependency declarations", async (context) => {
    assert.deepEqual(
        await readDeclaredNativeDependencyProvenance(),
        declaredNativeDependencyFixture(),
    );

    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-declaration-drift-"));
    context.after(() => rm(repositoryRoot, { recursive: true, force: true }));
    const declarationPath = path.join(
        repositoryRoot,
        seqFxReleaseConfig.nativeDependencies.declarationPath,
    );
    const currentDeclaration = await readFile(
        path.join(repoRoot, seqFxReleaseConfig.nativeDependencies.declarationPath),
        "utf8",
    );
    await mkdir(path.dirname(declarationPath), { recursive: true });
    await writeFile(
        declarationPath,
        currentDeclaration.replace(
            seqFxReleaseConfig.nativeDependencies.cmajor.revision,
            "0".repeat(40),
        ),
        "utf8",
    );

    await assert.rejects(
        readDeclaredNativeDependencyProvenance(seqFxReleaseConfig, { repositoryRoot }),
        /Cmajor production dependency revision drift/u,
    );
});

test("post-build provenance resolves CMake-selected clean Cmajor, CHOC, and JUCE checkouts", async (context) => {
    const fixture = await createNativeDependencyCheckoutFixture(context);
    const provenance = await captureActualNativeDependencyProvenance(fixture.config, {
        repositoryRoot: fixture.repositoryRoot,
    });

    assert.deepEqual(provenance, actualNativeDependencyFixture(fixture.config));
    assert.equal("checkoutPath" in provenance.cmajor, false);
    assert.equal("checkoutPath" in provenance.choc, false);
    assert.equal("checkoutPath" in provenance.juce, false);

    git(fixture.jucePath, ["remote", "set-url", "origin", `${fixture.jucePath}-other`]);
    await assert.rejects(
        captureActualNativeDependencyProvenance(fixture.config, {
            repositoryRoot: fixture.repositoryRoot,
        }),
        /JUCE checkout origin drift/u,
    );
    git(fixture.jucePath, ["remote", "set-url", "origin", fixture.jucePath]);
    await writeFile(path.join(fixture.jucePath, "dirty.txt"), "dirty\n", "utf8");
    await assert.rejects(
        captureActualNativeDependencyProvenance(fixture.config, {
            repositoryRoot: fixture.repositoryRoot,
        }),
        /JUCE checkout is dirty after the native build/u,
    );
});

test("native build provenance rejects CMake or source-built cmaj execution-path drift", async (context) => {
    const fixture = await createNativeDependencyCheckoutFixture(context);

    await assert.doesNotReject(assertNativeBuildUsedReleaseToolchain(
        fixture.config,
        { cmake: "/approved/cmake" },
        { repositoryRoot: fixture.repositoryRoot },
    ));
    await assert.rejects(
        assertNativeBuildUsedReleaseToolchain(
            fixture.config,
            { cmake: "/different/cmake" },
            { repositoryRoot: fixture.repositoryRoot },
        ),
        /CMake executable drift/u,
    );
    const cmakeCachePath = path.join(fixture.repositoryRoot, fixture.config.paths.nativeBuildCmakeCache);
    await writeFile(
        cmakeCachePath,
        (await readFile(cmakeCachePath, "utf8")).replace(
            path.join(fixture.repositoryRoot, "build", "cmajor_command", "bin", "cmaj"),
            "/different/cmaj",
        ),
        "utf8",
    );
    await assert.rejects(
        assertNativeBuildUsedReleaseToolchain(
            fixture.config,
            { cmake: "/approved/cmake" },
            { repositoryRoot: fixture.repositoryRoot },
        ),
        /source-built cmaj executable drift/u,
    );
});

test("post-build provenance rejects a CHOC checkout that differs from Cmajor's gitlink", async (context) => {
    const fixture = await createNativeDependencyCheckoutFixture(context);
    await writeFile(path.join(fixture.chocPath, "new.txt"), "different revision\n", "utf8");
    const differentRevision = commitFixture(fixture.chocPath, "different CHOC");

    await assert.rejects(
        captureActualNativeDependencyProvenance(fixture.config, {
            repositoryRoot: fixture.repositoryRoot,
        }),
        new RegExp(`Cmajor checkout is dirty|CHOC checkout revision drift:.*${differentRevision}`, "u"),
    );
});

test("tracked third-party notices cover the embedded runtime and artwork", async () => {
    const notices = await readFile(path.join(repoRoot, seqFxReleaseConfig.paths.thirdPartyNotices), "utf8");
    const requiredComponents = [
        "Cmajor",
        "JUCE",
        "FONTAUDIO SVG ICONS",
        "CHOC",
        "QUICKJS",
        "FLAC",
        "OGG/VORBIS",
        "MINIMP3",
        "STEINBERG VST3 SDK",
        "HARFBUZZ",
        "SHEENBIDI",
        "INDEPENDENT JPEG GROUP",
        "LIBPNG",
        "ZLIB",
        "REACT, REACT-DOM, AND SCHEDULER",
    ];

    for (const component of requiredComponents)
        assert.match(notices, new RegExp(`^${component.replaceAll("+", "\\+")}$`, "mu"));

    assert.match(notices, /does not grant distribution\s+rights/u);
    assert.match(notices, /cb616bf1d0931ff92da3826d15a01eadfd8e35b1/u);
    assert.match(notices, /98b52fb54c3b9fec03c0c13218f6557aef33eabe/u);
    assert.match(notices, /501c07674e1ad693085a7e7c398f205c2677f5da/u);
    assert.match(notices, /320ea19819bf66429fa772d6c04614ae75815895/u);
    assert.match(notices, /Creative Commons Attribution 4\.0 International/u);
    assert.match(notices, /This software is based in part on the work of the Independent JPEG Group\./u);
    assert.doesNotMatch(notices, /CHOC_REGISTER_OPEN_SOURCE_LICENCE|^#ifdef|\)"\)$/mu);
});

test("release contract reports identity and path drift before packaging", async () => {
    const driftedConfig = structuredClone(seqFxReleaseConfig);
    driftedConfig.identity.patchId = "com.example.changed";
    driftedConfig.paths.builtVst3 = "build/seqfx_juce/_build/old-path/CosimoSeqFX.vst3";
    const errors = releaseContractErrors(driftedConfig, await currentManifest());

    assert.ok(errors.some((error) => error.includes("patch ID drift")));
    assert.ok(errors.some((error) => error.includes("native build path")));
});

test("read-only plan names exact side effects, current paths, and release blockers", () => {
    const plan = createReleasePlan({
        config: seqFxReleaseConfig,
        declaredNativeDependencies: declaredNativeDependencyFixture(),
        gitState: {
            branch: "codex/test",
            commit: "a".repeat(40),
            dirty: false,
            worktreeStatus: "",
        },
        mode: "plan",
        releaseToolchain: releaseToolchainFixture({ nativeBuildCacheVerified: false }),
        sourceDateEpoch: 1_700_000_000,
    });

    assert.deepEqual(plan.sideEffects, []);
    assert.equal(plan.schemaVersion, 3);
    assert.equal(plan.publicReleaseBlocked, true);
    assert.match(plan.paths.builtVst3, /_build\/plugin\/CosimoSeqFX_artefacts/u);
    assert.match(plan.repeatability.deterministicBoundary, /one freshly built ad-hoc-signed VST3/u);
    assert.equal(plan.repeatability.independentNativeBuildsCompared, false);
    assert.equal(plan.repeatability.signedArtifactBytesReproducible, false);
    assert.equal(
        plan.nativeDependencyProvenance.declared.choc.revision,
        seqFxReleaseConfig.nativeDependencies.choc.revision,
    );
    assert.equal(plan.nativeDependencyProvenance.postBuildVerification.requiredBeforePackaging, true);
    assert.equal(plan.releaseToolchain.nativeBuildCacheVerified, false);
    assert.ok(plan.explicitlyNeverPerformed.includes("Patreon upload"));
});

test("plan CLI is dry-run safe and returns machine-readable output", () => {
    const statusBefore = execFileSync("git", ["status", "--porcelain"], {
        cwd: repoRoot,
        encoding: "utf8",
    });
    const output = execFileSync(process.execPath, [scriptPath, "--plan", "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
    });
    const statusAfter = execFileSync("git", ["status", "--porcelain"], {
        cwd: repoRoot,
        encoding: "utf8",
    });
    const plan = JSON.parse(output);

    assert.equal(plan.mode, "plan");
    assert.deepEqual(plan.sideEffects, []);
    assert.equal(statusAfter, statusBefore);
});

test("source date epoch is explicit and ZIP-safe", () => {
    assert.equal(resolveSourceDateEpoch({ env: { SOURCE_DATE_EPOCH: "1700000000" } }), 1_700_000_000);
    assert.deepEqual(
        resolveSourceDateEpochEvidence({
            env: { SOURCE_DATE_EPOCH: "1700000000" },
            gitTimestamp: "1600000000",
        }),
        {
            origin: "SOURCE_DATE_EPOCH",
            sourceDateEpoch: 1_700_000_000,
        },
    );
    assert.deepEqual(
        resolveSourceDateEpochEvidence({ env: {}, gitTimestamp: "1600000000" }),
        {
            origin: "source-commit-timestamp",
            sourceDateEpoch: 1_600_000_000,
        },
    );
    assert.equal(resolveSourceDateEpoch({ env: {}, gitTimestamp: "1700000001" }), 1_700_000_001);
    assert.throws(
        () => resolveSourceDateEpoch({ env: { SOURCE_DATE_EPOCH: "123" } }),
        /at or after 1980/u,
    );
});

test("canonical payload fingerprint ignores timestamps but detects bytes and modes", async (context) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-fingerprint-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "Contents", "MacOS"), { recursive: true });
    const binary = path.join(root, "Contents", "MacOS", "CosimoSeqFX");
    await writeFile(binary, "same bytes", "utf8");
    await chmod(binary, 0o755);
    const first = await canonicalPayloadFingerprint(root);

    await utimes(binary, new Date("2020-01-01T00:00:00Z"), new Date("2020-01-01T00:00:00Z"));
    const timestampOnly = await canonicalPayloadFingerprint(root);
    assert.equal(timestampOnly.digest, first.digest);

    await writeFile(binary, "changed bytes", "utf8");
    const changedBytes = await canonicalPayloadFingerprint(root);
    assert.notEqual(changedBytes.digest, first.digest);

    await writeFile(binary, "same bytes", "utf8");
    await chmod(binary, 0o644);
    const changedMode = await canonicalPayloadFingerprint(root);
    assert.notEqual(changedMode.digest, first.digest);
});

test("unsigned cpio payload bytes do not depend on filesystem inode or timestamp", async (context) => {
    const firstRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-cpio-a-"));
    const secondRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-cpio-b-"));
    context.after(() => Promise.all([
        rm(firstRoot, { recursive: true, force: true }),
        rm(secondRoot, { recursive: true, force: true }),
    ]));

    for (const root of [firstRoot, secondRoot]) {
        await mkdir(path.join(root, "Library", "Audio", "Plug-Ins"), { recursive: true });
        await writeFile(path.join(root, "Library", "Audio", "Plug-Ins", "fixture.txt"), "payload", "utf8");
    }

    const oldTimestamp = new Date("2021-01-01T00:00:00Z");
    const newTimestamp = new Date("2025-01-01T00:00:00Z");
    await utimes(path.join(firstRoot, "Library"), oldTimestamp, oldTimestamp);
    await utimes(path.join(secondRoot, "Library"), newTimestamp, newTimestamp);

    const first = await deterministicCpioPayload(firstRoot, 1_700_000_000);
    const second = await deterministicCpioPayload(secondRoot, 1_700_000_000);
    assert.deepEqual(second, first);

    const listing = spawnSync("cpio", ["-it"], {
        encoding: "utf8",
        input: gunzipSync(first),
    });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /\.\/Library\/Audio\/Plug-Ins\/fixture\.txt/u);

    await writeFile(path.join(secondRoot, "Library", "Audio", "Plug-Ins", "fixture.txt"), "changed", "utf8");
    assert.notDeepEqual(
        await deterministicCpioPayload(secondRoot, 1_700_000_000),
        first,
    );
});

test("unsigned flat-package XAR creation excludes host metadata and fixes its archive time", () => {
    const packagePath = "/private/tmp/CosimoSeqFX.pkg";
    assert.deepEqual(deterministicFlatPackageXarArgs(packagePath), [
        "--compression",
        "none",
        "--distribution",
        "-cf",
        packagePath,
        "Bom",
        "Payload",
        "PackageInfo",
    ]);

    const sourceDateEpoch = 1_700_000_000;
    const first = normalizeUnsignedFlatPackageXar(
        syntheticUnsignedFlatPackage("2025-01-01T00:00:00"),
        sourceDateEpoch,
    );
    const second = normalizeUnsignedFlatPackageXar(
        syntheticUnsignedFlatPackage("2026-08-30T11:35:20"),
        sourceDateEpoch,
    );

    assert.deepEqual(second, first);

    const compressedLength = Number(first.readBigUInt64BE(8));
    const compressedToc = first.subarray(28, 28 + compressedLength);
    const toc = inflateSync(compressedToc).toString("utf8");
    const heap = first.subarray(28 + compressedLength);

    assert.match(toc, /<creation-time>2023-11-14T22:13:20<\/creation-time>/u);
    assert.deepEqual(heap.subarray(0, 20), createHash("sha1").update(compressedToc).digest());
    assert.equal(heap.subarray(20).toString("utf8"), "payload");
});

test("unsigned flat-package XAR normalization rejects an invalid TOC checksum", () => {
    const archive = syntheticUnsignedFlatPackage("2025-01-01T00:00:00");
    archive[archive.length - "payload".length - 1] ^= 0xff;

    assert.throws(
        () => normalizeUnsignedFlatPackageXar(archive, 1_700_000_000),
        /TOC checksum does not match/u,
    );
});

test("package metadata comes only from the release config", () => {
    const packageInfo = renderPackageInfo(seqFxReleaseConfig, [
        { isFile: true, relativePath: "example", size: 2048 },
    ]);

    assert.match(packageInfo, /identifier="dev\.cosimo\.seqfx\.pkg"/u);
    assert.match(packageInfo, /id="dev\.cosimo\.seqfx"/u);
    assert.match(packageInfo, /CosimoSeqFX\.vst3/u);
    assert.match(packageInfo, /version="0\.1\.0"/u);
});

test("every packaged payload requires a loadable VST3 signature", () => {
    const root = "./Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3";
    const loadableFiles = [
        `${root}/Contents/Info.plist`,
        `${root}/Contents/MacOS/CosimoSeqFX`,
        `${root}/Contents/Resources/moduleinfo.json`,
        `${root}/Contents/_CodeSignature/CodeResources`,
    ];

    assert.deepEqual(payloadInventoryErrors(seqFxReleaseConfig, loadableFiles, { signed: false }), []);
    assert.match(
        payloadInventoryErrors(seqFxReleaseConfig, loadableFiles.slice(0, -1), { signed: false }).join("\n"),
        /_CodeSignature\/CodeResources/u,
    );
    assert.match(
        payloadInventoryErrors(seqFxReleaseConfig, [...loadableFiles, `${root}/Contents/.DS_Store`], { signed: false }).join("\n"),
        /metadata files/u,
    );
    assert.match(
        payloadInventoryErrors(
            seqFxReleaseConfig,
            [...loadableFiles, "./Library/LaunchDaemons/dev.cosimo.seqfx.plist"],
            { signed: false },
        ).join("\n"),
        /outside the declared VST3 install root/u,
    );
    assert.match(
        payloadInventoryErrors(
            seqFxReleaseConfig,
            [...loadableFiles, `${root}/../escaped`],
            { signed: false },
        ).join("\n"),
        /outside the declared VST3 install root/u,
    );
});

test("local validation uses a deterministic ad-hoc VST3 signature without release credentials", () => {
    assert.deepEqual(adHocVst3SigningArgs("/private/tmp/CosimoSeqFX.vst3"), [
        "--force",
        "--sign",
        "-",
        "/private/tmp/CosimoSeqFX.vst3",
    ]);
});

test("release output deletion rejects symlinked ancestors", async (context) => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-output-root-"));
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-external-"));
    context.after(() => Promise.all([
        rm(repositoryRoot, { recursive: true, force: true }),
        rm(externalRoot, { recursive: true, force: true }),
    ]));
    await mkdir(path.join(repositoryRoot, "release"), { recursive: true });
    await writeFile(path.join(externalRoot, "sentinel.txt"), "must survive\n", "utf8");
    await symlink(externalRoot, path.join(repositoryRoot, "release", "seqfx"));

    const outputRoot = path.join(repositoryRoot, seqFxReleaseConfig.release.outputDirectory);
    await assert.rejects(
        assertSafeOutputRoot(seqFxReleaseConfig, outputRoot, { repositoryRoot }),
        /traverses a symlink/u,
    );
    assert.equal(await readFile(path.join(externalRoot, "sentinel.txt"), "utf8"), "must survive\n");
});

test("release archive rejects symlinks and special entries", async (context) => {
    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-archive-tree-"));
    context.after(() => rm(archiveRoot, { recursive: true, force: true }));
    await writeFile(path.join(archiveRoot, "payload.txt"), "payload\n", "utf8");
    await assertArchiveTreeContainsOnlyFilesAndDirectories(archiveRoot);
    await symlink("payload.txt", path.join(archiveRoot, "alias.txt"));
    await assert.rejects(
        assertArchiveTreeContainsOnlyFilesAndDirectories(archiveRoot),
        /symlink or special entries: alias\.txt/u,
    );
});

test("payload modes normalize to the release contract and reject writable privilege drift", async (context) => {
    const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-modes-"));
    context.after(() => rm(stagingRoot, { recursive: true, force: true }));
    const vst3Root = path.join(
        stagingRoot,
        "Library",
        "Audio",
        "Plug-Ins",
        "VST3",
        "CosimoSeqFX.vst3",
    );
    const binaryPath = path.join(vst3Root, "Contents", "MacOS", "CosimoSeqFX");
    const metadataPath = path.join(vst3Root, "Contents", "Info.plist");

    await mkdir(path.dirname(binaryPath), { recursive: true });
    await writeFile(binaryPath, "binary", "utf8");
    await writeFile(metadataPath, "metadata", "utf8");
    await chmod(stagingRoot, 0o700);
    await chmod(vst3Root, 0o700);
    await chmod(binaryPath, 0o700);
    await chmod(metadataPath, 0o600);

    await normalizePayloadModes(seqFxReleaseConfig, stagingRoot);

    assert.equal((await lstat(stagingRoot)).mode & 0o7777, 0o755);
    assert.equal((await lstat(vst3Root)).mode & 0o7777, 0o755);
    assert.equal((await lstat(binaryPath)).mode & 0o7777, 0o755);
    assert.equal((await lstat(metadataPath)).mode & 0o7777, 0o644);

    await chmod(metadataPath, 0o664);
    await assert.rejects(
        normalizePayloadModes(seqFxReleaseConfig, stagingRoot),
        /group\/world-writable.*Info\.plist/iu,
    );
    await chmod(metadataPath, 0o644);
    await chmod(binaryPath, 0o4755);
    await assert.rejects(
        normalizePayloadModes(seqFxReleaseConfig, stagingRoot),
        /setuid\/setgid.*CosimoSeqFX/iu,
    );
});

test("README labels unsigned output honestly", () => {
    const unsignedReadme = renderReleaseReadme(seqFxReleaseConfig, { signedRelease: false });
    const signedReadme = renderReleaseReadme(seqFxReleaseConfig, { signedRelease: true });

    assert.match(unsignedReadme, /NOT FOR DISTRIBUTION OR PATREON UPLOAD/u);
    assert.match(unsignedReadme, /VST3 payload is ad-hoc signed for local loading/u);
    assert.match(unsignedReadme, /installer is not Developer ID-signed or notarized/u);
    assert.match(unsignedReadme, /Minimum macOS version is not yet approved/u);
    assert.doesNotMatch(signedReadme, /LOCAL VALIDATION PACKAGE/u);
});

test("unsigned manifest is deterministic and never claims host or upload acceptance", async () => {
    const patchManifest = await currentManifest();
    const inputs = {
        architectures: ["arm64", "x86_64"],
        builtVst3Evidence: {
            bundle: {
                algorithm: "sha256-path-kind-mode-content-v1",
                fileCount: 12,
                sha256: "d".repeat(64),
                sizeBytes: 123_456,
            },
            executable: {
                path: "Contents/MacOS/CosimoSeqFX",
                sha256: "e".repeat(64),
                sizeBytes: 98_765,
            },
        },
        config: seqFxReleaseConfig,
        finalGitState: {
            branch: "codex/test",
            commit: "b".repeat(40),
            dirty: false,
            worktreeStatus: "",
        },
        gitState: {
            branch: "codex/test",
            commit: "b".repeat(40),
            dirty: false,
            worktreeStatus: "",
        },
        nativeDependencyProvenance: actualNativeDependencyFixture(),
        notarization: {
            gatekeeperAccepted: false,
            notarized: false,
            stapled: false,
            note: "not run",
        },
        options: {
            mode: "unsigned",
            verifyRepeatablePackaging: true,
        },
        packagePayloadFileCount: 3,
        patchManifest,
        payloadFingerprint: {
            algorithm: "sha256-path-kind-mode-content-v1",
            digest: "c".repeat(64),
            entryCount: 3,
        },
        signing: {
            installer: { signedWithDeveloperId: false },
            vst3: {
                loadableLocally: true,
                signatureKind: "ad-hoc",
                signedWithDeveloperId: false,
            },
        },
        releaseToolchain: releaseToolchainFixture(),
        sourceDateEpoch: 1_700_000_000,
        sourceDateEpochOrigin: "source-commit-timestamp",
        vst3Metadata: {
            built: vst3MetadataSummaryFixture(),
            staged: vst3MetadataSummaryFixture(),
            stagedMatchesBuilt: true,
        },
    };
    const first = createReleaseManifest(inputs);
    const second = createReleaseManifest(inputs);

    assert.deepEqual(second, first);
    assert.equal(first.schemaVersion, 8);
    assert.equal(first.artifactClass, "local-ad-hoc-validation");
    assert.equal(first.signing.vst3.signatureKind, "ad-hoc");
    assert.equal(first.signing.vst3.loadableLocally, true);
    assert.equal(first.distributionReady, false);
    assert.equal(first.packagingReady, false);
    assert.equal("createdAt" in first, false);
    assert.equal("branch" in first.source, false);
    assert.equal(first.source.sourceDateEpochOrigin, "source-commit-timestamp");
    assert.equal(first.repeatability.independentNativeBuildsCompared, false);
    assert.equal(
        first.nativeDependencyProvenance.cmajor.actualRevision,
        seqFxReleaseConfig.nativeDependencies.cmajor.revision,
    );
    assert.equal(first.nativeDependencyProvenance.choc.clean, true);
    assert.equal(first.nativeDependencyProvenance.juce.clean, true);
    assert.deepEqual(first.build.vst3Metadata, inputs.vst3Metadata);
    assert.deepEqual(first.build.builtVst3Evidence, inputs.builtVst3Evidence);
    assert.equal(first.build.releaseToolchain.nativeBuildCacheVerified, true);
    assert.equal(first.artifacts.thirdPartyNotices, "THIRD_PARTY_NOTICES.txt");
    assert.ok(first.operationsNotPerformed.includes("DAW smoke or listening acceptance"));
    assert.ok(first.operationsNotPerformed.includes("Patreon upload"));
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            releaseToolchain: releaseToolchainFixture({ nativeBuildCacheVerified: false }),
        }),
        /native CMake\/source-built-cmaj cache verification/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            builtVst3Evidence: {
                ...inputs.builtVst3Evidence,
                executable: {
                    ...inputs.builtVst3Evidence.executable,
                    sha256: "not-a-sha256",
                },
            },
        }),
        /built VST3 executable SHA-256/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            sourceDateEpochOrigin: "guessed",
        }),
        /SOURCE_DATE_EPOCH origin is invalid/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            finalGitState: {
                ...inputs.finalGitState,
                commit: "f".repeat(40),
            },
        }),
        /source state changed.*final manifest/isu,
    );

    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            options: {
                mode: "release",
                verifyRepeatablePackaging: false,
            },
        }),
        /signed release evidence/u,
    );

    const signedConfig = approvedSigningConfigFixture();
    const signedEvidence = signedReleaseEvidenceFixture(signedConfig);
    const signedCandidate = createReleaseManifest({
        ...inputs,
        config: signedConfig,
        ...signedEvidence,
        options: {
            mode: "release",
            verifyRepeatablePackaging: false,
        },
    });
    assert.equal(signedCandidate.packagingReady, true);
    assert.equal(signedCandidate.distributionReady, false);
    assert.match(signedCandidate.distributionReadinessReason, /Ableton\/listening acceptance/u);
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            config: signedConfig,
            ...signedEvidence,
            signing: {
                ...signedEvidence.signing,
                vst3: {
                    ...signedEvidence.signing.vst3,
                    timestamp: "",
                },
            },
            options: {
                mode: "release",
                verifyRepeatablePackaging: false,
            },
        }),
        /VST3 signing timestamp/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            config: signedConfig,
            ...signedEvidence,
            signing: {
                ...signedEvidence.signing,
                installer: {
                    ...signedEvidence.signing.installer,
                    timestamp: "",
                },
            },
            options: {
                mode: "release",
                verifyRepeatablePackaging: false,
            },
        }),
        /installer signing timestamp/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            config: signedConfig,
            ...signedEvidence,
            signing: {
                ...signedEvidence.signing,
                installer: {
                    ...signedEvidence.signing.installer,
                    teamIdentifier: "WRONG12345",
                },
            },
            options: {
                mode: "release",
                verifyRepeatablePackaging: false,
            },
        }),
        /installer signing team/u,
    );

    for (const [field, value, expectedError] of [
        ["notarized", false, /notarization was not proven/u],
        ["notarizationStatus", "Rejected", /notarization status is not Accepted/u],
        ["notarizationId", "", /Accepted notarization ID/u],
        ["stapled", false, /ticket was not stapled/u],
        ["staplerValidation", "", /stapler validation evidence/u],
        ["gatekeeperAccepted", false, /Gatekeeper acceptance was not proven/u],
        ["gatekeeperAssessment", "", /Gatekeeper assessment evidence/u],
    ]) {
        assert.throws(
            () => createReleaseManifest({
                ...inputs,
                config: signedConfig,
                ...signedEvidence,
                notarization: {
                    ...signedEvidence.notarization,
                    [field]: value,
                },
                options: {
                    mode: "release",
                    verifyRepeatablePackaging: false,
                },
            }),
            expectedError,
        );
    }

    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            nativeDependencyProvenance: {
                ...inputs.nativeDependencyProvenance,
                choc: {
                    ...inputs.nativeDependencyProvenance.choc,
                    clean: false,
                },
            },
        }),
        /CHOC cleanliness/u,
    );
    assert.throws(
        () => createReleaseManifest({
            ...inputs,
            vst3Metadata: {
                ...inputs.vst3Metadata,
                stagedMatchesBuilt: false,
            },
        }),
        /staged metadata was not proven identical/u,
    );
});
