import test from "node:test";
import assert from "node:assert/strict";

import {
    MODULATION_STATE_KEY,
    createDefaultModulationState,
    openHarnessPage,
    selectRackEffect,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

test("Wavetable Index drag replaces the generic HUD knob with the production wavetable", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const indexCell = page.locator('[data-role="mobile-voice-cell-framePosition"]');
        await indexCell.waitFor({ state: "visible" });
        const bounds = await indexCell.boundingBox();
        assert.ok(bounds);

        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 48, startY, { steps: 8 });

        const hud = page.locator('[data-role="mobile-voice-hud"].is-visible');
        await hud.waitFor();
        const wavetableGraphic = hud.locator('[data-role="parameter-hud-wavetable"]');
        await wavetableGraphic.waitFor();
        const canvas = wavetableGraphic.locator("canvas");
        assert.equal(await canvas.count(), 1);
        assert.equal(await hud.locator(".mobile-voice-hud-knob").count(), 0);
        assert.equal(
            await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
            await indexCell.getAttribute("aria-valuetext"),
        );

        const initialGraphic = await canvas.evaluate((element) => element.toDataURL());
        await page.mouse.move(startX + 96, startY, { steps: 8 });
        await page.waitForFunction((previousGraphic) => (
            document.querySelector('[data-role="parameter-hud-wavetable"] canvas')?.toDataURL()
                !== previousGraphic
        ), initialGraphic);
        assert.equal(
            await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
            await indexCell.getAttribute("aria-valuetext"),
        );

        await page.mouse.up();
    } finally {
        await page.close();
    }
});

test("main Filter Cutoff drag shows the live production response and frequency", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="filter-mode-chip"]').click();
        const cutoffKnob = page.locator('[data-role="voice-filter-knob-filterCutoff"]');
        await cutoffKnob.waitFor({ state: "visible" });
        const bounds = await cutoffKnob.boundingBox();
        assert.ok(bounds);

        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 24, startY, { steps: 6 });

        const hud = page.locator('[data-role="mobile-voice-hud"].is-visible');
        await hud.waitFor();
        const response = hud.locator('[data-role="parameter-hud-filter"]');
        assert.equal(await response.count(), 1, await hud.innerHTML());
        assert.equal(await response.locator('[data-role="filter-response-graph"]').count(), 1);
        assert.equal(await hud.locator(".mobile-voice-hud-knob").count(), 0);
        assert.equal(
            await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
            await cutoffKnob.getAttribute("aria-valuetext"),
        );

        const initialPath = await response.locator('[data-role="filter-response-graph"] path').first().getAttribute("d");
        await page.mouse.move(startX + 72, startY, { steps: 8 });
        const updatedPath = await response.locator('[data-role="filter-response-graph"] path').first().getAttribute("d");
        assert.notEqual(updatedPath, initialPath, "the production response must follow the live cutoff");

        await page.mouse.up();
    } finally {
        await page.close();
    }
});

test("direct filter-graph dragging hides a lingering HUD while ordinary parameters stay generic", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator('[data-role="filter-mode-chip"]').click();
        const cutoffKnob = page.locator('[data-role="voice-filter-knob-filterCutoff"]');
        const resonanceKnob = page.locator('[data-role="voice-filter-knob-filterQ"]');
        const graphHandle = page.locator('[data-role="filter-card"] [data-role="filter-response-handle-hit-target"]');
        const [cutoffBounds, resonanceBounds] = await Promise.all([
            cutoffKnob.boundingBox(),
            resonanceKnob.boundingBox(),
        ]);
        assert.ok(cutoffBounds);
        assert.ok(resonanceBounds);

        const cutoffPoint = {
            x: cutoffBounds.x + (cutoffBounds.width / 2),
            y: cutoffBounds.y + (cutoffBounds.height / 2),
        };
        await page.mouse.move(cutoffPoint.x, cutoffPoint.y);
        await page.mouse.down();
        await page.mouse.move(cutoffPoint.x - 24, cutoffPoint.y, { steps: 6 });
        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await hud.locator('[data-role="parameter-hud-filter"]').waitFor();
        await page.mouse.up();

        const graphHandleBounds = await graphHandle.boundingBox();
        assert.ok(graphHandleBounds);
        const graphPoint = {
            x: graphHandleBounds.x + (graphHandleBounds.width / 2),
            y: graphHandleBounds.y + (graphHandleBounds.height / 2),
        };
        await page.mouse.move(graphPoint.x, graphPoint.y);
        await page.mouse.down();
        await page.mouse.move(graphPoint.x - 16, graphPoint.y + 8, { steps: 3 });
        await page.waitForTimeout(80);
        assert.equal(
            await hud.evaluate((element) => element.classList.contains("is-visible")),
            false,
            "a direct graph gesture must suppress the still-lingering cutoff HUD",
        );
        await page.mouse.up();

        await page.waitForTimeout(450);
        const resonancePoint = {
            x: resonanceBounds.x + (resonanceBounds.width / 2),
            y: resonanceBounds.y + (resonanceBounds.height / 2),
        };
        await page.mouse.move(resonancePoint.x, resonancePoint.y);
        await page.mouse.down();
        await page.mouse.move(resonancePoint.x + 24, resonancePoint.y, { steps: 6 });
        await hud.locator(".mobile-voice-hud-knob").waitFor();
        assert.equal(await hud.locator('[data-role^="parameter-hud-"]').count(), 0);
        await page.mouse.up();
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("Effects Filter Cutoff drag shows the selected rack filter response", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "filter");

        const cutoffKnob = page.locator('[data-role="rack-parameter-globalFilterCutoff"]');
        await cutoffKnob.waitFor({ state: "visible" });
        const bounds = await cutoffKnob.boundingBox();
        assert.ok(bounds);

        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // The rack cutoff starts at its 20 kHz ceiling, so walk left before
        // comparing live response paths instead of sampling the same clamp.
        await page.mouse.move(startX - 24, startY, { steps: 6 });

        const hud = page.locator('[data-role="mobile-voice-hud"].is-visible');
        await hud.waitFor();
        const response = hud.locator('[data-role="parameter-hud-filter"]');
        assert.equal(await response.count(), 1, await hud.innerHTML());
        assert.equal(await hud.locator(".mobile-voice-hud-knob").count(), 0);
        assert.equal(
            await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
            await cutoffKnob.getAttribute("aria-valuetext"),
        );

        const initialPath = await response.locator('[data-role="filter-response-graph"] path').first().getAttribute("d");
        await page.mouse.move(startX - 72, startY, { steps: 8 });
        const updatedPath = await response.locator('[data-role="filter-response-graph"] path').first().getAttribute("d");
        assert.notEqual(updatedPath, initialPath, "the rack response must follow the live cutoff");

        await page.mouse.up();

        const graphHandle = page.locator(
            '[data-role="rack-editor-filter"] [data-role="filter-response-handle-hit-target"]',
        );
        const graphHandleBounds = await graphHandle.boundingBox();
        assert.ok(graphHandleBounds);
        const graphX = graphHandleBounds.x + (graphHandleBounds.width / 2);
        const graphY = graphHandleBounds.y + (graphHandleBounds.height / 2);
        await page.mouse.move(graphX, graphY);
        await page.mouse.down();
        await page.mouse.move(graphX - 18, graphY + 6, { steps: 3 });
        await page.waitForTimeout(80);
        assert.equal(
            await page.locator('[data-role="mobile-voice-hud"].is-visible').count(),
            0,
            "the Effects Filter graph must suppress its lingering cutoff HUD",
        );
        await page.mouse.up();
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("Distortion Drive HUD uses the live production curve for every shape", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.click('[data-role="mobile-workspace-tab-fx"]');
        await selectRackEffect(page, "drive");

        const driveKnob = page.locator('[data-role="distortion-drive-field"]');
        await driveKnob.waitFor({ state: "visible" });
        const bounds = await driveKnob.boundingBox();
        assert.ok(bounds);
        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        const hud = page.locator('[data-role="mobile-voice-hud"].is-visible');
        const shapeLabels = ["Symmetric", "Asymmetric", "Wavefold"];
        const shapePaths = [];

        for (const [type, label] of shapeLabels.entries()) {
            await page.evaluate(({ nextType }) => {
                window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionDriveDb", 0);
                window.__COSIMO_DESKTOP_HARNESS__.setLaneParamValue("distortionType", nextType);
            }, { nextType: type });
            await page.waitForFunction((expectedLabel) => (
                document.querySelector('[data-role="rack-parameter-distortionType"]')
                    ?.getAttribute("aria-label")?.includes(expectedLabel) === true
            ), label);

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(startX + 24, startY, { steps: 6 });
            await hud.waitFor();

            const visual = hud.locator('[data-role="parameter-hud-distortion"]');
            await visual.waitFor({ timeout: 5_000 });
            assert.equal(await visual.locator('[data-role="distortion-visualizer"]').count(), 1);
            assert.equal(await hud.locator(".mobile-voice-hud-knob").count(), 0);
            assert.equal(
                await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
                await driveKnob.getAttribute("aria-valuetext"),
            );

            const curve = visual.locator('[data-role="distortion-transfer-curve"]');
            const initialPath = await curve.getAttribute("d");
            await page.mouse.move(startX + 48, startY, { steps: 8 });
            await page.waitForFunction((previousPath) => (
                document.querySelector(
                    '[data-role="parameter-hud-distortion"] [data-role="distortion-transfer-curve"]',
                )?.getAttribute("d") !== previousPath
            ), initialPath);
            shapePaths.push(await curve.getAttribute("d"));
            await page.mouse.up();
        }

        assert.equal(new Set(shapePaths).size, 3, "all production distortion shapes must remain distinct");
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});

test("specialized HUD composition stays inside phone, plugin, and desktop viewports", async () => {
    const viewportCases = [
        { label: "phone", width: 320, height: 700, mobile: true },
        { label: "plugin", width: 775, height: 700, mobile: false },
        { label: "desktop", width: 1280, height: 900, mobile: false },
    ];

    for (const viewportCase of viewportCases) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize({
                width: viewportCase.width,
                height: viewportCase.height,
            }),
        });

        try {
            if (viewportCase.mobile) {
                await page.click('[data-role="mobile-workspace-tab-fx"]');
            }
            await selectRackEffect(page, "drive");
            const driveKnob = page.locator('[data-role="distortion-drive-field"]');
            await driveKnob.scrollIntoViewIfNeeded();
            const driveBounds = await driveKnob.boundingBox();
            assert.ok(driveBounds);
            const startX = driveBounds.x + (driveBounds.width / 2);
            const startY = driveBounds.y + (driveBounds.height / 2);
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(startX - 24, startY, { steps: 6 });

            const hud = page.locator('[data-role="mobile-voice-hud"].is-visible');
            await hud.locator('[data-role="parameter-hud-distortion"]').waitFor();
            const bounds = await hud.boundingBox();
            assert.ok(bounds);
            assert.equal(bounds.x >= 0, true, `${viewportCase.label} HUD must not clip left`);
            assert.equal(bounds.y >= 0, true, `${viewportCase.label} HUD must not clip top`);
            assert.equal(
                bounds.x + bounds.width <= viewportCase.width,
                true,
                `${viewportCase.label} HUD must not clip right`,
            );
            assert.equal(
                bounds.y + bounds.height <= viewportCase.height,
                true,
                `${viewportCase.label} HUD must not clip bottom`,
            );
            await page.mouse.up();
        } finally {
            await page.mouse.up().catch(() => {});
            await page.close();
        }
    }
});

test("MSEG Morph HUD shows the realized A/B curve at 0%, midpoint, and 100%", async () => {
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

        const morphKnob = page.locator('[data-role="mseg-editor-cell-morph"]');
        const bounds = await morphKnob.boundingBox();
        assert.ok(bounds);
        const startX = bounds.x + (bounds.width / 2);
        const startY = bounds.y + (bounds.height / 2);
        const hud = page.locator(
            '[data-role="mseg-editor-hud-layer"] [data-role="mobile-voice-hud"].is-visible',
        );

        const sampleRealizedCurve = async ({ dragX, expectedText, startKey = "Home" }) => {
            await morphKnob.focus();
            await page.keyboard.press(startKey);
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.mouse.move(startX + dragX, startY, { steps: 10 });
            await hud.waitFor();
            await page.waitForFunction((text) => (
                document.querySelector('[data-role="mseg-editor-cell-morph"]')
                    ?.getAttribute("aria-valuetext") === text
            ), expectedText);
            const visual = hud.locator('[data-role="parameter-hud-mseg-morph"]');
            await visual.waitFor();
            await page.waitForFunction(() => (
                document.querySelector(
                    '[data-role="parameter-hud-mseg-morph"] [data-role="mseg-preview-effective-curve"]',
                )?.getAttribute("d")?.startsWith("M ") === true
            ));
            assert.equal(await visual.locator('[data-role="mseg-preview-shape-a-curve"]').count(), 1);
            assert.equal(await visual.locator('[data-role="mseg-preview-shape-b-curve"]').count(), 1);
            assert.equal(await hud.locator(".mobile-voice-hud-knob").count(), 0);
            assert.equal(
                await hud.locator('[data-role="mobile-voice-hud-base"]').textContent(),
                expectedText,
            );
            const path = await visual.locator('[data-role="mseg-preview-effective-curve"]').getAttribute("d");
            await page.mouse.up();
            return path;
        };

        const shapeAPath = await sampleRealizedCurve({ dragX: -16, expectedText: "0%" });
        // The shared gesture reserves its first 12px for deliberate
        // activation, then walks Morph's 220px full-range channel.
        const midpointPath = await sampleRealizedCurve({ dragX: 122, expectedText: "50%" });
        const shapeBPath = await sampleRealizedCurve({
            dragX: 16,
            expectedText: "100%",
            startKey: "End",
        });
        assert.notEqual(midpointPath, shapeAPath);
        assert.notEqual(shapeBPath, midpointPath);
        assert.notEqual(shapeBPath, shapeAPath);
    } finally {
        await page.mouse.up().catch(() => {});
        await page.close();
    }
});
