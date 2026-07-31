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

async function readKeyboardLayout(page) {
    return page.evaluate(() => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const root = view?.shadowRoot;
        const stickyKeyboard = root?.querySelector('[data-role="sticky-keyboard"]');
        const scrollRegion = root?.querySelector('[data-role="desktop-scroll-region"]');
        const keyboard = root?.querySelector("cosimo-react-desktop-keyboard");
        const keyboardHost = keyboard?.parentElement;
        const stickyBounds = stickyKeyboard?.getBoundingClientRect();
        const keyboardBounds = keyboard?.getBoundingClientRect();

        return {
            documentScrollWidth: document.documentElement.scrollWidth,
            hostClientWidth: keyboardHost instanceof HTMLElement ? keyboardHost.clientWidth : 0,
            keyboardMaxWidth: keyboard instanceof HTMLElement ? keyboard.style.maxWidth : "",
            keyboardWidth: keyboardBounds?.width ?? 0,
            scrollClientHeight: scrollRegion instanceof HTMLElement ? scrollRegion.clientHeight : 0,
            scrollHeight: scrollRegion instanceof HTMLElement ? scrollRegion.scrollHeight : 0,
            scrollTop: scrollRegion instanceof HTMLElement ? scrollRegion.scrollTop : 0,
            stickyBottom: stickyBounds?.bottom ?? 0,
            stickyTop: stickyBounds?.top ?? 0,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
        };
    });
}

async function sampleKeyboardWidths(page, sampleCount = 4) {
    const widths = [];

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        widths.push((await readKeyboardLayout(page)).keyboardWidth);
        await page.waitForTimeout(100);
    }

    return widths;
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

test("generated browser proof keeps the real keyboard pinned and renders non-silent audio from it", async () => {
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
        const initializedSound = await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const root = view?.shadowRoot;
            const wavetableSelect = root?.querySelector('select[aria-label="Select wavetable"]');
            const filterModeSelect = root?.querySelector('select[aria-label="Filter mode"]');

            return {
                filterModeName: filterModeSelect instanceof HTMLSelectElement
                    ? filterModeSelect.selectedOptions[0]?.textContent?.trim()
                    : null,
                filterModeValue: filterModeSelect instanceof HTMLSelectElement
                    ? filterModeSelect.value
                    : null,
                route1Amount: root?.querySelector('[aria-label="Route 1 amount"]')?.getAttribute("aria-valuenow") ?? null,
                route1Source: root?.querySelector('button[aria-label="Route 1 source"]')?.textContent?.trim() ?? null,
                route1Target: root?.querySelector('button[aria-label="Route 1 target"]')?.textContent?.trim() ?? null,
                route2Amount: root?.querySelector('[aria-label="Route 2 amount"]')?.getAttribute("aria-valuenow") ?? null,
                route2Source: root?.querySelector('button[aria-label="Route 2 source"]')?.textContent?.trim() ?? null,
                route2Target: root?.querySelector('button[aria-label="Route 2 target"]')?.textContent?.trim() ?? null,
                wavetableName: wavetableSelect instanceof HTMLSelectElement
                    ? wavetableSelect.selectedOptions[0]?.textContent?.trim()
                    : null,
                wavetableValue: wavetableSelect instanceof HTMLSelectElement
                    ? wavetableSelect.value
                    : null,
            };
        });
        assert.deepEqual(initializedSound, {
            filterModeName: "Lowpass",
            filterModeValue: "1",
            route1Amount: "1",
            route1Source: "MSEG 1",
            route1Target: "WT POS",
            route2Amount: "4",
            route2Source: "MSEG 1",
            route2Target: "CUTOFF",
            wavetableName: "PWM MedicineHat",
            wavetableValue: "34",
        });
        const unwantedLiquidDetails = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;

            return {
                chorus: getComputedStyle(
                    root?.querySelector('[data-role="chorus-effect-column"]'),
                    "::before",
                ).content,
                distortion: getComputedStyle(
                    root?.querySelector('[data-role="distortion-card"]'),
                    "::before",
                ).content,
                mseg: getComputedStyle(
                    root?.querySelector('[data-role="mseg-card"]'),
                    "::before",
                ).content,
            };
        });
        assert.deepEqual(unwantedLiquidDetails, {
            chorus: "none",
            distortion: "none",
            mseg: "none",
        });
        await page.waitForFunction(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            return Boolean(view?.shadowRoot?.querySelector("cosimo-react-desktop-keyboard"));
        });

        const desktopWidths = await sampleKeyboardWidths(page);
        const desktopLayoutBeforeScroll = await readKeyboardLayout(page);
        assert.ok(
            Math.max(...desktopWidths) - Math.min(...desktopWidths) < 0.5,
            `Expected a stable keyboard width, received ${desktopWidths.join(", ")}.`,
        );
        assert.equal(desktopLayoutBeforeScroll.keyboardMaxWidth, "100%");
        assert.ok(desktopLayoutBeforeScroll.keyboardWidth > 0);
        assert.ok(desktopLayoutBeforeScroll.keyboardWidth <= desktopLayoutBeforeScroll.hostClientWidth + 0.5);
        assert.ok(desktopLayoutBeforeScroll.stickyTop >= 0);
        assert.ok(desktopLayoutBeforeScroll.stickyBottom <= desktopLayoutBeforeScroll.viewportHeight);
        assert.ok(desktopLayoutBeforeScroll.scrollHeight > desktopLayoutBeforeScroll.scrollClientHeight);

        await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const scrollRegion = view?.shadowRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (scrollRegion instanceof HTMLElement) {
                scrollRegion.scrollTop = scrollRegion.scrollHeight;
            }
        });
        await page.waitForTimeout(100);
        const desktopLayoutAfterScroll = await readKeyboardLayout(page);
        assert.ok(desktopLayoutAfterScroll.scrollTop > 0);
        assert.ok(
            Math.abs(desktopLayoutAfterScroll.stickyTop - desktopLayoutBeforeScroll.stickyTop) < 0.5,
            "Expected the keyboard to remain fixed while the synth controls scroll.",
        );

        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.audioContextState === "running";
        }, null, { timeout: 10_000 });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().hasActiveTable, null, {
            timeout: 30_000,
        });

        const noteBounds = await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const keyboard = view?.shadowRoot?.querySelector("cosimo-react-desktop-keyboard");
            const note = keyboard?.shadowRoot?.querySelector("#note48");
            const bounds = note?.getBoundingClientRect();

            return bounds
                ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                : null;
        });
        assert.ok(noteBounds && noteBounds.width > 0 && noteBounds.height > 0, "Expected middle C to be playable.");

        await page.mouse.move(
            noteBounds.x + noteBounds.width / 2,
            noteBounds.y + noteBounds.height * 0.8,
        );
        await page.mouse.down();

        try {
            await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioPeak > 0.00001, null, {
                timeout: 10_000,
            });
            await page.waitForFunction(() => {
                const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
                const filter = snapshot?.latestEffectiveFilterState;
                const wavetable = snapshot?.latestEffectiveWavetablePosition;

                return Number(filter?.hasActive) === 1
                    && Number(filter?.mode) === 1
                    && Number(filter?.cutoffHz) > 1_300
                    && Number(wavetable?.position) > 0.15;
            }, null, { timeout: 10_000 });
            assert.equal(await page.evaluate(() => {
                const view = document.querySelector("cosimo-desktop-react-view");
                const keyboard = view?.shadowRoot?.querySelector("cosimo-react-desktop-keyboard");
                return keyboard?.shadowRoot?.querySelector("#note48")?.classList.contains("active") ?? false;
            }), true);
        } finally {
            await page.mouse.up();
        }

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(snapshot.error, null);
        assert.equal(snapshot.hasActiveTable, true);
        assert.ok(snapshot.audioPeak > 0.00001, `Expected non-silent audio, received peak ${snapshot.audioPeak}.`);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(150);
        const mobileWidths = await sampleKeyboardWidths(page);
        const mobileLayout = await readKeyboardLayout(page);
        assert.ok(
            Math.max(...mobileWidths) - Math.min(...mobileWidths) < 0.5,
            `Expected a stable mobile keyboard width, received ${mobileWidths.join(", ")}.`,
        );
        assert.ok(mobileLayout.keyboardWidth <= mobileLayout.hostClientWidth + 0.5);
        assert.ok(mobileLayout.stickyTop >= 0);
        assert.ok(mobileLayout.stickyBottom <= mobileLayout.viewportHeight);
        assert.ok(mobileLayout.documentScrollWidth <= mobileLayout.viewportWidth);
        assert.deepEqual(failedResponses, [], `Unexpected HTTP failures:\n${failedResponses.join("\n")}`);
        assert.deepEqual(consoleErrors, [], `Unexpected console errors:\n${consoleErrors.join("\n")}`);
    } finally {
        await page.close();
    }
});
