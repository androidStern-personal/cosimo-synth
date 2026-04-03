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
