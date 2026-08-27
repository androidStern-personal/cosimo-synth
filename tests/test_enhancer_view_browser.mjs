import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import path from "node:path";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const initialValues = {
    b1FreqHzIn: 130,
    b1QIn: 0.71,
    b1ModeIn: 0,
    b1MidAmountIn: 0,
    b1SideAmountIn: 0,
    b1CurveIn: 1,
    b2FreqHzIn: 9000,
    b2QIn: 0.71,
    b2ModeIn: 0,
    b2MidAmountIn: 0,
    b2SideAmountIn: 0,
    b2CurveIn: 0,
    saturationModeIn: 0,
    deEmphasisIn: 1,
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

async function openEnhancer(modulePath = "/fx/enhancer/view/source.ts") {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async ({ values, sourceModulePath }) => {
        const parameterValues = new Map(Object.entries(values));
        const listeners = new Map();
        const sent = [];

        const emit = (endpointID, value) => {
            parameterValues.set(endpointID, value);
            for (const listener of listeners.get(endpointID) ?? [])
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
            sendEventOrValue(endpointID, value) {
                sent.push({ endpointID, value });
                emit(endpointID, value);
            },
        };

        const module = await import(sourceModulePath);
        const view = module.default(patchConnection);
        document.body.appendChild(view);
        window.__ENHANCER_TEST__ = { emit, sent };
    }, { values: initialValues, sourceModulePath: modulePath });
    await page.locator("cosimo-enhancer-view").waitFor();
    return page;
}

function shadow(page, selector) {
    return page.locator(`cosimo-enhancer-view >> ${selector}`);
}

test("each band independently switches between Stereo Amount and Mid/Side amounts", async () => {
    const page = await openEnhancer();

    try {
        assert.equal(await shadow(page, "[data-band='1']").count(), 1);
        assert.equal(await shadow(page, "[data-band='2']").count(), 1);
        assert.equal(await shadow(page, "[data-band='1'] [data-role='primary-label']").textContent(), "Amount");
        assert.equal(await shadow(page, "[data-band='1'] [data-role='side-control']").isHidden(), true);
        assert.equal(await shadow(page, "[data-band='2'] [data-role='side-control']").isHidden(), true);

        await shadow(page, "[data-band='1'] [data-mode='mid-side']").click();
        assert.equal(await shadow(page, "[data-band='1'] [data-role='primary-label']").textContent(), "Mid");
        assert.equal(await shadow(page, "[data-band='1'] [data-role='side-control']").isVisible(), true);
        assert.equal(await shadow(page, "[data-band='2'] [data-role='primary-label']").textContent(), "Amount");
        assert.equal(await shadow(page, "[data-band='2'] [data-role='side-control']").isHidden(), true);

        await shadow(page, "[data-band='1'] [data-endpoint-id='b1MidAmountIn'] input").evaluate((input) => {
            input.value = "0.72";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await shadow(page, "[data-band='1'] [data-endpoint-id='b1SideAmountIn'] input").evaluate((input) => {
            input.value = "0.23";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        const sent = await page.evaluate(() => window.__ENHANCER_TEST__.sent);
        assert.deepEqual(sent.slice(-3), [
            { endpointID: "b1ModeIn", value: 1 },
            { endpointID: "b1MidAmountIn", value: 0.72 },
            { endpointID: "b1SideAmountIn", value: 0.23 },
        ]);
    } finally {
        await page.close();
    }
});

test("de-emphasis is a real global control from no subtraction to full subtraction", async () => {
    const page = await openEnhancer();

    try {
        const control = shadow(page, "[data-endpoint-id='deEmphasisIn']");
        assert.equal(await control.locator("output").textContent(), "100%");

        await control.locator("input").evaluate((input) => {
            input.value = "0";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-1)), [
            { endpointID: "deEmphasisIn", value: 0 },
        ]);
        assert.equal(await control.locator("output").textContent(), "0%");

        await page.evaluate(() => window.__ENHANCER_TEST__.emit("deEmphasisIn", 0.37));
        assert.equal(await control.locator("output").textContent(), "37%");

        await control.locator("input").dblclick();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-1)), [
            { endpointID: "deEmphasisIn", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("the global saturation mode switches between measured Subtle and Medium laws", async () => {
    const page = await openEnhancer();

    try {
        const subtle = shadow(page, "[data-saturation-mode='subtle']");
        const medium = shadow(page, "[data-saturation-mode='medium']");
        assert.equal(await subtle.getAttribute("aria-pressed"), "true");
        assert.equal(await medium.getAttribute("aria-pressed"), "false");

        await medium.click();
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-1)), [
            { endpointID: "saturationModeIn", value: 1 },
        ]);
        assert.equal(await medium.getAttribute("aria-pressed"), "true");

        await page.evaluate(() => window.__ENHANCER_TEST__.emit("saturationModeIn", 0));
        assert.equal(await subtle.getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("the response plot follows Frequency, Q, Amount, and independent Side drive", async () => {
    const page = await openEnhancer();

    try {
        const primaryPath = shadow(page, "[data-response-band='1'][data-response-role='primary']");
        const sidePath = shadow(page, "[data-response-band='1'][data-response-role='side']");
        const primaryHandle = shadow(page, "[data-response-band='1'][data-response-role='primary-handle']");
        const amountOutput = shadow(page, "[data-endpoint-id='b1MidAmountIn'] output");

        const dryPath = await primaryPath.getAttribute("d");
        assert.equal(await amountOutput.textContent(), "+0.0 dB");
        assert.equal(await sidePath.isHidden(), true);

        await page.evaluate(() => {
            window.__ENHANCER_TEST__.emit("b1FreqHzIn", 1000);
            window.__ENHANCER_TEST__.emit("b1MidAmountIn", 1);
            window.__ENHANCER_TEST__.emit("b1QIn", 0.1);
        });
        const widePath = await primaryPath.getAttribute("d");
        const widePointsAboveSixDb = await primaryPath.evaluate((path) => (
            [...(path.getAttribute("d") ?? "").matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
                .filter((match) => Number(match[2]) < 78).length
        ));

        await page.evaluate(() => window.__ENHANCER_TEST__.emit("b1QIn", 10));
        const narrowPath = await primaryPath.getAttribute("d");
        const narrowPointsAboveSixDb = await primaryPath.evaluate((path) => (
            [...(path.getAttribute("d") ?? "").matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
                .filter((match) => Number(match[2]) < 78).length
        ));

        assert.notEqual(widePath, dryPath);
        assert.notEqual(narrowPath, widePath);
        assert.ok(widePointsAboveSixDb > narrowPointsAboveSixDb);
        assert.equal(await amountOutput.textContent(), "+12.0 dB");
        assert.equal(await primaryHandle.getAttribute("cy"), "12.00");
        assert.match(await primaryPath.getAttribute("aria-label"), /1\.00 kHz, Q 10\.00, \+12\.0 dB/);

        await page.evaluate(() => {
            window.__ENHANCER_TEST__.emit("b1ModeIn", 1);
            window.__ENHANCER_TEST__.emit("b1SideAmountIn", 0.5);
        });
        assert.equal(await sidePath.isVisible(), true);
        assert.match(await sidePath.getAttribute("aria-label"), /Band 1 Side: 1\.00 kHz, Q 10\.00, \+6\.0 dB/);
    } finally {
        await page.close();
    }
});

test("the Frequency control spans Spectre's logarithmic 20 Hz to 20 kHz range", async () => {
    const page = await openEnhancer();

    try {
        const input = shadow(page, "[data-endpoint-id='b1FreqHzIn'] input");
        await input.evaluate((slider) => {
            slider.value = "0";
            slider.dispatchEvent(new Event("input", { bubbles: true }));
            slider.value = "1";
            slider.dispatchEvent(new Event("input", { bubbles: true }));
        });
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-2)), [
            { endpointID: "b1FreqHzIn", value: 20 },
            { endpointID: "b1FreqHzIn", value: 20_000 },
        ]);
    } finally {
        await page.close();
    }
});

test("the compiled production view used by the VST renders the same independent routing controls", async () => {
    const page = await openEnhancer("/build/fx/enhancer_runtime/view/app.js");

    try {
        assert.equal(await shadow(page, "[data-endpoint-id='deEmphasisIn']").count(), 1);
        assert.equal(await shadow(page, "[data-saturation-mode='medium']").count(), 1);
        assert.equal(await shadow(page, ".response-panel").count(), 1);
        await shadow(page, "[data-saturation-mode='medium']").click();
        await shadow(page, "[data-band='2'] [data-mode='mid-side']").click();
        assert.equal(await shadow(page, "[data-band='1'] [data-role='side-control']").isHidden(), true);
        assert.equal(await shadow(page, "[data-band='2'] [data-role='side-control']").isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-2)), [
            { endpointID: "saturationModeIn", value: 1 },
            { endpointID: "b2ModeIn", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("host-restored modes and character values update the real control surface", async () => {
    const page = await openEnhancer();

    try {
        await page.evaluate(() => {
            window.__ENHANCER_TEST__.emit("b1ModeIn", 1);
            window.__ENHANCER_TEST__.emit("b2ModeIn", 0);
            window.__ENHANCER_TEST__.emit("b1CurveIn", 0);
            window.__ENHANCER_TEST__.emit("b2CurveIn", 1);
            window.__ENHANCER_TEST__.emit("saturationModeIn", 1);
        });

        await assert.doesNotReject(async () => {
            await shadow(page, "[data-band='1'] [data-mode='mid-side'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='2'] [data-mode='stereo'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='1'] [data-curve='tube'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='2'] [data-curve='solid'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-saturation-mode='medium'][aria-pressed='true']").waitFor();
        });
    } finally {
        await page.close();
    }
});
