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
            processMultiplier: snapshot.audioWorkletProcessMultiplier,
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

async function setPerfProcessMultiplier(page, multiplier) {
    await page.evaluate((nextMultiplier) => {
        globalThis.__COSIMO_WEB_POC__.setPerfProcessMultiplier(nextMultiplier);
    }, multiplier);
    await page.waitForFunction((expectedMultiplier) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletProcessMultiplier
            === expectedMultiplier
    ), multiplier, { timeout: 5_000 });
}

async function storedBounceDocument(page) {
    return page.evaluate(async () => {
        const state = await globalThis.__COSIMO_WEB_POC__.storedState();
        const value = state.values?.["bounce.v1"] ?? state["bounce.v1"] ?? null;
        return typeof value === "string" ? JSON.parse(value) : value;
    });
}

async function bounceStoreUsage(page) {
    return page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle("cosimo-bounce-banks-v1", { create: true });
        const entries = [];
        for await (const [name, handle] of directory.entries()) {
            const match = /^bank-([0-9a-f]{64})\.csbk$/.exec(name);
            if (match && handle.kind === "file") {
                entries.push({ digest: match[1], byteLength: (await handle.getFile()).size });
            }
        }
        entries.sort((left, right) => left.digest.localeCompare(right.digest));
        return {
            bankCount: entries.length,
            bankBytes: entries.reduce((sum, entry) => sum + entry.byteLength, 0),
            entries,
        };
    });
}

async function discardBounceGuardIfOpen(page) {
    await page.waitForTimeout(50);
    return page.evaluate(() => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const presetBar = view?.shadowRoot?.querySelector("cosimo-preset-bar");
        const shadow = presetBar?.shadowRoot;
        const dialog = shadow?.querySelector('[data-el="sound-replacement-dialog"]');
        const discard = shadow?.querySelector('[data-action="sound-replacement-discard"]');
        if (!(dialog instanceof HTMLElement) || dialog.hidden
            || !(discard instanceof HTMLButtonElement)) {
            return false;
        }
        discard.click();
        return true;
    });
}

async function waitForBounceAudioAvailable(page, timeout = 30_000) {
    await page.waitForFunction(() => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const presetBar = view?.shadowRoot?.querySelector("cosimo-preset-bar");
        const action = presetBar?.shadowRoot?.querySelector('.flyout-synth-action[data-action="bounce-audio"]');
        return action instanceof HTMLButtonElement && !action.disabled;
    }, null, { timeout });
}

async function clickBounceAudio(page) {
    await page.evaluate(() => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const presetBar = view?.shadowRoot?.querySelector("cosimo-preset-bar");
        const shadow = presetBar?.shadowRoot;
        const action = shadow?.querySelector('.flyout-synth-action[data-action="bounce-audio"]');
        if (!(action instanceof HTMLButtonElement) || action.disabled) {
            throw new Error("Bounce Audio is not available in the preset dropdown.");
        }
        shadow.querySelector('[data-action="toggle-flyout"]')?.click();
        action.click();
    });
}

async function completeBounce(page, expectedGeneration) {
    const before = await page.evaluate(() => ({
        captures: globalThis.__COSIMO_BOUNCE_TEST_DIAGNOSTICS__?.captures.length ?? 0,
        retirements: globalThis.__COSIMO_BOUNCE_TEST_DIAGNOSTICS__?.retirements.length ?? 0,
    }));
    await clickBounceAudio(page);
    await discardBounceGuardIfOpen(page);
    await page.waitForFunction(({ captures, retirements, generation }) => {
        const diagnostics = globalThis.__COSIMO_BOUNCE_TEST_DIAGNOSTICS__;
        const latest = diagnostics?.captures.at(-1);
        return (diagnostics?.captures.length ?? 0) > captures
            && (diagnostics?.retirements.length ?? 0) > retirements
            && latest?.generation === generation;
    }, {
        captures: before.captures,
        retirements: before.retirements,
        generation: expectedGeneration,
    }, { timeout: 120_000 });
    await waitForBounceAudioAvailable(page);
    return storedBounceDocument(page);
}

async function completeRevert(page, expectedGeneration) {
    await page.locator('[data-role="bounce-revert"]').click();
    await page.waitForFunction(async (generation) => {
        const state = await globalThis.__COSIMO_WEB_POC__.storedState();
        const value = state.values?.["bounce.v1"] ?? state["bounce.v1"] ?? null;
        const document = typeof value === "string" ? JSON.parse(value) : value;
        return document?.generation === generation
            && globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 1;
    }, expectedGeneration, { timeout: 30_000 });
    await waitForBounceAudioAvailable(page);
    return storedBounceDocument(page);
}

test("Bounce UI cancels safely, completes through a real worker, and fits desktop plus 393x852", async () => {
    const { context, failures, page } = await openStartedPage();
    try {
        await waitForBounceAudioAvailable(page);
        // Run two identical DSP passes per callback so the real work rises
        // above Date.now's 1 ms quantization without exceeding the callback
        // budget. This test-only multiplier applies equally to both sides.
        await setPerfProcessMultiplier(page, 2);
        // Headless Chromium exposes only integer-millisecond Date.now inside
        // this AudioWorklet. Discard two cold windows before taking the paired
        // oscillator baseline so JIT/clock warm-up is not mistaken for DSP.
        await averageHeldNoteWorkletLoad(page);
        const preInstallLoad = await averageHeldNoteWorkletLoad(page);
        await setPerfProcessMultiplier(page, 1);

        // Cancel is reachable from the first preparation paint, and no durable
        // or runtime source transition is allowed to leak from that attempt.
        await clickBounceAudio(page);
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
        await waitForBounceAudioAvailable(page);
        assert.equal(
            (await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot())).parameterValues.sourceMode,
            0,
        );
        const workerCountAfterCancel = await page.evaluate(() => (
            Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0)
        ));

        await clickBounceAudio(page);
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
        await setPerfProcessMultiplier(page, 2);
        const sampledLoad = await averageHeldNoteWorkletLoad(page, 1);
        await setPerfProcessMultiplier(page, 1);

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

        // Compare like with like: restore the baseline viewport before the
        // paired resident-bank measurement, then discard the transition/JIT
        // windows under the same coarse worklet clock.
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.locator('[data-role="bounce-revert"]').click();
        await waitForBounceAudioAvailable(page);
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 0
        ));
        const revertedState = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.storedState());
        assert.equal(revertedState.values?.["bounce.v1"] ?? revertedState["bounce.v1"] ?? null, null);
        await setPerfProcessMultiplier(page, 2);
        await averageHeldNoteWorkletLoad(page);
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

test("M7 recursively bounces the same roots, retires superseded bytes, and stays bounded for ten cycles", async () => {
    const { context, failures, page } = await openStartedPage();
    try {
        const first = await completeBounce(page, 1);
        assert.deepEqual(first.roots, [60]);

        // Deliberately color each fresh layer so the three generations have
        // distinct content digests and exercise actual retirement rather than
        // content-addressed deduplication.
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 6_000);
        });
        const second = await completeBounce(page, 2);
        assert.deepEqual(second.roots, first.roots);
        assert.equal(second.revertRef.bankDigest, first.digest);
        assert.notEqual(second.digest, first.digest);
        const exactSecondDocument = JSON.stringify(second);

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("filterMode", 4);
            api.setParameter("filterCutoff", 2_200);
        });
        const third = await completeBounce(page, 3);
        assert.deepEqual(third.roots, first.roots);
        assert.equal(third.revertRef.bankDigest, second.digest);
        assert.notEqual(third.digest, second.digest);

        const afterThird = await bounceStoreUsage(page);
        assert.deepEqual(
            afterThird.entries.map((entry) => entry.digest),
            [second.digest, third.digest].sort(),
            "generation 1 must be gone after its inactive DSP slot is overwritten",
        );

        const reverted = await completeRevert(page, 2);
        assert.equal(JSON.stringify(reverted), exactSecondDocument,
            "Revert must restore the latest pre-bounce document exactly");

        const soakUsage = [];
        const soakHeap = [];
        for (let cycle = 0; cycle < 10; cycle += 1) {
            const rebounced = await completeBounce(page, 3);
            assert.equal(rebounced.digest, third.digest,
                `cycle ${cycle + 1} must reproduce generation 3 deterministically`);
            soakUsage.push(await bounceStoreUsage(page));
            soakHeap.push((await page.evaluate(() => (
                globalThis.__COSIMO_WEB_POC__.getSnapshot().usedJSHeapSize
            ))) ?? null);
            const cycleRevert = await completeRevert(page, 2);
            assert.equal(JSON.stringify(cycleRevert), exactSecondDocument);
        }

        const diagnostics = await page.evaluate(() => (
            structuredClone(globalThis.__COSIMO_BOUNCE_TEST_DIAGNOSTICS__)
        ));
        const wasmPages = diagnostics.captures.flatMap((capture) => capture.wasmMemoryPages);
        assert.equal(wasmPages.every(Number.isInteger), true);
        assert.equal(new Set(wasmPages).size, 1,
            `recursive worker wasm pages ratcheted: ${JSON.stringify(wasmPages)}`);
        assert.equal(soakUsage.every((usage) => (
            usage.bankCount === afterThird.bankCount
            && usage.bankBytes === afterThird.bankBytes
        )), true, JSON.stringify({ afterThird, soakUsage }));
        assert.deepEqual(failures, []);
        console.log(`# ${JSON.stringify({
            bounceG5: {
                cycles: 10,
                workerWasmPages: wasmPages[0],
                opfsBankCount: afterThird.bankCount,
                opfsBankBytes: afterThird.bankBytes,
                usedJSHeapSizeAdvisory: soakHeap,
                absoluteVmTimingAdvisory: true,
            },
        })}`);
    } finally {
        await context.close();
    }
});
