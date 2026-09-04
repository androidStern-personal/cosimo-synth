#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
    appendFile,
    chmod,
    cp,
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    readlink,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportKit } from "../../kit/scripts/export_kit.mjs";
import { reveal } from "../../kit/scripts/redacted.mjs";
import {
    createReleaseDestination,
    readCapabilityFromKeychain,
    readDestinationConfig,
} from "../../scripts/release_builder_kit.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const sha256Pattern = /^[0-9a-f]{64}$/u;
const sourceShaPattern = /^[0-9a-f]{40}$/u;
const mainPluginDirectory = "fx/enhancer_lite";
const mainPluginConfig = "EnhancerLite.plugin.json";
const dspEdit = Object.freeze({
    before: "let enhancerLiteCoefficientEpsilon = 0.000001f;",
    after: "let enhancerLiteCoefficientEpsilon = 0.000002f;",
    file: "fx/enhancer_lite/EnhancerLite.cmajor",
});
const uiMarker = "BK24_NATIVE_UI_MARKER";

function usage() {
    return [
        "Usage: node tests/tools/qualify_builder_kit_native.mjs",
        "  --source-sha <exact clean commit>",
        "  --destination-config <absolute non-secret Builder Kit destination JSON>",
        "  [--report <absolute JSON output path>]",
    ].join("\n");
}

export function parseArguments(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 2) {
        const name = argv[index];
        const value = argv[index + 1];
        if (!["--source-sha", "--destination-config", "--report"].includes(name) || value === undefined)
            throw new Error(usage());
        if (values.has(name)) throw new Error(`${name} may only be provided once.`);
        values.set(name, value);
    }

    const sourceSha = values.get("--source-sha");
    const destinationConfig = values.get("--destination-config");
    const report = values.get("--report") ?? null;
    if (!sourceShaPattern.test(sourceSha ?? "")) throw new Error("--source-sha must be an exact 40-character commit SHA.");
    if (!destinationConfig) throw new Error("--destination-config is required.");
    if (!path.isAbsolute(destinationConfig)) throw new Error("--destination-config must be absolute.");
    if (report !== null && !path.isAbsolute(report)) throw new Error("--report must be absolute.");
    return { destinationConfig, report, sourceSha };
}

export function redactText(value, secrets) {
    let result = String(value);
    const ordered = [...new Set(secrets.filter((secret) => typeof secret === "string" && secret !== ""))]
        .sort((left, right) => right.length - left.length);
    for (const secret of ordered) result = result.split(secret).join("[REDACTED]");
    return result;
}

export function toolchainWithPublishedPins(candidate, manifest, kitVersion) {
    if (manifest?.version !== kitVersion)
        throw new Error(`Published feed version ${manifest?.version ?? "<missing>"} does not match candidate kit version ${kitVersion}.`);
    if (manifest?.cmajor?.commit !== candidate?.cmaj?.forkCommit
            || manifest?.tools?.cmaj?.forkCommit !== candidate?.cmaj?.forkCommit)
        throw new Error("Published Cmajor source does not match the candidate toolchain fork commit.");

    const composed = structuredClone(candidate);
    for (const key of ["cmaj", "cmajPlugin"]) {
        const published = manifest?.tools?.[key];
        if (published?.artifact !== candidate?.[key]?.artifact)
            throw new Error(`Published ${key} artifact does not match the candidate toolchain artifact.`);
        if (!sha256Pattern.test(published?.sha256 ?? ""))
            throw new Error(`Published ${key} sha256 is missing or invalid.`);
        const candidatePin = candidate?.[key]?.sha256;
        if (candidatePin !== undefined && candidatePin !== "" && candidatePin !== published.sha256)
            throw new Error(`Candidate ${key} sha256 disagrees with the published artifact pin.`);
        composed[key].sha256 = published.sha256;
    }
    return composed;
}

export function compiledTraceEvents(output) {
    const lines = String(output).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    return {
        compile: lines.filter((line) => /\bBuilding (?:C|CXX|OBJC|OBJCXX) object\b/u.test(line)),
        link: lines.filter((line) => /\bLinking (?:C|CXX|OBJC|OBJCXX)\b/u.test(line)),
    };
}

/**
 * Return a copy suitable only for diagnosing an exact clean-build mismatch.
 * It accepts one thin 64-bit little-endian Mach-O and zeroes the two fields
 * known to be time/build-instance metadata: LC_UUID and the code-signature
 * blob named by LC_CODE_SIGNATURE. The native gate always compares raw bytes
 * first and reports when this narrower comparison was needed.
 */
export function normalizeMachOForComparison(input) {
    const bytes = Buffer.from(input);
    if (bytes.length < 32 || bytes.readUInt32LE(0) !== 0xfeedfacf)
        throw new Error("Clean comparison supports the arm64 runner's thin 64-bit Mach-O output only.");
    const commandCount = bytes.readUInt32LE(16);
    const commandBytes = bytes.readUInt32LE(20);
    const commandsEnd = 32 + commandBytes;
    if (commandsEnd > bytes.length) throw new Error("Mach-O load commands exceed the binary size.");

    const normalizedFields = [];
    let offset = 32;
    for (let index = 0; index < commandCount; index += 1) {
        if (offset + 8 > commandsEnd) throw new Error("Mach-O load command header is truncated.");
        const command = bytes.readUInt32LE(offset);
        const size = bytes.readUInt32LE(offset + 4);
        if (size < 8 || offset + size > commandsEnd) throw new Error("Mach-O load command is invalid.");
        if (command === 0x1b) {
            if (size !== 24) throw new Error("Mach-O LC_UUID has an unexpected size.");
            bytes.fill(0, offset + 8, offset + 24);
            normalizedFields.push("LC_UUID");
        } else if (command === 0x1d) {
            if (size < 16) throw new Error("Mach-O LC_CODE_SIGNATURE is truncated.");
            const signatureOffset = bytes.readUInt32LE(offset + 8);
            const signatureSize = bytes.readUInt32LE(offset + 12);
            if (signatureOffset + signatureSize > bytes.length)
                throw new Error("Mach-O code-signature payload exceeds the binary size.");
            bytes.fill(0, signatureOffset, signatureOffset + signatureSize);
            normalizedFields.push("LC_CODE_SIGNATURE payload");
        }
        offset += size;
    }
    return { bytes, normalizedFields };
}

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

async function pathExists(target) {
    try {
        await lstat(target);
        return true;
    } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") return false;
        throw error;
    }
}

async function runCaptured(command, args, {
    cwd,
    environment = process.env,
    label = command,
    logFile = null,
    secrets = [],
    timeoutMs = 60 * 60 * 1000,
} = {}) {
    const result = await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env: {
                ...environment,
                GIT_TRACE: "0",
                GIT_TRACE_CURL: "0",
                GIT_TRACE_PACKET: "0",
                GIT_CURL_VERBOSE: "0",
            },
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("error", reject);
        const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
        child.on("close", (code, signal) => {
            clearTimeout(timeout);
            resolve({ code, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
        });
    });
    const output = redactText([result.stdout, result.stderr].filter(Boolean).join("\n"), secrets);
    if (logFile !== null) {
        await mkdir(path.dirname(logFile), { recursive: true });
        await writeFile(logFile, output, { mode: 0o600 });
        await chmod(logFile, 0o600);
    }
    if (result.code !== 0) {
        const tail = output.split(/\r?\n/u).slice(-80).join("\n");
        throw new Error(`${label} failed${result.signal ? ` via ${result.signal}` : ` with exit code ${result.code}`}.${tail ? `\n${tail}` : ""}`);
    }
    return output;
}

async function fetchPublishedManifest(feedUrl, secrets) {
    let response;
    try {
        response = await fetch(`${feedUrl}/manifest.json`, { redirect: "follow" });
    } catch {
        throw new Error("Could not fetch the Builder Kit feed manifest.");
    }
    if (!response.ok) throw new Error(`Builder Kit feed manifest returned HTTP ${response.status}.`);
    try {
        return await response.json();
    } catch (error) {
        throw new Error(redactText(`Builder Kit feed manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`, secrets));
    }
}

async function listTree(root, { include = () => true, exclude = () => false } = {}) {
    const result = {};
    async function visit(directory) {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const absolute = path.join(directory, entry.name);
            const relative = path.relative(root, absolute).split(path.sep).join("/");
            if (exclude(relative, entry)) continue;
            if (entry.isDirectory()) {
                await visit(absolute);
                continue;
            }
            if (!include(relative, entry)) continue;
            const metadata = await lstat(absolute);
            if (entry.isSymbolicLink()) {
                result[relative] = { kind: "symlink", link: await readlink(absolute), mode: metadata.mode & 0o777, mtimeMs: metadata.mtimeMs };
            } else {
                const bytes = await readFile(absolute);
                result[relative] = { kind: "file", sha256: sha256(bytes), size: bytes.length, mode: metadata.mode & 0o777, mtimeMs: metadata.mtimeMs };
            }
        }
    }
    await visit(root);
    return result;
}

function contentManifest(tree) {
    return Object.fromEntries(Object.entries(tree).map(([file, value]) => [file, {
        kind: value.kind,
        link: value.link,
        mode: value.mode,
        sha256: value.sha256,
        size: value.size,
    }]));
}

function manifestDigest(tree) {
    return sha256(JSON.stringify(contentManifest(tree)));
}

function changedFiles(before, after, field = "sha256") {
    const files = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return files.filter((file) => before[file]?.[field] !== after[file]?.[field]);
}

function changedMtimes(before, after) {
    const files = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return files.filter((file) => before[file]?.mtimeMs !== after[file]?.mtimeMs);
}

async function readPlugin(root, directory, configName = null) {
    const entries = await readdir(path.join(root, directory));
    const chosen = configName ?? entries.find((entry) => entry.endsWith(".plugin.json"));
    if (!chosen) throw new Error(`No plugin config found under ${directory}.`);
    const config = JSON.parse(await readFile(path.join(root, directory, chosen), "utf8"));
    const patchName = entries.find((entry) => entry.endsWith(".cmajorpatch"));
    if (!patchName) throw new Error(`No patch manifest found under ${directory}.`);
    const alias = config.alias;
    const cmakeTarget = config.cmakeTarget;
    const productName = config.productName;
    const runtimeOut = config.runtimeOut;
    const juceOut = config.juceOut;
    for (const [label, value] of Object.entries({ alias, cmakeTarget, productName, runtimeOut, juceOut })) {
        if (typeof value !== "string" || value === "") throw new Error(`${directory} must explicitly name ${label} for native qualification.`);
    }
    return {
        alias,
        binary: path.join(root, juceOut, "_build/plugin", `${cmakeTarget}_artefacts/Release/VST3`, `${productName}.vst3/Contents/MacOS`, productName),
        bundle: path.join(root, juceOut, "_build/plugin", `${cmakeTarget}_artefacts/Release/VST3`, `${productName}.vst3`),
        config,
        configPath: path.join(root, directory, chosen),
        directory,
        identityProbe: path.join(root, juceOut, "_build/identity_probe/kit_vst3_identity_probe"),
        juceRoot: path.join(root, juceOut),
        patchName,
        productName,
        root,
        runtimeRoot: path.join(root, runtimeOut),
    };
}

async function snapshotPlugin(plugin) {
    for (const required of [plugin.runtimeRoot, plugin.juceRoot, plugin.bundle, plugin.binary, plugin.identityProbe]) {
        if (!await pathExists(required)) throw new Error(`Required native output is missing: ${path.relative(path.dirname(plugin.runtimeRoot), required)}`);
    }
    const runtime = await listTree(plugin.runtimeRoot);
    const generated = await listTree(plugin.juceRoot, { exclude: (relative) => relative === "_build" || relative.startsWith("_build/") });
    const objectsRoot = path.join(plugin.juceRoot, "_build");
    assert.equal(await pathExists(path.join(objectsRoot, "generated-project-stage")), false,
        "temporary generated-project stage must be removed after configure");
    const objects = await listTree(objectsRoot, { include: (relative) => relative.endsWith(".o") });
    const bundle = await listTree(plugin.bundle);
    const binaryBytes = await readFile(plugin.binary);
    const binaryStat = await stat(plugin.binary);
    let comparableSha256 = null;
    let normalizedFields = [];
    try {
        const normalized = normalizeMachOForComparison(binaryBytes);
        comparableSha256 = sha256(normalized.bytes);
        normalizedFields = normalized.normalizedFields;
    } catch {
        // Exact bytes remain the authoritative comparison. A later mismatch
        // fails rather than claiming a looser clean equivalence.
    }
    const semanticBundle = structuredClone(bundle);
    for (const relative of Object.keys(semanticBundle)) {
        if (relative === "Contents/_CodeSignature" || relative.startsWith("Contents/_CodeSignature/")) delete semanticBundle[relative];
    }
    const binaryRelative = path.relative(plugin.bundle, plugin.binary).split(path.sep).join("/");
    if (comparableSha256 && semanticBundle[binaryRelative]) semanticBundle[binaryRelative].sha256 = comparableSha256;
    return {
        binary: { comparableSha256, mtimeMs: binaryStat.mtimeMs, normalizedFields, sha256: sha256(binaryBytes), size: binaryBytes.length },
        bundle,
        bundleDigest: manifestDigest(bundle),
        generated,
        generatedDigest: manifestDigest(generated),
        objects,
        runtime,
        runtimeDigest: manifestDigest(runtime),
        semanticBundleDigest: manifestDigest(semanticBundle),
    };
}

async function assertProductionArtifact(plugin, run, secrets) {
    const runtimeManifest = JSON.parse(await readFile(path.join(plugin.runtimeRoot, plugin.patchName), "utf8"));
    assert.equal("devModule" in (runtimeManifest.view ?? {}), false, "production runtime must strip view.devModule");
    assert.equal(runtimeManifest.ID, plugin.config.product.bundleIdentifier);
    assert.equal(runtimeManifest.name, plugin.config.product.productName);
    assert.equal(path.basename(plugin.bundle), `${plugin.productName}.vst3`);
    const strayJitConfigs = [
        ...Object.keys(await listTree(plugin.runtimeRoot)).filter((file) => path.basename(file) === "CmajPlugin.json"),
        ...Object.keys(await listTree(plugin.juceRoot)).filter((file) => path.basename(file) === "CmajPlugin.json"),
    ];
    assert.deepEqual(strayJitConfigs, [], "dedicated build must not contain a generic CmajPlugin JIT config");
    await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=4", plugin.bundle], { cwd: path.dirname(plugin.bundle), label: "codesign verification" });
    await run(process.execPath, [path.join(plugin.root, "kit/scripts/check_choc_markers.mjs"), plugin.binary], {
        cwd: path.dirname(plugin.bundle), label: "CHOC marker verification",
    });
    const identityOutput = await run(plugin.identityProbe, [plugin.bundle], { cwd: path.dirname(plugin.bundle), label: "VST3 identity probe" });
    const identity = JSON.parse(identityOutput.trim());
    assert.equal(identity.bundleIdentifier, plugin.config.product.bundleIdentifier);
    // The pinned generator currently advertises the compact native target
    // name. Human/runtime naming is checked independently above; changing
    // this native contract belongs to the separate product-naming decision.
    assert.equal(identity.displayName, plugin.productName);
    assert.match(identity.processorClassId, /^[0-9A-F]{32}$/u);
    return { bundleIdentifier: identity.bundleIdentifier, displayName: identity.displayName, processorClassId: identity.processorClassId };
}

function phaseSummary(label, trace, snapshot, identity) {
    const events = compiledTraceEvents(trace);
    return {
        label,
        binary: snapshot.binary,
        bundleDigest: snapshot.bundleDigest,
        compileEvents: events.compile,
        generatedDigest: snapshot.generatedDigest,
        identity,
        linkEvents: events.link,
        objectCount: Object.keys(snapshot.objects).length,
        runtimeDigest: snapshot.runtimeDigest,
    };
}

function transitionSummary(before, after) {
    return {
        binaryChanged: before.binary.sha256 !== after.binary.sha256,
        generatedContentChanged: changedFiles(before.generated, after.generated),
        generatedMtimeChanged: changedMtimes(before.generated, after.generated),
        objectContentChanged: changedFiles(before.objects, after.objects),
        objectMtimeChanged: changedMtimes(before.objects, after.objects),
        runtimeContentChanged: changedFiles(before.runtime, after.runtime),
    };
}

async function microphonePermission(plugin) {
    const generatedCmake = await readFile(path.join(plugin.juceRoot, "CMakeLists.txt"), "utf8");
    const matches = [...generatedCmake.matchAll(/\bMICROPHONE_PERMISSION_ENABLED\s+(TRUE|FALSE)\b/gu)].map((match) => match[1]);
    assert.equal(matches.length, 1, "generated CMake project must declare microphone permission exactly once");
    return matches[0] === "TRUE";
}

async function replaceExactly(filePath, before, after) {
    const source = await readFile(filePath, "utf8");
    const occurrences = source.split(before).length - 1;
    assert.equal(occurrences, 1, `${path.basename(filePath)} must contain the qualification edit target exactly once`);
    await writeFile(filePath, source.replace(before, after));
}

async function runQualification(options) {
    if (process.platform !== "darwin" || process.arch !== "arm64")
        throw new Error("BK-24C native qualification requires an Apple-silicon Mac.");

    const sourceState = await runCaptured("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: repoRoot, label: "source status" });
    const actualSha = (await runCaptured("git", ["rev-parse", "HEAD"], { cwd: repoRoot, label: "source revision" })).trim();
    if (actualSha !== options.sourceSha) throw new Error(`Source revision ${actualSha} does not match --source-sha ${options.sourceSha}.`);
    if (sourceState.trim() !== "") throw new Error("Native qualification requires a clean source checkout.");

    const destinationConfig = await readDestinationConfig(options.destinationConfig);
    const capability = readCapabilityFromKeychain({ service: destinationConfig.keychainService });
    const destination = createReleaseDestination(destinationConfig, capability);
    const capabilityValue = reveal(capability);
    const feedUrl = reveal(destination.feedUrl);
    const secrets = [feedUrl, capabilityValue];
    const scratch = await mkdtemp(path.join(os.tmpdir(), "bk24-native-"));
    const exportRoot = path.join(scratch, "customer-kit");
    const report = {
        schemaVersion: 1,
        sourceCommit: options.sourceSha,
        platform: process.platform,
        architecture: process.arch,
        coverage: ["fresh", "unchanged", "dsp", "ui", "configuration-reset", "missing-output", "isolated-product", "clean-equivalence"],
        phases: [],
        transitions: {},
    };
    const logDirectory = path.join(scratch, "qualification-logs");
    let commandIndex = 0;
    let currentPhase = "export and setup";
    let retainScratch = false;
    const run = (command, args, settings = {}) => {
        commandIndex += 1;
        const safeLabel = (settings.label ?? path.basename(command)).replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-|-$/gu, "");
        const logFile = path.join(logDirectory, `${String(commandIndex).padStart(2, "0")}-${safeLabel || "command"}.log`);
        return runCaptured(command, args, { ...settings, logFile, secrets });
    };

    try {
        console.log("BK-24C phase: export and setup");
        const publishedManifest = await fetchPublishedManifest(feedUrl, secrets);
        const exportResult = await exportKit(exportRoot, { feedUrl, sourceCommit: options.sourceSha });
        const kit = JSON.parse(await readFile(path.join(exportRoot, "kit/kit.json"), "utf8"));
        const candidateToolchain = JSON.parse(await readFile(path.join(exportRoot, "kit/toolchain.json"), "utf8"));
        const pinnedToolchain = toolchainWithPublishedPins(candidateToolchain, publishedManifest, kit.version);
        await writeFile(path.join(exportRoot, "kit/toolchain.json"), `${JSON.stringify(pinnedToolchain, null, 2)}\n`);
        report.export = { feedConfigured: exportResult.feedConfigured, fileCount: exportResult.fileCount, kitVersion: kit.version };
        report.toolchain = {
            cmajorCommit: pinnedToolchain.cmaj.forkCommit,
            cmaj: { artifact: pinnedToolchain.cmaj.artifact, sha256: pinnedToolchain.cmaj.sha256 },
            cmajPlugin: { artifact: pinnedToolchain.cmajPlugin.artifact, sha256: pinnedToolchain.cmajPlugin.sha256 },
            publishedPinsComposed: true,
        };
        await run("npm", ["run", "kit:setup", "--", "--accept-juce-terms"], { cwd: exportRoot, label: "exported kit:setup" });
        await run("npm", ["run", "kit:doctor", "--", "--strict"], { cwd: exportRoot, label: "exported kit:doctor --strict" });

        const main = await readPlugin(exportRoot, mainPluginDirectory, mainPluginConfig);
        const build = async (label, plugin = main, extra = []) => {
            currentPhase = label;
            console.log(`BK-24C phase: ${label}`);
            const trace = await run("npm", ["run", "fx:prod:build", "--", plugin.alias, ...extra], {
                cwd: exportRoot,
                label: `${label} production build`,
            });
            const snapshot = await snapshotPlugin(plugin);
            const identity = await assertProductionArtifact(plugin, run, secrets);
            report.phases.push(phaseSummary(label, trace, snapshot, identity));
            return { identity, snapshot, trace };
        };

        const fresh = await build("fresh");
        assert.ok(Object.keys(fresh.snapshot.generated).length > 0, "fresh build must generate a JUCE project");
        assert.ok(Object.keys(fresh.snapshot.objects).length > 0, "fresh build must compile native object files");

        const unchanged = await build("unchanged");
        const unchangedTransition = transitionSummary(fresh.snapshot, unchanged.snapshot);
        report.transitions.unchanged = unchangedTransition;
        assert.equal(unchanged.snapshot.runtimeDigest, fresh.snapshot.runtimeDigest, "unchanged runtime bytes must agree");
        assert.equal(unchanged.snapshot.generatedDigest, fresh.snapshot.generatedDigest, "unchanged generated bytes must agree");
        assert.deepEqual(unchangedTransition.generatedMtimeChanged, [], "unchanged generated files must preserve timestamps");
        assert.deepEqual(unchangedTransition.objectMtimeChanged, [], "unchanged build must not recompile objects");
        const unchangedEvents = compiledTraceEvents(unchanged.trace);
        assert.deepEqual(unchangedEvents.compile, [], "unchanged trace must contain no compilation");
        assert.deepEqual(unchangedEvents.link, [], "unchanged trace must contain no native link");

        await replaceExactly(path.join(exportRoot, dspEdit.file), dspEdit.before, dspEdit.after);
        const dsp = await build("dsp-edit");
        const dspTransition = transitionSummary(unchanged.snapshot, dsp.snapshot);
        report.transitions.dsp = dspTransition;
        assert.ok(dspTransition.runtimeContentChanged.includes("EnhancerLite.cmajor"), "DSP edit must enter the packaged runtime");
        assert.ok(dspTransition.generatedContentChanged.length > 0, "DSP edit must change generated native input");
        assert.ok(dspTransition.objectMtimeChanged.length > 0, "DSP edit must recompile native objects");
        assert.equal(dspTransition.binaryChanged, true, "DSP edit must change the dedicated VST3 binary");

        await appendFile(path.join(exportRoot, mainPluginDirectory, "view/source.ts"), `\nconsole.info(${JSON.stringify(uiMarker)});\n`);
        const ui = await build("ui-edit");
        const uiTransition = transitionSummary(dsp.snapshot, ui.snapshot);
        report.transitions.ui = uiTransition;
        assert.ok(uiTransition.runtimeContentChanged.includes("view/app.js"), "UI edit must enter the packaged app.js");
        assert.equal(uiTransition.runtimeContentChanged.includes("EnhancerLite.cmajor"), false, "UI edit must not rewrite packaged DSP source");
        assert.ok(uiTransition.generatedContentChanged.length > 0, "UI edit must change generated native input");
        assert.ok(uiTransition.objectMtimeChanged.length > 0, "UI edit must recompile native objects");
        assert.equal(uiTransition.binaryChanged, true, "UI edit must change the dedicated VST3 binary");
        assert.equal((await readFile(path.join(main.runtimeRoot, "view/app.js"), "utf8")).includes(uiMarker), true);
        assert.equal((await readFile(main.binary)).includes(uiMarker), true, "compiled VST3 must contain the packaged UI marker");

        const config = JSON.parse(await readFile(main.configPath, "utf8"));
        config.disableMicrophonePermission = true;
        await writeFile(main.configPath, `${JSON.stringify(config, null, 2)}\n`);
        const microphoneDisabled = await build("configuration-disabled");
        assert.equal(await microphonePermission(main), false);
        delete config.disableMicrophonePermission;
        await writeFile(main.configPath, `${JSON.stringify(config, null, 2)}\n`);
        const configurationReset = await build("configuration-reset");
        assert.equal(await microphonePermission(main), true, "removed optional configuration must reset cached generated state");
        report.transitions.configurationReset = transitionSummary(microphoneDisabled.snapshot, configurationReset.snapshot);

        const missingOutput = path.join(main.juceRoot, "cmajor_plugin.cpp");
        const missingOutputDigest = sha256(await readFile(missingOutput));
        await rm(missingOutput);
        const recovered = await build("missing-output-recovery");
        assert.equal(sha256(await readFile(missingOutput)), missingOutputDigest, "missing generated output must recover with identical bytes");
        assert.equal(recovered.snapshot.generatedDigest, configurationReset.snapshot.generatedDigest,
            "missing-output recovery must restore the complete generated project exactly");
        report.transitions.missingOutput = transitionSummary(configurationReset.snapshot, recovered.snapshot);

        console.log("BK-24C phase: isolated product scaffold");
        currentPhase = "isolated product scaffold";
        await run("npm", ["run", "kit:new", "--", "bk24_isolated"], { cwd: exportRoot, label: "isolated product scaffold" });
        const isolated = await readPlugin(exportRoot, "fx/bk24_isolated");
        assert.notEqual(isolated.runtimeRoot, main.runtimeRoot);
        assert.notEqual(isolated.juceRoot, main.juceRoot);
        assert.notEqual(isolated.bundle, main.bundle);
        const isolatedBuild = await build("isolated-product", isolated);
        assert.notEqual(isolatedBuild.identity.bundleIdentifier, recovered.identity.bundleIdentifier);
        assert.notEqual(isolatedBuild.identity.processorClassId, recovered.identity.processorClassId);
        report.isolatedProduct = {
            bundleIdentifier: isolatedBuild.identity.bundleIdentifier,
            outputRootsDisjoint: true,
            processorClassId: isolatedBuild.identity.processorClassId,
        };

        const mainAfterIsolated = await snapshotPlugin(main);
        const isolatedMainTransition = transitionSummary(recovered.snapshot, mainAfterIsolated);
        report.transitions.isolatedMain = isolatedMainTransition;
        assert.equal(mainAfterIsolated.runtimeDigest, recovered.snapshot.runtimeDigest,
            "building the isolated product must not change the main runtime");
        assert.equal(mainAfterIsolated.generatedDigest, recovered.snapshot.generatedDigest,
            "building the isolated product must not change the main generated project");
        assert.equal(mainAfterIsolated.bundleDigest, recovered.snapshot.bundleDigest,
            "building the isolated product must not change the main VST3 bundle");
        assert.equal(mainAfterIsolated.binary.sha256, recovered.snapshot.binary.sha256,
            "building the isolated product must not change the main VST3 binary");
        assert.equal(mainAfterIsolated.binary.mtimeMs, recovered.snapshot.binary.mtimeMs,
            "building the isolated product must not touch the main VST3 binary");
        assert.deepEqual(isolatedMainTransition.runtimeContentChanged, []);
        assert.deepEqual(isolatedMainTransition.generatedMtimeChanged, []);
        assert.deepEqual(isolatedMainTransition.objectContentChanged, []);
        assert.deepEqual(isolatedMainTransition.objectMtimeChanged, []);
        assert.deepEqual(changedMtimes(recovered.snapshot.bundle, mainAfterIsolated.bundle), [],
            "building the isolated product must not touch the main VST3 bundle");

        const incrementalFinal = mainAfterIsolated;
        const clean = await build("clean-equivalence", main, ["--clean"]);
        assert.equal(clean.snapshot.runtimeDigest, incrementalFinal.runtimeDigest, "clean runtime bytes must equal final incremental runtime bytes");
        assert.equal(clean.snapshot.generatedDigest, incrementalFinal.generatedDigest, "clean generated bytes must equal final incremental generated bytes");
        const exactBinary = clean.snapshot.binary.sha256 === incrementalFinal.binary.sha256;
        let binaryComparison = "exact";
        if (!exactBinary) {
            assert.ok(incrementalFinal.binary.comparableSha256 && clean.snapshot.binary.comparableSha256,
                "different clean and incremental binaries require supported narrow Mach-O normalization");
            assert.equal(clean.snapshot.binary.comparableSha256, incrementalFinal.binary.comparableSha256,
                "clean and incremental VST3 machine code differ beyond UUID/signature metadata");
            binaryComparison = "normalized LC_UUID and LC_CODE_SIGNATURE payload after exact mismatch";
        }
        const exactBundle = clean.snapshot.bundleDigest === incrementalFinal.bundleDigest;
        if (!exactBundle) {
            assert.equal(clean.snapshot.semanticBundleDigest, incrementalFinal.semanticBundleDigest,
                "clean and incremental VST3 bundles differ beyond signature metadata and normalized Mach-O metadata");
        }
        report.cleanEquivalence = {
            binaryComparison,
            exactBinary,
            exactBundle,
            generatedExact: true,
            runtimeExact: true,
            semanticBundleFallbackUsed: !exactBundle,
        };
        report.status = "passed";

        const serialized = `${JSON.stringify(report, null, 2)}\n`;
        if (options.report) {
            await mkdir(path.dirname(options.report), { recursive: true });
            await writeFile(options.report, serialized, { mode: 0o600 });
            await chmod(options.report, 0o600);
            console.log(`BK-24C native qualification passed; safe report written to ${options.report}`);
        } else {
            console.log(serialized.trim());
        }
        return report;
    } catch (error) {
        retainScratch = true;
        await chmod(scratch, 0o700);
        report.status = "failed";
        report.failedPhase = currentPhase;
        report.error = redactText(error instanceof Error ? error.message : String(error), secrets);
        report.retainedPrivateScratch = scratch;
        report.diagnosticLogDirectory = logDirectory;
        if (options.report) {
            await mkdir(path.dirname(options.report), { recursive: true });
            await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
            await chmod(options.report, 0o600);
        }
        throw new Error(`${report.error}\nRetained private BK-24C diagnostics at ${scratch}.`);
    } finally {
        if (!retainScratch) await rm(scratch, { recursive: true, force: true });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    let secrets = [];
    try {
        const options = parseArguments(process.argv.slice(2));
        await runQualification(options);
    } catch (error) {
        console.error(redactText(error instanceof Error ? error.message : String(error), secrets));
        process.exitCode = 1;
    }
}
