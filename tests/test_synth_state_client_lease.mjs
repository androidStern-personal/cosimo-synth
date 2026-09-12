import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";
import { createSynthParameterFixture } from "./helpers/synth_parameter_fixture.mjs";

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
    const { values, readParameter } = createSynthParameterFixture({ playMode: 1, glideTime: 0.15, globalTune: -7.5 });
    const gestures = [], writes = [], defects = [];
    // This existing host substitutes native parameter storage only. Its actual
    // Cmajor channel and state service accept edits and own the history ledger.
    const connection = createMockPluginStateHost({
        loadChannel: () => import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href),
        readParameter,
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

test("last lease release detaches and seals accepted modulation when its final end request is lost", async () => {
    const [{ PluginStateChannel }, { createCmajorPluginStateService }, { synthPluginState }] = await Promise.all([
        import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href),
        loadUIModule(root, "kit/ui/plugin-state-cmajor.ts"),
        loadUIModule(root, "ui/shared/synth-plugin-state.ts"),
    ]);
    const key = "modulation.v6";
    const views = new Set(), stored = new Map(), writes = [], defects = [], workerMessages = [], refusedEnvelopes = [];
    let channel;
    // These ports only forward the actual browser channel's envelopes. The
    // production owner creates all receipts, groups and Undo transitions.
    const port = (worker = false) => {
        const listeners = new Set(), sent = [];
        const result = {
            listeners, sent, dropEnd: false,
            addEventListener(_type, listener) { listeners.add(listener); },
            removeEventListener(_type, listener) { listeners.delete(listener); },
            deliverMessageFromServer(envelope) {
                if (worker) workerMessages.push(structuredClone(envelope.message));
                for (const listener of [...listeners]) listener(envelope.message);
            },
            sendMessageToServer(envelope) {
                sent.push(structuredClone(envelope.message));
                if (result.dropEnd && envelope.message.kind === "command" && envelope.message.command.kind === "end") return;
                if (!channel.receive(result, envelope.message)) refusedEnvelopes.push(structuredClone(envelope.message));
            },
        };
        if (!worker) views.add(result);
        return result;
    };
    const worker = port(true), first = port(), second = port();
    const outputs = new Map(), storedListeners = new Set();
    worker.addEndpointListener = (endpoint, listener) => outputs.set(listener, endpoint);
    worker.removeEndpointListener = (_endpoint, listener) => outputs.delete(listener);
    worker.addStoredStateValueListener = listener => storedListeners.add(listener);
    worker.removeStoredStateValueListener = listener => storedListeners.delete(listener);
    worker.requestFullStoredState = callback => queueMicrotask(() => callback({ values: Object.fromEntries(stored) }));
    const { readParameter } = createSynthParameterFixture();
    channel = new PluginStateChannel(worker, async request => {
        if (request.kind === "open") return { parameters: request.parameters.map(readParameter) };
        if (request.kind === "close") return {};
        if (request.kind === "effect") return { error: "This storage/lease fixture has no audio engine." };
        throw new Error(`Unexpected native request ${request.kind}`);
    }, keys => Object.fromEntries(keys.filter(key => stored.has(key)).map(key => [key, stored.get(key)])),
    (key, value) => { stored.set(key, value); writes.push({ key, value }); }, () => views);
    const service = createCmajorPluginStateService(synthPluginState, worker, { onDefect: error => defects.push(error) });
    let a, b;
    try {
        await service.start();
        a = acquireSynthViewState(first);
        b = acquireSynthViewState(second);
        await until(() => a.client.getSnapshot().kind === "ready" && b.client.getSnapshot().kind === "ready");
        const baseline = structuredClone(a.modulation.getState());
        const scope = a.client.getSnapshot().state.scope;
        const client = a.client.getSnapshot().client;
        assert.equal((await a.modulation.beginGesture()).kind, "accepted");
        const shape = { ...baseline.msegSlots[0].shapeA,
            points: baseline.msegSlots[0].shapeA.points.map(point => ({ ...point, y: 0.37 })) };
        assert.equal((await a.modulation.setMsegSlotShape(0, 0, shape)).changed, true);
        await until(() => writes.length === 1);
        assert.deepEqual(b.modulation.getState().msegSlots[0].shapeA, shape);
        assert.ok(b.client.getSnapshot().state.fields[key].gesture, "the real owner still has the accepted group open");
        assert.equal(b.client.getSnapshot().state.history.canUndo, false);
        const acceptedPrefix = first.sent.at(-1).sequence;
        const beforeRelease = first.sent.length;
        first.dropEnd = true;
        a.release();
        assert.equal(a.client.getSnapshot().kind, "closed", "release cannot wait for the dropped end response");
        assert.equal(first.listeners.size, 0);
        assert.deepEqual(await a.modulation.stop(), { kind: "interrupted", reason: "closed", acceptance: "unknown" });
        assert.deepEqual(first.sent.slice(beforeRelease).map(message => message.kind === "command" ? message.command.kind : message.kind), ["end", "detach"]);
        assert.deepEqual(workerMessages.filter(message => message.kind === "detach"), [
            { kind: "detach", scope, client, routedThrough: acceptedPrefix },
        ], "native detach reports only the accepted prefix; the end never reached it");
        await until(() => b.client.getSnapshot().state.history.canUndo);
        assert.equal(b.client.getSnapshot().state.fields[key].gesture, undefined);
        assert.deepEqual(b.client.getSnapshot().state.scope, scope);
        assert.equal(second.sent.filter(message => message.kind === "attach").length, 1, "no reattachment can mask missing final detach");
        assert.equal((await b.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.deepEqual(b.modulation.getState(), baseline);
        await until(() => writes.length === 2);
        assert.equal(writes[1].value, JSON.stringify(baseline));
        a.release();
        assert.equal(first.sent.filter(message => message.kind === "detach").length, 1);
        assert.deepEqual(refusedEnvelopes, [], "the real channel handled every forwarded envelope");
        assert.deepEqual(defects, []);
    } finally { a?.release(); b?.release(); await service.stop(); channel.close(); }
});
