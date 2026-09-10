import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";
import { openEngineDataConnection } from "./helpers/engine_data_connection.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { engineData } = await loadUIModule(root, "kit/ui/engine-data-delivery.ts");
const declaration = () => engineData({
    endpoints: { begin: "begin", chunk: "chunk", commit: "commit", query: "query", receipt: "receipt" },
    wordCapacity: 257, chunkCapacity: 32,
});

function deliveryContext(native, forwardReceipt = () => true, forwardEvent = () => true) {
    const listeners = new Set();
    const controller = new AbortController();
    return {
        listeners,
        cancel: () => controller.abort(),
        context: {
            signal: {
                get aborted() { return controller.signal.aborted; },
                onAbort(listener) {
                    if (controller.signal.aborted) { listener(); return () => {}; }
                    controller.signal.addEventListener("abort", listener);
                    return () => controller.signal.removeEventListener("abort", listener);
                },
            },
            listen(endpoint, listener) {
                assert.equal(endpoint, "receipt");
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            send(effect) {
                assert.equal(effect.kind, "event");
                // The native harness invokes the actual compiled event endpoint.
                // Only its real output events are delivered to the TS sender.
                const completion = native.request({ frames: 64,
                    events: forwardEvent(effect) ? [{ endpoint: effect.endpoint, value: effect.value }] : [] })
                    .then(block => {
                        for (const receipt of block.receipts)
                            if (forwardReceipt(receipt))
                                for (const listener of [...listeners]) listener(receipt);
                        return { kind: "sent", proof: "native-publication-processed" };
                    });
                return { kind: "submitted", completion };
            },
        },
    };
}

test("stock delivery installs complete words in compiled Cmajor while a held reader keeps the previous value", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const delivery = declaration().create();
    const first = deliveryContext(native);
    const second = deliveryContext(native);
    try {
        await native.request({ frames: 64 });
        const a = Int32Array.from({ length: 257 }, (_, i) => -19003 + i * 43);
        const b = Int32Array.from({ length: 257 }, (_, i) => 25007 - i * 71);
        const appliedA = await delivery.apply(a, first.context);
        await native.request({ frames: 1, events: [{ endpoint: "holdReader", value: 0 }] });
        const appliedB = await delivery.apply(b, second.context);
        for (let index = 0; index < 257; index++) {
            const block = await native.request({ frames: 2, values: { readIndex: index } });
            assert.deepEqual(block.samples, [[b[index], a[index], 0], [b[index], a[index], 0]], `actual DSP word ${index}`);
        }
        assert.equal(appliedA.kind, "acknowledged", "stock sender requires the actual receiver's commit acknowledgement");
        assert.equal(appliedB.kind, "acknowledged");
        assert.notEqual(appliedA.operation, appliedB.operation, "successive installs must have distinct receiver identities");
        assert.equal(first.listeners.size, 0);
        assert.equal(second.listeners.size, 0);
    } finally {
        first.cancel(); second.cancel(); delivery.stop();
        await native.close();
    }
});

test("lost requests are retried only after the real receiver proves that they made no progress", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const delivery = declaration().create();
    const first = deliveryContext(native);
    const lost = [];
    const trace = [];
    const second = deliveryContext(native, receipt => { trace.push({ kind: "receipt", receipt }); return true; }, effect => {
        const dropped = (effect.endpoint === "begin" || effect.endpoint === "commit"
            || effect.endpoint === "chunk" && effect.value.offset === 64)
            && !lost.includes(effect.endpoint);
        trace.push({ kind: "send", effect: structuredClone(effect), dropped });
        if (dropped) lost.push(effect.endpoint);
        return !dropped;
    });
    try {
        await native.request({ frames: 64 });
        const a = Int32Array.from({ length: 257 }, (_, i) => -13001 - i * 19);
        const b = Int32Array.from({ length: 257 }, (_, i) => 27011 + i * 79);
        assert.equal((await delivery.apply(a, first.context)).kind, "acknowledged");
        await native.request({ frames: 1, events: [{ endpoint: "holdReader", value: 0 }] });
        const result = await delivery.apply(b, second.context);
        for (let index = 0; index < 257; index++) {
            const block = await native.request({ frames: 2, values: { readIndex: index } });
            assert.deepEqual(block.samples, [[b[index], a[index], 0], [b[index], a[index], 0]], `retried DSP word ${index}`);
        }
        assert.equal(result.kind, "acknowledged");
        assert.deepEqual(lost, ["begin", "chunk", "commit"], "each fault omitted the event from an actual DSP render");
        for (let index = 0; index < trace.length; index++) {
            const entry = trace[index];
            if (entry.kind !== "send" || !entry.dropped) continue;
            const retry = trace.findIndex((next, nextIndex) => nextIndex > index && next.kind === "send"
                && next.effect.endpoint === entry.effect.endpoint);
            assert.ok(retry > index, `lost ${entry.effect.endpoint} eventually retries`);
            assert.deepEqual(trace[retry].effect, entry.effect, "retry retains the exact original identity and payload");
            const intervening = trace.slice(index + 1, retry);
            const reports = intervening.filter(next => next.kind === "receipt" && next.receipt.operation === 5 && next.receipt.status === 0);
            assert.ok(reports.length > 0, "retry requires a real successful receiver query after the loss");
            const report = reports.at(-1).receipt;
            assert.equal(report.scope, entry.effect.value.scope);
            assert.equal(report.generation, entry.effect.value.generation - (entry.effect.endpoint === "begin" ? 1 : 0));
            if (entry.effect.endpoint === "chunk") assert.equal(report.receivedWords, entry.effect.value.offset);
            if (entry.effect.endpoint === "commit") {
                assert.equal(report.receivedWords, b.length);
                assert.ok(report.currentGeneration < entry.effect.value.generation, "query proves activation is still missing");
            }
            assert.ok(intervening.filter(next => next.kind === "send").every(next => next.effect.endpoint === "query"),
                "no data send may bypass the recovery query");
        }
        assert.equal(second.listeners.size, 0);
    } finally {
        first.cancel(); second.cancel(); delivery.stop();
        await native.close();
    }
});

test("lost real chunk and commit acknowledgements recover from receiver state without replacing held data", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const delivery = declaration().create();
    const first = deliveryContext(native);
    const dropped = [];
    const second = deliveryContext(native, receipt => {
        if ((receipt.operation === 2 && receipt.receivedWords === 64 || receipt.operation === 3)
            && !dropped.some(previous => previous.operation === receipt.operation)) {
            dropped.push(receipt);
            return false;
        }
        return true;
    });
    try {
        await native.request({ frames: 64 });
        const a = Int32Array.from({ length: 257 }, (_, i) => -45013 + i * 31);
        const b = Int32Array.from({ length: 257 }, (_, i) => 76003 - i * 59);
        assert.equal((await delivery.apply(a, first.context)).kind, "acknowledged");
        await native.request({ frames: 1, events: [{ endpoint: "holdReader", value: 0 }] });
        const result = await delivery.apply(b, second.context);
        for (let index = 0; index < 257; index++) {
            const block = await native.request({ frames: 2, values: { readIndex: index } });
            assert.deepEqual(block.samples, [[b[index], a[index], 0], [b[index], a[index], 0]], `recovered DSP word ${index}`);
        }
        assert.equal(result.kind, "acknowledged", "recovery needs actual receiver evidence, not successful native handoff");
        assert.deepEqual(dropped.map(receipt => [receipt.operation, receipt.status]), [[2, 0], [3, 0]],
            "fault injection must drop real successful receiver outputs");
        assert.equal(second.listeners.size, 0);
    } finally {
        first.cancel(); second.cancel(); delivery.stop();
        await native.close();
    }
});

test("cancelled partial delivery cannot interfere with a reset and a new owner, even when its real receipt arrives late", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const oldOwner = declaration().create();
    const newOwner = declaration().create();
    const first = deliveryContext(native);
    let reportBlocked;
    const blocked = new Promise(resolve => { reportBlocked = resolve; });
    let lateReceipt;
    const second = deliveryContext(native, receipt => {
        if (receipt.operation === 2 && receipt.receivedWords === 32) {
            lateReceipt = receipt;
            reportBlocked();
            return false;
        }
        return true;
    });
    let injected = false;
    const third = deliveryContext(native, () => true, effect => {
        if (effect.endpoint === "chunk" && effect.value.offset === 0 && !injected) {
            injected = true;
            for (const listener of [...third.listeners]) listener(lateReceipt);
            return false; // Only the stale receipt arrives; the new chunk is lost.
        }
        return true;
    });
    try {
        await native.request({ frames: 64 });
        const a = Int32Array.from({ length: 257 }, (_, i) => -27001 + i * 137);
        const b = Int32Array.from({ length: 257 }, (_, i) => 97001 - i * 173);
        const c = Int32Array.from({ length: 257 }, (_, i) => -87011 + i * 223);
        const expectedC = c.slice();
        assert.equal((await oldOwner.apply(a, first.context)).kind, "acknowledged");
        await native.request({ frames: 1, events: [{ endpoint: "holdReader", value: 0 }] });
        const pending = oldOwner.apply(b, second.context);
        await blocked;
        second.cancel();
        oldOwner.stop();
        assert.equal((await pending).kind, "cancelled");
        assert.equal(second.listeners.size, 0, "cancel releases the unanswered packet listener");
        const reset = await native.request({ frames: 64, events: [{ endpoint: "resetScope", value: { scope: 2 } }] });
        assert.equal(reset.receipts[0].status, 0);
        const reserved = await native.request({ frames: 64, events: [{ endpoint: "begin", value: { scope: 2, generation: 1, wordCount: 257 } }] });
        assert.equal(reserved.receipts[0].status, 0);
        const replacement = newOwner.apply(c, third.context);
        c.fill(1234567); // The sender must already own its immutable in-flight copy.
        const result = await replacement;
        assert.equal(result.kind, "acknowledged");
        assert.equal(result.engineSession, "2", "new owner obtains the real reset scope rather than assuming a fresh engine");
        assert.equal(injected, true);
        assert.equal(lateReceipt.scope, 1);
        assert.equal(String(lateReceipt.generation), result.operation,
            "old and new operations deliberately have the same generation; scope must distinguish them");
        for (let index = 0; index < 257; index++) {
            const block = await native.request({ frames: 2, values: { readIndex: index } });
            assert.deepEqual(block.samples, [[expectedC[index], a[index], 0], [expectedC[index], a[index], 0]], `reset DSP word ${index}`);
        }
        assert.equal(third.listeners.size, 0);
    } finally {
        first.cancel(); second.cancel(); third.cancel(); oldOwner.stop(); newOwner.stop();
        await native.close();
    }
});

test("stock delivery recovers when another real receiver consumes the shared copy budget", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const delivery = declaration().create();
    const first = deliveryContext(native);
    let competing;
    const observed = [];
    const second = deliveryContext(native, receipt => { observed.push(receipt); return true; }, effect => {
        if (effect.endpoint === "chunk" && !competing) {
            // Competing processor input consumes the actual shared allowance
            // immediately before the stock sender's first packet is delivered.
            competing = native.request({ frames: 1, events: [
                { endpoint: "peerBegin", value: { scope: 1, generation: 1, wordCount: 32 } },
                { endpoint: "peerChunk", value: { scope: 1, generation: 1, offset: 0, count: 32, words: Array(32).fill(42101) } },
            ] });
        }
        return true;
    });
    try {
        await native.request({ frames: 64 });
        const a = Int32Array.from({ length: 257 }, (_, i) => -24007 + i * 193);
        const b = Int32Array.from({ length: 257 }, (_, i) => 81013 - i * 251);
        assert.equal((await delivery.apply(a, first.context)).kind, "acknowledged");
        await native.request({ frames: 1, events: [{ endpoint: "holdReader", value: 0 }] });
        const result = await delivery.apply(b, second.context);
        const competitor = await competing;
        assert.deepEqual(competitor.receipts.map(receipt => [receipt.operation, receipt.status]), [[1, 0], [2, 0]]);
        assert.ok(observed.some(receipt => receipt.operation === 2 && receipt.status === 5 && receipt.receivedWords === 0),
            "actual Cmajor must refuse the stock packet for exhausted copy budget");
        for (let index = 0; index < 257; index++) {
            const block = await native.request({ frames: 2, values: { readIndex: index } });
            assert.deepEqual(block.samples, [[b[index], a[index], 0], [b[index], a[index], 0]], `budget-recovered DSP word ${index}`);
        }
        assert.equal(result.kind, "acknowledged");
        assert.equal(second.listeners.size, 0);
    } finally {
        first.cancel(); second.cancel(); delivery.stop();
        await competing;
        await native.close();
    }
});

test("a throwing connection preserves its cause and releases the delivery listener without a later stop", { timeout: 90_000 }, async () => {
    const native = openEngineDataConnection();
    const delivery = declaration().create();
    const first = deliveryContext(native);
    const broken = deliveryContext(native);
    const defect = new Error("fixture connection broke during synchronous handoff");
    try {
        await native.request({ frames: 64 });
        assert.equal((await delivery.apply(Int32Array.of(701, -903, 1103), first.context)).kind, "acknowledged");
        const context = { ...broken.context, send() { throw defect; } };
        await assert.rejects(delivery.apply(Int32Array.of(2, 3, 5), context), error => error === defect);
        assert.equal(broken.listeners.size, 0, "a rejected operation cannot leave its endpoint subscription alive");
        for (const [readIndex, expected] of [701, -903, 1103].entries()) {
            const block = await native.request({ frames: 2, values: { readIndex } });
            assert.deepEqual(block.samples, [[expected, 0, 0], [expected, 0, 0]]);
        }
    } finally {
        first.cancel(); broken.cancel(); delivery.stop();
        await native.close();
    }
});
