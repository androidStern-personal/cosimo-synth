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
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".svg") return "image/svg+xml";
    if (extension === ".png") return "image/png";
    if (extension === ".ttf") return "font/ttf";
    if (extension === ".wav") return "audio/wav";
    return "application/octet-stream";
}

async function serve(request, response) {
    try {
        const requestUrl = new URL(request.url ?? "/", baseUrl);
        const relative = decodeURIComponent(
            requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1),
        );
        const filePath = path.resolve(webRoot, relative);
        if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const bytes = await fs.readFile(filePath);
        response.writeHead(200, {
            "cache-control": "no-store",
            "content-type": contentType(filePath),
        });
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
    browser = await chromium.launch({
        headless: true,
        ignoreDefaultArgs: ["--mute-audio"],
    });
});

after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
});

async function openStartedPage() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.addInitScript(() => {
        const NativeWorker = globalThis.Worker;
        globalThis.Worker = new Proxy(NativeWorker, {
            construct(target, argumentsList, newTarget) {
                if (String(argumentsList[0]).includes("bounce-render-worker")) {
                    const count = Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0) + 1;
                    sessionStorage.setItem("cosimo.bounce.worker-count", String(count));
                }
                return Reflect.construct(target, argumentsList, newTarget);
            },
        });
    });
    await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
        () => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready",
        null,
        { timeout: 120_000 },
    );
    await page.locator("#cosimo-start-overlay").click();
    await page.waitForFunction(
        () => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running",
        null,
        { timeout: 30_000 },
    );
    await page.evaluate(() => {
        globalThis.__COSIMO_BOUNCE_TEST_CONFIG__ = {
            roots: [60],
            holdSeconds: 0.08,
            tailCapSeconds: 0.12,
            concurrency: 1,
        };
    });
    return { context, failures, page };
}

async function measureHeldNoteWorkletLoad(page, note = 60, minimumBlocks = 256) {
    const epoch = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.resetAudioMetrics());
    await page.waitForFunction((expectedEpoch) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletAcknowledgedPerfEpoch
            === expectedEpoch
    ), epoch, { timeout: 5_000 });
    await page.evaluate((noteNumber) => globalThis.__COSIMO_WEB_POC__.noteOn(noteNumber, 100), note);
    await page.waitForFunction((blockCount) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= blockCount
    ), minimumBlocks, { timeout: 15_000 });
    const measurement = await page.evaluate(() => {
        const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
        return {
            averageLoad: snapshot.audioWorkletQuantizedAverageLoad,
            maximumLoad: snapshot.audioWorkletQuantizedMaxLoad,
            blockCount: snapshot.audioWorkletBlockCount,
            deadlineMisses: snapshot.audioWorkletDefiniteDeadlineMissBlocks,
            clockSource: snapshot.audioWorkletClockSource,
        };
    });
    await page.evaluate((noteNumber) => globalThis.__COSIMO_WEB_POC__.noteOff(noteNumber), note);
    await page.waitForTimeout(100);
    assert.ok(Number.isFinite(measurement.averageLoad), JSON.stringify(measurement));
    return measurement;
}

async function averageHeldNoteWorkletLoad(page, windowCount = 2) {
    const windows = [];
    for (let index = 0; index < windowCount; index += 1) {
        windows.push(await measureHeldNoteWorkletLoad(page));
    }
    return {
        windows,
        averageLoad: windows.reduce((sum, entry) => sum + entry.averageLoad, 0) / windows.length,
        deadlineMisses: windows.reduce((sum, entry) => sum + entry.deadlineMisses, 0),
    };
}

test("Bounce UI cancels safely, completes through a real worker, and fits desktop plus 393x852", async () => {
    const { context, failures, page } = await openStartedPage();
    try {
        const bounce = page.locator('[data-role="bounce-start"]');
        await bounce.waitFor({ state: "visible" });
        const preInstallLoad = await averageHeldNoteWorkletLoad(page);

        // Cancel is reachable from the first preparation paint, and no durable
        // or runtime source transition is allowed to leak from that attempt.
        await bounce.click();
        const cancel = page.locator('[data-role="bounce-cancel"]');
        await page.waitForTimeout(250);
        const cancellationDiagnostic = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return {
                cancelCount: root?.querySelectorAll('[data-role="bounce-cancel"]').length ?? 0,
                error: root?.querySelector('[data-role="bounce-error-inline"]')?.textContent ?? null,
                progress: root?.querySelector('[data-role="bounce-progress"]')?.textContent ?? null,
            };
        });
        assert.equal(cancellationDiagnostic.cancelCount, 1, JSON.stringify(cancellationDiagnostic));
        await cancel.evaluate((button) => button.click());
        await bounce.waitFor({ state: "visible" });
        assert.equal(
            (await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot())).parameterValues.sourceMode,
            0,
        );
        const workerCountAfterCancel = await page.evaluate(() => (
            Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0)
        ));

        await bounce.click();
        await page.locator('[data-role="bounce-progress"]').waitFor({ state: "visible" });
        await page.locator('[data-role="bounce-sampled-source-stage"]').waitFor({
            state: "visible",
            timeout: 120_000,
        });
        await page.locator('[data-role="bounce-pcm-waveform"]').waitFor({ state: "visible" });
        await page.locator('[data-role="bounce-revert"]').waitFor({ state: "visible" });

        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 1
        ));
        const storedState = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.storedState());
        assert.ok(storedState.values?.["bounce.v1"] ?? storedState["bounce.v1"]);
        assert.equal(
            await page.evaluate(() => Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0)),
            workerCountAfterCancel + 1,
        );
        assert.equal(
            await page.locator('[data-role="oscillator-performance-controls"]').getAttribute("data-bounce-inert"),
            "true",
        );

        // The successful UI state must be backed by the installed sampler,
        // not merely by durable metadata and a rendered waveform.
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.resetAudioMetrics();
            api.noteOn(60, 100);
        });
        await page.waitForFunction(
            () => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioPeak > 0.001,
            null,
            { timeout: 20_000 },
        );
        const sampledPeak = await page.evaluate(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioPeak
        ));
        assert.ok(sampledPeak > 0.001, `Expected sampled audio, measured peak ${sampledPeak}`);
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOff(60));
        const sampledLoad = await averageHeldNoteWorkletLoad(page, 1);

        // The sampled source remains the source panel at the locked phone
        // viewport and does not force document-level horizontal scrolling.
        await page.setViewportSize({ width: 393, height: 852 });
        await page.locator('[data-role="bounce-sampled-source-stage"]').waitFor({ state: "visible" });
        const phoneLayout = await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const stage = view?.shadowRoot?.querySelector('[data-role="bounce-sampled-source-stage"]');
            const bounds = stage?.getBoundingClientRect();
            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: innerWidth,
                left: bounds?.left ?? -1,
                right: bounds?.right ?? Number.POSITIVE_INFINITY,
                height: bounds?.height ?? 0,
            };
        });
        assert.ok(phoneLayout.documentWidth <= phoneLayout.viewportWidth);
        assert.ok(phoneLayout.left >= 0 && phoneLayout.right <= phoneLayout.viewportWidth + 1);
        assert.ok(phoneLayout.height >= 220);

        await page.locator('[data-role="bounce-revert"]').click();
        await page.locator('[data-role="bounce-start"]').waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 0
        ));
        const revertedState = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.storedState());
        assert.equal(revertedState.values?.["bounce.v1"] ?? revertedState["bounce.v1"] ?? null, null);
        const residentOscillatorLoad = await averageHeldNoteWorkletLoad(page);
        assert.ok(
            residentOscillatorLoad.averageLoad <= preInstallLoad.averageLoad * 1.10,
            JSON.stringify({ preInstallLoad, sampledLoad, residentOscillatorLoad }),
        );
        assert.ok(
            residentOscillatorLoad.deadlineMisses <= preInstallLoad.deadlineMisses,
            JSON.stringify({ preInstallLoad, sampledLoad, residentOscillatorLoad }),
        );
        assert.ok(
            sampledLoad.deadlineMisses <= preInstallLoad.deadlineMisses,
            JSON.stringify({ preInstallLoad, sampledLoad, residentOscillatorLoad }),
        );
        console.log(`# ${JSON.stringify({
            bounceG2: {
                note: 60,
                preInstallLoad,
                sampledLoad,
                residentOscillatorLoad,
                absoluteVmTimingAdvisory: true,
            },
        })}`);

        assert.deepEqual(failures, []);
    } finally {
        await context.close();
    }
});
