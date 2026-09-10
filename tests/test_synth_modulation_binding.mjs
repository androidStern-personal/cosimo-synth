import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = Promise.all([
    loadUIModule(repoRoot, "ui/worker/synth-modulation-binding.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
    loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
]);

async function flushWork() {
    await new Promise(resolve => setImmediate(resolve));
}

// A recording adapter at the real binding publisher/endpoint seams. It models
// the DSP frontier protocol; this test does not claim native or audio execution.
class ScopedRuntime {
    endpointListeners = new Map();
    storedListeners = new Set();
    bootRequests = [];
    publications = [];
    rawSends = [];
    storedWrites = [];
    statuses = [];
    defects = [];
    protocolFailures = [];
    statusWaiters = new Set();
    rejectNextEndpoint;
    refuseEndpoint;
    nativeRefuseEndpoint;
    uncertainHandoffEndpoint;
    rejections = [];
    installedBuffers = new Map();
    holdInputEndpoint;
    heldInputAcks = [];
    holdHostReceipts = false;
    heldHostReceipts = [];
    hostCompletionError;
    respondRuntimeToSync = false;
    modulationSerial = 0;
    articulationSerial = 0;
    dspSessionId = 41;

    addEndpointListener(endpoint, listener) {
        const listeners = this.endpointListeners.get(endpoint) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpoint, listeners);
    }
    removeEndpointListener(endpoint, listener) { this.endpointListeners.get(endpoint)?.delete(listener); }
    addStoredStateValueListener(listener) { this.storedListeners.add(listener); }
    removeStoredStateValueListener(listener) { this.storedListeners.delete(listener); }
    requestFullStoredState(callback) { this.bootRequests.push(callback); }
    sendEventOrValue(endpoint, value) { this.rawSends.push({ endpoint, value }); }
    sendNativeArticulationTriggerConfig(value) { this.rawSends.push({ hostEffect: value }); }
    sendStoredStateValue(key, value) { this.storedWrites.push({ key, value }); }
    emitEndpoint(endpoint, value) {
        for (const listener of this.endpointListeners.get(endpoint) ?? []) listener(value);
    }
    emitStoredState(key, value) {
        for (const listener of this.storedListeners) listener({ key, value });
    }
    acknowledge(syncSerial = 0, rejectedSerial = 0) {
        this.emitEndpoint("runtimeInstallAck", {
            dspSessionId: this.dspSessionId,
            acceptedModulationSerial: this.modulationSerial,
            acceptedArticulationSerial: this.articulationSerial,
            rejectedSerial,
            rejectionReason: rejectedSerial === 0 ? 0 : 2,
            syncSerial,
        });
    }
    publish = (scope, effect) => {
        this.publications.push({ scope: structuredClone(scope), effect: structuredClone(effect) });
        if (effect.kind === "event") {
            if (effect.endpoint === this.uncertainHandoffEndpoint) {
                this.uncertainHandoffEndpoint = undefined;
                return { kind: "failed", error: { kind: "transport", message: "The runtime handoff could not be confirmed." } };
            }
            if (effect.endpoint === this.refuseEndpoint) return { kind: "failed", error: { kind: "engine-rejected", message: "Invalid declared runtime payload." } };
            if (effect.endpoint === this.nativeRefuseEndpoint) return { kind: "submitted", completion: Promise.resolve({ kind: "failed", error: { kind: "transport", message: "Native runtime publication refused." } }) };
            if (effect.endpoint === "runtimeSyncRequest") {
                if (this.respondRuntimeToSync) queueMicrotask(() => this.emitEndpoint("runtimeState", { dspSessionId: this.dspSessionId }));
                queueMicrotask(() => this.acknowledge(effect.value));
            } else {
                const serial = effect.value.deliverySerial;
                if (effect.endpoint === this.rejectNextEndpoint) {
                    this.rejectNextEndpoint = undefined;
                    this.rejections.push({ endpoint: effect.endpoint, serial });
                    queueMicrotask(() => this.acknowledge(0, serial));
                    return { kind: "submitted", completion: Promise.resolve({ kind: "sent", proof: "native-publication-processed" }) };
                }
                if (effect.endpoint === "articulationSnapshot") {
                    if (serial !== this.articulationSerial - 1) this.protocolFailures.push({ expected: this.articulationSerial - 1, serial });
                    this.articulationSerial = serial;
                } else {
                    if (serial !== this.modulationSerial + 1) this.protocolFailures.push({ expected: this.modulationSerial + 1, serial });
                    this.modulationSerial = serial;
                }
                if (effect.endpoint === "modulationMsegBuffer") this.installedBuffers.set(`${effect.value.slot}:${effect.value.shapeIndex}`, effect.value.buffer);
                if (effect.endpoint === this.holdInputEndpoint) this.heldInputAcks.push(() => this.acknowledge());
                else queueMicrotask(() => this.acknowledge());
            }
        }
        if (effect.kind === "host-effect" && this.hostCompletionError) return { kind: "submitted", completion: Promise.reject(this.hostCompletionError) };
        if (effect.kind === "host-effect" && this.holdHostReceipts) return { kind: "submitted", completion: new Promise(resolve => this.heldHostReceipts.push(resolve)) };
        return { kind: "submitted", completion: Promise.resolve({ kind: "sent", proof: "native-publication-processed" }) };
    };
    bindingContext() {
        return {
            publish: this.publish,
            onStatus: (target, status) => {
                this.statuses.push({ target, status });
                for (const waiter of this.statusWaiters) waiter({ target, status });
            },
            onDefect: error => this.defects.push(error),
        };
    }
    waitForStatus(predicate) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.statusWaiters.delete(receive);
                reject(new Error("Timed out waiting for public delivery status"));
            }, 1500);
            const receive = value => {
                if (!predicate(value)) return;
                clearTimeout(timeout);
                this.statusWaiters.delete(receive);
                resolve(value);
            };
            this.statusWaiters.add(receive);
            for (const value of this.statuses) receive(value);
        });
    }
}

test("framework modulation waits for articulation hydration and uses only document-scoped runtime publication", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    const state = modulation.createDefaultModulationState();
    state.msegSlots[0].shapeA.points[0].y = 0.13;
    state.msegSlots[0].shapeA.points.at(-1).y = 0.81;
    const parsed = modulation.parseModulationState(modulation.serializeModulationState(state));
    assert.equal(parsed._tag, "ok");
    const target = { scope: { owner: "worker-a", document: 7 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: parsed.value, parameters: {} }, target);
        await flushWork();
        assert.deepEqual(runtime.publications, [], "no delivery before coherent hydration");
        assert.equal(runtime.bootRequests.length, 1, "articulation hydration starts from the actual connection");
        runtime.bootRequests.shift()({ values: {
            [modulation.MODULATION_STATE_KEY]: "malformed native modulation must not override accepted input",
            [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState(),
        } });
        await flushWork();
        assert.deepEqual(runtime.publications, [{ scope: target.scope, effect: { kind: "event", endpoint: "runtimeSyncRequest", value: 0 } }], "only discovery may be sent before the runtime session is known");
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await runtime.waitForStatus(({ status }) => status.kind === "sent");

        const uploaded = runtime.publications.filter(({ effect }) => effect.kind === "event" && effect.endpoint !== "runtimeSyncRequest");
        assert.deepEqual(uploaded.map(({ effect }) => {
            const { dspSessionId, deliverySerial, ...value } = effect.value;
            assert.equal(dspSessionId, runtime.dspSessionId);
            assert.ok(deliverySerial > 0);
            return { endpointID: effect.endpoint, value };
        }), modulation.buildModulationRuntimeEvents(parsed.value, null));
        assert.ok(uploaded.length > 0);
        assert.ok(runtime.publications.every(({ scope }) => JSON.stringify(scope) === JSON.stringify(target.scope)));
        assert.equal(runtime.publications.at(-1).effect.kind, "host-effect");
        assert.equal(runtime.publications.at(-1).effect.name, "cosimo.articulation-trigger-config");
        assert.deepEqual(runtime.statuses.at(-1), { target, status: { kind: "sent", proof: "native-publication-processed" } });
        assert.deepEqual(runtime.rawSends, []);
        assert.deepEqual(runtime.storedWrites, []);
        assert.deepEqual(runtime.defects, []);
        assert.deepEqual(runtime.protocolFailures, []);
    } finally { await binding.stop(); }
});

test("modulation, dependent articulation and the final host receipt remain serialized across newer desired input", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    const route = modulation.createDefaultRoute({ id: "frame-route", sourceKind: "mseg", sourceSlot: 1, targetKind: "oscB.wavetablePosition", amount: 0.1 });
    const stateA = { ...modulation.createDefaultModulationState(), routes: [route] };
    const stateB = structuredClone(stateA);
    stateB.msegSlots[0].shapeA.points[0].y = 0.27;
    const bank = warp => ({ format: "cosimo.articulations", version: 4, selectedSlotId: "slot-5", activeTriggerMode: "key", slots: [{
        id: "slot-5", runtimeSlot: 5, name: "Slot 5", color: "#d2a128", key: 36,
        velRange: { min: 1, max: 127 }, chainRange: { min: 0, max: 127 },
        overrides: { "oscA.warpAmount": warp }, routeAmounts: { [route.id]: 0.4 },
    }] });
    const scope = { owner: "worker-ordered", document: 1 };
    const target = generation => ({ scope, key: modulation.MODULATION_STATE_KEY, generation });
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    runtime.holdInputEndpoint = "modulationMsegBuffer";
    runtime.holdHostReceipts = true;
    try {
        binding.replace({ value: stateA, parameters: {} }, target(1));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: bank(0.2) } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await flushWork();
        assert.equal(runtime.heldInputAcks.length, 1, "a modulation packet has physically reached the receiver");
        assert.equal(runtime.publications.some(({ effect }) => effect.endpoint === "articulationSnapshot"), false);
        assert.equal(runtime.heldHostReceipts.length, 0);

        runtime.holdInputEndpoint = undefined;
        runtime.heldInputAcks.shift()();
        await flushWork();
        assert.equal(runtime.publications.filter(({ effect }) => effect.endpoint === "articulationSnapshot").length, 1);
        assert.equal(runtime.heldHostReceipts.length, 1, "the final native publication is still pending");
        assert.equal(runtime.statuses.some(({ status }) => status.kind === "sent"), false);
        const count = runtime.publications.length;

        binding.replace({ value: stateB, parameters: {} }, target(2));
        runtime.emitStoredState(articulations.ARTICULATIONS_V4_STATE_KEY, bank(0.8));
        await flushWork();
        assert.equal(runtime.publications.length, count, "new modulation cannot overtake the preceding articulation/host phase");
        runtime.holdHostReceipts = false;
        runtime.heldHostReceipts.shift()({ kind: "sent", proof: "native-publication-processed" });
        await runtime.waitForStatus(({ target, status }) => target.generation === 2 && status.kind === "sent");
        const uploads = runtime.publications.filter(({ effect }) => effect.endpoint === "articulationSnapshot");
        assert.equal(uploads.length, 2);
        assert.equal(uploads.at(-1).effect.value.warpAmounts[0], 0.8);
        assert.deepEqual(runtime.statuses.filter(({ status }) => status.kind === "sent").map(({ target }) => target.generation), [1, 2]);
        assert.deepEqual(runtime.protocolFailures, []);
        assert.deepEqual(runtime.rawSends, []);
    } finally { await binding.stop(); }
});

test("a rejected partial bank invalidates the delta baseline before Undo restores the prior bank", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    const stateA = modulation.createDefaultModulationState();
    const stateB = modulation.createDefaultModulationState();
    stateB.msegSlots[0].shapeA.points[0].y = 0.23;
    stateB.msegSlots[0].playback.holdFinalValue = !stateA.msegSlots[0].playback.holdFinalValue;
    const scope = { owner: "worker-partial", document: 1 };
    const target = generation => ({ scope, key: modulation.MODULATION_STATE_KEY, generation });
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: stateA, parameters: {} }, target(1));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await runtime.waitForStatus(({ target, status }) => target.generation === 1 && status.kind === "sent");
        const bankA = runtime.installedBuffers.get("1:0");
        runtime.rejectNextEndpoint = "modulationMsegPlayback";
        binding.replace({ value: stateB, parameters: {} }, target(2));
        await flushWork();
        assert.equal(runtime.rejections.length, 1, "the later playback packet was actually refused");
        assert.notDeepEqual(runtime.installedBuffers.get("1:0"), bankA, "the earlier B curve packet already reached the receiver");

        // The same public replacement path receives the framework's Undo value.
        binding.replace({ value: stateA, parameters: {} }, target(3));
        await runtime.waitForStatus(({ target, status }) => target.generation === 3 && status.kind === "sent");
        assert.deepEqual(runtime.installedBuffers.get("1:0"), bankA);
        assert.deepEqual(runtime.protocolFailures, []);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("a definite publication refusal fails the target instead of retrying it as a dropped DSP input", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    runtime.refuseEndpoint = "modulationMsegBuffer";
    const target = { scope: { owner: "worker-refused", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target);
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        const failed = await runtime.waitForStatus(({ status }) => status.kind === "failed");
        assert.deepEqual(failed, { target, status: { kind: "failed", error: { kind: "engine-rejected", message: "Invalid declared runtime payload." } } });
        const count = runtime.publications.length;
        runtime.acknowledge();
        await flushWork();
        assert.equal(runtime.publications.length, count, "late output cannot revive the refused delivery");
        assert.equal(runtime.publications.filter(({ effect }) => effect.endpoint === "modulationMsegBuffer").length, 1);
        assert.equal(runtime.publications.some(({ effect }) => effect.kind === "host-effect"), false);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("cancelled document work cannot finish or corrupt a reopened document through late host receipts and ACKs", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    const stateA = modulation.createDefaultModulationState();
    const stateB = structuredClone(stateA);
    stateB.msegSlots[0].shapeA.points[0].y = 0.32;
    const stateC = structuredClone(stateB);
    stateC.msegSlots[0].shapeA.points[0].y = 0.64;
    const target = (document, generation) => ({ scope: { owner: "worker-cancel", document }, key: modulation.MODULATION_STATE_KEY, generation });
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    runtime.holdHostReceipts = true;
    try {
        binding.replace({ value: stateA, parameters: {} }, target(1, 1));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await flushWork();
        assert.equal(runtime.heldHostReceipts.length, 1);
        const lateAck = { dspSessionId: runtime.dspSessionId, acceptedModulationSerial: runtime.modulationSerial,
            acceptedArticulationSerial: runtime.articulationSerial, rejectedSerial: 0, rejectionReason: 0, syncSerial: 0 };
        binding.cancel();
        assert.equal(runtime.storedListeners.size, 0);
        assert.ok([...runtime.endpointListeners.values()].every(listeners => listeners.size === 0));

        runtime.holdHostReceipts = false;
        binding.replace({ value: stateB, parameters: {} }, target(2, 1));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await runtime.waitForStatus(({ target, status }) => target.scope.document === 2 && status.kind === "sent");
        const currentFrontier = runtime.modulationSerial;
        const count = runtime.publications.length;
        runtime.heldHostReceipts.shift()({ kind: "sent", proof: "native-publication-processed" });
        runtime.emitEndpoint("runtimeInstallAck", lateAck);
        await flushWork();
        assert.equal(runtime.publications.length, count);
        assert.equal(runtime.statuses.some(({ target, status }) => target.scope.document === 1 && status.kind === "sent"), false);

        binding.replace({ value: stateC, parameters: {} }, target(2, 2));
        await runtime.waitForStatus(({ target, status }) => target.scope.document === 2 && target.generation === 2 && status.kind === "sent");
        const nextPacket = runtime.publications.slice(count).find(({ effect }) => effect.endpoint === "modulationMsegBuffer");
        assert.equal(nextPacket.effect.value.deliverySerial, currentFrontier + 1, "late ACK cannot rewind the new document's physical frontier");
        assert.deepEqual(runtime.protocolFailures, []);
        assert.deepEqual(runtime.rawSends, []);
    } finally { await binding.stop(); }
});

test("native publication failure settles without a DSP ACK and a later edit can reopen delivery", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    runtime.nativeRefuseEndpoint = "modulationMsegBuffer";
    const scope = { owner: "worker-native-refusal", document: 1 };
    const target = generation => ({ scope, key: modulation.MODULATION_STATE_KEY, generation });
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target(1));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        const failure = await runtime.waitForStatus(({ status }) => status.kind === "failed");
        assert.deepEqual(failure, { target: target(1), status: { kind: "failed", error: { kind: "transport", message: "Native runtime publication refused." } } });
        assert.equal(runtime.installedBuffers.size, 0);
        assert.equal(runtime.publications.filter(({ effect }) => effect.endpoint === "modulationMsegBuffer").length, 1);

        runtime.nativeRefuseEndpoint = undefined;
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target(2));
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await runtime.waitForStatus(({ target, status }) => target.generation === 2 && status.kind === "sent");
        assert.equal(runtime.installedBuffers.size, 6);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("a current DSP rejection reports failed application for its captured target", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    runtime.rejectNextEndpoint = "modulationMsegBuffer";
    const target = { scope: { owner: "worker-dsp-refusal", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target);
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        const failed = await runtime.waitForStatus(({ status }) => status.kind === "failed");
        assert.deepEqual(failed.target, target);
        assert.equal(failed.status.error.kind, "engine-rejected");
        assert.match(failed.status.error.message, /modulation/i);
        assert.equal(runtime.publications.some(({ effect }) => effect.kind === "host-effect"), false);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("a newly attached binding queries the real runtime endpoint instead of requiring another startup announcement", async () => {
    const [bindingModule, modulation, articulations] = await modules;
    const runtime = new ScopedRuntime();
    runtime.respondRuntimeToSync = true;
    runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
    const target = { scope: { owner: "worker-late-start", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target);
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        await runtime.waitForStatus(({ status }) => status.kind === "sent");
        assert.deepEqual(runtime.publications[0], { scope: target.scope, effect: { kind: "event", endpoint: "runtimeSyncRequest", value: 0 } });
        assert.equal(runtime.installedBuffers.size, 6);
        assert.deepEqual(runtime.rawSends, []);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("a reentrant status observer may stop the binding before it starts boot work", async () => {
    const [bindingModule, modulation] = await modules;
    const runtime = new ScopedRuntime();
    const context = runtime.bindingContext();
    let stopping;
    let binding;
    binding = bindingModule.createSynthModulationBinding(runtime).create({ ...context,
        onStatus(target, status) {
            context.onStatus(target, status);
            if (status.kind === "preparing") stopping = binding.stop();
        },
    });
    const target = { scope: { owner: "worker-reentrant", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    try {
        assert.doesNotThrow(() => binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target));
        await stopping;
        assert.deepEqual(runtime.bootRequests, []);
        assert.deepEqual(runtime.publications, []);
        assert.equal(runtime.storedListeners.size, 0);
        assert.ok([...runtime.endpointListeners.values()].every(listeners => listeners.size === 0));
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, { ...target, generation: 2 });
        assert.deepEqual(runtime.bootRequests, []);
    } finally { await binding.stop(); }
});

test("runtime discovery recovers from an uncertain first handoff through the existing recovery timer", async t => {
    const [bindingModule, modulation, articulations] = await modules;
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const runtime = new ScopedRuntime();
    runtime.respondRuntimeToSync = true;
    runtime.uncertainHandoffEndpoint = "runtimeSyncRequest";
    const target = { scope: { owner: "worker-discovery-loss", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target);
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        await flushWork();
        assert.equal(runtime.publications.length, 1, "the first discovery attempt actually reached the external handoff seam");
        assert.equal(runtime.installedBuffers.size, 0);

        t.mock.timers.tick(1000);
        await flushWork();
        assert.deepEqual(runtime.statuses.at(-1), { target, status: { kind: "sent", proof: "native-publication-processed" } });
        assert.deepEqual(runtime.publications.slice(0, 2), Array.from({ length: 2 }, () => ({ scope: target.scope, effect: { kind: "event", endpoint: "runtimeSyncRequest", value: 0 } })));
        assert.equal(runtime.installedBuffers.size, 6, "the retried real query unlocked the actual lane sends");
        assert.deepEqual(runtime.protocolFailures, []);
        assert.deepEqual(runtime.rawSends, []);
        assert.deepEqual(runtime.defects, []);
    } finally { await binding.stop(); }
});

test("an unexpected final host completion rejection closes delivery and preserves the original defect", async t => {
    const [bindingModule, modulation, articulations] = await modules;
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const runtime = new ScopedRuntime();
    const defect = new Error("Unexpected native receipt decoder defect");
    runtime.hostCompletionError = defect;
    const target = { scope: { owner: "worker-host-defect", document: 1 }, key: modulation.MODULATION_STATE_KEY, generation: 1 };
    const binding = bindingModule.createSynthModulationBinding(runtime).create(runtime.bindingContext());
    try {
        binding.replace({ value: modulation.createDefaultModulationState(), parameters: {} }, target);
        runtime.bootRequests.shift()({ values: { [articulations.ARTICULATIONS_V4_STATE_KEY]: articulations.createEmptyArticulationsState() } });
        runtime.emitEndpoint("runtimeState", { dspSessionId: runtime.dspSessionId });
        await flushWork();
        assert.equal(runtime.publications.filter(({ effect }) => effect.kind === "host-effect").length, 1, "both lanes completed before the actual final host submission rejected");
        assert.equal(runtime.defects.length, 1);
        assert.equal(runtime.defects[0], defect, "the framework diagnoses the original error rather than a transport-failure substitute");
        assert.equal(runtime.statuses.some(({ status }) => status.kind === "sent"), false);
        assert.equal(runtime.storedListeners.size, 0);
        assert.ok([...runtime.endpointListeners.values()].every(listeners => listeners.size === 0));
        const count = runtime.publications.length;
        t.mock.timers.tick(1000);
        await flushWork();
        assert.equal(runtime.publications.length, count, "a programming defect does not start a recovery loop");
        assert.equal(runtime.defects.length, 1);
    } finally { await binding.stop(); }
});
