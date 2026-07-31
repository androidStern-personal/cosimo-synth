import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;

function contentTypeFor(filePath) {
    const extension = path.extname(filePath);

    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".wav") return "audio/wav";
    return "application/octet-stream";
}

async function serveWebProof(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1));
        const filePath = path.resolve(webRoot, relativePath);
        const relativeToRoot = path.relative(webRoot, filePath);

        if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
            response.writeHead(403);
            response.end("Forbidden");
            return;
        }

        const contents = await fs.readFile(filePath);
        response.writeHead(200, { "content-type": contentTypeFor(filePath) });
        response.end(contents);
    } catch (error) {
        const status = error && typeof error === "object" && "code" in error && error.code === "ENOENT"
            ? 404
            : 500;
        response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
        response.end(status === 404 ? "Not found" : String(error));
    }
}

before(async () => {
    await fs.access(path.join(webRoot, "index.html"));
    server = createServer((request, response) => {
        void serveWebProof(request, response);
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            assert.ok(address && typeof address === "object");
            baseUrl = `http://127.0.0.1:${address.port}/`;
            resolve();
        });
    });
    browser = await chromium.launch({
        channel: "chrome",
        headless: true,
    });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve, reject) => {
        if (!server) {
            resolve();
            return;
        }

        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
});

test("generated browser proof loads Cosimo and renders non-silent audio from MIDI", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const failedResponses = [];

    page.on("console", (message) => {
        if (message.type() === "error") {
            const location = message.location();
            consoleErrors.push(`${message.text()}${location.url ? ` @ ${location.url}` : ""}`);
        }
    });
    page.on("response", (response) => {
        if (!response.ok()) failedResponses.push(`${response.status()} ${response.url()}`);
    });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });

        assert.equal(await page.title(), "Cosimo Synth — Browser Proof");
        assert.equal(await page.locator("cosimo-desktop-react-view").count(), 1);
        assert.equal(await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            return view?.shadowRoot?.querySelector('select[aria-label="Select wavetable"]')?.options.length ?? 0;
        }), 238);

        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.audioContextState === "running";
        }, null, { timeout: 10_000 });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().hasActiveTable, null, {
            timeout: 30_000,
        });

        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOn(60, 110));
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioPeak > 0.00001, null, {
            timeout: 10_000,
        });
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOff(60));

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(snapshot.error, null);
        assert.equal(snapshot.hasActiveTable, true);
        assert.ok(snapshot.audioPeak > 0.00001, `Expected non-silent audio, received peak ${snapshot.audioPeak}.`);
        assert.deepEqual(failedResponses, [], `Unexpected HTTP failures:\n${failedResponses.join("\n")}`);
        assert.deepEqual(consoleErrors, [], `Unexpected console errors:\n${consoleErrors.join("\n")}`);
    } finally {
        await page.close();
    }
});
