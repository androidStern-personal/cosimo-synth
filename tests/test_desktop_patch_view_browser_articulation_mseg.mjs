import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

import { BOUNCE_STATE_KEY } from "../bounce/document.mjs";

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

test("desktop articulation hydration and live writes reject the same duplicate and retired documents whole", async () => {
    const validState = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "bow",
        activeTriggerMode: "chain",
        slots: [{
            id: "bow",
            runtimeSlot: 0,
            name: "Bow",
            color: "test-bow",
            key: 0,
            velRange: { min: 1, max: 1 },
            chainRange: { min: 0, max: 127 },
            overrides: {},
            routeAmounts: {},
        }],
    };
    const duplicateState = {
        ...validState,
        slots: [validState.slots[0], { ...validState.slots[0], name: "Duplicate Bow" }],
    };
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, {
                stateKey: ARTICULATION_STATE_KEY,
                state: duplicateState,
            });
        },
    });

    try {
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 0);

        await page.evaluate(({ stateKey, state }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(state));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            state: validState,
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').waitFor();

        await page.evaluate(({ stateKey, state }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(state));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            state: duplicateState,
        });
        await waitForReactFrames(page);
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 1);
        assert.equal(
            await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').count(),
            1,
        );

        await page.evaluate((stateKey) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify({
                format: "cosimo.articulations",
                version: 2,
                selectedSlotId: null,
                activeTriggerMode: "chain",
                slots: [],
                chainAssignments: [],
                keyAssignments: [],
                velocityAssignments: [],
            }));
        }, ARTICULATION_STATE_KEY);
        await waitForReactFrames(page);
        assert.equal(await page.locator('[data-role="articulation-card"]').count(), 1);
    } finally {
        await page.close();
    }
});

test("articulation range lane zooms by thirds and marks held Key Vel and Chain values", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        let viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                    pressed: dot.getAttribute("aria-pressed"),
                }))
            )),
            [
                { index: "0", held: "false", pressed: "true" },
                { index: "1", held: "false", pressed: "false" },
                { index: "2", held: "false", pressed: "false" },
            ],
        );

        await page.getByRole("tab", { name: "Key" }).click();
        await page.keyboard.down("a");
        await page.locator('[data-role="articulation-held-value"][data-held-value="36"]').waitFor();
        viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "36" });

        await page.getByRole("tab", { name: "Vel" }).click();
        assert.deepEqual(
            await page.locator('[data-role="articulation-range-viewport-dot"]').evaluateAll((dots) => (
                dots.map((dot) => ({
                    index: dot.getAttribute("data-viewport-index"),
                    held: dot.getAttribute("data-held"),
                }))
            )),
            [
                { index: "0", held: "false" },
                { index: "1", held: "false" },
                { index: "2", held: "true" },
            ],
            "velocity 100 should mark the upper third while the lower velocity third is visible",
        );
        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        await page.locator('[data-role="articulation-held-value"][data-held-value="100"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 86, max: 127, heldValue: "100" });

        await page.getByRole("tab", { name: "Chain" }).click();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("voiceArticulationStart", {
                hasArticulation: 1,
                selectorA: 24,
            }, true);
        });
        await page.locator('[data-role="articulation-held-value"][data-held-value="24"]').waitFor();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 0, min: 0, max: 42, heldValue: "24" });

        await page.keyboard.up("a");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-range-lane"]')?.getAttribute("data-held-value") === ""
        ));
    } finally {
        await page.keyboard.up("a").catch(() => {});
        await page.close();
    }
});

test("articulation editor resizes moves and gives every captured slot mandatory v4 selectors", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                {
                    id: "bow", runtimeSlot: 0, name: "Bow", color: "test-bow", key: 0,
                    velRange: { min: 1, max: 1 }, chainRange: { min: 0, max: 126 },
                    overrides: {}, routeAmounts: {},
                },
                {
                    id: "pluck", runtimeSlot: 1, name: "Pluck", color: "test-pluck", key: 1,
                    velRange: { min: 2, max: 2 }, chainRange: { min: 127, max: 127 },
                    overrides: {}, routeAmounts: {},
                },
            ],
        };

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();
        await page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]').click();
        assert.equal(
            await page.locator('[data-role="articulation-lane-assign-mode"], [data-role="articulation-lane-insert-mode"]').count(),
            0,
            "range placement must be inferred from hover/drop position, not an Assign/Insert mode toggle",
        );

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);

        await page.evaluate(({ stateKey }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            const currentBank = JSON.parse(harness.getSnapshot().storedState[stateKey]);
            harness.setStoredStateValue(stateKey, JSON.stringify({
                ...currentBank,
                slots: currentBank.slots.map((slot) => ({
                    ...slot,
                    chainRange: slot.id === "bow" ? { min: 0, max: 20 } : { min: 21, max: 21 },
                })),
            }));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
        });
        let snapshot = await waitForHarnessSnapshot(
            page,
            "seeded narrow segment for resize and move",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => assignment.id === "chain-pluck" && assignment.min === 21 && assignment.max === 21);
            },
        );

        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);
        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.9, laneBox.y + laneBox.height * 0.5, { steps: 8 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range edge resize",
            (nextSnapshot) => {
                const pluck = readStoredArticulationEditorState(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return pluck?.min === 21 && Number(pluck?.max) > 21;
            },
        );
        const resizedPluck = readStoredArticulationEditorState(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.equal(resizedPluck.min, 21);
        assert.equal(resizedPluck.max, 38);

        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        const segmentBox = await pluckSegment.boundingBox();
        assert.notEqual(segmentBox, null);
        await page.mouse.move(segmentBox.x + segmentBox.width * 0.5, segmentBox.y + segmentBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.95, laneBox.y + laneBox.height * 0.5, { steps: 10 });
        assert.deepEqual(
            await readDesktopRangeSegments(page),
            [
                {
                    articulationId: "bow",
                    min: 0,
                    max: 20,
                    isPreview: false,
                    isPreviewAffected: false,
                    text: "Bow 0-20",
                },
                {
                    articulationId: "pluck",
                    min: 31,
                    max: 42,
                    isPreview: true,
                    isPreviewAffected: false,
                    text: "Pluck 31-42",
                },
            ],
            "range body drag must render its moved range before pointer up",
        );
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            "31-48",
        );
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "range body move",
            (nextSnapshot) => {
                const pluck = readStoredArticulationEditorState(nextSnapshot).chainAssignments
                    .find((assignment) => assignment.articulationId === "pluck");
                return Number(pluck?.min) > 21 && Number(pluck?.max) > Number(pluck?.min);
            },
        );
        const movedPluck = readStoredArticulationEditorState(snapshot).chainAssignments
            .find((assignment) => assignment.articulationId === "pluck");
        assert.deepEqual(movedPluck, { id: "chain-pluck", articulationId: "pluck", min: 31, max: 48 });

        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "expanded capture uses the first free mandatory selectors",
            (nextSnapshot) => {
                const nextBank = readStoredArticulationEditorState(nextSnapshot);
                return nextBank.slots.length === 3
                    && nextBank.selectedSlotId === "articulation-2"
                    && nextBank.chainAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.min === 21
                        && assignment.max === 21
                    ))
                    && nextBank.keyAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.note === 2
                    ))
                    && nextBank.velocityAssignments.some((assignment) => (
                        assignment.articulationId === "articulation-2"
                        && assignment.min === 3
                        && assignment.max === 3
                    ));
            },
        );
        assert.equal(readStoredArticulationEditorState(snapshot).slots.length, 3);
    } finally {
        await page.close();
    }
});

test("real articulation card drag previews and commits a mapped v4 range move", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                {
                    id: "bow", runtimeSlot: 0, name: "Bow", color: "test-bow", key: 0,
                    velRange: { min: 1, max: 1 }, chainRange: { min: 0, max: 20 },
                    overrides: {}, routeAmounts: {},
                },
                {
                    id: "pluck", runtimeSlot: 1, name: "Pluck", color: "test-pluck", key: 1,
                    velRange: { min: 2, max: 2 }, chainRange: { min: 21, max: 30 },
                    overrides: {}, routeAmounts: {},
                },
            ],
        };

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for real browser drag",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const card = page.locator('[data-role="articulation-card"][data-articulation-id="pluck"]');
        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const targetPosition = {
            x: laneBox.width * 0.79,
            y: laneBox.height * 0.5,
        };
        const expectedDropPosition = Math.round(lowerViewport.min + (0.79 * (lowerViewport.max - lowerViewport.min)));
        const expectedMovedMin = expectedDropPosition - 5;
        const expectedMovedMax = expectedMovedMin + 9;
        const targetClientPosition = {
            x: laneBox.x + targetPosition.x,
            y: laneBox.y + targetPosition.y,
        };

        assert.equal(
            await previewArticulationCardDragOver(page, "pluck", lane, targetClientPosition),
            "move",
        );
        assert.deepEqual(await readDesktopRangeSegments(page), [
            {
                articulationId: "bow",
                min: 0,
                max: 20,
                isPreview: false,
                isPreviewAffected: false,
                text: "Bow 0-20",
            },
            {
                articulationId: "pluck",
                min: expectedMovedMin,
                max: expectedMovedMax,
                isPreview: true,
                isPreviewAffected: false,
                text: `Pluck ${expectedMovedMin}-${expectedMovedMax}`,
            },
        ]);
        assert.equal(
            await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
            `${expectedMovedMin}-${expectedMovedMax}`,
            "the live move preview must expose the exact target range",
        );

        await card.dragTo(lane, {
            sourcePosition: { x: 20, y: 20 },
            targetPosition,
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "real browser drag moves the mapped v4 range",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === expectedMovedMin
                    && assignment.max === expectedMovedMax
                ));
            },
        );

        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: expectedMovedMin, max: expectedMovedMax },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation range clicks select only and dragging an already mapped card moves its range", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
                { id: "air", runtimeSlot: 2, name: "Air" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
                { id: "chain-pluck", articulationId: "pluck", min: 64, max: 79 },
                { id: "chain-air", articulationId: "air", min: 96, max: 127 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded articulation bank for desktop click behavior",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 3,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        await page.mouse.click(laneBox.x + laneBox.width * 0.38, laneBox.y + laneBox.height * 0.5);
        await waitForReactFrames(page);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);

        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="2"]').click();
        assert.deepEqual(await readDesktopRangeViewport(page), { index: 2, min: 85, max: 127, heldValue: "" });

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "desktop range click selects the segment articulation",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "air",
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);

        await page.locator('[data-role="articulation-range-segment"][data-articulation-id="air"]').click({ button: "right" });
        const rangeMenu = page.locator('[data-role="articulation-range-menu"]');
        await rangeMenu.waitFor();
        assert.deepEqual(
            await rangeMenu.locator('[data-role="articulation-range-menu-item"]').evaluateAll((items) => (
                items.map((item) => item.getAttribute("data-action"))
            )),
            ["replace", "insert-after", "duplicate-after", "delete"],
            "right-click must open the range context menu with editing actions",
        );
        await waitForReactFrames(page);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, bank.chainAssignments);
        assert.equal(await page.locator('[data-role="articulation-lane-toast"]').count(), 0);
        await page.keyboard.press("Escape");
        await rangeMenu.waitFor({ state: "detached" });

        await page.locator('[data-role="articulation-range-viewport-dot"][data-viewport-index="1"]').click();
        const highViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(highViewport, { index: 1, min: 43, max: 84, heldValue: "" });
        const expectedMovedPosition = Math.round(highViewport.min + (0.2 * (highViewport.max - highViewport.min)));
        assert.equal(expectedMovedPosition, 51);
        const movedPluckMin = 43;
        const movedPluckMax = 58;
        await dragArticulationCardToLane(page, "pluck", lane, {
            x: laneBox.x + (laneBox.width * 0.2),
            y: laneBox.y + (laneBox.height * 0.5),
        }, {
            afterDragOver: async () => {
                const preview = page.locator('[data-role="articulation-placement-preview"]');
                await preview.waitFor();
                assert.equal(await preview.getAttribute("data-operation"), "move");
                assert.deepEqual(
                    await readDesktopRangeSegments(page),
                    [
                        {
                            articulationId: "pluck",
                            min: movedPluckMin,
                            max: movedPluckMax,
                            isPreview: true,
                            isPreviewAffected: false,
                            text: `Pluck ${movedPluckMin}-${movedPluckMax}`,
                        },
                    ],
                    "dragging an already-mapped card must preview one moved range, not merged instances",
                );
                assert.equal(
                    await page.locator('[data-role="articulation-range-ghost-value"]').textContent(),
                    `${movedPluckMin}-${movedPluckMax}`,
                );
            },
        });

        snapshot = await waitForHarnessSnapshot(
            page,
            "dragging a mapped card moves its only range instead of duplicating it",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.filter((assignment) => assignment.articulationId === "pluck").length === 1
                    && assignments.some((assignment) => (
                        assignment.articulationId === "pluck"
                        && assignment.min === movedPluckMin
                        && assignment.max === movedPluckMax
                    ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 31 },
            { id: "chain-pluck", articulationId: "pluck", min: movedPluckMin, max: movedPluckMax },
            { id: "chain-air", articulationId: "air", min: 96, max: 127 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize shrinks the range in the drag direction", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for resize",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const resizeMaxHandle = page
            .locator('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
            .first();
        const resizeBox = await resizeMaxHandle.boundingBox();
        assert.notEqual(resizeBox, null);

        await page.mouse.move(resizeBox.x + resizeBox.width * 0.5, resizeBox.y + resizeBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(laneBox.x + laneBox.width * 0.75, laneBox.y + laneBox.height * 0.5, { steps: 8 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "32-42"],
            "shared-boundary drag right must preview shrinking the right range start while leaving the left range alone",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "right range shrinks from the start during shared-boundary drag right",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 32
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 32, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation shared-boundary resize works on the first cold drag without pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded adjacent ranges for cold first drag",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments.length === 2,
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const viewport = await readDesktopRangeViewport(page);
        assert.deepEqual(viewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const bowBox = await bowSegment.boundingBox();
        assert.notEqual(bowBox, null);
        await bowSegment.evaluate((element) => {
            [element, ...element.querySelectorAll("*")].forEach((candidate) => {
                candidate.setPointerCapture = () => {
                    throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
                };
            });
        });

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - viewport.min) / (viewport.max - viewport.min))
        );
        const y = bowBox.y + bowBox.height * 0.5;

        await page.mouse.move(bowBox.x + bowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(23), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-20", "23-42"],
            "the first drag from a cold shared edge must preview shrinking the range in the drag direction",
        );

        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "reset adjacent ranges for cold first drag left",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );

        const resetBowBox = await bowSegment.boundingBox();
        assert.notEqual(resetBowBox, null);
        await page.mouse.move(resetBowBox.x + resetBowBox.width - 1, y);
        await page.mouse.down();
        await page.mouse.move(xForValue(19), y, { steps: 4 });

        assert.deepEqual(
            await page.locator('[data-role="articulation-range-value"]').allTextContents(),
            ["0-19", "21-42"],
            "the first cold drag left from a shared edge must shrink the left range and leave the right range in place",
        );

        await page.mouse.up();

        const dragLeftSnapshot = await waitForHarnessSnapshot(
            page,
            "cold first drag left shrinks the left range end and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(dragLeftSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("desktop articulation one-slot ranges keep labels and avoid adjacent resize-handle stealing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
            ],
            chainAssignments: [
                { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await waitForHarnessSnapshot(
            page,
            "seeded one-slot adjacent range",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 21),
        );

        await page.getByRole("button", { name: "Expand articulation editor" }).click();

        const lane = page.locator('[data-role="articulation-range-lane"]').first();
        const laneBox = await lane.boundingBox();
        assert.notEqual(laneBox, null);
        const lowerViewport = await readDesktopRangeViewport(page);
        assert.deepEqual(lowerViewport, { index: 0, min: 0, max: 42, heldValue: "" });

        const bowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const pluckSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="pluck"]').first();
        await pluckSegment.waitFor();
        assert.equal(await pluckSegment.getAttribute("data-tier"), "tiny");
        assert.equal(
            await pluckSegment.locator('[data-role="articulation-range-name"]').textContent(),
            "PS",
            "a one-slot range should still display the articulation identity instead of going blank",
        );

        const pluckHandleWidths = await pluckSegment
            .locator('[data-role^="articulation-range-resize"]')
            .evaluateAll((handles) => handles.map((handle) => handle.getBoundingClientRect().width));
        assert.deepEqual(
            pluckHandleWidths.map((width) => Math.round(width)),
            [4, 4],
            "resize hit targets should not consume the readable area of a one-slot range",
        );

        const bowBox = await bowSegment.boundingBox();
        const pluckBox = await pluckSegment.boundingBox();
        assert.notEqual(bowBox, null);
        assert.notEqual(pluckBox, null);

        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));

        await page.mouse.move(pluckBox.x + 1, pluckBox.y + pluckBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "false"
        ));

        const xForValue = (value) => (
            laneBox.x + laneBox.width * ((value - lowerViewport.min) / (lowerViewport.max - lowerViewport.min))
        );

        const bowMaxHandle = bowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const bowMaxHandleBox = await bowMaxHandle.boundingBox();
        assert.notEqual(bowMaxHandleBox, null);
        await page.mouse.move(bowBox.x + bowBox.width * 0.5, bowBox.y + bowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
            && document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="pluck"] [data-role="articulation-range-resize-min"]')
                ?.getAttribute("data-active") === "false"
        ));
        await page.mouse.move(
            bowMaxHandleBox.x + bowMaxHandleBox.width * 0.5,
            bowMaxHandleBox.y + bowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(19), pluckBox.y + pluckBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag left shrinks the left range and leaves the right range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 19
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 21
                    && assignment.max === 21
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(snapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 19 },
            { id: "chain-pluck", articulationId: "pluck", min: 21, max: 21 },
        ]);

        await page.evaluate(({ stateKey, nextState }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextState));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextState: editorBankToStoredArticulations(normalizeArticulationEditorState({
                selectedSlotId: "bow",
                activeTriggerMode: "chain",
                slots: [
                    { id: "bow", runtimeSlot: 0, name: "Bow Forte" },
                    { id: "pluck", runtimeSlot: 1, name: "Pluck Snap" },
                ],
                chainAssignments: [
                    { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
                    { id: "chain-pluck", articulationId: "pluck", min: 21, max: 42 },
                ],
            })),
        });
        await waitForHarnessSnapshot(
            page,
            "reset shared boundary with a wider right range",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).chainAssignments
                .some((assignment) => assignment.articulationId === "pluck" && assignment.min === 21 && assignment.max === 42),
        );

        const refreshedBowSegment = page.locator('[data-role="articulation-range-segment"][data-articulation-id="bow"]').first();
        const refreshedBowBox = await refreshedBowSegment.boundingBox();
        assert.notEqual(refreshedBowBox, null);
        const refreshedBowMaxHandle = refreshedBowSegment.locator('[data-role="articulation-range-resize-max"]').first();
        const refreshedBowMaxHandleBox = await refreshedBowMaxHandle.boundingBox();
        assert.notEqual(refreshedBowMaxHandleBox, null);
        await page.mouse.move(refreshedBowBox.x + refreshedBowBox.width * 0.5, refreshedBowBox.y + refreshedBowBox.height * 0.5);
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="articulation-range-segment"][data-articulation-id="bow"] [data-role="articulation-range-resize-max"]')
                ?.getAttribute("data-active") === "true"
        ));
        await page.mouse.move(
            refreshedBowMaxHandleBox.x + refreshedBowMaxHandleBox.width * 0.5,
            refreshedBowMaxHandleBox.y + refreshedBowMaxHandleBox.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(xForValue(23), refreshedBowBox.y + refreshedBowBox.height * 0.5, { steps: 4 });
        await page.mouse.up();

        const dragRightSnapshot = await waitForHarnessSnapshot(
            page,
            "shared boundary drag right shrinks the right range start and leaves the left range in place",
            (nextSnapshot) => {
                const assignments = readStoredArticulationEditorState(nextSnapshot).chainAssignments;
                return assignments.some((assignment) => (
                    assignment.articulationId === "bow"
                    && assignment.min === 0
                    && assignment.max === 20
                )) && assignments.some((assignment) => (
                    assignment.articulationId === "pluck"
                    && assignment.min === 23
                    && assignment.max === 42
                ));
            },
        );
        assert.deepEqual(readStoredArticulationEditorState(dragRightSnapshot).chainAssignments, [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 20 },
            { id: "chain-pluck", articulationId: "pluck", min: 23, max: 42 },
        ]);
    } finally {
        await page.close();
    }
});

test("contextual toolbar only exposes articulation draft actions", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });

        await page.evaluate(({ articulationStateKey, nextBank }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        await waitForHarnessSnapshot(
            page,
            "seeded articulation",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "bow",
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAPan", 0.25);
        });

        const toolbar = page.locator('[data-role="contextual-floating-toolbar"]');
        await toolbar.waitFor();
        assert.match(await toolbar.getAttribute("aria-label"), /Edited Bow/i);
        assert.doesNotMatch(
            await toolbar.textContent(),
            /save preset|save only|undo save|update and save|update \+ save/i,
            "the floating toolbar must not expose preset-save language",
        );
        const toolbarBox = await toolbar.boundingBox();
        assert.ok(toolbarBox && toolbarBox.height <= 44, "the floating toolbar must stay one row tall");
        const toolbarButtonRoles = await toolbar.locator("button").evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("data-role")).sort()
        ));
        assert.deepEqual(toolbarButtonRoles, [
            "contextual-revert-articulation",
            "contextual-save-new-articulation",
            "contextual-toolbar-dismiss",
            "contextual-update-articulation",
        ]);

        await page.locator('[data-role="contextual-update-articulation"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "updated articulation without synth-local preset baseline",
            (nextSnapshot) => {
                const storedBank = readStoredArticulationEditorState(nextSnapshot);
                return storedBank.slots[0].snapshot.parameters.pan === 0.25
                    && !containsRetiredSynthPresetBaselineKey(nextSnapshot);
            },
        );
        const storedBank = readStoredArticulationEditorState(snapshot);
        assert.equal(storedBank.slots[0].snapshot.parameters.pan, 0.25);
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
        await page.waitForFunction(() => !document.querySelector('[data-role="contextual-floating-toolbar"]'));
    } finally {
        await page.close();
    }
});

test("synth preset bar saves current synth state through shared effect presets", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        const seededBank = normalizeArticulationEditorState({
            selectedSlotId: "bright-bow",
            activeTriggerMode: "velocity",
            slots: [
                { id: "bright-bow", runtimeSlot: 0, name: "Bright Bow" },
            ],
            velocityAssignments: [
                { id: "vel-bright", articulationId: "bright-bow", min: 12, max: 34 },
            ],
        });
        const seededModulationState = normalizeModulationState(await page.evaluate(({
            articulationStateKey,
            defaultModulationState,
            nextBank,
        }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));

            const rawModulationState = harness.getSnapshot().storedState["modulation.v6"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : defaultModulationState;

            modulationState.msegSlots = Array.isArray(modulationState.msegSlots)
                ? modulationState.msegSlots
                : [];
            modulationState.envelopeSlots = Array.isArray(modulationState.envelopeSlots)
                ? modulationState.envelopeSlots
                : [];
            modulationState.msegSlots[0] = {
                ...(modulationState.msegSlots[0] ?? {}),
            };
            modulationState.envelopeSlots[1] = {
                ...(modulationState.envelopeSlots[1] ?? {}),
                name: "Sweep Env",
            };
            modulationState.routes = [{
                id: "preset-route-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "oscA.warpAmount",
                amount: 0.37,
                reducer: "max",
            }];
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
            harness.setParameterValue("mseg1Morph", 0.71);
            harness.setParameterValue("env2Attack", 0.21);
            harness.setParameterValue("env2Decay", 0.32);
            harness.setParameterValue("env2Sustain", 0.43);
            harness.setParameterValue("env2Release", 0.54);
            return modulationState;
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            defaultModulationState: createDefaultModulationState(),
            nextBank: editorBankToStoredArticulations(seededBank),
        }));

        await waitForHarnessSnapshot(
            page,
            "seeded non-default stored state before synth preset save",
            (nextSnapshot) => readStoredArticulationEditorState(nextSnapshot).selectedSlotId === "bright-bow"
                && Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.71) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.env2Attack) - 0.21) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.env2Release) - 0.54) <= 1e-9,
        );

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.25);
            harness.setParameterValue("filterCutoff", 2475);
            harness.setParameterValue("mseg1Morph", 0.33);
        });

        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Bright Test Synth");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared synth preset saved",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState[EFFECT_PRESETS_V2_STATE_KEY];
                if (!rawState || containsRetiredSynthPresetBaselineKey(nextSnapshot)) {
                    return false;
                }

                const state = JSON.parse(String(rawState));
                return Array.isArray(state.userPresets?.[SYNTH_PRESET_EFFECT_ID])
                    && state.userPresets[SYNTH_PRESET_EFFECT_ID].some((preset) => preset.label === "Bright Test Synth");
            },
        );

        const presetState = readEffectPresetState(snapshot);
        const savedPreset = presetState.userPresets[SYNTH_PRESET_EFFECT_ID].find((preset) => (
            preset.label === "Bright Test Synth"
        ));

        assert.ok(savedPreset, "shared preset state must contain the saved synth preset");
        assert.equal(savedPreset.kind, "cosimo.effectPreset");
        assert.equal(savedPreset.version, 2);
        assert.equal(savedPreset.effectID, SYNTH_PRESET_EFFECT_ID);
        const visibleEndpointIDs = await readVisibleHarnessParameterEndpointIDs(page);
        const savedParameterIDs = Object.keys(savedPreset.parameters).sort((left, right) => left.localeCompare(right));
        assert.deepEqual(
            savedParameterIDs,
            visibleEndpointIDs,
            "saved synth presets must capture the complete visible Cmajor parameter contract",
        );
        for (const endpointID of visibleEndpointIDs) {
            assert.equal(
                savedPreset.parameters[endpointID],
                snapshot.parameterValues[endpointID],
                `saved parameter ${endpointID} must match the live value`,
            );
        }
        assert.equal(snapshot.parameterValues.hiddenSynthPresetGuard, 0.42);
        assert.equal("hiddenSynthPresetGuard" in savedPreset.parameters, false);
        assert.equal("midiIn" in savedPreset.parameters, false);
        assert.equal("runtimeState" in savedPreset.parameters, false);
        assert.equal("effectiveWarpState" in savedPreset.parameters, false);
        assert.equal(
            Object.keys(savedPreset.parameters).some((endpointID) => endpointID.startsWith("effective")),
            false,
            "saved synth presets must only contain real parameters, not runtime display endpoints",
        );
        assert.deepEqual(
            Object.keys(savedPreset.storedState).sort((left, right) => left.localeCompare(right)),
            [ARTICULATION_STATE_KEY, BOUNCE_STATE_KEY, "modulation.v6"],
            "saved synth presets must capture only the required stored-state adapters",
        );
        assert.equal(savedPreset.storedState[BOUNCE_STATE_KEY], null);
        assert.deepEqual(
            savedPreset.storedState[ARTICULATION_STATE_KEY],
            editorBankToStoredArticulations(seededBank),
            "saved synth presets must include the actual non-default articulation bank",
        );
        const savedModulationState = deserializeModulationState(savedPreset.storedState["modulation.v6"]);
        assert.equal(savedPreset.parameters.mseg1Morph, 0.33);
        assert.equal(savedPreset.parameters.env2Attack, 0.21);
        assert.equal(savedPreset.parameters.env2Decay, 0.32);
        assert.equal(savedPreset.parameters.env2Sustain, 0.43);
        assert.equal(savedPreset.parameters.env2Release, 0.54);
        assert.equal("morph" in savedModulationState.msegSlots[0], false);
        assert.deepEqual(savedModulationState.envelopeSlots[1], { name: "Sweep Env" });
        assert.equal("attackSeconds" in savedModulationState.envelopeSlots[1], false);
        assert.deepEqual(
            routeSummary(savedModulationState.routes[0]),
            routeSummary(seededModulationState.routes[0]),
            "saved synth presets must include the actual non-default modulation state",
        );
        assert.deepEqual(presetState.activePresetByEffect[SYNTH_PRESET_EFFECT_ID], {
            presetID: savedPreset.presetID,
            label: "Bright Test Synth",
            dirty: false,
        });
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
    } finally {
        await page.close();
    }
});

test("synth preset bar marks edits dirty and reverts without synth-local baseline state", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.12);
            harness.setParameterValue("oscAWavetableSelect", 3);
            harness.setParameterValue("oscBPan", -0.34);
            harness.setParameterValue("oscBWavetableSelect", 7);
            harness.setParameterValue("oscCPan", 0.56);
            harness.setParameterValue("oscCWavetableSelect", 11);
            harness.setParameterValue("filterCutoff", 2475);
            harness.setParameterValue("mseg1Morph", 0.33);
        });

        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Revert Test Synth");
        await waitForPresetBarDirtyState(page, false);

        await page.evaluate(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAPan", 0.77);
            harness.setParameterValue("oscAWavetableSelect", 13);
            harness.setParameterValue("oscBPan", 0.78);
            harness.setParameterValue("oscBWavetableSelect", 17);
            harness.setParameterValue("oscCPan", -0.79);
            harness.setParameterValue("oscCWavetableSelect", 19);
            harness.setParameterValue("filterCutoff", 8200);
        });

        await waitForPresetBarDirtyState(page, true);
        await clickPresetBarAction(page, "revert");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "shared synth preset reverted",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.oscAPan) - 0.12) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscAWavetableSelect) === 3
                && Math.abs(Number(nextSnapshot.parameterValues.oscBPan) + 0.34) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscBWavetableSelect) === 7
                && Math.abs(Number(nextSnapshot.parameterValues.oscCPan) - 0.56) <= 1e-9
                && Number(nextSnapshot.parameterValues.oscCWavetableSelect) === 11
                && Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 2475) <= 1e-9
                && Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.33) <= 1e-9
                && !containsRetiredSynthPresetBaselineKey(nextSnapshot)
                && readEffectPresetState(nextSnapshot).activePresetByEffect[SYNTH_PRESET_EFFECT_ID]?.dirty === false,
        );

        assert.equal(Number(snapshot.parameterValues.oscAPan), 0.12);
        assert.equal(Number(snapshot.parameterValues.oscAWavetableSelect), 3);
        assert.equal(Number(snapshot.parameterValues.oscBPan), -0.34);
        assert.equal(Number(snapshot.parameterValues.oscBWavetableSelect), 7);
        assert.equal(Number(snapshot.parameterValues.oscCPan), 0.56);
        assert.equal(Number(snapshot.parameterValues.oscCWavetableSelect), 11);
        assert.equal(Number(snapshot.parameterValues.filterCutoff), 2475);
        assert.equal(Number(snapshot.parameterValues.mseg1Morph), 0.33);
        assert.equal(containsRetiredSynthPresetBaselineKey(snapshot), false);
    } finally {
        await page.close();
    }
});

test("synth presets restore mapping dependencies before strict articulation route amounts", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => Boolean(document.querySelector("cosimo-preset-bar")?.shadowRoot));

        const routeId = "preset-dependent-route";
        const seededBank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: "mapped-bow",
            activeTriggerMode: "chain",
            slots: [{
                id: "mapped-bow",
                runtimeSlot: 0,
                name: "Mapped Bow",
                color: "test-mapped-bow",
                key: 0,
                velRange: { min: 1, max: 1 },
                chainRange: { min: 0, max: 0 },
                overrides: {},
                routeAmounts: { [routeId]: 0.63 },
            }],
        };

        await page.evaluate(({ defaultModulationState, nextRouteId }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue("modulation.v6", JSON.stringify({
                ...defaultModulationState,
                routes: [{
                    id: nextRouteId,
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "bipolar",
                    targetKind: "oscA.warpAmount",
                    amount: 0.37,
                    reducer: "max",
                }],
            }));
        }, {
            defaultModulationState: createDefaultModulationState(),
            nextRouteId: routeId,
        });

        await waitForHarnessSnapshot(
            page,
            "accepted prerequisite mapping",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && Number(latestRuntimeProgram(snapshot)?.voiceRouteCount) === 1,
        );
        await page.evaluate(({ articulationStateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(articulationStateKey, JSON.stringify(nextBank));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            nextBank: seededBank,
        });

        await waitForHarnessSnapshot(
            page,
            "seeded dependent mapping and articulation",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && readStoredArticulationEditorState(snapshot).slots[0]?.snapshot.modRouteAmounts[0]?.routeId === routeId,
        );
        await page.locator('[data-role="articulation-card"][data-articulation-id="mapped-bow"]').waitFor();
        await waitForReactFrames(page, 3);
        await saveSynthPresetAs(page, "Mapped Articulation Test");
        await waitForPresetBarDirtyState(page, false);

        await page.evaluate(({ articulationStateKey, emptyArticulations }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setStoredStateValue(articulationStateKey, JSON.stringify(emptyArticulations));
            const modulationState = JSON.parse(String(harness.getSnapshot().storedState["modulation.v6"]));
            harness.setStoredStateValue("modulation.v6", JSON.stringify({ ...modulationState, routes: [] }));
        }, {
            articulationStateKey: ARTICULATION_STATE_KEY,
            emptyArticulations: {
                format: "cosimo.articulations",
                version: 4,
                selectedSlotId: null,
                activeTriggerMode: "chain",
                slots: [],
            },
        });

        await waitForPresetBarDirtyState(page, true);
        await clickPresetBarAction(page, "revert");

        const restored = await waitForHarnessSnapshot(
            page,
            "restored dependent mapping and articulation",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId
                && readStoredArticulationEditorState(snapshot).slots[0]?.snapshot.modRouteAmounts[0]?.routeId === routeId,
        );
        assert.equal(readStoredArticulationEditorState(restored).slots[0].snapshot.modRouteAmounts[0].amount, 0.63);
        await waitForPresetBarDirtyState(page, false);
    } finally {
        await page.close();
    }
});

test("collapsed articulation cards scroll without clipping the voice tab or row controls", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 760, height: 720 });
        },
    });

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "slot-0",
            activeTriggerMode: "chain",
            slots: Array.from({ length: 16 }, (_, index) => ({
                id: `slot-${index}`,
                runtimeSlot: index,
                name: `Articulation ${index}`,
            })),
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="slot-15"]').waitFor();

        const layout = await page.evaluate(() => {
            const row = document.querySelector('[data-role="keyboard-control-row"]');
            const surface = document.querySelector('[data-role="articulation-control-surface"]');
            const carousel = document.querySelector('[data-role="articulation-card-carousel"]');
            const voiceTab = document.querySelector('[data-role="keyboard-control-mode-voice"]');

            if (!row || !surface || !carousel || !voiceTab) {
                throw new Error("Articulation control layout is missing.");
            }

            const rowBox = row.getBoundingClientRect();
            const surfaceBox = surface.getBoundingClientRect();
            const voiceBox = voiceTab.getBoundingClientRect();

            return {
                rowWidth: rowBox.width,
                surfaceRight: surfaceBox.right,
                rowRight: rowBox.right,
                voiceRight: voiceBox.right,
                carouselClientWidth: carousel.clientWidth,
                carouselScrollWidth: carousel.scrollWidth,
            };
        });

        assert.ok(layout.voiceRight <= layout.rowRight + 0.5, "the Voice tab must stay inside the controls row");
        assert.ok(layout.surfaceRight <= layout.rowRight + 0.5, "the articulation row must not expand beyond its parent");
        assert.ok(
            layout.carouselScrollWidth > layout.carouselClientWidth,
            "extra articulation cards should scroll inside the carousel instead of widening the row",
        );
    } finally {
        await page.close();
    }
});

// Retired 2026-08-19 with T05: the narrow (`sm:hidden`) articulation range-row
// list was the compact presentation of the expanded editor, and the compact
// articulation pane left mobile entirely — no shipping viewport reaches those
// rows any more. The row-click replace contract returns with the T05A mobile
// articulation redesign; desktop lane behavior stays covered by the range
// click/drag/resize tests above.

test("articulation card audition is press-hold and follows the most recently played note", async () => {
    const page = await openHarnessPage();

    async function pressAuditionAndExpect(note) {
        await clearHarnessDebugLog(page);

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        const box = await playButton.boundingBox();
        assert.notEqual(box, null);

        const clickPromise = playButton.click({ delay: 200 });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
        ]);

        await clickPromise;
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, note, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, note) },
        ]);
    }

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });

        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });
        await page.locator('[data-role="articulation-card"][data-articulation-id="bow"]').waitFor();

        await clearHarnessDebugLog(page);
        await page.keyboard.down("g");
        await page.keyboard.up("g");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 43, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 43) },
        ]);

        await pressAuditionAndExpect(43);
        await pressAuditionAndExpect(43);

        await clearHarnessDebugLog(page);
        await page.keyboard.down("k");
        await page.keyboard.up("k");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);
        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
        ]);

        await pressAuditionAndExpect(48);
    } finally {
        await page.close();
    }
});

test("articulation card audition survives a platform pointer-capture rejection", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });
        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        await playButton.waitFor();
        await playButton.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        await playButton.dispatchEvent("pointerdown", {
            pointerId: 79,
            pointerType: "touch",
            button: 0,
            buttons: 1,
        });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1);
        await playButton.dispatchEvent("pointerup", {
            pointerId: 79,
            pointerType: "touch",
            button: 0,
            buttons: 0,
        });
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2);

        assert.deepEqual((await getHarnessSnapshot(page)).midiInputEvents, [
            { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
            { endpointID: "midiIn", value: buildShortMidi(0x80, 60) },
        ]);
    } finally {
        await page.close();
    }
});

test("articulation card audition releases exactly once across browser leave signals", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });
        const bank = normalizeArticulationEditorState({
            selectedSlotId: "bow",
            activeTriggerMode: "chain",
            slots: [
                { id: "bow", runtimeSlot: 0, name: "Bow" },
            ],
        });
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: editorBankToStoredArticulations(bank),
        });

        const playButton = page.locator('[data-role="articulation-card-play"]').first();
        await playButton.waitFor();
        await playButton.scrollIntoViewIfNeeded();
        const box = await playButton.boundingBox();
        assert.ok(box, "Expected the articulation audition button to be visible.");
        await page.mouse.move(box.x + (box.width * 0.5), box.y + (box.height * 0.5));
        const assertRelease = async (events) => {
            await clearHarnessDebugLog(page);
            await page.mouse.down();
            await page.waitForFunction(() => (
                window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
            ));
            await page.evaluate((eventNames) => {
                for (const eventName of eventNames) window.dispatchEvent(new Event(eventName));
            }, events);
            await page.waitForTimeout(100);
            assert.deepEqual((await getHarnessSnapshot(page)).midiInputEvents, [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 60, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 60) },
            ]);
            await page.mouse.up();
        };

        await assertRelease(["blur"]);
        await assertRelease(["cosimo-browser-audio-leave", "blur"]);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("opening the synth GUI does not recall or overwrite a stored selected articulation", async () => {
    const parameterEndpoints = [
        "oscAWavetablePosition",
        "playMode",
        "glideTime",
        "oscAPan",
        "oscAWarpMode",
        "oscAWarpAmount",
        "filterMode",
        "filterCutoff",
        "filterQ",
        "mseg1Morph",
        "distortionMode",
        "distortionWet",
        "chorusMix",
    ];
    const liveParameters = {
        wavetablePosition: 0.11,
        playMode: 2,
        glideTime: 0.04,
        pan: -0.31,
        warpMode: 1,
        warpAmount: 0.18,
        filterMode: 4,
        filterCutoff: 8765,
        filterQ: 7.25,
        mseg1Morph: 0.22,
        distortionMode: 1,
        distortionWet: 0.37,
        chorusMix: 0.48,
    };
    const storedBank = normalizeArticulationEditorState({
        selectedSlotId: "articulation-0",
        slots: [{
            id: "articulation-0",
            runtimeSlot: 0,
            name: "Art 1",
            snapshot: {
                parameters: {
                    wavetablePosition: 0.88,
                    playMode: 1,
                    glideTime: 0.33,
                    pan: 0.42,
                    warpMode: 3,
                    warpAmount: 0.77,
                    filterMode: 2,
                    filterCutoff: 2345,
                    filterQ: 2.5,
                    msegMorphs: [0.91, 0, 0],
                    distortionMode: 0,
                    distortionWet: 0.12,
                    chorusMix: 0.16,
                },
            },
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(({ stateKey, bank, parameters }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    parameterValues: parameters,
                    storedState: {
                        [stateKey]: JSON.stringify(bank),
                    },
                };
            }, {
                stateKey: ARTICULATION_STATE_KEY,
                bank: editorBankToStoredArticulations(storedBank),
                parameters: liveParameters,
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            document.querySelector('[data-role="articulation-card"][data-runtime-slot="0"]') instanceof HTMLElement
        ));
        await waitForReactFrames(page, 4);

        const snapshot = await getHarnessSnapshot(page);
        for (const [endpointID, expectedValue] of Object.entries(liveParameters)) {
            assert.equal(
                Number(snapshot.parameterValues[endpointID]),
                expectedValue,
                `${endpointID} should keep the host/current value when the GUI opens`,
            );
        }

        const hydratedBank = readStoredArticulationEditorState(snapshot);
        assert.equal(hydratedBank.selectedSlotId, "articulation-0");
        assert.equal(hydratedBank.slots[0].snapshot.parameters.wavetablePosition, 0.88);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.warpAmount, 0.77);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.filterCutoff, 2345);
        assert.equal(hydratedBank.slots[0].snapshot.parameters.msegMorphs[0], 0.91);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => parameterEndpoints.includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [],
        );
    } finally {
        await page.close();
    }
});

test("desktop envelope editor drags handles and commits compact rail values for the selected slot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.locator('input[aria-label="Pan"]').count(), 1);
        assert.equal(await page.locator('[data-role="wavetable-pan-field"]').count(), 1);
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        assert.equal(
            await page.locator('input[aria-label="Envelope decay value"]').evaluate((element) => getComputedStyle(element).textAlign),
            "left",
        );

        const initialParameters = (await getHarnessSnapshot(page)).parameterValues;

        await dragEnvelopeHandleBy(page, "adsr-attack-handle-hit-target", 110, 0);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "envelope attack drag updates slot 2",
            (nextSnapshot) => {
                return Number(nextSnapshot.parameterValues.env2Attack) > 0.08
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Attack) - 0.01) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Attack"
                        && Number(value) > 0.08
                    ));
            },
        );

        assert.equal(Number(snapshot.parameterValues.env2Attack) > 0.08, true);
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Attack) - 0.01) <= 1e-9, true);

        const parametersAfterAttack = snapshot.parameterValues;

        await dragEnvelopeHandleBy(page, "adsr-decay-sustain-handle-hit-target", 160, 70);

        snapshot = await waitForHarnessSnapshot(
            page,
            "decay-sustain handle drag updates decay horizontally and sustain vertically for slot 2",
            (nextSnapshot) => {
                return Math.abs(Number(nextSnapshot.parameterValues.env2Decay) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02
                    && Math.abs(Number(nextSnapshot.parameterValues.env2Sustain) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Decay) - 0.25) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.env1Sustain) - 0.5) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Decay"
                        && Math.abs(Number(value) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02
                    ))
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Sustain"
                        && Math.abs(Number(value) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05
                    ));
            },
        );

        assert.equal(
            Math.abs(Number(snapshot.parameterValues.env2Decay) - Number(parametersAfterAttack.env2Decay ?? initialParameters.env2Decay ?? 0.25)) > 0.02,
            true,
        );
        assert.equal(
            Math.abs(Number(snapshot.parameterValues.env2Sustain) - Number(parametersAfterAttack.env2Sustain ?? initialParameters.env2Sustain ?? 0.5)) > 0.05,
            true,
        );
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Decay) - 0.25) <= 1e-9, true);
        assert.equal(Math.abs(Number(snapshot.parameterValues.env1Sustain) - 0.5) <= 1e-9, true);

        const releaseInput = page.locator('input[aria-label="Envelope release value"]');
        await releaseInput.focus();
        await releaseInput.fill("800 ms");
        await releaseInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "compact release field commits milliseconds for slot 2",
            (nextSnapshot) => {
                return Math.abs(Number(nextSnapshot.parameterValues.env2Release) - 0.8) <= 1e-9
                    && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                        endpointID === "env2Release"
                        && Math.abs(Number(value) - 0.8) <= 1e-9
                    ));
            },
        );

        assert.equal(Math.abs(Number(snapshot.parameterValues.env2Release) - 0.8) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("desktop envelope exact entry preserves the focused draft across a host echo", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        const attackInput = page.locator('input[aria-label="Envelope attack value"]');
        await attackInput.focus();
        await attackInput.fill("250 ms");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("env2Attack", 0.9);
        });
        await page.waitForFunction(() => {
            return Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.env2Attack) - 0.9) <= 1e-9;
        });

        assert.equal(await attackInput.inputValue(), "250 ms");
        await attackInput.press("Enter");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "focused envelope draft committed after host echo",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.env2Attack) - 0.25) <= 1e-9,
        );
        assert.equal(snapshot.parameterValues.env2Attack, 0.25);
    } finally {
        await page.close();
    }
});

test("envelope bare exact values use the displayed unit and keep that unit visible", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("env2Attack", 0.008, true);
        });
        const attackInput = page.locator('input[aria-label="Envelope attack value"]');
        await page.waitForFunction(() => (
            document.querySelector('input[aria-label="Envelope attack value"]')?.value === "8 ms"
        ));
        await attackInput.focus();
        assert.equal(await attackInput.inputValue(), "8");
        assert.equal(
            (await attackInput.locator("xpath=following-sibling::*[@data-role='parameter-entry-unit']").textContent()).trim(),
            "ms",
        );
        await attackInput.fill("5");
        await attackInput.press("Enter");

        const snapshot = await waitForHarnessSnapshot(
            page,
            "bare envelope value commits in the displayed milliseconds",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.env2Attack) - 0.005) <= 1e-9,
        );
        assert.equal(snapshot.parameterValues.env2Attack, 0.005);
    } finally {
        await page.close();
    }
});

test("desktop envelope handle stops editing after the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("button", { name: "Select envelope 2" }).click();
        const handle = page.locator('[data-role="adsr-attack-handle-hit-target"]');
        await handle.scrollIntoViewIfNeeded();
        const handleBox = await handle.boundingBox();
        assert.ok(handleBox, "Expected the ADSR attack handle to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(handleBox.x + (handleBox.width * 0.5), handleBox.y + (handleBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.move(handleBox.x + handleBox.width + 120, handleBox.y + (handleBox.height * 0.5));
        await page.mouse.up();
        await page.waitForTimeout(100);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "env2Attack"),
            false,
        );
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("desktop wavetable stage follows live effective warp state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.stageDebug && typeof rendered.stageDebug.warpMode === "number";
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAWarpMode", 1);
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAWarpAmount", 0.18);
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 4,
                amount: 0.82,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 4
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.82) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveWarpState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 3,
                amount: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 4);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.82) <= 1e-9, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveWarpState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                amount: 0.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return Number(rendered.stageDebug?.warpMode) === 1
                && Math.abs(Number(rendered.stageDebug?.warpAmount) - 0.18) <= 1e-9;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.stageDebug.warpMode, 1);
        assert.equal(Math.abs(renderedState.stageDebug.warpAmount - 0.18) <= 1e-9, true);
    } finally {
        await page.close();
    }
});

test("filter controls commit mode, cutoff, and Q, and the matrix can route MSEG 1 into filter cutoff", async () => {
    const page = await openHarnessPage();

    try {
        await clearHarnessDebugLog(page);
        const filterModeChip = page.locator('button[aria-label^="Cycle filter mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode));

        for (let guard = 0; guard < 8 && currentMode !== 4; guard += 1) {
            await filterModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "filter mode cycling",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 4);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffField = page.locator('[data-role="filter-cutoff-field"]');
        await dragLocatorBy(page, filterCutoffField, 18, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterCutoffInput = page.locator('input[aria-label="Filter cutoff"]');
        await filterCutoffInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter cutoff"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterCutoffInput, 1210);
        await filterCutoffInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter cutoff commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 1210) <= 1
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Math.abs(Number(value) - 1210) <= 1),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceField = page.locator('[data-role="filter-resonance-field"]');
        await dragLocatorBy(page, filterResonanceField, 10, 0);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterQ) > 0.8;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.8),
            true,
        );

        await clearHarnessDebugLog(page);
        const filterResonanceInput = page.locator('input[aria-label="Filter resonance"]');
        await filterResonanceInput.dblclick();
        await page.waitForFunction(() => {
            const input = document.querySelector('input[aria-label="Filter resonance"]');
            return input instanceof HTMLInputElement && input.readOnly === false;
        });
        await dispatchInputValueChange(filterResonanceInput, 7.5);
        await filterResonanceInput.blur();

        snapshot = await waitForHarnessSnapshot(
            page,
            "typed filter resonance commit",
            (nextSnapshot) => (
                Math.abs(Number(nextSnapshot.parameterValues.filterQ) - 7.5) <= 0.01
                && nextSnapshot.sentMessages.some(({ endpointID, value }) => (
                    endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01
                ))
            ),
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Math.abs(Number(value) - 7.5) <= 0.01),
            true,
        );

        await ensureFirstModulationRoute(page);
        await choosePrototypeSelectOption(page, "Route 1 target", "CUTOFF");
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await dragLocatorBy(page, page.locator('[aria-label="Route 1 amount"]'), 0, 20);

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 modulating filter cutoff",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "filterCutoffOctaves"
                    && route?.polarity === "bipolar"
                    && Math.abs(Number(route.amount) - (-1.0)) <= 0.08;
            },
        );

        const finalRoute = readStoredModulationState(snapshot).routes[0];
        assert.deepEqual(routeSummary(finalRoute), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "filterCutoffOctaves",
            amount: finalRoute.amount,
        });
        assert.deepEqual(readRuntimeProgramRoute(snapshot, finalRoute), {
            path: "voice",
            cellIndex: 30,
            sourceIndex: 0,
            targetIndex: 30,
            polarityKind: 1,
        });
        assert.equal(hasRuntimeAmount(snapshot, finalRoute, finalRoute.amount, 0.001), true);
        const cutoffAmountReadout = page.locator('[data-role="route-row-1"] >> text=/±1\\.00 oct/');
        await cutoffAmountReadout.waitFor({ state: "visible" });
        assert.equal((await cutoffAmountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("desktop filter graph follows live effective filter state and falls back to the base controls", async () => {
    const page = await openHarnessPage();

    try {
        const filterCard = page.locator('[data-role="filter-card"]');
        const filterGraph = page.locator('[data-role="filter-response-graph"]');
        const filterHandle = page.locator('[data-role="filter-response-handle-hit-target"]');
        const filterCardBox = await filterCard.boundingBox();
        const filterGraphBox = await filterGraph.boundingBox();
        const filterHandleBox = await filterHandle.boundingBox();

        assert.ok(filterCardBox, "Expected filter card bounding box.");
        assert.ok(filterGraphBox, "Expected filter graph bounding box.");
        assert.ok(filterHandleBox, "Expected filter response handle bounding box.");
        assert.ok((filterGraphBox.width / filterCardBox.width) >= 0.9);
        assert.ok((filterGraphBox.height / filterCardBox.height) >= 0.9);
        assert.equal(await filterCard.getByText("Analyzer View", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Live Response", { exact: true }).count(), 0);
        assert.equal(await filterCard.getByText("Filter", { exact: true }).count(), 0);

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.base && rendered.filterGraphState.live;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);

        await clearHarnessDebugLog(page);
        await clickFilterGraphAt(page, 0.06, 0.08);
        await page.waitForTimeout(100);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff" || endpointID === "filterQ"),
            false,
        );

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 96, -54);

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.filterCutoff) > 1000
                && Number(snapshot.parameterValues.filterQ) > 0.707107;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterCutoff" && Number(value) > 1000),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "filterQ" && Number(value) > 0.707107),
            true,
        );

        await dragFilterHandleBy(page, 0, 420);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 0.1) <= 0.05);

        await dragFilterHandleBy(page, 0, -1200);

        await page.waitForFunction(() => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            if (!harness) {
                return false;
            }

            const snapshot = harness.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.ok(Math.abs(Number(snapshot.parameterValues.filterQ) - 20) <= 0.2);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 7,
                hasActive: true,
                mode: 3,
                cutoffHz: 2800,
                q: 5.5,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === true
                && Number(rendered.filterGraphState?.live?.mode) === 3
                && Math.abs(Number(rendered.filterGraphState?.live?.cutoffHz) - 2800) <= 1;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("effectiveFilterState", {
                voiceGeneration: 9,
                hasActive: 1,
                mode: 1,
                cutoffHz: "broken",
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, true);
        assert.equal(renderedState.filterGraphState.live.mode, 3);
        assert.equal(Math.abs(renderedState.filterGraphState.live.cutoffHz - 2800) <= 1, true);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveFilterState({
                voiceGeneration: 8,
                hasActive: false,
                mode: 0,
                cutoffHz: 1000,
                q: 0.707107,
            });
        });

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState?.live?.hasActive === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.live.hasActive, false);
    } finally {
        await page.close();
    }
});

test("desktop filter graph closes both host gestures when the window blurs mid-drag", async () => {
    const page = await openHarnessPage();

    try {
        const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
        await handle.scrollIntoViewIfNeeded();
        const bounds = await handle.boundingBox();
        assert.ok(bounds);
        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        await clearHarnessDebugLog(page);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 24, startY - 18, { steps: 4 });
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.gestureStarts.includes("filterCutoff")
                && snapshot.gestureStarts.includes("filterQ");
        });

        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.waitForTimeout(20);
        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureEnds, ["filterCutoff", "filterQ"]);
        await page.mouse.up();
    } finally {
        await page.close();
    }
});

test("desktop filter graph keeps tracking touch when pointer capture is unavailable", async () => {
    const page = await openHarnessPage();

    try {
        const graph = page.locator('[data-role="filter-response-graph"]');
        const handle = page.locator('[data-role="filter-response-handle-hit-target"]');
        const bounds = await handle.boundingBox();
        assert.ok(bounds);
        await graph.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointerId = 96;
        const start = {
            x: bounds.x + (bounds.width / 2),
            y: bounds.y + (bounds.height / 2),
        };
        const moved = { x: start.x + 80, y: start.y - 40 };
        await handle.dispatchEvent("pointerdown", {
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
            "capture-free filter graph touch move",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("filterCutoff")
                && nextSnapshot.gestureStarts.includes("filterQ")
                && nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "filterCutoff"),
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
            "capture-free filter graph touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("filterCutoff")
                && nextSnapshot.gestureEnds.includes("filterQ"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["filterCutoff", "filterQ"]);
    } finally {
        await page.close();
    }
});

test("desktop filter graph cycles graph, bars, and round-bars analyzers while keeping live spectrum updates sane", async () => {
    const page = await openHarnessPage();

    try {
        const analyzerModeChip = page.locator('button[aria-label^="Cycle analyzer view"]').first();

        await page.waitForFunction(() => {
            const rendered = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return rendered.filterGraphState && rendered.filterGraphState.spectrum;
        });

        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.hasSpectrum, false);

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 2 ? 0.03 : index === 3 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.hasSpectrum === true
                && Array.isArray(spectrum?.bandMagnitudesDb)
                && spectrum.bandMagnitudesDb.length > 0;
        });

        renderedState = await getHarnessRenderedState(page);
        const lowHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.equal(lowHeavySpectrum.hasSpectrum, true);
        assert.equal(lowHeavySpectrum.renderMode, "graph");
        assert.equal(lowHeavySpectrum.sourceBinCount, 64);
        assert.equal(lowHeavySpectrum.bandCount, 120);
        assert.ok(lowHeavySpectrum.graphPointCount > lowHeavySpectrum.bandCount);
        assert.equal(lowHeavySpectrum.bandMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.smoothedMagnitudesDb.length, 120);
        assert.equal(lowHeavySpectrum.peakMagnitudesDb.length, 120);
        assert.deepEqual(lowHeavySpectrum.renderGeometry, {
            kind: "graph",
            pointCount: lowHeavySpectrum.graphPointCount,
            peakPointCount: lowHeavySpectrum.graphPointCount,
        });
        assert.deepEqual(
            lowHeavySpectrum.frequencyTicks.map(({ label }) => label),
            ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k"],
        );
        assert.deepEqual(
            lowHeavySpectrum.dbTicks.map(({ label }) => label),
            ["-18", "-36", "-54", "-72", "-90"],
        );
        assert.ok(Math.max(...lowHeavySpectrum.bandMagnitudesDb) > Math.min(...lowHeavySpectrum.bandMagnitudesDb));
        const previousBandMagnitudesDb = [...lowHeavySpectrum.bandMagnitudesDb];
        const previousSmoothedMagnitudesDb = [...lowHeavySpectrum.smoothedMagnitudesDb];

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEndpoint("filterSpectrum", {
                sampleRateHz: "broken",
                magnitudes: [1, 2, 3, 4, 5, 6, 7, 8],
            });
        });
        await page.waitForTimeout(50);

        renderedState = await getHarnessRenderedState(page);
        assert.deepEqual(renderedState.filterGraphState.spectrum, lowHeavySpectrum);

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === false;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: false,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "round-bars" && spectrum?.renderGeometry?.kind === "bars" && spectrum?.renderGeometry?.rounded === true;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.spectrum.renderMode, "round-bars");
        assert.deepEqual(renderedState.filterGraphState.spectrum.renderGeometry, {
            kind: "bars",
            barCount: renderedState.filterGraphState.spectrum.bandCount,
            rounded: true,
        });

        await analyzerModeChip.click();
        await page.waitForFunction(() => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            return spectrum?.renderMode === "graph" && spectrum?.renderGeometry?.kind === "graph";
        });

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.03 : index === 58 ? 0.022 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, previousBandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const highHeavySpectrum = renderedState.filterGraphState.spectrum;
        assert.notDeepEqual(highHeavySpectrum.bandMagnitudesDb, previousBandMagnitudesDb);
        assert.notDeepEqual(highHeavySpectrum.smoothedMagnitudesDb, previousSmoothedMagnitudesDb);
        assert.equal(highHeavySpectrum.renderMode, "graph");
        assert.equal(highHeavySpectrum.renderGeometry.kind, "graph");

        await page.evaluate(() => {
            const magnitudes = Array.from({ length: 64 }, (_, index) => (
                index === 60 ? 0.009 : index === 58 ? 0.006 : 1e-5
            ));
            window.__COSIMO_DESKTOP_HARNESS__.emitFilterSpectrum({
                sampleRateHz: 44_100,
                magnitudes,
            });
        });

        await page.waitForFunction((previousSpectrum) => {
            const spectrum = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.spectrum;
            if (!spectrum?.hasSpectrum) {
                return false;
            }

            return JSON.stringify(spectrum.bandMagnitudesDb) !== JSON.stringify(previousSpectrum);
        }, highHeavySpectrum.bandMagnitudesDb);

        renderedState = await getHarnessRenderedState(page);
        const decayingSpectrum = renderedState.filterGraphState.spectrum;
        const peakBandIndex = highHeavySpectrum.peakBandIndex;
        assert.ok(decayingSpectrum.smoothedMagnitudesDb[peakBandIndex] > decayingSpectrum.bandMagnitudesDb[peakBandIndex]);
        assert.ok(decayingSpectrum.peakMagnitudesDb[peakBandIndex] >= decayingSpectrum.smoothedMagnitudesDb[peakBandIndex]);
    } finally {
        await page.close();
    }
});

test("keyboard octave controls update the mounted keyboard root note and note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await page.click('button[aria-label="Shift keyboard up one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "48");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 48, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 48) },
            ],
        );

        await page.click('button[aria-label="Shift keyboard down one octave"]');
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("z and x shift the mounted keyboard octave without forwarding those keys to note routing", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const renderedState = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState();
            return renderedState.keyboardRootNote === "36" && renderedState.keyboardNoteCount === "25";
        });

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("z");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "24");

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 24, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 24) },
            ],
        );

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.press("x");
        await page.waitForFunction(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === "36");

        keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.click("text=Cosimo Synth");
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await page.waitForFunction(() => {
            const nextSnapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return nextSnapshot.midiInputEvents.length === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("keyboard octave buttons disable at the configured minimum and maximum root notes", async () => {
    const page = await openHarnessPage();

    try {
        const upButton = page.locator('button[aria-label="Shift keyboard up one octave"]');
        const downButton = page.locator('button[aria-label="Shift keyboard down one octave"]');

        for (const expectedRootNote of ["48", "60", "72"]) {
            await upButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await upButton.isDisabled(), true);
        assert.equal(await downButton.isDisabled(), false);

        for (const expectedRootNote of ["60", "48", "36", "24", "12"]) {
            await downButton.click();
            await page.waitForFunction((nextRootNote) => {
                return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardRootNote === nextRootNote;
            }, expectedRootNote);
        }

        assert.equal(await downButton.isDisabled(), true);
        assert.equal(await upButton.isDisabled(), false);
    } finally {
        await page.close();
    }
});

test("MSEG editor wiring can open, add a point, move it, and close with Escape", async () => {
    const page = await openHarnessPage();

    try {
        await page.click('button[aria-label="Open MSEG editor"]');
        await page.waitForSelector('[data-role="mseg-editor-dialog"]');

        const presetBarHost = page.locator('[data-role="synth-preset-bar-host"]');
        assert.equal(
            await presetBarHost.evaluate((element) => getComputedStyle(element).display),
            "none",
            "The preset bar must not cover the full-screen MSEG editor.",
        );

        const surface = page.locator('svg[data-role="mseg-editor-surface"]');
        const box = await surface.boundingBox();
        assert.ok(box);

        const addPointX = box.x + (box.width * 0.5);
        const addPointY = box.y + (box.height * 0.25);

        await clearHarnessDebugLog(page);
        await page.mouse.click(addPointX, addPointY);

        let snapshot = await waitForHarnessSnapshot(
            page,
            "added MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 3,
        );
        let points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        const addedPoint = { ...points[1] };
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        const addedPointCircle = surface.locator("circle").nth(1);
        const addedPointBox = await addedPointCircle.boundingBox();
        assert.ok(addedPointBox);
        const addedPointCenterX = addedPointBox.x + (addedPointBox.width * 0.5);
        const addedPointCenterY = addedPointBox.y + (addedPointBox.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(addedPointCenterX, addedPointCenterY);
        await page.mouse.down();
        await page.mouse.move(addedPointCenterX + 40, addedPointCenterY - 48, { steps: 6 });
        await page.mouse.up();

        snapshot = await waitForHarnessSnapshot(
            page,
            "moved MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points[1]?.x > 0.5,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 3);
        assert.equal(points[0].x, 0);
        assert.equal(points[0].y, 0);
        assert.equal(points[2].x, 1);
        assert.equal(points[2].y, 1);
        assert.equal(points[0].x < points[1].x && points[1].x < points[2].x, true);
        assert.equal(points[1].x > addedPoint.x, true);
        assert.equal(points[1].y > addedPoint.y, true);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(1).click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "deleted MSEG point",
            (nextSnapshot) => readStoredMsegShape(nextSnapshot).points.length === 2,
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assertLatestMsegBufferMatchesStoredShape(snapshot);

        await clearHarnessDebugLog(page);
        await surface.locator("circle").nth(0).click();
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        }));
        snapshot = await getHarnessSnapshot(page);
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points.length, 2);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );

        await page.keyboard.press("Escape");
        await page.waitForSelector('[data-role="mseg-editor-dialog"]', { state: "detached" });
        assert.notEqual(
            await presetBarHost.evaluate((element) => getComputedStyle(element).display),
            "none",
            "The preset bar must return after the MSEG editor closes.",
        );
    } finally {
        await page.close();
    }
});

test("mobile MSEG editor expands the drawer into a dominant graph with working recovery controls", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');

        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        await dialog.waitFor();
        assert.equal(await dialog.getAttribute("role"), "dialog");
        assert.equal(await dialog.getAttribute("aria-modal"), "true");
        assert.equal(await dialog.getAttribute("aria-label"), "MSEG 1 editor");
        assert.equal(await dialog.locator('text="Modulation Shape Editor"').count(), 0);
        assert.equal(await dialog.locator('text=/Drag a point to move/i').count(), 0);

        const layout = await dialog.evaluate((element) => {
            const graph = element.querySelector('[data-role="mseg-editor-graph"]');
            const controls = element.querySelector('[data-role="mseg-editor-controls"]');
            const bounds = element.getBoundingClientRect();
            if (!(graph instanceof HTMLElement) || !(controls instanceof HTMLElement)) {
                return null;
            }
            const graphBounds = graph.getBoundingClientRect();
            const controlsBounds = controls.getBoundingClientRect();
            return {
                bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height },
                graphHeight: graphBounds.height,
                controlsHeight: controlsBounds.height,
                documentScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                activeRole: document.activeElement?.getAttribute("data-role") ?? "",
            };
        });
        assert.ok(layout);
        assert.equal(layout.bounds.left >= 0 && layout.bounds.right <= 393, true);
        assert.equal(layout.bounds.top >= 0 && layout.bounds.bottom <= 852, true);
        assert.equal(layout.documentScrollWidth <= 393 && layout.bodyScrollWidth <= 393, true);
        assert.equal(layout.graphHeight > layout.controlsHeight * 1.5, true);
        assert.equal(layout.graphHeight >= layout.bounds.height * 0.48, true);
        assert.equal(layout.activeRole, "mseg-editor-done");

        for (const role of ["mseg-editor-done", "mseg-shape-a", "mseg-shape-b", "mseg-editor-undo", "mseg-loop-toggle"]) {
            const target = dialog.locator(`[data-role="${role}"]`);
            const box = await target.boundingBox();
            assert.ok(box, `${role} should be visible`);
            assert.equal(box.width >= 26 && box.height >= 26, true, `${role} must remain usable in the drawer-height rows`);
            assert.equal(await target.evaluate((element, point) => {
                const hit = document.elementFromPoint(point.x, point.y);
                return hit === element || (hit !== null && element.contains(hit));
            }, { x: box.x + (box.width / 2), y: box.y + (box.height / 2) }), true, `${role} must own its visible hit point`);
        }
        assert.equal(await dialog.locator('[data-role="mseg-editor-undo"]').isDisabled(), true);
        assert.equal(await dialog.locator('[data-role="mseg-rate-readout"]').count(), 1);

        const surface = dialog.locator('svg[data-role="mseg-editor-surface"]');
        const surfaceBox = await surface.boundingBox();
        assert.ok(surfaceBox);
        await page.mouse.click(surfaceBox.x + surfaceBox.width * 0.5, surfaceBox.y + surfaceBox.height * 0.25);
        await waitForHarnessSnapshot(
            page,
            "mobile MSEG point",
            (snapshot) => readStoredMsegShape(snapshot).points.length === 3,
        );
        assert.equal(await dialog.locator('[data-role="mseg-editor-undo"]').isEnabled(), true);
        assert.equal(await dialog.locator('[data-role="mseg-coordinate-hud"]').count(), 0);

        await dialog.locator('[data-role="mseg-editor-undo"]').click();
        await waitForHarnessSnapshot(
            page,
            "undone mobile MSEG point",
            (snapshot) => readStoredMsegShape(snapshot).points.length === 2,
        );
    } finally {
        await page.close();
    }
});

test("drawer and full-screen MSEG editors share one lightweight expanded-shell language", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const drawer = page.locator('[data-role="quick-source-sheet"]');
        const drawerHeader = drawer.locator('[data-role="quick-source-sheet-grip"]');
        const drawerGraphic = drawer.locator('[data-role="quick-source-sheet-graphic"]');
        await drawer.waitFor();
        const drawerPresentation = await drawer.evaluate((element) => {
            const style = getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return {
                className: element.className,
                height: bounds.height,
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                borderTopColor: style.borderTopColor,
                borderTopStyle: style.borderTopStyle,
                borderTopWidth: style.borderTopWidth,
                position: style.position,
            };
        });
        assert.match(await drawerHeader.getAttribute("class") ?? "", /mseg-editor-shell-top/);
        assert.match(await drawerGraphic.getAttribute("class") ?? "", /mseg-editor-shell-graphic/);

        await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        await dialog.waitFor();
        const fullPresentation = await dialog.evaluate((element) => {
            const style = getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return {
                className: element.className,
                height: bounds.height,
                backgroundColor: style.backgroundColor,
                backgroundImage: style.backgroundImage,
                borderTopWidth: style.borderTopWidth,
                boxShadow: style.boxShadow,
                liquidDetail: element.getAttribute("data-liquid-detail"),
            };
        });
        const fullGraphStyle = await dialog.locator('[data-role="mseg-editor-graph"]').evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                borderTopWidth: style.borderTopWidth,
                backgroundColor: style.backgroundColor,
            };
        });

        assert.match(drawerPresentation.className, /mseg-editor-shell/);
        assert.match(fullPresentation.className, /mseg-editor-shell/);
        assert.doesNotMatch(fullPresentation.className, /synth-modal-frame/);
        assert.match(await dialog.locator("header").getAttribute("class") ?? "", /mseg-editor-shell-top/);
        assert.match(await dialog.locator('[data-role="mseg-editor-graph"]').getAttribute("class") ?? "", /mseg-editor-shell-graphic/);
        assert.equal(fullPresentation.backgroundColor, drawerPresentation.backgroundColor);
        assert.equal(fullPresentation.backgroundImage, drawerPresentation.backgroundImage);
        assert.equal(fullPresentation.borderTopWidth, "0px");
        assert.equal(fullPresentation.boxShadow, "none");
        assert.equal(fullPresentation.liquidDetail, null);
        assert.equal(fullGraphStyle.borderTopWidth, "0px");
        assert.equal(fullGraphStyle.backgroundColor, "rgba(0, 0, 0, 0)");
        assert.equal(fullPresentation.height > drawerPresentation.height * 2, true);
        assert.equal(drawerPresentation.borderTopWidth, "1px");
        assert.equal(drawerPresentation.borderTopStyle, "solid");
        assert.notEqual(drawerPresentation.borderTopColor, "rgba(0, 0, 0, 0)");
        assert.equal(drawerPresentation.position, "fixed", "Sharing the shell must not pull the drawer out of its fixed bottom-sheet layer.");
    } finally {
        await page.close();
    }
});

test("the full-screen MSEG editor is the drawer's title-controls-graph composition expanded", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const measureRows = async (root, headerSelector, controlsSelector, graphicSelector) => root.evaluate((element, selectors) => {
        const header = element.querySelector(selectors.header);
        const controls = element.querySelector(selectors.controls);
        const graphic = element.querySelector(selectors.graphic);
        if (!(header instanceof HTMLElement) || !(controls instanceof HTMLElement) || !(graphic instanceof HTMLElement)) {
            throw new Error("The MSEG editor's title, controls, or graph row is missing.");
        }
        const rootBounds = element.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        const controlsBounds = controls.getBoundingClientRect();
        const graphicBounds = graphic.getBoundingClientRect();
        return {
            headerTop: headerBounds.top - rootBounds.top,
            headerBottom: headerBounds.bottom - rootBounds.top,
            headerHeight: headerBounds.height,
            controlsTop: controlsBounds.top - rootBounds.top,
            controlsBottom: controlsBounds.bottom - rootBounds.top,
            controlsHeight: controlsBounds.height,
            graphicTop: graphicBounds.top - rootBounds.top,
            coordinateHudCount: element.querySelectorAll('[data-role="mseg-coordinate-hud"]').length,
        };
    }, {
        header: headerSelector,
        controls: controlsSelector,
        graphic: graphicSelector,
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const drawer = page.locator('[data-role="quick-source-sheet"]');
        await drawer.waitFor();
        const drawerRows = await measureRows(
            drawer,
            '[data-role="quick-source-sheet-grip"]',
            '[data-role="quick-source-sheet-strip"]',
            '[data-role="quick-source-sheet-graphic"]',
        );

        await drawer.locator('[data-role="quick-source-sheet-full-editor"]').click();
        const full = page.locator('[data-role="mseg-editor-dialog"]');
        await full.waitFor();
        const fullRows = await measureRows(
            full,
            'header',
            '[data-role="mseg-editor-controls"]',
            '[data-role="mseg-editor-graph"]',
        );

        assert.equal(drawerRows.headerTop <= 1, true, "The drawer's established 1px top border remains part of its geometry.");
        assert.equal(drawerRows.controlsTop, drawerRows.headerBottom);
        assert.equal(drawerRows.graphicTop, drawerRows.controlsBottom);
        assert.equal(fullRows.headerTop, 0);
        assert.equal(fullRows.controlsTop, fullRows.headerBottom);
        assert.equal(fullRows.graphicTop, fullRows.controlsBottom);
        assert.equal(Math.abs(fullRows.headerHeight - drawerRows.headerHeight) <= 1, true);
        assert.equal(Math.abs(fullRows.controlsHeight - drawerRows.controlsHeight) <= 1, true);
        assert.equal(fullRows.coordinateHudCount, 0, "The expanded drawer must not retain the old modal coordinate decoration.");
    } finally {
        await page.close();
    }
});

test("the MSEG drawer keeps its established accent top-border declaration", async () => {
    const source = await readFile(new URL("../ui/desktop/mobile-quick-source-sheet.css", import.meta.url), "utf8");
    assert.match(
        source,
        /border-top: 1px solid color-mix\(in srgb, var\(--quick-sheet-accent\) 45%, var\(--cosimo-line\)\);/,
    );
});

test("the drawer MSEG timing knob fits its existing row and reaches both range ends inside a phone viewport", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 852 }),
    });
    const dragTimingKnobBy = async (knob, deltaX, pointerId) => {
        const box = await knob.boundingBox();
        assert.ok(box);
        const start = {
            x: box.x + (box.width / 2),
            y: box.y + (box.height / 2),
        };
        await knob.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        for (const progress of [0.12, 0.5, 1]) {
            await page.evaluate(({ x, y, dx, id, progressValue }) => {
                window.dispatchEvent(new PointerEvent("pointermove", {
                    bubbles: true,
                    cancelable: true,
                    pointerId: id,
                    pointerType: "touch",
                    isPrimary: true,
                    button: 0,
                    buttons: 0,
                    clientX: x + (dx * progressValue),
                    clientY: y,
                }));
            }, { ...start, dx: deltaX, id: pointerId, progressValue: progress });
        }
        await page.evaluate(({ x, y, dx, id }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                pointerId: id,
                pointerType: "touch",
                isPrimary: true,
                button: 0,
                buttons: 0,
                clientX: x + dx,
                clientY: y,
            }));
        }, { ...start, dx: deltaX, id: pointerId });
    };

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const sheet = page.locator('[data-role="quick-source-sheet"]');
        const drawerRateKnob = sheet.locator('[data-role="quick-source-sheet-cell-rate"]');
        const drawerKnobArt = drawerRateKnob.locator('[data-role="parameter-knob-artwork"]');
        await drawerKnobArt.waitFor();
        const drawerGeometry = await page.evaluate(() => {
            const stripElement = document.querySelector('[data-role="quick-source-sheet-strip"]');
            const art = document.querySelector('[data-role="quick-source-sheet-cell-rate"] [data-role="parameter-knob-artwork"]');
            const readout = document.querySelector('[data-role="quick-source-sheet-cell-rate"] .cosimo-readout');
            if (!(stripElement instanceof HTMLElement) || !(art instanceof SVGElement) || !(readout instanceof HTMLElement)) {
                return null;
            }
            const stripBounds = stripElement.getBoundingClientRect();
            const artBounds = art.getBoundingClientRect();
            const centerX = artBounds.left + (artBounds.width / 2);
            return {
                stripHeight: stripBounds.height,
                leftTravel: centerX,
                rightTravel: window.innerWidth - centerX,
                readoutClipped: readout.scrollWidth > readout.clientWidth,
                readoutText: readout.textContent,
                readoutClientWidth: readout.clientWidth,
                readoutScrollWidth: readout.scrollWidth,
            };
        });
        assert.ok(drawerGeometry);
        assert.equal(drawerGeometry.stripHeight <= 40, true, "The drawer control strip must not grow beyond its existing 40px row.");
        assert.equal(drawerGeometry.leftTravel >= 100, true, "The timing knob needs its full 100px linear drag range to the left.");
        assert.equal(drawerGeometry.rightTravel >= 100, true, "The timing knob needs its full 100px linear drag range to the right.");
        assert.equal(
            drawerGeometry.readoutClipped,
            false,
            `The compact timing value must fit without an ellipsis: ${JSON.stringify(drawerGeometry)}.`,
        );
        assert.equal(await drawerRateKnob.getAttribute("role"), "slider");
        assert.equal(await drawerRateKnob.getAttribute("aria-label"), "MSEG 1 rate");

        await drawerRateKnob.focus();
        await page.keyboard.press("Home");
        await waitForHarnessSnapshot(
            page,
            "keyboard minimum MSEG rate",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate)) <= 1e-9,
        );
        await dragTimingKnobBy(drawerRateKnob, 100, 131);
        await waitForHarnessSnapshot(
            page,
            "right-dragged maximum MSEG rate",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 2) <= 0.001,
        );
        await dragTimingKnobBy(drawerRateKnob, -100, 132);
        await waitForHarnessSnapshot(
            page,
            "left-dragged minimum MSEG rate",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate)) <= 0.001,
        );
    } finally {
        await page.close();
    }
});

test("the full-screen MSEG timing and morph knobs share the compact row without making it taller", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');

        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        const controls = dialog.locator('[data-role="mseg-editor-controls"]');
        const rateKnob = dialog.locator('[data-role="mseg-editor-cell-rate"]');
        const morphKnob = dialog.locator('[data-role="mseg-editor-cell-morph"]');
        await rateKnob.locator('[data-role="parameter-knob-artwork"]').waitFor();
        await morphKnob.locator('[data-role="parameter-knob-artwork"]').waitFor();

        const geometry = await page.evaluate(() => {
            const footer = document.querySelector('[data-role="mseg-editor-controls"]');
            const art = document.querySelector('[data-role="mseg-editor-cell-rate"] [data-role="parameter-knob-artwork"]');
            if (!(footer instanceof HTMLElement) || !(art instanceof SVGElement)) {
                return null;
            }
            const footerBounds = footer.getBoundingClientRect();
            const artBounds = art.getBoundingClientRect();
            const centerX = artBounds.left + (artBounds.width / 2);
            return {
                footerHeight: footerBounds.height,
                leftTravel: centerX,
                rightTravel: window.innerWidth - centerX,
            };
        });
        assert.ok(geometry);
        assert.equal(geometry.footerHeight <= 100, true, "The compact row must not exceed the old two-row footer.");
        assert.equal(geometry.leftTravel >= 100, true);
        assert.equal(geometry.rightTravel >= 100, true);
        assert.equal(await controls.locator('input[type="range"]').count(), 0);
        assert.equal(await rateKnob.getAttribute("role"), "slider");
        assert.equal(await rateKnob.getAttribute("aria-label"), "MSEG rate");
        assert.equal(await rateKnob.getAttribute("aria-valuemin"), "0");
        assert.equal(await rateKnob.getAttribute("aria-valuemax"), "2");

        await rateKnob.focus();
        await page.keyboard.press("End");
        await waitForHarnessSnapshot(
            page,
            "full editor keyboard maximum MSEG rate",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 2) <= 0.001,
        );
        await page.keyboard.press("Home");
        await waitForHarnessSnapshot(
            page,
            "full editor keyboard minimum MSEG rate",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate)) <= 0.001,
        );
    } finally {
        await page.close();
    }
});

test("the full-screen Rate knob shows its live precision HUD above the expanded drawer", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');

        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        const rateKnob = dialog.locator('[data-role="mseg-editor-cell-rate"]');
        await rateKnob.focus();
        await page.keyboard.press("Home");
        const knobBounds = await rateKnob.boundingBox();
        assert.ok(knobBounds);
        const start = {
            x: knobBounds.x + (knobBounds.width / 2),
            y: knobBounds.y + (knobBounds.height / 2),
        };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 36, start.y, { steps: 5 });

        const hudLayer = dialog.locator('[data-role="mseg-editor-hud-layer"]');
        const hud = hudLayer.locator('[data-role="mobile-voice-hud"].is-visible');
        await hud.waitFor();
        const liveValueText = await rateKnob.getAttribute("aria-valuetext");
        assert.notEqual(liveValueText, "0.000 s");
        assert.equal(await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(), liveValueText);
        assert.match(await hud.textContent(), /MSEG rate/);
        const [dialogBounds, hudBounds] = await Promise.all([dialog.boundingBox(), hud.boundingBox()]);
        assert.ok(dialogBounds);
        assert.ok(hudBounds);
        assert.equal(hudBounds.y >= dialogBounds.y, true);
        assert.equal(hudBounds.y + hudBounds.height <= dialogBounds.y + dialogBounds.height, true);

        await page.mouse.up();
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("the full-screen Morph knob visibly reshapes the primary envelope while it moves", async () => {
    const modulationState = createDefaultModulationState();
    modulationState.msegSlots[0] = {
        ...modulationState.msegSlots[0],
        shapeB: {
            ...modulationState.msegSlots[0].shapeB,
            points: [
                { x: 0, y: 1, curvePower: 0 },
                { x: 0.38, y: 0.12, curvePower: 2.5 },
                { x: 1, y: 0.45, curvePower: -1.5 },
            ],
        },
    };
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, serializedState }) => {
                const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    ...initial,
                    storedState: {
                        ...initial.storedState,
                        [stateKey]: serializedState,
                    },
                };
            }, {
                stateKey: MODULATION_STATE_KEY,
                serializedState: JSON.stringify(modulationState),
            });
        },
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');

        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        const surface = dialog.locator('[data-role="mseg-editor-surface"]');
        const morphKnob = dialog.locator('[data-role="mseg-editor-cell-morph"]');
        await morphKnob.focus();
        await page.keyboard.press("Home");
        const storedShapeBefore = readStoredMsegShape(await getHarnessSnapshot(page));
        const baseCurveBefore = await surface.locator('[data-role="mseg-base-curve"]').getAttribute("d");
        assert.match(baseCurveBefore ?? "", /^M /);

        const knobBounds = await morphKnob.boundingBox();
        assert.ok(knobBounds);
        const start = {
            x: knobBounds.x + (knobBounds.width / 2),
            y: knobBounds.y + (knobBounds.height / 2),
        };
        assert.equal(await morphKnob.evaluate((element, point) => {
            const hit = document.elementFromPoint(point.x, point.y);
            return hit !== null && element.contains(hit);
        }, start), true, "The visible Morph knob must own its physical hit point above the floating Mod rail.");
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 56, start.y, { steps: 8 });
        await page.waitForFunction(() => (
            Number(document.querySelector('[data-role="mseg-editor-cell-morph"]')?.getAttribute("aria-valuenow")) > 0.1
        ));

        const livePresentation = await surface.evaluate((element) => ({
            presentation: element.getAttribute("data-morph-presentation"),
            baseCurve: element.querySelector('[data-role="mseg-base-curve"]')?.getAttribute("d") ?? "",
            effectiveOverlayCount: element.querySelectorAll('[data-role="mseg-effective-curve"]').length,
            referenceOverlayCount: element.querySelectorAll(
                '[data-role="mseg-reference-curve"], [data-role="mseg-reference-fill"]',
            ).length,
            pointCount: element.querySelectorAll('[data-role="mseg-point"]').length,
        }));
        assert.equal(livePresentation.presentation, "primary");
        assert.notEqual(livePresentation.baseCurve, baseCurveBefore);
        assert.equal(livePresentation.effectiveOverlayCount, 0);
        assert.equal(livePresentation.referenceOverlayCount, 0);
        assert.equal(livePresentation.pointCount, 0, "A morphed result must not show handles belonging to only shape A or B.");

        await page.mouse.up();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mseg-editor-surface"]')?.getAttribute("data-morph-presentation") === "edit-shape"
        ));
        assert.deepEqual(readStoredMsegShape(await getHarnessSnapshot(page)), storedShapeBefore);
        assert.equal(await surface.locator('[data-role="mseg-point"]').count() > 0, true);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("the drawer Morph knob shows its changing amount in the shared precision HUD", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="mobile-global-mod-rail"]').waitFor();
        await page.waitForTimeout(240);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const drawer = page.locator('[data-role="quick-source-sheet"]');
        const morphKnob = drawer.locator('[data-role="quick-source-sheet-cell-morph"]');
        await morphKnob.focus();
        await page.keyboard.press("Home");
        const knobBounds = await morphKnob.boundingBox();
        assert.ok(knobBounds);
        const start = {
            x: knobBounds.x + (knobBounds.width / 2),
            y: knobBounds.y + (knobBounds.height / 2),
        };
        assert.equal(await morphKnob.evaluate((element, point) => {
            const hit = document.elementFromPoint(point.x, point.y);
            return hit !== null && element.contains(hit);
        }, start), true, "The drawer Morph knob must own its visible hit point.");
        await morphKnob.dispatchEvent("pointerdown", {
            pointerId: 222,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        for (const progress of [0.25, 0.6, 1]) {
            await page.evaluate(({ x, y, progressValue }) => {
                window.dispatchEvent(new PointerEvent("pointermove", {
                    bubbles: true,
                    cancelable: true,
                    pointerId: 222,
                    pointerType: "touch",
                    isPrimary: true,
                    button: 0,
                    buttons: 0,
                    clientX: x + (56 * progressValue),
                    clientY: y,
                }));
            }, { ...start, progressValue: progress });
        }
        await page.waitForFunction(() => (
            Number(document.querySelector('[data-role="quick-source-sheet-cell-morph"]')?.getAttribute("aria-valuenow")) > 0.1
        ));

        const hud = page.locator('[data-role="mobile-voice-hud-layer"] [data-role="mobile-voice-hud"].is-visible');
        await hud.waitFor();
        const liveValueText = await morphKnob.getAttribute("aria-valuetext");
        assert.notEqual(liveValueText, "0%");
        assert.equal(await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(), liveValueText);
        assert.match(await hud.textContent(), /MSEG morph/);

        await page.evaluate(({ x, y }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                pointerId: 222,
                pointerType: "touch",
                isPrimary: true,
                button: 0,
                buttons: 0,
                clientX: x + 56,
                clientY: y,
            }));
        }, start);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("MSEG drawer follows its longest graph axis during live resizing without rewriting the envelope", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 900 }),
    });

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        await rail.waitFor();
        await page.waitForTimeout(240);
        await page.locator('[data-role="mobile-global-mod-rail-selected"]').click();

        const sheet = page.locator('[data-role="quick-source-sheet"]');
        const surface = sheet.locator('svg[data-role="quick-sheet-mseg-surface"]');
        await surface.waitFor();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-sheet-mseg-surface"]')?.getAttribute("data-time-axis") === "horizontal"
        ));

        const shapeBeforeResize = readStoredMsegShape(await getHarnessSnapshot(page));
        const horizontalPointCenters = await surface.locator('[data-role="mseg-point"]').evaluateAll((points) => (
            points.map((point) => ({
                x: Number(point.getAttribute("cx")),
                y: Number(point.getAttribute("cy")),
            }))
        ));
        assert.equal(horizontalPointCenters[0].y > horizontalPointCenters.at(-1).y, true);

        const grip = sheet.locator('[data-role="quick-source-sheet-grip"]');
        const gripBox = await grip.boundingBox();
        assert.ok(gripBox);
        const initialSurfaceBox = await surface.boundingBox();
        assert.ok(initialSurfaceBox);
        const start = {
            x: gripBox.x + (gripBox.width / 2),
            y: gripBox.y + (gripBox.height / 2),
        };
        const moveToSurfaceRatio = async (heightPerWidth) => {
            const targetSurfaceHeight = initialSurfaceBox.width * heightPerWidth;
            const pointerY = start.y - (targetSurfaceHeight - initialSurfaceBox.height);
            await page.mouse.move(start.x, pointerY, { steps: 6 });
        };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();

        await moveToSurfaceRatio(1.02);
        assert.equal(await surface.getAttribute("data-time-axis"), "horizontal");
        await moveToSurfaceRatio(1.07);
        assert.equal(await surface.getAttribute("data-time-axis"), "horizontal");
        await moveToSurfaceRatio(1.10);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-sheet-mseg-surface"]')?.getAttribute("data-time-axis") === "vertical"
        ));
        await moveToSurfaceRatio(0.98);
        assert.equal(
            await surface.getAttribute("data-time-axis"),
            "vertical",
            "Near-square resize jitter must remain on the current axis.",
        );
        await moveToSurfaceRatio(0.90);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-sheet-mseg-surface"]')?.getAttribute("data-time-axis") === "horizontal"
        ));
        await moveToSurfaceRatio(1.20);
        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-sheet-mseg-surface"]')?.getAttribute("data-time-axis") === "vertical"
        ));
        await page.mouse.up();

        await page.waitForFunction(() => (
            document.querySelector('[data-role="quick-source-sheet"]')?.getAttribute("data-detent") === "half"
        ));
        const verticalPointCenters = await surface.locator('[data-role="mseg-point"]').evaluateAll((points) => (
            points.map((point) => ({
                x: Number(point.getAttribute("cx")),
                y: Number(point.getAttribute("cy")),
            }))
        ));
        assert.equal(verticalPointCenters[0].y < verticalPointCenters.at(-1).y, true);
        assert.deepEqual(
            readStoredMsegShape(await getHarnessSnapshot(page)),
            shapeBeforeResize,
            "Changing the visible time axis must not rewrite stored MSEG points.",
        );

        const verticalSurfaceBox = await surface.boundingBox();
        assert.ok(verticalSurfaceBox);
        await page.mouse.click(
            verticalSurfaceBox.x + (verticalSurfaceBox.width * 0.78),
            verticalSurfaceBox.y + (verticalSurfaceBox.height * 0.24),
        );
        let snapshot = await waitForHarnessSnapshot(
            page,
            "vertical-axis MSEG point added",
            (candidate) => readStoredMsegShape(candidate).points.length === 3,
        );
        let points = readStoredMsegShape(snapshot).points;
        const addedPoint = { ...points[1] };
        assert.equal(addedPoint.x < 0.4, true, "Vertical screen position must map to stored MSEG time.");
        assert.equal(addedPoint.y > 0.6, true, "Horizontal screen position must map to stored MSEG value.");
        assert.equal(
            await surface.locator('[data-role="mseg-point"][data-point-state="selected"]').getAttribute("data-point-index"),
            "1",
        );

        const selectedPoint = surface.locator('[data-role="mseg-point"][data-point-index="1"]');
        const selectedPointBox = await selectedPoint.boundingBox();
        assert.ok(selectedPointBox);
        const selectedCenter = {
            x: selectedPointBox.x + (selectedPointBox.width / 2),
            y: selectedPointBox.y + (selectedPointBox.height / 2),
        };
        await page.mouse.move(selectedCenter.x, selectedCenter.y);
        await page.mouse.down();
        await page.mouse.move(selectedCenter.x - 50, selectedCenter.y + 70, { steps: 8 });
        await page.mouse.up();
        snapshot = await waitForHarnessSnapshot(
            page,
            "vertical-axis MSEG point dragged",
            (candidate) => {
                const moved = readStoredMsegShape(candidate).points[1];
                return moved !== undefined
                    && moved.x > addedPoint.x + 0.05
                    && moved.y < addedPoint.y - 0.05;
            },
        );
        points = readStoredMsegShape(snapshot).points;
        assert.equal(points[1].x > addedPoint.x, true, "Dragging down must advance vertical time.");
        assert.equal(points[1].y < addedPoint.y, true, "Dragging left must lower the vertical editor value.");
        assertLatestMsegBufferMatchesStoredShape(snapshot);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("MSEG preview progress fill follows the selected DSP slot and clears when the monitor goes inactive", async () => {
    const page = await openHarnessPage();

    try {
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 7,
                hasActive: 1,
                positions: [0.2, 0.58, 0.86],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip);
        });

        let renderedState = await getHarnessRenderedState(page);
        let previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.2)) <= 1.5,
            true,
        );

        await page.click('button[aria-label="Select MSEG 2"]');
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview?.progressClip)
                && preview.progressClip.width > 100;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.ok(previewState.progressClip);
        assert.equal(previewState.playhead, null);
        assert.equal(
            Math.abs(previewState.progressClip.width - expectedMsegPreviewProgressClipWidth(previewState, 0.58)) <= 1.5,
            true,
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 8,
                hasActive: 0,
                positions: [1, 1, 1],
            });
        });
        await page.waitForFunction(() => {
            const preview = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState;
            return Boolean(preview) && !preview.progressClip;
        });

        renderedState = await getHarnessRenderedState(page);
        previewState = renderedState.msegPreviewState;
        assert.ok(previewState);
        assert.equal(previewState.playhead, null);
        assert.equal(previewState.progressClip, null);
    } finally {
        await page.close();
    }
});

test("main MSEG morph control updates morph without taking keyboard focus and previews the effective curve while dragged", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");

        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync before morph drag",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1),
        );
        await clearHarnessDebugLog(page);
        await page.mouse.move(sliderBox.x + 2, sliderBox.y + (sliderBox.height * 0.5));
        await page.mouse.down();
        await page.mouse.move(sliderBox.x + (sliderBox.width * 0.72), sliderBox.y + (sliderBox.height * 0.5), { steps: 6 });

        await page.waitForFunction(() => Boolean(window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.effectiveCurvePath));
        let renderedState = await getHarnessRenderedState(page);
        assert.match(renderedState.msegPreviewState?.effectiveCurvePath ?? "", /^M /);
        assert.match(renderedState.msegPreviewState?.shapeACurvePath ?? "", /^M /);
        assert.match(renderedState.msegPreviewState?.shapeBCurvePath ?? "", /^M /);
        assert.notEqual(
            renderedState.msegPreviewState?.effectiveCurvePath,
            renderedState.msegPreviewState?.shapeACurvePath,
            "The preview's primary curve should be the morphed A/B result, not always shape A.",
        );

        const focusedElement = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const activeElement = viewRoot?.activeElement;

            return {
                tagName: activeElement?.tagName?.toLowerCase() ?? null,
                dataRole: activeElement?.getAttribute("data-role") ?? null,
                ariaLabel: activeElement?.getAttribute("aria-label") ?? null,
            };
        });
        assert.notEqual(focusedElement.dataRole, "mseg-morph-slider");
        assert.notEqual(focusedElement.tagName, "input");

        await page.keyboard.press("a");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });
        const morphMidiSnapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            morphMidiSnapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );

        await page.mouse.up();
        await page.waitForFunction(() => Boolean(window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().msegPreviewState?.effectiveCurvePath));

        const snapshot = await waitForHarnessSnapshot(
            page,
            "main MSEG morph changed",
            (nextSnapshot) => {
                const rawState = nextSnapshot.storedState["modulation.v6"];
                const modulationState = typeof rawState === "string" ? JSON.parse(rawState) : null;
                return Math.abs(Number(nextSnapshot.parameterValues.mseg1Morph) - 0.72) <= 0.04
                    && (modulationState === null || !("morph" in (modulationState.msegSlots?.[0] ?? {})));
            },
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Morph"),
            true,
            "the morph drag must reach the real parameter endpoint",
        );
        const rawModulationState = snapshot.storedState["modulation.v6"];
        if (typeof rawModulationState === "string") {
            assert.equal("morph" in JSON.parse(rawModulationState).msegSlots[0], false);
        }
    } finally {
        await page.close();
    }
});

test("main MSEG morph control closes its host gesture when the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(sliderBox.x + 2, sliderBox.y + (sliderBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.filter((value) => value === "mseg1Morph").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "mseg1Morph").length, 1);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("main MSEG morph touch drag survives unavailable pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]').first();
        await morphSlider.scrollIntoViewIfNeeded();
        const sliderBox = await morphSlider.boundingBox();
        assert.ok(sliderBox, "Expected the main MSEG morph control to be visible.");
        await morphSlider.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);

        const pointerId = 94;
        const clientY = sliderBox.y + (sliderBox.height * 0.5);
        await morphSlider.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: sliderBox.x + 2,
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
            pointerId,
            clientX: sliderBox.x + (sliderBox.width * 0.75),
            clientY,
        });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free MSEG morph touch move",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.mseg1Morph) > 0.7,
        );
        assert.deepEqual(snapshot.gestureStarts, ["mseg1Morph"]);

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
            pointerId,
            clientX: sliderBox.x + (sliderBox.width * 0.75),
            clientY,
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free MSEG morph touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("mseg1Morph"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["mseg1Morph"]);
    } finally {
        await page.close();
    }
});

test("MSEG rate drag stops changing values after the window blurs", async () => {
    const page = await openHarnessPage();

    try {
        const rateInput = page.locator('input[aria-label="MSEG rate"]').first();
        await rateInput.scrollIntoViewIfNeeded();
        const inputBox = await rateInput.boundingBox();
        assert.ok(inputBox, "Expected the MSEG rate input to be visible.");

        await clearHarnessDebugLog(page);
        await page.mouse.move(inputBox.x + (inputBox.width * 0.5), inputBox.y + (inputBox.height * 0.5));
        await page.mouse.down();
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.mouse.move(inputBox.x + inputBox.width + 120, inputBox.y + (inputBox.height * 0.5));
        await page.mouse.up();
        await page.waitForTimeout(100);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Rate"),
            false,
        );
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("MSEG rate touch drag survives unavailable pointer capture", async () => {
    const page = await openHarnessPage();

    try {
        const rateInput = page.locator('input[aria-label="MSEG rate"]').first();
        await rateInput.scrollIntoViewIfNeeded();
        const inputBox = await rateInput.boundingBox();
        assert.ok(inputBox, "Expected the MSEG rate input to be visible.");
        await rateInput.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointer = {
            pointerId: 83,
            pointerType: "touch",
            button: 0,
            clientY: inputBox.y + (inputBox.height * 0.5),
        };
        await rateInput.dispatchEvent("pointerdown", {
            ...pointer,
            buttons: 1,
            clientX: inputBox.x + (inputBox.width * 0.5),
        });
        await page.evaluate(({ clientX, clientY }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                cancelable: true,
                pointerId: 83,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
            }));
            window.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                pointerId: 83,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX,
                clientY,
            }));
        }, {
            clientX: inputBox.x + (inputBox.width * 0.5) + 20,
            clientY: inputBox.y + (inputBox.height * 0.5),
        });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "touch-adjusted MSEG rate without pointer capture",
            (nextSnapshot) => {
                return Number(nextSnapshot.parameterValues.mseg1Rate) > 1.2
                    && nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "mseg1Rate");
            },
        );
        assert.equal(Number(snapshot.parameterValues.mseg1Rate) > 1.2, true);
    } finally {
        await page.close();
    }
});

test("MSEG overview rate updates its host parameter while loop policy updates modulation.v6", { timeout: 60_000 }, async () => {
    const isolatedServer = await startDesktopHarnessServer();
    const isolatedBrowser = await chromium.launch({ headless: true });
    const page = await isolatedBrowser.newPage();

    try {
        await page.goto(isolatedServer.baseUrl, { waitUntil: "load" });
        await waitForHarnessReady(page);
        await waitForHarnessSnapshot(
            page,
            "initial MSEG boot sync",
            (snapshot) => snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegBuffer" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "modulationMsegPlayback" && Number(value?.slot) === 1)
                && snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
        );

        const depthInputCount = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            return viewRoot?.querySelectorAll('input[aria-label="MSEG depth"]').length ?? 0;
        });
        assert.equal(depthInputCount, 0);

        await clearHarnessDebugLog(page);
        const rateInput = page.locator('input[aria-label="MSEG rate"]').first();
        await rateInput.click();
        await page.waitForFunction(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const input = viewRoot?.querySelector('input[aria-label="MSEG rate"]');
            return input instanceof HTMLInputElement && !input.readOnly;
        });
        assert.equal(
            (await rateInput.locator("xpath=following-sibling::*[@data-role='parameter-entry-unit']").textContent()).trim(),
            "s",
        );
        await rateInput.fill("500 ms");
        await rateInput.press("Enter");
        const rateSnapshot = await waitForHarnessSnapshot(
            page,
            "MSEG exact rate commits an explicit millisecond value",
            (nextSnapshot) => Math.abs(Number(nextSnapshot.parameterValues.mseg1Rate) - 0.5) <= 1e-9,
        );
        const rateAfterChange = Number(rateSnapshot.parameterValues.mseg1Rate);
        assert.equal(rateAfterChange, 0.5);
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(Number(snapshot.parameterValues.mseg1Rate), 0.5);
        assert.equal("rate" in readStoredMsegPlayback(snapshot), false);

        await clearHarnessDebugLog(page);
        const playbackAfterLoopToggle = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const loopButton = Array.from(viewRoot?.querySelectorAll("button") ?? []).find((button) =>
                button.textContent?.trim() === "Looping"
            );

            if (!(loopButton instanceof HTMLButtonElement)) {
                throw new Error("MSEG loop button is missing.");
            }

            loopButton.click();

            for (let attempt = 0; attempt < 80; attempt += 1) {
                const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
                const rawState = snapshot.storedState["modulation.v6"];
                if (typeof rawState !== "string") {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    continue;
                }

                const modulationState = JSON.parse(rawState);
                const playback = modulationState.msegSlots?.[0]?.playback;
                if (playback?.loop === null) {
                    return playback;
                }

                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return JSON.parse(String(snapshot.storedState["modulation.v6"])).msegSlots?.[0]?.playback;
        });
        assert.equal(playbackAfterLoopToggle.loop, null);
        snapshot = await getHarnessSnapshot(page);
        assert.equal(readStoredMsegPlayback(snapshot).loop, null);
        assert.ok((await page.getByRole("button", { name: "One Shot" }).count()) >= 1);
    } finally {
        await page.close();
        await isolatedBrowser.close();
        await isolatedServer.stop();
    }
});

test("the Mod page's shape graph opens the MSEG the page shows, and page/bar selection stays one selection", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        const numberSelect = page.locator('[data-role="mobile-mod-source-number"]');
        await numberSelect.waitFor();

        // Page → bar: choosing MSEG 2 on the page IS the one selection.
        await numberSelect.selectOption("2");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-global-mod-rail-selected"]')?.textContent?.includes("2") === true
        ));

        // The graph tap edits exactly what the page shows.
        await page.click('button[aria-label="Open MSEG editor"]');
        const dialog = page.locator('[data-role="mseg-editor-dialog"]');
        await dialog.waitFor();
        assert.equal(
            await dialog.getAttribute("aria-label"),
            "MSEG 2 editor",
            "Tapping the shape graph must open the MSEG the page displays.",
        );
        await page.click('[data-role="mseg-editor-done"]');
        await page.waitForSelector('[data-role="mseg-editor-dialog"]', { state: "detached" });

        // Bar → page: arming ENV 1 on the bar moves the same one selection.
        const grip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
        if (await grip.getAttribute("aria-expanded") !== "true") {
            await grip.click({ position: { x: 28, y: 12 } });
        }
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
        await page.click('[data-role="rack-mod-source-env-1"]');
        await page.waitForFunction(() => {
            const kind = document.querySelector('[data-role="mobile-mod-source-type"]');
            const number = document.querySelector('[data-role="mobile-mod-source-number"]');
            return kind instanceof HTMLSelectElement && kind.value === "envelope"
                && number instanceof HTMLSelectElement && number.value === "1";
        });
    } finally {
        await page.close();
    }
});

test("the floating bar keeps playing while the MSEG editor is open", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-mod"]');
        await page.click('button[aria-label="Open MSEG editor"]');
        await page.locator('[data-role="mseg-editor-dialog"]').waitFor();

        const noteKey = page.locator('[data-role="mobile-global-mod-rail-note"]');
        await noteKey.waitFor();
        assert.equal(
            await noteKey.evaluate((element) => element.closest("[inert]") !== null),
            false,
            "The bar must not be deadened by the open editor.",
        );

        await clearHarnessDebugLog(page);
        await noteKey.dispatchEvent("pointerdown", { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, bubbles: true });
        await noteKey.dispatchEvent("pointerup", { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, bubbles: true });
        await page.waitForFunction(() => {
            const events = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents;
            const noteOns = events.filter(({ value }) => (value >>> 16) === 0x90).length;
            const noteOffs = events.filter(({ value }) => (value >>> 16) === 0x80).length;
            return noteOns === 1 && noteOffs === 1;
        }, undefined, { timeout: 3000 });
    } finally {
        await page.close();
    }
});
