import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
    parseWaveFile,
    getFactoryBankCatalogValue,
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
} from "../patch_gui/wavetable-bank.mjs";
import {
    DEFAULT_WAVETABLE_THEME,
    createFrameState,
    decimateFrame,
    buildWavetableStaticScene,
    buildWavetableRenderModel,
    drawWavetableModel,
    CanvasWavetableDisplay,
} from "../patch_gui/wavetable-display.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

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

let patchViewModulePromise;

async function loadPatchViewModule() {
    if (!patchViewModulePromise) {
        globalThis.HTMLElement ??= class {};
        globalThis.window ??= {};
        globalThis.window.customElements ??= {
            get() {
                return undefined;
            },
            define() {},
        };

        patchViewModulePromise = import(
            `${pathToFileURL(path.join(repoRoot, "patch_gui", "index.js")).href}?test=display`
        );
    }

    return patchViewModulePromise;
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

test("display position matching ignores float noise but not real slider movement", async () => {
    const { displayPositionsMatch } = await loadPatchViewModule();

    assert.equal(displayPositionsMatch(0.37, 0.3700000047683716), true);
    assert.equal(displayPositionsMatch(0.37, 0.371), false);
});

test("effective wavetable position monitor messages clamp positions and unwrap runtime event payloads", async () => {
    const { normalizeEffectiveWavetablePositionMessage } = await loadPatchViewModule();

    assert.deepEqual(
        normalizeEffectiveWavetablePositionMessage({
            event: { voiceGeneration: 7, position: 1.4 },
        }),
        { voiceGeneration: 7, position: 1 }
    );
    assert.deepEqual(
        normalizeEffectiveWavetablePositionMessage({
            voiceGeneration: -5,
            position: -0.2,
        }),
        { voiceGeneration: 0, position: 0 }
    );
    assert.equal(
        normalizeEffectiveWavetablePositionMessage({ voiceGeneration: 2, position: Number.NaN }),
        null
    );
});

test("effective wavetable position monitor keeps the newest voice generation", async () => {
    const { selectObservedWavetablePositionState } = await loadPatchViewModule();

    const olderVoiceState = selectObservedWavetablePositionState(
        { voiceGeneration: 4, position: 0.62 },
        { voiceGeneration: 3, position: 0.15 }
    );
    const sameVoiceState = selectObservedWavetablePositionState(
        { voiceGeneration: 4, position: 0.62 },
        { voiceGeneration: 4, position: 0.18 }
    );
    const newerVoiceState = selectObservedWavetablePositionState(
        { voiceGeneration: 4, position: 0.62 },
        { voiceGeneration: 5, position: 0.33 }
    );

    assert.deepEqual(olderVoiceState, { voiceGeneration: 4, position: 0.62 });
    assert.deepEqual(sameVoiceState, { voiceGeneration: 4, position: 0.18 });
    assert.deepEqual(newerVoiceState, { voiceGeneration: 5, position: 0.33 });
});

test("upward wavetable-stage drag maps to the same normalized position change as moving the slider right", async () => {
    const { mapDisplayDragToPosition } = await loadPatchViewModule();

    assert.equal(mapDisplayDragToPosition(0.25, 300, 250, 200), 0.5);
    assert.equal(Number(mapDisplayDragToPosition(0.25, 300, 340, 200).toFixed(3)), 0.05);
    assert.equal(mapDisplayDragToPosition(0.9, 300, 0, 200), 1);
    assert.equal(mapDisplayDragToPosition(0.1, 300, 700, 200), 0);
});

test("display gesture helpers distinguish vertical scan drags from horizontal table swipes", async () => {
    const {
        getAdjacentTableIndices,
        resolveDisplayGestureAxis,
        resolveHorizontalSwipeTarget,
        shouldCommitHorizontalSwipe,
    } = await loadPatchViewModule();

    assert.deepEqual(getAdjacentTableIndices(0, 5), [1]);
    assert.deepEqual(getAdjacentTableIndices(2, 5), [1, 3]);
    assert.deepEqual(getAdjacentTableIndices(4, 5), [3]);
    assert.equal(resolveDisplayGestureAxis(6, 8), "pending");
    assert.equal(resolveDisplayGestureAxis(-48, 10), "horizontal");
    assert.equal(resolveDisplayGestureAxis(9, -52), "vertical");
    assert.deepEqual(resolveHorizontalSwipeTarget(3, -80, 8), {
        direction: 1,
        targetTableIndex: 4,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(3, 80, 8), {
        direction: -1,
        targetTableIndex: 2,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(0, 80, 8), {
        direction: -1,
        targetTableIndex: 0,
        hasTarget: false,
    });
    assert.equal(shouldCommitHorizontalSwipe(28, 320), false);
    assert.equal(shouldCommitHorizontalSwipe(-72, 320), true);
});

test("wavetable renderer keeps a flat shared background and no visible panel stroke", () => {
    assert.equal(DEFAULT_WAVETABLE_THEME.backgroundTop, "#04070f");
    assert.equal(DEFAULT_WAVETABLE_THEME.backgroundBottom, "#04070f");
    assert.deepEqual(DEFAULT_WAVETABLE_THEME.backgroundRGB, [4, 7, 15]);
    assert.equal(DEFAULT_WAVETABLE_THEME.panelStroke, "rgba(132, 149, 255, 0.0)");
});

test("wavetable upload events are chunked into 2048-sample frames with a shared upload token", async () => {
    const { buildUploadedWavetableFrameEvents } = await loadPatchViewModule();
    const bank = {
        frameCount: 2,
        frames: [
            Float32Array.from({ length: 2048 }, (_, index) => index / 2048),
            Float32Array.from({ length: 2048 }, (_, index) => (index + 2048) / 2048),
        ],
    };

    const events = buildUploadedWavetableFrameEvents(bank, 17);

    assert.equal(events.length, 2);
    assert.deepEqual(
        events.map(({ uploadToken, frameCount, frameIndex, samples }) => ({
            uploadToken,
            frameCount,
            frameIndex,
            sampleCount: samples.length,
            firstSample: samples[0],
            lastSample: samples[samples.length - 1],
        })),
        [
            {
                uploadToken: 17,
                frameCount: 2,
                frameIndex: 0,
                sampleCount: 2048,
                firstSample: 0,
                lastSample: 2047 / 2048,
            },
            {
                uploadToken: 17,
                frameCount: 2,
                frameIndex: 1,
                sampleCount: 2048,
                firstSample: 1,
                lastSample: 4095 / 2048,
            },
        ]
    );
});

test("keyboard geometry expands a one-and-a-half-octave range to fill the footer width", async () => {
    const { computeKeyboardDimensions } = await loadPatchViewModule();
    const dimensions = computeKeyboardDimensions({
        rootNote: 36,
        noteCount: 18,
        availableWidth: 337,
        minNaturalWidth: 22,
    });

    assert.equal(dimensions.naturalCount, 11);
    assert.ok(Math.abs((dimensions.naturalWidth * dimensions.naturalCount) + 1 - 337) < 0.001);
    assert.ok(dimensions.accidentalWidth > 0);
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
            [282.26, 120.7],
            [283.45, 119.05],
            [284.65, 117.44],
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
