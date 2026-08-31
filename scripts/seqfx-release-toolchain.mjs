import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Absolute macOS release commands. These paths are policy, not PATH lookups.
 */
export const seqFxReleaseSystemCommands = Object.freeze({
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

const approvedExternalTools = Object.freeze({
    cmake: Object.freeze({
        sha256: "2fb3d19ecda5c45dd35f826af5f241a81c699dccf010f877948b37ca2addb290",
        version: "4.2.3",
        versionPattern: /^cmake version\s+([^\s]+)$/mu,
    }),
    node: Object.freeze({
        sha256: "5d9d3872911e2340a43b707962e68143de8a4e8d54628845c0c4f2de1fb7cd5c",
        version: "v22.22.3",
        versionPattern: /^(v[^\s]+)$/mu,
    }),
});

const pinnedSourceBuiltGenerator = Object.freeze({
    cmajorCommit: "a97d8846605c433db561d07f23fc9ff372e20ced",
    chocCommit: "98b52fb54c3b9fec03c0c13218f6557aef33eabe",
});

const fixedChildPath = "/usr/bin:/bin:/usr/sbin:/sbin";
const inheritedChildEnvironmentNames = Object.freeze([
    "COSIMO_CMAKE_JOBS",
    "COSIMO_NOTARY_PROFILE",
    "COSIMO_PLUGIN_JOBS",
    "CPM_SOURCE_CACHE",
    "HOME",
    "SOURCE_DATE_EPOCH",
    "TMPDIR",
]);

/** Validate observed evidence against repository-owned release approvals. */
export function assertApprovedSeqFxReleaseToolEvidence(toolName, evidence) {
    const approval = approvedExternalTools[toolName];

    if (!approval)
        throw new Error(`Unknown SeqFX release tool: ${String(toolName)}.`);

    if (evidence?.sha256 !== approval.sha256) {
        throw new Error(
            `${toolName} SHA-256 drift: expected ${approval.sha256}, found ${String(evidence?.sha256)}.`,
        );
    }

    if (evidence?.version !== approval.version) {
        throw new Error(
            `${toolName} version drift: expected ${approval.version}, found ${String(evidence?.version)}.`,
        );
    }
}

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;

    for (const child of Object.values(value))
        deepFreeze(child);

    return Object.freeze(value);
}

function pathIsInside(parentPath, candidatePath) {
    const relative = path.relative(parentPath, candidatePath);
    return relative === "" || (
        relative !== ".."
        && !relative.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relative)
    );
}

function containsNodeModules(candidatePath) {
    return candidatePath.split(path.sep).includes("node_modules");
}

async function sha256File(filePath) {
    const digest = createHash("sha256");

    await new Promise((resolve, reject) => {
        const stream = createReadStream(filePath);
        stream.on("data", (chunk) => digest.update(chunk));
        stream.on("error", reject);
        stream.on("end", resolve);
    });

    return digest.digest("hex");
}

function versionEnvironment(environment) {
    const result = {
        LANG: "C",
        LC_ALL: "C",
        PATH: fixedChildPath,
    };

    for (const key of ["HOME", "TMPDIR"]) {
        if (environment[key])
            result[key] = environment[key];
    }

    return result;
}

function createChildEnvironment(environment) {
    const result = {
        LANG: "C",
        LC_ALL: "C",
        PATH: fixedChildPath,
    };

    for (const key of inheritedChildEnvironmentNames) {
        if (typeof environment[key] === "string" && environment[key])
            result[key] = environment[key];
    }

    return deepFreeze(result);
}

function readExecutableVersion(toolName, executablePath, environment) {
    const result = spawnSync(executablePath, ["--version"], {
        encoding: "utf8",
        env: versionEnvironment(environment),
        stdio: ["ignore", "pipe", "pipe"],
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

    if (result.status !== 0)
        throw new Error(`${toolName} version probe failed: ${output || `exit ${String(result.status)}`}`);

    const match = output.match(approvedExternalTools[toolName].versionPattern);

    if (!match)
        throw new Error(`${toolName} did not report a recognizable version.`);

    return match[1];
}

async function attestExternalTool(toolName, candidatePath, repositoryRoot, environment) {
    if (typeof candidatePath !== "string" || !path.isAbsolute(candidatePath))
        throw new Error(`${toolName} executable path must be absolute.`);

    const executablePath = await realpath(candidatePath);

    if (pathIsInside(repositoryRoot, executablePath))
        throw new Error(`${toolName} executable must be outside the repository.`);

    if (containsNodeModules(executablePath))
        throw new Error(`${toolName} executable must be outside node_modules.`);

    const executableStat = await stat(executablePath);

    if (!executableStat.isFile() || (executableStat.mode & 0o111) === 0)
        throw new Error(`${toolName} path must resolve to an executable file.`);

    const approval = approvedExternalTools[toolName];
    const sha256 = await sha256File(executablePath);

    if (sha256 !== approval.sha256)
        throw new Error(`${toolName} SHA-256 drift: expected ${approval.sha256}, found ${sha256}.`);

    const version = readExecutableVersion(toolName, executablePath, environment);
    assertApprovedSeqFxReleaseToolEvidence(toolName, { sha256, version });

    return {
        executablePath,
        sha256,
        version,
    };
}

/**
 * Resolve the private release invocation paths and their serializable evidence.
 * The caller may choose CMake's location, but never its approval. Cmajor is
 * always built from the repository-pinned source by the production build.
 */
export async function resolveSeqFxReleaseToolchain({
    environment = process.env,
    repositoryRoot,
} = {}) {
    if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot))
        throw new Error("repositoryRoot must be an absolute path.");

    const candidates = {
        cmake: environment.COSIMO_RELEASE_CMAKE ?? "/opt/homebrew/bin/cmake",
        node: process.execPath,
    };
    const [cmake, node] = await Promise.all([
        attestExternalTool("cmake", candidates.cmake, repositoryRoot, environment),
        attestExternalTool("node", candidates.node, repositoryRoot, environment),
    ]);
    const privateInvocationPaths = deepFreeze({
        ...seqFxReleaseSystemCommands,
        cmake: cmake.executablePath,
        node: node.executablePath,
    });
    const manifestAttestation = deepFreeze({
        schemaVersion: 1,
        externalTools: {
            cmake: {
                provenance: "approved-binary-toolchain",
                sha256: cmake.sha256,
                version: cmake.version,
            },
            node: {
                provenance: "approved-binary-toolchain",
                sha256: node.sha256,
                version: node.version,
            },
        },
        sourceBuiltTools: {
            cmaj: {
                ...pinnedSourceBuiltGenerator,
                executablePolicy: "absolute-repository-build-output-no-path-fallback",
                provenance: "repository-pinned-source-build",
            },
        },
        systemCommands: {
            names: Object.keys(seqFxReleaseSystemCommands),
            policy: "macos-absolute-system-command-map-v1",
        },
    });

    return deepFreeze({
        childEnvironment: createChildEnvironment(environment),
        manifestAttestation,
        privateInvocationPaths,
    });
}
