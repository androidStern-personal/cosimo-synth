import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "speedrun-composition-test");
const goldenRoot = path.join(repoRoot, "tests", "goldens", "speedrun-composition");
const updateGoldens = process.env.COSIMO_UPDATE_SPEEDRUN_GOLDENS === "1";
let browser;
let server;
let baseUrl;

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function assertSamePng(actual, expected, message) {
    assert.equal(actual.byteLength, expected.byteLength, `${message} (PNG byte length)`);
    assert.equal(sha256(actual), sha256(expected), `${message} (PNG SHA-256)`);
}

function contentType(filePath) {
    const extension = path.extname(filePath);
    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".css") return "text/css; charset=utf-8";
    if (extension === ".woff2") return "font/woff2";
    if (extension === ".svg") return "image/svg+xml";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        const relative = decodeURIComponent(requestUrl.pathname === "/" ? "composition-browser-harness.html" : requestUrl.pathname.slice(1));
        const filePath = path.resolve(webRoot, relative);
        if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const bytes = await fs.readFile(filePath);
        response.writeHead(200, { "cache-control": "no-store", "content-type": contentType(filePath) });
        response.end(bytes);
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500).end(String(error));
    }
}

async function newHarnessPage() {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__COSIMO_SPEEDRUN_COMPOSITION__?.setFrame === "function");
    return { page, failures };
}

async function setFrame(page, frame) {
    await page.evaluate(async (requestedFrame) => {
        await window.__COSIMO_SPEEDRUN_COMPOSITION__.setFrame(requestedFrame);
    }, frame);
}

before(async () => {
    server = createServer(serve);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/`;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
});

test("the phone replica is frame-pure and composes real product leaf artwork", async () => {
    const { page, failures } = await newHarnessPage();
    const metadata = await page.evaluate(() => ({
        durationInFrames: window.__COSIMO_SPEEDRUN_COMPOSITION__.durationInFrames,
        boundaries: window.__COSIMO_SPEEDRUN_COMPOSITION__.sectionBoundaries,
    }));
    const frame = metadata.boundaries[2].frame + 31;
    await setFrame(page, frame);
    const first = await page.locator("#root").screenshot({ type: "png", animations: "disabled" });
    const firstInspection = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.inspect());
    await setFrame(page, Math.min(metadata.durationInFrames - 1, frame + 17));
    await setFrame(page, frame);
    const second = await page.locator("#root").screenshot({ type: "png", animations: "disabled" });
    const secondInspection = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.inspect());

    assertSamePng(second, first, "seeking away and back to one frame changed its pixels");
    assert.deepEqual(secondInspection, firstInspection);
    assert.equal(firstInspection.renderedFrame, frame);
    assert.ok(firstInspection.canvasCount >= 1, JSON.stringify(firstInspection));
    assert.ok(firstInspection.knobCount >= 3, JSON.stringify(firstInspection));
    assert.notEqual(firstInspection.fingerDirection, null, JSON.stringify(firstInspection));
    assert.deepEqual(failures, []);
    await page.close();
});

test("every current-contract section boundary matches its checked-in screenshot golden", async () => {
    const { page, failures } = await newHarnessPage();
    const metadata = await page.evaluate(() => ({
        boundaries: window.__COSIMO_SPEEDRUN_COMPOSITION__.sectionBoundaries,
        endCardFrame: window.__COSIMO_SPEEDRUN_COMPOSITION__.endCardFrame,
    }));
    if (updateGoldens) await fs.mkdir(goldenRoot, { recursive: true });
    for (const boundary of metadata.boundaries) {
        await setFrame(page, boundary.frame);
        const screenshot = await page.locator("#root").screenshot({ type: "png", animations: "disabled" });
        const goldenPath = path.join(goldenRoot, `${boundary.name}.png`);
        if (updateGoldens) {
            await fs.writeFile(goldenPath, screenshot);
        } else {
            const golden = await fs.readFile(goldenPath);
            assertSamePng(screenshot, golden, `${boundary.sectionId} frame ${boundary.frame} drifted from its golden`);
        }
    }
    await setFrame(page, metadata.endCardFrame);
    const endCardScreenshot = await page.locator("#root").screenshot({ type: "png", animations: "disabled" });
    const endCardGolden = path.join(goldenRoot, "end-card.png");
    if (updateGoldens) await fs.writeFile(endCardGolden, endCardScreenshot);
    else assertSamePng(endCardScreenshot, await fs.readFile(endCardGolden), "the end card drifted from its golden");
    const endCard = await page.evaluate(() => ({
        inspection: window.__COSIMO_SPEEDRUN_COMPOSITION__.inspect(),
        text: document.querySelector(".speedrun-end-card")?.textContent ?? "",
    }));
    assert.equal(endCard.inspection.endCard, true);
    assert.match(endCard.text, /Split Space Lead/i);
    assert.match(endCard.text, /Made with Cosimo/i);
    assert.deepEqual(failures, []);
    await page.close();
});

test("caption waterfall frames and decoded click onsets stay aligned within one frame", { timeout: 360_000 }, async () => {
    const { page, failures } = await newHarnessPage();
    const captionEvents = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.clickCaptionEvents);
    for (const event of captionEvents) {
        await page.evaluate(async ({ frame }) => window.__COSIMO_SPEEDRUN_COMPOSITION__.setClickFrame(frame), {
            frame: event.atFrame - 1,
        });
        const before = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.inspect());
        assert.equal(before.visibleCaptionLines.includes(event.line), false, JSON.stringify({ event, before }));
        await page.evaluate(async ({ frame }) => window.__COSIMO_SPEEDRUN_COMPOSITION__.setClickFrame(frame), {
            frame: event.atFrame,
        });
        const atEvent = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.inspect());
        assert.equal(atEvent.visibleCaptionLines.includes(event.line), true, JSON.stringify({ event, atEvent }));
    }
    const report = await page.evaluate(() => window.__COSIMO_SPEEDRUN_COMPOSITION__.renderAlignment());
    assert.equal(report.videoTrackCount, 1);
    assert.equal(report.audioTrackCount, 1);
    assert.equal(report.videoCodec, "avc");
    assert.equal(report.audioCodec, "aac");
    assert.equal(report.blobType, "video/mp4");
    assert.equal(report.finalProgress, 1);
    assert.ok(report.blobBytes > 30_000, JSON.stringify(report));
    assert.ok(report.durationSeconds >= 3.2 && report.durationSeconds <= 3.5, JSON.stringify(report));
    assert.deepEqual(report.expectedFrames, [10, 14, 18]);
    for (const onset of report.observed) {
        assert.ok(onset.peak > 0.25, JSON.stringify(onset));
        assert.ok(Math.abs(onset.errorFrames) <= 1, JSON.stringify(onset));
    }
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ speedrunM5Alignment: report })}`);
    await page.close();
});
