import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
    parseWaveFile,
    getFactoryBankCatalogValue,
    loadFactoryBankCatalog,
    loadFactoryBankFrames,
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
} from "../patch_gui/wavetable-bank.mjs";
import { createIOSResourceClient } from "../patch_gui/resource-client.js";
import {
    DEFAULT_WAVETABLE_THEME,
    createFrameState,
    decimateFrame,
    buildWavetableStaticScene,
    buildWavetableRenderModel,
    drawWavetableModel,
    CanvasWavetableDisplay,
} from "../patch_gui/wavetable-display.mjs";
import { DEFAULT_PATCH_THEME, getPatchThemeCSSVariables } from "../patch_gui/theme.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function withPatchedFetch(fakeFetch, callback) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch;

    try {
        return await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

function harmonicCentroid(frame, maxHarmonic = 32) {
    const sampleCount = frame.length;
    let weightedTotal = 0;
    let magnitudeTotal = 0;

    for (let harmonic = 1; harmonic <= maxHarmonic; harmonic += 1) {
        let real = 0;
        let imaginary = 0;

        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
            const angle = (-2 * Math.PI * harmonic * sampleIndex) / sampleCount;
            real += frame[sampleIndex] * Math.cos(angle);
            imaginary += frame[sampleIndex] * Math.sin(angle);
        }

        const magnitude = Math.hypot(real, imaginary);
        weightedTotal += magnitude * harmonic;
        magnitudeTotal += magnitude;
    }

    return weightedTotal / magnitudeTotal;
}

function meanAbsoluteDifference(left, right) {
    let total = 0;

    for (let sampleIndex = 0; sampleIndex < left.length; sampleIndex += 1) {
        total += Math.abs(left[sampleIndex] - right[sampleIndex]);
    }

    return total / left.length;
}

function findLargestJumpIndex(samples) {
    let largestJump = -1;
    let largestJumpIndex = -1;

    for (let index = 0; index < samples.length - 1; index += 1) {
        const jump = Math.abs(samples[index + 1] - samples[index]);

        if (jump > largestJump) {
            largestJump = jump;
            largestJumpIndex = index;
        }
    }

    return largestJumpIndex;
}

function createSimpleFrames(frameValues) {
    return frameValues.map((values) => Float32Array.from(values));
}

class FakeGradient {
    constructor() {
        this.stops = [];
    }

    addColorStop(offset, color) {
        this.stops.push({ offset, color });
    }
}

class FakeContext {
    constructor() {
        this.commands = [];
        this.strokeStyle = "";
        this.fillStyle = "";
        this.lineWidth = 1;
        this.font = "";
        this.textAlign = "left";
        this.shadowBlur = 0;
        this.shadowColor = "";
        this.currentPath = [];
    }

    createLinearGradient() {
        return new FakeGradient();
    }

    setTransform(...args) {
        this.commands.push({ type: "setTransform", args });
    }

    clearRect(...args) {
        this.commands.push({ type: "clearRect", args });
    }

    fillRect(...args) {
        this.commands.push({ type: "fillRect", args, fillStyle: this.fillStyle });
    }

    strokeRect(...args) {
        this.commands.push({
            type: "strokeRect",
            args,
            strokeStyle: this.strokeStyle,
            lineWidth: this.lineWidth,
        });
    }

    save() {
        this.commands.push({ type: "save" });
    }

    restore() {
        this.commands.push({ type: "restore" });
    }

    beginPath() {
        this.currentPath = [];
    }

    moveTo(x, y) {
        this.currentPath.push({ type: "moveTo", x, y });
    }

    lineTo(x, y) {
        this.currentPath.push({ type: "lineTo", x, y });
    }

    closePath() {
        this.currentPath.push({ type: "closePath" });
    }

    stroke() {
        this.commands.push({
            type: "stroke",
            strokeStyle: this.strokeStyle,
            lineWidth: this.lineWidth,
            shadowBlur: this.shadowBlur,
            shadowColor: this.shadowColor,
            path: this.currentPath.slice(),
        });
    }

    fill() {
        this.commands.push({
            type: "fill",
            fillStyle: this.fillStyle,
            path: this.currentPath.slice(),
        });
    }

    fillText(text, x, y) {
        this.commands.push({
            type: "fillText",
            text,
            x,
            y,
            fillStyle: this.fillStyle,
            font: this.font,
        });
    }
}

class FakeCanvas {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.clientWidth = 0;
        this.clientHeight = 0;
        this.style = {};
        this.context = new FakeContext();
    }

    getContext(kind) {
        assert.equal(kind, "2d");
        return this.context;
    }
}

function createAnimationFrameHarness() {
    let nextHandle = 1;
    const pendingCallbacks = new Map();

    return {
        requestAnimationFrame(callback) {
            const handle = nextHandle;
            nextHandle += 1;
            pendingCallbacks.set(handle, callback);
            return handle;
        },
        cancelAnimationFrame(handle) {
            pendingCallbacks.delete(handle);
        },
        flush(timestamp = 0) {
            const callbacks = Array.from(pendingCallbacks.values());
            pendingCallbacks.clear();

            callbacks.forEach((callback) => callback(timestamp));
        },
        get pendingCount() {
            return pendingCallbacks.size;
        },
    };
}

async function loadCurrentBank() {
    const manifest = JSON.parse(
        await fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8")
    );
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const firstTable = catalog.tables[0];
    const sourceWavBytes = await fs.readFile(path.join(repoRoot, firstTable.sourceWav));
    const parsedWave = parseWaveFile(
        sourceWavBytes.buffer.slice(
            sourceWavBytes.byteOffset,
            sourceWavBytes.byteOffset + sourceWavBytes.byteLength
        )
    );
    const bank = await loadFactoryBankFramesFromPatch({
        manifest,
        getResourceAddress(requestedPath) {
            if (requestedPath === "assets/factory-bank-catalog.json") {
                return `data:application/json;base64,${Buffer.from(JSON.stringify(catalog)).toString("base64")}`;
            }

            if (requestedPath === firstTable.sourceWav) {
                return `data:audio/wav;base64,${sourceWavBytes.toString("base64")}`;
            }

            throw new Error(`Unexpected resource path: ${requestedPath}`);
        },
    });

    return {
        catalog,
        parsedWave,
        bank,
        frames: bank.frames,
    };
}

test("initialized factory table identity remains PWM MedicineHat", async () => {
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const defaultTable = catalog.tables[34];

    assert.equal(defaultTable?.tableId, "pwm-medicinehat");
    assert.equal(defaultTable?.name, "PWM MedicineHat");
});

test("wave bank parser reads the current display source wavetable", async () => {
    const { bank, parsedWave } = await loadCurrentBank();
    assert.equal(parsedWave.sampleRate, 44100);
    assert.equal(parsedWave.channelCount, 1);
    assert.equal(parsedWave.bitsPerSample, 32);
    assert.equal(parsedWave.samples.length, bank.frameCount * 2048);
    assert.equal(bank.samples.length, parsedWave.samples.length);
});

test("frame extraction returns the 16 display-demo frames with evolving harmonic shape", async () => {
    const { frames } = await loadCurrentBank();
    const adjacentDiffs = [
        meanAbsoluteDifference(frames[0], frames[1]),
        meanAbsoluteDifference(frames[7], frames[8]),
        meanAbsoluteDifference(frames[14], frames[15]),
    ];
    const selectedCentroids = [
        harmonicCentroid(frames[0]),
        harmonicCentroid(frames[7]),
        harmonicCentroid(frames[15]),
    ];

    assert.equal(frames.length, 16);
    frames.forEach((frame) => assert.equal(frame.length, 2048));
    assert.deepEqual(
        adjacentDiffs.map((value) => Number(value.toFixed(4))),
        [0.0952, 0.0899, 0.0695]
    );
    assert.deepEqual(
        selectedCentroids.map((value) => Number(value.toFixed(3))),
        [1, 1.439, 1.196]
    );
});

test("bank loading resolves the selected source wavetable from the runtime catalog", async () => {
    const manifest = JSON.parse(
        await fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8")
    );
    const catalogBytes = await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"));
    const catalog = JSON.parse(catalogBytes.toString("utf8"));
    const sourceWavPath = catalog.tables[0].sourceWav;
    const sourceWavBytes = await fs.readFile(path.join(repoRoot, sourceWavPath));

    const requestedPaths = [];
    const bank = await loadFactoryBankFramesFromPatch({
        manifest,
        getResourceAddress(requestedPath) {
            requestedPaths.push(requestedPath);

            if (requestedPath === "assets/factory-bank-catalog.json") {
                return `data:application/json;base64,${catalogBytes.toString("base64")}`;
            }

            if (requestedPath === sourceWavPath) {
                return `data:audio/wav;base64,${sourceWavBytes.toString("base64")}`;
            }

            throw new Error(`Unexpected resource path: ${requestedPath}`);
        },
    });

    assert.equal(bank.sampleRate, 44100);
    assert.equal(bank.frameCount, catalog.tables[0].frameCount);
    assert.equal(bank.frames[0]?.length, 2048);
    assert.equal(bank.samples.length, bank.frameCount * 2048);
    assert.equal(bank.sampleBlobPath, sourceWavPath);
    assert.deepEqual(requestedPaths, ["assets/factory-bank-catalog.json", sourceWavPath]);
});

test("explicit resource client loads the selected source wavetable without raw patch connection resource helpers", async () => {
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const selectedTable = catalog.tables[1];
    const sourceWavBytes = await fs.readFile(path.join(repoRoot, selectedTable.sourceWav));
    const parsedWave = parseWaveFile(
        sourceWavBytes.buffer.slice(
            sourceWavBytes.byteOffset,
            sourceWavBytes.byteOffset + sourceWavBytes.byteLength
        )
    );
    const requestedCatalogPaths = [];
    const requestedAudioPaths = [];
    const resourceClient = {
        async readJSON(requestedPath) {
            requestedCatalogPaths.push(requestedPath);
            assert.equal(requestedPath, "assets/factory-bank-catalog.json");
            return catalog;
        },
        async readAudio(requestedPath) {
            requestedAudioPaths.push(requestedPath);
            assert.equal(requestedPath, selectedTable.sourceWav);
            return {
                sampleRate: parsedWave.sampleRate,
                samples: parsedWave.samples,
            };
        },
    };

    const loadedCatalog = await loadFactoryBankCatalog(resourceClient);
    const bank = await loadFactoryBankFrames(resourceClient, { tableIndex: 1 });

    assert.equal(loadedCatalog.tables[1]?.tableId, selectedTable.tableId);
    assert.equal(bank.sampleRate, parsedWave.sampleRate);
    assert.equal(bank.frameCount, Number(selectedTable.frameCount));
    assert.equal(bank.sampleBlobPath, selectedTable.sourceWav);
    assert.deepEqual(requestedCatalogPaths, [
        "assets/factory-bank-catalog.json",
        "assets/factory-bank-catalog.json",
    ]);
    assert.deepEqual(requestedAudioPaths, [selectedTable.sourceWav]);
});

test("byte-only resource clients are treated as resource clients instead of falling back to patch helpers", async () => {
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const requestedPaths = [];
    const resourceClient = {
        async readBytes(requestedPath) {
            requestedPaths.push(requestedPath);
            assert.equal(requestedPath, "assets/factory-bank-catalog.json");
            return Buffer.from(JSON.stringify(catalog), "utf8");
        },
    };

    const loadedCatalog = await loadFactoryBankCatalog(resourceClient);

    assert.equal(loadedCatalog.tables[0]?.tableId, catalog.tables[0]?.tableId);
    assert.deepEqual(requestedPaths, ["assets/factory-bank-catalog.json"]);
});

test("iPhone resource client reads catalog JSON through the native bridge and source audio through the resolved URL", async () => {
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const selectedTable = catalog.tables[1];
    const sourceWavBytes = await fs.readFile(path.join(repoRoot, selectedTable.sourceWav));
    const parsedWave = parseWaveFile(
        sourceWavBytes.buffer.slice(
            sourceWavBytes.byteOffset,
            sourceWavBytes.byteOffset + sourceWavBytes.byteLength
        )
    );
    const requestedCatalogPaths = [];
    const requestedAudioPaths = [];
    const requestedUrlPaths = [];
    const fetchedUrls = [];
    const patchConnection = {
        prefersResourceReadBridge: true,
        async readResource(requestedPath) {
            requestedCatalogPaths.push(requestedPath);
            assert.equal(requestedPath, "assets/factory-bank-catalog.json");
            return JSON.stringify(catalog);
        },
        async readResourceAsAudioData(requestedPath) {
            requestedAudioPaths.push(requestedPath);
            assert.equal(requestedPath, selectedTable.sourceWav);
            throw new Error(`The iPhone resource client should not use the audio bridge for ${requestedPath}`);
        },
        getResourceAddress(requestedPath) {
            requestedUrlPaths.push(requestedPath);
            return new URL(requestedPath, "https://example.test/bundle/");
        },
    };
    const resourceClient = createIOSResourceClient(patchConnection);

    const loadedCatalog = await loadFactoryBankCatalog(resourceClient);
    const bank = await withPatchedFetch(async (url) => {
        fetchedUrls.push(String(url));

        return {
            ok: true,
            async arrayBuffer() {
                return sourceWavBytes.buffer.slice(
                    sourceWavBytes.byteOffset,
                    sourceWavBytes.byteOffset + sourceWavBytes.byteLength
                );
            },
        };
    }, async () => loadFactoryBankFrames(resourceClient, { tableIndex: 1 }));

    assert.equal(loadedCatalog.tables[1]?.tableId, selectedTable.tableId);
    assert.equal(bank.sampleRate, parsedWave.sampleRate);
    assert.equal(bank.frameCount, Number(selectedTable.frameCount));
    assert.equal(bank.sampleBlobPath, selectedTable.sourceWav);
    assert.equal(bank.frames[0]?.length, 2048);
    assert.equal(bank.samples.length, bank.frameCount * 2048);
    assert.deepEqual(requestedCatalogPaths, [
        "assets/factory-bank-catalog.json",
        "assets/factory-bank-catalog.json",
    ]);
    assert.deepEqual(requestedAudioPaths, []);
    assert.deepEqual(requestedUrlPaths, [selectedTable.sourceWav]);
    assert.deepEqual(fetchedUrls, [
        `https://example.test/bundle/${selectedTable.sourceWav}`,
    ]);
});

test("iPhone resource client falls back to the native audio bridge when no resource URL is available", async () => {
    const catalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const selectedTable = catalog.tables[1];
    const sourceWavBytes = await fs.readFile(path.join(repoRoot, selectedTable.sourceWav));
    const parsedWave = parseWaveFile(
        sourceWavBytes.buffer.slice(
            sourceWavBytes.byteOffset,
            sourceWavBytes.byteOffset + sourceWavBytes.byteLength
        )
    );
    const requestedCatalogPaths = [];
    const requestedAudioPaths = [];
    const requestedUrlPaths = [];
    const patchConnection = {
        prefersResourceReadBridge: true,
        async readResource(requestedPath) {
            requestedCatalogPaths.push(requestedPath);
            assert.equal(requestedPath, "assets/factory-bank-catalog.json");
            return JSON.stringify(catalog);
        },
        async readResourceAsAudioData(requestedPath) {
            requestedAudioPaths.push(requestedPath);
            assert.equal(requestedPath, selectedTable.sourceWav);

            return {
                sampleRate: parsedWave.sampleRate,
                frames: Array.from(parsedWave.samples),
            };
        },
        getResourceAddress(requestedPath) {
            requestedUrlPaths.push(requestedPath);
            return null;
        },
    };
    const resourceClient = createIOSResourceClient(patchConnection);

    const loadedCatalog = await loadFactoryBankCatalog(resourceClient);
    const bank = await loadFactoryBankFrames(resourceClient, { tableIndex: 1 });

    assert.equal(loadedCatalog.tables[1]?.tableId, selectedTable.tableId);
    assert.equal(bank.sampleRate, parsedWave.sampleRate);
    assert.equal(bank.frameCount, Number(selectedTable.frameCount));
    assert.equal(bank.sampleBlobPath, selectedTable.sourceWav);
    assert.equal(bank.frames[0]?.length, 2048);
    assert.equal(bank.samples.length, bank.frameCount * 2048);
    assert.deepEqual(requestedCatalogPaths, [
        "assets/factory-bank-catalog.json",
        "assets/factory-bank-catalog.json",
    ]);
    assert.deepEqual(requestedAudioPaths, [selectedTable.sourceWav]);
    assert.deepEqual(requestedUrlPaths, [selectedTable.sourceWav]);
});

test("bank loading prefers the resolved resource URL for factory wavetable source paths when both loader paths are available", async () => {
    const spacedPath = "assets/factory_sources/imported/BS2 - Acid.wav";
    const fullCatalog = getFactoryBankCatalogValue(
        JSON.parse(await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"))
    );
    const spacedTable = fullCatalog.tables.find((table) => table.sourceWav === spacedPath);
    assert.ok(spacedTable, `Could not find ${spacedPath} in the runtime catalog`);
    const catalog = {
        tables: [spacedTable],
    };
    const waveBuffer = await fs.readFile(path.join(repoRoot, spacedPath));
    const fetchedUrls = [];
    const readAudioPaths = [];

    const bank = await withPatchedFetch(async (url) => {
        fetchedUrls.push(String(url));

        return {
            ok: true,
            async arrayBuffer() {
                return waveBuffer.buffer.slice(
                    waveBuffer.byteOffset,
                    waveBuffer.byteOffset + waveBuffer.byteLength
                );
            },
        };
    }, async () => loadFactoryBankFramesFromPatch({
        readResource(path) {
            if (path === "assets/factory-bank-catalog.json") {
                return JSON.stringify(catalog);
            }

            throw new Error(`Unexpected resource path: ${path}`);
        },
        readResourceAsAudioData(path) {
            readAudioPaths.push(path);
            throw new Error(`The audio-data bridge should not be used for ${path}`);
        },
        getResourceAddress(requestedPath) {
            return new URL(requestedPath, "https://example.test/bundle/");
        },
    }, { tableIndex: 0 }));

    assert.equal(bank.frameCount, Number(spacedTable.frameCount));
    assert.equal(bank.sampleBlobPath, spacedPath);
    assert.deepEqual(readAudioPaths, []);
    assert.deepEqual(fetchedUrls, [
        "https://example.test/bundle/assets/factory_sources/imported/BS2%20-%20Acid.wav",
    ]);
});

test("factory bank catalog rejects stale packed-bank entries without source wavs", () => {
    assert.throws(
        () => getFactoryBankCatalogValue({
            tables: [
                {
                    tableId: "bad",
                    name: "Bad",
                    frameCount: 4,
                },
            ],
        }),
        /must provide sourceWav/
    );
});

test("factory bank catalog loader returns names for the selector UI", async () => {
    const catalogBytes = await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"));
    const catalog = await loadFactoryBankCatalogFromPatch({
        getResourceAddress(requestedPath) {
            if (requestedPath === "assets/factory-bank-catalog.json") {
                return `data:application/json;base64,${catalogBytes.toString("base64")}`;
            }

            throw new Error(`Unexpected resource path: ${requestedPath}`);
        },
    });

    assert.ok(catalog.tables.length >= 2);
    assert.equal(typeof catalog.tables[0]?.tableId, "string");
    assert.equal(typeof catalog.tables[0]?.name, "string");
    assert.equal(typeof catalog.tables[0]?.sourceWav, "string");
});

test("wavetable renderer inherits the graphite and cyan shared patch theme", () => {
    assert.equal(DEFAULT_WAVETABLE_THEME.backgroundTop, "#161616");
    assert.equal(DEFAULT_WAVETABLE_THEME.backgroundBottom, "#101010");
    assert.deepEqual(DEFAULT_WAVETABLE_THEME.backgroundRGB, [16, 16, 16]);
    assert.equal(DEFAULT_WAVETABLE_THEME.panelStroke, "rgba(125, 247, 255, 0.05)");
    assert.deepEqual(DEFAULT_WAVETABLE_THEME.meshColor, DEFAULT_PATCH_THEME.accentBlueRGB);
    assert.equal(getPatchThemeCSSVariables()["--cosimo-accent-blue"], DEFAULT_PATCH_THEME.accentBlue);
});

test("loading table 1 returns a different stored frame set than table 0", async () => {
    const manifest = JSON.parse(
        await fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8")
    );
    const catalog = JSON.parse(
        await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8")
    );
    const sourceWavByPath = new Map();

    for (const table of catalog.tables.slice(0, 2)) {
        sourceWavByPath.set(
            table.sourceWav,
            await fs.readFile(path.join(repoRoot, table.sourceWav))
        );
    }

    const patchConnection = {
        manifest,
        getResourceAddress(requestedPath) {
            if (requestedPath === "assets/factory-bank-catalog.json") {
                return `data:application/json;base64,${Buffer.from(JSON.stringify(catalog)).toString("base64")}`;
            }

            if (sourceWavByPath.has(requestedPath)) {
                return `data:audio/wav;base64,${sourceWavByPath.get(requestedPath).toString("base64")}`;
            }

            throw new Error(`Unexpected resource path: ${requestedPath}`);
        },
    };
    const firstTable = await loadFactoryBankFramesFromPatch(patchConnection, { tableIndex: 0 });
    const secondTable = await loadFactoryBankFramesFromPatch(patchConnection, { tableIndex: 1 });

    assert.notEqual(secondTable.frameCount, 0);
    assert.notDeepEqual(
        Array.from(firstTable.frames[0]),
        Array.from(secondTable.frames[0])
    );
});

test("decimation preserves the first and last sample columns", () => {
    const source = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const decimated = decimateFrame(source, 5);

    assert.equal(decimated.length, 5);
    assert.equal(decimated[0], 1);
    assert.equal(decimated[decimated.length - 1], 8);
});

test("frame state matches the oscillator's frame blend mapping", () => {
    const state = createFrameState(16, 0.5);

    assert.equal(state.frameLo, 7);
    assert.equal(state.frameHi, 8);
    assert.equal(state.frameT, 0.5);
    assert.equal(state.frameIndex, 7.5);
});

test("current slice is the exact blend of the surrounding stored frames", () => {
    const frames = createSimpleFrames([
        [0, 1, 0, -1, 0],
        [1, 0, 1, 0, 1],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        width: 320,
        height: 220,
    });

    assert.deepEqual(
        Array.from(model.currentSlice.samples),
        [0.5, 0.5, 0.5, -0.5, 0.5]
    );
});

test("bend warp remaps the highlighted slice shape instead of leaving the raw frame blend unchanged", () => {
    const frames = createSimpleFrames([
        [0, 0.25, 0.5, 0.75, 1],
        [0, 0.25, 0.5, 0.75, 1],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        warpMode: 1,
        warpAmount: 1,
        width: 320,
        height: 220,
    });

    const warped = Array.from(model.currentSlice.samples).map((value) => Number(value.toFixed(3)));

    assert.equal(warped[0], 0);
    assert.ok(warped[1] > 0.25);
    assert.equal(warped[2], 0.5);
    assert.ok(warped[3] < 0.75);
    assert.equal(warped[4], 1);
    assert.match(model.currentSlice.label.text, /Bend \+100%/);
});

test("PWM compresses the source cycle and fills the remainder with a held tail value", () => {
    const frames = createSimpleFrames([
        [1, 0.75, 0.5, 0.25, 0],
        [1, 0.75, 0.5, 0.25, 0],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        warpMode: 2,
        warpAmount: 1,
        width: 320,
        height: 220,
    });

    assert.deepEqual(
        Array.from(model.currentSlice.samples).map((value) => Number(value.toFixed(3))),
        [1, 0, 0, 0, 0]
    );
    assert.match(model.currentSlice.label.text, /PWM 100%/);
});

test("Asym +/- keeps linear source segments straight while skewing the whole cycle", () => {
    const frames = createSimpleFrames([
        [0, 0.25, 0.5, 0.75, 1],
        [0, 0.25, 0.5, 0.75, 1],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        warpMode: 3,
        warpAmount: 1,
        width: 320,
        height: 220,
    });
    const warped = Array.from(model.currentSlice.samples);
    const deltas = [
        warped[1] - warped[0],
        warped[2] - warped[1],
        warped[3] - warped[2],
    ];
    const deltaSpan = Math.max(...deltas) - Math.min(...deltas);

    assert.ok(deltaSpan <= 0.002, `expected the warped triangle deltas to stay nearly linear, got span ${deltaSpan}`);
    assert.match(model.currentSlice.label.text, /Asym \+100%/);
});

test("Mirror turns a ramp into a mirrored triangle when the dial is centered", () => {
    const frames = createSimpleFrames([
        [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
        [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        warpMode: 4,
        warpAmount: 0.5,
        width: 420,
        height: 220,
    });

    assert.deepEqual(
        Array.from(model.currentSlice.samples).slice(0, -1).map((value) => Number(value.toFixed(3))),
        [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25]
    );
    assert.match(model.currentSlice.label.text, /Mirror 0%/);
});

test("perspective makes distant stored frames narrower than front frames", () => {
    const frames = createSimpleFrames([
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
    ]);
    const scene = buildWavetableStaticScene({
        frames,
        width: 720,
        height: 360,
    });
    const frontFrame = scene.contourFrames[0];
    const backFrame = scene.contourFrames[scene.contourFrames.length - 1];
    const frontWidth = frontFrame.points.at(-1).x - frontFrame.points[0].x;
    const backWidth = backFrame.points.at(-1).x - backFrame.points[0].x;

    assert.ok(frontWidth > backWidth);
});

test("deck footprint stays wide and recedes upward instead of running down the screen", () => {
    const frames = createSimpleFrames([
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
    ]);
    const scene = buildWavetableStaticScene({
        frames,
        width: 720,
        height: 360,
    });
    const frontFloor = scene.guideLines[0].points;
    const backFloor = scene.guideLines[1].points;
    const leftEdge = scene.guideLines[2].points;
    const rightEdge = scene.guideLines[3].points;
    const frontWidth = Math.hypot(
        frontFloor[1].x - frontFloor[0].x,
        frontFloor[1].y - frontFloor[0].y
    );
    const averageDepth = (
        Math.hypot(leftEdge[1].x - leftEdge[0].x, leftEdge[1].y - leftEdge[0].y) +
        Math.hypot(rightEdge[1].x - rightEdge[0].x, rightEdge[1].y - rightEdge[0].y)
    ) / 2;
    const averageFrontY = (frontFloor[0].y + frontFloor[1].y) / 2;
    const averageBackY = (backFloor[0].y + backFloor[1].y) / 2;
    const frontSlope = Math.abs(
        (frontFloor[1].y - frontFloor[0].y) / (frontFloor[1].x - frontFloor[0].x)
    );

    assert.ok(frontWidth > averageDepth);
    assert.ok(averageBackY < averageFrontY);
    assert.ok(frontSlope < 0.2);
});

test("surface bands only connect adjacent frames and adjacent sample columns", () => {
    const frames = createSimpleFrames([
        [-1, -0.5, 0, 0.5, 1],
        [-1, -0.5, 0, 0.5, 1],
        [-1, -0.5, 0, 0.5, 1],
    ]);
    const scene = buildWavetableStaticScene({
        frames,
        width: 420,
        height: 240,
    });

    assert.equal(scene.surfaceBands.length, 8);

    for (const band of scene.surfaceBands) {
        assert.equal(band.frameHi - band.frameLo, 1);
        assert.ok(Number.isInteger(band.sampleIndex));
        assert.equal(band.points.length, 4);
    }
});

test("discontinuity splitting leaves a gap across reset edges", () => {
    const frames = createSimpleFrames([
        [-0.2, 0.1, 0.4, -0.8, -0.5],
        [-0.1, 0.2, 0.45, -0.85, -0.55],
    ]);
    const scene = buildWavetableStaticScene({
        frames,
        width: 360,
        height: 220,
    });
    const model = buildWavetableRenderModel({
        staticScene: scene,
        position: 0.4,
    });

    assert.equal(scene.surfaceBands.length, 3);
    assert.ok(scene.surfaceBands.every((band) => band.sampleIndex !== 2));
    assert.equal(model.contours[0].segments.length, 2);
    assert.equal(model.currentSlice.segments.length, 1);
});

test("surface bands are sorted back-to-front for canvas transparency", () => {
    const frames = createSimpleFrames([
        [-1, -0.4, 0.2, 0.9],
        [-1, -0.4, 0.2, 0.9],
        [-1, -0.4, 0.2, 0.9],
        [-1, -0.4, 0.2, 0.9],
    ]);
    const scene = buildWavetableStaticScene({
        frames,
        width: 520,
        height: 260,
    });

    for (let index = 1; index < scene.surfaceBands.length; index += 1) {
        assert.ok(scene.surfaceBands[index - 1].averageCameraDepth >= scene.surfaceBands[index].averageCameraDepth);
    }
});

test("resizing changes projected coordinates but keeps the same topology", () => {
    const frames = createSimpleFrames([
        [-1, -0.4, 0.2, 0.9],
        [-1, -0.2, 0.5, 0.9],
        [-1, 0, 0.7, 0.9],
    ]);
    const smallScene = buildWavetableStaticScene({
        frames,
        width: 420,
        height: 240,
    });
    const largeScene = buildWavetableStaticScene({
        frames,
        width: 860,
        height: 420,
    });

    assert.equal(smallScene.surfaceBands.length, largeScene.surfaceBands.length);
    assert.notEqual(
        smallScene.contourFrames[0].points[0].x,
        largeScene.contourFrames[0].points[0].x
    );
});

test("flat identical frames collapse into a stable slab", () => {
    const frames = createSimpleFrames([
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]);
    const model = buildWavetableRenderModel({
        frames,
        position: 0.37,
        width: 420,
        height: 240,
    });

    const isCollinear = (points) => {
        const start = points[0];
        const end = points.at(-1);
        const baseDX = end.x - start.x;
        const baseDY = end.y - start.y;

        return points.every((point) => {
            const dx = point.x - start.x;
            const dy = point.y - start.y;

            return Math.abs((dx * baseDY) - (dy * baseDX)) < 0.01;
        });
    };

    model.contours.forEach((contour) => assert.ok(isCollinear(contour.points)));
    assert.ok(isCollinear(model.currentSlice.points));
});

test("canvas display coalesces repeated position updates into one animation-frame paint", () => {
    const frames = createSimpleFrames([
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
    ]);
    const canvas = new FakeCanvas();
    const animationFrame = createAnimationFrameHarness();
    const display = new CanvasWavetableDisplay(canvas, {
        requestAnimationFrame: animationFrame.requestAnimationFrame,
        cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    });
    const originalRender = display.render.bind(display);
    let renderCount = 0;

    display.render = () => {
        renderCount += 1;
        return originalRender();
    };

    display.resize(320, 220, 1);
    display.setFrames(frames);
    assert.equal(animationFrame.pendingCount, 1);
    assert.equal(renderCount, 0);

    animationFrame.flush();
    assert.equal(renderCount, 1);

    renderCount = 0;
    display.setPosition(0.12);
    display.setPosition(0.34);
    display.setPosition(0.56);

    assert.equal(animationFrame.pendingCount, 1);
    assert.equal(renderCount, 0);
    assert.equal(display.position, 0.56);

    animationFrame.flush();
    assert.equal(renderCount, 1);
});

test("canvas display coalesces repeated warp updates and keeps the cached raw mesh", () => {
    const frames = createSimpleFrames([
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
    ]);
    const canvas = new FakeCanvas();
    const animationFrame = createAnimationFrameHarness();
    const display = new CanvasWavetableDisplay(canvas, {
        requestAnimationFrame: animationFrame.requestAnimationFrame,
        cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    });

    display.resize(320, 220, 1);
    display.setFrames(frames);
    animationFrame.flush();

    const staticSceneBeforeWarp = display.getStaticScene(320, 220);

    display.setWarp(1, 0.2);
    display.setWarp(2, 0.6);
    display.setWarp(4, 0.4);

    assert.equal(animationFrame.pendingCount, 1);
    assert.equal(display.warpMode, 4);
    assert.equal(display.warpAmount, 0.4);
    assert.equal(display.getStaticScene(320, 220), staticSceneBeforeWarp);
});

test("boundary positions and exact stored-frame positions stay continuous", async () => {
    const { frames } = await loadCurrentBank();
    const modelAtStart = buildWavetableRenderModel({
        frames,
        position: 0,
        width: 640,
        height: 320,
    });
    const modelAtEnd = buildWavetableRenderModel({
        frames,
        position: 1,
        width: 640,
        height: 320,
    });
    const exactStoredFramePosition = 7 / 15;
    const modelAtStoredFrame = buildWavetableRenderModel({
        frames,
        position: exactStoredFramePosition,
        width: 640,
        height: 320,
    });

    assert.deepEqual(
        Array.from(modelAtStart.currentSlice.samples),
        Array.from(modelAtStart.contours.find((contour) => contour.frameIndex === 0).samples)
    );
    assert.deepEqual(
        Array.from(modelAtEnd.currentSlice.samples),
        Array.from(modelAtEnd.contours.find((contour) => contour.frameIndex === 15).samples)
    );
    assert.deepEqual(
        Array.from(modelAtStoredFrame.currentSlice.samples),
        Array.from(modelAtStoredFrame.contours.find((contour) => contour.frameIndex === 7).samples)
    );
});

test("real-bank model keeps discontinuities and produces a deterministic highlighted slice", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.5,
        width: 760,
        height: 400,
    });

    assert.equal(model.frameCount, 16);
    assert.ok(model.surfaceBands.length > 0);
    assert.ok(model.surfaceBands.some((band) => band.sampleIndex > 0));
    assert.deepEqual(
        model.currentSlice.points.slice(0, 3).map((point) => [
            Number(point.x.toFixed(2)),
            Number(point.y.toFixed(2)),
        ]),
        [
            [252.94, 136.7],
            [254.49, 135.05],
            [256.05, 133.44],
        ]
    );
    assert.equal(model.currentSlice.segments.length, 1);
});

test("draw routine emits filled surface bands, contour strokes, and the in-canvas label", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.25,
        width: 640,
        height: 320,
    });
    const context = new FakeContext();

    drawWavetableModel(context, model);

    const fillCommands = context.commands.filter((command) => command.type === "fill");
    const strokeCommands = context.commands.filter((command) => command.type === "stroke");
    const textCommands = context.commands.filter((command) => command.type === "fillText");

    assert.ok(fillCommands.length >= model.surfaceBands.length);
    assert.ok(strokeCommands.length >= model.contours.length + model.surfaceRibs.length + 1);
    assert.equal(textCommands.length, 1);
    assert.match(textCommands[0].text, /^Frame /);
});

test("compact-cutover options suppress the background fill and slice caption without touching the artwork", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.25,
        width: 640,
        height: 320,
    });

    const defaults = new FakeContext();
    drawWavetableModel(defaults, model);
    const defaultFullRects = defaults.commands.filter((command) => (
        command.type === "fillRect" && command.args[2] === model.width && command.args[3] === model.height
    ));
    assert.equal(defaultFullRects.length, 1, "defaults keep the painted background");

    const context = new FakeContext();
    drawWavetableModel(context, model, undefined, { paintBackground: false, showSliceCaption: false });

    const clears = context.commands.filter((command) => command.type === "clearRect");
    assert.equal(clears.length, 1, "the canvas still clears so transparent hosts cannot smear");

    const fullRects = context.commands.filter((command) => (
        command.type === "fillRect" && command.args[2] === model.width && command.args[3] === model.height
    ));
    assert.equal(fullRects.length, 0, "no full-canvas background fill");

    const textCommands = context.commands.filter((command) => command.type === "fillText");
    assert.equal(textCommands.length, 0, "no permanent Frame/Index caption");

    const artStrokes = context.commands.filter((command) => command.type === "stroke");
    const defaultStrokes = defaults.commands.filter((command) => command.type === "stroke");
    assert.equal(artStrokes.length, defaultStrokes.length, "the retained artwork is untouched");
});

/* ------------------------------------------------------------------ */
/* T02C — Index modulation range overlay                               */
/* ------------------------------------------------------------------ */

const OVERLAY_ACCENT = [105, 213, 197];

function recordDraw(model, options) {
    const context = new FakeContext();
    drawWavetableModel(context, model, undefined, options);
    return context.commands;
}

function parseRGBAAlpha(style) {
    const match = /^rgba\(\d+, \d+, \d+, ([0-9.]+)\)$/.exec(style);
    assert.ok(match, `expected an rgba() style, received "${style}"`);
    return Number(match[1]);
}

/**
 * Pair the two command streams and split the paint-affecting pairs into
 * identical and tinted, proving geometry, alpha, and everything that is not
 * a colour stays byte-identical.
 */
function diffDrawStreams(baseline, tinted) {
    assert.equal(tinted.length, baseline.length, "an overlay may never add or remove draw commands");
    const differingStrokeIndices = [];
    const differingFillIndices = [];

    baseline.forEach((command, index) => {
        const twin = tinted[index];
        assert.equal(twin.type, command.type, `command ${index} keeps its type`);
        if (command.type === "stroke") {
            assert.deepEqual(twin.path, command.path, `stroke ${index} keeps its geometry`);
            assert.equal(twin.lineWidth, command.lineWidth, `stroke ${index} keeps its line width`);
            assert.equal(twin.shadowBlur, command.shadowBlur, `stroke ${index} keeps its glow`);
            if (twin.strokeStyle !== command.strokeStyle) {
                assert.equal(
                    parseRGBAAlpha(twin.strokeStyle),
                    parseRGBAAlpha(command.strokeStyle),
                    `tinted stroke ${index} keeps its exact alpha`,
                );
                differingStrokeIndices.push(index);
            }
        } else if (command.type === "fill") {
            assert.deepEqual(twin.path, command.path, `fill ${index} keeps its geometry`);
            if (twin.fillStyle !== command.fillStyle) {
                assert.equal(
                    parseRGBAAlpha(twin.fillStyle),
                    parseRGBAAlpha(command.fillStyle),
                    `tinted fill ${index} keeps its exact transparency`,
                );
                differingFillIndices.push(index);
            }
        } else {
            assert.deepEqual(twin, command, `non-paint command ${index} is untouched`);
        }
    });

    return { differingStrokeIndices, differingFillIndices };
}

function strokeCountForSegments(items) {
    return items.reduce((count, item) => (
        count + item.segments.filter((segment) => segment.length >= 2).length
    ), 0);
}

test("index modulation overlay tints exactly the in-range slice lines and skin", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.25,
        width: 640,
        height: 320,
    });
    const lowPosition = 0.25;
    const highPosition = 0.75;
    const lowIndex = createFrameState(model.frameCount, lowPosition).frameIndex;
    const highIndex = createFrameState(model.frameCount, highPosition).frameIndex;
    const epsilon = 1e-6;

    const baseline = recordDraw(model, {});
    const tinted = recordDraw(model, {
        modulationRange: { lowPosition, highPosition, color: OVERLAY_ACCENT },
    });
    const { differingStrokeIndices, differingFillIndices } = diffDrawStreams(baseline, tinted);

    const inRange = (frameIndex) => frameIndex >= lowIndex - epsilon && frameIndex <= highIndex + epsilon;
    const expectedSliceStrokes = strokeCountForSegments(model.surfaceSlices.filter((slice) => inRange(slice.frameIndex)));
    const expectedContourStrokes = strokeCountForSegments(model.contours.filter((contour) => inRange(contour.frameIndex)));
    const expectedBandFills = model.surfaceBands.filter((band) => (
        Math.min(band.frameHi, highIndex) - Math.max(band.frameLo, lowIndex) > epsilon
    )).length;

    assert.ok(expectedSliceStrokes > 0, "the fixture range must cover interpolated slices");
    assert.ok(expectedContourStrokes > 0, "the fixture range must cover contour lines");
    assert.ok(expectedBandFills > 0, "the fixture range must cover surface bands");
    assert.ok(
        expectedSliceStrokes + expectedContourStrokes
            < strokeCountForSegments(model.surfaceSlices) + strokeCountForSegments(model.contours),
        "the fixture range must also leave lines untouched",
    );
    assert.equal(
        differingStrokeIndices.length,
        expectedSliceStrokes + expectedContourStrokes,
        "exactly the in-range slice lines change colour (current slice, ribs, and guides never do)",
    );
    assert.equal(
        differingFillIndices.length,
        expectedBandFills,
        "exactly the overlapped skin faces change colour",
    );
});

test("index modulation overlay full range tints every line and face; a collapsed edge range marks only the edge slice", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.25,
        width: 640,
        height: 320,
    });
    const baseline = recordDraw(model, {});
    const epsilon = 1e-6;

    const fullDiff = diffDrawStreams(baseline, recordDraw(model, {
        modulationRange: { lowPosition: 0, highPosition: 1, color: OVERLAY_ACCENT },
    }));
    assert.equal(
        fullDiff.differingStrokeIndices.length,
        strokeCountForSegments(model.surfaceSlices) + strokeCountForSegments(model.contours),
        "a full-range overlay tints every slice line and contour",
    );
    assert.equal(
        fullDiff.differingFillIndices.length,
        model.surfaceBands.length,
        "a full-range overlay tints every skin face",
    );

    const lastIndex = model.frameCount - 1;
    const collapsedDiff = diffDrawStreams(baseline, recordDraw(model, {
        modulationRange: { lowPosition: 1, highPosition: 1, color: OVERLAY_ACCENT },
    }));
    const expectedEdgeStrokes = strokeCountForSegments([
        ...model.surfaceSlices.filter((slice) => Math.abs(slice.frameIndex - lastIndex) <= epsilon),
        ...model.contours.filter((contour) => Math.abs(contour.frameIndex - lastIndex) <= epsilon),
    ]);
    assert.ok(expectedEdgeStrokes > 0, "the fixture must draw a line at the last frame");
    assert.equal(
        collapsedDiff.differingStrokeIndices.length,
        expectedEdgeStrokes,
        "a range fully clipped to the edge marks only the edge slice line",
    );
    assert.equal(collapsedDiff.differingFillIndices.length, 0, "a zero-width range tints no skin");
});

test("a null modulation overlay draws the identical default stream", async () => {
    const { frames } = await loadCurrentBank();
    const model = buildWavetableRenderModel({
        frames,
        position: 0.25,
        width: 640,
        height: 320,
    });

    assert.deepEqual(
        recordDraw(model, { modulationRange: null }),
        recordDraw(model, {}),
        "a null overlay is byte-identical to no overlay",
    );
});

test("canvas display coalesces modulation-range updates and clearing the range restores the exact base paint", () => {
    const frames = createSimpleFrames([
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
        [-1, -0.25, 0.5, 1],
    ]);
    const canvas = new FakeCanvas();
    const animationFrame = createAnimationFrameHarness();
    const display = new CanvasWavetableDisplay(canvas, {
        requestAnimationFrame: animationFrame.requestAnimationFrame,
        cancelAnimationFrame: animationFrame.cancelAnimationFrame,
    });

    display.resize(320, 220, 1);
    display.setFrames(frames);
    animationFrame.flush();
    // The fake context keeps shadow state between paints (a real context's
    // save/restore resets it), so capture the base stream from a second,
    // state-primed paint that later repaints can match exactly.
    const primedLength = canvas.context.commands.length;
    display.setPosition(display.position);
    animationFrame.flush();
    const basePaint = canvas.context.commands.slice(primedLength);

    display.setModulationRange({ lowPosition: 0, highPosition: 1, color: OVERLAY_ACCENT });
    display.setModulationRange({ lowPosition: 0.5, highPosition: 1, color: OVERLAY_ACCENT });
    assert.equal(animationFrame.pendingCount, 1, "range updates coalesce into one repaint");

    animationFrame.flush();
    const tintedPaint = canvas.context.commands.slice(primedLength + basePaint.length);
    assert.equal(tintedPaint.length, basePaint.length);
    assert.notDeepEqual(tintedPaint, basePaint, "the coalesced repaint shows the overlay");

    display.setModulationRange(null);
    animationFrame.flush();
    const clearedPaint = canvas.context.commands.slice(primedLength + basePaint.length + tintedPaint.length);
    assert.deepEqual(clearedPaint, basePaint, "clearing the range restores the untouched artwork");
});
