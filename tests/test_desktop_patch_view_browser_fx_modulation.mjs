import test from "node:test";
import assert from "node:assert/strict";

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
    expandGlobalModRail,
    collapseGlobalModRail,
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
} from "./helpers/desktop_patch_view_browser_suite.mjs";

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
        await editRackParameterValue(page, "distortion-drive-field", "18.5");
        await editRackParameterValue(page, "distortion-mix-field", "64");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "distortion parameter updates",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionMode"
                && Number(value) === 1
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionDriveDb"
                && Math.abs(Number(value) - 18.5) <= 1e-6
            )) && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "distortionWet"
                && Math.abs(Number(value) - 0.64) <= 1e-6
            )),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionMode"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionDriveDb"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "distortionWet"), true);
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

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb, 5);
        await page.locator('[data-role="distortion-drive-field"]').click({ button: "right" });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterListenerCounts.distortionDriveDb === 6
        ));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterListenerCounts.distortionDriveDb === 5
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterListenerCounts.distortionDriveDb, 5);
    } finally {
        await page.close();
    }
});

test("a second tap on the selected rack source deep-links Mod and Back restores the exact FX context", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.click();
        await source.click();

        assert.equal(
            await page.locator('[data-role="mobile-workspace-tab-mod"]').getAttribute("aria-selected"),
            "true",
        );
        const editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "mseg");
        assert.equal(await editor.getAttribute("data-source-slot"), "1");
        assert.match(
            (await page.locator('[data-role="mobile-mod-filter-token"]').innerText()).trim(),
            /MSEG 1\s*×/,
        );
        assert.equal(
            await page.locator('[data-role="mobile-mod-route-row"]').evaluateAll((rows) => (
                rows.every((row) => /MSEG 1/.test(row.textContent ?? ""))
            )),
            true,
        );

        await page.click('[data-action="shell-back"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-fx"]')?.getAttribute("aria-selected") === "true"
        ));
        assert.equal(await source.getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator('[data-role="rack-editor-drive"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("rack deep links open the exact Envelope and Macro editor slots without introducing LFOs", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);

        const envelope = page.locator('[data-role="rack-mod-source-env-1"]');
        await envelope.click();
        await envelope.click();
        let editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "env");
        assert.equal(await editor.getAttribute("data-source-slot"), "1");

        await page.click('[data-action="shell-back"]');
        await expandGlobalModRail(page);
        await page.click('[aria-label="Next modulation-source group"]');
        await page.waitForTimeout(300);
        const macro = page.locator('[data-role="rack-mod-source-macro-2"]');
        await macro.click();
        await macro.click();

        editor = page.locator('[data-role="mod-source-editor"]');
        assert.equal(await editor.getAttribute("data-source-kind"), "macro");
        assert.equal(await editor.getAttribute("data-source-slot"), "2");
        assert.equal(await page.locator('[data-role="macro-source-value-2"]').count(), 1);
        assert.equal(/\blfo\b/i.test(await page.locator('[data-role="mobile-workspace-panel-mod"]').innerText()), false);
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.82, true);
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
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
        assert.equal(await page.locator('[data-role="rack-parameter-hud"]').count(), 0);
        await page.mouse.move(centerX, centerY - 10, { steps: 3 });
        await page.waitForSelector('[data-role="rack-parameter-hud"]');
        assert.match(await page.locator('[data-role="rack-parameter-hud"]').innerText(), /BASE.*Size/i);
        assert.match(
            await page.locator('[data-role="rack-parameter-hud"]').evaluate((element) => getComputedStyle(element).fontFamily),
            /system-ui/,
        );
        const hudLayout = await page.locator('[data-role="rack-parameter-hud"]').evaluate((element) => {
            const hud = element.getBoundingClientRect();
            const knob = document.querySelector('[data-role="rack-parameter-reverbSize"]')?.getBoundingClientRect();
            const style = getComputedStyle(element);
            return knob ? {
                pointerEvents: style.pointerEvents,
                intersectsKnob: !(hud.right <= knob.left || hud.left >= knob.right || hud.bottom <= knob.top || hud.top >= knob.bottom),
                onScreen: hud.left >= 0 && hud.top >= 0 && hud.right <= window.innerWidth && hud.bottom <= window.innerHeight,
            } : null;
        });
        assert.ok(hudLayout);
        assert.equal(hudLayout.pointerEvents, "none");
        assert.equal(hudLayout.intersectsKnob, false, "The gesture HUD must not cover the active knob.");
        assert.equal(hudLayout.onScreen, true, "The gesture HUD must remain fully on screen.");

        await page.mouse.move(centerX, centerY - 34, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="rack-parameter-hud"]') === null);

        snapshot = await waitForHarnessSnapshot(
            page,
            "rack knob pointer gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
        );
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);

        const valueAfterRelease = Number(snapshot.parameterValues.reverbSize);
        await clearHarnessDebugLog(page);
        await page.mouse.move(centerX, centerY + 20, { steps: 6 });
        await page.mouse.move(centerX, centerY - 20, { steps: 6 });
        await page.waitForTimeout(60);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.reverbSize), valueAfterRelease);
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
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
        const moved = { x: start.x, y: start.y - 40 };
        await knob.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack knob touch move",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
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
        assert.equal(await page.locator('[data-role="rack-parameter-hud"]').count(), 0);
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "initial zero-depth reverb route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "mapped");
        assert.equal(await knob.locator(".rack-knob-route-presence").count(), 1);
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();
        assert.ok(box);
        const outerX = box.x + (box.width * 0.75);
        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(outerX, centerY);
        await page.mouse.down();
        await page.mouse.move(outerX + 38, centerY, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        const hud = page.locator('[data-role="rack-parameter-hud"]');
        assert.equal(await hud.getAttribute("data-mode"), "modulation");
        assert.match(await hud.innerText(), /MOD.*Size/i);
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "outer-ring route amount",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
                && route.amount > 0.01
            )),
        );
        const route = readStoredModulationState(snapshot).routes.find((candidate) => (
            candidate.sourceKind === "mseg"
            && candidate.sourceSlot === 1
            && candidate.targetKind === "rack.reverbSize"
        ));
        assert.ok(route);
        assert.equal(Number(snapshot.parameterValues.reverbSize), 0.5);
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
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: 0.35, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
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
        assert.equal(visual.trackStroke, "rgba(210, 220, 222, 0.42)");
        assert.equal(visual.innerFill, "rgb(213, 220, 222)");
        assert.equal(await mixKnob.getAttribute("aria-label"), "Mix");
        const badge = mixSurface.locator('[data-role="rack-route-count-distortionWet"]');
        assert.equal((await badge.textContent()).trim(), "1");
        assert.match(await badge.getAttribute("aria-label"), /1 modulation route target Mix/);
        assert.equal((await badge.getAttribute("class")).includes("is-solid"), true);
        assert.equal((await driveSurface.getAttribute("class")).includes("is-selected-target"), true);
        assert.equal(
            await driveSurface.evaluate((element) => getComputedStyle(element).borderColor),
            "rgba(223, 230, 232, 0.78)",
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
                { id: "mseg-mix", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: 0.2, reducer: "max" },
                { id: "env-mix", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.distortionWet", amount: -0.55, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("distortionWet", 0.6, true);
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const mix = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const readRing = () => mix.evaluate((element) => {
            const knob = element.querySelector('.rack-parameter-knob');
            const fill = element.querySelector('.rack-knob-mod-fill');
            return knob instanceof HTMLElement && fill instanceof SVGPathElement
                ? { color: knob.style.getPropertyValue("--rack-knob-mod-accent"), path: fill.getAttribute("d") }
                : null;
        });

        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const msegRing = await readRing();
        await page.click('[data-role="rack-mod-source-env-1"]');
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

test("an unmapped rack knob shows a neutral outer track and horizontal drag cannot create a route", async () => {
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);
        knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "unmapped");
        assert.equal(await knob.locator(".rack-knob-mod-track.is-unmapped").count(), 1);
        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await clearHarnessDebugLog(page);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 42, start.y, { steps: 8 });
        assert.match(await page.locator('[data-role="rack-parameter-hud"]').innerText(), /NOT MAPPED.*CREATE MAPPING/i);
        await page.mouse.up();

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
            false,
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"), false);
    } finally {
        await page.close();
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(page, "route before bypass-preserving edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize")
        ));
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="toggle-route"]').click();
        await waitForHarnessSnapshot(page, "bypassed route before amount edit", (snapshot) => (
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "rack.reverbSize")?.enabled === false
        ));
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        assert.equal(await knob.locator(".rack-knob-route-presence.is-bypassed").count(), 1);

        const box = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2, { steps: 8 });
        assert.equal(await knob.getAttribute("data-dragging"), "modulation");
        assert.equal(await knob.getAttribute("data-route-state"), "bypassed");
        const liveBypassedStyle = await knob.locator('.rack-knob-mod-fill').evaluate((element) => {
            const style = getComputedStyle(element);
            return { opacity: style.opacity, dash: style.strokeDasharray, filter: style.filter };
        });
        assert.equal(liveBypassedStyle.opacity, "0.28");
        assert.notEqual(liveBypassedStyle.dash, "none");
        assert.equal(liveBypassedStyle.filter, "none");
        await page.mouse.up();
        const snapshot = await waitForHarnessSnapshot(page, "bypassed route amount edit", (nextSnapshot) => {
            const route = readStoredModulationState(nextSnapshot).routes.find((candidate) => candidate.targetKind === "rack.reverbSize");
            return route !== undefined && route.amount > 0.01;
        });
        assert.equal(
            readStoredModulationState(snapshot).routes.find((route) => route.targetKind === "rack.reverbSize")?.enabled,
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before rack parameter hold",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await clearHarnessDebugLog(page);

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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
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
        await knob.dispatchEvent("pointermove", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y - 28,
        });
        await page.waitForTimeout(560);
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
        assert.deepEqual(await page.evaluate(() => window.__rackHaptics), []);
        await knob.dispatchEvent("pointerup", {
            pointerId: 42,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: start.x,
            clientY: start.y - 28,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "completed touch knob gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize")
                && Number(nextSnapshot.parameterValues.reverbSize) > 0.5,
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before base reset",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.84, true);
        });
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="rack-parameter-reverbSize"]').click({ button: "right" });
        await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack base default reset",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.5) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before context edits",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const routeForSize = (snapshot) => readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "rack.reverbSize"
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "route before exact rack edit",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.5, true);
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
                    && candidate.targetKind === "rack.reverbSize"
                ));
                return Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.72) < 0.0001
                    && route !== undefined
                    && Math.abs(route.amount - 0.35) < 0.0001;
            },
        );
        assert.equal(Math.abs(Number(snapshot.parameterValues.reverbSize) - 0.72) < 0.0001, true);
        assert.equal(await sheet.count(), 0);
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
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.reverbSize) - 0.64) < 0.0001,
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize"),
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
                { id: "hidden-mseg-route", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.45, reducer: "max" },
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await page.click('[data-role="rack-mod-source-env-1"]');
        await page.click('[data-role="rack-create-mapping"]');
        await waitForHarnessSnapshot(
            page,
            "two source routes before removal",
            (snapshot) => readStoredModulationState(snapshot).routes.filter(
                (route) => route.targetKind === "rack.reverbSize",
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
                return !routes.some((route) => route.sourceKind === "env" && route.targetKind === "rack.reverbSize")
                    && routes.some((route) => route.sourceKind === "mseg" && route.targetKind === "rack.reverbSize");
            },
        );
        assert.equal(
            readStoredModulationState(snapshot).routes.filter((route) => route.targetKind === "rack.reverbSize").length,
            1,
        );

        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
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
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "rack.reverbSize"),
            true,
        );
        await confirmation.locator('[data-role="rack-remove-target-routes-confirm"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "all rack target routes removed",
            (nextSnapshot) => !readStoredModulationState(nextSnapshot).routes.some(
                (route) => route.targetKind === "rack.reverbSize",
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
        assert.equal(await controls.count(), 4);
        const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        }));
        assert.equal(Math.abs(boxes[0].y - boxes[1].y) < 1, true);
        assert.equal(Math.abs(boxes[1].y - boxes[2].y) < 1, true);
        assert.equal(boxes[3].y > boxes[0].y + 40, true);
        assert.equal(boxes.every((box) => box.width >= 52 && box.height >= 68), true);
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
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.click();
        await source.click();

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
            assert.equal(layout.typeControl.borderRadius >= 6 && layout.numberControl.borderRadius >= 6, true);
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
        assert.deepEqual(await numberSelect.locator("option").allTextContents(), ["1", "2", "3"]);
        const envelopeSurface = frame.locator('[data-role="adsr-editor-surface"]');
        assert.equal(await envelopeSurface.count(), 1);
        assert.equal(await envelopeSurface.getAttribute("preserveAspectRatio"), "none");
        assert.deepEqual(
            await frame.locator('[data-role="mobile-mod-active-controls"] label > span').allTextContents(),
            ["Attack", "Decay", "Sustain", "Release"],
        );
        assert.equal(await frame.getByLabel("Envelope sustain value").inputValue(), "50%");
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

test("mobile Mod uses a complete one-dimensional route list with detail, filters, and hierarchical creation", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.clear();
            });
        },
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "mobile-route-1", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "bipolar", targetKind: "rack.flangerDepth", amount: -0.39, reducer: "max" },
                { id: "mobile-route-2", enabled: true, sourceKind: "macro", sourceSlot: 1, polarity: "unipolar", targetKind: "oscA.wavetablePosition", amount: 0.2, reducer: "max" },
                { id: "mobile-route-3", enabled: false, sourceKind: "env", sourceSlot: 2, polarity: "unipolar", targetKind: "filterCutoffOctaves", amount: 1.5, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.waitForFunction(() => {
            const state = JSON.parse(String(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"]));
            return state.routes?.length === 3;
        });
        await page.click('[data-role="mobile-workspace-tab-mod"]');

        const matrix = page.locator('[data-role="mobile-mod-matrix"]');
        await matrix.waitFor();
        assert.equal(await page.locator('[data-role="desktop-mod-matrix"]').count(), 0);
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), "3 mappings");
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 3);

        const geometry = await matrix.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            rows: Array.from(element.querySelectorAll('[data-role="mobile-mod-route-row"]')).map((row) => {
                const bounds = row.getBoundingClientRect();
                return { left: bounds.left, right: bounds.right, height: bounds.height };
            }),
        }));
        assert.equal(geometry.scrollWidth <= geometry.clientWidth + 1, true);
        assert.equal(geometry.documentScrollWidth <= 393, true);
        assert.equal(geometry.rows.every((row) => row.left >= 0 && row.right <= 393 && row.height >= 56), true);
        const msegRouteRow = matrix.locator('[data-role="mobile-mod-route-row"]', { hasText: "MSEG 1" });
        assert.match(await msegRouteRow.innerText(), /MSEG 1.*Flanger.*Depth.*-39%/s);

        await matrix.locator('[data-role="mobile-mod-route-open-0"]').click();
        const detail = matrix.locator('[data-role="mobile-mod-route-detail"]');
        await detail.waitFor();
        for (const role of ["mobile-mod-detail-back", "mobile-mod-polarity", "mobile-mod-bypass", "mobile-mod-delete"]) {
            const bounds = await detail.locator(`[data-role="${role}"]`).boundingBox();
            assert.ok(bounds);
            assert.equal(bounds.width >= 44 && bounds.height >= 44, true, `${role} must be touchable`);
        }
        assert.equal(await detail.locator('[data-role="mobile-mod-reducer"]').count(), 1);
        assert.equal(await detail.locator('[data-role="mobile-mod-amount-slider"]').count(), 1);
        assert.equal(await detail.locator('[data-role="mobile-mod-amount-input"]').count(), 1);
        await detail.locator('[data-role="mobile-mod-amount-input"]').fill("-25");
        await detail.locator('[data-role="mobile-mod-amount-input"]').press("Enter");
        await waitForHarnessSnapshot(
            page,
            "mobile exact route amount",
            (snapshot) => Math.abs(readStoredModulationState(snapshot).routes[0]?.amount - (-0.25)) < 0.0001,
        );
        await detail.locator('[data-role="mobile-mod-detail-back"]').click();

        await matrix.locator('[data-role="mobile-mod-filter"]').click();
        const filters = matrix.locator('[data-role="mobile-mod-filter-sheet"]');
        await filters.locator('[data-role="mobile-mod-filter-source-mseg-1"]').click();
        await filters.locator('[data-role="mobile-mod-filter-done"]').click();
        assert.equal(await matrix.locator('[data-role="mobile-mod-filter-token"]').count(), 1);
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 1);
        await matrix.locator('[data-role="mobile-mod-filter-token-remove"]').click();
        assert.equal(await matrix.locator('[data-role="mobile-mod-route-row"]').count(), 3);

        await matrix.locator('[data-role="mobile-mod-add"]').click();
        await matrix.locator('[data-role="mobile-mod-create-source-macro-2"]').click();
        await matrix.locator('[data-role="mobile-mod-create-category-fx"]').click();
        await matrix.locator('[data-role="mobile-mod-create-effect-reverb"]').click();
        await matrix.locator('[data-role="mobile-mod-create-target-rack-reverbSize"]').click();
        await waitForHarnessSnapshot(
            page,
            "hierarchically-created mobile route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
            )),
        );
        assert.match(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), /4 mappings/i);
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
        const matrix = page.locator('[data-role="mobile-mod-matrix"]');
        await matrix.waitFor();
        assert.equal(await matrix.locator('[data-role="mobile-mod-add"]').isDisabled(), false);
        assert.match(await matrix.locator('[data-role="mobile-mod-route-count"]').innerText(), /101 mappings/i);

        await clearHarnessDebugLog(page);
        await matrix.locator('[data-role="mobile-mod-add"]').click();
        await matrix.locator('[data-role="mobile-mod-create-source-slide"]').click();
        await matrix.locator('[data-role="mobile-mod-create-category-voice"]').click();
        await matrix.locator('[data-role="mobile-mod-create-target-oscA-ampGainDb"]').click();
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
        await page.locator('[data-role="mobile-mod-matrix"]').waitFor();
        await page.waitForFunction((routeId) => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            if (rawState === undefined) return false;
            const state = JSON.parse(String(rawState));
            return state.routes?.length === 102 && state.routes.some((route) => route.id === routeId);
        }, createdRoute.id);
        assert.match(await page.locator('[data-role="mobile-mod-route-count"]').innerText(), /102 mappings/i);

        await page.locator('[data-role="mobile-mod-route-open-101"]').click();
        await clearHarnessDebugLog(page);
        const amountInput = page.locator('[data-role="mobile-mod-amount-input"]');
        await amountInput.fill("-12");
        await amountInput.blur();
        snapshot = await waitForHarnessSnapshot(page, "editing the restored 102nd mapping", (nextSnapshot) => (
            Math.abs(Number(readStoredModulationState(nextSnapshot).routes[101]?.amount) - (-12)) <= 1e-9
        ));
        assert.equal(hasRuntimeAmount(snapshot, readStoredModulationState(snapshot).routes[101], -12), true);

        await page.locator('[data-role="mobile-mod-delete"]').click();
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
    const touchDrag = async (from, to) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: from.x, y: from.y, radiusX: 6, radiusY: 6, force: 1 }],
        });
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

        const gripBox = await page.locator('[data-role="rack-reorder-handle-reverb"]').boundingBox();
        const filterBox = await page.locator('[data-role="rack-module-filter"]').boundingBox();
        assert.ok(gripBox && filterBox);
        await touchDrag(
            { x: gripBox.x + gripBox.width / 2, y: gripBox.y + gripBox.height / 2 },
            { x: filterBox.x + filterBox.width / 2, y: filterBox.y + filterBox.height / 2 },
        );
        let snapshot = await waitForHarnessSnapshot(
            page,
            "touch rack reorder",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder").length, 1);

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
                && route.targetKind === "rack.reverbSize"
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
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder").length, 1);
    } finally {
        await page.close();
    }
});

test("rack reorder keeps the latest desired enable state across an older effective readback", async () => {
    const page = await openHarnessPage();

    try {
        await page.click('[data-role="rack-enabled-chorus"]');
        await page.waitForFunction(() => {
            const rawState = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["rack.v1"];
            return rawState !== undefined && JSON.parse(String(rawState)).enabled.chorus === true;
        });
        await clearHarnessDebugLog(page);

        await beginRackReorderWithoutPointerCapture(page, { pointerId: 93, targetEffectID: "filter" });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
        ), null, { timeout: 1_000 });
        await page.evaluate(() => {
            const identityOrderCode = [0, 1, 2, 3, 4, 5, 6, 7].reduce(
                (code, moduleId, position) => code | (moduleId << (position * 3)),
                0,
            );
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveRackState", {
                committedStructureGeneration: 0,
                committedOrderCode: identityOrderCode,
                committedEnableMask: 0,
                rejectedOrderCount: 0,
                rejectedEnableCount: 0,
            });
        });
        await endRackReorderWithoutPointerCapture(page, 93);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "rack reorder after stale effective readback",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["rack.v1"];
                if (rawState === undefined) {
                    return false;
                }
                const state = JSON.parse(String(rawState));
                return state.order[0] === "reverb";
            },
        );
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.equal(storedRack.enabled.chorus, true);
        const lastEnable = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackEnable").at(-1);
        assert.equal(Number(lastEnable?.value?.enabledFlags?.[3]), 1);
    } finally {
        await page.close();
    }
});

test("rack no-op release adopts authoritative stored order received during the gesture", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        await beginRackReorderWithoutPointerCapture(page, { pointerId: 94 });
        await page.waitForSelector(".rack-unit.is-reordering");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("rack.v1", JSON.stringify({
                format: "cosimo.rack",
                version: 1,
                order: ["reverb", "filter", "drive", "ott", "chorus", "flanger", "phaser", "delay"],
                enabled: {
                    filter: false,
                    drive: false,
                    ott: false,
                    chorus: true,
                    flanger: false,
                    phaser: false,
                    delay: false,
                    reverb: false,
                },
            }));
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-chorus"]')?.getAttribute("data-enabled") === "true"
            && document.querySelector(".rack-unit.is-reordering") !== null
        ));
        assert.equal(
            await page.locator('[data-role="rack-module-list"] > :first-child').getAttribute("data-role"),
            "rack-module-filter",
            "authoritative order must not replace the preview while the gesture is active",
        );
        await endRackReorderWithoutPointerCapture(page, 94);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-module-list"]')?.firstElementChild
                ?.getAttribute("data-role") === "rack-module-reverb"
        ), null, { timeout: 1_000 });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "rackOrder"), false);
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.equal(storedRack.order[0], "reverb");
        assert.equal(storedRack.enabled.chorus, true);
    } finally {
        await page.close();
    }
});

test("mobile FX subpage keeps all eight approved rack rows visible and confines modulation controls to the editor", async () => {
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
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                const wordmarks = Array.from(document.querySelectorAll(".rack-wordmark"));
                const powers = Array.from(document.querySelectorAll(".rack-power"));
                const quickLines = Array.from(document.querySelectorAll(".rack-quick-line"));
                const rawRanges = Array.from(document.querySelectorAll(
                    '[data-role="effects-rack-card"] input[type="range"]',
                ));

                if (!(list instanceof HTMLElement)
                    || !(editor instanceof HTMLElement)
                    || !(keyboard instanceof HTMLElement)) {
                    return null;
                }

                return {
                    viewportWidth: window.innerWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    units: units.map(rectOf),
                    list: rectOf(list),
                    editor: rectOf(editor),
                    amount: amount instanceof HTMLElement ? rectOf(amount) : null,
                    keyboard: rectOf(keyboard),
                    wordmarks: wordmarks.map((wordmark, index) => ({
                        ...rectOf(wordmark),
                        row: rectOf(units[index]),
                    })),
                    powers: powers.map(rectOf),
                    quickLinesAreSingleRow: quickLines.every((line) => {
                        const children = Array.from(line.children).map(rectOf);
                        return getComputedStyle(line).display === "flex"
                            && children.length === 2
                            && Math.abs(children[0].top - children[1].top) <= 1
                            && Math.abs(children[0].bottom - children[1].bottom) <= 1
                            && Array.from(line.children).every((child) => getComputedStyle(child).whiteSpace === "nowrap");
                    }),
                    rawRangesAreVisuallyHidden: rawRanges.every((range) => {
                        const style = getComputedStyle(range);
                        return style.position === "absolute"
                            && (style.clip !== "auto" || style.clipPath !== "none")
                            && Number.parseFloat(style.width) <= 1
                            && Number.parseFloat(style.height) <= 1;
                    }),
                };
            });

            assert.ok(layout, `Expected compact rack layout at ${width}px.`);
            assert.equal(layout.units.length, 8, `Expected eight rack rows at ${width}px.`);
            assert.equal(layout.documentScrollWidth <= layout.viewportWidth, true, `Horizontal overflow at ${width}px.`);
            assert.equal(
                layout.units.every((unit) => Math.abs(unit.height - 48) <= 0.5),
                true,
                `Rack rows are not 48px at ${width}px: ${JSON.stringify(layout.units)}`,
            );
            assert.equal(layout.units[7].bottom <= layout.keyboard.top + 0.5, true, `Last rack row clips keyboard at ${width}px.`);
            assert.equal(layout.units[7].bottom <= 667, true, `All rack rows must remain in the viewport at ${width}px.`);
            if (layout.amount) {
                assert.equal(layout.amount.left >= layout.editor.left - 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.right <= layout.editor.right + 0.5, true, `Amount control escapes editor at ${width}px.`);
                assert.equal(layout.amount.left >= layout.list.right - 0.5, true, `Amount control steals rack width at ${width}px.`);
            }
            assert.equal(layout.list.bottom >= layout.units[7].bottom - 0.5, true);
            assert.equal(
                layout.wordmarks.every(({ left, top, row }) => left >= row.left && top >= row.top && top - row.top <= 9),
                true,
                `Rack names are not upper-left aligned at ${width}px.`
            );
            assert.equal(
                layout.powers.every(({ width: powerWidth, height: powerHeight }) => powerWidth >= 44 && powerHeight >= 44),
                true,
                `Power targets are not touchable at ${width}px.`
            );
            assert.equal(layout.quickLinesAreSingleRow, true, `Quick values wrapped at ${width}px.`);
            assert.equal(layout.rawRangesAreVisuallyHidden, true, `Native rack ranges leaked visually at ${width}px.`);
        } finally {
            await page.close();
        }
    }
});
