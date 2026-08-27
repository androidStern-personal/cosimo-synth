import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import path from "node:path";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(repoRoot, "fx/enhancer_lite/view/source.ts");

const initialValues = {
    freqHzIn: 130,
    qIn: 0.71,
    modeIn: 0,
    midAmountIn: 0,
    sideAmountIn: 0,
    curveIn: 1,
    saturationModeIn: 0,
    shapeIn: 1,
};

let server;
let browser;

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

async function openEnhancerLite(modulePath = "/fx/enhancer_lite/view/source.ts") {
    const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async ({ values, sourceModulePath }) => {
        const parameterValues = new Map(Object.entries(values));
        const listeners = new Map();
        const endpointListeners = new Map();
        const sent = [];

        const emit = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            for (const listener of listeners.get(endpointID) ?? [])
                listener(value);
        };
        const emitEndpoint = (endpointID, value) => {
            for (const listener of endpointListeners.get(endpointID) ?? [])
                listener(value);
        };

        const patchConnection = {
            addParameterListener(endpointID, listener) {
                const endpointListeners = listeners.get(endpointID) ?? new Set();
                endpointListeners.add(listener);
                listeners.set(endpointID, endpointListeners);
            },
            removeParameterListener(endpointID, listener) {
                listeners.get(endpointID)?.delete(listener);
            },
            requestParameterValue(endpointID) {
                queueMicrotask(() => emit(endpointID, parameterValues.get(endpointID)));
            },
            addEndpointListener(endpointID, listener) {
                const listenersForEndpoint = endpointListeners.get(endpointID) ?? new Set();
                listenersForEndpoint.add(listener);
                endpointListeners.set(endpointID, listenersForEndpoint);
            },
            removeEndpointListener(endpointID, listener) {
                endpointListeners.get(endpointID)?.delete(listener);
            },
            sendEventOrValue(endpointID, value) {
                sent.push({ endpointID, value });
                emit(endpointID, value);
            },
        };

        const module = await import(sourceModulePath);
        document.querySelector("#mount").replaceChildren(module.default(patchConnection));
        window.__ENHANCER_LITE_TEST__ = {
            emit,
            emitEndpoint,
            sent,
            clearSent: () => sent.splice(0),
            endpointListenerCount: (endpointID) => endpointListeners.get(endpointID)?.size ?? 0,
            disconnect: () => document.querySelector("#mount").replaceChildren(),
        };
    }, { values: initialValues, sourceModulePath: modulePath });
    await page.locator("cosimo-enhancer-lite-view").waitFor();
    return page;
}

function shadow(page, selector) {
    return page.locator(`cosimo-enhancer-lite-view >> ${selector}`);
}

async function drag(page, locator, deltaX, deltaY, modifiers = []) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, "drag target must have browser geometry");
    const originX = bounds.x + bounds.width / 2;
    const originY = bounds.y + bounds.height / 2;

    for (const modifier of modifiers)
        await page.keyboard.down(modifier);
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    await page.mouse.move(originX + deltaX, originY + deltaY, { steps: 5 });
    await page.mouse.up();
    for (const modifier of [...modifiers].reverse())
        await page.keyboard.up(modifier);
}

async function measurePrimaryHandleDrag(page, shape, shapeIn) {
    const handle = shadow(page, "[data-response-role='primary-handle']");
    await page.evaluate((selectedShapeIn) => {
        window.__ENHANCER_LITE_TEST__.emit("shapeIn", selectedShapeIn);
        window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
        window.__ENHANCER_LITE_TEST__.emit("qIn", 0.7);
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0);
    }, shapeIn);
    const zeroCy = Number(await handle.getAttribute("cy"));
    await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1));
    const fullCy = Number(await handle.getAttribute("cy"));
    await page.evaluate(() => {
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.25);
        window.__ENHANCER_LITE_TEST__.clearSent();
    });
    const beforeCy = Number(await handle.getAttribute("cy"));
    const pointerDeltaY = -40;
    await drag(page, handle, 0, pointerDeltaY);
    const afterCy = Number(await handle.getAttribute("cy"));
    const amountEvents = (await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent))
        .filter(({ endpointID }) => endpointID === "midAmountIn");
    assert.ok(amountEvents.length > 0, `${shape} emitted no Amount gesture`);
    const amount = amountEvents.at(-1).value;
    const expectedAmount = 0.25 - pointerDeltaY / 240;
    const expectedCy = zeroCy - expectedAmount * (zeroCy - fullCy);

    assert.equal(zeroCy, 244, `${shape} zero-Amount geometry drifted`);
    assert.equal(fullCy, 18, `${shape} full-Amount geometry drifted`);
    assert.ok(Math.abs(amount - expectedAmount) < 1e-6, `${shape}: ${amount} vs ${expectedAmount}`);
    assert.ok(Math.abs(afterCy - expectedCy) <= 0.02, `${shape}: ${afterCy} vs ${expectedCy}`);
    assert.ok(beforeCy - afterCy > 30, `${shape} handle detached from a 40 px pointer drag`);

    return { shape, zeroCy, fullCy, beforeCy, afterCy, amount };
}

async function beginCapturedDrag(page, locator) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, "drag target must have browser geometry");
    const originX = bounds.x + bounds.width / 2;
    const originY = bounds.y + bounds.height / 2;
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    const pointerID = await locator.evaluate((element) => {
        for (let candidate = 1; candidate <= 32; candidate += 1) {
            if (element.hasPointerCapture(candidate))
                return candidate;
        }
        return undefined;
    });
    assert.equal(typeof pointerID, "number");
    assert.equal(await locator.getAttribute("data-dragging"), "");
    return { originX, originY, pointerID };
}

async function frequencyRatioAfterDrag(page, locator, originFrequencyHz, horizontalPixels) {
    await page.evaluate((frequencyHz) => {
        window.__ENHANCER_LITE_TEST__.emit("freqHzIn", frequencyHz);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originFrequencyHz);
    await drag(page, locator, horizontalPixels, 0);
    const finalFrequencyHz = await page.evaluate(() => (
        window.__ENHANCER_LITE_TEST__.sent
            .filter(({ endpointID }) => endpointID === "freqHzIn")
            .at(-1)?.value
    ));
    assert.equal(typeof finalFrequencyHz, "number");
    return finalFrequencyHz / originFrequencyHz;
}

async function amountAfterDrag(page, locator, originAmount, verticalPixels) {
    await page.evaluate((amount) => {
        window.__ENHANCER_LITE_TEST__.emit("midAmountIn", amount);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originAmount);
    await drag(page, locator, 0, verticalPixels);
    const finalAmount = await page.evaluate(() => (
        window.__ENHANCER_LITE_TEST__.sent
            .filter(({ endpointID }) => endpointID === "midAmountIn")
            .at(-1)?.value
    ));
    assert.equal(typeof finalAmount, "number");
    return finalAmount;
}

async function qAfterDrag(page, locator, originQ, verticalPixels, modifiers = []) {
    await page.evaluate((q) => {
        window.__ENHANCER_LITE_TEST__.emit("qIn", q);
        window.__ENHANCER_LITE_TEST__.clearSent();
    }, originQ);
    await drag(page, locator, 0, verticalPixels, modifiers);
    const finalQ = await page.evaluate(() => (
        window.__ENHANCER_LITE_TEST__.sent
            .filter(({ endpointID }) => endpointID === "qIn")
            .at(-1)?.value
    ));
    assert.equal(typeof finalQ, "number");
    return finalQ;
}

test("the Frequency readout drags one octave per 80 horizontal pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = shadow(page, "[data-readout-control='frequency']");
        assert.equal(await frequencyReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, frequencyReadout, 80, 0);
        const frequencyEvents = await page.evaluate(() => (
            window.__ENHANCER_LITE_TEST__.sent
                .filter(({ endpointID }) => endpointID === "freqHzIn")
        ));
        assert.ok(frequencyEvents.length > 1, JSON.stringify(frequencyEvents));
        assert.ok(Math.abs(frequencyEvents.at(-1).value - 2000) < 1e-6);
        assert.equal(await frequencyReadout.getAttribute("data-dragging"), null);
        assert.equal(
            await frequencyReadout.evaluate((element) => element.getRootNode().activeElement === element),
            true,
        );
    } finally {
        await page.close();
    }
});

test("Frequency uses the same fixed logarithmic law at every value and editor width", async () => {
    const expectedRatio = Math.sqrt(2);

    for (const { viewportWidth, editorWidth } of [
        { viewportWidth: 1000, editorWidth: 820 },
        { viewportWidth: 620, editorWidth: 560 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: 620 });
            await page.locator("cosimo-enhancer-lite-view").evaluate((host, width) => {
                host.style.width = `${width}px`;
            }, editorWidth);
            const frequencyReadout = shadow(page, "[data-readout-control='frequency']");
            const primaryHandle = shadow(page, "[data-response-role='primary-handle']");
            const lowRatio = await frequencyRatioAfterDrag(page, frequencyReadout, 100, 40);
            const highRatio = await frequencyRatioAfterDrag(page, frequencyReadout, 8000, 40);
            const bellRatio = await frequencyRatioAfterDrag(page, primaryHandle, 1000, 40);

            assert.ok(Math.abs(lowRatio - expectedRatio) < 1e-6, String(lowRatio));
            assert.ok(Math.abs(highRatio - expectedRatio) < 1e-6, String(highRatio));
            assert.ok(Math.abs(bellRatio - expectedRatio) < 1e-6, String(bellRatio));
        } finally {
            await page.close();
        }
    }
});

test("the Amount readout gains half scale over 120 upward pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const amountReadout = shadow(page, "[data-readout-control='primary-amount']");
        assert.equal(await amountReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.25);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, amountReadout, 0, -120);
        const amountEvents = await page.evaluate(() => (
            window.__ENHANCER_LITE_TEST__.sent
                .filter(({ endpointID }) => endpointID === "midAmountIn")
        ));
        assert.ok(amountEvents.length > 1, JSON.stringify(amountEvents));
        assert.ok(Math.abs(amountEvents.at(-1).value - 0.75) < 1e-6);
    } finally {
        await page.close();
    }
});

test("the Q readout doubles Q over 40 upward pixels", async () => {
    const page = await openEnhancerLite();

    try {
        const qReadout = shadow(page, "[data-readout-control='q']");
        assert.equal(await qReadout.count(), 1);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, qReadout, 0, -40);
        const qEvents = await page.evaluate(() => (
            window.__ENHANCER_LITE_TEST__.sent
                .filter(({ endpointID }) => endpointID === "qIn")
        ));
        assert.ok(qEvents.length > 1, JSON.stringify(qEvents));
        assert.ok(Math.abs(qEvents.at(-1).value - 1) < 1e-6);
    } finally {
        await page.close();
    }
});

test("Amount uses the same fixed vertical law in the readout and bell at every editor size", async () => {
    for (const { viewportWidth, viewportHeight, editorWidth, plotHeight } of [
        { viewportWidth: 1000, viewportHeight: 620, editorWidth: 820, plotHeight: 272 },
        { viewportWidth: 620, viewportHeight: 520, editorWidth: 560, plotHeight: 180 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
            await page.locator("cosimo-enhancer-lite-view").evaluate((host, width) => {
                host.style.width = `${width}px`;
            }, editorWidth);
            await shadow(page, ".response-plot").evaluate((plot, height) => {
                plot.style.height = `${height}px`;
            }, plotHeight);
            const amountReadout = shadow(page, "[data-readout-control='primary-amount']");
            const primaryHandle = shadow(page, "[data-response-role='primary-handle']");
            const readoutAmount = await amountAfterDrag(page, amountReadout, 0.25, -60);
            const bellAmount = await amountAfterDrag(page, primaryHandle, 0.25, -60);

            assert.ok(Math.abs(readoutAmount - 0.5) < 1e-6, String(readoutAmount));
            assert.ok(Math.abs(bellAmount - 0.5) < 1e-6, String(bellAmount));
        } finally {
            await page.close();
        }
    }
});

test("Q uses the same fixed logarithmic law in the readout and Shift-drag bell", async () => {
    for (const { viewportWidth, viewportHeight, editorWidth, plotHeight } of [
        { viewportWidth: 1000, viewportHeight: 620, editorWidth: 820, plotHeight: 272 },
        { viewportWidth: 620, viewportHeight: 520, editorWidth: 560, plotHeight: 180 },
    ]) {
        const page = await openEnhancerLite();
        try {
            await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
            await page.locator("cosimo-enhancer-lite-view").evaluate((host, width) => {
                host.style.width = `${width}px`;
            }, editorWidth);
            await shadow(page, ".response-plot").evaluate((plot, height) => {
                plot.style.height = `${height}px`;
            }, plotHeight);
            const qReadout = shadow(page, "[data-readout-control='q']");
            const primaryHandle = shadow(page, "[data-response-role='primary-handle']");
            const readoutQ = await qAfterDrag(page, qReadout, 0.5, -40);
            const bellQ = await qAfterDrag(page, primaryHandle, 0.5, -40, ["Shift"]);

            assert.ok(Math.abs(readoutQ - 1) < 1e-6, String(readoutQ));
            assert.ok(Math.abs(bellQ - 1) < 1e-6, String(bellQ));
        } finally {
            await page.close();
        }
    }
});

test("readout drag direction and endpoint clamps stay truthful", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = shadow(page, "[data-readout-control='frequency']");
        const amountReadout = shadow(page, "[data-readout-control='primary-amount']");
        const qReadout = shadow(page, "[data-readout-control='q']");

        assert.ok(Math.abs(
            await frequencyRatioAfterDrag(page, frequencyReadout, 30, -800) * 30 - 20,
        ) < 1e-6);
        assert.ok(Math.abs(
            await frequencyRatioAfterDrag(page, frequencyReadout, 15_000, 800) * 15_000 - 20_000,
        ) < 1e-6);
        assert.ok(Math.abs(await amountAfterDrag(page, amountReadout, 0.5, -24) - 0.6) < 1e-6);
        assert.ok(Math.abs(await amountAfterDrag(page, amountReadout, 0.5, 24) - 0.4) < 1e-6);
        assert.equal(await amountAfterDrag(page, amountReadout, 0.5, -720), 1);
        assert.equal(await amountAfterDrag(page, amountReadout, 0.5, 720), 0);
        assert.ok(Math.abs(await qAfterDrag(page, qReadout, 0.5, -40) - 1) < 1e-6);
        assert.ok(Math.abs(await qAfterDrag(page, qReadout, 0.5, 40) - 0.25) < 1e-6);
        assert.equal(await qAfterDrag(page, qReadout, 0.2, -400), 10);
        assert.equal(await qAfterDrag(page, qReadout, 5, 400), 0.1);
    } finally {
        await page.close();
    }
});

test("every shape shares frequency, amount, and Shift-drag Q with no slider fallback", async () => {
    const page = await openEnhancerLite();

    try {
        assert.equal(await shadow(page, "input[type='range']").count(), 0);
        const primaryHandle = shadow(page, "[data-response-role='primary-handle']");

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, primaryHandle, 120, -82);
        const primaryGesture = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        const frequencyEvents = primaryGesture.filter(({ endpointID }) => endpointID === "freqHzIn");
        const amountEvents = primaryGesture.filter(({ endpointID }) => endpointID === "midAmountIn");
        assert.ok(frequencyEvents.length > 0, JSON.stringify(primaryGesture));
        assert.ok(amountEvents.length > 0, JSON.stringify(primaryGesture));
        assert.ok(frequencyEvents.at(-1).value > 130);
        assert.ok(amountEvents.at(-1).value > 0);
        assert.equal(primaryGesture.some(({ endpointID }) => endpointID === "qIn"), false);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, primaryHandle, 80, -65, ["Shift"]);
        const qGesture = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(qGesture.length > 0);
        assert.equal(qGesture.every(({ endpointID }) => endpointID === "qIn"), true);
        assert.ok(qGesture.at(-1).value > 0.71);
    } finally {
        await page.close();
    }
});

test("Bell, Low, and High Amount handles follow real pointer travel in source and compiled UI", async () => {
    const modulePaths = [
        "/fx/enhancer_lite/view/source.ts",
        "/build/fx/enhancer_lite_runtime/view/app.js",
    ];
    const results = [];
    for (const modulePath of modulePaths) {
        const page = await openEnhancerLite(modulePath);
        try {
            results.push({
                modulePath,
                shapes: [
                    await measurePrimaryHandleDrag(page, "bell", 1),
                    await measurePrimaryHandleDrag(page, "low", 0),
                    await measurePrimaryHandleDrag(page, "high", 2),
                ],
            });
        } finally {
            await page.close();
        }
    }

    assert.deepEqual(results[1].shapes, results[0].shapes);
});

test("losing pointer capture closes the bell gesture before later movement", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryHandle = shadow(page, "[data-response-role='primary-handle']");
        const { originX, originY, pointerID } = await beginCapturedDrag(page, primaryHandle);
        await primaryHandle.evaluate((element, capturedPointerID) => {
            element.releasePointerCapture(capturedPointerID);
            element.dispatchEvent(new PointerEvent("lostpointercapture", {
                bubbles: true,
                isPrimary: true,
                pointerId: capturedPointerID,
            }));
        }, pointerID);
        assert.equal(await primaryHandle.getAttribute("data-dragging"), null);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await page.mouse.move(originX + 25, originY - 25);
        await page.mouse.up();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
    } finally {
        await page.close();
    }
});

test("readout pointer cancellation and capture loss close without stale writes", async () => {
    for (const terminalEvent of ["pointercancel", "lostpointercapture"]) {
        const page = await openEnhancerLite();
        try {
            const qReadout = shadow(page, "[data-readout-control='q']");
            const { originX, originY, pointerID } = await beginCapturedDrag(page, qReadout);
            await qReadout.evaluate((element, detail) => {
                if (detail.terminalEvent === "lostpointercapture")
                    element.releasePointerCapture(detail.pointerID);
                element.dispatchEvent(new PointerEvent(detail.terminalEvent, {
                    bubbles: true,
                    isPrimary: true,
                    pointerId: detail.pointerID,
                }));
            }, { pointerID, terminalEvent });
            assert.equal(await qReadout.getAttribute("data-dragging"), null);

            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
            await page.mouse.move(originX, originY - 30);
            await page.mouse.up();
            assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
        } finally {
            await page.close();
        }
    }
});

test("disconnect closes an active readout gesture and releases capture", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = shadow(page, "[data-readout-control='frequency']");
        const { pointerID } = await beginCapturedDrag(page, frequencyReadout);
        const cleanup = await page.evaluate((capturedPointerID) => {
            const view = document.querySelector("cosimo-enhancer-lite-view");
            const readout = view.shadowRoot.querySelector("[data-readout-control='frequency']");
            document.querySelector("#mount").replaceChildren();
            return {
                captured: readout.hasPointerCapture(capturedPointerID),
                dragging: readout.hasAttribute("data-dragging"),
            };
        }, pointerID);
        await page.mouse.up();
        assert.deepEqual(cleanup, { captured: false, dragging: false });
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)), {
            endpointID: "analyzerEnabledIn",
            value: 0,
        });
    } finally {
        await page.close();
    }
});

test("readouts ignore ineligible starts while selection stays suppressed and buttons work", async () => {
    const page = await openEnhancerLite();

    try {
        const amountReadout = shadow(page, "[data-readout-control='primary-amount']");
        const bounds = await amountReadout.boundingBox();
        assert.ok(bounds);
        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down({ button: "right" });
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 60);
        await page.mouse.up({ button: "right" });
        await amountReadout.dispatchEvent("pointerdown", {
            button: 0,
            bubbles: true,
            isPrimary: false,
            pointerId: 77,
            pointerType: "touch",
        });
        assert.equal(await amountReadout.getAttribute("data-dragging"), null);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent), []);
        assert.equal(await amountReadout.evaluate((element) => getComputedStyle(element).userSelect), "none");

        await shadow(page, "[data-curve='tube']").click();
        await shadow(page, "[data-mode='mid-side']").click();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.slice(-2)), [
            { endpointID: "curveIn", value: 0 },
            { endpointID: "modeIn", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("M/S exposes an independent draggable Side amount while sharing frequency and Q", async () => {
    const page = await openEnhancerLite();

    try {
        const sideHandle = shadow(page, "[data-response-role='side-handle']");
        assert.equal(await sideHandle.isHidden(), true);
        assert.equal(await shadow(page, "[data-primary-label]").textContent(), "AMOUNT");

        await shadow(page, "[data-mode='mid-side']").click();
        assert.equal(await sideHandle.isVisible(), true);
        assert.equal(await shadow(page, "[data-primary-label]").textContent(), "MID");

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, sideHandle, 0, -72);
        const sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(sent.some(({ endpointID, value }) => endpointID === "sideAmountIn" && value > 0));
        assert.equal(sent.some(({ endpointID }) => endpointID === "midAmountIn"), false);
    } finally {
        await page.close();
    }
});

test("Mid and Side Amount readouts drag their own production endpoints independently", async () => {
    const page = await openEnhancerLite();

    try {
        const midReadout = shadow(page, "[data-readout-control='primary-amount']");
        const sideReadout = shadow(page, "[data-readout-control='side-amount']");
        assert.equal(await sideReadout.count(), 1);
        assert.equal(await sideReadout.isHidden(), true);
        await shadow(page, "[data-mode='mid-side']").click();
        assert.equal(await sideReadout.isVisible(), true);
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.2);
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.7);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });

        await drag(page, midReadout, 0, -24);
        const midEvents = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(midEvents.some(({ endpointID, value }) => (
            endpointID === "midAmountIn" && Math.abs(value - 0.3) < 1e-6
        )), JSON.stringify(midEvents));
        assert.equal(midEvents.some(({ endpointID }) => endpointID === "sideAmountIn"), false);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await drag(page, sideReadout, 0, 24);
        const sideEvents = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(sideEvents.some(({ endpointID, value }) => (
            endpointID === "sideAmountIn" && Math.abs(value - 0.6) < 1e-6
        )), JSON.stringify(sideEvents));
        assert.equal(sideEvents.some(({ endpointID }) => endpointID === "midAmountIn"), false);
    } finally {
        await page.close();
    }
});

test("readouts expose truthful slider semantics and the bell's keyboard steps", async () => {
    const page = await openEnhancerLite();

    try {
        const frequencyReadout = shadow(page, "[data-readout-control='frequency']");
        const amountReadout = shadow(page, "[data-readout-control='primary-amount']");
        const qReadout = shadow(page, "[data-readout-control='q']");
        assert.deepEqual(await frequencyReadout.evaluate((element) => ({
            role: element.getAttribute("role"),
            label: element.getAttribute("aria-label"),
            orientation: element.getAttribute("aria-orientation"),
            minimum: element.getAttribute("aria-valuemin"),
            maximum: element.getAttribute("aria-valuemax"),
        })), {
            role: "slider",
            label: "Frequency",
            orientation: "horizontal",
            minimum: "20",
            maximum: "20000",
        });

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await frequencyReadout.focus();
        assert.equal(
            await frequencyReadout.evaluate((element) => element.getRootNode().activeElement === element),
            true,
        );
        await frequencyReadout.press("ArrowRight");
        let sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.ok(Math.abs(sent.at(-1).value - 1000 * Math.pow(2, 1 / 12)) < 1e-6);
        assert.equal(sent.at(-1).endpointID, "freqHzIn");

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await amountReadout.press("ArrowUp");
        sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.deepEqual(sent.at(-1), { endpointID: "midAmountIn", value: 0.51 });

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await qReadout.press("ArrowUp");
        sent = await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent);
        assert.equal(sent.at(-1).endpointID, "qIn");
        assert.ok(Math.abs(sent.at(-1).value - 0.5 * Math.pow(2, 1 / 6)) < 1e-6);
        assert.equal(await qReadout.getAttribute("aria-valuetext"), `Q ${sent.at(-1).value.toFixed(2)}`);

        await shadow(page, "[data-mode='mid-side']").click();
        const sideReadout = shadow(page, "[data-readout-control='side-amount']");
        assert.equal(await amountReadout.getAttribute("aria-label"), "Mid Amount");
        assert.equal(await sideReadout.getAttribute("tabindex"), "0");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await sideReadout.press("ArrowDown");
        assert.deepEqual(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)),
            { endpointID: "sideAmountIn", value: 0.49 },
        );
        assert.equal(await sideReadout.getAttribute("aria-valuenow"), String(0.49 * 12));
        assert.equal(await sideReadout.getAttribute("aria-valuetext"), "+5.9 dB");
    } finally {
        await page.close();
    }
});

test("the plotted bell narrows as Q rises and tracks the actual 12 dB amount law", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryPath = shadow(page, "[data-response-role='primary']");
        assert.deepEqual(
            await shadow(page, "[data-gain-db]").evaluateAll((rows) => (
                rows.map((row) => Number(row.getAttribute("data-gain-db")))
            )),
            [12, 9, 6, 3, 0],
        );
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.1);
        });
        const widePath = await primaryPath.getAttribute("d");
        const widePointsAboveSixDb = [...widePath.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .filter((match) => Number(match[2]) < 131).length;

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("qIn", 10));
        const narrowPath = await primaryPath.getAttribute("d");
        const narrowPointsAboveSixDb = [...narrowPath.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .filter((match) => Number(match[2]) < 131).length;

        assert.notEqual(narrowPath, widePath);
        assert.ok(widePointsAboveSixDb > narrowPointsAboveSixDb);
        assert.equal(await shadow(page, "[data-readout='primary']").textContent(), "+12.0 dB");
        assert.equal(await shadow(page, "[data-response-role='primary-handle']").getAttribute("cy"), "18.00");
    } finally {
        await page.close();
    }
});

test("Low and High draw measured shelf responses with a directly manipulated Amount handle", async () => {
    const page = await openEnhancerLite();

    try {
        const primaryPath = shadow(page, "[data-response-role='primary']");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.7);
        });
        const bellPath = await primaryPath.getAttribute("d");
        assert.equal(await shadow(page, "[data-shelf-overflow='high']").isHidden(), true);
        assert.equal(await shadow(page, "[data-response-role='primary-guide']").isHidden(), true);

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.clearSent());
        await shadow(page, "[data-shape='low']").click();
        const lowPath = await primaryPath.getAttribute("d");
        assert.notEqual(lowPath, bellPath);
        assert.equal(await shadow(page, "[data-shape='low']").getAttribute("aria-pressed"), "true");
        assert.equal(await shadow(page, "[data-shelf-overflow='high']").isVisible(), true);
        assert.equal(await shadow(page, "[data-shelf-overflow='low']").isVisible(), true);
        assert.equal(
            await shadow(page, "[data-response-role='primary-guide']").getAttribute("hidden"),
            null,
        );
        assert.match(
            await shadow(page, "[data-response-role='primary-guide']").getAttribute("d"),
            /^M [\d.]+ 18\.00 V [\d.]+$/,
        );
        assert.equal(
            await shadow(page, "[data-response-role='primary-handle']").getAttribute("cy"),
            "18.00",
        );

        await shadow(page, "[data-shape='high']").click();
        const highPath = await primaryPath.getAttribute("d");
        assert.notEqual(highPath, lowPath);
        assert.equal(await shadow(page, "[data-shape='high']").getAttribute("aria-pressed"), "true");
        assert.deepEqual(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent),
            [
                { endpointID: "shapeIn", value: 0 },
                { endpointID: "shapeIn", value: 2 },
            ],
        );

        const points = (pathValue) => [...pathValue.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
        const lowPoints = points(lowPath);
        const highPoints = points(highPath);
        assert.ok(lowPoints[0].y < lowPoints.at(-1).y, JSON.stringify(lowPoints.slice(0, 1)));
        assert.ok(highPoints[0].y > highPoints.at(-1).y, JSON.stringify(highPoints.slice(-1)));

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.emit("qIn", 10));
        const resonantHighPath = await primaryPath.getAttribute("d");
        assert.notEqual(resonantHighPath, highPath);
        const resonantY = points(resonantHighPath).map(({ y }) => y);
        assert.ok(Math.min(...resonantY) <= 21);
        assert.ok(Math.max(...resonantY) >= 241);
    } finally {
        await page.close();
    }
});

test("input and output spectra share the bell's frequency grid and aligned dB rows", async () => {
    const page = await openEnhancerLite();

    try {
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 1);
            const inputMagnitudes = new Array(2048).fill(0);
            const outputMagnitudes = new Array(2048).fill(0);
            const bin = Math.round(1000 * 4096 / 48_000);
            inputMagnitudes[bin] = 0.25;
            outputMagnitudes[bin] = 0.5;
            window.__ENHANCER_LITE_TEST__.emitEndpoint("inputSpectrum", {
                sampleRateHz: 48_000,
                magnitudes: inputMagnitudes,
            });
            window.__ENHANCER_LITE_TEST__.emitEndpoint("outputSpectrum", {
                event: {
                    sampleRateHz: 48_000,
                    magnitudes: outputMagnitudes,
                },
            });
        });

        const inputPath = await shadow(page, "[data-spectrum-role='input']").getAttribute("d");
        const outputPath = await shadow(page, "[data-spectrum-role='output']").getAttribute("d");
        assert.ok(inputPath.length > 1000);
        assert.ok(outputPath.length > 1000);
        assert.notEqual(inputPath, outputPath);
        assert.equal(await shadow(page, "[data-spectrum-peak='input']").textContent(), "-12.0 dB");
        assert.equal(await shadow(page, "[data-spectrum-peak='output']").textContent(), "-6.0 dB");

        const parsePoints = (pathValue) => [...pathValue.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
            .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
        const inputPeak = parsePoints(inputPath).reduce((peak, point) => (
            point.y < peak.y ? point : peak
        ));
        const outputPeak = parsePoints(outputPath).reduce((peak, point) => (
            point.y < peak.y ? point : peak
        ));
        const handleX = Number(await shadow(page, "[data-response-role='primary-handle']").getAttribute("cx"));
        const oneKhzTickX = Number(await shadow(page, "[data-frequency-hz='1000']").getAttribute("x"));
        assert.equal(handleX, oneKhzTickX);
        assert.ok(Math.abs(inputPeak.x - handleX) <= 5, `${inputPeak.x} vs ${handleX}`);
        assert.ok(Math.abs(outputPeak.x - handleX) <= 5, `${outputPeak.x} vs ${handleX}`);
        assert.ok(outputPeak.y < inputPeak.y);

        const gainRowY = await shadow(page, "[data-gain-db='6']").getAttribute("y");
        const levelRowY = await shadow(page, "[data-level-dbfs='-36']").getAttribute("y");
        assert.equal(gainRowY, levelRowY);
        if (process.env.ENHANCER_LITE_SCREENSHOT_PATH) {
            await shadow(page, "[data-mode='mid-side']").click();
            await page.evaluate(() => {
                window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.55);
                window.scrollTo(0, 0);
            });
            await shadow(page, "img.wordmark").evaluate((image) => image.decode());
            await page.waitForTimeout(100);
            await page.screenshot({
                path: process.env.ENHANCER_LITE_SCREENSHOT_PATH,
                fullPage: true,
            });
        }
    } finally {
        await page.close();
    }
});

test("the editor enables live analysis only while its view is connected", async () => {
    const page = await openEnhancerLite();

    try {
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent[0]), {
            endpointID: "analyzerEnabledIn",
            value: 1,
        });
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("inputSpectrum")),
            1,
        );
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("outputSpectrum")),
            1,
        );

        await page.evaluate(() => window.__ENHANCER_LITE_TEST__.disconnect());
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.at(-1)), {
            endpointID: "analyzerEnabledIn",
            value: 0,
        });
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("inputSpectrum")),
            0,
        );
        assert.equal(
            await page.evaluate(() => window.__ENHANCER_LITE_TEST__.endpointListenerCount("outputSpectrum")),
            0,
        );
    } finally {
        await page.close();
    }
});

test("the generated white wordmark replaces the plain-text product heading", async () => {
    const source = await readFile(sourcePath, "utf8");
    assert.doesNotMatch(source, /<h1>Enhancer Lite<\/h1>/);

    for (const modulePath of [
        "/fx/enhancer_lite/view/source.ts",
        "/build/fx/enhancer_lite_runtime/view/app.js",
    ]) {
        const page = await openEnhancerLite(modulePath);
        try {
            const wordmark = shadow(page, "img.wordmark");
            await wordmark.evaluate((image) => image.decode());
            const rendered = await wordmark.evaluate((image) => ({
                alt: image.alt,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                sourcePath: new URL(image.currentSrc).pathname,
            }));
            assert.deepEqual(rendered, {
                alt: "Enhancer Lite",
                complete: true,
                naturalWidth: 1024,
                naturalHeight: 78,
                sourcePath: modulePath.startsWith("/build/")
                    ? "/build/fx/enhancer_lite_runtime/assets/enhancer-lite-wordmark.png"
                    : "/fx/enhancer_lite/assets/enhancer-lite-wordmark.png",
            });
            assert.equal(await shadow(page, "h1").textContent(), "");
        } finally {
            await page.close();
        }
    }
});

test("the surface is solid black, neon, and free of the removed de-emphasis UI", async () => {
    const source = await readFile(sourcePath, "utf8");
    assert.doesNotMatch(source, /gradient/i);
    assert.doesNotMatch(source, /de[- ]?emphasis/i);

    const page = await openEnhancerLite();
    try {
        const colors = await shadow(page, ".shell").evaluate((shell) => {
            const host = shell.getRootNode().host;
            return {
                host: getComputedStyle(host).backgroundColor,
                shell: getComputedStyle(shell).backgroundColor,
                primary: getComputedStyle(
                    shell.getRootNode().querySelector(".response-handle.primary"),
                ).fill,
            };
        });
        assert.deepEqual(colors, {
            host: "rgb(0, 0, 0)",
            shell: "rgb(0, 0, 0)",
            primary: "rgb(0, 240, 255)",
        });
        assert.deepEqual(
            await shadow(page, ".drag-affordance").allTextContents(),
            ["↔", "↕", "↕", "↕"],
        );
        assert.equal(await shadow(page, "[data-spectrum-role='input']").count(), 1);
        assert.equal(await shadow(page, "[data-spectrum-role='output']").count(), 1);
        assert.equal(await shadow(page, "[data-endpoint-id='deEmphasisIn']").count(), 0);
    } finally {
        await page.close();
    }
});

test("host-restored shape, character, and intensity select the truthful segment", async () => {
    const page = await openEnhancerLite();

    try {
        assert.equal(await shadow(page, "[data-curve='solid']").getAttribute("aria-pressed"), "true");
        assert.equal(
            await shadow(page, "[data-saturation-mode='subtle']").getAttribute("aria-pressed"),
            "true",
        );
        assert.equal(await shadow(page, "[data-shape='bell']").getAttribute("aria-pressed"), "true");
        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("curveIn", 0);
            window.__ENHANCER_LITE_TEST__.emit("saturationModeIn", 1);
            window.__ENHANCER_LITE_TEST__.emit("shapeIn", 2);
        });
        assert.equal(await shadow(page, "[data-curve='tube']").getAttribute("aria-pressed"), "true");
        assert.equal(await shadow(page, "[data-curve='solid']").getAttribute("aria-pressed"), "false");
        assert.equal(
            await shadow(page, "[data-saturation-mode='medium']").getAttribute("aria-pressed"),
            "true",
        );
        assert.equal(
            await shadow(page, "[data-saturation-mode='subtle']").getAttribute("aria-pressed"),
            "false",
        );
        assert.equal(await shadow(page, "[data-shape='high']").getAttribute("aria-pressed"), "true");
        assert.equal(await shadow(page, "[data-shape='bell']").getAttribute("aria-pressed"), "false");
    } finally {
        await page.close();
    }
});

test("the compiled VST view preserves the same gesture surface and eight static controls", async () => {
    const page = await openEnhancerLite("/build/fx/enhancer_lite_runtime/view/app.js");

    try {
        assert.equal(await shadow(page, ".response-panel").count(), 1);
        assert.equal(await shadow(page, "input").count(), 0);
        assert.equal(await shadow(page, "[data-readout-control]").count(), 4);
        assert.deepEqual(await shadow(page, ".shell").evaluate((shell) => {
            const root = shell.getRootNode();
            return {
                background: getComputedStyle(shell).backgroundColor,
                frequencyCursor: getComputedStyle(
                    root.querySelector("[data-readout-control='frequency']"),
                ).cursor,
                qCursor: getComputedStyle(root.querySelector("[data-readout-control='q']")).cursor,
            };
        }), {
            background: "rgb(0, 0, 0)",
            frequencyCursor: "ew-resize",
            qCursor: "ns-resize",
        });
        await shadow(page, "[data-shape='low']").click();
        await shadow(page, "[data-saturation-mode='medium']").click();
        await shadow(page, "[data-mode='mid-side']").click();
        assert.equal(await shadow(page, "[data-response-role='side-handle']").isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.slice(-3)), [
            { endpointID: "shapeIn", value: 0 },
            { endpointID: "saturationModeIn", value: 1 },
            { endpointID: "modeIn", value: 1 },
        ]);

        await page.evaluate(() => {
            window.__ENHANCER_LITE_TEST__.emit("freqHzIn", 1000);
            window.__ENHANCER_LITE_TEST__.emit("midAmountIn", 0.2);
            window.__ENHANCER_LITE_TEST__.emit("sideAmountIn", 0.7);
            window.__ENHANCER_LITE_TEST__.emit("qIn", 0.5);
            window.__ENHANCER_LITE_TEST__.clearSent();
        });
        await drag(page, shadow(page, "[data-readout-control='frequency']"), 80, 0);
        await drag(page, shadow(page, "[data-readout-control='primary-amount']"), 0, -24);
        await drag(page, shadow(page, "[data-readout-control='side-amount']"), 0, 24);
        await drag(page, shadow(page, "[data-readout-control='q']"), 0, -40);
        const finalValues = Object.fromEntries(
            (await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent))
                .map(({ endpointID, value }) => [endpointID, value]),
        );
        assert.ok(Math.abs(finalValues.freqHzIn - 2000) < 1e-6);
        assert.ok(Math.abs(finalValues.midAmountIn - 0.3) < 1e-6);
        assert.ok(Math.abs(finalValues.sideAmountIn - 0.6) < 1e-6);
        assert.ok(Math.abs(finalValues.qIn - 1) < 1e-6);
    } finally {
        await page.close();
    }
});
