import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulesPromise = Promise.all([
    loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
    loadUIModule(repoRoot, "ui/worker/modulation-articulation-worker-service.ts"),
    loadUIModule(repoRoot, "ui/shared/articulations.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
]);

async function modules() {
    const [image, worker, runtime, modulation, program] = await modulesPromise;
    return { image, worker, runtime, modulation, program };
}

async function flushMicrotasks(turns = 128) {
    for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

async function waitFor(predicate, description) {
    for (let attempt = 0; attempt < 128; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.fail(`Timed out waiting for ${description}`);
}

function makeSlot(overrides = {}, routeAmounts = {}) {
    return {
        id: "slot-5",
        runtimeSlot: 5,
        name: "Slot 5",
        color: "#d2a128",
        key: 36,
        velRange: { min: 1, max: 127 },
        chainRange: { min: 0, max: 127 },
        overrides,
        routeAmounts,
    };
}

function makeBank(slot = makeSlot()) {
    return {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: slot.id,
        activeTriggerMode: "key",
        slots: [slot],
    };
}

class TestConnection {
    constructor(fullStoredState = {}) {
        this.fullStoredState = fullStoredState;
        this.storedStateListeners = new Set();
        this.endpointListeners = new Map();
        this.sentEvents = [];
        this.storedWrites = [];
        this.requestedKeys = [];
        this.dspSessionId = 0;
        this.acceptedModulationSerial = 0;
        this.acceptedArticulationSerial = 0;
        this.holdModulationAcknowledgements = false;
        this.pendingModulationSerial = null;
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback(this.fullStoredState);
    }

    requestStoredStateValue(key) {
        this.requestedKeys.push(key);
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });
        if (endpointID === "runtimeSyncRequest") {
            queueMicrotask(() => this.emitAck(value));
            return;
        }
        const deliverySerial = Math.trunc(Number(value?.deliverySerial) || 0);
        if (deliverySerial > 0) {
            assert.equal(deliverySerial, this.acceptedModulationSerial + 1);
            if (this.holdModulationAcknowledgements) {
                this.pendingModulationSerial = deliverySerial;
                return;
            }
            this.acceptedModulationSerial = deliverySerial;
            queueMicrotask(() => this.emitAck(0));
            return;
        }
        if (deliverySerial < 0) {
            assert.equal(deliverySerial, this.acceptedArticulationSerial - 1);
            this.acceptedArticulationSerial = deliverySerial;
            queueMicrotask(() => this.emitAck(0));
        }
    }

    emitStoredState(key, value) {
        this.storedStateListeners.forEach((listener) => listener({ key, value }));
    }

    acceptPendingModulation() {
        assert.notEqual(this.pendingModulationSerial, null);
        this.acceptedModulationSerial = this.pendingModulationSerial;
        this.pendingModulationSerial = null;
        this.emitAck(0);
    }

    emitRuntimeSession(dspSessionId) {
        if (dspSessionId !== this.dspSessionId) {
            this.dspSessionId = dspSessionId;
            this.acceptedModulationSerial = 0;
            this.acceptedArticulationSerial = 0;
        }
        this.emitEndpoint("runtimeState", { dspSessionId });
    }

    emitAck(syncSerial) {
        this.emitEndpoint("runtimeInstallAck", {
            dspSessionId: this.dspSessionId,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: this.acceptedArticulationSerial,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial,
        });
    }

    emitEndpoint(endpointID, value) {
        this.endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    articulationUploads() {
        return this.sentEvents.filter(({ endpointID }) => endpointID === "articulationSnapshot");
    }
}

async function validDependencies() {
    const { modulation } = await modules();
    const route = modulation.createDefaultRoute({
        id: "oscB.framePosition::mseg-1",
        sourceKind: "mseg",
        sourceSlot: 1,
        targetKind: "oscB.wavetablePosition",
        amount: 0.1,
    });
    return {
        route,
        modulationState: {
            ...modulation.createDefaultModulationState(),
            routes: [route],
        },
    };
}

test("valid restore acknowledges modulation before publishing dependent articulation", async () => {
    const { worker, modulation, program } = await modules();
    const dependencies = await validDependencies();
    const bank = makeBank(makeSlot({
        "oscA.warpAmount": 0.2,
        "oscB.warpAmount": 0.4,
        "oscC.warpAmount": 0.6,
    }, {
        [dependencies.route.id]: 0.66,
    }));
    const connection = new TestConnection({
        values: {
            "articulations.v4": bank,
            "modulation.v5": modulation.serializeModulationState(dependencies.modulationState),
        },
    });
    const service = worker.createModulationArticulationWorkerService(connection);
    service.start();
    connection.emitRuntimeSession(41);
    await flushMicrotasks();

    const uploads = connection.articulationUploads();
    assert.equal(uploads.length, 1);
    const modulationIndex = connection.sentEvents.findIndex(({ endpointID }) => endpointID === "modulationProgram");
    const articulationIndex = connection.sentEvents.findIndex(({ endpointID }) => endpointID === "articulationSnapshot");
    assert.equal(modulationIndex >= 0, true);
    assert.equal(articulationIndex > modulationIndex, true);
    const upload = uploads[0].value;
    assert.deepEqual(upload.warpAmounts, [0.2, 0.4, 0.6]);
    assert.deepEqual(upload.oscillatorOverrideMasks, [4096, 4096, 4096]);
    assert.equal(upload.sharedOverrideMask, 0);
    const routeCell = program.getModulationRuntimeCell(dependencies.route).articulationCellIndex;
    assert.equal(upload.routeAmounts[routeCell], 0.66);
    assert.equal(connection.storedWrites.length, 0);
    service.stop();
});

test("articulation cannot publish while the matching modulation install is unaccepted", async () => {
    const { worker, modulation } = await modules();
    const dependencies = await validDependencies();
    const connection = new TestConnection({
        values: {
            "articulations.v4": makeBank(makeSlot({}, { [dependencies.route.id]: 0.4 })),
            [modulation.MODULATION_STATE_KEY]: modulation.serializeModulationState(
                dependencies.modulationState,
            ),
        },
    });
    connection.holdModulationAcknowledgements = true;
    const service = worker.createModulationArticulationWorkerService(connection);

    try {
        service.start();
        connection.emitRuntimeSession(44);
        await waitFor(
            () => connection.sentEvents.some(({ value }) => Number(value?.deliverySerial) > 0),
            "the held modulation upload",
        );
        assert.equal(connection.articulationUploads().length, 0);

        connection.holdModulationAcknowledgements = false;
        connection.acceptPendingModulation();
        await waitFor(() => connection.articulationUploads().length === 1, "the dependent articulation upload");
    } finally {
        service.stop();
    }
});

test("separate-key restore waits for modulation and v4 articulation only", async () => {
    const { worker, modulation } = await modules();
    const dependencies = await validDependencies();
    const bank = makeBank(makeSlot({}, { [dependencies.route.id]: 0.75 }));
    const connection = new TestConnection();
    connection.requestFullStoredState = undefined;
    const service = worker.createModulationArticulationWorkerService(connection);
    service.start();
    connection.emitRuntimeSession(51);

    connection.emitStoredState("articulations.v4", bank);
    await flushMicrotasks();
    assert.equal(connection.articulationUploads().length, 0);

    connection.emitStoredState(
        "modulation.v5",
        modulation.serializeModulationState(dependencies.modulationState),
    );
    await flushMicrotasks();
    assert.equal(connection.articulationUploads().length, 1);
    assert.deepEqual(connection.requestedKeys.sort(), [
        "articulations.v4",
        "modulation.v5",
    ]);
    service.stop();
});

test("cold invalid v4 defaults without reading or rewriting a legacy bank", async () => {
    const { worker, modulation } = await modules();
    const dependencies = await validDependencies();
    const invalidCurrentValues = [
        "{not-json",
        { ...makeBank(), version: 3 },
        { ...makeBank(), version: 5 },
        { ...makeBank(), slots: [{ ...makeSlot(), overrides: { "oscA.warpAmount": Number.NaN } }] },
    ];
    const originalError = console.error;
    console.error = () => {};
    try {
        for (let index = 0; index < invalidCurrentValues.length; index += 1) {
            const connection = new TestConnection({
                values: {
                    "articulations.v4": invalidCurrentValues[index],
                    "articulations.v3": { ...makeBank(), version: 3 },
                    "modulation.v5": modulation.serializeModulationState(dependencies.modulationState),
                },
            });
            const service = worker.createModulationArticulationWorkerService(connection);
            service.start();
            connection.emitRuntimeSession(60 + index);
            await flushMicrotasks();
            assert.equal(connection.articulationUploads().length, 0);
            assert.equal(connection.storedWrites.length, 0);
            service.stop();
        }
    } finally {
        console.error = originalError;
    }
});

test("live invalid v4 and legacy writes retain the last accepted bank atomically", async () => {
    const { worker, modulation } = await modules();
    const dependencies = await validDependencies();
    const acceptedBank = makeBank(makeSlot({
        "oscA.warpAmount": 0.2,
        "oscB.warpAmount": 0.4,
        "oscC.warpAmount": 0.6,
    }, { [dependencies.route.id]: 0.5 }));
    const connection = new TestConnection({
        values: {
            "articulations.v4": acceptedBank,
            "modulation.v5": modulation.serializeModulationState(dependencies.modulationState),
        },
    });
    const service = worker.createModulationArticulationWorkerService(connection);
    const originalError = console.error;
    console.error = () => {};
    try {
        service.start();
        connection.emitRuntimeSession(71);
        await flushMicrotasks();
        assert.deepEqual(connection.articulationUploads().at(-1).value.warpAmounts, [0.2, 0.4, 0.6]);
        connection.sentEvents = [];

        const invalidWrites = [
            "{not-json",
            { ...acceptedBank, version: 3 },
            { ...acceptedBank, version: 5 },
            {
                ...acceptedBank,
                slots: [{ ...acceptedBank.slots[0], routeAmounts: { "unknown-route": 0.25 } }],
            },
        ];
        for (const value of invalidWrites) {
            connection.emitStoredState("articulations.v4", value);
        }
        connection.emitStoredState("articulations.v3", { ...acceptedBank, version: 3 });
        await flushMicrotasks();
        assert.equal(connection.articulationUploads().length, 0);
        assert.equal(connection.storedWrites.length, 0);

        connection.emitRuntimeSession(72);
        await flushMicrotasks();
        assert.equal(connection.articulationUploads().length, 1);
        assert.deepEqual(connection.articulationUploads()[0].value.warpAmounts, [0.2, 0.4, 0.6]);
    } finally {
        console.error = originalError;
        service.stop();
    }
});
