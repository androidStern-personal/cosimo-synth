import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule, bundleBrowserModuleSource } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { definePluginState, parameter, storedValue, eventValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService, createCmajorPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const curveCodec = {
    parse(input) {
        if (!Array.isArray(input) || input.length < 2 || !input.every(value => typeof value === "number" && Number.isFinite(value)))
            return { kind: "error", message: "Expected finite curve samples." };
        return { kind: "ok", value: Object.freeze([...input]) };
    },
    encode(value) { return [...value]; },
    equals(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); },
};
const definition = definePluginState({ gain: parameter("hostGain"), curve: storedValue({ initial: [0, 1], codec: curveCodec }) });

// The raw PatchConnection seam carries JSON bodies only. It records outgoing
// messages and delivers supplied native replies; all edit/history work is real.
class RecordingPatchConnection {
    sent = [];
    listeners = new Map();
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    sendMessageToServer(message) {
        assert.ok(this.listeners.get("kit_state")?.size, "listen before sending open");
        this.sent.push(JSON.parse(JSON.stringify(message)));
    }
    deliver(body) { for (const listener of this.listeners.get("kit_state") ?? []) listener(JSON.parse(JSON.stringify(body))); }
    bodies(kind) { return this.sent.filter(message => message.type === "kit_state" && message.message.kind === kind).map(message => message.message); }
}

test("Cmajor service opens real declarations, parses native state, and routes an accepted stored edit through raw publications and receipts", async () => {
    const connection = new RecordingPatchConnection();
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => assert.fail(String(error)) });
    const starting = service.start();
    assert.deepEqual(connection.sent, [{ type: "kit_state", message: {
        kind: "open", request: 1, parameters: ["hostGain"], storedKeys: ["curve"], eventEndpoints: [],
    } }]);
    const scope = { owner: "native-owner", document: 0 };
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }],
        values: { curve: [0, 0.25, 1] },
    } });
    await starting;
    connection.deliver({ kind: "attached-client", request: 11, scope, client: 7 });
    const attached = connection.bodies("snapshot").at(-1);
    assert.equal(attached.to, 7);
    assert.equal(attached.attachRequest, 11);
    assert.deepEqual(attached.scope, scope);
    assert.equal(attached.state.fields.gain.value, 2.5);
    assert.equal(attached.state.fields.gain.metadata.defaultValue, 1);
    assert.deepEqual(attached.state.fields.curve.value, [0, 0.25, 1]);
    assert.deepEqual(attached.state.history, { canUndo: false, canRedo: false });
    assert.deepEqual(connection.bodies("publish"), []);
    const address = { ...scope, client: 7, sequence: 1 };
    connection.deliver({ kind: "command", address, command: { kind: "edit", key: "curve", value: [0, 0.75, 1], expectedVersion: 0 } });
    await Promise.resolve();
    const publication = connection.bodies("publish").at(-1);
    assert.deepEqual(publication, { kind: "publish", scope, request: 2,
        operations: [{ kind: "stored", key: "curve", value: [0, 0.75, 1] }],
    });
    const updated = connection.bodies("update").at(-1);
    assert.deepEqual(updated.receipt, { address, result: { kind: "accepted", revision: attached.revision + 1, version: 1 } });
    assert.deepEqual(updated.state.fields.curve.value, [0, 0.75, 1]);
    assert.deepEqual(updated.state.history, { canUndo: true, canRedo: false });
    connection.deliver({ kind: "published", request: publication.request, scope, result: { kind: "observed" } });
    await Promise.resolve();
    assert.deepEqual(connection.bodies("update").at(-1).state.fields.curve.persistence, { kind: "observed-in-native-state" });
    assert.equal(connection.bodies("publish").length, 1);
    await service.stop();
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.deepEqual(connection.bodies("close"), [{ kind: "close", reason: "service-closed" }]);
});

test("stopping during native open settles startup, removes listeners, and ignores a previously queued open reply", async () => {
    const connection = new RecordingPatchConnection();
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => assert.fail(String(error)) });
    let outcome;
    const starting = service.start().then(() => { outcome = "ready"; }, error => { outcome = error; });
    const late = [...connection.listeners.get("kit_state")][0];
    await service.stop();
    await Promise.resolve();
    assert.ok(outcome instanceof Error, "startup must settle when its owner closes before native open completes");
    assert.match(outcome.message, /stopped|closed/i);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    const count = connection.sent.length;
    late({ kind: "opened", request: 1, scope: { owner: "late", document: 0 }, native: { parameters: [], values: {} } });
    await Promise.resolve();
    assert.equal(connection.sent.length, count);
    await assert.rejects(service.start(), /stopped|closed/i);
    await starting;
    await service.stop();
});

test("native open failure rejects worker startup with its reason and releases the channel without installing defaults", async () => {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const starting = service.start();
    connection.deliver({ kind: "open-failed", request: 1, reason: "missing-endpoint" });
    await assert.rejects(starting, /missing-endpoint/);
    assert.deepEqual(defects, [], "an expected native refusal is not an unexpected implementation defect");
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.deepEqual(connection.bodies("update"), []);
    assert.deepEqual(connection.bodies("publish"), []);
    await service.stop();
});

test("missing Cmajor channel capabilities reject startup as a promise without leaking a listener", async () => {
    for (const missing of ["addEventListener", "removeEventListener", "sendMessageToServer"]) {
        const actual = new RecordingPatchConnection();
        const connection = Object.fromEntries(["addEventListener", "removeEventListener", "sendMessageToServer"]
            .filter(key => key !== missing).map(key => [key, actual[key].bind(actual)]));
        const service = createCmajorPluginStateService(definition, connection, { onDefect: error => assert.fail(String(error)) });
        let starting;
        assert.doesNotThrow(() => { starting = service.start(); });
        await assert.rejects(starting, /capabilit|state.channel/i);
        assert.equal(actual.listeners.get("kit_state")?.size ?? 0, 0);
        assert.deepEqual(actual.sent, []);
        await service.stop();
    }
});

test("a native open send defect retains its cause, rejects startup, and releases a partially opened connection", async () => {
    const problem = new Error("native connection failed after open handoff");
    const defects = [];
    class FailingConnection extends RecordingPatchConnection {
        sendMessageToServer(message) { super.sendMessageToServer(message); throw problem; }
    }
    const connection = new FailingConnection();
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    let starting;
    assert.doesNotThrow(() => { starting = service.start(); });
    await assert.rejects(starting, error => error === problem);
    assert.deepEqual(defects, [problem]);
    assert.equal(connection.sent.length, 1);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    await service.stop();
});

async function openService() {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const scope = { owner: "native-owner", document: 0 };
    const starting = service.start();
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: {},
    } });
    await starting;
    return { connection, service, scope, defects };
}

test("malformed addressed commands get exact rejections without closing the owner or consuming service history", async () => {
    const { connection, service, scope, defects } = await openService();
    const before = connection.bodies("update").at(-1);
    const invalid = [
        { kind: "invented", key: "curve" },
        { kind: "edit", key: "curve" },
        { kind: "edit", key: "curve", value: [0, 1], expectedVersion: -1 },
        { kind: "edit", key: "curve", value: [0, 1], gesture: 0 },
    ];
    for (const [index, command] of invalid.entries()) {
        const address = { ...scope, client: 7, sequence: index + 1 };
        connection.deliver({ kind: "command", address, command });
        assert.deepEqual(connection.bodies("receipt").at(-1), { kind: "receipt", address,
            result: { kind: "rejected", reason: "invalid-command" },
        });
    }
    assert.deepEqual(connection.bodies("publish"), []);
    assert.strictEqual(connection.bodies("update").at(-1), before);
    const address = { ...scope, client: 7, sequence: 5 };
    connection.deliver({ kind: "command", address, command: { kind: "edit", key: "curve", value: [1, 0] } });
    await Promise.resolve();
    assert.equal(connection.bodies("update").at(-1).receipt?.result.kind, "accepted");
    assert.equal(connection.bodies("update").at(-1).receipt.result.version, 1);
    assert.deepEqual(defects, []);
    await service.stop();
});

test("raw gesture boundaries, detach, Undo and Redo use the same service history across clients", async () => {
    const { connection, service, scope, defects } = await openService();
    const send = (client, sequence, command) => connection.deliver({ kind: "command", address: { ...scope, client, sequence }, command });
    send(7, 1, { kind: "begin", key: "curve", gesture: 4, label: "Shape" });
    assert.equal(connection.bodies("update").at(-1).receipt?.result.kind, "accepted");
    send(7, 2, { kind: "edit", key: "curve", gesture: 4, value: [0, 0.4, 1] });
    connection.deliver({ kind: "detach", scope, client: 7, routedThrough: 2 });
    assert.equal(connection.bodies("update").at(-1).state.fields.curve.gesture, undefined);
    assert.equal(connection.bodies("update").at(-1).state.history.canUndo, true);
    send(8, 1, { kind: "undo" });
    assert.deepEqual(connection.bodies("update").at(-1).state.fields.curve.value, [0, 1]);
    send(8, 2, { kind: "redo" });
    assert.deepEqual(connection.bodies("update").at(-1).state.fields.curve.value, [0, 0.4, 1]);
    send(8, 3, { kind: "begin", key: "gain", gesture: 5 });
    send(8, 4, { kind: "edit", key: "gain", gesture: 5, value: 3 });
    send(8, 5, { kind: "end", key: "gain", gesture: 5 });
    assert.deepEqual(connection.bodies("publish").flatMap(item => item.operations).filter(operation => operation.endpoint === "hostGain"), [
        { kind: "gesture-start", endpoint: "hostGain" }, { kind: "parameter", endpoint: "hostGain", value: 3 },
        { kind: "gesture-end", endpoint: "hostGain" },
    ]);
    assert.deepEqual(defects, []);
    await service.stop();
});

test("raw GUI remount ignores a held earlier attachment on the same connection and sends the new assigned client", async () => {
    const owner = await openService();
    const state = owner.connection.bodies("update").at(-1).state;
    const connection = new RecordingPatchConnection();
    const options = { onDefect: error => assert.fail(String(error)) };
    const old = createCmajorPluginStateClient(definition, connection, options);
    assert.deepEqual(connection.bodies("attach"), [{ kind: "attach", request: 1 }]);
    old.stop();
    const current = createCmajorPluginStateClient(definition, connection, options);
    assert.deepEqual(connection.bodies("attach"), [{ kind: "attach", request: 1 }, { kind: "attach", request: 2 }]);
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    assert.equal(current.getSnapshot().kind, "connecting", "an old response cannot bind the new GUI incarnation");
    connection.deliver({ kind: "attached", request: 2, scope: owner.scope, client: 8, revision: state.revision, state });
    assert.equal(current.getSnapshot().kind, "ready");
    assert.equal(current.getSnapshot().client, 8);
    assert.equal(current.getSnapshot().state.fields.gain.value, 2.5);
    assert.deepEqual(current.getSnapshot().state.fields.curve.value, [0, 1]);
    assert.ok(Object.isFrozen(current.getSnapshot().state.fields.curve.value), "the actual field codec owns hydrated values");
    const editing = current.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.deepEqual(connection.bodies("command"), [{ kind: "command", scope: owner.scope, client: 8, sequence: 1,
        command: { kind: "edit", key: "curve", value: [1, 0] } }]);
    let settled = false;
    void editing.then(() => { settled = true; });
    connection.deliver({ kind: "receipt", address: { ...owner.scope, client: 7, sequence: 1 }, result: { kind: "rejected", reason: "closed-client" } });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(current.getSnapshot().kind, "ready");
    assert.deepEqual(current.getSnapshot().pendingFields, ["curve"]);
    current.stop();
    assert.deepEqual(await editing, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    assert.equal(connection.listeners.get("kit_state").size, 0);
    await owner.service.stop();
});

test("raw owner updates settle GUI edits with parsed canonical values and addressed native rejections", async () => {
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => assert.fail(String(error)) });
    const state = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    const editing = client.dispatch({ kind: "edit", key: "curve", value: [0, 0.6, 1], expectedVersion: 0 });
    const command = connection.bodies("command").at(-1);
    owner.connection.deliver({ kind: "command", address: { ...command.scope, client: command.client, sequence: command.sequence }, command: command.command });
    connection.deliver(owner.connection.bodies("update").at(-1));
    assert.deepEqual(await editing, { kind: "accepted", revision: 2, version: 1 });
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.6, 1]);
    assert.equal(client.getSnapshot().state.history.canUndo, true);
    const invalidOrder = client.dispatch({ kind: "undo" });
    connection.deliver({ kind: "receipt", address: { ...owner.scope, client: 7, sequence: 2 }, result: { kind: "rejected", reason: "sequence" } });
    assert.deepEqual(await invalidOrder, { kind: "rejected", reason: "sequence" });
    const closed = client.dispatch({ kind: "redo" });
    connection.deliver({ kind: "receipt", address: { ...owner.scope, client: 7, sequence: 3 }, result: { kind: "rejected", reason: "closed" } });
    assert.deepEqual(await closed, { kind: "rejected", reason: "service-closed" });
    client.stop();
    await owner.service.stop();
});

test("raw replacement resets GUI tickets, hydrates the new document and fences old publications and parameter observations", async () => {
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => assert.fail(String(error)) });
    const initial = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: initial.revision, state: initial });
    const editing = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    owner.connection.deliver({ kind: "command", address: { ...owner.scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [1, 0] } });
    const oldPublication = owner.connection.bodies("publish").at(-1);
    const scope = { ...owner.scope, document: 1 };
    connection.deliver({ kind: "reset", scope });
    assert.deepEqual(await editing, { kind: "interrupted", reason: "reset", acceptance: "unknown" });
    assert.equal(client.getSnapshot().kind, "connecting");
    owner.connection.deliver({ kind: "replaced", scope, native: {
        parameters: [{ endpoint: "hostGain", value: -2, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: { curve: [0, 0.25, 1] },
    } });
    const restored = owner.connection.bodies("update").at(-1);
    assert.deepEqual(restored.scope, scope);
    assert.deepEqual(restored.state.history, { canUndo: false, canRedo: false });
    owner.connection.deliver({ kind: "published", scope: owner.scope, request: oldPublication.request, result: { kind: "observed" } });
    owner.connection.deliver({ kind: "parameter", scope: owner.scope, endpoint: "hostGain", value: 10 });
    assert.strictEqual(owner.connection.bodies("update").at(-1), restored);
    connection.deliver({ kind: "attached", request: 2, scope, client: 8, revision: restored.revision, state: restored.state });
    assert.equal(client.getSnapshot().state.fields.gain.value, -2);
    owner.connection.deliver({ kind: "parameter", scope, endpoint: "hostGain", value: -1.5 });
    connection.deliver(owner.connection.bodies("update").at(-1));
    assert.equal(client.getSnapshot().state.fields.gain.value, -1.5);
    assert.equal(client.getSnapshot().state.fields.gain.version, 1);
    assert.equal(owner.connection.bodies("publish").length, 1, "host observation never echoes an owned scalar write");
    client.stop();
    await owner.service.stop();
});

test("malformed persisted data fails its field without a GUI fallback, and malformed wire metadata closes the raw client", async () => {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const starting = service.start();
    const scope = { owner: "owner", document: 0 };
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: { curve: "broken" },
    } });
    await starting;
    const raw = connection.bodies("update").at(-1);
    const viewConnection = new RecordingPatchConnection();
    const client = createCmajorPluginStateClient(definition, viewConnection, { onDefect: error => defects.push(error) });
    viewConnection.deliver({ kind: "attached", request: 1, scope, client: 7, revision: raw.revision, state: raw.state });
    assert.equal(client.getSnapshot().kind, "ready");
    assert.deepEqual(client.getSnapshot().state.fields.curve.readiness, { kind: "failed", reason: "invalid-state" });
    assert.equal("value" in client.getSnapshot().state.fields.curve, false);
    assert.equal(client.getSnapshot().state.fields.gain.value, 2.5);
    const malformed = JSON.parse(JSON.stringify(raw));
    malformed.revision++;
    malformed.state.revision++;
    malformed.state.fields.gain.metadata.step = "wrong";
    viewConnection.deliver(malformed);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(viewConnection.listeners.get("kit_state").size, 0);
    assert.equal(defects.length, 1);
    assert.match(defects[0].message, /malformed/i);
    await service.stop();
});

test("an unexpected GUI hydration codec defect keeps its diagnostic cause and releases the client channel", async () => {
    const owner = await openService();
    const problem = new Error("codec defect");
    const throwing = definePluginState({ gain: parameter("hostGain"), curve: storedValue({ initial: [0, 1], codec: {
        ...curveCodec, parse(input) { if (input?.[0] === 9) throw problem; return curveCodec.parse(input); },
    } }) });
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(throwing, connection, { onDefect: error => defects.push(error) });
    const state = JSON.parse(JSON.stringify(owner.connection.bodies("update").at(-1).state));
    state.fields.curve.value = [9, 1];
    assert.doesNotThrow(() => connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state }));
    assert.deepEqual(defects, [problem]);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(connection.listeners.get("kit_state").size, 0);
    await owner.service.stop();
});

test("raw unavailable, owner-ready and terminal notifications preserve readiness and settle owner startup and GUI tickets", async () => {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    connection.deliver({ kind: "attach-failed", request: 1, reason: "not-ready" });
    assert.deepEqual(client.getSnapshot(), { kind: "failed", reason: "not-ready" });
    const owner = await openService();
    connection.deliver({ kind: "owner-changed", scope: owner.scope });
    assert.deepEqual(connection.bodies("attach").at(-1), { kind: "attach", request: 2 });
    const state = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 2, scope: owner.scope, client: 7, revision: state.revision, state });
    const ticket = client.dispatch({ kind: "undo" });
    connection.deliver({ kind: "closed", reason: "owner-removed" });
    assert.deepEqual(await ticket, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.deepEqual(defects, []);
    const unopened = new RecordingPatchConnection();
    const service = createCmajorPluginStateService(definition, unopened, { onDefect: error => defects.push(error) });
    const starting = service.start();
    unopened.deliver({ kind: "closed", reason: "owner-removed" });
    await assert.rejects(starting, /owner-removed/);
    assert.equal(unopened.listeners.get("kit_state").size, 0);
    assert.deepEqual(defects, []);
    await service.stop();
    await owner.service.stop();
});

test("an older raw connection that ignores state-channel open fails startup within a bounded deadline and releases its listener", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    let outcome;
    const starting = service.start().then(() => { outcome = "ready"; }, error => { outcome = error; });
    assert.deepEqual(connection.bodies("open").map(body => body.request), [1]);
    t.mock.timers.tick(4999);
    await Promise.resolve();
    assert.equal(outcome, undefined);
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.ok(outcome instanceof Error, "a silent older native must not strand startup forever");
    assert.match(outcome.message, /state-channel.*unavailable/i);
    await starting;
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.deepEqual(defects, [], "missing capability is an expected compatibility failure");
    t.mock.timers.tick(10000);
    assert.equal(connection.bodies("open").length, 1, "no implicit replay");
    await service.stop();
});

test("a silent GUI attachment times out visibly, releases the raw listener and ignores a queued late response", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    const queued = [...connection.listeners.get("kit_state")][0];
    t.mock.timers.tick(5000);
    assert.deepEqual(client.getSnapshot(), { kind: "failed", reason: "state-channel-unavailable" });
    assert.equal(connection.listeners.get("kit_state").size, 0);
    const state = owner.connection.bodies("update").at(-1).state;
    queued({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    assert.deepEqual(client.getSnapshot(), { kind: "failed", reason: "state-channel-unavailable" });
    assert.deepEqual(await client.dispatch({ kind: "undo" }), { kind: "rejected", reason: "not-ready" });
    assert.equal(connection.bodies("attach").length, 1);
    assert.deepEqual(defects, []);
    client.stop();
    await owner.service.stop();
});

test("a scalar native publication reaches the GUI as sent evidence without inventing DSP acknowledgement", async () => {
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    const state = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    const ticket = client.dispatch({ kind: "edit", key: "gain", value: 3 });
    owner.connection.deliver({ kind: "command", address: { ...owner.scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "gain", value: 3 } });
    connection.deliver(owner.connection.bodies("update").at(-1));
    assert.equal((await ticket).kind, "accepted");
    assert.deepEqual(client.getSnapshot().state.fields.gain.application, { kind: "pending" });
    const publication = owner.connection.bodies("publish").at(-1);
    owner.connection.deliver({ kind: "published", request: publication.request, scope: owner.scope, result: { kind: "observed" } });
    connection.deliver(owner.connection.bodies("update").at(-1));
    assert.equal(client.getSnapshot().kind, "ready");
    assert.deepEqual(client.getSnapshot().state.fields.gain.application, { kind: "sent", proof: "native-publication-processed" });
    assert.deepEqual(defects, []);
    client.stop();
    await owner.service.stop();
});

test("a valid accepted receipt survives malformed snapshot data or a codec defect while the raw GUI closes", async () => {
    for (const failure of ["invalid-state", "codec-defect"]) {
        const owner = await openService();
        const problem = new Error("hydrate failed");
        const fields = definePluginState({ gain: parameter("hostGain"), curve: storedValue({ initial: [0, 1], codec: {
            ...curveCodec, parse(input) { if (input?.[0] === 9) throw problem; return curveCodec.parse(input); },
        } }) });
        const connection = new RecordingPatchConnection();
        const defects = [];
        const client = createCmajorPluginStateClient(fields, connection, { onDefect: error => defects.push(error) });
        const state = owner.connection.bodies("update").at(-1).state;
        connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
        const editing = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
        owner.connection.deliver({ kind: "command", address: { ...owner.scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [1, 0] } });
        const update = JSON.parse(JSON.stringify(owner.connection.bodies("update").at(-1)));
        if (failure === "invalid-state") update.state.fields.gain.metadata.step = "broken";
        else update.state.fields.curve.value = [9, 1];
        connection.deliver(update);
        assert.deepEqual(await editing, { kind: "accepted", revision: 2, version: 1 }, failure);
        assert.equal(client.getSnapshot().kind, "closed");
        assert.equal(connection.listeners.get("kit_state").size, 0);
        assert.equal(defects.length, 1);
        if (failure === "codec-defect") assert.strictEqual(defects[0], problem);
        await owner.service.stop();
    }
});

test("a snapshot response send defect closes the raw owner without escaping the native event callback", async () => {
    const problem = new Error("snapshot handoff defect");
    class BrokenSnapshotConnection extends RecordingPatchConnection {
        sendMessageToServer(message) { super.sendMessageToServer(message); if (message.message.kind === "snapshot") throw problem; }
    }
    const connection = new BrokenSnapshotConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const starting = service.start();
    const scope = { owner: "owner", document: 0 };
    connection.deliver({ kind: "opened", request: 1, scope, native: { parameters: [], values: {} } });
    await starting;
    assert.doesNotThrow(() => connection.deliver({ kind: "attached-client", request: 2, scope, client: 7 }));
    assert.deepEqual(defects, [problem]);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.equal(connection.bodies("close").length, 1);
    await service.stop();
});

test("declared event preparation captures host parameters, converts typed samples and reports matching native publication evidence", async t => {
    const fields = definePluginState({ gain: parameter("hostGain"), curve: storedValue({ initial: [0, 1], codec: curveCodec,
        engine: eventValue("curveEvent", (value, context) => ({ samples: new Float32Array(value.map(point => point * context.parameters.gain)) }), { dependencies: ["gain"] }),
    }) });
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(fields, connection, { onDefect: error => defects.push(error) });
    t.after(() => service.stop());
    const starting = service.start();
    void starting.catch(() => {});
    assert.deepEqual(connection.bodies("open")[0].eventEndpoints, ["curveEvent"]);
    const scope = { owner: "engine-owner", document: 0 };
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: {},
    } });
    await starting;
    await new Promise(setImmediate);
    const events = () => connection.bodies("publish").filter(publication => publication.operations[0].kind === "event");
    assert.equal(events().length, 1);
    assert.deepEqual(events()[0].operations, [{ kind: "event", endpoint: "curveEvent", value: { samples: [0, 2.5] } }]);
    assert.deepEqual(connection.bodies("update").at(-1).state.fields.curve.target, { scope, key: "curve", generation: 0 });
    connection.deliver({ kind: "published", scope, request: events()[0].request, result: { kind: "observed" } });
    await new Promise(setImmediate);
    assert.deepEqual(connection.bodies("update").at(-1).state.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [0, 0.5, 1] } });
    await new Promise(setImmediate);
    assert.deepEqual(events()[1].operations, [{ kind: "event", endpoint: "curveEvent", value: { samples: [0, 1.25, 2.5] } }]);
    assert.equal(connection.bodies("update").at(-1).state.fields.curve.target.generation, 1);
    connection.deliver({ kind: "published", scope, request: events()[1].request, result: { kind: "observed" } });
    await new Promise(setImmediate);
    const current = connection.bodies("update").at(-1).state;
    assert.equal(current.history.canUndo, true);
    assert.deepEqual(current.fields.curve.value, [0, 0.5, 1]);
    assert.deepEqual(current.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    assert.deepEqual(defects, []);
    await service.stop();
});

test("a raw GUI subscription that installs then throws is released before constructor failure closes the client", () => {
    const problem = new Error("subscribe defect");
    class BrokenSubscriptionConnection extends RecordingPatchConnection {
        addEventListener(type, listener) { super.addEventListener(type, listener); throw problem; }
    }
    const connection = new BrokenSubscriptionConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    assert.equal(client.getSnapshot().kind, "closed");
    assert.deepEqual(defects, [problem]);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.equal(connection.sent.length, 0);
    client.stop();
});

test("separately bundled GUI adapter copies retain wire attachment uniqueness on one surviving connection", async () => {
    const sources = await Promise.all([bundleBrowserModuleSource(path.join(root, "kit/ui/plugin-state-cmajor.ts")), bundleBrowserModuleSource(path.join(root, "kit/ui/plugin-state-cmajor.ts"))]);
    const [firstModule, secondModule] = await Promise.all(sources.map((source, index) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#gui-reload-${index}`)));
    assert.notStrictEqual(firstModule.createCmajorPluginStateClient, secondModule.createCmajorPluginStateClient);
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const options = { onDefect: error => assert.fail(String(error)) };
    const first = firstModule.createCmajorPluginStateClient(definition, connection, options);
    first.stop();
    const second = secondModule.createCmajorPluginStateClient(definition, connection, options);
    try {
        assert.deepEqual(connection.bodies("attach").map(body => body.request), [1, 2]);
        const state = owner.connection.bodies("update").at(-1).state;
        connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
        assert.equal(second.getSnapshot().kind, "connecting");
        connection.deliver({ kind: "attached", request: 2, scope: owner.scope, client: 8, revision: state.revision, state });
        assert.equal(second.getSnapshot().client, 8);
    } finally { second.stop(); await owner.service.stop(); }
});

async function openEventService(prepare, extra = {}, connection = new RecordingPatchConnection()) {
    const fields = definePluginState({ gain: parameter("hostGain"), ...extra, curve: storedValue({ initial: [0, 1], codec: curveCodec,
        engine: eventValue("curveEvent", prepare, { dependencies: ["gain"] }),
    }) });
    const defects = [];
    const service = createCmajorPluginStateService(fields, connection, { onDefect: error => defects.push(error) });
    const starting = service.start();
    const scope = { owner: "engine-owner", document: 0 };
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
            { endpoint: "otherGain", value: 1, min: 0, max: 10, step: 0, defaultValue: 1 }], values: {},
    } });
    await starting;
    const events = () => connection.bodies("publish").filter(publication => publication.operations[0].kind === "event");
    return { fields, connection, defects, service, scope, events };
}

test("document replacement supersedes held event preparation and ignores old publication failure after the new native target succeeds", async t => {
    let release;
    let completed = false;
    let oldSignal;
    const owner = await openEventService(async (value, context) => {
        if (value[1] === 0.25) {
            oldSignal = context.signal;
            await new Promise(resolve => { release = resolve; });
            completed = true;
        }
        return { samples: new Float32Array(value.map(point => point * context.parameters.gain)) };
    });
    t.after(() => owner.service.stop());
    await new Promise(setImmediate);
    const boot = owner.events()[0];
    assert.ok(boot, "boot event actually crossed the raw publication port");
    owner.connection.deliver({ kind: "command", address: { ...owner.scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [0, 0.25, 1] } });
    assert.equal(typeof release, "function");
    const scope = { ...owner.scope, document: 1 };
    owner.connection.deliver({ kind: "replaced", scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: { curve: [0, 0.75, 1] },
    } });
    await new Promise(setImmediate);
    assert.equal(oldSignal.aborted, true);
    const current = owner.events().at(-1);
    assert.deepEqual(current.scope, scope);
    assert.deepEqual(current.operations[0].value, { samples: [0, 1.5, 2] });
    owner.connection.deliver({ kind: "published", request: current.request, scope, result: { kind: "observed" } });
    await new Promise(setImmediate);
    const ready = owner.connection.bodies("update").at(-1);
    assert.deepEqual(ready.state.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    release();
    await new Promise(setImmediate);
    assert.equal(completed, true, "obsolete authored work really finished");
    owner.connection.deliver({ kind: "published", request: boot.request, scope: owner.scope, result: { kind: "failed", reason: "old failure" } });
    assert.equal(owner.events().length, 2);
    assert.strictEqual(owner.connection.bodies("update").at(-1), ready);
    assert.deepEqual(owner.defects, []);
});

test("only declared scalar dependencies create new event targets and native event rejection remains visible", async t => {
    const owner = await openEventService((value, context) => ({ samples: new Float32Array(value.map(point => point * context.parameters.gain)) }), { other: parameter("otherGain") });
    t.after(() => owner.service.stop());
    await new Promise(setImmediate);
    assert.equal(owner.events().length, 1);
    owner.connection.deliver({ kind: "parameter", scope: owner.scope, endpoint: "otherGain", value: 3 });
    assert.equal(owner.connection.bodies("update").at(-1).state.fields.other.value, 3, "unrelated host observation was processed");
    assert.equal(owner.events().length, 1);
    owner.connection.deliver({ kind: "parameter", scope: owner.scope, endpoint: "hostGain", value: 3 });
    await new Promise(setImmediate);
    const event = owner.events().at(-1);
    assert.equal(owner.events().length, 2);
    assert.deepEqual(event.operations[0].value, { samples: [0, 3] });
    owner.connection.deliver({ kind: "published", scope: owner.scope, request: event.request, result: { kind: "failed", reason: "native event queue full" } });
    await new Promise(setImmediate);
    const field = owner.connection.bodies("update").at(-1).state.fields.curve;
    assert.equal(field.target.generation, 1);
    assert.deepEqual(field.application, { kind: "failed", error: { kind: "transport", message: "native event queue full" } });
    assert.deepEqual(field.value, [0, 1]);
    assert.deepEqual(owner.defects, []);
});

test("raw service stop owns both pending event publication and uncooperative preparation without later sends", { timeout: 2000 }, async () => {
    for (const phase of ["publication", "preparation"]) {
        let signal;
        let release;
        let completed = false;
        const owner = await openEventService(async (value, context) => {
            signal = context.signal;
            if (phase === "preparation") await new Promise(resolve => { release = resolve; });
            completed = true;
            return { samples: new Float32Array(value) };
        });
        await new Promise(setImmediate);
        assert.equal(owner.events().length, phase === "publication" ? 1 : 0);
        const queued = [...owner.connection.listeners.get("kit_state")][0];
        await owner.service.stop();
        assert.equal(signal.aborted, true);
        assert.equal(owner.connection.listeners.get("kit_state").size, 0);
        assert.equal(owner.connection.bodies("close").length, 1);
        if (phase === "preparation") release();
        else queued({ kind: "published", scope: owner.scope, request: owner.events()[0].request, result: { kind: "observed" } });
        await new Promise(setImmediate);
        assert.equal(completed, true);
        assert.equal(owner.events().length, phase === "publication" ? 1 : 0);
        assert.deepEqual(owner.defects, []);
        await owner.service.stop();
        assert.equal(owner.connection.bodies("close").length, 1);
    }
});

test("an unexpected event handoff defect closes the shared service instead of accepting future edits into a dead engine lane", async t => {
    const problem = new Error("event handoff defect");
    class BrokenEventConnection extends RecordingPatchConnection {
        queued;
        sendMessageToServer(message) {
            super.sendMessageToServer(message);
            if (message.message.kind === "publish" && message.message.operations[0].kind === "event") {
                this.queued = [...this.listeners.get("kit_state")][0];
                throw problem;
            }
        }
    }
    const owner = await openEventService(value => ({ samples: new Float32Array(value) }), {}, new BrokenEventConnection());
    t.after(() => owner.service.stop());
    const queued = owner.connection.queued;
    await new Promise(setImmediate);
    assert.deepEqual(owner.defects, [problem]);
    assert.equal(owner.connection.bodies("close").length, 1, "shared native connection damage must terminate the edit service");
    assert.equal(owner.connection.listeners.get("kit_state").size, 0);
    await assert.rejects(owner.service.start(), /closed/);
    const before = owner.connection.sent.length;
    queued({ kind: "command", address: { ...owner.scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [1, 0] } });
    await new Promise(setImmediate);
    assert.equal(owner.connection.sent.length, before);
});

test("pure preparation defects and invalid event payloads fail the target while later accepted edits can recover", async t => {
    const problem = new Error("renderer defect");
    const owner = await openEventService(value => {
        if (value[0] === 9) throw problem;
        return { samples: new Float32Array(value[0] === 8 ? [NaN, 1] : value) };
    });
    t.after(() => owner.service.stop());
    await new Promise(setImmediate);
    owner.connection.deliver({ kind: "published", request: owner.events()[0].request, scope: owner.scope, result: { kind: "failed", reason: "queue full" } });
    await new Promise(setImmediate);
    assert.equal(owner.connection.bodies("update").at(-1).state.fields.curve.application.error.kind, "transport");
    const edit = (sequence, value) => owner.connection.deliver({ kind: "command", address: { ...owner.scope, client: 7, sequence }, command: { kind: "edit", key: "curve", value } });
    edit(1, [9, 1]);
    await new Promise(setImmediate);
    assert.equal(owner.connection.bodies("update").at(-1).state.fields.curve.application.error.kind, "defect");
    assert.deepEqual(owner.defects, [problem]);
    edit(2, [8, 1]);
    await new Promise(setImmediate);
    assert.equal(owner.connection.bodies("update").at(-1).state.fields.curve.application.error.kind, "engine-rejected");
    assert.equal(owner.events().length, 1, "invalid prepared samples never cross the raw event port");
    edit(3, [1, 0]);
    await new Promise(setImmediate);
    const recovered = owner.events().at(-1);
    assert.equal(owner.events().length, 2);
    assert.deepEqual(recovered.operations[0].value, { samples: [1, 0] });
    owner.connection.deliver({ kind: "published", request: recovered.request, scope: owner.scope, result: { kind: "observed" } });
    await new Promise(setImmediate);
    const state = owner.connection.bodies("update").at(-1).state;
    assert.deepEqual(state.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    assert.equal(state.fields.curve.version, 3);
    assert.equal(state.history.canUndo, true);
    assert.equal(owner.connection.bodies("close").length, 0);
});

test("stopping an attached GUI releases its exact native incarnation once without pretending its pending edit was rejected", async () => {
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    const state = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    connection.deliver({ kind: "reset", scope: owner.scope });
    connection.deliver({ kind: "reset", scope: { owner: "unrelated-owner", document: 9 } });
    assert.equal(client.getSnapshot().kind, "ready", "irrelevant resets must not discard current ownership");
    const pending = client.dispatch({ kind: "begin", key: "gain", gesture: 3 });
    client.stop();
    assert.deepEqual(connection.bodies("detach"), [{ kind: "detach", scope: owner.scope, client: 7 }]);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.deepEqual(await pending, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    client.stop();
    assert.equal(connection.bodies("detach").length, 1);
    assert.deepEqual(defects, []);
    const reconnect = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    reconnect.stop();
    assert.equal(connection.bodies("detach").length, 1, "an unassigned attachment cannot release another client");
    await owner.service.stop();
});

test("failed native detach still releases the GUI listener and settles owned tickets while retaining the cause", async () => {
    const owner = await openService();
    const connection = new RecordingPatchConnection();
    const defects = [];
    const client = createCmajorPluginStateClient(definition, connection, { onDefect: error => defects.push(error) });
    const state = owner.connection.bodies("update").at(-1).state;
    connection.deliver({ kind: "attached", request: 1, scope: owner.scope, client: 7, revision: state.revision, state });
    const pending = client.dispatch({ kind: "edit", key: "gain", value: 3 });
    const problem = new Error("native view disappeared before detach");
    connection.sendMessageToServer = message => {
        assert.equal(message.message.kind, "detach");
        throw problem;
    };
    const cleanupProblem = new Error("connection cleanup failed after removing listener");
    const remove = connection.removeEventListener.bind(connection);
    connection.removeEventListener = (type, listener) => { remove(type, listener); throw cleanupProblem; };
    assert.doesNotThrow(() => client.stop());
    assert.deepEqual(defects, [problem, cleanupProblem]);
    assert.equal(connection.listeners.get("kit_state").size, 0);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.deepEqual(await pending, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    client.stop();
    assert.deepEqual(defects, [problem, cleanupProblem]);
    await owner.service.stop();
});
