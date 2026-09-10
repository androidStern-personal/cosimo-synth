import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { createEngineBinding } = await loadUIModule(root, "kit/ui/plugin-state-engine.ts");
// Use the authored renderer rather than a stub that manufactures expected data.
const { renderMsegShape, MSEG_BODY_SAMPLES, MSEG_PADDED_SAMPLES } =
    await loadUIModule(root, "ui/shared/mseg.ts");

const ramp = Object.freeze({ points: Object.freeze([
    Object.freeze({ x: 0, y: 0, curvePower: 0 }),
    Object.freeze({ x: 1, y: 1, curvePower: 0 }),
]) });
const target = generation => ({ scope: { owner: "owner", document: 0 }, key: "curve", generation });

// Represents the final external handoff. It claims only a completed send call,
// and does not manufacture a DSP acknowledgement or implement target selection.
class RecordingTransport {
    sent = [];
    stopped = false;
    async apply(payload, permit) {
        return permit.send(() => {
            this.sent.push(payload);
            return { kind: "sent", proof: "connection-call-returned" };
        });
    }
    stop() { this.stopped = true; }
}

test("prepares a real MSEG and reports only the evidence supplied by its transport", async () => {
    const transport = new RecordingTransport();
    const statuses = [];
    const binding = createEngineBinding({
        prepare: curve => ({ kind: "ok", value: renderMsegShape(curve) }),
        transport,
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
        onStatus: (target, status) => statuses.push({ target, status }),
    });
    binding.replace(ramp, target(0));
    await setImmediate();

    assert.equal(transport.sent.length, 1);
    const samples = transport.sent[0];
    assert.equal(samples.length, MSEG_PADDED_SAMPLES);
    assert.equal(samples[0], 0);
    assert.equal(samples[1], 0);
    assert.equal(samples[MSEG_BODY_SAMPLES], 1);
    assert.ok(Math.abs(samples[1 + Math.floor((MSEG_BODY_SAMPLES - 1) / 2)] - 0.5) < 0.002);
    assert.deepEqual(statuses.at(-1), {
        target: target(0), status: { kind: "sent", proof: "connection-call-returned" },
    });
    assert.equal(statuses.some(({ status }) => status.kind === "acknowledged"), false);
    await binding.stop();
    assert.equal(transport.stopped, true);
});

test("a newer curve is delivered without waiting for obsolete preparation; the old result cannot replace it", async () => {
    const oldPreparation = Promise.withResolvers();
    const transport = new RecordingTransport();
    const statuses = [];
    const falling = { points: [{ x: 0, y: 1, curvePower: 0 }, { x: 1, y: 0, curvePower: 0 }] };
    const binding = createEngineBinding({
        prepare: curve => curve === ramp ? oldPreparation.promise
            : { kind: "ok", value: renderMsegShape(curve) },
        transport,
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
        onStatus: (target, status) => statuses.push({ target, status }),
    });
    binding.replace(ramp, target(0));
    binding.replace(falling, target(1));
    await setImmediate();
    assert.equal(transport.sent.length, 1, "new preparation must not wait for the old promise");
    assert.equal(transport.sent[0][1], 1);
    assert.equal(transport.sent[0][MSEG_BODY_SAMPLES], 0);

    const currentStatus = statuses.at(-1);
    assert.deepEqual(currentStatus, { target: target(1), status: { kind: "sent", proof: "connection-call-returned" } });
    oldPreparation.resolve({ kind: "ok", value: renderMsegShape(ramp) });
    await setImmediate();
    assert.equal(transport.sent.length, 1, "obsolete prepared samples must never reach the transport");
    assert.strictEqual(statuses.at(-1), currentStatus, "old completion cannot change current application evidence");
    await binding.stop();
});

