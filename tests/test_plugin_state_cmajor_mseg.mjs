import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { definePluginState, storedValue, eventValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const { renderMsegShape, MSEG_BODY_SAMPLES, MSEG_PADDED_SAMPLES } = await loadUIModule(root, "ui/shared/mseg.ts");

test("ordinary authored MSEG rendering reaches the raw event channel as finite padded samples without prepare wrappers", async t => {
    const ramp = { points: [{ x: 0, y: 0, curvePower: 0 }, { x: 1, y: 1, curvePower: 0 }] };
    const codec = {
        parse(value) {
            if (!Array.isArray(value?.points) || value.points.length < 2 || !value.points.every(point => [point.x, point.y, point.curvePower].every(Number.isFinite)))
                return { kind: "error", message: "Finite points required." };
            return { kind: "ok", value: Object.freeze({ points: Object.freeze(value.points.map(point => Object.freeze({ ...point }))) }) };
        },
        encode: value => ({ points: value.points.map(point => ({ ...point })) }),
        equals: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    };
    const definition = definePluginState({ curve: storedValue({ initial: ramp, codec, engine: eventValue("curveBuffer", renderMsegShape) }) });
    let receive;
    const messages = [];
    const service = createCmajorPluginStateService(definition, {
        addEventListener(type, listener) { assert.equal(type, "kit_state"); receive = listener; },
        removeEventListener() { receive = undefined; },
        sendMessageToServer(envelope) { messages.push(JSON.parse(JSON.stringify(envelope.message))); },
    }, { onDefect: error => assert.fail(String(error)) });
    t.after(() => service.stop());
    const starting = service.start();
    const scope = { owner: "mseg-owner", document: 0 };
    receive({ kind: "opened", request: 1, scope, native: { parameters: [], values: {} } });
    await starting;
    await new Promise(setImmediate);
    const publication = messages.find(message => message.kind === "publish");
    assert.equal(publication.operations[0].endpoint, "curveBuffer");
    const samples = publication.operations[0].value;
    assert.equal(samples.length, MSEG_PADDED_SAMPLES);
    assert.equal(samples[0], 0);
    assert.equal(samples[1], 0);
    assert.equal(samples[MSEG_BODY_SAMPLES], 1);
    assert.ok(Math.abs(samples[1 + Math.floor((MSEG_BODY_SAMPLES - 1) / 2)] - 0.5) < 0.002);
    assert.ok(samples.every(Number.isFinite));
    receive({ kind: "published", request: publication.request, scope, result: { kind: "observed" } });
    await new Promise(setImmediate);
    assert.deepEqual(messages.filter(message => message.kind === "update").at(-1).state.fields.curve.application,
        { kind: "sent", proof: "native-publication-processed" });
});
