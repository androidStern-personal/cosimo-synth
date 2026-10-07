import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { routeHermeticPage } from "./helpers/hermetic_page.mjs";
import { startProductWebServer, webRoot } from "./helpers/product_web_server.mjs";

const outputArtifactPath = process.env.COSIMO_VIDEO_BOUNCE_OUTPUT?.trim() || null;
const requestedContainer = outputArtifactPath === null ? "webm" : "mp4";
const requestedQuality = outputArtifactPath === null ? "very-low" : "high";
let browser;
let server;
let baseUrl;

before(async () => {
    await fs.access(path.join(webRoot, "index.html"));
    server = await startProductWebServer();
    baseUrl = server.baseUrl;
    // Bounce Video records its stage through Region Capture of the page's own
    // tab: that needs full Chromium (the headless shell cannot capture) and a
    // share prompt that accepts itself.
    browser = await chromium.launch({
        headless: true,
        channel: "chromium",
        args: ["--auto-accept-this-tab-capture", "--autoplay-policy=no-user-gesture-required"],
    });
});

after(async () => {
    await browser?.close();
    await server?.close();
});

test("the preset dropdown opens current-patch Bounce Video and lazy-loads its renderer", {
    timeout: 600_000,
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
        await routeHermeticPage(page, baseUrl);
        await page.goto(`${baseUrl}synth.html?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.locator('[data-role="synth-preset-bar"] [data-action="toggle-sound-actions"]').click();
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const video = root?.querySelector('[data-role="sound-actions"] [data-action="bounce-video"]');
            return video instanceof HTMLButtonElement && !video.disabled;
        }, null, { timeout: 30_000 });

        assert.equal(rendererRequests.length, 0, "The renderer loaded before Bounce Video was selected.");

        const menuBefore = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const menu = root?.querySelector('[data-role="sound-actions"]');
            if (!root || !menu) throw new Error("The Sound actions menu is missing.");
            return {
                labels: Array.from(menu.querySelectorAll('[data-action^="bounce-"]'))
                    .map((button) => button.textContent?.trim()),
                visibleBounceStarts: root.querySelectorAll('[data-role="bounce-start"]').length,
            };
        });
        assert.deepEqual(menuBefore.labels, ["Bounce Audio", "Bounce Video"]);
        assert.equal(menuBefore.visibleBounceStarts, 0);

        await page.evaluate(() => {
            const video = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="sound-actions"] [data-action="bounce-video"]');
            if (!(video instanceof HTMLButtonElement)) throw new Error("Bounce video is missing.");
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

        // The stage is captured at its true 594x1056 CSS size, so all of it
        // must be on screen.
        await page.setViewportSize({ width: 960, height: 1100 });
        await page.locator('[data-role="video-bounce-render-video"]').click();
        const visualSamples = [];
        for (const threshold of [0, 30, 60]) {
            await page.waitForFunction((minimumFrame) => {
                const stage = document.querySelector('[data-role="live-stage"]');
                const root = stage?.querySelector('iframe[title="Cosimo live performance"]')?.contentDocument
                    ?.querySelector('[data-role="live-desktop-patch-view"]');
                return Number(stage?.getAttribute("data-frame")) >= minimumFrame
                    && root?.querySelectorAll("canvas").length >= 1
                    && root?.querySelectorAll("svg").length >= 1;
            }, threshold, { timeout: 60_000 });
            visualSamples.push(await page.evaluate(() => {
                const stage = document.querySelector('[data-role="live-stage"]');
                const phone = stage?.querySelector('iframe[title="Cosimo live performance"]');
                const root = phone?.contentDocument?.querySelector('[data-role="live-desktop-patch-view"]');
                if (!(stage instanceof HTMLElement) || !root) {
                    throw new Error("The live stage or its phone is missing.");
                }
                return {
                    frame: Number(stage.dataset.frame),
                    stageWidth: stage.getBoundingClientRect().width,
                    stageHeight: stage.getBoundingClientRect().height,
                    viewport: { width: phone.contentWindow.innerWidth, height: phone.contentWindow.innerHeight },
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
            assert.equal(sample.stageWidth, 594);
            assert.equal(sample.stageHeight, 1056);
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
        }, null, { timeout: 120_000 });
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
            // A MediaRecorder WebM names no duration; seeking past its end
            // makes the element find one.
            if (!Number.isFinite(video.duration)) {
                await new Promise((resolve) => {
                    video.addEventListener("durationchange", resolve, { once: true });
                    video.currentTime = Number.MAX_SAFE_INTEGER;
                });
            }
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
        // One video pixel per stage CSS pixel at this page's pixel ratio of 1.
        assert.equal(videoProof.width, 594);
        assert.equal(videoProof.height, 1056);
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
        console.log(`# ${JSON.stringify({ videoBounceIntegration: {
            visualSamples,
            decodedVideo: videoProof,
            outputArtifactPath,
        } })}`);
    } finally {
        await page.close();
    }
});
