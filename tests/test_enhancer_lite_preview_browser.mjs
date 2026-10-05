import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";
import { createServer } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "..");
let server;
let browser;
let origin;

before(async () => {
    browser = await chromium.launch({ headless: true });
    // The same server and route as `npm run fx:dev`, on a free port.
    server = await createServer({
        configFile: path.join(repoRoot, "kit/fx/vite.config.mjs"),
        logLevel: "error",
        server: { host: "127.0.0.1", port: 0, open: false },
    });
    // Vite's listen helper treats port 0 as its default port; bind the HTTP
    // server directly so the OS assigns a free one.
    await new Promise((resolve, reject) => {
        server.httpServer.once("error", reject);
        server.httpServer.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.httpServer.address().port}`;
});

after(async () => {
    await browser?.close();
    await server?.close();
});

test("the browser preview runs Enhance That's real view with working presets, snapshots and controls", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    try {
        const response = await page.goto(`${origin}/fx/enhancer_lite/view/harness.html`);
        assert.equal(response.status(), 200);
        const view = page.locator("#plugin-preview > *").first();
        await view.waitFor();
        assert.equal(await page.locator("#preview-error").isVisible(), false);
        const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajorpatch"), "utf8"));
        assert.equal(await page.locator("#preview-title").innerText(), `${manifest.name} — UI preview`);
        assert.equal(await page.getByRole("group", { name: "Snapshots" }).getByRole("button", { name: /^Snapshot [A-G]/ }).count(), 7);

        const frequency = view.getByRole("slider", { name: "Frequency", exact: true });
        assert.equal(await frequency.getAttribute("aria-valuetext"), "130 Hz");
        const amount = view.getByRole("slider", { name: "Amount", exact: true });
        await amount.focus();
        await page.keyboard.press("ArrowUp");
        assert.ok(Number(await amount.getAttribute("aria-valuenow")) > 0, "a UI gesture round-trips through the preview's parameter listeners");
        await page.getByRole("combobox", { name: "Preset" }).selectOption("vocal-presence");
        await frequency.filter({ hasText: "3.20 kHz" }).waitFor();

        assert.ok(requests.includes("/fx/enhancer_lite/view/source.tsx"), "the preview loads the view source, not a build");
        assert.ok(!requests.some((request) => request.startsWith("/build/")));
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
