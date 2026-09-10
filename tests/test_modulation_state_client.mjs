import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const bundled = await build({ stdin: { contents: `
export { createModulationStateClient } from "./ui/shared/modulation-client";
export { createDefaultModulationState, createDefaultRoute, MODULATION_STATE_KEY } from "./ui/shared/modulation";
export { modulationStateCodec } from "./ui/shared/synth-modulation-state";
export { createPluginStateClient } from "./kit/ui/plugin-state-client";
export { createPluginStateSession } from "./kit/ui/plugin-state-session";
export { definePluginState, parameter, storedValue } from "./kit/ui/plugin-state-definition";
export { subscribeToUserEdits, runProgrammaticWrites } from "./kit/ui/user-edit-bus";
`, resolveDir: root }, bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const key = api.MODULATION_STATE_KEY;

// The external channel only relays real session/client messages. No fixture
// accepts edits, groups history, normalizes domain data or supplies edit results.
async function fixture(routes = []) {
    const definition = api.definePluginState({ [key]: api.storedValue({ initial: api.createDefaultModulationState(), codec: api.modulationStateCodec }),
        globalTune: api.parameter("globalTune") });
    const boot = api.createDefaultModulationState();
    boot.routes = routes;
    boot.msegSlots[0].shapeB.points = [{ x: 0, y: 0.2, curvePower: 0 }, { x: 1, y: 0.8, curvePower: 0 }];
    let scope = { owner: "actual-modulation-client", document: 0 };
    const listeners = new Map(), clients = [], jobs = [], publications = [], defects = [];
    let holdEnd = false;
    const heldAddresses = new Set(), heldReplies = [];
    const session = api.createPluginStateSession(definition, { native: {
        publish(publication) { publications.push(publication); }, close() {},
        update(state, receipt) {
            const message = { kind: "update", scope, revision: state.revision, state, ...(receipt ? { receipt } : {}) };
            if (receipt && heldAddresses.has(`${receipt.address.client}:${receipt.address.sequence}`)) {
                heldReplies.push({ kind: "receipt", address: receipt.address, result: receipt.result });
                for (const receive of listeners.values()) receive({ kind: "update", scope, revision: state.revision, state });
            } else for (const receive of listeners.values()) receive(message);
        },
    }, onDefect: error => defects.push(error) });
    await session.dispatch({ kind: "opened", scope, native: { values: { [key]: JSON.stringify(boot) },
        parameters: [{ endpoint: "globalTune", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 0 }] } });
    const createClient = () => {
        const id = clients.length + 1;
        const client = api.createPluginStateClient(definition, { channel: {
            subscribe(receive) { listeners.set(id, receive); return () => listeners.delete(id); },
            send(message) {
                if (message.kind === "attach") {
                    const state = session.getSnapshot();
                    listeners.get(id)?.({ kind: "attached", request: message.request, scope, client: id, revision: state.revision, state });
                } else {
                    if (holdEnd && message.command.kind === "end") { holdEnd = false; heldAddresses.add(`${message.client}:${message.sequence}`); }
                    jobs.push(Promise.resolve().then(() => session.dispatch({ kind: "command",
                        address: { ...message.scope, client: message.client, sequence: message.sequence }, command: message.command })));
                }
            },
        }, onDefect: error => defects.push(error) });
        clients.push(client); return client;
    };
    const client = createClient();
    return { boot, client, createClient, session, publications, defects,
        holdNextEnd() { holdEnd = true; },
        async drain() { await Promise.all(jobs); },
        releaseReplies() { for (const reply of heldReplies.splice(0)) for (const receive of listeners.values()) receive(reply); },
        async replace(value = JSON.stringify(boot), changedStoredKey) {
            scope = { ...scope, document: scope.document + 1 };
            await session.dispatch({ kind: "replaced", scope, ...(changedStoredKey ? { changedStoredKey } : {}), native: {
                values: { [key]: value }, parameters: [{ endpoint: "globalTune", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 0 }],
            } });
            for (const receive of listeners.values()) receive({ kind: "reset", scope });
        },
        async stop() { for (const client of clients) client.stop(); await Promise.all(jobs); await session.stop(); assert.deepEqual(defects, []); } };
}

test("MSEG B drafts and grouped edits use the actual client and share Undo with an interleaved Voice scalar", async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    try {
        assert.deepEqual(bridge.getState(), f.boot);
        assert.equal(bridge.isReady(), true);
        bridge.setMsegSlotEditShapeIndex(0, 1);
        assert.equal(bridge.getMsegSlotEditShapeIndex(0), 1);
        assert.deepEqual(bridge.getMsegSlotController(0).getState().shape, f.boot.msegSlots[0].shapeB);
        assert.equal((await bridge.beginGesture()).kind, "accepted");
        const first = { ...f.boot.msegSlots[0].shapeB, points: [
            { x: 0, y: 0.2, curvePower: 0 }, { x: 0.5, y: 0.4, curvePower: 0 }, { x: 1, y: 0.8, curvePower: 0 }] };
        const pending = bridge.getMsegSlotController(0).setShape(first);
        assert.deepEqual(bridge.getState().msegSlots[0].shapeB, first, "the facade reads the actual immediate client draft");
        assert.deepEqual(f.session.getSnapshot().fields[key].value.msegSlots[0].shapeB, f.boot.msegSlots[0].shapeB, "the external command has not reached the owner yet");
        assert.equal((await pending).kind, "accepted");
        assert.equal((await f.client.dispatch({ kind: "edit", key: "globalTune", value: 4 })).kind, "accepted");
        const second = { ...first, points: first.points.map((point, index) => index === 1 ? { ...point, y: 0.7 } : point) };
        assert.equal((await bridge.getMsegSlotController(0).setShape(second)).kind, "accepted");
        const ended = await bridge.endGesture();
        assert.equal(ended.kind, "accepted");
        assert.ok(ended.historyEntry);
        assert.deepEqual(bridge.getState().msegSlots[0].shapeA, f.boot.msegSlots[0].shapeA);
        assert.deepEqual(bridge.getState().msegSlots[0].shapeB, second);
        assert.equal((await f.client.dispatch({ kind: "undo", expectedEntry: ended.historyEntry })).kind, "accepted");
        assert.deepEqual(bridge.getState(), f.boot, "one owner Undo restores both B edits as a group");
        assert.equal(f.client.getSnapshot().state.fields.globalTune.value, 4);
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.equal(f.client.getSnapshot().state.fields.globalTune.value, 2.5);
        assert.equal(f.client.getSnapshot().state.history.canUndo, false);
        const writes = f.publications.flatMap(publication => publication.operations).filter(operation => operation.kind === "stored");
        assert.equal(writes.length, 3);
        assert.ok(writes.every(write => write.key === key && typeof write.value === "string"));
        const bankWithB = shape => ({ ...f.boot, msegSlots: f.boot.msegSlots.map((slot, index) => index === 0 ? { ...slot, shapeB: shape } : slot) });
        assert.deepEqual(writes.map(write => write.value), [JSON.stringify(bankWithB(first)), JSON.stringify(bankWithB(second)), JSON.stringify(f.boot)]);
    } finally { await bridge.stop(); await f.stop(); }
});

test("another client's gesture rejects the optimistic B draft and only accepted changed edits reach the edit bus", async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    const other = f.createClient();
    const edits = [];
    const unsubscribe = api.subscribeToUserEdits({ onParameterEdit: edit => edits.push(edit) });
    try {
        assert.equal((await other.dispatch({ kind: "begin", key, gesture: 81 })).kind, "accepted");
        const proposed = { ...f.boot.msegSlots[0].shapeB, points: f.boot.msegSlots[0].shapeB.points.map(point => ({ ...point, y: 0.5 })) };
        const rejected = bridge.setMsegSlotShape(0, 1, proposed);
        assert.deepEqual(bridge.getState().msegSlots[0].shapeB, proposed);
        assert.deepEqual(edits, [], "a local optimistic draft is not accepted user-edit evidence");
        assert.deepEqual(await rejected, { kind: "rejected", reason: "busy" });
        assert.deepEqual(bridge.getState(), f.boot);
        assert.deepEqual(edits, []);
        assert.equal((await other.dispatch({ kind: "end", key, gesture: 81 })).kind, "accepted");
        const accepted = bridge.setMsegSlotShape(0, 1, proposed);
        assert.deepEqual(edits, []);
        assert.equal((await accepted).changed, true);
        assert.deepEqual(edits, [{ endpointID: "msegShape.0.1", changed: true }]);
        assert.equal((await bridge.setMsegSlotShape(0, 1, structuredClone(proposed))).changed, false);
        assert.equal(edits.length, 1);
        const muted = api.runProgrammaticWrites(() => bridge.setMsegSlotShape(0, 1, f.boot.msegSlots[0].shapeB));
        assert.equal((await muted).changed, true);
        assert.equal(edits.length, 1, "programmatic suppression is captured at submission, before the asynchronous receipt");
    } finally { unsubscribe(); await bridge.stop(); await f.stop(); }
});

test("changing the MSEG edit side seals its accepted group before later edits and stopping seals only this facade", async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    try {
        bridge.setMsegSlotEditShapeIndex(0, 1);
        assert.equal((await bridge.beginGesture()).kind, "accepted");
        const b = { ...f.boot.msegSlots[0].shapeB, points: f.boot.msegSlots[0].shapeB.points.map(point => ({ ...point, y: 0.6 })) };
        assert.equal((await bridge.getMsegSlotController(0).setShape(b)).changed, true);
        await bridge.setMsegSlotEditShapeIndex(0, 0);
        assert.equal(f.session.getSnapshot().fields[key].gesture, undefined, "switching edit side ends the old interaction at the real owner");
        assert.equal((await bridge.beginGesture()).kind, "accepted");
        const a = { ...f.boot.msegSlots[0].shapeA, points: f.boot.msegSlots[0].shapeA.points.map(point => ({ ...point, y: 0.3 })) };
        assert.equal((await bridge.getMsegSlotController(0).setShape(a)).changed, true);
        const stopping = bridge.stop();
        assert.strictEqual(bridge.stop(), stopping, "teardown owns one end command and one completion");
        assert.equal((await stopping).kind, "accepted");
        assert.equal(f.session.getSnapshot().fields[key].gesture, undefined);
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.deepEqual(f.client.getSnapshot().state.fields[key].value.msegSlots[0].shapeA, f.boot.msegSlots[0].shapeA);
        assert.deepEqual(f.client.getSnapshot().state.fields[key].value.msegSlots[0].shapeB, b);
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.deepEqual(f.client.getSnapshot().state.fields[key].value, f.boot);
        assert.equal((await f.client.dispatch({ kind: "edit", key: "globalTune", value: -2 })).kind, "accepted", "facade teardown must leave the shared client usable");
    } finally { await bridge.stop(); await f.stop(); }
});

test("derived notifications distinguish route amounts, selection and structural changes without duplicating accepted drafts", async () => {
    const first = api.createDefaultRoute({ id: "route-first", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.25 });
    const second = api.createDefaultRoute({ id: "route-second", sourceKind: "env", sourceSlot: 2, targetKind: "oscA.pan", amount: -0.5 });
    const f = await fixture([first, second]);
    const bridge = api.createModulationStateClient(f.client);
    const changes = [], firstAmounts = [], secondAmounts = [];
    const listener = (state, kind) => changes.push({ state, kind });
    try {
        bridge.subscribe(listener);
        const removeFirst = bridge.subscribeRouteAmount(first.id, amount => firstAmounts.push(amount));
        bridge.subscribeRouteAmount(second.id, amount => secondAmounts.push(amount));
        assert.equal(bridge.getRouteAmount(first.id), 0.25);
        const amount = bridge.setRouteAmountById(first.id, 0.75);
        assert.equal(bridge.getRouteAmount(first.id), 0.75, "stable-ID reads immediately follow the client draft");
        assert.deepEqual(firstAmounts, [0.75]);
        assert.deepEqual(secondAmounts, []);
        assert.equal((await amount).kind, "accepted");
        assert.deepEqual(changes.map(change => change.kind), ["routeAmount"], "receipt acceptance must not emit the same optimistic value twice");
        await bridge.setMsegSlotEditShapeIndex(0, 1);
        await bridge.setMsegSlotEditShapeIndex(0, 1);
        assert.deepEqual(changes.map(change => change.kind), ["routeAmount", "general"]);
        assert.deepEqual(firstAmounts, [0.75], "selection is presentation, not a changed route amount");
        const reordered = { ...bridge.getState(), routes: [...bridge.getState().routes].reverse() };
        assert.equal((await bridge.setState(reordered)).kind, "accepted");
        assert.deepEqual(changes.map(change => change.kind), ["routeAmount", "general", "general"]);
        assert.equal((await bridge.setRouteAmountById(first.id, -0.25)).kind, "accepted");
        assert.equal(bridge.getState().routes[1].id, first.id);
        assert.equal(bridge.getState().routes[1].amount, -0.25);
        assert.deepEqual(firstAmounts, [0.75, -0.25]);
        assert.equal((await bridge.setState({ ...bridge.getState(), routes: [bridge.getState().routes[0]] })).kind, "accepted");
        assert.equal(bridge.getRouteAmount(first.id), null);
        assert.deepEqual(firstAmounts, [0.75, -0.25, null]);
        removeFirst(); bridge.unsubscribe(listener);
        const count = changes.length;
        await bridge.stop();
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.equal(changes.length, count);
        assert.deepEqual(firstAmounts, [0.75, -0.25, null]);
        assert.deepEqual(secondAmounts, []);
    } finally { await bridge.stop(); await f.stop(); }
});

test("document replacement revokes the local interaction and invalid retained display never becomes editable history", async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    try {
        assert.equal((await bridge.beginGesture()).kind, "accepted");
        const edited = { ...f.boot.msegSlots[0].shapeB, points: f.boot.msegSlots[0].shapeB.points.map(point => ({ ...point, y: 0.4 })) };
        assert.equal((await bridge.setMsegSlotShape(0, 1, edited)).changed, true);
        await f.replace();
        assert.deepEqual(bridge.getState(), f.boot);
        assert.equal((await bridge.beginGesture()).kind, "accepted", "an old document's local gesture cannot block a new owner interaction");
        assert.equal((await bridge.endGesture()).kind, "accepted");
        await f.replace("malformed live stored document", key);
        assert.equal(bridge.isReady(), false);
        assert.deepEqual(bridge.getState(), f.boot, "retained display is distinct from editable readiness");
        const writesBefore = f.publications.length;
        assert.deepEqual(await bridge.setMsegSlotShape(0, 1, edited), { kind: "rejected", reason: "not-ready" });
        assert.equal(f.publications.length, writesBefore, "invalid display cannot trigger a repair write");
        const recovered = await bridge.setState(f.boot);
        assert.equal(recovered.kind, "accepted");
        assert.equal(recovered.changed, true);
        assert.equal(recovered.historyEntry, undefined, "first recovery creates no before-value history from failed display");
        assert.equal(bridge.isReady(), true);
        assert.equal(f.client.getSnapshot().state.history.canUndo, false);
    } finally { await bridge.stop(); await f.stop(); }
});

test("a delayed earlier editor's real end receipt retains its own guarded history reference", { timeout: 5000 }, async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    try {
        await bridge.setMsegSlotEditShapeIndex(0, 1);
        await bridge.beginGesture();
        const b = { ...f.boot.msegSlots[0].shapeB, points: f.boot.msegSlots[0].shapeB.points.map(point => ({ ...point, y: 0.6 })) };
        assert.equal((await bridge.getMsegSlotController(0).setShape(b)).changed, true);
        f.holdNextEnd();
        const oldCompletion = bridge.endGesture();
        await f.drain();
        assert.equal(f.session.getSnapshot().fields[key].gesture, undefined);
        const oldEntry = f.session.getSnapshot().history.undoEntry;
        assert.ok(oldEntry, "the actual owner has sealed the old edit before its receipt is released");
        await bridge.setMsegSlotEditShapeIndex(0, 0);
        await bridge.beginGesture();
        const a = { ...f.boot.msegSlots[0].shapeA, points: f.boot.msegSlots[0].shapeA.points.map(point => ({ ...point, y: 0.3 })) };
        assert.equal((await bridge.getMsegSlotController(0).setShape(a)).changed, true);
        const currentCompletion = await bridge.endGesture();
        assert.equal(currentCompletion.kind, "accepted");
        assert.notDeepEqual(currentCompletion.historyEntry, oldEntry);
        f.releaseReplies();
        const oldResult = await oldCompletion;
        assert.equal(oldResult.kind, "accepted");
        assert.deepEqual(oldResult.historyEntry, oldEntry);
        assert.equal(bridge.getMsegSlotEditShapeIndex(0), 0);
        assert.deepEqual(f.client.getSnapshot().state.history.undoEntry, currentCompletion.historyEntry);
        assert.deepEqual(await f.client.dispatch({ kind: "undo", expectedEntry: oldResult.historyEntry }), { kind: "rejected", reason: "stale-history" });
        assert.equal((await f.client.dispatch({ kind: "undo", expectedEntry: currentCompletion.historyEntry })).kind, "accepted");
        assert.deepEqual(bridge.getState().msegSlots[0].shapeA, f.boot.msegSlots[0].shapeA);
        assert.deepEqual(bridge.getState().msegSlots[0].shapeB, b);
    } finally { f.releaseReplies(); await bridge.stop(); await f.stop(); }
});

test("the MSEG controller retains existing point geometry and keeps playback rate out of structured storage", async () => {
    const f = await fixture();
    const bridge = api.createModulationStateClient(f.client);
    try {
        const controller = bridge.getMsegSlotController(1);
        await controller.setEditShapeIndex(1);
        const originalA = structuredClone(controller.getState().shapeA);
        assert.equal((await controller.addPoint(0.5, 0.7)).changed, true);
        assert.equal(controller.getState().shape.points.length, 3);
        assert.equal((await controller.movePoint(1, 0.4, 0.6)).changed, true);
        assert.deepEqual(controller.getState().shape.points[1], { x: 0.4, y: 0.6, curvePower: 0 });
        assert.equal((await controller.setSegmentCurvePower(0, 2.5)).changed, true);
        assert.equal(controller.getState().shape.points[0].curvePower, 2.5);
        assert.equal((await controller.deletePoint(1)).changed, true);
        assert.equal(controller.getState().shape.points.length, 2);
        assert.deepEqual(controller.getState().shapeA, originalA);
        const displayed = controller.getState().playback;
        assert.equal((await controller.setPlayback({ ...displayed, rate: { kind: "seconds", seconds: 25 }, noteOffPolicy: "ignore", legatoRestarts: true })).changed, true);
        const stored = bridge.getState().msegSlots[1].playback;
        assert.equal(Object.hasOwn(stored, "rate"), false);
        assert.equal(stored.noteOffPolicy, "ignore");
        assert.equal(stored.legatoRestarts, true);
        assert.deepEqual(controller.getState().playback.rate, displayed.rate, "the editor's compatibility projection uses the existing parameter-owned rate default");
        assert.deepEqual(bridge.getState().msegSlots[0], f.boot.msegSlots[0]);
    } finally { await bridge.stop(); await f.stop(); }
});

test("only an explicit local route-amount submission emits routeAmount; whole documents and other clients stay general", async () => {
    const route = api.createDefaultRoute({ id: "origin-route", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.25 });
    const f = await fixture([route]);
    const bridge = api.createModulationStateClient(f.client);
    const other = f.createClient();
    const kinds = [], amounts = [];
    try {
        bridge.subscribe((_state, kind) => kinds.push(kind));
        bridge.subscribeRouteAmount(route.id, amount => amounts.push(amount));
        assert.equal((await bridge.setRouteAmountById(route.id, 0.5)).kind, "accepted");
        assert.deepEqual(kinds, ["routeAmount"]);
        assert.equal((await bridge.setState({ ...bridge.getState(), routes: [{ ...route, amount: 0.6 }] })).kind, "accepted");
        assert.deepEqual(kinds, ["routeAmount", "general"], "whole-document writes preserve the legacy general notification even for an amount-only delta");
        assert.equal((await other.dispatch({ kind: "edit", key, value: { ...bridge.getState(), routes: [{ ...route, amount: 0.7 }] } })).kind, "accepted");
        assert.deepEqual(kinds, ["routeAmount", "general", "general"]);
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.deepEqual(kinds, ["routeAmount", "general", "general", "general"]);
        assert.equal((await other.dispatch({ kind: "begin", key, gesture: 97 })).kind, "accepted");
        assert.deepEqual(await bridge.setRouteAmountById(route.id, -0.4), { kind: "rejected", reason: "busy" });
        assert.deepEqual(kinds, ["routeAmount", "general", "general", "general", "routeAmount", "general"], "only the optimistic local change carries its hint; authoritative rollback cannot inherit it");
        assert.deepEqual(amounts, [0.5, 0.6, 0.7, 0.6, -0.4, 0.6]);
        assert.equal((await other.dispatch({ kind: "end", key, gesture: 97 })).kind, "accepted");
    } finally { await bridge.stop(); await f.stop(); }
});

test("route additions return identity only after acceptance and duplicate identities or pairs cannot alter state or history", async () => {
    const first = api.createDefaultRoute({ id: "route-owner", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.25 });
    const f = await fixture([first]);
    const bridge = api.createModulationStateClient(f.client);
    try {
        const next = api.createDefaultRoute({ id: "route-added", sourceKind: "env", sourceSlot: 2, targetKind: "oscA.pan", amount: 0.5 });
        const adding = bridge.addRoute(next);
        assert.deepEqual(bridge.getState().routes, [first, next]);
        assert.deepEqual(f.session.getSnapshot().fields[key].value.routes, [first], "returned promise is pending until the actual owner receives the proposal");
        const added = await adding;
        assert.equal(added.kind, "accepted");
        assert.equal(added.changed, true);
        assert.equal(added.routeId, next.id);
        assert.ok(added.historyEntry);
        const accepted = f.session.getSnapshot();
        const writes = f.publications.length;
        for (const attempt of [
            () => bridge.addRoute({ ...next, id: first.id }),
            () => bridge.addRoute({ ...first, id: "different-id-same-pair" }),
            () => bridge.setRoute(1, { ...next, id: first.id }),
            () => bridge.setRoute(1, { ...first, id: next.id }),
            () => bridge.replaceRoutes([first, { ...first, id: next.id }]),
        ]) {
            const result = await attempt();
            assert.deepEqual(result, { kind: "rejected", reason: "invalid-value" });
            assert.equal(Object.hasOwn(result, "routeId"), false);
            assert.strictEqual(f.session.getSnapshot(), accepted);
            assert.deepEqual(bridge.getState().routes, [first, next]);
            assert.equal(f.publications.length, writes);
        }
        const other = f.createClient();
        assert.equal((await other.dispatch({ kind: "begin", key, gesture: 110 })).kind, "accepted");
        const blocked = api.createDefaultRoute({ id: "busy-candidate", sourceKind: "env", sourceSlot: 3, targetKind: "oscA.pan", amount: 0.7 });
        const proposal = bridge.addRoute(blocked);
        assert.equal(bridge.getState().routes.at(-1).id, blocked.id);
        assert.deepEqual(await proposal, { kind: "rejected", reason: "busy" });
        assert.deepEqual(bridge.getState().routes, [first, next]);
        assert.equal(f.publications.length, writes);
        await other.dispatch({ kind: "end", key, gesture: 110 });
        assert.equal((await f.client.dispatch({ kind: "undo", expectedEntry: added.historyEntry })).kind, "accepted");
        assert.deepEqual(bridge.getState().routes, [first]);
    } finally { await bridge.stop(); await f.stop(); }
});

test("generated additions avoid occupied identities, reuse a removed pair, and Undo restores the original route identity", async () => {
    const existing = api.createDefaultRoute({ id: "mod-route-auto-1", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.2 });
    const f = await fixture([existing]);
    const bridge = api.createModulationStateClient(f.client);
    try {
        const shape = { sourceKind: "env", sourceSlot: 2, targetKind: "oscA.pan", amount: 0.4 };
        const first = await bridge.addGeneratedRoute(shape);
        assert.equal(first.kind, "accepted");
        assert.equal(first.changed, true);
        assert.notEqual(first.routeId, existing.id);
        assert.equal(bridge.getState().routes[1].id, first.routeId);
        assert.equal((await bridge.removeRoute(1)).changed, true);
        assert.deepEqual(bridge.getState().routes, [existing]);
        const next = await bridge.addGeneratedRoute(shape);
        assert.equal(next.kind, "accepted");
        assert.notEqual(next.routeId, existing.id);
        assert.notEqual(next.routeId, first.routeId, "the existing generator assigns a fresh identity; removal frees the source-target pair");
        assert.equal(bridge.getState().routes[1].id, next.routeId);
        assert.equal((await f.client.dispatch({ kind: "undo", expectedEntry: next.historyEntry })).kind, "accepted");
        assert.deepEqual(bridge.getState().routes, [existing]);
        assert.equal((await f.client.dispatch({ kind: "undo" })).kind, "accepted");
        assert.equal(bridge.getState().routes[1].id, first.routeId);
        assert.equal(bridge.getState().routes[1].amount, shape.amount);
        const beforeInvalid = f.session.getSnapshot();
        assert.deepEqual(await bridge.removeRoute(-1), { kind: "rejected", reason: "not-ready" });
        assert.deepEqual(await bridge.removeRoute(0.5), { kind: "rejected", reason: "not-ready" });
        assert.deepEqual(await bridge.removeRoute(99), { kind: "rejected", reason: "not-ready" });
        assert.strictEqual(f.session.getSnapshot(), beforeInvalid);
    } finally { await bridge.stop(); await f.stop(); }
});

test("remaining domain mutations preserve route normalization, notification origin and parameter-owned envelope values", async () => {
    const first = api.createDefaultRoute({ id: "domain-first", sourceKind: "env", sourceSlot: 1, targetKind: "oscA.pan", amount: 0.2 });
    const second = api.createDefaultRoute({ id: "domain-second", sourceKind: "env", sourceSlot: 2, targetKind: "oscA.pan", amount: 0.4 });
    const f = await fixture([first, second]);
    const bridge = api.createModulationStateClient(f.client);
    const kinds = [];
    try {
        bridge.subscribe((_state, kind) => kinds.push(kind));
        assert.equal((await bridge.replaceRoutes([second, first])).changed, true);
        assert.deepEqual(bridge.getState().routes, [second, first]);
        assert.equal((await bridge.setRoute(0, { ...second, enabled: false, polarity: "bipolar", reducer: "mean" })).changed, true);
        assert.deepEqual(bridge.getState().routes[0], { ...second, enabled: false, polarity: "bipolar", reducer: "mean" });
        assert.equal((await bridge.setRouteAmount(0, 9)).changed, true);
        assert.equal(bridge.getState().routes[0].amount, 1);
        assert.equal(bridge.getState().routes[1].amount, first.amount);
        assert.deepEqual(kinds, ["general", "general", "routeAmount"]);
        assert.equal((await bridge.setEnvelope(1, { name: "Structured label", attackSeconds: 12, decaySeconds: 8, sustain: 0.1, releaseSeconds: 5 })).changed, true);
        assert.deepEqual(bridge.getState().envelopeSlots[1], { name: "Structured label" });
        assert.deepEqual(bridge.getState().envelopeSlots[0], f.boot.envelopeSlots[0]);
        assert.deepEqual(bridge.getState().msegSlots, f.boot.msegSlots);
        assert.equal(f.client.getSnapshot().state.fields.globalTune.value, 2.5);
        const before = f.session.getSnapshot();
        const publications = f.publications.length;
        assert.equal((await bridge.setEnvelope(1, { name: "Structured label", attackSeconds: 0.001 })).changed, false);
        assert.equal((await bridge.setRoute(0, structuredClone(bridge.getState().routes[0]))).changed, false);
        assert.deepEqual(await bridge.setEnvelope(99, { name: "bad index" }), { kind: "rejected", reason: "not-ready" });
        assert.deepEqual(await bridge.setRouteAmount(-1, 0.1), { kind: "rejected", reason: "not-ready" });
        assert.strictEqual(f.session.getSnapshot(), before);
        assert.equal(f.publications.length, publications);
        assert.deepEqual(kinds, ["general", "general", "routeAmount", "general"]);
    } finally { await bridge.stop(); await f.stop(); }
});
