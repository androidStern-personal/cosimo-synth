import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { formatModulationAmountReadout } from "../patch_gui/modulation.js";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

import {
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
    ARTICULATIONS_V4_STATE_KEY,
    parseArticulationsV4,
    deserializeMsegShape,
    renderMsegShape,
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    deserializeModulationState,
    normalizeModulationState,
    getModulationArticulationCellIndex,
    getModulationRuntimeCell,
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
    TEST_SAMPLES_PER_FRAME,
    MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
    EFFECT_PRESETS_V2_STATE_KEY,
    SYNTH_PRESET_EFFECT_ID,
    ARTICULATION_STATE_KEY,
    RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY,
    expectedMsegPreviewProgressClipWidth,
    buildShortMidi,
    readStoredModulationState,
    readStoredArticulationEditorState,
    editorBankToStoredArticulations,
    readEffectPresetState,
    containsRetiredSynthPresetBaselineKey,
    readStoredMsegShape,
    readStoredMsegPlayback,
    readStoredRouteAmount,
    routeSummary,
    routeSummaries,
    ensureFirstModulationRoute,
    RUNTIME_PATH_FIELDS,
    RUNTIME_PATH_KINDS,
    latestRuntimeProgram,
    readRuntimeProgramRoute,
    hasRuntimeAmount,
    compactRuntimeMessages,
    buildDistortionScopeFixture,
    buildDistortionHistoryFixture,
    dispatchInputValueChange,
    selectRackEffect,
    toggleRackEffectEnabled,
    expandGlobalModRail,
    collapseGlobalModRail,
    createRackMappingByDrop,
    touchPointForModSourcePreviewTarget,
    editRackParameterValue,
    dispatchRackKnobPointerEvents,
    clickFilterGraphAt,
    dragFilterHandleBy,
    dragEnvelopeHandleBy,
    dragLocatorBy,
    choosePrototypeSelectOption,
    waitForHarnessSnapshot,
    waitForPageValue,
    waitForReactFrames,
    readVisibleHarnessParameterEndpointIDs,
    clickPresetBarAction,
    saveSynthPresetAs,
    waitForPresetBarDirtyState,
    legacyEightLaneDocJson,
    dragArticulationCardToLane,
    previewArticulationCardDragOver,
    readDesktopRangeSegments,
    readDesktopRangeViewport,
    openHarnessPage,
    showVoiceControls,
    openBuiltDesktopBundlePage,
    openDesktopEntryPageWithInjectedResourceClient,
    assertLatestMsegBufferMatchesStoredShape,
    beginRackReorderWithoutPointerCapture,
    endRackReorderWithoutPointerCapture,
    rectsIntersect,
    rectContains,
    readGlobalModRailGeometry,
    isLaneParamSend,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

/**
 * Routing tests need the source armed with the expanded rail still available.
 * T43 makes the product tap open its quick sheet and collapse the drawer, so
 * these tests explicitly dismiss that sheet and restore their routing setup.
 */
async function armRackModSourceForRouting(page, selector) {
    await page.click(selector);
    const quickSheet = page.locator('[data-role="quick-source-sheet"]');
    if ((await quickSheet.count()) > 0) {
        await quickSheet.locator('[data-role="quick-source-sheet-close"]').click();
        await quickSheet.waitFor({ state: "detached" });
        await expandGlobalModRail(page);
    }
}

test("Add route appends unique inert mappings and scrolls the new row into view", async () => {
    const page = await openHarnessPage();

    try {
        await page.setViewportSize({ width: 1280, height: 600 });
        const initialRoutes = readStoredModulationState(await getHarnessSnapshot(page)).routes;

        for (let routeIndex = initialRoutes.length; routeIndex < 8; routeIndex += 1) {
            await page.getByRole("button", { name: "Add route" }).click();
            await page.waitForFunction((expectedRouteIndex) => (
                document.querySelector(`[data-role="route-row-${expectedRouteIndex}"]`) instanceof HTMLElement
            ), routeIndex + 1);
        }

        await page.waitForFunction(() => {
            const routeRow = document.querySelector('[data-role="route-row-8"]');

            if (!(routeRow instanceof HTMLElement)) {
                return false;
            }

            const rect = routeRow.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            routeSummaries(readStoredModulationState(snapshot).routes),
            [
                ...routeSummaries(initialRoutes),
                ...[
                    "oscA.wavetablePosition",
                    "oscA.warpAmount",
                    "oscA.pitchSemitones",
                    "oscA.ampGainDb",
                    "oscA.pan",
                    "oscA.unisonDetune",
                    "oscA.unisonBlend",
                    "oscA.unisonWidth",
                ]
                    .slice(0, 8 - initialRoutes.length)
                    .map((targetKind) => ({
                        enabled: true,
                        sourceKind: "mseg",
                        sourceSlot: 1,
                        polarity: "unipolar",
                        targetKind,
                        amount: 0,
                    })),
            ],
        );
        const finalProgram = latestRuntimeProgram(snapshot);
        assert.equal(finalProgram?.voiceRouteCount, 8);
        assert.deepEqual(finalProgram?.voiceRouteCells.slice(0, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
    } finally {
        await page.close();
    }
});

test("mod matrix keeps the list shell when empty and restores the seeded route when re-adding", async () => {
    const page = await openHarnessPage();

    try {
        const initialRouteCount = readStoredModulationState(await getHarnessSnapshot(page)).routes.length;

        for (let remainingRouteCount = initialRouteCount; remainingRouteCount > 0; remainingRouteCount -= 1) {
            await page.getByRole("button", { name: "Remove route 1" }).click();
            await waitForHarnessSnapshot(
                page,
                `route removal leaves ${remainingRouteCount - 1} rows`,
                (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === remainingRouteCount - 1,
            );
        }

        let snapshot = await waitForHarnessSnapshot(
            page,
            "route list empty after removing the seeded row",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === 0,
        );

        assert.equal(await page.getByRole("button", { name: "Add route" }).count(), 1);
        assert.equal(await page.locator('[data-role^="route-row-"]').count(), 0);
        assert.equal(await page.getByText(/add a modulation slot/i).count(), 0);
        assert.deepEqual(readStoredModulationState(snapshot).routes, []);

        await page.getByRole("button", { name: "Add route" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "seeded route returns after add",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route !== undefined
                    && route.enabled === true
                    && route.sourceKind === "mseg"
                    && route.sourceSlot === 1
                    && route.polarity === "unipolar"
                    && route.targetKind === "oscA.wavetablePosition"
                    && Math.abs(Number(route.amount)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0,
        });
    } finally {
        await page.close();
    }
});

test("mod matrix source and target selects keep enough width for their menu content and bypass uses the flattened source model", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await page.getByRole("button", { name: "Route 1 source" }).click();

        let sourceSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 source"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 source "]'));
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
                optionFontFamilies: optionButtons.map((button) => getComputedStyle(button).fontFamily),
            };
        });

        assert.ok(sourceSizing.triggerWidth >= sourceSizing.widestOptionWidth);
        assert.equal(sourceSizing.optionFontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        await page.getByRole("button", { name: "Route 1 source ENV 3" }).click();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "flattened source selection updates to ENV 3",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.sourceKind === "env" && route?.sourceSlot === 3;
            },
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 target" }).click();

        const targetSizing = await page.evaluate(() => {
            const trigger = document.querySelector('button[aria-label="Route 1 target"]');
            const optionButtons = Array.from(document.querySelectorAll('button[aria-label^="Route 1 target "]'));
            const menu = optionButtons[0]?.parentElement;
            return {
                triggerWidth: trigger instanceof HTMLElement ? trigger.getBoundingClientRect().width : 0,
                menuWidth: menu instanceof HTMLElement ? menu.getBoundingClientRect().width : 0,
                widestOptionWidth: optionButtons.reduce((widest, button) => (
                    button instanceof HTMLElement ? Math.max(widest, button.scrollWidth) : widest
                ), 0),
            };
        });

        assert.ok(targetSizing.triggerWidth <= 180);
        assert.ok(targetSizing.menuWidth >= targetSizing.widestOptionWidth);
        assert.ok(await page.locator('[aria-label="Route 1 amount"]:visible').boundingBox());
        await page.getByRole("button", { name: "Route 1 target A TUNE" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "target selection updates to pitch",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.targetKind === "oscA.pitchSemitones",
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 0,
        });

        await page.getByRole("button", { name: "Route 1 bypass" }).click();

        snapshot = await waitForHarnessSnapshot(
            page,
            "route bypass disables the first route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.enabled === false,
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: false,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 0,
        });
        assert.equal(readRuntimeProgramRoute(snapshot, readStoredModulationState(snapshot).routes[0]), null);
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob double-click entry uses the displayed units", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");

        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        await amountKnob.dblclick();

        const amountInput = page.locator('input[aria-label="Route 1 amount value"]:visible');
        await amountInput.waitFor({ state: "visible" });
        assert.equal(
            await amountKnob.locator('[data-role="parameter-entry-unit"]').innerText(),
            "%",
        );
        await amountInput.fill("2 st");
        await amountInput.press("Enter");
        await amountKnob.locator('[data-role="parameter-entry-error"]').waitFor({ state: "visible" });
        assert.equal(await amountInput.isVisible(), true, "a rejected amount must keep the editor open");
        assert.match(
            await amountKnob.locator('[data-role="parameter-entry-error"]').innerText(),
            /st is not compatible/i,
        );
        assert.equal(readStoredModulationState(await getHarnessSnapshot(page)).routes[0]?.amount, 0);
        await amountInput.fill("12");
        await amountInput.blur();

        let snapshot = await waitForHarnessSnapshot(
            page,
            "typed route amount commit in displayed percent units",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route.amount) - 0.12) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.warpAmount",
            amount: 0.12,
        });
        const warpAmountReadout = page.locator('[data-role="route-row-1"] >> text=/\\+?12%/');
        await warpAmountReadout.waitFor({ state: "visible" });
        assert.equal((await warpAmountReadout.count()) >= 1, true);
        assert.equal(
            hasRuntimeAmount(snapshot, readStoredModulationState(snapshot).routes[0], 0.12),
            true,
        );

        await choosePrototypeSelectOption(page, "Route 1 target", "A PAN");
        await amountKnob.dblclick();
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("-40");
        await amountInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed signed pan amount commit",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.pan"
                    && Math.abs(Number(route.amount) - (-0.4)) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.pan",
            amount: -0.4,
        });
        const panAmountReadout = page.locator('[data-role="route-row-1"] >> text=/40% L/');
        await panAmountReadout.waitFor({ state: "visible" });
        assert.equal((await panAmountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("mod matrix amount entry preserves the focused draft across a host echo", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        await page.locator('[aria-label="Route 1 amount"]:visible').dblclick();

        const amountInput = page.locator('input[aria-label="Route 1 amount value"]:visible');
        await amountInput.waitFor({ state: "visible" });
        await amountInput.fill("12");
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            modulationState.routes[0].amount = 0.77;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
        });
        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            return Math.abs(Number(modulationState.routes[0]?.amount) - 0.77) <= 1e-9;
        });

        assert.equal(await amountInput.inputValue(), "12");
        await amountInput.press("Enter");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "focused route amount draft committed after host echo",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route.amount) - 0.12) <= 1e-9;
            },
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 0.12);
        assert.equal(await amountInput.count(), 0, "Enter must close the exact-value editor instead of reopening it through the slider.");
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob tracks a Safari-style touch drag", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        const bounds = await amountKnob.boundingBox();
        assert.ok(bounds);
        await clearHarnessDebugLog(page);

        const pointer = {
            pointerId: 93,
            pointerType: "touch",
            button: 0,
            clientX: bounds.x + (bounds.width / 2),
        };
        await amountKnob.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientY: bounds.y + (bounds.height / 2),
        });
        await amountKnob.dispatchEvent("pointermove", {
            ...pointer,
            buttons: 0,
            clientY: bounds.y + bounds.height + 24,
        });
        await amountKnob.dispatchEvent("pointerup", {
            ...pointer,
            buttons: 0,
            clientY: bounds.y + bounds.height + 24,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "touch-adjusted modulation amount",
            (nextSnapshot) => Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) < 0.95,
        );
        const route = readStoredModulationState(snapshot).routes[0];
        assert.equal(hasRuntimeAmount(snapshot, route, route.amount), true);
    } finally {
        await page.close();
    }
});

test("mod matrix amount knob supports standard slider keyboard controls", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        await amountKnob.focus();
        await amountKnob.press("Home");

        let snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard minimum",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - (-1)) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, -1);

        await amountKnob.press("End");
        snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard maximum",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - 1) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 1);

        await amountKnob.press("ArrowDown");
        snapshot = await waitForHarnessSnapshot(
            page,
            "route amount keyboard decrement",
            (nextSnapshot) => Math.abs(Number(readStoredModulationState(nextSnapshot).routes[0]?.amount) - 0.999) <= 1e-9,
        );
        assert.equal(readStoredModulationState(snapshot).routes[0].amount, 0.999);
    } finally {
        await page.close();
    }
});

test("mod matrix amount rendering stays current across idle flushes and structural edits", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        const amountKnob = page.locator('[aria-label="Route 1 amount"]:visible');
        const polarityToggle = page.locator('[aria-label="Route 1 polarity"]:visible');
        await amountKnob.focus();

        await amountKnob.press("Home");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), -1);
        await amountKnob.press("End");
        await page.waitForTimeout(60);
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 1);

        await amountKnob.press("ArrowDown");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.999);
        await page.waitForTimeout(70);
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.999);

        await amountKnob.press("ArrowDown");
        await polarityToggle.click();
        await page.waitForTimeout(70);

        const snapshot = await getHarnessSnapshot(page);
        const route = readStoredModulationState(snapshot).routes[0];
        assert.equal(route.polarity, "bipolar");
        assert.equal(route.amount, 0.998);
        assert.equal(await polarityToggle.getAttribute("aria-pressed"), "true");
        assert.equal(Number(await amountKnob.getAttribute("aria-valuenow")), 0.998);
    } finally {
        await page.close();
    }
});

test("desktop distortion controls send exact parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        await page.waitForSelector('[data-role="rack-editor-drive"]');
        await clearHarnessDebugLog(page);

        await page.click('[data-role="distortion-mode-option-1"]');
        await page.click('[data-role="rack-parameter-distortionType"]');
        await editRackParameterValue(page, "distortion-drive-field", "18.5");
        await editRackParameterValue(page, "distortion-mix-field", "64");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "distortion parameter updates",
            (nextSnapshot) => nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionMode", 1))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionType", 2))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionDriveDb", 18.5))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionWet", 0.64)),
        );

        assert.equal(snapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionMode")), true);
        assert.equal(snapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionType", 2)), true);
        assert.equal(snapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionDriveDb")), true);
        assert.equal(snapshot.sentMessages.some((message) => isLaneParamSend(message, "distortionWet")), true);
    } finally {
        await page.close();
    }
});

test("desktop effects rack renders the complete ordered eight-module surface", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');

        const layout = await page.evaluate(() => {
            const rack = document.querySelector('[data-role="effects-rack-card"]');
            const modules = Array.from(document.querySelectorAll("[data-rack-position]"));

            if (!(rack instanceof HTMLElement)) {
                return null;
            }

            const rackRect = rack.getBoundingClientRect();

            return {
                moduleCount: modules.length,
                effectIds: modules.map((module) => module.getAttribute("data-role")?.replace("rack-module-", "")),
                positions: modules.map((module) => Number(module.getAttribute("data-rack-position"))),
                rackWidth: rackRect.width,
                rackHeight: rackRect.height,
            };
        });

        assert.ok(layout, "Expected effects rack to render.");
        assert.equal(layout.moduleCount, 8);
        assert.deepEqual(layout.effectIds, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
        assert.deepEqual(layout.positions, [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.ok(layout.rackWidth > 0 && layout.rackHeight > 0);

        // Since the parameter cut, effect parameters have no host endpoints:
        // no surface may hold a parameter listener on them, whatever is open.
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb ?? 0, 0);
        await page.locator('[data-role="distortion-drive-field"]').click({ button: "right" });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view") !== null
        ));
        await page.keyboard.press("Escape");
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb ?? 0, 0);
    } finally {
        await page.close();
    }
});

test("a rack-source tap opens the quick sheet over FX; the full editor round-trips the context", async () => {
    // T43 opens the quick-editor sheet in place on the selection tap. The FX
    // context must stay live beneath, and Full editor routes to the real one.
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        assert.equal(await page.locator('[data-role="rack-editor-drive"]').count(), 1);
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.click();

        const sheet = page.locator('[data-role="quick-source-sheet"]');
        await sheet.waitFor();
        assert.equal(await sheet.getAttribute("data-source-kind"), "mseg");
        assert.equal(await sheet.getAttribute("data-source-slot"), "1");
        assert.equal(
            await page.locator('[data-role="mobile-workspace-tab-fx"]').getAttribute("aria-selected"),
            "true",
            "The sheet floats over FX — the source tap is not a navigation.",
        );
        assert.equal(
            await page.locator('[data-role="mobile-workspace-tab-mod"]').getAttribute("aria-selected"),
            "false",
        );
        assert.equal(await page.locator('[data-role="rack-editor-drive"]').count(), 1);

        // The Full editor button is the route into the REAL editor for the
        // source kind — the full-screen MSEG editor here — and universal Back
        // lands on the untouched FX context with the source still armed.
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        assert.equal(await sheet.count(), 0, "The full editor replaces the sheet.");
        await page.click('[data-action="shell-back"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });
        assert.equal(
            await page.locator('[data-role="mobile-workspace-tab-fx"]').getAttribute("aria-selected"),
            "true",
        );
        assert.equal(await page.locator('[data-role="rack-editor-drive"]').count(), 1);
        assert.equal(await source.getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("the quick sheet's Full editor opens the exact Envelope and Macro slots without introducing LFOs", async () => {
    // T43: one source tap opens the exact quick sheet; its Full editor button
    // deep-links to the detail editor. Exact-slot and no-LFO stay unchanged.
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);

        const envelope = page.locator('[data-role="rack-mod-source-env-1"]');
        await envelope.click();
        const sheet = page.locator('[data-role="quick-source-sheet"]');
        await sheet.waitFor();
        assert.equal(await sheet.getAttribute("data-source-kind"), "env");
        assert.equal(await sheet.getAttribute("data-source-slot"), "1");
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        // The editor role is a hidden state-marker span; wait on attachment.
        let editor = page.locator('[data-role="mod-source-editor"]');
        await editor.waitFor({ state: "attached" });
        assert.equal(await editor.getAttribute("data-source-kind"), "env");
        assert.equal(await editor.getAttribute("data-source-slot"), "1");

        await page.click('[data-action="shell-back"]');
        await expandGlobalModRail(page);
        await page.click('[aria-label="Next modulation-source group"]');
        await page.waitForTimeout(300);
        const macro = page.locator('[data-role="rack-mod-source-macro-2"]');
        await macro.click();
        await sheet.waitFor();
        assert.equal(await sheet.getAttribute("data-source-kind"), "macro");
        assert.equal(await sheet.getAttribute("data-source-slot"), "2");
        await page.click('[data-role="quick-source-sheet-full-editor"]');

        editor = page.locator('[data-role="mod-source-editor"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "macro"
        ));
        assert.equal(await editor.getAttribute("data-source-kind"), "macro");
        assert.equal(await editor.getAttribute("data-source-slot"), "2");
        assert.equal(await page.locator('[data-role="macro-source-value-2"]').count(), 1);
        assert.equal(/\blfo\b/i.test(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText()), false);
    } finally {
        await page.close();
    }
});

test("Amp Envelope keeps its exact quick-sheet identity and 5 ms desktop Release floor", async () => {
    const routeId = "amp-envelope-quick-sheet-route";
    const seededState = normalizeModulationState({
        routes: [
            {
                id: routeId,
                enabled: true,
                sourceKind: "env",
                sourceSlot: 4,
                polarity: "unipolar",
                targetKind: "ampAttack",
                amount: 0.25,
                reducer: "max",
            },
            {
                id: "amp-envelope-rack-hud-route",
                enabled: true,
                sourceKind: "env",
                sourceSlot: 4,
                polarity: "unipolar",
                targetKind: "lane.reverb#1.reverbSize",
                amount: 0.2,
                reducer: "max",
            },
        ],
    });
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const sheet = page.locator('[data-role="quick-source-sheet"]');
    const menu = page.locator('[data-role="rack-parameter-menu"]');
    const longPress = async (locator) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
        await page.mouse.down();
        await menu.waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
    };
    const writesValue = (snapshot, endpointID, expected) => snapshot.sentMessages.some(({ endpointID: sentEndpointID, value }) => (
        sentEndpointID === endpointID && Math.abs(Number(value) - expected) <= 1e-9
    ));

    try {
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded Amp Envelope quick-sheet route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => route.id === routeId),
        );

        // Arm the permanent Amp Envelope from the real Mod source selector,
        // return to FX, then open its Voice/FX quick sheet from the collapsed
        // source rail. This is the product path that previously fabricated
        // an ordinary fourth envelope.
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.locator('[data-role="mobile-mod-source-type"]').selectOption("envelope");
        await page.locator('[data-role="mobile-mod-source-number"]').selectOption("4");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail-selected"]')
                ?.getAttribute("aria-label") === "Amp Envelope selected"
        ));
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await collapseGlobalModRail(page);

        // The rack knob owns the other parameter-HUD path. It must use the
        // same unnumbered Amp identity for an ordinary Amp-source mapping.
        await selectRackEffect(page, "reverb");
        const rackKnob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"]')?.getAttribute("data-route-state") === "mapped"
        ), undefined, { timeout: 5000 });
        await clearHarnessDebugLog(page);
        const rackArtBox = await rackKnob.locator(".rack-knob-art").boundingBox();
        assert.ok(rackArtBox);
        const rackCenterX = rackArtBox.x + (rackArtBox.width / 2);
        const rackCenterY = rackArtBox.y + (rackArtBox.height / 2);
        await page.mouse.move(rackCenterX, rackCenterY);
        await page.mouse.down();
        await page.mouse.move(rackCenterX, rackCenterY - 38, { steps: 8 });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ), undefined, { timeout: 5000 });
        let sourceLine = await page.locator('[data-role="mobile-voice-hud"] .mobile-voice-hud-source').innerText();
        assert.match(sourceLine, /^AMP\b/);
        assert.doesNotMatch(sourceLine, /AMP\s*4|Envelope\s*4/i);
        await page.mouse.up();

        await page.click('[data-role="mobile-global-mod-rail-selected"]');
        await sheet.waitFor();

        assert.equal(await sheet.getAttribute("data-source-kind"), "env");
        assert.equal(await sheet.getAttribute("data-source-slot"), "4");
        assert.equal(await sheet.getAttribute("aria-label"), "Amp Envelope quick editor");
        assert.doesNotMatch(await sheet.innerText(), /Envelope\s*4|AMP\s*4/i);

        const stageCells = [
            ["attack", "ampAttack", "Amp Envelope attack", "0.001"],
            ["decay", "ampDecay", "Amp Envelope decay", "0.001"],
            ["sustain", "ampSustain", "Amp Envelope sustain", "0"],
            ["release", "ampRelease", "Amp Envelope release", "0.005"],
        ];
        for (const [stage, targetKind, label, minimum] of stageCells) {
            const cell = sheet.locator(`[data-role="quick-source-sheet-cell-${stage}"]`);
            assert.equal(await cell.getAttribute("data-modulation-target-kind"), targetKind);
            assert.equal(await cell.getAttribute("aria-label"), label);
            assert.equal(await cell.getAttribute("aria-valuemin"), minimum);
        }

        // Long-press context belongs to the actual endpoint and finds the
        // ordinary user route from Amp Envelope independently of its fixed
        // amplitude job.
        const attackCell = sheet.locator('[data-role="quick-source-sheet-cell-attack"]');
        await longPress(attackCell);
        assert.equal(await menu.getAttribute("data-endpoint-id"), "ampAttack");
        assert.equal(
            await menu.locator('[data-action="toggle-route"]').count(),
            1,
            "The Amp route must be found through env slot 4 + ampAttack context.",
        );
        await page.locator('[data-role="rack-parameter-menu-layer"]').click({ position: { x: 4, y: 4 } });
        await menu.waitFor({ state: "detached" });

        // Every quick cell writes the real append-only host endpoint. Home is
        // also the accessibility proof that Amp Release floors at 5 ms.
        await clearHarnessDebugLog(page);
        await attackCell.press("Home");
        await sheet.locator('[data-role="quick-source-sheet-cell-decay"]').press("End");
        await sheet.locator('[data-role="quick-source-sheet-cell-sustain"]').press("Home");
        await sheet.locator('[data-role="quick-source-sheet-cell-release"]').press("Home");
        let snapshot = await waitForHarnessSnapshot(page, "Amp Envelope quick-sheet host writes", (nextSnapshot) => (
            writesValue(nextSnapshot, "ampAttack", 0.001)
                && writesValue(nextSnapshot, "ampDecay", 10)
                && writesValue(nextSnapshot, "ampSustain", 0)
                && writesValue(nextSnapshot, "ampRelease", 0.005)
        ));
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => /^env4/.test(endpointID)), false);

        // The mapped-cell HUD uses the same env/slot-4 route identity, while
        // its presentation must call the source AMP without exposing a fake
        // numbered envelope.
        const attackBox = await attackCell.boundingBox();
        assert.ok(attackBox);
        const attackCenterX = attackBox.x + (attackBox.width / 2);
        const attackCenterY = attackBox.y + (attackBox.height / 2);
        await page.mouse.move(attackCenterX, attackCenterY);
        await page.mouse.down();
        await page.mouse.move(attackCenterX, attackCenterY - 6);
        await page.mouse.move(attackCenterX, attackCenterY - 58, { steps: 8 });
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ));
        sourceLine = await hud.locator(".mobile-voice-hud-source").innerText();
        assert.match(sourceLine, /^AMP\b/);
        assert.doesNotMatch(sourceLine, /AMP\s*4|Envelope\s*4/i);
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(page, "Amp Envelope quick-sheet route amount", (nextSnapshot) => (
            Math.abs(readStoredModulationState(nextSnapshot).routes.find((route) => route.id === routeId)?.amount ?? 0.25) > 0.251
        ));
        assert.deepEqual(
            (({ sourceKind, sourceSlot, targetKind }) => ({ sourceKind, sourceSlot, targetKind }))(
                readStoredModulationState(snapshot).routes.find((route) => route.id === routeId),
            ),
            { sourceKind: "env", sourceSlot: 4, targetKind: "ampAttack" },
        );

        // Full editor handoff keeps the Amp identity. Its exact-entry and
        // draggable Release controls both share the 5 ms floor, while Env 1
        // retains the established 1 ms floor.
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        const editor = page.locator('[data-role="mod-source-editor"]');
        await editor.waitFor({ state: "attached" });
        assert.equal(await editor.getAttribute("data-source-kind"), "env");
        assert.equal(await editor.getAttribute("data-source-slot"), "4");
        assert.doesNotMatch(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText(), /Envelope\s*4|AMP\s*4/i);

        let releaseInput = page.locator('input[aria-label="Envelope release value"]:visible');
        await clearHarnessDebugLog(page);
        await releaseInput.focus();
        await releaseInput.fill("1 ms");
        await releaseInput.blur();
        snapshot = await waitForHarnessSnapshot(page, "Amp Envelope exact Release floor", (nextSnapshot) => (
            writesValue(nextSnapshot, "ampRelease", 0.005)
        ));
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "ampRelease" && Number(value) < 0.005
        )), false);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("ampRelease", 0.2, true);
        });
        await page.waitForFunction(() => Math.abs(Number(
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.ampRelease,
        ) - 0.2) <= 1e-9);
        await clearHarnessDebugLog(page);
        await dragEnvelopeHandleBy(page, "adsr-release-handle-hit-target", -1000, 0);
        snapshot = await waitForHarnessSnapshot(page, "Amp Envelope dragged Release floor", (nextSnapshot) => (
            writesValue(nextSnapshot, "ampRelease", 0.005)
        ));
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "ampRelease" && Number(value) < 0.005
        )), false);

        await page.locator('[data-role="mobile-mod-source-number"]').selectOption("1");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("env1Release", 0.2, true);
        });
        await page.waitForFunction(() => Math.abs(Number(
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.env1Release,
        ) - 0.2) <= 1e-9);
        releaseInput = page.locator('input[aria-label="Envelope release value"]:visible');
        await clearHarnessDebugLog(page);
        await releaseInput.focus();
        await releaseInput.fill("1 ms");
        await releaseInput.blur();
        snapshot = await waitForHarnessSnapshot(page, "ordinary Envelope exact Release floor", (nextSnapshot) => (
            writesValue(nextSnapshot, "env1Release", 0.001)
        ));
        assert.equal(snapshot.parameterValues.env1Release, 0.001);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("env1Release", 0.2, true);
        });
        await page.waitForFunction(() => Math.abs(Number(
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.env1Release,
        ) - 0.2) <= 1e-9);
        await clearHarnessDebugLog(page);
        await dragEnvelopeHandleBy(page, "adsr-release-handle-hit-target", -1000, 0);
        await waitForHarnessSnapshot(page, "ordinary Envelope dragged Release floor", (nextSnapshot) => (
            writesValue(nextSnapshot, "env1Release", 0.001)
        ));
    } finally {
        await page.close();
    }
});

test("rack continuous parameters use the approved stippled dual-ring knobs instead of native ranges", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("role"), "slider");
        assert.equal(await knob.locator(".rack-knob-base-track").count(), 1);
        assert.equal(await knob.locator(".rack-knob-base-fill").count(), 1);
        assert.equal(await knob.locator(".rack-knob-mod-track").count(), 1);
        assert.equal(await knob.locator(".rack-knob-mod-fill").count(), 1);
        assert.equal(
            await page.locator('[data-role="rack-editor-reverb"] input[type="range"]').count(),
            0,
        );
    } finally {
        await page.close();
    }
});

test("rack knobs retain a fixed default marker while the live base indicator moves", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const readPositions = () => knob.evaluate((element) => {
            const defaultMarker = element.querySelector(".rack-knob-default-marker");
            const liveHandle = element.querySelector(".rack-knob-handle");
            if (!(defaultMarker instanceof SVGCircleElement) || !(liveHandle instanceof SVGCircleElement)) {
                return null;
            }
            return {
                default: [defaultMarker.getAttribute("cx"), defaultMarker.getAttribute("cy")],
                live: [liveHandle.getAttribute("cx"), liveHandle.getAttribute("cy")],
            };
        });
        const before = await readPositions();
        assert.ok(before);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.82);
        });
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-reverbSize"]')?.value === "0.82");
        const after = await readPositions();
        assert.ok(after);
        assert.deepEqual(after.default, before.default);
        assert.notDeepEqual(after.live, before.live);
    } finally {
        await page.close();
    }
});

test("rack knob base drags capture the pointer, show a stable HUD, and detach cleanly on release", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.5);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const centerX = box.x + (box.width / 2);
        const centerY = box.y + (box.height / 2);

        await page.mouse.move(centerX - 8, centerY);
        await page.mouse.move(centerX + 8, centerY, { steps: 5 });
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, []);

        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        assert.equal(await page.locator('[data-role="mobile-voice-hud"]').count(), 0);
        await page.mouse.move(centerX + 10, centerY, { steps: 3 });
        await page.waitForSelector('[data-role="mobile-voice-hud"].is-visible');
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        assert.equal(await hud.getAttribute("data-hud-axis"), "base");
        assert.match(await hud.innerText(), /BASE[\s\S]*Size/i);
        const hudLayout = await hud.evaluate((element) => {
            const hudBounds = element.getBoundingClientRect();
            const knob = document.querySelector('[data-role="rack-parameter-reverbSize"]')?.getBoundingClientRect();
            const style = getComputedStyle(element);
            return knob ? {
                pointerEvents: style.pointerEvents,
                intersectsKnob: !(hudBounds.right <= knob.left || hudBounds.left >= knob.right || hudBounds.bottom <= knob.top || hudBounds.top >= knob.bottom),
                onScreen: hudBounds.left >= 0 && hudBounds.top >= 0 && hudBounds.right <= window.innerWidth && hudBounds.bottom <= window.innerHeight,
            } : null;
        });
        assert.ok(hudLayout);
        assert.equal(hudLayout.pointerEvents, "none");
        assert.equal(hudLayout.intersectsKnob, false, "The gesture HUD must not cover the active knob.");
        assert.equal(hudLayout.onScreen, true, "The gesture HUD must remain fully on screen.");

        await page.mouse.move(centerX + 34, centerY, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="mobile-voice-hud"]') === null);

        snapshot = await waitForHarnessSnapshot(
            page,
            "rack knob pointer gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.laneParams.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);

        const valueAfterRelease = Number(snapshot.laneParams.reverbSize);
        await clearHarnessDebugLog(page);
        await page.mouse.move(centerX, centerY + 20, { steps: 6 });
        await page.mouse.move(centerX, centerY - 20, { steps: 6 });
        await page.waitForTimeout(60);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.laneParams.reverbSize), valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages, []);
    } finally {
        await page.close();
    }
});

test("rack knob touch drag survives unavailable pointer capture outside the knob", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.5);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const artBox = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(artBox);
        await knob.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        const pointerId = 97;
        const start = {
            x: artBox.x + (artBox.width / 2),
            y: artBox.y + (artBox.height / 2),
        };
        const moved = { x: start.x + 40, y: start.y };
        await knob.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        // Two samples: the first classifies the axis (and is consumed by the
        // rolling contract), the second applies the delta.
        await page.evaluate(({ pointerId, start, moved }) => {
            for (const point of [{ x: start.x + 20, y: start.y }, moved]) {
                window.dispatchEvent(new PointerEvent("pointermove", {
                    pointerId,
                    pointerType: "touch",
                    button: 0,
                    buttons: 0,
                    clientX: point.x,
                    clientY: point.y,
                    bubbles: true,
                }));
            }
        }, { pointerId, start, moved });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack knob touch move",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && Number(nextSnapshot.laneParams.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack knob touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
        await page.waitForFunction(() => document.querySelector('[data-role="mobile-voice-hud"]') === null);
    } finally {
        await page.close();
    }
});

test("rack knob outer-ring drags edit only the selected source-target modulation route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(
            page,
            "initial zero-depth reverb route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.5);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "mapped");
        assert.equal(await knob.locator(".rack-knob-route-presence").count(), 1);
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const centerX = box.x + (box.width * 0.5);
        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX, centerY - 38, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        assert.equal(await hud.getAttribute("data-hud-axis"), "modulation");
        assert.match(await hud.innerText(), /MOD[\s\S]*Size/i);
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "outer-ring route amount",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
                && route.amount > 0.01
            )),
        );
        const route = readStoredModulationState(snapshot).routes.find((candidate) => (
            candidate.sourceKind === "mseg"
            && candidate.sourceSlot === 1
            && candidate.targetKind === "lane.reverb#1.reverbSize"
        ));
        assert.ok(route);
        assert.equal(Number(snapshot.laneParams.reverbSize), 0.5);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"] .rack-knob-mod-fill')
                ?.getAttribute("d") !== ""
        ));
        assert.notEqual(await knob.locator(".rack-knob-mod-fill").getAttribute("d"), "");
    } finally {
        await page.close();
    }
});

test("rack parameter frames stay neutral while badges and armed rings tell route ownership", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.distortion#1.distortionWet", amount: 0.35, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.click('[data-role="rack-editor-power"]');
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-env-1"]');
        await collapseGlobalModRail(page);

        const mixSurface = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const driveSurface = page.locator('[data-role="rack-parameter-surface-distortionDriveDb"]');
        const mixKnob = mixSurface.locator('[data-role="distortion-mix-field"]');
        const visual = await mixSurface.evaluate((element) => {
            const knob = element.querySelector('.rack-parameter-knob');
            const outerTrack = element.querySelector('.rack-knob-mod-track');
            const innerFill = element.querySelector('.rack-knob-base-fill');
            if (!(knob instanceof HTMLElement) || !(outerTrack instanceof SVGElement) || !(innerFill instanceof SVGElement)) {
                return null;
            }
            const surfaceStyle = getComputedStyle(element);
            return {
                className: element.className,
                borderColor: surfaceStyle.borderColor,
                boxShadow: surfaceStyle.boxShadow,
                routeState: knob.dataset.routeState,
                trackStroke: getComputedStyle(outerTrack).stroke,
                innerFill: getComputedStyle(innerFill).fill,
            };
        });
        assert.ok(visual);
        assert.equal(visual.className.includes("has-route"), false);
        assert.equal(visual.className.includes("is-selected-target"), false);
        assert.equal(visual.routeState, "unmapped");
        assert.equal(visual.borderColor, "rgba(255, 255, 255, 0.08)");
        assert.equal(/184, 226, 54/.test(`${visual.borderColor} ${visual.boxShadow}`), false);
        // ADR-025 rows 1 + 4: the unmapped dotted ring speaks in the armed
        // SOURCE color and the inside speaks in the OWNING effect color.
        assert.equal(visual.trackStroke, "rgb(184, 226, 54)");
        assert.equal(visual.innerFill, "rgb(255, 106, 39)");
        assert.equal(await mixKnob.getAttribute("aria-label"), "Mix");
        const badge = mixSurface.locator('[data-role="rack-route-count-distortionWet"]');
        assert.equal((await badge.textContent()).trim(), "1");
        assert.match(await badge.getAttribute("aria-label"), /1 modulation route target Mix/);
        assert.equal((await badge.getAttribute("class")).includes("is-solid"), true);
        assert.equal((await driveSurface.getAttribute("class")).includes("is-selected-target"), true);
        // ADR-025 row 2: selection brightens the owning drive accent.
        const selectedBorder = await driveSurface.evaluate((element) => getComputedStyle(element).borderColor);
        assert.ok(
            selectedBorder.startsWith("color(srgb 1 0.4") || selectedBorder.includes("255, 106, 39"),
            `selected-target border must be the drive accent, got ${selectedBorder}`,
        );
    } finally {
        await page.close();
    }
});

test("switching armed sources swaps only selected-route outer geometry and preserves exact target count", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.distortion#1.distortionWet", amount: 0.2, reducer: "max" },
                { id: "env-mix", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.distortion#1.distortionWet", amount: -0.55, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionWet", 0.6);
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await page.click('[data-role="rack-editor-power"]');
        await expandGlobalModRail(page);
        const mix = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const readRing = () => mix.evaluate((element) => {
            const knob = element.querySelector('.rack-parameter-knob');
            const fill = element.querySelector('.rack-knob-mod-fill');
            return knob instanceof HTMLElement && fill instanceof SVGPathElement
                ? { color: knob.style.getPropertyValue("--rack-knob-mod-accent"), path: fill.getAttribute("d") }
                : null;
        });

        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        const msegRing = await readRing();
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-env-1"]');
        const envRing = await readRing();
        assert.ok(msegRing && envRing);
        assert.equal(msegRing.color, "#cc59d2");
        assert.equal(envRing.color, "#b8e236");
        assert.notEqual(msegRing.path, envRing.path);
        assert.equal((await mix.locator('[data-role="rack-route-count-distortionWet"]').textContent()).trim(), "2");
        assert.equal((await mix.getAttribute("class")).includes("is-selected-target"), false);
    } finally {
        await page.close();
    }
});

test("an unmapped rack knob shows a neutral outer track and its modulation axis stays inert", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        let knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "no-source");
        assert.equal(await knob.locator(".rack-knob-mod-track.is-hidden").count(), 1);

        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "unmapped");
        assert.equal(await knob.locator(".rack-knob-mod-track.is-unmapped").count(), 1);
        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await clearHarnessDebugLog(page);
        // The shared contract: the vertical (modulation) axis of an unmapped
        // knob is inert — no route creation, no writes, and the HUD stays in
        // base presentation instead of advertising an impossible edit.
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y - 42, { steps: 8 });
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await hud.waitFor();
        assert.equal(await hud.getAttribute("data-hud-axis"), "base");
        await page.mouse.up();

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
            false,
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"), false);
        assert.equal(
            snapshot.sentMessages.some((message) => isLaneParamSend(message, "reverbSize")),
            false,
            "An inert modulation drag must not write the base parameter either.",
        );
    } finally {
        await page.close();
    }
});

test("T57 removes the redundant Create Mapping row without changing source-drop mapping", async () => {
    const layouts = [
        { name: "phone", width: 393, height: 852, compact: true },
        { name: "plugin", width: 1120, height: 680, compact: false },
        { name: "desktop", width: 1440, height: 900, compact: false },
    ];

    for (const layout of layouts) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize({
                width: layout.width,
                height: layout.height,
            }),
        });

        try {
            if (layout.compact) {
                await page.click('[data-role="mobile-workspace-tab-fx"]');
            }
            await selectRackEffect(page, "reverb");
            if (layout.compact) {
                await expandGlobalModRail(page);
                await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
            } else {
                await page.click('[data-role="rack-mod-source-mseg-1"]');
            }

            const modulationArea = page.locator(".rack-editor-modulation");
            const unmappedHeight = await modulationArea.evaluate((element) => element.getBoundingClientRect().height);
            assert.equal(
                await page.locator('[data-role="rack-create-mapping"]').count(),
                0,
                `${layout.name} still renders CREATE MAPPING +.`,
            );
            assert.equal(
                await page.locator('[data-role="rack-unmapped-pair"]').count(),
                0,
                `${layout.name} still reserves an unmapped-pair row.`,
            );

            await createRackMappingByDrop(page);
            await waitForHarnessSnapshot(
                page,
                `${layout.name} source drop creates the selected mapping`,
                (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                    route.sourceKind === "mseg"
                    && route.sourceSlot === 1
                    && route.targetKind === "lane.reverb#1.reverbSize"
                )),
            );
            const mappedHeight = await modulationArea.evaluate((element) => element.getBoundingClientRect().height);
            assert.equal(
                Math.abs(mappedHeight - unmappedHeight) <= 1,
                true,
                `${layout.name} reserves different modulation height when unmapped (${unmappedHeight}) and mapped (${mappedHeight}).`,
            );
            assert.equal(await page.locator('[data-role="rack-create-mapping"]').count(), 0);
            assert.equal(await page.locator('[data-role="rack-unmapped-pair"]').count(), 0);
        } finally {
            await page.close();
        }
    }
});

test("T58 effect headers contain only the name in active and bypassed phone, plugin, and desktop editors", async () => {
    const effects = [
        { id: "filter", label: "Filter" },
        { id: "drive", label: "Distortion" },
        { id: "ott", label: "OTT" },
        { id: "chorus", label: "Chorus" },
        { id: "flanger", label: "Flanger" },
        { id: "phaser", label: "Phaser" },
        { id: "delay", label: "Delay" },
        { id: "reverb", label: "Reverb" },
    ];
    const layouts = [
        { name: "phone", width: 393, height: 852, compact: true },
        { name: "plugin", width: 1120, height: 680, compact: false },
        { name: "desktop", width: 1440, height: 900, compact: false },
    ];

    for (const layout of layouts) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize({
                width: layout.width,
                height: layout.height,
            }),
        });

        try {
            if (layout.compact) {
                await page.click('[data-role="mobile-workspace-tab-fx"]');
            }

            for (const effect of effects) {
                await selectRackEffect(page, effect.id);
                const editor = page.locator(`[data-role="rack-editor-${effect.id}"]`);
                const assertHeader = async (enabled) => {
                    const header = await editor.locator(".rack-editor-header").evaluate((element) => {
                        const heading = element.querySelector(".rack-editor-heading");
                        const name = element.querySelector(".rack-editor-name");
                        const power = element.querySelector('[data-role="rack-editor-power"]');
                        if (!(heading instanceof HTMLElement)
                            || !(name instanceof HTMLElement)
                            || !(power instanceof HTMLElement)) {
                            return null;
                        }
                        const headerBounds = element.getBoundingClientRect();
                        const headingBounds = heading.getBoundingClientRect();
                        const nameBounds = name.getBoundingClientRect();
                        const powerBounds = power.getBoundingClientRect();
                        return {
                            text: heading.innerText.trim(),
                            childTags: Array.from(heading.children).map((child) => child.tagName),
                            headerHeight: headerBounds.height,
                            headingHeight: headingBounds.height,
                            nameHeight: nameBounds.height,
                            nameFits: name.scrollWidth <= name.clientWidth + 1
                                && name.scrollHeight <= name.clientHeight + 1,
                            nameScrollWidth: name.scrollWidth,
                            nameClientWidth: name.clientWidth,
                            nameScrollHeight: name.scrollHeight,
                            nameClientHeight: name.clientHeight,
                            nameContained: nameBounds.left >= headerBounds.left - 0.5
                                && nameBounds.right <= powerBounds.left + 0.5
                                && nameBounds.top >= headerBounds.top - 0.5
                                && nameBounds.bottom <= headerBounds.bottom + 0.5,
                            powerWidth: powerBounds.width,
                            powerHeight: powerBounds.height,
                        };
                    });
                    assert.ok(header, `${layout.name} ${effect.label} header is incomplete.`);
                    assert.equal(header.text, effect.label, `${layout.name} ${effect.label} ${enabled ? "active" : "bypassed"} header leaked extra text.`);
                    assert.deepEqual(header.childTags, ["STRONG"]);
                    assert.equal(header.headerHeight <= 50, true, `${layout.name} ${effect.label} did not reclaim the old heading rows (${header.headerHeight}px).`);
                    assert.equal(header.headingHeight <= header.nameHeight + 1, true, `${layout.name} ${effect.label} retains blank heading-row height.`);
                    assert.equal(
                        header.nameFits,
                        true,
                        `${layout.name} ${effect.label} name is clipped (${header.nameScrollWidth}x${header.nameScrollHeight} in ${header.nameClientWidth}x${header.nameClientHeight}).`,
                    );
                    assert.equal(header.nameContained, true, `${layout.name} ${effect.label} name escapes its header.`);
                    assert.equal(header.powerWidth >= 44 && header.powerHeight >= 44, true, `${layout.name} ${effect.label} power hit area shrank.`);
                };
                const setEnabled = async (enabled) => {
                    if ((await editor.getAttribute("data-effect-enabled")) !== String(enabled)) {
                        await editor.locator('[data-role="rack-editor-power"]').click();
                        await page.waitForFunction(
                            ({ effectId, expected }) => document.querySelector(`[data-role="rack-editor-${effectId}"]`)
                                ?.getAttribute("data-effect-enabled") === expected,
                            { effectId: effect.id, expected: String(enabled) },
                        );
                    }
                };

                await setEnabled(true);
                await assertHeader(true);
                await setEnabled(false);
                await assertHeader(false);
            }
        } finally {
            await page.close();
        }
    }
});

test("editing a bypassed rack route preserves bypass and renders the outer ring as bypassed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(page, "route before bypass-preserving edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "lane.reverb#1.reverbSize")
        ));
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]').click();
        await waitForHarnessSnapshot(page, "bypassed route before amount edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "lane.reverb#1.reverbSize")?.enabled === false
        ));
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        assert.equal(await knob.locator(".rack-knob-route-presence.is-bypassed").count(), 1);

        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 36, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        const liveBypassedStyle = await knob.locator('.rack-knob-mod-fill').evaluate((element) => {
            const style = getComputedStyle(element);
            return { opacity: style.opacity, dash: style.strokeDasharray, filter: style.filter };
        });
        // The ADR-025 quick-fade transition settles within 140ms.
        await page.waitForFunction(() => {
            const track = document.querySelector('[data-role="rack-parameter-reverbSize"] .rack-knob-mod-track');
            return track instanceof SVGElement && getComputedStyle(track).opacity === "0.28";
        });
        assert.notEqual(liveBypassedStyle.dash, "none");
        assert.equal(liveBypassedStyle.filter, "none");
        await page.mouse.up();
        const snapshot = await waitForHarnessSnapshot(page, "bypassed route amount edit", (nextSnapshot) => {
            const route = readStoredModulationState(nextSnapshot).routes.find((candidate) => candidate.targetKind === "lane.reverb#1.reverbSize");
            return route !== undefined && route.amount > 0.01;
        });
        assert.equal(
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "lane.reverb#1.reverbSize")?.enabled,
            false,
        );
    } finally {
        await page.close();
    }
});

test("a stationary touch hold on a rack knob opens its routing menu with one haptic bump", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 375, height: 667 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(
            page,
            "route before rack parameter hold",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await clearHarnessDebugLog(page);
        // ADR-025: creation confirmation itself gives one light tick; the
        // claim under test is the HOLD's single bump, so start clean.
        await page.evaluate(() => { window.__rackHaptics.length = 0; });

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const box = await knob.boundingBox();
        assert.ok(box);
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await knob.dispatchEvent("pointerdown", {
            pointerId: 41,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: point.x,
            clientY: point.y,
        });
        await page.waitForTimeout(560);

        const menu = page.locator('[data-role="rack-parameter-menu"]');
        await menu.waitFor();
        assert.deepEqual(
            await menu.locator('[data-role="rack-parameter-menu-item"]').evaluateAll((items) => (
                items.map((item) => item.getAttribute("data-action"))
            )),
            [
                "edit-values",
                "reset-base",
                "toggle-route",
                "polarity",
                "reducer",
                "remove-route",
                "remove-all-target-routes",
            ],
        );
        assert.deepEqual(await page.evaluate(() => window.__rackHaptics), ["light"]);

        await knob.dispatchEvent("pointerup", {
            pointerId: 41,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: point.x,
            clientY: point.y,
        });
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
        assert.deepEqual(snapshot.sentMessages, []);
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
    } finally {
        await page.close();
    }
});

test("moving a rack knob touch cancels the hold menu and completes one captured value gesture", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 375, height: 667 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.5);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await knob.dispatchEvent("pointerdown", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        // Two samples: the first classifies the base axis (consumed), the
        // second applies the delta; the movement also cancels the hold menu.
        for (const deltaX of [14, 28]) {
            await knob.dispatchEvent("pointermove", {
                pointerId: 42,
                pointerType: "touch",
                button: 0,
                buttons: 1,
                clientX: start.x + deltaX,
                clientY: start.y,
            });
        }
        await page.waitForTimeout(560);
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
        assert.deepEqual(await page.evaluate(() => window.__rackHaptics), []);
        await knob.dispatchEvent("pointerup", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x + 28,
            clientY: start.y,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "completed touch knob gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.laneParams.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
    } finally {
        await page.close();
    }
});

test("rack parameter reset restores the base default without deleting modulation routes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(
            page,
            "route before base reset",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.84);
        });
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="rack-parameter-reverbSize"]').click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack base default reset",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.laneParams.reverbSize) - 0.5) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
            true,
        );
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("rack parameter menu edits the active route enablement polarity and voice reducer", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(
            page,
            "route before context edits",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const routeForSize = (snapshot) => readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "lane.reverb#1.reverbSize"
        ));

        await knob.click({ button: "right" });
        let action = page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]');
        assert.equal((await action.textContent()).trim(), "Bypass route");
        await action.click();
        await waitForHarnessSnapshot(page, "bypassed rack route", (snapshot) => routeForSize(snapshot)?.enabled === false);

        await knob.click({ button: "right" });
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]');
        assert.equal((await action.textContent()).trim(), "Enable route");
        await action.click();
        await waitForHarnessSnapshot(page, "enabled rack route", (snapshot) => routeForSize(snapshot)?.enabled === true);

        await knob.click({ button: "right" });
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="polarity"]');
        assert.equal((await action.textContent()).trim(), "Polarity: Unipolar");
        await action.click();
        await waitForHarnessSnapshot(page, "bipolar rack route", (snapshot) => routeForSize(snapshot)?.polarity === "bipolar");

        await knob.click({ button: "right" });
        assert.equal(
            (await page.locator('[data-role="rack-parameter-menu-item"][data-action="polarity"]').textContent()).trim(),
            "Polarity: Bipolar",
        );
        action = page.locator('[data-role="rack-parameter-menu-item"][data-action="reducer"]');
        assert.equal((await action.textContent()).trim(), "Voice reducer: Maximum");
        await action.click();
        await waitForHarnessSnapshot(page, "mean rack route reducer", (snapshot) => routeForSize(snapshot)?.reducer === "mean");

        await knob.click({ button: "right" });
        assert.equal(
            (await page.locator('[data-role="rack-parameter-menu-item"][data-action="reducer"]').textContent()).trim(),
            "Voice reducer: Mean",
        );
    } finally {
        await page.close();
    }
});

test("rack exact-value sheet applies real-unit base and selected-route amounts", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await waitForHarnessSnapshot(
            page,
            "route before exact rack edit",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("reverbSize", 0.5);
        });

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        await sheet.waitFor();
        const sheetVisual = await sheet.evaluate((element) => ({
            backgroundImage: getComputedStyle(element).backgroundImage,
            fontFamilies: Array.from(element.querySelectorAll("button, em, input, label, p, span, strong"))
                .map((child) => getComputedStyle(child).fontFamily),
        }));
        assert.equal(sheetVisual.backgroundImage, "none");
        assert.equal(sheetVisual.fontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        const baseInput = sheet.locator('[data-role="rack-base-value-input"]');
        const amountInput = sheet.locator('[data-role="rack-modulation-value-input"]');
        assert.equal(await baseInput.inputValue(), "50");
        assert.equal(await amountInput.inputValue(), "0");

        await amountInput.fill("35");
        await sheet.locator('[data-role="rack-value-sheet-default"]').click();
        assert.equal(await baseInput.inputValue(), "50");
        assert.equal(await amountInput.inputValue(), "35");
        await baseInput.fill("72");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "exact rack values applied",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes.find((candidate) => (
                    candidate.sourceKind === "mseg"
                    && candidate.sourceSlot === 1
                    && candidate.targetKind === "lane.reverb#1.reverbSize"
                ));
                return Math.abs(Number(nextSnapshot.laneParams.reverbSize) - 0.72) < 0.0001
                    && route !== undefined
                    && Math.abs(route.amount - 0.35) < 0.0001;
            },
        );
        assert.equal(Math.abs(Number(snapshot.laneParams.reverbSize) - 0.72) < 0.0001, true);
        assert.equal(await sheet.count(), 0);
    } finally {
        await page.close();
    }
});

test("rack exact entry keeps units visible, rejects incompatible units, and commits tempo divisions", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "filter");
        const cutoff = page.locator('[data-role="rack-parameter-globalFilterCutoff"]');
        await cutoff.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        let sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        let baseInput = sheet.locator('[data-role="rack-base-value-input"]');
        assert.equal((await baseInput.locator("xpath=following-sibling::em").textContent()).trim(), "Hz");
        await baseInput.fill("12khz");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        await waitForHarnessSnapshot(
            page,
            "rack cutoff exact entry applies 12 kHz",
            (snapshot) => Math.abs(Number(snapshot.laneParams.globalFilterCutoff) - 12_000) <= 1e-9,
        );

        await cutoff.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        baseInput = sheet.locator('[data-role="rack-base-value-input"]');
        await baseInput.fill("12 st");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        assert.equal(await sheet.count(), 1, "a rejection must keep the rack editor open");
        assert.match(await sheet.getByRole("alert").textContent(), /st.*not compatible.*Hz/i);
        assert.equal(Number((await getHarnessSnapshot(page)).laneParams.globalFilterCutoff), 12_000);
        await sheet.locator('[data-role="rack-value-sheet-cancel"]').click();

        await selectRackEffect(page, "delay");
        const delayTime = page.locator('[data-role="rack-parameter-delayTime"]');
        await delayTime.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        await sheet.locator('[data-role="rack-base-value-input"]').fill("1/8");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();
        await waitForHarnessSnapshot(
            page,
            "delay exact division commits Sync and the descriptor division",
            (snapshot) => Number(snapshot.laneParams.delayTimeMode) === 1
                && Number(snapshot.laneParams.delayDivision) === 8,
        );
        assert.match(await page.locator('[data-role="rack-parameter-delayTimeMode"]').innerText(), /Sync/i);
        assert.match(await page.locator('[data-role="rack-parameter-delayDivision"]').innerText(), /1\/8/i);
    } finally {
        await page.close();
    }
});

test("rack exact-value editing never creates an unrequested modulation route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();

        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        const amountInput = sheet.locator('[data-role="rack-modulation-value-input"]');
        assert.equal(await amountInput.isDisabled(), true);
        assert.equal((await sheet.locator('[data-role="rack-value-sheet-no-route"]').textContent()).trim(), "Arm a source to edit its route.");
        await sheet.locator('[data-role="rack-base-value-input"]').fill("64");
        await sheet.locator('[data-role="rack-value-sheet-apply"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "base-only exact rack edit",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.laneParams.reverbSize) - 0.64) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "lane.reverb#1.reverbSize"),
            false,
        );
    } finally {
        await page.close();
    }
});

test("rack parameter menu hides route removal when the target has no routes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.locator('[data-role="rack-parameter-reverbSize"]').click({ button: "right" });

        const menu = page.locator('[data-role="rack-parameter-menu"]');
        assert.doesNotMatch(await menu.innerText(), /Remove this route/i);
        assert.equal(await menu.locator('[data-action="remove-route"]').count(), 0);
        assert.equal(await menu.locator('[data-action="remove-all-target-routes"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("rack parameter menus never edit a hidden default-source route while no source is armed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "hidden-mseg-route", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.reverb#1.reverbSize", amount: 0.45, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "no-source");
        await knob.click({ button: "right" });
        for (const action of ["toggle-route", "polarity", "remove-route"]) {
            assert.equal(
                await page.locator(`[data-role="rack-parameter-menu-item"][data-action="${action}"]`).count(),
                0,
                action,
            );
        }
        assert.equal(
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-all-target-routes"]').count(),
            1,
        );
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="edit-values"]').click();
        const sheet = page.locator('[data-role="rack-parameter-value-sheet"]');
        assert.match(await sheet.innerText(), /No armed source.*Arm a source to edit its route/is);
        assert.equal(await sheet.locator('[data-role="rack-modulation-value-input"]').isDisabled(), true);
        assert.equal(
            readStoredModulationState(await getHarnessSnapshot(page)).routes.find((route) => route.id === "hidden-mseg-route")?.amount,
            0.45,
        );
    } finally {
        await page.close();
    }
});

test("rack parameter route removal targets one source or confirms removal of every target route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-env-1"]');
        await createRackMappingByDrop(page, '[data-role="rack-mod-source-env-1"]');
        await waitForHarnessSnapshot(
            page,
            "two source routes before removal",
            (snapshot) => readStoredModulationState(snapshot).routes.filter(
                (route) => route.targetKind === "lane.reverb#1.reverbSize",
            ).length === 2,
        );
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');

        await knob.click({ button: "right" });
        const menuTypography = await page.locator('[data-role="rack-parameter-menu-item"]').first().evaluate((item) => {
            const style = getComputedStyle(item);
            return {
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                letterSpacing: style.letterSpacing,
            };
        });
        assert.match(menuTypography.fontFamily, /system-ui/);
        assert.doesNotMatch(menuTypography.fontFamily, /Departure Mono/);
        assert.equal(menuTypography.fontSize, "13px");
        assert.equal(menuTypography.letterSpacing, "normal");
        const removeSelectedRoute = page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-route"]');
        assert.equal((await removeSelectedRoute.textContent()).trim(), "Remove ENV 1 route");
        await removeSelectedRoute.click();
        let snapshot = await waitForHarnessSnapshot(
            page,
            "single selected rack route removed",
            (nextSnapshot) => {
                const routes = readStoredModulationState(nextSnapshot).routes;
                return !routes.some((route) => route.sourceKind === "env" && route.targetKind === "lane.reverb#1.reverbSize")
                    && routes.some((route) => route.sourceKind === "mseg" && route.targetKind === "lane.reverb#1.reverbSize");
            },
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.filter((route) => route.targetKind === "lane.reverb#1.reverbSize").length,
            1,
        );

        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        await knob.click({ button: "right" });
        const removeAllRoutes = page.locator('[data-role="rack-parameter-menu-item"][data-action="remove-all-target-routes"]');
        const removeAllBounds = await removeAllRoutes.boundingBox();
        assert.ok(removeAllBounds && removeAllBounds.y >= 0 && removeAllBounds.y + removeAllBounds.height <= 667);
        await removeAllRoutes.click();
        const confirmation = page.locator('[data-role="rack-remove-target-routes-confirmation"]');
        await confirmation.waitFor();
        assert.match(await confirmation.textContent(), /remove all 1 route/i);
        const confirmationVisual = await confirmation.evaluate((element) => ({
            backgroundImage: getComputedStyle(element).backgroundImage,
            fontFamilies: Array.from(element.querySelectorAll("button, p, span, strong"))
                .map((child) => getComputedStyle(child).fontFamily),
        }));
        assert.equal(confirmationVisual.backgroundImage, "none");
        assert.equal(confirmationVisual.fontFamilies.every((fontFamily) => /system-ui/.test(fontFamily)), true);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "lane.reverb#1.reverbSize"),
            true,
        );
        await confirmation.locator('[data-role="rack-remove-target-routes-confirm"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "all rack target routes removed",
            (nextSnapshot) => !readStoredModulationState(nextSnapshot).routes.some(
                (route) => route.targetKind === "lane.reverb#1.reverbSize",
            ),
        );
        assert.equal(await confirmation.count(), 0);
    } finally {
        await page.close();
    }
});

test("short-phone rack knobs form a touchable three-column matrix", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const controls = page.locator('[data-role="rack-editor-reverb"] .rack-editor-control');
        assert.equal(await controls.count(), 5);
        const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
            const bounds = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
                bounds.left + Math.min(12, bounds.width / 4),
                bounds.top + (bounds.height / 2),
            );
            return {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                ownsInteriorHit: hit !== null && element.contains(hit),
                hitRole: hit?.closest("[data-role]")?.getAttribute("data-role") ?? null,
            };
        }));
        assert.equal(Math.abs(boxes[0].y - boxes[1].y) < 1, true);
        assert.equal(Math.abs(boxes[1].y - boxes[2].y) < 1, true);
        assert.equal(Math.abs(boxes[3].y - boxes[4].y) < 1, true);
        assert.equal(boxes[3].y > boxes[0].y + 40, true);
        assert.equal(Math.abs(boxes[0].x - boxes[3].x) < 1, true);
        assert.equal(Math.abs(boxes[1].x - boxes[4].x) < 1, true);
        assert.equal(boxes.every((box) => box.width >= 52 && box.height >= 68), true);
        assert.equal(boxes.every((box) => box.ownsInteriorHit), true, JSON.stringify(boxes));
    } finally {
        await page.close();
    }
});

test("mobile Mod joins one compact source selector to its editor without the legacy chip grid", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const editor = page.locator('.mobile-mod-source-editor');
        const frame = editor.locator('[data-role="mobile-mod-integrated-editor"]');
        const selector = frame.locator('[data-role="mobile-mod-source-selector"]');
        const typeSelect = selector.locator('[data-role="mobile-mod-source-type"]');
        const numberSelect = selector.locator('[data-role="mobile-mod-source-number"]');

        await selector.waitFor();
        assert.equal(await typeSelect.inputValue(), "mseg");
        assert.equal(await numberSelect.inputValue(), "1");
        assert.deepEqual(await typeSelect.locator("option").allTextContents(), ["MSEG", "ENV", "MACRO"]);
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3"]);
        assert.equal(await editor.locator('[data-role="mobile-mod-source-family"]').count(), 0);
        assert.equal(await editor.locator('[data-role="mod-fixed-sources"]').count(), 0);
        assert.equal(/\blfo\b/i.test(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText()), false);
    } finally {
        await page.close();
    }
});

test("mobile Mod selector drives the attached editor and stays contained at iPhone width", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        // T43 makes one source tap open the quick sheet; env/macro detail is
        // reached through the sheet's Full editor button.
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        await source.click();
        await page.locator('[data-role="quick-source-sheet"]').waitFor();
        await page.click('[data-role="quick-source-sheet-full-editor"]');

        const editor = page.locator('.mobile-mod-source-editor');
        const frame = editor.locator('[data-role="mobile-mod-integrated-editor"]');
        const selector = frame.locator('[data-role="mobile-mod-source-selector"]');
        const typeSelect = selector.locator('[data-role="mobile-mod-source-type"]');
        const numberSelect = selector.locator('[data-role="mobile-mod-source-number"]');
        const editorState = editor.locator('[data-role="mod-source-editor"]');

        await selector.waitFor();
        for (const width of [393, 320]) {
            await page.setViewportSize({ width, height: 852 });
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const layout = await frame.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const dock = element.querySelector('[data-role="mobile-mod-source-selector"]');
                const body = element.querySelector('[data-role="mobile-mod-editor-body"]');
                const controls = element.querySelector('[data-role="mobile-mod-active-controls"]');
                const typeControl = element.querySelector('[data-role="mobile-mod-source-type"]')?.parentElement;
                const numberControl = element.querySelector('[data-role="mobile-mod-source-number"]')?.parentElement;

                if (!dock || !body || !controls || !typeControl || !numberControl) {
                    throw new Error("Expected the integrated mobile Mod editor structure.");
                }

                const dockBounds = dock.getBoundingClientRect();
                const bodyBounds = body.getBoundingClientRect();
                const controlsBounds = controls.getBoundingClientRect();
                const readControl = (control) => {
                    const controlBounds = control.getBoundingClientRect();
                    const style = getComputedStyle(control);
                    return {
                        width: controlBounds.width,
                        height: controlBounds.height,
                        borderWidth: style.borderTopWidth,
                        borderRadius: parseFloat(style.borderTopLeftRadius),
                        backgroundColor: style.backgroundColor,
                    };
                };

                return {
                    clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    smallRadius: parseFloat(getComputedStyle(element).getPropertyValue("--cosimo-radius-sm")),
                    dockRightAligned: Math.abs(dockBounds.right - bounds.right) <= 1,
                    dockLoopsAboveFrame: dockBounds.top < bounds.top && dockBounds.bottom >= bounds.top,
                    bodyPrecedesControls: bodyBounds.bottom <= controlsBounds.top + 1,
                    typeControl: readControl(typeControl),
                    numberControl: readControl(numberControl),
                };
            });
            assert.equal(layout.scrollWidth <= layout.clientWidth + 1, true, `Source editor overflows at ${width}px.`);
            assert.equal(layout.documentScrollWidth <= width, true, `Document overflows at ${width}px.`);
            assert.equal(layout.dockRightAligned, true);
            assert.equal(layout.dockLoopsAboveFrame, true);
            assert.equal(layout.bodyPrecedesControls, true);
            assert.equal(layout.typeControl.borderWidth, "0px");
            assert.equal(layout.numberControl.borderWidth, "0px");
            assert.equal(layout.typeControl.borderRadius, layout.smallRadius);
            assert.equal(layout.numberControl.borderRadius, layout.smallRadius);
            assert.notEqual(layout.typeControl.backgroundColor, "rgba(0, 0, 0, 0)");
            assert.notEqual(layout.numberControl.backgroundColor, "rgba(0, 0, 0, 0)");
            assert.equal(layout.typeControl.height >= 24 && layout.typeControl.width <= 72, true);
            assert.equal(layout.numberControl.height >= 24 && layout.numberControl.width <= 40, true);

            // Universal Back lives in the preset bar's reserved left slot
            // (ADR-026), replacing the old full-width return bar.
            const back = page.locator('[data-action="shell-back"]');
            const backBounds = await back.boundingBox();
            assert.ok(backBounds);
            assert.equal(backBounds.width >= 32 && backBounds.height >= 32, true);
            assert.equal(backBounds.x >= 0 && backBounds.x <= 60, true);
        }

        await typeSelect.selectOption("envelope");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "env"
        ));
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3", "Amp"]);
        const envelopeSurface = frame.locator('[data-role="adsr-editor-surface"]');
        assert.equal(await envelopeSurface.count(), 1);
        assert.equal(await envelopeSurface.getAttribute("preserveAspectRatio"), "none");
        assert.deepEqual(
            await frame.locator('[data-role="mobile-mod-active-controls"] label > span').allTextContents(),
            ["Attack", "Decay", "Sustain", "Release"],
        );
        assert.equal(await frame.getByLabel("Envelope sustain value").inputValue(), "50%");
        await numberSelect.selectOption("4");
        assert.equal(await editorState.getAttribute("data-source-slot"), "4");
        assert.equal(await frame.getByLabel("Envelope sustain value").inputValue(), "100%");
        await numberSelect.selectOption("3");
        assert.equal(await editorState.getAttribute("data-source-slot"), "3");

        await typeSelect.selectOption("macro");
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3", "4"]);
        assert.equal(/\bmacro 1\b/i.test(await frame.innerText()), false, "The selector must be the only source title.");

        await typeSelect.selectOption("mseg");
        await numberSelect.selectOption("2");
        assert.equal(await editorState.getAttribute("data-source-kind"), "mseg");
        assert.equal(await editorState.getAttribute("data-source-slot"), "2");
        assert.equal(await frame.getByRole("button", { name: "Open MSEG editor" }).count(), 1);
    } finally {
        await page.close();
    }
});

test("mobile Mod MAPPINGS is a complete table with row editing, filters, and inline creation", async () => {
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
            routes: [
                { id: "mobile-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "bipolar", targetKind: "lane.flanger#1.flangerDepth", amount: -0.39, reducer: "max" },
                { id: "mobile-route-2", enabled: true, sourceKind: "macro", sourceSlot: 1, polarity: "unipolar", targetKind: "oscA.wavetablePosition", amount: 0.2, reducer: "max" },
                { id: "mobile-route-3", enabled: false, sourceKind: "env", sourceSlot: 2, polarity: "unipolar", targetKind: "filterCutoffOctaves", amount: 1.5, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes?.length === 3;
        });
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');

        // T14: entry shows EVERY mapping — no hidden filter, no blind scroll.
        const panel = page.locator('[data-role="mod-mappings-panel"]');
        await panel.waitFor();
        assert.equal(await panel.locator('[data-role="mod-mappings-count"]').innerText(), "3");
        assert.equal(await panel.locator('[data-role="mod-mappings-row"]').count(), 3);
        assert.equal(
            await panel.locator('[data-role="mod-mappings-row"] [role="slider"]').count(),
            3,
            "Every rendered mapping row must expose an amount-editing slider.",
        );

        const geometry = await panel.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            rows: Array.from(element.querySelectorAll('[data-role="mod-mappings-row"]')).map((row) => {
                const bounds = row.getBoundingClientRect();
                return { left: bounds.left, right: bounds.right, height: bounds.height };
            }),
        }));
        assert.equal(geometry.scrollWidth <= geometry.clientWidth + 1, true);
        assert.equal(geometry.documentScrollWidth <= 393, true);
        assert.equal(geometry.rows.every((row) => row.left >= 0 && row.right <= 393 && row.height >= 44), true);

        // The MSEG row shows its relationship and carries a live mapped rail
        // (T15: the rail is the shared cell language, band and all).
        const msegRow = panel.locator('[data-role="mod-mappings-row"]', { hasText: "MSEG 1" });
        assert.match(await msegRow.innerText(), /MSEG 1[\s\S]*Flanger[\s\S]*Depth/);
        assert.equal(
            await msegRow.locator('[data-rail-state="mapped"]').count() >= 1,
            true,
            "The row rail must present this route's own band.",
        );

        // T15 exact editing: long-press the row rail into the ADR-017 menu,
        // type the amount, and the stored route follows.
        const railCell = msegRow.locator(".mobile-voice-cell").first();
        const cellBox = await railCell.boundingBox();
        assert.ok(cellBox);
        await page.mouse.move(cellBox.x + (cellBox.width / 2), cellBox.y + (cellBox.height / 2));
        await page.mouse.down();
        await page.locator('[data-role="rack-parameter-menu"]').waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
        await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
        const amountInput = page.locator('[data-role="rack-modulation-value-input"]');
        await amountInput.waitFor();
        await amountInput.fill("-25");
        await page.click('[data-role="rack-value-sheet-apply"]');
        await waitForHarnessSnapshot(
            page,
            "mobile exact route amount",
            (snapshot) => Math.abs(readStoredModulationState(snapshot).routes[0]?.amount - (-0.25)) < 0.0001,
        );

        // Filters: multi-select source narrows; the criteria chip removes.
        await panel.locator('[data-role="mod-mappings-filter-button"]').click();
        await panel.locator('[data-role="mod-mappings-filter-source-mseg-1"]').click();
        assert.equal(await panel.locator('[data-role="mod-mappings-row"]').count(), 1);
        assert.match(await panel.locator('[data-role="mod-mappings-count"]').innerText(), /1 of 3/);
        assert.equal(await panel.locator('[data-role="mod-mappings-criterion"]').count(), 1);
        await panel.locator('[data-role="mod-mappings-criterion"]').click();
        assert.equal(await panel.locator('[data-role="mod-mappings-row"]').count(), 3);

        // Inline creation: the draft row's pickers disable duplicates and a
        // confirmed create lands at exactly 0%.
        await panel.locator('[data-role="mod-mappings-add"]').click();
        await panel.locator('[data-role="mod-mappings-draft-source"]').selectOption("macro-2");
        assert.equal(
            await panel.locator('[data-role="mod-mappings-draft-target"] option[value="lane.reverb#1.reverbSize"]').isDisabled(),
            false,
        );
        await panel.locator('[data-role="mod-mappings-draft-target"]').selectOption("lane.reverb#1.reverbSize");
        await panel.locator('[data-role="mod-mappings-draft-create"]').click();
        await waitForHarnessSnapshot(
            page,
            "inline-created mobile route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "lane.reverb#1.reverbSize"
                && route.amount === 0
            )),
        );
        assert.equal(await panel.locator('[data-role="mod-mappings-count"]').innerText(), "4");

        // A duplicate draft cannot submit: the freshly created pair disables
        // its target option outright.
        await panel.locator('[data-role="mod-mappings-add"]').click();
        await panel.locator('[data-role="mod-mappings-draft-source"]').selectOption("macro-2");
        assert.equal(
            await panel.locator('[data-role="mod-mappings-draft-target"] option[value="lane.reverb#1.reverbSize"]').isDisabled(),
            true,
        );
    } finally {
        await page.close();
    }
});

test("T66: MAPPINGS edits MSEG Rate and oscillator Level route amounts without changing base values", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.clear();
                sessionStorage.clear();
            });
        },
    });
    const openExactValueEntry = async (control) => {
        const box = await control.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
        await page.mouse.down();
        await page.locator('[data-role="rack-parameter-menu"]').waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
        await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
        const amountInput = page.locator('[data-role="rack-modulation-value-input"]');
        await amountInput.waitFor();
        return amountInput;
    };

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mseg-rate-route", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "mseg2Rate", amount: 0, reducer: "max" },
                { id: "osc-level-route", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "oscA.ampGainDb", amount: 0, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("mseg2Rate", 0.625);
            harness.setParameterValue("oscAVolumeDb", -12);
            harness.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded MSEG Rate and oscillator Level mappings",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg2Rate) - 0.625) <= 1e-9
                && Math.abs(Number(snapshot.parameterValues.oscAVolumeDb) - -12) <= 1e-9
                && readStoredModulationState(snapshot).routes.length === 2,
        );
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');

        const rateRow = page.locator('[data-role="mod-mappings-row"][data-route-id="mseg-rate-route"]');
        await rateRow.waitFor();
        assert.equal(
            await rateRow.locator('[data-role="mod-mappings-amount-only"]').count(),
            0,
            "MSEG Rate has a live base endpoint and must use the normal base-plus-amount control.",
        );
        assert.notEqual((await rateRow.locator('[data-role="mod-mappings-base-val"]').innerText()).trim(), "");
        const rateControl = rateRow.locator(".mobile-voice-cell.is-readout");
        assert.equal(await rateControl.getAttribute("role"), "slider");

        await dragLocatorBy(page, rateControl, 0, -44);
        let snapshot = await waitForHarnessSnapshot(
            page,
            "MAPPINGS drag edits MSEG Rate route amount",
            (nextSnapshot) => Number(
                readStoredModulationState(nextSnapshot).routes.find((route) => route.id === "mseg-rate-route")?.amount,
            ) > 0.01,
        );
        assert.equal(Number(snapshot.parameterValues.mseg2Rate), 0.625);

        const amountInput = await openExactValueEntry(rateControl);
        await amountInput.fill("0.37 s");
        await page.click('[data-role="rack-value-sheet-apply"]');
        snapshot = await waitForHarnessSnapshot(
            page,
            "MAPPINGS exact entry edits MSEG Rate route amount",
            (nextSnapshot) => Math.abs(Number(
                readStoredModulationState(nextSnapshot).routes.find((route) => route.id === "mseg-rate-route")?.amount,
            ) - 0.37) < 0.0001,
        );
        assert.equal(Number(snapshot.parameterValues.mseg2Rate), 0.625);

        const levelRow = page.locator('[data-role="mod-mappings-row"][data-route-id="osc-level-route"]');
        await levelRow.waitFor();
        assert.equal(
            await levelRow.locator('[data-role="mod-mappings-amount-only"]').count(),
            0,
            "Oscillator Level has a live presented base and must use the normal base-plus-amount control.",
        );
        assert.match(await levelRow.locator('[data-role="mod-mappings-base-val"]').innerText(), /-12(?:\.0)? dB/);
        const levelControl = levelRow.locator(".mobile-voice-cell.is-readout");
        assert.equal(await levelControl.getAttribute("role"), "slider");
        await dragLocatorBy(page, levelControl, 0, -44);
        snapshot = await waitForHarnessSnapshot(
            page,
            "oscillator Level MAPPINGS drag edits route amount",
            (nextSnapshot) => Number(
                readStoredModulationState(nextSnapshot).routes.find((route) => route.id === "osc-level-route")?.amount,
            ) > 0.01,
        );
        assert.equal(Number(snapshot.parameterValues.oscAVolumeDb), -12);

        const levelAmountInput = await openExactValueEntry(levelControl);
        assert.equal(await page.locator('[data-role="rack-base-value-input"]').count(), 1);
        await levelAmountInput.fill("3 dB");
        await page.click('[data-role="rack-value-sheet-apply"]');
        snapshot = await waitForHarnessSnapshot(
            page,
            "oscillator Level MAPPINGS exact entry edits route amount",
            (nextSnapshot) => Math.abs(Number(
                readStoredModulationState(nextSnapshot).routes.find((route) => route.id === "osc-level-route")?.amount,
            ) - 3) < 0.0001,
        );
        assert.equal(Number(snapshot.parameterValues.oscAVolumeDb), -12);
    } finally {
        await page.close();
    }
});

test("T15: mapping rows read as LED meters with a live polarity toggle, one label, and even spacing", async () => {
    // The row already names source and target in its identity column, so the
    // readout drops the duplicated label and spends the reclaimed height on
    // the amount itself: a segmented LED band lit from the base tick, with
    // the canonical amount readout riding the lit end and the base value in
    // a small corner. The +/- marker is a REAL polarity toggle, and the
    // row's five columns sit on one even spacing unit.
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
            routes: [
                { id: "led-route-1", enabled: true, sourceKind: "env", sourceSlot: 2, polarity: "unipolar", targetKind: "filterCutoffOctaves", amount: 1.5, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const row = page.locator('[data-role="mod-mappings-row"][data-route-id="led-route-1"]');
        await row.waitFor();

        // One label per fact: the identity column names the target, so the
        // cell itself must not repeat it.
        const cell = row.locator(".mobile-voice-cell.is-readout");
        assert.equal(await cell.locator(".mobile-voice-cell-label").count(), 0, "The readout must not duplicate the target label.");
        assert.equal(/CUTOFF/i.test(await cell.innerText()), false);

        // The LED rail: segmented band lit between the base tick and the
        // amount edge, still speaking the shared rail-state contract.
        assert.equal(await cell.locator('.mod-led-rail[data-rail-state="mapped"]').count(), 1);
        assert.equal(await cell.locator(".mod-led-fill").count(), 1);
        assert.equal(await cell.locator(".mod-led-tick").count(), 1);
        const flag = cell.locator('[data-role="mod-mappings-amount-flag"]');
        assert.equal(await flag.innerText(), formatModulationAmountReadout("filterCutoffOctaves", 1.5, "unipolar"));
        assert.notEqual((await row.locator('[data-role="mod-mappings-base-val"]').innerText()).trim(), "");

        // The rail speaks the parameter's own display scale: 1000 Hz sits
        // logarithmically on the 20..20000 track (ln50/ln1000 = 0.566), and
        // the +1.5 oct amount travels 1.5/log2(1000) of the width — never
        // 1.5 raw Hz (the invisible-band bug).
        const railGeometry = await cell.locator(".mod-led-rail").evaluate((rail) => {
            const width = rail.clientWidth;
            const tick = rail.querySelector(".mod-led-tick");
            const fill = rail.querySelector(".mod-led-fill");
            return {
                tick: tick.offsetLeft / width,
                fillLow: fill.offsetLeft / width,
                fillHigh: (fill.offsetLeft + fill.offsetWidth) / width,
            };
        });
        const expectedBase = Math.log(1000 / 20) / Math.log(20000 / 20);
        const expectedHigh = expectedBase + (1.5 / Math.log2(1000));
        assert.ok(Math.abs(railGeometry.tick - expectedBase) < 0.02, JSON.stringify(railGeometry));
        assert.ok(Math.abs(railGeometry.fillLow - expectedBase) < 0.02, JSON.stringify(railGeometry));
        assert.ok(Math.abs(railGeometry.fillHigh - expectedHigh) < 0.02, JSON.stringify(railGeometry));

        // The polarity marker is a WORKING toggle: tap flips the stored
        // route between unipolar and bipolar and the readout follows.
        const polarity = row.locator("button[data-role^='mod-mappings-polarity-']");
        assert.equal(await polarity.innerText(), "+");
        await polarity.click();
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes[0]?.polarity === "bipolar";
        });
        assert.equal(await polarity.innerText(), "\u00b1");
        assert.equal(await flag.innerText(), formatModulationAmountReadout("filterCutoffOctaves", 1.5, "bipolar"));
        await polarity.click();
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes[0]?.polarity === "unipolar";
        });
        assert.equal(await polarity.innerText(), "+");

        // Intentional even spacing: every horizontal seam between the row's
        // five columns is the same one unit.
        const gaps = await row.evaluate((element) => {
            const rects = Array.from(element.children).map((child) => child.getBoundingClientRect());
            const seams = [];
            for (let index = 1; index < rects.length; index += 1) {
                seams.push(rects[index].left - rects[index - 1].right);
            }
            return seams;
        });
        assert.equal(gaps.length, 4);
        for (const gap of gaps) {
            assert.ok(Math.abs(gap - gaps[0]) <= 0.5, `Uneven row seam: ${JSON.stringify(gaps)}`);
        }
    } finally {
        await page.close();
    }
});

test("a stored pool-instance route renders instance-labeled with its own base, and the picker speaks the per-document domain", async () => {
    // T6 device instances: `lane.delay#2.delayMix` names a real document
    // slot, so its row carries the SAME live base rail as instance #1 —
    // the base contract is the type's; the edited slot is the instance's.
    // (A route whose instance is absent from the document edits nothing
    // durable: the store refuses the write and the field send lands on an
    // idle engine slot.) The create picker offers the DOCUMENT's devices —
    // no delay#2 lives in this default patch, so its kind is not offered.
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
            routes: [
                { id: "pool-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.delay#2.delayMix", amount: 0.4, reducer: "max" },
                { id: "resident-route-1", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.delay#1.delayMix", amount: 0.25, reducer: "max" },
            ],
        });
        assert.equal(seededState.routes.length, 2, "both lane kinds must survive normalization");
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');

        // The pool row: numbered category, mirror parameter label, and the
        // same live base rail every instance gets since T6.
        const poolRow = page.locator('[data-role="mod-mappings-row"][data-route-id="pool-route-1"]');
        await poolRow.waitFor();
        assert.equal(
            (await poolRow.locator(".mod-mappings-row-target").textContent()).replace(/\s+/g, " ").trim(),
            "Delay 2 Mix",
        );
        assert.equal(await poolRow.locator(".mod-mappings-row-target strong").textContent(), "Delay 2");
        assert.equal(
            await poolRow.locator('[data-role="mod-mappings-amount-only"]').count(),
            0,
            "an instance route's base is addressable since T6 — no amount-only fallback",
        );
        assert.equal(await poolRow.locator(".mod-led-rail").count(), 1);

        // The resident row keeps today's un-numbered label and its live rail.
        const residentRow = page.locator('[data-role="mod-mappings-row"][data-route-id="resident-route-1"]');
        assert.equal(
            (await residentRow.locator(".mod-mappings-row-target").textContent()).replace(/\s+/g, " ").trim(),
            "Delay Mix",
        );
        assert.equal(await residentRow.locator(".mod-led-rail").count(), 1);

        // Route mutations remain independent of the base binding: the
        // polarity toggle writes the stored route.
        await poolRow.locator("button[data-role^='mod-mappings-polarity-']").click();
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes.find((route) => route.id === "pool-route-1")?.polarity === "bipolar";
        });

        // The draft picker speaks the per-DOCUMENT domain: the resident kind
        // is offered, and delay#2's is not because this patch has no delay#2
        // device (add one on the map and it would appear).
        await page.locator('[data-role="mod-mappings-add"]').click();
        const draftTarget = page.locator('[data-role="mod-mappings-draft-target"]');
        assert.equal(await draftTarget.locator('option[value="lane.delay#1.delayMix"]').count(), 1);
        assert.equal(await draftTarget.locator('option[value="lane.delay#2.delayMix"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("T15: base drags on log-scale rows walk the display scale, matching the knobs' settled rule", async () => {
    // Cutoff and resonance felt "sigmoid" on rows: the drag moved the value
    // linearly in raw Hz while the tick sat on a log track, so the musical
    // range lived in the first pixels and the top went numb. The base axis
    // must walk the DISPLAY scale — equal finger travel = equal octaves,
    // finger and tick in lockstep — exactly as rack-parameter-knob resolved
    // this same argument for the knobs.
    const { PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE } = await loadUIModule(
        path.resolve(import.meta.dirname, ".."),
        "ui/shared/parameter-gesture.ts",
    );
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
            routes: [
                { id: "log-drag-route", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "filterCutoffOctaves", amount: 0, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const row = page.locator('[data-role="mod-mappings-row"][data-route-id="log-drag-route"]');
        await row.waitFor();
        const cell = row.locator(".mobile-voice-cell.is-readout");
        const cellBox = await cell.boundingBox();
        assert.ok(cellBox);

        await clearHarnessDebugLog(page);
        const startX = cellBox.x + (cellBox.width / 2);
        const startY = cellBox.y + (cellBox.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // The first move classifies the horizontal axis and applies nothing;
        // the eight 5px moves after it are the applied 40px of travel.
        await page.mouse.move(startX + 6, startY);
        for (let step = 1; step <= 8; step += 1) {
            await page.mouse.move(startX + 6 + (step * 5), startY);
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-row"] .mobile-voice-cell[data-dragging="base"]') !== null
        ));
        assert.match(
            await cell.locator(".mod-led-base-val").evaluate((element) => getComputedStyle(element).textShadow),
            /12px/,
            "Base editing must strengthen the owning-color value glow.",
        );
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(page, "log base drag writes", (nextSnapshot) => (
            nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff")
        ));
        const writes = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "filterCutoff");
        const finalValue = Number(writes[writes.length - 1].value);
        // 40px of a 220px-per-full-range drag on a log 20..20000 track from
        // 1000 Hz: 1000 * 1000^(40/220) ≈ 3511 Hz. The old raw-Hz walk would
        // land near 1000 + 19980*(40/220) ≈ 4633 Hz.
        const expected = 1000 * ((20000 / 20) ** (40 / PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE));
        assert.ok(
            Math.abs(finalValue - expected) / expected < 0.02,
            `Expected ~${expected.toFixed(0)} Hz (display-scale walk), got ${finalValue}`,
        );
    } finally {
        await page.close();
    }
});

test("T15: resonance amount drags walk the modulated value along the dial (effective-value), like the knobs", async () => {
    // Resonance's base (0.707) rests by the bottom of a log 0.1..20 domain:
    // a linear amount-domain drag crams all the audible travel into a few
    // pixels — the exact case the knobs resolved with modulationDragStyle
    // "effective-value". The row rail must obey the same descriptor rule:
    // vertical travel walks base+amount along the dial at base-drag speed,
    // and the amount is derived storage.
    const { PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE } = await loadUIModule(
        path.resolve(import.meta.dirname, ".."),
        "ui/shared/parameter-gesture.ts",
    );
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
            routes: [
                { id: "reso-route", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "filterQ", amount: 0, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const row = page.locator('[data-role="mod-mappings-row"][data-route-id="reso-route"]');
        await row.waitFor();
        const cell = row.locator(".mobile-voice-cell.is-readout");
        const cellBox = await cell.boundingBox();
        assert.ok(cellBox);

        await clearHarnessDebugLog(page);
        const startX = cellBox.x + (cellBox.width / 2);
        const startY = cellBox.y + (cellBox.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // First move classifies the vertical axis (consumed); the eight 5px
        // moves after it are the applied 40px of upward travel.
        await page.mouse.move(startX, startY - 6);
        for (let step = 1; step <= 8; step += 1) {
            await page.mouse.move(startX, startY - 6 - (step * 5));
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-row"] .mobile-voice-cell[data-dragging="modulation"]') !== null
        ));
        assert.notEqual(
            await cell.evaluate((element) => getComputedStyle(element).backgroundImage),
            "none",
            "Modulation editing must paint source-colored cell feedback.",
        );
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(page, "resonance amount drag stored", (nextSnapshot) => (
            Math.abs(readStoredModulationState(nextSnapshot).routes[0]?.amount ?? 0) > 0.0001
        ));
        const storedAmount = readStoredModulationState(snapshot).routes[0].amount;
        // Dial walk from base 0.707 (amount 0): 40px of a 220px-per-range
        // drag up a log 0.1..20 dial lands the modulated value at
        // 0.1 * 200^(normalize(0.707) + 40/220), and the amount is that
        // value minus the base — ~1.15 Q. The old linear amount-domain walk
        // would store ~4.4 Q (40/360 of the ±19.9 span).
        const startNormalized = Math.log(0.707107 / 0.1) / Math.log(20 / 0.1);
        const effective = 0.1 * ((20 / 0.1) ** (startNormalized + (40 / PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE)));
        const expected = effective - 0.707107;
        assert.ok(
            Math.abs(storedAmount - expected) / expected < 0.03,
            `Expected ~${expected.toFixed(3)} Q (dial walk), got ${storedAmount}`,
        );
    } finally {
        await page.close();
    }
});

test("T15: a horizontal base drag on a mapping row writes finite values for stepless parameters", async () => {
    // Continuous parameters record entrySpec.step 0 ("no quantization"). The
    // row rail's base axis must treat that as UNSNAPPED — never divide by the
    // zero step (the device bug: every drag frame sent NaN and the engine
    // toasted "must be a finite number" per frame).
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
            routes: [
                { id: "stepless-route", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.flanger#1.flangerDepth", amount: 0.2, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const row = page.locator('[data-role="mod-mappings-row"][data-route-id="stepless-route"]');
        await row.waitFor();
        const cell = row.locator(".mobile-voice-cell.is-readout");
        const cellBox = await cell.boundingBox();
        assert.ok(cellBox);

        await clearHarnessDebugLog(page);
        const startX = cellBox.x + (cellBox.width / 2);
        const startY = cellBox.y + (cellBox.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        for (let step = 1; step <= 10; step += 1) {
            await page.mouse.move(startX + (step * 5), startY);
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-row"] .mobile-voice-cell[data-dragging="base"]') !== null
        ));
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(page, "stepless base drag writes", (nextSnapshot) => (
            nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "flangerDepth"))
        ));
        const driveWrites = snapshot.sentMessages.filter((message) => isLaneParamSend(message, "flangerDepth"));
        assert.ok(driveWrites.length >= 1);
        for (const write of driveWrites) {
            assert.ok(
                Number.isFinite(Number(write.value.value)),
                `Base drag sent a non-finite value: ${JSON.stringify(write)}`,
            );
        }
        assert.equal(await page.locator('[data-role="synth-feedback-toast"]').count(), 0);
    } finally {
        await page.close();
    }
});

test("mobile Mod creates, reloads, edits, and deletes more than 100 mappings without a public route ceiling", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const targets = [
            "oscA.wavetablePosition",
            "oscA.warpAmount",
            "filterCutoffOctaves",
            "filterQ",
            "oscA.pitchSemitones",
            "oscA.ampGainDb",
            "oscA.pan",
            "oscA.unisonDetune",
            "oscA.unisonBlend",
            "oscA.unisonWidth",
            "oscA.unisonWavetablePositionSpread",
            "oscA.unisonWarpSpread",
        ];
        const sources = [
            ["mseg", 1], ["mseg", 2], ["mseg", 3],
            ["env", 1], ["env", 2], ["env", 3],
            ["velocity", null], ["pressure", null], ["slide", null],
        ];
        const routes = [];
        for (const [sourceKind, sourceSlot] of sources) {
            for (const targetKind of targets) {
                routes.push({
                    id: `large-${sourceKind}-${sourceSlot ?? "fixed"}-${targetKind}`,
                    enabled: true,
                    sourceKind,
                    sourceSlot,
                    polarity: "unipolar",
                    targetKind,
                    amount: 0,
                    reducer: "max",
                });
            }
        }
        const seededState = normalizeModulationState({ routes: routes.slice(0, 101) });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const panel = page.locator('[data-role="mod-mappings-panel"]');
        await panel.waitFor();
        assert.equal(await panel.locator('[data-role="mod-mappings-add"]').isDisabled(), false);
        assert.equal(await panel.locator('[data-role="mod-mappings-count"]').innerText(), "101");

        await clearHarnessDebugLog(page);
        await panel.locator('[data-role="mod-mappings-add"]').click();
        await panel.locator('[data-role="mod-mappings-draft-source"]').selectOption("slide");
        await panel.locator('[data-role="mod-mappings-draft-target"]').selectOption("oscA.ampGainDb");
        await panel.locator('[data-role="mod-mappings-draft-create"]').click();
        let snapshot = await waitForHarnessSnapshot(page, "102nd explicit mobile mapping", (nextSnapshot) => (
            readStoredModulationState(nextSnapshot).routes.length === 102
        ));
        const after = readStoredModulationState(snapshot).routes;
        assert.equal(after.length, 102);
        assert.equal(new Set(after.map((route) => `${route.sourceKind}:${route.sourceSlot}->${route.targetKind}`)).size, 102);
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationProgram" && Number(value?.voiceRouteCount) === 102
        )), true);

        const createdRoute = after[101];
        assert.ok(createdRoute);
        await page.addInitScript((persistedState) => {
            window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                storedState: { "modulation.v6": JSON.stringify(persistedState) },
            };
        }, readStoredModulationState(snapshot));
        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.locator('[data-role="mod-mappings-panel"]').waitFor();
        await page.waitForFunction((routeId) => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            if (rawState === undefined) return false;
            const state = JSON.parse(String(rawState));
            return state.routes?.length === 102 && state.routes.some((route) => route.id === routeId);
        }, createdRoute.id);
        assert.equal(await page.locator('[data-role="mod-mappings-count"]').innerText(), "102");

        // T15: edit the restored route ON ITS ROW — long-press into the menu
        // and type the amount exactly.
        const createdRow = page.locator(`[data-role="mod-mappings-row"][data-route-id="${createdRoute.id}"]`);
        await createdRow.scrollIntoViewIfNeeded();
        await clearHarnessDebugLog(page);
        const railCell = createdRow.locator(".mobile-voice-cell").first();
        // content-visibility rows paint a beat after a programmatic scroll:
        // wait until the cell is actually hit-testable before pressing.
        await page.waitForFunction((routeId) => {
            const cell = document
                .querySelector(`[data-role="mod-mappings-row"][data-route-id="${routeId}"]`)
                ?.querySelector(".mobile-voice-cell");
            if (!cell) return false;
            const rect = cell.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
            return hit !== null && cell.contains(hit);
        }, createdRoute.id);
        const cellBox = await railCell.boundingBox();
        assert.ok(cellBox);
        await page.mouse.move(cellBox.x + (cellBox.width / 2), cellBox.y + (cellBox.height / 2));
        await page.mouse.down();
        await page.locator('[data-role="rack-parameter-menu"]').waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
        await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
        const amountInput = page.locator('[data-role="rack-modulation-value-input"]');
        await amountInput.waitFor();
        await amountInput.fill("-12");
        await page.click('[data-role="rack-value-sheet-apply"]');
        snapshot = await waitForHarnessSnapshot(page, "editing the restored 102nd mapping", (nextSnapshot) => (
            Math.abs(Number(readStoredModulationState(nextSnapshot).routes[101]?.amount) - (-12)) <= 1e-9
        ));
        assert.equal(hasRuntimeAmount(snapshot, readStoredModulationState(snapshot).routes[101], -12), true);

        await createdRow.locator("button[data-role^='mod-mappings-delete-']").click();
        snapshot = await waitForHarnessSnapshot(page, "deleting the restored 102nd mapping", (nextSnapshot) => {
            const nextRoutes = readStoredModulationState(nextSnapshot).routes;
            return nextRoutes.length === 101 && !nextRoutes.some((route) => route.id === createdRoute.id);
        });
        assert.equal(latestRuntimeProgram(snapshot)?.voiceRouteCount, 101);
    } finally {
        await page.close();
    }
});

test("phone touch drags are captured by rack grips and modulation chips without scrolling the interface", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });
    const cdp = await page.context().newCDPSession(page);
    const touchDrag = async (from, to, { holdBeforeMoveMs = 0 } = {}) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: from.x, y: from.y, radiusX: 6, radiusY: 6, force: 1 }],
        });
        if (holdBeforeMoveMs > 0) {
            await page.waitForTimeout(holdBeforeMoveMs);
        }
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: from.x + ((to.x - from.x) * progress),
                    y: from.y + ((to.y - from.y) * progress),
                    radiusX: 6,
                    radiusY: 6,
                    force: 1,
                }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await clearHarnessDebugLog(page);
        const initialScroll = await page.evaluate(() => ({
            windowY: window.scrollY,
            documentY: document.documentElement.scrollTop,
        }));

        const graph = page.locator('[data-role="rack-module-list"]');
        await graph.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event("scroll"));
        });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="rack-module-list"]');
            return element instanceof HTMLElement
                && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        });
        const gripBox = await page.locator('[data-role="rack-station-reverb"]').boundingBox();
        const delayBox = await page.locator('[data-role="rack-module-delay"]').boundingBox();
        assert.ok(gripBox && delayBox);
        const reorderTargetsAreReachable = await page.evaluate(() => {
            const graph = document.querySelector('[data-role="rack-module-list"]');
            const reverb = document.querySelector('[data-role="rack-station-reverb"]');
            const delay = document.querySelector('[data-role="rack-module-delay"]');
            if (!(graph instanceof HTMLElement) || !(reverb instanceof HTMLElement)
                    || !(delay instanceof HTMLElement)) return false;
            const graphRect = graph.getBoundingClientRect();
            return [reverb, delay].every((target) => {
                const rect = target.getBoundingClientRect();
                const hit = document.elementFromPoint(
                    rect.left + (rect.width / 2),
                    rect.top + (rect.height / 2),
                );
                return rect.top >= graphRect.top && rect.bottom <= graphRect.bottom
                    && hit !== null && target.contains(hit);
            });
        });
        assert.equal(reorderTargetsAreReachable, true,
            "the touch reorder endpoints must both be visible and own their hit points");
        await touchDrag(
            { x: gripBox.x + gripBox.width / 2, y: gripBox.y + gripBox.height / 2 },
            { x: delayBox.x + delayBox.width / 2, y: delayBox.y + delayBox.height / 2 },
            { holdBeforeMoveMs: 210 },
        );
        let snapshot = await waitForHarnessSnapshot(
            page,
            "touch rack reorder",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneTopology"
                && Array.isArray(value?.slotIds)
                && Number(value.slotIds[6]) === 7
                && Number(value.slotIds[7]) === 6
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length, 1);

        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        const sourceBox = await page.locator('[data-role="rack-mod-source-env-1"]').boundingBox();
        const targetBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(sourceBox && targetBox);
        await touchDrag(
            { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 },
            touchPointForModSourcePreviewTarget(
                { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 },
                { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 },
                375,
                667,
            ),
        );
        snapshot = await waitForHarnessSnapshot(
            page,
            "touch rack modulation drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        assert.deepEqual(await page.evaluate(() => ({
            windowY: window.scrollY,
            documentY: document.documentElement.scrollTop,
        })), initialScroll);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("rack reorder survives a platform pointer-capture rejection", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="rack-module-list"]');
        await clearHarnessDebugLog(page);

        await beginRackReorderWithoutPointerCapture(page, { pointerId: 92, targetEffectID: "filter" });
        await endRackReorderWithoutPointerCapture(page, 92);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "pointer-capture fallback rack reorder",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneTopology"
                && Array.isArray(value?.slotIds)
                && Number(value.slotIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length, 1);
    } finally {
        await page.close();
    }
});

test("rack reorder keeps the latest desired enable state across an older effective readback", async () => {
    const page = await openHarnessPage();

    try {
        await toggleRackEffectEnabled(page, "chorus");
        await page.waitForFunction(() => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["lane.v1"];
            if (rawState === undefined) {
                return false;
            }
            const doc = JSON.parse(String(rawState));
            return doc.chain.find((node) => node.deviceId === "chorus#1")?.enabled === true;
        });
        await clearHarnessDebugLog(page);

        await beginRackReorderWithoutPointerCapture(page, { pointerId: 93, targetEffectID: "filter" });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
        ), null, { timeout: 1_000 });
        await page.evaluate(() => {
            const identityChainCode = [0, 1, 2, 3, 4, 5, 6, 7].reduce(
                (code, moduleId, position) => code | (moduleId << (position * 3)),
                0,
            );
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveRackState", {
                laneCommittedChainLength: 8,
                laneCommittedChainCode: identityChainCode,
                laneCommittedPositionMask: 0,
                laneCommittedGeneration: 0,
                laneRejectedUploadCount: 0,
                laneParamsAcknowledgedSerial: 0,
            });
        });
        await endRackReorderWithoutPointerCapture(page, 93);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack reorder after stale effective readback",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["lane.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const state = JSON.parse(String(rawState));
                return state.chain?.[0]?.deviceId === "reverb#1";
            },
        );
        const storedRack = JSON.parse(String(snapshot.storedState["lane.v1"]));
        assert.equal(storedRack.chain.find((node) => node.deviceId === "chorus#1").enabled, true);
        const lastTopology = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").at(-1);
        const chorusPosition = lastTopology?.value?.slotIds?.indexOf(3);
        assert.ok(chorusPosition >= 0);
        assert.equal((Number(lastTopology?.value?.enabledMask) >> chorusPosition) & 1, 1);
    } finally {
        await page.close();
    }
});

test("rack no-op release adopts authoritative stored order received during the gesture", async () => {
    const page = await openHarnessPage();

    try {
        const authoritativeLane = {
            ...JSON.parse(legacyEightLaneDocJson()),
            chain: [
                "reverb#1",
                "globalFilter#1",
                "distortion#1",
                "ott#1",
                "chorus#1",
                "flanger#1",
                "phaser#1",
                "delay#1",
            ].map((deviceId) => ({
                kind: "device",
                deviceId,
                enabled: deviceId === "chorus#1",
            })),
        };
        const authoritativeLaneJson = JSON.stringify(authoritativeLane);
        await clearHarnessDebugLog(page);
        await beginRackReorderWithoutPointerCapture(page, { pointerId: 94 });
        await page.waitForSelector(".subway-station-row.is-reordering");
        await page.evaluate((serialized) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("lane.v1", serialized);
        }, authoritativeLaneJson);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-chorus"]')?.getAttribute("data-enabled") === "true"
            && document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
            && document.querySelector(".subway-station-row.is-reordering") === null
        ));
        // A structurally different authoritative document makes the held
        // preview inexact, so it cancels immediately and adopts that document.
        // The eventual release must remain inert.
        await endRackReorderWithoutPointerCapture(page, 94);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneTopology"), false);
        // The release was a no-op: storage keeps the accepted complete
        // current document verbatim and no compatibility rewrite occurs.
        assert.equal(String(snapshot.storedState["lane.v1"]), authoritativeLaneJson);
        const storedRack = JSON.parse(String(snapshot.storedState["lane.v1"]));
        assert.equal(storedRack.version, 2);
        assert.equal(storedRack.chain[0].deviceId, "reverb#1");
        assert.equal(storedRack.chain.find(({ deviceId }) => deviceId === "chorus#1").enabled, true);
        assert.equal(storedRack.devices["chorus#1"].params.chorusOutputTrimDb, 0);
    } finally {
        await page.close();
    }
});

test("mobile FX subpage keeps eight readable stations on the line and confines modulation controls to the editor", async () => {
    for (const width of [320, 375, 390, 430]) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize({ width, height: 667 }),
        });

        try {
            await page.click('[data-role="mobile-workspace-tab-fx"]');
            await page.waitForSelector('[data-role="mobile-effects-region"] [data-role="effects-rack-card"]');

            const layout = await page.evaluate(() => {
                const rectOf = (element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                };
                const units = Array.from(document.querySelectorAll("[data-rack-position]"));
                const list = document.querySelector(".rack-list");
                const editor = document.querySelector(".rack-effect-editor");
                const amount = document.querySelector(".rack-mod-amount, [data-role=\"rack-unmapped-pair\"]");
                const stations = Array.from(document.querySelectorAll(".subway-station"));
                const perEffectRanges = Array.from(document.querySelectorAll(
                    '[data-role="effects-rack-card"] input[type="range"]',
                )).filter((range) => range.getAttribute("data-role") !== "rack-lane-mix-slider");

                if (!(list instanceof HTMLElement)
                    || !(editor instanceof HTMLElement)) {
                    return null;
                }

                return {
                    viewportWidth: window.innerWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    unitCount: units.length,
                    list: rectOf(list),
                    editor: rectOf(editor),
                    amount: amount instanceof HTMLElement ? rectOf(amount) : null,
                    stationCount: stations.length,
                    perEffectRangesAreVisuallyHidden: perEffectRanges.every((range) => {
                        const style = getComputedStyle(range);
                        return style.position === "absolute"
                            && (style.clip !== "auto" || style.clipPath !== "none")
                            && Number.parseFloat(style.width) <= 1
                            && Number.parseFloat(style.height) <= 1;
                    }),
                };
            });

            assert.ok(layout, `Expected subway-map rack layout at ${width}px.`);
            assert.equal(layout.unitCount, 8, `Expected eight station rows at ${width}px.`);
            assert.equal(layout.stationCount, 8, `Expected eight station controls at ${width}px.`);
            assert.equal(layout.documentScrollWidth <= layout.viewportWidth, true, `Horizontal overflow at ${width}px.`);
            if (layout.amount) {
                assert.equal(layout.amount.left >= layout.editor.left - 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.right <= layout.editor.right + 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.left >= layout.list.right - 0.5, true, `Amount control steals rack width at ${width}px.`);
            }
            assert.equal(layout.perEffectRangesAreVisuallyHidden, true,
                `Native per-effect ranges leaked visually at ${width}px.`);

            const footerBeforeScroll = await page.locator('[data-role="rack-fixed-footer"]').boundingBox();
            assert.ok(footerBeforeScroll);
            const stations = page.locator(".subway-station");
            const stationCount = await stations.count();
            for (let index = 0; index < stationCount; index += 1) {
                const station = stations.nth(index);
                await station.scrollIntoViewIfNeeded();
                const reachable = await station.evaluate((element) => {
                    const list = element.closest('[data-role="rack-module-list"]');
                    const footer = document.querySelector('[data-role="rack-fixed-footer"]');
                    const detail = element.querySelector(".subway-station-detail");
                    const label = element.querySelector(".subway-station-label");
                    if (!(list instanceof HTMLElement) || !(footer instanceof HTMLElement)
                            || !(detail instanceof HTMLElement) || !(label instanceof HTMLElement)) return null;
                    const stationRect = element.getBoundingClientRect();
                    const listRect = list.getBoundingClientRect();
                    const detailRect = detail.getBoundingClientRect();
                    const footerRect = footer.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                        stationRect.left + (stationRect.width / 2),
                        stationRect.top + (stationRect.height / 2),
                    );
                    return {
                        role: element.getAttribute("data-role"),
                        insideGraph: stationRect.left >= listRect.left - 0.5
                            && stationRect.right <= listRect.right + 0.5
                            && stationRect.top >= listRect.top - 0.5
                            && stationRect.bottom <= listRect.bottom + 0.5,
                        touchSized: stationRect.width >= 44 && stationRect.height >= 43.5,
                        ownsCenterHit: hit !== null && element.contains(hit),
                        readable: getComputedStyle(detail).whiteSpace === "nowrap"
                            && detailRect.width === 76
                            && detailRect.height === 32
                            && Number.parseFloat(getComputedStyle(label).fontSize) >= 13,
                        footer: {
                            x: footerRect.x,
                            y: footerRect.y,
                            width: footerRect.width,
                            height: footerRect.height,
                        },
                        windowY: window.scrollY,
                    };
                });
                assert.ok(reachable, `Station ${index + 1} must render at ${width}px.`);
                assert.equal(reachable.insideGraph, true,
                    `${reachable.role} must be reachable inside the scrolled graph at ${width}px.`);
                assert.equal(reachable.touchSized, true,
                    `${reachable.role} lost its touch floor at ${width}px.`);
                assert.equal(reachable.ownsCenterHit, true,
                    `${reachable.role} does not own its visible center hit at ${width}px.`);
                assert.equal(reachable.readable, true,
                    `${reachable.role} lost readable Variant C anatomy at ${width}px.`);
                assert.equal(Math.abs(reachable.footer.x - footerBeforeScroll.x) <= 0.5
                    && Math.abs(reachable.footer.y - footerBeforeScroll.y) <= 0.5
                    && Math.abs(reachable.footer.width - footerBeforeScroll.width) <= 0.5
                    && Math.abs(reachable.footer.height - footerBeforeScroll.height) <= 0.5, true,
                `The fixed footer moved while revealing ${reachable.role} at ${width}px.`);
                assert.equal(reachable.windowY, 0,
                    `Revealing ${reachable.role} must scroll the graph, not the phone page at ${width}px.`);
            }
            const graphScroll = await page.locator('[data-role="rack-module-list"]').evaluate((element) => ({
                top: element.scrollTop,
                maximum: element.scrollHeight - element.clientHeight,
            }));
            assert.equal(graphScroll.maximum > 0 && graphScroll.top > 0, true,
                `The eight stations must use the T73 graph scroller at ${width}px.`);
        } finally {
            await page.close();
        }
    }
});

test("the rack Resonance knob walks the modulated value along its dial instead of slamming the Q floor", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    const seedResonanceRoute = async () => {
        const state = normalizeModulationState({
            routes: [{
                id: "rack-res-dial-walk",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "lane.globalFilter#1.globalFilterResonance",
                amount: 0,
                reducer: "max",
            }],
        });
        await page.evaluate((nextState) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(nextState));
        }, state);
        await waitForHarnessSnapshot(
            page,
            "seeded rack resonance dial-walk route",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === "rack-res-dial-walk"
                && readStoredModulationState(snapshot).routes[0]?.amount === 0,
        );
    };
    const dragDown = async (deltaY, pointerId) => {
        const knob = page.locator('[data-role="rack-parameter-globalFilterResonance"]');
        await knob.waitFor();
        await dispatchRackKnobPointerEvents(knob, [
            { type: "pointerdown", pointerId, buttons: 1 },
            { type: "pointermove", pointerId, buttons: 1, deltaY: 8 },
            { type: "pointermove", pointerId, buttons: 1, deltaY },
            { type: "pointerup", pointerId, buttons: 0, deltaY },
        ]);
        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack resonance amount write",
            (nextSnapshot) => (readStoredModulationState(nextSnapshot).routes[0]?.amount ?? 0) < 0,
        );
        return readStoredModulationState(snapshot).routes[0].amount;
    };

    try {
        await seedResonanceRoute();
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "filter");
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);

        // Dial-walk: a short downward drag covers a small dial fraction and
        // must NOT bank huge dead amount past the audible Q floor (0.1).
        const shortDrag = await dragDown(40, 71);
        assert.ok(
            shortDrag > -0.55 && shortDrag < -0.02,
            `40px down must walk the dial gently, got amount ${shortDrag}`,
        );

        await seedResonanceRoute();
        const longDrag = await dragDown(200, 72);
        assert.ok(
            longDrag < shortDrag && longDrag >= -0.65,
            `200px down must approach the floor without banking dead amount, got ${longDrag} vs ${shortDrag}`,
        );
    } finally {
        await page.close();
    }
});

test("ADR-025 identity colors: owner color inside, source color outside, grey only for real off-states", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });
    const knobStyle = (selector, part) => page.locator(selector).evaluate((element, targetPart) => {
        const node = element.querySelector(targetPart);
        if (!node) {
            throw new Error(`Missing knob part ${targetPart}`);
        }
        const style = getComputedStyle(node);
        return { fill: style.fill, stroke: style.stroke };
    }, part);

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.waitFor();

        // Every effect boots bypassed, so the knob must START grey (row 9)…
        assert.equal(
            (await knobStyle('[data-role="rack-parameter-reverbSize"]', ".rack-knob-base-fill")).fill,
            "rgb(117, 128, 132)",
            "A bypassed effect's parameter must be grey before it is enabled.",
        );
        // …and take its owning color the moment the effect can affect sound.
        await page.click('[data-role="rack-editor-power"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"]')
                ?.getAttribute("data-route-effectiveness") === "active"
        ));

        // Row 1: the inside/base value carries the OWNING effect accent, not
        // the old neutral #d5dcde.
        assert.equal(
            (await knobStyle('[data-role="rack-parameter-reverbSize"]', ".rack-knob-base-fill")).fill,
            "rgb(225, 180, 86)",
            "The reverb knob's base value must use the reverb accent.",
        );

        // Row 2: the selected target's border brightens in the owning color.
        await knob.click();
        const selectedBorder = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').evaluate((element) => (
            getComputedStyle(element).borderTopColor
        ));
        const borderChannels = selectedBorder.startsWith("color(srgb")
            ? selectedBorder.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/).slice(1, 4).map((channel) => Math.round(Number(channel) * 255))
            : selectedBorder.match(/rgba?\((\d+), (\d+), (\d+)/).slice(1, 4).map(Number);
        assert.deepEqual(
            borderChannels,
            [225, 180, 86],
            `The selected target's border must use the owning accent, got ${selectedBorder}`,
        );

        // Row 4: armed-but-unmapped shows a DOTTED ring in the SOURCE color.
        await expandGlobalModRail(page);
        await armRackModSourceForRouting(page, '[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        assert.equal(
            (await knobStyle('[data-role="rack-parameter-reverbSize"]', ".rack-knob-mod-track.is-unmapped")).stroke,
            "rgb(204, 89, 210)",
            "The unmapped dotted ring must use the selected source's color.",
        );

        // Row 8: a bypassed route's ring is GREY and dashed, never source-colored.
        const seededState = normalizeModulationState({
            routes: [{
                id: "adr025-bypassed-route",
                enabled: false,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "lane.reverb#1.reverbSize",
                amount: 0.3,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded bypassed reverb route",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === "adr025-bypassed-route",
        );
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"] .rack-knob-mod-track.is-bypassed') !== null
        ));
        assert.equal(
            (await knobStyle('[data-role="rack-parameter-reverbSize"]', ".rack-knob-mod-track.is-bypassed")).stroke,
            "rgb(117, 128, 132)",
            "A bypassed mapping's ring must be grey, not source-colored.",
        );

        // Row 9: bypassing the owning effect again greys the WHOLE control.
        await page.click('[data-role="rack-editor-power"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-reverbSize"]')
                ?.getAttribute("data-route-effectiveness") === "effect-bypassed"
        ));
        assert.equal(
            (await knobStyle('[data-role="rack-parameter-reverbSize"]', ".rack-knob-base-fill")).fill,
            "rgb(117, 128, 132)",
            "A bypassed effect's parameter must lose its identity color entirely.",
        );
    } finally {
        await page.close();
    }
});

test("ADR-025 duplicate pairs are never droppable and failures raise the top toast", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });
    const readHaptics = () => page.evaluate(() => window.__rackHaptics.slice());
    const toastCount = () => page.locator('[data-role="synth-feedback-toast"]').count();

    try {
        const seededState = normalizeModulationState({
            routes: [{
                id: "adr025-duplicate-route",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "lane.reverb#1.reverbSize",
                amount: 0.2,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded duplicate-pair route",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === "adr025-duplicate-route",
        );
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        await surface.waitFor();
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);
        const targetCenter = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };

        await expandGlobalModRail(page);
        const chip = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const chipBox = await chip.boundingBox();
        assert.ok(chipBox);
        await page.mouse.move(chipBox.x + (chipBox.width / 2), chipBox.y + (chipBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(196, 420, { steps: 4 });
        await page.evaluate(() => { window.__rackHaptics.length = 0; });

        // The duplicate target never looks droppable.
        await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 4 });
        await page.waitForTimeout(120);
        assert.equal(
            (await surface.getAttribute("class")).includes("is-mod-hover"),
            false,
            "An already-mapped pair must never take the droppable highlight.",
        );
        assert.equal(
            (await readHaptics()).includes("light"),
            false,
            "Hovering a duplicate must not give the positive acquisition tick.",
        );
        assert.equal(await surface.getAttribute("data-drag-creation"), "existing");
        const greyed = await surface.evaluate((element) => getComputedStyle(element).filter);
        assert.ok(greyed.includes("grayscale"), `A duplicate target must grey out during the drag, got filter ${greyed}`);

        // Flyover shorter than 500ms stays silent.
        await page.mouse.move(196, 420, { steps: 3 });
        await page.waitForTimeout(700);
        assert.equal(await toastCount(), 0, "A quick flyover must not warn.");

        // Deliberate hover reports exactly once per target per drag.
        await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 3 });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="synth-feedback-toast"]')?.textContent === "DUPLICATE"
        ), undefined, { timeout: 2500 });
        assert.deepEqual(await readHaptics(), ["heavy"], "The duplicate warning is one deliberately noticeable buzz.");
        await page.waitForTimeout(700);
        assert.equal(
            (await readHaptics()).filter((style) => style === "heavy").length,
            1,
            "A duplicate target reports at most once per drag.",
        );

        // Releasing there changes nothing.
        await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 2 });
        await page.mouse.up();
        await page.waitForTimeout(150);
        const routesAfterDrop = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routesAfterDrop.length, 1, "Releasing on a duplicate must create nothing.");

        // Creation failure: land the drop in the same tick as a document
        // update that already contains the pair. The UI still believes the
        // pair is creatable (its props are one render behind), the bridge
        // refuses the duplicate commit, and the failure feedback must fire.
        await page.evaluate(() => { window.__rackHaptics.length = 0; });
        await collapseGlobalModRail(page);
        await selectRackEffect(page, "delay");
        const delayKnob = page.locator('[data-role="rack-parameter-surface-delayTime"]');
        await delayKnob.waitFor();
        const delayBox = await delayKnob.boundingBox();
        assert.ok(delayBox);
        await expandGlobalModRail(page);
        const failureDoc = JSON.stringify(normalizeModulationState({
            routes: [
                {
                    id: "adr025-duplicate-route",
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "unipolar",
                    targetKind: "lane.reverb#1.reverbSize",
                    amount: 0.2,
                    reducer: "max",
                },
                {
                    id: "adr025-raced-route",
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "unipolar",
                    targetKind: "lane.delay#1.delayTime",
                    amount: 0,
                    reducer: "max",
                },
            ],
        }));
        await page.evaluate(({ targetPoint, blockedDoc }) => {
            const chip = document.querySelector('[data-role="rack-mod-source-mseg-1"]');
            if (!(chip instanceof HTMLElement)) {
                throw new Error("Missing the mseg-1 chip.");
            }
            const fire = (type, x, y, buttons) => chip.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                pointerId: 77,
                pointerType: "mouse",
                isPrimary: true,
                button: 0,
                buttons,
                clientX: x,
                clientY: y,
            }));
            const chipBox = chip.getBoundingClientRect();
            fire("pointerdown", chipBox.left + (chipBox.width / 2), chipBox.top + (chipBox.height / 2), 1);
            fire("pointermove", chipBox.left + 50, chipBox.top - 40, 1);
            fire("pointermove", targetPoint.x, targetPoint.y, 1);
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", blockedDoc);
            fire("pointerup", targetPoint.x, targetPoint.y, 0);
        }, {
            targetPoint: { x: delayBox.x + (delayBox.width / 2), y: delayBox.y + (delayBox.height / 2) },
            blockedDoc: failureDoc,
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="synth-feedback-toast"]')?.textContent === "MAPPING NOT CREATED"
        ), undefined, { timeout: 3000 });
        assert.equal(
            (await readHaptics()).includes("rigid"),
            true,
            "A failed creation buzzes shorter/sharper than the duplicate warning.",
        );
        const routesAfterFailure = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routesAfterFailure.length, 2, "The raced document is exactly what remains.");
        assert.equal(
            await page.locator('[data-role="rack-parameter-surface-delayTime"]').getAttribute("data-creation-confirmed"),
            null,
            "A failed creation must not flash success.",
        );
    } finally {
        await page.close();
    }
});

test("ADR-025 journey: a confirmed drop flashes, ticks, and pulses; bypass and delete stay truthful end-to-end", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__rackHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__rackHaptics.push(style);
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.click('[data-role="rack-editor-power"]');
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        await surface.waitFor();
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);

        await expandGlobalModRail(page);
        const chip = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const chipBox = await chip.boundingBox();
        assert.ok(chipBox);
        await page.evaluate(() => { window.__rackHaptics.length = 0; });
        await page.mouse.move(chipBox.x + (chipBox.width / 2), chipBox.y + (chipBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(196, 420, { steps: 4 });
        await page.mouse.move(surfaceBox.x + (surfaceBox.width / 2), surfaceBox.y + (surfaceBox.height / 2), { steps: 4 });
        await page.mouse.up();

        // Authoritative confirmation: flash + rising checkmark + light tick,
        // the rail count pulses, and the matrix's new 0% row pulses too.
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-surface-reverbSize"]')
                ?.getAttribute("data-creation-confirmed") === "true"
        ), undefined, { timeout: 3000 });
        assert.equal(await page.locator('[data-role="rack-parameter-surface-reverbSize"] .rack-confirm-check').count(), 1);
        assert.equal((await page.evaluate(() => window.__rackHaptics.slice())).includes("light"), true);
        assert.equal(
            await page.locator('[data-role="mobile-global-mod-rail-route-count"][data-count-pulsing]').count(),
            1,
            "The rail's mapping count must pulse on confirmation.",
        );
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        assert.equal(
            await page.locator('[data-role="mod-mappings-row"].is-just-created').count(),
            1,
            "The new matrix row must pulse in the source color.",
        );
        const createdRoute = readStoredModulationState(await getHarnessSnapshot(page)).routes
            .find((route) => route.targetKind === "lane.reverb#1.reverbSize");
        assert.ok(createdRoute);
        assert.equal(createdRoute.amount, 0, "A confirmed creation starts at exactly 0%.");

        // The transient choreography settles into the truthful mapped-at-0%
        // state with no lingering flash.
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-surface-reverbSize"]')
                ?.getAttribute("data-creation-confirmed") === null
        ), undefined, { timeout: 3000 });
        assert.equal(await page.locator('[data-role="rack-parameter-surface-reverbSize"] .rack-confirm-check').count(), 0);

        // Bypass (ADR-025 amended for T15 rows): the mapping content dims as
        // one piece, the source art greys, and the UNLIT power light carries
        // the whole state — no BYPASSED text anywhere. The rail band still
        // takes the bypassed treatment and the count never changes.
        await collapseGlobalModRail(page);
        const countBefore = await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText();
        const row = page.locator('[data-role="mod-mappings-row"]');
        await row.waitFor();
        const power = row.locator("button[data-role^='mod-mappings-power-']");
        await power.click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-row"]')?.classList.contains("is-bypassed") === true
        ));
        assert.equal(
            (await row.innerText()).toUpperCase().includes("BYPASSED"),
            false,
            "No BYPASSED text: the unlit power light IS the state.",
        );
        const identityOpacity = Number(await row.locator(".mod-mappings-row-identity")
            .evaluate((element) => getComputedStyle(element).opacity));
        assert.ok(
            identityOpacity > 0.2 && identityOpacity < 0.6,
            `An off row's content must dim without disappearing (opacity ${identityOpacity}).`,
        );
        assert.match(
            await row.locator(".mobile-mod-source-art, .mobile-mod-fixed-source").first()
                .evaluate((element) => getComputedStyle(element).filter),
            /grayscale/,
            "The source art loses its family color while the mapping is off.",
        );
        assert.equal(await power.getAttribute("aria-pressed"), "false");
        assert.equal(
            await power.evaluate((element) => getComputedStyle(element).opacity),
            "1",
            "The power control never dims: it is how you leave the state.",
        );
        assert.equal(
            await row.locator('[data-rail-state="bypassed"]').count(),
            1,
            "The row rail's band must take the bypassed treatment.",
        );
        assert.equal(
            await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText(),
            countBefore,
            "Bypass never changes the mapping count.",
        );

        // Dimmed is not dead: touching a bypassed row's rail lifts the row
        // back to full emphasis for the duration of the gesture.
        const railCell = row.locator(".mobile-voice-cell.is-readout");
        const cellBox = await railCell.boundingBox();
        assert.ok(cellBox);
        await page.mouse.move(cellBox.x + (cellBox.width / 2), cellBox.y + (cellBox.height / 2));
        await page.mouse.down();
        for (let step = 1; step <= 6; step += 1) {
            await page.mouse.move(
                cellBox.x + (cellBox.width / 2),
                cellBox.y + (cellBox.height / 2) - (step * 4),
            );
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-row"] .mobile-voice-cell[data-dragging="modulation"]') !== null
        ));
        assert.equal(
            await row.locator(".mod-mappings-row-identity").evaluate((element) => getComputedStyle(element).opacity),
            "1",
            "A touched bypassed row lifts to full emphasis while editing.",
        );
        await page.mouse.up();

        // Delete lives ON the row (T15): no detail page, no confirmation,
        // no toast — the row and its count contribution simply go.
        await row.locator("button[data-role^='mod-mappings-delete-']").click();
        await page.waitForFunction(() => (
            document.querySelectorAll('[data-role="mod-mappings-row"]').length === 0
        ));
        assert.equal(await page.locator('[data-role="synth-feedback-toast"]').count(), 0);
        assert.equal(
            readStoredModulationState(await getHarnessSnapshot(page)).routes.length,
            0,
            "Deletion removes the route entirely.",
        );
    } finally {
        await page.close();
    }
});

test("T08A: the target claiming the drag shows an unmistakably stronger treatment than mere eligibility", async () => {
    // ADR-025 rows 12/13: every creatable target carries a thin source-colored
    // eligibility outline; the ONE target that has claimed the drop carries a
    // stronger source-colored capture treatment. Capture is sticky — one
    // target always holds the claim during mapping — so each target's
    // "eligible" baseline is read while the OTHER target holds capture. The
    // claims compare COMPUTED box-shadows: class presence alone is explicitly
    // insufficient (the shipped bug kept is-mod-hover while the eligibility
    // rule's higher specificity painted the very same thin outline).
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.cmaj_triggerHaptic = () => undefined;
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);
    // Treatments fade (T08 added a ~140ms transition): a raw read can catch a
    // mid-fade frame, so every read polls until two consecutive samples agree.
    const readShadow = async (locator) => {
        let previous = await locator.evaluate((element) => getComputedStyle(element).boxShadow);
        for (let attempt = 0; attempt < 30; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 90));
            const next = await locator.evaluate((element) => getComputedStyle(element).boxShadow);
            if (next === previous) {
                return next;
            }
            previous = next;
        }
        throw new Error("The treatment never settled.");
    };
    const waitForCapture = (hoveredRole, freedRole) => page.waitForFunction(([hovered, freed]) => (
        document.querySelector(`[data-role="${hovered}"]`)?.classList.contains("is-mod-hover") === true
        && document.querySelector(`[data-role="${freed}"]`)?.classList.contains("is-mod-hover") === false
    ), [hoveredRole, freedRole]);

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const sizeTarget = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const mixTarget = page.locator('[data-role="rack-parameter-surface-reverbMix"]');
        const sourceBox = await source.boundingBox();
        const sizeBox = await sizeTarget.boundingBox();
        const mixBox = await mixTarget.boundingBox();
        assert.ok(sourceBox && sizeBox && mixBox);
        const sourceCenter = { x: sourceBox.x + (sourceBox.width / 2), y: sourceBox.y + (sourceBox.height / 2) };
        const centerOf = (box) => ({ x: box.x + (box.width / 2), y: box.y + (box.height / 2) });
        const touchMoveTo = async (previewPoint) => {
            const finger = touchPointForModSourcePreviewTarget(sourceCenter, previewPoint, 393);
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...finger, radiusX: 8, radiusY: 8, force: 1 }],
            });
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceCenter, radiusX: 8, radiusY: 8, force: 1 }],
        });

        // Capture on MIX: read Size's thin eligibility baseline + Mix's
        // capture treatment.
        await touchMoveTo(centerOf(mixBox));
        await page.locator('[data-role="mobile-global-mod-source-ghost"]').waitFor({ state: "visible" });
        await waitForCapture("rack-parameter-surface-reverbMix", "rack-parameter-surface-reverbSize");
        const sizeEligibleShadow = await readShadow(sizeTarget);
        const mixHoveredShadow = await readShadow(mixTarget);
        assert.notEqual(sizeEligibleShadow, "none", "Eligibility must be visible during the drag.");

        // Capture on SIZE: its treatment must DIFFER from its eligibility
        // baseline, and Mix's eligibility baseline must differ from its
        // capture treatment.
        await touchMoveTo(centerOf(sizeBox));
        await waitForCapture("rack-parameter-surface-reverbSize", "rack-parameter-surface-reverbMix");
        const sizeHoveredShadow = await readShadow(sizeTarget);
        const mixEligibleShadow = await readShadow(mixTarget);
        assert.notEqual(
            sizeHoveredShadow,
            sizeEligibleShadow,
            "The target claiming the drop must render a stronger treatment than eligibility.",
        );
        assert.notEqual(mixHoveredShadow, mixEligibleShadow);

        // Leaving (capture transferring back) restores the thin outline.
        await touchMoveTo(centerOf(mixBox));
        await waitForCapture("rack-parameter-surface-reverbMix", "rack-parameter-surface-reverbSize");
        assert.equal(await readShadow(sizeTarget), sizeEligibleShadow, "Leaving must restore the thin eligibility outline.");

        // Drop on Mix to create the env-1 route, then drag again: the now-
        // EXISTING pair must never acquire the capture treatment.
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => {
            const state = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return JSON.stringify(state).includes("reverb");
        });
        const routes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routes.length >= 1, true, "The drop must have created the route.");

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceCenter, radiusX: 8, radiusY: 8, force: 1 }],
        });
        await touchMoveTo(centerOf(sizeBox));
        await waitForCapture("rack-parameter-surface-reverbSize", "rack-parameter-surface-reverbMix");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-parameter-surface-reverbMix"]')?.getAttribute("data-drag-creation") === "existing"
        ));
        const existingIdleShadow = await readShadow(mixTarget);
        await touchMoveTo(centerOf(mixBox));
        await page.waitForTimeout(250);
        assert.equal((await mixTarget.getAttribute("class")).includes("is-mod-hover"), false, "An existing pair must never capture.");
        assert.equal(
            await readShadow(mixTarget),
            existingIdleShadow,
            "Hovering an existing pair must not change its treatment.",
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => undefined);
        await page.close();
    }
});
