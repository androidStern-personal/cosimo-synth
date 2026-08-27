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
    const plotBounds = await shadow(page, ".response-plot").boundingBox();
    assert.ok(plotBounds, "response plot must have browser geometry");
    const pointerDeltaY = -40;
    await drag(page, handle, 0, pointerDeltaY);
    const afterCy = Number(await handle.getAttribute("cy"));
    const amountEvents = (await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent))
        .filter(({ endpointID }) => endpointID === "midAmountIn");
    assert.ok(amountEvents.length > 0, `${shape} emitted no Amount gesture`);
    const amount = amountEvents.at(-1).value;
    const expectedAmount = 0.25 - pointerDeltaY / plotBounds.height;
    const expectedCy = zeroCy - expectedAmount * (zeroCy - fullCy);

    assert.equal(zeroCy, 244, `${shape} zero-Amount geometry drifted`);
    assert.equal(fullCy, 18, `${shape} full-Amount geometry drifted`);
    assert.ok(Math.abs(amount - expectedAmount) < 1e-6, `${shape}: ${amount} vs ${expectedAmount}`);
    assert.ok(Math.abs(afterCy - expectedCy) <= 0.02, `${shape}: ${afterCy} vs ${expectedCy}`);
    assert.ok(beforeCy - afterCy > 30, `${shape} handle detached from a 40 px pointer drag`);

    return { shape, zeroCy, fullCy, beforeCy, afterCy, amount };
}

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
        await shadow(page, "[data-shape='low']").click();
        await shadow(page, "[data-saturation-mode='medium']").click();
        await shadow(page, "[data-mode='mid-side']").click();
        assert.equal(await shadow(page, "[data-response-role='side-handle']").isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_LITE_TEST__.sent.slice(-3)), [
            { endpointID: "shapeIn", value: 0 },
            { endpointID: "saturationModeIn", value: 1 },
            { endpointID: "modeIn", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});
