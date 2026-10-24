import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { RuntimeInstallLane } = await loadUIModule(root, "ui/shared/runtime-install-channel.ts");
const { definePluginState, preparedState } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const scope = { owner: "runtime-lane-owner", document: 0 };
const codec = {
    parse(value) {
        return typeof value === "number" && Number.isFinite(value)
            ? { kind: "ok", value } : { kind: "error", message: "Expected a finite value." };
    },
    encode(value) { return value; },
    equals(left, right) { return left === right; },
};

// External native/FIFO fixture only. Specific supplied ACK frontiers describe
// the first dropped handoff and the later accepted replay. RuntimeInstallLane
// itself chooses when to probe, whether to replay, and which serial to use.
class NativeTransport {
    messages = [];
    listeners = new Set();
    endpointListeners = new Map();
    handoffs = [];
    attempts = 0;
    problem = new Error("native FIFO handoff failed before acceptance");
    addEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.add(listener); }
    removeEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.delete(listener); }
    deliver(body) { for (const listener of [...this.listeners]) listener(structuredClone(body)); }
    addEndpointListener(endpoint, listener) {
        const listeners = this.endpointListeners.get(endpoint) ?? new Set();
        listeners.add(listener); this.endpointListeners.set(endpoint, listeners);
    }
    removeEndpointListener(endpoint, listener) { this.endpointListeners.get(endpoint)?.delete(listener); }
    ack(frontier, syncSerial) {
        const body = { event: { value: { dspSessionId: 7, acceptedModulationSerial: frontier,
            acceptedArticulationSerial: 0, rejectedSerial: 0, rejectionReason: 0, syncSerial } } };
        for (const listener of this.endpointListeners.get("runtimeInstallAck") ?? []) listener(body);
    }
    sendMessageToServer(envelope) {
        const message = structuredClone(envelope.message);
        this.messages.push(message);
        if (message.kind !== "publish") return;
        assert.equal(message.operations.length, 1);
        const operation = message.operations[0];
        this.handoffs.push(operation);
        if (operation.endpoint === "program") {
            this.attempts++;
            if (this.attempts === 1) throw this.problem;
            // The external runtime accepts the retried serial1. It can deliver
            // its DSP ACK before the separate native publication receipt.
            queueMicrotask(() => {
                this.ack(1, 0);
                this.deliver({ kind: "published", request: message.request, scope, result: { kind: "observed" } });
            });
        } else {
            assert.equal(operation.endpoint, "runtimeSyncRequest");
            queueMicrotask(() => {
                this.ack(0, operation.value);
                this.deliver({ kind: "published", request: message.request, scope, result: { kind: "observed" } });
            });
        }
    }
}

test("actual custom publisher preserves an uncertain raw throw so RuntimeInstallLane probes and replays the same serial", { timeout: 5000 }, async () => {
    const connection = new NativeTransport();
    const defects = [];
    const immediateFailures = [];
    const nativeOutcomes = [];
    let delivery;
    let lane;
    const definition = definePluginState({ bank: preparedState({ initial: 1, codec, prepare: value => value,
        engine: { eventEndpoints: ["program", "runtimeSyncRequest"], outputEndpoints: ["runtimeInstallAck"], create() {
            return {
                async apply(value, context) {
                    const completions = [];
                    const listeners = new Map();
                    lane = new RuntimeInstallLane({
                        addEndpointListener(endpoint, listener) { listeners.set(listener, context.listen(endpoint, listener)); },
                        removeEndpointListener(_endpoint, listener) { listeners.get(listener)?.(); listeners.delete(listener); },
                        sendEventOrValue(endpoint, value) {
                            const submission = context.send({ kind: "event", endpoint, value });
                            if (submission.kind === "failed") {
                                immediateFailures.push(submission);
                                // Existing lane contract treats a synchronous
                                // native handoff failure as uncertain, then
                                // consults its real correlated frontier.
                                if (submission.error.kind === "transport") throw new Error(submission.error.message);
                                lane.stop();
                            } else if (submission.kind === "cancelled") lane.stop();
                            else completions.push(submission.completion.then(outcome => {
                                nativeOutcomes.push(outcome);
                                if (outcome.kind !== "sent") lane.stop();
                            }));
                        },
                    }, { laneKind: "modulation", probeDelaysMilliseconds: [1], healthTimeoutMilliseconds: 500 });
                    lane.start();
                    lane.observeRuntime(7);
                    delivery = lane.sendBatch([{ endpointID: "program", value: { routeCount: value } }]).then(async result => {
                        await Promise.all(completions);
                        return result;
                    });
                    const result = await delivery;
                    return result._tag === "accepted" ? { kind: "acknowledged", engineSession: "7", operation: "1" } : { kind: "cancelled" };
                },
                stop() { lane?.stop(); },
            };
        } },
    }) });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        const open = connection.messages.find(message => message.kind === "open");
        assert.ok(open);
        connection.deliver({ kind: "opened", request: open.request, scope, native: { parameters: [], values: { bank: 100 } } });
        await starting;
        await setImmediate();
        assert.ok(delivery, "the actual service must start the configured runtime lane");
        assert.deepEqual(await delivery, { _tag: "accepted" });
        assert.deepEqual(immediateFailures.map(result => result.error.kind), ["transport"]);
        assert.deepEqual(defects, [connection.problem], "retain the original raw error once without closing the owner");
        const payloads = connection.handoffs.filter(operation => operation.endpoint === "program");
        assert.equal(payloads.length, 2);
        assert.deepEqual(payloads[0].value, { routeCount: 100, dspSessionId: 7, deliverySerial: 1 });
        assert.deepEqual(payloads[1], payloads[0], "actual lane must replay the same payload and serial");
        const firstPayload = connection.handoffs.indexOf(payloads[0]);
        const replay = connection.handoffs.indexOf(payloads[1]);
        assert.ok(connection.handoffs.slice(firstPayload + 1, replay)
            .some(operation => operation.endpoint === "runtimeSyncRequest" && operation.value === 1),
        "replay requires the actual lane's correlated frontier probe");
        assert.ok(nativeOutcomes.length >= 3, "baseline, correlated probe and accepted replay each settle native publication evidence");
        assert.equal(nativeOutcomes.every(outcome => outcome.kind === "sent" && outcome.proof === "native-publication-processed"), true);
        assert.equal(connection.messages.some(message => message.kind === "close"), false);
        assert.equal(connection.listeners.size, 1);
        connection.deliver({ kind: "attached-client", scope, client: 8, request: 20 });
        await setImmediate();
        const attached = connection.messages.find(message => message.kind === "snapshot" && message.to === 8);
        assert.equal(attached.state.fields.bank.value, 100);
        assert.deepEqual(attached.state.history, { canUndo: false, canRedo: false });
    } finally {
        await service.stop();
    }
    assert.equal(connection.listeners.size, 0);
    assert.equal(connection.endpointListeners.get("runtimeInstallAck").size, 0);
});
