import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "../../kit/tests/helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const protocol = await loadUIModule(root, "kit/ui/plugin-state-protocol.ts");
const { isBoundedStateJson, parseClientMessage, parseServiceMessage, encodeEventPayload } = protocol;
const { definePluginState, parameter, storedValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");

test("the shared JSON boundary accounts for UTF-8, each node and nesting before transport", () => {
    assert.equal(isBoundedStateJson({ values: [null, true, 2.5, "𐐷 café"] }), true);
    for (const input of [NaN, Infinity, undefined, () => {}, 1n, new Date(), new Float32Array([0, 1]), { x: undefined }, "\ud800"])
        assert.equal(isBoundedStateJson(input), false);
    const cycle = {}; cycle.self = cycle;
    assert.equal(isBoundedStateJson(cycle), false);
    let depth = 0;
    for (let count = 0; count < 64; count++) depth = [depth];
    assert.equal(isBoundedStateJson(depth), true);
    assert.equal(isBoundedStateJson([depth]), false);
    assert.equal(isBoundedStateJson("𐐷".repeat(4 * 1024 * 1024)), false, "UTF-8 budget is not JavaScript string length");
    assert.equal(isBoundedStateJson(new Array(524288).fill(null)), false, "small leaves still consume native node overhead");
});

test("GUI engine evidence and targets are parsed explicitly and malformed identities cannot enter snapshots", () => {
    const codec = { parse: value => typeof value === "number" ? { kind: "ok", value } : { kind: "error", message: "number" }, encode: value => value, equals: (a, b) => a === b };
    const definition = definePluginState({ shape: storedValue({ initial: 0, codec }) });
    const scope = { owner: "owner", document: 2 };
    const field = { readiness: { kind: "ready" }, value: 0, version: 3, persistence: { kind: "pending" }, target: { scope, key: "shape", generation: 4 } };
    const body = application => ({ kind: "update", scope, revision: 7, state: { scope, revision: 7,
        history: { canUndo: true, canRedo: false }, fields: { shape: { ...field, application } } } });
    for (const application of [{ kind: "pending" }, { kind: "waiting-for-inputs" }, { kind: "preparing" },
        { kind: "sent", proof: "connection-call-returned" }, { kind: "sent", proof: "native-publication-processed" },
        { kind: "acknowledged", engineSession: "engine", operation: "install-4" },
        ...["resource", "transport", "engine-rejected", "defect"].map(kind => ({ kind: "failed", error: { kind, message: "delivery failed" } }))]) {
        const parsed = parseClientMessage(definition, body(application));
        assert.equal(parsed.kind, "ok");
        assert.deepEqual(parsed.value.state.fields.shape.application, application);
        assert.deepEqual(parsed.value.state.fields.shape.target, field.target);
        assert.ok(Object.isFrozen(parsed.value.state.fields.shape.target.scope));
    }
    for (const application of [{ kind: "sent", proof: "DSP probably got it" }, { kind: "acknowledged", operation: "missing-session" }, { kind: "failed", error: { kind: "invented", message: "bad" } }])
        assert.equal(parseClientMessage(definition, body(application)).kind, "invalid");
    for (const target of [{ ...field.target, generation: -1 }, { ...field.target, key: "other" }, { ...field.target, scope: { ...scope, document: 1 } }]) {
        const input = body({ kind: "pending" });
        input.state.fields.shape.target = target;
        assert.equal(parseClientMessage(definition, input).kind, "invalid");
    }
});


test("bounded event conversion accepts shared subgraphs while rejecting a back edge", () => {
    const shared = { samples: new Float32Array([0, 0.5, 1]), label: "𐐷 café" };
    const parsed = encodeEventPayload({ left: shared, right: shared });
    assert.equal(parsed.kind, "ok");
    assert.equal(JSON.stringify(parsed.value), JSON.stringify({ left: { samples: [0, 0.5, 1], label: "𐐷 café" }, right: { samples: [0, 0.5, 1], label: "𐐷 café" } }));
    assert.equal(isBoundedStateJson(parsed.value), true);
    assert.equal(encodeEventPayload({ samples: new Float32Array([0, NaN]) }).kind, "invalid");
    const cyclic = { shared }; cyclic.back = cyclic;
    assert.equal(encodeEventPayload(cyclic).kind, "invalid");
});

test("accepted edit evidence retains booleans and refuses malformed changed flags", () => {
    const definition = definePluginState({});
    const address = { owner: "owner", document: 0, client: 3, sequence: 1 };
    for (const changed of [true, false]) {
        const input = { kind: "receipt", address, result: { kind: "accepted", revision: 2, version: 1, changed } };
        const parsed = parseClientMessage(definition, input);
        assert.equal(parsed.kind, "ok");
        assert.deepEqual(parsed.value, input);
    }
    for (const changed of [null, 1, "true", {}, []]) {
        assert.equal(parseClientMessage(definition, { kind: "receipt", address,
            result: { kind: "accepted", revision: 2, version: 1, changed },
        }).kind, "invalid");
    }
    const nonEdit = { kind: "receipt", address, result: { kind: "accepted", revision: 2 } };
    assert.deepEqual(parseClientMessage(definition, nonEdit), { kind: "ok", value: nonEdit });
});


test("a compound edit command carries only an explicit history opt-out", () => {
    const address = { owner: "native", document: 0, client: 1, sequence: 1 };
    const edits = [{ key: "gain", value: 2 }];
    const body = { kind: "command", address, command: { kind: "edit-many", edits, history: false } };
    assert.deepEqual(parseServiceMessage(body), { kind: "ok", value: body });
    assert.deepEqual(parseServiceMessage({ ...body, command: { kind: "edit-many", edits, history: true } }),
        { kind: "ok", value: { kind: "invalid-command", address } }, "recording history is the default, so only false is a valid opt-out");
});

test("gesture boundaries carry a nonempty list of distinct field keys, and a gesture edit cannot opt out of history", () => {
    const address = { owner: "native", document: 0, client: 1, sequence: 1 };
    const command = command => parseServiceMessage({ kind: "command", address, command });
    const invalid = { kind: "ok", value: { kind: "invalid-command", address } };
    for (const kind of ["begin", "end"]) {
        const body = { kind, keys: ["frequency", "amount"], gesture: 2 };
        assert.deepEqual(command(body), { kind: "ok", value: { kind: "command", address, command: body } });
        for (const keys of [[], ["amount", "amount"], "amount", [""]]) assert.deepEqual(command({ ...body, keys }), invalid, JSON.stringify(keys));
    }
    const edits = [{ key: "gain", value: 2 }];
    assert.deepEqual(command({ kind: "edit-many", edits, gesture: 2 }),
        { kind: "ok", value: { kind: "command", address, command: { kind: "edit-many", edits, gesture: 2 } } });
    assert.deepEqual(command({ kind: "edit-many", edits, gesture: 2, history: false }), invalid);
});

test("parameter observations require explicit native intent, origin and monotonic order fields", () => {
    const body = { kind: "parameter", scope: { owner: "native", document: 0 }, endpoint: "gain", value: 2,
        intent: 7, origin: "owner", observation: 12 };
    assert.deepEqual(parseServiceMessage(body), { kind: "ok", value: body });
    const external = { ...body, intent: 0, origin: "external", observation: 0 };
    assert.deepEqual(parseServiceMessage(external), { kind: "ok", value: external }, "cold native observations may start at zero");
    for (const key of ["intent", "origin", "observation"]) {
        const missing = Object.fromEntries(Object.entries(body).filter(([name]) => name !== key));
        assert.equal(parseServiceMessage(missing).kind, "invalid", `missing ${key} cannot become automation`);
    }
    for (const invalid of [{ intent: -1 }, { intent: 1.5 }, { observation: -1 }, { observation: 1.5 },
        { intent: Number.MAX_SAFE_INTEGER + 1 }, { observation: Number.MAX_SAFE_INTEGER + 1 }, { origin: "guessed" }]) {
        assert.equal(parseServiceMessage({ ...body, ...invalid }).kind, "invalid", JSON.stringify(invalid));
    }
});

test("an unchanged value resolves only against the same field version in the same document", () => {
    const { encodeStateSnapshot } = protocol;
    let parses = 0;
    const codec = { parse: value => { parses++; return Array.isArray(value) ? { kind: "ok", value: Object.freeze([...value]) } : { kind: "error", message: "list" }; },
        encode: value => [...value], equals: (a, b) => a.length === b.length && a.every((item, index) => item === b[index]) };
    const definition = definePluginState({ library: storedValue({ initial: [], codec }) });
    const scope = { owner: "owner", document: 1 };
    const library = Object.freeze(["a", "b"]);
    const snapshot = (revision, version, value = library, documentScope = scope) => ({ scope: documentScope, revision, history: { canUndo: false, canRedo: false },
        fields: { library: { readiness: { kind: "ready" }, value, version, persistence: { kind: "pending" } } } });
    const update = (state) => ({ kind: "update", scope: state.scope, revision: state.revision, state });

    const full = encodeStateSnapshot(definition, snapshot(1, 4));
    const base = parseClientMessage(definition, update(full)).value.state;
    const elided = encodeStateSnapshot(definition, snapshot(2, 4), snapshot(1, 4));
    assert.equal(elided.fields.library.valueUnchanged, true);
    assert.equal("value" in elided.fields.library, false, "an unchanged value is not resent");
    parses = 0;
    const resolved = parseClientMessage(definition, update(elided), base);
    assert.equal(resolved.value.state.fields.library.value, base.fields.library.value, "the GUI reuses its parsed value");
    assert.equal(parses, 0, "and does not parse it again");

    assert.equal(parseClientMessage(definition, update(elided)).kind, "invalid", "a marker without a base is a protocol error");
    assert.equal(parseClientMessage(definition, update(encodeStateSnapshot(definition, snapshot(2, 5), snapshot(1, 5))),
        base).kind, "invalid", "a marker for another version is a protocol error");
    const otherDocument = { owner: "owner", document: 2 };
    assert.equal(parseClientMessage(definition, update(encodeStateSnapshot(definition, snapshot(2, 4, library, otherDocument), snapshot(1, 4, library, otherDocument))),
        base).kind, "invalid", "a base from another document is never used");
    assert.deepEqual(encodeStateSnapshot(definition, snapshot(2, 5, Object.freeze(["c"])), snapshot(1, 4)).fields.library.value, ["c"],
        "a changed value is sent in full");
    assert.equal(parseClientMessage(definition, { kind: "attached", request: 1, client: 1, scope, revision: 2, state: elided }, base).kind, "invalid",
        "an attach reply always carries every value");
});

test("the last value change crosses to the GUI intact, and a malformed one is refused", () => {
    const { encodeStateSnapshot } = protocol;
    const codec = { parse: value => typeof value === "number" ? { kind: "ok", value } : { kind: "error", message: "number" }, encode: value => value, equals: (a, b) => a === b };
    const definition = definePluginState({ gain: parameter("gain"), shape: storedValue({ initial: 0, codec }), tone: storedValue({ initial: 0, codec }) });
    const scope = { owner: "owner", document: 1 };
    const field = value => ({ readiness: { kind: "ready" }, value, version: 1, persistence: { kind: "pending" } });
    const snapshot = lastChange => ({ scope, revision: 5, history: { canUndo: true, canRedo: false },
        fields: { gain: field(0.5), shape: field(2), tone: field(3) }, ...(lastChange === undefined ? {} : { lastChange }) });
    const parse = lastChange => parseClientMessage(definition, JSON.parse(JSON.stringify({ kind: "update", scope, revision: 5,
        state: encodeStateSnapshot(definition, snapshot(lastChange)) })));

    const change = { reason: "recall", keys: ["gain", "tone"], revision: 3 };
    const parsed = parse(change);
    assert.equal(parsed.kind, "ok");
    assert.deepEqual(parsed.value.state.lastChange, change);
    assert.ok(Object.isFrozen(parsed.value.state.lastChange) && Object.isFrozen(parsed.value.state.lastChange.keys));
    for (const reason of ["load", "history", "edit"]) assert.equal(parse({ ...change, reason }).kind, "ok", reason);
    assert.equal("lastChange" in parse(undefined).value.state, false, "a snapshot before any value change has none");

    for (const [malformed, why] of [
        [null, "not an object"], [{ ...change, reason: "preset" }, "unknown reason"], [{ ...change, keys: "gain" }, "keys not a list"],
        [{ ...change, keys: [] }, "no keys"], [{ ...change, keys: ["gain", "volume"] }, "undeclared key"],
        [{ ...change, keys: ["gain", "gain"] }, "repeated key"], [{ ...change, keys: ["tone", "gain"] }, "not in definition order"],
        [{ ...change, keys: ["gain", 1] }, "non-string key"], [{ ...change, revision: 0 }, "no revision"],
        [{ ...change, revision: 6 }, "a revision after the snapshot's"], [{ ...change, revision: 2.5 }, "fractional revision"],
    ]) assert.equal(parse(malformed).kind, "invalid", why);
});
