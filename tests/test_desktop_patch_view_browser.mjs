import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import {
    ARTICULATION_STATE_KEY,
    normalizeArticulationBank,
} from "../patch_gui/articulations.js";
import { deserializeMsegShape, renderMsegShape } from "../patch_gui/mseg.js";
import { deserializeModulationState } from "../patch_gui/modulation.js";

import {
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
} from "./helpers/desktop_harness_browser.mjs";

let server;
let builtBundleServer;
let browser;
const TEST_SAMPLES_PER_FRAME = 2048;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;

function expectedMsegPreviewProgressClipWidth(previewState, progress) {
    const plotWidth = Math.max(1, previewState.width - (MSEG_PREVIEW_HORIZONTAL_PADDING_PX * 2));
    return plotWidth * progress;
}

function buildShortMidi(status, noteNumber, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

function readStoredModulationState(snapshot) {
    return deserializeModulationState(snapshot.storedState["modulation.v2"]);
}

function readStoredArticulationBank(snapshot) {
    return normalizeArticulationBank(snapshot.storedState[ARTICULATION_STATE_KEY]);
}

function readStoredMsegShape(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].shapeA;
}

function readStoredMsegPlayback(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].playback;
}

function readStoredRouteAmount(snapshot, sourceSlot, targetKind) {
    const route = readStoredModulationState(snapshot).routes.find((candidate) => (
        candidate.enabled !== false
        && candidate.sourceKind === "mseg"
        && candidate.sourceSlot === sourceSlot
        && candidate.targetKind === targetKind
    ));

    return Number(route?.amount ?? 0);
}

function routeSummary(route) {
    return {
        enabled: route.enabled,
        sourceKind: route.sourceKind,
        sourceSlot: route.sourceSlot,
        polarity: route.polarity,
        targetKind: route.targetKind,
        amount: route.amount,
    };
}

function routeSummaries(routes) {
    return routes.map((route) => routeSummary(route));
}

function buildDistortionScopeFixture({ amplitude = 1.62, sampleCount = 256 } = {}) {
    const inputSamples = [];
    const outputSamples = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const phase = (index / Math.max(1, sampleCount - 1)) * Math.PI * 6;
        const envelope = 0.82 + (0.18 * Math.cos((index / Math.max(1, sampleCount - 1)) * Math.PI * 2));
        const input = amplitude * envelope * Math.sin(phase);
        const output = input / Math.pow(1 + Math.pow(Math.abs(input), 8), 1 / 8);

        inputSamples.push(input);
        outputSamples.push(output);
    }

    const inputPeak = Math.max(...inputSamples.map((sample) => Math.abs(sample)));
    const outputPeak = Math.max(...outputSamples.map((sample) => Math.abs(sample)));
    const removedPeak = Math.max(...inputSamples.map((sample, index) => (
        Math.abs(sample - outputSamples[index])
    )));

    return {
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak,
        outputPeak,
        removedPeak,
        inputSamples,
        outputSamples,
    };
}

function buildDistortionHistoryFixture({ amplitude = 1.7, binCount = 160 } = {}) {
    const inputMins = [];
    const inputMaxs = [];
    const outputMins = [];
    const outputMaxs = [];

    for (let index = 0; index < binCount; index += 1) {
        const normalized = index / Math.max(1, binCount - 1);
        const motion = 0.2 + (0.8 * Math.abs(Math.sin(normalized * Math.PI * 5.2)));
        const inputPeak = amplitude * motion;
        const outputPeak = inputPeak / Math.pow(1 + Math.pow(inputPeak, 8), 1 / 8);

        inputMins.push(-inputPeak);
        inputMaxs.push(inputPeak);
        outputMins.push(-outputPeak);
        outputMaxs.push(outputPeak);
    }

    return {
        sampleRateHz: 44_100,
        horizonMs: 2_000,
        binDurationMs: 12.5,
        binCount,
        validBinCount: binCount,
        inputMins,
        inputMaxs,
        outputMins,
        outputMaxs,
    };
}

async function dispatchInputValueChange(locator, nextValue) {
    await locator.evaluate((element, value) => {
        if (!(element instanceof HTMLInputElement)) {
            throw new Error("Expected an HTMLInputElement.");
        }

        const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

        if (!setNativeValue) {
            throw new Error("Expected HTMLInputElement.prototype.value setter.");
        }

        setNativeValue.call(element, String(value));
        element.dispatchEvent(new Event("input", { bubbles: true }));
    }, String(nextValue));
}

async function clickFilterGraphAt(page, normalizedX, normalizedY) {
    const graph = page.locator('[data-role="filter-response-graph"]');
    const box = await graph.boundingBox();

    if (!box) {
        throw new Error("Expected filter response graph bounding box.");
    }

    const targetX = box.x + (box.width * normalizedX);
    const targetY = box.y + (box.height * normalizedY);

    await page.mouse.click(targetX, targetY);
}

async function dragFilterHandleBy(page, deltaX, deltaY) {
    const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
    const box = await handle.boundingBox();

    if (!box) {
        throw new Error("Expected filter response handle bounding box.");
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

async function dragEnvelopeHandleBy(page, dataRole, deltaX, deltaY) {
    const handle = page.locator(`[data-role="${dataRole}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();

    if (!box) {
        throw new Error(`Expected envelope handle bounding box for ${dataRole}.`);
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

async function dragLocatorBy(page, locator, deltaX, deltaY) {
    const box = await locator.boundingBox();

    if (!box) {
        throw new Error("Expected locator bounding box.");
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();
}

async function choosePrototypeSelectOption(page, buttonLabel, optionLabel) {
    await page.getByRole("button", { name: buttonLabel }).click();
    await page.getByRole("button", { name: `${buttonLabel} ${optionLabel}` }).click();
}

async function waitForHarnessSnapshot(page, description, predicate, {
    attempts = 80,
    delayMs = 50,
} = {}) {
    let lastSnapshot = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastSnapshot = await getHarnessSnapshot(page);
        if (predicate(lastSnapshot)) {
            return lastSnapshot;
        }
        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for ${description}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function waitForPageValue(page, description, readValue, predicate, {
    attempts = 80,
    delayMs = 50,
} = {}) {
    let lastValue = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastValue = await page.evaluate(readValue);
        if (predicate(lastValue)) {
            return lastValue;
        }
        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}`);
}

async function waitForReactFrames(page, frameCount = 2) {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
}

async function dragArticulationCardToLane(page, articulationId, lane, targetPosition, {
    afterDragOver = null,
} = {}) {
    const card = page.locator(`[data-role="articulation-card"][data-articulation-id="${articulationId}"]`);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer });
    await lane.dispatchEvent("dragover", { dataTransfer, clientX: targetPosition.x, clientY: targetPosition.y });
    if (typeof afterDragOver === "function") {
        await afterDragOver();
    }
    await lane.dispatchEvent("drop", { dataTransfer, clientX: targetPosition.x, clientY: targetPosition.y });
    await dataTransfer.dispose();
}

async function previewArticulationCardDragOver(page, articulationId, lane, targetPosition) {
    const card = page.locator(`[data-role="articulation-card"][data-articulation-id="${articulationId}"]`);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await card.dispatchEvent("dragstart", { dataTransfer });
    await lane.dispatchEvent("dragover", {
        dataTransfer,
        clientX: targetPosition.x,
        clientY: targetPosition.y,
    });
    const previewOperation = await page.locator('[data-role="articulation-placement-preview"]').getAttribute("data-operation");
    await dataTransfer.dispose();

    return previewOperation;
}

async function readDesktopRangeSegments(page) {
    return page.locator('[data-role="articulation-range-segment"]').evaluateAll((segments) => (
        segments.map((segment) => ({
            articulationId: segment.getAttribute("data-articulation-id"),
            min: Number(segment.getAttribute("data-range-min")),
            max: Number(segment.getAttribute("data-range-max")),
            isPreview: segment.getAttribute("data-preview") === "true",
            isPreviewAffected: segment.getAttribute("data-preview-affected") === "true",
            text: segment.innerText.replace(/\s+/g, " ").trim(),
        }))
    ));
}

async function readDesktopRangeViewport(page) {
    const lane = page.locator('[data-role="articulation-range-lane"]').first();
    return lane.evaluate((element) => ({
        index: Number(element.getAttribute("data-viewport-index")),
        min: Number(element.getAttribute("data-viewport-min")),
        max: Number(element.getAttribute("data-viewport-max")),
        heldValue: element.getAttribute("data-held-value"),
    }));
}

async function openHarnessPage({
    beforeGoto = null,
} = {}) {
    const page = await browser.newPage();

    if (typeof beforeGoto === "function") {
        await beforeGoto(page);
    }

    await page.goto(server.baseUrl, { waitUntil: "commit" });
    await waitForHarnessReady(page);
    return page;
}

async function showVoiceControls(page) {
    await page.getByRole("button", { name: "Voice" }).click();
    await page.locator('[aria-label="Glide"]').waitFor({ state: "visible" });
}

async function openBuiltDesktopBundlePage() {
    const page = await browser.newPage();

    await page.goto(builtBundleServer.baseUrl, { waitUntil: "domcontentloaded" });
    await page.setContent(`
        <!doctype html>
        <html>
            <body style="margin:0;background:#02040b;">
                <div id="mount" style="width:100vw;height:100vh;"></div>
            </body>
        </html>
    `);

    await page.evaluate(async () => {
        class TestPianoKeyboard extends HTMLElement {
            notes = [];
            naturalWidth = 22;
            accidentalWidth = 13;
            debug = {
                attachCalls: [],
                detachCount: 0,
            };

            handleExternalMIDI() {}
            handleKey() {}
            allNotesOff() {}
            attachToPatchConnection(_patchConnection, endpointID) {
                this.debug.attachCalls.push({ endpointID });
            }
            detachPatchConnection() {
                this.debug.detachCount += 1;
            }
            refreshHTML() {}
            bindRenderedTouchHandlers() {}
            refreshActiveNoteElements() {}
        }

        const runtimeState = {
            dspSessionId: 1,
            desiredTableIndex: 0,
            desiredIntentSerial: 1,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        };
        const parameterValues = new Map([
            ["wavetablePosition", 0.28],
            ["wavetableSelect", 0],
            ["playMode", 0],
            ["glideTime", 0.15],
        ]);
        const resourceReads = [];
        const sentMessages = [];
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const addMapListener = (map, key, listener) => {
            const listeners = map.get(key) ?? new Set();
            listeners.add(listener);
            map.set(key, listeners);
        };
        const emitEndpoint = (endpointID, value) => {
            endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
        };

        const patchConnection = {
            utilities: {
                PianoKeyboard: TestPianoKeyboard,
                ParameterControls: {},
            },
            getResourceAddress(path) {
                const normalizedPath = path.startsWith("/") ? path : `/${path}`;
                return new URL(normalizedPath, window.location.href).toString();
            },
            addParameterListener(endpointID, listener) {
                addMapListener(parameterListeners, endpointID, listener);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    const value = parameterValues.get(endpointID) ?? 0;
                    parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
                });
            },
            sendEventOrValue(endpointID, value) {
                sentMessages.push({ endpointID, value });
                parameterValues.set(endpointID, value);
                parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

                if (endpointID === "runtimeSyncRequest") {
                    emitEndpoint("runtimeState", runtimeState);
                }
            },
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            addEndpointListener(endpointID, listener) {
                addMapListener(endpointListeners, endpointID, listener);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            addStatusListener(listener) {
                statusListeners.add(listener);
            },
            removeStatusListener(listener) {
                statusListeners.delete(listener);
            },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    statusListeners.forEach((listener) => listener({ details: { inputs: [] } }));
                });
            },
            addStoredStateValueListener(listener) {
                storedStateListeners.add(listener);
            },
            removeStoredStateValueListener(listener) {
                storedStateListeners.delete(listener);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({}));
            },
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    storedStateListeners.forEach((listener) => listener({ key, value: undefined }));
                });
            },
        };

        const createPatchView = (await import("/patch_gui/desktop/index.js")).default;
        const {
            createStoredStateRuntimeMirror,
        } = await import("/patch_gui/stored-state-runtime-mirror.js");
        const {
            MODULATION_STATE_KEY,
            buildModulationRuntimeEvents,
            deserializeModulationState,
        } = await import("/patch_gui/modulation.js");
        const modulationRuntimeMirror = createStoredStateRuntimeMirror(patchConnection, {
            stateKey: MODULATION_STATE_KEY,
            runtimeEndpointDependencies: [{
                endpointID: "runtimeState",
                required: true,
                mapValue: (value) => Number(value?.dspSessionId) || 0,
            }],
            applyDefaultRuntimeStateWhenMissing: true,
            deserializeStoredState: deserializeModulationState,
            buildRuntimeEvents: ({ state }) => buildModulationRuntimeEvents(state),
        });
        modulationRuntimeMirror.start();
        const patchView = await createPatchView(patchConnection);
        const mountPoint = document.getElementById("mount");

        if (!mountPoint) {
            throw new Error("Built desktop bundle mount point is missing.");
        }

        window.__COSIMO_BUILT_DESKTOP_DEBUG__ = {
            getSnapshot() {
                return {
                    sentMessages: sentMessages.map(({ endpointID, value }) => ({ endpointID, value })),
                    keyboardDebug: document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                        ?.querySelector(".keyboard")?.debug ?? null,
                };
            },
        };

        mountPoint.replaceChildren(patchView);
    });

    return page;
}

async function openDesktopEntryPageWithInjectedResourceClient() {
    const page = await browser.newPage();

    await page.goto(server.baseUrl, { waitUntil: "domcontentloaded" });
    await page.setContent(`
        <!doctype html>
        <html>
            <body style="margin:0;background:#02040b;">
                <div id="mount" style="width:100vw;height:100vh;"></div>
            </body>
        </html>
    `);

    await page.evaluate(async (samplesPerFrame) => {
        class TestPianoKeyboard extends HTMLElement {
            handleExternalMIDI() {}
            handleKey() {}
            allNotesOff() {}
            attachToPatchConnection() {}
            detachPatchConnection() {}
            refreshHTML() {}
            bindRenderedTouchHandlers() {}
            refreshActiveNoteElements() {}
        }

        const resourceSamples = new Float32Array(samplesPerFrame);
        for (let index = 0; index < resourceSamples.length; index += 1) {
            resourceSamples[index] = Math.sin((index / resourceSamples.length) * Math.PI * 2);
        }

        const parameterValues = new Map([
            ["wavetablePosition", 0.28],
            ["wavetableSelect", 0],
            ["playMode", 0],
            ["glideTime", 0.15],
        ]);
        const resourceReads = [];
        const sentMessages = [];
        const parameterListeners = new Map();
        const endpointListeners = new Map();
        const statusListeners = new Set();
        const storedStateListeners = new Set();
        const addMapListener = (map, key, listener) => {
            const listeners = map.get(key) ?? new Set();
            listeners.add(listener);
            map.set(key, listeners);
        };
        const emitEndpoint = (endpointID, value) => {
            endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
        };
        const runtimeState = {
            desiredTableIndex: 0,
            desiredIntentSerial: 1,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        };

        const patchConnection = {
            utilities: {
                PianoKeyboard: TestPianoKeyboard,
                ParameterControls: {},
            },
            getResourceAddress() {
                throw new Error("patchConnection resource access should not be used when an explicit resourceClient is injected");
            },
            addParameterListener(endpointID, listener) {
                addMapListener(parameterListeners, endpointID, listener);
            },
            removeParameterListener(endpointID, listener) {
                parameterListeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => {
                    const value = parameterValues.get(endpointID) ?? 0;
                    parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
                });
            },
            sendEventOrValue(endpointID, value) {
                sentMessages.push({ endpointID, value });
                parameterValues.set(endpointID, value);
                parameterListeners.get(endpointID)?.forEach((listener) => listener(value));

                if (endpointID === "runtimeSyncRequest") {
                    emitEndpoint("runtimeState", runtimeState);
                }
            },
            sendParameterGestureStart() {},
            sendParameterGestureEnd() {},
            addEndpointListener(endpointID, listener) {
                addMapListener(endpointListeners, endpointID, listener);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            addStatusListener(listener) {
                statusListeners.add(listener);
            },
            removeStatusListener(listener) {
                statusListeners.delete(listener);
            },
            requestStatusUpdate() {
                queueMicrotask(() => {
                    statusListeners.forEach((listener) => listener({ details: { inputs: [] } }));
                });
            },
            addStoredStateValueListener(listener) {
                storedStateListeners.add(listener);
            },
            removeStoredStateValueListener(listener) {
                storedStateListeners.delete(listener);
            },
            requestFullStoredState(callback) {
                queueMicrotask(() => callback({}));
            },
            requestStoredStateValue(key) {
                queueMicrotask(() => {
                    storedStateListeners.forEach((listener) => listener({ key, value: undefined }));
                });
            },
        };

        const resourceClient = {
            async readText(path) {
                resourceReads.push({ method: "readText", path });
                return JSON.stringify(await this.readJSON(path));
            },
            async readJSON(path) {
                resourceReads.push({ method: "readJSON", path });
                if (path !== "assets/factory-bank-catalog.json") {
                    throw new Error(`Unexpected JSON resource path: ${path}`);
                }

                return {
                    tables: [{
                        tableId: "explicit-client-table",
                        name: "Explicit Client Table",
                        frameCount: 1,
                        sourceWav: "assets/factory_sources/explicit-client.wav",
                    }],
                };
            },
            async readBytes(path) {
                resourceReads.push({ method: "readBytes", path });
                if (path !== "assets/factory-bank-catalog.json") {
                    throw new Error(`Unexpected byte resource path: ${path}`);
                }

                return new TextEncoder().encode(JSON.stringify(await this.readJSON(path)));
            },
            async readAudio(path) {
                resourceReads.push({ method: "readAudio", path });
                if (path !== "assets/factory_sources/explicit-client.wav") {
                    throw new Error(`Unexpected audio resource path: ${path}`);
                }

                return {
                    sampleRate: 44100,
                    samples: resourceSamples,
                };
            },
            getURL() {
                return null;
            },
        };

        const { createDesktopPatchView } = await import("/ui/desktop/patch-view-entry.tsx");
        const mountPoint = document.getElementById("mount");

        if (!mountPoint) {
            throw new Error("Explicit resource-client mount point is missing.");
        }

        window.__COSIMO_EXPLICIT_RESOURCE_CLIENT_DEBUG__ = {
            getSnapshot() {
                return {
                    resourceReads: resourceReads.slice(),
                    sentMessages: sentMessages.map(({ endpointID, value }) => ({ endpointID, value })),
                };
            },
        };

        mountPoint.replaceChildren(createDesktopPatchView(patchConnection, { resourceClient }));
    }, TEST_SAMPLES_PER_FRAME);

    return page;
}

before(async () => {
    server = await startDesktopHarnessServer();
    builtBundleServer = await startStaticRepoServer();
    browser = await chromium.launch({
        headless: true,
    });
});

after(async () => {
    await browser?.close();
    await builtBundleServer?.stop();
    await server?.stop();
});

function assertLatestMsegBufferMatchesStoredShape(snapshot) {
    const storedShape = readStoredMsegShape(snapshot);
    const expectedBuffer = Array.from(renderMsegShape(storedShape));
    const lastBufferMessage = [...snapshot.sentMessages]
        .reverse()
        .find(({ endpointID, value }) => (
            endpointID === "modulationMsegBuffer"
            && Number(value?.slot) === 1
            && Number(value?.shapeIndex ?? 0) === 0
        ));

    assert.ok(lastBufferMessage, "Expected a modulationMsegBuffer upload for slot 1.");
    assert.deepEqual(lastBufferMessage.value, {
        slot: 1,
        shapeIndex: 0,
        buffer: expectedBuffer,
    });
}

test("desktop harness renders the real React patch view and requests runtime sync on boot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.title(), "Cosimo Desktop UI Harness");
        assert.equal(await page.locator("cosimo-desktop-react-view").count(), 1);
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        await page.waitForSelector("text=Ready");

        const snapshot = await getHarnessSnapshot(page);
        const runtimeSyncMessages = snapshot.sentMessages.filter(
            ({ endpointID }) => endpointID === "runtimeSyncRequest",
        );

        assert.equal(runtimeSyncMessages.length, 1);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationRoute"), true);
    } finally {
        await page.close();
    }
});

test("desktop Vite harness installs React Grab and registers the official MCP plugin in dev mode", async () => {
    const page = await openHarnessPage();

    try {
        const reactGrabState = await page.evaluate(() => {
            const api = window.__REACT_GRAB__;

            if (!api || typeof api !== "object") {
                return null;
            }

            return {
                hasRegisterPlugin: typeof api.registerPlugin === "function",
                hasGetPlugins: typeof api.getPlugins === "function",
                plugins: typeof api.getPlugins === "function" ? api.getPlugins() : null,
            };
        });

        assert.equal(reactGrabState?.hasRegisterPlugin, true);
        assert.equal(reactGrabState?.hasGetPlugins, true);
        assert.equal(Array.isArray(reactGrabState?.plugins), true);
        assert.equal(reactGrabState.plugins.includes("mcp"), true);
    } finally {
        await page.close();
    }
});

test("built desktop bundle mounts the custom-element wrapper and renders a real stage", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");
        await page.waitForSelector("text=Ready");
        assert.equal(
            await page.evaluate(() => Boolean(document.querySelector("cosimo-desktop-react-view")?.shadowRoot)),
            true,
        );
        assert.equal(
            await page.evaluate(() => "__REACT_GRAB__" in window),
            false,
        );
        assert.equal(await page.locator('[data-role="curve-lab-toggle"]').count(), 0);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("#mount > pre").count(), 0);

        const builtBundleSnapshot = await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot());
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationRoute"),
            true,
        );
        assert.deepEqual(builtBundleSnapshot.keyboardDebug?.attachCalls ?? [], [{ endpointID: "midiIn" }]);
    } finally {
        await page.close();
    }
});

test("built desktop bundle renders visible distortion slider handles inside the shadow DOM", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");

        const handleState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot;

            if (!root) {
                return null;
            }

            return [
                "distortion-drive-handle",
                "distortion-knee-handle",
                "distortion-mix-handle",
            ].map((dataRole) => {
                const element = root.querySelector(`[data-role="${dataRole}"]`);

                if (!(element instanceof HTMLElement)) {
                    return {
                        dataRole,
                        exists: false,
                    };
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    dataRole,
                    exists: true,
                    width: rect.width,
                    height: rect.height,
                    backgroundImage: style.backgroundImage,
                    opacity: style.opacity,
                    visibility: style.visibility,
                };
            });
        });

        assert.notEqual(handleState, null);

        for (const handle of handleState) {
            assert.equal(handle.exists, true, `${handle.dataRole} should exist`);
            assert.equal(handle.width >= 10, true, `${handle.dataRole} should have a visible width`);
            assert.equal(handle.height >= 10, true, `${handle.dataRole} should have a visible height`);
            assert.notEqual(handle.backgroundImage, "none", `${handle.dataRole} should render its explicit gradient`);
            assert.equal(handle.opacity, "1", `${handle.dataRole} should not be transparent`);
            assert.equal(handle.visibility, "visible", `${handle.dataRole} should not be hidden`);
        }
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab retunes the real filter resonance drag curve", async () => {
    const page = await openHarnessPage();

    try {
        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        assert.equal(await curveLabToggle.count(), 1);

        const popupPromise = page.waitForEvent("popup");
        await curveLabToggle.click();
        const curveLabPage = await popupPromise;
        await curveLabPage.waitForLoadState("domcontentloaded");
        await curveLabPage.waitForSelector('[data-role="curve-lab-panel"]');

        const linearFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-linear"]');
        await linearFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "linear"
        ));

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        let snapshot = await waitForHarnessSnapshot(
            page,
            "linear filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.3,
        );
        const linearDraggedQ = Number(snapshot.parameterValues.filterQ);

        const balancedPowerFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-balanced-power"]');
        await balancedPowerFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "balanced-power"
        ));

        const powerCoefficient = curveLabPage.locator('[data-role="curve-lab-coefficient-power"]');
        await dispatchInputValueChange(powerCoefficient, 3.8);
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "balanced-power"
                && Math.abs(Number(curve?.coefficients?.power) - 3.8) <= 0.001;
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        snapshot = await waitForHarnessSnapshot(
            page,
            "balanced power filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.12,
        );
        const curvedDraggedQ = Number(snapshot.parameterValues.filterQ);

        assert.ok(
            curvedDraggedQ < linearDraggedQ,
            `Expected the balanced power curve to move resonance less near the floor. Linear=${linearDraggedQ}, curved=${curvedDraggedQ}`,
        );

        const popupClose = new Promise((resolve) => curveLabPage.once("close", resolve));
        await curveLabPage.getByRole("button", { name: "Close", exact: true }).click();
        await popupClose;
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });
    } finally {
        await page.close();
    }
});

test("desktop filter resonance drag defaults to the locked sigmoid curve", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });

        const renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab uses the native desktop bridge when it is available", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(() => {
                window.__COSIMO_NATIVE_CURVE_LAB_TEST__ = {
                    openCalls: 0,
                    closeCalls: 0,
                    stateJSON: "",
                };

                window.cosimo_desktop_curve_lab_openWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls += 1;
                };

                window.cosimo_desktop_curve_lab_closeWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.closeCalls += 1;
                };

                window.cosimo_desktop_curve_lab_getState = async () => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON;

                window.cosimo_desktop_curve_lab_setState = async (nextState) => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = String(nextState);
                };
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            typeof window.__COSIMO_NATIVE_CURVE_LAB_TEST__?.stateJSON === "string"
            && window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON.length > 0
        ));

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = false;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForTimeout(50);
        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);

        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        await curveLabToggle.click();
        assert.equal(await page.evaluate(() => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls), 1);

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = true;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 9.2) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.31) <= 0.001;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 9.2) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop patch view scrolls vertically when the window is shorter than the full layout", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 1280, height: 720 });
        },
    });

    try {
        await page.waitForSelector("text=Filter");
        const initialMetrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            return {
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
                scrollTop: scrollRegion.scrollTop,
            };
        });

        assert.ok(
            initialMetrics.scrollHeight > initialMetrics.clientHeight,
            `Expected the desktop patch view to overflow vertically. Got ${JSON.stringify(initialMetrics)}`,
        );

        const scrolledMetrics = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            scrollRegion.scrollTop = scrollRegion.scrollHeight;
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));

            return {
                scrollTop: scrollRegion.scrollTop,
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
            };
        });

        assert.ok(
            scrolledMetrics.scrollTop > 0,
            `Expected the desktop patch view to accept vertical scrolling. Got ${JSON.stringify(scrolledMetrics)}`,
        );
    } finally {
        await page.close();
    }
});

test("desktop grid cards share the compact panel shell at narrow and standalone widths", async () => {
    const viewportCases = [
        { label: "narrow two-column", width: 775, height: 700 },
        { label: "standalone desktop", width: 976, height: 768 },
    ];

    for (const viewportCase of viewportCases) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
            },
        });

        try {
            await page.waitForSelector("text=Ready");

            const metrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot ?? document;
            const rectOf = (selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing element: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    padding: style.padding,
                };
            };

            const gridCardSelectors = [
                '[data-role="wavetable-card"]',
                '[data-role="filter-card"]',
                '[data-role="distortion-card"]',
                '[data-role="effects-rack-card"]',
                '[data-role="mseg-card"]',
                '[data-role="mod-matrix-card"]',
            ];
            const cards = gridCardSelectors.map((selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing grid card: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    role: element.getAttribute("data-role") ?? selector,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    hasSharedShell: element.getAttribute("data-layout-card") === "desktop-grid-card",
                };
            });

            return {
                cards,
                wavetable: rectOf(".cosimo-stage"),
                wavetableCanvas: rectOf(".cosimo-stage canvas"),
                wavetableTopControls: rectOf('[data-role="wavetable-stage-top-controls"]'),
                wavetableBottomControls: rectOf('[data-role="wavetable-stage-bottom-controls"]'),
                wavetableSelectChip: rectOf('[data-role="wavetable-select-chip"]'),
                wavetableFrameChip: rectOf('[data-role="wavetable-frame-chip"]'),
                wavetablePositionChip: rectOf('[data-role="wavetable-position-chip"]'),
                warpControlCluster: rectOf('[data-role="warp-control-cluster"]'),
                warpModeControl: rectOf('[data-role="warp-mode-control"]'),
                wavetablePanField: rectOf('[data-role="wavetable-pan-field"]'),
                filterModeChip: rectOf('[data-role="filter-mode-chip"]'),
                filterAnalyzerChip: rectOf('[data-role="filter-analyzer-chip"]'),
                filterCutoffField: rectOf('[data-role="filter-cutoff-field"]'),
                filterResonanceField: rectOf('[data-role="filter-resonance-field"]'),
                distortionModeButton: rectOf('[data-role="distortion-mode-option-1"]'),
                filter: rectOf('[data-role="filter-card"]'),
                filterGraph: rectOf('[data-role="filter-response-graph"]'),
            };
            });

            assert.equal(metrics.cards.length, 6, `Expected the six main desktop panels to be measured by name at ${viewportCase.label}.`);
            assert.deepEqual(
                metrics.cards.map((card) => card.hasSharedShell),
                Array.from({ length: metrics.cards.length }, () => true),
                `Expected the six main desktop panels to opt into the shared grid-card shell at ${viewportCase.label}.`,
            );
            assert.deepEqual(
                metrics.cards.map((card) => card.borderRadius),
                Array.from({ length: metrics.cards.length }, () => "14px"),
                `desktop grid panels should share the same compact shell radius instead of per-panel hero shells at ${viewportCase.label}`,
            );

            for (const card of metrics.cards) {
                assert.equal(
                    Math.abs(card.width - metrics.wavetable.width) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} width to match the wavetable shell at ${viewportCase.label}: ${JSON.stringify({ card, wavetable: metrics.wavetable })}`,
                );
                assert.equal(
                    Math.abs(card.height - metrics.wavetable.height) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} height to match the wavetable shell at ${viewportCase.label}: ${JSON.stringify({ card, wavetable: metrics.wavetable })}`,
                );
            }

            assert.equal(
                metrics.wavetableTopControls.height <= 36,
                true,
                `Wavetable top controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableTopControls)}`,
            );
            assert.equal(
                metrics.wavetableBottomControls.height <= 34,
                true,
                `Wavetable bottom controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableBottomControls)}`,
            );
            for (const compactControl of [
                metrics.wavetableSelectChip,
                metrics.wavetableFrameChip,
                metrics.wavetablePositionChip,
                metrics.warpModeControl,
                metrics.filterModeChip,
                metrics.filterAnalyzerChip,
            ]) {
                assert.equal(
                    compactControl.height <= metrics.distortionModeButton.height + 6,
                    true,
                    `Expected top-row chip/control height to stay close to the compact distortion mode button at ${viewportCase.label}: ${JSON.stringify({ compactControl, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            for (const compactField of [
                metrics.wavetablePanField,
                metrics.filterCutoffField,
                metrics.filterResonanceField,
            ]) {
                assert.equal(
                    compactField.height <= metrics.distortionModeButton.height + 8,
                    true,
                    `Expected top-row number fields to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ compactField, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            assert.equal(
                metrics.warpControlCluster.height <= metrics.distortionModeButton.height + 8,
                true,
                `Expected the warp cluster to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ warpControlCluster: metrics.warpControlCluster, distortionModeButton: metrics.distortionModeButton })}`,
            );
            assert.equal(metrics.wavetableCanvas.width / metrics.wavetable.width >= 0.98, true);
            assert.equal(metrics.wavetableCanvas.height / metrics.wavetable.height >= 0.98, true);
            assert.equal(metrics.filterGraph.width / metrics.filter.width >= 0.94, true);
            assert.equal(metrics.filterGraph.height / metrics.filter.height >= 0.9, true);
        } finally {
            await page.close();
        }
    }
});

test("desktop custom-element wrapper honors an explicitly injected resource client", async () => {
    const page = await openDesktopEntryPageWithInjectedResourceClient();

    try {
        await page.waitForSelector("text=Ready");
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("text=Explicit Client Table").count() > 0, true);

        const snapshot = await page.evaluate(() => window.__COSIMO_EXPLICIT_RESOURCE_CLIENT_DEBUG__.getSnapshot());
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readJSON" && path === "assets/factory-bank-catalog.json"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readAudio" && path === "assets/factory_sources/explicit-client.wav"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.every(({ method, path }) =>
                (method === "readJSON" && path === "assets/factory-bank-catalog.json") ||
                (method === "readAudio" && path === "assets/factory_sources/explicit-client.wav")),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
    } finally {
        await page.close();
    }
});

test("desktop page only shows Retry Load for failures on the current desired wavetable", async () => {
    const page = await openHarnessPage();

    try {
        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 4,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        assert.equal(await page.getByRole("button", { name: "Retry Load" }).count(), 0);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces catalog load failures instead of going blank", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory-bank-catalog.json", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "catalog failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not load the factory bank.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces frame load failures instead of blanking the stage", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory_sources/**", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "frame failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not render the current wavetable.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("wavetable picker prewarms the current and adjacent tables without selecting a new table", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        await clearHarnessDebugLog(page);
        await page.locator('label:has(select[aria-label="Select wavetable"])').hover();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest").length >= 2;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest"),
            [
                { endpointID: "wavetablePrewarmRequest", value: 0 },
                { endpointID: "wavetablePrewarmRequest", value: 1 },
            ],
        );
        assert.deepEqual(
            snapshot.endpointMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmNotification"),
            [
                { endpointID: "wavetablePrewarmNotification", value: 0 },
                { endpointID: "wavetablePrewarmNotification", value: 1 },
            ],
        );
        assert.equal(Number(snapshot.parameterValues.wavetableSelect), 0);
        assert.deepEqual(snapshot.gestureStarts.filter((value) => value === "wavetableSelect"), []);
    } finally {
        await page.close();
    }
});

test("wavetable selection commits the desired table and retry uses the runtime retry event", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await clearHarnessDebugLog(page);
        await page.click('select[aria-label="Select wavetable"]');
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("wavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Select wavetable"]', "1");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.wavetableSelect) === 1 &&
                snapshot.runtimeState.desiredTableIndex === 1 &&
                snapshot.runtimeState.activeTableIndex === 0 &&
                snapshot.runtimeState.hasLoading === true &&
                snapshot.runtimeState.loadingTableIndex === 1;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("wavetableSelect"), true);
        assert.equal(snapshot.gestureEnds.includes("wavetableSelect"), true);
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("wavetablePosition"), false);
        assert.equal(snapshot.runtimeState.activeTableIndex, 0);
        assert.equal(snapshot.runtimeState.desiredTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "wavetableSelect" && Number(value) === 1),
            true,
        );
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 2,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        await page.waitForSelector('button:has-text("Retry Load")');
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "retryDesiredTableRequest")
                && snapshot.runtimeState.hasLoading === true
                && snapshot.runtimeState.loadingTableIndex === 1
                && snapshot.runtimeState.hasFailure === false;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForSelector('button:has-text("Retry Load")', { state: "detached" });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "retryDesiredTableRequest"),
            [{ endpointID: "retryDesiredTableRequest", value: 1 }],
        );
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasFailure, false);
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);
    } finally {
        await page.close();
    }
});

test("runtime loading state keeps the audible table visible while naming the desired table as pending", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 3,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 9,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 10,
            hasFailure: false,
        });

        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForFunction((expectedTableName) => {
            return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().stageLabel === expectedTableName;
        }, audibleTableName);
    } finally {
        await page.close();
    }
});

test("stage drag preserves the gesture contract and ignores tiny drags", async () => {
    const page = await openHarnessPage();

    try {
        const stage = page.locator(".cosimo-stage");
        const box = await stage.boundingBox();
        assert.ok(box);

        const startX = box.x + (box.width * 0.5);
        const startY = box.y + (box.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 1);
        await page.mouse.up();

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.filter((value) => value === "wavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "wavetablePosition").length, 1);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "wavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 48, { steps: 6 });
        await page.mouse.up();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "wavetablePosition");
        });

        snapshot = await getHarnessSnapshot(page);
        const positionMessages = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePosition");

        assert.equal(snapshot.gestureStarts.filter((value) => value === "wavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "wavetablePosition").length, 1);
        assert.equal(positionMessages.length > 0, true);

        const lastPosition = Number(positionMessages.at(-1)?.value);
        const expectedPosition = Math.min(1, Math.max(0, 0.28 + (48 / box.height)));
        assert.ok(Math.abs(lastPosition - expectedPosition) <= 0.03);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 0,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 11,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 11,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });
        await page.waitForSelector('button:has-text("Retry Load")');
        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await showVoiceControls(page);
        await page.click('[aria-label="Glide"]');
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("wavetablePosition"), false);
    } finally {
        await page.close();
    }
});

test("wavetable select claims left and right arrows on the real desktop page", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });
        await page.locator('select[aria-label="Select wavetable"]').evaluate((element) => {
            element.addEventListener("keydown", (event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                }
            }, true);
        });

        await clearHarnessDebugLog(page);
        await page.focus('select[aria-label="Select wavetable"]');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.wavetableSelect) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetableSelect"),
            [{ endpointID: "wavetableSelect", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.wavetableSelect) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetableSelect"),
            [{ endpointID: "wavetableSelect", value: 0 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("keyboard routing lets focused controls claim arrows and still routes note keys to the keyboard", async () => {
    const page = await openHarnessPage();

    try {
        const initialKeyboardDebug = await getKeyboardDebug(page);
        assert.ok(initialKeyboardDebug);
        assert.deepEqual(initialKeyboardDebug.attachCalls, [{ endpointID: "midiIn" }]);
        await showVoiceControls(page);

        await clearHarnessDebugLog(page);
        await page.focus('button:has-text("Poly")');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.151) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.151 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.15) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.15 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.locator('[aria-label="Glide"]').blur();
        await page.keyboard.down("a");
        await page.keyboard.up("a");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        keyboardDebug = await getKeyboardDebug(page);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("glide widget commits direct edits and blocks note routing while text entry is active", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const glideInput = page.locator('[aria-label="Glide"]');
        await glideInput.waitFor();

        await clearHarnessDebugLog(page);
        await glideInput.focus();
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });

        await clearHarnessDebugLog(page);
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await dispatchInputValueChange(glideInput, 0.5);
        await glideInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.5) <= 1e-9;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.5 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("voice mode buttons commit the exact discrete playMode values", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        await clearHarnessDebugLog(page);

        await page.click('button:has-text("Mono")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.equal(await page.locator('button:has-text("Mono")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Legato")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 2 }],
        );
        assert.equal(await page.locator('button:has-text("Legato")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Poly")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 0 }],
        );
        assert.equal(await page.locator('button:has-text("Poly")').getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("warp controls commit mode and amount, and the matrix can route MSEG 1 into warp amount", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.locator('select[aria-label="Warp mode"]').count(), 0);
        assert.equal(await page.getByText("Phase Warp", { exact: true }).count(), 0);

        await clearHarnessDebugLog(page);
        const warpModeChip = page.locator('button[aria-label^="Cycle warp mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.warpMode));

        for (let guard = 0; guard < 8 && currentMode !== 3; guard += 1) {
            await warpModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "warp mode cycling to asym",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.warpMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 3);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "warpMode" && Number(value) === 3),
            true,
        );

        await clearHarnessDebugLog(page);
        await warpModeChip.click();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.warpMode) === 4;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "warpMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const warpAmountInput = page.locator('input[aria-label="Warp amount"]');
        await warpAmountInput.dblclick();
        await warpAmountInput.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
        await warpAmountInput.type("0.720");
        await warpAmountInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.warpAmount) - 0.72) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "warpAmount"),
            [{ endpointID: "warpAmount", value: 0.72 }],
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        await choosePrototypeSelectOption(page, "Route 1 target", "WARP");
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await dragLocatorBy(page, page.locator('[aria-label="Route 1 amount"]'), 0, -42);

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 targeting warp amount",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "warpAmount"
                    && route?.polarity === "bipolar"
                    && Math.abs(Number(route.amount) - 0.35) <= 0.03;
            },
        );

        const finalRouteUpload = [...snapshot.sentMessages]
            .reverse()
            .find(({ endpointID, value }) => endpointID === "modulationRoute" && Number(value?.routeIndex) === 0);

        assert.deepEqual(routeSummaries(readStoredModulationState(snapshot).routes), [{
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "warpAmount",
            amount: readStoredModulationState(snapshot).routes[0].amount,
        }]);
        assert.deepEqual(finalRouteUpload?.value, {
            routeIndex: 0,
            enabled: true,
            sourceKind: 1,
            sourceSlot: 1,
            polarityKind: 1,
            targetKind: 2,
            amount: readStoredModulationState(snapshot).routes[0].amount,
        });
        assert.equal((await page.locator('[data-role="route-row-1"] >> text=/±(35|34|36)%/').count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("articulation slots clone current state and recall parameters plus route amounts without replacing routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });
        assert.equal(await page.locator('[data-role="articulation-slot-bar"]').count(), 0);
        assert.equal(await page.locator('[data-role="articulation-control-surface"][data-state="collapsed"]').count(), 1);
        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        assert.equal(await page.locator('[data-role="articulation-control-surface"][data-state="expanded"]').count(), 1);
        await page.getByRole("tab", { name: "Key" }).click();
        let modeSnapshot = await waitForHarnessSnapshot(
            page,
            "articulation trigger mode set to Key",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).activeTriggerMode === "key",
        );
        assert.equal(readStoredArticulationBank(modeSnapshot).activeTriggerMode, "key");
        assert.equal(await page.locator('[data-role="articulation-range-lane"]').count(), 1);
        assert.equal(await page.locator('[data-role="articulation-distribute"]').count(), 0);
        await page.getByRole("tab", { name: "Chain" }).click();
        await page.getByRole("button", { name: "Collapse articulation editor" }).click();
        assert.equal(await page.locator('[data-role="articulation-control-surface"][data-state="collapsed"]').count(), 1);
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("wavetablePosition", 0.66);
            harness.setParameterValue("playMode", 1);
            harness.setParameterValue("glideTime", 0.27);
            harness.setParameterValue("pan", -0.18);
            harness.setParameterValue("warpMode", 3);
            harness.setParameterValue("warpAmount", 0.61);
            harness.setParameterValue("filterMode", 2);
            harness.setParameterValue("filterCutoff", 2475);
            harness.setParameterValue("filterQ", 3.6);
            harness.setParameterValue("mseg1Morph", 0.33);

            const rawModulationState = harness.getSnapshot().storedState["modulation.v2"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : { format: "cosimo.modulation", version: 2 };
            modulationState.envelopeSlots = Array.isArray(modulationState.envelopeSlots)
                ? modulationState.envelopeSlots
                : [];
            modulationState.envelopeSlots[0] = {
                ...(modulationState.envelopeSlots[0] ?? {}),
                attackSeconds: 0.17,
                decaySeconds: 0.31,
                sustain: 0.44,
                releaseSeconds: 0.58,
            };
            modulationState.routes = [{
                id: "articulation-route-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "warpAmount",
                amount: 0.42,
            }];
            harness.setStoredStateValue("modulation.v2", JSON.stringify(modulationState));
        });
        await waitForReactFrames(page);

        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "articulation slot capturing the current synth state",
            (nextSnapshot) => {
                const bank = readStoredArticulationBank(nextSnapshot);
                const slot = bank.slots[0];
                const routeAmount = slot?.snapshot.modRouteAmounts.find((entry) => entry.routeId === "articulation-route-1");

                return bank.selectedSlotId === "articulation-0"
                    && bank.slots.length === 1
                    && slot?.runtimeSlot === 0
                    && Math.abs(Number(slot?.snapshot.parameters.wavetablePosition) - 0.66) <= 1e-9
                    && Math.abs(Number(slot?.snapshot.parameters.warpAmount) - 0.61) <= 1e-9
                    && Math.abs(Number(slot?.snapshot.parameters.filterCutoff) - 2475) <= 1e-9
                    && Math.abs(Number(slot?.snapshot.parameters.msegMorphs?.[0]) - 0.33) <= 1e-9
                    && Math.abs(Number(slot?.snapshot.envelopes?.[0]?.attackSeconds) - 0.17) <= 1e-9
                    && Math.abs(Number(routeAmount?.amount) - 0.42) <= 1e-9;
            },
        );
        assert.equal(await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').count(), 1);
        assert.equal(
            await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').getAttribute("aria-pressed"),
            "true",
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID, value }) => (
                    endpointID === "articulationSnapshot"
                    && [0, 1].includes(Number(value?.selectorA))
                ))
                .slice(-2)
                .map(({ value }) => ({
                    selectorA: value.selectorA,
                    enabled: value.enabled,
                    framePosition: value.framePosition,
                    warpAmount: value.warpAmount,
                    filterCutoffHz: value.filterCutoffHz,
                    msegMorphs: value.msegMorphs,
                    routeAmount0: value.routeAmounts?.[0],
                    envelopeAttack0: value.envelopeAttackSeconds?.[0],
                })),
            [
                {
                    selectorA: 0,
                    enabled: true,
                    framePosition: 0.66,
                    warpAmount: 0.61,
                    filterCutoffHz: 2475,
                    msegMorphs: [0.33, 0, 0],
                    routeAmount0: 0.42,
                    envelopeAttack0: 0.17,
                },
                {
                    selectorA: 1,
                    enabled: false,
                    framePosition: 0,
                    warpAmount: 0,
                    filterCutoffHz: 1000,
                    msegMorphs: [0, 0, 0],
                    routeAmount0: 0,
                    envelopeAttack0: 0.01,
                },
            ],
        );

        const capturedBank = readStoredArticulationBank(snapshot);
        await page.evaluate(({ stateKey, bank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify({
                ...bank,
                selectedSlotId: null,
            }));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            bank: capturedBank,
        });
        await waitForHarnessSnapshot(
            page,
            "articulation editing deselected",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).selectedSlotId === null,
        );

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("wavetablePosition", 0.12);
            harness.setParameterValue("playMode", 2);
            harness.setParameterValue("glideTime", 0.05);
            harness.setParameterValue("pan", 0.41);
            harness.setParameterValue("warpMode", 4);
            harness.setParameterValue("warpAmount", 0.08);
            harness.setParameterValue("filterMode", 5);
            harness.setParameterValue("filterCutoff", 8200);
            harness.setParameterValue("filterQ", 9.5);
            harness.setParameterValue("mseg1Morph", 0.91);

            const rawModulationState = harness.getSnapshot().storedState["modulation.v2"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : { format: "cosimo.modulation", version: 2 };
            modulationState.envelopeSlots = Array.isArray(modulationState.envelopeSlots)
                ? modulationState.envelopeSlots
                : [];
            modulationState.envelopeSlots[0] = {
                ...(modulationState.envelopeSlots[0] ?? {}),
                attackSeconds: 0.92,
                decaySeconds: 0.83,
                sustain: 0.72,
                releaseSeconds: 0.61,
            };
            modulationState.routes = [{
                id: "articulation-route-1",
                enabled: false,
                sourceKind: "env",
                sourceSlot: 2,
                polarity: "unipolar",
                targetKind: "filterQ",
                amount: 0.03,
            }];
            harness.setStoredStateValue("modulation.v2", JSON.stringify(modulationState));
        });
        await waitForReactFrames(page);
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "articulation recall applying parameters and route amount only",
            (nextSnapshot) => {
                const bank = readStoredArticulationBank(nextSnapshot);
                const modulationState = readStoredModulationState(nextSnapshot);
                const route = modulationState.routes[0];

                return bank.selectedSlotId === "articulation-0"
                    && Math.abs(Number(nextSnapshot.parameterValues.wavetablePosition) - 0.66) <= 1e-9
                    && Number(nextSnapshot.parameterValues.playMode) === 1
                    && Math.abs(Number(nextSnapshot.parameterValues.glideTime) - 0.27) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.pan) - -0.18) <= 1e-9
                    && Number(nextSnapshot.parameterValues.warpMode) === 3
                    && Math.abs(Number(nextSnapshot.parameterValues.warpAmount) - 0.61) <= 1e-9
                    && Number(nextSnapshot.parameterValues.filterMode) === 2
                    && Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 2475) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.filterQ) - 3.6) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.33) <= 1e-9
                    && Math.abs(Number(modulationState.msegSlots[0].morph) - 0.33) <= 1e-9
                    && Math.abs(Number(modulationState.envelopeSlots[0].attackSeconds) - 0.17) <= 1e-9
                    && route?.id === "articulation-route-1"
                    && route?.enabled === false
                    && route?.sourceKind === "env"
                    && route?.sourceSlot === 2
                    && route?.polarity === "unipolar"
                    && route?.targetKind === "filterQ"
                    && Math.abs(Number(route?.amount) - 0.42) <= 1e-9;
            },
        );

        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => ["wavetablePosition", "warpAmount", "filterCutoff", "mseg1Morph"].includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [
                { endpointID: "wavetablePosition", value: 0.66 },
                { endpointID: "warpAmount", value: 0.61 },
                { endpointID: "filterCutoff", value: 2475 },
                { endpointID: "mseg1Morph", value: 0.33 },
            ],
        );
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: false,
            sourceKind: "env",
            sourceSlot: 2,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 0.42,
        });
    } finally {
        await page.close();
    }
});

test("articulation range lane zooms by thirds and marks held Key Vel and Chain values", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        let viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                    pressed: dot.getAttribute("aria-pressed"),
                }))
            )),
            [
                { index: "0", held: "false", pressed: "true" },
                { index: "1", held: "false", pressed: "false" },
                { index: "2", held: "false", pressed: "false" },
            ],
        );

        await page.getByRole("tab", { name: "Key" }).click();
        await page.keyboard.down("a");
        await page.locator('[data-role="articulation-held-value"][data-held-value="36"]').waitFor();
        viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "36" });

        await page.getByRole("tab", { name: "Vel" }).click();
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                }))
            )),
            [
                { index: "0", held: "false" },
                { index: "1", held: "false" },
                { index: "2", held: "true" },
            ],
            "velocity 100 should mark the upper third while the lower velocity third is visible",
        );
        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        await page.locator('[data-role="articulation-held-value"][data-held-value="100"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 86, max: 127, heldValue: "100" });

        await page.getByRole("tab", { name: "Chain" }).click();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("voiceArticulationStart", {
                hasArticulation: 1,
                selectorA: 24,
            }, true);
        });
        await page.locator('[data-role="articulation-held-value"][data-held-value="24"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 0, min: 0, max: 42, heldValue: "24" });

        await page.keyboard.up("a");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-range-lane"]')?.getAttribute("data-held-value") === ""
        ));
    } finally {
        await page.keyboard.up("a").catch(() => {});
        await page.close();
    }
});

test("articulation editor exposes insert resize move clear and expanded capture placement", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow-full", articulationId: "bow", min: 0, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 1,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        await page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]').click();
        assert.equal(
            await page.locator('[data-role="articulation-lane-assign-mode"], [data-role="articulation-lane-insert-mode"]').count(),
            0,
            "range placement must be inferred from hover/drop position, not an Assign/Insert mode toggle",
        );

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });
        const expectedInsertPosition = Math.round(lowerViewport.min + (0.79 * (lowerViewport.max - lowerViewport.min)));
        await dragArticulationCardToLane(page, "pluck", lane, {
            x: laneBox.x + laneBox.width * 0.79,
            y: laneBox.y + laneBox.height * 0.5,
        }, {
            afterDragOver: async () => {
                const preview = page.locator('[data-role="articulation-placement-preview"]');
                await preview.waitFor();
                assert.equal(await preview.getAttribute("data-operation"), "insert");
                assert.match(
                    await preview.textContent(),
                    new RegExp(`^insert ${expectedInsertPosition}$`),
                    "edge hover must visibly preview insert before drop",
                );
                assert.deepEqual(
                    await readDesktopRangeSegments(page),
                    [
                        {
                            articulationId: "bow",
                            min: 0,
                            max: expectedInsertPosition - 1,
                            isPreview: false,
                            isPreviewAffected: true,
                            text: `Bow 0-${expectedInsertPosition - 1}`,
                        },
                        {
                            articulationId: "pluck",
                            min: expectedInsertPosition,
                            max: expectedInsertPosition,
                            isPreview: true,
                            isPreviewAffected: false,
                            text: `Plu ${expectedInsertPosition}`,
                        },
                    ],
                    "edge hover must render the effective post-drop lane before drop",
                );
                assert.equal(
                    await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
                    String(expectedInsertPosition),
                    "the inserted width-1 preview still needs a visible value chip",
                );
            },
        });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "edge drop inserts without an explicit insert toggle",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === expectedInsertPosition - 1
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === assignment.max
                    && assignment.min === expectedInsertPosition
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow-full", articulationId: "bow", min: 0, max: expectedInsertPosition - 1 },
            { id: `chain-pluck-${expectedInsertPosition}`, articulationId: "pluck", min: expectedInsertPosition, max: expectedInsertPosition },
        ]);
        assert.equal(
            await page
                .locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-value"]')
                .first()
                .textContent(),
            String(expectedInsertPosition),
        );

        await page.evaluate(({ stateKey }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const currentBank = JSON.parse(harness.getSnapshot().storedState[stateKey]);
            harness.setStoredStateValue(stateKey, JSON.stringify({
                ...currentBank,
                chainAssignments: [
                    { id: "chain-bow-full", articulationId: "bow", min: 0, max: 20 },
                    { id: "chain-pluck-21", articulationId: "pluck", min: 21, max: 21 },
                ],
            }));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "seeded narrow segment for resize and move",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => assignment.id === "chain-pluck-21" && assignment.min === 21 && assignment.max === 21);
            },
        );

        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);
        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.9, laneBox.y + laneBox.height * 0.5, { steps: 8 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range edge resize",
            (nextSnapshot) => {
                const pluck = readStoredArticulationBank(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return pluck?.min === 21 && Number(pluck?.max) > 21;
            },
        );
        const resizedPluck = readStoredArticulationBank(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.equal(resizedPluck.min, 21);
        assert.equal(resizedPluck.max, 38);

        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        const segmentBox = await pluckSegment.boundingBox();
        assert.notEqual(segmentBox, null);
        await page.mouse.move(segmentBox.x + segmentBox.width * 0.5, segmentBox.y + segmentBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.95, laneBox.y + laneBox.height * 0.5, { steps: 10 });
        assert.deepEqual(
            await readDesktopRangeSegments(page),
            [
                {
                    articulationId: "bow",
                    min: 0,
                    max: 20,
                    isPreview: false,
                    isPreviewAffected: false,
                    text: "Bow 0-20",
                },
                {
                    articulationId: "pluck",
                    min: 31,
                    max: 42,
                    isPreview: true,
                    isPreviewAffected: false,
                    text: "Pluck 31-42",
                },
            ],
            "range body drag must render its moved range before pointer up",
        );
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            "31-48",
        );
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range body move",
            (nextSnapshot) => {
                const pluck = readStoredArticulationBank(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return Number(pluck?.min) > 21 && Number(pluck?.max) > Number(pluck?.min);
            },
        );
        const movedPluck = readStoredArticulationBank(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.deepEqual(movedPluck, { id: "chain-pluck-21", articulationId: "pluck", min: 31, max: 48 });

        await page.locator('[data-role="articulation-clear-segment"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "range segment clear",
            (nextSnapshot) => (
                !readStoredArticulationBank(nextSnapshot).chainAssignments
                    .some((assignment) => assignment.articulationId === "pluck")
            ),
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow-full", articulationId: "bow", min: 0, max: 20 },
        ]);

        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "expanded capture creates without assigning",
            (nextSnapshot) => {
                const nextBank = readStoredArticulationBank(nextSnapshot);
                return nextBank.slots.length === 3
                    && nextBank.selectedSlotId === "articulation-2"
                    && !nextBank.chainAssignments.some((assignment) => assignment.articulationId === "articulation-2");
            },
        );
        assert.equal(readStoredArticulationBank(snapshot).slots.length, 3);
    } finally {
        await page.close();
    }
});

test("real articulation card drag previews insert and changes the range", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow-full", articulationId: "bow", min: 0, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for real browser drag",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 1,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const card = page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]');
        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const targetPosition = {
            x: laneBox.width * 0.79,
            y: laneBox.height * 0.5,
        };
        const expectedInsertPosition = Math.round(lowerViewport.min + (0.79 * (lowerViewport.max - lowerViewport.min)));
        const targetClientPosition = {
            x: laneBox.x + targetPosition.x,
            y: laneBox.y + targetPosition.y,
        };

        assert.equal(
            await previewArticulationCardDragOver(page, "pluck", lane, targetClientPosition),
            "insert",
        );
        assert.deepEqual(
            await readDesktopRangeSegments(page),
            [
                {
                    articulationId: "bow",
                    min: 0,
                    max: expectedInsertPosition - 1,
                    isPreview: false,
                    isPreviewAffected: true,
                    text: `Bow 0-${expectedInsertPosition - 1}`,
                },
                {
                    articulationId: "pluck",
                    min: expectedInsertPosition,
                    max: expectedInsertPosition,
                    isPreview: true,
                    isPreviewAffected: false,
                    text: `Plu ${expectedInsertPosition}`,
                },
            ],
            "real browser card drag must render the projected lane before mouse release",
        );
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            String(expectedInsertPosition),
            "the live insert preview must expose the exact target selector value",
        );

        await card.dragTo(lane, {
            sourcePosition: { x: 20, y: 20 },
            targetPosition,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "real browser drag inserts at the occupied edge",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === expectedInsertPosition - 1
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === assignment.max
                    && assignment.min === expectedInsertPosition
                ));
            },
        );

        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow-full", articulationId: "bow", min: 0, max: expectedInsertPosition - 1 },
            { id: `chain-pluck-${expectedInsertPosition}`, articulationId: "pluck", min: expectedInsertPosition, max: expectedInsertPosition },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation range clicks select only and dragging an already mapped card moves its range", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
                { id: "air", runtimeSlot: 2, name: "Air" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
                { id: "chain-pluck", articulationId: "pluck", min: 64, max: 95 },
                { id: "chain-air", articulationId: "air", min: 96, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for desktop click behavior",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 3,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        await page.mouse.click(laneBox.x + laneBox.width * 0.38, laneBox.y + laneBox.height * 0.5);
        await waitForReactFrames(page);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);

        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 85, max: 127, heldValue: "" });

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "desktop range click selects the segment articulation",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).selectedSlotId === "air",
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, bank.chainAssignments);

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click({ button: "right" });
        const rangeMenu = page.locator('[data-role="articulation-range-menu"]');
        await rangeMenu.waitFor();
        assert.deepEqual(
            await rangeMenu.locator('[data-role="articulation-range-menu-item"]').evaluateAll((items) => (
                items.map((item) => item.getAttribute("data-action"))
            )),
            ["replace", "insert-after", "duplicate-after", "delete"],
            "right-click must open the range context menu with editing actions",
        );
        await waitForReactFrames(page);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);
        await page.keyboard.press("Escape");
        await rangeMenu.waitFor({ state: "detached" });

        const highViewport = await readDesktopRangeViewport(page);
        const expectedMovedPosition = Math.round(highViewport.min + (0.96 * (highViewport.max - highViewport.min)));
        assert.equal(expectedMovedPosition, 125);
        const movedPluckMin = 96;
        const movedPluckMax = 127;
        await dragArticulationCardToLane(page, "pluck", lane, {
            x: laneBox.x + (laneBox.width * 0.96),
            y: laneBox.y + (laneBox.height * 0.5),
        }, {
            afterDragOver: async () => {
                const preview = page.locator('[data-role="articulation-placement-preview"]');
                await preview.waitFor();
                assert.equal(await preview.getAttribute("data-operation"), "move");
                assert.deepEqual(
                    await readDesktopRangeSegments(page),
                    [
                        {
                            articulationId: "pluck",
                            min: movedPluckMin,
                            max: movedPluckMax,
                            isPreview: true,
                            isPreviewAffected: false,
                            text: `Pluck ${movedPluckMin}-${movedPluckMax}`,
                        },
                    ],
                    "dragging an already-mapped card must preview one moved range, not merged instances",
                );
                assert.equal(
                    await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
                    `${movedPluckMin}-${movedPluckMax}`,
                );
            },
        });

        snapshot = await waitForHarnessSnapshot(
            page,
            "dragging a mapped card moves its only range instead of duplicating it",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.filter((assignment) => assignment.articulationId === "pluck").length === 1
                    && assignments.some((assignment) => (
                        assignment.articulationId === "pluck"
                        && assignment.min === movedPluckMin
                        && assignment.max === movedPluckMax
                    ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
            { id: "chain-pluck", articulationId: "pluck", min: movedPluckMin, max: movedPluckMax },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize shrinks the range in the drag direction", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for resize",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);

        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.75, laneBox.y + laneBox.height * 0.5, { steps: 8 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "32-42"],
            "shared-boundary drag right must preview shrinking the right range start while leaving the left range alone",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "right range shrinks from the start during shared-boundary drag right",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 32
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 32, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize works on the first cold drag", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for cold first drag",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const bowBox = await bowSegment.boundingBox();
        assert.notEqual(bowBox, null);

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - viewport.min) / (viewport.max - viewport.min))
        );
        const y = bowBox.y + bowBox.height * 0.5;

        await page.mouse.move(bowBox.x + bowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(23), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "23-42"],
            "the first drag from a cold shared edge must preview shrinking the range in the drag direction",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "reset adjacent ranges for cold first drag left",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );

        const resetBowBox = await bowSegment.boundingBox();
        assert.notEqual(resetBowBox, null);
        await page.mouse.move(resetBowBox.x + resetBowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(19), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-19", "21-42"],
            "the first cold drag left from a shared edge must shrink the left range and leave the right range in place",
        );

        await page.mouse.up();

        const dragLeftSnapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag left shrinks the left range end and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(dragLeftSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation one-slot ranges keep labels and avoid adjacent resize-handle stealing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded one-slot adjacent range",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 21),
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        await pluckSegment.waitFor();
        assert.equal(await pluckSegment.getAttribute("data-tier"), "tiny");
        assert.equal(
            await pluckSegment.locator('[data-role="articulation-range-name"]').textContent(),
            "PS",
            "a one-slot range should still display the articulation identity instead of going blank",
        );

        const pluckHandleWidths = await pluckSegment
            .locator('[data-role^="articulation-range-resize"]')
            .evaluateAll((handles) => handles.map((handle) => handle.getBoundingClientRect().width));
        assert.deepEqual(
            pluckHandleWidths.map((width) => Math.round(width)),
            [4, 4],
            "resize hit targets should not consume the readable area of a one-slot range",
        );

        const bowBox = await bowSegment.boundingBox();
        const pluckBox = await pluckSegment.boundingBox();
        assert.notEqual(bowBox, null);
        assert.notEqual(pluckBox, null);

        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));

        await page.mouse.move(pluckBox.x + 1, pluckBox.y + pluckBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "false"
        ));

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - lowerViewport.min) / (lowerViewport.max - lowerViewport.min))
        );

        const bowMaxHandle = bowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const bowMaxHandleBox = await bowMaxHandle.boundingBox();
        assert.notEqual(bowMaxHandleBox, null);
        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));
        await page.mouse.move(
            bowMaxHandleBox.x + bowMaxHandleBox.width * 0.5,
            bowMaxHandleBox.y + bowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(19), pluckBox.y + pluckBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag left shrinks the left range and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 21
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
        ]);

        await page.evaluate(({ stateKey }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify({
                selectedSlotId: "bow",
                activeTriggerMode: "chain",
                slots: [
                    { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                    { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
                ],
                chainAssignments: [
                    { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                    { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
                ],
            }));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
        });
        await waitForHarnessSnapshot(
            page,
            "reset shared boundary with a wider right range",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 42),
        );

        const refreshedBowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const refreshedBowBox = await refreshedBowSegment.boundingBox();
        assert.notEqual(refreshedBowBox, null);
        const refreshedBowMaxHandle = refreshedBowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const refreshedBowMaxHandleBox = await refreshedBowMaxHandle.boundingBox();
        assert.notEqual(refreshedBowMaxHandleBox, null);
        await page.mouse.move(refreshedBowBox.x + refreshedBowBox.width * 0.5, refreshedBowBox.y + refreshedBowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
        ));
        await page.mouse.move(
            refreshedBowMaxHandleBox.x + refreshedBowMaxHandleBox.width * 0.5,
            refreshedBowMaxHandleBox.y + refreshedBowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(23), refreshedBowBox.y + refreshedBowBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const dragRightSnapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationBank(dragRightSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("articulation range lane center drop replaces and selected card is obvious before update", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow-full", articulationId: "bow", min: 0, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for replace",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 1,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        const pluckCard = page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]');
        await pluckCard.click();
        assert.equal(await pluckCard.getAttribute("data-selected"), "true");
        assert.equal(await pluckCard.locator('[data-role="articulation-card-selected-label"]').textContent(), "Selected");

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("pan", 0.25);
        });
        await page.locator('[data-role="articulation-update"]').waitFor();
        assert.match(
            await page.locator('[data-role="articulation-update"]').textContent(),
            /Pluck/,
            "Update button must name the selected articulation it will overwrite",
        );

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        await dragArticulationCardToLane(page, "pluck", lane, {
            x: laneBox.x + laneBox.width * 0.5,
            y: laneBox.y + laneBox.height * 0.5,
        }, {
            afterDragOver: async () => {
                const preview = page.locator('[data-role="articulation-placement-preview"]');
                await preview.waitFor();
                assert.equal(await preview.getAttribute("data-operation"), "replace");
                assert.match(
                    await preview.textContent(),
                    /^replace /,
                    "center hover must visibly preview replace before drop",
                );
            },
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "center drop replaces occupied range",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.length === 1
                    && assignments[0].articulationId === "pluck"
                    && assignments[0].min === 0
                    && assignments[0].max === 127;
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow-full", articulationId: "pluck", min: 0, max: 127 },
        ]);
    } finally {
        await page.close();
    }
});

test("mobile articulation segment tap replaces occupied range instead of inserting at the edge", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 390, height: 760 });
        },
    });

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow-full", articulationId: "bow", min: 0, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for mobile replace",
            (nextSnapshot) => readStoredArticulationBank(nextSnapshot).chainAssignments.length === 1,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        await page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]').click();
        await page.locator('[data-role="articulation-range-segment-row"]').first().click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "mobile occupied row tap replaces instead of edge inserting",
            (nextSnapshot) => {
                const assignments = readStoredArticulationBank(nextSnapshot).chainAssignments;
                return assignments.length === 1
                    && assignments[0].articulationId === "pluck"
                    && assignments[0].min === 0
                    && assignments[0].max === 127;
            },
        );
        assert.deepEqual(readStoredArticulationBank(snapshot).chainAssignments, [
            { id: "chain-bow-full", articulationId: "pluck", min: 0, max: 127 },
        ]);
    } finally {
        await page.close();
    }
});

test("articulation card audition is press-hold and follows the most recently played note", async () => {
    const page = await openHarnessPage();

    async function pressAuditionAndExpect(note) {
        await clearHarnessDebugLog(page);

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        const box = await playButton.boundingBox();
        assert.notEqual(box, null);

        const clickPromise = playButton.click({ delay: 200 });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
        ]);

        await clickPromise;
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, note) },
        ]);
    }

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationBank({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').waitFor();

        await clearHarnessDebugLog(page);
        await page.keyboard.down("g");
        await page.keyboard.up("g");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 43, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 43) },
        ]);

        await pressAuditionAndExpect(43);
        await pressAuditionAndExpect(43);

        await clearHarnessDebugLog(page);
        await page.keyboard.down("k");
        await page.keyboard.up("k");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
        ]);

        await pressAuditionAndExpect(48);
    } finally {
        await page.close();
    }
});

test("opening the synth GUI does not recall or overwrite a stored selected articulation", async () => {
    const parameterEndpoints = [
        "wavetablePosition",
        "playMode",
        "glideTime",
        "pan",
        "warpMode",
        "warpAmount",
        "filterMode",
        "filterCutoff",
        "filterQ",
        "mseg1Morph",
        "distortionMode",
        "distortionWet",
        "chorusEnabled",
        "chorusMix",
    ];
    const liveParameters = {
        wavetablePosition: 0.11,
        playMode: 2,
        glideTime: 0.04,
        pan: -0.31,
        warpMode: 1,
        warpAmount: 0.18,
        filterMode: 4,
        filterCutoff: 8765,
        filterQ: 7.25,
        mseg1Morph: 0.22,
        distortionMode: 1,
        distortionWet: 0.37,
        chorusEnabled: 1,
        chorusMix: 0.48,
    };
    const storedBank = normalizeArticulationBank({
        selectedSlotId: "articulation-0",
        slots: [{
            id: "articulation-0",
            runtimeSlot: 0,
            name: "Art 1",
            snapshot: {
                parameters: {
                    wavetablePosition: 0.88,
                    playMode: 1,
                    glideTime: 0.33,
                    pan: 0.42,
                    warpMode: 3,
                    warpAmount: 0.77,
                    filterMode: 2,
                    filterCutoff: 2345,
                    filterQ: 2.5,
                    msegMorphs: [0.91, 0, 0],
                    distortionMode: 0,
                    distortionWet: 0.12,
                    chorusEnabled: 0,
                    chorusMix: 0.16,
                },
            },
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(({ stateKey, bank, parameters }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    parameterValues: parameters,
                    storedState: {
                        [stateKey]: JSON.stringify(bank),
                    },
                };
            }, {
                stateKey: ARTICULATION_STATE_KEY,
                bank: storedBank,
                parameters: liveParameters,
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-card"][data-runtime-slot="0"]') instanceof HTMLElement
        ));
        await waitForReactFrames(page, 4);

        const snapshot = await getHarnessSnapshot(page);
        for (const [endpointID, expectedValue] of Object.entries(liveParameters)) {
            assert.equal(
                Number(snapshot.parameterValues[endpointID]),
                expectedValue,
                `${endpointID} should keep the host/current value when the GUI opens`,
            );
        }

        const hydratedBank = readStoredArticulationBank(snapshot);
        assert.equal(hydratedBank.selectedSlotId, "articulation-0");
        assert.equal(hydratedBank.slots[0].snapshot.parameters.wavetablePosition, 0.88);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.warpAmount, 0.77);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.filterCutoff, 2345);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.msegMorphs[0], 0.91);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => parameterEndpoints.includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [],
        );
    } finally {
        await page.close();
    }
});

test("Add route appends an inert row and scrolls the new row into view", async () => {
    const page = await openHarnessPage();

    try {
        await page.setViewportSize({ width: 1280, height: 600 });

        for (let routeIndex = 0; routeIndex < 7; routeIndex += 1) {
            await page.getByRole("button", { name: "Add route" }).click();
            await page.waitForFunction((expectedRouteIndex) => (
                document.querySelector(`[data-role="route-row-${expectedRouteIndex}"]`) instanceof HTMLElement
            ), routeIndex + 2);
        }

        await page.waitForFunction(() => {
            const routeRow = document.querySelector('[data-role="route-row-8"]');

            if (!(routeRow instanceof HTMLElement)) {
                return false;
            }

            const rect = routeRow.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            routeSummaries(readStoredModulationState(snapshot).routes),
            Array.from({ length: 8 }, () => ({
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "wavetablePosition",
                amount: 0,
            })),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "modulationRoute"
                && Number(value?.routeIndex) === 7
                && Math.abs(Number(value?.amount)) <= 1e-9
            )),
            true,
        );
    } finally {
        await page.close();
    }
});

test("mod matrix keeps the list shell when empty and restores the seeded route when re-adding", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Remove route 1" }).click();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "route list empty after removing the seeded row",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === 0,
        );

        assert.equal(await page.getByRole("button", { name: "Add route" }).count(), 1);
        assert.equal(await page.locator('[data-role^="route-row-"]').count(), 0);
        assert.equal(await page.getByText(/add a modulation slot/i).count(), 0);
        assert.deepEqual(readStoredModulationState(snapshot).routes, []);

        await page.getByRole("button", { name: "Add route" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "seeded route returns after add",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route !== undefined
                    && route.enabled === true
                    && route.sourceKind === "mseg"
                    && route.sourceSlot === 1
                    && route.polarity === "unipolar"
                    && route.targetKind === "wavetablePosition"
                    && Math.abs(Number(route.amount)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "wavetablePosition",
            amount: 0,
        });
    } finally {
        await page.close();
    }
});

test("mod matrix source and target selects keep enough width for their menu content and bypass uses the flattened source model", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Route 1 source" }).click();

        let sourceSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 source"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 source "]'));
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
            };
        });

        assert.ok(sourceSizing.triggerWidth >= sourceSizing.widestOptionWidth);
        await page.getByRole("button", { name: "Route 1 source ENV 3" }).click();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "flattened source selection updates to ENV 3",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.sourceKind === "env" && route?.sourceSlot === 3;
            },
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "wavetablePosition",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 target" }).click();

        const targetSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 target"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 target "]'));
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
            };
        });

        assert.ok(targetSizing.triggerWidth >= targetSizing.widestOptionWidth);
        await page.getByRole("button", { name: "Route 1 target PITCH" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "target selection updates to pitch",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.targetKind === "pitchSemitones",
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "pitchSemitones",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 bypass" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "route bypass disables the first route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.enabled === false,
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: false,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "pitchSemitones",
            amount: 0,
        });
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "modulationRoute"
                && Number(value?.routeIndex) === 0
                && value?.enabled === false
            )),
            true,
        );
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob double-click entry uses the displayed units", async () => {
    const page = await openHarnessPage();

    try {
        await choosePrototypeSelectOption(page, "Route 1 target", "WARP");

        const amountKnob = page.locator('[aria-label="Route 1 amount"]');
        await amountKnob.dblclick();

        const amountInput = page.locator('input[aria-label="Route 1 amount value"]');
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("12");
        await amountInput.blur();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "typed route amount commit in displayed percent units",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "warpAmount"
                    && Math.abs(Number(route.amount) - 0.12) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "warpAmount",
            amount: 0.12,
        });
        assert.equal((await page.locator('[data-role="route-row-1"] >> text=/\\+?12%/').count()) >= 1, true);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "modulationRoute"
                && Number(value?.routeIndex) === 0
                && Math.abs(Number(value?.amount) - 0.12) <= 1e-9
            )),
            true,
        );

        await choosePrototypeSelectOption(page, "Route 1 target", "PAN");
        await amountKnob.dblclick();
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("-40");
        await amountInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed signed pan amount commit",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "pan"
                    && Math.abs(Number(route.amount) - (-0.4)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "pan",
            amount: -0.4,
        });
        assert.equal((await page.locator('[data-role="route-row-1"] >> text=/40% L/').count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("desktop envelope editor drags handles and commits compact rail values for the selected slot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.locator('input[aria-label="Pan"]').count(), 1);
        assert.equal(await page.locator('[data-role="wavetable-pan-field"]').count(), 1);
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        assert.equal(
            await page.locator('input[aria-label="Envelope decay value"]').evaluate((element) => getComputedStyle(element).textAlign),
            "left",
        );

        const initialEnvelopeState = readStoredModulationState(await getHarnessSnapshot(page)).envelopeSlots[1];

        await dragEnvelopeHandleBy(page, "adsr-attack-handle-hit-target", 110, 0);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "envelope attack drag updates slot 2",
            (nextSnapshot) => {
                const state = readStoredModulationState(nextSnapshot);
                return Number(state.envelopeSlots[1]?.attackSeconds) > 0.08
                    && Math.abs(Number(state.envelopeSlots[0]?.attackSeconds) - 0.01) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "modulationEnvelope"
                        && Number(value?.slot) === 2
                        && Number(value?.attackSeconds) > 0.08
                    ));
            },
        );

        assert.equal(Number(readStoredModulationState(snapshot).envelopeSlots[1].attackSeconds) > 0.08, true);
        assert.equal(Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[0].attackSeconds) - 0.01) <= 1e-9, true);

        const envelopeAfterAttack = readStoredModulationState(snapshot).envelopeSlots[1];

        await dragEnvelopeHandleBy(page, "adsr-decay-sustain-handle-hit-target", 160, 70);

        snapshot = await waitForHarnessSnapshot(
            page,
            "decay-sustain handle drag updates decay horizontally and sustain vertically for slot 2",
            (nextSnapshot) => {
                const state = readStoredModulationState(nextSnapshot);
                return Math.abs(Number(state.envelopeSlots[1]?.decaySeconds) - Number(envelopeAfterAttack?.decaySeconds ?? initialEnvelopeState?.decaySeconds ?? 0.25)) > 0.02
                    && Math.abs(Number(state.envelopeSlots[1]?.sustain) - Number(envelopeAfterAttack?.sustain ?? initialEnvelopeState?.sustain ?? 0.5)) > 0.05
                    && Math.abs(Number(state.envelopeSlots[0]?.decaySeconds) - 0.25) <= 1e-9
                    && Math.abs(Number(state.envelopeSlots[0]?.sustain) - 0.5) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "modulationEnvelope"
                        && Number(value?.slot) === 2
                        && Math.abs(Number(value?.decaySeconds) - Number(envelopeAfterAttack?.decaySeconds ?? initialEnvelopeState?.decaySeconds ?? 0.25)) > 0.02
                        && Math.abs(Number(value?.sustain) - Number(envelopeAfterAttack?.sustain ?? initialEnvelopeState?.sustain ?? 0.5)) > 0.05
                    ));
            },
        );

        assert.equal(
            Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[1].decaySeconds) - Number(envelopeAfterAttack?.decaySeconds ?? initialEnvelopeState?.decaySeconds ?? 0.25)) > 0.02,
            true,
        );
        assert.equal(
            Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[1].sustain) - Number(envelopeAfterAttack?.sustain ?? initialEnvelopeState?.sustain ?? 0.5)) > 0.05,
            true,
        );
        assert.equal(Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[0].decaySeconds) - 0.25) <= 1e-9, true);
        assert.equal(Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[0].sustain) - 0.5) <= 1e-9, true);

        const releaseInput = page.locator('input[aria-label="Envelope release value"]');
        await releaseInput.fill("800 ms");
        await releaseInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "compact release field commits milliseconds for slot 2",
            (nextSnapshot) => {
                const state = readStoredModulationState(nextSnapshot);
                return Math.abs(Number(state.envelopeSlots[1]?.releaseSeconds) - 0.8) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "modulationEnvelope"
                        && Number(value?.slot) === 2
                        && Math.abs(Number(value?.releaseSeconds) - 0.8) <= 1e-9
                    ));
            },
        );

        assert.equal(Math.abs(Number(readStoredModulationState(snapshot).envelopeSlots[1].releaseSeconds) - 0.8) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("desktop wavetable stage follows live effective warp state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.stageDebug && typeof rendered.stageDebug.warpMode === "number";
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("warpMode", 1);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("warpAmount", 0.18);
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 4,
                amount: 0.82,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 4
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.82) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveWarpState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 3,
                amount: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                amount: 0.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("filter controls commit mode, cutoff, and Q, and the matrix can route MSEG 1 into filter cutoff", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        const filterModeChip = page.locator('button[aria-label^="Cycle filter mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode));

        for (let guard = 0; guard < 8 && currentMode !== 4; guard += 1) {
            await filterModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "filter mode cycling",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 4);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffField = page.locator('[data-role="filter-cutoff-field"]');
        await dragLocatorBy(page, filterCutoffField, 18, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffInput = page.locator('input[aria-label="Filter cutoff"]');
        await filterCutoffInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter cutoff"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterCutoffInput, 1210);
        await filterCutoffInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter cutoff commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 1210) <= 1
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceField = page.locator('[data-role="filter-resonance-field"]');
        await dragLocatorBy(page, filterResonanceField, 10, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterQ) > 0.8;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.8),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceInput = page.locator('input[aria-label="Filter resonance"]');
        await filterResonanceInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter resonance"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterResonanceInput, 7.5);
        await filterResonanceInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter resonance commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterQ) - 7.5) <= 0.01
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01),
            true,
        );

        await choosePrototypeSelectOption(page, "Route 1 target", "CUTOFF");
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await dragLocatorBy(page, page.locator('[aria-label="Route 1 amount"]'), 0, -60);

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 targeting filter cutoff",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "filterCutoffOctaves"
                    && route?.polarity === "bipolar"
                    && Math.abs(Number(route.amount) - 3.0) <= 0.08;
            },
        );

        const finalRouteUpload = [...snapshot.sentMessages]
            .reverse()
            .find(({ endpointID, value }) => endpointID === "modulationRoute" && Number(value?.routeIndex) === 0);

        assert.deepEqual(routeSummaries(readStoredModulationState(snapshot).routes), [{
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "filterCutoffOctaves",
            amount: readStoredModulationState(snapshot).routes[0].amount,
        }]);
        assert.deepEqual(finalRouteUpload?.value, {
            routeIndex: 0,
            enabled: true,
            sourceKind: 1,
            sourceSlot: 1,
            polarityKind: 1,
            targetKind: 3,
            amount: readStoredModulationState(snapshot).routes[0].amount,
        });
        assert.equal((await page.locator('[data-role="route-row-1"] >> text=/±3\\.0[0-9] oct/').count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("desktop filter graph follows live effective filter state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        const filterCard = page.locator('[data-role="filter-card"]');
        const filterGraph = page.locator('[data-role="filter-response-graph"]');
        const filterHandle = page.locator('[data-role="filter-response-handle-hit-target"]');
        const filterCardBox = await filterCard.boundingBox();
        const filterGraphBox = await filterGraph.boundingBox();
        const filterHandleBox = await filterHandle.boundingBox();

        assert.ok(filterCardBox, "Expected filter card bounding box.");
        assert.ok(filterGraphBox, "Expected filter graph bounding box.");
        assert.ok(filterHandleBox, "Expected filter response handle bounding box.");
        assert.ok((filterGraphBox.width / filterCardBox.width) >= 0.9);
        assert.ok((filterGraphBox.height / filterCardBox.height) >= 0.9);
        assert.equal(await filterCard.getByText("Analyzer View", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Live Response", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Filter", { exact: true }).count(), 0);

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.base && rendered.filterGraphState.live;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);

        await clearHarnessDebugLog(page);
        await clickFilterGraphAt(page, 0.06, 0.08);
        await page.waitForTimeout(100);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff" || endpointID === "filterQ"),
            false,
        );

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 96, -54);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000
                && Number(snapshot.parameterValues.filterQ) > 0.707107;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.707107),
            true,
        );

        await dragFilterHandleBy(page, 0, 420);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05);

        await dragFilterHandleBy(page, 0, -1200);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 3,
                cutoffHz: 2800,
                q: 5.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === true
                && Number(rendered.filterGraphState?.live?.mode) === 3
                && Math.abs(Number(rendered.filterGraphState?.live?.cutoffHz) - 2800) <= 1;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveFilterState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 1,
                cutoffHz: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                cutoffHz: 1000,
                q: 0.707107,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);
    } finally {
        await page.close();
    }
});

test("desktop filter graph cycles graph, bars, and round-bars analyzers while keeping live spectrum updates sane", async () => {
    const page = await openHarnessPage();

    try {
        const analyzerModeChip = page.locator('button[aria-label^="Cycle analyzer view"]').first();

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.spectrum;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.hasSpectrum, false);

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 2 ? 0.03 : index === 3 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.hasSpectrum === true
                && Array.isArray(spectrum?.bandMagnitudesDb)
                && spectrum.bandMagnitudesDb.length > 0;
        });

        renderedState = await getHarnessRenderedState(page);
        const lowHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.equal(lowHeavySpectrum.hasSpectrum, true);
        assert.equal(lowHeavySpectrum.renderMode, "graph");
        assert.equal(lowHeavySpectrum.sourceBinCount, 64);
        assert.equal(lowHeavySpectrum.bandCount, 120);
        assert.ok(lowHeavySpectrum.graphPointCount > lowHeavySpectrum.bandCount);
        assert.equal(lowHeavySpectrum.bandMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.smoothedMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.peakMagnitudesDb.length, 120);
        assert.deepEqual(lowHeavySpectrum.renderGeometry, {
            kind: "graph",
            pointCount: lowHeavySpectrum.graphPointCount,
            peakPointCount: lowHeavySpectrum.graphPointCount,
        });
        assert.deepEqual(
            lowHeavySpectrum.frequencyTicks.map(({ label }) => label),
            ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k"],
        );
        assert.deepEqual(
            lowHeavySpectrum.dbTicks.map(({ label }) => label),
            ["-18", "-36", "-54", "-72", "-90"],
        );
        assert.ok(Math.max(...lowHeavySpectrum.bandMagnitudesDb) > Math.min(...lowHeavySpectrum.bandMagnitudesDb));
        const previousBandMagnitudesDb = [...lowHeavySpectrum.bandMagnitudesDb];
        const previousSmoothedMagnitudesDb = [...lowHeavySpectrum.smoothedMagnitudesDb];

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("filterSpectrum", {
                sampleRateHz: "broken",
                magnitudes: [1, 2, 3, 4, 5, 6, 7, 8],
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.deepEqual(renderedState.filterGraphState.spectrum, lowHeavySpectrum);

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: false,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "round-bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === true;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "round-bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: true,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "graph" && spectrum?.renderGeometry?.kind === "graph";
        });

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.03 : index === 58 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, previousBandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const highHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.notDeepEqual(highHeavySpectrum.bandMagnitudesDb, previousBandMagnitudesDb);
        assert.notDeepEqual(highHeavySpectrum.smoothedMagnitudesDb, previousSmoothedMagnitudesDb);
        assert.equal(highHeavySpectrum.renderMode, "graph");
        assert.equal(highHeavySpectrum.renderGeometry.kind, "graph");

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.009 : index === 58 ? 0.006 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, highHeavySpectrum.bandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const decayingSpectrum = renderedState.filterGraphState.spectrum;
        const peakBandIndex = highHeavySpectrum.peakBandIndex;
        assert.ok(decayingSpectrum.smoothedMagnitudesDb[peakBandIndex] > decayingSpectrum.bandMagnitudesDb[peakBandIndex]);
        assert.ok(decayingSpectrum.peakMagnitudesDb[peakBandIndex] >= decayingSpectrum.smoothedMagnitudesDb[peakBandIndex]);
    } finally {
        await page.close();
    }
});

test("keyboard octave controls update the mounted keyboard root note and note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await page.click('button[aria-label="Shift keyboard up one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "48");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
            ],
        );

        await page.click('button[aria-label="Shift keyboard down one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("z and x shift the mounted keyboard octave without forwarding those keys to note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("z");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "24");

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 24, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 24) },
            ],
        );

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("x");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("keyboard octave buttons disable at the configured minimum and maximum root notes", async () => {
    const page = await openHarnessPage();

    try {
        const upButton = page.locator('button[aria-label="Shift keyboard up one octave"]');
        const downButton = page.locator('button[aria-label="Shift keyboard down one octave"]');

        for (const expectedRootNote of ["48", "60", "72"]) {
            await upButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await upButton.isDisabled(), true);
        assert.equal(await downButton.isDisabled(), false);

        for (const expectedRootNote of ["60", "48", "36", "24", "12"]) {
            await downButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await downButton.isDisabled(), true);
        assert.equal(await upButton.isDisabled(), false);
    } finally {
        await page.close();
    }
});

test("MSEG editor wiring can open, add a point, move it, and close with Escape", async () => {
    const page = await openHarnessPage();

    try {
        await page.click('button[aria-label="Open MSEG editor"]');
        await page.waitForSelector("text=Modulation Shape Editor");

        const surface = page.locator('svg[data-role="mseg-editor-surface"]');
        const box = await surface.boundingBox();
        assert.ok(box);

        const addPointX = box.x + (box.width * 0.5);
        const addPointY = box.y + (box.height * 0.25);

        await clearHarnessDebugLog(page);
        await page.mouse.click(addPointX, addPointY);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "added MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 3,
        );
        let points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        const addedPoint = { ...points[1] };
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        const addedPointCircle = surface.locator("circle").nth(1);
        const addedPointBox = await addedPointCircle.boundingBox();
        assert.ok(addedPointBox);
        const addedPointCenterX = addedPointBox.x + (addedPointBox.width * 0.5);
        const addedPointCenterY = addedPointBox.y + (addedPointBox.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(addedPointCenterX, addedPointCenterY);
        await page.mouse.down();
        await page.mouse.move(addedPointCenterX + 40, addedPointCenterY - 48, { steps: 6 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "moved MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points[1]?.x > 0.5,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        assert.equal(points[0].x, 0);
        assert.equal(points[0].y, 0);
        assert.equal(points[2].x, 1);
        assert.equal(points[2].y, 1);
        assert.equal(points[0].x < points[1].x && points[1].x < points[2].x, true);
        assert.equal(points[1].x > addedPoint.x, true);
        assert.equal(points[1].y > addedPoint.y, true);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(1).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "deleted MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 2,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(0).click();
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        }));
        snapshot = await getHarnessSnapshot(page);
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );

        await page.keyboard.press("Escape");
        await page.waitForSelector("text=Modulation Shape Editor", { state: "detached" });
    } finally {
        await page.close();
    }
});

test("MSEG preview progress fill follows the selected DSP slot and clears when the monitor goes inactive", async () => {
    const page = await openHarnessPage();

    try {
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 7,
                hasActive: 1,
                positions: [0.2, 0.58, 0.86],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip);
        });

        let renderedState = await getHarnessRenderedState(page);
        let previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.2)) <= 1.5,
            true,
        );

        await page.click('button[aria-label="Select MSEG 2"]');
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip)
                && preview.progressClip.width > 100;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.58)) <= 1.5,
            true,
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 8,
                hasActive: 0,
                positions: [1, 1, 1],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview) && !preview.progressClip;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.equal(previewState.playhead, null);
        assert.equal(previewState.progressClip, null);
    } finally {
        await page.close();
    }
});

test("main MSEG morph control updates morph without taking keyboard focus and previews the effective curve while dragged", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");

        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync before morph drag",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1),
        );
        await clearHarnessDebugLog(page);
        await page.mouse.move(sliderBox.x + 2, sliderBox.y + (sliderBox.height * 0.5));
        await page.mouse.down();
        await page.mouse.move(sliderBox.x + (sliderBox.width * 0.72), sliderBox.y + (sliderBox.height * 0.5), { steps: 6 });

        await page.waitForFunction(() => Boolean(window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.morphCurvePath));
        let renderedState = await getHarnessRenderedState(page);
        assert.match(renderedState.msegPreviewState?.morphCurvePath ?? "", /^M /);

        const focusedElement = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const activeElement = viewRoot?.activeElement;

            return {
                tagName: activeElement?.tagName?.toLowerCase() ?? null,
                dataRole: activeElement?.getAttribute("data-role") ?? null,
                ariaLabel: activeElement?.getAttribute("aria-label") ?? null,
            };
        });
        assert.notEqual(focusedElement.dataRole, "mseg-morph-slider");
        assert.notEqual(focusedElement.tagName, "input");

        await page.keyboard.press("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });
        const morphMidiSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            morphMidiSnapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );

        await page.mouse.up();
        await page.waitForFunction(() => !window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.morphCurvePath);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "main MSEG morph changed",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["modulation.v2"];
                if (typeof rawState !== "string") {
                    return false;
                }

                const modulationState = JSON.parse(rawState);
                return Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.72) <= 0.04
                    && Math.abs(Number(modulationState.msegSlots?.[0]?.morph) - 0.72) <= 0.04;
            },
        );
        const modulationState = JSON.parse(String(snapshot.storedState["modulation.v2"]));
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );
        assert.equal(
            Math.abs(Number(modulationState.msegSlots[0].morph) - Number(snapshot.parameterValues.mseg1Morph)) <= 1e-9,
            true,
        );
    } finally {
        await page.close();
    }
});

test("MSEG overview playback controls update the canonical modulation state on the real desktop page", { timeout: 60_000 }, async () => {
    const isolatedServer = await startDesktopHarnessServer();
    const isolatedBrowser = await chromium.launch({ headless: true });
    const page = await isolatedBrowser.newPage();

    try {
        await page.goto(isolatedServer.baseUrl, { waitUntil: "load" });
        await waitForHarnessReady(page);
        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegPlayback" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationRoute" && Number(value?.routeIndex) === 0),
        );

        const depthInputCount = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            return viewRoot?.querySelectorAll('input[aria-label="MSEG depth"]').length ?? 0;
        });
        assert.equal(depthInputCount, 0);

        await clearHarnessDebugLog(page);
        const playbackAfterRateChange = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const rateInput = viewRoot?.querySelector('input[aria-label="MSEG rate"]');

            if (!(rateInput instanceof HTMLInputElement)) {
                throw new Error("MSEG rate input is missing.");
            }

            rateInput.value = "0.500";
            rateInput.dispatchEvent(new Event("input", { bubbles: true }));
            rateInput.dispatchEvent(new Event("change", { bubbles: true }));

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
                const rawState = snapshot.storedState["modulation.v2"];
                if (typeof rawState !== "string") {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    continue;
                }

                const modulationState = JSON.parse(rawState);
                const playback = modulationState.msegSlots?.[0]?.playback;
                if (Math.abs(Number(playback?.rate?.seconds) - 0.5) <= 1e-9) {
                    return playback;
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return JSON.parse(String(snapshot.storedState["modulation.v2"])).msegSlots?.[0]?.playback;
        });
        assert.equal(playbackAfterRateChange.rate.seconds, 0.5);
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredMsegPlayback(snapshot).rate.seconds, 0.5);

        await clearHarnessDebugLog(page);
        const playbackAfterLoopToggle = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const loopButton = Array.from(viewRoot?.querySelectorAll("button") ?? []).find((button) =>
                button.textContent?.trim() === "Looping"
            );

            if (!(loopButton instanceof HTMLButtonElement)) {
                throw new Error("MSEG loop button is missing.");
            }

            loopButton.click();

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
                const rawState = snapshot.storedState["modulation.v2"];
                if (typeof rawState !== "string") {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    continue;
                }

                const modulationState = JSON.parse(rawState);
                const playback = modulationState.msegSlots?.[0]?.playback;
                if (playback?.loop === null) {
                    return playback;
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return JSON.parse(String(snapshot.storedState["modulation.v2"])).msegSlots?.[0]?.playback;
        });
        assert.equal(playbackAfterLoopToggle.loop, null);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredMsegPlayback(snapshot).loop, null);
        assert.ok((await page.getByRole("button", { name: "One Shot" }).count()) >= 1);
    } finally {
        await page.close();
        await isolatedBrowser.close();
        await isolatedServer.stop();
    }
});

test("desktop custom-element wrapper detaches the keyboard when the host element is removed", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardAttachCalls?.length === 1;
        });

        await page.evaluate(() => {
            document.querySelector("cosimo-desktop-react-view")?.remove();
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardDetachCount === 1;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.keyboardAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.keyboardDetachCount, 1);
    } finally {
        await page.close();
    }
});

test("desktop distortion controls send live parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="distortion-card"]');
        await clearHarnessDebugLog(page);

        await page.click('[data-role="distortion-mode-option-1"]');
        await dispatchInputValueChange(page.locator('[data-role="distortion-drive-field"]'), "18.500");
        await dispatchInputValueChange(page.locator('[data-role="distortion-mix-field"]'), "0.640");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "distortion parameter updates",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionMode"
                && Number(value) === 1
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionDriveDb"
                && Math.abs(Number(value) - 18.5) <= 1e-6
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionWet"
                && Math.abs(Number(value) - 0.64) <= 1e-6
            )),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionMode"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionDriveDb"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionWet"), true);
    } finally {
        await page.close();
    }
});

test("desktop effects rack renders four vertical effect columns with chorus occupying one column", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');

        const layout = await page.evaluate(() => {
            const rack = document.querySelector('[data-role="effects-rack-card"]');
            const chorus = document.querySelector('[data-role="chorus-effect-column"]');
            const columns = Array.from(document.querySelectorAll('[data-role="effect-rack-column"]'));

            if (!(rack instanceof HTMLElement) || !(chorus instanceof HTMLElement)) {
                return null;
            }

            const rackRect = rack.getBoundingClientRect();
            const chorusRect = chorus.getBoundingClientRect();

            return {
                columnCount: columns.length,
                rackWidth: rackRect.width,
                rackHeight: rackRect.height,
                chorusWidth: chorusRect.width,
                chorusHeight: chorusRect.height,
            };
        });

        assert.ok(layout, "Expected effects rack and chorus column to render.");
        assert.equal(layout.columnCount, 4);
        assert.ok(layout.chorusWidth / layout.rackWidth >= 0.20, `Chorus column too narrow: ${JSON.stringify(layout)}`);
        assert.ok(layout.chorusWidth / layout.rackWidth <= 0.30, `Chorus column too wide: ${JSON.stringify(layout)}`);
        assert.ok(layout.chorusHeight / layout.rackHeight >= 0.90, `Chorus column should be full-height: ${JSON.stringify(layout)}`);
    } finally {
        await page.close();
    }
});

test("desktop chorus mode buttons do not visually collide in the compact effects column", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-effect-column"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 1, true);
        });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim() === "MotionClassic"
            && document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim() === "BloomLarge"
            && document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim() === "PitchLow 5th"
        ));

        const layout = await page.evaluate(() => {
            const roles = [
                "chorus-motion-mode-control",
                "chorus-bloom-mode-control",
                "chorus-ring-offset-mode-control",
            ];
            const buttons = roles.map((role) => document.querySelector(`[data-role="${role}"]`));

            if (!buttons.every((button) => button instanceof HTMLElement)) {
                return null;
            }

            const rects = buttons.map((button) => {
                const rect = button.getBoundingClientRect();
                const style = window.getComputedStyle(button);
                return {
                    role: button.getAttribute("data-role"),
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    scrollWidth: button.scrollWidth,
                    clientWidth: button.clientWidth,
                    overflowX: style.overflowX,
                    text: button.textContent?.trim(),
                };
            });

            return {
                rects,
                noBoxOverlap: rects.every((rect, index) => index === 0 || rects[index - 1].bottom <= rect.top),
                clipsInternalOverflow: rects.every((rect) => rect.overflowX === "hidden"),
                contentFits: rects.every((rect) => rect.scrollWidth <= rect.clientWidth + 1),
            };
        });

        assert.ok(layout, "Expected chorus mode buttons to render.");
        assert.equal(layout.noBoxOverlap, true, `Mode button boxes overlap: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.clipsInternalOverflow, true, `Mode button labels can paint outside their boxes: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.contentFits, true, `Longest chorus mode labels do not fit their buttons: ${JSON.stringify(layout.rects)}`);
    } finally {
        await page.close();
    }
});

test("desktop chorus controls send exact parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-effect-column"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusEnabled", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        await page.click('[data-role="chorus-enabled-control"]');
        await dispatchInputValueChange(page.locator('[data-role="chorus-mix-control"]'), "0.660");
        await page.click('[data-role="chorus-motion-mode-control"]');
        await page.click('[data-role="chorus-bloom-mode-control"]');
        await page.click('[data-role="chorus-ring-offset-mode-control"]');
        await dispatchInputValueChange(page.locator('[data-role="chorus-tone-control"]'), "0.800");
        await dispatchInputValueChange(page.locator('[data-role="chorus-feedback-control"]'), "0.700");
        await dispatchInputValueChange(page.locator('[data-role="chorus-ring-amount-control"]'), "0.500");
        await dispatchInputValueChange(page.locator('[data-role="chorus-ring-fine-control"]'), "-0.750");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus parameter updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusEnabled" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMix" && Math.abs(Number(value) - 0.66) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMotionMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusBloomMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingOffsetMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusTone" && Math.abs(Number(value) - 0.8) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusFeedback" && Math.abs(Number(value) - 0.7) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingAmount" && Math.abs(Number(value) - 0.5) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingFineSemitones" && Math.abs(Number(value) + 0.75) <= 1e-6)
            ),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "chorusMix"), true);
    } finally {
        await page.close();
    }
});

test("desktop chorus controls render host values before edits", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-effect-column"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusEnabled", 1, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.375, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 3, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 4, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusTone", 0.825, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusFeedback", 0.615, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingAmount", 0.285, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingFineSemitones", 1.25, true);
        });

        await page.waitForFunction(() => {
            const readInputValue = (role) => document.querySelector(`[data-role="${role}"]`)?.value ?? "";
            const readText = (role) => document.querySelector(`[data-role="${role}"]`)?.textContent ?? "";

            return readInputValue("chorus-mix-control") === "0.375"
                && readInputValue("chorus-tone-control") === "0.825"
                && readInputValue("chorus-feedback-control") === "0.615"
                && readInputValue("chorus-ring-amount-control") === "0.285"
                && readInputValue("chorus-ring-fine-control") === "1.25"
                && readText("chorus-enabled-control").includes("On")
                && readText("chorus-motion-mode-control").includes("Fast")
                && readText("chorus-bloom-mode-control").includes("Lg+Sh")
                && readText("chorus-ring-offset-mode-control").includes("+Oct");
        });

        const rendered = await page.evaluate(() => ({
            mix: document.querySelector('[data-role="chorus-mix-control"]')?.value,
            tone: document.querySelector('[data-role="chorus-tone-control"]')?.value,
            feedback: document.querySelector('[data-role="chorus-feedback-control"]')?.value,
            ring: document.querySelector('[data-role="chorus-ring-amount-control"]')?.value,
            ringFine: document.querySelector('[data-role="chorus-ring-fine-control"]')?.value,
            enabledText: document.querySelector('[data-role="chorus-enabled-control"]')?.textContent?.trim(),
            motionText: document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim(),
            bloomText: document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim(),
            ringOffsetText: document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim(),
        }));

        assert.deepEqual(rendered, {
            mix: "0.375",
            tone: "0.825",
            feedback: "0.615",
            ring: "0.285",
            ringFine: "1.25",
            enabledText: "On",
            motionText: "MotionFast",
            bloomText: "BloomLg+Sh",
            ringOffsetText: "Pitch+Oct",
        });
    } finally {
        await page.close();
    }
});

test("desktop chorus slider closes host gesture on pointer cancellation", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="chorus-mix-track"]').evaluate((element) => {
            element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 }));
            element.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }));
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cancelled gesture",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus slider closes host gesture when pointer movement reports no pressed buttons", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="chorus-mix-track"]').evaluate((element) => {
            element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, buttons: 1, pointerId: 9 }));
            element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 0, pointerId: 9 }));
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus zero-button pointer cleanup",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus slider ignores mouse movement after a completed drag release", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-mix-control"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.2, true);
        });
        await clearHarnessDebugLog(page);

        const slider = page.locator('[data-role="chorus-mix-control"]');
        const box = await slider.boundingBox();

        if (!box) {
            throw new Error("Expected chorus mix control bounding box.");
        }

        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(box.x + (box.width * 0.2), centerY);
        await page.mouse.down();
        await page.mouse.move(box.x + (box.width * 0.8), centerY, { steps: 8 });
        await page.mouse.up();

        const valueAfterRelease = await slider.inputValue();
        await clearHarnessDebugLog(page);

        await page.mouse.move(box.x + (box.width * 0.05), centerY, { steps: 10 });
        await page.mouse.move(box.x + (box.width * 0.95), centerY, { steps: 10 });
        await page.waitForTimeout(100);

        const valueAfterHover = await slider.inputValue();
        const snapshot = await getHarnessSnapshot(page);

        assert.equal(valueAfterHover, valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMix"), []);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
    } finally {
        await page.close();
    }
});

test("desktop chorus cycle buttons wrap through all modes", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="chorus-effect-column"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-motion-mode-control"]');
        }

        for (let i = 0; i < 6; i += 1) {
            await page.click('[data-role="chorus-bloom-mode-control"]');
        }

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-ring-offset-mode-control"]');
        }

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cycle button updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMotionMode").length >= 5
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusBloomMode").length >= 6
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusRingOffsetMode").length >= 5
            ),
        );

        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusMotionMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusBloomMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 4, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusRingOffsetMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
        );
    } finally {
        await page.close();
    }
});

test("desktop distortion wet low-pass slider renders the full 20 Hz floor", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="distortion-card"]');

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("distortionWetLPHz", 20, true);
        });

        const sliderState = await waitForPageValue(
            page,
            "desktop distortion wet low-pass slider state",
            () => {
                const input = document.querySelector('[data-role="distortion-wet-lp-field"]');

                if (!(input instanceof HTMLInputElement)) {
                    return null;
                }

                return {
                    min: input.min,
                    max: input.max,
                    value: input.value,
                };
            },
            (nextState) => Boolean(
                nextState
                && nextState.min === "0"
                && nextState.max === "1"
                && Math.abs(Number(nextState.value)) <= 0.001
            ),
        );

        assert.equal(sliderState.min, "0");
        assert.equal(sliderState.max, "1");
        assert.equal(Math.abs(Number(sliderState.value)) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop distortion graph renders occupancy bands on the fixed transfer scale", async () => {
    const page = await openHarnessPage();

    try {
        const scopeFixture = buildDistortionScopeFixture();
        const historyFixture = buildDistortionHistoryFixture();

        await page.evaluate(({ nextScopeFixture, nextHistoryFixture }) => {
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionScope(nextScopeFixture);
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionHistory(nextHistoryFixture);
        }, {
            nextScopeFixture: scopeFixture,
            nextHistoryFixture: historyFixture,
        });

        const renderedState = await waitForPageValue(
            page,
            "desktop distortion graph state",
            () => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().distortionGraphState,
            (graphState) => Boolean(
                graphState
                && graphState.transfer?.occupancySegmentCount > 0
                && graphState.history?.validBinCount > 0
            ),
        );
        const overlayState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;

            return {
                occupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-occupancy"]').length ?? 0,
                clippedOccupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-occupancy"]').length ?? 0,
                historyOutputColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-output-column"]').length ?? 0,
                historyRemovedColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-removed-column"]').length ?? 0,
                legacyTraceCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-trace"]').length ?? 0,
                legacyClippedPointCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-point"]').length ?? 0,
            };
        });

        assert.equal(renderedState.displayRange, 2);
        assert.equal(renderedState.inputPeak > renderedState.outputPeak, true);
        assert.equal(renderedState.removedPeak > 0.1, true);
        assert.equal(renderedState.clippedSampleCount > 0, true);
        assert.equal(renderedState.transfer.occupancySegmentCount > 0, true);
        assert.equal(renderedState.transfer.clippedOccupancySegmentCount > 0, true);
        assert.equal(renderedState.history.binCount, historyFixture.binCount);
        assert.equal(renderedState.history.validBinCount, historyFixture.validBinCount);
        assert.equal(renderedState.history.clippedBinCount > 0, true);
        assert.equal(renderedState.history.removedPeak > 0.1, true);
        assert.equal(overlayState.occupancyCount > 0, true);
        assert.equal(overlayState.clippedOccupancyCount > 0, true);
        assert.equal(overlayState.historyOutputColumnCount, historyFixture.binCount);
        assert.equal(overlayState.historyRemovedColumnCount > 0, true);
        assert.equal(overlayState.legacyTraceCount, 0);
        assert.equal(overlayState.legacyClippedPointCount, 0);
    } finally {
        await page.close();
    }
});
