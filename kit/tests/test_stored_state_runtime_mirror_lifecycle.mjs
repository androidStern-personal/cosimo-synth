import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const { createStoredStateRuntimeMirror } = await loadUIModule(
    path.resolve(import.meta.dirname, "../.."),
    "kit/ui/stored-state-runtime-mirror.ts",
);

// The real connection is asynchronous. This adapter lets each test deliver a
// requested native snapshot at an exact point in the mirror's lifetime.
class DeferredStateConnection {
    requests = [];
    events = [];
    listeners = new Set();

    addStoredStateValueListener(listener) { this.listeners.add(listener); }
    removeStoredStateValueListener(listener) { this.listeners.delete(listener); }
    emit(value) {
        for (const listener of this.listeners) listener({ key: "curve", value });
    }

    requestFullStoredState(receive) {
        this.requests.push(receive);
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }

    reply(requestIndex, value) {
        assert.ok(this.requests[requestIndex], "test must reply to a real request");
        this.requests[requestIndex]({ values: { curve: value } });
    }
}

function createMirror(connection) {
    return createStoredStateRuntimeMirror(connection, {
        stateKey: "curve",
        deserializeStoredState: value => typeof value === "number" ? value : null,
        buildRuntimeEvents: ({ state }) => [{ endpointID: "curveBuffer", value: state }],
    });
}

test("a full-state reply after stop cannot send to the engine; a new start still works", () => {
    const connection = new DeferredStateConnection();
    const mirror = createMirror(connection);

    mirror.start();
    mirror.stop();
    connection.reply(0, 10);
    assert.deepEqual(connection.events, []);

    mirror.start();
    connection.reply(1, 20);
    assert.deepEqual(connection.events, [{ endpointID: "curveBuffer", value: 20 }]);
    mirror.stop();
});

test("restart makes progress without an old delivery and ignores its eventual completion", async () => {
    const connection = new DeferredStateConnection();
    const deliveries = [];
    const mirror = createStoredStateRuntimeMirror(connection, {
        stateKey: "curve",
        deserializeStoredState: value => typeof value === "number" ? value : null,
        // Incremental rendering depends on the last successfully delivered value.
        buildRuntimeEvents: ({ state }, previous) => [{
            endpointID: "curveDelta", value: state - (previous?.state ?? 0),
        }],
        sendRuntimeEvents(events) {
            const completion = Promise.withResolvers();
            deliveries.push({ events, completion });
            return completion.promise;
        },
    });

    mirror.start();
    connection.reply(0, 10); // This delivery remains pending across restart.
    mirror.stop();
    mirror.start();
    connection.reply(1, 20);
    assert.deepEqual(deliveries.map(item => item.events), [
        [{ endpointID: "curveDelta", value: 10 }],
        [{ endpointID: "curveDelta", value: 20 }],
    ]);

    deliveries[1].completion.resolve(true);
    await setImmediate();
    deliveries[0].completion.resolve(true); // Too late to become the new baseline.
    await setImmediate();
    connection.emit(30);
    assert.deepEqual(deliveries[2].events, [{ endpointID: "curveDelta", value: 10 }]);
    deliveries[2].completion.resolve(true);
    await setImmediate();
    mirror.stop();
});

test("a reply from before restart cannot replace the new lifetime's curve", () => {
    const connection = new DeferredStateConnection();
    const mirror = createMirror(connection);

    mirror.start();
    mirror.stop();
    mirror.start();
    connection.reply(1, 20);
    connection.reply(0, 10);
    mirror.replayFullRuntimeState();

    assert.deepEqual(connection.events, [
        { endpointID: "curveBuffer", value: 20 },
        { endpointID: "curveBuffer", value: 20 },
    ]);
    mirror.stop();
});

for (const outcome of ["success", "failure", "rejection"]) {
    test(`an old delivery ${outcome} cannot release new work or report a current failure`, async () => {
        const connection = new DeferredStateConnection();
        const deliveries = [];
        const failures = [];
        const mirror = createStoredStateRuntimeMirror(connection, {
            stateKey: "curve",
            deserializeStoredState: value => typeof value === "number" ? value : null,
            buildRuntimeEvents: ({ state }) => [{ endpointID: "curveBuffer", value: state }],
            sendRuntimeEvents(events) {
                const completion = Promise.withResolvers();
                deliveries.push({ events, completion });
                return completion.promise;
            },
            onDeliveryFailure: events => failures.push(events),
        });
        mirror.start();
        connection.reply(0, 10);
        mirror.stop();
        mirror.start();
        connection.reply(1, 20);

        if (outcome === "rejection") deliveries[0].completion.reject(new Error("old connection failed"));
        else deliveries[0].completion.resolve(outcome === "success");
        await setImmediate();
        connection.emit(30);
        assert.deepEqual(deliveries.map(item => item.events[0].value), [10, 20]);
        assert.deepEqual(failures, []);

        deliveries[1].completion.resolve(true);
        await setImmediate();
        assert.deepEqual(deliveries.map(item => item.events[0].value), [10, 20, 30]);
        deliveries[2].completion.resolve(true);
        await setImmediate();
        mirror.stop();
    });
}
