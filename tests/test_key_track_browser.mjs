import assert from "node:assert/strict";
import test from "node:test";

import {
    expandGlobalModRail,
    dragLocatorBy,
    getHarnessSnapshot,
    legacyEightLaneDocJson,
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

const DELAY_SLOT_ID = 6;
const DELAY_FIELD_ENDPOINTS = Object.freeze([
    "delayTime",
    "delayFeedback",
    "delayFilter",
    "delayMix",
    "delayTimeMode",
    "delayDivision",
    "delayTimeKeyTrackEnabled",
    "delayTimeKeyTrackOffsetSemitones",
    "delayFilterKeyTrackEnabled",
    "delayFilterKeyTrackOffsetSemitones",
]);

function readDelayFieldWrites(snapshot) {
    return snapshot.sentMessages.flatMap(({ endpointID, value }) => {
        if (endpointID !== "laneSlotParamValue"
                || Number(value?.slotId) !== DELAY_SLOT_ID) {
            return [];
        }
        return [{
            endpointID: DELAY_FIELD_ENDPOINTS[Number(value?.paramIndex)]
                ?? `unknown:${String(value?.paramIndex)}`,
            value: Number(value?.value),
        }];
    });
}

function applyDelayFieldWrites(runtimeMirror, writes) {
    for (const write of writes) {
        runtimeMirror[write.endpointID] = write.value;
    }
    return runtimeMirror;
}

function applyDelayFieldWritesWithoutExclusiveModeOverlap(runtimeMirror, writes) {
    for (const write of writes) {
        applyDelayFieldWrites(runtimeMirror, [write]);
        assert.equal(
            runtimeMirror.delayTimeMode >= 1
                && runtimeMirror.delayTimeKeyTrackEnabled >= 1,
            false,
            `Delay runtime prefix exposed Sync + Key Track after ${write.endpointID}`,
        );
    }
    return runtimeMirror;
}

const SPLIT_SLOT_ID = 44;
const SPLIT_FIELD_ENDPOINTS = Object.freeze([
    "xoverLowHz",
    "xoverHighHz",
    "xoverLowKeyTrackEnabled",
    "xoverLowKeyTrackOffsetSemitones",
    "xoverHighKeyTrackEnabled",
    "xoverHighKeyTrackOffsetSemitones",
]);

function trackedThreeBandSplitLaneDocJson() {
    const document = JSON.parse(legacyEightLaneDocJson());
    const placements = document.chain;
    assert.equal(placements.length, 8);
    assert.equal(placements.every((node) => node.kind === "device"), true);
    document.chain = [{
        kind: "split",
        groupId: "split#1",
        enabled: true,
        xoverLowHz: 320,
        xoverHighHz: 3_200,
        xoverLowKeyTrackEnabled: false,
        xoverLowKeyTrackOffsetSemitones: 5.5,
        xoverHighKeyTrackEnabled: false,
        xoverHighKeyTrackOffsetSemitones: -7.25,
        branches: [placements.slice(0, 3), placements.slice(3, 5), placements.slice(5)],
    }];
    return JSON.stringify(document);
}

function readSplitFieldWrites(snapshot) {
    return snapshot.sentMessages.flatMap(({ endpointID, value }) => {
        if (endpointID !== "laneSlotParamValue"
                || Number(value?.slotId) !== SPLIT_SLOT_ID) {
            return [];
        }
        return [{
            endpointID: SPLIT_FIELD_ENDPOINTS[Number(value?.paramIndex)]
                ?? `unknown:${String(value?.paramIndex)}`,
            value: Number(value?.value),
        }];
    });
}

function applySplitEnableWritesWithoutStaleOffset(runtimeMirror, writes, which) {
    const enabledEndpointID = `xover${which}KeyTrackEnabled`;
    const offsetEndpointID = `xover${which}KeyTrackOffsetSemitones`;
    for (const write of writes) {
        runtimeMirror[write.endpointID] = write.value;
        assert.equal(
            runtimeMirror[enabledEndpointID] >= 1
                && runtimeMirror[offsetEndpointID] !== 0,
            false,
            `${which} split prefix enabled Key Track with a stale offset after ${write.endpointID}`,
        );
    }
    return runtimeMirror;
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

test("Delay mode edits publish one mutually exclusive document and runtime state", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 900 }),
    });

    try {
        await selectRackEffect(page, "delay");
        const keyTrackButton = page.locator('[data-role="key-track-delayTime"]');
        await keyTrackButton.waitFor();

        await page.locator('[data-role="rack-parameter-delayTimeMode"]').click();
        let snapshot = await waitForHarnessSnapshot(page, "Delay Sync starting state", (next) => {
            const params = readLaneDocument(next)?.devices?.["delay#1"]?.params;
            return Number(params?.delayTimeMode) === 1
                && Number(params?.delayTimeKeyTrackEnabled) === 0
                && Number(next.laneParams?.delayTimeMode) === 1;
        });
        await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
        await keyTrackButton.click();
        snapshot = await waitForHarnessSnapshot(page, "Delay Key Track enable runtime fields", (next) => {
            const params = readLaneDocument(next)?.devices?.["delay#1"]?.params;
            return Number(params?.delayTimeMode) === 0
                && Number(params?.delayTimeKeyTrackEnabled) === 1
                && Number(params?.delayTimeKeyTrackOffsetSemitones) === 0;
        });
        const enableWrites = readDelayFieldWrites(snapshot);
        assert.deepEqual(enableWrites, [
            { endpointID: "delayTimeMode", value: 0 },
            { endpointID: "delayTimeKeyTrackOffsetSemitones", value: 0 },
            { endpointID: "delayTimeKeyTrackEnabled", value: 1 },
        ]);
        const runtimeMirror = {
            delayTimeMode: 1,
            delayTimeKeyTrackEnabled: 0,
            delayTimeKeyTrackOffsetSemitones: 0,
        };
        applyDelayFieldWritesWithoutExclusiveModeOverlap(runtimeMirror, enableWrites);
        assert.deepEqual(runtimeMirror, {
            delayTimeKeyTrackEnabled: 1,
            delayTimeKeyTrackOffsetSemitones: 0,
            delayTimeMode: 0,
        });

        await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
        await page.locator('[data-role="rack-parameter-delayTimeMode"]').click();
        snapshot = await waitForHarnessSnapshot(page, "Delay Sync document transition", (next) => {
            const params = readLaneDocument(next)?.devices?.["delay#1"]?.params;
            return Number(params?.delayTimeMode) === 1
                && Number(params?.delayTimeKeyTrackEnabled) === 0;
        });
        const syncParams = readLaneDocument(snapshot).devices["delay#1"].params;
        assert.equal(syncParams.delayTimeMode, 1);
        assert.equal(syncParams.delayTimeKeyTrackEnabled, 0);
        const syncWrites = readDelayFieldWrites(snapshot);
        assert.deepEqual(syncWrites, [
            { endpointID: "delayTimeKeyTrackEnabled", value: 0 },
            { endpointID: "delayTimeMode", value: 1 },
        ]);
        applyDelayFieldWritesWithoutExclusiveModeOverlap(runtimeMirror, syncWrites);
        assert.equal(snapshot.laneParams.delayTimeMode, 1);
        assert.equal(runtimeMirror.delayTimeMode, 1);
        assert.equal(runtimeMirror.delayTimeKeyTrackEnabled, 0);

        await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
        const feedback = page.locator('[data-role="rack-parameter-delayFeedback"]');
        const feedbackBefore = syncParams.delayFeedback;
        await feedback.press("ArrowRight");
        snapshot = await waitForHarnessSnapshot(page, "ordinary Delay feedback edit", (next) => (
            Number(readLaneDocument(next)?.devices?.["delay#1"]?.params?.delayFeedback)
                > feedbackBefore
        ));
        const feedbackAfter = readLaneDocument(snapshot).devices["delay#1"].params.delayFeedback;
        assert.equal(snapshot.laneParams.delayFeedback, feedbackAfter);
        assert.deepEqual(readDelayFieldWrites(snapshot), [
            { endpointID: "delayFeedback", value: feedbackAfter },
        ]);
    } finally {
        await page.close();
    }
});

test("Frequency Split publishes centered enables safely and MAPPINGS edits its live base", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "tracked-mapping-split-low",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "lane.frequencySplit#1.xoverLowHz",
            amount: 0.5,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        laneDoc: trackedThreeBandSplitLaneDocJson(),
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript((state) => {
                const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    ...initial,
                    storedState: {
                        ...initial.storedState,
                        "modulation.v6": JSON.stringify(state),
                    },
                };
            }, seededState);
        },
    });

    try {
        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await page.locator('[data-role="rack-fork-readout-split#1"]').click();
        await page.locator('[data-role="rack-group-editor-split#1"]').waitFor();

        for (const expected of [{
            which: "Low",
            buttonRole: "key-track-frequencySplit-low-split#1",
            retainedOffset: 5.5,
        }, {
            which: "High",
            buttonRole: "key-track-frequencySplit-high-split#1",
            retainedOffset: -7.25,
        }]) {
            const enabledEndpointID = `xover${expected.which}KeyTrackEnabled`;
            const offsetEndpointID = `xover${expected.which}KeyTrackOffsetSemitones`;
            const button = page.locator(`[data-role="${expected.buttonRole}"]`);
            await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
            await button.click();
            let snapshot = await waitForHarnessSnapshot(page, `${expected.which} split Key Track enable`, (next) => {
                const split = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
                return split?.[enabledEndpointID] === true && Number(split?.[offsetEndpointID]) === 0;
            });
            const enableWrites = readSplitFieldWrites(snapshot);
            assert.deepEqual(enableWrites, [
                { endpointID: offsetEndpointID, value: 0 },
                { endpointID: enabledEndpointID, value: 1 },
            ]);
            assert.deepEqual(
                applySplitEnableWritesWithoutStaleOffset({
                    [enabledEndpointID]: 0,
                    [offsetEndpointID]: expected.retainedOffset,
                }, enableWrites, expected.which),
                { [enabledEndpointID]: 1, [offsetEndpointID]: 0 },
            );

            await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
            await button.click();
            snapshot = await waitForHarnessSnapshot(page, `${expected.which} split Key Track disable`, (next) => {
                const split = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
                return split?.[enabledEndpointID] === false;
            });
            assert.deepEqual(readSplitFieldWrites(snapshot), [
                { endpointID: enabledEndpointID, value: 0 },
            ]);
        }

        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.locator('[data-role="mobile-mod-panel-tab-mappings"]').click();
        const row = page.locator(
            '[data-role="mod-mappings-row"][data-route-id="tracked-mapping-split-low"]',
        );
        await row.waitFor();
        assert.equal(await row.locator('[data-role="mod-mappings-amount-only"]').count(), 0);
        assert.equal((await row.locator('[data-role="mod-mappings-base-val"]').innerText()).trim(), "320 Hz");

        await longPress(page, row.locator(".mobile-voice-cell"));
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        let sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        await sheet.locator('[data-role="rack-base-value-input"]').fill("456 Hz");
        await sheet.locator('[data-role="rack-modulation-value-input"]').fill("2 oct");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        let snapshot = await waitForHarnessSnapshot(page, "ordinary split MAPPINGS edits", (next) => {
            const split = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
            const route = readStoredModulationState(next).routes[0];
            return Number(split?.xoverLowHz) === 456 && Number(route?.amount) === 2;
        });
        let split = readLaneDocument(snapshot).chain.find((node) => node.groupId === "split#1");
        assert.equal(split.xoverLowKeyTrackOffsetSemitones, 0);

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await page.locator('[data-role="rack-fork-readout-split#1"]').click();
        const lowKeyTrack = page.locator('[data-role="key-track-frequencySplit-low-split#1"]');
        await lowKeyTrack.click();
        snapshot = await waitForHarnessSnapshot(page, "tracked split MAPPINGS enable", (next) => {
            const nextSplit = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
            return nextSplit?.xoverLowKeyTrackEnabled === true
                && Number(nextSplit?.xoverLowKeyTrackOffsetSemitones) === 0;
        });
        assert.equal(
            readLaneDocument(snapshot).chain.find((node) => node.groupId === "split#1").xoverLowHz,
            456,
        );

        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.locator('[data-role="mobile-mod-panel-tab-mappings"]').click();
        assert.match(
            (await row.locator(".mod-mappings-row-target").innerText()).trim(),
            /Key Track Offset$/,
        );
        assert.equal((await row.locator('[data-role="mod-mappings-base-val"]').innerText()).trim(), "0 st");
        assert.equal((await row.locator('[data-role="mod-mappings-amount-flag"]').innerText()).trim(), "24 st");

        await longPress(page, row.locator(".mobile-voice-cell"));
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        assert.deepEqual(
            await sheet.locator("label > span:first-child").allTextContents(),
            ["Key Track Offset", "MSEG 1 -> Key Track Offset"],
        );
        await sheet.locator('[data-role="rack-base-value-input"]').fill("7.125 st");
        await sheet.locator('[data-role="rack-modulation-value-input"]').fill("37.5 ct");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        snapshot = await waitForHarnessSnapshot(page, "tracked split MAPPINGS edits", (next) => {
            const nextSplit = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
            const route = readStoredModulationState(next).routes[0];
            return Math.abs(Number(nextSplit?.xoverLowKeyTrackOffsetSemitones) - 7.125) < 1e-9
                && Math.abs(Number(route?.amount) - 0.03125) < 1e-9;
        });
        split = readLaneDocument(snapshot).chain.find((node) => node.groupId === "split#1");
        assert.equal(split.xoverLowHz, 456);

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await page.locator('[data-role="rack-fork-readout-split#1"]').click();
        await lowKeyTrack.click();
        snapshot = await waitForHarnessSnapshot(page, "tracked split ordinary restore", (next) => {
            const nextSplit = readLaneDocument(next)?.chain?.find((node) => node.groupId === "split#1");
            return nextSplit?.xoverLowKeyTrackEnabled === false;
        });
        split = readLaneDocument(snapshot).chain.find((node) => node.groupId === "split#1");
        assert.equal(split.xoverLowHz, 456);
        assert.equal(split.xoverLowKeyTrackOffsetSemitones, 7.125);
    } finally {
        await page.close();
    }
});

test("tracked rack graphs and X/Y editors preserve their hidden ordinary axes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 900 }),
    });

    try {
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setLaneParamValue("globalFilterCutoff", 4_321.25);
            harness.setLaneParamValue("globalFilterResonance", 1.125);
            harness.setLaneParamValue("delayTime", 731.25);
            harness.setLaneParamValue("delayFeedback", 0.21);
            harness.setLaneParamValue("phaserFrequency", 777.25);
            harness.setLaneParamValue("phaserDepth", 0.35);
        });

        await selectRackEffect(page, "filter");
        const filterKeyTrack = page.locator('[data-role="key-track-globalFilterCutoff"]');
        await filterKeyTrack.click();
        await waitForHarnessSnapshot(page, "Global Filter Key Track enable", (next) => (
            Number(readLaneDocument(next)?.devices?.["globalFilter#1"]
                ?.params?.globalFilterCutoffKeyTrackEnabled) === 1
        ));
        const filterHandle = page.locator(
            '[data-role="rack-editor-filter"] [data-role="filter-response-handle-hit-target"]',
        );
        await dragLocatorBy(page, filterHandle, -70, -35);
        let snapshot = await waitForHarnessSnapshot(page, "Global Filter Q graph edit", (next) => (
            Number(readLaneDocument(next)?.devices?.["globalFilter#1"]
                ?.params?.globalFilterResonance) > 1.125
        ));
        let params = readLaneDocument(snapshot).devices["globalFilter#1"].params;
        assert.equal(params.globalFilterCutoff, 4_321.25);
        assert.equal(params.globalFilterCutoffKeyTrackOffsetSemitones, 0);
        assert.ok(params.globalFilterResonance > 1.125);
        await filterKeyTrack.click();
        snapshot = await waitForHarnessSnapshot(page, "Global Filter ordinary restore", (next) => (
            Number(readLaneDocument(next)?.devices?.["globalFilter#1"]
                ?.params?.globalFilterCutoffKeyTrackEnabled) === 0
        ));
        assert.equal(readLaneDocument(snapshot).devices["globalFilter#1"].params.globalFilterCutoff, 4_321.25);

        for (const expected of [{
            effectId: "delay",
            ordinaryEndpointID: "delayTime",
            ordinaryValue: 731.25,
            yEndpointID: "delayFeedback",
            yValue: 0.21,
            enabledEndpointID: "delayTimeKeyTrackEnabled",
            offsetEndpointID: "delayTimeKeyTrackOffsetSemitones",
        }, {
            effectId: "phaser",
            ordinaryEndpointID: "phaserFrequency",
            ordinaryValue: 777.25,
            yEndpointID: "phaserDepth",
            yValue: 0.35,
            enabledEndpointID: "phaserFrequencyKeyTrackEnabled",
            offsetEndpointID: "phaserFrequencyKeyTrackOffsetSemitones",
        }]) {
            await selectRackEffect(page, expected.effectId);
            const keyTrack = page.locator(`[data-role="key-track-${expected.ordinaryEndpointID}"]`);
            await keyTrack.click();
            await waitForHarnessSnapshot(page, `${expected.effectId} Key Track enable`, (next) => (
                Number(readLaneDocument(next)?.devices?.[`${expected.effectId}#1`]
                    ?.params?.[expected.enabledEndpointID]) === 1
            ));
            const xy = page.locator(
                `[data-role="rack-editor-${expected.effectId}"] [data-role="rack-xy-visual"]`,
            );
            await xy.press("ArrowRight");
            await page.waitForTimeout(100);
            snapshot = await getHarnessSnapshot(page);
            params = readLaneDocument(snapshot).devices[`${expected.effectId}#1`].params;
            assert.equal(params[expected.ordinaryEndpointID], expected.ordinaryValue);
            assert.equal(params[expected.offsetEndpointID], 0);

            await xy.press("ArrowUp");
            snapshot = await waitForHarnessSnapshot(page, `${expected.effectId} Y-axis edit`, (next) => (
                Number(readLaneDocument(next)?.devices?.[`${expected.effectId}#1`]
                    ?.params?.[expected.yEndpointID]) > expected.yValue
            ));
            params = readLaneDocument(snapshot).devices[`${expected.effectId}#1`].params;
            assert.equal(params[expected.ordinaryEndpointID], expected.ordinaryValue);
            assert.ok(params[expected.yEndpointID] > expected.yValue);

            await keyTrack.click();
            snapshot = await waitForHarnessSnapshot(page, `${expected.effectId} ordinary restore`, (next) => (
                Number(readLaneDocument(next)?.devices?.[`${expected.effectId}#1`]
                    ?.params?.[expected.enabledEndpointID]) === 0
            ));
            assert.equal(
                readLaneDocument(snapshot).devices[`${expected.effectId}#1`]
                    .params[expected.ordinaryEndpointID],
                expected.ordinaryValue,
            );
        }
    } finally {
        await page.close();
    }
});

test("MAPPINGS edits tracked bases and routes in continuous offset units", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.clear();
                sessionStorage.clear();
            });
        },
    });

    try {
        const seededState = normalizeModulationState({
            routes: [{
                id: "tracked-mapping-delay-time",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "lane.delay#1.delayTime",
                amount: 0.5,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(state));
            harness.setLaneParamValue("delayTime", 731.25);
        }, seededState);
        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await selectRackEffect(page, "delay");
        const keyTrack = page.locator('[data-role="key-track-delayTime"]');
        await keyTrack.click();
        await waitForHarnessSnapshot(page, "tracked Delay mapping enable", (next) => (
            Number(readLaneDocument(next)?.devices?.["delay#1"]
                ?.params?.delayTimeKeyTrackEnabled) === 1
        ));

        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.locator('[data-role="mobile-mod-panel-tab-mappings"]').click();
        const row = page.locator(
            '[data-role="mod-mappings-row"][data-route-id="tracked-mapping-delay-time"]',
        );
        await row.waitFor();
        assert.match(
            (await row.locator(".mod-mappings-row-target").innerText()).trim(),
            /Key Track Offset$/,
        );
        assert.equal((await row.locator('[data-role="mod-mappings-base-val"]').innerText()).trim(), "0 st");
        assert.equal((await row.locator('[data-role="mod-mappings-amount-flag"]').innerText()).trim(), "6 st");

        await longPress(page, row.locator(".mobile-voice-cell"));
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        const labels = await sheet.locator("label > span:first-child").allTextContents();
        assert.deepEqual(labels, ["Key Track Offset", "MSEG 1 -> Key Track Offset"]);
        await sheet.locator('[data-role="rack-base-value-input"]').fill("7.125 st");
        await sheet.locator('[data-role="rack-modulation-value-input"]').fill("37.5 ct");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();

        let snapshot = await waitForHarnessSnapshot(page, "tracked MAPPINGS exact entry", (next) => {
            const nextParams = readLaneDocument(next)?.devices?.["delay#1"]?.params;
            const route = readStoredModulationState(next).routes[0];
            return Math.abs(Number(nextParams?.delayTimeKeyTrackOffsetSemitones) - 7.125) < 1e-9
                && Math.abs(Number(route?.amount) - 0.03125) < 1e-9;
        });
        assert.equal(readLaneDocument(snapshot).devices["delay#1"].params.delayTime, 731.25);

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await selectRackEffect(page, "delay");
        await keyTrack.click();
        snapshot = await waitForHarnessSnapshot(page, "tracked MAPPINGS ordinary restore", (next) => (
            Number(readLaneDocument(next)?.devices?.["delay#1"]
                ?.params?.delayTimeKeyTrackEnabled) === 0
        ));
        assert.equal(readLaneDocument(snapshot).devices["delay#1"].params.delayTime, 731.25);
    } finally {
        await page.close();
    }
});

test("Voice Filter Key Track retains Q travel and presents Cutoff travel in semitones", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    parameterValues: { filterCutoff: 4_321.25 },
                    storedState: { "modulation.v6": JSON.stringify(state) },
                };
            }, {
                state: normalizeModulationState({
                    routes: [{
                        id: "tracked-filter-cutoff-travel",
                        enabled: true,
                        sourceKind: "mseg",
                        sourceSlot: 1,
                        polarity: "unipolar",
                        targetKind: "filterCutoffOctaves",
                        amount: 0.375,
                        reducer: "max",
                    }, {
                        id: "tracked-filter-q-travel",
                        enabled: true,
                        sourceKind: "mseg",
                        sourceSlot: 1,
                        polarity: "unipolar",
                        targetKind: "filterQ",
                        amount: 2,
                        reducer: "max",
                    }],
                }),
            });
        },
    });

    try {
        await page.locator('[data-role="filter-mode-chip"]').click();
        await page.locator('[data-role="filter-travel-overlay"]').waitFor();
        const keyTrack = page.locator('[data-role="key-track-filterCutoff"]').first();
        await keyTrack.click();
        const overlay = page.locator('[data-role="filter-travel-overlay"]');
        await overlay.waitFor();
        assert.equal(await overlay.getAttribute("data-cutoff-route-storage"), "0.375");
        assert.equal(
            (await page.locator('[data-role="filter-travel-cutoff-amount-label"]').textContent())?.trim(),
            "4.5 st",
        );
        const baseY = Number(await page.locator('[data-role="filter-response-handle"]').getAttribute("cy"));
        const endHandle = page.locator('[data-role="filter-travel-hit-target-end"]');
        const endY = Number(await page.locator('[data-role="filter-travel-handle-end"]').getAttribute("cy"));
        assert.notEqual(endY, baseY, "The armed Q route must retain visible travel.");

        await endHandle.press("ArrowUp");
        const snapshot = await waitForHarnessSnapshot(page, "tracked filter Q travel edit", (next) => (
            Number(readStoredModulationState(next).routes
                .find((route) => route.id === "tracked-filter-q-travel")?.amount) > 2
        ));
        assert.equal(snapshot.parameterValues.filterCutoff, 4_321.25);
        assert.equal(
            readStoredModulationState(snapshot).routes
                .find((route) => route.id === "tracked-filter-cutoff-travel")?.amount,
            0.375,
        );
    } finally {
        await page.close();
    }
});

test("Voice Filter center-and-enable is one undoable parameter transaction", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    parameterValues: {
                        filterCutoffKeyTrackEnabled: 0,
                        filterCutoffKeyTrackOffsetSemitones: 9.25,
                    },
                };
            });
        },
    });

    try {
        const button = page.locator('[data-role="key-track-filterCutoff"]').first();
        await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog());
        await button.click();
        let snapshot = await waitForHarnessSnapshot(page, "atomic Voice Filter Key Track enable", (next) => (
            Number(next.parameterValues.filterCutoffKeyTrackEnabled) === 1
            && Number(next.parameterValues.filterCutoffKeyTrackOffsetSemitones) === 0
            && next.parameterTransactions.length === 1
        ));
        assert.deepEqual(snapshot.gestureStarts, ["filterCutoffKeyTrackEnabled"]);
        assert.deepEqual(snapshot.gestureEnds, ["filterCutoffKeyTrackEnabled"]);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID.startsWith("filterCutoffKeyTrack"))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [{ endpointID: "filterCutoffKeyTrackOffsetSemitones", value: 0 },
                { endpointID: "filterCutoffKeyTrackEnabled", value: 1 }],
        );
        assert.deepEqual(snapshot.parameterTransactions[0], {
            ownerEndpointIDs: ["filterCutoffKeyTrackEnabled"],
            changes: [{
                endpointID: "filterCutoffKeyTrackOffsetSemitones",
                before: 9.25,
                after: 0,
            }, {
                endpointID: "filterCutoffKeyTrackEnabled",
                before: 0,
                after: 1,
            }],
        });

        assert.equal(
            await page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.undoLastParameterTransaction()),
            true,
        );
        snapshot = await waitForHarnessSnapshot(page, "atomic Voice Filter Key Track undo", (next) => (
            Number(next.parameterValues.filterCutoffKeyTrackEnabled) === 0
            && Number(next.parameterValues.filterCutoffKeyTrackOffsetSemitones) === 9.25
        ));
        assert.equal(snapshot.parameterValues.filterCutoffKeyTrackEnabled, 0);
        assert.equal(snapshot.parameterValues.filterCutoffKeyTrackOffsetSemitones, 9.25);
    } finally {
        await page.close();
    }
});
