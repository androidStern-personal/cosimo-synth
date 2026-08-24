import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startLiveReviewServer } from "./helpers/live_review_server.mjs";

let browser;
let server;

before(async () => {
    server = await startLiveReviewServer();
    browser = await chromium.launch({
        headless: true,
        args: ["--autoplay-policy=no-user-gesture-required"],
    });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("the live performance drives every scripted op on the real UI in real time", {
    timeout: 240_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 640, height: 1120 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.stack ?? error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(`${server.baseUrl}live-test/live-review-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__COSIMO_LIVE_REVIEW__?.start === "function", null, { timeout: 60_000 });

    // Completion is polled from a window field: the performance settles its
    // promise from the (eventually detached) iframe realm.
    await page.evaluate(() => {
        window.__COSIMO_LIVE_REVIEW_RESULT__ = undefined;
        void window.__COSIMO_LIVE_REVIEW__.start()
            .then((value) => { window.__COSIMO_LIVE_REVIEW_RESULT__ = value; })
            .catch((error) => { window.__COSIMO_LIVE_REVIEW_RESULT__ = { error: String(error?.stack ?? error) }; });
    });
    let result = null;
    const deadline = Date.now() + 180_000;
    while (result === null && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        result = await page.evaluate(() => window.__COSIMO_LIVE_REVIEW_RESULT__ ?? null);
    }

    assert.ok(result, "the live performance never finished");
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.lastFrame, result.durationInFrames - 1);
    // Every op with a real control was driven; setup params with no phone
    // control are the only allowed exceptions.
    assert.deepEqual(result.report.missedOps, []);
    assert.ok(
        result.report.stateOnlyOps.every(({ surface }) => surface?.startsWith("voice-setup-")),
        JSON.stringify(result.report.stateOnlyOps),
    );
    // Real-time fidelity: the pump kept up with the clock.
    assert.ok(result.report.skippedFrames < 90, `skipped ${result.report.skippedFrames} frames`);
    assert.ok(result.report.maxFrameSkip <= 6, `max skip ${result.report.maxFrameSkip}`);
    assert.deepEqual(failures, []);

    console.log(`# ${JSON.stringify({ liveBounceGate: {
        durationInFrames: result.durationInFrames,
        elapsedMilliseconds: result.elapsedMilliseconds,
        skippedFrames: result.report.skippedFrames,
        stateOnlyOps: result.report.stateOnlyOps.length,
    } })}`);
    await page.close();
});
