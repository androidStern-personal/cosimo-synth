import assert from "node:assert/strict";
import test from "node:test";

import { chromium, webkit } from "playwright";

import { startStaticRepoServer } from "./helpers/desktop_harness_browser.mjs";
import {
    createCurrentSpeedrunContext,
    readSpeedrunFixture,
} from "./helpers/speedrun_test_context.mjs";

let server;
let fixture;

function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function setLaneEnabled(lane, enabledDeviceId) {
    const next = clone(lane);
    next.chain = next.chain.map((node) => {
        if (node.kind === "device") {
            return { ...node, enabled: node.deviceId === enabledDeviceId };
        }
        return {
            ...node,
            enabled: true,
            branches: node.branches.map((branch) => branch.map((placement) => ({
                ...placement,
                enabled: placement.deviceId === enabledDeviceId,
            }))),
        };
    });
    return next;
}

function state(defaults, lane, parameterOverrides) {
    return {
        parameters: { ...defaults.parameters, ...parameterOverrides },
        modulation: clone(defaults.modulation),
        lane,
        articulations: clone(defaults.articulations),
    };
}

function timedSection(index, checkpointIndex, kind) {
    const startFrame = index * 60;
    const endFrame = startFrame + 60;
    return {
        section: {
            id: `audio-${index}`,
            kind,
            label: `Audio ${index}`,
            captions: [],
            uncappedCaptions: [],
            ops: [],
            opCaptionLines: [],
        },
        startFrame,
        endFrame,
        startSample: startFrame * 1_600,
        endSample: endFrame * 1_600,
        captionEvents: [],
        opSpans: [],
        checkpointIndex,
    };
}

function timeline(checkpointCount) {
    return {
        fps: 30,
        sampleRate: 48_000,
        samplesPerFrame: 1_600,
        durationInFrames: checkpointCount * 60,
        compressionLevel: 0,
        sections: Array.from({ length: checkpointCount }, (_, index) => (
            timedSection(index, index, index === 2 ? "effect" : index === 3 ? "filter" : "oscillator")
        )),
    };
}

async function buildFixture() {
    const [{ defaults }, laneFixture] = await Promise.all([
        createCurrentSpeedrunContext(),
        readSpeedrunFixture("effects-lane-split.json"),
    ]);
    const noEffects = setLaneEnabled(laneFixture, null);
    const delayEnabled = setLaneEnabled(laneFixture, "delay#2");
    const baseParameters = {
        sourceMode: 0,
        oscAWavetableSelect: 0,
        oscAWavetablePosition: 0.2,
        oscAVolumeDb: -18,
        oscAMute: 0,
        oscASolo: 0,
        oscAPhaseRandom: 0,
        oscARetrigger: 1,
        oscBWavetableSelect: 0,
        oscBWavetablePosition: 0.6,
        oscBVolumeDb: -18,
        oscBMute: 1,
        oscBSolo: 0,
        oscBPhaseRandom: 0,
        oscBRetrigger: 1,
        oscBSemitone: 7,
        oscCWavetableSelect: 0,
        oscCMute: 1,
        filterMode: 1,
        filterCutoff: 16_000,
        filterQ: 0.7,
        filterMix: 1,
        ampRelease: 0.08,
    };
    const oneOscillator = state(defaults, noEffects, baseParameters);
    const twoOscillators = state(defaults, noEffects, {
        ...baseParameters,
        oscBMute: 0,
    });
    const delay = state(defaults, delayEnabled, {
        ...baseParameters,
        oscBMute: 0,
    });
    const filtered = state(defaults, delayEnabled, {
        ...baseParameters,
        oscBMute: 0,
        filterCutoff: 240,
    });
    return {
        states: [oneOscillator, twoOscillators, delay, filtered],
        timeline: timeline(4),
        performance: {
            durationSec: 1,
            events: [
                { atSec: 0, code: packMidi(0x90, 60, 100) },
                { atSec: 0.35, code: packMidi(0x80, 60, 0) },
            ],
        },
        concurrency: 2,
    };
}

async function openHarness(browserType) {
    const browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
    if (process.env.COSIMO_SPEEDRUN_DEBUG === "1") {
        page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
        page.on("pageerror", (error) => console.error(`[browser:error] ${error.stack ?? error}`));
    }
    await page.goto(`${server.baseUrl}build/speedrun-audio-test/audio-browser-harness.html`);
    await page.waitForFunction(() => Boolean(window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__));
    return { browser, page };
}

test.before(async () => {
    [server, fixture] = await Promise.all([
        startStaticRepoServer(),
        buildFixture(),
    ]);
});

test.after(async () => {
    await server?.stop();
});

for (const [browserName, browserType] of [["Chromium", chromium], ["WebKit", webkit]]) {
    test(`${browserName}: real offline services render deterministic, differential checkpoint audio`, { timeout: 240_000 }, async () => {
        const { browser, page } = await openHarness(browserType);
        try {
            const first = await page.evaluate((request) => (
                window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__.render(request)
            ), fixture);
            const second = await page.evaluate((request) => (
                window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__.render(request)
            ), fixture);

            const [oneOscillator, twoOscillators, delay, filtered] = first.checkpoints;
            assert.ok(oneOscillator.rms > 1e-5, `${browserName} rendered silence`);
            assert.deepEqual(
                first.checkpoints.map((checkpoint) => checkpoint.digest),
                second.checkpoints.map((checkpoint) => checkpoint.digest),
            );
            assert.equal(first.master.digest, second.master.digest);
            assert.ok(
                twoOscillators.rms > oneOscillator.rms * 1.02,
                `${browserName} second oscillator did not raise RMS: ${oneOscillator.rms} -> ${twoOscillators.rms}`,
            );
            assert.ok(
                delay.tailRms > twoOscillators.tailRms * 1.02,
                `${browserName} delay did not raise tail energy: ${twoOscillators.tailRms} -> ${delay.tailRms}`,
            );
            assert.ok(
                filtered.spectralCentroid < delay.spectralCentroid * 0.85,
                `${browserName} low cutoff did not lower centroid: ${delay.spectralCentroid} -> ${filtered.spectralCentroid}`,
            );
            assert.equal(first.master.frameCount, fixture.timeline.durationInFrames * 1_600);
            assert.ok(first.master.rms > 1e-5);
            assert.equal(first.master.wavByteLength, 44 + first.master.frameCount * 4);
            assert.ok(first.checkpoints.every((checkpoint) => checkpoint.metrics.installFrameCount <= 192_000));
            assert.ok(first.wallElapsedMilliseconds > 0);
            assert.ok(first.wallRealtimeMultiplier > 0);
            if (process.env.COSIMO_SPEEDRUN_REPORT === "1") {
                console.info("speedrun-audio-measurement", JSON.stringify({
                    browser: browserName,
                    wallElapsedMilliseconds: first.wallElapsedMilliseconds,
                    renderedAudioSeconds: first.renderedAudioSeconds,
                    wallRealtimeMultiplier: first.wallRealtimeMultiplier,
                    checkpointRealtimeMultipliers: first.checkpoints.map((checkpoint) => (
                        checkpoint.metrics.realtimeMultiplier
                    )),
                    checkpointInstallFrames: first.checkpoints.map((checkpoint) => (
                        checkpoint.metrics.installFrameCount
                    )),
                }));
            }
        } finally {
            await browser.close();
        }
    });
}

test("wavetable resource failure is typed and bounded", { timeout: 120_000 }, async () => {
    const { browser, page } = await openHarness(chromium);
    try {
        const request = {
            ...fixture,
            states: [fixture.states[0]],
            timeline: timeline(1),
            concurrency: 1,
            poisonResources: true,
            maxInstallFrames: 48_000,
        };
        await assert.rejects(
            page.evaluate((value) => window.__COSIMO_SPEEDRUN_AUDIO_HARNESS__.render(value), request),
            /wavetable install failed/,
        );
    } finally {
        await browser.close();
    }
});
