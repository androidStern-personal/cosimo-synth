import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { loadUIModule } from "./helpers/load_ui_module.mjs";
import { loadChannel } from "./helpers/modulation_state_fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");

async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "actual state channel delivery did not settle");
        await new Promise(resolve => setImmediate(resolve));
    }
}

test("the actual state channel permits an amount-only modulation delta and processes its final host effect", async () => {
    const [{ createMockPluginStateHost },
        { createCmajorPluginStateClient }, { synthPluginState }, modulation] = await Promise.all([
        loadUIModule(root, "ui/shared/mock-plugin-state-host.ts"),
        loadUIModule(root, "kit/ui/plugin-state-cmajor.ts"),
        loadUIModule(root, "ui/shared/synth-plugin-state.ts"),
        loadUIModule(root, "ui/shared/modulation.ts"),
    ]);
    const key = modulation.MODULATION_STATE_KEY;
    const bank = modulation.createDefaultModulationState();
    bank.routes = [modulation.createDefaultRoute({ id: "channel-route", sourceKind: "env", sourceSlot: 1,
        targetKind: "oscA.pan", amount: 0.25 })];
    const stored = new Map([[key, JSON.stringify(bank)]]);
    const listeners = new Map(), events = [], prepared = [], hostEffects = [], writes = [], defects = [], protocolFailures = [];
    const dspSessionId = 73;
    let modulationSerial = 0;
    const emit = (endpoint, value) => { for (const listener of [...(listeners.get(endpoint) ?? [])]) listener(value); };
    const acknowledge = syncSerial => emit("runtimeInstallAck", { dspSessionId,
        acceptedModulationSerial: modulationSerial, acceptedArticulationSerial: 0,
        syncSerial, rejectedSerial: 0, rejectionReason: 0 });
    const runtimeConnection = {
        addEndpointListener(endpoint, listener) {
            const group = listeners.get(endpoint) ?? new Set(); group.add(listener); listeners.set(endpoint, group);
        },
        removeEndpointListener(endpoint, listener) { listeners.get(endpoint)?.delete(listener); },
        addStoredStateValueListener() {}, removeStoredStateValueListener() {},
        requestFullStoredState(callback) { queueMicrotask(() => callback({ values: Object.fromEntries(stored) })); },
    };
    // Only the native endpoint/DSP-frontier boundary is modeled. The production
    // service, public declared delivery and actual Cmajor channel enforce declarations,
    // accept state, publish native writes and correlate the final receipt.
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter: async endpoint => ({ endpoint, value: 0, min: endpoint === "globalTune" ? -24 : 0,
            max: endpoint === "globalTune" ? 24 : 2, step: endpoint === "playMode" ? 1 : 0, defaultValue: 0 }),
        writeParameter(endpoint, value) { protocolFailures.push({ unexpectedParameter: endpoint, value }); },
        beginGesture() {}, endGesture() {}, onDefect: error => defects.push(error),
        storedValues: { read: key => stored.get(key), write(key, value) { stored.set(key, value); writes.push({ key, value }); } },
        engine: {
            resources: runtimeConnection,
            installSharedData(input, destination) {
                const words = new Int32Array(destination.buffer, destination.byteOffset, 4);
                assert.equal(words[0], 0x4d534547); assert.equal(words[1], dspSessionId);
                assert.equal(words[2], modulationSerial + 1);
                assert.equal(destination.byteLength, (words[3] + 4) * 4);
                const samples = Array.from(new Float32Array(destination.buffer, destination.byteOffset + 16, words[3]));
                prepared.push({ input, samples });
                modulationSerial = words[2]; queueMicrotask(() => acknowledge(0));
            },
            sendEvent(endpoint, value) {
                events.push({ endpoint, value: structuredClone(value) });
                if (endpoint === "runtimeSyncRequest") {
                    queueMicrotask(() => { emit("runtimeState", { dspSessionId }); acknowledge(value); });
                    return;
                }
                if (value.dspSessionId !== dspSessionId || value.deliverySerial !== modulationSerial + 1)
                    protocolFailures.push({ endpoint, expectedSerial: modulationSerial + 1, value });
                modulationSerial = value.deliverySerial;
                queueMicrotask(() => acknowledge(0));
            },
            handleHostEffect(name, value) { hostEffects.push({ name, value }); return true; },
        },
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: error => defects.push(error) });
    const field = () => client.getSnapshot().kind === "ready" ? client.getSnapshot().state.fields[key] : undefined;
    try {
        await host.ready;
        await until(() => {
            assert.notEqual(field()?.application?.kind, "failed", JSON.stringify(field()?.application));
            assert.deepEqual(defects, []);
            return field()?.application?.kind === "sent";
        });
        assert.deepEqual(field().value, bank);
        assert.equal(events.filter(event => event.endpoint === "modulationMsegBuffer").length, 0);
        assert.deepEqual(prepared.map(resource => resource.input), [3, 4, 5, 6, 7, 8]);
        const expectedCurves = modulation.buildModulationRuntimeEvents(bank, null).filter(event => event.endpointID === "modulationMsegBuffer");
        assert.deepEqual(prepared.map(resource => resource.samples), expectedCurves.map(event => event.value.buffer));
        const program = events.find(event => event.endpoint === "modulationProgram").value;
        assert.equal(program.voiceRouteCount, 1);
        assert.equal(program.voiceRouteAmounts[program.voiceRouteCells[0]], 0.25);
        assert.equal(hostEffects.length, 1);
        assert.deepEqual(writes, [], "native boot is not an editable-state write");
        const before = events.length;
        const oldGeneration = field().target.generation;
        const next = { ...bank, routes: [{ ...bank.routes[0], amount: 0.75 }] };
        const accepted = await client.dispatch({ kind: "edit", key, value: next });
        assert.equal(accepted.kind, "accepted");
        assert.equal(accepted.changed, true);
        await until(() => field()?.target?.generation > oldGeneration
            && ["sent", "failed"].includes(field()?.application?.kind));
        assert.deepEqual(field().application, { kind: "sent", proof: "native-publication-processed" },
            "amount-only state acceptance must reach the declared native endpoint and final host receipt");
        const delta = events.slice(before).filter(event => event.endpoint !== "runtimeSyncRequest");
        assert.equal(prepared.length, 6, "an amount edit must not prepare another curve");
        assert.equal(delta.length, 1, "an amount edit must not resend buffers, playback or the full program");
        assert.deepEqual(delta[0], { endpoint: "modulationAmount", value: {
            pathKind: 1, cellIndex: program.voiceRouteCells[0], amount: 0.75,
            dspSessionId, deliverySerial: modulationSerial,
        } });
        assert.deepEqual(writes, [{ key, value: JSON.stringify(next) }]);
        assert.equal(hostEffects.length, 2);
        assert.ok(hostEffects.every(effect => effect.name === "cosimo.articulation-trigger-config" && typeof effect.value === "string"));
        assert.equal(client.getSnapshot().state.history.canUndo, true);
        assert.deepEqual(protocolFailures, []);
        assert.deepEqual(defects, []);
    } finally { client.stop(); await host.stop(); }
});
