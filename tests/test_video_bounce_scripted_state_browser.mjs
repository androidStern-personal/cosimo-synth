import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;

function contentType(filePath) {
    const extension = path.extname(filePath);
    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".css") return "text/css; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".woff2") return "font/woff2";
    if (extension === ".svg") return "image/svg+xml";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        let relative = decodeURIComponent(requestUrl.pathname.slice(1));
        if (relative.length === 0 || relative.endsWith("/")) relative += "index.html";
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

before(async () => {
    server = createServer((request, response) => void serve(request, response));
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
});

test("M1 phone iframe renders deterministic real DesktopPatchView playback frames", {
    timeout: 360_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(`${baseUrl}scripted-test/scripted-browser-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        typeof window.__COSIMO_SCRIPTED_SESSION_HARNESS__?.renderTwice === "function"
    ));
    const report = await page.evaluate(() => (
        window.__COSIMO_SCRIPTED_SESSION_HARNESS__.renderTwice()
    ));

    assert.ok(report.first.blobBytes > 3_000, JSON.stringify(report.first));
    assert.ok(report.second.blobBytes > 3_000, JSON.stringify(report.second));
    assert.equal(report.first.blobType, "video/webm");
    assert.equal(report.second.blobType, "video/webm");
    assert.match(report.first.iframeRafMode, /^(visibility-hidden|opacity-fallback)$/u);
    assert.equal(report.second.iframeRafMode, report.first.iframeRafMode);
    assert.deepEqual(report.second.digests, report.first.digests);
    assert.equal(report.first.digests.length, 3);
    for (const digest of report.first.digests) assert.match(digest.sha256, /^[a-f0-9]{64}$/u);

    for (const inspection of [...report.first.inspections, ...report.second.inspections]) {
        assert.deepEqual(inspection.viewport, { width: 393, height: 852 });
        assert.equal(inspection.scaffoldHitTestable, true);
        assert.ok(inspection.canvasCount >= 1, JSON.stringify(inspection));
        assert.ok(inspection.svgCount >= 1, JSON.stringify(inspection));
        assert.equal(inspection.keyboardNoteCount, 18, JSON.stringify(inspection));
        assert.ok(inspection.connection.parameterCount > 10, JSON.stringify(inspection));
    }
    const firstInspection = report.first.inspections.find(({ frame }) => frame === report.firstFrame);
    assert.ok(firstInspection, JSON.stringify(report.first.inspections));
    assert.ok(firstInspection.keyboardActiveNoteCount >= 1, JSON.stringify(firstInspection));
    assert.ok(firstInspection.connection.telemetryEndpoints.includes("effectiveWavetablePosition"));
    assert.ok(firstInspection.connection.telemetryEndpoints.includes("effectiveFilterState"));
    assert.ok(firstInspection.connection.telemetryEndpoints.includes("effectiveMsegState"));
    assert.ok(firstInspection.connection.telemetryEndpoints.includes("effectiveModSourceState"));
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ videoBounceM1ScriptedState: report })}`);
    await page.close();
});
