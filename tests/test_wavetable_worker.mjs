import test from "node:test";
import assert from "node:assert/strict";

import { createWavetableWorkerController } from "../patch_gui/wavetable-worker.mjs";

const samplesPerFrame = 2048;

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

async function flushMicrotasks(turns = 8) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

class FakePatchConnection {
    constructor({
        catalog,
        audioFiles,
        initialTableIndex = 0,
        maxAutoAckFrames = Infinity,
    }) {
        this.catalog = catalog;
        this.audioFiles = new Map(Object.entries(audioFiles));
        this.initialTableIndex = initialTableIndex;
        this.maxAutoAckFrames = maxAutoAckFrames;
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
        queueMicrotask(() => {
            const listeners = this.parameterListeners.get(endpointID) ?? [];
            listeners.forEach((listener) => listener(this.initialTableIndex));
        });
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

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });

        if (
            endpointID === "wavetableMipFrame" &&
            value.generation === 1 &&
            value.frameIndex < this.maxAutoAckFrames
        ) {
            queueMicrotask(() => {
                this.emitEndpoint("wavetableUploadAck", {
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

    emitParameter(endpointID, value) {
        const listeners = this.parameterListeners.get(endpointID) ?? [];
        listeners.forEach((listener) => listener(value));
    }
}

test("worker loads the selected table and drains a requested mip with UploadAck credit", async () => {
    const frameA = createSineFrame(0);
    const frameB = createSineFrame(Math.PI / 2);
    const connection = new FakePatchConnection({
        catalog: {
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
            ],
        },
        audioFiles: {
            "assets/factory_sources/table-0.wav": createAudioFileFromFrames([frameA]),
            "assets/factory_sources/table-1.wav": createAudioFileFromFrames([frameA, frameB]),
        },
        initialTableIndex: 1,
        maxAutoAckFrames: 2,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    assert.deepEqual(connection.requestedParameters, ["wavetableSelect"]);
    assert.deepEqual(connection.readResourcePaths, ["assets/factory-bank-catalog.json"]);
    assert.deepEqual(connection.readAudioPaths, ["assets/factory_sources/table-1.wav"]);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.equal(loadBeginEvents.length, 1);
    assert.deepEqual(loadBeginEvents[0].value, {
        generation: 1,
        tableIndex: 1,
        frameCount: 2,
    });

    connection.emitEndpoint("wavetableMipRequest", {
        generation: 1,
        tableIndex: 1,
        mipIndex: 0,
    });
    await flushMicrotasks(16);

    const mipFrames = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableMipFrame");
    assert.equal(mipFrames.length, 2);
    assert.deepEqual(
        mipFrames.map(({ value }) => ({
            generation: value.generation,
            tableIndex: value.tableIndex,
            mipIndex: value.mipIndex,
            frameIndex: value.frameIndex,
            sampleCount: value.samples.length,
        })),
        [
            { generation: 1, tableIndex: 1, mipIndex: 0, frameIndex: 0, sampleCount: samplesPerFrame },
            { generation: 1, tableIndex: 1, mipIndex: 0, frameIndex: 1, sampleCount: samplesPerFrame },
        ]
    );

    assert.ok(Math.abs(mipFrames[0].value.samples[0]) < 1e-6);
    assert.ok(Math.abs(mipFrames[0].value.samples[512] - 1.0) < 1e-4);
    assert.ok(Math.abs(mipFrames[1].value.samples[0] - 1.0) < 1e-4);
    assert.ok(Math.abs(mipFrames[1].value.samples[512]) < 1e-4);
});

test("worker ignores stale mip requests after the selected table changes generation", async () => {
    const connection = new FakePatchConnection({
        catalog: {
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
                    frameCount: 1,
                    sourceWav: "assets/factory_sources/table-1.wav",
                },
            ],
        },
        audioFiles: {
            "assets/factory_sources/table-0.wav": createAudioFileFromFrames([createSineFrame(0)]),
            "assets/factory_sources/table-1.wav": createAudioFileFromFrames([createSineFrame(Math.PI / 2)]),
        },
        initialTableIndex: 1,
        maxAutoAckFrames: 0,
    });

    const controller = createWavetableWorkerController(connection, { maxFramesInFlight: 1 });
    await controller.start();
    await flushMicrotasks();

    connection.emitParameter("wavetableSelect", 0);
    await flushMicrotasks();

    connection.emitEndpoint("wavetableMipRequest", {
        generation: 1,
        tableIndex: 1,
        mipIndex: 0,
    });
    await flushMicrotasks();

    const mipFrames = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableMipFrame");
    assert.equal(mipFrames.length, 0);

    const loadBeginEvents = connection.sentEvents.filter(({ endpointID }) => endpointID === "wavetableLoadBegin");
    assert.deepEqual(
        loadBeginEvents.map(({ value }) => value),
        [
            { generation: 1, tableIndex: 1, frameCount: 1 },
            { generation: 2, tableIndex: 0, frameCount: 1 },
        ]
    );
});

