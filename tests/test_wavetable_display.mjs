import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
        const customElementRegistry = new Map();
        globalThis.window.customElements ??= {
            get(name) {
                return customElementRegistry.get(name);
            },
            define(name, value) {
                customElementRegistry.set(name, value);
            },
        };

        patchViewModulePromise = import(
            `${pathToFileURL(path.join(repoRoot, "patch_gui", "index.js")).href}?test=display`
        );
    }

    return patchViewModulePromise;
}

function createMetricElement({
    className = "",
    tagName = "DIV",
    rect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 },
    children = [],
    computedStyle = {},
    queries = {},
} = {}) {
    return {
        className,
        tagName,
        children,
        computedStyle: {
            display: "block",
            position: "static",
            top: "auto",
            right: "auto",
            bottom: "auto",
            left: "auto",
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            minHeight: "0px",
            maxWidth: "none",
            overflow: "visible",
            overflowY: "visible",
            gridRow: "auto",
            gridTemplateRows: "none",
            alignSelf: "stretch",
            ...computedStyle,
        },
        getBoundingClientRect() {
            return rect;
        },
        querySelector(selector) {
            return queries[selector] ?? null;
        },
    };
}

const VOID_HTML_TAGS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

function parseHTMLTree(html) {
    const root = {
        tagName: "#root",
        attributes: {},
        classList: [],
        children: [],
        parent: null,
    };
    const stack = [root];
    const tagPattern = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
    let match;

    while ((match = tagPattern.exec(html))) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();

        if (fullTag.startsWith("</")) {
            while (stack.length > 1) {
                const current = stack.pop();

                if (current.tagName === tagName) {
                    break;
                }
            }

            continue;
        }

        const attributes = {};
        const attributePattern = /([^\s=/>]+)(?:="([^"]*)")?/g;
        let attributeMatch;

        while ((attributeMatch = attributePattern.exec(match[2] ?? ""))) {
            const [, name, value = ""] = attributeMatch;
            attributes[name] = value;
        }

        const node = {
            tagName,
            attributes,
            classList: (attributes.class ?? "").split(/\s+/).filter(Boolean),
            children: [],
            parent: stack[stack.length - 1] ?? null,
        };

        node.parent.children.push(node);

        if (!fullTag.endsWith("/>") && !VOID_HTML_TAGS.has(tagName)) {
            stack.push(node);
        }
    }

    return root;
}

function findFirstHTMLNode(node, predicate) {
    if (predicate(node)) {
        return node;
    }

    for (const child of node.children) {
        const match = findFirstHTMLNode(child, predicate);

        if (match) {
            return match;
        }
    }

    return null;
}

function findAllHTMLNodes(node, predicate, matches = []) {
    if (predicate(node)) {
        matches.push(node);
    }

    for (const child of node.children) {
        findAllHTMLNodes(child, predicate, matches);
    }

    return matches;
}

function hasAncestorHTMLNode(node, predicate) {
    let current = node?.parent ?? null;

    while (current) {
        if (predicate(current)) {
            return true;
        }

        current = current.parent ?? null;
    }

    return false;
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

test("runtime table state keeps the displayed wavetable on the audible table while a newer request is pending", async () => {
    const { resolveRuntimeTablePresentation } = await loadPatchViewModule();

    assert.deepEqual(
        resolveRuntimeTablePresentation({
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 3,
            activeGeneration: 14,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            desiredTableIndex: 5,
            desiredIntentSerial: 8,
            hasFailure: false,
            failedTableIndex: 0,
        }),
        {
            desiredTableIndex: 5,
            presentedTableIndex: 3,
            activeTableIndex: 3,
            activeGeneration: 14,
            loadingTableIndex: null,
            loadingGeneration: null,
            isPendingSelection: true,
            isRetryableFailure: false,
            failureMessage: null,
        }
    );
});

test("runtime table state presents the loading table when there is no active audible table yet", async () => {
    const { resolveRuntimeTablePresentation } = await loadPatchViewModule();

    assert.deepEqual(
        resolveRuntimeTablePresentation({
            serviceState: 1,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: true,
            loadingTableIndex: 4,
            loadingGeneration: 15,
            desiredTableIndex: 4,
            desiredIntentSerial: 9,
            hasFailure: false,
            failedTableIndex: 0,
        }),
        {
            desiredTableIndex: 4,
            presentedTableIndex: 4,
            activeTableIndex: null,
            activeGeneration: null,
            loadingTableIndex: 4,
            loadingGeneration: 15,
            isPendingSelection: true,
            isRetryableFailure: false,
            failureMessage: null,
        }
    );
});

test("runtime table state marks an unchanged failed desired table as retryable", async () => {
    const { resolveRuntimeTablePresentation } = await loadPatchViewModule();

    assert.deepEqual(
        resolveRuntimeTablePresentation({
            serviceState: 0,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            desiredTableIndex: 6,
            desiredIntentSerial: 10,
            hasFailure: true,
            failedTableIndex: 6,
        }),
        {
            desiredTableIndex: 6,
            presentedTableIndex: 6,
            activeTableIndex: null,
            activeGeneration: null,
            loadingTableIndex: null,
            loadingGeneration: null,
            isPendingSelection: false,
            isRetryableFailure: true,
            failureMessage: "Wavetable load failed.",
        }
    );
});

test("runtime table state names a timed-out wavetable transfer failure", async () => {
    const { resolveRuntimeTablePresentation } = await loadPatchViewModule();

    assert.deepEqual(
        resolveRuntimeTablePresentation({
            serviceState: 0,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            desiredTableIndex: 6,
            desiredIntentSerial: 10,
            hasFailure: true,
            failedTableIndex: 6,
            failedGeneration: 14,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        }),
        {
            desiredTableIndex: 6,
            presentedTableIndex: 6,
            activeTableIndex: null,
            activeGeneration: null,
            loadingTableIndex: null,
            loadingGeneration: null,
            isPendingSelection: false,
            isRetryableFailure: true,
            failureMessage: "Wavetable load timed out.",
        }
    );
});

test("view table-select handler retries the failed desired table instead of pretending the value changed", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const sentEvents = [];
    const selectedTableIndices = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.patchConnection = {
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
    };
    view.tableSelect = { value: "6" };
    view.desiredTableIndex = 6;
    view.runtimeTablePresentation = { isRetryableFailure: true };
    view.sendSelectedTableIndex = (value) => {
        selectedTableIndices.push(value);
    };

    view.handleTableSelectChange();

    assert.deepEqual(sentEvents, [{ endpointID: "retryDesiredTableRequest", value: 1 }]);
    assert.deepEqual(selectedTableIndices, []);
});

test("view playback controls mirror the current MSEG seconds rate and full-shape loop state", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);

    view.msegState = {
        playback: {
            rate: { kind: "seconds", seconds: 0.25 },
            loop: { startX: 0.0, endX: 1.0 },
        },
    };
    view.msegRateInput = { value: "" };
    view.msegRateReadout = { textContent: "" };
    view.msegLauncherRateReadout = { textContent: "" };
    view.msegLauncherLoopButton = {
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
    };
    view.msegLoopButton = {
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
    };

    view.syncMsegPlaybackControls();

    assert.equal(view.msegRateInput.value, "0.250");
    assert.equal(view.msegRateReadout.textContent, "0.250 s");
    assert.equal(view.msegLauncherRateReadout.textContent, "0.250 s");
    assert.equal(view.msegLoopButton.attributes["aria-pressed"], "true");
    assert.equal(view.msegLauncherLoopButton.attributes["aria-pressed"], "true");
    assert.equal(view.msegLauncherLoopButton.attributes.title, "Loop On");
});

test("view rate input updates the controller playback seconds while preserving loop state", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const updatedPlaybacks = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.msegState = {
        playback: {
            rate: { kind: "seconds", seconds: 1.0 },
            loop: { startX: 0.0, endX: 1.0 },
            noteOffPolicy: "finish_loop",
            holdFinalValue: true,
            legatoRestarts: false,
        },
    };
    view.msegRateInput = { value: "0.375" };
    view.msegController = {
        setPlayback(playback) {
            updatedPlaybacks.push(playback);
        },
    };

    view.handleMsegRateInput();

    assert.deepEqual(updatedPlaybacks, [{
        rate: { kind: "seconds", seconds: 0.375 },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        holdFinalValue: true,
        legatoRestarts: false,
    }]);
});

test("view loop toggle switches between full-shape looping and one-shot playback", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const updatedPlaybacks = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.msegState = {
        playback: {
            rate: { kind: "seconds", seconds: 0.5 },
            loop: null,
            noteOffPolicy: "finish_loop",
            holdFinalValue: true,
            legatoRestarts: false,
        },
    };
    view.msegController = {
        setPlayback(playback) {
            updatedPlaybacks.push(playback);
        },
    };

    view.handleMsegLoopInput();
    view.msegState = { playback: updatedPlaybacks[0] };
    view.handleMsegLoopInput();

    assert.deepEqual(updatedPlaybacks, [
        {
            rate: { kind: "seconds", seconds: 0.5 },
            loop: { startX: 0.0, endX: 1.0 },
            noteOffPolicy: "finish_loop",
            holdFinalValue: true,
            legatoRestarts: false,
        },
        {
            rate: { kind: "seconds", seconds: 0.5 },
            loop: null,
            noteOffPolicy: "finish_loop",
            holdFinalValue: true,
            legatoRestarts: false,
        },
    ]);
});

test("view can open and close the reusable mseg modal without touching the keyboard row", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const toggledAttributes = new Map();
    const view = Object.create(CosimoSynthView.prototype);

    view.msegModalLayer = {
        dataset: {},
        querySelector() {
            return {
                attributes: {},
                setAttribute(name, value) {
                    this.attributes[name] = value;
                },
            };
        },
    };
    view.toggleAttribute = (name, value) => toggledAttributes.set(name, value);
    view.renderMsegEditor = () => {};

    view.openMsegModal();
    assert.equal(view.isMsegModalOpen, true);
    assert.equal(view.msegModalLayer.dataset.open, "true");
    assert.equal(toggledAttributes.get("mseg-modal-open"), true);

    view.closeMsegModal();
    assert.equal(view.isMsegModalOpen, false);
    assert.equal(view.msegModalLayer.dataset.open, "false");
    assert.equal(toggledAttributes.get("mseg-modal-open"), false);
});

test("iPhone HTML template includes the safe-area gutter CSS at the root so the main view and keyboard footer can inherit it", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const html = view.getIOSHTML();

    assert.match(html, /:host\s*\{[\s\S]*box-sizing:\s*border-box;/);
    assert.match(html, /--cosimo-ios-top-inset:\s*0px;/);
    assert.match(html, /--cosimo-ios-right-inset:\s*0px;/);
    assert.match(html, /--cosimo-ios-bottom-inset:\s*0px;/);
    assert.match(html, /--cosimo-ios-left-inset:\s*0px;/);
    assert.match(html, /--cosimo-ios-safe-top:\s*calc\(env\(safe-area-inset-top\)\s*\+\s*var\(--cosimo-ios-top-inset\)\);/);
    assert.match(html, /--cosimo-ios-safe-right:\s*calc\(env\(safe-area-inset-right\)\s*\+\s*var\(--cosimo-ios-right-inset\)\);/);
    assert.match(html, /--cosimo-ios-safe-bottom:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*var\(--cosimo-ios-bottom-inset\)\);/);
    assert.match(html, /--cosimo-ios-safe-left:\s*calc\(env\(safe-area-inset-left\)\s*\+\s*var\(--cosimo-ios-left-inset\)\);/);
    assert.match(html, /\.ios-shell\s*\{[\s\S]*box-sizing:\s*border-box;/);
    assert.match(html, /\.ios-shell\s*\{[\s\S]*padding:\s*var\(--cosimo-ios-safe-top\)\s*var\(--cosimo-ios-safe-right\)\s*var\(--cosimo-ios-safe-bottom\)\s*var\(--cosimo-ios-safe-left\);/);
    assert.match(html, /class="ios-main-view"/);
    assert.match(html, /\.ios-top-row\s*\{[\s\S]*overflow:\s*hidden;/);
    assert.match(html, /\.ios-top-row\s*\{[\s\S]*display:\s*grid;/);
    assert.match(html, /\.ios-top-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    assert.match(html, /\.ios-top-row\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
    assert.match(html, /\.ios-main-view\s*\{[\s\S]*display:\s*grid;/);
    assert.match(html, /\.ios-main-view\s*\{[\s\S]*grid-column:\s*1;/);
    assert.match(html, /\.ios-main-view\s*\{[\s\S]*grid-row:\s*1;/);
    assert.match(html, /\.mseg-modal-layer\s*\{[\s\S]*grid-column:\s*1;/);
    assert.match(html, /\.mseg-modal-layer\s*\{[\s\S]*grid-row:\s*1;/);
    assert.match(html, /:host\(\[mseg-modal-open\]\)\s+\.ios-main-view\s*\{[\s\S]*display:\s*none;/);
    assert.match(html, /\.keyboard-footer\s*\{[\s\S]*position:\s*relative;/);
    assert.match(html, /\.keyboard-footer\s*\{[\s\S]*z-index:\s*1;/);
    assert.match(html, /\.keyboard-footer\s*\{[\s\S]*background:\s*#04070f;/);
    assert.match(html, /class="keyboard-toolbar"[\s\S]*class="keyboard-host"/);
    assert.match(html, /\.keyboard-host\s*\{[\s\S]*min-height:\s*var\(--cosimo-keyboard-height\);/);
    assert.match(html, /\.keyboard\s*\{[\s\S]*height:\s*var\(--cosimo-keyboard-height\);/);
    assert.match(html, /\.keyboard\s*\{[\s\S]*border-radius:\s*14px 14px 0 0;/);
    assert.match(html, /\.keyboard\s*\{[\s\S]*padding:\s*6px 6px 0;/);
    assert.match(html, /\.mseg-modal\s*\{[\s\S]*grid-template-rows:\s*0 minmax\(0,\s*1fr\)\s*auto;/);
    assert.match(html, /\.mseg-modal-copy\s*\{\s*display:\s*none;/);
    assert.match(html, /\.mseg-modal-backdrop\s*\{[\s\S]*display:\s*none;/);
    assert.match(html, /\.mseg-modal-layer\s*\{[\s\S]*padding:\s*0;/);
    assert.match(html, /\.mseg-modal-layer\s*\{[\s\S]*position:\s*relative;/);
    assert.match(html, /\.mseg-modal-layer\s*\{[\s\S]*inset:\s*auto;/);
    assert.match(html, /\.mseg-modal\s*\{[\s\S]*position:\s*relative;/);
    assert.match(html, /\.mseg-modal\s*\{[\s\S]*min-height:\s*100%;/);
    assert.match(html, /\.ios-content\s*\{[\s\S]*padding:\s*0\s*16px;/);
    assert.match(html, /\.keyboard-footer\s*\{[\s\S]*padding:\s*0\s*12px;/);
    assert.match(html, /\.mseg-modal\s*\{[\s\S]*padding:\s*4px\s*10px\s*0;/);
    assert.doesNotMatch(html, /\.mseg-modal\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*max\(6px,\s*env\(safe-area-inset-top\)\)\s*6px\s*0\s*6px;/);
    assert.match(html, /\.mseg-modal-footer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto\s*auto;/);
    assert.match(html, /\.mseg-loop-button\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(html, /class="mseg-rate-slider"[\s\S]*aria-label="MSEG time in seconds"/);
});

test("iPhone HTML template keeps the MSEG modal outside the hidden main view and the keyboard footer in the shell footer row", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const tree = parseHTMLTree(view.getIOSHTML());
    const shell = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("ios-shell")
    );
    const topRow = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("ios-top-row")
    );
    const mainView = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("ios-main-view")
    );
    const modalLayer = findFirstHTMLNode(
        tree,
        (node) => node.attributes["data-role"] === "mseg-modal-layer"
    );
    const footer = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("keyboard-footer")
    );

    assert.ok(shell);
    assert.ok(topRow);
    assert.ok(mainView);
    assert.ok(modalLayer);
    assert.ok(footer);
    assert.equal(modalLayer.parent, topRow);
    assert.equal(hasAncestorHTMLNode(modalLayer, (node) => node === mainView), false);
    assert.equal(footer.parent, shell);
    assert.equal(hasAncestorHTMLNode(footer, (node) => node === topRow), false);
});

test("iPhone HTML template keeps the overlay picker, retry button, gesture hint, and double-canvas display stack inside the stage", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const tree = parseHTMLTree(view.getIOSHTML());
    const stage = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("wavetable-stage")
    );
    const stageCopy = findFirstHTMLNode(
        stage,
        (node) => node.classList.includes("stage-copy")
    );
    const displayStack = findFirstHTMLNode(
        stage,
        (node) => node.classList.includes("wavetable-display-stack")
    );
    const layers = findAllHTMLNodes(
        stage,
        (node) => node.classList.includes("wavetable-layer")
    );
    const displayOverlay = findFirstHTMLNode(
        stage,
        (node) => node.classList.includes("display-overlay")
    );
    const tableSelect = findFirstHTMLNode(
        stage,
        (node) => node.classList.includes("table-select-overlay")
    );
    const retryButton = findFirstHTMLNode(
        stage,
        (node) => node.classList.includes("table-retry-button")
    );
    const gestureHint = findFirstHTMLNode(
        stage,
        (node) => node.attributes["data-role"] === "stage-gesture-hint"
    );
    const heroFrameReadout = findFirstHTMLNode(
        stage,
        (node) => node.attributes["data-role"] === "hero-frame-readout"
    );

    assert.ok(stage);
    assert.ok(stageCopy);
    assert.ok(displayStack);
    assert.equal(layers.length, 2);
    assert.ok(displayOverlay);
    assert.ok(tableSelect);
    assert.ok(retryButton);
    assert.ok(gestureHint);
    assert.ok(heroFrameReadout);
    assert.equal(hasAncestorHTMLNode(tableSelect, (node) => node === stageCopy), true);
    assert.equal(hasAncestorHTMLNode(retryButton, (node) => node === stageCopy), true);
    assert.equal(hasAncestorHTMLNode(gestureHint, (node) => node === stageCopy), true);
    assert.equal(gestureHint.parent, retryButton.parent);
    assert.equal(tableSelect.attributes["aria-label"], "Select wavetable");
    assert.equal(retryButton.tagName, "button");
    assert.equal(retryButton.attributes.hidden, "");
});

test("iPhone HTML template keeps the play controls and octave toolbar in the scroll content while the piano stays in the footer", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const tree = parseHTMLTree(view.getIOSHTML());
    const iosContent = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("ios-content")
    );
    const keyboardFooter = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("keyboard-footer")
    );
    const keyboardToolbar = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("keyboard-toolbar")
    );
    const keyboardHost = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("keyboard-host")
    );
    const playModeSelect = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("play-mode-select")
    );
    const glideSlider = findFirstHTMLNode(
        tree,
        (node) => node.classList.includes("glide-time-slider")
    );

    assert.ok(iosContent);
    assert.ok(keyboardFooter);
    assert.ok(keyboardToolbar);
    assert.ok(keyboardHost);
    assert.ok(playModeSelect);
    assert.ok(glideSlider);
    assert.equal(hasAncestorHTMLNode(playModeSelect, (node) => node === iosContent), true);
    assert.equal(hasAncestorHTMLNode(glideSlider, (node) => node === iosContent), true);
    assert.equal(hasAncestorHTMLNode(keyboardToolbar, (node) => node === iosContent), true);
    assert.equal(hasAncestorHTMLNode(keyboardToolbar, (node) => node === keyboardFooter), false);
    assert.equal(keyboardHost.parent, keyboardFooter);
    assert.equal(hasAncestorHTMLNode(keyboardHost, (node) => node === iosContent), false);
    assert.equal(playModeSelect.attributes["aria-label"], "Voice mode");
    assert.equal(glideSlider.attributes["aria-label"], "Glide time");
    assert.equal(glideSlider.attributes.type, "range");
});

test("tap on an interior point deletes it while a drag moves it", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const deletedPoints = [];
    const movedPoints = [];
    const addedPoints = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.isMsegModalOpen = true;
    view.selectedMsegPointIndex = 0;
    view.renderMsegEditor = () => {};
    view.msegState = {
        shape: {
            points: [
                { x: 0.0, y: 0.0, curvePower: 0.0 },
                { x: 0.5, y: 0.5, curvePower: 0.0 },
                { x: 1.0, y: 1.0, curvePower: 0.0 },
            ],
        },
    };
    view.msegController = {
        addPoint(x, y) {
            addedPoints.push({ x, y });
        },
        movePoint(pointIndex, x, y) {
            movedPoints.push({ pointIndex, x, y });
        },
        deletePoint(pointIndex) {
            deletedPoints.push(pointIndex);
        },
        getState() {
            return view.msegState;
        },
    };
    view.msegModalSurface = {
        viewport: {
            getBoundingClientRect() {
                return { left: 0, top: 0, width: 600, height: 180 };
            },
            setPointerCapture() {},
            releasePointerCapture() {},
        },
    };

    view.beginMsegInteraction({
        pointerId: 1,
        clientX: 300,
        clientY: 90,
        preventDefault() {},
    });
    view.endMsegInteraction({
        pointerId: 1,
        preventDefault() {},
    });
    assert.deepEqual(deletedPoints, [1]);

    view.beginMsegInteraction({
        pointerId: 2,
        clientX: 300,
        clientY: 90,
        preventDefault() {},
    });
    view.updateMsegInteraction({
        pointerId: 2,
        clientX: 340,
        clientY: 80,
        preventDefault() {},
    });
    view.endMsegInteraction({
        pointerId: 2,
        preventDefault() {},
    });

    assert.equal(movedPoints.length, 1);
    assert.deepEqual(deletedPoints, [1]);
    assert.deepEqual(addedPoints, []);
});

test("iPhone MSEG modal follows the phone orientation instead of the plot box shape", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);

    view.options = { platform: "ios" };
    view.getBoundingClientRect = () => ({ width: 390, height: 844 });

    assert.equal(
        view.getMsegSurfaceOrientation({
            viewport: {
                getBoundingClientRect() {
                    return { width: 600, height: 180 };
                },
            },
        }, { showPoints: true }),
        "vertical"
    );

    view.getBoundingClientRect = () => ({ width: 844, height: 390 });

    assert.equal(
        view.getMsegSurfaceOrientation({
            viewport: {
                getBoundingClientRect() {
                    return { width: 180, height: 600 };
                },
            },
        }, { showPoints: true }),
        "horizontal"
    );
});

test("iPhone play-mode input clamps to the supported discrete values and sends the clamped selection", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const sentEvents = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.playModeSelect = { value: "99" };
    view.patchConnection = {
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
    };

    view.handlePlayModeInput();

    assert.equal(view.currentPlayMode, 2);
    assert.equal(view.playModeSelect.value, "2");
    assert.deepEqual(sentEvents, [{ endpointID: "playMode", value: 2 }]);
});

test("iPhone glide input clamps to the supported range, updates the readout, and sends the clamped value", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const sentEvents = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.glideTimeInput = { value: "9.75" };
    view.glideTimeReadout = { textContent: "" };
    view.patchConnection = {
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
    };

    view.handleGlideTimeInput();

    assert.equal(view.currentGlideTime, 2);
    assert.equal(view.glideTimeInput.value, "2.000");
    assert.equal(view.glideTimeReadout.textContent, "2.000 s");
    assert.deepEqual(sentEvents, [{ endpointID: "glideTime", value: 2 }]);
});

test("iPhone keyboard octave controls clamp the root note and keep the footer range label in sync", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const keyboardAttributes = {};
    const view = Object.create(CosimoSynthView.prototype);

    view.currentLayout = { noteCount: 18 };
    view.keyboardMinRootNote = 12;
    view.keyboardMaxRootNote = 72;
    view.keyboardRootNote = 12;
    view.keyboard = {
        setAttribute(name, value) {
            keyboardAttributes[name] = value;
        },
    };
    view.octaveReadout = { textContent: "" };
    view.octaveDownButton = { disabled: false };
    view.octaveUpButton = { disabled: false };

    view.syncKeyboardOctaveControls();
    assert.equal(view.octaveReadout.textContent, "C0 - F1");
    assert.equal(view.octaveDownButton.disabled, true);
    assert.equal(view.octaveUpButton.disabled, false);

    view.setKeyboardRootNote(36);
    assert.equal(view.keyboardRootNote, 36);
    assert.equal(keyboardAttributes["root-note"], "36");
    assert.equal(view.octaveReadout.textContent, "C2 - F3");
    assert.equal(view.octaveDownButton.disabled, false);
    assert.equal(view.octaveUpButton.disabled, false);

    view.setKeyboardRootNote(999);
    assert.equal(view.keyboardRootNote, 72);
    assert.equal(keyboardAttributes["root-note"], "72");
    assert.equal(view.octaveReadout.textContent, "C5 - F6");
    assert.equal(view.octaveUpButton.disabled, true);
});

test("iPhone keyboard mount does not auto-focus the footer piano or install desktop mouse focus", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const focusCalls = [];
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    class FakePianoKeyboard extends HTMLElement {
        constructor() {
            super();
            this.classList = { add() {} };
            this.shadowRoot = {
                querySelector() {
                    return {
                        focus() {
                            focusCalls.push("keyboard-focus");
                        },
                    };
                },
            };
            this.listeners = [];
        }

        setAttribute() {}

        attachToPatchConnection() {}

        addEventListener(type) {
            this.listeners.push(type);
        }
    }

    try {
        globalThis.requestAnimationFrame = (callback) => {
            callback(0);
            return 1;
        };
        globalThis.cancelAnimationFrame = () => {};

        view.options = { platform: "ios" };
        view.patchConnection = {
            utilities: {
                PianoKeyboard: FakePianoKeyboard,
            },
        };
        view.currentLayout = {
            keyboardNaturalNoteWidth: 22,
            keyboardAccidentalWidth: 12,
            noteCount: 18,
        };
        view.keyboardRootNote = 36;
        view.keyboardHost = {
            innerHTML: "",
            appendChild(child) {
                this.child = child;
            },
        };
        view.getKeyboardStyle = () => "test-ios";
        view.syncKeyboardGeometry = () => {};
        view.syncKeyboardOctaveControls = () => {};
        view.focusKeyboard = () => {
            focusCalls.push("view-focus");
        };
        view.hint = { textContent: "" };

        view.buildKeyboard();

        assert.deepEqual(focusCalls, []);
        assert.ok(view.keyboardHost.child);
        assert.deepEqual(view.keyboard.listeners, []);
    } finally {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
});

test("iPhone stage drag ignores picker touches so opening the table picker does not start a scan gesture", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const pointerCaptures = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.displayViewport = {
        getBoundingClientRect() {
            return { width: 320, height: 240 };
        },
        setPointerCapture(pointerId) {
            pointerCaptures.push(pointerId);
        },
    };

    view.beginDisplayDrag({
        pointerId: 7,
        clientX: 180,
        clientY: 120,
        target: {
            closest(selector) {
                return selector === ".bank-picker-trigger" ? {} : null;
            },
        },
        preventDefault() {
            throw new Error("The picker tap should not become a display drag");
        },
    });

    assert.equal(view.activeDisplayDrag, undefined);
    assert.deepEqual(pointerCaptures, []);
});

test("iPhone horizontal stage swipe commits the adjacent wavetable without starting a position gesture", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const gestureStarts = [];
    const gestureEnds = [];
    const selectedTableIndices = [];
    const pointerCaptures = [];
    const pointerReleases = [];
    let preloadIndex = null;
    let resetCalls = 0;
    const view = Object.create(CosimoSynthView.prototype);

    view.patchConnection = {
        sendParameterGestureStart(endpointID) {
            gestureStarts.push(endpointID);
        },
        sendParameterGestureEnd(endpointID) {
            gestureEnds.push(endpointID);
        },
    };
    view.displayViewport = {
        getBoundingClientRect() {
            return { width: 320, height: 240 };
        },
        setPointerCapture(pointerId) {
            pointerCaptures.push(pointerId);
        },
        releasePointerCapture(pointerId) {
            pointerReleases.push(pointerId);
        },
    };
    view.factoryBankCatalog = { tables: [{}, {}, {}, {}, {}] };
    view.currentTableIndex = 2;
    view.currentValue = 0.25;
    view.preloadAdjacentTables = (tableIndex) => {
        preloadIndex = tableIndex;
    };
    view.getDisplayStageWidth = () => 320;
    view.getActiveDisplaySlot = () => null;
    view.getInactiveDisplaySlot = () => null;
    view.resetDisplayLayerPositions = () => {
        resetCalls += 1;
    };
    view.sendSelectedTableIndex = (nextIndex) => {
        selectedTableIndices.push(nextIndex);
    };

    view.beginDisplayDrag({
        pointerId: 3,
        clientX: 200,
        clientY: 120,
        target: {
            closest() {
                return null;
            },
        },
        preventDefault() {},
    });
    view.updateDisplayDrag({
        pointerId: 3,
        clientX: 100,
        clientY: 126,
        preventDefault() {},
    });
    view.endDisplayDrag({
        pointerId: 3,
        preventDefault() {},
    });

    assert.equal(preloadIndex, 2);
    assert.deepEqual(pointerCaptures, [3]);
    assert.deepEqual(pointerReleases, [3]);
    assert.deepEqual(gestureStarts, []);
    assert.deepEqual(gestureEnds, []);
    assert.deepEqual(selectedTableIndices, [3]);
    assert.equal(resetCalls, 1);
    assert.equal(view.activeDisplayDrag, null);
});

test("iPhone vertical stage drag sends a wavetable-position gesture and the mapped normalized position", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const gestureStarts = [];
    const gestureEnds = [];
    const sentEvents = [];
    const displayedValues = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.patchConnection = {
        sendParameterGestureStart(endpointID) {
            gestureStarts.push(endpointID);
        },
        sendParameterGestureEnd(endpointID) {
            gestureEnds.push(endpointID);
        },
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
    };
    view.displayViewport = {
        getBoundingClientRect() {
            return { width: 320, height: 200 };
        },
        setPointerCapture() {},
        releasePointerCapture() {},
    };
    view.currentTableIndex = 1;
    view.currentValue = 0.25;
    view.hasDisplayedValue = false;
    view.preloadAdjacentTables = () => {};
    view.setDisplayedValue = (value) => {
        displayedValues.push(value);
    };

    view.beginDisplayDrag({
        pointerId: 4,
        clientX: 120,
        clientY: 300,
        target: {
            closest() {
                return null;
            },
        },
        preventDefault() {},
    });
    view.updateDisplayDrag({
        pointerId: 4,
        clientX: 122,
        clientY: 250,
        preventDefault() {},
    });
    view.endDisplayDrag({
        pointerId: 4,
        preventDefault() {},
    });

    assert.deepEqual(gestureStarts, ["wavetablePosition"]);
    assert.deepEqual(gestureEnds, ["wavetablePosition"]);
    assert.deepEqual(sentEvents, [{ endpointID: "wavetablePosition", value: 0.5 }]);
    assert.deepEqual(displayedValues, [0.5]);
});

test("layout metrics exporter reports a whole-screen bottom gutter when the keyboard sits above the viewport bottom", async () => {
    const { collectCosimoLayoutMetrics } = await loadPatchViewModule();
    const keyboard = createMetricElement({
        className: "keyboard",
        rect: { top: 751, left: 12, right: 381, bottom: 845, width: 369, height: 94 },
    });
    const keyboardHost = createMetricElement({
        className: "keyboard-host",
        children: [keyboard],
        rect: { top: 751, left: 12, right: 381, bottom: 845, width: 369, height: 94 },
        queries: {
            ".keyboard": keyboard,
        },
    });
    const footer = createMetricElement({
        className: "keyboard-footer",
        children: [keyboardHost],
        rect: { top: 751, left: 0, right: 393, bottom: 845, width: 393, height: 94 },
        queries: {
            ".keyboard-host": keyboardHost,
            ".keyboard": keyboard,
        },
    });
    const topRow = createMetricElement({
        className: "ios-top-row",
        rect: { top: 7, left: 0, right: 393, bottom: 751, width: 393, height: 744 },
    });
    const mainView = createMetricElement({
        className: "ios-main-view",
        rect: { top: 7, left: 0, right: 393, bottom: 751, width: 393, height: 744 },
    });
    const scroll = createMetricElement({
        className: "ios-scroll",
        rect: { top: 7, left: 0, right: 393, bottom: 751, width: 393, height: 744 },
    });
    const content = createMetricElement({
        className: "ios-content",
        rect: { top: 7, left: 0, right: 393, bottom: 751, width: 393, height: 744 },
    });
    const shell = createMetricElement({
        className: "ios-shell",
        children: [topRow, footer],
        rect: { top: 7, left: 0, right: 393, bottom: 845, width: 393, height: 838 },
        queries: {
            ".ios-top-row": topRow,
            ".ios-main-view": mainView,
            ".ios-scroll": scroll,
            ".ios-content": content,
            ".keyboard-footer": footer,
            ".keyboard-host": keyboardHost,
            ".keyboard": keyboard,
        },
    });
    const host = createMetricElement({
        tagName: "COSIMO-SYNTH-VIEW",
        rect: { top: 0, left: 0, right: 393, bottom: 852, width: 393, height: 852 },
    });

    host.shadowRoot = {
        querySelector(selector) {
            if (selector === ".ios-shell") {
                return shell;
            }

            return shell.querySelector(selector);
        },
    };

    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousVisualViewport = globalThis.visualViewport;
    const previousGetComputedStyle = globalThis.getComputedStyle;

    globalThis.document = {
        querySelector(selector) {
            return selector === "cosimo-synth-view" ? host : null;
        },
    };
    globalThis.window = { innerWidth: 393, innerHeight: 852, scrollX: 0, scrollY: 0 };
    globalThis.visualViewport = { width: 393, height: 852 };
    globalThis.getComputedStyle = (element) => element.computedStyle;

    try {
        const metrics = collectCosimoLayoutMetrics();

        assert.equal(metrics.viewport.height, 852);
        assert.equal(metrics.keyboardRect.bottom, 845);
        assert.equal(metrics.footerRect.bottom, 845);
        assert.equal(metrics.keyboardBottomGap, 7);
        assert.equal(metrics.footerBottomGap, 7);
        assert.deepEqual(metrics.footerChildren, ["keyboard-host"]);
    } finally {
        globalThis.document = previousDocument;
        globalThis.window = previousWindow;
        globalThis.visualViewport = previousVisualViewport;
        globalThis.getComputedStyle = previousGetComputedStyle;
    }
});

test("tap on an endpoint does not delete it and tapping empty space adds a point", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const deletedPoints = [];
    const addedPoints = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.isMsegModalOpen = true;
    view.renderMsegEditor = () => {};
    view.msegState = {
        shape: {
            points: [
                { x: 0.0, y: 0.0, curvePower: 0.0 },
                { x: 1.0, y: 1.0, curvePower: 0.0 },
            ],
        },
    };
    view.msegController = {
        addPoint(x, y) {
            addedPoints.push({ x, y });
        },
        deletePoint(pointIndex) {
            deletedPoints.push(pointIndex);
        },
        getState() {
            return {
                shape: {
                    points: [
                        { x: 0.0, y: 0.0, curvePower: 0.0 },
                        { x: 0.33, y: 0.66, curvePower: 0.0 },
                        { x: 1.0, y: 1.0, curvePower: 0.0 },
                    ],
                },
            };
        },
    };
    view.msegModalSurface = {
        viewport: {
            getBoundingClientRect() {
                return { left: 0, top: 0, width: 600, height: 180 };
            },
            setPointerCapture() {},
            releasePointerCapture() {},
        },
    };

    view.beginMsegInteraction({
        pointerId: 1,
        clientX: 22,
        clientY: 158,
        preventDefault() {},
    });
    view.endMsegInteraction({
        pointerId: 1,
        preventDefault() {},
    });
    assert.deepEqual(deletedPoints, []);

    view.beginMsegInteraction({
        pointerId: 2,
        clientX: 200,
        clientY: 60,
        preventDefault() {},
    });
    assert.equal(addedPoints.length, 1);
});

test("iPhone display-bank load failures keep the stage unavailable message short and add the native library recovery hint", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const displayStates = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.options = { platform: "ios" };
    view.resourceClient = {
        async readJSON(requestedPath) {
            assert.equal(requestedPath, "assets/factory-bank-catalog.json");
            return {
                tables: [
                    {
                        tableId: "broken",
                        name: "Broken",
                        frameCount: 16,
                        sourceWav: "assets/factory_sources/missing.wav",
                    },
                ],
            };
        },
        async readAudio(requestedPath) {
            assert.equal(requestedPath, "assets/factory_sources/missing.wav");
            throw new Error("Missing factory source WAV");
        },
    };
    view.displayFramesCache = new Map();
    view.displayFramesLoading = new Map();
    view.bankReadout = { textContent: "" };
    view.setDisplayState = (state, message) => {
        displayStates.push({ state, message });
    };

    await assert.rejects(
        () => view.fetchDisplayBank(0, { showLoadingState: true }),
        /Missing factory source WAV/
    );

    assert.deepEqual(displayStates, [
        { state: "loading", message: "Loading wavetable bank…" },
        {
            state: "error",
            message: "Could not load wavetable bank: Missing factory source WAV. Import the factory wavetable zip from the native library bar, then reopen the patch.",
        },
    ]);
    assert.equal(view.bankReadout.textContent, "Display unavailable");
});

test("view readout names the wavetable load failure and exposes the retry button", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);
    const tableMeta = { name: "Table 3" };

    view.options = { platform: "desktop" };
    view.bankReadout = { textContent: "" };
    view.tableRetryButton = { hidden: true, disabled: true };
    view.displayStatus = { textContent: "" };
    view.tableErrorBanner = { hidden: true, textContent: "" };
    view.runtimeTablePresentation = {
        isRetryableFailure: true,
        isPendingSelection: false,
        failureMessage: "Wavetable load timed out.",
    };
    view.latestRuntimeTableState = {
        desiredTableIndex: 3,
        desiredIntentSerial: 10,
        serviceState: 0,
        hasActive: false,
        activeTableIndex: 0,
        activeGeneration: 0,
        hasLoading: false,
        loadingTableIndex: 0,
        loadingGeneration: 0,
        hasFailure: true,
        failedTableIndex: 3,
        failedGeneration: 14,
        failureScope: 1,
        failurePhase: 3,
        failureReasonCode: 2,
    };
    view.latchedRuntimeFailureState = null;
    view.currentTableIndex = 3;
    view.desiredTableIndex = 3;
    view.factoryBankCatalog = {
        tables: [
            { name: "Table 0" },
            { name: "Table 1" },
            { name: "Table 2" },
            tableMeta,
        ],
    };
    view.getSelectedTableMeta = () => tableMeta;
    view.getDesiredTableMeta = () => tableMeta;

    view.updateBankReadout();

    assert.equal(view.bankReadout.textContent, "Factory bank • Table 3 • Wavetable load timed out.");
    assert.equal(view.displayStatus.textContent, "Wavetable load timed out.");
    assert.equal(
        view.tableErrorBanner.textContent,
        "Table 3 failed during mip transfer (committed load, generation 14, timeout)."
    );
    assert.equal(view.tableErrorBanner.hidden, false);
    assert.equal(view.tableRetryButton.hidden, false);
    assert.equal(view.tableRetryButton.disabled, false);
});

test("view keeps the last wavetable failure visible until the requested table actually becomes active", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const view = Object.create(CosimoSynthView.prototype);

    view.options = { platform: "ios" };
    view.bankReadout = { textContent: "" };
    view.tableRetryButton = { hidden: true, disabled: true };
    view.displayStatus = { textContent: "" };
    view.tableErrorBanner = { hidden: true, textContent: "" };
    view.factoryBankCatalog = {
        tables: [
            { name: "Table 0" },
            { name: "Table 1" },
        ],
    };
    view.currentTableIndex = 0;
    view.desiredTableIndex = 1;
    view.hasRuntimeTableState = false;
    view.applyRuntimeTablePresentation = () => {};
    view.getSelectedTableMeta = () => view.factoryBankCatalog.tables[view.currentTableIndex];
    view.getDesiredTableMeta = () => view.factoryBankCatalog.tables[view.desiredTableIndex];

    view.handleRuntimeTableState({
        desiredTableIndex: 1,
        desiredIntentSerial: 4,
        serviceState: 0,
        hasActive: false,
        activeTableIndex: 0,
        activeGeneration: 0,
        hasLoading: false,
        loadingTableIndex: 0,
        loadingGeneration: 0,
        hasFailure: true,
        failedTableIndex: 1,
        failedGeneration: 12,
        failureScope: 1,
        failurePhase: 3,
        failureReasonCode: 2,
    });

    assert.equal(view.tableErrorBanner.hidden, false);
    assert.equal(
        view.tableErrorBanner.textContent,
        "Table 1 failed during mip transfer (committed load, generation 12, timeout)."
    );

    view.handleRuntimeTableState({
        desiredTableIndex: 1,
        desiredIntentSerial: 5,
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
    });

    assert.equal(view.tableErrorBanner.hidden, false);
    assert.equal(view.displayStatus.textContent, "Wavetable load timed out.");

    view.currentTableIndex = 1;
    view.handleRuntimeTableState({
        desiredTableIndex: 1,
        desiredIntentSerial: 5,
        serviceState: 2,
        hasActive: true,
        activeTableIndex: 1,
        activeGeneration: 13,
        hasLoading: false,
        loadingTableIndex: 0,
        loadingGeneration: 0,
        hasFailure: false,
        failedTableIndex: 0,
        failedGeneration: 0,
        failureScope: 0,
        failurePhase: 0,
        failureReasonCode: 0,
    });

    assert.equal(view.tableErrorBanner.hidden, true);
});

test("view can explicitly request a runtime-state sync without relying on status side effects", async () => {
    const { CosimoSynthView } = await loadPatchViewModule();
    const sentEvents = [];
    const view = Object.create(CosimoSynthView.prototype);

    view.patchConnection = {
        sendEventOrValue(endpointID, value) {
            sentEvents.push({ endpointID, value });
        },
    };

    view.requestRuntimeTableSync();

    assert.deepEqual(sentEvents, [{ endpointID: "runtimeSyncRequest", value: 1 }]);
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
    assert.deepEqual(DEFAULT_WAVETABLE_THEME.meshColor, DEFAULT_PATCH_THEME.accentBlueRGB);
    assert.equal(getPatchThemeCSSVariables()["--cosimo-accent-blue"], DEFAULT_PATCH_THEME.accentBlue);
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
