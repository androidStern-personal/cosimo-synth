import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

async function openTestHost({
    viewport = { width: 900, height: 700 },
    modBarPlacement = "floating",
} = {}) {
    const page = await browser.newPage({ viewport });
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString());
    await page.evaluate(async (initialModBarPlacement) => {
        const module = await import("/tests/helpers/polish_fullscreen_editor_browser.tsx");
        module.mountPolishFullScreenEditorTest(initialModBarPlacement);
    }, modBarPlacement);
    await page.locator("[data-role='open-polish-editor']").waitFor();
    return page;
}

test("the controlled full-screen surface opens, explains Comp, and closes without new controls", async () => {
    const page = await openTestHost();
    try {
        const opener = page.locator("[data-role='open-polish-editor']");
        await opener.click();
        const dialog = page.locator("[data-role='polish-fullscreen-editor']");
        await dialog.waitFor();

        assert.deepEqual(
            await dialog.locator("[data-polish-stage]").evaluateAll((stages) => (
                stages.map((stage) => stage.getAttribute("data-polish-stage"))
            )),
            ["safe-bass", "enhancer", "compressor", "soft-clipper", "output-trim"],
        );
        assert.match(
            await dialog.locator("[data-role='polish-comp-explanation']").textContent(),
            /compression.+soft clipping/i,
        );
        assert.equal(await dialog.locator("[data-role^='approved-polish-control-']").count(), 4);
        assert.equal(await dialog.locator("[data-role^='approved-polish-action-']").count(), 4);
        assert.equal(
            await dialog.locator(
                "[data-polish-stage='soft-clipper'] [data-role^='approved-polish-action-']",
            ).count(),
            0,
        );
        assert.equal(await dialog.locator("input, [data-role*='advanced']").count(), 0);
        assert.equal(
            await dialog.locator("[data-polish-stage='soft-clipper']").getAttribute("data-stage-active"),
            "false",
        );
        assert.equal(
            await dialog.locator("[data-polish-stage='compressor']").getAttribute("data-stage-active"),
            "false",
        );

        await dialog.locator("[data-role='polish-fullscreen-close']").click();
        assert.equal(await dialog.count(), 0);
        assert.equal(await opener.evaluate((element) => document.activeElement === element), true);
    } finally {
        await page.close();
    }
});

test("live telemetry rerenders preserve focus on the non-modal full-page surface", async () => {
    const page = await openTestHost();
    try {
        await page.locator("[data-role='open-polish-editor']").click();
        const compControl = page.locator("[data-role='approved-polish-control-comp']");
        await compControl.focus();
        await page.evaluate(() => window.__POLISH_FULLSCREEN_TEST__.rerenderWithTelemetry());

        assert.equal(await compControl.evaluate((element) => document.activeElement === element), true);
        assert.equal(
            await page.locator("[data-role='open-polish-editor']").evaluate((element) => element.inert),
            false,
        );
        assert.equal(
            await page.locator("[data-role='polish-fullscreen-editor']").getAttribute("aria-modal"),
            null,
        );
    } finally {
        await page.close();
    }
});

function rectanglesOverlap(first, second) {
    return first.x < second.x + second.width
        && first.x + first.width > second.x
        && first.y < second.y + second.height
        && first.y + first.height > second.y;
}

test("the full-screen graph keeps a known 200 Hz spectrum peak on its labeled log tick", async () => {
    for (const width of [393, 820, 1_440]) {
        const page = await openTestHost({ viewport: { width, height: 760 } });
        try {
            await page.locator("[data-role='open-polish-editor']").click();
            const graph = page.locator("[data-role='enhancer-spectrum-graph']");
            const tick = graph.locator("[data-frequency-hz='200']").first();
            await tick.waitFor();

            const alignment = await graph.evaluate((svg) => {
                const tickGroup = svg.querySelector("[data-frequency-hz='200']");
                const tickPath = tickGroup?.querySelector("path")?.getAttribute("d") ?? "";
                const tickX = Number(tickPath.match(/^M ([\d.]+)/)?.[1]);
                const spectrumPath = svg.querySelector("[data-role='enhancer-spectrum-incoming']")
                    ?.getAttribute("d") ?? "";
                const points = [...spectrumPath.matchAll(/[ML] ([\d.]+) ([\d.]+)/g)]
                    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
                const peak = points.reduce((best, point) => point.y < best.y ? point : best);
                const rect = svg.getBoundingClientRect();
                return {
                    tickX,
                    peakX: peak.x,
                    tickClientX: rect.left + tickX / 760 * rect.width,
                    peakClientX: rect.left + peak.x / 760 * rect.width,
                    renderedWidth: rect.width,
                    density: Number(svg.getAttribute("data-rendered-width-density")),
                };
            });

            assert.equal(alignment.peakX, alignment.tickX, `${width}px logical X drifted`);
            assert.ok(
                Math.abs(alignment.peakClientX - alignment.tickClientX) < 0.01,
                `${width}px rendered X drifted`,
            );
            assert.equal(
                alignment.density,
                alignment.renderedWidth < 320
                    ? 4
                    : (alignment.renderedWidth < 480 ? 5 : (alignment.renderedWidth < 720 ? 7 : 10)),
            );
        } finally {
            await page.close();
        }
    }
});

test("floating and parked Mod bars stay usable without covering close or final controls", async () => {
    for (const modBarPlacement of ["floating", "parked"]) {
        const page = await openTestHost({
            viewport: { width: 393, height: 640 },
            modBarPlacement,
        });
        try {
            await page.locator("[data-role='open-polish-editor']").click();
            const dialog = page.locator("[data-role='polish-fullscreen-editor']");
            const modBar = page.locator("[data-role='mobile-bottom-dock']");
            const close = dialog.locator("[data-role='polish-fullscreen-close']");
            const trim = dialog.locator("[data-role='approved-polish-control-trim']");
            await trim.scrollIntoViewIfNeeded();

            const [modBarBounds, closeBounds, trimBounds] = await Promise.all([
                modBar.boundingBox(),
                close.boundingBox(),
                trim.boundingBox(),
            ]);
            assert.ok(modBarBounds && closeBounds && trimBounds);
            assert.equal(rectanglesOverlap(modBarBounds, closeBounds), false);
            assert.equal(rectanglesOverlap(modBarBounds, trimBounds), false);

            await page.locator("[data-role='test-mod-bar-audition']").click();
            assert.equal(
                await page.evaluate(() => window.__POLISH_FULLSCREEN_TEST__.auditionCount()),
                1,
            );
            assert.equal(await dialog.count(), 1);
        } finally {
            await page.close();
        }
    }
});
