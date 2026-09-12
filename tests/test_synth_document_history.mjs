import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { loadChannel, waitForModulation as until } from "./helpers/modulation_state_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const bundle = await build({ stdin: { contents: `
export { createMockPluginStateHost } from './ui/shared/mock-plugin-state-host';
export { acquireSynthViewState } from './ui/shared/synth-state-client';
export { createSynthDocumentClient } from './ui/shared/synth-document-client';
export { createDefaultLaneStateV2, setLaneDeviceParam, setLaneDeviceEnabled } from './ui/shared/lane-state-v2';
export { getLaneSlotId, getLaneSlotParamIndex } from './ui/shared/lane-slot-params';
export { createEmptyArticulationsState } from './ui/shared/articulation-image';
`, resolveDir: root }, bundle: true, platform: "node", format: "esm", write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("rack gestures, articulation and parameters share Undo; actual delivery updates independent engine records and preserves automated trim", async t => {
    const stored = new Map(), parameters = new Map(), events = [], records = new Map(), defects = [];
    // Only native storage and the engine input receiver are modeled. This receiver
    // never consults the saved rack document; missing delivery cannot pass here.
    const host = api.createMockPluginStateHost({ loadChannel,
        storedValues: { read: key => stored.get(key), write: (key, value) => stored.set(key, value) },
        readParameter: async endpoint => ({ endpoint, value: parameters.get(endpoint) ?? 0, min: -200000, max: 200000, step: 0, defaultValue: 0 }),
        writeParameter: (key, value) => parameters.set(key, value), beginGesture() {}, endGesture() {}, onDefect: error => defects.push(error),
        engine: { handleHostEffect: () => true, sendEvent(endpoint, value) {
            events.push({ endpoint, value: structuredClone(value) });
            if (endpoint === "laneSlotParams") records.set(value.slotId, [...value.values]);
            if (endpoint === "laneSlotParamValue") {
                assert.ok(records.has(value.slotId), "a delta requires an installed record");
                records.get(value.slotId)[value.paramIndex] = value.value;
            }
        } },
    });
    const lease = api.acquireSynthViewState(host);
    const rack = api.createSynthDocumentClient(host, "lane.v1");
    const articulation = api.createSynthDocumentClient(host, "articulations.v4");
    t.after(async () => { rack.stop(); articulation.stop(); lease.release(); await host.stop(); assert.deepEqual(defects, []); });
    await host.ready;
    const state = () => lease.client.getSnapshot().state;
    await until(() => state()?.fields["lane.v1"]?.application?.kind === "sent");
    const slot = api.getLaneSlotId("delay", 0), time = api.getLaneSlotParamIndex("delay", "delayTime");
    const trim = api.getLaneSlotParamIndex("delay", "delayOutputTrimDb");
    const initial = rack.read(), original = records.get(slot)[time];
    const settle = () => until(() => state()?.fields["lane.v1"]?.application?.kind === "sent" && !lease.client.getSnapshot().pendingFields.length);
    const accepted = async command => assert.equal((await lease.client.dispatch(command)).kind, "accepted");
    events.length = 0;
    rack.begin();
    assert.equal((await rack.set(api.setLaneDeviceParam(rack.read(), "delay#1", "delayTime", 321))).kind, "accepted");
    await settle();
    assert.equal((await rack.set(api.setLaneDeviceParam(rack.read(), "delay#1", "delayTime", 456))).kind, "accepted");
    await rack.end(); await settle();
    assert.equal(records.get(slot)[time], 456);
    assert.deepEqual(events.filter(event => event.endpoint.startsWith("lane")).map(event => event.endpoint), ["laneSlotParamValue", "laneSlotParamValue"], "a scalar drag retains the incremental DSP path");
    const editedArticulation = { ...articulation.read(), activeTriggerMode: "vel" };
    assert.equal((await articulation.set(editedArticulation)).kind, "accepted");
    await accepted({ kind: "edit", key: "globalTune", value: 7 });
    await accepted({ kind: "undo" }); assert.equal(state().fields.globalTune.value, 0);
    await accepted({ kind: "undo" }); assert.notEqual(articulation.read().activeTriggerMode, "vel");
    const historyBeforeAutomation = structuredClone(state().history);
    parameters.set("laneDelay1OutputTrimDb", -12); host.observeParameter("laneDelay1OutputTrimDb");
    await until(() => state().fields.laneDelay1OutputTrimDb.value === -12); await settle();
    assert.deepEqual(state().history, historyBeforeAutomation, "host automation neither appends nor clears history");
    assert.equal(records.get(slot)[trim], -12);
    await accepted({ kind: "undo" }); await settle();
    assert.equal(records.get(slot)[time], original, "one Undo restores the whole rack drag in the engine");
    assert.equal(records.get(slot)[trim], -12, "rack Undo cannot overwrite automated trim");
    assert.deepEqual(rack.read(), initial);
    await accepted({ kind: "redo" }); await settle(); assert.equal(records.get(slot)[time], 456);
    await accepted({ kind: "redo" }); assert.equal(articulation.read().activeTriggerMode, "vel");
    await accepted({ kind: "redo" }); assert.equal(state().fields.globalTune.value, 7);
    const beforeQueued = rack.read();
    rack.begin();
    const first = rack.set(api.setLaneDeviceParam(rack.read(), "delay#1", "delayTime", 234));
    const second = rack.set(api.setLaneDeviceParam(rack.read(), "delay#1", "delayFeedback", 0.6));
    assert.deepEqual((await Promise.all([first, second])).map(result => result.kind), ["accepted", "accepted"],
        "the second queued drag update retains its own accepted predecessor");
    await rack.end(); await settle();
    assert.equal(records.get(slot)[time], 234);
    assert.equal(records.get(slot)[api.getLaneSlotParamIndex("delay", "delayFeedback")], 0.6);
    await accepted({ kind: "undo" }); await settle(); assert.deepEqual(rack.read(), beforeQueued);

    events.length = 0;
    assert.equal((await rack.setWithParameters(api.setLaneDeviceEnabled(rack.read(), "delay#1", true), { laneDelay1OutputTrimDb: 0 })).kind, "accepted");
    await settle();
    assert.ok(events.some(event => event.endpoint === "laneTopology"), "a structural edit reaches the topology receiver");
    assert.equal(records.get(slot)[trim], 0);
    await accepted({ kind: "undo" }); await settle();
    assert.deepEqual(rack.read(), beforeQueued);
    assert.equal(records.get(slot)[trim], -12, "one Undo restores both topology and its explicit trim reset");
    const document = state().scope.document;
    host.replaceStoredValue("lane.v1", () => stored.set("lane.v1", JSON.stringify(initial)));
    await until(() => state()?.scope.document > document); await settle();
    assert.deepEqual(state().history, { canUndo: false, canRedo: false }, "full native restore starts a new document history");
    assert.equal(records.get(slot)[time], original);
});
