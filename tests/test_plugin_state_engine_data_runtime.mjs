import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPluginStateEngineDataFixture } from "./helpers/build_plugin_state_engine_data_fixture.mjs";

const repo = path.resolve(import.meta.dirname, "..");

async function runNativeFixture(variant = "small", mode) {
    const source = process.env.COSIMO_ENGINE_DATA_CMAJOR_SOURCE;
    const runtime = process.env.COSIMO_CMAJOR_RUNTIME_LIBRARY;
    assert.ok(source && runtime, "set the qualified Cmajor source and runtime explicitly");
    const { buildRoot, manifestPath, identity } = await buildPluginStateEngineDataFixture(variant);
    const executable = path.join(buildRoot, "PluginStateEngineDataProbe");
    const compiled = spawnSync("/usr/bin/c++", [
        "-std=c++17", "-O1", "-g0", "-DCMAJOR_DLL=1",
        `-DENGINE_DATA_WORD_COUNT=${identity.wordCapacity}`,
        "-I", path.join(source, "include"), "-I", path.join(source, "include/choc"),
        path.join(repo, "tests/native/PluginStateEngineDataProbe.cpp"),
        ...["Accelerate", "AudioToolbox", "Cocoa", "CoreAudio", "CoreMIDI", "Foundation", "IOKit"].flatMap(name => ["-framework", name]),
        "-o", executable,
    ], { encoding: "utf8", timeout: 60000 });
    assert.equal(compiled.status, 0, compiled.error?.message ?? compiled.stderr);
    const run = spawnSync(executable, [runtime, manifestPath, ...(variant === "invalid" ? ["--expect-boot-error"] : mode ? [mode] : [])], { encoding: "utf8", timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
    await writeFile(path.join(buildRoot, "probe-run.log"), run.stdout + run.stderr);
    await writeFile(path.join(buildRoot, "probe-result.json"), JSON.stringify({ ...identity, source, runtime, exitCode: run.status }, null, 2));
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr);
    const line = run.stdout.split("\n").find(line => line.startsWith("RESULT "));
    assert.ok(line, "actual native probe must return its measured DSP values");
    return JSON.parse(line.slice("RESULT ".length));
}

test("generated prepared-state QuickJS worker transfers real EngineData values through edits, shared Undo and GUI reopen", { timeout: 120000 }, async () => {
    const result = await runNativeFixture();
    assert.deepEqual(result.checkpoints.map(checkpoint => checkpoint.name), ["hydrated", "edited", "undone", "reopened"]);
    const a = Array.from({ length: 257 }, (_, index) => -700001 + index * 997);
    const b = Array.from({ length: 257 }, (_, index) => 300007 - index * 613);
    for (const checkpoint of result.checkpoints) {
        const edited = checkpoint.name === "edited";
        assert.deepEqual(checkpoint.current, edited ? b : a, `${checkpoint.name}: every actual DSP word must match the independent expected layout`);
        assert.deepEqual(checkpoint.held, a, `${checkpoint.name}: a playing reader must retain the original bank`);
        assert.deepEqual(checkpoint.state.fields.shape.value, edited ? { base: 300007, step: -613 } : { base: -700001, step: 997 }, "state and history retain the small editable representation");
        assert.equal(checkpoint.state.fields.shape.application.kind, "acknowledged");
        assert.equal(checkpoint.state.history.canUndo, edited);
        assert.equal(checkpoint.state.history.canRedo, checkpoint.name === "undone" || checkpoint.name === "reopened");
    }
    assert.deepEqual(result.checkpoints[3].scope, result.checkpoints[0].scope, "closing all ordinary views does not recreate the patch owner");
    assert.notEqual(result.checkpoints[3].client, result.checkpoints[0].client);
    const commits = result.receipts.filter(receipt => receipt.operation === 3);
    assert.equal(commits.length, 3, "hydrate/edit/Undo each reach the real receiver exactly once; reopen does not reinstall");
    assert.ok(commits.every(receipt => receipt.status === 0 && receipt.currentGeneration === receipt.generation));
    assert.ok(commits[0].generation < commits[1].generation && commits[1].generation < commits[2].generation);
    assert.equal(result.receipts.filter(receipt => receipt.operation === 2).length, 27, "each 257-word value traverses nine real bounded chunk receipts");
});

test("generated worker transfers 6144-word packets and the final partial packet through actual Patch and shared Undo", { timeout: 120000 }, async () => {
    const result = await runNativeFixture("bulk");
    const wordCount = 12289;
    const a = Array.from({ length: wordCount }, (_, index) => -700001 + index * 997);
    const b = Array.from({ length: wordCount }, (_, index) => 300007 - index * 613);
    assert.deepEqual(result.checkpoints.map(checkpoint => checkpoint.name), ["hydrated", "edited", "undone", "reopened"]);
    for (const checkpoint of result.checkpoints) {
        const edited = checkpoint.name === "edited";
        // Every test word is an exactly representable Float32 integer, so the
        // public Patch output conversion cannot hide a changed payload bit.
        assert.deepEqual(checkpoint.current, edited ? b : a, `${checkpoint.name}: all 12289 current DSP words including both packet boundaries`);
        assert.deepEqual(checkpoint.held, a, `${checkpoint.name}: the held bank is unchanged`);
        assert.deepEqual(checkpoint.state.fields.shape.value, edited ? { base: 300007, step: -613 } : { base: -700001, step: 997 });
        assert.equal(checkpoint.state.fields.shape.application.kind, "acknowledged");
        assert.equal(checkpoint.state.history.canUndo, edited);
        assert.equal(checkpoint.state.history.canRedo, checkpoint.name === "undone" || checkpoint.name === "reopened");
    }
    const chunks = result.receipts.filter(receipt => receipt.operation === 2);
    assert.equal(chunks.length, 9, "each of three complete values uses two 6144-word packets and one final word");
    assert.ok(chunks.every(receipt => receipt.status === 0));
    assert.deepEqual(chunks.map(receipt => receipt.receivedWords), [6144, 12288, 12289, 6144, 12288, 12289, 6144, 12288, 12289]);
    const commits = result.receipts.filter(receipt => receipt.operation === 3);
    assert.equal(commits.length, 3);
    assert.ok(commits.every(receipt => receipt.status === 0 && receipt.currentGeneration === receipt.generation));
    assert.deepEqual(result.checkpoints[3].scope, result.checkpoints[0].scope);
    assert.notEqual(result.checkpoints[3].client, result.checkpoints[0].client);
});

test("an invalid authored engineData declaration keeps its original QuickJS boot diagnostic after native notifications", { timeout: 120000 }, async () => {
    const result = await runNativeFixture("invalid");
    assert.ok(result.bootErrors.length > 0, "the real failed worker must report a diagnostic");
    assert.ok(result.bootErrors.some(error => error.includes("8192")), "retain the actual engineData constructor capacity failure");
    assert.ok(result.bootErrors.every(error => !error.includes("currentView")), "native messages after failed import must not overwrite the cause with a missing global ReferenceError");
    assert.ok(result.bootErrors.at(-1).includes("8192"), "the last native status still describes the authored configuration failure");
});

test("real Performer reset invalidates old application evidence and the surviving worker reinstalls the saved prepared value", { timeout: 120000 }, async () => {
    const result = await runNativeFixture("small", "--reset");
    assert.deepEqual(result.checkpoints.map(checkpoint => checkpoint.name), ["hydrated", "edited", "undone", "reopened", "reset"]);
    const before = result.checkpoints[3];
    const after = result.checkpoints[4];
    assert.equal(before.state.history.canRedo, true, "there is real pre-reset history to invalidate");
    assert.equal(after.scope.owner, before.scope.owner, "the same generated worker owns the recreated Performer");
    assert.ok(after.scope.document > before.scope.document, "old command and delivery receipts belong to the discarded document");
    assert.deepEqual(after.state.fields.shape.value, { base: -700001, step: 997 }, "reset preserves the saved editable shape");
    assert.deepEqual(after.current, Array.from({ length: 257 }, (_, index) => -700001 + index * 997), "all words were reinstalled into the new actual Performer");
    assert.deepEqual(after.held, Array(257).fill(0), "readers of the destroyed Performer do not survive a full reset");
    assert.equal(after.state.fields.shape.application.kind, "acknowledged");
    assert.deepEqual(after.state.history, { canUndo: false, canRedo: false });
    const commits = result.receipts.filter(receipt => receipt.operation === 3);
    assert.equal(commits.length, 4, "reset requires one new DSP commit beyond hydrate, edit and Undo");
    assert.ok(commits.every(receipt => receipt.status === 0));
    assert.equal(commits[3].generation, 1, "the fourth commit reaches new storage, not the previous Performer frontier");
});
