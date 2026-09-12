import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { createPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-client.ts");
const { definePluginState, parameter, storedValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const codec = {
    parse(input) {
        if (!Array.isArray(input) || input.length < 2 || !input.every(value => typeof value === "number" && Number.isFinite(value)))
            return { kind: "error", message: "Expected finite curve points." };
        return { kind: "ok", value: Object.freeze([...input]) };
    },
    encode(value) { return [...value]; },
    equals(a, b) { return a.length === b.length && a.every((value, i) => value === b[i]); },
};
const definition = definePluginState({ gain: parameter("gain"), curve: storedValue({ initial: [0, 1], codec }) });
const scope = { owner: "owner", document: 0 };
const ready = (value, version = 0, persistence = "not-written") => ({
    readiness: { kind: "ready" }, value, version, persistence: { kind: persistence },
});
const snapshot = (revision = 1, curve = [0, 1], gain = 0.65) => ({
    scope, revision,
    fields: { gain: ready(gain, 0, "host-managed"), curve: ready(curve, revision - 1) },
    history: { canUndo: revision > 1, canRedo: false },
});

// The adapter seam delivers parsed channel messages. This fixture merely holds
// and serializes messages; it never applies edits, assigns versions, or runs Undo.
class ControlledChannel {
    sent = [];
    listener;
    onSend;
    subscribe(listener) {
        assert.equal(this.listener, undefined);
        this.listener = listener;
        return () => { this.listener = undefined; };
    }
    send(message) {
        assert.ok(this.listener, "subscribe before sending attach to avoid losing a synchronous reply");
        this.sent.push(JSON.parse(JSON.stringify(message)));
        this.onSend?.(message);
    }
    deliver(message) { this.listener?.(JSON.parse(JSON.stringify(message))); }
}

function attached(state = snapshot(), request = 1, client = 3) {
    return { kind: "attached", request, scope: state.scope, client, revision: state.revision, state };
}

test("client waits for host-backed state, hydrates through the channel, and Jotai observers see later updates", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    assert.equal(client.getSnapshot().kind, "connecting");
    assert.deepEqual(channel.sent, [{ kind: "attach", request: 1 }]);
    assert.deepEqual(await client.dispatch({ kind: "edit", key: "gain", value: 1 }), { kind: "rejected", reason: "not-ready" });
    assert.equal(channel.sent.length, 1);
    const observed = [];
    const unsubscribe = client.subscribe(state => observed.push(state));
    channel.deliver(attached());
    const first = client.getSnapshot();
    assert.equal(first.kind, "ready");
    assert.equal(first.state.fields.gain.value, 0.65);
    assert.deepEqual(first.state.fields.curve.value, [0, 1]);
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [0, 1], 0.9) });
    assert.equal(client.getSnapshot().state.fields.gain.value, 0.9);
    assert.strictEqual(client.getSnapshot().state.fields.curve.value, first.state.fields.curve.value,
        "unchanged curve values should retain identity after crossing JSON");
    assert.strictEqual(observed.at(-1), client.getSnapshot());
    unsubscribe();
    const count = observed.length;
    channel.deliver({ kind: "update", scope, revision: 3, state: snapshot(3, [0, 0.5, 1], 0.9) });
    assert.equal(observed.length, count);
    client.stop();
    assert.equal(channel.listener, undefined);
});

test("an update received during attach wins over the older attach snapshot; duplicate attach cannot roll it back", () => {
    const channel = new ControlledChannel();
    channel.onSend = message => {
        if (message.kind !== "attach") return;
        channel.deliver({ kind: "update", scope, revision: 4, state: snapshot(4, [1, 0]) });
        channel.deliver(attached(snapshot(2, [0, 1]), message.request));
    };
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    assert.equal(client.getSnapshot().kind, "ready");
    assert.equal(client.getSnapshot().state.revision, 4);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [1, 0]);
    const current = client.getSnapshot();
    channel.deliver(attached(snapshot(1)));
    channel.deliver({ kind: "update", scope: { owner: "unknown", document: 100 }, revision: 999, state: {
        ...snapshot(999), scope: { owner: "unknown", document: 100 },
    } });
    assert.strictEqual(client.getSnapshot(), current);
    client.stop();
});

const receipt = (sequence, result, client = 3, addressScope = scope) => ({
    address: { ...addressScope, client, sequence }, result,
});

test("one accepted update clears its draft and pending status in one observable transition", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    const pending = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    const observed = [];
    const remove = client.subscribe(state => observed.push({ value: state.state.fields.curve.value, pending: state.pendingFields }));
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [1, 0]), receipt: receipt(1, { kind: "accepted", revision: 2 }) });
    assert.equal((await pending).kind, "accepted");
    assert.deepEqual(observed, [{ value: [1, 0], pending: [] }]);
    remove(); client.stop();
});

test("compound edits mark every affected field pending without optimistic values until their receipt arrives", async t => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    t.after(() => client.stop());
    channel.deliver(attached());
    const before = client.getSnapshot().state;
    const editing = client.dispatch({ kind: "edit-many", edits: [
        { key: "gain", value: 0.9 }, { key: "curve", value: [1, 0] },
    ] });
    assert.deepEqual([...client.getSnapshot().pendingFields].sort(), ["curve", "gain"]);
    assert.deepEqual(client.getSnapshot().state, before, "a compound edit must not draw partially accepted values");
    const command = channel.sent.at(-1);
    assert.equal(command.command.kind, "edit-many");
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [1, 0], 0.9) });
    assert.deepEqual([...client.getSnapshot().pendingFields].sort(), ["curve", "gain"],
        "an authoritative snapshot cannot invent this command's acceptance");
    const accepted = { kind: "accepted", revision: 2, changed: true };
    channel.deliver({ kind: "receipt", ...receipt(command.sequence, accepted) });
    assert.deepEqual(await editing, accepted);
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    assert.equal(client.getSnapshot().state.fields.gain.value, 0.9);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [1, 0]);
});

test("compound rejection clears only its own pending fields while overlapping edits retain their receipts and drafts", async t => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    t.after(() => client.stop());
    channel.deliver(attached());
    const first = client.dispatch({ kind: "edit-many", edits: [
        { key: "gain", value: 0.7 }, { key: "curve", value: [1, 0] },
    ] });
    const second = client.dispatch({ kind: "edit-many", edits: [{ key: "gain", value: 0.9 }] });
    const third = client.dispatch({ kind: "edit", key: "curve", value: [0, 0.8, 1] });
    assert.deepEqual([...client.getSnapshot().pendingFields].sort(), ["curve", "gain"]);
    assert.equal(client.getSnapshot().state.fields.gain.value, 0.65, "compound values wait for the owner");
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.8, 1], "ordinary edits still draw their draft");
    const singleAccepted = { kind: "accepted", revision: 3 };
    channel.deliver({ kind: "update", scope, revision: 3, state: snapshot(3, [0, 0.8, 1]), receipt: receipt(3, singleAccepted) });
    assert.deepEqual(await third, singleAccepted);
    assert.deepEqual([...client.getSnapshot().pendingFields].sort(), ["curve", "gain"],
        "a newer ordinary receipt cannot settle an older compound command");
    const rejected = { kind: "rejected", reason: "stale-version" };
    channel.deliver({ kind: "receipt", ...receipt(1, rejected) });
    assert.deepEqual(await first, rejected);
    assert.deepEqual(client.getSnapshot().pendingFields, ["gain"], "the other compound command remains pending");
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.8, 1], "rejection never rolls back newer input");
    const accepted = { kind: "accepted", revision: 4 };
    channel.deliver({ kind: "update", scope, revision: 4, state: snapshot(4, [0, 0.8, 1], 0.9), receipt: receipt(2, accepted) });
    assert.deepEqual(await second, accepted);
    assert.deepEqual(client.getSnapshot().pendingFields, []);
});

test("reset and closure interrupt compound pending fields without carrying them into a new attachment", async t => {
    for (const reason of ["reset", "closed"]) {
        const channel = new ControlledChannel();
        const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
        t.after(() => client.stop());
        channel.deliver(attached());
        const editing = client.dispatch({ kind: "edit-many", edits: [
            { key: "gain", value: 0.9 }, { key: "curve", value: [1, 0] },
        ] });
        assert.deepEqual([...client.getSnapshot().pendingFields].sort(), ["curve", "gain"]);
        const nextScope = { ...scope, document: 1 };
        channel.deliver(reason === "reset" ? { kind: "reset", scope: nextScope } : { kind: "closed", reason: "service-closed" });
        assert.deepEqual(await editing, { kind: "interrupted", reason, acceptance: "unknown" });
        if (reason === "reset") {
            const restored = { ...snapshot(), scope: nextScope };
            channel.deliver(attached(restored, 2, 4));
            assert.deepEqual(client.getSnapshot().pendingFields, []);
            assert.deepEqual(client.getSnapshot().state, restored);
        } else assert.deepEqual(client.getSnapshot(), { kind: "closed" });
        const settled = client.getSnapshot();
        channel.deliver({ kind: "receipt", ...receipt(1, { kind: "accepted", revision: 2 }) });
        assert.strictEqual(client.getSnapshot(), settled, "a late receipt cannot revive interrupted pending fields");
        assert.equal(channel.sent.filter(message => message.kind === "command").length, 1, "interrupted commands are never replayed");
    }
});

test("local edits draw immediately while exact receipts settle independently of snapshot order", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    const firstInput = [0, 0.3, 1];
    const first = client.dispatch({ kind: "edit", key: "curve", value: firstInput });
    const second = client.dispatch({ kind: "edit", key: "curve", value: [0, 0.8, 1] });
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.8, 1]);
    assert.equal(client.getSnapshot().state.revision, 1, "local drawing is not an accepted service revision");
    assert.deepEqual(client.getSnapshot().pendingFields, ["curve"]);
    firstInput[1] = 0.99;
    assert.deepEqual(channel.sent.slice(1), [
        { kind: "command", scope, client: 3, sequence: 1, command: { kind: "edit", key: "curve", value: [0, 0.3, 1] } },
        { kind: "command", scope, client: 3, sequence: 2, command: { kind: "edit", key: "curve", value: [0, 0.8, 1] } },
    ]);
    let firstSettled = false;
    void first.then(() => { firstSettled = true; });
    const secondResult = { kind: "accepted", revision: 3, version: 2 };
    channel.deliver({ kind: "update", scope, revision: 3, state: snapshot(3, [0, 0.8, 1]), receipt: receipt(2, secondResult) });
    assert.deepEqual(await second, secondResult);
    assert.equal(firstSettled, false, "one receipt does not invent another command's acceptance");
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.8, 1], "older draft must not resurface");
    const firstResult = { kind: "accepted", revision: 2, version: 1 };
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [0, 0.3, 1]), receipt: receipt(1, firstResult) });
    assert.deepEqual(await first, firstResult, "old snapshot still carries a useful correlated receipt");
    assert.equal(client.getSnapshot().state.revision, 3);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.8, 1]);
    client.stop();
});

test("local validation cannot create a wire sequence gap, and only the matching rejection clears a draft", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    assert.deepEqual(await client.dispatch({ kind: "edit", key: "curve", value: [NaN, 1] }), { kind: "rejected", reason: "invalid-value" });
    assert.equal(channel.sent.length, 1);
    const editing = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.equal(channel.sent.at(-1).sequence, 1, "only sent commands consume native sequence numbers");
    let settled = false;
    void editing.then(() => { settled = true; });
    const rejected = { kind: "rejected", reason: "busy" };
    channel.deliver({ kind: "receipt", ...receipt(1, rejected, 99) });
    channel.deliver({ kind: "receipt", ...receipt(1, rejected, 3, { owner: "prior", document: 0 }) });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [1, 0]);
    channel.deliver({ kind: "receipt", ...receipt(1, rejected) });
    assert.deepEqual(await editing, rejected);
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 1]);
    client.stop();
});

test("document reset clears drafts, settles uncertain commands honestly, and restarts numbering without replay", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    const old = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    let oldResult;
    void old.then(result => { oldResult = result; });
    const nextScope = { owner: "owner", document: 1 };
    channel.deliver({ kind: "reset", scope: nextScope });
    await Promise.resolve();
    assert.deepEqual(oldResult, { kind: "interrupted", reason: "reset", acceptance: "unknown" });
    assert.equal(client.getSnapshot().kind, "connecting");
    assert.deepEqual(channel.sent.at(-1), { kind: "attach", request: 2 });
    const nextState = { ...snapshot(5, [0.2, 0.4]), scope: nextScope };
    channel.deliver(attached(nextState, 2));
    const fresh = client.dispatch({ kind: "edit", key: "curve", value: [0.4, 0.6] });
    assert.equal(channel.sent.at(-1).sequence, 1);
    assert.deepEqual(channel.sent.at(-1).scope, nextScope);
    let freshResult;
    void fresh.then(result => { freshResult = result; });
    channel.deliver({ kind: "receipt", ...receipt(1, { kind: "accepted", revision: 2, version: 1 }) });
    await Promise.resolve();
    assert.equal(freshResult, undefined);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0.4, 0.6]);
    client.stop();
    await Promise.resolve();
    assert.deepEqual(freshResult, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(channel.listener, undefined);
    assert.equal(channel.sent.filter(message => message.kind === "command").length, 2, "reset/close must never replay an uncertain command");
});

test("an edit requested by a Jotai observer cannot overtake the edit being displayed", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    let nested;
    const unsubscribe = client.subscribe(current => {
        if (!nested && current.kind === "ready" && current.state.fields.curve.value[1] === 0.3) {
            nested = client.dispatch({ kind: "edit", key: "curve", value: [0, 0.7, 1] });
        }
    });
    const outer = client.dispatch({ kind: "edit", key: "curve", value: [0, 0.3, 1] });
    assert.ok(nested);
    assert.deepEqual(channel.sent.slice(1).map(message => [message.sequence, message.command.value]), [
        [1, [0, 0.3, 1]], [2, [0, 0.7, 1]],
    ]);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.7, 1]);
    unsubscribe();
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [0, 0.3, 1]), receipt: receipt(1, { kind: "accepted", revision: 2 }) });
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.7, 1], "newer local input survives an older acceptance");
    channel.deliver({ kind: "update", scope, revision: 3, state: snapshot(3, [0, 0.7, 1]), receipt: receipt(2, { kind: "accepted", revision: 3 }) });
    assert.equal((await outer).kind, "accepted");
    assert.equal((await nested).kind, "accepted");
    client.stop();
});

test("a different lifetime's update during attach cannot hide a newer matching snapshot", () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver({ kind: "update", scope, revision: 4, state: snapshot(4, [0.9, 0.1]) });
    const prior = { owner: "old-owner", document: 99 };
    channel.deliver({ kind: "update", scope: prior, revision: 999, state: { ...snapshot(999, [0, 0]), scope: prior } });
    channel.deliver(attached(snapshot(2)));
    assert.equal(client.getSnapshot().state.revision, 4);
    assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0.9, 0.1]);
    client.stop();
});

test("synchronous channel closure during subscription releases the subscription and never sends attach", () => {
    const channel = new ControlledChannel();
    channel.subscribe = listener => {
        channel.listener = listener;
        listener({ kind: "closed", reason: "service-closed" });
        return () => { channel.listener = undefined; };
    };
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(channel.listener, undefined);
    assert.deepEqual(channel.sent, []);
    client.stop();
});

test("a send that throws after starting settles unknown acceptance and closes without retry", async () => {
    const channel = new ControlledChannel();
    const problem = new Error("connection failed after handoff");
    const defects = [];
    const client = createPluginStateClient(definition, { channel, onDefect: error => defects.push(error) });
    channel.deliver(attached());
    channel.onSend = message => { if (message.kind === "command") throw problem; };
    const result = await client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.deepEqual(result, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    assert.deepEqual(defects, [problem]);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(channel.listener, undefined);
    assert.deepEqual(await client.dispatch({ kind: "undo" }), { kind: "rejected", reason: "service-closed" });
    assert.equal(channel.sent.filter(message => message.kind === "command").length, 1);
});

test("failed attach is visible and an authoritative worker-ready notification allows a fresh attach", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver({ kind: "attach-failed", request: 99, reason: "not-ready" });
    assert.equal(client.getSnapshot().kind, "connecting");
    channel.deliver({ kind: "attach-failed", request: 1, reason: "not-ready" });
    assert.deepEqual(client.getSnapshot(), { kind: "failed", reason: "not-ready" });
    assert.equal((await client.dispatch({ kind: "undo" })).kind, "rejected");
    channel.deliver({ kind: "owner-changed", scope });
    assert.deepEqual(channel.sent.at(-1), { kind: "attach", request: 2 });
    channel.deliver(attached(snapshot(), 2));
    assert.equal(client.getSnapshot().kind, "ready");
    client.stop();
});

test("an encoder defect before sending rejects that edit and closes without leaking a draft", async () => {
    const channel = new ControlledChannel();
    const problem = new Error("bad encoder");
    const defects = [];
    const broken = definePluginState({ curve: storedValue({ initial: [0, 1], codec: {
        ...codec, encode() { throw problem; },
    } }) });
    const client = createPluginStateClient(broken, { channel, onDefect: error => defects.push(error) });
    channel.deliver(attached());
    const result = await client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.deepEqual(result, { kind: "rejected", reason: "service-closed" });
    assert.deepEqual(defects, [problem]);
    assert.deepEqual(channel.sent, [{ kind: "attach", request: 1 }]);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(channel.listener, undefined);
});

test("close during local notification rejects unsent queued edits without pretending they reached the service", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    let queued;
    const unsubscribe = client.subscribe(current => {
        if (current.kind === "ready" && current.pendingFields.length && !queued) {
            queued = client.dispatch({ kind: "edit", key: "curve", value: [0.4, 0.6] });
            client.stop();
        }
    });
    const first = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.deepEqual(await first, { kind: "rejected", reason: "service-closed" });
    assert.deepEqual(await queued, { kind: "rejected", reason: "service-closed" });
    assert.deepEqual(channel.sent, [{ kind: "attach", request: 1 }]);
    unsubscribe();
});

test("a broken GUI observer cannot block other observers or erase a correlated edit result", async () => {
    const channel = new ControlledChannel();
    const problem = new Error("view render failed");
    const defects = [];
    const client = createPluginStateClient(definition, { channel, onDefect: error => defects.push(error) });
    channel.deliver(attached());
    let sawDraft = false;
    const removeBad = client.subscribe(current => { if (current.kind === "ready" && current.pendingFields.length) throw problem; });
    const removeGood = client.subscribe(current => { if (current.kind === "ready" && current.pendingFields.length) sawDraft = true; });
    const edited = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.equal(sawDraft, true);
    assert.ok(defects.includes(problem));
    assert.equal(channel.sent.at(-1).sequence, 1);
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [1, 0]), receipt: receipt(1, { kind: "accepted", revision: 2 }) });
    assert.deepEqual(await edited, { kind: "accepted", revision: 2 });
    assert.equal(client.getSnapshot().kind, "ready");
    removeBad();
    removeGood();
    client.stop();
});

test("a projection defect closes the view but preserves acceptance already supplied in the parsed reply", async () => {
    const channel = new ControlledChannel();
    const problem = new Error("curve equality failed");
    const defects = [];
    const broken = definePluginState({ curve: storedValue({ initial: [0, 1], codec: {
        ...codec, equals() { throw problem; },
    } }) });
    const client = createPluginStateClient(broken, { channel, onDefect: error => defects.push(error) });
    channel.deliver(attached());
    const editing = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    const accepted = { kind: "accepted", revision: 2, version: 1 };
    channel.deliver({ kind: "update", scope, revision: 2, state: snapshot(2, [1, 0]), receipt: receipt(1, accepted) });
    assert.deepEqual(await editing, accepted);
    assert.deepEqual(defects, [problem]);
    assert.equal(client.getSnapshot().kind, "closed");
    assert.equal(channel.listener, undefined);
});

test("inherited object keys are not plugin fields and do not consume command sequences", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    for (const key of ["constructor", "toString", "__proto__"]) {
        assert.deepEqual(await client.dispatch({ kind: "edit", key, value: 0.5 }), { kind: "rejected", reason: "invalid-command" });
    }
    const valid = client.dispatch({ kind: "edit", key: "gain", value: 0.8 });
    assert.equal(channel.sent.at(-1).sequence, 1);
    client.stop();
    assert.equal((await valid).kind, "interrupted");
});

test("attach send failure closes the client and releases the listener instead of leaving startup pending", () => {
    const channel = new ControlledChannel();
    const problem = new Error("view connection unavailable");
    const defects = [];
    channel.onSend = () => { throw problem; };
    const client = createPluginStateClient(definition, { channel, onDefect: error => defects.push(error) });
    assert.equal(client.getSnapshot().kind, "closed");
    assert.deepEqual(defects, [problem]);
    assert.equal(channel.listener, undefined);
});

test("retaining a last known value in failed readiness does not make it editable", async () => {
    const channel = new ControlledChannel();
    const client = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached());
    const failed = snapshot(2);
    failed.fields.curve = { ...failed.fields.curve, readiness: { kind: "failed", reason: "service-closed" } };
    channel.deliver({ kind: "update", scope, revision: 2, state: failed });
    const editing = client.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.deepEqual(channel.sent, [{ kind: "attach", request: 1 }]);
    assert.deepEqual(await editing, { kind: "rejected", reason: "not-ready" });
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    channel.deliver({ kind: "closed", reason: "service-closed" });
});

test("remounted clients send their assigned incarnation and cannot settle a new ticket with an old receipt", async () => {
    const channel = new ControlledChannel();
    const old = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached(snapshot(), 1, 3));
    const oldTicket = old.dispatch({ kind: "edit", key: "curve", value: [1, 0] });
    assert.equal(channel.sent.at(-1).client, 3);
    old.stop();
    assert.deepEqual(await oldTicket, { kind: "interrupted", reason: "closed", acceptance: "unknown" });
    const current = createPluginStateClient(definition, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached(snapshot(), 1, 4));
    const ticket = current.dispatch({ kind: "edit", key: "curve", value: [0, 0.5, 1] });
    assert.deepEqual(channel.sent.at(-1), { kind: "command", scope, client: 4, sequence: 1,
        command: { kind: "edit", key: "curve", value: [0, 0.5, 1] } });
    let settled = false;
    void ticket.then(() => { settled = true; });
    channel.deliver({ kind: "receipt", ...receipt(1, { kind: "accepted", revision: 2, version: 1 }, 3) });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(current.getSnapshot().pendingFields, ["curve"]);
    channel.deliver({ kind: "receipt", ...receipt(1, { kind: "rejected", reason: "busy" }, 4) });
    assert.deepEqual(await ticket, { kind: "rejected", reason: "busy" });
    assert.deepEqual(current.getSnapshot().pendingFields, []);
    current.stop();
});

test("a codec-valid value over the native wire budget is rejected before sequence allocation and the next edit remains usable", async () => {
    const textCodec = {
        parse: value => typeof value === "string" ? { kind: "ok", value } : { kind: "error", message: "Text required." },
        encode: value => value, equals: (a, b) => a === b,
    };
    const fields = definePluginState({ text: storedValue({ initial: "initial", codec: textCodec }) });
    const channel = new ControlledChannel();
    const client = createPluginStateClient(fields, { channel, onDefect: error => assert.fail(String(error)) });
    channel.deliver(attached({ scope, revision: 1, fields: { text: ready("initial") }, history: { canUndo: false, canRedo: false } }));
    const rejected = client.dispatch({ kind: "edit", key: "text", value: "x".repeat(16 * 1024 * 1024) });
    assert.equal(channel.sent.length, 1, "oversized input must never cross the native send seam");
    assert.deepEqual(await rejected, { kind: "rejected", reason: "invalid-value" });
    assert.deepEqual(client.getSnapshot().pendingFields, []);
    assert.equal(client.getSnapshot().state.fields.text.value, "initial");
    const valid = client.dispatch({ kind: "edit", key: "text", value: "next" });
    assert.equal(channel.sent.at(-1).sequence, 1);
    channel.deliver({ kind: "receipt", ...receipt(1, { kind: "accepted", revision: 2, version: 1 }) });
    assert.deepEqual(await valid, { kind: "accepted", revision: 2, version: 1 });
    assert.equal(client.getSnapshot().kind, "ready");
    client.stop();
});
