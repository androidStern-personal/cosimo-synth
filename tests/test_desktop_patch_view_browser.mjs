import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
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

function buildShortMidi(status, noteNumber, velocity = 0) {
    return status | (noteNumber << 8) | (velocity << 16);
}

function readStoredModulationState(snapshot) {
    return deserializeModulationState(snapshot.storedState["modulation.v1"]);
}

function readStoredMsegShape(snapshot, slotIndex = 0) {
    return readStoredModulationState(snapshot).msegSlots[slotIndex].shape;
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

async function openHarnessPage({
    beforeGoto = null,
} = {}) {
    const page = await browser.newPage();

    if (typeof beforeGoto === "function") {
        await beforeGoto(page);
    }

    await page.goto(server.baseUrl, { waitUntil: "load" });
    await waitForHarnessReady(page);
    return page;
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
        .find(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1);

    assert.ok(lastBufferMessage, "Expected a modulationMsegBuffer upload for slot 1.");
    assert.deepEqual(lastBufferMessage.value, {
        slot: 1,
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

test("wavetable selection commits the desired table and retry uses the runtime retry event", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await page.locator(".cosimo-stage .truncate").textContent())?.trim();
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

        const audibleTableName = (await page.locator(".cosimo-stage .truncate").textContent())?.trim();
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
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return (keyboardDebug?.handledKeys?.length ?? 0) === 2;
        });

        keyboardDebug = await getKeyboardDebug(page);
        assert.deepEqual(
            keyboardDebug.handledKeys.slice(-2).map(({ key, isDown }) => ({ key, isDown })),
            [
                { key: "a", isDown: true },
                { key: "a", isDown: false },
            ],
        );

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
                const rawState = snapshot.storedState["modulation.v1"];
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
            return JSON.parse(String(snapshot.storedState["modulation.v1"])).msegSlots?.[0]?.playback;
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
                const rawState = snapshot.storedState["modulation.v1"];
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
            return JSON.parse(String(snapshot.storedState["modulation.v1"])).msegSlots?.[0]?.playback;
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
