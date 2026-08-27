import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { openBuiltDesktopBundlePage } from "./helpers/desktop_patch_view_browser_suite.mjs";

const PHONE_VIEWPORT = { width: 393, height: 852 };
const generatedDirectory = path.resolve("build", "developer-settings-generated");
const ordinaryBundlePath = path.join(generatedDirectory, "ordinary-app.js");
const sitesBundlePath = path.join(generatedDirectory, "sites-app.js");
const ordinaryModuleUrl = "/build/developer-settings-generated/ordinary-app.js";
const sitesModuleUrl = "/build/developer-settings-generated/sites-app.js";
const expectedCopiedSettings = [
    "Cosimo Developer settings",
    "",
    "[Auto-preview algorithm]",
    'algorithm: "paced"',
    "settleMs: 330",
    "minGapMs: 525",
    "holdMs: 8500",
    "loopSync: false",
    "",
    "[Mod drag feel]",
    "drag.activationPx: 19",
    "drag.rampPx: 140",
    "drag.gainMin: 1.75",
    "drag.gainMax: 5.25",
    "drag.referenceTravelPx: 444",
    "",
    "[Mod bar]",
    "modBar.scale: 1.22",
    'modBar.placement: "parked"',
    'modBar.parkedVisibility: "visible"',
].join("\n");

async function openPhoneBundle(compiledModuleUrl, { clipboard = false } = {}) {
    return openBuiltDesktopBundlePage({
        compiledModuleUrl,
        beforeGoto: async (page) => {
            await page.setViewportSize(PHONE_VIEWPORT);
            await page.addInitScript(() => {
                localStorage.removeItem("cosimo.mod-bar.preferences.v1");
            });
            if (clipboard) {
                await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
            }
        },
    });
}

async function openPresetActions(page) {
    const presetBar = page.locator("cosimo-preset-bar");
    const menuButton = presetBar.locator('[data-action="toggle-shell-menu"]');
    await menuButton.waitFor({ state: "visible" });
    await menuButton.click();
    await presetBar.locator(".shell-menu.open").waitFor({ state: "visible" });
    return presetBar;
}

test("generated ordinary and Codex Sites builds gate the complete developer settings clipboard flow", async () => {
    const [ordinarySource, sitesSource] = await Promise.all([
        fs.readFile(ordinaryBundlePath, "utf8"),
        fs.readFile(sitesBundlePath, "utf8"),
    ]);
    assert.doesNotMatch(ordinarySource, /Copy settings/u);
    assert.match(sitesSource, /Copy settings/u);

    const ordinaryPage = await openPhoneBundle(ordinaryModuleUrl);
    try {
        const presetBar = await openPresetActions(ordinaryPage);
        const tuningRow = presetBar.locator('[data-action="perf-tuning"]');
        assert.equal(await tuningRow.isHidden(), true);
        assert.equal(await presetBar.locator('.shell-menu.open [data-action="save-as"]').isVisible(), true);
        assert.equal(await presetBar.locator('.shell-menu.open [data-action="copy"]').isVisible(), true);
        assert.equal(await presetBar.locator('.shell-menu.open [data-action="paste"]').isVisible(), true);

        await tuningRow.evaluate((button) => button.click());
        assert.equal(await ordinaryPage.locator('[data-role="perf-tuning-page"]').count(), 0);
    } finally {
        await ordinaryPage.close();
    }

    const sitesPage = await openPhoneBundle(sitesModuleUrl, { clipboard: true });
    try {
        const presetBar = await openPresetActions(sitesPage);
        const tuningRow = presetBar.locator('[data-action="perf-tuning"]');
        assert.equal(await tuningRow.isVisible(), true);
        assert.equal((await tuningRow.textContent())?.trim(), "Developer settings");
        await tuningRow.click();

        const tuningPage = sitesPage.locator('[data-role="perf-tuning-page"]');
        await tuningPage.waitFor({ state: "visible" });
        assert.deepEqual(
            await tuningPage.locator("section h3").allTextContents(),
            ["Auto-preview algorithm", "Mod drag feel", "Mod bar"],
        );
        assert.deepEqual(
            await tuningPage.locator("[data-perf-tuning-key]").evaluateAll((controls) => (
                controls.map((control) => control.getAttribute("data-perf-tuning-key"))
            )),
            [
                "settleMs",
                "minGapMs",
                "holdMs",
                "loopSync",
                "drag.activationPx",
                "drag.rampPx",
                "drag.gainMin",
                "drag.gainMax",
                "drag.referenceTravelPx",
                "modBar.scale",
            ],
        );
        assert.deepEqual(
            await tuningPage.locator("[data-mod-bar-placement]").evaluateAll((controls) => (
                controls.map((control) => control.getAttribute("data-mod-bar-placement"))
            )),
            ["floating-left", "floating-right", "parked"],
        );

        await tuningPage.locator('[data-perf-tuning-algorithm="paced"]').click();
        await tuningPage.locator('[data-perf-tuning-key="settleMs"]').fill("330");
        await tuningPage.locator('[data-perf-tuning-key="minGapMs"]').fill("525");
        await tuningPage.locator('[data-perf-tuning-key="holdMs"]').fill("8500");
        await tuningPage.locator('[data-perf-tuning-key="loopSync"]').uncheck();
        await tuningPage.locator('[data-perf-tuning-key="drag.activationPx"]').fill("19");
        await tuningPage.locator('[data-perf-tuning-key="drag.rampPx"]').fill("140");
        await tuningPage.locator('[data-perf-tuning-key="drag.gainMin"]').fill("1.75");
        await tuningPage.locator('[data-perf-tuning-key="drag.gainMax"]').fill("5.25");
        await tuningPage.locator('[data-perf-tuning-key="drag.referenceTravelPx"]').fill("444");
        await tuningPage.locator('[data-perf-tuning-key="modBar.scale"]').fill("1.22");
        await tuningPage.locator('[data-mod-bar-placement="parked"]').click();

        const copyButton = tuningPage.locator('[data-action="copy-perf-tuning-settings"]');
        assert.equal(await copyButton.count(), 1);
        await copyButton.click();
        const feedback = tuningPage.locator('[data-role="perf-tuning-copy-feedback"]');
        await feedback.locator('xpath=self::*[@data-state="success"]').waitFor();
        assert.equal((await feedback.textContent())?.trim(), "Settings copied.");
        assert.equal(await sitesPage.evaluate(() => navigator.clipboard.readText()), expectedCopiedSettings);

        const geometry = await tuningPage.evaluate((pageElement) => {
            const dialog = pageElement.querySelector('[role="dialog"]');
            const copy = pageElement.querySelector('[data-action="copy-perf-tuning-settings"]');
            const dialogBounds = dialog?.getBoundingClientRect();
            const copyBounds = copy?.getBoundingClientRect();
            return {
                dialog: dialogBounds ? {
                    bottom: dialogBounds.bottom,
                    left: dialogBounds.left,
                    right: dialogBounds.right,
                    top: dialogBounds.top,
                } : null,
                copy: copyBounds ? {
                    bottom: copyBounds.bottom,
                    left: copyBounds.left,
                    right: copyBounds.right,
                    top: copyBounds.top,
                } : null,
                documentScrollWidth: document.documentElement.scrollWidth,
                viewportHeight: innerHeight,
                viewportWidth: innerWidth,
            };
        });
        assert.ok(geometry.dialog);
        assert.ok(geometry.copy);
        assert.ok(geometry.dialog.left >= 0 && geometry.dialog.right <= geometry.viewportWidth);
        assert.ok(geometry.dialog.top >= 0 && geometry.dialog.bottom <= geometry.viewportHeight);
        assert.ok(geometry.copy.left >= geometry.dialog.left && geometry.copy.right <= geometry.dialog.right);
        assert.ok(geometry.copy.top >= geometry.dialog.top && geometry.copy.bottom <= geometry.dialog.bottom);
        assert.equal(geometry.documentScrollWidth, geometry.viewportWidth);

        await sitesPage.evaluate(() => {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    async writeText() {
                        throw new DOMException("Clipboard denied", "NotAllowedError");
                    },
                },
            });
        });
        await copyButton.click();
        await feedback.locator('xpath=self::*[@data-state="failure"]').waitFor();
        assert.equal(
            (await feedback.textContent())?.trim(),
            "Copy failed. Check clipboard permission and try again.",
        );

        await tuningPage.getByRole("button", { name: "Close developer settings" }).click();
        await tuningPage.waitFor({ state: "detached" });
        await presetBar.locator('[data-action="toggle-shell-menu"]').waitFor({ state: "visible" });
    } finally {
        await sitesPage.close();
    }
});
