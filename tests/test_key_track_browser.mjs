import assert from "node:assert/strict";
import test from "node:test";

import {
    expandGlobalModRail,
    getHarnessSnapshot,
    normalizeModulationState,
    openHarnessPage,
    readStoredModulationState,
    selectRackEffect,
    waitForHarnessSnapshot,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

function readLaneDocument(snapshot) {
    const raw = snapshot.storedStateValues?.["lane.v1"]
        ?? snapshot.storedState?.["lane.v1"];
    return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function longPress(page, locator) {
    const box = await locator.boundingBox();
    assert.ok(box, "Key Track control must have a rendered hit area.");
    await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
    await page.mouse.down();
    await page.locator('[data-role="rack-parameter-menu"]').waitFor({
        state: "visible",
        timeout: 10_000,
    });
    await page.mouse.up();
}

async function armMseg1(page) {
    await expandGlobalModRail(page);
    await page.locator('[data-role="rack-mod-source-mseg-1"]').click();
    const quickSheet = page.locator('[data-role="quick-source-sheet"]');
    if ((await quickSheet.count()) > 0) {
        await quickSheet.locator('[data-role="quick-source-sheet-close"]').click();
        await quickSheet.waitFor({ state: "detached" });
        await expandGlobalModRail(page);
    }
}

test("Voice Filter Key Track centers, restores, and re-centers without rewriting Hertz", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 900 }),
    });

    try {
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("filterCutoff", 4_321.25);
            harness.setParameterValue("filterCutoffKeyTrackOffsetSemitones", 8.75);
        });
        const button = page.locator('[data-role="key-track-filterCutoff"]').first();
        await button.waitFor();
        assert.equal((await button.textContent())?.trim(), "Key Track");
        assert.equal(await button.getAttribute("aria-pressed"), "false");

        await button.click();
        await page.waitForFunction(() => {
            const values = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues;
            return Number(values.filterCutoffKeyTrackEnabled) === 1
                && Number(values.filterCutoffKeyTrackOffsetSemitones) === 0;
        });
        let values = (await getHarnessSnapshot(page)).parameterValues;
        assert.equal(values.filterCutoff, 4_321.25);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue(
                "filterCutoffKeyTrackOffsetSemitones", 6.375,
            );
        });
        await button.click();
        await page.waitForFunction(() => (
            Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot()
                .parameterValues.filterCutoffKeyTrackEnabled) === 0
        ));
        values = (await getHarnessSnapshot(page)).parameterValues;
        assert.equal(values.filterCutoff, 4_321.25);
        assert.equal(values.filterCutoffKeyTrackOffsetSemitones, 6.375);

        await button.click();
        await page.waitForFunction(() => (
            Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot()
                .parameterValues.filterCutoffKeyTrackOffsetSemitones) === 0
        ));
        values = (await getHarnessSnapshot(page)).parameterValues;
        assert.equal(values.filterCutoff, 4_321.25);
        assert.equal(values.filterCutoffKeyTrackEnabled, 1);
    } finally {
        await page.close();
    }
});

test("Effects Key Track exact entry speaks continuous offsets for the base and armed route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [{
                id: "key-track-exact-entry",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "lane.distortion#1.distortionWetHPHz",
                amount: 0.25,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(state));
            harness.setLaneParamValue("distortionWetHPHz", 777.25);
        }, seededState);
        await waitForHarnessSnapshot(page, "Key Track route seed", (snapshot) => (
            readStoredModulationState(snapshot).routes[0]?.id === "key-track-exact-entry"
        ));

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await selectRackEffect(page, "drive");
        await armMseg1(page);
        const button = page.locator('[data-role="key-track-distortionWetHPHz"]');
        await button.waitFor();
        assert.equal((await button.textContent())?.trim(), "Key Track");
        await button.click();

        let snapshot = await waitForHarnessSnapshot(page, "Effects Key Track enable", (next) => {
            const params = readLaneDocument(next)?.devices?.["distortion#1"]?.params;
            return Number(params?.distortionWetHPKeyTrackEnabled) === 1
                && Number(params?.distortionWetHPKeyTrackOffsetSemitones) === 0;
        });
        let params = readLaneDocument(snapshot).devices["distortion#1"].params;
        assert.equal(params.distortionWetHPHz, 777.25);

        const knob = page.locator('[data-role="rack-parameter-distortionWetHPHz"]');
        await longPress(page, knob);
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        await sheet.waitFor();
        const labels = await sheet.locator("label > span:first-child").allTextContents();
        assert.deepEqual(labels, ["Key Track Offset", "MSEG 1 -> Key Track Offset"]);

        await sheet.locator('[data-role="rack-base-value-input"]').fill("7.125 st");
        await sheet.locator('[data-role="rack-modulation-value-input"]').fill("37.5 ct");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        snapshot = await waitForHarnessSnapshot(page, "continuous Key Track exact entry", (next) => {
            const nextParams = readLaneDocument(next)?.devices?.["distortion#1"]?.params;
            const route = readStoredModulationState(next).routes
                .find((candidate) => candidate.id === "key-track-exact-entry");
            return Math.abs(Number(nextParams?.distortionWetHPKeyTrackOffsetSemitones) - 7.125) < 1e-9
                && Math.abs(Number(route?.amount) - (0.375 / 12)) < 1e-9;
        });
        params = readLaneDocument(snapshot).devices["distortion#1"].params;
        assert.equal(params.distortionWetHPHz, 777.25);

        await button.click();
        snapshot = await waitForHarnessSnapshot(page, "Effects Key Track restore", (next) => (
            Number(readLaneDocument(next)?.devices?.["distortion#1"]
                ?.params?.distortionWetHPKeyTrackEnabled) === 0
        ));
        params = readLaneDocument(snapshot).devices["distortion#1"].params;
        assert.equal(params.distortionWetHPHz, 777.25);
        assert.equal(params.distortionWetHPKeyTrackOffsetSemitones, 7.125);

        await button.click();
        snapshot = await waitForHarnessSnapshot(page, "Effects Key Track re-center", (next) => (
            Number(readLaneDocument(next)?.devices?.["distortion#1"]
                ?.params?.distortionWetHPKeyTrackOffsetSemitones) === 0
        ));
        params = readLaneDocument(snapshot).devices["distortion#1"].params;
        assert.equal(params.distortionWetHPHz, 777.25);
        assert.equal(params.distortionWetHPKeyTrackEnabled, 1);
    } finally {
        await page.close();
    }
});
