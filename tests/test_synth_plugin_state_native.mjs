import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "vite";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
test("actual synth QuickJS owner applies an amount-only edit and shared Undo to real audio", { timeout: 240000 }, async () => {
    const source = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    assert.ok(source && runtime, "Set the qualified source and runtime explicitly");
    const out = path.join(root, "build/plugin_state_synth_qualification");
    await mkdir(out, { recursive: true });
    for (const name of ["cmajor", "assets"]) {
        try { await symlink(path.join(root, name), path.join(out, name)); }
        catch (error) { if (error.code !== "EEXIST") throw error; }
        assert.equal(await realpath(path.join(out, name)), await realpath(path.join(root, name)), "qualification input link must belong to this checkout");
    }
    await build({ configFile: path.join(root, "ui/vite.worker.config.mjs"),
        build: { outDir: out, emptyOutDir: false }, logLevel: "warn" });
    const laneAPI = await loadUIModule(root, "ui/shared/lane-state-v2.ts");
    const lane = laneAPI.createFullDefaultLaneStateV2();
    lane.chain = lane.chain.map(node => ({ ...node, enabled: node.deviceId === "globalFilter#1" }));
    assert.equal(lane.chain[0].deviceId, "globalFilter#1", "the measured filter occupies actual rack position zero");
    assert.equal(lane.devices["globalFilter#1"].params.globalFilterMode, 1, "the measured filter is lowpass, not Off");
    assert.equal(lane.devices["globalFilter#1"].params.globalFilterCutoff, 20000);
    assert.deepEqual(lane.output, { mix: 1, bypassed: false });
    const lanePath = path.join(out, "lane.json");
    await writeFile(lanePath, laneAPI.serializeLaneStateV2(lane));
    const manifest = JSON.parse(await readFile(path.join(root, "WavetableSynth.cmajorpatch"), "utf8"));
    manifest.worker = "wavetable-worker.js";
    delete manifest.view;
    const manifestPath = path.join(out, "WavetableSynth.cmajorpatch");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const hash = async file => createHash("sha256").update(await readFile(file)).digest("hex");
    const revision = spawnSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" });
    const status = spawnSync("git", ["-C", source, "status", "--porcelain"], { encoding: "utf8" });
    assert.equal(revision.status, 0, revision.stderr);
    assert.equal(status.status, 0, status.stderr);
    const identity = { cmajorCommit: revision.stdout.trim(), cmajorStatus: status.stdout.trim(), source: await realpath(source), runtime: await realpath(runtime), runtimeSha256: await hash(runtime), workerSha256: await hash(path.join(out, manifest.worker)),
        workerSourceSha256: await hash(path.join(root, "ui/worker/wavetable-worker.ts")),
        patchHeaderSha256: await hash(path.join(source, "include/cmajor/helpers/cmaj_Patch.h")),
        audioMidiHeaderSha256: await hash(path.join(source, "include/cmajor/helpers/cmaj_AudioMIDIPerformer.h")),
        probeSourceSha256: await hash(path.join(root, "tests/native_quickjs/SynthPluginStateProbe.cpp")),
        cmajorSources: Object.fromEntries(await Promise.all(manifest.source.map(async file => [file, await hash(path.join(root, file))]))) };
    await writeFile(path.join(out, "provenance.json"), JSON.stringify(identity, null, 2));
    const binary = path.join(out, "SynthPluginStateProbe");
    const compile = spawnSync("/usr/bin/c++", ["-std=c++17", "-O1", "-g0", "-DCMAJOR_DLL=1",
        "-I", path.join(source, "include"), "-I", path.join(source, "include/choc"),
        "-I", path.join(root, "native/three_oscillator_renderer"),
        "-I", path.join(root, "native/three_oscillator_renderer/third_party/xsimd/include"),
        path.join(root, "tests/native_quickjs/SynthPluginStateProbe.cpp"),
        path.join(root, "native/three_oscillator_renderer/RendererBridge.cpp"),
        path.join(root, "native/three_oscillator_renderer/WarpRenderer.cpp"),
        ...["Accelerate", "AudioToolbox", "Cocoa", "CoreAudio", "CoreMIDI", "Foundation", "IOKit"].flatMap(name => ["-framework", name]),
        "-o", binary], { encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    await writeFile(path.join(out, "compile.log"), compile.stdout + compile.stderr);
    assert.equal(compile.status, 0, compile.error?.message ?? compile.stderr);
    const run = spawnSync(binary, [runtime, manifestPath, lanePath], { encoding: "utf8", timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
    await writeFile(path.join(out, "run.log"), run.stdout + run.stderr);
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr);
    const line = run.stdout.split("\n").find(line => line.startsWith("RESULT "));
    assert.ok(line, "the actual native process must report its measurements");
    const result = JSON.parse(line.slice(7));
    assert.ok(result.editedRms > 4 * result.routedRms);
    assert.ok(result.editedRms > 4 * result.undoneRms);
    assert.equal(result.editSerial, result.bootSerial + 1);
    assert.equal(result.undoSerial, result.editSerial + 1);
    assert.ok(result.hostEffects >= 3);
    assert.equal(result.rackParamsSerial, 8);
    assert.equal(result.rackMask, 1);
    assert.equal(result.inputPushFailures, 0);
});
