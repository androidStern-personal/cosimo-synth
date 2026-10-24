import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
let server, browser, base;
before(async () => {
    server = await createServer({ configFile: path.join(root, "kit/examples/vite.config.mjs"), server: { port: 0 }, logLevel: "error" });
    await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
for (const width of [390, 1440]) test(`all four component pages navigate and expose accessible tabs at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    try {
        await page.goto(base);
        for (const title of ["Knob", "MSEG", "Filter", "Slider"]) {
            await page.getByRole("navigation", { name: "Components", exact: true }).getByRole("link", { name: title, exact: true }).click();
            await page.getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const section = page.locator("#default");
            const preview = section.getByRole("tab", { name: "Preview", exact: true });
            await preview.focus(); await page.keyboard.press("ArrowRight");
            const code = section.getByRole("tab", { name: "Code", exact: true });
            assert.equal(await code.getAttribute("aria-selected"), "true");
            assert.ok(await section.getByRole("tabpanel").isVisible());
            assert.match(await section.locator("pre").first().textContent(), /from ["']..\/..\/index["']/);
            await page.keyboard.press("ArrowLeft"); assert.equal(await preview.getAttribute("aria-selected"), "true");
        }
        assert.deepEqual(errors, []);
    } finally { await page.close(); }
});
