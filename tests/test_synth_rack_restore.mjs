import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const [{ createSynthRackRestore }, laneV2, lane, trim] = await Promise.all([
    loadUIModule(repoRoot, "ui/worker/synth-rack-restore.ts"),
    loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
    loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
]);

/** A DSP host without the kit's state channel: saved values, endpoint outputs and recorded inputs. */
function createHost(saved = {}) {
    const endpointListeners = new Map();
    const storedListeners = new Set();
    const sent = [];
    return {
        sent,
        addEndpointListener(endpoint, listener) {
            if (!endpointListeners.has(endpoint)) endpointListeners.set(endpoint, new Set());
            endpointListeners.get(endpoint).add(listener);
        },
        removeEndpointListener(endpoint, listener) { endpointListeners.get(endpoint)?.delete(listener); },
        addStoredStateValueListener(listener) { storedListeners.add(listener); },
        removeStoredStateValueListener(listener) { storedListeners.delete(listener); },
        requestFullStoredState(callback) { callback({ values: { ...saved } }); },
        sendEventOrValue(endpointID, value) { sent.push({ endpointID, value }); },
        emit(endpoint, value) { for (const listener of endpointListeners.get(endpoint) ?? []) listener(value); },
        saveValue(key, value) { for (const listener of storedListeners) listener({ key, value }); },
        listenerCount: () => [...endpointListeners.values()].reduce((count, set) => count + set.size, 0) + storedListeners.size,
    };
}

/** What a full rack upload must contain: every rack event except the Output Trim host parameters. */
function expectedUpload(rack) {
    let serial = 0;
    return laneV2.buildLaneRuntimeEventsV2(rack)
        .filter(({ endpointID }) => trim.parseEffectOutputTrimHostEndpointID(endpointID) === null)
        .map((event) => event.endpointID === lane.LANE_SLOT_PARAMS_ENDPOINT_ID
            ? { ...event, value: { ...event.value, deliverySerial: ++serial } }
            : event);
}

async function settle() {
    for (let turn = 0; turn < 5; turn += 1) await setImmediate();
}

test("the rack waits for the DSP session, then sends the saved rack through the synth's rack delivery", async () => {
    const rack = laneV2.addLaneDevice(laneV2.createDefaultLaneStateV2(), "chorus", { kind: "trunk", index: 0 });
    assert.ok(rack);
    const host = createHost({ [lane.LANE_STATE_KEY]: JSON.parse(laneV2.serializeLaneStateV2(rack)) });
    const defects = [];
    const restore = createSynthRackRestore(host, { onDefect: (error) => defects.push(error) });

    restore.start();
    await settle();
    assert.deepEqual(host.sent, [], "nothing is sent before the DSP reports its session");

    host.emit("runtimeState", { dspSessionId: 4 });
    await settle();
    assert.deepEqual(host.sent, expectedUpload(rack));
    assert.deepEqual(defects, []);
    restore.stop();
});

test("with nothing saved, the synth's default rack is sent", async () => {
    const host = createHost();
    const restore = createSynthRackRestore(host, { onDefect: (error) => assert.fail(String(error)) });
    restore.start();
    host.emit("runtimeState", { dspSessionId: 1 });
    await settle();
    assert.deepEqual(host.sent, expectedUpload(laneV2.createDefaultLaneStateV2()));
    restore.stop();
});

test("a DSP restart replays the whole rack, and a newly saved rack is sent", async () => {
    const host = createHost();
    const restore = createSynthRackRestore(host, { onDefect: (error) => assert.fail(String(error)) });
    restore.start();
    host.emit("runtimeState", { dspSessionId: 1 });
    await settle();
    const firstUpload = host.sent.splice(0);

    host.emit("runtimeState", { dspSessionId: 2 });
    await settle();
    assert.deepEqual(host.sent.map(({ endpointID }) => endpointID), firstUpload.map(({ endpointID }) => endpointID));
    host.sent.splice(0);

    const withPhaser = laneV2.addLaneDevice(laneV2.createDefaultLaneStateV2(), "phaser", { kind: "trunk", index: 0 });
    assert.ok(withPhaser);
    host.saveValue(lane.LANE_STATE_KEY, JSON.parse(laneV2.serializeLaneStateV2(withPhaser)));
    await settle();
    assert.ok(host.sent.some(({ endpointID }) => endpointID === lane.LANE_TOPOLOGY_ENDPOINT_ID), "the new chain is uploaded");
    restore.stop();
});

test("an unreadable saved rack is reported and nothing is sent", async () => {
    const host = createHost({ [lane.LANE_STATE_KEY]: { format: "cosimo.lane", version: 1 } });
    const defects = [];
    const restore = createSynthRackRestore(host, { onDefect: (error) => defects.push(error) });
    restore.start();
    host.emit("runtimeState", { dspSessionId: 1 });
    await settle();
    assert.deepEqual(host.sent, []);
    assert.match(String(defects[0]), /The saved rack could not be read: Invalid rack document\./);
    restore.stop();
});

test("stopping removes every listener and sends nothing more", async () => {
    const host = createHost();
    const restore = createSynthRackRestore(host, { onDefect: (error) => assert.fail(String(error)) });
    restore.start();
    await restore.stop();
    assert.equal(host.listenerCount(), 0);
    host.emit("runtimeState", { dspSessionId: 1 });
    await settle();
    assert.deepEqual(host.sent, []);
});
