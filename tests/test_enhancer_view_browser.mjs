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

test("the compiled production view used by the VST renders the same independent routing controls", async () => {
    const page = await openEnhancer("/build/fx/enhancer_runtime/view/app.js");

    try {
        assert.equal(await shadow(page, "[data-endpoint-id='deEmphasisIn']").count(), 1);
        await shadow(page, "[data-band='2'] [data-mode='mid-side']").click();
        assert.equal(await shadow(page, "[data-band='1'] [data-role='side-control']").isHidden(), true);
        assert.equal(await shadow(page, "[data-band='2'] [data-role='side-control']").isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__ENHANCER_TEST__.sent.slice(-1)), [
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
        });

        await assert.doesNotReject(async () => {
            await shadow(page, "[data-band='1'] [data-mode='mid-side'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='2'] [data-mode='stereo'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='1'] [data-curve='tube'][aria-pressed='true']").waitFor();
            await shadow(page, "[data-band='2'] [data-curve='solid'][aria-pressed='true']").waitFor();
        });
    } finally {
        await page.close();
    }
});
