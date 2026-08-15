import test from "node:test";
import assert from "node:assert/strict";

import {
    RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    RuntimeInstallLane,
} from "../patch_gui/runtime-install-channel.js";

function withDeadline(promise, milliseconds = 1_000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(
            () => reject(new Error(`Timed out after ${milliseconds}ms`)),
            milliseconds,
        )),
    ]);
}

class RuntimeInstallTestConnection {
    constructor({ sessionId = 7, onPayload, onSync } = {}) {
        this.sessionId = sessionId;
        this.acceptedModulationSerial = 0;
        this.acceptedArticulationSerial = 0;
        this.onPayload = onPayload;
        this.onSync = onSync;
        this.listeners = new Map();
        this.sends = [];
        this.activePayloads = 0;
        this.maxActivePayloads = 0;
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.listeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.listeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.listeners.get(endpointID)?.delete(listener);
    }

    sendEventOrValue(endpointID, value, _rampFrames, timeoutMilliseconds) {
        this.sends.push({ endpointID, value, timeoutMilliseconds });
        if (endpointID === "runtimeSyncRequest") {
            if (this.onSync) {
                this.onSync(this, value);
            } else {
                queueMicrotask(() => this.emitAck({ syncSerial: value }));
            }
            return;
        }

        this.activePayloads += 1;
        this.maxActivePayloads = Math.max(this.maxActivePayloads, this.activePayloads);
        if (this.onPayload) {
            this.onPayload(this, endpointID, value);
            return;
        }

        queueMicrotask(() => this.acceptPayload(value));
    }

    acceptPayload(value, { emitAck = true } = {}) {
        if (value.deliverySerial > 0) {
            assert.equal(value.deliverySerial, this.acceptedModulationSerial + 1);
            this.acceptedModulationSerial = value.deliverySerial;
        } else {
            assert.equal(value.deliverySerial, this.acceptedArticulationSerial - 1);
            this.acceptedArticulationSerial = value.deliverySerial;
        }
        this.activePayloads -= 1;
        if (emitAck) {
            this.emitAck();
        }
    }

    dropPayload() {
        this.activePayloads -= 1;
    }

    emitAck(overrides = {}) {
        const ack = {
            dspSessionId: this.sessionId,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: this.acceptedArticulationSerial,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial: 0,
            ...overrides,
        };
        this.emitRawAck({ event: { value: ack } });
    }

    emitRawAck(value) {
        for (const listener of this.listeners.get("runtimeInstallAck") ?? []) {
            listener(value);
        }
    }
}

function startLane(connection, laneKind = "modulation", options = {}) {
    const lane = new RuntimeInstallLane(connection, {
        laneKind,
        probeDelaysMilliseconds: [1],
        ...options,
    });
    lane.start();
    lane.observeRuntime(connection.sessionId);
    return lane;
}

test("runtime install lane sends only one addressed payload at a time with nonblocking FIFO writes", async () => {
    const connection = new RuntimeInstallTestConnection();
    const lane = startLane(connection);
    const commands = Array.from({ length: 128 }, (_, index) => ({
        endpointID: "modulationProgram",
        value: { index, largeImage: Array.from({ length: 256 }, () => index) },
    }));

    assert.deepEqual(await withDeadline(lane.sendBatch(commands)), { _tag: "accepted" });

    const payloads = connection.sends.filter(({ endpointID }) => endpointID === "modulationProgram");
    assert.equal(payloads.length, 128);
    assert.deepEqual(payloads.map(({ value }) => value.deliverySerial),
        Array.from({ length: 128 }, (_, index) => index + 1));
    assert.equal(payloads.every(({ value }) => value.dspSessionId === 7), true);
    assert.equal(connection.maxActivePayloads, 1);
    assert.equal(connection.sends.every(
        ({ timeoutMilliseconds }) => timeoutMilliseconds === RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    ), true);

    lane.stop();
});

test("a dropped input is replayed with the exact same serial after a correlated frontier probe", async () => {
    let payloadAttempt = 0;
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            payloadAttempt += 1;
            if (payloadAttempt === 1) {
                fake.dropPayload();
                return;
            }
            queueMicrotask(() => fake.acceptPayload(value));
        },
    });
    const lane = startLane(connection);

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }])), { _tag: "accepted" });

    const payloads = connection.sends.filter(({ endpointID }) => endpointID === "modulationProgram");
    assert.equal(payloads.length, 2);
    assert.deepEqual(payloads[0].value, payloads[1].value);
    assert.equal(payloads[0].value.deliverySerial, 1);
    assert.equal(connection.sends.some(
        ({ endpointID, value }) => endpointID === "runtimeSyncRequest" && value === 1,
    ), true);

    lane.stop();
});

test("a dropped output ack is proven by the frontier without replaying the large payload", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            queueMicrotask(() => fake.acceptPayload(value, { emitAck: false }));
        },
    });
    const lane = startLane(connection);

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 1118 },
    }])), { _tag: "accepted" });

    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 1);
    assert.equal(connection.sends.some(
        ({ endpointID, value }) => endpointID === "runtimeSyncRequest" && value === 1,
    ), true);

    lane.stop();
});

test("a synchronous transport failure is treated as a dropped write and recovered", async () => {
    let payloadAttempt = 0;
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            payloadAttempt += 1;
            if (payloadAttempt === 1) {
                fake.dropPayload();
                throw new Error("FIFO write failed");
            }
            queueMicrotask(() => fake.acceptPayload(value));
        },
    });
    const lane = startLane(connection);

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }])), { _tag: "accepted" });
    assert.equal(payloadAttempt, 2);

    lane.stop();
});

test("a semantic DSP rejection fails the batch without replay", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            fake.dropPayload();
            queueMicrotask(() => fake.emitAck({
                rejectedSerial: value.deliverySerial,
                rejectionReason: 3,
            }));
        },
    });
    const lane = startLane(connection);

    const outcome = await withDeadline(lane.sendBatch([
        {
            endpointID: "modulationProgram",
            value: { invalid: true },
        },
        {
            endpointID: "modulationAmount",
            value: { mustNotRunAfterRejectedTopology: true },
        },
    ]));
    assert.equal(outcome._tag, "rejected");
    assert.equal(outcome.acknowledgement.rejectedSerial, 1);
    assert.equal(outcome.acknowledgement.rejectionReason, 3);
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 1);
    assert.equal(connection.sends.some(
        ({ endpointID }) => endpointID === "modulationAmount",
    ), false);

    lane.stop();
});

test("a rejection cannot be erased by a following sync acknowledgement", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            fake.dropPayload();
            queueMicrotask(() => {
                fake.emitAck({
                    rejectedSerial: value.deliverySerial,
                    rejectionReason: 3,
                });
                fake.emitAck({ syncSerial: value.deliverySerial });
            });
        },
    });
    const lane = startLane(connection);

    const outcome = await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { invalid: true },
    }]));

    assert.equal(outcome._tag, "rejected");
    assert.equal(outcome.acknowledgement.rejectedSerial, 1);
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 1);
    lane.stop();
});

test("only one publisher can own each runtime lane on a connection", () => {
    const connection = new RuntimeInstallTestConnection();
    const first = new RuntimeInstallLane(connection, { laneKind: "modulation" });
    const second = new RuntimeInstallLane(connection, { laneKind: "modulation" });
    const articulation = new RuntimeInstallLane(connection, { laneKind: "articulation" });

    first.start();
    articulation.start();
    assert.throws(
        () => second.start(),
        /modulation runtime install lane is already active/,
    );

    first.stop();
    second.start();
    second.stop();
    articulation.stop();
});

test("articulation installs use an independent descending frontier", async () => {
    const connection = new RuntimeInstallTestConnection();
    const lane = startLane(connection, "articulation");

    assert.deepEqual(await withDeadline(lane.sendBatch([
        { endpointID: "articulationSnapshot", value: { selectorA: 0 } },
        { endpointID: "articulationSnapshot", value: { selectorA: 1 } },
    ])), { _tag: "accepted" });

    assert.deepEqual(connection.sends.filter(
        ({ endpointID }) => endpointID === "articulationSnapshot",
    ).map(({ value }) => value.deliverySerial), [-1, -2]);
    assert.equal(connection.acceptedArticulationSerial, -2);

    lane.stop();
});

test("articulation batches continue past one rejected selector without starving later selectors", async () => {
    const deliveredSelectors = [];
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake, _endpointID, value) {
            if (value.selectorA === 1) {
                fake.activePayloads -= 1;
                queueMicrotask(() => fake.emitAck({
                    rejectedSerial: value.deliverySerial,
                    rejectionReason: 3,
                }));
                return;
            }
            deliveredSelectors.push(value.selectorA);
            queueMicrotask(() => fake.acceptPayload(value));
        },
    });
    const lane = startLane(connection, "articulation");

    const outcome = await withDeadline(lane.sendBatch([
        { endpointID: "articulationSnapshot", value: { selectorA: 0 } },
        { endpointID: "articulationSnapshot", value: { selectorA: 1 } },
        { endpointID: "articulationSnapshot", value: { selectorA: 2 } },
    ]));

    assert.equal(outcome._tag, "rejected");
    assert.deepEqual(deliveredSelectors, [0, 2]);
    const payloads = connection.sends.filter(
        ({ endpointID }) => endpointID === "articulationSnapshot",
    );
    assert.deepEqual(payloads.map(({ value }) => value.selectorA), [0, 1, 2]);
    assert.deepEqual(payloads.map(({ value }) => value.deliverySerial), [-1, -2, -2]);

    lane.stop();
});

test("a fresh lane waits for its own baseline probe before addressing same-session payloads", async () => {
    const syncRequests = [];
    const connection = new RuntimeInstallTestConnection({
        onSync(_fake, syncSerial) {
            syncRequests.push(syncSerial);
        },
    });
    const lane = startLane(connection, "articulation");
    const pending = lane.sendBatch([{
        endpointID: "articulationSnapshot",
        value: { selectorA: 4 },
    }]);

    assert.equal(syncRequests.length, 1);
    const ownBaselineSyncSerial = syncRequests[0];
    assert.notEqual(ownBaselineSyncSerial, 0);

    connection.emitAck({ syncSerial: 0 });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "articulationSnapshot",
    ).length, 0, "an unrelated current-session acknowledgement cannot establish this lane's baseline");

    connection.acceptedArticulationSerial = -1;
    connection.emitAck({ syncSerial: ownBaselineSyncSerial });
    assert.deepEqual(await withDeadline(pending), { _tag: "accepted" });

    const [payload] = connection.sends.filter(
        ({ endpointID }) => endpointID === "articulationSnapshot",
    );
    assert.equal(payload.value.deliverySerial, -2);

    lane.stop();
});

test("a DSP session change cancels an in-flight batch and ignores stale acknowledgements", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake) {
            fake.dropPayload();
        },
        onSync() {},
    });
    const lane = startLane(connection);
    const pending = lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }]);

    await new Promise((resolve) => setTimeout(resolve, 3));
    connection.sessionId = 8;
    lane.observeRuntime(8);
    connection.emitAck({ dspSessionId: 7, acceptedModulationSerial: 1 });

    assert.deepEqual(await withDeadline(pending), { _tag: "superseded" });

    lane.stop();
});

test("stop cancels an unacknowledged command instead of leaving restore work alive", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake) {
            fake.dropPayload();
        },
        onSync() {},
    });
    const lane = startLane(connection);
    const pending = lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }]);

    await new Promise((resolve) => setTimeout(resolve, 3));
    lane.stop();

    assert.deepEqual(await withDeadline(pending), { _tag: "stopped" });
});

test("a missing session baseline reaches a typed health timeout before any payload is sent", async () => {
    const connection = new RuntimeInstallTestConnection({
        onSync() {},
    });
    const lane = startLane(connection, "modulation", {
        healthTimeoutMilliseconds: 20,
    });

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }])), { _tag: "transport-timeout" });
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 0);

    lane.stop();
});

test("malformed acknowledgements are ignored instead of being coerced into a frontier", async () => {
    let validBaselineSent = false;
    const connection = new RuntimeInstallTestConnection({
        onSync(fake, syncSerial) {
            queueMicrotask(() => fake.emitRawAck({
                dspSessionId: fake.sessionId,
                syncSerial,
            }));
            setTimeout(() => {
                validBaselineSent = true;
                fake.emitAck({ syncSerial });
            }, 5);
        },
        onPayload(fake, _endpointID, value) {
            assert.equal(validBaselineSent, true);
            queueMicrotask(() => fake.acceptPayload(value));
        },
    });
    const lane = startLane(connection);

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }])), { _tag: "accepted" });

    lane.stop();
});

test("an uncertain queued payload is never duplicated or timed out while the DSP is suspended", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload() {
            // Accepted by the transport but deliberately left undrained.
        },
        onSync(fake, syncSerial) {
            const payloadHasBeenSent = fake.sends.some(
                ({ endpointID }) => endpointID === "modulationProgram",
            );
            if (!payloadHasBeenSent) {
                queueMicrotask(() => fake.emitAck({ syncSerial }));
            }
        },
    });
    const lane = startLane(connection, "modulation", {
        healthTimeoutMilliseconds: 20,
    });
    const pending = lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 1118 },
    }]);

    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 1);

    lane.stop();
    assert.deepEqual(await withDeadline(pending), { _tag: "stopped" });
});

test("two correlated proofs of dropped input bound one command to one replay", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake) {
            fake.dropPayload();
        },
    });
    const lane = startLane(connection, "modulation");

    assert.deepEqual(await withDeadline(lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 1118 },
    }])), { _tag: "transport-timeout" });
    assert.equal(connection.sends.filter(
        ({ endpointID }) => endpointID === "modulationProgram",
    ).length, 2);

    lane.stop();
});

test("stop then immediate restart still cancels work from the prior lifecycle", async () => {
    const connection = new RuntimeInstallTestConnection({
        onPayload(fake) {
            fake.dropPayload();
        },
        onSync(fake, syncSerial) {
            if (syncSerial === 0) {
                queueMicrotask(() => fake.emitAck());
            }
        },
    });
    const lane = startLane(connection);
    const pending = lane.sendBatch([{
        endpointID: "modulationProgram",
        value: { routeCount: 100 },
    }]);

    await new Promise((resolve) => setTimeout(resolve, 3));
    lane.stop();
    lane.start();

    assert.deepEqual(await withDeadline(pending), { _tag: "stopped" });
    lane.stop();
});

test("modulation and articulation lanes restore independently with one payload per lane in flight", async () => {
    const connection = new RuntimeInstallTestConnection();
    const modulationLane = startLane(connection, "modulation");
    const articulationLane = startLane(connection, "articulation");

    const [modulationOutcome, articulationOutcome] = await withDeadline(Promise.all([
        modulationLane.sendBatch(Array.from({ length: 100 }, (_, index) => ({
            endpointID: "modulationAmount",
            value: { index },
        }))),
        articulationLane.sendBatch(Array.from({ length: 128 }, (_, selectorA) => ({
            endpointID: "articulationSnapshot",
            value: { selectorA },
        }))),
    ]));

    assert.deepEqual(modulationOutcome, { _tag: "accepted" });
    assert.deepEqual(articulationOutcome, { _tag: "accepted" });
    assert.equal(connection.maxActivePayloads, 2);
    assert.equal(connection.acceptedModulationSerial, 100);
    assert.equal(connection.acceptedArticulationSerial, -128);

    modulationLane.stop();
    articulationLane.stop();
});
