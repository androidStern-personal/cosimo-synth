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
import {
    ARTICULATION_ROUTE_AMOUNT_INHERIT,
    createDisabledArticulationRuntimeUpload,
} from "../patch_gui/articulations.js";
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
const voiceTailSentinelRoute = requireStressRoute("slide", null, "filterQ");
const hundredVoiceTailSentinelProgram = compileModulationRuntimeProgram(
    [
        ...routesByRuntimePath.get("voice")
            .filter((route) => route.id !== voiceTailSentinelRoute.id)
            .slice(0, 99),
        voiceTailSentinelRoute,
    ].map((route, index) => ({
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
const reportedMobileStoredState = serializeModulationState({
    ...createDefaultModulationState(),
    routes: [requireStressRoute("mseg", 1, "filterCutoffOctaves")],
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
    matrixBenchmarkState("stored-1131-active-100").routes,
);
const matrixActiveFullDomainProgram = compileModulationRuntimeProgram(matrixBenchmarkState("active-1131").routes);
const macroRackDistortionWetProgram = compileModulationRuntimeProgram([{
    ...requireStressRoute("macro", 1, "lane.distortion#1.distortionWet"),
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

function installEndpointListenerProbe() {
    const activeReplies = new Set();
    const removedReplies = new Set();
    let activeDeliveries = 0;
    let staleDeliveries = 0;

    const nativePostMessage = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function postMessage(message, ...rest) {
        const payload = message?.type === "patch" ? message.payload : null;
        if (payload?.endpoint === "filterSpectrum") {
            if (payload.type === "add_endpoint_listener") {
                activeReplies.add(payload.replyType);
                removedReplies.delete(payload.replyType);
            } else if (payload.type === "remove_endpoint_listener") {
                activeReplies.delete(payload.replyType);
                removedReplies.add(payload.replyType);
            }
        }
        return Reflect.apply(nativePostMessage, this, [message, ...rest]);
    };

    const NativeAudioWorkletNode = globalThis.AudioWorkletNode;
    globalThis.AudioWorkletNode = new Proxy(NativeAudioWorkletNode, {
        construct(target, argumentsList) {
            const node = Reflect.construct(target, argumentsList);
            node.port.addEventListener("message", (event) => {
                const replyType = event.data?.type === "patch" ? event.data.payload?.type : null;
                if (activeReplies.has(replyType)) activeDeliveries += 1;
                if (removedReplies.has(replyType)) staleDeliveries += 1;
            });
            return node;
        },
    });

    globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__ = {
        resetDeliveries() {
            activeDeliveries = 0;
            staleDeliveries = 0;
        },
        snapshot() {
            return {
                activeDeliveries,
                activeReplyCount: activeReplies.size,
                removedReplyCount: removedReplies.size,
                staleDeliveries,
            };
        },
    };
}

async function selectMobileWorkspaceSection(page, section) {
    const toggle = page.locator(`[data-role="mobile-workspace-tab-${section}"]`);
    await toggle.click();
    await page.waitForFunction((sectionName) => (
        document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector(`[data-role="mobile-workspace-tab-${sectionName}"]`)
            ?.getAttribute("aria-selected") === "true"
    ), section);
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
            definiteDeadlineMissBlocks: snapshot.audioWorkletDefiniteDeadlineMissBlocks,
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
    try {
        await page.waitForFunction((minimumBlocks) => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= minimumBlocks
        ), blockCount, {
            timeout: Math.max(15_000, Math.ceil((blockCount * 128 / 48_000) * 3_000)),
        });
    } catch (error) {
        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        throw new Error(`Timed out measuring modulation program: ${JSON.stringify(snapshot)}`, { cause: error });
    }
    const measurementWallMs = performance.now() - startedAt;
    const metrics = await readMeasuredAudioMetrics(page);
    const expectedAudioMs = (metrics.blockCount * metrics.renderQuantumFrames * 1_000) / metrics.sampleRateHz;
    return { ...metrics, expectedAudioMs, measurementWallMs };
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

async function waitForAsyncPageCondition(page, condition, argument = null, {
    timeout = 30_000,
    pollingInterval = 50,
} = {}) {
    const deadline = performance.now() + timeout;

    while (performance.now() <= deadline) {
        if (await page.evaluate(condition, argument)) {
            return;
        }

        await page.waitForTimeout(pollingInterval);
    }

    throw new Error(`Timed out after ${timeout} ms waiting for an asynchronous page condition.`);
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
    assert.ok(measurement.blockCount > 0, JSON.stringify(measurement));
    assert.ok(["Date.now", "performance.now"].includes(measurement.clockSource), JSON.stringify(measurement));
    assert.equal(measurement.definiteDeadlineMissBlocks, 0, JSON.stringify(measurement));
}

function assertFullDomainTortureBudget(measurement) {
    assert.ok(Number.isFinite(measurement.quantizedAverageLoad), JSON.stringify(measurement));
    assert.ok(measurement.quantizedAverageLoad <= 0.9, JSON.stringify(measurement));
    assert.ok(measurement.blockCount > 0, JSON.stringify(measurement));
    assert.ok(
        measurement.definiteDeadlineMissBlocks / measurement.blockCount < 0.02,
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
        api.setParameter("env1Sustain", 0);
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

async function measureProductUiLatestValueCadence(
    page,
    { blockCount = 768, updateCount = 119 } = {},
) {
    await resetMeasuredAudioMetrics(page);
    const finalRouteAmount = composeModulationAmount("filterCutoffOctaves", 0.731);
    const gesture = await page.evaluate(async ({ expectedFinalAmount, updates }) => {
        const api = globalThis.__COSIMO_WEB_POC__;
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        // T14/T15: the mapping ROW is the product's amount-editing surface —
        // its rail cell's vertical (rolling-axis) gesture edits this route's
        // amount through the canonical binding. The cadence drives that real
        // pointer path; there is no amount slider element any more.
        const cell = root?.querySelector('[data-role="mod-mappings-rail-0"] .mobile-voice-cell.is-readout');
        if (!(cell instanceof HTMLElement)) {
            throw new Error("The mobile product mapping row rail is unavailable.");
        }

        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const pointer = (() => {
            const rect = cell.getBoundingClientRect();
            return { id: 7777, x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
        })();
        const pointerEvent = (type) => new PointerEvent(type, {
            pointerId: pointer.id,
            pointerType: "touch",
            isPrimary: true,
            clientX: pointer.x,
            clientY: pointer.y,
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        // Up-positive, like the gesture's own convention. Returns the
        // synchronous dispatch cost (classifier + integration); the binding
        // write commits on the next animation frame, which every loop below
        // awaits, so frame pacing still carries any main-thread overload
        // into the inputRateHz and audio-continuity assertions.
        const moveBy = (dyUp) => {
            pointer.y -= dyUp;
            const startedAt = performance.now();
            window.dispatchEvent(pointerEvent("pointermove"));
            return performance.now() - startedAt;
        };
        const nativePostMessage = MessagePort.prototype.postMessage;
        let latestSentAmount = null;
        let latestSentSerial = null;
        let sentEventCount = 0;
        MessagePort.prototype.postMessage = function postMessage(message, ...rest) {
            const payload = message?.type === "patch" ? message.payload : null;
            if (payload?.type === "send_value" && payload.id === "modulationAmount") {
                latestSentAmount = Number(payload.value?.amount);
                latestSentSerial = Number(payload.value?.deliverySerial);
                sentEventCount += 1;
            }
            return Reflect.apply(nativePostMessage, this, [message, ...rest]);
        };

        try {
            const baselineFrontier = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
            if (!Number.isInteger(baselineFrontier)) {
                throw new Error("The product modulation publisher has no accepted frontier.");
            }

            cell.dispatchEvent(pointerEvent("pointerdown"));
            // One decisive upward move claims the vertical (amount) axis;
            // the classifying sample itself applies no delta.
            moveBy(12);
            await nextFrame();
            if (cell.getAttribute("data-dragging") !== "modulation") {
                throw new Error(`The rail gesture did not arm the amount axis: ${cell.getAttribute("data-dragging")}`);
            }

            const beganAt = performance.now();
            let dispatchLatencyTotalMs = 0;
            let dispatchLatencyMaxMs = 0;
            for (let updateIndex = 0; updateIndex < updates; updateIndex += 1) {
                // Asymmetric alternation: every frame commits a DISTINCT
                // amount (never a deduped rewrite) while the net drift stays
                // far from the amount clamp.
                const dispatchLatencyMs = moveBy(updateIndex % 2 === 0 ? 3.5 : -3);
                dispatchLatencyTotalMs += dispatchLatencyMs;
                dispatchLatencyMaxMs = Math.max(dispatchLatencyMaxMs, dispatchLatencyMs);
                await nextFrame();
            }
            const inputElapsedMs = performance.now() - beganAt;
            if (!Number.isFinite(latestSentAmount)) {
                throw new Error("The rail cadence produced no modulation amount sends.");
            }

            // Land the EXACT final amount. A pixel surface has no value
            // setter, so the dial calibrates the observed pixel:amount ratio
            // and homes in with a bounded number of corrections.
            const finalStartedAt = performance.now();
            let dialEventCount = 0;
            const calibrationStart = latestSentAmount;
            moveBy(10);
            dialEventCount += 1;
            await nextFrame();
            const amountPerPixel = (latestSentAmount - calibrationStart) / 10;
            if (!(amountPerPixel > 0)) {
                throw new Error(`The rail calibration move changed no amount: ${JSON.stringify({ calibrationStart, latestSentAmount })}`);
            }
            for (let attempt = 0;
                attempt < 8 && Math.abs(latestSentAmount - expectedFinalAmount) >= 0.000001;
                attempt += 1) {
                moveBy((expectedFinalAmount - latestSentAmount) / amountPerPixel);
                dialEventCount += 1;
                await nextFrame();
            }
            if (Math.abs(latestSentAmount - expectedFinalAmount) >= 0.000001) {
                throw new Error(`The rail dial never reached the target amount: ${JSON.stringify({ expectedFinalAmount, latestSentAmount })}`);
            }
            window.dispatchEvent(pointerEvent("pointerup"));

            while (true) {
                const acknowledgement = api.runtimeInstallAckForTest();
                const acceptedSerial = Number(acknowledgement?.acceptedModulationSerial);
                if (Number.isInteger(latestSentSerial)
                    && acknowledgement?.rejectedSerial === latestSentSerial) {
                    throw new Error(`Final product amount was rejected: ${JSON.stringify(acknowledgement)}`);
                }
                if (Math.abs(latestSentAmount - expectedFinalAmount) < 0.000001
                    && Number.isInteger(latestSentSerial)
                    && acceptedSerial >= latestSentSerial) {
                    break;
                }
                if (performance.now() - finalStartedAt > 5_000) {
                    throw new Error("Timed out waiting for the final product amount.");
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }

            const finalFrontier = Number(api.runtimeInstallAckForTest()?.acceptedModulationSerial);
            return {
                acknowledgedEventCount: finalFrontier - baselineFrontier,
                baselineFrontier,
                cadenceEventCount: updates,
                dialEventCount,
                dispatchedEventCount: updates + dialEventCount,
                dispatchLatencyAverageMs: dispatchLatencyTotalMs / updates,
                dispatchLatencyMaxMs,
                finalAcknowledgementLatencyMs: performance.now() - finalStartedAt,
                finalAmount: latestSentAmount,
                finalAmountKind: "amount",
                finalFrontier,
                inputElapsedMs,
                inputRateHz: (updates * 1_000) / inputElapsedMs,
                sentEventCount,
            };
        } finally {
            MessagePort.prototype.postMessage = nativePostMessage;
        }
    }, { expectedFinalAmount: finalRouteAmount, updates: updateCount });
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

/**
 * The touch drag preview leads the finger (finger-clear amplification), so a
 * drop test must aim the FINGER at the point whose amplified preview lands on
 * the target. Ported from the desktop suite; iPhone 13 viewport is 390x844.
 */
function touchPointForModSourcePreviewTarget(start, target, viewportWidth, viewportHeight) {
    const delta = { x: target.x - start.x, y: target.y - start.y };
    const distance = Math.hypot(delta.x, delta.y);
    assert.ok(distance > 7, "A preview-led test drag must cross the activation distance.");
    const direction = { x: delta.x / distance, y: delta.y / distance };
    const previewBounds = { left: 23, right: viewportWidth - 23, top: 23, bottom: viewportHeight - 23 };
    const edgeDistances = [];
    if (direction.x > 0) edgeDistances.push((previewBounds.right - start.x) / direction.x);
    if (direction.x < 0) edgeDistances.push((previewBounds.left - start.x) / direction.x);
    if (direction.y > 0) edgeDistances.push((previewBounds.bottom - start.y) / direction.y);
    if (direction.y < 0) edgeDistances.push((previewBounds.top - start.y) / direction.y);
    const viewportTravel = Math.min(...edgeDistances.filter((candidate) => candidate >= 0));
    assert.ok(distance <= viewportTravel + 0.5, "The target center must be inside the preview-safe viewport.");
    const maximumGain = Math.min(Math.max(viewportWidth / 168, 2.1), 2.5);
    const previewTravelForFingerTravel = (fingerTravel) => {
        const rampProgress = Math.min(Math.max((fingerTravel - 7) / 64, 0), 1);
        const gainProgress = rampProgress * rampProgress * (3 - (2 * rampProgress));
        return fingerTravel * (1 + ((maximumGain - 1) * gainProgress));
    };
    let lower = 0;
    let upper = viewportTravel;
    for (let iteration = 0; iteration < 32; iteration += 1) {
        const middle = (lower + upper) / 2;
        if (previewTravelForFingerTravel(middle) < distance) {
            lower = middle;
        } else {
            upper = middle;
        }
    }
    const fingerTravel = (lower + upper) / 2;
    return {
        x: start.x + (direction.x * fingerTravel),
        y: start.y + (direction.y * fingerTravel),
    };
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
        localStorage.removeItem("cosimo.web.patch-state.v2");
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
    await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
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

test("generated browser accepts 100 voice routes and rejects malformed or over-capacity programs", async () => {
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
        assert.equal(expandedVoiceOutcome.accepted, true, JSON.stringify(expandedVoiceOutcome));
        assert.equal(
            expandedVoiceOutcome.acknowledgement.installedVoiceRouteCount,
            100,
            JSON.stringify(expandedVoiceOutcome),
        );

        const overCapacityOutcome = await sendAcknowledgedRuntimeEvent(
            page,
            "modulation",
            "modulationProgram",
            {
                ...emptyModulationProgram,
                voiceRouteCount: emptyModulationProgram.voiceRouteCells.length + 1,
            },
        );
        assert.equal(overCapacityOutcome.accepted, false, JSON.stringify(overCapacityOutcome));
        assert.equal(overCapacityOutcome.acknowledgement.rejectionReason, 3);
        assert.equal(
            overCapacityOutcome.acknowledgement.rejectedSerial,
            overCapacityOutcome.deliverySerial,
            JSON.stringify(overCapacityOutcome),
        );
    } finally {
        await page.close();
    }
});

test("the production worker installs the current v6 100-route rack profile end to end", async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const profile = matrixBenchmarkProfiles.get("voice-rack-100");
    assert.ok(profile);
    await page.addInitScript(({ modulationState, modulationStateKey }) => {
        localStorage.setItem("cosimo.web.patch-state.v2", JSON.stringify({
            format: "cosimo.browserPatchState",
            version: 2,
            sound: { parameters: {}, storedState: { [modulationStateKey]: modulationState } },
            auxiliary: {},
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
        await page.evaluate(() => localStorage.removeItem("cosimo.web.patch-state.v2")).catch(() => {});
        await page.close();
    }
});

test("mobile workspace removes worklet listeners when a section closes", async () => {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const pageFailures = observePageFailures(page);
    await page.addInitScript(installEndpointListenerProbe);
    await page.addInitScript(() => localStorage.removeItem("cosimo.web.patch-state.v2"));

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready"
            && globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__?.snapshot().activeReplyCount === 1
        ), null, { timeout: 30_000 });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "running");

        await selectMobileWorkspaceSection(page, "mod");
        await page.waitForFunction(() => (
            globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.snapshot().activeReplyCount === 0
        ));
        await selectMobileWorkspaceSection(page, "voice");
        await page.waitForFunction(() => {
            const probe = globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.snapshot();
            return probe.activeReplyCount === 1 && probe.removedReplyCount === 1;
        });

        await page.waitForFunction(() => (
            globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.snapshot().activeDeliveries >= 1
        ));
        await page.evaluate(() => globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.resetDeliveries());
        await page.waitForFunction(() => (
            globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.snapshot().activeDeliveries >= 3
        ));
        const probe = await page.evaluate(() => (
            globalThis.__COSIMO_ENDPOINT_LISTENER_PROBE__.snapshot()
        ));
        assert.equal(probe.staleDeliveries, 0, JSON.stringify(probe));
        pageFailures.assertClean();
    } finally {
        await page.close();
    }
});

test("mobile product stays realtime with four-way unison and one MSEG filter route after workspace history", {
    timeout: 90_000,
}, async (t) => {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const pageFailures = observePageFailures(page);
    await page.addInitScript(({ modulationState, modulationStateKey, parameters }) => {
        localStorage.setItem("cosimo.web.patch-state.v2", JSON.stringify({
            format: "cosimo.browserPatchState",
            version: 2,
            sound: { parameters, storedState: { [modulationStateKey]: modulationState } },
            auxiliary: {},
        }));
    }, {
        modulationState: reportedMobileStoredState,
        modulationStateKey: MODULATION_STATE_KEY,
        parameters: {
            oscAUnisonVoices: 4,
            oscBVolumeDb: -48,
            oscCVolumeDb: -48,
        },
    });

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            const acknowledgement = snapshot.latestRuntimeInstallAck;
            return snapshot.phase === "running"
                && snapshot.hasActiveTable
                && snapshot.parameterValues.oscAUnisonVoices === 4
                && snapshot.parameterValues.oscBVolumeDb === -48
                && snapshot.parameterValues.oscCVolumeDb === -48
                && Number(acknowledgement?.installedVoiceRouteCount)
                    + Number(acknowledgement?.installedMacroVoiceRouteCount)
                    + Number(acknowledgement?.installedVoiceRackRouteCount)
                    + Number(acknowledgement?.installedMacroRackRouteCount) === 1;
        }, null, { timeout: 30_000 });
        for (let cycle = 0; cycle < 10; cycle += 1) {
            await selectMobileWorkspaceSection(page, "fx");
            await selectMobileWorkspaceSection(page, "mod");
            await selectMobileWorkspaceSection(page, "voice");
        }
        await selectMobileWorkspaceSection(page, "mod");
        // T14: Mod opens on SOURCE; the mappings table is the sibling panel.
        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const mappingsTab = root?.querySelector('[data-role="mobile-mod-panel-tab-mappings"]');
            if (mappingsTab instanceof HTMLElement) mappingsTab.click();
        });
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return Boolean(
                root?.querySelector('[data-role="mod-mappings-rail-0"] .mobile-voice-cell.is-readout'),
            );
        });
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("laneTopology", { chainLength: 0, slotIds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 0 });
            api.noteOn(48, 96);
        });
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001
                && snapshot.startedVoiceIndices.length === 1
                && snapshot.latestEffectiveRackState?.laneCommittedChainLength === 0;
        }, null, { timeout: 10_000 });

        const latestValueCadence = await measureProductUiLatestValueCadence(page);
        // 119 frame-paced cadence moves plus a bounded exact-value dial
        // (calibration + corrections) on the pixel surface — every one of
        // them sent AND acknowledged.
        assert.equal(latestValueCadence.cadenceEventCount, 119, JSON.stringify(latestValueCadence));
        assert.ok(
            latestValueCadence.dialEventCount >= 1 && latestValueCadence.dialEventCount <= 9,
            JSON.stringify(latestValueCadence),
        );
        assert.equal(
            latestValueCadence.dispatchedEventCount,
            latestValueCadence.cadenceEventCount + latestValueCadence.dialEventCount,
            JSON.stringify(latestValueCadence),
        );
        assert.equal(
            latestValueCadence.sentEventCount,
            latestValueCadence.acknowledgedEventCount,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(
            latestValueCadence.dispatchLatencyAverageMs <= modulationUiAverageDispatchBudgetMs,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(
            latestValueCadence.dispatchLatencyMaxMs <= modulationUiMaximumDispatchBudgetMs,
            JSON.stringify(latestValueCadence),
        );
        assert.ok(latestValueCadence.inputRateHz >= 30, JSON.stringify(latestValueCadence));
        assert.ok(latestValueCadence.inputRateHz <= 144, JSON.stringify(latestValueCadence));
        assert.ok(latestValueCadence.finalAcknowledgementLatencyMs < 250, JSON.stringify(latestValueCadence));
        assertRealtimeContinuity(latestValueCadence);
        assertShippingRenderBudget(latestValueCadence);
        t.diagnostic(JSON.stringify({ reportedMobileWorkload: latestValueCadence }));

        const persisted = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.storedState());
        const modulationState = persisted?.[MODULATION_STATE_KEY] ?? persisted?.values?.[MODULATION_STATE_KEY];
        const persistedModulation = deserializeModulationState(modulationState);
        assert.equal(persistedModulation.routes.length, 1);
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
        pageFailures.assertClean();
    } finally {
        await page.evaluate(() => {
            globalThis.__COSIMO_WEB_POC__?.noteOff(48);
            localStorage.removeItem("cosimo.web.patch-state.v2");
        }).catch(() => {});
        await page.close();
    }
});

test("lane slot-param edits stream at drag rate with serial acknowledgment and no deadline misses", {
    timeout: 120_000,
}, async () => {
    // The Effects Lane HOT PATH: live per-slot parameter records are small
    // acked deltas, never full-state reuploads. This measures the whole
    // product path — sendEvent -> engine apply -> same-frame serial echo ->
    // effectiveRackState readback — at knob-drag cadence under sounding
    // audio, and reports the numbers rather than judging them.
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const pageFailures = observePageFailures(page);

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().phase === "running");

        // A lane chain with the pool delay, committed and acknowledged.
        // (Program-install latency at the widened tables is exercised by the
        // product's own boot install and the 100-mapping stress suite; direct
        // installs need exclusive host-lane ownership this page's worker
        // holds, so no separate timing probe here.)
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("laneTopology", {
                chainLength: 2,
                slotIds: [6, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                enabledMask: 0b11,
            });
            api.noteOn(48, 96);
        });
        await page.waitForFunction(() => (
            Number(globalThis.__COSIMO_WEB_POC__.getSnapshot()
                .latestEffectiveRackState?.laneCommittedGeneration) >= 1
        ), null, { timeout: 10_000 });

        await resetMeasuredAudioMetrics(page);
        const stream = await page.evaluate(async () => {
            const api = globalThis.__COSIMO_WEB_POC__;
            const updates = 120;
            const beganAt = performance.now();
            let dispatchLatencyTotalMs = 0;
            let dispatchLatencyMaxMs = 0;

            for (let serial = 1; serial <= updates; serial += 1) {
                const startedAt = performance.now();
                api.sendEvent("laneSlotParams", {
                    slotId: 14,
                    deliverySerial: serial,
                    values: [90, 0, 18000, 0.2 + ((serial % 50) * 0.01), 0, 0, 0, 0],
                });
                const dispatchLatencyMs = performance.now() - startedAt;
                dispatchLatencyTotalMs += dispatchLatencyMs;
                dispatchLatencyMaxMs = Math.max(dispatchLatencyMaxMs, dispatchLatencyMs);
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            const inputElapsedMs = performance.now() - beganAt;

            const finalStartedAt = performance.now();
            while (true) {
                const rackState = api.getSnapshot().latestEffectiveRackState;
                if (Number(rackState?.laneParamsAcknowledgedSerial) === updates) {
                    break;
                }
                if (performance.now() - finalStartedAt > 5_000) {
                    throw new Error(`Lane param acknowledgment never reached ${updates}: ${JSON.stringify(rackState)}`);
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }

            return {
                updates,
                dispatchLatencyAverageMs: dispatchLatencyTotalMs / updates,
                dispatchLatencyMaxMs,
                inputElapsedMs,
                inputRateHz: (updates * 1_000) / inputElapsedMs,
                finalAcknowledgementLatencyMs: performance.now() - finalStartedAt,
                rejectedUploads: Number(api.getSnapshot().latestEffectiveRackState?.laneRejectedUploadCount),
            };
        });
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= 512
        ), null, { timeout: 15_000 });
        const audio = await readMeasuredAudioMetrics(page);

        assert.equal(stream.rejectedUploads, 0, JSON.stringify(stream));
        assert.ok(stream.inputRateHz >= 30 && stream.inputRateHz <= 144, JSON.stringify(stream));
        // The hot-path bound: the FINAL edit's acknowledgment lands within the
        // same envelope as the modulation-amount stream (~25ms measured
        // baseline; 250ms is the same generous ceiling that path asserts).
        assert.ok(stream.finalAcknowledgementLatencyMs < 250, JSON.stringify(stream));
        assert.equal(audio.definiteDeadlineMissBlocks, 0, JSON.stringify(audio));
        assert.equal(audio.frameDiscontinuityBlocks, 0, JSON.stringify(audio));
        console.log(`# ${JSON.stringify({ laneHotPath: stream })}`);
        pageFailures.assertClean();
    } finally {
        await page.evaluate(() => {
            globalThis.__COSIMO_WEB_POC__?.noteOff(48);
        }).catch(() => {});
        await page.close();
    }
});

test("16 sounding voices sustain 100 mappings, isolated live edits, and the full 1131-cell domain", {
    timeout: 240_000,
}, async (t) => {
    const page = await browser.newPage({ ...devices["iPhone 13"] });
    const pageFailures = observePageFailures(page);

    try {
        assert.equal(allStressRoutes.length, 1131);
        assert.deepEqual([
            mixedHundredRouteProgram.voiceRouteCount,
            mixedHundredRouteProgram.macroVoiceRouteCount,
            mixedHundredRouteProgram.voiceRackRouteCount,
            mixedHundredRouteProgram.macroRackRouteCount,
        ], [30, 20, 30, 20]);
        assert.equal(hundredVoiceRouteProgram.voiceRouteCount, 100);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteCount, 100);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteCells[99], 439);
        assert.equal(hundredVoiceTailSentinelProgram.voiceRouteAmounts[439], 10);
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
        ], [459, 204, 324, 144]);
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
        ].filter((amount) => amount !== 0).length, 1131);
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
            for (const oscillator of ["A", "B", "C"]) {
                api.setParameter(`osc${oscillator}UnisonVoices`, 1);
                api.setParameter(`osc${oscillator}WarpMode`, 0);
            }
            api.sendEvent("laneTopology", { chainLength: 0, slotIds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 0 });
        });
        await sendAcceptedModulationEvent(page, "modulationProgram", mixedHundredRouteProgram);
        await sendAcceptedArticulationEvent(page, "articulationSnapshot", {
            ...createDisabledArticulationRuntimeUpload(0),
            enabled: true,
            routeAmounts: Array.from(
                { length: MODULATION_ARTICULATION_ROUTE_CELL_COUNT },
                () => ARTICULATION_ROUTE_AMOUNT_INHERIT,
            ),
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
            cellIndex: 439,
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
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (let note = 48; note < 64; note += 1) api.noteOff(note, 1);
        });
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.heldNoteCount === 0 && snapshot.audioPeakCurrent < 0.00001;
        });
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (const oscillator of ["A", "B", "C"]) {
                api.setParameter(`osc${oscillator}UnisonVoices`, 2);
                api.setParameter(`osc${oscillator}WarpMode`, 1);
                api.setParameter(`osc${oscillator}WarpAmount`, 0.6);
            }
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 1_200);
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 0.35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 1, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 0, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 3, paramIndex: 0, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneSlotParamValue", { slotId: 4, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 5, paramIndex: 7, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 6, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 7, paramIndex: 3, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneTopology", { chainLength: 8, slotIds: [0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 255 });
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

        // Start a fresh production AudioContext so the maximum shipping workload
        // measures steady-state pacing instead of renderer catch-up. The old test
        // rendered every callback twice as a synthetic headroom probe; the hard-cut
        // release contract is the real callback rate with all three oscillators.
        await page.goto(`${baseUrl}?test=1&runtime-owner=host`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.locator("#cosimo-start-overlay").click();
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
            return snapshot?.phase === "running" && snapshot.hasActiveTable;
        }, null, { timeout: 30_000 });
        for (let cycle = 0; cycle < 10; cycle += 1) {
            await selectMobileWorkspaceSection(page, "fx");
            await selectMobileWorkspaceSection(page, "mod");
            await selectMobileWorkspaceSection(page, "voice");
        }
        await installNeutralMatrixSourceContract(page);
        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (const oscillator of ["A", "B", "C"]) {
                api.setParameter(`osc${oscillator}UnisonVoices`, 1);
                api.setParameter(`osc${oscillator}WarpMode`, 0);
                api.setParameter(`osc${oscillator}WarpAmount`, 0);
            }
            api.setParameter("filterMode", 1);
            api.setParameter("filterCutoff", 1_200);
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 0.35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 1, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 0, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 3, paramIndex: 0, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneSlotParamValue", { slotId: 4, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 5, paramIndex: 7, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 6, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 7, paramIndex: 3, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneTopology", { chainLength: 8, slotIds: [0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 255 });
            for (let note = 48; note < 64; note += 1) api.noteOn(note, 100, 1);
        });
        await applyNeutralMatrixExpressionContract(page);
        await page.waitForFunction(() => {
            const snapshot = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return snapshot.audioPeak > 0.00001
                && snapshot.heldNoteCount === 16
                && snapshot.startedVoiceIndices.length === 16;
        }, null, { timeout: 10_000 });
        const realtimePacing = await waitForRealtimeAudioPacing(page, emptyModulationProgram);
        const inactiveTailPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            disabledAllMappingProgram,
        );
        const voicePair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixVoiceHundredProgram,
        );
        const voiceRackPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixVoiceRackHundredProgram,
        );
        const mixedPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixMixedHundredProgram,
        );
        const combinedPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixCombinedTwoHundredProgram,
        );
        const storedFullDomainHundredPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixStoredFullDomainHundredProgram,
        );
        const fullDomainNeutralPair = await measureMatrixProgramWithAdjacentEmpty(
            page,
            matrixActiveFullDomainProgram,
        );
        const inactiveTailLoad = inactiveTailPair.loaded;
        const routeDominantShippingLoad = voicePair.loaded;
        const voiceRackShippingLoad = voiceRackPair.loaded;
        const mixedShippingLoad = mixedPair.loaded;
        const combinedShippingLoad = combinedPair.loaded;
        const storedFullDomainHundredLoad = storedFullDomainHundredPair.loaded;
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
            realtimePacing,
            inactiveTailPair,
            voicePair,
            voiceRackPair,
            mixedPair,
            combinedPair,
            storedFullDomainHundredPair,
            fullDomainNeutralPair,
            inactiveMacroVoiceBaseQ,
            inactiveVoiceTailBaseQ,
            macroVoiceHighQ,
            tailSentinelBaseQ,
            tailSentinelHighQ,
        }));

        assert.ok(baseline.audioRms > 0.00001, JSON.stringify(baseline));
        assertRealtimeContinuity(baseline);
        assertShippingRenderBudget(baseline);
        assertSustainedRealtimeThroughput(baseline);
        for (const measuredHundred of [hundredVoiceMappings, hundredVoiceRackMappings, hundredMappings]) {
            assert.ok(measuredHundred.audioRms > 0.00001);
            assertRealtimeContinuity(measuredHundred);
            assertShippingRenderBudget(measuredHundred);
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
            // WebKit reports worklet duration with a 1 ms Date.now clock. One
            // timer step is 0.375 of a 128-frame quantum at 48 kHz; keep this
            // comparison inside that quantisation error while the independent
            // pacing, cadence, and frame-continuity gates remain unchanged.
            0.375,
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
        for (const matrixPair of [
            inactiveTailPair,
            voicePair,
            voiceRackPair,
            mixedPair,
            combinedPair,
            storedFullDomainHundredPair,
        ]) {
            for (const measurement of [matrixPair.before, matrixPair.loaded, matrixPair.after]) {
                assert.ok(measurement.audioRms > 0.00001);
                assert.equal(measurement.processMultiplier, 1);
                assertRealtimeContinuity(measurement);
                assertSustainedRealtimeThroughput(measurement, 1.1);
                assertRealtimePacedMeasurement(measurement);
            }
        }
        assert.ok(
            inactiveTailLoad.quantizedAverageLoad
                <= inactiveTailPair.baseline.quantizedAverageLoad + 0.03,
            JSON.stringify({ inactiveTailPair }),
        );
        assertNoMeaningfulCallbackGapIncrease(
            routeDominantShippingLoad,
            voicePair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            voiceRackShippingLoad,
            voiceRackPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            mixedShippingLoad,
            mixedPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            combinedShippingLoad,
            combinedPair.baseline,
        );
        assertNoMeaningfulCallbackGapIncrease(
            storedFullDomainHundredLoad,
            storedFullDomainHundredPair.baseline,
        );
        for (const hundredRoutePair of [
            voicePair,
            voiceRackPair,
            mixedPair,
            storedFullDomainHundredPair,
        ]) {
            assertMatrixAddedLoad(hundredRoutePair.loaded, hundredRoutePair.baseline, 0.1);
        }
        assertMatrixAddedLoad(combinedShippingLoad, combinedPair.baseline, 0.15);
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
            localStorage.removeItem("cosimo.web.patch-state.v2");
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
            api.sendEvent("laneTopology", { chainLength: 0, slotIds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 0 });
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 1, deliverySerial: 0, value: 30 });
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 0 });
        });
        const dryRms = await measureHeldNote(page);
        assert.ok(dryRms > 1e-5, `Dry rack must be audible, received RMS ${dryRms}.`);

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("laneTopology", { chainLength: 1, slotIds: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 1 });
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 1 });
        });
        const drivenRms = await measureHeldNote(page);
        assert.ok(
            Math.abs(drivenRms - dryRms) / dryRms > 0.08,
            `Distortion parameter must measurably change audio (dry ${dryRms}, wet ${drivenRms}).`,
        );

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 0 });
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
            api.sendEvent("laneSlotParamValue", { slotId: 1, paramIndex: 3, deliverySerial: 0, value: 0.35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 1, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 2, paramIndex: 0, deliverySerial: 0, value: 35 });
            api.sendEvent("laneSlotParamValue", { slotId: 3, paramIndex: 0, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneSlotParamValue", { slotId: 4, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 5, paramIndex: 7, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 6, paramIndex: 3, deliverySerial: 0, value: 0.25 });
            api.sendEvent("laneSlotParamValue", { slotId: 7, paramIndex: 3, deliverySerial: 0, value: 0.3 });
            api.sendEvent("laneTopology", { chainLength: 8, slotIds: [0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 255 });
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
        await page.evaluate(() => localStorage.removeItem("cosimo.web.patch-state.v2")).catch(() => {});
        await page.close();
    }
});

test("generated product renders oscillator A, B, and C independently", async (t) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const pageFailures = observePageFailures(page);
    await page.addInitScript(() => localStorage.removeItem("cosimo.web.patch-state.v2"));

    try {
        await page.goto(`${baseUrl}?test=1`, { waitUntil: "domcontentloaded" });
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
            api.sendEvent("laneTopology", { chainLength: 0, slotIds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], enabledMask: 0 });
            api.setParameter("filterMode", 0);
        });

        const oscillatorRms = {};
        for (const oscillator of ["A", "B", "C"]) {
            await page.evaluate((activeOscillator) => {
                const api = globalThis.__COSIMO_WEB_POC__;
                for (const candidate of ["A", "B", "C"])
                    api.setParameter(`osc${candidate}Mute`, candidate === activeOscillator ? 0 : 1);
            }, oscillator);
            await page.waitForTimeout(100);
            oscillatorRms[oscillator] = await measureHeldNote(page);
            assert.ok(
                oscillatorRms[oscillator] > 1e-5,
                `Oscillator ${oscillator} must be audible on its own; received RMS ${oscillatorRms[oscillator]}.`,
            );
        }

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            for (const oscillator of ["A", "B", "C"])
                api.setParameter(`osc${oscillator}Mute`, 0);
        });
        const combinedRms = await measureHeldNote(page);
        assert.ok(combinedRms > 1e-5, `The combined A/B/C sound must be audible; received RMS ${combinedRms}.`);

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.setParameter("filterCutoff", 40);
            api.setParameter("filterQ", 0.707);
            api.setParameter("filterMode", 1);
        });
        await page.waitForTimeout(100);
        const lowpassRms = await measureHeldNote(page);
        assert.ok(
            lowpassRms < combinedRms * 0.6,
            `The real low-pass filter must attenuate the A/B/C sound (off ${combinedRms}, on ${lowpassRms}).`,
        );

        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        assert.deepEqual(
            snapshot.latestRuntimeStates.map((runtimeState) => runtimeState?.oscillatorIndex),
            [0, 1, 2],
        );
        pageFailures.assertClean();
        t.diagnostic(JSON.stringify({ combinedRms, lowpassRms, oscillatorRms }));
    } finally {
        await page.evaluate(() => localStorage.removeItem("cosimo.web.patch-state.v2")).catch(() => {});
        await page.close();
    }
});

test("generated product UI restores oscillator parameters and rack state through reload", async (t) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.addInitScript(() => {
        if (sessionStorage.getItem("cosimo-rack-state-test-initialised") !== "1") {
            localStorage.removeItem("cosimo.web.patch-state.v2");
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
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        const panInput = page.locator('input[aria-label="Pan"]');
        await panInput.press("Enter");
        await panInput.fill("25");
        await panInput.press("Enter");
        await page.waitForFunction(() => {
            const saved = JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}");
            return Math.abs(Number(saved?.sound?.parameters?.oscBPan) - 0.25) < 0.0001;
        });
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

        await waitForAsyncPageCondition(page, async () => {
            const state = await globalThis.__COSIMO_WEB_POC__.storedState();
            const rack = JSON.parse(String(state.values?.["lane.v1"]));
            return rack.order[0] === "reverb" && rack.enabled.chorus === true;
        });
        const beforeReload = await page.evaluate(async () => ({
            connection: (await globalThis.__COSIMO_WEB_POC__.storedState()).values?.["lane.v1"] ?? null,
            local: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}")?.sound?.storedState?.["lane.v1"] ?? null,
            localOscBPan: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}")?.sound?.parameters?.oscBPan ?? null,
        }));
        assert.equal(beforeReload.localOscBPan, 0.25);
        t.diagnostic(`Before reload: ${JSON.stringify(beforeReload)}`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
            timeout: 30_000,
        });
        await page.waitForTimeout(500);
        const afterReload = await page.evaluate(async () => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return {
                connection: (await globalThis.__COSIMO_WEB_POC__.storedState()).values?.["lane.v1"] ?? null,
                local: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}")?.sound?.storedState?.["lane.v1"] ?? null,
                localOscBPan: JSON.parse(localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}")?.sound?.parameters?.oscBPan ?? null,
                firstRole: root?.querySelector('[data-role="rack-module-list"]')?.firstElementChild?.getAttribute("data-role") ?? null,
                chorusPressed: root?.querySelector('[data-role="rack-enabled-chorus"]')?.getAttribute("aria-pressed") ?? null,
            };
        });
        t.diagnostic(`After reload: ${JSON.stringify(afterReload)}`);
        assert.equal(afterReload.firstRole, "rack-module-reverb");
        assert.equal(afterReload.chorusPressed, "true");
        assert.equal(afterReload.localOscBPan, 0.25);
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForTimeout(100);
        // ADR-028: Pan displays in L/C/R language via the one shared
        // formatter; the stored value (0.25, asserted above) is unchanged.
        assert.equal(await panInput.inputValue(), "25 R");
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
        await waitForAsyncPageCondition(page, async () => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const list = root?.querySelector('[data-role="rack-module-list"]');
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            const rack = JSON.parse(String(stored.values?.["lane.v1"]));
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
            return JSON.parse(String(stored.values?.["lane.v1"]));
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
        const targetCenter = await centerOf(page.locator('[data-rack-mod-target="distortionKnee"]'));
        const viewport = page.viewportSize();
        const targetEnd = touchPointForModSourcePreviewTarget(
            sourceStart,
            targetCenter,
            viewport.width,
            viewport.height,
        );
        // Four steps keep the first move past the 7px drag-activation radius
        // on the compensated (shorter) finger path.
        await dispatchTouchDrag(page, sourceStart, targetEnd, {
            steps: 4,
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

        await waitForAsyncPageCondition(page, async (modulationStateKey) => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            const serialized = stored.values?.[modulationStateKey];
            if (typeof serialized !== "string") {
                return false;
            }
            const state = JSON.parse(serialized);
            return Array.isArray(state.routes) && state.routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "lane.distortion#1.distortionKnee"
            ));
        }, MODULATION_STATE_KEY, { timeout: 3_000 });
        const modulationState = await page.evaluate(async (modulationStateKey) => {
            const stored = await globalThis.__COSIMO_WEB_POC__.storedState();
            return stored.values?.[modulationStateKey] ?? null;
        }, MODULATION_STATE_KEY);
        const route = deserializeModulationState(modulationState).routes.find((candidate) => (
            candidate.sourceKind === "mseg"
            && candidate.sourceSlot === 1
            && candidate.targetKind === "lane.distortion#1.distortionKnee"
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
            const NativeAudioWorkletNode = globalThis.AudioWorkletNode;
            globalThis.AudioWorkletNode = new Proxy(NativeAudioWorkletNode, {
                construct(target, argumentsList, newTarget) {
                    globalThis.__COSIMO_AUDIO_CONTEXT_FOR_TEST__ ??= argumentsList[0];
                    return Reflect.construct(target, argumentsList, newTarget);
                },
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

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
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

        await page.evaluate(() => {
            const api = globalThis.__COSIMO_WEB_POC__;
            api.noteOn(48, 96);
            Object.defineProperty(document, "hidden", { configurable: true, value: true });
            document.dispatchEvent(new Event("visibilitychange"));
            api.resetAudioMetrics();
        });
        await page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioContextState === "running"
            && globalThis.__COSIMO_WEB_POC__.getSnapshot().audioWorkletBlockCount >= 256
            && globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRms > 0.00001
        ));
        await page.evaluate(() => {
            globalThis.__COSIMO_WEB_POC__.noteOff(48);
            Object.defineProperty(document, "hidden", { configurable: true, value: false });
            document.dispatchEvent(new Event("visibilitychange"));
        });

        await page.evaluate(() => globalThis.__COSIMO_AUDIO_CONTEXT_FOR_TEST__.suspend());
        assert.equal(
            await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot().audioContextState),
            "suspended",
            "Expected the interruption harness to suspend the production AudioContext.",
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

test("generated browser proof stacks full-width wavetable and filter rows on mobile", {
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
        // T05: compact mobile renders the ADR-024 focused wavetable editor
        // above the filter card, splitting the Voice page's height 50/50.
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const editor = root?.querySelector('[data-role="desktop-oscillator-connection-boundary"]')?.getBoundingClientRect();
            const filter = root?.querySelector('[data-role="filter-card"]')?.getBoundingClientRect();
            return Boolean(
                editor && editor.width > 0 && editor.height > 0
                && filter && filter.width > 0 && filter.height > 0,
            );
        }, null, { timeout: 30_000 });

        const cards = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const readBounds = (selector) => {
                const bounds = root?.querySelector(selector)?.getBoundingClientRect();
                return bounds ? {
                    x: bounds.x,
                    y: bounds.y,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                } : null;
            };

            return {
                filter: readBounds('[data-role="filter-card"]'),
                wavetable: readBounds('[data-role="desktop-oscillator-connection-boundary"]'),
            };
        });

        assert.ok(cards.wavetable?.width > 0 && cards.wavetable.height > 0, "Expected the mobile wavetable editor to be visible.");
        assert.ok(cards.filter?.width > 0 && cards.filter.height > 0, "Expected the mobile filter card to be visible.");
        assert.ok(
            cards.filter.y >= cards.wavetable.bottom + 6,
            `Expected the filter on its own row below the wavetable: ${JSON.stringify(cards)}`,
        );
        assert.ok(
            Math.abs(cards.filter.x - cards.wavetable.x) <= 1
                && Math.abs(cards.filter.width - cards.wavetable.width) <= 1,
            `Expected equal full-width mobile cards: ${JSON.stringify(cards)}`,
        );
        assert.ok(
            Math.abs(cards.filter.height - cards.wavetable.height) <= 2,
            `Expected the 50/50 height split: ${JSON.stringify(cards)}`,
        );
    } finally {
        await page.close();
    }
});
