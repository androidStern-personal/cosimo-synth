import assert from "node:assert/strict";
import test from "node:test";

import {
    collapseGlobalModRail,
    expandGlobalModRail,
    openBuiltDesktopBundlePage,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

const PHONE_VIEWPORT = { width: 393, height: 852 };
const SHORT_PHONE_VIEWPORT = { width: 320, height: 568 };
const MOD_RAIL_POSITION_KEY = "cosimo.mobile-global-mod-rail.position.v1";

async function builtModRailGripPoint(page) {
    const bounds = await page.locator('[data-role="mobile-global-mod-rail-grip"]').boundingBox();
    assert.ok(bounds, "The compiled Mod rail grip must be rendered.");
    return { x: bounds.x + 28, y: bounds.y + 12 };
}

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

test("compiled 320px Voice keeps the Mod rail above fixed-edge controls while it moves and expands", async () => {
    const page = await openBuiltDesktopBundlePage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize(SHORT_PHONE_VIEWPORT);
            await nextPage.addInitScript(({ positionKey }) => {
                localStorage.setItem(positionKey, JSON.stringify({
                    version: 2,
                    edge: "right",
                    normalizedY: 0,
                }));
            }, { positionKey: MOD_RAIL_POSITION_KEY });
        },
    });
    let pointerDown = false;

    try {
        const rail = page.locator('[data-role="mobile-global-mod-rail"]');
        const warp = page.locator('[data-role="mobile-voice-warp-mode"]');
        await rail.waitFor();
        await warp.waitFor();
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-voice-warp-mode"]')
                ?.getAttribute("data-host-state") === "ready"
        ));
        await page.waitForTimeout(240);

        const overlap = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot;
            const railElement = root?.querySelector('[data-role="mobile-global-mod-rail"]');
            const warpElement = root?.querySelector('[data-role="mobile-voice-warp-mode"]');
            const toolbar = root?.querySelector('[data-role="mobile-voice-toolbar"]');
            const previous = root?.querySelector('[data-role="mobile-voice-page-previous"]');
            const next = root?.querySelector('[data-role="mobile-voice-page-next"]');
            if (
                !(root instanceof ShadowRoot)
                || !(railElement instanceof HTMLElement)
                || !(warpElement instanceof HTMLElement)
                || !(toolbar instanceof HTMLElement)
                || !(previous instanceof HTMLElement)
                || !(next instanceof HTMLElement)
            ) {
                return null;
            }
            const railBounds = railElement.getBoundingClientRect();
            const warpBounds = warpElement.getBoundingClientRect();
            const toolbarBounds = toolbar.getBoundingClientRect();
            const previousBounds = previous.getBoundingClientRect();
            const nextBounds = next.getBoundingClientRect();
            const intersection = {
                left: Math.max(railBounds.left, warpBounds.left),
                right: Math.min(railBounds.right, warpBounds.right),
                top: Math.max(railBounds.top, warpBounds.top),
                bottom: Math.min(railBounds.bottom, warpBounds.bottom),
            };
            const overlapPoint = {
                x: (intersection.left + intersection.right) / 2,
                y: (intersection.top + intersection.bottom) / 2,
            };
            const hit = root.elementFromPoint(overlapPoint.x, overlapPoint.y);
            return {
                viewport: { width: window.innerWidth, height: window.innerHeight },
                expanded: railElement.getAttribute("data-expanded"),
                railTop: railBounds.top,
                intersectionWidth: intersection.right - intersection.left,
                intersectionHeight: intersection.bottom - intersection.top,
                overlapPoint,
                overlapOwnedByRail: hit instanceof Element && railElement.contains(hit),
                toolbarLeft: toolbarBounds.left,
                toolbarRight: toolbarBounds.right,
                previousLeft: previousBounds.left,
                nextRight: nextBounds.right,
            };
        });
        assert.ok(overlap, "The compiled Voice surface must expose its rail, Warp chip, and toolbar.");
        assert.deepEqual(overlap.viewport, SHORT_PHONE_VIEWPORT);
        assert.equal(overlap.expanded, "false");
        assert.equal(overlap.intersectionWidth >= 8, true, "The collapsed rail must genuinely overlap the Warp chip.");
        assert.equal(overlap.intersectionHeight >= 8, true, "The collapsed rail must genuinely overlap the Warp chip.");
        assert.equal(overlap.overlapOwnedByRail, true, "The Mod rail must own pixels where it overlaps the Warp chip.");
        assert.equal(Math.abs(overlap.previousLeft - overlap.toolbarLeft) <= 0.5, true);
        assert.equal(Math.abs(overlap.nextRight - overlap.toolbarRight) <= 0.5, true);

        const gripPoint = await builtModRailGripPoint(page);
        await page.mouse.move(gripPoint.x, gripPoint.y);
        await page.mouse.down();
        pointerDown = true;
        let previousRailTop = overlap.railTop;
        for (let step = 1; step <= 5; step += 1) {
            const fingerDelta = step * 20;
            await page.mouse.move(gripPoint.x, gripPoint.y + fingerDelta);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
            const railBounds = await rail.boundingBox();
            assert.ok(railBounds, "The compiled Mod rail must stay rendered during capture.");
            assert.equal(
                Math.abs((railBounds.y - overlap.railTop) - fingerDelta) <= 3,
                true,
                `The compiled rail must follow the finger at ${fingerDelta}px; measured ${railBounds.y - overlap.railTop}px.`,
            );
            assert.equal(railBounds.y > previousRailTop, true, "Every downward finger step must advance the rail.");
            previousRailTop = railBounds.y;
        }
        await page.mouse.up();
        pointerDown = false;
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-global-mod-rail"]')
                ?.getAttribute("data-decelerating") === "false"
        ));
        assert.equal(await rail.getAttribute("data-expanded"), "false", "Dragging must not toggle the rail.");

        await expandGlobalModRail(page);
        const drawer = page.locator('[data-role="mobile-global-mod-rail-drawer"]');
        const sourcePage = drawer.locator('.rack-mod-page:not([aria-hidden="true"])');
        const sources = sourcePage.locator(".rack-mod-source");
        const drawerGeometry = await drawer.evaluate((element) => {
            const activePage = element.querySelector('.rack-mod-page:not([aria-hidden="true"])');
            return {
                drawerHeight: element.getBoundingClientRect().height,
                sourcePageHeight: activePage?.getBoundingClientRect().height ?? 0,
            };
        });
        assert.equal(await sources.count(), 3, "The compiled drawer must retain all three sources.");
        assert.equal(
            drawerGeometry.drawerHeight >= drawerGeometry.sourcePageHeight - 0.5,
            true,
            `The compiled drawer must expose one complete source page: ${JSON.stringify(drawerGeometry)}`,
        );
        for (let index = 0; index < 3; index += 1) {
            await sources.nth(index).click({ trial: true });
        }
        const autoToggle = drawer.locator('[data-role="mobile-global-mod-rail-auto-toggle"]');
        const beforePressed = await autoToggle.getAttribute("aria-pressed");
        await autoToggle.click();
        assert.notEqual(await autoToggle.getAttribute("aria-pressed"), beforePressed);
    } finally {
        if (pointerDown) {
            await page.mouse.up().catch(() => undefined);
        }
        await page.close();
    }
});

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
