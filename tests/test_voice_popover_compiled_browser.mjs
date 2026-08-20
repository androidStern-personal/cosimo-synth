import assert from "node:assert/strict";
import test from "node:test";

import {
    collapseGlobalModRail,
    expandGlobalModRail,
    openBuiltDesktopBundlePage,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

const PHONE_VIEWPORT = { width: 393, height: 852 };

async function readBuiltVoicePopoverOpen(page) {
    return page.evaluate(() => Boolean(
        document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="mobile-global-mod-rail-voice-popover"]'),
    ));
}

async function waitForBuiltVoicePopover(page, open) {
    await page.waitForFunction((expectedOpen) => Boolean(
        document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="mobile-global-mod-rail-voice-popover"]'),
    ) === expectedOpen, open);
}

async function touchTap(page, cdp, locator, afterTouchStart = null) {
    const box = await locator.boundingBox();
    assert.ok(box, "The touch target must have a rendered bounding box.");
    const point = {
        x: box.x + (box.width / 2),
        y: box.y + (box.height / 2),
        radiusX: 5,
        radiusY: 5,
        force: 1,
    };

    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
    });
    try {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        await afterTouchStart?.();
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
}

async function touchDragHorizontally(page, cdp, locator, deltaX) {
    const box = await locator.boundingBox();
    assert.ok(box, "The Glide touch target must have a rendered bounding box.");
    const start = {
        x: box.x + (box.width / 2),
        y: box.y + (box.height / 2),
    };

    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
    });
    try {
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((deltaX * step) / 4),
                    y: start.y,
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

test("compiled shadow-root Voice popover accepts touch controls and preserves dismissal", async () => {
    const page = await openBuiltDesktopBundlePage({
        beforeGoto: (nextPage) => nextPage.setViewportSize(PHONE_VIEWPORT),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-global-mod-rail"]') instanceof HTMLElement
        ));
        await page.waitForTimeout(240);
        await expandGlobalModRail(page);

        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const voiceToggle = rail.locator('[data-role="mobile-global-mod-rail-voice-toggle"]');
        assert.equal((await voiceToggle.textContent())?.trim(), "Poly");

        await touchTap(page, cdp, voiceToggle);
        await waitForBuiltVoicePopover(page, true);

        const popover = page.locator('[data-role="mobile-global-mod-rail-voice-popover"]');
        const monoOption = popover.locator(".mobile-global-mod-rail-voice-mode", { hasText: "Mono" });
        let popoverOpenDuringMonoTouch = false;
        await touchTap(page, cdp, monoOption, async () => {
            popoverOpenDuringMonoTouch = await readBuiltVoicePopoverOpen(page);
        });
        assert.equal(
            popoverOpenDuringMonoTouch,
            true,
            "Touching Mono inside the compiled shadow-root popover must not dismiss it on pointerdown.",
        );
        assert.equal(
            await readBuiltVoicePopoverOpen(page),
            true,
            "The compiled Voice popover must remain open after the Mono tap commits.",
        );

        await page.waitForFunction(() => (
            window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot().sentMessages
                .some(({ endpointID, value }) => endpointID === "playMode" && Number(value) === 1)
        ));
        assert.equal(await monoOption.getAttribute("aria-checked"), "true");
        assert.equal((await voiceToggle.textContent())?.trim(), "Mono");

        const glide = popover.locator(".mobile-global-mod-rail-voice-glide");
        assert.equal(await glide.getAttribute("data-disabled"), "false");
        assert.equal(await glide.evaluate((element) => element.inert), false);

        await touchDragHorizontally(page, cdp, glide.locator('[aria-label="Glide time"]'), 36);
        await page.waitForFunction(() => (
            window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot().sentMessages
                .some(({ endpointID, value }) => endpointID === "glideTime" && Number(value) > 0.15)
        ));
        assert.equal(
            await readBuiltVoicePopoverOpen(page),
            true,
            "Operating the enabled Glide control must keep the compiled Voice popover open.",
        );

        const parameterMessages = await page.evaluate(() => (
            window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot().sentMessages
                .filter(({ endpointID }) => endpointID === "playMode" || endpointID === "glideTime")
        ));
        assert.equal(
            parameterMessages.some(({ endpointID, value }) => endpointID === "playMode" && Number(value) === 1),
            true,
            "The Mono tap must change the playMode host parameter.",
        );
        assert.equal(
            parameterMessages.some(({ endpointID, value }) => endpointID === "glideTime" && Number(value) > 0.15),
            true,
            "The enabled Glide drag must change the glideTime host parameter.",
        );

        await touchTap(page, cdp, page.locator('[data-role="mobile-workspace-tab-voice"]'));
        await waitForBuiltVoicePopover(page, false);
        assert.equal((await voiceToggle.textContent())?.trim(), "Mono");

        await touchTap(page, cdp, voiceToggle);
        await waitForBuiltVoicePopover(page, true);
        await collapseGlobalModRail(page);
        await waitForBuiltVoicePopover(page, false);
        assert.equal(await rail.getAttribute("data-expanded"), "false");
    } finally {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
            .catch(() => undefined);
        await page.close();
    }
});
