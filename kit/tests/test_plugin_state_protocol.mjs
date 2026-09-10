import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { isBoundedStateJson, parseClientMessage, encodeEventPayload } = await loadUIModule(root, "kit/ui/plugin-state-protocol.ts");
const { definePluginState, storedValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");

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
