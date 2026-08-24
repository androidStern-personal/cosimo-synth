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
    if (extension === ".wasm") return "application/wasm";
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
    await fs.access(path.join(webRoot, "index.html"));
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

test("the preset dropdown opens current-patch Bounce Video and lazy-loads its renderer", {
    timeout: 180_000,
}, async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 700 } });
    const failures = [];
    const rendererRequests = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/video-bounce/index.js") {
            rendererRequests.push(request.url());
        }
    });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const preset = root?.querySelector("cosimo-preset-bar");
            const video = preset?.shadowRoot?.querySelector('.flyout-synth-action[data-action="bounce-video"]');
            return video instanceof HTMLButtonElement && !video.disabled;
        }, null, { timeout: 30_000 });

        assert.equal(rendererRequests.length, 0, "The renderer loaded before Bounce Video was selected.");

        const menuBefore = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const preset = root?.querySelector("cosimo-preset-bar");
            const shadow = preset?.shadowRoot;
            if (!root || !shadow) throw new Error("Synth preset dropdown is missing.");
            shadow.querySelector('[data-action="toggle-flyout"]')?.click();
            return {
                labels: Array.from(shadow.querySelectorAll(".flyout-synth-action"))
                    .map((button) => button.textContent?.trim()),
                visibleBounceStarts: root.querySelectorAll('[data-role="bounce-start"]').length,
            };
        });
        assert.deepEqual(menuBefore.labels, ["Bounce Audio", "Bounce Video"]);
        assert.equal(menuBefore.visibleBounceStarts, 0);

        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const preset = root?.querySelector("cosimo-preset-bar");
            const video = preset?.shadowRoot?.querySelector('.flyout-synth-action[data-action="bounce-video"]');
            if (!(video instanceof HTMLButtonElement)) throw new Error("Bounce Video is missing.");
            video.click();
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return root?.querySelector('[data-role="video-bounce-flow"]')?.getAttribute("data-stage") === "ready";
        }, null, { timeout: 30_000 });

        const flow = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const element = root?.querySelector('[data-role="video-bounce-flow"]');
            if (!(element instanceof HTMLElement)) throw new Error("Bounce Video flow is missing.");
            return {
                title: element.querySelector("header")?.textContent?.replace(/\s+/gu, " ").trim(),
                currentPatch: element.textContent?.includes("Current patch") ?? false,
                alternativePatchInputs: element.querySelectorAll('input[type="file"], textarea, input[aria-label*="share" i]').length,
                overflow: getComputedStyle(element).overflow,
                fitsVertically: element.scrollHeight <= element.clientHeight + 1,
                error: element.querySelector('[data-role="video-bounce-error"]')?.textContent?.trim() ?? null,
                audioAction: element.querySelector('[data-role="video-bounce-render-audio"]')?.textContent?.trim(),
                selectLabels: Array.from(element.querySelectorAll("select")).map((select) => select.getAttribute("aria-label")),
            };
        });

        assert.equal(rendererRequests.length, 1);
        assert.match(flow.title, /^Bounce Video/u);
        assert.equal(flow.currentPatch, true);
        assert.equal(flow.alternativePatchInputs, 0);
        assert.equal(flow.overflow, "hidden");
        assert.equal(flow.fitsVertically, true);
        assert.equal(flow.error, null);
        assert.equal(flow.audioAction, "Render Audio");
        assert.deepEqual(flow.selectLabels, ["Format", "Quality"]);

        await page.locator('select[aria-label="Format"]').selectOption("webm");
        await page.locator('select[aria-label="Quality"]').selectOption("very-low");
        await page.locator('[data-role="video-bounce-render-audio"]').click();
        await page.locator('[data-role="video-bounce-render-video"]').waitFor({ timeout: 120_000 });

        const audioProof = await page.locator('[data-role="video-bounce-flow"] audio').evaluate(async (audio) => {
            const blob = await (await fetch(audio.src)).blob();
            return { bytes: blob.size, type: blob.type };
        });
        assert.ok(audioProof.bytes > 100_000, JSON.stringify(audioProof));
        assert.equal(audioProof.type, "audio/wav");

        await page.locator('[data-role="video-bounce-render-video"]').click();
        const download = page.locator('[data-role="video-bounce-download"]');
        await download.waitFor({ timeout: 180_000 });
        const videoProof = await download.evaluate(async (link) => {
            const blob = await (await fetch(link.href)).blob();
            const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
            return {
                bytes: blob.size,
                type: blob.type,
                download: link.download,
                header: Array.from(header),
            };
        });
        assert.ok(videoProof.bytes > 20_000, JSON.stringify(videoProof));
        assert.equal(videoProof.type, "video/webm");
        assert.match(videoProof.download, /-speedrun\.webm$/u);
        assert.deepEqual(videoProof.header, [0x1a, 0x45, 0xdf, 0xa3]);
        assert.deepEqual(failures, []);
    } finally {
        await page.close();
    }
});
