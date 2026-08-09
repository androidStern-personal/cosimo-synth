import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium, devices, webkit } from "playwright";

import { deserializeModulationState } from "../patch_gui/modulation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserEngine = process.env.COSIMO_WEB_BROWSER ?? "chromium";
const remoteBaseUrl = process.env.COSIMO_WEB_BASE_URL;
const webRoot = process.env.COSIMO_WEB_ROOT
    ? path.resolve(repoRoot, process.env.COSIMO_WEB_ROOT)
    : path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;

function contentTypeFor(filePath) {
    const extension = path.extname(filePath);

    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
    if (extension === ".png") return "image/png";
    if (extension === ".svg") return "image/svg+xml";
    if (extension === ".ttf") return "font/ttf";
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

async function sampleAudioRms(page, sampleCount = 16, intervalMs = 60) {
    const values = [];
    for (let index = 0; index < sampleCount; index += 1) {
        values.push(await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRms));
        await page.waitForTimeout(intervalMs);
    }
    return Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0) / values.length);
}

async function readServedFactoryCatalog(page) {
    if (!remoteBaseUrl) {
        return JSON.parse(await fs.readFile(
            path.join(webRoot, "assets", "factory-bank-catalog.json"),
            "utf8",
        ));
    }

    const catalogUrl = new URL("assets/factory-bank-catalog.json", baseUrl).href;
    const response = await page.request.get(catalogUrl);
    assert.equal(response.ok(), true, `Failed to load the served factory catalog: ${response.status()} ${catalogUrl}`);
    return response.json();
}

function observePageFailures(page) {
    const consoleErrors = [];
    const failedRequests = [];
    const failedResponses = [];
    const pageErrors = [];

    page.on("console", (message) => {
        if (message.type() === "error") {
            const location = message.location();
            consoleErrors.push(`${message.text()}${location.url ? ` @ ${location.url}` : ""}`);
        }
    });
    page.on("pageerror", (error) => {
        pageErrors.push(error instanceof Error ? error.stack || error.message : String(error));
    });
    page.on("requestfailed", (request) => {
        failedRequests.push(`${request.failure()?.errorText ?? "Request failed"} ${request.url()}`);
    });
    page.on("response", (response) => {
        if (response.status() >= 400) {
            failedResponses.push(`${response.status()} ${response.url()}`);
        }
    });

    return {
        assertClean() {
            assert.deepEqual(failedResponses, [], `Unexpected HTTP failures:\n${failedResponses.join("\n")}`);
            assert.deepEqual(failedRequests, [], `Unexpected request failures:\n${failedRequests.join("\n")}`);
            assert.deepEqual(consoleErrors, [], `Unexpected console errors:\n${consoleErrors.join("\n")}`);
            assert.deepEqual(pageErrors, [], `Unexpected page errors:\n${pageErrors.join("\n")}`);
        },
    };
}

async function measureHeldNote(page, note = 48) {
    await page.evaluate((noteNumber) => {
        globalThis.__COSIMO_WEB_POC__.resetAudioMetrics();
        globalThis.__COSIMO_WEB_POC__.noteOn(noteNumber, 100);
    }, note);
    await page.waitForTimeout(350);
    const rms = await sampleAudioRms(page);
    await page.evaluate((noteNumber) => globalThis.__COSIMO_WEB_POC__.noteOff(noteNumber), note);
    await page.waitForTimeout(180);
    return rms;
}

async function holdTouchKeyboardNote(page, {
    holdMs = 300,
    note = 48,
    touchIdentifier = 7,
} = {}) {
    return page.evaluate(async ({ durationMs, identifier, noteNumber }) => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const keyboard = view?.shadowRoot?.querySelector("cosimo-react-desktop-keyboard");
        const noteElement = keyboard?.shadowRoot?.querySelector(`#note${noteNumber}`);

        if (!noteElement) {
            return null;
        }

        const touch = { identifier, target: noteElement };
        const dispatchTouch = (type) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "changedTouches", { value: [touch] });
            noteElement.dispatchEvent(event);
        };

        dispatchTouch("touchstart");
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        const result = {
            active: noteElement.classList.contains("active"),
            audioContextState: globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioContextState ?? null,
            audioPeak: globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioPeak ?? 0,
        };
        dispatchTouch("touchend");
        return result;
    }, {
        durationMs: holdMs,
        identifier: touchIdentifier,
        noteNumber: note,
    });
}

async function dispatchTouchDrag(page, start, end, { afterFirstMove, steps = 10 } = {}) {
    const client = await page.context().newCDPSession(page);

    try {
        await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{
                x: start.x,
                y: start.y,
                radiusX: 5,
                radiusY: 5,
                force: 1,
                id: 1,
            }],
        });

        for (let index = 1; index <= steps; index += 1) {
            const progress = index / steps;
            await client.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                    id: 1,
                }],
            });
            if (index === 1) {
                await afterFirstMove?.();
            }
        }

        await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        });
    } finally {
        await client.detach();
    }
}

async function centerOf(locator) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, "Expected a visible touch target.");
    return {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2),
    };
}

async function openStartedMobileRackPage({ simulateWebKitZeroTouchButtons = false } = {}) {
    const page = await browser.newPage({
        ...devices["iPhone 13"],
    });

    await page.addInitScript(({ shouldSimulateZeroTouchButtons }) => {
        localStorage.removeItem("cosimo.web.patch-state.v1");
        if (!shouldSimulateZeroTouchButtons) {
            return;
        }

        const buttonsGetter = Object.getOwnPropertyDescriptor(MouseEvent.prototype, "buttons")?.get;
        Object.defineProperty(PointerEvent.prototype, "buttons", {
            configurable: true,
            get() {
                if (this.pointerType === "touch" && this.type === "pointermove") {
                    return 0;
                }
                return buttonsGetter ? Reflect.apply(buttonsGetter, this, []) : 0;
            },
        });
    }, { shouldSimulateZeroTouchButtons: simulateWebKitZeroTouchButtons });

    await page.goto(`${baseUrl}?rack-touch-gestures=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
        timeout: 30_000,
    });

    const startBounds = await page.locator("#cosimo-start-overlay").boundingBox();
    assert.ok(startBounds, "Expected the Start audio control to be visible.");
    await page.touchscreen.tap(
        startBounds.x + (startBounds.width / 2),
        startBounds.y + (startBounds.height / 2),
    );
    await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running");
    await page.locator('[data-role="mobile-workspace-toggle-fx"]').click();
    await page.locator('[data-role="rack-module-list"]').waitFor();
    return page;
}

before(async () => {
    if (remoteBaseUrl) {
        baseUrl = new URL("/", remoteBaseUrl).href;
        browser = browserEngine === "webkit"
            ? await webkit.launch({
                executablePath: process.env.COSIMO_WEBKIT_EXECUTABLE_PATH,
                headless: true,
            })
            : await chromium.launch({
                channel: "chrome",
                headless: true,
            });
        return;
    }

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
    browser = browserEngine === "webkit"
        ? await webkit.launch({
            executablePath: process.env.COSIMO_WEBKIT_EXECUTABLE_PATH,
            headless: true,
        })
        : await chromium.launch({
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
    const factoryCatalog = await readServedFactoryCatalog(page);
    const pageFailures = observePageFailures(page);

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.waitForFunction((expectedTableCount) => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const select = view?.shadowRoot?.querySelector('select[aria-label="Select wavetable"]');
            return select instanceof HTMLSelectElement && select.options.length === expectedTableCount;
        }, factoryCatalog.tables.length, { timeout: 30_000 });

        assert.equal(await page.title(), "Cosimo Synth — Browser Proof");
        assert.equal(await page.locator("cosimo-desktop-react-view").count(), 1);
        assert.equal(await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            return view?.shadowRoot?.querySelector('select[aria-label="Select wavetable"]')?.options.length ?? 0;
        }), factoryCatalog.tables.length);
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
        assert.equal(await page.evaluate(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelectorAll("[data-rack-position]").length ?? 0
        )), 8);
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
        pageFailures.assertClean();
    } finally {
        await page.close();
    }
});

test("generated production-mode browser keeps acceptance diagnostics off the audio hot path", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running");
        await page.waitForTimeout(1_000);

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(snapshot.audioWorkletBlockCount, 0);
        assert.deepEqual(snapshot.parameterValues, {});
        assert.equal(snapshot.audioPollCount, 0);
    } finally {
        await page.close();
    }
});

test("generated browser starts audio when the optional playback-session hint is rejected", async () => {
    const page = await browser.newPage({
        ...devices["iPhone 13"],
    });

    try {
        await page.addInitScript(() => {
            const audioSession = {
                get type() {
                    return "ambient";
                },
                set type(_nextType) {
                    throw new DOMException("Playback sessions are unavailable.", "NotSupportedError");
                },
            };
            Object.defineProperty(navigator, "audioSession", {
                configurable: true,
                value: audioSession,
            });
        });
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });

        const startBounds = await page.locator("#cosimo-start-overlay").boundingBox();
        assert.ok(startBounds, "Expected the Start audio control to be visible.");
        await page.touchscreen.tap(
            startBounds.x + (startBounds.width / 2),
            startBounds.y + (startBounds.height / 2),
        );
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" || snapshot?.phase === "error";
        }, null, { timeout: 30_000 });

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.equal(snapshot.phase, "running");
        assert.equal(snapshot.error, null);
        assert.equal(snapshot.audioSessionType, "ambient");
    } finally {
        await page.close();
    }
});

test("generated WebAssembly rack changes audio, modulates a real target, and stays gain-safe", async (t) => {
    const page = await browser.newPage(browserEngine === "webkit"
        ? { ...devices["iPhone 13"] }
        : { viewport: { width: 1280, height: 820 } });
    const pageFailures = observePageFailures(page);
    await page.addInitScript(() => {
        if (sessionStorage.getItem("cosimo-rack-test-initialised") !== "1") {
            localStorage.removeItem("cosimo.web.patch-state.v1");
            sessionStorage.setItem("cosimo-rack-test-initialised", "1");
        }
    });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.hasActiveTable;
        }, null, { timeout: 30_000 });

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("rackEnable", { enabledFlags: [0, 0, 0, 0, 0, 0, 0, 0] });
            api.setParameter("distortionDriveDb", 30);
            api.setParameter("distortionWet", 0);
        });
        const dryRms = await measureHeldNote(page);
        assert.ok(dryRms > 1e-5, `Dry rack must be audible, received RMS ${dryRms}.`);

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("rackEnable", { enabledFlags: [0, 1, 0, 0, 0, 0, 0, 0] });
            api.setParameter("distortionWet", 1);
        });
        const drivenRms = await measureHeldNote(page);
        assert.ok(
            Math.abs(drivenRms - dryRms) / dryRms > 0.08,
            `Distortion parameter must measurably change audio (dry ${dryRms}, wet ${drivenRms}).`,
        );

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("distortionWet", 0);
            api.setParameter("macro1", 0);
            api.sendEvent("modulationClear", 1);
            api.sendEvent("rackModulationRoute", {
                routeIndex: 0,
                enabled: true,
                sourceKind: 6,
                sourceSlot: 1,
                polarityKind: 0,
                targetKind: 105,
                amount: 1,
                reducerKind: 0,
            });
            api.sendEvent("modulationEnable", 1);
        });
        const macroLowRms = await measureHeldNote(page);
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setParameter("macro1", 1));
        const macroHighRms = await measureHeldNote(page);
        assert.ok(
            Math.abs(macroHighRms - macroLowRms) / macroLowRms > 0.08,
            `Macro-to-rack modulation must change audio (low ${macroLowRms}, high ${macroHighRms}).`,
        );

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("modulationClear", 1);
            api.setParameter("macro1", 0);
            api.setParameter("distortionWet", 0.35);
            api.setParameter("ottAmount", 35);
            api.setParameter("ottMix", 35);
            api.setParameter("chorusMix", 0.3);
            api.setParameter("flangerMix", 0.25);
            api.setParameter("phaserMix", 0.25);
            api.setParameter("delayMix", 0.25);
            api.setParameter("reverbMix", 0.3);
            api.sendEvent("rackEnable", { enabledFlags: [1, 1, 1, 1, 1, 1, 1, 1] });
        });
        const allOnRms = await measureHeldNote(page);
        const allOnGainDb = 20 * Math.log10(allOnRms / dryRms);
        assert.ok(allOnGainDb < 6, `Ordinary all-on rack gain is unsafe: ${allOnGainDb.toFixed(2)} dB.`);
        assert.ok(allOnRms > 1e-5, "All-on rack must remain audible.");

        await page.evaluate(() => {
            globalThis.__COSIMO_WEB_POC__.resetAudioMetrics();
            globalThis.__COSIMO_WEB_POC__.noteOn(48, 100);
        });
        await page.waitForTimeout(400);
        for (let poll = 0; poll < 30; poll += 1) {
            await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
            await page.waitForTimeout(100);
        }
        const sustainedSnapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOff(48));
        assert.equal(sustainedSnapshot.audioContextState, "running");
        assert.equal(sustainedSnapshot.silentHeldNotePollCount, 0, "No analyser poll may underrun to silence.");

        t.diagnostic(JSON.stringify({
            allOnGainDb,
            allOnRms,
            audioBaseLatency: sustainedSnapshot.audioBaseLatency,
            audioOutputLatency: sustainedSnapshot.audioOutputLatency,
            audioWorkletAverageLoad: sustainedSnapshot.audioWorkletAverageLoad,
            audioWorkletBlockCount: sustainedSnapshot.audioWorkletBlockCount,
            audioWorkletMaxLoad: sustainedSnapshot.audioWorkletMaxLoad,
            audioWorkletOverBudgetBlocks: sustainedSnapshot.audioWorkletOverBudgetBlocks,
            drivenRms,
            dryRms,
            macroHighRms,
            macroLowRms,
            silentHeldNotePollCount: sustainedSnapshot.silentHeldNotePollCount,
            usedJSHeapSize: sustainedSnapshot.usedJSHeapSize,
        }));

        pageFailures.assertClean();
    } finally {
        await page.evaluate(() => localStorage.removeItem("cosimo.web.patch-state.v1")).catch(() => {});
        await page.close();
    }
});

test("generated rack UI persists one grip reorder and enable change through reload", async (t) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.addInitScript(() => {
        if (sessionStorage.getItem("cosimo-rack-state-test-initialised") !== "1") {
            localStorage.removeItem("cosimo.web.patch-state.v1");
            sessionStorage.setItem("cosimo-rack-state-test-initialised", "1");
        }
    });

    try {
        await page.goto(`${baseUrl}?rack-state-test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running");
        await page.locator('[data-role="rack-enabled-chorus"]').click();
        const reorderHandle = page.locator('[data-role="rack-reorder-handle-reverb"]');
        const reorderTarget = page.locator('[data-role="rack-module-filter"]');
        await reorderHandle.scrollIntoViewIfNeeded();
        const handleBox = await reorderHandle.boundingBox();
        const targetBox = await reorderTarget.boundingBox();
        assert.ok(handleBox && targetBox);
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
        await page.mouse.up();

        await page.waitForFunction(async () => {
            const state = await globalThis.__COSIMO_WEB_POC__.storedState();
            const rack = JSON.parse(String(state.values?.["rack.v1"]));
            return rack.order[0] === "reverb" && rack.enabled.chorus === true;
        });
        const beforeReload = await page.evaluate(async () => ({
            connection: (await globalThis.__COSIMO_WEB_POC__.storedState()).values?.["rack.v1"] ?? null,
            local: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v1") ?? "{}")["rack.v1"] ?? null,
        }));
        t.diagnostic(`Before reload: ${JSON.stringify(beforeReload)}`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.waitForTimeout(500);
        const afterReload = await page.evaluate(async () => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return {
                connection: (await globalThis.__COSIMO_WEB_POC__.storedState()).values?.["rack.v1"] ?? null,
                local: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v1") ?? "{}")["rack.v1"] ?? null,
                firstRole: root?.querySelector('[data-role="rack-module-list"]')?.firstElementChild?.getAttribute("data-role") ?? null,
                chorusPressed: root?.querySelector('[data-role="rack-enabled-chorus"]')?.getAttribute("aria-pressed") ?? null,
            };
        });
        t.diagnostic(`After reload: ${JSON.stringify(afterReload)}`);
        assert.equal(afterReload.firstRole, "rack-module-reverb");
        assert.equal(afterReload.chorusPressed, "true");
    } finally {
        await page.close();
    }
});

test("generated mobile rack reorder survives WebKit zero-button touch moves without scrolling", {
    skip: browserEngine !== "chromium",
}, async () => {
    const page = await openStartedMobileRackPage({ simulateWebKitZeroTouchButtons: true });

    try {
        const scrollBefore = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const scrollRegion = root?.querySelector('[data-role="desktop-scroll-region"]');
            return {
                documentY: window.scrollY,
                regionY: scrollRegion instanceof HTMLElement ? scrollRegion.scrollTop : 0,
            };
        });
        const reorderStart = await centerOf(page.locator('[data-role="rack-reorder-handle-reverb"]'));
        const reorderEnd = await centerOf(page.locator('[data-role="rack-module-filter"]'));
        await dispatchTouchDrag(page, reorderStart, reorderEnd);
        await page.waitForFunction(async () => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const list = root?.querySelector('[data-role="rack-module-list"]');
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            const rack = JSON.parse(String(stored.values?.["rack.v1"]));
            return list?.firstElementChild?.getAttribute("data-role") === "rack-module-reverb"
                && rack.order[0] === "reverb";
        }, null, { timeout: 3_000 });
        const reorderResult = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const list = root?.querySelector('[data-role="rack-module-list"]');
            const handle = root?.querySelector('[data-role="rack-reorder-handle-reverb"]');
            const scrollRegion = root?.querySelector('[data-role="desktop-scroll-region"]');
            return {
                documentY: window.scrollY,
                firstRole: list?.firstElementChild?.getAttribute("data-role") ?? null,
                handleTouchAction: handle instanceof HTMLElement ? getComputedStyle(handle).touchAction : null,
                regionY: scrollRegion instanceof HTMLElement ? scrollRegion.scrollTop : 0,
            };
        });
        const storedRack = await page.evaluate(async () => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            return JSON.parse(String(stored.values?.["rack.v1"]));
        });
        assert.equal(
            reorderResult.firstRole,
            "rack-module-reverb",
            `Touch reorder did not preview: ${JSON.stringify({ reorderResult, scrollBefore, storedRack })}`,
        );
        assert.deepEqual(
            { documentY: reorderResult.documentY, regionY: reorderResult.regionY },
            scrollBefore,
            "The rack reorder handle yielded its touch gesture to page scrolling.",
        );
        assert.equal(storedRack.order[0], "reverb", "Touch reorder did not commit its new DSP order.");
    } finally {
        await page.close();
    }
});

test("generated mobile modulation source touch-drops onto a parameter inside the patch shadow root", {
    skip: browserEngine !== "chromium",
}, async () => {
    const page = await openStartedMobileRackPage();

    try {
        const railGripCenter = await centerOf(page.locator('[data-role="mobile-global-mod-rail-grip"]'));
        await page.touchscreen.tap(railGripCenter.x, railGripCenter.y);
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
        await page.waitForTimeout(220);
        const sourceStart = await centerOf(page.locator('[data-role="rack-mod-source-mseg-1"]'));
        const targetEnd = await centerOf(page.locator('[data-rack-mod-target="distortionKnee"]'));
        await dispatchTouchDrag(page, sourceStart, targetEnd, {
            afterFirstMove: async () => {
                await page
                    .locator('[data-role="mobile-global-mod-rail"][data-mapping-active="true"]')
                    .waitFor();
                await page.waitForFunction(() => {
                    const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
                    const rail = root?.querySelector('[data-role="mobile-global-mod-rail"]');
                    return rail instanceof HTMLElement && getComputedStyle(rail).pointerEvents === "none";
                });
            },
        });

        await page.waitForFunction(async () => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            const serialized = stored.values?.["modulation.v2"];
            if (typeof serialized !== "string") {
                return false;
            }
            const state = JSON.parse(serialized);
            return Array.isArray(state.routes) && state.routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionKnee"
            ));
        }, null, { timeout: 3_000 });
        const modulationState = await page.evaluate(async () => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            return stored.values?.["modulation.v2"] ?? null;
        });
        const route = deserializeModulationState(modulationState).routes.find((candidate) => (
            candidate.sourceKind === "mseg"
            && candidate.sourceSlot === 1
            && candidate.targetKind === "rack.distortionKnee"
        ));
        assert.ok(
            route,
            `Touch drag from MSEG 1 did not create the Distortion Knee route: ${String(modulationState)}`,
        );
    } finally {
        await page.close();
    }
});

test("generated mobile modulation rail keeps one continuous vector silhouette", async () => {
    const page = await openStartedMobileRackPage();

    const readSilhouette = async () => await page.evaluate(() => {
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        const rail = root?.querySelector('[data-role="mobile-global-mod-rail"]');
        const silhouette = rail?.querySelector('[data-role="mobile-global-mod-rail-silhouette"]');
        const paths = silhouette ? Array.from(silhouette.querySelectorAll("path")) : [];
        const path = paths[0] ?? null;
        const pathStyle = path ? getComputedStyle(path) : null;
        return {
            expanded: rail?.getAttribute("data-expanded") ?? null,
            pathCount: paths.length,
            closed: /Z\s*$/i.test(path?.getAttribute("d") ?? ""),
            fill: pathStyle?.fill ?? null,
            stroke: pathStyle?.stroke ?? null,
            fragmentShoulderCount: rail?.querySelectorAll('[data-role="mobile-global-mod-rail-shoulder"]').length ?? -1,
            gripBackground: rail
                ? getComputedStyle(rail.querySelector('[data-role="mobile-global-mod-rail-grip"]')).backgroundColor
                : null,
        };
    });

    try {
        const collapsed = await readSilhouette();
        assert.deepEqual(collapsed, {
            expanded: "false",
            pathCount: 1,
            closed: true,
            fill: collapsed.fill,
            stroke: collapsed.stroke,
            fragmentShoulderCount: 0,
            gripBackground: "rgba(0, 0, 0, 0)",
        });
        assert.notEqual(collapsed.fill, "none");
        assert.notEqual(collapsed.stroke, "none");

        const gripCenter = await centerOf(page.locator('[data-role="mobile-global-mod-rail-grip"]'));
        await page.touchscreen.tap(gripCenter.x, gripCenter.y);
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
        const expanded = await readSilhouette();
        assert.equal(expanded.pathCount, 1);
        assert.equal(expanded.closed, true);
        assert.equal(expanded.fragmentShoulderCount, 0);
    } finally {
        await page.close();
    }
});

test("generated browser proof plays and visibly presses notes from a touchscreen", {
    skip: browserEngine !== "webkit",
}, async () => {
    const page = await browser.newPage({
        ...devices["iPhone 13"],
    });

    try {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "audioSession", {
                configurable: true,
                value: { type: "ambient" },
            });
        });
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });

        const startBounds = await page.locator("#cosimo-start-overlay").boundingBox();
        assert.ok(startBounds, "Expected the Start audio control to be visible.");
        await page.touchscreen.tap(
            startBounds.x + startBounds.width / 2,
            startBounds.y + startBounds.height / 2,
        );
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.hasActiveTable;
        }, null, { timeout: 30_000 });
        assert.equal(
            await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioSessionType),
            "playback",
            "The explicitly started synth must use iOS's audible playback session, not the silent-switch ambient session.",
        );

        await page.locator('[data-role="mobile-workspace-toggle-fx"]').click();
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return root?.querySelectorAll('[data-role="rack-module-list"] > [data-rack-effect-id]').length === 8;
        });
        const rackLayout = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const listBounds = root?.querySelector('[data-role="rack-module-list"]')?.getBoundingClientRect();
            const editorBounds = root?.querySelector('[data-role^="rack-editor-"]')?.getBoundingClientRect();
            const amountBounds = root?.querySelector('[data-role="rack-modulation-amount"]')?.getBoundingClientRect();
            const sourceLabels = Array.from(root?.querySelectorAll('[data-role^="rack-mod-source-"]') ?? [])
                .map((source) => source.getAttribute("aria-label") ?? "");
            return {
                amountWithinEditor: !amountBounds || Boolean(editorBounds
                    && amountBounds.left >= editorBounds.left
                    && amountBounds.right <= editorBounds.right),
                listHeight: listBounds?.height ?? 0,
                sourceLabels,
            };
        });
        assert.equal(rackLayout.amountWithinEditor, true, "The mapping amount must consume only the editor column.");
        assert.ok(rackLayout.listHeight > 400, "All eight compact rack rows must remain present in the mobile flow.");
        assert.equal(rackLayout.sourceLabels.some((label) => /LFO/i.test(label)), false, "The rack must expose no LFO source.");

        const noteBounds = await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const keyboard = view?.shadowRoot?.querySelector("cosimo-react-desktop-keyboard");
            const note = keyboard?.shadowRoot?.querySelector("#note48");
            const bounds = note?.getBoundingClientRect();

            globalThis.__COSIMO_TOUCH_TEST__ = {
                noteDownCount: 0,
                noteUpCount: 0,
                sawActive: false,
            };
            keyboard?.addEventListener("note-down", () => {
                globalThis.__COSIMO_TOUCH_TEST__.noteDownCount += 1;
            });
            keyboard?.addEventListener("note-up", () => {
                globalThis.__COSIMO_TOUCH_TEST__.noteUpCount += 1;
            });
            new MutationObserver(() => {
                if (note?.classList.contains("active")) {
                    globalThis.__COSIMO_TOUCH_TEST__.sawActive = true;
                }
            }).observe(note, { attributeFilter: ["class"] });

            return bounds
                ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                : null;
        });
        assert.ok(noteBounds, "Expected middle C to be touchable.");

        await page.touchscreen.tap(
            noteBounds.x + noteBounds.width / 2,
            noteBounds.y + noteBounds.height * 0.8,
        );
        await page.waitForFunction(() => {
            const touch = globalThis.__COSIMO_TOUCH_TEST__;
            return touch?.noteDownCount === 1
                && touch.noteUpCount === 1
                && touch.sawActive;
        }, null, { timeout: 10_000 });

        const heldTouch = await holdTouchKeyboardNote(page);
        assert.equal(heldTouch?.active, true, "Expected a held touch to keep the key visibly pressed.");
        assert.ok(heldTouch?.audioPeak > 0.00001, `Expected non-silent touch audio, received peak ${heldTouch?.audioPeak ?? 0}.`);

        await page.evaluate(async () => {
            await globalThis.__COSIMO_WEB_POC__.suspendAudioForTest();
            globalThis.__COSIMO_WEB_POC__.resetAudioMetrics();
        });
        assert.equal(
            await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioContextState),
            "suspended",
            "Expected the test to reproduce an interrupted iPhone audio session.",
        );

        await page.touchscreen.tap(
            noteBounds.x + noteBounds.width / 2,
            noteBounds.y + noteBounds.height * 0.8,
        );
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__?.getSnapshot().audioContextState === "running"
        ), null, { timeout: 3_000 });

        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.resetAudioMetrics());
        const recoveredTouch = await holdTouchKeyboardNote(page, { touchIdentifier: 8 });
        assert.equal(recoveredTouch?.active, true, "Expected the recovered Safari touch to keep the key pressed.");
        assert.equal(recoveredTouch?.audioContextState, "running");
        assert.ok(
            recoveredTouch?.audioPeak > 0.00001,
            `Expected non-silent audio after Safari recovery, received peak ${recoveredTouch?.audioPeak ?? 0}.`,
        );
    } finally {
        await page.close();
    }
});

test("generated browser proof shows the wavetable and filter cards on mobile", {
    skip: browserEngine !== "webkit",
}, async () => {
    const page = await browser.newPage({
        ...devices["iPhone 13"],
    });

    try {
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });

        const cards = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const readBounds = (selector) => {
                const bounds = root?.querySelector(selector)?.getBoundingClientRect();
                return bounds ? { width: bounds.width, height: bounds.height } : null;
            };

            return {
                filter: readBounds('[data-role="filter-card"]'),
                wavetable: readBounds('[data-role="wavetable-card"]'),
            };
        });

        assert.ok(cards.wavetable?.width > 0 && cards.wavetable.height > 0, "Expected the mobile wavetable card to be visible.");
        assert.ok(cards.filter?.width > 0 && cards.filter.height > 0, "Expected the mobile filter card to be visible.");
    } finally {
        await page.close();
    }
});
