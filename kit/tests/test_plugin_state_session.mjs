import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const definitionModule = loadUIModule(repoRoot, "kit/ui/plugin-state-definition.ts");
const sessionModule = loadUIModule(repoRoot, "kit/ui/plugin-state-session.ts");

const curveCodec = {
    parse(input) {
        if (input === null || typeof input !== "object" || !Array.isArray(input.points)
            || input.points.length < 2
            || !input.points.every((point) => typeof point === "number" && Number.isFinite(point) && point >= 0 && point <= 1)) {
            return { kind: "error", message: "Expected at least two finite curve points between zero and one." };
        }
        return { kind: "ok", value: Object.freeze({ points: Object.freeze([...input.points]) }) };
    },
    encode(value) {
        return { points: [...value.points] };
    },
    equals(left, right) {
        return left.points.length === right.points.length
            && left.points.every((point, index) => point === right.points[index]);
    },
};

class RecordingNativePort {
    publications = [];
    updates = [];
    closures = [];

    close(reason) { this.closures.push(reason); }

    publish(publication) {
        this.publications.push(publication);
    }

    update(snapshot, receipt) {
        this.updates.push({ snapshot, receipt });
    }
}

async function openCurveSession() {
    const { definePluginState, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const session = createPluginStateSession(definePluginState({
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => assert.fail(`Unexpected defect: ${error}`) });
    const scope = { owner: "test-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
    const sequences = new Map();
    return {
        session, native, scope,
        command: (command, client = 1) => {
            const sequence = (sequences.get(client) ?? 0) + 1;
            sequences.set(client, sequence);
            return session.dispatch({ kind: "command", address: { ...scope, client, sequence }, command });
        },
    };
}

async function openMixedSession() {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const session = createPluginStateSession(definePluginState({
        gain: parameter("gain"), rate: parameter("rate"),
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => assert.fail(`Unexpected defect: ${error}`) });
    const scope = { owner: "mixed-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: {
        parameters: [
            { endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
            { endpoint: "rate", value: 1, min: 0.25, max: 8, step: 0.25, defaultValue: 1 },
        ], values: {},
    } });
    const sequences = new Map();
    return { session, native, scope, command: (command, client = 1) => {
        const sequence = (sequences.get(client) ?? 0) + 1;
        sequences.set(client, sequence);
        return session.dispatch({ kind: "command", address: { ...scope, client, sequence }, command });
    } };
}

test("native boot hydrates host gain and absent curve, then publishes one coherent undoable curve edit", async () => {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const definition = definePluginState({
        gain: parameter("gain"),
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    });
    const native = new RecordingNativePort();
    const session = createPluginStateSession(definition, { native, onDefect: error => assert.fail(`Unexpected defect: ${error}`) });
    const scope = { owner: "test-owner", document: 0 };
    const address = { ...scope, client: 1, sequence: 1 };
    const observedSnapshots = [];
    const unsubscribe = session.subscribe((snapshot) => observedSnapshots.push(snapshot));

    assert.deepEqual(session.getSnapshot().fields.gain.readiness, { kind: "pending" });
    assert.equal("value" in session.getSnapshot().fields.gain, false, "pending gain has no guessed GUI value");
    assert.deepEqual(await session.dispatch({
        kind: "command", address,
        command: { kind: "edit", key: "curve", value: { points: [0, 0.5, 1] } },
    }), { kind: "rejected", reason: "not-ready" });
    assert.deepEqual(native.publications, []);

    await session.dispatch({
        kind: "opened", scope,
        native: {
            parameters: [{ endpoint: "gain", value: 0.65, min: 0, max: 1, step: 0, defaultValue: 0.2 }],
            values: {},
        },
    });
    const boot = session.getSnapshot();
    assert.deepEqual(boot.scope, scope);
    assert.equal(boot.fields.gain.value, 0.65, "actual host observation wins over endpoint default");
    assert.deepEqual(boot.fields.gain.readiness, { kind: "ready" });
    assert.equal(boot.fields.gain.version, 0);
    assert.deepEqual(boot.fields.gain.persistence, { kind: "host-managed" });
    assert.deepEqual(boot.fields.curve.value, { points: [0, 1] });
    assert.deepEqual(boot.fields.curve.readiness, { kind: "ready" });
    assert.equal(boot.fields.curve.version, 0);
    assert.deepEqual(boot.history, { canUndo: false, canRedo: false });
    assert.deepEqual(native.publications, [], "opening absent storage does not rewrite the patch");

    const proposedCurve = { points: [0, 0.5, 1] };
    const result = await session.dispatch({
        kind: "command", address: { ...address, sequence: 2 },
        command: { kind: "edit", key: "curve", value: proposedCurve },
    });
    const edited = session.getSnapshot();
    assert.deepEqual(result, { kind: "accepted", revision: edited.revision, version: 1 });
    assert.equal(edited.revision, boot.revision + 1);
    assert.deepEqual(edited.fields.curve.value, { points: [0, 0.5, 1] });
    assert.equal(edited.fields.curve.version, 1);
    assert.deepEqual(edited.fields.curve.persistence, { kind: "pending" });
    assert.deepEqual(edited.history, { canUndo: true, canRedo: false });
    assert.strictEqual(edited.fields.gain, boot.fields.gain, "unrelated host field retains its projection");
    assert.strictEqual(observedSnapshots.at(-1), edited);
    assert.deepEqual(native.publications, [{
        request: 1, scope,
        operations: [{ kind: "stored", key: "curve", value: { points: [0, 0.5, 1] } }],
    }]);
    assert.deepEqual(native.updates.at(-1), {
        snapshot: edited, receipt: { address: { ...address, sequence: 2 }, result },
    });

    proposedCurve.points[1] = 0.9;
    assert.deepEqual(edited.fields.curve.value, { points: [0, 0.5, 1] }, "accepted input is owned independently of its caller");
    await session.dispatch({ kind: "published", request: 1, scope, result: { kind: "observed" } });
    const persisted = session.getSnapshot();
    assert.deepEqual(persisted.fields.curve.persistence, { kind: "observed-in-native-state" });
    assert.strictEqual(persisted.fields.curve.value, edited.fields.curve.value);
    assert.equal(persisted.fields.curve.version, 1);
    assert.deepEqual(persisted.history, { canUndo: true, canRedo: false });
    assert.equal(native.publications.length, 1, "publication observation is not another write");
    unsubscribe();
    session.stop();
});

test("shared Undo and Redo restore accepted curve values while no-op and rejected edits preserve redo", async () => {
    const { session, native, command } = await openCurveSession();
    const firstCurve = { points: [0, 0.25, 1] };
    const secondCurve = { points: [0, 0.75, 1] };
    await command({ kind: "edit", key: "curve", value: firstCurve });
    await command({ kind: "edit", key: "curve", value: secondCurve, expectedVersion: 1 }, 2);

    assert.equal((await command({ kind: "undo" })).kind, "accepted");
    const undone = session.getSnapshot();
    assert.deepEqual(undone.fields.curve.value, firstCurve);
    assert.equal(undone.fields.curve.version, 3);
    assert.deepEqual(undone.history, { canUndo: true, canRedo: true });
    assert.deepEqual(native.publications.at(-1).operations, [{ kind: "stored", key: "curve", value: firstCurve }]);
    const writeCount = native.publications.length;

    assert.deepEqual(await command({ kind: "edit", key: "curve", value: { points: [0, NaN] } }),
        { kind: "rejected", reason: "invalid-value" });
    assert.deepEqual(await command({ kind: "edit", key: "curve", value: firstCurve, expectedVersion: 2 }, 2),
        { kind: "rejected", reason: "stale-version" });
    assert.deepEqual(await command({ kind: "edit", key: "curve", value: firstCurve }),
        { kind: "accepted", revision: undone.revision, version: 3 });
    assert.strictEqual(session.getSnapshot(), undone);
    assert.equal(native.publications.length, writeCount);

    assert.equal((await command({ kind: "redo" }, 2)).kind, "accepted");
    assert.deepEqual(session.getSnapshot().fields.curve.value, secondCurve);
    assert.equal(session.getSnapshot().fields.curve.version, 4);
    assert.deepEqual(session.getSnapshot().history, { canUndo: true, canRedo: false });
    assert.deepEqual(native.publications.at(-1).operations, [{ kind: "stored", key: "curve", value: secondCurve }]);
    await command({ kind: "undo" });
    await command({ kind: "undo" });
    assert.deepEqual(session.getSnapshot().fields.curve.value, { points: [0, 1] });
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
    session.stop();
});

test("invalid host metadata and present malformed storage fail only their fields without installing fallback values", async () => {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    for (const metadata of [
        { value: NaN }, { min: 2 }, { max: Infinity }, { step: -1 }, { defaultValue: 2 },
    ]) {
        const native = new RecordingNativePort();
        const session = createPluginStateSession(definePluginState({
            gain: parameter("gain"),
            missing: parameter("missing"),
            curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
            other: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
        }), { native, onDefect: error => assert.fail(`Unexpected defect: ${error}`) });
        const scope = { owner: "invalid-field-test", document: 0 };
        await session.dispatch({ kind: "opened", scope, native: {
            parameters: [{ endpoint: "gain", value: 0.5, min: 0, max: 1, step: 0, defaultValue: 0.2, ...metadata }],
            values: { curve: { points: [0, "invalid", 1] }, other: { points: [0, 0.25, 1] } },
        } });
        const snapshot = session.getSnapshot();
        for (const key of ["gain", "curve", "missing"]) {
            assert.equal(snapshot.fields[key].readiness.kind, "failed", key);
            assert.equal("value" in snapshot.fields[key], false, `${key} must not expose a ready fallback`);
            assert.deepEqual(await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
                command: { kind: "edit", key, value: key === "gain" ? 0.5 : { points: [0, 1] } } }),
            { kind: "rejected", reason: "not-ready" });
        }
        assert.deepEqual(snapshot.fields.other.value, { points: [0, 0.25, 1] });
        assert.deepEqual(native.publications, []);
        assert.equal((await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 2 },
            command: { kind: "edit", key: "other", value: { points: [0, 0.75, 1] } } })).kind, "accepted");
        assert.deepEqual(native.publications.at(-1).operations, [{ kind: "stored", key: "other", value: { points: [0, 0.75, 1] } }]);
        session.stop();
    }
});

test("scalar edits follow host range and step while observations remain history-free and invalidate only that field", async () => {
    const { session, native, scope, command } = await openMixedSession();
    assert.equal((await command({ kind: "edit", key: "gain", value: 3.24 })).kind, "accepted");
    const edited = session.getSnapshot();
    assert.equal(edited.fields.gain.value, 3);
    assert.equal(edited.fields.gain.version, 1);
    assert.deepEqual(edited.fields.gain.metadata, { min: -12, max: 12, step: 0.5, defaultValue: 1 });
    assert.deepEqual(edited.fields.gain.persistence, { kind: "host-managed" });
    assert.deepEqual(native.publications.at(-1).operations, [
        { kind: "gesture-start", endpoint: "gain" },
        { kind: "parameter", endpoint: "gain", value: 3 },
        { kind: "gesture-end", endpoint: "gain" },
    ]);
    const count = native.publications.length;
    const observe = (value) => session.dispatch({ kind: "parameter", scope, endpoint: "gain", value });
    await observe(3);
    assert.strictEqual(session.getSnapshot(), edited, "matching value is neither a new value nor a provenance acknowledgment");
    await observe(4);
    const observed = session.getSnapshot();
    assert.equal(observed.fields.gain.value, 4);
    assert.equal(observed.fields.gain.version, 2);
    assert.strictEqual(observed.fields.rate, edited.fields.rate);
    assert.strictEqual(observed.fields.curve, edited.fields.curve);
    assert.equal(native.publications.length, count, "host observations never echo a parameter write");
    assert.deepEqual(await command({ kind: "edit", key: "gain", value: 4, expectedVersion: 1 }, 2),
        { kind: "rejected", reason: "stale-version" });

    await command({ kind: "undo" }, 2);
    assert.equal(session.getSnapshot().fields.gain.value, 2.5, "Undo uses the native initial baseline, not its default or later automation");
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
    await observe(4);
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
    await command({ kind: "redo" });
    assert.equal(session.getSnapshot().fields.gain.value, 3, "Redo restores accepted user intent, not the automation value");
    assert.deepEqual(native.publications.at(-1).operations[1], { kind: "parameter", endpoint: "gain", value: 3 });
    const beforeInvalid = session.getSnapshot();
    assert.deepEqual(await command({ kind: "edit", key: "gain", value: Infinity }), { kind: "rejected", reason: "invalid-value" });
    assert.strictEqual(session.getSnapshot(), beforeInvalid);
    await command({ kind: "edit", key: "gain", value: 100 });
    assert.equal(session.getSnapshot().fields.gain.value, 12);
    session.stop();
});

test("each field keeps its gesture owner while other fields proceed and shared history waits for every release", async () => {
    for (const [owner, contender] of [[1, 2], [2, 1]]) {
        const { session, native, command } = await openMixedSession();
        assert.equal((await command({ kind: "begin", key: "curve", gesture: 1 }, owner)).kind, "accepted");
        await command({ kind: "edit", key: "curve", gesture: 1, value: { points: [0, 0.25, 1] }, expectedVersion: 0 }, owner);
        const locked = session.getSnapshot();
        const writes = native.publications.length;
        for (const action of [
            { kind: "begin", key: "curve", gesture: 2 },
            { kind: "edit", key: "curve", value: { points: [0, 0.75, 1] }, expectedVersion: 1 },
            { kind: "end", key: "curve", gesture: 1 },
        ]) assert.deepEqual(await command(action, contender), { kind: "rejected", reason: "busy" });
        assert.strictEqual(session.getSnapshot(), locked);
        assert.equal(native.publications.length, writes);

        assert.equal((await command({ kind: "edit", key: "gain", value: 3 }, contender)).kind, "accepted");
        await command({ kind: "edit", key: "curve", gesture: 1, value: { points: [0, 0.5, 1] }, expectedVersion: 1 }, owner);
        const beforeHistoryAttempt = session.getSnapshot();
        for (const client of [owner, contender]) {
            for (const kind of ["undo", "redo"]) {
                assert.deepEqual(await command({ kind }, client), { kind: "rejected", reason: "busy" });
            }
        }
        assert.strictEqual(session.getSnapshot(), beforeHistoryAttempt);
        assert.deepEqual(session.getSnapshot().fields.curve.gesture, { client: owner, gesture: 1 });
        const writesBeforeEnd = native.publications.length;
        await command({ kind: "end", key: "curve", gesture: 1 }, owner);
        assert.equal(native.publications.length, writesBeforeEnd, "releasing stored-value gesture does not resend it");
        await command({ kind: "undo" }, contender);
        assert.deepEqual(session.getSnapshot().fields.curve.value, { points: [0, 1] }, "one gesture restores the original curve");
        assert.equal(session.getSnapshot().fields.gain.value, 3, "curve's last edit followed the gain edit");
        await command({ kind: "undo" }, owner);
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
        session.stop();
    }
});

test("a reentrant subscriber queues its edit behind the current native publication and receipt", async () => {
    const { session, native, command } = await openCurveSession();
    let nested;
    const seen = [];
    const unsubscribe = session.subscribe(snapshot => {
        seen.push(snapshot.fields.curve.value.points);
        if (snapshot.fields.curve.version === 1) {
            nested = command({ kind: "edit", key: "curve", value: { points: [0, 0.75, 1] } }, 2);
        }
    });
    const first = await command({ kind: "edit", key: "curve", value: { points: [0, 0.25, 1] } });
    assert.equal(first.version, 1);
    assert.equal((await nested).version, 2);
    assert.deepEqual(seen, [[0, 0.25, 1], [0, 0.75, 1]]);
    assert.deepEqual(native.publications.map(item => item.operations[0].value.points), seen);
    assert.deepEqual(native.updates.filter(item => item.receipt).map(item => ({
        client: item.receipt.address.client, version: item.receipt.result.version,
        points: item.snapshot.fields.curve.value.points,
    })), [
        { client: 1, version: 1, points: [0, 0.25, 1] },
        { client: 2, version: 2, points: [0, 0.75, 1] },
    ]);
    unsubscribe();
    session.stop();
});

test("a throwing subscriber preserves known acceptance, closes readiness, and settles its queued command", async () => {
    const { definePluginState, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const defects = [];
    const session = createPluginStateSession(definePluginState({
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => defects.push(error) });
    const scope = { owner: "fault-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
    const problem = new Error("consumer failed after observing acceptance");
    let queued;
    const unsubscribe = session.subscribe(snapshot => {
        if (snapshot.fields.curve.readiness.kind === "ready" && snapshot.fields.curve.version === 1) {
            queued = session.dispatch({ kind: "command", address: { ...scope, client: 2, sequence: 1 },
                command: { kind: "edit", key: "curve", value: { points: [0, 0.8, 1] } } });
            throw problem;
        }
    });
    const result = await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
        command: { kind: "edit", key: "curve", value: { points: [0, 0.4, 1] } } });
    assert.equal(result.kind, "accepted", "the observer ran after the accepted value was committed");
    assert.equal(result.version, 1);
    assert.deepEqual(await queued, { kind: "rejected", reason: "service-closed" });
    assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 0.4, 1]);
    assert.equal(session.getSnapshot().fields.curve.version, 1);
    assert.deepEqual(session.getSnapshot().fields.curve.readiness, { kind: "failed", reason: "service-closed" });
    assert.equal(defects.length, 1);
    assert.ok(defects[0] === problem || (defects[0] instanceof AggregateError && defects[0].errors.includes(problem)),
        "the original diagnostic error must remain available");
    assert.equal(native.publications.length, 0, "terminal closure forbids a later effect from the failed transition");
    assert.equal(native.updates.at(-1).receipt.result.kind, "accepted");
    assert.equal(native.updates.at(-1).receipt.address.client, 1);
    assert.deepEqual(native.updates.at(-1).snapshot.fields.curve.readiness, { kind: "failed", reason: "service-closed" });
    const updates = native.updates.length;
    assert.deepEqual(await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 2 },
        command: { kind: "undo" } }), { kind: "rejected", reason: "service-closed" });
    session.stop();
    session.stop();
    assert.equal(native.updates.length, updates);
    assert.deepEqual(native.closures, [{ reason: "service-closed" }]);
    unsubscribe();
});

test("exactly one hundred completed edits remain undoable and a new edit clears redo", async () => {
    const { session, native, command } = await openCurveSession();
    for (let index = 1; index <= 101; index++) {
        assert.equal((await command({ kind: "edit", key: "curve", value: { points: [0, index / 102, 1] } })).kind, "accepted");
    }
    for (let index = 100; index >= 1; index--) {
        await command({ kind: "undo" });
        assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, index / 102, 1]);
    }
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
    const oldest = session.getSnapshot();
    const count = native.publications.length;
    await command({ kind: "undo" });
    assert.strictEqual(session.getSnapshot(), oldest, "the pre-cap initial value is no longer reachable");
    assert.equal(native.publications.length, count);
    await command({ kind: "edit", key: "curve", value: { points: [0, 0.999, 1] } });
    assert.deepEqual(session.getSnapshot().history, { canUndo: true, canRedo: false });
    session.stop();
});

test("overlapping gestures undo by last accepted edit, independent of release order, with balanced scalar brackets", async () => {
    for (const release of [["curve", "gain"], ["gain", "curve"]]) {
        const { session, native, scope, command } = await openMixedSession();
        await command({ kind: "begin", key: "curve", gesture: 1 }, 1);
        await command({ kind: "edit", key: "curve", gesture: 1, value: { points: [0, 0.3, 1] } }, 1);
        await command({ kind: "begin", key: "gain", gesture: 2 }, 2);
        await command({ kind: "edit", key: "gain", gesture: 2, value: 3, expectedVersion: 0 }, 2);
        await session.dispatch({ kind: "parameter", scope, endpoint: "gain", value: 4 });
        assert.deepEqual(await command({ kind: "edit", key: "gain", gesture: 2, value: 5, expectedVersion: 1 }, 2),
            { kind: "rejected", reason: "stale-version" }, "owning a gesture never bypasses a conditional version");
        await command({ kind: "edit", key: "gain", gesture: 2, value: 5 }, 2);
        await command({ kind: "edit", key: "curve", gesture: 1, value: { points: [0, 0.6, 1] } }, 1);
        for (const key of release) await command({ kind: "end", key, gesture: key === "curve" ? 1 : 2 }, key === "curve" ? 1 : 2);
        assert.deepEqual(native.publications.flatMap(item => item.operations).filter(item => item.endpoint === "gain"), [
            { kind: "gesture-start", endpoint: "gain" },
            { kind: "parameter", endpoint: "gain", value: 3 },
            { kind: "parameter", endpoint: "gain", value: 5 },
            { kind: "gesture-end", endpoint: "gain" },
        ]);
        await command({ kind: "undo" });
        assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 1]);
        assert.equal(session.getSnapshot().fields.gain.value, 5);
        await command({ kind: "undo" });
        assert.equal(session.getSnapshot().fields.gain.value, 2.5, "the original native gesture baseline survives intervening automation");
        await command({ kind: "redo" });
        assert.equal(session.getSnapshot().fields.gain.value, 5);
        await command({ kind: "redo" });
        assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 0.6, 1]);
        session.stop();
    }
});

test("empty and net-zero gestures add no history, repeated boundaries are harmless, and stale release cannot unlock", async () => {
    const { session, native, command } = await openMixedSession();
    await command({ kind: "edit", key: "curve", value: { points: [0, 0.5, 1] } });
    await command({ kind: "undo" });
    await command({ kind: "begin", key: "gain", gesture: 1 });
    const begin = session.getSnapshot();
    await command({ kind: "begin", key: "gain", gesture: 1 });
    assert.strictEqual(session.getSnapshot(), begin);
    await command({ kind: "end", key: "gain", gesture: 1 });
    const ended = session.getSnapshot();
    const writes = native.publications.length;
    await command({ kind: "end", key: "gain", gesture: 1 });
    assert.strictEqual(session.getSnapshot(), ended);
    assert.equal(native.publications.length, writes);
    assert.deepEqual(ended.history, { canUndo: false, canRedo: true });
    assert.equal(ended.fields.gain.version, 0);
    await command({ kind: "redo" });
    await command({ kind: "undo" });
    await command({ kind: "begin", key: "curve", gesture: 2 });
    await command({ kind: "edit", key: "curve", gesture: 2, value: { points: [0, 0.7, 1] } });
    await command({ kind: "edit", key: "curve", gesture: 2, value: { points: [0, 1] } });
    const beforeEnd = native.publications.length;
    await command({ kind: "end", key: "curve", gesture: 2 });
    assert.equal(native.publications.length, beforeEnd, "stored release does not resend accepted values");
    assert.equal(session.getSnapshot().history.canUndo, false);
    await command({ kind: "begin", key: "curve", gesture: 3 });
    assert.deepEqual(await command({ kind: "end", key: "curve", gesture: 2 }), { kind: "rejected", reason: "invalid-command" });
    assert.deepEqual(session.getSnapshot().fields.curve.gesture, { client: 1, gesture: 3 });
    assert.deepEqual(await command({ kind: "edit", key: "curve", value: { points: [0, 0.8, 1] } }, 2),
        { kind: "rejected", reason: "busy" });
    await command({ kind: "end", key: "curve", gesture: 3 });
    session.stop();
});

test("detaching one client seals only its fields and a fresh view inherits accepted values and shared undo", async () => {
    const { session, native, scope, command } = await openMixedSession();
    await command({ kind: "begin", key: "curve", gesture: 1 }, 1);
    await command({ kind: "edit", key: "curve", gesture: 1, value: { points: [0, 0.3, 1] } }, 1);
    await command({ kind: "begin", key: "gain", gesture: 2 }, 1);
    await command({ kind: "edit", key: "gain", gesture: 2, value: 3 }, 1);
    await command({ kind: "begin", key: "rate", gesture: 1 }, 2);
    await command({ kind: "edit", key: "rate", gesture: 1, value: 2 }, 2);
    const before = native.publications.length;
    assert.equal((await session.dispatch({ kind: "detached", scope, client: 1 })).kind, "accepted");
    assert.equal(session.getSnapshot().fields.curve.gesture, undefined);
    assert.equal(session.getSnapshot().fields.gain.gesture, undefined);
    assert.deepEqual(session.getSnapshot().fields.rate.gesture, { client: 2, gesture: 1 });
    assert.deepEqual(native.publications.slice(before).flatMap(item => item.operations), [{ kind: "gesture-end", endpoint: "gain" }]);
    assert.deepEqual(await command({ kind: "edit", key: "curve", value: { points: [0, 0.9, 1] } }, 1),
        { kind: "rejected", reason: "service-closed" });
    const reopened = session.getSnapshot();
    assert.deepEqual(reopened.fields.curve.value.points, [0, 0.3, 1]);
    assert.equal(reopened.fields.gain.value, 3);
    assert.deepEqual(await command({ kind: "undo" }, 3), { kind: "rejected", reason: "busy" });
    await command({ kind: "end", key: "rate", gesture: 1 }, 2);
    await command({ kind: "undo" }, 3);
    assert.equal(session.getSnapshot().fields.rate.value, 1);
    await command({ kind: "undo" }, 3);
    assert.equal(session.getSnapshot().fields.gain.value, 2.5);
    await command({ kind: "undo" }, 3);
    assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 1]);
    assert.equal(session.getSnapshot().history.canUndo, false);
    session.stop();
});

test("full replacement resets document history and locks before queued old commands or publications can act", async () => {
    const { session, native, scope, command } = await openMixedSession();
    await command({ kind: "begin", key: "gain", gesture: 1 });
    await command({ kind: "edit", key: "gain", gesture: 1, value: 3 });
    await command({ kind: "begin", key: "curve", gesture: 2 });
    const replacementScope = { ...scope, document: 1 };
    let replacement;
    let oldQueued;
    const unsubscribe = session.subscribe(snapshot => {
        if (snapshot.scope.document === 0 && snapshot.fields.curve.version === 1) {
            replacement = session.dispatch({ kind: "replaced", scope: replacementScope, native: {
                parameters: [
                    { endpoint: "gain", value: 6, min: -12, max: 12, step: 0.5, defaultValue: 1 },
                    { endpoint: "rate", value: 2, min: 0.25, max: 8, step: 0.25, defaultValue: 1 },
                ], values: { curve: { points: [0, 0.9, 1] } },
            } });
            oldQueued = command({ kind: "edit", key: "curve", gesture: 2, value: { points: [0, 0.8, 1] } });
        }
    });
    await command({ kind: "edit", key: "curve", gesture: 2, value: { points: [0, 0.3, 1] } });
    assert.equal((await replacement).kind, "accepted");
    assert.deepEqual(await oldQueued, { kind: "rejected", reason: "stale-scope" });
    const fresh = session.getSnapshot();
    assert.deepEqual(fresh.scope, replacementScope);
    assert.deepEqual(fresh.history, { canUndo: false, canRedo: false });
    assert.deepEqual(fresh.fields.curve.value.points, [0, 0.9, 1]);
    assert.equal(fresh.fields.gain.value, 6);
    assert.equal(fresh.fields.curve.gesture, undefined);
    assert.equal(fresh.fields.gain.gesture, undefined);
    assert.equal(fresh.fields.curve.version, 0);
    const writes = native.publications.length;
    for (const publication of native.publications) {
        assert.deepEqual(await session.dispatch({ kind: "published", scope, request: publication.request, result: { kind: "observed" } }),
            { kind: "rejected", reason: "stale-scope" });
    }
    assert.strictEqual(session.getSnapshot(), fresh);
    assert.equal(native.publications.length, writes);
    const malformedScope = { ...scope, document: 2 };
    await session.dispatch({ kind: "replaced", scope: malformedScope, native: { parameters: [], values: { curve: { points: [NaN, 1] } } } });
    assert.equal(session.getSnapshot().fields.curve.readiness.kind, "failed");
    assert.equal("value" in session.getSnapshot().fields.curve, false, "malformed replacement must not retain the previous document's ready curve");
    assert.equal("value" in session.getSnapshot().fields.gain, false);
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
    unsubscribe();
    session.stop();
});

test("native storage failure preserves acceptance and undo while stale publication results cannot mark newer values persisted", async () => {
    const { session, native, scope, command } = await openCurveSession();
    const first = await command({ kind: "edit", key: "curve", value: { points: [0, 0.3, 1] } });
    const failedRequest = native.publications.at(-1).request;
    await session.dispatch({ kind: "published", scope, request: failedRequest, result: { kind: "failed", reason: "storage-unavailable" } });
    assert.equal(first.kind, "accepted");
    assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 0.3, 1]);
    assert.equal(session.getSnapshot().fields.curve.version, 1);
    assert.deepEqual(session.getSnapshot().fields.curve.persistence, { kind: "failed", reason: "storage-unavailable" });
    assert.equal(session.getSnapshot().history.canUndo, true);
    await command({ kind: "edit", key: "curve", value: { points: [0, 0.6, 1] } });
    const obsolete = native.publications.at(-1).request;
    await command({ kind: "undo" });
    const current = native.publications.at(-1).request;
    const awaiting = session.getSnapshot();
    await session.dispatch({ kind: "published", scope, request: obsolete, result: { kind: "observed" } });
    assert.strictEqual(session.getSnapshot(), awaiting);
    await session.dispatch({ kind: "published", scope, request: current, result: { kind: "observed" } });
    assert.deepEqual(session.getSnapshot().fields.curve.persistence, { kind: "observed-in-native-state" });
    assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 0.3, 1]);
    assert.equal(native.publications.length, 3, "completion does not republish the value");
    session.stop();
});

for (const failureAt of ["encode", "publish", "update"]) {
    test(`an unexpected ${failureAt} defect reports its cause and closes with truthful commit knowledge`, async () => {
        const { definePluginState, storedValue } = await definitionModule;
        const { createPluginStateSession } = await sessionModule;
        const problem = new Error(`broken ${failureAt}`);
        const defects = [];
        class FailingNativePort extends RecordingNativePort {
            publish(publication) {
                super.publish(publication);
                if (failureAt === "publish") throw problem;
            }
            update(snapshot, receipt) {
                super.update(snapshot, receipt);
                if (failureAt === "update" && receipt?.result.kind === "accepted") throw problem;
            }
        }
        const native = new FailingNativePort();
        const codec = { ...curveCodec, encode(value) {
            if (failureAt === "encode") throw problem;
            return curveCodec.encode(value);
        } };
        const session = createPluginStateSession(definePluginState({
            curve: storedValue({ initial: { points: [0, 1] }, codec }),
        }), { native, onDefect: error => defects.push(error) });
        const scope = { owner: "defect-owner", document: 0 };
        await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
        const result = await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
            command: { kind: "edit", key: "curve", value: { points: [0, 0.4, 1] } } });
        const committed = failureAt !== "encode";
        assert.equal(result.kind, committed ? "accepted" : "rejected");
        if (!committed) assert.equal(result.reason, "service-closed", "encoding is staged before any state mutation");
        assert.deepEqual(session.getSnapshot().fields.curve.value.points, committed ? [0, 0.4, 1] : [0, 1]);
        assert.equal(session.getSnapshot().fields.curve.version, committed ? 1 : 0);
        assert.equal(session.getSnapshot().history.canUndo, false, "closed service history is no longer actionable");
        assert.deepEqual(session.getSnapshot().fields.curve.readiness, { kind: "failed", reason: "service-closed" });
        assert.deepEqual(defects, [problem]);
        assert.equal(native.publications.length, committed ? 1 : 0);
        assert.deepEqual(native.closures, [{ reason: "service-closed" }]);
        assert.deepEqual(await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 2 }, command: { kind: "undo" } }),
            { kind: "rejected", reason: "service-closed" });
        session.stop();
        assert.equal(native.closures.length, 1);
    });
}

test("consecutive scalar edits retain each accepted baseline while native observations are delayed", async () => {
    for (const grouped of [false, true]) {
        const { session, native, command } = await openMixedSession();
        for (const [index, value] of [3, 4].entries()) {
            const gesture = index + 1;
            if (grouped) await command({ kind: "begin", key: "gain", gesture });
            await command({ kind: "edit", key: "gain", value, ...(grouped ? { gesture } : {}) });
            if (grouped) await command({ kind: "end", key: "gain", gesture });
        }
        await command({ kind: "undo" });
        assert.equal(session.getSnapshot().fields.gain.value, 3, "Undo second edit restores the previous accepted value before any host echo");
        assert.equal(native.publications.at(-1).operations.find(operation => operation.kind === "parameter").value, 3);
        await command({ kind: "undo" });
        assert.equal(session.getSnapshot().fields.gain.value, 2.5, "the first baseline still comes from native boot, never the default");
        await command({ kind: "redo" });
        assert.equal(session.getSnapshot().fields.gain.value, 3);
        await command({ kind: "redo" });
        assert.equal(session.getSnapshot().fields.gain.value, 4);
        session.stop();
    }
});

test("boot and accepted curve edits capture engine inputs with coherent targets and preserve honest application evidence", async () => {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const replacements = [];
    const binding = { key: "curve", dependencies: ["gain"],
        replace(input, target) { replacements.push({ input, target }); }, cancel() {}, async stop() {},
    };
    const session = createPluginStateSession(definePluginState({
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }), gain: parameter("hostGain"),
    }), { native, bindings: [binding], onDefect: error => assert.fail(`Unexpected defect: ${error}`) });
    const scope = { owner: "engine-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: {
        parameters: [{ endpoint: "hostGain", value: 2.5, min: 0, max: 10, step: 0, defaultValue: 1 }], values: {},
    } });
    const target0 = { scope, key: "curve", generation: 0 };
    assert.deepEqual(replacements, [{ input: { value: { points: [0, 1] }, parameters: { gain: 2.5 } }, target: target0 }]);
    assert.deepEqual(session.getSnapshot().fields.curve.application, { kind: "pending" });
    assert.deepEqual(session.getSnapshot().fields.curve.target, target0);
    assert.equal(native.publications.length, 0, "generation zero boot does not invent a persisted write");
    const seen = [];
    const unsubscribe = session.subscribe(snapshot => seen.push(snapshot));
    const result = await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
        command: { kind: "edit", key: "curve", value: { points: [0, 0.4, 1] } } });
    const target1 = { scope, key: "curve", generation: 1 };
    assert.equal(result.kind, "accepted");
    assert.equal(replacements.length, 2);
    assert.deepEqual(replacements[1], { input: { value: { points: [0, 0.4, 1] }, parameters: { gain: 2.5 } }, target: target1 });
    assert.ok(Object.isFrozen(replacements[1].input));
    assert.ok(Object.isFrozen(replacements[1].input.parameters));
    assert.equal(seen.length, 1, "value, history, and target pending status change in one Jotai notification");
    assert.deepEqual(seen[0].fields.curve.target, target1);
    assert.equal(seen[0].history.canUndo, true);
    const waiting = session.getSnapshot();
    await session.dispatch({ kind: "engine", target: target0, status: { kind: "sent", proof: "connection-call-returned" } });
    assert.strictEqual(session.getSnapshot(), waiting);
    await session.dispatch({ kind: "engine", target: target1, status: { kind: "sent", proof: "connection-call-returned" } });
    assert.deepEqual(session.getSnapshot().fields.curve.application, { kind: "sent", proof: "connection-call-returned" });
    assert.deepEqual(session.getSnapshot().fields.curve.persistence, { kind: "pending" }, "a returned engine send is neither native storage nor DSP acknowledgement");
    assert.equal(replacements.length, 2);
    unsubscribe();
    await session.stop();
});

test("session stop immediately rejects work and owns each engine binding's asynchronous cleanup exactly once", async () => {
    const { definePluginState, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const cleanup = Promise.withResolvers();
    const replacements = [];
    let stops = 0;
    const session = createPluginStateSession(definePluginState({ curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }) }), {
        native, onDefect: error => assert.fail(String(error)), bindings: [{ key: "curve", dependencies: [],
            replace(input, target) { replacements.push({ input, target }); }, cancel() {},
            async stop() { stops++; await cleanup.promise; },
        }],
    });
    const scope = { owner: "stop-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
    let finished = false;
    const stopping = Promise.resolve(session.stop()).then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(stops, 1);
    assert.equal(finished, false, "stop cannot report completion while binding cleanup is pending");
    assert.deepEqual(await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
        command: { kind: "edit", key: "curve", value: { points: [0, 0.4, 1] } } }), { kind: "rejected", reason: "service-closed" });
    const stopped = session.getSnapshot();
    await session.dispatch({ kind: "engine", target: replacements[0].target,
        status: { kind: "acknowledged", engineSession: "late-engine", operation: "late-operation" } });
    assert.strictEqual(session.getSnapshot(), stopped);
    assert.equal(replacements.length, 1);
    cleanup.resolve();
    await stopping;
    await session.stop();
    assert.equal(stops, 1);
    assert.equal(native.closures.length, 1);
});

test("only declared engine dependencies regenerate targets and equal host observations are silent", async () => {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const replacements = [];
    const session = createPluginStateSession(definePluginState({ gain: parameter("gain"), rate: parameter("rate"),
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => assert.fail(String(error)), bindings: [{ key: "curve", dependencies: ["gain"],
        replace(input, target) { replacements.push({ input, target }); }, cancel() {}, async stop() {},
    }] });
    const scope = { owner: "dependency-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [
        { endpoint: "gain", value: 1, min: 0, max: 10, step: 0, defaultValue: 1 },
        { endpoint: "rate", value: 2, min: 0, max: 10, step: 0, defaultValue: 1 },
    ], values: {} } });
    await session.dispatch({ kind: "engine", target: replacements[0].target, status: { kind: "sent", proof: "connection-call-returned" } });
    const applied = session.getSnapshot().fields.curve;
    await session.dispatch({ kind: "parameter", scope, endpoint: "rate", value: 3 });
    assert.strictEqual(session.getSnapshot().fields.curve, applied);
    const beforeEqual = session.getSnapshot();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => { notifications++; });
    await session.dispatch({ kind: "parameter", scope, endpoint: "rate", value: 3 });
    await session.dispatch({ kind: "parameter", scope, endpoint: "gain", value: 1 });
    assert.strictEqual(session.getSnapshot(), beforeEqual);
    assert.equal(notifications, 0);
    assert.equal(replacements.length, 1);
    await session.dispatch({ kind: "parameter", scope, endpoint: "gain", value: 4 });
    assert.equal(replacements.length, 2);
    assert.deepEqual(replacements[1].input.parameters, { gain: 4 });
    assert.equal(replacements[1].target.generation, 1);
    assert.equal(session.getSnapshot().fields.curve.version, 0, "dependency application changes do not pretend to edit the curve");
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
    assert.equal(native.publications.length, 0, "host automation neither echoes scalars nor persists the curve");
    unsubscribe();
    await session.stop();
});

test("a real engine binding waits for native inputs and supersedes preparation across document replacement", async () => {
    const { setImmediate } = await import("node:timers/promises");
    const { createEngineBinding } = await loadUIModule(repoRoot, "kit/ui/plugin-state-engine.ts");
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const held = Promise.withResolvers();
    const sent = [];
    const defects = [];
    let heldSignal;
    let session;
    const engine = createEngineBinding({
        async prepare(input, signal) {
            if (input.value.points[1] === 0.3) {
                heldSignal = signal;
                await held.promise;
            }
            return { kind: "ok", value: input.value.points.map(point => point * input.parameters.gain) };
        },
        transport: { async apply(value, permit) {
            return permit.send(() => { sent.push(value); return { kind: "sent", proof: "connection-call-returned" }; });
        }, stop() {} },
        onStatus: (target, status) => { void session.dispatch({ kind: "engine", target, status }); },
        onDefect: error => defects.push(error),
    });
    session = createPluginStateSession(definePluginState({ gain: parameter("gain"),
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => defects.push(error), bindings: [{ key: "curve", dependencies: ["gain"], ...engine }] });
    const scope = { owner: "composed-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
    assert.deepEqual(session.getSnapshot().fields.curve.application, { kind: "waiting-for-inputs" });
    assert.deepEqual(sent, []);
    const first = { ...scope, document: 1 };
    const hostGain = value => ({ endpoint: "gain", value, min: 0, max: 10, step: 0, defaultValue: 1 });
    await session.dispatch({ kind: "replaced", scope: first, native: { parameters: [hostGain(2)], values: {} } });
    await setImmediate();
    assert.deepEqual(sent, [[0, 2]]);
    await session.dispatch({ kind: "command", address: { ...first, client: 1, sequence: 1 },
        command: { kind: "edit", key: "curve", value: { points: [0, 0.3, 1] } } });
    await setImmediate();
    assert.equal(heldSignal.aborted, false);
    assert.equal(session.getSnapshot().fields.curve.application.kind, "preparing");
    const second = { ...scope, document: 2 };
    await session.dispatch({ kind: "replaced", scope: second,
        native: { parameters: [hostGain(3)], values: { curve: { points: [0, 0.9, 1] } } } });
    await setImmediate();
    assert.equal(heldSignal.aborted, true);
    assert.deepEqual(sent, [[0, 2], [0, 2.7, 3]]);
    const fresh = session.getSnapshot();
    assert.deepEqual(fresh.fields.curve.target, { scope: second, key: "curve", generation: 0 });
    assert.deepEqual(fresh.fields.curve.application, { kind: "sent", proof: "connection-call-returned" });
    assert.deepEqual(fresh.history, { canUndo: false, canRedo: false });
    held.resolve();
    await setImmediate();
    assert.strictEqual(session.getSnapshot(), fresh);
    assert.deepEqual(sent, [[0, 2], [0, 2.7, 3]], "obsolete preparation must never reach the actual transport handoff");
    assert.deepEqual(defects, []);
    await session.stop();
});

test("field-scoped versions allow unrelated edits but reject stale conditional edits after an ABA change", async () => {
    const { session, native, command } = await openMixedSession();
    await command({ kind: "edit", key: "gain", value: 3 });
    assert.equal((await command({ kind: "edit", key: "curve", expectedVersion: 0, value: { points: [0, 0.3, 1] } })).kind, "accepted");
    await command({ kind: "edit", key: "curve", expectedVersion: 1, value: { points: [0, 1] } });
    assert.equal(session.getSnapshot().fields.curve.version, 2);
    const before = session.getSnapshot();
    const writes = native.publications.length;
    assert.deepEqual(await command({ kind: "edit", key: "curve", expectedVersion: 0, value: { points: [0, 1] } }),
        { kind: "rejected", reason: "stale-version" }, "value equality does not make an obsolete observed version current");
    assert.strictEqual(session.getSnapshot(), before);
    assert.equal(native.publications.length, writes);
    assert.equal((await command({ kind: "edit", key: "curve", expectedVersion: 2, value: { points: [0, 0.6, 1] } })).kind, "accepted");
    await session.stop();
});

test("unknown command keys including object prototype names reject without changing service state", async () => {
    const { session, native, command } = await openCurveSession();
    const before = session.getSnapshot();
    for (const key of ["missing", "constructor", "toString", "__proto__"]) {
        assert.deepEqual(await command({ kind: "edit", key, value: { points: [0, 0.5, 1] } }),
            { kind: "rejected", reason: "invalid-command" });
    }
    assert.strictEqual(session.getSnapshot(), before);
    assert.equal(native.publications.length, 0);
    assert.deepEqual(await command({ kind: "edit", key: "curve", value: { points: [0, 0.5, 1] } }),
        { kind: "accepted", revision: before.revision + 1, version: 1 });
    await session.stop();
});

test("closing after native initialization fails leaves fields failed without fallback or engine work, even if open arrives late", async () => {
    const { definePluginState, parameter, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const targets = [];
    const session = createPluginStateSession(definePluginState({ gain: parameter("gain"),
        curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native, onDefect: error => assert.fail(String(error)), bindings: [{ key: "curve", dependencies: [],
        replace(input, target) { targets.push({ input, target }); }, cancel() {}, async stop() {},
    }] });
    // The platform adapter owns the failed native read and its detailed error.
    // It closes this owner instead of installing an invented empty snapshot.
    await session.stop();
    for (const field of Object.values(session.getSnapshot().fields)) {
        assert.deepEqual(field.readiness, { kind: "failed", reason: "service-closed" });
        assert.equal("value" in field, false);
    }
    assert.deepEqual(await session.dispatch({ kind: "opened", scope: { owner: "late-owner", document: 0 },
        native: { parameters: [], values: {} } }), { kind: "rejected", reason: "service-closed" });
    assert.deepEqual(native.publications, []);
    assert.deepEqual(targets, []);
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
});

test("history availability matches dispatch policy during gestures and returns with retained Undo and Redo on release", async () => {
    const { session, command } = await openMixedSession();
    await command({ kind: "edit", key: "curve", value: { points: [0, 0.3, 1] } });
    await command({ kind: "edit", key: "gain", value: 3 });
    await command({ kind: "undo" });
    assert.deepEqual(session.getSnapshot().history, { canUndo: true, canRedo: true });
    await command({ kind: "begin", key: "rate", gesture: 1 });
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
    assert.deepEqual(await command({ kind: "undo" }), { kind: "rejected", reason: "busy" });
    assert.deepEqual(await command({ kind: "redo" }), { kind: "rejected", reason: "busy" });
    await command({ kind: "end", key: "rate", gesture: 1 });
    assert.deepEqual(session.getSnapshot().history, { canUndo: true, canRedo: true });
    await command({ kind: "redo" });
    assert.equal(session.getSnapshot().fields.gain.value, 3);
    await command({ kind: "undo" });
    await command({ kind: "undo" });
    assert.deepEqual(session.getSnapshot().fields.curve.value.points, [0, 1]);
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: true });
    await session.stop();
    assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
});

test("a failed engine cleanup retains its cause without completing stop before another binding releases", async () => {
    const { definePluginState, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const problem = new Error("engine cleanup failed");
    const held = Promise.withResolvers();
    const defects = [];
    let cleanupStarted = 0;
    const session = createPluginStateSession(definePluginState({
        first: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
        second: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }),
    }), { native: new RecordingNativePort(), onDefect: error => defects.push(error), bindings: [
        { key: "first", dependencies: [], replace() {}, cancel() {}, async stop() { cleanupStarted++; throw problem; } },
        { key: "second", dependencies: [], replace() {}, cancel() {}, async stop() { cleanupStarted++; await held.promise; } },
    ] });
    let completed = false;
    const stopping = session.stop().then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cleanupStarted, 2);
    assert.equal(completed, false, "one rejection cannot abandon ownership of another binding's pending cleanup");
    held.resolve();
    await stopping;
    assert.deepEqual(defects, [problem]);
    await session.stop();
    assert.equal(cleanupStarted, 2);
});

test("scalar application status separates native observations from owned send completion and failure", async () => {
    const { session, native, scope, command } = await openMixedSession();
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "unconfirmed" });
    await command({ kind: "edit", key: "gain", value: 3 });
    const first = native.publications.at(-1).request;
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "pending" });
    const pending = session.getSnapshot();
    await session.dispatch({ kind: "parameter", scope, endpoint: "gain", value: 3 });
    assert.strictEqual(session.getSnapshot(), pending, "matching host value does not acknowledge this request");
    await session.dispatch({ kind: "published", scope, request: first, result: { kind: "observed" } });
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "sent", proof: "native-publication-processed" });
    await command({ kind: "begin", key: "gain", gesture: 1 });
    assert.equal(session.getSnapshot().fields.gain.application.kind, "sent", "gesture boundary does not erase evidence for an unchanged value");
    await command({ kind: "edit", key: "gain", gesture: 1, value: 4 });
    const obsolete = native.publications.at(-1).request;
    await command({ kind: "edit", key: "gain", gesture: 1, value: 5 });
    const current = native.publications.at(-1).request;
    await session.dispatch({ kind: "published", scope, request: obsolete, result: { kind: "observed" } });
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "pending" });
    await session.dispatch({ kind: "published", scope, request: current, result: { kind: "failed", reason: "send-failed" } });
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "failed", error: { kind: "transport", message: "send-failed" } });
    await command({ kind: "end", key: "gain", gesture: 1 });
    assert.equal(session.getSnapshot().fields.gain.application.kind, "failed");
    const writes = native.publications.length;
    await session.dispatch({ kind: "parameter", scope, endpoint: "gain", value: 6 });
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "unconfirmed" });
    assert.equal(native.publications.length, writes);
    await command({ kind: "undo" });
    assert.equal(session.getSnapshot().fields.gain.value, 3);
    assert.deepEqual(session.getSnapshot().fields.gain.application, { kind: "pending" });
    await session.stop();
});

test("stored persistence and gesture lifecycle preserve the current engine target so matching completion can settle", async () => {
    const { definePluginState, storedValue } = await definitionModule;
    const { createPluginStateSession } = await sessionModule;
    const native = new RecordingNativePort();
    const replacements = [];
    const session = createPluginStateSession(definePluginState({ curve: storedValue({ initial: { points: [0, 1] }, codec: curveCodec }) }), {
        native, onDefect: error => assert.fail(String(error)), bindings: [{ key: "curve", dependencies: [],
            replace(input, target) { replacements.push({ input, target }); }, cancel() {}, async stop() {},
        }],
    });
    const scope = { owner: "engine-owner", document: 0 };
    await session.dispatch({ kind: "opened", scope, native: { parameters: [], values: {} } });
    let sequence = 0;
    const command = command => session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
    await command({ kind: "begin", key: "curve", gesture: 1 });
    await command({ kind: "edit", key: "curve", value: { points: [0, 0.4, 1] }, gesture: 1 });
    const target = replacements.at(-1).target;
    assert.deepEqual(target, { scope, key: "curve", generation: 1 });
    await session.dispatch({ kind: "engine", target, status: { kind: "preparing" } });
    await session.dispatch({ kind: "published", scope, request: native.publications.at(-1).request, result: { kind: "observed" } });
    assert.strictEqual(session.getSnapshot().fields.curve.target, target);
    assert.equal(session.getSnapshot().fields.curve.persistence.kind, "observed-in-native-state");
    await command({ kind: "end", key: "curve", gesture: 1 });
    assert.strictEqual(session.getSnapshot().fields.curve.target, target);
    await command({ kind: "begin", key: "curve", gesture: 2 });
    assert.strictEqual(session.getSnapshot().fields.curve.target, target);
    await session.dispatch({ kind: "detached", scope, client: 1 });
    assert.strictEqual(session.getSnapshot().fields.curve.target, target);
    await session.dispatch({ kind: "engine", target, status: { kind: "sent", proof: "native-publication-processed" } });
    assert.deepEqual(session.getSnapshot().fields.curve.application, { kind: "sent", proof: "native-publication-processed" });
    assert.equal(session.getSnapshot().history.canUndo, true);
    assert.equal(replacements.length, 2, "persistence and gesture boundaries do not invent a new engine request");
    await session.stop();
});
