import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { routeHermeticPage } from "./helpers/hermetic_page.mjs";
import { buildMaximalCurrentSpeedrunPatch } from "./helpers/speedrun_test_context.mjs";
import { startStaticWebServer } from "./helpers/static_web_server.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;

async function newStudioPage({ trackResources = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1180, height: 900 } });
    await routeHermeticPage(context, baseUrl);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseUrl).origin });
    if (trackResources) {
        await context.addInitScript(() => {
            const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
            const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
            const liveObjectURLs = new Set();
            let createdObjectURLCount = 0;
            let peakObjectURLCount = 0;
            URL.createObjectURL = (blob) => {
                const url = nativeCreateObjectURL(blob);
                liveObjectURLs.add(url);
                createdObjectURLCount += 1;
                peakObjectURLCount = Math.max(peakObjectURLCount, liveObjectURLs.size);
                return url;
            };
            URL.revokeObjectURL = (url) => {
                liveObjectURLs.delete(String(url));
                nativeRevokeObjectURL(url);
            };

            const NativeWorker = globalThis.Worker;
            let liveCheckpointWorkerCount = 0;
            let createdCheckpointWorkerCount = 0;
            let peakCheckpointWorkerCount = 0;
            const TrackingWorker = new Proxy(NativeWorker, {
                construct(target, args) {
                    const worker = Reflect.construct(target, args);
                    if (!String(args[0]).includes("speedrun-checkpoint-worker.js")) return worker;
                    liveCheckpointWorkerCount += 1;
                    createdCheckpointWorkerCount += 1;
                    peakCheckpointWorkerCount = Math.max(
                        peakCheckpointWorkerCount,
                        liveCheckpointWorkerCount,
                    );
                    const nativeTerminate = worker.terminate.bind(worker);
                    let live = true;
                    Object.defineProperty(worker, "terminate", {
                        configurable: true,
                        value: () => {
                            if (live) {
                                live = false;
                                liveCheckpointWorkerCount -= 1;
                            }
                            return nativeTerminate();
                        },
                    });
                    return worker;
                },
            });
            Object.defineProperty(globalThis, "Worker", {
                configurable: true,
                writable: true,
                value: TrackingWorker,
            });
            Object.defineProperty(globalThis, "__COSIMO_SPEEDRUN_RESOURCE_PROBE__", {
                configurable: true,
                value: {
                    snapshot: () => ({
                        liveObjectURLCount: liveObjectURLs.size,
                        createdObjectURLCount,
                        peakObjectURLCount,
                        liveCheckpointWorkerCount,
                        createdCheckpointWorkerCount,
                        peakCheckpointWorkerCount,
                    }),
                },
            });
        });
    }
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.goto(new URL("speedrun/", baseUrl).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__COSIMO_SPEEDRUN_STUDIO__?.ready === true);
    return { context, page, failures };
}

async function drivePipeline(page, patch, {
    patchFileName,
    durationSeconds,
    midiBytes,
    container = "auto",
}) {
    await page.locator("input[name=patch-source][value=file]").check();
    await page.getByTestId("patch-file").setInputFiles({
        name: patchFileName,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(patch)),
    });
    await page.locator("input[name=performance-source][value=file]").check();
    await page.getByTestId("performance-file").setInputFiles({
        name: "one-note.mid",
        mimeType: "audio/midi",
        buffer: midiBytes,
    });
    await page.getByTestId("duration-ceiling").fill(String(durationSeconds));
    await page.getByTestId("analyze-button").click();
    await page.getByTestId("recipe-report").waitFor({ timeout: 30_000 });
    await page.getByTestId("render-audio-button").click();
    await page.getByTestId("audio-ready").waitFor({ timeout: 120_000 });
    await page.getByTestId("container-choice").selectOption(container);
    await page.getByTestId("video-quality").selectOption("very-low");
    await page.getByTestId("render-video-button").click();
    await page.getByTestId("video-ready").waitFor({ timeout: 360_000 });
    return page.evaluate(() => window.__COSIMO_SPEEDRUN_STUDIO__.snapshot());
}

function assertVerifiedMP4(snapshot) {
    assert.ok(snapshot.prepared);
    assert.ok(snapshot.audio?.bytes > 100_000, JSON.stringify(snapshot.audio));
    assert.ok(snapshot.video?.verification.blobBytes > 50_000, JSON.stringify(snapshot.video));
    const verification = snapshot.video.verification;
    assert.equal(verification.container, "mp4");
    assert.equal(verification.videoTrackCount, 1);
    assert.equal(verification.audioTrackCount, 1);
    assert.equal(verification.videoCodec, "avc");
    assert.equal(verification.audioCodec, "aac");
    assert.ok(Math.abs(verification.durationSeconds - snapshot.prepared.durationSeconds) <= 0.15,
        JSON.stringify(verification));
    assert.ok(verification.audioWindows.length >= 1, JSON.stringify(verification));
    assert.ok(verification.audioWindows.every((window) => window.sampleCount > 0 && window.rms > 0.00001),
        JSON.stringify(verification.audioWindows));
    assert.equal(snapshot.ownedObjectURLCount, 2);
}

function assertVerifiedWebM(snapshot) {
    assert.ok(snapshot.prepared);
    assert.ok(snapshot.audio?.bytes > 100_000, JSON.stringify(snapshot.audio));
    assert.ok(snapshot.video?.verification.blobBytes > 20_000, JSON.stringify(snapshot.video));
    const verification = snapshot.video.verification;
    assert.equal(verification.container, "webm");
    assert.equal(verification.videoTrackCount, 1);
    assert.equal(verification.audioTrackCount, 1);
    assert.equal(verification.videoCodec, "vp9");
    assert.equal(verification.audioCodec, "opus");
    assert.ok(Math.abs(verification.durationSeconds - snapshot.prepared.durationSeconds) <= 0.15,
        JSON.stringify(verification));
    assert.ok(verification.audioWindows.length >= 1, JSON.stringify(verification));
    assert.ok(verification.audioWindows.every((window) => window.sampleCount > 0 && window.rms > 0.00001),
        JSON.stringify(verification.audioWindows));
    assert.equal(snapshot.ownedObjectURLCount, 2);
}

before(async () => {
    server = await startStaticWebServer(webRoot);
    baseUrl = server.baseUrl;
    browser = await chromium.launch({
        headless: true,
        args: ["--enable-precise-memory-info"],
    });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("fixture patch plus uploaded MIDI produces a downloadable verified MP4 and adjacent share link", {
    timeout: 420_000,
}, async () => {
    const midiBytes = await fs.readFile(path.join(repoRoot, "demo", "one_note.mid"));
    const { context, page, failures } = await newStudioPage();
    const snapshot = await drivePipeline(page, {
        label: "Studio MIDI Fixture",
        parameters: {
            oscBMute: 1,
            oscCMute: 1,
            oscAWavetableSelect: 12,
            oscAWavetablePosition: 0.43,
            filterCutoff: 720,
        },
        storedState: {},
    }, {
        patchFileName: "studio-midi-fixture.json",
        durationSeconds: 4,
        midiBytes,
    });
    assertVerifiedMP4(snapshot);
    assert.deepEqual(snapshot.prepared.sectionIds, ["oscillator-A", "voice-filter"]);

    const delivery = page.locator(".delivery-actions");
    assert.equal(await delivery.getByTestId("download-video").count(), 1);
    assert.equal(await delivery.getByTestId("copy-share-link").count(), 1);
    const blobProof = await page.getByTestId("download-video").evaluate(async (link) => {
        const blob = await (await fetch(link.href)).blob();
        const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        return {
            bytes: blob.size,
            type: blob.type,
            box: String.fromCharCode(...header.slice(4, 8)),
            download: link.download,
        };
    });
    assert.equal(blobProof.type, "video/mp4");
    assert.equal(blobProof.box, "ftyp");
    assert.equal(blobProof.download, "studio-midi-fixture-speedrun.mp4");
    assert.equal(blobProof.bytes, snapshot.video.verification.blobBytes);

    await page.getByTestId("copy-share-link").click();
    await page.getByRole("status").waitFor();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clipboard, snapshot.prepared.shareURL);
    assert.match(clipboard, /\/#p=1\./u);

    await page.getByTestId("render-video-button").click();
    await page.waitForFunction(() => window.__COSIMO_SPEEDRUN_STUDIO__.snapshot().activeStage === "video");
    await page.getByRole("button", { name: "Cancel video" }).click();
    await page.getByTestId("error-cancelled").waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => window.__COSIMO_SPEEDRUN_STUDIO__.snapshot().activeStage === null);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ speedrunM6MidiPipeline: snapshot.video.verification })}`);
    await context.close();
});

test("the current effects-lane split with delay#2 renders through the same verified MP4 path", {
    timeout: 420_000,
}, async () => {
    const [midiBytes, lane] = await Promise.all([
        fs.readFile(path.join(repoRoot, "demo", "one_note.mid")),
        fs.readFile(path.join(repoRoot, "tests", "fixtures", "speedrun", "effects-lane-split.json"), "utf8")
            .then(JSON.parse),
    ]);
    const { context, page, failures } = await newStudioPage();
    const snapshot = await drivePipeline(page, {
        label: "Studio Split Delay",
        parameters: {
            oscBMute: 1,
            oscCMute: 1,
            oscAWavetableSelect: 12,
            oscAWavetablePosition: 0.43,
            filterCutoff: 720,
        },
        storedState: { "lane.v1": lane },
    }, {
        patchFileName: "studio-effects-lane-fixture.json",
        durationSeconds: 5,
        midiBytes,
    });
    assertVerifiedMP4(snapshot);
    assert.ok(snapshot.prepared.sectionIds.includes("effect-delay#2"), JSON.stringify(snapshot.prepared.sectionIds));
    assert.ok(snapshot.prepared.sectionIds.includes("effect-reverb#1"), JSON.stringify(snapshot.prepared.sectionIds));
    assert.ok(snapshot.video.verification.audioWindows.some((window) => window.sectionId === "effect-delay#2"),
        JSON.stringify(snapshot.video.verification.audioWindows));
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ speedrunM6EffectsLanePipeline: snapshot.video.verification })}`);
    await context.close();
});

test("the maximal current patch reaches the ceiling and reports an oversized share link without blocking video analysis", {
    timeout: 120_000,
}, async () => {
    const maximal = await buildMaximalCurrentSpeedrunPatch();
    const { context, page, failures } = await newStudioPage();
    await page.locator("input[name=patch-source][value=file]").check();
    await page.getByTestId("patch-file").setInputFiles({
        name: "maximum-current-contract.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(maximal.patch)),
    });
    await page.getByTestId("duration-ceiling").fill("90");
    await page.getByTestId("analyze-button").click();
    await page.getByTestId("recipe-report").waitFor({ timeout: 30_000 });

    const snapshot = await page.evaluate(() => window.__COSIMO_SPEEDRUN_STUDIO__.snapshot());
    assert.equal(snapshot.prepared.durationInFrames, 2_700);
    assert.equal(snapshot.prepared.durationSeconds, 90);
    assert.equal(snapshot.prepared.compressionLevel, 3);
    assert.equal(snapshot.prepared.shareURL, null);
    assert.equal(snapshot.prepared.shareError.code, "URLTooLong");
    assert.match(await page.locator(".compression-note").innerText(), /compression level 3/u);
    assert.match(await page.getByTestId("share-link-unavailable").innerText(), /video rendering is unaffected/u);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({
        speedrunM7MaximalStudio: {
            ...snapshot.prepared,
            sectionCount: snapshot.prepared.sectionIds.length,
        },
    })}`);
    await context.close();
});

test("the labeled WebM fallback produces one verified VP9 and Opus download", {
    timeout: 420_000,
}, async () => {
    const midiBytes = await fs.readFile(path.join(repoRoot, "demo", "one_note.mid"));
    const { context, page, failures } = await newStudioPage();
    const snapshot = await drivePipeline(page, {
        label: "Studio WebM Fallback",
        parameters: {
            oscBMute: 1,
            oscCMute: 1,
            oscAWavetableSelect: 12,
            oscAWavetablePosition: 0.43,
        },
        storedState: {},
    }, {
        patchFileName: "studio-webm-fixture.json",
        durationSeconds: 4,
        midiBytes,
        container: "webm",
    });
    assertVerifiedWebM(snapshot);

    const blobProof = await page.getByTestId("download-video").evaluate(async (link) => {
        const blob = await (await fetch(link.href)).blob();
        return {
            bytes: blob.size,
            type: blob.type,
            header: [...new Uint8Array(await blob.slice(0, 4).arrayBuffer())],
            download: link.download,
        };
    });
    assert.equal(blobProof.type, "video/webm");
    assert.deepEqual(blobProof.header, [0x1a, 0x45, 0xdf, 0xa3]);
    assert.equal(blobProof.download, "studio-webm-fallback-speedrun.webm");
    assert.equal(blobProof.bytes, snapshot.video.verification.blobBytes);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({ speedrunM7WebMFallback: snapshot.video.verification })}`);
    await context.close();
});

test("five consecutive end-to-end renders release every checkpoint pool and keep object URLs and heap bounded", {
    timeout: 900_000,
}, async () => {
    const midiBytes = await fs.readFile(path.join(repoRoot, "demo", "one_note.mid"));
    const { context, page, failures } = await newStudioPage({ trackResources: true });
    const cdp = await context.newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    const patch = {
        label: "Studio Five Render Soak",
        parameters: {
            oscBMute: 1,
            oscCMute: 1,
            oscAWavetablePosition: 0.43,
        },
        storedState: {},
    };
    const snapshots = [await drivePipeline(page, patch, {
        patchFileName: "studio-five-render-soak.json",
        durationSeconds: 3,
        midiBytes,
    })];
    const resources = [];
    const heapBytes = [];

    const inspectSettledRender = async () => {
        await cdp.send("HeapProfiler.collectGarbage");
        const observation = await page.evaluate(() => ({
            resource: window.__COSIMO_SPEEDRUN_RESOURCE_PROBE__.snapshot(),
            heapBytes: performance.memory.usedJSHeapSize,
        }));
        resources.push(observation.resource);
        heapBytes.push(observation.heapBytes);
        assert.equal(observation.resource.liveCheckpointWorkerCount, 0);
        assert.ok(observation.resource.peakCheckpointWorkerCount <= 4, JSON.stringify(observation.resource));
        assert.equal(observation.resource.liveObjectURLCount, 2, JSON.stringify(observation.resource));
    };
    await inspectSettledRender();

    for (let cycle = 1; cycle < 5; cycle += 1) {
        const beforeAudioURLs = resources.at(-1).createdObjectURLCount;
        await page.getByTestId("render-audio-button").click();
        await page.waitForFunction((createdBefore) => {
            const studio = window.__COSIMO_SPEEDRUN_STUDIO__.snapshot();
            const probe = window.__COSIMO_SPEEDRUN_RESOURCE_PROBE__.snapshot();
            return probe.createdObjectURLCount > createdBefore
                && studio.activeStage === null
                && studio.audio !== null
                && studio.video === null
                && studio.ownedObjectURLCount === 1;
        }, beforeAudioURLs, { timeout: 120_000 });

        const beforeVideoURLs = await page.evaluate(() => (
            window.__COSIMO_SPEEDRUN_RESOURCE_PROBE__.snapshot().createdObjectURLCount
        ));
        await page.getByTestId("render-video-button").click();
        await page.waitForFunction((createdBefore) => {
            const studio = window.__COSIMO_SPEEDRUN_STUDIO__.snapshot();
            const probe = window.__COSIMO_SPEEDRUN_RESOURCE_PROBE__.snapshot();
            return probe.createdObjectURLCount > createdBefore
                && studio.activeStage === null
                && studio.video !== null
                && studio.ownedObjectURLCount === 2;
        }, beforeVideoURLs, { timeout: 360_000 });
        snapshots.push(await page.evaluate(() => window.__COSIMO_SPEEDRUN_STUDIO__.snapshot()));
        await inspectSettledRender();
    }

    snapshots.forEach(assertVerifiedMP4);
    assert.equal(resources.length, 5);
    assert.ok(resources.at(-1).createdCheckpointWorkerCount >= 5, JSON.stringify(resources));
    const settledHeapSpread = Math.max(...heapBytes.slice(1)) - Math.min(...heapBytes.slice(1));
    assert.ok(settledHeapSpread < 128 * 1024 * 1024, JSON.stringify(heapBytes));
    assert.ok(heapBytes.at(-1) <= heapBytes[0] + 128 * 1024 * 1024, JSON.stringify(heapBytes));

    await page.evaluate(() => window.__COSIMO_SPEEDRUN_STUDIO__.dispose());
    const disposed = await page.evaluate(() => ({
        studio: window.__COSIMO_SPEEDRUN_STUDIO__.snapshot(),
        resource: window.__COSIMO_SPEEDRUN_RESOURCE_PROBE__.snapshot(),
    }));
    assert.equal(disposed.studio.ownedObjectURLCount, 0);
    assert.equal(disposed.resource.liveObjectURLCount, 0);
    assert.equal(disposed.resource.liveCheckpointWorkerCount, 0);
    assert.deepEqual(failures, []);
    console.log(`# ${JSON.stringify({
        speedrunM7FiveRenderSoak: {
            heapBytes,
            heapSpreadBytes: settledHeapSpread,
            resources,
        },
    })}`);
    await context.close();
});
