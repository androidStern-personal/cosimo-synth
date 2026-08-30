import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
    assertArchiveTreeContainsOnlyFilesAndDirectories,
    assertSafeOutputRoot,
    canonicalPayloadFingerprint,
    captureActualNativeDependencyProvenance,
    createReleaseManifest,
    createReleasePlan,
    deterministicCpioPayload,
    getReleaseGitState,
    parseReleaseArgs,
    payloadInventoryErrors,
    readDeclaredNativeDependencyProvenance,
    releaseContractErrors,
    renderPackageInfo,
    renderReleaseReadme,
    resolveSourceDateEpoch,
} from "../scripts/build_seqfx_beta_release.mjs";
import {
    seqFxArtifactBaseName,
    seqFxReleaseConfig,
    unresolvedSeqFxPublicReleaseDecisions,
} from "../scripts/seqfx-release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "build_seqfx_beta_release.mjs");

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

test("release config freezes the existing beta identity and current native output path", () => {
    assert.equal(seqFxReleaseConfig.schemaVersion, 2);
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
            revision: "f1c9a9a8e85dcc82141326a2fc1c5160241f346c",
        },
        choc: {
            repository: "https://github.com/androidStern-personal/choc.git",
            revision: "037e34a2b382175c8bee4be5a0707724130f10e8",
            submodulePath: "include/choc",
        },
        juce: {
            cpmName: "cosimo_juce",
            sourceDirectoryCacheKey: "CPM_PACKAGE_cosimo_juce_SOURCE_DIR",
            repository: "https://github.com/juce-framework/JUCE.git",
            revision: "501c07674e1ad693085a7e7c398f205c2677f5da",
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
    assert.match(notices, /f1c9a9a8e85dcc82141326a2fc1c5160241f346c/u);
    assert.match(notices, /037e34a2b382175c8bee4be5a0707724130f10e8/u);
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
        sourceDateEpoch: 1_700_000_000,
    });

    assert.deepEqual(plan.sideEffects, []);
    assert.equal(plan.publicReleaseBlocked, true);
    assert.match(plan.paths.builtVst3, /_build\/plugin\/CosimoSeqFX_artefacts/u);
    assert.match(plan.repeatability.deterministicBoundary, /one freshly built unsigned VST3/u);
    assert.equal(plan.repeatability.independentNativeBuildsCompared, false);
    assert.equal(plan.repeatability.signedArtifactBytesReproducible, false);
    assert.equal(
        plan.nativeDependencyProvenance.declared.choc.revision,
        seqFxReleaseConfig.nativeDependencies.choc.revision,
    );
    assert.equal(plan.nativeDependencyProvenance.postBuildVerification.requiredBeforePackaging, true);
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

test("package metadata comes only from the release config", () => {
    const packageInfo = renderPackageInfo(seqFxReleaseConfig, [
        { isFile: true, relativePath: "example", size: 2048 },
    ]);

    assert.match(packageInfo, /identifier="dev\.cosimo\.seqfx\.pkg"/u);
    assert.match(packageInfo, /id="dev\.cosimo\.seqfx"/u);
    assert.match(packageInfo, /CosimoSeqFX\.vst3/u);
    assert.match(packageInfo, /version="0\.1\.0"/u);
});

test("payload validation requires a signature only for signed release mode", () => {
    const root = "./Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3";
    const unsignedFiles = [
        `${root}/Contents/Info.plist`,
        `${root}/Contents/MacOS/CosimoSeqFX`,
        `${root}/Contents/Resources/moduleinfo.json`,
    ];

    assert.deepEqual(payloadInventoryErrors(seqFxReleaseConfig, unsignedFiles, { signed: false }), []);
    assert.match(
        payloadInventoryErrors(seqFxReleaseConfig, unsignedFiles, { signed: true }).join("\n"),
        /_CodeSignature\/CodeResources/u,
    );
    assert.match(
        payloadInventoryErrors(seqFxReleaseConfig, [...unsignedFiles, `${root}/Contents/.DS_Store`], { signed: false }).join("\n"),
        /metadata files/u,
    );
    assert.match(
        payloadInventoryErrors(
            seqFxReleaseConfig,
            [...unsignedFiles, "./Library/LaunchDaemons/dev.cosimo.seqfx.plist"],
            { signed: false },
        ).join("\n"),
        /outside the declared VST3 install root/u,
    );
    assert.match(
        payloadInventoryErrors(
            seqFxReleaseConfig,
            [...unsignedFiles, `${root}/../escaped`],
            { signed: false },
        ).join("\n"),
        /outside the declared VST3 install root/u,
    );
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

test("README labels unsigned output honestly", () => {
    const unsignedReadme = renderReleaseReadme(seqFxReleaseConfig, { signedRelease: false });
    const signedReadme = renderReleaseReadme(seqFxReleaseConfig, { signedRelease: true });

    assert.match(unsignedReadme, /NOT FOR DISTRIBUTION OR PATREON UPLOAD/u);
    assert.match(unsignedReadme, /Minimum macOS version is not yet approved/u);
    assert.doesNotMatch(signedReadme, /LOCAL UNSIGNED VALIDATION PACKAGE/u);
});

test("unsigned manifest is deterministic and never claims host or upload acceptance", async () => {
    const patchManifest = await currentManifest();
    const inputs = {
        architectures: ["arm64", "x86_64"],
        config: seqFxReleaseConfig,
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
            vst3: { signedWithDeveloperId: false },
        },
        sourceDateEpoch: 1_700_000_000,
    };
    const first = createReleaseManifest(inputs);
    const second = createReleaseManifest(inputs);

    assert.deepEqual(second, first);
    assert.equal(first.distributionReady, false);
    assert.equal(first.packagingReady, false);
    assert.equal("createdAt" in first, false);
    assert.equal("branch" in first.source, false);
    assert.equal(first.repeatability.independentNativeBuildsCompared, false);
    assert.equal(
        first.nativeDependencyProvenance.cmajor.actualRevision,
        seqFxReleaseConfig.nativeDependencies.cmajor.revision,
    );
    assert.equal(first.nativeDependencyProvenance.choc.clean, true);
    assert.equal(first.nativeDependencyProvenance.juce.clean, true);
    assert.equal(first.artifacts.thirdPartyNotices, "THIRD_PARTY_NOTICES.txt");
    assert.ok(first.operationsNotPerformed.includes("DAW smoke or listening acceptance"));
    assert.ok(first.operationsNotPerformed.includes("Patreon upload"));

    const signedCandidate = createReleaseManifest({
        ...inputs,
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
});
