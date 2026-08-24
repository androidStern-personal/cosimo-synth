import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "experiments", "remotion-web-renderer-spike");
let browser;
let server;
let baseUrl;

function contentType(filePath) {
    const extension = path.extname(filePath);
    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".css") return "text/css; charset=utf-8";
    if (extension === ".wasm") return "application/wasm";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        const relative = decodeURIComponent(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1));
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

test("renderMediaOnWeb emits a verified 10-second MP4 with visual primitives and blob-URL audio", {
    timeout: 240_000,
}, async () => {
    const page = await browser.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof globalThis.__COSIMO_REMOTION_SPIKE__?.run === "function");
    const report = await page.evaluate(() => globalThis.__COSIMO_REMOTION_SPIKE__.run());

    assert.equal(report.videoTrackCount, 1);
    assert.equal(report.audioTrackCount, 1);
    assert.equal(report.videoCodec, "avc");
    assert.equal(report.audioCodec, "aac");
    assert.ok(report.durationSeconds >= 9.9 && report.durationSeconds <= 10.1, JSON.stringify(report));
    assert.ok(report.decodedAudioRms > 0.02, JSON.stringify(report));
    assert.ok(report.decodedFrameVariance > 80, JSON.stringify(report));
    assert.ok(report.decodedFrameDifference > 1, JSON.stringify(report));
    assert.ok(report.blobBytes > 50_000, JSON.stringify(report));
    assert.equal(report.blobType, "video/mp4");
    assert.equal(report.finalProgress, 1);
    assert.match(report.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ remotionM2: report })}`);
    await page.close();
});
