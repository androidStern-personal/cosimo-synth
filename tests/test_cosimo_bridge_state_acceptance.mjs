import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { createSynthParameterFixture } from "./helpers/synth_parameter_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const bundled = await build({ stdin: { contents: `
export { createCosimoBridgeAdapter } from "./ui/shared/cosimo-bridge-adapter";
export { acquireSynthViewState } from "./ui/shared/synth-state-client";
export { synthPluginState, synthParameterByEndpoint } from "./ui/shared/synth-plugin-state";
export { createDefaultModulationState, createDefaultRoute, MODULATION_STATE_KEY } from "./ui/shared/modulation";
export { createPluginStateSession } from "./kit/ui/plugin-state-session";
`, resolveDir: root }, bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const key = api.MODULATION_STATE_KEY;

// Only the external wire/native-storage seam is recorded here. The production
// session creates every accepted/rejected receipt, value, lock and history entry;
// the adapter and test controls acquire the same production view lease.
async function fixture() {
    const routeId = "oscA.warpAmount::mseg-1";
    const bank = api.createDefaultModulationState();
    bank.routes = [api.createDefaultRoute({ id: routeId, sourceKind: "mseg", sourceSlot: 1, targetKind: "oscA.warpAmount", amount: 0.4 })];
    bank.msegSlots[0].shapeA.points[0].y = 0.27;
    const articulations = { format: "cosimo.articulations", version: 4, selectedSlotId: "articulation-0", activeTriggerMode: "key", slots: [{
        id: "articulation-0", runtimeSlot: 0, name: "First", color: "#d2a128", key: 36,
        velRange: { min: 0, max: 127 }, chainRange: { min: 0, max: 127 },
        overrides: {}, routeAmounts: { [routeId]: 0.6 },
    }] };
    const stored = new Map([[key, JSON.stringify(bank)], ["articulations.v4", JSON.stringify(articulations)]]);
    const { values: parameters, readParameter } = createSynthParameterFixture({ globalTune: 0, mseg1Morph: 0.63 });
    const nativeParameters = () => Object.keys(api.synthParameterByEndpoint).map(readParameter);
    let scope = { owner: "prototype-adapter-test", document: 1 };
    let restoring = false;
    const pendingAttaches = [];
    const views = new Set(), jobs = [], publications = [], rawWrites = [], rawSends = [], commands = [], defects = [];
    let nextClient = 0;
    const session = api.createPluginStateSession(api.synthPluginState, { native: {
        publish(publication) {
            publications.push(publication);
            for (const operation of publication.operations) {
                if (operation.kind === "stored") {
                    stored.set(operation.key, operation.value);
                    for (const view of views) view.emitStored(operation.key, operation.value);
                } else if (operation.kind === "parameter") parameters.set(operation.endpoint, operation.value);
            }
            jobs.push(Promise.resolve().then(() => session.dispatch({ kind: "published", scope: publication.scope, request: publication.request, result: { kind: "observed" } })));
        },
        update(state, receipt) {
            for (const view of views) view.deliver({ kind: "update", scope: state.scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) });
        },
        close() {},
    }, onDefect: error => defects.push(error) });
    await session.dispatch({ kind: "opened", scope, native: { values: Object.fromEntries(stored), parameters: nativeParameters() } });
    function connection() {
        const listeners = new Set(), storedListeners = new Set(), parameterListeners = new Map(), endpointListeners = new Map();
        let held = false;
        let commandsHeld = false;
        const outgoing = [];
        const replies = [];
        let afterReceipt;

        const attach = request => {
            const state = session.getSnapshot();
            view.deliverNow({ kind: "attached", request, scope, client: ++nextClient, revision: state.revision, state });
        };
        const view = {
            afterNextReceipt(callback) { afterReceipt = callback; },
            holdReplies() { held = true; },
            holdCommands() { commandsHeld = true; },
            releaseCommands() { commandsHeld = false; for (const envelope of outgoing.splice(0)) view.sendMessageToServer(envelope); },
            releaseReplies() { held = false; for (const message of replies.splice(0)) view.deliverNow(message); },
            deliverNow(message) {
                for (const listener of listeners) listener(message);
                if (afterReceipt && message.kind === "update" && message.receipt) {
                    const callback = afterReceipt;
                    afterReceipt = undefined;
                    queueMicrotask(callback);
                }
            },
            addEventListener(_type, listener) { listeners.add(listener); },
            removeEventListener(_type, listener) { listeners.delete(listener); },
            deliver(message) { if (held) replies.push(message); else view.deliverNow(message); },
            sendMessageToServer({ message }) {
                if (message.kind === "attach") {
                    if (restoring) pendingAttaches.push(() => attach(message.request));
                    else attach(message.request);
                } else if (message.kind === "detach") {
                    jobs.push(session.dispatch({ kind: "detached", scope: message.scope, client: message.client }));
                } else {
                    if (commandsHeld) { outgoing.push({ message }); return; }
                    commands.push(message.command);
                    jobs.push(Promise.resolve().then(() => session.dispatch({ kind: "command", address: { ...message.scope, client: message.client, sequence: message.sequence }, command: message.command })));
                }
            },
            addStoredStateValueListener(listener) { storedListeners.add(listener); },
            removeStoredStateValueListener(listener) { storedListeners.delete(listener); },
            requestFullStoredState(callback) { queueMicrotask(() => callback({ values: Object.fromEntries(stored) })); },
            requestStoredStateValue(key) { queueMicrotask(() => view.emitStored(key, stored.get(key))); },
            emitStored(key, value) { for (const listener of storedListeners) listener({ key, value }); },
            sendStoredStateValue(key, value) {
                rawWrites.push({ key, value }); stored.set(key, value);
                for (const target of views) target.emitStored(key, value);
            },
            addParameterListener(endpoint, listener) { const group = parameterListeners.get(endpoint) ?? new Set(); group.add(listener); parameterListeners.set(endpoint, group); },
            removeParameterListener(endpoint, listener) { parameterListeners.get(endpoint)?.delete(listener); },
            requestParameterValue(endpoint) { queueMicrotask(() => { for (const listener of parameterListeners.get(endpoint) ?? []) listener(parameters.get(endpoint)); }); },
            addEndpointListener(endpoint, listener) { const group = endpointListeners.get(endpoint) ?? new Set(); group.add(listener); endpointListeners.set(endpoint, group); },
            removeEndpointListener(endpoint, listener) { endpointListeners.get(endpoint)?.delete(listener); },
            sendEventOrValue(endpoint, value) { rawSends.push({ endpoint, value }); parameters.set(endpoint, value); },
        };
        views.add(view); return view;
    }
    const main = connection();
    const lease = api.acquireSynthViewState(main);
    const other = api.acquireSynthViewState(connection());
    const adapter = api.createCosimoBridgeAdapter({ connection: main });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(adapter.getSnapshot().connection._tag, "ready");
    rawWrites.length = 0; rawSends.length = 0; commands.length = 0;
    return { adapter, lease, other, main, bank, routeId, session, stored, parameters, publications, rawWrites, rawSends, commands,
        async restore(nextBank) {
            restoring = true;
            scope = { ...scope, document: scope.document + 1 };
            stored.set(key, JSON.stringify(nextBank));
            stored.set("articulations.v4", JSON.stringify(articulations));
            parameters.set("mseg1Morph", 0.63);
            for (const view of views) view.deliverNow({ kind: "reset", scope });
            const replacing = session.dispatch({ kind: "replaced", scope, native: { values: Object.fromEntries(stored), parameters: nativeParameters() } });
            assert.deepEqual(session.getSnapshot().scope, scope, "the actual owner must install the replacement before native attach is answered");
            restoring = false;
            for (const attach of pendingAttaches.splice(0)) attach();
            await replacing;
            await new Promise(resolve => setImmediate(resolve));
        },
        async stop() { adapter.dispose(); lease.release(); other.release(); await Promise.all(jobs); await session.stop(); assert.deepEqual(defects, []); } };
}

test("busy source deletion leaves the bank, related native data and source visibility unchanged", async () => {
    const f = await fixture();
    try {
        assert.equal((await f.other.modulation.beginGesture()).kind, "accepted");
        const before = structuredClone(f.adapter.getSnapshot());
        const nativeBefore = Object.fromEntries(f.stored);
        const historyBefore = f.session.getSnapshot().history;
        const result = await f.adapter.commands.deleteSource("mseg-1");
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === "mseg-1"), true, "the rejected deletion cannot hide the source");
        assert.deepEqual(f.adapter.getSnapshot().patch, before.patch);
        assert.deepEqual(f.session.getSnapshot().fields[key].value, f.bank);
        assert.deepEqual(f.session.getSnapshot().history, historyBefore);
        assert.deepEqual(Object.fromEntries(f.stored), nativeBefore);
        assert.deepEqual(f.rawWrites, []);
        assert.deepEqual(f.rawSends, []);
        assert.equal(result._tag, "err");
        assert.equal(result.error._tag, "StateEditRefused");
        assert.deepEqual(result.error.result, { kind: "rejected", reason: "busy" });

        await f.other.modulation.endGesture();
        const accepted = await f.adapter.commands.deleteSource("mseg-1");
        assert.equal(accepted._tag, "ok");
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === "mseg-1"), false);
        assert.equal(f.session.getSnapshot().fields[key].value.routes.length, 0);
        assert.equal(f.publications.flatMap(publication => publication.operations).filter(operation => operation.kind === "stored" && operation.key === key).length, 1, "one composite deletion accepts exactly one bank edit");
        assert.equal(f.parameters.get("mseg1Morph"), 0);
        assert.deepEqual(JSON.parse(f.stored.get("articulations.v4")).slots[0].routeAmounts, {});
    } finally { await f.stop(); }
});

async function waitForAcceptedDeletion(fixture) {
    const deadline = Date.now() + 2000;
    while (fixture.session.getSnapshot().fields[key].value.routes.length !== 0) {
        assert.ok(Date.now() < deadline, "the production owner must accept the deletion before the lifecycle event");
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(fixture.publications.filter(publication => publication.operations.some(operation => operation.kind === "stored" && operation.key === key)).length, 1);
}

test("disposing the adapter after atomic deletion acceptance prevents stale GUI side effects", async () => {
    const f = await fixture();
    try {
        f.main.holdReplies();
        const deletion = f.adapter.commands.deleteSource("mseg-1");
        await waitForAcceptedDeletion(f);
        assert.equal(f.parameters.get("mseg1Morph"), 0);
        assert.deepEqual(f.rawWrites, []);
        f.adapter.dispose(); // The test's separate view lease keeps the actual client alive.
        f.main.releaseReplies();
        const result = await deletion;
        assert.equal(result._tag, "err");
        assert.equal(result.error._tag, "StateEditRefused");
        assert.equal(result.error.result.kind, "accepted", "known atomic sound-state acceptance survives disposal before the UI receipt");
        assert.equal(f.session.getSnapshot().fields[key].value.routes.length, 0);
        assert.deepEqual(JSON.parse(f.stored.get("articulations.v4")).slots[0].routeAmounts, {});
        assert.equal(f.parameters.get("mseg1Morph"), 0);
        assert.deepEqual(f.rawWrites, []);
        assert.deepEqual(f.rawSends, []);
    } finally { await f.stop(); }
});

test("a restored document cannot receive dependent cleanup from an old held deletion result", async () => {
    const f = await fixture();
    try {
        const artBefore = f.stored.get("articulations.v4");
        f.main.holdReplies();
        const deletion = f.adapter.commands.deleteSource("mseg-1");
        await waitForAcceptedDeletion(f);
        const nextBank = structuredClone(f.bank);
        nextBank.msegSlots[0].shapeA.points[0].y = 0.82;
        await f.restore(nextBank);
        const result = await deletion;
        assert.equal(result._tag, "err");
        assert.deepEqual(result.error.result, { kind: "interrupted", reason: "reset", acceptance: "unknown" });
        f.main.releaseReplies(); // Genuine old receipt must remain unable to resume the operation.
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.adapter.getSnapshot().connection._tag, "ready");
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === "mseg-1"), true);
        assert.deepEqual(f.session.getSnapshot().fields[key].value, nextBank);
        assert.deepEqual(f.session.getSnapshot().history, { canUndo: false, canRedo: false });
        assert.equal(f.stored.get("articulations.v4"), artBefore);
        assert.equal(f.parameters.get("mseg1Morph"), 0.63);
        assert.deepEqual(f.rawWrites, []);
        assert.deepEqual(f.rawSends.filter(send => send.endpoint === "mseg1Morph"), []);
        assert.equal((await f.adapter.commands.undoDeleteSource())._tag, "ok");
        assert.deepEqual(f.session.getSnapshot().fields[key].value, nextBank, "no old deletion backup is armed");
    } finally { await f.stop(); }
});

test("a pending mapping draft cannot authorize an articulation route reference", async () => {
    const f = await fixture();
    try {
        assert.equal((await f.other.modulation.beginGesture()).kind, "accepted");
        const mappingId = "oscB.warpAmount::mseg-1";
        const before = f.stored.get("articulations.v4");
        const adding = f.adapter.commands.addMapping({ targetId: "oscB.warpAmount", sourceId: "mseg-1" });
        assert.equal(f.adapter.getSnapshot().patch.mappings.some(mapping => mapping.id === mappingId), true, "the actual client exposes its pending draft");
        f.adapter.commands.setMappingAmount(mappingId, 45, { _tag: "articulationOverride", articulationId: "articulation-0" });
        assert.equal(f.stored.get("articulations.v4"), before, "a draft route is not an accepted articulation reference");
        assert.deepEqual(f.rawWrites, []);
        const refused = await adding;
        assert.equal(refused._tag, "err");
        assert.deepEqual(refused.error.result, { kind: "rejected", reason: "busy" });
        assert.deepEqual(f.session.getSnapshot().fields[key].value, f.bank);

        await f.other.modulation.endGesture();
        const accepted = await f.adapter.commands.addMapping({ targetId: "oscB.warpAmount", sourceId: "mseg-1" });
        assert.equal(accepted._tag, "ok");
        f.adapter.commands.setMappingAmount(accepted.value, 45, { _tag: "articulationOverride", articulationId: "articulation-0" });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(JSON.parse(f.stored.get("articulations.v4")).slots[0].routeAmounts[mappingId], 0.45);
    } finally { await f.stop(); }
});

test("delete Undo uses the actual shared history head and cannot skip a later Voice edit", async () => {
    const f = await fixture();
    try {
        assert.equal((await f.adapter.commands.deleteSource("mseg-1"))._tag, "ok");
        const deletionEntry = f.session.getSnapshot().history.undoEntry;
        assert.ok(deletionEntry);
        assert.equal((await f.other.client.dispatch({ kind: "edit", key: "globalTune", value: -3 })).kind, "accepted");
        const before = structuredClone(f.adapter.getSnapshot().patch);
        const savedBefore = Object.fromEntries(f.stored);
        f.rawWrites.length = 0; f.rawSends.length = 0;
        const refused = await f.adapter.commands.undoDeleteSource();
        assert.equal(refused._tag, "err");
        assert.deepEqual(refused.error.result, { kind: "rejected", reason: "stale-history" });
        assert.deepEqual(f.adapter.getSnapshot().patch, before);
        assert.deepEqual(Object.fromEntries(f.stored), savedBefore);
        assert.deepEqual(f.rawWrites, []);
        assert.deepEqual(f.rawSends, []);
        assert.equal(f.parameters.get("globalTune"), -3);

        assert.equal((await f.other.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.deepEqual(f.session.getSnapshot().history.undoEntry, deletionEntry);
        assert.equal((await f.adapter.commands.undoDeleteSource())._tag, "ok");
        assert.deepEqual(f.session.getSnapshot().fields[key].value, f.bank);
        assert.equal(f.parameters.get("mseg1Morph"), 0.63);
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === "mseg-1"), true);
        assert.equal(JSON.parse(f.stored.get("articulations.v4")).slots[0].routeAmounts[f.routeId], 0.6);
    } finally { await f.stop(); }
});


test("metadata-only delete Undo refuses a pending real bank command before any dependent effects", async () => {
    const f = await fixture();
    try {
        const created = await f.adapter.commands.createSource("macro");
        assert.equal(created._tag, "ok");
        assert.equal(created.value, "macro-2");
        assert.equal((await f.adapter.commands.deleteSource(created.value))._tag, "ok");
        assert.equal(f.session.getSnapshot().history.canUndo, false, "unchanged bank data creates no history entry");
        const hidden = structuredClone(f.adapter.getSnapshot().patch);
        const changed = structuredClone(f.bank);
        changed.msegSlots[0].shapeA.points[0].y = 0.72;
        f.main.holdCommands();
        const pending = f.lease.modulation.setState(changed);
        assert.deepEqual(f.lease.client.getSnapshot().pendingFields, [key]);
        assert.deepEqual(f.session.getSnapshot().fields[key].value, f.bank, "the real edit request has not reached the owner yet");
        f.rawSends.length = 0; f.rawWrites.length = 0;
        const refused = await f.adapter.commands.undoDeleteSource();
        assert.equal(refused._tag, "err");
        assert.deepEqual(refused.error.result, { kind: "rejected", reason: "busy" });
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === created.value), false);
        assert.deepEqual(f.rawSends, []);
        assert.deepEqual(f.rawWrites, []);
        f.main.releaseCommands();
        assert.equal((await pending).kind, "accepted");
        assert.deepEqual(f.session.getSnapshot().fields[key].value, changed);
        const stale = await f.adapter.commands.undoDeleteSource();
        assert.equal(stale._tag, "err");
        assert.deepEqual(stale.error.result, { kind: "rejected", reason: "stale-history" });
        assert.equal(hidden.sources.some(source => source.id === created.value), false);
    } finally { f.main.releaseCommands(); await f.stop(); }
});

test("metadata-only delete Undo follows the shared gesture lock before restoring local presentation", async () => {
    const f = await fixture();
    try {
        const created = await f.adapter.commands.createSource("macro");
        assert.equal(created._tag, "ok");
        assert.equal((await f.adapter.commands.deleteSource(created.value))._tag, "ok");
        assert.equal((await f.other.client.dispatch({ kind: "begin", key: "globalTune", gesture: 1 })).kind, "accepted");
        f.rawSends.length = 0; f.rawWrites.length = 0;
        const refused = await f.adapter.commands.undoDeleteSource();
        assert.equal(refused._tag, "err");
        assert.deepEqual(refused.error.result, { kind: "rejected", reason: "busy" });
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === created.value), false);
        assert.deepEqual(f.rawSends, []);
        assert.deepEqual(f.rawWrites, []);
        assert.equal((await f.other.client.dispatch({ kind: "end", key: "globalTune", gesture: 1 })).kind, "accepted");
        assert.equal((await f.adapter.commands.undoDeleteSource())._tag, "ok");
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === created.value), true);
        assert.deepEqual(f.session.getSnapshot().fields[key].value, f.bank);
        assert.equal(f.session.getSnapshot().history.canUndo, false);
    } finally { await f.stop(); }
});


test("a reset queued immediately after a genuine receipt prevents cleanup across the helper's second await", async () => {
    const f = await fixture();
    try {
        const beforeArticulation = f.stored.get("articulations.v4");
        const replacement = structuredClone(f.bank);
        replacement.msegSlots[0].shapeA.points[0].y = 0.91;
        const restored = new Promise((resolve, reject) => {
            // Delivery first resolves editBank's actual client ticket. Queue the
            // native reset next, before that helper's caller can resume. The
            // replacement/attach snapshots still come from the real session.
            f.main.afterNextReceipt(() => { f.restore(replacement).then(resolve, reject); });
        });
        const deletion = await f.adapter.commands.deleteSource("mseg-1");
        await restored;
        assert.equal(f.lease.client.getSnapshot().state.scope.document, 2);
        assert.deepEqual(f.session.getSnapshot().fields[key].value, replacement);
        assert.equal(f.parameters.get("mseg1Morph"), 0.63, "old accepted cleanup cannot write native parameters in the replacement document");
        assert.equal(f.stored.get("articulations.v4"), beforeArticulation);
        assert.deepEqual(f.rawWrites, []);
        assert.deepEqual(f.rawSends.filter(send => send.endpoint === "mseg1Morph"), []);
        assert.equal(f.adapter.getSnapshot().patch.sources.some(source => source.id === "mseg-1"), true);
        assert.equal(deletion._tag, "err");
        assert.equal(deletion.error.result.kind, "accepted", "the earlier bank acceptance remains known");
        assert.equal((await f.adapter.commands.undoDeleteSource())._tag, "ok");
        assert.deepEqual(f.session.getSnapshot().fields[key].value, replacement);
    } finally { await f.stop(); }
});
