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
    MODULATION_STATE_KEY,
    createDefaultRoute,
    createDefaultModulationState,
    deserializeModulationState,
    serializeModulationState,
} from "../patch_gui/modulation.js";

import {
    clearIOSHarnessFailingResources,
    clearIOSHarnessDebugLog,
    closeIOSHarnessPage,
    emitIOSHarnessDistortionHistory,
    emitIOSHarnessDistortionScope,
    emitIOSHarnessEffectiveMsegState,
    getIOSHarnessRenderedState,
    getIOSHarnessSnapshot,
    getIOSSourceHarnessSnapshot,
    openIOSHarnessPage,
    openIOSSourceHarnessPage,
    releaseIOSHarnessParameterResponse,
    setIOSHarnessFailingResource,
    setIOSHarnessParameterValue,
    setIOSHarnessRuntimeState,
    setIOSStoredStateValue,
    startIOSHarnessServer,
    startIOSSourceHarnessServer,
    waitForIOSHarnessReady,
    waitForIOSSourceHarnessReady,
} from "./helpers/ios_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

let server;
let browser;
let factoryCatalog;
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
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
const IOS_MSEG_IDENTITY_SHAPES = {
    shapeA: {
        format: "cosimo.mseg.shape",
        version: 1,
        name: "Identity A",
        globalSmooth: false,
        points: [
            { x: 0, y: 0, curvePower: 0 },
            { x: 0.45, y: 0.8, curvePower: 0 },
            { x: 1, y: 1, curvePower: 0 },
        ],
    },
    shapeB: {
        format: "cosimo.mseg.shape",
        version: 1,
        name: "Identity B",
        globalSmooth: false,
        points: [
            { x: 0, y: 1, curvePower: 0 },
            { x: 0.55, y: 0.2, curvePower: 0 },
            { x: 1, y: 0.65, curvePower: 0 },
        ],
    },
};

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function expectedMsegPreviewProgressClipWidth(previewState, progress) {
    const plotWidth = Math.max(1, previewState.width - (MSEG_PREVIEW_HORIZONTAL_PADDING_PX * 2));
    return plotWidth * progress;
}

function buildDistortionScopeFixture({ amplitude = 1.58, sampleCount = 224 } = {}) {
    const inputSamples = [];
    const outputSamples = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const phase = (index / Math.max(1, sampleCount - 1)) * Math.PI * 6;
        const envelope = 0.84 + (0.16 * Math.sin((index / Math.max(1, sampleCount - 1)) * Math.PI * 2));
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

function buildDistortionHistoryFixture({ amplitude = 1.56, binCount = 160 } = {}) {
    const inputMins = [];
    const inputMaxs = [];
    const outputMins = [];
    const outputMaxs = [];

    for (let index = 0; index < binCount; index += 1) {
        const normalized = index / Math.max(1, binCount - 1);
        const motion = 0.18 + (0.82 * Math.abs(Math.sin(normalized * Math.PI * 4.6)));
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

function readStoredModulationState(snapshot) {
    const rawState = snapshot.storedState[MODULATION_STATE_KEY];
    return rawState === undefined
        ? createDefaultModulationState()
        : deserializeModulationState(rawState);
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

async function setIOSStoredModulationState(page, nextState) {
    await setIOSStoredStateValue(page, MODULATION_STATE_KEY, serializeModulationState(nextState));
}

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

async function dispatchShadowInputValueChange(page, selector, nextValue) {
    const locator = await getShadowLocator(page, selector);
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

async function dispatchTouchHoldAndDrag(page, start, end, holdBeforeMoveMs) {
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

        if (holdBeforeMoveMs > 0) {
            await page.waitForTimeout(holdBeforeMoveMs);
        }

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

function getSurfacePointForMsegPoint(modalRect, normalizedX, normalizedY, orientation) {
    const insetX = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_HORIZONTAL_PADDING_PX;
    const insetY = MSEG_POINT_RADIUS_PX + MSEG_EDITOR_VERTICAL_PADDING_PX;
    const plotWidth = modalRect.width - (insetX * 2);
    const plotHeight = modalRect.height - (insetY * 2);

    if (orientation === "vertical") {
        return {
            x: insetX + (normalizedY * plotWidth),
            y: insetY + (normalizedX * plotHeight),
        };
    }

    return {
        x: insetX + (normalizedX * plotWidth),
        y: insetY + ((1 - normalizedY) * plotHeight),
    };
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
        )), "the UI must request its initial runtime presentation state");
        assert.ok(snapshot.resourceReads.some((entry) => (
            entry.kind === "text" && entry.path === "assets/factory-bank-catalog.json"
        )));
        assert.ok(snapshot.fetchedUrls.some((url) => url.includes("/assets/factory_sources/")));
        assert.equal(snapshot.resourceReads.some((entry) => entry.kind === "audio-bridge"), false);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone oscillator tabs route table and control edits only to the selected oscillator", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        const oscillatorA = await getShadowLocator(page, '[data-role="mobile-voice-tab-a"]');
        assert.equal(await oscillatorA.getAttribute("aria-selected"), "true");

        await clearIOSHarnessDebugLog(page);
        const oscillatorB = await getShadowLocator(page, '[data-role="mobile-voice-tab-b"]');
        assert.equal((await oscillatorB.getAttribute("class")).includes("is-muted"), true);
        await oscillatorB.click();
        assert.equal(
            await (await getShadowLocator(page, '[data-role="mobile-voice-cell-volumeDb"]')).getAttribute("aria-valuenow"),
            "0",
        );
        await selectShadowOption(page, 'select[aria-label="Select wavetable"]', 1);
        await dispatchShadowInputValueChange(page, '[data-role="oscillator-pan-slider"]', "0.25");

        // Base edits go through the toolbar readout cells' keyboard contract.
        await (await getShadowLocator(page, '[data-role="mobile-voice-page-next"]')).click();
        const octaveCell = await getShadowLocator(page, '[data-role="mobile-voice-cell-octave"]');
        await octaveCell.focus();
        await page.keyboard.press("ArrowRight");
        const semitoneCell = await getShadowLocator(page, '[data-role="mobile-voice-cell-semitone"]');
        await semitoneCell.focus();
        await page.keyboard.press("ArrowLeft");

        // Mute is the second tap on the active tab; Solo is the tab badge.
        await oscillatorB.click();
        await (await getShadowLocator(page, '[data-role="mobile-voice-solo-b"]')).click();

        const snapshot = await waitForSnapshot(
            page,
            "oscillator B routed writes",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscBWavetableSelect" && Number(value) === 1
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscBPan" && Math.abs(Number(value) - 0.25) < 0.0001
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscBOctave" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscBSemitone" && Number(value) === -1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscBMute" && Number(value) === 0)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscBSolo" && Number(value) === 1),
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => (
            endpointID === "wavetableSelect"
            || endpointID === "pan"
            || endpointID === "oscAWavetableSelect"
            || endpointID === "oscAPan"
            || endpointID === "oscAOctave"
            || endpointID === "oscCWavetableSelect"
            || endpointID === "oscCPan"
            || endpointID === "oscCOctave"
        )), false);
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
        await selectShadowOption(page, 'select[aria-label="Select wavetable"]', bs2Index);
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
                    message.endpointID === "oscAWavetableSelect" && message.value === bs2Index
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
        await selectShadowOption(page, 'select[aria-label="Select wavetable"]', targetTableIndex);
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
            (nextState) => /Could not load wavetable bank:/.test(nextState.displayStatus ?? ""),
        );

        assert.match(renderedState.displayStatus, /Failed to fetch resource|404/);
        assert.match(renderedState.displayStatus, /Import the factory wavetable zip from the native library bar, then reopen the patch\./);
    } finally {
        await clearIOSHarnessFailingResources(page);
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone shell names the pending table, exposes retry on failure, and clears the failure when the requested table becomes active", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });
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
            (nextState) => nextState.displayStatus === `Loading ${desiredTable.name}…`,
        );
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
                && /Wavetable load timed out\./.test(nextState.displayStatus ?? "")
            ),
        );
        assert.equal(renderedState.retryDisabled, false);

        await clickShadowButton(page, '[data-role="mobile-voice-retry-load"]');
        const snapshot = await waitForSnapshot(
            page,
            "retry request message",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => message.endpointID === "retryDesiredTableRequest"),
        );
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "retryDesiredTableRequest" && message.value === 0
        )));
        renderedState = await waitForRenderedState(
            page,
            "retry returns the mounted iPhone UI to the loading presentation",
            (nextState) => (
                nextState.retryHidden === true
                && nextState.displayStatus === `Loading ${desiredTable.name}…`
            ),
        );
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
                nextState.displayStatus === desiredTable.name
                && nextState.retryHidden === true
            ),
        );
        const finalSnapshot = await getIOSHarnessSnapshot(page);
        assert.equal(finalSnapshot.runtimeState.activeTableIndex, 1);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone play, glide, and continuous Global Tune controls sync and emit undoable user edits", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await setIOSHarnessParameterValue(page, "playMode", 2);
        await setIOSHarnessParameterValue(page, "glideTime", 1.5);
        await setIOSHarnessParameterValue(page, "globalTune", 12.37);

        let renderedState = await waitForRenderedState(
            page,
            "parameter-synced play, glide, and Global Tune controls",
            (nextState) => nextState.playModeValue === "2"
                && nextState.glideReadout === "1.500 s"
                && nextState.globalTuneReadout === "+12 st 37 ct",
        );
        assert.equal(renderedState.glideValue, "1");
        assert.equal(renderedState.globalTuneValue, "12.37");

        const globalTuneKnob = await getShadowLocator(page, '[data-role="ios-global-tune-knob"]');
        assert.equal(await globalTuneKnob.getAttribute("data-detented"), "false");

        await clearIOSHarnessDebugLog(page);
        await selectShadowOption(page, ".play-mode-select", 1);
        await fillShadowInput(page, ".glide-time-slider", "0.375");
        const globalTuneRect = await getShadowElementRect(page, '[data-role="ios-global-tune-knob"]');
        await dragAcrossShadowElement(
            page,
            '[data-role="ios-global-tune-knob"]',
            { x: globalTuneRect.width * 0.35, y: globalTuneRect.height * 0.5 },
            { x: globalTuneRect.width * 0.75, y: globalTuneRect.height * 0.5 },
        );

        const snapshot = await waitForSnapshot(
            page,
            "play, glide, and Global Tune user edits",
            (nextSnapshot) => {
                const sentPairs = nextSnapshot.sentMessages.map((message) => `${message.endpointID}:${message.value}`);
                return sentPairs.includes("playMode:1")
                    && sentPairs.includes("glideTime:0.375")
                    && nextSnapshot.sentMessages.some((message) => (
                        message.endpointID === "globalTune"
                        && Math.abs(Number(message.value) - 12.37) > 0.01
                        && !Number.isInteger(Number(message.value))
                    ));
            },
        );
        renderedState = await getIOSHarnessRenderedState(page);
        assert.equal(renderedState.playModeValue, "1");
        assert.equal(renderedState.glideReadout, "0.375 s");
        assert.match(renderedState.globalTuneReadout, /^[+-]?\d+ st \d{2} ct$/);
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "playMode" && message.value === 1
        )));
        assert.ok(snapshot.sentMessages.some((message) => (
            message.endpointID === "glideTime" && Number(message.value) === 0.375
        )));
        assert.deepEqual(snapshot.gestureStarts.filter((endpointID) => endpointID === "globalTune"), ["globalTune"]);
        assert.deepEqual(snapshot.gestureEnds.filter((endpointID) => endpointID === "globalTune"), ["globalTune"]);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone callback controls stay visibly pending and re-enable after host replies", async () => {
    const deferredEndpoints = [
        "oscAWavetableSelect",
        "playMode",
        "glideTime",
        "oscAPan",
        "mseg1Morph",
        "mseg1Rate",
        "env1Attack",
    ];
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
        deferredParameterResponses: deferredEndpoints,
    });

    try {
        await waitForIOSHarnessReady(page);
        const selectors = [
            'select[aria-label="Select wavetable"]',
            ".play-mode-select",
            ".glide-time-slider",
            '[data-role="oscillator-pan-slider"]',
            '.ios-main-view [data-role="mseg-morph-slider"]',
            '[data-modulation-target-kind="env1Attack"]',
        ];
        for (const selector of selectors) {
            const control = await getShadowLocator(page, selector);
            assert.equal(await control.isDisabled(), true, `${selector} should be disabled while pending`);
            assert.equal(await control.getAttribute("data-host-state"), "loading");
        }

        await clickShadowButton(page, ".mseg-preview-button");
        for (const selector of [
            '.mseg-modal [data-role="mseg-morph-slider"]',
            '.mseg-modal [data-modulation-target-kind="mseg1Rate"]',
        ]) {
            const control = await getShadowLocator(page, selector);
            assert.equal(await control.isDisabled(), true, `${selector} should be disabled while pending`);
            assert.equal(await control.getAttribute("data-host-state"), "loading");
        }
        await clickShadowButton(page, '[data-role="mseg-modal-close"]');
        await page.waitForFunction(() => (
            document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector('[data-role="mseg-modal-layer"]')
                ?.getAttribute("data-open") === "false"
        ));

        await clearIOSHarnessDebugLog(page);
        await page.evaluate((targetSelectors) => {
            const root = document.querySelector("cosimo-synth-view")?.shadowRoot;
            for (const selector of targetSelectors) {
                const element = root?.querySelector(selector);
                if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
                    throw new Error(`Missing callback control ${selector}.`);
                }
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }, selectors);
        assert.equal(
            (await getIOSHarnessSnapshot(page)).sentMessages.some(({ endpointID }) => deferredEndpoints.includes(endpointID)),
            false,
            "forced pre-readiness events cannot reach the iPhone host bridge",
        );

        for (const endpointID of deferredEndpoints) {
            await releaseIOSHarnessParameterResponse(page, endpointID);
        }
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-synth-view")?.shadowRoot;
            return root?.querySelector('select[aria-label="Select wavetable"]')?.hasAttribute("disabled") === false
                && root?.querySelector('[data-modulation-target-kind="env1Attack"]')?.hasAttribute("disabled") === false;
        });

        await clearIOSHarnessDebugLog(page);
        await page.evaluate(() => {
            const root = document.querySelector("cosimo-synth-view")?.shadowRoot;
            const changeValue = (selector, value) => {
                const element = root?.querySelector(selector);
                if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
                    throw new Error(`Missing ready callback control ${selector}.`);
                }
                const prototype = element instanceof HTMLSelectElement
                    ? HTMLSelectElement.prototype
                    : HTMLInputElement.prototype;
                Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, String(value));
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            };
            changeValue('select[aria-label="Select wavetable"]', 1);
            changeValue(".play-mode-select", 1);
            changeValue(".glide-time-slider", 0.375);
            changeValue('[data-role="oscillator-pan-slider"]', 0.25);
            changeValue('.ios-main-view [data-role="mseg-morph-slider"]', 0.6);
            changeValue('[data-modulation-target-kind="env1Attack"]', 0.5);
            root?.querySelector(".mseg-preview-button")?.click();
        });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector('[data-role="mseg-modal-layer"]')
                ?.getAttribute("data-open") === "true"
        ));
        await page.evaluate(() => {
            const element = document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector('.mseg-modal [data-modulation-target-kind="mseg1Rate"]');
            if (!(element instanceof HTMLInputElement)) {
                throw new Error("Missing ready iPhone MSEG rate control.");
            }
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, "1.2");
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
        });

        await waitForSnapshot(page, "re-enabled iPhone callback control writes", (snapshot) => {
            const written = new Set(snapshot.sentMessages.map(({ endpointID }) => endpointID));
            return deferredEndpoints.every((endpointID) => written.has(endpointID));
        });
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone exposes every continuous MSEG and envelope modulation target, including Amp Envelope", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);

        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await clickShadowButton(page, `[aria-label='Select MSEG ${slotIndex + 1}']`);
            const launcherMorphTarget = await page.evaluate(() => (
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector(".ios-main-view [data-role='mseg-morph-slider']")
                    ?.getAttribute("data-modulation-target-kind") ?? null
            ));
            assert.equal(launcherMorphTarget, `mseg${slotIndex + 1}Morph`);

            await clickShadowButton(page, ".mseg-preview-button");
            const modalTargets = await page.evaluate(() => Array.from(
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelectorAll("[data-role='mseg-modal'] [data-modulation-target-kind]") ?? [],
                (element) => element.getAttribute("data-modulation-target-kind"),
            ));
            assert.deepEqual(modalTargets.sort(), [
                `mseg${slotIndex + 1}Morph`,
                `mseg${slotIndex + 1}Rate`,
            ].sort());
            await clickShadowButton(page, "[data-role='mseg-modal-close']");
        }

        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await clickShadowButton(page, `[aria-label='Select envelope ${slotIndex + 1}']`);
            const targets = await page.evaluate(() => Array.from(
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelectorAll(".ios-main-view [data-modulation-target-kind^='env']") ?? [],
                (element) => element.getAttribute("data-modulation-target-kind"),
            ));
            assert.deepEqual(targets.sort(), [
                `env${slotIndex + 1}Attack`,
                `env${slotIndex + 1}Decay`,
                `env${slotIndex + 1}Sustain`,
                `env${slotIndex + 1}Release`,
            ].sort());
        }

        await clickShadowButton(page, "[aria-label='Select Amp Envelope']");
        const ampTargets = await page.evaluate(() => Array.from(
            document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelectorAll(".ios-main-view [data-modulation-target-kind^='amp']") ?? [],
            (element) => element.getAttribute("data-modulation-target-kind"),
        ));
        assert.deepEqual(ampTargets.sort(), [
            "ampAttack",
            "ampDecay",
            "ampSustain",
            "ampRelease",
        ].sort());
        await clearIOSHarnessDebugLog(page);
        await page.evaluate(() => {
            const input = document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector('[data-modulation-target-kind="ampAttack"]');
            if (!(input instanceof HTMLInputElement)) {
                throw new Error("Missing Amp Envelope attack control.");
            }
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "0.43");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await waitForSnapshot(page, "iPhone Amp Envelope host write", (snapshot) => (
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "ampAttack" && Math.abs(Number(value) - 0.43) < 0.0001
            ))
        ));
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
            const modulationState = createDefaultModulationState();
            modulationState.msegSlots[0].shapeA = cloneJson(IOS_MSEG_ORIENTATION_SHAPE);
            await setIOSStoredModulationState(page, modulationState);

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

test("source-composed iPhone preview and editor keep A, B, and realized Morph identity colors", async () => {
    const modulationState = createDefaultModulationState();
    modulationState.msegSlots[0].shapeA = cloneJson(IOS_MSEG_IDENTITY_SHAPES.shapeA);
    modulationState.msegSlots[0].shapeB = cloneJson(IOS_MSEG_IDENTITY_SHAPES.shapeB);
    const sourceServer = await startIOSSourceHarnessServer();
    let page = null;

    try {
        page = await openIOSSourceHarnessPage(browser, sourceServer.baseUrl, {
            storedState: {
                [MODULATION_STATE_KEY]: serializeModulationState(modulationState),
            },
        });
        await waitForIOSSourceHarnessReady(page);
        const morphValue = "0.370";
        await page.locator("cosimo-synth-view")
            .locator(".ios-main-view [data-role='mseg-morph-slider']")
            .evaluate((element, nextValue) => {
                if (!(element instanceof HTMLInputElement)) {
                    throw new Error("Source-composed iPhone MSEG Morph control is missing.");
                }
                const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                if (valueSetter === undefined) {
                    throw new Error("Source-composed iPhone MSEG Morph value setter is missing.");
                }
                valueSetter.call(element, nextValue);
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            }, morphValue);
        await page.waitForFunction((expectedMorphValue) => {
            const morphControl = document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector(".ios-main-view [data-role='mseg-morph-slider']");
            return morphControl instanceof HTMLInputElement
                && Math.abs(morphControl.valueAsNumber - expectedMorphValue) < 0.0001;
        }, Number(morphValue));
        const readPreviewPresentation = () => page.evaluate(() => {
            const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
            const preview = shadowRoot?.querySelector("[data-role='mseg-preview-surface']");
            const readCurve = (role) => {
                const curve = preview?.querySelector(`[data-role="${role}"]`);
                if (!(curve instanceof SVGPathElement)) {
                    throw new Error(`Missing ${role}.`);
                }
                return {
                    path: curve.getAttribute("d"),
                    stroke: getComputedStyle(curve).stroke,
                };
            };
            return {
                editShape: preview?.getAttribute("data-edit-shape") ?? null,
                shapeA: readCurve("mseg-preview-shape-a-curve"),
                shapeB: readCurve("mseg-preview-shape-b-curve"),
                realized: readCurve("mseg-preview-effective-curve"),
            };
        });
        const assertPreviewIdentity = async (expectedEditShape) => {
            const previewPresentation = await readPreviewPresentation();
            assert.equal(previewPresentation.editShape, expectedEditShape);
            assert.equal(previewPresentation.shapeA.stroke, "rgb(204, 89, 210)");
            assert.equal(previewPresentation.shapeB.stroke, "rgba(225, 231, 240, 0.48)");
            assert.equal(previewPresentation.realized.stroke, "rgb(125, 247, 255)");
            assert.notEqual(previewPresentation.realized.path, previewPresentation.shapeA.path);
            assert.notEqual(previewPresentation.realized.path, previewPresentation.shapeB.path);
        };
        await assertPreviewIdentity("a");
        await clickShadowButton(page, ".mseg-preview-button");
        await page.waitForFunction(() => {
            const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
            return shadowRoot?.querySelector("[data-role='mseg-modal-layer']")
                ?.getAttribute("data-open") === "true"
                && shadowRoot?.querySelectorAll("[data-role='mseg-edit-points'] circle").length === 3;
        });

        const surfaceRect = await getShadowElementRect(page, "[data-role='mseg-modal-viewport']");
        const assertEmphasizedIdentity = async ({ shape, midpoint, expectedStroke }) => {
            await clickShadowButton(page, `[aria-label='Edit MSEG shape ${shape.toUpperCase()}']`);
            await page.waitForFunction((expectedShape) => {
                const surface = document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-modal-viewport']");
                return surface?.getAttribute("data-edit-shape") === expectedShape;
            }, shape);
            await assertPreviewIdentity(shape);
            const localPoint = getSurfacePointForMsegPoint(
                surfaceRect,
                midpoint.x,
                midpoint.y,
                "vertical",
            );
            await page.mouse.move(1, 1);
            await page.mouse.move(surfaceRect.left + localPoint.x, surfaceRect.top + localPoint.y);
            await page.waitForFunction(() => Boolean(
                document.querySelector("cosimo-synth-view")?.shadowRoot
                    ?.querySelector("[data-role='mseg-highlight-segment']"),
            ));
            const presentation = await page.evaluate(() => {
                const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
                const surface = shadowRoot?.querySelector("[data-role='mseg-modal-viewport']");
                const base = surface?.querySelector("[data-role='mseg-base-curve']");
                const reference = surface?.querySelector("[data-role='mseg-reference-curve']");
                const realized = surface?.querySelector("[data-role='mseg-effective-curve']");
                const highlight = surface?.querySelector("[data-role='mseg-highlight-segment']");
                if (!(realized instanceof SVGPathElement)) {
                    throw new Error("Source-composed iPhone realized MSEG curve is missing.");
                }
                const identityCurves = Object.fromEntries([base, reference]
                    .filter((curve) => curve instanceof SVGPathElement)
                    .map((curve) => [
                        curve.getAttribute("data-shape-identity"),
                        {
                            path: curve.getAttribute("d"),
                            stroke: getComputedStyle(curve).stroke,
                        },
                    ]));
                return {
                    editShape: surface?.getAttribute("data-edit-shape") ?? null,
                    highlightStroke: highlight === null || highlight === undefined
                        ? null
                        : getComputedStyle(highlight).stroke,
                    realizedPath: realized.getAttribute("d"),
                    realizedStroke: getComputedStyle(realized).stroke,
                    shapeA: identityCurves.a ?? null,
                    shapeB: identityCurves.b ?? null,
                };
            });
            assert.equal(presentation.editShape, shape);
            assert.equal(presentation.highlightStroke, expectedStroke);
            assert.equal(presentation.shapeA?.stroke, "rgb(204, 89, 210)");
            assert.equal(presentation.shapeB?.stroke, "rgba(225, 231, 240, 0.48)");
            assert.equal(presentation.realizedStroke, "rgb(125, 247, 255)");
            assert.notEqual(presentation.realizedPath, presentation.shapeA?.path);
            assert.notEqual(presentation.realizedPath, presentation.shapeB?.path);
        };

        await assertEmphasizedIdentity({
            shape: "a",
            midpoint: { x: 0.225, y: 0.4 },
            expectedStroke: "rgb(204, 89, 210)",
        });
        await assertEmphasizedIdentity({
            shape: "b",
            midpoint: { x: 0.275, y: 0.6 },
            expectedStroke: "rgba(225, 231, 240, 0.48)",
        });
    } finally {
        if (page) {
            await closeIOSHarnessPage(page);
        }
        await sourceServer.stop();
    }
});

test("source-composed iPhone leaves its unused filter spectrum analyzer asleep", async () => {
    const sourceServer = await startIOSSourceHarnessServer();
    let page = null;

    try {
        page = await openIOSSourceHarnessPage(browser, sourceServer.baseUrl);
        await waitForIOSSourceHarnessReady(page);
        const snapshot = await getIOSSourceHarnessSnapshot(page);

        assert.equal(snapshot.endpointListenerCounts.filterSpectrum ?? 0, 0);
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "filterSpectrumActivity" && Number(value) !== 0
        )), false);
    } finally {
        if (page !== null) {
            await closeIOSHarnessPage(page);
        }
        await sourceServer.stop();
    }
});

test("source-composed iPhone Key Track uses the shared menu and transparent note status", async () => {
    const sourceServer = await startIOSSourceHarnessServer();
    let page = null;

    try {
        page = await openIOSSourceHarnessPage(browser, sourceServer.baseUrl);
        await waitForIOSSourceHarnessReady(page);
        const root = page.locator("cosimo-synth-view");
        const control = root.locator('[data-role="distortion-wet-hp-slider"]');
        await control.waitFor();
        assert.equal(await root.locator(".ios-key-track-button").count(), 0);

        const longPress = async () => {
            const box = await control.boundingBox();
            assert.ok(box);
            await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
            await page.mouse.down();
            await root.locator('[data-role="rack-parameter-menu"]').waitFor();
            await page.mouse.up();
        };
        await longPress();
        const toggle = root.locator(
            '[data-role="rack-parameter-menu-item"][data-action="toggle-key-track"]',
        );
        assert.equal((await toggle.innerText()).trim(), "Enable Key Track");
        await toggle.click();

        const status = root.locator('[data-role="key-track-status-distortionWetHPHz"]');
        await status.waitFor();
        const presentation = await status.evaluate((element) => {
            const style = getComputedStyle(element);
            const statusBox = element.getBoundingClientRect();
            const outer = element.parentElement;
            const label = outer?.querySelector(".mseg-depth-label");
            const labelBox = label?.getBoundingClientRect();
            const outerBox = outer?.getBoundingClientRect();
            const overlaps = labelBox === undefined ? true : (
                statusBox.left < labelBox.right
                && statusBox.right > labelBox.left
                && statusBox.top < labelBox.bottom
                && statusBox.bottom > labelBox.top
            );
            return {
                pointerEvents: style.pointerEvents,
                color: style.backgroundColor,
                maskImage: style.maskImage || style.webkitMaskImage,
                width: statusBox.width,
                height: statusBox.height,
                insideTopLeft: outerBox !== undefined
                    && statusBox.left >= outerBox.left
                    && statusBox.top >= outerBox.top
                    && statusBox.right <= outerBox.left + (outerBox.width / 2)
                    && statusBox.bottom <= outerBox.top + (outerBox.height / 2),
                overlapsLabel: overlaps,
            };
        });
        assert.equal(presentation.pointerEvents, "none");
        assert.equal(presentation.color, "rgb(250, 204, 21)");
        assert.match(presentation.maskImage, /music_note-20px\.svg/);
        assert.equal(presentation.width, 12);
        assert.equal(presentation.height, 12);
        assert.equal(presentation.insideTopLeft, true);
        assert.equal(presentation.overlapsLabel, false);

        await longPress();
        assert.equal((await toggle.innerText()).trim(), "Disable Key Track");
        await toggle.click();
        await status.waitFor({ state: "detached" });
    } finally {
        if (page) await closeIOSHarnessPage(page);
        await sourceServer.stop();
    }
});

test("mounted iPhone MSEG preview shows the selected-slot progress fill from the DSP monitor", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await emitIOSHarnessEffectiveMsegState(page, {
            voiceGeneration: 5,
            hasActive: 1,
            positions: [0.22, 0.61, 0.88],
        });
        await waitForRenderedState(
            page,
            "active iPhone MSEG preview progress fill",
            (nextState) => Boolean(nextState.previewPlayheadState?.progressClip),
        );

        let renderedState = await getIOSHarnessRenderedState(page);
        let previewState = renderedState.previewPlayheadState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.22)) <= 1.5,
            true,
        );

        await page.getByRole("button", { name: "Select MSEG 2" }).click();
        await waitForRenderedState(
            page,
            "selected iPhone MSEG 2 progress fill",
            (nextState) => Boolean(nextState.previewPlayheadState?.progressClip)
                && nextState.previewPlayheadState.progressClip.width > 100,
        );

        renderedState = await getIOSHarnessRenderedState(page);
        previewState = renderedState.previewPlayheadState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.61)) <= 1.5,
            true,
        );

        await emitIOSHarnessEffectiveMsegState(page, {
            voiceGeneration: 6,
            hasActive: 0,
            positions: [1, 1, 1],
        });
        await waitForRenderedState(
            page,
            "inactive iPhone MSEG preview progress fill",
            (nextState) => Boolean(nextState.previewPlayheadState)
                && !nextState.previewPlayheadState.progressClip,
        );

        renderedState = await getIOSHarnessRenderedState(page);
        previewState = renderedState.previewPlayheadState;
        assert.ok(previewState);
        assert.equal(previewState.playhead, null);
        assert.equal(previewState.progressClip, null);
    } finally {
        await closeIOSHarnessPage(page);
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
            await setIOSStoredModulationState(page, createDefaultModulationState());
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
                color: "rgb(232, 236, 239)",
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
                (nextSnapshot) => readStoredModulationState(nextSnapshot).msegSlots[0].shapeA.points.length === 3,
            );
            assert.equal(
                snapshot.sentMessages.some((message) => message.endpointID === "modulationMsegBuffer"),
                false,
            );
            const storedShape = readStoredModulationState(snapshot).msegSlots[0].shapeA;
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

test("mounted iPhone MSEG modal treats segment tap as add, immediate drag as curve edit, and hold-drag as curve edit with one haptic bump", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await setIOSStoredModulationState(page, createDefaultModulationState());
        await clickShadowButton(page, ".mseg-preview-button");
        await waitForRenderedState(
            page,
            "open MSEG modal for touch interaction checks",
            (nextState) => nextState.modalOpen === "true" && (nextState.modalSurfaceRect?.height ?? 0) > 0,
        );

        const modalRect = await getShadowElementRect(page, "[data-role='mseg-modal-viewport']");
        const orientation = "vertical";
        const segmentPoint = getSurfacePointForMsegPoint(modalRect, 0.35, 0.35, orientation);

        await clearIOSHarnessDebugLog(page);
        await tapShadowElementWithTouch(
            page,
            "[data-role='mseg-modal-viewport']",
            segmentPoint.x,
            segmentPoint.y,
        );

        let snapshot = await waitForSnapshot(
            page,
            "segment tap inserts a point",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).msegSlots[0].shapeA.points.length === 3,
        );
        assert.equal(
            snapshot.sentMessages.some((message) => message.endpointID === "modulationMsegBuffer"),
            false,
        );
        let storedShape = readStoredModulationState(snapshot).msegSlots[0].shapeA;
        assert.equal(storedShape.points.length, 3);
        assert.deepEqual(snapshot.hapticEvents, []);

        await setIOSStoredModulationState(page, createDefaultModulationState());
        await waitForRenderedState(
            page,
            "reset MSEG shape before segment drag",
            (nextState) => nextState.modalPointCenters.length === 2,
        );
        await clearIOSHarnessDebugLog(page);
        const curveTarget = getSurfacePointForMsegPoint(modalRect, 0.35, 0.7, orientation);
        await dispatchTouchDrag(
            page,
            { x: modalRect.left + segmentPoint.x, y: modalRect.top + segmentPoint.y },
            { x: modalRect.left + curveTarget.x, y: modalRect.top + curveTarget.y },
        );

        snapshot = await waitForSnapshot(
            page,
            "segment drag edits curve without inserting a point",
            (nextSnapshot) => {
                const shape = readStoredModulationState(nextSnapshot).msegSlots[0].shapeA;
                return shape.points.length === 2 && Math.abs(Number(shape.points[0]?.curvePower)) > 0.1;
            },
        );
        assert.equal(
            snapshot.sentMessages.some((message) => message.endpointID === "modulationMsegBuffer"),
            false,
        );
        storedShape = readStoredModulationState(snapshot).msegSlots[0].shapeA;
        assert.equal(storedShape.points.length, 2);
        assert.ok(Math.abs(storedShape.points[0].curvePower) > 0.1);
        assert.deepEqual(snapshot.hapticEvents, []);

        await setIOSStoredModulationState(page, createDefaultModulationState());
        await waitForRenderedState(
            page,
            "reset MSEG shape before segment hold-drag",
            (nextState) => nextState.modalPointCenters.length === 2,
        );
        await clearIOSHarnessDebugLog(page);
        await dispatchTouchHoldAndDrag(
            page,
            { x: modalRect.left + segmentPoint.x, y: modalRect.top + segmentPoint.y },
            { x: modalRect.left + curveTarget.x, y: modalRect.top + curveTarget.y },
            420,
        );

        snapshot = await waitForSnapshot(
            page,
            "segment hold-drag edits curve and triggers haptic",
            (nextSnapshot) => {
                const shape = readStoredModulationState(nextSnapshot).msegSlots[0].shapeA;
                return shape.points.length === 2 && Math.abs(Number(shape.points[0]?.curvePower)) > 0.1;
            },
        );
        assert.equal(
            snapshot.sentMessages.some((message) => message.endpointID === "modulationMsegBuffer"),
            false,
        );
        storedShape = readStoredModulationState(snapshot).msegSlots[0].shapeA;
        assert.equal(storedShape.points.length, 2);
        assert.ok(Math.abs(storedShape.points[0].curvePower) > 0.1);
        assert.deepEqual(snapshot.hapticEvents, ["light"]);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone no longer exposes the legacy MSEG depth control because routing lives in the matrix", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        const modulationState = createDefaultModulationState();
        modulationState.routes = [createDefaultRoute({
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0.25,
        })];
        await setIOSStoredModulationState(page, modulationState);
        const renderedState = await waitForRenderedState(
            page,
            "legacy MSEG depth control removed from the mounted iPhone launcher",
            (nextState) => nextState.msegDepthReadout === null,
        );
        assert.equal(renderedState.msegDepthReadout, null);

        const snapshot = await getIOSHarnessSnapshot(page);
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0.25,
        });
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone route amounts present the canonical value before the full document projection", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        const modulationState = createDefaultModulationState();
        modulationState.routes = [createDefaultRoute({
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.pan",
            amount: 0.25,
        })];
        await setIOSStoredModulationState(page, modulationState);

        await waitForSnapshot(
            page,
            "initial pan route restore",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.polarity === "unipolar" && Math.abs(Number(route?.amount) - 0.25) <= 1e-9;
            },
        );
        await clearIOSHarnessDebugLog(page);

        assert.equal(await page.evaluate(() => (
            document.querySelector("cosimo-synth-view")?.shadowRoot?.querySelector('[aria-label="Route 1 slot"]') === null
        )), true);

        await (await getShadowLocator(page, 'button[aria-label="Route 1 polarity bipolar"]')).click();
        await page.waitForFunction(() => (
            document.querySelector("cosimo-synth-view")
                ?.shadowRoot
                ?.querySelector(".cosimo-mod-amount-readout")
                ?.textContent
                ?.trim() === "±25%"
        ));
        await page.clock.install();
        await page.clock.pauseAt(Date.now() + 1_000);
        await dispatchShadowInputValueChange(page, 'input[aria-label="Route 1 depth"]', 0.75);
        await page.clock.runFor(20);

        const beforeFullDocumentProjection = {
            inputValue: await (await getShadowLocator(page, 'input[aria-label="Route 1 depth"]')).inputValue(),
            readout: await (await getShadowLocator(page, ".cosimo-mod-amount-readout"))
                .evaluate((element) => element.textContent?.trim() ?? null),
        };
        assert.deepEqual(beforeFullDocumentProjection, {
            inputValue: "0.75",
            readout: "±50%",
        }, "The live amount control must not wait for the deferred modulation document.");

        const snapshot = await waitForSnapshot(
            page,
            "compact pan route edit",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.pan"
                    && route?.polarity === "bipolar"
                    && Math.abs(Number(route.amount) - 0.5) <= 1e-9
                    && nextSnapshot.storedStateWrites.some((write) => write.key === MODULATION_STATE_KEY);
            },
        );

        const latestStoredWrite = [...snapshot.storedStateWrites]
            .reverse()
            .find((write) => write.key === MODULATION_STATE_KEY);
        assert.deepEqual(routeSummary(deserializeModulationState(latestStoredWrite?.value).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.pan",
            amount: 0.5,
        });
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => (
            endpointID === "modulationProgram" || endpointID === "modulationAmount"
        )), false, "the UI persists mappings; the headless worker owns DSP uploads");
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.pan",
            amount: 0.5,
        });
        assert.equal(
            await (await getShadowLocator(page, ".cosimo-mod-amount-readout")).evaluate((element) => element.textContent?.trim() ?? null),
            "±50%",
        );
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone graph keeps overlay taps inert, edits warp horizontally, and index vertically", async () => {
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
        await tapShadowElementWithTouch(page, ".mobile-voice-table-select", 16, 8);
        await page.waitForTimeout(25);
        let snapshot = await getIOSHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some((message) => (
            message.endpointID === "oscAWavetablePosition"
            || message.endpointID === "oscAWarpAmount"
            || message.endpointID === "oscAWavetableSelect"
        )), false);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);

        await clearIOSHarnessDebugLog(page);
        await dragAcrossShadowElement(page, '[data-role="mobile-voice-graph"]', { x: 90, y: 148 }, { x: 280, y: 140 });
        snapshot = await waitForSnapshot(
            page,
            "mounted horizontal warp segment",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => (
                message.endpointID === "oscAWarpAmount" && Number(message.value) > 0.5
            )),
        );
        assert.equal(
            snapshot.sentMessages.some((message) => message.endpointID === "oscAWavetableSelect"),
            false,
            "Graph X edits Warp Amount; it never switches tables in this cutover.",
        );
        assert.equal(snapshot.sentMessages.some((message) => message.endpointID === "oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureStarts.includes("oscAWarpAmount"), true);
        assert.equal(snapshot.gestureEnds.includes("oscAWarpAmount"), true);

        await clearIOSHarnessDebugLog(page);
        await startShadowMutationCounter(page, ".play-panel", "play-panel-stage-drag");
        await dragAcrossShadowElement(page, '[data-role="mobile-voice-graph"]', { x: 180, y: 170 }, { x: 182, y: 100 });
        snapshot = await waitForSnapshot(
            page,
            "mounted vertical index segment",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => message.endpointID === "oscAWavetablePosition"),
        );
        const playPanelMutationCount = await stopShadowMutationCounter(page, "play-panel-stage-drag");
        const positionUpdate = snapshot.sentMessages.findLast((message) => message.endpointID === "oscAWavetablePosition");
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), true);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), true);
        assert.ok(Number(positionUpdate?.value) > 0.28);
        assert.ok(Number(positionUpdate?.value) <= 1);
        assert.equal(
            playPanelMutationCount,
            0,
            "Vertical index scrubbing should not rewrite the play controls while the value changes.",
        );
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone graph ends an active index gesture on window blur", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await clearIOSHarnessDebugLog(page);
        const stage = await getShadowLocator(page, '[data-role="mobile-voice-graph"]');
        const bounds = await stage.boundingBox();
        assert.ok(bounds);
        const start = {
            x: bounds.x + (bounds.width * 0.5),
            y: bounds.y + (bounds.height * 0.72),
        };

        await stage.dispatchEvent("pointerdown", {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        // The classifying sample is consumed; a second sample applies.
        await stage.dispatchEvent("pointermove", {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x + 2,
            clientY: start.y - 30,
        });
        await stage.dispatchEvent("pointermove", {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x + 2,
            clientY: start.y - 54,
        });

        let snapshot = await waitForSnapshot(
            page,
            "active iPhone index gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("oscAWavetablePosition")
                && nextSnapshot.sentMessages.some((message) => message.endpointID === "oscAWavetablePosition"),
        );
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        snapshot = await waitForSnapshot(
            page,
            "blurred iPhone index gesture",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("oscAWavetablePosition"),
        );
        const valueAfterBlur = Number(snapshot.parameterValues.oscAWavetablePosition);

        await stage.dispatchEvent("pointermove", {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x + 2,
            clientY: start.y - 94,
        });
        await stage.dispatchEvent("pointerup", {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x + 2,
            clientY: start.y - 94,
        });
        await page.waitForTimeout(60);
        snapshot = await getIOSHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.oscAWavetablePosition), valueAfterBlur);
        assert.deepEqual(snapshot.gestureEnds, ["oscAWavetablePosition"]);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone graph keeps tracking touch when pointer capture is unavailable", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await clearIOSHarnessDebugLog(page);
        const stage = await getShadowLocator(page, '[data-role="mobile-voice-graph"]');
        const bounds = await stage.boundingBox();
        assert.ok(bounds);
        await stage.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        const pointerId = 93;
        const start = {
            x: bounds.x + (bounds.width * 0.5),
            y: bounds.y + (bounds.height * 0.72),
        };

        await stage.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, start }) => {
            for (const deltaY of [30, 54]) {
                window.dispatchEvent(new PointerEvent("pointermove", {
                    pointerId,
                    pointerType: "touch",
                    button: 0,
                    buttons: 0,
                    clientX: start.x + 2,
                    clientY: start.y - deltaY,
                    bubbles: true,
                }));
            }
        }, { pointerId, start });

        let snapshot = await waitForSnapshot(
            page,
            "capture-free iPhone index gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("oscAWavetablePosition")
                && nextSnapshot.sentMessages.some((message) => message.endpointID === "oscAWavetablePosition"),
        );
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, start }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: start.x + 2,
                clientY: start.y - 54,
                bubbles: true,
            }));
        }, { pointerId, start });
        snapshot = await waitForSnapshot(
            page,
            "capture-free iPhone index release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("oscAWavetablePosition"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["oscAWavetablePosition"]);
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

test("mounted iPhone distortion controls send parameter updates through the patch connection", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        await clearIOSHarnessDebugLog(page);

        await page.evaluate(() => {
            const shadowRoot = document.querySelector("cosimo-synth-view")?.shadowRoot;
            const modeButton = shadowRoot?.querySelector("[data-role='distortion-mode-option-1']");
            const typeButton = shadowRoot?.querySelector("[data-role='distortion-type-option-2']");

            if (modeButton instanceof HTMLButtonElement) modeButton.click();
            if (typeButton instanceof HTMLButtonElement) typeButton.click();
        });
        await dispatchShadowInputValueChange(page, "[data-role='distortion-drive-slider']", "16.500");
        await dispatchShadowInputValueChange(page, "[data-role='distortion-mix-slider']", "0.580");

        // Distortion params ride the lane field upload since the parameter
        // cut: slot 1 (distortion, ordinal 0), positional param indexes from
        // the engine's laneDistortionParam* constants.
        const laneParamSend = (message, paramIndex, expectedValue) => (
            message.endpointID === "laneSlotParamValue"
            && Number(message.value?.slotId) === 1
            && Number(message.value?.paramIndex) === paramIndex
            && Math.abs(Number(message.value?.value) - expectedValue) <= 1e-6
        );
        const snapshot = await waitForSnapshot(
            page,
            "iPhone distortion parameter updates",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => laneParamSend(message, 0, 1))
                && nextSnapshot.sentMessages.some((message) => laneParamSend(message, 1, 16.5))
                && nextSnapshot.sentMessages.some((message) => laneParamSend(message, 3, 0.58))
                && nextSnapshot.sentMessages.some((message) => laneParamSend(message, 6, 2)),
        );

        assert.equal(snapshot.gestureStarts.includes("distortionMode"), true);
        assert.equal(snapshot.gestureStarts.includes("distortionType"), true);
        assert.equal(snapshot.gestureEnds.includes("distortionWet"), true);
        const distortionParams = JSON.parse(snapshot.storedState["lane.v1"]).devices["distortion#1"].params;
        assert.equal(distortionParams.distortionWet, 0.58);
        assert.equal(distortionParams.distortionType, 2);
    } finally {
        await closeIOSHarnessPage(page);
    }
});

test("mounted iPhone distortion panel renders transfer occupancy on the shared scale", async () => {
    const page = await openIOSHarnessPage(browser, server.baseUrl, {
        viewportSize: { width: 390, height: 844 },
    });

    try {
        await waitForIOSHarnessReady(page);
        const scopeFixture = buildDistortionScopeFixture();
        const historyFixture = buildDistortionHistoryFixture();

        await emitIOSHarnessDistortionScope(page, scopeFixture);
        await emitIOSHarnessDistortionHistory(page, historyFixture);

        const renderedState = await waitForRenderedState(
            page,
            "iPhone distortion graph state",
            (nextState) => Boolean(
                nextState.distortionGraphState?.transfer?.occupancySegmentCount > 0
                && nextState.distortionGraphState?.history?.validBinCount > 0
            ),
        );

        assert.equal(renderedState.distortionGraphState.displayRange, 2);
        assert.equal(renderedState.distortionGraphState.inputPeak > renderedState.distortionGraphState.outputPeak, true);
        assert.equal(renderedState.distortionGraphState.removedPeak > 0.1, true);
        assert.equal(renderedState.distortionGraphState.clippedSampleCount > 0, true);
        assert.equal(renderedState.distortionGraphState.transfer.occupancySegmentCount > 0, true);
        assert.equal(renderedState.distortionGraphState.transfer.clippedOccupancySegmentCount > 0, true);
        assert.equal(renderedState.distortionGraphState.history.binCount, historyFixture.binCount);
        assert.equal(renderedState.distortionGraphState.history.validBinCount, historyFixture.validBinCount);
        assert.equal(renderedState.distortionGraphState.history.clippedBinCount > 0, true);
        assert.equal(renderedState.distortionGraphState.history.removedPeak > 0.1, true);
        assert.match(renderedState.distortionDriveReadout ?? "", /dB/);
        assert.match(renderedState.distortionMixReadout ?? "", /%/);
    } finally {
        await closeIOSHarnessPage(page);
    }
});
