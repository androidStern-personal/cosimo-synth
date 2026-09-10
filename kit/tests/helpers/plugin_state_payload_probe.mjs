import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const { definePluginState, storedValue, eventValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const scenario = process.argv[2];
let invalid;
if (scenario === "cycle") { invalid = {}; invalid.left = invalid; invalid.right = invalid; }
else if (scenario === "shared-dag") {
    invalid = { sample: 1 };
    for (let index = 0; index < 30; index++) invalid = { left: invalid, right: invalid };
} else if (scenario === "typed-array") invalid = new Float32Array(8 * 1024 * 1024);
else throw new Error("Unknown payload case.");
const codec = {
    parse: value => typeof value === "number" ? { kind: "ok", value } : { kind: "error", message: "number required" },
    encode: value => value, equals: (left, right) => left === right,
};
const definition = definePluginState({ shape: storedValue({ initial: 0, codec,
    engine: eventValue("samples", value => value === 0 ? invalid : new Float32Array([0, 1])),
}) });
let receive;
const sent = [];
const defects = [];
const service = createCmajorPluginStateService(definition, {
    addEventListener(_type, listener) { receive = listener; },
    removeEventListener() { receive = undefined; },
    sendMessageToServer(envelope) { sent.push(JSON.parse(JSON.stringify(envelope.message))); },
}, { onDefect: error => defects.push(error) });
const scope = { owner: "payload-owner", document: 0 };
try {
    const starting = service.start();
    receive({ kind: "opened", request: 1, scope, native: { parameters: [], values: {} } });
    await starting;
    await new Promise(setImmediate);
    const events = () => sent.filter(message => message.kind === "publish" && message.operations[0].kind === "event");
    const snapshot = () => sent.filter(message => message.kind === "update").at(-1).state;
    assert.equal(events().length, 0, "invalid prepared data never crosses native event handoff");
    assert.equal(snapshot().fields.shape.application.error.kind, "engine-rejected");
    assert.deepEqual(defects, [], "bounded payload refusal is an expected target failure");
    receive({ kind: "command", address: { ...scope, client: 1, sequence: 1 }, command: { kind: "edit", key: "shape", value: 1 } });
    await new Promise(setImmediate);
    assert.equal(events().length, 1, "a later valid edit recovers through the real binding");
    assert.deepEqual(events()[0].operations, [{ kind: "event", endpoint: "samples", value: [0, 1] }]);
    receive({ kind: "published", scope, request: events()[0].request, result: { kind: "observed" } });
    await new Promise(setImmediate);
    assert.deepEqual(snapshot().fields.shape.application, { kind: "sent", proof: "native-publication-processed" });
    assert.equal(snapshot().fields.shape.value, 1);
    assert.equal(snapshot().history.canUndo, true);
    assert.deepEqual(defects, []);
} finally { await service.stop(); }
