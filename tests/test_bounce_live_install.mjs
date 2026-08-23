import assert from "node:assert/strict";
import test from "node:test";

import { buildBounceBank } from "../bounce/bank-format.mjs";
import {
    BOUNCE_INSTALL_SEND_TIMEOUT_MS,
    requestBounceEngineStatus,
    stageBounceBankInstall,
} from "../bounce/live-bank-install.mjs";
import {
    applyLiveBouncePatchDocument,
    captureLiveBouncePatchDocument,
} from "../bounce/patch-document-adapter.mjs";
import {
    ARTICULATIONS_STATE_KEY,
    BOUNCE_STATE_KEY,
    LANE_STATE_KEY,
    MODULATION_STATE_KEY,
    createBouncePatchDocument,
} from "../bounce/document.mjs";

class FakePatchConnection {
    constructor({ acknowledge = true } = {}) {
        this.acknowledge = acknowledge;
        this.listeners = new Map();
        this.parameterListeners = new Map();
        this.sends = [];
        this.storedWrites = [];
        this.statusListeners = new Set();
        this.parameters = { filterMode: 3, sourceMode: 0, playMode: 2 };
        this.storedState = {
            [MODULATION_STATE_KEY]: "mod",
            [ARTICULATIONS_STATE_KEY]: "art",
            [LANE_STATE_KEY]: "lane",
        };
    }

    addEndpointListener(id, listener) {
        const listeners = this.listeners.get(id) ?? new Set();
        listeners.add(listener);
        this.listeners.set(id, listeners);
    }
    removeEndpointListener(id, listener) { this.listeners.get(id)?.delete(listener); }
    emit(id, value) {
        for (const listener of this.listeners.get(id) ?? []) listener({ event: { value } });
    }
    sendEventOrValue(endpointID, value, rampFrames, timeoutMilliseconds) {
        this.sends.push({ endpointID, value, rampFrames, timeoutMilliseconds });
        if (!this.acknowledge) return;
        if (endpointID === "engineStatusRequest") {
            queueMicrotask(() => this.emit("engineStatus", {
                dspSessionId: 7,
                sampleRateHz: 48_000,
                tempoBpm: 123,
            }));
        } else if (endpointID === "bounceBankLoadBegin") {
            queueMicrotask(() => this.emit("bounceBankRuntimeState", {
                dspSessionId: 7,
                hasActive: 0,
                activeGeneration: 0,
                activeRootCount: 0,
                activeFrameCount: 0,
                hasStaging: 1,
                stagingGeneration: value.generation,
                stagingReceivedFrameCount: 0,
                stagingExpectedFrameCount: value.totalFrameCount,
                rejectedDeliverySerial: 0,
                rejectionReason: 0,
            }));
        } else if (endpointID === "bounceBankFrameBatch") {
            queueMicrotask(() => this.emit("bounceBankUploadAck", {
                dspSessionId: 7,
                generation: value.generation,
                deliverySerial: value.deliverySerial,
                frameIndexBase: value.frameIndexBase,
                frameCount: value.frameCount,
                receivedFrameCount: value.frameIndexBase + value.frameCount,
            }));
        } else if (endpointID === "bounceBankCommit") {
            queueMicrotask(() => this.emit("bounceBankRuntimeState", {
                dspSessionId: 7,
                hasActive: 1,
                activeGeneration: value.generation,
                activeRootCount: 1,
                activeFrameCount: 4,
                hasStaging: 0,
                stagingGeneration: 0,
                stagingReceivedFrameCount: 0,
                stagingExpectedFrameCount: 0,
                rejectedDeliverySerial: 0,
                rejectionReason: 0,
            }));
        }
    }

    addStatusListener(listener) { this.statusListeners.add(listener); }
    removeStatusListener(listener) { this.statusListeners.delete(listener); }
    requestStatusUpdate() {
        queueMicrotask(() => {
            const status = {
                details: {
                    inputs: Object.keys(this.parameters).map((endpointID) => ({
                        endpointID,
                        purpose: "parameter",
                    })),
                },
            };
            for (const listener of this.statusListeners) listener(status);
        });
    }
    addParameterListener(id, listener) {
        const listeners = this.parameterListeners.get(id) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(id, listeners);
    }
    removeParameterListener(id, listener) { this.parameterListeners.get(id)?.delete(listener); }
    requestParameterValue(id) {
        queueMicrotask(() => {
            for (const listener of this.parameterListeners.get(id) ?? []) listener(this.parameters[id]);
        });
    }
    requestFullStoredState(callback) { queueMicrotask(() => callback(this.storedState)); }
    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.storedState[key] = value;
    }
}

function tinyBank() {
    return buildBounceBank({
        sampleRate: 48_000,
        roots: [{ note: 60, samples: Int16Array.of(1, -1, 2, -2, 3, -3, 4, -4) }],
    });
}

class GeneratedPerformerConnection {
    constructor(performer) {
        this.performer = performer;
        this.listeners = new Map();
        this.outputCounts = new Map([
            ["bounceBankUploadAck", 0],
            ["bounceBankRuntimeState", 0],
            ["engineStatus", 0],
        ]);
    }
    addEndpointListener(id, listener) {
        const listeners = this.listeners.get(id) ?? new Set();
        listeners.add(listener);
        this.listeners.set(id, listeners);
    }
    removeEndpointListener(id, listener) { this.listeners.get(id)?.delete(listener); }
    pumpOutputs() {
        for (const [id, consumed] of this.outputCounts) {
            const count = this.performer[`getOutputEventCount_${id}`]();
            for (let index = consumed; index < count; index += 1) {
                const value = this.performer[`getOutputEvent_${id}`](index);
                for (const listener of this.listeners.get(id) ?? []) listener(value);
            }
            this.outputCounts.set(id, count);
        }
    }
    sendEventOrValue(endpointID, value) {
        const eventMethod = this.performer[`sendInputEvent_${endpointID}`];
        const valueMethod = this.performer[`setInputValue_${endpointID}`];
        if (typeof eventMethod === "function") eventMethod.call(this.performer, value);
        else if (typeof valueMethod === "function") valueMethod.call(this.performer, value, 0);
        else throw new Error(`Generated performer has no ${endpointID}`);
        this.performer.advance(2);
        this.pumpOutputs();
    }
}

test("live install reads engine identity, ack-paces staging, and publishes only on commit", async () => {
    const connection = new FakePatchConnection();
    assert.deepEqual(await requestBounceEngineStatus(connection), {
        dspSessionId: 7,
        sampleRateHz: 48_000,
        tempoBpm: 123,
    });
    const progress = [];
    const staged = await stageBounceBankInstall(connection, tinyBank(), {
        dspSessionId: 7,
        generation: 1,
        onProgress: (value) => progress.push(value),
    });
    assert.equal(connection.sends.some(({ endpointID }) => endpointID === "bounceBankCommit"), false);
    assert.deepEqual(progress, [{ completedFrames: 4, totalFrames: 4 }]);
    let applied = false;
    await staged.commit(() => { applied = true; });
    assert.equal(applied, true);
    assert.equal(connection.sends.some(({ endpointID }) => endpointID === "bounceBankCommit"), true);
    assert.equal(connection.sends.every(
        ({ timeoutMilliseconds }) => timeoutMilliseconds === BOUNCE_INSTALL_SEND_TIMEOUT_MS,
    ), true);
});

test("live staged installer composes with the actual generated Cmajor protocol", async () => {
    const engine = await import("../build/web/cmaj_Cosimo_Synth.offline.js");
    const performer = new engine.default();
    await performer.initialise(42, 48_000);
    const connection = new GeneratedPerformerConnection(performer);
    connection.sendEventOrValue("tempo", { bpm: 137 });
    const status = await requestBounceEngineStatus(connection);
    assert.deepEqual(status, { dspSessionId: 42, sampleRateHz: 48_000, tempoBpm: 137 });
    const staged = await stageBounceBankInstall(connection, tinyBank(), {
        dspSessionId: status.dspSessionId,
        generation: 1,
    });
    await staged.commit(() => connection.sendEventOrValue("sourceMode", 1));
    const count = performer.getOutputEventCount_bounceBankRuntimeState();
    const state = performer.getOutputEvent_bounceBankRuntimeState(count - 1).event;
    assert.equal(state.hasActive, 1);
    assert.equal(state.activeGeneration, 1);
    assert.equal(state.activeFrameCount, 4);
});

test("missing begin acknowledgement times out and sends only an abort, never a commit", async () => {
    const connection = new FakePatchConnection({ acknowledge: false });
    await assert.rejects(
        stageBounceBankInstall(connection, tinyBank(), {
            dspSessionId: 7,
            generation: 1,
            timeoutMilliseconds: 10,
        }),
        (error) => error.code === "timeout",
    );
    assert.equal(connection.sends.some(({ endpointID }) => endpointID === "bounceBankAbort"), true);
    assert.equal(connection.sends.some(({ endpointID }) => endpointID === "bounceBankCommit"), false);
});

test("live document adapter snapshots every parameter/document and queues Source Mode last", async () => {
    const connection = new FakePatchConnection();
    const captured = await captureLiveBouncePatchDocument(connection);
    assert.deepEqual(captured.parameters, { filterMode: 3, playMode: 2, sourceMode: 0 });
    assert.equal(captured.storedState[BOUNCE_STATE_KEY], null);

    const next = createBouncePatchDocument({
        parameters: { ...captured.parameters, filterMode: 0, sourceMode: 1 },
        storedState: captured.storedState,
    });
    connection.sends = [];
    applyLiveBouncePatchDocument(connection, next);
    assert.equal(connection.sends.at(-1).endpointID, "sourceMode");
    assert.deepEqual(connection.storedWrites.map(({ key }) => key), [
        ARTICULATIONS_STATE_KEY,
        BOUNCE_STATE_KEY,
        LANE_STATE_KEY,
        MODULATION_STATE_KEY,
    ]);
});
