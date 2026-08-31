import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("performance HUD exposes metrics as status text and reset as a keyboard button", async () => {
    const [sourceHtml, hostSource] = await Promise.all([
        readFile(path.join(repoRoot, "web", "index.html"), "utf8"),
        readFile(path.join(repoRoot, "web", "cosimo-web-host.js"), "utf8"),
    ]);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.setContent(sourceHtml.replace(/<script\b[^>]*\bsrc="\.\/cosimo-web-host\.js"[^>]*><\/script>/u, ""));
        await page.evaluate(() => {
            const hud = document.getElementById("cosimo-perf-hud");
            const metrics = document.getElementById("cosimo-perf-hud-metrics");
            const reset = document.getElementById("cosimo-perf-hud-reset");
            if (!(hud instanceof HTMLElement) || !(metrics instanceof HTMLElement) || !(reset instanceof HTMLButtonElement)) {
                throw new Error("Expected the source performance HUD controls.");
            }
            hud.hidden = false;
            metrics.textContent = "48.0kHz · 128f · running\nnow  avg 12% · max 30%";
            globalThis.__COSIMO_PERF_RESET_COUNT__ = 0;
            reset.addEventListener("click", () => {
                globalThis.__COSIMO_PERF_RESET_COUNT__ += 1;
            });
        });

        const metrics = page.getByRole("status").filter({ hasText: "48.0kHz" });
        const reset = page.getByRole("button", { name: "Reset metrics" });
        assert.equal(await metrics.count(), 1);
        assert.equal(await reset.evaluate((element) => element instanceof HTMLButtonElement), true);

        await page.keyboard.press("Tab");
        assert.equal(await reset.evaluate((element) => element === document.activeElement), true);
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => globalThis.__COSIMO_PERF_RESET_COUNT__), 1);

        assert.match(hostSource, /perfHudMetrics:\s*document\.getElementById\("cosimo-perf-hud-metrics"\)/u);
        assert.match(hostSource, /perfHudReset:\s*document\.getElementById\("cosimo-perf-hud-reset"\)/u);
        assert.match(hostSource, /elements\.perfHudReset\.addEventListener\("click"/u);
        assert.match(hostSource, /elements\.perfHudMetrics\.textContent = lines\.join/u);
        assert.doesNotMatch(hostSource, /elements\.perfHud\.addEventListener\("click"/u);
        assert.doesNotMatch(hostSource, /tap to reset/u);
    } finally {
        await page.close();
        await browser.close();
    }
});
