import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { effectPlugins, repoRoot } from "../kit/fx/build-effect.mjs";
import { inspectVST3Bundle } from "../kit/scripts/install_vst3.mjs";
import { enhanceThatNativeDependencies } from "./enhance-that-release-config.mjs";
import { renderEnhanceThatPreinstall } from "./enhance-that-installer.mjs";
import {
    adHocVst3SigningArgs, assertArchiveTreeContainsOnlyFilesAndDirectories,
    assertPayloadModes, assertSeqFxDistributableExecutableIsSourceFree,
    assertSourceStateUnchanged, buildUnsignedFlatPackage, canonicalPayloadFingerprint,
    captureActualNativeDependencyProvenance, createDeterministicZip,
    getReleaseGitState, normalizePayloadModes, normalizeTreeTimestamps,
    notarizeStapleAndAssess, parseJsonWithTrailingCommas, payloadInventoryErrors,
    readDeclaredNativeDependencyProvenance,
    signInstaller, signStagedVst3,
} from "./build_seqfx_beta_release.mjs";

const identity = Object.freeze({
    publicName: "Enhance That", bundleName: "EnhanceThat", manufacturer: "Cosimo",
    patchId: "dev.cosimo.enhancer-lite", pluginCode: "CsEL", manufacturerCode: "Cosi",
    installerIdentifier: "dev.cosimo.enhancer-lite.pkg",
    processorClassId: "ABCDEF019182FAEB436F73694373454C",
    controllerClassId: "ABCDEF011234ABCD436F73694373454C",
});

export function parseEnhanceThatArgs(args) {
    const options = { mode: "plan", repeat: false, auDeferred: null };
    let modeSpecified = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (["--plan", "--unsigned", "--release"].includes(arg)) {
            if (modeSpecified) throw new Error("Choose one packaging mode.");
            options.mode = arg.slice(2);
            modeSpecified = true;
        } else if (arg === "--verify-repeatable-packaging") options.repeat = true;
        else if (arg === "--au-deferred") {
            if (options.auDeferred !== null || !args[i + 1] || args[i + 1].startsWith("--"))
                throw new Error("--au-deferred needs the recorded format decision.");
            options.auDeferred = args[++i];
        } else throw new Error(`Unknown argument: ${arg}`);
    }
    if (options.repeat && options.mode !== "unsigned")
        throw new Error("Repeatability compares unsigned packaging only.");
    return options;
}

export function enhanceThatSourceErrors(plugin, patch) {
    const errors = [];
    if (patch?.name !== identity.publicName) errors.push("Compose the reviewed Enhance That product name first.");
    if (patch?.ID !== identity.patchId) errors.push(`Patch ID must remain ${identity.patchId}.`);
    for (const key of ["pluginCode", "manufacturerCode"])
        if (patch?.plugin?.[key] !== identity[key]) errors.push(`Patch ${key} must remain ${identity[key]}.`);
    if (patch?.manufacturer !== identity.manufacturer) errors.push("Patch manufacturer must remain Cosimo.");
    if (plugin?.productName !== identity.bundleName || plugin?.cmakeTarget !== identity.bundleName)
        errors.push("Native target and bundle basename must be EnhanceThat.");
    if (plugin?.previousProductName !== "CosimoEnhancerLite")
        errors.push("Compose the reviewed previousProductName migration field first.");
    if (typeof patch?.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(patch.version))
        errors.push("The plugin version must be a three-part numeric version.");
    return errors;
}

function run(executable, args, { capture = true, cwd = repoRoot, env = process.env } = {}) {
    const result = spawnSync(executable, args, { cwd, env, encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0)
        throw new Error([`${path.basename(executable)} failed (${result.status})`, result.stdout, result.stderr].filter(Boolean).join("\n"));
    return result.stdout?.trim() ?? "";
}

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fileHash = async file => hash(await readFile(file));
const jsonFile = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });

export function selectEnhanceThatSigningIdentities(output, environment = process.env) {
    const result = {};
    for (const [role, type, variable] of [
        ["application", "Application", "COSIMO_DEVELOPER_ID_APPLICATION"],
        ["installer", "Installer", "COSIMO_DEVELOPER_ID_INSTALLER"],
    ]) {
        const matches = [...output.matchAll(/^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"([^"]+)"\s*$/gmu)]
            .map(match => ({ sha1Fingerprint: match[1].toUpperCase(), commonName: match[2],
                teamIdentifier: match[2].match(/\(([A-Z0-9]{10})\)$/u)?.[1] }))
            .filter(item => item.commonName.startsWith(`Developer ID ${type}: `) && item.teamIdentifier)
            .filter(item => !environment[variable] || [item.sha1Fingerprint, item.commonName].includes(environment[variable]));
        if (matches.length !== 1) throw new Error(`Set ${variable} to one available Developer ID ${type} identity.`);
        result[role] = matches[0];
    }
    if (result.application.teamIdentifier !== result.installer.teamIdentifier)
        throw new Error("Plugin and installer signing identities must have the same team.");
    return result;
}

export async function claimEnhanceThatOutput(directory, { repositoryRoot = repoRoot } = {}) {
    const root = await realpath(repositoryRoot);
    const relative = path.relative(root, path.resolve(directory));
    if (!/^release\/enhance-that\/\d+\.\d+\.\d+\/(unsigned|release)$/u.test(relative))
        throw new Error("Enhance That output must remain inside this worktree's versioned release directory.");
    let current = root;
    for (const component of relative.split(path.sep).slice(0, -1)) {
        current = path.join(current, component);
        try {
            const entry = await lstat(current);
            if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Unsafe release directory: ${current}`);
        } catch (error) {
            if (error?.code !== "ENOENT") throw error;
            await mkdir(current, { mode: 0o700 });
        }
    }
    await mkdir(directory, { mode: 0o700 }); // Existing output is never erased or overwritten.
}

function cacheValue(text, key) {
    const lines = text.split(/\r?\n/u).filter(line => line.startsWith(`${key}:`));
    if (lines.length !== 1 || !lines[0].includes("=")) throw new Error(`Missing/ambiguous native cache entry ${key}.`);
    return lines[0].slice(lines[0].indexOf("=") + 1);
}

/** Evidence for the actual generated DSP and link inputs; retained again for the extracted binary. */
async function staticDspEvidence(config, cmakeExecutable, output) {
    const nativeRoot = path.join(repoRoot, config.nativeRoot);
    const cache = await readFile(path.join(repoRoot, config.paths.nativeBuildCmakeCache), "utf8");
    assert.equal(await realpath(cacheValue(cache, "CMAKE_COMMAND")), await realpath(cmakeExecutable));
    const cmaj = cacheValue(cache, "COSIMO_CMAJ_EXECUTABLE");
    const cpp = await readFile(path.join(nativeRoot, "cmajor_plugin.cpp"), "utf8");
    assert.ok(cpp.includes("using Plugin = cmaj::plugin::GeneratedPlugin<::CosimoEnhancerLite>;"));
    assert.ok(cpp.includes("struct CosimoEnhancerLite"));
    const cmajorRoot = cacheValue(cache, "CPM_PACKAGE_cosimo_cmajor_SOURCE_DIR");
    const header = await readFile(path.join(cmajorRoot, "include/cmajor/helpers/cmaj_JUCEPlugin.h"), "utf8");
    assert.ok(header.includes("cmaj::createEngineForGeneratedCppProgram<typename GeneratedPlugin::PerformerClass>()"));
    const shared = path.join(nativeRoot, "_build/plugin/EnhanceThat_artefacts/Release/libEnhanceThat_SharedCode.a");
    const memberDirectory = path.join(output, "_native-members");
    await mkdir(memberDirectory, { mode: 0o700 });
    const membersByArchitecture = {};
    try {
        for (const architecture of ["arm64", "x86_64"]) {
            const thin = path.join(memberDirectory, `${architecture}.a`);
            run("/usr/bin/lipo", [shared, "-thin", architecture, "-output", thin]);
            const members = run("/usr/bin/ar", ["-t", thin]).split(/\r?\n/u).filter(Boolean);
            assert.ok(members.includes("cmajor_plugin.cpp.o"));
            assert.ok(members.every(name => name === "cmajor_plugin.cpp.o" || /^juce_[A-Za-z0-9_]+\.(?:cpp|mm|c)\.o$/u.test(name)), "Unexpected native archive member");
            membersByArchitecture[architecture] = members;
        }
    } finally { await rm(memberDirectory, { recursive: true }); }
    const link = await readFile(path.join(nativeRoot, "_build/plugin/CMakeFiles/EnhanceThat_VST3.dir/link.txt"), "utf8");
    const archives = link.match(/[^\s"]+\.a\b/gu) ?? [];
    assert.deepEqual(archives, ["EnhanceThat_artefacts/Release/libEnhanceThat_SharedCode.a"]);
    const linkedObjects = link.match(/[^\s"]+\.o\b/gu) ?? [];
    assert.ok(linkedObjects.length > 0 && linkedObjects.every(object =>
        /^juce_audio_plugin_client_[A-Za-z0-9_]+\.(?:cpp|mm)\.o$/u.test(path.basename(object))),
    "Unexpected object outside the generated-DSP/JUCE archive");
    assert.ok(!/llvm|libcmajor|libcmaj|\.dylib\b/iu.test(link), "Unexpected engine or external library in native link recipe");
    return { generatedCppSha256: hash(cpp), wrapperHeaderSha256: hash(header), linkRecipeSha256: hash(link),
        staticArchiveSha256: await fileHash(shared), staticArchiveMembers: membersByArchitecture,
        linkedClientObjects: linkedObjects.map(object => path.basename(object)),
        compilerExecutableSha256: await fileHash(cmaj), cmakeExecutableSha256: await fileHash(cmakeExecutable),
        nodeExecutableSha256: await fileHash(process.execPath),
        dspBinding: "GeneratedPlugin / createEngineForGeneratedCppProgram", jitEngineLinked: false };
}

async function verifyBundle(config, bundle) {
    const inspection = await inspectVST3Bundle(bundle, { identityProbe: config.identityProbe });
    if (inspection.status !== "verified") throw new Error(JSON.stringify(inspection));
    assert.deepEqual(inspection.identity, { bundleIdentifier: identity.patchId,
        processorClassId: identity.processorClassId, displayName: identity.publicName });
    const info = JSON.parse(run("/usr/bin/plutil", ["-convert", "json", "-o", "-", path.join(bundle, "Contents/Info.plist")]));
    for (const field of ["CFBundleVersion", "CFBundleShortVersionString"]) assert.equal(info[field], config.identity.pluginVersion);
    assert.equal(info.CFBundleExecutable, identity.bundleName);
    const moduleInfo = parseJsonWithTrailingCommas(await readFile(path.join(bundle, "Contents/Resources/moduleinfo.json"), "utf8"), "moduleinfo.json");
    assert.equal(moduleInfo.Name, identity.publicName);
    assert.equal(moduleInfo.Version, config.identity.pluginVersion);
    assert.deepEqual(moduleInfo.Classes.map(item => ({ cid: item.CID, name: item.Name, category: item.Category })), [
        { cid: identity.processorClassId, name: identity.publicName, category: "Audio Module Class" },
        { cid: identity.controllerClassId, name: identity.publicName, category: "Component Controller Class" },
    ]);
    const executable = path.join(bundle, "Contents/MacOS/EnhanceThat");
    await assertSeqFxDistributableExecutableIsSourceFree(executable);
    const architectures = run("/usr/bin/lipo", ["-archs", executable]).split(/\s+/u).sort();
    assert.deepEqual(architectures, ["arm64", "x86_64"]);
    const dependencies = run("/usr/bin/otool", ["-L", executable]).split(/\r?\n/u)
        .filter(line => /^\s/u.test(line)).map(line => line.trim().split(" (compatibility")[0]);
    assert.ok(dependencies.length > 0);
    assert.ok(dependencies.every(name => name.startsWith("/System/Library/") || name.startsWith("/usr/lib/")));
    return { identity: inspection.identity, payloadSha256: inspection.digest,
        executableSha256: await fileHash(executable), architectures, dynamicDependencies: [...new Set(dependencies)] };
}

async function assemble({ config, output, source, epoch, options, signing, provenance, native, built }) {
    await mkdir(output, { recursive: true });
    const work = path.join(output, "_work");
    const staging = path.join(work, "payload");
    const bundle = path.join(staging, "Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3");
    await mkdir(path.dirname(bundle), { recursive: true });
    run("/usr/bin/ditto", ["--norsrc", "--noextattr", "--noqtn", config.builtVst3, bundle]);
    assert.equal((await verifyBundle(config, bundle)).payloadSha256, built.payloadSha256);
    run("/usr/bin/codesign", ["--remove-signature", bundle]);
    await writeFile(path.join(bundle, "Contents/Resources/THIRD_PARTY_NOTICES.txt"), await readFile(config.notices));
    await assertArchiveTreeContainsOnlyFilesAndDirectories(staging);
    await normalizePayloadModes(config, staging);
    const pluginSigning = signing ? signStagedVst3(bundle, signing.application)
        : (run("/usr/bin/codesign", adHocVst3SigningArgs(bundle)), { signatureKind: "ad-hoc", signedWithDeveloperId: false });
    await normalizePayloadModes(config, staging);
    await normalizeTreeTimestamps(staging, epoch);
    await assertPayloadModes(config, staging);
    const staged = await verifyBundle(config, bundle);
    const scripts = path.join(work, "scripts");
    await mkdir(scripts, { mode: 0o755 });
    const preinstall = renderEnhanceThatPreinstall({ teamIdentifier: signing?.application.teamIdentifier ?? null });
    await writeFile(path.join(scripts, "preinstall"), preinstall, { mode: 0o755 });
    await chmod(scripts, 0o755);
    await chmod(path.join(scripts, "preinstall"), 0o755);
    const name = `EnhanceThat-${config.releaseVersion}-macOS`;
    const unsigned = path.join(work, `${name}-unsigned.pkg`);
    // Installer versions follow the versioned release, while bundle versions remain the product's own.
    await buildUnsignedFlatPackage(config, staging, unsigned, work, epoch, { scriptsRoot: scripts, packageVersion: config.releaseVersion });
    const packageFile = path.join(output, `${name}.pkg`);
    let installerSigning = { signedWithDeveloperId: false };
    let notarization = { notarized: false, stapled: false, gatekeeperAccepted: false };
    if (signing) {
        installerSigning = signInstaller(unsigned, packageFile, signing.installer);
        const result = notarizeStapleAndAssess(packageFile);
        notarization = { notarized: true, stapled: result.stapled, gatekeeperAccepted: result.gatekeeperAccepted,
            submissionId: result.notarizationId, status: result.notarizationStatus };
    } else await writeFile(packageFile, await readFile(unsigned), { flag: "wx" });
    const payloadFiles = run("/usr/sbin/pkgutil", ["--payload-files", packageFile]).split(/\r?\n/u).filter(Boolean);
    assert.deepEqual(payloadInventoryErrors(config, payloadFiles, { signed: !!signing }), []);
    const expanded = path.join(work, "expanded");
    run("/usr/sbin/pkgutil", ["--expand-full", packageFile, expanded]);
    const extracted = path.join(expanded, "Payload/Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3");
    const extractedEvidence = await verifyBundle(config, extracted);
    assert.equal(extractedEvidence.payloadSha256, staged.payloadSha256);
    assert.equal(await readFile(path.join(expanded, "Scripts/preinstall"), "utf8"), preinstall);
    const manifest = {
        schemaVersion: 1, status: "unpublished candidate; host and customer qualification pending",
        sourceCommit: source.commit, releaseVersion: config.releaseVersion, pluginVersion: config.identity.pluginVersion,
        formats: { VST3: "included", AU: "deferred" }, auDecision: options.auDeferred,
        supportedArchitectures: ["arm64"], retainedMacOSMajors: [15, 26],
        dependencies: Object.fromEntries(["cmajor", "choc", "juce"].map(key => [key, { commit: provenance[key].actualRevision, clean: provenance[key].clean }])),
        native, built, extracted: extractedEvidence, signing: { plugin: pluginSigning, installer: installerSigning }, notarization,
        noticesSha256: await fileHash(config.notices), preinstallSha256: hash(preinstall),
        packageSha256: await fileHash(packageFile), sourceDateEpoch: epoch,
        qualification: { cleanMacOS15: "pending", cleanMacOS26: "pending", DAW: "pending", listening: "pending", matchingKitAndTools: "pending" },
    };
    await jsonFile(path.join(output, "release-manifest.json"), manifest);
    await writeFile(path.join(output, "THIRD_PARTY_NOTICES.txt"), await readFile(config.notices));
    await writeFile(path.join(output, "README.txt"), `Enhance That ${config.releaseVersion}\n\nUnpublished ${signing ? "signed/notarized" : "unsigned validation"} candidate. Final host/customer qualification remains pending.\n\nRetained target: Apple Silicon macOS 15 and 26, VST3. AU deferred: ${options.auDeferred}\n\nQuit the DAW and open the pkg. Restart/rescan, then load Enhance That.\nThe installer checks local user and system VST3 folders. If it reports a legacy or user-level copy, retain that exact copy outside all plugin scan folders before retrying. It never deletes those copies or loads their executable as root.\nA matching Developer ID system update retains the previous bundle in /Library/Audio/Plug-Ins/.EnhanceThat.vst3.previous.* before replacement; keep its RECOVERY.txt.\n\nInstalled path: /Library/Audio/Plug-Ins/VST3/EnhanceThat.vst3\nUninstall: quit the host and retain/remove that bundle, then rescan.\n`);
    const packageItems = [path.basename(packageFile), "release-manifest.json", "README.txt", "THIRD_PARTY_NOTICES.txt"];
    const checksums = await Promise.all(packageItems.map(async item => `${await fileHash(path.join(output, item))}  ${item}`));
    await writeFile(path.join(output, "checksums.txt"), `${checksums.join("\n")}\n`);
    const zipParent = path.join(work, "zip");
    const zipRoot = path.join(zipParent, name);
    await mkdir(zipRoot, { recursive: true });
    for (const item of [...packageItems, "checksums.txt"])
        await writeFile(path.join(zipRoot, item), await readFile(path.join(output, item)));
    const zip = path.join(output, `${name}.zip`);
    await createDeterministicZip(zipParent, name, zip, epoch);
    await writeFile(path.join(output, `${name}.zip.sha256`), `${await fileHash(zip)}  ${name}.zip\n`);
    const result = { packageSha256: await fileHash(packageFile), zipSha256: await fileHash(zip),
        payload: await canonicalPayloadFingerprint(staging) };
    await rm(work, { recursive: true });
    return result;
}

export async function main(args = process.argv.slice(2)) {
    const options = parseEnhanceThatArgs(args);
    const plugin = effectPlugins["enhancer-lite"];
    const patch = JSON.parse(await readFile(path.join(repoRoot, plugin.patch), "utf8"));
    const kit = JSON.parse(await readFile(path.join(repoRoot, "kit/kit.json"), "utf8"));
    if (!/^\d+\.\d+\.\d+$/u.test(kit.version)) throw new Error("Invalid kit release version.");
    const config = {
        identity: { ...identity, pluginVersion: patch.version }, releaseVersion: kit.version,
        nativeRoot: plugin.juceOut, nativeDependencies: enhanceThatNativeDependencies,
        paths: { nativeBuildCmakeCache: `${plugin.juceOut}/_build/CMakeCache.txt` },
        builtVst3: path.join(repoRoot, plugin.juceOut, "_build/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3"),
        identityProbe: path.join(repoRoot, plugin.juceOut, "_build/identity_probe/kit_vst3_identity_probe"),
        notices: path.join(repoRoot, "legal/enhance-that/THIRD_PARTY_NOTICES.txt"),
    };
    const errors = enhanceThatSourceErrors(plugin, patch);
    const source = getReleaseGitState();
    const output = path.join(repoRoot, "release/enhance-that", kit.version, options.mode);
    if (options.mode === "plan") {
        const noticesEntry = await lstat(config.notices).catch(error => {
            if (error?.code === "ENOENT") return null;
            throw error;
        });
        console.log(JSON.stringify({ mode: "plan", sourceCommit: source.commit, releaseVersion: kit.version,
            nativeCommand: "FX_DISTRIBUTABLE_RUNTIME=1 npm run fx:prod:build -- enhancer-lite --clean",
            outputParent: path.dirname(output), sourceErrors: errors, auDecision: options.auDeferred ?? "pending",
            notices: { file: "legal/enhance-that/THIRD_PARTY_NOTICES.txt", regularFileExists: noticesEntry?.isFile() ?? false },
            execution: "Requires a clean reviewed worktree, tracked notices, and Bob's native/package slot. Never installs or publishes." }, null, 2));
        return;
    }
    if (process.platform !== "darwin") throw new Error("Enhance That packaging requires macOS.");
    if (errors.length) throw new Error(errors.join("\n"));
    if (source.worktreeStatus) throw new Error("Release packaging requires a clean worktree including untracked files.");
    await readDeclaredNativeDependencyProvenance(config);
    if (!/^[1-9][0-9]*$/u.test(process.env.COSIMO_CMAKE_JOBS ?? ""))
        throw new Error("Set COSIMO_CMAKE_JOBS to the native job budget allocated for this run.");
    if (!options.auDeferred?.trim()) throw new Error("Record the explicit AU defer decision; this entrypoint packages VST3 only.");
    run("/usr/bin/git", ["ls-files", "--error-unmatch", "legal/enhance-that/THIRD_PARTY_NOTICES.txt"]);
    if (!(await lstat(config.notices)).isFile()) throw new Error("Missing regular tracked notices file.");
    const signing = options.mode === "release" ? selectEnhanceThatSigningIdentities(run("/usr/bin/security", ["find-identity", "-v"])) : null;
    if (signing && !process.env.COSIMO_NOTARY_PROFILE) throw new Error("Set the existing COSIMO_NOTARY_PROFILE before signing.");
    const epoch = Number(run("/usr/bin/git", ["show", "-s", "--format=%ct", "HEAD"]));
    const cmake = await realpath(run("/usr/bin/which", ["cmake"]));
    await claimEnhanceThatOutput(output);
    run(process.execPath, ["kit/fx/prod-effect.mjs", "build", "enhancer-lite", "--clean"], {
        capture: false, env: { ...process.env, FX_DISTRIBUTABLE_RUNTIME: "1", COSIMO_RELEASE_NODE: process.execPath, COSIMO_RELEASE_CMAKE: cmake },
    });
    assertSourceStateUnchanged(source, getReleaseGitState());
    const provenance = await captureActualNativeDependencyProvenance(config);
    const native = await staticDspEvidence(config, cmake, output);
    const built = await verifyBundle(config, config.builtVst3);
    const inputs = { config, source, epoch, options, signing, provenance, native, built };
    const first = await assemble({ ...inputs, output });
    if (options.repeat) {
        const repeatOutput = path.join(output, "_repeat");
        const second = await assemble({ ...inputs, output: repeatOutput });
        assert.deepEqual(second, first, "Two packaging assemblies of one native build differ");
        await jsonFile(path.join(output, "unsigned-packaging-repeatability.json"), {
            sourceCommit: source.commit, nativeBuildsCompared: 1, independentNativeBuildReproducibility: false, first, second,
        });
        await rm(repeatOutput, { recursive: true });
    }
    assertSourceStateUnchanged(source, getReleaseGitState());
    console.log(`Prepared unpublished Enhance That candidate: ${output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { await main(); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
