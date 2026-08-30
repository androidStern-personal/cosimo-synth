import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
    canonicalPayloadFingerprint,
    createReleaseManifest,
    createReleasePlan,
    deterministicCpioPayload,
    parseReleaseArgs,
    payloadInventoryErrors,
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

test("release config freezes the existing beta identity and current native output path", () => {
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
    assert.equal(seqFxArtifactBaseName(), "CosimoSeqFX-0.1.0-beta.1-macOS");
});

test("unresolved public decisions are explicit release gates, not guessed values", () => {
    assert.deepEqual(
        unresolvedSeqFxPublicReleaseDecisions().map((gate) => gate.id),
        [
            "public-identity-approval",
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
        skipBuild: false,
        verifyReproducible: false,
    });
    assert.equal(parseReleaseArgs(["node", "script", "--plan", "--json"]).mode, "plan");
    assert.equal(parseReleaseArgs(["node", "script", "--release", "--skip-build"]).mode, "release");
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--release", "--allow-dirty"]),
        /cannot be combined/u,
    );
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--release", "--verify-reproducible"]),
        /unsigned payload only/u,
    );
    assert.throws(
        () => parseReleaseArgs(["node", "script", "--plan", "--skip-build"]),
        /read-only/u,
    );
});

test("release config matches the current patch manifest and effect build registry", async () => {
    assert.deepEqual(releaseContractErrors(seqFxReleaseConfig, await currentManifest()), []);
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
        gitState: {
            branch: "codex/test",
            commit: "a".repeat(40),
            dirty: false,
            trackedStatus: "",
        },
        mode: "plan",
        sourceDateEpoch: 1_700_000_000,
    });

    assert.deepEqual(plan.sideEffects, []);
    assert.equal(plan.publicReleaseBlocked, true);
    assert.match(plan.paths.builtVst3, /_build\/plugin\/CosimoSeqFX_artefacts/u);
    assert.match(plan.reproducibility.deterministicBoundary, /unsigned/u);
    assert.equal(plan.reproducibility.signedArtifactBytesReproducible, false);
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
            trackedStatus: "",
        },
        notarization: {
            gatekeeperAccepted: false,
            notarized: false,
            stapled: false,
            note: "not run",
        },
        options: {
            mode: "unsigned",
            verifyReproducible: true,
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
    assert.ok(first.operationsNotPerformed.includes("DAW smoke or listening acceptance"));
    assert.ok(first.operationsNotPerformed.includes("Patreon upload"));

    const signedCandidate = createReleaseManifest({
        ...inputs,
        options: {
            mode: "release",
            verifyReproducible: false,
        },
    });
    assert.equal(signedCandidate.packagingReady, true);
    assert.equal(signedCandidate.distributionReady, false);
    assert.match(signedCandidate.distributionReadinessReason, /Ableton\/listening acceptance/u);
});
