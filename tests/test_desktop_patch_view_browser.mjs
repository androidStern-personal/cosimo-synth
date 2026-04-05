import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import { deserializeMsegShape, renderMsegShape } from "../patch_gui/mseg.js";

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

function readStoredJson(snapshot, key) {
    const rawValue = snapshot.storedState[key];

    if (typeof rawValue !== "string") {
        return rawValue ?? null;
    }

    return JSON.parse(rawValue);
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
        const patchView = createPatchView(patchConnection);
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
    const storedShape = deserializeMsegShape(snapshot.storedState["mseg1.shape"]);
    const expectedBuffer = Array.from(renderMsegShape(storedShape));
    const lastBufferMessage = [...snapshot.sentMessages]
        .reverse()
        .find(({ endpointID }) => endpointID === "mseg1Buffer");

    assert.ok(lastBufferMessage, "Expected an mseg1Buffer upload.");
    assert.deepEqual(lastBufferMessage.value, expectedBuffer);
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
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Buffer"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Playback"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Depth"), true);
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
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("#mount > pre").count(), 0);

        const builtBundleSnapshot = await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot());
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Buffer"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Playback"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Depth"),
            true,
        );
        assert.deepEqual(builtBundleSnapshot.keyboardDebug?.attachCalls ?? [], [{ endpointID: "midiIn" }]);
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
            const scrollRegion = host?.shadowRoot?.querySelector('[data-role="desktop-scroll-region"]');

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
            const scrollRegion = host?.shadowRoot?.querySelector('[data-role="desktop-scroll-region"]');

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

test("warp controls commit mode, amount, and MSEG depth on the desktop harness", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Warp mode"]', "3");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.warpMode) === 3;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "warpMode"),
            [{ endpointID: "warpMode", value: 3 }],
        );
        assert.equal(await page.locator('select[aria-label="Warp mode"]').inputValue(), "3");

        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Warp mode"]', "4");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.warpMode) === 4;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "warpMode"),
            [{ endpointID: "warpMode", value: 4 }],
        );
        assert.equal(await page.locator('select[aria-label="Warp mode"]').inputValue(), "4");

        await clearHarnessDebugLog(page);
        await dispatchInputValueChange(page.locator('input[aria-label="Warp amount"]'), 0.72);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.warpAmount) - 0.72) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "warpAmount"),
            [{ endpointID: "warpAmount", value: 0.72 }],
        );

        await clearHarnessDebugLog(page);
        await dispatchInputValueChange(page.locator('input[aria-label="Warp MSEG depth"]'), -0.35);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.warpMsegDepth) - (-0.35)) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "warpMsegDepth"),
            [{ endpointID: "warpMsegDepth", value: -0.35 }],
        );
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

test("filter controls commit mode, cutoff, Q, and MSEG depth on the desktop harness", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Filter mode"]', "4");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterMode) === 4;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "filterMode"),
            [{ endpointID: "filterMode", value: 4 }],
        );

        await clearHarnessDebugLog(page);
        await dispatchInputValueChange(page.locator('input[aria-label="Filter cutoff"]'), 0.61);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1200;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1200),
            true,
        );

        await clearHarnessDebugLog(page);
        await dispatchInputValueChange(page.locator('input[aria-label="Filter resonance"]'), 0.37);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterQ) > 7.0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 7.0),
            true,
        );

        await clearHarnessDebugLog(page);
        await dispatchInputValueChange(page.locator('input[aria-label="Filter MSEG depth"]'), -2.5);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterMsegDepth) - (-2.5)) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "filterMsegDepth"),
            [{ endpointID: "filterMsegDepth", value: -2.5 }],
        );
    } finally {
        await page.close();
    }
});

test("desktop filter graph follows live effective filter state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.base && rendered.filterGraphState.live;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);

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

test("desktop filter graph renders smoothed spectrum bands with readable axes and ignores malformed updates", async () => {
    const page = await openHarnessPage();

    try {
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
        assert.equal(lowHeavySpectrum.sourceBinCount, 64);
        assert.equal(lowHeavySpectrum.bandCount, 120);
        assert.equal(lowHeavySpectrum.bandMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.smoothedMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.peakMagnitudesDb.length, 120);
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
        await page.waitForSelector("text=Fixed Wavetable Route");

        const surface = page.locator('svg[data-role="mseg-editor-surface"]');
        const box = await surface.boundingBox();
        assert.ok(box);

        const addPointX = box.x + (box.width * 0.5);
        const addPointY = box.y + (box.height * 0.25);

        await clearHarnessDebugLog(page);
        await page.mouse.click(addPointX, addPointY);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const shape = snapshot.storedState["mseg1.shape"];

            if (typeof shape !== "string") {
                return false;
            }

            const parsedShape = JSON.parse(shape);
            return Array.isArray(parsedShape.points) && parsedShape.points.length === 3;
        });

        let snapshot = await getHarnessSnapshot(page);
        let points = readStoredJson(snapshot, "mseg1.shape").points;
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

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const shape = snapshot.storedState["mseg1.shape"];

            if (typeof shape !== "string") {
                return false;
            }

            const parsedShape = JSON.parse(shape);
            return Array.isArray(parsedShape.points) && parsedShape.points[1] && parsedShape.points[1].x > 0.5;
        });

        snapshot = await getHarnessSnapshot(page);
        points = readStoredJson(snapshot, "mseg1.shape").points;
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
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const shape = snapshot.storedState["mseg1.shape"];

            if (typeof shape !== "string") {
                return false;
            }

            const parsedShape = JSON.parse(shape);
            return Array.isArray(parsedShape.points) && parsedShape.points.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        points = readStoredJson(snapshot, "mseg1.shape").points;
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
        points = readStoredJson(snapshot, "mseg1.shape").points;
        assert.equal(points.length, 2);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Buffer"),
            false,
        );

        await page.keyboard.press("Escape");
        await page.waitForSelector("text=Fixed Wavetable Route", { state: "detached" });
    } finally {
        await page.close();
    }
});

test("MSEG overview controls update the real desktop page depth, playback rate, and loop state", { timeout: 60_000 }, async () => {
    const isolatedServer = await startDesktopHarnessServer();
    const isolatedBrowser = await chromium.launch({ headless: true });
    const page = await isolatedBrowser.newPage();

    try {
        await page.goto(isolatedServer.baseUrl, { waitUntil: "load" });
        await waitForHarnessReady(page);
        const overviewRanges = page.locator(".cosimo-surface input.cosimo-range");
        await overviewRanges.nth(1).waitFor();
        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync",
            (snapshot) => snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Buffer")
                && snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Playback")
                && snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Depth"),
        );

        await clearHarnessDebugLog(page);
        const depthValue = await page.evaluate(async () => {
            const shadowRoot = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const depthInput = shadowRoot?.querySelectorAll("input.cosimo-range")?.[0];

            if (!(depthInput instanceof HTMLInputElement)) {
                throw new Error("MSEG depth input is missing.");
            }

            depthInput.value = "0.750";
            depthInput.dispatchEvent(new Event("input", { bubbles: true }));
            depthInput.dispatchEvent(new Event("change", { bubbles: true }));

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const nextValue = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.depth"];
                if (Number(nextValue) === 0.75) {
                    return nextValue;
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            return window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.depth"];
        });
        assert.equal(Number(depthValue), 0.75);

        await clearHarnessDebugLog(page);
        const playbackAfterRateChange = await page.evaluate(async () => {
            const shadowRoot = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const rateInput = shadowRoot?.querySelectorAll("input.cosimo-range")?.[1];

            if (!(rateInput instanceof HTMLInputElement)) {
                throw new Error("MSEG rate input is missing.");
            }

            rateInput.value = "0.500";
            rateInput.dispatchEvent(new Event("input", { bubbles: true }));
            rateInput.dispatchEvent(new Event("change", { bubbles: true }));

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const playback = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.playback"];
                if (typeof playback === "string" && Math.abs(Number(JSON.parse(playback).rate.seconds) - 0.5) <= 1e-9) {
                    return playback;
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            return window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.playback"];
        });
        assert.equal(JSON.parse(playbackAfterRateChange).rate.seconds, 0.5);

        await clearHarnessDebugLog(page);
        const playbackAfterLoopToggle = await page.evaluate(async () => {
            const shadowRoot = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const loopButton = Array.from(shadowRoot?.querySelectorAll("button") ?? []).find((button) =>
                button.textContent?.trim() === "Looping"
            );

            if (!(loopButton instanceof HTMLButtonElement)) {
                throw new Error("MSEG loop button is missing.");
            }

            loopButton.click();

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const playback = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.playback"];
                if (typeof playback === "string" && JSON.parse(playback).loop === null) {
                    return playback;
                }
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            return window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["mseg1.playback"];
        });
        assert.equal(JSON.parse(playbackAfterLoopToggle).loop, null);
        assert.equal(await page.getByRole("button", { name: "One Shot" }).count(), 1);
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
