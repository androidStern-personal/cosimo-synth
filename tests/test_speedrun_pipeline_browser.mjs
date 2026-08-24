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

async function newStudioPage() {
    const context = await browser.newContext({ viewport: { width: 1180, height: 900 } });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseUrl).origin });
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

before(async () => {
    server = createServer(serve);
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
