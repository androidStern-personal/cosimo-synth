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

test("M3 full scripted hardening renders match pre-encode pixels every 30th frame", {
    timeout: 1_800_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(`${baseUrl}scripted-test/scripted-browser-harness.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        typeof window.__COSIMO_SCRIPTED_SESSION_HARNESS__?.renderHardeningTwice === "function"
    ));
    const report = await page.evaluate(() => (
        window.__COSIMO_SCRIPTED_SESSION_HARNESS__.renderHardeningTwice()
    ));

    assert.ok(report.durationInFrames > 300, JSON.stringify(report));
    assert.deepEqual(
        report.digestFrames,
        Array.from(
            { length: Math.ceil(report.durationInFrames / 30) },
            (_, index) => index * 30,
        ).filter((frame) => frame < report.durationInFrames),
    );
    for (const render of [report.first, report.second]) {
        assert.ok(render.blobBytes > 10_000, JSON.stringify(render));
        assert.equal(render.blobType, "video/webm");
        assert.match(render.iframeRafMode, /^(visibility-hidden|opacity-fallback)$/u);
        assert.equal(render.inspectedFrames, report.durationInFrames);
        assert.deepEqual(render.digests.map(({ frame }) => frame), report.digestFrames);
        for (const digest of render.digests) {
            assert.match(digest.sha256, /^[a-f0-9]{64}$/u);
        }
    }
    assert.deepEqual(report.second.digests, report.first.digests);
    assert.equal(report.second.iframeRafMode, report.first.iframeRafMode);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ videoBounceM3Hardening: report })}`);
    await page.close();
});
