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

test("an update carries only the fields that changed since its base, and the GUI fills the rest from the state it holds", () => {
    const { encodeStateSnapshot } = protocol;
    let parses = 0;
    const codec = { parse: value => { parses++; return Array.isArray(value) ? { kind: "ok", value: Object.freeze([...value]) } : { kind: "error", message: "list" }; },
        encode: value => [...value], equals: (a, b) => a.length === b.length && a.every((item, index) => item === b[index]) };
    const definition = definePluginState({ gain: parameter("gain"), library: storedValue({ initial: [], codec }) });
    const scope = { owner: "owner", document: 1 };
    const field = (value, version, persistence = "pending") => ({ readiness: { kind: "ready" }, value, version, persistence: { kind: persistence } });
    const first = { scope, revision: 1, history: { canUndo: false, canRedo: false },
        fields: { gain: field(0.5, 0), library: field(Object.freeze(["a", "b"]), 4) } };
    const next = (state, fields) => ({ ...state, revision: state.revision + 1, fields: { ...state.fields, ...fields } });
    const wire = state => JSON.parse(JSON.stringify({ kind: "update", scope: state.scope, revision: state.revision, state }));

    const held = parseClientMessage(definition, wire(encodeStateSnapshot(definition, first))).value.state;
    const knob = next(first, { gain: field(0.75, 1) });
    const tick = encodeStateSnapshot(definition, knob, first);
    assert.deepEqual(Object.keys(tick.fields), ["gain"], "a field whose object did not change is left out");
    assert.equal(tick.base, 1, "the update names the state it builds on");
    parses = 0;
    const applied = parseClientMessage(definition, wire(tick), held);
    assert.equal(applied.kind, "ok");
    assert.equal(applied.value.state.revision, 2);
    assert.equal(applied.value.state.fields.gain.value, 0.75);
    assert.strictEqual(applied.value.state.fields.library, held.fields.library, "a left-out field keeps the held field");
    assert.equal(parses, 0, "and its value is not parsed again");

    const saved = next(knob, { library: field(knob.fields.library.value, 4, "observed-in-native-state") });
    const status = encodeStateSnapshot(definition, saved, knob);
    assert.deepEqual(Object.keys(status.fields), ["library"]);
    assert.equal(status.fields.library.valueUnchanged, true, "a field whose status changed but whose value did not leaves its value out");
    assert.equal("value" in status.fields.library, false);
    const resolved = parseClientMessage(definition, wire(status), applied.value.state);
    assert.strictEqual(resolved.value.state.fields.library.value, held.fields.library.value, "the GUI reuses its parsed value");
    assert.equal(resolved.value.state.fields.library.persistence.kind, "observed-in-native-state");
    assert.equal(parses, 0);
    const forged = wire(status);
    forged.state.fields.library.version = 5;
    assert.equal(parseClientMessage(definition, forged, applied.value.state).kind, "invalid", "an unchanged value must keep its version");

    const replaced = { ...next(saved, {}), scope: { owner: "owner", document: 2 } };
    assert.equal("base" in encodeStateSnapshot(definition, replaced, saved), false, "the first update of another document is whole");
    assert.deepEqual(encodeStateSnapshot(definition, next(saved, { library: field(Object.freeze(["c"]), 5) }), saved).fields.library.value, ["c"],
        "a changed value is sent in full");
    assert.equal(parseClientMessage(definition, { kind: "attached", request: 1, client: 1, scope, revision: 2, state: tick }, held).kind, "invalid",
        "an attach reply always carries every field");
    const missing = wire(encodeStateSnapshot(definition, first));
    delete missing.state.fields.library;
    assert.equal(parseClientMessage(definition, missing, held).kind, "invalid", "a whole update cannot leave a field out");
});

test("an update built on a state the GUI does not hold asks it to attach again, keeping its receipt", () => {
    const { encodeStateSnapshot } = protocol;
    const codec = { parse: value => typeof value === "number" ? { kind: "ok", value } : { kind: "error", message: "number" }, encode: value => value, equals: (a, b) => a === b };
    const definition = definePluginState({ gain: parameter("gain"), shape: storedValue({ initial: 0, codec }) });
    const scope = { owner: "owner", document: 1 };
    const field = (value, version) => ({ readiness: { kind: "ready" }, value, version, persistence: { kind: "pending" } });
    const state = (revision, gain, documentScope = scope) => ({ scope: documentScope, revision, history: { canUndo: false, canRedo: false },
        fields: { gain: field(gain, revision), shape: field(1, 0) } });
    const held = parseClientMessage(definition, { kind: "update", scope, revision: 1, state: encodeStateSnapshot(definition, state(1, 0)) }).value.state;
    const receipt = { address: { ...scope, client: 3, sequence: 2 }, result: { kind: "accepted", revision: 3, version: 3, changed: true } };
    const third = state(3, 0.75);
    const delta = (base, update = third) => ({ kind: "update", scope: update.scope, revision: update.revision,
        state: { ...encodeStateSnapshot(definition, update), base, fields: { gain: update.fields.gain } } });

    assert.equal(parseClientMessage(definition, delta(1), held).kind, "ok", "an update on the held revision applies");
    assert.deepEqual(parseClientMessage(definition, { ...delta(2), receipt }, held),
        { kind: "ok", value: { kind: "resync", scope, receipt } }, "a GUI that missed revision 2 attaches again; the receipt still settles its edit");
    assert.deepEqual(parseClientMessage(definition, delta(1)), { kind: "ok", value: { kind: "resync", scope } }, "a GUI holding no state cannot apply a delta");
    const otherScope = { owner: "owner", document: 2 };
    assert.deepEqual(parseClientMessage(definition, delta(1, state(3, 0.75, otherScope)), held),
        { kind: "ok", value: { kind: "resync", scope: otherScope } }, "the same revision in another document is not the held state");
    for (const base of [-1, 1.5, "1", null]) assert.equal(parseClientMessage(definition, delta(base), held).kind, "invalid", JSON.stringify(base));
    assert.equal(parseClientMessage(definition, { ...delta(2), receipt: { address: receipt.address } }, held).kind, "invalid",
        "a malformed receipt is a protocol error even when the base is not held");
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
