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
                && route.targetKind === "rack.reverbSize"
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
                && route.targetKind === "rack.reverbMix"
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
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
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
            await nextPage.addInitScript((value) => {
                localStorage.setItem("cosimo.mobile-global-mod-rail.position.v1", value);
            }, JSON.stringify({ version: 2, edge: "left", normalizedY: 0.8 }));
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

        // Suspension while held must end the note exactly once.
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
                route.sourceKind === "env" && route.targetKind === "rack.reverbSize"
            )),
        );
        await collapseGlobalModRail(page);

        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await pressNoteKey("Mod overview");

        const routeRow = page.locator('[data-role="mobile-mod-route-row"]').first();
        await routeRow.waitFor();
        await routeRow.click();
        await pressNoteKey("Route detail");

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
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "reverbSize").length,
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

        // Toggling off mid-hold can never leave a note sounding.
        await clearHarnessDebugLog(page);
        const surfaceBox = await page.locator('[data-role="rack-parameter-surface-reverbSize"]').boundingBox();
        assert.ok(surfaceBox);
        const holdStart = {
            x: surfaceBox.x + (surfaceBox.width / 2),
            y: surfaceBox.y + (surfaceBox.height / 2),
        };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...holdStart, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (const step of [15, 30]) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: holdStart.x + step, y: holdStart.y, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.some(({ value }) => (value >>> 16) === 0x90)
        ));
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns === noteOffs;
        }, undefined, { timeout: 2000 });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
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
                route.sourceKind === "mseg" && route.targetKind === "rack.reverbSize"
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
                && route.targetKind === "rack.reverbSize"
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
        assert.equal(collapsed.pathStrokeWidth, "1px");
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
        const createMapping = page.locator('[data-role="rack-create-mapping"]');
        if (await createMapping.count() > 0) {
            await createMapping.click();
        }

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
        // The B2 module skeleton (T10B): a full-width 40px hit area around a
        // 28px source module, on the rail's 10px rhythm.
        assert.equal(visualContract.sources.every((source) => source.buttonWidth === 40 && source.buttonHeight === 28), true);
        assert.equal(visualContract.sources.every((source) => source.artWidth === 28 && source.artHeight === 28), true);
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
                Math.abs(source.top - visualContract.sources[index].bottom - 10) <= 0.5
            )),
            true,
            "Source rows must sit on the rail's single 10px rhythm.",
        );
        assert.deepEqual(visualContract.previous, { width: 40, height: 20 });
        assert.deepEqual(visualContract.next, { width: 40, height: 20 });

        await page.click('[data-role="rack-mod-source-mseg-1"]');
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

test("rack mod bar keeps source and target selection unassigned until explicit route creation", async () => {
    const sourceFirstPage = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await sourceFirstPage.click('[data-role="mobile-workspace-tab-fx"]');
        await expandGlobalModRail(sourceFirstPage);
        await clearHarnessDebugLog(sourceFirstPage);
        await sourceFirstPage.click('[data-role="rack-mod-source-mseg-1"]');

        let snapshot = await getHarnessSnapshot(sourceFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionDriveDb"
            )),
            false,
            "Selecting a source must not imply a modulation route.",
        );
        assert.equal(await sourceFirstPage.locator('[data-role="rack-modulation-amount"]').count(), 0);
        const createMapping = sourceFirstPage.locator('[data-role="rack-create-mapping"]');
        assert.match(await createMapping.innerText(), /create mapping \+/i);
        assert.match(
            await sourceFirstPage.locator('[data-role="rack-unmapped-pair"]').innerText(),
            /MSEG 1.*Distortion.*Drive/i,
        );
        await createMapping.click();

        snapshot = await waitForHarnessSnapshot(
            sourceFirstPage,
            "explicit source-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionDriveDb"
            )),
        );
        const sourceFirstRoute = readStoredModulationState(snapshot).routes.find((route) => (
            route.sourceKind === "mseg"
            && route.sourceSlot === 1
            && route.targetKind === "rack.distortionDriveDb"
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
                && route.targetKind === "rack.distortionDriveDb"
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
        await targetFirstPage.click('[data-role="rack-mod-source-macro-2"]');

        let snapshot = await getHarnessSnapshot(targetFirstPage);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
            )),
            false,
            "Target-first selection must remain context-only.",
        );
        await targetFirstPage.click('[data-role="rack-create-mapping"]');

        snapshot = await waitForHarnessSnapshot(
            targetFirstPage,
            "explicit target-first rack route",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes.some((route) => (
                route.sourceKind === "macro"
                && route.sourceSlot === 2
                && route.targetKind === "rack.reverbSize"
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
                    && route.targetKind === "rack.reverbSize"
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
                targetKind: "rack.reverbSize",
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
        await page.click('[data-role="rack-mod-source-mseg-1"]');
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
                { id: "armed-mseg-size", enabled: true, sourceKind: "mseg", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.4, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        // ADR-025 row 9: a bypassed effect's controls are honestly grey, so
        // exercise the armed-ring colors on a POWERED effect.
        await page.locator('[data-rack-effect-id="reverb"] .rack-power').click();
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-mseg-1"]');
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
        assert.equal(routes.some((route) => route.sourceKind === "env" && route.targetKind === "rack.reverbSize"), false);
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
                && route.targetKind === "rack.reverbSize"
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
            && target.value === "rack.reverbSize"
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
                && route.targetKind === "rack.reverbSize"
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
                { id: "env-reverb", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.reverbSize", amount: 0.4, reducer: "max" },
                { id: "env-filter", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.globalFilterResonance", amount: 2, reducer: "max" },
                { id: "env-phaser", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.phaserRate", amount: 1.2, reducer: "max" },
                { id: "env-delay", enabled: true, sourceKind: "env", sourceSlot: 1, polarity: "unipolar", targetKind: "rack.delayTime", amount: 1, reducer: "max" },
            ],
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("globalFilterMode", 0, true);
        }, seededState);
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "reverb");
        await page.click('[data-role="rack-enabled-reverb"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await collapseGlobalModRail(page);
        const reverbKnob = page.locator('[data-role="rack-parameter-reverbSize"]');
        const reverbBadge = page.locator('[data-role="rack-route-count-reverbSize"]');
        const activeGeometry = await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d");
        assert.notEqual(activeGeometry, "");
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        const routesBeforeBypass = routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes);

        await page.click('[data-role="rack-enabled-reverb"]');
        assert.match(await page.locator('[data-role="rack-editor-reverb"] .rack-editor-header').innerText(), /FX BYPASSED/);
        assert.equal(await reverbKnob.getAttribute("data-route-state"), "mapped");
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "effect-bypassed");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);
        assert.equal((await reverbBadge.textContent()).trim(), "1");
        assert.equal(
            await reverbKnob.locator('.rack-knob-mod-fill').evaluate((element) => getComputedStyle(element).filter),
            "none",
        );
        assert.deepEqual(routeSummaries(readStoredModulationState(await getHarnessSnapshot(page)).routes), routesBeforeBypass);
        await page.click('[data-role="rack-enabled-reverb"]');
        assert.equal(await reverbKnob.getAttribute("data-route-effectiveness"), "active");
        assert.equal(await reverbKnob.locator('.rack-knob-mod-fill').getAttribute("d"), activeGeometry);

        await page.click('[data-role="rack-enabled-reverb"]');
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
        await page.click('[data-role="rack-enabled-filter"]');
        const filterMode = page.locator('[data-role="rack-parameter-globalFilterMode"]');
        const resonance = page.locator('[data-role="rack-parameter-globalFilterResonance"]');
        assert.equal(await filterMode.getAttribute("data-rack-mod-target"), null);
        assert.equal(await filterMode.locator('.rack-route-count-badge').count(), 0);
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "target-suspended");
        assert.equal(await page.locator('[data-role="rack-parameter-surface-globalFilterResonance"] .rack-target-suspended-label').count(), 1);
        await filterMode.click();
        assert.equal(await resonance.getAttribute("data-route-effectiveness"), "active");

        await selectRackEffect(page, "phaser");
        await page.click('[data-role="rack-enabled-phaser"]');
        const phaserMode = page.locator('[data-role="rack-parameter-phaserRateMode"]');
        await phaserMode.click();
        const phaserRate = page.locator('[data-role="rack-parameter-phaserRate"]');
        assert.equal(await phaserRate.count(), 1, "Configured Free rate must stay discoverable in Sync mode.");
        assert.equal(await phaserRate.getAttribute("data-route-effectiveness"), "target-suspended");

        await selectRackEffect(page, "delay");
        await page.click('[data-role="rack-enabled-delay"]');
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
        assert.equal(Number(snapshot.parameterValues.globalFilterMode), 1);
        assert.match(await mode.innerText(), /Lowpass/i);
        assert.match(await page.locator('[data-role="rack-editor-filter"] .rack-editor-header').innerText(), /FX BYPASSED/);
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
                targetKind: "rack.distortionWet",
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

test("rack quick controls never reorder or stick after release and reorder is grip-only", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await clearHarnessDebugLog(page);
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        const quickBox = await quick.boundingBox();
        assert.ok(quickBox);

        await page.mouse.move(quickBox.x + (quickBox.width * 0.2), quickBox.y + (quickBox.height * 0.72));
        await page.mouse.move(quickBox.x + (quickBox.width * 0.8), quickBox.y + (quickBox.height * 0.72), { steps: 8 });
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.sentMessages, [], "Hovering a quick control must be inert.");
        assert.deepEqual(snapshot.gestureStarts, []);

        await page.mouse.down();
        await page.mouse.move(quickBox.x + (quickBox.width * 0.55), quickBox.y + (quickBox.height * 0.72), { steps: 6 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "quick-control parameter gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("reverbSize")
                && nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "reverbSize"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "rackOrder"), false);

        const valueAfterRelease = Number(snapshot.parameterValues.reverbSize);
        await clearHarnessDebugLog(page);
        await page.mouse.move(quickBox.x + 2, quickBox.y + (quickBox.height * 0.72), { steps: 10 });
        await page.mouse.move(quickBox.x + quickBox.width - 2, quickBox.y + (quickBox.height * 0.72), { steps: 10 });
        await page.waitForTimeout(80);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.reverbSize), valueAfterRelease);
        assert.deepEqual(snapshot.sentMessages, [], "Released quick control remained attached to the pointer.");
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);

        assert.equal(await page.locator('[data-rack-position][draggable="true"]').count(), 0);
        assert.equal(await page.locator('[data-role^="rack-reorder-handle-"]').count(), 8);
    } finally {
        await page.close();
    }
});

test("rack quick controls keep tracking Safari touch moves that report zero buttons", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.3, true);
        });
        await clearHarnessDebugLog(page);

        const bounds = await quick.boundingBox();
        assert.ok(bounds);
        const start = {
            x: bounds.x + (bounds.width * 0.35),
            y: bounds.y + (bounds.height * 0.5),
        };
        const moved = {
            x: start.x + (bounds.width * 0.3),
            y: start.y,
        };

        await quick.dispatchEvent("pointerdown", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await quick.dispatchEvent("pointermove", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: moved.x,
            clientY: moved.y,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.deepEqual(snapshot.gestureEnds, [], "A live Safari touch move must not end the gesture.");
        assert.ok(Number(snapshot.parameterValues.reverbSize) > 0.3);

        await quick.dispatchEvent("pointerup", {
            pointerId: 91,
            pointerType: "touch",
            button: 0,
            buttons: 0,
            clientX: moved.x,
            clientY: moved.y,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "Safari quick-control touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
    } finally {
        await page.close();
    }
});

test("rack quick controls keep tracking touch outside the card when pointer capture is unavailable", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        const quick = page.locator('[data-role="rack-quick-reverb"]');
        await quick.scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("reverbSize", 0.3, true);
        });
        await clearHarnessDebugLog(page);

        const bounds = await quick.boundingBox();
        assert.ok(bounds);
        await quick.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        const pointer = {
            pointerId: 92,
            pointerType: "touch",
            button: 0,
        };
        const startX = bounds.x + (bounds.width * 0.35);
        const clientY = bounds.y + (bounds.height * 0.5);
        await quick.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientX: startX,
            clientY,
        });
        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId: pointer.pointerId,
            clientX: startX + (bounds.width * 0.3),
            clientY,
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["reverbSize"]);
        assert.ok(Number(snapshot.parameterValues.reverbSize) > 0.3);

        await page.evaluate(({ pointerId, clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
                bubbles: true,
            }));
        }, {
            pointerId: pointer.pointerId,
            clientX: startX + (bounds.width * 0.3),
            clientY,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free rack quick-control release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("reverbSize"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["reverbSize"]);
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
            await page.click(`[data-role="rack-enabled-${effectId}"]`);
        }

        let snapshot = await waitForHarnessSnapshot(
            page,
            "all rack enable commits",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackEnable"
                && Array.isArray(value?.enabledFlags)
                && value.enabledFlags.every((flag) => Number(flag) === 1)
            )),
        );
        const storedRack = JSON.parse(String(snapshot.storedState["rack.v1"]));
        assert.deepEqual(storedRack.order, ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"]);
        assert.equal(Object.values(storedRack.enabled).every(Boolean), true);

        await clearHarnessDebugLog(page);
        const reorderHandle = page.locator('[data-role="rack-reorder-handle-reverb"]');
        const reorderTarget = page.locator('[data-role="rack-module-filter"]');
        await reorderHandle.scrollIntoViewIfNeeded();
        const handleBox = await reorderHandle.boundingBox();
        const targetBox = await reorderTarget.boundingBox();
        assert.ok(handleBox && targetBox, "Rack pointer-reorder endpoints are missing");
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "one rack reorder commit",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                endpointID === "rackOrder"
                && Array.isArray(value?.moduleIds)
                && Number(value.moduleIds[0]) === 7
            )),
        );
        const orderMessages = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "rackOrder");
        assert.equal(orderMessages.length, 1, "drag previews must not write DSP structure");
        assert.deepEqual(orderMessages[0].value.moduleIds, [7, 0, 1, 2, 3, 4, 5, 6]);
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
                window.__COSIMO_DESKTOP_HARNESS__.setParameterValue(endpointID, 1, true);
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

test("desktop chorus mode buttons do not visually collide in the selected rack editor", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 1, true);
        });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim() === "MotionClassic"
            && document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim() === "BloomLarge"
            && document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim() === "PitchLow 5th"
        ));

        const layout = await page.evaluate(() => {
            const roles = [
                "chorus-motion-mode-control",
                "chorus-bloom-mode-control",
                "chorus-ring-offset-mode-control",
            ];
            const buttons = roles.map((role) => document.querySelector(`[data-role="${role}"]`));

            if (!buttons.every((button) => button instanceof HTMLElement)) {
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
            };
        });

        assert.ok(layout, "Expected chorus mode buttons to render.");
        assert.equal(layout.noBoxOverlap, true, `Mode button boxes overlap: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.clipsInternalOverflow, true, `Mode button labels can paint outside their boxes: ${JSON.stringify(layout.rects)}`);
        assert.equal(layout.contentFits, true, `Longest chorus mode labels do not fit their buttons: ${JSON.stringify(layout.rects)}`);
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        await page.click('[data-role="rack-enabled-chorus"]');
        await editRackParameterValue(page, "chorus-mix-control", "66");
        await page.click('[data-role="chorus-motion-mode-control"]');
        await page.click('[data-role="chorus-bloom-mode-control"]');
        await page.click('[data-role="chorus-ring-offset-mode-control"]');
        await editRackParameterValue(page, "chorus-tone-control", "80");
        await editRackParameterValue(page, "chorus-feedback-control", "70");
        await editRackParameterValue(page, "chorus-ring-amount-control", "50");
        await editRackParameterValue(page, "chorus-ring-fine-control", "-0.75");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus parameter updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "rackEnable"
                    && Array.isArray(value?.enabledFlags)
                    && Number(value.enabledFlags[3]) === 1
                ))
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMix" && Math.abs(Number(value) - 0.66) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusMotionMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusBloomMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingOffsetMode" && Number(value) === 1)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusTone" && Math.abs(Number(value) - 0.8) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusFeedback" && Math.abs(Number(value) - 0.7) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingAmount" && Math.abs(Number(value) - 0.5) <= 1e-6)
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => endpointID === "chorusRingFineSemitones" && Math.abs(Number(value) + 0.75) <= 1e-6)
            ),
        );

        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "chorusMix"), true);
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.375, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 3, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 4, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 2, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusTone", 0.825, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusFeedback", 0.615, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingAmount", 0.285, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingFineSemitones", 1.25, true);
        });

        await page.waitForFunction(() => {
            const readInputValue = (role) => document.querySelector(`[data-role="${role}"]`)?.value ?? "";
            const readText = (role) => document.querySelector(`[data-role="${role}"]`)?.textContent ?? "";

            return readInputValue("chorus-mix-control") === "0.375"
                && readInputValue("chorus-tone-control") === "0.825"
                && readInputValue("chorus-feedback-control") === "0.615"
                && readInputValue("chorus-ring-amount-control") === "0.285"
                && readInputValue("chorus-ring-fine-control") === "1.25"
                && readText("chorus-motion-mode-control").includes("Fast")
                && readText("chorus-bloom-mode-control").includes("Lg+Sh")
                && readText("chorus-ring-offset-mode-control").includes("+Oct");
        });

        const rendered = await page.evaluate(() => ({
            mix: document.querySelector('[data-role="chorus-mix-control"]')?.value,
            tone: document.querySelector('[data-role="chorus-tone-control"]')?.value,
            feedback: document.querySelector('[data-role="chorus-feedback-control"]')?.value,
            ring: document.querySelector('[data-role="chorus-ring-amount-control"]')?.value,
            ringFine: document.querySelector('[data-role="chorus-ring-fine-control"]')?.value,
            motionText: document.querySelector('[data-role="chorus-motion-mode-control"]')?.textContent?.trim(),
            bloomText: document.querySelector('[data-role="chorus-bloom-mode-control"]')?.textContent?.trim(),
            ringOffsetText: document.querySelector('[data-role="chorus-ring-offset-mode-control"]')?.textContent?.trim(),
        }));

        assert.deepEqual(rendered, {
            mix: "0.375",
            tone: "0.825",
            feedback: "0.615",
            ring: "0.285",
            ringFine: "1.25",
            motionText: "MotionFast",
            bloomText: "BloomLg+Sh",
            ringOffsetText: "Pitch+Oct",
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
                && nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "chorusMix")
            ),
        );

        assert.deepEqual(snapshot.gestureStarts, ["chorusMix"]);
        assert.deepEqual(snapshot.gestureEnds, ["chorusMix"]);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "chorusMix"),
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMix", 0.2, true);
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
        assert.deepEqual(snapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMix"), []);
        assert.deepEqual(snapshot.gestureStarts, []);
        assert.deepEqual(snapshot.gestureEnds, []);
    } finally {
        await page.close();
    }
});

test("desktop chorus cycle buttons wrap through all modes", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForSelector('[data-role="effects-rack-card"]');
        await selectRackEffect(page, "chorus");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusMotionMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusBloomMode", 0, true);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("chorusRingOffsetMode", 0, true);
        });
        await clearHarnessDebugLog(page);

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-motion-mode-control"]');
        }

        for (let i = 0; i < 6; i += 1) {
            await page.click('[data-role="chorus-bloom-mode-control"]');
        }

        for (let i = 0; i < 5; i += 1) {
            await page.click('[data-role="chorus-ring-offset-mode-control"]');
        }

        const snapshot = await waitForHarnessSnapshot(
            page,
            "chorus cycle button updates",
            (nextSnapshot) => (
                nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusMotionMode").length >= 5
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusBloomMode").length >= 6
                && nextSnapshot.sentMessages.filter(({ endpointID }) => endpointID === "chorusRingOffsetMode").length >= 5
            ),
        );

        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusMotionMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusBloomMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 4, 0, 1],
        );
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => endpointID === "chorusRingOffsetMode")
                .map(({ value }) => Number(value)),
            [1, 2, 3, 0, 1],
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
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("distortionWetLPHz", 20, true);
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

test("desktop distortion graph renders occupancy bands on the fixed transfer scale", async () => {
    const page = await openHarnessPage();

    try {
        await selectRackEffect(page, "drive");
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
        const overlayState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;

            return {
                occupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-occupancy"]').length ?? 0,
                clippedOccupancyCount: viewRoot?.querySelectorAll('[data-role="distortion-transfer-clipped-occupancy"]').length ?? 0,
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
        assert.equal(overlayState.occupancyCount > 0, true);
        assert.equal(overlayState.clippedOccupancyCount > 0, true);
        assert.equal(overlayState.historyOutputColumnCount, historyFixture.binCount);
        assert.equal(overlayState.historyRemovedColumnCount > 0, true);
        assert.equal(overlayState.legacyTraceCount, 0);
        assert.equal(overlayState.legacyClippedPointCount, 0);
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
        await page.click('[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 4);
        await captureBaseline();

        await page.click('[data-role="rack-mod-source-mseg-1"]');
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
        await page.click('[data-role="rack-mod-source-env-1"]');
        await waitForShading("diff === 0");
        await page.click('[data-role="rack-mod-source-mseg-1"]');
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
        await page.click('[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 4);
        await captureBaseline();
        await page.click('[data-role="rack-mod-source-mseg-1"]');
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

        // The taps legitimately open the quick sheet (T13), and the drawer
        // covers the screen bottom by design — dismiss it before navigating.
        await page.locator('[data-role="quick-source-sheet-close"]').click();
        await page.locator('[data-role="quick-source-sheet"]').waitFor({ state: "detached" });

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
        await page.click('[data-role="mseg-editor-done"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor({ state: "detached" });

        // Reopen; the explicit Full editor button is the discoverable route.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await sheet.waitFor();
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        await page.click('[data-role="mseg-editor-done"]');
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

test("T13: the drawer's selected-source tap opens the sheet; the Mod page keeps full-editor navigation", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const sheet = page.locator('[data-role="quick-source-sheet"]');
    const tapChip = async (selector) => {
        // A plain second tap on the just-armed chip: dispatched directly so
        // Playwright's actionability retries cannot race the drawer collapse
        // that the tap itself triggers.
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

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);

        // Expanded drawer: tapping the already-selected source opens the sheet
        // for it (an env source shows the four envelope cells).
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 3);
        await tapChip('[data-role="rack-mod-source-env-1"]');
        await sheet.waitFor();
        assert.equal(await sheet.getAttribute("data-source-kind"), "env");
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-attack"]').count(), 1);
        assert.equal(await page.locator('[data-role="quick-source-sheet-cell-release"]').count(), 1);
        await page.locator('[data-role="quick-source-sheet-close"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-source-sheet"]') === null
        ));

        // On the Mod page the same tap keeps the existing full-editor
        // navigation; the sheet never covers the Source panel.
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await expandGlobalModRail(page);
        await page.click('[data-role="rack-mod-source-env-1"]');
        await waitForReactFrames(page, 3);
        await tapChip('[data-role="rack-mod-source-env-1"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-source-editor"]')?.getAttribute("data-source-kind") === "env"
        ));
        assert.equal(await sheet.count(), 0, "The quick sheet belongs to Voice/FX only.");
    } finally {
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

        // The MSEG editor modal's Time slider long-presses into the menu too.
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await page.locator('[data-role="quick-source-sheet"]').waitFor();
        await page.click('[data-role="quick-source-sheet-full-editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();
        // The floating Mod rail deliberately stays live ABOVE the editor
        // (T11) and its persisted dock can cover parts of the controls row:
        // press a point of the Time label the rail does not intercept.
        const timePress = await page.evaluate(() => {
            const label = document.querySelector(".mseg-editor-time");
            if (!label) {
                throw new Error("Time slider missing.");
            }
            const rect = label.getBoundingClientRect();
            for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
                for (const fy of [0.5, 0.3, 0.75]) {
                    const x = rect.left + (rect.width * fx);
                    const y = rect.top + (rect.height * fy);
                    const hit = document.elementFromPoint(x, y);
                    if (hit && label.contains(hit)) {
                        return { x, y };
                    }
                }
            }
            throw new Error("The Time slider is fully covered by the rail.");
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
        await collapseGlobalModRail(page);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
        await page.locator('[data-role="quick-source-sheet"] [data-role="adsr-editor-surface"]').waitFor();
        await page.locator('[data-role="quick-source-sheet-close"]').click();

        // Macro sheet: the value bar is directly draggable and writes the
        // macro's base value.
        await expandGlobalModRail(page);
        await page.locator('[data-role="rack-mod-source-macro-1"]').click();
        await collapseGlobalModRail(page);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();
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
