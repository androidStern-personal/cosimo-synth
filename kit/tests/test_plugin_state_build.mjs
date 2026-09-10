import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("the public runtime builder bundles a declared state service that opens host state and stops cleanly", { timeout: 30000 }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-state-build-"));
    try {
        // Isolate the actual customer build tree; do not add a temporary plugin
        // to the developer's shared fx registry or modify existing build outputs.
        await mkdir(path.join(root, "kit"));
        await cp(path.join(repoRoot, "kit/fx"), path.join(root, "kit/fx"), { recursive: true });
        await cp(path.join(repoRoot, "kit/ui"), path.join(root, "kit/ui"), { recursive: true });
        await cp(path.join(repoRoot, "kit/kit.json"), path.join(root, "kit/kit.json"));
        await cp(path.join(repoRoot, "kit/index.ts"), path.join(root, "kit/index.ts"));
        await cp(path.join(repoRoot, "kit/package.json"), path.join(root, "kit/package.json"));
        await symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"));
        await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "state-build-fixture", type: "module" }));
        const patch = path.join(root, "fx/state_lab");
        await mkdir(path.join(patch, "view"), { recursive: true });
        await writeFile(path.join(patch, "State.cmajorpatch"), JSON.stringify({
            CmajorVersion: 1, ID: "test.state-build", name: "State Lab", version: "1.0.0", source: "State.cmajor",
            view: { src: "view/index.js", devModule: "/fx/state_lab/view/source.ts" },
        }));
        await writeFile(path.join(patch, "State.plugin.json"), JSON.stringify({ schemaVersion: 1, stateSource: "fx/state_lab/state.ts" }));
        await writeFile(path.join(patch, "State.cmajor"), "processor State { input value float32 hostGain [[ min: -12, max: 12, step: 0.5, init: 1 ]]; output stream float32 out; void main() { loop { out <- hostGain; advance(); } } }");
        await writeFile(path.join(patch, "state.ts"), `import { definePluginState, parameter } from "../../kit/index"; export default definePluginState({gain:parameter("hostGain")});`);
        await writeFile(path.join(patch, "view/source.ts"), "export default function() { return document.createElement('div'); }");
        const build = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "state-lab"], { cwd: root, encoding: "utf8", timeout: 20000 });
        assert.equal(build.status, 0, build.stdout + build.stderr);
        const runtime = path.join(root, "build/fx/state_lab_runtime");
        const manifest = JSON.parse(await readFile(path.join(runtime, "State.cmajorpatch"), "utf8"));
        assert.equal(manifest.worker, "worker.js");
        const { default: runWorker } = await import(pathToFileURL(path.join(runtime, manifest.worker)).href);
        const sent = [];
        const listeners = new Set();
        const connection = {
            addEventListener(type, listener) { assert.equal(type, "kit_state"); listeners.add(listener); },
            removeEventListener(type, listener) { assert.equal(type, "kit_state"); listeners.delete(listener); },
            sendMessageToServer(message) { sent.push(structuredClone(message)); },
        };
        const starting = runWorker(connection);
        await Promise.resolve();
        const open = sent[0]?.message;
        assert.deepEqual(open, { kind: "open", request: 1, parameters: ["hostGain"], storedKeys: [], eventEndpoints: [] });
        const scope = { owner: "build-test-owner", document: 0 };
        const deliver = body => { for (const listener of listeners) listener(structuredClone(body)); };
        deliver({ kind: "opened", request: 1, scope, native: { parameters: [
            { endpoint: "hostGain", value: 3.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
        ], values: {} } });
        const service = await starting;
        deliver({ kind: "attached-client", request: 99, scope, client: 7 });
        const snapshot = sent.find(message => message.message.kind === "snapshot")?.message;
        assert.equal(snapshot.to, 7);
        assert.equal(snapshot.attachRequest, 99);
        assert.equal(snapshot.state.fields.gain.value, 3.5);
        await service.stop();
        assert.equal(listeners.size, 0);
        assert.deepEqual(sent.at(-1).message, { kind: "close", reason: "service-closed" });
    } finally { await rm(root, { recursive: true, force: true }); }
});
