#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const sourceBrowserTest = "tests/test_seqfx_patch_view_browser.mjs";
const sourceBrowserOriginEnvironmentKey = "SEQFX_QUALIFICATION_SOURCE_ORIGIN";
const sourceBrowserOriginLiteral = 'const DEV_SERVER_ORIGIN = "http://127.0.0.1:5175";';
const effectLoaderOriginLiteral = 'export const DEFAULT_EFFECT_DEV_ORIGIN = "http://127.0.0.1:5175";';
const sourceBrowserLoaderRegistration = `data:text/javascript,${encodeURIComponent([
    'import { register } from "node:module";',
    `register(${JSON.stringify(pathToFileURL(scriptPath).href)}, import.meta.url);`,
].join(" "))}`;
const sourceBrowserEffectLoaders = new Set([
    path.join(repoRoot, "fx/seqfx/view/index.js"),
    path.join(repoRoot, "ui/shared/effects/effect-view-loader.js"),
]);

const testGroups = Object.freeze({
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
        "tests/test_seqfx_build_provenance.mjs",
    ]),
    pythonDspRuntimePerformanceLifecycle: Object.freeze([
        "tests/test_seqfx_antialias_reference.py",
        "tests/test_seqfx_buffer_probe.py",
        "tests/test_seqfx_comb_lab.py",
        "tests/test_seqfx_interpolation.py",
        "tests/test_seqfx_multirate_effects.py",
        "tests/test_seqfx_probe.py",
    ]),
    releaseBuilder: Object.freeze([
        "tests/test_seqfx_release_builder.mjs",
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

async function assertCompleteTestInventory() {
    const discovered = (await readdir(path.join(repoRoot, "tests"), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /^test_seqfx_.*\.(?:mjs|py)$/u.test(entry.name))
        .map((entry) => `tests/${entry.name}`)
        .sort();
    const assignments = Object.entries(testGroups).flatMap(([group, files]) => (
        files.map((file) => ({ file, group }))
    ));
    const assigned = assignments.map(({ file }) => file).sort();
    const duplicates = assigned.filter((file, index) => assigned.indexOf(file) !== index);
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

    console.log(`Discovered and assigned ${discovered.length} test_seqfx_* files across ${assignments.length} unique slots.`);
    for (const [group, files] of Object.entries(testGroups)) {
        console.log(`- ${group}: ${files.length}`);
    }
}

async function preflight() {
    await assertCompleteTestInventory();

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

async function runNodeTests(files) {
    await runCommand(process.execPath, ["--test", "--test-concurrency=1", ...files]);
}

async function runSourceBrowserTests() {
    const { createServer } = await import("vite");
    let sourceBrowserOrigin;
    const viteServer = await createServer({
        configFile: path.join(repoRoot, "fx/vite.config.mjs"),
        clearScreen: false,
        logLevel: "warn",
        plugins: [{
            name: "seqfx-qualification-ephemeral-dev-origin",
            enforce: "pre",
            transform(source, id) {
                const sourcePath = id.split("?", 1)[0];
                if (!sourceBrowserEffectLoaders.has(sourcePath)) {
                    return undefined;
                }
                if (!sourceBrowserOrigin) {
                    throw new Error("SeqFX qualification origin was not bound before the effect loader was requested.");
                }
                if (!source.includes(effectLoaderOriginLiteral)) {
                    throw new Error(`SeqFX effect loader origin contract changed: ${path.relative(repoRoot, sourcePath)}`);
                }
                return source.replace(
                    effectLoaderOriginLiteral,
                    `export const DEFAULT_EFFECT_DEV_ORIGIN = ${JSON.stringify(sourceBrowserOrigin)};`,
                );
            },
        }],
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
        sourceBrowserOrigin = `http://127.0.0.1:${address.port}`;
        console.log(`Ephemeral source-browser origin: ${sourceBrowserOrigin}`);
        await runCommand(process.execPath, [
            "--import",
            sourceBrowserLoaderRegistration,
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

const phases = Object.freeze([
    {
        name: "Fail-closed tool and test inventory",
        run: preflight,
    },
    {
        name: "Strict SeqFX TypeScript",
        run: () => runCommand(process.execPath, ["fx/seqfx/check-types.mjs"]),
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
        name: "SeqFX visual-proof contract and provenance units",
        run: () => runNodeTests(testGroups.visualProofContracts),
    },
    {
        name: "SeqFX source-view browser suite on an ephemeral server",
        run: runSourceBrowserTests,
    },
    {
        name: "SeqFX packaged production-view browser suite",
        run: () => runNodeTests(testGroups.packagedBrowser),
    },
    {
        name: "SeqFX packaged source-map provenance",
        run: () => runNodeTests(testGroups.buildProvenance),
    },
    {
        name: "SeqFX Cmajor packaged-patch dry-run",
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
        run: () => runCommand(process.execPath, [
            "scripts/capture_seqfx_visual_proof.mjs",
            "--require-clean",
        ]),
    },
]);

async function main() {
    const qualificationStartedAt = performance.now();

    for (const [index, phase] of phases.entries()) {
        const phaseStartedAt = performance.now();
        console.log(`\n[${index + 1}/${phases.length}] ${phase.name}`);
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

export async function load(url, context, nextLoad) {
    const loaded = await nextLoad(url, context);
    const sourceBrowserOrigin = process.env[sourceBrowserOriginEnvironmentKey];
    if (!sourceBrowserOrigin || url !== pathToFileURL(path.join(repoRoot, sourceBrowserTest)).href) {
        return loaded;
    }
    if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(sourceBrowserOrigin)) {
        throw new Error(`Invalid ${sourceBrowserOriginEnvironmentKey}: ${sourceBrowserOrigin}`);
    }

    const source = Buffer.isBuffer(loaded.source)
        ? loaded.source.toString("utf8")
        : String(loaded.source);
    const replacement = `const DEV_SERVER_ORIGIN = ${JSON.stringify(sourceBrowserOrigin)};`;
    if (!source.includes(sourceBrowserOriginLiteral)) {
        throw new Error("SeqFX source-browser origin contract changed; refusing to run a stale qualification override.");
    }
    const transformed = source.replace(sourceBrowserOriginLiteral, replacement);
    if (transformed.includes(sourceBrowserOriginLiteral)) {
        throw new Error("SeqFX source-browser qualification did not replace the fixed development origin.");
    }
    return {
        ...loaded,
        source: transformed,
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.stack ?? error.message : String(error));
        process.exitCode = 1;
    });
}
