import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium, devices, webkit } from "playwright";

import { makeMappingId } from "../patch_gui/cosimo-ids.js";
import {
    MODULATION_STATE_KEY,
    buildModulationRuntimeEvents,
    composeModulationAmount,
    createDefaultModulationState,
    deserializeModulationState,
    serializeModulationState,
} from "../patch_gui/modulation.js";
import { buildModulationBenchmarkProfiles } from "../scripts/generate_modulation_benchmark_profiles.mjs";
import {
    compileModulationRuntimeProgram,
    getModulationRuntimeCell,
    MODULATION_ARTICULATION_ROUTE_CELL_COUNT,
} from "../patch_gui/modulation-runtime-program.js";
import { ARTICULATION_ROUTE_AMOUNT_INHERIT } from "../patch_gui/articulations.js";
import { MODULATION_TARGET_OPTIONS } from "../patch_gui/modulation.js";
import { allTargetDescriptors } from "../patch_gui/target-descriptor.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browserEngine = process.env.COSIMO_WEB_BROWSER ?? "chromium";
const remoteBaseUrl = process.env.COSIMO_WEB_BASE_URL;
const webRoot = process.env.COSIMO_WEB_ROOT
    ? path.resolve(repoRoot, process.env.COSIMO_WEB_ROOT)
    : path.join(repoRoot, "build", "web");
let browser;
let server;
let baseUrl;
const chromiumLaunchOptions = {
    channel: "chrome",
    // Chromium's headless/null audio sink runs AudioWorklet callbacks ahead of
    // wall clock. Performance qualification needs the real CoreAudio output.
    headless: false,
    ignoreDefaultArgs: ["--mute-audio"],
};

const stressSources = [
    ["mseg", 1], ["mseg", 2], ["mseg", 3],
    ["env", 1], ["env", 2], ["env", 3],
    ["velocity", null], ["pressure", null], ["slide", null],
    ["macro", 1], ["macro", 2], ["macro", 3], ["macro", 4],
];
const targetIdByModulationKind = new Map(allTargetDescriptors().flatMap((descriptor) => (
    descriptor.modulationTargetKind === null
        ? []
        : [[descriptor.modulationTargetKind, descriptor.targetId]]
)));

function productSourceId(sourceKind, sourceSlot) {
    if (sourceKind === "env") return `envelope-${sourceSlot}`;
    if (sourceKind === "mseg" || sourceKind === "macro") return `${sourceKind}-${sourceSlot}`;
    return sourceKind;
}

function createStressRoutes() {
    const routes = [];
    for (const [sourceKind, sourceSlot] of stressSources) {
        for (const { value: targetKind } of MODULATION_TARGET_OPTIONS) {
            const targetId = targetIdByModulationKind.get(targetKind);
            assert.ok(targetId, `Missing product target for ${targetKind}`);
            routes.push({
                id: makeMappingId(targetId, productSourceId(sourceKind, sourceSlot)),
                enabled: true,
                sourceKind,
                sourceSlot,
                polarity: routes.length % 2 === 0 ? "unipolar" : "bipolar",
                targetKind,
                amount: 0.01 + ((routes.length % 7) * 0.001),
                reducer: routes.length % 3 === 0 ? "mean" : "max",
            });
        }
    }
    return routes;
}

function requireStressRoute(sourceKind, sourceSlot, targetKind) {
    const route = allStressRoutes.find((candidate) => (
        candidate.sourceKind === sourceKind
        && candidate.sourceSlot === sourceSlot
        && candidate.targetKind === targetKind
    ));
    assert.ok(route, `Missing stress route ${sourceKind}-${sourceSlot ?? "fixed"} -> ${targetKind}`);
    return route;
}

const allStressRoutes = createStressRoutes();
const routesByRuntimePath = Map.groupBy(allStressRoutes, (route) => getModulationRuntimeCell(route).path);
const mixedHundredRoutes = [
    ...routesByRuntimePath.get("voice").slice(0, 30),
    ...routesByRuntimePath.get("macroVoice").slice(0, 20),
    ...routesByRuntimePath.get("voiceRack").slice(0, 30),
    ...routesByRuntimePath.get("macroRack").slice(0, 20),
];
function createPopulatedTopologyVariant(routes) {
    return routes.map((route, index) => index === 0 ? {
        ...route,
        polarity: route.polarity === "unipolar" ? "bipolar" : "unipolar",
    } : route);
}
const hundredVoiceRouteProgram = compileModulationRuntimeProgram(
    routesByRuntimePath.get("voice").slice(0, 100),
);
const hundredVoiceTailSentinelProgram = compileModulationRuntimeProgram(
    routesByRuntimePath.get("voice").slice(0, 100).map((route, index) => ({
        ...route,
        polarity: "unipolar",
        amount: index === 99 ? 10 : 0,
    })),
);
const inactiveHundredVoiceTailSentinelProgram = {
    ...hundredVoiceTailSentinelProgram,
    voiceRouteCount: 0,
};
const macroVoiceFilterQProgram = compileModulationRuntimeProgram([{
    ...requireStressRoute("macro", 1, "filterQ"),
    enabled: true,
    polarity: "unipolar",
    amount: 10,
}]);
const inactiveMacroVoiceFilterQProgram = {
    ...macroVoiceFilterQProgram,
    macroVoiceRouteCount: 0,
};
const hundredVoiceRackRouteProgram = compileModulationRuntimeProgram(
    routesByRuntimePath.get("voiceRack").slice(0, 100),
);
const mixedHundredRouteProgram = compileModulationRuntimeProgram(mixedHundredRoutes);
const mixedHundredRouteProgramVariant = compileModulationRuntimeProgram(
    createPopulatedTopologyVariant(mixedHundredRoutes),
);
const allMappingProgram = compileModulationRuntimeProgram(allStressRoutes);
const allMappingProgramVariant = compileModulationRuntimeProgram(
    createPopulatedTopologyVariant(allStressRoutes),
);
const disabledAllMappingProgram = compileModulationRuntimeProgram(
    allStressRoutes.map((route) => ({ ...route, enabled: false })),
);
const mixedHundredRouteIds = new Set(mixedHundredRoutes.map((route) => route.id));
const fullDomainHundredActiveRoutes = [
    ...mixedHundredRoutes,
    ...allStressRoutes
        .filter((route) => !mixedHundredRouteIds.has(route.id))
        .map((route) => ({ ...route, enabled: false })),
];
const fullDomainHundredActiveStoredState = serializeModulationState({
    ...createDefaultModulationState(),
    routes: fullDomainHundredActiveRoutes,
});
const emptyModulationProgram = compileModulationRuntimeProgram([]);
const matrixBenchmarkProfiles = new Map(
    buildModulationBenchmarkProfiles().map((profile) => [profile.name, profile]),
);
function matrixBenchmarkState(name) {
    const profile = matrixBenchmarkProfiles.get(name);
    assert.ok(profile, `Missing shared matrix benchmark profile ${name}`);
    return deserializeModulationState(profile.stateJSON);
}
const matrixEmptyState = matrixBenchmarkState("empty");
const matrixVoiceHundredProgram = compileModulationRuntimeProgram(matrixBenchmarkState("voice-100").routes);
const matrixVoiceRackHundredProgram = compileModulationRuntimeProgram(matrixBenchmarkState("voice-rack-100").routes);
const matrixMixedHundredProgram = compileModulationRuntimeProgram(matrixBenchmarkState("mixed-100").routes);
const matrixCombinedTwoHundredProgram = compileModulationRuntimeProgram(matrixBenchmarkState("combined-200").routes);
const matrixStoredFullDomainHundredProgram = compileModulationRuntimeProgram(
    matrixBenchmarkState("stored-884-active-100").routes,
);
const matrixActiveFullDomainProgram = compileModulationRuntimeProgram(matrixBenchmarkState("active-884").routes);
const macroRackDistortionWetProgram = compileModulationRuntimeProgram([{
    ...requireStressRoute("macro", 1, "rack.distortionWet"),
    enabled: true,
    polarity: "unipolar",
    amount: 1,
}]);
const inactiveMacroRackDistortionWetProgram = {
    ...macroRackDistortionWetProgram,
    macroRackRouteCount: 0,
};
function stressCount(environmentKey, defaultValue) {
    const configuredValue = Number(process.env[environmentKey]);
    return Number.isFinite(configuredValue) && configuredValue > 0
        ? Math.max(defaultValue, Math.trunc(configuredValue))
        : defaultValue;
}

test("stress epoch overrides can extend but never shorten committed coverage", () => {
    const environmentKey = "COSIMO_TEST_STRESS_COUNT";
    const originalValue = process.env[environmentKey];

    try {
        process.env[environmentKey] = "25";
        assert.equal(stressCount(environmentKey, 1_536), 1_536);

        process.env[environmentKey] = "2048";
        assert.equal(stressCount(environmentKey, 1_536), 2_048);

        process.env[environmentKey] = "invalid";
        assert.equal(stressCount(environmentKey, 1_536), 1_536);
    } finally {
        if (originalValue === undefined) delete process.env[environmentKey];
        else process.env[environmentKey] = originalValue;
    }
});

const modulationStressBlockCount = stressCount("COSIMO_MOD_STRESS_BLOCKS", 1_536);
const sustainedStressBlockCount = stressCount("COSIMO_SUSTAINED_STRESS_BLOCKS", 4_096);
const modulationAmountStressEventCount = stressCount("COSIMO_MOD_AMOUNT_STRESS_EVENTS", 625);
const modulationAmountStressIntervalMs = 1_000 / 60;
const modulationUiAverageDispatchBudgetMs = 4;
const modulationUiMaximumDispatchBudgetMs = 8;
const modulationUiAverageAcknowledgementBudgetMs = 35;
const modulationUiMaximumAcknowledgementBudgetMs = 60;
const modulationTopologyStressEventCount = stressCount("COSIMO_MOD_TOPOLOGY_STRESS_EVENTS", 250);
const modulationTopologyStressIntervalMs = 40;

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

async function resetMeasuredAudioMetrics(page) {
    const epoch = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.resetAudioMetrics());
    await page.waitForFunction((expectedEpoch) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletAcknowledgedPerfEpoch === expectedEpoch
    ), epoch, { timeout: 5_000 });
}

async function sendAcknowledgedRuntimeEvent(page, laneKind, endpointID, value) {
    return page.evaluate(async ({ lane, endpoint, payload }) => (
        globalThis.__COSIMO_WEB_POC__.sendAcknowledgedRuntimeEvent(lane, endpoint, payload)
    ), {
        lane: laneKind,
        endpoint: endpointID,
        payload: value,
    });
}

async function sendAcceptedModulationEvent(page, endpointID, value) {
    const outcome = await sendAcknowledgedRuntimeEvent(page, "modulation", endpointID, value);
    assert.equal(outcome.accepted, true, JSON.stringify(outcome));
    return outcome;
}

async function sendAcceptedArticulationEvent(page, endpointID, value) {
    const outcome = await sendAcknowledgedRuntimeEvent(page, "articulation", endpointID, value);
    assert.equal(outcome.accepted, true, JSON.stringify(outcome));
    return outcome;
}

async function readMeasuredAudioMetrics(page) {
    return page.evaluate(() => {
        const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
        return {
            quantizedAverageLoad: snapshot.audioWorkletQuantizedAverageLoad,
            quantizedMaxLoad: snapshot.audioWorkletQuantizedMaxLoad,
            quantizedOverBudgetBlocks: snapshot.audioWorkletQuantizedOverBudgetBlocks,
            clockSource: snapshot.audioWorkletClockSource,
            processMultiplier: snapshot.audioWorkletProcessMultiplier,
            callbackGapBlocks: snapshot.audioWorkletCallbackGapBlocks,
            maxCallbackGapLoad: snapshot.audioWorkletMaxCallbackGapLoad,
            frameDiscontinuityBlocks: snapshot.audioWorkletFrameDiscontinuityBlocks,
            markedEventCount: snapshot.audioWorkletMarkedEventCount,
            eventAdjacentBlockCount: snapshot.audioWorkletEventAdjacentBlockCount,
            eventAdjacentAverageGapLoad: snapshot.audioWorkletEventAdjacentAverageGapLoad,
            eventAdjacentLateBlocks: snapshot.audioWorkletEventAdjacentLateBlocks,
            eventAdjacentLateRate: snapshot.audioWorkletEventAdjacentLateRate,
            eventAdjacentMaxGapLoad: snapshot.audioWorkletEventAdjacentMaxGapLoad,
            eventAdjacentCoalescedEvents: snapshot.audioWorkletEventAdjacentCoalescedEvents,
            blockCount: snapshot.audioWorkletBlockCount,
            sampleRateHz: snapshot.audioWorkletSampleRateHz,
            renderQuantumFrames: snapshot.audioWorkletRenderQuantumFrames,
            rejectedProgramCount: snapshot.modulationRejectedRouteCount,
            audioRms: snapshot.audioRms,
            audioPollCount: snapshot.audioPollCount,
            silentHeldNotePollCount: snapshot.silentHeldNotePollCount,
        };
    });
}

async function measureModulationProgramLoad(page, program, blockCount = 768) {
    await sendAcceptedModulationEvent(page, "modulationProgram", program);
    await page.waitForTimeout(150);
    await resetMeasuredAudioMetrics(page);
    const startedAt = performance.now();
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, {
        timeout: Math.max(15_000, Math.ceil((blockCount * 128 / 48_000) * 3_000)),
    });
    const measurementWallMs = performance.now() - startedAt;
    const metrics = await readMeasuredAudioMetrics(page);
    const expectedAudioMs = (metrics.blockCount * metrics.renderQuantumFrames * 1_000) / metrics.sampleRateHz;
    return { ...metrics, expectedAudioMs, measurementWallMs };
}

async function setPerfProcessMultiplier(page, multiplier) {
    await page.evaluate((nextMultiplier) => {
        globalThis.__COSIMO_WEB_POC__.setPerfProcessMultiplier(nextMultiplier);
    }, multiplier);
    await page.waitForFunction((expectedMultiplier) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletProcessMultiplier === expectedMultiplier
    ), multiplier, { timeout: 5_000 });
}

async function waitForRealtimeAudioPacing(
    page,
    program,
    {
        blockCount = 512,
        maximumWindows = 12,
        minimumWallRatio = 0.9,
        maximumWallRatio = 1.1,
    } = {},
) {
    await sendAcceptedModulationEvent(page, "modulationProgram", program);
    await page.waitForTimeout(150);

    const windows = [];
    for (let windowIndex = 0; windowIndex < maximumWindows; windowIndex += 1) {
        await resetMeasuredAudioMetrics(page);
        const startedAt = performance.now();
        await page.waitForFunction((minimumBlocks) => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
        ), blockCount, { timeout: 15_000 });
        const measurementWallMs = performance.now() - startedAt;
        const metrics = await readMeasuredAudioMetrics(page);
        const expectedAudioMs = (
            metrics.blockCount * metrics.renderQuantumFrames * 1_000
        ) / metrics.sampleRateHz;
        const wallRatio = measurementWallMs / expectedAudioMs;
        windows.push({ ...metrics, expectedAudioMs, measurementWallMs, wallRatio });
        if (wallRatio >= minimumWallRatio && wallRatio <= maximumWallRatio) {
            return windows;
        }
    }

    assert.fail(JSON.stringify({ maximumWindows, minimumWallRatio, maximumWallRatio, windows }));
}

function assertRuntimeMeasurementIntegrity(measurement) {
    assert.equal(measurement.sampleRateHz, 48_000, JSON.stringify(measurement));
    assert.equal(measurement.renderQuantumFrames, 128, JSON.stringify(measurement));
    assert.equal(measurement.rejectedProgramCount, 0, JSON.stringify(measurement));
    assert.equal(measurement.silentHeldNotePollCount, 0, JSON.stringify(measurement));
}

function assertRealtimeContinuity(measurement) {
    assertRuntimeMeasurementIntegrity(measurement);
    assert.ok(
        measurement.frameDiscontinuityBlocks / measurement.blockCount < 0.002,
        JSON.stringify(measurement),
    );
}

function assertSustainedRealtimeThroughput(measurement, maximumWallRatio = 1.2) {
    assert.ok(measurement.expectedAudioMs > 0, JSON.stringify(measurement));
    assert.ok(
        measurement.measurementWallMs <= measurement.expectedAudioMs * maximumWallRatio,
        JSON.stringify({ measurement, maximumWallRatio }),
    );
}

function assertRealtimePacedMeasurement(
    measurement,
    minimumWallRatio = 0.9,
    maximumWallRatio = 1.1,
) {
    assert.ok(measurement.expectedAudioMs > 0, JSON.stringify(measurement));
    const wallRatio = measurement.measurementWallMs / measurement.expectedAudioMs;
    assert.ok(
        wallRatio >= minimumWallRatio && wallRatio <= maximumWallRatio,
        JSON.stringify({ measurement, minimumWallRatio, maximumWallRatio, wallRatio }),
    );
}

function assertShippingRenderBudget(measurement) {
    assert.ok(Number.isFinite(measurement.quantizedAverageLoad), JSON.stringify(measurement));
    assert.ok(measurement.quantizedAverageLoad <= 0.75, JSON.stringify(measurement));
    if (measurement.clockSource === "performance.now") {
        assert.equal(measurement.quantizedOverBudgetBlocks, 0, JSON.stringify(measurement));
        return;
    }

    assert.equal(measurement.clockSource, "Date.now", JSON.stringify(measurement));
    assert.ok(measurement.blockCount > 0, JSON.stringify(measurement));
    assert.ok(measurement.quantizedMaxLoad <= 1.125, JSON.stringify(measurement));
    assert.ok(
        measurement.quantizedOverBudgetBlocks / measurement.blockCount < 0.002,
        JSON.stringify(measurement),
    );
}

function assertShippingSustainedBudget(measurement) {
    assertShippingRenderBudget(measurement);
    assertSustainedRealtimeThroughput(measurement);
}

function assertFullDomainTortureBudget(measurement) {
    assert.ok(Number.isFinite(measurement.quantizedAverageLoad), JSON.stringify(measurement));
    assert.ok(measurement.quantizedAverageLoad <= 0.9, JSON.stringify(measurement));
    assert.ok(measurement.blockCount > 0, JSON.stringify(measurement));
    assert.ok(
        measurement.quantizedOverBudgetBlocks / measurement.blockCount < 0.02,
        JSON.stringify(measurement),
    );
}

function assertNoMeaningfulCallbackGapIncrease(measurement, baseline, toleranceRate = 0.01) {
    const measurementGapRate = measurement.callbackGapBlocks / measurement.blockCount;
    const baselineGapRate = baseline.callbackGapBlocks / baseline.blockCount;
    assert.ok(
        measurementGapRate <= baselineGapRate + toleranceRate,
        JSON.stringify({ baseline, measurement, baselineGapRate, measurementGapRate, toleranceRate }),
    );
}

function assertBoundedRelativeRuntimeCost(measurement, baseline, maximumRatio) {
    assert.ok(baseline.measurementWallMs > 0, JSON.stringify(baseline));
    assert.ok(
        measurement.measurementWallMs <= baseline.measurementWallMs * maximumRatio,
        JSON.stringify({ baseline, measurement, maximumRatio }),
    );
}

function assertMatrixAddedLoad(measurement, baseline, maximumAddedLoad) {
    const addedLoad = measurement.quantizedAverageLoad - baseline.quantizedAverageLoad;
    assert.ok(
        addedLoad <= maximumAddedLoad,
        JSON.stringify({ baseline, measurement, addedLoad, maximumAddedLoad }),
    );
}

function combineAdjacentMatrixBaselines(before, after) {
    return {
        ...before,
        quantizedAverageLoad: (before.quantizedAverageLoad + after.quantizedAverageLoad) * 0.5,
        callbackGapBlocks: before.callbackGapBlocks + after.callbackGapBlocks,
        blockCount: before.blockCount + after.blockCount,
        measurementWallMs: before.measurementWallMs + after.measurementWallMs,
    };
}

async function measureMatrixProgramWithAdjacentEmpty(
    page,
    program,
    blockCount = Math.max(2_048, Math.ceil(sustainedStressBlockCount * 0.5)),
) {
    const before = await measureModulationProgramLoad(page, emptyModulationProgram, blockCount);
    const loaded = await measureModulationProgramLoad(page, program, blockCount);
    const after = await measureModulationProgramLoad(page, emptyModulationProgram, blockCount);
    return {
        before,
        loaded,
        after,
        baseline: combineAdjacentMatrixBaselines(before, after),
    };
}

async function installNeutralMatrixSourceContract(page) {
    for (const event of buildModulationRuntimeEvents(matrixEmptyState)) {
        await sendAcceptedModulationEvent(page, event.endpointID, event.value);
    }
    await page.evaluate(() => {
        const api = globalThis.__COSIMO_WEB_POC__;
        for (let macroIndex = 1; macroIndex <= 4; macroIndex += 1) {
            api.setParameter(`macro${macroIndex}`, 0.75);
        }
    });
}

async function applyNeutralMatrixExpressionContract(page) {
    await page.evaluate(() => {
        const api = globalThis.__COSIMO_WEB_POC__;
        api.setMpePressureForTest(100 / 127, 1);
        api.setMpeSlideForTest(100 / 127, 1);
    });
}

async function measureModulationTopologyChurn(
    page,
    programs,
    {
        blockCount = modulationStressBlockCount,
        swapCount = modulationTopologyStressEventCount,
    } = {},
) {
    await resetMeasuredAudioMetrics(page);
    await page.waitForTimeout(50);
    const cadence = await page.evaluate(async ({ nextPrograms, swaps }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        const beganAt = performance.now();
        let acknowledgementLatencyTotalMs = 0;
        let acknowledgementLatencyMaxMs = 0;
        for (let swapIndex = 0; swapIndex < swaps; swapIndex += 1) {
            const startedAt = performance.now();
            const outcome = await api.sendAcknowledgedRuntimeEvent(
                "modulation",
                "modulationProgram",
                nextPrograms[swapIndex % nextPrograms.length],
            );
            if (!outcome.accepted) {
                throw new Error(`Topology install was rejected: ${JSON.stringify(outcome)}`);
            }
            api.getSnapshot();
            const acknowledgementLatencyMs = performance.now() - startedAt;
            acknowledgementLatencyTotalMs += acknowledgementLatencyMs;
            acknowledgementLatencyMaxMs = Math.max(
                acknowledgementLatencyMaxMs,
                acknowledgementLatencyMs,
            );
        }
        const elapsedMs = performance.now() - beganAt;
        return {
            acceptedEventCount: swaps,
            acceptedEventElapsedMs: elapsedMs,
            acceptedEventRateHz: (swaps * 1_000) / elapsedMs,
            acceptedEventIntervalMs: elapsedMs / swaps,
            acknowledgementLatencyAverageMs: acknowledgementLatencyTotalMs / swaps,
            acknowledgementLatencyMaxMs,
        };
    }, { nextPrograms: programs, swaps: swapCount });
    await page.waitForFunction((expectedEvents) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletMarkedEventCount >= expectedEvents
    ), swapCount, { timeout: 5_000 });
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, { timeout: 20_000 });
    return {
        ...await readMeasuredAudioMetrics(page),
        ...cadence,
    };
}

async function measureModulationAmountChurn(
    page,
    program,
    {
        blockCount = modulationStressBlockCount,
        updateCount = modulationAmountStressEventCount,
    } = {},
) {
    await sendAcceptedModulationEvent(page, "modulationProgram", program);
    await page.waitForTimeout(150);
    await resetMeasuredAudioMetrics(page);
    await page.waitForTimeout(50);
    const activeCells = [
        ...program.voiceRouteCells.slice(0, program.voiceRouteCount).map((cellIndex) => ({ pathKind: 1, cellIndex })),
        ...program.macroVoiceRouteCells.slice(0, program.macroVoiceRouteCount).map((cellIndex) => ({ pathKind: 2, cellIndex })),
        ...program.voiceRackRouteCells.slice(0, program.voiceRackRouteCount).map((cellIndex) => ({ pathKind: 3, cellIndex })),
        ...program.macroRackRouteCells.slice(0, program.macroRackRouteCount).map((cellIndex) => ({ pathKind: 4, cellIndex })),
    ];
    const cadence = await page.evaluate(async ({ cells, updates }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        const beganAt = performance.now();
        let acknowledgementLatencyTotalMs = 0;
        let acknowledgementLatencyMaxMs = 0;
        for (let updateIndex = 0; updateIndex < updates; updateIndex += 1) {
            const startedAt = performance.now();
            const cell = cells[updateIndex % cells.length];
            const outcome = await api.sendAcknowledgedRuntimeEvent("modulation", "modulationAmount", {
                ...cell,
                amount: updateIndex % 2 === 0 ? 0.02 : 0.03,
            });
            if (!outcome.accepted) {
                throw new Error(`Amount install was rejected: ${JSON.stringify(outcome)}`);
            }
            api.getSnapshot();
            const acknowledgementLatencyMs = performance.now() - startedAt;
            acknowledgementLatencyTotalMs += acknowledgementLatencyMs;
            acknowledgementLatencyMaxMs = Math.max(
                acknowledgementLatencyMaxMs,
                acknowledgementLatencyMs,
            );
        }
        const elapsedMs = performance.now() - beganAt;
        return {
            acceptedEventCount: updates,
            acceptedEventElapsedMs: elapsedMs,
            acceptedEventRateHz: (updates * 1_000) / elapsedMs,
            acceptedEventIntervalMs: elapsedMs / updates,
            acknowledgementLatencyAverageMs: acknowledgementLatencyTotalMs / updates,
            acknowledgementLatencyMaxMs,
        };
    }, { cells: activeCells, updates: updateCount });
    await page.waitForFunction((expectedEvents) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletMarkedEventCount >= expectedEvents
    ), updateCount, { timeout: 5_000 });
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, { timeout: 20_000 });
    return {
        ...await readMeasuredAudioMetrics(page),
        ...cadence,
    };
}

async function measureProductUiAmountChurn(
    page,
    { blockCount = 768, updateCount = 125 } = {},
) {
    await resetMeasuredAudioMetrics(page);
    await page.waitForTimeout(50);
    const cadence = await page.evaluate(async ({ updates }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        const slider = root?.querySelector('[role="slider"][aria-label="Route 1 amount"]')
            ?? root?.querySelector('[data-role="mobile-mod-amount-slider"]');
        if (!(slider instanceof HTMLElement)) {
            throw new Error("The first product modulation amount control is unavailable.");
        }
        const baselineFrontier = Number(
            api.runtimeInstallAckForTest()?.acceptedModulationSerial,
        );
        if (!Number.isInteger(baselineFrontier)) {
            throw new Error("The product modulation publisher has no accepted frontier.");
        }

        const beganAt = performance.now();
        let acknowledgementLatencyTotalMs = 0;
        let acknowledgementLatencyMaxMs = 0;
        let dispatchLatencyTotalMs = 0;
        let dispatchLatencyMaxMs = 0;
        for (let updateIndex = 0; updateIndex < updates; updateIndex += 1) {
            const startedAt = performance.now();
            const expectedFrontier = baselineFrontier + updateIndex + 1;
            if (slider instanceof HTMLInputElement) {
                const setValue = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype,
                    "value",
                )?.set;
                const step = Number(slider.step) || 0.001;
                const direction = updateIndex % 2 === 0 ? 1 : -1;
                setValue?.call(slider, String(Number(slider.value) + (direction * step)));
                slider.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                slider.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
            } else {
                slider.dispatchEvent(new KeyboardEvent("keydown", {
                    key: updateIndex % 2 === 0 ? "ArrowUp" : "ArrowDown",
                    bubbles: true,
                    cancelable: true,
                }));
            }
            const dispatchLatencyMs = performance.now() - startedAt;
            dispatchLatencyTotalMs += dispatchLatencyMs;
            dispatchLatencyMaxMs = Math.max(dispatchLatencyMaxMs, dispatchLatencyMs);

            while (true) {
                const acknowledgement = api.runtimeInstallAckForTest();
                if (acknowledgement?.rejectedSerial === expectedFrontier) {
                    throw new Error(`Product amount edit was rejected: ${JSON.stringify(acknowledgement)}`);
                }
                const frontier = Number(acknowledgement?.acceptedModulationSerial);
                if (frontier === expectedFrontier) break;
                if (frontier > expectedFrontier) {
                    throw new Error(`Product edit emitted more than one runtime command: ${JSON.stringify(acknowledgement)}`);
                }
                if (performance.now() - startedAt > 5_000) {
                    throw new Error(`Timed out waiting for product amount edit ${updateIndex + 1}.`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            const acknowledgementLatencyMs = performance.now() - startedAt;
            acknowledgementLatencyTotalMs += acknowledgementLatencyMs;
            acknowledgementLatencyMaxMs = Math.max(
                acknowledgementLatencyMaxMs,
                acknowledgementLatencyMs,
            );
            api.getSnapshot();
        }
        const elapsedMs = performance.now() - beganAt;
        return {
            acceptedEventCount: updates,
            acceptedEventElapsedMs: elapsedMs,
            acceptedEventRateHz: (updates * 1_000) / elapsedMs,
            acceptedEventIntervalMs: elapsedMs / updates,
            acknowledgementLatencyAverageMs: acknowledgementLatencyTotalMs / updates,
            acknowledgementLatencyMaxMs,
            dispatchLatencyAverageMs: dispatchLatencyTotalMs / updates,
            dispatchLatencyMaxMs,
            baselineFrontier,
            finalFrontier: Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial),
        };
    }, { updates: updateCount });
    await page.waitForFunction((expectedEvents) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletMarkedEventCount >= expectedEvents
    ), updateCount, { timeout: 5_000 });
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, { timeout: 15_000 });
    return {
        ...await readMeasuredAudioMetrics(page),
        ...cadence,
    };
}

async function measureProductUiLatestValueCadence(
    page,
    { blockCount = 768, updateCount = 119 } = {},
) {
    await resetMeasuredAudioMetrics(page);
    await page.waitForTimeout(50);
    const gesture = await page.evaluate(async ({ updates }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        const slider = root?.querySelector('[role="slider"][aria-label="Route 1 amount"]')
            ?? root?.querySelector('[data-role="mobile-mod-amount-slider"]');
        if (!(slider instanceof HTMLElement)) {
            throw new Error("The first product modulation amount control is unavailable.");
        }

        const readValue = () => Number(
            slider instanceof HTMLInputElement ? slider.value : slider.getAttribute("aria-valuenow"),
        );
        const dispatchStep = (direction) => {
            if (slider instanceof HTMLInputElement) {
                const setValue = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype,
                    "value",
                )?.set;
                const step = Number(slider.step) || 0.001;
                const nextValue = Number(slider.value) + (direction * step);
                setValue?.call(slider, String(nextValue));
                slider.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                slider.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
                return nextValue;
            }
            slider.dispatchEvent(new KeyboardEvent("keydown", {
                key: direction > 0 ? "ArrowUp" : "ArrowDown",
                bubbles: true,
                cancelable: true,
            }));
            return null;
        };
        const waitForStableFrontier = async () => {
            let frontier = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
            for (let stableChecks = 0; stableChecks < 3; stableChecks += 1) {
                await new Promise((resolve) => setTimeout(resolve, 75));
                const next = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
                if (next !== frontier) {
                    frontier = next;
                    stableChecks = -1;
                }
            }
            return frontier;
        };

        const baselineFrontier = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
        if (!Number.isInteger(baselineFrontier)) {
            throw new Error("The product modulation publisher has no accepted frontier.");
        }

        const beganAt = performance.now();
        const gestureIntervalMs = 1_000 / 60;
        let dispatchLatencyTotalMs = 0;
        let dispatchLatencyMaxMs = 0;
        for (let updateIndex = 0; updateIndex < updates; updateIndex += 1) {
            const dispatchStartedAt = performance.now();
            dispatchStep(updateIndex % 2 === 0 ? 1 : -1);
            const dispatchLatencyMs = performance.now() - dispatchStartedAt;
            dispatchLatencyTotalMs += dispatchLatencyMs;
            dispatchLatencyMaxMs = Math.max(dispatchLatencyMaxMs, dispatchLatencyMs);
            const remainingMs = beganAt + ((updateIndex + 1) * gestureIntervalMs) - performance.now();
            await new Promise((resolve) => setTimeout(resolve, Math.max(0, remainingMs)));
        }
        const inputElapsedMs = performance.now() - beganAt;
        const drainedFrontier = await waitForStableFrontier();
        const finalStartedAt = performance.now();
        const requestedFinalAmount = dispatchStep(updates % 2 === 0 ? 1 : -1);
        const expectedFinalFrontier = drainedFrontier + 1;

        while (true) {
            const acknowledgement = api.runtimeInstallAckForTest();
            if (acknowledgement?.rejectedSerial === expectedFinalFrontier) {
                throw new Error(`Final product amount was rejected: ${JSON.stringify(acknowledgement)}`);
            }
            const frontier = Number(acknowledgement?.acceptedModulationSerial);
            if (frontier === expectedFinalFrontier) break;
            if (frontier > expectedFinalFrontier) {
                throw new Error(`Final product amount emitted multiple commands: ${JSON.stringify(acknowledgement)}`);
            }
            if (performance.now() - finalStartedAt > 5_000) {
                throw new Error("Timed out waiting for the final product amount.");
            }
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const finalAmount = requestedFinalAmount ?? readValue();

        return {
            acknowledgedEventCount: expectedFinalFrontier - baselineFrontier,
            baselineFrontier,
            dispatchedEventCount: updates + 1,
            dispatchLatencyAverageMs: dispatchLatencyTotalMs / updates,
            dispatchLatencyMaxMs,
            drainedFrontier,
            inputAcceptedEventCount: drainedFrontier - baselineFrontier,
            inputUpdateCount: updates,
            finalAcknowledgementLatencyMs: performance.now() - finalStartedAt,
            finalAmount,
            finalAmountKind: slider instanceof HTMLInputElement ? "sliderPosition" : "routeAmount",
            finalFrontier: expectedFinalFrontier,
            inputElapsedMs,
            inputRateHz: (updates * 1_000) / inputElapsedMs,
        };
    }, { updates: updateCount });
    await page.waitForFunction((expectedEvents) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletMarkedEventCount >= expectedEvents
    ), gesture.acknowledgedEventCount, { timeout: 5_000 });
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, { timeout: 15_000 });
    return {
        ...await readMeasuredAudioMetrics(page),
        ...gesture,
    };
}

async function measureModulationGapProbe(
    page,
    program,
    { blockCount = modulationStressBlockCount, intervalMs, eventCount } = {},
) {
    if (program !== null) {
        await sendAcceptedModulationEvent(page, "modulationProgram", program);
    }
    await page.waitForTimeout(150);
    await resetMeasuredAudioMetrics(page);
    await page.waitForTimeout(50);
    await page.evaluate(async ({ delayMs, events }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        for (let eventIndex = 0; eventIndex < events; eventIndex += 1) {
            api.sendPerfGapProbe();
            api.getSnapshot();
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }, { delayMs: intervalMs, events: eventCount });
    await page.waitForFunction((expectedEvents) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletMarkedEventCount >= expectedEvents
    ), eventCount, { timeout: 5_000 });
    await page.waitForFunction((minimumBlocks) => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
    ), blockCount, { timeout: 20_000 });
    return readMeasuredAudioMetrics(page);
}

function assertMatchedEventGap(realMeasurement, probeMeasurement, expectedEventCount, averageTolerance) {
    for (const measurement of [realMeasurement, probeMeasurement]) {
        assert.equal(measurement.markedEventCount, expectedEventCount, JSON.stringify(measurement));
        assert.ok(
            measurement.eventAdjacentBlockCount >= expectedEventCount * 0.9,
            JSON.stringify(measurement),
        );
        assert.ok(measurement.audioPollCount >= expectedEventCount, JSON.stringify(measurement));
        assert.equal(measurement.silentHeldNotePollCount, 0, JSON.stringify(measurement));
    }
    assert.ok(
        realMeasurement.eventAdjacentAverageGapLoad
            <= probeMeasurement.eventAdjacentAverageGapLoad + averageTolerance,
        JSON.stringify({ realMeasurement, probeMeasurement }),
    );
}

function assertAcceptedEventCadence(measurement, expectedEventCount, targetIntervalMs) {
    const targetRateHz = 1_000 / targetIntervalMs;
    assert.equal(measurement.acceptedEventCount, expectedEventCount, JSON.stringify(measurement));
    assert.ok(
        measurement.acceptedEventRateHz >= targetRateHz * 0.9,
        JSON.stringify({ measurement, targetRateHz }),
    );
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
            : await chromium.launch(chromiumLaunchOptions);
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
        : await chromium.launch(chromiumLaunchOptions);
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
            route1Amount: null,
            route1Source: null,
            route1Target: null,
            route2Amount: null,
            route2Source: null,
            route2Target: null,
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
                    && Number(filter?.cutoffHz) > 900
                    && Math.abs(Number(wavetable?.position)) < 0.000001;
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

test("generated browser rejects malformed and pre-RT-01 expanded voice programs", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });

    try {
        await page.goto(`${baseUrl}?test=1&runtime-owner=host`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running");

        const malformedProgram = {
            ...emptyModulationProgram,
            voiceRouteCount: 1,
            voiceRouteCells: [1, ...emptyModulationProgram.voiceRouteCells.slice(1)],
        };
        const outcome = await sendAcknowledgedRuntimeEvent(
            page,
            "modulation",
            "modulationProgram",
            malformedProgram,
        );
        assert.equal(outcome.accepted, false, JSON.stringify(outcome));
        assert.equal(
            outcome.acknowledgement.rejectedSerial,
            outcome.deliverySerial,
            JSON.stringify(outcome),
        );
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().modulationRejectedRouteCount === 1
        ), null, { timeout: 5_000 });

        const expandedVoiceOutcome = await sendAcknowledgedRuntimeEvent(
            page,
            "modulation",
            "modulationProgram",
            matrixVoiceHundredProgram,
        );
        assert.equal(expandedVoiceOutcome.accepted, false, JSON.stringify(expandedVoiceOutcome));
        assert.equal(expandedVoiceOutcome.acknowledgement.rejectionReason, 3);
        assert.equal(
            expandedVoiceOutcome.acknowledgement.rejectedSerial,
            expandedVoiceOutcome.deliverySerial,
            JSON.stringify(expandedVoiceOutcome),
        );
    } finally {
        await page.close();
    }
});

test("the production worker installs the unchanged v4 100-route rack profile end to end", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const profile = matrixBenchmarkProfiles.get("voice-rack-100");
    assert.ok(profile);
    await page.addInitScript(({ modulationState, modulationStateKey }) => {
        localStorage.setItem("cosimo.web.patch-state.v1", JSON.stringify({
            [modulationStateKey]: modulationState,
        }));
    }, { modulationState: profile.stateJSON, modulationStateKey: MODULATION_STATE_KEY });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            const acknowledgement = snapshot?.latestRuntimeInstallAck;
            return snapshot?.phase === "running"
                && Number(acknowledgement?.installedVoiceRouteCount) === 0
                && Number(acknowledgement?.installedMacroVoiceRouteCount) === 0
                && Number(acknowledgement?.installedVoiceRackRouteCount) === 100
                && Number(acknowledgement?.installedMacroRackRouteCount) === 0;
        }, null, { timeout: 30_000 });

        const evidence = await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            return api.storedState().then((storedState) => ({
                acknowledgement: api.runtimeInstallAckForTest(),
                rejectedRouteCount: api.getSnapshot().modulationRejectedRouteCount,
                storedState,
            }));
        });
        assert.equal(evidence.rejectedRouteCount, 0, JSON.stringify(evidence));
        const stored = evidence.storedState?.[MODULATION_STATE_KEY]
            ?? evidence.storedState?.values?.[MODULATION_STATE_KEY];
        assert.equal(deserializeModulationState(stored).routes.length, 100);
    } finally {
        await page.evaluate(() => localStorage.removeItem("cosimo.web.patch-state.v1")).catch(() => {});
        await page.close();
    }
});

test("the real product UI sustains 60 Hz amount edits with 100 active among 884 stored mappings", {
    timeout: 90_000,
    skip: "RT-01 must expand the product voice target runtime before this profile can execute",
}, async (t) => {
    const page = await browser.newPage(browserEngine === "webkit"
        ? { ...devices["iPhone 13"] }
        : { viewport: { width: 1280, height: 820 } });
    const pageFailures = observePageFailures(page);
    await page.addInitScript(({ modulationState, modulationStateKey }) => {
        localStorage.setItem("cosimo.web.patch-state.v1", JSON.stringify({
            [modulationStateKey]: modulationState,
        }));
    }, { modulationState: fullDomainHundredActiveStoredState, modulationStateKey: MODULATION_STATE_KEY });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const desktopCount = root?.querySelectorAll('[data-role^="route-row-"]').length ?? 0;
            const mobileCount = root?.querySelectorAll('[data-role="mobile-mod-route-row"]').length ?? 0;
            return desktopCount === 884 || mobileCount === 884;
        }, null, { timeout: 30_000 });
        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const mobileRoute = root?.querySelector('[data-role="mobile-mod-route-open-0"]');
            if (mobileRoute instanceof HTMLButtonElement) mobileRoute.click();
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return Boolean(
                root?.querySelector('[role="slider"][aria-label="Route 1 amount"]')
                ?? root?.querySelector('[data-role="mobile-mod-amount-slider"]'),
            );
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.phase === "running"
                && snapshot.hasActiveTable
                && Number(snapshot.latestRuntimeInstallAck?.acceptedModulationSerial) >= 13;
        }, null, { timeout: 30_000 });

        const settledFrontier = await page.evaluate(async () => {
            const api = globalThis.__COSIMO_WEB_POC__;
            let previous = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
            for (let check = 0; check < 3; check += 1) {
                await new Promise((resolve) => setTimeout(resolve, 75));
                const next = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
                if (next !== previous) {
                    check = -1;
                    previous = next;
                }
            }
            return previous;
        });
        assert.ok(Number.isInteger(settledFrontier));

        await page.evaluate(() => {
            for (let note = 48; note < 64; note += 1) {
                globalThis.__COSIMO_WEB_POC__.noteOn(note, 96);
            }
        });
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001 && snapshot.startedVoiceIndices.length === 16;
        }, null, { timeout: 10_000 });

        const measurement = await measureProductUiAmountChurn(page);
        const gapProbe = await measureModulationGapProbe(page, null, {
            blockCount: 768,
            intervalMs: measurement.acceptedEventIntervalMs,
            eventCount: 125,
        });
        const latestValueCadence = await measureProductUiLatestValueCadence(page);
        t.diagnostic(JSON.stringify({
            productUiAmountChurn: measurement,
            productUiGapProbe: gapProbe,
            productUiLatestValueCadence: latestValueCadence,
        }));
        assert.equal(measurement.acceptedEventCount, 125, JSON.stringify(measurement));
        assert.ok(
            measurement.dispatchLatencyAverageMs <= modulationUiAverageDispatchBudgetMs,
            JSON.stringify(measurement),
        );
        assert.ok(
            measurement.dispatchLatencyMaxMs <= modulationUiMaximumDispatchBudgetMs,
            JSON.stringify(measurement),
        );
        assert.ok(
            measurement.acknowledgementLatencyAverageMs <= modulationUiAverageAcknowledgementBudgetMs,
            JSON.stringify(measurement),
        );
        assert.ok(
            measurement.acknowledgementLatencyMaxMs <= modulationUiMaximumAcknowledgementBudgetMs,
            JSON.stringify(measurement),
        );
        assert.equal(measurement.finalFrontier - measurement.baselineFrontier, 125, JSON.stringify(measurement));
        assert.equal(measurement.markedEventCount, 125, JSON.stringify(measurement));
        assert.equal(measurement.sampleRateHz, 48_000, JSON.stringify(measurement));
        assert.equal(measurement.renderQuantumFrames, 128, JSON.stringify(measurement));
        assert.equal(measurement.rejectedProgramCount, 0, JSON.stringify(measurement));
        assert.equal(measurement.processMultiplier, 1, JSON.stringify(measurement));
        assert.equal(measurement.frameDiscontinuityBlocks, 0, JSON.stringify(measurement));
        assert.ok(measurement.audioPollCount >= 125, JSON.stringify(measurement));
        assert.equal(measurement.silentHeldNotePollCount, 0, JSON.stringify(measurement));
        assertShippingRenderBudget(measurement);
        assertMatchedEventGap(measurement, gapProbe, 125, 0.2);

        assert.equal(latestValueCadence.dispatchedEventCount, 120, JSON.stringify(latestValueCadence));
        assert.ok(
            latestValueCadence.dispatchLatencyAverageMs <= modulationUiAverageDispatchBudgetMs,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(
            latestValueCadence.dispatchLatencyMaxMs <= modulationUiMaximumDispatchBudgetMs,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(latestValueCadence.inputRateHz >= 54, JSON.stringify(latestValueCadence));
        assert.ok(latestValueCadence.inputRateHz <= 66, JSON.stringify(latestValueCadence));
        assert.ok(
            latestValueCadence.inputAcceptedEventCount >= latestValueCadence.inputUpdateCount * 0.75,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(
            latestValueCadence.acknowledgedEventCount <= latestValueCadence.dispatchedEventCount,
            JSON.stringify(latestValueCadence),
        );
        assert.equal(
            latestValueCadence.finalFrontier,
            latestValueCadence.drainedFrontier + 1,
            JSON.stringify(latestValueCadence),
        );
        assert.equal(
            latestValueCadence.markedEventCount,
            latestValueCadence.acknowledgedEventCount,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(latestValueCadence.finalAcknowledgementLatencyMs < 250, JSON.stringify(latestValueCadence));
        assertRealtimeContinuity(latestValueCadence);

        const persisted = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.storedState());
        const modulationState = persisted?.[MODULATION_STATE_KEY] ?? persisted?.values?.[MODULATION_STATE_KEY];
        const persistedModulation = deserializeModulationState(modulationState);
        assert.equal(persistedModulation.routes.length, 884);
        assert.equal(persistedModulation.routes.filter((route) => route.enabled).length, 100);
        assert.ok(Number.isFinite(latestValueCadence.finalAmount), JSON.stringify(latestValueCadence));
        const expectedPersistedAmount = latestValueCadence.finalAmountKind === "sliderPosition"
            ? composeModulationAmount(
                persistedModulation.routes[0].targetKind,
                latestValueCadence.finalAmount,
            )
            : latestValueCadence.finalAmount;
        assert.ok(
            Math.abs(persistedModulation.routes[0].amount - expectedPersistedAmount) < 0.000001,
            JSON.stringify({ expectedPersistedAmount, latestValueCadence, persistedRoute: persistedModulation.routes[0] }),
        );
        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const mobileBack = root?.querySelector('[data-role="mobile-mod-detail-back"]');
            if (mobileBack instanceof HTMLButtonElement) mobileBack.click();
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const desktopCount = root?.querySelectorAll('[data-role^="route-row-"]').length ?? 0;
            const mobileCount = root?.querySelectorAll('[data-role="mobile-mod-route-row"]').length ?? 0;
            return desktopCount === 884 || mobileCount === 884;
        });
        assert.equal(await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const desktopCount = root?.querySelectorAll('[data-role^="route-row-"]').length ?? 0;
            const mobileCount = root?.querySelectorAll('[data-role="mobile-mod-route-row"]').length ?? 0;
            return Math.max(desktopCount, mobileCount);
        }), 884);
        pageFailures.assertClean();
    } finally {
        await page.evaluate(() => {
            for (let note = 48; note < 64; note += 1) globalThis.__COSIMO_WEB_POC__?.noteOff(note);
            localStorage.removeItem("cosimo.web.patch-state.v1");
        }).catch(() => {});
        await page.close();
    }
});

test("16 sounding voices sustain 100 mappings, isolated live edits, and the full 884-cell domain", {
    timeout: 240_000,
    skip: "RT-01 must expand the product voice target runtime before this profile can execute",
}, async (t) => {
    const page = await browser.newPage(browserEngine === "webkit"
        ? { ...devices["iPhone 13"] }
        : { viewport: { width: 1280, height: 820 } });
    const pageFailures = observePageFailures(page);

    try {
        assert.equal(allStressRoutes.length, 884);
        assert.deepEqual([
            mixedHundredRouteProgram.voiceRouteCount,
            mixedHundredRouteProgram.macroVoiceRouteCount,
            mixedHundredRouteProgram.voiceRackRouteCount,
            mixedHundredRouteProgram.macroRackRouteCount,
        ], [30, 20, 30, 20]);
        assert.equal(hundredVoiceRouteProgram.voiceRouteCount, 100);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteCount, 100);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteCells[99], 99);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteAmounts[99], 10);
        assert.equal(hundredVoiceRackRouteProgram.voiceRackRouteCount, 100);
        assert.deepEqual([
            matrixVoiceHundredProgram.voiceRouteCount,
            matrixVoiceHundredProgram.macroVoiceRouteCount,
            matrixVoiceHundredProgram.voiceRackRouteCount,
            matrixVoiceHundredProgram.macroRackRouteCount,
        ], [100, 0, 0, 0]);
        assert.deepEqual([
            matrixVoiceRackHundredProgram.voiceRouteCount,
            matrixVoiceRackHundredProgram.macroVoiceRouteCount,
            matrixVoiceRackHundredProgram.voiceRackRouteCount,
            matrixVoiceRackHundredProgram.macroRackRouteCount,
        ], [0, 0, 100, 0]);
        assert.deepEqual([
            matrixMixedHundredProgram.voiceRouteCount,
            matrixMixedHundredProgram.macroVoiceRouteCount,
            matrixMixedHundredProgram.voiceRackRouteCount,
            matrixMixedHundredProgram.macroRackRouteCount,
        ], [30, 20, 30, 20]);
        assert.deepEqual([
            matrixCombinedTwoHundredProgram.voiceRouteCount,
            matrixCombinedTwoHundredProgram.macroVoiceRouteCount,
            matrixCombinedTwoHundredProgram.voiceRackRouteCount,
            matrixCombinedTwoHundredProgram.macroRackRouteCount,
        ], [100, 0, 100, 0]);
        assert.deepEqual([
            matrixStoredFullDomainHundredProgram.voiceRouteCount,
            matrixStoredFullDomainHundredProgram.macroVoiceRouteCount,
            matrixStoredFullDomainHundredProgram.voiceRackRouteCount,
            matrixStoredFullDomainHundredProgram.macroRackRouteCount,
        ], [30, 20, 30, 20]);
        assert.deepEqual([
            matrixActiveFullDomainProgram.voiceRouteCount,
            matrixActiveFullDomainProgram.macroVoiceRouteCount,
            matrixActiveFullDomainProgram.voiceRackRouteCount,
            matrixActiveFullDomainProgram.macroRackRouteCount,
        ], [288, 128, 324, 144]);
        assert.deepEqual([
            disabledAllMappingProgram.voiceRouteCount,
            disabledAllMappingProgram.macroVoiceRouteCount,
            disabledAllMappingProgram.voiceRackRouteCount,
            disabledAllMappingProgram.macroRackRouteCount,
        ], [0, 0, 0, 0]);
        assert.equal([
            ...disabledAllMappingProgram.voiceRouteAmounts,
            ...disabledAllMappingProgram.macroVoiceRouteAmounts,
            ...disabledAllMappingProgram.voiceRackRouteAmounts,
            ...disabledAllMappingProgram.macroRackRouteAmounts,
        ].filter((amount) => amount !== 0).length, 884);
        await page.goto(`${baseUrl}?test=1&runtime-owner=host`, { waitUntil: "domcontentloaded" });
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
            api.setParameter("unisonVoices", 1);
            api.setParameter("warpMode", 0);
            api.sendEvent("rackEnable", { enabledFlags: [0, 0, 0, 0, 0, 0, 0, 0] });
        });
        await sendAcceptedModulationEvent(page, "modulationProgram", mixedHundredRouteProgram);
        await sendAcceptedArticulationEvent(page, "articulationSnapshot", {
            selectorA: 0,
            enabled: true,
            framePosition: 0,
            pan: 0,
            unisonVoices: 2,
            unisonDetune: 0.1,
            unisonBlend: 0.75,
            unisonWidth: 1,
            unisonPhase: 0,
            unisonRandom: 0,
            unisonPhaseMode: 0,
            unisonDetuneMode: 0,
            unisonStackMode: 0,
            unisonWavetablePositionSpread: 0,
            unisonWarpSpread: 0,
            warpMode: 0,
            warpAmount: 0,
            filterMode: 0,
            filterCutoffHz: 1_000,
            filterQ: 0.707107,
            msegMorphs: [0, 0, 0],
            routeAmounts: Array.from(
                { length: MODULATION_ARTICULATION_ROUTE_CELL_COUNT },
                () => ARTICULATION_ROUTE_AMOUNT_INHERIT,
            ),
            envelopeAttackSeconds: [0.01, 0.01, 0.01],
            envelopeDecaySeconds: [0.25, 0.25, 0.25],
            envelopeSustain: [0.5, 0.5, 0.5],
            envelopeReleaseSeconds: [0.2, 0.2, 0.2],
        });
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (let note = 48; note < 56; note += 1) {
                api.sendEvent("articulatedNoteOn", {
                    channel: 1,
                    pitch: note,
                    velocity: 0.75,
                    hasArticulation: true,
                    selectorA: 0,
                    selectorB: 0,
                    durationSamples: 0,
                    ageSamples: 0,
                });
            }
            for (let note = 56; note < 64; note += 1) api.noteOn(note, 96, 1);
        });
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001 && snapshot.startedVoiceIndices.length === 16;
        }, null, {
            timeout: 10_000,
        });
        assert.deepEqual(
            await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().startedVoiceIndices),
            Array.from({ length: 16 }, (_, voiceIndex) => voiceIndex),
        );
        const articulationStarts = await page.evaluate(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().voiceArticulationStarts
        ));
        assert.equal(articulationStarts.filter((event) => event.hasArticulation === 1).length, 8);
        assert.equal(articulationStarts.filter((event) => event.hasArticulation === 0).length, 8);
        assert.equal(
            articulationStarts
                .filter((event) => event.hasArticulation === 1)
                .every((event) => Math.abs(event.route1Amount - 0.01) < 0.000001),
            true,
            JSON.stringify(articulationStarts),
        );

        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setMpeSlideForTest(1, 1));
        await sendAcceptedModulationEvent(page, "modulationProgram", hundredVoiceTailSentinelProgram);
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            const q = Number(filter?.event?.q ?? filter?.q);
            return Number(filter?.event?.hasActive ?? filter?.hasActive) === 1 && q >= 10;
        }, null, { timeout: 5_000 });
        const tailSentinelHighQ = await page.evaluate(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q);
        });
        await sendAcceptedModulationEvent(
            page,
            "modulationProgram",
            inactiveHundredVoiceTailSentinelProgram,
        );
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q) < 2;
        }, null, { timeout: 5_000 });
        const inactiveVoiceTailBaseQ = await page.evaluate(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q);
        });
        await sendAcceptedModulationEvent(page, "modulationProgram", hundredVoiceTailSentinelProgram);
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q) >= 10;
        }, null, { timeout: 5_000 });
        await sendAcceptedModulationEvent(page, "modulationAmount", {
            pathKind: 1,
            cellIndex: 99,
            amount: 0,
        });
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q) < 2;
        }, null, { timeout: 5_000 });
        const tailSentinelBaseQ = await page.evaluate(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q);
        });
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setMpeSlideForTest(0, 1));
        assert.ok(tailSentinelHighQ - tailSentinelBaseQ >= 8, JSON.stringify({
            inactiveVoiceTailBaseQ,
            tailSentinelBaseQ,
            tailSentinelHighQ,
        }));
        assert.ok(inactiveVoiceTailBaseQ < 2, JSON.stringify({
            inactiveVoiceTailBaseQ,
            tailSentinelHighQ,
        }));

        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setParameter("macro1", 1));
        await sendAcceptedModulationEvent(page, "modulationProgram", macroVoiceFilterQProgram);
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q) >= 10;
        }, null, { timeout: 5_000 });
        const macroVoiceHighQ = await page.evaluate(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q);
        });
        await sendAcceptedModulationEvent(page, "modulationProgram", inactiveMacroVoiceFilterQProgram);
        await page.waitForFunction(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q) < 2;
        }, null, { timeout: 5_000 });
        const inactiveMacroVoiceBaseQ = await page.evaluate(() => {
            const filter = globalThis.__COSIMO_WEB_POC__.getSnapshot().latestEffectiveFilterState;
            return Number(filter?.event?.q ?? filter?.q);
        });
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setParameter("macro1", 0));
        assert.ok(macroVoiceHighQ - inactiveMacroVoiceBaseQ >= 8, JSON.stringify({
            inactiveMacroVoiceBaseQ,
            macroVoiceHighQ,
        }));

        const baseline = await measureModulationProgramLoad(page, emptyModulationProgram, modulationStressBlockCount);
        const hundredVoiceMappings = await measureModulationProgramLoad(page, hundredVoiceRouteProgram, modulationStressBlockCount);
        const hundredVoiceRackMappings = await measureModulationProgramLoad(page, hundredVoiceRackRouteProgram, modulationStressBlockCount);
        const hundredMappings = await measureModulationProgramLoad(page, mixedHundredRouteProgram, modulationStressBlockCount);
        const allMappings = await measureModulationProgramLoad(page, allMappingProgram, modulationStressBlockCount);
        const amountChurn = await measureModulationAmountChurn(page, mixedHundredRouteProgram);
        const amountGapProbe = await measureModulationGapProbe(page, mixedHundredRouteProgram, {
            intervalMs: amountChurn.acceptedEventIntervalMs,
            eventCount: modulationAmountStressEventCount,
        });
        const topologyChurn = await measureModulationTopologyChurn(page, [
            mixedHundredRouteProgram,
            mixedHundredRouteProgramVariant,
        ]);
        const topologyGapProbe = await measureModulationGapProbe(page, mixedHundredRouteProgram, {
            intervalMs: topologyChurn.acceptedEventIntervalMs,
            eventCount: modulationTopologyStressEventCount,
        });
        const fullDomainTopologyChurn = await measureModulationTopologyChurn(page, [
            allMappingProgram,
            allMappingProgramVariant,
        ]);
        const fullDomainTopologyGapProbe = await measureModulationGapProbe(page, allMappingProgram, {
            intervalMs: fullDomainTopologyChurn.acceptedEventIntervalMs,
            eventCount: modulationTopologyStressEventCount,
        });
        await page.evaluate(async () => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (let note = 48; note < 64; note += 1) api.noteOff(note, 1);
            await new Promise((resolve) => setTimeout(resolve, 350));
            api.setParameter("unisonVoices", 2);
            api.setParameter("warpMode", 1);
            api.setParameter("warpAmount", 0.6);
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 1_200);
            api.setParameter("distortionWet", 0.35);
            api.setParameter("ottAmount", 35);
            api.setParameter("ottMix", 35);
            api.setParameter("chorusMix", 0.3);
            api.setParameter("flangerMix", 0.25);
            api.setParameter("phaserMix", 0.25);
            api.setParameter("delayMix", 0.25);
            api.setParameter("reverbMix", 0.3);
            api.sendEvent("rackEnable", { enabledFlags: [1, 1, 1, 1, 1, 1, 1, 1] });
            for (let note = 48; note < 64; note += 1) api.noteOn(note, 96, 1);
        });
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001
                && snapshot.heldNoteCount === 16
                && snapshot.voiceArticulationStarts.length >= 32;
        });
        const retriggeredVoiceStarts = await page.evaluate(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().voiceArticulationStarts.slice(-16)
        ));
        assert.equal(new Set(retriggeredVoiceStarts.map(({ voiceIndex }) => voiceIndex)).size, 16);
        const activeWarpTortureBaseline = await measureModulationProgramLoad(
            page,
            emptyModulationProgram,
            sustainedStressBlockCount,
        );
        const activeWarpTortureShippingLoad = await measureModulationProgramLoad(
            page,
            hundredVoiceRouteProgram,
            sustainedStressBlockCount,
        );

        // The everything-on warp/rack epoch is deliberately allowed to exceed
        // real time. Start a fresh production AudioContext so the doubled-load
        // contract measures steady-state pacing instead of renderer catch-up.
        await page.goto(`${baseUrl}?test=1&runtime-owner=host`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.hasActiveTable;
        }, null, { timeout: 30_000 });
        await installNeutralMatrixSourceContract(page);
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("unisonVoices", 1);
            api.setParameter("warpMode", 0);
            api.setParameter("warpAmount", 0);
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 1_200);
            api.setParameter("distortionWet", 0.35);
            api.setParameter("ottAmount", 35);
            api.setParameter("ottMix", 35);
            api.setParameter("chorusMix", 0.3);
            api.setParameter("flangerMix", 0.25);
            api.setParameter("phaserMix", 0.25);
            api.setParameter("delayMix", 0.25);
            api.setParameter("reverbMix", 0.3);
            api.sendEvent("rackEnable", { enabledFlags: [1, 1, 1, 1, 1, 1, 1, 1] });
            for (let note = 48; note < 64; note += 1) api.noteOn(note, 100, 1);
        });
        await applyNeutralMatrixExpressionContract(page);
        await page.waitForTimeout(50);
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001
                && snapshot.heldNoteCount === 16
                && snapshot.startedVoiceIndices.length === 16;
        }, null, { timeout: 10_000 });
        await setPerfProcessMultiplier(page, 2);
        const doubledRealtimePacing = await waitForRealtimeAudioPacing(page, emptyModulationProgram);
        const doubledInactiveTailPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            disabledAllMappingProgram,
        );
        const doubledVoicePair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixVoiceHundredProgram,
        );
        const doubledVoiceRackPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixVoiceRackHundredProgram,
        );
        const doubledMixedPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixMixedHundredProgram,
        );
        const doubledCombinedPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixCombinedTwoHundredProgram,
        );
        const doubledStoredFullDomainHundredPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixStoredFullDomainHundredProgram,
        );
        await setPerfProcessMultiplier(page, 1);
        const fullDomainNeutralPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixActiveFullDomainProgram,
        );
        const doubledRouteDominantBaseline = doubledVoicePair.baseline;
        const doubledInactiveTailLoad = doubledInactiveTailPair.loaded;
        const doubledRouteDominantShippingLoad = doubledVoicePair.loaded;
        const doubledVoiceRackShippingLoad = doubledVoiceRackPair.loaded;
        const doubledMixedShippingLoad = doubledMixedPair.loaded;
        const doubledCombinedShippingLoad = doubledCombinedPair.loaded;
        const doubledStoredFullDomainHundredLoad = doubledStoredFullDomainHundredPair.loaded;
        const fullDomainNeutralBaseline = fullDomainNeutralPair.baseline;
        const fullDomainNeutralLoad = fullDomainNeutralPair.loaded;
        t.diagnostic(JSON.stringify({
            baseline,
            hundredVoiceMappings,
            hundredVoiceRackMappings,
            hundredMappings,
            allMappings,
            amountGapProbe,
            amountChurn,
            topologyGapProbe,
            topologyChurn,
            fullDomainTopologyGapProbe,
            fullDomainTopologyChurn,
            activeWarpTortureBaseline,
            activeWarpTortureShippingLoad,
            doubledRealtimePacing,
            doubledInactiveTailPair,
            doubledVoicePair,
            doubledVoiceRackPair,
            doubledMixedPair,
            doubledCombinedPair,
            doubledStoredFullDomainHundredPair,
            fullDomainNeutralPair,
            inactiveMacroVoiceBaseQ,
            inactiveVoiceTailBaseQ,
            macroVoiceHighQ,
            tailSentinelBaseQ,
            tailSentinelHighQ,
        }));

        assert.ok(baseline.audioRms > 0.00001, JSON.stringify(baseline));
        assertRealtimeContinuity(baseline);
        assertShippingSustainedBudget(baseline);
        for (const measuredHundred of [hundredVoiceMappings, hundredVoiceRackMappings, hundredMappings]) {
            assert.ok(measuredHundred.audioRms > 0.00001);
            assertRealtimeContinuity(measuredHundred);
        }
        assert.ok(allMappings.audioRms > 0.00001);
        assertRealtimeContinuity(allMappings);
        // These legacy stress programs intentionally move oscillator, filter, unison,
        // and rack parameters, so their total render load is a functional/churn probe,
        // not evidence of matrix cost. The neutral paired full-domain measurements
        // below own the performance contract without changing the rendered workload.
        for (const editStress of [amountChurn, topologyChurn]) {
            assert.ok(editStress.audioRms > 0.00001);
            assertRealtimeContinuity(editStress);
            assertShippingRenderBudget(editStress);
        }
        assertAcceptedEventCadence(
            amountChurn,
            modulationAmountStressEventCount,
            modulationAmountStressIntervalMs,
        );
        assertAcceptedEventCadence(
            topologyChurn,
            modulationTopologyStressEventCount,
            modulationTopologyStressIntervalMs,
        );
        assertMatchedEventGap(
            amountChurn,
            amountGapProbe,
            modulationAmountStressEventCount,
            0.2,
        );
        assertMatchedEventGap(
            topologyChurn,
            topologyGapProbe,
            modulationTopologyStressEventCount,
            0.2,
        );
        assert.ok(fullDomainTopologyChurn.audioRms > 0.00001);
        assertRealtimeContinuity(fullDomainTopologyChurn);
        assertAcceptedEventCadence(
            fullDomainTopologyChurn,
            modulationTopologyStressEventCount,
            modulationTopologyStressIntervalMs,
        );
        assertMatchedEventGap(
            fullDomainTopologyChurn,
            fullDomainTopologyGapProbe,
            modulationTopologyStressEventCount,
            0.25,
        );
        for (const tortureMeasurement of [
            activeWarpTortureBaseline,
            activeWarpTortureShippingLoad,
        ]) {
            assert.ok(tortureMeasurement.audioRms > 0.00001);
            assert.equal(tortureMeasurement.processMultiplier, 1);
            assertRealtimeContinuity(tortureMeasurement);
        }
        assertBoundedRelativeRuntimeCost(
            activeWarpTortureShippingLoad,
            activeWarpTortureBaseline,
            1.15,
        );
        for (const doubledPair of [
            doubledInactiveTailPair,
            doubledVoicePair,
            doubledVoiceRackPair,
            doubledMixedPair,
            doubledCombinedPair,
            doubledStoredFullDomainHundredPair,
        ]) {
            for (const doubledMeasurement of [doubledPair.before, doubledPair.loaded, doubledPair.after]) {
                assert.ok(doubledMeasurement.audioRms > 0.00001);
                assert.equal(doubledMeasurement.processMultiplier, 2);
                assertRealtimeContinuity(doubledMeasurement);
                assertSustainedRealtimeThroughput(doubledMeasurement, 1.1);
                assertRealtimePacedMeasurement(doubledMeasurement);
            }
        }
        assert.ok(
            doubledInactiveTailLoad.quantizedAverageLoad
                <= doubledInactiveTailPair.baseline.quantizedAverageLoad + 0.03,
            JSON.stringify({ doubledInactiveTailPair }),
        );
        assertNoMeaningfulCallbackGapIncrease(
            doubledRouteDominantShippingLoad,
            doubledVoicePair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            doubledVoiceRackShippingLoad,
            doubledVoiceRackPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            doubledMixedShippingLoad,
            doubledMixedPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            doubledCombinedShippingLoad,
            doubledCombinedPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            doubledStoredFullDomainHundredLoad,
            doubledStoredFullDomainHundredPair.baseline,
        );
        for (const hundredRoutePair of [
            doubledVoicePair,
            doubledVoiceRackPair,
            doubledMixedPair,
            doubledStoredFullDomainHundredPair,
        ]) {
            assertMatrixAddedLoad(hundredRoutePair.loaded, hundredRoutePair.baseline, 0.1);
        }
        assertMatrixAddedLoad(doubledCombinedShippingLoad, doubledCombinedPair.baseline, 0.15);
        for (const fullDomainMeasurement of [
            fullDomainNeutralPair.before,
            fullDomainNeutralLoad,
            fullDomainNeutralPair.after,
        ]) {
            assert.ok(fullDomainMeasurement.audioRms > 0.00001);
            assert.equal(fullDomainMeasurement.processMultiplier, 1);
            assertRealtimeContinuity(fullDomainMeasurement);
            assertRealtimePacedMeasurement(fullDomainMeasurement);
        }
        assertMatrixAddedLoad(fullDomainNeutralLoad, fullDomainNeutralBaseline, 0.35);
        assertFullDomainTortureBudget(fullDomainNeutralLoad);
        pageFailures.assertClean();
    } finally {
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (let note = 48; note < 64; note += 1) api.noteOff(note, 1);
        }).catch(() => {});
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
        await page.goto(`${baseUrl}?test=1&runtime-owner=host`, { waitUntil: "domcontentloaded" });
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
        });
        await sendAcceptedModulationEvent(
            page,
            "modulationProgram",
            macroRackDistortionWetProgram,
        );
        const macroLowRms = await measureHeldNote(page);
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setParameter("macro1", 1));
        const macroHighRms = await measureHeldNote(page);
        assert.ok(
            Math.abs(macroHighRms - macroLowRms) / macroLowRms > 0.08,
            `Macro-to-rack modulation must change audio (low ${macroLowRms}, high ${macroHighRms}).`,
        );

        await sendAcceptedModulationEvent(
            page,
            "modulationProgram",
            inactiveMacroRackDistortionWetProgram,
        );
        const inactiveMacroRackRms = await measureHeldNote(page);
        assert.ok(
            inactiveMacroRackRms < macroHighRms * 0.05,
            `A zero-count Macro-to-rack tail must be inert (inactive ${inactiveMacroRackRms}, active ${macroHighRms}).`,
        );
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
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
        const allOnSnapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.ok(
            allOnSnapshot.audioPeak <= 1.15 + 1e-6,
            `Rack output exceeded its 1.15 hard ceiling: ${allOnSnapshot.audioPeak}.`,
        );
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
            allOnPeak: allOnSnapshot.audioPeak,
            allOnRms,
            audioBaseLatency: sustainedSnapshot.audioBaseLatency,
            audioOutputLatency: sustainedSnapshot.audioOutputLatency,
            audioWorkletQuantizedAverageLoad: sustainedSnapshot.audioWorkletQuantizedAverageLoad,
            audioWorkletBlockCount: sustainedSnapshot.audioWorkletBlockCount,
            audioWorkletFrameDiscontinuityBlocks: sustainedSnapshot.audioWorkletFrameDiscontinuityBlocks,
            audioWorkletProcessMultiplier: sustainedSnapshot.audioWorkletProcessMultiplier,
            audioWorkletQuantizedMaxLoad: sustainedSnapshot.audioWorkletQuantizedMaxLoad,
            audioWorkletQuantizedOverBudgetBlocks: sustainedSnapshot.audioWorkletQuantizedOverBudgetBlocks,
            drivenRms,
            dryRms,
            inactiveMacroRackRms,
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

        await page.waitForFunction(async (modulationStateKey) => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            const serialized = stored.values?.[modulationStateKey];
            if (typeof serialized !== "string") {
                return false;
            }
            const state = JSON.parse(serialized);
            return Array.isArray(state.routes) && state.routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "rack.distortionKnee"
            ));
        }, MODULATION_STATE_KEY, { timeout: 3_000 });
        const modulationState = await page.evaluate(async (modulationStateKey) => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            return stored.values?.[modulationStateKey] ?? null;
        }, MODULATION_STATE_KEY);
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
            const rowHeights = Array.from(
                root?.querySelectorAll('[data-role="rack-module-list"] > [data-rack-effect-id]') ?? [],
            ).map((row) => row.getBoundingClientRect().height);
            const editorBounds = root?.querySelector('[data-role^="rack-editor-"]')?.getBoundingClientRect();
            const amountBounds = root?.querySelector('[data-role="rack-modulation-amount"]')?.getBoundingClientRect();
            const sourceLabels = Array.from(root?.querySelectorAll('[data-role^="rack-mod-source-"]') ?? [])
                .map((source) => source.getAttribute("aria-label") ?? "");
            return {
                amountWithinEditor: !amountBounds || Boolean(editorBounds
                    && amountBounds.left >= editorBounds.left
                    && amountBounds.right <= editorBounds.right),
                listHeight: listBounds?.height ?? 0,
                rowHeights,
                sourceLabels,
            };
        });
        assert.equal(rackLayout.amountWithinEditor, true, "The mapping amount must consume only the editor column.");
        assert.equal(rackLayout.rowHeights.length, 8, JSON.stringify(rackLayout));
        assert.ok(rackLayout.rowHeights.every((height) => height >= 44), JSON.stringify(rackLayout));
        assert.ok(
            rackLayout.listHeight >= rackLayout.rowHeights.reduce((sum, height) => sum + height, 0),
            JSON.stringify(rackLayout),
        );
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
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const wavetable = root?.querySelector('[data-role="wavetable-card"]')?.getBoundingClientRect();
            const filter = root?.querySelector('[data-role="filter-card"]')?.getBoundingClientRect();
            return Boolean(
                wavetable && wavetable.width > 0 && wavetable.height > 0
                && filter && filter.width > 0 && filter.height > 0,
            );
        }, null, { timeout: 30_000 });

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
