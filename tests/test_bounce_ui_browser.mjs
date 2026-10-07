import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { BOUNCE_DEFAULT_ROOTS } from "../bounce/capture-plan.mjs";
import { persistOneRootBounce, startProductWebServer } from "./helpers/bounce_browser_fixture.mjs";
import { createCurrentSpeedrunContext } from "./helpers/speedrun_test_context.mjs";

let browser;
let currentDefaults;
let server;

before(async () => {
    currentDefaults = (await createCurrentSpeedrunContext()).defaults;
    server = await startProductWebServer();
    browser = await chromium.launch({
        headless: true,
        ignoreDefaultArgs: ["--mute-audio"],
    });
});

after(async () => {
    await browser?.close();
    await server?.close();
});

async function waitForPhase(page, phase, timeout) {
    await page.waitForFunction(
        (expected) => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === expected,
        phase,
        { timeout },
    );
}

/**
 * Open the web synth with audio running. With `bounced`, the page first saves
 * a sound already bounced to one root and reloads onto it, so its recursive
 * Bounces render that one root.
 */
async function openStartedPage({ bounced = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    // Count Bounce render workers, and keep the Wasm memory size each one
    // reports with its rendered root.
    await page.addInitScript(() => {
        const NativeWorker = globalThis.Worker;
        globalThis.bounceWorkerWasmPages = [];
        globalThis.Worker = new Proxy(NativeWorker, {
            construct(target, argumentsList, newTarget) {
                const worker = Reflect.construct(target, argumentsList, newTarget);
                if (String(argumentsList[0]).includes("bounce-render-worker")) {
                    const count = Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0) + 1;
                    sessionStorage.setItem("cosimo.bounce.worker-count", String(count));
                    worker.addEventListener("message", (event) => {
                        if (event.data?.type === "render-root-complete") {
                            globalThis.bounceWorkerWasmPages.push(event.data.result.metrics.wasmMemoryPages);
                        }
                    });
                }
                return worker;
            },
        });
    });
    await page.goto(`${server.baseUrl}synth.html?test`, { waitUntil: "domcontentloaded" });
    await waitForPhase(page, "ready", 120_000);
    if (bounced) {
        await persistOneRootBounce(page, currentDefaults);
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForPhase(page, "ready", 120_000);
    }
    await page.locator("#cosimo-start-overlay").click();
    await waitForPhase(page, "running", 30_000);
    if (bounced) {
        await page.waitForFunction(
            () => globalThis.__COSIMO_WEB_POC__.getSnapshot().bounceRestore.status === "ready",
            null,
            { timeout: 120_000 },
        );
    }
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
        deadlineMissRate: windows.reduce((sum, entry) => sum + entry.deadlineMisses, 0)
            / windows.reduce((sum, entry) => sum + entry.blockCount, 0),
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
        const value = (await globalThis.__COSIMO_WEB_POC__.storedState()).values["bounce.v1"] ?? null;
        return typeof value === "string" ? JSON.parse(value) : value;
    });
}

/** Wait until the saved sound holds this Bounce generation and plays its bank. */
async function waitForBouncedGeneration(page, generation) {
    await page.waitForFunction(async (expected) => {
        const value = (await globalThis.__COSIMO_WEB_POC__.storedState()).values["bounce.v1"] ?? null;
        const document = typeof value === "string" ? JSON.parse(value) : value;
        return document?.generation === expected
            && globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 1;
    }, generation, { timeout: 120_000 });
    await waitForBounceAudioAvailable(page);
    return storedBounceDocument(page);
}

/** The digests and total size of the banks in the browser bank store. */
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

/** Open or close the synth's Sound actions menu, where Bounce audio lives. */
async function setSoundActionsOpen(page, open) {
    await page.evaluate((expanded) => {
        const toggle = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="synth-preset-bar"] [data-action="toggle-sound-actions"]');
        if (!(toggle instanceof HTMLButtonElement)) throw new Error("The Sound actions menu is missing.");
        if ((toggle.getAttribute("aria-expanded") === "true") !== expanded) toggle.click();
    }, open);
}

/** Wait until Bounce audio can be pressed again, then close the menu that offers it. */
async function waitForBounceAudioAvailable(page, timeout = 30_000) {
    await setSoundActionsOpen(page, true);
    await page.waitForFunction(() => {
        const action = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="sound-actions"] [data-action="bounce-audio"]');
        return action instanceof HTMLButtonElement && !action.disabled;
    }, null, { timeout });
    await setSoundActionsOpen(page, false);
}

async function clickBounceAudio(page) {
    await setSoundActionsOpen(page, true);
    await page.evaluate(() => {
        const action = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector('[data-role="sound-actions"] [data-action="bounce-audio"]');
        if (!(action instanceof HTMLButtonElement) || action.disabled) {
            throw new Error("Bounce audio is not available in the Sound actions menu.");
        }
        action.click();
    });
}

function workerCount(page) {
    return page.evaluate(() => Number(sessionStorage.getItem("cosimo.bounce.worker-count") ?? 0));
}

test("Bounce UI cancels safely, completes through real workers, and fits desktop plus 393x852", async () => {
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
        await cancel.waitFor({ state: "visible" });
        await cancel.evaluate((button) => button.click());
        await waitForBounceAudioAvailable(page);
        assert.equal(
            (await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot())).parameterValues.sourceMode,
            0,
        );
        assert.equal(await page.locator('[data-role="bounce-error-inline"]').count(), 0,
            "a cancelled Bounce is not an error");
        const workerCountAfterCancel = await workerCount(page);

        await clickBounceAudio(page);
        await page.locator('[data-role="bounce-progress"]').waitFor({ state: "visible" });
        await page.locator('[data-role="bounce-sampled-source-stage"]').waitFor({
            state: "visible",
            timeout: 300_000,
        });
        await page.locator('[data-role="bounce-pcm-waveform"]').waitFor({ state: "visible" });
        await page.locator('[data-role="bounce-revert"]').waitFor({ state: "visible" });

        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.sourceMode === 1
        ));
        assert.deepEqual((await storedBounceDocument(page)).roots, BOUNCE_DEFAULT_ROOTS);
        assert.equal(await workerCount(page), workerCountAfterCancel + BOUNCE_DEFAULT_ROOTS.length,
            "every root renders in a fresh worker");
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
        assert.equal(await storedBounceDocument(page), null);
        await setPerfProcessMultiplier(page, 2);
        await averageHeldNoteWorkletLoad(page);
        const residentOscillatorLoad = await averageHeldNoteWorkletLoad(page);
        // Two measurements of the same audio path differ by scheduling noise,
        // so every comparison with the oscillator baseline allows 10%.
        const loads = JSON.stringify({ preInstallLoad, sampledLoad, residentOscillatorLoad });
        assert.ok(residentOscillatorLoad.averageLoad <= preInstallLoad.averageLoad * 1.10, loads);
        assert.ok(residentOscillatorLoad.deadlineMissRate <= preInstallLoad.deadlineMissRate * 1.10, loads);
        assert.ok(sampledLoad.deadlineMissRate <= preInstallLoad.deadlineMissRate * 1.10, loads);

        assert.deepEqual(failures, []);
    } finally {
        await context.close();
    }
});

test("a bounced sound bounces again on its own roots, retires superseded banks, and stays bounded for ten cycles", async () => {
    const { context, failures, page } = await openStartedPage({ bounced: true });
    try {
        const first = await storedBounceDocument(page);
        assert.equal(first.generation, 1);

        // Colour each fresh layer so the generations have distinct content
        // digests and exercise real retirement rather than deduplication.
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 6_000);
        });
        await clickBounceAudio(page);
        const second = await waitForBouncedGeneration(page, 2);
        assert.deepEqual(second.roots, first.roots);
        assert.equal(second.revertRef.bankDigest, first.digest);
        assert.notEqual(second.digest, first.digest);
        const exactSecondDocument = JSON.stringify(second);

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("filterMode", 4);
            api.setParameter("filterCutoff", 2_200);
        });
        await clickBounceAudio(page);
        const third = await waitForBouncedGeneration(page, 3);
        assert.deepEqual(third.roots, first.roots);
        assert.equal(third.revertRef.bankDigest, second.digest);
        assert.notEqual(third.digest, second.digest);

        // Generation 1's bank goes once generation 3 overwrites its inactive
        // DSP slot; that deletion follows the audible flip.
        await page.waitForFunction(async (expected) => {
            const root = await navigator.storage.getDirectory();
            const directory = await root.getDirectoryHandle("cosimo-bounce-banks-v1");
            const digests = [];
            for await (const name of directory.keys()) {
                const match = /^bank-([0-9a-f]{64})\.csbk$/.exec(name);
                if (match) digests.push(match[1]);
            }
            return JSON.stringify(digests.sort()) === JSON.stringify(expected);
        }, [second.digest, third.digest].sort(), { timeout: 30_000 });
        const afterThird = await bounceStoreUsage(page);

        await page.locator('[data-role="bounce-revert"]').click();
        const reverted = await waitForBouncedGeneration(page, 2);
        assert.equal(JSON.stringify(reverted), exactSecondDocument,
            "Revert must restore the latest pre-bounce document exactly");

        const soakUsage = [];
        for (let cycle = 0; cycle < 10; cycle += 1) {
            await clickBounceAudio(page);
            const rebounced = await waitForBouncedGeneration(page, 3);
            assert.equal(rebounced.digest, third.digest,
                `cycle ${cycle + 1} must reproduce generation 3 deterministically`);
            soakUsage.push(await bounceStoreUsage(page));
            await page.locator('[data-role="bounce-revert"]').click();
            assert.equal(JSON.stringify(await waitForBouncedGeneration(page, 2)), exactSecondDocument);
        }

        const wasmPages = await page.evaluate(() => globalThis.bounceWorkerWasmPages);
        assert.equal(wasmPages.length, 12, "every recursive Bounce renders its one root in one worker");
        assert.equal(wasmPages.every(Number.isInteger), true);
        assert.equal(new Set(wasmPages).size, 1,
            `recursive worker wasm pages ratcheted: ${JSON.stringify(wasmPages)}`);
        assert.equal(soakUsage.every((usage) => (
            usage.bankCount === afterThird.bankCount
            && usage.bankBytes === afterThird.bankBytes
        )), true, JSON.stringify({ afterThird, soakUsage }));
        assert.deepEqual(failures, []);
    } finally {
        await context.close();
    }
});
