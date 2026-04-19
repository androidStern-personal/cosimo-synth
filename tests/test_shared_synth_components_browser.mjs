import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openModulePage() {
    const page = await browser.newPage();
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), { waitUntil: "load" });
    await page.evaluate(() => {
        const mountPoint = document.getElementById("mount");
        if (mountPoint instanceof HTMLElement) {
            mountPoint.style.width = "720px";
            mountPoint.style.height = "420px";
            mountPoint.style.padding = "24px";
        }
    });
    return page;
}

async function installHarness(page, exportName) {
    await page.evaluate(async (nextExportName) => {
        const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
        const mountPoint = document.getElementById("mount");

        if (!(mountPoint instanceof HTMLElement)) {
            throw new Error("Shared component test mount point is missing.");
        }

        const install = helpers[nextExportName];

        if (typeof install !== "function") {
            throw new Error(`Unknown shared component harness export: ${nextExportName}`);
        }

        await install(mountPoint);
    }, exportName);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => {
        const harness = window.__COSIMO_DESKTOP_MODULE_HARNESS__;
        const getSnapshot = harness?.getSnapshot;

        if (typeof getSnapshot !== "function") {
            throw new Error("Shared component harness snapshot reader is missing.");
        }

        return getSnapshot();
    });
}

async function dragLocatorBy(page, locator, deltaX, deltaY) {
    const box = await locator.boundingBox();

    if (!box) {
        throw new Error("Expected locator bounding box.");
    }

    const startX = box.x + (box.width * 0.5);
    const startY = box.y + (box.height * 0.5);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
    await page.mouse.up();
}

function assertAlmostEqual(actual, expected, epsilon = 1e-3) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `Expected ${actual} to be within ${epsilon} of ${expected}.`,
    );
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function cutoffHzAtX(snapshot, x) {
    const normalized = clamp(
        (x - snapshot.plot.left) / Math.max(1, snapshot.plot.right - snapshot.plot.left),
        0,
        1,
    );
    return Math.exp(Math.log(20) + ((Math.log(20000) - Math.log(20)) * normalized));
}

function xForCutoffHz(snapshot, cutoffHz) {
    const normalized = clamp(
        (Math.log(cutoffHz) - Math.log(20)) / (Math.log(20000) - Math.log(20)),
        0,
        1,
    );
    return snapshot.plot.left + ((snapshot.plot.right - snapshot.plot.left) * normalized);
}

function defaultResonanceCurve(normalizedInput) {
    const x = clamp(normalizedInput, 0, 1);
    const slope = 11.1;
    const center = 0.84;
    const logistic = (sample) => 1 / (1 + Math.exp(-slope * (sample - center)));
    const low = logistic(0);
    const high = logistic(1);
    return clamp((logistic(x) - low) / Math.max(1e-9, high - low), 0, 1);
}

function qAtY(snapshot, y) {
    const qSurface = clamp(
        1 - ((y - snapshot.plot.top) / Math.max(1, snapshot.plot.bottom - snapshot.plot.top)),
        0,
        1,
    );
    return 0.1 + (19.9 * defaultResonanceCurve(qSurface));
}

function pathPointCount(path) {
    const coordinates = path.match(/-?\d+(?:\.\d+)?/g) ?? [];
    return coordinates.length / 2;
}

function inferCurveOrientation(points) {
    assert.ok(points.length >= 4, "Expected enough sampled curve points to infer orientation.");

    const xMonotonic = points.every((point, index) => index === 0 || point.x >= points[index - 1].x - 1e-3);
    const yMonotonicAscending = points.every((point, index) => index === 0 || point.y >= points[index - 1].y - 1e-3);

    if (xMonotonic && !yMonotonicAscending) {
        return "horizontal";
    }

    if (yMonotonicAscending && !xMonotonic) {
        return "vertical";
    }

    throw new Error(`Could not infer orientation from sampled curve points: ${JSON.stringify(points.slice(0, 8))}`);
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("shared wavetable stage mounts with plain props and reports select and retry actions", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedWavetableStageHarness");
        await page.waitForSelector('select[aria-label="Select wavetable"]');

        assert.equal(
            await page.locator('select[aria-label="Select wavetable"] option:checked').textContent(),
            "BS2 - Acid",
        );
        assert.equal(await page.getByText("Frame 65/128").count(), 1);
        assert.equal(await page.getByText("Pos 0.500").count(), 1);

        await page.locator('select[aria-label="Select wavetable"]').selectOption("1");
        await page.getByRole("button", { name: "Retry Load" }).click();

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.changeLog, [1]);
        assert.equal(snapshot.retryCount, 1);
        assert.match(snapshot.className, /min-h-\[220px\]/);
        assert.doesNotMatch(snapshot.className, /min-h-\[356px\]/);
    } finally {
        await page.close();
    }
});

test("shared MSEG overview mounts with plain callbacks and reports editor, slider, and loop actions", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedMsegOverviewHarness");
        await page.waitForSelector('button[aria-label="Open MSEG editor"]');

        await page.getByRole("button", { name: "Open MSEG editor" }).click();

        await page.locator("input.cosimo-range").nth(0).evaluate((element) => {
            const input = element;
            input.value = "0.750";
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await page.locator("input.cosimo-range").nth(1).evaluate((element) => {
            const input = element;
            input.value = "0.500";
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await page.getByRole("button", { name: /Looping|One Shot/ }).click();

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.openLog, ["open"]);
        assert.deepEqual(snapshot.depthLog, [0.75]);
        assert.deepEqual(snapshot.rateLog, [0.5]);
        assert.deepEqual(snapshot.loopLog, [false]);
        assert.equal(snapshot.loopLabel, "One Shot");
        assert.match(snapshot.className, /min-h-\[220px\]/);
        assert.doesNotMatch(snapshot.className, /min-h-\[356px\]/);
    } finally {
        await page.close();
    }
});

test("shared editable MSEG surface mounts with plain points and forwards pointer callbacks", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedEditableMsegSurfaceHarness");
        const surface = page.locator("svg");
        await surface.waitFor({ state: "visible" });

        await surface.evaluate((element) => {
            const target = element;
            target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 120, clientY: 180 }));
            target.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 180, clientY: 120 }));
            target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 180, clientY: 120 }));
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.circleCount, 3);
        assert.equal(snapshot.radii.includes("10"), true);
        assert.equal(snapshot.radii.filter((value) => value === "8").length, 2);
        assert.deepEqual(snapshot.pointerLog, ["down", "move", "up"]);
        assert.match(snapshot.surfaceClassName, /h-\[180px\]/);
        assert.doesNotMatch(snapshot.surfaceClassName, /h-\[320px\]/);
    } finally {
        await page.close();
    }
});

test("shared MSEG preview and editor honor explicit vertical orientation", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedMsegOrientationHarness");
        await page.waitForSelector('[data-testid="preview"]');

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(inferCurveOrientation(snapshot.previewCurvePoints), "horizontal");
        assert.ok(
            snapshot.editorCircleCenters[1].cx < snapshot.editorCircleCenters[2].cx,
            "Horizontal editor should place later time values further right.",
        );

        await page.evaluate(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__.setOrientation("vertical"));
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            const points = snapshotValue?.previewCurvePoints ?? [];
            return points.length >= 4 && points[1].y > points[0].y;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(inferCurveOrientation(snapshot.previewCurvePoints), "vertical");
        assert.ok(
            snapshot.editorCircleCenters[2].cy > snapshot.editorCircleCenters[1].cy,
            "Vertical editor should place later time values lower on the screen.",
        );
        assert.ok(
            snapshot.editorCircleCenters[1].cx > snapshot.editorCircleCenters[2].cx,
            "Vertical editor should map higher MSEG values further right.",
        );
    } finally {
        await page.close();
    }
});

test("shared voice mode toolbar uses plain values and callbacks and respects variable option counts", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedVoiceModeToolbarHarness");
        await page.waitForSelector('button[aria-pressed="true"]');

        await page.getByRole("button", { name: /Mono/ }).click();
        await page.getByRole("button", { name: /Hold/ }).click();

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.changeLog, [1, 3]);
        assert.deepEqual(snapshot.states, [
            { label: "Poly", pressed: "false" },
            { label: "Mono", pressed: "false" },
            { label: "Legato", pressed: "false" },
            { label: "Hold", pressed: "true" },
        ]);
        assert.match(snapshot.optionGridTemplateColumns, /^repeat\(4, minmax\(0(px)?, 1fr\)\)$/);
    } finally {
        await page.close();
    }
});

test("shared voice and glide shell keeps the desktop glide adapter as a slot while owning the voice-mode surface", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedVoiceGlideControlSurfaceHarness");
        await page.waitForSelector('[data-testid="glide-slot"]');

        await page.getByRole("button", { name: /Mono/ }).click();
        await page.getByRole("button", { name: /Legato/ }).click();

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(await page.locator('[data-testid="glide-slot"]').count(), 1);
        assert.deepEqual(snapshot.changeLog, [1, 2]);
        assert.deepEqual(snapshot.states, [
            { label: "Poly", pressed: "false" },
            { label: "Mono", pressed: "false" },
            { label: "Legato", pressed: "true" },
        ]);
        assert.match(snapshot.className, /grid-cols-1/);
        assert.doesNotMatch(snapshot.className, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
    } finally {
        await page.close();
    }
});

test("shared keyboard shell owns octave chrome while keeping the keyboard and toolbar as slots", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedKeyboardSectionShellHarness");
        await page.waitForSelector('[data-testid="toolbar-slot"]');

        const upButton = page.locator('button[aria-label="Shift keyboard up one octave"]');
        const downButton = page.locator('button[aria-label="Shift keyboard down one octave"]');

        assert.equal(await upButton.isDisabled(), false);
        assert.equal(await downButton.isDisabled(), true);
        assert.equal(await page.getByText("C2").count(), 1);

        await upButton.click();
        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.actionLog, ["up"]);
        assert.equal(await page.locator('[data-testid="toolbar-slot"]').count(), 1);
        assert.equal(await page.locator('[data-testid="keyboard-slot"]').count(), 1);

        await page.evaluate(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__.setCanShiftDown(true));
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.buttonState?.downDisabled === false;
        });
        await downButton.click();

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.actionLog, ["up", "down"]);
        assert.match(snapshot.className, /grid-cols-1/);
        assert.match(snapshot.railClassName, /self-start/);
        assert.match(snapshot.contentClassName, /gap-1/);
        assert.doesNotMatch(snapshot.className, /grid-cols-\[56px_minmax\(0,1fr\)\]/);
    } finally {
        await page.close();
    }
});

test("shared filter range editor exposes the universal cutoff, resonance, range, and preview surface", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedFilterRangeEditorHarness");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return (snapshot?.plot?.right - snapshot?.plot?.left) > 500
                && (snapshot?.plot?.bottom - snapshot?.plot?.top) > 200;
        });

        let snapshot = await getHarnessSnapshot(page);
        const expectedHandleX = xForCutoffHz(snapshot, 800);

        assert.equal(Math.round(snapshot.value.cutoffHz), 800);
        assert.deepEqual(snapshot.range, { startCutoffHz: 200, endCutoffHz: 3200 });
        assertAlmostEqual(snapshot.valueHandle.x, expectedHandleX, 0.75);
        assert.equal(snapshot.surfaceTouchAction, "none");
        assert.equal(snapshot.valueHitTargetTabIndex, "0");
        assert.equal(snapshot.rangeEndHitTargetTabIndex, "0");
        assertAlmostEqual(snapshot.previewHandle.x, xForCutoffHz(snapshot, 3200), 0.75);
        assert.equal(pathPointCount(snapshot.valuePath), 360);
        assert.equal(pathPointCount(snapshot.previewPath), 360);
        assert.deepEqual(snapshot.modeCycleButton, {
            ariaLabel: "Cycle filter mode, currently LP",
            modeLabel: "LP",
            title: "Filter mode: LP",
        });
        assert.equal(snapshot.readoutCenter, "Center800 Hz");
        assert.equal(snapshot.readoutRange, "Range200 Hz to 3.20 kHz");
        assert.equal(snapshot.readoutWidth, "Width4.00 oct");
        assert.equal(snapshot.readoutQ, "Q4.00");
        assert.equal(snapshot.chipCount, 4);
        assert.equal(snapshot.chipCenterCutoff, "800");
        assert.equal(snapshot.chipCenterQ, "Q 4.0");
        assert.equal(snapshot.chipStart, "200");
        assert.equal(snapshot.chipEnd, "3.20k");
        assert.equal(snapshot.chipSpanDirectionValue, "up");
        assert.equal(snapshot.chipSpanOctaves, "4.00 oct");
        const labelHandleGap = await page.locator('[data-role="filter-range-editor"]').evaluate((node) => {
            const labels = Array.from(node.querySelectorAll('[data-role="filter-range-frequency-label"]'));
            const handles = Array.from(node.querySelectorAll(
                '[data-role="filter-range-start-hit-target"], [data-role="filter-range-end-hit-target"]',
            ));
            const minLabelTop = Math.min(...labels.map((label) => label.getBoundingClientRect().top));
            const maxHandleBottom = Math.max(...handles.map((handle) => handle.getBoundingClientRect().bottom));

            return minLabelTop - maxHandleBottom;
        });
        assert.ok(
            labelHandleGap > 0,
            `frequency labels should stay below range handle hit targets, got ${labelHandleGap}px gap`,
        );

        await page.locator('[data-role="filter-range-mode-cycle-button"]').click();
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.value?.mode === "highpass";
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.value.mode, "highpass");
        assert.deepEqual(snapshot.modeCycleButton, {
            ariaLabel: "Cycle filter mode, currently HP",
            modeLabel: "HP",
            title: "Filter mode: HP",
        });

        const beforeStartDrag = snapshot;
        await dragLocatorBy(page, page.locator('[data-role="filter-range-start-hit-target"]'), 80, 0);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.rangeLog?.length >= 1;
        });

        snapshot = await getHarnessSnapshot(page);
        const expectedDraggedStartCutoff = cutoffHzAtX(beforeStartDrag, beforeStartDrag.rangeStartHandle.x + 80);
        assertAlmostEqual(snapshot.range.startCutoffHz, expectedDraggedStartCutoff, 4);
        assertAlmostEqual(snapshot.range.endCutoffHz, beforeStartDrag.range.endCutoffHz, 1e-6);
        assertAlmostEqual(snapshot.value.cutoffHz, beforeStartDrag.value.cutoffHz, 1e-6);
        assert.equal(snapshot.readoutCenter, "Center800 Hz");
        assert.deepEqual(snapshot.editLog.slice(0, 2), ["start:range-start", "end:range-start"]);

        const beforeEndDrag = snapshot;
        await dragLocatorBy(page, page.locator('[data-role="filter-range-end-hit-target"]'), -72, 0);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.rangeLog?.length >= 2;
        });

        snapshot = await getHarnessSnapshot(page);
        const expectedDraggedEndCutoff = cutoffHzAtX(beforeEndDrag, beforeEndDrag.rangeEndHandle.x - 72);
        assertAlmostEqual(snapshot.range.startCutoffHz, beforeEndDrag.range.startCutoffHz, 1e-6);
        assertAlmostEqual(snapshot.range.endCutoffHz, expectedDraggedEndCutoff, 5);
        assertAlmostEqual(snapshot.value.cutoffHz, beforeEndDrag.value.cutoffHz, 1e-6);
        assert.equal(snapshot.readoutCenter, "Center800 Hz");
        assert.equal(snapshot.chipSpanDirectionValue, "up");
        assert.deepEqual(snapshot.editLog.slice(-2), ["start:range-end", "end:range-end"]);

        const beforeValueDrag = snapshot;
        await dragLocatorBy(page, page.locator('[data-role="filter-range-value-hit-target"]'), 90, 44);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.valueLog?.length >= 1;
        });

        snapshot = await getHarnessSnapshot(page);
        assertAlmostEqual(snapshot.value.cutoffHz, cutoffHzAtX(beforeValueDrag, beforeValueDrag.valueHandle.x + 90), 8);
        assertAlmostEqual(snapshot.value.q, qAtY(beforeValueDrag, beforeValueDrag.valueHandle.y + 44), 0.12);
        assert.deepEqual(snapshot.editLog.slice(-2), ["start:value", "end:value"]);
    } finally {
        await page.close();
    }
});

test("shared filter range editor can hide inactive preview state", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedFilterRangeEditorHarness");
        await page.waitForSelector('[data-role="filter-range-preview-handle"]');

        await page.evaluate(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__.setPreviewActive(false));
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.previewHandle === null && snapshot?.previewPath === "";
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.previewActive, false);
        assert.equal(snapshot.previewHandle, null);
        assert.equal(snapshot.previewPath, "");
    } finally {
        await page.close();
    }
});

test("shared filter range editor supports Cosimo unipolar cutoff ranges from the base cutoff", async () => {
    const page = await openModulePage();

    try {
        await installHarness(page, "installSharedFilterRangeEditorHarness");
        await page.waitForSelector('[data-role="filter-range-value-hit-target"]');
        await page.evaluate(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__.setRangePolarity("unipolar"));
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshot?.rangePolarity === "unipolar"
                && snapshot?.rangeStartHandle === null
                && snapshot?.rangeStartHitTargetCount === 0;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.rangePolarity, "unipolar");
        assert.equal(snapshot.rangeStartHandle, null);
        assert.equal(snapshot.rangeStartHitTargetCount, 0);
        assertAlmostEqual(snapshot.range.startCutoffHz, snapshot.value.cutoffHz, 1e-6);
        assertAlmostEqual(
            snapshot.rangeBand.x,
            Math.min(snapshot.valueHandle.x, snapshot.rangeEndHandle.x),
            0.75,
        );

        const beforeEndDrag = snapshot;
        await dragLocatorBy(page, page.locator('[data-role="filter-range-end-hit-target"]'), 72, 0);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.rangeLog?.length >= 1;
        });

        snapshot = await getHarnessSnapshot(page);
        assertAlmostEqual(snapshot.value.cutoffHz, beforeEndDrag.value.cutoffHz, 1e-6);
        assertAlmostEqual(snapshot.range.startCutoffHz, snapshot.value.cutoffHz, 1e-6);
        assertAlmostEqual(snapshot.range.endCutoffHz, cutoffHzAtX(beforeEndDrag, beforeEndDrag.rangeEndHandle.x + 72), 8);

        const beforeValueDrag = snapshot;
        const previousUnipolarOctaves = Math.log2(beforeValueDrag.range.endCutoffHz / beforeValueDrag.value.cutoffHz);
        await dragLocatorBy(page, page.locator('[data-role="filter-range-value-hit-target"]'), 64, 0);
        await page.waitForFunction(() => {
            const snapshotValue = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.();
            return snapshotValue?.valueLog?.length >= 1;
        });

        snapshot = await getHarnessSnapshot(page);
        const expectedBaseCutoff = cutoffHzAtX(beforeValueDrag, beforeValueDrag.valueHandle.x + 64);
        assertAlmostEqual(snapshot.value.cutoffHz, expectedBaseCutoff, 8);
        assertAlmostEqual(snapshot.range.startCutoffHz, expectedBaseCutoff, 8);
        assertAlmostEqual(snapshot.range.endCutoffHz, expectedBaseCutoff * (2 ** previousUnipolarOctaves), 16);
    } finally {
        await page.close();
    }
});
