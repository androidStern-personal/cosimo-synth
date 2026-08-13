import test from "node:test";
import assert from "node:assert/strict";

import runWavetableWorker, {
    WAVETABLE_RUNTIME_STATE_SYNC_SERIAL,
    createWavetableWorkerController,
} from "../patch_gui/wavetable-worker.js";
import {
    MODULATION_STATE_KEY,
    createDefaultRoute,
    createDefaultModulationState,
    serializeModulationState,
} from "../patch_gui/modulation.js";
import {
    MODULATION_SOURCE_IDENTITIES,
    VOICE_MODULATION_TARGET_IDENTITIES,
} from "../patch_gui/modulation-targets.js";

const samplesPerFrame = 2048;
const failurePhaseLoadSource = 1;
const failurePhaseBuildMip = 2;
const failurePhaseTransferMip = 3;
const failureReasonGeneric = 1;
const failureReasonTimeout = 2;

function createSineFrame(phaseOffset = 0) {
    return Float32Array.from({ length: samplesPerFrame }, (_, index) =>
        Math.sin(((2 * Math.PI) * index) / samplesPerFrame + phaseOffset)
    );
}

function createAudioFileFromFrames(frames) {
    const flattened = [];

    frames.forEach((frame) => {
        for (const sample of frame) {
            flattened.push([sample]);
        }
    });

    return {
        sampleRate: 44100,
        frames: flattened,
    };
}

function createFloat32WaveBufferFromFrames(frames, sampleRate = 44100) {
    const flattened = new Float32Array(frames.length * samplesPerFrame);

    frames.forEach((frame, frameIndex) => {
        flattened.set(frame, frameIndex * samplesPerFrame);
    });

    const bytesPerSample = 4;
    const dataSize = flattened.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const encoder = new TextEncoder();

    bytes.set(encoder.encode("RIFF"), 0);
    view.setUint32(4, 36 + dataSize, true);
    bytes.set(encoder.encode("WAVE"), 8);
    bytes.set(encoder.encode("fmt "), 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 32, true);
    bytes.set(encoder.encode("data"), 36);
    view.setUint32(40, dataSize, true);

    for (let index = 0; index < flattened.length; index += 1) {
        view.setFloat32(44 + (index * bytesPerSample), flattened[index], true);
    }

    return buffer;
}

function createRuntimeState(overrides = {}) {
    return {
        dspSessionId: 7,
        desiredIntentSerial: 3,
        desiredTableIndex: 0,
        generationFrontier: 0,
        serviceState: 0,
        hasActive: false,
        activeTableIndex: 0,
        activeGeneration: 0,
        hasLoading: false,
        loadingTableIndex: 0,
        loadingGeneration: 0,
        hasFailure: false,
        failedTableIndex: 0,
        failedGeneration: 0,
        failureScope: 0,
        failurePhase: 0,
        failureReasonCode: 0,
        ...overrides,
    };
}

async function flushMicrotasks(turns = 8) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

class FakeTimeoutHarness {
    constructor() {
        this.nextHandle = 1;
        this.pending = new Map();
    }

    setTimeout(callback, delay) {
        const handle = this.nextHandle;
        this.nextHandle += 1;
        this.pending.set(handle, { callback, delay });
        return handle;
    }

    clearTimeout(handle) {
        this.pending.delete(handle);
    }

    fireNext() {
        const [handle, entry] = this.pending.entries().next().value ?? [];
        if (!entry) {
            return false;
        }

        this.pending.delete(handle);
        entry.callback();
        return true;
    }
}

class FakePatchConnection {
    constructor({
        catalog,
        audioFiles,
        maxAutoAckFrames = Infinity,
        resourceRootUrl = null,
    }) {
        this.catalog = catalog;
        this.audioFiles = new Map(Object.entries(audioFiles));
        this.maxAutoAckFrames = maxAutoAckFrames;
        this.resourceRootUrl = resourceRootUrl ? new URL(resourceRootUrl) : null;
        this.parameterListeners = new Map();
        this.endpointListeners = new Map();
        this.requestedParameters = [];
        this.readResourcePaths = [];
        this.readAudioPaths = [];
        this.sentEvents = [];
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? [];
        listeners.push(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    requestParameterValue(endpointID) {
        this.requestedParameters.push(endpointID);
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        listeners.push(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    async readResource(path) {
        this.readResourcePaths.push(path);

        if (path === "assets/factory-bank-catalog.json") {
            return JSON.stringify(this.catalog);
        }

        throw new Error(`Unexpected resource path: ${path}`);
    }

    async readResourceAsAudioData(path) {
        this.readAudioPaths.push(path);
        const audioFile = this.audioFiles.get(path);

        if (!audioFile) {
            throw new Error(`Unexpected audio resource path: ${path}`);
        }

        return audioFile;
    }

    getResourceAddress(path) {
        if (!this.resourceRootUrl) {
            return undefined;
        }

        return new URL(path, this.resourceRootUrl);
    }

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });

        if (
            endpointID === "wavetableMipFrame" &&
            value.frameIndex < this.maxAutoAckFrames
        ) {
            queueMicrotask(() => {
                this.emitEndpoint("wavetableUploadAck", {
                    dspSessionId: value.dspSessionId,
                    generation: value.generation,
                    tableIndex: value.tableIndex,
                    mipIndex: value.mipIndex,
                    frameIndex: value.frameIndex,
                });
            });
        }
    }

    emitEndpoint(endpointID, payload) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        listeners.forEach((listener) => listener(payload));
    }
}

class FakeWorkerPatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.endpointListeners = new Map();
        this.storedStateListeners = new Set();
        this.sentEvents = [];
        this.sentTimeouts = [];
        this.storedWrites = [];
        this.acceptedModulationSerial = 0;
        this.acceptedArticulationSerial = 0;
        this.rejectionsRemainingByEndpoint = new Map();
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        listeners.push(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        this.endpointListeners.set(
            endpointID,
            listeners.filter((candidate) => candidate !== listener),
        );
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ ...this.storedState });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }

    rejectNext(endpointID, count = 1) {
        this.rejectionsRemainingByEndpoint.set(endpointID, Math.max(0, Math.trunc(count)));
    }

    emitStoredStateValue(key, value) {
        this.storedState[key] = value;
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    sendEventOrValue(endpointID, value, _rampFrames, timeoutMilliseconds) {
        this.sentEvents.push({ endpointID, value });
        this.sentTimeouts.push({ endpointID, timeoutMilliseconds });

        if (endpointID === "runtimeSyncRequest") {
            queueMicrotask(() => {
                this.emitEndpoint("runtimeState", {
                    dspSessionId: 0,
                });
                this.emitRuntimeInstallAck(value);
            });
            return;
        }

        const deliverySerial = Math.trunc(Number(value?.deliverySerial) || 0);
        const rejectionsRemaining = this.rejectionsRemainingByEndpoint.get(endpointID) ?? 0;
        if (deliverySerial > 0 && rejectionsRemaining > 0) {
            assert.equal(deliverySerial, this.acceptedModulationSerial + 1);
            this.rejectionsRemainingByEndpoint.set(endpointID, rejectionsRemaining - 1);
            queueMicrotask(() => this.emitEndpoint("runtimeInstallAck", {
                dspSessionId: 0,
                acceptedModulationSerial: this.acceptedModulationSerial,
                acceptedArticulationSerial: this.acceptedArticulationSerial,
                rejectedSerial: deliverySerial,
                rejectionReason: 3,
                syncSerial: 0,
            }));
            return;
        }
        if (deliverySerial > 0) {
            assert.equal(deliverySerial, this.acceptedModulationSerial + 1);
            this.acceptedModulationSerial = deliverySerial;
            queueMicrotask(() => this.emitRuntimeInstallAck(0));
        } else if (deliverySerial < 0) {
            assert.equal(deliverySerial, this.acceptedArticulationSerial - 1);
            this.acceptedArticulationSerial = deliverySerial;
            queueMicrotask(() => this.emitRuntimeInstallAck(0));
        }
    }

    emitRuntimeInstallAck(syncSerial = 0) {
        this.emitEndpoint("runtimeInstallAck", {
            dspSessionId: 0,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: this.acceptedArticulationSerial,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial,
        });
    }

    emitEndpoint(endpointID, payload) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        listeners.forEach((listener) => listener(payload));
    }
}

function createDefaultCatalog() {
    return {
        tables: [
            {
                tableId: "table-0",
                name: "Table 0",
                frameCount: 1,
                sourceWav: "assets/factory_sources/table-0.wav",
            },
            {
                tableId: "table-1",
                name: "Table 1",
                frameCount: 2,
                sourceWav: "assets/factory_sources/table-1.wav",
            },
            {
                tableId: "table-2",
                name: "Table 2",
                frameCount: 1,
                sourceWav: "assets/factory_sources/table-2.wav",
            },
        ],
    };
}

function createDefaultAudioFiles() {
    return {
        "assets/factory_sources/table-0.wav": createAudioFileFromFrames([createSineFrame(0)]),
        "assets/factory_sources/table-1.wav": createAudioFileFromFrames([
            createSineFrame(0),
            createSineFrame(Math.PI / 2),
        ]),
        "assets/factory_sources/table-2.wav": createAudioFileFromFrames([createSineFrame(Math.PI)]),
    };
}

async function withPatchedFetch(fakeFetch, callback) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch;

    try {
        return await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

test("headless worker restore installs 101 stored mappings without opening an editor", async () => {
    const modulationState = createDefaultModulationState();
    modulationState.routes = MODULATION_SOURCE_IDENTITIES
        .filter(({ group }) => group === "voice")
        .flatMap((source) => (
            VOICE_MODULATION_TARGET_IDENTITIES.map((target) => ({
                id: `${target.kind}::${source.id}`,
                enabled: true,
                sourceKind: source.sourceKind,
                sourceSlot: source.sourceSlot,
                polarity: "unipolar",
                targetKind: target.kind,
                amount: 0.5,
                reducer: "max",
            }))
        )).slice(0, 101);

    const connection = new FakeWorkerPatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(modulationState),
    });
    const host = await runWavetableWorker(connection, {
        logger: () => {},
        maxFramesInFlight: 1,
    });
    await flushMicrotasks(512);

    try {
        const programUpload = connection.sentEvents.find(({ endpointID }) => endpointID === "modulationProgram");

        assert.equal(programUpload.value.voiceRouteCount, 101);
        assert.equal(new Set(programUpload.value.voiceRouteCells.slice(0, 101)).size, 101);
        assert.deepEqual(programUpload.value.voiceRouteCells.slice(0, 4), [0, 1, 2, 3]);
        assert.equal(programUpload.value.voiceRouteAmounts[100], 0.5);
        assert.equal(programUpload.value.dspSessionId, 0);
        assert.ok(programUpload.value.deliverySerial > 0);
        assert.equal(connection.sentEvents.some(({ endpointID }) => endpointID === "runtimeSyncRequest"), true);
        assert.ok(
            connection.sentEvents.findIndex(({ endpointID }) => endpointID === "runtimeSyncRequest")
                < connection.sentEvents.findIndex(({ endpointID }) => endpointID === "modulationProgram"),
            "stored modulation waits for a DSP session and acknowledged frontier",
        );
        assert.equal(connection.sentTimeouts.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).every(({ timeoutMilliseconds }) => timeoutMilliseconds === 0), true);

        connection.emitEndpoint("modulationRejectedRouteCount", 1);
        connection.emitEndpoint("modulationRejectedRouteCount", 2);
        await flushMicrotasks(32);
        assert.equal(
            connection.sentEvents.filter(({ endpointID }) => endpointID === "modulationProgram").length,
            1,
            "the unscoped legacy diagnostic cannot drive session-unsafe retries",
        );
        assert.deepEqual(connection.storedWrites, []);
    } finally {
        await host.stop();
    }
});

test("headless worker rejects malformed modulation state without installing defaults or replacing the last valid program", async () => {
    const malformedConnection = new FakeWorkerPatchConnection({
        [MODULATION_STATE_KEY]: JSON.stringify({ format: "legacy", routes: [] }),
    });
    const malformedHost = await runWavetableWorker(malformedConnection, {
        logger: () => {},
        maxFramesInFlight: 1,
    });
    await flushMicrotasks(256);

    try {
        assert.equal(
            malformedConnection.sentEvents.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
            "invalid stored state must not become the default two-route program",
        );
    } finally {
        await malformedHost.stop();
    }

    const validState = createDefaultModulationState();
    validState.routes = [createDefaultRoute({
        id: "oscA.framePosition::mseg-1",
        amount: 0.25,
    })];
    const connection = new FakeWorkerPatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(validState),
    });
    const host = await runWavetableWorker(connection, {
        logger: () => {},
        maxFramesInFlight: 1,
    });
    await flushMicrotasks(256);

    try {
        const installedPrograms = () => connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        );
        assert.equal(installedPrograms().length, 1);
        assert.equal(installedPrograms()[0].value.voiceRouteCount, 1);

        const duplicateState = structuredClone(validState);
        duplicateState.routes.push({
            ...duplicateState.routes[0],
            id: "duplicate-cell",
        });
        connection.emitStoredStateValue(MODULATION_STATE_KEY, JSON.stringify(duplicateState));
        await flushMicrotasks(256);

        assert.equal(installedPrograms().length, 1, "invalid live state retains the installed program");
    } finally {
        await host.stop();
    }
});

test("a rejected modulation batch gets one guarded full-state recovery", async () => {
    const initialState = createDefaultModulationState();
    initialState.routes = [createDefaultRoute({
        id: "oscA.framePosition::mseg-1",
        amount: 0.25,
    })];
    const connection = new FakeWorkerPatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(initialState),
    });
    const originalConsoleError = console.error;
    console.error = () => {};
    const host = await runWavetableWorker(connection, {
        logger: () => {},
        maxFramesInFlight: 1,
    });
    await flushMicrotasks(512);

    try {
        const initialProgramCount = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).length;
        const nextState = structuredClone(initialState);
        nextState.msegSlots[0].shapeA.points[1].y = 0.75;
        nextState.routes[0].polarity = "bipolar";

        connection.rejectNext("modulationProgram");
        connection.emitStoredStateValue(MODULATION_STATE_KEY, serializeModulationState(nextState));
        await flushMicrotasks(512);

        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).length, initialProgramCount + 1, "the edited batch reaches its rejected program once");

        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await flushMicrotasks(1_024);

        const programs = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        );
        assert.equal(programs.length, initialProgramCount + 2, "one full replay repairs the accepted prefix");
        assert.equal(programs.at(-1).value.voiceRoutePolarities[0], 1);
        assert.equal(connection.rejectionsRemainingByEndpoint.get("modulationProgram"), 0);
    } finally {
        await host.stop();
        console.error = originalConsoleError;
    }
});

test("a repeatedly rejected modulation image does not enter a recovery loop", async () => {
    const initialState = createDefaultModulationState();
    initialState.routes = [createDefaultRoute({
        id: "oscA.framePosition::mseg-1",
        amount: 0.25,
    })];
    const connection = new FakeWorkerPatchConnection({
        [MODULATION_STATE_KEY]: serializeModulationState(initialState),
    });
    const originalConsoleError = console.error;
    console.error = () => {};
    const host = await runWavetableWorker(connection, {
        logger: () => {},
        maxFramesInFlight: 1,
    });
    await flushMicrotasks(512);

    try {
        const initialProgramCount = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).length;
        const nextState = structuredClone(initialState);
        nextState.routes[0].polarity = "bipolar";

        connection.rejectNext("modulationProgram", 2);
        connection.emitStoredStateValue(MODULATION_STATE_KEY, serializeModulationState(nextState));
        await flushMicrotasks(512);
        await new Promise((resolve) => setTimeout(resolve, 2_200));
        await flushMicrotasks(1_024);

        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).length, initialProgramCount + 2, "the original rejection gets at most one full replay");
        assert.equal(connection.rejectionsRemainingByEndpoint.get("modulationProgram"), 0);

        const distinctState = structuredClone(nextState);
        distinctState.routes[0].id = "oscA.warpAmount::mseg-1";
        distinctState.routes[0].targetKind = "oscA.warpAmount";
        connection.rejectNext("modulationProgram");
        connection.emitStoredStateValue(MODULATION_STATE_KEY, serializeModulationState(distinctState));
        await flushMicrotasks(512);
        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        ).length, initialProgramCount + 3, "a distinct program gets its own first attempt");

        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await flushMicrotasks(1_024);

        const programs = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === "modulationProgram",
        );
        assert.equal(programs.length, initialProgramCount + 4, "a distinct rejection gets one full replay");
        assert.equal(programs.at(-1).value.voiceRouteCells[0], 1);
    } finally {
        await host.stop();
        console.error = originalConsoleError;
    }
});

test("worker bootstraps from runtimeState instead of requesting wavetableSelect directly", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    assert.deepEqual(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "runtimeSyncRequest").map(({ value }) => value),
        [WAVETABLE_RUNTIME_STATE_SYNC_SERIAL]
    );
    assert.deepEqual(connection.requestedParameters, []);

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 5,
            desiredTableIndex: 1,
            generationFrontier: 10,
            serviceState: 0,
        })
    );
    await flushMicrotasks(128);

    assert.deepEqual(connection.readResourcePaths, ["assets/factory-bank-catalog.json"]);
    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(
        loadBeginEvents.map(({ value }) => value),
        [
            {
                dspSessionId: 7,
                generation: 11,
                tableIndex: 1,
                frameCount: 2,
            },
        ]
    );
});

test("worker stages every mip frame for a selected table without waiting for lazy mip requests", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: Infinity,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        mipLevelCount: 3,
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 5,
            desiredTableIndex: 1,
            generationFrontier: 10,
            serviceState: 0,
        })
    );
    await flushMicrotasks(64);

    assert.equal(
        connection.sentEvents.some(({ endpointID }) => endpointID === "wavetableMipRequest"),
        false
    );

    const mipFrames = connection.sentEvents
        .filter(({ endpointID }) => endpointID === "wavetableMipFrame")
        .map(({ value }) => ({
            generation: value.generation,
            tableIndex: value.tableIndex,
            mipIndex: value.mipIndex,
            frameIndex: value.frameIndex,
        }))
        .sort((left, right) => (
            (left.mipIndex - right.mipIndex)
            || (left.frameIndex - right.frameIndex)
        ));

    assert.deepEqual(mipFrames, [
        { generation: 11, tableIndex: 1, mipIndex: 0, frameIndex: 0 },
        { generation: 11, tableIndex: 1, mipIndex: 0, frameIndex: 1 },
        { generation: 11, tableIndex: 1, mipIndex: 1, frameIndex: 0 },
        { generation: 11, tableIndex: 1, mipIndex: 1, frameIndex: 1 },
        { generation: 11, tableIndex: 1, mipIndex: 2, frameIndex: 0 },
        { generation: 11, tableIndex: 1, mipIndex: 2, frameIndex: 1 },
    ]);
});

test("worker prewarms source and spectrum cache without committing a DSP load", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: Infinity,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        mipLevelCount: 3,
        cacheBudgetBytes: 8 * 1024 * 1024,
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint("wavetablePrewarmNotification", 1);
    await flushMicrotasks(64);

    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);
    assert.equal(
        connection.sentEvents.some(({ endpointID }) => endpointID === "wavetableLoadBegin"),
        false
    );
    assert.equal(
        connection.sentEvents.some(({ endpointID }) => endpointID === "wavetableMipFrame"),
        false
    );

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 6,
            desiredTableIndex: 1,
            generationFrontier: 20,
            serviceState: 0,
        })
    );
    await flushMicrotasks(64);

    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin").length,
        1
    );
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableMipFrame").length,
        6
    );
});

test("worker lets rapid adjacent prewarms complete instead of cancelling the earlier table", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: Infinity,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        mipLevelCount: 3,
        cacheBudgetBytes: 8 * 1024 * 1024,
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint("wavetablePrewarmNotification", 1);
    connection.emitEndpoint("wavetablePrewarmNotification", 2);
    await flushMicrotasks(128);

    assert.deepEqual(connection.readAudioPaths, [
        "assets/factory_sources/table-1.wav",
        "assets/factory_sources/table-2.wav",
    ]);
    assert.equal(
        connection.sentEvents.some(({ endpointID }) => endpointID === "wavetableLoadBegin"),
        false
    );
    assert.equal(
        connection.sentEvents.some(({ endpointID }) => endpointID === "wavetableMipFrame"),
        false
    );

    const originalGetSpectrumForFrame = controller.getSpectrumForFrame.bind(controller);
    let spectrumMissesForPrewarmedTable = 0;
    controller.getSpectrumForFrame = (frameIndex) => {
        if (!controller.serviceTable?.spectra?.[frameIndex]) {
            spectrumMissesForPrewarmedTable += 1;
        }
        return originalGetSpectrumForFrame(frameIndex);
    };

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 7,
            desiredTableIndex: 1,
            generationFrontier: 30,
            serviceState: 0,
        })
    );
    await flushMicrotasks(128);

    assert.deepEqual(connection.readAudioPaths, [
        "assets/factory_sources/table-1.wav",
        "assets/factory_sources/table-2.wav",
    ]);
    assert.equal(spectrumMissesForPrewarmedTable, 0);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableMipFrame").length,
        6
    );
});

test("worker can load wavetable resources through an injected resource client even when patch connection resource helpers are absent", async () => {
    const catalog = createDefaultCatalog();
    const audioFiles = createDefaultAudioFiles();
    const connection = new FakePatchConnection({
        catalog,
        audioFiles: {},
        maxAutoAckFrames: 0,
    });
    const resourceClientReadJSONPaths = [];
    const resourceClientReadAudioPaths = [];
    connection.readResource = undefined;
    connection.readResourceAsAudioData = undefined;
    connection.getResourceAddress = undefined;

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        resourceClient: {
            async readJSON(path) {
                resourceClientReadJSONPaths.push(path);
                assert.equal(path, "assets/factory-bank-catalog.json");
                return catalog;
            },
            async readAudio(path) {
                resourceClientReadAudioPaths.push(path);
                assert.equal(path, "assets/factory_sources/table-1.wav");
                return {
                    sampleRate: 44100,
                    samples: Float32Array.from(
                        audioFiles["assets/factory_sources/table-1.wav"].frames,
                        (frame) => frame[0]
                    ),
                };
            },
        },
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 5,
            desiredTableIndex: 1,
            generationFrontier: 10,
            serviceState: 0,
        })
    );
    await flushMicrotasks(128);

    assert.deepEqual(resourceClientReadJSONPaths, ["assets/factory-bank-catalog.json"]);
    assert.deepEqual(resourceClientReadAudioPaths, ["assets/factory_sources/table-1.wav"]);
    assert.deepEqual(connection.readResourcePaths, []);
    assert.deepEqual(connection.readAudioPaths, []);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(loadBeginEvents.map(({ value }) => value), [
        {
            dspSessionId: 7,
            generation: 11,
            tableIndex: 1,
            frameCount: 2,
        },
    ]);
});

test("worker prefers the resolved resource URL for factory wavetable source paths when both loader paths are available", async () => {
    const spacedPath = "assets/factory_sources/imported/BS2 - Acid.wav";
    const catalog = {
        tables: [
            {
                tableId: "bs2-acid",
                name: "BS2 - Acid",
                frameCount: 2,
                sourceWav: spacedPath,
            },
        ],
    };
    const connection = new FakePatchConnection({
        catalog,
        audioFiles: {},
        maxAutoAckFrames: 0,
        resourceRootUrl: "https://example.test/bundle/",
    });
    const waveBuffer = createFloat32WaveBufferFromFrames([
        createSineFrame(0),
        createSineFrame(Math.PI / 2),
    ]);
    const fetchedUrls = [];

    await withPatchedFetch(async (url) => {
        fetchedUrls.push(String(url));

        return {
            ok: true,
            async arrayBuffer() {
                return waveBuffer;
            },
        };
    }, async () => {
        const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
        await controller.start();
        await flushMicrotasks();

        connection.emitEndpoint(
            "runtimeState",
            createRuntimeState({
                desiredIntentSerial: 5,
                desiredTableIndex: 0,
                generationFrontier: 10,
                serviceState: 0,
            })
        );
        await flushMicrotasks(16);
    });

    assert.deepEqual(connection.readAudioPaths, []);
    assert.deepEqual(fetchedUrls, [
        "https://example.test/bundle/assets/factory_sources/imported/BS2%20-%20Acid.wav",
    ]);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(loadBeginEvents.map(({ value }) => value), [
        {
            dspSessionId: 7,
            generation: 11,
            tableIndex: 0,
            frameCount: 2,
        },
    ]);
});

test("worker falls back to the resolved resource URL for spaced wavetable paths when no audio-data bridge is available", async () => {
    const spacedPath = "assets/factory_sources/BS2 - Acid.wav";
    const catalog = {
        tables: [
            {
                tableId: "bs2-acid",
                name: "BS2 - Acid",
                frameCount: 2,
                sourceWav: spacedPath,
            },
        ],
    };
    const waveBuffer = createFloat32WaveBufferFromFrames([
        createSineFrame(0),
        createSineFrame(Math.PI / 2),
    ]);
    const fetchedUrls = [];
    const connection = new FakePatchConnection({
        catalog,
        audioFiles: {},
        maxAutoAckFrames: 0,
        resourceRootUrl: "https://example.test/bundle/",
    });
    connection.readResourceAsAudioData = undefined;

    await withPatchedFetch(async (url) => {
        fetchedUrls.push(String(url));

        return {
            ok: true,
            async arrayBuffer() {
                return waveBuffer;
            },
        };
    }, async () => {
        const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
        await controller.start();
        await flushMicrotasks();

        connection.emitEndpoint(
            "runtimeState",
            createRuntimeState({
                desiredIntentSerial: 5,
                desiredTableIndex: 0,
                generationFrontier: 10,
                serviceState: 0,
            })
        );
        await flushMicrotasks(16);
    });

    assert.deepEqual(connection.readAudioPaths, []);
    assert.deepEqual(fetchedUrls, [
        "https://example.test/bundle/assets/factory_sources/BS2%20-%20Acid.wav",
    ]);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(loadBeginEvents.map(({ value }) => value), [
        {
            dspSessionId: 7,
            generation: 11,
            tableIndex: 0,
            frameCount: 2,
        },
    ]);
});

test("worker reconstructs the current loading generation and continues full staging upload", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 2,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(128);

    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin").length,
        0
    );

    const mipFrames = connection.sentEvents
        .filter(({ endpointID }) => endpointID === "wavetableMipFrame")
        .map(({ value }) => ({
            dspSessionId: value.dspSessionId,
            generation: value.generation,
            tableIndex: value.tableIndex,
            mipIndex: value.mipIndex,
            frameIndex: value.frameIndex,
        }))
        .sort((left, right) => (
            (left.mipIndex - right.mipIndex)
            || (left.frameIndex - right.frameIndex)
        ));

    assert.equal(mipFrames.length, 22);
    assert.deepEqual(
        mipFrames,
        Array.from({ length: 11 }, (_, mipIndex) => ([
            { dspSessionId: 7, generation: 12, tableIndex: 1, mipIndex, frameIndex: 0 },
            { dspSessionId: 7, generation: 12, tableIndex: 1, mipIndex, frameIndex: 1 },
        ])).flat()
    );
});

test("worker reconstructs the current active generation without re-uploading loaded mips", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 2,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 11,
            desiredTableIndex: 2,
            generationFrontier: 14,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 1,
            activeGeneration: 14,
        })
    );
    await flushMicrotasks(16);

    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin").length,
        0
    );

    const mipFrames = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableMipFrame");
    assert.deepEqual(mipFrames, []);
});

test("worker does not auto-retry an unchanged failed desired table until runtimeState advances the desired attempt", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 4,
            desiredTableIndex: 2,
            generationFrontier: 12,
            serviceState: 0,
            hasFailure: true,
            failedTableIndex: 2,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 2,
            failureReasonCode: 99,
        })
    );
    await flushMicrotasks(64);

    assert.deepEqual(connection.readAudioPaths, []);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin").length,
        0
    );

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 5,
            desiredTableIndex: 2,
            generationFrontier: 12,
            serviceState: 0,
            hasFailure: false,
        })
    );
    await flushMicrotasks(64);

    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-2.wav"]);
    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(loadBeginEvents.at(-1)?.value, {
        dspSessionId: 7,
        generation: 13,
        tableIndex: 2,
        frameCount: 1,
    });
});

test("worker aborts an obsolete loading generation when the desired table changes mid-load", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(64);

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 10,
            desiredTableIndex: 2,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(16);

    const abortEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "serviceLoadAbort");
    const failureEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "workerLoadFailure");

    assert.deepEqual(abortEvents.at(-1)?.value, {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        failureReasonCode: failureReasonGeneric,
    });
    assert.equal(failureEvents.length, 0);
});

test("worker validates and commits a newer desired table while another table is still active", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 3,
            desiredTableIndex: 0,
            generationFrontier: 9,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 9,
        })
    );
    await flushMicrotasks(64);

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 4,
            desiredTableIndex: 2,
            generationFrontier: 9,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 9,
        })
    );
    await flushMicrotasks(16);

    assert.deepEqual(connection.readAudioPaths, [
        "assets/factory_sources/table-0.wav",
        "assets/factory_sources/table-2.wav",
    ]);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(
        loadBeginEvents.map(({ value }) => value),
        [
            {
                dspSessionId: 7,
                generation: 10,
                tableIndex: 2,
                frameCount: 1,
            },
        ]
    );
});

test("worker reports a candidate load failure without emitting a new load begin", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: {
            "assets/factory_sources/table-0.wav": createAudioFileFromFrames([createSineFrame(0)]),
            "assets/factory_sources/table-1.wav": createAudioFileFromFrames([
                createSineFrame(0),
                createSineFrame(Math.PI / 2),
            ]),
        },
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 6,
            desiredTableIndex: 2,
            generationFrontier: 11,
            serviceState: 0,
            hasFailure: false,
        })
    );
    await flushMicrotasks(16);

    const failureEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "workerLoadFailure");
    assert.deepEqual(failureEvents.map(({ value }) => value), [
        {
            dspSessionId: 7,
            tableIndex: 2,
            generation: 0,
            candidateAttemptSerial: 6,
            failurePhase: failurePhaseLoadSource,
            failureReasonCode: failureReasonGeneric,
        },
    ]);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin").length,
        0
    );
});

test("worker aborts a loading generation when the committed service table cannot be reloaded", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: {
            "assets/factory_sources/table-0.wav": createAudioFileFromFrames([createSineFrame(0)]),
            "assets/factory_sources/table-2.wav": createAudioFileFromFrames([createSineFrame(Math.PI)]),
        },
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(16);

    const failureEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "workerLoadFailure");
    const abortEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "serviceLoadAbort");

    assert.deepEqual(failureEvents.at(-1)?.value, {
        dspSessionId: 7,
        tableIndex: 1,
        generation: 12,
        candidateAttemptSerial: 0,
        failurePhase: failurePhaseLoadSource,
        failureReasonCode: failureReasonGeneric,
    });
    assert.deepEqual(abortEvents.at(-1)?.value, {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        failureReasonCode: failureReasonGeneric,
    });
});

test("worker classifies mip-build failures separately from source-load failures", async () => {
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    controller.getSpectrumForFrame = () => {
        throw new Error("boom");
    };

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(64);

    const failureEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "workerLoadFailure");
    const abortEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "serviceLoadAbort");

    assert.deepEqual(failureEvents.at(-1)?.value, {
        dspSessionId: 7,
        tableIndex: 1,
        generation: 12,
        candidateAttemptSerial: 0,
        failurePhase: failurePhaseBuildMip,
        failureReasonCode: failureReasonGeneric,
    });
    assert.deepEqual(abortEvents.at(-1)?.value, {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        failureReasonCode: failureReasonGeneric,
    });
});

test("worker aborts a committed loading generation when mip upload acks stall past the watchdog timeout", async () => {
    const timeoutHarness = new FakeTimeoutHarness();
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        serviceLoadTimeoutMs: 5,
        setTimeoutFn: timeoutHarness.setTimeout.bind(timeoutHarness),
        clearTimeoutFn: timeoutHarness.clearTimeout.bind(timeoutHarness),
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(16);

    connection.emitEndpoint("wavetableMipRequest", {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        mipIndex: 0,
        urgencyLevel: 2,
    });
    await flushMicrotasks(16);

    assert.equal(timeoutHarness.pending.size, 1);
    assert.equal(timeoutHarness.fireNext(), true);
    await flushMicrotasks(16);

    const failureEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "workerLoadFailure");
    const abortEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "serviceLoadAbort");

    assert.deepEqual(failureEvents.at(-1)?.value, {
        dspSessionId: 7,
        tableIndex: 1,
        generation: 12,
        candidateAttemptSerial: 0,
        failurePhase: failurePhaseTransferMip,
        failureReasonCode: failureReasonTimeout,
    });
    assert.deepEqual(abortEvents.at(-1)?.value, {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        failureReasonCode: failureReasonTimeout,
    });
});

test("worker uses the declared 20 second watchdog timeout when no explicit timeout is provided", async () => {
    const timeoutHarness = new FakeTimeoutHarness();
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        setTimeoutFn: timeoutHarness.setTimeout.bind(timeoutHarness),
        clearTimeoutFn: timeoutHarness.clearTimeout.bind(timeoutHarness),
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(16);

    connection.emitEndpoint("wavetableMipRequest", {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        mipIndex: 0,
        urgencyLevel: 2,
    });
    await flushMicrotasks(16);

    assert.equal(timeoutHarness.pending.size, 1);
    const [, scheduledTimeout] = timeoutHarness.pending.entries().next().value;
    assert.equal(scheduledTimeout.delay, 20000);
});

test("worker automatically retries one timed-out desired table load when runtime state reports the timeout failure", async () => {
    const timeoutHarness = new FakeTimeoutHarness();
    const connection = new FakePatchConnection({
        catalog: createDefaultCatalog(),
        audioFiles: createDefaultAudioFiles(),
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, {
        maxFramesInFlight: 1,
        serviceLoadTimeoutMs: 5,
        setTimeoutFn: timeoutHarness.setTimeout.bind(timeoutHarness),
        clearTimeoutFn: timeoutHarness.clearTimeout.bind(timeoutHarness),
    });
    await controller.start();
    await flushMicrotasks();

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 1,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 12,
        })
    );
    await flushMicrotasks(16);

    connection.emitEndpoint("wavetableMipRequest", {
        dspSessionId: 7,
        generation: 12,
        tableIndex: 1,
        mipIndex: 0,
        urgencyLevel: 2,
    });
    await flushMicrotasks(16);

    assert.equal(timeoutHarness.fireNext(), true);
    await flushMicrotasks(16);

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 0,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 12,
            failureScope: 1,
            failurePhase: failurePhaseTransferMip,
            failureReasonCode: failureReasonTimeout,
        })
    );
    await flushMicrotasks(16);

    const retryEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "retryDesiredTableRequest");
    assert.deepEqual(retryEvents.map(({ value }) => value), [1]);

    connection.emitEndpoint(
        "runtimeState",
        createRuntimeState({
            desiredIntentSerial: 9,
            desiredTableIndex: 1,
            generationFrontier: 12,
            serviceState: 0,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 12,
            failureScope: 1,
            failurePhase: failurePhaseTransferMip,
            failureReasonCode: failureReasonTimeout,
        })
    );
    await flushMicrotasks(16);

    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === "retryDesiredTableRequest").length,
        1
    );
});
