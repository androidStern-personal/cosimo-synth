import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    assertApprovedSeqFxReleaseToolEvidence,
    resolveSeqFxReleaseToolchain,
    seqFxReleaseSystemCommands,
} from "../scripts/seqfx-release-toolchain.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentCmakePath = "/opt/homebrew/bin/cmake";

test("release system commands are immutable absolute macOS paths", () => {
    assert.equal(Object.isFrozen(seqFxReleaseSystemCommands), true);
    assert.deepEqual(seqFxReleaseSystemCommands, {
        codesign: "/usr/bin/codesign",
        ditto: "/usr/bin/ditto",
        git: "/usr/bin/git",
        grep: "/usr/bin/grep",
        lipo: "/usr/bin/lipo",
        mkbom: "/usr/bin/mkbom",
        pkgutil: "/usr/sbin/pkgutil",
        plutil: "/usr/bin/plutil",
        productsign: "/usr/bin/productsign",
        security: "/usr/bin/security",
        spctl: "/usr/sbin/spctl",
        unzip: "/usr/bin/unzip",
        xar: "/usr/bin/xar",
        xattr: "/usr/bin/xattr",
        xcrun: "/usr/bin/xcrun",
        zip: "/usr/bin/zip",
    });
});

test("release toolchain resolves approved binaries while keeping manifest evidence path-free", async () => {
    const toolchain = await resolveSeqFxReleaseToolchain({
        environment: {
            ...process.env,
            COSIMO_RELEASE_CMAKE: currentCmakePath,
        },
        repositoryRoot: repoRoot,
    });

    assert.equal(toolchain.privateInvocationPaths.cmake, await realpath(currentCmakePath));
    assert.equal(toolchain.privateInvocationPaths.node, await realpath(process.execPath));
    assert.equal(toolchain.privateInvocationPaths.codesign, "/usr/bin/codesign");
    assert.deepEqual(toolchain.manifestAttestation.externalTools, {
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
    });
    assert.deepEqual(toolchain.manifestAttestation.sourceBuiltTools.cmaj, {
        cmajorCommit: "cb616bf1d0931ff92da3826d15a01eadfd8e35b1",
        chocCommit: "98b52fb54c3b9fec03c0c13218f6557aef33eabe",
        executablePolicy: "absolute-repository-build-output-no-path-fallback",
        provenance: "repository-pinned-source-build",
    });
    const pendingValues = [toolchain.manifestAttestation];

    while (pendingValues.length > 0) {
        const value = pendingValues.pop();

        if (typeof value === "string")
            assert.equal(path.isAbsolute(value), false, `manifest leaked absolute path: ${value}`);
        else if (value && typeof value === "object")
            pendingValues.push(...Object.values(value));
    }
});

test("release toolchain ignores poisoned PATH and emits only the allowed child environment", async (context) => {
    const poisonBin = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-path-poison-"));
    const sentinel = path.join(poisonBin, "invoked.txt");
    context.after(() => rm(poisonBin, { force: true, recursive: true }));

    for (const command of ["cmake", "codesign", "git", "node", "xcrun"]) {
        const commandPath = path.join(poisonBin, command);
        await writeFile(commandPath, `#!/bin/sh\nprintf '%s\\n' '${command}' >> '${sentinel}'\n`, "utf8");
        await chmod(commandPath, 0o755);
    }

    const environment = {
        ...process.env,
        CMAKE_TOOLCHAIN_FILE: "/tmp/poison.cmake",
        COSIMO_CMAKE_JOBS: "4",
        COSIMO_DEVELOPER_ID_APPLICATION: "application identity",
        COSIMO_DEVELOPER_ID_INSTALLER: "installer identity",
        COSIMO_NOTARY_PROFILE: "notary profile",
        COSIMO_PLUGIN_JOBS: "2",
        COSIMO_RELEASE_CMAKE: currentCmakePath,
        CPM_SOURCE_CACHE: "/tmp/approved-cpm-cache",
        DYLD_INSERT_LIBRARIES: "/tmp/poison.dylib",
        GIT_DIR: "/tmp/poison.git",
        HOME: process.env.HOME,
        LANG: "poisoned",
        LC_ALL: "poisoned",
        NODE_OPTIONS: "--require=/tmp/poison.cjs",
        PATH: poisonBin,
        RANDOM_SECRET: "must not escape",
        SOURCE_DATE_EPOCH: "1700000000",
        TMPDIR: "/tmp/seqfx-release-tests",
    };
    const toolchain = await resolveSeqFxReleaseToolchain({ environment, repositoryRoot: repoRoot });

    assert.deepEqual(toolchain.childEnvironment, {
        COSIMO_CMAKE_JOBS: "4",
        COSIMO_NOTARY_PROFILE: "notary profile",
        COSIMO_PLUGIN_JOBS: "2",
        CPM_SOURCE_CACHE: "/tmp/approved-cpm-cache",
        HOME: process.env.HOME,
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        SOURCE_DATE_EPOCH: "1700000000",
        TMPDIR: "/tmp/seqfx-release-tests",
    });
    await assert.rejects(access(sentinel));
});

test("release toolchain rejects relative executable overrides", async () => {
    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAKE: "./cmake",
            },
            repositoryRoot: repoRoot,
        }),
        /cmake executable path must be absolute/u,
    );
});

test("release toolchain rejects executables from the repository", async () => {
    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAKE: path.join(repoRoot, "scripts", "seqfx-release-toolchain.mjs"),
            },
            repositoryRoot: repoRoot,
        }),
        /cmake executable must be outside the repository/u,
    );
});

test("release toolchain rejects executables from any node_modules tree", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-node-modules-"));
    const executablePath = path.join(fixtureRoot, "node_modules", "bin", "cmake");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await mkdir(path.dirname(executablePath), { recursive: true });
    await writeFile(executablePath, "#!/bin/sh\nprintf 'cmake version 4.2.3\\n'\n", "utf8");
    await chmod(executablePath, 0o755);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAKE: executablePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmake executable must be outside node_modules/u,
    );
});

test("release toolchain rejects unapproved bytes without executing them", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-hash-drift-"));
    const executablePath = path.join(fixtureRoot, "cmake");
    const sentinel = path.join(fixtureRoot, "invoked.txt");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await writeFile(
        executablePath,
        `#!/bin/sh\nprintf 'invoked\\n' > '${sentinel}'\nprintf 'cmake version 4.2.3\\n'\n`,
        "utf8",
    );
    await chmod(executablePath, 0o755);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAKE: executablePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmake SHA-256 drift: expected 2fb3d19ecda5c45dd35f826af5f241a81c699dccf010f877948b37ca2addb290/u,
    );
    await assert.rejects(access(sentinel));
});

test("release toolchain rejects version drift without accepting caller approval overrides", () => {
    assert.throws(
        () => assertApprovedSeqFxReleaseToolEvidence("cmake", {
            sha256: "2fb3d19ecda5c45dd35f826af5f241a81c699dccf010f877948b37ca2addb290",
            version: "4.9.9999",
        }),
        /cmake version drift: expected 4\.2\.3, found 4\.9\.9999/u,
    );
});

test("release toolchain rejects a path that is not executable", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-not-executable-"));
    const executablePath = path.join(fixtureRoot, "cmake");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await writeFile(executablePath, "cmake version 4.2.3\n", "utf8");
    await chmod(executablePath, 0o644);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAKE: executablePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmake path must resolve to an executable file/u,
    );
});
