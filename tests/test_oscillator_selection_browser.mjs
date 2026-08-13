import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openHarness() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), {
        waitUntil: "load",
    });
    await page.evaluate(async () => {
        const helpers = await import("/tests/helpers/oscillator_selection_browser.tsx");
        const target = document.getElementById("mount");
        if (!(target instanceof HTMLElement)) throw new Error("Module test mount point is missing");
        helpers.installOscillatorSelectionHarness(target);
    });
    await page.waitForFunction(() => (
        window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__?.getSnapshot()?.selectedOscillatorID === "A"
    ));
    return page;
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("shared oscillator selection is local, defaults to A, and routes writes to the selected sibling only", async () => {
    const page = await openHarness();
    try {
        assert.deepEqual(await page.evaluate(() => (
            window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__?.getSnapshot()
        )), {
            selectedOscillatorID: "A",
            oscillatorIndex: 0,
            optionIDs: ["A", "B", "C"],
        });

        for (const [oscillatorID, oscillatorIndex] of [["B", 1], ["C", 2], ["A", 0]]) {
            await page.click(`[data-oscillator-id="${oscillatorID}"]`);
            await page.waitForFunction(([expectedID, expectedIndex]) => {
                const snapshot = window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__?.getSnapshot();
                return snapshot?.selectedOscillatorID === expectedID
                    && snapshot.oscillatorIndex === expectedIndex;
            }, [oscillatorID, oscillatorIndex]);

            const write = await page.evaluate(() => (
                window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__?.projectPanWrite(0.25)
            ));
            assert.deepEqual(write, {
                oscillatorID,
                oscillatorIndex,
                controlID: "pan",
                endpointID: `osc${oscillatorID}Pan`,
                value: 0.25,
            });
        }
    } finally {
        await page.close();
    }

    const restartedPage = await openHarness();
    try {
        assert.equal(await restartedPage.evaluate(() => (
            window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__?.getSnapshot()?.selectedOscillatorID
        )), "A");
    } finally {
        await restartedPage.close();
    }
});
