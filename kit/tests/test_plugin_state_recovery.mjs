import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { definePluginState, storedValue, parameter } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createPluginStateSession } = await loadUIModule(root, "kit/ui/plugin-state-session.ts");
const { createEngineBinding } = await loadUIModule(root, "kit/ui/plugin-state-engine.ts");
const { createPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-client.ts");
const { encodeStateSnapshot, parseClientMessage, parseServiceMessage } = await loadUIModule(root, "kit/ui/plugin-state-protocol.ts");
const codec = {
    parse(value) {
        return Array.isArray(value) && value.length >= 2 && value.every(point => typeof point === "number" && Number.isFinite(point))
            ? { kind: "ok", value: Object.freeze([...value]) }
            : { kind: "error", message: "Expected finite curve points." };
    },
    encode(value) { return [...value]; },
    equals(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); },
};

test("explicit stored recovery establishes a cold baseline while ordinary edits stay blocked and unrelated history survives", { timeout: 2000 }, async () => {
    const scope = { owner: "recovery-owner", document: 0 };
    const definition = definePluginState({ gain: parameter("gain"), curve: storedValue({ initial: [0, 1], codec }) });
    const publications = [], preparations = [], payloads = [], statusJobs = [], defects = [];
    let finishDelivery;
    const delivered = new Promise(resolve => { finishDelivery = resolve; });
    let session;
    const binding = createEngineBinding({
        prepare(input) {
            preparations.push(input.value);
            return { kind: "ok", value: input.value.map(point => point * 2) };
        },
        transport: {
            async apply(payload, permit) {
                return permit.send(() => {
                    payloads.push(payload);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
            },
            stop() {},
        },
        onStatus(target, status) {
            const processed = session.dispatch({ kind: "engine", target, status });
            statusJobs.push(processed);
            if (status.kind === "sent") statusJobs.push(processed.then(() => finishDelivery()));
        },
        onDefect: error => defects.push(error),
    });
    session = createPluginStateSession(definition, {
        native: { publish(value) { publications.push(value); }, update() {}, close() {} },
        bindings: [{ key: "curve", dependencies: [], replace: (input, target) => binding.replace(input, target), cancel: binding.cancel, stop: binding.stop }],
        onDefect: error => defects.push(error),
    });
    let sequence = 0;
    const command = command => session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
    try {
        await session.dispatch({ kind: "opened", scope, native: { values: { curve: "corrupt stored document" }, parameters: [
            { endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
        ] } });
        const cold = session.getSnapshot().fields.curve;
        assert.deepEqual(cold.readiness, { kind: "failed", reason: "invalid-state" });
        assert.equal(Object.hasOwn(cold, "value"), false, "the authored initial value is not a substitute for corrupt storage");
        assert.deepEqual(preparations, []);
        assert.deepEqual(publications, []);
        assert.deepEqual(await command({ kind: "edit", key: "curve", value: [0, 0.4, 1], expectedVersion: 0 }),
            { kind: "rejected", reason: "not-ready" }, "ordinary edits retain their existing invalid-state guard");
        assert.strictEqual(session.getSnapshot().fields.curve, cold);
        const gain = await command({ kind: "edit", key: "gain", value: 3 });
        assert.equal(gain.kind, "accepted");
        assert.ok(gain.historyEntry);
        const laterGain = await command({ kind: "edit", key: "gain", value: 4 });
        await command({ kind: "undo", expectedEntry: laterGain.historyEntry });
        const priorHistory = session.getSnapshot().history;
        assert.deepEqual(priorHistory.undoEntry, gain.historyEntry);
        assert.deepEqual(priorHistory.redoEntry, laterGain.historyEntry);
        const beforeRepair = publications.length;

        const repaired = await command({ kind: "recover", key: "curve", value: [0, 0.4, 1], expectedVersion: 0 });
        assert.equal(repaired.kind, "accepted", "a valid complete value must recover an invalid stored field");
        assert.equal(cold.version, 0, "invalid stored state has the explicit recovery baseline version");
        assert.equal(repaired.changed, true);
        assert.equal(repaired.version, 1);
        assert.equal(repaired.historyEntry, undefined, "the failed field had no accepted before-value");
        assert.deepEqual(session.getSnapshot().fields.curve.readiness, { kind: "ready" });
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.equal(session.getSnapshot().fields.curve.version, 1);
        assert.deepEqual(session.getSnapshot().history, priorHistory, "recovering the curve retains the gain entry without claiming it as its own");
        assert.deepEqual(publications.slice(beforeRepair).map(publication => publication.operations), [
            [{ kind: "stored", key: "curve", value: [0, 0.4, 1] }],
        ]);
        await delivered;
        await Promise.all(statusJobs);
        assert.deepEqual(preparations, [[0, 0.4, 1]]);
        assert.deepEqual(payloads, [[0, 0.8, 2]], "the actual binding prepares the accepted recovered value once");
        const beforeStale = session.getSnapshot();
        const count = publications.length;
        assert.deepEqual(await command({ kind: "recover", key: "curve", value: [1, 0], expectedVersion: 0 }),
            { kind: "rejected", reason: "stale-version" });
        assert.strictEqual(session.getSnapshot(), beforeStale);
        assert.equal(publications.length, count);
        assert.deepEqual(preparations, [[0, 0.4, 1]]);
        assert.equal((await command({ kind: "undo", expectedEntry: gain.historyEntry })).kind, "accepted");
        assert.equal(session.getSnapshot().fields.gain.value, 2.5);
        assert.deepEqual(session.getSnapshot().fields.curve.value, [0, 0.4, 1]);
        assert.equal(session.getSnapshot().history.canUndo, false);
        assert.deepEqual(defects, []);
    } finally { await session.stop(); await Promise.all(statusJobs); }
});

test("recovery refuses invalid values, wrong versions, gestures, and fields without recoverable stored input", async () => {
    const scope = { owner: "failed-gates", document: 0 };
    const definition = definePluginState({ curve: storedValue({ initial: [0, 1], codec }), ready: storedValue({ initial: [0, 1], codec }), gain: parameter("gain"), absent: parameter("absent") });
    const publications = [];
    const session = createPluginStateSession(definition, { native: { publish(value) { publications.push(value); }, update() {}, close() {} }, onDefect: error => assert.fail(String(error)) });
    let sequence = 0;
    const command = command => session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
    try {
        assert.deepEqual(await command({ kind: "edit", key: "curve", value: [0, 0.4, 1] }), { kind: "rejected", reason: "not-ready" });
        assert.deepEqual(await command({ kind: "recover", key: "curve", value: [0, 0.4, 1], expectedVersion: 0 }), { kind: "rejected", reason: "not-ready" });
        await session.dispatch({ kind: "opened", scope, native: { values: { curve: "corrupt" }, parameters: [
            { endpoint: "gain", value: 2.5, min: 12, max: -12, step: 0.5, defaultValue: 1 },
        ] } });
        const failed = session.getSnapshot();
        assert.deepEqual(failed.fields.gain.readiness, { kind: "failed", reason: "invalid-state" });
        assert.deepEqual(failed.fields.absent.readiness, { kind: "failed", reason: "missing-parameter" });
        for (const [action, reason] of [
            [{ kind: "edit", key: "curve", value: [0, 1], expectedVersion: 0 }, "not-ready"],
            [{ kind: "recover", key: "curve", value: [], expectedVersion: 0 }, "invalid-value"],
            [{ kind: "recover", key: "curve", value: [0, 1], expectedVersion: 1 }, "invalid-command"],
            [{ kind: "recover", key: "curve", value: [0, 1] }, "invalid-command"],
            [{ kind: "recover", key: "ready", value: [1, 0], expectedVersion: 0 }, "not-ready"],
            [{ kind: "begin", key: "curve", gesture: 1 }, "not-ready"],
            [{ kind: "end", key: "curve", gesture: 1 }, "not-ready"],
            [{ kind: "recover", key: "gain", value: 3, expectedVersion: 0 }, "not-ready"],
            [{ kind: "recover", key: "absent", value: 3, expectedVersion: 0 }, "not-ready"],
        ]) {
            assert.deepEqual(await command(action), { kind: "rejected", reason });
            assert.strictEqual(session.getSnapshot(), failed);
            assert.deepEqual(publications, []);
        }
        await session.stop();
        assert.deepEqual(await command({ kind: "recover", key: "curve", value: [0, 1], expectedVersion: 0 }), { kind: "rejected", reason: "service-closed" });
        assert.deepEqual(publications, []);
    } finally { await session.stop(); }
});

test("a real client exposes a parsed recovery draft while the actual owner remains failed until delivery", async () => {
    const scope = { owner: "recovery-draft", document: 0 };
    const definition = definePluginState({ curve: storedValue({ initial: [0, 1], codec }) });
    const publications = [], held = [];
    let receive;
    const deliver = body => {
        const parsed = parseClientMessage(definition, JSON.parse(JSON.stringify(body)));
        assert.equal(parsed.kind, "ok");
        receive?.(parsed.value);
    };
    const owner = createPluginStateSession(definition, { native: {
        publish(value) { publications.push(value); },
        update(state, receipt) { deliver({ kind: "update", scope, revision: state.revision,
            state: encodeStateSnapshot(definition, state), ...(receipt ? { receipt } : {}) }); },
        close() {},
    }, onDefect: error => assert.fail(String(error)) });
    await owner.dispatch({ kind: "opened", scope, native: { values: { curve: "corrupt" }, parameters: [] } });
    const client = createPluginStateClient(definition, { channel: {
        subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
        send(message) {
            if (message.kind === "attach") {
                const state = owner.getSnapshot();
                deliver({ kind: "attached", request: message.request, client: 1, scope, revision: state.revision,
                    state: encodeStateSnapshot(definition, state) });
            } else held.push(JSON.parse(JSON.stringify(message)));
        },
    }, onDefect: error => assert.fail(String(error)) });
    const release = async () => {
        for (const message of held.splice(0)) {
            const parsed = parseServiceMessage({ kind: "command", address: { ...message.scope, client: 1, sequence: message.sequence }, command: message.command });
            assert.equal(parsed.kind, "ok");
            assert.equal(parsed.value.kind, "command");
            await owner.dispatch(parsed.value);
        }
    };
    try {
        assert.deepEqual(client.getSnapshot().state.fields.curve.readiness, { kind: "failed", reason: "invalid-state" });
        const proposed = [0, 0.4, 1];
        assert.deepEqual(await client.dispatch({ kind: "edit", key: "curve", value: proposed, expectedVersion: 0 }),
            { kind: "rejected", reason: "not-ready" });
        assert.equal(held.length, 0);
        for (const malformed of [
            { kind: "recover", key: "curve", value: [0, 1] },
            { kind: "recover", key: "curve", value: [0, 1], expectedVersion: 1 },
            { kind: "recover", key: "curve", value: [0, 1], expectedVersion: null },
            { kind: "recover", key: "curve", value: [0, 1], expectedVersion: 0, gesture: 1 },
        ]) {
            const parsed = parseServiceMessage({ kind: "command", address: { ...scope, client: 1, sequence: 1 }, command: malformed });
            assert.equal(parsed.kind, "ok");
            assert.equal(parsed.value.kind, "invalid-command", "malformed recovery still retains its address for a rejection receipt");
            assert.deepEqual(parsed.value.address, { ...scope, client: 1, sequence: 1 });
            assert.deepEqual(await client.dispatch(malformed), { kind: "rejected", reason: "invalid-command" });
            assert.equal(held.length, 0, "malformed recovery is rejected before transmission");
        }
        const ticket = client.dispatch({ kind: "recover", key: "curve", value: proposed, expectedVersion: 0 });
        assert.equal(held.length, 1, "valid complete recovery is submitted through the existing command path");
        assert.equal(held[0].sequence, 1, "local validation never consumes the next native sequence");
        proposed[1] = 0.9;
        const draft = client.getSnapshot();
        assert.deepEqual(draft.state.fields.curve.readiness, { kind: "failed", reason: "invalid-state" }, "a pending draft cannot claim accepted readiness");
        assert.equal(draft.state.fields.curve.version, 0);
        assert.deepEqual(draft.state.fields.curve.value, [0, 0.4, 1], "synchronous capture reads the codec-owned client draft");
        assert.deepEqual(draft.state.fields.curve.persistence, { kind: "not-written" }, "an unsent native write cannot claim persistence progress");
        assert.deepEqual(draft.pendingFields, ["curve"]);
        assert.equal(Object.hasOwn(owner.getSnapshot().fields.curve, "value"), false);
        assert.deepEqual(publications, []);
        await release();
        const accepted = await ticket;
        assert.equal(accepted.kind, "accepted");
        assert.equal(accepted.changed, true);
        assert.equal(accepted.version, 1);
        assert.equal(accepted.historyEntry, undefined);
        assert.deepEqual(client.getSnapshot().state.fields.curve.readiness, { kind: "ready" });
        assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(client.getSnapshot().pendingFields, []);
        assert.deepEqual(publications.map(value => value.operations), [[{ kind: "stored", key: "curve", value: [0, 0.4, 1] }]]);
        const stale = client.dispatch({ kind: "edit", key: "curve", value: [1, 0], expectedVersion: 0 });
        await release();
        assert.deepEqual(await stale, { kind: "rejected", reason: "stale-version" });
        assert.deepEqual(client.getSnapshot().state.fields.curve.value, [0, 0.4, 1]);
        assert.deepEqual(client.getSnapshot().pendingFields, []);
        assert.equal(publications.length, 1);
    } finally { client.stop(); await owner.stop(); }
});

test("raw replacement retains every invalid stored display without accepting it, while full restore discards it", async () => {
    let scope = { owner: "raw-recovery", document: 0 };
    const definition = definePluginState({
        curve: storedValue({ initial: [0, 1], codec }),
        shape: storedValue({ initial: [1, 0], codec }),
        gain: parameter("gain"),
    });
    const publications = [], replacements = [], cancellations = [];
    const session = createPluginStateSession(definition, {
        native: { publish(value) { publications.push(value); }, update() {}, close() {} },
        bindings: ["curve", "shape"].map(key => ({
            key, dependencies: ["gain"],
            replace(input, target) { replacements.push({ input, target }); },
            cancel() { cancellations.push(key); },
            async stop() {},
        })),
        onDefect: error => assert.fail(String(error)),
    });
    let sequence = 0;
    const command = command => session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command });
    const replace = async (document, hint) => {
        scope = { ...scope, document };
        const parsed = parseServiceMessage({ kind: "replaced", scope, ...(hint === undefined ? {} : { changedStoredKey: hint }), native: {
            values: { curve: "corrupt curve", shape: "corrupt shape" },
            parameters: [{ endpoint: "gain", value: -2, min: -8, max: 8, step: 0.25, defaultValue: 0 }],
        } });
        assert.equal(parsed.kind, "ok");
        assert.equal(parsed.value.kind, "replaced");
        assert.equal(parsed.value.changedStoredKey, hint, "the parser preserves the raw-write reason across the native boundary");
        await session.dispatch(parsed.value);
    };
    try {
        await session.dispatch({ kind: "opened", scope, native: { values: { curve: [0, 0.2, 1], shape: [1, 0.8, 0] }, parameters: [
            { endpoint: "gain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 },
        ] } });
        const gain = await command({ kind: "edit", key: "gain", value: 3 });
        assert.ok(gain.historyEntry);
        await command({ kind: "begin", key: "curve", gesture: 7 });
        await command({ kind: "edit", key: "curve", value: [0, 0.4, 1], gesture: 7 });
        const prior = session.getSnapshot();
        assert.deepEqual(prior.fields.curve.gesture, { client: 1, gesture: 7 });
        const beforePublications = publications.length;
        const beforeReplacements = replacements.length;
        const beforeCancellations = cancellations.length;
        await replace(1, "shape");
        const failed = session.getSnapshot();
        assert.deepEqual(failed.scope, scope);
        assert.deepEqual(failed.history, { canUndo: false, canRedo: false });
        for (const key of ["curve", "shape"]) {
            assert.deepEqual(failed.fields[key].readiness, { kind: "failed", reason: "invalid-state" });
            assert.deepEqual(failed.fields[key].value, prior.fields[key].value,
                "coalesced raw writes retain each valid display, not only the last hinted key");
            assert.equal(failed.fields[key].version, 0);
            assert.equal(failed.fields[key].persistence.kind, "failed");
            assert.equal(failed.fields[key].gesture, undefined);
            assert.deepEqual(failed.fields[key].target.scope, scope);
            assert.deepEqual(failed.fields[key].application, { kind: "waiting-for-inputs" }, "display-only data cannot claim preparation or delivery");
        }
        assert.equal(failed.fields.gain.value, -2);
        assert.deepEqual(failed.fields.gain.metadata, { min: -8, max: 8, step: 0.25, defaultValue: 0 });
        assert.equal(publications.length, beforePublications, "corrupt native input is never repaired as an observation side effect");
        assert.equal(replacements.length, beforeReplacements, "neither invalid bank is installed");
        assert.deepEqual(cancellations.slice(beforeCancellations).sort(), ["curve", "shape"]);
        await session.dispatch({ kind: "engine", target: prior.fields.curve.target,
            status: { kind: "acknowledged", engineSession: "old-engine", operation: "old-operation" } });
        assert.strictEqual(session.getSnapshot(), failed, "late delivery evidence from the old document cannot relabel a retained display");
        const wire = parseClientMessage(definition, JSON.parse(JSON.stringify({ kind: "attached", request: 1, client: 1,
            scope, revision: failed.revision, state: encodeStateSnapshot(definition, failed) })));
        assert.equal(wire.kind, "ok");
        assert.deepEqual(wire.value.state.fields.curve, failed.fields.curve, "failed readiness, display, and zero version survive the actual codec protocol");
        assert.deepEqual(wire.value.state.fields.shape, failed.fields.shape);

        const recovered = await command({ kind: "recover", key: "curve", value: [...failed.fields.curve.value], expectedVersion: 0 });
        assert.equal(recovered.kind, "accepted");
        assert.equal(recovered.changed, true, "matching an invalid field's display still establishes a new valid baseline");
        assert.equal(recovered.version, 1);
        assert.equal(recovered.historyEntry, undefined);
        assert.deepEqual(session.getSnapshot().history, { canUndo: false, canRedo: false });
        assert.deepEqual(publications.slice(beforePublications).map(value => value.operations), [
            [{ kind: "stored", key: "curve", value: [0, 0.4, 1] }],
        ]);
        assert.equal(replacements.length, beforeReplacements + 1);
        assert.deepEqual(replacements.at(-1).input, { value: [0, 0.4, 1], parameters: { gain: -2 } });

        await replace(2);
        for (const key of ["curve", "shape"]) {
            const field = session.getSnapshot().fields[key];
            assert.deepEqual(field.readiness, { kind: "failed", reason: "invalid-state" });
            assert.equal(Object.hasOwn(field, "value"), false, "full restore cannot borrow a previous document's display");
            assert.equal(field.version, 0);
        }
        assert.equal(replacements.length, beforeReplacements + 1);
        assert.equal(publications.length, beforePublications + 1);
    } finally { await session.stop(); }
});

test("recovering the same immutable stored primitive starts its previously waiting binding", async () => {
    let scope = { owner: "primitive-recovery", document: 0 };
    const definition = definePluginState({ amount: storedValue({ initial: 1, codec: {
        parse: value => typeof value === "number" && Number.isFinite(value)
            ? { kind: "ok", value } : { kind: "error", message: "Expected a finite amount." },
        encode: value => value,
        equals: Object.is,
    } }) });
    const replacements = [], publications = [];
    const session = createPluginStateSession(definition, {
        native: { publish(value) { publications.push(value); }, update() {}, close() {} },
        bindings: [{ key: "amount", dependencies: [], replace(input, target) { replacements.push({ input, target }); }, cancel() {}, async stop() {} }],
        onDefect: error => assert.fail(String(error)),
    });
    try {
        await session.dispatch({ kind: "opened", scope, native: { values: { amount: 4 }, parameters: [] } });
        assert.equal(replacements.length, 1);
        scope = { ...scope, document: 1 };
        await session.dispatch({ kind: "replaced", scope, changedStoredKey: "amount", native: { values: { amount: "corrupt" }, parameters: [] } });
        const failed = session.getSnapshot().fields.amount;
        assert.equal(failed.value, 4);
        assert.deepEqual(failed.application, { kind: "waiting-for-inputs" });
        assert.equal(replacements.length, 1);
        const result = await session.dispatch({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
            command: { kind: "recover", key: "amount", value: 4, expectedVersion: 0 } });
        assert.equal(result.kind, "accepted");
        assert.equal(result.changed, true);
        assert.equal(result.historyEntry, undefined);
        assert.equal(replacements.length, 2, "readiness becoming valid must prepare even when primitive identity is unchanged");
        assert.deepEqual(replacements[1].input, { value: 4, parameters: {} });
        assert.deepEqual(replacements[1].target.scope, scope);
        assert.deepEqual(session.getSnapshot().fields.amount.application, { kind: "pending" });
        assert.deepEqual(publications.map(value => value.operations), [[{ kind: "stored", key: "amount", value: 4 }]]);
    } finally { await session.stop(); }
});
