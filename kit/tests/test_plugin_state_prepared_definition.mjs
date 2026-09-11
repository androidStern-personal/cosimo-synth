import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { definePluginState, parameter, preparedState, preparationFailure } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const schema = {
    parse(value) {
        return Array.isArray(value) && value.every(Number.isFinite)
            ? { kind: "ok", value: Object.freeze([...value]) } : { kind: "error", message: "Expected samples." };
    },
    encode(value) { return [...value]; },
    equals(a, b) { return a.length === b.length && a.every((value, index) => value === b[index]); },
};
// External native transport only: production service owns values, targets and history.
class Connection {
    sent = [];
    listeners = new Set();
    addEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.add(listener); }
    removeEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.delete(listener); }
    sendMessageToServer(envelope) { this.sent.push(structuredClone(envelope.message)); }
    deliver(message) { for (const listener of [...this.listeners]) listener(structuredClone(message)); }
    messages(kind) { return this.sent.filter(message => message.kind === kind); }
}
const scope = { owner: "prepared-owner", document: 0 };
const native = { parameters: [{ endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 }], values: { curve: [0.2, 0.8] } };
function acknowledge(connection, publication) {
    assert.ok(publication, "a real service publication must exist before its native receipt");
    connection.deliver({ kind: "published", request: publication.request, scope: publication.scope, result: { kind: "observed" } });
}

test("a missing preparation resource fails only its field and a later edit still reaches its engine", async () => {
    const connection = new Connection(), defects = [];
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({
        codec: schema, initial: [0, 1],
        prepare(value) { return value[0] < 0.5 ? preparationFailure("The source file is unavailable.") : value; },
        engine: { eventEndpoints: ["curveData"], create: () => ({
            async apply(value, context) {
                const sent = context.send({ kind: "event", endpoint: "curveData", value });
                return sent.kind === "submitted" ? sent.completion : sent;
            }, stop() {},
        }) },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting;
        await setImmediate();
        connection.deliver({ kind: "attached-client", request: 9, scope, client: 7 });
        const failed = connection.messages("snapshot").at(-1).state;
        assert.equal(failed.fields.curve.application.kind, "failed");
        assert.equal(failed.fields.curve.application.error.kind, "resource");
        assert.equal(failed.fields.gain.value, 2.5);
        assert.equal(connection.messages("close").length, 0);
        connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 1 },
            command: { kind: "edit", key: "curve", value: [0.8, 1] } });
        await setImmediate();
        const delivered = connection.messages("publish").find(message => message.operations[0].kind === "event");
        assert.deepEqual(delivered.operations[0].value, [0.8, 1]);
        acknowledge(connection, delivered);
        await setImmediate();
        assert.equal(connection.messages("update").at(-1).state.fields.curve.application.kind, "sent");
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
});

test("prepared declaration automatically delivers a different representation while shared Undo retains editable values", async () => {
    const connection = new Connection();
    const defects = [];
    let created = 0;
    let stopped = 0;
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({
        codec: schema, initial: [0, 1], dependencies: ["gain"],
        prepare(value, context) { return new Float32Array(value.map(sample => sample * context.parameters.gain)); },
        engine: { eventEndpoints: ["curveData"], create() {
            created++;
            return { async apply(payload, context) {
                const submission = context.send({ kind: "event", endpoint: "curveData", value: { packed: payload } });
                return submission.kind === "submitted" ? submission.completion : submission;
            }, stop() { stopped++; } };
        } },
    }) });
    assert.equal(definition.curve.kind, "stored");
    assert.deepEqual(definition.curve.initial, { kind: "ok", value: [0, 1] });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        const open = connection.messages("open")[0];
        connection.deliver({ kind: "opened", request: open.request, scope, native });
        await starting;
        await setImmediate();
        assert.equal(created, 1, "the generated-service entry must construct the field's declared delivery automatically");
        assert.deepEqual(open.eventEndpoints, ["curveData"]);
        const initial = connection.messages("publish")[0];
        assert.deepEqual(initial.operations, [{ kind: "event", endpoint: "curveData", value: { packed: [0.5, 2] } }]);
        acknowledge(connection, initial);
        await setImmediate();
        connection.deliver({ kind: "attached-client", request: 9, scope, client: 7 });
        const snapshot = connection.messages("snapshot").at(-1).state;
        assert.deepEqual(snapshot.fields.curve.value, [0.2, 0.8]);
        assert.deepEqual(snapshot.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
        assert.deepEqual(snapshot.history, { canUndo: false, canRedo: false });
        connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 1 },
            command: { kind: "edit", key: "curve", value: [0.4, 1], expectedVersion: 0 } });
        await setImmediate();
        const edit = connection.messages("publish").filter(message => message.operations[0].kind === "event").at(-1);
        assert.deepEqual(edit.operations[0].value, { packed: [1, 2.5] });
        acknowledge(connection, edit);
        await setImmediate();
        const edited = connection.messages("update").at(-1).state;
        assert.deepEqual(edited.fields.curve.value, [0.4, 1]);
        assert.equal(edited.history.canUndo, true);
        connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 2 }, command: { kind: "undo" } });
        await setImmediate();
        const undone = connection.messages("publish").filter(message => message.operations[0].kind === "event").at(-1);
        assert.notEqual(undone.request, initial.request);
        assert.deepEqual(undone.operations[0].value, { packed: [0.5, 2] });
        assert.deepEqual(connection.messages("update").at(-1).state.fields.curve.value, [0.2, 0.8]);
        assert.deepEqual(connection.messages("publish").filter(message => message.operations[0].kind === "stored").map(message => message.operations[0].value), [[0.4, 1], [0.2, 0.8]]);
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
    assert.equal(stopped, 1);
    assert.equal(connection.listeners.size, 0);
});

test("finish delivery preserves one applying value and only the newest queue, while reset revokes both", async () => {
    const connection = new Connection();
    const contexts = [];
    const defects = [];
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({
        codec: schema, initial: [0, 1], prepare: value => value[0],
        engine: { replacement: "finish", eventEndpoints: ["curveData"], create: () => ({
            async apply(payload, context) {
                contexts.push(context);
                const submission = context.send({ kind: "event", endpoint: "curveData", value: payload });
                return submission.kind === "submitted" ? submission.completion : submission;
            }, stop() {},
        }) },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const events = () => connection.messages("publish").filter(message => message.operations[0].kind === "event");
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting;
        await setImmediate();
        assert.deepEqual(events().map(message => message.operations[0].value), [0.2]);
        connection.deliver({ kind: "attached-client", request: 9, scope, client: 7 });
        for (const [sequence, value] of [[1, 0.4], [2, 0.6]]) {
            connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence }, command: { kind: "edit", key: "curve", value: [value, 1] } });
        }
        await setImmediate();
        assert.deepEqual(connection.messages("update").at(-1).state.fields.curve.value, [0.6, 1], "both edits are accepted before deciding engine queue behavior");
        assert.equal(contexts[0].signal.aborted, false, "same-document edits must not revoke the physically applying bank");
        assert.deepEqual(events().map(message => message.operations[0].value), [0.2]);
        acknowledge(connection, events()[0]);
        await setImmediate();
        assert.deepEqual(events().map(message => message.operations[0].value), [0.2, 0.6], "the intermediate accepted value is coalesced, not delivered");
        connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 3 }, command: { kind: "edit", key: "curve", value: [0.7, 1] } });
        await setImmediate();
        assert.deepEqual(connection.messages("update").at(-1).state.fields.curve.value, [0.7, 1]);
        assert.deepEqual(events().map(message => message.operations[0].value), [0.2, 0.6]);
        const replacement = { ...scope, document: 1 };
        connection.deliver({ kind: "replaced", scope: replacement, native: { ...native, values: { curve: [0.9, 1] } } });
        await setImmediate();
        assert.equal(contexts[1].signal.aborted, true);
        const before = connection.sent.length;
        assert.deepEqual(contexts[1].send({ kind: "event", endpoint: "curveData", value: 99 }), { kind: "cancelled" });
        assert.equal(connection.sent.length, before);
        assert.deepEqual(events().map(message => message.operations[0].value), [0.2, 0.6, 0.9]);
        assert.deepEqual(events().at(-1).scope, replacement);
        acknowledge(connection, events()[1]);
        await setImmediate();
        assert.equal(connection.messages("update").at(-1).state.fields.curve.application.kind, "preparing", "old completion must not mark the restored target sent");
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
    assert.equal(contexts.at(-1).signal.aborted, true);
});

test("prepared declaration retains editable and payload types and rejects an incompatible delivery", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kit-prepared-types-"));
    try {
        const file = path.join(directory, "prepared.ts");
        await writeFile(file, `
import { preparedState, type PluginStateCodec, type PluginStateDelivery, type PluginStateFieldValue } from ${JSON.stringify(path.join(root, "kit/ui/plugin-state-definition"))};
const schema: PluginStateCodec<readonly number[]> = {
  parse: () => ({kind:"ok", value:[]}), encode: value => value, equals: () => true,
};
const engine: PluginStateDelivery<Int32Array> = {eventEndpoints:[], create: () => ({
  async apply(value) { value.set([1]); return {kind:"unconfirmed"}; }, stop() {},
})};
const field = preparedState({codec: schema, initial:[1,2], prepare:value => new Int32Array(value), engine});
const editable: PluginStateFieldValue<typeof field> = [1,2];
// @ts-expect-error Packed buffers must not replace editable values in the UI/history type.
const badEditable: PluginStateFieldValue<typeof field> = new Int32Array([1,2]);
// @ts-expect-error Preparation and delivery payload types must agree.
preparedState({codec: schema, initial:[1], prepare:() => "wrong payload", engine});
`);
        const checked = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--ignoreConfig", "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--lib", "ES2022,DOM", file], { cwd: root, encoding: "utf8", timeout: 15000 });
        assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test("public preparedState survives the actual declaration-only builder and generated worker without author worker setup", { timeout: 30000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kit-prepared-build-"));
    let worker;
    try {
        await mkdir(path.join(directory, "kit"));
        for (const entry of ["fx", "ui", "kit.json", "index.ts", "package.json"])
            await cp(path.join(root, "kit", entry), path.join(directory, "kit", entry), { recursive: true });
        await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
        await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "prepared-build-fixture", type: "module" }));
        const patch = path.join(directory, "fx/prepared_lab");
        await mkdir(path.join(patch, "view"), { recursive: true });
        await writeFile(path.join(patch, "Prepared.cmajorpatch"), JSON.stringify({ CmajorVersion: 1, ID: "test.prepared-build", name: "Prepared Lab", version: "1.0.0", source: "Prepared.cmajor", view: { src: "view/index.js", devModule: "/fx/prepared_lab/view/source.ts" } }));
        await writeFile(path.join(patch, "Prepared.plugin.json"), JSON.stringify({ schemaVersion: 1, stateSource: "fx/prepared_lab/state.ts" }));
        await writeFile(path.join(patch, "Prepared.cmajor"), "processor Prepared { input value float32 hostGain [[ min: -12, max: 12, step: 0.5, init: 1 ]]; output stream float32 out; void main() { loop { out <- hostGain; advance(); } } }");
        await writeFile(path.join(patch, "view/source.ts"), "export default () => document.createElement('div');");
        await writeFile(path.join(patch, "state.ts"), `
import { definePluginState, parameter, preparedState, type PluginStateCodec, type PluginStateDelivery } from "../../kit/index";
const schema: PluginStateCodec<readonly number[]> = {
  parse(value) { return Array.isArray(value) && value.every(Number.isFinite)
    ? {kind:"ok", value:Object.freeze([...value])} : {kind:"error", message:"Expected samples"}; },
  encode: value => [...value], equals: (a,b) => a.length === b.length && a.every((v,i) => v === b[i]),
};
const engine: PluginStateDelivery<Float32Array> = {eventEndpoints:["curveData"], create: () => ({
  async apply(value, context) {
    const sent = context.send({kind:"event", endpoint:"curveData", value:{packed:value}});
    return sent.kind === "submitted" ? sent.completion : sent;
  }, stop() {},
})};
export default definePluginState({gain:parameter("hostGain"), curve:preparedState({
  codec: schema, initial:[0,1], dependencies:["gain"],
  prepare:(value, context) => new Float32Array(value.map(v => v * context.parameters.gain)), engine,
})});`);
        const built = spawnSync(process.execPath, ["kit/fx/build-effect.mjs", "prepared-lab"], { cwd: directory, encoding: "utf8", timeout: 20000 });
        assert.equal(built.status, 0, built.stdout + built.stderr);
        const runtime = path.join(directory, "build/fx/prepared_lab_runtime");
        const manifest = JSON.parse(await readFile(path.join(runtime, "Prepared.cmajorpatch"), "utf8"));
        assert.equal(manifest.worker, "worker.js");
        const { default: runWorker } = await import(pathToFileURL(path.join(runtime, manifest.worker)).href);
        const connection = new Connection();
        const starting = runWorker(connection);
        await setImmediate();
        const open = connection.messages("open")[0];
        assert.deepEqual(open.eventEndpoints, ["curveData"]);
        connection.deliver({ kind: "opened", request: open.request, scope, native });
        worker = await starting;
        await setImmediate();
        const publication = connection.messages("publish")[0];
        assert.deepEqual(publication.operations, [{ kind: "event", endpoint: "curveData", value: { packed: [0.5, 2] } }]);
        acknowledge(connection, publication);
        await setImmediate();
        connection.deliver({ kind: "attached-client", request: 12, scope, client: 8 });
        const snapshot = connection.messages("snapshot").at(-1).state;
        assert.deepEqual(snapshot.fields.curve.value, [0.2, 0.8]);
        assert.deepEqual(snapshot.fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
        assert.equal(snapshot.history.canUndo, false);
        await worker.stop();
        assert.equal(connection.listeners.size, 0);
        assert.deepEqual(connection.messages("close"), [{ kind: "close", reason: "service-closed" }]);
    } finally { await worker?.stop(); await rm(directory, { recursive: true, force: true }); }
});

test("automatic delivery validates all registrations and optional listener capabilities before constructing any port", async t => {
    for (const [name, override] of [
        ["invalid factory", { create: null }],
        ["invalid replacement policy", { replacement: "sometimes" }],
        ["malformed output endpoint", { outputEndpoints: [""] }],
        ["missing output listener capability", { outputEndpoints: ["curveAck"] }],
        ["explicit duplicate ownership", {}],
    ]) await t.test(name, async () => {
        const connection = new Connection();
        let constructed = 0;
        const engine = { eventEndpoints: ["curveData"], create() {
            constructed++;
            return { async apply() { return { kind: "cancelled" }; }, stop() {} };
        } };
        const definition = definePluginState({
            first: preparedState({ codec: schema, initial: [0, 1], prepare: value => value, engine }),
            curve: preparedState({ codec: schema, initial: [0, 1], prepare: value => value, engine: { ...engine, ...override } }),
        });
        const service = createCmajorPluginStateService(definition, connection, { onDefect() {},
            ...(name === "explicit duplicate ownership" ? { bindings: [{ key: "curve", eventEndpoints: [], create() {
                constructed++; return { replace() {}, cancel() {}, async stop() {} };
            } }] } : {}),
        });
        const starting = service.start().then(() => "started", () => "failed");
        try {
            assert.equal(constructed, 0, "an invalid later declaration must not allocate an earlier valid port");
            assert.deepEqual(connection.sent, []);
            assert.equal(await starting, "failed");
        } finally { await service.stop(); await starting; }
    });
});

test("delivery subscribes before synchronous endpoint output and releases its context after completion and stop", async () => {
    const connection = new Connection();
    const endpoints = new Map();
    const callbacks = [];
    connection.addEndpointListener = (endpoint, listener) => {
        assert.equal(endpoint, "curveAck"); endpoints.set(listener, endpoint); callbacks.push(listener);
    };
    connection.removeEndpointListener = (endpoint, listener) => { assert.equal(endpoints.get(listener), endpoint); endpoints.delete(listener); };
    const send = connection.sendMessageToServer.bind(connection);
    connection.sendMessageToServer = envelope => {
        send(envelope);
        if (envelope.message.operations?.[0]?.kind === "event") {
            assert.equal(endpoints.size, 1, "the real publication may synchronously produce output before send returns");
            for (const listener of endpoints.keys()) listener({ serial: 41 });
        }
    };
    const received = [];
    const contexts = [];
    let stopped = 0;
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({ codec: schema, initial: [0, 1], prepare: value => value,
        engine: { eventEndpoints: ["curveData"], outputEndpoints: ["curveAck"], create: () => ({
            async apply(payload, context) {
                contexts.push(context);
                context.listen("curveAck", value => received.push(value));
                const sent = context.send({ kind: "event", endpoint: "curveData", value: payload });
                return sent.kind === "submitted" ? sent.completion : sent;
            }, stop() { stopped++; },
        }) },
    }) });
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting;
        await setImmediate();
        assert.deepEqual(received, [{ serial: 41 }]);
        assert.equal(endpoints.size, 1);
        acknowledge(connection, connection.messages("publish")[0]);
        await setImmediate();
        assert.equal(endpoints.size, 0);
        callbacks[0]({ serial: 99 });
        assert.deepEqual(received, [{ serial: 41 }]);
        const before = connection.sent.length;
        assert.deepEqual(contexts[0].send({ kind: "event", endpoint: "curveData", value: [9] }), { kind: "cancelled" });
        assert.equal(connection.sent.length, before);
        connection.deliver({ kind: "replaced", scope: { ...scope, document: 1 }, native });
        await setImmediate();
        assert.equal(endpoints.size, 1);
        await service.stop();
        assert.equal(endpoints.size, 0);
        assert.equal(contexts[1].signal.aborted, true);
        callbacks[1]({ serial: 100 });
        assert.deepEqual(received, [{ serial: 41 }, { serial: 41 }]);
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
    assert.equal(stopped, 2, "each project document closes its own delivery instance");
});

test("prepared delivery reports unconfirmed without falsely failing or acknowledging accepted editable state", async () => {
    const connection = new Connection();
    const outstanding = [];
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({ codec: schema, initial: [0, 1], prepare: value => value,
        engine: { eventEndpoints: ["curveData"], create: () => ({
            async apply(payload, context) {
                const sent = context.send({ kind: "event", endpoint: "curveData", value: payload });
                assert.equal(sent.kind, "submitted");
                void sent.completion.then(result => outstanding.push(result));
                return { kind: "unconfirmed" };
            }, stop() {},
        }) },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => assert.fail(String(error)) });
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting;
        await setImmediate();
        assert.equal(connection.messages("publish").length, 1);
        connection.deliver({ kind: "attached-client", request: 1, scope, client: 7 });
        const state = connection.messages("snapshot").at(-1).state;
        assert.deepEqual(state.fields.curve.value, [0.2, 0.8]);
        assert.deepEqual(state.fields.curve.application, { kind: "unconfirmed" });
        assert.equal(state.history.canUndo, false);
        assert.deepEqual([...outstanding], [{ kind: "cancelled" }], "a finished delivery must release its unconfirmed receipt wait without requiring reset or plugin teardown");
    } finally { await service.stop(); }
});

test("a delivery output callback defect retains its cause and closes the service with owned listeners released", async () => {
    const connection = new Connection();
    const listeners = new Set();
    connection.addEndpointListener = (_endpoint, listener) => listeners.add(listener);
    connection.removeEndpointListener = (_endpoint, listener) => listeners.delete(listener);
    const cause = new Error("broken receiver parser");
    const defects = [];
    let stopped = 0;
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({ codec: schema, initial: [0, 1], prepare: value => value,
        engine: { eventEndpoints: [], outputEndpoints: ["curveAck"], create: () => ({
            async apply(_payload, context) {
                context.listen("curveAck", () => { throw cause; });
                return new Promise(() => {});
            }, stop() { stopped++; },
        }) },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting;
        await setImmediate();
        assert.equal(listeners.size, 1);
        assert.doesNotThrow(() => { for (const listener of listeners) listener({ malformed: true }); });
        await setImmediate();
        assert.deepEqual(defects, [cause]);
        assert.equal(listeners.size, 0);
        assert.equal(stopped, 1);
        assert.deepEqual(connection.messages("close"), [{ kind: "close", reason: "service-closed" }]);
    } finally { await service.stop(); }
});

test("document delivery retains subscriptions after apply, reuses deltas, and revokes old callbacks on replacement", async () => {
    const connection = new Connection(), defects = [], documents = [], stoppedDocuments = [], applications = [], aborts = [];
    const outputs = new Map(), storedListeners = new Set();
    let releasePreparation;
    connection.addEndpointListener = (endpoint, listener) => outputs.set(listener, endpoint);
    connection.removeEndpointListener = (_endpoint, listener) => outputs.delete(listener);
    connection.addStoredStateValueListener = listener => storedListeners.add(listener);
    connection.removeStoredStateValueListener = listener => storedListeners.delete(listener);
    connection.requestFullStoredState = callback => queueMicrotask(() => callback({ values: { auxiliary: 7 } }));
    const definition = definePluginState({ gain: parameter("hostGain"), curve: preparedState({
        codec: schema, initial: [0, 1], prepare: value => value[0] === 0.4
            ? new Promise(resolve => { releasePreparation = () => resolve(value); }) : value,
        engine: { eventEndpoints: ["curveData"], outputEndpoints: ["reset"], storedKeys: ["auxiliary"],
            replacement: "finish", create(document) {
                documents.push(document);
                let previous = null;
                document.listen("reset", () => document.send({ kind: "event", endpoint: "curveData", value: previous }));
                document.subscribeStored("auxiliary", value => document.send({ kind: "event", endpoint: "curveData", value }));
                return { async apply(value, application) {
                    const index = applications.push(application) - 1;
                    aborts[index] = 0;
                    application.signal.onAbort(() => { aborts[index]++; });
                    const auxiliary = await document.readStored("auxiliary");
                    assert.equal(auxiliary, 7);
                    const submission = document.send({ kind: "event", endpoint: "curveData", value: { previous, next: value } });
                    previous = value;
                    return submission.kind === "submitted" ? submission.completion : submission;
                }, stop() { stoppedDocuments.push(document); } };
            },
        },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    const events = () => connection.messages("publish").filter(message => message.operations[0].kind === "event");
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request, scope, native });
        await starting; await setImmediate();
        acknowledge(connection, events().at(-1)); await setImmediate();
        assert.equal(applications[0].signal.aborted, true, "application capability expires when its promise resolves");
        assert.equal(aborts[0], 1);
        assert.equal(documents[0].signal.aborted, false, "document capability survives completed applications");
        assert.equal(outputs.size, 1); assert.equal(storedListeners.size, 1);
        const oldListener = [...outputs.keys()][0], oldStored = [...storedListeners][0];
        oldListener(0); oldStored({ key: "auxiliary", value: 8 });
        assert.deepEqual(events().slice(-2).map(event => event.operations[0].value), [[0.2, 0.8], 8]);
        for (const publication of events().slice(-2)) acknowledge(connection, publication);
        connection.deliver({ kind: "attached-client", request: 9, scope, client: 7 });
        connection.deliver({ kind: "command", address: { ...scope, client: 7, sequence: 1 }, command: { kind: "edit", key: "curve", value: [0.4, 1] } });
        await setImmediate();
        assert.equal(documents.length, 1);
        documents[0].report({ kind: "sent", proof: "native-publication-processed" });
        await setImmediate();
        assert.equal(connection.messages("update").at(-1).state.fields.curve.application.kind, "preparing",
            "old background evidence cannot complete a newer value whose preparation is still pending");
        releasePreparation(); await setImmediate();
        assert.deepEqual(events().at(-1).operations[0].value, { previous: [0.2, 0.8], next: [0.4, 1] });
        acknowledge(connection, events().at(-1)); await setImmediate();
        const replacement = { ...scope, document: 1 };
        connection.deliver({ kind: "replaced", scope: replacement, native });
        await setImmediate();
        assert.equal(documents.length, 2); assert.equal(stoppedDocuments.length, 1);
        assert.equal(documents[0].signal.aborted, true);
        const before = connection.sent.length;
        oldListener(0); oldStored({ key: "auxiliary", value: 99 });
        assert.deepEqual(documents[0].send({ kind: "event", endpoint: "curveData", value: 99 }), { kind: "cancelled" });
        assert.equal(connection.sent.length, before);
        assert.equal(outputs.size, 1); assert.equal(storedListeners.size, 1);
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
    assert.equal(outputs.size, 0); assert.equal(storedListeners.size, 0);
    assert.equal(stoppedDocuments.length, 2);
    assert.ok(aborts.every(count => count === 1), "completion and stop notify each application cancellation exactly once");
});
