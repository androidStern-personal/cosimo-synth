import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const argumentsByName = new Map(process.argv.slice(2).map((argument) => {
    const [name, ...valueParts] = argument.replace(/^--/, "").split("=");
    return [name, valueParts.join("=")];
}));
const repoRoot = path.resolve(argumentsByName.get("repo") || process.cwd());
const outputRoot = path.resolve(argumentsByName.get("output") || path.join(repoRoot, "build", "t25a-drive-graph-evidence"));
const phase = argumentsByName.get("phase") || "capture";
const helperUrl = pathToFileURL(path.join(repoRoot, "tests", "helpers", "desktop_harness_browser.mjs"));
const { startDesktopHarnessServer, waitForHarnessReady } = await import(`${helperUrl.href}?capture=${Date.now()}`);

function buildScopeFixture(amplitude = 1.62, sampleCount = 256) {
    const inputSamples = [];
    const outputSamples = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const phaseRadians = (index / Math.max(1, sampleCount - 1)) * Math.PI * 6;
        const envelope = 0.82 + (0.18 * Math.cos((index / Math.max(1, sampleCount - 1)) * Math.PI * 2));
        const input = amplitude * envelope * Math.sin(phaseRadians);
        const output = input / Math.pow(1 + Math.pow(Math.abs(input), 8), 1 / 8);

        inputSamples.push(input);
        outputSamples.push(output);
    }

    return {
        sampleRateHz: 44_100,
        dominantChannel: 0,
        inputPeak: Math.max(...inputSamples.map((sample) => Math.abs(sample))),
        outputPeak: Math.max(...outputSamples.map((sample) => Math.abs(sample))),
        removedPeak: Math.max(...inputSamples.map((sample, index) => (
            Math.abs(sample - outputSamples[index])
        ))),
        inputSamples,
        outputSamples,
    };
}

function buildHistoryFixture(amplitude = 1.7, binCount = 160) {
    const inputMins = [];
    const inputMaxs = [];
    const outputMins = [];
    const outputMaxs = [];

    for (let index = 0; index < binCount; index += 1) {
        const normalized = index / Math.max(1, binCount - 1);
        const inputPeak = amplitude * (0.2 + (0.8 * Math.abs(Math.sin(normalized * Math.PI * 5.2))));
        const outputPeak = inputPeak / Math.pow(1 + Math.pow(inputPeak, 8), 1 / 8);

        inputMins.push(-inputPeak);
        inputMaxs.push(inputPeak);
        outputMins.push(-outputPeak);
        outputMaxs.push(outputPeak);
    }

    return {
        sampleRateHz: 44_100,
        horizonMs: 2_000,
        binDurationMs: 12.5,
        binCount,
        validBinCount: binCount,
        inputMins,
        inputMaxs,
        outputMins,
        outputMaxs,
    };
}

const settings = {
    driveDb: 12,
    knee: 0.65,
    mix: 0.5,
    mode: 0,
    wetHighPassHz: 40,
    wetLowPassHz: 18_000,
};
const typeNames = ["symmetric", "asymmetric", "wavefold"];
const captureCases = [
    { name: "phone", viewport: { width: 393, height: 852 }, type: 2 },
    { name: "desktop", viewport: { width: 1_440, height: 900 }, type: 2 },
    { name: "plugin", viewport: { width: 1_120, height: 680 }, type: 2 },
    { name: "plugin", viewport: { width: 1_120, height: 680 }, type: 0 },
    { name: "plugin", viewport: { width: 1_120, height: 680 }, type: 1 },
];
const scopeFixture = buildScopeFixture();
const historyFixture = buildHistoryFixture();
const server = await startDesktopHarnessServer();
const browser = await chromium.launch({ headless: true });
const report = {
    phase,
    repoRoot,
    settings,
    scope: {
        sampleRateHz: scopeFixture.sampleRateHz,
        sampleCount: scopeFixture.inputSamples.length,
        inputPeak: scopeFixture.inputPeak,
        outputPeak: scopeFixture.outputPeak,
        removedPeak: scopeFixture.removedPeak,
    },
    captures: [],
};

await fs.mkdir(outputRoot, { recursive: true });

try {
    for (const captureCase of captureCases) {
        const page = await browser.newPage({
            reducedMotion: "reduce",
            viewport: captureCase.viewport,
        });

        try {
            await page.goto(server.baseUrl, { waitUntil: "commit" });
            await waitForHarnessReady(page);
            if (captureCase.viewport.width <= 639) {
                await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
            }
            await page.locator('[data-role="rack-station-drive"]').click();
            const editor = page.locator('[data-role="rack-editor-drive"]');
            await editor.waitFor({ state: "visible" });
            await page.evaluate(({ nextSettings, nextType, nextScope, nextHistory }) => {
                const harness = window.__COSIMO_DESKTOP_HARNESS__;
                harness.setLaneParamValue("distortionMode", nextSettings.mode);
                harness.setLaneParamValue("distortionDriveDb", nextSettings.driveDb);
                harness.setLaneParamValue("distortionKnee", nextSettings.knee);
                harness.setLaneParamValue("distortionWet", nextSettings.mix);
                harness.setLaneParamValue("distortionWetHPHz", nextSettings.wetHighPassHz);
                harness.setLaneParamValue("distortionWetLPHz", nextSettings.wetLowPassHz);
                harness.setLaneParamValue("distortionType", nextType);
                harness.emitDistortionScope(nextScope);
                harness.emitDistortionHistory(nextHistory);
            }, {
                nextSettings: settings,
                nextType: captureCase.type,
                nextScope: scopeFixture,
                nextHistory: historyFixture,
            });
            await page.waitForFunction(() => {
                const host = document.querySelector("cosimo-desktop-react-view");
                const viewRoot = host?.shadowRoot ?? host;
                const debug = viewRoot?.querySelector('[data-role="distortion-graph-debug"]')?.textContent;
                if (!debug) return false;
                const state = JSON.parse(debug);
                return state.sampleCount > 0 && state.transfer?.occupancySegmentCount > 0;
            });
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            if (await editor.getAttribute("data-effect-enabled") !== "true") {
                const editorHandle = await editor.elementHandle();
                if (!editorHandle) {
                    throw new Error("Drive editor disappeared before it could be enabled.");
                }
                await page.locator('[data-role="rack-editor-power"]').click();
                await page.waitForFunction(
                    (element) => element.getAttribute("data-effect-enabled") === "true",
                    editorHandle,
                );
                await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            }

            const fileName = `${phase}-${captureCase.name}-${typeNames[captureCase.type]}.png`;
            const screenshotPath = path.join(outputRoot, fileName);
            await editor.screenshot({
                animations: "disabled",
                path: screenshotPath,
            });
            const inspection = await editor.evaluate((editorElement) => {
                const graph = editorElement.querySelector('[data-role="distortion-visualizer"]');
                const curve = editorElement.querySelector('[data-role="distortion-transfer-curve"]');
                const debug = editorElement.querySelector('[data-role="distortion-graph-debug"]')?.textContent;
                const graphBounds = graph?.getBoundingClientRect();
                const editorBounds = editorElement.getBoundingClientRect();

                return {
                    effectEnabled: editorElement.getAttribute("data-effect-enabled"),
                    headerText: editorElement.querySelector(".rack-editor-header")?.textContent?.trim() ?? "",
                    powerPressed: editorElement.querySelector('[data-role="rack-editor-power"]')?.getAttribute("aria-pressed") ?? "",
                    editor: {
                        width: editorBounds.width,
                        height: editorBounds.height,
                    },
                    graph: graphBounds ? {
                        width: graphBounds.width,
                        height: graphBounds.height,
                        viewBox: graph?.getAttribute("viewBox"),
                    } : null,
                    curveCount: curve ? 1 : 0,
                    unclippedRegionCount: editorElement.querySelectorAll(
                        '[data-role="distortion-transfer-occupancy"][data-clipping="unclipped"]',
                    ).length,
                    clippedRegionCount: editorElement.querySelectorAll(
                        '[data-role="distortion-transfer-clipped-occupancy"][data-clipping="clipped"]',
                    ).length,
                    debug: debug ? JSON.parse(debug) : null,
                };
            });

            report.captures.push({
                name: captureCase.name,
                type: captureCase.type,
                typeName: typeNames[captureCase.type],
                viewport: captureCase.viewport,
                screenshot: fileName,
                ...inspection,
            });
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
    await server.stop();
}

await fs.writeFile(
    path.join(outputRoot, `${phase}-report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
);

console.log(JSON.stringify(report, null, 2));
