import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";
import { createSynthParameterFixture, synthParameterEndpoints } from "./helpers/synth_parameter_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { createMockPluginStateHost } = await loadUIModule(root, "ui/shared/mock-plugin-state-host.ts");
const { createCmajorPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const { synthPluginState } = await loadUIModule(root, "ui/shared/synth-plugin-state.ts");
const { createDefaultModulationState, MODULATION_STATE_KEY } = await loadUIModule(root, "ui/shared/modulation.ts");
const runtime = process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE
    ? path.join(process.env.COSIMO_PLUGIN_STATE_CMAJOR_SOURCE, "javascript/cmaj_api")
    : stageCmajorWebRuntime(root, { buildDirectory: path.join(root, "build/cmajor_web_runtime-mock-state-tests"), instanceId: String(process.pid) });
const loadChannel = () => import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href);
async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "mock state host did not converge");
        await new Promise(resolve => setImmediate(resolve));
    }
}

test("the dev host uses the production service for queued startup, detach, shared Undo and host observation", async () => {
    const { values, readParameter } = createSynthParameterFixture({ playMode: 1, glideTime: 0.15, globalTune: -7.5 });
    const writes = [], gestures = [], defects = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const host = createMockPluginStateHost({
        loadChannel: async () => { await gate; return loadChannel(); },
        readParameter,
        writeParameter(endpoint, value) { writes.push([endpoint, value]); values.set(endpoint, value); },
        beginGesture(endpoint) { gestures.push(["start", endpoint]); },
        endGesture(endpoint) { gestures.push(["end", endpoint]); },
        onDefect: error => defects.push(String(error)),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(String(error)) });
    let reopened;
    try {
        assert.notEqual(client.getSnapshot().kind, "ready");
        assert.deepEqual(writes, []);
        release();
        await host.ready;
        await until(() => client.getSnapshot().kind === "ready");
        assert.equal(client.getSnapshot().state.fields.globalTune.value, -7.5);
        assert.equal(client.getSnapshot().state.fields.globalTune.metadata.defaultValue, 0);
        assert.equal((await client.dispatch({ kind: "begin", key: "globalTune", gesture: 1 })).kind, "accepted");
        assert.equal((await client.dispatch({ kind: "edit", key: "globalTune", value: 5, gesture: 1 })).kind, "accepted");
        await until(() => values.get("globalTune") === 5);
        client.stop();
        await until(() => gestures.length === 2);
        assert.deepEqual(gestures, [["start", "globalTune"], ["end", "globalTune"]], "stop itself seals the group before another attach can help");
        reopened = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(String(error)) });
        await until(() => reopened.getSnapshot().kind === "ready" && gestures.length === 2);
        assert.deepEqual(gestures, [["start", "globalTune"], ["end", "globalTune"]], "these are service publication requests, not actual DAW callbacks");
        assert.equal(reopened.getSnapshot().state.fields.globalTune.value, 5);
        assert.equal((await reopened.dispatch({ kind: "undo" })).kind, "accepted");
        await until(() => values.get("globalTune") === -7.5);
        assert.deepEqual(writes, [["globalTune", 5], ["globalTune", -7.5]]);
        values.set("globalTune", 3);
        host.observeParameter("globalTune");
        await until(() => reopened.getSnapshot().state.fields.globalTune.value === 3);
        assert.equal(reopened.getSnapshot().state.history.canUndo, false);
        assert.equal(writes.length, 2, "host observation never echoes a native write");
    } finally { client.stop(); reopened?.stop(); await host.stop(); await host.stop(); }
    assert.deepEqual(defects, []);
});

test("stopping before the channel loads settles readiness and closes the queued client without starting an owner", async () => {
    const channelModule = await loadChannel();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let reads = 0;
    const defects = [];
    const host = createMockPluginStateHost({
        loadChannel: async () => { await gate; return channelModule; },
        readParameter: async () => { reads++; throw new Error("Stopped owner must not read"); },
        writeParameter() { assert.fail("Stopped owner must not write"); },
        beginGesture() { assert.fail("Stopped owner must not gesture"); },
        endGesture() { assert.fail("Stopped owner has no gesture"); },
        onDefect: error => defects.push(String(error)),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(String(error)) });
    let settled = false;
    void host.ready.then(() => { settled = true; }, () => { settled = true; });
    try {
        await host.stop();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(settled, true, "readiness must settle without waiting for an abandoned dynamic import");
        assert.equal(client.getSnapshot().kind, "closed");
        release();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(reads, 0);
        assert.deepEqual(defects, []);
    } finally { release(); client.stop(); await host.stop(); }
});

test("stop aborts an outstanding external host read and releases its subscription", async () => {
    const subscriptions = new Set();
    const defects = [];
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter: (_endpoint, signal) => new Promise((resolve, reject) => {
            const subscription = _endpoint;
            assert.equal(subscriptions.has(subscription), false, "one read per declared parameter");
            subscriptions.add(subscription);
            signal?.addEventListener("abort", () => { subscriptions.delete(subscription); reject(new Error("Host read stopped")); }, { once: true });
        }),
        writeParameter() { assert.fail("Pending host read must not write"); },
        beginGesture() { assert.fail("Pending host read must not gesture"); },
        endGesture() { assert.fail("No active gesture"); },
        onDefect: error => defects.push(String(error)),
    });
    await until(() => subscriptions.size === synthParameterEndpoints.length);
    assert.deepEqual([...subscriptions].sort(), [...synthParameterEndpoints].sort());
    await host.stop();
    assert.equal(subscriptions.size, 0);
    await host.ready;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(defects, []);
});

test("a failed channel import closes startup and rejects future envelopes instead of queueing them forever", async () => {
    const problem = new Error("Missing staged channel");
    const defects = [];
    const host = createMockPluginStateHost({
        loadChannel: async () => { throw problem; },
        readParameter: async () => { assert.fail("Failed loader must not read"); },
        writeParameter() { assert.fail("Failed loader must not write"); },
        beginGesture() { assert.fail("Failed loader must not gesture"); },
        endGesture() { assert.fail("Failed loader has no gesture"); },
        onDefect: error => defects.push(error),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(error) });
    try {
        await assert.rejects(host.ready, error => error === problem);
        assert.equal(client.getSnapshot().kind, "closed");
        assert.throws(() => host.sendMessageToServer({ type: "kit_state", message: { kind: "attach", request: 99 } }), /stopped/);
        assert.deepEqual(defects, [problem]);
    } finally { client.stop(); await host.stop(); }
});

test("dev host shares native modulation storage with the real owner and fences raw restores without erasing unrelated history", async () => {
    const initial = createDefaultModulationState();
    initial.msegSlots[0].shapeB.points[0].y = 0.34;
    const stored = new Map([[MODULATION_STATE_KEY, JSON.stringify(initial)], ["unowned", "retained"]]);
    const { values: parameters, readParameter } = createSynthParameterFixture({ playMode: 1, glideTime: 0.15, globalTune: -7.5 });
    const writes = [], defects = [];
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter,
        writeParameter(endpoint, value) { parameters.set(endpoint, value); },
        storedValues: {
            read: key => stored.get(key),
            write(key, value) { writes.push([key, value]); stored.set(key, value); },
        },
        beginGesture() {}, endGesture() {}, onDefect: error => defects.push(error),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(error) });
    try {
        await host.ready;
        await until(() => client.getSnapshot().kind === "ready");
        assert.deepEqual(client.getSnapshot().state.fields[MODULATION_STATE_KEY].value, initial);
        const scope = client.getSnapshot().state.scope;
        const edited = structuredClone(initial);
        edited.msegSlots[0].shapeB.points[0].y = 0.76;
        assert.equal((await client.dispatch({ kind: "edit", key: MODULATION_STATE_KEY, value: edited })).kind, "accepted");
        await until(() => stored.get(MODULATION_STATE_KEY) === JSON.stringify(edited));
        assert.deepEqual(writes, [[MODULATION_STATE_KEY, JSON.stringify(edited)]], "owner publication goes straight to the same native storage, without recursively restoring");
        assert.deepEqual(client.getSnapshot().state.scope, scope);
        assert.equal(client.getSnapshot().state.history.canUndo, true);
        let unrelatedWrite = false;
        assert.equal(host.replaceStoredValue("unowned", () => { unrelatedWrite = true; }), false);
        assert.equal(unrelatedWrite, false, "caller owns writing keys not declared by the state owner");
        assert.deepEqual(client.getSnapshot().state.scope, scope);
        assert.equal(client.getSnapshot().state.history.canUndo, true);
        const restored = structuredClone(initial);
        restored.msegSlots[1].shapeA.points[0].y = 0.58;
        assert.equal(host.replaceStoredValue(MODULATION_STATE_KEY, () => stored.set(MODULATION_STATE_KEY, JSON.stringify(restored))), true);
        assert.equal(stored.get(MODULATION_STATE_KEY), JSON.stringify(restored), "native raw setters remain synchronous");
        await until(() => client.getSnapshot().kind === "ready" && client.getSnapshot().state.scope.document > scope.document);
        assert.equal(client.getSnapshot().state.scope.owner, scope.owner);
        assert.deepEqual(client.getSnapshot().state.fields[MODULATION_STATE_KEY].value, restored);
        assert.equal(client.getSnapshot().state.history.canUndo, false, "old edits cannot restore across a raw document replacement");
        assert.equal(client.getSnapshot().state.fields.globalTune.value, -7.5);
        assert.equal(stored.get("unowned"), "retained");
        assert.equal(writes.length, 1, "raw restore must not echo back a second write");
        assert.equal((await client.dispatch({ kind: "edit", key: "globalTune", value: 2 })).kind, "accepted");
        await until(() => parameters.get("globalTune") === 2);
        parameters.set("globalTune", 3);
        host.observeParameter("globalTune");
        await until(() => client.getSnapshot().state.fields.globalTune.value === 3);
        assert.deepEqual(defects, []);
    } finally { client.stop(); await host.stop(); }
});
