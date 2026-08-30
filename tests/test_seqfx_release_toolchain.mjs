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
const currentCmajPath = path.join(process.env.HOME, ".local", "bin", "cmaj");
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
            COSIMO_RELEASE_CMAJ: currentCmajPath,
            COSIMO_RELEASE_CMAKE: currentCmakePath,
        },
        repositoryRoot: repoRoot,
    });

    assert.equal(toolchain.privateInvocationPaths.cmake, await realpath(currentCmakePath));
    assert.equal(toolchain.privateInvocationPaths.cmaj, await realpath(currentCmajPath));
    assert.equal(toolchain.privateInvocationPaths.node, await realpath(process.execPath));
    assert.equal(toolchain.privateInvocationPaths.codesign, "/usr/bin/codesign");
    assert.deepEqual(toolchain.manifestAttestation.externalTools, {
        cmaj: {
            provenance: "approved-binary-toolchain",
            runtimeSourceAttestation: "separate",
            sha256: "4bfdd75549a6d51578977ee6e2ac55b2ede459a1ccb1055479d3dd0f9e8cdabf",
            version: "1.0.3066",
        },
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

    for (const command of ["cmaj", "cmake", "codesign", "git", "node", "xcrun"]) {
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
        COSIMO_RELEASE_CMAJ: currentCmajPath,
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
                COSIMO_RELEASE_CMAJ: "./cmaj",
                COSIMO_RELEASE_CMAKE: currentCmakePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmaj executable path must be absolute/u,
    );
});

test("release toolchain rejects executables from the repository", async () => {
    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAJ: currentCmajPath,
                COSIMO_RELEASE_CMAKE: path.join(repoRoot, "scripts", "seqfx-release-toolchain.mjs"),
            },
            repositoryRoot: repoRoot,
        }),
        /cmake executable must be outside the repository/u,
    );
});

test("release toolchain rejects executables from any node_modules tree", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-node-modules-"));
    const executablePath = path.join(fixtureRoot, "node_modules", "bin", "cmaj");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await mkdir(path.dirname(executablePath), { recursive: true });
    await writeFile(executablePath, "#!/bin/sh\nprintf 'Cmajor Version: 1.0.3066\\n'\n", "utf8");
    await chmod(executablePath, 0o755);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAJ: executablePath,
                COSIMO_RELEASE_CMAJ_SHA256: "caller-controlled",
                COSIMO_RELEASE_CMAKE: currentCmakePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmaj executable must be outside node_modules/u,
    );
});

test("release toolchain rejects unapproved bytes without executing them", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-hash-drift-"));
    const executablePath = path.join(fixtureRoot, "cmaj");
    const sentinel = path.join(fixtureRoot, "invoked.txt");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await writeFile(
        executablePath,
        `#!/bin/sh\nprintf 'invoked\\n' > '${sentinel}'\nprintf 'Cmajor Version: 1.0.3066\\n'\n`,
        "utf8",
    );
    await chmod(executablePath, 0o755);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAJ: executablePath,
                COSIMO_RELEASE_CMAJ_SHA256: "caller-controlled",
                COSIMO_RELEASE_CMAKE: currentCmakePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmaj SHA-256 drift: expected 4bfdd75549a6d51578977ee6e2ac55b2ede459a1ccb1055479d3dd0f9e8cdabf/u,
    );
    await assert.rejects(access(sentinel));
});

test("release toolchain rejects version drift without accepting caller approval overrides", () => {
    assert.throws(
        () => assertApprovedSeqFxReleaseToolEvidence("cmaj", {
            sha256: "4bfdd75549a6d51578977ee6e2ac55b2ede459a1ccb1055479d3dd0f9e8cdabf",
            version: "1.0.9999",
        }),
        /cmaj version drift: expected 1\.0\.3066, found 1\.0\.9999/u,
    );
});

test("release toolchain rejects a path that is not executable", async (context) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "seqfx-release-not-executable-"));
    const executablePath = path.join(fixtureRoot, "cmaj");
    context.after(() => rm(fixtureRoot, { force: true, recursive: true }));
    await writeFile(executablePath, "Cmajor Version: 1.0.3066\n", "utf8");
    await chmod(executablePath, 0o644);

    await assert.rejects(
        resolveSeqFxReleaseToolchain({
            environment: {
                ...process.env,
                COSIMO_RELEASE_CMAJ: executablePath,
                COSIMO_RELEASE_CMAKE: currentCmakePath,
            },
            repositoryRoot: repoRoot,
        }),
        /cmaj path must resolve to an executable file/u,
    );
});
