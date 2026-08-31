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
 * Tests that continue into routing controls need the product tap's selection
 * but not its T43 quick sheet. Dismiss it and restore the formerly-expanded
 * rail so those tests retain their explicit setup without bypassing the tap.
 */
async function armModSourceForRoutingTest(page, selector) {
    await page.click(selector);
    const quickSheet = page.locator('[data-role="quick-source-sheet"]');
    if ((await quickSheet.count()) > 0) {
        await quickSheet.locator('[data-role="quick-source-sheet-close"]').click();
        await quickSheet.waitFor({ state: "detached" });
        await expandGlobalModRail(page);
    }
}

test("mobile Mod Bar is a curved global edge rail that survives accordion navigation", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        await rail.waitFor();
        await page.waitForTimeout(240);

        const initial = await rail.evaluate((element) => {
            const layer = element.closest('[data-role="mobile-global-mod-rail-layer"]');
            const body = element.querySelector('[data-role="mobile-global-mod-rail-body"]');
            const silhouette = element.querySelector('[data-role="mobile-global-mod-rail-silhouette"]');
            const selected = element.querySelector('[data-role="mobile-global-mod-rail-selected"]');
            const routeCount = element.querySelector('[data-role="mobile-global-mod-rail-route-count"]');
            const drawer = element.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
            const bodyStyle = body instanceof HTMLElement ? getComputedStyle(body) : null;
            return {
                expanded: element.getAttribute("data-expanded"),
                layerPointerEvents: layer instanceof HTMLElement ? getComputedStyle(layer).pointerEvents : null,
                railPointerEvents: getComputedStyle(element).pointerEvents,
                gripTouchAction: getComputedStyle(element.querySelector('[data-role="mobile-global-mod-rail-grip"]')).touchAction,
                silhouettePathCount: silhouette?.querySelectorAll("path").length ?? 0,
                fragmentShoulderCount: element.querySelectorAll('[data-role="mobile-global-mod-rail-shoulder"]').length,
                bodyLeftRadius: bodyStyle
                    ? Math.min(Number.parseFloat(bodyStyle.borderTopLeftRadius), Number.parseFloat(bodyStyle.borderBottomLeftRadius))
                    : null,
                bodyRightRadius: bodyStyle
                    ? Math.max(Number.parseFloat(bodyStyle.borderTopRightRadius), Number.parseFloat(bodyStyle.borderBottomRightRadius))
                    : null,
                railFlushRight: Math.abs(element.getBoundingClientRect().right - window.innerWidth) <= 0.5,
                selectedLabel: selected?.getAttribute("aria-label") ?? null,
                routeCount: routeCount?.textContent?.trim() ?? null,
                insideFxPanel: element.closest('[data-role="mobile-workspace-panel-fx"]') !== null,
                parentRole: layer?.getAttribute("data-role") ?? null,
                drawerHidden: drawer?.getAttribute("aria-hidden") ?? null,
                drawerInert: drawer instanceof HTMLElement ? drawer.inert : null,
            };
        });

        assert.equal(await page.locator('[data-role="mobile-workspace-tab-voice"]').getAttribute("aria-selected"), "true");
        assert.deepEqual(initial, {
            expanded: "false",
            layerPointerEvents: "none",
            railPointerEvents: "auto",
            gripTouchAction: "none",
            silhouettePathCount: 1,
            fragmentShoulderCount: 0,
            bodyLeftRadius: initial.bodyLeftRadius,
            bodyRightRadius: 0,
            railFlushRight: true,
            selectedLabel: "MSEG 1 selected",
            routeCount: initial.routeCount,
            insideFxPanel: false,
            parentRole: "mobile-global-mod-rail-layer",
            drawerHidden: "true",
            drawerInert: true,
        });
        assert.equal(
            typeof initial.bodyLeftRadius === "number" && initial.bodyLeftRadius >= 12,
            true,
            "The tab face must keep smoothly rounded left corners joining the curved shoulders.",
        );
        assert.match(initial.routeCount, /^\d+$/);
        assert.equal(await page.locator('.rack-editor-modulation [data-role="rack-mod-source-track"]').count(), 0);
        assert.equal(await grip.getAttribute("aria-expanded"), "false");
        await grip.press("Enter");
        assert.equal(await grip.getAttribute("aria-expanded"), "true");
        await grip.press("Space");
        assert.equal(await grip.getAttribute("aria-expanded"), "false");

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 11,
                hasActive: 1,
                positions: [0.35, 0.62, 0.88],
            });
        });
        const collapsedActivity = page.locator(".mobile-global-mod-rail-activity");
        await collapsedActivity.waitFor();
        assert.equal(await collapsedActivity.getAttribute("aria-label"), "MSEG 1 activity");
        assert.equal(
            await collapsedActivity.evaluate((element) => element.style.getPropertyValue("--source-activity")),
            "0.35",
        );

        await expandGlobalModRail(page);
        assert.equal(await page.locator('[data-role="rack-mod-source-track"]').isVisible(), true);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "false");

        const beforeNavigation = await rail.boundingBox();
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const afterNavigation = await rail.boundingBox();
        assert.ok(beforeNavigation && afterNavigation);
        assert.equal(await rail.isVisible(), true);
        assert.equal(Math.abs(beforeNavigation.x - afterNavigation.x) <= 1, true);
        assert.equal(await grip.getAttribute("aria-expanded"), "true");

        await collapseGlobalModRail(page);
        const beforeResizeNormalized = await rail.evaluate((element) => {
            const layer = element.closest('[data-role="mobile-global-mod-rail-layer"]');
            const keyboard = element.closest(".cosimo-surface")?.querySelector('[data-role="sticky-keyboard"]');
            const presetBar = element.closest(".cosimo-surface")?.querySelector('[data-role="synth-preset-bar-host"]');
            if (!(layer instanceof HTMLElement) || !(keyboard instanceof HTMLElement) || !(presetBar instanceof HTMLElement)) {
                return null;
            }
            const railBounds = element.getBoundingClientRect();
            const layerBounds = layer.getBoundingClientRect();
            const keyboardBounds = keyboard.getBoundingClientRect();
            const min = Math.max(8, presetBar.getBoundingClientRect().bottom - layerBounds.top + 8);
            const max = Math.max(min, keyboardBounds.top - layerBounds.top - railBounds.height - 8);
            return (railBounds.top - layerBounds.top - min) / Math.max(1, max - min);
        });
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(240);
        const safeLayout = await page.evaluate(() => {
            const railElement = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const layer = railElement?.closest('[data-role="mobile-global-mod-rail-layer"]');
            const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
            const presetBar = document.querySelector('[data-role="synth-preset-bar-host"]');
            if (
                !(railElement instanceof HTMLElement)
                || !(layer instanceof HTMLElement)
                || !(keyboard instanceof HTMLElement)
                || !(presetBar instanceof HTMLElement)
            ) {
                return null;
            }
            const railBounds = railElement.getBoundingClientRect();
            const layerBounds = layer.getBoundingClientRect();
            const keyboardBounds = keyboard.getBoundingClientRect();
            const min = Math.max(8, presetBar.getBoundingClientRect().bottom - layerBounds.top + 8);
            const max = Math.max(min, keyboardBounds.top - layerBounds.top - railBounds.height - 8);
            return {
                railTop: railBounds.top,
                railBottom: railBounds.bottom,
                keyboardTop: keyboardBounds.top,
                minimumTop: layerBounds.top + min,
                normalized: (railBounds.top - layerBounds.top - min) / Math.max(1, max - min),
            };
        });
        assert.ok(safeLayout);
        assert.notEqual(beforeResizeNormalized, null);
        assert.equal(safeLayout.railTop >= safeLayout.minimumTop - 0.5, true);
        assert.equal(safeLayout.railBottom <= safeLayout.keyboardTop - 8, true);
        assert.equal(
            Math.abs(safeLayout.normalized - beforeResizeNormalized) <= 0.04,
            true,
            "Viewport changes must preserve the rail's normalized vertical position.",
        );
    } finally {
        await page.close();
    }
});

test("global Mod Bar grip movement and source mapping have disjoint touch ownership", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await clearHarnessDebugLog(page);

        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const initialRouteCount = Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText());
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");
        const initialRailBox = await rail.boundingBox();
        const handleBox = await handle.boundingBox();
        assert.ok(initialRailBox && handleBox);
        const gripStart = {
            x: handleBox.x + (handleBox.width / 2),
            y: handleBox.y + (handleBox.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...gripStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: gripStart.x, y: gripStart.y - 72, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
        ));
        await page.waitForTimeout(220);

        const movedRailBox = await rail.boundingBox();
        assert.ok(movedRailBox);
        assert.equal(Math.abs(movedRailBox.y - initialRailBox.y) >= 24, true, "Grip drag did not reposition the rail.");
        assert.equal(await grip.getAttribute("aria-expanded"), "true", "Moving the grip must not toggle expansion.");
        assert.equal(await page.evaluate(() => localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") !== null), true);
        assert.equal((await getHarnessSnapshot(page)).sentMessages.length, 0, "Moving the rail must not create a route.");

        const railTopBeforeSourceDrag = (await rail.boundingBox())?.y;
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox && railTopBeforeSourceDrag !== undefined);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await rail.getAttribute("data-mapping-active"), "true");
        assert.equal(
            await rail.evaluate((element) => getComputedStyle(element).pointerEvents),
            "none",
            "The rail must become hit-transparent while a source is mapping onto controls beneath it.",
        );
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 1);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "true");
        await page.waitForTimeout(180);
        const retreatedRailBox = await rail.boundingBox();
        const activeGhostBox = await page.locator('[data-role="mobile-global-mod-source-ghost"]').boundingBox();
        assert.ok(retreatedRailBox && activeGhostBox);
        assert.equal(
            retreatedRailBox.x >= 393,
            true,
            `The Mod Bar must retreat fully beyond the right edge during source mapping. ${JSON.stringify(retreatedRailBox)}`,
        );
        assert.equal(
            activeGhostBox.x < 393 && activeGhostBox.x + activeGhostBox.width > 0,
            true,
            "The dragged source preview must remain visible while the Mod Bar retreats.",
        );

        const targetFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{
                x: targetFinger.x,
                y: targetFinger.y,
                radiusX: 5,
                radiusY: 5,
                force: 1,
            }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "global source rail drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        assert.ok(snapshot);
        assert.equal(await rail.getAttribute("data-mapping-active"), "false");
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 0);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail-drawer"]').getAttribute("aria-hidden"), "false");
        await page.waitForTimeout(320);
        const restoredRailBox = await rail.boundingBox();
        assert.ok(restoredRailBox);
        assert.equal(Math.abs(restoredRailBox.y - railTopBeforeSourceDrag) <= 1, true, "Source drag moved the rail.");
        assert.equal(Math.abs(restoredRailBox.x + restoredRailBox.width - 393) <= 1, true, "The Mod Bar did not return to the right edge after the drop.");
        assert.equal(
            Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText()),
            initialRouteCount + 1,
        );

        await collapseGlobalModRail(page);
        const collapsedRailTop = (await rail.boundingBox())?.y;
        const collapsedSource = page.locator('[data-role="mobile-global-mod-rail-selected"]');
        const collapsedSourceBox = await collapsedSource.boundingBox();
        const secondTarget = page.locator('[data-role="rack-parameter-surface-reverbMix"]');
        const secondTargetBox = await secondTarget.boundingBox();
        assert.ok(collapsedRailTop !== undefined && collapsedSourceBox && secondTargetBox);
        const collapsedSourceStart = {
            x: collapsedSourceBox.x + (collapsedSourceBox.width / 2),
            y: collapsedSourceBox.y + (collapsedSourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...collapsedSourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: collapsedSourceStart.x - 18, y: collapsedSourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await rail.getAttribute("data-expanded"), "false", "Dragging the collapsed armed source must not expand the drawer.");
        assert.equal(await rail.getAttribute("data-mapping-active"), "true", "The collapsed armed source must begin route mapping.");
        assert.equal(await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(), 1);
        await page.waitForTimeout(180);
        assert.equal(
            ((await rail.boundingBox())?.x ?? 0) >= 393,
            true,
            "The collapsed Mod Bar must also retreat beyond the right edge during mapping.",
        );
        const secondTargetFinger = touchPointForModSourcePreviewTarget(
            collapsedSourceStart,
            { x: secondTargetBox.x + (secondTargetBox.width / 2), y: secondTargetBox.y + (secondTargetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{
                x: secondTargetFinger.x,
                y: secondTargetFinger.y,
                radiusX: 5,
                radiusY: 5,
                force: 1,
            }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "collapsed armed source drop",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbMix"
            )),
        );
        assert.equal(await rail.getAttribute("data-expanded"), "false");
        assert.equal(await rail.getAttribute("data-mapping-active"), "false");
        await page.waitForTimeout(180);
        const restoredCollapsedRailBox = await rail.boundingBox();
        assert.ok(restoredCollapsedRailBox);
        assert.equal(Math.abs(restoredCollapsedRailBox.y - collapsedRailTop) <= 1, true, "Dragging the collapsed source moved the bar.");
        assert.equal(Math.abs(restoredCollapsedRailBox.x + restoredCollapsedRailBox.width - 393) <= 1, true, "The collapsed Mod Bar did not return after the drop.");
        assert.equal(
            Number(await page.locator('[data-role="mobile-global-mod-rail-route-count"]').innerText()),
            initialRouteCount + 2,
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("the Mod rail docks to either screen edge and remembers its dock across launches", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        assert.equal(await rail.getAttribute("data-edge"), "right");

        const handle = rail.locator(".mobile-global-mod-rail-handle");
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox);
        const start = {
            x: handleBox.x + (handleBox.width / 2),
            y: handleBox.y + (handleBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        // Two intermediate points keep the drag classified before crossing the
        // midline, then release deep inside the left half.
        for (const x of [start.x - 80, start.x - 200, 60]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: start.y + 12, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="mobile-global-mod-rail"]');
            return element?.getAttribute("data-settling-x") === "false"
                && element.getAttribute("data-decelerating") === "false";
        });
        await page.waitForTimeout(300);

        assert.equal(await rail.getAttribute("data-edge"), "left");
        const dockedBox = await rail.boundingBox();
        assert.ok(dockedBox);
        assert.equal(Math.abs(dockedBox.x) <= 1, true, "The rail must settle flush against the left screen edge.");
        assert.equal(
            (await rail.locator('[data-role="mobile-global-mod-rail-silhouette"] path').getAttribute("d"))?.startsWith("M 0 0"),
            true,
            "The silhouette's shoulders must attach to the left screen edge after a left dock.",
        );

        const storedDock = await page.evaluate(() => (
            JSON.parse(localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") ?? "null")
        ));
        assert.equal(storedDock?.version, 2);
        assert.equal(storedDock?.edge, "left");
        assert.equal(storedDock.normalizedY >= 0 && storedDock.normalizedY <= 1, true);
        assert.deepEqual(
            await page.evaluate(() => (
                JSON.parse(localStorage.getItem("cosimo.mod-bar.preferences.v1") ?? "null")
            )),
            {
                version: 1,
                scale: 1.1,
                placement: "floating-left",
                parkedVisibility: "visible",
            },
            "Dragging across the midpoint must persist the application-level placement.",
        );

        // The drawer still opens toward the screen from the left dock.
        await expandGlobalModRail(page);
        const drawerBox = await page.locator('[data-role="mobile-global-mod-rail-drawer"]').boundingBox();
        assert.ok(drawerBox);
        assert.equal(drawerBox.x >= -1 && drawerBox.x + drawerBox.width <= 200, true);
    } finally {
        await page.close();
    }

    const restoredPage = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ dock, preferences }) => {
                localStorage.setItem("cosimo.mobile-global-mod-rail.position.v1", dock);
                localStorage.setItem("cosimo.mod-bar.preferences.v1", preferences);
            }, {
                dock: JSON.stringify({ version: 2, edge: "left", normalizedY: 0.8 }),
                preferences: JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "floating-left",
                    parkedVisibility: "visible",
                }),
            });
        },
    });
    try {
        const rail = restoredPage.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await restoredPage.waitForTimeout(240);
        assert.equal(await rail.getAttribute("data-edge"), "left");
        const box = await rail.boundingBox();
        assert.ok(box);
        assert.equal(Math.abs(box.x) <= 1, true, "A stored left dock must restore flush left.");
        assert.equal(box.y > 426, true, "A stored normalizedY of 0.8 must restore in the lower travel band.");
    } finally {
        await restoredPage.close();
    }

    const legacyPage = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                localStorage.setItem("cosimo.mobile-global-mod-rail.position.v1", "0.42");
            });
        },
    });
    try {
        const rail = legacyPage.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await legacyPage.waitForTimeout(240);
        assert.equal(
            await rail.getAttribute("data-edge"),
            "right",
            "A legacy stored position predates edge docking and must restore on the right edge.",
        );
    } finally {
        await legacyPage.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
        }).catch(() => {});
        await legacyPage.close();
    }
});

test("the Note key plays the remembered pitch, follows intentional notes, and never sticks", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const noteKey = rail.locator('[data-role="mobile-global-mod-rail-note"]');
        await noteKey.waitFor();
        await page.waitForTimeout(240);
        await clearHarnessDebugLog(page);

        // Before any intentional note the Note key plays middle C.
        const noteBox = await noteKey.boundingBox();
        assert.ok(noteBox);
        const noteCenter = { x: noteBox.x + (noteBox.width / 2), y: noteBox.y + (noteBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...noteCenter, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));
        assert.equal(await noteKey.getAttribute("data-note-held"), "true");

        // A vertical move while holding the key must neither move the rail nor
        // release the note: the key owns its pointer.
        const railTopWhileHeld = (await rail.boundingBox())?.y;
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: noteCenter.x, y: noteCenter.y + 48, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForTimeout(120);
        assert.equal((await rail.boundingBox())?.y, railTopWhileHeld, "Holding the Note key must not drag the rail.");
        assert.equal(await noteKey.getAttribute("data-note-held"), "true");

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60, 0) },
        ]);
        assert.equal(await noteKey.getAttribute("data-note-held"), "false");

        // An intentional note played on the on-screen keyboard becomes the
        // Note key's pitch (the element reports its own presses as
        // note-down/note-up, which host playback never dispatches).
        await page.evaluate(() => {
            const keyboard = document.querySelector('[data-role="sticky-keyboard"] .keyboard');
            keyboard.dispatchEvent(new CustomEvent("note-down", { detail: { note: 52 } }));
            keyboard.dispatchEvent(new CustomEvent("note-up", { detail: { note: 52 } }));
        });
        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...noteCenter, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));

        // The platform blur path must end the note exactly once.
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length >= 2
        ));
        await page.waitForTimeout(160);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 52, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 52, 0) },
        ]);
        assert.equal(await noteKey.getAttribute("data-note-held"), "false");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        // The host's shared leave edge covers pagehide and audio-session-only
        // interruptions. A following blur is duplicate delivery, not a second
        // note-off.
        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...noteCenter, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));
        await page.evaluate(() => window.dispatchEvent(new Event("cosimo-browser-audio-leave")));
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        assert.equal(await noteKey.getAttribute("data-note-held"), "false");
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(160);
        assert.deepEqual((await getHarnessSnapshot(page)).midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 52, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 52, 0) },
        ]);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
        await page.close();
    }
});

test("the expanded drawer's Keyboard and Auto-preview toggles govern the keyboard and the Note-key dot", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        const autoToggle = rail.locator('[data-role="mobile-global-mod-rail-auto-toggle"]');
        const keyboardToggle = rail.locator('[data-role="mobile-global-mod-rail-keyboard-toggle"]');
        const noteDot = rail.locator('[data-role="mobile-global-mod-rail-note-dot"]');

        assert.equal(await autoToggle.getAttribute("aria-pressed"), "false");
        assert.equal(await noteDot.count(), 0);
        await autoToggle.click();
        assert.equal(await autoToggle.getAttribute("aria-pressed"), "true");
        assert.equal(await noteDot.count(), 1, "Active Auto-preview must light the Note key's status dot.");
        assert.deepEqual(
            await page.evaluate(() => JSON.parse(localStorage.getItem("cosimo.auto-preview.enabled.v1") ?? "null")),
            { version: 1, enabled: true },
        );

        const keyboard = page.locator('[data-role="sticky-keyboard"]');
        assert.equal(await keyboard.isVisible(), true);
        const beforeDebug = await getKeyboardDebug(page);
        await keyboardToggle.click();
        assert.equal(await keyboardToggle.getAttribute("aria-pressed"), "false");
        assert.equal(await keyboard.isVisible(), false, "The Keyboard toggle must hide the bottom keyboard.");
        const afterDebug = await getKeyboardDebug(page);
        assert.equal(
            Number(afterDebug?.allNotesOffCount ?? 0) >= Number(beforeDebug?.allNotesOffCount ?? 0) + 1,
            true,
            "Hiding the keyboard must release its held notes.",
        );
        await page.waitForTimeout(260);
        const railBoxWithoutKeyboard = await rail.boundingBox();
        assert.ok(railBoxWithoutKeyboard);
        assert.equal(
            railBoxWithoutKeyboard.y + railBoxWithoutKeyboard.height <= 852,
            true,
            "The rail must stay inside the viewport when the keyboard is hidden.",
        );

        await keyboardToggle.click();
        assert.equal(await keyboard.isVisible(), true);
        assert.equal(await keyboardToggle.getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("the drawer's voice-settings popover owns Play Mode and greys Glide while Poly is active", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        // T04 decision: the voice-settings toggle lives in the drawer and is
        // labeled with the active play mode.
        const voiceToggle = rail.locator('[data-role="mobile-global-mod-rail-voice-toggle"]');
        assert.equal((await voiceToggle.textContent())?.trim(), "Poly");

        const popover = page.locator('[data-role="mobile-global-mod-rail-voice-popover"]');
        assert.equal(await popover.count(), 0);
        await voiceToggle.click();
        await popover.waitFor();

        const polyOption = popover.locator(".mobile-global-mod-rail-voice-mode", { hasText: "Poly" });
        const monoOption = popover.locator(".mobile-global-mod-rail-voice-mode", { hasText: "Mono" });
        assert.equal(await polyOption.getAttribute("aria-checked"), "true");

        const glide = popover.locator(".mobile-global-mod-rail-voice-glide");
        assert.equal(await glide.getAttribute("data-disabled"), "true");
        assert.equal(await glide.evaluate((element) => element.inert), true);
        assert.equal(await glide.evaluate((element) => getComputedStyle(element).opacity), "0.38");

        // Choosing Mono writes the playMode host parameter and un-greys Glide.
        await monoOption.click();
        await waitForHarnessSnapshot(
            page,
            "play mode commit",
            (candidate) => Number(candidate.parameterValues.playMode) === 1,
        );
        assert.equal(await monoOption.getAttribute("aria-checked"), "true");
        assert.equal((await voiceToggle.textContent())?.trim(), "Mono");
        assert.equal(await glide.getAttribute("data-disabled"), "false");
        assert.equal(await glide.evaluate((element) => element.inert), false);

        // A tap outside the popover dismisses it without changing the mode.
        await page.locator('[data-role="mobile-workspace-tab-voice"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail-voice-popover"]') === null
        ));
        assert.equal(
            Number((await getHarnessSnapshot(page)).parameterValues.playMode),
            1,
            "Dismissing the popover must not change the play mode.",
        );

        // Collapsing the drawer takes the reopened popover with it.
        await voiceToggle.click();
        await popover.waitFor();
        await collapseGlobalModRail(page);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail-voice-popover"]') === null
        ));
    } finally {
        await page.close();
    }
});

test("T39A: Voice settings keeps Global Tune open for live source selection, drop, and route editing", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        const voiceToggle = rail.locator('[data-role="mobile-global-mod-rail-voice-toggle"]');
        await voiceToggle.click();
        const popover = page.locator('[data-role="mobile-global-mod-rail-voice-popover"]');
        await popover.waitFor({ state: "visible" });
        const tuneKnob = popover.locator('[data-role="global-tune-knob"]');

        assert.equal(
            await page.locator('[data-role="global-tune-control"]').count(),
            0,
            "The rejected Voice-card Global Tune presentation must be removed.",
        );
        assert.equal(await tuneKnob.count(), 1, "Voice settings must own the one Global Tune control.");
        assert.equal(await page.locator('[data-role="global-tune-knob"]').count(), 1);
        assert.equal(await tuneKnob.getAttribute("aria-valuemin"), "-24");
        assert.equal(await tuneKnob.getAttribute("aria-valuemax"), "24");

        // A real source tap changes the armed source and opens its accepted
        // quick editor. Neither that tap nor the source-driven rail collapse
        // is an outside dismissal of Voice settings.
        await rail.locator('[data-role="rack-mod-source-env-1"]').click();
        await page.locator('[data-role="quick-source-sheet"][data-source-kind="env"][data-source-slot="1"]').waitFor();
        assert.equal(await popover.isVisible(), true, "Touching Envelope 1 must preserve Voice settings.");
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "Envelope 1 selected",
        );

        await expandGlobalModRail(page);
        assert.equal(await popover.isVisible(), true, "Expanding after a source-owned collapse must preserve Voice settings.");
        await rail.locator('[data-role="rack-mod-source-macro-1"]').click();
        await page.locator('[data-role="quick-source-sheet"][data-source-kind="macro"][data-source-slot="1"]').waitFor();
        assert.equal(
            await popover.isVisible(),
            true,
            "Switching the armed source must preserve Voice settings.",
        );
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "Macro 1 selected",
        );

        await expandGlobalModRail(page);
        const source = rail.locator('[data-role="rack-mod-source-macro-1"]');
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await rail.locator('xpath=self::*[@data-mapping-active="true"]').waitFor();
        await page.waitForTimeout(180);

        assert.equal(await popover.isVisible(), true, "The Voice popout must stay visibly open while mapping.");
        const mappingTargetBox = await tuneKnob.boundingBox();
        assert.ok(mappingTargetBox, "Global Tune must remain a composed visible target while the Mod bar retreats.");
        assert.equal(mappingTargetBox.x >= 0 && mappingTargetBox.x + mappingTargetBox.width <= 393, true);

        const targetFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            {
                x: mappingTargetBox.x + (mappingTargetBox.width / 2),
                y: mappingTargetBox.y + (mappingTargetBox.height / 2),
            },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...targetFinger, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        await waitForHarnessSnapshot(
            page,
            "Global Tune source drop",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 1
                && route.targetKind === "globalTuneSemitones"
                && route.amount === 0
            )),
        );
        assert.equal(await popover.isVisible(), true, "A successful Global Tune drop must preserve Voice settings.");
        assert.equal(await popover.locator('[data-role="global-tune-route-count"]').textContent(), "1");

        await clearHarnessDebugLog(page);
        await dispatchRackKnobPointerEvents(tuneKnob, [
            { type: "pointerdown", pointerId: 139, buttons: 1 },
            { type: "pointermove", pointerId: 139, buttons: 1, deltaY: -8 },
            { type: "pointermove", pointerId: 139, buttons: 1, deltaY: -64 },
            { type: "pointerup", pointerId: 139, buttons: 0, deltaY: -64 },
        ]);
        const editedSnapshot = await waitForHarnessSnapshot(
            page,
            "Global Tune route amount edit",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 1
                && route.targetKind === "globalTuneSemitones"
                && route.amount > 0
            )),
        );
        assert.equal(editedSnapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationAmount" && Number(value?.amount) > 0
        )), true, "Global Tune must use the canonical small route-amount update path.");

        await page.mouse.click(5, 5);
        await popover.waitFor({ state: "detached" });
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("the Note key triggers audible output from every mobile editor state", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    const pressNoteKey = async (stateLabel) => {
        await clearHarnessDebugLog(page);
        const noteKey = page.locator('[data-role="mobile-global-mod-rail-note"]');
        const noteBox = await noteKey.boundingBox();
        assert.ok(noteBox, `${stateLabel}: the Note key must be present.`);
        const center = { x: noteBox.x + (noteBox.width / 2), y: noteBox.y + (noteBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...center, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ), undefined, { timeout: 4000 }).catch(() => {
            throw new Error(`${stateLabel}: pressing the Note key produced no note-on.`);
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60, 0) },
        ], `${stateLabel}: the Note key must play and release exactly the remembered pitch.`);
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);

        await pressNoteKey("Voice accordion");

        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await pressNoteKey("FX effect editor");

        // Create one route so the Mod views have a route to detail.
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const routeFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: routeFinger.x, y: routeFinger.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "note key path route creation",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "env" && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);

        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await pressNoteKey("Mod SOURCE panel");

        // T14: the second top-level state is the MAPPINGS panel.
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.locator('[data-role="mod-mappings-row"]').first().waitFor();
        await pressNoteKey("Mod MAPPINGS panel");

        // Deep-link into the selected source's full editor from the drawer: the
        // first tap arms the source if it is not armed; the tap on an armed
        // source opens its editor.
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        // The editor marker is a hidden metadata span: presence, not visibility.
        if ((await page.locator('[data-role="mod-source-editor"]').count()) === 0) {
            await page.click('[data-role="rack-mod-source-mseg-1"]');
        }
        await page.locator('[data-role="mod-source-editor"]').waitFor({ state: "attached" });
        await pressNoteKey("Source editor");
    } finally {
        await page.close();
    }
});

test("Auto-preview retriggers on real parameter drags, stays silent when off, and cannot stick", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    const dragKnobBase = async () => {
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);
        const start = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [12, 26, 40]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x + step, y: start.y, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(40);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const startHeldKnobPreview = async () => {
        await clearHarnessDebugLog(page);
        const surfaceBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(surfaceBox);
        const start = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [15, 30]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x + step, y: start.y, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.some(
                ({ value }) => (value >>> 16) === 0x90,
            )
        ));
    };
    const waitForBalancedPreviewNotes = () => page.waitForFunction(() => {
        const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
        const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
        const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
        return noteOns >= 1 && noteOns === noteOffs;
    }, undefined, { timeout: 4000 });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");

        // Off by default: a real value drag produces no audition notes.
        await clearHarnessDebugLog(page);
        await dragKnobBase();
        await page.waitForTimeout(700);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [], "Auto-preview off must stay silent for value edits.");
        assert.notEqual(
            snapshot.sentMessages.filter((message) => isLaneParamSend(message, "reverbSize")).length,
            0,
            "The drag itself must have edited the parameter.",
        );

        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-global-mod-rail-auto-toggle"]').click();
        await collapseGlobalModRail(page);

        // On: the same drag strikes the remembered pitch and settles with no
        // note left hanging.
        await clearHarnessDebugLog(page);
        await dragKnobBase();
        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns >= 1 && noteOns === noteOffs;
        }, undefined, { timeout: 4000 });
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.midiInputEvents.every(({ value }) => ((value >>> 8) & 0x7f) === 60),
            true,
            "With nothing held, Auto-preview must strike the remembered pitch (middle C).",
        );

        // The original platform blur path still stops a held preview.
        await startHeldKnobPreview();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await waitForBalancedPreviewNotes();
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));

        // Host leave covers pagehide and audio-session-only interruption.
        // A later blur is duplicate delivery and must not add another note-off.
        await startHeldKnobPreview();
        await page.evaluate(() => window.dispatchEvent(new Event("cosimo-browser-audio-leave")));
        await waitForBalancedPreviewNotes();
        const eventsAfterBrowserLeave = (await getHarnessSnapshot(page)).midiInputEvents;
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(100);
        assert.deepEqual(
            (await getHarnessSnapshot(page)).midiInputEvents,
            eventsAfterBrowserLeave,
            "Duplicate platform leave delivery must not emit another note-off.",
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        // Focus arrives before blocked browser audio is actually recovered.
        // It must not re-enable preview behind the lifecycle gate.
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expandGlobalModRail(page);
        const autoToggle = page.locator('[data-role="mobile-global-mod-rail-auto-toggle"]');
        await autoToggle.click();
        await autoToggle.click();
        await collapseGlobalModRail(page);
        await clearHarnessDebugLog(page);
        await dragKnobBase();
        await page.waitForTimeout(700);
        assert.deepEqual(
            (await getHarnessSnapshot(page)).midiInputEvents,
            [],
            "Focus must not bypass a pending browser-audio recovery.",
        );

        // The recovery edge re-enables the saved preference; it does not
        // require the user to toggle Auto-preview off and on again.
        await page.evaluate(() => window.dispatchEvent(new Event("cosimo-browser-audio-return")));
        await clearHarnessDebugLog(page);
        await dragKnobBase();
        await waitForBalancedPreviewNotes();
    } finally {
        await page.close();
    }
});

test("Auto-preview with a routed looping MSEG still strikes, settles balanced, and never sticks", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");

        // Route the default-armed MSEG 1 (rate 1s, full-shape loop) onto a
        // rack parameter so the loop-sync path becomes eligible.
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const routeFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: routeFinger.x, y: routeFinger.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "mseg loop-sync route creation",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg" && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );

        await page.locator('[data-role="mobile-global-mod-rail-auto-toggle"]').click();
        await collapseGlobalModRail(page);

        // Drag the knob: strikes may defer to the loop grid (unit-pinned math)
        // but must still arrive, stay on the remembered pitch, and settle with
        // every note-on matched by a note-off.
        await clearHarnessDebugLog(page);
        const surfaceBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(surfaceBox);
        const dragStart = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...dragStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [14, 30, 46]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: dragStart.x, y: dragStart.y - step, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(50);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns >= 1 && noteOns === noteOffs;
        }, undefined, { timeout: 5000 });
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.midiInputEvents.every(({ value }) => ((value >>> 8) & 0x7f) === 60),
            true,
            "Loop-synced strikes must stay on the remembered pitch.",
        );
    } finally {
        await page.close();
    }
});

test("touch source mapping keeps its free preview while a sticky target claims the drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                window.__modSourceCaptureHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__modSourceCaptureHaptics.push(style);
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);

        const sourceCenter = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const sourceToTarget = {
            x: targetCenter.x - sourceCenter.x,
            y: targetCenter.y - sourceCenter.y,
        };
        const sourceToTargetDistance = Math.hypot(sourceToTarget.x, sourceToTarget.y);
        assert.equal(sourceToTargetDistance > 128, true);
        const finger = touchPointForModSourcePreviewTarget(sourceCenter, targetCenter, 393);
        const thumbTravel = Math.hypot(finger.x - sourceCenter.x, finger.y - sourceCenter.y);
        assert.equal(
            thumbTravel <= sourceToTargetDistance * 0.55,
            true,
            `The preview should cross the surface with substantially less thumb travel. ${JSON.stringify({ thumbTravel, sourceToTargetDistance })}`,
        );

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceCenter, radiusX: 8, radiusY: 8, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...finger, radiusX: 8, radiusY: 8, force: 1 }],
        });

        const ghost = page.locator('[data-role="mobile-global-mod-source-ghost"]');
        await ghost.waitFor({ state: "visible" });
        assert.equal(
            Math.hypot(finger.x - targetCenter.x, finger.y - targetCenter.y) >= 60,
            true,
        );
        assert.equal((await target.getAttribute("class"))?.includes("is-mod-hover"), true);
        assert.equal(await ghost.getAttribute("data-target-captured"), "true");
        assert.deepEqual(await page.evaluate(() => window.__modSourceCaptureHaptics), ["light"]);

        const retainedPreviewPoint = targetCenter.x <= 393 / 2
            ? { x: targetBox.x + targetBox.width + 2, y: targetCenter.y }
            : { x: targetBox.x - 2, y: targetCenter.y };
        const retainedFinger = touchPointForModSourcePreviewTarget(sourceCenter, retainedPreviewPoint, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...retainedFinger, radiusX: 8, radiusY: 8, force: 1 }],
        });
        await page.waitForFunction(({ x, y }) => {
            const preview = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
            if (!(preview instanceof HTMLElement)) {
                return false;
            }
            return Math.hypot(Number.parseFloat(preview.style.left) - x, Number.parseFloat(preview.style.top) - y) <= 2;
        }, retainedPreviewPoint);

        const ghostBox = await ghost.boundingBox();
        assert.ok(ghostBox);
        const ghostCenter = {
            x: ghostBox.x + (ghostBox.width / 2),
            y: ghostBox.y + (ghostBox.height / 2),
        };
        assert.equal(
            Math.hypot(ghostCenter.x - retainedPreviewPoint.x, ghostCenter.y - retainedPreviewPoint.y) <= 2,
            true,
            `Target capture must not magnetize the preview. ${JSON.stringify({ ghostCenter, retainedPreviewPoint, targetCenter })}`,
        );
        assert.equal((await target.getAttribute("class"))?.includes("is-mod-hover"), true);
        assert.equal(await ghost.getAttribute("data-target-captured"), "true");
        assert.deepEqual(await page.evaluate(() => window.__modSourceCaptureHaptics), ["light"]);
        assert.equal(
            ghostBox.width >= 40,
            true,
            `Target capture must not resize the preview, got ${ghostBox.width}px.`,
        );

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "finger-clearing source drop",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => undefined);
        await cdp.detach();
        await page.close();
    }
});

test("the global modulation rail owns one continuous SVG silhouette", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.25 }),
                );
            });
        },
    });

    const readSilhouette = async () => await page.locator('[data-role="mobile-global-mod-rail"]').evaluate((rail) => {
        const silhouette = rail.querySelector('[data-role="mobile-global-mod-rail-silhouette"]');
        const paths = silhouette ? Array.from(silhouette.querySelectorAll("path")) : [];
        const path = paths[0] ?? null;
        const grip = rail.querySelector('[data-role="mobile-global-mod-rail-grip"]');
        const body = rail.querySelector('[data-role="mobile-global-mod-rail-body"]');
        const railBounds = rail.getBoundingClientRect();
        const silhouetteBounds = silhouette?.getBoundingClientRect() ?? null;
        const pathStyle = path ? getComputedStyle(path) : null;
        return {
            pathCount: paths.length,
            pathData: path?.getAttribute("d") ?? "",
            pathFill: pathStyle?.fill ?? null,
            pathStroke: pathStyle?.stroke ?? null,
            pathStrokeWidth: pathStyle?.strokeWidth ?? null,
            fragmentShoulderCount: rail.querySelectorAll('[data-role="mobile-global-mod-rail-shoulder"]').length,
            gripBackground: grip ? getComputedStyle(grip).backgroundColor : null,
            bodyBoxShadow: body ? getComputedStyle(body).boxShadow : null,
            railBounds: {
                left: railBounds.left,
                top: railBounds.top,
                width: railBounds.width,
                height: railBounds.height,
            },
            silhouetteBounds: silhouetteBounds ? {
                left: silhouetteBounds.left,
                top: silhouetteBounds.top,
                width: silhouetteBounds.width,
                height: silhouetteBounds.height,
            } : null,
        };
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readSilhouette();
        assert.equal(collapsed.pathCount, 1, "One SVG path must own the complete tab outline.");
        assert.match(collapsed.pathData, /Z\s*$/i, "The silhouette must be one closed contour.");
        assert.notEqual(collapsed.pathFill, "none", "The silhouette path must own the tab fill.");
        assert.notEqual(collapsed.pathStroke, "none", "The silhouette path must own the complete outline.");
        assert.equal(collapsed.pathStrokeWidth, "1.1px");
        assert.equal(collapsed.fragmentShoulderCount, 0, "Separate shoulder fragments must not paint the outline.");
        assert.equal(collapsed.gripBackground, "rgba(0, 0, 0, 0)", "The grip must not cover the silhouette stroke.");
        assert.equal(collapsed.bodyBoxShadow, "none", "The body must not draw a competing outline.");
        assert.deepEqual(collapsed.silhouetteBounds, collapsed.railBounds, "The single silhouette must cover the full rail bounds.");

        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readSilhouette();
        assert.equal(expanded.pathCount, 1, "Expansion must retain one outline path.");
        assert.match(expanded.pathData, /Z\s*$/i);
        assert.notEqual(expanded.pathData, collapsed.pathData, "The contour must extend with the drawer.");
        assert.deepEqual(expanded.silhouetteBounds, expanded.railBounds, "The expanded contour must cover the full rail bounds.");
    } finally {
        await page.close();
    }
});

test("T60 live preferences park, scale, hide, restore, and float the Mod bar without losing presentation state", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 320, height: 568 });
            await nextPage.addInitScript(() => {
                if (sessionStorage.getItem("cosimo.t60-test-initialized") === "true") {
                    return;
                }
                sessionStorage.setItem("cosimo.t60-test-initialized", "true");
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
                localStorage.removeItem("cosimo.auto-preview.enabled.v1");
            });
        },
    });

    const openDeveloperSettings = async () => {
        const presetBar = page.locator("cosimo-preset-bar");
        await presetBar.waitFor();
        await presetBar.evaluate((element) => {
            element.dispatchEvent(new CustomEvent("cosimo-open-perf-tuning"));
        });
        const settings = page.locator('[data-role="perf-tuning-page"]');
        await settings.waitFor({ state: "visible" });
        return settings;
    };

    const closeDeveloperSettings = async (settings) => {
        await settings.getByRole("button", { name: "Close developer settings" }).click();
        await settings.waitFor({ state: "detached" });
    };

    const readParkedGeometry = async () => page.evaluate(() => {
        const rectOf = (element) => {
            if (!(element instanceof Element)) {
                return null;
            }
            const bounds = element.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height,
            };
        };
        const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
        const row = document.querySelector('[data-role="mobile-global-mod-rail-tab"]');
        const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]');
        const portal = document.querySelector('[data-role="mobile-global-mod-rail-portal"]');
        const sources = [...document.querySelectorAll(
            '[data-role="mobile-global-mod-rail"] .mobile-global-mod-rail-parked-sources .rack-mod-source',
        )];
        const rowBounds = rectOf(row);
        const sourceBounds = sources.map(rectOf);
        const hitOwners = sources.map((source) => {
            const bounds = source.getBoundingClientRect();
            const hit = document.elementFromPoint(
                bounds.left + (bounds.width / 2),
                bounds.top + (bounds.height / 2),
            );
            return hit?.closest("button") === source;
        });
        const railStyle = rail instanceof HTMLElement ? getComputedStyle(rail) : null;
        const rowStyle = row instanceof HTMLElement ? getComputedStyle(row) : null;
        return {
            rail: rectOf(rail),
            row: rowBounds,
            tabs: rectOf(tabs),
            portal: rectOf(portal),
            sources: sourceBounds,
            hitOwners,
            scale: railStyle ? Number.parseFloat(railStyle.getPropertyValue("--rail-scale")) : null,
            outline: railStyle ? Number.parseFloat(railStyle.getPropertyValue("--rail-outline")) : null,
            outlineBackgroundSize: rowStyle?.backgroundSize ?? null,
            pageIndex: rail?.getAttribute("data-page-index") ?? null,
            pageKind: rail?.getAttribute("data-page-kind") ?? null,
            routeCount: rail?.querySelector('[data-role="mobile-global-mod-rail-route-count"]')?.textContent?.trim() ?? null,
            selectedLabel: rail?.querySelector('[data-role="mobile-global-mod-rail-selected"]')?.getAttribute("aria-label") ?? null,
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
    });

    try {
        const floatingRail = page.locator('[data-role="mobile-global-mod-rail"]');
        await floatingRail.waitFor();
        await page.waitForTimeout(240);
        assert.equal(await floatingRail.getAttribute("data-edge"), "right");
        assert.equal(
            await floatingRail.evaluate((element) => getComputedStyle(element).getPropertyValue("--rail-scale").trim()),
            "1.1",
        );

        await expandGlobalModRail(page);
        await floatingRail.getByRole("button", { name: "Toggle auto-preview" }).click();
        await floatingRail.getByRole("button", { name: "Next modulation-source group" }).click();
        await floatingRail.locator('[data-role="rack-mod-source-env-2"]').click();
        const quickSheet = page.locator('[data-role="quick-source-sheet"]');
        await quickSheet.waitFor({ state: "visible" });
        assert.match(await quickSheet.getAttribute("aria-label") ?? "", /Envelope 2/u);
        const soundBeforePreferences = await getHarnessSnapshot(page);

        let settings = await openDeveloperSettings();
        await settings.locator('[data-perf-tuning-key="modBar.scale"]').fill("1.3");
        await settings.locator('[data-mod-bar-placement="parked"]').click();
        await closeDeveloperSettings(settings);

        await floatingRail.locator('xpath=self::*[@data-placement="parked"]').waitFor();
        await page.waitForTimeout(220);
        assert.equal(await quickSheet.isVisible(), true, "Placement changes must preserve the open source editor.");
        let parked = await readParkedGeometry();
        assert.ok(parked.rail && parked.row && parked.tabs && parked.portal);
        assert.equal(parked.scale, 1.3);
        assert.equal(parked.pageIndex, "1", "The selected source's current group must survive parking.");
        assert.equal(parked.pageKind, "sources");
        assert.equal(parked.selectedLabel, "Envelope 2 selected");
        assert.equal(parked.routeCount, "0");
        assert.equal(Math.abs(parked.row.height - parked.tabs.height) <= 0.5, true);
        assert.equal(Math.abs(parked.row.height - 40) <= 0.5, true);
        assert.equal(Math.abs(parked.row.bottom - parked.tabs.top) <= 0.5, true);
        assert.equal(Math.abs(parked.portal.height - parked.row.height) <= 0.5, true);
        assert.equal(
            Math.abs(parked.outline - 1.3) <= 0.05,
            true,
            `The parked outline must follow the coefficient; measured ${parked.outline}px.`,
        );
        assert.match(parked.outlineBackgroundSize ?? "", /1\.3px/u);
        assert.equal(parked.sources.length, 3);
        assert.deepEqual(parked.hitOwners, [true, true, true]);
        for (const source of parked.sources) {
            assert.ok(source);
            assert.equal(Math.abs(source.height - parked.row.height) <= 0.5, true, "Every parked source owns the full row height.");
            assert.equal(rectContains(parked.row, source, 0.6), true, "Every parked source stays inside the fixed row.");
        }
        assert.equal(parked.documentFits, true);

        const parkedEnvelope = floatingRail.locator('[data-role="rack-mod-source-env-2"]');
        await parkedEnvelope.click();
        await quickSheet.waitFor({ state: "detached" });
        let stableParked = await readParkedGeometry();
        assert.ok(stableParked.row && stableParked.tabs);
        assert.equal(Math.abs(stableParked.row.height - 40) <= 0.5, true);
        assert.equal(Math.abs(stableParked.row.bottom - stableParked.tabs.top) <= 0.5, true);
        await parkedEnvelope.click();
        await quickSheet.waitFor({ state: "visible" });
        assert.match(await quickSheet.getAttribute("aria-label") ?? "", /Envelope 2/u);
        stableParked = await readParkedGeometry();
        assert.ok(stableParked.row && stableParked.tabs);
        assert.equal(Math.abs(stableParked.row.height - 40) <= 0.5, true);
        assert.equal(Math.abs(stableParked.row.bottom - stableParked.tabs.top) <= 0.5, true);

        await floatingRail.getByRole("button", { name: "Next Mod bar group" }).click();
        await floatingRail.getByRole("button", { name: "Next Mod bar group" }).click();
        await floatingRail.locator('xpath=self::*[@data-page-kind="tools"]').waitFor();
        assert.equal(
            await floatingRail.getByRole("button", { name: "Toggle auto-preview" }).getAttribute("aria-pressed"),
            "true",
            "Audition preference must survive source/tool paging and placement.",
        );
        await floatingRail.getByRole("button", { name: /Voice settings/u }).click();
        const voicePopover = page.locator('[data-role="mobile-global-mod-rail-voice-popover"]');
        await voicePopover.waitFor({ state: "visible" });

        await floatingRail.getByRole("button", { name: "Hide parked Mod bar" }).click();
        await page.waitForTimeout(240);
        const restore = page.getByRole("button", { name: "Restore parked Mod bar" });
        await restore.waitFor({ state: "visible" });
        parked = await readParkedGeometry();
        assert.ok(parked.portal && parked.tabs);
        assert.equal(parked.portal.height <= 0.5, true, "Hidden parked state must reserve zero row height.");
        assert.equal(await floatingRail.getAttribute("aria-hidden"), "true");
        assert.equal(await voicePopover.count(), 1, "Hide keeps the open Voice popover state mounted.");
        assert.equal(await quickSheet.isVisible(), true);
        const restoreHit = await restore.evaluate((button) => {
            const bounds = button.getBoundingClientRect();
            const visibleTabStyle = getComputedStyle(button, "::before");
            const hit = document.elementFromPoint(
                bounds.left + (bounds.width / 2),
                bounds.top + (bounds.height / 2),
            );
            const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]')?.getBoundingClientRect();
            return {
                ownsCenter: hit?.closest("button") === button,
                bottom: bounds.bottom,
                tabsTop: tabs?.top ?? null,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
                visibleWidth: Number.parseFloat(visibleTabStyle.width),
                visibleHeight: Number.parseFloat(visibleTabStyle.height),
            };
        });
        assert.equal(restoreHit.ownsCenter, true, "The restore target must own its hit center.");
        assert.ok(restoreHit.tabsTop !== null);
        assert.equal(Math.abs(restoreHit.bottom - restoreHit.tabsTop) <= 0.5, true);
        assert.equal(restoreHit.top < restoreHit.tabsTop, true, "Restore emerges upward over page content.");
        assert.equal(Math.abs(restoreHit.width - (44 * 1.3)) <= 0.5, true);
        assert.equal(Math.abs(restoreHit.height - (32 * 1.3)) <= 0.5, true);
        assert.equal(Math.abs(restoreHit.visibleWidth - (30 * 1.3)) <= 0.5, true);
        assert.equal(Math.abs(restoreHit.visibleHeight - (14 * 1.3)) <= 0.5, true);

        await restore.click();
        await page.waitForTimeout(220);
        parked = await readParkedGeometry();
        assert.equal(parked.pageIndex, "3", "Hide/restore must preserve the tool group.");
        assert.equal(parked.pageKind, "tools");
        assert.equal(await voicePopover.isVisible(), true, "Restore must return the open Voice popover.");
        assert.equal(await quickSheet.isVisible(), true);
        assert.ok(parked.portal && parked.row && parked.tabs);
        assert.equal(Math.abs(parked.portal.height - 40) <= 0.5, true);
        assert.equal(Math.abs(parked.row.bottom - parked.tabs.top) <= 0.5, true);

        settings = await openDeveloperSettings();
        await settings.locator('[data-perf-tuning-key="modBar.scale"]').fill("0.85");
        await settings.locator('[data-mod-bar-placement="floating-left"]').click();
        await closeDeveloperSettings(settings);
        await floatingRail.locator('xpath=self::*[@data-edge="left"]').waitFor();
        await floatingRail.locator('xpath=self::*[@data-expanded="true"]').waitFor();
        await page.waitForTimeout(220);
        assert.equal(await quickSheet.isVisible(), true);
        assert.equal(await voicePopover.isVisible(), true, "Scale/placement changes must preserve the Voice popover.");
        assert.equal(
            await floatingRail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "Envelope 2 selected",
        );
        const leftGeometry = await floatingRail.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const visiblePage = [...element.querySelectorAll(".rack-mod-page")]
                .findIndex((candidate) => candidate.getAttribute("aria-hidden") === "false");
            return {
                left: bounds.left,
                right: bounds.right,
                width: bounds.width,
                scale: Number.parseFloat(getComputedStyle(element).getPropertyValue("--rail-scale")),
                visiblePage,
                viewportWidth: innerWidth,
            };
        });
        assert.equal(leftGeometry.scale, 0.85);
        assert.equal(Math.abs(leftGeometry.width - (40 * 0.85)) <= 0.5, true);
        assert.equal(Math.abs(leftGeometry.left) <= 0.5, true);
        assert.equal(leftGeometry.right <= leftGeometry.viewportWidth, true);
        assert.equal(leftGeometry.visiblePage, 2, "The last source group survives the tool page and floating transition.");
        const soundAfterPreferences = await getHarnessSnapshot(page);
        assert.deepEqual(soundAfterPreferences.parameterValues, soundBeforePreferences.parameterValues);
        assert.deepEqual(soundAfterPreferences.storedState, soundBeforePreferences.storedState);

        settings = await openDeveloperSettings();
        await settings.locator('[data-perf-tuning-key="modBar.scale"]').fill("1.3");
        await settings.locator('[data-mod-bar-placement="parked"]').click();
        await closeDeveloperSettings(settings);
        await floatingRail.locator('xpath=self::*[@data-placement="parked"][@data-page-kind="tools"]').waitFor();
        await floatingRail.getByRole("button", { name: "Hide parked Mod bar" }).click();
        await page.waitForTimeout(220);
        await page.reload();
        await page.getByRole("button", { name: "Restore parked Mod bar" }).waitFor({ state: "visible" });
        const reloadedPreference = await page.evaluate(() => (
            JSON.parse(localStorage.getItem("cosimo.mod-bar.preferences.v1") ?? "null")
        ));
        assert.deepEqual(reloadedPreference, {
            version: 1,
            scale: 1.3,
            placement: "parked",
            parkedVisibility: "hidden",
        });
        const hiddenAfterReload = await readParkedGeometry();
        assert.ok(hiddenAfterReload.portal);
        assert.equal(hiddenAfterReload.portal.height <= 0.5, true);
        await page.getByRole("button", { name: "Restore parked Mod bar" }).click();
        await page.waitForTimeout(220);
        const restoredAfterReload = await readParkedGeometry();
        assert.ok(restoredAfterReload.row && restoredAfterReload.tabs);
        assert.equal(restoredAfterReload.scale, 1.3);
        assert.equal(Math.abs(restoredAfterReload.row.height - restoredAfterReload.tabs.height) <= 0.5, true);
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            localStorage.removeItem("cosimo.auto-preview.enabled.v1");
            sessionStorage.removeItem("cosimo.t60-test-initialized");
        }).catch(() => {});
        await page.close();
    }
});

test("T79 Developer Settings updates and persists keyboard geometry without remounting or changing sound", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                if (sessionStorage.getItem("cosimo.t79-keyboard-test-initialized") === "true") {
                    return;
                }
                sessionStorage.setItem("cosimo.t79-keyboard-test-initialized", "true");
                localStorage.removeItem("cosimo.keyboard.presentation.preferences.v1");
            });
        },
    });
    const readKeyboardGeometry = async () => page.evaluate(() => {
        const rectOf = (element) => {
            if (!(element instanceof Element)) {
                return null;
            }
            const bounds = element.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height,
            };
        };
        const keyboard = document.querySelector('[data-role="sticky-keyboard"] .keyboard');
        return {
            dock: rectOf(document.querySelector('[data-role="sticky-keyboard"]')),
            section: rectOf(document.querySelector('[data-role="sticky-keyboard"] > section')),
            rootNote: keyboard?.getAttribute("root-note") ?? null,
            noteCount: keyboard?.getAttribute("note-count") ?? null,
            naturalWidth: keyboard && "naturalWidth" in keyboard ? keyboard.naturalWidth : null,
            sameElement: globalThis.__cosimoT79Keyboard === keyboard,
        };
    });
    const openDeveloperSettings = async () => {
        await page.locator("cosimo-preset-bar").evaluate((element) => {
            element.dispatchEvent(new CustomEvent("cosimo-open-perf-tuning"));
        });
        const settings = page.locator('[data-role="perf-tuning-page"]');
        await settings.waitFor({ state: "visible" });
        return settings;
    };

    try {
        const soundBefore = await getHarnessSnapshot(page);
        await page.evaluate(() => {
            globalThis.__cosimoT79Keyboard = document.querySelector(
                '[data-role="sticky-keyboard"] .keyboard',
            );
        });
        const baseline = await readKeyboardGeometry();
        assert.ok(baseline.dock && baseline.section);
        assert.equal(baseline.rootNote, "36");
        assert.equal(baseline.noteCount, "18");
        assert.equal(baseline.sameElement, true);

        const settings = await openDeveloperSettings();
        const keyboardSection = settings.locator("section").filter({ hasText: /^Keyboard/ });
        await keyboardSection.locator('[data-perf-tuning-key="keyboard.visibleNoteCount"]').fill("14");
        await keyboardSection.locator('[data-perf-tuning-key="keyboard.heightScale"]').fill("1.25");
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardNoteCount === "14"
        ));

        const adjusted = await readKeyboardGeometry();
        assert.ok(adjusted.dock && adjusted.section);
        assert.equal(adjusted.sameElement, true, "A geometry edit must not replace the keyboard owner.");
        assert.equal(adjusted.rootNote, "36");
        assert.equal(adjusted.noteCount, "14");
        assert.ok(adjusted.naturalWidth > baseline.naturalWidth);
        assert.equal(
            Math.abs((adjusted.section.height / baseline.section.height) - 1.25) <= 0.01,
            true,
        );
        assert.deepEqual(
            await page.evaluate(() => (
                JSON.parse(localStorage.getItem("cosimo.keyboard.presentation.preferences.v1") ?? "null")
            )),
            { version: 1, visibleNoteCount: 14, heightScale: 1.25 },
        );
        await page.evaluate(() => {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: async (value) => {
                        globalThis.__cosimoT79CopiedSettings = value;
                    },
                },
            });
        });
        await settings.locator('[data-action="copy-perf-tuning-settings"]').click();
        await settings.locator('[data-role="perf-tuning-copy-feedback"][data-state="success"]').waitFor();
        const copiedSettings = await page.evaluate(() => globalThis.__cosimoT79CopiedSettings ?? "");
        assert.match(copiedSettings, /\n\[Keyboard\]\n/u);
        assert.match(copiedSettings, /keyboard\.visibleNoteCount: 14/u);
        assert.match(copiedSettings, /keyboard\.heightScale: 1\.25/u);

        await settings.getByRole("button", { name: "Close developer settings" }).click();
        await page.getByRole("button", { name: "Shift keyboard up one octave" }).click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "48"
        ));
        const shifted = await readKeyboardGeometry();
        assert.equal(shifted.noteCount, "14");
        assert.equal(shifted.rootNote, "48");

        const soundAfter = await getHarnessSnapshot(page);
        assert.deepEqual(soundAfter.parameterValues, soundBefore.parameterValues);
        assert.deepEqual(soundAfter.storedState, soundBefore.storedState);

        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardNoteCount === "14"
        ));
        const restored = await readKeyboardGeometry();
        assert.ok(restored.section);
        assert.equal(restored.rootNote, "36", "Root-note process state remains independent.");
        assert.equal(restored.noteCount, "14");
        assert.equal(
            Math.abs((restored.section.height / baseline.section.height) - 1.25) <= 0.01,
            true,
        );

        const restoredSettings = await openDeveloperSettings();
        const restoredKeyboardSection = restoredSettings.locator("section").filter({ hasText: /^Keyboard/ });
        await restoredKeyboardSection.getByRole("button", { name: "Reset" }).click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardNoteCount === "18"
        ));
        const reset = await readKeyboardGeometry();
        assert.ok(reset.section);
        assert.equal(reset.noteCount, "18");
        assert.equal(Math.abs(reset.section.height - baseline.section.height) <= 0.5, true);
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.keyboard.presentation.preferences.v1");
            sessionStorage.removeItem("cosimo.t79-keyboard-test-initialized");
            delete globalThis.__cosimoT79Keyboard;
            delete globalThis.__cosimoT79CopiedSettings;
        }).catch(() => {});
        await page.close();
    }
});

test("T79 the adjustable keybed fits edge-to-edge beside narrower octave paddles across layouts", async () => {
    const assertKeyboardUsesSurfaceWidth = (geometry, layoutName) => {
        const usableLeft = geometry.surface.left + geometry.surfaceBorderLeft;
        const usableRight = geometry.surface.right - geometry.surfaceBorderRight;
        assert.equal(
            Math.abs(geometry.dock.left - usableLeft) <= 0.5,
            true,
            `${layoutName} keyboard dock must reach the surface's usable left edge: ${JSON.stringify(geometry)}`,
        );
        assert.equal(
            Math.abs(geometry.dock.right - usableRight) <= 0.5,
            true,
            `${layoutName} keyboard dock must reach the surface's usable right edge: ${JSON.stringify(geometry)}`,
        );
        assert.equal(
            Math.abs(geometry.section.left - usableLeft - geometry.safeAreaLeft) <= 0.5,
            true,
            `${layoutName} keyboard may inset from the usable left edge only for safe area: ${JSON.stringify(geometry)}`,
        );
        assert.equal(
            Math.abs(usableRight - geometry.section.right - geometry.safeAreaRight) <= 0.5,
            true,
            `${layoutName} keyboard may inset from the usable right edge only for safe area: ${JSON.stringify(geometry)}`,
        );
    };

    for (const layout of [
        { name: "short phone", width: 320, height: 568, compact: true },
        { name: "tall phone", width: 393, height: 852, compact: true },
        { name: "plugin", width: 1120, height: 680, compact: false },
        { name: "desktop", width: 1440, height: 900, compact: false },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: layout.width, height: layout.height });
                await nextPage.addInitScript(() => {
                    localStorage.setItem(
                        "cosimo.keyboard.presentation.preferences.v1",
                        JSON.stringify({
                            version: 1,
                            visibleNoteCount: 30,
                            heightScale: 1,
                        }),
                    );
                });
            },
        });
        const readGeometry = async () => page.evaluate(() => {
            const pixels = (value) => Number.parseFloat(value) || 0;
            const rectOf = (element) => {
                if (!(element instanceof Element)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const keyboard = document.querySelector('[data-role="sticky-keyboard"] .keyboard');
            const rootNote = Number(keyboard?.getAttribute("root-note") ?? 0);
            const noteCount = Number(keyboard?.getAttribute("note-count") ?? 0);
            const naturalPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
            let naturalCount = 0;
            for (let noteOffset = 0; noteOffset < noteCount; noteOffset += 1) {
                if (naturalPitchClasses.has((rootNote + noteOffset) % 12)) {
                    naturalCount += 1;
                }
            }
            const surface = document.querySelector(".cosimo-surface");
            const dock = document.querySelector('[data-role="sticky-keyboard"]');
            const surfaceStyle = surface ? getComputedStyle(surface) : null;
            const dockStyle = dock ? getComputedStyle(dock) : null;
            return {
                surface: rectOf(surface),
                surfaceBorderLeft: pixels(surfaceStyle?.borderLeftWidth ?? "0"),
                surfaceBorderRight: pixels(surfaceStyle?.borderRightWidth ?? "0"),
                dock: rectOf(dock),
                section: rectOf(document.querySelector('[data-role="sticky-keyboard"] > section')),
                paddleRail: rectOf(document.querySelector('[data-role="sticky-keyboard"] .synth-control-rail')),
                upPaddle: rectOf(document.querySelector('button[aria-label="Shift keyboard up one octave"]')),
                keyShell: rectOf(document.querySelector('[data-role="sticky-keyboard"] .synth-grid-card-shell')),
                keyRecess: rectOf(document.querySelector('[data-role="sticky-keyboard"] .synth-display-recess')),
                noteCount,
                naturalCount,
                naturalWidth: keyboard && "naturalWidth" in keyboard ? keyboard.naturalWidth : null,
                safeAreaLeft: pixels(dockStyle?.paddingLeft ?? "0"),
                safeAreaRight: pixels(dockStyle?.paddingRight ?? "0"),
                documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            };
        });

        try {
            let geometry = await readGeometry();
            assert.ok(
                geometry.surface
                && geometry.dock
                && geometry.section
                && geometry.paddleRail
                && geometry.upPaddle
                && geometry.keyShell
                && geometry.keyRecess,
            );
            assertKeyboardUsesSurfaceWidth(geometry, layout.name);
            assert.equal(geometry.noteCount, 30);
            assert.equal(geometry.paddleRail.width, layout.compact ? 40 : 44);
            assert.equal(geometry.upPaddle.width, 36);
            assert.equal(geometry.upPaddle.height >= 40, true);
            assert.equal(Math.abs(geometry.keyRecess.left - geometry.keyShell.left) <= 0.5, true);
            assert.equal(Math.abs(geometry.keyRecess.right - geometry.keyShell.right) <= 0.5, true);
            assert.equal(
                (geometry.naturalWidth * geometry.naturalCount) <= geometry.keyRecess.width + 0.5,
                true,
                `${layout.name} must fit every requested note: ${JSON.stringify(geometry)}`,
            );
            assert.equal(geometry.documentFits, true);

            if (layout.name === "short phone") {
                await page.locator(".cosimo-surface").evaluate((surface) => {
                    surface.style.setProperty("--cosimo-safe-area-inset-left", "11px");
                    surface.style.setProperty("--cosimo-safe-area-inset-right", "13px");
                });
                await page.waitForFunction(() => {
                    const dock = document.querySelector('[data-role="sticky-keyboard"]');
                    const section = dock?.querySelector(":scope > section");
                    if (!(dock instanceof HTMLElement) || !(section instanceof HTMLElement)) {
                        return false;
                    }
                    const dockBounds = dock.getBoundingClientRect();
                    const sectionBounds = section.getBoundingClientRect();
                    return Math.abs(sectionBounds.left - dockBounds.left - 11) <= 0.5
                        && Math.abs(dockBounds.right - sectionBounds.right - 13) <= 0.5;
                });
                await page.waitForFunction(() => {
                    const keyboard = document.querySelector('[data-role="sticky-keyboard"] .keyboard');
                    const recess = document.querySelector(
                        '[data-role="sticky-keyboard"] .synth-display-recess',
                    );
                    if (!(keyboard instanceof Element) || !(recess instanceof Element)) {
                        return false;
                    }
                    const rootNote = Number(keyboard.getAttribute("root-note") ?? 0);
                    const noteCount = Number(keyboard.getAttribute("note-count") ?? 0);
                    const naturalPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
                    let naturalCount = 0;
                    for (let noteOffset = 0; noteOffset < noteCount; noteOffset += 1) {
                        if (naturalPitchClasses.has((rootNote + noteOffset) % 12)) {
                            naturalCount += 1;
                        }
                    }
                    const naturalWidth = "naturalWidth" in keyboard
                        ? Number(keyboard.naturalWidth)
                        : 0;
                    return (naturalWidth * naturalCount) <= recess.getBoundingClientRect().width + 0.5;
                });
                geometry = await readGeometry();
                assertKeyboardUsesSurfaceWidth(geometry, `${layout.name} with safe area`);
                assert.equal(
                    (geometry.naturalWidth * geometry.naturalCount) <= geometry.keyRecess.width + 0.5,
                    true,
                );
                assert.equal(geometry.documentFits, true);
            }
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.keyboard.presentation.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T79 height scaling reflows plugin and desktop workspaces around the complete keyboard region", async () => {
    for (const layout of [
        { name: "plugin", width: 1120, height: 680 },
        { name: "desktop", width: 1440, height: 900 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: layout.width, height: layout.height });
                await nextPage.addInitScript(() => {
                    localStorage.setItem(
                        "cosimo.keyboard.presentation.preferences.v1",
                        JSON.stringify({
                            version: 1,
                            visibleNoteCount: "responsive",
                            heightScale: 1.4,
                        }),
                    );
                });
            },
        });

        try {
            const geometry = await page.evaluate(() => {
                const rectOf = (element) => {
                    if (!(element instanceof Element)) {
                        return null;
                    }
                    const bounds = element.getBoundingClientRect();
                    return {
                        left: bounds.left,
                        right: bounds.right,
                        top: bounds.top,
                        bottom: bounds.bottom,
                        width: bounds.width,
                        height: bounds.height,
                    };
                };
                return {
                    surface: rectOf(document.querySelector(".cosimo-surface")),
                    workspace: rectOf(document.querySelector('[data-role="desktop-scroll-region"]')),
                    dock: rectOf(document.querySelector('[data-role="sticky-keyboard"]')),
                    section: rectOf(document.querySelector('[data-role="sticky-keyboard"] > section')),
                    recess: rectOf(document.querySelector('[data-role="sticky-keyboard"] .synth-display-recess')),
                    documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
                };
            });
            assert.ok(
                geometry.surface
                && geometry.workspace
                && geometry.dock
                && geometry.section
                && geometry.recess,
            );
            assert.equal(Math.abs(geometry.section.height - (160 * 1.4)) <= 0.5, true);
            assert.equal(Math.abs(geometry.recess.height - (112 * 1.4)) <= 0.5, true);
            assert.equal(geometry.workspace.height > 0, true);
            assert.equal(geometry.workspace.bottom <= geometry.dock.top + 0.5, true);
            assert.equal(geometry.dock.bottom <= geometry.surface.bottom + 0.5, true);
            assert.equal(geometry.documentFits, true, `${layout.name} overflows horizontally.`);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.keyboard.presentation.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T79 compact adjacent surfaces reflow around visible, hidden, drawer, and full-editor keyboard states", async () => {
    for (const layout of [
        {
            name: "short floating phone",
            width: 320,
            height: 568,
            placement: "floating-right",
            modBarScale: 0.85,
            exercisesKeyboardToggle: true,
        },
        {
            name: "tall parked phone",
            width: 393,
            height: 852,
            placement: "parked",
            modBarScale: 1.1,
            exercisesKeyboardToggle: false,
        },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: layout.width, height: layout.height });
                await nextPage.addInitScript(({ placement, modBarScale }) => {
                    localStorage.setItem(
                        "cosimo.keyboard.presentation.preferences.v1",
                        JSON.stringify({
                            version: 1,
                            visibleNoteCount: 12,
                            heightScale: 1.4,
                        }),
                    );
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: modBarScale,
                        placement,
                        parkedVisibility: "visible",
                    }));
                }, {
                    placement: layout.placement,
                    modBarScale: layout.modBarScale,
                });
            },
        });
        const readComposition = async () => page.evaluate(() => {
            const rectOf = (element) => {
                if (!(element instanceof Element)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
            const surface = document.querySelector(".cosimo-surface");
            return {
                surface: rectOf(surface),
                workspace: rectOf(document.querySelector('[data-role="mobile-workspace-panels"]')),
                bottomDock: rectOf(document.querySelector('[data-role="mobile-bottom-dock"]')),
                tabs: rectOf(document.querySelector('[data-role="mobile-workspace-tabs"]')),
                keyboard: rectOf(keyboard),
                keyboardSection: rectOf(document.querySelector('[data-role="sticky-keyboard"] > section')),
                rail: rectOf(document.querySelector('[data-role="mobile-global-mod-rail"]')),
                drawer: rectOf(document.querySelector('[data-role="quick-source-sheet"]')),
                fullEditor: rectOf(document.querySelector('[data-role="mseg-editor-dialog"]')),
                fullEditorControls: rectOf(document.querySelector('[data-role="mseg-editor-controls"]')),
                keyboardVisible: keyboard instanceof HTMLElement
                    && getComputedStyle(keyboard).display !== "none",
                keyboardBottomInset: surface instanceof HTMLElement
                    ? Number.parseFloat(
                        getComputedStyle(surface).getPropertyValue("--cosimo-keyboard-bottom-inset"),
                    ) || 0
                    : 0,
                documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            };
        });
        const assertVisibleKeyboardComposition = (geometry, label) => {
            assert.ok(
                geometry.surface
                && geometry.workspace
                && geometry.bottomDock
                && geometry.tabs
                && geometry.keyboard
                && geometry.keyboardSection
                && geometry.rail,
                `${layout.name} ${label}: expected the complete compact composition.`,
            );
            assert.equal(geometry.keyboardVisible, true);
            assert.equal(Math.abs(geometry.keyboardSection.height - (84 * 1.4)) <= 0.5, true);
            assert.equal(geometry.workspace.bottom <= geometry.bottomDock.top + 0.75, true);
            assert.equal(geometry.tabs.bottom <= geometry.keyboard.top + 0.75, true);
            assert.equal(geometry.rail.bottom <= geometry.keyboard.top + 0.75, true);
            assert.equal(geometry.keyboard.bottom <= geometry.surface.bottom + 0.75, true);
            assert.equal(
                Math.abs(geometry.keyboardBottomInset - (layout.height - geometry.keyboard.top)) <= 0.75,
                true,
            );
            assert.equal(geometry.documentFits, true);
        };

        try {
            const rail = page.locator(layout.placement === "parked"
                ? '[data-role="mobile-global-mod-rail"][data-placement="parked"]'
                : '[data-role="mobile-global-mod-rail"][data-edge="right"]');
            await rail.waitFor();
            await page.locator('[data-role="sticky-keyboard"]').evaluate((keyboard) => {
                keyboard.closest(".cosimo-surface")?.style.setProperty(
                    "--cosimo-safe-area-inset-bottom",
                    "9px",
                );
            });
            await page.waitForFunction(() => {
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                const surface = document.querySelector(".cosimo-surface");
                if (!(keyboard instanceof HTMLElement) || !(surface instanceof HTMLElement)) {
                    return false;
                }
                const reserved = Number.parseFloat(
                    getComputedStyle(surface).getPropertyValue("--cosimo-keyboard-bottom-inset"),
                );
                return Math.abs(
                    reserved - (window.innerHeight - keyboard.getBoundingClientRect().top),
                ) <= 0.75;
            });

            const initial = await readComposition();
            assertVisibleKeyboardComposition(initial, "initial");

            if (layout.exercisesKeyboardToggle) {
                await expandGlobalModRail(page);
                const keyboardToggle = rail.locator(
                    '[data-role="mobile-global-mod-rail-keyboard-toggle"]',
                );
                await keyboardToggle.click();
                await page.waitForFunction(() => {
                    const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                    const surface = document.querySelector(".cosimo-surface");
                    return keyboard instanceof HTMLElement
                        && getComputedStyle(keyboard).display === "none"
                        && surface instanceof HTMLElement
                        && (Number.parseFloat(
                            getComputedStyle(surface).getPropertyValue("--cosimo-keyboard-bottom-inset"),
                        ) || 0) <= 0.5;
                });
                const hidden = await readComposition();
                assert.equal(hidden.keyboardVisible, false);
                assert.ok(hidden.workspace && hidden.tabs && hidden.rail);
                assert.equal(hidden.workspace.height > initial.workspace.height, true);
                assert.equal(hidden.tabs.bottom > initial.tabs.bottom, true);
                assert.equal(hidden.rail.bottom <= layout.height + 0.75, true);

                await keyboardToggle.click();
                await page.waitForFunction(() => {
                    const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                    const surface = document.querySelector(".cosimo-surface");
                    if (!(keyboard instanceof HTMLElement) || !(surface instanceof HTMLElement)) {
                        return false;
                    }
                    const height = keyboard.getBoundingClientRect().height;
                    const reserved = Number.parseFloat(
                        getComputedStyle(surface).getPropertyValue("--cosimo-keyboard-bottom-inset"),
                    );
                    return height > 0 && Math.abs(
                        reserved - (window.innerHeight - keyboard.getBoundingClientRect().top),
                    ) <= 0.75;
                });
                await collapseGlobalModRail(page);
                assertVisibleKeyboardComposition(await readComposition(), "restored");
            }

            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
            const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
            await drawer.waitFor();
            await page.waitForTimeout(220);
            const withDrawer = await readComposition();
            assertVisibleKeyboardComposition(withDrawer, "drawer");
            assert.ok(withDrawer.drawer);
            assert.equal(
                Math.abs(withDrawer.drawer.bottom - withDrawer.keyboard.top) <= 1.5,
                true,
                `${layout.name}: drawer must meet the measured keyboard edge: ${JSON.stringify(withDrawer)}`,
            );
            if (layout.placement === "parked") {
                assert.equal(
                    Math.abs(withDrawer.rail.bottom - withDrawer.drawer.top) <= 0.75,
                    true,
                    `${layout.name}: parked row must remain attached to the shifted drawer lip.`,
                );
            }

            await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
            await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
            await page.waitForFunction(() => {
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                const surface = document.querySelector(".cosimo-surface");
                return keyboard instanceof HTMLElement
                    && getComputedStyle(keyboard).display === "none"
                    && surface instanceof HTMLElement
                    && (Number.parseFloat(
                        getComputedStyle(surface).getPropertyValue("--cosimo-keyboard-bottom-inset"),
                    ) || 0) <= 0.5;
            });
            const focused = await readComposition();
            assert.equal(focused.keyboardVisible, false);
            assert.equal(focused.tabs, null);
            assert.equal(focused.drawer, null);
            assert.ok(focused.surface && focused.fullEditor && focused.fullEditorControls && focused.rail);
            assert.equal(focused.fullEditor.bottom <= focused.surface.bottom + 0.75, true);
            assert.equal(focused.fullEditorControls.bottom <= focused.fullEditor.bottom + 0.75, true);
            assert.equal(focused.rail.bottom <= focused.surface.bottom + 0.75, true);
            if (layout.placement === "parked") {
                assert.equal(focused.fullEditorControls.bottom <= focused.rail.top + 0.75, true);
            }

            await page.locator('[data-action="shell-back"]').click();
            await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });
            await page.waitForFunction(() => {
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                return keyboard instanceof HTMLElement
                    && getComputedStyle(keyboard).display !== "none"
                    && keyboard.getBoundingClientRect().height > 0;
            });
            assertVisibleKeyboardComposition(await readComposition(), "returned from full editor");
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.keyboard.presentation.preferences.v1");
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T60 parked 320px source and tool targets grow with scale and own their inset hit area", async () => {
    const scales = [
        { scale: 0.85, sourceWidth: 44.1094, toolWidth: 44.1094 },
        { scale: 1.1, sourceWidth: 46.9844, toolWidth: 46.9844 },
        { scale: 1.3, sourceWidth: 49.2813, toolWidth: 49.2813 },
    ];
    const measuredSourceWidths = [];
    const measuredToolWidths = [];

    for (const expected of scales) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: 320, height: 568 });
                await nextPage.addInitScript(({ scale }) => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                }, { scale: expected.scale });
            },
        });

        const readTargetOwnership = async (selector) => page.locator(selector).evaluateAll((targets) => (
            targets.map((target) => {
                const bounds = target.getBoundingClientRect();
                const inset = 3;
                const points = [
                    [bounds.left + inset, bounds.top + inset],
                    [bounds.right - inset, bounds.top + inset],
                    [bounds.left + inset, bounds.bottom - inset],
                    [bounds.right - inset, bounds.bottom - inset],
                    [bounds.left + (bounds.width / 2), bounds.top + (bounds.height / 2)],
                ];
                return {
                    width: bounds.width,
                    height: bounds.height,
                    insetOwners: points.map(([x, y]) => (
                        document.elementFromPoint(x, y)?.closest("button") === target
                    )),
                };
            })
        ));

        try {
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            await page.waitForTimeout(220);

            const sources = await readTargetOwnership(
                '[data-role="mobile-global-mod-rail"] .mobile-global-mod-rail-parked-sources .rack-mod-source',
            );
            assert.equal(sources.length, 3);
            for (const source of sources) {
                assert.equal(Math.abs(source.width - expected.sourceWidth) <= 0.15, true);
                assert.equal(Math.abs(source.height - 40) <= 0.5, true);
                assert.equal(source.width >= 44, true);
                assert.deepEqual(source.insetOwners, source.insetOwners.map(() => true));
            }
            measuredSourceWidths.push(sources[0].width);

            for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
                await rail.getByRole("button", { name: "Next Mod bar group" }).click();
            }
            await rail.locator('xpath=self::*[@data-page-kind="tools"]').waitFor();
            const tools = await readTargetOwnership(
                '[data-role="mobile-global-mod-rail"] .mobile-global-mod-rail-parked-tools > button',
            );
            assert.equal(tools.length, 3);
            for (const tool of tools) {
                assert.equal(Math.abs(tool.width - expected.toolWidth) <= 0.15, true);
                assert.equal(Math.abs(tool.height - 40) <= 0.5, true);
                assert.equal(
                    tool.width >= 44,
                    true,
                    `Scale ${expected.scale} parked tool width fell below 44px: ${tool.width}`,
                );
                assert.deepEqual(tool.insetOwners, tool.insetOwners.map(() => true));
            }
            measuredToolWidths.push(tools[0].width);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }

    assert.deepEqual(
        measuredSourceWidths,
        [...measuredSourceWidths].sort((left, right) => left - right),
        "Increasing scale must never shrink a parked source target.",
    );
    assert.deepEqual(
        measuredToolWidths,
        [...measuredToolWidths].sort((left, right) => left - right),
        "Increasing scale must never shrink a parked tool target.",
    );
});

test("T60 parked trigger note stays fixed immediately before the right paddle on every page", async () => {
    for (const viewport of [
        { width: 320, height: 568 },
        { width: 393, height: 852 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize(viewport);
                await nextPage.addInitScript(() => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: 1.1,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                });
            },
        });

        try {
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            await page.waitForTimeout(220);

            for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
                const geometry = await rail.evaluate((element) => {
                    const note = element.querySelector('[data-role="mobile-global-mod-rail-note"]');
                    const next = element.querySelector('[data-role="mobile-global-mod-rail-parked-next"]');
                    const pageBody = element.querySelector('[data-role="mobile-global-mod-rail-parked-page"]');
                    if (!(note instanceof HTMLButtonElement)
                            || !(next instanceof HTMLButtonElement)
                            || !(pageBody instanceof HTMLElement)) {
                        return null;
                    }
                    const noteRect = note.getBoundingClientRect();
                    const nextRect = next.getBoundingClientRect();
                    const bodyRect = pageBody.getBoundingClientRect();
                    const inset = 3;
                    const hitPoints = [
                        [noteRect.left + inset, noteRect.top + inset],
                        [noteRect.right - inset, noteRect.top + inset],
                        [noteRect.left + inset, noteRect.bottom - inset],
                        [noteRect.right - inset, noteRect.bottom - inset],
                        [noteRect.left + (noteRect.width / 2), noteRect.top + (noteRect.height / 2)],
                    ];
                    return {
                        pageIndex: element.getAttribute("data-page-index"),
                        pageKind: element.getAttribute("data-page-kind"),
                        noteWidth: noteRect.width,
                        noteHeight: noteRect.height,
                        pageEndsBeforeNote: bodyRect.right <= noteRect.left + 0.5,
                        noteTouchesNext: Math.abs(noteRect.right - nextRect.left) <= 0.5,
                        immediatelyBeforeNext: note.nextElementSibling === next,
                        hitOwners: hitPoints.map(([x, y]) => (
                            document.elementFromPoint(x, y)?.closest("button") === note
                        )),
                    };
                });

                assert.ok(geometry, `${viewport.width}px page ${pageIndex}: note and paddle exist`);
                assert.equal(geometry.pageIndex, String(pageIndex));
                assert.equal(geometry.pageKind, pageIndex === 3 ? "tools" : "sources");
                assert.equal(geometry.noteWidth >= 43.5, true);
                assert.equal(geometry.noteHeight >= 39.5, true);
                assert.equal(geometry.pageEndsBeforeNote, true);
                assert.equal(geometry.noteTouchesNext, true);
                assert.equal(geometry.immediatelyBeforeNext, true);
                assert.deepEqual(geometry.hitOwners, [true, true, true, true, true]);

                if (pageIndex < 3) {
                    await rail.getByRole("button", { name: "Next Mod bar group" }).click();
                    await rail.locator(`xpath=self::*[@data-page-index="${pageIndex + 1}"]`).waitFor();
                }
            }
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T60 preserves the explicitly visible source group in both placement directions", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 320, height: 568 });
            await nextPage.addInitScript(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
            });
        },
    });

    const changePlacement = async (placement) => {
        const presetBar = page.locator("cosimo-preset-bar");
        await presetBar.evaluate((element) => {
            element.dispatchEvent(new CustomEvent("cosimo-open-perf-tuning"));
        });
        const settings = page.locator('[data-role="perf-tuning-page"]');
        await settings.waitFor({ state: "visible" });
        await settings.locator(`[data-mod-bar-placement="${placement}"]`).click();
        await settings.getByRole("button", { name: "Close developer settings" }).click();
        await settings.waitFor({ state: "detached" });
    };

    const visibleFloatingPage = async (rail) => rail.evaluate((element) => (
        [...element.querySelectorAll(".rack-mod-page")]
            .findIndex((candidate) => candidate.getAttribute("aria-hidden") === "false")
    ));

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await expandGlobalModRail(page);
        await rail.getByRole("button", { name: "Next modulation-source group" }).click();
        await rail.getByRole("button", { name: "Next modulation-source group" }).click();
        assert.equal(await visibleFloatingPage(rail), 2);
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "MSEG 1 selected",
            "Paging must not be conflated with the selected source's slot.",
        );

        await changePlacement("parked");
        await rail.locator('xpath=self::*[@data-placement="parked"][@data-page-index="2"][@data-page-kind="sources"]').waitFor();
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "MSEG 1 selected",
        );

        await rail.getByRole("button", { name: "Previous Mod bar group" }).click();
        await rail.locator('xpath=self::*[@data-page-index="1"][@data-page-kind="sources"]').waitFor();
        await changePlacement("floating-right");
        await rail.locator('xpath=self::*[@data-edge="right"][@data-expanded="true"]').waitFor();
        assert.equal(await visibleFloatingPage(rail), 1, "Parked source paging must survive floating.");

        await changePlacement("parked");
        await rail.locator('xpath=self::*[@data-page-index="1"][@data-page-kind="sources"]').waitFor();
        await rail.getByRole("button", { name: "Next Mod bar group" }).click();
        await rail.locator('xpath=self::*[@data-page-index="2"][@data-page-kind="sources"]').waitFor();
        await rail.getByRole("button", { name: "Next Mod bar group" }).click();
        await rail.locator('xpath=self::*[@data-page-kind="tools"]').waitFor();
        await changePlacement("floating-left");
        await rail.locator('xpath=self::*[@data-edge="left"][@data-expanded="true"]').waitFor();
        assert.equal(
            await visibleFloatingPage(rail),
            2,
            "The parked-only tools page must retain the last explicit source group when floating.",
        );
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.close();
    }
});

test("T60 live placement changes preserve an active source drag through its real drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const source = rail.locator('[data-role="rack-mod-source-mseg-1"]');
        const target = page.locator('[data-rack-mod-target].is-selected-target');
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox);
        const sourceCenter = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };

        await page.mouse.move(sourceCenter.x, sourceCenter.y);
        await page.mouse.down();
        await page.mouse.move(sourceCenter.x - 12, sourceCenter.y + 12, { steps: 3 });
        await rail.locator('xpath=self::*[@data-mapping-active="true"]').waitFor();

        await page.evaluate(() => {
            document.querySelector("cosimo-preset-bar")?.dispatchEvent(
                new CustomEvent("cosimo-open-perf-tuning"),
            );
        });
        const settings = page.locator('[data-role="perf-tuning-page"]');
        await settings.waitFor({ state: "visible" });
        await settings.locator('[data-mod-bar-placement="parked"]').evaluate((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error("Parked placement button missing.");
            }
            button.click();
        });
        await rail.locator('xpath=self::*[@data-placement="parked"]').waitFor();
        await settings.getByRole("button", { name: "Close developer settings" }).evaluate((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error("Developer settings close button missing.");
            }
            button.click();
        });
        await settings.waitFor({ state: "detached" });
        assert.equal(
            await rail.getAttribute("data-mapping-active"),
            "true",
            "Replacing the floating tree must not cancel the active mapping gesture.",
        );

        const targetBox = await target.boundingBox();
        assert.ok(targetBox);
        await page.mouse.move(
            targetBox.x + (targetBox.width / 2),
            targetBox.y + (targetBox.height / 2),
            { steps: 8 },
        );
        await page.mouse.up();
        await page.waitForTimeout(120);
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.distortion#1.distortionDriveDb"
            )),
            true,
            "The pre-placement drag must complete the same real mapping after parking.",
        );
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("T60 hide and restore keep quick and full MSEG editors mounted without dead transparent hit areas", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 320, height: 568 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "parked",
                    parkedVisibility: "visible",
                }));
            });
        },
    });

    const readRestoreOwnership = async (surfaceSelector) => page.evaluate((selector) => {
        const restore = document.querySelector('[data-role="mobile-global-mod-rail-restore"]');
        const surface = document.querySelector(selector);
        if (!(restore instanceof HTMLButtonElement) || !(surface instanceof HTMLElement)) {
            return null;
        }
        const bounds = restore.getBoundingClientRect();
        const visibleStyle = getComputedStyle(restore, "::before");
        const visibleWidth = Number.parseFloat(visibleStyle.width);
        const visibleHeight = Number.parseFloat(visibleStyle.height);
        const transparentPoints = [
            { x: bounds.left + (bounds.width / 2), y: bounds.top + 3 },
            { x: bounds.left + 3, y: bounds.bottom - (visibleHeight / 2) },
            { x: bounds.right - 3, y: bounds.bottom - (visibleHeight / 2) },
        ];
        const visibleCenter = {
            x: bounds.left + (bounds.width / 2),
            y: bounds.bottom - (visibleHeight / 2),
        };
        const surfaceStack = (point) => {
            const stack = document.elementsFromPoint(point.x, point.y);
            const restoreIndex = stack.findIndex((candidate) => restore.contains(candidate));
            const surfaceIndex = stack.findIndex((candidate) => surface.contains(candidate));
            return {
                surfaceIsUnder: surfaceIndex >= 0,
                restoreMasksSurface: restoreIndex >= 0
                    && surfaceIndex >= 0
                    && restoreIndex < surfaceIndex,
                point,
                owners: stack.slice(0, 5).map((candidate) => (
                    candidate.closest("[data-role]")?.getAttribute("data-role") ?? candidate.tagName
                )),
            };
        };
        const surfaceBounds = surface.getBoundingClientRect();
        return {
            visibleWidth,
            visibleHeight,
            restoreBounds: {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
            },
            surfaceBounds: {
                left: surfaceBounds.left,
                right: surfaceBounds.right,
                top: surfaceBounds.top,
                bottom: surfaceBounds.bottom,
            },
            visibleCenterOwned: document.elementFromPoint(
                visibleCenter.x,
                visibleCenter.y,
            )?.closest("button") === restore,
            transparentSurfaceOwnership: transparentPoints.map(surfaceStack),
        };
    }, surfaceSelector);

    const assertRestoreOwnership = (ownership, label, { maySitAboveSurface = false } = {}) => {
        assert.ok(ownership);
        assert.equal(ownership.visibleCenterOwned, true, `${label}: visible restore center must remain usable.`);
        assert.equal(Math.abs(ownership.visibleWidth - 33) <= 0.5, true);
        assert.equal(Math.abs(ownership.visibleHeight - 15.4) <= 0.5, true);
        if (maySitAboveSurface) {
            assert.equal(
                ownership.restoreBounds.bottom <= ownership.surfaceBounds.top + 0.5,
                true,
                `${label}: the hidden restore tab must stay above the moved drawer surface.`,
            );
            assert.equal(
                Math.abs(ownership.restoreBounds.bottom - ownership.surfaceBounds.top) <= 1.5,
                true,
                `${label}: the hidden restore tab must remain attached to the drawer lip.`,
            );
        }
        for (const point of ownership.transparentSurfaceOwnership) {
            if (!maySitAboveSurface) {
                assert.equal(
                    point.surfaceIsUnder,
                    true,
                    `${label}: expected editor surface beneath restore bounds: ${JSON.stringify(ownership)}`,
                );
            }
            assert.equal(
                point.restoreMasksSurface,
                false,
                `${label}: transparent restore bounds stole editor input: ${JSON.stringify(ownership)}`,
            );
        }
    };

    const clickVisibleRestore = async () => {
        const restore = page.getByRole("button", { name: "Restore parked Mod bar" });
        const target = await restore.evaluate((button) => {
            const bounds = button.getBoundingClientRect();
            const visibleHeight = Number.parseFloat(getComputedStyle(button, "::before").height);
            return {
                x: bounds.width / 2,
                y: bounds.height - (visibleHeight / 2),
            };
        });
        await restore.click({ position: target });
    };

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
        await rail.waitFor();
        await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        const quickSheet = page.locator('[data-role="quick-source-sheet"]');
        await quickSheet.waitFor();
        await quickSheet.evaluate((element) => {
            globalThis.__cosimoT60QuickSheet = element;
        });

        await rail.getByRole("button", { name: "Hide parked Mod bar" }).click();
        await page.getByRole("button", { name: "Restore parked Mod bar" }).waitFor();
        assert.equal(
            await quickSheet.evaluate((element) => globalThis.__cosimoT60QuickSheet === element),
            true,
            "Hiding must preserve the mounted quick-editor instance.",
        );
        assertRestoreOwnership(
            await readRestoreOwnership('[data-role="quick-source-sheet-grip"]'),
            "quick editor",
            { maySitAboveSurface: true },
        );

        await clickVisibleRestore();
        await rail.getByRole("button", { name: "Hide parked Mod bar" }).waitFor();
        assert.equal(
            await quickSheet.evaluate((element) => globalThis.__cosimoT60QuickSheet === element),
            true,
        );
        await quickSheet.locator('[data-role="quick-source-sheet-full-editor"]').evaluate((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                throw new Error("Quick-editor Full button missing.");
            }
            button.click();
        });
        const fullEditor = page.locator('[data-role="mseg-editor-dialog"]');
        await fullEditor.waitFor();
        await fullEditor.evaluate((element) => {
            globalThis.__cosimoT60FullEditor = element;
        });

        await rail.getByRole("button", { name: "Hide parked Mod bar" }).click();
        await page.getByRole("button", { name: "Restore parked Mod bar" }).waitFor();
        assert.equal(
            await fullEditor.evaluate((element) => globalThis.__cosimoT60FullEditor === element),
            true,
            "Hiding must preserve the mounted full-editor instance.",
        );
        assertRestoreOwnership(
            await readRestoreOwnership('[data-role="mseg-editor-controls"]'),
            "full editor",
        );
        await clickVisibleRestore();
        assert.equal(
            await fullEditor.evaluate((element) => globalThis.__cosimoT60FullEditor === element),
            true,
            "Restoring must not replace the full-editor instance.",
        );
        await page.locator('[data-action="shell-back"]').click();
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            delete globalThis.__cosimoT60QuickSheet;
            delete globalThis.__cosimoT60FullEditor;
        }).catch(() => {});
        await page.close();
    }
});

test("T70 parked Mod bar follows the open MSEG drawer lip without stealing editor hits", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "parked",
                    parkedVisibility: "visible",
                }));
            });
        },
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
        await rail.waitFor();
        await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
        await drawer.waitFor();
        const geometry = await page.evaluate(() => {
            const rectOf = (element) => {
                if (!(element instanceof Element)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const drawerElement = document.querySelector(
                '[data-role="quick-source-sheet"][data-source-kind="mseg"]',
            );
            const railElement = document.querySelector(
                '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
            );
            const editorTargets = [...(drawerElement?.querySelectorAll([
                '[data-role="mseg-point"]',
                '[data-role="quick-source-sheet-cell-rate"]',
                '[data-role="quick-source-sheet-cell-morph"]',
                '[data-role="mseg-shape-a"]',
                '[data-role="mseg-shape-b"]',
                '[data-role="mseg-loop-toggle"]',
            ].join(", ")) ?? [])].filter((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            });
            return {
                drawer: rectOf(drawerElement),
                rail: rectOf(railElement),
                targetHits: editorTargets.map((element) => {
                    const bounds = element.getBoundingClientRect();
                    const center = {
                        x: bounds.left + (bounds.width / 2),
                        y: bounds.top + (bounds.height / 2),
                    };
                    const hit = document.elementFromPoint(center.x, center.y);
                    return {
                        role: element.getAttribute("data-role"),
                        owned: hit !== null && element.contains(hit),
                        hitRole: hit?.closest("[data-role]")?.getAttribute("data-role") ?? hit?.tagName ?? null,
                    };
                }),
            };
        });

        assert.ok(geometry.drawer && geometry.rail);
        assert.equal(
            Math.abs(geometry.rail.bottom - geometry.drawer.top) <= 0.5,
            true,
            `Parked row must meet the compact drawer lip: ${JSON.stringify(geometry)}`,
        );
        assert.equal(geometry.rail.bottom <= geometry.drawer.top + 0.5, true);
        assert.equal(geometry.targetHits.length >= 7, true);
        assert.deepEqual(
            geometry.targetHits.filter((target) => !target.owned),
            [],
            `The parked row stole MSEG editor hit points: ${JSON.stringify(geometry)}`,
        );
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.close();
    }
});

test("T70 parked row tracks live MSEG drawer movement and detents across compact phones", async () => {
    for (const viewport of [
        { name: "portrait phone", width: 393, height: 852 },
        { name: "landscape phone", width: 568, height: 320 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: viewport.width, height: viewport.height });
                await nextPage.addInitScript(() => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: 1.1,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                });
            },
        });

        const readAttachment = async () => page.evaluate(() => {
            const drawer = document.querySelector('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
            const rail = document.querySelector(
                '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
            );
            if (!(drawer instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
                return null;
            }
            const drawerBounds = drawer.getBoundingClientRect();
            const railBounds = rail.getBoundingClientRect();
            return {
                drawerTop: drawerBounds.top,
                railBottom: railBounds.bottom,
                gap: drawerBounds.top - railBounds.bottom,
                detent: drawer.getAttribute("data-detent"),
                sourceSlot: drawer.getAttribute("data-source-slot"),
                pageIndex: rail.getAttribute("data-page-index"),
                selectedLabel: rail.querySelector(
                    '[data-role="mobile-global-mod-rail-selected"]',
                )?.getAttribute("aria-label") ?? null,
            };
        });
        const assertAttached = async (label) => {
            const attachment = await readAttachment();
            assert.ok(attachment, `${viewport.name} ${label}: drawer and parked row must exist.`);
            assert.equal(
                Math.abs(attachment.gap) <= 0.75,
                true,
                `${viewport.name} ${label}: parked row left the live drawer lip: ${JSON.stringify(attachment)}`,
            );
            assert.equal(attachment.sourceSlot, "1");
            assert.equal(attachment.selectedLabel, "MSEG 1 selected");
            return attachment;
        };
        const startTransitionGapMonitor = async () => {
            await page.evaluate(() => {
                const monitor = { gaps: [], active: true };
                globalThis.__cosimoT70GapMonitor = monitor;
                const sample = () => {
                    if (!monitor.active) {
                        return;
                    }
                    const drawer = document.querySelector(
                        '[data-role="quick-source-sheet"][data-source-kind="mseg"]',
                    );
                    const rail = document.querySelector(
                        '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
                    );
                    if (drawer instanceof HTMLElement && rail instanceof HTMLElement) {
                        monitor.gaps.push(
                            drawer.getBoundingClientRect().top - rail.getBoundingClientRect().bottom,
                        );
                    }
                    requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });
        };
        const stopTransitionGapMonitor = async (label) => {
            await page.waitForTimeout(240);
            const gaps = await page.evaluate(() => {
                const monitor = globalThis.__cosimoT70GapMonitor;
                if (!monitor) {
                    return [];
                }
                monitor.active = false;
                return monitor.gaps;
            });
            assert.equal(gaps.length > 2, true, `${viewport.name} ${label}: expected transition samples.`);
            assert.equal(
                Math.max(...gaps.map((gap) => Math.abs(gap))) <= 0.75,
                true,
                `${viewport.name} ${label}: parked row jumped during detent settling: ${JSON.stringify(gaps)}`,
            );
        };
        const beginGripDrag = async () => {
            const grip = page.locator('[data-role="quick-source-sheet-grip"]');
            const bounds = await grip.boundingBox();
            assert.ok(bounds);
            const start = {
                x: bounds.x + (bounds.width / 2),
                y: bounds.y + (bounds.height / 2),
            };
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            return start;
        };

        try {
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            const shapeBefore = readStoredMsegShape(await getHarnessSnapshot(page));
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
            await page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]').waitFor();
            await assertAttached("compact detent");

            await rail.getByRole("button", { name: "Next Mod bar group" }).click();
            await rail.locator('xpath=self::*[@data-page-index="1"]').waitFor();
            const permanentChrome = await rail.evaluate((element) => {
                const note = element.querySelector('[data-role="mobile-global-mod-rail-note"]');
                const next = element.querySelector('[data-role="mobile-global-mod-rail-parked-next"]');
                if (!(note instanceof HTMLButtonElement) || !(next instanceof HTMLButtonElement)) {
                    return null;
                }
                const noteBounds = note.getBoundingClientRect();
                const noteCenter = {
                    x: noteBounds.left + (noteBounds.width / 2),
                    y: noteBounds.top + (noteBounds.height / 2),
                };
                return {
                    noteImmediatelyBeforeNext: note.nextElementSibling === next,
                    noteTouchesNext: Math.abs(noteBounds.right - next.getBoundingClientRect().left) <= 0.5,
                    noteOwnsHit: document.elementFromPoint(noteCenter.x, noteCenter.y)?.closest("button") === note,
                };
            });
            assert.deepEqual(permanentChrome, {
                noteImmediatelyBeforeNext: true,
                noteTouchesNext: true,
                noteOwnsHit: true,
            });

            let dragStart = await beginGripDrag();
            for (const fraction of [0.05, 0.1, 0.16]) {
                await page.mouse.move(
                    dragStart.x,
                    dragStart.y - (viewport.height * fraction),
                    { steps: 2 },
                );
                await waitForReactFrames(page, 1);
                const attachment = await assertAttached(`live upward drag ${fraction}`);
                assert.equal(attachment.detent, "dragging");
                assert.equal(attachment.pageIndex, "1");
            }
            await startTransitionGapMonitor();
            await page.mouse.up();
            await stopTransitionGapMonitor("compact-to-half transition");
            const halfAttachment = await assertAttached("half detent");
            assert.equal(halfAttachment.detent, "half");
            assert.equal(halfAttachment.pageIndex, "1");

            dragStart = await beginGripDrag();
            await page.mouse.move(
                dragStart.x,
                dragStart.y + (viewport.height * 0.19),
                { steps: 6 },
            );
            await assertAttached("live downward drag");
            await startTransitionGapMonitor();
            await page.mouse.up();
            await stopTransitionGapMonitor("half-to-compact transition");
            const compactAttachment = await assertAttached("returned compact detent");
            assert.equal(compactAttachment.detent, "compact");
            assert.equal(compactAttachment.pageIndex, "1");

            dragStart = await beginGripDrag();
            await page.mouse.move(
                dragStart.x,
                dragStart.y + (viewport.height * 0.12),
                { steps: 6 },
            );
            await assertAttached("live dismiss drag");
            await page.mouse.up();
            await page.locator('[data-role="quick-source-sheet"]').waitFor({ state: "detached" });

            const closedLayout = await page.evaluate(() => {
                const rail = document.querySelector(
                    '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
                );
                const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]');
                if (!(rail instanceof HTMLElement) || !(tabs instanceof HTMLElement)) {
                    return null;
                }
                return {
                    gap: tabs.getBoundingClientRect().top - rail.getBoundingClientRect().bottom,
                    pageIndex: rail.getAttribute("data-page-index"),
                };
            });
            assert.ok(closedLayout);
            assert.equal(Math.abs(closedLayout.gap) <= 0.75, true);
            assert.equal(closedLayout.pageIndex, "1");
            assert.deepEqual(readStoredMsegShape(await getHarnessSnapshot(page)), shapeBefore);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
                delete globalThis.__cosimoT70GapMonitor;
            }).catch(() => {});
            await page.mouse.up().catch(() => {});
            await page.close();
        }
    }
});

test("T70 moving the MSEG drawer preserves a pending parked source drag through its drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "parked",
                    parkedVisibility: "visible",
                }));
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const sourceNumber = page.locator('[data-role="mobile-mod-source-number"]');
        await sourceNumber.waitFor();
        await sourceNumber.selectOption("2");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail-selected"]')
                ?.getAttribute("aria-label") === "MSEG 2 selected"
        ));
        const shapeBefore = readStoredMsegShape(await getHarnessSnapshot(page), 1);

        await page.click('[data-role="mobile-workspace-tab-voice"]');
        const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
        await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        const drawer = page.locator('[data-role="quick-source-sheet"][data-source-slot="2"]');
        const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
        const rate = drawer.locator('[data-role="quick-source-sheet-cell-rate"]');
        await rate.waitFor();
        if (await rail.getAttribute("data-page-index") !== "0") {
            await rail.getByRole("button", { name: "Previous Mod bar group" }).click();
            await rail.locator('xpath=self::*[@data-page-index="0"]').waitFor();
        }

        const source = rail.locator('[data-role="rack-mod-source-mseg-1"]');
        const sourceBounds = await source.boundingBox();
        const initialRateBounds = await rate.boundingBox();
        assert.ok(sourceBounds && initialRateBounds);
        const sourceCenter = {
            x: sourceBounds.x + (sourceBounds.width / 2),
            y: sourceBounds.y + (sourceBounds.height / 2),
        };
        const initialRateCenter = {
            x: initialRateBounds.x + (initialRateBounds.width / 2),
            y: initialRateBounds.y + (initialRateBounds.height / 2),
        };
        await page.mouse.move(sourceCenter.x, sourceCenter.y);
        await page.mouse.down();
        await page.mouse.move(
            sourceCenter.x + ((initialRateCenter.x - sourceCenter.x) * 0.25),
            sourceCenter.y + ((initialRateCenter.y - sourceCenter.y) * 0.25),
            { steps: 4 },
        );
        await rail.locator('xpath=self::*[@data-mapping-active="true"]').waitFor();
        const selectedDuringDrag = await rail.locator(
            '[data-role="mobile-global-mod-rail-selected"]',
        ).getAttribute("aria-label");

        await grip.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const pointerId = 707;
            const startX = bounds.left + (bounds.width / 2);
            const startY = bounds.top + (bounds.height / 2);
            element.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId,
                pointerType: "touch",
                isPrimary: false,
                button: 0,
                buttons: 1,
                clientX: startX,
                clientY: startY,
            }));
            window.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                pointerId,
                pointerType: "touch",
                isPrimary: false,
                button: 0,
                buttons: 1,
                clientX: startX,
                clientY: startY - 150,
            }));
        });
        await drawer.locator('xpath=self::*[@data-detent="dragging"]').waitFor();
        assert.equal(await rail.getAttribute("data-mapping-active"), "true");
        const liveGap = await page.evaluate(() => {
            const drawerElement = document.querySelector('[data-role="quick-source-sheet"]');
            const railElement = document.querySelector(
                '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
            );
            if (!(drawerElement instanceof HTMLElement) || !(railElement instanceof HTMLElement)) {
                return null;
            }
            return drawerElement.getBoundingClientRect().top - railElement.getBoundingClientRect().bottom;
        });
        assert.ok(liveGap !== null && Math.abs(liveGap) <= 0.75);

        await page.evaluate(() => {
            const gripElement = document.querySelector('[data-role="quick-source-sheet-grip"]');
            if (!(gripElement instanceof HTMLElement)) {
                throw new Error("MSEG drawer grip missing during the second-pointer release.");
            }
            const gripBounds = gripElement.getBoundingClientRect();
            window.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                pointerId: 707,
                pointerType: "touch",
                isPrimary: false,
                button: 0,
                buttons: 0,
                clientX: gripBounds.left + (gripBounds.width / 2),
                clientY: gripBounds.top + (gripBounds.height / 2),
            }));
        });
        await drawer.locator('xpath=self::*[@data-detent="half"]').waitFor();
        await page.waitForTimeout(220);
        assert.equal(
            await rail.getAttribute("data-mapping-active"),
            "true",
            "Settling the drawer must not cancel the original source pointer.",
        );
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            selectedDuringDrag,
            "Moving the drawer must not replace the selected MSEG before the drop commits.",
        );

        const movedRateBounds = await rate.boundingBox();
        assert.ok(movedRateBounds);
        await page.mouse.move(
            movedRateBounds.x + (movedRateBounds.width / 2),
            movedRateBounds.y + (movedRateBounds.height / 2),
            { steps: 8 },
        );
        await page.mouse.up();
        const snapshot = await waitForHarnessSnapshot(
            page,
            "pending source drag completes after drawer movement",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "mseg2Rate"
            )),
        );
        assert.equal(await drawer.getAttribute("data-source-slot"), "2");
        assert.equal(
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').getAttribute("aria-label"),
            "MSEG 1 selected",
            "The successful drop may commit the dragged source after drawer movement.",
        );
        assert.deepEqual(readStoredMsegShape(snapshot, 1), shapeBefore);
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("T71 drawer-to-full-screen MSEG gives its controls a row above the parked Mod bar", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "parked",
                    parkedVisibility: "visible",
                }));
            });
        },
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
        await rail.waitFor();
        await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
        const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
        const gripBounds = await grip.boundingBox();
        assert.ok(gripBounds);
        const gripCenter = {
            x: gripBounds.x + (gripBounds.width / 2),
            y: gripBounds.y + (gripBounds.height / 2),
        };
        await page.mouse.move(gripCenter.x, gripCenter.y);
        await page.mouse.down();
        await page.mouse.move(gripCenter.x, gripCenter.y - 370, { steps: 8 });
        await page.mouse.up();

        const editor = page.locator('[data-role="mseg-editor-dialog"]');
        await editor.waitFor();
        const geometry = await page.evaluate(() => {
            const rectOf = (element) => {
                if (!(element instanceof Element)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const controls = document.querySelector('[data-role="mseg-editor-controls"]');
            const railElement = document.querySelector(
                '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
            );
            const hitOwnership = (elements) => elements.map((element) => {
                const bounds = element.getBoundingClientRect();
                const center = {
                    x: bounds.left + (bounds.width / 2),
                    y: bounds.top + (bounds.height / 2),
                };
                const hit = document.elementFromPoint(center.x, center.y);
                return {
                    role: element.getAttribute("data-role") ?? element.getAttribute("aria-label"),
                    owned: hit !== null && element.contains(hit),
                    hitRole: hit?.closest("[data-role]")?.getAttribute("data-role") ?? hit?.tagName ?? null,
                };
            });
            const editorTargets = [...document.querySelectorAll([
                '[data-role="mseg-editor-controls"] [data-role="mseg-shape-a"]',
                '[data-role="mseg-editor-controls"] [data-role="mseg-shape-b"]',
                '[data-role="mseg-editor-cell-rate"]',
                '[data-role="mseg-editor-cell-morph"]',
                '[data-role="mseg-editor-controls"] [data-role="mseg-loop-toggle"]',
                '[data-role="mseg-editor-surface"] [data-role="mseg-point"]',
            ].join(", "))].filter((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            });
            const railTargets = [...(railElement?.querySelectorAll("button") ?? [])].filter((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            });
            return {
                controls: rectOf(controls),
                rail: rectOf(railElement),
                editorHits: hitOwnership(editorTargets),
                railHits: hitOwnership(railTargets),
            };
        });

        assert.ok(geometry.controls && geometry.rail);
        assert.equal(
            geometry.controls.bottom <= geometry.rail.top + 0.5,
            true,
            `Full-screen MSEG controls must not overlap the parked row: ${JSON.stringify(geometry)}`,
        );
        assert.equal(
            Math.abs(geometry.controls.bottom - geometry.rail.top) <= 0.5,
            true,
            `Full-screen controls must sit directly above the parked row: ${JSON.stringify(geometry)}`,
        );
        assert.equal(geometry.editorHits.length >= 7, true);
        assert.deepEqual(geometry.editorHits.filter((target) => !target.owned), []);
        assert.equal(geometry.railHits.length >= 8, true);
        assert.deepEqual(geometry.railHits.filter((target) => !target.owned), []);
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("T71 full-screen MSEG and parked Mod bar stay operable across compact phones", async () => {
    for (const viewport of [
        { name: "portrait phone", width: 393, height: 852 },
        { name: "landscape phone", width: 568, height: 320 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: viewport.width, height: viewport.height });
                await nextPage.addInitScript(() => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: 1.1,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                });
            },
        });

        try {
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            const readShapeB = (snapshot) => readStoredModulationState(snapshot).msegSlots[0].shapeB;
            const shapeBefore = readShapeB(await getHarnessSnapshot(page));
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();

            const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
            const drawerSurface = drawer.locator('[data-role="quick-sheet-mseg-surface"]');
            await drawer.waitFor();
            const compactDrawerGeometry = await drawer.evaluate((element) => {
                const surface = element.querySelector('[data-role="quick-sheet-mseg-surface"]');
                const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
                if (!(surface instanceof SVGElement) || !(keyboard instanceof HTMLElement)) {
                    return null;
                }
                const drawerBounds = element.getBoundingClientRect();
                const surfaceBounds = surface.getBoundingClientRect();
                const keyboardBounds = keyboard.getBoundingClientRect();
                return {
                    drawerBottom: drawerBounds.bottom,
                    keyboardTop: keyboardBounds.top,
                    surfaceHeight: surfaceBounds.height,
                };
            });
            assert.ok(compactDrawerGeometry, `${viewport.name} must mount the compact MSEG drawer.`);
            assert.equal(
                compactDrawerGeometry.drawerBottom <= compactDrawerGeometry.keyboardTop + 0.75,
                true,
                `${viewport.name} compact MSEG drawer must remain above the keyboard.`,
            );
            assert.equal(
                compactDrawerGeometry.surfaceHeight > 0,
                true,
                `${viewport.name} compact MSEG drawer must leave a visible editing surface.`,
            );
            await drawerSurface.waitFor();
            const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
            const halfGripBounds = await grip.boundingBox();
            assert.ok(halfGripBounds);
            const halfGripCenter = {
                x: halfGripBounds.x + (halfGripBounds.width / 2),
                y: halfGripBounds.y + (halfGripBounds.height / 2),
            };
            await page.mouse.move(halfGripCenter.x, halfGripCenter.y);
            await page.mouse.down();
            await page.mouse.move(
                halfGripCenter.x,
                halfGripCenter.y - (viewport.height * 0.16),
                { steps: 6 },
            );
            await page.mouse.up();
            await drawer.locator('xpath=self::*[@data-detent="half"]').waitFor();
            await page.waitForTimeout(220);

            await drawer.locator('[data-role="mseg-shape-b"]').click();
            assert.equal(await drawerSurface.getAttribute("data-edit-shape"), "b");

            const surfaceBounds = await drawerSurface.boundingBox();
            assert.ok(surfaceBounds);
            await page.mouse.click(
                surfaceBounds.x + (surfaceBounds.width * 0.56),
                surfaceBounds.y + (surfaceBounds.height * 0.85),
            );
            const changedSnapshot = await waitForHarnessSnapshot(
                page,
                `${viewport.name} drawer point edit`,
                (snapshot) => readShapeB(snapshot).points.length === shapeBefore.points.length + 1,
            );
            const shapeAfterDrawerEdit = readShapeB(changedSnapshot);

            await rail.getByRole("button", { name: "Next Mod bar group" }).click();
            await rail.locator('xpath=self::*[@data-page-index="1"]').waitFor();
            const gripBounds = await grip.boundingBox();
            assert.ok(gripBounds);
            const gripCenter = {
                x: gripBounds.x + (gripBounds.width / 2),
                y: gripBounds.y + (gripBounds.height / 2),
            };
            await page.mouse.move(gripCenter.x, gripCenter.y);
            await page.mouse.down();
            await page.mouse.move(
                gripCenter.x,
                gripCenter.y - (viewport.height * 0.25),
                { steps: 8 },
            );
            await page.mouse.up();

            const editor = page.locator('[data-role="mseg-editor-dialog"]');
            await editor.waitFor();
            const editorSurface = editor.locator('[data-role="mseg-editor-surface"]');
            const controls = editor.locator('[data-role="mseg-editor-controls"]');
            const fullGeometry = await page.evaluate(() => {
                const controls = document.querySelector('[data-role="mseg-editor-controls"]');
                const rail = document.querySelector(
                    '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
                );
                if (!(controls instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
                    return null;
                }
                const controlsBounds = controls.getBoundingClientRect();
                const railBounds = rail.getBoundingClientRect();
                return {
                    gap: railBounds.top - controlsBounds.bottom,
                    controlsHeight: controlsBounds.height,
                    railHeight: railBounds.height,
                    pageIndex: rail.getAttribute("data-page-index"),
                    selectedLabel: rail.querySelector(
                        '[data-role="mobile-global-mod-rail-selected"]',
                    )?.getAttribute("aria-label") ?? null,
                };
            });
            assert.ok(fullGeometry);
            assert.equal(Math.abs(fullGeometry.gap) <= 0.75, true, JSON.stringify(fullGeometry));
            assert.equal(Math.abs(fullGeometry.controlsHeight - 40) <= 0.5, true);
            assert.equal(Math.abs(fullGeometry.railHeight - 40) <= 0.5, true);
            assert.equal(fullGeometry.pageIndex, "1");
            assert.equal(fullGeometry.selectedLabel, "MSEG 1 selected");
            assert.equal(await editorSurface.getAttribute("data-edit-shape"), "b");
            assert.equal(await editor.locator('[data-role="mseg-editor-undo"]').isDisabled(), false);
            assert.deepEqual(readShapeB(await getHarnessSnapshot(page)), shapeAfterDrawerEdit);

            const rate = controls.locator('[data-role="mseg-editor-cell-rate"]');
            await rate.focus();
            await page.keyboard.press("End");
            await waitForHarnessSnapshot(
                page,
                `${viewport.name} full-screen Rate remains operable`,
                (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 2) <= 0.001,
            );

            const morph = controls.locator('[data-role="mseg-editor-cell-morph"]');
            await morph.focus();
            await page.keyboard.press("End");
            await waitForHarnessSnapshot(
                page,
                `${viewport.name} full-screen Morph remains operable`,
                (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Morph) - 1) <= 0.001,
            );

            await controls.locator('[data-role="mseg-shape-a"]').click();
            assert.equal(await editorSurface.getAttribute("data-edit-shape"), "a");
            await controls.locator('[data-role="mseg-shape-b"]').click();
            assert.equal(await editorSurface.getAttribute("data-edit-shape"), "b");

            const loop = controls.locator('[data-role="mseg-loop-toggle"]');
            const loopBefore = await loop.getAttribute("aria-pressed");
            await loop.click();
            await page.waitForFunction((previous) => (
                document.querySelector('[data-role="mseg-editor-controls"] [data-role="mseg-loop-toggle"]')
                    ?.getAttribute("aria-pressed") !== previous
            ), loopBefore);
            const loopAfter = await loop.getAttribute("aria-pressed");
            assert.notEqual(loopAfter, loopBefore);

            await rail.getByRole("button", { name: "Next Mod bar group" }).click();
            await rail.locator('xpath=self::*[@data-page-index="2"]').waitFor();
            const parkedChrome = await rail.evaluate((element) => {
                const note = element.querySelector('[data-role="mobile-global-mod-rail-note"]');
                const next = element.querySelector('[data-role="mobile-global-mod-rail-parked-next"]');
                if (!(note instanceof HTMLButtonElement) || !(next instanceof HTMLButtonElement)) {
                    return null;
                }
                const noteBounds = note.getBoundingClientRect();
                const center = {
                    x: noteBounds.left + (noteBounds.width / 2),
                    y: noteBounds.top + (noteBounds.height / 2),
                };
                return {
                    immediatelyBeforeNext: note.nextElementSibling === next,
                    ownsHit: document.elementFromPoint(center.x, center.y)?.closest("button") === note,
                };
            });
            assert.deepEqual(parkedChrome, { immediatelyBeforeNext: true, ownsHit: true });

            await editor.locator('[data-role="mseg-editor-undo"]').click();
            await waitForHarnessSnapshot(
                page,
                `${viewport.name} drawer undo survives full-screen transition`,
                (snapshot) => JSON.stringify(readShapeB(snapshot)) === JSON.stringify(shapeBefore),
            );
            await page.locator('[data-action="shell-back"]').click();
            await editor.waitFor({ state: "detached" });

            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
            await drawer.waitFor();
            const returnedState = await drawer.evaluate((element) => {
                const rate = element.querySelector('[data-role="quick-source-sheet-cell-rate"]');
                const morph = element.querySelector('[data-role="quick-source-sheet-cell-morph"]');
                const loop = element.querySelector('[data-role="mseg-loop-toggle"]');
                const surface = element.querySelector('[data-role="quick-sheet-mseg-surface"]');
                const rail = document.querySelector(
                    '[data-role="mobile-global-mod-rail"][data-placement="parked"]',
                );
                const drawerBounds = element.getBoundingClientRect();
                const railBounds = rail?.getBoundingClientRect();
                return {
                    sourceSlot: element.getAttribute("data-source-slot"),
                    editShape: surface?.getAttribute("data-edit-shape") ?? null,
                    rate: Number(rate?.getAttribute("aria-valuenow")),
                    morph: Number(morph?.getAttribute("aria-valuenow")),
                    loop: loop?.getAttribute("aria-pressed") ?? null,
                    pageIndex: rail?.getAttribute("data-page-index") ?? null,
                    gap: railBounds === undefined ? null : drawerBounds.top - railBounds.bottom,
                };
            });
            assert.equal(returnedState.sourceSlot, "1");
            assert.equal(returnedState.editShape, "b");
            assert.equal(Math.abs(returnedState.rate - 2) <= 0.001, true);
            assert.equal(Math.abs(returnedState.morph - 1) <= 0.001, true);
            assert.equal(returnedState.loop, loopAfter);
            assert.equal(returnedState.pageIndex, "2");
            assert.ok(returnedState.gap !== null && Math.abs(returnedState.gap) <= 0.75);
            assert.deepEqual(readShapeB(await getHarnessSnapshot(page)), shapeBefore);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.mouse.up().catch(() => {});
            await page.close();
        }
    }
});

test("T71 switching MSEG drawers starts a clean Undo session before full-screen expansion", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                    version: 1,
                    scale: 1.1,
                    placement: "parked",
                    parkedVisibility: "visible",
                }));
            });
        },
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
        await rail.waitFor();
        const initialSnapshot = await getHarnessSnapshot(page);
        const mseg1Before = readStoredMsegShape(initialSnapshot, 0);
        const mseg2Before = readStoredMsegShape(initialSnapshot, 1);

        await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        const drawer = page.locator('[data-role="quick-source-sheet"][data-source-kind="mseg"]');
        const grip = drawer.locator('[data-role="quick-source-sheet-grip"]');
        await drawer.waitFor();
        const gripBounds = await grip.boundingBox();
        assert.ok(gripBounds);
        const gripCenter = {
            x: gripBounds.x + (gripBounds.width / 2),
            y: gripBounds.y + (gripBounds.height / 2),
        };
        await page.mouse.move(gripCenter.x, gripCenter.y);
        await page.mouse.down();
        await page.mouse.move(gripCenter.x, gripCenter.y - 140, { steps: 6 });
        await page.mouse.up();
        await drawer.locator('xpath=self::*[@data-detent="half"]').waitFor();
        await page.waitForTimeout(220);

        const mseg1Surface = drawer.locator('[data-role="quick-sheet-mseg-surface"]');
        const surfaceBounds = await mseg1Surface.boundingBox();
        assert.ok(surfaceBounds);
        await page.mouse.click(
            surfaceBounds.x + (surfaceBounds.width * 0.56),
            surfaceBounds.y + (surfaceBounds.height * 0.85),
        );
        const editedSnapshot = await waitForHarnessSnapshot(
            page,
            "MSEG 1 drawer creates an Undo checkpoint",
            (snapshot) => readStoredMsegShape(snapshot, 0).points.length === mseg1Before.points.length + 1,
        );
        const mseg1AfterEdit = readStoredMsegShape(editedSnapshot, 0);

        await rail.getByRole("button", { name: "Next Mod bar group" }).click();
        await rail.locator('xpath=self::*[@data-page-index="1"]').waitFor();
        await rail.locator('[data-role="rack-mod-source-mseg-2"]').click();
        await drawer.locator('xpath=self::*[@data-source-slot="2"]').waitFor();
        assert.deepEqual(readStoredMsegShape(await getHarnessSnapshot(page), 1), mseg2Before);

        await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
        const editor = page.locator('[data-role="mseg-editor-dialog"]');
        await editor.waitFor();
        assert.equal(await editor.getAttribute("aria-label"), "MSEG 2 editor");
        assert.equal(
            await editor.locator('[data-role="mseg-editor-undo"]').isDisabled(),
            true,
            "MSEG 2 must not inherit the prior MSEG 1 drawer's Undo checkpoint.",
        );
        const finalSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredMsegShape(finalSnapshot, 0), mseg1AfterEdit);
        assert.deepEqual(readStoredMsegShape(finalSnapshot, 1), mseg2Before);
    } finally {
        await page.evaluate(() => {
            localStorage.removeItem("cosimo.mod-bar.preferences.v1");
        }).catch(() => {});
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("T71 floating Mod-bar placements retain their full-editor overlay behavior", async () => {
    for (const placement of ["floating-left", "floating-right"]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: 393, height: 852 });
                await nextPage.addInitScript(({ placement: initialPlacement }) => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: 1.1,
                        placement: initialPlacement,
                        parkedVisibility: "visible",
                    }));
                }, { placement });
            },
        });

        try {
            const expectedEdge = placement === "floating-left" ? "left" : "right";
            const rail = page.locator(
                `[data-role="mobile-global-mod-rail"][data-edge="${expectedEdge}"]`,
            );
            await rail.waitFor();
            await rail.locator('[data-role="mobile-global-mod-rail-selected"]').click();
            await page.locator('[data-role="quick-source-sheet-full-editor"]').click();
            await page.locator('[data-role="mseg-editor-dialog"]').waitFor();

            const geometry = await page.evaluate(() => {
                const backdrop = document.querySelector(".mseg-editor-backdrop");
                const controls = document.querySelector('[data-role="mseg-editor-controls"]');
                const railElement = document.querySelector('[data-role="mobile-global-mod-rail"]');
                const railLayer = railElement?.closest('[data-role="mobile-global-mod-rail-layer"]');
                if (!(backdrop instanceof HTMLElement)
                    || !(controls instanceof HTMLElement)
                    || !(railElement instanceof HTMLElement)
                    || !(railLayer instanceof HTMLElement)) {
                    return null;
                }
                const backdropBounds = backdrop.getBoundingClientRect();
                const controlBounds = controls.getBoundingClientRect();
                const railBounds = railElement.getBoundingClientRect();
                const railCenter = {
                    x: railBounds.left + (railBounds.width / 2),
                    y: railBounds.top + (railBounds.height / 2),
                };
                const stack = document.elementsFromPoint(railCenter.x, railCenter.y);
                const railIndex = stack.findIndex((element) => railElement.contains(element));
                const backdropIndex = stack.findIndex((element) => backdrop.contains(element));
                return {
                    edge: railElement.getAttribute("data-edge"),
                    layerPosition: getComputedStyle(railLayer).position,
                    controlsToBackdropBottom: backdropBounds.bottom - controlBounds.bottom,
                    railAboveEditor: railIndex >= 0
                        && backdropIndex >= 0
                        && railIndex < backdropIndex,
                };
            });

            assert.ok(geometry);
            assert.equal(geometry.edge, expectedEdge);
            assert.equal(geometry.layerPosition, "fixed");
            assert.equal(
                Math.abs(geometry.controlsToBackdropBottom) <= 0.75,
                true,
                `${placement} must keep the established unreserved full-editor edge: ${JSON.stringify(geometry)}`,
            );
            assert.equal(
                geometry.railAboveEditor,
                true,
                `${placement} must remain global overlay chrome above the full editor.`,
            );
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T60 parked row stays fixed, fully hittable, and drag-owned across compact compositions", async () => {
    const layouts = [
        { name: "short 320px phone", width: 320, height: 568, scale: 0.85 },
        { name: "tall phone", width: 393, height: 852, scale: 1.1 },
        { name: "widest compact surface", width: 639, height: 720, scale: 1.3 },
    ];

    for (const layout of layouts) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: layout.width, height: layout.height });
                await nextPage.addInitScript(({ scale }) => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                    localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
                }, { scale: layout.scale });
            },
        });

        const readLayout = async () => page.evaluate(() => {
            const rectOf = (element) => {
                if (!(element instanceof Element)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const row = rail?.querySelector('[data-role="mobile-global-mod-rail-tab"]');
            const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]');
            const portal = document.querySelector('[data-role="mobile-global-mod-rail-portal"]');
            const selectedArt = rail?.querySelector('[data-role="mobile-global-mod-rail-selected"] .rack-mod-art');
            const selectedIcon = selectedArt?.querySelector('[data-role="rack-mod-glyph"]');
            const routeCount = rail?.querySelector('[data-role="mobile-global-mod-rail-route-count"]');
            const nextChevron = rail?.querySelector('[data-role="mobile-global-mod-rail-parked-next"] .rack-mod-chevron');
            const visibleButtons = [...(row?.querySelectorAll("button") ?? [])].filter((button) => {
                const bounds = button.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0;
            });
            const hitOwners = visibleButtons.map((button) => {
                const bounds = button.getBoundingClientRect();
                const hit = document.elementFromPoint(
                    bounds.left + (bounds.width / 2),
                    bounds.top + (bounds.height / 2),
                );
                return hit?.closest("button") === button;
            });
            const railStyle = rail instanceof HTMLElement ? getComputedStyle(rail) : null;
            return {
                placement: rail?.getAttribute("data-placement") ?? null,
                pageKind: rail?.getAttribute("data-page-kind") ?? null,
                row: rectOf(row),
                tabs: rectOf(tabs),
                portal: rectOf(portal),
                selectedArt: rectOf(selectedArt),
                selectedIcon: rectOf(selectedIcon),
                routeCount: rectOf(routeCount),
                nextChevron: rectOf(nextChevron),
                nextChevronCssWidth: nextChevron instanceof HTMLElement
                    ? Number.parseFloat(getComputedStyle(nextChevron).width)
                    : null,
                buttonBounds: visibleButtons.map(rectOf),
                hitOwners,
                scale: railStyle
                    ? Number.parseFloat(railStyle.getPropertyValue("--rail-scale"))
                    : null,
                outline: railStyle
                    ? Number.parseFloat(railStyle.getPropertyValue("--rail-outline"))
                    : null,
                documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            };
        });

        try {
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            await page.waitForTimeout(220);

            let measured = await readLayout();
            assert.equal(measured.placement, "parked", `${layout.name} changed placement.`);
            assert.equal(measured.pageKind, "sources");
            assert.ok(measured.row && measured.tabs && measured.portal);
            assert.ok(measured.selectedArt && measured.selectedIcon && measured.routeCount && measured.nextChevron);
            assert.equal(Math.abs(measured.scale - layout.scale) <= 0.005, true);
            assert.equal(Math.abs(measured.row.height - 40) <= 0.5, true);
            assert.equal(Math.abs(measured.tabs.height - 40) <= 0.5, true);
            assert.equal(Math.abs(measured.portal.height - 40) <= 0.5, true);
            assert.equal(Math.abs(measured.row.bottom - measured.tabs.top) <= 0.5, true);
            assert.equal(Math.abs(measured.outline - layout.scale) <= 0.05, true);
            assert.equal(Math.abs(measured.selectedArt.width - (28 * layout.scale)) <= 0.5, true);
            assert.equal(Math.abs(measured.selectedIcon.width - (16 * layout.scale)) <= 0.5, true);
            assert.equal(Math.abs(measured.routeCount.height - (13 * layout.scale)) <= 0.5, true);
            assert.equal(Math.abs(measured.nextChevronCssWidth - (7 * layout.scale)) <= 0.5, true);
            assert.equal(measured.buttonBounds.length, 8);
            assert.deepEqual(measured.hitOwners, measured.hitOwners.map(() => true));
            for (const bounds of measured.buttonBounds) {
                assert.ok(bounds);
                assert.equal(Math.abs(bounds.height - 40) <= 0.5, true);
                assert.equal(rectContains(measured.row, bounds, 0.6), true);
            }
            assert.equal(measured.documentFits, true);

            for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
                await rail.getByRole("button", { name: "Next Mod bar group" }).click();
            }
            await rail.locator('xpath=self::*[@data-page-kind="tools"]').waitFor();
            measured = await readLayout();
            assert.ok(measured.row && measured.tabs);
            assert.equal(measured.buttonBounds.length, 8);
            assert.deepEqual(measured.hitOwners, measured.hitOwners.map(() => true));
            for (const bounds of measured.buttonBounds) {
                assert.ok(bounds);
                assert.equal(Math.abs(bounds.height - 40) <= 0.5, true);
                assert.equal(rectContains(measured.row, bounds, 0.6), true);
            }
            assert.equal(Math.abs(measured.row.bottom - measured.tabs.top) <= 0.5, true);
            assert.equal(measured.documentFits, true);

            if (layout.width === 393) {
                await rail.getByRole("button", { name: "Next Mod bar group" }).click();
                await rail.locator('xpath=self::*[@data-page-kind="sources"][@data-page-index="0"]').waitFor();
                await page.click('[data-role="mobile-workspace-tab-fx"]');
                await createRackMappingByDrop(page);
                await waitForHarnessSnapshot(
                    page,
                    "parked source drag creates its mapping",
                    (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                        route.sourceKind === "mseg"
                        && route.sourceSlot === 1
                        && route.targetKind === "lane.distortion#1.distortionDriveDb"
                    )),
                );
                await rail.locator('[data-role="mobile-global-mod-rail-route-count"]').getByText("1").waitFor();
            }

            const routeCountBeforeHide = (await rail.locator(
                '[data-role="mobile-global-mod-rail-route-count"]',
            ).textContent())?.trim();
            await rail.getByRole("button", { name: "Hide parked Mod bar" }).click();
            await page.waitForTimeout(220);
            const hidden = await page.evaluate(() => {
                const portal = document.querySelector('[data-role="mobile-global-mod-rail-portal"]');
                const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]');
                const restore = document.querySelector('[data-role="mobile-global-mod-rail-restore"]');
                const portalBounds = portal?.getBoundingClientRect();
                const tabsBounds = tabs?.getBoundingClientRect();
                const restoreBounds = restore?.getBoundingClientRect();
                const hit = restoreBounds
                    ? document.elementFromPoint(
                        restoreBounds.left + (restoreBounds.width / 2),
                        restoreBounds.top + (restoreBounds.height / 2),
                    )
                    : null;
                const overlappedPageControls = restoreBounds
                    ? [...document.querySelectorAll("button, input, select, textarea, a[href]")]
                        .filter((control) => (
                            control !== restore
                            && control.closest('[data-role="mobile-bottom-dock"]') === null
                            && control.closest('[aria-hidden="true"]') === null
                        ))
                        .filter((control) => {
                            const bounds = control.getBoundingClientRect();
                            const style = getComputedStyle(control);
                            return style.display !== "none"
                                && style.visibility !== "hidden"
                                && style.pointerEvents !== "none"
                                && bounds.width > 0
                                && bounds.height > 0
                                && bounds.left < restoreBounds.right
                                && bounds.right > restoreBounds.left
                                && bounds.top < restoreBounds.bottom
                                && bounds.bottom > restoreBounds.top;
                        })
                        .map((control) => (
                            control.getAttribute("data-role")
                            ?? control.getAttribute("aria-label")
                            ?? control.tagName.toLowerCase()
                        ))
                    : [];
                return {
                    portalHeight: portalBounds?.height ?? null,
                    restoreBottom: restoreBounds?.bottom ?? null,
                    tabsTop: tabsBounds?.top ?? null,
                    restoreOwnsCenter: hit?.closest("button") === restore,
                    overlappedPageControls,
                };
            });
            assert.ok(hidden.portalHeight !== null && hidden.portalHeight <= 0.5);
            assert.equal(hidden.restoreOwnsCenter, true);
            assert.deepEqual(
                hidden.overlappedPageControls,
                [],
                `${layout.name} restore hit target masks a page control.`,
            );
            assert.ok(hidden.restoreBottom !== null && hidden.tabsTop !== null);
            assert.equal(Math.abs(hidden.restoreBottom - hidden.tabsTop) <= 0.5, true);
            await page.getByRole("button", { name: "Restore parked Mod bar" }).click();
            await page.waitForTimeout(220);
            assert.equal(
                (await rail.locator('[data-role="mobile-global-mod-rail-route-count"]').textContent())?.trim(),
                routeCountBeforeHide,
            );
            measured = await readLayout();
            assert.ok(measured.row && measured.tabs);
            assert.equal(Math.abs(measured.row.height - 40) <= 0.5, true);
            assert.equal(Math.abs(measured.row.bottom - measured.tabs.top) <= 0.5, true);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T60 application preferences cross plugin and desktop breakpoints without changing sound or placement", async () => {
    const layouts = [
        { name: "plugin", width: 1120, height: 680 },
        { name: "desktop", width: 1440, height: 900 },
    ];

    for (const layout of layouts) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: layout.width, height: layout.height });
                await nextPage.addInitScript(() => {
                    localStorage.setItem("cosimo.mod-bar.preferences.v1", JSON.stringify({
                        version: 1,
                        scale: 1.22,
                        placement: "parked",
                        parkedVisibility: "visible",
                    }));
                });
            },
        });

        try {
            const soundBeforeResize = await getHarnessSnapshot(page);
            assert.equal(await page.locator('[data-role="mobile-global-mod-rail"]').count(), 0);
            await page.setViewportSize({ width: 393, height: 852 });
            const rail = page.locator('[data-role="mobile-global-mod-rail"][data-placement="parked"]');
            await rail.waitFor();
            await page.waitForTimeout(220);
            assert.equal(
                await rail.evaluate((element) => (
                    getComputedStyle(element).getPropertyValue("--rail-scale").trim()
                )),
                "1.22",
                `${layout.name} resize lost its scale.`,
            );
            await page.setViewportSize({ width: layout.width, height: layout.height });
            await rail.waitFor({ state: "detached" });
            const storedPreference = await page.evaluate(() => (
                JSON.parse(localStorage.getItem("cosimo.mod-bar.preferences.v1") ?? "null")
            ));
            assert.deepEqual(storedPreference, {
                version: 1,
                scale: 1.22,
                placement: "parked",
                parkedVisibility: "visible",
            });
            const soundAfterResize = await getHarnessSnapshot(page);
            assert.deepEqual(soundAfterResize.parameterValues, soundBeforeResize.parameterValues);
            assert.deepEqual(soundAfterResize.storedState, soundBeforeResize.storedState);
        } finally {
            await page.evaluate(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            }).catch(() => {});
            await page.close();
        }
    }
});

test("T39A: the horizontal Mod bar reaches the same Voice-settings Global Tune at plugin and desktop sizes", async () => {
    for (const layout of [
        { name: "plugin", width: 1120, height: 680 },
        { name: "desktop", width: 1440, height: 900 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize(layout),
        });

        try {
            const toggle = page.locator('[data-role="desktop-global-mod-rail-voice-toggle"]');
            await toggle.waitFor({ state: "visible" });
            assert.equal(await page.locator('[data-role="global-tune-control"]').count(), 0);
            assert.equal(await page.locator('[data-role="global-tune-knob"]').count(), 0);

            await toggle.click();
            const popover = page.locator('[data-role="desktop-global-mod-rail-voice-popover"]');
            await popover.waitFor({ state: "visible" });
            const knob = popover.locator('[data-role="global-tune-knob"]');
            assert.equal(await knob.count(), 1, `${layout.name}: Voice settings owns Global Tune.`);
            assert.equal(await page.locator('[data-role="global-tune-knob"]').count(), 1);
            assert.equal(await knob.getAttribute("aria-valuemin"), "-24");
            assert.equal(await knob.getAttribute("aria-valuemax"), "24");
            assert.equal(
                await knob.evaluate((element) => (
                    element.closest('[data-modulation-target-kind="globalTuneSemitones"]') !== null
                )),
                true,
                `${layout.name}: the composed knob remains the real Global Tune drop target.`,
            );

            await page.locator('[data-role="rack-mod-source-mseg-1"]').click();
            assert.equal(await popover.isVisible(), true, `${layout.name}: source selection preserves Voice settings.`);
            await createRackMappingByDrop(
                page,
                '[data-role="rack-mod-source-mseg-1"]',
                '[data-role="global-tune-knob"]',
            );
            await waitForHarnessSnapshot(
                page,
                `${layout.name} Global Tune source drop`,
                (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                    route.sourceKind === "mseg"
                    && route.sourceSlot === 1
                    && route.targetKind === "globalTuneSemitones"
                )),
            );
            assert.equal(await popover.isVisible(), true, `${layout.name}: source drop preserves Voice settings.`);
            await page.mouse.click(5, 5);
            await popover.waitFor({ state: "detached" });
        } finally {
            await page.close();
        }
    }
});

test("T42 scales the complete Mod rail geometry and keeps both edges inside real phone chrome", async () => {
    const SCALE = 1.1;
    const BASE = {
        railWidth: 40,
        railCollapsedHeight: 152,
        tabHeight: 128,
        module: 28,
        icon: 16,
        badge: 13,
        label: 8,
        sourceNumberWidth: 9,
        sourceNumberHeight: 11,
        activityWidth: 14,
        activityHeight: 2,
        handleDot: 2,
        handleGap: 3,
        chevron: 7,
        outline: 1,
        gap: 10,
        paddleHeight: 20,
        voiceToggleWidth: 34,
    };
    const closeToScaled = (actual, before, label, tolerance = 0.3) => {
        assert.equal(
            Math.abs(actual - (before * SCALE)) <= tolerance,
            true,
            `${label} must scale ${before}px -> ${before * SCALE}px; measured ${actual}px.`,
        );
    };
    const readGeometry = async (page) => await page.evaluate(() => {
        const rectOf = (element) => {
            if (!(element instanceof Element)) {
                return null;
            }
            const bounds = element.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height,
            };
        };
        const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
        const surface = document.querySelector(".cosimo-surface");
        const tab = rail?.querySelector('[data-role="mobile-global-mod-rail-tab"]');
        const selected = rail?.querySelector('[data-role="mobile-global-mod-rail-selected"]');
        const selectedArt = selected?.querySelector(".rack-mod-art");
        const sourceNumber = selectedArt?.querySelector(".rack-mod-number");
        const badge = rail?.querySelector('[data-role="mobile-global-mod-rail-route-count"]');
        const activity = rail?.querySelector(".mobile-global-mod-rail-activity");
        const note = rail?.querySelector('[data-role="mobile-global-mod-rail-note"]');
        const noteIcon = note?.querySelector("svg");
        const noteDot = note?.querySelector('[data-role="mobile-global-mod-rail-note-dot"]');
        const handle = rail?.querySelector(".mobile-global-mod-rail-handle");
        const handleDot = handle?.querySelector("span");
        const chevron = rail?.querySelector(".mobile-global-mod-rail-chevron");
        const silhouettePath = rail?.querySelector('[data-role="mobile-global-mod-rail-silhouette"] path');
        const drawer = rail?.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
        const paddle = drawer?.querySelector(".rack-mod-paddle");
        const sourceButtons = Array.from(drawer?.querySelectorAll(".rack-mod-page:not([aria-hidden=true]) .rack-mod-source") ?? []);
        const sourceArt = sourceButtons[0]?.querySelector(".rack-mod-art");
        const sourceGlyph = sourceButtons[0]?.querySelector(".rack-mod-glyph");
        const keyboardToggle = drawer?.querySelector('[data-role="mobile-global-mod-rail-keyboard-toggle"]');
        const autoToggle = drawer?.querySelector('[data-role="mobile-global-mod-rail-auto-toggle"]');
        const voiceToggle = drawer?.querySelector('[data-role="mobile-global-mod-rail-voice-toggle"]');
        const preset = document.querySelector('[data-role="synth-preset-bar-host"]');
        const tabs = document.querySelector('[data-role="mobile-workspace-tabs"]');
        const keyboard = document.querySelector('[data-role="sticky-keyboard"]');
        const railStyle = rail ? getComputedStyle(rail) : null;
        const handleStyle = handle ? getComputedStyle(handle) : null;
        const chevronStyle = chevron ? getComputedStyle(chevron) : null;
        const pathStyle = silhouettePath ? getComputedStyle(silhouettePath) : null;
        const sourceNumberStyle = sourceNumber ? getComputedStyle(sourceNumber) : null;
        const badgeStyle = badge ? getComputedStyle(badge) : null;
        const voiceToggleStyle = voiceToggle ? getComputedStyle(voiceToggle) : null;
        return {
            edge: rail?.getAttribute("data-edge"),
            expanded: rail?.getAttribute("data-expanded"),
            drawerDirection: rail?.getAttribute("data-drawer-direction"),
            surfaceEdge: surface instanceof HTMLElement ? surface.dataset.modRailEdge ?? null : null,
            rail: rectOf(rail),
            tab: rectOf(tab),
            selected: rectOf(selected),
            selectedArt: rectOf(selectedArt),
            sourceNumber: rectOf(sourceNumber),
            sourceNumberFontSize: sourceNumberStyle ? Number.parseFloat(sourceNumberStyle.fontSize) : null,
            badge: rectOf(badge),
            badgeFontSize: badgeStyle ? Number.parseFloat(badgeStyle.fontSize) : null,
            activity: rectOf(activity),
            note: rectOf(note),
            noteIcon: rectOf(noteIcon),
            noteDot: rectOf(noteDot),
            handle: rectOf(handle),
            handleDot: rectOf(handleDot),
            chevronSize: chevronStyle ? Number.parseFloat(chevronStyle.width) : null,
            outline: pathStyle ? Number.parseFloat(pathStyle.strokeWidth) : null,
            handleColumnGap: handleStyle ? Number.parseFloat(handleStyle.columnGap) : null,
            drawer: rectOf(drawer),
            drawerScrollHeight: drawer instanceof HTMLElement ? drawer.scrollHeight : null,
            paddle: rectOf(paddle),
            sources: sourceButtons.map(rectOf),
            sourceArt: rectOf(sourceArt),
            sourceGlyph: rectOf(sourceGlyph),
            keyboardToggle: rectOf(keyboardToggle),
            autoToggle: rectOf(autoToggle),
            voiceToggle: rectOf(voiceToggle),
            voiceToggleFontSize: voiceToggleStyle ? Number.parseFloat(voiceToggleStyle.fontSize) : null,
            preset: rectOf(preset),
            tabs: rectOf(tabs),
            keyboard: rectOf(keyboard),
            scale: railStyle ? Number.parseFloat(railStyle.getPropertyValue("--rail-scale")) : null,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
    });
    const assertCentered = (outer, inner, label) => {
        assert.ok(outer && inner, `${label} bounds must exist.`);
        const outerCenter = (outer.left + outer.right) / 2;
        const innerCenter = (inner.left + inner.right) / 2;
        assert.equal(Math.abs(outerCenter - innerCenter) <= 0.5, true, `${label} must stay centered.`);
    };
    const assertSafe = (geometry, label) => {
        assert.ok(geometry.rail && geometry.preset && geometry.tabs, `${label} requires rail and shell chrome.`);
        // T54 keeps Voice corner controls on fixed, mirrored graph insets. This
        // movable overlay owns its screen/chrome safety, not their placement.
        assert.equal(geometry.documentFits, true, `${label} must not create horizontal overflow.`);
        assert.equal(
            geometry.rail.top >= geometry.preset.bottom + 8.5,
            true,
            `${label} must clear the preset bar by the scaled safe gap.`,
        );
        const lowerChromeTop = Math.min(
            geometry.tabs.top,
            geometry.keyboard?.top ?? Number.POSITIVE_INFINITY,
        );
        assert.equal(
            geometry.rail.bottom <= lowerChromeTop - 8.5,
            true,
            `${label} must clear tabs/keyboard by the scaled safe gap.`,
        );
        if (geometry.edge === "right") {
            assert.equal(Math.abs(geometry.rail.right - geometry.viewport.width) <= 0.5, true, `${label} must dock flush right.`);
        } else {
            assert.equal(Math.abs(geometry.rail.left) <= 0.5, true, `${label} must dock flush left.`);
        }
    };

    const measuredPage = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
            });
        },
    });
    try {
        await measuredPage.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await measuredPage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 42,
                hasActive: 1,
                positions: [0.42, 0, 0],
            });
        });
        await measuredPage.locator(".mobile-global-mod-rail-activity").waitFor();
        await expandGlobalModRail(measuredPage);
        await measuredPage.locator('[data-role="mobile-global-mod-rail-auto-toggle"]').click();
        await collapseGlobalModRail(measuredPage);
        await measuredPage.waitForTimeout(240);
        const collapsed = await readGeometry(measuredPage);
        assert.equal(collapsed.scale, SCALE);
        assert.equal(collapsed.surfaceEdge, "right");
        closeToScaled(collapsed.rail.width, BASE.railWidth, "rail width");
        closeToScaled(collapsed.rail.height, BASE.railCollapsedHeight, "collapsed rail height");
        closeToScaled(collapsed.tab.height, BASE.tabHeight, "tab and grip tap height");
        closeToScaled(collapsed.selected.width, BASE.module, "selected-source tap width");
        closeToScaled(collapsed.selected.height, BASE.module, "selected-source tap height");
        closeToScaled(collapsed.selectedArt.width, BASE.icon, "selected-source icon");
        closeToScaled(collapsed.sourceNumber.width, BASE.sourceNumberWidth, "source-number label width");
        closeToScaled(collapsed.sourceNumber.height, BASE.sourceNumberHeight, "source-number label height");
        closeToScaled(collapsed.sourceNumberFontSize, BASE.label, "source-number label type");
        closeToScaled(collapsed.badge.height, BASE.badge, "route badge");
        closeToScaled(collapsed.badgeFontSize, BASE.label, "route badge label type");
        closeToScaled(collapsed.activity.width, BASE.activityWidth, "activity mark width");
        closeToScaled(collapsed.activity.height, BASE.activityHeight, "activity mark height");
        closeToScaled(collapsed.note.width, BASE.module, "note tap width");
        closeToScaled(collapsed.note.height, BASE.module, "note tap height");
        closeToScaled(collapsed.noteIcon.width, BASE.icon, "note icon");
        closeToScaled(collapsed.noteDot.width, 4, "note activity dot");
        closeToScaled(collapsed.handleDot.width, BASE.handleDot, "handle dots");
        closeToScaled(collapsed.handleColumnGap, BASE.handleGap, "handle spacing");
        closeToScaled(collapsed.chevronSize, BASE.chevron, "disclosure arrow");
        closeToScaled(collapsed.outline, BASE.outline, "continuous outline", 0.05);
        assertCentered(collapsed.rail, collapsed.selected, "selected source");
        assertCentered(collapsed.rail, collapsed.note, "note module");
        assertCentered(collapsed.rail, collapsed.handle, "drag handle");
        closeToScaled(collapsed.note.top - collapsed.selected.bottom, BASE.gap, "module spacing");
        assertSafe(collapsed, "393x852 collapsed right rail");

        await expandGlobalModRail(measuredPage);
        await measuredPage.waitForTimeout(160);
        const expanded = await readGeometry(measuredPage);
        assert.ok(expanded.drawer && expanded.paddle && expanded.sources.length === 3);
        closeToScaled(expanded.paddle.height, BASE.paddleHeight, "paging tap height");
        closeToScaled(expanded.sources[0].height, BASE.module, "drawer source tap height");
        closeToScaled(expanded.sources[0].width, BASE.railWidth, "drawer source tap width");
        closeToScaled(expanded.sourceArt.width, BASE.module, "drawer source art module");
        closeToScaled(expanded.sourceGlyph.width, BASE.icon, "drawer source icon");
        closeToScaled(expanded.sources[1].top - expanded.sources[0].bottom, BASE.gap, "drawer source gap");
        closeToScaled(expanded.keyboardToggle.width, BASE.module, "keyboard toggle tap");
        closeToScaled(expanded.autoToggle.height, BASE.module, "auto toggle tap");
        closeToScaled(expanded.voiceToggle.width, BASE.voiceToggleWidth, "voice toggle tap");
        closeToScaled(expanded.voiceToggleFontSize, BASE.label, "voice toggle label type");
        assertSafe(expanded, "393x852 expanded right rail");

        const visiblePageBefore = await measuredPage.locator(".rack-mod-page").evaluateAll((pages) => (
            pages.findIndex((page) => page.getAttribute("aria-hidden") === "false")
        ));
        await measuredPage.getByRole("button", { name: "Next modulation-source group" }).click();
        const visiblePageAfter = await measuredPage.locator(".rack-mod-page").evaluateAll((pages) => (
            pages.findIndex((page) => page.getAttribute("aria-hidden") === "false")
        ));
        assert.equal(visiblePageAfter, (visiblePageBefore + 1) % 3, "Scaled paging taps must still advance exactly one group.");
    } finally {
        await measuredPage.close();
    }

    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }]) {
        for (const edge of ["left", "right"]) {
            const page = await openHarnessPage({
                beforeGoto: async (nextPage) => {
                    await nextPage.setViewportSize(viewport);
                    await nextPage.addInitScript(({ storedEdge }) => {
                        localStorage.setItem(
                            "cosimo.mobile-global-mod-rail.position.v1",
                            JSON.stringify({ version: 2, edge: storedEdge, normalizedY: 0.42 }),
                        );
                    }, { storedEdge: edge });
                },
            });
            try {
                await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
                await page.waitForTimeout(240);
                const collapsed = await readGeometry(page);
                assert.equal(collapsed.edge, edge);
                assert.equal(collapsed.surfaceEdge, edge);
                assertSafe(collapsed, `${viewport.width}x${viewport.height} collapsed ${edge} rail`);
                await expandGlobalModRail(page);
                await page.waitForTimeout(160);
                const expanded = await readGeometry(page);
                assert.equal(expanded.edge, edge);
                assertSafe(expanded, `${viewport.width}x${viewport.height} expanded ${edge} rail`);
                assert.equal(
                    expanded.drawer.height <= expanded.drawerScrollHeight + 0.5,
                    true,
                    "Cramped drawers may scroll but must never exceed their content height.",
                );
            } finally {
                await page.close();
            }
        }
    }
});

test("the global modulation rail keeps a fixed tab and opens its source drawer toward available space", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.25 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readGlobalModRailGeometry(page);
        assert.ok(collapsed?.rail && collapsed.body && collapsed.tab && collapsed.art && collapsed.routeCount, "The rail must render its fixed tab, source art, and route count.");
        assert.equal(
            Math.abs(collapsed.rail.right - collapsed.viewportWidth) <= 0.5,
            true,
            "The collapsed tab must attach flush to the right screen edge.",
        );
        for (const [label, part] of Object.entries({ art: collapsed.art, routeCount: collapsed.routeCount, chevron: collapsed.chevron })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(collapsed.rail, part),
                true,
                `Collapsed ${label} must fit inside the tab: ${JSON.stringify(part)} vs ${JSON.stringify(collapsed.rail)}`,
            );
            assert.equal(
                rectContains(collapsed.body, part),
                true,
                `Collapsed ${label} must sit on the filled tab body: ${JSON.stringify(part)} vs ${JSON.stringify(collapsed.body)}`,
            );
        }
        const collapsedArtCenter = {
            x: (collapsed.art.left + collapsed.art.right) / 2,
            y: (collapsed.art.top + collapsed.art.bottom) / 2,
        };
        const collapsedBadgeCenter = {
            x: (collapsed.routeCount.left + collapsed.routeCount.right) / 2,
            y: (collapsed.routeCount.top + collapsed.routeCount.bottom) / 2,
        };
        assert.equal(
            Math.abs(collapsedArtCenter.x - ((collapsed.tab.left + collapsed.tab.right) / 2)) <= 0.5,
            true,
            "The collapsed source must be centered horizontally in the fixed tab.",
        );
        assert.equal(rectsIntersect(collapsed.art, collapsed.routeCount), true, "The route count must overlay the active source like a notification badge.");
        assert.equal(collapsedBadgeCenter.x > collapsedArtCenter.x, true, "The route count must sit on the source's upper-right corner.");
        assert.equal(collapsedBadgeCenter.y < collapsedArtCenter.y, true, "The route count must sit on the source's upper-right corner.");

        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readGlobalModRailGeometry(page);
        assert.ok(expanded?.rail && expanded.tab && expanded.drawer && expanded.track, "The expanded rail must render its fixed tab and source drawer.");
        assert.equal(
            Math.abs(expanded.rail.right - expanded.viewportWidth) <= 0.5,
            true,
            "The expanded tab must stay flush to the right screen edge.",
        );
        for (const key of ["left", "right", "top", "width", "height"]) {
            assert.equal(
                Math.abs(expanded.tab[key] - collapsed.tab[key]) <= 1.5,
                true,
                `Expansion changed the persistent tab's ${key}: ${collapsed.tab[key]} -> ${expanded.tab[key]}.`,
            );
        }
        assert.equal(
            Math.abs(expanded.rail.width - collapsed.rail.width) <= 1,
            true,
            `Expansion must not widen sideways (collapsed ${collapsed.rail.width}px, expanded ${expanded.rail.width}px).`,
        );
        assert.equal(Math.abs(expanded.rail.top - collapsed.rail.top) <= 1.5, true, "Expansion must not move the tab's top edge.");
        assert.equal(
            expanded.rail.height >= collapsed.rail.height + 120,
            true,
            "The source drawer must extend the rail downward.",
        );
        assert.equal(
            expanded.drawer.top >= expanded.tab.bottom - 1,
            true,
            `The source drawer must begin beneath the tab: ${JSON.stringify(expanded.drawer)} vs ${JSON.stringify(expanded.tab)}.`,
        );
        for (const [label, part] of Object.entries({ drawer: expanded.drawer, track: expanded.track })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(expanded.rail, part),
                true,
                `Expanded ${label} must live inside the tab surface, not a detached popup: ${JSON.stringify(part)} vs ${JSON.stringify(expanded.rail)}`,
            );
        }
        if (expanded.keyboard) {
            assert.equal(
                expanded.rail.bottom <= expanded.keyboard.top + 0.5,
                true,
                "The expanded tab must stay clear of the sticky keyboard.",
            );
        }
        assert.equal(expanded.documentFits, true, "The expanded tab must not create horizontal page overflow.");

        await page.locator('[data-role="mobile-global-mod-rail-grip"]').click({ position: { x: 28, y: 12 } });
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="false"]').waitFor();
        await page.waitForTimeout(260);
        const collapsedAgain = await readGlobalModRailGeometry(page);
        assert.ok(collapsedAgain?.rail);
        assert.equal(
            Math.abs(collapsedAgain.rail.height - collapsed.rail.height) <= 1,
            true,
            "Collapsing must remove only the downward drawer.",
        );

        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const narrow = await readGlobalModRailGeometry(page);
        assert.ok(narrow?.rail && narrow.tab && narrow.drawer && narrow.track, "The expanded rail must survive a 320px viewport.");
        assert.equal(Math.abs(narrow.rail.right - narrow.viewportWidth) <= 0.5, true, "The tab must stay flush at 320px.");
        assert.equal(Math.abs(narrow.rail.width - narrow.tab.width) <= 1, true, "The drawer must retain the tab's narrow width at 320px.");
        for (const [label, part] of Object.entries({ drawer: narrow.drawer, track: narrow.track })) {
            if (part === null) {
                continue;
            }
            assert.equal(
                rectContains(narrow.rail, part),
                true,
                `Expanded ${label} must stay inside the tab at 320px: ${JSON.stringify(part)} vs ${JSON.stringify(narrow.rail)}`,
            );
        }
        assert.equal(narrow.documentFits, true, "The expanded tab must not overflow a 320px viewport.");

    } finally {
        await page.close();
    }
});

test("a bottom-positioned global modulation rail opens its drawer upward", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 1 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        const collapsed = await readGlobalModRailGeometry(page);
        assert.ok(collapsed?.rail && collapsed.tab);
        await expandGlobalModRail(page);
        await page.waitForTimeout(120);
        const expanded = await readGlobalModRailGeometry(page);
        assert.ok(expanded?.rail && expanded.tab && expanded.drawer && expanded.track);
        for (const key of ["left", "right", "top", "width", "height"]) {
            assert.equal(
                Math.abs(expanded.tab[key] - collapsed.tab[key]) <= 1.5,
                true,
                `Upward expansion changed the persistent tab's ${key}: ${collapsed.tab[key]} -> ${expanded.tab[key]}.`,
            );
        }
        assert.equal(
            expanded.drawer.bottom <= expanded.tab.top + 1,
            true,
            `A bottom-positioned rail must open upward: ${JSON.stringify(expanded.drawer)} vs ${JSON.stringify(expanded.tab)}.`,
        );
        assert.equal(rectContains(expanded.rail, expanded.drawer), true, "The upward drawer must remain inside the continuous rail surface.");
        assert.equal(expanded.documentFits, true, "Upward expansion must not create page overflow.");
    } finally {
        await page.close();
    }
});

test("the parameter gesture HUD avoids the active control, the global rail, the keyboard, and the finger", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0 }),
                );
            });
        },
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        await createRackMappingByDrop(page);

        const readHudCollisions = async (knobRole, finger) => {
            const layout = await page.evaluate(({ role }) => {
                const rectOf = (element) => {
                    if (!element) {
                        return null;
                    }
                    const bounds = element.getBoundingClientRect();
                    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
                };
                const hud = document.querySelector('[data-role="mobile-voice-hud"]');
                return {
                    hud: rectOf(hud),
                    hudPosition: hud ? getComputedStyle(hud).position : null,
                    hudPointerEvents: hud ? getComputedStyle(hud).pointerEvents : null,
                    knob: rectOf(document.querySelector(`[data-role="${role}"]`)),
                    rail: rectOf(document.querySelector('[data-role="mobile-global-mod-rail"]')),
                    drawer: rectOf(document.querySelector('[data-role="mobile-global-mod-rail-drawer"]')),
                    keyboard: rectOf(document.querySelector('[data-role="sticky-keyboard"]')),
                    viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
                };
            }, { role: knobRole });
            assert.ok(layout.hud && layout.knob && layout.rail && layout.keyboard, "Expected the HUD and its exclusion surfaces.");
            assert.equal(layout.hudPointerEvents, "none", "The HUD must remain pointer-events none.");
            assert.equal(rectsIntersect(layout.hud, layout.knob), false, `HUD covers the active control ${knobRole}.`);
            assert.equal(rectsIntersect(layout.hud, layout.rail), false, "HUD covers the global modulation rail.");
            if (layout.drawer) {
                assert.equal(rectsIntersect(layout.hud, layout.drawer), false, "HUD covers the rail drawer.");
            }
            assert.equal(rectsIntersect(layout.hud, layout.keyboard), false, "HUD covers the sticky keyboard.");
            assert.equal(
                rectsIntersect(layout.hud, {
                    left: finger.x - 40,
                    right: finger.x + 40,
                    top: finger.y - 40,
                    bottom: finger.y + 40,
                }),
                false,
                "HUD sits inside the active finger zone.",
            );
            assert.equal(rectContains(layout.viewport, layout.hud, 0), true, "HUD must remain fully on screen.");
            return layout.hud;
        };

        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const artBox = await knob.locator(".rack-knob-art").boundingBox();
        assert.ok(artBox);
        const start = { x: artBox.x + (artBox.width / 2), y: artBox.y + (artBox.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 42, start.y, { steps: 8 });
        await page.locator('[data-role="mobile-voice-hud"]').waitFor();
        const firstPlacement = await readHudCollisions("rack-parameter-reverbSize", { x: start.x + 42, y: start.y });
        await page.mouse.move(start.x + 58, start.y, { steps: 4 });
        const secondPlacement = await readHudCollisions("rack-parameter-reverbSize", { x: start.x + 58, y: start.y });
        assert.equal(
            Math.abs(firstPlacement.left - secondPlacement.left) <= 1.5 && Math.abs(firstPlacement.top - secondPlacement.top) <= 1.5,
            true,
            "The HUD must keep one stable placement during an uninterrupted gesture.",
        );
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="mobile-voice-hud"]') === null);

        const lastKnob = page.locator(".rack-editor-controls .rack-parameter-knob").last();
        await lastKnob.scrollIntoViewIfNeeded();
        const lastKnobRole = await lastKnob.getAttribute("data-role");
        const lastArtBox = await lastKnob.locator(".rack-knob-art").boundingBox();
        assert.ok(lastKnobRole && lastArtBox);
        const lastStart = { x: lastArtBox.x + (lastArtBox.width / 2), y: lastArtBox.y + (lastArtBox.height / 2) };
        await page.mouse.move(lastStart.x, lastStart.y);
        await page.mouse.down();
        await page.mouse.move(lastStart.x, lastStart.y - 24, { steps: 6 });
        await page.locator('[data-role="mobile-voice-hud"]').waitFor();
        await readHudCollisions(lastKnobRole, { x: lastStart.x, y: lastStart.y - 24 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('[data-role="mobile-voice-hud"]') === null);
    } finally {
        await page.close();
    }
});

test("rail grip drags own the touch without page scroll, persist across reload, and cancel cleanly", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const grip = rail.locator('[data-role="mobile-global-mod-rail-grip"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");
        await rail.waitFor();

        const readScrollState = () => page.evaluate(() => ({
            documentTop: document.documentElement.scrollTop,
            panels: Array.from(document.querySelectorAll(".mobile-workspace-panel")).map((panel) => panel.scrollTop),
        }));

        const before = await rail.boundingBox();
        const scrollBefore = await readScrollState();
        const handleBox = await handle.boundingBox();
        assert.ok(before && handleBox);
        const gripStart = { x: handleBox.x + (handleBox.width / 2), y: handleBox.y + (handleBox.height / 2) };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...gripStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: gripStart.x, y: gripStart.y + (step * 15), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        const scrollDuring = await readScrollState();
        assert.deepEqual(scrollDuring, scrollBefore, "A grip drag must not scroll the page or any panel.");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
        ));
        await page.waitForTimeout(220);

        const moved = await rail.boundingBox();
        assert.ok(moved);
        assert.equal(moved.y - before.y >= 24, true, "The grip drag must reposition the rail.");
        assert.deepEqual(await readScrollState(), scrollBefore);
        assert.equal(await page.evaluate(() => localStorage.getItem("cosimo.mobile-global-mod-rail.position.v1") !== null), true);

        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await rail.waitFor();
        await page.waitForTimeout(120);
        const restored = await rail.boundingBox();
        assert.ok(restored);
        assert.equal(
            Math.abs(restored.y - moved.y) <= 2,
            true,
            `Reload must restore the persisted rail position (was ${moved.y}, restored ${restored.y}).`,
        );

        const topBeforeCancel = (await rail.boundingBox())?.y;
        const cancelHandleBox = await handle.boundingBox();
        assert.ok(topBeforeCancel !== undefined && cancelHandleBox);
        const cancelStart = {
            x: cancelHandleBox.x + (cancelHandleBox.width / 2),
            y: cancelHandleBox.y + (cancelHandleBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...cancelStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: cancelStart.x, y: cancelStart.y + 40, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await page.waitForTimeout(240);
        assert.equal(
            Math.abs(((await rail.boundingBox())?.y ?? 0) - topBeforeCancel) <= 1,
            true,
            "A cancelled grip drag must restore the rail position.",
        );

        await grip.click({ position: { x: 28, y: 26 } });
        assert.equal(await grip.getAttribute("aria-expanded"), "true", "The grip must still toggle after cancelled gestures.");
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("rail flick keeps moving after touch release and faster releases travel farther", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.5 }),
                );
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    // This test ASSERTS motion; the harness default is reduced-motion.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const handle = rail.locator(".mobile-global-mod-rail-handle");

        const resetRailToMiddle = async () => {
            await page.evaluate(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ normalizedY: 0.5 }),
                );
            });
            await page.reload({ waitUntil: "commit" });
            await waitForHarnessReady(page);
            await rail.waitFor();
            await page.waitForTimeout(140);
        };

        const releaseFlickUp = async (stepDelayMs, releasePauseMs) => {
            const handleBox = await handle.boundingBox();
            assert.ok(handleBox);
            const start = {
                x: handleBox.x + (handleBox.width / 2),
                y: handleBox.y + (handleBox.height / 2),
            };

            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
            });
            for (let step = 1; step <= 4; step += 1) {
                await page.waitForTimeout(stepDelayMs);
                await cdp.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [{
                        x: start.x,
                        y: start.y - (step * 6),
                        radiusX: 5,
                        radiusY: 5,
                        force: 1,
                    }],
                });
            }
            await page.waitForTimeout(releasePauseMs);

            const held = await rail.boundingBox();
            assert.ok(held);
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            return held;
        };

        const measureFlickUp = async (stepDelayMs, releasePauseMs) => {
            const held = await releaseFlickUp(stepDelayMs, releasePauseMs);
            await page.waitForTimeout(80);
            const shortlyAfterRelease = await rail.boundingBox();
            assert.ok(shortlyAfterRelease);
            await page.waitForFunction(() => (
                document.querySelector('[data-role="mobile-global-mod-rail"]')?.getAttribute("data-decelerating") === "false"
            ));
            await page.waitForTimeout(220);
            const settled = await rail.boundingBox();
            assert.ok(settled);

            return {
                first80Ms: held.y - shortlyAfterRelease.y,
                totalMomentum: held.y - settled.y,
            };
        };

        await rail.waitFor();
        await page.waitForTimeout(140);
        const fast = await measureFlickUp(8, 16);

        await resetRailToMiddle();
        const slow = await measureFlickUp(70, 120);

        assert.equal(
            fast.first80Ms >= 8,
            true,
            `A quick upward flick must keep traveling after release: ${JSON.stringify({ fast, slow })}`,
        );
        assert.equal(
            fast.totalMomentum >= slow.totalMomentum + 24,
            true,
            `Release speed must increase momentum travel: ${JSON.stringify({ fast, slow })}`,
        );

        await resetRailToMiddle();
        await page.evaluate(() => {
            const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (callback) => nativeRequestAnimationFrame((timeStamp) => {
                callback(timeStamp + 500);
            });
        });
        await releaseFlickUp(8, 16);
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        assert.equal(
            await rail.getAttribute("data-decelerating"),
            "false",
            "A delayed animation frame must consume elapsed coast time instead of resuming in slow motion.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("rack mod bar vertically pages one colored MSEG Envelope and Macro identity per source", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    // This test ASSERTS motion; the harness default is reduced-motion.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    try {
        await expandGlobalModRail(page);
        await page.waitForSelector('[data-role="rack-mod-source-track"]');

        const initial = await page.evaluate(() => {
            const rack = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const track = document.querySelector('[data-role="rack-mod-source-track"]');
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            if (!(rack instanceof HTMLElement) || !(track instanceof HTMLElement) || !(activePage instanceof HTMLElement)) {
                return null;
            }
            return {
                labels: Array.from(activePage.querySelectorAll("button")).map((button) => button.getAttribute("aria-label")),
                sourceRoles: Array.from(rack.querySelectorAll('button[data-role^="rack-mod-source-"]'))
                    .map((element) => element.getAttribute("data-role")),
                rackText: rack.textContent ?? "",
                transitionDuration: getComputedStyle(track).transitionDuration,
            };
        });

        assert.ok(initial);
        assert.deepEqual(initial.labels, ["MSEG 1", "Envelope 1", "Macro 1"]);
        assert.equal(initial.sourceRoles.length, 9);
        assert.equal(initial.sourceRoles.some((role) => /lfo/i.test(String(role))), false);
        assert.equal(/\blfo\b/i.test(initial.rackText), false);
        assert.equal(initial.transitionDuration, "0.28s");

        const visualContract = await page.evaluate(() => {
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            const sources = Array.from(activePage?.querySelectorAll(".rack-mod-source") ?? []);
            const previous = document.querySelector('[aria-label="Previous modulation-source group"]');
            if (!(activePage instanceof HTMLElement)
                || sources.length !== 3
                || !(previous instanceof HTMLButtonElement)) {
                return null;
            }
            return {
                sources: sources.map((source) => {
                    const button = source;
                    const art = source.querySelector(".rack-mod-art");
                    const glyph = source.querySelector('[data-role="rack-mod-glyph"]');
                    const number = source.querySelector(".rack-mod-number");
                    if (!(button instanceof HTMLButtonElement)
                        || !(art instanceof HTMLElement)
                        || !(glyph instanceof HTMLElement)
                        || !(number instanceof HTMLElement)) {
                        return null;
                    }
                    const buttonStyle = getComputedStyle(button);
                    const artStyle = getComputedStyle(art);
                    const glyphStyle = getComputedStyle(glyph);
                    const bounds = button.getBoundingClientRect();
                    return {
                        label: button.getAttribute("aria-label"),
                        buttonWidth: bounds.width,
                        buttonHeight: bounds.height,
                        centerX: bounds.left + (bounds.width / 2),
                        top: bounds.top,
                        bottom: bounds.bottom,
                        artWidth: art.getBoundingClientRect().width,
                        artHeight: art.getBoundingClientRect().height,
                        background: buttonStyle.backgroundColor,
                        boxShadow: buttonStyle.boxShadow,
                        overflow: buttonStyle.overflow,
                        accent: buttonStyle.getPropertyValue("--source-color").trim(),
                        visualCount: art.querySelectorAll('img, [data-role="rack-mod-glyph"]').length,
                        glyphColor: glyphStyle.backgroundColor,
                        glyphMask: glyphStyle.maskImage || glyphStyle.webkitMaskImage,
                        number: number.textContent?.trim(),
                        artFilter: artStyle.filter,
                    };
                }),
                drawer: (() => {
                    const drawer = document.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
                    if (!(drawer instanceof HTMLElement)) {
                        return null;
                    }
                    const bounds = drawer.getBoundingClientRect();
                    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
                })(),
                previous: (() => {
                    const bounds = previous.getBoundingClientRect();
                    return { width: bounds.width, height: bounds.height };
                })(),
                next: (() => {
                    const next = document.querySelector('[aria-label="Next modulation-source group"]');
                    if (!(next instanceof HTMLButtonElement)) {
                        return null;
                    }
                    const bounds = next.getBoundingClientRect();
                    return { width: bounds.width, height: bounds.height };
                })(),
            };
        });

        assert.ok(visualContract);
        assert.equal(visualContract.sources.every(Boolean), true);
        assert.deepEqual(visualContract.sources.map((source) => source.number), ["1", "1", "1"]);
        assert.deepEqual(visualContract.sources.map((source) => source.accent), ["#cc59d2", "#b8e236", "#ff6428"]);
        // T42 scales the complete B2 skeleton: a full-width 44px hit area
        // around a 30.8px source module, on the rail's 11px rhythm.
        assert.equal(visualContract.sources.every((source) => (
            Math.abs(source.buttonWidth - 44) <= 0.1
            && Math.abs(source.buttonHeight - 30.8) <= 0.1
        )), true);
        assert.equal(visualContract.sources.every((source) => (
            Math.abs(source.artWidth - 30.8) <= 0.1
            && Math.abs(source.artHeight - 30.8) <= 0.1
        )), true);
        assert.equal(visualContract.sources.every((source) => source.background === "rgba(0, 0, 0, 0)"), true);
        assert.equal(visualContract.sources.every((source) => source.boxShadow === "none"), true);
        assert.equal(visualContract.sources.every((source) => source.overflow === "visible"), true);
        assert.equal(visualContract.sources.every((source) => source.visualCount === 1), true, "Each source must render exactly one identity icon.");
        assert.deepEqual(visualContract.sources.map((source) => source.glyphColor), ["rgb(204, 89, 210)", "rgb(184, 226, 54)", "rgb(255, 100, 40)"]);
        assert.equal(visualContract.sources.every((source) => source.glyphMask !== "none"), true);
        assert.equal(
            Math.max(...visualContract.sources.map((source) => source.centerX))
                - Math.min(...visualContract.sources.map((source) => source.centerX)) <= 1,
            true,
            "The active source page must be one vertical column.",
        );
        assert.ok(visualContract.drawer);
        assert.equal(
            visualContract.sources.every((source) => (
                Math.abs(source.centerX - ((visualContract.drawer.left + visualContract.drawer.right) / 2)) <= 0.5
            )),
            true,
            "Every source must be centered horizontally in the drawer.",
        );
        assert.equal(
            visualContract.sources.every((source, index, sources) => index === 0 || source.top >= sources[index - 1].bottom - 1),
            true,
            "The three source controls must stack downward without overlap.",
        );
        assert.equal(
            visualContract.sources.slice(1).every((source, index) => (
                Math.abs(source.top - visualContract.sources[index].bottom - 11) <= 0.5
            )),
            true,
            "Source rows must sit on the rail's single scaled 11px rhythm.",
        );
        for (const paddle of [visualContract.previous, visualContract.next]) {
            assert.equal(Math.abs(paddle.width - 44) <= 0.1, true);
            assert.equal(Math.abs(paddle.height - 22) <= 0.1, true);
        }

        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        const selectedVisual = await page.locator('[data-role="rack-mod-source-mseg-1"]').evaluate((button) => {
            const art = button.querySelector(".rack-mod-art");
            const viewport = button.closest(".rack-mod-viewport");
            const underline = getComputedStyle(button, "::after");
            const viewportStyle = viewport instanceof HTMLElement ? getComputedStyle(viewport) : null;
            return {
                buttonFilter: getComputedStyle(button).filter,
                buttonShadow: getComputedStyle(button).boxShadow,
                artFilter: art instanceof HTMLElement ? getComputedStyle(art).filter : "",
                artTransform: art instanceof HTMLElement ? getComputedStyle(art).transform : "",
                artBackground: art instanceof HTMLElement ? getComputedStyle(art).backgroundColor : "",
                underlineDisplay: underline.display,
                viewportOverflow: viewportStyle?.overflow ?? "",
                viewportClipMargin: viewportStyle?.overflowClipMargin ?? "",
            };
        });
        // B2 selection: the module itself tints — no glow, no scale, no
        // underline. The tinted container is the entire selected treatment.
        assert.equal(selectedVisual.buttonFilter, "none");
        assert.equal(selectedVisual.buttonShadow, "none");
        assert.equal(selectedVisual.artFilter, "none");
        assert.equal(selectedVisual.artTransform, "none");
        assert.notEqual(selectedVisual.artBackground, "rgba(0, 0, 0, 0)");
        assert.equal(selectedVisual.underlineDisplay, "none");
        assert.equal(selectedVisual.viewportOverflow, "clip");
        // B2 modules carry no glow: the viewport clips hard so the next page
        // cannot peek through the 10px rhythm gap.
        assert.equal(Number.parseFloat(selectedVisual.viewportClipMargin), 0);

        const animation = await page.evaluate(async () => {
            const track = document.querySelector('[data-role="rack-mod-source-track"]');
            const viewport = document.querySelector(".rack-mod-viewport");
            const next = document.querySelector('[aria-label="Next modulation-source group"]');
            if (!(track instanceof HTMLElement) || !(viewport instanceof HTMLElement) || !(next instanceof HTMLButtonElement)) {
                return null;
            }
            const startTop = track.getBoundingClientRect().top;
            const travel = viewport.getBoundingClientRect().height;
            next.click();
            await new Promise((resolve) => window.setTimeout(resolve, 80));
            const duringTop = track.getBoundingClientRect().top;
            await new Promise((resolve) => window.setTimeout(resolve, 260));
            const endTop = track.getBoundingClientRect().top;
            const activePage = document.querySelector('.rack-mod-page[aria-hidden="false"]');
            const selected = activePage?.querySelector('[aria-pressed="true"]');
            const header = document.querySelector('.rack-mod-header strong');
            return {
                startTop,
                duringTop,
                endTop,
                travel,
                labels: Array.from(activePage?.querySelectorAll("button") ?? [])
                    .map((button) => button.getAttribute("aria-label")),
                selectedLabel: selected?.getAttribute("aria-label") ?? null,
                armedLabel: header?.textContent ?? "",
            };
        });

        assert.ok(animation);
        assert.equal(animation.duringTop < animation.startTop - 1, true, "The vertical source page did not begin moving.");
        assert.equal(
            animation.duringTop > animation.startTop - animation.travel + 1,
            true,
            "The vertical source page switched instantly instead of animating.",
        );
        assert.equal(
            Math.abs((animation.startTop - animation.endTop) - animation.travel) <= 2,
            true,
            `The vertical source track did not finish one page away: ${JSON.stringify(animation)}`,
        );
        assert.deepEqual(animation.labels, ["MSEG 2", "Envelope 2", "Macro 2"]);
        assert.equal(animation.selectedLabel, null);
        assert.match(animation.armedLabel, /MSEG 1/);
    } finally {
        await page.close();
    }
});

test("rack mod bar keeps source and target selection unassigned until source-drop route creation", async () => {
    const sourceFirstPage = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await sourceFirstPage.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(sourceFirstPage);
        await clearHarnessDebugLog(sourceFirstPage);
        await armModSourceForRoutingTest(sourceFirstPage, '[data-role="rack-mod-source-mseg-1"]');

        let snapshot = await getHarnessSnapshot(sourceFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.distortion#1.distortionDriveDb"
            )),
            false,
            "Selecting a source must not imply a modulation route.",
        );
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 0);
        assert.equal(await sourceFirstPage.locator('[data-role="rack-create-mapping"]').count(), 0);
        assert.equal(await sourceFirstPage.locator('[data-role="rack-unmapped-pair"]').count(), 0);
        await createRackMappingByDrop(sourceFirstPage);

        snapshot = await waitForHarnessSnapshot(
            sourceFirstPage,
            "explicit source-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.distortion#1.distortionDriveDb"
            )),
        );
        const sourceFirstRoute = readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "lane.distortion#1.distortionDriveDb"
        ));
        assert.ok(sourceFirstRoute);

        // T09: no separate AMOUNT control — the drive knob's vertical axis
        // edits the new route's amount with the shared HUD.
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 0);
        await collapseGlobalModRail(sourceFirstPage);
        const driveKnob = sourceFirstPage.locator('[data-role="distortion-drive-field"]');
        await driveKnob.waitFor();
        await dispatchRackKnobPointerEvents(driveKnob, [
            { type: "pointerdown", pointerId: 61, buttons: 1 },
            { type: "pointermove", pointerId: 61, buttons: 1, deltaY: -8 },
            { type: "pointermove", pointerId: 61, buttons: 1, deltaY: -120 },
        ]);
        await sourceFirstPage.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ));
        assert.match(
            await sourceFirstPage.locator('[data-role="mobile-voice-hud"]').innerText(),
            /Drive/i,
        );
        // The first write compiles the zero-depth route into the program; the
        // second must ride the small amount-update path.
        await dispatchRackKnobPointerEvents(driveKnob, [
            { type: "pointermove", pointerId: 61, buttons: 1, deltaY: -150 },
            { type: "pointerup", pointerId: 61, buttons: 0, deltaY: -150 },
        ]);

        snapshot = await waitForHarnessSnapshot(
            sourceFirstPage,
            "rack route amount update",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.distortion#1.distortionDriveDb"
                && route.amount > 1
            )),
        );
        const modulationMessages = snapshot.sentMessages.filter(({ endpointID }) => (
            endpointID === "modulationProgram" || endpointID === "modulationAmount"
        ));
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => {
            if (endpointID !== "modulationProgram") return false;
            const count = Number(value?.voiceRackRouteCount) || 0;
            const routeIndex = value?.voiceRackRouteCells?.slice(0, count).indexOf(3) ?? -1;
            return routeIndex >= 0 && Number(value?.voiceRackRouteReducers?.[routeIndex]) === 1;
        }), true, `Voice-source rack route did not compile with Max reduction: ${JSON.stringify(modulationMessages)}`);
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationAmount"
            && Number(value?.pathKind) === 3
            && Number(value?.cellIndex) === 3
            && Number(value?.amount) > 1
        )), true, `Voice-source rack amount edit did not use the small update path: ${JSON.stringify(modulationMessages)}`);
    } finally {
        await sourceFirstPage.close();
    }

    const targetFirstPage = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await targetFirstPage.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(targetFirstPage, "reverb");
        await expandGlobalModRail(targetFirstPage);
        await targetFirstPage.click('[aria-label="Next modulation-source group"]');
        await targetFirstPage.waitForTimeout(300);
        await waitForHarnessSnapshot(
            targetFirstPage,
            "target-first runtime boot program",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
        );
        await clearHarnessDebugLog(targetFirstPage);
        await armModSourceForRoutingTest(targetFirstPage, '[data-role="rack-mod-source-macro-2"]');

        let snapshot = await getHarnessSnapshot(targetFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
            false,
            "Target-first selection must remain context-only.",
        );
        await createRackMappingByDrop(
            targetFirstPage,
            '[data-role="rack-mod-source-macro-2"]',
        );

        snapshot = await waitForHarnessSnapshot(
            targetFirstPage,
            "explicit target-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
            "A zero-depth rack mapping must remain outside the active runtime prefix.",
        );

        assert.equal(await targetFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 0);
        await collapseGlobalModRail(targetFirstPage);
        const sizeKnob = targetFirstPage.locator('[data-role="rack-parameter-reverbSize"]');
        await sizeKnob.waitFor();
        await dispatchRackKnobPointerEvents(sizeKnob, [
            { type: "pointerdown", pointerId: 62, buttons: 1 },
            { type: "pointermove", pointerId: 62, buttons: 1, deltaY: -8 },
            { type: "pointermove", pointerId: 62, buttons: 1, deltaY: -110 },
        ]);
        await dispatchRackKnobPointerEvents(sizeKnob, [
            { type: "pointerup", pointerId: 62, buttons: 0, deltaY: -110 },
        ]);

        snapshot = await waitForHarnessSnapshot(
            targetFirstPage,
            "active target-first rack route",
            (nextSnapshot) => (
                readStoredModulationState(nextSnapshot).routes.some((route) => (
                    route.sourceKind === "macro"
                    && route.sourceSlot === 2
                    && route.targetKind === "lane.reverb#1.reverbSize"
                    && route.amount > 0
                ))
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "modulationProgram"
                    && Number(value?.macroRackRouteCount) >= 1
                    && value?.macroRackRouteSources?.slice(0, value.macroRackRouteCount).includes(1)
                    && value?.macroRackRouteTargets?.slice(0, value.macroRackRouteCount).includes(32)
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "modulationProgram"
                && Number(value?.macroRackRouteCount) >= 1
                && value?.macroRackRouteSources?.slice(0, value.macroRackRouteCount).includes(1)
                && value?.macroRackRouteTargets?.slice(0, value.macroRackRouteCount).includes(32)
            )),
            true,
            "Global Macro route must compile into the reducer-free macro-to-rack path.",
        );
    } finally {
        await targetFirstPage.close();
    }
});

test("the FX workspace has no separate route AMOUNT control: the target knob edits the amount live", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [{
                id: "mobile-rack-amount-route",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "lane.reverb#1.reverbSize",
                amount: 0,
                reducer: "max",
            }],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "seeded mobile rack modulation amount route",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === "mobile-rack-amount-route",
        );
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        await collapseGlobalModRail(page);

        // T09 settled cleanup: the separate AMOUNT slider is gone everywhere;
        // the target knob, its ring, and the shared HUD own the job.
        const knob = page.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.waitFor();
        assert.equal(
            await page.locator('[data-role="rack-modulation-amount"]').count(),
            0,
            "The selected-route AMOUNT slider must not exist.",
        );

        await clearHarnessDebugLog(page);
        await dispatchRackKnobPointerEvents(knob, [
            { type: "pointerdown", pointerId: 41, buttons: 1 },
            { type: "pointermove", pointerId: 41, buttons: 1, deltaY: -8 },
            { type: "pointermove", pointerId: 41, buttons: 1, deltaY: -40 },
        ]);
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ));
        const midDragFirst = await hud.innerText();
        await dispatchRackKnobPointerEvents(knob, [
            { type: "pointermove", pointerId: 41, buttons: 1, deltaY: -90 },
        ]);
        await page.waitForFunction((previousText) => (
            (document.querySelector('[data-role="mobile-voice-hud"]')?.textContent ?? "") !== previousText
        ), midDragFirst, { timeout: 3000 });
        await dispatchRackKnobPointerEvents(knob, [
            { type: "pointerup", pointerId: 41, buttons: 0, deltaY: -90 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "knob-owned rack route amount update",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.id === "mobile-rack-amount-route" && route.amount > 0
            )),
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID, value }) => (
            endpointID === "modulationAmount" && Number(value?.amount) > 0
        )), true, "The knob's amount edit must use the small runtime update path.");
    } finally {
        await page.close();
    }
});

test("rack modulation-source gesture cancels on window blur instead of creating a route", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await source.scrollIntoViewIfNeeded();
        const sourceBounds = await source.boundingBox();
        assert.ok(sourceBounds);
        const beforeRoutes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        await clearHarnessDebugLog(page);

        await page.mouse.move(
            sourceBounds.x + (sourceBounds.width / 2),
            sourceBounds.y + (sourceBounds.height / 2),
        );
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.up();
        await page.waitForTimeout(80);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredModulationState(snapshot).routes.length, beforeRoutes.length);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
            "A blurred source gesture must not create a modulation route on the later pointer release.",
        );
    } finally {
        await page.close();
    }
});

test("source preview and valid hover stay transient while the armed ring and focus indicator persist", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "armed-mseg-size", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.reverb#1.reverbSize", amount: 0.4, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        // ADR-025 row 9: a bypassed effect's controls are honestly grey, so
        // exercise the armed-ring colors on a POWERED effect.
        await page.click('[data-role="rack-editor-power"]');
        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        const surface = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const knob = surface.locator('[data-role="rack-parameter-reverbSize"]');
        await knob.focus();
        const env = page.locator('[data-role="rack-mod-source-env-1"]');
        const envBox = await env.boundingBox();
        const targetBox = await surface.boundingBox();
        assert.ok(envBox && targetBox);
        await page.mouse.move(envBox.x + envBox.width / 2, envBox.y + envBox.height / 2);
        await page.mouse.down();
        assert.equal(await knob.evaluate((element) => element.style.getPropertyValue("--rack-knob-mod-accent")), "#cc59d2");
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });

        const live = await surface.evaluate((element) => {
            const style = getComputedStyle(element);
            const knobElement = element.querySelector('.rack-parameter-knob');
            return {
                isHover: element.classList.contains("is-mod-hover"),
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                dragAccent: style.getPropertyValue("--drag-source-color").trim(),
                outline: style.outline,
                outlineOffset: style.outlineOffset,
                ringAccent: knobElement instanceof HTMLElement
                    ? knobElement.style.getPropertyValue("--rack-knob-mod-accent")
                    : "",
            };
        });
        assert.equal(live.isHover, true);
        // ADR-025 row 2: the selected target's border carries the owning
        // effect accent (reverb) rather than the old neutral.
        assert.ok(
            live.borderColor.startsWith("color(srgb 0.88") || live.borderColor.includes("225, 180, 86"),
            `selected-target border must be the reverb accent, got ${live.borderColor}`,
        );
        assert.notEqual(live.boxShadow, "none");
        assert.equal(live.dragAccent, "#b8e236");
        assert.match(live.outline, /rgb\(245, 255, 255\)/);
        assert.equal(live.outlineOffset, "2px");
        assert.equal(live.ringAccent, "#cc59d2");

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.up();
        await page.waitForTimeout(60);
        assert.equal((await surface.getAttribute("class")).includes("is-mod-hover"), false);
        assert.equal(await knob.evaluate((element) => element.style.getPropertyValue("--rack-knob-mod-accent")), "#cc59d2");
        const routes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routes.some((route) => route.sourceKind === "env" && route.targetKind === "lane.reverb#1.reverbSize"), false);
    } finally {
        await page.close();
    }
});

test("a source drag dwell-navigates tabs and rack effects while the gesture survives to the drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const voiceTab = page.locator('[data-role="mobile-workspace-tab-voice"]');
        const fxTab = page.locator('[data-role="mobile-workspace-tab-fx"]');
        assert.equal(await voiceTab.getAttribute("aria-selected"), "true");

        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox);
        await page.mouse.move(sourceBox.x + (sourceBox.width / 2), sourceBox.y + (sourceBox.height / 2));
        await page.mouse.down();
        // Activate the drag away from any dwell surface.
        await page.mouse.move(196, 300, { steps: 4 });

        // A dwell on an oscillator tab reveals that oscillator's targets.
        const oscillatorTabB = page.locator('[data-role="mobile-voice-tab-b"]');
        const oscillatorTabBox = await oscillatorTabB.boundingBox();
        assert.ok(oscillatorTabBox);
        await page.mouse.move(
            oscillatorTabBox.x + (oscillatorTabBox.width / 2),
            oscillatorTabBox.y + (oscillatorTabBox.height / 2),
            { steps: 3 },
        );
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="mobile-voice-editor"]')
                ?.getAttribute("data-selected-oscillator-id") === "B"
        ));
        await page.mouse.move(196, 300, { steps: 3 });

        // Transit: crossing the FX tab without stopping must not switch, and
        // leaving before the dwell cancels the pending navigation.
        const fxBox = await fxTab.boundingBox();
        assert.ok(fxBox);
        const fxCenter = { x: fxBox.x + (fxBox.width / 2), y: fxBox.y + (fxBox.height / 2) };
        await page.mouse.move(fxCenter.x, fxCenter.y, { steps: 3 });
        await page.mouse.move(196, 300, { steps: 3 });
        await page.waitForTimeout(750);
        assert.equal(await voiceTab.getAttribute("aria-selected"), "true", "transit must not switch tabs");

        // A deliberate dwell on the FX tab switches while the drag stays alive.
        await page.mouse.move(fxCenter.x, fxCenter.y, { steps: 3 });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-fx"]')?.getAttribute("aria-selected") === "true"
        ));
        assert.equal(
            await page.locator('[data-role="mobile-global-mod-source-ghost"]').count(),
            1,
            "the drag must survive the tab switch",
        );

        // A deliberate dwell on a rack effect row selects that effect.
        assert.equal(
            await page.locator("[data-selected-effect]").getAttribute("data-selected-effect"),
            "drive",
        );
        const reverbRow = page.locator('[data-role="rack-module-reverb"]');
        const reverbBox = await reverbRow.boundingBox();
        assert.ok(reverbBox);
        await page.mouse.move(reverbBox.x + 12, reverbBox.y + (reverbBox.height / 2), { steps: 3 });
        await page.waitForFunction(() => (
            document.querySelector("[data-selected-effect]")?.getAttribute("data-selected-effect") === "reverb"
        ));

        // The same gesture finishes with a real drop on the revealed target.
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const targetBox = await target.boundingBox();
        assert.ok(targetBox);
        await page.mouse.move(targetBox.x + (targetBox.width / 2), targetBox.y + (targetBox.height / 2), { steps: 6 });
        await page.mouse.up();
        await waitForHarnessSnapshot(
            page,
            "dwell-navigated drop creates the mapping",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
    } finally {
        await page.close();
    }
});

test("a real source drop creates a mapping after 100 existing mappings", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const routes = MODULATION_SOURCE_OPTIONS.flatMap((source) => (
            MODULATION_TARGET_OPTIONS.map((target) => ({ source, target }))
        )).filter(({ source, target }) => !(
            source.sourceKind === "env"
            && source.sourceSlot === 1
            && target.value === "lane.reverb#1.reverbSize"
        )).slice(0, 100).map(({ source, target }, routeIndex) => ({
            id: `large-set-drop-${routeIndex}`,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: "unipolar",
            targetKind: target.value,
            amount: routeIndex / 200,
            reducer: "max",
        }));
        const seededState = normalizeModulationState({
            routes,
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await waitForHarnessSnapshot(
            page,
            "large mapping set seeded before real drop",
            (snapshot) => readStoredModulationState(snapshot).routes.length === 100,
        );
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="rack-parameter-surface-reverbSize"]');
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await page.mouse.up();
        const after = await waitForHarnessSnapshot(
            page,
            "source drop creates mapping 101",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "lane.reverb#1.reverbSize"
            )),
        );
        assert.equal(readStoredModulationState(after).routes.length, 101);
        const knob = target.locator('[data-role="rack-parameter-reverbSize"]');
        assert.equal(await knob.getAttribute("data-route-state"), "mapped");
        assert.equal(await knob.locator('.rack-knob-route-presence').count(), 1);
        assert.doesNotMatch(await page.locator('.rack-route-status').innerText(), /ROUTE LIMIT/);
    } finally {
        await page.close();
    }
});

test("effect bypass and mode suspension preserve route geometry without claiming audible activity", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const seededState = normalizeModulationState({
            routes: [
                { id: "env-reverb", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.reverb#1.reverbSize", amount: 0.4, reducer: "max" },
                { id: "env-filter", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.globalFilter#1.globalFilterResonance", amount: 2, reducer: "max" },
                { id: "env-phaser", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.phaser#1.phaserRate", amount: 1.2, reducer: "max" },
                { id: "env-delay", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "lane.delay#1.delayTime", amount: 1, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.click('[data-role="rack-editor-power"]');
        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-env-1"]');
        await collapseGlobalModRail(page);
        const reverbKnob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const reverbBadge = page.locator('[data-role="rack-route-count-reverbSize"]');
        const activeGeometry = await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d");
        assert.notEqual(activeGeometry, "");
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        const routesBeforeBypass = routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes);

        await page.click('[data-role="rack-editor-power"]');
        assert.equal(
            (await page.locator('[data-role="rack-editor-reverb"] .rack-editor-heading').innerText()).trim(),
            "Reverb",
        );
        assert.equal(await page.locator('[data-role="rack-editor-power"]').getAttribute("aria-label"), "Enable Reverb");
        assert.equal(await page.locator('[data-role="rack-editor-power"]').getAttribute("aria-pressed"), "false");
        assert.equal(await reverbKnob.getAttribute("data-route-state"), "mapped");
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "effect-bypassed");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        assert.equal(
            await reverbKnob.locator('.rack-knob-mod-fill').evaluate((element) => getComputedStyle(element).filter),
            "none",
        );
        assert.deepEqual(routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes), routesBeforeBypass);
        await page.click('[data-role="rack-editor-power"]');
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "active");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);

        await page.click('[data-role="rack-editor-power"]');
        const reverbArtBox = await reverbKnob.locator('.rack-knob-art').boundingBox();
        assert.ok(reverbArtBox);
        await page.mouse.move(reverbArtBox.x + reverbArtBox.width / 2, reverbArtBox.y + reverbArtBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(reverbArtBox.x + reverbArtBox.width / 2, reverbArtBox.y + reverbArtBox.height / 2 - 30, { steps: 6 });
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "effect-bypassed");
        await page.mouse.up();
        const afterBypassedEdit = await waitForHarnessSnapshot(
            page,
            "effect-bypassed route amount edit",
            (snapshot) => readStoredModulationState(snapshot).routes.find((route) => route.id === "env-reverb")?.amount > 0.4,
        );
        assert.equal(await page.locator('[data-role="rack-editor-reverb"]').getAttribute("data-effect-enabled"), "false");
        assert.equal(readStoredModulationState(afterBypassedEdit).routes.find((route) => route.id === "env-reverb")?.enabled, true);

        await selectRackEffect(page, "filter");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("globalFilterMode", 0);
        });
        await page.waitForFunction(() => (
            Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().laneParams.globalFilterMode) === 0
        ));
        await page.click('[data-role="rack-editor-power"]');
        const filterMode = page.locator('[data-role="rack-parameter-globalFilterMode"]');
        const resonance = page.locator('[data-role="rack-parameter-globalFilterResonance"]');
        assert.equal(await filterMode.getAttribute("data-rack-mod-target"), null);
        assert.equal(await filterMode.locator('.rack-route-count-badge').count(), 0);
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "target-suspended");
        assert.equal(await page.locator('[data-role="rack-parameter-surface-globalFilterResonance"] .rack-target-suspended-label').count(), 1);
        await filterMode.click();
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "active");

        await selectRackEffect(page, "phaser");
        await page.click('[data-role="rack-editor-power"]');
        const phaserMode = page.locator('[data-role="rack-parameter-phaserRateMode"]');
        await phaserMode.click();
        const phaserRate = page.locator('[data-role="rack-parameter-phaserRate"]');
        assert.equal(await phaserRate.count(), 1, "Configured Free rate must stay discoverable in Sync mode.");
        assert.equal(await phaserRate.getAttribute("data-route-effectiveness"), "target-suspended");

        await selectRackEffect(page, "delay");
        await page.click('[data-role="rack-editor-power"]');
        await page.locator('[data-role="rack-parameter-delayTimeMode"]').click();
        const delayTime = page.locator('[data-role="rack-parameter-delayTime"]');
        assert.equal(await delayTime.count(), 1, "Configured Free time must stay discoverable in Sync mode.");
        assert.equal(await delayTime.getAttribute("data-route-effectiveness"), "target-suspended");
    } finally {
        await page.close();
    }
});

test("rack Filter defaults to Lowpass while its effect remains bypassed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "filter");

        const snapshot = await getHarnessSnapshot(page);
        const mode = page.locator('[data-role="rack-parameter-globalFilterMode"]');
        assert.equal(Number(snapshot.laneParams.globalFilterMode), 1);
        assert.match(await mode.innerText(), /Lowpass/i);
        assert.equal(
            (await page.locator('[data-role="rack-editor-filter"] .rack-editor-heading').innerText()).trim(),
            "Filter",
        );
        assert.equal(await page.locator('[data-role="rack-editor-power"]').getAttribute("aria-label"), "Enable Filter");
        assert.equal(await page.locator('[data-role="rack-editor-power"]').getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator('[data-role="rack-editor-filter"]').getAttribute("data-effect-enabled"), "false");
    } finally {
        await page.close();
    }
});

test("a two-digit exact route badge stays contained at 320px without changing the slider name", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 852 }),
    });

    try {
        const sources = [
            ["mseg", 1], ["mseg", 2], ["mseg", 3],
            ["env", 1], ["env", 2], ["env", 3],
            ["macro", 1], ["macro", 2], ["macro", 3], ["macro", 4],
            ["velocity", null], ["pressure", null],
        ];
        const seededState = normalizeModulationState({
            routes: sources.map(([sourceKind, sourceSlot], routeIndex) => ({
                id: `badge-${routeIndex}`,
                enabled: true,
                sourceKind,
                sourceSlot,
                polarity: "unipolar",
                targetKind: "lane.distortion#1.distortionWet",
                amount: routeIndex / 100,
                reducer: "max",
            })),
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const surface = page.locator('[data-role="rack-parameter-surface-distortionWet"]');
        const badge = surface.locator('[data-role="rack-route-count-distortionWet"]');
        const geometry = await surface.evaluate((element) => {
            const badgeElement = element.querySelector('.rack-route-count-badge');
            if (!(badgeElement instanceof HTMLElement)) return null;
            const surfaceBounds = element.getBoundingClientRect();
            const badgeBounds = badgeElement.getBoundingClientRect();
            return {
                surfaceLeft: surfaceBounds.left,
                surfaceRight: surfaceBounds.right,
                badgeLeft: badgeBounds.left,
                badgeRight: badgeBounds.right,
                badgeWidth: badgeBounds.width,
            };
        });
        assert.ok(geometry);
        assert.equal((await badge.textContent()).trim(), "12");
        assert.equal(geometry.badgeLeft >= geometry.surfaceLeft && geometry.badgeRight <= geometry.surfaceRight, true);
        assert.equal(geometry.badgeWidth >= 15, true);
        assert.equal(await surface.locator('[data-role="distortion-mix-field"]').getAttribute("aria-label"), "Mix");
        assert.match(await badge.getAttribute("aria-label"), /12 modulation routes target Mix/);
    } finally {
        await page.close();
    }
});

test("subway stations select on tap, reorder on drag, and never touch sound parameters", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);
        const station = page.locator('[data-role="rack-station-reverb"]');
        await station.scrollIntoViewIfNeeded();
        const stationBox = await station.boundingBox();
        assert.ok(stationBox);

        // Hovering the map is inert.
        await page.mouse.move(stationBox.x + (stationBox.width * 0.2), stationBox.y + (stationBox.height * 0.5));
        await page.mouse.move(stationBox.x + (stationBox.width * 0.8), stationBox.y + (stationBox.height * 0.5), { steps: 8 });
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, [], "Hovering a station must be inert.");
        assert.deepEqual(snapshot.gestureStarts, []);

        // A tap selects the station's editor without touching sound state.
        // Closing the prior Distortion editor deliberately parks its two
        // hidden observational analyzers, so only those lifecycle zeros are
        // permitted here.
        await station.click();
        await page.waitForSelector('[data-role="rack-editor-reverb"]');
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, [
            { endpointID: "distortionHistoryActivity", value: 0 },
            { endpointID: "distortionScopeActivity", value: 0 },
        ]);
        assert.deepEqual(snapshot.gestureStarts, []);

        // A drag along the line is a reorder: exactly one topology commit,
        // no parameter traffic, and the release detaches cleanly.
        const target = page.locator('[data-role="rack-module-filter"]');
        const targetBox = await target.boundingBox();
        assert.ok(targetBox);
        await page.mouse.move(stationBox.x + (stationBox.width / 2), stationBox.y + (stationBox.height / 2));
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetBox.x + (targetBox.width / 2), targetBox.y + (targetBox.height / 2), { steps: 12 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "station drag reorder commit",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneTopology"
                && Array.isArray(value?.slotIds)
                && Number(value.slotIds[0]) === 7
            )),
        );
        assert.equal(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "laneTopology").length, 1);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "laneSlotParamValue"), false);
        assert.deepEqual(snapshot.gestureStarts, []);

        const valueTraffic = await getHarnessSnapshot(page);
        await page.mouse.move(stationBox.x + 2, stationBox.y + (stationBox.height * 0.5), { steps: 10 });
        await page.waitForTimeout(80);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.length,
            valueTraffic.sentMessages.length,
            "Released station remained attached to the pointer.",
        );

        assert.equal(await page.locator('[data-rack-position][draggable="true"]').count(), 0);
        assert.equal(await page.locator('[data-role^="rack-station-"]').count(), 8);
    } finally {
        await page.close();
    }
});

test("every rack editor binds live controls and one drop commits one complete DSP order", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        const editorControlByEffect = {
            filter: "rack-parameter-globalFilterCutoff",
            drive: "distortion-drive-field",
            ott: "rack-parameter-ottAmount",
            chorus: "chorus-mix-control",
            flanger: "rack-parameter-flangerRate",
            phaser: "rack-parameter-phaserRateMode",
            delay: "rack-parameter-delayTimeMode",
            reverb: "rack-parameter-reverbSize",
        };

        for (const [effectId, controlRole] of Object.entries(editorControlByEffect)) {
            await selectRackEffect(page, effectId);
            await page.waitForSelector(
                `[data-role="rack-editor-${effectId}"] [data-role="${controlRole}"]`,
            );
        }

        await clearHarnessDebugLog(page);
        for (const effectId of Object.keys(editorControlByEffect)) {
            await toggleRackEffectEnabled(page, effectId);
        }

        let snapshot = await waitForHarnessSnapshot(
            page,
            "all rack enable commits",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneTopology"
                && Number(value?.chainLength) === 8
                && Number(value?.enabledMask) === 255
            )),
        );
        const storedRack = JSON.parse(String(snapshot.storedState["lane.v1"]));
        assert.deepEqual(storedRack.chain.map((node) => node.deviceId), [
            "globalFilter#1", "distortion#1", "ott#1", "chorus#1",
            "flanger#1", "phaser#1", "delay#1", "reverb#1",
        ]);
        assert.equal(storedRack.chain.every((node) => node.enabled), true);

        await clearHarnessDebugLog(page);
        const reorderHandle = page.locator('[data-role="rack-station-reverb"]');
        const reorderTarget = page.locator('[data-role="rack-module-filter"]');
        await reorderHandle.scrollIntoViewIfNeeded();
        const handleBox = await reorderHandle.boundingBox();
        const targetBox = await reorderTarget.boundingBox();
        assert.ok(handleBox && targetBox, "Rack pointer-reorder endpoints are missing");
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(210);
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "one rack reorder commit",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "laneTopology"
                && Array.isArray(value?.slotIds)
                && Number(value.slotIds[0]) === 7
            )),
        );
        const orderMessages = snapshot.sentMessages.filter(({ endpointID, value }) => (
            endpointID === "laneTopology" && Number(value?.slotIds?.[0]) === 7
        ));
        assert.equal(orderMessages.length, 1, "drag previews must not write DSP structure");
        assert.deepEqual(orderMessages[0].value.slotIds.slice(0, 8), [7, 0, 1, 2, 3, 4, 5, 6]);
    } finally {
        await page.close();
    }
});

test("Phaser and Delay keep the selected Free control visibly ineffective when Sync is active", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        for (const effect of [
            { id: "phaser", mode: "phaserRateMode", free: "phaserRate", sync: "phaserRateDivision" },
            { id: "delay", mode: "delayTimeMode", free: "delayTime", sync: "delayDivision" },
        ]) {
            await selectRackEffect(page, effect.id);
            const editor = page.locator(`[data-role="rack-editor-${effect.id}"]`);
            assert.equal(await editor.locator(`[data-role="rack-parameter-${effect.free}"]`).count(), 1);
            assert.equal(await editor.locator(`[data-role="rack-parameter-${effect.sync}"]`).count(), 0);

            await page.evaluate(({ endpointID }) => {
                window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue(endpointID, 1);
            }, { endpointID: effect.mode });
            await page.waitForFunction(({ effectId, freeEndpointID, syncEndpointID }) => {
                const editorElement = document.querySelector(`[data-role="rack-editor-${effectId}"]`);
                return editorElement?.querySelector(`[data-role="rack-parameter-${freeEndpointID}"]`) !== null
                    && editorElement?.querySelector(`[data-role="rack-parameter-${syncEndpointID}"]`) !== null;
            }, {
                effectId: effect.id,
                freeEndpointID: effect.free,
                syncEndpointID: effect.sync,
            });
            assert.equal(
                ["target-suspended", "effect-bypassed"].includes(
                    await editor.locator(`[data-role="rack-parameter-${effect.free}"]`).getAttribute("data-route-effectiveness"),
                ),
                true,
            );
        }
    } finally {
        await page.close();
    }
});

test("desktop chorus mode buttons and Ring Frequency Key Track status stay contained", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusMotionMode", 2);
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusBloomMode", 2);
        });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim() === "MotionClassic"
            && document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim() === "BloomLarge"
            && document.querySelector('[data-role="rack-parameter-chorusRingFrequencyHz"]') !== null
        ));
        assert.equal(await page.locator('[data-role="key-track-chorusRingFrequencyHz"]').count(), 0);
        await page.locator('[data-role="rack-parameter-chorusRingFrequencyHz"]')
            .click({ button: "right" });
        const keyTrackAction = page.locator(
            '[data-role="rack-parameter-menu-item"][data-action="toggle-key-track"]',
        );
        assert.equal((await keyTrackAction.innerText()).trim(), "Enable Key Track");
        await keyTrackAction.click();
        await page.locator('[data-role="key-track-status-chorusRingFrequencyHz"]').waitFor();

        const layout = await page.evaluate(() => {
            const roles = [
                "chorus-motion-mode-control",
                "chorus-bloom-mode-control",
            ];
            const buttons = roles.map((role) => document.querySelector(`[data-role="${role}"]`));
            const ringSurface = document.querySelector(
                '[data-role="rack-parameter-surface-chorusRingFrequencyHz"]',
            );
            const keyTrackStatus = document.querySelector(
                '[data-role="key-track-status-chorusRingFrequencyHz"]',
            );

            if (!buttons.every((button) => button instanceof HTMLElement)
                || !(ringSurface instanceof HTMLElement)
                || !(keyTrackStatus instanceof HTMLElement)) {
                return null;
            }

            const rects = buttons.map((button) => {
                const rect = button.getBoundingClientRect();
                const style = window.getComputedStyle(button);
                return {
                    role: button.getAttribute("data-role"),
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    scrollWidth: button.scrollWidth,
                    clientWidth: button.clientWidth,
                    overflowX: style.overflowX,
                    text: button.textContent?.trim(),
                };
            });

            return {
                rects,
                noBoxOverlap: rects.every((rect, index) => rects.every((otherRect, otherIndex) => (
                    index === otherIndex
                    || rect.right <= otherRect.left
                    || otherRect.right <= rect.left
                    || rect.bottom <= otherRect.top
                    || otherRect.bottom <= rect.top
                ))),
                clipsInternalOverflow: rects.every((rect) => rect.overflowX === "hidden"),
                contentFits: rects.every((rect) => rect.scrollWidth <= rect.clientWidth + 1),
                keyTrackPointerEvents: getComputedStyle(keyTrackStatus).pointerEvents,
                keyTrackContained: (() => {
                    const surfaceRect = ringSurface.getBoundingClientRect();
                    const statusRect = keyTrackStatus.getBoundingClientRect();
                    return statusRect.left >= surfaceRect.left
                        && statusRect.right <= surfaceRect.right
                        && statusRect.top >= surfaceRect.top
                        && statusRect.bottom <= surfaceRect.bottom;
                })(),
            };
        });

        assert.ok(layout, "Expected Chorus mode and Ring Frequency controls to render.");
        assert.equal(layout.noBoxOverlap, true, `Mode button boxes overlap: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.clipsInternalOverflow, true, `Mode button labels can paint outside their boxes: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.contentFits, true, `Longest chorus mode labels do not fit their buttons: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.keyTrackPointerEvents, "none");
        assert.equal(layout.keyTrackContained, true, "Ring Frequency Key Track status must stay inside its control.");
    } finally {
        await page.close();
    }
});

test("desktop chorus controls send exact parameter updates", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusMotionMode", 0);
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusBloomMode", 0);
        });
        await clearHarnessDebugLog(page);

        await page.click('[data-role="rack-editor-power"]');
        await editRackParameterValue(page, "chorus-mix-control", "66");
        await page.click('[data-role="chorus-motion-mode-control"]');
        await page.click('[data-role="chorus-bloom-mode-control"]');
        await editRackParameterValue(page, "chorus-tone-control", "80");
        await editRackParameterValue(page, "chorus-feedback-control", "70");
        await editRackParameterValue(page, "chorus-ring-amount-control", "50");
        await editRackParameterValue(page, "rack-parameter-chorusRingFrequencyHz", "440.5 Hz");
        await page.locator('[data-role="rack-parameter-chorusRingFrequencyHz"]')
            .click({ button: "right" });
        await page.click('[data-role="rack-parameter-menu-item"][data-action="toggle-key-track"]');
        await editRackParameterValue(page, "rack-parameter-chorusRingFrequencyHz", "-0.75 st");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus parameter updates",
            (nextSnapshot) => {
                const rawLaneState = nextSnapshot.storedState?.["lane.v1"];
                const chorusParams = typeof rawLaneState === "string"
                    ? JSON.parse(rawLaneState).devices?.["chorus#1"]?.params
                    : null;
                return nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "laneTopology"
                    && Array.isArray(value?.slotIds)
                    && ((Number(value.enabledMask) >> value.slotIds.indexOf(3)) & 1) === 1
                ))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusMix", 0.66))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusMotionMode", 1))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusBloomMode", 1))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusTone", 0.8))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusFeedback", 0.7))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusRingAmount", 0.5))
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusRingFrequencyHz", 440.5))
                && Number(chorusParams?.chorusRingKeyTrackEnabled) === 1
                && Number(chorusParams?.chorusRingKeyTrackOffsetSemitones) === -0.75;
            },
        );

        assert.equal(snapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusMix")), true);
    } finally {
        await page.close();
    }
});

test("desktop chorus controls render host values before edits", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const snapshot = harness.getSnapshot();
            const laneState = JSON.parse(String(snapshot.storedState["lane.v1"]));
            laneState.devices["chorus#1"].params = {
                ...laneState.devices["chorus#1"].params,
                chorusMix: 0.375,
                chorusMotionMode: 3,
                chorusBloomMode: 4,
                chorusTone: 0.825,
                chorusFeedback: 0.615,
                chorusRingAmount: 0.285,
                chorusRingFrequencyHz: 441.25,
                chorusRingKeyTrackEnabled: 1,
                chorusRingKeyTrackOffsetSemitones: 1.25,
            };
            harness.setStoredStateValue("lane.v1", JSON.stringify(laneState));
        });

        await page.waitForFunction(() => {
            const readInputValue = (role) => document.querySelector(`[data-role="${role}"]`)?.value ?? "";
            const readText = (role) => document.querySelector(`[data-role="${role}"]`)?.textContent ?? "";

            return readInputValue("chorus-mix-control") === "0.375"
                && readInputValue("chorus-tone-control") === "0.825"
                && readInputValue("chorus-feedback-control") === "0.615"
                && readInputValue("chorus-ring-amount-control") === "0.285"
                && readInputValue("rack-parameter-chorusRingFrequencyHz") === "1.25"
                && document.querySelector('[data-role="key-track-status-chorusRingFrequencyHz"]') !== null
                && readText("chorus-motion-mode-control").includes("Fast")
                && readText("chorus-bloom-mode-control").includes("Lg+Sh");
        });

        const rendered = await page.evaluate(() => ({
            mix: document.querySelector('[data-role="chorus-mix-control"]')?.value,
            tone: document.querySelector('[data-role="chorus-tone-control"]')?.value,
            feedback: document.querySelector('[data-role="chorus-feedback-control"]')?.value,
            ring: document.querySelector('[data-role="chorus-ring-amount-control"]')?.value,
            ringOffset: document.querySelector('[data-role="rack-parameter-chorusRingFrequencyHz"]')?.value,
            keyTrackStatus: document.querySelector('[data-role="key-track-status-chorusRingFrequencyHz"]') !== null,
            motionText: document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim(),
            bloomText: document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim(),
        }));

        assert.deepEqual(rendered, {
            mix: "0.375",
            tone: "0.825",
            feedback: "0.615",
            ring: "0.285",
            ringOffset: "1.25",
            keyTrackStatus: true,
            motionText: "MotionFast",
            bloomText: "BloomLg+Sh",
        });
    } finally {
        await page.close();
    }
});

test("desktop chorus knob closes host gesture on pointer cancellation", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 7, buttons: 1, deltaX: 0 },
            { type: "pointermove", pointerId: 7, buttons: 1, deltaX: 12 },
            { type: "pointercancel", pointerId: 7, buttons: 0, deltaX: 12 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cancelled gesture",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus knob survives pointer-capture loss and closes its host gesture on release", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        // The shared contract continues through capture loss on its window
        // listeners; release still closes the host gesture exactly once.
        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 8, buttons: 1, deltaX: 0 },
            { type: "pointermove", pointerId: 8, buttons: 1, deltaX: 12 },
            { type: "lostpointercapture", pointerId: 8, buttons: 1, deltaX: 12 },
            { type: "pointermove", pointerId: 8, buttons: 1, deltaX: 30 },
            { type: "pointerup", pointerId: 8, buttons: 0, deltaX: 30 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus capture-loss survival",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
                && nextSnapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusMix"))
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
        assert.equal(
            snapshot.sentMessages.some((message) => isLaneParamSend(message, "chorusMix")),
            true,
            "The move after capture loss must still edit the base value.",
        );
    } finally {
        await page.close();
    }
});

test("desktop chorus knob closes host gesture when pointer movement reports no pressed buttons", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-track"]');
        await clearHarnessDebugLog(page);

        await dispatchRackKnobPointerEvents(page.locator('[data-role="chorus-mix-control"]'), [
            { type: "pointerdown", pointerId: 9, buttons: 1, deltaX: 0 },
            { type: "pointermove", pointerId: 9, buttons: 1, deltaX: 12 },
            { type: "pointermove", pointerId: 9, buttons: 0, deltaX: 12 },
        ]);

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus zero-button pointer cleanup",
            (nextSnapshot) => (
                nextSnapshot.gestureStarts.includes("chorusMix")
                && nextSnapshot.gestureEnds.includes("chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
    } finally {
        await page.close();
    }
});

test("desktop chorus knob ignores mouse movement after a completed drag release", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.waitForSelector('[data-role="chorus-mix-control"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusMix", 0.2);
        });
        await clearHarnessDebugLog(page);

        const knob = page.locator('[data-role="chorus-mix-control"]');
        const art = knob.locator(".rack-knob-art");
        const box = await art.boundingBox();

        if (!box) {
            throw new Error("Expected chorus mix control bounding box.");
        }

        const centerX = box.x + (box.width * 0.5);
        const centerY = box.y + (box.height * 0.5);
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 26, centerY, { steps: 8 });
        await page.mouse.up();

        const valueAfterRelease = await knob.getAttribute("value");
        await clearHarnessDebugLog(page);

        await page.mouse.move(centerX, centerY + 20, { steps: 10 });
        await page.mouse.move(centerX, centerY - 20, { steps: 10 });
        await page.waitForTimeout(100);

        const valueAfterHover = await knob.getAttribute("value");
        const snapshot = await getHarnessSnapshot(page);

        assert.equal(valueAfterHover, valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages.filter((message) => isLaneParamSend(message, "chorusMix")), []);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
    } finally {
        await page.close();
    }
});

test("desktop chorus Motion and Bloom buttons wrap through all modes", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusMotionMode", 0);
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("chorusBloomMode", 0);
        });
        await clearHarnessDebugLog(page);

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-motion-mode-control"]');
        }

        for (let i = 0; i < 6; i += 1) {
            await page.click('[data-role="chorus-bloom-mode-control"]');
        }

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cycle button updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.filter((message) => isLaneParamSend(message, "chorusMotionMode")).length >= 5
                && nextSnapshot.sentMessages.filter((message) => isLaneParamSend(message, "chorusBloomMode")).length >= 6
            ),
        );

        assert.deepEqual(
            snapshot.sentMessages
                .filter((message) => isLaneParamSend(message, "chorusMotionMode"))
                .map(({ value }) => Number(value.value)),
            [1, 2, 3, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter((message) => isLaneParamSend(message, "chorusBloomMode"))
                .map(({ value }) => Number(value.value)),
            [1, 2, 3, 4, 0, 1],
        );
    } finally {
        await page.close();
    }
});

test("desktop distortion wet low-pass knob renders the full 20 Hz floor", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        await page.waitForSelector('[data-role="rack-editor-drive"]');

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionWetLPHz", 20);
        });

        const knobState = await waitForPageValue(
            page,
            "desktop distortion wet low-pass knob state",
            () => {
                const knob = document.querySelector('[data-role="distortion-wet-lp-field"]');

                if (!(knob instanceof HTMLButtonElement)) {
                    return null;
                }

                return {
                    min: knob.getAttribute("aria-valuemin"),
                    max: knob.getAttribute("aria-valuemax"),
                    value: knob.value,
                };
            },
            (nextState) => Boolean(
                nextState
                && nextState.min === "20"
                && nextState.max === "20000"
                && Math.abs(Number(nextState.value) - 20) <= 0.001
            ),
        );

        assert.equal(knobState.min, "20");
        assert.equal(knobState.max, "20000");
        assert.equal(Math.abs(Number(knobState.value) - 20) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("T25A: the composed Drive graph keeps its transfer curve aligned with contrasting live clipping", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
        const driveEditor = page.locator('[data-role="rack-editor-drive"]');
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionDriveDb", 12);
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionKnee", 0.65);
            window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionType", 0);
        });
        const scopeFixture = buildDistortionScopeFixture();
        const historyFixture = buildDistortionHistoryFixture();

        await page.evaluate(({ nextScopeFixture, nextHistoryFixture }) => {
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionScope(nextScopeFixture);
            window.__COSIMO_DESKTOP_HARNESS__.emitDistortionHistory(nextHistoryFixture);
        }, {
            nextScopeFixture: scopeFixture,
            nextHistoryFixture: historyFixture,
        });

        const renderedState = await waitForPageValue(
            page,
            "desktop distortion graph state",
            () => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().distortionGraphState,
            (graphState) => Boolean(
                graphState
                && graphState.transfer?.occupancySegmentCount > 0
                && graphState.history?.validBinCount > 0
            ),
        );
        if (await driveEditor.getAttribute("data-effect-enabled") !== "true") {
            const driveEditorHandle = await driveEditor.elementHandle();
            assert.ok(driveEditorHandle);
            await page.locator('[data-role="rack-editor-power"]').click();
            await page.waitForFunction(
                (element) => element.getAttribute("data-effect-enabled") === "true",
                driveEditorHandle,
            );
        }
        const overlayState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const graph = viewRoot?.querySelector('[data-role="distortion-visualizer"]');
            const transferCurve = viewRoot?.querySelector('[data-role="distortion-transfer-curve"]');
            const unclippedPaths = Array.from(
                viewRoot?.querySelectorAll('[data-role="distortion-transfer-occupancy"][data-clipping="unclipped"]') ?? [],
            );
            const clippedPaths = Array.from(
                viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-occupancy"][data-clipping="clipped"]') ?? [],
            );
            const readFill = (element) => element instanceof SVGElement
                ? getComputedStyle(element).fill
                : "";
            const readOpacity = (element) => element instanceof SVGElement
                ? Number.parseFloat(getComputedStyle(element).opacity)
                : 0;
            const parseRgb = (color) => {
                const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
                return channels.length === 3 ? channels : null;
            };
            const unclippedFill = readFill(unclippedPaths[0]);
            const clippedFill = readFill(clippedPaths[0]);
            const unclippedRgb = parseRgb(unclippedFill);
            const clippedRgb = parseRgb(clippedFill);
            const historyUnclipped = viewRoot?.querySelector(
                '[data-role="distortion-history-output-column"][data-clipping="unclipped"]',
            );
            const historyClipped = viewRoot?.querySelector(
                '[data-role="distortion-history-removed-column"][data-clipping="clipped"]',
            );
            const historyUnclippedFill = readFill(historyUnclipped);
            const historyClippedFill = readFill(historyClipped);
            const historyUnclippedRgb = parseRgb(historyUnclippedFill);
            const historyClippedRgb = parseRgb(historyClippedFill);
            const curveBounds = transferCurve instanceof SVGGraphicsElement
                ? transferCurve.getBBox()
                : null;
            const graphCenterY = graph instanceof SVGSVGElement
                ? graph.viewBox.baseVal.height * 0.5
                : 0;
            const upperClipBoundaries = Array.from(viewRoot?.querySelectorAll(
                '[data-role="distortion-history-removed-column"][data-clipping="clipped"]',
            ) ?? []).flatMap((element) => {
                if (!(element instanceof SVGGraphicsElement)) return [];
                const box = element.getBBox();
                const boundary = box.y + box.height;
                return boundary < graphCenterY ? [boundary] : [];
            });

            return {
                effectEnabled: viewRoot?.querySelector('[data-role="rack-editor-drive"]')
                    ?.getAttribute("data-effect-enabled") ?? "",
                curveCount: transferCurve ? 1 : 0,
                viewBox: graph?.getAttribute("viewBox") ?? "",
                curveLeft: curveBounds?.x ?? Number.NaN,
                curveRight: curveBounds ? curveBounds.x + curveBounds.width : Number.NaN,
                curveWidthFraction: (
                    graph instanceof SVGSVGElement
                    && transferCurve instanceof SVGGraphicsElement
                    && graph.viewBox.baseVal.width > 0
                ) ? transferCurve.getBBox().width / graph.viewBox.baseVal.width : 0,
                unclippedCount: unclippedPaths.length,
                clippedCount: clippedPaths.length,
                unclippedFill,
                clippedFill,
                unclippedOpacity: readOpacity(unclippedPaths[0]),
                clippedOpacity: readOpacity(clippedPaths[0]),
                colorDistance: unclippedRgb && clippedRgb
                    ? Math.hypot(
                        unclippedRgb[0] - clippedRgb[0],
                        unclippedRgb[1] - clippedRgb[1],
                        unclippedRgb[2] - clippedRgb[2],
                    )
                    : 0,
                historyUnclippedFill,
                historyClippedFill,
                historyUnclippedOpacity: readOpacity(historyUnclipped),
                historyClippedOpacity: readOpacity(historyClipped),
                historyColorDistance: historyUnclippedRgb && historyClippedRgb
                    ? Math.hypot(
                        historyUnclippedRgb[0] - historyClippedRgb[0],
                        historyUnclippedRgb[1] - historyClippedRgb[1],
                        historyUnclippedRgb[2] - historyClippedRgb[2],
                    )
                    : 0,
                clipBoundaryDelta: curveBounds && upperClipBoundaries.length > 0
                    ? Math.abs(curveBounds.y - Math.min(...upperClipBoundaries))
                    : Number.POSITIVE_INFINITY,
                historyOutputColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-output-column"]').length ?? 0,
                historyRemovedColumnCount: viewRoot?.querySelectorAll('[data-role="distortion-history-removed-column"]').length ?? 0,
                legacyTraceCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-trace"]').length ?? 0,
                legacyClippedPointCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-point"]').length ?? 0,
            };
        });

        assert.equal(renderedState.displayRange, 2);
        assert.equal(renderedState.inputPeak > renderedState.outputPeak, true);
        assert.equal(renderedState.removedPeak > 0.1, true);
        assert.equal(renderedState.clippedSampleCount > 0, true);
        assert.equal(renderedState.transfer.occupancySegmentCount > 0, true);
        assert.equal(renderedState.transfer.clippedOccupancySegmentCount > 0, true);
        assert.equal(renderedState.history.binCount, historyFixture.binCount);
        assert.equal(renderedState.history.validBinCount, historyFixture.validBinCount);
        assert.equal(renderedState.history.clippedBinCount > 0, true);
        assert.equal(renderedState.history.removedPeak > 0.1, true);
        assert.equal(overlayState.effectEnabled, "true", "the composed Drive path must be enabled during proof");
        assert.equal(overlayState.curveCount, 1, "live telemetry must not hide the transfer function");
        assert.equal(overlayState.viewBox, "0 0 600 340", "the compact pre-T25 canvas geometry must stay restored");
        assert.equal(Math.abs(overlayState.curveLeft - 12) <= 0.5, true);
        assert.equal(Math.abs(overlayState.curveRight - 588) <= 0.5, true);
        assert.equal(overlayState.curveWidthFraction >= 0.9, true, "transfer function must span the restored plot");
        assert.equal(overlayState.unclippedCount > 0, true);
        assert.equal(overlayState.clippedCount > 0, true);
        assert.notEqual(overlayState.unclippedFill, overlayState.clippedFill);
        assert.match(overlayState.unclippedFill, /^rgb\(/);
        assert.match(overlayState.clippedFill, /^rgb\(/);
        assert.equal(overlayState.unclippedOpacity >= 0.58, true);
        assert.equal(overlayState.clippedOpacity >= 0.82, true);
        assert.equal(overlayState.colorDistance >= 100, true, "clipped and unclipped colors need strong contrast");
        assert.equal(overlayState.historyOutputColumnCount, historyFixture.binCount);
        assert.equal(overlayState.historyRemovedColumnCount > 0, true);
        assert.notEqual(overlayState.historyUnclippedFill, overlayState.historyClippedFill);
        assert.equal(overlayState.historyUnclippedOpacity >= 0.4, true);
        assert.equal(overlayState.historyClippedOpacity >= 0.8, true);
        assert.equal(
            overlayState.historyColorDistance >= 100,
            true,
            "the background waveform needs strong clipped/unclipped color contrast",
        );
        assert.equal(
            overlayState.clipBoundaryDelta <= 2,
            true,
            "the background waveform must clip at the transfer function's visible ceiling",
        );
        assert.equal(overlayState.legacyTraceCount, 0);
        assert.equal(overlayState.legacyClippedPointCount, 0);

        const signalCases = [
            { name: "quiet", amplitude: 0.55, requiresClipping: false },
            { name: "normal", amplitude: 1.62, requiresClipping: true },
        ];
        const typeResults = [];

        for (const type of [0, 1, 2]) {
            for (const signalCase of signalCases) {
                const nextScopeFixture = buildDistortionScopeFixture({ amplitude: signalCase.amplitude });

                await page.evaluate(({ nextType, nextScope }) => {
                    window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionType", nextType);
                    window.__COSIMO_DESKTOP_HARNESS__.emitDistortionScope(nextScope);
                }, {
                    nextType: type,
                    nextScope: nextScopeFixture,
                });
                await waitForPageValue(
                    page,
                    `Drive graph ${signalCase.name} Type ${type}`,
                    () => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().distortionGraphState,
                    (graphState) => Math.abs(
                        Number(graphState?.inputPeak) - nextScopeFixture.inputPeak,
                    ) <= 1e-6,
                );
                await waitForReactFrames(page, 2);

                const graphCase = await page.evaluate(() => {
                    const host = document.querySelector("cosimo-desktop-react-view");
                    const viewRoot = host?.shadowRoot ?? host;
                    const graph = viewRoot?.querySelector('[data-role="distortion-visualizer"]');
                    const curve = viewRoot?.querySelector('[data-role="distortion-transfer-curve"]');
                    const livePaths = Array.from(viewRoot?.querySelectorAll(
                        '[data-role="distortion-transfer-occupancy"], [data-role="distortion-transfer-clipped-occupancy"]',
                    ) ?? []).filter((element) => element instanceof SVGGraphicsElement);
                    const liveBounds = livePaths.reduce((bounds, element) => {
                        const box = element.getBBox();
                        return {
                            left: Math.min(bounds.left, box.x),
                            right: Math.max(bounds.right, box.x + box.width),
                        };
                    }, { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY });

                    return {
                        curvePath: curve?.getAttribute("d") ?? "",
                        liveWidthFraction: graph instanceof SVGSVGElement
                            && Number.isFinite(liveBounds.left)
                            && graph.viewBox.baseVal.width > 0
                            ? (liveBounds.right - liveBounds.left) / graph.viewBox.baseVal.width
                            : 0,
                        unclippedCount: viewRoot?.querySelectorAll(
                            '[data-role="distortion-transfer-occupancy"][data-clipping="unclipped"]',
                        ).length ?? 0,
                        clippedCount: viewRoot?.querySelectorAll(
                            '[data-role="distortion-transfer-clipped-occupancy"][data-clipping="clipped"]',
                        ).length ?? 0,
                    };
                });

                assert.notEqual(graphCase.curvePath, "", `${signalCase.name} Type ${type} lost its curve`);
                assert.equal(
                    graphCase.liveWidthFraction >= 0.1,
                    true,
                    `${signalCase.name} Type ${type} live signal became visually negligible`,
                );
                assert.equal(graphCase.unclippedCount > 0, true);
                if (signalCase.requiresClipping) {
                    assert.equal(graphCase.clippedCount > 0, true, `normal Type ${type} lost its clipped region`);
                }

                typeResults.push({
                    type,
                    signal: signalCase.name,
                    curvePath: graphCase.curvePath,
                });
            }
        }

        assert.equal(
            new Set(typeResults.filter((result) => result.signal === "normal").map((result) => result.curvePath)).size,
            3,
            "Symmetric, Asymmetric, and Wavefold must render their distinct production curves",
        );
    } finally {
        await page.close();
    }
});

test("T02C: the wavetable graphic shades only the armed source's live Index route on the focused oscillator", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    // The rail always keeps one source selected, so the unshaded reference
    // state is an armed UNROUTED source (env-1), never "nothing armed".
    const installShadingProbe = () => page.evaluate(() => {
        const readPixels = () => {
            const canvas = document.querySelector('[data-role="mobile-voice-graph"] canvas');
            if (!(canvas instanceof HTMLCanvasElement) || canvas.width === 0) {
                throw new Error("The Voice wavetable canvas is missing.");
            }
            return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        };
        window.__t02cShading = {
            baseline: null,
            capture() {
                this.baseline = readPixels();
            },
            /** Pixels whose colour moved versus the captured baseline; -1 while unusable. */
            diff() {
                const current = readPixels();
                if (!this.baseline || this.baseline.length !== current.length) {
                    return -1;
                }
                let differing = 0;
                for (let index = 0; index < current.length; index += 4) {
                    if (
                        Math.abs(current[index] - this.baseline[index]) > 4
                        || Math.abs(current[index + 1] - this.baseline[index + 1]) > 4
                        || Math.abs(current[index + 2] - this.baseline[index + 2]) > 4
                    ) {
                        differing += 1;
                    }
                }
                return differing;
            },
        };
    });
    const captureBaseline = () => page.evaluate(() => window.__t02cShading.capture());
    const shadingDiff = () => page.evaluate(() => window.__t02cShading.diff());
    const waitForShading = (predicate) => page.waitForFunction(
        (source) => new Function("diff", `return ${source};`)(window.__t02cShading.diff()),
        predicate,
    );
    const waitForFocusedOscillatorArtwork = (oscillatorID) => page.waitForFunction((expectedID) => {
        const editor = document.querySelector('[data-role="mobile-voice-editor"]');
        if (editor?.getAttribute("data-selected-oscillator-id") !== expectedID) {
            return false;
        }
        const canvas = document.querySelector('[data-role="mobile-voice-graph"] canvas');
        if (!(canvas instanceof HTMLCanvasElement) || canvas.width === 0) {
            return false;
        }
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 3; index < data.length; index += 4) {
            if (data[index] !== 0) {
                return true;
            }
        }
        return false;
    }, oscillatorID);
    const seedRoute = async ({ amount, enabled }) => {
        const state = normalizeModulationState({
            routes: [{
                id: "t02c-live-route",
                enabled,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "oscA.wavetablePosition",
                amount,
                reducer: "max",
            }],
        });
        await page.evaluate((nextState) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(nextState));
        }, state);
        await waitForHarnessSnapshot(
            page,
            "seeded the T02C Index shading route",
            (snapshot) => {
                const route = readStoredModulationState(snapshot).routes[0];
                return route?.amount === amount && route?.enabled === enabled;
            },
        );
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await seedRoute({ amount: 0.4, enabled: true });
        await waitForFocusedOscillatorArtwork("A");
        await installShadingProbe();

        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 4);
        await captureBaseline();

        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        await waitForShading("diff > 500");
        const mappedDiff = await shadingDiff();

        // The graphic follows the route live: a larger amount widens the
        // section; 0% and bypass clear it without changing the armed source.
        await seedRoute({ amount: 0.8, enabled: true });
        await waitForShading(`diff > ${mappedDiff}`);
        await seedRoute({ amount: 0.4, enabled: true });
        await waitForShading(`diff > 500 && diff <= ${mappedDiff}`);
        await seedRoute({ amount: 0, enabled: true });
        await waitForShading("diff === 0");
        await seedRoute({ amount: 0.4, enabled: false });
        await waitForReactFrames(page, 4);
        assert.equal(await shadingDiff(), 0, "A bypassed route must draw no range.");
        await seedRoute({ amount: 0.4, enabled: true });
        await waitForShading("diff > 500");

        // An armed source with no Index route draws nothing.
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-env-1"]');
        await waitForShading("diff === 0");
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        await waitForShading("diff > 500");

        // The range belongs to the FOCUSED oscillator: B has no Index route.
        await collapseGlobalModRail(page);
        await page.click('[data-role="mobile-voice-tab-b"]');
        await waitForFocusedOscillatorArtwork("B");
        await captureBaseline();
        await waitForReactFrames(page, 4);
        assert.equal(
            await shadingDiff(),
            0,
            "A source routed only to oscillator A must not shade oscillator B.",
        );

        // Returning to A re-shades from the same armed route.
        await page.click('[data-role="mobile-voice-tab-a"]');
        await waitForFocusedOscillatorArtwork("A");
        await expandGlobalModRail(page);
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 4);
        await captureBaseline();
        await armModSourceForRoutingTest(page, '[data-role="rack-mod-source-mseg-1"]');
        await waitForShading("diff > 500");
    } finally {
        await page.close();
    }
});

test("the instrument is never text-selectable; only real text entry opts back in", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        // Representative labels across the bar, Voice, and FX surfaces.
        const surfaces = [
            '[data-role="rack-mod-source-mseg-1"]',
            '[data-role="mobile-global-mod-rail-route-count"]',
            '[data-role="mobile-global-mod-rail-auto-toggle"]',
            '[data-role="mobile-voice-editor"]',
        ];
        for (const selector of surfaces) {
            assert.equal(
                await page.locator(selector).first().evaluate((element) => getComputedStyle(element).userSelect),
                "none",
                `${selector} must not be text-selectable.`,
            );
        }

        // Behavioral proof on the bar: a real double-tap lands on the grip
        // (it owns the collapsed rail's pointer surface) and selects nothing.
        await collapseGlobalModRail(page);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').dblclick();
        assert.equal(
            await page.evaluate(() => window.getSelection()?.toString() ?? ""),
            "",
            "Double-tapping the collapsed bar must select no text.",
        );

        // T43 gives the double-tap a deterministic open-then-close outcome;
        // no sheet may remain to cover subsequent navigation.
        assert.equal(await page.locator('[data-role="quick-source-sheet"]').count(), 0);

        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const rackList = page.locator('[data-role="rack-module-list"]');
        await rackList.waitFor();
        assert.equal(
            await rackList.evaluate((element) => getComputedStyle(element).userSelect),
            "none",
            "The FX rack must not be text-selectable.",
        );

        // Real text entry stays selectable: exact-value fields keep their caret.
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const anyInput = page.locator('[data-role="mobile-workspace-panel-mod"] input[type="text"]').first();
        await anyInput.waitFor();
        assert.equal(
            await anyInput.evaluate((element) => getComputedStyle(element).userSelect),
            "text",
            "Text-entry fields must keep normal selection.",
        );
    } finally {
        await page.close();
    }
});

test("T13: the quick sheet opens from the bar over Voice/FX, resizes, dismisses, and hands off to the full editor", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const sheet = page.locator('[data-role="quick-source-sheet"]');
    const dragGripBy = async (deltaY) => {
        const grip = page.locator('[data-role="quick-source-sheet-grip"]');
        const box = await grip.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y + (deltaY / 2), { steps: 4 });
        await page.mouse.move(start.x, start.y + deltaY, { steps: 4 });
        await page.mouse.up();
    };

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);

        // Collapsed bar: tapping the active-source icon opens the quick sheet
        // and the drawer does NOT expand (the grip owns expansion).
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await sheet.waitFor();
        assert.equal(await sheet.getAttribute("data-source-kind"), "mseg");
        assert.equal(await sheet.getAttribute("data-detent"), "compact");
        assert.equal(await rail.getAttribute("data-expanded"), "false", "The grip alone owns expansion.");

        // The strip is the shared cell language: a horizontal drag on the Rate
        // cell edits the MSEG rate document value with the shared HUD.
        const rateCell = page.locator('[data-role="quick-source-sheet-cell-rate"]');
        await rateCell.waitFor();
        const rateBefore = Number(await rateCell.getAttribute("aria-valuenow"));
        const cellBox = await rateCell.boundingBox();
        assert.ok(cellBox);
        await page.mouse.move(cellBox.x + (cellBox.width / 2), cellBox.y + (cellBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(cellBox.x + (cellBox.width / 2) + 12, cellBox.y + (cellBox.height / 2), { steps: 2 });
        await page.mouse.move(cellBox.x + (cellBox.width / 2) + 60, cellBox.y + (cellBox.height / 2), { steps: 4 });
        assert.equal(
            await page.locator('[data-role="mobile-voice-hud"]').getAttribute("data-hud-axis"),
            "base",
            "The strip's horizontal axis edits the base value under the shared HUD.",
        );
        await page.mouse.up();
        // The rate is an engine parameter: the edit must reach the runtime.
        await waitForHarnessSnapshot(
            page,
            "quick-sheet rate edit",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "mseg1Rate" && Number(value) > rateBefore
            )),
        );

        // Upward grab-rail drag snaps to the half detent.
        await dragGripBy(-170);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-source-sheet"]')?.getAttribute("data-detent") === "half"
        ));

        // Dragging all the way up transitions into the REAL full-screen MSEG
        // editor and the sheet is gone.
        await dragGripBy(-400);
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        assert.equal(await sheet.count(), 0, "The full editor replaces the sheet — never a near-full duplicate.");
        await page.click('[data-action="shell-back"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });

        // Reopen; the explicit Full editor button is the discoverable route.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await sheet.waitFor();
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        await page.click('[data-action="shell-back"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });

        // Reopen; a downward drag past the threshold dismisses, revealing the
        // unchanged Voice context.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await sheet.waitFor();
        await dragGripBy(200);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-source-sheet"]') === null
        ));
        assert.equal(await page.locator('[data-role="mobile-voice-editor"]').count(), 1);

    } finally {
        await page.close();
    }
});

test("T43: source taps toggle and switch the Voice/FX quick sheet without stealing drags or Mod behavior", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);
    const sheet = page.locator('[data-role="quick-source-sheet"]');
    const tapChip = async (selector) => {
        await page.locator(selector).first().evaluate((element) => {
            const fire = (type, buttons) => element.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                pointerId: 91,
                pointerType: "touch",
                isPrimary: true,
                button: 0,
                buttons,
                clientX: element.getBoundingClientRect().left + 10,
                clientY: element.getBoundingClientRect().top + 10,
            }));
            fire("pointerdown", 1);
            fire("pointerup", 0);
        });
    };
    const dragChipToTarget = async (sourceSelector, targetSelector) => {
        const sourceBox = await page.locator(sourceSelector).first().boundingBox();
        const targetBox = await page.locator(targetSelector).first().boundingBox();
        assert.ok(sourceBox && targetBox);
        const sourceStart = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...sourceStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: sourceStart.x - 18, y: sourceStart.y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const targetFinger = touchPointForModSourcePreviewTarget(
            sourceStart,
            { x: targetBox.x + (targetBox.width / 2), y: targetBox.y + (targetBox.height / 2) },
            393,
        );
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...targetFinger, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const waitForSheetSource = async (sourceKind, sourceSlot = 1) => {
        await page.waitForFunction(({ kind, slot }) => {
            const element = document.querySelector('[data-role="quick-source-sheet"]');
            return element?.getAttribute("data-source-kind") === kind
                && element.getAttribute("data-source-slot") === String(slot);
        }, { kind: sourceKind, slot: sourceSlot });
    };
    const waitForSheetClosed = async () => page.waitForFunction(() => (
        document.querySelector('[data-role="quick-source-sheet"]') === null
    ));

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);

        // Voice, right dock: a single inactive-source tap opens; the same
        // active source on the collapsed rail closes and reopens it.
        await expandGlobalModRail(page);
        await tapChip('[data-role="rack-mod-source-env-1"]');
        await waitForSheetSource("env");
        assert.equal(await sheet.getAttribute("data-source-kind"), "env");
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-attack"]').count(), 1);
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-release"]').count(), 1);
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-edge"), "right");
        await tapChip('[data-role="mobile-global-mod-rail-selected"]');
        await waitForSheetClosed();
        await tapChip('[data-role="mobile-global-mod-rail-selected"]');
        await waitForSheetSource("env");

        // Switching A -> B keeps the SAME mounted sheet and replaces both its
        // identity and parameter cells in one render — no close/reopen flash
        // and no stale Envelope contents under an MSEG heading.
        await expandGlobalModRail(page);
        await sheet.evaluate((element) => { window.__T43_QUICK_SHEET__ = element; });
        await tapChip('[data-role="rack-mod-source-mseg-1"]');
        await waitForSheetSource("mseg");
        assert.equal(await sheet.count(), 1, "A-to-B switching must leave exactly one quick sheet.");
        assert.equal(
            await sheet.evaluate((element) => window.__T43_QUICK_SHEET__ === element),
            true,
            "A-to-B switching must update the mounted sheet directly.",
        );
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-rate"]').count(), 1);
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-attack"]').count(), 0);

        // A real Envelope-to-filter drop creates routes without changing or
        // remounting the already-open MSEG sheet.
        await expandGlobalModRail(page);
        const routesBeforeDrag = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        const existingRouteIds = new Set(routesBeforeDrag.map((route) => route.id));
        await dragChipToTarget(
            '[data-role="rack-mod-source-env-1"]',
            '[data-role="filter-graph-drop-surface"]',
        );
        const dragSnapshot = await waitForHarnessSnapshot(
            page,
            "T43 Envelope drag",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.length === routesBeforeDrag.length + 2,
        );
        const createdRoutes = readStoredModulationState(dragSnapshot).routes.filter((route) => !existingRouteIds.has(route.id));
        assert.deepEqual(
            createdRoutes.map((route) => [route.sourceKind, route.sourceSlot, route.targetKind]),
            [
                ["env", 1, "filterCutoffOctaves"],
                ["env", 1, "filterQ"],
            ],
            "The moved gesture must remain an Envelope drag and complete the filter mapping.",
        );
        assert.equal(await sheet.getAttribute("data-source-kind"), "mseg");
        assert.equal(
            await sheet.evaluate((element) => window.__T43_QUICK_SHEET__ === element),
            true,
        );
        await tapChip('[data-role="rack-mod-source-mseg-1"]');
        await waitForSheetClosed();

        // Move the shared rail to the left edge, then prove the same one-tap
        // open/close contract over FX rather than Voice.
        await collapseGlobalModRail(page);
        const handle = page.locator('[data-role="mobile-global-mod-rail"] .mobile-global-mod-rail-handle');
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox);
        const dockStart = {
            x: handleBox.x + (handleBox.width / 2),
            y: handleBox.y + (handleBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...dockStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const x of [dockStart.x - 80, dockStart.x - 200, 60]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: dockStart.y + 12, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-role="mobile-global-mod-rail"]');
            return element?.getAttribute("data-edge") === "left"
                && element.getAttribute("data-settling-x") === "false"
                && element.getAttribute("data-decelerating") === "false";
        });

        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        await tapChip('[data-role="rack-mod-source-env-1"]');
        await waitForSheetSource("env");
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-edge"), "left");
        assert.equal(await page.locator('[data-role="mobile-workspace-tab-fx"]').getAttribute("aria-selected"), "true");
        await tapChip('[data-role="mobile-global-mod-rail-selected"]');
        await waitForSheetClosed();

        // Mod keeps its existing two-step source-panel behavior: an inactive
        // source tap selects it without collapsing the drawer or creating a
        // quick sheet; a second active tap opens the deep-linked editor.
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await expandGlobalModRail(page);
        await tapChip('[data-role="rack-mod-source-mseg-1"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "mseg"
                && document.querySelector('[data-role="rack-mod-source-mseg-1"]')?.getAttribute("aria-pressed") === "true"
        ));
        assert.equal(await page.locator('[data-role="mobile-global-mod-rail"]').getAttribute("data-expanded"), "true");
        assert.equal(await page.locator('[data-action="shell-back"]').isDisabled(), true);
        assert.equal(await sheet.count(), 0, "The quick sheet belongs to Voice/FX only.");
        await tapChip('[data-role="rack-mod-source-mseg-1"]');
        await page.waitForFunction(() => (
            document.querySelector("cosimo-preset-bar")
                ?.shadowRoot
                ?.querySelector('[data-action="shell-back"]')
                ?.hasAttribute("disabled") === false
        ));
        assert.equal(await sheet.count(), 0, "The Mod source panel must never be replaced by a quick sheet.");
    } finally {
        await cdp.detach();
        await page.close();
    }
});
test("T20: long-press opens the ADR-017 parameter menu on Voice cells and quick-sheet cells", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const menu = page.locator('[data-role="rack-parameter-menu"]');
    const longPress = async (locator) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
        await page.mouse.down();
        await menu.waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        const cell = page.locator('[data-role="mobile-voice-cell-framePosition"]');
        await cell.waitFor();

        // Movement past slop must NEVER open the menu (it is a drag).
        {
            const box = await cell.boundingBox();
            await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
            await page.mouse.down();
            await page.mouse.move(box.x + (box.width / 2) + 18, box.y + (box.height / 2), { steps: 3 });
            await page.waitForTimeout(700);
            assert.equal(await menu.count(), 0, "Movement must cancel the long press.");
            await page.mouse.up();
        }

        // A stationary long press opens the menu for the pressed cell.
        await longPress(cell);
        assert.equal(await menu.getAttribute("data-endpoint-id"), "framePosition");

        // Edit values…: typed unit-aware entry commits through the binding
        // (the cell readout renders the committed value).
        await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
        const baseInput = page.locator('[data-role="rack-base-value-input"]');
        await baseInput.waitFor();
        await baseInput.fill("62%");
        await page.click('[data-role="rack-value-sheet-apply"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-cell-framePosition"]')?.textContent?.includes("62%")
        ));

        // Reset base to default restores the canonical initial value.
        await longPress(cell);
        await page.click('[data-role="rack-parameter-menu-item"][data-action="reset-base"]');
        await page.waitForFunction(() => {
            const text = document.querySelector('[data-role="mobile-voice-cell-framePosition"]')?.textContent ?? "";
            return !text.includes("62%");
        });

        // Quick-sheet cells share the same menu. The MSEG Rate cell is a
        // stored-document value with no canonical default: reset is hidden,
        // and typed entry reaches the runtime.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        const rateCell = page.locator('[data-role="quick-source-sheet-cell-rate"]');
        await rateCell.waitFor();
        await longPress(rateCell);
        assert.equal(
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').count(),
            0,
            "A document-owned cell with no canonical default must not offer reset.",
        );
        await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
        await baseInput.waitFor();
        await baseInput.fill("500 ms");
        await page.click('[data-role="rack-value-sheet-apply"]');
        await waitForHarnessSnapshot(
            page,
            "quick-sheet menu rate entry",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "mseg1Rate" && Math.abs(Number(value) - 0.5) < 0.001
            )),
        );
        await page.locator('[data-role="quick-source-sheet-close"]').click();

        // Voice FILTER knobs long-press into the same menu (the shipped code
        // swallowed this callback with a no-op). The filter boots Off with
        // pointer-events disabled, so power it on via its Mode chip first.
        await page.locator('[data-role="filter-mode-chip"]').click();
        const filterKnob = page.locator('[data-role="voice-filter-knob-filterCutoff"]');
        await filterKnob.scrollIntoViewIfNeeded();
        await longPress(filterKnob);
        assert.equal(await menu.getAttribute("data-endpoint-id"), "filterCutoff");
        await page.locator('[data-role="rack-parameter-menu-layer"]').click({ position: { x: 4, y: 4 } });
        await menu.waitFor({ state: "detached" });

        // The MSEG editor's compact Time knob long-presses into the menu too.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await page.locator('[data-role="quick-source-sheet"]').waitFor();
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        // The floating Mod rail deliberately stays live ABOVE the editor
        // (T11) and its persisted dock can cover parts of the controls row:
        // press a point of the Time knob the rail does not intercept.
        const timePress = await page.evaluate(() => {
            const knob = document.querySelector('[data-role="mseg-editor-cell-rate"]');
            if (!knob) {
                throw new Error("Time knob missing.");
            }
            const rect = knob.getBoundingClientRect();
            for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
                for (const fy of [0.5, 0.3, 0.75]) {
                    const x = rect.left + (rect.width * fx);
                    const y = rect.top + (rect.height * fy);
                    const hit = document.elementFromPoint(x, y);
                    if (hit && knob.contains(hit)) {
                        return { x, y };
                    }
                }
            }
            throw new Error("The Time knob is fully covered by the rail.");
        });
        await page.mouse.move(timePress.x, timePress.y);
        await page.mouse.down();
        await menu.waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
        assert.equal(await menu.getAttribute("data-endpoint-id"), "mseg1Rate");
    } finally {
        await page.close();
    }
});

test("T20: desktop knobs and number fields long-press into the parameter menu", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 900 }),
    });
    const menu = page.locator('[data-role="rack-parameter-menu"]');
    const longPress = async (locator) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
        await page.mouse.down();
        await menu.waitFor({ state: "visible", timeout: 10000 });
        await page.mouse.up();
    };

    try {
        // Desktop oscillator performance knobs (previously hardcoded off).
        const semiKnob = page.locator('[data-role="oscillator-semitone"]');
        await semiKnob.waitFor();
        await semiKnob.scrollIntoViewIfNeeded();
        await longPress(semiKnob);
        assert.equal(
            await page.locator('[data-role="rack-parameter-menu-item"][data-action="reset-base"]').count(),
            1,
            "Engine knobs carry a canonical default and must offer reset.",
        );
        await page.locator('[data-role="rack-parameter-menu-layer"]').click({ position: { x: 4, y: 4 } });
        await menu.waitFor({ state: "detached" });

        // Number fields self-serve the menu through the shared context:
        // the Warp amount Nexus field, and a unison Precision field behind
        // the Voice controls mode.
        const warpField = page.locator('[data-role="warp-amount-field"]');
        await warpField.scrollIntoViewIfNeeded();
        await longPress(warpField);
        await page.locator('[data-role="rack-parameter-menu-layer"]').click({ position: { x: 4, y: 4 } });
        await menu.waitFor({ state: "detached" });

        await page.click('[data-role="keyboard-control-mode-voice"]');
        const detuneInput = page.locator('input[aria-label="Unison detune"]');
        await detuneInput.scrollIntoViewIfNeeded();
        await longPress(detuneInput);
    } finally {
        await page.close();
    }
});

test("T13v2: the quick sheet's graphic is the REAL editor — MSEG points drag, the macro bar writes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);

        // MSEG sheet: dragging a point on the sheet's surface edits the
        // stored shape (the same handlers as the full editor).
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        const surface = page.locator('[data-role="quick-sheet-mseg-surface"]');
        await surface.waitFor();
        const before = readStoredMsegShape(await getHarnessSnapshot(page), 0);
        const box = await surface.boundingBox();
        assert.ok(box);
        // The default shape is two endpoints (0,0)->(1,1): drag the end
        // point DOWNWARD (it sits at the value ceiling) so the edit lands.
        const handle = surface.locator("circle").nth(1);
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox, "The sheet surface must render draggable point handles.");
        const start = { x: handleBox.x + (handleBox.width / 2), y: handleBox.y + (handleBox.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y + 40, { steps: 4 });
        await page.mouse.up();
        await page.waitForFunction((previous) => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            const raw = snapshot.storedStateValues?.["modulation.v6"] ?? snapshot.storedState?.["modulation.v6"];
            return typeof raw === "string" && raw !== previous;
        }, JSON.stringify(before) === "null" ? "" : undefined, { timeout: 5000 }).catch(() => null);
        const after = readStoredMsegShape(await getHarnessSnapshot(page), 0);
        assert.notDeepEqual(after, before, "Dragging a sheet point must edit the stored MSEG shape.");
        await page.locator('[data-role="quick-source-sheet-close"]').click();

        // Envelope sheet: the graphic is the REAL draggable ADSR editor.
        await expandGlobalModRail(page);
        await page.locator('[data-role="rack-mod-source-env-1"]').click();
        await page.locator('[data-role="quick-source-sheet"] [data-role="adsr-editor-surface"]').waitFor();
        await page.locator('[data-role="quick-source-sheet-close"]').click();

        // Macro sheet: the value bar is directly draggable and writes the
        // macro's base value.
        await expandGlobalModRail(page);
        await page.locator('[data-role="rack-mod-source-macro-1"]').click();
        const bar = page.locator('[data-role="quick-source-sheet-macro"]');
        await bar.waitFor();
        const barBox = await bar.boundingBox();
        assert.ok(barBox);
        await page.mouse.move(barBox.x + (barBox.width * 0.2), barBox.y + (barBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(barBox.x + (barBox.width * 0.8), barBox.y + (barBox.height / 2), { steps: 5 });
        await page.mouse.up();
        await waitForHarnessSnapshot(
            page,
            "macro bar drag",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "macro1" && Number(value) > 0.7
            )),
        );
    } finally {
        await page.close();
    }
});

test("T21: a drag that dwell-navigates FX to Voice keeps eligibility and capture painting", async () => {
    // The drag machinery already captures cross-page targets; this pins the
    // PAINT: the mapping flag on the surface must survive React re-rendering
    // the surface's own attributes on the page switch.
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const sourceBox = await source.boundingBox();
        assert.ok(sourceBox);
        await page.mouse.move(sourceBox.x + (sourceBox.width / 2), sourceBox.y + (sourceBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(196, 300, { steps: 4 });

        const voiceTab = page.locator('[data-role="mobile-workspace-tab-voice"]');
        const voiceBox = await voiceTab.boundingBox();
        assert.ok(voiceBox);
        await page.mouse.move(voiceBox.x + (voiceBox.width / 2), voiceBox.y + (voiceBox.height / 2), { steps: 3 });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-voice"]')?.getAttribute("aria-selected") === "true"
        ));

        // Hover the Voice graph (the compact page's wavetable target):
        // capture must PAINT, not just latch.
        const card = page.locator('[data-role="mobile-voice-editor"] [data-modulation-target-kind]').first();
        const cardBox = await card.boundingBox();
        assert.ok(cardBox);
        await page.mouse.move(cardBox.x + (cardBox.width / 2), cardBox.y + (cardBox.height / 2), { steps: 6 });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-editor"] [data-modulation-target-kind]')
                ?.classList.contains("is-mod-hover")
        ));
        const capturedShadow = await card.evaluate((element) => getComputedStyle(element).boxShadow);
        assert.notEqual(capturedShadow, "none", "The captured Voice target must paint after a cross-page drag.");

        // Moving off to a non-target spot restores the THIN eligibility
        // outline (still not "none": the surface stays in mapping mode).
        await page.mouse.move(60, cardBox.y + cardBox.height + 40, { steps: 4 });
        await page.waitForTimeout(250);
        const eligibleShadow = await card.evaluate((element) => getComputedStyle(element).boxShadow);
        assert.notEqual(eligibleShadow, "none", "Eligibility must stay painted across the page switch.");
        await page.mouse.up();
    } finally {
        await page.close();
    }
});

test("T14: the Mod panels ARE the Voice selector component, restore per instance, and follow the bar", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const tabs = page.locator('[data-role="mobile-mod-panel-tabs"]');
        await tabs.waitFor();

        // Not an approximation: the SAME component and classes as the Voice
        // A/B/C selector (T14's one-selector rule).
        assert.equal(await tabs.getAttribute("class"), "cosimo-tabs");
        assert.equal(await tabs.getAttribute("role"), "tablist");
        assert.deepEqual(
            await tabs.locator('[role="tab"]').allTextContents(),
            ["SOURCE", "MAPPINGS"],
        );
        assert.equal(
            await tabs.locator('[role="tab"]').first().evaluate((element) => element.className.includes("cosimo-tab")),
            true,
        );
        assert.equal(await page.locator('[data-role="mobile-mod-panel-source"]').count(), 1);

        // Switch to MAPPINGS; the choice survives a relaunch of the same
        // instance session (sessionStorage — the shell's workspace scope).
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.locator('[data-role="mod-mappings-panel"]').waitFor();
        await page.reload({ waitUntil: "commit" });
        await waitForHarnessReady(page);
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.locator('[data-role="mobile-mod-panel-source"]').waitFor({ state: "detached" }).catch(() => null);
        assert.equal(
            await page.locator('[data-role="mobile-mod-panel-tab-mappings"]').getAttribute("aria-selected"),
            "true",
            "The instance restores its last panel.",
        );
        assert.equal(await page.locator('[data-role="mod-mappings-panel"]').count(), 1);

        // Choosing a source from the floating bar while inside Mod selects it
        // AND surfaces the SOURCE panel — never a sheet over the full panel.
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-mod-panel-tab-source"]')?.getAttribute("aria-selected") === "true"
        ));
        assert.equal(await page.locator('[data-role="quick-source-sheet"]').count(), 0);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "env"
        ));
    } finally {
        await page.close();
    }
});

test("T14: the SOURCE graph edits points directly with Expand explicit; the 320px toolbar stays composed", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const surface = page.locator('[data-role="mod-source-mseg-surface"]');
        await surface.waitFor();

        // Direct point editing: drag the end point down; the stored shape
        // follows through the SAME editing brain as the full editor.
        const before = readStoredMsegShape(await getHarnessSnapshot(page), 0);
        const handle = surface.locator("circle").nth(1);
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox, "The compact SOURCE graph must render draggable point handles.");
        const start = { x: handleBox.x + (handleBox.width / 2), y: handleBox.y + (handleBox.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y + 30, { steps: 4 });
        await page.mouse.up();
        await page.waitForFunction((previousShape) => {
            const raw = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            return typeof raw === "string" && raw !== previousShape;
        }, JSON.stringify(before), { timeout: 5000 }).catch(() => null);
        const after = readStoredMsegShape(await getHarnessSnapshot(page), 0);
        assert.notDeepEqual(after, before, "Dragging a SOURCE-panel point must edit the stored shape.");

        // The explicit Expand control opens the real full-screen editor.
        await page.click('[data-role="mod-source-mseg-expand"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        await page.click('[data-action="shell-back"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });

        // 320px: the toolbar keeps ONE composed row — every control inside
        // the viewport, nothing wrapped into a pile, the table intact.
        await page.setViewportSize({ width: 320, height: 600 });
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        const toolbar = page.locator('[data-role="mod-mappings-toolbar"]');
        await toolbar.waitFor();
        const composure = await toolbar.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const children = Array.from(element.children)
                .map((child) => child.getBoundingClientRect())
                .filter((rect) => rect.width > 0);
            return {
                height: bounds.height,
                allInside: children.every((rect) => rect.left >= 0 && rect.right <= 320 + 1),
                singleRow: children.every((rect) => Math.abs((rect.top + rect.height / 2) - (bounds.top + bounds.height / 2)) < 8),
                documentScrollWidth: document.documentElement.scrollWidth,
            };
        });
        assert.equal(composure.height <= 44, true, `One toolbar row, got ${composure.height}px.`);
        assert.equal(composure.allInside, true, "Toolbar controls must stay inside 320px.");
        assert.equal(composure.singleRow, true, "Toolbar controls must not wrap into a pile.");
        assert.equal(composure.documentScrollWidth <= 320, true);
    } finally {
        await page.close();
    }
});
