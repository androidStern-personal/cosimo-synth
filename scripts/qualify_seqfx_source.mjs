#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const sourceBrowserTest = "tests/test_seqfx_patch_view_browser.mjs";
const sourceBrowserOriginEnvironmentKey = "SEQFX_TEST_DEV_SERVER_ORIGIN";
const seqFxCanonicalRuntimePrebuiltEnvironmentKey = "SEQFX_CANONICAL_RUNTIME_PREBUILT";
const patchViewLayoutContractName = "desktop and shared effect dev entries load React Grab only in interactive Vite dev mode";

const testGroups = Object.freeze({
    crossSurfaceNode: Object.freeze([
        "tests/test_effect_snapshot_bank.mjs",
    ]),
    patchViewLayoutContract: Object.freeze([
        "tests/test_patch_view_layout.mjs",
    ]),
    nodeUnitAndProperty: Object.freeze([
        "tests/test_seqfx_aux_source.mjs",
        "tests/test_seqfx_block_properties.mjs",
        "tests/test_seqfx_crusher_preview.mjs",
        "tests/test_seqfx_effect_definitions.mjs",
        "tests/test_seqfx_factory_content.mjs",
        "tests/test_seqfx_fontaudio_assets.mjs",
        "tests/test_seqfx_patch_contract.mjs",
        "tests/test_seqfx_preset_adapter.mjs",
        "tests/test_seqfx_preset_migrations.mjs",
        "tests/test_seqfx_runtime_bridge.mjs",
        "tests/test_seqfx_sparse_state.mjs",
        "tests/test_seqfx_state.mjs",
        "tests/test_seqfx_state_properties.mjs",
        "tests/test_seqfx_stutter_envelope.mjs",
        "tests/test_seqfx_talk_box_contract.mjs",
        "tests/test_seqfx_tape_stop_v2_trajectory.mjs",
        "tests/test_seqfx_worker_service.mjs",
    ]),
    sourceBrowser: Object.freeze([sourceBrowserTest]),
    packagedBrowser: Object.freeze([
        "tests/test_seqfx_production_view_browser.mjs",
    ]),
    buildProvenance: Object.freeze([
        "tests/test_qualify_seqfx_source.mjs",
        "tests/test_seqfx_build_provenance.mjs",
    ]),
    pythonDspRuntimePerformanceLifecycle: Object.freeze([
        "tests/test_seqfx_antialias_reference.py",
        "tests/test_seqfx_buffer_probe.py",
        "tests/test_seqfx_comb_lab.py",
        "tests/test_seqfx_comb_performance.py",
        "tests/test_seqfx_interpolation.py",
        "tests/test_seqfx_multirate_effects.py",
        "tests/test_seqfx_probe.py",
    ]),
    releaseBuilder: Object.freeze([
        "tests/test_fx_build_args.mjs",
        "tests/test_seqfx_release_builder.mjs",
        "tests/test_seqfx_release_toolchain.mjs",
    ]),
    visualProofContracts: Object.freeze([
        "tests/test_seqfx_proof_provenance.mjs",
        "tests/test_seqfx_visual_proof_contract.mjs",
    ]),
});

function formatSeconds(milliseconds) {
    return `${(milliseconds / 1_000).toFixed(1)}s`;
}

function quoteArgument(argument) {
    return /^[A-Za-z0-9_./:=+-]+$/u.test(argument)
        ? argument
        : `'${argument.replaceAll("'", "'\\''")}'`;
}

function formatCommand(command, arguments_) {
    return [command, ...arguments_].map(quoteArgument).join(" ");
}

async function runCommand(command, arguments_, { environment = {} } = {}) {
    console.log(`$ ${formatCommand(command, arguments_)}`);
    await new Promise((resolve, reject) => {
        const child = spawn(command, arguments_, {
            cwd: repoRoot,
            env: {
                ...process.env,
                ...environment,
            },
            stdio: "inherit",
        });
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (signal) {
                reject(new Error(`${command} terminated by ${signal}.`));
                return;
            }
            if (code !== 0) {
                reject(new Error(`${command} exited with status ${code}.`));
                return;
            }
            resolve();
        });
    });
}

async function executablePath(command) {
    const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
    for (const pathEntry of pathEntries) {
        const candidate = path.join(pathEntry, command);
        try {
            await access(candidate, fsConstants.X_OK);
            return candidate;
        } catch {
            // Keep searching PATH.
        }
    }
    throw new Error(`Required executable is missing from PATH: ${command}`);
}

async function assertReadable(relativePath) {
    try {
        await access(path.join(repoRoot, relativePath), fsConstants.R_OK);
    } catch {
        throw new Error(`Required SeqFX qualification input is missing: ${relativePath}`);
    }
}

async function assertNamedNodeTest(relativePath, testName) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    const quotedName = JSON.stringify(testName);
    const matchCount = source.split(quotedName).length - 1;
    if (matchCount !== 1) {
        throw new Error(
            `${relativePath} must contain exactly one test named ${quotedName}; found ${matchCount}.`,
        );
    }
}

async function assertCompleteTestInventory() {
    const discovered = (await readdir(path.join(repoRoot, "tests"), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /^test_seqfx_.*\.(?:mjs|py)$/u.test(entry.name))
        .map((entry) => `tests/${entry.name}`)
        .sort();
    const assignments = Object.entries(testGroups).flatMap(([group, files]) => (
        files.map((file) => ({ file, group }))
    ));
    const prefixedAssignments = assignments.filter(({ file }) => (
        /^tests\/test_seqfx_.*\.(?:mjs|py)$/u.test(file)
    ));
    const allAssigned = assignments.map(({ file }) => file).sort();
    const assigned = prefixedAssignments.map(({ file }) => file).sort();
    const duplicates = allAssigned.filter((file, index) => allAssigned.indexOf(file) !== index);
    const unassigned = discovered.filter((file) => !assigned.includes(file));
    const missing = assigned.filter((file) => !discovered.includes(file));

    if (duplicates.length > 0 || unassigned.length > 0 || missing.length > 0) {
        const details = [
            ...duplicates.map((file) => `duplicate assignment: ${file}`),
            ...unassigned.map((file) => `unassigned discovered test: ${file}`),
            ...missing.map((file) => `assigned test is missing: ${file}`),
        ];
        throw new Error([
            "SeqFX test inventory changed; qualification refuses to silently omit or double-run a test.",
            ...details.map((detail) => `- ${detail}`),
        ].join("\n"));
    }

    console.log(`Discovered and assigned ${discovered.length} test_seqfx_* files across ${prefixedAssignments.length} unique slots.`);
    for (const [group, files] of Object.entries(testGroups)) {
        console.log(`- ${group}: ${files.length}`);
    }
}

async function preflight() {
    assertCanonicalRuntimePhaseOrder(qualificationPhases);
    await assertCompleteTestInventory();
    await assertNamedNodeTest(testGroups.patchViewLayoutContract[0], patchViewLayoutContractName);

    const requiredFiles = [
        "fx/seqfx/check-types.mjs",
        "fx/seqfx/tsconfig.json",
        "fx/seqfx/SeqFx.cmajorpatch",
        "scripts/capture_seqfx_visual_proof.mjs",
        "node_modules/typescript/bin/tsc",
        ...Object.values(testGroups).flat(),
    ];
    await Promise.all([...new Set(requiredFiles)].map(assertReadable));

    const requiredExecutables = ["cmaj", "cpio", "git", "node", "npm", "uv"];
    const resolvedExecutables = await Promise.all(requiredExecutables.map(async (command) => ({
        command,
        path: await executablePath(command),
    })));
    for (const resolved of resolvedExecutables) {
        console.log(`- ${resolved.command}: ${resolved.path}`);
    }

    await import("vite");
    const { chromium } = await import("playwright");
    const chromiumPath = chromium.executablePath();
    await access(chromiumPath, fsConstants.X_OK);
    console.log(`- playwright chromium: ${chromiumPath}`);
    await runCommand("uv", [
        "run",
        "--frozen",
        "--no-sync",
        "python",
        "-c",
        "import numpy, pytest",
    ]);
}

async function runNodeTests(files, { environment = {}, testNamePattern } = {}) {
    const arguments_ = ["--test", "--test-concurrency=1"];
    if (testNamePattern !== undefined) {
        arguments_.push(`--test-name-pattern=^${testNamePattern}$`);
    }
    arguments_.push(...files);
    await runCommand(process.execPath, arguments_, { environment });
}

async function runSourceBrowserTests() {
    const { createServer } = await import("vite");
    const viteServer = await createServer({
        configFile: path.join(repoRoot, "fx/vite.config.mjs"),
        clearScreen: false,
        logLevel: "warn",
        server: {
            host: "127.0.0.1",
            port: 0,
            strictPort: false,
        },
    });

    try {
        await viteServer.listen();
        const address = viteServer.httpServer?.address();
        if (!address || typeof address === "string") {
            throw new Error("Ephemeral SeqFX source-browser server did not expose its bound port.");
        }
        const sourceBrowserOrigin = `http://127.0.0.1:${address.port}`;
        console.log(`Ephemeral source-browser origin: ${sourceBrowserOrigin}`);
        await runCommand(process.execPath, [
            "--test",
            "--test-concurrency=1",
            ...testGroups.sourceBrowser,
        ], {
            environment: {
                [sourceBrowserOriginEnvironmentKey]: sourceBrowserOrigin,
            },
        });
    } finally {
        await viteServer.close();
    }
}

async function runPythonTests() {
    const inheritedPythonPath = process.env.PYTHONPATH;
    const pythonPath = inheritedPythonPath
        ? `${repoRoot}${path.delimiter}${inheritedPythonPath}`
        : repoRoot;
    await runCommand("uv", [
        "run",
        "--frozen",
        "--no-sync",
        "pytest",
        "-q",
        "--maxfail=1",
        "--strict-markers",
        ...testGroups.pythonDspRuntimePerformanceLifecycle,
    ], {
        environment: {
            PYTHONPATH: pythonPath,
        },
    });
}

let canonicalRuntimeReuseEnvironment;

export function createCanonicalRuntimeBuildInvocation(nodeExecutable = process.execPath) {
    return {
        command: nodeExecutable,
        arguments: ["fx/build-effect.mjs", "seqfx"],
        environment: {
            [seqFxCanonicalRuntimePrebuiltEnvironmentKey]: "0",
        },
    };
}

function requireCanonicalRuntimeReuseEnvironment() {
    if (canonicalRuntimeReuseEnvironment === undefined) {
        throw new Error("Canonical SeqFX runtime reuse cannot be authorized before regeneration succeeds.");
    }

    return canonicalRuntimeReuseEnvironment;
}

async function regenerateCanonicalSeqFxRuntime() {
    canonicalRuntimeReuseEnvironment = undefined;
    const invocation = createCanonicalRuntimeBuildInvocation();
    await runCommand(invocation.command, invocation.arguments, {
        environment: invocation.environment,
    });
    canonicalRuntimeReuseEnvironment = Object.freeze({
        [seqFxCanonicalRuntimePrebuiltEnvironmentKey]: "1",
    });
}

export function assertCanonicalRuntimePhaseOrder(phases) {
    const generationIndexes = phases
        .map((phase, index) => phase.producesCanonicalRuntime ? index : -1)
        .filter((index) => index >= 0);
    const claimIndexes = phases
        .map((phase, index) => phase.requiresCanonicalRuntime ? index : -1)
        .filter((index) => index >= 0);

    if (generationIndexes.length !== 1) {
        throw new Error(
            `SeqFX qualification requires exactly one canonical SeqFX runtime regeneration; found ${generationIndexes.length}.`,
        );
    }

    if (claimIndexes.some((index) => index <= generationIndexes[0])) {
        throw new Error(
            "Canonical SeqFX runtime regeneration must run before every packaged runtime claim.",
        );
    }
}

export const qualificationPhases = Object.freeze([
    {
        name: "Fail-closed tool and test inventory",
        run: preflight,
    },
    {
        name: "Strict SeqFX TypeScript",
        run: () => runCommand(process.execPath, ["fx/seqfx/check-types.mjs"]),
    },
    {
        name: "SeqFX cross-surface snapshot-bank contracts",
        run: () => runNodeTests(testGroups.crossSurfaceNode),
    },
    {
        name: "SeqFX shared-effect interactive-tooling contract",
        run: () => runNodeTests(testGroups.patchViewLayoutContract, {
            testNamePattern: patchViewLayoutContractName,
        }),
    },
    {
        name: "SeqFX Node unit and deterministic property suites",
        run: () => runNodeTests(testGroups.nodeUnitAndProperty),
    },
    {
        name: "SeqFX release-builder unit suite (no release build)",
        run: () => runNodeTests(testGroups.releaseBuilder),
    },
    {
        name: "Regenerate canonical SeqFX packaged runtime from tracked source",
        producesCanonicalRuntime: true,
        run: regenerateCanonicalSeqFxRuntime,
    },
    {
        name: "SeqFX visual-proof contract and provenance units",
        requiresCanonicalRuntime: true,
        run: () => runNodeTests(testGroups.visualProofContracts),
    },
    {
        name: "SeqFX source-view browser suite on an ephemeral server",
        run: runSourceBrowserTests,
    },
    {
        name: "SeqFX packaged production-view browser suite",
        requiresCanonicalRuntime: true,
        run: () => runNodeTests(testGroups.packagedBrowser, {
            environment: requireCanonicalRuntimeReuseEnvironment(),
        }),
    },
    {
        name: "SeqFX packaged source-map provenance",
        requiresCanonicalRuntime: true,
        run: () => runNodeTests(testGroups.buildProvenance),
    },
    {
        name: "SeqFX Cmajor packaged-patch dry-run",
        requiresCanonicalRuntime: true,
        run: () => runCommand("cmaj", [
            "play",
            "--dry-run",
            "--stop-on-error",
            "build/fx/seqfx_runtime/SeqFx.cmajorpatch",
        ]),
    },
    {
        name: "SeqFX Python DSP, generated runtime, performance, and lifecycle",
        run: runPythonTests,
    },
    {
        name: "SeqFX complete packaged visual proof",
        requiresCanonicalRuntime: true,
        run: () => runCommand(process.execPath, [
            "scripts/capture_seqfx_visual_proof.mjs",
            "--require-clean",
        ], {
            environment: requireCanonicalRuntimeReuseEnvironment(),
        }),
    },
]);

async function main() {
    const qualificationStartedAt = performance.now();

    for (const [index, phase] of qualificationPhases.entries()) {
        const phaseStartedAt = performance.now();
        console.log(`\n[${index + 1}/${qualificationPhases.length}] ${phase.name}`);
        try {
            await phase.run();
        } catch (error) {
            console.error(`\nFAILED: ${phase.name} (${formatSeconds(performance.now() - phaseStartedAt)})`);
            throw error;
        }
        console.log(`PASSED: ${phase.name} (${formatSeconds(performance.now() - phaseStartedAt)})`);
    }

    console.log(`\nSeqFX source qualification passed in ${formatSeconds(performance.now() - qualificationStartedAt)}.`);
    console.log("Excluded by design: native/plugin builds, fixed-port dev servers, installs, signing, notarization, host/DAW acceptance, network publication, and credential access.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.stack ?? error.message : String(error));
        process.exitCode = 1;
    });
}
