import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { definePluginState, storedValue, parameter } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createPluginStateSession } = await loadUIModule(root, "kit/ui/plugin-state-session.ts");
const { parseServiceMessage, parseClientMessage, encodeStateSnapshot } = await loadUIModule(root, "kit/ui/plugin-state-protocol.ts");
const { createPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-client.ts");
const codec = {
    parse(value) {
        return Array.isArray(value) && value.length >= 2 && value.every(point => typeof point === "number" && Number.isFinite(point))
            ? { kind: "ok", value: Object.freeze([...value]) }
            : { kind: "error", message: "Expected finite curve points." };
    },
    encode(value) { return [...value]; },
    equals(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); },
};
const definition = definePluginState({ curve: storedValue({ initial: [0, 1], codec }), gain: parameter("gain") });
const initialNative = () => ({ values: {}, parameters: [
    { endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
] });

async function openSession(options = {}) {
    const scope = { owner: "history-owner", document: 0 };
    const native = {
        publications: [], updates: [],
        publish(value) { this.publications.push(value); },
        update(snapshot, receipt) { this.updates.push({ snapshot, receipt }); options.onUpdate?.(snapshot, receipt); },
        close() {},
    };
    const session = createPluginStateSession(definition, { native, onDefect: options.onDefect ?? (error => assert.fail(String(error))) });
    await session.dispatch({ kind: "opened", scope, native: initialNative() });
    const sequences = new Map();
    const command = (command, client = 1) => {
        const sequence = (sequences.get(client) ?? 0) + 1;
        sequences.set(client, sequence);
        return session.dispatch({ kind: "command", address: { ...session.getSnapshot().scope, client, sequence }, command });
    };
    return { scope, session, native, command };
}

function assertReference(reference, scope) {
    assert.ok(reference, "a real history entry must have an opaque reference");
    assert.deepEqual(reference.scope, scope);
    assert.equal(Number.isSafeInteger(reference.id) && reference.id > 0, true);
}

test("a stored edit returns the same document-scoped reference moved by guarded Undo and Redo", async () => {
    const { session, native, scope, command } = await openSession();
    try {
        assert.equal(session.getSnapshot().history.undoEntry, undefined);
        const result = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        assert.equal(result.kind, "accepted");
        assert.equal(result.changed, true);
        assertReference(result.historyEntry, scope);
        assert.deepEqual(session.getSnapshot().history.undoEntry, result.historyEntry);
        assert.equal(session.getSnapshot().history.canUndo, true);
        assert.deepEqual(native.updates.at(-1).receipt.result.historyEntry, result.historyEntry);

        const undone = await command({ kind: "undo", expectedEntry: result.historyEntry });
        assert.equal(undone.kind, "accepted");
        assert.equal(undone.historyEntry, undefined, "moving an entry does not create a new one");
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 1]);
        assert.equal(session.getSnapshot().history.undoEntry, undefined);
        assert.deepEqual(session.getSnapshot().history.redoEntry, result.historyEntry);
        assert.equal(session.getSnapshot().history.canUndo, false);
        assert.equal(session.getSnapshot().history.canRedo, true);
        const emptyHead = session.getSnapshot();
        const writes = native.publications.length;
        assert.deepEqual(await command({ kind: "undo", expectedEntry: result.historyEntry }),
            { kind: "rejected", reason: "stale-history" });
        assert.strictEqual(session.getSnapshot(), emptyHead);
        assert.equal(native.publications.length, writes);

        assert.equal((await command({ kind: "redo", expectedEntry: result.historyEntry })).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(session.getSnapshot().history.undoEntry, result.historyEntry);
        assert.equal(session.getSnapshot().history.redoEntry, undefined);
        assert.equal(session.getSnapshot().history.canRedo, false);
        assert.deepEqual(native.publications.map(publication => publication.operations), [
            [{ kind: "stored", key: "curve", value: [0, 0.4, 1] }],
            [{ kind: "stored", key: "curve", value: [0, 1] }],
            [{ kind: "stored", key: "curve", value: [0, 0.4, 1] }],
        ]);
    } finally { await session.stop(); }
});

test("a stale Undo head is rejected without consuming history or publishing an unrelated field", async () => {
    const { session, native, command } = await openSession();
    try {
        const first = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] }, 1);
        const second = await command({ kind: "edit", key: "gain", value: 5 }, 2);
        assertReference(first.historyEntry, session.getSnapshot().scope);
        assertReference(second.historyEntry, session.getSnapshot().scope);
        assert.notDeepEqual(first.historyEntry, second.historyEntry);
        const before = session.getSnapshot();
        const publicationCount = native.publications.length;
        assert.deepEqual(await command({ kind: "undo", expectedEntry: first.historyEntry }, 1),
            { kind: "rejected", reason: "stale-history" });
        assert.strictEqual(session.getSnapshot(), before, "guard rejection preserves values, versions, readiness, and history projection");
        assert.equal(native.publications.length, publicationCount);
        assert.equal((await command({ kind: "undo", expectedEntry: second.historyEntry }, 1)).kind, "accepted");
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(session.getSnapshot().history.undoEntry, first.historyEntry);
        assert.deepEqual(session.getSnapshot().history.redoEntry, second.historyEntry);
        const beforeStaleRedo = session.getSnapshot();
        assert.deepEqual(await command({ kind: "redo", expectedEntry: first.historyEntry }),
            { kind: "rejected", reason: "stale-history" });
        assert.strictEqual(session.getSnapshot(), beforeStaleRedo);
        assert.equal((await command({ kind: "redo", expectedEntry: second.historyEntry })).kind, "accepted");
        assert.equal(session.getSnapshot().fields.gain.value, 5);
    } finally { await session.stop(); }
});

test("history guards retain document identity even when a new client addresses the current replacement", async () => {
    const { session, native, scope, command } = await openSession();
    try {
        const previous = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        const nextScope = { owner: scope.owner, document: scope.document + 1 };
        await session.dispatch({ kind: "replaced", scope: nextScope, native: initialNative() });
        assert.equal(session.getSnapshot().history.undoEntry, undefined);
        const current = await command({ kind: "edit", key: "curve", value: [0, 0.8, 1] }, 2);
        assertReference(current.historyEntry, nextScope);
        const before = session.getSnapshot();
        const publicationCount = native.publications.length;
        // The second guard isolates scope checking without depending on how opaque IDs are allocated.
        for (const staleReference of [previous.historyEntry, { ...current.historyEntry, scope }]) {
            assert.deepEqual(await command({ kind: "undo", expectedEntry: staleReference }, 2),
                { kind: "rejected", reason: "stale-history" });
            assert.strictEqual(session.getSnapshot(), before);
            assert.equal(native.publications.length, publicationCount);
        }
        assert.equal((await command({ kind: "undo", expectedEntry: current.historyEntry }, 2)).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 1]);
        assert.deepEqual(session.getSnapshot().history.redoEntry, current.historyEntry);
    } finally { await session.stop(); }
});

test("only a nonempty gesture end returns an entry; no-op and net-zero work preserve the previous head", async () => {
    const { session, scope, command } = await openSession();
    try {
        const prior = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        for (const action of [
            { kind: "begin", key: "gain", gesture: 1 },
            { kind: "edit", key: "gain", gesture: 1, value: 3 },
            { kind: "edit", key: "gain", gesture: 1, value: 4 },
        ]) {
            const result = await command(action);
            assert.equal(result.kind, "accepted");
            assert.equal(result.historyEntry, undefined, "an open gesture has not created a history entry");
        }
        assert.equal(session.getSnapshot().history.canUndo, false);
        assert.deepEqual(session.getSnapshot().history.undoEntry, prior.historyEntry);
        const ended = await command({ kind: "end", key: "gain", gesture: 1 });
        assertReference(ended.historyEntry, scope);
        assert.notDeepEqual(ended.historyEntry, prior.historyEntry);
        assert.deepEqual(session.getSnapshot().history.undoEntry, ended.historyEntry);
        assert.equal(session.getSnapshot().fields.gain.value, 4);
        assert.equal((await command({ kind: "end", key: "gain", gesture: 1 })).historyEntry, undefined);
        await command({ kind: "undo", expectedEntry: ended.historyEntry });
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);

        const noOp = await command({ kind: "edit", key: "gain", value: 2.6 });
        assert.equal(noOp.changed, false, "host quantization determines actual no-op status");
        assert.equal(noOp.historyEntry, undefined);
        const invalid = await command({ kind: "edit", key: "curve", value: [] });
        assert.deepEqual(invalid, { kind: "rejected", reason: "invalid-value" });
        assert.deepEqual(session.getSnapshot().history.redoEntry, ended.historyEntry);
        for (const action of [
            { kind: "begin", key: "gain", gesture: 2 },
            { kind: "end", key: "gain", gesture: 2 },
            { kind: "begin", key: "gain", gesture: 3 },
            { kind: "edit", key: "gain", gesture: 3, value: 3.5 },
            { kind: "edit", key: "gain", gesture: 3, value: 2.5 },
            { kind: "end", key: "gain", gesture: 3 },
        ]) {
            const result = await command(action);
            assert.equal(result.kind, "accepted");
            assert.equal(result.historyEntry, undefined);
        }
        assert.deepEqual(session.getSnapshot().history.undoEntry, prior.historyEntry);
        assert.equal((await command({ kind: "undo", expectedEntry: prior.historyEntry })).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 1]);
        assert.equal(session.getSnapshot().history.canUndo, false);
    } finally { await session.stop(); }
});

test("interleaved gesture receipts identify their own entries while heads follow last edit order", async () => {
    const { session, command } = await openSession();
    try {
        await command({ kind: "begin", key: "curve", gesture: 1 }, 1);
        await command({ kind: "begin", key: "gain", gesture: 1 }, 2);
        await command({ kind: "edit", key: "curve", gesture: 1, value: [0, 0.4, 1] }, 1);
        await command({ kind: "edit", key: "gain", gesture: 1, value: 5 }, 2);
        const gainEnd = await command({ kind: "end", key: "gain", gesture: 1 }, 2);
        assertReference(gainEnd.historyEntry, session.getSnapshot().scope);
        assert.equal(session.getSnapshot().history.canUndo, false, "the other field is still locked");
        const curveEnd = await command({ kind: "end", key: "curve", gesture: 1 }, 1);
        assertReference(curveEnd.historyEntry, session.getSnapshot().scope);
        assert.notDeepEqual(curveEnd.historyEntry, gainEnd.historyEntry);
        assert.deepEqual(session.getSnapshot().history.undoEntry, gainEnd.historyEntry, "pointer-up order cannot move the earlier edit ahead");
        assert.deepEqual(await command({ kind: "undo", expectedEntry: curveEnd.historyEntry }),
            { kind: "rejected", reason: "stale-history" });
        assert.equal((await command({ kind: "undo", expectedEntry: gainEnd.historyEntry })).kind, "accepted");
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(session.getSnapshot().history.undoEntry, curveEnd.historyEntry);
        assert.equal((await command({ kind: "undo", expectedEntry: curveEnd.historyEntry })).kind, "accepted");
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 1]);
        assert.equal(session.getSnapshot().history.canUndo, false);
    } finally { await session.stop(); }
});

test("wire parsing preserves history references and refuses malformed heads, receipts, and guards", async () => {
    const { session, scope, native, command } = await openSession();
    try {
        const edited = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        const reference = edited.historyEntry;
        assertReference(reference, scope);
        const address = { ...scope, client: 1, sequence: 2 };
        const wireCommand = expectedEntry => ({ kind: "command", address, command: { kind: "undo", expectedEntry } });
        const parsedCommand = parseServiceMessage(wireCommand(reference));
        assert.equal(parsedCommand.kind, "ok");
        assert.deepEqual(parsedCommand.value.command.expectedEntry, reference, "the parser must not silently downgrade guarded Undo");
        const update = native.updates.at(-1);
        const wireUpdate = () => ({ kind: "update", scope, revision: update.snapshot.revision,
            state: encodeStateSnapshot(definition, update.snapshot), receipt: update.receipt });
        const hydrated = parseClientMessage(definition, wireUpdate());
        assert.equal(hydrated.kind, "ok");
        assert.deepEqual(hydrated.value.state.history.undoEntry, reference);
        assert.deepEqual(hydrated.value.receipt.result.historyEntry, reference);
        assert.ok(Object.isFrozen(hydrated.value.state.history.undoEntry.scope));
        const wireReceipt = historyEntry => ({ kind: "receipt", address,
            result: { kind: "accepted", revision: edited.revision, changed: true, historyEntry } });
        assert.deepEqual(parseClientMessage(definition, wireReceipt(reference)).value.result.historyEntry, reference);
        assert.deepEqual(parseClientMessage(definition, { kind: "receipt", address,
            result: { kind: "rejected", reason: "stale-history" } }).value.result,
        { kind: "rejected", reason: "stale-history" });
        for (const malformed of [null, "entry", {}, { id: reference.id }, { scope },
            { scope, id: 0 }, { scope, id: -1 }, { scope, id: 1.5 }, { scope, id: Number.MAX_SAFE_INTEGER + 1 },
            { scope: { owner: "", document: 0 }, id: 1 }, { scope: { owner: scope.owner, document: -1 }, id: 1 }]) {
            const parsed = parseServiceMessage(wireCommand(malformed));
            assert.deepEqual(parsed, { kind: "ok", value: { kind: "invalid-command", address } });
            assert.equal(parseClientMessage(definition, wireReceipt(malformed)).kind, "invalid");
            const invalidHead = wireUpdate();
            invalidHead.state = { ...invalidHead.state,
                history: { ...invalidHead.state.history, undoEntry: malformed } };
            assert.equal(parseClientMessage(definition, invalidHead).kind, "invalid");
        }
        const foreignReference = { ...reference, scope: { ...scope, document: scope.document + 1 } };
        const foreignHead = wireUpdate();
        foreignHead.state = { ...foreignHead.state, history: { ...foreignHead.state.history, undoEntry: foreignReference } };
        assert.equal(parseClientMessage(definition, foreignHead).kind, "invalid", "a snapshot head belongs to that snapshot's document");
        assert.equal(parseClientMessage(definition, wireReceipt(foreignReference)).kind, "invalid", "a receipt entry belongs to the accepted command's document");
        const staleGuard = parseServiceMessage(wireCommand(foreignReference));
        assert.equal(staleGuard.kind, "ok");
        assert.deepEqual(staleGuard.value.command.expectedEntry, foreignReference, "well-formed stale guards reach the owner's atomic check");
    } finally { await session.stop(); }
});

test("an observer defect cannot erase the accepted edit's entry reference or strand a queued command", async () => {
    const defects = [];
    const { session, scope, native, command } = await openSession({ onDefect: error => defects.push(error) });
    const problem = new Error("history observer failed after commit");
    let observedReference;
    let queued;
    const unsubscribe = session.subscribe(snapshot => {
        if (snapshot.fields.curve.readiness.kind === "ready" && snapshot.fields.curve.version === 1) {
            observedReference = snapshot.history.undoEntry;
            queued = command({ kind: "edit", key: "gain", value: 5 }, 2);
            throw problem;
        }
    });
    try {
        const accepted = await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        assert.equal(accepted.kind, "accepted");
        assert.equal(accepted.changed, true);
        assertReference(observedReference, scope);
        assert.deepEqual(accepted.historyEntry, observedReference);
        assert.deepEqual(native.updates.at(-1).receipt.result.historyEntry, observedReference);
        assert.ok(queued, "the observer enqueued a real subsequent command before failing");
        assert.deepEqual(await queued, { kind: "rejected", reason: "service-closed" });
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(session.getSnapshot().fields.curve.readiness, { kind: "failed", reason: "service-closed" });
        assert.equal(native.publications.length, 0, "closure prevents the remaining persistence effect");
        assert.equal(defects.length, 1);
        assert.ok(defects[0] === problem || (defects[0] instanceof AggregateError && defects[0].errors.includes(problem)));
    } finally { unsubscribe(); await session.stop(); }
});

// Only the transport schedule and already-assigned client identity are controlled.
// Actual session transitions and actual protocol parsers own every value/result.
async function openClientPair() {
    const channels = [];
    const jobs = [];
    const owner = await openSession({ onUpdate(snapshot, receipt) {
        const body = { kind: "update", scope: snapshot.scope, revision: snapshot.revision,
            state: encodeStateSnapshot(definition, snapshot), ...(receipt ? { receipt } : {}) };
        for (const channel of channels) channel.deliver(body);
    } });
    const makeClient = identity => {
        let listener;
        let held = false;
        const queued = [];
        const route = message => {
            const parsed = parseServiceMessage({ kind: "command", address: { ...message.scope, client: identity, sequence: message.sequence }, command: message.command });
            assert.equal(parsed.kind, "ok");
            if (parsed.value.kind === "invalid-command") {
                channel.deliver({ kind: "receipt", address: parsed.value.address, result: { kind: "rejected", reason: "invalid-command" } });
            } else jobs.push(owner.session.dispatch(parsed.value));
        };
        const channel = {
            sent: [],
            subscribe(receive) { listener = receive; return () => { listener = undefined; }; },
            send(message) {
                const wire = JSON.parse(JSON.stringify(message));
                this.sent.push(wire);
                if (wire.kind === "attach") {
                    const snapshot = owner.session.getSnapshot();
                    this.deliver({ kind: "attached", request: wire.request, client: identity,
                        scope: snapshot.scope, revision: snapshot.revision, state: encodeStateSnapshot(definition, snapshot) });
                } else if (held) queued.push(wire);
                else route(wire);
            },
            deliver(body) {
                const parsed = parseClientMessage(definition, JSON.parse(JSON.stringify(body)));
                assert.equal(parsed.kind, "ok");
                listener?.(parsed.value);
            },
            hold() { held = true; },
            queued: () => [...queued],
            release() { held = false; for (const message of queued.splice(0)) route(message); },
        };
        channels.push(channel);
        const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
        return { client, channel };
    };
    const first = makeClient(1), second = makeClient(2);
    return { ...owner, first, second, async stop() {
        first.channel.release(); second.channel.release();
        first.client.stop(); second.client.stop();
        await Promise.all(jobs); await owner.session.stop();
    } };
}

test("a held real client Undo guard cannot undo another client's newer edit", async () => {
    const { session, native, first, second, stop } = await openClientPair();
    try {
        const previous = await first.client.dispatch({ kind: "edit", key: "curve", value: [0, 0.4, 1] });
        assertReference(previous.historyEntry, session.getSnapshot().scope);
        assert.deepEqual(first.client.getSnapshot().state.history.undoEntry, previous.historyEntry);
        first.channel.hold();
        const pendingUndo = first.client.dispatch({ kind: "undo", expectedEntry: previous.historyEntry });
        assert.equal(first.channel.queued().length, 1);
        assert.deepEqual(first.channel.queued()[0].command.expectedEntry, previous.historyEntry);
        const newer = await second.client.dispatch({ kind: "edit", key: "gain", value: 5 });
        assertReference(newer.historyEntry, session.getSnapshot().scope);
        assert.deepEqual(first.client.getSnapshot().state.history.undoEntry, newer.historyEntry);
        const before = session.getSnapshot();
        const count = native.publications.length;
        first.channel.release();
        assert.deepEqual(await pendingUndo, { kind: "rejected", reason: "stale-history" });
        assert.strictEqual(session.getSnapshot(), before);
        assert.equal(native.publications.length, count);
        assert.equal((await first.client.dispatch({ kind: "undo", expectedEntry: newer.historyEntry })).kind, "accepted");
        for (const { client } of [first, second]) {
            assert.equal(client.getSnapshot().state.fields.gain.value, 2.5);
            assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.4, 1]);
            assert.deepEqual(client.getSnapshot().state.history.undoEntry, previous.historyEntry);
        }
    } finally { await stop(); }
});

test("malformed local history guards are rejected before allocating or sending a command sequence", async () => {
    const { first, stop } = await openClientPair();
    try {
        for (const expectedEntry of [null, {}, { scope: { owner: "owner", document: 0 }, id: -1 }]) {
            assert.deepEqual(await first.client.dispatch({ kind: "undo", expectedEntry }),
                { kind: "rejected", reason: "invalid-command" });
            assert.deepEqual(first.channel.sent.map(message => message.kind), ["attach"], "an invalid guard consumes neither a transport send nor sequence");
        }
        assert.equal((await first.client.dispatch({ kind: "edit", key: "curve", value: [0, 0.4, 1] })).kind, "accepted");
        assert.equal(first.channel.sent[1].sequence, 1);
    } finally { await stop(); }
});
