import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { createEngineBinding } = await loadUIModule(root, "kit/ui/plugin-state-engine.ts");
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

test("superseding a transport that is waiting for readiness prevents its eventual physical send", async () => {
    const ready = Promise.withResolvers();
    const sent = [];
    const statuses = [];
    let entered = 0;
    const binding = createEngineBinding({
        prepare: value => ({ kind: "ok", value }),
        transport: {
            async apply(value, permit) {
                entered++;
                await ready.promise;
                return permit.send(() => {
                    sent.push(value);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
            },
            stop() {},
        },
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
        onStatus: (target, status) => statuses.push({ target, status }),
    });
    binding.replace("old", target(0));
    await setImmediate();
    assert.equal(entered, 1, "old transport must already be waiting when it is superseded");
    binding.replace("new", target(1));
    await setImmediate();
    assert.equal(entered, 2);
    ready.resolve();
    await setImmediate();
    assert.deepEqual(sent, ["new"], "checking before apply is insufficient: the final handoff needs a guard");
    assert.deepEqual(statuses.filter(({ status }) => status.kind === "sent"), [
        { target: target(1), status: { kind: "sent", proof: "connection-call-returned" } },
    ]);
    await binding.stop();
});

test("stop settles while preparation is stalled, signals cancellation, and forbids any later send or restart", async () => {
    const preparation = Promise.withResolvers();
    const transport = new RecordingTransport();
    const statuses = [];
    let signal;
    let aborts = 0;
    const binding = createEngineBinding({
        prepare: (_value, cancellation) => {
            signal = cancellation;
            cancellation?.onAbort(() => aborts++);
            return preparation.promise;
        },
        transport,
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
        onStatus: (target, status) => statuses.push({ target, status }),
    });
    binding.replace("held", target(0));
    await setImmediate();
    let stopped = false;
    const stopping = binding.stop().then(() => { stopped = true; });
    await setImmediate();
    assert.equal(stopped, true, "stop must not wait forever for arbitrary preparation to finish");
    assert.equal(signal.aborted, true);
    assert.equal(aborts, 1);
    const count = statuses.length;
    preparation.resolve({ kind: "ok", value: "too late" });
    binding.replace("after stop", target(1));
    await setImmediate();
    assert.equal(transport.sent.length, 0);
    assert.equal(statuses.length, count);
    await stopping;
    await binding.stop();
    assert.equal(aborts, 1);
});

test("a failed preparation is reported, preserves its diagnostic cause, and does not prevent a later edit", async () => {
    const problem = new Error("decoder is broken");
    const defects = [];
    const statuses = [];
    const transport = new RecordingTransport();
    const binding = createEngineBinding({
        prepare: value => {
            if (value === "bad") throw problem;
            return { kind: "ok", value };
        },
        transport,
        onStatus: (target, status) => statuses.push({ target, status }),
        onDefect: error => defects.push(error),
    });
    binding.replace("bad", target(0));
    await setImmediate();
    assert.deepEqual(defects, [problem], "unexpected failure must not lose its original diagnostic cause");
    assert.equal(statuses.at(-1).status.kind, "failed");
    assert.equal(statuses.at(-1).status.error.kind, "defect");
    assert.equal(transport.sent.length, 0);
    binding.replace("recovered", target(1));
    await setImmediate();
    assert.deepEqual(transport.sent, ["recovered"]);
    assert.equal(statuses.at(-1).status.kind, "sent");
    await binding.stop();
});

test("a completed delivery cannot reuse its send permit for a stray later callback", async () => {
    let savedPermit;
    const sent = [];
    const binding = createEngineBinding({
        prepare: value => ({ kind: "ok", value }),
        transport: {
            async apply(value, permit) {
                savedPermit = permit;
                return permit.send(() => {
                    sent.push(value);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
            },
            stop() {},
        },
        onStatus() {},
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
    });
    binding.replace("valid", target(0));
    await setImmediate();
    assert.deepEqual(sent, ["valid"]);
    const result = savedPermit.send(() => {
        sent.push("stray");
        return { kind: "sent", proof: "connection-call-returned" };
    });
    assert.deepEqual(result, { kind: "cancelled" });
    assert.deepEqual(sent, ["valid"]);
    await binding.stop();
});

for (const late of ["acknowledged", "rejected"]) {
    test(`an obsolete transport's late ${late} result cannot change the current curve's status`, async () => {
        const oldResult = Promise.withResolvers();
        const statuses = [];
        const sent = [];
        const defects = [];
        const binding = createEngineBinding({
            prepare: value => ({ kind: "ok", value }),
            transport: {
                async apply(value, permit) {
                    const result = permit.send(() => {
                        sent.push(value);
                        return { kind: "sent", proof: "connection-call-returned" };
                    });
                    if (result.kind === "cancelled") return result;
                    return value === "old" ? oldResult.promise
                        : { kind: "acknowledged", engineSession: "engine", operation: "new-install" };
                },
                stop() {},
            },
            onStatus: (target, status) => statuses.push({ target, status }),
            onDefect: error => defects.push(error),
        });
        binding.replace("old", target(0));
        await setImmediate();
        assert.deepEqual(sent, ["old"], "old handoff really happened before it was superseded");
        // Same field and generation in another document must still supersede.
        const replacement = { ...target(0), scope: { owner: "owner", document: 1 } };
        binding.replace("new", replacement);
        await setImmediate();
        assert.deepEqual(sent, ["old", "new"]);
        const accepted = statuses.at(-1);
        assert.deepEqual(accepted, {
            target: replacement,
            status: { kind: "acknowledged", engineSession: "engine", operation: "new-install" },
        });
        if (late === "rejected") oldResult.reject(new Error("late closed connection"));
        else oldResult.resolve({ kind: "acknowledged", engineSession: "old-engine", operation: "old-install" });
        await setImmediate();
        assert.strictEqual(statuses.at(-1), accepted);
        assert.equal(defects.length, 0);
        await binding.stop();
    });
}

test("cancel revokes a waiting send but permits a new request, including one started from a status callback", async () => {
    const ready = Promise.withResolvers();
    const sent = [];
    const statuses = [];
    let firstSignal;
    let binding;
    binding = createEngineBinding({
        prepare: value => ({ kind: "ok", value }),
        transport: {
            async apply(value, permit) {
                if (value === "cancelled") {
                    firstSignal = permit.signal;
                    await ready.promise;
                }
                return permit.send(() => {
                    sent.push(value);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
            },
            stop() {},
        },
        onStatus: (update, status) => {
            statuses.push({ target: update, status });
            if (update.generation === 1 && status.kind === "sent") binding.replace("reentrant", target(2));
        },
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
    });
    binding.replace("cancelled", target(0));
    await setImmediate();
    binding.cancel();
    assert.equal(firstSignal.aborted, true);
    binding.replace("next", target(1));
    ready.resolve();
    await setImmediate();
    assert.deepEqual(sent, ["next", "reentrant"]);
    assert.deepEqual(statuses.at(-1), { target: target(2), status: { kind: "sent", proof: "connection-call-returned" } });
    await binding.stop();
});

test("an unexpected transport defect closes its potentially damaged transport and revokes late callbacks", async () => {
    const problem = new Error("transport lost its lane");
    const defects = [];
    const statuses = [];
    const sent = [];
    let savedPermit;
    let stops = 0;
    const binding = createEngineBinding({
        prepare: value => ({ kind: "ok", value }),
        transport: {
            async apply(value, permit) {
                savedPermit = permit;
                permit.send(() => {
                    sent.push(value);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
                throw problem;
            },
            stop() { stops++; },
        },
        onStatus: (target, status) => statuses.push({ target, status }),
        onDefect: error => defects.push(error),
    });
    binding.replace("partly sent", target(0));
    await setImmediate();
    assert.deepEqual(sent, ["partly sent"]);
    assert.deepEqual(defects, [problem]);
    assert.equal(statuses.at(-1).status.kind, "failed");
    assert.equal(stops, 1, "an unexpectedly broken transport must not be reused");
    binding.replace("unsafe retry", target(1));
    assert.deepEqual(savedPermit.send(() => {
        sent.push("late callback");
        return { kind: "sent", proof: "connection-call-returned" };
    }), { kind: "cancelled" });
    await setImmediate();
    assert.deepEqual(sent, ["partly sent"]);
    await binding.stop();
    assert.equal(stops, 1);
});

test("a replacement requested during cancellation remains the newest request", async () => {
    const waiting = Promise.withResolvers();
    const transport = new RecordingTransport();
    let binding;
    binding = createEngineBinding({
        prepare: (value, signal) => {
            if (value === "first") {
                signal.onAbort(() => binding.replace("third", target(3)));
                return waiting.promise;
            }
            return { kind: "ok", value };
        },
        transport,
        onStatus() {},
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
    });
    binding.replace("first", target(1));
    binding.replace("second", target(2));
    await setImmediate();
    assert.deepEqual(transport.sent, ["third"], "a nested later request must not be overwritten by the outer replacement");
    waiting.reject(new Error("cancelled resource"));
    await setImmediate();
    await binding.stop();
});

test("expected resource and delivery failures remain distinct and a fresh edit can recover", async () => {
    const statuses = [];
    const sent = [];
    const missing = { kind: "resource", message: "Curve resource is unavailable." };
    const unavailable = { kind: "transport", message: "Engine is unavailable." };
    const binding = createEngineBinding({
        prepare: value => value === "missing" ? { kind: "error", error: missing } : { kind: "ok", value },
        transport: {
            async apply(value, permit) {
                if (value === "disconnected") return { kind: "failed", error: unavailable };
                return permit.send(() => {
                    sent.push(value);
                    return { kind: "sent", proof: "connection-call-returned" };
                });
            },
            stop() {},
        },
        onStatus: (target, status) => statuses.push({ target, status }),
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
    });
    binding.replace("missing", target(0));
    await setImmediate();
    assert.deepEqual(statuses.at(-1), { target: target(0), status: { kind: "failed", error: missing } });
    binding.replace("disconnected", target(1));
    await setImmediate();
    assert.deepEqual(statuses.at(-1), { target: target(1), status: { kind: "failed", error: unavailable } });
    assert.deepEqual(sent, []);
    binding.replace("recovered", target(2));
    await setImmediate();
    assert.deepEqual(sent, ["recovered"]);
    assert.equal(statuses.at(-1).status.kind, "sent");
    await binding.stop();
});

test("shutdown requested from the preparing notification prevents preparation from starting", async () => {
    const transport = new RecordingTransport();
    let preparations = 0;
    let stopping;
    let binding;
    binding = createEngineBinding({
        prepare: value => { preparations++; return { kind: "ok", value }; },
        transport,
        onStatus: (_target, status) => { if (status.kind === "preparing") stopping = binding.stop(); },
        onDefect: error => assert.fail(`Unexpected defect: ${error}`),
    });
    binding.replace("stop immediately", target(0));
    await stopping;
    await setImmediate();
    assert.equal(preparations, 0);
    assert.deepEqual(transport.sent, []);
    assert.equal(transport.stopped, true);
});
