import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { setImmediate } from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** The host side of the state channel a built worker talks to. */
function fakeHost() {
    const sent = [];
    const listeners = new Set();
    return {
        listeners,
        connection: {
            addEventListener(type, listener) { assert.equal(type, "kit_state"); listeners.add(listener); },
            removeEventListener(type, listener) { assert.equal(type, "kit_state"); listeners.delete(listener); },
            sendMessageToServer(envelope) { sent.push(structuredClone(envelope.message)); },
        },
        deliver(message) { for (const listener of [...listeners]) listener(structuredClone(message)); },
        messages(kind) { return sent.filter((message) => message.kind === kind); },
    };
}

async function importWorker(runtime) {
    const patch = (await readdir(runtime)).find((name) => name.endsWith(".cmajorpatch"));
    const manifest = JSON.parse(await readFile(path.join(runtime, patch), "utf8"));
    assert.equal(manifest.worker, "worker.js", "the build generates the worker from state.ts");
    return (await import(pathToFileURL(path.join(runtime, manifest.worker)).href)).default;
}

/**
 * Builds a declaration-only plugin (a state.ts and no worker of its own) in a
 * temporary project that holds just the kit, so nothing is added to this
 * checkout's fx/ or build/. Returns the generated worker's entry point.
 */
async function buildDeclaredPlugin(t, state) {
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-state-build-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, "kit"));
    for (const entry of ["fx", "scripts", "ui", "kit.json", "index.ts", "package.json"])
        await cp(path.join(repoRoot, "kit", entry), path.join(root, "kit", entry), { recursive: true });
    await symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "state-build-fixture", type: "module" }));
    const plugin = path.join(root, "fx/state_lab");
    await mkdir(path.join(plugin, "view"), { recursive: true });
    await writeFile(path.join(plugin, "State.cmajorpatch"), JSON.stringify({
        CmajorVersion: 1, ID: "test.state-build", name: "State Lab", version: "1.0.0", source: "State.cmajor",
        view: { src: "view/index.js", devModule: "/fx/state_lab/view/source.ts" },
    }));
    await writeFile(path.join(plugin, "State.plugin.json"), JSON.stringify({ schemaVersion: 1, stateSource: "fx/state_lab/state.ts" }));
    await writeFile(path.join(plugin, "State.cmajor"), "processor State { input value float32 hostGain [[ min: -12, max: 12, step: 0.5, init: 1 ]]; output stream float32 out; void main() { loop { out <- hostGain; advance(); } } }");
    await writeFile(path.join(plugin, "state.ts"), state);
    await writeFile(path.join(plugin, "view/source.ts"), "export default () => document.createElement('div');");
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "state-lab"], { cwd: root, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    return importWorker(path.join(root, "build/fx/state_lab_runtime"));
}

test("a declared parameter builds into a state service that opens host state and stops cleanly", { timeout: 300000 }, async (t) => {
    const runWorker = await buildDeclaredPlugin(t, `import { definePluginState, parameter } from "../../kit/index";
export default definePluginState({ gain: parameter("hostGain") });`);
    const host = fakeHost();
    const starting = runWorker(host.connection);
    await Promise.resolve();
    assert.deepEqual(host.messages("open"), [{ kind: "open", request: 1, parameters: ["hostGain"], storedKeys: [], eventEndpoints: [] }]);
    const scope = { owner: "build-test-owner", document: 0 };
    host.deliver({ kind: "opened", request: 1, scope, native: { parameters: [
        { endpoint: "hostGain", value: 3.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
    ], values: {} } });
    const service = await starting;
    host.deliver({ kind: "attached-client", request: 99, scope, client: 7 });
    const snapshot = host.messages("snapshot")[0];
    assert.equal(snapshot.to, 7);
    assert.equal(snapshot.attachRequest, 99);
    assert.equal(snapshot.state.fields.gain.value, 3.5);
    await service.stop();
    assert.equal(host.listeners.size, 0);
    assert.deepEqual(host.messages("close"), [{ kind: "close", reason: "service-closed" }]);
});

test("a preparedState field builds and delivers its prepared payload without any worker code from the author", { timeout: 300000 }, async (t) => {
    const runWorker = await buildDeclaredPlugin(t, `import { definePluginState, parameter, preparedState, type PluginStateCodec } from "../../kit/index";
const samples: PluginStateCodec<readonly number[]> = {
    parse: (value) => Array.isArray(value) && value.every(Number.isFinite)
        ? { kind: "ok", value: Object.freeze([...value]) } : { kind: "error", message: "Expected samples." },
    encode: (value) => [...value],
    equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
};
export default definePluginState({
    gain: parameter("hostGain"),
    curve: preparedState({
        codec: samples, initial: [0, 1], dependencies: ["gain"],
        prepare: (value, context) => new Float32Array(value.map((v) => v * context.parameters.gain)),
        engine: { eventEndpoints: ["curveData"], create: () => ({
            async apply(value, context) {
                const sent = context.send({ kind: "event", endpoint: "curveData", value: { packed: value } });
                return sent.kind === "submitted" ? sent.completion : sent;
            },
            stop() {},
        }) },
    }),
});`);
    const host = fakeHost();
    const scope = { owner: "prepared-owner", document: 0 };
    const starting = runWorker(host.connection);
    await setImmediate();
    const [open] = host.messages("open");
    assert.deepEqual(open.eventEndpoints, ["curveData"]);
    host.deliver({ kind: "opened", request: open.request, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }],
        values: { curve: [0.2, 0.8] },
    } });
    const service = await starting;
    t.after(() => service.stop());
    await setImmediate();
    const [publication] = host.messages("publish");
    assert.deepEqual(publication.operations, [{ kind: "event", endpoint: "curveData", value: { packed: [0.5, 2] } }]);
    host.deliver({ kind: "published", request: publication.request, scope: publication.scope, result: { kind: "observed" } });
    await setImmediate();
    host.deliver({ kind: "attached-client", request: 12, scope, client: 8 });
    const snapshot = host.messages("snapshot").at(-1).state;
    assert.deepEqual(snapshot.fields.curve.value, [0.2, 0.8]);
    assert.deepEqual(snapshot.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    assert.equal(snapshot.history.canUndo, false);
    await service.stop();
    assert.equal(host.listeners.size, 0);
    assert.deepEqual(host.messages("close"), [{ kind: "close", reason: "service-closed" }]);
});

test("kit:new builds a stateful gain worker whose edits and Undo/Redo publish to the DSP endpoint", { timeout: 300000 }, async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-starter-state-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await cp(path.join(repoRoot, "kit"), path.join(root, "kit"), { recursive: true, verbatimSymlinks: true });
    await symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "starter-state-proof", type: "module" }));
    await writeFile(path.join(root, "product-owner.json"), JSON.stringify({
        manufacturer: "Example", manufacturerCode: "Exmp", pluginCodePrefix: "Ex", bundleIdentifierPrefix: "org.example-audio",
    }));
    const { scaffoldPlugin } = await import(pathToFileURL(path.join(root, "kit/scripts/new_plugin.mjs")));
    scaffoldPlugin("gain_probe");
    await cp(path.join(root, "kit/template/root/tsconfig.json"), path.join(root, "tsconfig.json"));
    const check = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 120000 });
    assert.equal(check.status, 0, check.stdout + check.stderr);
    const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "gain-probe"], { cwd: root, encoding: "utf8", timeout: 120000 });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const runtime = path.join(root, "build/fx/gain_probe_runtime");
    assert.ok((await readFile(path.join(runtime, "view/app.js"), "utf8")).length > 0);
    const start = await importWorker(runtime);

    const host = fakeHost();
    const starting = start(host.connection);
    await Promise.resolve();
    const [open] = host.messages("open");
    assert.deepEqual(open.parameters, ["gainDb"], "the generated definition binds the starter's automatable DSP endpoint");
    const scope = { owner: "starter-host", document: 0 };
    host.deliver({ kind: "opened", request: open.request, scope, native: {
        values: {}, parameters: [{ endpoint: "gainDb", value: 0, min: -24, max: 24, step: 0, defaultValue: 0 }],
    } });
    const service = await starting;
    t.after(() => service.stop());
    host.deliver({ kind: "attached-client", scope, client: 1, request: 1 });
    let sequence = 0;
    let previousIntent = 0;
    for (const [command, value, canUndo, canRedo] of [
        [{ kind: "edit", key: "gain", value: 6 }, 6, true, false],
        [{ kind: "undo" }, 0, false, true],
        [{ kind: "redo" }, 6, true, false],
    ]) {
        host.deliver({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
        await Promise.resolve();
        const update = host.messages("update").at(-1);
        assert.equal(update.receipt.result.kind, "accepted");
        assert.equal(update.state.fields.gain.value, value);
        assert.equal(update.state.history.canUndo, canUndo);
        assert.equal(update.state.history.canRedo, canRedo);
        const parameters = host.messages("publish").at(-1).operations.filter((operation) => operation.kind === "parameter");
        assert.equal(parameters.length, 1);
        const { intent, ...operation } = parameters[0];
        assert.deepEqual(operation, { kind: "parameter", endpoint: "gainDb", value });
        assert.ok(Number.isSafeInteger(intent) && intent > previousIntent, "successive DSP writes carry ordered owner intent");
        previousIntent = intent;
    }
});
