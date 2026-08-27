import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";

let server;
let browser;

async function openAmountOnlyHarnessPage() {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.goto(new URL("tests/helpers/module_test_shell.html", server.baseUrl).toString(), {
        waitUntil: "load",
    });
    await page.evaluate(async () => {
        const helpers = await import("/tests/helpers/desktop_patch_modules_browser.tsx");
        const mountPoint = document.getElementById("mount");
        if (!(mountPoint instanceof HTMLElement)) {
            throw new Error("Module test mount point is missing.");
        }
        mountPoint.style.width = "345px";
        mountPoint.style.height = "760px";
        mountPoint.style.padding = "24px";
        await helpers.installMobileModMappingsAmountOnlyHarness(mountPoint);
    });
    await page.locator('[data-role="mod-mappings-amount-only"]').waitFor();
    return page;
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.());
}

async function invokeHarness(page, methodName, ...args) {
    return page.evaluate(([nextMethodName, nextArgs]) => {
        const method = window.__COSIMO_DESKTOP_MODULE_HARNESS__?.[nextMethodName];
        if (typeof method !== "function") {
            throw new Error(`Desktop module harness method ${nextMethodName} is missing.`);
        }
        return method(...nextArgs);
    }, [methodName, args]);
}

async function dragLocatorBy(page, locator, deltaX, deltaY) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds);
    const startX = bounds.x + (bounds.width / 2);
    const startY = bounds.y + (bounds.height / 2);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 4 });
    await page.mouse.up();
}

async function openExactValueEntry(page, control) {
    const bounds = await control.boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + (bounds.width / 2), bounds.y + (bounds.height / 2));
    await page.mouse.down();
    await page.locator('[data-role="rack-parameter-menu"]').waitFor({
        state: "visible",
        timeout: 10000,
    });
    await page.mouse.up();
    await page.click('[data-role="rack-parameter-menu-item"][data-action="edit-values"]');
    const amountInput = page.locator('[data-role="rack-modulation-value-input"]');
    await amountInput.waitFor();
    return amountInput;
}

before(async () => {
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("controlled amount-only MAPPINGS control edits its route amount by vertical drag", async () => {
    const page = await openAmountOnlyHarnessPage();
    try {
        const control = page.locator('[data-role="mod-mappings-amount-only"]');
        assert.equal(await control.getAttribute("role"), "slider");
        await dragLocatorBy(page, control, 0, -44);
        await page.waitForFunction(() => (
            Number(window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().routeAmount) > 0.01
        ));
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.baseValue, 0.625);
        assert.equal(await control.getAttribute("data-dragging"), null);
    } finally {
        await page.close();
    }
});

test("controlled amount-only MAPPINGS control exposes exact amount entry without a base row", async () => {
    const page = await openAmountOnlyHarnessPage();
    try {
        const control = page.locator('[data-role="mod-mappings-amount-only"]');
        const amountInput = await openExactValueEntry(page, control);
        assert.equal(await page.locator('[data-role="rack-base-value-input"]').count(), 0);
        await amountInput.fill("0.37 s");
        await page.click('[data-role="rack-value-sheet-apply"]');
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_MODULE_HARNESS__?.getSnapshot?.().routeAmount) - 0.37) < 0.0001
        ));
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.baseValue, 0.625);
    } finally {
        await page.close();
    }
});

test("controlled amount-only MAPPINGS capture loss cancels its long press and closes the route gesture", async () => {
    const page = await openAmountOnlyHarnessPage();
    try {
        const control = page.locator('[data-role="mod-mappings-amount-only"]');
        await control.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const init = {
                bubbles: true,
                pointerId: 66,
                pointerType: "touch",
                button: 0,
                buttons: 1,
                clientX: bounds.left + (bounds.width / 2),
                clientY: bounds.top + (bounds.height / 2),
            };
            element.dispatchEvent(new PointerEvent("pointerdown", init));
            element.dispatchEvent(new PointerEvent("lostpointercapture", init));
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-amount-only"]')?.hasAttribute("data-dragging") === false
        ));
        await page.waitForTimeout(700);
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.routeAmount, 0);
        assert.equal(snapshot.baseValue, 0.625);
    } finally {
        await page.close();
    }
});

test("unmounting a controlled amount-only MAPPINGS control cancels its pending long press", async () => {
    const page = await openAmountOnlyHarnessPage();
    try {
        const control = page.locator('[data-role="mod-mappings-amount-only"]');
        await control.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            element.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 67,
                pointerType: "touch",
                button: 0,
                buttons: 1,
                clientX: bounds.left + (bounds.width / 2),
                clientY: bounds.top + (bounds.height / 2),
            }));
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mod-mappings-amount-only"]')?.getAttribute("data-dragging")
                === "modulation"
        ));
        await invokeHarness(page, "setPanelVisible", false);
        await control.waitFor({ state: "detached" });
        await page.waitForTimeout(700);
        assert.equal(await page.locator('[data-role="rack-parameter-menu"]').count(), 0);
        const snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.routeAmount, 0);
        assert.equal(snapshot.baseValue, 0.625);
    } finally {
        await page.close();
    }
});
