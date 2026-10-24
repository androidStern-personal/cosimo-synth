import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.COSIMO_SITES_BASE_URL;

test("hosted Cosimo keeps isolation through navigation and starts the real audio engine", {
    skip: baseUrl ? false
        : "Set COSIMO_SITES_BASE_URL to a deployed Sites build: this checks the host's own redirects and isolation headers, which no local server reproduces.",
    timeout: 90000,
}, async () => {
    const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    try {
        const page = await browser.newPage({ viewport: { width: 804, height: 984 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        for (const pathname of ["/", "/synth-page", "/synth.html"]) {
            const response = await page.goto(new URL(`${pathname}?test=1`, baseUrl).href);
            assert.equal(response.status(), 200, `document response for ${pathname}`);
            const headers = response.headers();
            assert.equal(headers["cross-origin-opener-policy"], "same-origin", `COOP on final document ${page.url()}`);
            assert.equal(headers["cross-origin-embedder-policy"], "require-corp", `COEP on final document ${page.url()}`);
            assert.deepEqual(await page.evaluate(() => ({ isolated: crossOriginIsolated, sharedMemory: typeof SharedArrayBuffer })), {
                isolated: true, sharedMemory: "function",
            });
            const iframe = page.locator("#cosimo-phone");
            const frame = pathname === "/synth.html" ? page.mainFrame() : await (await iframe.elementHandle()).contentFrame();
            assert.deepEqual(await frame.evaluate(() => ({ isolated: crossOriginIsolated, sharedMemory: typeof SharedArrayBuffer })), {
                isolated: true, sharedMemory: "function",
            });
            await frame.waitForFunction(() => window.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready");
            await frame.locator("#cosimo-start-overlay").click();
            await frame.waitForFunction(() => window.__COSIMO_WEB_POC__?.getSnapshot().phase === "running"
                && window.__COSIMO_WEB_POC__?.getSnapshot().hasActiveTable);
            await frame.evaluate(() => window.__COSIMO_WEB_POC__.noteOn(60, 100));
            await frame.waitForFunction(() => window.__COSIMO_WEB_POC__?.getSnapshot().audioPeak > 0.00001);
            await frame.evaluate(() => window.__COSIMO_WEB_POC__.noteOff(60));
            assert.equal(await frame.locator("#cosimo-error").isVisible(), false);
            console.log(JSON.stringify({ pathname, finalUrl: page.url(), isolated: true, audio: "running" }));
        }
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
