import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let browser;
let server;

async function openHarness() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), {
        waitUntil: "load",
    });
    await page.evaluate(async () => {
        const helpers = await import("/tests/helpers/desktop_oscillator_presentation_browser.tsx");
        const target = document.getElementById("mount");

        if (!(target instanceof HTMLElement)) {
            throw new Error("Desktop oscillator test mount point is missing");
        }

        helpers.installDesktopOscillatorPresentationHarness(target);
    });
    await page.waitForSelector('[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="A"]');
    return page;
}

async function readAddressProjection(page) {
    return page.locator('[data-role="desktop-oscillator-connection-boundary"]').evaluate((element) => ({
        articulationTargetIDs: element.getAttribute("data-projected-articulation-target-ids")?.split(" ") ?? [],
        modulationTargetIDs: element.getAttribute("data-projected-modulation-target-ids")?.split(" ") ?? [],
        oscillatorID: element.getAttribute("data-oscillator-id"),
        oscillatorIndex: Number(element.getAttribute("data-oscillator-index")),
        soundEndpointIDs: element.getAttribute("data-projected-sound-endpoint-ids")?.split(" ") ?? [],
        tableEndpointID: element.getAttribute("data-projected-table-endpoint-id"),
        tableStatusEndpointID: element.getAttribute("data-table-status-endpoint-id"),
        tableStatusIndex: Number(element.getAttribute("data-table-status-index")),
        wiring: element.getAttribute("data-product-wiring"),
    }));
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("desktop A/B/C tabs expose exact addresses without sending unconnected siblings through A", async () => {
    const page = await openHarness();

    try {
        assert.equal(await page.getByRole("tab", { name: "Oscillator A" }).getAttribute("aria-selected"), "true");
        assert.equal(await page.locator('[data-role="wavetable-card"]').count(), 1);
        const oscillatorAProjection = await readAddressProjection(page);
        assert.deepEqual({
            oscillatorID: oscillatorAProjection.oscillatorID,
            oscillatorIndex: oscillatorAProjection.oscillatorIndex,
            tableEndpointID: oscillatorAProjection.tableEndpointID,
            tableStatusEndpointID: oscillatorAProjection.tableStatusEndpointID,
            tableStatusIndex: oscillatorAProjection.tableStatusIndex,
            wiring: oscillatorAProjection.wiring,
        }, {
            oscillatorID: "A",
            oscillatorIndex: 0,
            tableEndpointID: "oscAWavetableSelect",
            tableStatusEndpointID: "runtimeState",
            tableStatusIndex: 0,
            wiring: "legacy-a-only",
        });
        assert.equal(oscillatorAProjection.soundEndpointIDs.includes("oscAPan"), true);
        assert.equal(oscillatorAProjection.modulationTargetIDs.includes("oscA.framePosition"), true);
        assert.equal(oscillatorAProjection.articulationTargetIDs.includes("oscA.framePosition"), true);

        const topControlBounds = await page.evaluate(() => {
            const select = document.querySelector('[data-role="wavetable-select-chip"]')?.getBoundingClientRect();
            const tabs = document.querySelector('[data-role="desktop-oscillator-tabs"]')?.getBoundingClientRect();
            const frame = document.querySelector('[data-role="wavetable-frame-chip"]')?.getBoundingClientRect();

            if (!select || !tabs || !frame) {
                throw new Error("Desktop oscillator top controls are missing");
            }

            return {
                selectRight: select.right,
                tabsLeft: tabs.left,
                tabsRight: tabs.right,
                frameLeft: frame.left,
            };
        });
        assert.equal(topControlBounds.selectRight + 4 <= topControlBounds.tabsLeft, true);
        assert.equal(topControlBounds.tabsRight + 4 <= topControlBounds.frameLeft, true);

        await page.locator('select[aria-label="Select wavetable"]').selectOption("1");
        assert.equal(await page.evaluate(() => (
            window.__COSIMO_DESKTOP_OSCILLATOR_HARNESS__?.getConnectedActionCount()
        )), 1);

        for (const [oscillatorID, oscillatorIndex] of [["B", 1], ["C", 2]]) {
            await page.getByRole("tab", { name: `Oscillator ${oscillatorID}` }).click();
            await page.waitForSelector(
                `[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="${oscillatorID}"]`,
            );

            const projection = await readAddressProjection(page);
            assert.deepEqual({
                oscillatorID: projection.oscillatorID,
                oscillatorIndex: projection.oscillatorIndex,
                tableEndpointID: projection.tableEndpointID,
                tableStatusEndpointID: projection.tableStatusEndpointID,
                tableStatusIndex: projection.tableStatusIndex,
                wiring: projection.wiring,
            }, {
                oscillatorID,
                oscillatorIndex,
                tableEndpointID: `osc${oscillatorID}WavetableSelect`,
                tableStatusEndpointID: "runtimeState",
                tableStatusIndex: oscillatorIndex,
                wiring: "indexed-host-pending",
            });
            for (const endpointSuffix of ["Pan", "WarpAmount", "UnisonVoices", "VolumeDb"]) {
                assert.equal(
                    projection.soundEndpointIDs.includes(`osc${oscillatorID}${endpointSuffix}`),
                    true,
                );
            }
            assert.equal(
                projection.soundEndpointIDs.every((endpointID) => endpointID.startsWith(`osc${oscillatorID}`)),
                true,
            );
            assert.equal(
                projection.articulationTargetIDs.every((targetID) => targetID.startsWith(`osc${oscillatorID}.`)),
                true,
            );
            assert.equal(
                projection.modulationTargetIDs.includes(`osc${oscillatorID}.framePosition`),
                true,
            );
            assert.equal(
                projection.articulationTargetIDs.includes(`osc${oscillatorID}.framePosition`),
                true,
            );
            assert.equal(
                projection.modulationTargetIDs.some((targetID) => (
                    targetID.startsWith(`osc${oscillatorID === "B" ? "C" : "B"}.`)
                    || targetID.startsWith("oscA.")
                )),
                false,
            );
            assert.equal(await page.locator('[data-role="wavetable-card"]').count(), 0);
            assert.equal(await page.locator('select[aria-label="Select wavetable"]').count(), 0);
            assert.equal(await page.getByText(`Table ${oscillatorID}`, { exact: true }).count(), 1);
            assert.equal(await page.getByText(`Modulation ${oscillatorID}`, { exact: true }).count(), 1);
            assert.equal(await page.getByText(`Articulation ${oscillatorID}`, { exact: true }).count(), 1);
            assert.equal(await page.evaluate(() => (
                window.__COSIMO_DESKTOP_OSCILLATOR_HARNESS__?.getConnectedActionCount()
            )), 1);
        }

        await page.getByRole("tab", { name: "Oscillator A" }).click();
        await page.locator('select[aria-label="Select wavetable"]').selectOption("1");
        assert.equal(await page.evaluate(() => (
            window.__COSIMO_DESKTOP_OSCILLATOR_HARNESS__?.getConnectedActionCount()
        )), 2);
    } finally {
        await page.close();
    }

    const restartedPage = await openHarness();
    try {
        assert.equal(
            await restartedPage.getByRole("tab", { name: "Oscillator A" }).getAttribute("aria-selected"),
            "true",
        );
    } finally {
        await restartedPage.close();
    }
});
