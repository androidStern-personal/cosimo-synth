import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { acquireSynthViewState } = await loadUIModule(root, "ui/shared/synth-state-client.ts");
const { createMockPluginStateHost } = await loadUIModule(root, "ui/shared/mock-plugin-state-host.ts");
const runtime = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE
    ? path.join(process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE, "javascript/cmaj_api")
    : stageCmajorWebRuntime(root, { buildDirectory: path.join(root, "build/cmajor_web_runtime-state-lease-tests"), instanceId: String(process.pid) });

async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "real client/service lease did not settle");
        await new Promise(resolve => setImmediate(resolve));
    }
}

function fixture() {
    const values = new Map([["playMode", 1], ["glideTime", 0.15], ["globalTune", -7.5]]);
    const gestures = [], writes = [], defects = [];
    // This existing host substitutes native parameter storage only. Its actual
    // Cmajor channel and state service accept edits and own the history ledger.
    const connection = createMockPluginStateHost({
        loadChannel: () => import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href),
        readParameter: async endpoint => ({ endpoint, value: values.get(endpoint), min: endpoint === "globalTune" ? -24 : 0,
            max: endpoint === "globalTune" ? 24 : 2, step: endpoint === "playMode" ? 1 : 0, defaultValue: 0 }),
        writeParameter(endpoint, value) { writes.push([endpoint, value]); values.set(endpoint, value); },
        beginGesture(endpoint) { gestures.push(["start", endpoint]); },
        endGesture(endpoint) { gestures.push(["end", endpoint]); },
        onDefect: error => defects.push(error),
    });
    return { connection, values, gestures, writes, defects };
}

test("independent synth view leases share one live client; only the last release closes its gesture and a new view retains Undo", async () => {
    const f = fixture();
    const a = acquireSynthViewState(f.connection);
    const b = acquireSynthViewState(f.connection);
    let reopened;
    try {
        assert.strictEqual(a.client, b.client, "the view/provider/bridge must use one actual GUI client");
        await f.connection.ready;
        await until(() => a.client.getSnapshot().kind === "ready");
        const scope = a.client.getSnapshot().state.scope;
        assert.equal((await a.client.dispatch({ kind: "begin", key: "globalTune", gesture: 1 })).kind, "accepted");
        assert.equal((await a.client.dispatch({ kind: "edit", key: "globalTune", value: 5, gesture: 1 })).kind, "accepted");
        await until(() => f.values.get("globalTune") === 5);
        a.release(); a.release();
        assert.equal(b.client.getSnapshot().kind, "ready", "duplicate cleanup cannot release another consumer's lease");
        assert.deepEqual(f.gestures, [["start", "globalTune"]]);
        b.release();
        await until(() => f.gestures.length === 2);
        assert.deepEqual(f.gestures, [["start", "globalTune"], ["end", "globalTune"]]);
        assert.equal(b.client.getSnapshot().kind, "closed");

        reopened = acquireSynthViewState(f.connection);
        assert.notStrictEqual(reopened.client, b.client);
        await until(() => reopened.client.getSnapshot().kind === "ready");
        assert.deepEqual(reopened.client.getSnapshot().state.scope, scope, "closing GUI leases does not recreate the plugin owner");
        assert.equal((await reopened.client.dispatch({ kind: "undo" })).kind, "accepted");
        await until(() => f.values.get("globalTune") === -7.5);
        assert.deepEqual(f.writes, [["globalTune", 5], ["globalTune", -7.5]]);
        assert.deepEqual(f.defects, []);
    } finally { a.release(); b.release(); reopened?.release(); await f.connection.stop(); }
});

test("late releases from a closed client cannot delete or stop the replacement client's leases", async () => {
    const f = fixture();
    const a = acquireSynthViewState(f.connection);
    const b = acquireSynthViewState(f.connection);
    let replacement, other;
    try {
        await f.connection.ready;
        await until(() => a.client.getSnapshot().kind === "ready");
        // A terminal client can be discovered before every old React cleanup
        // has run. Close the real client; keep its two old lease objects.
        a.client.stop();
        replacement = acquireSynthViewState(f.connection);
        await until(() => replacement.client.getSnapshot().kind === "ready");
        a.release(); b.release();
        other = acquireSynthViewState(f.connection);
        assert.strictEqual(other.client, replacement.client, "old final cleanup must not erase the newer registry entry");
        replacement.release();
        assert.equal(other.client.getSnapshot().kind, "ready");
        assert.equal((await other.client.dispatch({ kind: "edit", key: "globalTune", value: 3 })).kind, "accepted");
        await until(() => f.values.get("globalTune") === 3);
        assert.deepEqual(f.writes, [["globalTune", 3]]);
        assert.deepEqual(f.defects, []);
    } finally { a.release(); b.release(); replacement?.release(); other?.release(); await f.connection.stop(); }
});
