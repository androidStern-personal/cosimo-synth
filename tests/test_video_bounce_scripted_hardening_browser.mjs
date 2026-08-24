import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { routeHermeticPage } from "./helpers/hermetic_page.mjs";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
const contactSheetRoot = path.join(repoRoot, "build", "video-bounce-contact-sheet");
let browser;
let server;

before(async () => {
    server = await startStaticWebServer(webRoot);
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("M3 full scripted renders are deterministic and paint the overlays", {
    timeout: 1_800_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await routeHermeticPage(page, server.baseUrl);
    await page.goto(`${server.baseUrl}scripted-test/scripted-browser-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        typeof window.__COSIMO_SCRIPTED_SESSION_HARNESS__?.renderHardeningTwice === "function"
    ));
    const report = await page.evaluate(() => (
        window.__COSIMO_SCRIPTED_SESSION_HARNESS__.renderHardeningTwice()
    ));

    assert.ok(report.durationInFrames > 300, JSON.stringify({ durationInFrames: report.durationInFrames }));
    assert.deepEqual(
        report.digestFrames,
        Array.from(
            { length: Math.ceil(report.durationInFrames / 30) },
            (_, index) => index * 30,
        ).filter((frame) => frame < report.durationInFrames),
    );
    for (const render of [report.first, report.second]) {
        assert.ok(render.blobBytes > 10_000, `blobBytes ${render.blobBytes}`);
        assert.equal(render.blobType, "video/webm");
        assert.match(render.iframeRafMode, /^(visibility-hidden|opacity-fallback)$/u);
        assert.equal(render.inspectedFrames, report.durationInFrames);
        assert.deepEqual(render.digests.map(({ frame }) => frame), report.digestFrames);

        // Absorbed from the retired scripted-state suite: the capture realm is
        // a real 393x852 phone viewport, hit-testable, with the real keyboard
        // and canvases mounted, and the performance MIDI lights a real key.
        for (const inspection of render.inspections) {
            assert.deepEqual(inspection.viewport, { width: 393, height: 852 });
            assert.equal(inspection.scaffoldHitTestable, true);
            assert.ok(inspection.canvasCount >= 1, JSON.stringify(inspection));
            assert.ok(inspection.svgCount >= 1, JSON.stringify(inspection));
            assert.equal(inspection.keyboardNoteCount, 18, JSON.stringify(inspection));
        }
        assert.ok(
            render.inspections.some((inspection) => inspection.keyboardActiveNoteCount >= 1),
            "no frame showed a lit keyboard key",
        );

        // Every scripted op must actually have driven a real control.
        assert.deepEqual(render.missedOps, []);

        // Paint-level gate: the mod rail must be visible pixels — not merely a
        // DOM node — on every probed frame of the shipped composition.
        assert.equal(render.pixelProbes.length, report.digestFrames.length);
        for (const probe of render.pixelProbes) {
            const rail = probe.regions.rail;
            assert.ok(rail, `frame ${probe.frame} probed no rail region`);
            assert.ok(
                rail.lumaRange > 24,
                `frame ${probe.frame} rail paints flat (lumaRange ${rail.lumaRange})`,
            );
            const phone = probe.regions.phone;
            assert.ok(phone && phone.lumaRange > 40, `frame ${probe.frame} phone region is blank`);
        }
    }
    assert.deepEqual(report.second.digests, report.first.digests);
    assert.equal(report.second.iframeRafMode, report.first.iframeRafMode);

    // Human-reviewable contact sheet of the exact frames the digests pin.
    await fs.rm(contactSheetRoot, { recursive: true, force: true });
    await fs.mkdir(contactSheetRoot, { recursive: true });
    for (const { frame, dataUrl } of report.first.contactSheet) {
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
        await fs.writeFile(
            path.join(contactSheetRoot, `frame-${String(frame).padStart(4, "0")}.png`),
            bytes,
        );
    }
    assert.equal(report.first.contactSheet.length, report.digestFrames.length);

    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({
        videoBounceM3Hardening: {
            durationInFrames: report.durationInFrames,
            digestFrames: report.digestFrames.length,
            firstElapsedMilliseconds: report.first.elapsedMilliseconds,
            secondElapsedMilliseconds: report.second.elapsedMilliseconds,
            contactSheetRoot,
        },
    })}`);
    await page.close();
});
