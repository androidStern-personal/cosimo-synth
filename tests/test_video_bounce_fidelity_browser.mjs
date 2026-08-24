import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { chromium } from "playwright";

import { startDesktopHarnessServer } from "./helpers/desktop_harness_browser.mjs";
import { routeHermeticPage } from "./helpers/hermetic_page.mjs";

const artifactRoot = path.resolve("build", "video-bounce-m0-fidelity");
const scenarios = [
    {
        id: "voice-hud",
        workspace: "mobile-workspace-tab-voice",
        landmarks: ["title", "keyboard", "rail", "knob", "filter", "hud"],
    },
    {
        id: "fx-filter",
        workspace: "mobile-workspace-tab-fx",
        landmarks: ["title", "keyboard", "rail", "filter"],
    },
    {
        // The rail dodges off-canvas during the source drag, so it has no
        // rail landmark; the ghost is this scenario's overlay evidence.
        id: "mod-route-ghost",
        workspace: "mobile-workspace-tab-mod",
        landmarks: ["title", "keyboard", "image", "ghost"],
    },
];

const minimumRegionStandardDeviation = {
    title: 20,
    keyboard: 60,
    rail: 12,
    knob: 20,
    filter: 3,
    image: 10,
    hud: 15,
    ghost: 10,
};

// Bounds sit ~1.5x above the measured fallback-rasterizer difference (it
// re-paints text/gradients/shadows rather than copying compositor pixels), so
// they admit that enumerated class while a missing or displaced element fails.
const maximumRegionMeanDifference = {
    title: 30,
    keyboard: 20,
    rail: 18,
    knob: 18,
    filter: 18,
    image: 12,
    hud: 18,
    // The ghost's crisp ring shadow re-paints as a soft halo (the shadow
    // class); presence is guarded by its stddev, range, and geometry checks.
    ghost: 45,
};

// A strong per-pixel difference is a shape/position change, not anti-alias
// noise. This catches a re-painted-but-wrong element (e.g. a flat filter
// curve) that a mean over a mostly-static region would absorb.
const maximumRegionStrongRatio = {
    title: 0.1,
    keyboard: 0.15,
    rail: 0.12,
    knob: 0.12,
    filter: 0.12,
    image: 0.1,
    hud: 0.12,
    ghost: 0.4,
};

let browser;
let server;

async function openProbe(mode) {
    const page = await browser.newPage({
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 1,
    });
    const diagnostics = [];
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.stack ?? error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(`console: ${message.text()}`);
    });
    await page.addInitScript(() => {
        sessionStorage.clear();
        localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
    });
    await routeHermeticPage(page, server.baseUrl);
    await page.goto(`${server.baseUrl}?fidelityKeyboard=${mode}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (
        document.body.dataset.bootStage === "render-called"
        && typeof window.__COSIMO_VIDEO_BOUNCE_FIDELITY__?.renderStill === "function"
        && window.__COSIMO_DESKTOP_HARNESS__?.getRenderedState().hasCanvas === true
    ), null, { timeout: 90_000 });
    return { page, diagnostics };
}

function pngDataUrl(bytes) {
    return `data:image/png;base64,${bytes.toString("base64")}`;
}

function pngBytes(dataUrl) {
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function compareImages(page, liveDataUrl, captureDataUrl, landmarks) {
    return page.evaluate(async ({ liveUrl, capturedUrl, regions }) => {
        const load = (src) => new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener("load", () => resolve(image), { once: true });
            image.addEventListener("error", reject, { once: true });
            image.src = src;
        });
        const [live, captured] = await Promise.all([load(liveUrl), load(capturedUrl)]);
        const width = 393;
        const height = 852;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("M0 fidelity comparison needs a 2D canvas.");
        context.drawImage(live, 0, 0);
        const livePixels = context.getImageData(0, 0, width, height).data;
        context.clearRect(0, 0, width, height);
        context.drawImage(captured, 0, 0);
        const capturedPixels = context.getImageData(0, 0, width, height).data;

        const metric = (rect = { left: 0, top: 0, right: width, bottom: height }) => {
            const left = Math.max(0, Math.floor(rect.left));
            const top = Math.max(0, Math.floor(rect.top));
            const right = Math.min(width, Math.ceil(rect.right));
            const bottom = Math.min(height, Math.ceil(rect.bottom));
            let differenceTotal = 0;
            let changed = 0;
            let stronglyChanged = 0;
            let luminanceTotal = 0;
            let luminanceSquares = 0;
            let luminanceMin = 255;
            let luminanceMax = 0;
            let pixelCount = 0;
            for (let y = top; y < bottom; y += 1) {
                for (let x = left; x < right; x += 1) {
                    const offset = ((y * width) + x) * 4;
                    const difference = Math.max(
                        Math.abs(livePixels[offset] - capturedPixels[offset]),
                        Math.abs(livePixels[offset + 1] - capturedPixels[offset + 1]),
                        Math.abs(livePixels[offset + 2] - capturedPixels[offset + 2]),
                    );
                    const luminance = (0.2126 * capturedPixels[offset])
                        + (0.7152 * capturedPixels[offset + 1])
                        + (0.0722 * capturedPixels[offset + 2]);
                    differenceTotal += difference;
                    changed += difference > 8 ? 1 : 0;
                    stronglyChanged += difference > 32 ? 1 : 0;
                    luminanceTotal += luminance;
                    luminanceSquares += luminance * luminance;
                    luminanceMin = Math.min(luminanceMin, luminance);
                    luminanceMax = Math.max(luminanceMax, luminance);
                    pixelCount += 1;
                }
            }
            const meanLuminance = luminanceTotal / pixelCount;
            return {
                meanDifference: differenceTotal / pixelCount,
                changedRatio: changed / pixelCount,
                strongDifferenceRatio: stronglyChanged / pixelCount,
                capturedLuminanceStdDev: Math.sqrt(Math.max(
                    0,
                    (luminanceSquares / pixelCount) - (meanLuminance ** 2),
                )),
                capturedLuminanceRange: luminanceMax - luminanceMin,
            };
        };

        const diffCanvas = document.createElement("canvas");
        diffCanvas.width = width;
        diffCanvas.height = height;
        const diffContext = diffCanvas.getContext("2d");
        if (!diffContext) throw new Error("M0 fidelity diff needs a 2D canvas.");
        const diff = diffContext.createImageData(width, height);
        for (let offset = 0; offset < diff.data.length; offset += 4) {
            const difference = Math.max(
                Math.abs(livePixels[offset] - capturedPixels[offset]),
                Math.abs(livePixels[offset + 1] - capturedPixels[offset + 1]),
                Math.abs(livePixels[offset + 2] - capturedPixels[offset + 2]),
            );
            diff.data[offset] = difference;
            diff.data[offset + 1] = difference > 8 ? Math.min(255, difference * 2) : difference;
            diff.data[offset + 2] = difference > 32 ? 255 : difference;
            diff.data[offset + 3] = 255;
        }
        diffContext.putImageData(diff, 0, 0);

        return {
            global: metric(),
            regions: Object.fromEntries(Object.entries(regions).map(([name, rect]) => [name, metric(rect)])),
            diffDataUrl: diffCanvas.toDataURL("image/png"),
        };
    }, { liveUrl: liveDataUrl, capturedUrl: captureDataUrl, regions: landmarks });
}

before(async () => {
    await fs.mkdir(artifactRoot, { recursive: true });
    server = await startDesktopHarnessServer();
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.stop();
});

test("M0 real DesktopPatchView stills retain every representative live element", { timeout: 180_000 }, async () => {
    const report = [];

    for (const scenario of scenarios) {
        const liveProbe = await openProbe("native");
        const liveInspection = await liveProbe.page.evaluate((scenarioID) => (
            window.__COSIMO_VIDEO_BOUNCE_FIDELITY__.prepareLiveScenario(scenarioID)
        ), scenario.id);
        const livePng = await liveProbe.page.locator("#root").screenshot({ type: "png", animations: "allow" });
        assert.deepEqual(liveProbe.diagnostics, [], `${scenario.id} live diagnostics`);
        await liveProbe.page.close();

        const captureProbe = await openProbe("capture");
        const captured = await captureProbe.page.evaluate((scenarioID) => (
            window.__COSIMO_VIDEO_BOUNCE_FIDELITY__.renderStill(scenarioID)
        ), scenario.id);
        const comparison = await compareImages(
            captureProbe.page,
            pngDataUrl(livePng),
            captured.dataUrl,
            captured.inspection.landmarks,
        );
        assert.deepEqual(captureProbe.diagnostics, [], `${scenario.id} capture diagnostics`);
        await captureProbe.page.close();

        // Written before any pixel assertion, so a failed run leaves the
        // live/captured/diff evidence a human needs to judge it.
        await Promise.all([
            fs.writeFile(path.join(artifactRoot, `${scenario.id}-live.png`), livePng),
            fs.writeFile(path.join(artifactRoot, `${scenario.id}-captured.png`), pngBytes(captured.dataUrl)),
            fs.writeFile(path.join(artifactRoot, `${scenario.id}-diff.png`), pngBytes(comparison.diffDataUrl)),
        ]);

        assert.equal(liveInspection.workspace, scenario.workspace);
        assert.equal(captured.inspection.workspace, scenario.workspace);
        assert.equal(liveInspection.keyboardNoteCount, 18);
        assert.equal(captured.inspection.keyboardNoteCount, 18);
        assert.ok(liveInspection.svgCount > 0 && captured.inspection.svgCount > 0);
        if (scenario.id === "mod-route-ghost") {
            assert.ok(liveInspection.imageCount >= 1);
            assert.ok(captured.inspection.imageCount >= 1);
        }

        for (const landmark of scenario.landmarks) {
            const liveRect = liveInspection.landmarks[landmark];
            const captureRect = captured.inspection.landmarks[landmark];
            assert.ok(liveRect, `${scenario.id} live ${landmark} is missing`);
            assert.ok(captureRect, `${scenario.id} captured ${landmark} is missing`);
            assert.ok(captureRect.width > 0 && captureRect.height > 0, `${scenario.id} captured ${landmark} is blank-sized`);
            assert.ok(
                Math.abs(liveRect.width - captureRect.width) <= 1
                    && Math.abs(liveRect.height - captureRect.height) <= 1,
                `${scenario.id} ${landmark} geometry drifted: ${JSON.stringify({ liveRect, captureRect })}`,
            );
            assert.ok(
                Math.abs(liveRect.x - captureRect.x) <= 2
                    && Math.abs(liveRect.y - captureRect.y) <= 2,
                `${scenario.id} ${landmark} position drifted: ${JSON.stringify({ liveRect, captureRect })}`,
            );
            const pixels = comparison.regions[landmark];
            assert.ok(
                pixels.capturedLuminanceStdDev >= minimumRegionStandardDeviation[landmark],
                `${scenario.id} captured ${landmark} is visually blank: ${JSON.stringify(pixels)}`,
            );
            assert.ok(
                pixels.capturedLuminanceRange >= 40,
                `${scenario.id} captured ${landmark} has no visible detail: ${JSON.stringify(pixels)}`,
            );
            assert.ok(
                pixels.meanDifference <= maximumRegionMeanDifference[landmark],
                `${scenario.id} captured ${landmark} differs materially from live: ${JSON.stringify(pixels)}`,
            );
            assert.ok(
                pixels.strongDifferenceRatio <= maximumRegionStrongRatio[landmark],
                `${scenario.id} captured ${landmark} shape drifted from live: ${JSON.stringify(pixels)}`,
            );
        }

        assert.ok(comparison.global.meanDifference <= 15, JSON.stringify(comparison.global));
        assert.ok(comparison.global.strongDifferenceRatio <= 0.12, JSON.stringify(comparison.global));

        report.push({
            scenario: scenario.id,
            liveInspection,
            captureInspection: captured.inspection,
            captureBytes: captured.bytes,
            global: comparison.global,
            regions: comparison.regions,
        });
    }

    await fs.writeFile(
        path.join(artifactRoot, "report.json"),
        `${JSON.stringify({ chromium: browser.version(), viewport: "393x852", report }, null, 2)}\n`,
    );
    console.log(`# ${JSON.stringify({ videoBounceM0Fidelity: report.map(({ scenario, global }) => ({ scenario, global })) })}`);
});
