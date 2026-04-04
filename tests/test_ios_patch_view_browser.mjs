import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
} from "../patch_gui/mseg.js";

import {
    clearIOSHarnessFailingResources,
    clearIOSHarnessDebugLog,
    closeIOSHarnessPage,
    getIOSHarnessRenderedState,
    getIOSHarnessSnapshot,
    openIOSHarnessPage,
    setIOSHarnessFailingResource,
    setIOSHarnessParameterValue,
    setIOSHarnessRuntimeState,
    setIOSStoredStateValue,
    startIOSHarnessServer,
    waitForIOSHarnessReady,
} from "./helpers/ios_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

let server;
let browser;
let factoryCatalog;
const IOS_MSEG_ORIENTATION_SHAPE = {
    format: "cosimo.mseg.shape",
    version: 1,
    name: "Orientation Check",
    globalSmooth: false,
    points: [
        { x: 0, y: 0, curvePower: 0 },
        { x: 0.18, y: 0.82, curvePower: 0 },
        { x: 0.72, y: 0.35, curvePower: 0 },
        { x: 1, y: 1, curvePower: 0 },
    ],
};

async function waitForSnapshot(page, description, predicate, { attempts = 80, delayMs = 50 } = {}) {
    let lastSnapshot = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastSnapshot = await getIOSHarnessSnapshot(page);
        if (predicate(lastSnapshot)) {
            return lastSnapshot;
        }
        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for ${description}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function waitForRenderedState(page, description, predicate, { attempts = 80, delayMs = 50 } = {}) {
    let lastState = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastState = await getIOSHarnessRenderedState(page);
        if (predicate(lastState)) {
            return lastState;
        }
        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for ${description}. Last rendered state: ${JSON.stringify(lastState)}`);
}

async function waitForStableRenderedState(
    page,
    description,
    predicate,
    signatureForState,
    {
        attempts = 80,
        delayMs = 50,
        stablePasses = 3,
    } = {},
) {
    let lastState = null;
    let consecutiveMatches = 0;
    let lastSignature = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        lastState = await getIOSHarnessRenderedState(page);

        if (!predicate(lastState)) {
            consecutiveMatches = 0;
            lastSignature = null;
            await page.waitForTimeout(delayMs);
            continue;
        }

        const signature = JSON.stringify(signatureForState(lastState));
        if (signature === lastSignature) {
            consecutiveMatches += 1;
        } else {
            lastSignature = signature;
            consecutiveMatches = 1;
        }

        if (consecutiveMatches >= stablePasses) {
            return lastState;
        }

        await page.waitForTimeout(delayMs);
    }

    throw new Error(`Timed out waiting for stable ${description}. Last rendered state: ${JSON.stringify(lastState)}`);
}

async function getVisibleShadowElementIndex(page, selector) {
    return page.evaluate((targetSelector) => {
        const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
        const elements = Array.from(shadowRoot?.querySelectorAll(targetSelector) ?? []);

        return elements.findIndex((element) => {
            if (!(element instanceof Element)) {
                return false;
            }

            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                !("hidden" in element) || !element.hidden
            ) && style.display !== "none"
                && style.visibility !== "hidden"
                && style.pointerEvents !== "none"
                && rect.width > 0
                && rect.height > 0
                && rect.bottom > 0
                && rect.right > 0;
        });
    }, selector);
}

async function getShadowLocator(page, selector) {
    const visibleIndex = await getVisibleShadowElementIndex(page, selector);
    if (visibleIndex < 0) {
        throw new Error(`Could not find a visible element for ${selector}.`);
    }

    return page.locator("cosimo-synth-view").locator(selector).nth(visibleIndex);
}

async function clickShadowButton(page, selector) {
    const locator = await getShadowLocator(page, selector);
    await locator.click({ timeout: 750 });
}

async function selectShadowOption(page, selector, nextValue) {
    const locator = await getShadowLocator(page, selector);
    await locator.selectOption(String(nextValue));
}

async function fillShadowInput(page, selector, nextValue) {
    const locator = await getShadowLocator(page, selector);
    await locator.fill(String(nextValue));
}

async function readShadowState(page) {
    return page.evaluate(() => {
        const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
        const octaveDown = shadowRoot?.querySelector(".octave-down");
        const octaveUp = shadowRoot?.querySelector(".octave-up");
        return {
            octaveDownDisabled: octaveDown instanceof HTMLButtonElement ? octaveDown.disabled : null,
            octaveUpDisabled: octaveUp instanceof HTMLButtonElement ? octaveUp.disabled : null,
        };
    });
}

async function getShadowElementRect(page, selector) {
    return page.evaluate((targetSelector) => {
        const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
        const elements = Array.from(shadowRoot?.querySelectorAll(targetSelector) ?? []);
        const element = elements.find((candidate) => {
            if (!(candidate instanceof Element)) {
                return false;
            }

            const style = getComputedStyle(candidate);
            const rect = candidate.getBoundingClientRect();
            return (
                !("hidden" in candidate) || !candidate.hidden
            ) && style.display !== "none"
                && style.visibility !== "hidden"
                && style.pointerEvents !== "none"
                && rect.width > 0
                && rect.height > 0
                && rect.bottom > 0
                && rect.right > 0;
        });

        if (!(element instanceof Element)) {
            throw new Error(`Could not find element ${targetSelector}.`);
        }

        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        };
    }, selector);
}

async function dispatchTouchDrag(page, start, end) {
    const client = await page.context().newCDPSession(page);

    try {
        await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{
                x: start.x,
                y: start.y,
                radiusX: 4,
                radiusY: 4,
                force: 1,
                id: 1,
            }],
        });

        const steps = 6;
        for (let index = 1; index <= steps; index += 1) {
            const progress = index / steps;
            await client.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 4,
                    radiusY: 4,
                    force: 1,
                    id: 1,
                }],
            });
        }

        await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        });
    } finally {
        await client.detach();
    }
}

async function tapShadowElementWithTouch(page, selector, x, y) {
    const rect = await getShadowElementRect(page, selector);
    const client = await page.context().newCDPSession(page);

    try {
        await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{
                x: rect.left + x,
                y: rect.top + y,
                radiusX: 4,
                radiusY: 4,
                force: 1,
                id: 1,
            }],
        });
        await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        });
    } finally {
        await client.detach();
    }
}

async function dragAcrossShadowElement(page, selector, start, end) {
    const rect = await getShadowElementRect(page, selector);
    await dispatchTouchDrag(
        page,
        { x: rect.left + start.x, y: rect.top + start.y },
        { x: rect.left + end.x, y: rect.top + end.y },
    );
}

async function startShadowMutationCounter(page, selector, counterKey) {
    await page.evaluate(({ targetSelector, key }) => {
        const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
        const target = shadowRoot?.querySelector(targetSelector);

        if (!(target instanceof Element)) {
            throw new Error(`Could not observe ${targetSelector}.`);
        }

        const observer = new MutationObserver((records) => {
            const counters = (window.__COSIMO_MUTATION_COUNTERS__ ??= {});
            counters[key] = (counters[key] ?? 0) + records.length;
        });

        const observers = (window.__COSIMO_MUTATION_OBSERVERS__ ??= {});
        const counters = (window.__COSIMO_MUTATION_COUNTERS__ ??= {});
        observers[key]?.disconnect?.();
        observer.observe(target, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
        });
        observers[key] = observer;
        counters[key] = 0;
    }, { targetSelector: selector, key: counterKey });
}

async function stopShadowMutationCounter(page, counterKey) {
    return page.evaluate((key) => {
        const observers = window.__COSIMO_MUTATION_OBSERVERS__ ?? {};
        const counters = window.__COSIMO_MUTATION_COUNTERS__ ?? {};
        observers[key]?.disconnect?.();
        delete observers[key];
        const count = counters[key] ?? 0;
        delete counters[key];
        return count;
    }, counterKey);
}

async function clickOctaveButtonUntilRootNote(page, selector, expectedRootNote) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const renderedState = await getIOSHarnessRenderedState(page);
        if (renderedState.keyboardRootNote === String(expectedRootNote)) {
            return renderedState;
        }

        await clickShadowButton(page, selector);
    }

    throw new Error(`Timed out stepping ${selector} to root note ${expectedRootNote}.`);
}

function assertRectHasArea(rect, description) {
    assert.ok(rect, `${description} should exist.`);
    assert.ok(rect.width > 0, `${description} width should be positive.`);
    assert.ok(rect.height > 0, `${description} height should be positive.`);
}

function getPointAtFraction(points, fraction) {
    const index = Math.max(0, Math.min(points.length - 1, Math.round((points.length - 1) * fraction)));
    return points[index];
}

function curveMatchesHorizontalFixture(points) {
    if (points.length < 4) {
        return false;
    }

    const start = getPointAtFraction(points, 0);
    const earlyHigh = getPointAtFraction(points, 0.18);
    const laterLow = getPointAtFraction(points, 0.72);
    const end = getPointAtFraction(points, 0.98);
    return start.x < earlyHigh.x
        && earlyHigh.x < laterLow.x
        && laterLow.x < end.x
        && end.y < earlyHigh.y
        && earlyHigh.y < laterLow.y
        && laterLow.y < start.y;
}

function curveMatchesVerticalFixture(points) {
    if (points.length < 4) {
        return false;
    }

    const start = getPointAtFraction(points, 0);
    const earlyHigh = getPointAtFraction(points, 0.18);
    const laterLow = getPointAtFraction(points, 0.72);
    const end = getPointAtFraction(points, 0.98);
    return start.y < earlyHigh.y
        && earlyHigh.y < laterLow.y
        && laterLow.y < end.y
        && start.x < laterLow.x
        && laterLow.x < earlyHigh.x
        && earlyHigh.x < end.x;
}

function assertPortraitModalMatchesInjectedFixture(pointCenters) {
    assert.equal(pointCenters.length, 4, `Expected four rendered modal control points, got ${pointCenters.length}.`);
    const [start, earlyHigh, laterLow, finalHigh] = pointCenters;
    assert.ok(
        start.cx < laterLow.cx && laterLow.cx < earlyHigh.cx && earlyHigh.cx < finalHigh.cx,
        "Portrait modal should render the injected fixture with point values ordered left-to-right as start, later low, early high, final high.",
    );
    assert.ok(
        start.cy < earlyHigh.cy && earlyHigh.cy < laterLow.cy && laterLow.cy < finalHigh.cy,
        "Portrait modal should render the injected fixture with time running top-to-bottom across the four control points.",
    );
}

function getIndependentMsegPoint(modalRect, surfaceX, surfaceY, orientation) {
    const insetX = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_HORIZONTAL_PADDING_PX;
    const insetY = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_VERTICAL_PADDING_PX;
    const plotWidth = modalRect.width - (insetX * 2);
    const plotHeight = modalRect.height - (insetY * 2);

    if (orientation === "vertical") {
        return {
            x: Math.max(0, Math.min(1, (surfaceY - insetY) / plotHeight)),
            y: Math.max(0, Math.min(1, (surfaceX - insetX) / plotWidth)),
        };
    }

    return {
        x: Math.max(0, Math.min(1, (surfaceX - insetX) / plotWidth)),
        y: Math.max(0, Math.min(1, 1 - ((surfaceY - insetY) / plotHeight))),
    };
}

before(async () => {
    factoryCatalog = JSON.parse(
        await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8"),
    );
    server = await startIOSHarnessServer();
    browser = await chromium.launch({
        headless: true,
    });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("mounted iPhone host page boots through patch_gui/index.ios.html and loads catalog text plus source audio through the expected paths", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        const renderedState = await getIOSHarnessRenderedState(page);
        const snapshot = await waitForSnapshot(
            page,
            "initial source-audio fetch",
            (nextSnapshot) => nextSnapshot.fetchedUrls.some((url) => url.includes("/assets/factory_sources/")),
        );

        assert.equal(renderedState.errorText, null);
        assert.match(renderedState.currentURL, /\/patch_gui\/index\.ios\.html$/);
        assert.equal(renderedState.containerExists, true);
        assert.equal(renderedState.hostPageBootSource, "bundle");
        assert.equal(renderedState.hostPageViewActive, true);
        assert.match(renderedState.viewportMeta, /viewport-fit=cover/);
        assert.equal(renderedState.hasStage, true);
        assert.equal(renderedState.hasKeyboard, true);
        assert.equal(renderedState.hasMsegLauncher, true);
        assert.equal(renderedState.footerVisible, true);
        assert.equal(renderedState.keyboardAttachedEndpoint, "midiIn");
        assert.equal(renderedState.keyboardNoteCount, "18");
        assert.equal(snapshot.readyNotificationCount, 1);
        assert.equal(snapshot.bundledFallbackRequestCount, 0);
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "runtimeSyncRequest" && message.value === 1
        )));
        assert.ok(snapshot.resourceReads.some((entry) => (
            entry.kind === "text" && entry.path === "assets/factory-bank-catalog.json"
        )));
        assert.ok(snapshot.fetchedUrls.some((url) => url.includes("/assets/factory_sources/")));
        assert.equal(snapshot.resourceReads.some((entry) => entry.kind === "audio-bridge"), false);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone host page loads BS2 - Acid through the URL path instead of the bridged audio path", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });
    const bs2Index = factoryCatalog.tables.findIndex((table) => table.sourceWav === "assets/factory_sources/imported/BS2 - Acid.wav");
    assert.notEqual(bs2Index, -1, "Could not find BS2 - Acid in the factory catalog.");

    try {
        await waitForIOSHarnessReady(page);
        await clearIOSHarnessDebugLog(page);
        await selectShadowOption(page, ".table-select-overlay", bs2Index);
        await setIOSHarnessRuntimeState(page, {
            desiredTableIndex: bs2Index,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: true,
            loadingTableIndex: bs2Index,
            loadingGeneration: 9,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
        });

        const snapshot = await waitForSnapshot(
            page,
            "BS2 source-audio URL fetch",
            (nextSnapshot) => (
                nextSnapshot.fetchedUrls.some((url) => url.includes("BS2%20-%20Acid.wav"))
                && nextSnapshot.sentMessages.some((message) => (
                    message.endpointID === "wavetableSelect" && message.value === bs2Index
                ))
            ),
        );

        assert.ok(snapshot.fetchedUrls.some((url) => (
            url.includes("/assets/factory_sources/imported/BS2%20-%20Acid.wav")
        )));
        assert.equal(
            snapshot.resourceReads.some((entry) => (
                entry.kind === "audio-bridge" && entry.path === "assets/factory_sources/imported/BS2 - Acid.wav"
            )),
            false,
        );
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone shell shows the native library recovery message and Display unavailable when a source wavetable file is missing", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });
    const targetTableIndex = Math.min(2, Math.max(1, factoryCatalog.tables.length - 1));
    const targetTable = factoryCatalog.tables[targetTableIndex];

    assert.ok(targetTable, "Need a non-default factory table to test mounted failure presentation.");
    assert.equal(typeof targetTable.sourceWav, "string");

    try {
        await waitForIOSHarnessReady(page);
        await setIOSHarnessFailingResource(page, targetTable.sourceWav, 404);
        await clearIOSHarnessDebugLog(page);
        await selectShadowOption(page, ".table-select-overlay", targetTableIndex);
        await setIOSHarnessRuntimeState(page, {
            desiredTableIndex: targetTableIndex,
            desiredIntentSerial: 8,
            serviceState: 1,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: true,
            loadingTableIndex: targetTableIndex,
            loadingGeneration: 12,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        });

        const renderedState = await waitForRenderedState(
            page,
            "mounted source-wavetable failure UI",
            (nextState) => (
                nextState.bankReadout === "Display unavailable"
                && /Could not load wavetable bank:/.test(nextState.displayStatus ?? "")
            ),
        );

        assert.match(renderedState.displayStatus, /Failed to fetch resource|404/);
        assert.match(renderedState.displayStatus, /Import the factory wavetable zip from the native library bar, then reopen the patch\./);
        assert.equal(renderedState.bankReadout, "Display unavailable");
    } finally {
        await clearIOSHarnessFailingResources(page);
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone shell keeps the audible table visible while a new selection is pending, exposes retry on failure, and clears the failure when the requested table becomes active", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });
    const selectedTable = factoryCatalog.tables[0];
    const desiredTable = factoryCatalog.tables[1];

    try {
        await waitForIOSHarnessReady(page);
        await clearIOSHarnessDebugLog(page);
        await setIOSHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 4,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 7,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 8,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
        });

        let renderedState = await waitForRenderedState(
            page,
            "pending table presentation",
            (nextState) => (
                nextState.bankReadout?.includes(`${selectedTable.name} -> ${desiredTable.name}`)
                && nextState.displayStatus === `Loading ${desiredTable.name}…`
            ),
        );
        assert.equal(renderedState.displayStatus, `Loading ${desiredTable.name}…`);
        assert.equal(renderedState.retryHidden, true);

        await setIOSHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 5,
            serviceState: 0,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 7,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 8,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        renderedState = await waitForRenderedState(
            page,
            "retryable failure presentation",
            (nextState) => (
                nextState.retryHidden === false
                && nextState.retryDisabled === false
                && /Wavetable load timed out\./.test(nextState.bankReadout ?? "")
            ),
        );
        assert.match(renderedState.bankReadout, /Wavetable load timed out\./);
        assert.equal(renderedState.retryDisabled, false);

        await clickShadowButton(page, ".table-retry-button");
        let snapshot = await waitForSnapshot(
            page,
            "retry request message",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => message.endpointID === "retryDesiredTableRequest"),
        );
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "retryDesiredTableRequest" && message.value === 1
        )));
        renderedState = await waitForRenderedState(
            page,
            "retry returns the mounted iPhone UI to the loading presentation",
            (nextState) => (
                nextState.retryHidden === true
                && nextState.displayStatus === `Loading ${desiredTable.name}…`
                && nextState.bankReadout?.includes(`${selectedTable.name} -> ${desiredTable.name}`)
            ),
        );
        assert.equal(renderedState.displayStatus, `Loading ${desiredTable.name}…`);
        assert.equal(renderedState.retryHidden, true);

        await setIOSHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 6,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 1,
            activeGeneration: 9,
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

        renderedState = await waitForRenderedState(
            page,
            "failure cleared after requested table becomes active",
            (nextState) => (
                nextState.bankReadout === desiredTable.name
                && nextState.retryHidden === true
                && nextState.displayStatus === `${desiredTable.frameCount} shapes`
            ),
        );
        assert.equal(renderedState.displayStatus, `${desiredTable.frameCount} shapes`);
        snapshot = await getIOSHarnessSnapshot(page);
        assert.equal(snapshot.runtimeState.activeTableIndex, 1);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone play mode and glide controls sync parameter updates and emit user edits", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await setIOSHarnessParameterValue(page, "playMode", 2);
        await setIOSHarnessParameterValue(page, "glideTime", 1.5);

        let renderedState = await waitForRenderedState(
            page,
            "parameter-synced play and glide controls",
            (nextState) => nextState.playModeValue === "2" && nextState.glideReadout === "1.500 s",
        );
        assert.equal(renderedState.glideValue, "1");

        await clearIOSHarnessDebugLog(page);
        await selectShadowOption(page, ".play-mode-select", 1);
        await fillShadowInput(page, ".glide-time-slider", "0.375");

        const snapshot = await waitForSnapshot(
            page,
            "play and glide user edits",
            (nextSnapshot) => {
                const sentPairs = nextSnapshot.sentMessages.map((message) => `${message.endpointID}:${message.value}`);
                return sentPairs.includes("playMode:1") && sentPairs.includes("glideTime:0.375");
            },
        );
        renderedState = await getIOSHarnessRenderedState(page);
        assert.equal(renderedState.playModeValue, "1");
        assert.equal(renderedState.glideReadout, "0.375 s");
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "playMode" && message.value === 1
        )));
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "glideTime" && Number(message.value) === 0.375
        )));
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone host page keeps the footer keyboard docked at the shell bottom in portrait and landscape, and honors host inset overrides", async () => {
    for (const viewportSize of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
    ]) {
        const page = await openIOSHarnessPage(browser, server.baseUrl, { viewportSize });

        try {
            await waitForIOSHarnessReady(page);
            let renderedState = await getIOSHarnessRenderedState(page);

            assert.equal(renderedState.hostPageViewActive, true);
            assert.match(renderedState.viewportMeta, /viewport-fit=cover/);
            assert.equal(renderedState.shellPaddingTop, "0px");
            assert.equal(renderedState.shellPaddingBottom, "0px");
            assert.equal(renderedState.shellPaddingLeft, "0px");
            assert.equal(renderedState.shellPaddingRight, "0px");
            assert.equal(renderedState.keyboardAttachedEndpoint, "midiIn");
            assert.equal(renderedState.keyboardNoteCount, "18");
            assertRectHasArea(renderedState.shellRect, "iPhone shell");
            assertRectHasArea(renderedState.mainViewRect, "iPhone main view");
            assertRectHasArea(renderedState.footerRect, "iPhone keyboard footer");
            assertRectHasArea(renderedState.keyboardRect, "iPhone keyboard");
            assertRectHasArea(renderedState.noteHolderRect, "iPhone keyboard note holder");
            assert.ok(Math.abs(renderedState.footerBottomGap) <= 1, "Footer should stay aligned with the shell bottom edge.");
            assert.ok(Math.abs(renderedState.mainToFooterGap) <= 1, "Main view should meet the footer without a gap.");

            await page.evaluate(() => {
                const host = document.querySelector("cosimo-synth-view");
                if (!(host instanceof HTMLElement)) {
                    throw new Error("Could not find the iPhone host element.");
                }

                host.style.setProperty("--cosimo-ios-top-inset", "18px");
                host.style.setProperty("--cosimo-ios-right-inset", "22px");
                host.style.setProperty("--cosimo-ios-bottom-inset", "24px");
                host.style.setProperty("--cosimo-ios-left-inset", "14px");
            });

            renderedState = await waitForRenderedState(
                page,
                `host inset override at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => (
                    nextState.shellPaddingTop === "18px"
                    && nextState.shellPaddingRight === "22px"
                    && nextState.shellPaddingBottom === "24px"
                    && nextState.shellPaddingLeft === "14px"
                ),
            );
            assert.ok(
                Math.abs(renderedState.footerBottomGap - 24) <= 1,
                "Footer should move up by the injected bottom inset while staying docked to the shell padding edge.",
            );
            assert.ok(
                Math.abs((renderedState.mainViewRect?.left ?? 0) - ((renderedState.shellRect?.left ?? 0) + 14)) <= 1,
                "Main view should shift right by the injected left inset.",
            );
            assert.ok(
                Math.abs((renderedState.shellRect?.right ?? 0) - (renderedState.footerRect?.right ?? 0) - 22) <= 1,
                "Footer should leave room for the injected right inset.",
            );
        } finally {
            await closeIOSHarnessPage(page);
        }
    }
});

test("mounted iPhone keeps the main-panel MSEG preview horizontal in portrait while rotating only the full editor vertical", async () => {
    for (const {
        viewportSize,
        expectedPreviewOrientation,
        expectedModalOrientation,
    } of [
        {
            viewportSize: { width: 390, height: 844 },
            expectedPreviewOrientation: "horizontal",
            expectedModalOrientation: "vertical",
        },
        {
            viewportSize: { width: 844, height: 390 },
            expectedPreviewOrientation: "horizontal",
            expectedModalOrientation: "horizontal",
        },
    ]) {
        const page = await openIOSHarnessPage(browser, server.baseUrl, { viewportSize });

        try {
            await waitForIOSHarnessReady(page);
            await setIOSStoredStateValue(page, "mseg1.shape", JSON.stringify(IOS_MSEG_ORIENTATION_SHAPE));

            await waitForRenderedState(
                page,
                `MSEG preview orientation at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.previewShellRect?.height > 0
                    && (
                        curveMatchesHorizontalFixture(nextState.previewCurvePoints)
                        || curveMatchesVerticalFixture(nextState.previewCurvePoints)
                    ),
            );
            let renderedState = await waitForStableRenderedState(
                page,
                `settled MSEG preview at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.previewShellRect?.height > 0
                    && nextState.previewCurvePoints.length >= 4,
                (nextState) => ({
                    previewCurvePoints: nextState.previewCurvePoints,
                    previewShellRect: nextState.previewShellRect,
                }),
            );

            assert.ok(
                expectedPreviewOrientation === "horizontal"
                    ? curveMatchesHorizontalFixture(renderedState.previewCurvePoints)
                    : curveMatchesVerticalFixture(renderedState.previewCurvePoints),
                `Expected the main-panel MSEG preview to stay ${expectedPreviewOrientation} at ${viewportSize.width}x${viewportSize.height}.`,
            );

            await clickShadowButton(page, ".mseg-preview-button");
            await waitForRenderedState(
                page,
                `MSEG modal orientation at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.modalOpen === "true"
                    && nextState.modalPointCenters.length >= 4
                    && (
                        curveMatchesHorizontalFixture(nextState.modalCurvePoints)
                        || curveMatchesVerticalFixture(nextState.modalCurvePoints)
                    ),
            );
            renderedState = await waitForStableRenderedState(
                page,
                `settled MSEG modal at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.modalOpen === "true"
                    && nextState.modalPointCenters.length >= 4
                    && nextState.modalCurvePoints.length >= 4,
                (nextState) => ({
                    modalCurvePoints: nextState.modalCurvePoints,
                    modalPointCenters: nextState.modalPointCenters,
                    modalOpen: nextState.modalOpen,
                }),
            );

            assert.ok(
                expectedModalOrientation === "horizontal"
                    ? curveMatchesHorizontalFixture(renderedState.modalCurvePoints)
                    : curveMatchesVerticalFixture(renderedState.modalCurvePoints),
                `Expected the full MSEG editor to be ${expectedModalOrientation} at ${viewportSize.width}x${viewportSize.height}.`,
            );
            assertRectHasArea(renderedState.modalSurfaceRect, "mounted iPhone MSEG modal surface");
            if (expectedModalOrientation === "vertical") {
                assertPortraitModalMatchesInjectedFixture(renderedState.modalPointCenters);
                assert.ok(
                    renderedState.modalCurvePoints[renderedState.modalCurvePoints.length - 1].y
                        > renderedState.modalCurvePoints[0].y,
                    "Portrait MSEG editor should run time from the top of the phone to the bottom.",
                );
                assert.ok(
                    renderedState.modalPointCenters[1].cx > renderedState.modalPointCenters[2].cx,
                    "Portrait MSEG editor should map the higher early control point further right than the later lower point.",
                );
                assert.ok(
                    renderedState.modalPointCenters[2].cy > renderedState.modalPointCenters[1].cy,
                    "Portrait MSEG editor should place later control points lower on the screen.",
                );
            }
        } finally {
            await closeIOSHarnessPage(page);
        }
    }
});

test("mounted iPhone MSEG modal keeps the main view layout-stable while hidden, keeps the footer visible, and persists a shape edit", async () => {
    for (const viewportSize of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
    ]) {
        const page = await openIOSHarnessPage(browser, server.baseUrl, { viewportSize });

        try {
            await waitForIOSHarnessReady(page);
            await setIOSStoredStateValue(page, "mseg1.shape", "");
            await clearIOSHarnessDebugLog(page);
            await clickShadowButton(page, ".mseg-preview-button");

            let renderedState = await waitForRenderedState(
                page,
                `open MSEG modal at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.modalOpen === "true"
                    && nextState.mainViewDisplay !== "none"
                    && nextState.mainViewVisibility === "hidden"
                    && (nextState.previewShellRect?.height ?? 0) > 0,
            );
            assert.equal(renderedState.footerVisible, true);
            assert.equal(renderedState.mainViewDisplay, "grid");
            assert.equal(renderedState.mainViewVisibility, "hidden");
            assertRectHasArea(renderedState.previewShellRect, "hidden main-view MSEG preview shell");

            const modalRect = await getShadowElementRect(page, "[data-role='mseg-modal-viewport']");
            const modalShellRect = await getShadowElementRect(page, "[data-role='mseg-modal']");
            const closeButtonRect = await getShadowElementRect(page, "[data-role='mseg-modal-close']");
            const closeButtonStyle = await page.evaluate(() => {
                const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
                const closeButton = shadowRoot?.querySelector("[data-role='mseg-modal-close']");

                if (!(closeButton instanceof HTMLElement)) {
                    return null;
                }

                const style = getComputedStyle(closeButton);
                return {
                    text: closeButton.textContent?.trim() ?? "",
                    backgroundColor: style.backgroundColor,
                    borderRadius: style.borderRadius,
                    color: style.color,
                    opacity: style.opacity,
                    appearance: style.appearance,
                };
            });
            assert.deepEqual(closeButtonStyle, {
                text: "x",
                backgroundColor: "rgba(0, 0, 0, 0)",
                borderRadius: "0px",
                color: "rgb(238, 242, 245)",
                opacity: "1",
                appearance: "none",
            });
            assert.ok(closeButtonRect.width >= 24 && closeButtonRect.width <= 36, `Expected the mounted iPhone close control to stay compact without becoming annoyingly tiny, got ${closeButtonRect.width}px.`);
            assert.ok(closeButtonRect.height >= 20 && closeButtonRect.height <= 28, `Expected the mounted iPhone close control to stay short without collapsing into a too-small tap target, got ${closeButtonRect.height}px.`);
            assert.ok(
                closeButtonRect.top - modalShellRect.top <= 2,
                `Expected the mounted iPhone close control to sit flush to the top of the MSEG modal, got modal top ${modalShellRect.top} and button top ${closeButtonRect.top}.`,
            );
            const controlGap = modalRect.top - (closeButtonRect.top + closeButtonRect.height);
            assert.ok(
                controlGap >= 4 && controlGap <= 14,
                `Expected the mounted iPhone close control to leave only a small gap before the editable MSEG surface, got ${controlGap}px.`,
            );
            const topStripHitTarget = await page.evaluate(({ x, y }) => {
                const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
                const hit = shadowRoot?.elementFromPoint?.(x, y) ?? null;
                return {
                    hitsSurface: Boolean(hit?.closest?.("[data-role='mseg-modal-viewport']")),
                    hitsClose: Boolean(hit?.closest?.("[data-role='mseg-modal-close']")),
                };
            }, {
                x: modalRect.left + (modalRect.width * 0.5),
                y: modalRect.top + 6,
            });
            assert.deepEqual(topStripHitTarget, {
                hitsSurface: true,
                hitsClose: false,
            });
            const tappedSurfaceX = Math.round(modalRect.width * 0.42);
            const tappedSurfaceY = Math.round(modalRect.height * 0.28);
            await tapShadowElementWithTouch(
                page,
                "[data-role='mseg-modal-viewport']",
                tappedSurfaceX,
                tappedSurfaceY,
            );

            const snapshot = await waitForSnapshot(
                page,
                `MSEG stored-state update after mounted edit at ${viewportSize.width}x${viewportSize.height}`,
                (nextSnapshot) => typeof nextSnapshot.storedState["mseg1.shape"] === "string"
                    && nextSnapshot.sentMessages.some((message) => message.endpointID === "mseg1Buffer"),
            );
            const storedShape = JSON.parse(snapshot.storedState["mseg1.shape"]);
            assert.equal(storedShape.format, "cosimo.mseg.shape");
            assert.equal(storedShape.points.length, 3);
            const insertedPoint = storedShape.points[1];
            const expectedPoint = getIndependentMsegPoint(
                modalRect,
                tappedSurfaceX,
                tappedSurfaceY,
                viewportSize.height > viewportSize.width ? "vertical" : "horizontal",
            );
            assert.ok(
                Math.abs(insertedPoint.x - expectedPoint.x) <= 0.03,
                `Expected mounted portrait edit time to land near ${expectedPoint.x.toFixed(3)}, got ${insertedPoint.x.toFixed(3)}.`,
            );
            assert.ok(
                Math.abs(insertedPoint.y - expectedPoint.y) <= 0.03,
                `Expected mounted portrait edit value to land near ${expectedPoint.y.toFixed(3)}, got ${insertedPoint.y.toFixed(3)}.`,
            );

            await clickShadowButton(page, "[data-role='mseg-modal-close']");
            renderedState = await waitForRenderedState(
                page,
                `close MSEG modal at ${viewportSize.width}x${viewportSize.height}`,
                (nextState) => nextState.modalOpen === "false"
                    && nextState.mainViewDisplay !== "none"
                    && nextState.mainViewVisibility === "visible",
            );
            assert.equal(renderedState.footerVisible, true);
        } finally {
            await closeIOSHarnessPage(page);
        }
    }
});

test("mounted iPhone MSEG depth control syncs stored-state updates and emits the edited depth", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await setIOSStoredStateValue(page, "mseg1.depth", -0.25);
        let renderedState = await waitForRenderedState(
            page,
            "stored MSEG depth reflected in the mounted modal controls",
            (nextState) => nextState.msegDepthReadout === "-0.250" && nextState.msegDepthValue === "-0.25",
        );
        assert.equal(renderedState.msegDepthReadout, "-0.250");

        await clearIOSHarnessDebugLog(page);
        await fillShadowInput(page, ".mseg-depth-slider", "0.375");

        const snapshot = await waitForSnapshot(
            page,
            "mounted MSEG depth edit",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.some((message) => message.endpointID === "mseg1Depth" && Number(message.value) === 0.375)
                && Number(nextSnapshot.storedState["mseg1.depth"]) === 0.375
            ),
        );
        renderedState = await waitForRenderedState(
            page,
            "updated MSEG depth readout",
            (nextState) => nextState.msegDepthReadout === "0.375" && nextState.msegDepthValue === "0.375",
        );

        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "mseg1Depth" && Number(message.value) === 0.375
        )));
        assert.equal(Number(snapshot.storedState["mseg1.depth"]), 0.375);
        assert.equal(renderedState.msegDepthReadout, "0.375");
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone stage gestures keep picker taps inert, swipe tables horizontally, and drag scan position vertically", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await waitForSnapshot(
            page,
            "initial stage bank load before gestures",
            (nextSnapshot) => nextSnapshot.fetchedUrls.some((url) => url.includes("/assets/factory_sources/")),
        );

        await clearIOSHarnessDebugLog(page);
        await tapShadowElementWithTouch(page, ".table-select-overlay", 16, 16);
        await page.waitForTimeout(25);
        let snapshot = await getIOSHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some((message) => (
            message.endpointID === "wavetablePosition" || message.endpointID === "wavetableSelect"
        )), false);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);

        await clearIOSHarnessDebugLog(page);
        await dragAcrossShadowElement(page, ".wavetable-stage", { x: 280, y: 140 }, { x: 90, y: 148 });
        snapshot = await waitForSnapshot(
            page,
            "mounted horizontal table swipe",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => message.endpointID === "wavetableSelect"),
        );
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "wavetableSelect" && message.value === 1
        )));
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("wavetablePosition"), false);

        await clearIOSHarnessDebugLog(page);
        await startShadowMutationCounter(page, ".play-panel", "play-panel-stage-drag");
        await dragAcrossShadowElement(page, ".wavetable-stage", { x: 180, y: 170 }, { x: 182, y: 100 });
        snapshot = await waitForSnapshot(
            page,
            "mounted vertical stage drag",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => message.endpointID === "wavetablePosition"),
        );
        const playPanelMutationCount = await stopShadowMutationCounter(page, "play-panel-stage-drag");
        const positionUpdate = snapshot.sentMessages.find((message) => message.endpointID === "wavetablePosition");
        assert.equal(snapshot.gestureStarts.includes("wavetablePosition"), true);
        assert.equal(snapshot.gestureEnds.includes("wavetablePosition"), true);
        assert.ok(Number(positionUpdate?.value) > 0.28);
        assert.ok(Number(positionUpdate?.value) <= 1);
        assert.equal(
            playPanelMutationCount,
            0,
            "Vertical wavetable scrubbing should not rewrite the play controls while scan position changes.",
        );
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone octave controls update the footer keyboard root note and clamp at the configured bounds", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        let renderedState = await getIOSHarnessRenderedState(page);
        assert.equal(renderedState.keyboardRootNote, "36");

        await clickShadowButton(page, ".octave-up");
        renderedState = await waitForRenderedState(
            page,
            "octave up root-note update",
            (nextState) => nextState.keyboardRootNote === "48",
        );
        assert.match(renderedState.octaveReadout, /^C3 - /);

        await clickOctaveButtonUntilRootNote(page, ".octave-down", 36);
        await clickOctaveButtonUntilRootNote(page, ".octave-down", 24);
        renderedState = await clickOctaveButtonUntilRootNote(page, ".octave-down", 12);
        let shadowState = await readShadowState(page);
        assert.equal(shadowState.octaveDownDisabled, true);

        await clickOctaveButtonUntilRootNote(page, ".octave-up", 24);
        await clickOctaveButtonUntilRootNote(page, ".octave-up", 36);
        await clickOctaveButtonUntilRootNote(page, ".octave-up", 48);
        await clickOctaveButtonUntilRootNote(page, ".octave-up", 60);
        renderedState = await clickOctaveButtonUntilRootNote(page, ".octave-up", 72);
        shadowState = await readShadowState(page);
        assert.equal(shadowState.octaveUpDisabled, true);
        assert.match(renderedState.octaveReadout, /^C5 - /);
    } finally {
        await closeIOSHarnessPage(page);
    }
});
