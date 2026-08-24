import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "build", "web");
const outputArtifactPath = process.env.COSIMO_VIDEO_BOUNCE_OUTPUT?.trim() || null;
const requestedContainer = outputArtifactPath === null ? "webm" : "mp4";
const requestedQuality = outputArtifactPath === null ? "very-low" : "high";
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
    timeout: 1_800_000,
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

        await page.locator('select[aria-label="Format"]').selectOption(requestedContainer);
        await page.locator('select[aria-label="Quality"]').selectOption(requestedQuality);
        await page.locator('[data-role="video-bounce-render-audio"]').click();
        await page.locator('[data-role="video-bounce-render-video"]').waitFor({ timeout: 120_000 });

        const audioProof = await page.locator('[data-role="video-bounce-flow"] audio').evaluate(async (audio) => {
            const blob = await (await fetch(audio.src)).blob();
            return { bytes: blob.size, type: blob.type };
        });
        assert.ok(audioProof.bytes > 100_000, JSON.stringify(audioProof));
        assert.equal(audioProof.type, "audio/wav");

        await page.locator('[data-role="video-bounce-render-video"]').click();
        const rendererIframe = page.locator('iframe[title="Cosimo scripted video renderer"]');
        const iframeHandle = await rendererIframe.elementHandle({ timeout: 120_000 });
        assert.ok(iframeHandle, "The integrated renderer did not create its scripted phone iframe.");
        const captureFrame = await iframeHandle.contentFrame();
        assert.ok(captureFrame, "The scripted phone iframe has no content frame.");
        const visualSamples = [];
        for (const threshold of [0, 30, 60]) {
            await captureFrame.waitForFunction((minimumFrame) => {
                const stage = document.querySelector(".speedrun-scripted-frame[data-frame]");
                const frame = Number(stage?.getAttribute("data-frame"));
                const root = document.querySelector('[data-role="scripted-desktop-patch-view"]');
                return Number.isFinite(frame)
                    && frame >= minimumFrame
                    && root?.querySelectorAll("canvas").length >= 1
                    && root?.querySelectorAll("svg").length >= 1;
            }, threshold, { timeout: 240_000 });
            visualSamples.push(await captureFrame.evaluate(() => {
                const stage = document.querySelector(".speedrun-scripted-frame[data-frame]");
                const root = document.querySelector('[data-role="scripted-desktop-patch-view"]');
                if (!(stage instanceof HTMLElement) || !(root instanceof HTMLElement)) {
                    throw new Error("The real scripted capture stage is missing.");
                }
                const frame = Number(stage.dataset.frame);
                return {
                    frame,
                    stageWidth: stage.getBoundingClientRect().width,
                    stageHeight: stage.getBoundingClientRect().height,
                    viewport: { width: innerWidth, height: innerHeight },
                    realSurface: root.querySelector(".cosimo-surface") !== null,
                    replicaSurface: root.querySelector(".speedrun-phone") !== null,
                    canvasCount: root.querySelectorAll("canvas").length,
                    svgCount: root.querySelectorAll("svg").length,
                    keyboardNoteCount: root.querySelectorAll(".keyboard .note").length,
                    workspace: root.querySelector('[data-role^="mobile-workspace-tab-"][aria-selected="true"]')
                        ?.getAttribute("data-role") ?? null,
                };
            }));
        }
        assert.ok(visualSamples[0].frame < visualSamples[1].frame, JSON.stringify(visualSamples));
        assert.ok(visualSamples[1].frame < visualSamples[2].frame, JSON.stringify(visualSamples));
        for (const sample of visualSamples) {
            assert.deepEqual(sample.viewport, { width: 393, height: 852 });
            assert.equal(sample.stageWidth, 1080);
            assert.equal(sample.stageHeight, 1920);
            assert.equal(sample.realSurface, true);
            assert.equal(sample.replicaSurface, false);
            assert.ok(sample.canvasCount >= 1, JSON.stringify(sample));
            assert.ok(sample.svgCount >= 1, JSON.stringify(sample));
            assert.equal(sample.keyboardNoteCount, 18, JSON.stringify(sample));
            assert.match(sample.workspace, /^mobile-workspace-tab-(voice|fx|mod)$/u);
        }
        const download = page.locator('[data-role="video-bounce-download"]');
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const flow = root?.querySelector('[data-role="video-bounce-flow"]');
            return flow?.querySelector('[data-role="video-bounce-download"]') !== null
                || flow?.querySelector('[data-role="video-bounce-error"]') !== null;
        }, null, { timeout: 1_500_000 });
        const renderError = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return root?.querySelector('[data-role="video-bounce-error"]')?.textContent?.trim() ?? null;
        });
        assert.equal(renderError, null, renderError ?? undefined);
        await download.waitFor({ timeout: 30_000 });
        const videoProof = await download.evaluate(async (link) => {
            const blob = await (await fetch(link.href)).blob();
            const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
            const video = document.createElement("video");
            video.muted = true;
            video.preload = "auto";
            video.src = URL.createObjectURL(blob);
            await new Promise((resolve, reject) => {
                video.addEventListener("loadedmetadata", resolve, { once: true });
                video.addEventListener("error", () => reject(video.error ?? new Error("Video metadata failed.")), { once: true });
            });
            const canvas = document.createElement("canvas");
            canvas.width = 135;
            canvas.height = 240;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new Error("Decoded-frame verification needs a canvas.");
            const seek = (time) => new Promise((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error(`Video seek timed out at ${time}.`)), 30_000);
                video.addEventListener("seeked", () => {
                    window.clearTimeout(timeout);
                    resolve();
                }, { once: true });
                video.currentTime = time;
            });
            const sampleTimes = [
                Math.min(0.1, video.duration / 4),
                video.duration * 0.5,
                Math.max(0, video.duration - 0.2),
            ];
            const frameSamples = [];
            let previousPixels = null;
            for (const time of sampleTimes) {
                await seek(time);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                let luminanceSum = 0;
                let luminanceSquareSum = 0;
                let colorfulPixels = 0;
                let centerSum = 0;
                let centerSquareSum = 0;
                let centerCount = 0;
                let deltaSum = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                    const red = pixels[index];
                    const green = pixels[index + 1];
                    const blue = pixels[index + 2];
                    const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
                    luminanceSum += luminance;
                    luminanceSquareSum += luminance * luminance;
                    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 18) colorfulPixels += 1;
                    const pixel = index / 4;
                    const x = pixel % canvas.width;
                    const y = Math.floor(pixel / canvas.width);
                    if (x >= 26 && x < 109 && y >= 4 && y < 180) {
                        centerSum += luminance;
                        centerSquareSum += luminance * luminance;
                        centerCount += 1;
                    }
                    if (previousPixels !== null) {
                        deltaSum += Math.abs(red - previousPixels[index]);
                        deltaSum += Math.abs(green - previousPixels[index + 1]);
                        deltaSum += Math.abs(blue - previousPixels[index + 2]);
                    }
                }
                const pixelCount = pixels.length / 4;
                const mean = luminanceSum / pixelCount;
                const centerMean = centerSum / centerCount;
                const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pixels));
                frameSamples.push({
                    time,
                    sha256: Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join(""),
                    luminanceStdDev: Math.sqrt(Math.max(0, (luminanceSquareSum / pixelCount) - (mean * mean))),
                    centerStdDev: Math.sqrt(Math.max(0, (centerSquareSum / centerCount) - (centerMean * centerMean))),
                    colorfulRatio: colorfulPixels / pixelCount,
                    meanDeltaFromPrevious: previousPixels === null ? null : deltaSum / (pixelCount * 3),
                });
                previousPixels = Uint8ClampedArray.from(pixels);
            }
            URL.revokeObjectURL(video.src);
            return {
                bytes: blob.size,
                type: blob.type,
                download: link.download,
                header: Array.from(header),
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
                frameSamples,
            };
        });
        assert.ok(videoProof.bytes > 20_000, JSON.stringify(videoProof));
        if (requestedContainer === "mp4") {
            assert.equal(videoProof.type, "video/mp4");
            assert.match(videoProof.download, /-speedrun\.mp4$/u);
            assert.equal(String.fromCharCode(...videoProof.header.slice(4)), "ftyp");
        } else {
            assert.equal(videoProof.type, "video/webm");
            assert.match(videoProof.download, /-speedrun\.webm$/u);
            assert.deepEqual(videoProof.header.slice(0, 4), [0x1a, 0x45, 0xdf, 0xa3]);
        }
        assert.equal(videoProof.width, 1080);
        assert.equal(videoProof.height, 1920);
        assert.ok(videoProof.duration > 1, JSON.stringify(videoProof));
        assert.equal(new Set(videoProof.frameSamples.map(({ sha256 }) => sha256)).size, 3);
        for (const [index, sample] of videoProof.frameSamples.entries()) {
            if (index < 2) {
                assert.ok(sample.luminanceStdDev > 15, JSON.stringify(sample));
                assert.ok(sample.centerStdDev > 15, JSON.stringify(sample));
                assert.ok(sample.colorfulRatio > 0.04, JSON.stringify(sample));
            } else {
                // The final sample is the deliberately sparse, dark end card.
                assert.ok(sample.luminanceStdDev > 3, JSON.stringify(sample));
                assert.ok(sample.centerStdDev > 3, JSON.stringify(sample));
            }
            if (sample.meanDeltaFromPrevious !== null) {
                assert.ok(sample.meanDeltaFromPrevious > 1, JSON.stringify(sample));
            }
        }
        assert.deepEqual(failures, []);
        if (outputArtifactPath !== null) {
            await fs.mkdir(path.dirname(outputArtifactPath), { recursive: true });
            const downloadEvent = page.waitForEvent("download");
            await download.click();
            const artifactDownload = await downloadEvent;
            await artifactDownload.saveAs(outputArtifactPath);
            assert.equal((await fs.stat(outputArtifactPath)).size, videoProof.bytes);
        }
        console.log(`# ${JSON.stringify({ videoBounceM4Integration: {
            visualSamples,
            decodedVideo: videoProof,
            outputArtifactPath,
        } })}`);
    } finally {
        await page.close();
    }
});
