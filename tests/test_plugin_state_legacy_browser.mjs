import assert from "node:assert/strict";
import test from "node:test";
import { expandGlobalModRail, openBuiltDesktopBundlePage } from "./helpers/desktop_patch_view_browser_suite.mjs";

test("compiled Voice observes a legacy host write without echoing it or adding shared history", async () => {
    const errors = [];
    const page = await openBuiltDesktopBundlePage({ beforeGoto: async page => {
        page.on("pageerror", error => errors.push(error.message));
        await page.setViewportSize({ width: 393, height: 852 });
    } });
    try {
        await expandGlobalModRail(page);
        const toggle = page.locator('[data-role="mobile-global-mod-rail-voice-toggle"]');
        await toggle.click();
        const popover = page.locator('[data-role="mobile-global-mod-rail-voice-popover"]');
        const undo = popover.getByRole("button", { name: "Undo Voice edit", exact: true });
        const redo = popover.getByRole("button", { name: "Redo Voice edit", exact: true });
        await undo.waitFor();
        assert.equal((await toggle.textContent())?.trim(), "Poly");
        assert.equal(await undo.isDisabled(), true);
        await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.writeParameter("playMode", 1));
        assert.deepEqual(await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot().sentMessages
            .filter(message => message.endpointID === "playMode")), [{ endpointID: "playMode", value: 1 }]);
        await toggle.filter({ hasText: "Mono" }).waitFor({ timeout: 3000 });
        assert.equal(await undo.isDisabled(), true);
        assert.equal(await redo.isDisabled(), true);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert.deepEqual(await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot().sentMessages
            .filter(message => message.endpointID === "playMode")), [{ endpointID: "playMode", value: 1 }]);
    } finally { await page.close(); }
    assert.deepEqual(errors, []);
});
